import { useState } from 'react';
import { useFetch } from '../../components/useFetch.js';
import { Badge, Empty, Loading, Percent, Stat, fmtDate, pctColor } from '../../components/ui.jsx';

const monthLabel = (m) => new Date(`${m}-01T00:00:00`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

// Student page: my attendance for a month.
export default function MyAttendance() {
  const { data: d, loading, error } = useFetch('/attendance/my');
  const [picked, setPicked] = useState('');
  if (loading) return <Loading />;
  if (error) return <div className="alert alert-error">{error.message}</div>;

  const months = d.months;
  const month = picked || (months.some((m) => m.month === d.currentMonth) ? d.currentMonth : months[0]?.month);
  const cur = months.find((m) => m.month === month);

  return (
    <>
      <div className="sec-header">
        <div><div className="sec-title">My attendance</div><div className="sec-sub">{d.student.grade}{d.student.section ? ` · ${d.student.section}` : ''} · minimum {d.minPercent}% each month</div></div>
        {months.length > 0 && (
          <select className="form-input" style={{ width: 200 }} value={month} onChange={(e) => setPicked(e.target.value)} aria-label="Month">
            {months.map((m) => <option key={m.month} value={m.month}>{monthLabel(m.month)}</option>)}
          </select>)}
      </div>
      {!cur ? <div className="card"><Empty>No attendance has been recorded for you yet.</Empty></div> : (
        <>
          <div className="stat-grid">
            <Stat icon="✅" bg="#ecfdf5" value={<span style={{ color: pctColor(cur.percent) }}>{cur.percent}%</span>} label="Attendance this month" />
            <Stat icon="🏫" bg="#eef2ff" value={cur.workingDays} label="School days" />
            <Stat icon="📅" bg="#fffbeb" value={cur.presentDays} label="Days present" />
            <Stat icon="🚫" bg="#fef2f2" value={cur.absentDays} label="Days absent" />
          </div>
          {cur.belowMinimum
            ? <div className="alert alert-error" style={{ marginBottom: 16 }}>Your attendance for {monthLabel(cur.month)} is below the required {d.minPercent}%.</div>
            : <div className="alert alert-success" style={{ marginBottom: 16 }}>Your attendance for {monthLabel(cur.month)} meets the required {d.minPercent}%.</div>}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-title">Days I was absent</div>
            {cur.absences.length === 0 ? <Empty>No absences this month.</Empty> : (
              <div className="table-wrap"><table>
                <thead><tr><th>Date</th><th>Status</th></tr></thead>
                <tbody>{cur.absences.map((a) => (
                  <tr key={a.date}><td>{fmtDate(a.date)}</td><td>{a.value === 1 ? <Badge tone="red">Absent</Badge> : <Badge tone="amber">Half day</Badge>}</td></tr>))}
                </tbody>
              </table></div>)}
          </div>
          <div className="card">
            <div className="card-title">All months</div>
            <div className="table-wrap"><table>
              <thead><tr><th>Month</th><th>School days</th><th>Absent days</th><th>Attendance</th></tr></thead>
              <tbody>{months.map((m) => (
                <tr key={m.month}><td>{monthLabel(m.month)}</td><td>{m.workingDays}</td><td>{m.absentDays}</td><td><Percent value={m.percent} /></td></tr>))}
              </tbody>
            </table></div>
          </div>
        </>
      )}
    </>
  );
}
