import {
  consumeAddressTail,
  extractEmailsFromText,
  extractPhoneCandidates,
  hasEmail,
  hasPhone,
  isEmail,
  normalizeAddress,
  normalizeCityState,
  normalizeWhitespace,
  pickBestPhone,
  removeEmails,
  removeNoise,
  removePhones,
  sanitizeValue
} from './utils.js';

const HEADER_PATTERNS = {
  address: [/address/, /direccion/, /calle/, /ubicaci/, /domicilio/, /addr/, /street/, /ubicación/],
  city: [/city/, /ciudad/, /localidad/, /distrito/, /municipio/, /poblaci/, /pueblo/],
  state: [/state/, /estado/, /departament/, /provincia/, /region/, /región/, /depto/, /dpto/, /department/],
  phone: [/phone/, /telefono/, /tel\b/, /celular/, /mobile/, /whats/, /whatsapp/, /contacto/, /fax/],
  email: [/email/, /correo/, /mail/, /e-mail/]
};

const ADDRESS_KEYWORDS = [
  'calle',
  'avenida',
  'av',
  'ruta',
  'km',
  'kilometro',
  'kilómetro',
  'esquina',
  'esq',
  'barrio',
  'manzana',
  'casa',
  'lote',
  'villa',
  'condominio',
  'piso',
  'oficina',
  'departamento',
  'depto',
  'local',
  'galeria',
  'galería',
  'shopping',
  'centro',
  'km',
  'edificio',
  'planta',
  'zona'
];

function classifyHeaders(headers) {
  const groups = { address: [], city: [], state: [], phone: [], email: [] };
  for (const header of headers) {
    const value = header.toLowerCase();
    for (const [key, patterns] of Object.entries(HEADER_PATTERNS)) {
      if (patterns.some(pattern => pattern.test(value))) {
        groups[key].push(header);
      }
    }
  }
  return groups;
}

function looksLikeAddress(text) {
  const normalized = normalizeWhitespace(text);
  if (!normalized) return false;
  const lower = normalized.toLowerCase();
  if (ADDRESS_KEYWORDS.some(keyword => lower.includes(keyword))) return true;
  if (/\d/.test(lower) && lower.includes(' ')) return true;
  return false;
}

function selectFromHeaders(row, headers) {
  const parts = [];
  for (const header of headers) {
    const value = sanitizeValue(row[header]);
    if (value) {
      parts.push({ header, value });
    }
  }
  return parts;
}

function findFallback(row, ignoreHeaders = new Set()) {
  let best = { header: '', value: '' };
  for (const [header, rawValue] of Object.entries(row)) {
    if (ignoreHeaders.has(header)) continue;
    const value = sanitizeValue(rawValue);
    if (!value) continue;
    if (looksLikeAddress(value) && value.length > best.value.length) {
      best = { header, value };
    }
  }
  return best;
}

function gatherEmails(row, emailHeaders) {
  const values = [];
  for (const { header, value } of selectFromHeaders(row, emailHeaders)) {
    values.push({ value: value.toLowerCase(), source: `email_column:${header}` });
  }
  const flattened = Object.values(row)
    .map(v => sanitizeValue(v))
    .filter(Boolean)
    .join(' \n ');
  const extracted = extractEmailsFromText(flattened).map(email => ({ value: email, source: 'email_regex' }));
  const seen = new Set();
  const emails = [];
  for (const item of [...values, ...extracted]) {
    if (!seen.has(item.value)) {
      emails.push(item);
      seen.add(item.value);
    }
  }
  return emails;
}

function gatherPhones(row, phoneHeaders) {
  const valueSources = [];
  for (const { header, value } of selectFromHeaders(row, phoneHeaders)) {
    const candidates = extractPhoneCandidates(value).map(v => ({ raw: v, source: `phone_column:${header}` }));
    valueSources.push(...candidates);
  }
  const flattened = Object.entries(row)
    .map(([header, value]) => ({ header, value: sanitizeValue(value) }))
    .filter(entry => entry.value)
    .map(entry => entry.value)
    .join(' \n ');
  const extracted = extractPhoneCandidates(flattened).map(raw => ({ raw, source: 'phone_regex' }));
  const seen = new Set();
  const phones = [];
  for (const item of [...valueSources, ...extracted]) {
    const key = item.raw;
    if (!seen.has(key)) {
      phones.push(item);
      seen.add(key);
    }
  }
  return phones;
}

function combineAddressParts(primary, additional) {
  const unique = [];
  const seen = new Set();
  for (const part of additional) {
    if (!part) continue;
    if (primary && part.header === primary.header && part.value === primary.value) continue;
    const key = `${part.header}:${part.value}`;
    if (!seen.has(key)) {
      unique.push(part);
      seen.add(key);
    }
  }
  return unique;
}

export function deterministicStage(records, headers, options = {}) {
  const groups = classifyHeaders(headers);
  const logRow = options.logRow || (() => {});
  return records.map((row, index) => processRow(row, index, groups, logRow));
}

