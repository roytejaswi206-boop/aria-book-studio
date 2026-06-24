# ARIA Book Studio Production Deployment Report

Date: 2026-06-24

## Root Cause

- Render returned HTTP 500 on CORS preflight because the backend CORS middleware rejected `https://aria-book-studio-v2.vercel.app` when `CLIENT_ORIGIN` did not exactly match it.
- The frontend was configured correctly to use Axios, but the fallback API URL still pointed at a local backend unless `VITE_API_URL` is set in Vercel.
- Local `.env` files and dependency folders were committed previously, causing GitHub Push Protection and repository bloat.
- Vercel build instability came from an unpinned Vite 8/Rolldown toolchain and production-only install behavior risk.

## Fixes Applied

- Added production CORS middleware with explicit Vercel production origin, all `*.vercel.app` preview domains, local dev origins, allowed methods/headers, and `OPTIONS` preflight handling.
- Changed backend default port to `5000` and frontend fallback API URL to `http://localhost:5000`.
- Added `.gitignore` for `.env`, `.env.*`, dependency folders, build outputs, and logs while preserving `.env.example`.
- Added `client/.env.example`, expanded `server/.env.example`, added `client/vercel.json`, and added root `render.yaml`.
- Moved Vite build tooling into frontend dependencies and pinned to Vite 7.3.5 with patched dependency overrides.
- Upgraded server `uuid` to a patched release.
- Added an `exports` table to `schema.sql` for production export tracking.
- Removed tracked `.env`, `node_modules`, and log artifacts from Git index.

## Required Production Environment Variables

### Vercel frontend

- `VITE_API_URL=https://aria-book-studio-1.onrender.com`

### Render backend

- `PORT=5000`
- `CLIENT_ORIGIN=https://aria-book-studio-v2.vercel.app`
- `SUPABASE_URL=<your Supabase URL>`
- `SUPABASE_ANON_KEY=<your Supabase anon key>`
- `SUPABASE_SERVICE_KEY=<your Supabase service role key>`
- `ANTHROPIC_API_KEY=<required for real Claude generation>`
- `ANTHROPIC_MODEL=claude-sonnet-4-6`
- Optional: `OPENAI_API_KEY`, `GOOGLE_API_KEY`, `GEMINI_API_KEY`
- `AI_MOCK_MODE=off`

## Validation Results

- `npm install` in `client`: passed.
- `npm install` in `server`: passed.
- `npm run lint` in `client`: passed.
- `npm run build` in `client`: passed.
- `npm audit --omit=dev` in `client`: passed with 0 vulnerabilities.
- `npm audit --omit=dev` in `server`: passed with 0 vulnerabilities.
- Local backend `/health`: passed.
- Local production-origin preflight `OPTIONS /api/books`: passed with HTTP 204 and `Access-Control-Allow-Origin: https://aria-book-studio-v2.vercel.app`.
- Local create book API: passed.
- Local list books API: passed.
- Local generation start/status API: passed. With no local Anthropic key, background generation fails gracefully with `Anthropic API key missing` instead of crashing.

## Deployment Settings

### Vercel

- Framework Preset: Vite
- Root Directory: `client`
- Install Command: `npm install`
- Build Command: `npm run build`
- Output Directory: `dist`
- Environment: `VITE_API_URL=https://aria-book-studio-1.onrender.com`

### Render

- Blueprint: `render.yaml`
- Service: `aria-book-studio-api`
- Runtime: Node
- Root Directory: `server`
- Build Command: `npm install`
- Start Command: `npm start`
- Health Check Path: `/health`

## Remaining Risks

- Real chapter generation requires a valid `ANTHROPIC_API_KEY` on Render. Without it, jobs report a clear error but cannot produce chapters.
- Supabase schema must be applied with `schema.sql`; the Supabase JS client cannot create tables directly unless a SQL execution RPC exists.
- Live Render/Vercel deployment verification requires pushing this commit and waiting for both platforms to redeploy.
- The frontend bundle has one large chunk warning; it is not a blocker, but future code splitting would improve load performance.

## Production Readiness Score

82/100 after local validation. The remaining gap is live redeploy verification and real AI-key-backed generation.