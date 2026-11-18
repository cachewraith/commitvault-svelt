import { render, screen, within } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import { deployment } from '$features/commits/__tests__/fixtures/records';
import DeploymentTimeline from '../DeploymentTimeline.svelte';

describe('DeploymentTimeline', () => {
  it('renders nothing for an empty list (the parent owns the empty state)', () => {
    const { container } = render(DeploymentTimeline, { props: { deployments: [] } });
    expect(container.querySelector('ol')).toBeNull();
    expect(container.textContent?.trim()).toBe('');
  });

  it('shows status, environment and commit of each record, with links', () => {
    render(DeploymentTimeline, {
      props: {
        deployments: [
          deployment({ id: 'd1', status: 'failed', deployment_title: 'Hotfix to production' }),
          deployment({ id: 'd2', status: 'rolled_back', deployment_title: 'Rollback' }),
        ],
        label: 'History',
      },
    });

    const items = within(screen.getByRole('list', { name: 'History' })).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    // The status is always spelled out, never colour alone.
    expect(within(items[0]!).getByText('Failed')).toBeInTheDocument();
    expect(within(items[1]!).getByText('Rolled back')).toBeInTheDocument();
    expect(within(items[0]!).getByText('Production')).toBeInTheDocument();
    expect(within(items[0]!).getByRole('link', { name: 'Hotfix to production' })).toHaveAttribute(
      'href',
      '/deployments/d1',
    );
    expect(within(items[0]!).getByRole('link', { name: 'feat: add checkout flow' })).toHaveAttribute(
      'href',
      '/commits/c1',
    );
  });

  it('can hide the environment and the commit when they are the same for every item', () => {
    render(DeploymentTimeline, {
      props: { deployments: [deployment()], showEnvironment: false, showCommit: false },
    });
    expect(screen.queryByText('Production')).not.toBeInTheDocument();
    expect(screen.queryByText('feat: add checkout flow')).not.toBeInTheDocument();
  });

  it('groups records under a heading per day', () => {
    const today = new Date();
    const lastYear = new Date(today.getFullYear() - 1, 0, 15, 12);
    render(DeploymentTimeline, {
      props: {
        deployments: [
          deployment({ id: 'd1', deployed_at: today.toISOString() }),
          deployment({ id: 'd2', deployed_at: today.toISOString() }),
          deployment({ id: 'd3', deployed_at: lastYear.toISOString() }),
        ],
        groupByDay: true,
      },
    });

    const todayGroup = screen.getByRole('region', { name: 'Today' });
    expect(within(todayGroup).getByRole('heading', { name: /Today/ })).toHaveTextContent('2 deployments');
    expect(within(todayGroup).getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getAllByRole('region')).toHaveLength(2);
  });
});
