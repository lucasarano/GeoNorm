export async function getZipCode(latitude, longitude) {
  try {
    const isAsuncion = latitude > -25.3 && latitude < -25.2 &&
      longitude > -57.6 && longitude < -57.5

    if (isAsuncion) {
      return {
        zipCode: '1000',
        department: 'Asunción',
        district: 'Asunción',
        neighborhood: 'Centro',
        confidence: 0.9
      }
    }

    return {
      zipCode: '0000',
      department: 'Unknown',
      district: 'Unknown',
      neighborhood: 'Unknown',
      confidence: 0.1
    }
  } catch (error) {
    console.error('[ZIPCODE] lookup failed', error)
    return null
  }
}

const zipCodeService = {
  getZipCode
}

export default zipCodeService
