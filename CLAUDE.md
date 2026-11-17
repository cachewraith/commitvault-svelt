# CommitVault frontend — engineering guide

Standalone SPA: **Svelte 5 (runes) + TypeScript (strict) + Vite**, Tailwind CSS v4,
shadcn-svelte, TanStack Query, Tiptap, Zod. No SvelteKit. Package manager: **bun**.

This file is the contract for anyone (human or agent) adding screens. Read it before
writing code; the patterns below are type-checked and tested.

## Commands

```bash
bun install            # dependencies
bun run dev            # Vite dev server on :5173, proxies /api → $API_PROXY_TARGET (default http://localhost:3000)
bun run check          # svelte-check (app) + tsc (node config) — must be 0 errors / 0 warnings
bun run test           # Vitest unit + component tests (jsdom)
bun run build          # production build into dist/
bun run gen:api        # regenerate src/lib/api/schema.d.ts from ../backend/openapi.json
bun run test:e2e       # Playwright (needs the full stack running + `bunx playwright install chromium`)
```

Before reporting work as done: `bun run check && bun run test && bun run build` must pass.
Then delete `dist/` (keep `node_modules/`).

## Hard rules

- **Never call `fetch` from a component.** Network access goes `component → features/<x>/api.ts → $lib/api/client`.
- **No mock/fake data** as an implementation. Tests may stub `fetch`.
- **No `{@html}`** with user or API content. Rich text renders through `RichTextViewer` only.
- **No inline scripts, no CDN assets, no remote fonts.** Production CSP is `default-src 'self'` (see `nginx.conf`).
- **User-supplied URLs** (repository URL, commit external URL) are rendered only through
  `safeExternalUrl()` (http/https) with `target="_blank" rel="noopener noreferrer"`.
- **User-supplied colours** go through `safeHexColor()` / the badge components — never raw into `style`.
- **Wording:** a deployment record means "the user recorded a deployment". Never say an
  environment is "ahead"/"behind", and never imply a commit is absent from an environment
  because no record exists. Say "recorded in A, no record in B".
- Stored commands/notes are documentation: offer **copy**, never execute.
- Do not add dependencies without a real need. Check an installed package's real API in
  `node_modules/` (several libraries had recent majors — see "Versions").
- TypeScript is pinned to `~6.0` (`svelte-check` and `openapi-typescript` do not support TS 7 yet).
- A new screen needs one entry in `src/routes/index.ts` (lazy import) and one builder in
  `src/routes/paths.ts`. Changing an existing screen never touches the route table.

## Folder responsibilities

```text
src/
├── main.ts                 entry: styles, router.start(routes), 401 hook, bootstrapSession(), mount
├── App.svelte              providers (QueryClient), session gate, route guard, layout selection, Toaster, ConfirmDialogHost
├── routes/
│   ├── index.ts            route table (path → lazy page import, title, access, layout)
│   └── paths.ts            URL builders — the only place URLs are spelled out
├── features/<feature>/     one folder per product area
│   ├── api.ts              typed endpoint functions for this feature (uses $lib/api/client)
│   ├── types.ts            aliases of generated schema types + UI-only types
│   ├── validation.ts       Zod schemas for this feature's forms
│   ├── queries.ts          (optional) shared query/mutation option factories
│   ├── components/         feature-specific components (forms, dialogs, rows)
│   └── pages/              route components (thin: compose queries + components)
├── lib/
│   ├── api/                client.ts, errors.ts, types.ts, query-client.ts, query-keys.ts, schema.d.ts (generated)
│   ├── components/         shared components (see inventory) and ui/ (generated shadcn-svelte primitives)
│   ├── layouts/            AppShell, SidebarNav, TopBar, AuthLayout, Logo, navigation.ts
│   ├── router/             history router: router.svelte.ts, query.svelte.ts, match.ts, Router.svelte
│   ├── stores/             runes stores: session, theme, sidebar
│   ├── types/              hand-written shared types (User, statuses, RichTextDoc)
│   ├── utils/              cn, format, hash, slugify, debounce, clipboard, color, url
│   └── validators/         reusable Zod building blocks + validateForm
├── styles/                 app.css (tokens, base), rich-text.css (Tiptap content)
└── test/setup.ts           Vitest setup (jest-dom, jsdom shims)
static/                     copied verbatim to the web root (favicon, robots.txt, theme-init.js)
e2e/                        Playwright specs
```

