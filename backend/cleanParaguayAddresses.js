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
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
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
    const expectedHeader = 'Address,City,State,Phone,Email,AI_Confidence';
    if (header !== expectedHeader) {
        throw new Error(`Unexpected header. Got "${header}", expected "${expectedHeader}"`);
    }

    // Optional: quick structural check for 6 columns on non-empty rows.
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
        return commas !== 5; // 6 columns => 5 commas
    });
    if (bad) {
        console.warn('Row with unexpected column structure detected:', bad);
    }

    return csv;
}
