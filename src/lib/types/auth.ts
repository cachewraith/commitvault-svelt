/** The single administrator account. */
export interface User {
  id: string;
  email: string;
  created_at: string;
}

/** Payload of `POST /auth/login` and `GET /auth/me`. */
export interface AuthSession {
  user: User;
  csrf_token: string;
}
