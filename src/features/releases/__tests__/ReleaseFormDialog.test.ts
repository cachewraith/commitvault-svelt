import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearCsrfToken } from '$lib/api/client';
import ReleaseFormDialog from '../components/ReleaseFormDialog.svelte';
import { json, mockApi } from './fixtures/api-mock';
import QueryHarness from './fixtures/QueryHarness.svelte';

const PROJECT_ID = '0193a1b2-0000-7000-8000-0000000000p1';
const RELEASE_ID = '0193a1b2-0000-7000-8000-0000000000r1';

const release = (overrides: Record<string, unknown> = {}) => ({
  id: RELEASE_ID,
  project_id: PROJECT_ID,
  project: { id: PROJECT_ID, name: 'Shop', slug: 'shop' },
  version: '1.4.0',
  title: 'Spring release',
  description: null,
  released_at: null,
  status: 'draft',
  created_at: '2026-11-01T10:00:00Z',
  updated_at: '2026-11-01T10:00:00Z',
  tags: [],
  commit_count: 0,
  release_notes: null,
  commits: [],
  ...overrides,
});

function renderDialog(props: Record<string, unknown>) {
  return render(QueryHarness, { props: { component: ReleaseFormDialog, props: { open: true, ...props } } });
}

// Dialog content is portalled and not laid out in jsdom: query by label/text.
const submit = (user: ReturnType<typeof userEvent.setup>, label: string) => user.click(screen.getByText(label));

beforeEach(() => {
  clearCsrfToken();
});

describe('ReleaseFormDialog', () => {
  it('validates before calling the API and keeps what was typed', async () => {
    const api = mockApi({});
    const user = userEvent.setup();
    renderDialog({ projectId: PROJECT_ID });

    await user.type(await screen.findByLabelText(/^Title/), 'Spring release');
    await submit(user, 'Create release');

    expect(await screen.findByText('Version is required.')).toBeInTheDocument();
    expect(screen.getByLabelText(/^Version/)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText(/^Title/)).toHaveValue('Spring release');
    expect(api.calls.filter((call) => call.method !== 'GET')).toHaveLength(0);

    // After the first attempt the message follows the input.
    await user.type(screen.getByLabelText(/^Version/), '1.4.0');
    expect(screen.queryByText('Version is required.')).not.toBeInTheDocument();
  });

  it('requires a project when none is preselected', async () => {
    const api = mockApi({});
    const user = userEvent.setup();
    renderDialog({});

    await user.type(await screen.findByLabelText(/^Version/), '1.0.0');
    await user.type(screen.getByLabelText(/^Title/), 'First');
    await submit(user, 'Create release');

    expect(await screen.findByText('Choose a project.')).toBeInTheDocument();
    expect(api.calls.filter((call) => call.method !== 'GET')).toHaveLength(0);
  });

  it('creates the release in the selected project with normalised values', async () => {
    const api = mockApi({
      [`POST /projects/${PROJECT_ID}/releases`]: () => json({ data: release() }, { status: 201 }),
    });
    const onsaved = vi.fn();
    const user = userEvent.setup();
    renderDialog({ projectId: PROJECT_ID, onsaved });

    await user.type(await screen.findByLabelText(/^Version/), ' 1.4.0 ');
    await user.type(screen.getByLabelText(/^Title/), 'Spring release');
    await submit(user, 'Create release');

    await waitFor(() => expect(onsaved).toHaveBeenCalledTimes(1));
    expect(onsaved.mock.calls[0]![0]).toMatchObject({ id: RELEASE_ID, version: '1.4.0' });
    expect(api.to(`POST /projects/${PROJECT_ID}/releases`)[0]!.body).toEqual({
      version: '1.4.0',
      title: 'Spring release',
      status: 'draft',
      released_at: null,
      description: null,
      release_notes: null,
      commit_ids: [],
      tag_ids: [],
    });
  });

  it('shows a duplicate version (409) on the version field without clearing the form', async () => {
    mockApi({
      [`POST /projects/${PROJECT_ID}/releases`]: () =>
        json(
          {
            error: {
              code: 'conflict',
              message: 'This project already has a release with this version',
              details: { version: ['This project already has a release with this version'] },
            },
          },
          { status: 409 },
        ),
    });
    const onsaved = vi.fn();
    const user = userEvent.setup();
    renderDialog({ projectId: PROJECT_ID, onsaved });

    await user.type(await screen.findByLabelText(/^Version/), '1.4.0');
    await user.type(screen.getByLabelText(/^Title/), 'Spring release');
    await submit(user, 'Create release');

    expect(await screen.findByText('This project already has a release with this version')).toBeInTheDocument();
    expect(screen.getByLabelText(/^Version/)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText(/^Version/)).toHaveValue('1.4.0');
    expect(screen.getByLabelText(/^Title/)).toHaveValue('Spring release');
    expect(onsaved).not.toHaveBeenCalled();

    // The complaint is about the submitted value: it goes away once the field changes.
    await user.type(screen.getByLabelText(/^Version/), '-hotfix');
    expect(screen.queryByText('This project already has a release with this version')).not.toBeInTheDocument();
    expect(screen.getByLabelText(/^Version/)).not.toHaveAttribute('aria-invalid');
  });

  it('maps a rejected commit selection (422) to the commits field', async () => {
    mockApi({
      [`POST /projects/${PROJECT_ID}/releases`]: () =>
        json(
          {
            error: {
              code: 'validation_failed',
              message: 'Validation failed',
              details: { commit_ids: ['One or more commits do not exist in this project'] },
            },
          },
          { status: 422 },
        ),
    });
    const user = userEvent.setup();
    renderDialog({ projectId: PROJECT_ID });

    await user.type(await screen.findByLabelText(/^Version/), '1.4.0');
    await user.type(screen.getByLabelText(/^Title/), 'Spring release');
    await submit(user, 'Create release');

    expect(await screen.findByText('One or more commits do not exist in this project')).toBeInTheDocument();
  });

  it('prefills the form when editing and sends a PATCH', async () => {
    const api = mockApi({
      [`PATCH /releases/${RELEASE_ID}`]: () => json({ data: release({ title: 'Spring release (final)' }) }),
    });
    const user = userEvent.setup();
    renderDialog({ release: release({ description: 'Checkout improvements' }) });

    const title = await screen.findByLabelText(/^Title/);
    expect(screen.getByLabelText(/^Version/)).toHaveValue('1.4.0');
    expect(title).toHaveValue('Spring release');
    expect(screen.getByLabelText(/^Description/)).toHaveValue('Checkout improvements');
    expect(screen.getByText('Shop')).toBeInTheDocument(); // project is fixed when editing

    await user.type(title, ' (final)');
    await submit(user, 'Save changes');

    await waitFor(() => expect(api.to(`PATCH /releases/${RELEASE_ID}`)).toHaveLength(1));
    expect(api.to(`PATCH /releases/${RELEASE_ID}`)[0]!.body).toMatchObject({
      version: '1.4.0',
      title: 'Spring release (final)',
      description: 'Checkout improvements',
      commit_ids: [],
    });
  });

  it('hints, without blocking, when the version is not a semantic version', async () => {
    mockApi({});
    const user = userEvent.setup();
    renderDialog({ projectId: PROJECT_ID });

    expect(await screen.findByText(/Semantic versions such as 1\.4\.0 are supported but not required/)).toBeInTheDocument();
    await user.type(screen.getByLabelText(/^Version/), 'spring-drop');
    expect(screen.getByText(/Not a semantic version — that is fine/)).toBeInTheDocument();
  });
});
