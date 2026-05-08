import type { AuthType, Credential } from '@prisma/client';
import { prisma } from '../common/prisma.js';
import { decryptJson, encryptJson } from './crypto.service.js';

export type CredentialPayload = {
  password?: string;
  privateKey?: string;
  passphrase?: string;
};

export async function createCredential(type: AuthType, payload: CredentialPayload) {
  return prisma.credential.create({
    data: {
      type,
      encryptedPayload: encryptJson(payload),
    },
  });
}

export async function updateCredential(credential: Credential, payload: CredentialPayload) {
  return prisma.credential.update({
    where: { id: credential.id },
    data: { encryptedPayload: encryptJson(payload), type: credential.type },
  });
}

export function decryptCredential(credential: Credential | null) {
  if (!credential) return {};
  return decryptJson<CredentialPayload>(credential.encryptedPayload);
}
