// Crisis support banner — shown whenever the backend reports crisis. Owned by the lead.
import { HOTLINES } from '@tingyu/shared';
export function CrisisBanner({ message }: { message?: string }) {
  return (
    <div className="crisis" role="alert">
      <b>{message ?? '你现在的安全最重要。如果有伤害自己的念头，请马上联系专业帮助：'}</b>
      <div className="lines">{HOTLINES.map((h) => <span key={h.number}>{h.name} <strong>{h.number}</strong> · {h.note}</span>)}</div>
    </div>
  );
}
