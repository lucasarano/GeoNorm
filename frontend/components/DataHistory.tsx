import React, { useState, useEffect } from 'react'
import { Card } from './shared/ui/card'
import { Button } from './shared/ui/button'
import { Input } from './shared/ui/input'
import {
    Search,
    Calendar,
    FileText,
    MapPin,
    CheckCircle,
    AlertCircle,
    XCircle,
    Download,
    Eye,
    Trash2,
    RefreshCw
} from 'lucide-react'
import { DataService, CSVDataset, AddressRecord } from '../services/dataService'
import { useAuth } from '../contexts/AuthContext'

interface DataHistoryProps {
    onSelectDataset: (dataset: CSVDataset, addresses: AddressRecord[]) => void
    onBack: () => void
}

export default function DataHistory({ onSelectDataset, onBack }: DataHistoryProps) {
    const { currentUser } = useAuth()
    const [datasets, setDatasets] = useState<CSVDataset[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [selectedDataset, setSelectedDataset] = useState<CSVDataset | null>(null)
    const [addresses, setAddresses] = useState<AddressRecord[]>([])
    const [loadingAddresses, setLoadingAddresses] = useState(false)

    useEffect(() => {
        if (currentUser) {
            loadDatasets()
        }
    }, [currentUser])

    const loadDatasets = async () => {
        if (!currentUser) return

        try {
            setLoading(true)
            const userDatasets = await DataService.getUserCSVDatasets(currentUser.uid)
            setDatasets(userDatasets)
        } catch (error) {
            console.error('Error loading datasets:', error)
        } finally {
            setLoading(false)
        }
    }

    const loadAddresses = async (dataset: CSVDataset) => {
        if (!dataset.id) return

        try {
            setLoadingAddresses(true)
            const datasetAddresses = await DataService.getAddressRecords(dataset.id)
            setAddresses(datasetAddresses)
            setSelectedDataset(dataset)
        } catch (error) {
            console.error('Error loading addresses:', error)
        } finally {
            setLoadingAddresses(false)
        }
    }

    const handleViewDataset = async (dataset: CSVDataset) => {
        await loadAddresses(dataset)
    }

    const handleSelectDataset = () => {
        if (selectedDataset) {
            onSelectDataset(selectedDataset, addresses)
        }
    }

    const handleDeleteDataset = async (dataset: CSVDataset) => {
        if (!dataset.id || !window.confirm('¿Estás seguro de que quieres eliminar este dataset?')) {
            return
        }

        try {
            // Note: You might want to add a delete method to DataService
            // For now, we'll just remove it from the local state
            setDatasets(prev => prev.filter(d => d.id !== dataset.id))
            if (selectedDataset?.id === dataset.id) {
                setSelectedDataset(null)
                setAddresses([])
            }
        } catch (error) {
            console.error('Error deleting dataset:', error)
        }
    }

    const downloadCSV = (dataset: CSVDataset, addresses: AddressRecord[]) => {
        const headers = [
            'Row',
            'Original Address',
            'Original City',
            'Original State',
            'Original Phone',
            'Cleaned Address',
            'Cleaned City',
            'Cleaned State',
            'Cleaned Phone',
            'Cleaned Email',
            'Latitude',
            'Longitude',
            'Formatted Address',
            'Confidence',
            'Status'
        ]

        const csvContent = [
            headers.join(','),
            ...addresses.map(addr => [
                addr.rowIndex + 1,
                `"${addr.originalAddress}"`,
                `"${addr.originalCity || ''}"`,
                `"${addr.originalState || ''}"`,
                `"${addr.originalPhone || ''}"`,
                `"${addr.cleanedAddress}"`,
                `"${addr.cleanedCity}"`,
                `"${addr.cleanedState}"`,
                `"${addr.cleanedPhone || ''}"`,
                `"${addr.cleanedEmail || ''}"`,
                addr.coordinates?.lat || '',
                addr.coordinates?.lng || '',
                `"${addr.formattedAddress || ''}"`,
                addr.geocodingConfidence,
                addr.status
            ].join(','))
        ].join('\n')

        const blob = new Blob([csvContent], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${dataset.fileName}_processed.csv`
        a.click()
        URL.revokeObjectURL(url)
    }

    const filteredDatasets = datasets.filter(dataset =>
        dataset.fileName.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'completed':
                return <CheckCircle className="w-4 h-4 text-green-500" />
            case 'failed':
                return <XCircle className="w-4 h-4 text-red-500" />
            default:
                return <AlertCircle className="w-4 h-4 text-yellow-500" />
        }
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'completed':
                return 'bg-green-100 text-green-800'
            case 'failed':
                return 'bg-red-100 text-red-800'
            default:
                return 'bg-yellow-100 text-yellow-800'
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-orange-500" />
                    <p className="text-gray-600">Cargando historial de datos...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <Card className="p-6 bg-white/50 backdrop-blur-sm border border-orange-100 shadow-lg">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">Historial de Datos Procesados</h2>
                        <p className="text-gray-600">Selecciona un dataset para visualizar los resultados</p>
                    </div>
                    <Button
                        onClick={onBack}
                        variant="outline"
                        className="border-orange-200 text-orange-700 hover:bg-orange-50"
                    >
                        ← Procesar Nuevo CSV
                    </Button>
                </div>

                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                        placeholder="Buscar por nombre de archivo..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                    />
                </div>
            </Card>

            <div className="grid lg:grid-cols-2 gap-6">
                {/* Datasets List */}
                <Card className="bg-white/50 backdrop-blur-sm border border-orange-100 shadow-lg">
                    <div className="p-4 border-b border-gray-200">
                        <h3 className="text-lg font-semibold text-gray-900">
                            Datasets ({filteredDatasets.length})
                        </h3>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                        {filteredDatasets.length === 0 ? (
                            <div className="p-6 text-center text-gray-500">
                                <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                                <p>No hay datasets procesados</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-200">
                                {filteredDatasets.map((dataset) => (
                                    <div
                                        key={dataset.id}
                                        className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${selectedDataset?.id === dataset.id ? 'bg-orange-50 border-l-4 border-orange-500' : ''
                                            }`}
                                        onClick={() => handleViewDataset(dataset)}
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <div className="flex items-center mb-2">
                                                    <FileText className="w-4 h-4 text-gray-400 mr-2" />
                                                    <h4 className="font-medium text-gray-900 truncate">
                                                        {dataset.fileName}
                                                    </h4>
                                                </div>
                                                <div className="flex items-center mb-2">
                                                    {getStatusIcon(dataset.processingStatus)}
                                                    <span className={`ml-2 px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(dataset.processingStatus)}`}>
                                                        {dataset.processingStatus}
                                                    </span>
                                                </div>
                                                <div className="text-sm text-gray-500 space-y-1">
                                                    <div className="flex items-center">
                                                        <Calendar className="w-3 h-3 mr-1" />
                                                        {dataset.uploadedAt?.toDate?.()?.toLocaleDateString() || 'Fecha desconocida'}
                                                    </div>
                                                    <div className="flex items-center">
                                                        <MapPin className="w-3 h-3 mr-1" />
                                                        {dataset.processedRows} de {dataset.totalRows} direcciones
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex flex-col gap-2 ml-4">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        handleViewDataset(dataset)
                                                    }}
                                                >
                                                    <Eye className="w-3 h-3" />
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        handleDeleteDataset(dataset)
                                                    }}
                                                    className="text-red-600 hover:text-red-700"
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </Card>

                {/* Dataset Details */}
                <Card className="bg-white/50 backdrop-blur-sm border border-orange-100 shadow-lg">
                    <div className="p-4 border-b border-gray-200">
                        <h3 className="text-lg font-semibold text-gray-900">
                            Detalles del Dataset
                        </h3>
                    </div>
                    <div className="p-4">
                        {!selectedDataset ? (
                            <div className="text-center text-gray-500 py-8">
                                <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                                <p>Selecciona un dataset para ver los detalles</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {/* Dataset Info */}
                                <div>
                                    <h4 className="font-medium text-gray-900 mb-2">{selectedDataset.fileName}</h4>
                                    <div className="text-sm text-gray-500 space-y-1">
                                        <div>Subido: {selectedDataset.uploadedAt?.toDate?.()?.toLocaleString() || 'Fecha desconocida'}</div>
                                        <div>Completado: {selectedDataset.completedAt?.toDate?.()?.toLocaleString() || 'En progreso'}</div>
                                    </div>
                                </div>

                                {/* Statistics */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-green-50 p-3 rounded-lg">
                                        <div className="text-sm text-green-600">Alta Confianza</div>
                                        <div className="text-lg font-bold text-green-700">
                                            {selectedDataset.highConfidenceAddresses}
                                        </div>
                                    </div>
                                    <div className="bg-yellow-50 p-3 rounded-lg">
                                        <div className="text-sm text-yellow-600">Confianza Media</div>
                                        <div className="text-lg font-bold text-yellow-700">
                                            {selectedDataset.mediumConfidenceAddresses}
                                        </div>
                                    </div>
                                    <div className="bg-orange-50 p-3 rounded-lg">
                                        <div className="text-sm text-orange-600">Baja Confianza</div>
                                        <div className="text-lg font-bold text-orange-700">
                                            {selectedDataset.lowConfidenceAddresses}
                                        </div>
                                    </div>
                                    <div className="bg-blue-50 p-3 rounded-lg">
                                        <div className="text-sm text-blue-600">Pendientes</div>
                                        <div className="text-lg font-bold text-blue-700">
                                            {selectedDataset.pendingConfirmations}
                                        </div>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex gap-2">
                                    <Button
                                        onClick={handleSelectDataset}
                                        className="flex-1 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white"
                                    >
                                        <Eye className="w-4 h-4 mr-2" />
                                        Ver Dashboard
                                    </Button>
                                    <Button
                                        onClick={() => downloadCSV(selectedDataset, addresses)}
                                        variant="outline"
                                        disabled={loadingAddresses}
                                    >
                                        <Download className="w-4 h-4" />
                                    </Button>
                                </div>

                                {loadingAddresses && (
                                    <div className="text-center py-4">
                                        <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-2 text-orange-500" />
                                        <p className="text-sm text-gray-600">Cargando direcciones...</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </Card>
            </div>
        </div>
    )
}
