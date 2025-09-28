import { VercelRequest, VercelResponse } from '@vercel/node'
import dotenv from 'dotenv'
import { randomUUID } from 'crypto'
import { doc, setDoc, collection, serverTimestamp } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { smsService } from '../lib/services/smsService'
import { emailService } from '../lib/services/emailService'
import { runUnifiedProcessingPipeline, PipelineError } from './process-complete'

dotenv.config()

export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key')
    res.setHeader('Access-Control-Max-Age', '86400')

    if (req.method === 'OPTIONS') {
        return res.status(200).end()
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' })
    }

    try {
        const apiKey = req.headers['x-api-key'] as string
        if (!apiKey) {
            return res.status(401).json({ error: 'API key required' })
        }

        const {
            csvData,
            userId,
            options = {}
        } = req.body || {}

        if (!csvData) {
            return res.status(400).json({ error: 'CSV data is required' })
        }

        if (!userId) {
            return res.status(400).json({ error: 'User ID is required' })
        }

        console.log(`[PROCESS] Starting unified pipeline for user ${userId}`)

        const processingStart = Date.now()
        const pipelineResult = await runUnifiedProcessingPipeline(csvData, {
            includeZipCodes: options.includeZipCodes !== false,
            metadata: {
                userId,
                apiKey,
                trigger: 'api/process'
            }
        })
        const processingTime = Date.now() - processingStart
        const pipelineId = pipelineResult.debug?.meta?.pipelineId || 'unknown'
        console.log(`[PROCESS][${pipelineId}] Pipeline completed in ${processingTime}ms, persisting ${pipelineResult.totalProcessed} rows`)

        const geocodedResults = pipelineResult.results

        for (const result of geocodedResults) {
            console.log(`[PROCESS][${pipelineId}] Persisting row ${result.rowIndex}`)
            const recordId = randomUUID()
            await setDoc(doc(collection(db, 'address_records'), recordId), {
                id: recordId,
                userId,
                rowIndex: result.rowIndex,
                original: result.original,
                cleaned: result.cleaned,
                geocoding: result.geocoding,
                zipCode: result.zipCode,
                status: result.status,
                error: result.error || null,
                googleMapsLink: result.googleMapsLink || null,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            })
        }

        const notificationResults = {
            sms: { sent: 0, failed: 0 },
            email: { sent: 0, failed: 0 }
        }

        if (options.sendNotifications !== false) {
            console.log(`[PROCESS][${pipelineId}] Notifications enabled, evaluating recipients`)
            const addressesNeedingConfirmation = geocodedResults
                .filter(r => r.cleaned.phone && r.status !== 'high_confidence')
                .map(r => ({
                    phone: r.cleaned.phone,
                    originalAddress: r.original.address,
                    cleanedAddress: r.cleaned.address,
                    confirmationUrl: `${process.env.FRONTEND_URL || 'https://your-app.vercel.app'}/confirm/${r.rowIndex}`
                }))

            if (addressesNeedingConfirmation.length > 0) {
                try {
                    console.log(`[PROCESS][${pipelineId}] Sending ${addressesNeedingConfirmation.length} SMS confirmations`)
                    const smsResult = await smsService.sendBulkConfirmations(addressesNeedingConfirmation)
                    notificationResults.sms = smsResult
                } catch (error) {
                    console.error('[PROCESS] SMS notification error:', error)
                }
            }

            const addressesWithEmail = geocodedResults
                .filter(r => r.cleaned.email)
                .map(r => r.cleaned.email)

            for (const email of addressesWithEmail) {
                try {
                    console.log(`[PROCESS][${pipelineId}] Sending email to ${email}`)
                    const success = await emailService.sendLocationRequest(
                        email,
                        'Cliente',
                        `${process.env.FRONTEND_URL || 'https://your-app.vercel.app'}/location?email=${email}`
                    )
                    if (success) notificationResults.email.sent++
                    else notificationResults.email.failed++
                } catch (error) {
                    console.error('[PROCESS] Email notification error:', error)
                    notificationResults.email.failed++
                }
            }
        }

        return res.json({
            success: true,
            totalProcessed: pipelineResult.totalProcessed,
            statistics: pipelineResult.statistics,
            notifications: notificationResults,
            results: geocodedResults,
            debug: pipelineResult.debug,
            processingTime,
            timestamp: new Date().toISOString()
        })
    } catch (error: unknown) {
        console.error('[PROCESS] Error:', error)
        if (error instanceof PipelineError) {
            return res.status(error.status).json({ success: false, error: error.message, details: error.details })
        }
        const message = error instanceof Error ? error.message : String(error)
        return res.status(500).json({ success: false, error: 'Processing failed', details: message })
    }
}
