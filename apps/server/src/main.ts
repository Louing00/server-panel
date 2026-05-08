import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import Fastify from 'fastify';
import { auditRoutes } from './audit/audit.routes.js';
import { authRoutes } from './auth/auth.routes.js';
import './common/types.js';
import { sendError } from './common/errors.js';
import { prisma } from './common/prisma.js';
import { env } from './config/env.js';
import { serverRoutes } from './servers/servers.routes.js';
import { sftpRoutes } from './sftp/sftp.routes.js';
import { registerSshGateway } from './ssh/ssh.gateway.js';

const app = Fastify({
  logger: {
    redact: ['req.headers.authorization', '*.password', '*.privateKey', '*.passphrase', '*.token'],
  },
  bodyLimit: env.MAX_UPLOAD_SIZE_MB * 1024 * 1024,
});

await app.register(cors, {
  origin: env.NODE_ENV === 'production' ? false : true,
  credentials: true,
});
await app.register(jwt, { secret: env.JWT_SECRET });
await app.register(multipart, { limits: { fileSize: env.MAX_UPLOAD_SIZE_MB * 1024 * 1024 } });

app.setErrorHandler((error, _request, reply) => {
  app.log.error(error);
  return sendError(reply, error);
});

app.get('/health', async () => ({ ok: true }));
await app.register(authRoutes, { prefix: '/api' });
await app.register(serverRoutes, { prefix: '/api' });
await app.register(sftpRoutes, { prefix: '/api' });
await app.register(auditRoutes, { prefix: '/api' });

registerSshGateway(app);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, '../../web/dist');
try {
  await app.register(fastifyStatic, { root: publicDir, prefix: '/' });
  app.setNotFoundHandler((request, reply) => {
    if (request.raw.url?.startsWith('/api') || request.raw.url?.startsWith('/ws')) {
      reply.status(404).send({ message: 'Not Found' });
      return;
    }
    reply.sendFile('index.html');
  });
} catch {
  app.log.info('前端 dist 不存在，开发模式下由 Vite 提供页面');
}

const close = async () => {
  await app.close();
  await prisma.$disconnect();
  process.exit(0);
};
process.on('SIGINT', close);
process.on('SIGTERM', close);

await app.listen({ host: '0.0.0.0', port: env.PORT });
