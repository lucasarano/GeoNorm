import React, { useState } from 'react'
import { Timestamp } from 'firebase/firestore'
import * as XLSX from 'xlsx'
import { Card } from './shared/ui/card'
import { Button } from './shared/ui/button'
import { Upload, FileText, Sparkles, MapPin, CheckCircle } from 'lucide-react'
import { DataService } from '../services/dataService'
import { useAuth } from '../contexts/AuthContext'
import RealTimeApiMonitor from './RealTimeApiMonitor'
import type {
    ProcessedRow,
    ProcessingResult,
    ProcessingMeta,
    RowTimelineDebug
} from '../types/processing'

interface UnifiedProcessorProps {
    onProcessingComplete: (result: ProcessingResult) => void
    onProcessingProgress?: (result: ProcessingResult, options?: { done?: boolean }) => void
}

export default function UnifiedProcessor({ onProcessingComplete, onProcessingProgress }: UnifiedProcessorProps) {
    const { currentUser } = useAuth()
    const [file, setFile] = useState<File | null>(null)
    const [isProcessing, setIsProcessing] = useState(false)
    const [currentStep, setCurrentStep] = useState<'upload' | 'extracting' | 'cleaning' | 'geocoding' | 'completed'>('upload')
    const [progress, setProgress] = useState(0)
    const [stepDetails, setStepDetails] = useState<string>('')

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = event.target.files?.[0]
        if (!selectedFile) return

        const name = selectedFile.name.toLowerCase()
        const isCsv = name.endsWith('.csv') || selectedFile.type === 'text/csv'
        const isExcel = name.endsWith('.xlsx') || name.endsWith('.xls') ||
            selectedFile.type.includes('spreadsheetml') || selectedFile.type.includes('ms-excel')

        if (isCsv || isExcel) {
            setFile(selectedFile)
            setCurrentStep('upload')
            setProgress(0)
        } else {
            alert('Formato no soportado. Sube un archivo .csv, .xlsx o .xls')
        }
    }

    const processCSV = async () => {
        if (!file) return

        setIsProcessing(true)
        setProgress(0)

        try {
            // Read file content (CSV or Excel -> CSV)
            let fullCsvContent = ''

            const lowerName = file.name.toLowerCase()
            const isExcel = lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls') ||
                file.type.includes('spreadsheetml') || file.type.includes('ms-excel')

            if (isExcel) {
                const buffer = await file.arrayBuffer()
                const wb = XLSX.read(buffer, { type: 'array' })
                const sheetName = wb.SheetNames[0]
                const ws = wb.Sheets[sheetName]
                fullCsvContent = XLSX.utils.sheet_to_csv(ws, { FS: ',', strip: true })
            } else {
                fullCsvContent = await file.text()
            }

            console.log('[DEBUG] Input CSV size:', fullCsvContent.length)
            console.log('[DEBUG] Input CSV preview:', fullCsvContent.substring(0, 300))

            // Step 1: Extracting
            setCurrentStep('extracting')
            setStepDetails('Analizando estructura del CSV...')
            setProgress(10)

            await new Promise(resolve => setTimeout(resolve, 500))
            setStepDetails('Extrayendo campos de dirección...')
            setProgress(25)

            // Step 2: Cleaning
            setCurrentStep('cleaning')
            setStepDetails('Enviando datos a OpenAI para limpieza...')
            setProgress(40)

            await new Promise(resolve => setTimeout(resolve, 1000))
            setStepDetails('Procesando con inteligencia artificial...')
            setProgress(55)

            // Step 3: Geocoding (streaming)
            setCurrentStep('geocoding')
            setStepDetails('Procesamiento continuo en el servidor...')
            setProgress(70)

            const allLines = fullCsvContent.trim().split('\n')
            const dataLines = allLines.slice(1).filter(l => l && l.trim().length > 0)
            const totalRows = dataLines.length

            const aggregate: ProcessingResult = {
                success: true,
                totalProcessed: 0,
                statistics: { highConfidence: 0, mediumConfidence: 0, lowConfidence: 0, totalRows },
                results: [],
                debug: {
                    batchProcessing: null,
                    geocodingInteractions: [],
                    rowTimelines: []
                },
                meta: {
                    progress: 0,
                    currentStep: 'geocoding',
                    detail: 'Procesamiento en curso...',
                    totalRows,
                    processedRows: 0,
                    processedBatches: 0,
                    totalBatches: Math.max(1, Math.ceil(totalRows / 50)),
                    isComplete: false
                }
            }

            const rowsByIndex = new Map<number, ProcessedRow>()
            const timelinesByIndex = new Map<number, RowTimelineDebug>()

            const recomputeAggregates = () => {
                const sortedRows = Array.from(rowsByIndex.values()).sort((a, b) => a.rowIndex - b.rowIndex)
                aggregate.results = sortedRows
                aggregate.totalProcessed = sortedRows.length

                let highConfidence = 0
                let mediumConfidence = 0
                let lowConfidence = 0

                sortedRows.forEach(row => {
                    if (row.status === 'high_confidence') {
                        highConfidence++
                    } else if (row.status === 'medium_confidence') {
                        mediumConfidence++
                    } else if (row.status === 'low_confidence') {
                        lowConfidence++
                    }
                })

                aggregate.statistics = {
                    highConfidence,
                    mediumConfidence,
                    lowConfidence,
                    totalRows
                }

                if (!aggregate.debug) {
                    aggregate.debug = {
                        batchProcessing: null,
                        geocodingInteractions: [],
                        rowTimelines: []
                    }
                }

                aggregate.debug.rowTimelines = Array.from(timelinesByIndex.values()).sort((a, b) => a.rowIndex - b.rowIndex)

                if (aggregate.meta) {
                    aggregate.meta.processedRows = aggregate.totalProcessed
                }
            }

            const buildSnapshot = (done = false): ProcessingResult => {
                if (aggregate.meta) {
                    aggregate.meta.isComplete = done
                }
                recomputeAggregates()
                return JSON.parse(JSON.stringify(aggregate)) as ProcessingResult
            }

            const emitProgress = (done = false) => {
                const snapshot = buildSnapshot(done)
                if (done) {
                    onProcessingProgress?.(snapshot, { done: true })
                    onProcessingComplete(snapshot)
                } else {
                    onProcessingProgress?.(snapshot, { done: false })
                }
            }

            emitProgress(false)

            const response = await fetch('/api/process-complete', {
                method: 'POST',
                headers: {
                    'Content-Type': 'text/csv'
                },
                body: fullCsvContent
            })

            if (!response.ok || !response.body) {
                const errorBody = await response.text()
                console.error('Server error response:', errorBody)
                throw new Error(errorBody || `Error en el servidor: ${response.status}`)
            }

            type StreamRowEvent = { type: 'row'; rowIndex: number; row: ProcessedRow; timeline?: RowTimelineDebug }
            type StreamMetaEvent = { type: 'meta'; meta: ProcessingMeta }
            type StreamCompleteEvent = { type: 'complete'; result: ProcessingResult }
            type StreamErrorEvent = { type: 'error'; message: string }
            type StreamEvent = StreamRowEvent | StreamMetaEvent | StreamCompleteEvent | StreamErrorEvent

            const reader = response.body.getReader()
            const decoder = new TextDecoder()
            let buffer = ''
            let finalEvent: ProcessingResult | null = null
            let completed = false

            const processEventLine = (line: string) => {
                const trimmed = line.trim()
                if (!trimmed) return

                let event: StreamEvent
                try {
                    event = JSON.parse(trimmed) as StreamEvent
                } catch (error) {
                    console.error('Error parsing stream chunk:', error, 'Chunk:', trimmed)
                    return
                }

                if (event.type === 'row') {
                    const rowIndex = event.row.rowIndex ?? event.rowIndex
                    rowsByIndex.set(rowIndex, {
                        ...event.row,
                        rowIndex
                    })
                    if (event.timeline) {
                        timelinesByIndex.set(event.timeline.rowIndex, event.timeline)
                    }
                    emitProgress(false)
                } else if (event.type === 'meta') {
                    aggregate.meta = {
                        ...aggregate.meta,
                        ...event.meta,
                        isComplete: false
                    }
                    setProgress(event.meta.progress)
                    setStepDetails(event.meta.detail ?? '')
                    emitProgress(false)
                } else if (event.type === 'complete') {
                    finalEvent = event.result
                    completed = true
                    aggregate.success = event.result.success
                    aggregate.totalProcessed = event.result.totalProcessed
                    aggregate.statistics = event.result.statistics
                    aggregate.results = event.result.results
                    aggregate.debug = event.result.debug
                    if (event.result.debug?.rowTimelines) {
                        event.result.debug.rowTimelines.forEach(timeline => {
                            timelinesByIndex.set(timeline.rowIndex, timeline)
                        })
                    }
                    if (aggregate.meta && event.result.meta) {
                        aggregate.meta = {
                            ...event.result.meta,
                            isComplete: false
                        }
                        setProgress(event.result.meta.progress)
                        setStepDetails(event.result.meta.detail ?? '')
                    }
                    rowsByIndex.clear()
                    event.result.results.forEach(row => rowsByIndex.set(row.rowIndex, row))
                    emitProgress(false)
                } else if (event.type === 'error') {
                    const message = event.message && event.message.trim().length > 0
                        ? event.message
                        : 'Error desconocido en el procesamiento del servidor'
                    throw new Error(message)
                }
            }

            while (true) {
                const { value, done } = await reader.read()
                if (done) break

                buffer += decoder.decode(value, { stream: true })
                let newlineIndex = buffer.indexOf('\n')
                while (newlineIndex >= 0) {
                    const line = buffer.slice(0, newlineIndex)
                    buffer = buffer.slice(newlineIndex + 1)
                    processEventLine(line)
                    newlineIndex = buffer.indexOf('\n')
                }
            }

            buffer += decoder.decode()
            if (buffer.trim().length > 0) {
                processEventLine(buffer)
                buffer = ''
            }

            if (!completed || !finalEvent) {
                const processedRows = aggregate.meta?.processedRows ?? rowsByIndex.size
                if (processedRows >= totalRows) {
                    completed = true
                    finalEvent = {
                        success: true,
                        totalProcessed: processedRows,
                        statistics: aggregate.statistics,
                        results: Array.from(rowsByIndex.values()).sort((a, b) => a.rowIndex - b.rowIndex),
                        debug: aggregate.debug,
                        meta: aggregate.meta
                    }
                    aggregate.success = true
                } else {
                    throw new Error('El servidor terminó la transmisión sin enviar un evento de finalización.')
                }
            }

            setStepDetails('Finalizando procesamiento...')
            setProgress(prev => Math.max(prev, 90))

            if (aggregate.meta) {
                aggregate.meta = {
                    ...aggregate.meta,
                    currentStep: 'finalizando',
                    detail: 'Finalizando procesamiento...',
                    isComplete: false
                }
            }

            emitProgress(false)

            // Save to Firebase if user is authenticated
            if (currentUser && aggregate.success) {
                try {
                    setStepDetails('Guardando datos en Firebase...')
                    if (aggregate.meta) {
                        aggregate.meta = {
                            ...aggregate.meta,
                            detail: 'Guardando datos en Firebase...',
                            isComplete: false
                        }
                    }
                    emitProgress(false)

                    // Create CSV dataset
                    const csvId = await DataService.createCSVDataset(
                        currentUser.uid,
                        file.name,
                        aggregate.totalProcessed
                    )

                    // Update with statistics
                    await DataService.updateCSVDataset(csvId, {
                        processedRows: aggregate.totalProcessed,
                        highConfidenceAddresses: aggregate.statistics.highConfidence,
                        mediumConfidenceAddresses: aggregate.statistics.mediumConfidence,
                        lowConfidenceAddresses: aggregate.statistics.lowConfidence,
                        processingStatus: 'completed',
                        completedAt: Timestamp.now()
                    })

                    // Save address records
                    const addressRecords = aggregate.results.map(row => ({
                        userId: currentUser.uid,
                        csvId: csvId,
                        rowIndex: row.rowIndex,
                        originalAddress: row.original.address,
                        originalCity: row.original.city,
                        originalState: row.original.state,
                        originalPhone: row.original.phone,
                        cleanedAddress: row.cleaned.address,
                        cleanedCity: row.cleaned.city,
                        cleanedState: row.cleaned.state,
                        cleanedPhone: row.cleaned.phone,
                        cleanedEmail: row.cleaned.email,
                        ...(row.geocoding.latitude != null && row.geocoding.longitude != null ? {
                            coordinates: {
                                lat: row.geocoding.latitude,
                                lng: row.geocoding.longitude
                            }
                        } : {}),
                        geocodingConfidence: row.status === 'high_confidence' ? 'high' :
                            row.status === 'medium_confidence' ? 'medium' : 'low',
                        locationType: row.geocoding.locationType,
                        formattedAddress: row.geocoding.formattedAddress,
                        zipCode: row.zipCode,
                        status: 'processed' as const,
                        needsConfirmation: row.status === 'low_confidence',
                        // Use the Google Maps link from processing
                        googleMapsLink: row.googleMapsLink
                    }))

                    const recordIds = await DataService.bulkSaveAddressRecords(addressRecords)

                    aggregate.results = aggregate.results.map((row, index) => ({
                        ...row,
                        recordId: recordIds[index]
                    }))

                    rowsByIndex.clear()
                    aggregate.results.forEach(row => {
                        rowsByIndex.set(row.rowIndex, row)
                    })

                    if (aggregate.meta) {
                        aggregate.meta = {
                            ...aggregate.meta,
                            detail: 'Datos guardados exitosamente',
                            isComplete: false
                        }
                    }
                    emitProgress(false)

                    setStepDetails('Datos guardados exitosamente')
                } catch (error) {
                    console.error('Error saving to Firebase:', error)
                    const message = error instanceof Error ? error.message : null
                    setStepDetails('Procesamiento completado (error guardando en Firebase)')
                    if (aggregate.meta) {
                        aggregate.meta = {
                            ...aggregate.meta,
                            detail: `Procesamiento completado (error guardando en Firebase${message ? `: ${message}` : ''})`,
                            isComplete: false
                        }
                    }
                    emitProgress(false)
                }
            }

            await new Promise(resolve => setTimeout(resolve, 500))

            setCurrentStep('completed')
            setProgress(100)
            const finalMeta = finalEvent.meta ?? null
            const existingMeta = aggregate.meta ?? finalMeta ?? {
                progress: 0,
                currentStep: 'completed',
                detail: '¡Procesamiento completado con éxito!',
                totalRows,
                processedRows: rowsByIndex.size,
                processedBatches: 0,
                totalBatches: Math.max(1, Math.ceil(totalRows / 50)),
                isComplete: false
            }

            aggregate.meta = {
                ...existingMeta,
                progress: 100,
                currentStep: 'completed',
                detail: finalMeta?.detail ?? existingMeta.detail ?? '¡Procesamiento completado con éxito!',
                totalRows: existingMeta.totalRows ?? totalRows,
                processedRows: rowsByIndex.size,
                isComplete: true
            }

            setStepDetails(aggregate.meta.detail ?? '¡Procesamiento completado con éxito!')

            emitProgress(true)

        } catch (error: unknown) {
            console.error('Error processing CSV:', error)
            const message = error instanceof Error ? error.message : 'Error desconocido'
            alert(`Error procesando CSV: ${message}`)
            setCurrentStep('upload')
            setProgress(0)
            setStepDetails('')
        } finally {
            setIsProcessing(false)
        }
    }

    const getStepIcon = (step: string) => {
        switch (step) {
            case 'extracting':
                return <FileText className="w-5 h-5" />
            case 'cleaning':
                return <Sparkles className="w-5 h-5" />
            case 'geocoding':
                return <MapPin className="w-5 h-5" />
            case 'completed':
                return <CheckCircle className="w-5 h-5" />
            default:
                return <Upload className="w-5 h-5" />
        }
    }

    const getStepColor = (step: string, isActive: boolean) => {
        if (!isActive) return 'bg-gray-200 text-gray-500'

        switch (step) {
            case 'extracting':
                return 'bg-blue-500 text-white'
            case 'cleaning':
                return 'bg-purple-500 text-white'
            case 'geocoding':
                return 'bg-green-500 text-white'
            case 'completed':
                return 'bg-emerald-500 text-white'
            default:
                return 'bg-orange-500 text-white'
        }
    }

    return (
        <div className="space-y-6">
            {/* Main Upload Card */}
            <Card className="p-8 bg-white/50 backdrop-blur-sm border border-orange-100 shadow-lg">
                <div className="text-center">
                    <div className="w-16 h-16 bg-gradient-to-r from-orange-500 to-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
                        <Upload className="w-8 h-8 text-white" />
                    </div>

                    <h3 className="text-2xl font-bold text-gray-900 mb-2">
                        Procesamiento Unificado de CSV
                    </h3>
                    <p className="text-gray-600 mb-8 max-w-2xl mx-auto">
                        Sube tu archivo CSV y obtén direcciones normalizadas, limpiadas con IA y geocodificadas en un solo paso.
                        Todo el procesamiento se realiza automáticamente.
                    </p>

                    {!isProcessing ? (
                        <div className="space-y-6">
                            {/* File Upload */}
                            <div className="border-2 border-dashed border-orange-300 rounded-xl p-8 hover:border-orange-400 transition-colors">
                                <input
                                    type="file"
                                    accept=".csv,.xlsx,.xls"
                                    onChange={handleFileUpload}
                                    className="hidden"
                                    id="csv-upload"
                                />
                                <label
                                    htmlFor="csv-upload"
                                    className="cursor-pointer flex flex-col items-center"
                                >
                                    <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mb-3">
                                        <FileText className="w-6 h-6 text-orange-600" />
                                    </div>
                                    <span className="text-lg font-semibold text-gray-700 mb-2">
                                        {file ? file.name : 'Seleccionar archivo CSV/XLSX'}
                                    </span>
                                    <span className="text-sm text-gray-500">
                                        Haz clic para seleccionar o arrastra tu archivo aquí
                                    </span>
                                </label>
                            </div>

                            {/* Process Button */}
                            <Button
                                onClick={processCSV}
                                disabled={!file}
                                className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold py-4 px-8 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 text-lg"
                            >
                                <Sparkles className="w-5 h-5 mr-2" />
                                Procesar CSV Completo
                            </Button>

                            {/* Process Description */}
                            <div className="grid md:grid-cols-3 gap-4 mt-8 text-left">
                                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                                    <FileText className="w-6 h-6 text-blue-600 mb-2" />
                                    <h4 className="font-semibold text-blue-900 mb-1">1. Extracción</h4>
                                    <p className="text-sm text-blue-700">Identificar y extraer campos de dirección del CSV</p>
                                </div>
                                <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                                    <Sparkles className="w-6 h-6 text-purple-600 mb-2" />
                                    <h4 className="font-semibold text-purple-900 mb-1">2. Limpieza IA</h4>
                                    <p className="text-sm text-purple-700">Normalizar y limpiar datos con OpenAI</p>
                                </div>
                                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                                    <MapPin className="w-6 h-6 text-green-600 mb-2" />
                                    <h4 className="font-semibold text-green-900 mb-1">3. Geocodificación</h4>
                                    <p className="text-sm text-green-700">Convertir a coordenadas con Google Maps</p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Processing Steps */}
                            <div className="flex items-center justify-center space-x-4 mb-8">
                                {['extracting', 'cleaning', 'geocoding', 'completed'].map((step, index) => {
                                    const isActive = currentStep === step
                                    const isPassed = ['extracting', 'cleaning', 'geocoding', 'completed'].indexOf(currentStep) > index

                                    return (
                                        <div key={step} className="flex items-center">
                                            <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${isActive || isPassed
                                                ? getStepColor(step, true)
                                                : getStepColor(step, false)
                                                }`}>
                                                {getStepIcon(step)}
                                            </div>
                                            {index < 3 && (
                                                <div className={`w-8 h-1 mx-2 transition-all duration-300 ${isPassed ? 'bg-green-500' : 'bg-gray-200'
                                                    }`} />
                                            )}
                                        </div>
                                    )
                                })}
                            </div>

                            {/* Progress Bar */}
                            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-orange-500 to-amber-500 transition-all duration-500 ease-out"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>

                            {/* Progress Text */}
                            <div className="text-center">
                                <p className="text-lg font-semibold text-gray-800 mb-2">
                                    {progress}% Completado
                                </p>
                                <p className="text-sm text-gray-600">
                                    {stepDetails}
                                </p>
                            </div>

                            {/* Processing Animation */}
                            <div className="flex justify-center">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
                            </div>
                        </div>
                    )}
                </div>
            </Card>

            {/* Features */}
            <Card className="p-6 bg-white/30 backdrop-blur-sm border border-orange-100 shadow-lg">
                <h4 className="text-lg font-semibold text-gray-900 mb-4 text-center">
                    ¿Qué incluye el procesamiento?
                </h4>
                <div className="grid md:grid-cols-2 gap-4 text-sm">
                    <div className="space-y-2">
                        <div className="flex items-center text-green-700">
                            <CheckCircle className="w-4 h-4 mr-2" />
                            <span>Extracción automática de campos</span>
                        </div>
                        <div className="flex items-center text-green-700">
                            <CheckCircle className="w-4 h-4 mr-2" />
                            <span>Normalización de direcciones</span>
                        </div>
                        <div className="flex items-center text-green-700">
                            <CheckCircle className="w-4 h-4 mr-2" />
                            <span>Limpieza con inteligencia artificial</span>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center text-green-700">
                            <CheckCircle className="w-4 h-4 mr-2" />
                            <span>Geocodificación precisa</span>
                        </div>
                        <div className="flex items-center text-green-700">
                            <CheckCircle className="w-4 h-4 mr-2" />
                            <span>Validación de confianza</span>
                        </div>
                        <div className="flex items-center text-green-700">
                            <CheckCircle className="w-4 h-4 mr-2" />
                            <span>Dashboard interactivo de resultados</span>
                        </div>
                    </div>
                </div>
            </Card>

            {/* Real-time API Monitor */}
            <RealTimeApiMonitor isProcessing={isProcessing} />
        </div>
    )
}
