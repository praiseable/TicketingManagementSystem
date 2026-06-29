import type { NextFunction, Request, Response } from 'express';
import { prisma, ProjectRole } from '@pm-platform/db';
import { AppError } from '../utils/apiResponse.js';

const rank: Record<ProjectRole, number> = { VIEWER: 1, MEMBER: 2, ADMIN: 3, OWNER: 4 };
const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function asString(value: unknown): string | undefined {
  if (Array.isArray(value)) return asString(value[0]);
  if (typeof value !== 'string') return undefined;
  const v = value.trim();
  return v || undefined;
}

function resolveProjectId(req: Request): string | undefined {
  const candidates = [
    asString((req.params as any).projectId),
    asString((req.params as any).id),
    asString((req.body as any)?.projectId),
    asString((req.query as any)?.projectId)
  ];
  for (const candidate of candidates) if (candidate && uuidRe.test(candidate)) return candidate;

  const haystack = `${req.originalUrl ?? ''} ${req.baseUrl ?? ''} ${req.url ?? ''} ${req.path ?? ''}`;
  const match = haystack.match(/\/projects\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})(?:\/|\?|\s|$)/i);
  return match?.[1];
}

export function requireProjectRole(minRole: ProjectRole = ProjectRole.MEMBER) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');

      const projectId = resolveProjectId(req);
      if (!projectId) {
        throw new AppError(400, 'PROJECT_ID_REQUIRED', 'Project id is required', {
          params: req.params,
          query: req.query,
          path: req.path,
          baseUrl: req.baseUrl,
          originalUrl: req.originalUrl
        });
      }

      (req.params as any).projectId = projectId;
      if (!(req.params as any).id) (req.params as any).id = projectId;

      const membership = await prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId, userId: req.user.id } }
      });

      if (!membership || rank[membership.role] < rank[minRole]) {
        throw new AppError(403, 'FORBIDDEN', 'Insufficient project role');
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
