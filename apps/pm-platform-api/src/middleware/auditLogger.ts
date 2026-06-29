import type { NextFunction, Request, Response } from 'express';
import { prisma } from '@pm-platform/db';

export function auditLogger(action?: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    res.on('finish', () => {
      if (!req.user || res.statusCode >= 400 || !['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method)) return;
      void prisma.auditLog.create({
        data: {
          orgId: req.user.orgId,
          userId: req.user.id,
          action: action ?? `${req.method} ${req.baseUrl}${req.path}`,
          entityType: req.baseUrl.split('/').filter(Boolean).pop() ?? 'unknown',
          entityId: String(req.params.id ?? req.params.issueId ?? req.params.projectId ?? 'n/a'),
          newData: req.body ?? {},
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'] ?? null
        }
      }).catch((error) => console.error('[audit]', error));
    });
    next();
  };
}
