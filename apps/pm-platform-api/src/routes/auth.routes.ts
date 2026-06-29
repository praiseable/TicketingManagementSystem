import { Router } from 'express';
import { authController } from '../controllers/auth.controller.js';
import { authRateLimiter } from '../middleware/rateLimiter.js';
import { authRequired } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { authSchemas } from '../schemas/index.js';

const router = Router();
router.post('/register', authRateLimiter, validate({ body: authSchemas.register }), authController.register);
router.post('/login', authRateLimiter, validate({ body: authSchemas.login }), authController.login);
router.post('/logout', validate({ body: authSchemas.refresh }), authController.logout);
router.post('/refresh', validate({ body: authSchemas.refresh }), authController.refresh);
router.post('/forgot-password', validate({ body: authSchemas.forgotPassword }), authController.forgotPassword);
router.post('/reset-password', validate({ body: authSchemas.resetPassword }), authController.resetPassword);
router.post('/verify-email', validate({ body: authSchemas.verifyEmail }), authController.verifyEmail);
router.get('/me', authRequired, authController.me);
export default router;
