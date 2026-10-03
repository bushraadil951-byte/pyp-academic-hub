// Shared add/edit/delete screen for students and teachers (they were two near-identical Flask templates).
import { useState } from 'react';
import { api } from '../../api.js';
import { useFlash } from '../../flash.jsx';
import { useFetch } from '../../components/useFetch.js';
import { Badge, Empty, Field, Loading, Modal } from '../../components/ui.jsx';

export default function People({ kind, grades, singular }) {
  const flash = useFlash();
  const { data, loading, reload } = useFetch(`/admin/${kind}`);
  const [form, setForm] = useState(null);       // null = closed; {} = add; {id,...} = edit
  const [filter, setFilter] = useState('');
  const isStudent = kind === 'students';

  if (loading) return <Loading />;
  const rows = (data || []).filter((p) => !filter || p.grade === filter || p.name.toLowerCase().includes(filter.toLowerCase()));
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const save = async (e) => {
    e.preventDefault();
    try {
      if (form.id) await api.put(`/admin/${kind}/${form.id}`, form);
      else await api.post(`/admin/${kind}`, form);
      flash(form.id ? `${singular} updated.` : `${singular} ${form.name} added successfully.`);
      setForm(null); reload();
    } catch (err) { flash(err.message, 'error'); }
  };
  const remove = async (p) => {
    if (!window.confirm(`Remove ${p.name}? Their results are deleted too.`)) return;
    try { await api.del(`/admin/${kind}/${p.id}`); flash(`${singular} removed.`); reload(); }
    catch (err) { flash(err.message, 'error'); }
  };

  return (
    <>
      <div className="sec-header">
        <div><div className="sec-title">{isStudent ? 'Students' : 'Teachers'}</div><div className="sec-sub">{rows.length} shown</div></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="form-input" style={{ width: 200 }} placeholder="Search name or grade…" value={filter} onChange={(e) => setFilter(e.target.value)} />
          <button className="btn btn-primary" onClick={() => setForm({ grade: grades[0], section: 'A' })}>+ Add {singular}</button>
        </div>
      </div>
      <div className="card">
        {rows.length === 0 ? <Empty>No {kind} match. Add one to get started.</Empty> : (
          <div className="table-wrap"><table>
            <thead><tr><th>Name</th><th>Username</th><th>{isStudent ? 'Grade' : 'Assigned grade'}</th>{isStudent && <th>Section</th>}<th /></tr></thead>
            <tbody>{rows.map((p) => (
              <tr key={p.id}>
                <td style={{ fontWeight: 500 }}>{p.name}</td>
                <td style={{ color: 'var(--ink3)' }}>{p.username}</td>
                <td>{p.grade ? <Badge tone="purple">{p.grade}</Badge> : <Badge tone="gray">All grades</Badge>}</td>
                {isStudent && <td>{p.section || '—'}</td>}
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <button className="btn btn-secondary btn-xs" onClick={() => setForm({ ...p, password: '' })}>Edit</button>{' '}
                  <button className="btn btn-danger btn-xs" onClick={() => remove(p)}>Delete</button>
                </td>
              </tr>))}
            </tbody>
          </table></div>
        )}
      </div>

      {form && (
        <Modal title={form.id ? `Edit ${singular}` : `Add ${singular}`} onClose={() => setForm(null)}>
          <form onSubmit={save}>
            <Field label="Full name"><input className="form-input" required value={form.name || ''} onChange={set('name')} /></Field>
            <Field label="Username">
              <input className="form-input" required disabled={!!form.id} value={form.username || ''} onChange={set('username')} />
            </Field>
            <div className="form-row">
              <Field label={isStudent ? 'Grade' : 'Assigned grade (optional)'}>
                <select className="form-input" required={isStudent} value={form.grade || ''} onChange={set('grade')}>
                  {!isStudent && <option value="">All grades</option>}
                  {grades.map((g) => <option key={g}>{g}</option>)}
                </select>
              </Field>
              {isStudent && <Field label="Section"><input className="form-input" maxLength={2} value={form.section || ''} onChange={set('section')} /></Field>}
            </div>
            <Field label={form.id ? 'New password (leave blank to keep current)' : 'Password'}>
              <input className="form-input" type="password" required={!form.id} value={form.password || ''} onChange={set('password')} />
            </Field>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setForm(null)}>Cancel</button>
              <button className="btn btn-primary">Save {singular.toLowerCase()}</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
