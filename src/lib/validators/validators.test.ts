import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { changePasswordSchema, loginSchema } from '$features/auth/validation';
import {
  branchName,
  commitHash,
  email,
  hexColor,
  optionalHttpUrl,
  optionalText,
  requiredText,
  slug,
  validateForm,
} from './index';

describe('validateForm', () => {
  const schema = z.object({
    name: requiredText('Name', 10),
    description: optionalText('Description', 20),
    repository_url: optionalHttpUrl('Repository URL'),
  });

  it('returns parsed, normalised data on success', () => {
    const result = validateForm(schema, {
      name: '  Vault  ',
      description: '   ',
      repository_url: ' https://github.com/a/b ',
    });

    expect(result.ok).toBe(true);
    expect(result.data).toEqual({
      name: 'Vault',
      description: null,
      repository_url: 'https://github.com/a/b',
    });
    expect(result.errors).toEqual({});
  });

  it('returns the first message per field on failure', () => {
    const result = validateForm(schema, {
      name: '',
      description: 'x'.repeat(21),
      repository_url: 'javascript:alert(1)',
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual({
      name: 'Name is required.',
      description: 'Description must be at most 20 characters.',
      repository_url: 'Repository URL must start with http:// or https://.',
    });
  });

  it('uses dotted paths for nested fields and _form for root issues', () => {
    const nested = z
      .object({ links: z.array(z.object({ url: requiredText('URL') })) })
      .refine(() => false, 'Form is inconsistent.');
    // Zod runs object-level refinements even when a field already failed.
    expect(validateForm(nested, { links: [{ url: '' }] }).errors).toEqual({
      'links.0.url': 'URL is required.',
      _form: 'Form is inconsistent.',
    });
    expect(validateForm(nested, { links: [{ url: 'x' }] }).errors).toEqual({
      _form: 'Form is inconsistent.',
    });
  });
});

describe('field schemas', () => {
  it('validates emails', () => {
    expect(email.safeParse(' admin@example.com ').data).toBe('admin@example.com');
    expect(email.safeParse('').error?.issues[0]?.message).toBe('Email is required.');
    expect(email.safeParse('nope').error?.issues[0]?.message).toBe('Enter a valid email address.');
  });

  it('normalises commit hashes to lowercase', () => {
    expect(commitHash.safeParse(' 9FCEB02D ').data).toBe('9fceb02d');
    expect(commitHash.safeParse('xyz').success).toBe(false);
    expect(commitHash.safeParse('').error?.issues[0]?.message).toBe('Commit hash is required.');
  });

  it('validates slugs, colours and branch names', () => {
    expect(slug.safeParse('dev-server').success).toBe(true);
    expect(slug.safeParse('Dev Server').success).toBe(false);
    expect(slug.safeParse('-dev').success).toBe(false);
    expect(hexColor.safeParse('#22c55e').success).toBe(true);
    expect(hexColor.safeParse('green').success).toBe(false);
    expect(branchName.safeParse('feature/login-rate-limit').success).toBe(true);
    expect(branchName.safeParse('feature login').success).toBe(false);
    expect(branchName.safeParse('').success).toBe(false);
  });
});

describe('auth schemas', () => {
  it('requires email and password to sign in', () => {
    expect(validateForm(loginSchema, { email: '', password: '' }).errors).toEqual({
      email: 'Email is required.',
      password: 'Password is required.',
    });
    expect(validateForm(loginSchema, { email: 'a@b.co', password: ' secret ' }).data).toEqual({
      email: 'a@b.co',
      password: ' secret ',
    });
  });

  it('checks new password rules', () => {
    const base = { current_password: 'old-password-1', new_password: 'a-long-new-passphrase', confirm_password: 'a-long-new-passphrase' };
    expect(validateForm(changePasswordSchema, base).ok).toBe(true);
    expect(validateForm(changePasswordSchema, { ...base, new_password: 'short', confirm_password: 'short' }).errors.new_password).toMatch(/at least 12/);
    expect(validateForm(changePasswordSchema, { ...base, confirm_password: 'different-passphrase' }).errors).toEqual({
      confirm_password: 'Passwords do not match.',
    });
    expect(
      validateForm(changePasswordSchema, {
        current_password: 'same-passphrase-1',
        new_password: 'same-passphrase-1',
        confirm_password: 'same-passphrase-1',
      }).errors.new_password,
    ).toMatch(/different/);
  });
});
