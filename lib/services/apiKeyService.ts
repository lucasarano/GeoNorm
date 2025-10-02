import { db } from '../firebase.js'
import {
    collection,
    doc,
    setDoc,
    getDoc,
    query,
    where,
    getDocs,
    updateDoc,
    deleteDoc,
    serverTimestamp
} from 'firebase/firestore'
import { randomBytes, createHash } from 'crypto'

export interface ApiKey {
    id: string
    userId: string
    name: string
    keyHash: string
    keyPreview: string // First 8 chars for display
    tier: 'free' | 'pro' | 'enterprise'
    usageCount: number
    usageLimit: number
    isActive: boolean
    createdAt: any
    lastUsedAt: any | null
    expiresAt: any | null
}

export interface ApiKeyUsage {
    apiKeyId: string
    userId: string
    endpoint: string
    timestamp: any
    requestSize: number
    responseSize: number
    processingTime: number
    status: 'success' | 'error'
    errorMessage?: string
}

export class ApiKeyService {
    private readonly collection = 'apiKeys'
    private readonly usageCollection = 'apiKeyUsage'

    /**
     * Generate a new API key
     */
    generateApiKey(): { key: string; hash: string; preview: string } {
        const key = `gn_${randomBytes(32).toString('hex')}`
        const hash = createHash('sha256').update(key).digest('hex')
        const preview = key.substring(0, 12) + '...'

        return { key, hash, preview }
    }

    /**
     * Create a new API key for a user
     */
    async createApiKey(
        userId: string,
        name: string,
        tier: 'free' | 'pro' | 'enterprise' = 'free'
    ): Promise<{ apiKey: ApiKey; rawKey: string }> {
        const { key, hash, preview } = this.generateApiKey()

        // Set usage limits based on tier
        const usageLimits = {
            free: 100,
            pro: 10000,
            enterprise: 100000
        }

        const apiKeyData: Omit<ApiKey, 'id'> = {
            userId,
            name,
            keyHash: hash,
            keyPreview: preview,
            tier,
            usageCount: 0,
            usageLimit: usageLimits[tier],
            isActive: true,
            createdAt: serverTimestamp(),
            lastUsedAt: null,
            expiresAt: null // No expiration by default
        }

        const docRef = doc(collection(db, this.collection))
        await setDoc(docRef, apiKeyData)

        const apiKey: ApiKey = {
            id: docRef.id,
            ...apiKeyData,
            createdAt: new Date(),
            lastUsedAt: null,
            expiresAt: null
        }

        return { apiKey, rawKey: key }
    }

    /**
     * Validate an API key and return the associated data
     */
    async validateApiKey(rawKey: string): Promise<ApiKey | null> {
        try {
            const hash = createHash('sha256').update(rawKey).digest('hex')

            const q = query(
                collection(db, this.collection),
                where('keyHash', '==', hash),
                where('isActive', '==', true)
            )

            const snapshot = await getDocs(q)

            if (snapshot.empty) {
                return null
            }

            const doc = snapshot.docs[0]
            const apiKey = { id: doc.id, ...doc.data() } as ApiKey

            // Check if key is expired
            if (apiKey.expiresAt && apiKey.expiresAt.toDate() < new Date()) {
                return null
            }

            // Check usage limits
            if (apiKey.usageCount >= apiKey.usageLimit) {
                return null
            }

            return apiKey
        } catch (error) {
            console.error('Error validating API key:', error)
            return null
        }
    }

    /**
     * Record API key usage
     */
    async recordUsage(
        apiKeyId: string,
        userId: string,
        endpoint: string,
        requestSize: number,
        responseSize: number,
        processingTime: number,
        status: 'success' | 'error',
        errorMessage?: string
    ): Promise<void> {
        try {
            // Record usage in usage collection
            const usageData: Omit<ApiKeyUsage, 'id'> = {
                apiKeyId,
                userId,
                endpoint,
                timestamp: serverTimestamp(),
                requestSize,
                responseSize,
                processingTime,
                status,
                errorMessage
            }

            await setDoc(doc(collection(db, this.usageCollection)), usageData)

            // Update API key usage count and last used timestamp
            const apiKeyRef = doc(db, this.collection, apiKeyId)
            await updateDoc(apiKeyRef, {
                usageCount: (await getDoc(apiKeyRef)).data()?.usageCount + 1 || 1,
                lastUsedAt: serverTimestamp()
            })
        } catch (error) {
            console.error('Error recording API key usage:', error)
        }
    }

