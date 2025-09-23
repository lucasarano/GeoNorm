import { useState, useMemo, useEffect, useRef } from 'react'
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
    Copy,
    Loader2,
    Mail
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import type { ProcessedRow, ProcessingStatistics } from '../types/processing'

const average = (values: number[]): number | null => {
    if (!values.length) return null
    return values.reduce((total, value) => total + value, 0) / values.length
}

const formatMilliseconds = (value: number | null): string => {
    if (value == null) return '—'
    const rounded = Math.round(value)
    return `${rounded.toLocaleString()} ms`
}

interface DataDashboardProps {
    data: ProcessedRow[]
    statistics: ProcessingStatistics
    totalExpected?: number
    skipped?: number
    isProcessing?: boolean
    progressPercent?: number
    statusMessage?: string
    batchLatenciesMs?: number[]
    batchDurationsMs?: number[]
    totalRuntimeMs?: number | null
    onBack: () => void
}

export default function DataDashboard({ data, statistics, totalExpected, skipped = 0, isProcessing = false, progressPercent: progressOverride, statusMessage, batchLatenciesMs = [], batchDurationsMs = [], totalRuntimeMs = null, onBack }: DataDashboardProps) {
    const { currentUser } = useAuth()
    const [rows, setRows] = useState<ProcessedRow[]>(data)
    const [searchTerm, setSearchTerm] = useState('')
    const [statusFilter, setStatusFilter] = useState<string>('all')
    const [showOriginal, setShowOriginal] = useState(true)
    const [selectedRow, setSelectedRow] = useState<ProcessedRow | null>(null)
    const [selectedForLinks, setSelectedForLinks] = useState<Set<string>>(new Set())
    const [linkError, setLinkError] = useState<string | null>(null)
    const [sendingEmails, setSendingEmails] = useState(false)
    const [emailResults, setEmailResults] = useState<any[]>([])
    const [showEmailResults, setShowEmailResults] = useState(false)
    const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null)
    const selectAllLinksRef = useRef<HTMLInputElement | null>(null)
    const [activeTab, setActiveTab] = useState<'dashboard' | 'debug'>('dashboard')

    const averageBatchLatency = useMemo(() => average(batchLatenciesMs), [batchLatenciesMs])
    const averageBatchDuration = useMemo(() => average(batchDurationsMs), [batchDurationsMs])
    const averageBatchLatencyDisplay = useMemo(() => formatMilliseconds(averageBatchLatency), [averageBatchLatency])
    const averageBatchDurationDisplay = useMemo(() => formatMilliseconds(averageBatchDuration), [averageBatchDuration])
    const totalRuntimeDisplay = useMemo(() => formatMilliseconds(totalRuntimeMs), [totalRuntimeMs])

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
                } else if (message.type === 'location_updated') {
                    console.log('Received location update:', message)

                    const { addressId, data } = message

                    setRows(prev => prev.map(row => {
                        if (!row.recordId || row.recordId !== addressId) return row

                        return {
                            ...row,
                            // Update coordinates with user-provided ones
                            geocoding: {
                                ...row.geocoding,
                                latitude: data.coordinates?.lat || row.geocoding.latitude,
                                longitude: data.coordinates?.lng || row.geocoding.longitude
                            },
                            // Update Google Maps link with new coordinates
                            googleMapsLink: data.googleMapsLink || row.googleMapsLink,
                            // Update status to show it's been confirmed by user
                            status: 'high_confidence' as const
                        }
                    }))

                    // Highlight the updated row briefly
                    setUpdatedRows(new Set([addressId]))
                    setTimeout(() => {
                        setUpdatedRows(new Set())
                    }, 3000)
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

    const selectableRows = useMemo(() => rows.filter(row => !!row.recordId || row.rowIndex !== undefined), [rows])

    const allLinksSelected = useMemo(() => {
        if (selectableRows.length === 0) return false
        return selectableRows.every(row => {
            const id = row.recordId || `row-${row.rowIndex}`
            return selectedForLinks.has(id)
        })
    }, [selectableRows, selectedForLinks])

    const someLinksSelected = useMemo(() => {
        if (selectableRows.length === 0) return false
        return selectableRows.some(row => {
            const id = row.recordId || `row-${row.rowIndex}`
            return selectedForLinks.has(id)
        })
    }, [selectableRows, selectedForLinks])

    useEffect(() => {
        if (selectAllLinksRef.current) {
            selectAllLinksRef.current.indeterminate = !allLinksSelected && someLinksSelected
        }
    }, [allLinksSelected, someLinksSelected])

    useEffect(() => {
        setSelectedForLinks(prev => {
            const validIds = new Set(selectableRows.map(row => row.recordId || `row-${row.rowIndex}`))
            const next = new Set<string>()
            prev.forEach(id => {
                if (validIds.has(id)) {
                    next.add(id)
                }
            })
            if (next.size === prev.size && Array.from(next).every(id => prev.has(id))) {
                return prev
            }
            return next
        })
    }, [selectableRows])

    const handleLinkSelectionToggle = (recordId?: string) => {
        if (!recordId) return
        setSelectedForLinks(prev => {
            const next = new Set(prev)
            if (next.has(recordId)) {
                next.delete(recordId)
            } else {
                next.add(recordId)
            }
            return next
        })
    }

    const handleSelectAllLinks = () => {
        setSelectedForLinks(new Set(selectableRows.map(row => row.recordId || `row-${row.rowIndex}`)))
    }

    const handleClearLinkSelection = () => {
        setSelectedForLinks(new Set())
    }

    const handleSendEmailLinks = async () => {
        if (!currentUser) {
            alert('Debes iniciar sesión para enviar enlaces por email')
            return
        }

        // Filter to only include recordIds (not row-based IDs)
        const selectedIds = Array.from(selectedForLinks).filter(id => !id.startsWith('row-'))

        if (selectedIds.length === 0) {
            alert('Selecciona al menos un registro guardado para enviar por email')
            return
        }

        setSendingEmails(true)
        setLinkError(null)

        try {
            const response = await fetch('/api/send-location-links-email', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userId: currentUser.uid,
                    addressIds: selectedIds
                })
            })

            if (!response.ok) {
                const errorText = await response.text()
                throw new Error(errorText || 'Error enviando emails')
            }

            const payload = await response.json()
            setEmailResults(payload.results || [])
            setShowEmailResults(true)

            // Clear selection
            setSelectedForLinks(new Set())

            console.log(`Emails enviados: ${payload.successCount}/${payload.totalProcessed}`)

        } catch (error: any) {
            console.error('Error sending emails:', error)
            setLinkError(error.message || 'Error al enviar emails')
        } finally {
            setSendingEmails(false)
        }
    }


    const handleCopyLink = async (row: ProcessedRow) => {
        if (!row.locationLinkToken) return

        const baseUrl = window.location.origin
        const linkUrl = `${baseUrl}/location?token=${row.locationLinkToken}`

        try {
            await navigator.clipboard.writeText(linkUrl)
            setCopiedLinkId(row.recordId || row.locationLinkToken)
            setTimeout(() => setCopiedLinkId(null), 2000)
        } catch (error) {
            console.error('Error copying link:', error)
            setLinkError('No se pudo copiar el enlace. Intenta manualmente.')
        }
    }

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

    const getLinkStatusIcon = (row: ProcessedRow) => {
        if (row.locationLinkStatus === 'submitted') {
            return <CheckCircle className="w-4 h-4 text-green-500" />
        } else if (row.locationLinkStatus === 'sent') {
            return <Send className="w-4 h-4 text-blue-500" />
        } else if (row.locationLinkStatus === 'expired') {
            return <XCircle className="w-4 h-4 text-red-500" />
        }
        return null
    }

    const getLinkStatusText = (row: ProcessedRow) => {
        if (row.locationLinkStatus === 'submitted') {
            return 'Coordenadas recibidas'
        } else if (row.locationLinkStatus === 'sent') {
            return 'Enlace enviado'
        } else if (row.locationLinkStatus === 'expired') {
            return 'Enlace expirado'
        }
        return ''
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
            'Latitude',
            'Longitude',
            'Formatted Address',
            'Geocoding Confidence',
            'Google Maps Link',
            'Zip Code',
            'Department',
            'District',
            'Neighborhood',
            'Status'
        ]

        const csvContent = [
            headers.join(','),
            ...filteredData.map(row => {
                return [
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
                    `"${row.googleMapsLink || ''}"`,
                    `"${row.zipCode?.zipCode || ''}"`,
                    `"${row.zipCode?.department || ''}"`,
                    `"${row.zipCode?.district || ''}"`,
                    `"${row.zipCode?.neighborhood || ''}"`,
                    row.status
                ].join(',')
            })
        ].join('\n')

        const blob = new Blob([csvContent], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `processed_addresses_${new Date().toISOString().split('T')[0]}.csv`
        a.click()
        URL.revokeObjectURL(url)
    }

    // Percent helpers for summary cards
    const processedCount = statistics?.totalRows ?? rows.length
    const expectedCount = totalExpected ?? processedCount
    const completionRatio = expectedCount
        ? Math.min(100, Math.round(((processedCount + skipped) / expectedCount) * 100))
        : null
    const baseProgress = typeof progressOverride === 'number'
        ? Math.min(100, Math.max(0, progressOverride))
        : (completionRatio ?? 0)
    const roundedProgress = Math.round(baseProgress)
    const showProgressBar = (expectedCount ?? 0) > 0 && (isProcessing || (baseProgress > 0 && baseProgress < 100))
    const progressStatusText = statusMessage
        || (isProcessing
            ? 'Procesando filas en tiempo real...'
            : 'Procesamiento en curso')
    const totalRowsCount = processedCount || 0
    const pct = (n: number) => totalRowsCount ? Math.round((n / totalRowsCount) * 100) : 0

    return (
        <div className="space-y-6">
            {/* Header */}
            <Card className="p-6 bg-white/50 backdrop-blur-sm border border-orange-100 shadow-lg">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">Dashboard de Resultados</h2>
                        <p className="text-gray-600">
                            {isProcessing
                                ? progressStatusText
                                : statusMessage || (completionRatio !== null && completionRatio >= 100
                                    ? 'Procesamiento completado con éxito.'
                                    : 'Resultados listos para revisión.')}
                        </p>
                    </div>
                    <Button
                        onClick={onBack}
                        variant="outline"
                        className="border-orange-200 text-orange-700 hover:bg-orange-50"
                    >
                        ← Procesar Nuevo CSV
                    </Button>
                </div>

                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 text-sm text-gray-600">
                    <div>
                        Progreso: <span className="font-semibold text-gray-900">{processedCount + skipped}</span>
                        {expectedCount ? (
                            <span className="text-gray-500"> / {expectedCount}</span>
                        ) : null}
                        {completionRatio != null && (
                            <span className="ml-2 text-xs text-orange-600">{completionRatio}% completado</span>
                        )}
                    </div>
                    {skipped > 0 && (
                        <div className="text-xs text-gray-500">Filas omitidas por limpieza: {skipped}</div>
                    )}
                </div>

                {showProgressBar && (
                    <div className="mt-4">
                        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                            <span>{progressStatusText}</span>
                            <span className="font-semibold text-gray-700">{roundedProgress}%</span>
                        </div>
                        <div className="h-2.5 w-full rounded-full bg-gray-200 overflow-hidden">
                            <div
                                className="h-full rounded-full bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 transition-[width] duration-500 ease-out"
                                style={{ width: `${baseProgress}%` }}
                            />
                        </div>
                    </div>
                )}

                {/* Statistics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                    <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                        <div className="flex items-center">
                            <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                            <div>
                                <p className="text-sm text-green-600">Alta Confianza</p>
                                <p className="text-2xl font-bold text-green-700">{statistics.highConfidence}</p>
                                <p className="text-xs text-green-600">{pct(statistics.highConfidence)}%</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                        <div className="flex items-center">
                            <AlertCircle className="w-5 h-5 text-yellow-500 mr-2" />
                            <div>
                                <p className="text-sm text-yellow-600">Confianza Media</p>
                                <p className="text-2xl font-bold text-yellow-700">{statistics.mediumConfidence}</p>
                                <p className="text-xs text-yellow-600">{pct(statistics.mediumConfidence)}%</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                        <div className="flex items-center">
                            <XCircle className="w-5 h-5 text-orange-500 mr-2" />
                            <div>
                                <p className="text-sm text-orange-600">Baja Confianza</p>
                                <p className="text-2xl font-bold text-orange-700">{statistics.lowConfidence}</p>
                                <p className="text-xs text-orange-600">{pct(statistics.lowConfidence)}%</p>
                                {statistics.failed ? (
                                    <p className="text-xs text-orange-500 mt-1">{statistics.failed} filas sin geocodificar</p>
                                ) : null}
                            </div>
                        </div>
                    </div>
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                        <div className="flex items-center">
                            <MapPin className="w-5 h-5 text-blue-500 mr-2" />
                            <div>
                                <p className="text-sm text-blue-600">Total Procesadas</p>
                                <p className="text-2xl font-bold text-blue-700">
                                    {statistics.totalRows}
                                    {expectedCount && expectedCount !== statistics.totalRows ? (
                                        <span className="text-lg text-blue-500"> / {expectedCount}</span>
                                    ) : null}
                                </p>
                                {completionRatio != null && (
                                    <p className="text-xs text-blue-500">{completionRatio}% del dataset</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </Card>

            {/* Tab Navigation */}
            <Card className="p-0 bg-white/50 backdrop-blur-sm border border-orange-100 shadow-lg overflow-hidden">
                <div className="flex border-b border-gray-200">
                    <button
                        onClick={() => setActiveTab('dashboard')}
                        className={`px-6 py-3 text-sm font-medium transition-colors ${activeTab === 'dashboard'
                            ? 'bg-orange-500 text-white border-b-2 border-orange-600'
                            : 'text-gray-600 hover:text-orange-600 hover:bg-orange-50'
                            }`}
                    >
                        Dashboard
                    </button>
                    <button
                        onClick={() => setActiveTab('debug')}
                        className={`px-6 py-3 text-sm font-medium transition-colors ${activeTab === 'debug'
                            ? 'bg-orange-500 text-white border-b-2 border-orange-600'
                            : 'text-gray-600 hover:text-orange-600 hover:bg-orange-50'
                            }`}
                    >
                        DEBUG
                    </button>
                </div>
            </Card>

            {activeTab === 'dashboard' && (
                <>
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
                                        onClick={handleSelectAllLinks}
                                        variant="outline"
                                        size="sm"
                                        className="border-orange-200 text-orange-700 hover:bg-orange-50"
                                    >
                                        Seleccionar todo
                                    </Button>
                                    <Button
                                        onClick={handleClearLinkSelection}
                                        variant="outline"
                                        size="sm"
                                        className="border-orange-200 text-orange-700 hover:bg-orange-50"
                                    >
                                        Limpiar selección
                                    </Button>
                                </div>
                                <div className="flex flex-wrap items-center gap-2 justify-end">
                                    <Button
                                        onClick={handleSendEmailLinks}
                                        disabled={selectedForLinks.size === 0 || sendingEmails}
                                        className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white"
                                    >
                                        {sendingEmails ? (
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        ) : (
                                            <Mail className="w-4 h-4 mr-2" />
                                        )}
                                        {sendingEmails ? 'Enviando emails...' : `Enviar por Email (${selectedForLinks.size})`}
                                    </Button>
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
                            <div className="flex flex-wrap items-center gap-3 text-xs md:text-sm">
                                <span className="text-gray-500">
                                    Seleccionados para enlace: {selectedForLinks.size}
                                </span>
                                {linkError && (
                                    <span className="text-red-600">{linkError}</span>
                                )}
                            </div>
                        </div>
                    </Card>

                    {/* Data Table */}
                    <Card className="bg-white/50 backdrop-blur-sm border border-orange-100 shadow-lg overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            <input
                                                ref={selectAllLinksRef}
                                                type="checkbox"
                                                checked={allLinksSelected && selectableRows.length > 0}
                                                onChange={() => (allLinksSelected ? handleClearLinkSelection() : handleSelectAllLinks())}
                                                className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                                                aria-label="Seleccionar todos los registros"
                                            />
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            # de Guia
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Confianza geocodificación
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Link de Reubicación
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
                                            Código Postal
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Enlace Ubicación
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Coordenadas
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Geo Conf
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

                                        return (
                                            <tr
                                                key={rowKey}
                                                className={`hover:bg-gray-50 cursor-pointer transition-all duration-500 ${isUpdated ? 'bg-green-50 border-l-4 border-green-500' : ''}`}
                                                onClick={() => setSelectedRow(row)}
                                            >
                                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedForLinks.has(row.recordId || `row-${row.rowIndex}`)}
                                                        onChange={(e) => {
                                                            e.stopPropagation()
                                                            handleLinkSelectionToggle(row.recordId || `row-${row.rowIndex}`)
                                                        }}
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                                                    />
                                                </td>
                                                <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                    {row.rowIndex + 1}
                                                </td>
                                                <td className="px-4 py-4 whitespace-nowrap">
                                                    {(() => {
                                                        const geo = row.geocoding.confidence || 0
                                                        const statusForDisplay = row.status === 'failed'
                                                            ? 'failed'
                                                            : geo >= 0.8
                                                                ? 'high_confidence'
                                                                : geo >= 0.6
                                                                    ? 'medium_confidence'
                                                                    : 'low_confidence'
                                                        const label = statusForDisplay === 'high_confidence'
                                                            ? 'Alta confianza'
                                                            : statusForDisplay === 'medium_confidence'
                                                                ? 'Confianza media'
                                                                : statusForDisplay === 'low_confidence'
                                                                    ? 'Baja confianza'
                                                                    : 'Geocodificación fallida'
                                                        return (
                                                            <div className="flex items-center">
                                                                {getStatusIcon(statusForDisplay)}
                                                                <span className={`ml-2 px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(statusForDisplay)}`}>
                                                                    {label}
                                                                </span>
                                                            </div>
                                                        )
                                                    })()}
                                                </td>
                                                <td className="px-4 py-4 whitespace-nowrap">
                                                    {row.locationLinkStatus ? (
                                                        <div className="flex items-center">
                                                            {getLinkStatusIcon(row)}
                                                            <span className="ml-2 text-xs text-gray-600">
                                                                {getLinkStatusText(row)}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-gray-400">Sin enlace</span>
                                                    )}
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
                                                    {row.zipCode ? (
                                                        <div className="space-y-1">
                                                            <div className="font-mono text-sm font-medium">
                                                                {row.zipCode.zipCode || 'N/A'}
                                                            </div>
                                                            <div className="text-xs text-gray-500">
                                                                {row.zipCode.department}
                                                            </div>
                                                            <div className="text-xs text-gray-500">
                                                                {row.zipCode.district}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <span className="text-gray-400 italic">Sin código postal</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-4 text-sm text-gray-900">
                                                    {row.googleMapsLink ? (
                                                        <div className="space-y-1">
                                                            <div className="flex items-center gap-2">
                                                                {(row.locationLinkStatus === 'submitted' || !!row.lastLocationUpdate) && (
                                                                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                                                                        Actualizado por usuario
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <a
                                                                    href={row.googleMapsLink}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="text-xs text-blue-600 hover:text-blue-800 break-all max-w-[220px] md:max-w-xs underline"
                                                                >
                                                                    {row.googleMapsLink}
                                                                </a>
                                                                <Button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        navigator.clipboard.writeText(row.googleMapsLink!)
                                                                        setCopiedLinkId(row.recordId || `row-${row.rowIndex}`)
                                                                        setTimeout(() => setCopiedLinkId(null), 2000)
                                                                    }}
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-7 w-7 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                                                    title="Copiar enlace"
                                                                >
                                                                    <Copy className="w-3.5 h-3.5" />
                                                                </Button>
                                                            </div>
                                                            {copiedLinkId === (row.recordId || `row-${row.rowIndex}`) && (
                                                                <span className="text-xs text-green-600">¡Enlace copiado!</span>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-gray-400">Sin coordenadas</span>
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
                                                            {row.locationLinkStatus === 'sent' && (
                                                                <div className="text-xs text-blue-600 mt-1">
                                                                    ⏳ Enlace enviado, esperando coordenadas
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
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
                                                        onClick={() => handleCopyLink(selectedRow)}
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


                    {/* Email Results Modal */}
                    {showEmailResults && (
                        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                            <div className="bg-white rounded-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                                <div className="p-6">
                                    <div className="flex justify-between items-center mb-6">
                                        <h3 className="text-xl font-bold text-gray-900">
                                            Resultados del Envío de Emails
                                        </h3>
                                        <Button
                                            onClick={() => setShowEmailResults(false)}
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
                                                        {emailResults.filter((r: any) => r.success).length}
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
                                                        {emailResults.filter((r: any) => !r.success).length}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-2 max-h-64 overflow-y-auto">
                                        {emailResults.map((result: any, index: number) => (
                                            <div
                                                key={index}
                                                className={`p-3 rounded-lg border ${result.success
                                                    ? 'bg-green-50 border-green-200'
                                                    : 'bg-red-50 border-red-200'
                                                    }`}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <span className="font-medium">
                                                        {result.customerName || `Cliente ${index + 1}`}
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
                </>
            )}

            {activeTab === 'debug' && (
                <Card className="p-6 bg-white/50 backdrop-blur-sm border border-orange-100 shadow-lg">
                    <div className="space-y-6">
                        <div className="border-b border-gray-200 pb-4">
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">Información de Debug del Procesamiento</h3>
                            <p className="text-sm text-gray-600">
                                Datos detallados del procesamiento batch, incluyendo interacciones con OpenAI y geocodificación.
                            </p>
                        </div>

                        {/* Pipeline Metrics */}
                        <div className="bg-white p-4 rounded-lg border border-gray-200">
                            <h4 className="font-semibold text-gray-900 mb-3">Métricas de Procesamiento</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                                <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                                    <p className="text-gray-500">Latencia promedio LLM</p>
                                    <p className="text-lg font-bold text-gray-900">{averageBatchLatencyDisplay}</p>
                                    <p className="text-xs text-gray-400 mt-1">Tiempo desde el envío del lote hasta recibir respuesta de OpenAI.</p>
                                </div>
                                <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                                    <p className="text-gray-500">Duración promedio del lote</p>
                                    <p className="text-lg font-bold text-gray-900">{averageBatchDurationDisplay}</p>
                                    <p className="text-xs text-gray-400 mt-1">Incluye geocodificación y persistencia.</p>
                                </div>
                                <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                                    <p className="text-gray-500">Tiempo total de ejecución</p>
                                    <p className="text-lg font-bold text-gray-900">{totalRuntimeDisplay}</p>
                                    <p className="text-xs text-gray-400 mt-1">Desde el arranque hasta completar el archivo.</p>
                                </div>
                            </div>
                        </div>

                        {/* Batch Summary */}
                        <div className="bg-gray-50 p-4 rounded-lg">
                            <h4 className="font-semibold text-gray-900 mb-3">Resumen del Batch</h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="bg-white p-3 rounded border">
                                    <p className="text-sm text-gray-600">Total Procesadas</p>
                                    <p className="text-lg font-bold text-gray-900">{rows.length}</p>
                                </div>
                                <div className="bg-white p-3 rounded border">
                                    <p className="text-sm text-gray-600">Tasa de Éxito</p>
                                    <p className="text-lg font-bold text-green-600">
                                        {totalRowsCount
                                            ? (((statistics.highConfidence + statistics.mediumConfidence) / totalRowsCount) * 100).toFixed(1)
                                            : '0.0'}%
                                    </p>
                                </div>
                                <div className="bg-white p-3 rounded border">
                                    <p className="text-sm text-gray-600">Promedio confianza de geocodificación</p>
                                    <p className="text-lg font-bold text-blue-600">
                                        {rows.length ? ((rows.reduce((acc, row) => acc + (row.geocoding.confidence || 0), 0) / rows.length) * 100).toFixed(1) : '0.0'}%
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Individual Row Debug */}
                        <div className="space-y-4">
                            <h4 className="font-semibold text-gray-900">Debug por Dirección</h4>
                            <div className="space-y-3 max-h-96 overflow-y-auto">
                                {rows.map((row, index) => (
                                    <div key={index} className="border border-gray-200 rounded-lg p-4 bg-white">
                                        <div className="flex items-center justify-between mb-3">
                                            <h5 className="font-medium text-gray-900">Fila {index + 1}</h5>
                                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${row.status === 'high_confidence' ? 'bg-green-100 text-green-800' :
                                                row.status === 'medium_confidence' ? 'bg-yellow-100 text-yellow-800' :
                                                    row.status === 'low_confidence' ? 'bg-red-100 text-red-800' : 'bg-gray-200 text-gray-700'
                                                }`}>
                                                {row.status === 'high_confidence' ? 'Alta Confianza' :
                                                    row.status === 'medium_confidence' ? 'Media Confianza' :
                                                        row.status === 'low_confidence' ? 'Baja Confianza' : 'Geocodificación fallida'}
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                            {/* OpenAI Data */}
                                            <div className="space-y-2">
                                                <h6 className="font-medium text-blue-700">OpenAI Processing</h6>
                                                <div className="bg-blue-50 p-3 rounded border">
                                                    <p><span className="font-medium">Original:</span> "{row.original.address}"</p>
                                                    <p><span className="font-medium">Limpiada:</span> "{row.cleaned.address}"</p>
                                                    <p><span className="font-medium">Ciudad:</span> "{row.cleaned.city}"</p>
                                                    <p><span className="font-medium">Estado:</span> "{row.cleaned.state}"</p>
                                                    <p><span className="font-medium">Teléfono:</span> "{row.cleaned.phone}"</p>
                                                    <p><span className="font-medium">Email:</span> "{row.cleaned.email}"</p>
                                                </div>
                                            </div>

                                            {/* Geocoding Data */}
                                            <div className="space-y-2">
                                                <h6 className="font-medium text-green-700">Geocoding Results</h6>
                                                <div className="bg-green-50 p-3 rounded border">
                                                    <p><span className="font-medium">Coordenadas:</span>
                                                        {row.geocoding.latitude && row.geocoding.longitude
                                                            ? `${row.geocoding.latitude}, ${row.geocoding.longitude}`
                                                            : 'No encontradas'}
                                                    </p>
                                                    <p><span className="font-medium">Dirección Formateada:</span> "{row.geocoding.formattedAddress}"</p>
                                                    <p><span className="font-medium">Tipo de Ubicación:</span> {row.geocoding.locationType}</p>
                                                    <p><span className="font-medium">Geo Confidence:</span> {(row.geocoding.confidence * 100).toFixed(1)}%</p>
                                                    <p><span className="font-medium">Descripción:</span> {row.geocoding.confidenceDescription}</p>
                                                    {row.zipCode && (
                                                        <p><span className="font-medium">Código Postal:</span> {row.zipCode.zipCode}</p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Geocoding Confidence Summary */}
                                        <div className="mt-3 bg-orange-50 p-3 rounded border">
                                            <h6 className="font-medium text-orange-700 mb-2">Resumen de confianza de geocodificación</h6>
                                            <div className="text-sm">
                                                <p>Nivel: {row.status === 'high_confidence' ? 'Alta' : row.status === 'medium_confidence' ? 'Media' : row.status === 'low_confidence' ? 'Baja' : 'Fallida'}</p>
                                                <p>Confianza de geocodificación: {(row.geocoding.confidence * 100).toFixed(1)}% ({row.geocoding.confidence.toFixed(2)})</p>
                                                <p>Descripción: {row.geocoding.confidenceDescription}</p>
                                            </div>
                                        </div>

                                        {/* Google Maps Link */}
                                        {row.googleMapsLink && (
                                            <div className="mt-3">
                                                <a
                                                    href={row.googleMapsLink}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-blue-600 hover:text-blue-800 text-sm underline"
                                                >
                                                    Ver en Google Maps →
                                                </a>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </Card>
            )}
        </div>
    )
}
