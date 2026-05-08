import type { FastifyReply } from 'fastify';
import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

export function sendError(reply: FastifyReply, error: unknown) {
  if (error instanceof HttpError) {
    return reply.status(error.statusCode).send({ message: error.message });
  }
  if (error instanceof ZodError) {
    return reply.status(400).send({
      message: '请求参数无效',
      issues: error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    });
  }
  const message = error instanceof Error ? error.message : '内部服务错误';
  return reply.status(500).send({ message });
}
