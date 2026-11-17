import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearCsrfToken } from '$lib/api/client';
import { apiError, data, mockApi } from '$features/projects/__tests__/fixtures/api-mock';
import Harness from '$features/projects/__tests__/fixtures/Harness.svelte';
import { makeEnvironment } from '$features/projects/__tests__/fixtures/records';
import EnvironmentFormDialog from '../components/EnvironmentFormDialog.svelte';

beforeEach(() => clearCsrfToken());

const renderDialog = (props: Record<string, unknown> = {}) =>
  render(Harness, { props: { component: EnvironmentFormDialog, props: { open: true, projectId: 'p1', ...props } } });

describe('EnvironmentFormDialog', () => {
  it('requires a name and a valid hex colour', async () => {
    const user = userEvent.setup();
    const api = mockApi({});
    renderDialog();

    const color = screen.getByLabelText('Environment colour as hex value');
    await user.clear(color);
    await user.type(color, 'red');
    await user.click(screen.getByRole('button', { name: 'Create environment' }));

    expect(await screen.findByText('Name is required.')).toBeInTheDocument();
    expect(screen.getByText('Use a hex colour such as #22c55e.')).toBeInTheDocument();
    expect(api.calls()).toHaveLength(0);
  });

  it('creates the environment in the given project', async () => {
    const user = userEvent.setup();
    const onsaved = vi.fn();
    const created = makeEnvironment({ name: 'Dev Server', color: '#22c55e', server_label: 'vps-eu-1' });
    const api = mockApi({ 'POST /projects/:id/environments': () => data(created, 201) });
    renderDialog({ onsaved });

    await user.type(screen.getByLabelText(/^Name/), 'Dev Server');
    await user.click(screen.getByRole('radio', { name: '#22c55e' }));
    await user.type(screen.getByLabelText(/^Server label/), 'vps-eu-1');
    await user.click(screen.getByRole('button', { name: 'Create environment' }));

    await waitFor(() => expect(onsaved).toHaveBeenCalledWith(created));
    const [call] = api.calls('POST /projects/:id/environments');
    expect(call?.path).toBe('/projects/p1/environments');
    expect(call?.body).toEqual({ name: 'Dev Server', description: null, color: '#22c55e', server_label: 'vps-eu-1' });
  });

  it('shows a duplicate-name conflict on the name field', async () => {
    const user = userEvent.setup();
    mockApi({
      'POST /projects/:id/environments': () =>
        apiError(409, 'conflict', 'This project already has an environment with this name', {
          name: ['This project already has an environment with this name'],
        }),
    });
    renderDialog();

    await user.type(screen.getByLabelText(/^Name/), 'Production');
    await user.click(screen.getByRole('button', { name: 'Create environment' }));

    const name = screen.getByLabelText(/^Name/);
    await waitFor(() => expect(name).toHaveAttribute('aria-invalid', 'true'));
    expect(name).toHaveAccessibleDescription(/already has an environment with this name/);
    expect(name).toHaveValue('Production');
  });

  it('edits with PATCH and clears an emptied optional field with null', async () => {
    const user = userEvent.setup();
    const environment = makeEnvironment({ server_label: 'vps-eu-1', description: 'shared' });
    const api = mockApi({ 'PATCH /environments/:id': ({ body }) => data({ ...environment, ...(body as object) }) });
    renderDialog({ environment });

    expect(screen.getByLabelText(/^Name/)).toHaveValue('Staging');
    await user.clear(screen.getByLabelText(/^Server label/));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(api.calls('PATCH /environments/:id')).toHaveLength(1));
    expect(api.calls('PATCH /environments/:id')[0]?.body).toEqual({
      name: 'Staging',
      description: 'shared',
      color: '#eab308',
      server_label: null,
    });
  });
});
