import dotenv from 'dotenv'

// Load environment variables FIRST
dotenv.config()

import express from 'express'
import cors from 'cors'
import multer from 'multer'
import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs'
import { v4 as uuidv4 } from 'uuid'
import { fileURLToPath } from 'url'
import { RequestWithTaskId, ProcessingTask } from './types.js'
import whatsappService from './services/whatsappService.js'
import { cleanParaguayAddresses } from './cleanParaguayAddresses.js'

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3001

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../data/uploads')
const outputsDir = path.join(__dirname, '../data/outputs')

if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true })
}
if (!fs.existsSync(outputsDir)) {
    fs.mkdirSync(outputsDir, { recursive: true })
}

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir)
    },
    filename: (req: RequestWithTaskId, file, cb) => {
        const taskId = uuidv4()
        req.taskId = taskId
        cb(null, `${taskId}-${file.originalname}`)
    }
})

const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
            cb(null, true)
        } else {
            cb(new Error('Only CSV files are allowed'))
        }
    },
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
})

// Store processing tasks
const processingTasks = new Map<string, ProcessingTask>()

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

// Google Maps Geocoding API endpoint
app.get('/api/geocoding', async (req, res) => {
    try {
        const { address, components } = req.query
        const apiKey = process.env.VITE_GOOGLE_MAPS_API_KEY

        console.log(`[GEOCODING] Request for address: ${address}`)
        if (components) {
            console.log(`[GEOCODING] Components: ${components}`)
        }

        if (!address) {
            return res.status(400).json({ error: 'Address parameter is required' })
        }

        if (!apiKey) {
            console.error('[GEOCODING] API key not configured')
            return res.status(500).json({ error: 'Google Maps API key not configured' })
        }

        // Build URL with optional components parameter
        let url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
            address as string
        )}&key=${apiKey}`

        if (components) {
            url += `&components=${encodeURIComponent(components as string)}`
        }

        console.log(`[GEOCODING] Calling Google API: ${url}`)
        const response = await fetch(url)

        if (!response.ok) {
            throw new Error(`Google API returned ${response.status}: ${response.statusText}`)
        }

        const data = await response.json()
        console.log(`[GEOCODING] Success: ${data.status}, ${data.results?.length || 0} results`)
        res.json(data)
    } catch (error) {
        console.error('[GEOCODING] Error:', error)
        res.status(500).json({ error: 'Failed to fetch geocoding data' })
    }
})

// Google Places API endpoint
app.get('/api/places', async (req, res) => {
    try {
        const { input } = req.query
        const apiKey = process.env.VITE_GOOGLE_MAPS_API_KEY

        console.log(`[PLACES] Request for input: ${input}`)

        if (!input) {
            return res.status(400).json({ error: 'Input parameter is required' })
        }

        if (!apiKey) {
            console.error('[PLACES] API key not configured')
            return res.status(500).json({ error: 'Google Maps API key not configured' })
        }

        const url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(
            input as string
        )}&inputtype=textquery&fields=formatted_address,geometry,name,place_id,rating,types&key=${apiKey}`

        console.log(`[PLACES] Calling Google API...`)
        const response = await fetch(url)

        if (!response.ok) {
            throw new Error(`Google API returned ${response.status}: ${response.statusText}`)
        }

        const data = await response.json()
        console.log(`[PLACES] Success: ${data.status}, ${data.candidates?.length || 0} candidates`)
        res.json(data)
    } catch (error) {
        console.error('[PLACES] Error:', error)
        res.status(500).json({ error: 'Failed to fetch places data' })
    }
})

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
    } catch (error) {
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
        }).filter(row => row.address || row.city || row.state || row.phone) // Filter out empty rows

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

        // Use the improved cleaning function
        const cleanedCsv = await cleanParaguayAddresses(apiKey, csvData)

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

        const cleaned = dataLines.map((line, index) => {
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

// CSV Upload and Processing endpoint
app.post('/api/process-csv', upload.single('csvFile'), async (req: RequestWithTaskId, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No CSV file uploaded' })
        }

        const taskId = req.taskId || uuidv4()
        const inputPath = req.file.path
        const outputPath = path.join(outputsDir, `${taskId}-processed.json`)

        console.log(`[CSV] Starting processing task ${taskId}`)
        console.log(`[CSV] Input file: ${inputPath}`)
        console.log(`[CSV] Output file: ${outputPath}`)
        console.log(`[CSV] Processing mode: Address normalization only (no geocoding)`)

        // Initialize task status
        processingTasks.set(taskId, {
            status: 'processing',
            progress: 0,
            message: 'Starting CSV processing...',
            inputFile: inputPath,
            outputFile: outputPath,
            timestamp: Date.now()
        })

        // Start Python processing in background
        const pythonScript = path.join(__dirname, '../scripts/csv_parallel_processor.py')
        const pythonExecutable = path.join(__dirname, '../venv/bin/python3')
        const pythonProcess = spawn(pythonExecutable, ['-u', pythonScript, inputPath, outputPath, taskId], {
            cwd: path.join(__dirname, '..'),
            stdio: ['pipe', 'pipe', 'pipe'],
            env: {
                ...process.env,
                // Tune parallelism and batching for performance; override via env if needed
                MAX_WORKERS: process.env.CSV_MAX_WORKERS || '6',
                BATCH_SIZE: process.env.CSV_BATCH_SIZE || '20'
            }
        })

        // Handle Python script output and parse progress
        pythonProcess.stdout.on('data', (data) => {
            const output = data.toString()
            console.log(`[CSV-${taskId}] ${output}`)

            // Parse different types of updates from Python script
            const progressMatch = output.match(/PROGRESS:(\d+):(\d+):(.+)/)
            const realtimeMatch = output.match(/REAL_TIME_UPDATE:(\d+):(.+)/)
            const rowCompletedMatch = output.match(/ROW_COMPLETED:(\d+):(.+)/)
            const batchCompletedMatch = output.match(/BATCH_COMPLETED:(\d+):(\d+):(.+)/)

            if (progressMatch) {
                const [, currentBatch, totalBatches, message] = progressMatch
                const progress = Math.round((parseInt(currentBatch) / parseInt(totalBatches)) * 100)

                const task = processingTasks.get(taskId)
                if (task) {
                    processingTasks.set(taskId, {
                        ...task,
                        progress,
                        message: message.trim(),
                        currentBatch: parseInt(currentBatch),
                        totalBatches: parseInt(totalBatches)
                    })
                    console.log(`[CSV-${taskId}] Progress updated: ${progress}% (${currentBatch}/${totalBatches})`)
                }
            } else if (realtimeMatch) {
                const [, rowIndex, message] = realtimeMatch
                console.log(`[CSV-${taskId}] Row ${parseInt(rowIndex) + 1}: ${message.trim()}`)
            } else if (rowCompletedMatch) {
                const [, rowIndex, message] = rowCompletedMatch
                console.log(`[CSV-${taskId}] ✅ ${message.trim()}`)
            } else if (batchCompletedMatch) {
                const [, currentBatch, totalBatches, message] = batchCompletedMatch
                console.log(`[CSV-${taskId}] 🎉 ${message.trim()}`)
            }
        })

        pythonProcess.stderr.on('data', (data) => {
            const errorMsg = data.toString()
            console.error(`[CSV-${taskId}] Error: ${errorMsg}`)

            // Update task with error if it's a critical error
            if (errorMsg.includes('Error:') || errorMsg.includes('Exception:') || errorMsg.includes('Traceback')) {
                const task = processingTasks.get(taskId)
                if (task) {
                    processingTasks.set(taskId, {
                        ...task,
                        status: 'error',
                        progress: 0,
                        message: `Python error: ${errorMsg.slice(0, 200)}...`
                    })
                }
            }
        })

        pythonProcess.on('close', (code) => {
            console.log(`[CSV-${taskId}] Python process closed with code: ${code}`)
            const task = processingTasks.get(taskId)
            if (!task) {
                console.log(`[CSV-${taskId}] Task not found in processing tasks!`)
                return
            }

            if (code === 0) {
                console.log(`[CSV-${taskId}] Setting task status to completed`)
                processingTasks.set(taskId, {
                    ...task,
                    status: 'completed',
                    progress: 100,
                    message: 'JSON processing completed successfully',
                    downloadUrl: `/api/download/${taskId}`
                })
                console.log(`[CSV-${taskId}] Processing completed successfully`)
            } else {
                processingTasks.set(taskId, {
                    ...task,
                    status: 'error',
                    progress: 0,
                    message: `Processing failed with code ${code}`
                })
                console.error(`[CSV-${taskId}] Processing failed with code ${code}`)
            }
        })

        res.json({
            taskId,
            message: 'CSV upload successful. Processing started.',
            status: 'processing'
        })

    } catch (error) {
        console.error('[CSV] Upload error:', error)
        res.status(500).json({ error: 'Failed to process CSV file' })
    }
})

