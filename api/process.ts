import { VercelRequest, VercelResponse } from '@vercel/node'
import dotenv from 'dotenv'
import { randomUUID } from 'crypto'
import { doc, setDoc, collection, serverTimestamp } from 'firebase/firestore'
import { db } from '../lib/firebase.js'
import { smsService } from '../lib/services/smsService.js'
import { emailService } from '../lib/services/emailService.js'
import { apiKeyService, type ApiKey } from '../lib/services/apiKeyService.js'
import {
    runUnifiedProcessingPipeline,
    PipelineError,
    type UnifiedProcessingResult
} from './process-complete.js'

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

    const requestStart = Date.now()
    let apiKeyData: ApiKey | null = null
    let requestSize = 0
    let responseSize = 0

    try {
        const apiKey = req.headers['x-api-key'] as string
        if (!apiKey) {
            return res.status(401).json({ error: 'API key required' })
        }

        // Validate API key
        apiKeyData = await apiKeyService.validateApiKey(apiKey)
        if (!apiKeyData) {
            return res.status(401).json({
                error: 'Invalid or expired API key',
                details: 'Please check your API key or contact support if you believe this is an error'
            })
        }

        const {
            csvData,
            userId,
            options = {}
        } = req.body || {}

        requestSize = JSON.stringify(req.body).length

        if (!csvData) {
            return res.status(400).json({ error: 'CSV data is required' })
        }

        if (!userId) {
            return res.status(400).json({ error: 'User ID is required' })
        }

        console.log(`[PROCESS] Starting unified pipeline for user ${userId}`)

        const processingStart = Date.now()
        const pipelineResult: UnifiedProcessingResult = await runUnifiedProcessingPipeline(csvData, {
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
                    phoneNumber: r.cleaned.phone,
                    originalAddress: r.original.address,
                    cleanedAddress: r.cleaned.address,
                    confirmationUrl: `${process.env.FRONTEND_URL || 'https://geonorm-app.vercel.app/'}/confirm/${r.rowIndex}`
                }))

            if (addressesNeedingConfirmation.length > 0) {
                try {
                    console.log(`[PROCESS][${pipelineId}] Sending ${addressesNeedingConfirmation.length} SMS confirmations`)
                    const smsResult = await smsService.sendBulkConfirmations(addressesNeedingConfirmation)
                    notificationResults.sms = {
                        sent: smsResult.successful,
                        failed: smsResult.failed
                    }
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
                        `${process.env.FRONTEND_URL || 'https://geonorm-app.vercel.app/'}/location?email=${email}`
                    )
                    if (success) notificationResults.email.sent++
                    else notificationResults.email.failed++
                } catch (error) {
                    console.error('[PROCESS] Email notification error:', error)
                    notificationResults.email.failed++
                }
            }
        }

        const response = {
            success: true,
            totalProcessed: pipelineResult.totalProcessed,
            statistics: pipelineResult.statistics,
            notifications: notificationResults,
            results: geocodedResults,
            debug: pipelineResult.debug,
            processingTime,
            timestamp: new Date().toISOString()
        }

        responseSize = JSON.stringify(response).length

        // Record API key usage
        if (apiKeyData) {
            await apiKeyService.recordUsage(
                apiKeyData.id,
                apiKeyData.userId,
                '/api/process',
                requestSize,
                responseSize,
                Date.now() - requestStart,
                'success'
            ).catch(err => console.error('Failed to record API usage:', err))
        }

        return res.json(response)
    } catch (error: unknown) {
        console.error('[PROCESS] Error:', error)

        // Record failed API key usage
        if (apiKeyData) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error'
            await apiKeyService.recordUsage(
                apiKeyData.id,
                apiKeyData.userId,
                '/api/process',
                requestSize,
                0,
                Date.now() - requestStart,
                'error',
                errorMessage
            ).catch(err => console.error('Failed to record API usage:', err))
        }

        if (error instanceof PipelineError) {
            return res.status(error.status).json({ success: false, error: error.message, details: error.details })
        }
        const message = error instanceof Error ? error.message : String(error)
        return res.status(500).json({ success: false, error: 'Processing failed', details: message })
    }
}
