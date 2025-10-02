import { logDerivedApiCalls } from './api-monitor'
import type { ApiCallInput } from './api-monitor'

// API Configuration for Vercel Serverless Functions
const getDevBaseUrl = () => {
    if (typeof window !== 'undefined') {
        return window.location.origin
    }
    return 'http://localhost:3000'
}

type TokenProvider = () => Promise<string | null>

let authTokenProvider: TokenProvider | null = null

export function setAuthTokenProvider(provider: TokenProvider | null) {
    authTokenProvider = provider
}

async function applyAuthHeader(headers: Headers) {
    if (!authTokenProvider) {
        return
    }

    try {
        const token = await authTokenProvider()
        if (token) {
            headers.set('Authorization', `Bearer ${token}`)
        }
    } catch (error) {
        console.error('[API] Failed to resolve auth token for request', error)
    }
}

export const API_CONFIG = {
    // Base URLs for different environments
    vercel: {
        baseUrl: process.env.NODE_ENV === 'development'
            ? getDevBaseUrl()  // Use current origin in dev (Vite proxy handles /api)
            : 'https://geonorm-app.vercel.app'  // Production Vercel
    },
    express: {
        baseUrl: process.env.NODE_ENV === 'development'
            ? 'http://localhost:3001'  // Express dev server
            : 'https://your-express-server.railway.app'  // Production Express
    }
}

// API Endpoints - Consolidated for Vercel Hobby Plan
export const API_ENDPOINTS = {
    // Core Processing
    process: {
        complete: '/api/process-complete',
        main: '/api/process'
    },

    // API Key Management
    apikeys: '/api/apikeys',

    // Consolidated Endpoints
    addresses: '/api/addresses',
    notifications: '/api/notifications',
    location: '/api/location',
    analytics: '/api/analytics',

    // Utilities
    utilities: {
        health: '/api/health',
        staticmap: '/api/staticmap'
    }
}

// Helper function to get full API URL
export function getApiUrl(endpoint: string, useExpress = false): string {
    const baseUrl = useExpress ? API_CONFIG.express.baseUrl : API_CONFIG.vercel.baseUrl
    return `${baseUrl}${endpoint}`
}

type ProcessMetadata = {
    batchIndex?: number
    batchStart?: number
    batchEnd?: number
    batchTotalRows?: number
}

interface BatchDetailPayload {
    batchIndex?: number
    status?: string
    processingTime?: number
    retryCount?: number
    error?: string | null
}

interface GeocodingInteractionPayload {
    rowIndex?: number
    request?: {
        address?: string
        url?: string
    }
    response?: {
        status?: string
        httpStatus?: number
        responseTime?: number
        error?: string | null
        bestResult?: unknown
    }
}

interface ProcessCompleteResponse {
    debug?: {
        batchProcessing?: {
            batchDetails?: BatchDetailPayload[]
        }
        geocodingInteractions?: GeocodingInteractionPayload[]
    }
    [key: string]: unknown
}

// API Client class for making requests
export class GeoNormAPI {
    private baseUrl: string
    private expressUrl: string

    constructor() {
        this.baseUrl = API_CONFIG.vercel.baseUrl
        this.expressUrl = API_CONFIG.express.baseUrl
    }

