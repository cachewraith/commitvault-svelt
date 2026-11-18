/**
 * Session lifecycle: the only place that talks to `/auth/*` and writes the
 * session store.
 */
import { clearCsrfToken, setCsrfToken } from '$lib/api/client';
import { errorMessage, isApiError } from '$lib/api/errors';
import { queryClient } from '$lib/api/query-client';
import { session } from '$lib/stores/session.svelte';
import {
  authApi,
  type ChangePasswordRequest,
  type ForgotPasswordRequest,
  type LoginRequest,
  type ResetPasswordRequest,
} from './api';
import type { AuthOptions, CodeChallenge, SessionResponse } from './types';

/** What happened after the password was accepted. */
export type LoginOutcome =
  | { status: 'authenticated' }
  /** Not signed in yet: a code was emailed and must be entered with `verifyLoginCode`. */
  | { status: 'code_required'; challenge: CodeChallenge };

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

/** Sign-in options for the login screen (query function). */
export function fetchAuthOptions(signal?: AbortSignal): Promise<AuthOptions> {
  return authApi.options(signal);
}

function completeSignIn(result: SessionResponse): void {
  // The CSRF token rotates on sign-in.
  setCsrfToken(result.csrf_token);
  queryClient.clear();
  session.setAuthenticated(result.user);
}

/**
 * Check the password. Either signs in, or reports that an emailed code is
 * needed. Throws `ApiError` (401 bad credentials, 422 validation, 429 rate limited).
 */
export async function login(credentials: LoginRequest): Promise<LoginOutcome> {
  const result = await authApi.login(credentials);
  if (result.status === 'code_required') {
    // The pending sign-in has its own session id and CSRF token.
    setCsrfToken(result.csrf_token);
    const { status: _status, ...challenge } = result;
    return { status: 'code_required', challenge };
  }
  completeSignIn(result);
  return { status: 'authenticated' };
}

/** A 401 from verify/resend: the pending sign-in no longer exists. */
export function isSignInExpired(error: unknown): boolean {
  return isApiError(error) && error.status === 401;
}

/**
 * Finish a pending sign-in with the emailed code. Throws `ApiError` (422 wrong
 * or expired code, 429 too many attempts, 401 `sign_in_expired`).
 */
export async function verifyLoginCode(code: string): Promise<void> {
  try {
    completeSignIn(await authApi.verifyLoginCode({ code }));
  } catch (error) {
    if (isSignInExpired(error)) clearCsrfToken();
    throw error;
  }
}

/** Email a new code for the pending sign-in; the previous one stops working. */
export async function resendLoginCode(): Promise<CodeChallenge> {
  try {
    const challenge = await authApi.resendLoginCode();
    setCsrfToken(challenge.csrf_token);
    return challenge;
  } catch (error) {
    if (isSignInExpired(error)) clearCsrfToken();
    throw error;
  }
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

/**
 * Ask for a password reset code. Succeeds whether or not the address belongs
 * to the account. Throws `ApiError` (429 rate limited, 503 `email_unavailable`).
 */
export async function requestPasswordReset(body: ForgotPasswordRequest): Promise<void> {
  await authApi.forgotPassword(body);
}

/**
 * Set a new password with the emailed code. The server signs out every session
 * and forgets every trusted browser; the CSRF token is refetched lazily.
 */
export async function resetPassword(body: ResetPasswordRequest): Promise<void> {
  await authApi.resetPassword(body);
  clearCsrfToken();
}
