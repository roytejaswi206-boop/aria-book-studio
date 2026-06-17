# ARIA Book Studio

ARIA Book Studio is a runnable local prototype of an autonomous AI book creation workspace.

This build includes:

- Professional library dashboard
- One-click **Evelyn Remembers** book automation
- Minimum 1000-chapter Autopilot generation with no hard upper limit
- Background generation jobs
- Live job polling and sticky progress bar
- Chapter generation with retries
- Resumable queued generation after server restart
- Pause, resume, and cancel controls for active jobs
- Paged chapter loading for 1000+ chapter manuscripts
- Codex/world bible generation
- Intelligence tab with AI agent scores, production readiness, memory graph, and clue trail
- Storyverse universe layer for connected franchises, spin-offs, timeline branches, and factions
- Global Research Engine with market opportunity reports, research agents, sources, and trend analysis
- Pocket FM style episode engine with scheduling and release queue architecture
- Retention simulation, cliffhanger scoring, and viral marketing factory
- Amazon KDP packaging, worldwide distribution planning, and monetization architecture
- AI Quality Governor with weak chapter detection and rewrite planning
- Recommendation engine architecture with reader profiles and vectors
- DevOps deployment ecosystem with GitHub, Vercel, Supabase, Cloudflare, backups, observability, and environment validation
- Audio package and localization planning endpoints
- Chapter editor with save/improve/copy
- Preview with print-style book formatting
- Server-side TXT, Markdown, HTML, JSON exports, browser PDF layout, and cover JPG exports
- Hidden debug panel with `CTRL + SHIFT + D`
- Command palette with `CTRL + K`
- Engineering self-healing dashboard with build, API, database, worker, queue, and deployment readiness checks
- Isolated validation runner for build, lint, type, route, database, worker, retry, and crash recovery checks
- Local JSON persistence in `data/db.json`

## Chapter Scale

New Autopilot books enforce a minimum of **1000 chapters**. You can enter a higher chapter target from the library screen. The backend does not impose an upper chapter cap, so very large books are limited by local machine speed and disk space rather than app logic.

Large books use paged chapter loading in the workspace and server-side exports so the browser does not need to hold the full manuscript during ordinary editing.

## Deployment

Copy `.env.example` to `.env` and fill provider credentials only through environment variables. Do not hardcode secrets.

```bash
docker compose up --build
```

GitHub Actions are included:

- `.github/workflows/build.yml`
- `.github/workflows/deploy.yml`
- `.github/workflows/release.yml`

Docker support is included:

- `Dockerfile`
- `docker-compose.yml`

## Start

```bash
npm run dev
```

Open:

```text
http://localhost:3001
```

## Engineering Validation

Run the production-readiness checks before deployment:

```bash
npm run build
npm run lint
npm run typecheck
npm test
```

The validation runner starts a short-lived isolated server with `ARIA_DISABLE_AUTO_RESUME=1` and a temporary validation data directory, so it does not mutate or resume real user generation jobs.

Runtime engineering APIs:

- `GET /api/engineering/dashboard`
- `POST /api/engineering/validate`
- `GET /api/engineering/upgrade-proposals`

Open the in-app engineering panel with `CTRL + SHIFT + D`.

## Notes

This version is dependency-light and uses Node's built-in HTTP server so it can run without installing packages. It does not require Supabase or an external AI key for the local automation flow.

Generated data is saved to:

```text
data/db.json
```

## Main API Routes

- `GET /api/health`
- `GET /api/books`
- `POST /api/books`
- `GET /api/books/:bookId`
- `GET /api/books/:bookId?light=1`
- `GET /api/books/:bookId/chapters?offset=0&limit=80`
- `GET /api/books/:bookId/analytics`
- `GET /api/books/:bookId/memory-graph`
- `GET /api/books/:bookId/research`
- `POST /api/books/:bookId/research`
- `GET /api/books/:bookId/kdp-package`
- `POST /api/books/:bookId/kdp-package`
- `GET /api/books/:bookId/distribution-plan`
- `POST /api/books/:bookId/distribution-plan`
- `GET /api/books/:bookId/quality-governor`
- `POST /api/books/:bookId/quality-governor`
- `GET /api/books/:bookId/recommendations`
- `GET /api/books/:bookId/monetization`
- `GET /api/workers/status`
- `GET /api/devops/status`
- `GET /api/devops/env/validate`
- `GET /api/devops/github/oauth-url`
- `POST /api/integrations/github/connect`
- `POST /api/integrations/github/disconnect`
- `GET /api/integrations/github/health`
- `GET /api/integrations/github/branches`
- `GET /api/integrations/github/commits`
- `POST /api/integrations/github/sync`
- `POST /api/integrations/github/release`
- `POST /api/integrations/vercel/connect`
- `POST /api/integrations/vercel/deploy`
- `POST /api/integrations/vercel/rollback`
- `GET /api/integrations/vercel/logs`
- `GET /api/integrations/supabase/health`
- `GET /api/integrations/supabase/schema`
- `POST /api/integrations/supabase/migrate`
- `POST /api/integrations/cloudflare/connect`
- `GET /api/integrations/cloudflare/dns`
- `POST /api/integrations/cloudflare/purge-cache`
- `GET /api/backups`
- `POST /api/backups/create`
- `POST /api/backups/restore`
- `GET /api/observability/health`
- `GET /api/engineering/dashboard`
- `POST /api/engineering/validate`
- `GET /api/engineering/upgrade-proposals`
- `GET /api/universes`
- `GET /api/universes/:universeId`
- `GET /api/books/:bookId/episodes`
- `POST /api/books/:bookId/publishing/schedule`
- `GET /api/publishing/queue`
- `GET /api/books/:bookId/retention`
- `GET /api/books/:bookId/marketing`
- `POST /api/books/:bookId/marketing`
- `POST /api/books/:bookId/audio-package`
- `POST /api/books/:bookId/localize`
- `GET /api/books/:bookId/export/txt`
- `GET /api/books/:bookId/export/md`
- `GET /api/books/:bookId/export/html`
- `GET /api/books/:bookId/export/json`
- `PUT /api/books/:bookId`
- `DELETE /api/books/:bookId`
- `POST /api/jobs/start`
- `POST /api/jobs/:jobId/pause`
- `POST /api/jobs/:jobId/resume`
- `POST /api/jobs/:jobId/cancel`
- `GET /api/jobs/:jobId/status`
- `GET /api/jobs/active/local-user`
- `GET /api/books/:bookId/chapters/status`
- `PUT /api/chapters/:chapterId`
- `GET /api/debug`
