import { useState, useRef } from 'react'

interface CsvUploaderProps {
    onUploadComplete?: (result: any) => void
}

interface ProcessingStatus {
    status: 'idle' | 'uploading' | 'processing' | 'completed' | 'error'
    progress: number
    message: string
    currentBatch?: number
    totalBatches?: number
}

export default function CsvUploader({ onUploadComplete }: CsvUploaderProps) {
    const [file, setFile] = useState<File | null>(null)
    const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>({
        status: 'idle',
        progress: 0,
        message: ''
    })
    const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
    const [processedData, setProcessedData] = useState<any[] | null>(null)
    const [activityLog, setActivityLog] = useState<string[]>([])
    const [csvPreview, setCsvPreview] = useState<{preview: string, totalLines: number, fileName: string} | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [geocodeMap, setGeocodeMap] = useState<Record<number, any>>({})
    const [showRawJson, setShowRawJson] = useState<Record<number, boolean>>({})

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = event.target.files?.[0]
        if (selectedFile && selectedFile.type === 'text/csv') {
            setFile(selectedFile)
            setProcessingStatus({ status: 'idle', progress: 0, message: '' })
            setDownloadUrl(null)
            setProcessedData(null)
            setActivityLog([])
            setCsvPreview(null)
        } else {
            alert('Please select a valid CSV file')
        }
    }

    const handleUpload = async () => {
        if (!file) return

        setProcessingStatus({
            status: 'uploading',
            progress: 0,
            message: 'Uploading CSV file...'
        })

        try {
            const formData = new FormData()
            formData.append('csvFile', file)

            const response = await fetch('/api/process-csv', {
                method: 'POST',
                body: formData
            })

            if (!response.ok) {
                throw new Error(`Upload failed: ${response.statusText}`)
            }

            // Start polling for progress
            const { taskId } = await response.json()
            
            // Fetch CSV preview
            try {
                const previewResponse = await fetch(`/api/preview/${taskId}`)
                if (previewResponse.ok) {
                    const previewData = await previewResponse.json()
                    setCsvPreview(previewData)
                }
            } catch (error) {
                console.error('Failed to fetch CSV preview:', error)
            }
            
            pollProgress(taskId)

        } catch (error) {
            console.error('Upload error:', error)
            setProcessingStatus({
                status: 'error',
                progress: 0,
                message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
            })
        }
    }

    const pollProgress = async (taskId: string) => {
        try {
            console.log(`[CSV] Polling progress for task: ${taskId}`)
            const response = await fetch(`/api/progress/${taskId}`)
            
            if (!response.ok) {
                throw new Error(`Progress API returned ${response.status}`)
            }
            
            const data = await response.json()
            console.log(`[CSV] Progress data:`, data)

            // Add activity log entry for progress updates
            if (data.status === 'processing' && data.currentBatch && data.totalBatches) {
                const timestamp = new Date().toLocaleTimeString()
                const logEntry = `${timestamp} - Batch ${data.currentBatch}/${data.totalBatches}: ${data.message}`
                setActivityLog(prev => [...prev.slice(-20), logEntry]) // Keep last 20 entries
            }

            setProcessingStatus({
                status: data.status,
                progress: data.progress,
                message: data.message,
                currentBatch: data.currentBatch,
                totalBatches: data.totalBatches
            })

            if (data.status === 'completed') {
                setDownloadUrl(data.downloadUrl)
                try {
                    const res = await fetch(`/api/results/${taskId}`)
                    if (res.ok) {
                        const jsonData = await res.json()
                        setProcessedData(jsonData)
                        // Trigger geocoding for the first 50 items
                        geocodeItems(jsonData)
                    }
                } catch (e) {
                    console.error('Failed to fetch inline results', e)
                }
                onUploadComplete?.(data)
            } else if (data.status === 'error') {
                console.error('Processing error:', data.message)
            } else if (data.status === 'processing') {
                // Continue polling
                setTimeout(() => pollProgress(taskId), 2000)
            }
        } catch (error) {
            console.error('Progress polling error:', error)
            setProcessingStatus({
                status: 'error',
                progress: 0,
                message: 'Error checking progress'
            })
        }
    }

    const geocodeItems = async (data: any[]) => {
        try {
            const limit = Math.min(50, data.length)
            for (let i = 0; i < limit; i++) {
                const item = data[i]
                const body = {
                    originalAddress: item.original_address,
                    cleanedAddress: item.cleaned_address,
                    components: {
                        country: item.country,
                        state: item.state,
                        city: item.city,
                        postal_code: item.postal_code || item.zip || item.Buyer?.ZIP
                    }
                }
                try {
                    const resp = await fetch('/api/geocode-both', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(body)
                    })
                    if (resp.ok) {
                        const geo = await resp.json()
                        setGeocodeMap(prev => ({ ...prev, [i]: geo }))
                    }
                } catch (e) {
                    console.error('Geocoding error for index', i, e)
                }
            }
        } catch (e) {
            console.error('Geocode batch error', e)
        }
    }

    const handleDownload = () => {
        if (downloadUrl) {
            const link = document.createElement('a')
            link.href = downloadUrl
            link.download = `processed_${file?.name || 'addresses.csv'}`
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
        }
    }

    const resetUploader = () => {
        setFile(null)
        setProcessingStatus({ status: 'idle', progress: 0, message: '' })
        setDownloadUrl(null)
        setProcessedData(null)
        setActivityLog([])
        setCsvPreview(null)
        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
    }

    return (
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl border border-white/20 p-8">
            <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-600 rounded-lg flex items-center justify-center">
                    <span className="text-white text-lg">📊</span>
                </div>
                <h2 className="text-2xl font-bold text-white">CSV Address Processing</h2>
            </div>
            <p className="text-gray-300 mb-8 text-lg">
                Upload a CSV file with addresses to normalize and geocode them in batches
            </p>

            {/* File Upload */}
            <div className="space-y-6">
                <div>
                    <label htmlFor="csvFile" className="block text-sm font-medium text-gray-200 mb-3">
                        Select CSV File
                    </label>
                    <input
                        ref={fileInputRef}
                        id="csvFile"
                        type="file"
                        accept=".csv"
                        onChange={handleFileSelect}
                        disabled={processingStatus.status === 'processing' || processingStatus.status === 'uploading'}
                        className="w-full px-6 py-4 text-lg bg-white/10 border border-white/20 rounded-xl text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-purple-500 file:text-white hover:file:bg-purple-600 file:cursor-pointer cursor-pointer focus:ring-2 focus:ring-purple-500 focus:border-transparent backdrop-blur-sm transition-all duration-200"
                    />
                </div>

                {/* File Info */}
                {file && (
                    <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                        <div className="flex items-center gap-3">
                            <span className="text-2xl">📄</span>
                            <div>
                                <p className="text-white font-medium">{file.name}</p>
                                <p className="text-gray-400 text-sm">
                                    {(file.size / 1024).toFixed(1)} KB
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* CSV Preview */}
                {csvPreview && (
                    <div className="bg-white/5 rounded-xl border border-white/10">
                        <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
                            <h4 className="text-white font-semibold">📊 CSV Preview</h4>
                            <span className="text-xs text-gray-400">
                                {csvPreview.totalLines} total rows
                            </span>
                        </div>
                        <div className="p-4">
                            <pre className="text-xs text-gray-300 overflow-auto max-h-40 whitespace-pre-wrap font-mono bg-black/20 p-3 rounded border">
{csvPreview.preview}
                            </pre>
                            <p className="text-xs text-gray-400 mt-2">
                                Showing header + first 5 rows. File will be processed to extract address fields.
                            </p>
                        </div>
                    </div>
                )}

                {/* Processing Status */}
                {processingStatus.status !== 'idle' && (
                    <div className="bg-white/5 rounded-xl p-6 border border-white/10">
                        <div className="flex items-center gap-3 mb-4">
                            <div className={`w-3 h-3 rounded-full ${
                                processingStatus.status === 'completed' ? 'bg-green-500' :
                                processingStatus.status === 'error' ? 'bg-red-500' :
                                'bg-blue-500 animate-pulse'
                            }`}></div>
                            <h3 className="text-lg font-semibold text-white">
                                {processingStatus.status === 'uploading' && 'Uploading...'}
                                {processingStatus.status === 'processing' && 'Processing...'}
                                {processingStatus.status === 'completed' && 'Completed!'}
                                {processingStatus.status === 'error' && 'Error'}
                            </h3>
                        </div>

                        <p className="text-gray-300 mb-4">{processingStatus.message}</p>

                        {/* Progress Bar */}
                        {processingStatus.status === 'processing' && (
                            <div className="space-y-3">
                                <div className="flex justify-between items-center text-sm text-gray-400">
                                    <span>Progress</span>
                                    <span>{processingStatus.progress}%</span>
                                </div>
                                <div className="w-full bg-gray-700 rounded-full h-2">
                                    <div 
                                        className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all duration-300"
                                        style={{ width: `${processingStatus.progress}%` }}
                                    ></div>
                                </div>
                                {processingStatus.currentBatch && processingStatus.totalBatches && (
                                    <p className="text-sm text-gray-400">
                                        Batch {processingStatus.currentBatch} of {processingStatus.totalBatches}
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Real-time Activity Log */}
                {processingStatus.status === 'processing' && activityLog.length > 0 && (
                    <div className="bg-black/20 rounded-xl border border-white/10">
                        <div className="px-4 py-3 border-b border-white/10">
                            <h4 className="text-white font-semibold flex items-center gap-2">
                                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                                Live Activity
                            </h4>
                        </div>
                        <div className="p-4 max-h-32 overflow-y-auto">
                            <div className="space-y-1 text-xs font-mono">
                                {activityLog.map((log, index) => (
                                    <div key={index} className="text-green-300 opacity-80">
                                        {log}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-4">
                    {processingStatus.status === 'idle' && file && (
                        <button
                            onClick={handleUpload}
                            className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold py-4 px-8 rounded-xl transition-all duration-200 transform hover:scale-[1.02] shadow-lg"
                        >
                            <div className="flex items-center justify-center gap-3">
                                <span>🚀</span>
                                <span>Process CSV</span>
                            </div>
                        </button>
                    )}

                    {processingStatus.status === 'completed' && downloadUrl && (
                        <button
                            onClick={handleDownload}
                            className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold py-4 px-8 rounded-xl transition-all duration-200 transform hover:scale-[1.02] shadow-lg"
                        >
                            <div className="flex items-center justify-center gap-3">
                                <span>⬇️</span>
                                <span>Download Results</span>
                            </div>
                        </button>
                    )}

                    {(processingStatus.status === 'completed' || processingStatus.status === 'error') && (
                        <button
                            onClick={resetUploader}
                            className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-4 px-8 rounded-xl transition-all duration-200"
                        >
                            Reset
                        </button>
                    )}
                </div>

                {/* JSON Data Visualizer */}
                {processedData && (
                    <div className="mt-6 bg-black/40 border border-white/10 rounded-xl">
                        <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
                            <h4 className="text-white font-semibold">🎯 Processed Results ({processedData.length} addresses)</h4>
                            <span className="text-xs text-gray-400">interactive view</span>
                        </div>
                        <div className="p-4 max-h-96 overflow-auto">
                            <div className="space-y-3">
                                {processedData.slice(0, 50).map((item, index) => (
                                    <div key={index} className="bg-white/5 rounded-lg p-4 border border-white/10">
                                        <div className="space-y-3 text-sm">
                                            <div>
                                                <div className="text-gray-400 text-xs mb-1">Original Address</div>
                                                <div className="text-gray-200 bg-red-500/10 p-2 rounded border border-red-500/20">
                                                    {item.original_address || 'N/A'}
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-gray-400 text-xs mb-1">Cleaned Address</div>
                                                <div className="text-green-200 bg-green-500/10 p-2 rounded border border-green-500/20">
                                                    {item.cleaned_address || 'N/A'}
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-gray-400 text-xs mb-1">Location Components</div>
                                                <div className="text-blue-200 bg-blue-500/10 p-2 rounded border border-blue-500/20">
                                                    <div className="flex flex-wrap gap-2">
                                                        {item.state && <span className="bg-blue-600/30 px-2 py-1 rounded text-xs">🏛️ {item.state}</span>}
                                                        {item.city && <span className="bg-purple-600/30 px-2 py-1 rounded text-xs">🏙️ {item.city}</span>}
                                                        {item.street && <span className="bg-indigo-600/30 px-2 py-1 rounded text-xs">🛣️ {item.street}</span>}
                                                        {item.country && <span className="bg-green-600/30 px-2 py-1 rounded text-xs">🇵🇾 {item.country}</span>}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Geocode + Static Map */}
                                            <div>
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="text-gray-400 text-xs">Geocoding</div>
                                                    {geocodeMap[index] && (
                                                        <button
                                                            onClick={() => setShowRawJson(prev => ({ ...prev, [index]: !prev[index] }))}
                                                            className="text-xs bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 px-2 py-1 rounded transition-colors"
                                                        >
                                                            {showRawJson[index] ? 'Hide' : 'Show'} Raw JSON
                                                        </button>
                                                    )}
                                                </div>
                                                {geocodeMap[index] ? (
                                                    <div className="space-y-3">
                                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-start">
                                                            <div className="md:col-span-2 space-y-2">
                                                                <div className="text-gray-300 text-xs">
                                                                    <div>Chosen: <span className="font-semibold">{geocodeMap[index].chosen || 'n/a'}</span></div>
                                                                    {geocodeMap[index].chosen && (
                                                                        <div className="opacity-80">
                                                                            <div className="truncate">Formatted: {(geocodeMap[index][geocodeMap[index].chosen]?.best?.formatted_address) || 'n/a'}</div>
                                                                            <div>Confidence: {(geocodeMap[index][geocodeMap[index].chosen]?.best?.confidence_score ?? 0).toFixed(2)}
                                                                                <span className="text-gray-500 text-xs ml-1">
                                                                                    ({geocodeMap[index][geocodeMap[index].chosen]?.best?.location_type || 'unknown'})
                                                                                </span>
                                                                            </div>
                                                                            {geocodeMap[index][geocodeMap[index].chosen]?.best?.confidence_description && (
                                                                                <div className="text-gray-500 text-xs">
                                                                                    {geocodeMap[index][geocodeMap[index].chosen].best.confidence_description}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            {geocodeMap[index].staticMapUrl && (
                                                                <img
                                                                    src={`${geocodeMap[index].staticMapUrl}`}
                                                                    alt="Static map"
                                                                    className="w-full h-32 object-cover rounded border border-white/10"
                                                                />
                                                            )}
                                                        </div>

                                                        {/* Raw JSON Response */}
                                                        {showRawJson[index] && (
                                                            <div className="bg-slate-900/50 rounded-xl p-4 border border-white/10">
                                                                <div className="flex items-center justify-between mb-3">
                                                                    <span className="text-sm font-medium text-gray-300">Raw Google Maps API Response</span>
                                                                    <button
                                                                        onClick={() => navigator.clipboard.writeText(JSON.stringify(geocodeMap[index], null, 2))}
                                                                        className="text-xs bg-green-500/20 hover:bg-green-500/30 text-green-300 px-2 py-1 rounded transition-colors"
                                                                    >
                                                                        📋 Copy JSON
                                                                    </button>
                                                                </div>
                                                                <pre className="text-xs text-gray-300 overflow-auto max-h-60 leading-relaxed font-mono bg-slate-900/50 p-3 rounded">
                                                                    {JSON.stringify(geocodeMap[index], null, 2)}
                                                                </pre>
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="text-gray-400 text-xs">Geocoding...</div>
                                                )}
                                            </div>

                                        </div>
                                    </div>
                                ))}
                                {processedData.length > 50 && (
                                    <div className="text-center text-gray-400 text-sm py-2">
                                        Showing first 50 of {processedData.length} processed addresses
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Instructions */}
                <div className="bg-blue-500/10 rounded-xl p-6 border border-blue-500/20">
                    <div className="flex items-center gap-3 mb-3">
                        <span className="text-blue-400 text-xl">ℹ️</span>
                        <h4 className="text-lg font-semibold text-blue-300">Expected CSV Format</h4>
                    </div>
                    <div className="text-blue-200 text-sm space-y-2">
                        <p>Your CSV should contain address columns such as:</p>
                        <ul className="list-disc list-inside ml-4 space-y-1">
                            <li><code className="bg-blue-900/30 px-2 py-1 rounded">Buyer Address1</code> - Main address</li>
                            <li><code className="bg-blue-900/30 px-2 py-1 rounded">Buyer City</code> - City name</li>
                            <li><code className="bg-blue-900/30 px-2 py-1 rounded">Buyer State</code> - State/Department</li>
                            <li><code className="bg-blue-900/30 px-2 py-1 rounded">Buyer ZIP</code> - Postal code</li>
                        </ul>
                        <p className="mt-3">The system will process addresses in batches of 10 and add normalized address components.</p>
                    </div>
                </div>
            </div>
        </div>
    )
}
