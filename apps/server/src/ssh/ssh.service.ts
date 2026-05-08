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

export async function execSshCommand(
  server: { host: string; port: number; username: string },
  credential: SshCredential,
  command: string,
) {
  const conn = new Client();
  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const timer = setTimeout(() => {
      conn.destroy();
      reject(new Error('SSH 命令执行超时'));
    }, env.SSH_CONNECT_TIMEOUT_MS + 10000);

    conn
      .on('ready', () => {
        conn.exec(command, (error, stream) => {
          if (error) {
            clearTimeout(timer);
            conn.end();
            reject(error);
            return;
          }
          let stdout = '';
          let stderr = '';
          stream
            .on('close', (code: number) => {
              clearTimeout(timer);
              conn.end();
              if (code && code !== 0) {
                reject(new Error(stderr.trim() || `命令退出码 ${code}`));
                return;
              }
              resolve({ stdout, stderr });
            })
            .on('data', (chunk: Buffer) => {
              stdout += chunk.toString('utf8');
            })
            .stderr.on('data', (chunk: Buffer) => {
              stderr += chunk.toString('utf8');
            });
        });
      })
      .on('error', (error) => {
        clearTimeout(timer);
        reject(error);
      })
      .connect(buildConnectConfig(server, credential));
  });
}
