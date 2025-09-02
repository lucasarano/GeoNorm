import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MapPin, Search, Loader2 } from 'lucide-react'

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

export default function AddressForm() {
    const [address, setAddress] = useState('')
    const [loading, setLoading] = useState(false)
    const [geocodingResult, setGeocodingResult] = useState<GeocodingResponse | null>(null)
    const [placesResult, setPlacesResult] = useState<PlacesResponse | null>(null)
    const [error, setError] = useState<string | null>(null)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!address.trim()) return

        setLoading(true)
        setError(null)
        setGeocodingResult(null)
        setPlacesResult(null)

        const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY

        if (!apiKey) {
            setError('Google Maps API key is not configured')
            setLoading(false)
            return
        }

        try {
            // Call both APIs in parallel through our backend
            const [geocodingResponse, placesResponse] = await Promise.allSettled([
                fetch(`http://localhost:3001/api/geocoding?address=${encodeURIComponent(address)}`),
                fetch(`http://localhost:3001/api/places?input=${encodeURIComponent(address)}`)
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
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
            <div className="max-w-6xl mx-auto space-y-6">
                {/* Header */}
                <div className="text-center py-8">
                    <div className="flex items-center justify-center gap-3 mb-4">
                        <MapPin className="w-8 h-8 text-blue-600" />
                        <h1 className="text-4xl font-bold text-gray-900">GeoNorm</h1>
                    </div>
                    <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                        Transform any address or location into precise coordinates using Google's powerful APIs
                    </p>
                </div>

                {/* Address Input Form */}
                <Card className="max-w-2xl mx-auto shadow-lg">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Search className="w-5 h-5" />
                            Address Lookup
                        </CardTitle>
                        <CardDescription>
                            Enter any address, landmark, or place name to get location data from both Google APIs
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="address">Address or Location</Label>
                                <Input
                                    id="address"
                                    type="text"
                                    placeholder="e.g., Hospital Nacional Itaugua Paraguay, 123 Main St, or Times Square"
                                    value={address}
                                    onChange={(e) => setAddress(e.target.value)}
                                    className="text-lg"
                                />
                            </div>
                            <Button
                                type="submit"
                                disabled={loading || !address.trim()}
                                className="w-full text-lg py-6"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                        Searching...
                                    </>
                                ) : (
                                    <>
                                        <Search className="w-5 h-5 mr-2" />
                                        Search Location
                                    </>
                                )}
                            </Button>
                        </form>

                        {error && (
                            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                                <p className="text-red-800">{error}</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Results */}
                {(geocodingResult || placesResult) && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Geocoding API Results */}
                        <Card className="shadow-lg">
                            <CardHeader>
                                <CardTitle className="text-blue-600">Google Maps Geocoding API</CardTitle>
                                <CardDescription>
                                    Converts addresses to coordinates with high accuracy
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    <div className="text-sm font-medium text-gray-500">
                                        Status: <span className={geocodingResult?.status === 'OK' ? 'text-green-600' : 'text-red-600'}>
                                            {geocodingResult?.status}
                                        </span>
                                    </div>
                                    <pre className="bg-gray-50 p-4 rounded-lg text-sm overflow-auto max-h-96 border">
                                        {JSON.stringify(geocodingResult, null, 2)}
                                    </pre>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Places API Results */}
                        <Card className="shadow-lg">
                            <CardHeader>
                                <CardTitle className="text-green-600">Google Places API</CardTitle>
                                <CardDescription>
                                    Finds places, landmarks, and businesses by name
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    <div className="text-sm font-medium text-gray-500">
                                        Status: <span className={placesResult?.status === 'OK' ? 'text-green-600' : 'text-red-600'}>
                                            {placesResult?.status}
                                        </span>
                                    </div>
                                    <pre className="bg-gray-50 p-4 rounded-lg text-sm overflow-auto max-h-96 border">
                                        {JSON.stringify(placesResult, null, 2)}
                                    </pre>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* API Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
                    <Card className="border-blue-200">
                        <CardHeader>
                            <CardTitle className="text-blue-600">Geocoding API</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm">
                            <p><strong>Purpose:</strong> Convert addresses → coordinates</p>
                            <p><strong>Strength:</strong> Handles messy/misspelled addresses</p>
                            <p><strong>Best for:</strong> Textual addresses, even vague ones</p>
                            <p><strong>Returns:</strong> formatted_address, lat/lng, location_type</p>
                        </CardContent>
                    </Card>

                    <Card className="border-green-200">
                        <CardHeader>
                            <CardTitle className="text-green-600">Places API</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm">
                            <p><strong>Purpose:</strong> Find places by name/landmark</p>
                            <p><strong>Strength:</strong> POIs, landmarks, businesses</p>
                            <p><strong>Best for:</strong> "Hospital Central", business names</p>
                            <p><strong>Returns:</strong> place details, ratings, types</p>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
