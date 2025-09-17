// buildPrompt.js
export function buildPrompt(csvData) {
   return `PROMPT — Paraguay Address Cleaner (flexible input, components-ready, CSV out)

You are a senior data engineer.

INPUT
- You receive a raw CSV. Headers and languages may vary (Spanish/English); columns may be named arbitrarily and can include unrelated data.
- Analyze each row independently and extract whatever fields are present that map to our target schema.
- Preserve original row order.

TASK
For every row, identify and extract: Address, City, State (Departamento), Phone, Email. First preserve originals, then normalize for Google Maps Geocoding in Paraguay.
Return a CSV with exactly these 10 columns, in this order:
Original_Address,Original_City,Original_State,Original_Phone,Address,City,State,Phone,Email,AI_Confidence

IMPORTANT FLEXIBILITY
- Detect Address-like content from ANY columns (e.g., "direccion", "address1", "calle", "ubicacion", free-text notes).
- Detect City from ANY columns (e.g., "city", "ciudad", "localidad", sometimes inside the address text).
- Detect State/Departamento from ANY columns (e.g., "state", "estado", "departamento", "region").
- Detect Phone from ANY columns; numbers can appear embedded in text.
- Detect Email from ANY columns; if found in Address text, extract to Email and remove from Address.
- If multiple candidates exist, choose the best one. If unsure, leave the field blank.

FORMAT
- Output one fenced code block labeled csv.
- RFC-4180 CSV, UTF-8. Quote fields that contain commas, quotes, or line breaks; escape quotes by doubling them.
- Do not print explanations or anything outside the code block.

COMPONENTS GOAL
Make City and State canonical so we can later build:
components={"country":"PY","locality":<City>,"administrative_area":<State>}
(Omit empty values. Do not print components.)

RULES

A) Original Fields (preserve as-is)
1. Original_Address: Extract the best address-like text exactly as found, no cleaning or normalization.
2. Original_City: Extract city exactly as found in the data.
3. Original_State: Extract state/departamento exactly as found in the data.
4. Original_Phone: Extract phone exactly as found in the data.

B) Cleaned Address (single line, geocoder-friendly)
1. Build from the best address-like text across columns; remove phone fragments, emails, and obvious noise (XXX, 0000, $address.address2, undefined, "Correo Paraguayo … Contacto …").
2. Abbreviations → canonical (accent-aware):
   Av.|Avda.→Avenida; Gral.→General; Pte.→Presidente; Tte.→Teniente; Mcal.→Mariscal; Cnel.→Coronel; Cap.→Capitán; Ing.→Ingeniero; Sta.→Santa; Sto.→Santo; N°|No→N°.
3. Intersections: \`c/\`, \`/\`, \`esq.\`, or \`esquina\` between two street names → \` y \` (e.g., "Benjamín Constant c/ Colón" → "Benjamín Constant y Colón"). Keep "entre X y Y" and "casi".
4. Kilometers / routes: normalize to \`Ruta <name or PY-XX>, Km <number>\` where applicable (e.g., "Ruta 1, Km 20"). Normalize "Ruta PY-NN" ↔ "Ruta NN" as "Ruta NN".
5. Units/subpremises remain in Address, comma-separated: Piso, Dpto|Depto|Departamento, Oficina, Edificio, Condominio, blocks/codes like S3-C2.
6. Title Case with accents; keep short Spanish stopwords lowercase (de, del, la, los, las, y). Fix common PY names:
   Asuncion→Asunción, Itapua→Itapúa, Guaira→Guairá, Caaguazu→Caaguazú, Alto Parana→Alto Paraná, Capiata→Capiatá, Encarnacion→Encarnación, Nemby→Ñemby, Ypane→Ypané, Colon→Colón, yatch→Yacht.
7. Clean repeated words, excess spaces, and trailing city/state duplicates in Address.
8. Use commas only (no decorative symbols like "·").

C) Cleaned City & State (dictionary + fuzzy)
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
4. If City is missing but appears in Address or other columns, extract it. If City/State are swapped, swap.
5. Title Case with accents (same stopword rule).

D) Cleaned Phone & Email
1. Email: extract from any field, lowercase, basic validation; put in Email column and remove from Address.
   - Look for patterns like: user@domain.com, user@domain.co, user@domain.org, user@domain.net, etc.
   - CRITICAL: If you find an email in the Address field, extract it to the Email column and remove it from Address.
   - If no email found, leave Email column empty (blank).
2. Phone:
   - Split on \`/\`, commas, spaces; remove duplicates.
   - Remove extensions: \`ext\`, \`x\`, \`int.\` and anything after.
   - Keep digits; keep leading \`+\`. For national numbers starting with 0, drop the 0 before applying \`+595\`.
   - If no country code and the number is Paraguayan, output in E.164 with \`+595\`.
   - Prefer mobile numbers (start with \`9\` and 9 digits total after the leading 9, e.g., 981xxxxxx). If multiple candidates, choose the first valid mobile; else the first valid.
   - If nothing valid, leave blank.

EXAMPLES (flexible inputs):
- Headers like "direccion", "ciudad", "departamento", "telefono" → map to Address, City, State, Phone.
- If an address appears only in a free-text column, use it.
- "juan@empresa.com, Avda. Eusebio Ayala 123" → Address: "Avenida Eusebio Ayala 123", Email: "juan@empresa.com".

E) Keep/Drop & Duplicates
1. Keep a row if it has Address OR (City and State) AND at least one of Phone or Email.
2. Drop exact/near duplicates using case-insensitive comparison of (Address, City, State) and normalized Phone/Email; keep the first occurrence.

F) AI Confidence Assessment
1. For each cleaned address, assess how likely Google Maps Geocoding API will successfully geocode it.
2. Consider factors: address completeness, street name clarity, city/state accuracy, Paraguay-specific formatting.
3. Output a percentage (0-100) representing confidence in successful geocoding.

OUTPUT
Return exactly one fenced code block labeled \`csv\` with:
Original_Address,Original_City,Original_State,Original_Phone,Address,City,State,Phone,Email,AI_Confidence
(one header row, then rows with both original and cleaned data).

CRITICAL FORMATTING REQUIREMENTS:
- Output RFC-4180 CSV, UTF-8. Quote fields that contain commas, quotes, or line breaks; escape quotes by doubling them.
- No blank lines; no trailing commas; end with a single newline.
- Use exactly 10 columns in this exact order: Original_Address,Original_City,Original_State,Original_Phone,Address,City,State,Phone,Email,AI_Confidence
- Preserve original row order for kept rows; do not create or drop rows except per Rule D.
- Phone numbers: output E.164 (+595...), drop national trunk "0" before applying +595.
- City/State: prefer City→Department authority mapping on conflicts; never invent departments; leave blank if below fuzzy threshold.
- Accents must be correct (á é í ó ú ü ñ). Do not replace with ASCII.
- If unsure about a field, leave it blank but maintain column structure.
- Email extraction: MUST extract emails from Address field and put them in Email column, then remove from Address.
- AI_Confidence: must be integer 0-100, no % symbol.
- No extra text, no API calls, no coordinates.

Here is the data to clean:

${csvData}`;
}
