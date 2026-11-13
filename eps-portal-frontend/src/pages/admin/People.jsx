import { useState } from 'react';
import { Link } from 'react-router-dom';
import { downloadCsv } from '../../csv.js';
import { api } from '../../api.js';
import { useFlash } from '../../flash.jsx';
import { useFetch } from '../../components/useFetch.js';
import { Badge, Empty, Field, Loading, Modal } from '../../components/ui.jsx';
import ResetPasswordButton from '../../components/ResetPasswordButton.jsx';

const SECTION_LETTERS = ['A', 'B', 'C', 'D'];

function AccessBlock({ title, grade, sections, grades, onGrade, onSection, onAllSections }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: '.8rem', fontWeight: 600, color: '#64748b', marginBottom: 6 }}>{title}</div>
      <select className="form-input" value={grade || ''} onChange={(e) => onGrade(e.target.value)}>
        <option value="">No grade</option>
        <option value="ALL">All grades</option>
        {grades.map((g) => <option key={g} value={g}>{g}</option>)}
      </select>
      {grade && (
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 8, fontSize: '.85rem' }}>
          <label><input type="checkbox" checked={!(sections || []).length} onChange={onAllSections} /> All sections</label>
          {SECTION_LETTERS.map((sec) => (
            <label key={sec}><input type="checkbox" checked={(sections || []).includes(sec)} onChange={() => onSection(sec)} /> Section {sec}</label>
          ))}
        </div>
      )}
    </div>
  );
}

