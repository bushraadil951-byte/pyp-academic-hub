import { useEffect, useState } from 'react';
import { api } from '../../api.js';
import { useFlash } from '../../flash.jsx';
import { Loading } from '../../components/ui.jsx';
import { RatingPicker, RatingPill, useProfileConfig } from './shared.jsx';

export default function StudentIsp() {
  const flash = useFlash();
  const { data: cfg } = useProfileConfig();
  const [d, setD] = useState(null);
  const [ratings, setRatings] = useState({});
  const [refl, setRefl] = useState({});
  const [saving, setSaving] = useState(false);
  const load = () => api.get('/profile/student/isp').then((x) => { setD(x); setRatings(x.selfRatings); setRefl(x.reflections); }).catch((e) => flash(e.message, 'error'));
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  if (!cfg || !d) return <Loading />;
  const save = async (e) => {
    e.preventDefault(); setSaving(true);
    try { await api.put('/profile/student/isp', { ratings, reflections: refl }); flash('Your ISP self-assessment has been saved!'); await load(); }
    catch (err) { flash(err.message, 'error'); } finally { setSaving(false); }
  };
  return (
    <form onSubmit={save}>
      <div className="sec-header"><div><div className="sec-title">My ISP profile</div><div className="sec-sub">Rate yourself honestly and write what you did to show each attribute. A reflection is saved together with its rating.</div></div></div>
      {cfg.ispProfile.map((a) => (
        <div className="card" key={a.attribute} style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ fontWeight: 700 }}>{a.emoji} {a.attribute}</div>
            {d.teacherRatings[a.attribute] && <span className="sec-sub">Teacher: <RatingPill cfg={cfg} value={d.teacherRatings[a.attribute]} /></span>}
          </div>
          <ul className="sec-sub" style={{ margin: '4px 0 10px', paddingLeft: 18 }}>{a.descriptions.map((x) => <li key={x}>{x}</li>)}</ul>
          <RatingPicker cfg={cfg} name={`${a.attribute} self rating`} value={ratings[a.attribute]} onChange={(v) => setRatings({ ...ratings, [a.attribute]: v })} />
          <textarea className="form-input" rows={2} style={{ marginTop: 10 }} maxLength={4000} placeholder="Reflection (optional)" aria-label={`${a.attribute} reflection`}
            value={refl[a.attribute] || ''} onChange={(e) => setRefl({ ...refl, [a.attribute]: e.target.value })} />
        </div>))}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save self-assessment'}</button></div>
    </form>
  );
}
