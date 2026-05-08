import { useAuthStore } from '../store/authStore';

const API_BASE = '/api';

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { accessToken, clear } = useAuthStore.getState();
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData)) headers.set('content-type', 'application/json');
  if (accessToken) headers.set('authorization', `Bearer ${accessToken}`);
  const response = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (response.status === 401) {
    clear();
    window.location.href = '/login';
    throw new Error('登录已过期');
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message || '请求失败');
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
