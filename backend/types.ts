import { Request } from 'express'

export interface RequestWithTaskId extends Request {
    taskId?: string
}

export interface ProcessingTask {
    status: 'processing' | 'completed' | 'error'
    progress: number
    message: string
    inputFile: string
    outputFile: string
    timestamp: number
    downloadUrl?: string
    currentBatch?: number
    totalBatches?: number
}
