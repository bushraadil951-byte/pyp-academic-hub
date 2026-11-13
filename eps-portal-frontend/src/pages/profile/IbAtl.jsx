import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../../api.js';
import { useFlash } from '../../flash.jsx';
import { Empty, Loading } from '../../components/ui.jsx';
import { IB_TABS, RatingPicker, StudentPicker, Tabs, useProfileConfig } from './shared.jsx';
import { useStaffStudents } from './useStaffStudents.js';

export default function IbAtl() {
  const flash = useFlash();
  const { data: cfg } = useProfileConfig();
  const [sp, setSp] = useSearchParams();
  const [grade, setGrade] = useState('');
  const [section, setSection] = useState('');
  const [data, setData] = useState(null);     // API payload
  const [vals, setVals] = useState({});       // { skill: [rating|'' ...] }
  const [skill, setSkill] = useState('');
  const [saving, setSaving] = useState(false);
  const studentId = sp.get('studentId') || '';
  const g = cfg ? (cfg.gradeLocked ? cfg.grades[0] : grade || cfg.grades[0]) : '';
  const students = useStaffStudents('ib', g, section);
  const t = sp.get('term') || cfg?.terms[0] || '';
  const setParam = (k, v) => { const n = new URLSearchParams(sp); if (v) n.set(k, v); else n.delete(k); setSp(n, { replace: true }); };

  useEffect(() => {
    if (!cfg || !studentId) { setData(null); return undefined; }
    let live = true; setData(null);
    api.get(`/profile/ib/atl?${new URLSearchParams({ studentId, term: t })}`).then((d) => {
      if (!live) return;
      setData(d);
      setVals(Object.fromEntries(Object.entries(d.skills).map(([k, list]) => [k, list.map((x) => x.rating ?? '')])));
      setSkill((s) => s || Object.keys(d.skills)[0]);
    }).catch((e) => flash(e.message, 'error'));
    return () => { live = false; };
  }, [cfg, studentId, t, flash]);

  if (!cfg) return <Loading />;
  const save = async () => {
    setSaving(true);
    try { const r = await api.put('/profile/ib/atl', { studentId, term: t, skill, ratings: vals[skill] }); flash(`ATL ${skill} saved (${r.saved} descriptor${r.saved === 1 ? '' : 's'}) for ${t}.`); }
    catch (err) { flash(err.message, 'error'); } finally { setSaving(false); }
  };

  return (
    <>
      <Tabs items={IB_TABS} />
      <StudentPicker cfg={cfg} grade={g} setGrade={setGrade} section={section} setSection={setSection} students={students} studentId={studentId} setStudentId={(v) => setParam('studentId', v)}
        extra={<div className="form-group"><label className="form-label">UOI</label><select className="form-input" value={t} onChange={(e) => setParam('term', e.target.value)}>{cfg.terms.map((x) => <option key={x}>{x}</option>)}</select></div>} />
      {!studentId ? <div className="card"><Empty>Choose a student to rate their ATL skills.</Empty></div> : !data ? <Loading /> : (
        <>
          <div className="tab-bar" style={{ flexWrap: 'wrap' }}>
            {Object.keys(data.skills).map((k) => <button key={k} type="button" className={`tab-btn ${k === skill ? 'active' : ''}`} onClick={() => setSkill(k)}>{k}</button>)}
          </div>
          <div className="card">
            <div className="sec-header"><div><div className="sec-title">{data.student.name} · {skill}</div><div className="sec-sub">{data.gradeUsed} descriptors · {t}. Click a selected level again to clear it.</div></div></div>
            {data.skills[skill].map((x, i) => (
              <div key={x.descriptor} style={{ padding: '12px 0', borderBottom: '1px solid var(--surface2)' }}>
                <div style={{ fontSize: '.88rem', marginBottom: 8 }}>{x.descriptor}</div>
                <RatingPicker cfg={cfg} name={x.descriptor} value={vals[skill]?.[i]} onChange={(v) => setVals((s) => ({ ...s, [skill]: s[skill].map((o, j) => (j === i ? v : o)) }))} />
                {data.legend[vals[skill]?.[i]] && <div className="sec-sub" style={{ marginTop: 6 }}>{data.legend[vals[skill][i]]}</div>}
              </div>))}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
              <Link to={`/ib/report/${studentId}`} className="btn btn-secondary">View report</Link>
              <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : `Save ${skill}`}</button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
