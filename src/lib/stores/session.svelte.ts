import type { User } from '$lib/types';

export type SessionStatus =
  /** `/auth/me` has not answered yet (app boot). */
  | 'loading'
  | 'authenticated'
  | 'unauthenticated'
  /** The session check failed for a reason other than 401 (network/server). */
  | 'error';

/**
 * Who is signed in. Holds state only — network calls live in
 * `features/auth/session.ts`, which is the only writer besides the API
 * client's 401 hook (wired in `main.ts`).
 */
class SessionStore {
  status = $state<SessionStatus>('loading');
  user = $state<User | null>(null);
  /** Message for the `'error'` status. */
  error = $state<string | null>(null);

  get isAuthenticated(): boolean {
    return this.status === 'authenticated';
  }

  setAuthenticated(user: User): void {
    this.user = user;
    this.error = null;
    this.status = 'authenticated';
  }

  setUnauthenticated(): void {
    this.user = null;
    this.error = null;
    this.status = 'unauthenticated';
  }

  setLoading(): void {
    this.error = null;
    this.status = 'loading';
  }

  setError(message: string): void {
    this.user = null;
    this.error = message;
    this.status = 'error';
  }
}

export const session = new SessionStore();
