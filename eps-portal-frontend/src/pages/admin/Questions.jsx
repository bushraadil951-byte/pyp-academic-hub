import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../api.js';
import { useFlash } from '../../flash.jsx';
import { useFetch } from '../../components/useFetch.js';
import { Badge, Empty, Field, Loading } from '../../components/ui.jsx';
import { SECTIONS_BY_SUBJECT } from '../../constants.js';

const LETTERS = ['A', 'B', 'C', 'D'];
const MAX_IMG = 2 * 1024 * 1024; // same 2 MB cap as the Flask version

const toDataUrl = (file) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });

export default function AdminQuestions() {
  const { testId } = useParams();
  const flash = useFlash();
  const { data, loading, reload } = useFetch(`/admin/tests/${testId}/questions`);
  const [editing, setEditing] = useState(null); // question id being edited
  const [form, setForm] = useState(null);

  if (loading) return <Loading />;
  const { test, questions } = data;
  const sections = SECTIONS_BY_SUBJECT[test.subject] || ['General'];
  const blank = { section: sections[0], passage: '', question: '', options: ['', '', '', ''], answer: 0, image: null };
  const f = form || blank;
  const patch = (p) => setForm({ ...f, ...p });

  const pickImage = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > MAX_IMG) { flash('Image too large — max 2MB.', 'error'); e.target.value = ''; return; }
    patch({ image: await toDataUrl(file) });
  };

  const submit = async (e) => {
    e.preventDefault();
    try {
      if (editing) await api.put(`/admin/tests/${testId}/questions/${editing}`, f);
      else await api.post(`/admin/tests/${testId}/questions`, f);
      flash(editing ? 'Question updated.' : 'Question added.');
      setForm(null); setEditing(null); reload();
    } catch (err) { flash(err.message, 'error'); }
  };
  const recalculate = async () => {
    if (!window.confirm('Recalculate every student result for this test using the current answers?')) return;
    try { const r = await api.post(`/admin/tests/${testId}/recalculate`); flash(`Results recalculated (${r.updated}).`); }
    catch (err) { flash(err.message, 'error'); }
  };
  const remove = async (q) => {
    if (!window.confirm('Delete this question?')) return;
    try { await api.del(`/admin/tests/${testId}/questions/${q.id}`); flash('Question deleted.'); reload(); }
    catch (err) { flash(err.message, 'error'); }
  };

  return (
    <div className="grid-2" style={{ gridTemplateColumns: 'minmax(320px,420px) 1fr', alignItems: 'start' }}>
      <form className="card" onSubmit={submit}>
        <div className="card-title">{editing ? `Edit question ${editing}` : 'Add question'}</div>
        <Field label="Section">
          <select className="form-input" value={f.section} onChange={(e) => patch({ section: e.target.value })}>{sections.map((s) => <option key={s}>{s}</option>)}</select>
        </Field>
        <Field label="Passage (optional)"><textarea className="form-input" rows={3} value={f.passage || ''} onChange={(e) => patch({ passage: e.target.value })} /></Field>
        <Field label="Question"><textarea className="form-input" rows={2} required value={f.question} onChange={(e) => patch({ question: e.target.value })} /></Field>
        {LETTERS.map((L, i) => (
          <Field key={L} label={`Option ${L}`}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="radio" name="answer" checked={Number(f.answer) === i} onChange={() => patch({ answer: i })} aria-label={`Mark option ${L} correct`} />
              <input className="form-input" required value={f.options[i]} onChange={(e) => { const o = [...f.options]; o[i] = e.target.value; patch({ options: o }); }} />
            </div>
          </Field>
        ))}
        <div className="sec-sub" style={{ marginBottom: 10 }}>The selected radio button marks the correct answer.</div>
        <Field label="Image (optional, max 2MB)">
          <input type="file" accept="image/*" onChange={pickImage} />
          {f.image && <div style={{ marginTop: 6 }}><img src={f.image} alt="Question" style={{ maxWidth: '100%', maxHeight: 120, borderRadius: 8 }} />{' '}
            <button type="button" className="btn btn-secondary btn-xs" onClick={() => patch({ image: null })}>Remove image</button></div>}
        </Field>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary">{editing ? 'Save question' : 'Add question'}</button>
          {editing && <button type="button" className="btn btn-secondary" onClick={() => { setEditing(null); setForm(null); }}>Cancel</button>}
        </div>
      </form>

      <div className="card">
        <div className="sec-header">
          <div><div className="sec-title">{test.name}</div><div className="sec-sub">{test.subject} · {test.grade} · {questions.length} questions</div></div>
          <button type="button" className="btn btn-secondary btn-sm" title="Re-score every submission against the current answer key"
            onClick={recalculate}>↻ Recalculate results</button>
        </div>
        {questions.length === 0 ? <Empty>No questions yet. Use the form to add the first one.</Empty> : questions.map((q, n) => (
          <div key={q.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--surface2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ fontWeight: 600 }}>{n + 1}. {q.question}</div>
              <div style={{ whiteSpace: 'nowrap' }}>
                <button className="btn btn-secondary btn-xs" onClick={() => { setEditing(q.id); setForm({ ...q }); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Edit</button>{' '}
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
    </div>
  );
}
