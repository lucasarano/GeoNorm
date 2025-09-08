import React, { useState } from 'react'
import { Card } from './shared/ui/card'
import { Button } from './shared/ui/button'

interface ExtractedData {
    address: string
    city: string
    state: string
    phone: string
}

interface CleanedData {
    address: string
    city: string
    state: string
    phone: string
    email: string
}

interface FieldExtractorProps {
    onExtractComplete?: (data: ExtractedData[]) => void
}

export default function FieldExtractor({ onExtractComplete }: FieldExtractorProps) {
    const [file, setFile] = useState<File | null>(null)
    const [extractedData, setExtractedData] = useState<ExtractedData[]>([])
    const [cleanedData, setCleanedData] = useState<CleanedData[]>([])
    const [isProcessing, setIsProcessing] = useState(false)
    const [isCleaning, setIsCleaning] = useState(false)
    const [isGeocoding, setIsGeocoding] = useState(false)
    const [showComparison, setShowComparison] = useState(false)
    const [showCleaned, setShowCleaned] = useState(false)
    const [currentStep, setCurrentStep] = useState<'upload' | 'extracted' | 'cleaned'>('upload')
    const [geocodeResults, setGeocodeResults] = useState<Array<{
        index: number
        cleanedAddress: string
        usedComponents?: string
        confidence: number
        confidenceDescription: string
        locationType: string
        staticMapUrl: string | null
        error?: string
    }>>([])

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = event.target.files?.[0]
        if (selectedFile) {
            setFile(selectedFile)
            setExtractedData([])
            setShowComparison(false)
        }
    }

    const extractFields = async () => {
        if (!file) return

        setIsProcessing(true)

        try {
            // Read the CSV file content
            const csvContent = await file.text()

            // Send to backend for field extraction
            const response = await fetch('/api/extract-fields', {
                method: 'POST',
                headers: {
                    'Content-Type': 'text/csv',
                },
                body: csvContent
            })

            if (!response.ok) {
                throw new Error(`Failed to extract fields: ${response.status}`)
            }

            const result = await response.json()

            setExtractedData(result.data)
            setShowComparison(true)
            setCurrentStep('extracted')
            onExtractComplete?.(result.data)

        } catch (error) {
            console.error('Error extracting fields:', error)
        } finally {
            setIsProcessing(false)
        }
    }

    const cleanWithOpenAI = async () => {
        if (extractedData.length === 0) return

        setIsCleaning(true)

        try {
            // Send to backend for OpenAI processing
            const response = await fetch('/api/clean-with-openai', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    extractedData
                })
            })

            if (!response.ok) {
                throw new Error(`Failed to clean with OpenAI: ${response.status}`)
            }

            const result = await response.json()

            setCleanedData(result.data)
            setShowCleaned(true)
            setCurrentStep('cleaned')

        } catch (error) {
            console.error('Error cleaning with OpenAI:', error)
            alert('Error processing with OpenAI. Please try again.')
        } finally {
            setIsCleaning(false)
        }
    }

    const geocodeCleaned = async () => {
        if (cleanedData.length === 0) return
        setIsGeocoding(true)
        try {
            const results: Array<{
                index: number
                cleanedAddress: string
                usedComponents?: string
                confidence: number
                confidenceDescription: string
                locationType: string
                staticMapUrl: string | null
                error?: string
            }> = []

            for (let i = 0; i < cleanedData.length; i++) {
                const cleaned = cleanedData[i]
                const original = extractedData[i]
                try {
                    const components: Record<string, string> = { country: 'PY' }
                    if (cleaned.state && cleaned.state.trim()) components.state = cleaned.state
                    if (cleaned.city && cleaned.city.trim()) components.city = cleaned.city

                    const resp = await fetch('/api/geocode-both', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            originalAddress: original?.address ?? '',
                            cleanedAddress: cleaned.address,
                            components
                        })
                    })
                    if (!resp.ok) throw new Error(`Geocode error ${resp.status}`)
                    const data = await resp.json()
                    results.push({
                        index: i,
                        cleanedAddress: cleaned.address,
                        usedComponents: data?.cleaned?.usedComponents ?? undefined,
                        confidence: data?.confidence ?? 0,
                        confidenceDescription: data?.confidenceDescription ?? 'Unknown',
                        locationType: data?.locationType ?? 'N/A',
                        staticMapUrl: data?.staticMapUrl ?? null
                    })
                } catch (e: any) {
                    results.push({
                        index: i,
                        cleanedAddress: cleaned.address,
                        confidence: 0,
                        confidenceDescription: 'Request failed',
                        locationType: 'N/A',
                        staticMapUrl: null,
                        error: e?.message || 'Unknown error'
                    })
                }
            }

            setGeocodeResults(results)
        } catch (error) {
            console.error('Error geocoding cleaned addresses:', error)
            alert('Error geocoding cleaned addresses. Please try again.')
        } finally {
            setIsGeocoding(false)
        }
    }

    return (
        <div className="space-y-6">
            {/* Progress Steps */}
            <Card className="p-6">
                <div className="flex items-center justify-between mb-6">
                    <div className={`flex items-center space-x-2 ${currentStep === 'upload' ? 'text-blue-600' : currentStep === 'extracted' || currentStep === 'cleaned' ? 'text-green-600' : 'text-gray-400'}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep === 'upload' ? 'bg-blue-100 border-2 border-blue-600' : currentStep === 'extracted' || currentStep === 'cleaned' ? 'bg-green-100 border-2 border-green-600' : 'bg-gray-100 border-2 border-gray-300'}`}>
                            {currentStep === 'extracted' || currentStep === 'cleaned' ? '✓' : '1'}
                        </div>
                        <span className="font-medium">Extract Fields</span>
                    </div>

                    <div className={`h-0.5 flex-1 mx-4 ${currentStep === 'extracted' || currentStep === 'cleaned' ? 'bg-green-600' : 'bg-gray-300'}`}></div>

                    <div className={`flex items-center space-x-2 ${currentStep === 'cleaned' ? 'text-green-600' : currentStep === 'extracted' ? 'text-blue-600' : 'text-gray-400'}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep === 'cleaned' ? 'bg-green-100 border-2 border-green-600' : currentStep === 'extracted' ? 'bg-blue-100 border-2 border-blue-600' : 'bg-gray-100 border-2 border-gray-300'}`}>
                            {currentStep === 'cleaned' ? '✓' : '2'}
                        </div>
                        <span className="font-medium">Clean with AI</span>
                    </div>
                </div>
            </Card>

            <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Field Extractor</h3>
                <p className="text-gray-600 mb-4">
                    Upload a CSV file to extract Address, City, State, and Phone fields
                </p>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-2">Select CSV File</label>
                        <input
                            type="file"
                            accept=".csv"
                            onChange={handleFileUpload}
                            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                        />
                    </div>

                    <Button
                        onClick={extractFields}
                        disabled={!file || isProcessing}
                        className="w-full"
                    >
                        {isProcessing ? 'Extracting...' : 'Extract Fields'}
                    </Button>
                </div>
            </Card>

            {showComparison && extractedData.length > 0 && (
                <Card className="p-6">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold">Extracted Fields</h3>
                        <Button
                            onClick={cleanWithOpenAI}
                            disabled={isCleaning}
                            className="bg-blue-600 hover:bg-blue-700"
                        >
                            {isCleaning ? 'Cleaning with AI...' : 'Clean with OpenAI'}
                        </Button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Row
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Address
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        City
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        State
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Phone
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {extractedData.map((row, index) => (
                                    <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                            {index + 1}
                                        </td>
                                        <td className="px-4 py-4 text-sm text-gray-900 max-w-xs">
                                            <div className="truncate" title={row.address}>
                                                {row.address || '-'}
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 text-sm text-gray-900">
                                            {row.city || '-'}
                                        </td>
                                        <td className="px-4 py-4 text-sm text-gray-900">
                                            {row.state || '-'}
                                        </td>
                                        <td className="px-4 py-4 text-sm text-gray-900">
                                            {row.phone || '-'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="mt-4 flex justify-between items-center">
                        <p className="text-sm text-gray-600">
                            Extracted {extractedData.length} rows
                        </p>
                        <Button
                            onClick={() => {
                                const csvContent = [
                                    'Address,City,State,Phone',
                                    ...extractedData.map(row =>
                                        `"${row.address}","${row.city}","${row.state}","${row.phone}"`
                                    )
                                ].join('\n')

                                const blob = new Blob([csvContent], { type: 'text/csv' })
                                const url = URL.createObjectURL(blob)
                                const a = document.createElement('a')
                                a.href = url
                                a.download = 'extracted_fields.csv'
                                a.click()
                                URL.revokeObjectURL(url)
                            }}
                            className="bg-green-600 hover:bg-green-700"
                        >
                            Download Raw CSV
                        </Button>
                    </div>
                </Card>
            )}

            {showCleaned && cleanedData.length > 0 && (
                <Card className="p-6">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold">AI-Cleaned Data Comparison</h3>
                        <Button
                            onClick={geocodeCleaned}
                            disabled={isGeocoding}
                            className="bg-indigo-600 hover:bg-indigo-700"
                        >
                            {isGeocoding ? 'Geocoding…' : 'Geocode Cleaned Addresses'}
                        </Button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Row
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Field
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-red-500 uppercase tracking-wider">
                                        Original
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-green-500 uppercase tracking-wider">
                                        AI Cleaned
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {cleanedData.map((cleanedRow, index) => {
                                    const originalRow = extractedData[index]
                                    return (
                                        <React.Fragment key={index}>
                                            <tr className="bg-blue-50">
                                                <td colSpan={4} className="px-4 py-2 text-sm font-medium text-blue-900">
                                                    Row {index + 1}
                                                </td>
                                            </tr>
                                            <tr>
                                                <td className="px-4 py-2"></td>
                                                <td className="px-4 py-2 text-sm font-medium text-gray-700">Address</td>
                                                <td className="px-4 py-2 text-sm text-red-600 max-w-xs">
                                                    <div className="truncate" title={originalRow?.address}>
                                                        {originalRow?.address || '-'}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-2 text-sm text-green-600 max-w-xs">
                                                    <div className="truncate" title={cleanedRow.address}>
                                                        {cleanedRow.address || '-'}
                                                    </div>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td className="px-4 py-2"></td>
                                                <td className="px-4 py-2 text-sm font-medium text-gray-700">City</td>
                                                <td className="px-4 py-2 text-sm text-red-600">
                                                    {originalRow?.city || '-'}
                                                </td>
                                                <td className="px-4 py-2 text-sm text-green-600">
                                                    {cleanedRow.city || '-'}
                                                </td>
                                            </tr>
                                            <tr>
                                                <td className="px-4 py-2"></td>
                                                <td className="px-4 py-2 text-sm font-medium text-gray-700">State</td>
                                                <td className="px-4 py-2 text-sm text-red-600">
                                                    {originalRow?.state || '-'}
                                                </td>
                                                <td className="px-4 py-2 text-sm text-green-600">
                                                    {cleanedRow.state || '-'}
                                                </td>
                                            </tr>
                                            <tr>
                                                <td className="px-4 py-2"></td>
                                                <td className="px-4 py-2 text-sm font-medium text-gray-700">Phone</td>
                                                <td className="px-4 py-2 text-sm text-red-600">
                                                    {originalRow?.phone || '-'}
                                                </td>
                                                <td className="px-4 py-2 text-sm text-green-600">
                                                    {cleanedRow.phone || '-'}
                                                </td>
                                            </tr>
                                            <tr>
                                                <td className="px-4 py-2"></td>
                                                <td className="px-4 py-2 text-sm font-medium text-gray-700">Email</td>
                                                <td className="px-4 py-2 text-sm text-red-600">
                                                    -
                                                </td>
                                                <td className="px-4 py-2 text-sm text-green-600">
                                                    {cleanedRow.email || '-'}
                                                </td>
                                            </tr>
                                        </React.Fragment>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>

                    <div className="mt-4 flex justify-between items-center">
                        <p className="text-sm text-gray-600">
                            Cleaned {cleanedData.length} rows with AI
                        </p>
                        <Button
                            onClick={() => {
                                const csvContent = [
                                    'Address,City,State,Phone,Email',
                                    ...cleanedData.map(row =>
                                        `"${row.address}","${row.city}","${row.state}","${row.phone}","${row.email}"`
                                    )
                                ].join('\n')

                                const blob = new Blob([csvContent], { type: 'text/csv' })
                                const url = URL.createObjectURL(blob)
                                const a = document.createElement('a')
                                a.href = url
                                a.download = 'ai_cleaned_data.csv'
                                a.click()
                                URL.revokeObjectURL(url)
                            }}
                            className="bg-green-600 hover:bg-green-700"
                        >
                            Download Cleaned CSV
                        </Button>
                    </div>

                    {geocodeResults.length > 0 && (
                        <div className="mt-8">
                            <h4 className="text-md font-semibold mb-3">Geocoding Results</h4>
                            <div className="mb-3 text-sm text-gray-700">
                                {(() => {
                                    const accurate = geocodeResults.filter(r => r.confidence >= 0.8).length
                                    const medium = geocodeResults.filter(r => r.confidence >= 0.6 && r.confidence < 0.8).length
                                    const guess = geocodeResults.filter(r => r.confidence < 0.6).length
                                    return `Accurate: ${accurate} • Medium: ${medium} • Guess: ${guess}`
                                })()}
                            </div>
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Row</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cleaned Address</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Components</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Confidence</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Map</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {geocodeResults.map((row, idx) => {
                                            const label = row.confidence >= 0.8 ? 'Accurate' : row.confidence >= 0.6 ? 'Medium' : 'Guess'
                                            const labelClass = row.confidence >= 0.8 ? 'bg-green-100 text-green-800' : row.confidence >= 0.6 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
                                            return (
                                                <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                                    <td className="px-4 py-3 text-sm text-gray-900">{row.index + 1}</td>
                                                    <td className="px-4 py-3 text-sm text-gray-900 max-w-xs">
                                                        <div className="truncate" title={row.cleanedAddress}>{row.cleanedAddress}</div>
                                                    </td>
                                                    <td className="px-4 py-3 text-xs text-gray-700">{row.usedComponents || '-'}</td>
                                                    <td className="px-4 py-3 text-sm">
                                                        <span className={`px-2 py-1 rounded-full ${labelClass}`}>{label}</span>
                                                        <div className="text-gray-500 text-xs mt-1">{row.confidenceDescription} ({Math.round((row.confidence || 0) * 100)}%)</div>
                                                    </td>
                                                    <td className="px-4 py-3 text-xs text-gray-700">{row.locationType}</td>
                                                    <td className="px-4 py-3">
                                                        {row.staticMapUrl ? (
                                                            <img src={row.staticMapUrl} alt="Map" className="w-40 h-20 object-cover rounded border" />
                                                        ) : (
                                                            <span className="text-gray-400 text-xs">No map</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </Card>
            )}
        </div>
    )
}
