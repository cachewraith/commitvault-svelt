import { z } from 'zod';
import { email } from '$lib/validators';

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Password is required.').max(1024, 'Password is too long.'),
});

export type LoginInput = z.infer<typeof loginSchema>;

/** Minimum length enforced by the backend for new passwords. */
export const MIN_PASSWORD_LENGTH = 12;

export const changePasswordSchema = z
  .object({
    current_password: z.string().min(1, 'Current password is required.'),
    new_password: z
      .string()
      .min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters.`)
      .max(1024, 'Password is too long.'),
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
