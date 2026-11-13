import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../../api.js';
import { useFlash } from '../../flash.jsx';
import { Empty, Loading } from '../../components/ui.jsx';
import { IB_TABS, RatingPicker, StudentPicker, Tabs, useProfileConfig } from './shared.jsx';
import { useStaffStudents } from './useStaffStudents.js';

export default function IbLearnerProfile() {
  const flash = useFlash();
  const { data: cfg } = useProfileConfig();
  const [sp, setSp] = useSearchParams();
  const [grade, setGrade] = useState('');
  const [section, setSection] = useState('');
  const studentId = sp.get('studentId') || '';
  const term = sp.get('term') || '';
  const [form, setForm] = useState(null);   // { attr: { rating, evidence } }
  const [saving, setSaving] = useState(false);
  const g = cfg ? (cfg.gradeLocked ? cfg.grades[0] : grade || cfg.grades[0]) : '';
  const students = useStaffStudents('ib', g, section);
  const setParam = (k, v) => { const n = new URLSearchParams(sp); if (v) n.set(k, v); else n.delete(k); setSp(n, { replace: true }); };
  const t = term || cfg?.terms[0] || '';

  useEffect(() => {
    if (!cfg || !studentId) { setForm(null); return undefined; }
    let live = true; setForm(null);
    api.get(`/profile/ib/lp?${new URLSearchParams({ studentId, term: t })}`).then((d) => live && setForm(Object.fromEntries(cfg.learnerProfile.map((a) => [a.attribute, { rating: d.ratings[a.attribute]?.rating ?? '', evidence: d.ratings[a.attribute]?.evidence ?? '' }])))).catch((e) => flash(e.message, 'error'));
    return () => { live = false; };
  }, [cfg, studentId, t, flash]);

  if (!cfg) return <Loading />;
  const set = (attr, patch) => setForm((f) => ({ ...f, [attr]: { ...f[attr], ...patch } }));
  const save = async (e) => {
    e.preventDefault(); setSaving(true);
    try { const r = await api.put('/profile/ib/lp', { studentId, term: t, ratings: form }); flash(`Learner Profile saved (${r.saved} attribute${r.saved === 1 ? '' : 's'}) for ${t}.`); }
    catch (err) { flash(err.message, 'error'); } finally { setSaving(false); }
  };

  return (
    <>
      <Tabs items={IB_TABS} />
      <StudentPicker cfg={cfg} grade={g} setGrade={setGrade} section={section} setSection={setSection} students={students} studentId={studentId} setStudentId={(v) => setParam('studentId', v)}
        extra={<div className="form-group"><label className="form-label">UOI</label><select className="form-input" value={t} onChange={(e) => setParam('term', e.target.value)}>{cfg.terms.map((x) => <option key={x}>{x}</option>)}</select></div>} />
      {!studentId ? <div className="card"><Empty>Choose a student to rate their Learner Profile attributes.</Empty></div> : !form ? <Loading /> : (
        <form onSubmit={save}>
          {cfg.learnerProfile.map((a) => (
            <div className="card" key={a.attribute} style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 700 }}>{a.emoji} {a.attribute}</div>
              <div className="sec-sub" style={{ margin: '2px 0 10px' }}>{a.description}</div>
              <RatingPicker cfg={cfg} name={`${a.attribute} rating`} value={form[a.attribute].rating} onChange={(v) => set(a.attribute, { rating: v })} />
              <input className="form-input" style={{ marginTop: 10 }} placeholder="Evidence or comment (optional)" maxLength={2000} aria-label={`${a.attribute} evidence`}
                value={form[a.attribute].evidence} onChange={(e) => set(a.attribute, { evidence: e.target.value })} />
            </div>))}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Link to={`/ib/report/${studentId}`} className="btn btn-secondary">View report</Link>
            <button className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : `Save ${t}`}</button>
          </div>
        </form>
      )}
    </>
  );
}
