import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  serverTimestamp
} from 'firebase/firestore'
import { db } from '../config/firebase.js'
import { v4 as uuidv4 } from 'uuid'

export interface User {
  id: string
  email: string
  name: string
  apiKey: string
  plan: 'free' | 'pro' | 'enterprise'
  createdAt: Date
  lastUsed?: Date
  requestsCount: number
  maxRequests: number
  // Free trial tracking
  freeTriesUsed: number
  freeTriesLimit: number
  hasUsedFreeTrial: boolean
  subscriptionStatus?: 'active' | 'inactive' | 'cancelled'
  subscriptionId?: string
}

class FirebaseUserService {
  private usersCollection = collection(db, 'users')

  async createUser(email: string, name: string, plan: 'free' | 'pro' | 'enterprise'): Promise<User> {
    const user: User = {
      id: uuidv4(),
      email,
      name,
      apiKey: this.generateApiKey(),
      plan,
      createdAt: new Date(),
      requestsCount: 0,
      maxRequests: this.getMaxRequests(plan),
      freeTriesUsed: 0,
      freeTriesLimit: 5,
      hasUsedFreeTrial: false
    }

    await addDoc(this.usersCollection, {
      ...user,
      createdAt: serverTimestamp()
    })

    return user
  }

  async getUserByApiKey(apiKey: string): Promise<User | null> {
    const q = query(this.usersCollection, where('apiKey', '==', apiKey))
    const querySnapshot = await getDocs(q)

    if (querySnapshot.empty) return null

    const doc = querySnapshot.docs[0]
    return { id: doc.id, ...doc.data() } as User
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const q = query(this.usersCollection, where('email', '==', email))
    const querySnapshot = await getDocs(q)

    if (querySnapshot.empty) return null

    const doc = querySnapshot.docs[0]
    return { id: doc.id, ...doc.data() } as User
  }

  async updateUserUsage(userId: string): Promise<void> {
    const userRef = doc(this.usersCollection, userId)
    await updateDoc(userRef, {
      requestsCount: { increment: 1 },
      lastUsed: serverTimestamp()
    })
  }

  // Check if user can process (free trial or paid)
  async canUserProcess(userId: string): Promise<{ canProcess: boolean; reason: string; remainingTries?: number; plan: string }> {
    const user = await this.getUserById(userId)
    if (!user) {
      return { canProcess: false, reason: 'User not found', plan: 'free' }
    }

    // Enterprise users always can process
    if (user.plan === 'enterprise') {
      return { canProcess: true, reason: 'Enterprise user with unlimited access', plan: user.plan }
    }

    // Pro users have unlimited access
    if (user.plan === 'pro') {
      return { canProcess: true, reason: 'Pro user with unlimited access', plan: user.plan }
    }

    // Free users have limited tries
    if (user.plan === 'free') {
      if (user.freeTriesUsed >= user.freeTriesLimit) {
        return {
          canProcess: false,
          reason: 'You have used all your free tries. Upgrade to Pro for unlimited access!',
          remainingTries: 0,
          plan: user.plan
        }
      }
      return {
        canProcess: true,
        reason: 'Free trial user with remaining tries',
        remainingTries: user.freeTriesLimit - user.freeTriesUsed,
        plan: user.plan
      }
    }

    return { canProcess: false, reason: 'Unknown plan type', plan: user.plan }
  }

  // Use a free trial
  async useFreeTrial(userId: string): Promise<{ success: boolean; remainingTries: number; message: string }> {
    const userRef = doc(this.usersCollection, userId)
    const userSnap = await getDoc(userRef)

    if (!userSnap.exists()) {
      return { success: false, remainingTries: 0, message: 'User not found' }
    }

    const userData = userSnap.data() as User

    // Check if user has already used all free tries
    if (userData.freeTriesUsed >= userData.freeTriesLimit) {
      return {
        success: false,
        remainingTries: 0,
        message: 'You have used all your free tries. Please upgrade to continue.'
      }
    }

    // Increment free tries used
    const newFreeTriesUsed = userData.freeTriesUsed + 1
    await updateDoc(userRef, {
      freeTriesUsed: newFreeTriesUsed,
      hasUsedFreeTrial: true,
      lastUsed: serverTimestamp()
    })

    const remainingTries = userData.freeTriesLimit - newFreeTriesUsed
    return {
      success: true,
      remainingTries,
      message: remainingTries > 0
        ? `Free trial used. ${remainingTries} tries remaining.`
        : 'This was your last free try. Upgrade to Pro for unlimited access!'
    }
  }

  // Upgrade user to paid plan
  async upgradeUser(userId: string, newPlan: 'pro' | 'enterprise', subscriptionId?: string): Promise<void> {
    const userRef = doc(this.usersCollection, userId)
    await updateDoc(userRef, {
      plan: newPlan,
      maxRequests: this.getMaxRequests(newPlan),
      subscriptionStatus: 'active',
      subscriptionId: subscriptionId || null,
      lastUsed: serverTimestamp()
    })
  }

  async getAllUsers(): Promise<User[]> {
    const querySnapshot = await getDocs(this.usersCollection)
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User))
  }

  async getUserById(userId: string): Promise<User | null> {
    const userRef = doc(this.usersCollection, userId)
    const userSnap = await getDoc(userRef)

    if (!userSnap.exists()) return null

    return { id: userSnap.id, ...userSnap.data() } as User
  }

  private generateApiKey(): string {
    return `gn_${uuidv4().replace(/-/g, '')}`
  }

  private getMaxRequests(plan: string): number {
    const limits = {
      free: 5, // 5 free tries
      pro: -1, // Unlimited
      enterprise: -1 // Unlimited
    }
    return limits[plan] || 5
  }
}

export const userService = new FirebaseUserService()
