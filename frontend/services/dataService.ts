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

    // Status tracking
    status: 'processed' | 'pending_confirmation' | 'confirmed' | 'rejected'
    needsConfirmation: boolean

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
            where('userId', '==', userId),
            orderBy('uploadedAt', 'desc')
        )

        const querySnapshot = await getDocs(q)
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as CSVDataset))
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

    static async bulkSaveAddressRecords(addressRecords: Omit<AddressRecord, 'id'>[]): Promise<void> {
        // Note: In a production app, you'd want to use batch writes for better performance
        const promises = addressRecords.map(record => this.saveAddressRecord(record))
        await Promise.all(promises)
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
            where('csvId', '==', csvId),
            orderBy('rowIndex', 'asc')
        )

        const querySnapshot = await getDocs(q)
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as AddressRecord))
    }

    static async getUserAddressRecords(userId: string): Promise<AddressRecord[]> {
        const q = query(
            collection(db, 'address_records'),
            where('userId', '==', userId),
            orderBy('processedAt', 'desc')
        )

        const querySnapshot = await getDocs(q)
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as AddressRecord))
    }

    static async getPendingConfirmationAddresses(userId: string): Promise<AddressRecord[]> {
        const q = query(
            collection(db, 'address_records'),
            where('userId', '==', userId),
            where('status', '==', 'pending_confirmation'),
            orderBy('processedAt', 'desc')
        )

        const querySnapshot = await getDocs(q)
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as AddressRecord))
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
