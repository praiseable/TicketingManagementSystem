import { authService } from '../services/auth.service.js';
import { asyncHandler, created, noContent, ok } from '../utils/apiResponse.js';
import { AppError } from '../utils/apiResponse.js';

export const authController = {
  register: asyncHandler(async (req, res) => created(res, await authService.register(req.body))),
  login: asyncHandler(async (req, res) => ok(res, await authService.login(req.body))),
  logout: asyncHandler(async (req, res) => { await authService.logout(req.body.refreshToken); return noContent(res); }),
  refresh: asyncHandler(async (req, res) => ok(res, await authService.refresh(req.body.refreshToken))),
  forgotPassword: asyncHandler(async (req, res) => { await authService.forgotPassword(req.body.email); return noContent(res); }),
  resetPassword: asyncHandler(async (req, res) => { await authService.resetPassword(req.body.token, req.body.password); return noContent(res); }),
  verifyEmail: asyncHandler(async (req, res) => { await authService.verifyEmail(req.body.token); return noContent(res); }),
  me: asyncHandler(async (req, res) => {
    if (!req.user?.id) throw new AppError(401, 'UNAUTHORIZED', 'Missing authenticated user');
    return ok(res, { user: await authService.me(req.user.id) });
  })
};
