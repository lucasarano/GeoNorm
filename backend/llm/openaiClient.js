const RESPONSES_ENDPOINT = 'https://api.openai.com/v1/responses'
const DEBUG = process.env.DEBUG_LLM === '1'

function extractTextFromResponse(result) {
    if (!result) return null

    if (typeof result.output_text === 'string' && result.output_text.trim().length > 0) {
        return result.output_text
    }

    const arrayOutput = Array.isArray(result.output) ? result.output : null
    if (arrayOutput) {
        for (const item of arrayOutput) {
            if (item?.type === 'output_text' && typeof item.text === 'string') {
                if (item.text.trim().length > 0) {
                    return item.text
                }
            }
            if (item?.type === 'message' && Array.isArray(item.content)) {
                for (const subItem of item.content) {
                    if (subItem?.type === 'output_text' && typeof subItem.text === 'string' && subItem.text.trim().length > 0) {
                        return subItem.text
                    }
                }
            }
        }
    }

    const legacyChoice = result?.choices?.[0]?.message?.content
    if (typeof legacyChoice === 'string' && legacyChoice.trim().length > 0) {
        return legacyChoice
    }

    return null
}

function extractCsvFromText(content, expectedHeader) {
    if (!content) return null

    const fenced =
        content.match(/```(?:csv)?\s*([\s\S]*?)\s*```/i)?.[1] ??
        content.match(/```([\s\S]*?)```/i)?.[1] ??
        content

    let csv = fenced.replace(/^\uFEFF/, '')
        .replace(/\r\n/g, '\n')
        .trimEnd()

    if (!csv.endsWith('\n')) {
        csv += '\n'
    }

    return csv
}

function splitCsvLine(line) {
    const result = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
        const char = line[i]
        if (char === '"') {
            const next = line[i + 1]
            if (inQuotes && next === '"') {
                current += '"'
                i++
            } else {
                inQuotes = !inQuotes
            }
        } else if (char === ',' && !inQuotes) {
            result.push(current)
            current = ''
        } else {
            current += char
        }
    }
    result.push(current)
    return result
}

function quoteCsvField(value) {
    const str = value ?? ''
    if (/[",\n]/.test(str)) {
        return '"' + str.replace(/"/g, '""') + '"'
    }
    return str
}

function normalizeHeaderFields(fields) {
    return fields.map(field => (field || '').trim()).join(',')
}

function removeColumnByName(csv, columnName, targetHeader) {
    const lines = csv.trimEnd().split('\n')
    if (lines.length === 0) return csv
    const headerFields = splitCsvLine(lines[0])
    const columnIndex = headerFields.findIndex(field => field.trim() === columnName)
    if (columnIndex === -1) {
        return csv
    }

    const newHeaderFields = headerFields.slice(0, columnIndex).concat(headerFields.slice(columnIndex + 1))
    const newLines = [newHeaderFields.map(quoteCsvField).join(',')]

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i]
        if (!line) {
            newLines.push('')
            continue
        }
        const row = splitCsvLine(line)
        if (columnIndex < row.length) {
            row.splice(columnIndex, 1)
        }
        newLines.push(row.map(quoteCsvField).join(','))
    }

    let normalized = newLines.join('\n')
    if (!normalized.endsWith('\n')) {
        normalized += '\n'
    }

    if (targetHeader) {
        const normalizedHeader = normalizeHeaderFields(newHeaderFields)
        if (normalizedHeader !== targetHeader) {
            throw new Error(`Unexpected header after removing ${columnName}. Got "${normalizedHeader}", expected "${targetHeader}"`)
        }
    }

    return normalized
}

export async function callResponsesApi(apiKey, { systemPrompt, userPrompt, model = 'gpt-5-mini', maxOutputTokens = 8000, temperature, verbosity }) {
    if (!apiKey) {
        throw new Error('Missing OpenAI API key')
    }

    const payload = {
        model,
        input: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ],
        max_output_tokens: maxOutputTokens,
    }

    if (typeof temperature === 'number') {
        payload.temperature = temperature
    }

    if (verbosity) {
        payload.text = { verbosity }
    }

    if (payload.reasoning) {
        if (DEBUG) {
            console.log('[OPENAI][REQUEST] removing unexpected reasoning payload', payload.reasoning)
        }
        delete payload.reasoning
    }

    const requestBody = JSON.stringify(payload, (key, value) => {
        if (key === 'reasoning') {
            if (DEBUG) {
                console.log('[OPENAI][REQUEST] stripping reasoning payload via JSON replacer')
            }
            return undefined
        }
        return value
    })

    const response = await fetch(RESPONSES_ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
        },
        body: requestBody,
    })

    if (!response.ok) {
        const txt = await response.text().catch(() => '')
        throw new Error(`OpenAI API error: ${response.status} ${txt}`)
    }

    const result = await response.json()
    return {
        result,
        text: extractTextFromResponse(result)
    }
}

export function parseCsvFromResponse(text, expectedHeader) {
    const csv = extractCsvFromText(text, expectedHeader)
    if (!csv) {
        throw new Error('No CSV content returned from model')
    }

    const headerLine = csv.split('\n', 1)[0].trim()
    const expectedHeaders = Array.isArray(expectedHeader) ? expectedHeader : [expectedHeader]

    const headerFields = splitCsvLine(headerLine)
    const normalizedHeader = normalizeHeaderFields(headerFields)

    if (expectedHeaders.includes(normalizedHeader)) {
        return csv
    }

    if (headerFields.some(field => field.trim() === 'Original_Email')) {
        const targetHeader = expectedHeaders[0]
        const normalizedCsv = removeColumnByName(csv, 'Original_Email', targetHeader)
        const newHeaderLine = normalizedCsv.split('\n', 1)[0].trim()
        const newHeaderFields = splitCsvLine(newHeaderLine)
        const newNormalizedHeader = normalizeHeaderFields(newHeaderFields)
        if (expectedHeaders.includes(newNormalizedHeader)) {
            return normalizedCsv
        }
    }

    throw new Error(`Unexpected header. Got "${normalizedHeader}", expected "${expectedHeaders.join('" or "')}"`)
}
