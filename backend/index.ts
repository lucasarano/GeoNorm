import dotenv from 'dotenv'

// Load environment variables FIRST
dotenv.config()
dotenv.config({ path: '.env.local' })

import express from 'express'
import cors from 'cors'
import multer from 'multer'
import * as XLSX from 'xlsx'
import { randomUUID } from 'crypto'

const app = express()
const PORT = process.env.PORT || 3001
const upload = multer()

// Debug logging flag and helper
const DEBUG_PIPELINE = process.env.DEBUG_PIPELINE === '1' || process.env.DEBUG === '1'
function debugLog(message: string, details?: any, reqId?: string) {
    if (!DEBUG_PIPELINE) return
    const prefix = reqId ? `[${reqId}]` : ''
    if (details === undefined) {
        console.log(prefix, message)
    } else {
        try {
            console.log(prefix, message, JSON.stringify(details))
        } catch {
            console.log(prefix, message, details)
        }
    }
}

// Enable CORS
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

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'OK', message: 'GeoNorm API Server is running' })
})

// Simple CSV parsing utility
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

// XLSX to CSV conversion
app.post('/api/xlsx-to-csv', upload.single('file'), async (req, res) => {
    try {
        const reqId = randomUUID()
        debugLog('XLSX->CSV: request received', { size: req.file?.size }, reqId)
        
        const fileBuffer = req.file?.buffer
        if (!fileBuffer) {
            return res.status(400).json({ error: 'No file uploaded' })
        }

        const workbook = XLSX.read(fileBuffer, { type: 'buffer' })
        const sheetName = workbook.SheetNames[0]
        if (!sheetName) {
            return res.status(400).json({ error: 'No sheets found in workbook' })
        }
        
        const worksheet = workbook.Sheets[sheetName]
        debugLog('XLSX->CSV: converting sheet', { sheetName }, reqId)
        const csv = XLSX.utils.sheet_to_csv(worksheet, { FS: ',', RS: '\n' })

        res.setHeader('Content-Type', 'text/csv; charset=utf-8')
        debugLog('XLSX->CSV: sending CSV response', { bytes: csv.length }, reqId)
        res.send(csv.endsWith('\n') ? csv : csv + '\n')
    } catch (error: any) {
        console.error('[XLSX_TO_CSV] Error:', error)
        res.status(500).json({ error: 'Failed to convert XLSX to CSV', details: error?.message })
    }
})

