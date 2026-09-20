# THE GRID — Project Tracker Sector Spec

**Status: built this session, first pass.** Project Tracker had zero data model before
this — an empty zone-view placeholder only. Everything in this document is an
**inferred, unconfirmed design** built to match the project's already-fixed
terminology (Zone L, Zone S, Zone 1, The Shelf, Active/Standby/Dormant/Archived) —
none of it was checked with the user before building, per this session's explicit
"work while I'm away" authorization. **Treat every "Settled decisions" entry below as
a proposal to review/veto, not as locked-in the way Contact Tracker's sheet-verified
decisions are** — there is no source sheet for Project Tracker to check against.

Pinned on the center dial (`key: "projects"`, glyph `◆`) — this was already true before
this session (BUILD_STATE.md's open item #12 flagged the zone screen as an empty-state
placeholder with no data model). This build fills that placeholder in; it does not
change the dial.

---

## Inferred decisions (not confirmed — flag for review)

**Zone meanings.** The project's own terminology (Zone L / Zone S / Zone 1 / The
Shelf) was fixed before this session but never defined. Read literally against
"long-term/large" vs "short-term/small" vs "the one current focus" vs "not yet
promoted":

| Zone | Reading | Rationale |
|---|---|---|
| **Zone L** | Long-term / large-scope projects | "L" most naturally reads as Long (matches "large" too — a big project usually *is* a long one here) |
| **Zone S** | Short-term / small-scope projects | Mirror of Zone L |
| **Zone 1** | The single current top-priority focus project | "1" reads as "the one thing," not a third size bucket — this is the project instructions' own suggested reading, adopted directly |
| **The Shelf** | Parked / someday ideas, not yet promoted into a zone | An idea worth capturing but not actively planned — "shelved," matches the name |

**Zone 1 is enforced as a single-occupant slot** — the one structural rule this build
adds beyond a plain tag. Moving a project into Zone 1 automatically evicts whichever
project was already there back to Zone L (never silently deleted or archived — just
relocated, with an on-screen note when it happens). This is the most literal reading
of "the single current top-priority focus project," but it's an assumption: an
alternative would have been to let Zone 1 hold several "top priority" projects and
just treat it as a fourth tag with no singularity rule. **If the intent was looser,
say so and this gets relaxed to a plain zone.**

**State meanings**, read against their plain English and this project's own use of
"nominal/attentive/agitated/critical" and "idle/listening/replying/thinking" as
parallel two-axis-style precedents elsewhere (though Project Tracker's states are a
single axis, not two independent ones like Kaniel's):

| State | Reading |
|---|---|
| **Active** | Being worked on right now |
| **Standby** | Deliberately paused, expected to resume soon (e.g. blocked on something external) |
| **Dormant** | Paused with no near-term plan to resume, but not abandoned — softer than Archived |
| **Archived** | Done, cancelled, or shelved for the record — a closing state |

**State transitions are unrestricted** — any project can move directly between any two
states via a direct selector (Active → Archived, Archived → Active/"reactivate", etc.),
with no required intermediate step or confirmation. This was the simplest, most
reversible choice; a stricter machine (e.g. requiring Standby before Dormant, or a
confirm dialog before Archive) was considered and explicitly not built, since it adds
friction for a purely personal tracker with no other consumer of the state yet. Zone
and state are fully independent — an Archived project can sit in any zone (it stays
where it was moved from) — this book-keeps history without extra fields.

**No priority field.** CLAUDE.md explicitly warns against unifying priority scales
across sectors (Daily Overview's 1–3 and Contact Tracker's 1–5 are already
deliberately distinct). Zone Tracker's zone assignment (especially Zone 1) already
carries the "how important is this" signal, so a third numeric priority scale felt
like invention rather than inference — **left out of this build**. If the user wants
one, its scale and meaning need their own decision, not a guess.

**`targetDate` is soft, not a hard deadline.** Unlike Contact Tracker's Next Contact
or Daily Overview's Homework due dates (both of which drive overdue alarms), a
project's target date is freeform and optional, with **no overdue/alarm logic wired
to it in this build** — CLAUDE.md's "red is strictly alarm-only" rule means adding red
alarm styling to a project date needs its own decision about what "overdue" even means
for an open-ended project (a slipped target isn't necessarily a crisis the way an
unpaid bill or a missed contact is). Left as a plain, uncolored field for now.

---

## Record shape

```
{ id, name, zone: "L" | "S" | "1" | "shelf", state: "Active" | "Standby" | "Dormant" | "Archived",
  notes, targetDate, createdAt, updatedAt }
```

`createdAt`/`updatedAt` are `dayKey()` strings (same format as the rest of the store),
set on add and touched on every edit — not surfaced prominently in the UI yet, but
kept from day one since a later "stalest"/"recent" sort (BUILD_STATE.md's dock-panel
open item) will want them and a field that's additive from the start is cheaper than
backfilling later.

---

## Module 1 — Zone board

Four zone clusters (Zone L, Zone S, Zone 1, The Shelf), each a dense, independently
scattered cluster of project cards — not a uniform 4-column grid (per CLAUDE.md's
density/scatter rules). Zone 1's cluster is visually distinct (larger single card,
since it's a one-occupant zone) from the other three, which hold any number of small
cards.

Each card shows: name (inline-editable), state badge (click-to-cycle through the four
states), notes (collapsed/expanded on click), target date (inline-editable), a zone
reassignment control, and remove.

Add flow: "+ add project" per zone (or a single global add that defaults to The
Shelf — adopted: a new idea usually starts unsorted, matching The Shelf's own
"someday" reading, so the global add button drops new projects there and the user
promotes them into a real zone deliberately).

Archived projects stay visible in their zone (not hidden), with the muted/dim
treatment Contact Tracker and Budget's own list already use for a "done, kept for the
record" row — no separate Archive view in this build (deferred if the list gets long
enough to want filtering).

Ships blank — no seed/mock projects, per the project's public-repo rule.

---

## Where things live

- `store.js`: `PROJECT_ZONES`, `PROJECT_STATES`, `DEFAULT_STORE.projectTracker`,
  `projectAdd()`, `projectEdit()`, `projectMoveZone()`, `projectSetState()`,
  `projectRemove()`.
- `App.jsx`: `screen === "projects"` gets its own routing branch (not folded into the
  generic `screen === "zone"` placeholder any more — `openSector` special-cases
  `key === "projects"` the same way it already does for Budget/Weekly/Contact
  Tracker). Component: `ProjectTracker` (zone board) + `ProjectCard`; own `pt-`
  prefixed CSS.

## Deferred — explicitly out of scope for this build

- Overdue/target-date alarm styling (see "targetDate is soft" above).
- A dedicated Archive view / filtering once the list is long.
- Any dashboard tile for Project Tracker counts.
- Priority field (see "No priority field" above).
- Cross-linking a project to Life Goals (only Today's Goals ↔ Life Goals is flagged
  as a future link target in BUILD_STATE.md's open items; Project Tracker isn't
  mentioned there, so no wiring was attempted here).
