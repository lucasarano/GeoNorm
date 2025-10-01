import { VercelRequest, VercelResponse } from '@vercel/node'
import dotenv from 'dotenv'
import zipCodeService from '../backend/services/zipCodeService.js'
import { apiKeyService, type ApiKey } from '../lib/services/apiKeyService.js'

dotenv.config()

type Coordinates = {
    latitude: number
    longitude: number
}

type GeocodeSelection = {
    formattedAddress: string
    coordinates: Coordinates
    locationType: string
    confidence: number
    confidenceDescription: string
}

const CONFIDENCE_MAP: Record<string, number> = {
    ROOFTOP: 1.0,
    RANGE_INTERPOLATED: 0.8,
    GEOMETRIC_CENTER: 0.6,
    APPROXIMATE: 0.4
}

const CONFIDENCE_DESCRIPTION: Record<string, string> = {
    ROOFTOP: 'Most precise - exact address match',
    RANGE_INTERPOLATED: 'High precision - interpolated within address range',
    GEOMETRIC_CENTER: 'Medium precision - center of building/area',
    APPROXIMATE: 'Low precision - approximate location'
}

const PROCESS_ENDPOINT = '/api/process'

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
        const apiKey = req.headers['x-api-key'] as string | undefined
        if (!apiKey) {
            return res.status(401).json({ error: 'API key required' })
        }

        apiKeyData = await apiKeyService.validateApiKey(apiKey)
        if (!apiKeyData) {
            return res.status(401).json({
                error: 'Invalid or expired API key'
            })
        }

        requestSize = getPayloadSize(req.body)

        const address = extractAddress(req.body)
        if (!address) {
            const errorPayload = {
                error: 'Address is required',
                details: 'Provide the address string in the request body or as the "address" property of a JSON object'
            }
            responseSize = JSON.stringify(errorPayload).length
            await recordUsage(apiKeyData, requestSize, responseSize, requestStart, 'error', 'Address is required')
            return res.status(400).json(errorPayload)
        }

        const geocodeResult = await geocodeAddress(address)
        if (!geocodeResult.success) {
            const errorPayload = {
                error: geocodeResult.error,
                details: geocodeResult.details
            }
            responseSize = JSON.stringify(errorPayload).length
            await recordUsage(apiKeyData, requestSize, responseSize, requestStart, 'error', geocodeResult.error)
            return res.status(geocodeResult.statusCode).json(errorPayload)
        }

        const { selection } = geocodeResult
        const zipInfo = await lookupZip(selection.coordinates)

        const responsePayload = {
            success: true,
            userId: apiKeyData.userId,
            originalAddress: address,
            cleanedAddress: selection.formattedAddress,
            coordinates: selection.coordinates,
            zipCode: zipInfo?.zipCode ?? null,
            zipCodeDetails: zipInfo,
            confidence: selection.confidence,
            confidenceDescription: selection.confidenceDescription,
            locationType: selection.locationType,
            timestamp: new Date().toISOString()
        }

        responseSize = JSON.stringify(responsePayload).length

        await recordUsage(apiKeyData, requestSize, responseSize, requestStart, 'success')

        return res.status(200).json(responsePayload)
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        console.error('[PROCESS_API] Error:', error)

        if (apiKeyData) {
            await recordUsage(apiKeyData, requestSize, responseSize, requestStart, 'error', message)
        }

        return res.status(500).json({ success: false, error: 'Processing failed', details: message })
    }
}

function extractAddress(body: unknown): string | null {
    if (!body) return null

    if (typeof body === 'string') {
        const trimmed = body.trim()
        return trimmed.length > 0 ? trimmed : null
    }

    if (typeof body === 'object') {
        const record = body as Record<string, unknown>
        if (typeof record.address === 'string' && record.address.trim().length > 0) {
            return record.address.trim()
        }
        if (typeof record.input === 'string' && record.input.trim().length > 0) {
            return record.input.trim()
        }
    }

    return null
}

async function geocodeAddress(address: string): Promise<
    |
        {
            success: true
            selection: GeocodeSelection
        }
    |
        {
            success: false
            statusCode: number
            error: string
            details?: string
        }
> {
    const mapsApiKey = process.env.VITE_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY
    if (!mapsApiKey) {
        return {
            success: false,
            statusCode: 500,
            error: 'Google Maps API key not configured'
        }
    }

    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${mapsApiKey}`

    const response = await fetch(url)
    if (!response.ok) {
        return {
            success: false,
            statusCode: 502,
            error: 'Failed to reach geocoding service',
            details: `HTTP ${response.status}`
        }
    }

    const data = await response.json() as {
        status: string
        results?: any[]
        error_message?: string
    }

    if (data.status !== 'OK' || !Array.isArray(data.results) || data.results.length === 0) {
        const status = data.status || 'UNKNOWN_ERROR'
        const statusCode = status === 'ZERO_RESULTS' ? 404 : 502
        return {
            success: false,
            statusCode,
            error: 'Unable to find a matching location',
            details: data.error_message || status
        }
    }

    const selection = pickBestResult(data.results)
    if (!selection) {
        return {
            success: false,
            statusCode: 422,
            error: 'Unable to extract coordinates from geocoding result'
        }
    }

    return {
        success: true,
        selection
    }
}

function pickBestResult(results: any[]): GeocodeSelection | null {
    let best: GeocodeSelection | null = null

    for (const result of results) {
        const locationType = result?.geometry?.location_type
        const location = result?.geometry?.location
        if (typeof location?.lat !== 'number' || typeof location?.lng !== 'number') {
            continue
        }

        const confidence = CONFIDENCE_MAP[locationType] ?? 0.5
        const formattedAddress = typeof result.formatted_address === 'string'
            ? result.formatted_address
            : `${location.lat}, ${location.lng}`

        if (!best || confidence > best.confidence) {
            best = {
                formattedAddress,
                coordinates: {
                    latitude: location.lat,
                    longitude: location.lng
                },
                locationType: locationType || 'UNKNOWN',
                confidence,
                confidenceDescription: CONFIDENCE_DESCRIPTION[locationType] || 'Unknown precision'
            }
        }
    }

    return best
}

async function lookupZip(coords: Coordinates) {
    try {
        if (coords.latitude == null || coords.longitude == null) {
            return null
        }
        return await zipCodeService.getZipCode(coords.latitude, coords.longitude)
    } catch (error) {
        console.error('[PROCESS_API] Zip code lookup failed:', error)
        return null
    }
}

async function recordUsage(
    apiKeyData: ApiKey,
    requestSize: number,
    responseSize: number,
    requestStart: number,
    status: 'success' | 'error',
    errorMessage?: string
) {
    try {
        const duration = Date.now() - requestStart
        await apiKeyService.recordUsage(
            apiKeyData.id,
            apiKeyData.userId,
            PROCESS_ENDPOINT,
            requestSize,
            responseSize,
            duration,
            status,
            errorMessage
        )
    } catch (usageError) {
        console.error('[PROCESS_API] Failed to record API usage:', usageError)
    }
}

function getPayloadSize(body: unknown): number {
    try {
        if (!body) return 0
        if (typeof body === 'string') {
            return body.length
        }
        return JSON.stringify(body).length
    } catch (error) {
        console.error('[PROCESS_API] Failed to measure request size:', error)
        return 0
    }
}
