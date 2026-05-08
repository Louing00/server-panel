import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { writeAudit } from '../audit/audit.service.js';
import { authenticate, requireAdmin } from '../common/auth.js';
import { HttpError } from '../common/errors.js';
import { prisma } from '../common/prisma.js';
import { createCredential, decryptCredential, updateCredential } from '../credentials/credentials.service.js';
import { execSshCommand, testSshConnection } from '../ssh/ssh.service.js';

const credentialSchema = z
  .object({
    password: z.string().optional(),
    privateKey: z.string().optional(),
    passphrase: z.string().optional(),
  })
  .optional();

const serverSchema = z.object({
  name: z.string().min(1).max(128),
  host: z.string().min(1).max(255),
  port: z.coerce.number().int().min(1).max(65535).default(22),
  username: z.string().min(1).max(128),
  authType: z.enum(['password', 'privateKey', 'privateKeyWithPassphrase']),
  credential: credentialSchema,
  tags: z.array(z.string().min(1).max(32)).default([]),
  groupId: z.string().uuid().nullable().optional(),
  description: z.string().nullable().optional(),
});

const listSchema = z.object({
  keyword: z.string().optional(),
  groupId: z.string().uuid().optional(),
  tag: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

function publicServer<T extends { credentialId?: string | null; credential?: unknown }>(server: T) {
  const { credential, ...rest } = server;
  return { ...rest, hasCredential: Boolean(rest.credentialId) };
}

function section(output: string, name: string) {
  const start = output.indexOf(`__${name}__`);
  if (start < 0) return '';
  const next = output.indexOf('__', start + name.length + 4);
  return output
    .slice(start + name.length + 4, next < 0 ? undefined : next)
    .trim();
}

function parseCpu(line: string) {
  const values = line
    .trim()
    .split(/\s+/)
    .slice(1)
    .map((item) => Number(item));
  const idle = (values[3] || 0) + (values[4] || 0);
  const total = values.reduce((sum, value) => sum + value, 0);
  return { idle, total };
}

function percent(used: number, total: number) {
  if (!Number.isFinite(used) || !Number.isFinite(total) || total <= 0) return 0;
  return Math.round((used / total) * 1000) / 10;
}

function parseServerMetrics(output: string) {
  const cpu1 = parseCpu(section(output, 'CPU1').split('\n')[0] || '');
  const cpu2 = parseCpu(section(output, 'CPU2').split('\n')[0] || '');
  const cpuTotalDiff = cpu2.total - cpu1.total;
  const cpuIdleDiff = cpu2.idle - cpu1.idle;
  const meminfo = Object.fromEntries(
    section(output, 'MEM')
      .split('\n')
      .map((line) => {
        const match = line.match(/^(\w+):\s+(\d+)/);
        return match ? [match[1], Number(match[2]) * 1024] : null;
      })
      .filter((item): item is [string, number] => Boolean(item)),
  );
  const memoryTotal = meminfo.MemTotal || 0;
  const memoryAvailable = meminfo.MemAvailable || 0;
  const memoryUsed = Math.max(memoryTotal - memoryAvailable, 0);

  const diskLines = section(output, 'DISK').split('\n');
  const diskParts = (diskLines[1] || '').trim().split(/\s+/);
  const diskTotal = Number(diskParts[1] || 0);
  const diskUsed = Number(diskParts[2] || 0);
  const diskAvailable = Number(diskParts[3] || 0);

  const network = section(output, 'NET')
    .split('\n')
    .slice(2)
    .reduce(
      (acc, line) => {
        const [rawName, rawStats] = line.trim().split(':');
        if (!rawName || !rawStats || rawName.trim() === 'lo') return acc;
        const stats = rawStats.trim().split(/\s+/).map(Number);
        return {
          rxBytes: acc.rxBytes + (stats[0] || 0),
          txBytes: acc.txBytes + (stats[8] || 0),
        };
      },
      { rxBytes: 0, txBytes: 0 },
    );

  const uptimeSeconds = Number(section(output, 'UPTIME').split(/\s+/)[0] || 0);
  const hostname = section(output, 'HOSTNAME').split('\n')[0] || '';

  return {
    hostname,
    collectedAt: new Date().toISOString(),
    cpu: {
      usagePercent: percent(cpuTotalDiff - cpuIdleDiff, cpuTotalDiff),
    },
    memory: {
      totalBytes: memoryTotal,
      usedBytes: memoryUsed,
      availableBytes: memoryAvailable,
      usagePercent: percent(memoryUsed, memoryTotal),
    },
    disk: {
      mount: '/',
      totalBytes: diskTotal,
      usedBytes: diskUsed,
      availableBytes: diskAvailable,
      usagePercent: percent(diskUsed, diskTotal),
    },
    network: {
      rxBytes: network.rxBytes,
      txBytes: network.txBytes,
      totalBytes: network.rxBytes + network.txBytes,
    },
    uptimeSeconds: Number.isFinite(uptimeSeconds) ? uptimeSeconds : 0,
  };
}

async function testAndUpdateServer(serverId: string, request?: Parameters<typeof writeAudit>[0]['request']) {
  const server = await prisma.server.findUnique({
    where: { id: serverId },
    include: { credential: true },
  });
  if (!server) throw new HttpError(404, '服务器不存在');

  try {
    const result = await testSshConnection(server, decryptCredential(server.credential));
    const updated = await prisma.server.update({
      where: { id: server.id },
      data: { status: 'online', lastSuccessAt: new Date(), lastFailureReason: null },
    });
    await writeAudit({
      action: 'server.test_success',
      resourceType: 'server',
      resourceId: server.id,
      request,
      detail: result,
    });
    return { server: publicServer(updated), success: true, latencyMs: result.latencyMs };
  } catch (error) {
    const message = error instanceof Error ? error.message : '连接失败';
    const updated = await prisma.server.update({
      where: { id: server.id },
      data: { status: 'offline', lastFailureAt: new Date(), lastFailureReason: message },
    });
    await writeAudit({
      action: 'server.test_failed',
      resourceType: 'server',
      resourceId: server.id,
      request,
      detail: { message },
    });
    return { server: publicServer(updated), success: false, message };
  }
}

export async function serverRoutes(app: FastifyInstance) {
  app.get('/servers', { preHandler: authenticate }, async (request) => {
    const query = listSchema.parse(request.query);
    const where = {
      ...(query.keyword
        ? {
            OR: [
              { name: { contains: query.keyword, mode: 'insensitive' as const } },
              { host: { contains: query.keyword, mode: 'insensitive' as const } },
              { username: { contains: query.keyword, mode: 'insensitive' as const } },
            ],
          }
        : {}),
      ...(query.groupId ? { groupId: query.groupId } : {}),
      ...(query.tag ? { tags: { has: query.tag } } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.server.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: { group: true },
      }),
      prisma.server.count({ where }),
    ]);
    return { items: items.map(publicServer), total, page: query.page, pageSize: query.pageSize };
  });

  app.post('/servers', { preHandler: [authenticate, requireAdmin] }, async (request, reply) => {
    const body = serverSchema.parse(request.body);
    const credential = body.credential ? await createCredential(body.authType, body.credential) : null;
    const server = await prisma.server.create({
      data: {
        name: body.name,
        host: body.host,
        port: body.port,
        username: body.username,
        authType: body.authType,
        credentialId: credential?.id,
        tags: body.tags,
        groupId: body.groupId ?? undefined,
        description: body.description ?? undefined,
        createdBy: request.authUser?.id,
      },
    });
    await writeAudit({
      action: 'server.create',
      resourceType: 'server',
      resourceId: server.id,
      request,
      detail: body,
    });
    return reply.status(201).send(publicServer(server));
  });

  app.put('/servers/:id', { preHandler: [authenticate, requireAdmin] }, async (request) => {
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = serverSchema.partial().parse(request.body);
    const current = await prisma.server.findUnique({
      where: { id: params.id },
      include: { credential: true },
    });
    if (!current) throw new HttpError(404, '服务器不存在');

    let credentialId = current.credentialId;
    if (body.credential) {
      if (current.credential) {
        await updateCredential(current.credential, body.credential);
      } else {
        const created = await createCredential(body.authType ?? current.authType, body.credential);
        credentialId = created.id;
      }
    }

    const server = await prisma.server.update({
      where: { id: params.id },
      data: {
        name: body.name,
        host: body.host,
        port: body.port,
        username: body.username,
        authType: body.authType,
        credentialId,
        tags: body.tags,
        groupId: body.groupId === null ? null : body.groupId,
        description: body.description,
      },
    });
    await writeAudit({
      action: 'server.update',
      resourceType: 'server',
      resourceId: server.id,
      request,
      detail: body,
    });
    return publicServer(server);
  });

  app.delete('/servers/:id', { preHandler: [authenticate, requireAdmin] }, async (request) => {
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    await prisma.server.delete({ where: { id: params.id } });
    await writeAudit({
      action: 'server.delete',
      resourceType: 'server',
      resourceId: params.id,
      request,
    });
    return { success: true };
  });

  app.post('/servers/:id/test', { preHandler: authenticate }, async (request, reply) => {
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const result = await testAndUpdateServer(params.id, request);
    if (!result.success) return reply.status(400).send(result);
    return result;
  });

  app.get('/servers/:id/metrics', { preHandler: authenticate }, async (request) => {
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const server = await prisma.server.findUnique({
      where: { id: params.id },
      include: { credential: true },
    });
    if (!server) throw new HttpError(404, '服务器不存在');

    const command = [
      'printf "__CPU1__\\n"',
      'head -n1 /proc/stat',
      'sleep 1',
      'printf "__CPU2__\\n"',
      'head -n1 /proc/stat',
      'printf "__MEM__\\n"',
      'cat /proc/meminfo',
      'printf "__DISK__\\n"',
      'df -B1 -P /',
      'printf "__NET__\\n"',
      'cat /proc/net/dev',
      'printf "__UPTIME__\\n"',
      'cat /proc/uptime',
      'printf "__HOSTNAME__\\n"',
      'hostname',
    ].join(' && ');

    try {
      const { stdout } = await execSshCommand(server, decryptCredential(server.credential), command);
      const metrics = parseServerMetrics(stdout);
      await prisma.server.update({
        where: { id: server.id },
        data: { status: 'online', lastSuccessAt: new Date(), lastFailureReason: null },
      });
      await writeAudit({
        action: 'server.metrics_view',
        resourceType: 'server',
        resourceId: server.id,
        request,
      });
      return metrics;
    } catch (error) {
      const message = error instanceof Error ? error.message : '服务器详情获取失败';
      await prisma.server.update({
        where: { id: server.id },
        data: { status: 'offline', lastFailureAt: new Date(), lastFailureReason: message },
      });
      throw new HttpError(400, message);
    }
  });

  app.post('/servers/status/refresh', { preHandler: authenticate }, async (request) => {
    const body = z.object({ ids: z.array(z.string().uuid()).optional() }).parse(request.body ?? {});
    const servers = await prisma.server.findMany({
      where: body.ids?.length ? { id: { in: body.ids } } : undefined,
      select: { id: true },
      orderBy: { updatedAt: 'desc' },
    });
    const results = [];
    for (const server of servers) {
      results.push(await testAndUpdateServer(server.id, request));
    }
    return {
      items: results,
      total: results.length,
      online: results.filter((item) => item.success).length,
      offline: results.filter((item) => !item.success).length,
    };
  });
}
