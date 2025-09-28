import { VercelRequest, VercelResponse } from '@vercel/node'
import dotenv from 'dotenv'
import zipCodeService from '../lib/services/zipCodeService.js'

// Load environment variables
dotenv.config()

// Batch processing configuration
const BATCH_SIZE = 50 // rows per batch
const MAX_CONCURRENT_BATCHES = 8 // simultaneous OpenAI requests
const BATCH_TIMEOUT = 60000 // 60 seconds per batch

interface BatchResult {
  batchIndex: number
  startRow: number
  endRow: number
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'retrying'
  data?: any[]
  error?: string
  processingTime?: number
  retryCount?: number
}

export interface UnifiedProcessingRow {
  rowIndex: number
  original: {
    address: string
    city: string
    state: string
    phone: string
  }
  cleaned: {
    address: string
    city: string
    state: string
    phone: string
    email: string
  }
  geocoding: {
    latitude: number | null
    longitude: number | null
    formattedAddress: string
    confidence: number
    confidenceDescription: string
    locationType: string
    staticMapUrl: string | null
  }
  zipCode: {
    zipCode: string | null
    department: string | null
    district: string | null
    neighborhood: string | null
    confidence: 'high' | 'medium' | 'low' | 'none'
  } | null
  status: 'high_confidence' | 'medium_confidence' | 'low_confidence' | 'failed'
  error?: string
  googleMapsLink?: string | null
}

interface BatchProcessingDebug {
  totalBatches: number
  successfulBatches: number
  failedBatches: number
  batchSize: number
  maxConcurrentBatches: number
  totalProcessingTime: number
  averageTimePerBatch: number
  successRate: number
  batchDetails: Array<{
    batchIndex: number
    startRow: number
    endRow: number
    status: string
    processingTime?: number
    error?: string
    retryCount?: number
  }>
}

interface GeocodingInteractionDebug {
  timestamp: string
  rowIndex: number
  request: Record<string, unknown>
  response: Record<string, unknown>
  error?: string
}

export interface UnifiedProcessingDebug {
  batchProcessing: BatchProcessingDebug
  geocodingInteractions: GeocodingInteractionDebug[]
  meta?: {
    pipelineId: string
    includeZipCodes: boolean
    startedAt: string
    totalBatches: number
  }
}

export interface UnifiedProcessingOptions {
  includeZipCodes?: boolean
  metadata?: Record<string, unknown>
}

export interface UnifiedProcessingResult {
  success: boolean
  totalProcessed: number
  statistics: {
    highConfidence: number
    mediumConfidence: number
    lowConfidence: number
    totalRows: number
  }
  results: UnifiedProcessingRow[]
  debug: UnifiedProcessingDebug
}

export class PipelineError extends Error {
  status: number
  details?: string

  constructor(status: number, message: string, details?: string) {
    super(message)
    this.status = status
    this.details = details
  }
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
async function processBatch(batchInfo: any, openaiApiKey: string, maxRetries = 3, pipelineId?: string): Promise<BatchResult> {
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

      // Dynamically import the cleaning module
      console.log(`[BATCH][${pipelineId ?? 'unknown'}][${result.batchIndex}] Starting cleaning attempt ${attempt + 1}`)
      // @ts-expect-error dynamic import targeting compiled JS module in backend
      const cleanerModule: any = await import('../backend/cleanParaguayAddresses.js')
      const cleanedCsv: string = await cleanerModule.cleanParaguayAddresses(openaiApiKey, batchInfo.csvData)
      console.log(`[BATCH][${pipelineId ?? 'unknown'}][${result.batchIndex}] Cleaning attempt ${attempt + 1} completed, output size=${cleanedCsv.length}`)

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

      console.log(`[BATCH][${pipelineId ?? 'unknown'}][${result.batchIndex}] Successfully processed ${batchData.length} rows in ${result.processingTime}ms`)
      return result

    } catch (error: any) {
      console.error(`[BATCH][${pipelineId ?? 'unknown'}][${result.batchIndex}] Attempt ${attempt + 1} failed:`, error.message)

      if (attempt === maxRetries) {
        result.status = 'failed'
        result.error = error.message
        result.processingTime = Date.now() - startTime
        console.error(`[BATCH][${pipelineId ?? 'unknown'}][${result.batchIndex}] Failed after ${maxRetries + 1} attempts`)
        return result
      }

      // Wait before retrying (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000))
    }
  }

  return result
}

