import type { RemoteFile } from '../types/file';
import { useAuthStore } from '../store/authStore';
import { request } from './http';

export function listFiles(serverId: string, path = '.') {
  return request<{ path: string; items: RemoteFile[] }>(
    `/servers/${serverId}/files?${new URLSearchParams({ path }).toString()}`,
  );
}

export function mkdir(serverId: string, path: string) {
  return request<{ success: true }>(`/servers/${serverId}/files/mkdir`, {
    method: 'POST',
    body: JSON.stringify({ path }),
  });
}

export function rename(serverId: string, from: string, to: string) {
  return request<{ success: true }>(`/servers/${serverId}/files/rename`, {
    method: 'POST',
    body: JSON.stringify({ from, to }),
  });
}

export function deleteFile(serverId: string, path: string) {
  return request<{ success: true }>(`/servers/${serverId}/files`, {
    method: 'DELETE',
    body: JSON.stringify({ path }),
  });
}

export function uploadFile(serverId: string, path: string, file: File) {
  const data = new FormData();
  data.set('path', path);
  data.set('file', file);
  return request<{ success: true }>(`/servers/${serverId}/files/upload`, {
    method: 'POST',
    body: data,
  });
}

export async function downloadFile(serverId: string, path: string) {
  const token = useAuthStore.getState().accessToken;
  const response = await fetch(
    `/api/servers/${serverId}/files/download?${new URLSearchParams({ path }).toString()}`,
    { headers: token ? { authorization: `Bearer ${token}` } : undefined },
  );
  if (!response.ok) throw new Error('下载失败');
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = path.split('/').pop() || 'download';
  a.click();
  URL.revokeObjectURL(url);
}
