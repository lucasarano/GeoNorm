import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { Card } from './shared/ui/card'
import { Button } from './shared/ui/button'
import { Input } from './shared/ui/input'
import { Label } from './shared/ui/label'
import {
    MapPin,
    Navigation,
    CheckCircle,
    AlertCircle,
    Loader2,
    Smartphone,
    Target
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

// Removed old confirmation modes - now using unified approach

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

    // Unified confirmation states
    const [addressFields, setAddressFields] = useState({
        street: '',
        city: '',
        state: ''
    })
    // GPS is available alongside address editing (not mutually exclusive)
    const [useGPS] = useState(true)
    const [adjustedLocation, setAdjustedLocation] = useState<LocationData | null>(null)
    const [mapLoaded, setMapLoaded] = useState(false)
    const [map, setMap] = useState<any | null>(null)
    const [marker, setMarker] = useState<any | null>(null)
    const mapContainerRef = useRef<HTMLDivElement | null>(null)

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
        setSubmitting(true)
        setSubmitError(null)

        try {
            const hasAddress = Boolean(addressFields.street.trim() && addressFields.city.trim() && addressFields.state.trim())
            const locationToSubmit = adjustedLocation || location
            const hasLocation = Boolean(locationToSubmit)

            if (!hasAddress && !hasLocation) {
                throw new Error('Completa la dirección y/o comparte tu ubicación')
            }

            const payload: Record<string, any> = {
                orderID: actualOrderID,
                userAgent: navigator.userAgent,
                timestamp: new Date().toISOString(),
                confirmationType: hasAddress && hasLocation ? 'both' : hasAddress ? 'address' : 'gps',
            }

            // Include address if present
            if (hasAddress) {
                payload.addressFields = {
                    street: addressFields.street.trim(),
                    city: addressFields.city.trim(),
                    state: addressFields.state.trim()
                }
                payload.manualAddress = `${addressFields.street.trim()}, ${addressFields.city.trim()}, ${addressFields.state.trim()}`
            }

            // Include GPS if present
            if (hasLocation && locationToSubmit) {
                payload.latitude = locationToSubmit.lat
                payload.longitude = locationToSubmit.lng
                payload.accuracy = locationToSubmit.accuracy
                if (adjustedLocation) {
                    payload.mapAdjusted = true
                }
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
                throw new Error(errorText || 'Error enviando confirmación')
            }
        } catch (err: any) {
            setSubmitError(err.message || 'Error enviando confirmación. Por favor intenta nuevamente.')
            console.error('Submit error:', err)
        } finally {
            setSubmitting(false)
        }
    }, [location, adjustedLocation, addressFields, useGPS, actualOrderID, actualToken])

    const handleStartOver = useCallback(() => {
        setSubmitted(false)
        setSubmitError(null)
        setLocation(null)
        setAdjustedLocation(null)
        setAddressFields({ street: '', city: '', state: '' })
        setError(null)
        setMap(null)
        setMarker(null)
    }, [])

    // Initialize Google Maps
    const initializeMap = useCallback((container: HTMLElement, center: LocationData) => {
        if (!window.google || !window.google.maps) {
            console.error('Google Maps API not loaded')
            return
        }

        const mapInstance = new window.google.maps.Map(container, {
            center: { lat: center.lat, lng: center.lng },
            zoom: 16,
            mapTypeId: window.google.maps.MapTypeId.ROADMAP,
            streetViewControl: false,
            mapTypeControl: false,
            fullscreenControl: false,
        })

        // Create custom marker element
        const markerElement = document.createElement('div')
        markerElement.innerHTML = `
            <svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
                <circle cx="20" cy="20" r="18" fill="#ef4444" stroke="white" stroke-width="2"/>
                <circle cx="20" cy="20" r="6" fill="white"/>
            </svg>
        `
        markerElement.style.cursor = 'pointer'
        markerElement.title = 'Arrastra para ajustar la ubicación'

        const markerInstance = new window.google.maps.marker.AdvancedMarkerElement({
            position: { lat: center.lat, lng: center.lng },
            map: mapInstance,
            content: markerElement,
            gmpDraggable: true,
        })

        markerInstance.addListener('dragend', () => {
            const position = markerInstance.position
            if (position) {
                setAdjustedLocation({
                    lat: typeof position.lat === 'function' ? position.lat() : position.lat,
                    lng: typeof position.lng === 'function' ? position.lng() : position.lng,
                    accuracy: center.accuracy
                })
            }
        })

        setMap(mapInstance)
        setMarker(markerInstance)
        setMapLoaded(true)
    }, [])

    // Load Google Maps API
    const loadGoogleMapsAPI = useCallback(() => {
        if (window.google && window.google.maps) {
            return Promise.resolve()
        }

        return new Promise<void>((resolve, reject) => {
            const existing = document.getElementById('google-maps-js') as HTMLScriptElement | null
            if (existing) {
                existing.addEventListener('load', () => resolve())
                existing.addEventListener('error', () => reject(new Error('Failed to load Google Maps API')))
                return
            }

            const script = document.createElement('script')
            script.id = 'google-maps-js'
            script.src = `https://maps.googleapis.com/maps/api/js?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}&libraries=places,marker&loading=async`
            script.async = true
            script.defer = true
            script.onload = () => resolve()
            script.onerror = () => reject(new Error('Failed to load Google Maps API'))
            document.head.appendChild(script)
        })
    }, [])

    // Initialize address fields from metadata
    useEffect(() => {
        if (requestMetadata?.cleanedAddress && !addressFields.street && !addressFields.city && !addressFields.state) {
            // Try to parse the cleaned address into components
            const addressParts = requestMetadata.cleanedAddress.split(',').map(part => part.trim())
            setAddressFields({
                street: addressParts[0] || '',
                city: addressParts[1] || '',
                state: addressParts[2] || addressParts[addressParts.length - 1] || ''
            })
        }
    }, [requestMetadata?.cleanedAddress, addressFields])

    // Optional: Auto-request location on first use (disabled by default). Keep manual fetch via button.

    // Initialize map when location is available
    useEffect(() => {
        if (location && !mapLoaded) {
            loadGoogleMapsAPI().then(() => {
                const container = mapContainerRef.current
                if (container) {
                    initializeMap(container, location)
                }
            }).catch((error) => {
                console.error('Failed to load Google Maps:', error)
                setError('Error cargando el mapa. Verifica tu conexión a internet.')
            })
        }
    }, [location, mapLoaded, loadGoogleMapsAPI, initializeMap])

    // Component unmount cleanup
    useEffect(() => {
        return () => {
            // Clean up on component unmount
            if (marker) {
                try {
                    marker.map = null
                } catch (error) {
                    console.warn('Error cleaning up marker on unmount:', error)
                }
            }
        }
    }, [marker])

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
                        Puedes editar la dirección o usar tu ubicación GPS actual.
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
                        </div>
                    )}
                </div>

                {/* Unified Address Form */}
                <div className="space-y-6 mb-6">
                    {/* Address Fields Section */}
                    <div className="space-y-4">
                        <Label className="text-sm font-medium text-gray-900">
                            Dirección de Entrega
                        </Label>

                        <div className="space-y-3">
                            <div>
                                <Label htmlFor="street" className="text-xs text-gray-600 mb-1 block">
                                    Calle y Número
                                </Label>
                                <Input
                                    id="street"
                                    value={addressFields.street}
                                    onChange={(e) => setAddressFields(prev => ({ ...prev, street: e.target.value }))}
                                    placeholder="Ej: Av. Mariscal López 1234"
                                    className="w-full"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <Label htmlFor="city" className="text-xs text-gray-600 mb-1 block">
                                        Ciudad
                                    </Label>
                                    <Input
                                        id="city"
                                        value={addressFields.city}
                                        onChange={(e) => setAddressFields(prev => ({ ...prev, city: e.target.value }))}
                                        placeholder="Ej: Asunción"
                                        className="w-full"
                                    />
                                </div>

                                <div>
                                    <Label htmlFor="state" className="text-xs text-gray-600 mb-1 block">
                                        Departamento
                                    </Label>
                                    <Input
                                        id="state"
                                        value={addressFields.state}
                                        onChange={(e) => setAddressFields(prev => ({ ...prev, state: e.target.value }))}
                                        placeholder="Ej: Central"
                                        className="w-full"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* GPS Availability Note */}
                    {!isSupported && (
                        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg mb-3">
                            <div className="flex items-center text-yellow-700">
                                <AlertCircle className="w-4 h-4 mr-2" />
                                <span className="text-xs">GPS no disponible en tu navegador</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* GPS Section */}
                {true && (
                    <div className="space-y-4 mb-6 border-t pt-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-medium text-gray-900">Ubicación GPS</h3>
                            {loading && (
                                <div className="flex items-center text-blue-600">
                                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                                    <span className="text-xs">Buscando...</span>
                                </div>
                            )}
                        </div>

                        {/* GPS Location Display */}
                        {location ? (
                            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                                <div className="flex items-center text-green-700 mb-2">
                                    <CheckCircle className="w-5 h-5 mr-2" />
                                    <span className="text-sm font-medium">Ubicación encontrada</span>
                                </div>
                                <p className="font-mono text-xs text-gray-600 mb-2">
                                    {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
                                </p>
                                {location.accuracy && (
                                    <p className="text-xs text-gray-500">
                                        Precisión: ±{Math.round(location.accuracy)}m
                                    </p>
                                )}
                            </div>
                        ) : error ? (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                                <div className="flex items-center text-red-700 mb-2">
                                    <AlertCircle className="w-5 h-5 mr-2" />
                                    <span className="text-sm font-medium">Error obteniendo ubicación</span>
                                </div>
                                <p className="text-xs text-red-600">{error}</p>
                            </div>
                        ) : (
                            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                                <p className="text-sm text-gray-600">
                                    Necesitamos acceso a tu ubicación para confirmar la dirección de entrega.
                                </p>
                            </div>
                        )}

                        {/* GPS Action Buttons */}
                        {!location && (
                            <Button
                                onClick={getCurrentLocation}
                                disabled={loading || !isSupported}
                                className="w-full bg-green-600 hover:bg-green-700 text-white py-3"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                        Buscando tu ubicación...
                                    </>
                                ) : (
                                    <>
                                        <Navigation className="w-5 h-5 mr-2" />
                                        Obtener mi Ubicación
                                    </>
                                )}
                            </Button>
                        )}
                    </div>
                )}

                {/* Map Section - only show when location is found */}
                {location && (
                    <div className="space-y-4 mb-6 border-t pt-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-medium text-gray-900">Ajustar Ubicación en Mapa</h3>
                        </div>

                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <div className="flex items-center text-blue-700 mb-2">
                                <Target className="w-5 h-5 mr-2" />
                                <span className="text-sm font-medium">Mapa Interactivo</span>
                            </div>
                            <p className="text-xs text-blue-600 mb-3">
                                Arrastra el pin rojo para ajustar la ubicación exacta si es necesario
                            </p>

                            {/* Map Container */}
                            <div
                                ref={mapContainerRef}
                                className="bg-gray-200 rounded-lg h-64 w-full"
                                style={{ minHeight: '256px' }}
                            >
                                {!mapLoaded && (
                                    <div className="h-full flex items-center justify-center">
                                        <div className="text-center text-gray-500">
                                            <Loader2 className="w-6 h-6 mx-auto mb-2 animate-spin" />
                                            <p className="text-sm">Cargando mapa...</p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {adjustedLocation && (
                                <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                                    <p className="text-xs text-green-700 mb-1">
                                        <strong>Ubicación ajustada:</strong>
                                    </p>
                                    <p className="font-mono text-xs text-green-600">
                                        {adjustedLocation.lat.toFixed(6)}, {adjustedLocation.lng.toFixed(6)}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Unified Submit Button */}
                <div className="space-y-4 mb-6">
                    <Button
                        onClick={handleSubmitLocation}
                        disabled={submitting || (!addressFields.street.trim() && !addressFields.city.trim() && !addressFields.state.trim() && !location)}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 text-lg font-medium"
                    >
                        {submitting ? (
                            <>
                                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                Confirmando...
                            </>
                        ) : (
                            <>
                                <CheckCircle className="w-5 h-5 mr-2" />
                                Confirmar cambios
                            </>
                        )}
                    </Button>

                    {/* Optional: Refresh GPS button when GPS is enabled */}
                    {location && (
                        <Button
                            onClick={getCurrentLocation}
                            disabled={loading}
                            variant="outline"
                            className="w-full"
                        >
                            <Navigation className="w-4 h-4 mr-2" />
                            Actualizar Ubicación GPS
                        </Button>
                    )}
                </div>

                {/* Error Messages */}
                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                        <div className="flex items-center text-red-700">
                            <AlertCircle className="w-5 h-5 mr-2" />
                            <span className="text-sm">{error}</span>
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

                {/* Footer */}
                <div className="mt-8 pt-6 border-t border-gray-200">
                    <div className="flex items-center justify-center text-gray-500">
                        <Smartphone className="w-4 h-4 mr-2" />
                        <span className="text-xs">Edita tu dirección y/o comparte tu ubicación para confirmar.</span>
                    </div>
                </div>
            </Card>
        </div>
    )
}
