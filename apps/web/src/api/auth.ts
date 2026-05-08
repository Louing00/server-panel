import { request } from './http';

export function loginApi(payload: { username: string; password: string }) {
  return request<{
    accessToken: string;
    refreshToken: string;
    user: { id: string; username: string; role: string };
  }>('/auth/login', { method: 'POST', body: JSON.stringify(payload) });
}

export function changePasswordApi(payload: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}) {
  return request<{ success: true }>('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
