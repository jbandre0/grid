# THE GRID — Weekly Overview Sector Spec

**Status: fully specced, architecture settled, NOT YET BUILT.** This document is the
complete build brief. It exists because the spec plus a full architecture pass were
agreed in one session and the build was handed to the next one.

Weekly Overview is the middle link in a chain: Life Goals (future sector) → **Weekly
Overview** → daily planning. It is a **live, current-week-only screen**. No history or
archive lives here — that belongs to the future *Weekly Metrics Outsourcing* sector,
which this sector feeds one-directionally.

It earns its own slot on the center dial, alongside Budget.

---

## Settled decisions (don't re-litigate these)

**Week boundary — both definitions kept as-specced, deliberately.** Week at a Glance runs
**Monday–Sunday**; Daily Metrics Log runs **Sunday–Saturday**. This mirrors the source
sheet and is intentional, not an inconsistency to clean up. **Resets fire on Sunday.**
The two grids therefore use different day orders and need separate day-index helpers —
don't unify them.

**Every metric is a plain number.** There is no boolean type and no text type. The only
per-metric config is `kind` (how a cell is entered/displayed) and `rollup` (which weekly
figure is meaningful). Yes/no metrics are `0/1`, which makes them counts — so they sum
like everything else and display as `n/7`. This is what makes the model uniform.

**Bedtime is a circular-mean problem, solved with a noon pivot.** Times are stored as
minutes from midnight. Before averaging, any time ≥ 12:00 is shifted by −24h; add 24h
back if the result is negative.

| | 11:30 PM | 12:30 AM | mean | reads as |
|---|---|---|---|---|
| Naive | 23.5 | 0.5 | 12.0 | noon — wrong |
| Pivoted | −0.5 | +0.5 | 0.0 | **midnight — correct** |

This replaces the manual 12-hour offset previously used in the life sheet. The user
enters real clock times; **what Close Week sends onward is already the true pm/am
average**, so there's no separate "real value" to re-record.

*Known limit:* a circular mean is only well-behaved when values cluster. A bedtime at
genuine noon would sit on the pivot and could flip sign. Real bedtimes never do, so the
simple pivot beats a vector-based circular mean — simpler and eyeball-verifiable.

**Total and Average are two fixed columns.** Whichever is meaningless for a row shows
`—` rather than a misleading number. Keeps grid alignment and makes it obvious at a
glance which rollup a row is about.

**Source-sheet note:** the spec says "~25 metrics" but lists **31**. Build all 31.
**`MCs` = Meaningful Conversations** (confirmed by user).

---

## Module 1 — Header
Week number, current date, editable short "weekly theme" text field (e.g. `LOOK OUTWARDS.`).

## Module 2 — Priorities (After God)
Freeform ranked list, ~5 items, editable text per rank.
**Resets blank each new week.** No carryover, no history.

## Module 3 — Week at a Glance
Grid: **Monday–Sunday** columns × rows: Obligations / Needs / Wants / Reminders /
Other (Stop-Start). Fully manual freeform text per cell.

**No calendar sync in either direction.** This is a deliberate scope cut, not a missing
feature — calendar push is a separate planned build. Mark this clearly in both UI copy
and code comments so a future session doesn't read it as an oversight.

## Module 4 — Weekly Planning Ritual Checklist
Editable list (add / remove / reorder), seeded from the 17 defaults below.

1. Update decision journal
2. Outsource daily metrics
3. Review time audit
4. Review finances
5. Review health
6. Weekly close
7. Review life goals
8. Review rulebook
9. Identify weekly theme
10. Record obligations
11. Plan calls/meetings
12. Make task list
13. Add wants
14. Assign tasks to days
15. Add obligations to calendar
16. Update action items
17. Close with a motivational speech

**Two different persistence rules, don't collapse them:**
- Edits to step *text and order* **persist forward** as the template for future weeks.
- Checkbox *completion state* **resets to unchecked** at the start of each new week.

Step 2 ("outsource daily metrics") is the step tied to the Close Week action below.

## Module 5 — Weekly Tasks + This Week's Goals
Two *separate* freeform bullet-list modules, current week only.
**Reset blank each new week.** No history, no archive.

## Module 6 — Daily Metrics Log

Each row: 7 daily entry cells (Sun–Sat), **today's cell visually distinct**, a Goal value
set at week start, plus auto-calculated Weekly Total and Weekly Average.

All metric data is placeholder/mock per Phase 0 convention until real daily logging
begins.

### The 31 metrics

