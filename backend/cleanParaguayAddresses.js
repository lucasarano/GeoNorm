// cleanParaguayAddresses.js
// Minimal, deterministic caller + robust CSV extraction
import { buildPrompt } from './buildPrompt.js';

export async function cleanParaguayAddresses(apiKey, csvData) {
    const prompt = buildPrompt(csvData);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: 'gpt-4o',
            messages: [
                {
                    role: 'system',
                    content:
                        'You are a meticulous CSV transformer. You MUST: 1) output exactly one RFC-4180 CSV code block with header Address,City,State,Phone,Email,AI_Confidence; 2) when an email is present in any field (especially Address), extract it to the Email column and remove it from Address; 3) keep Phone and Email separate; 4) leave fields blank if unknown; 5) never add commentary outside the CSV code block.'
                },
                { role: 'user', content: prompt }
            ],
            temperature: 0,
            top_p: 1,
            // Set a generous cap to avoid truncation on bigger batches
            max_tokens: 8000,
        }),
    });

    if (!response.ok) {
        const txt = await response.text().catch(() => '');
        throw new Error(`OpenAI API error: ${response.status} ${txt}`);
    }

    const result = await response.json();
    const content = result?.choices?.[0]?.message?.content;
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
    const expectedHeader = 'Original_Address,Original_City,Original_State,Original_Phone,Address,City,State,Phone,Email,AI_Confidence';
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
