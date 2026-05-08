import type { Server, ServerInput, ServerMetrics } from '../types/server';
import { request } from './http';

export function listServers(keyword?: string) {
  const search = new URLSearchParams();
  if (keyword) search.set('keyword', keyword);
  return request<{ items: Server[]; total: number }>(`/servers?${search.toString()}`);
}

export function createServer(payload: ServerInput) {
  return request<Server>('/servers', { method: 'POST', body: JSON.stringify(payload) });
}

export function updateServer(id: string, payload: Partial<ServerInput>) {
  return request<Server>(`/servers/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
}

export function deleteServer(id: string) {
  return request<{ success: true }>(`/servers/${id}`, { method: 'DELETE' });
}

export function testServer(id: string) {
  return request<{ success: true; latencyMs: number; server: Server }>(`/servers/${id}/test`, {
    method: 'POST',
  });
}

export function getServerMetrics(id: string) {
  return request<ServerMetrics>(`/servers/${id}/metrics`);
}

export function refreshServerStatus(ids?: string[]) {
  return request<{
    items: Array<
      | { success: true; latencyMs: number; server: Server }
      | { success: false; message: string; server: Server }
    >;
    total: number;
    online: number;
    offline: number;
  }>('/servers/status/refresh', {
    method: 'POST',
    body: JSON.stringify({ ids }),
  });
}
