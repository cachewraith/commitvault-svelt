import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearCsrfToken } from '$lib/api/client';
import { apiError, data, mockApi } from '../../__tests__/fixtures/api';
import QueryHarness from '../../__tests__/fixtures/QueryHarness.svelte';
import { HASH, commit, project } from '../../__tests__/fixtures/records';
import CommitFormDialog from '../CommitFormDialog.svelte';

// Pickers owned by other features are replaced by plain inputs.
vi.mock('$features/projects/components/ProjectSelect.svelte', async () => ({
  default: (await import('../../__tests__/fixtures/StubSelect.svelte')).default,
}));
vi.mock('$features/tags/components/TagPicker.svelte', async () => ({
  default: (await import('../../__tests__/fixtures/StubSelect.svelte')).default,
}));

const baseRoutes = {
  'GET /projects/p1': () => data(project),
  'GET /projects/p1/branches': () =>
    data([{ name: 'main', commit_count: 3, last_commit_at: '2026-03-01T10:00:00Z' }]),
};

function renderDialog(props: Record<string, unknown> = {}) {
  return render(QueryHarness, {
    props: { component: CommitFormDialog, props: { open: true, projectId: 'p1', ...props } },
  });
}

beforeEach(() => clearCsrfToken());

describe('CommitFormDialog', () => {
  it('validates before calling the API and keeps the dialog open', async () => {
    const user = userEvent.setup();
    const api = mockApi(baseRoutes);
    renderDialog();

    // The branch is prefilled from the project's default branch.
    await waitFor(() => expect(screen.getByLabelText(/^Branch/)).toHaveValue('develop'));
    await user.click(screen.getByRole('button', { name: 'Record commit' }));

    expect(await screen.findByText('Commit hash is required.')).toBeInTheDocument();
    expect(screen.getByText('Message is required.')).toBeInTheDocument();
    expect(screen.getByLabelText(/^Commit hash/)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText(/^Commit hash/)).toHaveFocus();
    expect(api.mutations()).toHaveLength(0);
  });

  it('rejects hashes that are too short or not hexadecimal', async () => {
    const user = userEvent.setup();
    const api = mockApi(baseRoutes);
    renderDialog();

    await user.type(screen.getByLabelText(/^Commit hash/), 'xyz123');
    await user.type(screen.getByLabelText(/^Message/), 'fix: thing');
    await user.click(screen.getByRole('button', { name: 'Record commit' }));

    expect(await screen.findByText('Enter 7–64 hexadecimal characters.')).toBeInTheDocument();
    expect(api.mutations()).toHaveLength(0);
  });

  it('normalises a pasted hash, previews the short hash and posts the payload', async () => {
    const user = userEvent.setup();
    const onsaved = vi.fn();
    const api = mockApi({
      ...baseRoutes,
      'POST /projects/p1/commits': () => data(commit(), { status: 201 }),
    });
    renderDialog({ onsaved });

    await waitFor(() => expect(screen.getByLabelText(/^Branch/)).toHaveValue('develop'));
    const hash = screen.getByLabelText(/^Commit hash/);
    await user.click(hash);
    await user.paste(`  ${HASH.toUpperCase()}\n`);

    expect(hash).toHaveValue(HASH);
    expect(screen.getByText(`Short hash 9fceb02 · 40 characters`)).toBeInTheDocument();

    await user.type(screen.getByLabelText(/^Message/), 'feat: add checkout flow');
    await user.clear(screen.getByLabelText(/^Commit date/));
    await user.type(screen.getByLabelText(/^Commit date/), '2026-03-01T10:30');
    await user.type(screen.getByLabelText(/^Author/), ' Dara ');
    await user.click(screen.getByRole('button', { name: 'Record commit' }));

    await waitFor(() => expect(onsaved).toHaveBeenCalledOnce());
    const [post] = api.find('POST', '/projects/p1/commits');
    expect(post!.headers['X-CSRF-Token']).toBe('test-token');
    expect(post!.body).toEqual({
      branch_name: 'develop',
      commit_hash: HASH,
      commit_message: 'feat: add checkout flow',
      commit_date: new Date('2026-03-01T10:30').toISOString(),
      author_name: 'Dara',
      external_url: null,
      description: null,
      tag_ids: [],
    });
  });

  it('shows a duplicate-hash conflict next to the field and keeps everything typed', async () => {
    const user = userEvent.setup();
    const onsaved = vi.fn();
    mockApi({
      ...baseRoutes,
      'POST /projects/p1/commits': () =>
        apiError(409, 'conflict', 'This commit hash is already recorded for this project', {
          commit_hash: ['This commit hash is already recorded for this project'],
        }),
    });
    renderDialog({ onsaved });

    await user.type(screen.getByLabelText(/^Commit hash/), 'a1b2c3d4');
    await user.type(screen.getByLabelText(/^Message/), 'fix: login redirect');
    await user.click(screen.getByRole('button', { name: 'Record commit' }));

    expect(await screen.findByText('This commit hash is already recorded for this project')).toBeInTheDocument();
    const hash = screen.getByLabelText(/^Commit hash/);
    expect(hash).toHaveAttribute('aria-invalid', 'true');
    expect(hash).toHaveValue('a1b2c3d4');
    expect(screen.getByLabelText(/^Message/)).toHaveValue('fix: login redirect');
    // The form is usable again as soon as the request has settled.
    expect(await screen.findByRole('button', { name: 'Record commit' })).toBeEnabled();
    expect(onsaved).not.toHaveBeenCalled();
  });

  it('maps 422 details from the server onto fields', async () => {
    const user = userEvent.setup();
    mockApi({
      ...baseRoutes,
      'POST /projects/p1/commits': () =>
        apiError(422, 'validation_failed', 'Validation failed', {
          branch_name: ['Is not a valid Git branch name'],
        }),
    });
    renderDialog();

    await user.type(screen.getByLabelText(/^Commit hash/), 'a1b2c3d4');
    await user.type(screen.getByLabelText(/^Message/), 'fix: thing');
    await user.click(screen.getByRole('button', { name: 'Record commit' }));

    expect(await screen.findByText('Is not a valid Git branch name')).toBeInTheDocument();
    expect(screen.getByLabelText(/^Branch/)).toHaveAttribute('aria-invalid', 'true');
  });

  it('"Record another" keeps project and branch and clears the per-commit fields', async () => {
    const user = userEvent.setup();
    const api = mockApi({
      ...baseRoutes,
      'POST /projects/p1/commits': () => data(commit(), { status: 201 }),
    });
    renderDialog();

    await waitFor(() => expect(screen.getByLabelText(/^Branch/)).toHaveValue('develop'));
    await user.clear(screen.getByLabelText(/^Branch/));
    await user.type(screen.getByLabelText(/^Branch/), 'feature/cart');
    await user.type(screen.getByLabelText(/^Commit hash/), 'a1b2c3d4');
    await user.type(screen.getByLabelText(/^Message/), 'feat: cart');
    await user.click(screen.getByRole('checkbox', { name: 'Record another' }));
    await user.click(screen.getByRole('button', { name: 'Record commit' }));

    await waitFor(() => expect(api.find('POST', '/projects/p1/commits')).toHaveLength(1));
    await waitFor(() => expect(screen.getByLabelText(/^Commit hash/)).toHaveValue(''));
    expect(screen.getByLabelText(/^Message/)).toHaveValue('');
    expect(screen.getByLabelText(/^Branch/)).toHaveValue('feature/cart');
    expect(screen.getByLabelText(/^Commit hash/)).toHaveFocus();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('edits an existing commit with PATCH and does not send the project', async () => {
    const user = userEvent.setup();
    const existing = commit({ author_name: 'Dara', deployment_count: 0 });
    const api = mockApi({
      ...baseRoutes,
      'PATCH /commits/c1': () => data({ ...existing, commit_message: 'feat: checkout' }),
    });
    renderDialog({ projectId: undefined, commit: existing });

    expect(screen.getByRole('heading', { name: 'Edit commit' })).toBeInTheDocument();
    expect(screen.getByLabelText(/^Commit hash/)).toHaveValue(HASH);
    expect(screen.getByLabelText(/^Branch/)).toHaveValue('main');

    await user.clear(screen.getByLabelText(/^Message/));
    await user.type(screen.getByLabelText(/^Message/), 'feat: checkout');
    await user.clear(screen.getByLabelText(/^Author/));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(api.find('PATCH', '/commits/c1')).toHaveLength(1));
    const body = api.find('PATCH', '/commits/c1')[0]!.body as Record<string, unknown>;
    expect(body).not.toHaveProperty('project_id');
    expect(body.commit_message).toBe('feat: checkout');
    expect(body.author_name).toBeNull();
    expect(body.branch_name).toBe('main');
  });
});
