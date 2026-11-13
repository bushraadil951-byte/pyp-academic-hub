import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer, Legend } from 'recharts';
import { api } from '../../api.js';
import { useFlash } from '../../flash.jsx';
import { Loading } from '../../components/ui.jsx';
import { RatingPicker, RatingPill, Tabs, useProfileConfig } from './shared.jsx';

export default function StudentIb() {
  const flash = useFlash();
  const { data: cfg } = useProfileConfig();
  const [sp, setSp] = useSearchParams();
  const [d, setD] = useState(null);
  const [ratings, setRatings] = useState({});
  const [refl, setRefl] = useState({});
  const [atl, setAtl] = useState({});          // { skill: [rating|''] }
  const [tab, setTab] = useState('lp');
  const [saving, setSaving] = useState(false);
  const term = sp.get('term') || cfg?.terms[0] || '';

  const load = (t) => api.get(`/profile/student/ib?term=${encodeURIComponent(t)}`).then((x) => {
    setD(x);
    setRatings(x.selfRatings); setRefl(x.reflections);
    setAtl(Object.fromEntries(Object.entries(x.atl).map(([k, list]) => [k, list.map((i) => i.self ?? '')])));
  }).catch((e) => flash(e.message, 'error'));
  useEffect(() => { if (cfg) { setD(null); load(term); } /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [cfg, term]);

  if (!cfg || !d) return <Loading />;
  const saveLp = async () => {
    setSaving(true);
    try { await api.put('/profile/student/ib', { term, ratings, reflections: refl }); flash('Your self-assessment has been saved!'); await load(term); }
    catch (e) { flash(e.message, 'error'); } finally { setSaving(false); }
  };
  const saveAtl = async () => {
    setSaving(true);
    try { const r = await api.put('/profile/student/atl', { term, ratings: atl }); flash(`ATL self-assessment saved (${r.saved}).`); await load(term); }
    catch (e) { flash(e.message, 'error'); } finally { setSaving(false); }
  };
  const radar = d.radar.attributes.map((a, i) => ({ attribute: a, Me: d.radar.self[i], Teacher: d.radar.teacher[i] }));

  return (
    <>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="form-group" style={{ maxWidth: 240, marginBottom: 0 }}>
          <label className="form-label">Unit of Inquiry</label>
          <select className="form-input" value={term} onChange={(e) => { const n = new URLSearchParams(sp); n.set('term', e.target.value); setSp(n, { replace: true }); }}>
            {cfg.terms.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title">My growth across all UOIs (average, 1–4)</div>
        <ResponsiveContainer width="100%" height={280}>
          <RadarChart data={radar} outerRadius="70%"><PolarGrid /><PolarAngleAxis dataKey="attribute" tick={{ fontSize: 11 }} />
            <Radar name="Me" dataKey="Me" stroke="#10b981" fill="#10b981" fillOpacity={0.3} />
            <Radar name="Teacher" dataKey="Teacher" stroke="#6366f1" fill="#6366f1" fillOpacity={0.2} /><Legend /></RadarChart>
        </ResponsiveContainer>
      </div>
      <div className="tab-bar">
        <button className={`tab-btn ${tab === 'lp' ? 'active' : ''}`} onClick={() => setTab('lp')}>Learner Profile</button>
        <button className={`tab-btn ${tab === 'atl' ? 'active' : ''}`} onClick={() => setTab('atl')}>ATL skills</button>
      </div>

      {tab === 'lp' ? (
        <>
          {cfg.learnerProfile.map((a) => (
            <div className="card" key={a.attribute} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ fontWeight: 700 }}>{a.emoji} {a.attribute}</div>
                {d.teacherRatings[a.attribute] && <span className="sec-sub">Teacher: <RatingPill cfg={cfg} value={d.teacherRatings[a.attribute]} /></span>}
              </div>
              <div className="sec-sub" style={{ margin: '2px 0 10px' }}>{a.description}</div>
              {d.teacherEvidence[a.attribute] && <div className="alert alert-success" style={{ fontSize: '.78rem' }}>Teacher comment: {d.teacherEvidence[a.attribute]}</div>}
              <RatingPicker cfg={cfg} name={`${a.attribute} self rating`} value={ratings[a.attribute]} onChange={(v) => setRatings({ ...ratings, [a.attribute]: v })} />
              <textarea className="form-input" rows={2} style={{ marginTop: 10 }} maxLength={4000} placeholder="Write a reflection: when did you show this attribute?" aria-label={`${a.attribute} reflection`}
                value={refl[a.attribute] || ''} onChange={(e) => setRefl({ ...refl, [a.attribute]: e.target.value })} />
            </div>))}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button className="btn btn-primary" onClick={saveLp} disabled={saving}>{saving ? 'Saving…' : 'Save self-assessment'}</button></div>
        </>
      ) : (
        <>
          {Object.entries(d.atl).map(([skill, list]) => (
            <div className="card" key={skill} style={{ marginBottom: 12 }}>
              <div className="card-title">{skill}</div>
              {list.map((x, i) => (
                <div key={x.descriptor} style={{ padding: '10px 0', borderBottom: '1px solid var(--surface2)' }}>
                  <div style={{ fontSize: '.85rem', marginBottom: 8 }}>{x.descriptor} {x.teacher && <span className="sec-sub">· Teacher: <RatingPill cfg={cfg} value={x.teacher} /></span>}</div>
                  <RatingPicker cfg={cfg} name={x.descriptor} value={atl[skill]?.[i]} onChange={(v) => setAtl((s) => ({ ...s, [skill]: s[skill].map((o, j) => (j === i ? v : o)) }))} />
                </div>))}
            </div>))}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button className="btn btn-primary" onClick={saveAtl} disabled={saving}>{saving ? 'Saving…' : 'Save ATL self-assessment'}</button></div>
        </>
      )}
    </>
  );
}
