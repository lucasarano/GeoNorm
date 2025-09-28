import {
  ACCENT_FIXES,
  ADDRESS_ABBREVIATION_MAP,
  ADDRESS_NOISE_PATTERNS,
  CITY_BY_DEPARTMENT,
  CITY_SYNONYMS,
  CITY_TO_DEPARTMENT,
  DEPARTAMENTOS,
  DEPARTMENT_SYNONYMS,
  EMAIL_REGEX,
  PHONE_TOKEN_REGEX,
  ROUTE_REGEX,
  TITLECASE_STOPWORDS
} from './constants.js';

function cloneRegex(regex) {
  return new RegExp(regex.source, regex.flags);
}

export function sanitizeValue(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.replace(/\uFEFF/g, '').trim();
  return String(value).trim();
}

export function normalizeWhitespace(value) {
  return sanitizeValue(value).replace(/[\s\u00A0]+/g, ' ').trim();
}

export function stripAccents(value) {
  return normalizeWhitespace(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function titleCaseEs(value) {
  const normalized = normalizeWhitespace(value);
  if (!normalized) return '';
  const parts = normalized.split(/(\s+)/);
  return parts
    .map(part => {
      if (/^\s+$/.test(part)) return part;
      const lower = part.toLowerCase();
      if (TITLECASE_STOPWORDS.has(lower)) return lower;
      if (ACCENT_FIXES[lower]) return ACCENT_FIXES[lower];
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join('');
}

function replaceIntersectionTokens(value) {
  return value
    .replace(/\b(c\/?|c\\|\/|esq\.?|esquina)\b/gi, ' y ')
    .replace(/\s*y\s*y\s*/gi, ' y ');
}

function normalizeRoutes(value) {
  return value
    .replace(ROUTE_REGEX, (_, num) => `Ruta ${parseInt(num, 10)}`)
    .replace(/\bkm\s*[:\-]?\s*(\d+)/gi, 'Km $1');
}

function applyAccentFixes(value) {
  return value.replace(/\w+/g, token => {
    const plain = stripAccents(token).toLowerCase();
    return ACCENT_FIXES[plain] || token;
  });
}

export function applyAddressAbbreviations(value) {
  const replaceWord = (match, word) => {
    const key = stripAccents(word).toLowerCase();
    return ADDRESS_ABBREVIATION_MAP[key] || match;
  };
  let output = value.replace(/\b([A-Za-zñÑáéíóúü]{2,5})\.(?=\s|,|$)/g, (match, word) => replaceWord(match, word));
  output = output.replace(/\b([A-Za-zñÑáéíóúü]{2,5})(?=\s|,|$)/g, (match, word) => replaceWord(match, word));
  return output.replace(/\bN[º°]\b/gi, 'N°');
}

export function removeEmails(value) {
  return value.replace(cloneRegex(EMAIL_REGEX), '').replace(/\s{2,}/g, ' ');
}

export function removePhones(value) {
  return value.replace(cloneRegex(PHONE_TOKEN_REGEX), '').replace(/\s{2,}/g, ' ');
}

export function removeNoise(value) {
  return ADDRESS_NOISE_PATTERNS.reduce(
    (acc, pattern) => acc.replace(pattern, ''),
    value
  );
}

export function normalizeAddress(value) {
  if (!value) return '';
  let work = normalizeWhitespace(value);
  work = removeEmails(work);
  work = removePhones(work);
  work = removeNoise(work);
  work = applyAddressAbbreviations(work);
  work = replaceIntersectionTokens(work);
  work = normalizeRoutes(work);
  work = work.replace(/\s*,\s*/g, ', ').replace(/\s+/g, ' ').trim();
  work = applyAccentFixes(work);
  work = titleCaseEs(work);
  return work.replace(/,\s*,/g, ',').replace(/,{2,}/g, ',').replace(/,\s*$/, '');
}

export function extractEmailsFromText(value) {
  if (!value) return [];
  const regex = cloneRegex(EMAIL_REGEX);
  const matches = [...value.matchAll(regex)].map(m => m[0].toLowerCase());
  return Array.from(new Set(matches));
}

function cleanPhoneCandidate(raw) {
  return sanitizeValue(raw)
    .replace(/(ext|x|int)\.?[:\-\s]*\d+$/i, '')
    .replace(/\(0\)/g, '')
    .replace(/[^+\d]/g, '');
}

export function normalizePhonePy(raw) {
  const cleaned = cleanPhoneCandidate(raw);
  if (!cleaned) return '';
  let work = cleaned;
  if (work.startsWith('+595')) {
    work = '+595' + work.slice(4);
  } else {
    work = work.replace(/^\+?595/, '');
    work = work.replace(/^0+/, '');
    if (!work) return '';
    work = '+595' + work;
  }
  return work;
}

export function isValidPhonePy(phone) {
  return /^\+595\d{7,9}$/.test(phone || '');
}

export function extractPhoneCandidates(value) {
  if (!value) return [];
  const matches = [];
  const tokens = value.split(/[\n;,\/]|\s{2,}/);
  for (const token of tokens) {
    const cleaned = cleanPhoneCandidate(token);
    if (cleaned && cleaned.length >= 7) {
      matches.push(cleaned);
    }
  }
  const regex = cloneRegex(PHONE_TOKEN_REGEX);
  for (const m of value.matchAll(regex)) {
    const cleaned = cleanPhoneCandidate(m[0]);
    if (cleaned && cleaned.length >= 7) {
      matches.push(cleaned);
    }
  }
  return Array.from(new Set(matches));
}

export function pickBestPhone(candidates) {
  if (!Array.isArray(candidates) || !candidates.length) return { raw: '', normalized: '', isValid: false };
  const unique = Array.from(new Set(candidates));
  const mobiles = unique.filter(c => /^(\+?595|0)?9\d{7,8}$/.test(c));
  const chosen = mobiles[0] || unique[0];
  const normalized = normalizePhonePy(chosen);
  return { raw: chosen, normalized, isValid: isValidPhonePy(normalized) };
}

export function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value || '');
}

function levenshtein(a, b) {
  const s = stripAccents(a || '').toLowerCase();
  const t = stripAccents(b || '').toLowerCase();
  const m = s.length;
  const n = t.length;
  if (!m) return n;
  if (!n) return m;
  const dp = new Array(n + 1);
  for (let j = 0; j <= n; j++) dp[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = dp[j];
      if (s[i - 1] === t[j - 1]) {
        dp[j] = prev;
      } else {
        dp[j] = Math.min(prev, dp[j - 1], dp[j]) + 1;
      }
      prev = temp;
    }
  }
  return dp[n];
}

export function fuzzyScore(a, b) {
  const maxLen = Math.max(stripAccents(a || '').length, stripAccents(b || '').length);
  if (!maxLen) return 0;
  const distance = levenshtein(a, b);
  return Math.round((1 - distance / maxLen) * 100);
}

export function fuzzyMatchDepartamento(value, threshold = 88) {
  const cleaned = stripAccents(value || '').toLowerCase();
  if (!cleaned) return { value: '', score: 0 };
  if (cleaned in DEPARTMENT_SYNONYMS) {
    const canonical = DEPARTMENT_SYNONYMS[cleaned];
    if (canonical) return { value: canonical, score: 100 };
    return { value: '', score: 0 };
  }
  let best = { value: '', score: 0 };
  for (const dept of DEPARTAMENTOS) {
    const score = fuzzyScore(cleaned, dept);
    if (score > best.score) {
      best = { value: dept, score };
    }
  }
  return best.score >= threshold ? best : { value: '', score: best.score };
}

export function fuzzyMatchCity(value, hintState = '', threshold = 88) {
  const cleaned = stripAccents(value || '').toLowerCase();
  if (!cleaned) return { city: '', department: '', score: 0 };
  if (cleaned in CITY_SYNONYMS) {
    const city = CITY_SYNONYMS[cleaned];
    return { city, department: CITY_TO_DEPARTMENT[city] || hintState || '', score: 100 };
  }
  const departments = hintState ? [hintState] : Object.keys(CITY_BY_DEPARTMENT);
  let best = { city: '', department: '', score: 0 };
  const tryMatch = (deptList) => {
    for (const dept of deptList) {
      const cities = CITY_BY_DEPARTMENT[dept] || [];
      for (const city of cities) {
        const score = fuzzyScore(cleaned, city);
        if (score > best.score) {
          best = { city, department: dept, score };
        }
      }
    }
  };
  tryMatch(departments);
  if (best.score < threshold) {
    tryMatch(Object.keys(CITY_BY_DEPARTMENT));
  }
  return best.score >= threshold ? best : { city: '', department: '', score: best.score };
}

export function consumeAddressTail(address) {
  let remainder = normalizeWhitespace(address);
  let state = '';
  let city = '';
  let stateScore = 0;
  let cityScore = 0;
  if (!remainder) {
    return { address: '', city, state, cityScore, stateScore };
  }
  const parts = remainder.split(',').map(part => part.trim()).filter(Boolean);
  if (parts.length) {
    const tail = parts[parts.length - 1];
    const match = fuzzyMatchDepartamento(tail);
    if (match.value) {
      state = match.value;
      stateScore = match.score;
      parts.pop();
    }
  }
  if (parts.length) {
    const tail = parts[parts.length - 1];
    const hint = state || '';
    const match = fuzzyMatchCity(tail, hint);
    if (match.city) {
      city = match.city;
      cityScore = match.score;
      if (!state) state = match.department;
      parts.pop();
    }
  }
  remainder = parts.join(', ').trim();
  return { address: remainder, city, state, cityScore, stateScore };
}

export function normalizeCityState(city, state) {
  const rawCity = normalizeWhitespace(city);
  const rawState = normalizeWhitespace(state);
  let stateMatch = fuzzyMatchDepartamento(rawState);
  let cityMatch = fuzzyMatchCity(rawCity, stateMatch.value);

  if (!cityMatch.city && rawCity) {
    cityMatch = fuzzyMatchCity(rawCity, stateMatch.value);
  }
  if (!stateMatch.value && cityMatch.city) {
    stateMatch = { value: CITY_TO_DEPARTMENT[cityMatch.city] || '', score: cityMatch.score };
  }
  let finalCity = cityMatch.city || '';
  let finalState = stateMatch.value || '';
  if (finalCity) finalCity = titleCaseEs(finalCity);
  if (finalState) finalState = titleCaseEs(finalState);
  return {
    city: finalCity,
    state: finalState,
    cityScore: cityMatch.score,
    stateScore: stateMatch.score
  };
}

export function hasEmail(value) {
  const regex = cloneRegex(EMAIL_REGEX);
  return regex.test(value || '');
}

export function hasPhone(value) {
  const regex = cloneRegex(PHONE_TOKEN_REGEX);
  return regex.test(value || '');
}

export function buildDedupeKey(address, city, state, phone, email) {
  const normalize = (v) => stripAccents(v || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return [address, city, state, phone, email].map(normalize).join('|');
}
