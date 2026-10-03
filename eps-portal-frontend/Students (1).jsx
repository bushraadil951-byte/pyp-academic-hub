import { useFetch } from '../../components/useFetch.js';
import { Badge, Empty, Loading, Percent } from '../../components/ui.jsx';

export default function TeacherStudents() {
  const { data, loading } = useFetch('/teacher/students');
  if (loading) return <Loading />;
  return (
    <div className="card">
      {data.length === 0 ? <Empty>No students in your grade yet.</Empty> : (
        <div className="table-wrap"><table>
          <thead><tr><th>Student</th><th>Grade</th><th>Section</th><th>Tests taken</th><th>Average</th></tr></thead>
          <tbody>{data.map((s) => (
            <tr key={s.id}>
              <td style={{ fontWeight: 500 }}>{s.name}</td>
              <td><Badge tone="purple">{s.grade}</Badge></td>
              <td>{s.section || '—'}</td>
              <td>{s.testsTaken}</td>
              <td>{s.testsTaken ? <Percent value={s.avg} /> : '—'}</td>
            </tr>))}
          </tbody>
        </table></div>
      )}
    </div>
  );
}
