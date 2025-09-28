import { VercelRequest, VercelResponse } from '@vercel/node'
import { getConfidenceScore, getConfidenceDescription, buildComponents } from '../../lib/utils/geocoding'

export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

    if (req.method === 'OPTIONS') {
        return res.status(200).end()
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' })
    }

    try {
        const { addresses, options = {} } = req.body

        if (!addresses || !Array.isArray(addresses)) {
            return res.status(400).json({ error: 'Addresses array is required' })
        }

        const mapsApiKey = process.env.VITE_GOOGLE_MAPS_API_KEY
        if (!mapsApiKey) {
            return res.status(500).json({ error: 'Google Maps API key not configured' })
        }

        const results = []
        const batchSize = options.batchSize || 10
        const delay = options.delay || 100 // ms between requests

        // Process addresses in batches
        for (let i = 0; i < addresses.length; i += batchSize) {
            const batch = addresses.slice(i, i + batchSize)

            const batchPromises = batch.map(async (address: any) => {
                try {
                    const { address: addr, city, state, country = 'PY' } = address

                    if (!addr || addr.trim().length < 3) {
                        return {
                            ...address,
                            geocoding: {
                                latitude: null,
                                longitude: null,
                                formattedAddress: '',
                                confidence: 0,
                                error: 'Invalid address'
                            }
                        }
                    }

                    const components = [`country:${country}`]
                    if (state) components.push(`administrative_area:${state}`)
                    if (city) components.push(`locality:${city}`)

                    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(addr)}&components=${encodeURIComponent(components.join('|'))}&key=${mapsApiKey}`

                    const response = await fetch(url)
                    const data = await response.json()

                    if (data.status === 'OK' && data.results?.length > 0) {
                        const best = data.results.reduce((acc: any, cur: any) => {
                            const score = getConfidenceScore(cur?.geometry?.location_type)
                            if (!acc || score > acc.confidence_score) {
                                return {
                                    latitude: cur.geometry.location.lat,
                                    longitude: cur.geometry.location.lng,
                                    formatted_address: cur.formatted_address,
                                    location_type: cur.geometry.location_type,
                                    confidence_score: score
                                }
                            }
                            return acc
                        }, null)

                        return {
                            ...address,
                            geocoding: {
                                latitude: best.latitude,
                                longitude: best.longitude,
                                formattedAddress: best.formatted_address,
                                confidence: best.confidence_score,
                                locationType: best.location_type,
                                confidenceDescription: getConfidenceDescription(best.location_type),
                                googleMapsLink: `https://www.google.com/maps?q=${best.latitude},${best.longitude}`
                            }
                        }
                    } else {
                        return {
                            ...address,
                            geocoding: {
                                latitude: null,
                                longitude: null,
                                formattedAddress: '',
                                confidence: 0,
                                error: data.error_message || 'No results found'
                            }
                        }
                    }
                } catch (error: any) {
                    return {
                        ...address,
                        geocoding: {
                            latitude: null,
                            longitude: null,
                            formattedAddress: '',
                            confidence: 0,
                            error: error.message
                        }
                    }
                }
            })

            const batchResults = await Promise.all(batchPromises)
            results.push(...batchResults)

            // Add delay between batches to respect rate limits
            if (i + batchSize < addresses.length) {
                await new Promise(resolve => setTimeout(resolve, delay))
            }
        }

        res.json({
            success: true,
            totalProcessed: results.length,
            results,
            metadata: {
                batchSize,
                delay,
                timestamp: new Date().toISOString()
            }
        })

    } catch (error: any) {
        console.error('Geocoding error:', error)
        res.status(500).json({ error: 'Failed to geocode addresses', details: error.message })
    }
}
