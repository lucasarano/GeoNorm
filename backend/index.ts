import dotenv from 'dotenv'

// Load environment variables FIRST
dotenv.config()

import express from 'express'
import cors from 'cors'
import { randomUUID } from 'crypto'
import { doc, getDoc, updateDoc, setDoc, collection, query, where, getDocs, Timestamp, serverTimestamp } from 'firebase/firestore'
import { db } from './config/firebase.js'
import { smsService } from './services/smsService'
import { emailService } from './services/emailService'
// Note: dynamically import the cleaner to avoid TS type declaration issues for .js module

const app = express()
const PORT = process.env.PORT || 3001

// Minimal server for extract -> clean -> geocode flow only

// Enable CORS for all routes
app.use(cors({
    origin: [
        'http://localhost:5173',
        'http://localhost:5174',
        'http://localhost:5175',
        'http://localhost:3000'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}))

app.use(express.json())

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'OK', message: 'GeoNorm API Server is running' })
})

// Removed: registration/auth/profile/stats endpoints

// Removed: standalone geocoding and places endpoints (not used by Extract flow)

// Geocode both original and cleaned addresses, with optional components
app.post('/api/geocode-both', async (req, res) => {
    try {
        const { originalAddress, cleanedAddress, components } = req.body || {}
        const apiKey = process.env.VITE_GOOGLE_MAPS_API_KEY

        if (!apiKey) {
            return res.status(500).json({ error: 'Google Maps API key not configured' })
        }

        // Validate addresses - prioritize cleaned addresses
        const hasValidOriginal = originalAddress && originalAddress.trim() && originalAddress.trim() !== 'N/A' && originalAddress.trim().length >= 3
        const hasValidCleaned = cleanedAddress && cleanedAddress.trim() && cleanedAddress.trim() !== 'N/A' && cleanedAddress.trim().length >= 3

        if (!hasValidCleaned) {
            return res.status(400).json({ error: 'Valid cleaned address must be provided' })
        }

        const buildComponents = (c?: any) => {
            if (!c) return undefined
            const parts: string[] = []
            if (c.country) parts.push(`country:${c.country}`)
            if (c.state) parts.push(`administrative_area:${c.state}`)
            if (c.city) parts.push(`locality:${c.city}`)
            if (c.postal_code) parts.push(`postal_code:${c.postal_code}`)
            return parts.length ? parts.join('|') : undefined
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
                ROOFTOP: "Most precise - exact address match",
                RANGE_INTERPOLATED: "High precision - interpolated within address range",
                GEOMETRIC_CENTER: "Medium precision - center of building/area",
                APPROXIMATE: "Low precision - approximate location"
            }
            return locationType ? descriptions[locationType] || "Unknown precision" : "No location type"
        }

        const geocode = async (address?: string, componentsStr?: string) => {
            if (!address || address.trim() === '' || address.trim() === 'N/A' || address.trim().length < 3) {
                console.log(`[GEOCODE] Skipping geocoding for invalid address: "${address}"`)
                return null
            }
            let url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`
            if (componentsStr) {
                url += `&components=${encodeURIComponent(componentsStr)}`
            }
            const r = await fetch(url)
            if (!r.ok) {
                return { status: 'ERROR', error: `HTTP ${r.status}` }
            }
            const data: any = await r.json()
            let best: any = null
            if (data.status === 'OK' && Array.isArray(data.results) && data.results.length > 0) {
                // Pick highest confidence
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

        const componentsStr = buildComponents(components)
        // Only geocode the cleaned address
        const clean = await geocode(cleanedAddress, componentsStr)
        const orig = null // Don't geocode original addresses

        // Since we only geocode cleaned addresses, use that result
        let chosen: 'cleaned' | 'original' | null = null
        if (clean?.best) {
            chosen = 'cleaned'
        } else {
            chosen = null
        }

        const lat = clean?.best?.latitude
        const lng = clean?.best?.longitude

        const staticMapPath = lat != null && lng != null
            ? `/api/staticmap?lat=${lat}&lng=${lng}&zoom=14&size=600x300`
            : null

        // No persistence in simplified flow

        res.json({
            original: orig,
            cleaned: { ...(clean || {}), usedComponents: componentsStr },
            chosen,
            staticMapUrl: staticMapPath,
            confidence: clean?.best?.confidence_score || 0,
            confidenceDescription: clean?.best?.confidence_description || 'No geocoding result',
            locationType: clean?.best?.location_type || 'N/A'
        })
    } catch (error) {
        console.error('[GEOCODE_BOTH] Error:', error)
        res.status(500).json({ error: 'Failed to geocode addresses' })
    }
})

// Static Maps proxy endpoint
app.get('/api/staticmap', async (req, res) => {
    try {
        const { lat, lng, zoom = '14', size = '600x300' } = req.query
        const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY
        if (!apiKey) {
            console.error('[STATIC_MAP] No API key found')
            return res.status(500).json({ error: 'Google Maps API key not configured' })
        }
        if (!lat || !lng) {
            console.error('[STATIC_MAP] Missing lat/lng:', { lat, lng })
            return res.status(400).json({ error: 'lat and lng are required' })
        }

        const url = `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=${zoom}&size=${size}&markers=color:red%7C${lat},${lng}&key=${apiKey}`
        console.log('[STATIC_MAP] Requesting:', url.replace(apiKey, '[API_KEY]'))

        const r = await fetch(url)
        console.log('[STATIC_MAP] Google response status:', r.status)

        if (!r.ok) {
            const errorText = await r.text()
            console.error('[STATIC_MAP] Google API error:', r.status, errorText)
            return res.status(500).json({ error: `Google API error: ${r.status} - ${errorText}` })
        }

        const contentType = r.headers.get('content-type')
        console.log('[STATIC_MAP] Content-Type from Google:', contentType)

        if (contentType && contentType.includes('image')) {
            res.setHeader('Content-Type', 'image/png')
            res.setHeader('Cache-Control', 'public, max-age=3600')

            // Use arrayBuffer for better compatibility
            const arrayBuffer = await r.arrayBuffer()
            const buffer = Buffer.from(arrayBuffer)
            res.send(buffer)
        } else {
            const text = await r.text()
            console.error('[STATIC_MAP] Unexpected response:', text)
            res.status(500).json({ error: 'Unexpected response from Google Maps API' })
        }
    } catch (error: any) {
        console.error('[STATIC_MAP] Error:', error)
        res.status(500).json({ error: 'Failed to fetch static map', details: error.message })
    }
})

// CSV field extraction endpoint
app.post('/api/extract-fields', express.raw({ type: 'text/csv', limit: '10mb' }), async (req, res) => {
    try {
        const csvData = req.body.toString('utf-8')

        if (!csvData) {
            return res.status(400).json({ error: 'CSV data is required' })
        }

        // Parse CSV and extract the required fields
        const lines = csvData.trim().split('\n')

        // Better CSV parsing that handles quoted fields with commas
        const parseCSVLine = (line: string): string[] => {
            const result: string[] = []
            let current = ''
            let inQuotes = false

            for (let i = 0; i < line.length; i++) {
                const char = line[i]

                if (char === '"') {
                    inQuotes = !inQuotes
                } else if (char === ',' && !inQuotes) {
                    result.push(current.trim())
                    current = ''
                } else {
                    current += char
                }
            }
            result.push(current.trim())
            return result
        }

        const headers = parseCSVLine(lines[0])

        // Find column indices
        const addressIndex = headers.findIndex((h: string) => h.includes('Buyer Address1'))
        const cityIndex = headers.findIndex((h: string) => h.includes('Buyer City'))
        const stateIndex = headers.findIndex((h: string) => h.includes('Buyer State'))
        const phoneIndex = headers.findIndex((h: string) => h.includes('Buyer Phone'))

        console.log('CSV Headers:', headers)
        console.log('Column indices:', { addressIndex, cityIndex, stateIndex, phoneIndex })

        if (addressIndex === -1 || cityIndex === -1 || stateIndex === -1 || phoneIndex === -1) {
            return res.status(400).json({ error: 'Required columns not found in CSV' })
        }

        const extractedData = lines.slice(1).map((line: string, index: number) => {
            const values = parseCSVLine(line)
            const row = {
                address: values[addressIndex] || '',
                city: values[cityIndex] || '',
                state: values[stateIndex] || '',
                phone: values[phoneIndex] || ''
            }
            console.log(`Row ${index + 1}:`, row)
            return row
        }).filter((row: any) => row.address || row.city || row.state || row.phone) // Filter out empty rows

        res.json({ data: extractedData })
    } catch (error) {
        console.error('CSV extraction error:', error)
        res.status(500).json({ error: 'Failed to extract fields from CSV' })
    }
})

// OpenAI address cleaning endpoint
app.post('/api/clean-with-openai', async (req, res) => {
    try {
        const { extractedData } = req.body

        if (!extractedData || !Array.isArray(extractedData)) {
            return res.status(400).json({ error: 'Extracted data is required' })
        }

        const apiKey = process.env.OPENAI_API_KEY
        if (!apiKey) {
            return res.status(500).json({ error: 'OpenAI API key not configured' })
        }

        // Convert extracted data to CSV format for OpenAI
        const csvData = [
            'Address,City,State,Phone',
            ...extractedData.map((row: any) =>
                `"${row.address}","${row.city}","${row.state}","${row.phone}"`
            )
        ].join('\n')

        console.log('Sending data to OpenAI for cleaning...')

        // Dynamically import cleaning function (JS module) and call it
        // @ts-ignore - JS module without TypeScript types
        const cleanerModule: any = await import('./cleanParaguayAddresses.js')
        const cleanedCsv: string = await cleanerModule.cleanParaguayAddresses(apiKey, csvData)

        console.log('Received cleaned CSV from OpenAI')

        // Parse the cleaned CSV using our robust parser
        const parseCSVLine = (line: string): string[] => {
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

        const lines = cleanedCsv.trim().split('\n')
        const dataLines = lines.slice(1) // Skip header

        const cleaned = dataLines.map((line: string, index: number) => {
            const values = parseCSVLine(line)
            console.log(`Parsed cleaned row ${index + 1}:`, values)

            return {
                address: values[0] || '',
                city: values[1] || '',
                state: values[2] || '',
                phone: values[3] || '',
                email: values[4] || ''
            }
        })

        res.json({ data: cleaned })
    } catch (error) {
        console.error('OpenAI cleaning error:', error)
        res.status(500).json({ error: 'Failed to clean data with OpenAI' })
    }
})

// Address confirmation endpoints
app.post('/api/send-confirmations', async (req, res) => {
    try {
        const { addresses } = req.body

        if (!addresses || !Array.isArray(addresses)) {
            return res.status(400).json({ error: 'Addresses array is required' })
        }

        // Prepare confirmations for SMS
        const confirmations = addresses
            .filter((addr: any) => addr.phone && addr.needsConfirmation)
            .map((addr: any) => ({
                phoneNumber: addr.phone,
                originalAddress: addr.originalAddress,
                cleanedAddress: addr.cleanedAddress,
                confirmationUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/confirm/${addr.id}`
            }))

        if (confirmations.length === 0) {
            return res.json({ message: 'No addresses require SMS confirmation', sent: 0 })
        }

        const results = await smsService.sendBulkConfirmations(confirmations)

        res.json({
            message: `SMS confirmations processed`,
            sent: results.successful,
            failed: results.failed,
            errors: results.errors
        })
    } catch (error) {
        console.error('Error sending confirmations:', error)
        res.status(500).json({ error: 'Failed to send confirmation SMS' })
    }
})