Dependency direction: `features → lib`, never `lib → features` (the session *state* lives in
`lib/stores`, the session *lifecycle* in `features/auth/session.ts`; `App.svelte`/`main.ts` wire them).
Features may import another feature's `api.ts`/`types.ts`/shared components (e.g. a commit picker)
but not its pages.

Aliases: `$lib` → `src/lib`, `$features` → `src/features`, `$routes` → `src/routes`
(import URL builders with `import { paths } from '$routes/paths'`).

## Screens (route → page component)

| Route | Page file (under `src/features/`) | Props |
| --- | --- | --- |
| `/` | `dashboard/pages/DashboardPage.svelte` | — |
| `/projects` | `projects/pages/ProjectListPage.svelte` | — |
| `/projects/:projectId` | `projects/pages/ProjectDetailPage.svelte` | `projectId` |
| `/projects/:projectId/settings` | `projects/pages/ProjectSettingsPage.svelte` | `projectId` |
| `/projects/:projectId/environments` | `environments/pages/EnvironmentManagePage.svelte` | `projectId` |
| `/projects/:projectId/compare` | `deployments/pages/EnvironmentComparePage.svelte` | `projectId` (+ `?base=&target=`) |
| `/environments` | `environments/pages/EnvironmentOverviewPage.svelte` | — |
| `/commits` | `commits/pages/CommitListPage.svelte` | — |
| `/commits/:commitId` | `commits/pages/CommitDetailPage.svelte` | `commitId` |
| `/deployments` | `deployments/pages/DeploymentHistoryPage.svelte` | — |
| `/deployments/:deploymentId` | `deployments/pages/DeploymentDetailPage.svelte` | `deploymentId` |
| `/releases` | `releases/pages/ReleaseListPage.svelte` | — |
| `/releases/:releaseId` | `releases/pages/ReleaseDetailPage.svelte` | `releaseId` |
| `/notes` | `notes/pages/NoteListPage.svelte` | — |
| `/notes/new` and `/notes/:noteId/edit` | `notes/pages/NoteEditorPage.svelte` | `noteId?` (undefined = create) |
| `/notes/:noteId` | `notes/pages/NoteReadPage.svelte` | `noteId` |
| `/tags` | `tags/pages/TagListPage.svelte` | — |
| `/search` | `search/pages/SearchPage.svelte` | — (`?q=`) |
| `/settings` | `settings/pages/SettingsPage.svelte` | — |

Also: `auth/pages/LoginPage.svelte` (`/login`, guest) and `errors/pages/NotFoundPage.svelte` (fallback).

### Shared feature components (import these instead of rebuilding them)

| Component | Use |
| --- | --- |
| `projects/components/ProjectSelect` | searchable project picker (`value`, `clearable`, `includeArchived`) |
| `projects/components/ProjectFormDialog` | create / edit a project |
| `environments/components/EnvironmentSelect` | environment picker for one project (`projectId`) |
| `environments/components/EnvironmentFormDialog` | create / edit an environment |
| `tags/components/TagPicker` | multi select with create-on-the-fly → bind to a form's `tag_ids` |
| `tags/components/TagSelect` | single tag filter (`tag_id`) |
| `commits/components/CommitFormDialog` | record / edit a commit (the quick-create form) |
| `commits/components/CommitPicker`, `CommitMultiPicker` | pick one / many commits of a project (server-side search) |
| `commits/components/CommitList` | compact read-only commit list for embedding |
| `deployments/components/DeploymentFormDialog` | record / edit a deployment record (locks whatever ids are passed) |
| `deployments/components/DeploymentTimeline` | read-only timeline of deployment records |
| `releases/components/ReleaseFormDialog`, `ReleaseList` | create / edit a release; compact list |
| `notes/components/NoteList` | compact read-only note list |
| `commits/components/QuickCreateMenu` | the top-bar "New" menu (passed to `AppShell` as the `actions` snippet from `App.svelte`) |

Notes autosave lives in `notes/autosave.svelte.ts` (debounced, sends only changed fields, serialises
saves so a slow response can never overwrite newer edits). Creating a note is explicit ("Create note"
or Ctrl/Cmd+S); every later edit autosaves.

## Router (`$lib/router`)

A small History-API router; no dependency.

