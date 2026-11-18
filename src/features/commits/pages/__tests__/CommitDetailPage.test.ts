import { render, screen, waitFor, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearCsrfToken } from '$lib/api/client';
import { router } from '$lib/router';
import { apiError, data, list, mockApi } from '../../__tests__/fixtures/api';
import QueryHarness from '../../__tests__/fixtures/QueryHarness.svelte';
import { commit, deployment } from '../../__tests__/fixtures/records';
import CommitDetailPage from '../CommitDetailPage.svelte';

vi.mock('$features/projects/components/ProjectSelect.svelte', async () => ({
  default: (await import('../../__tests__/fixtures/StubSelect.svelte')).default,
}));
vi.mock('$features/environments/components/EnvironmentSelect.svelte', async () => ({
  default: (await import('../../__tests__/fixtures/StubSelect.svelte')).default,
}));
vi.mock('$features/tags/components/TagPicker.svelte', async () => ({
  default: (await import('../../__tests__/fixtures/StubSelect.svelte')).default,
}));

function renderPage() {
  return render(QueryHarness, {
    props: { component: CommitDetailPage, props: { commitId: 'c1' }, confirmHost: true },
  });
}

beforeEach(() => clearCsrfToken());

describe('CommitDetailPage', () => {
  it('shows the commit, where deployments were recorded and its releases', async () => {
    mockApi({
      'GET /commits/c1': () =>
        data(
          commit({
            author_name: 'Dara',
            external_url: 'https://github.com/acme/shop/commit/9fceb02',
            deployment_count: 2,
            environments: [
              {
                id: 'e1',
                name: 'Production',
                slug: 'production',
                color: '#22c55e',
                deployment_count: 2,
                latest_status: 'failed',
                latest_deployed_at: '2026-03-02T09:00:00Z',
              },
            ],
            releases: [{ id: 'r1', version: '1.4.0', title: 'Spring release', status: 'released' }],
          }),
        ),
      'GET /deployments': () => list([deployment({ status: 'failed' })]),
    });
    renderPage();

    expect(await screen.findByRole('heading', { level: 1, name: 'feat: add checkout flow' })).toBeInTheDocument();
    expect(screen.getByText('9fceb02d0ae598e95dc970b74767f19372d61af8')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy hash' })).toBeInTheDocument();

    const gitHost = screen.getByRole('link', { name: /Open on Git host/ });
    expect(gitHost).toHaveAttribute('href', 'https://github.com/acme/shop/commit/9fceb02');
    expect(gitHost).toHaveAttribute('rel', expect.stringContaining('noopener'));

    const environments = screen.getByRole('list', { name: 'Environments with a deployment record' });
    expect(within(environments).getByText('Production')).toBeInTheDocument();
    expect(within(environments).getByText('Failed')).toBeInTheDocument();
    expect(within(environments).getByText(/2 deployments/)).toBeInTheDocument();

    expect(await screen.findByRole('link', { name: 'Deploy 9fceb02 to Production' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /1\.4\.0/ })).toHaveAttribute('href', '/releases/r1');
  });

  it('never renders an unsafe external URL as a link', async () => {
    mockApi({
      'GET /commits/c1': () => data(commit({ external_url: 'javascript:alert(1)' })),
      'GET /deployments': () => list([]),
    });
    renderPage();

    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByRole('link', { name: /Open on Git host/ })).not.toBeInTheDocument();
  });

  it('talks about records, never claims the commit was not deployed', async () => {
    mockApi({
      'GET /commits/c1': () => data(commit()),
      'GET /deployments': () => list([]),
    });
    renderPage();

    expect(await screen.findByText('No deployment recorded')).toBeInTheDocument();
    expect(screen.queryByText(/not deployed|never deployed/i)).not.toBeInTheDocument();
  });

  it('deletes a commit without history after a plain confirmation (no cascade)', async () => {
    const user = userEvent.setup();
    const api = mockApi({
      'GET /commits/c1': () => data(commit()),
      'GET /deployments': () => list([]),
      'DELETE /commits/c1': () => new Response(null, { status: 204 }),
    });
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText('Delete commit 9fceb02?')).toBeInTheDocument();
    expect(within(dialog).queryByText(/deployment record/)).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Delete commit' }));

    await waitFor(() => expect(api.find('DELETE', '/commits/c1')).toHaveLength(1));
    expect(api.find('DELETE', '/commits/c1')[0]!.query.has('cascade')).toBe(false);
    await waitFor(() => expect(router.pathname).toBe('/commits'));
  });

  it('asks before deleting deployment history and only then sends cascade=true', async () => {
    const user = userEvent.setup();
    const api = mockApi({
      'GET /commits/c1': () =>
        data(
          commit({
            deployment_count: 3,
            environments: [
              {
                id: 'e1',
                name: 'Production',
                slug: 'production',
                color: '#22c55e',
                deployment_count: 3,
                latest_status: 'successful',
                latest_deployed_at: '2026-03-02T09:00:00Z',
              },
            ],
          }),
        ),
      'GET /deployments': () => list([deployment()]),
      'DELETE /commits/c1': () => new Response(null, { status: 204 }),
    });
    renderPage();

    // Cancelling changes nothing.
    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    let dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText(/Also delete 3 deployment records of this commit/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(api.find('DELETE', '/commits/c1')).toHaveLength(0);

    // Confirming deletes the commit together with its records.
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Delete commit and 3 records' }));

    await waitFor(() => expect(api.find('DELETE', '/commits/c1')).toHaveLength(1));
    expect(api.find('DELETE', '/commits/c1')[0]!.query.get('cascade')).toBe('true');
  });

  it('shows a not-found state for an unknown commit', async () => {
    mockApi({
      'GET /commits/c1': () => apiError(404, 'not_found', 'Commit not found'),
      'GET /deployments': () => list([]),
    });
    renderPage();

    expect(await screen.findByText('Commit not found')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to commits' })).toHaveAttribute('href', '/commits');
    expect(screen.queryByRole('button', { name: /retry|try again/i })).not.toBeInTheDocument();
  });
});