// Address confirmation response endpoints
app.get('/confirm/:addressId/confirm', async (req, res) => {
    try {
        const { addressId } = req.params

        // In a real implementation, you would:
        // 1. Update the address status in Firebase to 'confirmed'
        // 2. Log the confirmation

        console.log(`Address ${addressId} confirmed via SMS`)

        // Redirect to a confirmation page
        res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/confirmation-success?status=confirmed&id=${addressId}`)
    } catch (error) {
        console.error('Error confirming address:', error)
        res.status(500).json({ error: 'Failed to confirm address' })
    }
})

app.get('/confirm/:addressId/reject', async (req, res) => {
    try {
        const { addressId } = req.params

        // In a real implementation, you would:
        // 1. Update the address status in Firebase to 'rejected'
        // 2. Log the rejection

        console.log(`Address ${addressId} rejected via SMS`)

        // Redirect to a rejection page
        res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/confirmation-success?status=rejected&id=${addressId}`)
    } catch (error) {
        console.error('Error rejecting address:', error)
        res.status(500).json({ error: 'Failed to reject address' })
    }
})

// Unified processing endpoint - CSV upload -> Extract -> Clean -> Geocode
app.post('/api/process-complete', express.raw({ type: 'text/csv', limit: '10mb' }), async (req, res) => {
    try {
        const csvData = req.body.toString('utf-8')

        if (!csvData) {
            return res.status(400).json({ error: 'CSV data is required' })
        }

        console.log('[UNIFIED_PROCESS] Starting complete processing pipeline...')

        // Step 1: Extract fields from CSV
        console.log('[UNIFIED_PROCESS] Step 1/3: Extracting fields...')
        const lines = csvData.trim().split('\n')

        const parseCSVLine = (line: string): string[] => {
            const result: string[] = []
            let current = ''
            let inQuotes = false

            for (let i = 0; i < line.length; i++) {
                const char = line[i]
                if (char === '"') {
                    inQuotes = !inQuotes
                } else if (char === ',' && !inQuotes) {
                    result.push(current.trim())
                    current = ''
                } else {
                    current += char
                }
            }
            result.push(current.trim())
            return result
        }

        const headers = parseCSVLine(lines[0])
        const addressIndex = headers.findIndex((h: string) => h.includes('Buyer Address1'))
        const cityIndex = headers.findIndex((h: string) => h.includes('Buyer City'))
        const stateIndex = headers.findIndex((h: string) => h.includes('Buyer State'))
        const phoneIndex = headers.findIndex((h: string) => h.includes('Buyer Phone'))

        if (addressIndex === -1 || cityIndex === -1 || stateIndex === -1 || phoneIndex === -1) {
            return res.status(400).json({ error: 'Required columns not found in CSV' })
        }

        const extractedData = lines.slice(1).map((line: string) => {
            const values = parseCSVLine(line)
            return {
                address: values[addressIndex] || '',
                city: values[cityIndex] || '',
                state: values[stateIndex] || '',
                phone: values[phoneIndex] || ''
            }
        }).filter((row: any) => row.address || row.city || row.state || row.phone)

        console.log(`[UNIFIED_PROCESS] Extracted ${extractedData.length} rows`)

        // Step 2: Clean with OpenAI
        console.log('[UNIFIED_PROCESS] Step 2/3: Cleaning with OpenAI...')
        const apiKey = process.env.OPENAI_API_KEY
        if (!apiKey) {
            return res.status(500).json({ error: 'OpenAI API key not configured' })
        }

        const csvForCleaning = [
            'Address,City,State,Phone',
            ...extractedData.map((row: any) =>
                `"${row.address}","${row.city}","${row.state}","${row.phone}"`
            )
        ].join('\n')

        // @ts-ignore - JS module without TypeScript types
        const cleanerModule: any = await import('./cleanParaguayAddresses.js')
        const cleanedCsv: string = await cleanerModule.cleanParaguayAddresses(apiKey, csvForCleaning)

        const cleanedLines = cleanedCsv.trim().split('\n')
        const cleanedData = cleanedLines.slice(1).map((line: string) => {
            const values = parseCSVLine(line)
            return {
                address: values[0] || '',
                city: values[1] || '',
                state: values[2] || '',
                phone: values[3] || '',
                email: values[4] || '',
                aiConfidence: parseInt(values[5]) || 0
            }
        })

        console.log(`[UNIFIED_PROCESS] Cleaned ${cleanedData.length} rows`)

        // Step 3: Geocode cleaned addresses
        console.log('[UNIFIED_PROCESS] Step 3/3: Geocoding addresses...')
        const mapsApiKey = process.env.VITE_GOOGLE_MAPS_API_KEY
        if (!mapsApiKey) {
            return res.status(500).json({ error: 'Google Maps API key not configured' })
        }

        const results = []
        let highConfidence = 0
        let mediumConfidence = 0
        let lowConfidence = 0

        for (let i = 0; i < cleanedData.length; i++) {
            const cleaned = cleanedData[i]
            const original = extractedData[i]

            try {
                const components: Record<string, string> = { country: 'PY' }
                if (cleaned.state && cleaned.state.trim()) components.state = cleaned.state
                if (cleaned.city && cleaned.city.trim()) components.city = cleaned.city

                const resp = await fetch(`http://localhost:${PORT}/api/geocode-both`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        originalAddress: original?.address ?? '',
                        cleanedAddress: cleaned.address,
                        components
                    })
                })

                if (!resp.ok) throw new Error(`Geocode error ${resp.status}`)
                const data = await resp.json()

                // Categorize by confidence
                const confidence = data.confidence || 0
                if (confidence >= 0.8) highConfidence++
                else if (confidence >= 0.6) mediumConfidence++
                else lowConfidence++

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
                        latitude: data.cleaned?.best?.latitude || null,
                        longitude: data.cleaned?.best?.longitude || null,
                        formattedAddress: data.cleaned?.best?.formatted_address || '',
                        confidence: confidence,
                        confidenceDescription: data.confidenceDescription || 'Unknown',
                        locationType: data.locationType || 'N/A',
                        staticMapUrl: data.staticMapUrl || null
                    },
                    status: confidence >= 0.8 ? 'high_confidence' :
                        confidence >= 0.6 ? 'medium_confidence' : 'low_confidence'
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
                    status: 'failed',
                    error: error.message
                })
            }
        }

        console.log(`[UNIFIED_PROCESS] Geocoded ${results.length} addresses`)
        console.log(`[UNIFIED_PROCESS] Confidence breakdown: High: ${highConfidence}, Medium: ${mediumConfidence}, Low: ${lowConfidence}`)

        res.json({
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

    } catch (error) {
        console.error('[UNIFIED_PROCESS] Error:', error)
        res.status(500).json({ error: 'Failed to process CSV data' })
    }
})

