import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api.js';
import { useFlash } from '../../flash.jsx';
import { useFetch } from '../../components/useFetch.js';
import { Loading } from '../../components/ui.jsx';
import { DIFFICULTIES, GRADES, SUBJECTS } from '../../constants.js';

const BLANK = { name: '', mockNumber: '', subject: SUBJECTS[0], grade: 'All Grades', difficulty: 'Medium', duration: 40, status: 'draft' };
const MOCKS = [1, 2, 3, 4, 5];
const GRADE_OPTIONS = ['All Grades', ...GRADES];

const label = { fontSize: '.8rem', fontWeight: 600, display: 'block', marginBottom: 4 };
const chip = (bg, color) => ({ background: bg, color, padding: '2px 8px', borderRadius: 10, fontSize: '.75rem' });

// Same card layout as the original templates/admin/tests.html: create form on top, then a grid of test cards
// with view mode and an inline "Edit Settings" mode.
export default function AdminTests() {
  const flash = useFlash();
  const { data, loading, reload } = useFetch('/admin/tests');
  const [create, setCreate] = useState(BLANK);
  const [editId, setEditId] = useState(null);
  const [draft, setDraft] = useState(null);
  if (loading) return <Loading />;

  const run = async (fn, ok) => {
    try { await fn(); if (ok) flash(ok); await reload(); return true; } catch (err) { flash(err.message, 'error'); return false; }
  };
  const setC = (k) => (e) => setCreate({ ...create, [k]: e.target.value });
  const setD = (k) => (e) => setDraft({ ...draft, [k]: e.target.value });
  const body = (f) => ({ ...f, duration: Number(f.duration), mockNumber: f.mockNumber === '' || f.mockNumber == null ? null : Number(f.mockNumber) });

  const add = async (e) => {
    e.preventDefault();
    if (await run(() => api.post('/admin/tests', body(create)), 'Test created successfully.')) setCreate(BLANK);
  };
  const startEdit = (t) => { setEditId(t.id); setDraft({ name: t.name, mockNumber: t.mockNumber ?? '', subject: t.subject, grade: t.grade, difficulty: t.difficulty, duration: t.duration, status: t.status }); };
  const saveEdit = async (e) => {
    e.preventDefault();
    if (await run(() => api.put(`/admin/tests/${editId}`, body(draft)), 'Test updated.')) setEditId(null);
  };

  return (
    <>
      {/* Create form */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h3 style={{ marginTop: 0 }}>+ Create New Test</h3>
        <form onSubmit={add}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 12, marginBottom: 12 }}>
            <div><label style={label}>Test Title</label><input className="form-input" required placeholder="e.g. IBT English Set 3" value={create.name} onChange={setC('name')} /></div>
            <div><label style={label}>IBT Mock</label>
              <select className="form-input" required value={create.mockNumber} onChange={setC('mockNumber')}>
                <option value="">Select…</option>{MOCKS.map((n) => <option key={n} value={n}>IBT Mock {n}</option>)}
              </select></div>
            <div><label style={label}>Subject</label><select className="form-input" value={create.subject} onChange={setC('subject')}>{SUBJECTS.map((s) => <option key={s}>{s}</option>)}</select></div>
            <div><label style={label}>Grade</label>
              <select className="form-input" value={create.grade} onChange={setC('grade')}>
                {GRADE_OPTIONS.map((g) => <option key={g} value={g}>{g === 'All Grades' ? 'All Grades (3, 4 & 5)' : g}</option>)}
              </select></div>
            <div><label style={label}>Difficulty</label><select className="form-input" value={create.difficulty} onChange={setC('difficulty')}>{DIFFICULTIES.map((d) => <option key={d}>{d}</option>)}</select></div>
            <div><label style={label}>Duration (min)</label><input className="form-input" type="number" min="5" max="180" required value={create.duration} onChange={setC('duration')} /></div>
            <div><label style={label}>Status</label><select className="form-input" value={create.status} onChange={setC('status')}><option value="draft">Draft</option><option value="active">Active</option></select></div>
          </div>
          <button type="submit" className="btn btn-primary">+ Create Test</button>
          <span style={{ fontSize: '.78rem', color: 'var(--ink3)', marginLeft: 10 }}><strong>All Grades</strong> makes the test available to Grade 3, 4 &amp; 5.</span>
        </form>
      </div>

      {/* Test cards */}
      <div style={{ marginBottom: 8, fontSize: '.85rem', color: 'var(--ink3)' }}>{data.length} total</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 16 }}>
        {data.map((t) => (
          <div className="card" style={{ padding: 18 }} key={t.id}>
            {editId !== t.id ? (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <div style={{ fontWeight: 700, fontSize: '.95rem' }}>{t.name}</div>
                  <span style={{ fontSize: '.75rem', fontWeight: 700, color: t.status === 'active' ? '#16a34a' : '#f59e0b' }}>{t.status}</span>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                  {t.mockNumber ? <span style={chip('#f3e8ff', '#7e22ce')}>IBT Mock {t.mockNumber}</span> : <span style={chip('#f1f5f9', '#64748b')} title="Set it in Edit Settings so this test appears in mock-wise analytics">Mock not set</span>}
                  <span style={chip('#eef2ff', '#4f46e5')}>{t.subject}</span>
                  <span style={chip('#f0fdf4', '#16a34a')}>{t.grade}</span>
                  <span style={chip('#fef9c3', '#a16207')}>{t.difficulty}</span>
                </div>
                <div style={{ fontSize: '.82rem', color: 'var(--ink3)', marginBottom: 14 }}>📝 {t.questionCount} questions &nbsp;|&nbsp; ⏱ {t.duration} min</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Link to={`/admin/tests/${t.id}/questions`} className="btn btn-secondary btn-sm">✏ Questions</Link>
                  <button onClick={() => startEdit(t)} style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '5px 10px', borderRadius: 5, cursor: 'pointer', fontSize: '.8rem' }}>⚙ Edit Settings</button>
                  <button onClick={() => run(() => api.post(`/admin/tests/${t.id}/toggle`))}
                    style={{ background: t.status === 'active' ? '#fef3c7' : '#dcfce7', color: t.status === 'active' ? '#92400e' : '#166534', border: 'none', padding: '5px 10px', borderRadius: 5, cursor: 'pointer', fontSize: '.8rem' }}>
                    {t.status === 'active' ? '⏸ Deactivate' : '▶ Activate'}
                  </button>
                  <button onClick={() => window.confirm(`Delete ${t.name}? This cannot be undone.`) && run(() => api.del(`/admin/tests/${t.id}`), 'Test deleted.')}
                    style={{ background: '#fee2e2', color: '#dc2626', border: 'none', padding: '5px 10px', borderRadius: 5, cursor: 'pointer', fontSize: '.8rem' }}>🗑 Delete</button>
                </div>
              </div>
            ) : (
              <form onSubmit={saveEdit}>
                <div style={{ fontWeight: 700, fontSize: '.9rem', marginBottom: 12, color: '#1d4ed8' }}>⚙ Edit Test Settings</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div><label style={{ ...label, fontSize: '.78rem' }}>Title</label><input className="form-input" required value={draft.name} onChange={setD('name')} /></div>
                  <div><label style={{ ...label, fontSize: '.78rem' }}>IBT Mock</label>
                    <select className="form-input" value={draft.mockNumber} onChange={setD('mockNumber')}>
                      <option value="">Not set</option>{MOCKS.map((n) => <option key={n} value={n}>IBT Mock {n}</option>)}
                    </select></div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div><label style={{ ...label, fontSize: '.78rem' }}>Subject</label><select className="form-input" value={draft.subject} onChange={setD('subject')}>{SUBJECTS.map((s) => <option key={s}>{s}</option>)}</select></div>
                    <div><label style={{ ...label, fontSize: '.78rem' }}>Grade</label><select className="form-input" value={draft.grade} onChange={setD('grade')}>{GRADE_OPTIONS.map((g) => <option key={g}>{g}</option>)}</select></div>
                    <div><label style={{ ...label, fontSize: '.78rem' }}>Difficulty</label><select className="form-input" value={draft.difficulty} onChange={setD('difficulty')}>{DIFFICULTIES.map((d) => <option key={d}>{d}</option>)}</select></div>
                    <div><label style={{ ...label, fontSize: '.78rem' }}>Duration (min)</label><input className="form-input" type="number" min="5" max="180" required value={draft.duration} onChange={setD('duration')} /></div>
                  </div>
                  <div><label style={{ ...label, fontSize: '.78rem' }}>Status</label><select className="form-input" value={draft.status} onChange={setD('status')}><option value="draft">Draft</option><option value="active">Active</option></select></div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    <button type="submit" style={{ background: '#1d4ed8', color: '#fff', border: 'none', padding: '7px 16px', borderRadius: 5, cursor: 'pointer', fontSize: '.83rem' }}>💾 Save Changes</button>
                    <button type="button" onClick={() => setEditId(null)} style={{ background: '#f1f5f9', color: '#475569', border: 'none', padding: '7px 16px', borderRadius: 5, cursor: 'pointer', fontSize: '.83rem' }}>Cancel</button>
                  </div>
                </div>
              </form>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
