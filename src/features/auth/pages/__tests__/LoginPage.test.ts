import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearCsrfToken } from '$lib/api/client';
import { session } from '$lib/stores/session.svelte';
import LoginPage from '../LoginPage.svelte';

function json(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

const csrf = () => json({ data: { csrf_token: 'tok' } });

function mockFetch(...responses: Response[]) {
  const queue = [...responses];
  const fn = vi.fn(async (_input: string, _init: RequestInit) => {
    const next = queue.shift();
    if (!next) throw new Error('Unexpected fetch call');
    return next;
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

beforeEach(() => {
  clearCsrfToken();
  session.setUnauthenticated();
});

describe('LoginPage', () => {
  it('validates before calling the API', async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetch();
    render(LoginPage);

    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Email is required.')).toBeInTheDocument();
    expect(screen.getByText('Password is required.')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Email')).toHaveFocus();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects malformed email addresses', async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetch();
    render(LoginPage);

    await user.type(screen.getByLabelText('Email'), 'not-an-email');
    await user.type(screen.getByLabelText('Password'), 'secret');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('signs in with the CSRF header and marks the session authenticated', async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetch(
      csrf(),
      json({
        data: {
          user: { id: 'u1', email: 'admin@example.com', created_at: '2026-01-01T00:00:00Z' },
          csrf_token: 'rotated',
        },
      }),
    );
    render(LoginPage);

    await user.type(screen.getByLabelText('Email'), ' Admin@Example.com ');
    await user.type(screen.getByLabelText('Password'), 'correct horse{Enter}');

    await waitFor(() => expect(session.status).toBe('authenticated'));
    expect(session.user?.email).toBe('admin@example.com');

    const [url, init] = fetchMock.mock.calls[1]!;
    expect(url).toBe('/api/v1/auth/login');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['X-CSRF-Token']).toBe('tok');
    expect(JSON.parse(init.body as string)).toEqual({
      email: 'Admin@Example.com',
      password: 'correct horse',
    });
  });

  it('keeps the form data and explains bad credentials', async () => {
    const user = userEvent.setup();
    mockFetch(
      csrf(),
      json({ error: { code: 'unauthorized', message: 'Invalid credentials.' } }, { status: 401 }),
    );
    render(LoginPage);

    await user.type(screen.getByLabelText('Email'), 'admin@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrong-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect email or password.');
    expect(screen.getByLabelText('Email')).toHaveValue('admin@example.com');
    expect(screen.getByLabelText('Password')).toHaveValue('wrong-password');
    expect(session.status).toBe('unauthenticated');
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled();
  });

  it('locks the form for the Retry-After period when rate limited', async () => {
    const user = userEvent.setup();
    mockFetch(
      csrf(),
      json(
        { error: { code: 'rate_limited', message: 'Too many login attempts.' } },
        { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': '90' } },
      ),
    );
    render(LoginPage);

    await user.type(screen.getByLabelText('Email'), 'admin@example.com');
    await user.type(screen.getByLabelText('Password'), 'whatever');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Too many sign-in attempts.');
    expect(alert).toHaveTextContent('Try again in 2 minutes.');
    expect(screen.getByRole('button', { name: /try again in 2 minutes/i })).toBeDisabled();
    expect(screen.getByLabelText('Email')).toHaveValue('admin@example.com');
  });

  it('shows server-side field errors from a 422', async () => {
    const user = userEvent.setup();
    mockFetch(
      csrf(),
      json(
        {
          error: {
            code: 'validation_failed',
            message: 'Validation failed.',
            details: { email: ['Email is not valid.'] },
          },
        },
        { status: 422 },
      ),
    );
    render(LoginPage);

    await user.type(screen.getByLabelText('Email'), 'admin@example.com');
    await user.type(screen.getByLabelText('Password'), 'pw');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Email is not valid.')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
  });

  it('toggles password visibility', async () => {
    const user = userEvent.setup();
    mockFetch();
    render(LoginPage);
    const password = screen.getByLabelText('Password');

    expect(password).toHaveAttribute('type', 'password');
    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(password).toHaveAttribute('type', 'text');
    await user.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(password).toHaveAttribute('type', 'password');
  });
});