// Processing completion notification
app.post('/api/notify-completion', async (req, res) => {
    try {
        const { phoneNumber, totalAddresses, pendingConfirmations } = req.body

        if (!phoneNumber) {
            return res.status(400).json({ error: 'Phone number is required' })
        }

        const success = await smsService.sendProcessingComplete(
            phoneNumber,
            totalAddresses || 0,
            pendingConfirmations || 0
        )

        res.json({ success, message: success ? 'Notification sent' : 'Failed to send notification' })
    } catch (error) {
        console.error('Error sending completion notification:', error)
        res.status(500).json({ error: 'Failed to send notification' })
    }
})

// Location Sender SMS endpoints
app.post('/api/send-location-sms', async (req, res) => {
    try {
        const { customers } = req.body

        if (!customers || !Array.isArray(customers)) {
            return res.status(400).json({ error: 'Customers array is required' })
        }

        const results = []
        const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173'

        for (const customer of customers) {
            const locationUrl = `${baseUrl}/location?orderID=${encodeURIComponent(customer.phone)}`
            const message = `Hola ${customer.name}! Para completar tu entrega, necesitamos tu ubicación exacta. Por favor haz clic en este enlace: ${locationUrl}`

            try {
                // Use existing SMS service
                const success = await smsService.sendSMS(customer.phone, message)

                results.push({
                    success: success,
                    customer,
                    messageId: success ? 'sent' : undefined,
                    locationUrl,
                    error: success ? undefined : 'SMS sending failed'
                })
            } catch (error: any) {
                results.push({
                    success: false,
                    customer,
                    locationUrl,
                    error: error.message
                })
            }
        }

        const successCount = results.filter(r => r.success).length
        const failureCount = results.filter(r => !r.success).length

        res.json({
            totalCustomers: customers.length,
            successCount,
            failureCount,
            results
        })

    } catch (error) {
        console.error('Error sending location SMS:', error)
        res.status(500).json({ error: 'Failed to send location SMS' })
    }
})

