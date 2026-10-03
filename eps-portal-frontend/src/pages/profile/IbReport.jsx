import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer, Legend } from 'recharts';
import { useFetch } from '../../components/useFetch.js';
import { Empty, Loading, Percent, fmtDate } from '../../components/ui.jsx';
import { RatingPill, ScoreBar, useProfileConfig } from './shared.jsx';

export default function IbReport() {
  const { studentId } = useParams();
  const { data: cfg } = useProfileConfig();
  const { data: d, loading, error } = useFetch(`/profile/ib/report/${studentId}`);
  const [term, setTerm] = useState('');
  if (!cfg || loading) return <Loading />;
  if (error) return <div className="alert alert-error">{error.message}</div>;
  const filled = cfg.terms.filter((t) => Object.keys(d.report[t].lp).length || Object.keys(d.report[t].atl).length);
  const active = term || filled[filled.length - 1] || cfg.terms[0];
  const r = d.report[active];
  const radar = cfg.learnerProfile.map((a) => ({
    attribute: a.attribute,
    Teacher: r.lp[a.attribute]?.teacher ?? 0,
    Student: r.lp[a.attribute]?.student ?? 0,
  }));

  return (
    <>
      <div className="sec-header">
        <div><div className="sec-title">IB report · {d.student.name}</div><div className="sec-sub">{d.student.grade}{d.student.section ? ` · ${d.student.section}` : ''}</div></div>
        <Link to="/ib" className="btn btn-secondary btn-sm">Back to IB</Link>
      </div>
      {filled.length === 0 ? <div className="card"><Empty>No ratings recorded for this student yet.</Empty></div> : (
        <>
          <div className="tab-bar" style={{ flexWrap: 'wrap' }}>
            {cfg.terms.map((t) => <button key={t} className={`tab-btn ${t === active ? 'active' : ''}`} onClick={() => setTerm(t)}>{t}{filled.includes(t) ? '' : ' ·'}</button>)}
          </div>
          <div className="grid-2" style={{ marginBottom: 16 }}>
            <div className="card">
              <div className="card-title">Learner Profile · {active}</div>
              {Object.keys(r.lp).length === 0 ? <Empty>No Learner Profile ratings for {active}.</Empty> : (
                <>
                  <ResponsiveContainer width="100%" height={280}>
                    <RadarChart data={radar} outerRadius="70%">
                      <PolarGrid /><PolarAngleAxis dataKey="attribute" tick={{ fontSize: 11 }} />
                      <Radar name="Teacher" dataKey="Teacher" stroke="#6366f1" fill="#6366f1" fillOpacity={0.3} />
                      <Radar name="Student" dataKey="Student" stroke="#10b981" fill="#10b981" fillOpacity={0.2} /><Legend />
                    </RadarChart>
                  </ResponsiveContainer>
                  <div className="table-wrap"><table>
                    <thead><tr><th>Attribute</th><th>Teacher</th><th>Student</th><th>Evidence</th></tr></thead>
                    <tbody>{cfg.learnerProfile.filter((a) => r.lp[a.attribute]).map((a) => (
                      <tr key={a.attribute}><td>{a.emoji} {a.attribute}</td><td><RatingPill cfg={cfg} value={r.lp[a.attribute].teacher} /></td><td><RatingPill cfg={cfg} value={r.lp[a.attribute].student} /></td>
                        <td style={{ color: 'var(--ink3)', fontSize: '.78rem' }}>{r.lp[a.attribute].evidence || '—'}</td></tr>))}
                    </tbody>
                  </table></div>
                </>
              )}
            </div>
            <div className="card">
              <div className="card-title">ATL skills · {active}</div>
              {Object.keys(r.atl).length === 0 ? <Empty>No ATL ratings for {active}.</Empty> : Object.entries(r.atl).map(([skill, v]) => (
                <div key={skill} style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.85rem' }}><strong>{skill}</strong><span>Teacher {v.avg || '—'}{v.selfAvg !== null && ` · Self ${v.selfAvg}`}</span></div>
                  <ScoreBar value={v.avg} />
                  {v.selfAvg !== null && <div style={{ marginTop: 3 }}><ScoreBar value={v.selfAvg} color="#10b981" /></div>}
                </div>))}
              <div className="sec-sub">Averages on the 1–4 scale (1 Beginning · 4 Exceeding). Green bar = student self-assessment.</div>
            </div>
          </div>
          <div className="card">
            <div className="card-title">Mock test results</div>
            {d.testResults.length === 0 ? <Empty>No mock tests taken.</Empty> : (
              <div className="table-wrap"><table>
                <thead><tr><th>Test</th><th>Subject</th><th>Score</th><th>Date</th></tr></thead>
                <tbody>{d.testResults.map((x) => <tr key={x.id}><td>{x.test}</td><td>{x.subject}</td><td><Percent value={x.percent} /></td><td>{fmtDate(x.takenAt)}</td></tr>)}</tbody>
              </table></div>
            )}
          </div>
        </>
      )}
    </>
  );
}
