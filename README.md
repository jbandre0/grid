# THE GRID

Personal life-OS dashboard (Vite + React). Run it: `npm install && npm run dev`.

## Folder map

| Path | What it is | Uploaded to GitHub? |
|---|---|---|
| `src/` | The app: `App.jsx` (UI + CSS), `store.js` (data layer), `mockSeed.js` | yes |
| `docs/specs/` | One spec per sector (what it is, settled decisions, build order) | yes |
| `reference/` | Aesthetic reference screenshots | yes |
| `CLAUDE.md` | Standing instructions for Claude Code (must stay at the root) | yes |
| `BUILD_STATE.md` | What's built / mocked / open — read this first in a new session | yes |
| `package.json`, `index.html`, `vite.config.js` | App config | yes |
| `private/` | Source spreadsheet (`LIFE-2.xlsx`) with real personal figures | **never** (gitignored) |
| `.claude/settings.local.json` | Per-machine Claude permission list | **never** (gitignored) |
| `node_modules/`, `dist/` | Installed packages / build output | **never** (gitignored) |

Your app data is not in this folder at all — it lives in the browser's storage
(or, later, Supabase). Use the **export** button in the app's topbar for a backup file.

Anything you put in `private/` is ignored automatically, so that's the place for
files that should stay on this laptop.

## Deploying

Pushing to `main` builds and publishes the app to GitHub Pages automatically
(`.github/workflows/deploy.yml`) at `https://jbandre0.github.io/grid/`. One-time setup:
repo **Settings → Pages → Source: "GitHub Actions"**. The production build uses the
`/grid/` base path (set in `vite.config.js`); local dev is unchanged.

## Cloud login (Supabase)

The app opens on an email + password login (Supabase Auth), then the cosmetic PIN. The
Supabase URL and *publishable* key are in `src/supabase.js` — they are public by design;
Row Level Security (`docs/supabase/schema.sql`) is what protects the data. **Never commit
the `service_role`/secret key or the database password.** Sign-ups should stay disabled in
the Supabase dashboard (invite-only, single user).