app.post('/api/test-location-sms', async (req, res) => {
    try {
        const { phone } = req.body

        if (!phone) {
            return res.status(400).json({ error: 'Phone number is required' })
        }

        const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173'
        const locationUrl = `${baseUrl}/location?orderID=TEST-${Date.now()}`
        const message = `Hola! Este es un SMS de prueba. Para compartir tu ubicación, haz clic aquí: ${locationUrl}`

        const success = await smsService.sendSMS(phone, message)

        res.json({
            success: success,
            messageId: success ? 'sent' : undefined,
            locationUrl,
            error: success ? undefined : 'SMS sending failed'
        })

    } catch (error) {
        console.error('Error sending test SMS:', error)
        res.status(500).json({ error: 'Failed to send test SMS' })
    }
})

app.post('/api/test-location-email', async (req, res) => {
    try {
        const { email, name } = req.body

        if (!email) {
            return res.status(400).json({ error: 'Email address is required' })
        }

        const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173'
        const locationUrl = `${baseUrl}/location?orderID=TEST-${Date.now()}`
        const customerName = name || 'Cliente'

        const success = await emailService.sendLocationRequest(email, customerName, locationUrl)

        res.json({
            success: success,
            messageId: success ? 'sent' : undefined,
            locationUrl,
            error: success ? undefined : 'Email sending failed'
        })

    } catch (error) {
        console.error('Error sending test email:', error)
        res.status(500).json({ error: 'Failed to send test email' })
    }
})

