import { useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../api.js';
import { useFlash } from '../../flash.jsx';
import { useFetch } from '../../components/useFetch.js';
import { Badge, Empty, Loading } from '../../components/ui.jsx';
import { SECTIONS_BY_SUBJECT } from '../../constants.js';

const LETTERS = ['A', 'B', 'C', 'D'];
const MAX_IMG = 2 * 1024 * 1024; // same 2 MB cap as the Flask version
const NEW_SECTION = '__new__';

const toDataUrl = (file) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
const lab = { fontSize: '.8rem', fontWeight: 600, display: 'block', marginBottom: 4 };

export default function AdminQuestions() {
  const { testId } = useParams();
  const flash = useFlash();
  const formRef = useRef(null);
  const { data, loading, reload } = useFetch(`/admin/tests/${testId}/questions`);
  const [editing, setEditing] = useState(null); // question id being edited (null = adding a new one)
  const [form, setForm] = useState(null);
  const [newSection, setNewSection] = useState(false); // typing a section that is not in the list

  if (loading) return <Loading />;
  const { test, questions } = data;
  const listed = SECTIONS_BY_SUBJECT[test.subject] || ['General'];
  const blank = { section: listed[0], passage: '', question: '', options: ['', '', '', ''], answer: 0, image: null };
  const f = form || blank;
  const patch = (p) => setForm({ ...f, ...p });

  // The dropdown always includes the question's current section, even if it is not in the standard list
  // (older questions can have other names). Without this the browser cannot select the first option.
  const options = listed.includes(f.section) || !f.section || newSection ? listed : [f.section, ...listed];

  const startEdit = (q) => {
    setEditing(q.id); setForm({ ...q, options: [...q.options] }); setNewSection(false);
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const stopEdit = () => { setEditing(null); setForm(null); setNewSection(false); };

  const pickImage = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > MAX_IMG) { flash('Image too large — max 2MB.', 'error'); e.target.value = ''; return; }
    patch({ image: await toDataUrl(file) });
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!f.section.trim()) return flash('Choose or type a section.', 'error');
    try {
      if (editing) await api.put(`/admin/tests/${testId}/questions/${editing}`, f);
      else await api.post(`/admin/tests/${testId}/questions`, f);
      flash(editing ? 'Question updated.' : 'Question added.');
      // After adding, keep the same section selected so a run of questions in one section is quick to enter.
      if (editing) stopEdit(); else setForm({ ...blank, section: f.section });
      reload();
    } catch (err) { flash(err.message, 'error'); }
  };
  const recalculate = async () => {
    if (!window.confirm('Recalculate every student result for this test using the current answers?')) return;
    try { const r = await api.post(`/admin/tests/${testId}/recalculate`); flash(`Results recalculated (${r.updated}).`); }
    catch (err) { flash(err.message, 'error'); }
  };
  const remove = async (q) => {
    if (!window.confirm('Delete this question?')) return;
    try { await api.del(`/admin/tests/${testId}/questions/${q.id}`); flash('Question deleted.'); if (editing === q.id) stopEdit(); reload(); }
    catch (err) { flash(err.message, 'error'); }
  };

  return (
    <>
      <div className="sec-header">
        <div><div className="sec-title">{test.name}</div><div className="sec-sub">{test.subject} · {test.grade} · {questions.length} questions</div></div>
        <button type="button" className="btn btn-secondary btn-sm" title="Re-score every submission against the current answer key" onClick={recalculate}>↻ Recalculate results</button>
      </div>

      {/* Add / edit bar: full width, at the top */}
      <form ref={formRef} className="card" onSubmit={submit} style={{ marginBottom: 20, scrollMarginTop: 80, borderLeft: `4px solid ${editing ? '#1d4ed8' : '#6366f1'}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div className="card-title" style={{ margin: 0 }}>{editing ? `✏️ Editing question ${questions.findIndex((q) => q.id === editing) + 1}` : '+ Add question'}</div>
          {editing && <button type="button" className="btn btn-secondary btn-sm" onClick={stopEdit}>Cancel editing</button>}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 14, marginBottom: 12 }}>
          <div>
            <label style={lab} htmlFor="q-section">Section</label>
            <select id="q-section" className="form-input" value={newSection ? NEW_SECTION : f.section}
              onChange={(e) => { if (e.target.value === NEW_SECTION) { setNewSection(true); patch({ section: '' }); } else { setNewSection(false); patch({ section: e.target.value }); } }}>
              {options.map((s) => <option key={s} value={s}>{s}{!listed.includes(s) ? ' (current)' : ''}</option>)}
              <option value={NEW_SECTION}>＋ Other / new section…</option>
            </select>
            {newSection && <input className="form-input" style={{ marginTop: 6 }} autoFocus required placeholder="Type the section name" maxLength={60} value={f.section} onChange={(e) => patch({ section: e.target.value })} />}
          </div>
          <div>
            <label style={lab} htmlFor="q-image">Image (optional, max 2MB)</label>
            <input id="q-image" type="file" accept="image/*" onChange={pickImage} />
            {f.image && <div style={{ marginTop: 6 }}><img src={f.image} alt="Question" style={{ maxWidth: '100%', maxHeight: 90, borderRadius: 8 }} />{' '}
              <button type="button" className="btn btn-secondary btn-xs" onClick={() => patch({ image: null })}>Remove image</button></div>}
          </div>
        </div>

        <div style={{ marginBottom: 12 }}><label style={lab} htmlFor="q-passage">Passage (optional)</label>
          <textarea id="q-passage" className="form-input" rows={2} value={f.passage || ''} onChange={(e) => patch({ passage: e.target.value })} /></div>
        <div style={{ marginBottom: 12 }}><label style={lab} htmlFor="q-text">Question</label>
          <textarea id="q-text" className="form-input" rows={2} required value={f.question} onChange={(e) => patch({ question: e.target.value })} /></div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 10, marginBottom: 6 }}>
          {LETTERS.map((L, i) => (
            <div key={L}>
              <label style={lab} htmlFor={`q-opt-${L}`}>Option {L} {Number(f.answer) === i && <span style={{ color: 'var(--green)' }}>· correct answer</span>}</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="radio" name="answer" checked={Number(f.answer) === i} onChange={() => patch({ answer: i })} aria-label={`Mark option ${L} correct`} />
                <input id={`q-opt-${L}`} className="form-input" required value={f.options[i]} onChange={(e) => { const o = [...f.options]; o[i] = e.target.value; patch({ options: o }); }} />
              </div>
            </div>))}
        </div>
        <div className="sec-sub" style={{ marginBottom: 12 }}>The selected radio button marks the correct answer.</div>

        <button className="btn btn-primary">{editing ? '💾 Save question' : '+ Add question'}</button>
      </form>

      {/* Question list */}
      <div className="card">
        <div className="card-title">Questions ({questions.length})</div>
        {questions.length === 0 ? <Empty>No questions yet. Use the bar above to add the first one.</Empty> : questions.map((q, n) => (
          <div key={q.id} style={{ padding: '12px 10px', borderBottom: '1px solid var(--surface2)', background: editing === q.id ? '#eff6ff' : undefined, borderRadius: editing === q.id ? 8 : 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ fontWeight: 600 }}>{n + 1}. {q.question}</div>
              <div style={{ whiteSpace: 'nowrap' }}>
                <button className="btn btn-secondary btn-xs" onClick={() => startEdit(q)}>Edit</button>{' '}
                <button className="btn btn-danger btn-xs" onClick={() => remove(q)}>Delete</button>
              </div>
            </div>
            <div style={{ margin: '4px 0' }}><Badge tone="purple">{q.section}</Badge></div>
            {q.image && <img src={q.image} alt="" style={{ maxHeight: 100, borderRadius: 8, margin: '6px 0' }} />}
            <ol type="A" style={{ paddingLeft: 20, fontSize: '.82rem', color: 'var(--ink2)' }}>
              {q.options.map((o, i) => <li key={i} style={i === q.answer ? { color: 'var(--green)', fontWeight: 600 } : undefined}>{o}</li>)}
            </ol>
          </div>
        ))}
      </div>
    </>
  );
}
