import {
    collection,
    doc,
    addDoc,
    updateDoc,
    getDocs,
    getDoc,
    query,
    where,
    orderBy,
    serverTimestamp,
    Timestamp
} from 'firebase/firestore'
import { db } from '../lib/firebase'

// Data Types
export interface AddressRecord {
    id?: string
    userId: string
    csvId: string
    rowIndex: number

    // Original data
    originalAddress: string
    originalCity?: string
    originalState?: string
    originalPhone?: string

    // AI Cleaned data
    cleanedAddress: string
    cleanedCity: string
    cleanedState: string
    cleanedPhone?: string
    cleanedEmail?: string

    // Geocoding results
    coordinates?: {
        lat: number
        lng: number
    }
    geocodingConfidence: 'high' | 'medium' | 'low'
    locationType: string
    formattedAddress?: string

    // Zip code information
    zipCode?: {
        zipCode: string | null
        department: string | null
        district: string | null
        neighborhood: string | null
        confidence: 'high' | 'medium' | 'low' | 'none'
    }
    // Google Maps link (original AI coordinates)
    googleMapsLink?: string | null
    // User-updated coordinates (from SMS/email)
    userUpdatedCoordinates?: {
        lat: number
        lng: number
        accuracy?: number
        updatedAt: Date
    }
    // User-updated Google Maps link
    userUpdatedGoogleMapsLink?: string | null

    // Status tracking
    status: 'processed' | 'pending_confirmation' | 'confirmed' | 'rejected'
    needsConfirmation: boolean

    // Location link workflow
    locationLinkToken?: string
    locationLinkStatus?: 'pending' | 'sent' | 'submitted' | 'expired'
    locationLinkCreatedAt?: Timestamp
    locationLinkExpiresAt?: Timestamp
    lastLocationUpdate?: Timestamp

    // Timestamps
    processedAt: Timestamp
    updatedAt: Timestamp
}

export interface CSVDataset {
    id?: string
    userId: string
    fileName: string
    totalRows: number
    processedRows: number

    // Processing stats
    highConfidenceAddresses: number
    mediumConfidenceAddresses: number
    lowConfidenceAddresses: number
    pendingConfirmations: number

    // Status
    processingStatus: 'uploading' | 'extracting' | 'cleaning' | 'geocoding' | 'completed' | 'failed'

    // Timestamps
    uploadedAt: Timestamp
    completedAt?: Timestamp
}

export class DataService {
    // CSV Dataset Management
    static async createCSVDataset(userId: string, fileName: string, totalRows: number): Promise<string> {
        const csvData: Omit<CSVDataset, 'id'> = {
            userId,
            fileName,
            totalRows,
            processedRows: 0,
            highConfidenceAddresses: 0,
            mediumConfidenceAddresses: 0,
            lowConfidenceAddresses: 0,
            pendingConfirmations: 0,
            processingStatus: 'uploading',
            uploadedAt: serverTimestamp() as Timestamp
        }

        const docRef = await addDoc(collection(db, 'csv_datasets'), csvData)
        return docRef.id
    }

    static async updateCSVDataset(csvId: string, updates: Partial<CSVDataset>): Promise<void> {
        const csvRef = doc(db, 'csv_datasets', csvId)
        await updateDoc(csvRef, {
            ...updates,
            updatedAt: serverTimestamp()
        })
    }

