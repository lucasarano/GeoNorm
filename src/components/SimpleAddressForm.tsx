import { useState, useEffect } from 'react'

interface GeocodingResponse {
    results: Array<{
        formatted_address: string
        geometry: {
            location: {
                lat: number
                lng: number
            }
            location_type: string
        }
        place_id: string
        types: string[]
    }>
    status: string
}

interface PlacesResponse {
    candidates: Array<{
        formatted_address: string
        geometry: {
            location: {
                lat: number
                lng: number
            }
        }
        name: string
        place_id: string
        rating?: number
        types: string[]
    }>
    status: string
}

// Simple Map component using Google Maps Embed API
function GoogleMap({ lat, lng, title, className = "" }: { lat: number; lng: number; title: string; className?: string }) {
    const mapUrl = `https://www.google.com/maps/embed/v1/place?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}&q=${lat},${lng}&zoom=15&maptype=roadmap`

    return (
        <div className={`bg-slate-900/50 rounded-xl border border-white/10 overflow-hidden ${className}`}>
            <div className="p-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-300">📍 Interactive Map</span>
                    <span className="text-xs text-gray-400">({lat.toFixed(6)}, {lng.toFixed(6)})</span>
                </div>
            </div>
            <iframe
                src={mapUrl}
                width="100%"
                height="256"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title={`Map showing ${title}`}
                className="w-full h-64"
            />
        </div>
    )
}

