# syntax=docker/dockerfile:1

# CommitVault frontend
#   dev  — Vite dev server with HMR (used by the workspace docker-compose.yml)
#   prod — static build served by unprivileged nginx on :8080

ARG BUN_VERSION=1.4

# --- dependencies -----------------------------------------------------------
FROM oven/bun:${BUN_VERSION} AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# --- development ------------------------------------------------------------
FROM deps AS dev
ENV NODE_ENV=development
COPY . .
EXPOSE 5173
# The compose file bind-mounts ./src, ./static and ./index.html for live reload.
CMD ["bun", "--bun", "run", "dev", "--host", "0.0.0.0"]

# --- production build -------------------------------------------------------
FROM deps AS build
ENV NODE_ENV=production
COPY . .
RUN bun --bun run build

# --- production runtime -----------------------------------------------------
FROM nginxinc/nginx-unprivileged:stable-alpine AS prod
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
