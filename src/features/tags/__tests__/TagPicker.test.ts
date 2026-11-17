import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearCsrfToken } from '$lib/api/client';
import { apiError, data, mockApi, page } from '$features/projects/__tests__/fixtures/api-mock';
import Harness from '$features/projects/__tests__/fixtures/Harness.svelte';
import { makeTag } from '$features/projects/__tests__/fixtures/records';
import TagPicker from '../components/TagPicker.svelte';

beforeEach(() => clearCsrfToken());

const urgent = makeTag({ id: 't-urgent', name: 'urgent' });
const backend = makeTag({ id: 't-backend', name: 'backend', color: '#3b82f6' });

function renderPicker(props: Record<string, unknown> = {}) {
  const onchange = vi.fn();
  render(Harness, { props: { component: TagPicker, props: { onchange, 'aria-label': 'Tags', ...props } } });
  return onchange;
}

/** Tag list handler that honours `?search=` like the backend does. */
const listTags =
  (tags = [urgent, backend]) =>
  ({ query }: { query: URLSearchParams }) => {
    const term = (query.get('search') ?? '').toLowerCase();
    return page(tags.filter((tag) => tag.name.toLowerCase().includes(term)));
  };

describe('TagPicker', () => {
  it('shows attached tags and removes one', async () => {
    const user = userEvent.setup();
    mockApi({ 'GET /tags': listTags() });
    const onchange = renderPicker({ values: ['t-urgent', 't-backend'], selected: [urgent, backend] });

    expect(screen.getByRole('list', { name: 'Selected tags' })).toHaveTextContent('urgent');
    await user.click(screen.getByRole('button', { name: 'Remove tag urgent' }));

    expect(onchange).toHaveBeenLastCalledWith(['t-backend']);
    expect(screen.queryByRole('button', { name: 'Remove tag urgent' })).not.toBeInTheDocument();
  });

  it('selects an existing tag from the list', async () => {
    const user = userEvent.setup();
    mockApi({ 'GET /tags': listTags() });
    const onchange = renderPicker();

    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByText('backend'));

    expect(onchange).toHaveBeenLastCalledWith(['t-backend']);
    expect(await screen.findByRole('button', { name: 'Remove tag backend' })).toBeInTheDocument();
  });

  it('creates a tag on the fly and selects it', async () => {
    const user = userEvent.setup();
    const created = makeTag({ id: 't-new', name: 'needs-migration', slug: 'needs-migration' });
    const api = mockApi({
      'GET /tags': listTags(),
      'POST /tags': () => data(created, 201),
    });
    const onchange = renderPicker({ values: ['t-urgent'], selected: [urgent] });

    await user.click(screen.getByRole('combobox'));
    await user.type(screen.getByPlaceholderText('Search or create a tag…'), 'needs-migration');
    await user.click(await screen.findByText('Create “needs-migration”'));

    await waitFor(() => expect(onchange).toHaveBeenLastCalledWith(['t-urgent', 't-new']));
    expect(api.calls('POST /tags')[0]?.body).toEqual({ name: 'needs-migration' });
    expect(await screen.findByRole('button', { name: 'Remove tag needs-migration' })).toBeInTheDocument();
  });

  it('selects the existing tag when creation reports a duplicate (409)', async () => {
    const user = userEvent.setup();
    const existing = makeTag({ id: 't-hotfix', name: 'Hot Fix', slug: 'hot-fix' });
    let created = false;
    const api = mockApi({
      // Not found by the search for "hot fix!" until the lookup after the conflict.
      'GET /tags': ({ query }) => (query.get('search') === 'hot fix' && created ? page([existing]) : page([])),
      'POST /tags': () => {
        created = true;
        return apiError(409, 'conflict', 'A tag with this name already exists', {
          name: ['A tag with this name already exists'],
        });
      },
    });
    const onchange = renderPicker();

    await user.click(screen.getByRole('combobox'));
    await user.type(screen.getByPlaceholderText('Search or create a tag…'), 'hot fix');
    await user.click(await screen.findByText('Create “hot fix”'));

    await waitFor(() => expect(onchange).toHaveBeenLastCalledWith(['t-hotfix']));
    expect(api.calls('POST /tags')).toHaveLength(1);
    expect(await screen.findByRole('button', { name: 'Remove tag Hot Fix' })).toBeInTheDocument();
  });

  it('adds nothing when creation fails for another reason', async () => {
    const user = userEvent.setup();
    mockApi({
      'GET /tags': listTags([]),
      'POST /tags': () => apiError(422, 'validation_failed', 'Validation failed', { name: ['Must be 1–50 characters'] }),
    });
    const onchange = renderPicker();

    await user.click(screen.getByRole('combobox'));
    await user.type(screen.getByPlaceholderText('Search or create a tag…'), 'x');
    await user.click(await screen.findByText('Create “x”'));

    await waitFor(() => expect(screen.getByRole('combobox')).not.toBeDisabled());
    expect(onchange).not.toHaveBeenCalled();
    expect(screen.queryByRole('list', { name: 'Selected tags' })).not.toBeInTheDocument();
  });
});
