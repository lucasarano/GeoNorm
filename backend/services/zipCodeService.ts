import shapefile from 'shapefile';
import * as turf from '@turf/turf';
import proj4 from 'proj4';
import path from 'path';

interface PostalZone {
  properties: {
    DPTO: string;
    DPTO_DESC: string;
    DISTRITO: string;
    DIST_DESC: string;
    AREA_1: string;
    BARLOC: string;
    BARLO_DESC: string;
    VIV_2014: number;
    DIV_POST: string;
    ZONA: string;
    COD_POST: string;
    OBS: string | null;
    cod_bar: string;
  };
  geometry: {
    type: 'Polygon';
    coordinates: number[][][];
  };
}

interface ZipCodeResult {
  zipCode: string | null;
  department: string | null;
  district: string | null;
  neighborhood: string | null;
  confidence: 'high' | 'medium' | 'low' | 'none';
}

class ZipCodeService {
  private postalZones: PostalZone[] = [];
  private isLoaded = false;
  private shapefilePath: string;
  private utmToWgs84: proj4.Converter;

  constructor() {
    this.shapefilePath = path.join(process.cwd(), 'backend', 'Pubilc', 'geocoding', 'ZONA_POSTAL_PARAGUAY.shp');
    
    // Define UTM Zone 21S projection (from the .prj file)
    const utm21S = '+proj=utm +zone=21 +south +datum=WGS84 +units=m +no_defs';
    const wgs84 = '+proj=longlat +datum=WGS84 +no_defs';
    this.utmToWgs84 = proj4(utm21S, wgs84);
  }

  /**
   * Transform UTM coordinates to WGS84
   */
  private transformCoordinates(coordinates: number[][][]): number[][][] {
    return coordinates.map(ring => 
      ring.map(point => {
        const [x, y] = point;
        const [lng, lat] = this.utmToWgs84.forward([x, y]);
        return [lng, lat];
      })
    );
  }

  /**
   * Load the postal zones shapefile into memory
   */
  async loadPostalZones(): Promise<void> {
    if (this.isLoaded) return;

    try {
      console.log('[ZIP_CODE_SERVICE] Loading postal zones shapefile...');
      const source = await shapefile.open(this.shapefilePath);
      
      this.postalZones = [];
      let result = await source.read();
      
      while (!result.done) {
        const feature = result.value as PostalZone;
        this.postalZones.push(feature);
        result = await source.read();
      }
      
      this.isLoaded = true;
      console.log(`[ZIP_CODE_SERVICE] Loaded ${this.postalZones.length} postal zones`);
    } catch (error) {
      console.error('[ZIP_CODE_SERVICE] Error loading postal zones:', error);
      throw new Error('Failed to load postal zones data');
    }
  }

  /**
   * Find the postal code for given coordinates
   */
  async getZipCode(latitude: number, longitude: number): Promise<ZipCodeResult> {
    if (!this.isLoaded) {
      await this.loadPostalZones();
    }

    if (!latitude || !longitude) {
      return {
        zipCode: null,
        department: null,
        district: null,
        neighborhood: null,
        confidence: 'none'
      };
    }

    try {
      // Create a point from the coordinates
      const point = turf.point([longitude, latitude]);
      
      // Check each postal zone to see if the point is inside
      for (const zone of this.postalZones) {
        try {
          // Validate polygon coordinates before creating turf polygon
          const coordinates = zone.geometry.coordinates;
          if (!coordinates || !Array.isArray(coordinates) || coordinates.length === 0) {
            continue;
          }

          // Check if the outer ring has at least 4 points
          const outerRing = coordinates[0];
          if (!outerRing || !Array.isArray(outerRing) || outerRing.length < 4) {
            continue;
          }

          // Transform UTM coordinates to WGS84
          const transformedCoordinates = this.transformCoordinates(coordinates);
          
          // Convert the polygon coordinates to GeoJSON format
          const polygon = turf.polygon(transformedCoordinates);
          
          // Check if the point is inside the polygon
          if (turf.booleanPointInPolygon(point, polygon)) {
            return {
              zipCode: zone.properties.COD_POST,
              department: zone.properties.DPTO_DESC,
              district: zone.properties.DIST_DESC,
              neighborhood: zone.properties.BARLO_DESC,
              confidence: 'high'
            };
          }
        } catch (polygonError) {
          // Skip invalid polygons silently
          continue;
        }
      }

      // If no exact match found, try to find the closest zone
      let closestZone: PostalZone | null = null;
      let minDistance = Infinity;

      for (const zone of this.postalZones) {
        try {
          // Validate polygon coordinates before creating turf polygon
          const coordinates = zone.geometry.coordinates;
          if (!coordinates || !Array.isArray(coordinates) || coordinates.length === 0) {
            continue;
          }

          // Check if the outer ring has at least 4 points
          const outerRing = coordinates[0];
          if (!outerRing || !Array.isArray(outerRing) || outerRing.length < 4) {
            continue;
          }

          // Transform UTM coordinates to WGS84
          const transformedCoordinates = this.transformCoordinates(coordinates);
          
          const polygon = turf.polygon(transformedCoordinates);
          const centroid = turf.centroid(polygon);
          const distance = turf.distance(point, centroid, { units: 'kilometers' });
          
          if (distance < minDistance) {
            minDistance = distance;
            closestZone = zone;
          }
        } catch (polygonError) {
          continue;
        }
      }

      if (closestZone && minDistance < 10) { // Within 10km
        return {
          zipCode: closestZone.properties.COD_POST,
          department: closestZone.properties.DPTO_DESC,
          district: closestZone.properties.DIST_DESC,
          neighborhood: closestZone.properties.BARLO_DESC,
          confidence: minDistance < 5 ? 'medium' : 'low'
        };
      }

      return {
        zipCode: null,
        department: null,
        district: null,
        neighborhood: null,
        confidence: 'none'
      };

    } catch (error) {
      console.error('[ZIP_CODE_SERVICE] Error finding zip code:', error);
      return {
        zipCode: null,
        department: null,
        district: null,
        neighborhood: null,
        confidence: 'none'
      };
    }
  }

  /**
   * Get zip codes for multiple coordinates
   */
  async getZipCodes(coordinates: Array<{ latitude: number; longitude: number }>): Promise<ZipCodeResult[]> {
    if (!this.isLoaded) {
      await this.loadPostalZones();
    }

    const results: ZipCodeResult[] = [];
    
    for (const coord of coordinates) {
      const result = await this.getZipCode(coord.latitude, coord.longitude);
      results.push(result);
    }

    return results;
  }

  /**
   * Get statistics about loaded postal zones
   */
  getStats(): { totalZones: number; departments: string[]; isLoaded: boolean } {
    const departments = [...new Set(this.postalZones.map(zone => zone.properties.DPTO_DESC))];
    return {
      totalZones: this.postalZones.length,
      departments,
      isLoaded: this.isLoaded
    };
  }
}

// Export a singleton instance
export const zipCodeService = new ZipCodeService();
export default zipCodeService;
