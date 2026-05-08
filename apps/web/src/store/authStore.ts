import { create } from 'zustand';

type AuthUser = { id: string; username: string; role: string };

type AuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  setSession: (payload: { accessToken: string; refreshToken: string; user: AuthUser }) => void;
  clear: () => void;
};

const saved = JSON.parse(localStorage.getItem('server-panel-auth') || 'null') as
  | Pick<AuthState, 'accessToken' | 'refreshToken' | 'user'>
  | null;

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: saved?.accessToken ?? null,
  refreshToken: saved?.refreshToken ?? null,
  user: saved?.user ?? null,
  setSession: (payload) => {
    localStorage.setItem('server-panel-auth', JSON.stringify(payload));
    set(payload);
  },
  clear: () => {
    localStorage.removeItem('server-panel-auth');
    set({ accessToken: null, refreshToken: null, user: null });
  },
}));