// Progress check endpoint
app.get('/api/progress/:taskId', (req, res) => {
    const { taskId } = req.params
    const task = processingTasks.get(taskId)

    console.log(`[PROGRESS] Request for task ${taskId}, found: ${!!task}`)
    if (task) {
        console.log(`[PROGRESS] Task status: ${task.status}, progress: ${task.progress}`)
    }

    if (!task) {
        console.log(`[PROGRESS] Task ${taskId} not found in processing tasks`)
        return res.status(404).json({
            status: 'error',
            progress: 0,
            message: 'Task not found'
        })
    }

    // If the Python process already produced the output file and progress is 100,
    // mark the task as completed to avoid getting stuck in 'processing'.
    try {
        if (task.status === 'processing' && task.progress === 100 && fs.existsSync(task.outputFile)) {
            const updated: ProcessingTask = {
                ...task,
                status: 'completed',
                progress: 100,
                message: 'Processing completed successfully',
                downloadUrl: `/api/download/${taskId}`
            }
            processingTasks.set(taskId, updated)
            return res.json(updated)
        }
    } catch (e) {
        console.error(`[PROGRESS] Auto-complete check failed for ${taskId}:`, e)
    }

    res.json(task)
})

// Inline view of processed CSV
app.get('/api/results/:taskId', (req, res) => {
    const { taskId } = req.params
    const task = processingTasks.get(taskId)

    if (!task || task.status !== 'completed') {
        return res.status(404).json({ error: 'Results not ready' })
    }

    const outputFile = task.outputFile
    if (!fs.existsSync(outputFile)) {
        return res.status(404).json({ error: 'Output file not found' })
    }

    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    const stream = fs.createReadStream(outputFile)
    stream.pipe(res)
})

