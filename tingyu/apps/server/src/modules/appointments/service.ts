// Shared commerce helpers (B1). Used by appointments, counselors, workbench, coupons.
import type { ConsultMode } from '@tingyu/shared';
import { MODE_LABEL } from '@tingyu/shared';
import { all, run, tx } from '../../core/db';
import { nowIso } from '../../core/util';

/** Statuses that count as "a real (paid) order" for first-order rules. */
export const PAID_STATUSES = ['paid', 'in_session', 'completed'] as const;

export function hasPaidOrder(userId: string): boolean {
  return all(`SELECT 1 FROM appointments WHERE user_id = ? AND status IN ('paid','in_session','completed') LIMIT 1`, userId).length > 0;
}

/** Return a user coupon to the wallet (unused, or expired if past its date). */
export function restoreCoupon(userCouponId: string | null | undefined) {
  if (!userCouponId) return;
  const now = nowIso();
  run(`UPDATE user_coupons SET status = CASE WHEN expires_at <= ? THEN 'expired' ELSE 'unused' END, used_at = NULL WHERE id = ?`, now, userCouponId);
}

/** Release a slot held by an appointment (only if it is still booked). */
export function releaseSlot(slotId: string) {
  run(`UPDATE slots SET status = 'open' WHERE id = ? AND status = 'booked'`, slotId);
}

/**
 * Cancel pending_payment orders whose 15-minute payment window has passed:
 * status → cancelled (cancel_reason = 'payment_timeout'), slot released, coupon returned.
 * Called at the start of every endpoint that reads/writes slots or orders.
 */
export function expireStalePending(): number {
  const now = nowIso();
  const stale = all(`SELECT id, slot_id, user_coupon_id FROM appointments WHERE status = 'pending_payment' AND pay_expires_at IS NOT NULL AND pay_expires_at <= ?`, now);
  if (!stale.length) return 0;
  tx(() => {
    for (const a of stale) {
      const r = run(`UPDATE appointments SET status = 'cancelled', cancel_reason = 'payment_timeout', cancelled_at = ? WHERE id = ? AND status = 'pending_payment'`, now, a.id);
      if (Number(r.changes) === 1) {
        releaseSlot(a.slot_id);
        restoreCoupon(a.user_coupon_id);
      }
    }
  });
  return stale.length;
}

/** "11月17日 20:00" in China time. */
export function fmtCn(iso: string): string {
  const d = new Date(new Date(iso).getTime() + 8 * 3600000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCMonth() + 1}月${d.getUTCDate()}日 ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}
export const modeLabel = (m: string) => MODE_LABEL[m as ConsultMode] ?? m;

/** Route param as a plain string (@types/express 5 types params loosely). */
export const param = (req: { params: Record<string, unknown> }, name = 'id'): string => String(req.params[name] ?? '');
