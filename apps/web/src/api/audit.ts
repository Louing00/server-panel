import { request } from './http';

export type AuditLog = {
  id: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  ip?: string;
  userAgent?: string;
  detail?: unknown;
  createdAt: string;
  user?: { username: string };
};

export function listAuditLogs(action?: string) {
  const search = new URLSearchParams();
  if (action) search.set('action', action);
  return request<{ items: AuditLog[]; total: number }>(`/audit-logs?${search.toString()}`);
}
