import crypto from 'node:crypto';
import { prisma } from '@pm-platform/db';
import { asyncHandler, ok, AppError } from '../utils/apiResponse.js';
import { settingsStore } from '../services/settings-store.service.js';

function safePublicConfig(config: any) {
  return {
    enabled: Boolean(config?.enabled),
    provider: config?.provider || 'SAML',
    entityId: config?.entityId || '',
    loginUrl: config?.loginUrl || '',
    callbackUrl: config?.callbackUrl || '',
    certificateConfigured: Boolean(config?.certificate),
    mode: 'foundation',
  };
}

export const ssoController = {
  getConfig: asyncHandler(async (req, res) => {
    const org = await settingsStore.getOrg(req.user!.orgId);
    if (!org) throw new AppError(404, 'ORG_NOT_FOUND', 'Organization not found');
    ok(res, safePublicConfig(org.settings.sso || {}));
  }),

  updateConfig: asyncHandler(async (req, res) => {
    const body = req.body || {};
    await settingsStore.updateOrg(req.user!.orgId, (settings) => {
      settings.sso = {
        ...(settings.sso || {}),
        enabled: Boolean(body.enabled),
        provider: body.provider || 'SAML',
        entityId: body.entityId || '',
        loginUrl: body.loginUrl || '',
        callbackUrl: body.callbackUrl || '',
        certificate: body.certificate || settings.sso?.certificate || '',
        updatedById: req.user!.id,
        updatedAt: new Date().toISOString(),
      };
    });
    const org = await settingsStore.getOrg(req.user!.orgId);
    ok(res, safePublicConfig(org?.settings.sso || {}));
  }),

  loginUrl: asyncHandler(async (req, res) => {
    const orgId = typeof req.query.orgId === 'string' ? req.query.orgId : undefined;
    const slug = typeof req.query.slug === 'string' ? req.query.slug : undefined;
    const org = await prisma.organization.findFirst({ where: orgId ? { id: orgId } : slug ? { slug } : {}, select: { id: true, slug: true, settings: true } });
    if (!org) throw new AppError(404, 'ORG_NOT_FOUND', 'Organization not found');
    const settings = org.settings && typeof org.settings === 'object' && !Array.isArray(org.settings) ? org.settings as any : {};
    const config = settings.sso || {};
    const state = crypto.randomBytes(18).toString('hex');
    const url = config.loginUrl ? `${config.loginUrl}${String(config.loginUrl).includes('?') ? '&' : '?'}state=${encodeURIComponent(state)}` : null;
    ok(res, { enabled: Boolean(config.enabled), provider: config.provider || 'SAML', orgId: org.id, slug: org.slug, state, redirectUrl: url, mode: 'foundation' });
  }),

  callback: asyncHandler(async (_req, res) => {
    ok(res, { success: true, mode: 'foundation', message: 'SSO callback foundation endpoint is available; IdP assertion validation will be enabled with production identity provider metadata.' });
  }),
};
