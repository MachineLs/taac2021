import { describe, it, expect } from 'vitest';
import { setup } from './helpers';

describe('health', () => {
  it('responds and 404s unknown api routes', async () => {
    const { api } = setup();
    expect((await api.get('/api/health')).body).toEqual({ ok: true });
    const r = await api.get('/api/nope');
    expect(r.status).toBe(404);
    expect(r.body.error.code).toBe('not_found');
  });
});
