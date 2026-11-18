import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { clearCsrfToken } from '$lib/api/client';
import { session } from '$lib/stores/session.svelte';
import { apiError, csrf, inSeconds, json, mockApi } from './fixtures/api';
import LoginPage from './fixtures/LoginPageHarness.svelte';

const user1 = { id: 'u1', email: 'admin@example.com', created_at: '2026-01-01T00:00:00Z' };

function authenticated(csrfToken = 'rotated') {
  return json({ data: { status: 'authenticated', user: user1, csrf_token: csrfToken } });
}

function codeRequired(overrides: Record<string, string> = {}) {
  return json({
    data: {
      status: 'code_required',
      csrf_token: 'pending',
      email_hint: 'a•••@example.com',
      expires_at: inSeconds(600),
      resend_available_at: inSeconds(60),
      ...overrides,
    },
  });
}

type User = ReturnType<typeof userEvent.setup>;

async function signIn(user: User, email = 'admin@example.com', password = 'correct horse') {
  await user.type(screen.getByLabelText('Email'), email);
  await user.type(screen.getByLabelText('Password'), password);
  await user.click(screen.getByRole('button', { name: 'Sign in' }));
}

beforeEach(() => {
  clearCsrfToken();
  session.setUnauthenticated();
});

describe('LoginPage — password step', () => {
  it('validates before calling the API', async () => {
    const user = userEvent.setup();
    const api = mockApi([]);
    render(LoginPage);

    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Email is required.')).toBeInTheDocument();
    expect(screen.getByText('Password is required.')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Email')).toHaveFocus();
    expect(api.calls()).toHaveLength(0);
  });

  it('rejects malformed email addresses', async () => {
    const user = userEvent.setup();
    const api = mockApi([]);
    render(LoginPage);

    await signIn(user, 'not-an-email', 'secret');

    expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument();
    expect(api.calls()).toHaveLength(0);
  });

  it('signs in with the CSRF header and marks the session authenticated', async () => {
    const user = userEvent.setup();
    const api = mockApi([csrf(), authenticated()]);
    render(LoginPage);

    await user.type(screen.getByLabelText('Email'), ' Admin@Example.com ');
    await user.type(screen.getByLabelText('Password'), 'correct horse{Enter}');

    await waitFor(() => expect(session.status).toBe('authenticated'));
    expect(session.user?.email).toBe('admin@example.com');

    const [url, init] = api.calls()[1]!;
    expect(url).toBe('/api/v1/auth/login');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['X-CSRF-Token']).toBe('tok');
    expect(api.body(1)).toEqual({ email: 'Admin@Example.com', password: 'correct horse' });
  });

  it('keeps the form data and explains bad credentials', async () => {
    const user = userEvent.setup();
    mockApi([csrf(), apiError(401, 'invalid_credentials', 'Invalid credentials.')]);
    render(LoginPage);

    await signIn(user, 'admin@example.com', 'wrong-password');

    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect email or password.');
    expect(screen.getByLabelText('Email')).toHaveValue('admin@example.com');
    expect(screen.getByLabelText('Password')).toHaveValue('wrong-password');
    expect(session.status).toBe('unauthenticated');
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled();
  });

  it('locks the form for the Retry-After period when rate limited', async () => {
    const user = userEvent.setup();
    mockApi([csrf(), apiError(429, 'rate_limited', 'Too many login attempts.', { retryAfter: 90 })]);
    render(LoginPage);

    await signIn(user, 'admin@example.com', 'whatever');

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Too many sign-in attempts.');
    expect(alert).toHaveTextContent('Try again in 2 minutes.');
    expect(screen.getByRole('button', { name: /try again in 2 minutes/i })).toBeDisabled();
    expect(screen.getByLabelText('Email')).toHaveValue('admin@example.com');
  });

  it('shows server-side field errors from a 422', async () => {
    const user = userEvent.setup();
    mockApi([
      csrf(),
      apiError(422, 'validation_failed', 'Validation failed.', {
        details: { email: ['Email is not valid.'] },
      }),
    ]);
    render(LoginPage);

    await signIn(user, 'admin@example.com', 'pw');

    expect(await screen.findByText('Email is not valid.')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
  });

  it('toggles password visibility', async () => {
    const user = userEvent.setup();
    mockApi([]);
    render(LoginPage);
    const password = screen.getByLabelText('Password');

    expect(password).toHaveAttribute('type', 'password');
    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(password).toHaveAttribute('type', 'text');
    await user.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(password).toHaveAttribute('type', 'password');
  });

  it('links to password reset with the typed email when email is enabled', async () => {
    const user = userEvent.setup();
    mockApi([]);
    render(LoginPage);

    const link = await screen.findByRole('link', { name: 'Forgot password?' });
    expect(link).toHaveAttribute('href', '/forgot-password');

    await user.type(screen.getByLabelText('Email'), 'admin@example.com');
    expect(link).toHaveAttribute('href', '/forgot-password?email=admin%40example.com');
  });

  it('hides "Forgot password?" when the server cannot send email', async () => {
    const api = mockApi([], { emailEnabled: false });
    render(LoginPage);

    await waitFor(() => expect(api.fetch).toHaveBeenCalled());
    await screen.findByRole('button', { name: 'Sign in' });
    expect(screen.queryByRole('link', { name: 'Forgot password?' })).not.toBeInTheDocument();
  });
});

describe('LoginPage — code step', () => {
  it('asks for the emailed code and signs in after verifying it', async () => {
    const user = userEvent.setup();
    const api = mockApi([csrf(), codeRequired(), authenticated('signed-in')]);
    render(LoginPage);

    await signIn(user);

    expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeInTheDocument();
    expect(screen.getByText('a•••@example.com')).toBeInTheDocument();
    expect(screen.getByText('This browser will be remembered for 90 days.')).toBeInTheDocument();
    expect(screen.getByText('The code expires in 10 minutes.')).toBeInTheDocument();
    expect(session.status).toBe('unauthenticated');

    const input = screen.getByLabelText('Sign-in code');
    expect(input).toHaveAttribute('inputmode', 'numeric');
    expect(input).toHaveAttribute('autocomplete', 'one-time-code');
    expect(input).toHaveFocus();

    await user.type(input, '123 456{Enter}');

    await waitFor(() => expect(session.status).toBe('authenticated'));
    expect(session.user?.email).toBe('admin@example.com');
    const [url, init] = api.calls()[2]!;
    expect(url).toBe('/api/v1/auth/login/verify');
    // The pending sign-in's CSRF token from the login response is used.
    expect((init.headers as Record<string, string>)['X-CSRF-Token']).toBe('pending');
    expect(api.body(2)).toEqual({ code: '123456' });
  });

  it('validates the code before calling the API', async () => {
    const user = userEvent.setup();
    const api = mockApi([csrf(), codeRequired()]);
    render(LoginPage);
    await signIn(user);

    await user.type(await screen.findByLabelText('Sign-in code'), '12a');
    await user.click(screen.getByRole('button', { name: 'Verify code' }));

    expect(await screen.findByText('Enter the 6-digit code from the email.')).toBeInTheDocument();
    expect(api.calls()).toHaveLength(2);
  });

  it('shows a wrong code next to the field and keeps the input', async () => {
    const user = userEvent.setup();
    mockApi([
      csrf(),
      codeRequired(),
      apiError(422, 'validation_failed', 'Validation failed.', {
        details: { code: ['The code is incorrect or has expired'] },
      }),
    ]);
    render(LoginPage);
    await signIn(user);

    const input = await screen.findByLabelText('Sign-in code');
    await user.type(input, '000000{Enter}');

    expect(await screen.findByText('The code is incorrect or has expired')).toBeInTheDocument();
    expect(input).toHaveValue('000000');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveFocus();
    expect(session.status).toBe('unauthenticated');
  });

  it('locks verification for the Retry-After period after too many wrong codes', async () => {
    const user = userEvent.setup();
    mockApi([
      csrf(),
      codeRequired(),
      apiError(429, 'rate_limited', 'Too many attempts.', { retryAfter: 300 }),
    ]);
    render(LoginPage);
    await signIn(user);

    await user.type(await screen.findByLabelText('Sign-in code'), '111111{Enter}');

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Too many incorrect codes.');
    expect(alert).toHaveTextContent('Try again in 5 minutes.');
    expect(screen.getByRole('button', { name: /try again in 5 minutes/i })).toBeDisabled();
    expect(screen.getByLabelText('Sign-in code')).toHaveValue('111111');
  });

  it('returns to the password step when the pending sign-in expired', async () => {
    const user = userEvent.setup();
    mockApi([
      csrf(),
      codeRequired(),
      apiError(401, 'sign_in_expired', 'Sign-in expired. Start again.'),
    ]);
    render(LoginPage);
    await signIn(user);

    await user.type(await screen.findByLabelText('Sign-in code'), '123456{Enter}');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Your sign-in expired. Enter your password again.',
    );
    expect(screen.getByRole('heading', { name: 'Sign in to CommitVault' })).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveValue('admin@example.com');
    expect(screen.getByLabelText('Password')).toHaveValue('');
    expect(screen.getByLabelText('Password')).toHaveFocus();
  });

  it('waits until a new code may be sent', async () => {
    const user = userEvent.setup();
    mockApi([csrf(), codeRequired({ resend_available_at: inSeconds(45) })]);
    render(LoginPage);
    await signIn(user);

    expect(
      await screen.findByRole('button', { name: /send a new code in 4\d seconds/i }),
    ).toBeDisabled();
  });

  it('sends a new code and replaces the challenge', async () => {
    const user = userEvent.setup();
    const api = mockApi([
      csrf(),
      codeRequired({ resend_available_at: inSeconds(-1) }),
      json({
        data: {
          csrf_token: 'pending-2',
          email_hint: 'a•••@example.com',
          expires_at: inSeconds(600),
          resend_available_at: inSeconds(60),
        },
      }),
    ]);
    render(LoginPage);
    await signIn(user);

    await user.click(await screen.findByRole('button', { name: 'Send a new code' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'We sent a new code. The previous code no longer works.',
    );
    expect(api.calls()[2]![0]).toBe('/api/v1/auth/login/resend');
    expect(screen.getByRole('button', { name: /send a new code in 1 minute/i })).toBeDisabled();
  });

  it('explains when a new code was requested too recently', async () => {
    const user = userEvent.setup();
    mockApi([
      csrf(),
      codeRequired({ resend_available_at: inSeconds(-1) }),
      apiError(429, 'rate_limited', 'Too many requests.', { retryAfter: 30 }),
    ]);
    render(LoginPage);
    await signIn(user);

    await user.click(await screen.findByRole('button', { name: 'Send a new code' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('A new code was sent less than a minute ago.');
    expect(alert).toHaveTextContent('You can request another in 30 seconds.');
  });

  it('goes back to the password step with "Use a different account"', async () => {
    const user = userEvent.setup();
    mockApi([csrf(), codeRequired()]);
    render(LoginPage);
    await signIn(user);

    await user.click(await screen.findByRole('button', { name: 'Use a different account' }));

    expect(screen.getByRole('heading', { name: 'Sign in to CommitVault' })).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveValue('admin@example.com');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
