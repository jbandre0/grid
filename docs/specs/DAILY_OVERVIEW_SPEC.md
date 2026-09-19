# THE GRID — Daily Overview Sector Spec

**Status: all 8 modules built and verified (7 increments).** This document is the build
brief, kept current as refinements land.

Daily Overview is a **live, current-day-only screen** — no history or archive, by
design. It sits downstream of Weekly Overview: Weekly Overview plans the week, Daily
Overview is where each individual day gets worked. Today's Reference reads **live**
from Weekly Overview's Week at a Glance rather than copying — if the week's plan
changes, this reflects it immediately.

It **replaces Travel Log** on the center dial (glyph `◐`). Travel Log was one of three
still-unbuilt pinned stubs (alongside HealthFitness/HabitsRoutines); it drops to the
All Sectors grid only, the same non-pinned treatment as Weekly Metrics Outsourcing.

---

## Settled decisions (don't re-litigate these)

**Fully independent from Weekly Overview's equivalents.** Priorities, Tasks, and Goals
here are separate freeform lists with no linking and no shared completion state —
Weekly Overview's Priorities/Weekly Tasks/This Week's Goals are untouched by anything
in this sector.

**Day boundary resets most modules, but two are exceptions.** `touchDay()` (`store.js`)
runs on every successful PIN entry, alongside `touchMonth`/`touchWeek`, and blanks
Header (1% Goal + theme), Priorities, Tasks, Goals, and Reflection the moment the
calendar date rolls over. **People to Reach Out To** and **Homework/Deadlines**
deliberately do **not** reset — a name you didn't reach out to yesterday, or a deadline
still days away, shouldn't vanish at midnight. This mirrors Weekly Overview's Daily
Metrics Log being the one field `touchWeek` skips, for the same reason.

**Today's Reference is read-only, and a real live link, not a copy.** It renders
`weekly.glance` for today's column (Obligations/Needs/Wants/Reminders) plus
`weekly.stopStart`, using the **same MON–SUN day-index scheme** Week at a Glance
already uses (`GLANCE_DAYS`/`glanceDates`/`todayIdx` — see `WEEKLY_OVERVIEW_SPEC.md`).
No new data is stored for this module; editing happens only in Weekly Overview's own
Week at a Glance grid.

**Cross-sector links to unbuilt sectors are visibly present but inert**, following the
same idiom already established for Kaniel's narration stub in Weekly Metrics
Outsourcing (a real, wired click handler that shows an honest "not wired yet" message
in place of the real action, rather than a silently disabled button). Applies to:
People's Contact Tracker button and Reflection's "Log in Learning Matrix"/"Log in
Spirituality" buttons. None of those three sectors exist yet.

**Built inline in `App.jsx`, matching Weekly Overview's pattern** (not a standalone
component like `MetricsOutsourcingSector`) — comparable module count and complexity,
same file organization.

---

## Module 1 — Header
Day number (derived, not stored — Nth day of the year or similar), current date,
weekday name, editable one-line "1% Goal" text field, editable daily theme text field.
Theme and 1% Goal both blank at the daily boundary.

## Module 2 — Today's Reference
Read-only pane: today's Obligations / Needs / Wants / Reminders from Weekly Overview's
Week at a Glance, plus the week's Stop/Start pair. Live-linked, not copied (see
Settled decisions). No edit affordance here — editing happens in Weekly Overview.

## Module 3 — Priorities
Freeform ranked list, blanks daily, fully independent of Weekly Overview's Priorities.

## Module 4 — Tasks
Freeform list; each item has a **1/2/3 priority** (1 = highest — matches
`LIFE-2.xlsx`'s Daily Overview sheet, where the Tasks/Priorities columns use
the same three-tier scheme, "DONE" replacing the priority once complete) and a
completion checkbox. Fully independent of Weekly Overview's Weekly Tasks — no
linking, no shared state. Blanks daily.