    static async getUserCSVDatasets(userId: string): Promise<CSVDataset[]> {
        const q = query(
            collection(db, 'csv_datasets'),
            where('userId', '==', userId)
        )

        const querySnapshot = await getDocs(q)
        const datasets = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as CSVDataset))

        // Sort in memory instead of using orderBy to avoid index requirement
        return datasets.sort((a, b) => {
            const aTime = a.uploadedAt?.toDate?.()?.getTime() || 0
            const bTime = b.uploadedAt?.toDate?.()?.getTime() || 0
            return bTime - aTime // Descending order (newest first)
        })
    }

    // Address Record Management
    static async saveAddressRecord(addressData: Omit<AddressRecord, 'id'>): Promise<string> {
        const record: Omit<AddressRecord, 'id'> = {
            ...addressData,
            processedAt: serverTimestamp() as Timestamp,
            updatedAt: serverTimestamp() as Timestamp
        }

        const docRef = await addDoc(collection(db, 'address_records'), record)
        return docRef.id
    }

    static async bulkSaveAddressRecords(addressRecords: Omit<AddressRecord, 'id'>[]): Promise<string[]> {
        // Note: In a production app, you'd want to use batch writes for better performance
        const promises = addressRecords.map(record => this.saveAddressRecord(record))
        const ids = await Promise.all(promises)
        return ids
    }

    static async updateAddressStatus(
        addressId: string,
        status: AddressRecord['status'],
        additionalData?: Partial<AddressRecord>
    ): Promise<void> {
        const addressRef = doc(db, 'address_records', addressId)
        await updateDoc(addressRef, {
            status,
            ...additionalData,
            updatedAt: serverTimestamp()
        })
    }

    static async getAddressRecords(csvId: string): Promise<AddressRecord[]> {
        const q = query(
            collection(db, 'address_records'),
            where('csvId', '==', csvId)
        )

        const querySnapshot = await getDocs(q)
        const records = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as AddressRecord))

        // Sort in memory instead of using orderBy to avoid index requirement
        return records.sort((a, b) => a.rowIndex - b.rowIndex)
    }

    static async getUserAddressRecords(userId: string): Promise<AddressRecord[]> {
        const q = query(
            collection(db, 'address_records'),
            where('userId', '==', userId)
        )

        const querySnapshot = await getDocs(q)
        const records = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as AddressRecord))

        // Sort in memory instead of using orderBy to avoid index requirement
        return records.sort((a, b) => {
            const aTime = a.processedAt?.toDate?.()?.getTime() || 0
            const bTime = b.processedAt?.toDate?.()?.getTime() || 0
            return bTime - aTime // Descending order (newest first)
        })
    }

    static async getPendingConfirmationAddresses(userId: string): Promise<AddressRecord[]> {
        const q = query(
            collection(db, 'address_records'),
            where('userId', '==', userId),
            where('status', '==', 'pending_confirmation')
        )

        const querySnapshot = await getDocs(q)
        const records = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as AddressRecord))

        // Sort in memory instead of using orderBy to avoid index requirement
        return records.sort((a, b) => {
            const aTime = a.processedAt?.toDate?.()?.getTime() || 0
            const bTime = b.processedAt?.toDate?.()?.getTime() || 0
            return bTime - aTime // Descending order (newest first)
        })
    }

    // Analytics and Stats
    static async getUserProcessingStats(userId: string): Promise<{
        totalCSVs: number
        totalAddresses: number
        highConfidenceAddresses: number
        mediumConfidenceAddresses: number
        lowConfidenceAddresses: number
        pendingConfirmations: number
        confirmedAddresses: number
        rejectedAddresses: number
    }> {
        // Get CSV datasets
        const csvDatasets = await this.getUserCSVDatasets(userId)

        // Get address records
        const addressRecords = await this.getUserAddressRecords(userId)

        return {
            totalCSVs: csvDatasets.length,
            totalAddresses: addressRecords.length,
            highConfidenceAddresses: addressRecords.filter(r => r.geocodingConfidence === 'high').length,
            mediumConfidenceAddresses: addressRecords.filter(r => r.geocodingConfidence === 'medium').length,
            lowConfidenceAddresses: addressRecords.filter(r => r.geocodingConfidence === 'low').length,
            pendingConfirmations: addressRecords.filter(r => r.status === 'pending_confirmation').length,
            confirmedAddresses: addressRecords.filter(r => r.status === 'confirmed').length,
            rejectedAddresses: addressRecords.filter(r => r.status === 'rejected').length
        }
    }

    // Helper function to determine if address needs confirmation based on confidence
    static shouldRequestConfirmation(geocodingConfidence: string, locationType: string): boolean {
        // Request confirmation for low confidence addresses or approximate locations
        return geocodingConfidence === 'low' ||
            locationType === 'APPROXIMATE' ||
            locationType === 'GEOMETRIC_CENTER'
    }

    // Process geocoding results and determine status
    static processGeocodingResult(geocodingResult: any): {
        geocodingConfidence: 'high' | 'medium' | 'low'
        needsConfirmation: boolean
        status: 'processed' | 'pending_confirmation'
    } {
        const confidence = geocodingResult.confidence || 'medium'
        const locationType = geocodingResult.geometry?.location_type || 'APPROXIMATE'

        let geocodingConfidence: 'high' | 'medium' | 'low' = 'medium'

        // Determine confidence level based on Google's location type and other factors
        if (locationType === 'ROOFTOP') {
            geocodingConfidence = 'high'
        } else if (locationType === 'RANGE_INTERPOLATED') {
            geocodingConfidence = 'medium'
        } else {
            geocodingConfidence = 'low'
        }

        const needsConfirmation = this.shouldRequestConfirmation(geocodingConfidence, locationType)

        return {
            geocodingConfidence,
            needsConfirmation,
            status: needsConfirmation ? 'pending_confirmation' : 'processed'
        }
    }
}
