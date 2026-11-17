import { api } from '$lib/api/client';
import type { AuthSession } from '$lib/types';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}

export const authApi = {
  /** Current session, or throws `ApiError` 401 when signed out. */
  me: (signal?: AbortSignal) => api.get<AuthSession>('/auth/me', { signal }),

  login: (body: LoginRequest) => api.post<AuthSession>('/auth/login', body),

  logout: () => api.post<void>('/auth/logout'),

  changePassword: (body: ChangePasswordRequest) => api.post<void>('/auth/password', body),
};
