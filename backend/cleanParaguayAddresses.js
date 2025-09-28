// cleanParaguayAddresses.js
// Minimal, deterministic caller + robust CSV extraction
import { buildPrompt } from './buildPrompt.js';

export async function cleanParaguayAddresses(apiKey, csvData) {
    const prompt = buildPrompt(csvData);

    console.log('\n=== OpenAI Request Details ===')
    console.log('[OPENAI][REQUEST] Prompt length:', prompt.length)
    console.log('[OPENAI][REQUEST] Full prompt:')
    console.log(prompt)
    console.log('=== End OpenAI Request ===\n')

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: 'gpt-5-mini',
            messages: [
                {
                    role: 'system',
                    content:
                        'You are a meticulous CSV transformer. You MUST: 1) output exactly one RFC-4180 CSV code block with header Original_Address,Original_City,Original_State,Original_Phone,Address,City,State,Phone,Email; 2) when an email is present in any field (especially Address), extract it to the Email column and remove it from Address; 3) keep Phone and Email separate; 4) leave fields blank if unknown; 5) never add commentary outside the CSV code block.'
                },
                { role: 'user', content: prompt }
            ],
            // Modern OpenAI responses use max_completion_tokens (max_tokens unsupported)
            max_completion_tokens: 15000,
            // temperature not supported on this model; use default
        }),
    });

    if (!response.ok) {
        const txt = await response.text().catch(() => '');
        throw new Error(`OpenAI API error: ${response.status} ${txt}`);
    }

    const result = await response.json();

    console.log('\n=== OpenAI Response Details ===')
    console.log('[OPENAI][RESPONSE] Full API response:')
    console.log(JSON.stringify(result, null, 2))
    console.log('=== End OpenAI Response ===\n')

    // Responses API returns text in result.output array
    let content = null;

    // Extract content from standard chat completions response
    if (result?.choices?.[0]?.message?.content) {
        content = result.choices[0].message.content;
    }

    console.log('[OPENAI][CONTENT] Extracted content length:', content?.length || 0);
    console.log('[OPENAI][CONTENT] Content preview:', content?.substring(0, 200) || 'No content found');

    if (!content) throw new Error('Empty response from OpenAI');

    // Extract CSV from a fenced block; be forgiving on whitespace/labels
    const fenced =
        content.match(/```(?:csv)?\s*([\s\S]*?)\s*```/i)?.[1] ??
        content.match(/```([\s\S]*?)```/i)?.[1] ??
        content;

    // Normalize and finalize
    let csv = fenced.replace(/^\uFEFF/, '') // strip BOM
        .replace(/\r\n/g, '\n') // normalize EOL
        .trimEnd() + '\n';      // ensure single final newline

    // Sanity checks
    const header = csv.split('\n', 1)[0].trim();
    const expectedHeader = 'Original_Address,Original_City,Original_State,Original_Phone,Address,City,State,Phone,Email';
    if (header !== expectedHeader) {
        throw new Error(`Unexpected header. Got "${header}", expected "${expectedHeader}"`);
    }

    // Optional: quick structural check for 10 columns on non-empty rows.
    // NOTE: This is a lightweight check; prefer a real CSV parser downstream.
    const lines = csv.split('\n').slice(1).filter(Boolean);
    const bad = lines.find(line => {
        // Rough check: count commas not inside quotes
        let commas = 0, inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') inQuotes = !inQuotes;
            else if (ch === ',' && !inQuotes) commas++;
        }
        return commas !== 9; // 10 columns => 9 commas
    });
    if (bad) {
        console.warn('Row with unexpected column structure detected:', bad);
    }

    return csv;
}