**Route params arrive as props.** For `/projects/:projectId`:

```svelte
<script lang="ts">
  let { projectId }: { projectId: string } = $props();
</script>
```

The page component is **re-created whenever the pathname changes** (`{#key pathname}`), so
state never leaks between two records; query-string changes do *not* remount it.

```ts
import { router, navigate, setQuery, setPageTitle, queryString, queryNumber, queryBoolean, queryEnum } from '$lib/router';
import { paths } from '$routes/paths';

router.pathname            // '/commits/abc'            (reactive)
router.params              // { commitId: 'abc' }       (reactive)
router.query.get('tab')    // reactive SvelteURLSearchParams (read-only use)
router.fullPath            // path + query + hash

navigate(paths.commit(id));                    // push
navigate(paths.commits(), { replace: true });  // replace
router.back('/commits');                       // history.back() with fallback

setQuery({ status: 'failed', page: null });    // merge into ?query (replaceState; null/''/undefined removes)
setPageTitle(project.name);                    // document.title = "<name> · CommitVault"
```

Typed query bindings (reactive getter + URL-writing setter) — use them for list state so
filters are shareable and survive reload/back:

```ts
const page = queryNumber('page', 1);
const search = queryString('search');
const status = queryEnum('status', DEPLOYMENT_STATUSES);        // T | undefined
const order = queryEnum('order', ['asc', 'desc'], 'desc');       // with default
page.value = 2;            // → ?page=2     (assigning the default removes the key)
```

When a filter changes, reset the page in the same call: `setQuery({ search: q, page: null })`.

**Links are plain anchors**: `<a href={paths.project(id)}>`. A global click handler turns
same-origin anchor clicks into `navigate()` (modifier clicks, `target="_blank"`, `download`,
`data-native`, `rel="external"` and `/api/*` are left to the browser). `Button` accepts `href`.

Route definitions (`src/routes/index.ts`): `{ path, load: () => import(...), title?, access?: 'private' | 'guest' | 'public', layout?: 'app' | 'auth' }`.
Defaults: `private` + `app`. The guard in `App.svelte` redirects signed-out visitors of
private routes to `/login?next=<path>` and signed-in visitors of guest routes to `next` (validated
by `safeInternalPath`) or `/`. Static segments outrank params (`/notes/new` beats `/notes/:noteId`).

## API layer (`$lib/api`)

`client.ts` is the only code that calls `fetch`.

```ts
import { api } from '$lib/api/client';

api.get<T>(path, { query?, signal? })        // → T            (unwraps { data })
api.list<T>(path, { query?, signal? })       // → { data: T[], meta: PageMeta }
api.post<T = void>(path, body?, options?)    // → T | undefined on 204
api.put<T = void>(path, body?, options?)
api.patch<T = void>(path, body?, options?)
api.del(path, options?)                      // → void
```

- Base path `/api/v1`, `credentials: 'same-origin'`.
- **CSRF**: every POST/PUT/PATCH/DELETE carries `X-CSRF-Token`. The token is fetched lazily
  from `GET /auth/csrf`, cached in memory, replaced by the one in login/me responses, and on a
  `403 csrf_invalid` refetched and the request retried **once**. You never handle it yourself.
- **401** on any non-`/auth/*` endpoint clears the session → the guard redirects to login.
- `query` accepts any plain object; `undefined`/`null`/`''`/empty arrays are dropped; arrays are
  sent comma-separated (`types=a,b`); `Date` → ISO string; booleans → `true`/`false`.
- Every failure is an **`ApiError`** `{ status, code, message, details?, requestId?, retryAfter? }`
  with helpers `isValidation`, `isNotFound`, `isConflict`, `isRateLimited`, `isNetwork`.
  Client-side codes: `network_error` (status 0), `aborted`, `invalid_response`.
- Helpers in `errors.ts`: `isApiError(e)`, `errorMessage(e, fallback)`, `apiFieldErrors(e)`
  (422 `details` → `{ field: firstMessage }`).

### Types

`bun run gen:api` writes `src/lib/api/schema.d.ts` from the backend's OpenAPI document. Alias
what you need in the feature's `types.ts`; do not hand-write resource shapes:

```ts
import type { components } from '$lib/api/schema';
export type Commit = components['schemas']['CommitResponse'];
```

