import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { clearCsrfToken } from '$lib/api/client';
import { navigate } from '$lib/router';
import NoteEditorPage from '../pages/NoteEditorPage.svelte';
import { json, mockApi } from './fixtures/api-mock';
import QueryHarness from './fixtures/QueryHarness.svelte';

const NOTE_ID = '0193a1b2-0000-7000-8000-000000000001';

const note = (overrides: Record<string, unknown> = {}) => ({
  id: NOTE_ID,
  project_id: null,
  project: null,
  title: 'Deploy runbook',
  excerpt: 'Restart the worker.',
  category: 'Runbooks',
  is_pinned: false,
  created_at: '2026-11-01T10:00:00Z',
  updated_at: '2026-11-02T10:00:00Z',
  tags: [],
  content_json: {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Restart the worker.' }] }],
  },
  ...overrides,
});

const renderEdit = () => render(QueryHarness, { props: { component: NoteEditorPage, props: { noteId: NOTE_ID } } });
const renderNew = () => render(QueryHarness, { props: { component: NoteEditorPage } });

/** Autosave debounces for one second; give it room. */
const AUTOSAVE = { timeout: 4000 };

beforeEach(() => {
  clearCsrfToken();
  navigate('/notes/new', { replace: true });
});

describe('NoteEditorPage — autosave (edit)', () => {
  it('loads the note and reports that everything is saved', async () => {
    const api = mockApi({ [`GET /notes/${NOTE_ID}`]: () => json({ data: note() }) });
    renderEdit();

    expect(await screen.findByLabelText(/^Title/)).toHaveValue('Deploy runbook');
    expect(screen.getByLabelText(/^Category/)).toHaveValue('Runbooks');
    expect(screen.getByText('All changes saved')).toBeInTheDocument();
    // Opening a note must not write anything.
    expect(api.calls.filter((call) => call.method !== 'GET')).toHaveLength(0);
  });

  it('saves only the changed field after the debounce and shows each status', async () => {
    const api = mockApi({
      [`GET /notes/${NOTE_ID}`]: () => json({ data: note() }),
      [`PATCH /notes/${NOTE_ID}`]: (call) =>
        json({ data: note({ title: (call.body as { title: string }).title }) }),
    });
    const user = userEvent.setup();
    renderEdit();

    const title = await screen.findByLabelText(/^Title/);
    await user.type(title, ' v2');
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
    // Still within the debounce window: nothing sent yet.
    expect(api.to(`PATCH /notes/${NOTE_ID}`)).toHaveLength(0);

    expect(await screen.findByText(/^Saved \d/, {}, AUTOSAVE)).toBeInTheDocument();
    const patches = api.to(`PATCH /notes/${NOTE_ID}`);
    expect(patches).toHaveLength(1);
    expect(patches[0]!.body).toEqual({ title: 'Deploy runbook v2' });
    expect(title).toHaveValue('Deploy runbook v2');
  });

  it('keeps the content and offers a retry when saving fails', async () => {
    let fail = true;
    const api = mockApi({
      [`GET /notes/${NOTE_ID}`]: () => json({ data: note() }),
      [`PATCH /notes/${NOTE_ID}`]: () => {
        if (fail) {
          return json({ error: { code: 'internal_error', message: 'An unexpected error occurred' } }, { status: 500 });
        }
        return json({ data: note({ category: 'Ops' }) });
      },
    });
    const user = userEvent.setup();
    renderEdit();

    const category = await screen.findByLabelText(/^Category/);
    await user.clear(category);
    await user.type(category, 'Ops');

    expect(await screen.findByText('Save failed', {}, AUTOSAVE)).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Your changes are kept on this page');
    expect(category).toHaveValue('Ops'); // nothing was dropped

    fail = false;
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText(/^Saved \d/, {}, AUTOSAVE)).toBeInTheDocument();
    const patches = api.to(`PATCH /notes/${NOTE_ID}`);
    expect(patches.at(-1)!.body).toEqual({ category: 'Ops' });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('does not send a request while the title is empty', async () => {
    const api = mockApi({ [`GET /notes/${NOTE_ID}`]: () => json({ data: note() }) });
    const user = userEvent.setup();
    renderEdit();

    const title = await screen.findByLabelText(/^Title/);
    await user.clear(title);

    expect(await screen.findByText('Title is required.')).toBeInTheDocument();
    expect(screen.getByText('Not saved — add a title')).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 1300));
    expect(api.to(`PATCH /notes/${NOTE_ID}`)).toHaveLength(0);
  });

  it('shows a not-found state for an unknown note', async () => {
    mockApi({
      [`GET /notes/${NOTE_ID}`]: () =>
        json({ error: { code: 'not_found', message: 'Note not found' } }, { status: 404 }),
    });
    renderEdit();
    expect(await screen.findByText('Not found')).toBeInTheDocument();
  });
});

describe('NoteEditorPage — create', () => {
  it('saves nothing until the note is created, and requires a title', async () => {
    const api = mockApi({});
    const user = userEvent.setup();
    renderNew();

    expect(screen.getByText('Nothing is saved until you create the note')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Create note' }));

    expect(await screen.findByText('Title is required.')).toBeInTheDocument();
    expect(api.calls.filter((call) => call.method !== 'GET')).toHaveLength(0);
  });

  it('creates the note and continues on the edit route', async () => {
    const api = mockApi({
      'POST /notes': (call) => json({ data: note({ title: (call.body as { title: string }).title }) }, { status: 201 }),
    });
    const user = userEvent.setup();
    renderNew();

    await user.type(screen.getByLabelText(/^Title/), '  Incident review ');
    expect(screen.getByText('Not saved yet — create the note to keep it')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Create note' }));

    await waitFor(() => expect(window.location.pathname).toBe(`/notes/${NOTE_ID}/edit`));
    const posts = api.to('POST /notes');
    expect(posts).toHaveLength(1);
    expect(posts[0]!.body).toMatchObject({
      title: 'Incident review',
      project_id: null,
      category: null,
      is_pinned: false,
      tag_ids: [],
      content_json: { type: 'doc' },
    });
  });
});
