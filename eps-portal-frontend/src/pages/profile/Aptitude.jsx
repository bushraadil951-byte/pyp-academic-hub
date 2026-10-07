import { useState } from 'react';
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip } from 'recharts';
import { useFetch } from '../../components/useFetch.js';
import { Empty, Loading } from '../../components/ui.jsx';

// 75+ Strong, 50+ Developing, below 50 Needs focus (same bands as the Flask template).
export const band = (s) => (s === null || s === undefined ? { label: 'No data', color: '#94a3b8', bg: '#f1f5f9' }
  : s >= 75 ? { label: 'Strong', color: '#059669', bg: '#d1fae5' }
    : s >= 50 ? { label: 'Developing', color: '#d97706', bg: '#fef3c7' } : { label: 'Needs focus', color: '#dc2626', bg: '#fee2e2' });

const Cell = ({ v }) => { const b = band(v); return <td style={{ background: b.bg, color: b.color, fontWeight: 700, textAlign: 'center' }}>{v === null ? '—' : `${v}%`}</td>; };

// ── Teacher / admin: class heatmap, per-strand ranking, single-student radar ──
export function AptitudeStaff() {
  const [grade, setGrade] = useState('');
  const [section, setSection] = useState('');
  const [studentId, setStudentId] = useState('');
  const [strand, setStrand] = useState('');
  const { data: cfg } = useFetch('/profile/config');
  const { data: d, loading, error } = useFetch(`/profile/aptitude?${new URLSearchParams({ grade, section })}`);
  if (!cfg || loading) return <Loading />;
  if (error) return <div className="alert alert-error">{error.message}</div>;
  const active = strand || d.strands[0];
  const ranked = [...d.students].filter((s) => s.aptitude[active].score !== null).sort((a, b) => b.aptitude[active].score - a.aptitude[active].score);
  const sel = d.students.find((s) => s.id === studentId);

  return (
    <>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="form-row-3" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
          <div className="form-group"><label className="form-label">Grade</label>
            <select className="form-input" value={d.grade} disabled={cfg.gradeLocked} onChange={(e) => { setGrade(e.target.value); setStudentId(''); }}>{cfg.grades.map((g) => <option key={g}>{g}</option>)}</select></div>
          <div className="form-group"><label className="form-label">Section</label>
            <select className="form-input" value={section} onChange={(e) => { setSection(e.target.value); setStudentId(''); }}><option value="">All sections</option>{cfg.sections.map((s) => <option key={s}>{s}</option>)}</select></div>
          <div className="form-group"><label className="form-label">Student (radar)</label>
            <select className="form-input" value={studentId} onChange={(e) => setStudentId(e.target.value)}><option value="">Whole class</option>{d.students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
        </div>
        <div className="sec-sub">Academic year {d.academicYear}. Strand scores blend FA, DT and SA marks using fixed weights; a strand with only some assessment types uses just those.</div>
      </div>

      {d.students.length === 0 ? <div className="card"><Empty>No students in {d.grade}{section ? ` section ${section}` : ''}.</Empty></div> : (
        <>
{sel && (
            <div className="card" style={{ marginBottom: 16, borderRadius: 16, background: '#ffffff', boxShadow: '0 4px 20px -2px rgba(99, 102, 241, 0.08)' }}>
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '1.05rem', fontWeight: 700, color: '#1e293b' }}>
                <span style={{ fontSize: '1.3rem' }}>🎯</span> {sel.name} · Aptitude Profile
              </div>
              <ResponsiveContainer width="100%" height={340}>
                <RadarChart data={d.strands.map((s) => ({ strand: s, score: sel.aptitude[s].score ?? 0 }))} outerRadius="72%">
                  <defs>
                    <radialGradient id="staffRadarGrad" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="#818cf8" stopOpacity={0.7} />
                      <stop offset="100%" stopColor="#4f46e5" stopOpacity={0.25} />
                    </radialGradient>
                  </defs>
                  <PolarGrid stroke="#cbd5e1" strokeDasharray="4 4" />
                  <PolarAngleAxis dataKey="strand" tick={{ fill: '#334155', fontSize: 12, fontWeight: 600 }} />
                  <PolarRadiusAxis domain={[0, 100]} angle={30} tick={{ fill: '#94a3b8', fontSize: 10 }} stroke="#e2e8f0" />
                  <Tooltip
                    content={({ active: act, payload }) => {
                      if (!act || !payload || !payload.length) return null;
                      const val = payload[0].value;
                      const b = band(val);
                      return (
                        <div style={{ background: '#0f172a', color: '#fff', padding: '8px 14px', borderRadius: 10, fontSize: '.8rem', boxShadow: '0 8px 16px rgba(0,0,0,0.2)' }}>
                          <div style={{ fontWeight: 600, marginBottom: 2 }}>{payload[0].payload.strand}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: '1rem', fontWeight: 700, color: '#818cf8' }}>{val}%</span>
                            <span style={{ background: b.bg, color: b.color, padding: '1px 6px', borderRadius: 4, fontSize: '.7rem', fontWeight: 600 }}>{b.label}</span>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Radar
                    name="Score"
                    dataKey="score"
                    stroke="#4f46e5"
                    strokeWidth={2.5}
                    fill="url(#staffRadarGrad)"
                    dot={{ r: 4, fill: '#4f46e5', stroke: '#ffffff', strokeWidth: 2 }}
                    activeDot={{ r: 7, fill: '#6366f1', stroke: '#ffffff', strokeWidth: 3 }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-title">Class heatmap · {d.students.length} students</div>
            <div className="table-wrap"><table>
              <thead><tr><th>Student</th>{d.strands.map((s) => <th key={s} style={{ textAlign: 'center' }}>{s}</th>)}</tr></thead>
              <tbody>
                <tr style={{ fontWeight: 700, background: 'var(--surface2)' }}><td>Class average</td>{d.strands.map((s) => <Cell key={s} v={d.classAvg[s]} />)}</tr>
                {d.students.map((s) => <tr key={s.id}><td style={{ fontWeight: 500 }}>{s.name}</td>{d.strands.map((st) => <Cell key={st} v={s.aptitude[st].score} />)}</tr>)}
              </tbody>
            </table></div>
            <div style={{ display: 'flex', gap: 14, marginTop: 10, fontSize: '.75rem' }}>
              {['Strong', 'Developing', 'Needs focus'].map((l, i) => { const b = band([80, 60, 20][i]); return <span key={l} style={{ background: b.bg, color: b.color, padding: '2px 8px', borderRadius: 6, fontWeight: 600 }}>{l} {['75+', '50–74', '<50'][i]}</span>; })}
            </div>
          </div>
          <div className="card">
            <div className="sec-header"><div className="sec-title">Ranking</div>
              <select className="form-input" style={{ width: 240 }} value={active} onChange={(e) => setStrand(e.target.value)} aria-label="Strand">{d.strands.map((s) => <option key={s}>{s}</option>)}</select></div>
            {ranked.length === 0 ? <Empty>No marks recorded for {active} yet.</Empty> : (
              <div className="table-wrap"><table>
                <thead><tr><th>#</th><th>Student</th><th>FA</th><th>DT</th><th>SA</th><th style={{ textAlign: 'center' }}>{active}</th></tr></thead>
                <tbody>{ranked.map((s, i) => { const a = s.aptitude[active]; return (
                  <tr key={s.id}><td>{i + 1}</td><td style={{ fontWeight: 500 }}>{s.name}</td>
                    <td>{a.faScore ?? '—'}</td><td>{a.dtScore ?? '—'}</td><td>{a.saScore ?? '—'}</td><Cell v={a.score} /></tr>); })}
                </tbody>
              </table></div>
            )}
          </div>
        </>
      )}
    </>
  );
}

// ── Student: own aptitude strands ────────────────────────────────────────────
export function AptitudeStudent() {
  const { data: d, loading, error } = useFetch('/profile/student/aptitude');
  if (loading) return <Loading />;
  if (error) return <div className="alert alert-error">{error.message}</div>;
  const any = d.strands.some((s) => d.aptitude[s].hasData);
  const w = (s, k) => Math.round(d.weights[s][k] * 100);
  return (
    <>
      <div className="sec-header"><div><div className="sec-title">My aptitude profile</div><div className="sec-sub">{d.student.grade} · {d.academicYear}. Built from your FA, DT and SA marks.</div></div></div>
      {!any ? <div className="card"><Empty>No marks have been recorded for you yet, so there are no aptitude scores.</Empty></div> : (
        <>
<div className="card" style={{ marginBottom: 16, borderRadius: 16, background: '#ffffff', boxShadow: '0 4px 20px -2px rgba(16, 185, 129, 0.08)' }}>
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '1.05rem', fontWeight: 700, color: '#1e293b' }}>
              <span style={{ fontSize: '1.3rem' }}>🌟</span> Aptitude Overview
            </div>
            <ResponsiveContainer width="100%" height={340}>
              <RadarChart data={d.strands.map((s) => ({ strand: s, score: d.aptitude[s].score ?? 0 }))} outerRadius="72%">
                <defs>
                  <radialGradient id="studentRadarGrad" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#34d399" stopOpacity={0.7} />
                    <stop offset="100%" stopColor="#059669" stopOpacity={0.25} />
                  </radialGradient>
                </defs>
                <PolarGrid stroke="#cbd5e1" strokeDasharray="4 4" />
                <PolarAngleAxis dataKey="strand" tick={{ fill: '#334155', fontSize: 12, fontWeight: 600 }} />
                <PolarRadiusAxis domain={[0, 100]} angle={30} tick={{ fill: '#94a3b8', fontSize: 10 }} stroke="#e2e8f0" />
                <Tooltip
                  content={({ active: act, payload }) => {
                    if (!act || !payload || !payload.length) return null;
                    const val = payload[0].value;
                    const b = band(val);
                    return (
                      <div style={{ background: '#0f172a', color: '#fff', padding: '8px 14px', borderRadius: 10, fontSize: '.8rem', boxShadow: '0 8px 16px rgba(0,0,0,0.2)' }}>
                        <div style={{ fontWeight: 600, marginBottom: 2 }}>{payload[0].payload.strand}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: '1rem', fontWeight: 700, color: '#34d399' }}>{val}%</span>
                          <span style={{ background: b.bg, color: b.color, padding: '1px 6px', borderRadius: 4, fontSize: '.7rem', fontWeight: 600 }}>{b.label}</span>
                        </div>
                      </div>
                    );
                  }}
                />
                <Radar
                  name="Score"
                  dataKey="score"
                  stroke="#059669"
                  strokeWidth={2.5}
                  fill="url(#studentRadarGrad)"
                  dot={{ r: 4, fill: '#059669', stroke: '#ffffff', strokeWidth: 2 }}
                  activeDot={{ r: 7, fill: '#10b981', stroke: '#ffffff', strokeWidth: 3 }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <div className="grid-2">
            {d.strands.map((s) => { const a = d.aptitude[s]; const b = band(a.score); return (
              <div className="card" key={s}>
                <div className="sec-header"><div className="sec-title">{s}</div><span className="badge" style={{ background: b.bg, color: b.color, fontWeight: 700 }}>{b.label}</span></div>
                <div className="stat-value" style={{ color: b.color }}>{a.score === null ? '—' : `${a.score}%`}</div>
                {a.hasData ? [['FA', a.faScore, 'weightFa', '#6366f1'], ['DT', a.dtScore, 'weightDt', '#10b981'], ['SA', a.saScore, 'weightSa', '#f59e0b']].filter(([, , k]) => w(s, k) > 0).map(([label, v, k, c]) => (
                  <div key={label} style={{ marginTop: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.78rem' }}><span>{label} <span style={{ color: 'var(--ink3)' }}>({w(s, k)}% weight)</span></span><strong>{v === null ? '—' : `${v}%`}</strong></div>
                    <div className="progress" style={{ height: 8 }}><div className="progress-fill" style={{ width: `${v || 0}%`, background: c }} /></div>
                  </div>)) : <div className="sec-sub" style={{ marginTop: 8 }}>No marks yet for {d.weights[s].subjects.join(', ')}.</div>}
              </div>); })}
          </div>
        </>
      )}
    </>
  );
}
