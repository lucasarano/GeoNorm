import {
  CITY_BY_DEPARTMENT,
  DEPARTAMENTOS
} from './constants.js';
import {
  normalizeCityState,
  normalizeWhitespace,
  isValidPhonePy,
  normalizePhonePy,
  standardizeOrthographicAddress
} from './utils.js';

const SYSTEM_PROMPT = `You normalize Paraguayan addresses. Return strict JSON matching the schema. Do not invent departments. If uncertain, return an empty string for that field. Use the provided gazetteers and rules.`;

const JSON_SCHEMA = {
  name: 'paraguay_address_record',
  schema: {
    type: 'object',
    properties: {
      Original_Address: { type: 'string' },
      Original_City: { type: 'string' },
      Original_State: { type: 'string' },
      Original_Phone: { type: 'string' },
      Address: { type: 'string' },
      City: { type: 'string' },
      State: { type: 'string' },
      Phone: { type: 'string' },
      Email: { type: 'string' },
      evidence_fields_used: {
        type: 'array',
        items: { type: 'string' }
      }
    },
    required: [
      'Original_Address',
      'Original_City',
      'Original_State',
      'Original_Phone',
      'Address',
      'City',
      'State',
      'Phone',
      'Email',
      'evidence_fields_used'
    ],
    additionalProperties: false
  }
};

const RULES_TEXT = `1) Originals = verbatim text from the row, prefer dedicated columns. 2) Prefer dedicated City/State columns; otherwise consume address tail (Departamento then City) using fuzzy≥88. 3) Clean Address: remove phones/emails/noise; normalize abbreviations (Av.|Avda.→Avenida; Gral.→General; Pte.→Presidente; Tte.→Teniente; Mcal.→Mariscal; Cnel.→Coronel; Cap.→Capitán; Ing.→Ingeniero; Sta.→Santa; Sto.→Santo; N°|No→N°); intersections → «y»; routes → «Ruta NN, Km N»; keep units (Piso, Depto, Oficina, Edificio, Condominio, codes); title case with accents; commas only. Barrios remain in Address, not City/State. 4) City/State normalization: title case + accents; apply overrides (Asunción→Asunción; Central metro cities→Central; Ciudad del Este cluster→Alto Paraná; Encarnación cluster→Itapúa, etc.); junk like Paraguay/N/A/Other → blank; swap if obviously reversed. 5) Email: extract from any text, lowercase, remove from Address. 6) Phone: choose best, prefer mobile, strip ext, output E.164 +595. 7) Return JSON only.`;

const GAZETTEER_TEXT = buildGazetteerText();

const FEW_SHOT_EXAMPLES = [
  {
    user: buildFewShotUserMessage(
      {
        direccion: 'Av. Pte Franco 123, Ciudad del Este, Alto Parana',
        telefono: '0981 123 456',
        email: 'ventas@ejemplo.com'
      }
    ),
    assistant: JSON.stringify({
      Original_Address: 'Av. Pte Franco 123, Ciudad del Este, Alto Parana',
      Original_City: '',
      Original_State: '',
      Original_Phone: '0981 123 456',
      Address: 'Avenida Presidente Franco 123',
      City: 'Ciudad del Este',
      State: 'Alto Paraná',
      Phone: '+595981123456',
      Email: 'ventas@ejemplo.com',
      evidence_fields_used: [
        'address_column:direccion',
        'phone_column:telefono',
        'email_column:email',
        'address_tail_city',
        'address_tail_state'
      ]
    })
  },
  {
    user: buildFewShotUserMessage(
      {
        address: 'General Díaz y Colón, Barrio San Roque, Asuncion, Paraguay',
        notes: 'Tel: (021) 495-300 int. 12 | Contacto: info@hotel.com'
      }
    ),
    assistant: JSON.stringify({
      Original_Address: 'General Díaz y Colón, Barrio San Roque, Asuncion, Paraguay',
      Original_City: '',
      Original_State: '',
      Original_Phone: '(021) 495-300 int. 12',
      Address: 'General Díaz y Colón, Barrio San Roque',
      City: 'Asunción',
      State: 'Asunción',
      Phone: '+59521495300',
      Email: 'info@hotel.com',
      evidence_fields_used: [
        'address_column:address',
        'address_tail_city',
        'address_tail_state',
        'email_regex',
        'phone_regex'
      ]
    })
  }
];

function buildFewShotUserMessage(row) {
  const columns = Object.keys(row);
  const serializedRow = JSON.stringify(row);
  return `COLUMNS: ${JSON.stringify(columns)}\nROW: ${serializedRow}\nGAZETTEERS:\n${GAZETTEER_TEXT}\nRULES:\n${RULES_TEXT}`;
}

function buildGazetteerText() {
  const deptText = `DEPARTAMENTOS: ${JSON.stringify(DEPARTAMENTOS)}`;
  const cityEntries = Object.fromEntries(
    Object.entries(CITY_BY_DEPARTMENT).map(([dept, cities]) => [dept, cities])
  );
  const cityText = `CITIES: ${JSON.stringify(cityEntries)}`;
  return `${deptText}\n${cityText}`;
}

