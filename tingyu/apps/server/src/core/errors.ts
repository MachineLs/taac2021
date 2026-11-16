// HTTP error helpers. Owned by the lead.
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { ZodError, type ZodTypeAny, type infer as zInfer } from 'zod';

export class HttpError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) { super(message); }
}
export const badRequest = (m = '请求参数有误', d?: unknown) => new HttpError(400, 'bad_request', m, d);
export const unauthorized = (m = '请先登录') => new HttpError(401, 'unauthorized', m);
export const forbidden = (m = '没有权限') => new HttpError(403, 'forbidden', m);
export const notFound = (m = '内容不存在') => new HttpError(404, 'not_found', m);
export const conflict = (m: string, code = 'conflict') => new HttpError(409, code, m);

/** Wrap an async handler so thrown errors reach the error middleware. */
export const h = (fn: (req: Request, res: Response, next: NextFunction) => unknown): RequestHandler =>
  (req, res, next) => { Promise.resolve(fn(req, res, next)).catch(next); };

/** Validate input with zod; throws 400 with field details. */
export function parse<S extends ZodTypeAny>(schema: S, data: unknown): zInfer<S> {
  const r = schema.safeParse(data);
  if (!r.success) throw badRequest('请求参数有误', r.error.flatten());
  return r.data;
}

export function errorMiddleware(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
    return;
  }
  if (err instanceof ZodError) { res.status(400).json({ error: { code: 'bad_request', message: '请求参数有误', details: err.flatten() } }); return; }
  console.error(err);
  res.status(500).json({ error: { code: 'internal', message: '服务器开小差了，请稍后再试' } });
}
