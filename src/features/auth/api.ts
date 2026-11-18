import { api } from '$lib/api/client';
import type {
  AuthOptions,
  ChangePasswordRequest,
  CodeChallenge,
  ForgotPasswordRequest,
  LoginRequest,
  LoginResponse,
  ResetPasswordRequest,
  SessionResponse,
  VerifyLoginCodeRequest,
} from './types';

export type {
  ChangePasswordRequest,
  ForgotPasswordRequest,
  LoginRequest,
  ResetPasswordRequest,
  VerifyLoginCodeRequest,
} from './types';

/** Endpoint functions. Call them through `./session`, which owns the session state. */
export const authApi = {
  /** Current session, or throws `ApiError` 401 when signed out. */
  me: (signal?: AbortSignal) => api.get<SessionResponse>('/auth/me', { signal }),

  /** Whether email-based features (sign-in codes, password reset) are available. */
  options: (signal?: AbortSignal) => api.get<AuthOptions>('/auth/options', { signal }),

  login: (body: LoginRequest) => api.post<LoginResponse>('/auth/login', body),

  verifyLoginCode: (body: VerifyLoginCodeRequest) =>
    api.post<SessionResponse>('/auth/login/verify', body),

  resendLoginCode: () => api.post<CodeChallenge>('/auth/login/resend'),

  logout: () => api.post<void>('/auth/logout'),

  changePassword: (body: ChangePasswordRequest) => api.post<void>('/auth/password', body),

  /** Always 202, whether or not the address belongs to the account. */
  forgotPassword: (body: ForgotPasswordRequest) => api.post<void>('/auth/password/forgot', body),

  resetPassword: (body: ResetPasswordRequest) => api.post<void>('/auth/password/reset', body),
};
