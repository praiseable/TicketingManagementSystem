import type { ErrorRequestHandler, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
const { JsonWebTokenError, TokenExpiredError } = jwt;
import { AppError } from '../utils/apiResponse.js';

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: `Route not found: ${req.method} ${req.originalUrl}` } });
};

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof AppError) {
    return res.status(error.statusCode).json({ success: false, error: { code: error.code, message: error.message, details: error.details } });
  }
  if (error instanceof TokenExpiredError) {
    return res.status(401).json({ success: false, error: { code: 'TOKEN_EXPIRED', message: 'Token expired' } });
  }
  if (error instanceof JsonWebTokenError) {
    return res.status(401).json({ success: false, error: { code: 'INVALID_TOKEN', message: 'Invalid token' } });
  }
  console.error(error);
  return res.status(500).json({ success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'Unexpected server error' } });
};
