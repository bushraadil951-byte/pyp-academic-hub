import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api.js';
import { useFlash } from '../../flash.jsx';
import { useFetch } from '../../components/useFetch.js';
import { Loading, Percent } from '../../components/ui.jsx';

const L = ['A', 'B', 'C', 'D'];
const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

export default function StudentTest() {
  const { testId } = useParams();
  const nav = useNavigate();
  const flash = useFlash();
  const { data, loading, error } = useFetch(`/student/tests/${testId}`);
  const [answers, setAnswers] = useState({});      // { [questionId]: optionIndex }
  const [idx, setIdx] = useState(0);
  const [left, setLeft] = useState(null);           // seconds remaining
  const [result, setResult] = useState(null);
  const started = useRef(Date.now());
  const submitting = useRef(false);

  const submit = useCallback(async () => {
    if (submitting.current) return;
    submitting.current = true;
    try {
      const r = await api.post(`/student/tests/${testId}/submit`, { answers, time_taken: Math.round((Date.now() - started.current) / 1000) });
      setResult(r);
    } catch (e) { submitting.current = false; flash(e.message, 'error'); }
  }, [answers, testId, flash]);

  useEffect(() => { if (data) { started.current = Date.now(); setLeft(data.test.duration * 60); } }, [data]);
  useEffect(() => {
    if (left === null || result) return;
    if (left <= 0) { submit(); return; }
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [left, result, submit]);
  // warn before accidentally leaving mid-test
  useEffect(() => {
    if (!data || result) return;
    const h = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [data, result]);

  if (loading) return <Loading />;
  if (error) return <div className="page"><div className="alert alert-error">{error.message}</div><Link to="/student" className="btn btn-secondary">Back to dashboard</Link></div>;

  if (result) {
    return (
      <div className="page quiz-wrap" style={{ margin: '40px auto' }}>
        <div className="card" style={{ textAlign: 'center' }}>
          <div className="card-title">Test submitted</div>
          <div className="stat-value" style={{ marginBottom: 6 }}><Percent value={result.percent} /></div>
          <div className="sec-sub" style={{ marginBottom: 16 }}>{result.score} of {result.total} correct</div>
          {Object.entries(result.section_scores || {}).map(([sec, s]) => (
            <div key={sec} style={{ textAlign: 'left', marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.8rem' }}><span>{sec}</span><span>{s.correct}/{s.total}</span></div>
              <div className="progress"><div className="progress-fill" style={{ width: `${s.total ? (s.correct / s.total) * 100 : 0}%`, background: 'var(--brand)' }} /></div>
            </div>))}
          <div style={{ marginTop: 18 }}><button className="btn btn-primary" onClick={() => nav('/student/scores')}>View my scores</button></div>
        </div>
      </div>
    );
  }

  const { test, questions } = data;
  const q = questions[idx];
  const answered = Object.keys(answers).length;
  const timerClass = left > 300 ? 'safe' : left > 60 ? 'warn' : 'danger';

  return (
    <div className="page quiz-wrap" style={{ margin: '0 auto' }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, position: 'sticky', top: 8, zIndex: 5 }}>
        <div><div className="sec-title">{test.name}</div><div className="sec-sub">{answered}/{questions.length} answered</div></div>
        <span className={`timer ${timerClass}`} role="timer" aria-live="off">⏱ {mmss(Math.max(left ?? 0, 0))}</span>
      </div>

      <div className="card">
        {q.passage && <div className="quiz-passage">{q.passage}</div>}
        <div className="quiz-q">Q{idx + 1}. {q.question}</div>
        {q.image && <img src={q.image} alt="" style={{ maxWidth: '100%', maxHeight: 260, borderRadius: 8, marginBottom: 12 }} />}
        {q.options.map((o, i) => (
          <div key={i} role="radio" aria-checked={answers[q.id] === i} tabIndex={0}
            className={`quiz-opt ${answers[q.id] === i ? 'selected' : ''}`}
            onClick={() => setAnswers({ ...answers, [q.id]: i })}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setAnswers({ ...answers, [q.id]: i })}>
            <span className="opt-letter">{L[i]}</span>{o}
          </div>))}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
          <button className="btn btn-secondary" disabled={idx === 0} onClick={() => setIdx(idx - 1)}>Previous</button>
          {idx < questions.length - 1
            ? <button className="btn btn-primary" onClick={() => setIdx(idx + 1)}>Next</button>
            : <button className="btn btn-primary" onClick={() => (answered === questions.length || window.confirm(`${questions.length - answered} question(s) unanswered. Submit anyway?`)) && submit()}>Submit test</button>}
        </div>
      </div>

      <div className="card" style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {questions.map((x, n) => (
          <button key={x.id} onClick={() => setIdx(n)} aria-label={`Go to question ${n + 1}`}
            className={`btn btn-xs ${n === idx ? 'btn-primary' : answers[x.id] !== undefined ? 'btn-success' : 'btn-secondary'}`}>{n + 1}</button>))}
      </div>
    </div>
  );
}
