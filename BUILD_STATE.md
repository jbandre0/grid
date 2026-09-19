# THE GRID — Build State

Runnable Vite + React project (`npm install && npm run dev`; `npm run test:sync` runs the
sync-engine tests). Layout: `src/App.jsx` (all UI + inline CSS), `src/store.js`
(persistence + derivations), `src/syncEngine.js` + `src/cloud.js` + `src/supabase.js`
(cloud sync), `src/mockSeed.js` (Budget placeholder data only), `src/_retiredTiles.js`
(dead reference, imported nowhere). Specs live in `docs/specs/`, the Supabase schema in
`docs/supabase/schema.sql`, tests in `tests/`, and `README.md` has a folder map.
`private/` is **gitignored on purpose** and holds the source spreadsheet
(`LIFE-2.xlsx`), the user's real 38-week metrics archive
(`the-grid-import-real-data.json`), and a bundle of the pre-reset git history — none of it
may ever be committed.

**Five sectors are live**, all with real persistence: Budget (read-only — see open items),
Weekly Overview, Weekly Metrics Outsourcing, Daily Overview, Contact Tracker. Only Budget
ships with placeholder data; everything else starts blank and is meant for real entry.
The dashboard was deliberately stripped back to tiles backed by real data, because
invented tile structure was making it impossible to design against — remaining sectors
get built structure-first rather than mocked-up first.

**Repo + hosting.** Public GitHub repo `jbandre0/grid`, `main` only, deployed by a GitHub
Actions workflow (`.github/workflows/deploy.yml`) to `https://jbandre0.github.io/grid/` on
every push to `main`. Production builds use base `/grid/` (`vite.config.js`); dev stays at
`/`. **The repo is public, so nothing personal may go in code, comments, specs, or
history** — this already bit once: the real weekly-metrics archive was seeded in
`mockSeed.js`, the repo was briefly public, and the whole history was rebuilt from scratch
(single clean commit; the old history is only in `private/grid-history-backup.bundle`).
`.claude/settings.local.json` is untracked and gitignored (local paths). Commits carry the
user's Gmail as author; they explicitly said that's fine.

## What's built and working

- **Login + PIN gate + boot sequence.** Order is: Supabase email/password login → cosmetic
  PIN → boot → dashboard. The **login is the real protection**; the PIN is explicitly a
  session ritual, not security (lock-screen copy says so). Any 4 digits work; keyboard
  entry is wired alongside the keypad. `App` (default export) is the auth wrapper;
  `GridApp` is the actual app. Sessions persist per browser (storage key `grid.auth`);
  signing out leaves local data untouched. No sign-up UI — the account was created by hand
  in the Supabase dashboard.
