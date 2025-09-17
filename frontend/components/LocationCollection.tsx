import React, { useState, useCallback, useMemo, useEffect } from 'react'
import { Card } from './shared/ui/card'
import { Button } from './shared/ui/button'
import {
    MapPin,
    Navigation,
    CheckCircle,
    AlertCircle,
    Loader2,
    Smartphone
} from 'lucide-react'

interface LocationData {
    lat: number
    lng: number
    accuracy?: number
}

interface LocationCollectionProps {
    orderID?: string
    token?: string
}

export default function LocationCollection({ orderID, token }: LocationCollectionProps) {
    const [location, setLocation] = useState<LocationData | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [submitting, setSubmitting] = useState(false)
    const [submitted, setSubmitted] = useState(false)
    const [submitError, setSubmitError] = useState<string | null>(null)
    const [metadataLoading, setMetadataLoading] = useState(false)
    const [metadataError, setMetadataError] = useState<string | null>(null)
    const [requestMetadata, setRequestMetadata] = useState<{
        addressId?: string
        customerName?: string
        cleanedAddress?: string
        status?: string
    } | null>(null)

    // Get orderID from URL params if not provided as prop
    const actualOrderID = useMemo(() => {
        if (orderID) return orderID
        try {
            const params = new URLSearchParams(window.location.search)
            return params.get('orderID') || ''
        } catch {
            return ''
        }
    }, [orderID])

    const actualToken = useMemo(() => {
        if (token) return token
        try {
            const params = new URLSearchParams(window.location.search)
            return params.get('token') || undefined
        } catch {
            return undefined
        }
    }, [token])

    const isSupported = 'geolocation' in navigator

    useEffect(() => {
        if (!actualToken) {
            setRequestMetadata(null)
            return
        }

        const fetchMetadata = async () => {
            try {
                setMetadataLoading(true)
                setMetadataError(null)
                const response = await fetch(`/api/location-link/${actualToken}`)
                if (!response.ok) {
                    throw new Error('No pudimos cargar la solicitud de ubicación')
                }
                const data = await response.json()
                setRequestMetadata(data)
                if (data?.status === 'submitted') {
                    setSubmitted(true)
                }
                if (typeof data?.latitude === 'number' && typeof data?.longitude === 'number' && !location) {
                    setLocation({
                        lat: data.latitude,
                        lng: data.longitude,
                        accuracy: typeof data.accuracy === 'number' ? data.accuracy : undefined
                    })
                }
            } catch (err: any) {
                setMetadataError(err.message || 'No pudimos cargar la solicitud de ubicación')
            } finally {
                setMetadataLoading(false)
            }
        }

        fetchMetadata()
    }, [actualToken, location])

    const getCurrentLocation = useCallback(() => {
        if (!isSupported) {
            setError('Tu navegador no soporta servicios de ubicación')
            return
        }

        setLoading(true)
        setError(null)

        const options: PositionOptions = {
            enableHighAccuracy: true,
            timeout: 30000,
            maximumAge: 300000 // 5 minutes
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                setLocation({
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    accuracy: position.coords.accuracy
                })
                setLoading(false)
            },
            (err) => {
                let errorMessage = 'Error obteniendo ubicación'

                switch (err.code) {
                    case err.PERMISSION_DENIED:
                        errorMessage = 'Permiso de ubicación denegado. Por favor permite el acceso a tu ubicación.'
                        break
                    case err.POSITION_UNAVAILABLE:
                        errorMessage = 'Información de ubicación no disponible.'
                        break
                    case err.TIMEOUT:
                        errorMessage = 'Tiempo de espera agotado. Intenta nuevamente.'
                        break
                }

                setError(errorMessage)
                setLoading(false)
            },
            options
        )
    }, [isSupported])

    const handleSubmitLocation = useCallback(async () => {
        if (!location) return

        setSubmitting(true)
        setSubmitError(null)

        try {
            const payload: Record<string, any> = {
                latitude: location.lat,
                longitude: location.lng,
                accuracy: location.accuracy,
                orderID: actualOrderID,
                userAgent: navigator.userAgent,
                timestamp: new Date().toISOString(),
            }

            if (actualToken) {
                payload.token = actualToken
            }

            const endpoint = actualToken
                ? `/api/location-link/${actualToken}/submit`
                : '/api/save-location'

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            })

            if (response.ok) {
                setSubmitted(true)
                if (actualToken) {
                    setRequestMetadata(prev => prev ? { ...prev, status: 'submitted' } : prev)
                }
            } else {
                const errorText = await response.text()
                throw new Error(errorText || 'Error enviando ubicación')
            }
        } catch (err) {
            setSubmitError('Error enviando ubicación. Por favor intenta nuevamente.')
            console.error('Submit error:', err)
        } finally {
            setSubmitting(false)
        }
    }, [location, actualOrderID, actualToken])

    const handleStartOver = useCallback(() => {
        setSubmitted(false)
        setSubmitError(null)
        setLocation(null)
        setError(null)
    }, [])

    // Auto-request location on component mount
    useEffect(() => {
        if (isSupported && !location && !loading && !error && (!actualToken || !metadataLoading)) {
            getCurrentLocation()
        }
    }, [isSupported, location, loading, error, getCurrentLocation, metadataLoading, actualToken])

    if (actualToken && metadataLoading && !requestMetadata) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
                <Card className="w-full max-w-md p-8 bg-white/90 backdrop-blur-sm shadow-xl text-center">
                    <Loader2 className="w-10 h-10 mx-auto animate-spin text-blue-600" />
                    <h2 className="mt-6 text-xl font-semibold text-gray-900">Cargando solicitud de ubicación...</h2>
                    <p className="mt-2 text-gray-600">Estamos preparando los detalles de tu entrega.</p>
                </Card>
            </div>
        )
    }

    if (actualToken && metadataError && !requestMetadata) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-red-50 via-rose-50 to-pink-50 flex items-center justify-center p-4">
                <Card className="w-full max-w-md p-8 bg-white/90 backdrop-blur-sm shadow-xl text-center">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <AlertCircle className="w-8 h-8 text-red-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">Solicitud no encontrada</h2>
                    <p className="text-gray-600 mb-6">{metadataError}</p>
                    <p className="text-sm text-gray-500">Verifica que el enlace sea correcto o contacta al remitente.</p>
                </Card>
            </div>
        )
    }

    if (submitted) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 flex items-center justify-center p-4">
                <Card className="w-full max-w-md p-8 text-center bg-white/90 backdrop-blur-sm shadow-xl">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle className="w-8 h-8 text-green-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">
                        ¡Ubicación Recibida!
                    </h2>
                    <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
                        <p className="text-sm text-gray-600 mb-2">
                            <strong>Latitud:</strong> {location ? location.lat.toFixed(6) : '—'}
                        </p>
                        <p className="text-sm text-gray-600 mb-2">
                            <strong>Longitud:</strong> {location ? location.lng.toFixed(6) : '—'}
                        </p>
                        {location?.accuracy ? (
                            <p className="text-sm text-gray-600">
                                <strong>Precisión:</strong> ±{Math.round(location.accuracy)}m
                            </p>
                        ) : (
                            requestMetadata?.status === 'submitted' && (
                                <p className="text-sm text-gray-600">
                                    <strong>Precisión:</strong> Confirmada por el cliente
                                </p>
                            )
                        )}
                        {actualOrderID && (
                            <p className="text-sm text-gray-600 mt-2">
                                <strong>Order ID:</strong> {actualOrderID}
                            </p>
                        )}
                        {requestMetadata?.cleanedAddress && (
                            <p className="text-sm text-gray-600 mt-2">
                                <strong>Dirección confirmada:</strong> {requestMetadata.cleanedAddress}
                            </p>
                        )}
                    </div>
                    <p className="text-gray-600 mb-6">
                        Gracias por compartir tu ubicación. Tu entrega será procesada pronto.
                    </p>
                    <Button
                        onClick={handleStartOver}
                        variant="outline"
                        className="w-full"
                    >
                        Compartir Otra Ubicación
                    </Button>
                </Card>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
            <Card className="w-full max-w-md p-8 bg-white/90 backdrop-blur-sm shadow-xl">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <MapPin className="w-8 h-8 text-blue-600" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">
                        Confirma tu Ubicación de Entrega
                    </h1>
                    <p className="text-gray-600">
                        Necesitamos tu ubicación exacta usando el GPS de tu dispositivo para completar la entrega.
                    </p>
                    {(actualOrderID || requestMetadata?.cleanedAddress || requestMetadata?.customerName) && (
                        <div className="mt-4 p-3 bg-blue-50 rounded-lg text-left space-y-2">
                            {requestMetadata?.customerName && (
                                <p className="text-sm text-blue-700">
                                    <strong>Nombre:</strong> {requestMetadata.customerName}
                                </p>
                            )}
                            {requestMetadata?.cleanedAddress && (
                                <p className="text-sm text-blue-700">
                                    <strong>Dirección procesada:</strong> {requestMetadata.cleanedAddress}
                                </p>
                            )}
                            {actualOrderID && (
                                <p className="text-sm text-blue-700">
                                    <strong>Order ID:</strong> {actualOrderID}
                                </p>
                            )}
                            {requestMetadata?.status && requestMetadata.status !== 'submitted' && (
                                <p className="text-xs text-blue-600 uppercase tracking-wide">
                                    Estado: {requestMetadata.status === 'pending' ? 'Pendiente de confirmación' : requestMetadata.status}
                                </p>
                            )}
                        </div>
                    )}
                    {metadataError && requestMetadata && (
                        <div className="mt-4 p-3 bg-red-50 rounded-lg text-sm text-red-600">
                            {metadataError}
                        </div>
                    )}
                </div>

                {/* Map Preview */}
                {location && (
                    <div className="mb-6">
                        <div className="bg-gray-100 rounded-lg p-4 text-center">
                            <MapPin className="w-6 h-6 text-green-600 mx-auto mb-2" />
                            <p className="text-sm text-gray-700 mb-2">Ubicación encontrada:</p>
                            <p className="font-mono text-xs text-gray-600">
                                {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
                            </p>
                            {location.accuracy && (
                                <p className="text-xs text-gray-500 mt-1">
                                    Precisión: ±{Math.round(location.accuracy)}m
                                </p>
                            )}
                        </div>
                    </div>
                )}

                {/* Status Messages */}
                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                        <div className="flex items-center text-red-700">
                            <AlertCircle className="w-5 h-5 mr-2" />
                            <span className="text-sm">{error}</span>
                        </div>
                    </div>
                )}

                {location && !error && (
                    <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                        <div className="flex items-center text-green-700">
                            <CheckCircle className="w-5 h-5 mr-2" />
                            <span className="text-sm">
                                ¡Te encontramos! Por favor revisa la ubicación y confirma.
                            </span>
                        </div>
                    </div>
                )}

                {submitError && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                        <div className="flex items-center text-red-700">
                            <AlertCircle className="w-5 h-5 mr-2" />
                            <span className="text-sm">{submitError}</span>
                        </div>
                    </div>
                )}

                {!isSupported && (
                    <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <div className="flex items-center text-yellow-700">
                            <AlertCircle className="w-5 h-5 mr-2" />
                            <span className="text-sm">
                                Tu navegador no soporta servicios de ubicación.
                            </span>
                        </div>
                    </div>
                )}

                {/* Action Buttons */}
                <div className="space-y-4">
                    {!location ? (
                        <Button
                            onClick={getCurrentLocation}
                            disabled={loading || !isSupported}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                    Buscando tu ubicación...
                                </>
                            ) : (
                                <>
                                    <Navigation className="w-5 h-5 mr-2" />
                                    Encontrar mi Ubicación Exacta
                                </>
                            )}
                        </Button>
                    ) : (
                        <>
                            <Button
                                onClick={handleSubmitLocation}
                                disabled={submitting}
                                className="w-full bg-green-600 hover:bg-green-700 text-white py-3"
                            >
                                {submitting ? (
                                    <>
                                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                        Confirmando...
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle className="w-5 h-5 mr-2" />
                                        Confirmar y Enviar Ubicación
                                    </>
                                )}
                            </Button>

                            <Button
                                onClick={getCurrentLocation}
                                disabled={loading}
                                variant="outline"
                                className="w-full"
                            >
                                <Navigation className="w-4 h-4 mr-2" />
                                Buscar Nuevamente
                            </Button>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="mt-8 pt-6 border-t border-gray-200">
                    <div className="flex items-center justify-center text-gray-500">
                        <Smartphone className="w-4 h-4 mr-2" />
                        <span className="text-xs">
                            Asegúrate de tener GPS habilitado
                        </span>
                    </div>
                </div>
            </Card>
        </div>
    )
}
