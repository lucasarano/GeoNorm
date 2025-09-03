import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import multer from 'multer'
import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs'
import { v4 as uuidv4 } from 'uuid'
import { fileURLToPath } from 'url'
import { RequestWithTaskId, ProcessingTask } from './types'
import WhatsAppService from './whatsapp'
import AddressProcessor, { AddressRecord } from './addressProcessor'

dotenv.config()

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3001

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../uploads')
const outputsDir = path.join(__dirname, '../outputs')

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

// Initialize WhatsApp and Address Processor services
const whatsappService = new WhatsAppService()
const addressProcessor = new AddressProcessor()

// Store address records for WhatsApp follow-up
const addressRecords = new Map<string, AddressRecord>()

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

        if (!originalAddress && !cleanedAddress) {
            return res.status(400).json({ error: 'At least one address must be provided' })
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
            if (!address) return null
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
        const [orig, clean] = await Promise.all([
            geocode(originalAddress, undefined),
            geocode(cleanedAddress, componentsStr)
        ])

        // Decide chosen result
        let chosen: 'cleaned' | 'original' | null = null
        if (clean?.best && orig?.best) {
            chosen = clean.best.confidence_score >= orig.best.confidence_score ? 'cleaned' : 'original'
        } else if (clean?.best) {
            chosen = 'cleaned'
        } else if (orig?.best) {
            chosen = 'original'
        } else {
            chosen = null
        }

        const lat = chosen === 'cleaned' ? clean?.best?.latitude : chosen === 'original' ? orig?.best?.latitude : undefined
        const lng = chosen === 'cleaned' ? clean?.best?.longitude : chosen === 'original' ? orig?.best?.longitude : undefined

        const staticMapPath = lat != null && lng != null
            ? `/api/staticmap?lat=${lat}&lng=${lng}&zoom=14&size=600x300`
            : null

        res.json({
            original: orig,
            cleaned: { ...(clean || {}), usedComponents: componentsStr },
            chosen,
            staticMapUrl: staticMapPath
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
        const pythonScript = path.join(__dirname, '../csv_parallel_processor.py')
        const pythonProcess = spawn('python', ['-u', pythonScript, inputPath, outputPath, taskId], {
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

// WhatsApp Business API Endpoints

// Send low confidence messages endpoint
app.post('/api/whatsapp/send-low-confidence', async (req, res) => {
    try {
        const { addresses } = req.body
        
        if (!Array.isArray(addresses)) {
            return res.status(400).json({ error: 'Addresses array is required' })
        }

        console.log(`[WHATSAPP] Processing ${addresses.length} addresses for low confidence check`)
        
        const results = []
        let sentCount = 0
        let errorCount = 0

        for (const addr of addresses) {
            const { phoneNumber, originalAddress, cleanedAddress, confidence } = addr
            
            if (confidence < 0.6) {
                try {
                    // Store address record
                    const record: AddressRecord = {
                        id: uuidv4(),
                        phoneNumber,
                        originalAddress,
                        cleanedAddress,
                        confidence,
                        status: 'low_confidence',
                        timestamp: new Date()
                    }
                    
                    addressRecords.set(record.id, record)
                    
                    // Send WhatsApp message
                    const messageResult = await whatsappService.sendLowConfidenceAddressMessage(
                        phoneNumber,
                        cleanedAddress || originalAddress,
                        originalAddress
                    )
                    
                    record.whatsappMessageId = messageResult.messages?.[0]?.id
                    
                    results.push({
                        phoneNumber,
                        status: 'sent',
                        messageId: record.whatsappMessageId,
                        recordId: record.id
                    })
                    
                    sentCount++
                    console.log(`[WHATSAPP] Sent message to ${phoneNumber}`)
                    
                    // Small delay to respect rate limits
                    await new Promise(resolve => setTimeout(resolve, 200))
                    
                } catch (error) {
                    console.error(`[WHATSAPP] Error sending to ${phoneNumber}:`, error)
                    results.push({
                        phoneNumber,
                        status: 'error',
                        error: error.message
                    })
                    errorCount++
                }
            } else {
                results.push({
                    phoneNumber,
                    status: 'skipped',
                    reason: 'confidence_above_threshold'
                })
            }
        }

        res.json({
            summary: {
                total: addresses.length,
                sent: sentCount,
                errors: errorCount,
                skipped: addresses.length - sentCount - errorCount
            },
            results
        })

    } catch (error) {
        console.error('[WHATSAPP] Send low confidence error:', error)
        res.status(500).json({ error: 'Failed to send WhatsApp messages' })
    }
})

// WhatsApp webhook endpoint
app.get('/api/whatsapp/webhook', (req, res) => {
    // Webhook verification
    const mode = req.query['hub.mode']
    const token = req.query['hub.verify_token']
    const challenge = req.query['hub.challenge']

    if (mode && token) {
        if (mode === 'subscribe' && token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
            console.log('[WHATSAPP] Webhook verified')
            res.status(200).send(challenge)
        } else {
            res.status(403).send('Forbidden')
        }
    } else {
        res.status(400).send('Bad Request')
    }
})

app.post('/api/whatsapp/webhook', async (req, res) => {
    try {
        const { entry } = req.body

        if (!entry || !Array.isArray(entry)) {
            return res.status(200).send('OK')
        }

        for (const entryItem of entry) {
            const changes = entryItem.changes || []
            
            for (const change of changes) {
                if (change.field === 'messages') {
                    const messages = change.value.messages || []
                    
                    for (const message of messages) {
                        await handleWhatsAppMessage(message)
                    }
                }
            }
        }

        res.status(200).send('OK')
        
    } catch (error) {
        console.error('[WHATSAPP] Webhook error:', error)
        res.status(500).json({ error: 'Webhook processing failed' })
    }
})

// Handle incoming WhatsApp messages
async function handleWhatsAppMessage(message: any) {
    const phoneNumber = message.from
    const messageType = message.type

    console.log(`[WHATSAPP] Received ${messageType} message from ${phoneNumber}`)

    try {
        // Find the address record for this phone number
        const record = Array.from(addressRecords.values())
            .find(r => r.phoneNumber.includes(phoneNumber.replace('+', '')) || phoneNumber.includes(r.phoneNumber.replace('+', '')))

        if (!record) {
            console.log(`[WHATSAPP] No address record found for ${phoneNumber}`)
            return
        }

        if (messageType === 'interactive') {
            const buttonReply = message.interactive?.button_reply
            
            if (buttonReply) {
                const buttonId = buttonReply.id
                
                switch (buttonId) {
                    case 'USE_CLEANED':
                        record.status = 'confirmed'
                        console.log(`[WHATSAPP] ${phoneNumber} confirmed cleaned address`)
                        
                        // Send confirmation
                        await whatsappService.sendFollowUpMessage(phoneNumber)
                        break
                        
                    case 'SHARE_LOCATION':
                        // User will send location next
                        console.log(`[WHATSAPP] ${phoneNumber} will share location`)
                        break
                        
                    case 'EDIT_ADDRESS':
                        // User will send new address text
                        console.log(`[WHATSAPP] ${phoneNumber} will edit address`)
                        break
                }
            }
        } else if (messageType === 'location') {
            const location = message.location
            if (location && record) {
                record.latitude = location.latitude
                record.longitude = location.longitude
                record.status = 'resolved'
                
                console.log(`[WHATSAPP] ${phoneNumber} shared location: ${location.latitude}, ${location.longitude}`)
                
                // Send confirmation
                await whatsappService.sendFollowUpMessage(phoneNumber)
            }
        } else if (messageType === 'text') {
            const newAddress = message.text?.body
            if (newAddress && record) {
                record.cleanedAddress = newAddress
                record.status = 'resolved'
                
                console.log(`[WHATSAPP] ${phoneNumber} provided new address: ${newAddress}`)
                
                // Optionally re-geocode the new address here
                
                // Send confirmation
                await whatsappService.sendFollowUpMessage(phoneNumber)
            }
        }

        // Update the record
        addressRecords.set(record.id, record)
        
    } catch (error) {
        console.error(`[WHATSAPP] Error handling message from ${phoneNumber}:`, error)
    }
}

// Get address records status
app.get('/api/whatsapp/records', (req, res) => {
    const records = Array.from(addressRecords.values())
    const summary = addressProcessor.getProcessingSummary(records)
    
    res.json({
        summary,
        records: records.slice(0, 50) // Limit to first 50 for performance
    })
})

// Test WhatsApp configuration
app.get('/api/whatsapp/test', async (req, res) => {
    try {
        const testNumber = req.query.number as string
        
        if (!testNumber) {
            return res.status(400).json({ error: 'Phone number is required' })
        }

        const result = await whatsappService.sendFollowUpMessage(testNumber)
        
        res.json({
            success: true,
            message: 'Test message sent successfully',
            result
        })
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        })
    }
})

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`)
    console.log(`Uploads directory: ${uploadsDir}`)
    console.log(`Outputs directory: ${outputsDir}`)
    console.log(`WhatsApp webhook: http://localhost:${PORT}/api/whatsapp/webhook`)
})