// Tiny CSV helpers (handles quoted fields and a UTF-8 BOM). Used for bulk marks upload and template download.
export function parseCsv(text) {
  const rows = []; let row = []; let field = ''; let quoted = false;
  const endRow = () => { row.push(field); field = ''; if (row.some((x) => x.trim() !== '')) rows.push(row); row = []; };
  const src = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') { if (src[i + 1] === '"') { field += '"'; i++; } else quoted = false; } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && src[i + 1] === '\n') i++; endRow(); }
    else field += c;
  }
  if (field !== '' || row.length) endRow();
  return rows;
}

// -> { keys: ['username','english',...], records: [{username:'a', english:'20'}, ...] }
export function toRecords(rows) {
  if (!rows.length) return { keys: [], records: [] };
  const keys = rows[0].map((h) => h.trim().toLowerCase());
  return { keys, records: rows.slice(1).map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? '').trim()]))) };
}

export function downloadCsv(filename, rows) {
  const esc = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const blob = new Blob([rows.map((r) => r.map(esc).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = filename; a.click();
  URL.revokeObjectURL(a.href);
}