Wire-level generic types (`Paginated<T>`, `PageMeta`, `ListParams`, `SortOrder`, `FieldErrors`)
are in `$lib/api/types`; hand-written primitives (statuses, `RichTextDoc`, `User`) in `$lib/types`.

### Query keys (`query-keys.ts`)

```text
[resource]                      everything for a resource   → invalidate after any mutation
[resource, 'list', params]      one filtered/paginated list
[resource, 'detail', id]        one record
[resource, <named>, ...]        special reads (environments.byProject / .compare, notes.categories, search.results)
```

Available: `queryKeys.dashboard | projects | environments | commits | deployments | releases | notes | tags | search | auth`.
After a mutation invalidate the resource's `.all` **and** anything derived from it — at minimum
`queryKeys.dashboard.all`; deployments also affect `queryKeys.environments.all` and
`queryKeys.commits.all` (deployment status/counts); tag changes affect every tagged resource.

QueryClient defaults (`query-client.ts`): `staleTime` 30 s, `gcTime` 5 min, no retry on 4xx/aborted
(max 2 retries otherwise), `refetchOnWindowFocus: false`, mutations never retry.

### Worked example — feature API module

```ts
// src/features/tags/api.ts
import { api } from '$lib/api/client';
import type { ListParams } from '$lib/api/types';
import type { Tag, TagInput } from './types';

export interface TagListParams extends ListParams {
  project_id?: string;
}

export const tagsApi = {
  list: (params: TagListParams, signal?: AbortSignal) => api.list<Tag>('/tags', { query: params, signal }),
  get: (id: string, signal?: AbortSignal) => api.get<Tag>(`/tags/${id}`, { signal }),
  create: (input: TagInput) => api.post<Tag>('/tags', input),
  update: (id: string, input: Partial<TagInput>) => api.patch<Tag>(`/tags/${id}`, input),
  remove: (id: string) => api.del(`/tags/${id}`),
};
```

### Worked example — list query (URL-driven) with all four states

`@tanstack/svelte-query` v6: `createQuery`/`createMutation` take an **accessor function**
(`() => options`) and return a reactive object — read `query.data`, `query.isPending`, … directly
(no `$` store prefix).

```svelte
<script lang="ts">
  import { createQuery, keepPreviousData } from '@tanstack/svelte-query';
  import { queryKeys } from '$lib/api';
  import {
    DataTable, DataTableBody, DataTableCell, DataTableHead, DataTableHeader, DataTableRow,
    EmptyState, ErrorState, FilterBar, PageHeader, Pagination, SearchInput, TableSkeleton, TagBadge,
  } from '$lib/components';
  import { queryNumber, queryString, setQuery } from '$lib/router';
  import { tagsApi } from '../api';

  const page = queryNumber('page', 1);
  const search = queryString('search');
  const params = $derived({ page: page.value, per_page: 25, search: search.value || undefined });

  const tags = createQuery(() => ({
    queryKey: queryKeys.tags.list(params),
    queryFn: ({ signal }) => tagsApi.list(params, signal),
    placeholderData: keepPreviousData,            // keep the old page visible while the next loads
  }));
</script>

<div class="page">
  <PageHeader title="Tags" description="Reusable labels." />

  <FilterBar active={search.value !== ''} onreset={() => setQuery({ search: null, page: null })}>
    <SearchInput value={search.value} onsearch={(q) => setQuery({ search: q, page: null })} label="Search tags" />
  </FilterBar>

  {#if tags.isPending}
    <TableSkeleton rows={8} columns={3} />
  {:else if tags.isError}
    <ErrorState error={tags.error} onretry={() => tags.refetch()} retrying={tags.isFetching} />
  {:else if tags.data.data.length === 0}
    <EmptyState title="No tags yet" description="Create a tag to label commits, deployments and notes." />
  {:else}
    <DataTable label="Tags">
      <DataTableHeader>
        <DataTableRow><DataTableHead>Name</DataTableHead></DataTableRow>
      </DataTableHeader>
      <DataTableBody>
        {#each tags.data.data as tag (tag.id)}
          <DataTableRow>
            <DataTableCell><TagBadge name={tag.name} color={tag.color} /></DataTableCell>
          </DataTableRow>
        {/each}
      </DataTableBody>
      {#snippet footer()}
        <Pagination meta={tags.data.meta} onchange={(next) => (page.value = next)} label="tags" />
      {/snippet}
    </DataTable>
  {/if}
</div>
```

