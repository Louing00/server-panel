import type { FastifyInstance } from 'fastify';
import { Client, ClientChannel } from 'ssh2';
import { WebSocketServer, WebSocket } from 'ws';
import { writeAudit } from '../audit/audit.service.js';
import { prisma } from '../common/prisma.js';
import { env } from '../config/env.js';
import { decryptCredential } from '../credentials/credentials.service.js';
import { buildConnectConfig } from './ssh.service.js';

function send(ws: WebSocket, payload: Record<string, unknown>) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
}

export function registerSshGateway(app: FastifyInstance) {
  const wss = new WebSocketServer({ noServer: true });

  app.server.on('upgrade', async (request, socket, head) => {
    const url = new URL(request.url ?? '/', `http://${request.headers.host}`);
    if (url.pathname !== '/ws/ssh') return;

    const token = url.searchParams.get('token');
    const serverId = url.searchParams.get('serverId');
    if (!token || !serverId) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    try {
      const payload = app.jwt.verify<{ sub: string; username: string; role: string }>(token);
      wss.handleUpgrade(request, socket, head, (ws) => {
        void handleSshSocket(ws, serverId, payload.sub, request.headers['user-agent']);
      });
    } catch {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
    }
  });
}

async function handleSshSocket(
  ws: WebSocket,
  serverId: string,
  userId: string,
  userAgent?: string,
) {
  const server = await prisma.server.findUnique({
    where: { id: serverId },
    include: { credential: true },
  });
  if (!server) {
    send(ws, { type: 'error', message: '服务器不存在' });
    ws.close();
    return;
  }

  const session = await prisma.sshSession.create({
    data: { userId, serverId, status: 'connecting' },
  });
  await writeAudit({
    action: 'ssh.open',
    resourceType: 'server',
    resourceId: serverId,
    userId,
    detail: { userAgent },
  });

  const conn = new Client();
  let stream: ClientChannel | undefined;
  let idleTimer: NodeJS.Timeout;

  const refreshIdle = () => {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      send(ws, { type: 'close', reason: '终端空闲超时' });
      conn.end();
      ws.close();
    }, env.SSH_IDLE_TIMEOUT_MS);
  };

  ws.on('message', (raw) => {
    refreshIdle();
    try {
      const message = JSON.parse(raw.toString()) as
        | { type: 'input'; data: string }
        | { type: 'resize'; cols: number; rows: number }
        | { type: 'close' };
      if (message.type === 'input') stream?.write(message.data);
      if (message.type === 'resize') stream?.setWindow(message.rows, message.cols, 0, 0);
      if (message.type === 'close') conn.end();
    } catch {
      send(ws, { type: 'error', message: '终端消息格式无效' });
    }
  });

  ws.on('close', () => {
    conn.end();
  });

  conn
    .on('ready', () => {
      send(ws, { type: 'status', status: 'connected' });
      void prisma.sshSession.update({ where: { id: session.id }, data: { status: 'connected' } });
      conn.shell({ term: 'xterm-256color', cols: 100, rows: 30 }, (error, shell) => {
        if (error) {
          send(ws, { type: 'error', message: error.message });
          return;
        }
        stream = shell;
        shell.on('data', (chunk: Buffer) => send(ws, { type: 'output', data: chunk.toString('utf8') }));
        shell.on('close', () => conn.end());
      });
    })
    .on('error', (error) => {
      send(ws, { type: 'error', message: error.message });
    })
    .on('close', () => {
      clearTimeout(idleTimer);
      void prisma.sshSession.update({
        where: { id: session.id },
        data: { status: 'closed', endedAt: new Date(), closeReason: 'disconnected' },
      });
      send(ws, { type: 'close', reason: 'Disconnected' });
      ws.close();
    })
    .connect(buildConnectConfig(server, decryptCredential(server.credential)));

  refreshIdle();
}
