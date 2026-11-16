// Small data-loading hook. Owned by the lead.
import { useCallback, useEffect, useRef, useState, type DependencyList } from 'react';

export function useAsync<T>(fn: () => Promise<T>, deps: DependencyList = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const seq = useRef(0);
  const reload = useCallback(() => {
    const n = ++seq.current;
    setLoading(true); setError(null);
    return fn().then((d) => { if (n === seq.current) setData(d); return d; })
      .catch((e) => { if (n === seq.current) setError(e); })
      .finally(() => { if (n === seq.current) setLoading(false); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { reload(); }, [reload]);
  return { data, error, loading, reload, setData };
}
