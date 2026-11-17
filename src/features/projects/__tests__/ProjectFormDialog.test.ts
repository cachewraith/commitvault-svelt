import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearCsrfToken } from '$lib/api/client';
import ProjectFormDialog from '../components/ProjectFormDialog.svelte';
import { apiError, data, mockApi, page } from './fixtures/api-mock';
import Harness from './fixtures/Harness.svelte';
import { makeProject } from './fixtures/records';

beforeEach(() => clearCsrfToken());

function renderDialog(props: Record<string, unknown> = {}) {
  return render(Harness, { props: { component: ProjectFormDialog, props: { open: true, ...props } } });
}

describe('ProjectFormDialog', () => {
  it('validates before calling the API and keeps what was typed', async () => {
    const user = userEvent.setup();
    const api = mockApi({ 'GET /tags': () => page([]) });
    renderDialog();

    await user.type(screen.getByLabelText(/^Repository URL/), 'javascript:alert(1)');
    await user.clear(screen.getByLabelText(/^Default branch/));
    await user.type(screen.getByLabelText(/^Default branch/), 'has space');
    await user.type(screen.getByLabelText(/^Slug/), 'Not A Slug');
    await user.click(screen.getByRole('button', { name: 'Create project' }));

    expect(await screen.findByText('Name is required.')).toBeInTheDocument();
    expect(screen.getByText('Repository URL must start with http:// or https://.')).toBeInTheDocument();
    expect(screen.getByText('Use lowercase letters, digits and single hyphens.')).toBeInTheDocument();
    expect(screen.getByText(/Branch names cannot contain spaces/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Name/)).toHaveAttribute('aria-invalid', 'true');

    // Nothing was sent, and the form still holds the user's input.
    expect(api.calls('POST /projects')).toHaveLength(0);
    expect(screen.getByLabelText(/^Repository URL/)).toHaveValue('javascript:alert(1)');
  });

  it('creates a project with normalised values and reports it', async () => {
    const user = userEvent.setup();
    const onsaved = vi.fn();
    const created = makeProject({ id: 'p9', name: 'Billing API' });
    const api = mockApi({
      'GET /tags': () => page([]),
      'POST /projects': () => data(created, 201),
    });
    renderDialog({ onsaved });

    await user.type(screen.getByLabelText(/^Name/), '  Billing API ');
    await user.type(screen.getByLabelText(/^Repository URL/), 'https://github.com/acme/billing');
    await user.click(screen.getByRole('button', { name: 'Create project' }));

    await waitFor(() => expect(onsaved).toHaveBeenCalledWith(created));
    const [call] = api.calls('POST /projects');
    expect(call?.body).toEqual({
      name: 'Billing API',
      description: null,
      repository_url: 'https://github.com/acme/billing',
      default_branch: 'main',
      tag_ids: [],
    });
    expect(call?.headers['X-CSRF-Token']).toBe('test-csrf');
  });

  it('shows a duplicate-slug conflict (409) next to the slug field and keeps the form', async () => {
    const user = userEvent.setup();
    const onsaved = vi.fn();
    const api = mockApi({
      'GET /tags': () => page([]),
      'POST /projects': () =>
        apiError(409, 'conflict', 'A project with this slug already exists', {
          slug: ['A project with this slug already exists'],
        }),
    });
    renderDialog({ onsaved });

    await user.type(screen.getByLabelText(/^Name/), 'Web App');
    await user.type(screen.getByLabelText(/^Slug/), 'web-app');
    await user.click(screen.getByRole('button', { name: 'Create project' }));

    const slug = screen.getByLabelText(/^Slug/);
    await waitFor(() => expect(slug).toHaveAttribute('aria-invalid', 'true'));
    expect(slug).toHaveAccessibleDescription(/A project with this slug already exists/);
    expect(api.calls('POST /projects')).toHaveLength(1);
    expect(onsaved).not.toHaveBeenCalled();
    // The dialog stays open with the user's values.
    expect(screen.getByLabelText(/^Name/)).toHaveValue('Web App');
    expect(slug).toHaveValue('web-app');
  });

  it('edits an existing project with PATCH and requires a slug', async () => {
    const user = userEvent.setup();
    const project = makeProject({ description: 'Invoices', repository_url: 'https://example.com/repo' });
    const api = mockApi({
      'GET /tags': () => page([]),
      'PATCH /projects/:id': ({ body }) => data({ ...project, ...(body as object) }),
    });
    renderDialog({ project });

    expect(screen.getByLabelText(/^Name/)).toHaveValue('Billing API');
    expect(screen.getByLabelText(/^Description/)).toHaveValue('Invoices');

    await user.clear(screen.getByLabelText(/^Slug/));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Slug is required.')).toBeInTheDocument();
    expect(api.calls('PATCH /projects/:id')).toHaveLength(0);

    await user.type(screen.getByLabelText(/^Slug/), 'billing');
    await user.clear(screen.getByLabelText(/^Description/));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(api.calls('PATCH /projects/:id')).toHaveLength(1));
    const [call] = api.calls('PATCH /projects/:id');
    expect(call?.path).toBe('/projects/p1');
    // A cleared optional field is sent as null so the server clears it.
    expect(call?.body).toMatchObject({ slug: 'billing', description: null, name: 'Billing API' });
  });
});
