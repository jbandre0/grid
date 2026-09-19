# THE GRID — Build State

Runnable Vite + React project (`npm install && npm run dev`). Source is no longer a
single file: `App.jsx` (all UI + inline CSS), `store.js` (persistence + derivations),
`mockSeed.js` (Budget placeholder data), `_retiredTiles.js` (dead reference only,
imported nowhere).

**Budget is the first live sector** — real persistence, real derived values, a real
flag engine. Its *numbers* are placeholder; its *structure* is real. Everything else
is still Phase 0. The dashboard was deliberately stripped back to only tiles backed by
real data, because invented tile structure was making it impossible to design against
— remaining sectors get built structure-first rather than mocked-up first.

**This project is under version control**, but **`main` has not been updated since
`af77267`** — everything below from Weekly Overview onward (8 commits, through
`e367ef2`) lives on branch `weekly-overview-increment-1` and has never been merged.
Fast-forwarding is safe (`main` isn't ahead), but it hasn't been asked for, so it
hasn't happened. Prefer `git log` / `git diff` over reconstructing history from
conversation.

## What's built and working

- **PIN gate + boot sequence** — cosmetic session marker, explicitly not real security.
  Any 4 digits work; keyboard entry (digits + Enter) is wired alongside the keypad.
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
  searchable grid of all 35. Project Tracker, Budget, and Weekly Overview read as live
  (solid cyan); HealthFitness/HabitsRoutines/Travel Log stay dim/dashed. Weekly Metrics
  Outsourcing is also live but deliberately **not** pinned — reachable only from the
  All Sectors grid, per explicit instruction; don't add it to the dial without asking.
  Note: the click target is only the 6px arc stroke — the label text is not clickable.
  - **Glyphs are geometric marks, never emoji** (◆ ◈ ▦ ▲ ◉ ◇ ▤ ▥). Emoji read as
    consumer-app chrome against the cockpit type and don't sit on the mono baseline.
    The locked All Sectors stubs no longer borrow the emoji out of their spreadsheet
    names either — they get a neutral ▫ and the emoji is stripped from the label.
- **Docking "bookshelf" panels — rebuilt this session.** 5 tilted panels per side, evenly
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
  `grid.store.v1`, pure functions, no React. Holds `budget`, `weekly`, `ritual`, `daily`,
  `contactTracker`, and `metricsOutsourcing` slices. localStorage is the working copy;
  the durable copy is Supabase (see next bullet). Topbar **export/import** writes/reads a
  full-store JSON backup (validated, merge-forward, confirm-before-replace).
- **Login + cloud sync (Supabase)** — email/password login gates the app *before* the
  cosmetic PIN (`App` wrapper → `LoginScreen`; `GridApp` is the real app). Public URL +
  publishable key live in `src/supabase.js`; protection is Row Level Security, never key
  secrecy. Schema: `docs/supabase/schema.sql` (`grid_store` = one row per user, no delete
  policy, server-bumped `revision`; `grid_store_history` = daily snapshot via trigger,
  30 days). Sync is local-first: `src/syncEngine.js` (framework-free, tested by
  `npm run test:sync`) + `src/cloud.js` (adapter). Pushes are optimistic-concurrency
  updates, debounced ~2.5s; topbar chip shows synced/unsaved/saving/offline/error/choose-copy.
  **It refuses to guess** — a dialog (both copies downloadable first) appears when: an
  unlinked browser and the cloud both have real data; both sides changed; this browser
  looks empty while the cloud has data (cleared/corrupt storage); or the cloud is older
  than last sync. A fresh browser with no user data (`hasUserData()` in `store.js` —
  Budget's mock placeholder does not count) just adopts the cloud copy. Sync meta lives in
  `grid.sync.v1`, separate from the store, so it never enters backups. Signups are disabled
  in Supabase (single user). Not verified by the author against the *real* Supabase
  project as an authenticated user — the engine is covered by fake-cloud tests and a
  fake-PostgREST browser run; first real login is the true end-to-end check.
  Honest constraint still true: no cross-device push/notify (pull happens on load, focus,
  and reconnect).
  - Flags are **derived fresh from data**, not stored, so a flag clears itself when the
    condition resolves. IDs are content-stable, which is what makes a dismissal stick
    instead of re-firing; dismissals persist in `dismissedFlags`.
  - Month tracking (`touchMonth`) runs on every successful PIN entry. Full auto
    close-out is not built yet — see open items.
- **Weekly Overview sector** (`screen === "weekly"`, pinned on the dial, glyph **▦**)
  — feature-complete against **`docs/specs/WEEKLY_OVERVIEW_SPEC.md`**: `weekly` store slice + week
  math, Header, Priorities/Tasks/Goals, Week at a Glance (MON–SUN) + STOP/START band,
  the 17-step ritual checklist (template persists forward, completion resets weekly —
  two separate slices on purpose), and the 31-metric Daily Metrics Log with Close Week
  / Clear Grid / the one-directional write into Weekly Metrics Outsourcing.
  - **Week number derives from the Sunday boundary**, verified against the source
    sheet's own "Week: 31" for 2026-08-01 (13 cases tested incl. DST + New Year).
    Source sheet lives in the repo as `private/LIFE-2.xlsx` (gitignored, real personal data).
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
    not across the row — a custom keydown handler + ref registry, since entry happens
    one day at a time and native DOM tab order can't express that ordering.
  - **The main dashboard mirrors this sector's live data**: the same `WeekStateChart`
    component (not a copy) in the bottom-widgets row, the week's theme text above the
    dial (in normal flow, deliberately *not* inside Kaniel's absolutely-centered block
    — growing that block pushes the sector ring's labels closer together), a Weekly
    Execution tile (two independent rings, Tasks/Goals, never averaged into one
    number — required adding a real `done` checkbox to both lists, which had none
    before), and a standalone Day-of-Week hero separate from the small topbar clock.
  - **Tile-click modals show each tile's real drill-down** now (`tile.detail`/
    `tile.headline`) — replaced a hardcoded fake "7-day trend · —" block that used to
    render for every tile regardless of sector, budget included.
- **Weekly Metrics Outsourcing sector** (`screen === "metricsOutsourcing"`, live but
  **not** pinned on the dial — reachable only via the All Sectors grid, glyph **▥**,
  per explicit instruction) — passive read-only archive + analysis toolkit for Weekly
  Overview's closed weeks. Full brief in **`docs/specs/WEEKLY_METRICS_OUTSOURCING_SPEC.md`**.
  Reuses `store.metricsOutsourcing` exactly as `closeWeek()` already writes it — no new
  intake format. **Ships blank — there is no seed data for this sector in the code.**
  The user's 38 real historical weeks (Oct 2025 – Jul 2026, from `LIFE-2.xlsx`) were
  removed from `mockSeed.js` when the repo went public, and live only in
  `private/the-grid-import-real-data.json` (gitignored), loadable via the topbar
  **import** button. That file's rows are still `mock: true`-tagged (provenance, not
  figures — no in-app close produced them), which is what drives the "real historical
  figures · not yet from a live close" label once imported.
  - **Archive** — browsable week list, click for the full 31-metric breakdown.
  - **Trend** — one metric, auto-scaled Y-axis, range filter (2 Months / Quarter /
    6 Months / All Time — filters by actual calendar date, not point-count, so a
    vacation-week gap can't silently stretch what "2 months" means).
  - **Analysis** — Mode A (metric-vs-metric scatter + OLS regression + r/R²/slope,
    with the lagged correlation for the same pair shown alongside for comparison) and
    Mode B (metric-vs-time + regression trend line + toggleable 4-week moving average
    + a plain-language "trending up/down ~X/week" stat). Both gate on minimum data (4
    weeks, 6 for lagged) with an honest message rather than a broken chart.
  - **Insights** — a Kaniel badge (`useMemo`'d client-side count of everything
    flagged), Streaks panel (goal-streak + trend-streak, tracked independently per
    metric), Outliers panel (z-score vs. each metric's own history), Correlations
    panel, and a Metric Stats card (distribution + goal-hit rate, reusing Trend's
    range control). Every insight individually dismissible; dismissals persist in
    `metricsOutsourcing.dismissedInsights`, verified to survive a reload.
  - **Kaniel narration was explicitly NOT wired** — no backend exists anywhere in this
    project (the topbar Kaniel command bar has always been a pure stub too), and a
    real API key can't safely live in a static Vite build. The scan/badge/dismissal
    pipeline is fully real; clicking the badge shows an honest "narration offline —
    needs a backend, not wired yet" message instead of generated text. A real call is
    a separate future architecture decision — see open items.
  - **Goal-streak and goal-hit rate read the CURRENT live goal**
    (`weekly.metricsGoals`), not a historical per-week one — `closeWeek()`'s archived
    rows never captured what the goal was at the time, only the resulting average,
    and this build wasn't allowed to change that write shape. Confirmed as the
    intended reading: "how many weeks in a row currently hit the goal."
  - Math (Pearson r, OLS regression, sample stddev, z-score, moving average) lives in
    `store.js` as pure functions. Clock metrics pivot around noon before *any* numeric
    use — not just charting, but regression/correlation/z-score/distribution too. A
    full pairwise scan (465 same-week + 930 ordered lagged pairs) runs in single-digit
    milliseconds against the real 38-week dataset.
- **Budget sector** (`screen === "budget"`, reached from the Budget ring arc) — five
  modules, all reading the real store: Capital on Hand (accounts + month log), Assets,
  Owe Ledger, Net Worth Log, Category Budget. Net Worth is derived
  (`capital + assets + receivables − payables`; receivables count before collection —
  flagged assumption, revisit if a stricter version is wanted).
  - **Flag engine** — overdue ledger entries fire red `alarm`; categories past 75% fire
    gold `attentive`; past 100% fire red. Cards are dismissible, dismissals logged.
  - Gold vs red is load-bearing: gold = caution, red = genuine alarm only.
- **Budget placeholder data** (`mockSeed.js`) — every record carries `mock: true` so the
  UI can label it and so replacing a record drops the label naturally. Deliberately seeds
  edge cases, not just clean numbers: two overdue entries (one per direction), a negative
  In/Out month in *both* logs, a past-due-but-Paid row that must *not* flag, and
  categories at 95% / 83% (caution) and 140% (alarm).
  - Category **names are real** (user-supplied); amounts are fake. Owe Ledger people are
    deliberately generic ("Person A/B/C") — real names were never supplied and were not
    invented. Asset names (Stocks, Vehicle) are a guess, unconfirmed.
  - Re-seeds on a seed-version bump, but **bails the moment any record has lost its
    `mock: true`**, so it can never clobber a real figure. There is intentionally no
    bulk "clear fake data" action — replacement is manual, per sector.
- **Dashboard tile field — rebuilt, now spans two live sectors.** The ~26 original
  placeholder stat tiles were removed (archived in `_retiredTiles.js`): their
  *structure* was invented, not just their numbers. Five tiles remain, each backed by
  a real store — four from Budget, one from Weekly Overview:
  - **Net Worth** — cockpit tile, masked money with sparkline, one vein line to Kaniel.
  - **Budget Used** — segmented ring gauge, 32 radial ticks over a 280° sweep (reference
    `03` instrument idiom), with static threshold marks at 75% and 100%. The ring stays
    cyan until the *total* exceeds budget: per spec the 75% rule is per-category, so
    coloring the whole ring gold at 78% would imply a flag that doesn't exist.
  - **Overdue** — split by direction ("you owe" / "owed you"), each with pips and its own
    worst-case age in days. The merged single count was replaced because a late payable
    and a late receivable are different problems.
  - **Capital Flow · In / Out** — framed bar chart: header rule, labelled gridlines,
    emphasised zero baseline, segmented bars with an opacity ramp and bright tip caps,
    month labels, nice-rounded axis bounds. Zero sits mid-plot (unlike reference `03`'s
    all-positive bars) because In/Out is signed. Held level rather than jittered —
    gridlines read as broken when rotated.
  - **Weekly Execution** (new) — two independent rings, Tasks and Goals completion,
    reusing `ArcGauge` with a real fraction (`8/12`) in place of its default rounded
    percent. Deliberately never averaged into one number.
  - **Masked money** — renders `$•,•••.••`, reveals on hover, re-masks on leave.
    Width-preserving so tiles don't reflow. Hover-only by design: these tiles use click
    to open their modal, so click-to-reveal would fight that.
  - Clicking any tile now opens a modal with that tile's **real** drill-down content —
    see the Weekly Overview entry above for why that's newly true.
  - Also new on the dashboard, both reading live Weekly Overview data: a **Day-of-Week
    hero** above the tile field (standalone from the small topbar clock, closes a
    long-open item — see below) and the week's **theme text** above the dial.
- **Budget Health dock panel** — real cycle-burn gauge plus a condensed meter per
  category, carrying the same gold/red states as the sector.
- **Scroll — fixed.** `.grid-root` had `overflow: hidden` with no scroll container
  anywhere, silently clipping ~343px of dashboard content (bottom tiles, insight card,
  map, chip row) with no way to reach it. `.stage` is now the scroll container (thin cyan
  scrollbar); `.grid-root` stays a fixed viewport frame so the starfield/veil/scan/
  vignette/corner layers stay pinned instead of scrolling away. `min-height: 760px` was
  removed from both — it forced overflow on short viewports.
- **Vein lines** — SVG threads from a tile to Kaniel's core, measured via
  `getBoundingClientRect` + `ResizeObserver`. Currently **one** (Net Worth); the other
  three pointed at tiles that no longer exist. Source and target are measured against the
  same container, so scrolling doesn't misalign them.
- **Ambient greeble** — scan-strip dots, corner reticles, radar guide-lines, scattered
  mock coordinate text. All `pointer-events: none`.
- **World map** — hand-authored dot-matrix map (~800 points) with travel pins. Still
  fully mock; explicitly kept when the other placeholder modules were stripped.
- **Bottom chip row** — session id, sync, grid status, live mood, sector count (derived),
  and an open-flag count that is the deliberate precursor to the global notification bus.
- **Kaniel insight card** — dismissible, visually distinct, with restore link. Still
  shows a hardcoded mock suggestion (see open items).
- Mobile fallback exists and renders the same 5-tile field as desktop (Budget ×4 +
  Weekly Execution), but has had far less design attention than desktop — see open
  items, the two new sectors' denser tabs were never checked at narrow width.

## Known open items (rough priority)

Both Weekly Overview and Weekly Metrics Outsourcing are now feature-complete against
their specs. **Which sector to work on next is an open question, per CLAUDE.md — don't
assume it's the next logical one.** Everything below is the standing backlog.

1. **Dock panels are still 8/10 fake structure.** Only Budget Health and Life Sectors
   read real data; Sector Feed, Recent Adds, Velocity, Load, Stalest, Streaks, Uplink and
   Diagnostics are invented the same way the removed tiles were. Offered to strip them to
   match the tile-field cleanup — **never answered.** This is the largest remaining piece
   of fake structure on the dashboard.
2. **Budget sector increments 2–6 not built** — no entry UI at all yet. Specifically:
   editable Capital on Hand accounts, real auto month-close-out (snapshot logs, reset
   category budgets, emit the recap flag), Owe Ledger entry, and the Category Budget
   quick-tap form. Everything currently visible is seeded, not enterable.
3. **Kaniel natural-language spend entry deliberately deferred.** User chose quick-tap
   only for now. A local deterministic parser and a cloud LLM call were both offered;
   cloud was not chosen and would need explicit sign-off before financial text leaves the
   device.
4. **Budget Health panel overflows** — gauge + 7 categories is 281px of content in a
   166px panel, so it scrolls internally. Suggested making it an exceptions-only list
   (warn/over categories only, full list stays in the sector) — **never answered.**
5. **Topbar scrolls away** now that `.stage` scrolls, taking the back button with it.
   Offered to make it sticky — **never answered.**
6. **Masked figures can't be revealed on touch** (hover-only). Fails safe, but mobile has
   no reveal affordance that wouldn't collide with tap-to-open-modal.
7. **Near-zero bars are nearly invisible** in the In/Out chart (JUL is `+$5.30` against a
   ±600 scale, rendering as a hairline). Honest, but a minimum bar height or log scale
   would distort magnitude — left truthful, **unresolved.**
8. **Kaniel insight card is still hardcoded mock**, referencing a "Website redesign"
   project that doesn't exist in any data model. Last obviously-fake thing in the center
   column.
9. **Kaniel has no real API integration anywhere** — the topbar command bar and the new
   Weekly Metrics Outsourcing insight badge are both honest stubs. Wiring an actual call
   needs a backend or proxy (a static Vite build can't safely hold an API key
   client-side); this is a real architecture decision for whoever picks it up, not a
   small follow-on.
10. **Top ornament** — reference has an arc of dots between two "eye" shapes at the very
    top. Built once, dropped in a rewrite, never re-added.
11. **Labels are still plain/corporate** in most places ("Budget Used," "Overdue," "Net
    Worth," and now "Streaks," "Outliers," "Metric Stats" in the new sector too). Project
    direction wants cryptic personal lingo. Decision from an earlier session: do this
    per-sector as each is built rather than up front — but neither Weekly Overview nor
    Weekly Metrics Outsourcing actually did that pass, so it's still fully open, not
    partially done.
12. **Mobile needs its own design pass**, not a shrunk desktop copy. Weekly Overview and
    Weekly Metrics Outsourcing both got *some* responsive CSS (breakpoints, stacked
    grids) but were verified on mobile only spottily — the Weekly Metrics Outsourcing
    Analysis/Insights tabs and the 4 new dashboard elements (Day-of-Week hero, theme
    line, Weekly Execution tile, bottom-row Week State chart) were never checked on a
    narrow viewport at all.
13. **Sector ring hit target** is only the 6px arc stroke; labels aren't clickable. Fine
    when nothing was live, more annoying now that arcs actually navigate.
14. **Project Tracker has no data model at all** — no project records, no Zone L/S/1/Shelf
    structures, no Active/Standby/Dormant/Archived state machine, no neglect or auto-shelf
    rules. The zone screen is an empty-state placeholder. This blocked two requested edge
    cases earlier; user explicitly deferred it to focus on Budget.
15. **Everything else downstream** — the sync mechanism, the global notification bus
    (Budget already emits bus-compatible events, but the bus itself needs its own
    outline-and-approval pass), and the remaining life sectors.

## How to verify visual work

Screenshot the rendered app and compare directly against the reference image(s) in
`/reference`. Call out specific differences before claiming something matches. Keep fix
passes to 2–3 concrete issues at a time.

Practical notes: any 4 digits pass the PIN gate. The desktop/mobile split is driven by a
`resize` listener, so a programmatic viewport change needs a `resize` event dispatched
before the desktop layout will render. Verify numbers against the store
(`localStorage["grid.store.v1"]`) rather than trusting the rendered text.
