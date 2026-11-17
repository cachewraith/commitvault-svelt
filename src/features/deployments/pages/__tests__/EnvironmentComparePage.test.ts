import { render, screen, waitFor, within } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { navigate, router } from '$lib/router';
import { data, mockApi } from '$features/commits/__tests__/fixtures/api';
import QueryHarness from '$features/commits/__tests__/fixtures/QueryHarness.svelte';
import { environment, project } from '$features/commits/__tests__/fixtures/records';
import EnvironmentComparePage from '../EnvironmentComparePage.svelte';

vi.mock('$features/environments/components/EnvironmentSelect.svelte', async () => ({
  default: (await import('$features/commits/__tests__/fixtures/StubSelect.svelte')).default,
}));

const NOTICE =
  'Based only on deployments recorded in CommitVault. A commit without a record in an environment may still be deployed there, and no ordering between environments (ahead or behind) is implied.';

const brief = (id: string, short: string, message: string) => ({
  id,
  short_hash: short,
  commit_hash: short.padEnd(40, '0'),
  commit_message: message,
  branch_name: 'main',
  commit_date: '2026-03-01T10:00:00Z',
});

const comparison = {
  base: {
    environment: { id: 'e1', name: 'Staging', slug: 'staging', color: '#3b82f6' },
    latest_deployment: {
      id: 'd9',
      deployment_title: 'Cart to staging',
      status: 'successful',
      deployed_at: '2026-03-03T10:00:00Z',
      commit: brief('c2', 'bbbbbbb', 'feat: cart'),
    },
    recorded_commit_count: 2,
  },
  target: {
    environment: { id: 'e2', name: 'Production', slug: 'production', color: '#22c55e' },
    latest_deployment: null,
    recorded_commit_count: 1,
  },
  statuses_considered: ['successful'],
  counts: { only_in_base: 1, only_in_target: 0, in_both: 1 },
  only_in_base: [{ commit: brief('c2', 'bbbbbbb', 'feat: cart'), deployment_count: 2, last_deployed_at: '2026-03-03T10:00:00Z' }],
  only_in_target: [],
  in_both: [
    {
      commit: brief('c1', 'aaaaaaa', 'feat: login'),
      base_last_deployed_at: '2026-03-01T10:00:00Z',
      target_last_deployed_at: '2026-03-02T10:00:00Z',
    },
  ],
  truncated: false,
  notice: NOTICE,
};

function renderPage() {
  return render(QueryHarness, { props: { component: EnvironmentComparePage, props: { projectId: 'p1' } } });
}

beforeEach(() => navigate('/projects/p1/compare', { replace: true }));