Every data screen must render **loading (skeleton), error (ErrorState + retry), empty (EmptyState
with an action), and success** states. Distinguish "nothing exists yet" from "no results for
these filters" in the empty state.

### Worked example — mutation with validation, 422 mapping, invalidation, toast, confirm

```svelte
<script lang="ts">
  import { createMutation, useQueryClient } from '@tanstack/svelte-query';
  import { z } from 'zod';
  import { apiFieldErrors, queryKeys, type FieldErrors } from '$lib/api';
  import { confirm, FormField, toast, toastError } from '$lib/components';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { hexColor, requiredText, validateForm } from '$lib/validators';
  import { tagsApi } from '../api';
  import type { TagInput } from '../types';

  const queryClient = useQueryClient();

  const schema = z.object({ name: requiredText('Name', 50), color: hexColor.nullable() });
  let values = $state({ name: '', color: null as string | null });
  let errors = $state<FieldErrors>({});

  const createTag = createMutation(() => ({
    mutationFn: (input: TagInput) => tagsApi.create(input),
    onSuccess: (tag) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.tags.all });
      toast.success(`Tag “${tag.name}” created`);
      values = { name: '', color: null };            // reset only after success
    },
    onError: (error) => {
      errors = apiFieldErrors(error);                // 422 details → fields (values are kept!)
      toastError(error, 'Could not create the tag.');
    },
  }));

  function submit(event: SubmitEvent) {
    event.preventDefault();
    const result = validateForm(schema, values);
    errors = result.errors;
    if (!result.ok) return;                          // form data stays as typed
    createTag.mutate(result.data);
  }

  const removeTag = createMutation(() => ({
    mutationFn: (id: string) => tagsApi.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.tags.all });
      toast.success('Tag deleted');
    },
    onError: (error) => toastError(error, 'Could not delete the tag.'),
  }));

  async function remove(id: string, name: string) {
    const ok = await confirm({
      title: `Delete tag “${name}”?`,
      description: 'It will be removed from every record that uses it.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (ok) removeTag.mutate(id);
  }
</script>

<form onsubmit={submit} novalidate class="flex flex-col gap-4">
  <FormField label="Name" error={errors.name} required>
    {#snippet children(field)}
      <Input {...field} bind:value={values.name} maxlength={50} />
    {/snippet}
  </FormField>
  <Button type="submit" disabled={createTag.isPending}>Create tag</Button>
</form>
```

## Form pattern (summary)

1. Hold values in `$state`; errors in `$state<FieldErrors>({})`.
2. One Zod schema per form in `features/<x>/validation.ts`, built from `$lib/validators`
   (`requiredText`, `optionalText` → `''` becomes `null`, `optionalHttpUrl`, `email`, `hexColor`,
   `commitHash`, `slug`, `branchName`, `uuid`). Keep limits equal to the backend's.
3. `validateForm(schema, values)` → `{ ok, data, errors }`; errors are keyed by dotted field
   path, form-level issues under `_form`.
4. Render each control inside `<FormField label error hint required>` and spread the snippet
   argument onto the control (`id`, `aria-invalid`, `aria-describedby`, `aria-required`).
5. On submit failure **never clear the form**. Map 422s with `apiFieldErrors(error)`, show other
   errors with `toastError`. Disable the submit button while `mutation.isPending`.
6. Destructive actions always go through `await confirm({...})` first.
7. `<form novalidate>` — validation messages come from Zod, not the browser.
8. For rich text use `$state.raw` for the document and `RichTextEditor`'s `onchange`.

## Component inventory (`$lib/components`)

Import shared components from the barrel `$lib/components`; shadcn primitives from
`$lib/components/ui/<name>`.

