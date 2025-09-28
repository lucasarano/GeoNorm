export type ConfidenceBucket = 'high_confidence' | 'medium_confidence' | 'low_confidence' | 'failed'

export interface RowTimelineEvent {
    phase: string
    timestamp: number
    duration?: number
    details?: Record<string, unknown>
}

export interface RowTimelineDebug {
    rowIndex: number
    events: RowTimelineEvent[]
}

export interface ProcessingMeta {
    progress: number
    currentStep: string
    detail?: string
    totalRows: number
    processedRows: number
    processedBatches: number
    totalBatches: number
    isComplete: boolean
}

export interface ProcessedRow {
    rowIndex: number
    recordId?: string
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
        staticMapUrl: string | null
    }
    zipCode?: {
        zipCode: string | null
        department: string | null
        district: string | null
        neighborhood: string | null
        confidence: 'high' | 'medium' | 'low' | 'none'
    } | null
    status: ConfidenceBucket
    error?: string
    googleMapsLink?: string | null
    userUpdatedCoordinates?: {
        lat: number
        lng: number
        accuracy?: number
        updatedAt: string
    }
    userUpdatedGoogleMapsLink?: string | null
    locationLinkToken?: string
    locationLinkStatus?: 'sent' | 'submitted' | 'expired' | 'pending'
    locationLinkExpiresAt?: string
    lastLocationUpdate?: string
}

export type BatchStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'retrying'

export interface BatchDetail {
    batchIndex: number
    startRow: number
    endRow: number
    status: BatchStatus
    processingTime?: number
    error?: string
    retryCount?: number
}

export interface BatchProcessingDebug {
    totalBatches: number
    successfulBatches: number
    failedBatches: number
    batchSize: number
    maxConcurrentBatches: number
    totalProcessingTime: number
    averageTimePerBatch: number
    successRate: number
    batchDetails: BatchDetail[]
}

export interface GeocodingInteractionRequest {
    address: string
    city: string
    state: string
    components: string[]
    url: string
}

export interface GeocodingInteractionResponse {
    status: string
    results: unknown[]
    bestResult: {
        formatted_address: string
        geometry: {
            location: {
                lat: number
                lng: number
            }
            location_type: string
        }
        confidence: number
    } | null
    rawResponse: unknown
    responseTime: number
    httpStatus: number | null
    error: string | null
}

export interface GeocodingInteraction {
    timestamp: string
    rowIndex: number
    request: GeocodingInteractionRequest
    response: GeocodingInteractionResponse
    error?: string | null
}

export interface ProcessingDebug {
    batchProcessing?: BatchProcessingDebug | null
    geocodingInteractions?: GeocodingInteraction[]
    rowTimelines?: RowTimelineDebug[]
}

export interface ProcessingResult {
    success: boolean
    totalProcessed: number
    statistics: {
        highConfidence: number
        mediumConfidence: number
        lowConfidence: number
        totalRows: number
    }
    results: ProcessedRow[]
    debug?: ProcessingDebug
    meta?: ProcessingMeta
}

export interface EmailSendResult {
    success: boolean
    customerName?: string
    error?: string
    addressId?: string
}