- **Kaniel core** — scattered particle field with a lens-flare starburst core
  (reference `03`'s burst + `07`'s scattered-dot structure, explicitly *not* `04`/`05`'s
  wireframe or `06`'s dense radial cloud, both tried and rejected). ~1500 points fill a
  soft-edged spherical volume, density biased toward center, no connecting lines at all.
  Hot white core + 8 alternating long/short rays + soft halo; each point has a slow
  per-point radial wobble on top of the breathing pulse so the field drifts.
  - **Mood** (persistent): nominal / attentive / agitated / critical. Cyan is the
    permanent base identity — red only bleeds in as a per-point intrusion, never replaces.
  - **Action state** (transient) has a distinct motion signature per state: **idle**
    baseline; **listening** contracts and stills; **replying** expands and speeds up;
    **thinking** keeps its gold tint and adds turbulence. Each reads as different from a
    single still frame.
  - Dev-only cycle buttons for both live in the topbar.
- **Instrument reticle** — 4 nested rings around Kaniel, each counter-rotating.
- **Sector ring nav** — 6 pinned sectors + one "All Sectors" arc (7 total) opening a
  searchable grid of all 35. Pinned: Project Tracker ◆, Budget ◈, Weekly Overview ▦,
  HealthFitness ▲ (locked), HabitsRoutines ◉ (locked), **Daily Overview ◐** (took Travel
  Log's slot). **Not pinned, reachable only from the All Sectors grid, by explicit
  instruction:** Weekly Metrics Outsourcing ▥ and Contact Tracker ◫ — don't add either to
  the dial without asking; all 6 slots are full. Travel Log dropped to a locked All-Sectors
  stub.
  - **Click target is now generous.** Each arc has an invisible 26px-wide stroke
    (`arc-seg-hit`) under the visible 6px line, and the label text is clickable too — both
    via one `onClick` on the shared `<g class="arc-seg-group">`. The look didn't change.
  - **Glyphs are geometric marks, never emoji** (◆ ◈ ▦ ▲ ◉ ◇ ▤ ▥ ◐ ◫). Emoji read as
    consumer-app chrome against the cockpit type and don't sit on the mono baseline.
    Locked All Sectors stubs get a neutral ▫ and the emoji is stripped from the label.
- **Docking "bookshelf" panels.** 5 tilted panels per side, evenly
  progressed: left 76/61/46/31/16°, right 74/59/44/29/14°.
  - **Expand-in-place.** Click flattens the panel to 0° and grows it where it sits
    (~280px wide, 128–168px tall with internal scroll), anchored at its own edge. The
    previous mechanic — pop toward viewer, hide, then grow a large overlay from screen
    center via a portal — was **removed entirely**; it read as "flap up, snap back, window
    appears somewhere else." Don't reintroduce a centered overlay.
  - **Any number open at once**, deliberately, so stats can be compared side by side.
    Each panel's outside-click listener must be scoped to *all* dock panels
    (`!e.target.closest(".dock-panel")`) — scoping it to the panel's own node makes
    opening panel B silently close panel A.
  - Expanded height is capped on purpose. At 220px an open panel completely covered the
    one below it in the same column, making it unclickable; 128–168px leaves enough spine
    exposed to reach.
  - Clicking empty stage closes all open panels. Overlapping neighbours is accepted.
  - **Fan cluster (left side, top 3).** Sector Feed / Recent Adds / Velocity all share
    76° with 0/18/36px offsets, stacked like books so each spine peeks out. They opt out
    of the vertical `dock-slot` via `wrap={false}` + `offset`.
  - **Hover tooltip** for the fan — a flat, un-rotated title above the hovered panel.
    It is rendered through a **portal to `document.body` at measured coordinates**, and
    must stay that way: counter-rotating a tooltip *inside* the panel's 3D perspective
    context was tried twice and both times collapsed it into a ~5px skewed sliver.
    Escaping the transform context entirely is the fix.
- **Persistent data layer** (`store.js`) — single versioned localStorage key
  `grid.store.v1`, pure functions, no React. Slices: `budget`, `weekly`, `ritual`, `daily`,
  `contactTracker`, `metricsOutsourcing`. **`loadStore()` merges defaults forward**
  (`mergeDefaults`) so adding fields/slices never wipes saved data — this is the promise
  that makes real data safe across code updates; keep every schema change additive.
  - Flags are **derived fresh from data**, not stored, so a flag clears itself when the
    condition resolves. IDs are content-stable, which is what makes a dismissal stick
    instead of re-firing; dismissals persist in `dismissedFlags`. The persisted/dismissable
    flag engine is **Budget-only**; other sectors' alarms (Homework, later Contacts) are
    live-computed booleans, same as Budget's own Overdue *tile*.
  - `touchMonth` / `touchWeek` / `touchDay` run on PIN entry (day/week reset only when the
    boundary actually changed, and only then call `saveStore`).
- **Export / import** (topbar) — full-store JSON envelope; import validates the file,
  merges forward, and confirms before replacing. Import is *replace-all*: do it before
  entering other data or export first.
- **Cloud sync (Supabase)** — public URL + publishable key in `src/supabase.js`; protection
  is Row Level Security, never key secrecy (**never commit the service_role/secret key or
  DB password**). Schema `docs/supabase/schema.sql`: `grid_store` (one row per user, no
  delete policy, server-bumped `revision`) and `grid_store_history` (daily snapshot of the
  prior copy via trigger, 30-day retention, client read-only). Signups are meant to be
  disabled in the dashboard (single user) — **never confirmed by the user.**
  - `src/syncEngine.js` is framework-free and covered by `npm run test:sync` (17 fake-cloud
    scenarios). Local-first: localStorage is the working copy; pushes are optimistic-
    concurrency updates (`… where revision = <last seen>`), debounced ~2.5s, retried with
    backoff, flushed when the tab hides, re-checked on focus/reconnect. `cloud.js` is the
    thin real adapter. Sync bookkeeping lives in `grid.sync.v1`, outside the store, so it
    never enters backups.
  - **It refuses to guess.** A non-dismissable dialog (both copies downloadable first)
    appears when: an unlinked browser and the cloud both hold real data; both sides changed;
    this browser looks *empty* while the cloud has data (cleared/corrupt storage — the
    "blank overwrites real" guard); or the cloud is older than last sync. A browser with no
    user data just adopts the cloud copy. `hasUserData()` (`store.js`) decides "real data" —
    Budget's mock placeholder deliberately doesn't count.
  - Topbar chip: synced / unsaved / saving / offline / error / choose copy (gold for
    caution, red only for error). Sign-out warns if anything hasn't reached the cloud.
  - **Verified:** engine tests; a browser run through the real Supabase client against a
    stubbed PostgREST; real-server rejection of a fake token; RLS blocks the anon key on
    both tables. **NOT verified:** an authenticated round trip against the real project —
    the author never had the user's password. First real login is the true end-to-end test.
  - No cross-device push/notify: other devices only pull on load, focus, and reconnect.
- **Weekly Overview sector** (`screen === "weekly"`, pinned, glyph **▦**)
  — feature-complete against **`docs/specs/WEEKLY_OVERVIEW_SPEC.md`**: `weekly` store slice + week
  math, Header, Priorities/Tasks/Goals, Week at a Glance (MON–SUN) + STOP/START band,
  the 17-step ritual checklist (template persists forward, completion resets weekly —
  two separate slices on purpose), and the 31-metric Daily Metrics Log with Close Week
  / Clear Grid / the one-directional write into Weekly Metrics Outsourcing.
  - **Week number derives from the Sunday boundary**, verified against the source
    sheet's own "Week: 31" for 2026-08-01 (13 cases tested incl. DST + New Year).
  - **Daily Metrics Log does not auto-reset on the Sunday boundary**, unlike every
    other module here — the real workflow is manual (Close Week → Clear Grid → set
    next week's goals), possibly well after the boundary ticks.
  - **Goal-vs-average coloring is a target-hit readout**: bright `--flare` cyan when
    the running average is at/beyond goal, red when behind. Was briefly backwards
    (scored goal ambition instead of actual performance) — corrected, worth
    remembering if this ever looks inverted again. Clock metrics (Bedtime/Wake) color
    too, on the same noon-pivoted scale the circular mean uses (`pivotMinutes`/
    `unpivotMinutes` in `store.js`) — a raw minutes-from-midnight compare reads a
    post-midnight bedtime as "earlier" than a pre-midnight one, which is backwards.
  - **Tab in the Daily Metrics Log moves down the column** (same day, next metric),
    not across the row — a custom keydown handler + ref registry.
  - **Tile-click modals show each tile's real drill-down** (`tile.detail`/`tile.headline`)
    — replaced a hardcoded fake "7-day trend · —" block.
- **Daily Overview sector** (`screen === "dailyOverview"`, pinned, glyph **◐**) — all 8
  modules built against **`docs/specs/DAILY_OVERVIEW_SPEC.md`**; `daily` slice, `touchDay()`
  blanks Header/Priorities/Tasks/Goals/Reflection at midnight. **People and Homework
  deliberately persist across days.** Fully independent of Weekly Overview's lists.
  - **Tasks** use a 1/2/3 priority selector (matches the source sheet) + done checkbox;
    display auto-sorts by priority with done pushed to the bottom (display-only — stored
    order stays insertion order). Priority scales differ by sector on purpose (Daily 1–3,
    Contact Tracker 1–5).
  - **Today's Reference** is a live, read-only view into `weekly.glance`/`stopStart` for
    today (MON–SUN index); shows an honest message on the boundary Sunday, which isn't a
    Glance column.
  - **People to Reach Out To** = an inert "synced from Contact Tracker — not wired yet"
    banner + a manual **Extras** list. The banner becomes real when Contact Tracker's
    overdue logic lands (see below). Extras' shape must eventually match Contact Tracker's
    record shape — don't treat the bare `{id,text}` as final.
  - **Homework/Deadlines**: click-to-sort columns; Due Date and Due Time share one
    combined date+time sort key; blanks always sort last in both directions; **Time
    Required sorts by parsed duration** (`parseTimeRequiredMinutes` — "30 min" < "1 hr"),
    not string order. Rows carry a `done` boolean (separate from freeform `status`) that
    suppresses the overdue alarm.
  - **Reflection**: three prompts; "Log in Learning Matrix"/"Log in Spirituality" are real
    clickable buttons that show a transient "not wired yet" message (Learning Matrix and
    Spirituality don't exist). Same honest-stub idiom as Kaniel's narration badge.
  - **Direction, not built:** Today's Goals should eventually be wired from Life Goals
    (goals authored there, pulled here via a link).
  - Styling uses its own `do-` CSS prefix (per-sector convention: `bz-`/`wk-`/`mo-`/`do-`/
    `ct-`); `wk-mod-head`/`wk-tag` are the shared exceptions.
- **Contact Tracker sector** (`screen === "contactTracker"`, **not pinned**, glyph **◫**) —
  **increments 1–2 of 4 built** per **`docs/specs/CONTACT_TRACKER_SPEC.md`**: `contactTracker`
  slice + the **Roster** table (Name, Category, Last Contact, Frequency, computed Next
  Contact, Priority 1–5, Method, Location, Notes; add/edit/remove).
  - **Next Contact is derived, never stored** (`contactNextDate`): `lastContact +
    CONTACT_INTERVAL_DAYS[frequency]`, reverse-engineered from the user's sheet.
    **Biweekly = +3d and Bimonthly = +14d — swapped from dictionary meaning, deliberately;
    don't "fix" it.** Frequency is a controlled set; Category/Method/Location/Notes are
    freeform. `contactOverdue`/`contactDueToday` exist but nothing uses them yet.
  - **Roster ships blank** — the user's 27 real contacts were deliberately NOT seeded.
  - **Next (unbuilt):** overdue/due-today sorting + alarm styling; then wire Daily
    Overview's People stub for real. **Deferred:** the sheet's "Scheduled Calls" block
    (Who/Day/Time/Status/Calendar?, 4 rows) and any dashboard tile.
- **Weekly Metrics Outsourcing sector** (`screen === "metricsOutsourcing"`, live, **not**
  pinned, glyph **▥**) — passive read-only archive + analysis toolkit for Weekly
  Overview's closed weeks. Full brief in **`docs/specs/WEEKLY_METRICS_OUTSOURCING_SPEC.md`**.
  Reuses `store.metricsOutsourcing` exactly as `closeWeek()` writes it.
  **Ships blank — no seed data in the code.** The user's 38 real historical weeks (Oct 2025
  – Jul 2026) live only in `private/the-grid-import-real-data.json`, loadable via the topbar
  **import** (keeps rows' `mock: true` tag and `seeded` marker, which drives the "real
  historical figures · not yet from a live close" label).
  - **Archive** — browsable week list, click for the full 31-metric breakdown.
  - **Trend** — one metric, auto-scaled Y-axis, range filter (2 Months / Quarter /
    6 Months / All Time — filters by actual calendar date, not point-count).
  - **Analysis** — metric-vs-metric scatter + OLS regression + r/R²/slope (with lagged
    correlation alongside), and metric-vs-time + trend line + toggleable 4-week moving
    average. Both gate on minimum data (4 weeks, 6 for lagged) with an honest message.
  - **Insights** — Kaniel badge, Streaks, Outliers (z-score), Correlations, Metric Stats.
    Every insight dismissible; dismissals persist in `metricsOutsourcing.dismissedInsights`.
  - **Kaniel narration was explicitly NOT wired** — no backend exists, and a real API key
    can't safely live in a static Vite build. Clicking the badge shows an honest
    "narration offline — needs a backend, not wired yet" message.
  - **Goal-streak and goal-hit rate read the CURRENT live goal** (`weekly.metricsGoals`),
    not a historical per-week one — `closeWeek()` never captured the goal at the time.
  - Math lives in `store.js` as pure functions; clock metrics pivot around noon before
    *any* numeric use.
- **Budget sector** (`screen === "budget"`, pinned) — five modules reading the real store:
  Capital on Hand, Assets, Owe Ledger, Net Worth Log, Category Budget. Net Worth is derived
  (`capital + assets + receivables − payables`; receivables count before collection —
  flagged assumption). **Read-only: no UI writes to the budget slice at all**, so the
  placeholder figures cannot be replaced yet (open item 2).
  - **Flag engine** — overdue ledger entries fire red `alarm`; categories past 75% fire
    gold `attentive`; past 100% fire red. Dismissible, dismissals logged. Gold vs red is
    load-bearing: gold = caution, red = genuine alarm only.
  - **Placeholder data** (`mockSeed.js`, the only seed left) — every record carries
    `mock: true`. Seeds edge cases on purpose: two overdue entries (one per direction), a
    negative In/Out month in both logs, a past-due-but-Paid row that must *not* flag,
    categories at 95% / 83% (caution) and 140% (alarm). Category **names are real**
    (user-supplied); amounts are fake; Owe Ledger people are generic "Person A/B/C". Re-seeds
    on a version bump but **bails the moment any record loses `mock: true`**.
- **Dashboard tile field** — every tile is backed by a real store (the ~26 original
  placeholder tiles were removed; archived in `_retiredTiles.js`). Now spans three sectors:
  - Budget: **Net Worth** (masked money, sparkline, the one vein line to Kaniel), **Budget
    Used** (32-tick segmented ring, threshold marks at 75/100, stays cyan until the *total*
    exceeds budget), **Overdue** (split by direction, each with pips + worst-case age),
    **Capital Flow · In / Out** (framed signed bar chart, held level — not jittered).
  - Weekly Overview: **Weekly Execution** (two independent rings, never averaged).
  - Daily Overview: **Today's Tasks** (single ring — the `execution` shape renders the Goals
    ring only when `goalsPct` is supplied) and **Today's Homework** (new `homework` shape;
    lists rows due today by real calendar date; red alarm border/glow when anything is
    past-due and not `done`, live-computed).
  - Text above the dial in normal flow (deliberately *not* inside Kaniel's absolutely-
    centered block — growing that block pushes the sector-ring labels together): the
    week's theme and Daily Overview's **"today's 1%"** line. Plus a Day-of-Week hero.
  - **Masked money** — `$•,•••.••`, reveals on hover, re-masks on leave; hover-only because
    these tiles use click to open their modal.
- **Budget Health dock panel** — real cycle-burn gauge plus a condensed meter per category.
- **Scroll.** `.stage` is the scroll container (thin cyan scrollbar); `.grid-root` stays a
  fixed viewport frame so the starfield/veil/scan/vignette/corner layers stay pinned.
- **Vein lines** — SVG threads from a tile to Kaniel's core, measured via
  `getBoundingClientRect` + `ResizeObserver`. Currently one (Net Worth).
- **Ambient greeble**, **World map** (fully mock, ~800 points, explicitly kept), **bottom
  chip row** (session, sync, status, mood, derived sector count, open-flag count as the
  precursor to the notification bus), **Kaniel insight card** (still hardcoded mock).
- **Mobile fallback** (width < 900) exists but has had far less design attention: it shows
  the tile field plus buttons instead of the dial. Because the desktop/mobile split is a
  width check, a narrow Browser pane silently switches layouts (no ring).

## Known open items (rough priority)

**Which sector to work on next is an open question, per CLAUDE.md — don't assume.** The
user said Budget entry is next ("we'll do budget later"), but confirm.

1. **Budget entry UI — none exists.** Capital on Hand editing, Owe Ledger entry, Category
   Budget quick-tap, real auto month-close-out (snapshot logs, reset category budgets, emit
   the recap flag). The fake Budget figures on the dashboard can't be replaced until this
   exists. Offered, **never answered:** make Budget start blank first (needs checking that
   tiles like `Sparkline` survive empty data — `Math.max(...[])` is a known hazard).
2. **First real authenticated sync test.** See the sync entry: never run against the real
   project. The user was offered a throwaway test user for this; not answered.
3. **Confirm Supabase signups are disabled** (site is public). Asked, not confirmed.
4. **Contact Tracker increments 3–4** — overdue sorting/alarm styling, then wire Daily
   Overview's People stub. Then Scheduled Calls and a tile if wanted.
5. **Two bugs found, not fixed** (both were filed as background-task chips; no commit
   resulted): (a) Weekly Overview shows as "not yet built" in the All Sectors grid — its
   sheet-name emoji carries a trailing U+FE0F that `EMOJI_RE` doesn't strip, so the
   `label === "Weekly Overview"` match fails (also makes the live-sector count read one
   low); fix = strip variation selectors. (b) **Enter-to-add-row in list modules
   concatenates into the current row** instead of creating one (`WeeklyList` and the copied
   `DailyRankedList`/`DailyTaskList`); the "+ add line" button works. Root cause unconfirmed.
6. **Dock panels are still 8/10 fake structure.** Only Budget Health and Life Sectors read
   real data; Sector Feed, Recent Adds, Velocity, Load, Stalest, Streaks, Uplink and
   Diagnostics are invented. Offered to strip them — **never answered.**
7. **Budget Health panel overflows** (281px of content in a 166px panel). Suggested an
   exceptions-only list — **never answered.**
8. **Topbar scrolls away** now that `.stage` scrolls, taking the back button with it — and
   it now also carries export/import/sync/sign-out. Offered sticky — **never answered.**
9. **Kaniel: no real intelligence anywhere.** The command bar, the insight badge, and the
   insight card are stubs/hardcoded ("Website redesign" doesn't exist in any data model). The
   user wants, eventually, to talk to Kaniel from their phone, have it update entries, call,
   or send notifications. That needs a real backend (Supabase functions + a push/SMS
   provider) — a genuine architecture decision, not a follow-on; Supabase is the foundation.
   Natural-language spend entry also deferred (cloud LLM would need explicit sign-off
   before financial text leaves the device).
10. **Wire cross-sector links as targets appear:** Today's Goals ← Life Goals; Reflection
    buttons → Learning Matrix / Spirituality; People ← Contact Tracker.
11. **Labels are still plain/corporate** across sectors; project direction wants cryptic
    personal lingo. Decided to do it per sector as each is built — no sector has done the
    pass yet.
12. **Mobile needs its own design pass**, not a shrunk desktop copy. Newer pieces (Daily
    Overview, Contact Tracker's 10-column table, the login screen, sync dialog, new tiles)
    were never checked at narrow width beyond incidental views.
13. **Masked figures can't be revealed on touch** (hover-only); **near-zero bars in the
    In/Out chart are nearly invisible** (JUL `+$5.30` on a ±600 scale — left truthful);
    **top ornament** (arc of dots between two "eye" shapes) built once, dropped, never
    re-added.
14. **Project Tracker has no data model at all** — no records, no Zone L/S/1/Shelf
    structures, no Active/Standby/Dormant/Archived state machine. The zone screen is an
    empty-state placeholder. User deferred it.
15. **Global notification bus** — Budget's flags are bus-compatible, but the bus itself
    (and cross-sector flags) needs its own outline-and-approval pass. Remaining life
    sectors (Life Goals, Learning Matrix, Spirituality, Health, Habits…) don't exist.

## How to verify visual work

Screenshot the rendered app and compare directly against the reference image(s) in
`/reference`. Call out specific differences before claiming something matches. Keep fix
passes to 2–3 concrete issues at a time.

Practical notes (things that cost time before):
- Any 4 digits pass the PIN gate — but the **login comes first**. To reach the signed-in
  app in a test browser without credentials, inject a fake session into `localStorage`
  key `grid.auth` (`access_token`, `refresh_token`, `expires_at` in the future, a `user`
  with `id`/`email`) and reload; `getSession` trusts an unexpired session, so the UI works
  while server calls return 401 (which also exercises the sync error state). Remove it
  afterward. Injecting a session ≠ testing real auth.
- Sector arcs: dispatch a click on `g.arc-seg-group` (index 5 = Daily Overview, last = All
  Sectors) rather than pixel-hunting; on mobile width use `.mobile-sector-btn`.
- The dev server serves the repo root, so `fetch('/private/the-grid-import-real-data.json')`
  works in dev for testing the import path with the real file.
- The desktop/mobile split is a `resize`-driven width check; a programmatic viewport change
  needs a `resize` event before the desktop layout renders.
- App state is in React memory: editing `localStorage` directly needs a reload to show.
  `loadStore` merges defaults in memory but only *saves* on a real write, so a slice can be
  absent from localStorage until something writes.
- Verify numbers against the store (`localStorage["grid.store.v1"]`), not rendered text.
  `read_page` accessibility snapshots can be stale after typing; prefer JS reads.
- Real-Supabase probes that need no login are safe (anon key); never ask for or paste the
  service_role key.
