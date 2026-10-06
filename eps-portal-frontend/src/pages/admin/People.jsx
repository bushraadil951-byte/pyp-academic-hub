// Shared add/edit/delete screen for students and teachers (they were two near-identical Flask templates).
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { downloadCsv } from '../../csv.js';
import { api } from '../../api.js';
import { useFlash } from '../../flash.jsx';
import { useFetch } from '../../components/useFetch.js';
import { Badge, Empty, Field, Loading, Modal } from '../../components/ui.jsx';
import ResetPasswordButton from '../../components/ResetPasswordButton.jsx';

export default function People({ kind, grades, singular }) {
  const flash = useFlash();
  const { data, loading, reload } = useFetch(`/admin/${kind}`);
  const [form, setForm] = useState(null);       // null = closed; {} = add; {id,...} = edit
  const [search, setSearch] = useState('');
  const [gradeF, setGradeF] = useState('');
  const [sectionF, setSectionF] = useState('');
  const isStudent = kind === 'students';

  if (loading) return <Loading />;
  const all = data || [];
  const q = search.trim().toLowerCase();
  const rows = all.filter((p) => (!gradeF || p.grade === gradeF)
    && (!sectionF || (p.section || '') === sectionF)
    && (!q || p.name.toLowerCase().includes(q) || p.username.toLowerCase().includes(q)));
  // Section choices: A-D plus any other section that already exists in the data
  const sectionOptions = [...new Set(['A', 'B', 'C', 'D', ...all.map((p) => p.section).filter(Boolean)])].sort();
  const filtering = !!(search || gradeF || sectionF);
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
        <div><div className="sec-title">{isStudent ? 'Students' : 'Teachers'}</div><div className="sec-sub">{filtering ? `${rows.length} of ${all.length} shown` : `${all.length} total`}</div></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link to="/admin/emails" className="btn btn-secondary">Import emails</Link>
          {isStudent && (
            <>
              <Link to="/admin/students/upload" className="btn btn-secondary">Bulk upload</Link>
              <button className="btn btn-secondary" onClick={() => downloadCsv('student_credentials.csv', [['Name', 'Grade', 'Section', 'Username'], ...rows.map((p) => [p.name, p.grade, p.section, p.username])])}>Download list</button>
            </>
          )}
          <button className="btn btn-primary" onClick={() => setForm({ grade: grades[0], section: 'A' })}>+ Add {singular}</button>
        </div>
      </div>
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label className="form-label" htmlFor="flt-search">Search</label>
            <input id="flt-search" className="form-input" placeholder="Name or username…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div style={{ minWidth: 150 }}>
            <label className="form-label" htmlFor="flt-grade">{isStudent ? 'Grade' : 'Assigned grade'}</label>
            <select id="flt-grade" className="form-input" value={gradeF} onChange={(e) => setGradeF(e.target.value)}>
              <option value="">All grades</option>{grades.map((g) => <option key={g}>{g}</option>)}
            </select>
          </div>
          {isStudent && (
            <div style={{ minWidth: 150 }}>
              <label className="form-label" htmlFor="flt-section">Section</label>
              <select id="flt-section" className="form-input" value={sectionF} onChange={(e) => setSectionF(e.target.value)}>
                <option value="">All sections</option>{sectionOptions.map((x) => <option key={x}>{x}</option>)}
              </select>
            </div>
          )}
          {filtering && <button className="btn btn-secondary" onClick={() => { setSearch(''); setGradeF(''); setSectionF(''); }}>Clear filters</button>}
        </div>
      </div>
      <div className="card">
        {rows.length === 0 ? <Empty>{filtering ? `No ${kind} match these filters.` : `No ${kind} yet. Add one to get started.`}</Empty> : (
          <div className="table-wrap"><table>
            <thead><tr><th>Name</th><th>Username</th><th>Email</th><th>{isStudent ? 'Grade' : 'Assigned grade'}</th>{isStudent && <th>Section</th>}<th /></tr></thead>
            <tbody>{rows.map((p) => (
              <tr key={p.id}>
                <td style={{ fontWeight: 500 }}>{p.name}</td>
                <td style={{ color: 'var(--ink3)' }}>{p.username}</td>
                <td style={{ color: 'var(--ink3)', fontSize: '.8rem' }}>{p.email || <span title="No email: this person cannot get reset codes">— none</span>}</td>
                <td>{p.grade ? <Badge tone="purple">{p.grade}</Badge> : <Badge tone="gray">All grades</Badge>}</td>
                {isStudent && <td>{p.section || '—'}</td>}
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <ResetPasswordButton person={p} />{' '}
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
            <Field label={isStudent ? 'Parent or guardian email (for password reset codes)' : 'Email (for password reset codes)'}>
              <input className="form-input" type="email" placeholder="name@example.com" value={form.email || ''} onChange={set('email')} />
            </Field>
            <Field label={form.id ? 'New temporary password (leave blank to keep current)' : 'Temporary password'}>
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