export default function SimpleAddressForm() {
    const [address, setAddress] = useState('')
    const [components, setComponents] = useState({
        country: '',
        administrative_area: '',
        locality: '',
        postal_code: '',
        route: ''
    })
    const [loading, setLoading] = useState(false)
    const [geocodingResult, setGeocodingResult] = useState<GeocodingResponse | null>(null)
    const [placesResult, setPlacesResult] = useState<PlacesResponse | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [apiCalls, setApiCalls] = useState<{
        geocoding: string
        places: string
    } | null>(null)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!address.trim()) return

        setLoading(true)
        setError(null)
        setGeocodingResult(null)
        setPlacesResult(null)
        setApiCalls(null)

        try {
            // Build components parameter
            const componentsArray = []
            if (components.country) componentsArray.push(`country:${components.country}`)
            if (components.administrative_area) componentsArray.push(`administrative_area:${components.administrative_area}`)
            if (components.locality) componentsArray.push(`locality:${components.locality}`)
            if (components.postal_code) componentsArray.push(`postal_code:${components.postal_code}`)
            if (components.route) componentsArray.push(`route:${components.route}`)

            const componentsParam = componentsArray.length > 0 ? `&components=${componentsArray.join('|')}` : ''

            // Build API URLs
            const geocodingUrl = `http://localhost:3001/api/geocoding?address=${encodeURIComponent(address)}${componentsParam}`
            const placesUrl = `http://localhost:3001/api/places?input=${encodeURIComponent(address)}`

            // Store API calls for display
            setApiCalls({
                geocoding: geocodingUrl,
                places: placesUrl
            })

            // Call both APIs in parallel through our backend
            const [geocodingResponse, placesResponse] = await Promise.allSettled([
                fetch(geocodingUrl),
                fetch(placesUrl)
            ])

            // Handle Geocoding API response
            if (geocodingResponse.status === 'fulfilled') {
                if (geocodingResponse.value.ok) {
                    const geocodingData = await geocodingResponse.value.json()
                    setGeocodingResult(geocodingData)
                } else {
                    console.error('Geocoding API failed:', await geocodingResponse.value.text())
                }
            } else {
                console.error('Geocoding API failed:', geocodingResponse.reason)
            }

            // Handle Places API response
            if (placesResponse.status === 'fulfilled') {
                if (placesResponse.value.ok) {
                    const placesData = await placesResponse.value.json()
                    setPlacesResult(placesData)
                } else {
                    console.error('Places API failed:', await placesResponse.value.text())
                }
            } else {
                console.error('Places API failed:', placesResponse.reason)
            }
        } catch (err) {
            setError('Failed to fetch location data. Please try again.')
            console.error('API Error:', err)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
            {/* Animated background elements */}
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
                <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
            </div>

            <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                {/* Header */}
                <div className="text-center mb-12">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full mb-6 shadow-lg">
                        <span className="text-3xl">🗺️</span>
                    </div>
                    <h1 className="text-5xl font-bold bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent mb-4">
                        GeoNorm
                    </h1>
                    <p className="text-xl text-gray-300 max-w-3xl mx-auto leading-relaxed">
                        Transform any address or location into precise coordinates using Google's powerful APIs
                    </p>
                </div>

                {/* Address Input Form */}
                <div className="max-w-3xl mx-auto mb-12">
                    <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl border border-white/20 p-8">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                                <span className="text-white text-lg">🔍</span>
                            </div>
                            <h2 className="text-2xl font-bold text-white">Address Lookup</h2>
                        </div>
                        <p className="text-gray-300 mb-8 text-lg">
                            Enter any address, landmark, or place name to get location data from both Google APIs
                        </p>

                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div>
                                <label htmlFor="address" className="block text-sm font-medium text-gray-200 mb-3">
                                    Address or Location
                                </label>
                                <input
                                    id="address"
                                    type="text"
                                    placeholder="e.g., Hospital Nacional Itaugua Paraguay, 123 Main St, or Times Square"
                                    value={address}
                                    onChange={(e) => setAddress(e.target.value)}
                                    className="w-full px-6 py-4 text-lg bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent backdrop-blur-sm transition-all duration-200"
                                />
                            </div>

                            {/* Address Components */}
                            <div className="bg-white/5 rounded-xl p-6 border border-white/10">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-teal-600 rounded-lg flex items-center justify-center">
                                        <span className="text-white text-sm">🏗️</span>
                                    </div>
                                    <h3 className="text-lg font-semibold text-white">Address Components (Optional)</h3>
                                </div>
                                <p className="text-gray-400 text-sm mb-4">
                                    Add structured components to constrain the search for better precision
                                </p>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label htmlFor="country" className="block text-sm font-medium text-gray-300 mb-2">
                                            Country Code
                                        </label>
                                        <input
                                            id="country"
                                            type="text"
                                            placeholder="e.g., PY, US, AR"
                                            value={components.country}
                                            onChange={(e) => setComponents(prev => ({ ...prev, country: e.target.value.toUpperCase() }))}
                                            className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-green-500 focus:border-transparent backdrop-blur-sm transition-all duration-200"
                                        />
                                    </div>

                                    <div>
                                        <label htmlFor="administrative_area" className="block text-sm font-medium text-gray-300 mb-2">
                                            State/Province
                                        </label>
                                        <input
                                            id="administrative_area"
                                            type="text"
                                            placeholder="e.g., Central, California"
                                            value={components.administrative_area}
                                            onChange={(e) => setComponents(prev => ({ ...prev, administrative_area: e.target.value }))}
                                            className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-green-500 focus:border-transparent backdrop-blur-sm transition-all duration-200"
                                        />
                                    </div>

                                    <div>
                                        <label htmlFor="locality" className="block text-sm font-medium text-gray-300 mb-2">
                                            City
                                        </label>
                                        <input
                                            id="locality"
                                            type="text"
                                            placeholder="e.g., Asunción, New York"
                                            value={components.locality}
                                            onChange={(e) => setComponents(prev => ({ ...prev, locality: e.target.value }))}
                                            className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-green-500 focus:border-transparent backdrop-blur-sm transition-all duration-200"
                                        />
                                    </div>

                                    <div>
                                        <label htmlFor="postal_code" className="block text-sm font-medium text-gray-300 mb-2">
                                            Postal Code
                                        </label>
                                        <input
                                            id="postal_code"
                                            type="text"
                                            placeholder="e.g., 10001, 1200"
                                            value={components.postal_code}
                                            onChange={(e) => setComponents(prev => ({ ...prev, postal_code: e.target.value }))}
                                            className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-green-500 focus:border-transparent backdrop-blur-sm transition-all duration-200"
                                        />
                                    </div>

                                    <div className="md:col-span-2">
                                        <label htmlFor="route" className="block text-sm font-medium text-gray-300 mb-2">
                                            Street Name
                                        </label>
                                        <input
                                            id="route"
                                            type="text"
                                            placeholder="e.g., Avenida España, Main Street"
                                            value={components.route}
                                            onChange={(e) => setComponents(prev => ({ ...prev, route: e.target.value }))}
                                            className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-green-500 focus:border-transparent backdrop-blur-sm transition-all duration-200"
                                        />
                                    </div>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading || !address.trim()}
                                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-600 disabled:to-gray-700 text-white font-semibold py-4 px-8 rounded-xl transition-all duration-200 transform hover:scale-[1.02] disabled:scale-100 shadow-lg"
                            >
                                {loading ? (
                                    <div className="flex items-center justify-center gap-3">
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        <span>Searching...</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-center gap-3">
                                        <span>🔍</span>
                                        <span>Search Location</span>
                                    </div>
                                )}
                            </button>
                        </form>

                        {error && (
                            <div className="mt-6 p-4 bg-red-500/20 border border-red-500/30 rounded-xl backdrop-blur-sm">
                                <p className="text-red-200">{error}</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Results */}
                {(geocodingResult || placesResult) && (
                    <div className="space-y-8">
                        <div className="text-center">
                            <h2 className="text-3xl font-bold text-white mb-2">API Results</h2>
                            <p className="text-gray-300">Compare results from both Google APIs</p>
                        </div>

                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                            {/* Geocoding API Results */}
                            <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl border border-white/20 overflow-hidden">
                                <div className="bg-gradient-to-r from-blue-500/20 to-blue-600/20 p-6 border-b border-white/10">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                                            <span className="text-white text-sm">🎯</span>
                                        </div>
                                        <h3 className="text-xl font-bold text-white">
                                            Geocoding API
                                        </h3>
                                    </div>
                                    <p className="text-gray-300 text-sm">
                                        Converts addresses to coordinates with high accuracy
                                    </p>
                                </div>

                                <div className="p-6">
                                    {/* API Call Display */}
                                    {apiCalls?.geocoding && (
                                        <div className="bg-slate-800/50 rounded-xl p-4 border border-white/10 mb-4">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-sm font-medium text-gray-300">API Call URL</span>
                                                <button
                                                    onClick={() => navigator.clipboard.writeText(apiCalls.geocoding)}
                                                    className="text-xs bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 px-2 py-1 rounded transition-colors"
                                                >
                                                    📋 Copy URL
                                                </button>
                                            </div>
                                            <code className="text-xs text-blue-300 break-all font-mono bg-slate-900/50 p-2 rounded block">
                                                {apiCalls.geocoding}
                                            </code>
                                        </div>
                                    )}

                                    <div className="flex items-center gap-2 mb-4">
                                        <span className="text-sm font-medium text-gray-300">Status:</span>
                                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${geocodingResult?.status === 'OK'
                                            ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                                            : 'bg-red-500/20 text-red-300 border border-red-500/30'
                                            }`}>
                                            {geocodingResult?.status}
                                        </span>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="bg-slate-900/50 rounded-xl p-4 border border-white/10">
                                            <div className="flex items-center justify-between mb-3">
                                                <span className="text-sm font-medium text-gray-300">JSON Response</span>
                                                <button
                                                    onClick={() => navigator.clipboard.writeText(JSON.stringify(geocodingResult, null, 2))}
                                                    className="text-xs bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 px-2 py-1 rounded transition-colors"
                                                >
                                                    📋 Copy
                                                </button>
                                            </div>
                                            <pre className="text-sm text-gray-300 overflow-auto max-h-80 leading-relaxed font-mono">
                                                {JSON.stringify(geocodingResult, null, 2)}
                                            </pre>
                                        </div>

                                        {/* Map for Geocoding API */}
                                        {geocodingResult?.results?.[0]?.geometry?.location && (
                                            <GoogleMap
                                                lat={geocodingResult.results[0].geometry.location.lat}
                                                lng={geocodingResult.results[0].geometry.location.lng}
                                                title={geocodingResult.results[0].formatted_address}
                                            />
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Places API Results */}
                            <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl border border-white/20 overflow-hidden">
                                <div className="bg-gradient-to-r from-green-500/20 to-green-600/20 p-6 border-b border-white/10">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
                                            <span className="text-white text-sm">📍</span>
                                        </div>
                                        <h3 className="text-xl font-bold text-white">
                                            Places API
                                        </h3>
                                    </div>
                                    <p className="text-gray-300 text-sm">
                                        Finds places, landmarks, and businesses by name
                                    </p>
                                </div>

                                <div className="p-6">
                                    {/* API Call Display */}
                                    {apiCalls?.places && (
                                        <div className="bg-slate-800/50 rounded-xl p-4 border border-white/10 mb-4">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-sm font-medium text-gray-300">API Call URL</span>
                                                <button
                                                    onClick={() => navigator.clipboard.writeText(apiCalls.places)}
                                                    className="text-xs bg-green-500/20 hover:bg-green-500/30 text-green-300 px-2 py-1 rounded transition-colors"
                                                >
                                                    📋 Copy URL
                                                </button>
                                            </div>
                                            <code className="text-xs text-green-300 break-all font-mono bg-slate-900/50 p-2 rounded block">
                                                {apiCalls.places}
                                            </code>
                                        </div>
                                    )}

                                    <div className="flex items-center gap-2 mb-4">
                                        <span className="text-sm font-medium text-gray-300">Status:</span>
                                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${placesResult?.status === 'OK'
                                            ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                                            : 'bg-red-500/20 text-red-300 border border-red-500/30'
                                            }`}>
                                            {placesResult?.status}
                                        </span>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="bg-slate-900/50 rounded-xl p-4 border border-white/10">
                                            <div className="flex items-center justify-between mb-3">
                                                <span className="text-sm font-medium text-gray-300">JSON Response</span>
                                                <button
                                                    onClick={() => navigator.clipboard.writeText(JSON.stringify(placesResult, null, 2))}
                                                    className="text-xs bg-green-500/20 hover:bg-green-500/30 text-green-300 px-2 py-1 rounded transition-colors"
                                                >
                                                    📋 Copy
                                                </button>
                                            </div>
                                            <pre className="text-sm text-gray-300 overflow-auto max-h-80 leading-relaxed font-mono">
                                                {JSON.stringify(placesResult, null, 2)}
                                            </pre>
                                        </div>

                                        {/* Map for Places API */}
                                        {placesResult?.candidates?.[0]?.geometry?.location && (
                                            <GoogleMap
                                                lat={placesResult.candidates[0].geometry.location.lat}
                                                lng={placesResult.candidates[0].geometry.location.lng}
                                                title={placesResult.candidates[0].name || placesResult.candidates[0].formatted_address}
                                            />
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* API Information */}
                <div className="mt-16">
                    <div className="text-center mb-8">
                        <h2 className="text-3xl font-bold text-white mb-2">API Comparison</h2>
                        <p className="text-gray-300">Understanding the strengths of each Google API</p>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
                        <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl border border-white/20 p-8">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                                    <span className="text-white text-xl">🎯</span>
                                </div>
                                <h4 className="text-xl font-bold text-white">Geocoding API</h4>
                            </div>
                            <div className="space-y-4">
                                <div className="flex items-start gap-3">
                                    <div className="w-2 h-2 bg-blue-400 rounded-full mt-2 flex-shrink-0"></div>
                                    <div>
                                        <p className="text-gray-300 font-medium">Purpose</p>
                                        <p className="text-gray-400 text-sm">Convert addresses → coordinates</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="w-2 h-2 bg-blue-400 rounded-full mt-2 flex-shrink-0"></div>
                                    <div>
                                        <p className="text-gray-300 font-medium">Strength</p>
                                        <p className="text-gray-400 text-sm">Handles messy/misspelled addresses</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="w-2 h-2 bg-blue-400 rounded-full mt-2 flex-shrink-0"></div>
                                    <div>
                                        <p className="text-gray-300 font-medium">Best for</p>
                                        <p className="text-gray-400 text-sm">Textual addresses, even vague ones</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="w-2 h-2 bg-blue-400 rounded-full mt-2 flex-shrink-0"></div>
                                    <div>
                                        <p className="text-gray-300 font-medium">Returns</p>
                                        <p className="text-gray-400 text-sm">formatted_address, lat/lng, location_type</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl border border-white/20 p-8">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-green-600 rounded-xl flex items-center justify-center">
                                    <span className="text-white text-xl">📍</span>
                                </div>
                                <h4 className="text-xl font-bold text-white">Places API</h4>
                            </div>
                            <div className="space-y-4">
                                <div className="flex items-start gap-3">
                                    <div className="w-2 h-2 bg-green-400 rounded-full mt-2 flex-shrink-0"></div>
                                    <div>
                                        <p className="text-gray-300 font-medium">Purpose</p>
                                        <p className="text-gray-400 text-sm">Find places by name/landmark</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="w-2 h-2 bg-green-400 rounded-full mt-2 flex-shrink-0"></div>
                                    <div>
                                        <p className="text-gray-300 font-medium">Strength</p>
                                        <p className="text-gray-400 text-sm">POIs, landmarks, businesses</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="w-2 h-2 bg-green-400 rounded-full mt-2 flex-shrink-0"></div>
                                    <div>
                                        <p className="text-gray-300 font-medium">Best for</p>
                                        <p className="text-gray-400 text-sm">"Hospital Central", business names</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="w-2 h-2 bg-green-400 rounded-full mt-2 flex-shrink-0"></div>
                                    <div>
                                        <p className="text-gray-300 font-medium">Returns</p>
                                        <p className="text-gray-400 text-sm">place details, ratings, types</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
