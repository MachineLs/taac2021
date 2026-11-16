// Counselor matching for intake recommendations. Owner: B2.
import type { ConsultMode } from '@tingyu/shared';
import { all, j, one, type Row } from '../../core/db';
import { nowIso, addDays } from '../../core/util';

export interface CounselorBrief { id: string; name: string; tags: string[]; modes: ConsultMode[]; rating: number; price: number; nextAt: string | null }

export function approvedCounselors(): CounselorBrief[] {
  const now = nowIso();
  return all(`SELECT c.*, (SELECT MIN(start_at) FROM slots s WHERE s.counselor_id = c.id AND s.status = 'open' AND s.start_at > ?) AS next_at
              FROM counselors c WHERE c.status = 'approved' ORDER BY c.sort_weight DESC, c.rating DESC`, now)
    .map((c: Row) => ({ id: c.id, name: c.name, tags: j<string[]>(c.tags, []), modes: j<ConsultMode[]>(c.modes, []), rating: c.rating, price: c.price, nextAt: c.next_at ?? null }));
}

export function priceRange(): [number, number] | null {
  const r = one("SELECT MIN(price) AS lo, MAX(price) AS hi FROM counselors WHERE status = 'approved'");
  return r && r.lo != null ? [r.lo, r.hi] : null;
}

/**
 * Rank approved counselors by issue-tag overlap (topic order matters), rating and soonest availability;
 * a counselor that offers the preferred modality gets a bonus.
 */
export function recommendCounselors(topics: string[], modality: ConsultMode | null, limit = 3): CounselorBrief[] {
  const now = nowIso();
  const in3 = addDays(now, 3), in7 = addDays(now, 7);
  const scored = approvedCounselors().map((c, i) => {
    let s = 0;
    topics.forEach((t, k) => { if (c.tags.includes(t)) s += k === 0 ? 12 : k === 1 ? 7 : 4; });
    s += (c.rating - 4.5) * 10;                       // 4.9 → +4
    if (c.nextAt) s += c.nextAt <= in3 ? 3 : c.nextAt <= in7 ? 1.5 : 0.5; else s -= 6;
    if (modality && c.modes.includes(modality)) s += 3;
    else if (modality) s -= modality === 'offline' ? 15 : 6;   // face-to-face is a hard constraint
    s -= i * 0.01;                                    // stable tie-break by platform sort weight
    return { c, s, overlap: topics.filter((t) => c.tags.includes(t)).length };
  });
  scored.sort((a, b) => b.s - a.s);
  const withOverlap = scored.filter((x) => x.overlap > 0);
  const pool = withOverlap.length ? withOverlap : scored;
  return pool.slice(0, limit).map((x) => x.c);
}

/** "今晚 20:00" / "明天 19:00" / "11月20日 14:00" in China time. */
export function fmtWhen(iso: string): string {
  const d = new Date(new Date(iso).getTime() + 8 * 3600000);
  const today = new Date(Date.now() + 8 * 3600000);
  const dayDiff = Math.round((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())) / 86400000);
  const hm = `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
  if (dayDiff === 0) return `${d.getUTCHours() >= 18 ? '今晚' : '今天'} ${hm}`;
  if (dayDiff === 1) return `明天 ${hm}`;
  if (dayDiff === 2) return `后天 ${hm}`;
  return `${d.getUTCMonth() + 1}月${d.getUTCDate()}日 ${hm}`;
}
