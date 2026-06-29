import type { NextFunction, Request, RequestHandler, Response } from 'express';

export type AppRequest = Request<Record<string, string>, unknown, any, any>;

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
  }
}

function toJsonSafe(value: unknown): unknown {
  if (typeof value === 'bigint') return Number(value);
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(toJsonSafe);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) out[key] = toJsonSafe(val);
    return out;
  }
  return value;
}

export function ok<T>(res: Response, data: T, meta?: unknown) {
  return res.status(200).json({ success: true, data: toJsonSafe(data), ...(meta ? { meta: toJsonSafe(meta) } : {}) });
}

export function created<T>(res: Response, data: T) {
  return res.status(201).json({ success: true, data: toJsonSafe(data) });
}

export function noContent(res: Response) {
  return res.status(204).send();
}

export const asyncHandler =
  (fn: (req: AppRequest, res: Response, next: NextFunction) => Promise<unknown> | unknown): RequestHandler =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req as AppRequest, res, next)).catch(next);
  };
