import { callResponsesApi, parseCsvFromResponse } from './llm/openaiClient.js'

const OUTPUT_HEADER = 'Original_Address,Original_City,Original_State,Original_Phone,Address,City,State,Phone,Email'

const SYSTEM_PROMPT = 'You are a senior Paraguayan address specialist. Detect and normalize delivery data while preserving original values.'

function buildUserPrompt(csv) {
    return [
        'CSV dataset:',
        csv.trim(),
        '',
        'Tasks:',
        '1. For every row, keep the original address, city, state/departamento, and phone exactly as written.',
        '2. Produce cleaned Address, City, State, Phone, Email optimized for last-mile deliveries in Paraguay.',
        '3. Preserve row order, output one result row per input row, and do not drop data.',
        '',
        'Cleaning guidelines:',
        '- Use the best address fragment from any column; remove phones/emails/noise but keep unit info.',
        '- Normalize Paraguayan abbreviations (Av.|Avda.→Avenida, Gral.→General, Pte.→Presidente, Tte.→Teniente, Mcal.→Mariscal, Cnel.→Coronel, Cap.→Capitán, Ing.→Ingeniero, Sta.|Sto.→Santa/Santo, N°|No→N°).',
        '- Convert intersections (c/, /, esq.) to "y"; standardize routes (Ruta 1 or Ruta PY-01 → Ruta 1, keep Km X).',
        '- Canonicalize Paraguayan city and department names with accents; apply common mappings (Central metro → Central, Ciudad del Este metro → Alto Paraná, Encarnación cluster → Itapúa, etc.).',
        '- Leave fields blank when uncertain; never invent departments.',
        '- Phones: choose the best Paraguayan number, remove extensions, format as +595 when possible.',
        '- Emails: extract from any field, lowercase, ensure valid pattern.',
        '',
        `Output: fenced csv with header ${OUTPUT_HEADER}. Use RFC-4180 quoting and end with a newline.`
    ].join('\n')
}

export async function cleanParaguayAddresses(apiKey, csvData) {
    if (!apiKey) {
        throw new Error('Missing OpenAI API key')
    }

    const preparedCsv = (csvData || '').trimEnd() + '\n'
    const prompt = buildUserPrompt(preparedCsv)
    const { text } = await callResponsesApi(apiKey, {
        systemPrompt: SYSTEM_PROMPT,
        userPrompt: prompt,
        model: 'gpt-5-mini',
        maxOutputTokens: 6000,
    })

    if (!text) {
        throw new Error('Empty response from address cleaner')
    }

    return parseCsvFromResponse(text, OUTPUT_HEADER)
}
