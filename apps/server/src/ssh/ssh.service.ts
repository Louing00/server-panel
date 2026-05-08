import { Client, ConnectConfig } from 'ssh2';
import { env } from '../config/env.js';

export type SshCredential = {
  password?: string;
  privateKey?: string;
  passphrase?: string;
};

export function buildConnectConfig(server: {
  host: string;
  port: number;
  username: string;
}, credential: SshCredential): ConnectConfig {
  return {
    host: server.host,
    port: server.port,
    username: server.username,
    readyTimeout: env.SSH_CONNECT_TIMEOUT_MS,
    keepaliveInterval: 15000,
    ...credential,
  };
}

export async function testSshConnection(
  server: { host: string; port: number; username: string },
  credential: SshCredential,
) {
  const started = Date.now();
  const conn = new Client();
  return new Promise<{ latencyMs: number }>((resolve, reject) => {
    const timer = setTimeout(() => {
      conn.destroy();
      reject(new Error('SSH 连接超时'));
    }, env.SSH_CONNECT_TIMEOUT_MS + 1000);

    conn
      .on('ready', () => {
        clearTimeout(timer);
        conn.end();
        resolve({ latencyMs: Date.now() - started });
      })
      .on('error', (error) => {
        clearTimeout(timer);
        reject(error);
      })
      .connect(buildConnectConfig(server, credential));
  });
}
