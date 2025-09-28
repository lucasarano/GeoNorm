// Production API Configuration
// This file defines which endpoints are available in production

export const PRODUCTION_ENDPOINTS = {
    // Main processing endpoint - the only one users should call
    process: {
        endpoint: '/api/process',
        description: 'Complete address processing pipeline',
        methods: ['POST'],
        public: true
    },

    // Health check - for monitoring
    health: {
        endpoint: '/api/health',
        description: 'API health check',
        methods: ['GET'],
        public: true
    },

    // Static maps - for displaying results
    staticmap: {
        endpoint: '/api/staticmap',
        description: 'Generate static map images',
        methods: ['GET'],
        public: true
    }
}

// Hidden endpoints (not documented for production)
export const HIDDEN_ENDPOINTS = [
    '/api/process/extract',
    '/api/process/clean',
    '/api/process/geocode',
    '/api/addresses/list',
    '/api/addresses/get',
    '/api/notifications/sms',
    '/api/notifications/email',
    '/api/notifications/test-sms',
    '/api/location/save',
    '/api/location/history',
    '/api/location/links',
    '/api/analytics/stats'
]

// API Documentation for Production
export const PRODUCTION_API_DOCS = {
    title: 'GeoNorm API',
    version: '1.0.0',
    description: 'Complete address processing and geocoding service',
    baseUrl: 'https://your-app.vercel.app',
    endpoints: [
        {
            path: '/api/process',
            method: 'POST',
            description: 'Process CSV data through complete pipeline',
            parameters: {
                body: {
                    csvData: {
                        type: 'string',
                        required: true,
                        description: 'CSV data to process'
                    },
                    userId: {
                        type: 'string',
                        required: true,
                        description: 'User identifier'
                    },
                    options: {
                        type: 'object',
                        required: false,
                        description: 'Processing options',
                        properties: {
                            sendNotifications: {
                                type: 'boolean',
                                default: true,
                                description: 'Whether to send SMS/email notifications'
                            }
                        }
                    }
                },
                headers: {
                    'X-API-Key': {
                        type: 'string',
                        required: true,
                        description: 'Your API key'
                    },
                    'Content-Type': {
                        type: 'string',
                        required: true,
                        value: 'application/json'
                    }
                }
            },
            response: {
                success: {
                    type: 'boolean',
                    description: 'Whether processing was successful'
                },
                totalProcessed: {
                    type: 'number',
                    description: 'Total number of addresses processed'
                },
                statistics: {
                    highConfidence: 'number',
                    mediumConfidence: 'number',
                    lowConfidence: 'number',
                    totalRows: 'number'
                },
                notifications: {
                    sms: { sent: 'number', failed: 'number' },
                    email: { sent: 'number', failed: 'number' }
                },
                results: [
                    {
                        rowIndex: 'number',
                        original: {
                            address: 'string',
                            city: 'string',
                            state: 'string',
                            phone: 'string'
                        },
                        cleaned: {
                            address: 'string',
                            city: 'string',
                            state: 'string',
                            phone: 'string',
                            email: 'string'
                        },
                        geocoding: {
                            latitude: 'number',
                            longitude: 'number',
                            formattedAddress: 'string',
                            confidence: 'number',
                            confidenceDescription: 'string',
                            locationType: 'string',
                            googleMapsLink: 'string'
                        },
                        zipCode: {
                            zipCode: 'string',
                            department: 'string',
                            district: 'string',
                            neighborhood: 'string',
                            confidence: 'string'
                        },
                        status: 'string'
                    }
                ]
            }
        },
        {
            path: '/api/health',
            method: 'GET',
            description: 'Check API health and status',
            response: {
                status: 'string',
                message: 'string',
                timestamp: 'string',
                environment: 'object'
            }
        },
        {
            path: '/api/staticmap',
            method: 'GET',
            description: 'Generate static map image',
            parameters: {
                query: {
                    lat: { type: 'number', required: true },
                    lng: { type: 'number', required: true },
                    zoom: { type: 'number', default: 14 },
                    size: { type: 'string', default: '600x300' }
                }
            },
            response: 'PNG image or JSON error'
        }
    ]
}