// Preview CSV endpoint - shows first few rows of uploaded CSV
app.get('/api/preview/:taskId', (req, res) => {
    const { taskId } = req.params
    const task = processingTasks.get(taskId)

    if (!task) {
        return res.status(404).json({ error: 'Task not found' })
    }

    const inputFile = task.inputFile
    if (!fs.existsSync(inputFile)) {
        return res.status(404).json({ error: 'Input file not found' })
    }

    try {
        const fileContent = fs.readFileSync(inputFile, 'utf-8')
        const lines = fileContent.split('\n').slice(0, 6) // Header + first 5 rows
        const previewCsv = lines.join('\n')

        res.json({
            preview: previewCsv,
            totalLines: fileContent.split('\n').length - 1, // -1 for header
            fileName: path.basename(inputFile)
        })
    } catch (error) {
        console.error('Error reading CSV for preview:', error)
        res.status(500).json({ error: 'Failed to read CSV file' })
    }
})

// Download processed CSV endpoint
app.get('/api/download/:taskId', (req, res) => {
    const { taskId } = req.params
    const task = processingTasks.get(taskId)

    if (!task || task.status !== 'completed') {
        return res.status(404).json({ error: 'File not ready for download' })
    }

    const outputFile = task.outputFile

    if (!fs.existsSync(outputFile)) {
        return res.status(404).json({ error: 'Output file not found' })
    }

    res.download(outputFile, `processed-addresses-${taskId}.json`, (err) => {
        if (err) {
            console.error(`[DOWNLOAD] Error: ${err}`)
            res.status(500).json({ error: 'Failed to download file' })
        }
    })
})

