import { render, screen, waitFor, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { clearCsrfToken } from '$lib/api/client';
import { apiError, data, mockApi, noContent } from '$features/projects/__tests__/fixtures/api-mock';
import Harness from '$features/projects/__tests__/fixtures/Harness.svelte';
import { makeEnvironment, makeProject } from '$features/projects/__tests__/fixtures/records';
import type { Environment } from '../types';
import EnvironmentManagePage from '../pages/EnvironmentManagePage.svelte';

beforeEach(() => clearCsrfToken());

const development = makeEnvironment({ id: 'e-dev', name: 'Development', slug: 'development', position: 0 });
const staging = makeEnvironment({ id: 'e-stg', name: 'Staging', slug: 'staging', position: 1, deployment_count: 3 });
const production = makeEnvironment({ id: 'e-prd', name: 'Production', slug: 'production', position: 2, deployment_count: 1 });

function setup(routes: Parameters<typeof mockApi>[0] = {}, environments: Environment[] = [development, staging, production]) {
  const api = mockApi({
    'GET /projects/:id': () => data(makeProject({ name: 'Shop' })),
    'GET /projects/:id/environments': () => data(environments),
    ...routes,
  });
  render(Harness, { props: { component: EnvironmentManagePage, props: { projectId: 'p1' } } });
  return api;
}

const names = () =>
  within(screen.getByRole('list', { name: 'Environments in display order' }))
    .getAllByRole('listitem')
    .map((item) => item.textContent?.match(/Development|Staging|Production/)?.[0]);

describe('EnvironmentManagePage', () => {
  it('lists environments in order and says when no deployment is recorded', async () => {
    setup();
    await screen.findByText('Staging');
    expect(names()).toEqual(['Development', 'Staging', 'Production']);
    expect(screen.getAllByText('No deployment recorded')).toHaveLength(3);
    expect(screen.getByRole('button', { name: 'Move Development up' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move Production down' })).toBeDisabled();
  });

  it('reorders optimistically and sends the complete id list', async () => {
    const user = userEvent.setup();
    // A small stateful server: the saved order is what later reads return.
    let stored = [development, staging, production];
    const api = mockApi({
      'GET /projects/:id': () => data(makeProject({ name: 'Shop' })),
      'GET /projects/:id/environments': () => data(stored),
      'PUT /projects/:id/environments/order': ({ body }) => {
        const ids = (body as { environment_ids: string[] }).environment_ids;
        const byId = new Map(stored.map((environment) => [environment.id, environment]));
        stored = ids.map((id, position) => ({ ...byId.get(id)!, position }));
        return data(stored);
      },
    });
    render(Harness, { props: { component: EnvironmentManagePage, props: { projectId: 'p1' } } });
    await screen.findByText('Staging');

    await user.click(screen.getByRole('button', { name: 'Move Production up' }));

    await waitFor(() => expect(api.calls('PUT /projects/:id/environments/order')).toHaveLength(1));
    const [call] = api.calls('PUT /projects/:id/environments/order');
    expect(call?.path).toBe('/projects/p1/environments/order');
    expect(call?.body).toEqual({ environment_ids: ['e-dev', 'e-prd', 'e-stg'] });
    await waitFor(() => expect(names()).toEqual(['Development', 'Production', 'Staging']));
    expect(screen.getByRole('status')).toHaveTextContent('Production moved to position 2 of 3.');

    // A second move builds on the new order.
    await user.click(screen.getByRole('button', { name: 'Move Production up' }));
    await waitFor(() => expect(api.calls('PUT /projects/:id/environments/order')).toHaveLength(2));
    expect(api.calls('PUT /projects/:id/environments/order')[1]?.body).toEqual({
      environment_ids: ['e-prd', 'e-dev', 'e-stg'],
    });
  });

  it('rolls the order back when the server rejects it', async () => {
    const user = userEvent.setup();
    setup({
      'PUT /projects/:id/environments/order': () => apiError(500, 'internal_error', 'An unexpected error occurred'),
    });
    await screen.findByText('Staging');

    await user.click(screen.getByRole('button', { name: 'Move Development down' }));

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('could not be saved'));
    expect(names()).toEqual(['Development', 'Staging', 'Production']);
  });

  it('deletes an environment without records after a plain confirmation', async () => {
    const user = userEvent.setup();
    const api = setup({ 'DELETE /environments/:id': () => noContent() });
    await screen.findByText('Staging');

    await user.click(screen.getByRole('button', { name: 'Delete Development' }));
    expect(await screen.findByText('No deployments are recorded for it. This cannot be undone.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete environment' }));

    await waitFor(() => expect(api.calls('DELETE /environments/:id')).toHaveLength(1));
    const [call] = api.calls('DELETE /environments/:id');
    expect(call?.path).toBe('/environments/e-dev');
    expect(call?.query.has('cascade')).toBe(false);
  });

  it('warns that deployment records are deleted too and only then cascades', async () => {
    const user = userEvent.setup();
    const api = setup({ 'DELETE /environments/:id': () => noContent() });
    await screen.findByText('Staging');

    await user.click(screen.getByRole('button', { name: 'Delete Staging' }));

    expect(await screen.findByText(/3 deployment records belong to this environment/)).toBeInTheDocument();
    expect(screen.getByText(/will also delete those 3 records/)).toBeInTheDocument();
    // Nothing happens until the user confirms.
    expect(api.calls('DELETE /environments/:id')).toHaveLength(0);

    await user.click(screen.getByRole('button', { name: 'Also delete 3 deployment records' }));

    await waitFor(() => expect(api.calls('DELETE /environments/:id')).toHaveLength(1));
    const [call] = api.calls('DELETE /environments/:id');
    expect(call?.path).toBe('/environments/e-stg');
    expect(call?.query.get('cascade')).toBe('true');
  });

  it('does not delete when the confirmation is cancelled', async () => {
    const user = userEvent.setup();
    const api = setup({ 'DELETE /environments/:id': () => noContent() });
    await screen.findByText('Staging');

    await user.click(screen.getByRole('button', { name: 'Delete Production' }));
    await screen.findByText(/1 deployment record belongs to this environment/);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByText(/belongs to this environment/)).not.toBeInTheDocument());
    expect(api.calls('DELETE /environments/:id')).toHaveLength(0);
  });

  it('offers name suggestions only while the project has no environments', async () => {
    const user = userEvent.setup();
    setup({}, []);

    expect(await screen.findByText('No environments yet')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Production' }));

    // The suggestion only pre-fills the form; nothing is created yet.
    expect(await screen.findByLabelText(/^Name/)).toHaveValue('Production');
  });
});
