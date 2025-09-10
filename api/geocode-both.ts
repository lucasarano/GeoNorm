import { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
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
    const { originalAddress, cleanedAddress, components } = req.body || {}
    const apiKey = process.env.VITE_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY

    if (!apiKey) {
      return res.status(500).json({ error: 'Google Maps API key not configured' })
    }

    // Validate addresses - prioritize cleaned addresses
    const hasValidCleaned = cleanedAddress && cleanedAddress.trim() && cleanedAddress.trim() !== 'N/A' && cleanedAddress.trim().length >= 3

    if (!hasValidCleaned) {
      return res.status(400).json({ error: 'Valid cleaned address must be provided' })
    }

    const buildComponents = (c?: any) => {
      if (!c) return undefined
      const parts: string[] = []
      if (c.country) parts.push(`country:${c.country}`)
      if (c.state) parts.push(`administrative_area:${c.state}`)
      if (c.city) parts.push(`locality:${c.city}`)
      if (c.postal_code) parts.push(`postal_code:${c.postal_code}`)
      return parts.length ? parts.join('|') : undefined
    }

    const confidenceFor = (locationType: string | undefined) => {
      const map: Record<string, number> = {
        ROOFTOP: 1.0,
        RANGE_INTERPOLATED: 0.8,
        GEOMETRIC_CENTER: 0.6,
        APPROXIMATE: 0.4
      }
      return locationType ? (map[locationType] ?? 0.5) : 0
    }

    const getConfidenceDescription = (locationType: string | undefined) => {
      const descriptions: Record<string, string> = {
        ROOFTOP: "Most precise - exact address match",
        RANGE_INTERPOLATED: "High precision - interpolated within address range",
        GEOMETRIC_CENTER: "Medium precision - center of building/area",
        APPROXIMATE: "Low precision - approximate location"
      }
      return locationType ? descriptions[locationType] || "Unknown precision" : "No location type"
    }

    const geocode = async (address?: string, componentsStr?: string) => {
      if (!address || address.trim() === '' || address.trim() === 'N/A' || address.trim().length < 3) {
        console.log(`[GEOCODE] Skipping geocoding for invalid address: "${address}"`)
        return null
      }
      let url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`
      if (componentsStr) {
        url += `&components=${encodeURIComponent(componentsStr)}`
      }
      const r = await fetch(url)
      if (!r.ok) {
        return { status: 'ERROR', error: `HTTP ${r.status}` }
      }
      const data: any = await r.json()
      let best: any = null
      if (data.status === 'OK' && Array.isArray(data.results) && data.results.length > 0) {
        // Pick highest confidence
        best = data.results.reduce((acc: any, cur: any) => {
          const score = confidenceFor(cur?.geometry?.location_type)
          if (!acc || score > acc.confidence_score) {
            const loc = cur.geometry.location
            return {
              latitude: loc.lat,
              longitude: loc.lng,
              formatted_address: cur.formatted_address,
              location_type: cur.geometry.location_type,
              confidence_score: score,
              confidence_description: getConfidenceDescription(cur.geometry.location_type)
            }
          }
          return acc
        }, null)
      }
      return { status: data.status, best, rawCount: data.results?.length || 0 }
    }

    const componentsStr = buildComponents(components)
    // Only geocode the cleaned address
    const clean = await geocode(cleanedAddress, componentsStr)

    // Since we only geocode cleaned addresses, use that result
    let chosen: 'cleaned' | 'original' | null = null
    if (clean?.best) {
      chosen = 'cleaned'
    } else {
      chosen = null
    }

    const lat = clean?.best?.latitude
    const lng = clean?.best?.longitude

    const staticMapPath = lat != null && lng != null
      ? `/api/staticmap?lat=${lat}&lng=${lng}&zoom=14&size=600x300`
      : null

    return res.json({
      original: null,
      cleaned: { ...(clean || {}), usedComponents: componentsStr },
      chosen,
      staticMapUrl: staticMapPath,
      confidence: clean?.best?.confidence_score || 0,
      confidenceDescription: clean?.best?.confidence_description || 'No geocoding result',
      locationType: clean?.best?.location_type || 'N/A'
    })
  } catch (error: any) {
    console.error('[GEOCODE_BOTH] Error:', error)
    return res.status(500).json({ error: 'Failed to geocode addresses' })
  }
}