// Process batches with concurrency control
async function processBatchesConcurrently(batches: any[], openaiApiKey: string, pipelineId?: string): Promise<BatchResult[]> {
  const results: BatchResult[] = []
  console.log(`[BATCH_MANAGER] Processing ${batches.length} batches with max concurrency ${MAX_CONCURRENT_BATCHES}`)

  for (let i = 0; i < batches.length; i += MAX_CONCURRENT_BATCHES) {
    const batchGroup = batches.slice(i, Math.min(i + MAX_CONCURRENT_BATCHES, batches.length))

    console.log(`[BATCH_MANAGER] Starting batch group ${Math.floor(i / MAX_CONCURRENT_BATCHES) + 1}: batches ${i} to ${Math.min(i + MAX_CONCURRENT_BATCHES - 1, batches.length - 1)}`)

    // Process this group of batches concurrently
    const groupPromises = batchGroup.map(batch =>
      Promise.race([
        processBatch(batch, openaiApiKey, 3, pipelineId),
        new Promise<BatchResult>((_, reject) =>
          setTimeout(() => reject(new Error('Batch timeout')), BATCH_TIMEOUT)
        )
      ])
    )

    // Wait for all batches in this group to complete
    const groupResults = await Promise.allSettled(groupPromises)

    // Process results
    groupResults.forEach((result, index) => {
      const batchIndex = i + index
      if (result.status === 'fulfilled') {
        results.push(result.value)
        console.log(`[BATCH_MANAGER] Batch ${batchIndex} completed: ${result.value.status}`)
      } else {
        const failedResult: BatchResult = {
          batchIndex,
          startRow: batchGroup[index].startRow,
          endRow: batchGroup[index].endRow,
          status: 'failed',
          error: result.reason?.message || 'Unknown error',
          processingTime: BATCH_TIMEOUT
        }
        results.push(failedResult)
        console.error(`[BATCH_MANAGER] Batch ${batchIndex} failed:`, result.reason)
      }
    })

    // Small delay between batch groups to be nice to the API
    if (i + MAX_CONCURRENT_BATCHES < batches.length) {
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }

  return results.sort((a, b) => a.batchIndex - b.batchIndex)
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

export async function runUnifiedProcessingPipeline(
  csvData: string,
  options: UnifiedProcessingOptions = {}
): Promise<UnifiedProcessingResult> {
  const includeZipCodes = options.includeZipCodes !== false
  const pipelineId = options.metadata?.pipelineId
    ? String(options.metadata.pipelineId)
    : `pipeline-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  const startedAt = new Date()

  try {
    if (options.metadata) {
      console.log(`[UNIFIED_PROCESS][${pipelineId}][META]`, options.metadata)
    }

    console.log(`[UNIFIED_PROCESS][${pipelineId}] Starting complete processing pipeline...`)
    console.log(`[UNIFIED_PROCESS][${pipelineId}] Step 1/3: Delegating all field extraction to LLM (originals + cleaned)`) 

    console.log('[UNIFIED_PROCESS] Step 2/3: Cleaning with OpenAI using parallel batches...')
    const openaiApiKey = process.env.OPENAI_API_KEY
    if (!openaiApiKey) {
      throw new PipelineError(500, 'OpenAI API key not configured')
    }

    const csvForCleaning = csvData
    const csvLines = csvForCleaning.trim().split('\n')
    const headerLine = csvLines[0]
    const totalDataRows = csvLines.length - 1

    console.log('\n=== PARALLEL BATCH PROCESSING: Setup ===')
    console.log(`[BATCH][${pipelineId}][SETUP] Total CSV length:`, csvForCleaning.length)
    console.log(`[BATCH][${pipelineId}][SETUP] Total data rows:`, totalDataRows)
    console.log(`[BATCH][${pipelineId}][SETUP] Header line:`, headerLine)
    console.log(`[BATCH][${pipelineId}][SETUP] Batch size:`, BATCH_SIZE)
    console.log(`[BATCH][${pipelineId}][SETUP] Max concurrent batches:`, MAX_CONCURRENT_BATCHES)

    const batches = createBatches(csvLines, headerLine)
    console.log(`[BATCH][${pipelineId}][SETUP] Created ${batches.length} batches`)

    const openaiStartTime = Date.now()
    console.log(`[UNIFIED_PROCESS][${pipelineId}] Launching OpenAI cleaning across ${batches.length} batches`)
    const batchResults = await processBatchesConcurrently(batches, openaiApiKey, pipelineId)

    const cleanedData: any[] = []
    let successfulBatches = 0
    let failedBatches = 0
    const totalProcessingTime = Date.now() - openaiStartTime
    const batchInteractions: any[] = []

    console.log('\n=== PARALLEL BATCH PROCESSING: Results ===')
    batchResults.forEach((result) => {
      console.log(`[BATCH][${pipelineId}][RESULT] Batch ${result.batchIndex}: ${result.status} (rows ${result.startRow}-${result.endRow}, ${result.processingTime}ms)`)

      if (result.status === 'completed' && result.data) {
        cleanedData.push(...result.data)
        successfulBatches++
      } else {
        failedBatches++
        console.error(`[BATCH][${pipelineId}][RESULT] Batch ${result.batchIndex} failed: ${result.error}`)
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

    console.log(`[BATCH][${pipelineId}][SUMMARY][${pipelineId}] Successful batches: ${successfulBatches}/${batches.length}`)
    console.log(`[BATCH][${pipelineId}][SUMMARY][${pipelineId}] Failed batches: ${failedBatches}/${batches.length}`)
    console.log(`[BATCH][${pipelineId}][SUMMARY][${pipelineId}] Total processing time: ${totalProcessingTime}ms`)
    console.log(`[BATCH][${pipelineId}][SUMMARY][${pipelineId}] Average time per batch: ${Math.round(totalProcessingTime / batches.length)}ms`)
    console.log(`[BATCH][${pipelineId}][SUMMARY][${pipelineId}] Success rate: ${batches.length ? Math.round((successfulBatches / batches.length) * 100) : 0}%`)
    console.log('=== End Parallel Batch Processing ===\n')

    if (failedBatches > 0) {
      console.log(`[BATCH][${pipelineId}][FALLBACK] Processing ${failedBatches} failed batches using raw data fallback`)
    }

    const rawAllLines = csvForCleaning.trim().split('\n')
    const rawHeader = parseCleanCSVLine(rawAllLines[0] || '')
    const rawLower = rawHeader.map(h => (h || '').toLowerCase())
    const idxOf = (keys: string[]) => rawLower.findIndex(h => keys.some(k => h.includes(k)))
    const idxAddress = idxOf(['address', 'direc', 'buyer address1', 'direccion'])
    const idxCity = idxOf(['city', 'ciudad', 'localidad'])
    const idxState = idxOf(['state', 'estado', 'provincia', 'department'])
    const idxPhone = idxOf(['phone', 'tel'])
    const idxEmail = idxOf(['email', 'correo'])
    const rawDataRows = rawAllLines.slice(1).filter(l => l && l.trim().length > 0).map(parseCleanCSVLine)

    console.log('[DEBUG] Cleaned rows:', cleanedData.length, 'Raw rows:', rawDataRows.length)

    console.log('[UNIFIED_PROCESS] Step 3/3: Geocoding addresses...')

    const mapsApiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY
    if (!mapsApiKey) {
      throw new PipelineError(500, 'Google Maps API key not configured')
    }

    const confidenceFor = (locationType: string | undefined) => {
      const map: Record<string, number> = {
        ROOFTOP: 1.0,
        RANGE_INTERPOLATED: 0.8,
        GEOMETRIC_CENTER: 0.6,
        APPROXIMATE: 0.4
      }
      return locationType ? (map[locationType] ?? 0.5) : 0
    }

    const getConfidenceDescriptionLocal = (locationType: string | undefined) => {
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

      console.log(`[GEOCODE][${pipelineId}][INPUT] Address: "${address}"`)
      console.log(`[GEOCODE][${pipelineId}][INPUT] City: "${city}"`)
      console.log(`[GEOCODE][${pipelineId}][INPUT] State: "${state}"`)

      let url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${mapsApiKey}`
      const componentsUsed: string[] = ['country:PY']
      if (state && state.trim()) componentsUsed.push(`administrative_area:${state}`)
      if (city && city.trim()) componentsUsed.push(`locality:${city}`)
      if (componentsUsed.length) {
        url += `&components=${encodeURIComponent(componentsUsed.join('|'))}`
      }

      console.log(`[GEOCODE][${pipelineId}][API_CALL] Full URL: ${url}`)
      console.log(`[GEOCODE][${pipelineId}][API_CALL] Components: ${componentsUsed.join(' | ')}`)

      const requestUrl = url
      const response = await fetch(requestUrl)
      let data: any = null
      try {
        data = await response.json()
        console.log(`[GEOCODE][${pipelineId}][API_RESPONSE] Status: ${data?.status}`)
        console.log(`[GEOCODE][${pipelineId}][API_RESPONSE] Results count: ${data?.results?.length || 0}`)
        console.log(`[GEOCODE][${pipelineId}][API_RESPONSE] HTTP Status: ${response.status}`)
        if (data?.error_message) {
          console.log(`[GEOCODE][${pipelineId}][API_RESPONSE] Error: ${data.error_message}`)
        }
      } catch (parseError) {
        console.warn(`[GEOCODE][${pipelineId}][PARSE_ERROR] Unable to parse Google response as JSON`, parseError)
      }

      const rawResults = Array.isArray(data?.results) ? data.results : []
      let best: any = null

      if (Array.isArray(rawResults) && rawResults.length > 0) {
        console.log(`[GEOCODE][${pipelineId}][PROCESSING] Processing ${rawResults.length} results`)
        best = rawResults.reduce((acc: any, cur: any) => {
          const score = confidenceFor(cur?.geometry?.location_type)
          console.log(`[GEOCODE][${pipelineId}][RESULT] Location type: ${cur?.geometry?.location_type}, Score: ${score}`)
          if (!acc || score > acc.confidence_score) {
            const loc = cur.geometry?.location || {}
            const result = {
              latitude: loc.lat,
              longitude: loc.lng,
              formatted_address: cur.formatted_address,
              location_type: cur.geometry?.location_type,
              confidence_score: score,
              confidence_description: getConfidenceDescriptionLocal(cur.geometry?.location_type)
            }
            console.log(`[GEOCODE][${pipelineId}][BEST] New best result: ${JSON.stringify(result, null, 2)}`)
            return result
          }
          return acc
        }, null)
      } else {
        console.log(`[GEOCODE][${pipelineId}][NO_RESULTS] No results found for address: "${address}"`)
      }

      const status = data?.status || (response.ok ? 'UNKNOWN' : `HTTP_${response.status}`)
      const errorMessage = data?.error_message || (!response.ok ? `HTTP ${response.status}` : undefined)

      console.log(`[GEOCODE][${pipelineId}][FINAL] Status: ${status}, Best result: ${best ? 'Found' : 'None'}`)

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

    const results: UnifiedProcessingRow[] = []
    const geocodingInteractions: GeocodingInteractionDebug[] = []
    let highConfidence = 0
    let mediumConfidence = 0
    let lowConfidence = 0

    console.log('\n=== BATCH PROCESSING: Starting Geocoding ===')
    console.log(`[GEOCODING][${pipelineId}][BATCH] Processing ${cleanedData.length} addresses`)
    console.log(`[GEOCODING][${pipelineId}][BATCH] Addresses to geocode:`)
    cleanedData.forEach((item, idx) => {
      console.log(`  [${idx}]: "${item.address}" (city: "${item.city}", state: "${item.state}")`)
    })
    console.log('=== Starting Individual Geocoding ===\n')

    for (let i = 0; i < cleanedData.length; i++) {
      const cleaned = cleanedData[i]
      if ((!cleaned.address || cleaned.address.trim() === '') && rawDataRows[i]) {
        const raw = rawDataRows[i]
        cleaned.address = idxAddress >= 0 ? (raw[idxAddress] || '') : ''
        cleaned.city = idxCity >= 0 ? (raw[idxCity] || '') : ''
        cleaned.state = idxState >= 0 ? (raw[idxState] || '') : ''
        cleaned.phone = idxPhone >= 0 ? (raw[idxPhone] || '') : ''
        cleaned.email = idxEmail >= 0 ? (raw[idxEmail] || '') : ''
        console.warn(`[ROW_FALLBACK][${pipelineId}] Filled cleaned fields for row ${i} from raw CSV`)
      }

      console.log(`\n--- GEOCODING ROW ${i} ---`)
      console.log(`[GEOCODE][${pipelineId}][${i}][INPUT] Original: "${cleaned.originalAddress}"`)
      console.log(`[GEOCODE][${pipelineId}][${i}][INPUT] Cleaned: "${cleaned.address}"`)
      console.log(`[GEOCODE][${pipelineId}][${i}][INPUT] City: "${cleaned.city}"`)
      console.log(`[GEOCODE][${pipelineId}][${i}][INPUT] State: "${cleaned.state}"`)

      const original = {
        address: cleaned.originalAddress,
        city: cleaned.originalCity,
        state: cleaned.originalState,
        phone: cleaned.originalPhone
      }

      try {
        const geocodeStartTime = Date.now()
        const geo = await geocode(cleaned.address, cleaned.city, cleaned.state)
        const geocodeEndTime = Date.now()

        const geocodingInteraction = {
          timestamp: new Date().toISOString(),
          rowIndex: i,
          request: {
            address: cleaned.address,
            city: cleaned.city,
            state: cleaned.state,
            components: geo?.componentsUsed || ['country:PY'],
            url: geo?.requestUrl || `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(cleaned.address)}&key=${mapsApiKey}`
          },
          response: {
            status: geo?.status || 'UNKNOWN',
            results: geo?.rawResults || [],
            bestResult: geo?.best || null,
            rawResponse: geo?.rawResponse || null,
            responseTime: geocodeEndTime - geocodeStartTime,
            httpStatus: geo?.httpStatus || null,
            error: geo?.error || null
          }
        }
        geocodingInteractions.push(geocodingInteraction)

        const geoConfidence = geo?.best?.confidence_score || 0
        const confidenceScore = geoConfidence

        if (confidenceScore >= 0.8) highConfidence++
        else if (confidenceScore >= 0.6) mediumConfidence++
        else lowConfidence++

        let zipCodeResult: any = null
        if (includeZipCodes && geo?.best?.latitude && geo?.best?.longitude) {
          try {
            console.log(`[ZIPCODE][${pipelineId}][${i}] Looking up zip code...`)
            zipCodeResult = await zipCodeService.getZipCode(geo.best.latitude, geo.best.longitude)
            console.log(`[ZIPCODE][${pipelineId}][${i}][OUTPUT] Result:`, zipCodeResult)
          } catch (zipError) {
            console.warn(`[ZIPCODE][${pipelineId}][${i}][ERROR] Failed to get zip code:`, zipError)
          }
        } else if (!includeZipCodes) {
          console.log(`[ZIPCODE][${pipelineId}][${i}][SKIP] Zip code lookup disabled`)
        } else {
          console.log(`[ZIPCODE][${pipelineId}][${i}][SKIP] No coordinates available`)
        }

        results.push({
          rowIndex: i,
          original: {
            address: original.address || '',
            city: original.city || '',
            state: original.state || '',
            phone: original.phone || ''
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
          status: confidenceScore >= 0.8 ? 'high_confidence' : confidenceScore >= 0.6 ? 'medium_confidence' : 'low_confidence',
          googleMapsLink: geo?.best?.latitude && geo?.best?.longitude
            ? `https://www.google.com/maps?q=${geo.best.latitude},${geo.best.longitude}`
            : null
        })
      } catch (error: any) {
        console.error(`[GEOCODE][${pipelineId}][${i}][ERROR] Processing failed:`, error)

        const failedGeocodingInteraction = {
          timestamp: new Date().toISOString(),
          rowIndex: i,
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
        geocodingInteractions.push(failedGeocodingInteraction)

        lowConfidence++
        results.push({
          rowIndex: i,
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
        })
      }
      console.log(`--- END ROW ${i} ---\n`)
    }

    console.log('\n=== BATCH PROCESSING: Final Summary ===')
    console.log(`[SUMMARY][${pipelineId}] Total addresses processed: ${results.length}`)
    console.log(`[SUMMARY][${pipelineId}] High confidence: ${highConfidence}`)
    console.log(`[SUMMARY][${pipelineId}] Medium confidence: ${mediumConfidence}`)
    console.log(`[SUMMARY][${pipelineId}] Low confidence: ${lowConfidence}`)
    const successRate = results.length ? ((highConfidence + mediumConfidence) / results.length * 100) : 0
    console.log(`[SUMMARY][${pipelineId}] Success rate: ${successRate.toFixed(1)}%`)
    console.log('=== End Batch Processing ===\n')

    console.log(`[UNIFIED_PROCESS][${pipelineId}] Processed ${results.length} addresses`)

    return {
      success: true,
      totalProcessed: results.length,
      statistics: {
        highConfidence,
        mediumConfidence,
        lowConfidence,
        totalRows: results.length
      },
      results,
      debug: {
        batchProcessing: {
          totalBatches: batches.length,
          successfulBatches,
          failedBatches,
          batchSize: BATCH_SIZE,
          maxConcurrentBatches: MAX_CONCURRENT_BATCHES,
          totalProcessingTime,
          averageTimePerBatch: batches.length ? Math.round(totalProcessingTime / batches.length) : 0,
          successRate: batches.length ? Math.round((successfulBatches / batches.length) * 100) : 0,
          batchDetails: batchInteractions
        },
        geocodingInteractions,
        meta: {
          pipelineId,
          includeZipCodes,
          startedAt: startedAt.toISOString(),
          totalBatches: batches.length
        }
      }
    }
  } catch (error: any) {
    console.error(`[UNIFIED_PROCESS][${pipelineId}] Error:`, error)
    if (error instanceof PipelineError) {
      throw error
    }
    throw new PipelineError(500, 'Failed to process CSV data', error?.message || String(error))
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-GeoNorm-Batch-Index, X-GeoNorm-Batch-Start, X-GeoNorm-Batch-End, X-GeoNorm-Batch-TotalRows')
  res.setHeader('Access-Control-Max-Age', '86400')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const contentType = req.headers['content-type'] || ''
    console.log('[DEBUG] Request method:', req.method)
    console.log('[DEBUG] Content-Type:', contentType)
    console.log('[DEBUG] Body type:', typeof req.body)
    console.log('[DEBUG] Body has length:', req.body && typeof (req.body as any).length === 'number')

    const pipelineId = `handler-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const metadata = {
      batchIndex: req.headers['x-geonorm-batch-index'],
      batchStart: req.headers['x-geonorm-batch-start'],
      batchEnd: req.headers['x-geonorm-batch-end'],
      batchTotal: req.headers['x-geonorm-batch-totalrows'],
      pipelineId
    }

    if (metadata.batchIndex !== undefined) {
      console.log('[BATCH][META]', metadata)
    }

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
      return res.status(400).json({ error: 'CSV data is required' })
    }

    if (csvData.length < 10) {
      return res.status(400).json({ error: 'CSV data appears to be too short or invalid' })
    }

    console.log(`[UNIFIED_PROCESS][${pipelineId}] Handler invoking pipeline (csv length=${csvData.length})`)
    const handlerStart = Date.now()
    const pipelineResult = await runUnifiedProcessingPipeline(csvData, {
      metadata
    })
    const handlerDuration = Date.now() - handlerStart
    console.log(`[UNIFIED_PROCESS][${pipelineId}] Pipeline completed successfully in ${handlerDuration}ms`)

    return res.json(pipelineResult)
  } catch (error: any) {
    console.error('[UNIFIED_PROCESS] Handler Error:', error)
    if (error instanceof PipelineError) {
      return res.status(error.status).json({ error: error.message, details: error.details })
    }
    return res.status(500).json({ error: 'Failed to process CSV data', details: error?.message || String(error) })
  }
}
