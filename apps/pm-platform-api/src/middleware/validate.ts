import type { NextFunction, Request, Response } from 'express';
import type { ZodSchema } from 'zod';
import { AppError } from '../utils/apiResponse.js';

function normalizeValidationError(error: unknown) {
  const anyError = error as any;
  const issues = anyError?.issues ?? anyError?.errors;
  if (Array.isArray(issues)) {
    return issues.map((issue: any) => ({
      path: Array.isArray(issue.path) ? issue.path.join('.') : String(issue.path ?? ''),
      code: issue.code,
      message: issue.message,
      expected: issue.expected,
      received: issue.received
    }));
  }
  return {
    name: anyError?.name,
    message: anyError?.message ?? String(error)
  };
}

export function validate(schema: { body?: ZodSchema; query?: ZodSchema; params?: ZodSchema }) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (schema.body) req.body = schema.body.parse(req.body);
      if (schema.query) req.query = schema.query.parse(req.query) as never;
      if (schema.params) req.params = schema.params.parse(req.params) as never;
      next();
    } catch (error) {
      const details = normalizeValidationError(error);
      console.error('VALIDATION_ERROR', req.method, req.originalUrl, JSON.stringify(details));
      next(new AppError(400, 'VALIDATION_ERROR', 'Request validation failed', details));
    }
  };
}
