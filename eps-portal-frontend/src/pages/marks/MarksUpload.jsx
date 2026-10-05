import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../api.js';
import { downloadCsv, parseCsv, toRecords } from '../../csv.js';
import { useFlash } from '../../flash.jsx';
import { useFetch } from '../../components/useFetch.js';
import { Field, Loading } from '../../components/ui.jsx';
import { KindTabs, useKind } from './shared.jsx';

export default function MarksUpload() {
  const flash = useFlash();
  const { data: cfg } = useFetch('/marks/config');
  const { kind, kc } = useKind(cfg);
  const [sp] = useSearchParams();
  const [grade, setGrade] = useState(sp.get('grade') || '');
  const [section, setSection] = useState(sp.get('section') || '');
  const [number, setNumber] = useState(Number(sp.get('number')) || 1);
  const [parsed, setParsed] = useState(null);   // { keys, records, fileName }
  const [maxBy, setMaxBy] = useState({});
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  if (!cfg) return <Loading />;
  if (!kc) return <div className="alert alert-error">Unknown assessment type.</div>;
  const g = cfg.gradeLocked ? cfg.grades[0] : grade || cfg.grades[0];
  // one column per strand for strand subjects (e.g. "english - reading"), one per subject otherwise ("science")
  const detected = parsed ? kc.columns.filter((c) => parsed.keys.includes(c.key)) : [];

  const onFile = async (e) => {
    const file = e.target.files[0];
    setResult(null);
    if (!file) return setParsed(null);
    if (!file.name.toLowerCase().endsWith('.csv')) { flash('Please choose a .csv file.', 'error'); return setParsed(null); }
    const { keys, records } = toRecords(parseCsv(await file.text()));
    if (!keys.includes('username')) { flash('The file needs a "username" column.', 'error'); return setParsed(null); }
    setParsed({ keys, records, fileName: file.name });
  };

  const template = async () => {
    try {
      const d = await api.get(`/marks/${kind}/entry?${new URLSearchParams({ grade: g, section, subject: kc.subjects[0], number })}`);
      downloadCsv(`${kind}_marks_template.csv`, [['username', ...kc.columns.map((c) => c.key)], ...d.students.map((s) => [s.username, ...kc.columns.map(() => '')])]);
    } catch (err) { flash(err.message, 'error'); }
  };

  const upload = async () => {
    setBusy(true);
    try {
      const r = await api.put(`/marks/${kind}/bulk`, {
        grade: g, section, number,
        maxMarks: Object.fromEntries(detected.map((c) => [c.key, Number(maxBy[c.key] || (c.strand ? 10 : 25))])),
        rows: parsed.records.map((rec) => ({ username: rec.username, marks: Object.fromEntries(detected.map((c) => [c.key, rec[c.key]])) })),
      });
      setResult(r);
      flash(`Imported ${r.saved} mark(s) across ${r.subjects.join(', ')}.`);
    } catch (err) { flash(err.message, 'error'); } finally { setBusy(false); }
  };

  return (
    <>
      <KindTabs kind={kind} isAdmin={cfg.isAdmin} />
      <div className="card" style={{ maxWidth: 760 }}>
        <div className="card-title">Upload {kind}{number} marks from CSV</div>
        <div className="form-row-3" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
          <Field label="Grade"><select className="form-input" value={g} disabled={cfg.gradeLocked} onChange={(e) => setGrade(e.target.value)}>{cfg.grades.map((x) => <option key={x}>{x}</option>)}</select></Field>
          <Field label="Section"><select className="form-input" value={section} onChange={(e) => setSection(e.target.value)}><option value="">All sections</option>{cfg.sections.map((x) => <option key={x}>{x}</option>)}</select></Field>
          <Field label={`${kind} number`}><select className="form-input" value={number} onChange={(e) => setNumber(Number(e.target.value))}>{kc.numbers.map((n) => <option key={n} value={n}>{kind}{n}</option>)}</select></Field>
        </div>
        <p className="sec-sub" style={{ margin: '4px 0 12px' }}>
          One row per student: <code>username</code> then one column per subject. English, Hindi, Urdu and Maths (in FA and SA) have one column per strand, for example <code>english - reading</code>. Click <strong>Download template</strong> to get every header. Leave a cell empty to skip it. Only students in the chosen grade{section ? ' and section' : ''} are matched.
        </p>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14 }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={template}>Download template</button>
          <input type="file" accept=".csv,text/csv" onChange={onFile} aria-label="CSV file" />
        </div>

        {parsed && (
          <>
            <div className="alert alert-success">{parsed.fileName}: {parsed.records.length} student row(s), columns found: {detected.length ? detected.map((c) => c.label).join(', ') : 'none'}.</div>
            {detected.length === 0
              ? <div className="alert alert-error">No mark columns recognised. Expected headers like: username,{kc.columns.slice(0, 3).map((c) => c.key).join(',')} … Download the template for the full list.</div>
              : (<>
                <div className="card-title" style={{ fontSize: '.85rem' }}>Maximum marks for each column (default {detected.some((c) => c.strand) ? '10 per strand, 25 per subject' : '25'})</div>
                <div className="form-row-3" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
                  {detected.map((c) => <Field key={c.key} label={c.label}><input className="form-input" type="number" min="1" step="any" placeholder={c.strand ? '10' : '25'} value={maxBy[c.key] ?? ''} onChange={(e) => setMaxBy({ ...maxBy, [c.key]: e.target.value })} /></Field>)}
                </div>
                <button className="btn btn-primary" disabled={busy} onClick={upload}>{busy ? 'Importing…' : `Import ${parsed.records.length} rows`}</button>
              </>)}
          </>
        )}

        {result && (
          <div style={{ marginTop: 14 }}>
            <div className="alert alert-success">Saved {result.saved} mark(s); skipped {result.skipped} outside 0–max.</div>
            {result.unknownUsers.length > 0 && <div className="alert alert-error">Usernames not found in {g}{section ? ` ${section}` : ''}: {result.unknownUsers.slice(0, 20).join(', ')}{result.unknownUsers.length > 20 ? '…' : ''}</div>}
          </div>
        )}
      </div>
    </>
  );
}
