export type ZipCodeConfidence = 'high' | 'medium' | 'low' | 'none'

export interface ZipCodeResult {
  zipCode: string | null
  department: string | null
  district: string | null
  neighborhood: string | null
  confidence: ZipCodeConfidence
}

export interface ZipCodeStats {
  totalZones: number
  departments: string[]
  isLoaded: boolean
}

export interface CoordinateInput {
  latitude: number
  longitude: number
}

export declare class ZipCodeService {
  constructor()
  loadPostalZones(): Promise<void>
  getZipCode(latitude: number, longitude: number): Promise<ZipCodeResult>
  getZipCodes(coordinates: CoordinateInput[]): Promise<ZipCodeResult[]>
  getStats(): ZipCodeStats
}

export declare const zipCodeService: ZipCodeService
export default zipCodeService
