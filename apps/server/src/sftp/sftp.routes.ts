import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import type { FastifyInstance } from 'fastify';
import { Client, SFTPWrapper } from 'ssh2';
import { z } from 'zod';
import { writeAudit } from '../audit/audit.service.js';
import { assertCanWriteFiles, authenticate } from '../common/auth.js';
import { HttpError } from '../common/errors.js';
import { prisma } from '../common/prisma.js';
import { decryptCredential } from '../credentials/credentials.service.js';
import { buildConnectConfig } from '../ssh/ssh.service.js';

function normalizeRemotePath(input?: string) {
  const value = input?.trim() || '.';
  if (value.includes('\0')) throw new HttpError(400, '路径无效');
  return path.posix.normalize(value);
}

function modeToString(mode: number) {
  const type = (mode & 0o170000) === 0o040000 ? 'd' : '-';
  const bits = [0o400, 0o200, 0o100, 0o040, 0o020, 0o010, 0o004, 0o002, 0o001];
  const chars = ['r', 'w', 'x', 'r', 'w', 'x', 'r', 'w', 'x'];
  return type + bits.map((bit, index) => (mode & bit ? chars[index] : '-')).join('');
}

async function withSftp<T>(serverId: string, fn: (sftp: SFTPWrapper) => Promise<T>) {
  const server = await prisma.server.findUnique({
    where: { id: serverId },
    include: { credential: true },
  });
  if (!server) throw new HttpError(404, '服务器不存在');
  const conn = new Client();
  const credential = decryptCredential(server.credential);

  return new Promise<T>((resolve, reject) => {
    conn
      .on('ready', () => {
        conn.sftp(async (error, sftp) => {
          if (error) {
            conn.end();
            reject(error);
            return;
          }
          try {
            resolve(await fn(sftp));
          } catch (caught) {
            reject(caught);
          } finally {
            conn.end();
          }
        });
      })
      .on('error', reject)
      .connect(buildConnectConfig(server, credential));
  });
}

function stat(sftp: SFTPWrapper, target: string) {
  return new Promise<Parameters<NonNullable<Parameters<SFTPWrapper['stat']>[1]>>[1]>((resolve, reject) => {
    sftp.stat(target, (error, attrs) => (error ? reject(error) : resolve(attrs)));
  });
}

export async function sftpRoutes(app: FastifyInstance) {
  app.get('/servers/:id/files', { preHandler: authenticate }, async (request) => {
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const query = z.object({ path: z.string().optional() }).parse(request.query);
    const target = normalizeRemotePath(query.path);
    const items = await withSftp(params.id, async (sftp) => {
      const list = await new Promise<Parameters<NonNullable<Parameters<SFTPWrapper['readdir']>[1]>>[1]>(
        (resolve, reject) => {
          sftp.readdir(target, (error, entries) => (error ? reject(error) : resolve(entries)));
        },
      );
      return list.map((entry) => ({
        name: entry.filename,
        path: path.posix.join(target, entry.filename),
        type: entry.attrs.isDirectory() ? 'directory' : 'file',
        size: entry.attrs.size,
        modifyTime: new Date(entry.attrs.mtime * 1000).toISOString(),
        permissions: modeToString(entry.attrs.mode),
      }));
    });
    return { path: target, items };
  });

  app.post('/servers/:id/files/mkdir', { preHandler: authenticate }, async (request) => {
    assertCanWriteFiles(request.authUser?.role);
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = z.object({ path: z.string().min(1) }).parse(request.body);
    const target = normalizeRemotePath(body.path);
    await withSftp(params.id, async (sftp) => {
      await new Promise<void>((resolve, reject) => {
        sftp.mkdir(target, (error) => (error ? reject(error) : resolve()));
      });
    });
    await writeAudit({
      action: 'file.mkdir',
      resourceType: 'server',
      resourceId: params.id,
      request,
      detail: { path: target },
    });
    return { success: true };
  });

  app.post('/servers/:id/files/rename', { preHandler: authenticate }, async (request) => {
    assertCanWriteFiles(request.authUser?.role);
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = z.object({ from: z.string().min(1), to: z.string().min(1) }).parse(request.body);
    const from = normalizeRemotePath(body.from);
    const to = normalizeRemotePath(body.to);
    await withSftp(params.id, async (sftp) => {
      await new Promise<void>((resolve, reject) => {
        sftp.rename(from, to, (error) => (error ? reject(error) : resolve()));
      });
    });
    await writeAudit({
      action: 'file.rename',
      resourceType: 'server',
      resourceId: params.id,
      request,
      detail: { from, to },
    });
    return { success: true };
  });

  app.delete('/servers/:id/files', { preHandler: authenticate }, async (request) => {
    assertCanWriteFiles(request.authUser?.role);
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = z.object({ path: z.string().min(1) }).parse(request.body);
    const target = normalizeRemotePath(body.path);
    await withSftp(params.id, async (sftp) => {
      const attrs = await stat(sftp, target);
      await new Promise<void>((resolve, reject) => {
        const cb = (error?: Error | null) => (error ? reject(error) : resolve());
        if (attrs.isDirectory()) sftp.rmdir(target, cb);
        else sftp.unlink(target, cb);
      });
    });
    await writeAudit({
      action: 'file.delete',
      resourceType: 'server',
      resourceId: params.id,
      request,
      detail: { path: target },
    });
    return { success: true };
  });

  app.get('/servers/:id/files/download', { preHandler: authenticate }, async (request, reply) => {
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const query = z.object({ path: z.string().min(1) }).parse(request.query);
    const target = normalizeRemotePath(query.path);
    await withSftp(params.id, async (sftp) => {
      const attrs = await stat(sftp, target);
      if (attrs.isDirectory()) throw new HttpError(400, '不支持下载目录');
      reply.header('content-type', 'application/octet-stream');
      reply.header('content-length', attrs.size);
      reply.header('content-disposition', `attachment; filename="${encodeURIComponent(path.posix.basename(target))}"`);
      await pipeline(sftp.createReadStream(target), reply.raw);
    });
    await writeAudit({
      action: 'file.download',
      resourceType: 'server',
      resourceId: params.id,
      request,
      detail: { path: target },
    });
    return reply;
  });

  app.post('/servers/:id/files/upload', { preHandler: authenticate }, async (request) => {
    assertCanWriteFiles(request.authUser?.role);
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const part = await request.file();
    if (!part) throw new HttpError(400, '缺少上传文件');
    const pathField = part.fields.path as
      | { value?: unknown }
      | Array<{ value?: unknown }>
      | undefined;
    const targetDir = normalizeRemotePath(
      String(Array.isArray(pathField) ? pathField[0]?.value ?? '.' : pathField?.value ?? '.'),
    );
    const finalPath = path.posix.join(targetDir, part.filename);
    const tempPath = `${finalPath}.uploading-${Date.now()}`;
    await withSftp(params.id, async (sftp) => {
      await pipeline(part.file, sftp.createWriteStream(tempPath));
      await new Promise<void>((resolve, reject) => {
        sftp.rename(tempPath, finalPath, (error) => (error ? reject(error) : resolve()));
      });
    });
    await writeAudit({
      action: 'file.upload',
      resourceType: 'server',
      resourceId: params.id,
      request,
      detail: { path: finalPath, filename: part.filename },
    });
    return { success: true, path: finalPath };
  });
}
