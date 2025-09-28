export interface ZipCodeResult {
  zipCode: string
  department: string
  district: string
  neighborhood: string
  confidence: number
}

export declare function getZipCode(latitude: number, longitude: number): Promise<ZipCodeResult | null>

declare const zipCodeService: {
  getZipCode: typeof getZipCode
}

export default zipCodeService
