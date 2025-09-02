import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

// Enable CORS for all routes
app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:3000'], // Vite default ports
    credentials: true
}))

app.use(express.json())

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'OK', message: 'GeoNorm API Server is running' })
})

// Google Maps Geocoding API endpoint
app.get('/api/geocoding', async (req, res) => {
    try {
        const { address, components } = req.query
        const apiKey = process.env.VITE_GOOGLE_MAPS_API_KEY

        console.log(`[GEOCODING] Request for address: ${address}`)
        if (components) {
            console.log(`[GEOCODING] Components: ${components}`)
        }

        if (!address) {
            return res.status(400).json({ error: 'Address parameter is required' })
        }

        if (!apiKey) {
            console.error('[GEOCODING] API key not configured')
            return res.status(500).json({ error: 'Google Maps API key not configured' })
        }

        // Build URL with optional components parameter
        let url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
            address as string
        )}&key=${apiKey}`

        if (components) {
            url += `&components=${encodeURIComponent(components as string)}`
        }

        console.log(`[GEOCODING] Calling Google API: ${url}`)
        const response = await fetch(url)

        if (!response.ok) {
            throw new Error(`Google API returned ${response.status}: ${response.statusText}`)
        }

        const data = await response.json()
        console.log(`[GEOCODING] Success: ${data.status}, ${data.results?.length || 0} results`)
        res.json(data)
    } catch (error) {
        console.error('[GEOCODING] Error:', error)
        res.status(500).json({ error: 'Failed to fetch geocoding data' })
    }
})

// Google Places API endpoint
app.get('/api/places', async (req, res) => {
    try {
        const { input } = req.query
        const apiKey = process.env.VITE_GOOGLE_MAPS_API_KEY

        console.log(`[PLACES] Request for input: ${input}`)

        if (!input) {
            return res.status(400).json({ error: 'Input parameter is required' })
        }

        if (!apiKey) {
            console.error('[PLACES] API key not configured')
            return res.status(500).json({ error: 'Google Maps API key not configured' })
        }

        const url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(
            input as string
        )}&inputtype=textquery&fields=formatted_address,geometry,name,place_id,rating,types&key=${apiKey}`

        console.log(`[PLACES] Calling Google API...`)
        const response = await fetch(url)

        if (!response.ok) {
            throw new Error(`Google API returned ${response.status}: ${response.statusText}`)
        }

        const data = await response.json()
        console.log(`[PLACES] Success: ${data.status}, ${data.candidates?.length || 0} candidates`)
        res.json(data)
    } catch (error) {
        console.error('[PLACES] Error:', error)
        res.status(500).json({ error: 'Failed to fetch places data' })
    }
})

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`)
})
