import type { components } from '$lib/api/schema';

type Schemas = components['schemas'];

export type AuthOptions = Schemas['AuthOptionsResponse'];
export type LoginRequest = Schemas['LoginRequest'];
/** `POST /auth/login`: signed in, or a code was emailed (`status` discriminates). */
export type LoginResponse = Schemas['LoginResponse'];
export type SessionResponse = Schemas['SessionResponse'];
/** A pending sign-in waiting for the emailed code. */
export type CodeChallenge = Schemas['CodeChallenge'];
export type VerifyLoginCodeRequest = Schemas['VerifyLoginCodeRequest'];
export type ChangePasswordRequest = Schemas['ChangePasswordRequest'];
export type ForgotPasswordRequest = Schemas['ForgotPasswordRequest'];
export type ResetPasswordRequest = Schemas['ResetPasswordRequest'];
