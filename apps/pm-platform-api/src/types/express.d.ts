import type { GlobalRole } from '@pm-platform/db';

declare global {
  namespace Express {
    interface UserContext {
      id: string;
      orgId: string;
      email: string;
      role: GlobalRole;
      name: string;
    }

    interface Request {
      user?: UserContext;
      requestId?: string;
    }
  }
}

export {};
