# CommitVault — frontend

Web client for CommitVault, a personal workspace for recording commits, deployments,
environments, releases and technical notes.

**Stack:** Svelte 5 · TypeScript · Vite · Tailwind · shadcn-svelte · TanStack Query · Tiptap
**Backend:** [commitvault-axum](https://github.com/cachewraith/commitvault-axum)

## Run

```bash
bun install
bun run dev              # http://localhost:5173
```

Needs [Bun](https://bun.sh) and the backend running on `http://localhost:3000`. The dev
server proxies `/api` there (override with `API_PROXY_TARGET`). There is no mock mode.

Sign in with the admin account the backend creates on first start.

## Commands

```bash
bun run check            # svelte-check + TypeScript
bun run test             # unit and component tests
bun run build            # production build into dist/
bun run test:e2e         # Playwright, needs the full stack running
bun run gen:api          # regenerate API types from ../backend/openapi.json
```

For end-to-end tests, either run `bunx playwright install chromium` once or use an
installed Chrome with `E2E_BROWSER_CHANNEL=chrome bun run test:e2e`.

## Screens

Dashboard · Projects · Environments · Commits · Deployment history and environment
comparison · Releases · Notes (editor with autosave) · Tags · Search · Settings

## Layout

```
src/features/<feature>/  pages · components · api.ts · types.ts
src/lib/api/             HTTP client (CSRF, errors), generated types
src/lib/components/      shared UI, shadcn primitives in ui/
src/lib/router/          small History-API router
e2e/                     Playwright specs
```

## Docker

```bash
docker build --target prod -t commitvault-frontend .   # nginx on :8080
```

The production image serves static files only. Put a reverse proxy in front that routes
`/api` to the backend on the same origin.