// Location collection endpoints
const locations: any[] = [] // In-memory storage for demo (use database in production)
const addressUpdates: any[] = [] // Track address confirmation updates

app.post('/api/address-records/location-links', async (req, res) => {
    try {
        const { addressIds, userId } = req.body || {}

        if (!Array.isArray(addressIds) || addressIds.length === 0) {
            return res.status(400).json({ error: 'addressIds array is required' })
        }

        if (!userId) {
            return res.status(400).json({ error: 'userId is required' })
        }

        const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173'
        const expiration = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
        const locationLinksCollection = collection(db, 'location_links')
        const results: Array<{ addressId: string, token: string, url: string, status: string, expiresAt?: string }> = []

        for (const addressId of addressIds) {
            try {
                const addressRef = doc(db, 'address_records', addressId)
                const addressSnap = await getDoc(addressRef)

                if (!addressSnap.exists()) {
                    console.warn(`[LOCATION_LINK] Address record not found: ${addressId}`)
                    continue
                }

                const addressData: any = addressSnap.data()
                if (addressData.userId !== userId) {
                    console.warn(`[LOCATION_LINK] User mismatch for address ${addressId}`)
                    continue
                }

                const token = randomUUID()
                const linkRef = doc(locationLinksCollection, token)

                await setDoc(linkRef, {
                    token,
                    addressId,
                    userId,
                    createdAt: serverTimestamp(),
                    expiresAt: Timestamp.fromDate(expiration),
                    status: 'sent'
                })

                await updateDoc(addressRef, {
                    locationLinkToken: token,
                    locationLinkStatus: 'sent',
                    locationLinkCreatedAt: serverTimestamp(),
                    locationLinkExpiresAt: Timestamp.fromDate(expiration),
                    updatedAt: serverTimestamp()
                })

                results.push({
                    addressId,
                    token,
                    url: `${baseUrl}/location?token=${token}`,
                    status: 'sent',
                    expiresAt: expiration.toISOString()
                })
            } catch (innerError) {
                console.error('Error generating link for address', addressId, innerError)
            }
        }

        res.json({ links: results })
    } catch (error) {
        console.error('Error creating location links:', error)
        res.status(500).json({ error: 'Failed to create location links' })
    }
})

