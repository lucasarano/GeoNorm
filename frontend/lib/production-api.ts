// Production API Client - Simplified for single endpoint
export const PRODUCTION_API_CONFIG = {
    baseUrl: process.env.NODE_ENV === 'development'
        ? 'http://localhost:3000'
        : 'https://your-app.vercel.app'
}

export interface ProcessOptions {
    sendNotifications?: boolean
    batchSize?: number
    includeZipCodes?: boolean
}

export interface ProcessResult {
    success: boolean
    totalProcessed: number
    statistics: {
        highConfidence: number
        mediumConfidence: number
        lowConfidence: number
        totalRows: number
    }
    notifications: {
        sms: { sent: number, failed: number }
        email: { sent: number, failed: number }
    }
    results: ProcessedAddress[]
    processingTime?: number
    timestamp: string
}

export interface ProcessedAddress {
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
        googleMapsLink: string | null
    }
    zipCode?: {
        zipCode: string | null
        department: string | null
        district: string | null
        neighborhood: string | null
        confidence: string
    }
    status: 'high_confidence' | 'medium_confidence' | 'low_confidence' | 'failed'
    error?: string
}

export class ProductionGeoNormAPI {
    private baseUrl: string
    private apiKey: string

    constructor(apiKey: string) {
        this.baseUrl = PRODUCTION_API_CONFIG.baseUrl
        this.apiKey = apiKey
    }

    /**
     * Process CSV data through the complete pipeline
     * This is the main method - it does everything:
     * 1. Extract fields using AI
     * 2. Clean addresses using AI  
     * 3. Geocode addresses using Google Maps
     * 4. Save results to database
     * 5. Send notifications (SMS/Email)
     * 6. Return complete results
     */
    async processAddresses(
        csvData: string,
        userId: string,
        options: ProcessOptions = {}
    ): Promise<ProcessResult> {
        const response = await fetch(`${this.baseUrl}/api/process`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': this.apiKey
            },
            body: JSON.stringify({
                csvData,
                userId,
                options: {
                    sendNotifications: true,
                    includeZipCodes: true,
                    ...options
                }
            })
        })

        if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.error || `API error: ${response.status}`)
        }

        return response.json()
    }

    /**
     * Check API health and status
     */
    async checkHealth(): Promise<{
        status: string
        message: string
        timestamp: string
        environment: any
    }> {
        const response = await fetch(`${this.baseUrl}/api/health`)

        if (!response.ok) {
            throw new Error(`Health check failed: ${response.status}`)
        }

        return response.json()
    }

    /**
     * Generate static map URL for coordinates
     */
    getStaticMapUrl(
        lat: number,
        lng: number,
        zoom: number = 14,
        size: string = '600x300'
    ): string {
        return `${this.baseUrl}/api/staticmap?lat=${lat}&lng=${lng}&zoom=${zoom}&size=${size}`
    }

    /**
     * Get API documentation
     */
    getApiDocs(): any {
        return {
            title: 'GeoNorm API',
            version: '1.0.0',
            description: 'Complete address processing and geocoding service',
            baseUrl: this.baseUrl,
            endpoints: [
                {
                    path: '/api/process',
                    method: 'POST',
                    description: 'Process CSV data through complete pipeline',
                    parameters: {
                        body: {
                            csvData: 'string (required) - CSV data to process',
                            userId: 'string (required) - User identifier',
                            options: 'object (optional) - Processing options'
                        },
                        headers: {
                            'X-API-Key': 'string (required) - Your API key',
                            'Content-Type': 'application/json (required)'
                        }
                    }
                },
                {
                    path: '/api/health',
                    method: 'GET',
                    description: 'Check API health and status'
                },
                {
                    path: '/api/staticmap',
                    method: 'GET',
                    description: 'Generate static map image',
                    parameters: {
                        lat: 'number (required) - Latitude',
                        lng: 'number (required) - Longitude',
                        zoom: 'number (optional) - Zoom level (default: 14)',
                        size: 'string (optional) - Image size (default: 600x300)'
                    }
                }
            ]
        }
    }
}

// Export singleton instance
export function createGeoNormAPI(apiKey: string): ProductionGeoNormAPI {
    return new ProductionGeoNormAPI(apiKey)
}

// Example usage:
/*
const api = createGeoNormAPI('your-api-key')

// Process addresses
const result = await api.processAddresses(csvData, userId, {
  sendNotifications: true,
  includeZipCodes: true
})

console.log(`Processed ${result.totalProcessed} addresses`)
console.log(`High confidence: ${result.statistics.highConfidence}`)
console.log(`SMS sent: ${result.notifications.sms.sent}`)

// Check health
const health = await api.checkHealth()
console.log('API Status:', health.status)

// Generate map URL
const mapUrl = api.getStaticMapUrl(-25.2637, -57.5759)
console.log('Map URL:', mapUrl)
*/
