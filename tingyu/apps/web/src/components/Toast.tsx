// Minimal toast. Owned by the lead. Usage: const toast = useToast(); toast('已保存'); render {toast.node} once in the page.
import { useCallback, useRef, useState } from 'react';
export function useToast() {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const show = useCallback((m: string) => { setMsg(m); window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setMsg(null), 2400); }, []);
  const node = msg ? <div className="toast" role="status">{msg}</div> : null;
  return Object.assign(show, { node });
}