app.get('/api/location-link/:token', async (req, res) => {
    try {
        const { token } = req.params

        if (!token) {
            return res.status(400).json({ error: 'Token is required' })
        }

        const linkRef = doc(db, 'location_links', token)
        const linkSnap = await getDoc(linkRef)

        if (!linkSnap.exists()) {
            return res.status(404).json({ error: 'Location link not found' })
        }

        const linkData: any = linkSnap.data()
        const addressRef = doc(db, 'address_records', linkData.addressId)
        const addressSnap = await getDoc(addressRef)

        if (!addressSnap.exists()) {
            return res.status(404).json({ error: 'Address record not found' })
        }

        const addressData: any = addressSnap.data()
        const expiresAt = linkData.expiresAt?.toDate?.() as Date | undefined
        const isExpired = expiresAt ? expiresAt.getTime() < Date.now() : false

        if (isExpired && linkData.status !== 'expired') {
            await updateDoc(addressRef, {
                locationLinkStatus: 'expired',
                updatedAt: serverTimestamp()
            })
            await updateDoc(linkRef, {
                status: 'expired',
                expiredAt: serverTimestamp()
            })
        }

        res.json({
            token,
            addressId: linkData.addressId,
            status: isExpired ? 'expired' : (linkData.status || addressData.locationLinkStatus || 'sent'),
            cleanedAddress: addressData.cleanedAddress,
            customerName: addressData.cleanedName || addressData.customerName || null,
            expiresAt: expiresAt?.toISOString(),
            userId: linkData.userId,
            latitude: linkData.latitude || null,
            longitude: linkData.longitude || null,
            accuracy: linkData.accuracy || null
        })
    } catch (error) {
        console.error('Error loading location link metadata:', error)
        res.status(500).json({ error: 'Failed to load location link metadata' })
    }
})

