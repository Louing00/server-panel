import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { prisma } from '../common/prisma.js';
import { env } from '../config/env.js';
import { writeAudit } from '../audit/audit.service.js';
import { HttpError } from '../common/errors.js';

function refreshExpiry() {
  const days = Number.parseInt(env.JWT_REFRESH_EXPIRES_IN, 10) || 7;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function signTokens(app: FastifyInstance, user: { id: string; username: string; role: string }) {
  const accessToken = app.jwt.sign(
    { sub: user.id, username: user.username, role: user.role },
    { expiresIn: env.JWT_ACCESS_EXPIRES_IN },
  );
  const refreshToken = crypto.randomBytes(48).toString('base64url');
  await prisma.refreshToken.create({
    data: {
      tokenHash: hashToken(refreshToken),
      userId: user.id,
      expiresAt: refreshExpiry(),
    },
  });
  return { accessToken, refreshToken };
}

export async function login(app: FastifyInstance, request: FastifyRequest, username: string, password: string) {
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || user.status !== 'active' || !(await bcrypt.compare(password, user.passwordHash))) {
    await writeAudit({
      action: 'auth.login_failed',
      request,
      userId: user?.id ?? null,
      detail: { username, reason: user?.status === 'disabled' ? 'disabled' : 'invalid_credentials' },
    });
    throw new HttpError(401, '用户名或密码错误');
  }
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  const tokens = await signTokens(app, user);
  await writeAudit({ action: 'auth.login_success', request, userId: user.id });
  return {
    ...tokens,
    user: { id: user.id, username: user.username, role: user.role },
  };
}

export async function refresh(app: FastifyInstance, token: string) {
  const found = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (!found || found.revokedAt || found.expiresAt < new Date() || found.user.status !== 'active') {
    throw new HttpError(401, 'Refresh Token 无效');
  }
  await prisma.refreshToken.update({ where: { id: found.id }, data: { revokedAt: new Date() } });
  const tokens = await signTokens(app, found.user);
  return {
    ...tokens,
    user: { id: found.user.id, username: found.user.username, role: found.user.role },
  };
}

export async function logout(token: string) {
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashToken(token), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function changePassword(
  request: FastifyRequest,
  userId: string,
  currentPassword: string,
  newPassword: string,
) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.status !== 'active') throw new HttpError(404, '用户不存在或已禁用');
  const matched = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!matched) {
    await writeAudit({
      action: 'auth.password_change_failed',
      request,
      userId,
      detail: { reason: 'invalid_current_password' },
    });
    throw new HttpError(400, '当前密码不正确');
  }
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await bcrypt.hash(newPassword, 12) },
    }),
    prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);
  await writeAudit({ action: 'auth.password_changed', request, userId });
}
