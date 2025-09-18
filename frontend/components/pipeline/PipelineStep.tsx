import { useState } from 'react'
import { ChevronDown, ChevronRight, Play, CheckCircle, XCircle, Clock } from 'lucide-react'

interface PipelineStepProps {
    title: string
    description: string
    status: 'pending' | 'running' | 'completed' | 'error'
    inputData?: any
    outputData?: any
    logs?: string[]
    onRun?: () => Promise<void>
    children?: React.ReactNode
}

export default function PipelineStep({
    title,
    description,
    status,
    inputData,
    outputData,
    logs = [],
    onRun,
    children
}: PipelineStepProps) {
    const [isExpanded, setIsExpanded] = useState(false)
    const [isRunning, setIsRunning] = useState(false)

    const handleRun = async () => {
        if (!onRun || isRunning) return

        setIsRunning(true)
        try {
            await onRun()
        } finally {
            setIsRunning(false)
        }
    }

    const getStatusIcon = () => {
        switch (status) {
            case 'pending':
                return <Clock className="w-5 h-5 text-gray-400" />
            case 'running':
                return <div className="w-5 h-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
            case 'completed':
                return <CheckCircle className="w-5 h-5 text-green-500" />
            case 'error':
                return <XCircle className="w-5 h-5 text-red-500" />
        }
    }

    const getStatusColor = () => {
        switch (status) {
            case 'pending':
                return 'border-gray-200 bg-gray-50'
            case 'running':
                return 'border-blue-200 bg-blue-50'
            case 'completed':
                return 'border-green-200 bg-green-50'
            case 'error':
                return 'border-red-200 bg-red-50'
        }
    }

    return (
        <div className={`border rounded-lg ${getStatusColor()}`}>
            {/* Header */}
            <div className="p-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <button
                            onClick={() => setIsExpanded(!isExpanded)}
                            className="flex items-center space-x-2 text-left"
                        >
                            {isExpanded ?
                                <ChevronDown className="w-4 h-4 text-gray-500" /> :
                                <ChevronRight className="w-4 h-4 text-gray-500" />
                            }
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
                                <p className="text-sm text-gray-600">{description}</p>
                            </div>
                        </button>
                    </div>

                    <div className="flex items-center space-x-3">
                        {getStatusIcon()}
                        {onRun && status === 'pending' && (
                            <button
                                onClick={handleRun}
                                disabled={isRunning}
                                className="flex items-center space-x-2 px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                            >
                                <Play className="w-4 h-4" />
                                <span>{isRunning ? 'Running...' : 'Run'}</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Expanded Content */}
            {isExpanded && (
                <div className="border-t border-gray-200 p-4 space-y-4">
                    {children}

                    {/* Input Data */}
                    {inputData && (
                        <div>
                            <h4 className="font-medium text-gray-900 mb-2">Input Data</h4>
                            <div className="bg-white rounded border p-3">
                                <pre className="text-xs text-gray-700 overflow-auto max-h-32">
                                    {typeof inputData === 'string' ? inputData : JSON.stringify(inputData, null, 2)}
                                </pre>
                            </div>
                        </div>
                    )}

                    {/* Output Data */}
                    {outputData && (
                        <div>
                            <h4 className="font-medium text-gray-900 mb-2">Output Data</h4>
                            <div className="bg-white rounded border p-3">
                                <pre className="text-xs text-gray-700 overflow-auto max-h-32">
                                    {typeof outputData === 'string' ? outputData : JSON.stringify(outputData, null, 2)}
                                </pre>
                            </div>
                        </div>
                    )}

                    {/* Logs */}
                    {logs.length > 0 && (
                        <div>
                            <h4 className="font-medium text-gray-900 mb-2">Execution Logs</h4>
                            <div className="bg-gray-900 text-green-400 rounded p-3 font-mono text-xs max-h-48 overflow-auto">
                                {logs.map((log, index) => (
                                    <div key={index} className="mb-1">
                                        <span className="text-gray-500">[{new Date().toLocaleTimeString()}]</span> {log}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
