import { useParams } from 'react-router-dom';
import { useFetch } from '../../components/useFetch.js';
import { Badge, Loading, Percent } from '../../components/ui.jsx';

const L = ['A', 'B', 'C', 'D'];
const TONE = { correct: 'green', wrong: 'red', unattempted: 'gray' };

export default function StudentReview() {
  const { resultId } = useParams();
  const { data, loading, error } = useFetch(`/student/results/${resultId}`);
  if (loading) return <Loading />;
  if (error) return <div className="alert alert-error">{error.message}</div>;
  const { test, result, review } = data;
  return (
    <div className="quiz-wrap">
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="sec-title">{test.name}</div>
        <div className="sec-sub">{result.score}/{result.total} correct · <Percent value={result.percent} /></div>
      </div>
      {review.map(({ question: q, given, correct, status }, n) => (
        <div className="card" key={q.id} style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Badge tone="purple">{q.section}</Badge><Badge tone={TONE[status]}>{status}</Badge>
          </div>
          {q.passage && <div className="quiz-passage" style={{ marginTop: 10 }}>{q.passage}</div>}
          <div className="quiz-q" style={{ marginTop: 10 }}>{n + 1}. {q.question}</div>
          {q.image && <img src={q.image} alt="" style={{ maxWidth: '100%', maxHeight: 220, borderRadius: 8, marginBottom: 10 }} />}
          {q.options.map((o, i) => (
            <div key={i} className={`quiz-opt ${i === correct ? 'correct' : i === given ? 'wrong' : ''}`} style={{ cursor: 'default' }}>
              <span className="opt-letter">{L[i]}</span>{o}
              {i === given && <span style={{ marginLeft: 'auto', fontSize: '.72rem' }}>Your answer</span>}
            </div>))}
        </div>
      ))}
    </div>
  );
}
