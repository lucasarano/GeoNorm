import React, { useState, useRef } from 'react'

interface CsvUploaderProps {
    onUploadComplete?: (result: any) => void
}

interface ProcessingStatus {
    status: 'idle' | 'uploading' | 'processing' | 'completed' | 'error'
    progress: number
    message: string
}

export default function CsvUploader({ onUploadComplete }: CsvUploaderProps) {
    const [file, setFile] = useState<File | null>(null)
    const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>({
        status: 'idle',
        progress: 0,
        message: ''
    })
    const [processedData, setProcessedData] = useState<any[] | null>(null)
    const [geocodeMap, setGeocodeMap] = useState<Record<number, any>>({})
    const [showJson, setShowJson] = useState<number | null>(null)
    const [whatsappStatus, setWhatsappStatus] = useState<string>('')
    const [corrections, setCorrections] = useState<any[]>([])
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [originalCsvPreview, setOriginalCsvPreview] = useState<{ headers: string[]; rows: string[][] } | null>(null)

    const normalizeParaguayPhone = (raw?: string): string => {
        if (!raw) return ''
        let phone = String(raw).trim()
        // Remove spaces and non-digits except leading +
        phone = phone.replace(/[^\d+]/g, '')
        // Handle duplicates separated by / (keep first)
        const slashIdx = phone.indexOf('/')
        if (slashIdx !== -1) phone = phone.slice(0, slashIdx)
        // If starts with +595, OK
        if (phone.startsWith('+595')) return phone
        // If starts with 595, add +
        if (phone.startsWith('595')) return `+${phone}`
        // If starts with 0, drop 0 and add +595
        if (phone.startsWith('0')) return `+595${phone.slice(1)}`
        // If 9 digits, assume mobile without country code
        if (/^\d{9}$/.test(phone)) return `+595${phone}`
        return phone
    }

    const generateCsvContent = () => {
        if (!processedData) return ''

        const headers = [
            'Row',
            'Original Address',
            'Cleaned Address',
            'Corrected Address',
            'Phone Number',
            'Confidence %',
            'Location Type',
            'State',
            'City',
            'Street',
            'Country',
            'Manually Corrected'
        ]

        const rows = processedData.map((item, index) => [
            index + 1,
            item.original_address || '',
            item.cleaned_address || '',
            item.corrected_address || '',
            normalizeParaguayPhone(item.phone || item.original_phone) || '',
            geocodeMap[index] ? Math.round((geocodeMap[index].confidence || 0) * 100) : '',
            geocodeMap[index]?.locationType || '',
            item.state || '',
            item.city || '',
            item.street || '',
            item.country || '',
            item.manually_corrected ? 'Yes' : 'No'
        ])

        const csvContent = [headers, ...rows]
            .map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
            .join('\n')

        return csvContent
    }

    const downloadCsv = (content: string, filename: string) => {
        const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
        const link = document.createElement('a')
        const url = URL.createObjectURL(blob)
        link.setAttribute('href', url)
        link.setAttribute('download', filename)
        link.style.visibility = 'hidden'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    const sendWhatsAppCorrections = async () => {
        if (!processedData) return

        setWhatsappStatus('Sending WhatsApp messages...')

        // Filter addresses with confidence <= 40%
        const lowConfidenceAddresses = processedData
            .map((item, index) => ({
                phone: item.phone,
                originalAddress: item.original_address,
                cleanedAddress: item.cleaned_address,
                confidence: geocodeMap[index]?.confidence || 0,
                rowIndex: index
            }))
            .filter(item => item.phone && item.confidence <= 0.4)

        if (lowConfidenceAddresses.length === 0) {
            setWhatsappStatus('No addresses with low confidence found')
            setTimeout(() => setWhatsappStatus(''), 3000)
            return
        }

        try {
            const response = await fetch('http://localhost:3001/api/whatsapp/send-corrections', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ addresses: lowConfidenceAddresses })
            })

            const result = await response.json()

            if (response.ok) {
                setWhatsappStatus(`✅ Messages sent: ${result.sent}, Failed: ${result.failed}`)
                startPollingCorrections()
            } else {
                setWhatsappStatus(`❌ Error: ${result.error}`)
            }
        } catch (error) {
            setWhatsappStatus('❌ Failed to send WhatsApp messages')
        }

        setTimeout(() => setWhatsappStatus(''), 5000)
    }

    const startPollingCorrections = () => {
        const pollInterval = setInterval(async () => {
            try {
                const response = await fetch('http://localhost:3001/api/whatsapp/corrections')
                const newCorrections = await response.json()

                const unprocessed = newCorrections.filter((c: any) => !c.processed)
                if (unprocessed.length > 0) {
                    setCorrections(unprocessed)

                    // Show notification for new corrections
                    if (unprocessed.length > corrections.length) {
                        alert(`📱 Received ${unprocessed.length - corrections.length} new address corrections!`)
                    }
                }
            } catch (error) {
                console.error('Error polling corrections:', error)
            }
        }, 5000) // Poll every 5 seconds

        // Clean up interval after 10 minutes
        setTimeout(() => clearInterval(pollInterval), 600000)
    }

    const applyCorrection = async (correction: any) => {
        if (!processedData) return

        // Find the matching row by phone number
        const rowIndex = processedData.findIndex(item => item.phone === correction.phone)

        if (rowIndex !== -1) {
            // Update the processed data
            const updatedData = [...processedData]
            updatedData[rowIndex] = {
                ...updatedData[rowIndex],
                corrected_address: correction.correctedAddress,
                correction_timestamp: correction.timestamp,
                manually_corrected: true
            }
            setProcessedData(updatedData)

            // Mark as processed
            await fetch(`http://localhost:3001/api/whatsapp/corrections/${correction.phone}/processed`, {
                method: 'POST'
            })

            // Remove from corrections list
            setCorrections(prev => prev.filter(c => c.phone !== correction.phone))

            alert(`✅ Address updated for ${correction.phone}`)
        }
    }

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = event.target.files?.[0]
        if (selectedFile && selectedFile.type === 'text/csv') {
            setFile(selectedFile)
            setProcessingStatus({ status: 'idle', progress: 0, message: '' })
            setProcessedData(null)
            setGeocodeMap({})
            setShowJson(null)
            // Parse a small preview of the original CSV for visualization
            const reader = new FileReader()
            reader.onload = () => {
                try {
                    const text = String(reader.result || '')
                    const lines = text.split(/\r?\n/).filter(Boolean)
                    if (lines.length > 0) {
                        const headers = lines[0].split(',')
                        const rows = lines.slice(1, Math.min(lines.length, 11)).map(l => l.split(','))
                        setOriginalCsvPreview({ headers, rows })
                    } else {
                        setOriginalCsvPreview(null)
                    }
                } catch {
                    setOriginalCsvPreview(null)
                }
            }
            reader.readAsText(selectedFile)
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
            // Upload file
            const formData = new FormData()
            formData.append('csvFile', file)

            const uploadResponse = await fetch('http://localhost:3001/api/process-csv', {
                method: 'POST',
                body: formData
            })

            if (!uploadResponse.ok) {
                throw new Error(`Upload failed: ${uploadResponse.statusText}`)
            }

            const uploadResult = await uploadResponse.json()
            const taskId = uploadResult.taskId

            // Poll for progress
            await pollProgress(taskId)
        } catch (error) {
            console.error('Upload error:', error)
            setProcessingStatus({
                status: 'error',
                progress: 0,
                message: 'Upload failed. Please try again.'
            })
        }
    }

    const pollProgress = async (taskId: string) => {
        const maxAttempts = 120 // 2 minutes max
        let attempts = 0

        const poll = async () => {
            try {
                const response = await fetch(`http://localhost:3001/api/progress/${taskId}`)
                if (!response.ok) throw new Error('Progress check failed')

                const data = await response.json()

                setProcessingStatus({
                    status: data.status === 'completed' ? 'processing' : 'processing',
                    progress: data.progress,
                    message: data.message
                })

                if (data.status === 'completed') {
                    // Get processed results
                    const resultsResponse = await fetch(`http://localhost:3001/api/results/${taskId}`)
                    if (resultsResponse.ok) {
                        const results = await resultsResponse.json()
                        setProcessedData(results)

                        // Start geocoding
                        await geocodeItems(results)

                        setProcessingStatus({
                            status: 'completed',
                            progress: 100,
                            message: 'Processing completed successfully!'
                        })

                        onUploadComplete?.(results)
                    }
                    return
                }

                if (data.status === 'error') {
                    setProcessingStatus({
                        status: 'error',
                        progress: 0,
                        message: data.message || 'Processing failed'
                    })
                    return
                }

                // Continue polling
                attempts++
                if (attempts < maxAttempts) {
                    setTimeout(poll, 1000)
                } else {
                    throw new Error('Processing timeout')
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

        poll()
    }

    const geocodeItems = async (data: any[]) => {
        const limit = Math.min(10, data.length) // Limit to 10 for demo

        for (let i = 0; i < limit; i++) {
            const item = data[i]

            // Skip invalid addresses
            const cleanedAddr = item.cleaned_address?.trim()
            if (!cleanedAddr || cleanedAddr === 'N/A' || cleanedAddr.length < 3) {
                continue
            }

            try {
                const body = {
                    originalAddress: null,
                    cleanedAddress: cleanedAddr,
                    components: {
                        country: item.country,
                        state: item.state,
                        city: item.city,
                        postal_code: item.postal_code
                    }
                }

                const resp = await fetch('http://localhost:3001/api/geocode-both', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                })

                if (resp.ok) {
                    const geo = await resp.json()
                    setGeocodeMap(prev => ({ ...prev, [i]: geo }))
                }
            } catch (error) {
                console.error('Geocoding error for index', i, error)
            }
        }
    }

    const getConfidenceColor = (confidence: number) => {
        if (confidence >= 0.8) return 'bg-green-100 text-green-800'
        if (confidence >= 0.6) return 'bg-yellow-100 text-yellow-800'
        return 'bg-red-100 text-red-800'
    }

    const getConfidenceText = (confidence: number) => {
        if (confidence >= 0.8) return 'High Confidence'
        if (confidence >= 0.6) return 'Medium Confidence'
        return 'Low Confidence'
    }

    return (
        <div className="space-y-8">
            {/* File Upload */}
            <div>
                <div
                    className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors cursor-pointer"
                    onClick={() => fileInputRef.current?.click()}
                >
                    <div className="mx-auto w-12 h-12 text-gray-400 mb-4">
                        📊
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                        {file ? file.name : 'Select CSV File'}
                    </h3>
                    <p className="text-gray-600 mb-4">
                        {file ? `${(file.size / 1024).toFixed(1)} KB` : 'Click to browse or drag and drop your CSV file here'}
                    </p>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv"
                        onChange={handleFileSelect}
                        className="hidden"
                    />
                </div>

                {file && (
                    <div className="mt-4 flex justify-center">
                        <button
                            onClick={handleUpload}
                            disabled={processingStatus.status !== 'idle'}
                            className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 px-8 rounded-lg font-medium hover:from-indigo-700 hover:to-purple-700 focus:ring-4 focus:ring-indigo-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                            {processingStatus.status === 'idle' ? 'Process CSV' : 'Processing...'}
                        </button>
                    </div>
                )}
            </div>

            {/* Progress */}
            {processingStatus.status !== 'idle' && (
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h4 className="font-semibold text-gray-900">Processing Status</h4>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${processingStatus.status === 'completed' ? 'bg-green-100 text-green-800' :
                            processingStatus.status === 'error' ? 'bg-red-100 text-red-800' :
                                'bg-blue-100 text-blue-800'
                            }`}>
                            {processingStatus.status}
                        </span>
                    </div>

                    <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
                        <div
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${processingStatus.progress}%` }}
                        />
                    </div>

                    <p className="text-sm text-gray-600">{processingStatus.message}</p>
                </div>
            )}

            {/* Results */}
            {processedData && processedData.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <h4 className="font-semibold text-gray-900 mb-4">
                        🎯 Processed Results ({processedData.length} addresses)
                    </h4>

                    {/* Excel-like Table View */}
                    <div className="overflow-x-auto">
                        <table className="min-w-full bg-white border border-gray-200 rounded-lg shadow-sm">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                                        #
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                                        Original Address
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                                        Cleaned Address
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                                        Corrected Address
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                                        Phone Number
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                                        Confidence
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                                        Location Type
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {processedData.slice(0, 10).map((item, index) => (
                                    <tr key={index} className="hover:bg-gray-50">
                                        <td className="px-4 py-3 text-sm text-gray-900 border-b">
                                            {index + 1}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-900 border-b max-w-xs">
                                            <div className="truncate" title={item.original_address}>
                                                {item.original_address}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-900 border-b max-w-xs">
                                            <div className="truncate" title={item.cleaned_address}>
                                                {item.cleaned_address}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-sm border-b max-w-xs">
                                            {item.corrected_address ? (
                                                <div className="truncate" title={item.corrected_address}>
                                                    <span className="text-green-600 font-medium">{item.corrected_address}</span>
                                                    <span className="text-xs text-gray-500 block">✅ Manually corrected</span>
                                                </div>
                                            ) : (
                                                <span className="text-gray-400">-</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-sm border-b">
                                            {item.phone || item.original_phone ? (
                                                <div className="flex items-center space-x-2">
                                                    <span className="font-mono text-green-600">{normalizeParaguayPhone(item.phone || item.original_phone)}</span>
                                                    <span className="text-xs text-gray-500">
                                                        {normalizeParaguayPhone(item.phone || item.original_phone).includes('+59598') ? '📱 Tigo' :
                                                            normalizeParaguayPhone(item.phone || item.original_phone).includes('+59597') ? '📱 Personal' :
                                                                normalizeParaguayPhone(item.phone || item.original_phone).includes('+59599') ? '📱 Claro' : '📱 Mobile'}
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-gray-400">No phone</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-sm border-b">
                                            {geocodeMap[index] && geocodeMap[index].confidence !== undefined ? (
                                                <div className="flex items-center space-x-2">
                                                    <span className={`px-2 py-1 rounded text-xs font-medium ${geocodeMap[index].confidence >= 0.8 ? 'bg-green-100 text-green-800' :
                                                        geocodeMap[index].confidence >= 0.6 ? 'bg-yellow-100 text-yellow-800' :
                                                            'bg-red-100 text-red-800'
                                                        }`}>
                                                        {(geocodeMap[index].confidence * 100).toFixed(0)}%
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-gray-400">N/A</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-900 border-b">
                                            {geocodeMap[index] && geocodeMap[index].locationType ? (
                                                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                                    {geocodeMap[index].locationType}
                                                </span>
                                            ) : (
                                                <span className="text-gray-400">N/A</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-sm border-b">
                                            <button
                                                onClick={() => setShowJson(showJson === index ? null : index)}
                                                className="text-blue-600 hover:text-blue-800 text-xs underline"
                                            >
                                                {showJson === index ? 'Hide' : 'Show'} JSON
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {/* JSON Details Row */}
                        {showJson !== null && (
                            <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                                <h4 className="text-sm font-medium text-gray-900 mb-2">
                                    Raw JSON Data - Row {showJson + 1}
                                </h4>
                                <pre className="text-xs bg-white p-3 rounded border overflow-auto max-h-48">
                                    {JSON.stringify(geocodeMap[showJson], null, 2)}
                                </pre>
                            </div>
                        )}

                        {processedData.length > 10 && (
                            <div className="mt-4 text-center py-4 text-gray-500 bg-gray-50 rounded-lg">
                                Showing first 10 results of {processedData.length} total addresses
                            </div>
                        )}
                    </div>

                    {/* Action Buttons */}
                    <div className="mt-6 flex justify-center space-x-4">
                        <button
                            onClick={() => {
                                const csvContent = generateCsvContent()
                                downloadCsv(csvContent, 'processed_addresses.csv')
                            }}
                            className="bg-green-600 text-white py-2 px-6 rounded-lg font-medium hover:bg-green-700 focus:ring-4 focus:ring-green-500/25 transition-all"
                        >
                            ⬇️ Download Results
                        </button>
                        <button
                            onClick={sendWhatsAppCorrections}
                            disabled={!processedData || whatsappStatus.includes('Sending')}
                            className="bg-green-600 text-white py-2 px-6 rounded-lg font-medium hover:bg-green-700 focus:ring-4 focus:ring-green-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                            📱 Send WhatsApp Corrections
                        </button>
                        <button
                            onClick={() => {
                                setFile(null)
                                setProcessedData(null)
                                setGeocodeMap({})
                                setShowJson(null)
                                setWhatsappStatus('')
                                setCorrections([])
                                setProcessingStatus({ status: 'idle', progress: 0, message: '' })
                                if (fileInputRef.current) {
                                    fileInputRef.current.value = ''
                                }
                            }}
                            className="bg-gray-600 text-white py-2 px-6 rounded-lg font-medium hover:bg-gray-700 focus:ring-4 focus:ring-gray-500/25 transition-all"
                        >
                            🔄 Reset
                        </button>
                    </div>

                    {/* WhatsApp Status */}
                    {whatsappStatus && (
                        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-center">
                            <p className="text-blue-800 text-sm">{whatsappStatus}</p>
                        </div>
                    )}
                </div>
            )}

            {/* Address Corrections Panel */}
            {corrections.length > 0 && (
                <div className="bg-white border border-green-200 rounded-lg p-6">
                    <h4 className="font-semibold text-green-900 mb-4">
                        📱 WhatsApp Address Corrections ({corrections.length})
                    </h4>

                    <div className="space-y-4">
                        {corrections.map((correction, index) => (
                            <div key={index} className="bg-green-50 border border-green-200 rounded-lg p-4">
                                <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                        <p className="text-sm text-gray-600">
                                            <strong>Phone:</strong> {correction.phone}
                                        </p>
                                        <p className="text-sm text-gray-600 mt-1">
                                            <strong>New Address:</strong>
                                            <span className="text-green-700 font-medium ml-1">
                                                {correction.correctedAddress}
                                            </span>
                                        </p>
                                        <p className="text-xs text-gray-500 mt-1">
                                            Received: {new Date(correction.timestamp).toLocaleString()}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => applyCorrection(correction)}
                                        className="bg-green-600 text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-green-700 transition-all"
                                    >
                                        ✅ Apply Correction
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* CSV Format Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <h4 className="font-semibold text-blue-900 mb-2">ℹ️ Expected CSV Format</h4>
                <p className="text-blue-800 text-sm mb-3">Your CSV should contain address and contact columns such as:</p>
                <ul className="text-blue-700 text-sm space-y-1">
                    <li><strong>Buyer Address1</strong> - Main address</li>
                    <li><strong>Buyer City</strong> - City name</li>
                    <li><strong>Buyer State</strong> - State/Department</li>
                    <li><strong>Buyer ZIP</strong> - Postal code</li>
                    <li><strong>Buyer Phone</strong> - Contact phone number</li>
                </ul>
                <p className="text-blue-600 text-xs mt-3">
                    The system will process addresses and phone numbers in batches, using AI to normalize and clean both address components and phone number formatting.
                </p>
            </div>

            {/* Original CSV Viewer */}
            {originalCsvPreview && (
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <h4 className="font-semibold text-gray-900 mb-4">📄 Original CSV Preview</h4>
                    <div className="overflow-x-auto">
                        <table className="min-w-full bg-white border border-gray-200 rounded-lg shadow-sm">
                            <thead className="bg-gray-50">
                                <tr>
                                    {originalCsvPreview.headers.map((h, i) => (
                                        <th key={i} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {originalCsvPreview.rows.map((r, idx) => (
                                    <tr key={idx} className="hover:bg-gray-50">
                                        {originalCsvPreview.headers.map((_, cIdx) => (
                                            <td key={cIdx} className="px-3 py-2 text-sm text-gray-900 border-b max-w-xs">
                                                <div className="truncate" title={r[cIdx] || ''}>{r[cIdx] || ''}</div>
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">Showing header + first 10 rows from the original file you uploaded. Order here is exactly as in the file.</p>
                </div>
            )}
        </div>
    )
}