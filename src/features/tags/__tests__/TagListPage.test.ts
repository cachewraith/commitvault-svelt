import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { clearCsrfToken } from '$lib/api/client';
import { data, mockApi, noContent, page } from '$features/projects/__tests__/fixtures/api-mock';
import Harness from '$features/projects/__tests__/fixtures/Harness.svelte';
import { makeTag } from '$features/projects/__tests__/fixtures/records';
import TagListPage from '../pages/TagListPage.svelte';
import { tagFormSchema } from '../validation';

beforeEach(() => clearCsrfToken());

const urgent = makeTag({
  id: 't-urgent',
  name: 'urgent',
  usage: { project_count: 0, commit_count: 2, deployment_count: 1, release_count: 0, note_count: 1, total: 4 },
});
const unused = makeTag({ id: 't-unused', name: 'unused', slug: 'unused' });

const renderPage = () => render(Harness, { props: { component: TagListPage } });

describe('TagListPage', () => {
  it('links each usage count to the list filtered by that tag', async () => {
    mockApi({ 'GET /tags': () => page([urgent, unused]) });
    renderPage();

    const commits = await screen.findByRole('link', { name: '2 commits tagged urgent' });
    expect(commits).toHaveAttribute('href', '/commits?tag_id=t-urgent');
    expect(screen.getByRole('link', { name: '1 notes tagged urgent' })).toHaveAttribute('href', '/notes?tag_id=t-urgent');
    expect(screen.getByRole('link', { name: '1 deployments tagged urgent' })).toHaveAttribute(
      'href',
      '/deployments?tag_id=t-urgent',
    );
    // Zero counts are plain text, not links to empty lists.
    expect(screen.queryByRole('link', { name: /tagged unused/ })).not.toBeInTheDocument();
  });

  it('states how many records lose the tag before deleting', async () => {
    const user = userEvent.setup();
    const api = mockApi({ 'GET /tags': () => page([urgent, unused]), 'DELETE /tags/:id': () => noContent() });
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Delete tag urgent' }));
    expect(await screen.findByText(/4 records will lose this tag/)).toBeInTheDocument();
    expect(api.calls('DELETE /tags/:id')).toHaveLength(0);

    await user.click(screen.getByRole('button', { name: 'Delete tag' }));
    await waitFor(() => expect(api.calls('DELETE /tags/:id')).toHaveLength(1));
    expect(api.calls('DELETE /tags/:id')[0]?.path).toBe('/tags/t-urgent');
  });

  it('creates a tag from the dialog', async () => {
    const user = userEvent.setup();
    const api = mockApi({
      'GET /tags': () => page([]),
      'POST /tags': ({ body }) => data(makeTag({ id: 't-new', ...(body as object) }), 201),
    });
    renderPage();

    expect(await screen.findByText('No tags yet')).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: 'New tag' })[0]!);
    await user.click(await screen.findByRole('button', { name: 'Create tag' }));
    expect(await screen.findByText('Name is required.')).toBeInTheDocument();

    await user.type(screen.getByLabelText(/^Name/), ' hotfix ');
    await user.click(screen.getByRole('radio', { name: '#ef4444' }));
    await user.click(screen.getByRole('button', { name: 'Create tag' }));

    await waitFor(() => expect(api.calls('POST /tags')).toHaveLength(1));
    expect(api.calls('POST /tags')[0]?.body).toEqual({ name: 'hotfix', color: '#ef4444' });
  });
});

describe('tagFormSchema', () => {
  it('normalises the colour to lower-case six-digit hex', () => {
    expect(tagFormSchema.parse({ name: 'a', color: '#EF4444' }).color).toBe('#ef4444');
    expect(tagFormSchema.safeParse({ name: 'a', color: '#fff' }).success).toBe(false);
    expect(tagFormSchema.safeParse({ name: 'a', color: 'red' }).success).toBe(false);
    expect(tagFormSchema.safeParse({ name: 'x'.repeat(51), color: '#ef4444' }).success).toBe(false);
  });
});