**Display auto-sorts** — not-done tasks by priority ascending (unset priority
sorts last among not-done), done tasks pushed to the bottom — mirroring how
the source sheet is kept sorted by hand. This is a display-only sort: the
underlying store array stays in insertion order so add/remove-by-id stays
stable across re-sorts (`App.jsx`'s `DailyTaskList`, `useMemo`'d, stable
`Array.prototype.sort`, so same-priority ties keep insertion order).

## Module 5 — Today's Goals
Freeform bullet list, blanks daily. No completion checkbox (unlike Weekly Overview's
Goals module) — pure bullet list per spec.

**Future direction, not built yet:** goals should eventually be made in the Life Goals
sector (which will hold the larger week/month scope) and pulled into this module via a
link, rather than typed fresh here each day — mirrors the Contact Tracker direction on
Module 6. Life Goals doesn't exist yet, so this stays freeform manual entry for now.
Flagged so a future session doesn't have to rediscover the intent.

## Module 6 — People to Reach Out To
**Redesigned from the original "ranked freeform list + per-entry link button" plan.**
The real intent: this list should auto-populate from Contact Tracker (whoever it flags
as due to contact today), with a manual "extras" list layered on top for names the user
wants to flag regardless of what Contact Tracker says. Contact Tracker doesn't exist
yet, so this module currently ships as two honest pieces:
- **Synced from Contact Tracker** — a visible, inert placeholder section (same idiom as
  Kaniel's narration stub) stating the sync isn't wired yet, rather than hiding the
  concept or faking data.
- **Extras** — the actually-buildable piece: a freeform ranked list of names (`daily.people`),
  **persists across days** (does not blank at the daily boundary — see Settled decisions).
  Uses the same rank-badge list UI as Priorities.

Building the real sync is blocked on Contact Tracker existing as a sector — not decided
in this session, per CLAUDE.md's "which sector is next" being an open per-session
question. Flagged here so a future session doesn't have to rediscover the dependency.

**Extras must match whatever record shape Contact Tracker ends up using**, once that
sector's data model is designed — a manually-added "extra" today and a synced contact
tomorrow should look and behave the same, not like two different kinds of entry bolted
together. Don't lock in `daily.people`'s current bare `{id, text}` shape as final; expect
to revisit it when Contact Tracker's own record shape is settled.

## Module 7 — Homework / Deadlines
Table: Time Required, Task, Class, Due Date, Due Time, Status. School-specific as-is,
no generalization to a generic "deadlines" concept. **Persists across days** — rows
stay until Status is marked done or the row is removed, same reasoning as Weekly
Overview's Daily Metrics Log being the one field `touchWeek` doesn't blank.

**Every column header is click-to-sort** (off by default — insertion order until a
header is clicked; click again to flip direction). **Due Date and Due Time share one
sort key** — clicking either sorts by the combined date+time, since sorting by
time-of-day alone across different dates isn't meaningful. Rows with no due info sort
last in *either* direction — direction only reorders the real values, blanks don't jump
to the front on a flip. Sort is display-only: the underlying store array stays in
insertion order (`App.jsx`'s `HomeworkTable`, `useMemo`'d).

**Time Required sorts by parsed duration, not string order.** A plain string sort put
"30 min" after "2 hrs" (comparing "3" vs "2" as the first character, oblivious to units).
`parseTimeRequiredMinutes` (`App.jsx`) converts "2 hrs", "30 min", "1.5 hrs 15 min", or a
bare number (assumed minutes) to total minutes before comparing; text it can't parse
returns null and sorts last, same treatment as a blank due date.

## Module 8 — Reflection
Three freeform prompts: "What did you learn?", "Where was God's hand?", "How can I
improve tomorrow?". Blanks daily. The first two prompts each have a placeholder button
("Log in Learning Matrix" / "Log in Spirituality") — real, clickable buttons, not
html-disabled, that show a transient "not wired yet, sector not built" message on click
and auto-clear after 3s, same idiom as Module 6's Contact Tracker banner and Weekly
Metrics Outsourcing's Kaniel narration stub. The third prompt has no button.

---

## Agreed build order (seven increments, checkpoint after each)

1. **Foundation** — `daily` store slice + `touchDay()` day-boundary reset, dial swap
   (Daily Overview replaces Travel Log, glyph `◐`), `screen === "dailyOverview"`
   routing shell. No visible module UI yet.
2. **Header** module.
3. **Today's Reference** module (live-link into `weekly.glance`/`weekly.stopStart`).
4. **Priorities + Tasks** modules.
5. **Today's Goals + People to Reach Out To** modules.
6. **Homework/Deadlines** table.
7. **Reflection** module.

---

## Where things live

- `store.js`: `dayKey()`, `dayOfYear()`, `touchDay()`, `DEFAULT_STORE.daily`.
- `App.jsx`: `PINNED_SECTORS` + `ALL_SECTORS` both carry `{ key: "dailyOverview", glyph:
  "◐" }`; `openSector` special-cases it to `screen === "dailyOverview"`; routed inline
  alongside the Weekly Overview block (`screen === "dailyOverview"`), not as a separate
  component.
  - Writers: `writeDaily`, `setDailyField`, `dailyListAdd`/`dailyListSet`/
    `dailyListRemove`/`dailyListToggleDone` (generic across `priorities`/`tasks`/
    `goals`/`people`), `dailyTaskSetPriority`, `homeworkAdd`/`homeworkSet`/
    `homeworkRemove`/`homeworkToggleDone`, `setReflectionField`, `onReflectionStub`.
  - Components: `DailyRankedList` (Priorities, Extras, and — via `variant="bullet"` —
    Today's Goals), `DailyTaskList` (Tasks, with the 1/2/3 priority selector and
    priority/done display sort), `HomeworkTable` (with `parseTimeRequiredMinutes`,
    `homeworkSortValue`, `homeworkCompare` for its click-to-sort headers; rows also
    carry a `done` boolean, separate from the freeform `status` text, so a finished
    assignment can suppress the overdue alarm — see below).

### Dashboard tiles (second pass, after the sector itself)

Three pieces pulled onto the main KPI screen, deliberately not all 8 modules —
Priorities/Extras/Reflection don't reduce to a dashboard-worthy number and weren't
forced into tiles (the project already backed out of inventing tile structure once).

- **Today's Tasks** — single `ArcGauge` ring (`tasksProgress(daily)`), same shape as
  Weekly Execution but with no Goals ring alongside it — Today's Goals has no
  completion checkbox, so there's nothing to average a second ring from. `execution`
  tile shape in `MicroTile` now renders the Goals ring conditionally (`t.goalsPct != null`)
  to support this single-ring case without a separate shape.
  - Detail: today's task checklist, same `tm-check-row` pattern as Weekly Execution's.
- **Today's Homework** — `homework` tile shape (new). Lists rows due today
  (`homeworkDueToday(daily, now)` — auto, from the real calendar date), alarm border/glow
  when `homeworkOverdueCount(daily, now) > 0` (past-due, not `done`). This is a
  live-computed boolean, same as Budget's own Overdue tile — **not** routed through
  Budget's `deriveFlags`/`activeFlags`/`dismissFlag`, which is Budget-specific and
  persisted-dismissal; a real cross-sector flag bus is a separate, larger piece (see
  BUILD_STATE.md's notification-bus open item).
  - Detail: every homework row (not just today's), sorted chronologically via the same
    `homeworkSortValue`/`homeworkCompare` the sector's own table uses.
- **"today's 1%" hero line** — `daily.goal1pct`, same `week-theme-line` treatment/
  placement as the weekly theme line directly above it (normal flow, not inside
  Kaniel's absolutely-centered block, for the same reasons documented at that line).
- Desktop only — mobile's dashboard reuses `dashboardTiles` (so both new tiles appear
  there too) but never rendered the weekly theme line either, so the 1% line follows
  that same precedent rather than a new mobile-specific decision.
  - `do-` prefixed CSS throughout, per the per-sector convention (see `bz-`/`wk-`/`mo-`);
    `wk-mod-head`/`wk-tag` are the two exceptions, already shared cross-sector.
