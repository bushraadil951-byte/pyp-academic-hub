import { useEffect, useState } from 'react';
import { api } from '../../api.js';

// Loads the student dropdown for a grade/section from /profile/<area>/students.
export function useStaffStudents(area, grade, section) {
  const [students, setStudents] = useState([]);
  useEffect(() => {
    if (!grade) return undefined;
    let live = true;
    api.get(`/profile/${area}/students?${new URLSearchParams({ grade, section })}`).then((d) => live && setStudents(d)).catch(() => live && setStudents([]));
    return () => { live = false; };
  }, [area, grade, section]);
  return students;
}
