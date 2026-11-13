import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';

// const { data, loading, error, reload } = useFetch('/admin/students')
export function useFetch(path) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(() => {
    setLoading(true);
    return api.get(path).then((d) => { setData(d); setError(null); }).catch(setError).finally(() => setLoading(false));
  }, [path]);
  useEffect(() => { reload(); }, [reload]);
  return { data, error, loading, reload };
}
