import React, { useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { Button } from './shared/ui/button'
import { Upload, FileText, Sparkles, MapPin, Loader2 } from 'lucide-react'
import { DataService } from '../services/dataService'
import { useAuth } from '../contexts/AuthContext'
import type { BatchProcessingResponse, BatchRowResult, ProcessedRow, ProcessingResult } from '../types/processing'

const MAX_BATCH_SIZE = 25
const DEFAULT_MAX_CONCURRENT_BATCHES = Number(import.meta.env.VITE_MAX_CONCURRENT_BATCHES ?? 2)
const MAX_CONCURRENT_LIMIT = 5

const clampBatchSize = (value: number): number => {
    if (!Number.isFinite(value)) return 1
    return Math.max(1, Math.min(Math.floor(value), MAX_BATCH_SIZE))
}

const clampConcurrentBatches = (value: number): number => {
    if (!Number.isFinite(value)) return 1
    return Math.max(1, Math.min(Math.floor(value), MAX_CONCURRENT_LIMIT))
}

const average = (values: number[]): number | null => {
    if (!values.length) return null
    return values.reduce((total, value) => total + value, 0) / values.length
}

const formatMilliseconds = (value: number | null): string => {
    if (value == null) return '—'
    const rounded = Math.round(value)
    return `${rounded.toLocaleString()} ms`
}

interface UnifiedProcessorProps {
    onProcessingStart?: (state: ProcessingResult) => void
    onProcessingProgress?: (state: ProcessingResult, row: ProcessedRow | null) => void
    onProcessingComplete: (state: ProcessingResult) => void
    onProcessingError?: (error: Error) => void
}

const INITIAL_PROGRESS_STATE: ProcessingResult = {
    success: true,
    isComplete: false,
    totalProcessed: 0,
    totalExpected: 0,
    skipped: 0,
    statistics: {
        highConfidence: 0,
        mediumConfidence: 0,
        lowConfidence: 0,
        failed: 0,
        totalRows: 0
    },
    results: [],
    progressPercent: 0,
    statusMessage: '',
    batchLatenciesMs: [],
    batchDurationsMs: [],
    totalRuntimeMs: null
}

export default function UnifiedProcessor({
    onProcessingStart,
    onProcessingProgress,
    onProcessingComplete,
    onProcessingError
}: UnifiedProcessorProps) {
    const { currentUser } = useAuth()
    const [file, setFile] = useState<File | null>(null)
    const [isProcessing, setIsProcessing] = useState(false)
    const [stepDetails, setStepDetails] = useState<string>('')
    const [totalRows, setTotalRows] = useState<number | null>(null)
    const [processedCount, setProcessedCount] = useState(0)
    const [skippedCount, setSkippedCount] = useState(0)
    const [activeCsvId, setActiveCsvId] = useState<string | null>(null)
    const [batchSize, setBatchSize] = useState<number>(1)
    const [batchLatencies, setBatchLatencies] = useState<number[]>([])
    const [batchDurations, setBatchDurations] = useState<number[]>([])
    const [totalElapsedMs, setTotalElapsedMs] = useState<number | null>(null)
    const [fileRunStart, setFileRunStart] = useState<number | null>(null)
    const maxConcurrentBatches = clampConcurrentBatches(DEFAULT_MAX_CONCURRENT_BATCHES)
    const batchLabel = batchSize === 1 ? 'fila' : 'filas'
    const debugMetricsEnabled = import.meta.env.DEV || import.meta.env.VITE_DEBUG_PANEL === '1'

    const averageLatency = useMemo(() => average(batchLatencies), [batchLatencies])
    const averageBatchDuration = useMemo(() => average(batchDurations), [batchDurations])
    const averageLatencyDisplay = useMemo(() => formatMilliseconds(averageLatency), [averageLatency])
    const averageBatchDurationDisplay = useMemo(() => formatMilliseconds(averageBatchDuration), [averageBatchDuration])
    const totalElapsedDisplay = useMemo(() => formatMilliseconds(totalElapsedMs), [totalElapsedMs])
    const debugMetricsAvailable = debugMetricsEnabled && (batchLatencies.length > 0 || batchDurations.length > 0 || totalElapsedMs != null)

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = event.target.files?.[0]
        if (!selectedFile) return

        const name = selectedFile.name.toLowerCase()
        const isCsv = name.endsWith('.csv') || selectedFile.type === 'text/csv'
        const isExcel = name.endsWith('.xlsx') || name.endsWith('.xls') ||
            selectedFile.type.includes('spreadsheetml') || selectedFile.type.includes('ms-excel')

        if (isCsv || isExcel) {
            setFile(selectedFile)
            setStepDetails('')
            setTotalRows(null)
            setProcessedCount(0)
            setSkippedCount(0)
            setActiveCsvId(null)
            setBatchLatencies([])
            setBatchDurations([])
            setTotalElapsedMs(null)
            setFileRunStart(null)
        } else {
            alert('Formato no soportado. Sube un archivo .csv, .xlsx o .xls')
        }
    }

    const handleBatchSizeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const value = Number(event.target.value)
        if (Number.isNaN(value)) {
            setBatchSize(1)
            return
        }
        setBatchSize(clampBatchSize(value))
    }

    const processCSV = async () => {
        if (!file) return

        setIsProcessing(true)
        setStepDetails('Preparando archivo...')
        setBatchLatencies([])
        setBatchDurations([])
        setTotalElapsedMs(null)
        const runStart = performance.now()
        setFileRunStart(runStart)

        const createSnapshot = (aggregate: ProcessingResult): ProcessingResult => ({
            ...aggregate,
            statistics: { ...aggregate.statistics },
            results: [...aggregate.results],
            errors: aggregate.errors && aggregate.errors.length > 0 ? [...aggregate.errors] : undefined,
            batchLatenciesMs: aggregate.batchLatenciesMs ? [...aggregate.batchLatenciesMs] : undefined,
            batchDurationsMs: aggregate.batchDurationsMs ? [...aggregate.batchDurationsMs] : undefined,
            totalRuntimeMs: aggregate.totalRuntimeMs ?? null
        })

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

            const normalizedContent = fullCsvContent.replace(/\r\n/g, '\n').trim()
            const allLines = normalizedContent.split('\n')
            if (allLines.length === 0) {
                throw new Error('El archivo no contiene datos')
            }

            const header = allLines[0]
            const dataLines = allLines.slice(1).filter(line => line && line.trim().length > 0)
            if (dataLines.length === 0) {
                throw new Error('No se encontraron filas de datos en el archivo')
            }

            const expectedRows = dataLines.length
            setTotalRows(expectedRows)

            const aggregate: ProcessingResult = {
                ...INITIAL_PROGRESS_STATE,
                totalExpected: expectedRows,
                csvId: undefined,
                errors: [],
                statusMessage: 'Preparando archivo...',
                batchLatenciesMs: [],
                batchDurationsMs: [],
                totalRuntimeMs: null
            }

            let currentBatchLatencies: number[] = []
            let currentBatchDurations: number[] = []

            let csvId: string | null = null
            if (currentUser) {
                const datasetStatus = 'Creando dataset en Firebase...'
                setStepDetails(datasetStatus)
                aggregate.statusMessage = datasetStatus

                csvId = await DataService.createCSVDataset(currentUser.uid, file.name, expectedRows)
                setActiveCsvId(csvId)
                aggregate.csvId = csvId
            }

            if (onProcessingStart) {
                onProcessingStart(createSnapshot(aggregate))
            }

            const updateDatasetProgress = async (isComplete: boolean) => {
                if (!currentUser || !csvId) return

                try {
                    await DataService.updateCSVDataset(csvId, {
                        processedRows: aggregate.totalProcessed + aggregate.skipped,
                        highConfidenceAddresses: aggregate.statistics.highConfidence,
                        mediumConfidenceAddresses: aggregate.statistics.mediumConfidence,
                        lowConfidenceAddresses: aggregate.statistics.lowConfidence + (aggregate.statistics.failed || 0),
                        pendingConfirmations: aggregate.statistics.lowConfidence + (aggregate.statistics.failed || 0),
                        processingStatus: isComplete ? 'completed' : 'processing',
                        ...(isComplete ? { completedAt: new Date() as any } : {})
                    })
                } catch (updateError) {
                    console.error('Error actualizando dataset en Firebase:', updateError)
                }
            }

            const effectiveBatchSize = clampBatchSize(batchSize)
            if (effectiveBatchSize !== batchSize) {
                setBatchSize(effectiveBatchSize)
            }

            const processSingleRow = async (row: string, absoluteIndex: number): Promise<BatchRowResult> => {
                try {
                    const response = await fetch('/api/process-row', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            header,
                            row,
                            rowIndex: absoluteIndex
                        })
                    })

                    if (!response.ok) {
                        const errorBody = await response.text().catch(() => '')
                        return {
                            rowIndex: absoluteIndex,
                            status: 'error',
                            error: errorBody || `Error en el servidor: ${response.status}`
                        }
                    }

                    const payload = await response.json()

                    if (payload.skipped) {
                        return {
                            rowIndex: absoluteIndex,
                            status: 'skipped',
                            reason: payload.reason || 'Fila omitida por el limpiador de direcciones'
                        }
                    }

                    if (!payload.success || !payload.processedRow) {
                        return {
                            rowIndex: absoluteIndex,
                            status: 'error',
                            error: payload.error || 'Error inesperado procesando la fila'
                        }
                    }

                    return {
                        rowIndex: absoluteIndex,
                        status: 'processed',
                        processedRow: payload.processedRow as ProcessedRow
                    }
                } catch (error: any) {
                    return {
                        rowIndex: absoluteIndex,
                        status: 'error',
                        error: error?.message || 'Fallo de red procesando la fila'
                    }
                }
            }

            const batches: { index: number; start: number; rows: string[] }[] = []
            for (let start = 0; start < dataLines.length; start += effectiveBatchSize) {
                batches.push({
                    index: batches.length,
                    start,
                    rows: dataLines.slice(start, start + effectiveBatchSize)
                })
            }

            type BatchOutcome = {
                index: number
                results: BatchRowResult[]
                llmDurationMs: number
                startedAt: number
            }

            aggregate.batchLatenciesMs = []
            aggregate.batchDurationsMs = []

            const executeBatch = async (batch: { index: number; start: number; rows: string[] }): Promise<BatchOutcome> => {
                const batchStartTime = performance.now()
                const batchStartNumber = batch.start + 1
                const batchEndNumber = Math.min(expectedRows, batch.start + batch.rows.length)
                const rangeLabel = batch.rows.length > 1
                    ? `filas ${batchStartNumber}-${batchEndNumber}`
                    : `fila ${batchStartNumber}`

                const processedBeforeRow = aggregate.totalProcessed + aggregate.skipped
                const basePercent = expectedRows > 0
                    ? Math.round((processedBeforeRow / expectedRows) * 100)
                    : 0
                aggregate.progressPercent = Math.min(99, basePercent)
                aggregate.statusMessage = `Procesando ${rangeLabel} de ${expectedRows}`
                setStepDetails(aggregate.statusMessage)

                let results: BatchRowResult[] = []
                let llmDurationMs = 0

                try {
                    const llmStart = performance.now()
                    const response = await fetch('/api/process-rows', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            header,
                            rows: batch.rows,
                            startIndex: batch.start
                        })
                    })
                    llmDurationMs = performance.now() - llmStart

                    if (!response.ok) {
                        const errorBody = await response.text().catch(() => '')
                        throw new Error(errorBody || `Error en el servidor: ${response.status}`)
                    }

                    const payload: BatchProcessingResponse = await response.json()

                    if (!payload.success || !Array.isArray(payload.results)) {
                        throw new Error(payload.error || 'Respuesta inválida del servidor')
                    }

                    results = payload.results
                } catch (batchError: any) {
                    console.error(`Error procesando lote ${batchStartNumber}-${batchEndNumber}:`, batchError)
                    results = []
                    for (let offset = 0; offset < batch.rows.length; offset++) {
                        const singleStart = performance.now()
                        const absoluteIndex = batch.start + offset
                        const singleResult = await processSingleRow(batch.rows[offset], absoluteIndex)
                        llmDurationMs += performance.now() - singleStart
                        results.push(singleResult)
                    }
                }

                return {
                    index: batch.index,
                    results,
                    llmDurationMs,
                    startedAt: batchStartTime
                }
            }

            const applyBatchOutcome = async (outcome: BatchOutcome) => {
                const { results, llmDurationMs, startedAt } = outcome
                const batchDurationMs = performance.now() - startedAt

                currentBatchLatencies = [...currentBatchLatencies, llmDurationMs]
                currentBatchDurations = [...currentBatchDurations, batchDurationMs]
                setBatchLatencies(currentBatchLatencies)
                setBatchDurations(currentBatchDurations)
                aggregate.batchLatenciesMs = currentBatchLatencies
                aggregate.batchDurationsMs = currentBatchDurations

                for (const result of results) {
                    const currentRowNumber = result.rowIndex + 1
                    aggregate.statusMessage = `Procesando fila ${currentRowNumber} de ${expectedRows}`
                    setStepDetails(aggregate.statusMessage)

                    try {
                        if (result.status === 'skipped') {
                            aggregate.skipped += 1
                            aggregate.success = aggregate.success && true
                            setSkippedCount(aggregate.skipped)
                            aggregate.errors?.push({
                                rowIndex: result.rowIndex,
                                message: result.reason || 'Fila omitida por el limpiador de direcciones'
                            })
                            const processedOrSkipped = aggregate.totalProcessed + aggregate.skipped
                            aggregate.progressPercent = expectedRows > 0
                                ? Math.min(100, Math.round((processedOrSkipped / expectedRows) * 100))
                                : 100
                            aggregate.statusMessage = `Fila ${currentRowNumber} omitida por limpieza`
                            await updateDatasetProgress(false)
                            if (onProcessingProgress) {
                                onProcessingProgress(createSnapshot(aggregate), null)
                            }
                            continue
                        }

                        if (result.status === 'processed' && result.processedRow) {
                            let processedRow: ProcessedRow = result.processedRow

                            if (currentUser && csvId) {
                                try {
                                    const confidenceLevel = processedRow.status === 'high_confidence'
                                        ? 'high'
                                        : processedRow.status === 'medium_confidence'
                                            ? 'medium'
                                            : 'low'

                                    const addressRecord = {
                                        userId: currentUser.uid,
                                        csvId,
                                        rowIndex: processedRow.rowIndex,
                                        originalAddress: processedRow.original.address,
                                        originalCity: processedRow.original.city,
                                        originalState: processedRow.original.state,
                                        originalPhone: processedRow.original.phone,
                                        cleanedAddress: processedRow.cleaned.address,
                                        cleanedCity: processedRow.cleaned.city,
                                        cleanedState: processedRow.cleaned.state,
                                        cleanedPhone: processedRow.cleaned.phone,
                                        cleanedEmail: processedRow.cleaned.email,
                                        ...(processedRow.geocoding.latitude != null && processedRow.geocoding.longitude != null ? {
                                            coordinates: {
                                                lat: processedRow.geocoding.latitude,
                                                lng: processedRow.geocoding.longitude
                                            }
                                        } : {}),
                                        geocodingConfidence: confidenceLevel as 'high' | 'medium' | 'low',
                                        locationType: processedRow.geocoding.locationType,
                                        formattedAddress: processedRow.geocoding.formattedAddress,
                                        zipCode: processedRow.zipCode ?? undefined,
                                        status: 'processed' as const,
                                        needsConfirmation: processedRow.status === 'low_confidence' || processedRow.status === 'failed',
                                        googleMapsLink: processedRow.googleMapsLink ?? null
                                    }

                                    const recordId = await DataService.saveAddressRecord(addressRecord)
                                    processedRow = { ...processedRow, recordId }
                                } catch (saveError) {
                                    console.error('Error guardando fila en Firebase:', saveError)
                                    aggregate.errors?.push({
                                        rowIndex: processedRow.rowIndex,
                                        message: 'Fila procesada pero no se pudo guardar en Firebase'
                                    })
                                }
                            }

                            aggregate.results.push(processedRow)
                            aggregate.totalProcessed = aggregate.results.length
                            aggregate.statistics.totalRows = aggregate.totalProcessed

                            switch (processedRow.status) {
                                case 'high_confidence':
                                    aggregate.statistics.highConfidence += 1
                                    break
                                case 'medium_confidence':
                                    aggregate.statistics.mediumConfidence += 1
                                    break
                                case 'low_confidence':
                                    aggregate.statistics.lowConfidence += 1
                                    break
                                case 'failed':
                                    if (aggregate.statistics.failed != null) {
                                        aggregate.statistics.failed += 1
                                    } else {
                                        aggregate.statistics.failed = 1
                                    }
                                    break
                            }

                            if (processedRow.error) {
                                aggregate.errors?.push({
                                    rowIndex: processedRow.rowIndex,
                                    message: processedRow.error
                                })
                            }

                            setProcessedCount(aggregate.totalProcessed)
                            const processedOrSkipped = aggregate.totalProcessed + aggregate.skipped
                            aggregate.progressPercent = expectedRows > 0
                                ? Math.min(100, Math.round((processedOrSkipped / expectedRows) * 100))
                                : 100
                            aggregate.statusMessage = `Fila ${currentRowNumber} procesada`
                            await updateDatasetProgress(false)
                            if (onProcessingProgress) {
                                onProcessingProgress(createSnapshot(aggregate), processedRow)
                            }
                            continue
                        }

                        throw new Error(result.error || result.reason || 'Error inesperado durante el procesamiento')
                    } catch (rowError: any) {
                        console.error(`Error procesando fila ${currentRowNumber}:`, rowError)
                        aggregate.success = false
                        aggregate.errors?.push({
                            rowIndex: result.rowIndex,
                            message: rowError?.message || 'Error desconocido durante el procesamiento'
                        })
                        aggregate.skipped += 1
                        setSkippedCount(aggregate.skipped)
                        const processedOrSkipped = aggregate.totalProcessed + aggregate.skipped
                        aggregate.progressPercent = expectedRows > 0
                            ? Math.min(100, Math.round((processedOrSkipped / expectedRows) * 100))
                            : 100
                        aggregate.statusMessage = `Error en fila ${currentRowNumber}: ${rowError?.message || 'revísala manualmente'}`
                        await updateDatasetProgress(false)
                        if (onProcessingProgress) {
                            onProcessingProgress(createSnapshot(aggregate), null)
                        }
                    }
                }

                if (onProcessingProgress) {
                    onProcessingProgress(createSnapshot(aggregate), null)
                }
            }

            const resolvedBatches = new Map<number, BatchOutcome>()
            let nextBatchToApply = 0

            const applyReadyBatches = async () => {
                while (resolvedBatches.has(nextBatchToApply)) {
                    const outcome = resolvedBatches.get(nextBatchToApply)!
                    resolvedBatches.delete(nextBatchToApply)
                    await applyBatchOutcome(outcome)
                    nextBatchToApply += 1
                }
            }

            const pendingBatches = [...batches]
            const workerCount = Math.min(maxConcurrentBatches, pendingBatches.length)

            const workers = Array.from({ length: workerCount }, async () => {
                while (pendingBatches.length > 0) {
                    const batch = pendingBatches.shift()
                    if (!batch) break
                    const outcome = await executeBatch(batch)
                    resolvedBatches.set(outcome.index, outcome)
                    await applyReadyBatches()
                }
            })

            await Promise.all(workers)
            await applyReadyBatches()

            aggregate.isComplete = true
            aggregate.progressPercent = 100
            aggregate.statusMessage = '¡Procesamiento completado con éxito!'
            await updateDatasetProgress(true)
            setStepDetails('¡Procesamiento completado con éxito!')
            const totalElapsed = performance.now() - runStart
            setTotalElapsedMs(totalElapsed)
            aggregate.totalRuntimeMs = totalElapsed
            aggregate.batchLatenciesMs = currentBatchLatencies
            aggregate.batchDurationsMs = currentBatchDurations
            setFileRunStart(null)

            const finalSnapshot = createSnapshot(aggregate)
            if (onProcessingProgress) {
                onProcessingProgress(finalSnapshot, null)
            }
            onProcessingComplete(finalSnapshot)
        } catch (error: any) {
            console.error('Error procesando CSV:', error)
            setStepDetails('')
            if (onProcessingError) {
                onProcessingError(error)
            }
            alert(`Error procesando CSV: ${error.message}`)
        } finally {
            setIsProcessing(false)
            if (fileRunStart != null) {
                const elapsed = performance.now() - fileRunStart
                setTotalElapsedMs(prev => prev ?? elapsed)
                setFileRunStart(null)
            }
        }
    }

    return (
        <div className="bg-white/80 backdrop-blur rounded-3xl shadow-xl border border-orange-100">
            <div className="p-8">
                <div className="text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 shadow-lg mb-6">
                        <Upload className="w-8 h-8 text-white" />
                    </div>

                    <h3 className="text-2xl font-bold text-gray-900 mb-2">
                        Procesamiento Unificado de CSV
                    </h3>
                    <p className="text-gray-600 mb-8 max-w-2xl mx-auto">
                        Sube tu archivo CSV y obtén direcciones normalizadas, limpiadas con IA y geocodificadas en un flujo continuo.
                        Puedes agrupar varias filas por lote para acelerar el procesamiento, teniendo en cuenta que los lotes grandes pueden reducir ligeramente la calidad del resultado.
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

                            <div className="text-left space-y-2">
                                <label htmlFor="batch-size" className="text-sm font-semibold text-gray-700">
                                    Tamaño del lote
                                </label>
                                <div className="flex flex-col sm:flex-row sm:items-center sm:gap-4 gap-2 bg-orange-50 border border-orange-100 rounded-xl p-4">
                                    <div className="flex items-center gap-3">
                                        <input
                                            id="batch-size"
                                            type="number"
                                            min={1}
                                            max={MAX_BATCH_SIZE}
                                            value={batchSize}
                                            onChange={handleBatchSizeChange}
                                            className="w-24 border border-orange-200 rounded-lg px-3 py-2 text-center text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400"
                                        />
                                        <span className="text-sm text-gray-600">{batchLabel}</span>
                                    </div>
                                    <p className="text-xs text-orange-700 sm:text-left">
                                        Lotes más grandes reducen el tiempo de espera, pero la IA puede cometer más errores.
                                    </p>
                                </div>
                            </div>

                            {/* Process Button */}
                            <Button
                                onClick={processCSV}
                                disabled={!file}
                                className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold py-4 px-8 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 text-lg"
                            >
                                <Sparkles className="w-5 h-5 mr-2" />
                                Procesar en lotes de {batchSize} {batchLabel}
                            </Button>

                            {/* Process Description */}
                            <div className="grid md:grid-cols-3 gap-4 mt-8 text-left">
                                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                                    <FileText className="w-6 h-6 text-blue-600 mb-2" />
                                    <h4 className="font-semibold text-blue-900 mb-1">1. Ingesta dinámica</h4>
                                    <p className="text-sm text-blue-700">Convertimos tu archivo en filas procesables y creamos el dataset en Firebase</p>
                                </div>
                                <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                                    <Sparkles className="w-6 h-6 text-purple-600 mb-2" />
                                    <h4 className="font-semibold text-purple-900 mb-1">2. Limpieza & Geocodificación</h4>
                                    <p className="text-sm text-purple-700">Cada fila se envía a OpenAI y Google Maps en tiempo real</p>
                                </div>
                                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                                    <MapPin className="w-6 h-6 text-green-600 mb-2" />
                                    <h4 className="font-semibold text-green-900 mb-1">3. Resultados inmediatos</h4>
                                    <p className="text-sm text-green-700">El panel muestra cada resultado al instante y guarda los registros</p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center space-y-4 py-6">
                            <div className="w-14 h-14 flex items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 via-amber-500 to-yellow-500 shadow-lg">
                                <Loader2 className="w-7 h-7 text-white animate-spin" />
                            </div>
                            <p className="text-sm font-medium text-gray-700">
                                {stepDetails || 'Procesando filas en tiempo real...'}
                            </p>
                            {debugMetricsAvailable && (
                                <div className="w-full max-w-md bg-gray-50 border border-gray-200 rounded-lg p-4 text-xs text-gray-600 space-y-2 text-left">
                                    <p className="font-semibold text-gray-700 uppercase tracking-wide text-[11px]">Debug Metrics</p>
                                    <div className="flex items-center justify-between">
                                        <span className="font-medium text-gray-700">Avg LLM Latency</span>
                                        <span className="text-gray-900 font-semibold">{averageLatencyDisplay}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="font-medium text-gray-700">Avg Batch Time</span>
                                        <span className="text-gray-900 font-semibold">{averageBatchDurationDisplay}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="font-medium text-gray-700">Total Runtime</span>
                                        <span className="text-gray-900 font-semibold">{totalElapsedDisplay}</span>
                                    </div>
                                </div>
                            )}
                            {totalRows != null && (
                                <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-gray-500">
                                    <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-700 font-semibold">
                                        {processedCount + skippedCount}/{totalRows} filas
                                    </span>
                                    {activeCsvId && (
                                        <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-600 font-mono">
                                            {activeCsvId}
                                        </span>
                                    )}
                                </div>
                            )}
                            <p className="text-xs text-gray-400">
                                Sigue el progreso y los resultados justo en el dashboard inferior.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
