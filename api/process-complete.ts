import { VercelRequest, VercelResponse } from '@vercel/node'
import dotenv from 'dotenv'
import { randomUUID } from 'crypto'
import { zipCodeService } from '../backend/services/zipCodeService'

// Load environment variables
dotenv.config()

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
    console.log('[DEBUG] Body type:', typeof req.body)
    console.log('[DEBUG] Body has length:', req.body && typeof (req.body as any).length === 'number')

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
      console.log('[DEBUG] csvData preview:', csvData.substring(0, 200))
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

    // Step 2: Clean with OpenAI
    console.log('[UNIFIED_PROCESS] Step 2/3: Cleaning with OpenAI...')
    const openaiApiKey = process.env.OPENAI_API_KEY
    if (!openaiApiKey) {
      return res.status(500).json({ error: 'OpenAI API key not configured' })
    }

    // Send RAW CSV to LLM; prompt is now flexible to discover columns per row
    const csvForCleaning = csvData
    console.log('[DEBUG] CSV for cleaning preview:', csvForCleaning.substring(0, 200))

    // Dynamically import the cleaning module and call OpenAI
    // @ts-ignore - JS module without TypeScript types
    const cleanerModule: any = await import('../backend/cleanParaguayAddresses.js')
    const cleanedCsv: string = await cleanerModule.cleanParaguayAddresses(openaiApiKey, csvForCleaning)
    console.log('[DEBUG] Received cleaned CSV length:', cleanedCsv?.length)

    // Parser that strips surrounding quotes when pushing
    const parseCleanCSVLine = (line: string): string[] => {
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

    const cleanedLines = cleanedCsv.trim().split('\n')
    const cleanedData = cleanedLines.slice(1).map((line: string) => {
      const values = parseCleanCSVLine(line)
      return {
        // Original fields (AI-extracted, uncleaned)
        originalAddress: values[0] || '',
        originalCity: values[1] || '',
        originalState: values[2] || '',
        originalPhone: values[3] || '',
        // Cleaned fields
        address: values[4] || '',
        city: values[5] || '',
        state: values[6] || '',
        phone: values[7] || '',
        email: values[8] || '',
        aiConfidence: parseInt(values[9] || '0') || 0
      }
    })
    console.log('[DEBUG] Sample cleaned data:', cleanedData.slice(0, 2))
    console.log(`[UNIFIED_PROCESS] Cleaned ${cleanedData.length} rows`)

    // Step 3: Real geocoding results via Google Maps
    console.log('[UNIFIED_PROCESS] Step 3/3: Geocoding addresses...')

    const mapsApiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY
    if (!mapsApiKey) {
      return res.status(500).json({ error: 'Google Maps API key not configured' })
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
      let url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${mapsApiKey}`
      const components: string[] = ['country:PY']
      if (state && state.trim()) components.push(`administrative_area:${state}`)
      if (city && city.trim()) components.push(`locality:${city}`)
      if (components.length) {
        url += `&components=${encodeURIComponent(components.join('|'))}`
      }
      const r = await fetch(url)
      if (!r.ok) return { status: 'ERROR', error: `HTTP ${r.status}` }
      const data: any = await r.json()
      let best: any = null
      if (data.status === 'OK' && Array.isArray(data.results) && data.results.length > 0) {
        best = data.results.reduce((acc: any, cur: any) => {
          const score = confidenceFor(cur?.geometry?.location_type)
          if (!acc || score > acc.confidence_score) {
            const loc = cur.geometry.location
            return {
              latitude: loc.lat,
              longitude: loc.lng,
              formatted_address: cur.formatted_address,
              location_type: cur.geometry.location_type,
              confidence_score: score,
              confidence_description: getConfidenceDescription(cur.geometry.location_type)
            }
          }
          return acc
        }, null)
      }
      return { status: data.status, best, rawCount: data.results?.length || 0 }
    }

    const results: any[] = []
    let highConfidence = 0
    let mediumConfidence = 0
    let lowConfidence = 0

    for (let i = 0; i < cleanedData.length; i++) {
      const cleaned = cleanedData[i]
      // Use AI-extracted ORIGINAL fields (uncleaned)
      const original = {
        address: cleaned.originalAddress,
        city: cleaned.originalCity,
        state: cleaned.originalState,
        phone: cleaned.originalPhone
      }
      try {
        const geo = await geocode(cleaned.address, cleaned.city, cleaned.state)
        const geoConfidence = geo?.best?.confidence_score || 0
        const aiConfidence = (cleaned.aiConfidence || 0) / 100
        // Combined confidence calculation: ((8*ai) * (2*geo))/10
        const combinedConfidence = ((8 * aiConfidence) * (2 * geoConfidence)) / 10
        
        if (combinedConfidence >= 0.8) highConfidence++
        else if (combinedConfidence >= 0.6) mediumConfidence++
        else lowConfidence++

        // Extract zip code if we have coordinates
        let zipCodeResult = null
        if (geo?.best?.latitude && geo?.best?.longitude) {
          try {
            zipCodeResult = await zipCodeService.getZipCode(geo.best.latitude, geo.best.longitude)
          } catch (zipError) {
            console.warn(`[ZIP_CODE] Failed to get zip code for row ${i}:`, zipError)
          }
        }

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
            email: cleaned.email,
            aiConfidence: cleaned.aiConfidence
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
          status: combinedConfidence >= 0.8 ? 'high_confidence' : combinedConfidence >= 0.6 ? 'medium_confidence' : 'low_confidence',
          // Generate simple Google Maps link
          googleMapsLink: geo?.best?.latitude && geo?.best?.longitude 
            ? `https://www.google.com/maps?q=${geo.best.latitude},${geo.best.longitude}`
            : null
        })
      } catch (error: any) {
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
            email: cleaned.email,
            aiConfidence: cleaned.aiConfidence
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
          // No Google Maps link for failed geocoding
          googleMapsLink: null
        })
      }
    }

    console.log(`[UNIFIED_PROCESS] Processed ${results.length} addresses`)

    // Note: Data will be saved to Firebase by the frontend after processing
    // The frontend will handle the Firebase integration using the existing DataService

    return res.json({
      success: true,
      totalProcessed: results.length,
      statistics: {
        highConfidence,
        mediumConfidence,
        lowConfidence,
        totalRows: results.length
      },
      results
    })

  } catch (error: any) {
    console.error('[UNIFIED_PROCESS] Error:', error)
    return res.status(500).json({ error: 'Failed to process CSV data', details: error.message })
  }
}
