# THE GRID — Project Instructions for Claude Code

THE GRID is a personal life-OS dashboard (project tracker + budget, health, habits,
and other life sectors), with an in-app assistant named Kaniel. Currently in **Phase 0**:
a full-density visual mock with placeholder data, no real storage or data wiring yet.

## Before writing any code
- Always give a short build summary (what you're about to build, why) and wait for
  explicit approval before touching the component. Never build impromptu, even for
  small-seeming asks.
- If a structural decision isn't settled (data model, navigation, a new sector's
  layout), propose an outline first and get it approved before implementing.

## Build in small increments
- One feature/fix at a time, with a checkpoint after each. This controls cost and
  catches design mistakes early — don't skip ahead just because it seems safe.
- Some life-OS sectors (Health, Spirituality, Habits, etc.) don't have real data
  behind them yet. Treat "which sector are we building" as an open question each
  session, don't assume the next logical one.

## Visual design — the most important section
- Reference screenshots I provide are the aesthetic source of truth, overriding
  default styling instincts. If no reference exists yet for something, ask for one
  rather than guessing.
- Actively avoid generic "AI-generated" defaults: no cream/terracotta palettes, no
  black-with-one-neon-accent, no hairline-rule newspaper layouts. The baseline is a
  dark, sci-fi holographic control-panel aesthetic — dense, asymmetric, "Boeing 747
  cockpit," not a clean SaaS dashboard.
- **Density is a feature, not a problem.** Hierarchy comes from visual weight and
  placement, not from cutting stats. Small tiles by default, a couple enlarge on
  demand — never one giant box per stat.
- Vary shapes and scatter placement on purpose (slight rotation/offset jitter is
  fine) — a uniform grid of identical tiles reads as a spreadsheet, not a cockpit.
- **Red is strictly semantic/alarm only** — never decorative, never used for a
  clock or date just because it looks cool. It should intrude on the cyan base
  (veins, undertones), never replace it outright.
- Cryptic personal lingo over plain SaaS English where possible (e.g. "Zone L" not
  "Long-term Projects list").
- **Use a real screenshot-diff loop.** After any visual change, render the app,
  take a screenshot, and compare it against the reference image directly — call out
  specific pixel-level differences before declaring something done. Don't rely on
  memory of what a component "should" look like.
- Limit each fix pass to at most 2-3 concrete issues at a time. Trying to fix
  everything in one shot produces half-fixes across the board.

## Kaniel (the in-app assistant)
- Keep Kaniel scoped strictly to THE GRID's own data — reporting, navigating,
  searching, suggesting, adding/editing entries. Never expand it into a
  general-purpose assistant.
- AI suggestions must be visually distinct from logged/actual data, individually
  dismissible, and dismissals should be logged so the same suggestion doesn't repeat.
- Suggestions trigger on-demand, not as passive background calls (cost control).
- Kaniel has two independent visual state axes: **mood** (nominal / attentive /
  agitated / critical — persistent, computed from data health) and **action state**
  (idle / listening / replying / thinking — transient, tied to interaction). Don't
  conflate the two.

## Be accurate about what's actually possible
- Don't overstate technical capabilities — flag real constraints instead of
  designing around a pretend version of them.
- The PIN gate is a deliberate session-boundary ritual, not real security — never
  describe it as encryption or actual protection in UI copy or in chat.

## Sensitive sectors (budget, health, etc.)
- This data lives only in the app's own storage — never suggest routing it
  externally without explicit confirmation.
- Don't infer or generate content about my actual financial or health situation
  beyond what I've directly entered or explicitly asked to be added.

## Terminology — use consistently, don't rename or reinterpret
Zone L, Zone S, Zone 1, The Shelf, Kaniel, Active/Standby/Dormant/Archived,
nominal/attentive/agitated/critical (mood), idle/listening/replying/thinking (action).
If a new naming decision comes up, ask rather than inventing something that conflicts.

## Collaboration style
I drive the design decisions; your role is builder, verifier, and technical advisor —
surface tradeoffs and push back honestly if something's a bad idea, but don't
unilaterally redesign established architecture without flagging it first.

## Where things stand
See `BUILD_STATE.md` in this same folder for exactly what's built, what's mocked,
and what's still open. Read it before starting work in a new session.
