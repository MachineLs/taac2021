// Token signing and auth middleware. Owned by the lead.
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import type { Role } from '@tingyu/shared';
import { config } from './config';
import { one, j } from './db';
import { unauthorized, forbidden } from './errors';

export interface AuthUser { id: string; name: string; phone: string; roles: Role[]; counselorId: string | null; creatorId: string | null }

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express { interface Request { user?: AuthUser } }
}

const b64 = (s: string | Buffer) => Buffer.from(s).toString('base64url');
const TTL_SECONDS = 30 * 24 * 3600;

export function signToken(userId: string): string {
  const head = b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const body = b64(JSON.stringify({ sub: userId, iat: now, exp: now + TTL_SECONDS }));
  const sig = createHmac('sha256', config.jwtSecret).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${sig}`;
}

export function verifyToken(token: string): string | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const expect = createHmac('sha256', config.jwtSecret).update(`${parts[0]}.${parts[1]}`).digest();
  const got = Buffer.from(parts[2], 'base64url');
  if (got.length !== expect.length || !timingSafeEqual(got, expect)) return null;
  try {
    const p = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    if (typeof p.sub !== 'string' || typeof p.exp !== 'number' || p.exp < Date.now() / 1000) return null;
    return p.sub;
  } catch { return null; }
}

export function loadAuthUser(userId: string): AuthUser | null {
  const u = one('SELECT id, name, phone, roles FROM users WHERE id = ?', userId);
  if (!u) return null;
  const c = one('SELECT id FROM counselors WHERE user_id = ?', userId);
  const cr = one('SELECT id FROM creators WHERE user_id = ?', userId);
  return { id: u.id, name: u.name, phone: u.phone, roles: j<Role[]>(u.roles, ['client']), counselorId: c?.id ?? null, creatorId: cr?.id ?? null };
}

/** Attaches req.user when a valid token is present; never rejects. Mounted globally. */
export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const hdr = req.headers.authorization;
  if (hdr?.startsWith('Bearer ')) {
    const uid = verifyToken(hdr.slice(7));
    if (uid) req.user = loadAuthUser(uid) ?? undefined;
  }
  next();
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(unauthorized());
  next();
}

export function requireRole(role: Role) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(unauthorized());
    if (!req.user.roles.includes(role)) return next(forbidden());
    if (role === 'counselor' && !req.user.counselorId) return next(forbidden('还没有咨询师档案'));
    if (role === 'creator' && !req.user.creatorId) return next(forbidden('还没有达人档案'));
    next();
  };
}

/** Use inside handlers after requireAuth. */
export const me = (req: Request): AuthUser => { if (!req.user) throw unauthorized(); return req.user; };
