import { render, screen, waitFor, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import BranchBadge from '../BranchBadge.svelte';
import { confirm, ConfirmDialogHost } from '../confirm';
import DateRangeFilter from '../DateRangeFilter.svelte';
import EnvironmentBadge from '../EnvironmentBadge.svelte';
import ErrorState from '../ErrorState.svelte';
import HashChip from '../HashChip.svelte';
import Pagination from '../Pagination.svelte';
import SearchInput from '../SearchInput.svelte';
import StatusBadge from '../StatusBadge.svelte';
import { ApiError } from '$lib/api/errors';
import { endOfLocalDayIso, startOfLocalDayIso } from '$lib/utils/format';
import FormFieldHarness from './fixtures/FormFieldHarness.svelte';
import SortHarness from './fixtures/SortHarness.svelte';

const HASH = '9fceb02d0ae598e95dc970b74767f19372d61af8';

describe('HashChip', () => {
  it('is plain text by default and copies the full hash when copyable', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });

    const { unmount } = render(HashChip, { hash: HASH });
    expect(screen.getByText('9fceb02')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    unmount();

    render(HashChip, { hash: HASH, copyable: true });
    await user.click(screen.getByRole('button', { name: 'Copy commit hash' }));

    expect(writeText).toHaveBeenCalledWith(HASH);
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument();
  });

  it('links internally and renders only safe external URLs', () => {
    const { unmount } = render(HashChip, {
      hash: HASH,
      href: '/commits/1',
      externalUrl: 'https://github.com/org/repo/commit/' + HASH,
    });
    expect(screen.getByRole('link', { name: '9fceb02' })).toHaveAttribute('href', '/commits/1');
    const external = screen.getByRole('link', { name: /open commit on git host/i });
    expect(external).toHaveAttribute('target', '_blank');
    expect(external).toHaveAttribute('rel', 'noopener noreferrer');
    unmount();

    render(HashChip, { hash: HASH, externalUrl: 'javascript:alert(1)' });
    expect(screen.queryByRole('link', { name: /git host/i })).not.toBeInTheDocument();
  });
});

describe('badges', () => {
  it('labels every deployment, release and project status', () => {
    const cases: Array<[string, string]> = [
      ['successful', 'Successful'],
      ['failed', 'Failed'],
      ['rolled_back', 'Rolled back'],
      ['pending', 'Pending'],
      ['draft', 'Draft'],
      ['released', 'Released'],
      ['deprecated', 'Deprecated'],
      ['active', 'Active'],
      ['archived', 'Archived'],
      ['something_new', 'Something new'],
    ];
    for (const [status, label] of cases) {
      const { unmount } = render(StatusBadge, { status });
      expect(screen.getByText(label)).toBeInTheDocument();
      unmount();
    }
  });

  it('renders branch names and ignores unsafe environment colours', () => {
    render(BranchBadge, { name: 'feature/login' });
    expect(screen.getByText('feature/login')).toBeInTheDocument();

    const { container } = render(EnvironmentBadge, {
      name: 'Production',
      color: 'red; background-image: url(https://evil.example)',
    });
    const dot = container.querySelector('span[aria-hidden="true"]') as HTMLElement;
    expect(dot.style.backgroundColor).toBe('rgb(113, 113, 122)');
  });
});

describe('Pagination', () => {
  const meta = { page: 2, per_page: 25, total: 240, total_pages: 10 };

  it('summarises the range and marks the current page', () => {
    render(Pagination, { meta, onchange: () => {}, label: 'commits' });

    expect(screen.getByText('26–50')).toBeInTheDocument();
    expect(screen.getByText('240')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Page 2' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Page 10' })).toBeInTheDocument();
  });

  it('emits page changes and disables edges', async () => {
    const user = userEvent.setup();
    const onchange = vi.fn();
    const { rerender } = render(Pagination, { meta, onchange });

    await user.click(screen.getByRole('button', { name: 'Next page' }));
    await user.click(screen.getByRole('button', { name: 'Previous page' }));
    await user.click(screen.getByRole('button', { name: 'Page 10' }));
    await user.click(screen.getByRole('button', { name: 'Page 2' }));
    expect(onchange.mock.calls.map((call) => call[0])).toEqual([3, 1, 10]);

    await rerender({ meta: { ...meta, page: 10 }, onchange });
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
  });

  it('handles empty results', () => {
    render(Pagination, { meta: { page: 1, per_page: 25, total: 0, total_pages: 0 }, onchange: () => {} });
    expect(screen.getByText('No results')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Next page' })).not.toBeInTheDocument();
  });
});

describe('SearchInput', () => {
  it('debounces typing and commits the trimmed value once', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onsearch = vi.fn();
    render(SearchInput, { onsearch, label: 'Search commits', delay: 300 });

    await user.type(screen.getByLabelText('Search commits'), ' fix login ');
    expect(onsearch).not.toHaveBeenCalled();

    vi.advanceTimersByTime(300);
    expect(onsearch).toHaveBeenCalledExactlyOnceWith('fix login');
  });

  it('commits immediately on Enter and clears with the button', async () => {
    const user = userEvent.setup();
    const onsearch = vi.fn();
    render(SearchInput, { onsearch, label: 'Search', value: 'old' });
    const input = screen.getByLabelText('Search');
    expect(input).toHaveValue('old');

    await user.clear(input);
    await user.type(input, 'deploy{Enter}');
    expect(onsearch).toHaveBeenLastCalledWith('deploy');

    await user.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(onsearch).toHaveBeenLastCalledWith('');
    expect(input).toHaveValue('');
    expect(input).toHaveFocus();
  });

  it('follows external value changes without emitting', async () => {
    const onsearch = vi.fn();
    const { rerender } = render(SearchInput, { onsearch, label: 'Search', value: 'one' });

    await rerender({ onsearch, label: 'Search', value: '' });

    expect(screen.getByLabelText('Search')).toHaveValue('');
    expect(onsearch).not.toHaveBeenCalled();
  });
});