describe('EnvironmentComparePage', () => {
  it('shows the records of both environments with the API notice, and never claims ordering or absence', async () => {
    navigate('/projects/p1/compare?base=e1&target=e2', { replace: true });
    const api = mockApi({
      'GET /projects/p1': () => data(project),
      'GET /projects/p1/environments': () => data([environment('e1', 'Staging'), environment('e2', 'Production')]),
      'GET /projects/p1/deployments/compare': () => data(comparison),
    });
    renderPage();

    // The notice from the API is rendered verbatim.
    const note = await screen.findByRole('note', { name: 'How to read this comparison' });
    expect(within(note).getByText(NOTICE)).toBeInTheDocument();
    expect(within(note).getByText(/Counting records with status:\s+Successful\./)).toBeInTheDocument();

    const [request] = api.find('GET', '/projects/p1/deployments/compare');
    expect(request!.query.get('base')).toBe('e1');
    expect(request!.query.get('target')).toBe('e2');
    expect(request!.query.has('include_unsuccessful')).toBe(false);

    // Three sections, worded as records.
    const onlyBase = screen.getByRole('region', { name: /Recorded in Staging only/ });
    expect(within(onlyBase).getByText('A record exists in Staging; no record in Production.')).toBeInTheDocument();
    expect(within(onlyBase).getByRole('link', { name: 'feat: cart' })).toHaveAttribute('href', '/commits/c2');
    expect(within(onlyBase).getByText('2 records')).toBeInTheDocument();

    const onlyTarget = screen.getByRole('region', { name: /Recorded in Production only/ });
    expect(
      within(onlyTarget).getByText('Every commit recorded in Production also has a record in Staging.'),
    ).toBeInTheDocument();

    const both = screen.getByRole('region', { name: /Recorded in both/ });
    expect(within(both).getByRole('link', { name: 'feat: login' })).toBeInTheDocument();

    // Side cards: latest considered record, or an explicit "no record".
    const staging = screen.getByRole('region', { name: 'First environment: Staging' });
    expect(within(staging).getByText('2 recorded commits')).toBeInTheDocument();
    expect(within(staging).getByRole('link', { name: 'Cart to staging' })).toHaveAttribute('href', '/deployments/d9');
    const production = screen.getByRole('region', { name: 'Second environment: Production' });
    expect(within(production).getByText('No record with the statuses being counted.')).toBeInTheDocument();

    // Outside the API's own notice, the page must not talk about ordering or absence.
    const ownText = (document.body.textContent ?? '').replace(NOTICE, '').toLowerCase();
    for (const word of ['ahead', 'behind', 'missing', 'not deployed', 'out of date', 'outdated']) {
      expect(ownText, `page text must not contain "${word}"`).not.toContain(word);
    }
  });

  it('passes the "all statuses" toggle from the URL to the API', async () => {
    navigate('/projects/p1/compare?base=e1&target=e2&all=true', { replace: true });
    const api = mockApi({
      'GET /projects/p1': () => data(project),
      'GET /projects/p1/environments': () => data([environment('e1', 'Staging'), environment('e2', 'Production')]),
      'GET /projects/p1/deployments/compare': () =>
        data({ ...comparison, statuses_considered: ['successful', 'failed', 'rolled_back', 'pending'] }),
    });
    renderPage();

    await screen.findByRole('note');
    expect(api.find('GET', '/projects/p1/deployments/compare')[0]!.query.get('include_unsuccessful')).toBe('true');
    expect(screen.getByRole('switch', { name: 'Include failed, rolled-back and pending records' })).toBeChecked();
    expect(screen.getByText(/Successful, Failed, Rolled back, Pending\./)).toBeInTheDocument();
  });

  it('preselects the first two environments when none are chosen', async () => {
    mockApi({
      'GET /projects/p1': () => data(project),
      'GET /projects/p1/environments': () =>
        data([environment('e1', 'Staging'), environment('e2', 'Production'), environment('e3', 'Dev')]),
      'GET /projects/p1/deployments/compare': () => data(comparison),
    });
    renderPage();

    await waitFor(() => expect(router.query.get('base')).toBe('e1'));
    expect(router.query.get('target')).toBe('e2');
    expect(await screen.findByRole('note')).toBeInTheDocument();
  });

  it('guides the user when the project has fewer than two environments', async () => {
    const api = mockApi({
      'GET /projects/p1': () => data(project),
      'GET /projects/p1/environments': () => data([environment('e1', 'Production')]),
    });
    renderPage();

    expect(await screen.findByText('Two environments are needed for a comparison')).toBeInTheDocument();
    expect(screen.getByText(/only has “Production”/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Manage environments' })).toHaveAttribute(
      'href',
      '/projects/p1/environments',
    );
    expect(api.find('GET', '/projects/p1/deployments/compare')).toHaveLength(0);
  });

  it('does not compare an environment with itself', async () => {
    navigate('/projects/p1/compare?base=e1&target=e1', { replace: true });
    const api = mockApi({
      'GET /projects/p1': () => data(project),
      'GET /projects/p1/environments': () => data([environment('e1', 'Staging'), environment('e2', 'Production')]),
    });
    renderPage();

    expect(await screen.findByText('Choose two different environments')).toBeInTheDocument();
    expect(api.find('GET', '/projects/p1/deployments/compare')).toHaveLength(0);
  });
});
