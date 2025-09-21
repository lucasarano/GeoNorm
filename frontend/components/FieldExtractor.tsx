import React, { useState } from 'react'
import { Card } from './shared/ui/card'
import { Button } from './shared/ui/button'
import { useAuth } from '../contexts/AuthContext'
import { DataService, AddressRecord } from '../services/dataService'

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
    const { currentUser } = useAuth()
    const [file, setFile] = useState<File | null>(null)
    const [extractedData, setExtractedData] = useState<ExtractedData[]>([])
    const [cleanedData, setCleanedData] = useState<CleanedData[]>([])
    const [isProcessing, setIsProcessing] = useState(false)
    const [isCleaning, setIsCleaning] = useState(false)
    const [isGeocoding, setIsGeocoding] = useState(false)
    const [isSendingSMS, setIsSendingSMS] = useState(false)
    const [showComparison, setShowComparison] = useState(false)
    const [showCleaned, setShowCleaned] = useState(false)
    const [currentStep, setCurrentStep] = useState<'upload' | 'extracted' | 'cleaned'>('upload')
    const [currentCSVId, setCurrentCSVId] = useState<string | null>(null)
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
        if (!file || !currentUser) return

        setIsProcessing(true)

        try {
            // Create CSV dataset in Firebase first
            const csvId = await DataService.createCSVDataset(
                currentUser.uid,
                file.name,
                0 // Will be updated after parsing
            )
            setCurrentCSVId(csvId)

            // Read the CSV file content
            const csvContent = await file.text()
            const lines = csvContent.trim().split('\n')
            const totalRows = lines.length - 1 // Subtract header

            // Update CSV dataset with total rows
            await DataService.updateCSVDataset(csvId, {
                totalRows,
                processingStatus: 'extracting'
            })

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

            // Update CSV dataset status
            await DataService.updateCSVDataset(csvId, {
                processedRows: result.data.length,
                processingStatus: 'extracted'
            })

        } catch (error) {
            console.error('Error extracting fields:', error)

            // Update CSV dataset status to failed
            if (currentCSVId) {
                await DataService.updateCSVDataset(currentCSVId, {
                    processingStatus: 'failed'
                })
            }
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
        if (cleanedData.length === 0 || !currentUser || !currentCSVId) return
        setIsGeocoding(true)

        try {
            // Update CSV status to geocoding
            await DataService.updateCSVDataset(currentCSVId, {
                processingStatus: 'geocoding'
            })

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

            const addressRecords: Omit<AddressRecord, 'id'>[] = []
            let highConfidenceCount = 0
            let mediumConfidenceCount = 0
            let lowConfidenceCount = 0
            let pendingCount = 0

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

                    // Process geocoding result to determine status
                    const geocodingResult = DataService.processGeocodingResult({
                        confidence: data.confidence,
                        geometry: {
                            location_type: data.locationType
                        }
                    })

                    // Count by confidence
                    if (geocodingResult.geocodingConfidence === 'high') highConfidenceCount++
                    else if (geocodingResult.geocodingConfidence === 'medium') mediumConfidenceCount++
                    else lowConfidenceCount++

                    if (geocodingResult.needsConfirmation) pendingCount++

                    // Create address record for Firebase
                    const addressRecord: Omit<AddressRecord, 'id'> = {
                        userId: currentUser.uid,
                        csvId: currentCSVId,
                        rowIndex: i,
                        originalAddress: original?.address ?? '',
                        originalCity: original?.city,
                        originalState: original?.state,
                        originalPhone: original?.phone,
                        cleanedAddress: cleaned.address,
                        cleanedCity: cleaned.city,
                        cleanedState: cleaned.state,
                        cleanedPhone: cleaned.phone,
                        cleanedEmail: cleaned.email,
                        coordinates: data.cleaned?.best ? {
                            lat: data.cleaned.best.latitude,
                            lng: data.cleaned.best.longitude
                        } : undefined,
                        geocodingConfidence: geocodingResult.geocodingConfidence,
                        locationType: data.locationType,
                        formattedAddress: data.cleaned?.best?.formatted_address,
                        zipCode: data.zipCode,
                        status: geocodingResult.status,
                        needsConfirmation: geocodingResult.needsConfirmation,
                        processedAt: new Date() as any,
                        updatedAt: new Date() as any
                    }

                    addressRecords.push(addressRecord)

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
                    // Create failed address record
                    const addressRecord: Omit<AddressRecord, 'id'> = {
                        userId: currentUser.uid,
                        csvId: currentCSVId,
                        rowIndex: i,
                        originalAddress: original?.address ?? '',
                        originalCity: original?.city,
                        originalState: original?.state,
                        originalPhone: original?.phone,
                        cleanedAddress: cleaned.address,
                        cleanedCity: cleaned.city,
                        cleanedState: cleaned.state,
                        cleanedPhone: cleaned.phone,
                        cleanedEmail: cleaned.email,
                        geocodingConfidence: 'low',
                        locationType: 'FAILED',
                        status: 'pending_confirmation',
                        needsConfirmation: true,
                        processedAt: new Date() as any,
                        updatedAt: new Date() as any
                    }

                    addressRecords.push(addressRecord)
                    lowConfidenceCount++
                    pendingCount++

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

            // Save all address records to Firebase
            await DataService.bulkSaveAddressRecords(addressRecords)

            // Update CSV dataset with final stats
            await DataService.updateCSVDataset(currentCSVId, {
                processingStatus: 'completed',
                highConfidenceAddresses: highConfidenceCount,
                mediumConfidenceAddresses: mediumConfidenceCount,
                lowConfidenceAddresses: lowConfidenceCount,
                pendingConfirmations: pendingCount,
                completedAt: new Date() as any
            })

            setGeocodeResults(results)

            // Send SMS confirmations for addresses that need it
            if (pendingCount > 0) {
                await sendSMSConfirmations(addressRecords.filter(record => record.needsConfirmation))
            }

        } catch (error) {
            console.error('Error geocoding cleaned addresses:', error)
            alert('Error geocoding cleaned addresses. Please try again.')

            // Update CSV status to failed
            if (currentCSVId) {
                await DataService.updateCSVDataset(currentCSVId, {
                    processingStatus: 'failed'
                })
            }
        } finally {
            setIsGeocoding(false)
        }
    }

    const sendSMSConfirmations = async (pendingAddresses: Omit<AddressRecord, 'id'>[]) => {
        if (pendingAddresses.length === 0) return

        setIsSendingSMS(true)
        try {
            const addresses = pendingAddresses.map(record => ({
                id: `temp-${record.rowIndex}`, // Temporary ID for confirmation URL
                phone: record.cleanedPhone || record.originalPhone || '',
                originalAddress: record.originalAddress,
                cleanedAddress: record.cleanedAddress,
                needsConfirmation: record.needsConfirmation
            })).filter(addr => addr.phone) // Only send to addresses with phone numbers

            if (addresses.length === 0) {
                alert('No phone numbers available for SMS confirmations')
                return
            }

            const response = await fetch('/api/send-confirmations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ addresses })
            })

            if (!response.ok) {
                throw new Error('Failed to send SMS confirmations')
            }

            const result = await response.json()
            alert(`SMS confirmations sent: ${result.sent} successful, ${result.failed} failed`)

        } catch (error) {
            console.error('Error sending SMS confirmations:', error)
            alert('Error sending SMS confirmations. Please try again.')
        } finally {
            setIsSendingSMS(false)
        }
    }

    return (
        <div className="space-y-6">
            {/* Progress Steps */}
            <Card className="p-6 bg-white/50 backdrop-blur-sm border border-orange-100 shadow-lg">
                <div className="flex items-center justify-between mb-6">
                    <div className={`flex items-center space-x-2 ${currentStep === 'upload' ? 'text-orange-600' : currentStep === 'extracted' || currentStep === 'cleaned' ? 'text-green-600' : 'text-gray-400'}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep === 'upload' ? 'bg-orange-100 border-2 border-orange-600' : currentStep === 'extracted' || currentStep === 'cleaned' ? 'bg-green-100 border-2 border-green-600' : 'bg-gray-100 border-2 border-gray-300'}`}>
                            {currentStep === 'extracted' || currentStep === 'cleaned' ? '✓' : '1'}
                        </div>
                        <span className="font-semibold">Extraer Campos</span>
                    </div>

                    <div className={`h-0.5 flex-1 mx-4 ${currentStep === 'extracted' || currentStep === 'cleaned' ? 'bg-green-500' : 'bg-gray-300'}`}></div>

                    <div className={`flex items-center space-x-2 ${currentStep === 'cleaned' ? 'text-green-600' : currentStep === 'extracted' ? 'text-orange-600' : 'text-gray-400'}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep === 'cleaned' ? 'bg-green-100 border-2 border-green-600' : currentStep === 'extracted' ? 'bg-orange-100 border-2 border-orange-600' : 'bg-gray-100 border-2 border-gray-300'}`}>
                            {currentStep === 'cleaned' ? '✓' : '2'}
                        </div>
                        <span className="font-semibold">Limpiar con IA</span>
                    </div>
                </div>
            </Card>

            <Card className="p-6 bg-white/50 backdrop-blur-sm border border-orange-100 shadow-lg">
                <h3 className="text-lg font-bold mb-4 text-gray-800">Extractor de Campos CSV</h3>
                <p className="text-gray-600 mb-6">
                    Sube un archivo CSV para extraer automáticamente los campos de Dirección, Ciudad, Estado y Teléfono
                </p>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-semibold mb-3 text-gray-700">Seleccionar Archivo CSV</label>
                        <input
                            type="file"
                            accept=".csv"
                            onChange={handleFileUpload}
                            className="block w-full text-sm text-gray-600 file:mr-4 file:py-3 file:px-6 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-gradient-to-r file:from-orange-50 file:to-amber-50 file:text-orange-700 hover:file:from-orange-100 hover:file:to-amber-100 file:shadow-md hover:file:shadow-lg transition-all duration-200"
                        />
                    </div>

                    <Button
                        onClick={extractFields}
                        disabled={!file || isProcessing}
                        className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-semibold py-3 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 border-0"
                    >
                        {isProcessing ? (
                            <span className="flex items-center justify-center">
                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Extrayendo...
                            </span>
                        ) : 'Extraer Campos'}
                    </Button>
                </div>
            </Card>

            {showComparison && extractedData.length > 0 && (
                <Card className="p-6 bg-white/50 backdrop-blur-sm border border-orange-100 shadow-lg">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold">Campos Extraídos</h3>
                        <Button
                            onClick={cleanWithOpenAI}
                            disabled={isCleaning}
                            className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-semibold px-6 py-2 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 border-0"
                        >
                            {isCleaning ? (
                                <span className="flex items-center">
                                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Limpiando con IA...
                                </span>
                            ) : 'Limpiar con OpenAI'}
                        </Button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Fila
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Dirección
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Ciudad
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Estado
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Teléfono
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Código Postal
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
                                        <td className="px-4 py-4 text-sm text-gray-900">
                                            <span className="text-gray-400 italic">Pendiente de geocodificación</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="mt-4 flex justify-between items-center">
                        <p className="text-sm text-gray-600">
                            Extraídas {extractedData.length} filas
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
                            className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-semibold px-4 py-2 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 border-0"
                        >
                            Descargar CSV Original
                        </Button>
                    </div>
                </Card>
            )}

            {showCleaned && cleanedData.length > 0 && (
                <Card className="p-6 bg-white/50 backdrop-blur-sm border border-orange-100 shadow-lg">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold">Comparación de Datos Limpiados por IA</h3>
                        <Button
                            onClick={geocodeCleaned}
                            disabled={isGeocoding}
                            className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold px-6 py-2 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 border-0"
                        >
                            {isGeocoding ? (
                                <span className="flex items-center">
                                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Geocodificando…
                                </span>
                            ) : 'Geocodificar Direcciones Limpiadas'}
                        </Button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Fila
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Campo
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-red-500 uppercase tracking-wider">
                                        Original
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-green-500 uppercase tracking-wider">
                                        Limpiado por IA
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
                                                <td className="px-4 py-2 text-sm font-medium text-gray-700">Dirección</td>
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
                                                <td className="px-4 py-2 text-sm font-medium text-gray-700">Ciudad</td>
                                                <td className="px-4 py-2 text-sm text-red-600">
                                                    {originalRow?.city || '-'}
                                                </td>
                                                <td className="px-4 py-2 text-sm text-green-600">
                                                    {cleanedRow.city || '-'}
                                                </td>
                                            </tr>
                                            <tr>
                                                <td className="px-4 py-2"></td>
                                                <td className="px-4 py-2 text-sm font-medium text-gray-700">Estado</td>
                                                <td className="px-4 py-2 text-sm text-red-600">
                                                    {originalRow?.state || '-'}
                                                </td>
                                                <td className="px-4 py-2 text-sm text-green-600">
                                                    {cleanedRow.state || '-'}
                                                </td>
                                            </tr>
                                            <tr>
                                                <td className="px-4 py-2"></td>
                                                <td className="px-4 py-2 text-sm font-medium text-gray-700">Teléfono</td>
                                                <td className="px-4 py-2 text-sm text-red-600">
                                                    {originalRow?.phone || '-'}
                                                </td>
                                                <td className="px-4 py-2 text-sm text-green-600">
                                                    {cleanedRow.phone || '-'}
                                                </td>
                                            </tr>
                                            <tr>
                                                <td className="px-4 py-2"></td>
                                                <td className="px-4 py-2 text-sm font-medium text-gray-700">Correo</td>
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
                            Limpiadas {cleanedData.length} filas con IA
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
                            className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-semibold px-4 py-2 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 border-0"
                        >
                            Descargar CSV Limpiado
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
