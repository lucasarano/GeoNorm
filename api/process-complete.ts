import { VercelRequest, VercelResponse } from '@vercel/node'
import dotenv from 'dotenv'
import { zipCodeService } from '../backend/services/zipCodeService.js'
import { cleanParaguayAddresses } from '../backend/cleanParaguayAddresses.js'

// Load environment variables
dotenv.config()

// Batch processing configuration
const BATCH_SIZE = 50 // rows per batch
const MAX_CONCURRENT_BATCHES = 10 // simultaneous OpenAI requests
const BATCH_TIMEOUT = Number(process.env.CLEANING_BATCH_TIMEOUT_MS) || 180000 // configurable timeout per batch (default 3 minutes)

interface RowTimelineEvent {
  phase: string
  timestamp: number
  duration?: number
  details?: Record<string, unknown>
}

interface RowTimeline {
  rowIndex: number
  events: RowTimelineEvent[]
}

interface BatchResult {
  batchIndex: number
  startRow: number
  endRow: number
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'retrying'
  data?: any[]
  error?: string
  processingTime?: number
  retryCount?: number
  rowTimelines?: RowTimeline[]
}

// Utility function to split CSV into batches
function createBatches(csvLines: string[], headerLine: string): { batchIndex: number, startRow: number, endRow: number, csvData: string }[] {
  const batches: { batchIndex: number, startRow: number, endRow: number, csvData: string }[] = []
  const dataLines = csvLines.slice(1) // Skip header

  for (let i = 0; i < dataLines.length; i += BATCH_SIZE) {
    const batchLines = dataLines.slice(i, Math.min(i + BATCH_SIZE, dataLines.length))
    const batchCsv = [headerLine, ...batchLines].join('\n')

    batches.push({
      batchIndex: Math.floor(i / BATCH_SIZE),
      startRow: i + 1, // +1 because we skip header
      endRow: Math.min(i + BATCH_SIZE, dataLines.length),
      csvData: batchCsv
    })
  }

  return batches
}

// Process a single batch with retry logic
async function processBatch(batchInfo: any, openaiApiKey: string, maxRetries = 3): Promise<BatchResult> {
  const result: BatchResult = {
    batchIndex: batchInfo.batchIndex,
    startRow: batchInfo.startRow,
    endRow: batchInfo.endRow,
    status: 'processing',
    retryCount: 0
  }

  const startTime = Date.now()

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      result.status = attempt > 0 ? 'retrying' : 'processing'
      result.retryCount = attempt

      const cleaningStart = Date.now()
      console.log(`[BATCH][${batchInfo.batchIndex}] Cleaning started at`, new Date(cleaningStart).toISOString())
      const cleanedCsv: string = await cleanParaguayAddresses(openaiApiKey, batchInfo.csvData)
      const cleaningEnd = Date.now()
      console.log(`[BATCH][${batchInfo.batchIndex}] Cleaning finished at`, new Date(cleaningEnd).toISOString(), 'duration', cleaningEnd - cleaningStart, 'ms')

      // Parse the cleaned CSV
      const cleanedLines = cleanedCsv.trim().split('\n')
      const batchData = cleanedLines.slice(1)
        .filter((line: string) => line && line.trim().length > 0)
        .map((line: string) => {
          const values = parseCleanCSVLine(line)
          return {
            originalAddress: values[0] || '',
            originalCity: values[1] || '',
            originalState: values[2] || '',
            originalPhone: values[3] || '',
            address: values[4] || '',
            city: values[5] || '',
            state: values[6] || '',
            phone: values[7] || '',
            email: values[8] || ''
          }
        })

      result.status = 'completed'
      result.data = batchData
      result.processingTime = Date.now() - startTime
      const baseRowIndex = Math.max(0, (batchInfo.startRow ?? 1) - 1)
      result.rowTimelines = batchData.map((_, rowIdx) => ({
        rowIndex: baseRowIndex + rowIdx,
        events: [
          { phase: 'cleaning_started', timestamp: cleaningStart },
          {
            phase: 'cleaning_completed',
            timestamp: cleaningEnd,
            duration: cleaningEnd - cleaningStart
          }
        ]
      }))

      console.log(`[BATCH][${result.batchIndex}] Successfully processed ${batchData.length} rows in ${result.processingTime}ms`)
      return result

    } catch (error: any) {
      console.error(`[BATCH][${result.batchIndex}] Attempt ${attempt + 1} failed:`, error.message)

      if (attempt === maxRetries) {
        result.status = 'failed'
        result.error = error.message
        result.processingTime = Date.now() - startTime
        console.error(`[BATCH][${result.batchIndex}] Failed after ${maxRetries + 1} attempts`)
        return result
      }

      // Wait before retrying (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000))
    }
  }

  return result
}

