import { sanitizeValue } from './utils.js';

export function parseCsv(text) {
  const data = String(text ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const rows = [];
  let current = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < data.length; i++) {
    const char = data[i];
    if (char === '"') {
      const next = data[i + 1];
      if (inQuotes && next === '"') {
        field += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      current.push(field);
      field = '';
    } else if (char === '\n' && !inQuotes) {
      current.push(field);
      rows.push(current);
      current = [];
      field = '';
    } else {
      field += char;
    }
  }
  current.push(field);
  if (current.length > 1 || current[0] !== '' || rows.length === 0) {
    rows.push(current);
  }
  if (!rows.length) return { headers: [], records: [] };
  const headerRow = rows.shift();
  const headers = headerRow.map((h, index) => {
    const name = sanitizeValue(h);
    return name ? name : `col_${index}`;
  });
  const records = rows.map(rawRow => {
    const record = {};
    for (let i = 0; i < rawRow.length; i++) {
      const key = headers[i] ?? `col_${i}`;
      if (record[key] !== undefined) {
        record[key] = `${record[key]} ${sanitizeValue(rawRow[i])}`.trim();
      } else {
        record[key] = sanitizeValue(rawRow[i]);
      }
    }
    for (let j = rawRow.length; j < headers.length; j++) {
      const key = headers[j];
      if (record[key] === undefined) record[key] = '';
    }
    return record;
  });
  return { headers, records };
}

function formatCsvValue(value) {
  const str = value === null || value === undefined ? '' : String(value);
  if (/[",\n]/.test(str)) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

export function toCsv(rows, headers) {
  const outHeaders = headers.length ? headers : [];
  const lines = [];
  if (outHeaders.length) {
    lines.push(outHeaders.map(formatCsvValue).join(','));
  }
  for (const row of rows) {
    const line = outHeaders.map(header => formatCsvValue(row[header] ?? ''));
    lines.push(line.join(','));
  }
  return lines.join('\n') + '\n';
}
