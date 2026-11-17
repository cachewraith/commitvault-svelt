import { render, screen, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { navigate } from '$lib/router';
import SearchPage from '../pages/SearchPage.svelte';
import type { SearchHit, SearchResults } from '../types';
import { json, mockApi } from './fixtures/api-mock';
import QueryHarness from './fixtures/QueryHarness.svelte';

const project = { id: 'p1', name: 'Shop', slug: 'shop' };

const hit = (kind: SearchHit['kind'], id: string, title: string, extra: Partial<SearchHit> = {}): SearchHit => ({
  id,
  kind,
  title,
  subtitle: null,
  project: null,
  occurred_at: null,
  ...extra,
});

const results = (overrides: Partial<SearchResults> = {}): SearchResults => ({
  query: 'checkout',
  projects: [hit('project', 'p1', 'Checkout Service')],
  commits: [
    hit('commit', 'c1', 'feat: checkout flow', {
      subtitle: 'a1b2c3d · feature/checkout',
      project,
      occurred_at: '2026-11-10T10:00:00Z',
    }),
  ],
  deployments: [hit('deployment', 'd1', 'Ship checkout', { subtitle: 'Production · successful', project })],
  releases: [hit('release', 'r1', '2.0.0 — Checkout rewrite', { subtitle: 'draft', project })],
  notes: [hit('note', 'n1', 'Payments', { subtitle: 'The checkout calls the gateway twice.' })],
  tags: [hit('tag', 't1', 'checkout')],
  total: 6,
  ...overrides,
});

const renderPage = () => render(QueryHarness, { props: { component: SearchPage } });
const searchCalls = (api: ReturnType<typeof mockApi>) => api.to('GET /search');

describe('SearchPage', () => {
  it('prompts instead of searching when there is no term', () => {
    navigate('/search', { replace: true });
    const api = mockApi({});
    renderPage();

    expect(screen.getByText('Search your workspace')).toBeInTheDocument();
    expect(searchCalls(api)).toHaveLength(0);
  });

  it('explains the two-character minimum rather than calling the API', async () => {
    navigate('/search?q=a', { replace: true });
    const api = mockApi({});
    renderPage();

    expect(screen.getByText('Keep typing')).toBeInTheDocument();
    expect(screen.getByText('Search needs at least 2 characters.')).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(searchCalls(api)).toHaveLength(0);
  });

  it('groups hits by type and links each to its record', async () => {
    navigate('/search?q=checkout', { replace: true });
    const api = mockApi({ 'GET /search': () => json({ data: results() }) });
    renderPage();

    const link = async (group: string, name: RegExp) =>
      within(await screen.findByRole('region', { name: new RegExp(`^${group}`) })).getByRole('link', { name });

    expect(await link('Projects', /Checkout Service/)).toHaveAttribute('href', '/projects/p1');
    expect(await link('Commits', /feat: checkout flow/)).toHaveAttribute('href', '/commits/c1');
    expect(await link('Deployments', /Ship checkout/)).toHaveAttribute('href', '/deployments/d1');
    expect(await link('Releases', /Checkout rewrite/)).toHaveAttribute('href', '/releases/r1');
    expect(await link('Notes', /Payments/)).toHaveAttribute('href', '/notes/n1');
    expect(await link('Tags', /checkout/)).toHaveAttribute('href', '/tags?search=checkout');

    // Groups appear in the documented order.
    const headings = screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent?.trim().split(/\s/)[0]);
    expect(headings).toEqual(['Projects', 'Commits', 'Deployments', 'Releases', 'Notes', 'Tags']);

    // Commit hits show hash and branch, and the owning project.
    const commitHit = await link('Commits', /feat: checkout flow/);
    expect(commitHit).toHaveTextContent('a1b2c3d · feature/checkout');
    expect(commitHit).toHaveTextContent('Shop');

    expect(searchCalls(api)).toHaveLength(1);
  });

  it('omits empty groups and offers "Show more" when a group is full', async () => {
    navigate('/search?q=checkout', { replace: true });
    const many = Array.from({ length: 5 }, (_, index) => hit('commit', `c${index}`, `commit ${index}`, { project }));
    let requestedLimit = '';
    mockApi({
      'GET /search': () =>
        json({ data: results({ commits: many, projects: [], deployments: [], releases: [], notes: [], tags: [] }) }),
    });
    const originalFetch = globalThis.fetch;
    globalThis.fetch = ((input: string, init?: RequestInit) => {
      const url = new URL(String(input), 'http://localhost');
      if (url.pathname.endsWith('/search')) requestedLimit = url.searchParams.get('limit') ?? '';
      return originalFetch(input, init);
    }) as typeof fetch;

    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByRole('region', { name: /^Commits/ })).toHaveTextContent('(5+)');
    expect(screen.queryByRole('region', { name: /^Projects/ })).not.toBeInTheDocument();
    expect(requestedLimit).toBe('5');

    await user.click(screen.getByRole('button', { name: 'Show more' }));
    expect(window.location.search).toContain('limit=20');
  });

  it('suggests what is searchable when nothing matches', async () => {
    navigate('/search?q=zzzz', { replace: true });
    mockApi({
      'GET /search': () =>
        json({
          data: results({ query: 'zzzz', projects: [], commits: [], deployments: [], releases: [], notes: [], tags: [], total: 0 }),
        }),
    });
    renderPage();

    expect(await screen.findByText('No results for “zzzz”')).toBeInTheDocument();
    expect(screen.getByText(/a branch name, the first characters of a hash/)).toBeInTheDocument();
  });

  it('updates the URL when a new term is submitted', async () => {
    navigate('/search', { replace: true });
    mockApi({ 'GET /search': () => json({ data: results({ query: 'login' }) }) });
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText('Search everything'), 'login{Enter}');
    expect(window.location.search).toBe('?q=login');
    expect(await screen.findByText(/Results for/)).toHaveTextContent('“login”');
  });
});
