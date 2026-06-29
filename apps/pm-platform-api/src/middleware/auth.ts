import type { NextFunction, Request, Response } from 'express';
import { prisma } from '@pm-platform/db';
import { AppError } from '../utils/apiResponse.js';
import { verifyAccessToken } from '../utils/jwt.js';

export async function authRequired(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw new AppError(401, 'UNAUTHORIZED', 'Missing bearer token');
  const token = header.slice('Bearer '.length);
  const payload = verifyAccessToken(token);
  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || !user.isActive) throw new AppError(401, 'UNAUTHORIZED', 'Invalid or inactive user');
  req.user = { id: user.id, orgId: user.orgId, email: user.email, role: user.role, name: user.name };
  next();
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return next();
  try {
    const payload = verifyAccessToken(header.slice('Bearer '.length));
    req.user = { id: payload.sub, orgId: payload.orgId, email: payload.email, role: payload.role as never, name: '' };
  } catch {
    req.user = undefined;
  }
  return next();
}
