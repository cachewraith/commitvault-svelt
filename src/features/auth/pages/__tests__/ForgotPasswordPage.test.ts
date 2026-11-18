import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { toast } from 'svelte-sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearCsrfToken } from '$lib/api/client';
import { navigate } from '$lib/router';
import { apiError, csrf, mockApi } from './fixtures/api';
import ForgotPasswordPage from '../ForgotPasswordPage.svelte';

const accepted = () => new Response(null, { status: 202 });
const noContent = () => new Response(null, { status: 204 });

type User = ReturnType<typeof userEvent.setup>;

async function requestCode(user: User, email = 'admin@example.com') {
  await user.type(screen.getByLabelText('Email'), email);
  await user.click(screen.getByRole('button', { name: 'Send code' }));
  return screen.findByLabelText('Reset code');
}

async function fillReset(user: User, code: string, password: string, confirm = password) {
  await user.type(screen.getByLabelText('Reset code'), code);
  await user.type(screen.getByLabelText('New password'), password);
  await user.type(screen.getByLabelText('Confirm new password'), confirm);
  await user.click(screen.getByRole('button', { name: 'Reset password' }));
}

beforeEach(() => {
  clearCsrfToken();
  navigate('/forgot-password', { replace: true });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ForgotPasswordPage', () => {
  it('prefills the email from ?email=', () => {
    mockApi([]);
    navigate('/forgot-password?email=admin%40example.com', { replace: true });
    render(ForgotPasswordPage);

    expect(screen.getByLabelText('Email')).toHaveValue('admin@example.com');
  });

  it('validates the email before calling the API', async () => {
    const user = userEvent.setup();
    const api = mockApi([]);
    render(ForgotPasswordPage);

    await user.click(screen.getByRole('button', { name: 'Send code' }));

    expect(await screen.findByText('Email is required.')).toBeInTheDocument();
    expect(api.calls()).toHaveLength(0);
  });

  it('requests a code, then resets the password and returns to sign-in', async () => {
    const user = userEvent.setup();
    const success = vi.spyOn(toast, 'success');
    const api = mockApi([csrf(), accepted(), noContent()]);
    render(ForgotPasswordPage);

    const codeInput = await requestCode(user, ' admin@example.com ');

    expect(api.calls()[1]![0]).toBe('/api/v1/auth/password/forgot');
    expect(api.body(1)).toEqual({ email: 'admin@example.com' });
    expect(screen.getByRole('heading', { name: 'Check your email' })).toBeInTheDocument();
    expect(screen.getByText(/belongs to the account, we sent/)).toBeInTheDocument();
    expect(codeInput).toHaveAttribute('autocomplete', 'one-time-code');
    expect(codeInput).toHaveFocus();
    // At most one email per minute.
    expect(screen.getByRole('button', { name: /send a new code in 1 minute/i })).toBeDisabled();

    await fillReset(user, '654321', 'a long new passphrase');

    await waitFor(() => expect(window.location.pathname).toBe('/login'));
    const [url, init] = api.calls()[2]!;
    expect(url).toBe('/api/v1/auth/password/reset');
    expect(init.method).toBe('POST');
    expect(api.body(2)).toEqual({
      email: 'admin@example.com',
      code: '654321',
      new_password: 'a long new passphrase',
    });
    expect(success).toHaveBeenCalledWith('Password changed. Sign in with your new password.');
  });

  it('checks the new password and its confirmation before calling the API', async () => {
    const user = userEvent.setup();
    const api = mockApi([csrf(), accepted()]);
    render(ForgotPasswordPage);
    await requestCode(user);

    await fillReset(user, '654321', 'short', 'different');

    expect(await screen.findByText('Use at least 12 characters.')).toBeInTheDocument();
    expect(screen.getByText('Passwords do not match.')).toBeInTheDocument();
    expect(api.calls()).toHaveLength(2);
  });

  it('shows a wrong code next to the field and keeps what was typed', async () => {
    const user = userEvent.setup();
    mockApi([
      csrf(),
      accepted(),
      apiError(422, 'validation_failed', 'Validation failed.', {
        details: { code: ['The code is incorrect or has expired'] },
      }),
    ]);
    render(ForgotPasswordPage);
    await requestCode(user);

    await fillReset(user, '000000', 'a long new passphrase');

    expect(await screen.findByText('The code is incorrect or has expired')).toBeInTheDocument();
    expect(screen.getByLabelText('Reset code')).toHaveValue('000000');
    expect(screen.getByLabelText('Reset code')).toHaveFocus();
    expect(screen.getByLabelText('New password')).toHaveValue('a long new passphrase');
    expect(window.location.pathname).toBe('/forgot-password');
  });

  it('shows the wait time when too many codes were requested', async () => {
    const user = userEvent.setup();
    mockApi([csrf(), apiError(429, 'rate_limited', 'Too many requests.', { retryAfter: 120 })]);
    render(ForgotPasswordPage);

    await user.type(screen.getByLabelText('Email'), 'admin@example.com');
    await user.click(screen.getByRole('button', { name: 'Send code' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Too many reset requests from this browser.');
    expect(alert).toHaveTextContent('Try again in 2 minutes.');
    expect(screen.getByRole('button', { name: /try again in 2 minutes/i })).toBeDisabled();
    expect(screen.getByLabelText('Email')).toHaveValue('admin@example.com');
  });

  it('shows the wait time after too many wrong reset codes', async () => {
    const user = userEvent.setup();
    mockApi([csrf(), accepted(), apiError(429, 'rate_limited', 'Too many attempts.', { retryAfter: 45 })]);
    render(ForgotPasswordPage);
    await requestCode(user);

    await fillReset(user, '111111', 'a long new passphrase');

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Too many incorrect codes.');
    expect(alert).toHaveTextContent('Try again in 45 seconds.');
    expect(screen.getByRole('button', { name: /try again in 45 seconds/i })).toBeDisabled();
  });

  it('explains when password reset by email is not configured', async () => {
    const user = userEvent.setup();
    mockApi([csrf(), apiError(503, 'email_unavailable', 'Email is not configured.')]);
    render(ForgotPasswordPage);

    await user.type(screen.getByLabelText('Email'), 'admin@example.com');
    await user.click(screen.getByRole('button', { name: 'Send code' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Password reset by email is not available because outgoing email is not configured',
    );
    expect(screen.queryByLabelText('Reset code')).not.toBeInTheDocument();
  });

  it('goes back to the email step with "Use a different email"', async () => {
    const user = userEvent.setup();
    mockApi([csrf(), accepted()]);
    render(ForgotPasswordPage);
    await requestCode(user);

    await user.click(screen.getByRole('button', { name: 'Use a different email' }));

    expect(screen.getByRole('heading', { name: 'Reset your password' })).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveValue('admin@example.com');
    expect(screen.getByLabelText('Email')).toHaveFocus();
  });
});
