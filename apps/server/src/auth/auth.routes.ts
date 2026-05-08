import bcrypt from 'bcryptjs';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate, requireAdmin } from '../common/auth.js';
import { prisma } from '../common/prisma.js';
import { login, logout, refresh } from './auth.service.js';

const loginSchema = z.object({
  username: z.string().min(1).max(64),
  password: z.string().min(1),
});

const refreshSchema = z.object({ refreshToken: z.string().min(20) });

const createUserSchema = z.object({
  username: z.string().min(2).max(64),
  password: z.string().min(8),
  role: z.enum(['admin', 'operator', 'readonly', 'auditor']).default('operator'),
});

export async function authRoutes(app: FastifyInstance) {
  app.post('/auth/login', async (request) => {
    const body = loginSchema.parse(request.body);
    return login(app, request, body.username, body.password);
  });

  app.post('/auth/refresh', async (request) => {
    const body = refreshSchema.parse(request.body);
    return refresh(app, body.refreshToken);
  });

  app.post('/auth/logout', async (request) => {
    const body = refreshSchema.parse(request.body);
    await logout(body.refreshToken);
    return { success: true };
  });

  app.get('/auth/me', { preHandler: authenticate }, async (request) => ({ user: request.authUser }));

  app.get('/users', { preHandler: [authenticate, requireAdmin] }, async () => {
    return prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        username: true,
        role: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });
  });

  app.post('/users', { preHandler: [authenticate, requireAdmin] }, async (request, reply) => {
    const body = createUserSchema.parse(request.body);
    const user = await prisma.user.create({
      data: {
        username: body.username,
        role: body.role,
        passwordHash: await bcrypt.hash(body.password, 12),
      },
      select: { id: true, username: true, role: true, status: true, createdAt: true },
    });
    return reply.status(201).send(user);
  });
}
