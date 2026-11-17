import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearCsrfToken } from '$lib/api/client';
import { apiError, data, list, mockApi } from '$features/commits/__tests__/fixtures/api';
import QueryHarness from '$features/commits/__tests__/fixtures/QueryHarness.svelte';
import { commit, deployment, environment, project } from '$features/commits/__tests__/fixtures/records';
import DeploymentFormDialog from '../DeploymentFormDialog.svelte';

// Pickers owned by other features are replaced by plain inputs.
vi.mock('$features/projects/components/ProjectSelect.svelte', async () => ({
  default: (await import('$features/commits/__tests__/fixtures/StubSelect.svelte')).default,
}));
vi.mock('$features/environments/components/EnvironmentSelect.svelte', async () => ({
  default: (await import('$features/commits/__tests__/fixtures/StubSelect.svelte')).default,
}));
vi.mock('$features/tags/components/TagPicker.svelte', async () => ({
  default: (await import('$features/commits/__tests__/fixtures/StubSelect.svelte')).default,
}));

const baseRoutes = {
  'GET /projects/p1': () => data(project),
  'GET /projects/p1/environments': () => data([environment('e1', 'Production'), environment('e2', 'Staging')]),
  'GET /commits/c1': () => data(commit()),
  'GET /commits': () => list([commit()]),
};

function renderDialog(props: Record<string, unknown> = {}) {
  return render(QueryHarness, {
    props: { component: DeploymentFormDialog, props: { open: true, projectId: 'p1', ...props } },
  });
}

beforeEach(() => clearCsrfToken());

describe('DeploymentFormDialog', () => {
  it('suggests a title from the commit and environment and posts the record', async () => {
    const user = userEvent.setup();
    const onsaved = vi.fn();
    const api = mockApi({
      ...baseRoutes,
      'POST /projects/p1/deployments': () => data(deployment(), { status: 201 }),
    });
    renderDialog({ environmentId: 'e1', commitId: 'c1', onsaved });

    const title = screen.getByLabelText(/^Title/);
    await waitFor(() => expect(title).toHaveValue('Deploy 9fceb02 to Production'));
    expect(screen.getByText('Stored as documentation. CommitVault never runs commands.')).toBeInTheDocument();

    await user.clear(screen.getByLabelText(/^Deployed at/));
    await user.type(screen.getByLabelText(/^Deployed at/), '2026-03-02T09:15');
    await user.type(screen.getByLabelText(/^Notes/), 'sqlx migrate run');
    await user.click(screen.getByRole('button', { name: 'Record deployment' }));

    await waitFor(() => expect(onsaved).toHaveBeenCalledOnce());
    const [post] = api.find('POST', '/projects/p1/deployments');
    expect(post!.headers['X-CSRF-Token']).toBe('test-token');
    expect(post!.body).toEqual({
      environment_id: 'e1',
      commit_id: 'c1',
      deployment_title: 'Deploy 9fceb02 to Production',
      status: 'successful',
      deployed_at: new Date('2026-03-02T09:15').toISOString(),
      deployment_notes: 'sqlx migrate run',
      tag_ids: [],
    });
  });

  it('stops suggesting once the title was edited', async () => {
    const user = userEvent.setup();
    mockApi(baseRoutes);
    renderDialog({ commitId: 'c1' });

    const title = screen.getByLabelText(/^Title/);
    await user.type(title, 'Friday release');
    await user.type(screen.getByLabelText(/^Environment/), 'e1');

    await waitFor(() => expect(screen.getByLabelText(/^Environment/)).toHaveValue('e1'));
    expect(title).toHaveValue('Friday release');
  });

  it('requires an environment and a commit before calling the API', async () => {
    const user = userEvent.setup();
    const api = mockApi(baseRoutes);
    renderDialog();

    await user.type(screen.getByLabelText(/^Title/), 'Deploy');
    await user.click(screen.getByRole('button', { name: 'Record deployment' }));

    expect(await screen.findByText('Choose an environment.')).toBeInTheDocument();
    expect(screen.getByText('Choose a commit.')).toBeInTheDocument();
    expect(api.mutations()).toHaveLength(0);
  });

  it('maps 422 errors about the environment and commit onto the form and keeps the input', async () => {
    const user = userEvent.setup();
    const onsaved = vi.fn();
    mockApi({
      ...baseRoutes,
      'POST /projects/p1/deployments': () =>
        apiError(422, 'validation_failed', 'Validation failed', {
          environment_id: ['Environment does not exist in this project'],
          commit_id: ['Commit does not exist in this project'],
        }),
    });
    renderDialog({ commitId: 'c1', onsaved });

    await user.type(screen.getByLabelText(/^Environment/), 'e-other');
    await user.type(screen.getByLabelText(/^Title/), 'Deploy to somewhere');
    await user.type(screen.getByLabelText(/^Notes/), 'restart worker');
    await user.click(screen.getByRole('button', { name: 'Record deployment' }));

    expect(await screen.findByText('Environment does not exist in this project')).toBeInTheDocument();
    // The commit is locked (no control), so its error is shown as text.
    expect(screen.getByText('Commit does not exist in this project')).toBeInTheDocument();
    expect(screen.getByLabelText(/^Environment/)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText(/^Environment/)).toHaveValue('e-other');
    expect(screen.getByLabelText(/^Title/)).toHaveValue('Deploy to somewhere');
    expect(screen.getByLabelText(/^Notes/)).toHaveValue('restart worker');
    expect(onsaved).not.toHaveBeenCalled();
  });

  it('edits a record with PATCH and can clear the notes', async () => {
    const user = userEvent.setup();
    const existing = deployment({ deployment_notes: 'old notes', status: 'failed' });
    const api = mockApi({
      ...baseRoutes,
      'PATCH /deployments/d1': () => data({ ...existing, deployment_notes: null }),
    });
    renderDialog({ projectId: undefined, deployment: existing });

    expect(screen.getByRole('heading', { name: 'Edit deployment record' })).toBeInTheDocument();
    expect(screen.getByLabelText(/^Title/)).toHaveValue('Deploy 9fceb02 to Production');

    await user.clear(screen.getByLabelText(/^Notes/));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(api.find('PATCH', '/deployments/d1')).toHaveLength(1));
    const body = api.find('PATCH', '/deployments/d1')[0]!.body as Record<string, unknown>;
    expect(body).not.toHaveProperty('project_id');
    expect(body.deployment_notes).toBeNull();
    expect(body.status).toBe('failed');
    expect(body.environment_id).toBe('e1');
    expect(body.commit_id).toBe('c1');
  });
});
