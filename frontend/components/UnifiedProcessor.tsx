import React, { useState } from 'react'
import { Card } from './shared/ui/card'
import { Button } from './shared/ui/button'
import { Upload, FileText, Sparkles, MapPin, CheckCircle } from 'lucide-react'
import { DataService } from '../services/dataService'
import { useAuth } from '../contexts/AuthContext'

interface ProcessedRow {
    rowIndex: number
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
        aiConfidence: number
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
    status: 'high_confidence' | 'medium_confidence' | 'low_confidence' | 'failed'
    error?: string
}

interface ProcessingResult {
    success: boolean
    totalProcessed: number
    statistics: {
        highConfidence: number
        mediumConfidence: number
        lowConfidence: number
        totalRows: number
    }
    results: ProcessedRow[]
}

interface UnifiedProcessorProps {
    onProcessingComplete: (result: ProcessingResult) => void
}

export default function UnifiedProcessor({ onProcessingComplete }: UnifiedProcessorProps) {
    const { currentUser } = useAuth()
    const [file, setFile] = useState<File | null>(null)
    const [isProcessing, setIsProcessing] = useState(false)
    const [currentStep, setCurrentStep] = useState<'upload' | 'extracting' | 'cleaning' | 'geocoding' | 'completed'>('upload')
    const [progress, setProgress] = useState(0)
    const [stepDetails, setStepDetails] = useState<string>('')

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = event.target.files?.[0]
        if (selectedFile && selectedFile.type === 'text/csv') {
            setFile(selectedFile)
            setCurrentStep('upload')
            setProgress(0)
        } else {
            alert('Por favor selecciona un archivo CSV válido')
        }
    }

    const processCSV = async () => {
        if (!file) return

        setIsProcessing(true)
        setProgress(0)

        try {
            // Read file content
            const csvContent = await file.text()
            console.log('[DEBUG] CSV file size:', csvContent.length)
            console.log('[DEBUG] CSV preview:', csvContent.substring(0, 300))

            // Step 1: Extracting
            setCurrentStep('extracting')
            setStepDetails('Analizando estructura del CSV...')
            setProgress(10)

            await new Promise(resolve => setTimeout(resolve, 500))
            setStepDetails('Extrayendo campos de dirección...')
            setProgress(25)

            // Step 2: Cleaning
            setCurrentStep('cleaning')
            setStepDetails('Enviando datos a OpenAI para limpieza...')
            setProgress(40)

            await new Promise(resolve => setTimeout(resolve, 1000))
            setStepDetails('Procesando con inteligencia artificial...')
            setProgress(55)

            // Step 3: Geocoding
            setCurrentStep('geocoding')
            setStepDetails('Geocodificando direcciones con Google Maps...')
            setProgress(70)

            // Send to unified backend endpoint
            const response = await fetch('/api/process-complete', {
                method: 'POST',
                headers: {
                    'Content-Type': 'text/csv',
                },
                body: csvContent
            })

            if (!response.ok) {
                const errorBody = await response.text()
                console.error('Server error response:', errorBody)

                let errorMessage = `Error en el servidor: ${response.status}`
                try {
                    const errorJson = JSON.parse(errorBody)
                    if (errorJson.error) {
                        errorMessage = errorJson.error
                    }
                    if (errorJson.availableHeaders) {
                        errorMessage += `\n\nColumnas disponibles: ${errorJson.availableHeaders.join(', ')}`
                        errorMessage += `\nColumnas requeridas: ${errorJson.requiredHeaders.join(', ')}`
                    }
                } catch (e) {
                    // If error response is not JSON, use the text as is
                    errorMessage = errorBody || errorMessage
                }

                throw new Error(errorMessage)
            }

            const result: ProcessingResult = await response.json()

            setStepDetails('Finalizando procesamiento...')
            setProgress(90)

            // Save to Firebase if user is authenticated
            if (currentUser && result.success) {
                try {
                    setStepDetails('Guardando datos en Firebase...')

                    // Create CSV dataset
                    const csvId = await DataService.createCSVDataset(
                        currentUser.uid,
                        file.name,
                        result.totalProcessed
                    )

                    // Update with statistics
                    await DataService.updateCSVDataset(csvId, {
                        processedRows: result.totalProcessed,
                        highConfidenceAddresses: result.statistics.highConfidence,
                        mediumConfidenceAddresses: result.statistics.mediumConfidence,
                        lowConfidenceAddresses: result.statistics.lowConfidence,
                        processingStatus: 'completed',
                        completedAt: new Date() as any
                    })

                    // Save address records
                    const addressRecords = result.results.map(row => ({
                        userId: currentUser.uid,
                        csvId: csvId,
                        rowIndex: row.rowIndex,
                        originalAddress: row.original.address,
                        originalCity: row.original.city,
                        originalState: row.original.state,
                        originalPhone: row.original.phone,
                        cleanedAddress: row.cleaned.address,
                        cleanedCity: row.cleaned.city,
                        cleanedState: row.cleaned.state,
                        cleanedPhone: row.cleaned.phone,
                        cleanedEmail: row.cleaned.email,
                        coordinates: row.geocoding.latitude && row.geocoding.longitude ? {
                            lat: row.geocoding.latitude,
                            lng: row.geocoding.longitude
                        } : undefined,
                        geocodingConfidence: row.status === 'high_confidence' ? 'high' :
                            row.status === 'medium_confidence' ? 'medium' : 'low',
                        locationType: row.geocoding.locationType,
                        formattedAddress: row.geocoding.formattedAddress,
                        status: 'processed' as const,
                        needsConfirmation: row.status === 'low_confidence'
                    }))

                    await DataService.bulkSaveAddressRecords(addressRecords)

                    setStepDetails('Datos guardados exitosamente')
                } catch (error) {
                    console.error('Error saving to Firebase:', error)
                    setStepDetails('Procesamiento completado (error guardando en Firebase)')
                }
            }

            await new Promise(resolve => setTimeout(resolve, 500))

            setCurrentStep('completed')
            setProgress(100)
            setStepDetails('¡Procesamiento completado con éxito!')

            // Wait a moment before showing results
            setTimeout(() => {
                onProcessingComplete(result)
            }, 1000)

        } catch (error: any) {
            console.error('Error processing CSV:', error)
            alert(`Error procesando CSV: ${error.message}`)
            setCurrentStep('upload')
            setProgress(0)
            setStepDetails('')
        } finally {
            setIsProcessing(false)
        }
    }

    const getStepIcon = (step: string) => {
        switch (step) {
            case 'extracting':
                return <FileText className="w-5 h-5" />
            case 'cleaning':
                return <Sparkles className="w-5 h-5" />
            case 'geocoding':
                return <MapPin className="w-5 h-5" />
            case 'completed':
                return <CheckCircle className="w-5 h-5" />
            default:
                return <Upload className="w-5 h-5" />
        }
    }

    const getStepColor = (step: string, isActive: boolean) => {
        if (!isActive) return 'bg-gray-200 text-gray-500'

        switch (step) {
            case 'extracting':
                return 'bg-blue-500 text-white'
            case 'cleaning':
                return 'bg-purple-500 text-white'
            case 'geocoding':
                return 'bg-green-500 text-white'
            case 'completed':
                return 'bg-emerald-500 text-white'
            default:
                return 'bg-orange-500 text-white'
        }
    }

    return (
        <div className="space-y-6">
            {/* Main Upload Card */}
            <Card className="p-8 bg-white/50 backdrop-blur-sm border border-orange-100 shadow-lg">
                <div className="text-center">
                    <div className="w-16 h-16 bg-gradient-to-r from-orange-500 to-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
                        <Upload className="w-8 h-8 text-white" />
                    </div>

                    <h3 className="text-2xl font-bold text-gray-900 mb-2">
                        Procesamiento Unificado de CSV
                    </h3>
                    <p className="text-gray-600 mb-8 max-w-2xl mx-auto">
                        Sube tu archivo CSV y obtén direcciones normalizadas, limpiadas con IA y geocodificadas en un solo paso.
                        Todo el procesamiento se realiza automáticamente.
                    </p>

                    {!isProcessing ? (
                        <div className="space-y-6">
                            {/* File Upload */}
                            <div className="border-2 border-dashed border-orange-300 rounded-xl p-8 hover:border-orange-400 transition-colors">
                                <input
                                    type="file"
                                    accept=".csv"
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
                                        {file ? file.name : 'Seleccionar archivo CSV'}
                                    </span>
                                    <span className="text-sm text-gray-500">
                                        Haz clic para seleccionar o arrastra tu archivo aquí
                                    </span>
                                </label>
                            </div>

                            {/* Process Button */}
                            <Button
                                onClick={processCSV}
                                disabled={!file}
                                className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold py-4 px-8 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 text-lg"
                            >
                                <Sparkles className="w-5 h-5 mr-2" />
                                Procesar CSV Completo
                            </Button>

                            {/* Process Description */}
                            <div className="grid md:grid-cols-3 gap-4 mt-8 text-left">
                                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                                    <FileText className="w-6 h-6 text-blue-600 mb-2" />
                                    <h4 className="font-semibold text-blue-900 mb-1">1. Extracción</h4>
                                    <p className="text-sm text-blue-700">Identificar y extraer campos de dirección del CSV</p>
                                </div>
                                <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                                    <Sparkles className="w-6 h-6 text-purple-600 mb-2" />
                                    <h4 className="font-semibold text-purple-900 mb-1">2. Limpieza IA</h4>
                                    <p className="text-sm text-purple-700">Normalizar y limpiar datos con OpenAI</p>
                                </div>
                                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                                    <MapPin className="w-6 h-6 text-green-600 mb-2" />
                                    <h4 className="font-semibold text-green-900 mb-1">3. Geocodificación</h4>
                                    <p className="text-sm text-green-700">Convertir a coordenadas con Google Maps</p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Processing Steps */}
                            <div className="flex items-center justify-center space-x-4 mb-8">
                                {['extracting', 'cleaning', 'geocoding', 'completed'].map((step, index) => {
                                    const isActive = currentStep === step
                                    const isPassed = ['extracting', 'cleaning', 'geocoding', 'completed'].indexOf(currentStep) > index

                                    return (
                                        <div key={step} className="flex items-center">
                                            <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${isActive || isPassed
                                                ? getStepColor(step, true)
                                                : getStepColor(step, false)
                                                }`}>
                                                {getStepIcon(step)}
                                            </div>
                                            {index < 3 && (
                                                <div className={`w-8 h-1 mx-2 transition-all duration-300 ${isPassed ? 'bg-green-500' : 'bg-gray-200'
                                                    }`} />
                                            )}
                                        </div>
                                    )
                                })}
                            </div>

                            {/* Progress Bar */}
                            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-orange-500 to-amber-500 transition-all duration-500 ease-out"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>

                            {/* Progress Text */}
                            <div className="text-center">
                                <p className="text-lg font-semibold text-gray-800 mb-2">
                                    {progress}% Completado
                                </p>
                                <p className="text-sm text-gray-600">
                                    {stepDetails}
                                </p>
                            </div>

                            {/* Processing Animation */}
                            <div className="flex justify-center">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
                            </div>
                        </div>
                    )}
                </div>
            </Card>

            {/* Features */}
            <Card className="p-6 bg-white/30 backdrop-blur-sm border border-orange-100 shadow-lg">
                <h4 className="text-lg font-semibold text-gray-900 mb-4 text-center">
                    ¿Qué incluye el procesamiento?
                </h4>
                <div className="grid md:grid-cols-2 gap-4 text-sm">
                    <div className="space-y-2">
                        <div className="flex items-center text-green-700">
                            <CheckCircle className="w-4 h-4 mr-2" />
                            <span>Extracción automática de campos</span>
                        </div>
                        <div className="flex items-center text-green-700">
                            <CheckCircle className="w-4 h-4 mr-2" />
                            <span>Normalización de direcciones</span>
                        </div>
                        <div className="flex items-center text-green-700">
                            <CheckCircle className="w-4 h-4 mr-2" />
                            <span>Limpieza con inteligencia artificial</span>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center text-green-700">
                            <CheckCircle className="w-4 h-4 mr-2" />
                            <span>Geocodificación precisa</span>
                        </div>
                        <div className="flex items-center text-green-700">
                            <CheckCircle className="w-4 h-4 mr-2" />
                            <span>Validación de confianza</span>
                        </div>
                        <div className="flex items-center text-green-700">
                            <CheckCircle className="w-4 h-4 mr-2" />
                            <span>Dashboard interactivo de resultados</span>
                        </div>
                    </div>
                </div>
            </Card>
        </div>
    )
}
