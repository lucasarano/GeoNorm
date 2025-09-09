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
      maxRequests: this.getMaxRequests(plan)
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
      free: 100,
      pro: 1000,
      enterprise: 10000
    }
    return limits[plan] || 100
  }
}

export const userService = new FirebaseUserService()
