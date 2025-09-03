import { useState } from 'react'

interface GeocodingResponse {
    results: Array<{
        formatted_address: string
        geometry: {
            location: { lat: number; lng: number }
            location_type: string
        }
        place_id: string
    }>
    status: string
}

interface PlacesResponse {
    candidates: Array<{
        formatted_address: string
        geometry: {
            location: { lat: number; lng: number }
        }
        name: string
        place_id: string
    }>
    status: string
}

function SimpleAddressForm() {
    const [address, setAddress] = useState('')
    const [components, setComponents] = useState({
        country: '',
        state: '',
        city: '',
        postal_code: '',
        route: ''
    })
    const [loading, setLoading] = useState(false)
    const [geocodingResult, setGeocodingResult] = useState<GeocodingResponse | null>(null)
    const [placesResult, setPlacesResult] = useState<PlacesResponse | null>(null)
    const [apiCalls, setApiCalls] = useState({ geocoding: '', places: '' })

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!address.trim() && !Object.values(components).some(v => v.trim())) return

        setLoading(true)
        setGeocodingResult(null)
        setPlacesResult(null)

        try {
            // Build API URLs
            const geocodingParams = new URLSearchParams()
            if (address.trim()) geocodingParams.append('address', address)

            if (Object.values(components).some(v => v.trim())) {
                const componentParts = []
                if (components.country) componentParts.push(`country:${components.country}`)
                if (components.state) componentParts.push(`administrative_area:${components.state}`)
                if (components.city) componentParts.push(`locality:${components.city}`)
                if (components.postal_code) componentParts.push(`postal_code:${components.postal_code}`)
                if (components.route) componentParts.push(`route:${components.route}`)

                if (componentParts.length > 0) {
                    geocodingParams.append('components', componentParts.join('|'))
                }
            }

            const geocodingUrl = `/api/geocoding?${geocodingParams}`
            const placesUrl = `/api/places?input=${encodeURIComponent(address || Object.values(components).filter(v => v.trim()).join(' '))}`

            setApiCalls({ geocoding: geocodingUrl, places: placesUrl })

            // Make API calls
            const [geocodingRes, placesRes] = await Promise.all([
                fetch(geocodingUrl),
                address.trim() ? fetch(placesUrl) : Promise.resolve(null)
            ])

            if (geocodingRes.ok) {
                const geocodingData = await geocodingRes.json()
                setGeocodingResult(geocodingData)
            }

            if (placesRes && placesRes.ok) {
                const placesData = await placesRes.json()
                setPlacesResult(placesData)
            }
        } catch (error) {
            console.error('Error:', error)
        } finally {
            setLoading(false)
        }
    }

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text)
    }

    return (
        <div className="space-y-8">
            {/* Input Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Main Address Input */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Address (Optional)
                    </label>
                    <input
                        type="text"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                        placeholder="Enter address or landmark..."
                    />
                    <p className="text-xs text-gray-500 mt-1">
                        Free-text address search with Google's smart parsing
                    </p>
                </div>

                {/* Address Components */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                        Address Components (Optional)
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <input
                            type="text"
                            value={components.country}
                            onChange={(e) => setComponents(prev => ({ ...prev, country: e.target.value }))}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                            placeholder="Country (e.g., PY)"
                        />
                        <input
                            type="text"
                            value={components.state}
                            onChange={(e) => setComponents(prev => ({ ...prev, state: e.target.value }))}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                            placeholder="State/Department"
                        />
                        <input
                            type="text"
                            value={components.city}
                            onChange={(e) => setComponents(prev => ({ ...prev, city: e.target.value }))}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                            placeholder="City"
                        />
                        <input
                            type="text"
                            value={components.postal_code}
                            onChange={(e) => setComponents(prev => ({ ...prev, postal_code: e.target.value }))}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                            placeholder="Postal Code"
                        />
                        <input
                            type="text"
                            value={components.route}
                            onChange={(e) => setComponents(prev => ({ ...prev, route: e.target.value }))}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                            placeholder="Street Name"
                        />
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                        Use components for precise filtering and location constraints
                    </p>
                </div>

                {/* Submit Button */}
                <button
                    type="submit"
                    disabled={loading || (!address.trim() && !Object.values(components).some(v => v.trim()))}
                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 px-6 rounded-lg font-medium hover:from-blue-700 hover:to-indigo-700 focus:ring-4 focus:ring-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                    {loading ? (
                        <span className="flex items-center justify-center">
                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Processing...
                        </span>
                    ) : (
                        'Geocode Address'
                    )}
                </button>
            </form>

            {/* Results */}
            {(geocodingResult || placesResult) && (
                <div className="space-y-6">
                    {/* API Call URLs */}
                    {apiCalls.geocoding && (
                        <div className="bg-gray-50 rounded-lg p-4">
                            <h4 className="font-medium text-gray-900 mb-2">API Calls Made</h4>
                            <div className="space-y-2">
                                <div className="flex items-center justify-between bg-white rounded p-2 text-xs">
                                    <span className="text-gray-600 truncate">Geocoding: {apiCalls.geocoding}</span>
                                    <button onClick={() => copyToClipboard(apiCalls.geocoding)} className="text-blue-600 hover:text-blue-800 ml-2">
                                        Copy
                                    </button>
                                </div>
                                {apiCalls.places && (
                                    <div className="flex items-center justify-between bg-white rounded p-2 text-xs">
                                        <span className="text-gray-600 truncate">Places: {apiCalls.places}</span>
                                        <button onClick={() => copyToClipboard(apiCalls.places)} className="text-blue-600 hover:text-blue-800 ml-2">
                                            Copy
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Geocoding Results */}
                    {geocodingResult && (
                        <div className="bg-white border border-gray-200 rounded-lg p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h4 className="font-semibold text-gray-900">🗺️ Google Maps Geocoding</h4>
                                <span className={`px-2 py-1 rounded text-xs font-medium ${geocodingResult.status === 'OK' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                    }`}>
                                    {geocodingResult.status}
                                </span>
                            </div>

                            {geocodingResult.results?.length > 0 ? (
                                <div className="space-y-4">
                                    {geocodingResult.results.slice(0, 3).map((result, index) => (
                                        <div key={index} className="border-l-4 border-blue-500 pl-4">
                                            <p className="font-medium text-gray-900">{result.formatted_address}</p>
                                            <p className="text-sm text-gray-600">
                                                📍 {result.geometry.location.lat.toFixed(6)}, {result.geometry.location.lng.toFixed(6)}
                                            </p>
                                            <p className="text-xs text-gray-500">Type: {result.geometry.location_type}</p>

                                            {/* Interactive Map */}
                                            <div className="mt-3 bg-gray-100 rounded-lg overflow-hidden">
                                                <iframe
                                                    src={`https://www.google.com/maps/embed/v1/place?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}&q=${result.geometry.location.lat},${result.geometry.location.lng}&zoom=15`}
                                                    width="100%"
                                                    height="200"
                                                    style={{ border: 0 }}
                                                    allowFullScreen
                                                    loading="lazy"
                                                    referrerPolicy="no-referrer-when-downgrade"
                                                    title={`Map for ${result.formatted_address}`}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-gray-500">No results found</p>
                            )}
                        </div>
                    )}

                    {/* Places Results */}
                    {placesResult && (
                        <div className="bg-white border border-gray-200 rounded-lg p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h4 className="font-semibold text-gray-900">🏢 Google Places API</h4>
                                <span className={`px-2 py-1 rounded text-xs font-medium ${placesResult.status === 'OK' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                    }`}>
                                    {placesResult.status}
                                </span>
                            </div>

                            {placesResult.candidates?.length > 0 ? (
                                <div className="space-y-4">
                                    {placesResult.candidates.slice(0, 3).map((candidate, index) => (
                                        <div key={index} className="border-l-4 border-indigo-500 pl-4">
                                            <p className="font-medium text-gray-900">{candidate.name}</p>
                                            <p className="text-sm text-gray-600">{candidate.formatted_address}</p>
                                            <p className="text-sm text-gray-600">
                                                📍 {candidate.geometry.location.lat.toFixed(6)}, {candidate.geometry.location.lng.toFixed(6)}
                                            </p>

                                            {/* Interactive Map */}
                                            <div className="mt-3 bg-gray-100 rounded-lg overflow-hidden">
                                                <iframe
                                                    src={`https://www.google.com/maps/embed/v1/place?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}&q=${candidate.geometry.location.lat},${candidate.geometry.location.lng}&zoom=15`}
                                                    width="100%"
                                                    height="200"
                                                    style={{ border: 0 }}
                                                    allowFullScreen
                                                    loading="lazy"
                                                    referrerPolicy="no-referrer-when-downgrade"
                                                    title={`Map for ${candidate.name}`}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-gray-500">No places found</p>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

export default SimpleAddressForm