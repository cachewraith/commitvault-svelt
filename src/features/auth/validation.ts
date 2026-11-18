import { z } from 'zod';
import { email } from '$lib/validators';

/** Length limits enforced by the backend for passwords. */
export const MIN_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_LENGTH = 256;

/** Digits in an emailed sign-in or password reset code. */
export const CODE_LENGTH = 6;

export const loginSchema = z.object({
  email,
  password: z
    .string()
    .min(1, 'Password is required.')
    .max(MAX_PASSWORD_LENGTH, 'Password is too long.'),
});

export type LoginInput = z.infer<typeof loginSchema>;

/** Six digits; spaces and dashes (e.g. "123 456" pasted from the email) are ignored. */
const oneTimeCode = z
  .string()
  .transform((value) => value.replace(/[\s-]/g, ''))
  .pipe(z.string().regex(/^\d{6}$/, `Enter the ${CODE_LENGTH}-digit code from the email.`));

export const loginCodeSchema = z.object({ code: oneTimeCode });

export type LoginCodeInput = z.infer<typeof loginCodeSchema>;

const newPassword = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters.`)
  .max(MAX_PASSWORD_LENGTH, `Use at most ${MAX_PASSWORD_LENGTH} characters.`);

export const changePasswordSchema = z
  .object({
    current_password: z.string().min(1, 'Current password is required.'),
    new_password: newPassword,
    confirm_password: z.string(),
  })
  .refine((values) => values.new_password === values.confirm_password, {
    path: ['confirm_password'],
    message: 'Passwords do not match.',
  })
  .refine((values) => values.new_password !== values.current_password, {
    path: ['new_password'],
    message: 'Choose a password different from the current one.',
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const forgotPasswordSchema = z.object({ email });

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    code: oneTimeCode,
    new_password: newPassword,
    confirm_password: z.string(),
  })
  .refine((values) => values.new_password === values.confirm_password, {
    path: ['confirm_password'],
    message: 'Passwords do not match.',
  });

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
