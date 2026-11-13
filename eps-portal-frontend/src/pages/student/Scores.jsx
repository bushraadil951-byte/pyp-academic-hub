import { Link } from 'react-router-dom';
import { useFetch } from '../../components/useFetch.js';
import { Badge, Empty, Loading, Percent, fmtDate } from '../../components/ui.jsx';

export default function StudentScores() {
  const { data, loading } = useFetch('/student/scores');
  if (loading) return <Loading />;
  return (
    <div className="card">
      {data.length === 0 ? <Empty>No scores yet. Finish a test and it will show up here.</Empty> : (
        <div className="table-wrap"><table>
          <thead><tr><th>Test</th><th>Subject</th><th>Score</th><th>Percent</th><th>Date</th><th /></tr></thead>
          <tbody>{data.map((r) => (
            <tr key={r.id}>
              <td style={{ fontWeight: 500 }}>{r.test}</td><td><Badge>{r.subject}</Badge></td>
              <td>{r.score}/{r.total}</td><td><Percent value={r.percent} /></td><td>{fmtDate(r.takenAt)}</td>
              <td style={{ textAlign: 'right' }}><Link className="btn btn-secondary btn-xs" to={`/student/review/${r.id}`}>Review</Link></td>
            </tr>))}
          </tbody>
        </table></div>
      )}
    </div>
  );
}