function buildUserContent(rowContext) {
  const columns = Object.keys(rowContext.raw);
  const rowJson = JSON.stringify(rowContext.raw);
  const pre = {
    cleanedAddress: rowContext.cleaned.address,
    cleanedCity: rowContext.cleaned.city,
    cleanedState: rowContext.cleaned.state,
    cleanedPhone: rowContext.cleaned.phone,
    cleanedEmail: rowContext.cleaned.email,
    evidence: rowContext.evidence
  };
  const preJson = JSON.stringify(pre);
  return [
    `COLUMNS: ${JSON.stringify(columns)}`,
    `ROW: ${rowJson}`,
    `PRE_PARSE: ${preJson}`,
    `GAZETTEERS:\n${GAZETTEER_TEXT}`,
    `RULES:\n${RULES_TEXT}`
  ].join('\n\n');
}

function buildMessages(rowContext) {
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'developer', content: JSON.stringify(JSON_SCHEMA.schema) }
  ];
  for (const example of FEW_SHOT_EXAMPLES) {
    messages.push({ role: 'user', content: example.user });
    messages.push({ role: 'assistant', content: example.assistant });
  }
  messages.push({ role: 'user', content: buildUserContent(rowContext) });
  return messages;
}

async function callOpenAi(apiKey, payload) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`OpenAI error ${response.status}: ${errText}`);
  }
  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty OpenAI response');
  return content;
}

export function needsLLM(rowContext) {
  const { metrics } = rowContext;
  if (!metrics) return true;
  const haveCity = Boolean(metrics.city_norm);
  const haveState = Boolean(metrics.state_norm);
  const phoneOk = Boolean(metrics.phone_valid);
  const emailOk = Boolean(metrics.email_valid_or_absent);
  return !((haveCity && haveState) && phoneOk && emailOk && metrics.address_clean_done);
}

export async function runStageBLLM(apiKey, rowContext) {
  const messages = buildMessages(rowContext);
  const payload = {
    model: 'gpt-5-mini',
    top_p: 1,
    max_completion_tokens: 2000,
    response_format: {
      type: 'json_schema',
      json_schema: JSON_SCHEMA
    },
    messages
  };
  console.log(`[STAGE-B] Invoking LLM for row ${rowContext.index}`);
  const content = await callOpenAi(apiKey, payload);
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    console.error('[STAGE-B] Failed to parse JSON response', content);
    throw error;
  }
  return parsed;
}

export async function repairPhone(apiKey, candidates) {
  const uniqueCandidates = Array.from(new Set(candidates)).filter(Boolean);
  if (!uniqueCandidates.length) return '';
  const messages = [
    { role: 'system', content: 'You repair Paraguayan phone numbers. Return only the normalized E.164 number (+595…) or an empty string.' },
    { role: 'user', content: `Repair Phone to E.164 +595 using these candidates: ${JSON.stringify(uniqueCandidates)}. Return only the phone or "".` }
  ];
  const payload = {
    model: 'gpt-5-mini',
    top_p: 1,
    max_completion_tokens: 20,
    messages
  };
  const content = await callOpenAi(apiKey, payload);
  const normalized = normalizeWhitespace(content.replace(/`/g, ''));
  const phone = normalized.includes('+') ? normalized : normalizePhonePy(normalized);
  return isValidPhonePy(phone) ? phone : '';
}

export async function repairCityState(apiKey, address, city, state) {
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'developer', content: JSON.stringify({ City: { type: 'string' }, State: { type: 'string' } }) },
    {
      role: 'user',
      content: `Given Address="${address}", City="${city}", State="${state}", fix City/Departamento using these gazetteers (fuzzy≥88). Apply overrides (e.g., Asunción→Asunción; Central metro cities→Central). Return JSON with only City and State.\nGAZETTEERS:\n${GAZETTEER_TEXT}`
    }
  ];
  const payload = {
    model: 'gpt-5-mini',
    top_p: 1,
    max_completion_tokens: 200,
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'city_state_fix',
        schema: {
          type: 'object',
          properties: {
            City: { type: 'string' },
            State: { type: 'string' }
          },
          required: ['City', 'State'],
          additionalProperties: false
        }
      }
    },
    messages
  };
  const content = await callOpenAi(apiKey, payload);
  try {
    const parsed = JSON.parse(content);
    const normalized = normalizeCityState(parsed.City, parsed.State);
    return { City: normalized.city || '', State: normalized.state || '' };
  } catch (error) {
    console.error('[STAGE-C] City/State repair parse error', content);
    return { City: '', State: '' };
  }
}

export async function repairAddressOrthography(apiKey, address, city = '', state = '') {
  if (!address) return '';
  const messages = [
    {
      role: 'system',
      content: 'You standardize Paraguayan street addresses. Respond with JSON only. Keep units/subpremises, normalize abbreviations (Av.|Avda.→Avenida, etc.), use "y" for intersections, format routes as "Ruta NN, Km X" when applicable, and output title case with proper accents. Do not fabricate information.'
    },
    {
      role: 'user',
      content: `Address: ${address}\nCity: ${city}\nState: ${state}`
    }
  ];
  const payload = {
    model: 'gpt-5-mini',
    top_p: 1,
    max_completion_tokens: 200,
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'address_orthography',
        schema: {
          type: 'object',
          properties: {
            Address: { type: 'string' }
          },
          required: ['Address'],
          additionalProperties: false
        }
      }
    },
    messages
  };
  const content = await callOpenAi(apiKey, payload);
  try {
    const parsed = JSON.parse(content);
    return standardizeOrthographicAddress(parsed.Address || '');
  } catch (error) {
    console.error('[STAGE-D] Address orthography repair parse error', content);
    return '';
  }
}
