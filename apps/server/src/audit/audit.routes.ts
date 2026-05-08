import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../common/auth.js';
import { prisma } from '../common/prisma.js';

const querySchema = z.object({
  userId: z.string().uuid().optional(),
  action: z.string().optional(),
  serverId: z.string().uuid().optional(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export async function auditRoutes(app: FastifyInstance) {
  app.get('/audit-logs', { preHandler: authenticate }, async (request) => {
    const query = querySchema.parse(request.query);
    const where = {
      ...(query.userId ? { userId: query.userId } : {}),
      ...(query.action ? { action: { contains: query.action, mode: 'insensitive' as const } } : {}),
      ...(query.serverId ? { resourceId: query.serverId } : {}),
      ...(query.startTime || query.endTime
        ? {
            createdAt: {
              ...(query.startTime ? { gte: new Date(query.startTime) } : {}),
              ...(query.endTime ? { lte: new Date(query.endTime) } : {}),
            },
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: { user: { select: { username: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      prisma.auditLog.count({ where }),
    ]);
    return { items, total, page: query.page, pageSize: query.pageSize };
  });
}
