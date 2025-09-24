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
    EyeOff
} from 'lucide-react'

interface ApiCall {
    id: string
    type: 'openai' | 'geocoding'
    timestamp: number
    status: 'pending' | 'in-progress' | 'completed' | 'failed'
    duration?: number
    details: {
        batchIndex?: number
        rowIndex?: number
        address?: string
        endpoint?: string
        request?: any
        response?: any
        error?: string
    }
}

interface RealTimeApiMonitorProps {
    isProcessing: boolean
    onToggle?: () => void
}

export default function RealTimeApiMonitor({ isProcessing, onToggle }: RealTimeApiMonitorProps) {
    const [apiCalls, setApiCalls] = useState<ApiCall[]>([])
    const [isVisible, setIsVisible] = useState(true)
    const [autoScroll, setAutoScroll] = useState(true)
    const [filter, setFilter] = useState<'all' | 'openai' | 'geocoding'>('all')
    const callsEndRef = useRef<HTMLDivElement>(null)

    // Simulate API call tracking (in real implementation, this would come from the API processing)
    useEffect(() => {
        if (!isProcessing) return

        const interval = setInterval(() => {
            // Simulate random API calls during processing
            const randomType = Math.random() > 0.3 ? 'geocoding' : 'openai'
            const newCall: ApiCall = {
                id: `${Date.now()}-${Math.random()}`,
                type: randomType,
                timestamp: Date.now(),
                status: 'pending',
                details: randomType === 'openai'
                    ? {
                        batchIndex: Math.floor(Math.random() * 5),
                        endpoint: '/api/process-complete'
                    }
                    : {
                        rowIndex: Math.floor(Math.random() * 50),
                        address: `Sample Address ${Math.floor(Math.random() * 100)}`,
                        endpoint: 'https://maps.googleapis.com/maps/api/geocode/json'
                    }
            }

            setApiCalls(prev => [...prev, newCall])

            // Simulate processing time
            setTimeout(() => {
                setApiCalls(prev => prev.map(call =>
                    call.id === newCall.id
                        ? {
                            ...call,
                            status: 'in-progress',
                            duration: Math.random() * 2000 + 500
                        }
                        : call
                ))

                // Complete the call
                setTimeout(() => {
                    setApiCalls(prev => prev.map(call =>
                        call.id === newCall.id
                            ? {
                                ...call,
                                status: Math.random() > 0.1 ? 'completed' : 'failed',
                                duration: Math.random() * 3000 + 500,
                                details: {
                                    ...call.details,
                                    response: Math.random() > 0.1 ? { status: 'OK' } : null,
                                    error: Math.random() > 0.1 ? null : 'Request failed'
                                }
                            }
                            : call
                    ))
                }, Math.random() * 1000 + 500)
            }, 100)
        }, Math.random() * 800 + 200)

        return () => clearInterval(interval)
    }, [isProcessing])

    // Auto-scroll to bottom
    useEffect(() => {
        if (autoScroll && callsEndRef.current) {
            callsEndRef.current.scrollIntoView({ behavior: 'smooth' })
        }
    }, [apiCalls, autoScroll])

    // Clear old calls to prevent memory issues
    useEffect(() => {
        if (apiCalls.length > 100) {
            setApiCalls(prev => prev.slice(-50))
        }
    }, [apiCalls.length])

    const filteredCalls = apiCalls.filter(call =>
        filter === 'all' || call.type === filter
    )

    const stats = {
        total: apiCalls.length,
        openai: apiCalls.filter(c => c.type === 'openai').length,
        geocoding: apiCalls.filter(c => c.type === 'geocoding').length,
        completed: apiCalls.filter(c => c.status === 'completed').length,
        failed: apiCalls.filter(c => c.status === 'failed').length,
        inProgress: apiCalls.filter(c => c.status === 'in-progress').length
    }

    const getStatusIcon = (status: ApiCall['status']) => {
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

    const getTypeIcon = (type: ApiCall['type']) => {
        return type === 'openai'
            ? <Database className="w-4 h-4 text-blue-600" />
            : <MapPin className="w-4 h-4 text-green-600" />
    }

    if (!isVisible) {
        return (
            <div className="fixed bottom-4 right-4 z-50">
                <Button
                    onClick={() => setIsVisible(true)}
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
                                onClick={() => setIsVisible(false)}
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
                    <div className="flex space-x-1 mt-3">
                        {(['all', 'openai', 'geocoding'] as const).map((f) => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-2 py-1 text-xs font-medium rounded ${filter === f
                                        ? 'bg-blue-500 text-white'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                            >
                                {f === 'all' ? 'All' : f === 'openai' ? 'OpenAI' : 'Geocoding'}
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
                            {filteredCalls.slice(-20).map((call) => (
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
                                                {call.type === 'openai'
                                                    ? `Batch ${call.details.batchIndex}`
                                                    : `Row ${call.details.rowIndex}`}
                                            </span>
                                        </div>
                                        <div className="flex items-center space-x-1">
                                            {getStatusIcon(call.status)}
                                            {call.duration && (
                                                <span className="text-xs text-gray-500">
                                                    {Math.round(call.duration)}ms
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {call.type === 'geocoding' && call.details.address && (
                                        <div className="text-xs text-gray-600 truncate mt-1">
                                            {call.details.address}
                                        </div>
                                    )}

                                    {call.details.error && (
                                        <div className="text-xs text-red-600 mt-1">
                                            {call.details.error}
                                        </div>
                                    )}
                                </div>
                            ))}
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
                        <div className="flex justify-between text-xs mt-1">
                            <span>OpenAI: {stats.openai}</span>
                            <span>Geocoding: {stats.geocoding}</span>
                        </div>
                    </div>
                )}
            </Card>
        </div>
    )
}