// WhatsApp endpoints
app.post('/api/whatsapp/send-corrections', async (req, res) => {
    try {
        const { addresses } = req.body

        if (!Array.isArray(addresses)) {
            return res.status(400).json({ error: 'Addresses must be an array' })
        }

        if (!whatsappService.isConfigured()) {
            return res.status(500).json({ error: 'WhatsApp service not configured' })
        }

        const result = await whatsappService.sendBulkAddressCorrections(addresses)

        res.json({
            success: true,
            sent: result.sent,
            failed: result.failed,
            total: addresses.length
        })

    } catch (error: any) {
        console.error('[WHATSAPP] Error sending corrections:', error)
        res.status(500).json({ error: 'Failed to send WhatsApp messages' })
    }
})

// WhatsApp webhook for receiving messages
app.get('/api/whatsapp/webhook', (req, res) => {
    const mode = req.query['hub.mode']
    const token = req.query['hub.verify_token']
    const challenge = req.query['hub.challenge']

    const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN

    if (mode && token) {
        if (mode === 'subscribe' && token === verifyToken) {
            console.log('[WHATSAPP] Webhook verified')
            res.status(200).send(challenge)
        } else {
            res.sendStatus(403)
        }
    } else {
        res.sendStatus(400)
    }
})

// Store for address corrections
const addressCorrections = new Map<string, any>()

app.post('/api/whatsapp/webhook', (req, res) => {
    try {
        const body = req.body

        if (body.object === 'whatsapp_business_account') {
            body.entry?.forEach((entry: any) => {
                entry.changes?.forEach((change: any) => {
                    if (change.field === 'messages') {
                        const messages = change.value.messages

                        messages?.forEach((message: any) => {
                            if (message.type === 'text') {
                                const from = message.from
                                const text = message.text.body
                                const timestamp = new Date().toISOString()

                                console.log(`[WHATSAPP] Received message from ${from}: ${text}`)

                                // Store the correction
                                addressCorrections.set(from, {
                                    phone: from,
                                    correctedAddress: text,
                                    timestamp,
                                    processed: false
                                })

                                console.log(`[WHATSAPP] Stored address correction for ${from}`)
                            }
                        })
                    }
                })
            })
        }

        res.status(200).send('OK')

    } catch (error: any) {
        console.error('[WHATSAPP] Webhook error:', error)
        res.status(500).send('Error')
    }
})

// Get pending address corrections
app.get('/api/whatsapp/corrections', (req, res) => {
    const corrections = Array.from(addressCorrections.entries()).map(([phone, data]) => ({
        phone,
        ...data
    }))

    res.json(corrections)
})

// Mark correction as processed
app.post('/api/whatsapp/corrections/:phone/processed', (req, res) => {
    const phone = req.params.phone
    const correction = addressCorrections.get(phone)

    if (correction) {
        correction.processed = true
        addressCorrections.set(phone, correction)
        res.json({ success: true })
    } else {
        res.status(404).json({ error: 'Correction not found' })
    }
})

// Cleanup old files (run every hour)
setInterval(() => {
    const oneHourAgo = Date.now() - (60 * 60 * 1000)

    for (const [taskId, task] of processingTasks.entries()) {
        if (task.timestamp < oneHourAgo) {
            // Clean up old files
            try {
                if (fs.existsSync(task.inputFile)) {
                    fs.unlinkSync(task.inputFile)
                }
                if (fs.existsSync(task.outputFile)) {
                    fs.unlinkSync(task.outputFile)
                }
                processingTasks.delete(taskId)
                console.log(`[CLEANUP] Removed old task ${taskId}`)
            } catch (error) {
                console.error(`[CLEANUP] Error removing task ${taskId}:`, error)
            }
        }
    }
}, 60 * 60 * 1000) // Run every hour

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`)
    console.log(`Uploads directory: ${uploadsDir}`)
    console.log(`Outputs directory: ${outputsDir}`)
})