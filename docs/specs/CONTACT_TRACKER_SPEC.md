# THE GRID — Contact Tracker Sector Spec

**Status: foundation + Roster built (increments 1–2 of 4). Overdue sorting/alarm and
the Daily Overview sync wire-up are next.** This document is the build
brief, kept current as each increment lands.

Contact Tracker is a roster with real derived logic, not a log: each contact carries a
Last Contact date and a Frequency, and **Next Contact is computed, never typed in** —
see Settled decisions. It sits upstream of Daily Overview's "People to Reach Out To"
module, which currently shows an honest "not wired yet" placeholder for exactly this
sector (see `DAILY_OVERVIEW_SPEC.md` Module 6) — once the roster and its overdue logic
exist, that placeholder gets wired for real.

**Not pinned on the center dial** — reachable only from the All Sectors grid (glyph
`◫`), the same treatment as Weekly Metrics Outsourcing. All 6 pinned slots are
currently full; explicit decision not to bump one for this sector.

---

## Settled decisions (don't re-litigate these)

**Next Contact is derived, never stored.** `contactNextDate(contact)` in `store.js`
computes `lastContact + CONTACT_INTERVAL_DAYS[frequency]` fresh every read — same
reasoning as Daily Overview's Homework overdue count: a cached field can drift out of
sync with a hand-edited source field, a derived one can't. Returns `null` (not a guess)
when there's no `lastContact` or no recognized `frequency`.

**Frequency's interval mapping was reverse-engineered from `LIFE-2.xlsx`'s own Last
Contact/Next Contact columns**, checked against all 27 real rows, not assumed from the
dictionary meaning of the words:

| Frequency | Interval | Dictionary would say | Sheet actually means |
|---|---|---|---|
| Daily | +1d | daily | daily ✓ |
| Weekly | +7d | weekly | weekly ✓ |
| **Biweekly** | **+3d** | every 2 weeks | **~twice a week** |
| **Bimonthly** | **+14d** | every 2 months | **~twice a month (every 2 weeks)** |
| Monthly | +30d | monthly | monthly ✓ |
| Quarterly | +90d | quarterly | quarterly ✓ |

Biweekly/Bimonthly are swapped from their dictionary meaning — this is deliberate,
matches the source sheet exactly, and must not be "corrected" to the dictionary
definition. `CONTACT_INTERVAL_DAYS`/`CONTACT_FREQUENCIES` in `store.js` are the single
source of truth; Frequency is a controlled set (not freeform) because this interval
math depends on recognizing the exact value.

**Category, Method, Location, Notes are freeform text**, not fixed enums — explicit
choice over a controlled Category dropdown, matching how every other freeform field in
the project already works (Locations, Notes elsewhere) and the sheet's own loose usage
(only 3 Category values used in 27 rows, reads as an open list rather than a fixed
taxonomy).

**Priority is a 1–5 scale, not Daily Overview's 1/2/3.** Different domain, different
scale — verified against the source sheet's own Priority column, not invented. Don't
try to unify these two priority scales across sectors; they're genuinely different data.

**Roster starts blank — the real 27 contacts from `LIFE-2.xlsx` were NOT seeded.**
Explicit decision, the one place this project's "seed with real data, tag mock:true"
precedent (Weekly Metrics Outsourcing) was declined — real third-party names/
relationships, user's call to enter or not.

---

## Module 1 — Roster
Add/edit/remove contacts. Fields: Name, Category, Last Contact (date), Frequency
(controlled set, see above), Priority (1–5), Method, Location, Notes. Next Contact
renders read-only, computed live — never an input field.

## Module 2 — Overdue / due-today sorting + alarm styling
Same visual language as Daily Overview's Homework alarm state: live-computed
(`contactOverdue`/`contactDueToday` in `store.js`), red border/glow when overdue — NOT
routed through Budget's persisted/dismissable `deriveFlags`/`activeFlags`/`dismissFlag`
engine, which stays Budget-specific until the real cross-sector notification bus gets
its own approval pass (see BUILD_STATE.md open items).

## Module 3 — Wire Daily Overview's sync stub for real
"People to Reach Out To" starts pulling contacts where `contactDueToday` or
`contactOverdue` is true, replacing the inert "not wired yet" banner. The manual
"Extras" list (`daily.people`) stays layered on top exactly as already built — this
is additive, not a replacement of that list.

---

## Deferred — explicitly out of scope for now

- **Scheduled Calls sub-list** (the sheet's Who?/Day/Time/Status/Calendar? columns,
  K–O) — only 4 real rows in the source, reads as a secondary feature layered on top
  of the roster, not core to it. Revisit after the roster itself is live.
- **Dashboard tile** — no KPI-screen tile for this sector yet; revisit once the roster
  has real usage, same reasoning as not over-building Daily Overview's tile set at
  first pass.

---

## Agreed build order (4 increments, checkpoint after each)

1. **Foundation** — `contactTracker` store slice, `contactNextDate`/`contactOverdue`/
   `contactDueToday`/`CONTACT_INTERVAL_DAYS` in `store.js`, All-Sectors-grid entry
   unlocked (glyph `◫`), `screen === "contactTracker"` routing shell. No visible
   roster UI yet.
2. **Roster** module.
3. **Overdue/due-today sorting + alarm styling**.
4. **Wire Daily Overview's People sync stub for real.**

---

## Where things live

- `store.js`: `CONTACT_INTERVAL_DAYS`, `CONTACT_FREQUENCIES`, `contactNextDate()`,
  `contactOverdue()`, `contactDueToday()`, `DEFAULT_STORE.contactTracker`.
- `App.jsx`: `ALL_SECTORS` carries `{ key: "contactTracker", glyph: "◫", locked: false }`
  (not in `PINNED_SECTORS`); `openSector` special-cases it to
  `screen === "contactTracker"`; routed inline, not as a separate component (matches
  Daily Overview's file organization, not Weekly Metrics Outsourcing's).
  - Writers: `writeContactTracker`, `contactAdd`/`contactSet`/`contactRemove`.
  - Component: `ContactRoster` — dense table, own `ct-` prefixed CSS (see the
    per-sector convention note at its CSS block), reuses `do-mod`/`do-empty`/`do-x`/
    `do-add` and `wk-mod-head`/`wk-tag` since those carry no sector-specific meaning.
