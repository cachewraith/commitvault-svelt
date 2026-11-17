# CommitVault — frontend

Web client for [CommitVault](../README.md), a personal developer workspace for recording
commits, deployment history, environments, releases and technical notes.

Standalone single-page application: **Svelte 5 + TypeScript + Vite** with Tailwind CSS v4,
shadcn-svelte, TanStack Query, Tiptap and Zod. It talks to the Rust/Axum backend
(`../backend`, repository `commitvault-axum`) exclusively through the REST API under `/api/v1`.

> Engineering conventions, component inventory and worked examples live in
> [`CLAUDE.md`](./CLAUDE.md).

## Requirements

- [Bun](https://bun.sh) ≥ 1.4 (package manager and script runner)
- A running CommitVault backend on `http://localhost:3000` (see the workspace README) —
  the UI has no mock mode.

## Getting started

```bash
bun install
bun run dev          # http://localhost:5173
```

The dev server proxies `/api` to the backend, so the browser only ever talks to one origin
(cookies stay `SameSite=Strict`, no CORS involved).

| Variable | Default | Purpose |
| --- | --- | --- |
| `API_PROXY_TARGET` | `http://localhost:3000` | Where Vite's dev/preview server forwards `/api` |
| `E2E_BASE_URL` | `http://localhost:5173` | Base URL for Playwright |

These are read from the process environment by `vite.config.ts` / `playwright.config.ts`
(Bun loads a local `.env` automatically; see `.env.example`). Nothing is exposed to the browser
bundle and the frontend holds no secrets.

Sign in with the administrator account bootstrapped by the backend
(`BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD`). There is no registration.

## Scripts

| Script | What it does |
| --- | --- |
| `bun run dev` | Vite dev server with HMR on port 5173 |
| `bun run build` | Production build into `dist/` |
| `bun run preview` | Serve the production build locally (port 4173, same `/api` proxy) |
| `bun run check` | `svelte-check` for `src/` and `tsc` for the Node-side config files |
| `bun run test` | Unit and component tests (Vitest, jsdom) |
| `bun run test:watch` | Vitest in watch mode |
| `bun run test:e2e` | Playwright end-to-end tests against a running stack |
| `bun run gen:api` | Generate `src/lib/api/schema.d.ts` from `../backend/openapi.json` |

### Keeping API types in sync

The backend exports its OpenAPI document; the frontend derives its resource types from it:

```bash
# in ../backend — writes openapi.json
cargo run -- openapi > openapi.json

# in this directory
bun run gen:api
```

Commit the regenerated `schema.d.ts` together with the backend change that caused it.

### End-to-end tests

`e2e/main-flow.spec.ts` drives a real browser through the main journey — login → project →
environments → commits → deployment → history → release → note (create, autosave, read) →
search → logout — against the running stack. It uses uniquely named records and deletes its
project at the end, so it can run against a database that already has data.

```bash
docker compose -f ../docker-compose.yml up -d      # or run the backend + `bun run dev` yourself

bunx playwright install chromium                   # once — or skip it and use an installed Chrome:
E2E_BROWSER_CHANNEL=chrome bun run test:e2e
```

Sign-in details come from `E2E_EMAIL` / `E2E_PASSWORD`, falling back to the bootstrap
administrator in `../backend/.env`.

## Screens

| Area | Routes |
| --- | --- |
| Login | `/login` |
| Dashboard | `/` — totals, recent deployments / commits / notes, project activity, environment overview, 30-day deployment activity |
| Projects | `/projects`, `/projects/:id` (overview), `/projects/:id/settings` |
| Environments | `/projects/:id/environments` (manage, reorder), `/environments` (all projects) |
| Commits | `/commits` (search and filters), `/commits/:id`; quick create from the top-bar **New** menu |
| Deployments | `/deployments` (timeline), `/deployments/:id`, `/projects/:id/compare` (records of two environments side by side) |
| Releases | `/releases`, `/releases/:id` |
| Notes | `/notes`, `/notes/new`, `/notes/:id` (reading view), `/notes/:id/edit` (editor with autosave) |
| Tags | `/tags` |
| Search | `/search?q=` (also `/` or Ctrl/Cmd+K from anywhere) |
| Settings | `/settings` — password, theme, session |

List filters, sorting and pagination live in the URL, so every view can be bookmarked or shared.

## Project structure

```text
frontend/
├── index.html               SPA entry document
├── static/                  files copied verbatim to the web root (favicon, robots.txt, theme-init.js)
├── src/
│   ├── main.ts              bootstrap: router, session, mount
│   ├── App.svelte           providers, session gate, route guard, layout selection
│   ├── routes/              route table (lazy pages) and URL builders
│   ├── features/            one folder per product area: api.ts, types.ts, validation.ts, components/, pages/
│   │   ├── auth/            login, session lifecycle, password change API
│   │   ├── dashboard/  projects/  environments/  commits/  deployments/
│   │   ├── releases/  notes/  tags/  search/  settings/  errors/
│   ├── lib/
│   │   ├── api/             fetch client (CSRF, errors, envelopes), query client, query keys, generated schema
│   │   ├── components/      shared components; ui/ holds shadcn-svelte primitives
│   │   ├── layouts/         app shell (sidebar, top bar), auth layout
│   │   ├── router/          small typed History-API router
│   │   ├── stores/          session, theme, sidebar (Svelte 5 runes)
│   │   ├── types/           shared hand-written types
│   │   ├── utils/           formatting, hashing, slugs, clipboard, colour/URL guards
│   │   └── validators/      reusable Zod schemas + validateForm
│   ├── styles/              design tokens (app.css) and rich-text typography
│   └── test/                Vitest setup
├── e2e/                     Playwright specs
├── Dockerfile               `dev` (Vite) and `prod` (nginx) targets
├── nginx.conf               production static server: SPA fallback, caching, security headers
├── components.json          shadcn-svelte configuration
├── vite.config.ts           Vite + Vitest configuration
└── playwright.config.ts
```

## Architecture notes

- **Routing** — a ~200-line History-API router (`src/lib/router`): typed path patterns, lazy
  page chunks, reactive query-string helpers, link interception, auth guard. No SvelteKit.
- **Server state** — TanStack Query. All requests go through `src/lib/api/client.ts`, which
  unwraps the `{ data }` / `{ data, meta }` envelopes, attaches the CSRF token to every
  state-changing request (fetching it lazily and retrying once on `csrf_invalid`), and turns
  every failure into an `ApiError`. A `401` on a non-auth endpoint ends the local session and
  the guard redirects to `/login?next=…`.
- **Authentication** — cookie session issued by the backend (HttpOnly, `SameSite=Strict`).
  The client never sees or stores credentials or session identifiers; the CSRF token lives in
  memory only.
- **Rich text** — Tiptap, loaded as a separate chunk on first use. Documents are stored as
  Tiptap JSON. The enabled nodes, marks and attributes form an allowlist documented in
  `src/lib/components/rich-text/schema.ts` and enforced again by the backend. Links are limited
  to `http`, `https` and `mailto`; images are referenced by `http(s)` URL (no uploads).
  Read-only rendering goes through Tiptap's schema, never through raw HTML.
- **Design system** — dark-first tokens in `src/styles/app.css` (light theme available from the
  top bar and remembered in `localStorage`), self-hosted Geist / Geist Mono fonts, shadcn-svelte
  primitives, one accent colour, semantic status colours.
- **Performance** — one chunk per route, editor and syntax-highlighting grammars split out,
  debounced search, cached queries (30 s stale time), no polling.

## Docker

```bash
# development image (Vite dev server; the workspace compose file bind-mounts src/, static/, index.html)
docker build --target dev -t commitvault-frontend:dev .

# production image (unprivileged nginx on :8080)
docker build --target prod -t commitvault-frontend .
docker run --rm -p 8080:8080 commitvault-frontend
```

The production image serves only static files. It expects a reverse proxy (Traefik) in front
that terminates TLS, adds HSTS, and routes `/api` to the backend on the **same origin**; a
request for `/api/*` that reaches nginx is answered with `502` to make misrouting obvious.

`nginx.conf` provides the SPA fallback, `Cache-Control: immutable` for fingerprinted assets,
`no-cache` for `index.html`, a health endpoint at `/healthz`, and security headers:

```text
Content-Security-Policy: default-src 'self'; img-src 'self' https: data:; style-src 'self' 'unsafe-inline';
                         script-src 'self'; connect-src 'self'; font-src 'self'; object-src 'none';
                         frame-ancestors 'none'; base-uri 'self'; form-action 'self'
X-Content-Type-Options: nosniff        X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), …
Cross-Origin-Opener-Policy: same-origin
```

`style-src 'unsafe-inline'` is required by the UI primitives (positioned popovers set inline
styles); scripts are never inline. Because `img-src` allows only `https:`, images referenced
over plain `http://` in notes will not load in production.

## Quality gates

```bash
bun run check && bun run test && bun run build
```

All three must pass before a change is considered done.
