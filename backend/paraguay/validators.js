import {
  buildDedupeKey,
  hasEmail,
  hasPhone,
  isEmail,
  isValidPhonePy,
  normalizeCityState,
  normalizeWhitespace
} from './utils.js';
import { repairPhone, repairCityState } from './llm.js';

export async function validateRow(apiKey, rowContext, logRow = () => {}) {
  logRow(rowContext.index, 'StageC', 'Validator start', {
    cleaned: rowContext.cleaned,
    metrics: rowContext.metrics
  });
  const evidence = new Set(rowContext.evidence || []);
  const cleaned = { ...rowContext.cleaned };

  if (cleaned.phone && !isValidPhonePy(cleaned.phone)) {
    const repaired = await repairPhone(apiKey, rowContext.candidates?.phones || [cleaned.phone]);
    if (repaired) {
      cleaned.phone = repaired;
      evidence.add('validator_phone_repair');
      logRow(rowContext.index, 'StageC', 'Phone normalized during validation', {
        repaired
      });
    } else {
      cleaned.phone = '';
      logRow(rowContext.index, 'StageC', 'Phone dropped - unable to repair');
    }
  }

  if (cleaned.email && !isEmail(cleaned.email)) {
    cleaned.email = '';
    evidence.add('validator_email_blank');
    logRow(rowContext.index, 'StageC', 'Email dropped - failed validation');
  }

  const normalizedLocation = normalizeCityState(cleaned.city, cleaned.state);
  cleaned.city = normalizedLocation.city;
  cleaned.state = normalizedLocation.state;
  if (normalizedLocation.city || normalizedLocation.state) {
    logRow(rowContext.index, 'StageC', 'Location normalized', normalizedLocation);
  }

  if ((!cleaned.city || !cleaned.state) && apiKey) {
    const fix = await repairCityState(apiKey, cleaned.address || '', cleaned.city || '', cleaned.state || '');
    if (fix.City || fix.State) {
      cleaned.city = fix.City || cleaned.city;
      cleaned.state = fix.State || cleaned.state;
      evidence.add('validator_city_state_repair');
      logRow(rowContext.index, 'StageC', 'City/State repaired via LLM', fix);
    }
  }

  const addressOk = Boolean(cleaned.address) && !hasEmail(cleaned.address) && !hasPhone(cleaned.address);
  const phoneOk = isValidPhonePy(cleaned.phone) || !cleaned.phone;
  const emailOk = !cleaned.email || isEmail(cleaned.email);

  rowContext.cleaned = cleaned;
  rowContext.metrics = {
    address_clean_done: addressOk,
    city_norm: Boolean(cleaned.city),
    state_norm: Boolean(cleaned.state),
    phone_valid: phoneOk,
    email_valid_or_absent: emailOk
  };
  rowContext.evidence = Array.from(evidence);
  logRow(rowContext.index, 'StageC', 'Validator result', {
    cleaned,
    metrics: rowContext.metrics,
    evidence: rowContext.evidence
  });
  return rowContext;
}

export async function validateRows(apiKey, rowContexts, options = {}) {
  const logRow = options.logRow || (() => {});
  const processed = [];
  for (const context of rowContexts) {
    processed.push(await validateRow(apiKey, context, logRow));
  }
  return processed;
}

function passesKeepRule(cleaned) {
  const hasAddress = Boolean(cleaned.address);
  const hasCityState = Boolean(cleaned.city) && Boolean(cleaned.state);
  const hasContact = Boolean(cleaned.phone) || Boolean(cleaned.email);
  return (hasAddress || hasCityState) && hasContact;
}

export function filterAndDedupeRows(rowContexts, options = {}) {
  const logRow = options.logRow || (() => {});
  const seen = new Set();
  const output = [];
  for (const context of rowContexts) {
    const cleaned = context.cleaned;
    if (!passesKeepRule(cleaned)) {
      logRow(context.index, 'StageC', 'Row dropped - keep rules failed', {
        cleaned
      });
      continue;
    }
    const key = buildDedupeKey(cleaned.address, cleaned.city, cleaned.state, cleaned.phone, cleaned.email);
    if (seen.has(key)) {
      logRow(context.index, 'StageC', 'Row dropped - duplicate detected', {
        dedupeKey: key
      });
      continue;
    }
    seen.add(key);
    output.push(context);
    logRow(context.index, 'StageC', 'Row accepted post-validation', {
      dedupeKey: key,
      cleaned
    });
  }
  return output;
}

export function toFinalCsvRows(rowContexts) {
  return rowContexts.map(context => ({
    Original_Address: normalizeWhitespace(context.original.address || ''),
    Original_City: normalizeWhitespace(context.original.city || ''),
    Original_State: normalizeWhitespace(context.original.state || ''),
    Original_Phone: normalizeWhitespace(context.original.phone || ''),
    Address: normalizeWhitespace(context.cleaned.address || ''),
    City: normalizeWhitespace(context.cleaned.city || ''),
    State: normalizeWhitespace(context.cleaned.state || ''),
    Phone: normalizeWhitespace(context.cleaned.phone || ''),
    Email: normalizeWhitespace(context.cleaned.email || '')
  }));
}
