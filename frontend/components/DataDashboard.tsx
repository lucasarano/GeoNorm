import { useState, useMemo, useEffect } from 'react'
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
    EyeOff,
    Send,
    Users,
    Phone,
    Copy,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

interface ProcessedRow {
    rowIndex: number
    recordId?: string
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
    locationLinkToken?: string
    locationLinkStatus?: 'pending' | 'sent' | 'submitted' | 'expired'
    locationLinkExpiresAt?: string
    lastLocationUpdate?: string
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
    const { currentUser } = useAuth()
    const [rows, setRows] = useState<ProcessedRow[]>(data)
    const [searchTerm, setSearchTerm] = useState('')
    const [statusFilter, setStatusFilter] = useState<string>('all')
    const [showOriginal, setShowOriginal] = useState(true)
    const [selectedRow, setSelectedRow] = useState<ProcessedRow | null>(null)

    useEffect(() => {
        setRows(data)
    }, [data])

    useEffect(() => {
        if (!selectedRow) return
        const updated = rows.find(row =>
            (row.recordId && row.recordId === selectedRow.recordId) || row.rowIndex === selectedRow.rowIndex
        )
        if (updated && updated !== selectedRow) {
            setSelectedRow(updated)
        }
    }, [rows, selectedRow])

    // Filter and search data
    const filteredData = useMemo(() => {
        return rows.filter(row => {
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
    }, [rows, searchTerm, statusFilter])

    // Track recently updated rows for animations
    const [updatedRows, setUpdatedRows] = useState<Set<string>>(new Set())

    // Real-time SSE for address updates
    useEffect(() => {
        if (!currentUser) return

        console.log('Setting up SSE connection for user:', currentUser.uid)
        const eventSource = new EventSource(`/api/address-updates/stream?userId=${currentUser.uid}`)

        eventSource.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data)

                if (message.type === 'connected') {
                    console.log('SSE connected:', message.message)
                } else if (message.type === 'address_update') {
                    console.log('Received address update:', message)
                    console.log('Address fields in update:', message.data?.addressFields)
                    console.log('Confirmed address:', message.data?.confirmedAddress)

                    const { addressId, data } = message

                    setRows(prev => prev.map(row => {
                        if (!row.recordId || row.recordId !== addressId) return row

                        const updatedRow = {
                            ...row,
                            // Update cleaned address fields if provided
                            ...(data.addressFields && {
                                cleaned: {
                                    ...row.cleaned,
                                    address: data.addressFields.street || row.cleaned.address,
                                    city: data.addressFields.city || row.cleaned.city,
                                    state: data.addressFields.state || row.cleaned.state,
                                }
                            }),
                            geocoding: {
                                ...row.geocoding,
                                latitude: data.coordinates?.lat ?? row.geocoding.latitude,
                                longitude: data.coordinates?.lng ?? row.geocoding.longitude,
                                formattedAddress: data.confirmedAddress || row.geocoding.formattedAddress,
                                confidence: data.confirmationType === 'gps' ? 0.95 : data.confirmationType === 'both' ? 0.98 : 0.85,
                                confidenceDescription: data.confirmationType === 'gps'
                                    ? 'Ubicación confirmada por GPS'
                                    : data.confirmationType === 'both'
                                        ? 'Dirección y GPS confirmados por el cliente'
                                        : 'Dirección confirmada por el cliente',
                                locationType: 'USER_CONFIRMED',
                                staticMapUrl: row.geocoding.staticMapUrl
                            },
                            status: 'high_confidence' as const,
                            locationLinkStatus: 'submitted' as const,
                            lastLocationUpdate: data.timestamp
                        }

                        return updatedRow
                    }))

                    // Highlight the updated row
                    setUpdatedRows(new Set([addressId]))
                    setTimeout(() => {
                        setUpdatedRows(new Set())
                    }, 3000)
                } else if (message.type === 'link_generated' || message.type === 'email_sent') {
                    console.log('Received link/email update:', message)

                    const { addressId, data } = message

                    setRows(prev => prev.map(row => {
                        if (!row.recordId || row.recordId !== addressId) return row

                        return {
                            ...row,
                            locationLinkStatus: data.locationLinkStatus || row.locationLinkStatus,
                            locationLinkToken: data.locationLinkToken || row.locationLinkToken,
                            locationLinkExpiresAt: data.locationLinkExpiresAt || row.locationLinkExpiresAt
                        }
                    }))

                    // Highlight the updated row briefly
                    setUpdatedRows(new Set([addressId]))
                    setTimeout(() => {
                        setUpdatedRows(new Set())
                    }, 2000)
                } else if (message.type === 'ping') {
                    // Keep-alive ping, no action needed
                }
            } catch (error) {
                console.error('Error parsing SSE message:', error)
            }
        }

        eventSource.onerror = (error) => {
            console.error('SSE connection error:', error)
        }

        return () => {
            console.log('Closing SSE connection')
            eventSource.close()
        }
    }, [currentUser])




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

    const getLinkStatusBadge = (status?: ProcessedRow['locationLinkStatus']) => {
        switch (status) {
            case 'submitted':
                return { label: 'Ubicación recibida', className: 'bg-green-100 text-green-800' }
            case 'sent':
                return { label: 'Enlace enviado', className: 'bg-blue-100 text-blue-800' }
            case 'pending':
                return { label: 'Pendiente de envío', className: 'bg-yellow-100 text-yellow-800' }
            case 'expired':
                return { label: 'Enlace vencido', className: 'bg-gray-200 text-gray-600' }
            default:
                return { label: 'Sin enlace', className: 'bg-gray-200 text-gray-600' }
        }
    }

    const formatDateTime = (isoString?: string) => {
        if (!isoString) return ''
        try {
            return new Date(isoString).toLocaleString()
        } catch {
            return ''
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
            'AI Confidence',
            'Latitude',
            'Longitude',
            'Formatted Address',
            'Geocoding Confidence',
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
                row.cleaned.aiConfidence,
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

                    <div className="flex flex-col md:flex-row items-stretch gap-2 md:justify-end">
                        <div className="flex flex-wrap items-center gap-2 justify-end">
                            <Button
                                onClick={downloadCSV}
                                className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white"
                            >
                                <Download className="w-4 h-4 mr-2" />
                                Descargar CSV
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="mt-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between text-sm text-gray-600">
                    <span>
                        Mostrando {filteredData.length} de {rows.length} registros
                    </span>
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
                                    Teléfono
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Email
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Enlace Ubicación
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Coordenadas
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Confianza
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    AI Conf.
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Mapa
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {filteredData.map((row) => {
                                const rowKey = row.recordId || `row-${row.rowIndex}`
                                const isUpdated = row.recordId ? updatedRows.has(row.recordId) : false
                                const linkStatus = getLinkStatusBadge(row.locationLinkStatus)
                                const linkUrl = row.locationLinkToken ? `${window.location.origin}/location?token=${row.locationLinkToken}` : ''

                                return (
                                    <tr
                                        key={rowKey}
                                        className={`hover:bg-gray-50 cursor-pointer transition-all duration-500 ${isUpdated ? 'bg-green-50 border-l-4 border-green-500' : ''}`}
                                        onClick={() => setSelectedRow(row)}
                                    >
                                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                                        </td>
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
                                            {row.cleaned.phone || <span className="text-gray-400 italic">Sin teléfono</span>}
                                        </td>
                                        <td className="px-4 py-4 text-sm text-gray-900">
                                            {row.cleaned.email || <span className="text-gray-400 italic">Sin email</span>}
                                        </td>
                                        <td className="px-4 py-4 text-sm text-gray-900">
                                            {row.locationLinkToken ? (
                                                <div className="space-y-1">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${linkStatus.className}`}>
                                                            {linkStatus.label}
                                                        </span>
                                                        {row.lastLocationUpdate && (
                                                            <span className="text-xs text-gray-500">
                                                                Actualizado: {formatDateTime(row.lastLocationUpdate)}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs text-gray-600 break-all max-w-[220px] md:max-w-xs">
                                                            {linkUrl}
                                                        </span>
                                                        <Button
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                // Copy link functionality removed
                                                            }}
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-7 w-7 text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                                                            title="Copiar enlace"
                                                        >
                                                            <Copy className="w-3.5 h-3.5" />
                                                        </Button>
                                                    </div>
                                                    {row.locationLinkExpiresAt && (
                                                        <div className="text-[11px] text-gray-400">
                                                            Expira: {formatDateTime(row.locationLinkExpiresAt)}
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-xs text-gray-400">Sin enlace generado</span>
                                            )}
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
                                                <span className="text-xs text-gray-500">Sin coordenadas</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-4 text-sm text-gray-900">
                                            <div className="flex items-center">
                                                <MapPin className="w-4 h-4 text-blue-500 mr-2" />
                                                <div>
                                                    <div className="font-medium">
                                                        {(row.geocoding.confidence * 100).toFixed(0)}%
                                                    </div>
                                                    <div className="text-xs text-gray-500">
                                                        {row.geocoding.confidenceDescription}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 text-sm text-gray-900">
                                            {row.cleaned.aiConfidence}%
                                        </td>
                                        <td className="px-4 py-4 text-sm text-gray-900">
                                            {row.geocoding.staticMapUrl ? (
                                                <img
                                                    src={row.geocoding.staticMapUrl}
                                                    alt={`Mapa de ${row.cleaned.address}`}
                                                    className="rounded-lg shadow-sm"
                                                />
                                            ) : (
                                                <span className="text-xs text-gray-500">Mapa no disponible</span>
                                            )}
                                        </td>
                                    </tr>
                                )
                            })}
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
                                        <div><strong>Confianza IA:</strong> <span className="text-purple-700 font-semibold">{selectedRow.cleaned.aiConfidence}%</span></div>
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

                                {selectedRow.locationLinkToken && (
                                    <Card className="p-4 md:col-span-2">
                                        <h4 className="font-semibold text-orange-600 mb-3">Enlace de Ubicación Compartido</h4>
                                        <div className="space-y-3 text-sm">
                                            <div>
                                                <strong>Estado:</strong>{' '}
                                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-50 text-orange-700">
                                                    {selectedRow.locationLinkStatus === 'submitted' ? 'Ubicación confirmada' : selectedRow.locationLinkStatus || 'Enviado'}
                                                </span>
                                            </div>
                                            <div className="break-all">
                                                <strong>Enlace:</strong> {`${window.location.origin}/location?token=${selectedRow.locationLinkToken}`}
                                            </div>
                                            {selectedRow.locationLinkExpiresAt && (
                                                <div>
                                                    <strong>Expira:</strong> {formatDateTime(selectedRow.locationLinkExpiresAt)}
                                                </div>
                                            )}
                                            <Button
                                                onClick={() => {
                                                    // Copy link functionality removed
                                                }}
                                                variant="outline"
                                                size="sm"
                                                className="border-orange-200 text-orange-700 hover:bg-orange-50"
                                            >
                                                <Copy className="w-4 h-4 mr-2" /> Copiar enlace
                                            </Button>
                                        </div>
                                    </Card>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* SMS Confirmation Modal - REMOVED */}
            {false && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                        <div className="p-6">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-bold text-gray-900">
                                    Confirmación por SMS
                                </h3>
                                <Button
                                    onClick={() => setShowSMSModal(false)}
                                    variant="outline"
                                    size="sm"
                                >
                                    Cerrar
                                </Button>
                            </div>

                            <div className="mb-6">
                                <p className="text-gray-600 mb-4">
                                    Selecciona los clientes que recibirán SMS para confirmar sus direcciones.
                                    Por defecto se seleccionan direcciones con confianza ≤40%.
                                </p>

                                <div className="flex gap-4 mb-4">
                                    <Button
                                        onClick={handleSelectAllSMSEligible}
                                        variant="outline"
                                        size="sm"
                                        className="flex items-center gap-2"
                                    >
                                        <Users className="w-4 h-4" />
                                        Seleccionar Elegibles ({smsEligibleRows.length})
                                    </Button>
                                    <Button
                                        onClick={handleDeselectAllSMS}
                                        variant="outline"
                                        size="sm"
                                        className="flex items-center gap-2"
                                    >
                                        <XCircle className="w-4 h-4" />
                                        Deseleccionar Todo
                                    </Button>
                                </div>

                                <div className="bg-blue-50 p-4 rounded-lg mb-4">
                                    <p className="text-sm text-blue-800">
                                        <strong>{selectedForSMS.size}</strong> clientes seleccionados para SMS
                                    </p>
                                </div>
                            </div>

                            {/* Customer Selection Table */}
                            <div className="border rounded-lg overflow-hidden mb-6">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Seleccionar
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Fila
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Dirección Limpiada
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Teléfono
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Confianza
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {data
                                            .filter(row => row.cleaned.phone && row.cleaned.phone.trim() !== '')
                                            .map((row) => (
                                                <tr key={row.rowIndex} className="hover:bg-gray-50">
                                                    <td className="px-4 py-4 whitespace-nowrap">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedForSMS.has(row.rowIndex)}
                                                            onChange={() => handleSMSSelectionToggle(row.rowIndex)}
                                                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                        {row.rowIndex + 1}
                                                    </td>
                                                    <td className="px-4 py-4 text-sm text-gray-900 max-w-xs">
                                                        <div className="truncate" title={row.cleaned.address}>
                                                            {row.cleaned.address}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-4 whitespace-nowrap">
                                                        <div className="flex items-center text-sm text-gray-900">
                                                            <Phone className="w-4 h-4 mr-2 text-gray-400" />
                                                            {row.cleaned.phone}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-4 whitespace-nowrap">
                                                        <div className="flex items-center">
                                                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${row.geocoding.confidence <= 0.4
                                                                ? 'bg-red-100 text-red-800'
                                                                : row.geocoding.confidence <= 0.7
                                                                    ? 'bg-yellow-100 text-yellow-800'
                                                                    : 'bg-green-100 text-green-800'
                                                                }`}>
                                                                {Math.round(row.geocoding.confidence * 100)}%
                                                            </span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Send Button */}
                            <div className="flex justify-end gap-4">
                                <Button
                                    onClick={() => setShowSMSModal(false)}
                                    variant="outline"
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    onClick={handleSendSMS}
                                    disabled={selectedForSMS.size === 0 || isSendingSMS}
                                    className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white"
                                >
                                    {isSendingSMS ? (
                                        <>
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                            Enviando...
                                        </>
                                    ) : (
                                        <>
                                            <Send className="w-4 h-4 mr-2" />
                                            Enviar SMS a {selectedForSMS.size} Clientes
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* SMS Results Modal - REMOVED */}
            {false && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                        <div className="p-6">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-bold text-gray-900">
                                    Resultados del Envío SMS
                                </h3>
                                <Button
                                    onClick={() => setShowSMSResults(false)}
                                    variant="outline"
                                    size="sm"
                                >
                                    Cerrar
                                </Button>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mb-6">
                                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                                    <div className="flex items-center">
                                        <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                                        <div>
                                            <p className="text-sm text-green-600">Exitosos</p>
                                            <p className="text-2xl font-bold text-green-700">
                                                {smsResults.filter(r => r.success).length}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                                    <div className="flex items-center">
                                        <XCircle className="w-5 h-5 text-red-500 mr-2" />
                                        <div>
                                            <p className="text-sm text-red-600">Fallidos</p>
                                            <p className="text-2xl font-bold text-red-700">
                                                {smsResults.filter(r => !r.success).length}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2 max-h-64 overflow-y-auto">
                                {smsResults.map((result, index) => (
                                    <div
                                        key={index}
                                        className={`p-3 rounded-lg border ${result.success
                                            ? 'bg-green-50 border-green-200'
                                            : 'bg-red-50 border-red-200'
                                            }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="font-medium">
                                                Fila {result.rowIndex + 1}
                                            </span>
                                            {result.success ? (
                                                <CheckCircle className="w-4 h-4 text-green-500" />
                                            ) : (
                                                <XCircle className="w-4 h-4 text-red-500" />
                                            )}
                                        </div>
                                        {result.error && (
                                            <p className="text-sm text-red-600 mt-1">{result.error}</p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

