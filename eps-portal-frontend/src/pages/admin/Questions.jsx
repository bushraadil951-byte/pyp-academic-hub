import { useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../api.js';
import { useFlash } from '../../flash.jsx';
import { useFetch } from '../../components/useFetch.js';
import { Badge, Empty, Loading } from '../../components/ui.jsx';
import { SECTIONS_BY_SUBJECT } from '../../constants.js';

const LETTERS = ['A', 'B', 'C', 'D'];
const MAX_IMG = 2 * 1024 * 1024;
const NEW_SECTION = '__new__';

const toDataUrl = (file) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
const lab = { fontSize: '.76rem', fontWeight: 600, display: 'block', marginBottom: 2 };

export default function AdminQuestions() {
  const { testId } = useParams();
  const flash = useFlash();
  const formRef = useRef(null);
  const { data, loading, reload } = useFetch(`/admin/tests/${testId}/questions`);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(null);
  const [newSection, setNewSection] = useState(false);

  if (loading) return <Loading />;
  const { test, questions } = data;
  const listed = SECTIONS_BY_SUBJECT[test.subject] || ['General'];
  const blank = { section: listed[0], passage: '', question: '', options: ['', '', '', ''], answer: 0, image: null };
  const f = form || blank;
  const patch = (p) => setForm({ ...f, ...p });
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
    try {
      await api.del(`/admin/tests/${testId}/questions/${q.id}`);
      flash('Question deleted.');
      if (editing === q.id) stopEdit();
      reload();
    } catch (err) { flash(err.message, 'error'); }
  };

  return (
    <>
      <div className="sec-header">
        <div><div className="sec-title">{test.name}</div><div className="sec-sub">{test.subject} · {test.grade} · {questions.length} questions</div></div>
        <button type="button" className="btn btn-secondary btn-sm" title="Re-score every submission against the current answer key" onClick={recalculate}>↻ Recalculate results</button>
      </div>

      <form ref={formRef} className="card" onSubmit={submit} style={{ marginBottom: 12, padding: '10px 14px', scrollMarginTop: 70, borderLeft: `3px solid ${editing ? '#1d4ed8' : '#6366f1'}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
          <div className="card-title" style={{ margin: 0, fontSize: '.88rem' }}>{editing ? `✏️ Editing question ${questions.findIndex((q) => q.id === editing) + 1}` : '+ Add question'}</div>
          {editing && <button type="button" className="btn btn-secondary btn-xs" onClick={stopEdit}>Cancel editing</button>}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 7 }}>
          <div>
            <label style={lab} htmlFor="q-section">Section</label>
            <select id="q-section" className="form-input" style={{ padding: '5px 8px' }} value={newSection ? NEW_SECTION : f.section}
              onChange={(e) => { if (e.target.value === NEW_SECTION) { setNewSection(true); patch({ section: '' }); } else { setNewSection(false); patch({ section: e.target.value }); } }}>
              {options.map((s) => <option key={s} value={s}>{s}{!listed.includes(s) ? ' (current)' : ''}</option>)}
              <option value={NEW_SECTION}>＋ Other / new section…</option>
            </select>
            {newSection && <input className="form-input" style={{ marginTop: 4, padding: '5px 8px' }} autoFocus required placeholder="Type the section name" maxLength={60} value={f.section} onChange={(e) => patch({ section: e.target.value })} />}
          </div>

          <div>
            <label style={lab} htmlFor="q-image">Image <span style={{ fontWeight: 400, color: '#94a3b8' }}>(optional, max 2MB)</span></label>
            <input id="q-image" type="file" accept="image/*" onChange={pickImage} style={{ fontSize: '.68rem', height: 30 }} />
            {f.image && <div style={{ marginTop: 3, display: 'flex', alignItems: 'center', gap: 5 }}><img src={f.image} alt="Question" style={{ width: 70, height: 38, objectFit: 'cover', borderRadius: 5 }} />{' '}<button type="button" className="btn btn-secondary btn-xs" onClick={() => patch({ image: null })}>Remove</button></div>}
          </div>
        </div>

        <div style={{ marginBottom: 7 }}>
          <label style={lab} htmlFor="q-passage">Passage <span style={{ fontWeight: 400, color: '#94a3b8' }}>(optional)</span></label>
          <textarea id="q-passage" className="form-input" rows={1} style={{ height: 34, minHeight: 34, padding: '5px 8px', resize: 'vertical' }} value={f.passage || ''} onChange={(e) => patch({ passage: e.target.value })} />
        </div>

        <div style={{ marginBottom: 7 }}>
          <label style={lab} htmlFor="q-text">Question</label>
          <textarea id="q-text" className="form-input" rows={1} style={{ height: 36, minHeight: 36, padding: '5px 8px', resize: 'vertical' }} required value={f.question} onChange={(e) => patch({ question: e.target.value })} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 7, marginBottom: 4 }}>
          {LETTERS.map((L, i) => (
            <div key={L}>
              <label style={lab} htmlFor={`q-opt-${L}`}>Option {L} {Number(f.answer) === i && <span style={{ color: 'var(--green)', fontSize: '.65rem' }}>✓</span>}</label>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <input type="radio" name="answer" checked={Number(f.answer) === i} onChange={() => patch({ answer: i })} aria-label={`Mark option ${L} correct`} />
                <input id={`q-opt-${L}`} className="form-input" style={{ padding: '5px 7px' }} required value={f.options[i]} onChange={(e) => { const o = [...f.options]; o[i] = e.target.value; patch({ options: o }); }} />
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 3 }}>
          <div className="sec-sub" style={{ fontSize: '.64rem', margin: 0 }}>Select the radio button to mark the correct answer.</div>
          <button className="btn btn-primary btn-sm">{editing ? '💾 Save question' : '+ Add question'}</button>
        </div>
      </form>

      <div className="card">
        <div className="card-title">Questions ({questions.length})</div>
        {questions.length === 0 ? <Empty>No questions yet. Use the bar above to add the first one.</Empty> : questions.map((q, n) => (
          <div key={q.id} style={{ padding: '10px', borderBottom: '1px solid var(--surface2)', background: editing === q.id ? '#eff6ff' : undefined, borderRadius: editing === q.id ? 7 : 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ fontWeight: 600 }}>{n + 1}. {q.question}</div>
              <div style={{ whiteSpace: 'nowrap' }}>
                <button className="btn btn-secondary btn-xs" onClick={() => startEdit(q)}>Edit</button>{' '}
                <button className="btn btn-danger btn-xs" onClick={() => remove(q)}>Delete</button>
              </div>
            </div>
            <div style={{ margin: '3px 0' }}><Badge tone="purple">{q.section}</Badge></div>
            {q.image && <img src={q.image} alt="" style={{ maxHeight: 90, borderRadius: 7, margin: '4px 0' }} />}
            <ol type="A" style={{ paddingLeft: 20, margin: '4px 0 0', fontSize: '.8rem', color: 'var(--ink2)' }}>
              {q.options.map((o, i) => <li key={i} style={i === q.answer ? { color: 'var(--green)', fontWeight: 600 } : undefined}>{o}</li>)}
            </ol>
          </div>
        ))}
      </div>
    </>
  );
}