// Process batches with concurrency control
async function processBatchesConcurrently(
  batches: any[],
  openaiApiKey: string,
  onBatchCompleted?: (batchResult: BatchResult) => void | Promise<void>
): Promise<BatchResult[]> {
  console.log(`[BATCH_MANAGER] Processing ${batches.length} batches with max concurrency ${MAX_CONCURRENT_BATCHES}`)

  const results: BatchResult[] = new Array(batches.length)
  let nextBatchIndex = 0

  const runNext = async (): Promise<void> => {
    const currentIndex = nextBatchIndex++
    if (currentIndex >= batches.length) {
      return
    }

    const batchInfo = batches[currentIndex]
    console.log(`[BATCH_MANAGER] Worker picked batch index ${currentIndex}`, 'queue position', nextBatchIndex - 1)

    let timeoutHandle: NodeJS.Timeout | null = null
    const timeoutPromise = new Promise<BatchResult>((_, reject) => {
      timeoutHandle = setTimeout(() => reject(new Error('Batch timeout')), BATCH_TIMEOUT)
    })

    try {
      const batchResult = await Promise.race([
        processBatch(batchInfo, openaiApiKey),
        timeoutPromise
      ])

      if (timeoutHandle) {
        clearTimeout(timeoutHandle)
        timeoutHandle = null
      }

      results[currentIndex] = batchResult
      console.log(`[BATCH_MANAGER] Batch ${currentIndex} completed: ${batchResult.status}`)
      if (onBatchCompleted) {
        await onBatchCompleted(batchResult)
      }
    } catch (error: any) {
      const failedResult: BatchResult = {
        batchIndex: batchInfo.batchIndex,
        startRow: batchInfo.startRow,
        endRow: batchInfo.endRow,
        status: 'failed',
        error: error?.message || 'Batch timeout',
        processingTime: BATCH_TIMEOUT
      }
      if (timeoutHandle) {
        clearTimeout(timeoutHandle)
        timeoutHandle = null
      }
      results[currentIndex] = failedResult
      console.error(`[BATCH_MANAGER] Batch ${currentIndex} failed:`, error)
      if (onBatchCompleted) {
        await onBatchCompleted(failedResult)
      }
    }

    await runNext()
  }

  const workers = Array.from(
    { length: Math.min(MAX_CONCURRENT_BATCHES, batches.length) },
    () => runNext()
  )

  await Promise.all(workers)

  return results.filter(Boolean).sort((a, b) => a.batchIndex - b.batchIndex)
}