app.post('/api/location-link/:token/submit', async (req, res) => {
    try {
        const { token } = req.params
        const { latitude, longitude, accuracy } = req.body || {}

        if (!token) {
            return res.status(400).json({ error: 'Token is required' })
        }

        if (typeof latitude !== 'number' && typeof latitude !== 'string') {
            return res.status(400).json({ error: 'Latitude is required' })
        }

        if (typeof longitude !== 'number' && typeof longitude !== 'string') {
            return res.status(400).json({ error: 'Longitude is required' })
        }

        const linkRef = doc(db, 'location_links', token)
        const linkSnap = await getDoc(linkRef)

        if (!linkSnap.exists()) {
            return res.status(404).json({ error: 'Location link not found' })
        }

        const linkData: any = linkSnap.data()
        const addressRef = doc(db, 'address_records', linkData.addressId)
        const addressSnap = await getDoc(addressRef)

        if (!addressSnap.exists()) {
            return res.status(404).json({ error: 'Address record not found' })
        }

        const numericLatitude = typeof latitude === 'string' ? parseFloat(latitude) : latitude
        const numericLongitude = typeof longitude === 'string' ? parseFloat(longitude) : longitude
        const numericAccuracy = accuracy ? (typeof accuracy === 'string' ? parseFloat(accuracy) : accuracy) : null

        await updateDoc(addressRef, {
            coordinates: {
                lat: numericLatitude,
                lng: numericLongitude
            },
            lastLocationUpdate: serverTimestamp(),
            locationLinkStatus: 'submitted',
            updatedAt: serverTimestamp(),
            status: 'confirmed'
        })

        await updateDoc(linkRef, {
            status: 'submitted',
            submittedAt: serverTimestamp(),
            latitude: numericLatitude,
            longitude: numericLongitude,
            accuracy: numericAccuracy
        })

        res.json({ success: true })
    } catch (error) {
        console.error('Error submitting location for token:', error)
        res.status(500).json({ error: 'Failed to submit location' })
    }
})

app.post('/api/save-location', async (req, res) => {
    try {
        const { latitude, longitude, accuracy, orderID, userAgent } = req.body

        if (!latitude || !longitude) {
            return res.status(400).json({ error: 'Latitude and longitude are required' })
        }

        const locationData = {
            id: Date.now().toString(),
            latitude: parseFloat(latitude),
            longitude: parseFloat(longitude),
            accuracy: accuracy ? parseFloat(accuracy) : null,
            orderID: orderID || null,
            phoneNumber: orderID, // Using orderID as phone number for now
            userAgent: userAgent || null,
            timestamp: new Date().toISOString()
        }

        locations.push(locationData)

        console.log(`[LOCATION] Saved location: ${latitude}, ${longitude} (Order: ${orderID})`)

        res.json({ success: true, location: locationData })

    } catch (error) {
        console.error('Error saving location:', error)
        res.status(500).json({ error: 'Failed to save location' })
    }
})

