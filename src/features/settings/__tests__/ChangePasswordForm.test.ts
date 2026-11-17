import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { clearCsrfToken } from '$lib/api/client';
import { apiError, mockApi, noContent } from '$features/projects/__tests__/fixtures/api-mock';
import ChangePasswordForm from '../components/ChangePasswordForm.svelte';

beforeEach(() => clearCsrfToken());

const current = () => screen.getByLabelText(/^Current password/);
const next = () => screen.getByLabelText(/^New password/);
const confirmation = () => screen.getByLabelText(/^Confirm new password/);
const submit = () => screen.getByRole('button', { name: 'Change password' });

describe('ChangePasswordForm', () => {
  it('validates length, confirmation and difference before calling the API', async () => {
    const user = userEvent.setup();
    const api = mockApi({});
    render(ChangePasswordForm);

    await user.click(submit());
    expect(await screen.findByText('Current password is required.')).toBeInTheDocument();
    expect(screen.getByText('Use at least 12 characters.')).toBeInTheDocument();
    expect(current()).toHaveFocus();

    await user.type(current(), 'old passphrase 123');
    await user.type(next(), 'a brand new passphrase');
    await user.type(confirmation(), 'a different passphrase');
    await user.click(submit());
    expect(await screen.findByText('Passwords do not match.')).toBeInTheDocument();

    await user.clear(next());
    await user.type(next(), 'old passphrase 123');
    await user.clear(confirmation());
    await user.type(confirmation(), 'old passphrase 123');
    await user.click(submit());
    expect(await screen.findByText('Choose a password different from the current one.')).toBeInTheDocument();

    expect(api.calls()).toHaveLength(0);
  });

  it('sends only the two passwords and clears the form on success', async () => {
    const user = userEvent.setup();
    const api = mockApi({ 'POST /auth/password': () => noContent() });
    render(ChangePasswordForm);

    await user.type(current(), 'old passphrase 123');
    await user.type(next(), 'a brand new passphrase');
    await user.type(confirmation(), 'a brand new passphrase');
    await user.click(submit());

    await waitFor(() => expect(api.calls('POST /auth/password')).toHaveLength(1));
    expect(api.calls('POST /auth/password')[0]?.body).toEqual({
      current_password: 'old passphrase 123',
      new_password: 'a brand new passphrase',
    });
    await waitFor(() => expect(current()).toHaveValue(''));
    expect(next()).toHaveValue('');
    expect(confirmation()).toHaveValue('');
  });

  it('maps a rejected current password (422) to its field and keeps the input', async () => {
    const user = userEvent.setup();
    mockApi({
      'POST /auth/password': () =>
        apiError(422, 'validation_failed', 'Validation failed', {
          current_password: ['Current password is incorrect'],
        }),
    });
    render(ChangePasswordForm);

    await user.type(current(), 'wrong passphrase 1');
    await user.type(next(), 'a brand new passphrase');
    await user.type(confirmation(), 'a brand new passphrase');
    await user.click(submit());

    await waitFor(() => expect(current()).toHaveAttribute('aria-invalid', 'true'));
    expect(current()).toHaveAccessibleDescription(/Current password is incorrect/);
    expect(current()).toHaveFocus();
    expect(next()).toHaveValue('a brand new passphrase');
  });
});
