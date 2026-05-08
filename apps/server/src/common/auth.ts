import type { FastifyReply, FastifyRequest } from 'fastify';
import { HttpError } from './errors.js';

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    const payload = (await request.jwtVerify<{
      sub: string;
      username: string;
      role: 'admin' | 'operator' | 'readonly' | 'auditor';
    }>()) as { sub: string; username: string; role: 'admin' | 'operator' | 'readonly' | 'auditor' };
    request.authUser = { id: payload.sub, username: payload.username, role: payload.role };
  } catch {
    reply.status(401).send({ message: '未登录或登录已过期' });
  }
}

export async function requireAdmin(request: FastifyRequest) {
  if (request.authUser?.role !== 'admin') {
    throw new HttpError(403, '需要管理员权限');
  }
}

export function assertCanWriteFiles(role?: string) {
  if (role === 'readonly' || role === 'auditor') throw new HttpError(403, '当前角色无文件写入权限');
}
