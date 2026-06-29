import jwt from 'jsonwebtoken';
import type { Secret, SignOptions } from 'jsonwebtoken';
import { env } from '../config/env.js';

export interface JwtPayload {
  sub: string;
  orgId: string;
  email: string;
  role: string;
  /** Unique token id. Prevents same-second refresh-token collisions. */
  jti?: string;
  /** Optional token type marker for debugging and future enforcement. */
  typ?: 'access' | 'refresh';
}

function sign(payload: JwtPayload, secret: string, expiresIn: string) {
  const options: SignOptions = { expiresIn: expiresIn as SignOptions['expiresIn'] };
  return jwt.sign(payload, secret as Secret, options);
}

export function signAccessToken(payload: JwtPayload) {
  return sign(payload, env.JWT_ACCESS_SECRET, env.JWT_ACCESS_EXPIRY);
}

export function signRefreshToken(payload: JwtPayload) {
  return sign(payload, env.JWT_REFRESH_SECRET, env.JWT_REFRESH_EXPIRY);
}

export function verifyAccessToken(token: string) {
  return jwt.verify(token, env.JWT_ACCESS_SECRET as Secret) as JwtPayload & jwt.JwtPayload;
}

export function verifyRefreshToken(token: string) {
  return jwt.verify(token, env.JWT_REFRESH_SECRET as Secret) as JwtPayload & jwt.JwtPayload;
}