// Simplified streaming endpoint that delegates to the Vercel API
app.post('/api/process-complete-stream', express.raw({ type: 'text/csv', limit: '10mb' }), async (req, res) => {
    const reqId = randomUUID()
    const csvData = req.body.toString('utf-8')

    if (!csvData) {
        return res.status(400).json({ error: 'CSV data is required' })
    }

    // Set SSE headers
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
    })

    const sendEvent = (event: string, data: any) => {
        res.write(`event: ${event}\n`)
        res.write(`data: ${JSON.stringify(data)}\n\n`)
    }

    try {
        debugLog('STREAM: delegating to Vercel API', { bytes: csvData.length }, reqId)
        
        sendEvent('status', { phase: 'cleaning', message: 'Starting processing...', progress: 0 })

        // Call the existing Vercel API endpoint  
        const response = await fetch(`http://localhost:${PORT}/api/process-complete`, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/csv',
            },
            body: csvData,
        })

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`)
        }

        const result = await response.json()
        
        if (result.success && result.results) {
            sendEvent('status', { phase: 'geocoding', message: 'Processing addresses...', progress: 50, totalRows: result.results.length })
            
            // Send results one by one with artificial delay for demo
            for (let i = 0; i < result.results.length; i++) {
                const row = result.results[i]
                const progress = Math.round(((i + 1) / result.results.length) * 100)
                
                sendEvent('row_start', { rowIndex: i, address: row.cleaned.address, timestamp: Date.now() })
                
                // Artificial delay to show streaming effect
                await new Promise(resolve => setTimeout(resolve, 100))
                
                sendEvent('row_complete', { 
                    row, 
                    duration: 100, 
                    progress,
                    stats: { 
                        highConfidence: result.statistics.highConfidence,
                        mediumConfidence: result.statistics.mediumConfidence, 
                        lowConfidence: result.statistics.lowConfidence,
                        total: i + 1
                    }
                })
            }

            sendEvent('complete', {
                totalProcessed: result.totalProcessed,
                statistics: result.statistics
            })
        } else {
            throw new Error('Processing failed')
        }

        res.end()

    } catch (error: any) {
        console.error('[STREAM] Error:', error)
        sendEvent('error', { error: error.message || 'Processing failed' })
        res.end()
    }
})

// Streaming XLSX endpoint
app.post('/api/process-complete-xlsx-stream', upload.single('file'), async (req, res) => {
    try {
        const reqId = randomUUID()
        const fileBuffer = req.file?.buffer
        
        if (!fileBuffer) {
            return res.status(400).json({ error: 'No file uploaded' })
        }

        // Convert XLSX to CSV
        const workbook = XLSX.read(fileBuffer, { type: 'buffer' })
        const sheetName = workbook.SheetNames[0]
        if (!sheetName) {
            return res.status(400).json({ error: 'No sheets found in workbook' })
        }
        
        const worksheet = workbook.Sheets[sheetName]
        const csvData = XLSX.utils.sheet_to_csv(worksheet, { FS: ',', RS: '\n' })
        
        debugLog('XLSX_STREAM: converted to CSV', { bytes: csvData.length }, reqId)

        // Set SSE headers
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Cache-Control'
        })

        const sendEvent = (event: string, data: any) => {
            res.write(`event: ${event}\n`)
            res.write(`data: ${JSON.stringify(data)}\n\n`)
        }

        sendEvent('status', { phase: 'cleaning', message: 'Processing Excel file...', progress: 0 })

        // Call the existing Vercel API endpoint with the converted CSV
        const response = await fetch(`http://localhost:${PORT}/api/process-complete`, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/csv',
            },
            body: csvData,
        })

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`)
        }

        const result = await response.json()
        
        if (result.success && result.results) {
            sendEvent('status', { phase: 'geocoding', message: 'Processing addresses...', progress: 50, totalRows: result.results.length })
            
            // Send results one by one with artificial delay for demo
            for (let i = 0; i < result.results.length; i++) {
                const row = result.results[i]
                const progress = Math.round(((i + 1) / result.results.length) * 100)
                
                sendEvent('row_start', { rowIndex: i, address: row.cleaned.address, timestamp: Date.now() })
                
                // Artificial delay to show streaming effect
                await new Promise(resolve => setTimeout(resolve, 100))
                
                sendEvent('row_complete', { 
                    row, 
                    duration: 100, 
                    progress,
                    stats: { 
                        highConfidence: result.statistics.highConfidence,
                        mediumConfidence: result.statistics.mediumConfidence, 
                        lowConfidence: result.statistics.lowConfidence,
                        total: i + 1
                    }
                })
            }

            sendEvent('complete', {
                totalProcessed: result.totalProcessed,
                statistics: result.statistics
            })
        } else {
            throw new Error('Processing failed')
        }

        res.end()

    } catch (error: any) {
        console.error('[XLSX_STREAM] Error:', error)
        res.status(500).json({ error: 'Failed to process XLSX file', details: error?.message })
    }
})

app.listen(PORT, () => {
    console.log(`GeoNorm Express Server running on http://localhost:${PORT}`)
    console.log('Available endpoints:')
    console.log('  GET  /health')
    console.log('  POST /api/xlsx-to-csv')
    console.log('  POST /api/process-complete-stream')
    console.log('  POST /api/process-complete-xlsx-stream')
})