| Component | Props (→ = required) | Notes |
| --- | --- | --- |
| `PageHeader` | →`title`, `description`, `breadcrumbs: {label, href?}[]`, snippets `actions`, `meta`, `children` | Renders the page `<h1>`. One per page. |
| `EmptyState` | →`title`, `description`, `icon`, `action` snippet, `compact`, `bordered` | Always give an action when one exists. |
| `ErrorState` | `error`, `title`, `message`, `onretry`, `retrying`, `compact` | Uses `ApiError` message/request id; 404 gets "Not found" wording and no retry. |
| `TableSkeleton` / `CardGridSkeleton` / `DetailSkeleton` / `ListSkeleton` | `rows`/`columns`, `count`/`variant: 'card'｜'stat'`, `header`, `rows` | `role="status"`, `aria-busy`. |
| `Pagination` | →`meta: PageMeta`, →`onchange(page)`, `label`, `disabled`, `hideWhenSinglePage` | Range summary + pager. |
| `SearchInput` | →`onsearch(value)`, `value`, `label`, `placeholder`, `delay=300`, `disabled`, `ref` (bindable) | Debounced; Enter commits now; Esc/× clears; follows external `value`. |
| `FormField` | →`label`, →`children(field)` snippet, `error`, `hint`, `required`, `optional`, `hideLabel`, `labelAside` | Spread `field` on the control. |
| `FilterBar` | →`children`, `actions` snippet, `active`, `onreset`, `label` | "Clear filters" appears when `active`. |
| `DateRangeFilter` | →`onchange({from, to})`, `from`, `to`, `label`, `disabled` | Emits ISO start/end of the local day (`date_from`/`date_to`). |
| `Combobox` | →`options: ComboboxOption[]`, `value` (bindable), `onchange`, `placeholder`, `clearable`, `onsearch` (server-side), `loading`, `selectedLabel`, FormField attrs | Searchable single select. |
| `MultiCombobox` | →`options`, `values` (bindable), `onchange`, `selectedOptions`, `oncreate(label)`, `max`, `onsearch`, `loading` | Searchable multi select (tags, release commits). |
| `StatusBadge` | →`status`, `variant: 'badge'｜'dot'` | Deployment / release / project statuses; label always shown. |
| `HashChip` | →`hash`, `short`, `full`, `href`, `externalUrl`, `copyable` | Monospace hash + copy (copies the full hash) + optional Git-host link. |
| `BranchBadge` | →`name`, `href` | Monospace, branch icon, accent tint. |
| `EnvironmentBadge` | →`name`, `color`, `href`, `size: 'sm'｜'md'` | Colour dot from a validated hex. |
| `TagBadge` | →`name`, `color`, `href`, `onremove` | Pill; remove button when `onremove`. |
| `DateTime` | →`value`, `mode: 'relative'｜'date'｜'datetime'｜'both'`, `fallback` | `<time>` with full date in `title`. |
| `CopyButton` | →`value`, `label`, `text`, `variant`, `size`, `oncopied` | Check-mark feedback, announces "Copied". |
| `DataTable` + `DataTableHeader/Body/Row/Head/Cell` | `DataTable`: →`label`, `footer` snippet · `Row`: `href`, `selected` · `Head`: `sortKey`, `sort`, `order`, `onsort(sort, order)`, `defaultOrder`, `align` · `Cell`: `align`, `wrap`, `colspan` | Dense bordered table; sortable headers set `aria-sort`. A row `href` is a mouse convenience — still put a real link in a cell. |
| `Timeline` + `TimelineItem` | `Timeline`: →`label` · `Item`: →`title` snippet, `meta` snippet, `tone`, `icon`, `children` | Deployment history. Use the status tone. |
| `RichTextEditor` | `value: RichTextDoc｜null`, `onchange(doc)`, `placeholder`, `disabled`, `label`, `autofocus`, `minHeight`, `invalid`, `describedBy` | Tiptap; lazy chunk. Keep `value` in `$state.raw`. |
| `RichTextViewer` | `value`, `emptyText` | Read-only render through Tiptap's schema. |
| `confirm(options)` | `{ title, description?, confirmLabel?, cancelLabel?, destructive? }` → `Promise<boolean>` | Host is mounted in `App.svelte`. |
| `toast`, `toastError(error, fallback)` | — | svelte-sonner; `toastError` handles 422/429/aborted sensibly. |

Helpers exported from the same barrel: `statusPresentation`, `STATUS_PRESENTATION`, `TONE_CLASSES`,
`docToPlainText`, `isEmptyDoc`, `sanitizeDoc`, `toDoc`.