| # | Metric | kind | rollup |
|---|---|---|---|
| 1 | Day Rating | scale | mean |
| 2 | Mood | scale | mean |
| 3 | Energy | scale | mean |
| 4 | Stress Level | scale | mean |
| 5 | Bedtime | clock | mean *(circular)* |
| 6 | Wake Time | clock | mean *(circular)* |
| 7 | Sleep Hrs. | hours | both |
| 8 | Scripture Min. | mins | both |
| 9 | Study Quality | scale | mean |
| 10 | Phone Time Hrs. | hours | both |
| 11 | Deep Work Hrs. | hours | both |
| 12 | Online Learning Min. | mins | both |
| 13 | Reading Min. | mins | both |
| 14 | Steps | count | both |
| 15 | Water Intake (cups) | count | both |
| 16 | Nutrition Q | scale | mean |
| 17 | Workout Hrs. | hours | both |
| 18 | Workout Intensity | scale | mean |
| 19 | Temple? | yesno | sum → `n/7` |
| 20 | Service Acts | count | both |
| 21 | Distractions (/10) | scale | mean |
| 22 | Money Spent | money | both |
| 23 | Money Earned | money | both |
| 24 | Impulse Buys | count | both |
| 25 | Impulse Cost | money | both |
| 26 | Finance Review? | yesno | sum → `n/7` |
| 27 | MCs *(Meaningful Conversations)* | count | both |
| 28 | Quality Fam Hrs. | hours | both |
| 29 | Quality Friends Hrs. | hours | both |
| 30 | %Time Spent to Plan | pct | mean |
| 31 | Reflection? | yesno | sum → `n/7` |

**`kind` semantics:** `count` integer · `yesno` 0/1 toggle · `scale` 1–10 ·
`hours` decimal hours · `mins` integer minutes · `money` currency · `pct` 0–100 ·
`clock` HH:MM stored as minutes from midnight.

### Close Week & Send to Metrics
**Manually triggered** (tied to ritual step 2) — explicitly *not* a silent background
auto-trigger like Budget's month close-out. Computes the per-metric weekly average and
writes **one summary row**, keyed by week number/date, into Weekly Metrics Outsourcing's
storage.

**One-directional cross-sector write.** Weekly Overview never reads back from Metrics
Outsourcing. Simpler than the Budget notification-bus concept — single direction, no
shared bus needed. That sector does not exist yet, so this writes into a store slice with
no reader. That is intended; **do not stub a UI for it.**

---

## Deferred — explicitly out of scope

**Do not build placeholder infrastructure for either.** Both are their own scoped
features later, same one-feature-at-a-time rule as the rest of the project.

- **Voice-to-Kaniel entry** — technically uncertain (mic access in the artifact sandbox is
  unverified). Must be tested live before committing to it, not assumed to work.
- **Calendar push (Grid → external calendar, outbound only)** — technically plausible via
  MCP (Google Calendar is a connected tool), but needs its own auth/wiring build. Do not
  fold it silently into this pass.

---

## Agreed build order (three increments, checkpoint after each)

1. **Foundation** — `weekly` store slice + week-math helpers (week number, the two
   separate day-index schemes, reset-on-Sunday), Weekly Overview unlocked on the center
   dial, screen shell, Header module, and the three freeform list modules (Priorities,
   Weekly Tasks, This Week's Goals).
2. **Week at a Glance** grid + **Ritual checklist** (with its split persistence rules).
3. **Daily Metrics Log** (31 rows × 7 days + Goal/Total/Average) + **Close Week** action
   and the cross-sector write.

## Confirmed — no longer open
The numeric/rollup model and the noon-pivot bedtime solution are **approved**. Build them
as written.

Also settled after reading the source sheet (`LIFE-2.xlsx`, Weekly Overview tab):

- **Week number derives from the Sunday boundary**, so it changes on the same tick as the
  reset rather than lagging a day like ISO's Monday rollover. Week 1 is the week containing
  Jan 1 — the sheet's own `Week: 31` for 2026-08-01 is reproducible only under this rule.
- **The Goal column is numbers only.** The sheet has comparator and clock goals
  (`<2.5`, `<3.5`, `<$10`, `00:15`), but every metric is now measured as a number, so goals
  are too. Do not build comparator parsing.
- **Week at a Glance cells: no required shape.** The sheet stacks several entries per cell
  only because that was the easiest thing to do in Google Sheets — it is a spreadsheet
  artifact, not a requirement. Use whatever structure reads and edits best.
- **This Week's Goals will eventually pull from the Life Goals sheet verbatim.** Until that
  sector exists it stays freeform, so don't over-invest in this module — the current inline
  `n/m` progress meter is a convenience, not a contract.
