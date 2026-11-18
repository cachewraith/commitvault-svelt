import { render, screen, within } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import DashboardPage from '../pages/DashboardPage.svelte';
import type { Dashboard } from '../types';
import { json, mockApi } from './fixtures/api-mock';
import QueryHarness from './fixtures/QueryHarness.svelte';

const project = { id: 'p1', name: 'Shop', slug: 'shop' };
const commit = {
  id: 'c1',
  short_hash: 'a1b2c3d',
  commit_hash: 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678',
  commit_message: 'feat: checkout',
  branch_name: 'main',
  commit_date: '2026-11-10T10:00:00Z',
};

function days(): Dashboard['deployment_activity'] {
  const list = Array.from({ length: 30 }, (_, index) => ({
    date: new Date(Date.UTC(2026, 9, 19 + index)).toISOString().slice(0, 10),
    successful: 0,
    failed: 0,
    rolled_back: 0,
    pending: 0,
  }));
  list[28] = { ...list[28]!, successful: 2, failed: 1 };
  list[29] = { ...list[29]!, successful: 1, rolled_back: 1 };
  return list;
}

const environment = (id: string, name: string, latest: boolean) => ({
  id,
  project_id: project.id,
  project,
  name,
  slug: name.toLowerCase(),
  description: null,
  color: '#22c55e',
  server_label: null,
  position: 0,
  created_at: '2026-11-01T10:00:00Z',
  updated_at: '2026-11-01T10:00:00Z',
  deployment_count: latest ? 3 : 0,
  latest_deployment: latest
    ? { id: 'd1', deployment_title: 'Ship checkout', status: 'failed', deployed_at: '2026-11-16T10:00:00Z', commit }
    : null,
  latest_successful_deployment: null,
});

const populated = (): Dashboard =>
  ({
    totals: {
      projects: 3,
      active_projects: 2,
      commits: 1284,
      environments: 7,
      deployments: 96,
      releases: 12,
      notes: 41,
      tags: 9,
    },
    recent_deployments: [],
    recent_commits: [],
    recent_notes: [
      {
        id: 'n1',
        project_id: null,
        project: null,
        title: 'Deploy runbook',
        excerpt: 'Restart the worker.',
        category: 'Runbooks',
        is_pinned: true,
        created_at: '2026-11-01T10:00:00Z',
        updated_at: '2026-11-15T10:00:00Z',
        tags: [],
      },
    ],
    project_activity: [
      {
        project,
        commit_count: 40,
        deployment_count: 12,
        last_commit_at: '2026-11-10T10:00:00Z',
        last_deployment_at: '2026-11-16T10:00:00Z',
        last_activity_at: '2026-11-16T10:00:00Z',
      },
    ],
    environment_overview: [environment('e1', 'Production', true), environment('e2', 'Staging', false)],
    deployment_activity: days(),
  }) as Dashboard;

const empty = (): Dashboard => ({
  totals: {
    projects: 0,
    active_projects: 0,
    commits: 0,
    environments: 0,
    deployments: 0,
    releases: 0,
    notes: 0,
    tags: 0,
  },
  recent_deployments: [],
  recent_commits: [],
  recent_notes: [],
  project_activity: [],
  environment_overview: [],
  deployment_activity: days().map((day) => ({ ...day, successful: 0, failed: 0, rolled_back: 0 })),
});

const renderPage = () => render(QueryHarness, { props: { component: DashboardPage } });

describe('DashboardPage', () => {
  it('renders totals from the API as links to their lists', async () => {
    mockApi({ 'GET /dashboard': () => json({ data: populated() }) });
    renderPage();

    const totals = await screen.findByRole('region', { name: 'Totals' });
    const total = (label: string) => within(totals).getByText(label).closest('div')!;
    const link = (label: string) => within(total(label)).getByRole('link');
    expect(link('Projects')).toHaveTextContent('3');
    expect(link('Projects')).toHaveAttribute('href', '/projects');
    expect(link('Commits')).toHaveTextContent('1,284');
    expect(link('Environments')).toHaveAttribute('href', '/environments');
    expect(link('Deployments')).toHaveTextContent('96');
    expect(link('Releases')).toHaveTextContent('12');
    expect(link('Releases')).toHaveAttribute('href', '/releases');
    expect(link('Notes')).toHaveAttribute('href', '/notes');
    expect(link('Tags')).toHaveTextContent('9');
  });

  it('summarises deployment activity in text, with a legend and a data table', async () => {
    mockApi({ 'GET /dashboard': () => json({ data: populated() }) });
    renderPage();

    const summary = '5 deployment records in the last 30 days: 3 successful, 1 failed, 1 rolled back.';
    expect(await screen.findByRole('img', { name: summary })).toBeInTheDocument();
    expect(screen.getAllByText(summary).length).toBeGreaterThan(0);
    expect(screen.getByText('Days are UTC calendar days.')).toBeInTheDocument();

    const legend = screen.getByRole('list', { name: 'Legend' });
    for (const label of ['Successful', 'Failed', 'Rolled back', 'Pending']) {
      expect(within(legend).getByText(label)).toBeInTheDocument();
    }
    // Same data as a table for assistive technology: only days with records.
    const table = screen.getByRole('table', { name: 'Deployment records per day (UTC)' });
    expect(within(table).getAllByRole('row')).toHaveLength(1 + 2);
  });

  it('shows the latest recorded deployment per environment without over-claiming', async () => {
    mockApi({ 'GET /dashboard': () => json({ data: populated() }) });
    renderPage();

    const list = await screen.findByRole('list', { name: 'Environments' });
    const [production, staging] = within(list).getAllByRole('listitem');
    expect(production).toHaveTextContent('Production');
    expect(production).toHaveTextContent('Failed');
    expect(within(production!).getByRole('link', { name: /a1b2c3d/ })).toHaveAttribute('href', '/commits/c1');
    expect(staging).toHaveTextContent('No deployment recorded');

    const activity = screen.getByRole('list', { name: 'Projects by latest activity' });
    expect(within(activity).getByRole('link', { name: 'Shop' })).toHaveAttribute('href', '/projects/p1');
    expect(activity).toHaveTextContent('40 commits · 12 deployments');

    expect(screen.getByRole('link', { name: 'Deploy runbook' })).toHaveAttribute('href', '/notes/n1');
    expect(document.body.textContent).not.toMatch(/\b(ahead|behind|not deployed)\b/i);
  });

  it('greets a brand-new workspace with the first step instead of zeros', async () => {
    mockApi({ 'GET /dashboard': () => json({ data: empty() }) });
    renderPage();

    expect(await screen.findByText('Welcome to CommitVault')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create your first project' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Write a note' })).toHaveAttribute('href', '/notes/new');
    expect(screen.queryByRole('region', { name: 'Totals' })).not.toBeInTheDocument();
  });

  it('reports "no deployments" in the chart when the period is empty but other data exists', async () => {
    const data = populated();
    data.deployment_activity = empty().deployment_activity;
    mockApi({ 'GET /dashboard': () => json({ data }) });
    renderPage();

    expect(await screen.findByText('No deployments were recorded in the last 30 days.')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('offers a retry when the dashboard cannot be loaded', async () => {
    mockApi({
      'GET /dashboard': () =>
        json({ error: { code: 'internal_error', message: 'An unexpected error occurred' } }, { status: 500 }),
    });
    renderPage();
    expect(await screen.findByRole('button', { name: /retry|try again/i }, { timeout: 8000 })).toBeInTheDocument();
  }, 12000);
});
