import type { FastifyRequest } from 'fastify';
import type { Prisma } from '@prisma/client';
import { prisma } from '../common/prisma.js';

type AuditInput = {
  action: string;
  resourceType?: string;
  resourceId?: string;
  detail?: Record<string, unknown>;
  request?: FastifyRequest;
  userId?: string | null;
};

function sanitize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, val]) => [
        key,
        /password|privateKey|passphrase|token/i.test(key) ? '[REDACTED]' : sanitize(val),
      ]),
    );
  }
  return value;
}

export async function writeAudit(input: AuditInput) {
  await prisma.auditLog.create({
    data: {
      userId: input.userId === undefined ? input.request?.authUser?.id : input.userId,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      ip: input.request?.ip,
      userAgent: input.request?.headers['user-agent'],
      detail: input.detail ? (sanitize(input.detail) as Prisma.InputJsonValue) : undefined,
    },
  });
}
