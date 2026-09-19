# THE GRID — Weekly Metrics Outsourcing Sector Spec

**Status: both builds done and verified.** This document is the brief for Build 1
(foundation) and Build 2 (analysis toolkit), kept as one record of what this sector
actually is.

Weekly Metrics Outsourcing is the passive history/archive layer for the ~31 daily
metrics tracked in Weekly Overview. It does **not** log data directly — it only
receives and displays what Weekly Overview sends via its "Close Week & Send to
Metrics" action (`closeWeek()` in `store.js`, already built in the Weekly Overview
pass). This sector is read-only, full stop.

---

## Settled decisions (don't re-litigate these)

**No new intake format.** `store.metricsOutsourcing.rows` already existed as
`closeWeek()`'s one-directional write target: `{ weekKey, weekNumber, closedAt,
values: { [metricId]: number|null } }`. Build 1 built the storage shape to match
that exactly — it did not invent a receiving format.

**Not on the center dial.** Explicit instruction: this sector lives only inside the
"All Sectors" grid (unlocked, glyph `▥`), never pinned alongside Budget/Weekly
Overview/Project Tracker.

**Two views, both read-only:**
- **Archive** — browsable list of past weeks (week number, Sun–Sat date range, a
  3-stat quick-glance: Day Rating / Sleep Hrs. / Steps). Selecting a week shows its
  full 31-metric breakdown, grouped into the same 7 bands as Weekly Overview's Daily
  Metrics Log (state / sleep / focus & growth / body / faith & discipline / finance /
  relationships & planning).
- **Trend** — one metric at a time via a grouped `<select>`, plotted as a single line
  across every archived week. Y-axis auto-fits that metric's actual data range (fixed
  1–10 scales don't generalize across 31 metrics with wildly different units). Weeks
  missing a value (never logged, or a full vacation/blank close) break the line rather
  than faking a zero.

**Clock metrics (Bedtime/Wake) pivot around noon before scaling and coloring** — same
reasoning as Weekly Overview's goal-hit coloring. A raw 0–1439-minute axis plots 23:50
and 00:05 at opposite ends even though they're 15 minutes apart, and the real seeded
dataset actually crosses that boundary week to week (bedtime swings from ~23:50 to
~01:05 across adjacent weeks). `store.js` exports `pivotMinutes`/`unpivotMinutes` for
any future chart that needs the same treatment — don't re-derive the formula.

**No seed data ships in the code — this sector starts blank.** It originally shipped
seeded with 38 real weeks (2025 Week 44 – 2026 Week 29) from the user's own
`LIFE-2.xlsx`, tagged `mock: true` because the *provenance* was fake (no in-app Close
Week produced them) even though the numbers were real. That seed was **removed when
the repo went public** — real personal metrics don't belong in a public codebase. The
archive now lives in `private/the-grid-import-real-data.json` (gitignored) and loads
through the topbar **import** button; imported rows keep their `mock: true` tag and
`metricsOutsourcing.seeded` marker, so the "real historical figures · not yet from a
live close" label still shows. Vacation/sick weeks in that file are `values: null` for
every metric (nothing guessed); blank cells stay null, not zero.

---

## Build 2 — analysis toolkit (done)

Sits on top of Build 1 without modifying it: the archived row shape and the Archive
view were never touched. All analysis operates on weekly averages only — there's no
daily granularity at this layer, and nothing here pretends otherwise.

**Analysis tab** — two modes:
- **Metric vs Metric** — scatter plot, one point per week where both metrics have a
  value, with an OLS regression line and r / R² / slope. Needs ≥4 overlapping weeks
  (`CORR_MIN_WEEKS`). The lagged correlation for the same X/Y pair renders alongside
  the same-week number for direct comparison (needs ≥6 shifted pairs — `LAG_MIN_WEEKS`
  — since the shift loses one data point and a trustworthy read needs more than that).
- **Metric vs Time** — the same single-metric-over-time chart as the Trend tab, plus a
  regression trend line, a toggleable 4-week moving average, and a plain-language
  "trending up/down ~X/week" stat.

**Insights tab:**
- **Kaniel badge** — client-side-only count of everything currently flagged (strong
  correlations |r|≥0.5, lagged correlations, active streaks, outliers). Clicking it
  does **not** call a real API — see the settled decision below.
- **Streaks** — per metric, both types tracked independently: a *goal streak*
  (consecutive most-recent weeks meeting/beating the goal) and a *trend streak*
  (consecutive most-recent weeks moving the same direction, labeled improving/
  declining against the metric's own `dir`). Only surfaced once length ≥2.
- **Outliers** — per metric, weeks whose value sits ≥2 standard deviations from that
  metric's own historical mean (z-score), listed with how far off norm.
- **Correlations** — the full same-week and lagged scan results, |r|≥0.5, in one list.
- **Metric Stats** — mean/median/stddev/min/max for a picked metric and range (reuses
  the Trend tab's 2mo/Quarter/6mo/All-Time control), plus the historical goal-hit rate
  (see below) for the same metric.
- Every row is individually dismissible; dismissals persist in
  `metricsOutsourcing.dismissedInsights` (verified to survive a reload) using stable,
  content-derived ids (`streak-goal-{id}`, `outlier-{id}-{weekKey}`, `corr-{x}-{y}`,
  `lagcorr-{x}-{y}`).

**Two decisions settled during Build 2, both forced by real constraints, not style
preferences:**
- **Kaniel narration is a stub, not a real API call.** This project has no backend
  anywhere and no existing API integration — the topbar command bar has always been a
  stub too. A real key can't safely live in a static Vite build. The badge, scan, and
  dismissal pipeline are all real and fully wired; clicking the badge shows
  `"kaniel // narration offline — needs a backend, not wired yet"` instead of
  generated text. Wiring an actual call is a separate future architecture decision,
  not something to route around quietly.
- **Goal streak and goal-hit rate compare against the CURRENT live goal**
  (`weekly.metricsGoals`), not a historical per-week goal. `closeWeek()`'s archived
  rows only ever captured the resulting average, never what the goal was that week —
  and Build 2 wasn't allowed to change that write shape. Confirmed as the intended
  reading: "how many weeks in a row currently hit the goal," using today's goal as the
  yardstick throughout history.

**Math lives in `store.js` as pure functions** (`mean`, `median`, `stddev`, `pearsonR`,
`linearRegression`, `movingAverage`, `zScore`), verified against hand-checked values
before any UI used them. Clock metrics (Bedtime/Wake) are pivoted around noon before
ANY numeric use — not just charting, but regression, correlation, z-score, and
distribution too, via `metricPlotValue`/`metricUnplotValue`. A full pairwise scan (465
same-week pairs + 930 ordered lagged pairs) runs in single-digit milliseconds against
the real 38-week dataset — no caching or debouncing needed, just kept behind
`useMemo` so it doesn't rerun on unrelated re-renders.

---

## Where things live

- `store.js`: `outsourcingRows`/`outsourcingSeries` (Build 1); `weekRangeLabel`,
  `pivotMinutes`/`unpivotMinutes`, `metricPlotValue`/`metricUnplotValue`; math
  primitives (`mean`, `median`, `stddev`, `zScore`, `pearsonR`, `linearRegression`,
  `movingAverage`); `metricPairSeries`, `laggedPairSeries`; `metricDistribution`,
  `metricGoalHitRate`, `metricGoalStreak`, `metricTrendStreak`; the global scans
  `allActiveStreaks`, `allOutliers`, `allCorrelations`, `allLaggedCorrelations`; and
  `dismissInsight`.
- No seed code for this sector (removed — see Settled decisions). Data arrives via
  `closeWeek()` or the topbar import.
- `App.jsx`: `MetricsOutsourcingSector` (screen shell + 4 tabs) → `ArchiveView`/
  `WeekDetail`/`WeekGlance` (Build 1), `TrendView`/`MetricTrendChart` (Build 1),
  `AnalysisView`/`RegressionScatterView`/`ScatterChart`/`TrendRegressionView`/
  `MetricRegressionChart` (Build 2 Analysis tab), `InsightsView`/`KanielBadge`/
  `StreaksPanel`/`OutliersPanel`/`CorrelationsPanel`/`MetricStatsCard` (Build 2
  Insights tab). Routed at `screen === "metricsOutsourcing"`, opened only from the
  All Sectors grid, never from `PINNED_SECTORS`.