shadcn-svelte primitives present in `ui/`: alert-dialog, badge, breadcrumb, button, card, checkbox,
command, dialog, dropdown-menu, input, input-group, label, popover, select, separator, sheet,
skeleton, sonner, switch, table, tabs, textarea, tooltip. Add more with
`bunx shadcn-svelte@latest add <name>` only when needed (fix icon imports to canonical lucide
names if `bun run check` complains). `Button` sizes: `xs | sm | default | lg | icon-xs | icon-sm | icon | icon-lg`;
variants: `default | outline | secondary | ghost | destructive | link`.

Utilities (`$lib/utils`): `cn`, `formatDate`, `formatDateTime`, `formatFull`, `formatRelative`,
`formatNumber`, `pluralize`, `toDateInputValue`, `toDateTimeInputValue`, `fromDateTimeInputValue`,
`startOfLocalDayIso`, `endOfLocalDayIso`, `shortHash`, `isCommitHash`, `slugify`, `debounce`,
`copyToClipboard`, `isHexColor`, `safeHexColor`, `COLOR_SWATCHES`, `isSafeUrl`, `safeExternalUrl`.

Icons: `import XIcon from '@lucide/svelte/icons/<canonical-name>'` (one file per icon; use
canonical names — alias names such as `trash-2` or `triangle-alert` have no type declarations in
this version; look in `node_modules/@lucide/svelte/dist/icons/` for `<name>.svelte`).

## Rich text

Allowed nodes/marks/attrs are documented at the top of
`src/lib/components/rich-text/schema.ts`; the backend validates the same allowlist. Enabling a
new extension requires updating that comment, `NODE_TYPES`/`MARK_TYPES`, the schema test and the
backend validator together. Links: `http`, `https`, `mailto` only, always
`target="_blank" rel="noopener noreferrer nofollow"`. Images: by `http(s)` URL only (no upload,
no data URIs). `sanitizeDoc()` drops anything outside the allowlist before content reaches Tiptap.

Editor contract: `onchange(doc)` fires only for changes made after the user first interacts with
the editor (editor housekeeping on mount is not reported, so opening a record never looks like an
edit). Changing `value` to a structurally different document replaces the content and resets the
cursor — do that only to load another record or reset the form; **do not write the server's
response back into `value` while the user is typing**.

Autosave (notes): debounce `onchange` with `debounce()` (e.g. 1 s), `flush()` on navigation/unmount,
and show a visible status ("Saving…", "Saved 12:04", "Save failed — Retry").

## Design system

Tokens are CSS variables in `src/styles/app.css`, exposed as Tailwind colours. Dark is the
default theme (`.dark` on `<html>`); the light palette is on `:root`. Always use tokens — never
hard-coded hex/oklch values or `zinc-*`/`slate-*` palette classes.