describe('FormField', () => {
  it('wires label, hint and error to the control', async () => {
    const { rerender } = render(FormFieldHarness, { hint: 'Shown in the sidebar.', required: true });
    const input = screen.getByLabelText(/project name/i);

    expect(input).toHaveAttribute('aria-required', 'true');
    expect(input).not.toHaveAttribute('aria-invalid');
    expect(input).toHaveAccessibleDescription('Shown in the sidebar.');

    await rerender({ hint: 'Shown in the sidebar.', required: true, error: 'Name is required.' });

    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Name is required. Shown in the sidebar.');
    expect(screen.getByRole('alert')).toHaveTextContent('Name is required.');
  });
});

describe('DataTableHead', () => {
  it('exposes aria-sort and toggles the order', async () => {
    const user = userEvent.setup();
    const onsort = vi.fn();
    render(SortHarness, { sort: 'commit_date', order: 'desc', onsort });

    expect(screen.getByRole('columnheader', { name: /date/i })).toHaveAttribute('aria-sort', 'descending');
    expect(screen.getByRole('columnheader', { name: /branch/i })).toHaveAttribute('aria-sort', 'none');
    expect(screen.getByRole('columnheader', { name: 'Message' })).not.toHaveAttribute('aria-sort');

    await user.click(screen.getByRole('button', { name: /date/i }));
    await user.click(screen.getByRole('button', { name: /branch/i }));

    expect(onsort.mock.calls).toEqual([
      ['commit_date', 'asc'],
      ['branch_name', 'asc'],
    ]);
  });
});

describe('DateRangeFilter', () => {
  it('emits inclusive local-day boundaries as ISO strings', async () => {
    const user = userEvent.setup();
    const onchange = vi.fn();
    render(DateRangeFilter, { onchange, label: 'Commit date' });

    await user.type(screen.getByLabelText('Commit date from'), '2026-11-01');
    expect(onchange).toHaveBeenLastCalledWith({ from: startOfLocalDayIso('2026-11-01'), to: null });

    await user.type(screen.getByLabelText('to'), '2026-11-17');
    expect(onchange).toHaveBeenLastCalledWith({ from: null, to: endOfLocalDayIso('2026-11-17') });
  });

  it('shows existing values as local days', () => {
    render(DateRangeFilter, {
      onchange: () => {},
      from: startOfLocalDayIso('2026-11-01'),
      to: endOfLocalDayIso('2026-11-17'),
    });
    expect(screen.getByLabelText('Date from')).toHaveValue('2026-11-01');
    expect(screen.getByLabelText('to')).toHaveValue('2026-11-17');
  });
});

describe('ErrorState', () => {
  it('shows the API message, request id and retry action', async () => {
    const user = userEvent.setup();
    const onretry = vi.fn();
    const error = new ApiError({ status: 500, code: 'internal_error', message: 'Database unavailable.', requestId: 'req-9' });
    render(ErrorState, { error, onretry });

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Database unavailable.');
    expect(alert).toHaveTextContent('req-9');
    await user.click(within(alert).getByRole('button', { name: /try again/i }));
    expect(onretry).toHaveBeenCalledTimes(1);
  });

  it('explains missing records without offering a retry', () => {
    const error = new ApiError({ status: 404, code: 'not_found', message: 'Commit not found.' });
    render(ErrorState, { error, onretry: () => {} });

    expect(screen.getByText('Not found')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument();
  });
});

describe('confirm()', () => {
  it('resolves true when confirmed and false when cancelled', async () => {
    const user = userEvent.setup();
    render(ConfirmDialogHost);

    const first = confirm({
      title: 'Delete commit?',
      description: 'This cannot be undone.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('Delete commit?');
    expect(dialog).toHaveTextContent('This cannot be undone.');
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await expect(first).resolves.toBe(true);
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());

    const second = confirm({ title: 'Archive project?' });
    const next = await screen.findByRole('alertdialog');
    await user.click(within(next).getByRole('button', { name: 'Cancel' }));
    await expect(second).resolves.toBe(false);
  });

  it('queues overlapping requests', async () => {
    const user = userEvent.setup();
    render(ConfirmDialogHost);

    const a = confirm({ title: 'First?' });
    const b = confirm({ title: 'Second?' });

    const firstDialog = await screen.findByRole('alertdialog');
    expect(firstDialog).toHaveTextContent('First?');
    await user.click(within(firstDialog).getByRole('button', { name: 'Confirm' }));
    await expect(a).resolves.toBe(true);

    await waitFor(() => expect(screen.getByRole('alertdialog')).toHaveTextContent('Second?'));
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancel' }));
    await expect(b).resolves.toBe(false);
  });
});
