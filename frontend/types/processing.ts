export type RowConfidenceStatus = 'high_confidence' | 'medium_confidence' | 'low_confidence' | 'failed'

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
    status: RowConfidenceStatus
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

export interface ProcessingStatistics {
    highConfidence: number
    mediumConfidence: number
    lowConfidence: number
    failed?: number
    totalRows: number
}

export interface ProcessingErrorDetail {
    rowIndex: number
    message: string
}

export interface ProcessingResult {
    success: boolean
    isComplete: boolean
    totalProcessed: number
    totalExpected: number
    skipped: number
    statistics: ProcessingStatistics
    results: ProcessedRow[]
    csvId?: string
    errors?: ProcessingErrorDetail[]
    progressPercent?: number
    statusMessage?: string
    batchLatenciesMs?: number[]
    batchDurationsMs?: number[]
    totalRuntimeMs?: number | null
}

export interface BatchRowResult {
    rowIndex: number
    status: 'processed' | 'skipped' | 'error'
    processedRow?: ProcessedRow
    reason?: string
    error?: string
}

export interface BatchProcessingResponse {
    success: boolean
    results: BatchRowResult[]
    error?: string
    details?: string
}
