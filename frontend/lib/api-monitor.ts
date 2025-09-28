export type ApiCallType = 'openai' | 'geocoding' | 'backend' | 'other'
export type ApiCallStatus = 'pending' | 'in-progress' | 'completed' | 'failed'

export interface ApiCallDetails {
    batchIndex?: number
    rowIndex?: number
    address?: string
    endpoint?: string
    method?: string
    request?: unknown
    response?: unknown
    error?: string | null
    metadata?: Record<string, unknown>
}

export interface ApiCallRecord {
    id: string
    type: ApiCallType
    timestamp: number
    status: ApiCallStatus
    duration?: number
    details: ApiCallDetails
}

export type ApiCallInput = Omit<ApiCallRecord, 'id' | 'timestamp'> & {
    id?: string
    timestamp?: number
}

const listeners = new Set<(calls: ApiCallRecord[]) => void>()
let calls: ApiCallRecord[] = []
let isFetchPatched = false

const MAX_CALLS = 250

function emitUpdates() {
    const snapshot = [...calls]
    listeners.forEach(listener => listener(snapshot))
}

function trimCalls() {
    if (calls.length > MAX_CALLS) {
        calls = calls.slice(-MAX_CALLS)
    }
}

function createId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID()
    }
    return Math.random().toString(36).slice(2)
}

export function subscribeToApiMonitor(listener: (calls: ApiCallRecord[]) => void): () => void {
    listeners.add(listener)
    listener([...calls])
    return () => {
        listeners.delete(listener)
    }
}

export function clearApiMonitor() {
    calls = []
    emitUpdates()
}

export function addApiCall(call: ApiCallInput): string {
    const record: ApiCallRecord = {
        id: call.id ?? createId(),
        timestamp: call.timestamp ?? Date.now(),
        status: call.status,
        type: call.type,
        duration: call.duration,
        details: call.details ?? {}
    }

    calls = [...calls, record]
    trimCalls()
    emitUpdates()
    return record.id
}

export function updateApiCall(
    id: string,
    updates: Partial<Omit<ApiCallRecord, 'id' | 'timestamp'>> & { details?: Partial<ApiCallDetails> }
) {
    calls = calls.map(call => {
        if (call.id !== id) return call
        return {
            ...call,
            ...updates,
            details: {
                ...call.details,
                ...(updates.details ?? {})
            }
        }
    })
    trimCalls()
    emitUpdates()
}

function classifyApiCall(url: string): ApiCallType {
    const normalized = url.toLowerCase()
    if (normalized.includes('process-complete') || normalized.includes('/api/process')) {
        return 'openai'
    }
    if (normalized.includes('geocode') || normalized.includes('staticmap') || normalized.includes('maps.googleapis')) {
        return 'geocoding'
    }
    if (normalized.includes('/api/')) {
        return 'backend'
    }
    return 'other'
}

function extractRequestBody(body: RequestInit['body']): unknown {
    if (!body) return undefined
    if (typeof body === 'string') {
        return body.length > 500 ? `${body.slice(0, 500)}…` : body
    }
    if (body instanceof URLSearchParams) {
        return body.toString()
    }
    if (body instanceof FormData) {
        const entries: Record<string, FormDataEntryValue> = {}
        for (const [key, value] of body.entries()) {
            entries[key] = value
        }
        return entries
    }
    return '[stream]'
}

export function enableFetchMonitoring() {
    if (isFetchPatched) return
    if (typeof window === 'undefined' || typeof window.fetch !== 'function') return

    const originalFetch = window.fetch.bind(window)

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const url = typeof input === 'string'
            ? input
            : input instanceof URL
                ? input.toString()
                : input instanceof Request
                    ? input.url
                    : String(input)

        const method = init?.method
            ?? (input instanceof Request ? input.method : 'GET')

        const requestBody = init?.body ?? (input instanceof Request ? input.body : undefined)
        const startedAt = Date.now()
        const callId = addApiCall({
            type: classifyApiCall(url),
            status: 'in-progress',
            duration: 0,
            details: {
                endpoint: url,
                method: method?.toUpperCase(),
                request: extractRequestBody(requestBody)
            }
        })

        try {
            const response = await originalFetch(input as RequestInfo, init)
            const duration = Date.now() - startedAt

            updateApiCall(callId, {
                status: response.ok ? 'completed' : 'failed',
                duration,
                details: {
                    response: {
                        status: response.status,
                        ok: response.ok
                    }
                }
            })

            return response
        } catch (error) {
            const duration = Date.now() - startedAt
            updateApiCall(callId, {
                status: 'failed',
                duration,
                details: {
                    error: error instanceof Error ? error.message : String(error)
                }
            })
            throw error
        }
    }

    isFetchPatched = true
}

export function logDerivedApiCalls(records: ApiCallInput[]) {
    if (!records?.length) return
    records.forEach(record => addApiCall(record))
}
