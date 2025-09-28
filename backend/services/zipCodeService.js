import shapefile from 'shapefile'
import * as turf from '@turf/turf'
import proj4 from 'proj4'
import path from 'path'

const confidenceLevels = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
  NONE: 'none'
}

class ZipCodeService {
  constructor() {
    this.postalZones = []
    this.isLoaded = false
    this.shapefilePath = path.join(process.cwd(), 'backend', 'Pubilc', 'geocoding', 'ZONA_POSTAL_PARAGUAY.shp')

    const utm21S = '+proj=utm +zone=21 +south +datum=WGS84 +units=m +no_defs'
    const wgs84 = '+proj=longlat +datum=WGS84 +no_defs'
    this.utmToWgs84 = proj4(utm21S, wgs84)
  }

  transformCoordinates(coordinates) {
    return coordinates.map(ring =>
      ring.map(point => {
        const [x, y] = point
        const [lng, lat] = this.utmToWgs84.forward([x, y])
        return [lng, lat]
      })
    )
  }

  async loadPostalZones() {
    if (this.isLoaded) return

    try {
      console.log('[ZIP_CODE_SERVICE] Loading postal zones shapefile...')
      const source = await shapefile.open(this.shapefilePath)

      this.postalZones = []
      let result = await source.read()

      while (!result.done) {
        const feature = result.value
        if (feature && feature.geometry && Array.isArray(feature.geometry.coordinates)) {
          this.postalZones.push(feature)
        }
        result = await source.read()
      }

      this.isLoaded = true
      console.log(`[ZIP_CODE_SERVICE] Loaded ${this.postalZones.length} postal zones`)
    } catch (error) {
      console.error('[ZIP_CODE_SERVICE] Error loading postal zones:', error)
      throw new Error('Failed to load postal zones data')
    }
  }

  async getZipCode(latitude, longitude) {
    if (!this.isLoaded) {
      await this.loadPostalZones()
    }

    if (!latitude || !longitude) {
      return this.buildEmptyResult(confidenceLevels.NONE)
    }

    try {
      const point = turf.point([longitude, latitude])

      for (const zone of this.postalZones) {
        const match = this.pointInZone(point, zone)
        if (match) {
          return {
            zipCode: zone.properties.COD_POST ?? null,
            department: zone.properties.DPTO_DESC ?? null,
            district: zone.properties.DIST_DESC ?? null,
            neighborhood: zone.properties.BARLO_DESC ?? null,
            confidence: confidenceLevels.HIGH
          }
        }
      }

      const fallback = this.closestZone(point)
      if (fallback.zone && fallback.distance < 10) {
        return {
          zipCode: fallback.zone.properties.COD_POST ?? null,
          department: fallback.zone.properties.DPTO_DESC ?? null,
          district: fallback.zone.properties.DIST_DESC ?? null,
          neighborhood: fallback.zone.properties.BARLO_DESC ?? null,
          confidence: fallback.distance < 5 ? confidenceLevels.MEDIUM : confidenceLevels.LOW
        }
      }

      return this.buildEmptyResult(confidenceLevels.NONE)
    } catch (error) {
      console.error('[ZIP_CODE_SERVICE] Error finding zip code:', error)
      return this.buildEmptyResult(confidenceLevels.NONE)
    }
  }

  async getZipCodes(coordinates) {
    if (!this.isLoaded) {
      await this.loadPostalZones()
    }

    const results = []
    for (const coord of coordinates) {
      const result = await this.getZipCode(coord.latitude, coord.longitude)
      results.push(result)
    }
    return results
  }

  getStats() {
    const departments = Array.from(new Set(this.postalZones.map(zone => zone.properties.DPTO_DESC)))
    return {
      totalZones: this.postalZones.length,
      departments,
      isLoaded: this.isLoaded
    }
  }

  buildEmptyResult(confidence) {
    return {
      zipCode: null,
      department: null,
      district: null,
      neighborhood: null,
      confidence
    }
  }

  pointInZone(point, zone) {
    try {
      const coordinates = zone.geometry.coordinates
      if (!coordinates || !Array.isArray(coordinates) || coordinates.length === 0) {
        return false
      }

      const outerRing = coordinates[0]
      if (!outerRing || !Array.isArray(outerRing) || outerRing.length < 4) {
        return false
      }

      const transformedCoordinates = this.transformCoordinates(coordinates)
      const polygon = turf.polygon(transformedCoordinates)
      return turf.booleanPointInPolygon(point, polygon)
    } catch (error) {
      return false
    }
  }

  closestZone(point) {
    let closestZone = null
    let minDistance = Infinity

    for (const zone of this.postalZones) {
      try {
        const coordinates = zone.geometry.coordinates
        if (!coordinates || !Array.isArray(coordinates) || coordinates.length === 0) {
          continue
        }
        const outerRing = coordinates[0]
        if (!outerRing || !Array.isArray(outerRing) || outerRing.length < 4) {
          continue
        }

        const transformedCoordinates = this.transformCoordinates(coordinates)
        const polygon = turf.polygon(transformedCoordinates)
        const centroid = turf.centroid(polygon)
        const distance = turf.distance(point, centroid, { units: 'kilometers' })

        if (distance < minDistance) {
          minDistance = distance
          closestZone = zone
        }
      } catch (error) {
        continue
      }
    }

    return { zone: closestZone, distance: minDistance }
  }
}

export const zipCodeService = new ZipCodeService()
export default zipCodeService