app.get('/api/location-history', async (req, res) => {
    try {
        // Return locations sorted by timestamp (newest first)
        const sortedLocations = locations.sort((a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        )

        res.json(sortedLocations)

    } catch (error) {
        console.error('Error fetching location history:', error)
        res.status(500).json({ error: 'Failed to fetch location history' })
    }
})

// SMS Address Confirmation endpoints
app.post('/api/send-location-confirmations', async (req, res) => {
    try {
        const { addresses } = req.body

        if (!addresses || !Array.isArray(addresses)) {
            return res.status(400).json({ error: 'Addresses array is required' })
        }

        const results = []
        const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173'

        for (const address of addresses) {
            const confirmationId = `conf-${address.rowIndex}-${Date.now()}`
            const confirmUrl = `${baseUrl}/confirm-address/${confirmationId}`

            const message = `
🏠 GeoNorm - Confirmación de Dirección

Dirección procesada: ${address.cleanedAddress}

¿Es correcta esta dirección?

Confirmar: ${confirmUrl}/confirm
Rechazar: ${confirmUrl}/reject

Confianza actual: ${Math.round(address.confidence * 100)}%
            `.trim()

            try {
                const success = await smsService.sendSMS(address.phone, message)

                results.push({
                    rowIndex: address.rowIndex,
                    success: success,
                    confirmationId,
                    error: success ? undefined : 'SMS sending failed'
                })

                // Store confirmation request for tracking
                if (success) {
                    addressUpdates.push({
                        confirmationId,
                        rowIndex: address.rowIndex,
                        address: address.cleanedAddress,
                        phone: address.phone,
                        status: 'pending',
                        sentAt: new Date().toISOString()
                    })
                }

            } catch (error: any) {
                results.push({
                    rowIndex: address.rowIndex,
                    success: false,
                    error: error.message
                })
            }
        }

        const successCount = results.filter(r => r.success).length
        const failureCount = results.filter(r => !r.success).length

        res.json({
            totalAddresses: addresses.length,
            successCount,
            failureCount,
            results
        })

    } catch (error) {
        console.error('Error sending location confirmation SMS:', error)
        res.status(500).json({ error: 'Failed to send location confirmation SMS' })
    }
})

// Address confirmation response endpoints
app.get('/confirm-address/:confirmationId/confirm', async (req, res) => {
    try {
        const { confirmationId } = req.params

        const update = addressUpdates.find(u => u.confirmationId === confirmationId)
        if (update) {
            update.status = 'confirmed'
            update.confirmedAt = new Date().toISOString()

            console.log(`Address confirmed for row ${update.rowIndex}: ${update.address}`)
        }

        res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/confirmation-success?status=confirmed&id=${confirmationId}`)
    } catch (error) {
        console.error('Error confirming address:', error)
        res.status(500).json({ error: 'Failed to confirm address' })
    }
})

app.get('/confirm-address/:confirmationId/reject', async (req, res) => {
    try {
        const { confirmationId } = req.params

        const update = addressUpdates.find(u => u.confirmationId === confirmationId)
        if (update) {
            update.status = 'rejected'
            update.rejectedAt = new Date().toISOString()

            console.log(`Address rejected for row ${update.rowIndex}: ${update.address}`)
        }

        res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/confirmation-success?status=rejected&id=${confirmationId}`)
    } catch (error) {
        console.error('Error rejecting address:', error)
        res.status(500).json({ error: 'Failed to reject address' })
    }
})

// Get address updates since timestamp (for real-time polling)
app.get('/api/address-updates', async (req, res) => {
    try {
        const { since, userId } = req.query as { since?: string, userId?: string }

        if (!userId) {
            return res.status(400).json({ error: 'userId is required' })
        }

        const sinceTime = since ? new Date(parseInt(since, 10)) : new Date(0)
        const addressCollection = collection(db, 'address_records')
        const q = query(addressCollection, where('userId', '==', userId))
        const snapshot = await getDocs(q)

        const updates = snapshot.docs
            .map(docSnap => ({ id: docSnap.id, ...(docSnap.data() as any) }))
            .filter(record => {
                const lastUpdate = record.lastLocationUpdate?.toDate?.() || record.updatedAt?.toDate?.()
                if (!lastUpdate) return false
                return lastUpdate.getTime() > sinceTime.getTime()
            })
            .map(record => {
                const confidenceScore = record.geocodingConfidence === 'high'
                    ? 0.95
                    : record.geocodingConfidence === 'medium'
                        ? 0.7
                        : 0.4

                return {
                    addressId: record.id,
                    rowIndex: record.rowIndex,
                    coordinates: record.coordinates || null,
                    status: record.geocodingConfidence === 'high'
                        ? 'high_confidence'
                        : record.geocodingConfidence === 'medium'
                            ? 'medium_confidence'
                            : 'low_confidence',
                    locationLinkStatus: record.locationLinkStatus || null,
                    locationLinkToken: record.locationLinkToken || null,
                    locationLinkExpiresAt: record.locationLinkExpiresAt?.toDate?.()?.toISOString(),
                    lastLocationUpdate: (record.lastLocationUpdate?.toDate?.() || record.updatedAt?.toDate?.())?.toISOString(),
                    formattedAddress: record.formattedAddress || record.cleanedAddress || '',
                    confidence: confidenceScore,
                    confidenceDescription: record.locationLinkStatus === 'submitted'
                        ? 'Ubicación confirmada por el cliente'
                        : 'Actualización de dirección',
                    locationType: record.locationType || 'USER_CONFIRMED'
                }
            })

        res.json(updates)
    } catch (error) {
        console.error('Error fetching address updates:', error)
        res.status(500).json({ error: 'Failed to fetch address updates' })
    }
})

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`)
})