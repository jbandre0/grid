# THE GRID — Life Goals Sector Spec

**Status: built this session, first pass.** Life Goals did not exist at all before
this — no spec, no slice, no screen, not on the dial. Everything in this document is
an **inferred, unconfirmed design**, built from the user's one explicit requirement
("input builds off other levels of life goals" — a cascading hierarchy) plus this
project's already-fixed terminology and patterns. **Treat every decision below as a
proposal to review/veto**, the same standing as `PROJECT_TRACKER_SPEC.md`'s decisions
— there is no source sheet or prior design for this sector to check against at all
(unlike Contact Tracker, which had `LIFE-2.xlsx` to verify against).

**Not pinned on the center dial** — per the task brief, reachable only from the All
Sectors grid, same treatment as Weekly Metrics Outsourcing and Contact Tracker. Glyph
`◎` (concentric-ring mark) — chosen because none of the marks already in use (◆ ◈ ▦ ▲
◉ ◇ ▤ ▥ ◐ ◫) were taken, and a ring-within-a-ring reads as "tiers nested inside each
other," which is literally what this sector is.

---

## Inferred decisions (not confirmed — flag for review)

**Tier structure: Life → Year → Quarter**, three tiers, each linked to the one above
via `parentId`:

| Tier | Reading | Why this grain |
|---|---|---|
| **Life** | Multi-year / identity-level themes (who you're becoming, not what you're doing this month) | The user's own phrasing ("multi-year/identity-level") |
| **Year** | A year's concrete expression of a Life theme | One tier down, one calendar-year grain |
| **Quarter** | A quarter's concrete step toward a Year goal | **Quarter was chosen over Month** — the task brief offered either. Reasoning: Weekly Overview already owns weekly goals (`weekly.goals`) and Daily Overview owns daily ones (`daily.goals`) — a Month tier here would sit only one notch above those and mostly duplicate them. Quarter leaves a clean, non-overlapping gap between "this week's goals" and "this year's goal," and matches the cadence Weekly Metrics Outsourcing already uses for its own Quarter range filter. **If the user actually wanted Month, this tier renames easily — nothing else depends on the word "Quarter."** |

A goal at Year or Quarter tier **must pick an existing parent from the tier above** —
there's no way to create a Year goal before at least one Life goal exists, or a
Quarter goal before at least one Year goal exists. This is the literal reading of
"input builds off other levels" — a lower tier's existence depends on a higher one
already being there, not just an optional label added after the fact. **This is a
real constraint, not just a suggestion in the UI** — the add control is disabled with
an explanatory message until a parent exists. If this reads as too rigid (e.g. the
user wants to jot a quarter goal before the year theme is nailed down), it's a small
change to relax.

**No Life-level goal has a parent** (`parentId: null`) — it's the root of the tree.

**Status reuses the project's Active/Standby/Dormant/Archived language** (same four
terms CLAUDE.md already fixes as generic terminology, not Project Tracker–specific) —
own `LIFE_GOAL_STATES` constant in `store.js`, kept independent from
`PROJECT_STATES` even though the values are identical, matching the project's existing
convention of per-sector controlled sets (e.g. Contact Tracker's 1–5 priority stays
its own scale even though it's conceptually similar to Daily Overview's 1–3).

**Removing a goal cascades to its descendants.** Deleting a Life goal also deletes
every Year and Quarter goal under it (and deleting a Year goal deletes its Quarter
children), rather than leaving orphaned rows pointing at a `parentId` that no longer
exists. This was chosen over orphaning because the whole point of this sector is
"a lower-level goal visibly shows which higher-level goal it rolls up to" — a
dangling reference would silently break that. **The UI warns with a confirm dialog
before a cascading delete** (same idiom as Budget's category delete and the sync
conflict dialog) so a Life goal with real children under it can't vanish by accident.

**No date fields beyond `period`.** Life goals have no period (they're open-ended by
definition). Year and Quarter goals carry a freeform `period` string (e.g. `"2026"`,
`"2026 Q3"`) rather than a real parsed date — there's no derived overdue/rollup math
planned for this sector yet, so a strict date type would add validation complexity
for no payoff right now. Freeform matches Contact Tracker's own precedent for fields
without a clear controlled shape.

---

## Record shape

```
{ id, tier: "life" | "year" | "quarter", parentId: id | null,
  title, notes, period, status, createdAt, updatedAt }
```

`parentId` is exactly the field BUILD_STATE.md's open item #8 already anticipated
("a goal record could carry a `parentId` linking it to the tier above") — this build
follows that note directly.

---

## Module 1 — Tier tree

A single cascading view, not three independent zone-style clusters (unlike Project
Tracker's Zone L/S/1/Shelf, which really are independent buckets) — Life Goals is
explicitly hierarchical, so the layout nests: each Life goal card, its Year children
indented under it, each Year's Quarter children indented further under that. A Year
or Quarter goal always shows a small "↳ rolls up to: <parent title>" tag, so the
chain is visible without having to trace indentation alone (indentation gets easy to
lose at this density).

Add flow: one add control per tier. Life goal add is always available. Year/Quarter
adds require picking an existing parent first (see above) — if none exist, the
control shows "add a Life goal first" / "add a Year goal first" instead of a blocked
input.

Each card: title (inline-editable), status (click-to-cycle, same four-state idiom as
Project Tracker), notes (collapsed/expanded, same idiom as Project Tracker), period
(Year/Quarter only), remove (confirms if it has children).

Ships blank — no seed data, per the public-repo rule.

---

## Where things live

- `store.js`: `LIFE_GOAL_TIERS`, `LIFE_GOAL_STATES`, `DEFAULT_STORE.lifeGoals`,
  `goalAdd()`, `goalEdit()`, `goalSetStatus()`, `goalRemove()` (cascading),
  `goalChildren()` (helper: direct children of a given id/tier, used to build the
  tree and to warn before a cascading delete).
- `App.jsx`: `ALL_SECTORS` gets a live entry for the sheet's own "Life Goals" name
  (glyph `◎`, `key: "lifeGoals"`, not in `PINNED_SECTORS`); `openSector` special-cases
  it to `screen === "lifeGoals"`, same pattern as Contact Tracker/Project Tracker.
  Component: `LifeGoalsBoard` (tree) + `GoalCard`; own `lg-` prefixed CSS.

## Deferred — explicitly out of scope for this build

- **Wiring to Weekly Overview's Goals or Daily Overview's Today's Goals.** BUILD_STATE
  open item #8 already flags this as a future link target; the task brief said not to
  build it unless trivial. It isn't trivial — it would mean deciding how a Quarter
  goal here "authors" a weekly/daily goal there (copy? live reference? one-directional
  like Close Week → Metrics Outsourcing?) — a real architecture decision, not a
  guess. The data shape stays compatible (`parentId` chain) for whenever that gets
  designed.
- Any dashboard tile.
- Alarm/overdue logic on `period` (no date math planned yet, see above).
- Reordering goals within a tier (list order is insertion order, same as every other
  freeform list in the project).
