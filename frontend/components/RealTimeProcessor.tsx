import React, { useState, useRef } from 'react'
import { Card } from './shared/ui/card'
import { Button } from './shared/ui/button'
import { Upload, FileText, Sparkles, MapPin, CheckCircle, XCircle, AlertCircle, Clock, Zap } from 'lucide-react'

interface ProcessedRow {
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
    }
    status: 'high_confidence' | 'medium_confidence' | 'low_confidence' | 'failed'
    error?: string
    googleMapsLink?: string | null
}

interface ProcessingStats {
    highConfidence: number
    mediumConfidence: number
    lowConfidence: number
    total: number
}

interface RowProcessingState {
    rowIndex: number
    address: string
    status: 'processing' | 'completed' | 'failed'
    duration?: number
    result?: ProcessedRow
    startTime: number
}

interface RealTimeProcessorProps {
    onProcessingComplete: (result: {
        success: boolean
        totalProcessed: number
        statistics: {
            highConfidence: number
            mediumConfidence: number
            lowConfidence: number
            totalRows: number
        }
        results: ProcessedRow[]
    }) => void
}

export default function RealTimeProcessor({ onProcessingComplete }: RealTimeProcessorProps) {
    const [file, setFile] = useState<File | null>(null)
    const [isProcessing, setIsProcessing] = useState(false)
    const [currentPhase, setCurrentPhase] = useState<'upload' | 'cleaning' | 'geocoding' | 'completed'>('upload')
    const [progress, setProgress] = useState(0)
    const [status, setStatus] = useState<string>('')
    const [totalRows, setTotalRows] = useState(0)
    const [processedRows, setProcessedRows] = useState<ProcessedRow[]>([])
    const [stats, setStats] = useState<ProcessingStats>({ highConfidence: 0, mediumConfidence: 0, lowConfidence: 0, total: 0 })
    const [activeRows, setActiveRows] = useState<RowProcessingState[]>([])
    const [recentlyCompleted, setRecentlyCompleted] = useState<Set<number>>(new Set())
    const [error, setError] = useState<string | null>(null)
    const eventSourceRef = useRef<EventSource | null>(null)

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = event.target.files?.[0]
        if (!selectedFile) return

        const name = selectedFile.name.toLowerCase()
        const isCsv = name.endsWith('.csv') || selectedFile.type === 'text/csv'
        const isExcel = name.endsWith('.xlsx') || name.endsWith('.xls') ||
            selectedFile.type.includes('spreadsheetml') || selectedFile.type.includes('ms-excel')

        if (isCsv || isExcel) {
            setFile(selectedFile)
            setCurrentPhase('upload')
            setProgress(0)
        } else {
            alert('Please upload a CSV or Excel file (.csv, .xlsx, .xls)')
        }
    }

    const resetState = () => {
        setIsProcessing(false)
        setCurrentPhase('upload')
        setProgress(0)
        setStatus('')
        setTotalRows(0)
        setProcessedRows([])
        setStats({ highConfidence: 0, mediumConfidence: 0, lowConfidence: 0, total: 0 })
        setActiveRows([])
        setRecentlyCompleted(new Set())
        setError(null)
        if (eventSourceRef.current) {
            eventSourceRef.current.close()
            eventSourceRef.current = null
        }
    }

    const startProcessing = async () => {
        if (!file) return
        
        resetState()
        setIsProcessing(true)
        setError(null)

        try {
            setCurrentPhase('cleaning')
            setStatus('Starting address processing...')
            setProgress(10)

            // Call the existing batch API and simulate streaming
            let response: Response

            const isExcel = file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls')
            
            if (isExcel) {
                // Convert XLSX to CSV first, then process
                const formData = new FormData()
                formData.append('file', file)
                
                const xlsxToCsvResponse = await fetch('/api/xlsx-to-csv', {
                    method: 'POST',
                    body: formData,
                })
                
                if (!xlsxToCsvResponse.ok) {
                    throw new Error(`Failed to convert Excel file: ${xlsxToCsvResponse.status}`)
                }
                
                const csvData = await xlsxToCsvResponse.text()
                
                response = await fetch('/api/process-complete', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'text/csv',
                    },
                    body: csvData,
                })
            } else {
                // Process CSV directly
                const csvText = await file.text()
                response = await fetch('/api/process-complete', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'text/csv',
                    },
                    body: csvText,
                })
            }

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`)
            }

            setCurrentPhase('geocoding')
            setStatus('Processing addresses with AI and geocoding...')
            setProgress(50)

            const result = await response.json()
            
            if (result.success && result.results) {
                setTotalRows(result.results.length)
                setStatus(`Processing ${result.results.length} addresses...`)
                setProgress(70)

                // Simulate streaming by adding results one by one with delays
                for (let i = 0; i < result.results.length; i++) {
                    const row = result.results[i]
                    const progress = Math.round(((i + 1) / result.results.length) * 100)
                    
                    // Simulate row start
                    const rowState: RowProcessingState = {
                        rowIndex: i,
                        address: row.cleaned.address,
                        status: 'processing',
                        startTime: Date.now()
                    }
                    
                    setActiveRows(prev => {
                        const filtered = prev.filter(r => r.rowIndex !== i)
                        return [...filtered, rowState].slice(-5)
                    })

                    // Small delay to show processing effect
                    await new Promise(resolve => setTimeout(resolve, 50))
                    
                    // Add completed result
                    setProcessedRows(prev => [...prev, row])
                    setProgress(70 + (progress * 0.3)) // Scale to 70-100%
                    
                    const newStats = {
                        highConfidence: result.statistics.highConfidence,
                        mediumConfidence: result.statistics.mediumConfidence,
                        lowConfidence: result.statistics.lowConfidence,
                        total: i + 1
                    }
                    setStats(newStats)
                    
                    // Update active row to completed
                    setActiveRows(prev => prev.map(r => 
                        r.rowIndex === i 
                            ? { ...r, status: 'completed', duration: 50, result: row }
                            : r
                    ))

                    // Add to recently completed for animation
                    setRecentlyCompleted(prev => new Set([...prev, i]))
                    setTimeout(() => {
                        setRecentlyCompleted(prev => {
                            const next = new Set(prev)
                            next.delete(i)
                            return next
                        })
                    }, 2000)
                }

                setCurrentPhase('completed')
                setProgress(100)
                setStatus(`Processing complete! ${result.totalProcessed} addresses processed.`)
                setIsProcessing(false)
                
                onProcessingComplete({
                    success: true,
                    totalProcessed: result.totalProcessed,
                    statistics: result.statistics,
                    results: result.results
                })
            } else {
                throw new Error('Processing failed')
            }

        } catch (error: any) {
            console.error('Processing error:', error)
            setError(error.message || 'Processing failed')
            setIsProcessing(false)
        }
    }


    const getPhaseIcon = (phase: string) => {
        switch (phase) {
            case 'upload': return <Upload className="w-5 h-5" />
            case 'cleaning': return <Sparkles className="w-5 h-5" />
            case 'geocoding': return <MapPin className="w-5 h-5" />
            case 'completed': return <CheckCircle className="w-5 h-5" />
            default: return <FileText className="w-5 h-5" />
        }
    }

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'high_confidence': return <CheckCircle className="w-4 h-4 text-green-500" />
            case 'medium_confidence': return <AlertCircle className="w-4 h-4 text-yellow-500" />
            case 'low_confidence': case 'failed': return <XCircle className="w-4 h-4 text-red-500" />
            default: return <Clock className="w-4 h-4 text-blue-500" />
        }
    }

    return (
        <div className="space-y-6">
            {/* File Upload */}
            <Card className="p-6 bg-white/50 backdrop-blur-sm border border-orange-100 shadow-lg">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">Real-Time Address Processing</h2>
                        <p className="text-gray-600">Upload your file and watch addresses get processed in real-time</p>
                    </div>
                    {getPhaseIcon(currentPhase)}
                </div>

                <div className="space-y-4">
                    <div className="border-2 border-dashed border-orange-200 rounded-lg p-6 text-center hover:border-orange-300 transition-colors">
                        <input
                            type="file"
                            accept=".csv,.xlsx,.xls"
                            onChange={handleFileUpload}
                            className="hidden"
                            id="file-upload"
                            disabled={isProcessing}
                        />
                        <label
                            htmlFor="file-upload"
                            className="cursor-pointer flex flex-col items-center space-y-2"
                        >
                            <Upload className="w-8 h-8 text-orange-500" />
                            <span className="text-sm font-medium text-gray-700">
                                {file ? file.name : 'Click to upload CSV or Excel file'}
                            </span>
                        </label>
                    </div>

                    {file && !isProcessing && (
                        <Button
                            onClick={startProcessing}
                            className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white"
                        >
                            <Zap className="w-4 h-4 mr-2" />
                            Start Real-Time Processing
                        </Button>
                    )}
                </div>
            </Card>

            {/* Processing Status */}
            {isProcessing && (
                <Card className="p-6 bg-white/50 backdrop-blur-sm border border-orange-100 shadow-lg">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                                {getPhaseIcon(currentPhase)}
                                <div>
                                    <h3 className="font-semibold text-gray-900 capitalize">{currentPhase}</h3>
                                    <p className="text-sm text-gray-600">{status}</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-2xl font-bold text-orange-600">{progress}%</div>
                                {totalRows > 0 && (
                                    <div className="text-sm text-gray-500">{stats.total} / {totalRows}</div>
                                )}
                            </div>
                        </div>

                        <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                                className="bg-gradient-to-r from-orange-500 to-amber-500 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${progress}%` }}
                            />
                        </div>

                        {/* Statistics */}
                        {stats.total > 0 && (
                            <div className="grid grid-cols-3 gap-4">
                                <div className="text-center p-3 bg-green-50 rounded-lg">
                                    <div className="text-lg font-bold text-green-700">{stats.highConfidence}</div>
                                    <div className="text-xs text-green-600">High Confidence</div>
                                </div>
                                <div className="text-center p-3 bg-yellow-50 rounded-lg">
                                    <div className="text-lg font-bold text-yellow-700">{stats.mediumConfidence}</div>
                                    <div className="text-xs text-yellow-600">Medium Confidence</div>
                                </div>
                                <div className="text-center p-3 bg-red-50 rounded-lg">
                                    <div className="text-lg font-bold text-red-700">{stats.lowConfidence}</div>
                                    <div className="text-xs text-red-600">Low Confidence</div>
                                </div>
                            </div>
                        )}
                    </div>
                </Card>
            )}

            {/* Active Processing Rows */}
            {activeRows.length > 0 && (
                <Card className="p-6 bg-white/50 backdrop-blur-sm border border-orange-100 shadow-lg">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                        <Clock className="w-5 h-5 mr-2 text-blue-500" />
                        Currently Processing
                    </h3>
                    <div className="space-y-2">
                        {activeRows.map((row) => {
                            const isRecent = recentlyCompleted.has(row.rowIndex)
                            return (
                                <div
                                    key={row.rowIndex}
                                    className={`flex items-center justify-between p-3 rounded-lg transition-all duration-500 ${
                                        isRecent 
                                            ? 'bg-green-50 border-l-4 border-green-500' 
                                            : row.status === 'processing' 
                                                ? 'bg-blue-50 border-l-4 border-blue-500' 
                                                : row.status === 'failed'
                                                    ? 'bg-red-50 border-l-4 border-red-500'
                                                    : 'bg-gray-50'
                                    }`}
                                >
                                    <div className="flex items-center space-x-3">
                                        <div className="text-sm font-medium text-gray-700">
                                            Row {row.rowIndex + 1}
                                        </div>
                                        <div className="text-sm text-gray-600 max-w-md truncate">
                                            {row.address}
                                        </div>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        {row.duration && (
                                            <span className="text-xs text-gray-500">{row.duration}ms</span>
                                        )}
                                        {row.result && getStatusIcon(row.result.status)}
                                        {row.status === 'processing' && (
                                            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </Card>
            )}

            {/* Error Display */}
            {error && (
                <Card className="p-6 bg-red-50 border border-red-200 shadow-lg">
                    <div className="flex items-center space-x-3">
                        <XCircle className="w-6 h-6 text-red-500" />
                        <div>
                            <h3 className="font-semibold text-red-900">Processing Error</h3>
                            <p className="text-sm text-red-700">{error}</p>
                        </div>
                    </div>
                </Card>
            )}
        </div>
    )
}
