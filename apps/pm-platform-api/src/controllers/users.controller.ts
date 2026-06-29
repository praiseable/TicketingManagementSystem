import { prisma } from '@pm-platform/db';
import { asyncHandler, noContent, ok, AppError } from '../utils/apiResponse.js';
import { pagination, meta } from '../utils/paginate.js';
import { hashPassword, verifyPassword } from '../utils/hash.js';

const select = { id: true, orgId: true, email: true, name: true, avatarUrl: true, role: true, isActive: true, lastLoginAt: true, createdAt: true, updatedAt: true };

export const usersController = {
  list: asyncHandler(async (req, res) => {
    const { page, limit, skip, take } = pagination(req.query);
    const where = { orgId: req.user!.orgId };
    const [data, total] = await prisma.$transaction([prisma.user.findMany({ where, skip, take, select }), prisma.user.count({ where })]);
    ok(res, data, meta(page, limit, total));
  }),
  get: asyncHandler(async (req, res) => {
    const user = await prisma.user.findFirst({ where: { id: req.params.id, orgId: req.user!.orgId }, select });
    if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
    ok(res, user);
  }),
  update: asyncHandler(async (req, res) => {
    if (req.user!.id !== req.params.id && req.user!.role === 'MEMBER') throw new AppError(403, 'FORBIDDEN', 'Can only update own profile');
    ok(res, await prisma.user.update({ where: { id: req.params.id }, data: req.body, select }));
  }),
  password: asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user || user.id !== req.user!.id) throw new AppError(403, 'FORBIDDEN', 'Can only change own password');
    if (!(await verifyPassword(req.body.currentPassword, user.passwordHash))) throw new AppError(400, 'INVALID_PASSWORD', 'Current password is incorrect');
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(req.body.newPassword) } });
    noContent(res);
  }),
  remove: asyncHandler(async (req, res) => { await prisma.user.update({ where: { id: req.params.id }, data: { isActive: false } }); noContent(res); })
};
