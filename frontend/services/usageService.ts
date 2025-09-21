import { doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../lib/firebase'

export interface UsageCheckResult {
    canProcess: boolean
    reason: string
    remainingTries?: number
    plan: string
    isFreeTrial: boolean
    isPaidUser: boolean
}

export class UsageService {
    static async checkUsage(userId: string): Promise<UsageCheckResult> {
        try {
            const response = await fetch('/api/check-usage', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ userId })
            })

            if (!response.ok) {
                throw new Error('Failed to check usage')
            }

            return await response.json()
        } catch (error) {
            console.error('Error checking usage:', error)
            return {
                canProcess: false,
                reason: 'Error checking usage limits',
                plan: 'free',
                isFreeTrial: true,
                isPaidUser: false
            }
        }
    }

    static async useFreeTrial(userId: string): Promise<{ success: boolean; remainingTries: number; message: string }> {
        try {
            const response = await fetch('/api/use-free-trial', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ userId })
            })

            if (!response.ok) {
                const error = await response.json()
                throw new Error(error.message || 'Failed to use free trial')
            }

            return await response.json()
        } catch (error) {
            console.error('Error using free trial:', error)
            return {
                success: false,
                remainingTries: 0,
                message: 'Error processing free trial usage'
            }
        }
    }

    static async upgradeUser(userId: string, plan: 'pro' | 'enterprise', subscriptionId?: string): Promise<{ success: boolean; message: string }> {
        try {
            const response = await fetch('/api/upgrade-user', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ userId, plan, subscriptionId })
            })

            if (!response.ok) {
                const error = await response.json()
                throw new Error(error.message || 'Failed to upgrade user')
            }

            return await response.json()
        } catch (error) {
            console.error('Error upgrading user:', error)
            return {
                success: false,
                message: 'Error upgrading user'
            }
        }
    }
}
