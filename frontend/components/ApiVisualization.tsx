import { useState, useMemo } from 'react'
import { Card } from './shared/ui/card'
import { Button } from './shared/ui/button'
import {
    Activity,
    Clock,
    Database,
    MapPin,
    BarChart3,
    TrendingUp,
    AlertTriangle,
    CheckCircle,
    XCircle,
    RefreshCw,
    ChevronDown,
    ChevronRight,
    Eye,
    Code
} from 'lucide-react'

interface BatchDetail {
    batchIndex: number
    startRow: number
    endRow: number
    status: 'pending' | 'processing' | 'completed' | 'failed' | 'retrying'
    processingTime?: number
    error?: string
    retryCount?: number
}

interface GeocodingInteraction {
    timestamp: string
    rowIndex: number
    request: {
        address: string
        city: string
        state: string
        components: string[]
        url: string
    }
    response: {
        status: string
        results: any[]
        bestResult: any
        rawResponse: any
        responseTime: number
        httpStatus: number | null
        error: string | null
    }
    error?: string
}

interface BatchProcessingDebug {
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

interface ApiVisualizationProps {
    debug?: {
        batchProcessing?: BatchProcessingDebug
        geocodingInteractions?: GeocodingInteraction[]
    }
}

export default function ApiVisualization({ debug }: ApiVisualizationProps) {
    const [activeView, setActiveView] = useState<'timeline' | 'batches' | 'geocoding' | 'performance'>('timeline')
    const [expandedBatch, setExpandedBatch] = useState<number | null>(null)
    const [expandedGeocoding, setExpandedGeocoding] = useState<number | null>(null)

    // Process data for visualizations
    const processedData = useMemo(() => {
        if (!debug) return null

        const { batchProcessing, geocodingInteractions } = debug

        // Calculate timeline events
        const timelineEvents = []

        if (batchProcessing?.batchDetails) {
            batchProcessing.batchDetails.forEach(batch => {
                timelineEvents.push({
                    type: 'openai_batch',
                    timestamp: Date.now() - (batchProcessing.totalProcessingTime || 0) + (batch.processingTime || 0),
                    batchIndex: batch.batchIndex,
                    status: batch.status,
                    duration: batch.processingTime,
                    details: batch
                })
            })
        }

        if (geocodingInteractions) {
            geocodingInteractions.forEach(interaction => {
                timelineEvents.push({
                    type: 'geocoding',
                    timestamp: new Date(interaction.timestamp).getTime(),
                    rowIndex: interaction.rowIndex,
                    status: interaction.response.status === 'OK' ? 'completed' : 'failed',
                    duration: interaction.response.responseTime,
                    details: interaction
                })
            })
        }

        // Sort timeline events by timestamp
        timelineEvents.sort((a, b) => a.timestamp - b.timestamp)

        // Calculate performance metrics
        const performanceMetrics = {
            openai: {
                totalRequests: batchProcessing?.totalBatches || 0,
                successfulRequests: batchProcessing?.successfulBatches || 0,
                failedRequests: batchProcessing?.failedBatches || 0,
                averageResponseTime: batchProcessing?.averageTimePerBatch || 0,
                totalTime: batchProcessing?.totalProcessingTime || 0,
                successRate: batchProcessing?.successRate || 0
            },
            geocoding: {
                totalRequests: geocodingInteractions?.length || 0,
                successfulRequests: geocodingInteractions?.filter(i => i.response.status === 'OK').length || 0,
                failedRequests: geocodingInteractions?.filter(i => i.response.status !== 'OK').length || 0,
                averageResponseTime: geocodingInteractions?.length ?
                    geocodingInteractions.reduce((acc, i) => acc + i.response.responseTime, 0) / geocodingInteractions.length : 0,
                totalTime: geocodingInteractions?.reduce((acc, i) => acc + i.response.responseTime, 0) || 0,
                successRate: geocodingInteractions?.length ?
                    (geocodingInteractions.filter(i => i.response.status === 'OK').length / geocodingInteractions.length) * 100 : 0
            }
        }

        return {
            timelineEvents,
            performanceMetrics
        }
    }, [debug])

    if (!debug || !processedData) {
        return (
            <Card className="p-6 bg-white/50 backdrop-blur-sm border border-orange-100 shadow-lg">
                <div className="text-center text-gray-500">
                    <Activity className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                    <h3 className="text-lg font-semibold mb-2">No Debug Data Available</h3>
                    <p>Process a CSV file to see API interaction visualizations</p>
                </div>
            </Card>
        )
    }

    const renderTimelineView = () => (
        <div className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-semibold text-gray-900 mb-3">Processing Timeline</h4>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                    {processedData.timelineEvents.map((event, index) => (
                        <div key={index} className="flex items-center space-x-4 p-3 bg-white rounded border">
                            <div className="flex-shrink-0">
                                {event.type === 'openai_batch' ? (
                                    <Database className={`w-5 h-5 ${event.status === 'completed' ? 'text-blue-500' :
                                            event.status === 'failed' ? 'text-red-500' :
                                                event.status === 'retrying' ? 'text-yellow-500' : 'text-gray-500'
                                        }`} />
                                ) : (
                                    <MapPin className={`w-5 h-5 ${event.status === 'completed' ? 'text-green-500' : 'text-red-500'
                                        }`} />
                                )}
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center justify-between">
                                    <span className="font-medium">
                                        {event.type === 'openai_batch'
                                            ? `OpenAI Batch ${event.batchIndex + 1}`
                                            : `Geocoding Row ${event.rowIndex + 1}`}
                                    </span>
                                    <span className="text-sm text-gray-500">
                                        {event.duration ? `${event.duration}ms` : ''}
                                    </span>
                                </div>
                                <div className="text-sm text-gray-600">
                                    {event.type === 'openai_batch'
                                        ? `Rows ${(event.details as BatchDetail).startRow}-${(event.details as BatchDetail).endRow}`
                                        : `Address: ${(event.details as GeocodingInteraction).request.address}`}
                                </div>
                                <div className="flex items-center space-x-2 mt-1">
                                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${event.status === 'completed' ? 'bg-green-100 text-green-800' :
                                            event.status === 'failed' ? 'bg-red-100 text-red-800' :
                                                event.status === 'retrying' ? 'bg-yellow-100 text-yellow-800' :
                                                    'bg-gray-100 text-gray-800'
                                        }`}>
                                        {event.status}
                                    </span>
                                    {event.type === 'openai_batch' && (event.details as BatchDetail).retryCount && (event.details as BatchDetail).retryCount! > 0 && (
                                        <span className="px-2 py-0.5 text-xs bg-orange-100 text-orange-800 rounded-full">
                                            {(event.details as BatchDetail).retryCount} retries
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )

    const renderBatchesView = () => (
        <div className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-semibold text-gray-900 mb-3">OpenAI Batch Processing Details</h4>

                {/* Batch Summary */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-white p-3 rounded border">
                        <div className="flex items-center">
                            <Database className="w-5 h-5 text-blue-500 mr-2" />
                            <div>
                                <p className="text-sm text-gray-600">Total Batches</p>
                                <p className="text-lg font-bold text-gray-900">{debug.batchProcessing?.totalBatches || 0}</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white p-3 rounded border">
                        <div className="flex items-center">
                            <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                            <div>
                                <p className="text-sm text-gray-600">Successful</p>
                                <p className="text-lg font-bold text-green-600">{debug.batchProcessing?.successfulBatches || 0}</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white p-3 rounded border">
                        <div className="flex items-center">
                            <XCircle className="w-5 h-5 text-red-500 mr-2" />
                            <div>
                                <p className="text-sm text-gray-600">Failed</p>
                                <p className="text-lg font-bold text-red-600">{debug.batchProcessing?.failedBatches || 0}</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white p-3 rounded border">
                        <div className="flex items-center">
                            <Clock className="w-5 h-5 text-blue-500 mr-2" />
                            <div>
                                <p className="text-sm text-gray-600">Avg Time</p>
                                <p className="text-lg font-bold text-blue-600">{debug.batchProcessing?.averageTimePerBatch || 0}ms</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Individual Batch Details */}
                <div className="space-y-2 max-h-96 overflow-y-auto">
                    {debug.batchProcessing?.batchDetails?.map((batch, index) => (
                        <div key={index} className="border border-gray-200 rounded-lg bg-white">
                            <button
                                onClick={() => setExpandedBatch(expandedBatch === index ? null : index)}
                                className="w-full p-4 text-left flex items-center justify-between hover:bg-gray-50"
                            >
                                <div className="flex items-center space-x-3">
                                    {batch.status === 'completed' ? (
                                        <CheckCircle className="w-5 h-5 text-green-500" />
                                    ) : batch.status === 'failed' ? (
                                        <XCircle className="w-5 h-5 text-red-500" />
                                    ) : batch.status === 'retrying' ? (
                                        <RefreshCw className="w-5 h-5 text-yellow-500" />
                                    ) : (
                                        <Activity className="w-5 h-5 text-gray-500" />
                                    )}
                                    <div>
                                        <h6 className="font-medium">Batch {batch.batchIndex + 1}</h6>
                                        <p className="text-sm text-gray-600">
                                            Rows {batch.startRow}-{batch.endRow} • {batch.processingTime || 0}ms
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                    {batch.retryCount && batch.retryCount > 0 && (
                                        <span className="px-2 py-1 text-xs bg-orange-100 text-orange-800 rounded-full">
                                            {batch.retryCount} retries
                                        </span>
                                    )}
                                    {expandedBatch === index ? (
                                        <ChevronDown className="w-5 h-5 text-gray-400" />
                                    ) : (
                                        <ChevronRight className="w-5 h-5 text-gray-400" />
                                    )}
                                </div>
                            </button>

                            {expandedBatch === index && (
                                <div className="border-t border-gray-200 p-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <h6 className="font-medium text-gray-900 mb-2">Batch Information</h6>
                                            <div className="space-y-1">
                                                <p><span className="font-medium">Status:</span> {batch.status}</p>
                                                <p><span className="font-medium">Start Row:</span> {batch.startRow}</p>
                                                <p><span className="font-medium">End Row:</span> {batch.endRow}</p>
                                                <p><span className="font-medium">Processing Time:</span> {batch.processingTime || 0}ms</p>
                                                <p><span className="font-medium">Retry Count:</span> {batch.retryCount || 0}</p>
                                            </div>
                                        </div>
                                        {batch.error && (
                                            <div>
                                                <h6 className="font-medium text-red-700 mb-2">Error Details</h6>
                                                <div className="bg-red-50 p-3 rounded border border-red-200">
                                                    <p className="text-red-700 text-sm">{batch.error}</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )

    const renderGeocodingView = () => (
        <div className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-semibold text-gray-900 mb-3">Geocoding API Interactions</h4>

                {/* Geocoding Summary */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-white p-3 rounded border">
                        <div className="flex items-center">
                            <MapPin className="w-5 h-5 text-blue-500 mr-2" />
                            <div>
                                <p className="text-sm text-gray-600">Total Requests</p>
                                <p className="text-lg font-bold text-gray-900">{debug.geocodingInteractions?.length || 0}</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white p-3 rounded border">
                        <div className="flex items-center">
                            <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                            <div>
                                <p className="text-sm text-gray-600">Successful</p>
                                <p className="text-lg font-bold text-green-600">
                                    {debug.geocodingInteractions?.filter(i => i.response.status === 'OK').length || 0}
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white p-3 rounded border">
                        <div className="flex items-center">
                            <XCircle className="w-5 h-5 text-red-500 mr-2" />
                            <div>
                                <p className="text-sm text-gray-600">Failed</p>
                                <p className="text-lg font-bold text-red-600">
                                    {debug.geocodingInteractions?.filter(i => i.response.status !== 'OK').length || 0}
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white p-3 rounded border">
                        <div className="flex items-center">
                            <Clock className="w-5 h-5 text-blue-500 mr-2" />
                            <div>
                                <p className="text-sm text-gray-600">Avg Time</p>
                                <p className="text-lg font-bold text-blue-600">
                                    {processedData.performanceMetrics.geocoding.averageResponseTime.toFixed(0)}ms
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Individual Geocoding Details */}
                <div className="space-y-2 max-h-96 overflow-y-auto">
                    {debug.geocodingInteractions?.map((interaction, index) => (
                        <div key={index} className="border border-gray-200 rounded-lg bg-white">
                            <button
                                onClick={() => setExpandedGeocoding(expandedGeocoding === index ? null : index)}
                                className="w-full p-4 text-left flex items-center justify-between hover:bg-gray-50"
                            >
                                <div className="flex items-center space-x-3">
                                    {interaction.response.status === 'OK' ? (
                                        <CheckCircle className="w-5 h-5 text-green-500" />
                                    ) : (
                                        <XCircle className="w-5 h-5 text-red-500" />
                                    )}
                                    <div>
                                        <h6 className="font-medium">Row {interaction.rowIndex + 1}</h6>
                                        <p className="text-sm text-gray-600 truncate max-w-md">
                                            {interaction.request.address} • {interaction.response.responseTime}ms
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <span className={`px-2 py-1 text-xs rounded-full ${interaction.response.status === 'OK'
                                            ? 'bg-green-100 text-green-800'
                                            : 'bg-red-100 text-red-800'
                                        }`}>
                                        {interaction.response.status}
                                    </span>
                                    {expandedGeocoding === index ? (
                                        <ChevronDown className="w-5 h-5 text-gray-400" />
                                    ) : (
                                        <ChevronRight className="w-5 h-5 text-gray-400" />
                                    )}
                                </div>
                            </button>

                            {expandedGeocoding === index && (
                                <div className="border-t border-gray-200 p-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {/* Request Details */}
                                        <div>
                                            <h6 className="font-medium text-blue-700 mb-2">Request</h6>
                                            <div className="bg-blue-50 p-3 rounded border text-sm">
                                                <p><span className="font-medium">Address:</span> {interaction.request.address}</p>
                                                <p><span className="font-medium">City:</span> {interaction.request.city}</p>
                                                <p><span className="font-medium">State:</span> {interaction.request.state}</p>
                                                <p><span className="font-medium">Components:</span> {interaction.request.components.join(', ')}</p>
                                                <div className="mt-2">
                                                    <span className="font-medium">URL:</span>
                                                    <p className="text-xs break-all mt-1 bg-white p-2 rounded border">
                                                        {interaction.request.url}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Response Details */}
                                        <div>
                                            <h6 className="font-medium text-green-700 mb-2">Response</h6>
                                            <div className="bg-green-50 p-3 rounded border text-sm">
                                                <p><span className="font-medium">Status:</span> {interaction.response.status}</p>
                                                <p><span className="font-medium">Results Count:</span> {interaction.response.results.length}</p>
                                                <p><span className="font-medium">Response Time:</span> {interaction.response.responseTime}ms</p>
                                                <p><span className="font-medium">HTTP Status:</span> {interaction.response.httpStatus || 'N/A'}</p>

                                                {interaction.response.bestResult && (
                                                    <div className="mt-2">
                                                        <span className="font-medium">Best Result:</span>
                                                        <div className="bg-white p-2 rounded border mt-1">
                                                            <p><span className="font-medium">Address:</span> {interaction.response.bestResult.formatted_address}</p>
                                                            <p><span className="font-medium">Location:</span> {interaction.response.bestResult.geometry.location.lat}, {interaction.response.bestResult.geometry.location.lng}</p>
                                                            <p><span className="font-medium">Type:</span> {interaction.response.bestResult.geometry.location_type}</p>
                                                            <p><span className="font-medium">Confidence:</span> {(interaction.response.bestResult.confidence * 100).toFixed(1)}%</p>
                                                        </div>
                                                    </div>
                                                )}

                                                {interaction.response.error && (
                                                    <div className="mt-2">
                                                        <span className="font-medium text-red-700">Error:</span>
                                                        <p className="text-red-700 bg-red-100 p-2 rounded border mt-1">
                                                            {interaction.response.error}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Raw Response */}
                                    {interaction.response.rawResponse && (
                                        <div className="mt-4">
                                            <h6 className="font-medium text-gray-700 mb-2">Raw Response</h6>
                                            <div className="bg-gray-100 p-3 rounded border">
                                                <pre className="text-xs overflow-x-auto">
                                                    {JSON.stringify(interaction.response.rawResponse, null, 2)}
                                                </pre>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )

    const renderPerformanceView = () => (
        <div className="space-y-6">
            {/* Performance Comparison */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* OpenAI Performance */}
                <Card className="p-4">
                    <div className="flex items-center mb-4">
                        <Database className="w-6 h-6 text-blue-500 mr-2" />
                        <h4 className="font-semibold text-gray-900">OpenAI Performance</h4>
                    </div>
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">Success Rate</span>
                            <span className="font-medium">{processedData.performanceMetrics.openai.successRate}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                                className="bg-blue-500 h-2 rounded-full"
                                style={{ width: `${processedData.performanceMetrics.openai.successRate}%` }}
                            ></div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <p className="text-gray-600">Total Requests</p>
                                <p className="font-bold text-gray-900">{processedData.performanceMetrics.openai.totalRequests}</p>
                            </div>
                            <div>
                                <p className="text-gray-600">Avg Time</p>
                                <p className="font-bold text-gray-900">{processedData.performanceMetrics.openai.averageResponseTime}ms</p>
                            </div>
                            <div>
                                <p className="text-gray-600">Successful</p>
                                <p className="font-bold text-green-600">{processedData.performanceMetrics.openai.successfulRequests}</p>
                            </div>
                            <div>
                                <p className="text-gray-600">Failed</p>
                                <p className="font-bold text-red-600">{processedData.performanceMetrics.openai.failedRequests}</p>
                            </div>
                        </div>
                    </div>
                </Card>

                {/* Geocoding Performance */}
                <Card className="p-4">
                    <div className="flex items-center mb-4">
                        <MapPin className="w-6 h-6 text-green-500 mr-2" />
                        <h4 className="font-semibold text-gray-900">Geocoding Performance</h4>
                    </div>
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">Success Rate</span>
                            <span className="font-medium">{processedData.performanceMetrics.geocoding.successRate.toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                                className="bg-green-500 h-2 rounded-full"
                                style={{ width: `${processedData.performanceMetrics.geocoding.successRate}%` }}
                            ></div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <p className="text-gray-600">Total Requests</p>
                                <p className="font-bold text-gray-900">{processedData.performanceMetrics.geocoding.totalRequests}</p>
                            </div>
                            <div>
                                <p className="text-gray-600">Avg Time</p>
                                <p className="font-bold text-gray-900">{processedData.performanceMetrics.geocoding.averageResponseTime.toFixed(0)}ms</p>
                            </div>
                            <div>
                                <p className="text-gray-600">Successful</p>
                                <p className="font-bold text-green-600">{processedData.performanceMetrics.geocoding.successfulRequests}</p>
                            </div>
                            <div>
                                <p className="text-gray-600">Failed</p>
                                <p className="font-bold text-red-600">{processedData.performanceMetrics.geocoding.failedRequests}</p>
                            </div>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Processing Timeline Chart */}
            <Card className="p-4">
                <div className="flex items-center mb-4">
                    <TrendingUp className="w-6 h-6 text-purple-500 mr-2" />
                    <h4 className="font-semibold text-gray-900">Processing Timeline</h4>
                </div>
                <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                        <span>Total Processing Time</span>
                        <span className="font-medium">
                            {((processedData.performanceMetrics.openai.totalTime + processedData.performanceMetrics.geocoding.totalTime) / 1000).toFixed(1)}s
                        </span>
                    </div>
                    <div className="flex h-8 bg-gray-200 rounded overflow-hidden">
                        <div
                            className="bg-blue-500 flex items-center justify-center text-xs text-white font-medium"
                            style={{
                                width: `${(processedData.performanceMetrics.openai.totalTime / (processedData.performanceMetrics.openai.totalTime + processedData.performanceMetrics.geocoding.totalTime)) * 100}%`
                            }}
                        >
                            OpenAI
                        </div>
                        <div
                            className="bg-green-500 flex items-center justify-center text-xs text-white font-medium"
                            style={{
                                width: `${(processedData.performanceMetrics.geocoding.totalTime / (processedData.performanceMetrics.openai.totalTime + processedData.performanceMetrics.geocoding.totalTime)) * 100}%`
                            }}
                        >
                            Geocoding
                        </div>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500">
                        <span>OpenAI: {(processedData.performanceMetrics.openai.totalTime / 1000).toFixed(1)}s</span>
                        <span>Geocoding: {(processedData.performanceMetrics.geocoding.totalTime / 1000).toFixed(1)}s</span>
                    </div>
                </div>
            </Card>

            {/* API Rate Limits and Recommendations */}
            <Card className="p-4">
                <div className="flex items-center mb-4">
                    <AlertTriangle className="w-6 h-6 text-yellow-500 mr-2" />
                    <h4 className="font-semibold text-gray-900">Performance Insights</h4>
                </div>
                <div className="space-y-3 text-sm">
                    <div className="bg-blue-50 p-3 rounded border border-blue-200">
                        <h6 className="font-medium text-blue-800 mb-1">OpenAI Processing</h6>
                        <p className="text-blue-700">
                            {processedData.performanceMetrics.openai.successRate > 95
                                ? "✅ Excellent performance! All batches processed successfully."
                                : processedData.performanceMetrics.openai.successRate > 85
                                    ? "⚠️ Good performance with some retries. Consider monitoring batch sizes."
                                    : "❌ Poor performance detected. Check API rate limits and network connectivity."}
                        </p>
                    </div>
                    <div className="bg-green-50 p-3 rounded border border-green-200">
                        <h6 className="font-medium text-green-800 mb-1">Geocoding Performance</h6>
                        <p className="text-green-700">
                            {processedData.performanceMetrics.geocoding.successRate > 90
                                ? "✅ Excellent geocoding accuracy! Most addresses found successfully."
                                : processedData.performanceMetrics.geocoding.successRate > 70
                                    ? "⚠️ Good geocoding rate. Some addresses may need manual review."
                                    : "❌ Low geocoding success rate. Consider improving address quality."}
                        </p>
                    </div>
                    <div className="bg-purple-50 p-3 rounded border border-purple-200">
                        <h6 className="font-medium text-purple-800 mb-1">Optimization Recommendations</h6>
                        <ul className="text-purple-700 space-y-1">
                            <li>• Average batch processing time: {processedData.performanceMetrics.openai.averageResponseTime}ms</li>
                            <li>• Average geocoding time: {processedData.performanceMetrics.geocoding.averageResponseTime.toFixed(0)}ms</li>
                            <li>• {processedData.performanceMetrics.openai.averageResponseTime > 10000
                                ? "Consider reducing batch size to improve response times"
                                : "Batch sizes are optimal for current performance"}</li>
                        </ul>
                    </div>
                </div>
            </Card>
        </div>
    )

    return (
        <Card className="bg-white/50 backdrop-blur-sm border border-orange-100 shadow-lg overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900">API Request Visualization</h3>
                        <p className="text-sm text-gray-600">Detailed analysis of OpenAI and Geocoding API interactions</p>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Eye className="w-5 h-5 text-gray-400" />
                        <span className="text-sm text-gray-500">Live Debug Data</span>
                    </div>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex border-b border-gray-200 bg-gray-50">
                {[
                    { id: 'timeline', label: 'Timeline', icon: Activity },
                    { id: 'batches', label: 'OpenAI Batches', icon: Database },
                    { id: 'geocoding', label: 'Geocoding', icon: MapPin },
                    { id: 'performance', label: 'Performance', icon: BarChart3 }
                ].map(({ id, label, icon: Icon }) => (
                    <button
                        key={id}
                        onClick={() => setActiveView(id as typeof activeView)}
                        className={`px-6 py-3 text-sm font-medium transition-colors flex items-center space-x-2 ${activeView === id
                                ? 'bg-white text-orange-600 border-b-2 border-orange-600'
                                : 'text-gray-600 hover:text-orange-600 hover:bg-orange-50'
                            }`}
                    >
                        <Icon className="w-4 h-4" />
                        <span>{label}</span>
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="p-6">
                {activeView === 'timeline' && renderTimelineView()}
                {activeView === 'batches' && renderBatchesView()}
                {activeView === 'geocoding' && renderGeocodingView()}
                {activeView === 'performance' && renderPerformanceView()}
            </div>
        </Card>
    )
}
