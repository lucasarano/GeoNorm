import { useState, useCallback, useMemo, useEffect, useRef, Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { Card } from './shared/ui/card'
import { Button } from './shared/ui/button'
import { MapPin, CheckCircle, AlertCircle, Loader2, Target } from 'lucide-react'

interface LocationData {
    lat: number
    lng: number
    accuracy?: number
}

interface LocationCollectionProps {
    orderID?: string
    token?: string
}

// Error boundary for Google Maps component
interface ErrorBoundaryState {
    hasError: boolean
    error?: Error
}

class MapErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
    constructor(props: { children: ReactNode }) {
        super(props)
        this.state = { hasError: false }
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error }
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.warn('Map component error caught:', error, errorInfo)
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex items-center text-yellow-700">
                        <AlertCircle className="w-4 h-4 mr-2" />
                        <span className="text-sm">El mapa no pudo cargarse correctamente. La funcionalidad GPS seguirá funcionando.</span>
                    </div>
                </div>
            )
        }

        return this.props.children
    }
}

// Removed old confirmation modes - now using unified approach

const debugLog = (...args: any[]) => {
    console.log('[LocationCollection]', ...args)
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

    const [adjustedLocation, setAdjustedLocation] = useState<LocationData | null>(null)
    const [markerPosition, setMarkerPosition] = useState<LocationData | null>(null)
    const [mapLoaded, setMapLoaded] = useState(false)
    const mapRef = useRef<any>(null)
    const markerRef = useRef<any>(null)
    const mapContainerRef = useRef<HTMLDivElement | null>(null)
    const cleanupRef = useRef<boolean>(false)
    const hasRequestedLocationRef = useRef<boolean>(false)
    const latestAccuracyRef = useRef<number | undefined>(undefined)

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
                debugLog('Fetched request metadata', data)
                setRequestMetadata(data)
                if (data?.status === 'submitted') {
                    setSubmitted(true)
                }
                if (typeof data?.latitude === 'number' && typeof data?.longitude === 'number' && !location) {
                    debugLog('Setting location from metadata', {
                        latitude: data.latitude,
                        longitude: data.longitude,
                        accuracy: data.accuracy
                    })
                    setLocation({
                        lat: data.latitude,
                        lng: data.longitude,
                        accuracy: typeof data.accuracy === 'number' ? data.accuracy : undefined
                    })
                }
            } catch (err: any) {
                debugLog('Metadata fetch failed', err)
                setMetadataError(err.message || 'No pudimos cargar la solicitud de ubicación')
            } finally {
                setMetadataLoading(false)
            }
        }

        fetchMetadata()
    }, [actualToken, location])

    useEffect(() => {
        if (location && !adjustedLocation) {
            debugLog('Setting marker position from device location', {
                location
            })
            setMarkerPosition(location)
        }

        if (typeof location?.accuracy === 'number') {
            debugLog('Updating latest accuracy from device location', location.accuracy)
            latestAccuracyRef.current = location.accuracy
        }
    }, [location, adjustedLocation])

    useEffect(() => {
        if (adjustedLocation) {
            debugLog('Applying adjusted marker position', {
                adjustedLocation
            })
            setMarkerPosition(adjustedLocation)

            if (typeof adjustedLocation.accuracy === 'number') {
                debugLog('Updating latest accuracy from adjusted location', adjustedLocation.accuracy)
                latestAccuracyRef.current = adjustedLocation.accuracy
            }
        }
    }, [adjustedLocation])

    useEffect(() => {
        if (markerPosition) {
            debugLog('markerPosition state changed', markerPosition)
        }
    }, [markerPosition])

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
                const newLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    accuracy: position.coords.accuracy
                }
                debugLog('Browser geolocation success', newLocation)
                setLocation(newLocation)
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

                debugLog('Browser geolocation error', {
                    code: err.code,
                    message: errorMessage
                })
                setError(errorMessage)
                setLoading(false)
            },
            options
        )
    }, [isSupported])

    useEffect(() => {
        if (!location && !hasRequestedLocationRef.current) {
            hasRequestedLocationRef.current = true
            getCurrentLocation()
        }
    }, [location, getCurrentLocation])

    const handleSubmitLocation = useCallback(async () => {
        setSubmitting(true)
        setSubmitError(null)

        try {
            const locationToSubmit = markerPosition || adjustedLocation || location

            if (!locationToSubmit) {
                throw new Error('No pudimos obtener tu ubicación. Ajusta el marcador e inténtalo nuevamente.')
            }

            const payload: Record<string, any> = {
                orderID: actualOrderID,
                userAgent: navigator.userAgent,
                timestamp: new Date().toISOString(),
                confirmationType: 'gps',
                latitude: locationToSubmit.lat,
                longitude: locationToSubmit.lng,
            }

            if (typeof locationToSubmit.accuracy === 'number') {
                payload.accuracy = locationToSubmit.accuracy
            }

            if (adjustedLocation) {
                payload.mapAdjusted = true
            }

            if (actualToken) {
                payload.token = actualToken
            }

            debugLog('Submitting marker location', {
                payload,
                markerPosition,
                adjustedLocation,
                originalLocation: location
            })

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
                debugLog('Location submission succeeded', {
                    endpoint,
                    status: response.status
                })
                setSubmitted(true)
                if (actualToken) {
                    setRequestMetadata(prev => prev ? { ...prev, status: 'submitted' } : prev)
                }
            } else {
                const errorText = await response.text()
                debugLog('Location submission failed', {
                    endpoint,
                    status: response.status,
                    errorText
                })
                throw new Error(errorText || 'Error enviando confirmación')
            }
        } catch (err: any) {
            setSubmitError(err.message || 'Error enviando confirmación. Por favor intenta nuevamente.')
            console.error('Submit error:', err)
        } finally {
            setSubmitting(false)
        }
    }, [adjustedLocation, markerPosition, location, actualOrderID, actualToken])

    // Initialize Google Maps with AdvancedMarkerElement
    const initializeMap = useCallback((container: HTMLElement, center: LocationData) => {
        debugLog('initializeMap called', {
            center
        })
        console.log('[DEBUG] initializeMap called with center:', center)
        console.log('[DEBUG] Google Maps API available:', {
            google: !!window.google,
            maps: !!(window.google && window.google.maps),
            Map: !!(window.google && window.google.maps && window.google.maps.Map),
            marker: !!(window.google && window.google.maps && (window.google.maps as any).marker)
        })

        if (!window.google || !window.google.maps || !window.google.maps.Map) {
            console.error('Google Maps API not fully loaded')
            setError('Google Maps API no está disponible')
            return
        }

        try {
            console.log('[DEBUG] Creating map instance...')
            // Don't clear container innerHTML - let Google Maps handle it
            const mapInstance = new window.google.maps.Map(container, {
                center: { lat: center.lat, lng: center.lng },
                zoom: 16,
                mapTypeId: window.google.maps.MapTypeId?.ROADMAP || 'roadmap',
                streetViewControl: false,
                mapTypeControl: false,
                fullscreenControl: false,
                zoomControl: true,
                mapId: 'DEMO_MAP_ID' // Required for AdvancedMarkerElement
            } as any)

            console.log('[DEBUG] Map instance created successfully')

            const createMarker = () => {
                try {
                    cleanupRef.current = false
                    debugLog('Creating marker, cleanup guard reset')

                    const svgMarkup = `
                        <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="16" cy="16" r="13" fill="#2563eb" stroke="white" stroke-width="2"/>
                            <circle cx="16" cy="16" r="5" fill="white"/>
                        </svg>
                    `
                    const icon = {
                        url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svgMarkup)}`,
                        scaledSize: new window.google.maps.Size(32, 32),
                        anchor: new window.google.maps.Point(16, 16)
                    }

                    const markerInstance = new window.google.maps.Marker({
                        map: mapInstance,
                        position: { lat: center.lat, lng: center.lng },
                        draggable: true,
                        title: 'Arrastra para ajustar la ubicación',
                        icon
                    })

                    const initialAccuracy = typeof latestAccuracyRef.current === 'number'
                        ? latestAccuracyRef.current
                        : typeof center.accuracy === 'number'
                            ? center.accuracy
                            : undefined

                    const updateFromLatLng = (source: string, latLng: any, finalize = false) => {
                        if (cleanupRef.current) {
                            debugLog('updateFromLatLng skipped during cleanup', { source, finalize })
                            return
                        }
                        if (!latLng) {
                            debugLog('updateFromLatLng skipped - missing latLng', { source, finalize })
                            return
                        }

                        const latFn = typeof latLng.lat === 'function' ? latLng.lat() : latLng.lat
                        const lngFn = typeof latLng.lng === 'function' ? latLng.lng() : latLng.lng
                        const lat = typeof latFn === 'number' ? latFn : undefined
                        const lng = typeof lngFn === 'number' ? lngFn : undefined

                        if (typeof lat !== 'number' || typeof lng !== 'number') {
                            debugLog('updateFromLatLng skipped - invalid coordinates', { source, latFn, lngFn })
                            return
                        }
                        const accuracy = typeof latestAccuracyRef.current === 'number'
                            ? latestAccuracyRef.current
                            : typeof center.accuracy === 'number'
                                ? center.accuracy
                                : undefined

                        const updated: LocationData = { lat, lng, accuracy }

                        debugLog('Marker position update', { source, updated, finalize })

                        setMarkerPosition(updated)

                        if (finalize) {
                            setAdjustedLocation(updated)
                            if (typeof accuracy === 'number') {
                                latestAccuracyRef.current = accuracy
                            }
                        }
                    }

                    const currentLatLng = markerInstance.getPosition()
                    if (currentLatLng) {
                        const accuracy = initialAccuracy
                        const updated: LocationData = {
                            lat: currentLatLng.lat(),
                            lng: currentLatLng.lng(),
                            accuracy
                        }
                        debugLog('Initial marker position set', updated)
                        setMarkerPosition(updated)
                        if (typeof accuracy === 'number') {
                            latestAccuracyRef.current = accuracy
                        }
                    }

                    markerInstance.addListener('position_changed', () => {
                        updateFromLatLng('position_changed', markerInstance.getPosition())
                    })

                    markerInstance.addListener('dragend', () => {
                        updateFromLatLng('dragend', markerInstance.getPosition(), true)
                    })

                    markerInstance.addListener('drag', () => {
                        updateFromLatLng('drag', markerInstance.getPosition())
                    })

                    mapInstance.addListener('click', (event: any) => {
                        if (!event.latLng) {
                            debugLog('Map click without latLng payload')
                            return
                        }
                        debugLog('Map click reposition', event.latLng.toJSON())
                        markerInstance.setPosition(event.latLng)
                        updateFromLatLng('map_click', markerInstance.getPosition(), true)
                    })

                    markerRef.current = markerInstance
                    setMapLoaded(true)
                    debugLog('Marker created successfully')
                } catch (markerError) {
                    console.error('Error creating marker:', markerError)
                    setError('Error creando marcador en el mapa')
                    setMapLoaded(true)
                }
            }

            mapRef.current = mapInstance

            if ((window.google.maps as any).event) {
                (window.google.maps as any).event.addListenerOnce(mapInstance, 'idle', createMarker)
            } else {
                createMarker()
            }
        } catch (error) {
            console.error('Error initializing map:', error)
            setError('Error inicializando el mapa')
            // Set map as loaded even on error to prevent infinite loading
            setMapLoaded(true)
        }
    }, [])

    // Load Google Maps API with modern async pattern
    const loadGoogleMapsAPI = useCallback(() => {
        console.log('[DEBUG] loadGoogleMapsAPI called')
        console.log('[DEBUG] Current Google Maps state:', {
            google: !!window.google,
            maps: !!(window.google && window.google.maps),
            Map: !!(window.google && window.google.maps && window.google.maps.Map),
            marker: !!(window.google && window.google.maps && (window.google.maps as any).marker)
        })

        if (window.google && window.google.maps && window.google.maps.Map) {
            console.log('[DEBUG] Google Maps already loaded')
            return Promise.resolve()
        }

        return new Promise<void>((resolve, reject) => {
            const existing = document.getElementById('google-maps-js') as HTMLScriptElement | null
            if (existing) {
                console.log('[DEBUG] Script already exists, waiting for it to load...')
                // If script exists, wait for it to load
                const checkLoaded = () => {
                    if (window.google && window.google.maps && window.google.maps.Map) {
                        console.log('[DEBUG] Existing script loaded successfully')
                        resolve()
                    } else {
                        setTimeout(checkLoaded, 100)
                    }
                }
                checkLoaded()
                return
            }

            // Get API key with fallback
            const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'DEMO_KEY'
            console.log('[DEBUG] Using API key:', apiKey ? `${apiKey.substring(0, 10)}...` : 'NO KEY')

            // Create a unique callback name
            const callbackName = `initGoogleMaps_${Date.now()}`
            console.log('[DEBUG] Creating callback:', callbackName)

                ; (window as any)[callbackName] = () => {
                    console.log('[DEBUG] Google Maps callback triggered')
                    delete (window as any)[callbackName]
                    resolve()
                }

            const script = document.createElement('script')
            script.id = 'google-maps-js'
            script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&v=weekly&loading=async&libraries=places,marker&callback=${callbackName}`
            script.async = true
            script.defer = true
            script.onerror = (error) => {
                console.error('[DEBUG] Script load error:', error)
                delete (window as any)[callbackName]
                reject(new Error('Failed to load Google Maps API'))
            }

            console.log('[DEBUG] Adding script to head:', script.src)
            document.head.appendChild(script)
        })
    }, [])

    // Initialize map when location is available
    useEffect(() => {
        console.log('[DEBUG] Map initialization useEffect triggered:', {
            hasLocation: !!location,
            mapLoaded,
            hasContainer: !!mapContainerRef.current
        })

        if (location && !mapLoaded) {
            // Wait for the container to be available with timeout
            let retryCount = 0
            const maxRetries = 50 // 5 seconds max wait time

            const checkContainer = () => {
                if (mapContainerRef.current) {
                    console.log('[DEBUG] Container found, starting map initialization process...')
                    loadGoogleMapsAPI().then(() => {
                        console.log('[DEBUG] Google Maps API loaded, initializing map...')
                        const container = mapContainerRef.current
                        if (container) {
                            console.log('[DEBUG] Container confirmed, calling initializeMap')
                            initializeMap(container, location)
                        } else {
                            console.error('[DEBUG] Container lost during API loading')
                            setError('No se pudo encontrar el contenedor del mapa')
                            setMapLoaded(true) // Prevent infinite loading
                        }
                    }).catch((error) => {
                        console.error('Failed to load Google Maps:', error)
                        setError('Error cargando el mapa. Verifica tu conexión a internet.')
                        setMapLoaded(true) // Prevent infinite loading
                    })
                } else if (retryCount < maxRetries) {
                    retryCount++
                    console.log(`[DEBUG] Container not ready, retrying in 100ms... (${retryCount}/${maxRetries})`)
                    setTimeout(checkContainer, 100)
                } else {
                    console.error('[DEBUG] Container never became available after 5 seconds')
                    setError('No se pudo cargar el mapa. El contenedor no está disponible.')
                    setMapLoaded(true) // Prevent infinite loading
                }
            }

            checkContainer()
        } else if (location && mapLoaded && !mapRef.current) {
            // Map is marked as loaded but no map instance exists - reset the state
            console.log('[DEBUG] Map marked as loaded but no map instance found, resetting...')
            setMapLoaded(false)
        }
    }, [location, mapLoaded, loadGoogleMapsAPI, initializeMap])

    // Additional effect to handle container becoming available later
    useEffect(() => {
        if (location && !mapLoaded && mapContainerRef.current && !mapRef.current) {
            console.log('[DEBUG] Container became available, retrying map initialization...')
            setMapLoaded(false) // Reset to trigger the main initialization effect
        }
    }, [location, mapLoaded])

    useEffect(() => {
        if (!mapLoaded || !location || !markerRef.current || !mapRef.current || adjustedLocation) {
            return
        }

        try {
            mapRef.current.setCenter({ lat: location.lat, lng: location.lng })
            if (typeof markerRef.current.setPosition === 'function') {
                markerRef.current.setPosition({ lat: location.lat, lng: location.lng })
                debugLog('Synced marker with device location', {
                    location
                })
            }
        } catch (updateError) {
            console.warn('Error actualizando la posición del marcador:', updateError)
        }
    }, [location, mapLoaded, adjustedLocation])

    // Component cleanup - prevent React DOM conflicts
    useEffect(() => {
        cleanupRef.current = false
        debugLog('Component mounted, cleanup guard disabled')

        return () => {
            debugLog('Component unmounting, enabling cleanup guard')
            // Mark as cleaning up to prevent state updates
            cleanupRef.current = true

            // Clean up marker first
            if (markerRef.current) {
                try {
                    markerRef.current.map = null
                } catch (error) {
                    console.warn('Error cleaning marker:', error)
                }
                markerRef.current = null
            }

            // Clean up map - let Google Maps handle its own DOM
            if (mapRef.current) {
                try {
                    // Don't destroy the map, just clear our reference
                    mapRef.current = null
                } catch (error) {
                    console.warn('Error cleaning map:', error)
                }
            }

            // Clear the container reference to prevent React from trying to clean it
            if (mapContainerRef.current) {
                // Create a new empty div to replace the map container
                const newDiv = document.createElement('div')
                newDiv.className = mapContainerRef.current.className
                newDiv.style.cssText = mapContainerRef.current.style.cssText

                try {
                    const parent = mapContainerRef.current.parentNode
                    if (parent) {
                        parent.replaceChild(newDiv, mapContainerRef.current)
                    }
                } catch (error) {
                    // If replacement fails, just clear the reference
                    console.warn('Could not replace map container:', error)
                }
            }
        }
    }, [])

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

    const displayedLocation = markerPosition || location

    if (submitted) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 flex items-center justify-center p-4">
                <Card className="w-full max-w-md p-8 text-center bg-white/90 backdrop-blur-sm shadow-xl">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle className="w-8 h-8 text-green-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">
                        ¡Gracias por tu ayuda!
                    </h2>
                    <p className="text-gray-600 mb-4">
                        Gracias por ayudarnos a hacer la entrega más eficiente.
                    </p>
                    {displayedLocation && (
                        <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
                            <p className="text-sm font-semibold text-gray-800 mb-2">
                                Ubicación enviada
                            </p>
                            <p className="font-mono text-xs text-gray-600">
                                {displayedLocation.lat.toFixed(6)}, {displayedLocation.lng.toFixed(6)}
                            </p>
                            {typeof displayedLocation.accuracy === 'number' && (
                                <p className="text-xs text-gray-500 mt-1">
                                    Precisión aproximada: ±{Math.round(displayedLocation.accuracy)}m
                                </p>
                            )}
                        </div>
                    )}
                    <p className="text-sm text-gray-500">
                        Puedes cerrar esta ventana cuando quieras.
                    </p>
                </Card>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
            <Card className="w-full max-w-md overflow-hidden bg-white/90 backdrop-blur-sm shadow-xl">
                <div className="p-8 space-y-6">
                    <div className="text-center space-y-3">
                        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                            <MapPin className="w-8 h-8 text-blue-600" />
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900">
                            Confirma tu punto de entrega
                        </h1>
                        <p className="text-gray-600">
                            Ajusta el marcador rojo y envía la ubicación exacta de tu entrega.
                        </p>
                        {(requestMetadata?.customerName || requestMetadata?.cleanedAddress || actualOrderID) && (
                            <div className="mt-4 space-y-1 rounded-lg border border-blue-100 bg-blue-50 p-3 text-left text-sm text-blue-700">
                                {requestMetadata?.customerName && (
                                    <p>
                                        <strong className="font-medium">Nombre:</strong> {requestMetadata.customerName}
                                    </p>
                                )}
                                {requestMetadata?.cleanedAddress && (
                                    <p>
                                        <strong className="font-medium">Dirección registrada:</strong> {requestMetadata.cleanedAddress}
                                    </p>
                                )}
                                {actualOrderID && (
                                    <p>
                                        <strong className="font-medium">ID de pedido:</strong> {actualOrderID}
                                    </p>
                                )}
                            </div>
                        )}
                    </div>

                    <MapErrorBoundary>
                        <div className="space-y-3">
                            <div className="relative h-72 w-full overflow-hidden rounded-xl border border-blue-100 bg-blue-50">
                                <div ref={mapContainerRef} className="h-full w-full" />
                                {(!location || !mapLoaded) && (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 p-6 text-center">
                                        {loading ? (
                                            <>
                                                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                                                <p className="mt-3 text-sm font-medium text-gray-700">Buscando tu ubicación...</p>
                                            </>
                                        ) : !location ? (
                                            <>
                                                <AlertCircle className="h-6 w-6 text-blue-600" />
                                                <p className="mt-3 text-sm font-medium text-gray-700">
                                                    Permite el acceso a tu ubicación para ver el mapa.
                                                </p>
                                            </>
                                        ) : (
                                            <>
                                                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                                                <p className="mt-3 text-sm font-medium text-gray-700">Cargando mapa...</p>
                                            </>
                                        )}
                                    </div>
                                )}
                                {markerPosition && mapLoaded && (
                                    <div className="absolute bottom-3 left-3 rounded-lg bg-white/90 px-3 py-2 text-[11px] font-medium text-gray-700 shadow-md">
                                        <div>
                                            <span className="text-gray-500">Lat:</span> {markerPosition.lat.toFixed(6)}
                                        </div>
                                        <div>
                                            <span className="text-gray-500">Lng:</span> {markerPosition.lng.toFixed(6)}
                                        </div>
                                        {adjustedLocation && (
                                            <div className="mt-1 text-[10px] font-semibold text-blue-600">
                                                Marcador ajustado
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="flex items-start space-x-3 rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-blue-700">
                                <Target className="h-5 w-5 flex-shrink-0" />
                                <span>Mueve el marcador para que apunte exactamente donde quieres recibir tu entrega.</span>
                            </div>
                        </div>
                    </MapErrorBoundary>

                    {error && (
                        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                            {error}
                        </div>
                    )}

                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
                        {displayedLocation ? (
                            <>
                                <p className="font-semibold text-gray-900">Coordenadas del marcador</p>
                                <p className="mt-2 font-mono text-xs text-gray-600">
                                    {displayedLocation.lat.toFixed(6)}, {displayedLocation.lng.toFixed(6)}
                                </p>
                                {typeof displayedLocation.accuracy === 'number' && (
                                    <p className="mt-1 text-xs text-gray-500">
                                        Precisión aproximada: ±{Math.round(displayedLocation.accuracy)}m
                                    </p>
                                )}
                                {adjustedLocation && (
                                    <p className="mt-1 text-xs text-blue-600">Marcador ajustado manualmente.</p>
                                )}
                            </>
                        ) : (
                            <p>Esperando la ubicación del dispositivo.</p>
                        )}
                    </div>
                </div>

                <div className="border-t border-gray-100 p-6">
                    <Button
                        onClick={handleSubmitLocation}
                        disabled={submitting || loading || !displayedLocation}
                        className="w-full bg-blue-600 py-4 text-lg font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {submitting ? (
                            <>
                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                Enviando ubicación...
                            </>
                        ) : (
                            'Enviar ubicación'
                        )}
                    </Button>
                    {submitError && (
                        <p className="mt-3 text-center text-sm text-red-600">{submitError}</p>
                    )}
                    {!isSupported && (
                        <p className="mt-3 text-center text-xs text-gray-500">
                            Tu navegador no soporta geolocalización automática.
                        </p>
                    )}
                </div>
            </Card>
        </div>
    )
}
