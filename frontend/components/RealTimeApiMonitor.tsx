import { useState, useEffect, useRef } from 'react'
import { Card } from './shared/ui/card'
import { Button } from './shared/ui/button'
import {
    Activity,
    Clock,
    Database,
    MapPin,
    CheckCircle,
    XCircle,
    RefreshCw,
    Play,
    Pause,
    Eye,
    EyeOff,
    Server
} from 'lucide-react'
import type { ApiCallRecord, ApiCallType } from '../lib/api-monitor'
import { enableFetchMonitoring, subscribeToApiMonitor } from '../lib/api-monitor'

interface RealTimeApiMonitorProps {
    isProcessing: boolean
    onToggle?: () => void
}

const TYPE_FILTERS: Array<{ key: ApiCallType; label: string }> = [
    { key: 'openai', label: 'OpenAI' },
    { key: 'geocoding', label: 'Geocoding' },
    { key: 'backend', label: 'Backend' },
    { key: 'other', label: 'Other' }
]

export default function RealTimeApiMonitor({ isProcessing, onToggle }: RealTimeApiMonitorProps) {
    const [apiCalls, setApiCalls] = useState<ApiCallRecord[]>([])
    const [isVisible, setIsVisible] = useState(true)
    const [autoScroll, setAutoScroll] = useState(true)
    const [filter, setFilter] = useState<'all' | ApiCallType>('all')
    const callsEndRef = useRef<HTMLDivElement>(null)

    // Enable global fetch monitoring once and subscribe to updates
    useEffect(() => {
        enableFetchMonitoring()
        const unsubscribe = subscribeToApiMonitor(setApiCalls)
        return () => unsubscribe()
    }, [])

    // Reset filter if the selected type disappears (e.g. after clearing calls)
    useEffect(() => {
        if (filter === 'all') return
        const hasType = apiCalls.some(call => call.type === filter)
        if (!hasType) {
            setFilter('all')
        }
    }, [apiCalls, filter])

    // Auto-scroll to latest entry
    useEffect(() => {
        if (autoScroll && callsEndRef.current) {
            callsEndRef.current.scrollIntoView({ behavior: 'smooth' })
        }
    }, [apiCalls, autoScroll])

    const filteredCalls = apiCalls.filter(call => filter === 'all' || call.type === filter)

    const statsByType: Record<ApiCallType, number> = {
        openai: apiCalls.filter(call => call.type === 'openai').length,
        geocoding: apiCalls.filter(call => call.type === 'geocoding').length,
        backend: apiCalls.filter(call => call.type === 'backend').length,
        other: apiCalls.filter(call => call.type === 'other').length
    }

    const stats = {
        total: apiCalls.length,
        completed: apiCalls.filter(call => call.status === 'completed').length,
        failed: apiCalls.filter(call => call.status === 'failed').length,
        inProgress: apiCalls.filter(call => call.status === 'in-progress').length
    }

    const getStatusIcon = (status: ApiCallRecord['status']) => {
        switch (status) {
            case 'completed':
                return <CheckCircle className="w-4 h-4 text-green-500" />
            case 'failed':
                return <XCircle className="w-4 h-4 text-red-500" />
            case 'in-progress':
                return <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />
            default:
                return <Clock className="w-4 h-4 text-gray-400" />
        }
    }

    const getTypeIcon = (type: ApiCallType) => {
        switch (type) {
            case 'openai':
                return <Database className="w-4 h-4 text-blue-600" />
            case 'geocoding':
                return <MapPin className="w-4 h-4 text-green-600" />
            case 'backend':
                return <Server className="w-4 h-4 text-purple-600" />
            default:
                return <Activity className="w-4 h-4 text-gray-500" />
        }
    }

    const availableFilters = TYPE_FILTERS.filter(({ key }) => statsByType[key] > 0)

    const formatPrimaryLabel = (call: ApiCallRecord) => {
        if (call.type === 'openai' && typeof call.details.batchIndex === 'number') {
            return `Batch ${call.details.batchIndex}`
        }
        if (call.type === 'geocoding' && typeof call.details.rowIndex === 'number') {
            return `Row ${call.details.rowIndex}`
        }
        if (call.details.method) {
            return `${call.details.method} request`
        }
        return call.type.charAt(0).toUpperCase() + call.type.slice(1)
    }

    const formatResponseStatus = (call: ApiCallRecord) => {
        const response = call.details.response
        if (!response || typeof response !== 'object') return null

        const responseRecord = response as Record<string, unknown>
        const pieces: string[] = []

        if (typeof responseRecord.status !== 'undefined') {
            pieces.push(String(responseRecord.status))
        }

        if (typeof responseRecord.httpStatus !== 'undefined') {
            pieces.push(`HTTP ${responseRecord.httpStatus}`)
        }

        if (
            pieces.length === 0 &&
            typeof responseRecord.ok === 'boolean'
        ) {
            pieces.push(responseRecord.ok ? 'OK' : 'FAILED')
        }

        return pieces.length ? pieces.join(' • ') : null
    }

    if (!isVisible) {
        return (
            <div className="fixed bottom-4 right-4 z-50">
                <Button
                    onClick={() => {
                        setIsVisible(true)
                        onToggle?.()
                    }}
                    className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white shadow-lg"
                >
                    <Eye className="w-4 h-4 mr-2" />
                    Show API Monitor
                </Button>
            </div>
        )
    }

    return (
        <div className="fixed bottom-4 right-4 w-96 max-h-96 z-50">
            <Card className="bg-white/95 backdrop-blur-md border border-gray-200 shadow-xl overflow-hidden">
                {/* Header */}
                <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                            <Activity className="w-5 h-5 text-blue-600" />
                            <h3 className="font-semibold text-gray-900">API Monitor</h3>
                            {isProcessing && (
                                <div className="flex items-center space-x-1">
                                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                    <span className="text-xs text-green-600 font-medium">LIVE</span>
                                </div>
                            )}
                        </div>
                        <div className="flex items-center space-x-1">
                            <Button
                                onClick={() => setAutoScroll(!autoScroll)}
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                title={autoScroll ? 'Disable auto-scroll' : 'Enable auto-scroll'}
                            >
                                {autoScroll ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                            </Button>
                            <Button
                                onClick={() => {
                                    setIsVisible(false)
                                    onToggle?.()
                                }}
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                            >
                                <EyeOff className="w-3 h-3" />
                            </Button>
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-2 mt-3">
                        <div className="text-center">
                            <p className="text-xs text-gray-600">Total</p>
                            <p className="text-sm font-bold text-gray-900">{stats.total}</p>
                        </div>
                        <div className="text-center">
                            <p className="text-xs text-gray-600">Success</p>
                            <p className="text-sm font-bold text-green-600">{stats.completed}</p>
                        </div>
                        <div className="text-center">
                            <p className="text-xs text-gray-600">Failed</p>
                            <p className="text-sm font-bold text-red-600">{stats.failed}</p>
                        </div>
                    </div>

                    {/* Filter */}
                    <div className="flex flex-wrap gap-1 mt-3">
                        <button
                            onClick={() => setFilter('all')}
                            className={`px-2 py-1 text-xs font-medium rounded ${filter === 'all'
                                ? 'bg-blue-500 text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                        >
                            All
                        </button>
                        {(availableFilters.length > 0 ? availableFilters : TYPE_FILTERS).map(({ key, label }) => (
                            <button
                                key={key}
                                onClick={() => setFilter(key)}
                                className={`px-2 py-1 text-xs font-medium rounded ${filter === key
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* API Calls List */}
                <div className="max-h-64 overflow-y-auto">
                    {filteredCalls.length === 0 ? (
                        <div className="p-4 text-center text-gray-500 text-sm">
                            {isProcessing ? 'Waiting for API calls...' : 'No API calls yet'}
                        </div>
                    ) : (
                        <div className="p-2 space-y-1">
                            {filteredCalls.slice(-20).map((call) => {
                                const responseStatus = formatResponseStatus(call)
                                return (
                                    <div
                                        key={call.id}
                                        className={`p-2 rounded-lg border transition-all duration-300 ${call.status === 'completed' ? 'bg-green-50 border-green-200' :
                                                call.status === 'failed' ? 'bg-red-50 border-red-200' :
                                                    call.status === 'in-progress' ? 'bg-blue-50 border-blue-200' :
                                                        'bg-gray-50 border-gray-200'
                                            }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center space-x-2">
                                                {getTypeIcon(call.type)}
                                                <span className="text-xs font-medium">
                                                    {formatPrimaryLabel(call)}
                                                </span>
                                            </div>
                                            <div className="flex items-center space-x-1">
                                                {getStatusIcon(call.status)}
                                                {typeof call.duration === 'number' && (
                                                    <span className="text-xs text-gray-500">
                                                        {Math.round(call.duration)}ms
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {call.details.endpoint && (
                                            <div className="text-xs text-gray-500 truncate mt-1">
                                                {call.details.method ? `${call.details.method} · ` : ''}{call.details.endpoint}
                                            </div>
                                        )}

                                        {call.type === 'geocoding' && call.details.address && (
                                            <div className="text-xs text-gray-600 truncate mt-1">
                                                {call.details.address}
                                            </div>
                                        )}

                                        {responseStatus && (
                                            <div className="text-xs text-gray-500 mt-1">
                                                {responseStatus}
                                            </div>
                                        )}

                                        {call.details.error && (
                                            <div className="text-xs text-red-600 mt-1">
                                                {call.details.error}
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                            <div ref={callsEndRef} />
                        </div>
                    )}
                </div>

                {/* Performance Summary */}
                {stats.total > 0 && (
                    <div className="border-t border-gray-200 p-2 bg-gray-50">
                        <div className="flex justify-between text-xs">
                            <span>Success Rate:</span>
                            <span className="font-medium">
                                {stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0}%
                            </span>
                        </div>
                        <div className="flex flex-wrap gap-x-2 gap-y-1 text-xs mt-1">
                            {TYPE_FILTERS.filter(({ key }) => statsByType[key] > 0).map(({ key, label }) => (
                                <span key={key}>{label}: {statsByType[key]}</span>
                            ))}
                        </div>
                    </div>
                )}
            </Card>
        </div>
    )
}
