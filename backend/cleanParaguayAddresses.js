import { parseCsv, toCsv } from './paraguay/csv.js';
import { deterministicStage } from './paraguay/deterministic.js';
import { needsLLM, runStageBLLM } from './paraguay/llm.js';
import { filterAndDedupeRows, toFinalCsvRows, validateRows } from './paraguay/validators.js';
import { normalizeWhitespace } from './paraguay/utils.js';

const OUTPUT_HEADERS = [
  'Original_Address',
  'Original_City',
  'Original_State',
  'Original_Phone',
  'Address',
  'City',
  'State',
  'Phone',
  'Email'
];

export async function cleanParaguayAddresses(apiKey, csvData) {
  if (!apiKey) throw new Error('OpenAI API key is required');
  const logger = createLogger();
  logger.log('INIT', 'Starting cleanParaguayAddresses pipeline');
  const { headers, records } = parseCsv(csvData);
  if (!headers.length) throw new Error('Input CSV must include a header row');
  logger.log('INIT', 'Parsed CSV headers', { headers });

  const stageAContexts = deterministicStage(records, headers, {
    logRow: logger.logRow
  });

  let llmUses = 0;
  for (const context of stageAContexts) {
    context.llmUsed = false;
    if (!needsLLM(context)) {
      logger.logRow(context.index, 'StageB', 'Skipping LLM - deterministic metrics satisfied', {
        metrics: context.metrics
      });
      continue;
    }
    logger.logRow(context.index, 'StageB', 'Invoking LLM fallback', {
      metrics: context.metrics,
      partialCleaned: context.cleaned
    });
    try {
      const llmResult = await runStageBLLM(apiKey, context);
      applyLlmPatch(context, llmResult);
      context.llmUsed = true;
      llmUses += 1;
      logger.logRow(context.index, 'StageB', 'LLM response applied', {
        llmResult
      });
    } catch (error) {
      console.error(`[STAGE-B] Row ${context.index} LLM fallback failed:`, error.message);
      logger.logRow(context.index, 'StageB', 'LLM invocation failed, proceeding with deterministic data', {
        error: error.message
      });
    }
  }

  const validated = await validateRows(apiKey, stageAContexts, {
    logRow: logger.logRow
  });
  const filtered = filterAndDedupeRows(validated, {
    logRow: logger.logRow
  });
  const csvRows = toFinalCsvRows(filtered);
  const csv = toCsv(csvRows, OUTPUT_HEADERS);

  logSummary({
    totalRows: stageAContexts.length,
    llmUses,
    filteredOut: stageAContexts.length - filtered.length
  });

  return csv;
}

function applyLlmPatch(context, llmResult) {
  const evidence = new Set(context.evidence || []);
  if (Array.isArray(llmResult.evidence_fields_used)) {
    for (const value of llmResult.evidence_fields_used) {
      evidence.add(String(value));
    }
  }

  const original = context.original;
  if (!original.address && llmResult.Original_Address) original.address = llmResult.Original_Address;
  if (!original.city && llmResult.Original_City) original.city = llmResult.Original_City;
  if (!original.state && llmResult.Original_State) original.state = llmResult.Original_State;
  if (!original.phone && llmResult.Original_Phone) original.phone = llmResult.Original_Phone;

  const cleaned = context.cleaned;
  cleaned.address = pickOverride(cleaned.address, llmResult.Address);
  cleaned.city = pickOverride(cleaned.city, llmResult.City);
  cleaned.state = pickOverride(cleaned.state, llmResult.State);
  cleaned.phone = pickOverride(cleaned.phone, llmResult.Phone);
  cleaned.email = pickOverride(cleaned.email, llmResult.Email ? llmResult.Email.toLowerCase() : llmResult.Email);

  context.cleaned = cleaned;
  context.original = original;
  context.evidence = Array.from(evidence);

  if (llmResult.Phone) {
    context.candidates = context.candidates || {};
    const existing = new Set(context.candidates.phones || []);
    existing.add(llmResult.Phone);
    context.candidates.phones = Array.from(existing);
  }
}

function pickOverride(primary, fallback) {
  const fallbackValue = normalizeWhitespace(fallback || '');
  if (fallbackValue) return fallbackValue;
  return normalizeWhitespace(primary || '');
}

function logSummary(stats) {
  console.log('[PIPELINE] Rows processed:', stats.totalRows);
  console.log('[PIPELINE] Stage B LLM calls:', stats.llmUses);
  console.log('[PIPELINE] Rows removed after filters/dedup:', stats.filteredOut);
}

function createLogger() {
  const rawFlag = process.env.GEONORM_DEBUG;
  const enabled = rawFlag ? !['false', '0', 'off', 'no'].includes(rawFlag.toLowerCase()) : true;

  const formatPayload = (payload) => {
    if (payload === undefined) return '';
    if (typeof payload === 'string') return payload;
    try {
      return JSON.stringify(payload, null, 2);
    } catch (error) {
      return String(payload);
    }
  };

  const log = (stage, message, payload) => {
    if (!enabled) return;
    const formatted = formatPayload(payload);
    if (formatted) {
      console.log(`[DEBUG][${stage}] ${message}\n${formatted}`);
    } else {
      console.log(`[DEBUG][${stage}] ${message}`);
    }
  };

  const logRow = (index, stage, message, payload) => {
    if (!enabled) return;
    const formatted = formatPayload(payload);
    if (formatted) {
      console.log(`[DEBUG][Row ${index}][${stage}] ${message}\n${formatted}`);
    } else {
      console.log(`[DEBUG][Row ${index}][${stage}] ${message}`);
    }
  };

  return { enabled, log, logRow };
}