// Parser that strips surrounding quotes when pushing
function parseCleanCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim().replace(/^"|"$/g, ''))
      current = ''
    } else {
      current += char
    }
  }
  result.push(current.trim().replace(/^"|"$/g, ''))
  return result
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Debug logging
    const contentType = req.headers['content-type'] || ''
    console.log('[DEBUG] Request method:', req.method)
    console.log('[DEBUG] Content-Type:', contentType)
    // Batch metadata (optional headers from client)
    const batchIndex = req.headers['x-geonorm-batch-index']
    const batchStart = req.headers['x-geonorm-batch-start']
    const batchEnd = req.headers['x-geonorm-batch-end']
    const batchTotal = req.headers['x-geonorm-batch-totalrows']
    if (batchIndex !== undefined) {
      console.log(`[BATCH][META] index=${batchIndex} start=${batchStart} end=${batchEnd} totalRows=${batchTotal}`)
    }
    console.log('[DEBUG] Body type:', typeof req.body)
    console.log('[DEBUG] Body has length:', req.body && typeof (req.body as any).length === 'number')

    const resolveHeaderValue = (value: string | string[] | undefined): string | undefined => {
      if (!value) return undefined
      return Array.isArray(value) ? value[0] : value
    }

    const requestUrl = req.url ? new URL(req.url, 'http://localhost') : null
    const skipCleaningHeader = resolveHeaderValue(req.headers['x-geonorm-skip-cleaning'])
    const skipCleaningParam = requestUrl?.searchParams.get('skipCleaning') ?? requestUrl?.searchParams.get('skip_cleaning')
    const isTruthy = (value: string | null | undefined) => {
      if (!value) return false
      const normalized = value.trim().toLowerCase()
      return ['1', 'true', 'yes', 'on', 'skip'].includes(normalized)
    }
    const skipCleaning = isTruthy(skipCleaningHeader) || isTruthy(skipCleaningParam)
    console.log('[PIPELINE] Skip cleaning flag:', skipCleaning)

    // Helper to read raw body when body parser didn't populate req.body
    const readRawBody = async (request: any): Promise<string> => {
      return await new Promise((resolve, reject) => {
        try {
          let data = ''
          request.setEncoding && request.setEncoding('utf8')
          request.on('data', (chunk: any) => {
            data += typeof chunk === 'string' ? chunk : chunk.toString('utf8')
          })
          request.on('end', () => resolve(data))
          request.on('error', (err: any) => reject(err))
        } catch (err) {
          reject(err)
        }
      })
    }

    let csvData: string | undefined
    if (typeof req.body === 'string') {
      csvData = req.body
    } else if ((req as any).body && Buffer.isBuffer((req as any).body)) {
      csvData = (req as any).body.toString('utf8')
    } else {
      // Fallback: read the raw request stream
      csvData = await readRawBody(req)
    }

    console.log('[DEBUG] Processed csvData type:', typeof csvData)
    console.log('[DEBUG] Processed csvData length:', csvData ? csvData.length : 'undefined')
    if (csvData) {
      const preview = csvData.substring(0, 200)
      const lineCount = csvData.split('\n').length
      console.log(`[DEBUG] csvData preview (first 200 chars): ${preview}`)
      console.log(`[DEBUG] csvData line count: ${lineCount}`)
    }

    if (!csvData) {
      console.log('[DEBUG] ERROR: CSV data is empty or undefined')
      return res.status(400).json({ error: 'CSV data is required' })
    }

    if (csvData.length < 10) {
      console.log('[DEBUG] ERROR: CSV data too short:', csvData)
      return res.status(400).json({ error: 'CSV data appears to be too short or invalid' })
    }

    console.log('[UNIFIED_PROCESS] Starting complete processing pipeline...')

    // Step 1: Delegate all extraction (including originals) to LLM
    console.log('[UNIFIED_PROCESS] Step 1/3: Delegating all field extraction to LLM (originals + cleaned)')

    // Step 2: Clean with OpenAI using parallel batch processing
    console.log('[UNIFIED_PROCESS] Step 2/3: Cleaning with OpenAI using parallel batches...')
    const openaiApiKey = process.env.OPENAI_API_KEY
    if (!skipCleaning && !openaiApiKey) {
      return res.status(500).json({ error: 'OpenAI API key not configured' })
    }

    // Prepare CSV for batch processing
    const csvForCleaning = csvData
    const csvLines = csvForCleaning.trim().split('\n')
    const headerLine = csvLines[0]
    const totalDataRows = csvLines.length - 1

    console.log('\n=== PARALLEL BATCH PROCESSING: Setup ===')
    console.log('[BATCH][SETUP] Total CSV length:', csvForCleaning.length)
    console.log('[BATCH][SETUP] Total data rows:', totalDataRows)
    console.log('[BATCH][SETUP] Header line:', headerLine)
    console.log('[BATCH][SETUP] Batch size:', BATCH_SIZE)
    console.log('[BATCH][SETUP] Max concurrent batches:', MAX_CONCURRENT_BATCHES)

    // Create batches
    const batches = createBatches(csvLines, headerLine)
    console.log(`[BATCH][SETUP] Created ${batches.length} batches`)

    let streamingStarted = false
    const startStreaming = () => {
      if (!streamingStarted) {
        res.writeHead(200, {
          'Content-Type': 'application/x-ndjson',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
          'Transfer-Encoding': 'chunked'
        })
        streamingStarted = true
      }
    }

    const sendEvent = (event: unknown) => {
      if (res.writableEnded) {
        return
      }
      startStreaming()
      res.write(`${JSON.stringify(event)}\n`)
    }

    const totalRows = totalDataRows
    const progressMeta = {
      progress: 0,
      currentStep: 'geocoding',
      detail: 'Inicializando procesamiento...',
      totalRows,
      processedRows: 0,
      processedBatches: 0,
      totalBatches: batches.length,
      isComplete: false
    }

    sendEvent({ type: 'meta', meta: progressMeta })

    const emitMeta = (detail?: string) => {
      if (detail) {
        progressMeta.detail = detail
      }
      progressMeta.progress = totalRows ? Math.min(100, Math.round((progressMeta.processedRows / totalRows) * 100)) : 0
      sendEvent({ type: 'meta', meta: { ...progressMeta } })
    }

    // Prepare original CSV rows for per-row fallback when LLM skipped rows
    const rawHeader = parseCleanCSVLine(headerLine || '')
    const rawLower = rawHeader.map(h => (h || '').toLowerCase())
    const idxOf = (keys: string[]) => rawLower.findIndex(h => keys.some(k => h.includes(k)))
    const idxAddress = idxOf(['address', 'direc', 'buyer address1', 'direccion'])
    const idxCity = idxOf(['city', 'ciudad', 'localidad'])
    const idxState = idxOf(['state', 'estado', 'provincia', 'department'])
    const idxPhone = idxOf(['phone', 'tel'])
    const idxEmail = idxOf(['email', 'correo'])
    const rawDataRows = csvLines.slice(1)
      .filter(line => line && line.trim().length > 0)
      .map(parseCleanCSVLine)

    const cleanedData: any[] = []

    const pickRawValue = (row: string[], index: number): string => {
      if (!row || index < 0 || index >= row.length) return ''
      return row[index] || ''
    }

    const buildFallbackCleanedRow = (rowIndex: number) => {
      const rawRow = rawDataRows[rowIndex] || []
      return {
        originalAddress: pickRawValue(rawRow, idxAddress),
        originalCity: pickRawValue(rawRow, idxCity),
        originalState: pickRawValue(rawRow, idxState),
        originalPhone: pickRawValue(rawRow, idxPhone),
        address: pickRawValue(rawRow, idxAddress),
        city: pickRawValue(rawRow, idxCity),
        state: pickRawValue(rawRow, idxState),
        phone: pickRawValue(rawRow, idxPhone),
        email: pickRawValue(rawRow, idxEmail)
      }
    }

    const rowTimelines = new Map<number, RowTimeline>()
    const ensureRowTimeline = (rowIndex: number): RowTimeline => {
      const existing = rowTimelines.get(rowIndex)
      if (existing) return existing
      const timeline: RowTimeline = { rowIndex, events: [] }
      rowTimelines.set(rowIndex, timeline)
      return timeline
    }
    const recordRowEvent = (rowIndex: number, event: RowTimelineEvent) => {
      const timeline = ensureRowTimeline(rowIndex)
      timeline.events.push(event)
    }
    const mapsApiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY
    if (!mapsApiKey) {
      return res.status(500).json({ error: 'Google Maps API key not configured' })
    }

    // Track OpenAI interactions for all batches
    const openaiStartTime = Date.now()
    const batchInteractions: any[] = []

    const confidenceFor = (locationType: string | undefined) => {
      const map: Record<string, number> = {
        ROOFTOP: 1.0,
        RANGE_INTERPOLATED: 0.8,
        GEOMETRIC_CENTER: 0.6,
        APPROXIMATE: 0.4
      }
      return locationType ? (map[locationType] ?? 0.5) : 0
    }

    const getConfidenceDescription = (locationType: string | undefined) => {
      const descriptions: Record<string, string> = {
        ROOFTOP: 'Most precise - exact address match',
        RANGE_INTERPOLATED: 'High precision - interpolated within address range',
        GEOMETRIC_CENTER: 'Medium precision - center of building/area',
        APPROXIMATE: 'Low precision - approximate location'
      }
      return locationType ? descriptions[locationType] || 'Unknown precision' : 'No location type'
    }

    const geocode = async (address: string, city?: string, state?: string) => {
      if (!address || address.trim().length < 3) return null

      const startTime = Date.now()
      console.log(`\n[GEOCODE] 🚀 STARTING GEOCODING REQUEST`)
      console.log(`[GEOCODE] 📍 INPUT DATA:`, {
        address: `"${address}"`,
        city: `"${city || 'N/A'}"`,
        state: `"${state || 'N/A'}"`,
        timestamp: new Date().toISOString()
      })

      let url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${mapsApiKey}`
      const componentsUsed: string[] = ['country:PY']
      if (state && state.trim()) componentsUsed.push(`administrative_area:${state}`)
      if (city && city.trim()) componentsUsed.push(`locality:${city}`)
      if (componentsUsed.length) {
        url += `&components=${encodeURIComponent(componentsUsed.join('|'))}`
      }

      console.log(`[GEOCODE] 🌐 API REQUEST DETAILS:`, {
        url: url.replace(mapsApiKey, '[API_KEY]'),
        components: componentsUsed.join(' | '),
        encodedAddress: encodeURIComponent(address)
      })

      const requestUrl = url
      const response = await fetch(requestUrl)
      const responseTime = Date.now() - startTime
      
      console.log(`[GEOCODE] 📥 RECEIVED RESPONSE:`, {
        status: response.status,
        statusText: response.statusText,
        responseTime: `${responseTime}ms`,
        headers: Object.fromEntries(response.headers.entries())
      })
      
      let data: any = null
      try {
        data = await response.json()
        console.log(`[GEOCODE] 📊 RESPONSE DATA:`, {
          status: data?.status,
          resultsCount: data?.results?.length || 0,
          errorMessage: data?.error_message || 'None',
          httpStatus: response.status,
          rawData: data
        })
      } catch (parseError) {
        console.warn('[GEOCODE] ❌ JSON PARSE ERROR:', parseError)
        return { status: 'ERROR', error: 'Invalid JSON response' }
      }

      const rawResults = Array.isArray(data?.results) ? data.results : []
      let best: any = null

      if (Array.isArray(rawResults) && rawResults.length > 0) {
        console.log(`[GEOCODE][PROCESSING] Processing ${rawResults.length} results`)
        best = rawResults.reduce((acc: any, cur: any) => {
          const score = confidenceFor(cur?.geometry?.location_type)
          console.log(`[GEOCODE][RESULT] Location type: ${cur?.geometry?.location_type}, Score: ${score}`)
          if (!acc || score > acc.confidence_score) {
            const loc = cur.geometry?.location || {}
            const result = {
              latitude: loc.lat,
              longitude: loc.lng,
              formatted_address: cur.formatted_address,
              location_type: cur.geometry?.location_type,
              confidence_score: score,
              confidence_description: getConfidenceDescription(cur.geometry?.location_type)
            }
            console.log(`[GEOCODE][BEST] New best result: ${JSON.stringify(result, null, 2)}`)
            return result
          }
          return acc
        }, null)
      } else {
        console.log(`[GEOCODE][NO_RESULTS] No results found for address: "${address}"`)
      }

      const status = data?.status || (response.ok ? 'UNKNOWN' : `HTTP_${response.status}`)
      const errorMessage = data?.error_message || (!response.ok ? `HTTP ${response.status}` : undefined)

      console.log(`[GEOCODE][FINAL] Status: ${status}, Best result: ${best ? 'Found' : 'None'}`)

      return {
        status,
        best,
        rawCount: rawResults.length,
        rawResults,
        rawResponse: data ?? null,
        componentsUsed,
        requestUrl,
        error: errorMessage,
        httpStatus: response.status
      }
    }

    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
    const GEOCODE_BATCH_SIZE = Number(process.env.GEOCODE_BATCH_SIZE) || 50
    const MAX_GEOCODE_CALLS_PER_SECOND = Number(process.env.GEOCODE_RATE_LIMIT_PER_SEC) || GEOCODE_BATCH_SIZE
    const BATCH_DELAY_MS = 1000

    type GeocodeTask = { rowIndex: number, cleaned: any }
    type GeocodeTaskResult = {
      rowIndex: number
      result: any
      interaction: any
      confidenceLevel: 'high' | 'medium' | 'low'
    }

    const geocodeResults: any[] = []
    const geocodingInteractionsByIndex: any[] = []

    let highConfidence = 0
    let mediumConfidence = 0
    let lowConfidence = 0
    let fallbackRowCount = 0
    let processedGeocodeCount = 0
    let geocodeBatchCounter = 0
    let cleaningCompleted = false

    const geocodeQueue: GeocodeTask[] = []
    let geocodeQueueResolver: (() => void) | null = null

    const resolveQueue = () => {
      if (geocodeQueueResolver) {
        geocodeQueueResolver()
        geocodeQueueResolver = null
      }
    }

    const enqueueGeocodeTask = (task: GeocodeTask) => {
      geocodeQueue.push(task)
      resolveQueue()
    }

    const processGeocodeTask = async (task: GeocodeTask): Promise<GeocodeTaskResult> => {
      const rowIndex = task.rowIndex
      const cleaned = task.cleaned

      if ((!cleaned.address || cleaned.address.trim() === '') && rawDataRows[rowIndex]) {
        const raw = rawDataRows[rowIndex]
        cleaned.address = idxAddress >= 0 ? (raw[idxAddress] || '') : ''
        cleaned.city = idxCity >= 0 ? (raw[idxCity] || '') : ''
        cleaned.state = idxState >= 0 ? (raw[idxState] || '') : ''
        cleaned.phone = idxPhone >= 0 ? (raw[idxPhone] || '') : ''
        cleaned.email = idxEmail >= 0 ? (raw[idxEmail] || '') : ''
        console.warn(`[ROW_FALLBACK] Filled cleaned fields for row ${rowIndex} from raw CSV`)
      }

      console.log(`\n--- GEOCODING ROW ${rowIndex} ---`)
      console.log(`[GEOCODE][${rowIndex}][INPUT] Original: "${cleaned.originalAddress}"`)
      console.log(`[GEOCODE][${rowIndex}][INPUT] Cleaned: "${cleaned.address}"`)
      console.log(`[GEOCODE][${rowIndex}][INPUT] City: "${cleaned.city}"`)
      console.log(`[GEOCODE][${rowIndex}][INPUT] State: "${cleaned.state}"`)

      const original = {
        address: cleaned.originalAddress,
        city: cleaned.originalCity,
        state: cleaned.originalState,
        phone: cleaned.originalPhone
      }

      try {
        const geocodeStartTime = Date.now()
        console.log(`[GEOCODE][${rowIndex}] Starting geocode at`, new Date(geocodeStartTime).toISOString(), 'queue size:', geocodeQueue.length)
        recordRowEvent(rowIndex, { phase: 'geocode_started', timestamp: geocodeStartTime })
        const geo = await geocode(cleaned.address, cleaned.city, cleaned.state)
        console.log(`[GEOCODE][${rowIndex}] Finished geocode request in`, Date.now() - geocodeStartTime, 'ms')
        const geocodeEndTime = Date.now()
        recordRowEvent(rowIndex, {
          phase: 'geocode_completed',
          timestamp: geocodeEndTime,
          duration: geocodeEndTime - geocodeStartTime,
          details: { status: geo?.status ?? 'UNKNOWN' }
        })

        const geocodingInteraction = {
          timestamp: new Date().toISOString(),
          rowIndex,
          request: {
            address: cleaned.address,
            city: cleaned.city,
            state: cleaned.state,
            components: geo?.componentsUsed || ['country:PY'],
            url: geo?.requestUrl || `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(cleaned.address)}&key=${mapsApiKey}&components=country:PY`
          },
          response: {
            status: geo?.status || 'ERROR',
            results: geo?.rawResults || [],
            bestResult: geo?.best ? {
              formatted_address: geo.best.formatted_address,
              geometry: {
                location: {
                  lat: geo.best.latitude,
                  lng: geo.best.longitude
                },
                location_type: geo.best.location_type
              },
              confidence: geo.best.confidence_score
            } : null,
            rawResponse: geo?.rawResponse || null,
            responseTime: geocodeEndTime - geocodeStartTime,
            httpStatus: geo?.httpStatus || null,
            error: geo?.error || null
          }
        }

        console.log(`[GEOCODE][${rowIndex}][OUTPUT] Status: ${geo?.status}`)
        console.log(`[GEOCODE][${rowIndex}][OUTPUT] Raw results count: ${geo?.rawCount}`)
        if (geo?.best) {
          console.log(`[GEOCODE][${rowIndex}][OUTPUT] Best result:`)
          console.log(`  - Latitude: ${geo.best.latitude}`)
          console.log(`  - Longitude: ${geo.best.longitude}`)
          console.log(`  - Formatted: "${geo.best.formatted_address}"`)
          console.log(`  - Location Type: ${geo.best.location_type}`)
          console.log(`  - Confidence Score: ${geo.best.confidence_score}`)
          console.log(`  - Description: ${geo.best.confidence_description}`)
        } else {
          console.log(`[GEOCODE][${rowIndex}][OUTPUT] No best result found`)
        }

        const geoConfidence = geo?.best?.confidence_score || 0
        console.log(`[GEOCODE][${rowIndex}][CALCULATION] Geo Confidence: ${geoConfidence}`)

        let confidenceLevel: 'high' | 'medium' | 'low' = 'low'
        if (geoConfidence >= 0.8) {
          confidenceLevel = 'high'
          console.log(`[GEOCODE][${rowIndex}][RESULT] HIGH CONFIDENCE`)
        } else if (geoConfidence >= 0.6) {
          confidenceLevel = 'medium'
          console.log(`[GEOCODE][${rowIndex}][RESULT] MEDIUM CONFIDENCE`)
        } else {
          console.log(`[GEOCODE][${rowIndex}][RESULT] LOW CONFIDENCE`)
        }

        let zipCodeResult: any = null
        if (geo?.best?.latitude && geo?.best?.longitude) {
          try {
            console.log(`[ZIPCODE][${rowIndex}][INPUT] Coordinates: ${geo.best.latitude}, ${geo.best.longitude}`)
            const zipLookupStart = Date.now()
            recordRowEvent(rowIndex, { phase: 'zip_lookup_started', timestamp: zipLookupStart })
            console.log(`[ZIPCODE] 🔍 STARTING ZIP CODE LOOKUP`, {
              rowIndex,
              latitude: geo.best.latitude,
              longitude: geo.best.longitude,
              timestamp: new Date().toISOString()
            })
            
            zipCodeResult = await zipCodeService.getZipCode(geo.best.latitude, geo.best.longitude)
            const zipLookupEnd = Date.now()
            const zipLookupDuration = zipLookupEnd - zipLookupStart
            
            console.log(`[ZIPCODE] ✅ ZIP CODE LOOKUP COMPLETED`, {
              rowIndex,
              result: zipCodeResult,
              duration: `${zipLookupDuration}ms`
            })
            
            recordRowEvent(rowIndex, {
              phase: 'zip_lookup_completed',
              timestamp: zipLookupEnd,
              duration: zipLookupDuration
            })
          } catch (zipError) {
            console.warn(`[ZIPCODE][${rowIndex}][ERROR] Failed to get zip code:`, zipError)
            recordRowEvent(rowIndex, {
              phase: 'zip_lookup_failed',
              timestamp: Date.now(),
              details: { message: (zipError as Error)?.message ?? 'Unknown error' }
            })
          }
        } else {
          console.log(`[ZIPCODE][${rowIndex}][SKIP] No coordinates available`)
        }

        const result = {
          rowIndex,
          original: {
            address: original?.address || '',
            city: original?.city || '',
            state: original?.state || '',
            phone: original?.phone || ''
          },
          cleaned: {
            address: cleaned.address,
            city: cleaned.city,
            state: cleaned.state,
            phone: cleaned.phone,
            email: cleaned.email
          },
          geocoding: {
            latitude: geo?.best?.latitude || null,
            longitude: geo?.best?.longitude || null,
            formattedAddress: geo?.best?.formatted_address || '',
            confidence: geoConfidence,
            confidenceDescription: geo?.best?.confidence_description || 'No geocoding result',
            locationType: geo?.best?.location_type || 'N/A',
            staticMapUrl: null
          },
          zipCode: zipCodeResult ? {
            zipCode: zipCodeResult.zipCode,
            department: zipCodeResult.department,
            district: zipCodeResult.district,
            neighborhood: zipCodeResult.neighborhood,
            confidence: zipCodeResult.confidence
          } : null,
          status: geoConfidence >= 0.8 ? 'high_confidence' : geoConfidence >= 0.6 ? 'medium_confidence' : 'low_confidence',
          googleMapsLink: geo?.best?.latitude && geo?.best?.longitude
            ? `https://www.google.com/maps?q=${geo.best.latitude},${geo.best.longitude}`
            : null
        }

        recordRowEvent(rowIndex, {
          phase: 'row_completed',
          timestamp: Date.now(),
          details: {
            status: result.status,
            confidence: geoConfidence
          }
        })

        return { rowIndex, result, interaction: geocodingInteraction, confidenceLevel }
      } catch (error: any) {
        console.error(`[GEOCODE][${rowIndex}][ERROR] Processing failed:`, error)
        recordRowEvent(rowIndex, {
          phase: 'geocode_failed',
          timestamp: Date.now(),
          details: {
            message: error?.message || 'Unknown geocode error'
          }
        })

        const failedGeocodingInteraction = {
          timestamp: new Date().toISOString(),
          rowIndex,
          request: {
            address: cleaned.address,
            city: cleaned.city,
            state: cleaned.state,
            components: ['country:PY'],
            url: `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(cleaned.address)}&key=${mapsApiKey}&components=country:PY`
          },
          response: {
            status: 'ERROR',
            results: [],
            bestResult: null,
            rawResponse: null,
            responseTime: 0,
            httpStatus: null,
            error: error.message
          },
          error: error.message
        }

        const failedResult = {
          rowIndex,
          original: {
            address: original?.address || '',
            city: original?.city || '',
            state: original?.state || '',
            phone: original?.phone || ''
          },
          cleaned: {
            address: cleaned.address,
            city: cleaned.city,
            state: cleaned.state,
            phone: cleaned.phone,
            email: cleaned.email
          },
          geocoding: {
            latitude: null,
            longitude: null,
            formattedAddress: '',
            confidence: 0,
            confidenceDescription: 'Geocoding failed',
            locationType: 'FAILED',
            staticMapUrl: null
          },
          zipCode: null,
          status: 'failed',
          error: error.message,
          googleMapsLink: null
        }
        recordRowEvent(rowIndex, {
          phase: 'row_failed',
          timestamp: Date.now(),
          details: {
            error: error?.message || 'Unknown geocode failure'
          }
        })

        return { rowIndex, result: failedResult, interaction: failedGeocodingInteraction, confidenceLevel: 'low' }
      } finally {
        console.log(`--- END ROW ${rowIndex} ---\n`)
      }
    }

    const geocodeScheduler = async () => {
      console.log('\n=== BATCH PROCESSING: Starting Geocoding ===')
    console.log('[DEBUG] Current geocode queue length before loop:', geocodeQueue.length)
      console.log(`[GEOCODING][BATCH] Rate limit: ${MAX_GEOCODE_CALLS_PER_SECOND} req/sec`)
      console.log(`[GEOCODING][BATCH] Initial rows discovered: ${rawDataRows.length}`)

      while (!cleaningCompleted || geocodeQueue.length > 0) {
        if (geocodeQueue.length === 0) {
          await new Promise<void>(resolve => {
            geocodeQueueResolver = resolve
          })
          continue
        }

        geocodeBatchCounter++
        const desiredBatchSize = Math.max(1, Math.min(GEOCODE_BATCH_SIZE, MAX_GEOCODE_CALLS_PER_SECOND))
        const batchSize = Math.min(desiredBatchSize, geocodeQueue.length)
        const batch = geocodeQueue.splice(0, batchSize)
        const batchStartTime = Date.now()
        console.log(`[GEOCODING] 🚀 STARTING BATCH ${geocodeBatchCounter}`, {
          batchSize: batch.length,
          desiredBatchSize,
          addresses: batch.map(({ rowIndex, cleaned }) => ({
            rowIndex,
            address: cleaned.address,
            city: cleaned.city,
            state: cleaned.state
          })),
          timestamp: new Date().toISOString()
        })

        const batchResults = await Promise.all(batch.map(processGeocodeTask))
        const batchDuration = Date.now() - batchStartTime
        
        console.log(`[GEOCODING] ✅ BATCH ${geocodeBatchCounter} COMPLETED`, {
          duration: `${batchDuration}ms`,
          resultsCount: batchResults.length,
          successfulResults: batchResults.filter(r => r.result?.status === 'OK').length
        })

        batchResults.forEach(({ rowIndex, result, interaction, confidenceLevel }) => {
          geocodeResults[rowIndex] = result
          if (interaction) {
            geocodingInteractionsByIndex[rowIndex] = interaction
          }
          processedGeocodeCount++

          if (confidenceLevel === 'high') {
            highConfidence++
          } else if (confidenceLevel === 'medium') {
            mediumConfidence++
          } else {
            lowConfidence++
          }

          const timeline = rowTimelines.get(rowIndex)
          sendEvent({
            type: 'row',
            rowIndex,
            row: result,
            timeline: timeline ? { rowIndex, events: timeline.events } : undefined
          })

          progressMeta.processedRows = processedGeocodeCount
          emitMeta(`Geocodificada fila ${rowIndex + 1}`)
        })

        if (!cleaningCompleted || geocodeQueue.length > 0) {
          const waitMs = Math.max(0, BATCH_DELAY_MS - batchDuration)
          console.log(`[GEOCODING][BATCH] Waiting ${waitMs}ms before next batch (rate pacing)`) 
          await sleep(waitMs)
        }
      }

      console.log(`[GEOCODING][BATCH] Parallel processing completed for ${processedGeocodeCount} addresses`)
    }

    console.log('\n=== PARALLEL BATCH PROCESSING: Execution ===')
    console.log('[UNIFIED_PROCESS] Step 3/3: Geocoding addresses...')

    let completedCleaningBatches = 0

    const geocodePipelinePromise = geocodeScheduler()

    let batchResults: BatchResult[] = []

    if (skipCleaning) {
      console.log('[PIPELINE] Skip cleaning mode enabled. Bypassing LLM cleaning and using raw rows for geocoding input.')
      emitMeta('Modo sin limpieza: preparando lotes para geocodificación...')
      const skipPrepStart = Date.now()

      batches.forEach(batchInfo => {
        const batchPrepStart = Date.now()
        const startRow = batchInfo.startRow ?? (batchInfo.batchIndex * BATCH_SIZE + 1)
        const endRow = batchInfo.endRow ?? Math.min(startRow + BATCH_SIZE - 1, rawDataRows.length)
        const batchStartIndex = Math.max(0, startRow - 1)
        const batchEndIndex = Math.min(rawDataRows.length - 1, Math.max(batchStartIndex, endRow - 1))
        const rowTimelinesForBatch: RowTimeline[] = []
        const batchData: any[] = []

        if (batchEndIndex < batchStartIndex) {
          console.warn(`[PIPELINE] Batch ${batchInfo.batchIndex} has no rows in skip-cleaning mode.`)
        }

        for (let globalIndex = batchStartIndex; globalIndex <= batchEndIndex; globalIndex++) {
          if (globalIndex < 0 || globalIndex >= rawDataRows.length) continue

          const fallbackRow = buildFallbackCleanedRow(globalIndex)
          cleanedData[globalIndex] = fallbackRow
          batchData.push(fallbackRow)

          const timelineEvents: RowTimelineEvent[] = []
          const timestamp = Date.now()
          timelineEvents.push({ phase: 'cleaning_started', timestamp, details: { skipped: true } })
          timelineEvents.push({ phase: 'cleaning_completed', timestamp, duration: 0, details: { skipped: true } })
          timelineEvents.push({ phase: 'cleaning_skipped', timestamp, details: { reason: 'skip_cleaning_mode' } })

          timelineEvents.forEach(event => recordRowEvent(globalIndex, event))

          const enqueueTimestamp = Date.now()
          const enqueueEvent: RowTimelineEvent = {
            phase: 'geocode_enqueued',
            timestamp: enqueueTimestamp,
            details: { reason: 'skip_cleaning_mode' }
          }
          recordRowEvent(globalIndex, enqueueEvent)

          rowTimelinesForBatch.push({
            rowIndex: globalIndex,
            events: [...ensureRowTimeline(globalIndex).events]
          })

          enqueueGeocodeTask({ rowIndex: globalIndex, cleaned: fallbackRow })
        }

        const processingTime = Date.now() - batchPrepStart
        batchResults.push({
          batchIndex: batchInfo.batchIndex,
          startRow,
          endRow,
          status: 'completed',
          data: batchData,
          processingTime,
          retryCount: 0,
          rowTimelines: rowTimelinesForBatch
        })

        completedCleaningBatches++
        progressMeta.processedBatches = completedCleaningBatches
        emitMeta(`Lote ${completedCleaningBatches}/${batches.length} enviado directo a geocodificación`)
      })

      console.log(`[PIPELINE] Skip cleaning mode prepared ${rawDataRows.length} filas en ${Date.now() - skipPrepStart}ms`)
      emitMeta('Geocodificación en curso (modo sin limpieza)...')
    } else {
      batchResults = await processBatchesConcurrently(
        batches,
        openaiApiKey!,
        async (batchResult) => {
          if (batchResult.rowTimelines) {
            batchResult.rowTimelines.forEach(timeline => {
              const target = ensureRowTimeline(timeline.rowIndex)
              target.events.push(...timeline.events)
            })
          }

          const startRow = batchResult.startRow ?? (batchResult.batchIndex * BATCH_SIZE + 1)
          const endRow = batchResult.endRow ?? (startRow + Math.max(0, (batchResult.data?.length ?? 0) - 1))
          const batchStartIndex = Math.max(0, startRow - 1)
          const batchEndIndex = Math.min(rawDataRows.length - 1, Math.max(batchStartIndex, endRow - 1))
          const expectedRowCount = batchEndIndex >= batchStartIndex ? (batchEndIndex - batchStartIndex + 1) : 0
          const enqueuedIndexes = new Set<number>()

          if (batchResult.status === 'completed' && Array.isArray(batchResult.data) && batchResult.data.length > 0) {
            batchResult.data.forEach((row: any, localIdx: number) => {
              const globalIndex = batchStartIndex + localIdx
              if (expectedRowCount > 0 && globalIndex > batchEndIndex) {
                console.warn(`[PIPELINE] Ignoring extraneous cleaned row at global index ${globalIndex} from batch ${batchResult.batchIndex}`)
                return
              }
              cleanedData[globalIndex] = row
              enqueuedIndexes.add(globalIndex)
              recordRowEvent(globalIndex, { phase: 'geocode_enqueued', timestamp: Date.now() })
              enqueueGeocodeTask({ rowIndex: globalIndex, cleaned: row })
            })

            const missingCount = Math.max(0, expectedRowCount - enqueuedIndexes.size)
            if (missingCount > 0) {
              console.warn(`[PIPELINE] Batch ${batchResult.batchIndex} returned ${enqueuedIndexes.size}/${expectedRowCount} rows. Filling ${missingCount} with raw-data fallback.`)
            } else {
              console.log(`[PIPELINE] Dispatched batch ${batchResult.batchIndex} (${enqueuedIndexes.size} rows) directly to geocoding queue`)
            }
          } else {
            console.error(`[PIPELINE] Batch ${batchResult.batchIndex} failed or returned no data (${batchResult.status}). Using fallback rows.`)
          }

          if (expectedRowCount > enqueuedIndexes.size) {
            const fallbackStart = batchStartIndex
            const fallbackEnd = Math.min(batchStartIndex + expectedRowCount - 1, rawDataRows.length - 1)
            let fallbackCounter = 0
            for (let globalIndex = fallbackStart; globalIndex <= fallbackEnd; globalIndex++) {
              if (enqueuedIndexes.has(globalIndex)) continue
              const fallbackRow = buildFallbackCleanedRow(globalIndex)
              cleanedData[globalIndex] = fallbackRow
              recordRowEvent(globalIndex, {
                phase: 'cleaning_fallback',
                timestamp: Date.now(),
                details: {
                  batchIndex: batchResult.batchIndex,
                  reason: batchResult.status === 'completed' ? 'missing_cleaned_row' : batchResult.error || 'cleaning_failed'
                }
              })
              enqueueGeocodeTask({ rowIndex: globalIndex, cleaned: fallbackRow })
              enqueuedIndexes.add(globalIndex)
              fallbackCounter++
            }
            fallbackRowCount += fallbackCounter
            console.log(`[PIPELINE] Fallback enqueued ${fallbackCounter} raw rows for batch ${batchResult.batchIndex}`)
          }

          completedCleaningBatches++
          progressMeta.processedBatches = completedCleaningBatches
          emitMeta(`Lote ${completedCleaningBatches}/${batches.length} listo para geocodificación`)
        }
      )
    }

    cleaningCompleted = true
    resolveQueue()
    await geocodePipelinePromise

    const totalProcessingTime = Date.now() - openaiStartTime
    let successfulBatches = 0
    let failedBatches = 0

    console.log('\n=== PARALLEL BATCH PROCESSING: Results ===')
    batchResults.sort((a, b) => a.batchIndex - b.batchIndex).forEach((result) => {
      console.log(`[BATCH][RESULT] Batch ${result.batchIndex}: ${result.status} (rows ${result.startRow}-${result.endRow}, ${result.processingTime}ms)`)

      if (result.status === 'completed' && result.data) {
        successfulBatches++
      } else {
        failedBatches++
        console.error(`[BATCH][RESULT] Batch ${result.batchIndex} failed: ${result.error}`)
      }

      batchInteractions.push({
        batchIndex: result.batchIndex,
        startRow: result.startRow,
        endRow: result.endRow,
        status: result.status,
        processingTime: result.processingTime,
        error: result.error,
        retryCount: result.retryCount
      })
    })

    console.log(`[BATCH][SUMMARY] Successful batches: ${successfulBatches}/${batches.length}`)
    console.log(`[BATCH][SUMMARY] Failed batches: ${failedBatches}/${batches.length}`)
    console.log(`[BATCH][SUMMARY] Total processing time: ${totalProcessingTime}ms`)
    console.log(`[BATCH][SUMMARY] Average time per batch: ${Math.round(totalProcessingTime / batches.length)}ms`)
    console.log(`[BATCH][SUMMARY] Success rate: ${Math.round((successfulBatches / batches.length) * 100)}%`)
    console.log('=== End Parallel Batch Processing ===\n')

    console.log('[DEBUG] Cleaned rows:', cleanedData.length, 'Raw rows:', rawDataRows.length)

    const finalResults = geocodeResults.filter(Boolean)
    const geocodingInteractions = geocodingInteractionsByIndex.filter(Boolean)
    const finalRowTimelines = Array.from(rowTimelines.values())
      .map(timeline => ({
        rowIndex: timeline.rowIndex,
        events: [...timeline.events].sort((a, b) => a.timestamp - b.timestamp)
      }))
      .sort((a, b) => a.rowIndex - b.rowIndex)

    console.log('\n=== BATCH PROCESSING: Final Summary ===')
    console.log(`[SUMMARY] Total addresses processed: ${finalResults.length}`)
    console.log(`[SUMMARY] High confidence: ${highConfidence}`)
    console.log(`[SUMMARY] Medium confidence: ${mediumConfidence}`)
    console.log(`[SUMMARY] Low confidence: ${lowConfidence}`)
    console.log(`[SUMMARY] Fallback rows used: ${fallbackRowCount}`)
    const successRate = finalResults.length ? ((highConfidence + mediumConfidence) / finalResults.length * 100).toFixed(1) : '0.0'
    console.log(`[SUMMARY] Success rate: ${successRate}%`)
    console.log('=== End Batch Processing ===\n')

    console.log(`[UNIFIED_PROCESS] Processed ${finalResults.length} addresses`)
    progressMeta.isComplete = true
    progressMeta.processedRows = processedGeocodeCount
    const completionDetail = skipCleaning ? '¡Procesamiento completado (modo sin limpieza)!' : '¡Procesamiento completado con éxito!'
    progressMeta.detail = completionDetail
    progressMeta.progress = totalRows ? Math.min(100, Math.round((processedGeocodeCount / totalRows) * 100)) : 100
    const jobCompleted = processedGeocodeCount >= totalRows
    if (!jobCompleted) {
      console.warn(`[SUMMARY] Incomplete processing detected: ${processedGeocodeCount}/${totalRows} rows geocoded`)
    }
    sendEvent({ type: 'meta', meta: { ...progressMeta } })

    const finalPayload = {
      success: jobCompleted,
      totalProcessed: finalResults.length,
      statistics: {
        highConfidence,
        mediumConfidence,
        lowConfidence,
        totalRows,
        processedRows: processedGeocodeCount,
        fallbackRows: fallbackRowCount
      },
      results: finalResults,
      debug: {
        batchProcessing: {
          totalBatches: batches.length,
          successfulBatches,
          failedBatches,
          batchSize: BATCH_SIZE,
          maxConcurrentBatches: MAX_CONCURRENT_BATCHES,
          totalProcessingTime,
          averageTimePerBatch: Math.round(totalProcessingTime / Math.max(batches.length, 1)),
          successRate: Math.round((successfulBatches / Math.max(batches.length, 1)) * 100),
          batchDetails: batchInteractions,
          fallbackRows: fallbackRowCount
        },
        geocodingInteractions,
        rowTimelines: finalRowTimelines,
        skipCleaningMode: skipCleaning
      },
      meta: { ...progressMeta }
    }

    sendEvent({ type: 'complete', result: finalPayload })
    res.end()

  } catch (error: any) {
    console.error('[UNIFIED_PROCESS] Error:', error)
    if (streamingStarted && !res.writableEnded) {
      sendEvent({
        type: 'error',
        message: error?.message || 'Failed to process CSV data'
      })
      res.end()
      return
    }
    return res.status(500).json({ error: 'Failed to process CSV data', details: error.message })
  }
}
