export function getConfidenceScore(locationType: string): number {
    const scores: Record<string, number> = {
        'ROOFTOP': 1.0,
        'RANGE_INTERPOLATED': 0.8,
        'GEOMETRIC_CENTER': 0.6,
        'APPROXIMATE': 0.4
    }
    return scores[locationType] || 0.5
}

export function getConfidenceDescription(locationType: string): string {
    const descriptions: Record<string, string> = {
        'ROOFTOP': "Most precise - exact address match",
        'RANGE_INTERPOLATED': "High precision - interpolated within address range",
        'GEOMETRIC_CENTER': "Medium precision - center of building/area",
        'APPROXIMATE': "Low precision - approximate location"
    }
    return descriptions[locationType] || "Unknown precision"
}

export function buildComponents(components?: any): string | undefined {
    if (!components) return undefined
    const parts: string[] = []
    if (components.country) parts.push(`country:${components.country}`)
    if (components.state) parts.push(`administrative_area:${components.state}`)
    if (components.city) parts.push(`locality:${components.city}`)
    if (components.postal_code) parts.push(`postal_code:${components.postal_code}`)
    return parts.length ? parts.join('|') : undefined
}
