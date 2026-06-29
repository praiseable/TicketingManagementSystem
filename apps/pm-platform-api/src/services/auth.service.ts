import crypto from 'node:crypto';
import { prisma, GlobalRole, NotificationType } from '@pm-platform/db';
import { AppError } from '../utils/apiResponse.js';
import { hashPassword, verifyPassword } from '../utils/hash.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt.js';
import { emailService } from './email.service.js';
import { env } from '../config/env.js';

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'organisation';
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function publicUser(user: {
  id: string;
  orgId: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  role: GlobalRole;
  isActive: boolean;
  lastLoginAt?: Date | null;
}) {
  return {
    id: user.id,
    orgId: user.orgId,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    role: user.role,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt ?? null
  };
}

async function ensureNotificationPrefs(userId: string) {
  const values = Object.values(NotificationType).map((eventType) => ({
    userId,
    eventType,
    inApp: true,
    email: true
  }));

  await prisma.notificationPref.createMany({ data: values, skipDuplicates: true });
}

async function createRefreshTokenRecord(userId: string, refreshToken: string) {
  await prisma.refreshToken.create({
    data: {
      userId,
      token: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + 7 * 86400_000)
    }
  });
}

async function issueTokens(user: { id: string; orgId: string; email: string; role: GlobalRole }) {
  const basePayload = { sub: user.id, orgId: user.orgId, email: user.email, role: user.role };

  // JWT libraries use second-level iat precision. Without a unique jti, two refresh
  // tokens issued in the same second for the same user can be byte-for-byte identical,
  // causing a PostgreSQL unique-constraint error on RefreshToken.token during rotation.
  const accessToken = signAccessToken({ ...basePayload, typ: 'access', jti: crypto.randomUUID() });

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const refreshToken = signRefreshToken({ ...basePayload, typ: 'refresh', jti: crypto.randomUUID() });
    try {
      await createRefreshTokenRecord(user.id, refreshToken);
      return { accessToken, refreshToken };
    } catch (error: any) {
      // Extremely defensive retry for duplicate token hashes. The jti above should
      // make this practically impossible, but retry keeps refresh robust.
      if (error?.code !== 'P2002' || attempt === 2) throw error;
    }
  }

  throw new AppError(500, 'TOKEN_ISSUE_FAILED', 'Could not issue refresh token');
}

async function findRefreshTokenRecord(refreshToken: string) {
  return prisma.refreshToken.findFirst({
    where: {
      OR: [
        { token: refreshToken },
        { token: hashToken(refreshToken) }
      ]
    }
  });
}

function publicUrl(path: string) {
  return `${env.FRONTEND_URL.replace(/\/$/, '')}${path}`;
}