// Shared add/edit/delete screen for students and teachers.
export default function People({ kind, grades, singular }) {
  const flash = useFlash();
  const { data, loading, reload } = useFetch(`/admin/${kind}`);

  const [form, setForm] = useState(null);
  const [search, setSearch] = useState('');
  const [gradeF, setGradeF] = useState('');
  const [sectionF, setSectionF] = useState('');

  const isStudent = kind === 'students';

  if (loading) return <Loading />;

  const all = data || [];

  const q = search.trim().toLowerCase();

  const rows = all.filter(
    (p) =>
      (!gradeF ||
        (isStudent
          ? p.grade === gradeF
          : [p.viewGrade, p.editGrade].some((g) => g === gradeF || g === 'ALL'))) &&
      (!sectionF || (p.section || '') === sectionF) &&
      (!q ||
        (p.name || '').toLowerCase().includes(q) ||
        (p.email || '').toLowerCase().includes(q) ||
        (p.username || '').toLowerCase().includes(q))
  );

  // Section choices: A-D plus any other section already present.
  const sectionOptions = [
    ...new Set([
      'A',
      'B',
      'C',
      'D',
      ...all.map((p) => p.section).filter(Boolean),
    ]),
  ].sort();

  const filtering = !!(search || gradeF || sectionF);

  const set = (key) => (e) => {
    setForm((current) => ({
      ...current,
      [key]: e.target.value,
    }));
  };

  const setAccessGrade = (which, grade) => setForm((cur) => ({ ...cur, [`${which}Grade`]: grade, [`${which}Sections`]: [] }));
  const toggleAccessSection = (which, sec) => setForm((cur) => {
    const list = cur[`${which}Sections`] || [];
    return { ...cur, [`${which}Sections`]: list.includes(sec) ? list.filter((x) => x !== sec) : [...list, sec] };
  });
  const allAccessSections = (which) => setForm((cur) => ({ ...cur, [`${which}Sections`]: [] }));

  // Open the Add form.
  const openAddForm = () => {
    if (isStudent) {
      setForm({
        grade: grades[0] || '',
        section: 'A',
        email: '',
      });
    } else {
      // New teachers start with NO access point selected.
      setForm({ viewGrade: '', viewSections: [], editGrade: '', editSections: [], email: '' });
    }
  };

  // The server still needs a username and a password. The email address is the username, and the password is
  // random and never shown: give people theirs with the Reset password button.
  const randomPassword = () => {
    const a = new Uint8Array(12);
    crypto.getRandomValues(a);
    return Array.from(a, (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 16) + 'Aa1!';
  };

  // Save person.
  const save = async (e) => {
    e.preventDefault();

    try {
      if (form.id) {
        await api.put(`/admin/${kind}/${form.id}`, form);
      } else {
        const email = (form.email || '').trim().toLowerCase();
        await api.post(`/admin/${kind}`, { ...form, email, username: email, password: randomPassword() });
      }

      flash(
        form.id
          ? `${singular} updated.`
          : `${singular} ${form.name} added successfully.`
      );

      setForm(null);
      reload();
    } catch (err) {
      flash(err.message, 'error');
    }
  };

  // Delete person.
  const remove = async (person) => {
    if (
      !window.confirm(
        `Remove ${person.name}? Their results are deleted too.`
      )
    ) {
      return;
    }

    try {
      await api.del(`/admin/${kind}/${person.id}`);

      flash(`${singular} removed.`);
      reload();
    } catch (err) {
      flash(err.message, 'error');
    }
  };

  return (
    <>
      {/* =========================
          HEADER
      ========================== */}
      <div className="sec-header">
        <div>
          <div className="sec-title">
            {isStudent ? 'Students' : 'Teachers'}
          </div>

          <div className="sec-sub">
            {filtering
              ? `${rows.length} of ${all.length} shown`
              : `${all.length} total`}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          {/* Email import */}
          <Link
            to="/admin/emails"
            className="btn btn-secondary"
          >
            Import emails
          </Link>

          {/* Student-only actions */}
          {isStudent && (
            <>
              <Link
                to="/admin/students/upload"
                className="btn btn-secondary"
              >
                Bulk upload
              </Link>

              <button
                className="btn btn-secondary"
                onClick={() =>
                  downloadCsv('student_credentials.csv', [
                    [
                      'Name',
                      'Grade',
                      'Section',
                      'Username',
                    ],
                    ...rows.map((p) => [
                      p.name,
                      p.grade,
                      p.section,
                      p.username,
                    ]),
                  ])
                }
              >
                Download list
              </button>
            </>
          )}

          {/* Add */}
          <button
            className="btn btn-primary"
            onClick={openAddForm}
          >
            + Add {singular}
          </button>
        </div>
      </div>

      {/* =========================
          FILTERS
      ========================== */}
      <div
        className="card"
        style={{ marginBottom: 12 }}
      >
        <div
          style={{
            display: 'flex',
            gap: 10,
            flexWrap: 'wrap',
            alignItems: 'flex-end',
          }}
        >
          {/* Search */}
          <div
            style={{
              flex: 1,
              minWidth: 200,
            }}
          >
            <label
              className="form-label"
              htmlFor="flt-search"
            >
              Search
            </label>

            <input
              id="flt-search"
              className="form-input"
              placeholder="Name or email…"
              value={search}
              onChange={(e) =>
                setSearch(e.target.value)
              }
            />
          </div>

          {/* Grade filter */}
          <div style={{ minWidth: 150 }}>
            <label
              className="form-label"
              htmlFor="flt-grade"
            >
              {isStudent
                ? 'Grade'
                : 'Assigned grade'}
            </label>

            <select
              id="flt-grade"
              className="form-input"
              value={gradeF}
              onChange={(e) =>
                setGradeF(e.target.value)
              }
            >
              <option value="">
                All grades
              </option>

              {grades.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>

          {/* Section filter - students only */}
          {isStudent && (
            <div style={{ minWidth: 150 }}>
              <label
                className="form-label"
                htmlFor="flt-section"
              >
                Section
              </label>

              <select
                id="flt-section"
                className="form-input"
                value={sectionF}
                onChange={(e) =>
                  setSectionF(e.target.value)
                }
              >
                <option value="">
                  All sections
                </option>

                {sectionOptions.map((section) => (
                  <option
                    key={section}
                    value={section}
                  >
                    {section}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Clear filters */}
          {filtering && (
            <button
              className="btn btn-secondary"
              onClick={() => {
                setSearch('');
                setGradeF('');
                setSectionF('');
              }}
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* =========================
          PEOPLE TABLE
      ========================== */}
      <div className="card">
        {rows.length === 0 ? (
          <Empty>
            {filtering
              ? `No ${kind} match these filters.`
              : `No ${kind} yet. Add one to get started.`}
          </Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>

                  <th>
                    {isStudent
                      ? 'Grade'
                      : 'Access'}
                  </th>

                  {isStudent && (
                    <th>Section</th>
                  )}

                  <th />
                </tr>
              </thead>

              <tbody>
                {rows.map((p) => (
                  <tr key={p.id}>
                    <td
                      style={{
                        fontWeight: 500,
                      }}
                    >
                      {p.name}
                    </td>

                    <td
                      style={{
                        color: 'var(--ink3)',
                        fontSize: '.8rem',
                      }}
                    >
                      {p.email || (
                        <span
                          title="No email: this person cannot get reset codes"
                        >
                          — none
                        </span>
                      )}
                    </td>

                    <td>
                      {isStudent ? (
                        <Badge tone="purple">{p.grade}</Badge>
                      ) : p.accessText ? (
                        <span style={{ fontSize: '.8rem' }}>{p.accessText}</span>
                      ) : (
                        <Badge tone="gray">No access</Badge>
                      )}
                    </td>

                    {isStudent && (
                      <td>
                        {p.section || '—'}
                      </td>
                    )}

                    <td
                      style={{
                        textAlign: 'right',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <ResetPasswordButton
                        person={p}
                      />{' '}

                      <button
                        className="btn btn-secondary btn-xs"
                        onClick={() =>
                          setForm({ ...p })
                        }
                      >
                        Edit
                      </button>{' '}

                      <button
                        className="btn btn-danger btn-xs"
                        onClick={() =>
                          remove(p)
                        }
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* =========================
          ADD / EDIT MODAL
      ========================== */}
      {form && (
        <Modal
          title={
            form.id
              ? `Edit ${singular}`
              : `Add ${singular}`
          }
          onClose={() => setForm(null)}
        >
          <form onSubmit={save}>
            {/* Full name */}
            <Field label="Full name">
              <input
                className="form-input"
                required
                value={form.name || ''}
                onChange={set('name')}
              />
            </Field>

            {/* =========================
                STUDENT FIELDS
            ========================== */}
            {isStudent ? (
              <div className="form-row">
                <Field label="Grade">
                  <select
                    className="form-input"
                    required
                    value={form.grade || ''}
                    onChange={set('grade')}
                  >
                    {grades.map((g) => (
                      <option
                        key={g}
                        value={g}
                      >
                        {g}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Section">
                  <input
                    className="form-input"
                    maxLength={2}
                    value={form.section || ''}
                    onChange={set('section')}
                  />
                </Field>
              </div>
            ) : (
              /* =========================
                  TEACHER ACCESS POINT
              ========================== */
              <div style={{ marginTop: 6, marginBottom: 16 }}>
                <div style={{ fontWeight: 600, fontSize: '.9rem', color: '#1e293b', marginBottom: 4 }}>
                  Access Point
                </div>
                <div style={{ fontSize: '.75rem', color: '#64748b', marginBottom: 10 }}>
                  Choose one grade (or "All grades") and tick the sections. "No grade" means no access.
                  Whatever a teacher may edit, they can also view.
                </div>

                <AccessBlock
                  title="Viewing"
                  grade={form.viewGrade}
                  sections={form.viewSections}
                  grades={grades}
                  onGrade={(g) => setAccessGrade('view', g)}
                  onSection={(x) => toggleAccessSection('view', x)}
                  onAllSections={() => allAccessSections('view')}
                />

                <AccessBlock
                  title="Editing"
                  grade={form.editGrade}
                  sections={form.editSections}
                  grades={grades}
                  onGrade={(g) => setAccessGrade('edit', g)}
                  onSection={(x) => toggleAccessSection('edit', x)}
                  onAllSections={() => allAccessSections('edit')}
                />
              </div>
            )}

            {/* =========================
                EMAIL (this is also the login)
            ========================== */}
            <Field label="Email">
              <input
                className="form-input"
                type="email"
                required
                placeholder="Enter official email id (@e-p-s.in)"
                pattern="[A-Za-z0-9._%+\-]+@e-p-s\.in"
                title="Enter the official email id ending with @e-p-s.in"
                value={form.email || ''}
                onChange={set('email')}
              />
            </Field>

            {/* =========================
                FORM BUTTONS
            ========================== */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 8,
              }}
            >
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setForm(null)}
              >
                Cancel
              </button>

              <button className="btn btn-primary">
                Save {singular.toLowerCase()}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
