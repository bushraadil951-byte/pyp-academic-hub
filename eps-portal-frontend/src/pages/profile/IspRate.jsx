import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../api.js';
import { useFlash } from '../../flash.jsx';
import { Empty, Loading } from '../../components/ui.jsx';
import { ISP_TABS, RatingPicker, RatingPill, StudentPicker, Tabs, useProfileConfig } from './shared.jsx';
import { useStaffStudents } from './useStaffStudents.js';

export default function IspRate() {
  const flash = useFlash();
  const { data: cfg } = useProfileConfig();
  const [sp, setSp] = useSearchParams();
  const [grade, setGrade] = useState('');
  const [section, setSection] = useState('');
  const [d, setD] = useState(null);
  const [ratings, setRatings] = useState({});
  const [saving, setSaving] = useState(false);
  const studentId = sp.get('studentId') || '';
  const g = cfg ? (cfg.gradeLocked ? cfg.grades[0] : grade || cfg.grades[0]) : '';
  const students = useStaffStudents('isp', g, section);

  useEffect(() => {
    if (!studentId) { setD(null); return undefined; }
    let live = true; setD(null);
    api.get(`/profile/isp/rate?studentId=${studentId}`).then((x) => { if (live) { setD(x); setRatings(x.ratings); } }).catch((e) => flash(e.message, 'error'));
    return () => { live = false; };
  }, [studentId, flash]);

  if (!cfg) return <Loading />;
  const save = async (e) => {
    e.preventDefault(); setSaving(true);
    try { const r = await api.put('/profile/isp/rate', { studentId, ratings }); flash(`ISP ratings saved for ${d.student.name} (${r.saved}).`); }
    catch (err) { flash(err.message, 'error'); } finally { setSaving(false); }
  };

  return (
    <>
      <Tabs items={ISP_TABS} />
      <StudentPicker cfg={cfg} grade={g} setGrade={setGrade} section={section} setSection={setSection} students={students} studentId={studentId}
        setStudentId={(v) => { const n = new URLSearchParams(sp); if (v) n.set('studentId', v); else n.delete('studentId'); setSp(n, { replace: true }); }} />
      {!studentId ? <div className="card"><Empty>Choose a student to rate their ISP attributes.</Empty></div> : !d ? <Loading /> : (
        <form onSubmit={save}>
          {cfg.ispProfile.map((a) => (
            <div className="card" key={a.attribute} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ fontWeight: 700 }}>{a.emoji} {a.attribute}</div>
                {d.selfRatings[a.attribute] && <span className="sec-sub">Self: <RatingPill cfg={cfg} value={d.selfRatings[a.attribute]} /></span>}
              </div>
              <ul className="sec-sub" style={{ margin: '4px 0 10px', paddingLeft: 18 }}>{a.descriptions.map((x) => <li key={x}>{x}</li>)}</ul>
              <RatingPicker cfg={cfg} name={`${a.attribute} rating`} value={ratings[a.attribute]} onChange={(v) => setRatings({ ...ratings, [a.attribute]: v })} />
              {d.reflections[a.attribute] && <div className="sec-sub" style={{ marginTop: 8 }}>Student reflection: “{d.reflections[a.attribute]}”</div>}
            </div>))}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save ISP ratings'}</button></div>
        </form>
      )}
    </>
  );
}