function processRow(row, index, groups, logRow) {
  logRow(index, 'StageA', 'Row ingestion', { raw: row });
  const evidence = new Set();
  const candidates = { phones: [], emails: [], addressParts: [] };

  const addressParts = selectFromHeaders(row, groups.address);
  const primaryAddress = addressParts[0] || findFallback(row, new Set([...groups.city, ...groups.state]));
  if (primaryAddress.header) evidence.add(`address_column:${primaryAddress.header}`);
  const combinedAddresses = combineAddressParts(primaryAddress.header ? primaryAddress : null, addressParts.slice(1));
  combinedAddresses.forEach(part => evidence.add(`address_column:${part.header}`));
  const addressAggregate = [primaryAddress, ...combinedAddresses]
    .map(part => (part ? part.value : ''))
    .filter(Boolean)
    .join(', ');
  if (addressAggregate) candidates.addressParts = [addressAggregate];
  logRow(index, 'StageA', 'Address candidates', {
    primaryAddress,
    additionalAddresses: combinedAddresses,
    aggregatedAddress: addressAggregate
  });

  const emailEntries = gatherEmails(row, groups.email);
  emailEntries.forEach(entry => evidence.add(entry.source));
  const emailValue = emailEntries.length ? emailEntries[0].value : '';
  candidates.emails = emailEntries.map(entry => entry.value);
  logRow(index, 'StageA', 'Email candidates', { emailEntries: candidates.emails });

  const phoneEntries = gatherPhones(row, groups.phone);
  phoneEntries.forEach(entry => evidence.add(entry.source));
  candidates.phones = phoneEntries.map(entry => entry.raw);
  const bestPhone = pickBestPhone(candidates.phones);
  const phoneColumnValue = groups.phone.length ? sanitizeValue(row[groups.phone[0]]) : '';
  const originalPhone = phoneColumnValue || (phoneEntries.length ? phoneEntries[0].raw : bestPhone.raw);
  logRow(index, 'StageA', 'Phone candidates', {
    phoneEntries,
    chosenRaw: bestPhone.raw,
    normalized: bestPhone.normalized,
    fromColumn: phoneColumnValue
  });

  const cityEntry = selectFromHeaders(row, groups.city)[0];
  if (cityEntry && cityEntry.header) evidence.add(`city_column:${cityEntry.header}`);
  const stateEntry = selectFromHeaders(row, groups.state)[0];
  if (stateEntry && stateEntry.header) evidence.add(`state_column:${stateEntry.header}`);

  const originalAddress = sanitizeValue(primaryAddress.value || addressAggregate || '');
  const originalCity = sanitizeValue(cityEntry ? cityEntry.value : '');
  const originalState = sanitizeValue(stateEntry ? stateEntry.value : '');
  const originalPhoneClean = sanitizeValue(originalPhone || '');

  const addressForCleaning = normalizeWhitespace(addressAggregate || originalAddress);
  const strippedForTail = removeNoise(removePhones(removeEmails(addressForCleaning)));
  const { address: remainderAddress, city: tailCity, state: tailState } = consumeAddressTail(strippedForTail);
  if (tailCity) evidence.add('address_tail_city');
  if (tailState) evidence.add('address_tail_state');
  logRow(index, 'StageA', 'Consume tail results', {
    remainderAddress,
    tailCity,
    tailState
  });

  let cleanedAddress = normalizeAddress(remainderAddress);
  let email = emailValue;
  if (!email) {
    const allEmails = extractEmailsFromText(addressForCleaning);
    if (allEmails.length) {
      email = allEmails[0];
      evidence.add('address_email_extracted');
    }
  }
  if (cleanedAddress && email) {
    cleanedAddress = cleanedAddress.replace(email, '').trim();
  }

  const phoneNormalized = bestPhone.normalized;
  const phoneValid = bestPhone.isValid;
  const emailValidOrAbsent = !email || isEmail(email);

  const cityCandidate = originalCity || tailCity;
  const stateCandidate = originalState || tailState;
  const normalizedLocation = normalizeCityState(cityCandidate, stateCandidate);
  const city = normalizedLocation.city;
  const state = normalizedLocation.state;

  const addressCleanDone = Boolean(cleanedAddress) && !hasEmail(cleanedAddress) && !hasPhone(cleanedAddress);

  logRow(index, 'StageA', 'Deterministic output', {
    original: {
      address: originalAddress,
      city: originalCity,
      state: originalState,
      phone: originalPhoneClean
    },
    cleaned: {
      address: cleanedAddress,
      city,
      state,
      phone: phoneNormalized,
      email
    },
    metrics: {
      address_clean_done: addressCleanDone,
      city_norm: !!city,
      state_norm: !!state,
      phone_valid: phoneValid,
      email_valid_or_absent: emailValidOrAbsent
    },
    evidence: Array.from(evidence)
  });

  return {
    index,
    raw: row,
    original: {
      address: originalAddress,
      city: originalCity,
      state: originalState,
      phone: originalPhoneClean
    },
    cleaned: {
      address: cleanedAddress,
      city,
      state,
      phone: phoneNormalized,
      email
    },
    metrics: {
      address_clean_done: addressCleanDone,
      city_norm: !!city,
      state_norm: !!state,
      phone_valid: phoneValid,
      email_valid_or_absent: emailValidOrAbsent
    },
    candidates,
    evidence: Array.from(evidence)
  };
}