    // Core Processing Methods
    async processComplete(csvData: string, metadata: ProcessMetadata = {}) {
        const headers = new Headers({ 'Content-Type': 'text/csv' })

        // Attach batch metadata headers so the backend can log precise context
        if (metadata && typeof metadata === 'object') {
            const mappings: Array<[string, unknown]> = [
                ['x-geonorm-batch-index', metadata.batchIndex],
                ['x-geonorm-batch-start', metadata.batchStart],
                ['x-geonorm-batch-end', metadata.batchEnd],
                ['x-geonorm-batch-totalrows', metadata.batchTotalRows]
            ]

            mappings.forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    headers.set(key, String(value))
                }
            })
        }

        await applyAuthHeader(headers)

        console.debug('[API] processComplete -> dispatching request', {
            csvLength: csvData.length,
            metadata
        })

        const response = await fetch(getApiUrl(API_ENDPOINTS.process.complete), {
            method: 'POST',
            headers,
            body: csvData
        })

        console.debug('[API] processComplete -> response received', {
            ok: response.ok,
            status: response.status
        })

        const data: ProcessCompleteResponse = await response.json()

        // Feed debug instrumentation back into the real-time API monitor
        if (!response.ok) {
            console.error('[API] processComplete -> server responded with error', data)
        }

        if (data?.debug) {
            const derivedCalls: ApiCallInput[] = []

            const batchDetails = data.debug.batchProcessing?.batchDetails as BatchDetailPayload[] | undefined
            if (Array.isArray(batchDetails)) {
                batchDetails.forEach((detail) => {
                    const status = detail.status === 'failed' ? 'failed' : 'completed'

                    derivedCalls.push({
                        type: 'openai',
                        status,
                        duration: detail.processingTime,
                        details: {
                            batchIndex: detail.batchIndex,
                            endpoint: 'OpenAI Batch Processing',
                            response: {
                                status: detail.status,
                                retryCount: detail.retryCount,
                                error: detail.error ?? null
                            }
                        }
                    })
                })
            }

            const geocodingInteractions = data.debug.geocodingInteractions as GeocodingInteractionPayload[] | undefined
            if (Array.isArray(geocodingInteractions)) {
                geocodingInteractions.forEach((interaction) => {
                    const response = interaction.response
                    const status = response?.error || response?.status === 'ERROR'
                        ? 'failed'
                        : 'completed'

                    derivedCalls.push({
                        type: 'geocoding',
                        status,
                        duration: response?.responseTime,
                        details: {
                            rowIndex: interaction.rowIndex,
                            address: interaction.request?.address,
                            endpoint: interaction.request?.url,
                            response: {
                                status: response?.status,
                                httpStatus: response?.httpStatus,
                                bestResult: response?.bestResult
                            },
                            error: response?.error ?? null
                        }
                    })
                })
            }

            if (derivedCalls.length > 0) {
                logDerivedApiCalls(derivedCalls)
            }
        }

        console.debug('[API] processComplete -> parsed payload', {
            success: data?.success,
            totalProcessed: data?.totalProcessed,
            debugMeta: data?.debug?.meta
        })

        return data
    }

    async extractFields(csvData: string, options = {}) {
        const response = await fetch(getApiUrl(API_ENDPOINTS.process.extract), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ csvData, options })
        })
        return response.json()
    }

    async cleanAddresses(extractedData: unknown[]) {
        const response = await fetch(getApiUrl(API_ENDPOINTS.process.clean), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ extractedData })
        })
        return response.json()
    }

    async geocodeAddresses(addresses: unknown[], options: Record<string, unknown> = {}) {
        const response = await fetch(getApiUrl(API_ENDPOINTS.process.geocode), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ addresses, options })
        })
        return response.json()
    }

    // Address Management Methods
    async listAddresses(userId: string, filters = {}) {
        const params = new URLSearchParams({ userId, ...filters })
        const response = await fetch(`${getApiUrl(API_ENDPOINTS.addresses)}?${params}`)
        return response.json()
    }

    async getAddress(id: string) {
        const params = new URLSearchParams({ action: 'get', id })
        const response = await fetch(`${getApiUrl(API_ENDPOINTS.addresses)}?${params}`)
        return response.json()
    }

    // Notification Methods
    async sendSMS(addresses: unknown[]) {
        const response = await fetch(getApiUrl(API_ENDPOINTS.notifications), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'send-sms', addresses })
        })
        return response.json()
    }

    async sendTestEmail(email: string, name: string, locationUrl?: string) {
        const response = await fetch(getApiUrl(API_ENDPOINTS.notifications), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'send-email', email, name, locationUrl })
        })
        return response.json()
    }

    async sendTestSMS(phone: string) {
        const response = await fetch(getApiUrl(API_ENDPOINTS.notifications), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'test-sms', phone })
        })
        return response.json()
    }

    // Location Methods
    async saveLocation(locationData: Record<string, unknown>) {
        const response = await fetch(getApiUrl(API_ENDPOINTS.location), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(locationData)
        })
        return response.json()
    }

    async getLocationHistory(userId: string, limit = 50) {
        const params = new URLSearchParams({ action: 'history', userId, limit: limit.toString() })
        const response = await fetch(`${getApiUrl(API_ENDPOINTS.location)}?${params}`)
        return response.json()
    }

    async createLocationLinks(addressIds: string[], userId: string) {
        const response = await fetch(getApiUrl(API_ENDPOINTS.location), {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ addressIds, userId })
        })
        return response.json()
    }

    // Analytics Methods
    async getStats(userId: string, dateFrom?: string, dateTo?: string) {
        const params = new URLSearchParams({ userId })
        if (dateFrom) params.append('dateFrom', dateFrom)
        if (dateTo) params.append('dateTo', dateTo)

        const response = await fetch(`${getApiUrl(API_ENDPOINTS.analytics)}?${params}`)
        return response.json()
    }

    // Utility Methods
    async checkHealth() {
        const response = await fetch(getApiUrl(API_ENDPOINTS.utilities.health))
        return response.json()
    }

    getStaticMapUrl(lat: number, lng: number, zoom = 14, size = '600x300') {
        return `${getApiUrl(API_ENDPOINTS.utilities.staticmap)}?lat=${lat}&lng=${lng}&zoom=${zoom}&size=${size}`
    }
}

// Export singleton instance
export const api = new GeoNormAPI()
