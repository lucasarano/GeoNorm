// Production API Configuration
// This file defines which endpoints are available in production

export const PRODUCTION_ENDPOINTS = {
    // Main processing endpoints
    process: {
        endpoint: '/api/process',
        description: 'Complete address processing pipeline',
        methods: ['POST'],
        public: true
    },
    processComplete: {
        endpoint: '/api/process-complete',
        description: 'Alternative processing pipeline',
        methods: ['POST'],
        public: true
    },

    // API key management
    apikeys: {
        endpoint: '/api/apikeys',
        description: 'API key management',
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        public: false
    },

    // Consolidated endpoints
    addresses: {
        endpoint: '/api/addresses',
        description: 'Address management (list, get)',
        methods: ['GET'],
        public: false
    },
    notifications: {
        endpoint: '/api/notifications',
        description: 'Send SMS and email notifications',
        methods: ['POST'],
        public: false
    },
    location: {
        endpoint: '/api/location',
        description: 'Location services (save, history, links)',
        methods: ['GET', 'POST', 'PUT'],
        public: false
    },
    analytics: {
        endpoint: '/api/analytics',
        description: 'Usage analytics and statistics',
        methods: ['GET'],
        public: false
    },

    // Utility endpoints
    health: {
        endpoint: '/api/health',
        description: 'API health check',
        methods: ['GET'],
        public: true
    },
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
    baseUrl: 'https://geonorm-app.vercel.app',
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
