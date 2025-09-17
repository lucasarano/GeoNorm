import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  getDocs
} from 'firebase/firestore'
import { db } from '../config/firebase.js'
import { serverTimestamp } from 'firebase/firestore'

// Check if Firebase is available
const isFirebaseAvailable = db !== null

export interface AddressRecord {
  id?: string
  userId: string
  originalAddress: string
  cleanedAddress: string
  city: string
  state: string
  phone: string
  email: string
  latitude?: number
  longitude?: number
  confidence?: number
  locationType?: string
  processedAt: Date
}

class FirebaseAddressService {
  private addressesCollection = collection(db, 'addresses')

  async saveAddressRecord(record: Omit<AddressRecord, 'id'>): Promise<string> {
    if (!isFirebaseAvailable) {
      console.log('⚠️  Firebase not available - skipping address save')
      return 'mock-id-' + Date.now()
    }

    const docRef = await addDoc(this.addressesCollection, {
      ...record,
      processedAt: serverTimestamp()
    })
    return docRef.id
  }

  async getUserAddresses(userId: string, limitCount: number = 100): Promise<AddressRecord[]> {
    if (!isFirebaseAvailable) {
      console.log('⚠️  Firebase not available - returning empty address list')
      return []
    }

    const q = query(
      this.addressesCollection,
      where('userId', '==', userId),
      orderBy('processedAt', 'desc'),
      limit(limitCount)
    )

    const querySnapshot = await getDocs(q)
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as AddressRecord))
  }

  async getAddressStats(userId: string): Promise<{
    total: number
    accurate: number
    medium: number
    guess: number
  }> {
    const addresses = await this.getUserAddresses(userId, 1000)

    return {
      total: addresses.length,
      accurate: addresses.filter(a => (a.confidence || 0) >= 0.8).length,
      medium: addresses.filter(a => (a.confidence || 0) >= 0.6 && (a.confidence || 0) < 0.8).length,
      guess: addresses.filter(a => (a.confidence || 0) < 0.6).length
    }
  }

  async saveBatchAddresses(records: Omit<AddressRecord, 'id'>[]): Promise<string[]> {
    const batch = records.map(record =>
      addDoc(this.addressesCollection, {
        ...record,
        processedAt: serverTimestamp()
      })
    )

    const results = await Promise.all(batch)
    return results.map(doc => doc.id)
  }
}

export const addressService = new FirebaseAddressService()
