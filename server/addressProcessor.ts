export interface AddressRecord {
    id: string
    phoneNumber: string
    originalAddress: string
    cleanedAddress?: string
    latitude?: number
    longitude?: number
    confidence: number
    status: 'pending' | 'low_confidence' | 'confirmed' | 'resolved'
    whatsappMessageId?: string
    timestamp: Date
}

export interface LowConfidenceAddress extends AddressRecord {
    confidence: number // Will be < 0.6
    status: 'low_confidence'
}

export class AddressProcessor {
    private lowConfidenceThreshold = 0.6

    /**
     * Filter addresses that have confidence below the threshold
     */
    filterLowConfidenceAddresses(addresses: AddressRecord[]): LowConfidenceAddress[] {
        return addresses
            .filter(addr => addr.confidence < this.lowConfidenceThreshold)
            .map(addr => ({
                ...addr,
                status: 'low_confidence' as const
            }))
    }

    /**
     * Calculate confidence score based on geocoding results
     */
    calculateConfidence(locationType?: string, addressComponents?: any[]): number {
        const locationTypeScores: Record<string, number> = {
            'ROOFTOP': 1.0,
            'RANGE_INTERPOLATED': 0.8,
            'GEOMETRIC_CENTER': 0.6,
            'APPROXIMATE': 0.4
        }

        let baseScore = locationType ? (locationTypeScores[locationType] || 0.3) : 0.3

        // Boost confidence if we have detailed address components
        if (addressComponents && addressComponents.length > 3) {
            baseScore += 0.1
        }

        // Ensure score is between 0 and 1
        return Math.min(Math.max(baseScore, 0), 1)
    }

    /**
     * Process geocoding results and determine confidence
     */
    processGeocodingResult(originalAddress: string, geocodingResult: any): AddressRecord {
        const id = this.generateId()
        
        if (!geocodingResult || geocodingResult.status !== 'OK' || !geocodingResult.results?.length) {
            return {
                id,
                phoneNumber: '', // Will be set externally
                originalAddress,
                confidence: 0,
                status: 'low_confidence',
                timestamp: new Date()
            }
        }

        const result = geocodingResult.results[0]
        const location = result.geometry?.location
        const locationType = result.geometry?.location_type
        
        const confidence = this.calculateConfidence(locationType, result.address_components)
        
        return {
            id,
            phoneNumber: '', // Will be set externally
            originalAddress,
            cleanedAddress: result.formatted_address,
            latitude: location?.lat,
            longitude: location?.lng,
            confidence,
            status: confidence >= this.lowConfidenceThreshold ? 'confirmed' : 'low_confidence',
            timestamp: new Date()
        }
    }

    /**
     * Batch process multiple addresses
     */
    async batchProcessAddresses(
        addresses: { phoneNumber: string; address: string }[],
        geocodeFunction: (address: string) => Promise<any>
    ): Promise<AddressRecord[]> {
        const results: AddressRecord[] = []

        for (const { phoneNumber, address } of addresses) {
            try {
                console.log(`[PROCESSOR] Processing address for ${phoneNumber}: ${address}`)
                
                const geocodingResult = await geocodeFunction(address)
                const processedRecord = this.processGeocodingResult(address, geocodingResult)
                
                // Set phone number
                processedRecord.phoneNumber = phoneNumber
                
                results.push(processedRecord)
                
                console.log(`[PROCESSOR] Processed ${phoneNumber}: confidence ${processedRecord.confidence}`)
                
                // Small delay to respect rate limits
                await this.delay(100)
                
            } catch (error) {
                console.error(`[PROCESSOR] Error processing ${phoneNumber}:`, error)
                
                // Create error record
                results.push({
                    id: this.generateId(),
                    phoneNumber,
                    originalAddress: address,
                    confidence: 0,
                    status: 'low_confidence',
                    timestamp: new Date()
                })
            }
        }

        return results
    }

    /**
     * Get summary statistics
     */
    getProcessingSummary(addresses: AddressRecord[]): {
        total: number
        confirmed: number
        lowConfidence: number
        pending: number
        averageConfidence: number
    } {
        const total = addresses.length
        const confirmed = addresses.filter(a => a.status === 'confirmed').length
        const lowConfidence = addresses.filter(a => a.status === 'low_confidence').length
        const pending = addresses.filter(a => a.status === 'pending').length
        
        const averageConfidence = addresses.length > 0 
            ? addresses.reduce((sum, addr) => sum + addr.confidence, 0) / addresses.length 
            : 0

        return {
            total,
            confirmed,
            lowConfidence,
            pending,
            averageConfidence: Math.round(averageConfidence * 100) / 100
        }
    }

    private generateId(): string {
        return Date.now().toString(36) + Math.random().toString(36).substr(2)
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms))
    }
}

export default AddressProcessor
