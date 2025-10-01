// Production API Client - Simplified for single endpoint
export const PRODUCTION_API_CONFIG = {
    baseUrl: process.env.NODE_ENV === 'development'
        ? 'http://localhost:3000'
        : 'https://geonorm-app.vercel.app'
}

export interface AddressProcessingResult {
    success: boolean
    userId: string
    originalAddress: string
    cleanedAddress: string
    coordinates: {
        latitude: number
        longitude: number
    }
    zipCode: string | null
    zipCodeDetails?: {
        zipCode: string | null
        department: string | null
        district: string | null
        neighborhood: string | null
        confidence: string
    } | null
    confidence: number
    confidenceDescription: string
    locationType: string
    timestamp: string
}

export class ProductionGeoNormAPI {
    private baseUrl: string
    private apiKey: string

    constructor(apiKey: string) {
        this.baseUrl = PRODUCTION_API_CONFIG.baseUrl
        this.apiKey = apiKey
    }

    /**
     * Normalize and geocode a single address.
     * The server returns the cleaned address, coordinates, and zip code metadata.
     */
    async processAddress(address: string): Promise<AddressProcessingResult> {
        const response = await fetch(`${this.baseUrl}/api/process`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': this.apiKey
            },
            body: JSON.stringify({ address })
        })

        const data = await response.json()
        if (!response.ok) {
            throw new Error(data?.error || `API error: ${response.status}`)
        }

        return data as AddressProcessingResult
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
                    description: 'Send one address string and receive cleaned address, coordinates, and zip code',
                    parameters: {
                        body: {
                            address: 'string (required) - Address to process'
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

// Process a single address
const result = await api.processAddress('Av. España 123, Asunción')

console.log('Cleaned address:', result.cleanedAddress)
console.log('Coordinates:', result.coordinates)
console.log('Zip code:', result.zipCode)

// Check health
const health = await api.checkHealth()
console.log('API Status:', health.status)

// Generate map URL
const mapUrl = api.getStaticMapUrl(-25.2637, -57.5759)
console.log('Map URL:', mapUrl)
*/
