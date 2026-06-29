import type { NextFunction, Request, Response } from 'express';
import type { GlobalRole } from '@pm-platform/db';
import { AppError } from '../utils/apiResponse.js';

const rank: Record<GlobalRole, number> = { MEMBER: 1, ADMIN: 2, SUPER_ADMIN: 3 };

export function requireRole(...roles: GlobalRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
    if (!roles.includes(req.user.role)) throw new AppError(403, 'FORBIDDEN', 'Insufficient global role');
    next();
  };
}

export function requireAtLeast(role: GlobalRole) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
    if (rank[req.user.role] < rank[role]) throw new AppError(403, 'FORBIDDEN', 'Insufficient global role');
    next();
  };
}
