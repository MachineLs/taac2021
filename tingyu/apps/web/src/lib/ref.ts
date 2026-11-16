// Creator referral capture. A landing page calls rememberRefCode(code); login() sends it once.
const KEY = 'tingyu.ref';
export function rememberRefCode(code: string) { try { localStorage.setItem(KEY, JSON.stringify({ code, at: Date.now() })); } catch { /* ignore */ } }
/** Returns the stored code if captured within 30 days. */
export function peekRefCode(): string | null {
  try { const v = JSON.parse(localStorage.getItem(KEY) || 'null'); return v && Date.now() - v.at < 30 * 86400000 ? v.code : null; } catch { return null; }
}
export function takeRefCode(): string | null { return peekRefCode(); }
/** Call on app start: captures ?ref=CODE from any URL. */
export function captureRefFromUrl() {
  try { const c = new URLSearchParams(location.search).get('ref'); if (c) rememberRefCode(c); } catch { /* ignore */ }
}