export const authService = {
  async register(input: { name: string; email: string; password: string; orgName?: string }) {
    const email = normalizeEmail(input.email);
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new AppError(409, 'EMAIL_EXISTS', 'Email already registered');

    const orgName = input.orgName?.trim() || `${input.name.trim()}'s Organisation`;
    const baseSlug = slugify(orgName);
    const slug = await prisma.organization.findUnique({ where: { slug: baseSlug } })
      ? `${baseSlug}-${crypto.randomBytes(3).toString('hex')}`
      : baseSlug;

    const passwordHash = await hashPassword(input.password);
    const verificationToken = crypto.randomBytes(32).toString('hex');

    const user = await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({ data: { name: orgName, slug } });
      const createdUser = await tx.user.create({
        data: {
          orgId: org.id,
          email,
          passwordHash,
          name: input.name.trim(),
          role: GlobalRole.ADMIN
        }
      });

      await tx.emailVerification.create({
        data: {
          userId: createdUser.id,
          token: verificationToken,
          expiresAt: new Date(Date.now() + 24 * 3600_000)
        }
      });

      return createdUser;
    });

    await ensureNotificationPrefs(user.id);

    const verifyLink = publicUrl(`/login?verifyToken=${encodeURIComponent(verificationToken)}`);
    await emailService.sendAuthEmail(
      user.email,
      'Verify your PM Platform account',
      `Welcome to PM Platform. Verify your account using this link: ${verifyLink}`,
      `<p>Welcome to PM Platform.</p><p><a href="${verifyLink}">Verify your account</a></p>`
    );

    return {
      user: publicUser(user),
      tokens: await issueTokens(user),
      verification: {
        emailSent: Boolean(env.SMTP_USER && env.SMTP_PASS),
        expiresInHours: 24,
        devToken: env.NODE_ENV === 'production' ? undefined : verificationToken
      }
    };
  },

  async login(input: { email: string; password: string }) {
    const email = normalizeEmail(input.email);
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');

    const ok = await verifyPassword(input.password, user.passwordHash);
    if (!ok) throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');

    await ensureNotificationPrefs(user.id);
    const updatedUser = await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    return { user: publicUser(updatedUser), tokens: await issueTokens(updatedUser) };
  },

  async refresh(refreshToken: string) {
    let payload: ReturnType<typeof verifyRefreshToken>;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'Refresh token expired or invalid');
    }

    const stored = await findRefreshTokenRecord(refreshToken);
    if (!stored || stored.expiresAt < new Date()) {
      throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'Refresh token expired or revoked');
    }

    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive) throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'User no longer active');

    await prisma.refreshToken.deleteMany({
      where: {
        OR: [
          { id: stored.id },
          { token: refreshToken },
          { token: hashToken(refreshToken) }
        ]
      }
    });

    const tokens = await issueTokens(user);
    return tokens;
  },

  async logout(refreshToken: string) {
    await prisma.refreshToken.deleteMany({
      where: {
        OR: [
          { token: refreshToken },
          { token: hashToken(refreshToken) }
        ]
      }
    });
  },

  async me(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive) throw new AppError(401, 'UNAUTHORIZED', 'Invalid or inactive user');
    await ensureNotificationPrefs(user.id);
    return publicUser(user);
  },

  async forgotPassword(emailInput: string) {
    const email = normalizeEmail(emailInput);
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) return;

    await prisma.passwordReset.updateMany({
      where: { userId: user.id, used: false, expiresAt: { gt: new Date() } },
      data: { used: true }
    });

    const token = crypto.randomBytes(32).toString('hex');
    await prisma.passwordReset.create({
      data: {
        userId: user.id,
        token,
        expiresAt: new Date(Date.now() + 3600_000)
      }
    });

    const resetLink = publicUrl(`/forgot-password?resetToken=${encodeURIComponent(token)}`);
    await emailService.sendAuthEmail(
      user.email,
      'Reset your PM Platform password',
      `Reset your PM Platform password using this link: ${resetLink}`,
      `<p>Reset your PM Platform password using this link:</p><p><a href="${resetLink}">Reset password</a></p>`
    );
  },

  async resetPassword(token: string, password: string) {
    const reset = await prisma.passwordReset.findUnique({ where: { token } });
    if (!reset || reset.used || reset.expiresAt < new Date()) {
      throw new AppError(400, 'INVALID_RESET_TOKEN', 'Invalid reset token');
    }

    const passwordHash = await hashPassword(password);
    await prisma.$transaction([
      prisma.user.update({ where: { id: reset.userId }, data: { passwordHash } }),
      prisma.passwordReset.update({ where: { id: reset.id }, data: { used: true } }),
      prisma.refreshToken.deleteMany({ where: { userId: reset.userId } })
    ]);
  },

  async verifyEmail(token: string) {
    const verification = await prisma.emailVerification.findUnique({ where: { token } });
    if (!verification || verification.used || verification.expiresAt < new Date()) {
      throw new AppError(400, 'INVALID_VERIFY_TOKEN', 'Invalid email verification token');
    }
    await prisma.emailVerification.update({ where: { id: verification.id }, data: { used: true } });
  }
};