| Token (Tailwind) | Use |
| --- | --- |
| `bg-background` / `text-foreground` | page surface / primary text |
| `bg-card` | raised surfaces (cards, tables, dialogs' inner panels) |
| `bg-muted`, `text-muted-foreground` | subdued fills, secondary text, table headers |
| `border` (`border-border`), `border-input` | hairline separators / form controls |
| `bg-primary text-primary-foreground` | primary action (neutral, high contrast) |
| `text-brand`, `bg-brand/10`, `border-brand/25` | the **single accent**: links, active nav, branch badges, focus |
| `text-success｜danger｜warning｜info｜neutral` (+ `bg-…/10`, `border-…/25`) | **semantic status only** |
| `bg-sidebar…` | sidebar surfaces |
| `font-mono` | hashes, branches, versions, commands, code |

Rules:

- **Layout**: every page wraps its content in `<div class="page">` (max width + gutters) and starts
  with `<PageHeader>`. Section headings are `<h2 class="text-sm font-semibold">`; small labels use
  `.eyebrow`.
- **Density**: base text is `text-sm` (14 px); controls are `h-8`; tables use `py-2` rows. Use the
  4 px spacing scale: `gap-2` within groups, `gap-4` between groups, `gap-6`/`mb-6` between sections.
- **Surfaces**: separate with `border`, not shadows. Cards: `bg-card rounded-lg border p-4`.
  No gradients. Radius: `rounded-md` (small chips/buttons), `rounded-lg` (inputs, cards).
- **Colour** is never the only signal: statuses always carry a label; use `StatusBadge`.
- **Numbers that line up** (stats, counts, dates in tables) get `class="tabular"`.
- **Motion**: only short state transitions (`transition-colors`, popover/dialog enter). No decorative
  animation. `prefers-reduced-motion` is honoured globally.
- **Accessibility**: real `<a>`/`<button>` elements; every icon-only button has `aria-label`;
  decorative icons `aria-hidden="true"`; inputs have labels (use `FormField` or `sr-only` labels);
  focus rings come from the global `:focus-visible` rule — do not remove outlines. Dialogs/menus/
  popovers come from the shadcn primitives (focus trap + Escape handled). Target WCAG 2.1 AA contrast.
- **Responsive**: mobile-first; tables scroll horizontally inside `DataTable`; detail pages use
  `grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]`. The sidebar becomes a drawer below `lg`.
- **Copy**: sentence case; buttons are verbs ("Record deployment", "Delete"); errors say what
  happened and what to do; empty states say what the thing is and how to create it.
- **Theme**: `theme.toggle()` from `$lib/stores`; never read `localStorage` directly.

## State

- **Server state** → TanStack Query only. Do not copy query data into stores.
- **URL state** (filters, pagination, tabs, sort) → query string via the router helpers.
- **Local UI state** → component `$state`.
- **Global client state** → the runes stores in `$lib/stores` (`session`, `theme`, `sidebar`).
  Add a store only for state that is truly cross-cutting.

## Testing

- Unit/component tests live next to the code (`*.test.ts`, or `__tests__/` for component suites
  with fixtures). Vitest + `@testing-library/svelte` + `@testing-library/user-event`, jsdom.
- Mock the network by stubbing `fetch` (`vi.stubGlobal('fetch', vi.fn(...))`) and returning real
  `Response` objects with the documented envelopes — see `src/lib/api/client.test.ts` and
  `src/features/auth/pages/__tests__/LoginPage.test.ts`. `setup.ts` un-stubs globals after each test.
  Call `clearCsrfToken()` in `beforeEach` when a test performs mutations (the first unsafe call
  fetches `/auth/csrf`).
- Components that use `createQuery` need a `QueryClientProvider`; render them through a small
  harness component (`__tests__/fixtures/*.svelte`) that provides a fresh `createQueryClient()`.
- Popover/dropdown content is not positioned in jsdom and counts as hidden: query it by text or
  label (`getByText`, `getByLabelText`), not by role.
- Query by role/label first (`getByRole('button', { name: … })`) — it doubles as an accessibility check.
- Test behaviour that matters: validation messages, what is sent to the API, error and empty
  states, destructive-action confirmation. Do not snapshot markup.
- E2E specs go in `e2e/*.spec.ts` (Playwright, base URL `http://localhost:5173`, real backend).
  `e2e/main-flow.spec.ts` walks login → project → environments → commits → deployment → history →
  release → note → search → logout with uniquely named records and deletes its project afterwards.
  Credentials come from `E2E_EMAIL` / `E2E_PASSWORD` or `../backend/.env`. Run with
  `E2E_BROWSER_CHANNEL=chrome bun run test:e2e` to use an installed Chrome instead of downloading Chromium.

## Versions (verified at scaffold time, Nov 2026)

svelte 5.57 · vite 8.3 · @sveltejs/vite-plugin-svelte 7.3 · typescript 6.0 (pinned) ·
tailwindcss 4.3 · shadcn-svelte 1.8 (style "nova") · bits-ui 2.21 · @tanstack/svelte-query 6.4 ·
@tiptap/* 3.34 · lowlight 3.3 · zod 4.6 · @lucide/svelte 1.74 · svelte-sonner 1.2 ·
vitest 5.1 · @testing-library/svelte 5.4 · @playwright/test 1.65 · openapi-typescript 7.13.

Gotchas met while scaffolding:

- **Zod 4**: object-level `.refine()` runs even when a field already failed; `z.email()` /
  `z.uuid()` are top-level; issues are in `error.issues`.
- **TanStack Query v6 (Svelte 5)**: options are accessors, results are reactive objects.
- **Tiptap 3**: `StarterKit` already bundles Link and Underline (we disable its link/codeBlock and
  add restricted variants); table = `TableKit`; task lists come from `@tiptap/extension-list`;
  placeholder from `@tiptap/extensions`. A document containing one unknown node type is rejected
  wholesale by Tiptap — hence `sanitizeDoc`.
- **Svelte 5**: snippets declared inside a component tag become its props — declare page-level
  snippets at the top level of the markup. Use `$props.id()` for generated ids.
