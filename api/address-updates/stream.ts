import { VercelRequest, VercelResponse } from '@vercel/node'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '../../backend/config/firebase.js'

type AddressRecord = {
  id: string
  rowIndex?: number
  coordinates?: { lat: number; lng: number } | null
  geocodingConfidence?: 'high' | 'medium' | 'low'
  locationLinkStatus?: string | null
  locationLinkToken?: string | null
  locationLinkExpiresAt?: { toDate?: () => Date } | null
  lastLocationUpdate?: { toDate?: () => Date } | null
  updatedAt?: { toDate?: () => Date } | null
  formattedAddress?: string
  cleanedAddress?: string
}

function toUpdatePayload(record: AddressRecord) {
  const confidenceScore = record.geocodingConfidence === 'high'
    ? 0.95
    : record.geocodingConfidence === 'medium'
      ? 0.7
      : 0.4

  return {
    addressId: record.id,
    rowIndex: record.rowIndex,
    coordinates: record.coordinates || null,
    status: record.geocodingConfidence === 'high'
      ? 'high_confidence'
      : record.geocodingConfidence === 'medium'
        ? 'medium_confidence'
        : 'low_confidence',
    locationLinkStatus: record.locationLinkStatus || null,
    locationLinkToken: record.locationLinkToken || null,
    locationLinkExpiresAt: record.locationLinkExpiresAt?.toDate?.()?.toISOString(),
    lastLocationUpdate: (record.lastLocationUpdate?.toDate?.() || record.updatedAt?.toDate?.())?.toISOString(),
    formattedAddress: record.formattedAddress || record.cleanedAddress || '',
    confidence: confidenceScore,
    confidenceDescription: record.locationLinkStatus === 'submitted'
      ? 'Ubicación confirmada por el cliente'
      : 'Actualización de dirección',
    locationType: 'USER_CONFIRMED'
  }
}

async function fetchUpdatesSince(userId: string, sinceMs: number) {
  if (!db) return [] as any[]
  const sinceTime = new Date(sinceMs)
  const addressCollection = collection(db, 'address_records')
  const qy = query(addressCollection, where('userId', '==', userId))
  const snapshot = await getDocs(qy)

  const updates = snapshot.docs
    .map(docSnap => ({ id: docSnap.id, ...(docSnap.data() as any) }))
    .filter((record: any) => {
      const lastUpdate: Date | undefined = record.lastLocationUpdate?.toDate?.() || record.updatedAt?.toDate?.()
      if (!lastUpdate) return false
      return lastUpdate.getTime() > sinceTime.getTime()
    })
    .map((record: any) => toUpdatePayload(record as AddressRecord))

  return updates
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const userId = (req.query.userId as string) || ''
  if (!userId) {
    res.status(400).json({ error: 'userId is required' })
    return
  }

  // SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  })

  // Initial message
  res.write(`data: ${JSON.stringify({ type: 'connected', message: 'SSE connected' })}\n\n`)

  let lastCheck = Date.now() - 60_000 // start with 1 minute ago
  let isClosed = false

  const poll = async () => {
    if (isClosed) return
    try {
      const updates = await fetchUpdatesSince(userId, lastCheck)
      lastCheck = Date.now()
      if (updates.length > 0) {
        res.write(`data: ${JSON.stringify({ type: 'updates', updates })}\n\n`)
      } else {
        // keep-alive ping
        res.write(`data: ${JSON.stringify({ type: 'ping' })}\n\n`)
      }
    } catch (err) {
      // On error, send an error event but keep the stream alive
      res.write(`data: ${JSON.stringify({ type: 'error', message: 'poll_failed' })}\n\n`)
    }
  }

  const interval = setInterval(poll, 10000) // poll every 10s
  // run an immediate poll on connect
  poll()

  req.on('close', () => {
    isClosed = true
    clearInterval(interval)
  })
}


