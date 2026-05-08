import crypto from 'node:crypto';
import { env } from '../config/env.js';

function getKey() {
  const raw = Buffer.from(env.APP_MASTER_KEY, 'base64');
  if (raw.length === 32) return raw;
  if (env.NODE_ENV === 'production') {
    throw new Error('APP_MASTER_KEY 必须是 base64 编码的 32 字节密钥');
  }
  return crypto.createHash('sha256').update(env.APP_MASTER_KEY).digest();
}

export function encryptJson(payload: Record<string, unknown>) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(payload), 'utf8'),
    cipher.final(),
  ]);
  return JSON.stringify({
    v: 1,
    alg: 'aes-256-gcm',
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    data: ciphertext.toString('base64'),
  });
}

export function decryptJson<T extends Record<string, unknown>>(encryptedPayload: string): T {
  const packed = JSON.parse(encryptedPayload) as { iv: string; tag: string; data: string };
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    getKey(),
    Buffer.from(packed.iv, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(packed.tag, 'base64'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(packed.data, 'base64')),
    decipher.final(),
  ]).toString('utf8');
  return JSON.parse(plaintext) as T;
}
