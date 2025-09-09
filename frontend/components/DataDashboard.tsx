import React, { useState, useMemo } from 'react'
import { Card } from './shared/ui/card'
import { Button } from './shared/ui/button'
import { Input } from './shared/ui/input'
import {
    Download,
    Search,
    Filter,
    MapPin,
    CheckCircle,
    AlertCircle,
    XCircle,
    Eye,
    EyeOff
} from 'lucide-react'

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

interface DataDashboardProps {
    data: ProcessedRow[]
    statistics: {
        highConfidence: number
        mediumConfidence: number
        lowConfidence: number
        totalRows: number
    }
    onBack: () => void
}

export default function DataDashboard({ data, statistics, onBack }: DataDashboardProps) {
    const [searchTerm, setSearchTerm] = useState('')
    const [statusFilter, setStatusFilter] = useState<string>('all')
    const [showOriginal, setShowOriginal] = useState(true)
    const [selectedRow, setSelectedRow] = useState<ProcessedRow | null>(null)

    // Filter and search data
    const filteredData = useMemo(() => {
        return data.filter(row => {
            // Status filter
            if (statusFilter !== 'all' && row.status !== statusFilter) {
                return false
            }

            // Search filter
            if (searchTerm.trim()) {
                const searchLower = searchTerm.toLowerCase()
                const searchableText = [
                    row.original.address,
                    row.original.city,
                    row.original.state,
                    row.cleaned.address,
                    row.cleaned.city,
                    row.cleaned.state,
                    row.cleaned.email,
                    row.geocoding.formattedAddress
                ].join(' ').toLowerCase()

                return searchableText.includes(searchLower)
            }

            return true
        })
    }, [data, searchTerm, statusFilter])

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'high_confidence':
                return <CheckCircle className="w-4 h-4 text-green-500" />
            case 'medium_confidence':
                return <AlertCircle className="w-4 h-4 text-yellow-500" />
            case 'low_confidence':
                return <XCircle className="w-4 h-4 text-orange-500" />
            case 'failed':
                return <XCircle className="w-4 h-4 text-red-500" />
            default:
                return null
        }
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'high_confidence':
                return 'bg-green-100 text-green-800'
            case 'medium_confidence':
                return 'bg-yellow-100 text-yellow-800'
            case 'low_confidence':
                return 'bg-orange-100 text-orange-800'
            case 'failed':
                return 'bg-red-100 text-red-800'
            default:
                return 'bg-gray-100 text-gray-800'
        }
    }

    const downloadCSV = () => {
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
            ...filteredData.map(row => [
                row.rowIndex + 1,
                `"${row.original.address}"`,
                `"${row.original.city}"`,
                `"${row.original.state}"`,
                `"${row.original.phone}"`,
                `"${row.cleaned.address}"`,
                `"${row.cleaned.city}"`,
                `"${row.cleaned.state}"`,
                `"${row.cleaned.phone}"`,
                `"${row.cleaned.email}"`,
                row.geocoding.latitude || '',
                row.geocoding.longitude || '',
                `"${row.geocoding.formattedAddress}"`,
                row.geocoding.confidence,
                row.status
            ].join(','))
        ].join('\n')

        const blob = new Blob([csvContent], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `processed_addresses_${new Date().toISOString().split('T')[0]}.csv`
        a.click()
        URL.revokeObjectURL(url)
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <Card className="p-6 bg-white/50 backdrop-blur-sm border border-orange-100 shadow-lg">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">Dashboard de Resultados</h2>
                        <p className="text-gray-600">Procesamiento completado con éxito</p>
                    </div>
                    <Button
                        onClick={onBack}
                        variant="outline"
                        className="border-orange-200 text-orange-700 hover:bg-orange-50"
                    >
                        ← Procesar Nuevo CSV
                    </Button>
                </div>

                {/* Statistics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                        <div className="flex items-center">
                            <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                            <div>
                                <p className="text-sm text-green-600">Alta Confianza</p>
                                <p className="text-2xl font-bold text-green-700">{statistics.highConfidence}</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                        <div className="flex items-center">
                            <AlertCircle className="w-5 h-5 text-yellow-500 mr-2" />
                            <div>
                                <p className="text-sm text-yellow-600">Confianza Media</p>
                                <p className="text-2xl font-bold text-yellow-700">{statistics.mediumConfidence}</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                        <div className="flex items-center">
                            <XCircle className="w-5 h-5 text-orange-500 mr-2" />
                            <div>
                                <p className="text-sm text-orange-600">Baja Confianza</p>
                                <p className="text-2xl font-bold text-orange-700">{statistics.lowConfidence}</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                        <div className="flex items-center">
                            <MapPin className="w-5 h-5 text-blue-500 mr-2" />
                            <div>
                                <p className="text-sm text-blue-600">Total Procesadas</p>
                                <p className="text-2xl font-bold text-blue-700">{statistics.totalRows}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </Card>

            {/* Controls */}
            <Card className="p-4 bg-white/50 backdrop-blur-sm border border-orange-100 shadow-lg">
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="flex flex-col md:flex-row gap-4 flex-1">
                        {/* Search */}
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                            <Input
                                placeholder="Buscar direcciones..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10 w-64"
                            />
                        </div>

                        {/* Filter */}
                        <div className="flex items-center gap-2">
                            <Filter className="w-4 h-4 text-gray-400" />
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                            >
                                <option value="all">Todos los Estados</option>
                                <option value="high_confidence">Alta Confianza</option>
                                <option value="medium_confidence">Confianza Media</option>
                                <option value="low_confidence">Baja Confianza</option>
                                <option value="failed">Fallidos</option>
                            </select>
                        </div>

                        {/* View Toggle */}
                        <Button
                            onClick={() => setShowOriginal(!showOriginal)}
                            variant="outline"
                            size="sm"
                            className="flex items-center gap-2"
                        >
                            {showOriginal ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            {showOriginal ? 'Ocultar Original' : 'Mostrar Original'}
                        </Button>
                    </div>

                    {/* Download */}
                    <Button
                        onClick={downloadCSV}
                        className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white"
                    >
                        <Download className="w-4 h-4 mr-2" />
                        Descargar CSV
                    </Button>
                </div>

                <div className="mt-2 text-sm text-gray-600">
                    Mostrando {filteredData.length} de {data.length} registros
                </div>
            </Card>

            {/* Data Table */}
            <Card className="bg-white/50 backdrop-blur-sm border border-orange-100 shadow-lg overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    #
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Estado
                                </th>
                                {showOriginal && (
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Dirección Original
                                    </th>
                                )}
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Dirección Limpiada
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Ciudad/Estado
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Teléfono/Email
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Coordenadas
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Confianza
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Mapa
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {filteredData.map((row) => (
                                <tr
                                    key={row.rowIndex}
                                    className="hover:bg-gray-50 cursor-pointer"
                                    onClick={() => setSelectedRow(row)}
                                >
                                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                        {row.rowIndex + 1}
                                    </td>
                                    <td className="px-4 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                            {getStatusIcon(row.status)}
                                            <span className={`ml-2 px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(row.status)}`}>
                                                {row.status.replace('_', ' ')}
                                            </span>
                                        </div>
                                    </td>
                                    {showOriginal && (
                                        <td className="px-4 py-4 text-sm text-gray-900 max-w-xs">
                                            <div className="truncate" title={row.original.address}>
                                                {row.original.address}
                                            </div>
                                            <div className="text-xs text-gray-500">
                                                {row.original.city}, {row.original.state}
                                            </div>
                                        </td>
                                    )}
                                    <td className="px-4 py-4 text-sm text-gray-900 max-w-xs">
                                        <div className="truncate font-medium" title={row.cleaned.address}>
                                            {row.cleaned.address}
                                        </div>
                                        <div className="text-xs text-gray-500 truncate" title={row.geocoding.formattedAddress}>
                                            {row.geocoding.formattedAddress}
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 text-sm text-gray-900">
                                        <div>{row.cleaned.city}</div>
                                        <div className="text-xs text-gray-500">{row.cleaned.state}</div>
                                    </td>
                                    <td className="px-4 py-4 text-sm text-gray-900">
                                        <div>{row.cleaned.phone}</div>
                                        <div className="text-xs text-gray-500">{row.cleaned.email}</div>
                                    </td>
                                    <td className="px-4 py-4 text-sm text-gray-900">
                                        {row.geocoding.latitude && row.geocoding.longitude ? (
                                            <div>
                                                <div className="font-mono text-xs">
                                                    {row.geocoding.latitude.toFixed(6)}
                                                </div>
                                                <div className="font-mono text-xs">
                                                    {row.geocoding.longitude.toFixed(6)}
                                                </div>
                                            </div>
                                        ) : (
                                            <span className="text-gray-400">No disponible</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-4 text-sm text-gray-900">
                                        <div className="font-bold">
                                            {Math.round(row.geocoding.confidence * 100)}%
                                        </div>
                                        <div className="text-xs text-gray-500">
                                            {row.geocoding.locationType}
                                        </div>
                                    </td>
                                    <td className="px-4 py-4">
                                        {row.geocoding.staticMapUrl ? (
                                            <img
                                                src={row.geocoding.staticMapUrl}
                                                alt="Map"
                                                className="w-16 h-12 object-cover rounded border"
                                            />
                                        ) : (
                                            <div className="w-16 h-12 bg-gray-100 rounded border flex items-center justify-center">
                                                <span className="text-xs text-gray-400">No mapa</span>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Row Detail Modal */}
            {selectedRow && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                        <div className="p-6">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-bold text-gray-900">
                                    Detalle de Fila #{selectedRow.rowIndex + 1}
                                </h3>
                                <Button
                                    onClick={() => setSelectedRow(null)}
                                    variant="outline"
                                    size="sm"
                                >
                                    Cerrar
                                </Button>
                            </div>

                            <div className="grid md:grid-cols-2 gap-6">
                                {/* Original Data */}
                                <Card className="p-4">
                                    <h4 className="font-semibold text-red-700 mb-3">Datos Originales</h4>
                                    <div className="space-y-2 text-sm">
                                        <div><strong>Dirección:</strong> {selectedRow.original.address}</div>
                                        <div><strong>Ciudad:</strong> {selectedRow.original.city}</div>
                                        <div><strong>Estado:</strong> {selectedRow.original.state}</div>
                                        <div><strong>Teléfono:</strong> {selectedRow.original.phone}</div>
                                    </div>
                                </Card>

                                {/* Cleaned Data */}
                                <Card className="p-4">
                                    <h4 className="font-semibold text-green-700 mb-3">Datos Limpiados por IA</h4>
                                    <div className="space-y-2 text-sm">
                                        <div><strong>Dirección:</strong> {selectedRow.cleaned.address}</div>
                                        <div><strong>Ciudad:</strong> {selectedRow.cleaned.city}</div>
                                        <div><strong>Estado:</strong> {selectedRow.cleaned.state}</div>
                                        <div><strong>Teléfono:</strong> {selectedRow.cleaned.phone}</div>
                                        <div><strong>Email:</strong> {selectedRow.cleaned.email}</div>
                                    </div>
                                </Card>

                                {/* Geocoding Results */}
                                <Card className="p-4 md:col-span-2">
                                    <h4 className="font-semibold text-blue-700 mb-3">Resultados de Geocodificación</h4>
                                    <div className="grid md:grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <div><strong>Dirección Formateada:</strong> {selectedRow.geocoding.formattedAddress}</div>
                                            <div><strong>Latitud:</strong> {selectedRow.geocoding.latitude?.toFixed(6) || 'N/A'}</div>
                                            <div><strong>Longitud:</strong> {selectedRow.geocoding.longitude?.toFixed(6) || 'N/A'}</div>
                                        </div>
                                        <div>
                                            <div><strong>Confianza:</strong> {Math.round(selectedRow.geocoding.confidence * 100)}%</div>
                                            <div><strong>Descripción:</strong> {selectedRow.geocoding.confidenceDescription}</div>
                                            <div><strong>Tipo:</strong> {selectedRow.geocoding.locationType}</div>
                                        </div>
                                    </div>

                                    {selectedRow.geocoding.staticMapUrl && (
                                        <div className="mt-4">
                                            <img
                                                src={selectedRow.geocoding.staticMapUrl}
                                                alt="Detailed Map"
                                                className="w-full max-w-md mx-auto rounded border"
                                            />
                                        </div>
                                    )}
                                </Card>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
