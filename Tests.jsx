import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api.js';
import { useFlash } from '../../flash.jsx';
import { useFetch } from '../../components/useFetch.js';
import { Badge, Empty, Field, Loading, Modal } from '../../components/ui.jsx';
import { DIFFICULTIES, GRADES, SUBJECTS } from '../../constants.js';

const BLANK = { name: '', subject: SUBJECTS[0], grade: GRADES[0], difficulty: 'Medium', duration: 40, status: 'draft' };

export default function AdminTests() {
  const flash = useFlash();
  const { data, loading, reload } = useFetch('/admin/tests');
  const [form, setForm] = useState(null);
  if (loading) return <Loading />;
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const run = async (fn, ok) => { try { await fn(); if (ok) flash(ok); reload(); } catch (err) { flash(err.message, 'error'); } };

  const save = (e) => {
    e.preventDefault();
    const body = { ...form, duration: Number(form.duration) };
    run(() => (form.id ? api.put(`/admin/tests/${form.id}`, body) : api.post('/admin/tests', body)), form.id ? 'Test updated.' : 'Test created successfully.')
      .then(() => setForm(null));
  };

  return (
    <>
      <div className="sec-header">
        <div><div className="sec-title">IBT Mock Tests</div><div className="sec-sub">{data.length} tests</div></div>
        <button className="btn btn-primary" onClick={() => setForm(BLANK)}>+ Create test</button>
      </div>
      <div className="card">
        {data.length === 0 ? <Empty>No tests yet. Create one, then add questions to it.</Empty> : (
          <div className="table-wrap"><table>
            <thead><tr><th>Test</th><th>Subject</th><th>Grade</th><th>Difficulty</th><th>Duration</th><th>Questions</th><th>Status</th><th /></tr></thead>
            <tbody>{data.map((t) => (
              <tr key={t.id}>
                <td style={{ fontWeight: 500 }}>{t.name}</td>
                <td><Badge>{t.subject}</Badge></td>
                <td>{t.grade}</td>
                <td>{t.difficulty}</td>
                <td>{t.duration} min</td>
                <td>{t.questionCount}</td>
                <td>
                  <button className={`btn btn-xs ${t.status === 'active' ? 'btn-success' : 'btn-secondary'}`}
                    onClick={() => run(() => api.post(`/admin/tests/${t.id}/toggle`))}>{t.status === 'active' ? 'Active' : 'Draft'}</button>
                </td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <Link className="btn btn-secondary btn-xs" to={`/admin/tests/${t.id}/questions`}>Questions</Link>{' '}
                  <button className="btn btn-secondary btn-xs" onClick={() => setForm(t)}>Edit</button>{' '}
                  <button className="btn btn-secondary btn-xs" title="Re-score every submission against the current answer key"
                    onClick={() => window.confirm('Recalculate all results for this test?') && run(() => api.post(`/admin/tests/${t.id}/recalculate`), 'Results recalculated.')}>Recalculate</button>{' '}
                  <button className="btn btn-danger btn-xs"
                    onClick={() => window.confirm(`Delete “${t.name}” and all its results?`) && run(() => api.del(`/admin/tests/${t.id}`), 'Test deleted.')}>Delete</button>
                </td>
              </tr>))}
            </tbody>
          </table></div>
        )}
      </div>

      {form && (
        <Modal title={form.id ? 'Edit test' : 'Create test'} onClose={() => setForm(null)}>
          <form onSubmit={save}>
            <Field label="Test name"><input className="form-input" required value={form.name} onChange={set('name')} /></Field>
            <div className="form-row">
              <Field label="Subject"><select className="form-input" value={form.subject} onChange={set('subject')}>{SUBJECTS.map((s) => <option key={s}>{s}</option>)}</select></Field>
              <Field label="Grade"><select className="form-input" value={form.grade} onChange={set('grade')}>{['All Grades', ...GRADES].map((g) => <option key={g}>{g}</option>)}</select></Field>
            </div>
            <div className="form-row-3">
              <Field label="Difficulty"><select className="form-input" value={form.difficulty} onChange={set('difficulty')}>{DIFFICULTIES.map((d) => <option key={d}>{d}</option>)}</select></Field>
              <Field label="Duration (min)"><input className="form-input" type="number" min="1" required value={form.duration} onChange={set('duration')} /></Field>
              <Field label="Status"><select className="form-input" value={form.status} onChange={set('status')}><option value="draft">Draft</option><option value="active">Active</option></select></Field>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setForm(null)}>Cancel</button>
              <button className="btn btn-primary">Save test</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