    /**
     * Get all API keys for a user
     */
    async getUserApiKeys(userId: string): Promise<ApiKey[]> {
        try {
            const q = query(
                collection(db, this.collection),
                where('userId', '==', userId)
            )

            const snapshot = await getDocs(q)

            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as ApiKey[]
        } catch (error) {
            console.error('Error getting user API keys:', error)
            return []
        }
    }

    async getApiKeyById(apiKeyId: string): Promise<ApiKey | null> {
        try {
            const apiKeyRef = doc(db, this.collection, apiKeyId)
            const snapshot = await getDoc(apiKeyRef)

            if (!snapshot.exists()) {
                return null
            }

            return {
                id: snapshot.id,
                ...snapshot.data()
            } as ApiKey
        } catch (error) {
            console.error('Error getting API key by id:', error)
            return null
        }
    }

    /**
     * Get API key usage statistics
     */
    async getUsageStats(apiKeyId: string, days: number = 30): Promise<{
        totalRequests: number
        successfulRequests: number
        errorRequests: number
        averageProcessingTime: number
        usageByDay: Array<{ date: string; count: number }>
    }> {
        try {
            const startDate = new Date()
            startDate.setDate(startDate.getDate() - days)

            const q = query(
                collection(db, this.usageCollection),
                where('apiKeyId', '==', apiKeyId),
                where('timestamp', '>=', startDate)
            )

            const snapshot = await getDocs(q)
            const usageData = snapshot.docs.map(doc => doc.data() as ApiKeyUsage)

            const totalRequests = usageData.length
            const successfulRequests = usageData.filter(u => u.status === 'success').length
            const errorRequests = usageData.filter(u => u.status === 'error').length
            const averageProcessingTime = usageData.reduce((sum, u) => sum + u.processingTime, 0) / totalRequests || 0

            // Group by day
            const usageByDay = new Map<string, number>()
            usageData.forEach(usage => {
                const date = usage.timestamp.toDate().toISOString().split('T')[0]
                usageByDay.set(date, (usageByDay.get(date) || 0) + 1)
            })

            return {
                totalRequests,
                successfulRequests,
                errorRequests,
                averageProcessingTime,
                usageByDay: Array.from(usageByDay.entries()).map(([date, count]) => ({ date, count }))
            }
        } catch (error) {
            console.error('Error getting usage stats:', error)
            return {
                totalRequests: 0,
                successfulRequests: 0,
                errorRequests: 0,
                averageProcessingTime: 0,
                usageByDay: []
            }
        }
    }

    /**
     * Deactivate an API key
     */
    async deactivateApiKey(apiKeyId: string): Promise<void> {
        try {
            const apiKeyRef = doc(db, this.collection, apiKeyId)
            await updateDoc(apiKeyRef, {
                isActive: false
            })
        } catch (error) {
            console.error('Error deactivating API key:', error)
            throw error
        }
    }

    /**
     * Delete an API key
     */
    async deleteApiKey(apiKeyId: string): Promise<void> {
        try {
            await deleteDoc(doc(db, this.collection, apiKeyId))
        } catch (error) {
            console.error('Error deleting API key:', error)
            throw error
        }
    }

    /**
     * Update API key tier
     */
    async updateApiKeyTier(apiKeyId: string, tier: 'free' | 'pro' | 'enterprise'): Promise<void> {
        try {
            const usageLimits = {
                free: 100,
                pro: 10000,
                enterprise: 100000
            }

            const apiKeyRef = doc(db, this.collection, apiKeyId)
            await updateDoc(apiKeyRef, {
                tier,
                usageLimit: usageLimits[tier]
            })
        } catch (error) {
            console.error('Error updating API key tier:', error)
            throw error
        }
    }
}

export const apiKeyService = new ApiKeyService()
