// Test helpers shared by all backend tests. Owned by the lead.
import request from 'supertest';
import { createApp } from '../src/app';
import { seed } from '../src/seed/seed';
import { signToken } from '../src/core/auth';
import { one } from '../src/core/db';

/** Fresh in-memory app with demo data. Call in beforeEach/beforeAll. */
export function setup() {
  const app = createApp({ dbPath: ':memory:' });
  seed();
  const api = request(app);
  /** Bearer token for a seeded phone number, e.g. '13800000001'. */
  const tokenFor = (phone: string) => {
    const u = one('SELECT id FROM users WHERE phone = ?', phone);
    if (!u) throw new Error(`no seeded user ${phone}`);
    return `Bearer ${signToken(u.id)}`;
  };
  return { app, api, tokenFor };
}
export const PHONES = { client: '13800000001', counselor: '13900000001', admin: '13700000000', creator: '13600000001', pendingCounselor: '13900000013' };
