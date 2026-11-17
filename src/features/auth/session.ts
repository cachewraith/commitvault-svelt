/**
 * Session lifecycle: the only place that talks to `/auth/*` and writes the
 * session store.
 */
import { clearCsrfToken, setCsrfToken } from '$lib/api/client';
import { errorMessage, isApiError } from '$lib/api/errors';
import { queryClient } from '$lib/api/query-client';
import { session } from '$lib/stores/session.svelte';
import { authApi, type ChangePasswordRequest, type LoginRequest } from './api';

/** Resolve the session on app boot. Never throws. */
export async function bootstrapSession(): Promise<void> {
  session.setLoading();
  try {
    const result = await authApi.me();
    setCsrfToken(result.csrf_token);
    session.setAuthenticated(result.user);
  } catch (error) {
    if (isApiError(error) && error.status === 401) {
      session.setUnauthenticated();
    } else {
      session.setError(errorMessage(error, 'Could not reach the server.'));
    }
  }
}

/** Sign in. Throws `ApiError` (401 bad credentials, 422 validation, 429 rate limited). */
export async function login(credentials: LoginRequest): Promise<void> {
  const result = await authApi.login(credentials);
  // The CSRF token rotates on login.
  setCsrfToken(result.csrf_token);
  queryClient.clear();
  session.setAuthenticated(result.user);
}

/** Sign out. Local state is cleared even when the request fails. */
export async function logout(): Promise<void> {
  try {
    await authApi.logout();
  } finally {
    endSession();
  }
}

/** Drop all client-side session state (also used by the API client's 401 hook). */
export function endSession(): void {
  clearCsrfToken();
  queryClient.clear();
  session.setUnauthenticated();
}

/** Change the password. The server rotates the session; the CSRF token is refetched lazily. */
export async function changePassword(body: ChangePasswordRequest): Promise<void> {
  await authApi.changePassword(body);
  clearCsrfToken();
}
