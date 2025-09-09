// buildPrompt.js
export function buildPrompt(csvData) {
   return `PROMPT — Paraguay Address Cleaner (components-ready, CSV out)

You are a senior data engineer.

INPUT
- You receive raw CSV rows with header exactly: Address,City,State,Phone.
- Process only those four columns; ignore anything else.
- Preserve original row order.

TASK
Clean and normalize for Google Maps Geocoding. Return a CSV with exactly these 6 columns, in this order:
Address,City,State,Phone,Email,AI_Confidence

FORMAT
- Output one fenced code block labeled csv.
- RFC-4180 CSV, UTF-8. Quote fields that contain commas, quotes, or line breaks; escape quotes by doubling them.
- Do not print explanations or anything outside the code block.

COMPONENTS GOAL
Make City and State canonical so we can later build:
components={"country":"PY","locality":<City>,"administrative_area":<State>}
(Omit empty values. Do not print components.)

RULES

A) Address (single line, geocoder-friendly)
1. Start from Address only; remove emails, phone fragments, and obvious noise (XXX, 0000, $address.address2, undefined, "Correo Paraguayo … Contacto …").
2. Abbreviations → canonical (accent-aware):
   Av.|Avda.→Avenida; Gral.→General; Pte.→Presidente; Tte.→Teniente; Mcal.→Mariscal; Cnel.→Coronel; Cap.→Capitán; Ing.→Ingeniero; Sta.→Santa; Sto.→Santo; N°|No→N°.
3. Intersections: \`c/\`, \`/\`, \`esq.\`, or \`esquina\` between two street names → \` y \` (e.g., "Benjamín Constant c/ Colón" → "Benjamín Constant y Colón"). Keep "entre X y Y" and "casi".
4. Kilometers / routes: normalize to \`Ruta <name or PY-XX>, Km <number>\` where applicable (e.g., "Ruta 1, Km 20"). Normalize "Ruta PY-NN" ↔ "Ruta NN" as "Ruta NN".
5. Units/subpremises remain in Address, comma-separated: Piso, Dpto|Depto|Departamento, Oficina, Edificio, Condominio, blocks/codes like S3-C2.
6. Title Case with accents; keep short Spanish stopwords lowercase (de, del, la, los, las, y). Fix common PY names:
   Asuncion→Asunción, Itapua→Itapúa, Guaira→Guairá, Caaguazu→Caaguazú, Alto Parana→Alto Paraná, Capiata→Capiatá, Encarnacion→Encarnación, Nemby→Ñemby, Ypane→Ypané, Colon→Colón, yatch→Yacht.
7. Clean repeated words, excess spaces, and trailing city/state duplicates in Address.
8. Use commas only (no decorative symbols like "·").

B) City & State (dictionary + fuzzy)
1. Normalize City and State against canonical Paraguayan names (with accents). Use a dictionary + fuzzy match threshold ≥ 88. If uncertain, leave blank.
2. Authority mapping (set/override State when City implies it):
   - Asunción → State=Asunción.
   - Central metro (Lambaré, San Lorenzo, Capiatá, Luque, Villa Elisa, Ñemby, Itauguá, Limpio, Areguá, Mariano Roque Alonso, Guarambaré, San Antonio, Itá) → State=Central.
   - Encarnación/Obligado/Hohenau/Bella Vista/General Artigas → Itapúa.
   - Ciudad del Este/Hernandarias/Presidente Franco/Los Cedrales/Minga Guazú/Juan León Mallorquín → Alto Paraná.
   - Villarrica/Colonia Independencia → Guairá.
   - Pedro Juan Caballero → Amambay.
   - Caacupé/San Bernardino/Piribebuy/Eusebio Ayala → Cordillera.
   - Caaguazú/Coronel Oviedo → Caaguazú.
   - Filadelfia → Boquerón.
3. Junk/invalid State values → fix or blank:
   - Barrios (e.g., Ciudad Nueva, Mburicaó) → keep only in Address; set City/State per mapping.
   - Capital/Asuncion DC → City=State=Asunción.
   - Departamento Central → Central.
   - alto parana py / Paraguaiy → Alto Paraná.
   - "Paraguay" in State is invalid → ignore it.
   - "Other", "—", "N/A", "." → treat as blank.
4. If City is missing but appears in Address, extract it. If City/State are swapped, swap.
5. Title Case with accents (same stopword rule).

C) Phone & Email
1. Email: extract from any field, lowercase, basic validation; put in Email and remove from Address.
2. Phone:
   - Split on \`/\`, commas, spaces; remove duplicates.
   - Remove extensions: \`ext\`, \`x\`, \`int.\` and anything after.
   - Keep digits; keep leading \`+\`. For national numbers starting with 0, drop the 0 before applying \`+595\`.
   - If no country code and the number is Paraguayan, output in E.164 with \`+595\`.
   - Prefer mobile numbers (start with \`9\` and 9 digits total after the leading 9, e.g., 981xxxxxx). If multiple candidates, choose the first valid mobile; else the first valid.
   - If nothing valid, leave blank.

D) Keep/Drop & Duplicates
1. Keep a row if it has Address OR (City and State) AND at least one of Phone or Email.
2. Drop exact/near duplicates using case-insensitive comparison of (Address, City, State) and normalized Phone/Email; keep the first occurrence.

E) AI Confidence Assessment
1. For each cleaned address, assess how likely Google Maps Geocoding API will successfully geocode it.
2. Consider factors: address completeness, street name clarity, city/state accuracy, Paraguay-specific formatting.
3. Output a percentage (0-100) representing confidence in successful geocoding.
4. Guidelines:
   - 90-100%: Complete address with well-known street/city in major urban areas
   - 70-89%: Good address but may have minor ambiguities or be in smaller towns
   - 50-69%: Partial address or unclear components, moderate geocoding success expected
   - 20-49%: Incomplete or problematic address, low geocoding success expected
   - 0-19%: Very poor address data, geocoding likely to fail

OUTPUT
Return exactly one fenced code block labeled \`csv\` with:
Address,City,State,Phone,Email,AI_Confidence
(one header row, then cleaned rows).

CRITICAL FORMATTING REQUIREMENTS:
- Output RFC-4180 CSV, UTF-8. Quote fields that contain commas, quotes, or line breaks; escape quotes by doubling them.
- No blank lines; no trailing commas; end with a single newline.
- Use exactly 6 columns in this exact order: Address,City,State,Phone,Email,AI_Confidence
- Preserve original row order for kept rows; do not create or drop rows except per Rule D.
- Phone numbers: output E.164 (+595...), drop national trunk "0" before applying +595.
- City/State: prefer City→Department authority mapping on conflicts; never invent departments; leave blank if below fuzzy threshold.
- Accents must be correct (á é í ó ú ü ñ). Do not replace with ASCII.
- If unsure about a field, leave it blank but maintain column structure.
- AI_Confidence: must be integer 0-100, no % symbol.
- No extra text, no API calls, no coordinates.

Here is the data to clean:

${csvData}`;
}
