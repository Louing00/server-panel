import type { UserRole } from '@prisma/client';

export type AuthUser = {
  id: string;
  username: string;
  role: UserRole;
};

declare module 'fastify' {
  interface FastifyRequest {
    authUser?: AuthUser;
  }
}
