import { useState, useEffect, useRef, useCallback, useMemo, forwardRef } from "react";
import {
  loadStore, saveStore, touchMonth, monthKey, fmtMoney,
  capitalTotal, assetsTotal, netWorth, logInOut,
  categoryPct, categoryState, isOverdue, activeFlags, dismissFlag,
  logSpend, undoSpend, removeCategory, monthEntries, pendingCloseOut, closeOutPreview, closeOutMonth,
  cycleBurn, iOweOpen, owedToMeOpen, overdueCount, overdueSplit, netWorthSeries, inOutSeries, maskMoney,
  touchWeek, weekNumber, weekKey, goalProgress,
  GLANCE_ROWS, GLANCE_DAYS, glanceDates, ritualDone,
  METRICS, METRIC_GROUPS, METRICS_DAYS, metricsDates,
  metricTotal, metricAverage, metricGoalState, fmtMetricValue,
  minutesFromClock, clockFromMinutes, closeWeek, clearMetricsGrid,
  tasksProgress, goalsProgress,
  outsourcingRows, outsourcingSeries, weekRangeLabel, pivotMinutes, unpivotMinutes,
  mean, median, stddev, pearsonR, linearRegression, movingAverage,
  metricPlotValue, metricUnplotValue, metricPairSeries, laggedPairSeries,
  CORR_MIN_WEEKS, LAG_MIN_WEEKS, metricDistribution, metricGoalHitRate,
  metricGoalStreak, metricTrendStreak, allActiveStreaks, metricOutliers,
  allOutliers, allCorrelations, allLaggedCorrelations, dismissInsight,
  touchDay, dayKey, dayOfYear, homeworkDueToday, homeworkOverdueCount,
  CONTACT_FREQUENCIES, contactNextDate, contactOverdue, contactDueToday, contactSyncTargets,
  PROJECT_ZONES, PROJECT_STATES, projectAdd, projectEdit, projectMoveZone, projectSetState, projectRemove,
  LIFE_GOAL_TIERS, LIFE_GOAL_STATES, goalAdd, goalEdit, goalSetStatus, goalRemove, goalChildren, goalDescendants,
  exportBackup, parseBackup, normalizeStore, summarizeStore,
} from "./store.js";
import { supabase } from "./supabase.js";
import { cloud } from "./cloud.js";
import { createSyncEngine } from "./syncEngine.js";
import { createPortal } from "react-dom";

// ─────────────────────────────────────────────────────────────
// THE GRID — v2.1 · PHASE 0 (density + docking + nebula pass)
// Full-density mock cockpit for VISUAL ANALYSIS ONLY.
// Every stat/number/name on the dashboard is placeholder MOCK data,
// except the "All Sectors" list, which uses your real 34 sheet names
// (names only — no values pulled from the sheets).
// ─────────────────────────────────────────────────────────────

const CSS = `
:root {
  --void: #04060c;
  --panel: rgba(10, 18, 34, 0.36);
  --panel-solid: rgba(9, 16, 30, 0.66);
  --panel-line: rgba(79, 227, 255, 0.18);
  --holo: #4fe3ff;
  --holo-deep: #1f8fe0;
  --holo-dim: #3a6b96;
  --ghost: #cfeaff;
  --ghost-dim: #6f93b8;
  --flare: #b9f2ff;
  --violet: #7b6cff;
  --gold: #ffd166;
  --alarm: #ff5b6b;
  --alarm-deep: #d0263b;
  --alarm-dim: #7e3b44;
  --alarm-glow: rgba(255,91,107,0.35);
  --mono: ui-monospace, 'SF Mono', 'Menlo', 'Consolas', monospace;
  --sans: 'Segoe UI', system-ui, -apple-system, sans-serif;
}
* { box-sizing: border-box; }
/* fixed viewport frame — holds the pinned decorative layers (starfield, veil,
   scan, vignette, corners), which are all inset:0 against this box. It must
   NOT grow with content or those layers would stretch and scroll away; the
   scrolling happens one level in, on .stage. */
.grid-root { position: relative; width: 100%; height: 100%; min-height: 0; background: var(--void); color: var(--ghost);
  font-family: var(--sans); overflow: hidden; border: 1px solid rgba(79,227,255,0.10); }
.grid-canvas { position: absolute; inset: 0; z-index: 0; display: block; width: 100%; height: 100%; }
.grid-veil { position: absolute; inset: 0; z-index: 1; pointer-events: none;
  background: radial-gradient(120% 90% at 50% 0%, rgba(31,143,224,0.10), transparent 60%),
    radial-gradient(150% 130% at 50% 130%, rgba(4,6,12,0.85), transparent 55%); }
.grid-scan { position: absolute; inset: 0; z-index: 2; pointer-events: none;
  background: repeating-linear-gradient(0deg, rgba(79,227,255,0.022) 0px, rgba(79,227,255,0.022) 1px, transparent 2px, transparent 4px);
  mix-blend-mode: screen; opacity: 0.55; }
.grid-vignette { position: absolute; inset: 0; z-index: 2; pointer-events: none; box-shadow: inset 0 0 260px 55px rgba(0,0,0,0.85); }
.corner { position: absolute; z-index: 6; width: 24px; height: 24px; pointer-events: none; opacity: 0.5; }
.corner::before, .corner::after { content:''; position:absolute; background: var(--holo); box-shadow: 0 0 6px var(--holo); }
.corner.tl { top: 12px; left: 12px; } .corner.tr { top: 12px; right: 12px; }
.corner.bl { bottom: 12px; left: 12px; } .corner.br { bottom: 12px; right: 12px; }
.corner::before { width: 24px; height: 1px; top: 0; } .corner::after { width: 1px; height: 24px; top: 0; }
.corner.tr::before { right: 0; } .corner.tr::after { right: 0; }
.corner.bl::before { bottom: 0; top: auto; } .corner.bl::after { bottom: 0; top: auto; }
.corner.br::before { right: 0; bottom: 0; top: auto; } .corner.br::after { right: 0; bottom: 0; top: auto; }

/* the scroll container. Content taller than the viewport scrolls here rather
   than being clipped by .grid-root's overflow:hidden. */
.stage { position: relative; z-index: 5; height: 100%; min-height: 0; display: flex; flex-direction: column;
  padding: 14px clamp(12px, 2.6vw, 30px); overflow-y: auto; overflow-x: hidden; scrollbar-width: thin;
  scrollbar-color: rgba(79,227,255,0.35) transparent; }
.stage::-webkit-scrollbar { width: 8px; }
.stage::-webkit-scrollbar-track { background: transparent; }
.stage::-webkit-scrollbar-thumb { background: rgba(79,227,255,0.28); border: 2px solid transparent; background-clip: content-box; }
.stage::-webkit-scrollbar-thumb:hover { background: rgba(79,227,255,0.5); background-clip: content-box; }

.topbar { display: flex; align-items: center; justify-content: space-between;
  font-family: var(--mono); font-size: 10.5px; letter-spacing: 0.13em; color: var(--ghost-dim);
  text-transform: uppercase; padding-bottom: 8px; border-bottom: 1px solid var(--panel-line); flex-wrap: wrap; row-gap: 6px;
  /* stays put while .stage scrolls, so back / export / sync / sign-out are always reachable.
     Pulled up over the stage's 14px top padding (margin + matching sticky offset) so nothing peeks out above it. */
  position: sticky; top: -14px; z-index: 20; margin-top: -14px; padding-top: 14px; background: rgba(4,6,12,0.94); backdrop-filter: blur(4px); }
.topbar .live { color: var(--holo); }
.dot-live { display: inline-block; width: 6px; height: 6px; border-radius: 50%;
  background: var(--holo); box-shadow: 0 0 8px var(--holo); margin-right: 7px; vertical-align: middle; animation: blink 2.4s infinite; }
.tb-left, .tb-right { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.tb-back, .tb-dev { background: none; border: 1px solid var(--panel-line); color: var(--holo);
  font-family: var(--mono); font-size: 9.5px; letter-spacing: 0.1em; padding: 5px 10px; cursor: pointer;
  text-transform: uppercase; transition: all 0.18s ease; white-space: nowrap; }
.tb-back:hover, .tb-dev:hover { background: rgba(79,227,255,0.08); box-shadow: 0 0 14px rgba(79,227,255,0.25); }
.tb-backup-msg { font-family: var(--mono); font-size: 9px; letter-spacing: 0.08em; color: var(--holo-dim); text-transform: uppercase; }
.tb-dev { border-color: var(--alarm-dim); color: var(--alarm); opacity: 0.75; }
.tb-dev:hover { background: rgba(255,91,107,0.08); box-shadow: 0 0 14px var(--alarm-glow); }

/* ── LOCK ── */
.lock-wrap { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 26px; }
.lock-title { font-size: clamp(30px, 6vw, 58px); font-weight: 300; letter-spacing: 0.42em;
  text-transform: uppercase; color: var(--ghost); text-indent: 0.42em; text-shadow: 0 0 26px rgba(79,227,255,0.5); }
.lock-sub { font-family: var(--mono); font-size: 11px; letter-spacing: 0.24em; color: var(--holo-dim); text-transform: uppercase; margin-top: -14px; }
.pin-dots { display: flex; gap: 16px; margin: 4px 0 6px; }
.pin-dot { width: 13px; height: 13px; border-radius: 50%; border: 1px solid var(--holo-dim); transition: all 0.2s ease; }
.pin-dot.on { background: var(--holo); border-color: var(--holo); box-shadow: 0 0 12px var(--holo); transform: scale(1.05); }
.pin-dot.err { border-color: var(--alarm); background: var(--alarm); box-shadow: 0 0 12px var(--alarm); }
.pad { display: grid; grid-template-columns: repeat(3, 74px); gap: 12px; justify-content: center; }
.key { height: 60px; background: var(--panel-solid); backdrop-filter: blur(6px); border: 1px solid var(--panel-line);
  color: var(--ghost); font-family: var(--mono); font-size: 20px; cursor: pointer; transition: all 0.14s ease; }
.key:hover { border-color: var(--holo); color: var(--holo); box-shadow: 0 0 16px rgba(79,227,255,0.28); }
.key:active { transform: translateY(1px); background: rgba(79,227,255,0.12); }
.key.util { font-size: 11px; letter-spacing: 0.1em; color: var(--ghost-dim); }
.enter-grid { margin-top: 6px; padding: 12px 34px; background: transparent; border: 1px solid var(--holo);
  color: var(--holo); font-family: var(--mono); font-size: 12px; letter-spacing: 0.22em; text-transform: uppercase;
  cursor: pointer; transition: all 0.2s ease; opacity: 0.4; pointer-events: none; }
.enter-grid.ready { opacity: 1; pointer-events: auto; }
.enter-grid.ready:hover { background: var(--holo); color: var(--void); box-shadow: 0 0 28px rgba(79,227,255,0.6); }
.tb-sync { background: none; border: 1px solid var(--panel-line); color: var(--holo-dim); cursor: pointer; font-family: var(--mono);
  font-size: 9px; letter-spacing: 0.1em; padding: 5px 9px; text-transform: uppercase; white-space: nowrap; }
.tb-sync:hover { color: var(--holo); }
.tb-sync.synced { color: var(--holo-dim); }
.tb-sync.pending, .tb-sync.saving, .tb-sync.checking, .tb-sync.offline, .tb-sync.conflict { color: var(--gold); border-color: rgba(255,200,87,0.35); }
.tb-sync.error { color: var(--alarm); border-color: var(--alarm-dim); }
.sync-dialog { width: min(520px, 92vw); }
.sd-why { font-family: var(--mono); font-size: 10.5px; line-height: 1.6; color: var(--ghost); margin-bottom: 12px; }
.sd-cols { display: flex; gap: 10px; margin-bottom: 14px; }
.sd-col { flex: 1; display: flex; flex-direction: column; gap: 3px; padding: 9px 10px; border: 1px solid var(--panel-line); font-family: var(--mono); font-size: 9.5px; color: var(--ghost-dim); }
.sd-col b { color: var(--holo); font-weight: 400; letter-spacing: 0.12em; text-transform: uppercase; font-size: 9px; }
.sd-col i { font-style: normal; color: var(--holo-dim); }
.sd-dl { align-self: flex-start; margin-top: 4px; background: none; border: none; padding: 0; cursor: pointer; color: var(--holo-dim); font-family: var(--mono); font-size: 9px; text-decoration: underline; }
.sd-dl:hover { color: var(--holo); }
.sd-actions { display: flex; gap: 10px; }
.sd-btn { flex: 1; background: none; border: 1px solid var(--panel-line); color: var(--ghost); cursor: pointer; padding: 10px 8px; font-family: var(--mono); font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; display: flex; flex-direction: column; gap: 3px; }
.sd-btn small { color: var(--holo-dim); font-size: 8px; letter-spacing: 0.06em; }
.sd-btn:hover { border-color: var(--holo); color: var(--holo); }
.sd-btn.rec { border-color: var(--holo); }
.auth-in { width: 260px; background: rgba(9,20,36,0.6); border: 1px solid var(--panel-line); outline: none;
  color: var(--ghost); font-family: var(--mono); font-size: 13px; letter-spacing: 0.08em; padding: 11px 14px; text-align: center; }
.auth-in::placeholder { color: var(--holo-dim); opacity: 0.55; text-transform: uppercase; letter-spacing: 0.18em; font-size: 10px; }
.auth-in:focus { border-color: var(--holo); box-shadow: 0 0 16px rgba(79,227,255,0.2); }
.auth-err { font-family: var(--mono); font-size: 10px; letter-spacing: 0.12em; color: var(--alarm); text-transform: uppercase; max-width: 300px; text-align: center; }
.lock-note { font-family: var(--mono); font-size: 9.5px; letter-spacing: 0.14em; color: var(--holo-dim);
  opacity: 0.7; max-width: 340px; text-align: center; text-transform: uppercase; line-height: 1.7; }

/* ── BOOT ── */
.boot { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px;
  font-family: var(--mono); font-size: 12px; letter-spacing: 0.14em; color: var(--holo); text-transform: uppercase; }
.boot-line { opacity: 0; animation: bootIn 0.32s ease forwards; }
.boot-line .ok { color: var(--ghost-dim); }

/* ── COCKPIT SHELL ── */
.cockpit { position: relative; flex: 1; min-height: 640px; display: grid; grid-template-columns: 210px 1fr 210px; gap: 12px; }
.col { display: flex; flex-direction: column; gap: 10px; padding-top: 4px; }
.col.left, .col.right { perspective: 1500px; gap: 6px; }

/* ── DOCKING BOOKSHELF PANELS ── */
/* compact cluster tucked into the top corner; hover lights the spine and
   brightens the label; click flattens the panel and grows it in place,
   anchored at its own top corner, rather than opening a separate window.
   Any number can be open at once — each one closes independently when a
   click lands outside it (see the outside-click effect in DockPanel). The
   dock-slot reserves the collapsed footprint in the column's flow; the
   actual panel is absolutely positioned inside it so expanding never
   reflows/pushes neighboring panels, only overlaps them. */
.dock-slot { position: relative; width: 100%; height: 92px; }
.dock-panel { position: absolute; top: 0; width: 100%; min-height: 92px; background: var(--panel); backdrop-filter: blur(7px);
  border: 1px solid var(--panel-line); padding: 9px 10px 10px; transform-style: preserve-3d; cursor: pointer; overflow: hidden;
  transition: transform 0.4s cubic-bezier(.22,.85,.3,1), width 0.4s cubic-bezier(.22,.85,.3,1),
    min-height 0.4s cubic-bezier(.22,.85,.3,1), box-shadow 0.3s ease, border-color 0.25s ease;
  transform: perspective(1000px) rotateY(var(--rot, 0deg)); z-index: 1; }
.dock-panel.left { left: 0; transform-origin: left center; }
.dock-panel.right { right: 0; transform-origin: right center; }
.dock-panel:hover:not(.expanded) { border-color: var(--holo); box-shadow: 0 0 18px rgba(79,227,255,0.28); }
.dock-panel.expanded { transform: perspective(1000px) rotateY(0deg) translateZ(50px); width: min(280px, 78vw);
  min-height: 128px; max-height: 168px; overflow-y: auto; overflow-x: hidden; cursor: default; z-index: 30;
  border-color: var(--holo); box-shadow: 0 0 36px rgba(79,227,255,0.4); }
.dock-panel .nbrk { position: absolute; width: 9px; height: 9px; border: 1px solid var(--holo); opacity: 0.5; }
.dock-panel .nbrk.a { top: 5px; right: 5px; border-left: none; border-bottom: none; }
.dock-panel .nbrk.b { bottom: 5px; left: 5px; border-right: none; border-top: none; }
.dp-label { position: absolute; top: 8px; writing-mode: vertical-rl; text-orientation: mixed;
  font-family: var(--mono); font-size: 8.5px; letter-spacing: 0.14em; color: var(--holo-dim); text-transform: uppercase;
  transform: rotateY(calc(var(--rot, 0deg) * -1)); pointer-events: none; white-space: nowrap;
  transition: color 0.2s ease, text-shadow 0.2s ease; }
.dock-panel.left .dp-label { left: 6px; }
.dock-panel.right .dp-label { right: 6px; }
.dp-label.lit { color: var(--holo); text-shadow: 0 0 8px rgba(79,227,255,0.6); }
.dp-mock { font-size: 7.5px; color: var(--holo-dim); opacity: 0.5; }
.dp-hint { position: absolute; bottom: 6px; left: 0; right: 0; text-align: center; font-family: var(--mono);
  font-size: 7px; letter-spacing: 0.12em; color: var(--holo-dim); opacity: 0.35; text-transform: uppercase; pointer-events: none; }

/* fanned cluster — several panels sharing one angle, staggered so each
   spine peeks out from the one before it, bookshelf-style. Same footprint
   as a single dock-slot; panels inside skip their own slot (wrap=false)
   and position via an offset instead. */
.dock-fan { position: relative; width: 100%; height: 92px; }

/* flat, un-rotated hover tooltip — a steep shared fan angle foreshortens
   each panel's own rotated label past legibility, so this surfaces the
   plain title above the panel instead. Portaled to document.body and
   positioned via a measured getBoundingClientRect (see DockPanel's
   onMouseEnter) rather than a nested counter-rotation: a counter-rotating
   child inside a preserve-3d parent did not cancel cleanly at steep angles
   (collapsed to a near-zero-width sliver) even with matched transform
   pivots — likely a browser quirk in how nested 3D contexts flatten.
   Portaling sidesteps the 3D math entirely. */
.dp-tooltip { position: fixed; z-index: 55; pointer-events: none; background: var(--panel-solid);
  border: 1px solid var(--holo); color: var(--holo); font-family: var(--mono); font-size: 9px;
  letter-spacing: 0.12em; text-transform: uppercase; padding: 4px 9px; white-space: nowrap;
  box-shadow: 0 0 14px rgba(79,227,255,0.35); animation: dp-tooltip-fade 0.15s ease; }
@keyframes dp-tooltip-fade { from { opacity: 0; } to { opacity: 1; } }

/* dock panel expanded content — replaces the vertical spine label once flat */
.dp-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 10px;
  border-bottom: 1px solid var(--panel-line); padding-bottom: 6px; }
.dp-title { font-family: var(--mono); font-size: 10px; letter-spacing: 0.16em; color: var(--holo); text-transform: uppercase; }

/* dense stat chips (used inside dock panels) */
.chip-field { display: flex; flex-wrap: wrap; gap: 5px; }
.stat-chip { flex: 1 1 44%; background: rgba(4,8,16,0.4); border: 1px solid var(--panel-line); padding: 5px 6px; font-family: var(--mono); }
.stat-chip.alarm { border-color: var(--alarm-dim); }
.sc-val { font-size: 13px; color: var(--holo); line-height: 1; }
.stat-chip.alarm .sc-val { color: var(--alarm); text-shadow: 0 0 8px var(--alarm-glow); }
.sc-lab { font-size: 7px; letter-spacing: 0.06em; color: var(--ghost-dim); text-transform: uppercase; margin-top: 3px; }

.rank-list { display: flex; flex-direction: column; gap: 4px; }
.rank-row { display: flex; align-items: center; justify-content: space-between; gap: 6px;
  font-family: var(--mono); font-size: 9px; text-transform: uppercase; color: var(--ghost-dim);
  border-bottom: 1px dashed rgba(79,227,255,0.12); padding-bottom: 3px; }
.rank-row .rr-n { color: var(--holo-dim); width: 12px; }
.rank-row .rr-name { flex: 1; color: var(--ghost); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rank-row .rr-val { color: var(--alarm); }
.rank-row.ok .rr-val { color: var(--holo); }

/* ── MICRO TILE FIELD (density) ── */
.scan-strip { display: flex; justify-content: center; gap: 4px; padding: 5px 0 2px; pointer-events: none; opacity: 0.5; }
.scan-strip i { width: 4px; height: 7px; background: var(--holo-dim); display: block; }
.scan-strip i.on { background: var(--holo); box-shadow: 0 0 5px var(--holo); }
.tile-field { display: flex; flex-wrap: wrap; gap: 6px; width: 100%; max-width: 620px; justify-content: center; }
.mtile { position: relative; background: var(--panel); border: 1px solid var(--panel-line); cursor: pointer;
  transition: all 0.15s ease; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; }
.mtile:hover { border-color: var(--holo); box-shadow: 0 0 14px rgba(79,227,255,0.22); transform: translateY(-1px); }
.mtile.alarm { border-color: var(--alarm-dim); }
.mtile.alarm:hover { border-color: var(--alarm); box-shadow: 0 0 14px var(--alarm-glow); }
.mtile.sm { width: 66px; height: 58px; padding: 5px 3px; }
.mtile.lg { width: 108px; height: 78px; padding: 7px 6px; }
.mtile.wide { width: 132px; height: 46px; padding: 5px 10px; flex-direction: row; justify-content: space-between; gap: 8px; }
.mtile.tall { width: 50px; height: 92px; padding: 8px 4px; justify-content: flex-end; }
.mtile.arcshape { width: 78px; height: 78px; border-radius: 50%; padding: 4px; }
.mt-val { font-family: var(--mono); font-weight: 300; color: var(--holo); line-height: 1; }
.mtile.sm .mt-val { font-size: 15px; }
.mtile.lg .mt-val { font-size: 22px; }
.mtile.wide .mt-val { font-size: 16px; }
.mtile.tall .mt-val { font-size: 13px; }
.mtile.alarm .mt-val { color: var(--alarm); text-shadow: 0 0 8px var(--alarm-glow); }
.mt-lab { font-family: var(--mono); font-size: 6.2px; letter-spacing: 0.05em; color: var(--ghost-dim); text-transform: uppercase; margin-top: 2px; line-height: 1.2; }
.mtile.lg .mt-lab { font-size: 7px; }
.mtile.wide .mt-lab { margin-top: 0; text-align: right; }
.mt-bar-wrap { width: 80%; height: 4px; background: rgba(79,227,255,0.12); margin-top: 4px; }
.mt-bar-fill { height: 100%; background: var(--holo); }
.mtile.alarm .mt-bar-fill { background: var(--alarm); }
.mt-vbar-wrap { width: 10px; height: 52px; background: rgba(79,227,255,0.12); margin-bottom: 6px; display: flex; align-items: flex-end; }
.mt-vbar-fill { width: 100%; background: var(--holo); }
.mtile.alarm .mt-vbar-fill { background: var(--alarm); }
/* cockpit-style tile prototype — chamfered panel, corner brackets, sub-readout */
.mtile.hud { background: linear-gradient(135deg, rgba(12,24,44,0.5), rgba(6,11,22,0.32));
  border: 1px solid var(--panel-line);
  clip-path: polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px); }
.mtile.hud::before, .mtile.hud::after { content: ""; position: absolute; width: 8px; height: 8px; pointer-events: none; opacity: 0.8; }
.mtile.hud::before { top: 0; right: 0; border-top: 1px solid var(--holo); border-right: 1px solid var(--holo); }
.mtile.hud::after { bottom: 0; left: 0; border-bottom: 1px solid var(--holo); border-left: 1px solid var(--holo); }
.mtile.hud.alarm::before, .mtile.hud.alarm::after { border-color: var(--alarm); }
.mt-subrow { font-family: var(--mono); font-size: 6px; letter-spacing: 0.05em; color: var(--holo-dim); text-transform: uppercase; margin-top: 3px; opacity: 0.85; }
.mtile.hud.alarm .mt-subrow { color: var(--alarm-dim); }
.mt-ticks { display: flex; gap: 2px; margin-top: 4px; }
/* segmented ring gauge — discrete ticks + static threshold marks */
.mtile.ring { width: 98px; height: 116px; padding: 5px 4px 6px; gap: 1px; }
.ring-val { font-family: var(--mono); font-size: 19px; font-weight: 300; }
.ring-pct { font-family: var(--mono); font-size: 6.5px; fill: var(--holo-dim); letter-spacing: 0.1em; }

/* overdue, split by direction — a late payable and a late receivable are
   different problems, so they get their own row, pips and worst-case age */
.mtile.overdue { width: 156px; height: 68px; padding: 6px 8px 5px; justify-content: flex-start; align-items: stretch; gap: 4px; }
.mtile.overdue .mt-lab { text-align: left; margin-top: 0; }
.ovd-row { display: flex; align-items: center; gap: 6px; font-family: var(--mono); font-size: 6.6px;
  letter-spacing: 0.06em; text-transform: uppercase; color: var(--ghost-dim); }
.ovd-dir { flex: 1; white-space: nowrap; }
.ovd-row.hot .ovd-dir { color: var(--ghost); }
.ovd-pips { display: flex; gap: 1.5px; }
.ovd-pips i { width: 4px; height: 8px; background: rgba(79,227,255,0.13); }
.ovd-row.hot .ovd-pips i.on { background: var(--alarm); box-shadow: 0 0 5px var(--alarm-glow); }
.ovd-age { width: 20px; text-align: right; color: var(--holo-dim); }
.ovd-row.hot .ovd-age { color: var(--alarm); }

/* two independent completion rings side by side — deliberately not averaged
   into one number, since a finished task list and a stalled goal list are
   different signals worth reading separately at a glance */
.mtile.execution { width: 156px; height: 96px; padding: 6px 8px; justify-content: flex-start; align-items: stretch; gap: 4px; }
.mtile.execution .mt-lab { text-align: left; margin-top: 0; }
.mt-exec-row { display: flex; justify-content: space-around; align-items: center; flex: 1; }

/* Today's Homework — compact due-today checklist, alarm border/glow (from
   the shared .mtile.alarm rule above) when anything's actually overdue. */
.mtile.homework { width: 156px; height: 96px; padding: 6px 8px; justify-content: flex-start; align-items: stretch; gap: 3px; }
.mtile.homework .mt-lab { text-align: left; margin-top: 0; }
.mt-hw-empty { font-family: var(--mono); font-size: 8px; color: var(--holo-dim); opacity: 0.6; margin-top: 4px; }
.mt-hw-list { display: flex; flex-direction: column; gap: 2px; flex: 1; overflow: hidden; }
.mt-hw-row { display: flex; gap: 5px; font-family: var(--mono); font-size: 7.5px; letter-spacing: 0.02em; color: var(--ghost); white-space: nowrap; overflow: hidden; }
.mt-hw-row.done { color: var(--holo-dim); text-decoration: line-through; opacity: 0.6; }
.mt-hw-time { color: var(--holo-dim); flex-shrink: 0; }
.mt-hw-task { overflow: hidden; text-overflow: ellipsis; }
.mt-hw-more { font-family: var(--mono); font-size: 7px; color: var(--holo-dim); opacity: 0.7; }
.mt-hw-overdue { font-family: var(--mono); font-size: 7.5px; letter-spacing: 0.06em; text-transform: uppercase;
  color: var(--alarm); text-shadow: 0 0 6px var(--alarm-glow); }

/* framed instrument chart (reference 03 idiom) — header rule, labelled
   gridlines, emphasised zero baseline, segmented bars. Held level rather than
   jittered like the stat tiles: gridlines read as broken when rotated. */
.mtile.chart { width: 296px; height: 164px; padding: 7px 9px 3px; justify-content: flex-start; align-items: stretch; gap: 4px; }
.tile-field .mtile.chart { transform: none; }
.mt-charthead { display: flex; justify-content: space-between; align-items: baseline;
  border-bottom: 1px solid var(--panel-line); padding-bottom: 4px; }
.mtile.chart .mt-lab { margin-top: 0; text-align: left; }
.mt-chartval { font-family: var(--mono); font-size: 10.5px; color: var(--holo); }
.mt-chartval.neg { color: var(--alarm); }
.iox-axis { font-family: var(--mono); font-size: 6.4px; fill: var(--holo-dim); letter-spacing: 0.05em; }
/* masked money — width-preserving dots, revealed on hover (see Masked) */
.mt-masked { cursor: help; }
/* money strings run ~9 chars ("$9,780.85"), which overflows the tile at the
   normal 22px value size — step it down so the figure stays inside its box */
.mt-val.money { font-size: 15px !important; letter-spacing: 0.01em; }
.mt-tick { width: 4px; height: 4px; background: rgba(79,227,255,0.16); }
.mt-tick.on { background: var(--holo); box-shadow: 0 0 4px var(--holo); }
.mtile.hud.alarm .mt-tick.on { background: var(--alarm); box-shadow: 0 0 4px var(--alarm-glow); }

/* vein lines — a continuous soft-glowing beam from a cockpit tile back to
   Kaniel's core (a thin blurred halo + a slightly brighter core stroke,
   always visible so it reads as one line), with a handful of brighter
   particles drifting along it as texture/motion, not the line itself. */
.vein-svg { position: absolute; inset: 0; pointer-events: none; z-index: 1; overflow: visible; }
.vein-halo { fill: none; stroke: var(--holo); stroke-width: 3; opacity: 0.09; filter: blur(2.5px); }
.vein-thread { fill: none; stroke: var(--holo); stroke-width: 1; opacity: 0.22; filter: blur(0.6px); }
.vein-group.alarm .vein-halo, .vein-group.alarm .vein-thread { stroke: var(--alarm); }
.vein-spark { fill: var(--flare); filter: blur(0.4px); }
.vein-group.alarm .vein-spark { fill: #ffcfcf; }

/* organic scatter — break the perfect-grid read */
.tile-field .mtile:nth-child(3n) { transform: rotate(-1.1deg) translateY(-2px); }
.tile-field .mtile:nth-child(4n) { transform: rotate(0.9deg) translateY(3px); }
.tile-field .mtile:nth-child(5n+1) { transform: translateY(-3px); }
.tile-field .mtile:nth-child(7n+2) { transform: rotate(-0.6deg) translateY(2px); }
.tile-field .mtile:hover { transform: none; }

/* modal expand */
.tile-modal-backdrop { position: fixed; inset: 0; background: rgba(2,4,10,0.72); z-index: 50;
  display: flex; align-items: center; justify-content: center; }
.tile-modal { width: min(400px, 88vw); max-height: 78vh; overflow-y: auto; background: var(--panel-solid);
  border: 1px solid var(--holo-deep); padding: 18px 20px; box-shadow: 0 0 40px rgba(79,227,255,0.3); }
.tm-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 10px; }
.tm-title { font-family: var(--mono); font-size: 11px; letter-spacing: 0.14em; color: var(--holo-dim); text-transform: uppercase; }
.tm-close { background: none; border: 1px solid var(--panel-line); color: var(--ghost-dim); cursor: pointer;
  font-family: var(--mono); font-size: 10px; padding: 3px 8px; }
.tm-close:hover { color: var(--alarm); border-color: var(--alarm-dim); }
.tm-val { font-family: var(--mono); font-size: 38px; font-weight: 300; color: var(--holo); text-shadow: 0 0 18px rgba(79,227,255,0.5); }
.tile-modal.alarm .tm-val { color: var(--alarm); text-shadow: 0 0 18px var(--alarm-glow); }
/* real per-tile drill-down now — no forced uppercase/line-height, since this
   holds actual content (tables, meters, checklists) that brings its own type */
.tm-detail { margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--panel-line); }
.tm-exec-head { display: flex; justify-content: center; gap: 26px; }
.tm-detail-lab { font-family: var(--mono); font-size: 8px; letter-spacing: 0.16em; color: var(--holo-dim);
  text-transform: uppercase; margin-bottom: 6px; }
.tm-detail-lab:not(:first-child) { margin-top: 12px; }
.tm-check-row { display: flex; align-items: baseline; gap: 8px; font-family: var(--mono); font-size: 10px;
  color: var(--ghost); padding: 3px 0; border-bottom: 1px dashed rgba(79,227,255,0.08); }
.tm-check-row span:first-child { color: var(--holo-dim); }
.tm-check-row.done { color: var(--holo-dim); }
.tm-check-row.done span:first-child { color: var(--holo); }
.tm-check-row.done span:last-child { text-decoration: line-through; text-decoration-thickness: 1px; opacity: 0.75; }

/* ── CENTER / KANIEL ── */
.center-col { position: relative; display: flex; flex-direction: column; align-items: center; gap: 8px; }
/* standalone day-of-week instrument — deliberately its own element, not
   folded into the topbar clock, so it reads at a glance rather than as a
   footnote (see BUILD_STATE open item on the hero date/time treatment) */
.day-hero { display: flex; align-items: baseline; gap: 10px; }
.day-hero b { font-family: var(--mono); font-weight: 400; font-size: 27px; letter-spacing: 0.1em;
  color: var(--holo); text-shadow: 0 0 18px rgba(79,227,255,0.5); }
.day-hero i { font-style: normal; font-family: var(--mono); font-size: 9px; letter-spacing: 0.1em;
  color: var(--holo-dim); text-transform: uppercase; white-space: nowrap; }
/* weekly theme, pulled verbatim from Weekly Overview's header — text only,
   no computation. Sits in normal flow above the dial-field on purpose; see
   the JSX comment at its usage for why it can't live inside .kaniel. */
.week-theme-line { display: flex; align-items: baseline; gap: 9px; }
.week-theme-line i { font-style: normal; font-family: var(--mono); font-size: 7.5px; letter-spacing: 0.2em;
  color: var(--holo-dim); text-transform: uppercase; white-space: nowrap; }
.week-theme-line b { font-family: var(--mono); font-weight: 400; font-size: 12px; letter-spacing: 0.1em;
  color: var(--ghost); text-transform: uppercase; }
.dial-field { position: relative; width: 100%; max-width: 520px; aspect-ratio: 1.35 / 1; min-height: 330px; }
.ring-svg { position: absolute; inset: 0; width: 100%; height: 100%; }
.dial-greeble { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 0; }
.dg-coord { font-family: var(--mono); font-size: 6px; letter-spacing: 0.08em; }
.arc-seg-group { cursor: pointer; }
.arc-seg-hit { cursor: pointer; }
.arc-seg { transition: opacity 0.15s ease, filter 0.15s ease; }
.arc-seg-group:hover .arc-seg { filter: brightness(1.4); }
.arc-seg.all-sectors { stroke-dasharray: 1 3; }
.arc-seg-label { font-family: var(--mono); font-size: 8px; letter-spacing: 0.06em; text-transform: uppercase; cursor: pointer; }

.kaniel { position: absolute; left: 50%; top: 50%; transform: translate(-50%,-50%); z-index: 4;
  display: flex; flex-direction: column; align-items: center; pointer-events: none; padding-top: 44px; }
.k-assembly { position: relative; width: 250px; height: 250px; }
.k-canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }

/* ── instrument reticle ── */
.instrument-ring { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 1; }
.ir-rot { transform-box: view-box; transform-origin: 200px 130px; }
.ir-slow { animation: spin 110s linear infinite; }
.ir-rev { animation: spinRev 64s linear infinite; }
.ir-med { animation: spin 38s linear infinite; }
.ir-fast { animation: spinRev 22s linear infinite; }
.ir-ecc { transform-box: view-box; transform-origin: 200px 130px; }
.instrument-ring.agitated .ir-ecc { animation: eccentric 3.4s ease-in-out infinite; }
.instrument-ring.critical .ir-ecc { animation: eccentric 1.6s ease-in-out infinite; }
.ir-readout { font-family: var(--mono); font-size: 6.5px; letter-spacing: 0.06em; fill: var(--holo-dim); }
@keyframes eccentric { 0%,100% { transform: translate(0,0); } 25% { transform: translate(3px,-2px); }
  50% { transform: translate(-2px,2.5px); } 75% { transform: translate(2px,1.5px); } }

.kaniel-name { margin-top: 8px; font-size: 17px; letter-spacing: 0.46em; text-indent: 0.46em; font-weight: 300;
  text-transform: uppercase; color: var(--ghost); text-shadow: 0 0 22px rgba(79,227,255,0.6); pointer-events: auto; }
.kaniel-mood-row { display: flex; gap: 8px; align-items: center; margin-top: 3px; }
.kaniel-mood, .kaniel-action { font-family: var(--mono); font-size: 9px; letter-spacing: 0.16em; color: var(--holo-dim); text-transform: uppercase; }
.kaniel-mood.agitated, .kaniel-mood.critical { color: var(--alarm); }
.kaniel-action.thinking { color: var(--gold); }
.kaniel-action.listening { color: var(--flare); }

.cmd { margin-top: 2px; width: min(420px, 68vw); display: flex; align-items: center; gap: 10px;
  border-bottom: 1px solid var(--panel-line); padding: 6px 4px; pointer-events: auto;
  background: linear-gradient(180deg, transparent, rgba(79,227,255,0.03)); }
.cmd .caret { color: var(--holo); font-family: var(--mono); font-size: 14px; }
.cmd input { flex: 1; background: transparent; border: none; outline: none; color: var(--ghost); font-family: var(--mono); font-size: 12.5px; letter-spacing: 0.06em; }
.cmd input::placeholder { color: var(--holo-dim); }
.cmd .blink { width: 7px; height: 15px; background: var(--holo); animation: blink 1.1s step-end infinite; }
.cmd-status { margin-top: 5px; font-family: var(--mono); font-size: 9px; letter-spacing: 0.1em; color: var(--holo-dim);
  text-transform: uppercase; height: 12px; text-align: center; transition: opacity 0.3s ease; pointer-events: none; }

/* insight card */
.insight-card { margin-top: 6px; width: 100%; max-width: 460px; background: rgba(9,16,30,0.72);
  border: 1px solid var(--holo-deep); border-left: 3px solid var(--holo); padding: 9px 11px; position: relative; }
.insight-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
.insight-tag { font-family: var(--mono); font-size: 8.5px; letter-spacing: 0.16em; color: var(--holo); text-transform: uppercase; }
.insight-x { background: none; border: none; color: var(--holo-dim); cursor: pointer; font-family: var(--mono); font-size: 12px; padding: 2px 5px; }
.insight-x:hover { color: var(--alarm); }
.insight-body { font-family: var(--mono); font-size: 10px; line-height: 1.5; color: var(--ghost); }
.insight-foot { margin-top: 5px; font-family: var(--mono); font-size: 7.5px; letter-spacing: 0.08em; color: var(--holo-dim); text-transform: uppercase; opacity: 0.7; }
.insight-restore { margin-top: 8px; background: none; border: 1px dashed var(--panel-line); color: var(--holo-dim);
  font-family: var(--mono); font-size: 8.5px; letter-spacing: 0.1em; text-transform: uppercase; padding: 5px 9px; cursor: pointer; }
.insight-restore:hover { color: var(--holo); border-color: var(--holo); }

/* world map */
.map-panel { width: 100%; background: var(--panel); border: 1px solid var(--panel-line); padding: 8px 9px; }
.map-head { font-family: var(--mono); font-size: 8px; letter-spacing: 0.12em; color: var(--holo-dim); text-transform: uppercase; margin-bottom: 5px; display: flex; justify-content: space-between; }
.bottom-widgets { display: grid; grid-template-columns: 1fr; gap: 10px; align-items: end; margin-top: 8px; }

/* bottom chip row */
.chip-row { display: flex; flex-wrap: wrap; gap: 7px; justify-content: center; margin-top: 10px; padding-top: 8px; border-top: 1px solid var(--panel-line); }
.rchip { font-family: var(--mono); font-size: 8.5px; letter-spacing: 0.08em; color: var(--ghost-dim); text-transform: uppercase;
  background: rgba(4,8,16,0.4); border: 1px solid var(--panel-line); padding: 4px 9px; }
.rchip .k { color: var(--holo-dim); margin-right: 4px; }
.rchip .v { color: var(--holo); }
.rchip.alarm .v { color: var(--alarm); }

/* ── ALL SECTORS screen ── */
.allsec-search { width: 100%; max-width: 420px; margin: 14px auto 6px; display: flex; align-items: center; gap: 8px;
  border: 1px solid var(--panel-line); background: var(--panel); padding: 8px 12px; }
.allsec-search input { flex: 1; background: transparent; border: none; outline: none; color: var(--ghost); font-family: var(--mono); font-size: 12px; }
.allsec-search input::placeholder { color: var(--holo-dim); }
.allsec-grid { flex: 1; overflow-y: auto; display: flex; flex-wrap: wrap; gap: 8px; padding: 14px 4px 20px; align-content: flex-start; }
.allsec-item { width: 148px; background: var(--panel); border: 1px solid var(--panel-line); padding: 10px 11px; cursor: pointer; transition: all 0.15s ease; }
.allsec-item:hover { border-color: var(--holo); box-shadow: 0 0 14px rgba(79,227,255,0.2); }
.allsec-item.locked { opacity: 0.5; border-style: dashed; }
.allsec-glyph { font-size: 18px; color: var(--holo); }
.allsec-item.locked .allsec-glyph { color: var(--holo-dim); }
.allsec-label { font-family: var(--mono); font-size: 9.5px; letter-spacing: 0.06em; color: var(--ghost); text-transform: uppercase; margin-top: 6px; line-height: 1.3; }
.allsec-tag { font-family: var(--mono); font-size: 7px; letter-spacing: 0.08em; color: var(--holo-dim); text-transform: uppercase; margin-top: 3px; }

/* ── ZONE VIEW ── */
.zoneview { flex: 1; display: flex; flex-direction: column; }
.zv-head { display: flex; align-items: baseline; gap: 16px; margin-top: 18px; padding-bottom: 14px; border-bottom: 1px solid var(--panel-line); }
.zv-code { font-size: 30px; font-weight: 300; letter-spacing: 0.1em; color: var(--holo); text-shadow: 0 0 20px rgba(79,227,255,0.5); }
.zv-name { font-family: var(--mono); font-size: 12px; letter-spacing: 0.16em; color: var(--ghost-dim); text-transform: uppercase; }
.empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; font-family: var(--mono); text-transform: uppercase; }
.empty-ring { width: 60px; height: 60px; border-radius: 50%; border: 1px dashed var(--holo-dim); display: grid; place-items: center; animation: spin 22s linear infinite; }
.empty-ring span { font-size: 20px; color: var(--holo-dim); }
.empty-t { font-size: 12px; letter-spacing: 0.2em; color: var(--ghost-dim); }
.empty-s { font-size: 10px; letter-spacing: 0.16em; color: var(--holo-dim); opacity: 0.7; }

/* ── BUDGET SECTOR ── */
.bz-month { margin-left: auto; font-family: var(--mono); font-size: 10px; letter-spacing: 0.16em; color: var(--holo-dim); }
.bz-hero { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 14px; }
.bz-stat { flex: 1 1 140px; position: relative; background: var(--panel); border: 1px solid var(--panel-line); padding: 10px 12px; }
.bz-stat.big { flex: 2 1 220px; border-color: var(--holo-deep); box-shadow: 0 0 22px rgba(79,227,255,0.14); }
.bz-val { font-family: var(--mono); font-size: 22px; color: var(--holo); text-shadow: 0 0 12px rgba(79,227,255,0.4); }
.bz-stat.big .bz-val { font-size: 30px; }
.bz-lab { font-family: var(--mono); font-size: 8px; letter-spacing: 0.14em; color: var(--ghost-dim); text-transform: uppercase; margin-top: 4px; }
.bz-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 12px; align-items: start; }
.bz-mod { position: relative; background: var(--panel); border: 1px solid var(--panel-line); padding: 10px 12px 12px; }
.bz-mod.wide { grid-column: 1 / -1; }
.bz-mod::before, .bz-mod::after { content: ""; position: absolute; width: 9px; height: 9px; border: 1px solid var(--holo); opacity: 0.45; pointer-events: none; }
.bz-mod::before { top: 4px; right: 4px; border-left: none; border-bottom: none; }
.bz-mod::after { bottom: 4px; left: 4px; border-right: none; border-top: none; }
.bz-mod-head { display: flex; justify-content: space-between; align-items: baseline; font-family: var(--mono); font-size: 10px;
  letter-spacing: 0.16em; color: var(--holo); text-transform: uppercase; border-bottom: 1px solid var(--panel-line); padding-bottom: 6px; margin-bottom: 8px; }
.bz-tag { font-size: 7.5px; color: var(--holo-dim); opacity: 0.6; letter-spacing: 0.1em; }
.bz-row { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; font-family: var(--mono); font-size: 11px;
  color: var(--ghost); border-bottom: 1px dashed rgba(79,227,255,0.1); padding: 4px 0; }
.bz-row .k { color: var(--ghost-dim); font-size: 9px; text-transform: uppercase; letter-spacing: 0.1em; }
.bz-empty { font-family: var(--mono); font-size: 8.5px; letter-spacing: 0.12em; color: var(--holo-dim); opacity: 0.65; text-transform: uppercase; padding: 10px 0 4px; }
@media (max-width: 900px) { .bz-grid { grid-template-columns: minmax(0, 1fr); } }
.bz-mod { min-width: 0; }

/* placeholder-data marker — Phase 0 convention, same read as the dashboard's "mock" tags */
.bz-mockbar { display: inline-flex; align-items: center; gap: 7px; margin-left: 14px; padding: 3px 9px;
  border: 1px dashed var(--gold); color: var(--gold); font-family: var(--mono); font-size: 8px;
  letter-spacing: 0.16em; text-transform: uppercase; opacity: 0.85; }

/* kaniel flag cards — derived from data, dismissible, dismissals persisted.
   gold = attentive (75% caution), red = genuine alarm (overdue / over budget) */
.bz-flags { display: flex; flex-direction: column; gap: 6px; margin-top: 12px; }
.bz-flag { display: flex; align-items: center; gap: 10px; background: rgba(9,16,30,0.72);
  border: 1px solid var(--panel-line); border-left: 2px solid var(--gold); padding: 7px 10px; }
.bz-flag.alarm { border-left-color: var(--alarm); }
.bz-flag-tag { font-family: var(--mono); font-size: 8px; letter-spacing: 0.16em; color: var(--gold); text-transform: uppercase; white-space: nowrap; }
.bz-flag.alarm .bz-flag-tag { color: var(--alarm); }
.bz-flag-msg { flex: 1; font-family: var(--mono); font-size: 10px; color: var(--ghost); }
.bz-flag-x { background: none; border: 1px solid var(--panel-line); color: var(--ghost-dim); cursor: pointer;
  font-family: var(--mono); font-size: 9px; padding: 2px 7px; }
.bz-flag-x:hover { color: var(--holo); border-color: var(--holo); }

/* monthly log tables (capital on hand + net worth) */
.bz-log { width: 100%; border-collapse: collapse; font-family: var(--mono); font-size: 9.5px; }
.bz-log th { text-align: right; font-size: 7.5px; letter-spacing: 0.12em; color: var(--holo-dim);
  text-transform: uppercase; font-weight: 400; padding: 3px 0 4px 8px; border-bottom: 1px solid var(--panel-line); }
.bz-log th:first-child, .bz-log td:first-child { text-align: left; padding-left: 0; }
.bz-log td { text-align: right; color: var(--ghost); padding: 4px 0 4px 8px; border-bottom: 1px dashed rgba(79,227,255,0.1); }
.bz-log td.io.pos { color: var(--holo); }
.bz-log td.io.neg { color: var(--alarm); }

/* owe ledger rows */
.bz-owe { display: flex; align-items: center; gap: 8px; font-family: var(--mono); font-size: 10px;
  padding: 5px 0; border-bottom: 1px dashed rgba(79,227,255,0.1); }
.bz-dir { font-size: 7px; letter-spacing: 0.1em; text-transform: uppercase; padding: 1px 5px;
  border: 1px solid var(--panel-line); color: var(--holo-dim); white-space: nowrap; }
.bz-owe .who { flex: 1; color: var(--ghost); }
.bz-owe .amt { color: var(--holo); }
.bz-owe .due { font-size: 8px; color: var(--ghost-dim); white-space: nowrap; }
.bz-owe.overdue .amt, .bz-owe.overdue .due { color: var(--alarm); }
.bz-owe.overdue .due::after { content: " overdue"; }
.bz-owe.paid { opacity: 0.4; }
.bz-owe.paid .due::after { content: " · paid"; }

/* budget entry — inline-edit rows, same borderless-until-hover idiom as the roster */
.bz-edit-row { display: grid; grid-template-columns: minmax(0, 1fr) 112px 18px; gap: 8px; align-items: center;
  padding: 3px 0; border-bottom: 1px dashed rgba(79,227,255,0.1); }
.bz-in { width: 100%; background: transparent; border: none; outline: none; color: var(--ghost);
  font-family: var(--mono); font-size: 11px; padding: 2px 0; border-bottom: 1px dashed transparent; color-scheme: dark; }
.bz-in.money { text-align: right; color: var(--holo); }
.bz-in::placeholder { color: var(--holo-dim); opacity: 0.5; }
.bz-in:hover { border-bottom-color: rgba(79,227,255,0.22); }
.bz-in:focus { border-bottom-color: var(--holo); }
.bz-total { margin-top: 4px; padding-top: 4px; border-top: 1px solid var(--panel-line); }
.bz-mod.tall { grid-row: span 2; }
@media (max-width: 900px) { .bz-mod.tall { grid-row: auto; } }
.bz-owe-table { overflow-x: auto; }
.bz-owe-row { display: grid; grid-template-columns: 70px minmax(90px, 1fr) 100px minmax(110px, 1.4fr) 112px 40px 18px;
  gap: 8px; align-items: center; padding: 3px 0; border-bottom: 1px dashed rgba(79,227,255,0.1); min-width: 680px; }
.bz-owe-head { font-family: var(--mono); font-size: 8px; letter-spacing: 0.08em; color: var(--holo-dim);
  text-transform: uppercase; border-bottom: 1px solid var(--panel-line); padding-bottom: 4px; }
.bz-dir-btn { background: none; cursor: pointer; font-family: var(--mono); text-align: center; }
.bz-dir-btn:hover { border-color: var(--holo); color: var(--holo); }
.bz-owe-row .bz-in.money { text-align: left; }
.bz-owe-row.overdue .bz-in.money, .bz-in.late { color: var(--alarm); }
.bz-owe-row.paid { opacity: 0.45; }
.bz-paid-btn { background: none; border: none; cursor: pointer; color: var(--holo-dim); font-size: 12px; padding: 0; text-align: center; }
.bz-paid-btn[aria-pressed="true"] { color: var(--holo); text-shadow: 0 0 7px rgba(79,227,255,0.6); }
.bz-add-pair { display: flex; gap: 16px; }
.co-line { display: grid; grid-template-columns: 1fr 92px 14px 92px 88px; gap: 8px; align-items: center; font-family: var(--mono); font-size: 10.5px;
  padding: 5px 0; border-bottom: 1px dashed rgba(79,227,255,0.12); }
.co-line .k { color: var(--ghost-dim); font-size: 9px; letter-spacing: 0.1em; text-transform: uppercase; }
.co-line .co-start, .co-line .co-end { text-align: right; color: var(--ghost); }
.co-line .co-start.bz-in { border-bottom: 1px dashed rgba(79,227,255,0.3); }
.co-arrow { color: var(--holo-dim); text-align: center; }
.co-io { text-align: right; } .co-io.pos { color: var(--holo); } .co-io.neg { color: var(--alarm); }
.co-note { font-family: var(--mono); font-size: 9px; line-height: 1.6; letter-spacing: 0.04em; color: var(--holo-dim); margin-top: 10px; }
.co-note b { color: var(--gold); font-weight: 400; }
.bz-cat-head .bz-in { font-size: 10px; }
.bz-spend { display: grid; grid-template-columns: 74px minmax(0, 1fr) 30px 20px; gap: 6px; align-items: center; margin-top: 7px; }
.bz-spend .bz-in.money { text-align: left; }
.bz-log-btn, .bz-edit-btn { background: none; border: 1px solid var(--panel-line); color: var(--holo-dim); cursor: pointer;
  font-family: var(--mono); font-size: 8px; letter-spacing: 0.08em; text-transform: uppercase; padding: 2px 0; }
.bz-log-btn:hover:not(:disabled), .bz-edit-btn:hover, .bz-edit-btn.on { border-color: var(--holo); color: var(--holo); }
.bz-log-btn:disabled { opacity: 0.35; cursor: default; }
.bz-edit-btn { font-size: 11px; line-height: 1; }
.bz-cat-edit { margin-top: 8px; padding: 8px 0 2px; border-top: 1px dashed rgba(79,227,255,0.18); display: flex; flex-direction: column; gap: 4px; }
.bz-cat-edit label { display: grid; grid-template-columns: 1fr 96px; gap: 8px; align-items: center;
  font-family: var(--mono); font-size: 8px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ghost-dim); }
.bz-cat-note { font-family: var(--mono); font-size: 7.5px; letter-spacing: 0.06em; color: var(--holo-dim); opacity: 0.75; margin: 2px 0 4px; }
.bz-entry { display: flex; align-items: center; gap: 8px; font-family: var(--mono); font-size: 9.5px; padding: 2px 0; border-bottom: 1px dashed rgba(79,227,255,0.1); }
.bz-entry .amt { color: var(--holo); }
.bz-entry .note { flex: 1; color: var(--ghost); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bz-entry .when { font-size: 8px; color: var(--ghost-dim); }
.bz-del { align-self: flex-start; margin-top: 6px; background: none; border: none; cursor: pointer; padding: 0;
  font-family: var(--mono); font-size: 8px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--holo-dim); }
.bz-del:hover { color: var(--alarm); }

/* category budget meters */
.bz-cats { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 10px 16px; }
.bz-cat-head { display: flex; justify-content: space-between; align-items: baseline; font-family: var(--mono); font-size: 10px; color: var(--ghost); }
.bz-cat-pct { color: var(--holo); }
.bz-cat.warn .bz-cat-pct { color: var(--gold); }
.bz-cat.over .bz-cat-pct { color: var(--alarm); text-shadow: 0 0 8px var(--alarm-glow); }
.bz-meter { display: flex; gap: 2px; margin-top: 5px; }
.bz-meter i { flex: 1; height: 6px; background: rgba(79,227,255,0.12); }
.bz-meter i.on { background: var(--holo); }
.bz-cat.warn .bz-meter i.on { background: var(--gold); }
.bz-cat.over .bz-meter i.on { background: var(--alarm); }
.bz-cat-sub { font-family: var(--mono); font-size: 8px; letter-spacing: 0.08em; color: var(--ghost-dim); margin-top: 4px; text-transform: uppercase; }

/* ── WEEKLY OVERVIEW SECTOR ──
   Structural outline follows the source sheet's Weekly Overview tab: a header
   readout (week / today / theme), then a left rail of Priorities → Weekly Tasks
   → This Week's Goals. Week at a Glance and the ritual checklist join the band
   in increment 2, the metrics log in increment 3.
   No red anywhere in this sector — nothing here is an alarm condition. */
.wk-headright { margin-left: auto; display: flex; align-items: baseline; gap: 14px; }
.wk-wk { display: flex; align-items: baseline; gap: 6px; font-family: var(--mono); }
.wk-wk i { font-style: normal; font-size: 8px; letter-spacing: 0.22em; color: var(--holo-dim); text-transform: uppercase; }
.wk-wk b { font-size: 26px; font-weight: 400; line-height: 1; color: var(--holo); text-shadow: 0 0 16px rgba(79,227,255,0.45); }
.wk-boundary { font-family: var(--mono); font-size: 8px; letter-spacing: 0.14em; color: var(--holo-dim); text-transform: uppercase; }

/* theme band — the week's one-line directive, deliberately oversized */
.wk-theme { display: flex; align-items: center; gap: 14px; margin-top: 12px; padding: 10px 14px;
  background: linear-gradient(90deg, rgba(9,20,36,0.85), rgba(6,12,24,0.35));
  border: 1px solid var(--panel-line); border-left: 2px solid var(--holo); }
.wk-theme-lab { font-family: var(--mono); font-size: 8px; letter-spacing: 0.22em; color: var(--holo-dim);
  text-transform: uppercase; white-space: nowrap; }
.wk-theme-in { flex: 1; background: transparent; border: none; outline: none; color: var(--holo);
  font-family: var(--mono); font-size: 19px; letter-spacing: 0.16em; text-transform: uppercase;
  text-shadow: 0 0 14px rgba(79,227,255,0.35); padding: 2px 0; border-bottom: 1px dashed transparent; }
.wk-theme-in::placeholder { color: var(--holo-dim); opacity: 0.5; text-shadow: none; }
.wk-theme-in:hover { border-bottom-color: rgba(79,227,255,0.22); }
.wk-theme-in:focus { border-bottom-color: var(--holo); }
.wk-today { font-family: var(--mono); font-size: 9px; letter-spacing: 0.14em; color: var(--ghost-dim);
  text-transform: uppercase; white-space: nowrap; }

/* Daily Overview header — mirrors the Weekly Overview header structure under
   its own do- prefix (each sector owns its CSS, see bz-/wk-/mo-). */
.do-headright { margin-left: auto; display: flex; align-items: baseline; gap: 14px; }
.do-day { display: flex; align-items: baseline; gap: 6px; font-family: var(--mono); }
.do-day i { font-style: normal; font-size: 8px; letter-spacing: 0.22em; color: var(--holo-dim); text-transform: uppercase; }
.do-day b { font-size: 26px; font-weight: 400; line-height: 1; color: var(--holo); text-shadow: 0 0 16px rgba(79,227,255,0.45); }
.do-boundary { font-family: var(--mono); font-size: 8px; letter-spacing: 0.14em; color: var(--holo-dim); text-transform: uppercase; }

.do-theme { display: flex; align-items: center; gap: 14px; margin-top: 12px; padding: 10px 14px;
  background: linear-gradient(90deg, rgba(9,20,36,0.85), rgba(6,12,24,0.35));
  border: 1px solid var(--panel-line); border-left: 2px solid var(--holo); }
.do-theme-lab { font-family: var(--mono); font-size: 8px; letter-spacing: 0.22em; color: var(--holo-dim);
  text-transform: uppercase; white-space: nowrap; }
.do-theme-in { flex: 1; background: transparent; border: none; outline: none; color: var(--holo);
  font-family: var(--mono); font-size: 19px; letter-spacing: 0.16em; text-transform: uppercase;
  text-shadow: 0 0 14px rgba(79,227,255,0.35); padding: 2px 0; border-bottom: 1px dashed transparent; }
.do-theme-in::placeholder { color: var(--holo-dim); opacity: 0.5; text-shadow: none; }
.do-theme-in:hover { border-bottom-color: rgba(79,227,255,0.22); }
.do-theme-in:focus { border-bottom-color: var(--holo); }
.do-today { font-family: var(--mono); font-size: 9px; letter-spacing: 0.14em; color: var(--ghost-dim);
  text-transform: uppercase; white-space: nowrap; }

/* 1% Goal band — same structure as the theme band, one line down, smaller
   type since it's a secondary daily entry rather than the headline theme. */
.do-goal { display: flex; align-items: center; gap: 14px; margin-top: 8px; padding: 8px 14px;
  background: linear-gradient(90deg, rgba(9,20,36,0.7), rgba(6,12,24,0.3));
  border: 1px solid var(--panel-line); border-left: 2px solid var(--holo-dim); }
.do-goal-lab { font-family: var(--mono); font-size: 8px; letter-spacing: 0.22em; color: var(--holo-dim);
  text-transform: uppercase; white-space: nowrap; }
.do-goal-in { flex: 1; background: transparent; border: none; outline: none; color: var(--ghost);
  font-family: var(--mono); font-size: 13px; letter-spacing: 0.06em;
  padding: 2px 0; border-bottom: 1px dashed transparent; }
.do-goal-in::placeholder { color: var(--holo-dim); opacity: 0.5; }
.do-goal-in:hover { border-bottom-color: rgba(79,227,255,0.22); }
.do-goal-in:focus { border-bottom-color: var(--holo); }

/* Today's Reference — read-only, live-linked into weekly.glance/stopStart.
   No inputs anywhere in this module; editing happens in Weekly Overview. */
.do-ref { margin-top: 16px; }
.do-ref-grid { display: flex; flex-direction: column; gap: 4px; margin-top: 6px; }
.do-ref-row { display: grid; grid-template-columns: 84px 1fr; gap: 8px; align-items: start;
  padding: 6px 8px; border: 1px solid var(--panel-line); background: rgba(6,12,24,0.4); }
.do-ref-lab { font-family: var(--mono); font-size: 8px; letter-spacing: 0.14em; color: var(--holo-dim); text-transform: uppercase; padding-top: 2px; }
.do-ref-items { display: flex; flex-wrap: wrap; gap: 5px 10px; }
.do-ref-item { font-family: var(--mono); font-size: 11px; color: var(--ghost); }
.do-ref-row.reminders .do-ref-item { color: var(--gold); font-weight: 700; }
.do-ref-empty { font-family: var(--mono); font-size: 11px; color: var(--holo-dim); opacity: 0.5; }
.do-ref-ss { display: flex; gap: 10px; margin-top: 8px; }
.do-ref-ss-half { flex: 1; display: flex; align-items: baseline; gap: 8px; padding: 6px 10px;
  border: 1px solid var(--panel-line); font-family: var(--mono); font-size: 11px; color: var(--ghost); }
.do-ref-ss-half b { font-size: 8px; letter-spacing: 0.16em; color: var(--holo-dim); text-transform: uppercase; font-weight: 400; }

/* Priorities + Tasks — own module box + row styles, mirroring wk-mod's frame
   (corner ticks / left-rail accent) under the do- prefix per the per-sector
   CSS convention (see bz-/wk-/mo-). wk-mod-head/wk-tag stay shared — those
   two are already reused across sectors (see Weekly Metrics Outsourcing). */
.do-mod { position: relative; background: var(--panel); border: 1px solid var(--panel-line); padding: 10px 12px 12px; margin-top: 12px; }
.do-mod.f-tick::before, .do-mod.f-tick::after { content: ""; position: absolute; width: 9px; height: 9px; border: 1px solid var(--holo); opacity: 0.45; pointer-events: none; }
.do-mod.f-tick::before { top: 4px; right: 4px; border-left: none; border-bottom: none; }
.do-mod.f-tick::after { bottom: 4px; left: 4px; border-right: none; border-top: none; }
.do-mod.f-rail { border-left: 2px solid var(--holo-deep); background: linear-gradient(90deg, rgba(9,20,36,0.7), var(--panel) 42%); }

.do-empty { font-family: var(--mono); font-size: 10px; color: var(--holo-dim); opacity: 0.6; padding: 6px 2px; }
.do-x { background: none; border: none; cursor: pointer; color: var(--holo-dim); font-size: 10px; line-height: 1; padding: 2px; opacity: 0.5; }
.do-x:hover { color: var(--holo); opacity: 1; }
.do-add { background: none; border: none; cursor: pointer; color: var(--holo-dim); font-family: var(--mono);
  font-size: 9px; letter-spacing: 0.1em; padding: 4px 0; text-align: left; }
.do-add:hover { color: var(--holo); }
.do-check { background: none; border: none; cursor: pointer; color: var(--holo-dim); font-size: 10px; line-height: 1; padding: 0; }
.do-check:hover { color: var(--holo); }
.do-in { flex: 1; background: transparent; border: none; outline: none; color: var(--ghost); resize: none; overflow: hidden;
  font-family: var(--mono); font-size: 11px; line-height: 1.4; padding: 2px 0; border-bottom: 1px dashed transparent; }
.do-in::placeholder { color: var(--holo-dim); opacity: 0.5; }
.do-in:hover { border-bottom-color: rgba(79,227,255,0.22); }
.do-in:focus { border-bottom-color: var(--holo); }

.do-pri-row { display: flex; align-items: baseline; gap: 8px; padding: 3px 0; border-bottom: 1px solid var(--panel-line); }
.do-pri-row:last-of-type { border-bottom: none; }
.do-rank { font-family: var(--mono); font-size: 9px; color: var(--holo-dim); letter-spacing: 0.1em; width: 16px; flex-shrink: 0; }
.do-bullet { font-size: 10px; color: var(--holo-dim); width: 16px; flex-shrink: 0; text-align: center; }

/* Homework/Deadlines — dense 6-column + remove-button grid, columns verbatim
   from the source sheet. Narrower fixed widths for the date/time/status
   columns, Task gets the most room since it's the longest freeform field. */
.do-hw-table { display: flex; flex-direction: column; gap: 2px; margin-top: 6px; }
.do-hw-row { display: grid; grid-template-columns: 14px 70px minmax(0, 1fr) 90px 128px 96px 90px 18px;
  gap: 6px; align-items: center; padding: 3px 0; border-bottom: 1px solid var(--panel-line); }
.do-hw-row:last-child { border-bottom: none; }
.do-hw-row.done .do-hw-in { color: var(--holo-dim); text-decoration: line-through; opacity: 0.6; }
.do-hw-row.done .do-check { color: var(--holo); text-shadow: 0 0 7px rgba(79,227,255,0.6); }
.do-hw-head { font-family: var(--mono); font-size: 8px; letter-spacing: 0.1em; color: var(--holo-dim);
  text-transform: uppercase; border-bottom: 1px solid var(--panel-line); padding-bottom: 4px; }
.do-hw-sort { background: none; border: none; cursor: pointer; padding: 0; text-align: left;
  font-family: var(--mono); font-size: 8px; letter-spacing: 0.1em; color: var(--holo-dim); text-transform: uppercase; }
.do-hw-sort:hover { color: var(--ghost); }
.do-hw-sort.active { color: var(--holo); text-shadow: 0 0 6px rgba(79,227,255,0.5); }
.do-hw-in { width: 100%; background: transparent; border: none; outline: none; color: var(--ghost);
  font-family: var(--mono); font-size: 10px; padding: 2px 0; border-bottom: 1px dashed transparent;
  color-scheme: dark; }
.do-hw-in::placeholder { color: var(--holo-dim); opacity: 0.5; }
.do-hw-in:hover { border-bottom-color: rgba(79,227,255,0.22); }
.do-hw-in:focus { border-bottom-color: var(--holo); }

/* Reflection — three prompts, two of the three (What did you learn? / Where
   was God's hand?) get an inert cross-sector button. "Live button" per the
   user: a real, clickable element, not html-disabled — it just has nowhere
   real to go yet, and says so on click (do-refl-stub), same idiom as the
   Contact Tracker sync banner above. */
.do-refl-row { display: flex; align-items: flex-start; gap: 10px; padding: 6px 0; border-bottom: 1px solid var(--panel-line); }
.do-refl-row:last-of-type { border-bottom: none; }
.do-refl-lab { font-family: var(--mono); font-size: 10px; color: var(--ghost-dim); width: 150px; flex-shrink: 0; padding-top: 2px; }
.do-refl-btn { flex-shrink: 0; background: none; border: 1px dashed var(--panel-line); color: var(--holo-dim);
  cursor: pointer; font-family: var(--mono); font-size: 8px; letter-spacing: 0.06em; padding: 4px 8px; white-space: nowrap; }
.do-refl-btn:hover { border-color: var(--holo-dim); color: var(--ghost); }
.do-refl-stub { margin-top: 8px; font-family: var(--mono); font-size: 9px; color: var(--holo-dim); letter-spacing: 0.04em; }

/* Contact Tracker — own ct- prefix per the per-sector CSS convention (see
   bz-/wk-/mo-/do-). wk-mod-head/wk-tag and do-mod/do-empty/do-x/do-add stay
   shared — do-mod's frame/box styling has no sector-specific meaning, and
   reusing it here avoids redefining an identical box for a single module. */
.ct-roster { margin-top: 16px; }
.ct-table { display: flex; flex-direction: column; gap: 2px; margin-top: 6px; overflow-x: auto; }
.ct-row { display: grid;
  grid-template-columns: minmax(90px, 1.3fr) 84px 108px 92px 84px 92px 84px 84px minmax(90px, 1fr) 18px;
  gap: 6px; align-items: center; padding: 3px 0; border-bottom: 1px solid var(--panel-line); min-width: 900px; }
.ct-row:last-child { border-bottom: none; }
.ct-head { font-family: var(--mono); font-size: 8px; letter-spacing: 0.08em; color: var(--holo-dim);
  text-transform: uppercase; border-bottom: 1px solid var(--panel-line); padding-bottom: 4px; }
.ct-in, .ct-select { width: 100%; background: transparent; border: none; outline: none; color: var(--ghost);
  font-family: var(--mono); font-size: 10px; padding: 2px 0; border-bottom: 1px dashed transparent; color-scheme: dark; }
.ct-in::placeholder { color: var(--holo-dim); opacity: 0.5; }
.ct-in:hover, .ct-select:hover { border-bottom-color: rgba(79,227,255,0.22); }
.ct-in:focus, .ct-select:focus { border-bottom-color: var(--holo); }
.ct-select { cursor: pointer; }
.ct-select option { background: var(--panel); color: var(--ghost); }
.ct-next { font-family: var(--mono); font-size: 10px; color: var(--holo-dim); }
/* Overdue/due-today — red = genuine alarm (past due), gold = caution (due
   today), same gold-vs-red split as Budget's flags. Left border + wash reads
   at a glance without needing to scan the Next Contact column. */
.ct-row.overdue { border-left: 2px solid var(--alarm); padding-left: 6px; background: rgba(255,91,107,0.05); }
.ct-row.overdue .ct-next { color: var(--alarm); text-shadow: 0 0 6px var(--alarm-glow); }
.ct-row.due-today { border-left: 2px solid var(--gold); padding-left: 6px; background: rgba(255,209,102,0.05); }
.ct-row.due-today .ct-next { color: var(--gold); }
.ct-next-tag { font-size: 8px; letter-spacing: 0.08em; text-transform: uppercase; opacity: 0.85; }
.ct-next-tag.due { color: var(--gold); }
.ct-tag-alarm { color: var(--alarm); }
.ct-tag-due { color: var(--gold); }

/* Daily Overview's synced People half — read-only, sourced live from Contact
   Tracker (see contactSyncTargets in store.js). Same overdue/due-today split
   as the Roster rows, reused here so the two views read as one language. */
.ct-sync-row { display: flex; align-items: center; justify-content: space-between; gap: 8px;
  padding: 4px 8px; margin-top: 3px; font-family: var(--mono); font-size: 10px; color: var(--ghost); }
.ct-sync-row.overdue { border-left: 2px solid var(--alarm); background: rgba(255,91,107,0.05); }
.ct-sync-row.due-today { border-left: 2px solid var(--gold); background: rgba(255,209,102,0.05); }
.ct-sync-tag { font-size: 8px; letter-spacing: 0.08em; text-transform: uppercase; opacity: 0.85; }
.ct-sync-row.overdue .ct-sync-tag { color: var(--alarm); }
.ct-sync-row.due-today .ct-sync-tag { color: var(--gold); }
.ct-pri-group { display: flex; gap: 2px; }
.ct-pri-btn { width: 14px; height: 15px; display: flex; align-items: center; justify-content: center;
  background: transparent; border: 1px solid var(--panel-line); color: var(--holo-dim); cursor: pointer;
  font-family: var(--mono); font-size: 8px; line-height: 1; padding: 0; }
.ct-pri-btn:hover { border-color: var(--holo-dim); color: var(--ghost); }
.ct-pri-btn.active { background: var(--holo-deep); border-color: var(--holo); color: var(--holo); text-shadow: 0 0 6px rgba(79,227,255,0.6); }

/* Project Tracker — own pt- prefix. Four zone clusters, scattered cards (not
   a uniform grid, per CLAUDE.md's density/jitter rule), Zone 1 visually
   distinct as a one-slot focus zone. No red anywhere — nothing here is an
   alarm condition by design (see PROJECT_TRACKER_SPEC.md "targetDate is soft"). */
.pt-board { margin-top: 4px; }
.pt-add-row { display: flex; gap: 8px; align-items: center; margin-bottom: 18px; }
.pt-add-in { flex: 1; max-width: 360px; background: rgba(6,12,24,0.4); border: 1px solid var(--panel-line);
  color: var(--ghost); font-family: var(--mono); font-size: 11px; padding: 7px 10px; outline: none; }
.pt-add-in::placeholder { color: var(--holo-dim); opacity: 0.6; }
.pt-add-in:focus { border-color: var(--holo-dim); }
.pt-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px 20px; align-items: start; }
.pt-zone-one { grid-column: span 1; }
.pt-cluster { display: flex; flex-wrap: wrap; gap: 10px 14px; margin-top: 8px; }
.pt-zone-one .pt-cluster { flex-direction: column; }

.pt-card { width: 168px; background: rgba(6,12,24,0.45); border: 1px solid var(--panel-line);
  padding: 8px 9px 7px; display: flex; flex-direction: column; gap: 5px; position: relative; }
/* scattered jitter, CSS-driven like the dashboard tile field — not inline
   randomization, so re-renders never reshuffle the look */
.pt-cluster > .pt-card:nth-child(3n) { transform: rotate(-0.8deg); }
.pt-cluster > .pt-card:nth-child(3n+1) { transform: rotate(0.6deg); }
.pt-cluster > .pt-card:nth-child(5n) { transform: rotate(-0.4deg) translateY(2px); }
.pt-card.big { width: 220px; padding: 12px 13px 10px; }
.pt-card.archived { opacity: 0.55; }
.pt-card.archived .pt-name { text-decoration: line-through; }
.pt-card-top { display: flex; align-items: flex-start; gap: 6px; }
.pt-name { flex: 1; background: transparent; border: none; outline: none; resize: none; overflow: hidden;
  color: var(--ghost); font-family: var(--mono); font-size: 11px; line-height: 1.3; padding: 0;
  border-bottom: 1px dashed transparent; }
.pt-name:hover { border-bottom-color: rgba(79,227,255,0.22); }
.pt-name:focus { border-bottom-color: var(--holo); }
.pt-name::placeholder { color: var(--holo-dim); opacity: 0.6; }
.pt-card-row { display: flex; align-items: center; gap: 6px; }
.pt-state { font-family: var(--mono); font-size: 8px; letter-spacing: 0.08em; text-transform: uppercase;
  padding: 3px 7px; border: 1px solid var(--panel-line); background: transparent; cursor: pointer; }
.pt-state-active { color: var(--holo); border-color: var(--holo-dim); text-shadow: 0 0 5px rgba(79,227,255,0.4); }
.pt-state-standby { color: var(--gold); border-color: var(--gold); opacity: 0.85; }
.pt-state-dormant { color: var(--holo-dim); }
.pt-state-archived { color: var(--ghost-dim); opacity: 0.7; }
.pt-zone-select { flex: 1; background: transparent; border: 1px solid var(--panel-line); color: var(--holo-dim);
  font-family: var(--mono); font-size: 8px; padding: 3px 4px; cursor: pointer; color-scheme: dark; }
.pt-zone-select option { background: var(--panel); color: var(--ghost); }
.pt-target-lab { font-family: var(--mono); font-size: 8px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--holo-dim); }
.pt-target { background: transparent; border: none; outline: none; color: var(--ghost-dim);
  font-family: var(--mono); font-size: 9px; padding: 1px 0; color-scheme: dark; }
.pt-notes-toggle { align-self: flex-start; background: none; border: none; cursor: pointer; padding: 0;
  font-family: var(--mono); font-size: 8px; letter-spacing: 0.06em; color: var(--holo-dim); }
.pt-notes-toggle:hover { color: var(--ghost); }
.pt-notes { background: rgba(6,12,24,0.4); border: 1px solid var(--panel-line); color: var(--ghost-dim);
  font-family: var(--mono); font-size: 9px; padding: 5px 6px; outline: none; resize: none; overflow: hidden; }
.pt-notes:focus { border-color: var(--holo-dim); }

/* Life Goals — own lg- prefix. Cascading tree (Life → Year → Quarter), NOT
   independent zone clusters like Project Tracker — indentation + a "rolls up
   to" tag on every non-root card carry the hierarchy. Reuses pt-state/
   pt-notes-toggle/pt-notes/pt-add-in/do-add since those carry no
   sector-specific meaning, matching Contact Tracker's reuse convention. */
.lg-board { margin-top: 4px; }
.lg-add-bars { display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px;
  padding: 10px 12px; border: 1px dashed var(--panel-line); background: rgba(6,12,24,0.3); }
.lg-add-bar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.lg-add-lab { font-family: var(--mono); font-size: 8px; letter-spacing: 0.1em; text-transform: uppercase;
  color: var(--holo-dim); width: 52px; flex-shrink: 0; }
.lg-add-blocked { font-family: var(--mono); font-size: 9px; color: var(--holo-dim); font-style: italic; }
.lg-parent-select { width: 180px; }
.lg-tree { display: flex; flex-direction: column; gap: 16px; }
.lg-life-block { display: flex; flex-direction: column; gap: 8px; }
.lg-children { display: flex; flex-direction: column; gap: 8px; margin-left: 22px;
  padding-left: 12px; border-left: 1px solid var(--panel-line); }
.lg-year-block { display: flex; flex-direction: column; gap: 8px; }

.lg-card { width: 260px; background: rgba(6,12,24,0.45); border: 1px solid var(--panel-line);
  padding: 8px 9px 7px; display: flex; flex-direction: column; gap: 5px; }
.lg-tier-life { border-left: 2px solid var(--holo); width: 300px; }
.lg-tier-year { border-left: 2px solid var(--holo-dim); }
.lg-tier-quarter { border-left: 2px solid var(--panel-line); width: 240px; }
.lg-card.archived { opacity: 0.55; }
.lg-card.archived .lg-title { text-decoration: line-through; }
.lg-card-top { display: flex; align-items: flex-start; gap: 6px; }
.lg-tier-tag { font-family: var(--mono); font-size: 7px; letter-spacing: 0.1em; text-transform: uppercase;
  color: var(--holo-dim); flex-shrink: 0; padding-top: 2px; }
.lg-title { flex: 1; background: transparent; border: none; outline: none; resize: none; overflow: hidden;
  color: var(--ghost); font-family: var(--mono); font-size: 11px; line-height: 1.3; padding: 0;
  border-bottom: 1px dashed transparent; }
.lg-title:hover { border-bottom-color: rgba(79,227,255,0.22); }
.lg-title:focus { border-bottom-color: var(--holo); }
.lg-title::placeholder { color: var(--holo-dim); opacity: 0.6; }
.lg-rollup { font-family: var(--mono); font-size: 8px; letter-spacing: 0.04em; color: var(--holo-dim); }
.lg-card-row { display: flex; align-items: center; gap: 6px; }
.lg-state-active { color: var(--holo); border-color: var(--holo-dim); text-shadow: 0 0 5px rgba(79,227,255,0.4); }
.lg-state-standby { color: var(--gold); border-color: var(--gold); opacity: 0.85; }
.lg-state-dormant { color: var(--holo-dim); }
.lg-state-archived { color: var(--ghost-dim); opacity: 0.7; }
.lg-period { flex: 1; max-width: 100px; background: transparent; border: 1px solid var(--panel-line);
  color: var(--ghost-dim); font-family: var(--mono); font-size: 9px; padding: 3px 5px; outline: none; }
.lg-period::placeholder { color: var(--holo-dim); opacity: 0.5; }

.do-task-row { display: flex; align-items: baseline; gap: 8px; padding: 3px 0; border-bottom: 1px solid var(--panel-line); }
.do-task-row:last-of-type { border-bottom: none; }
.do-task-row.checked .do-in { color: var(--holo-dim); text-decoration: line-through; opacity: 0.6; }
.do-task-row.checked .do-check { color: var(--holo); text-shadow: 0 0 7px rgba(79,227,255,0.6); }
/* 1/2/3 priority selector — three small toggle buttons, 1 = highest, matching
   LIFE-2.xlsx's Daily Overview Tasks/Priorities columns. Clicking the already-
   active number clears it back to unset rather than needing a separate control. */
.do-pri-group { display: flex; gap: 2px; flex-shrink: 0; }
.do-pri-btn { width: 15px; height: 15px; display: flex; align-items: center; justify-content: center;
  background: transparent; border: 1px solid var(--panel-line); color: var(--holo-dim); cursor: pointer;
  font-family: var(--mono); font-size: 9px; line-height: 1; padding: 0; }
.do-pri-btn:hover { border-color: var(--holo-dim); color: var(--ghost); }
.do-pri-btn.active { background: var(--holo-deep); border-color: var(--holo); color: var(--holo); text-shadow: 0 0 6px rgba(79,227,255,0.6); }

/* Three bands, each with its own weight: a narrow left rail of lists, the wide
   instrument grid in the middle, a tall thin ritual spine on the right. */
.wk-band { display: grid; grid-template-columns: 244px minmax(0, 1fr) 250px; gap: 11px; margin-top: 10px; align-items: start; }
.wk-rail { display: flex; flex-direction: column; gap: 9px; }
.wk-center { display: flex; flex-direction: column; gap: 9px; }
/* deliberate offset jitter — perfectly flush tops read as one slab */
.wk-center { margin-top: 7px; }
.wk-band > .wk-mod.f-spine { margin-top: 15px; }

.wk-mod { position: relative; background: var(--panel); border: 1px solid var(--panel-line); padding: 10px 12px 12px; }

/* ── frame variants ──
   Same palette and type throughout; only the framing changes, so the modules
   read as separate instruments rather than one undifferentiated data dump. */

/* f-tick — cut corners. The densest, most "panel" treatment. */
.wk-mod.f-tick::before, .wk-mod.f-tick::after { content: ""; position: absolute; width: 9px; height: 9px; border: 1px solid var(--holo); opacity: 0.45; pointer-events: none; }
.wk-mod.f-tick::before { top: 4px; right: 4px; border-left: none; border-bottom: none; }
.wk-mod.f-tick::after { bottom: 4px; left: 4px; border-right: none; border-top: none; }

/* f-rail — solid left accent, no corners. Lighter, more list-like. */
.wk-mod.f-rail { border-left: 2px solid var(--holo-deep); background: linear-gradient(90deg, rgba(9,20,36,0.7), var(--panel) 42%); }
.wk-mod.f-rail.alt { border-left-style: dashed; border-left-color: var(--holo-dim); }

/* f-instr — the centrepiece. Brighter frame + a notched header rule. */
.wk-mod.f-instr { border-color: rgba(79,227,255,0.3); box-shadow: inset 0 0 34px rgba(79,227,255,0.05); padding: 10px 13px 13px; }
.wk-mod.f-instr::before { content: ""; position: absolute; top: -1px; left: 22px; width: 54px; height: 2px; background: var(--holo); opacity: 0.75; }
.wk-mod.f-instr::after { content: ""; position: absolute; bottom: -1px; right: 22px; width: 34px; height: 2px; background: var(--holo); opacity: 0.4; }

/* f-spine — dashed, vertical, reads as a checklist rail not a panel */
.wk-mod.f-spine { border-style: dashed; border-color: rgba(79,227,255,0.22); background: rgba(6,12,24,0.55); }
/* wraps rather than shattering the title into one word per line when a long
   tag shares the row with it */
.wk-mod-head { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: baseline; gap: 2px 8px;
  font-family: var(--mono); font-size: 10px; letter-spacing: 0.16em; color: var(--holo); text-transform: uppercase;
  border-bottom: 1px solid var(--panel-line); padding-bottom: 6px; margin-bottom: 8px; }
.wk-mod-head > span:first-child { white-space: nowrap; }
.wk-tag { font-size: 7.5px; color: var(--holo-dim); opacity: 0.6; letter-spacing: 0.1em; }

/* shared inline-edit field — invisible until touched, so a full screen of
   inputs reads as a readout rather than a web form */
.wk-in { flex: 1; min-width: 0; background: transparent; border: none; outline: none; color: var(--ghost);
  font-family: var(--mono); font-size: 11px; line-height: 1.45; padding: 2px 0;
  border-bottom: 1px dashed transparent; transition: border-color 0.15s ease, color 0.15s ease;
  resize: none; overflow: hidden; display: block; }
.wk-in::placeholder { color: var(--holo-dim); opacity: 0.45; }
.wk-in:hover { border-bottom-color: rgba(79,227,255,0.18); }
.wk-in:focus { border-bottom-color: var(--holo); color: #fff; }

/* priorities — ranked, weight ramps down so rank 1 reads first */
.wk-pri-row { display: flex; align-items: baseline; gap: 9px; padding: 4px 0; border-bottom: 1px dashed rgba(79,227,255,0.1); }
.wk-rank { font-family: var(--mono); font-size: 9px; letter-spacing: 0.1em; color: var(--holo); opacity: 0.85; white-space: nowrap; }
.wk-pri-row:nth-child(1) .wk-in { font-size: 12.5px; color: var(--holo); }
.wk-pri-row:nth-child(2) .wk-in { font-size: 12px; }
.wk-pri-row:nth-child(n+4) .wk-rank { opacity: 0.5; }
.wk-pri-row:nth-child(n+4) .wk-in { opacity: 0.82; }

/* freeform lists (weekly tasks · this week's goals) — the checkbox here is a
   real completion signal, separate from the goal's inline n/m parser below
   (.wk-goal.done), which is a display-only progress meter, not a toggle. */
.wk-row { display: flex; align-items: baseline; gap: 8px; padding: 3px 0; border-bottom: 1px dashed rgba(79,227,255,0.08); }
.wk-row.checked .wk-check, .wk-goal.checked .wk-check { color: var(--holo); text-shadow: 0 0 7px rgba(79,227,255,0.6); }
.wk-row.checked .wk-in, .wk-goal.checked .wk-in { color: var(--holo-dim); text-decoration: line-through; text-decoration-thickness: 1px; opacity: 0.7; }
.wk-bullet { font-family: var(--mono); font-size: 9px; color: var(--holo-dim); }
.wk-x { background: none; border: none; color: var(--holo-dim); cursor: pointer; font-family: var(--mono);
  font-size: 10px; padding: 0 3px; opacity: 0; transition: opacity 0.15s ease, color 0.15s ease; }
.wk-row:hover .wk-x { opacity: 0.7; }
.wk-x:hover { color: var(--holo); opacity: 1; }
.wk-add { margin-top: 7px; background: none; border: 1px dashed var(--panel-line); color: var(--holo-dim);
  font-family: var(--mono); font-size: 8.5px; letter-spacing: 0.16em; text-transform: uppercase;
  padding: 5px 10px; cursor: pointer; width: 100%; text-align: left; }
.wk-add:hover { border-color: var(--holo); color: var(--holo); }
.wk-empty { font-family: var(--mono); font-size: 8.5px; letter-spacing: 0.12em; color: var(--holo-dim);
  opacity: 0.6; text-transform: uppercase; padding: 8px 0 2px; }

/* goals carry inline progress in the sheet ("5 gym workouts 1/5") — parsed for
   display only, the raw text stays exactly what was typed */
.wk-goal { display: flex; flex-direction: column; gap: 3px; padding: 4px 0; border-bottom: 1px dashed rgba(79,227,255,0.08); }
.wk-goal-top { display: flex; align-items: baseline; gap: 8px; }
.wk-prog { display: flex; align-items: center; gap: 7px; padding-left: 17px; }
.wk-prog-meter { display: flex; gap: 2px; flex: 1; max-width: 132px; }
.wk-prog-meter i { flex: 1; height: 4px; background: rgba(79,227,255,0.12); }
.wk-prog-meter i.on { background: var(--holo); box-shadow: 0 0 5px rgba(79,227,255,0.5); }
.wk-prog-n { font-family: var(--mono); font-size: 8px; letter-spacing: 0.1em; color: var(--holo-dim); white-space: nowrap; }
.wk-goal.done .wk-prog-n { color: var(--holo); }
.wk-goal.done .wk-bullet::after { content: " ✓"; color: var(--holo); }

/* ── week at a glance — instrument grid ── */
.wk-gl { display: flex; flex-direction: column; }
.wk-gl-head, .wk-gl-row { display: grid; grid-template-columns: 74px repeat(7, minmax(0, 1fr)); gap: 3px; }
.wk-gl-head { align-items: end; margin-bottom: 4px; }
.wk-gl-day { display: flex; flex-direction: column; align-items: center; gap: 1px; padding-bottom: 4px;
  border-bottom: 1px solid var(--panel-line); position: relative; }
/* tick marks under each day, so the header reads as a scale not a table row */
.wk-gl-day::after { content: ""; position: absolute; bottom: -1px; left: 50%; width: 1px; height: 4px; background: var(--holo-dim); }
.wk-gl-day b { font-family: var(--mono); font-size: 8px; font-weight: 400; letter-spacing: 0.16em; color: var(--holo-dim); text-transform: uppercase; }
.wk-gl-day i { font-family: var(--mono); font-size: 9px; font-style: normal; color: var(--ghost-dim); }
.wk-gl-day.today { border-bottom-color: var(--holo); }
.wk-gl-day.today b { color: var(--holo); }
.wk-gl-day.today i { color: #fff; }
.wk-gl-day.today::after { background: var(--holo); height: 6px; box-shadow: 0 0 6px var(--holo); }
.wk-gl-row { margin-bottom: 3px; }
.wk-gl-lab { font-family: var(--mono); font-size: 7.5px; letter-spacing: 0.14em; color: var(--holo-dim);
  text-transform: uppercase; padding: 5px 8px 0 0; text-align: right; border-right: 1px solid var(--panel-line); }

/* every cell carries a faint frame — without one the empty grid reads as blank
   space and the day columns stop being legible as a grid at all */
.wk-cell { position: relative; min-height: 32px; padding: 3px 4px 12px; background: rgba(8,16,30,0.55);
  border: 1px solid rgba(79,227,255,0.08); transition: border-color 0.15s ease, background 0.15s ease; }
.wk-cell:hover { border-color: rgba(79,227,255,0.28); background: rgba(9,20,36,0.75); }
.wk-cell.today { background: rgba(13,32,54,0.7); border-color: rgba(79,227,255,0.22); }
.wk-cell-in { display: block; width: 100%; background: transparent; border: none; outline: none; color: var(--ghost);
  font-family: var(--mono); font-size: 9px; line-height: 1.5; padding: 1px 0; border-bottom: 1px dashed transparent;
  resize: none; overflow: hidden; }
.wk-cell-in:hover { border-bottom-color: rgba(79,227,255,0.16); }
.wk-cell-in:focus { border-bottom-color: var(--holo); color: #fff; }
/* reminders only — bold gold so they visually interrupt the row the way an
   actual reminder should, distinct from ordinary obligations/needs/wants text */
.wk-gl-row.reminders .wk-cell-in { color: var(--gold); font-weight: 700; }
.wk-gl-row.reminders .wk-cell-in:focus { color: var(--gold); }
.wk-cell-add { position: absolute; bottom: 1px; right: 2px; background: none; border: none; cursor: pointer;
  color: var(--holo-dim); font-family: var(--mono); font-size: 10px; line-height: 1; padding: 1px 3px;
  opacity: 0; transition: opacity 0.15s ease; }
.wk-cell:hover .wk-cell-add { opacity: 0.75; }
.wk-cell-add:hover { color: var(--holo); opacity: 1; }

/* ── stop / start — a banner, not a box, so it doesn't read as another module ── */
.wk-ss { display: grid; grid-template-columns: 1fr 1fr; gap: 0;
  border-top: 1px solid var(--panel-line); border-bottom: 1px solid var(--panel-line);
  background: linear-gradient(180deg, rgba(9,20,36,0.5), rgba(6,12,24,0.2)); }
.wk-ss-half { display: flex; align-items: baseline; gap: 9px; padding: 8px 12px; cursor: text; min-width: 0; }
.wk-ss-half.start { border-left: 1px solid var(--panel-line); }
.wk-ss-lab { font-family: var(--mono); font-size: 8px; letter-spacing: 0.22em; text-transform: uppercase; white-space: nowrap; }
/* stop reads recessive, start reads active — no red, nothing here is an alarm */
.wk-ss-half.stop .wk-ss-lab { color: var(--holo-dim); }
.wk-ss-half.stop .wk-in { opacity: 0.8; }
.wk-ss-half.start .wk-ss-lab { color: var(--holo); }

/* ── week state chart — fills the center column below Glance/Stop-Start ──
   No fixed height on the svg: it scales proportionally with the viewBox
   (see the component comment), so height varies a little with column width
   rather than ever distorting. */
.wk-chart-svg { width: 100%; display: block; margin-top: 2px; }
.wk-chart-grid { stroke: rgba(79,227,255,0.08); stroke-width: 1; }
.wk-chart-today { stroke: rgba(79,227,255,0.4); stroke-width: 1; stroke-dasharray: 2 3; }
.wk-chart-ylab { font-family: var(--mono); font-size: 7px; fill: var(--holo-dim); }
.wk-chart-daylab { font-family: var(--mono); font-size: 7px; letter-spacing: 0.06em; fill: var(--holo-dim); text-transform: uppercase; }
.wk-chart-daylab.today { fill: var(--holo); }
/* generous invisible radius around each real dot — the visible dot is only
   r=2, too small a target to hover reliably on its own */
.wk-chart-hit { fill: transparent; cursor: pointer; }
.wk-chart-tip rect { fill: rgba(6,12,24,0.94); stroke: var(--panel-line); stroke-width: 1; }
.wk-chart-tip-lab { font-family: var(--mono); font-size: 6.5px; letter-spacing: 0.08em; fill: var(--holo-dim); text-transform: uppercase; }
.wk-chart-tip-val { font-family: var(--mono); font-size: 11px; }
.wk-chart-legend { display: flex; flex-wrap: wrap; gap: 11px; margin-top: 8px; padding-top: 7px; border-top: 1px solid var(--panel-line); }
.wk-chart-chip { display: flex; align-items: center; gap: 5px; font-family: var(--mono); font-size: 7.5px; letter-spacing: 0.1em; color: var(--ghost-dim); text-transform: uppercase; }
.wk-chart-chip i { width: 7px; height: 7px; border-radius: 50%; display: inline-block; }

/* ── ritual spine ── */
.wk-ritual-prog { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.wk-ritual-count { font-family: var(--mono); font-size: 15px; color: var(--holo); line-height: 1; }
.wk-ritual-count i { font-style: normal; font-size: 9px; color: var(--holo-dim); }
.wk-ritual-bar { flex: 1; height: 3px; background: rgba(79,227,255,0.12); position: relative; }
.wk-ritual-bar i { position: absolute; inset: 0 auto 0 0; background: var(--holo); box-shadow: 0 0 6px rgba(79,227,255,0.6); transition: width 0.2s ease; }
.wk-steps { list-style: none; margin: 0; padding: 0; }
.wk-step { display: flex; align-items: baseline; gap: 5px; padding: 2px 0; border-bottom: 1px dashed rgba(79,227,255,0.07); }
.wk-check { background: none; border: none; cursor: pointer; color: var(--holo-dim); font-size: 10px; line-height: 1; padding: 0; }
.wk-check:hover { color: var(--holo); }
.wk-step.on .wk-check { color: var(--holo); text-shadow: 0 0 7px rgba(79,227,255,0.6); }
.wk-step-n { font-family: var(--mono); font-size: 7.5px; color: var(--holo-dim); opacity: 0.6; white-space: nowrap; }
.wk-step-in { font-size: 9.5px; line-height: 1.4; }
.wk-step.on .wk-step-in { color: var(--holo-dim); text-decoration: line-through; text-decoration-thickness: 1px; opacity: 0.7; }
.wk-step-tools { display: flex; gap: 1px; opacity: 0; transition: opacity 0.15s ease; }
.wk-step:hover .wk-step-tools { opacity: 0.7; }
.wk-step-tools button { background: none; border: none; cursor: pointer; color: var(--holo-dim);
  font-family: var(--mono); font-size: 8px; padding: 0 2px; line-height: 1; }
.wk-step-tools button:hover:not(:disabled) { color: var(--holo); }
.wk-step-tools button:disabled { opacity: 0.2; cursor: default; }

/* ── daily metrics log — the densest module, full sector width, own frame ── */
.wk-mod.f-dm { margin-top: 11px; border-color: rgba(79,227,255,0.22); }
.wk-dm-actions { display: flex; align-items: center; gap: 8px; margin-left: auto; }
.wk-dm-msg { font-family: var(--mono); font-size: 8px; letter-spacing: 0.1em; color: var(--holo); text-transform: uppercase; white-space: nowrap; }
.wk-dm-btn { background: none; border: 1px solid var(--panel-line); color: var(--holo-dim); cursor: pointer;
  font-family: var(--mono); font-size: 8px; letter-spacing: 0.12em; text-transform: uppercase; padding: 4px 9px; white-space: nowrap; }
.wk-dm-btn:hover { border-color: var(--holo); color: var(--holo); }
.wk-dm-btn.warn { border-color: var(--alarm-dim); color: var(--alarm-dim); }
.wk-dm-btn.warn:hover, .wk-dm-btn.warn.armed { border-color: var(--alarm); color: var(--alarm); background: rgba(255,91,107,0.08); }

.wk-dm-scroll { overflow-x: auto; margin-top: 4px; }
.wk-dm-table { min-width: 660px; }
.wk-dm-row { display: grid; grid-template-columns: 148px repeat(7, minmax(34px, 1fr)) 44px 44px 66px;
  gap: 3px; align-items: center; padding: 2px 0; border-bottom: 1px dashed rgba(79,227,255,0.06); }
.wk-dm-head-row { border-bottom: 1px solid var(--panel-line); padding-bottom: 5px; margin-bottom: 2px; position: sticky; top: 0; background: var(--panel); z-index: 1; }
.wk-dm-lab { font-family: var(--mono); font-size: 8.5px; letter-spacing: 0.04em; color: var(--ghost-dim); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding-right: 4px; }
.wk-dm-cell { display: flex; justify-content: center; }
.wk-dm-daylab { flex-direction: column; align-items: center; gap: 0; font-family: var(--mono); font-size: 7px; letter-spacing: 0.1em; color: var(--holo-dim); text-transform: uppercase; }
.wk-dm-daylab i { font-style: normal; font-size: 8px; color: var(--ghost-dim); }
.wk-dm-daylab.today { color: var(--holo); }
.wk-dm-daylab.today i { color: #fff; }
.wk-dm-in { width: 100%; max-width: 54px; background: rgba(6,12,24,0.5); border: 1px solid rgba(79,227,255,0.1); color: var(--ghost);
  font-family: var(--mono); font-size: 8.5px; text-align: center; padding: 2px 1px; border-radius: 0;
  -moz-appearance: textfield; appearance: textfield; }
.wk-dm-in:hover { border-color: rgba(79,227,255,0.3); }
.wk-dm-in:focus { outline: none; border-color: var(--holo); color: #fff; background: rgba(9,20,36,0.8); }
.wk-dm-cell.today .wk-dm-in { background: rgba(13,32,54,0.65); border-color: rgba(79,227,255,0.2); }
/* native spinner arrows eat ~18px from an already-narrow cell — enough to
   silently truncate a 5-digit Steps value from view. Hidden everywhere for a
   cleaner instrument read anyway; the value itself was never affected. */
input[type="number"].wk-dm-in::-webkit-outer-spin-button,
input[type="number"].wk-dm-in::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
input[type="time"].wk-dm-in { max-width: 66px; font-size: 8px; color-scheme: dark; }
.wk-yn { background: none; border: none; cursor: pointer; color: var(--holo-dim); font-size: 12px; line-height: 1; padding: 2px; }
.wk-yn.yes { color: var(--holo); text-shadow: 0 0 6px rgba(79,227,255,0.5); }
.wk-yn.no { color: var(--holo-dim); opacity: 0.5; }
.wk-dm-roll { font-family: var(--mono); font-size: 8.5px; color: var(--ghost-dim); text-align: center; white-space: nowrap; }
.wk-dm-head-row .wk-dm-roll { color: var(--holo-dim); letter-spacing: 0.1em; text-transform: uppercase; font-size: 7.5px; }
.wk-dm-goal { display: flex; justify-content: center; }
/* the only red/green-style signal in this sector. unfavorable is red
   intruding on the cyan base, same rule the rest of the app follows.
   favorable uses --flare (the hot-white-cyan already established for
   Kaniel's core and the All Sectors arc) rather than plain --holo — a goal
   you're actually hitting needs to read as distinctly lit against a screen
   where thin cyan borders are the ambient default, not just "more cyan." */
.wk-dm-goal.favorable .wk-dm-in { border-color: var(--flare); color: var(--flare);
  background: rgba(185,242,255,0.1); box-shadow: 0 0 9px rgba(185,242,255,0.55); }
.wk-dm-goal.unfavorable .wk-dm-in { border-color: var(--alarm); color: var(--alarm); box-shadow: 0 0 6px var(--alarm-glow); }

.wk-dm-band { margin-top: 6px; }
.wk-dm-band-lab { font-family: var(--mono); font-size: 7px; letter-spacing: 0.22em; color: var(--holo-dim);
  text-transform: uppercase; opacity: 0.75; padding: 5px 0 3px 2px; border-top: 1px solid rgba(79,227,255,0.08); }
.wk-dm-band:first-child .wk-dm-band-lab { border-top: none; }
.wk-dm-foot { margin-top: 8px; padding-top: 6px; border-top: 1px solid var(--panel-line);
  font-family: var(--mono); font-size: 7.5px; letter-spacing: 0.08em; color: var(--holo-dim); opacity: 0.6; text-transform: uppercase; }

/* ── weekly metrics outsourcing — passive archive ── */
.mo-tabs { margin-left: auto; display: flex; gap: 6px; }
.mo-tab { background: none; border: 1px solid var(--panel-line); color: var(--holo-dim); cursor: pointer;
  font-family: var(--mono); font-size: 9px; letter-spacing: 0.14em; text-transform: uppercase; padding: 5px 12px; }
.mo-tab:hover { color: var(--holo); border-color: var(--holo); }
.mo-tab.active { color: var(--holo); border-color: var(--holo); background: rgba(79,227,255,0.08); }
.mo-subnote { font-family: var(--mono); font-size: 8px; letter-spacing: 0.1em; color: var(--holo-dim); opacity: 0.65;
  text-transform: uppercase; margin: 10px 0 4px; }

.mo-archive { display: grid; grid-template-columns: 280px minmax(0, 1fr); gap: 12px; margin-top: 8px; align-items: start; }
.mo-weeklist { display: flex; flex-direction: column; gap: 4px; max-height: 74vh; overflow-y: auto; padding-right: 4px; }
.mo-week-row { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; text-align: left;
  background: var(--panel); border: 1px solid var(--panel-line); border-left: 2px solid transparent;
  padding: 7px 10px; cursor: pointer; font-family: var(--mono); }
.mo-week-row:hover { border-color: var(--holo-dim); }
.mo-week-row.active { border-left-color: var(--holo); background: rgba(79,227,255,0.07); }
.mo-week-row.vacant { opacity: 0.55; }
.mo-week-n { font-size: 9px; letter-spacing: 0.12em; color: var(--holo); }
.mo-week-range { font-size: 8px; letter-spacing: 0.06em; color: var(--ghost-dim); }
.mo-week-glance { display: flex; gap: 10px; margin-top: 2px; font-size: 8px; letter-spacing: 0.06em; color: var(--holo-dim); text-transform: uppercase; }
.mo-week-glance b { color: var(--ghost); font-weight: 400; }
.mo-week-tag { margin-top: 2px; font-size: 7.5px; letter-spacing: 0.12em; color: var(--holo-dim); opacity: 0.7; text-transform: uppercase; }

.mo-detail { background: var(--panel); border: 1px solid var(--panel-line); padding: 12px 14px; }
.mo-detail-head { display: flex; align-items: baseline; gap: 12px; padding-bottom: 8px; border-bottom: 1px solid var(--panel-line); margin-bottom: 4px; }
.mo-detail-wk { font-family: var(--mono); font-size: 14px; color: var(--holo); text-shadow: 0 0 10px rgba(79,227,255,0.4); }
.mo-detail-range { font-family: var(--mono); font-size: 9px; letter-spacing: 0.08em; color: var(--holo-dim); text-transform: uppercase; }
.mo-detail-band { margin-top: 8px; }
.mo-detail-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 4px 14px; }
.mo-detail-cell { display: flex; justify-content: space-between; gap: 8px; font-family: var(--mono); font-size: 9.5px;
  padding: 2px 0; border-bottom: 1px dashed rgba(79,227,255,0.08); }
.mo-detail-lab { color: var(--ghost-dim); }
.mo-detail-val { color: var(--ghost); }

.mo-trend-head { display: flex; align-items: center; gap: 12px; margin-top: 8px; flex-wrap: wrap; }
.mo-ranges { display: flex; gap: 4px; margin-left: auto; }
.mo-range-btn { background: none; border: 1px solid var(--panel-line); color: var(--holo-dim); cursor: pointer;
  font-family: var(--mono); font-size: 8.5px; letter-spacing: 0.08em; text-transform: uppercase; padding: 4px 9px; white-space: nowrap; }
.mo-range-btn:hover { color: var(--holo); border-color: var(--holo); }
.mo-range-btn.active { color: var(--holo); border-color: var(--holo); background: rgba(79,227,255,0.08); }
.mo-select { background: var(--panel); border: 1px solid var(--panel-line); color: var(--ghost);
  font-family: var(--mono); font-size: 10px; letter-spacing: 0.06em; text-transform: uppercase; padding: 5px 8px; }
.mo-trend-scroll { overflow-x: auto; margin-top: 12px; }
.mo-trend-svg { min-width: 620px; }

/* ── analysis toolkit (Build 2) ── */
.mo-submode { margin: 0 0 4px; }
.mo-analysis { margin-top: 4px; }
.mo-analysis-head { display: flex; align-items: center; gap: 12px; margin-top: 8px; flex-wrap: wrap; }
.mo-pair-picks { margin-left: auto; display: flex; align-items: center; gap: 8px; }
.mo-pair-vs { font-family: var(--mono); font-size: 8px; letter-spacing: 0.1em; color: var(--holo-dim); text-transform: uppercase; }
.mo-ma-toggle { margin-left: auto; display: flex; align-items: center; gap: 6px; font-family: var(--mono); font-size: 8.5px;
  letter-spacing: 0.08em; color: var(--holo-dim); text-transform: uppercase; cursor: pointer; white-space: nowrap; }
.mo-ma-toggle input { accent-color: var(--holo); }
.mo-scatter-svg { min-width: 620px; }
.mo-axis-labels { display: flex; justify-content: space-between; margin-top: 4px; padding: 0 4px;
  font-family: var(--mono); font-size: 7.5px; letter-spacing: 0.08em; color: var(--holo-dim); text-transform: uppercase; }
.mo-stat-row { display: flex; gap: 16px; flex-wrap: wrap; margin-top: 10px; padding-top: 8px; border-top: 1px solid var(--panel-line); }
.mo-stat { font-family: var(--mono); font-size: 9.5px; letter-spacing: 0.06em; color: var(--ghost-dim); text-transform: uppercase; }
.mo-stat b { color: var(--holo); font-weight: 400; margin-right: 3px; }
.mo-lag-compare { display: flex; align-items: baseline; gap: 10px; margin-top: 6px; flex-wrap: wrap; }
.mo-lag-val { font-family: var(--mono); font-size: 9.5px; color: var(--ghost-dim); }
.mo-lag-val b { color: var(--holo); font-weight: 400; }
.mo-lag-val b.hi { color: var(--flare); text-shadow: 0 0 6px rgba(185,242,255,0.5); }
.mo-chart-legend { display: flex; gap: 12px; margin-top: 6px; padding: 0 4px; }
.mo-legend-chip { display: flex; align-items: center; gap: 5px; font-family: var(--mono); font-size: 7.5px;
  letter-spacing: 0.08em; color: var(--holo-dim); text-transform: uppercase; }
.mo-legend-chip i { width: 10px; height: 2px; display: inline-block; }

/* ── insights ── */
.mo-insights { display: flex; flex-direction: column; gap: 10px; margin-top: 10px; }
.mo-kaniel-badge { display: flex; align-items: center; gap: 10px; }
.mo-kaniel-btn { background: rgba(9,16,30,0.72); border: 1px solid var(--panel-line); border-left: 2px solid var(--gold);
  color: var(--ghost); cursor: pointer; font-family: var(--mono); font-size: 10px; letter-spacing: 0.06em;
  text-transform: uppercase; padding: 7px 12px; }
.mo-kaniel-btn:hover { border-color: var(--gold); }
.mo-kaniel-tag { color: var(--gold); margin-right: 6px; }
.mo-kaniel-count { color: var(--holo); font-size: 13px; }
.mo-kaniel-msg { font-family: var(--mono); font-size: 8.5px; letter-spacing: 0.06em; color: var(--holo-dim); text-transform: uppercase; }
.mo-insight-panel { background: var(--panel); border: 1px solid var(--panel-line); padding: 10px 12px 12px; }
.mo-insight-row { display: flex; align-items: baseline; gap: 8px; padding: 4px 0; border-bottom: 1px dashed rgba(79,227,255,0.08); }
.mo-insight-body { flex: 1; font-family: var(--mono); font-size: 10px; color: var(--ghost); }
.mo-insight-body b { color: var(--holo); font-weight: 400; }
.mo-insight-x { background: none; border: none; color: var(--holo-dim); cursor: pointer; font-family: var(--mono);
  font-size: 9px; padding: 0 3px; opacity: 0; transition: opacity 0.15s ease; }
.mo-insight-row:hover .mo-insight-x { opacity: 0.7; }
.mo-insight-x:hover { color: var(--holo); opacity: 1; }
.mo-goalrate { margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--panel-line);
  font-family: var(--mono); font-size: 9.5px; color: var(--ghost-dim); }
.mo-goalrate b { color: var(--holo); font-weight: 400; }

@media (max-width: 900px) {
  .mo-archive { grid-template-columns: 1fr; }
  .mo-weeklist { max-height: 40vh; }
}

@media (max-width: 1240px) {
  .wk-band { grid-template-columns: 224px minmax(0, 1fr); }
  .wk-band > .wk-mod.f-spine { grid-column: 1 / -1; margin-top: 0; }
}
@media (max-width: 900px) {
  .wk-band { grid-template-columns: 1fr; }
  .wk-center { margin-top: 0; }
  .wk-theme-in { font-size: 15px; }
  .wk-gl-head, .wk-gl-row { grid-template-columns: 58px repeat(7, minmax(0, 1fr)); }
}

/* mobile */
.mobile-stack { flex: 1; display: flex; flex-direction: column; gap: 12px; overflow-y: auto; padding-bottom: 14px; }
.mobile-tiles { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; }
.mobile-sector-btn { flex: 1 1 44%; background: var(--panel); border: 1px solid var(--panel-line); color: var(--ghost);
  font-family: var(--mono); font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; padding: 10px 8px; text-align: left; cursor: pointer; }
.mobile-sector-btn.locked { opacity: 0.45; border-style: dashed; }
.mobile-sector-btn .msb-glyph { color: var(--holo); font-size: 14px; margin-right: 6px; }

/* animations */
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes spinRev { to { transform: rotate(-360deg); } }
@keyframes pulse { 0%,100% { transform: scale(1); opacity: 0.85; } 50% { transform: scale(1.16); opacity: 1; } }
@keyframes flicker { 0%,100% { opacity: 0.92; } 47% { opacity: 0.82; } 50% { opacity: 1; } 53% { opacity: 0.86; } }
@keyframes blink { 0%,60% { opacity: 1; } 61%,100% { opacity: 0; } }
@keyframes bootIn { to { opacity: 1; } }
@keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
@keyframes wobble { 0%,100% { transform: translate(0,0) rotate(0deg); } 25% { transform: translate(1.5px,-1px) rotate(0.6deg); } 50% { transform: translate(-1px,1.5px) rotate(-0.6deg); } 75% { transform: translate(1px,1px) rotate(0.4deg); } }
.fade-up { animation: fadeUp 0.55s ease forwards; }

@media (max-width: 900px) { .cockpit { display: block; } }
@media (prefers-reduced-motion: reduce) {
  .dot-live,.cmd .blink,.empty-ring,.ir-slow,.ir-rev,.ir-med,.ir-fast,.ir-ecc { animation: none !important; }
  .boot-line { opacity: 1 !important; animation: none !important; }
}
`;

// ── KANIEL CORE ──────────────────────────────────────────────
// A scattered particle field, NOT a wireframe mesh — no connecting lines or
// facets. ~1500 points fill a soft-edged spherical volume, denser toward the
// center, rotating in 3D and projected each frame. A lens-flare starburst
// (hot core + spiking rays) sits at the center. Cyan is the permanent base
// identity; red only ever bleeds IN as a per-point intrusion, never replaces it.
const K_MOOD = {
  nominal:   { breath: 4.2, red: 0.0,  flick: 0.0 },
  attentive: { breath: 2.6, red: 0.0,  flick: 0.0 },
  agitated:  { breath: 1.5, red: 0.5,  flick: 0.10 },
  critical:  { breath: 0.95, red: 0.85, flick: 0.30 },
};

// action state — transient, tied to interaction. Each gets its own motion
// signature so the difference reads even from a single still frame, not just
// over time: listening pulls the field inward and stills it (leaning in),
// replying pushes it outward and speeds it up (broadcasting), thinking keeps
// its gold tint and adds turbulence (churning).
const K_ACTION = {
  idle:      { period: 27, radiusMul: 1.00, rayMul: 1.00, wobMul: 1.0, twinkleMul: 1.0, pointMul: 1.00 },
  listening: { period: 50, radiusMul: 0.80, rayMul: 0.55, wobMul: 0.5, twinkleMul: 1.8, pointMul: 1.15 },
  replying:  { period: 9,  radiusMul: 1.22, rayMul: 1.50, wobMul: 1.6, twinkleMul: 1.2, pointMul: 1.05 },
  thinking:  { period: 16, radiusMul: 1.05, rayMul: 1.20, wobMul: 2.0, twinkleMul: 1.5, pointMul: 1.10 },
};

function KanielCore({ mood, action }) {
  const ref = useRef(null);
  const live = useRef({ mood, action });
  live.current = { mood, action };

  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // ── scattered volume fill, density falling off from center ──
    const N = 1500;
    const rnd = () => Math.random();
    const randDir = () => {
      const u = rnd() * 2 - 1, th = rnd() * Math.PI * 2, s = Math.sqrt(Math.max(0, 1 - u * u));
      return [s * Math.cos(th), u, s * Math.sin(th)];
    };

    const pts = [];
    for (let i = 0; i < N; i++) {
      const dir = randDir();
      const r = Math.pow(rnd(), 2.2) * 1.15;                 // center-biased radius
      pts.push({
        x: dir[0] * r, y: dir[1] * r, z: dir[2] * r,
        cb: 1 - Math.min(1, r),                               // center-brightness boost
        tw: rnd() * Math.PI * 2, tws: 0.6 + rnd() * 1.3,
        vein: rnd() < 0.24, base: 0.5 + rnd() * 0.5,
      });
    }

    const px = new Float32Array(N), py = new Float32Array(N), pd = new Float32Array(N), ps = new Float32Array(N);
    let w = 0, h = 0, dpr = 1, raf = 0, rot = 0, last = 0;
    const TILT = 0.38, VIEW = 3.2;

    function resize() {
      w = canvas.clientWidth; h = canvas.clientHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function draw(t) {
      const { mood: m, action: a } = live.current;
      const cfg = K_MOOD[m] || K_MOOD.nominal;
      const cx = w / 2, cy = h / 2;
      const dt = last ? Math.min(64, t - last) : 16; last = t;

      ctx.clearRect(0, 0, w, h);

      const cfgA = K_ACTION[a] || K_ACTION.idle;
      const breath = 1 + 0.045 * Math.sin((t / 1000) * (Math.PI * 2 / cfg.breath));
      const flick = cfg.flick ? 1 - cfg.flick * Math.random() * 0.55 : 1;
      const R = Math.min(w, h) * 0.315 * breath * cfgA.radiusMul;
      rot += (Math.PI * 2 / cfgA.period) * (dt / 1000);

      const thinking = a === "thinking";
      const rr = cfg.red;

      // ── starburst core: soft outer halo, spiking rays, hot inner point ──
      const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 2.3 * breath);
      if (thinking) {
        halo.addColorStop(0, `rgba(255,214,150,${0.34 * flick})`);
        halo.addColorStop(0.3, `rgba(255,190,90,${0.14 * flick})`);
      } else {
        halo.addColorStop(0, `rgba(${Math.round(160 + 95 * rr)},${Math.round(235 - 110 * rr)},255,${(0.30 + 0.05 * rr) * flick})`);
        halo.addColorStop(0.3, `rgba(${Math.round(79 + 176 * rr)},${Math.round(227 - 130 * rr)},255,${0.12 * flick})`);
      }
      halo.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = halo;
      ctx.beginPath(); ctx.arc(cx, cy, R * 2.3 * breath, 0, Math.PI * 2); ctx.fill();

      const RAYS = 8, rayRot = rot * 0.15;
      for (let i = 0; i < RAYS; i++) {
        const ang = (i / RAYS) * Math.PI * 2 + rayRot;
        const long = i % 2 === 0;
        const flicker = 0.55 + 0.45 * Math.sin(t * 0.0021 * (1 + i * 0.11) + i * 1.7);
        const len = R * (long ? 2.9 : 1.7) * cfgA.rayMul * breath * (0.85 + 0.15 * flicker);
        const halfW = (long ? 3.4 : 2.1) * flicker;
        const cxr = Math.cos(ang), cyr = Math.sin(ang);
        const nx = -cyr, ny = cxr;
        const tipx = cx + cxr * len, tipy = cy + cyr * len;
        const grad = ctx.createLinearGradient(cx, cy, tipx, tipy);
        if (thinking) {
          grad.addColorStop(0, `rgba(255,225,150,${0.55 * flicker * flick})`);
        } else {
          grad.addColorStop(0, `rgba(${Math.round(200 + 55 * rr)},${Math.round(240 - 70 * rr)},255,${0.5 * flicker * flick})`);
        }
        grad.addColorStop(1, "rgba(120,200,255,0)");
        ctx.beginPath();
        ctx.moveTo(cx + nx * halfW, cy + ny * halfW);
        ctx.lineTo(tipx, tipy);
        ctx.lineTo(cx - nx * halfW, cy - ny * halfW);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();
      }

      const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.62 * breath);
      if (thinking) {
        core.addColorStop(0, `rgba(255,250,235,${0.95 * flick})`);
        core.addColorStop(0.3, `rgba(255,214,140,${0.5 * flick})`);
      } else {
        core.addColorStop(0, `rgba(255,255,255,${0.9 * flick})`);
        core.addColorStop(0.3, `rgba(${Math.round(170 + 85 * rr)},${Math.round(232 - 110 * rr)},255,${0.45 * flick})`);
      }
      core.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = core;
      ctx.beginPath(); ctx.arc(cx, cy, R * 0.62 * breath, 0, Math.PI * 2); ctx.fill();

      // project every point, with a slow per-point radial wobble for "alive" drift
      const cR = Math.cos(rot), sR = Math.sin(rot), cT = Math.cos(TILT), sT = Math.sin(TILT);
      for (let i = 0; i < N; i++) {
        const p = pts[i];
        const wob = 1 + 0.06 * cfgA.wobMul * Math.sin(p.tw + t * 0.00075 * p.tws * cfgA.wobMul);
        const px0 = p.x * wob, py0 = p.y * wob, pz0 = p.z * wob;
        const x1 = px0 * cR + pz0 * sR;
        const z1 = -px0 * sR + pz0 * cR;
        const y2 = py0 * cT - z1 * sT;
        const z2 = py0 * sT + z1 * cT;
        const persp = VIEW / (VIEW - z2);
        px[i] = cx + x1 * R * persp;
        py[i] = cy + y2 * R * persp;
        pd[i] = (z2 + 1) / 2;            // 0 = far side, 1 = facing us
        ps[i] = persp;
      }

      // points — the whole sphere, no connecting geometry
      for (let i = 0; i < N; i++) {
        const p = pts[i], d = pd[i];
        const tw = 0.7 + 0.3 * Math.sin(p.tw * 1.3 + t * 0.0014 * p.tws * cfgA.twinkleMul);
        const dd = Math.pow(d, 1.4);
        const a2 = (0.06 + dd * 0.55 + p.cb * 0.25) * tw * p.base * flick;
        const vr = p.vein ? rr : 0;
        let col;
        if (thinking) col = `rgba(255,${Math.round(220 - 40 * (1 - d))},150,${a2})`;
        else if (vr > 0) col = `rgba(255,${Math.round(150 - 60 * vr)},${Math.round(165 - 60 * vr)},${a2 * (0.85 + vr * 0.4)})`;
        else col = `rgba(${Math.round(175 + 45 * d)},${Math.round(235 + 15 * d)},255,${a2})`;
        ctx.fillStyle = col;
        const size = (0.35 + dd * 0.9 + p.cb * 0.6) * ps[i] * p.base * cfgA.pointMul;
        ctx.beginPath(); ctx.arc(px[i], py[i], size, 0, Math.PI * 2); ctx.fill();
      }

      raf = requestAnimationFrame(draw);
    }

    resize();
    if (reduce) { last = 0; draw(0); cancelAnimationFrame(raf); }
    else raf = requestAnimationFrame(draw);
    const onR = () => { resize(); if (reduce) draw(0); };
    window.addEventListener("resize", onR);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", onR); };
  }, []);

  return <canvas ref={ref} className="k-canvas" />;
}

// ── INSTRUMENT RETICLE ───────────────────────────────────────
// Nested rings, major/minor ticks, solid + dashed arc segments and small
// embedded readouts, counter-rotating at different speeds. The sphere is
// suspended inside this. Purely decorative — sector nav arcs stay on top.
function InstrumentRing({ moodCls }) {
  const cx = 200, cy = 130;
  const arcPath = (r, a0, a1) => {
    const p0 = polarToCartesian(cx, cy, r, a1), p1 = polarToCartesian(cx, cy, r, a0);
    return `M ${p0.x} ${p0.y} A ${r} ${r} 0 ${a1 - a0 <= 180 ? "0" : "1"} 0 ${p1.x} ${p1.y}`;
  };
  const ticks = (r, count, len, majorEvery, op) =>
    Array.from({ length: count }).map((_, i) => {
      const ang = (i / count) * 360, major = i % majorEvery === 0;
      const a = polarToCartesian(cx, cy, r, ang), b = polarToCartesian(cx, cy, r + (major ? len * 1.9 : len), ang);
      return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--holo)"
        strokeWidth={major ? 0.9 : 0.45} opacity={major ? op * 2 : op} />;
    });
  const readouts = [
    { r: 104, ang: 42, txt: "48%" }, { r: 104, ang: 138, txt: "45%" },
    { r: 104, ang: 318, txt: "55.2" }, { r: 104, ang: 222, txt: "0.04" },
  ];
  return (
    <svg className={"instrument-ring " + moodCls} viewBox="0 0 400 260">
      {/* outer tick collar — slow clockwise */}
      <g className="ir-rot ir-slow">
        <circle cx={cx} cy={cy} r="112" fill="none" stroke="var(--holo)" strokeWidth="0.5" opacity="0.22" />
        {ticks(112, 72, 3, 6, 0.16)}
      </g>
      {/* dashed ring — counter-clockwise, this is the one that goes eccentric under stress */}
      <g className="ir-ecc">
        <g className="ir-rot ir-rev">
          <circle cx={cx} cy={cy} r="100" fill="none" stroke="var(--holo-deep)" strokeWidth="0.7"
            opacity="0.4" strokeDasharray="5 7" />
          <path d={arcPath(100, 8, 62)} fill="none" stroke="var(--holo)" strokeWidth="2.2" opacity="0.55" strokeLinecap="round" />
          <path d={arcPath(100, 190, 232)} fill="none" stroke="var(--holo)" strokeWidth="2.2" opacity="0.4" strokeLinecap="round" />
        </g>
      </g>
      {/* mid segment ring — medium clockwise */}
      <g className="ir-rot ir-med">
        <circle cx={cx} cy={cy} r="90" fill="none" stroke="var(--holo)" strokeWidth="0.4" opacity="0.16" />
        <path d={arcPath(90, 100, 168)} fill="none" stroke="var(--holo)" strokeWidth="1.6" opacity="0.5" />
        <path d={arcPath(90, 270, 300)} fill="none" stroke="var(--flare)" strokeWidth="1.2" opacity="0.45" />
        <path d={arcPath(90, 320, 344)} fill="none" stroke="var(--holo-deep)" strokeWidth="1.2" opacity="0.5" strokeDasharray="2 3" />
      </g>
      {/* inner collar — fast counter-clockwise, hugs the sphere */}
      <g className="ir-rot ir-fast">
        <circle cx={cx} cy={cy} r="78" fill="none" stroke="var(--holo-deep)" strokeWidth="0.5" opacity="0.3" />
        {ticks(78, 36, 2.5, 9, 0.14)}
        <path d={arcPath(78, 214, 262)} fill="none" stroke="var(--holo)" strokeWidth="1.4" opacity="0.4" />
      </g>
      {/* static embedded readouts */}
      {readouts.map((r, i) => {
        const p = polarToCartesian(cx, cy, r.r, r.ang);
        return <text key={i} className="ir-readout" x={p.x} y={p.y} textAnchor="middle" opacity="0.5">{r.txt}</text>;
      })}
    </svg>
  );
}

function Starfield() {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0, h = 0, dpr = Math.min(window.devicePixelRatio || 1, 2), pts = [], raf = 0;
    const nebulae = [
      { x: 0.24, y: 0.28, r: 0.6, c: "rgba(31,143,224,0.11)" }, { x: 0.78, y: 0.66, r: 0.55, c: "rgba(79,227,255,0.08)" },
      { x: 0.55, y: 0.12, r: 0.45, c: "rgba(123,108,255,0.07)" }, { x: 0.15, y: 0.8, r: 0.4, c: "rgba(79,227,255,0.05)" },
    ];
    function resize() {
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = w * dpr; canvas.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.min(560, Math.floor((w * h) / 2600));
      const clusters = Array.from({ length: 6 }, () => ({ cx: Math.random() * w, cy: Math.random() * h, r: (Math.random() * 0.16 + 0.06) * Math.max(w, h) }));
      pts = [];
      for (let i = 0; i < count; i++) {
        let x, y;
        if (Math.random() < 0.58) {
          const c = clusters[(Math.random() * clusters.length) | 0];
          const ang = Math.random() * Math.PI * 2, rad = Math.pow(Math.random(), 2.2) * c.r;
          x = ((c.cx + Math.cos(ang) * rad) % w + w) % w; y = ((c.cy + Math.sin(ang) * rad) % h + h) % h;
        } else { x = Math.random() * w; y = Math.random() * h; }
        const near = Math.random() > 0.72;
        pts.push({ x, y, z: near ? Math.random() * 0.5 + 0.5 : Math.random() * 0.4 + 0.1,
          s: near ? Math.random() * 1.5 + 0.6 : Math.random() * 0.9 + 0.14, tw: Math.random() * Math.PI * 2, glint: Math.random() > 0.94 });
      }
    }
    function haze() {
      nebulae.forEach(n => {
        const g = ctx.createRadialGradient(n.x*w, n.y*h, 0, n.x*w, n.y*h, n.r*Math.max(w,h));
        g.addColorStop(0, n.c); g.addColorStop(1, "transparent"); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      });
    }
    function frame(t) {
      ctx.clearRect(0, 0, w, h); haze();
      for (const p of pts) {
        p.x += p.z * 0.13; if (p.x > w + 2) p.x = -2;
        const tw = 0.55 + 0.45 * Math.sin(p.tw + t * 0.0013);
        ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, Math.PI*2);
        ctx.fillStyle = `rgba(${p.glint?"200,240,255":"190,232,255"},${(0.12 + p.z*0.7)*tw})`; ctx.fill();
        if (p.glint && p.s > 1) {
          ctx.strokeStyle = `rgba(200,240,255,${0.14*tw})`; ctx.lineWidth = 0.5;
          ctx.beginPath(); ctx.moveTo(p.x-p.s*2.4,p.y); ctx.lineTo(p.x+p.s*2.4,p.y);
          ctx.moveTo(p.x,p.y-p.s*2.4); ctx.lineTo(p.x,p.y+p.s*2.4); ctx.stroke();
        }
      }
      raf = requestAnimationFrame(frame);
    }
    function still() {
      ctx.clearRect(0,0,w,h); haze();
      for (const p of pts) { ctx.beginPath(); ctx.arc(p.x,p.y,p.s,0,Math.PI*2); ctx.fillStyle = `rgba(190,232,255,${0.12+p.z*0.5})`; ctx.fill(); }
    }
    resize();
    if (reduce) still(); else raf = requestAnimationFrame(frame);
    const onR = () => { resize(); if (reduce) still(); };
    window.addEventListener("resize", onR);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", onR); };
  }, []);
  return <canvas ref={ref} className="grid-canvas" />;
}

function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(id); }, []);
  return now;
}
function useIsMobile() {
  const [m, setM] = useState(typeof window !== "undefined" && window.innerWidth < 900);
  useEffect(() => { const f = () => setM(window.innerWidth < 900); window.addEventListener("resize", f); return () => window.removeEventListener("resize", f); }, []);
  return m;
}

// ── mock data ──
const PINNED_SECTORS = [
  // geometric marks only — emoji read as consumer-app chrome against the
  // cockpit type, and don't sit on the mono baseline
  { key: "projects", label: "Project Tracker", glyph: "◆", locked: false },
  { key: "budget", label: "Budget", glyph: "◈", locked: false },
  { key: "weekly", label: "Weekly Overview", glyph: "▦", locked: false },
  { key: "health", label: "HealthFitness", glyph: "▲", locked: true },
  { key: "habits", label: "HabitsRoutines", glyph: "◉", locked: true },
  // swapped in for Travel Log — see docs/specs/DAILY_OVERVIEW_SPEC.md. Travel Log drops to
  // All-Sectors-grid-only, same non-pinned treatment as Metrics Outsourcing.
  { key: "dailyOverview", label: "Daily Overview", glyph: "◐", locked: false },
];

// real sheet names from LIFE2.xlsx — names only, no values pulled in
const ALL_SECTORS_RAW = [
  "DashboardKPIs🧭","Metrics📊","Life Goals🎯","Vision Board🖼️","Rulebook📜","Weekly Overview🗓️",
  "Weekly Metrics Outsourcing🔁","Daily Overview🌇","Action Items✅","Decision Journal🪞","Budget💰",
  "Investment Portfolio📈","Income Streams💵","Work Portfolio💼","Networking🤝","Scholarships🎓","Links⛓️",
  "HabitsRoutines🔁","Meal Plan🍎","Contact Tracker📲","HealthFitness🏋️","Reading Log📚","Quotes💬",
  "Learning Matrix🎓","Skills Matrix🧩","Spirituality✝️","Gratitude🙏","Time Audit⏱️","Travel Log✈️",
  "Bucket List🪣","Birthdays🎂","Study Abroad Flight Checker🇯🇴","Car Maintenance🚗","Language Study Plan🇲🇦",
];
const EMOJI_RE = /\p{Emoji_Presentation}|\p{Extended_Pictographic}/gu;
const ALL_SECTORS = [
  { key: "projects", label: "Project Tracker", glyph: "◆", locked: false },
  // the sheet names carry emoji; they're stripped for the label and never used
  // as glyphs — locked stubs get a neutral mark, live sectors get their own
  ...ALL_SECTORS_RAW.map((raw, i) => {
    // EMOJI_RE leaves variation selectors / joiners behind (e.g. a trailing U+FE0F),
    // which silently broke the exact-label matches below — strip them too
    const label = raw.replace(EMOJI_RE, "").replace(/[\uFE0E\uFE0F\u200D]/g, "").trim();
    // live sectors route to their real screen, not a locked sheet stub
    if (label === "Budget") return { key: "budget", label, glyph: "◈", locked: false };
    if (label === "Weekly Overview") return { key: "weekly", label, glyph: "▦", locked: false };
    // Passive archive for Weekly Overview's closed weeks — deliberately NOT
    // pinned on the center dial (see docs/specs/WEEKLY_METRICS_OUTSOURCING_SPEC.md); it
    // only ever lives here, in the full sector list.
    if (label === "Weekly Metrics Outsourcing") return { key: "metricsOutsourcing", label, glyph: "▥", locked: false };
    // pinned on the dial in Daily Overview's place — see docs/specs/DAILY_OVERVIEW_SPEC.md
    if (label === "Daily Overview") return { key: "dailyOverview", label, glyph: "◐", locked: false };
    // Not pinned — reachable only from the All Sectors grid, same treatment
    // as Weekly Metrics Outsourcing (see docs/specs/CONTACT_TRACKER_SPEC.md).
    if (label === "Contact Tracker") return { key: "contactTracker", label, glyph: "◫", locked: false };
    // Not pinned — reachable only from the All Sectors grid, by explicit task
    // instruction (see docs/specs/LIFE_GOALS_SPEC.md). ◎ was unused.
    if (label === "Life Goals") return { key: "lifeGoals", label, glyph: "◎", locked: false };
    return { key: "sheet_" + i, label, glyph: "▫", locked: true };
  }),
];
const LIVE_SECTOR_COUNT = ALL_SECTORS.filter(s => !s.locked).length;

// Placeholder KPI tiles were removed here — their structure was invented, not
// just their numbers. The tile field is now built only from sectors that
// actually produce data (see budgetTiles in App). Retired definitions are
// parked in _retiredTiles.js for reference.
const STALEST = [
  { name: "Year 31 — outline", days: 19, alarm: true }, { name: "Website redesign", days: 12, alarm: true },
  { name: "Garage cleanout", days: 6, alarm: false }, { name: "Read: Antifragile", days: 4, alarm: false },
];
const RECENT_ADDS = [
  { name: "Q3 budget review", days: 0, alarm: false }, { name: "Dentist follow-up", days: 1, alarm: false },
  { name: "Trip: Denver", days: 2, alarm: false }, { name: "New habit: cold plunge", days: 3, alarm: false },
];
const STREAKS = [
  { name: "Gratitude", days: 31, alarm: false }, { name: "Workout", days: 14, alarm: false },
  { name: "Reading", days: 6, alarm: false }, { name: "Meditation", days: 2, alarm: true },
];
const SPARK_POINTS = [4,6,5,8,7,9,11,10,13,12,15,14];

// stylized dot-matrix world map — hand-authored continent approximation, not literal coastline data
const WORLD_POINTS = [[5.19,5.49],[5.42,6.22],[5.4,6.92],[5.14,7.85],[5.6,8.77],[6.38,4.77],[6.24,5.69],[6.52,6.17],[6.07,7.09],[6.35,9.08],[6.33,9.64],[6.12,10.91],[6.19,11.75],[6.18,12.78],[6.34,14.42],[7.49,6.07],[7.35,6.99],[6.92,8.2],[7.43,9.79],[7.25,11.67],[7.3,14.14],[8.03,5.5],[8.08,6.1],[7.84,7.36],[7.95,8.03],[8.07,9.93],[8.05,13.42],[7.91,16.04],[8.09,17.15],[8.7,3.55],[9.04,4.77],[9.07,6.41],[9.24,7.37],[8.94,9.66],[8.74,11.53],[8.9,12.33],[8.79,13.26],[8.72,14.62],[8.79,15.15],[8.92,15.97],[9.89,3.35],[9.81,4.36],[9.61,6.57],[9.69,7.23],[9.92,8.39],[9.82,10.6],[10.07,12.5],[10.09,13.79],[9.91,17.91],[10.52,4.37],[10.92,5.67],[11.06,6.59],[10.63,7.94],[10.62,9.07],[10.89,11.88],[10.9,12.85],[10.61,15.47],[10.98,16.48],[10.74,17.37],[10.58,18.69],[11.9,6.59],[11.73,7.88],[11.98,9.09],[11.96,9.86],[11.55,12.48],[11.75,13.36],[11.48,14.65],[11.67,15.35],[11.95,17.1],[11.71,17.71],[11.51,18.6],[11.68,20.84],[12.5,5.41],[12.77,6.06],[12.45,7.07],[12.64,9.16],[12.67,10.8],[12.72,11.67],[12.59,12.86],[12.64,16.47],[12.37,17.97],[12.44,18.64],[13.63,5.5],[13.73,6.58],[13.77,7.14],[13.79,8.3],[13.46,9.01],[13.32,9.79],[13.53,11.66],[13.4,12.67],[13.24,13.79],[13.36,15.92],[13.28,17.95],[13.29,20.95],[13.62,21.35],[14.51,5.36],[14.66,6.38],[14.61,7.84],[14.3,9.93],[14.18,11.72],[14.17,12.4],[14.22,13.39],[14.56,14.27],[14.21,15.21],[14.25,15.91],[14.21,17.98],[14.59,19.76],[14.6,20.64],[14.51,21.89],[15.5,5.52],[15.21,6.93],[15.04,8.24],[15.1,8.75],[15.15,12.48],[15.09,13.47],[15.58,14.68],[15.15,15.58],[15.21,15.9],[15.28,17.1],[15.3,17.7],[15.05,18.84],[15.01,19.68],[15.35,20.72],[16.1,9.29],[16.33,9.99],[16.4,11.04],[16.21,14.4],[16.44,18.11],[15.92,24.98],[15.96,26.3],[16.28,27.08],[15.9,28.98],[16.22,30.7],[16.34,31.35],[16.06,32.54],[16.34,33.59],[17.03,5.39],[17.19,7.85],[16.95,9.15],[17.14,9.61],[16.96,10.9],[17.11,13.48],[16.87,14.64],[17.39,15.56],[17.08,16.39],[16.96,17.83],[17.15,23.19],[17.37,24.08],[17.33,26.22],[17.34,26.99],[16.8,27.9],[16.98,28.58],[16.99,29.9],[17.25,30.8],[17.36,31.63],[17.02,33.24],[17.02,35.06],[17.73,5.16],[18.26,7.05],[18.01,7.91],[18.27,9.23],[18.13,13.23],[18.15,15.39],[17.73,16.46],[17.98,17.01],[18.14,18.29],[18.09,21.48],[17.94,22.3],[17.82,23.64],[17.83,24.54],[17.78,25.92],[17.91,26.75],[17.86,27.94],[17.95,30.61],[17.9,31.24],[18.28,32.18],[18.08,33.52],[17.86,34.05],[17.97,35.37],[18.62,6.43],[18.95,7.8],[19.16,9.2],[18.67,11.49],[19.01,12.86],[18.93,15.92],[19.15,18.09],[18.68,21.45],[18.64,24.31],[18.83,25.03],[18.61,25.98],[19.18,27.09],[18.74,28.65],[18.61,31.5],[18.75,33.4],[18.62,35.0],[19.01,35.82],[19.62,5.68],[19.99,6.14],[19.96,7.08],[19.61,8.83],[19.9,10.17],[19.74,10.63],[19.53,12.34],[20.04,13.73],[19.61,17.36],[19.9,21.53],[19.7,22.3],[19.67,23.31],[20.08,25.02],[19.99,26.29],[19.53,26.98],[20.05,27.72],[20.04,28.52],[19.99,29.86],[19.52,30.34],[19.95,32.64],[19.66,33.57],[19.66,34.33],[19.67,34.8],[20.54,6.29],[20.55,8.96],[20.96,9.71],[20.6,14.29],[20.87,15.05],[20.85,16.05],[20.42,20.73],[20.99,21.83],[20.45,23.16],[20.83,24.27],[20.65,25.27],[20.9,29.58],[20.62,30.74],[20.55,31.35],[20.93,32.45],[20.64,33.6],[20.54,34.39],[20.68,37.09],[21.48,6.07],[21.88,7.25],[21.82,8.97],[21.77,10.17],[21.66,10.87],[21.52,11.48],[21.45,12.66],[21.31,14.3],[21.49,21.42],[21.34,23.16],[21.63,24.38],[21.4,25.32],[21.47,25.98],[21.64,27.81],[21.82,29.1],[21.42,29.84],[21.3,30.84],[21.79,31.44],[21.4,33.01],[21.68,34.45],[21.67,35.02],[21.39,35.87],[21.86,36.67],[22.68,4.78],[22.28,5.67],[22.23,7.46],[22.74,22.57],[22.67,24.13],[22.71,25.4],[22.33,26.04],[22.43,26.77],[22.63,28.14],[22.54,28.95],[22.7,29.47],[22.53,30.68],[22.45,31.55],[22.6,32.37],[22.21,33.37],[22.34,34.36],[22.31,35.98],[23.18,4.46],[23.37,5.41],[23.48,6.05],[23.13,25.2],[23.67,25.88],[23.69,30.6],[23.57,33.56],[23.31,34.35],[24.54,5.26],[24.3,27.25],[24.16,27.9],[24.02,28.61],[24.56,29.81],[24.47,31.27],[26.18,8.92],[27.05,9.23],[27.3,9.98],[27.18,10.66],[26.92,12.76],[26.81,19.95],[27.19,20.55],[27.1,23.29],[26.72,24.09],[26.96,25.21],[26.84,27.09],[26.7,27.81],[26.91,28.63],[27.95,8.82],[27.68,11.06],[27.69,11.46],[27.76,18.61],[27.81,20.79],[28.16,21.74],[28.14,22.23],[27.84,23.24],[28.07,24.01],[28.16,24.99],[27.96,26.1],[27.79,28.68],[28.13,29.87],[29.01,9.15],[28.95,9.87],[28.56,10.64],[28.7,11.85],[28.83,16.16],[28.66,18.09],[29.03,19.51],[28.64,20.85],[29.03,23.3],[29.04,24.38],[29.0,28.02],[28.93,29.74],[28.63,30.67],[29.05,31.29],[29.46,9.26],[29.49,9.62],[29.82,10.88],[29.75,13.42],[29.92,17.35],[29.52,18.67],[29.91,19.99],[29.46,23.16],[29.59,25.15],[29.55,25.97],[29.59,28.18],[29.91,28.87],[29.65,29.66],[29.82,31.52],[29.92,32.15],[30.3,9.72],[30.59,12.59],[30.6,14.31],[30.87,16.07],[30.72,17.1],[30.68,17.75],[30.54,22.44],[30.83,24.02],[30.46,25.44],[30.53,26.33],[30.58,27.02],[30.5,30.39],[31.46,10.06],[31.28,10.78],[31.31,12.48],[31.29,15.15],[31.51,16.0],[31.31,17.39],[31.78,18.66],[31.79,19.98],[31.32,21.68],[31.32,22.43],[31.44,23.57],[31.58,25.18],[31.56,26.04],[31.54,28.95],[31.34,29.83],[32.29,11.78],[32.35,12.77],[32.35,16.17],[32.51,18.26],[32.49,19.07],[32.39,20.08],[32.43,20.5],[32.16,23.44],[32.53,24.31],[32.35,27.27],[32.51,27.84],[32.69,29.61],[32.26,30.54],[32.35,31.45],[32.26,33.13],[33.13,12.78],[33.13,15.08],[33.34,18.74],[33.38,20.89],[33.18,22.53],[33.5,23.31],[33.23,25.05],[33.11,25.8],[33.15,27.78],[33.26,28.88],[33.56,30.81],[33.5,31.74],[34.4,15.38],[33.91,16.47],[33.96,17.79],[34.37,18.81],[34.44,19.98],[34.43,20.77],[34.32,26.12],[34.43,27.93],[34.04,28.58],[33.94,29.68],[34.19,30.6],[34.42,31.2],[35.14,16.3],[35.05,18.28],[35.18,18.98],[35.17,19.91],[35.39,21.61],[35.34,22.22],[35.32,25.12],[35.12,26.26],[35.06,26.95],[35.3,27.78],[35.1,29.56],[35.38,30.69],[35.89,17.88],[36.08,19.07],[36.13,20.03],[35.73,20.58],[35.81,21.85],[36.09,22.67],[36.07,24.38],[36.11,25.93],[36.16,27.66],[35.72,28.96],[37.09,19.97],[36.75,20.58],[36.79,21.56],[36.94,24.02],[37.09,25.25],[36.61,26.93],[37.16,28.19],[36.85,28.56],[40.29,11.41],[40.61,12.37],[40.72,14.18],[40.63,15.15],[41.13,11.86],[41.48,15.43],[41.66,16.05],[42.01,11.79],[42.19,13.64],[42.52,14.39],[42.22,15.34],[42.41,15.99],[43.29,9.08],[43.13,10.07],[43.08,12.34],[43.26,16.49],[43.09,17.96],[43.31,19.86],[43.8,9.76],[44.15,10.99],[44.3,12.79],[43.96,14.61],[43.85,18.03],[44.25,20.06],[44.16,20.81],[43.92,21.45],[44.75,9.18],[45.05,11.04],[44.99,12.65],[44.82,13.31],[45.04,15.24],[44.79,15.93],[44.76,18.08],[45.06,19.71],[44.71,20.42],[45.94,7.96],[46.17,10.06],[45.62,12.42],[45.65,13.23],[46.12,14.37],[45.96,17.04],[46.18,17.85],[45.98,19.17],[45.87,20.5],[45.62,23.25],[47.04,7.44],[46.97,9.13],[46.59,11.85],[46.85,14.55],[46.69,15.15],[46.79,16.0],[46.59,17.21],[46.93,17.82],[47.06,18.73],[46.77,22.26],[47.6,9.19],[47.78,9.69],[47.43,10.93],[47.49,11.92],[47.65,12.39],[47.9,13.4],[47.69,14.29],[47.99,15.93],[47.69,18.77],[47.52,19.72],[47.57,23.64],[48.74,7.08],[48.78,8.9],[48.3,10.1],[48.41,10.76],[48.64,12.38],[48.76,13.63],[48.35,14.15],[48.6,15.16],[48.67,16.32],[48.42,17.74],[48.73,19.53],[48.81,21.82],[48.31,22.75],[48.82,23.26],[49.7,7.12],[49.42,8.16],[49.51,8.97],[49.27,10.03],[49.63,12.53],[49.72,14.67],[49.51,15.32],[49.21,16.48],[49.31,16.86],[49.69,17.72],[49.62,18.72],[49.56,19.85],[49.62,20.46],[49.27,23.4],[50.27,6.97],[50.18,8.16],[50.44,10.05],[50.6,11.06],[50.35,11.9],[50.34,12.86],[50.24,14.3],[50.69,15.48],[50.41,19.17],[50.35,20.78],[50.42,21.34],[50.4,22.21],[51.58,6.47],[51.38,11.56],[51.33,13.75],[51.31,15.26],[51.18,17.19],[51.36,18.27],[51.16,18.88],[51.09,19.57],[51.18,20.64],[51.15,21.35],[52.4,6.37],[52.29,7.02],[52.23,9.07],[52.09,9.75],[52.21,10.73],[51.91,11.61],[52.23,13.49],[52.49,14.28],[51.94,16.42],[51.94,17.03],[52.34,17.77],[52.48,19.04],[52.1,19.71],[53.31,6.49],[53.24,7.35],[53.27,9.13],[53.32,10.5],[53.1,12.88],[53.05,13.67],[53.03,15.27],[53.23,16.08],[53.13,17.03],[53.27,18.21],[53.07,18.71],[52.89,19.85],[52.85,20.95],[54.21,6.5],[53.96,8.35],[53.73,9.04],[54.25,10.06],[54.3,10.81],[54.11,11.63],[54.06,12.51],[53.76,15.22],[54.04,16.24],[53.96,18.97],[54.02,20.89],[54.79,6.59],[54.67,8.34],[54.69,12.47],[54.9,13.31],[54.98,14.46],[55.2,15.38],[54.85,16.37],[55.01,16.8],[55.11,18.05],[54.9,19.83],[54.99,20.72],[55.75,6.97],[55.96,7.86],[55.6,9.01],[55.98,10.54],[55.96,11.59],[55.6,13.36],[56.04,14.45],[55.77,15.23],[56.03,16.25],[55.87,17.85],[56.06,19.11],[56.04,19.99],[55.86,20.98],[56.97,6.15],[56.83,7.03],[56.93,8.09],[56.5,9.82],[56.98,10.67],[56.47,11.72],[56.64,12.34],[56.9,13.41],[56.51,14.27],[56.42,15.4],[56.49,16.32],[56.56,17.3],[56.67,18.2],[56.61,19.93],[56.98,20.52],[57.44,7.17],[57.72,7.96],[57.52,9.75],[57.43,11.02],[57.61,11.73],[57.76,12.53],[57.49,14.33],[57.41,15.51],[57.7,15.97],[57.52,17.1],[57.34,17.89],[57.38,19.03],[57.54,20.05],[58.37,7.82],[58.45,10.9],[58.71,12.51],[58.27,14.65],[58.22,16.9],[58.38,17.93],[58.39,18.98],[58.7,19.84],[59.36,7.31],[59.1,8.3],[59.13,10.11],[59.13,10.65],[59.57,11.53],[59.52,14.34],[59.15,17.37],[59.66,18.11],[60.03,8.22],[60.31,9.26],[60.46,9.63],[60.33,12.88],[60.15,14.14],[60.25,15.12],[60.08,16.32],[60.15,18.01],[60.56,18.81],[60.53,19.59],[60.2,20.89],[60.46,21.4],[61.18,7.36],[61.07,8.92],[60.94,9.77],[61.32,10.77],[61.09,11.68],[61.0,12.34],[61.5,13.65],[61.33,14.69],[60.97,15.29],[61.01,16.23],[61.45,17.19],[61.05,20.48],[61.36,21.8],[61.01,22.58],[62.27,8.3],[61.91,10.1],[62.02,10.83],[62.3,11.54],[62.14,12.68],[62.1,16.89],[62.15,17.75],[62.07,20.08],[61.82,20.66],[62.23,21.3],[62.87,8.2],[62.95,8.9],[63.1,10.1],[62.88,11.67],[62.91,12.42],[62.89,13.48],[63.19,18.64],[62.88,20.74],[63.09,22.38],[63.23,23.12],[64.01,8.07],[64.0,8.92],[63.85,9.92],[63.84,10.57],[64.13,11.73],[64.12,12.45],[63.92,13.35],[63.93,14.24],[63.67,15.31],[63.65,16.14],[63.86,17.32],[64.03,18.15],[64.19,19.03],[64.1,19.74],[64.18,20.74],[64.07,22.23],[63.82,23.11],[63.73,32.28],[64.13,34.27],[65.05,8.32],[64.95,8.9],[64.72,12.74],[64.86,15.06],[64.98,15.97],[64.62,18.87],[64.57,20.41],[64.98,21.41],[64.67,22.61],[64.59,23.63],[64.91,31.68],[64.71,33.09],[65.02,34.38],[64.61,35.29],[65.69,8.79],[65.92,10.87],[65.6,11.53],[65.43,13.3],[65.68,14.45],[65.61,15.0],[65.6,15.91],[65.99,16.83],[65.8,17.86],[65.7,18.76],[65.72,20.07],[65.74,21.76],[65.57,34.38],[66.76,10.04],[66.68,10.71],[66.54,11.44],[66.49,12.89],[66.52,13.35],[66.51,14.18],[66.82,15.27],[66.64,16.08],[66.34,16.98],[66.74,18.03],[66.85,31.55],[66.41,32.45],[66.76,34.16],[66.59,36.24],[67.35,9.61],[67.36,10.92],[67.44,11.52],[67.72,12.69],[67.64,13.78],[67.25,14.59],[67.28,16.01],[67.73,17.18],[67.4,31.65],[67.61,33.2],[67.45,33.93],[67.5,36.06],[68.38,9.61],[68.69,11.43],[68.53,12.5],[68.19,13.29],[68.59,15.25],[68.45,16.23],[68.3,30.74],[68.53,31.66],[68.56,33.59],[68.27,34.21],[68.11,35.99],[69.59,12.44],[69.02,14.18],[69.3,15.33],[69.56,16.12],[69.11,30.74],[69.02,32.57],[69.59,33.3],[69.48,35.08],[69.54,35.76],[70.29,13.44],[70.24,31.45],[70.05,34.96],[70.04,35.82],[71.4,33.13],[70.89,34.42],[72.15,32.59],[71.9,33.29],[72.11,35.16]];
const TRAVEL_PINS = [
  { x: 16, y: 13, visited: true }, { x: 27, y: 10, visited: true }, { x: 28, y: 17, visited: true },
  { x: 70, y: 14, visited: true }, { x: 46, y: 20, visited: false }, { x: 70, y: 35, visited: false },
];

const MOOD_META = {
  nominal: { label: "nominal", cls: "" }, attentive: { label: "attentive", cls: "attentive" },
  agitated: { label: "agitated", cls: "agitated" }, critical: { label: "critical", cls: "critical" },
};
const MOOD_CYCLE = ["nominal", "attentive", "agitated", "critical"];
const ACTION_META = {
  idle: { label: "idle", cls: "idle" }, listening: { label: "listening", cls: "listening" },
  replying: { label: "replying", cls: "replying" }, thinking: { label: "thinking", cls: "thinking" },
};
const ACTION_CYCLE = ["idle", "listening", "replying", "thinking"];

const BOOT_LINES = [
  ["initializing grid core", "ok"], ["mounting sectors · pinned 5 / 35", "ok"],
  ["linking kaniel intelligence core", "ok"], ["calibrating mood + action engine", "ok"], ["grid online", "◆"],
];

// ── widgets ──
function ArcGauge({ value, size = 74, label, alarm, display, valueSize = 14 }) {
  const r = size / 2 - 6, c = size / 2, circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value)), dash = (pct / 100) * circ;
  const color = alarm ? "var(--alarm)" : "var(--holo)";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={c} cy={c} r={r} fill="none" stroke="rgba(79,227,255,0.15)" strokeWidth="4" />
        <circle cx={c} cy={c} r={r} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`} transform={`rotate(-90 ${c} ${c})`} />
        {/* display overrides the default rounded-percent readout — used to
            show a real fraction (e.g. "8/12") instead of a computed percent */}
        <text x={c} y={c + valueSize / 3.2} textAnchor="middle" fontFamily="var(--mono)" fontSize={valueSize} fill={color}>
          {display != null ? display : Math.round(pct)}
        </text>
      </svg>
      {label && <div style={{ fontFamily: "var(--mono)", fontSize: 7.5, letterSpacing: "0.1em", color: "var(--holo-dim)", textTransform: "uppercase" }}>{label}</div>}
    </div>
  );
}
function Sparkline({ points, alarm, w = 150, h = 32 }) {
  if (points.length < 2) return <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}><line x1="0" x2={w} y1={h / 2} y2={h / 2} stroke="var(--holo-dim)" strokeWidth="1" strokeDasharray="2 3" opacity="0.5" /></svg>;
  const max = Math.max(...points), min = Math.min(...points);
  const norm = points.map((p, i) => `${(i / (points.length - 1)) * w},${h - ((p - min) / (max - min || 1)) * (h - 4) - 2}`).join(" ");
  return <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}><polyline points={norm} fill="none" stroke={alarm ? "var(--alarm)" : "var(--holo)"} strokeWidth="1.3" opacity="0.85" /></svg>;
}

// Money that stays masked until hovered. Deliberately hover-only: the tiles it
// sits in already use click to open their modal, so a click-to-reveal would
// fight that. Touch devices therefore can't reveal — figures stay masked on
// mobile, which is the safe direction to fail.
function Masked({ value }) {
  const [shown, setShown] = useState(false);
  return (
    <span className="mt-masked" title="hover to reveal"
      onMouseEnter={() => setShown(true)} onMouseLeave={() => setShown(false)}>
      {shown ? fmtMoney(value) : maskMoney(value)}
    </span>
  );
}

// Segmented ring gauge in the reference-03 instrument idiom: discrete radial
// ticks rather than a smooth arc, with static threshold marks so you can see
// how close a value sits to tripping a flag. Sweeps 280° with a gap at the
// bottom, like the reference's circular readouts.
function SegmentRing({ pct, size = 82, state = "ok", thresholds = [75, 100] }) {
  const segs = 32, sweep = 280, start = 130;
  const cx = size / 2, cy = size / 2;
  const rOut = size / 2 - 2, rIn = rOut - 8;
  const clamped = Math.max(0, Math.min(100, pct));
  const lit = Math.round((clamped / 100) * segs);
  const color = state === "over" ? "var(--alarm)" : state === "warn" ? "var(--gold)" : "var(--holo)";
  const pt = (deg, r) => [cx + r * Math.cos(deg * Math.PI / 180), cy + r * Math.sin(deg * Math.PI / 180)];

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {Array.from({ length: segs }).map((_, i) => {
        const deg = start + (i / (segs - 1)) * sweep;
        const [x1, y1] = pt(deg, rIn), [x2, y2] = pt(deg, rOut);
        const on = i < lit;
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={on ? color : "var(--holo-dim)"}
          strokeWidth="2.4" opacity={on ? 0.55 + 0.45 * (i / Math.max(1, lit - 1)) : 0.14} strokeLinecap="butt" />;
      })}
      {thresholds.map((t, i) => {
        const deg = start + (t / 100) * sweep;
        const [x1, y1] = pt(deg, rIn - 3.5), [x2, y2] = pt(deg, rOut + 1.5);
        return <line key={"t" + i} x1={x1} y1={y1} x2={x2} y2={y2}
          stroke={t >= 100 ? "var(--alarm)" : "var(--gold)"} strokeWidth="1" opacity="0.85" />;
      })}
      <text x={cx} y={cy + 1} textAnchor="middle" className="ring-val" fill={color}>{Math.round(pct)}</text>
      <text x={cx} y={cy + 11} textAnchor="middle" className="ring-pct">%</text>
    </svg>
  );
}

const MONTH_ABBR = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
const monthAbbr = (m) => MONTH_ABBR[parseInt(String(m).split("-")[1], 10) - 1] || m;
// round an axis bound up to a clean number so gridline labels read evenly
function niceBound(v) {
  if (!(v > 0)) return 1;
  const target = v * 1.12;
  const step = Math.pow(10, Math.floor(Math.log10(target))) / 2;
  return Math.ceil(target / step) * step;
}

// Signed bar chart in the reference-03 instrument idiom: framed plot with a
// header, labelled gridlines, an emphasised zero baseline (needed here because
// In/Out is signed, unlike the reference's all-positive bars), segmented bar
// fill, bright tip caps, and a label under every column.
function InOutChart({ series }) {
  if (!series.length) return <div className="bz-empty" style={{ padding: "38px 0", textAlign: "center" }}>no months closed yet</div>;
  const w = 272, h = 124;
  const padL = 40, padR = 8, padT = 7, padB = 17;
  const plotW = w - padL - padR, plotH = h - padT - padB;
  const bound = niceBound(Math.max(...series.map(s => Math.abs(s.value)), 1));
  const zeroY = padT + plotH / 2;
  const yOf = (v) => zeroY - (v / bound) * (plotH / 2);
  const colW = plotW / series.length;
  const barW = Math.min(34, colW * 0.62);
  const segH = 3.5, segGap = 1.8;

  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`}>
      {[bound, bound / 2, 0, -bound / 2, -bound].map((t, i) => {
        const y = yOf(t), zero = t === 0;
        return (
          <g key={i}>
            <line x1={padL} y1={y} x2={w - padR} y2={y}
              stroke={zero ? "var(--holo)" : "var(--holo-dim)"}
              strokeWidth={zero ? 0.9 : 0.5} opacity={zero ? 0.5 : 0.16}
              strokeDasharray={zero ? "none" : "2 3"} />
            <text x={padL - 5} y={y + 2.4} textAnchor="end" className="iox-axis">
              {t === 0 ? "0" : (t > 0 ? "+" : "−") + Math.abs(t)}
            </text>
          </g>
        );
      })}
      <line x1={padL} y1={padT} x2={padL} y2={padT + plotH} stroke="var(--holo-dim)" strokeWidth="0.6" opacity="0.3" />
      {series.map((s, i) => {
        const cx = padL + colW * (i + 0.5);
        const neg = s.value < 0;
        const tipY = yOf(s.value);
        const mag = Math.abs(zeroY - tipY);
        const segs = Math.max(1, Math.floor(mag / (segH + segGap)));
        return (
          <g key={i}>
            {Array.from({ length: segs }).map((_, k) => (
              <rect key={k} x={cx - barW / 2}
                y={neg ? zeroY + k * (segH + segGap) : zeroY - (k + 1) * segH - k * segGap}
                width={barW} height={segH}
                fill={neg ? "var(--alarm)" : "var(--holo)"}
                opacity={0.45 + 0.5 * (k / Math.max(1, segs - 1))} />
            ))}
            <rect x={cx - barW / 2 - 2} y={neg ? tipY - 1.4 : tipY} width={barW + 4} height={1.4}
              fill={neg ? "var(--alarm)" : "var(--holo)"} opacity="0.95" />
            <text x={cx} y={h - 5} textAnchor="middle" className="iox-axis">{monthAbbr(s.month)}</text>
          </g>
        );
      })}
    </svg>
  );
}
function WorldMap() {
  return (
    <svg width="100%" height="90" viewBox="0 0 100 50">
      <rect x="0" y="0" width="100" height="50" fill="none" stroke="rgba(79,227,255,0.08)" />
      {Array.from({ length: 6 }).map((_, i) => <line key={"h"+i} x1="0" y1={i*8.3} x2="100" y2={i*8.3} stroke="rgba(79,227,255,0.05)" strokeWidth="0.3" />)}
      {Array.from({ length: 10 }).map((_, i) => <line key={"v"+i} x1={i*10} y1="0" x2={i*10} y2="50" stroke="rgba(79,227,255,0.05)" strokeWidth="0.3" />)}
      {WORLD_POINTS.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="0.42" fill="var(--holo)" opacity="0.55" />)}
      {TRAVEL_PINS.map((d, i) => (
        <circle key={"pin"+i} cx={d.x} cy={d.y} r={d.visited ? 1.3 : 0.9}
          fill={d.visited ? "var(--flare)" : "none"} stroke="var(--flare)" strokeWidth="0.5" opacity={d.visited ? 1 : 0.6} />
      ))}
    </svg>
  );
}

// ── VEIN LINES ───────────────────────────────────────────────
// Faint curved threads from a handful of cockpit-style tiles back to Kaniel's
// core — a prototype, not yet applied to the whole tile field. Positions are
// measured in screen space via getBoundingClientRect, relative to a shared
// container, and recomputed on resize.
function VeinLines({ containerRef, sources, targetRef }) {
  const [paths, setPaths] = useState([]);

  useEffect(() => {
    function recompute() {
      const cRect = containerRef.current?.getBoundingClientRect();
      const tRect = targetRef.current?.getBoundingClientRect();
      if (!cRect || !tRect) return;
      const tx = tRect.left + tRect.width / 2 - cRect.left;
      const ty = tRect.top + tRect.height / 2 - cRect.top;
      const next = sources.map(({ ref, alarm }) => {
        const r = ref.current?.getBoundingClientRect();
        if (!r) return null;
        const sx = r.left + r.width / 2 - cRect.left;
        const sy = r.top + r.height - cRect.top;
        const midY = sy + (ty - sy) * 0.55;
        return { d: `M ${sx} ${sy} C ${sx} ${midY}, ${tx} ${midY}, ${tx} ${ty}`, alarm };
      }).filter(Boolean);
      setPaths(next);
    }
    recompute();
    const ro = new ResizeObserver(recompute);
    if (containerRef.current) ro.observe(containerRef.current);
    window.addEventListener("resize", recompute);
    return () => { ro.disconnect(); window.removeEventListener("resize", recompute); };
  }, [containerRef, sources, targetRef]);

  return (
    <svg className="vein-svg">
      {paths.map((p, i) => {
        const pid = `veinpath-${i}`;
        return (
          <g key={i} className={"vein-group" + (p.alarm ? " alarm" : "")}>
            <path d={p.d} className="vein-halo" />
            <path id={pid} d={p.d} className="vein-thread" />
            {Array.from({ length: 8 }).map((_, j) => (
              <circle key={j} r="1" className="vein-spark">
                <animateMotion dur="5s" begin={`${-j * 0.625}s`} repeatCount="indefinite">
                  <mpath href={`#${pid}`} />
                </animateMotion>
                <animate attributeName="opacity" values="0;0.6;0.6;0" keyTimes="0;0.15;0.85;1"
                  dur="5s" begin={`${-j * 0.625}s`} repeatCount="indefinite" />
              </circle>
            ))}
          </g>
        );
      })}
    </svg>
  );
}

const MicroTile = forwardRef(function MicroTile({ t, onOpen }, ref) {
  const shape = t.shape || (t.size === "lg" ? "lg" : "sm");
  if (t.cockpit) {
    return (
      <div ref={ref} className={"mtile hud " + shape + (t.alarm ? " alarm" : "")} onClick={() => onOpen(t)}>
        <div className={"mt-val" + (t.masked ? " money" : "")}>{t.masked ? <Masked value={t.raw} /> : t.value}</div>
        <div className="mt-lab">{t.label}</div>
        {t.spark && <div style={{ marginTop: 3 }}><Sparkline points={t.spark} w={92} h={16} alarm={t.alarm} /></div>}
        {t.ticks != null && (
          <div className="mt-ticks">
            {Array.from({ length: t.ticksTotal || 8 }).map((_, i) => (
              <span key={i} className={"mt-tick" + (i < t.ticks ? " on" : "")} />
            ))}
          </div>
        )}
        {t.sub && <div className="mt-subrow">{t.sub}</div>}
      </div>
    );
  }
  if (shape === "arcshape") {
    return (
      <div className={"mtile arcshape" + (t.alarm ? " alarm" : "")} onClick={() => onOpen(t)}>
        <ArcGauge value={parseInt(t.value)} size={70} alarm={t.alarm} />
      </div>
    );
  }
  if (shape === "ring") {
    return (
      <div className={"mtile hud ring" + (t.alarm ? " alarm" : "")} onClick={() => onOpen(t)}>
        <SegmentRing pct={t.pct} state={t.state} />
        <div className="mt-lab">{t.label}</div>
        {t.sub && <div className="mt-subrow">{t.sub}</div>}
      </div>
    );
  }
  if (shape === "overdue") {
    return (
      <div className={"mtile hud overdue" + (t.alarm ? " alarm" : "")} onClick={() => onOpen(t)}>
        <div className="mt-lab">{t.label}</div>
        {[{ k: "iowe", glyph: "▲", lab: "you owe" }, { k: "owedme", glyph: "▼", lab: "owed you" }].map(row => {
          const d = t.split[row.k];
          return (
            <div key={row.k} className={"ovd-row" + (d.count ? " hot" : "")}>
              <span className="ovd-dir">{row.glyph} {row.lab}</span>
              <span className="ovd-pips">
                {Array.from({ length: 4 }).map((_, i) => <i key={i} className={i < d.count ? "on" : ""} />)}
              </span>
              <span className="ovd-age">{d.count ? d.oldest + "d" : "—"}</span>
            </div>
          );
        })}
      </div>
    );
  }
  if (shape === "chart") {
    return (
      <div className="mtile hud chart" onClick={() => onOpen(t)}>
        <div className="mt-charthead">
          <span className="mt-lab">{t.label}</span>
          <span className={"mt-chartval" + (t.latest < 0 ? " neg" : "")}>{t.value}</span>
        </div>
        <InOutChart series={t.series} />
      </div>
    );
  }
  if (shape === "execution") {
    // Weekly Execution passes both pcts (two rings); Today's Tasks (Daily
    // Overview) omits goalsPct — Today's Goals has no completion checkbox to
    // ring, per spec — so a single centered ring renders instead of forcing
    // a second, meaningless gauge.
    return (
      <div className="mtile hud execution" onClick={() => onOpen(t)}>
        <div className="mt-lab">{t.label}</div>
        <div className="mt-exec-row">
          <ArcGauge value={t.tasksPct} display={t.tasksDisplay} size={58} valueSize={11} label="Tasks" />
          {t.goalsPct != null && <ArcGauge value={t.goalsPct} display={t.goalsDisplay} size={58} valueSize={11} label="Goals" />}
        </div>
      </div>
    );
  }
  if (shape === "homework") {
    return (
      <div className={"mtile hud homework" + (t.alarm ? " alarm" : "")} onClick={() => onOpen(t)}>
        <div className="mt-lab">{t.label}</div>
        {t.items.length === 0 ? (
          <div className="mt-hw-empty">nothing due today</div>
        ) : (
          <div className="mt-hw-list">
            {t.items.slice(0, 4).map(it => (
              <div key={it.id} className={"mt-hw-row" + (it.done ? " done" : "")}>
                <span className="mt-hw-time">{it.dueTime || "—"}</span>
                <span className="mt-hw-task">{it.task || "—"}</span>
              </div>
            ))}
            {t.items.length > 4 && <div className="mt-hw-more">+{t.items.length - 4} more</div>}
          </div>
        )}
        {t.overdueCount > 0 && <div className="mt-hw-overdue">{t.overdueCount} overdue</div>}
      </div>
    );
  }
  if (shape === "wide") {
    return (
      <div className={"mtile wide" + (t.alarm ? " alarm" : "")} onClick={() => onOpen(t)}>
        <div className="mt-val">{t.masked ? <Masked value={t.raw} /> : t.value}</div>
        <div className="mt-lab">{t.label}</div>
      </div>
    );
  }
  if (shape === "tall") {
    return (
      <div className={"mtile tall" + (t.alarm ? " alarm" : "")} onClick={() => onOpen(t)}>
        <div className="mt-vbar-wrap"><div className="mt-vbar-fill" style={{ height: t.alarm ? "30%" : "68%" }} /></div>
        <div className="mt-val">{t.value}</div>
        <div className="mt-lab">{t.label}</div>
      </div>
    );
  }
  return (
    <div className={"mtile " + shape + (t.alarm ? " alarm" : "")} onClick={() => onOpen(t)}>
      <div className="mt-val">{t.value}</div>
      <div className="mt-lab">{t.label}</div>
      {shape === "lg" && <div className="mt-bar-wrap"><div className="mt-bar-fill" style={{ width: t.alarm ? "28%" : "71%" }} /></div>}
    </div>
  );
});
// Every tile on the dashboard is backed by a live sector now, so this shows
// each tile's own real drill-down (tile.detail) — not the old fixed 3-line
// "7-day trend · —" block, which was hardcoded em-dashes for every tile that
// ever opened this, budget included, even after Budget went live.
function TileModal({ tile, onClose }) {
  if (!tile) return null;
  return (
    <div className="tile-modal-backdrop" onClick={onClose}>
      <div className={"tile-modal" + (tile.alarm ? " alarm" : "")} onClick={e => e.stopPropagation()}>
        <div className="tm-head"><span className="tm-title">{tile.label}</span><button className="tm-close" onClick={onClose}>close ✕</button></div>
        {tile.headline || <div className="tm-val">{tile.value}</div>}
        <div className="tm-detail">{tile.detail}</div>
      </div>
    </div>
  );
}
function polarToCartesian(cx, cy, r, angleDeg) {
  const a = (angleDeg - 90) * (Math.PI / 180);
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}
function describeArc(cx, cy, r, startAngle, endAngle) {
  const start = polarToCartesian(cx, cy, r, endAngle), end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? "0" : "1";
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}
function DialGreeble() {
  const cx = 200, cy = 130;
  return (
    <svg className="dial-greeble" viewBox="0 0 400 260">
      <line x1={cx} y1="6" x2={cx} y2={cy - 150} stroke="var(--holo-dim)" strokeWidth="0.5" opacity="0.18" strokeDasharray="1 4" />
      <line x1={cx} y1={cy + 150} x2={cx} y2="254" stroke="var(--holo-dim)" strokeWidth="0.5" opacity="0.18" strokeDasharray="1 4" />
      <line x1="6" y1={cy} x2={cx - 150} y2={cy} stroke="var(--holo-dim)" strokeWidth="0.5" opacity="0.18" strokeDasharray="1 4" />
      <line x1={cx + 150} y1={cy} x2="394" y2={cy} stroke="var(--holo-dim)" strokeWidth="0.5" opacity="0.18" strokeDasharray="1 4" />
      {[[26,20],[374,20],[26,240],[374,240]].map(([x,y],i) => (
        <g key={i} opacity="0.3">
          <circle cx={x} cy={y} r="9" fill="none" stroke="var(--holo)" strokeWidth="0.6" />
          <line x1={x-13} y1={y} x2={x+13} y2={y} stroke="var(--holo)" strokeWidth="0.5" />
          <line x1={x} y1={y-13} x2={x} y2={y+13} stroke="var(--holo)" strokeWidth="0.5" />
        </g>
      ))}
      <text className="dg-coord" x="20" y="42" fill="var(--holo-dim)" opacity="0.32">x 51.204</text>
      <text className="dg-coord" x="332" y="230" fill="var(--holo-dim)" opacity="0.32">y 28.771</text>
      <text className="dg-coord" x="20" y="230" fill="var(--holo-dim)" opacity="0.28">link ok ··</text>
      <text className="dg-coord" x="326" y="42" fill="var(--holo-dim)" opacity="0.28">drift +0.004</text>
    </svg>
  );
}

function SectorRing({ onOpen, onAllSectors }) {
  const items = [...PINNED_SECTORS, { key: "__all__", label: "All Sectors", glyph: "▤", all: true }];
  const n = items.length, gap = 6, seg = (360 - n * gap) / n, cx = 200, cy = 130, r = 122;
  return (
    <svg className="ring-svg" viewBox="0 0 400 260">
      {items.map((s, i) => {
        const start = i * (seg + gap), end = start + seg, mid = (start + end) / 2;
        const labelPos = polarToCartesian(cx, cy, r + 16, mid);
        return (
          <g key={s.key} className="arc-seg-group" onClick={() => (s.all ? onAllSectors() : onOpen(s))}>
            {/* Wide invisible stroke — the real hit target. The visible arc
                stayed 6px thin (that's the look), but that made it genuinely
                hard to click; this widens the clickable band without touching
                the rendered line at all. Label is now clickable too, via the
                same onClick on the shared <g> (no more pointer-events:none). */}
            <path className="arc-seg-hit" d={describeArc(cx, cy, r, start, end)} fill="none" stroke="transparent" strokeWidth="26" />
            <path className={"arc-seg" + (s.all ? " all-sectors" : "")} d={describeArc(cx, cy, r, start, end)}
              fill="none" stroke={s.all ? "var(--flare)" : s.locked ? "var(--holo-dim)" : "var(--holo)"}
              strokeWidth="6" strokeDasharray={s.locked && !s.all ? "3 4" : "none"}
              opacity={s.all ? 0.9 : s.locked ? 0.4 : 0.85} />
            <text className="arc-seg-label" x={labelPos.x} y={labelPos.y} textAnchor="middle"
              fill={s.all ? "var(--flare)" : s.locked ? "var(--holo-dim)" : "var(--ghost)"} opacity={s.locked && !s.all ? 0.55 : 0.9}>
              {s.glyph} {s.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
// wrap=false + offset lets several panels share one fanned cluster (same
// angle, staggered left/right so each spine peeks out from the last) instead
// of each owning its own vertical dock-slot. tooltip surfaces the flat,
// un-rotated title on hover since a shared steep angle foreshortens the
// panel's own rotated label past readability.
function DockPanel({ title, angle, side, children, offset, wrap = true, tooltip = false }) {
  const [hovered, setHovered] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [tooltipPos, setTooltipPos] = useState(null);
  const panelRef = useRef(null);
  const rot = side === "left" ? angle : -angle;

  useEffect(() => {
    if (!expanded) return;
    // closes on a click anywhere outside ALL dock panels (the open stage),
    // not just outside this one — so clicking a different panel to open it
    // doesn't collapse the ones already open.
    const onPointerDown = (e) => {
      if (!e.target.closest(".dock-panel")) setExpanded(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [expanded]);

  const style = { "--rot": rot + "deg" };
  if (offset !== undefined) style[side === "left" ? "left" : "right"] = offset;

  const panel = (
    <div
      ref={panelRef}
      className={"dock-panel " + side + (expanded ? " expanded" : "")}
      style={style}
      onClick={() => { if (!expanded) setExpanded(true); }}
      onMouseEnter={() => {
        setHovered(true);
        if (tooltip && panelRef.current) {
          const r = panelRef.current.getBoundingClientRect();
          setTooltipPos({ left: r.left, top: r.top });
        }
      }}
      onMouseLeave={() => setHovered(false)}
    >
      <span className="nbrk a" /><span className="nbrk b" />
      {expanded ? (
        <>
          <div className="dp-head"><span className="dp-title">{title}</span></div>
          <div className="dp-body">{children}</div>
        </>
      ) : (
        <>
          <div className={"dp-label" + (hovered ? " lit" : "")}><span>{title}</span></div>
          <div className="dp-hint">tap</div>
        </>
      )}
    </div>
  );

  return (
    <>
      {wrap ? <div className="dock-slot">{panel}</div> : panel}
      {tooltip && hovered && !expanded && tooltipPos && createPortal(
        <div className="dp-tooltip" style={{ left: tooltipPos.left + 6, top: tooltipPos.top - 8, transform: "translateY(-100%)" }}>
          {title}
        </div>,
        document.body
      )}
    </>
  );
}

// shared by the Budget Health dock panel + the Budget Used tile's real
// drill-down — one source for the condensed per-category meter list instead
// of three slightly-diverging copies of the same JSX.
function CategoryBreakdown({ categories, ticks = 10 }) {
  if (!categories.length) return <div className="bz-empty">no categories yet</div>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      {categories.map(c => {
        const pct = categoryPct(c), state = categoryState(c);
        const lit = Math.min(ticks, Math.round((pct / 100) * ticks));
        return (
          <div key={c.id} className={"bz-cat " + state}>
            <div className="bz-cat-head" style={{ fontSize: 8 }}>
              <span>{c.name}</span><span className="bz-cat-pct">{Math.round(pct)}%</span>
            </div>
            <div className="bz-meter" style={{ marginTop: 2 }}>
              {Array.from({ length: ticks }).map((_, i) => <i key={i} className={i < lit ? "on" : ""} style={{ height: 4 }} />)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// shared by Capital on Hand + Net Worth — both use the same month log shape,
// with In/Out derived (end − start) rather than stored
function MonthLog({ rows }) {
  if (!rows.length) return <div className="bz-empty">no months logged — auto close-out runs on first login of a new month</div>;
  return (
    <table className="bz-log">
      <thead><tr><th>Month</th><th>Start</th><th>End</th><th>In / Out</th></tr></thead>
      <tbody>
        {rows.map(r => {
          const io = logInOut(r);
          return (
            <tr key={r.month}>
              <td>{r.month}</td><td>{fmtMoney(r.start)}</td><td>{fmtMoney(r.end)}</td>
              <td className={"io " + (io < 0 ? "neg" : "pos")}>{io >= 0 ? "+" : ""}{fmtMoney(io)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// Freeform bullet list shared by Weekly Tasks and This Week's Goals. Both are
// current-week-only and blank out on the Sunday reset — no history, per spec.
// Enter appends a row below, Backspace on an already-empty row removes it, so a
// list can be filled without ever reaching for the mouse.
function WeeklyList({ title, tag, items, empty, progress, frame = "", onAdd, onSet, onRemove, onToggleDone }) {
  const [focusId, setFocusId] = useState(null);
  const refs = useRef({});
  useEffect(() => {
    if (focusId && refs.current[focusId]) { refs.current[focusId].focus(); setFocusId(null); }
  }, [focusId, items]);

  const append = (afterId) => { const id = uid(); onAdd(id, afterId); setFocusId(id); };
  const onKey = (e, it, i) => {
    if (e.key === "Enter") { e.preventDefault(); append(it.id); }
    else if (e.key === "Backspace" && it.text === "" && items.length > 1) {
      e.preventDefault();
      const prev = items[i - 1];
      onRemove(it.id);
      if (prev) setFocusId(prev.id);
    }
  };

  return (
    <section className={"wk-mod " + frame}>
      <div className="wk-mod-head"><span>{title}</span><span className="wk-tag">{tag}</span></div>
      {items.length === 0 && <div className="wk-empty">{empty}</div>}
      {items.map((it, i) => {
        const p = progress ? goalProgress(it.text) : null;
        const check = onToggleDone && (
          <button className="wk-check" onClick={() => onToggleDone(it.id)}
            aria-label={it.done ? "Mark not done" : "Mark done"}>{it.done ? "◼" : "◻"}</button>
        );
        const row = (
          <div className={"wk-row" + (it.done ? " checked" : "")} key={it.id}>
            {check}
            <span className="wk-bullet">▸</span>
            <AutoText className="wk-in" value={it.text} placeholder="—"
              ref={el => { refs.current[it.id] = el; }}
              onChange={e => onSet(it.id, e.target.value)}
              onKeyDown={e => onKey(e, it, i)} />
            <button className="wk-x" onClick={() => onRemove(it.id)} aria-label="Remove item">✕</button>
          </div>
        );
        if (!p) return row;
        const lit = Math.round((p.pct / 100) * 12);
        return (
          <div className={"wk-goal" + (p.done_eq_total ? " done" : "") + (it.done ? " checked" : "")} key={it.id}>
            <div className="wk-goal-top">
              {check}
              <span className="wk-bullet">▸</span>
              <AutoText className="wk-in" value={it.text} placeholder="—"
                ref={el => { refs.current[it.id] = el; }}
                onChange={e => onSet(it.id, e.target.value)}
                onKeyDown={e => onKey(e, it, i)} />
              <button className="wk-x" onClick={() => onRemove(it.id)} aria-label="Remove item">✕</button>
            </div>
            <div className="wk-prog">
              <span className="wk-prog-meter">
                {Array.from({ length: 12 }).map((_, k) => <i key={k} className={k < lit ? "on" : ""} />)}
              </span>
              <span className="wk-prog-n">{p.done} / {p.total}</span>
            </div>
          </div>
        );
      })}
      <button className="wk-add" onClick={() => append(null)}>+ add line</button>
    </section>
  );
}

const uid = () => (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2, 10));

// Daily Overview's freeform-list workhorse — used by Priorities and the
// People "extras" list (variant="rank", numbered badge) and Today's Goals
// (variant="bullet", ▸ marker, no rank meaning). Addable/removable
// (unlike Weekly Overview's fixed 5-slot Priorities). Same Enter/Backspace UX
// as WeeklyList, own do- prefixed CSS since it's a different sector's data
// (see bz-/wk-/mo- per-sector convention).
function DailyRankedList({ title, tag, items, empty, variant = "rank", onAdd, onSet, onRemove }) {
  const [focusId, setFocusId] = useState(null);
  const refs = useRef({});
  useEffect(() => {
    if (focusId && refs.current[focusId]) { refs.current[focusId].focus(); setFocusId(null); }
  }, [focusId, items]);

  const append = (afterId) => { const id = uid(); onAdd(id, afterId); setFocusId(id); };
  const onKey = (e, it, i) => {
    if (e.key === "Enter") { e.preventDefault(); append(it.id); }
    else if (e.key === "Backspace" && it.text === "" && items.length > 1) {
      e.preventDefault();
      const prev = items[i - 1];
      onRemove(it.id);
      if (prev) setFocusId(prev.id);
    }
  };

  return (
    <section className="do-mod f-tick">
      <div className="wk-mod-head"><span>{title}</span><span className="wk-tag">{tag}</span></div>
      {items.length === 0 && <div className="do-empty">{empty}</div>}
      {items.map((it, i) => (
        <div className="do-pri-row" key={it.id}>
          {variant === "rank"
            ? <span className="do-rank">{String(i + 1).padStart(2, "0")}</span>
            : <span className="do-bullet">▸</span>}
          <AutoText className="do-in" value={it.text} placeholder="—"
            ref={el => { refs.current[it.id] = el; }}
            onChange={e => onSet(it.id, e.target.value)}
            onKeyDown={e => onKey(e, it, i)} />
          <button className="do-x" onClick={() => onRemove(it.id)} aria-label="Remove item">✕</button>
        </div>
      ))}
      <button className="do-add" onClick={() => append(null)}>+ add line</button>
    </section>
  );
}

// Daily Overview's Tasks module — freeform list where each item carries a
// 1/2/3 priority (1 = highest, matching the source LIFE-2.xlsx Daily Overview
// sheet's Tasks/Priorities columns) plus a completion checkbox. Fully
// independent of Weekly Overview's Weekly Tasks — no linking, no shared
// completion state, separate data entirely (see docs/specs/DAILY_OVERVIEW_SPEC.md).
//
// Display auto-sorts — not-done tasks by priority ascending (unset priority
// sorts last among not-done), done tasks pushed to the bottom — mirroring how
// the source sheet is kept sorted by hand (priority 1s at top, "DONE" rows at
// the very bottom). This is a DISPLAY sort only: the underlying store array
// stays in insertion order so ids/positions used by add/remove stay stable
// under a re-sort. Array.prototype.sort is spec-stable, so same-priority ties
// keep their relative insertion order rather than jittering on every render.
function DailyTaskList({ items, empty, onAdd, onSet, onRemove, onToggleDone, onSetPriority }) {
  const [focusId, setFocusId] = useState(null);
  const refs = useRef({});
  useEffect(() => {
    if (focusId && refs.current[focusId]) { refs.current[focusId].focus(); setFocusId(null); }
  }, [focusId, items]);

  const sorted = useMemo(() => {
    const rank = (p) => (p == null ? 4 : p);
    return [...items].sort((a, b) => (a.done !== b.done ? (a.done ? 1 : -1) : rank(a.priority) - rank(b.priority)));
  }, [items]);

  const append = (afterId) => { const id = uid(); onAdd(id, afterId); setFocusId(id); };
  const onKey = (e, it, i) => {
    if (e.key === "Enter") { e.preventDefault(); append(it.id); }
    else if (e.key === "Backspace" && it.text === "" && sorted.length > 1) {
      e.preventDefault();
      const prev = sorted[i - 1];
      onRemove(it.id);
      if (prev) setFocusId(prev.id);
    }
  };

  return (
    <section className="do-mod f-rail">
      <div className="wk-mod-head"><span>Tasks</span><span className="wk-tag">independent of weekly tasks · sorted by priority, done at bottom</span></div>
      {sorted.length === 0 && <div className="do-empty">{empty}</div>}
      {sorted.map((it, i) => (
        <div className={"do-task-row" + (it.done ? " checked" : "")} key={it.id}>
          <button className="do-check" onClick={() => onToggleDone(it.id)}
            aria-label={it.done ? "Mark not done" : "Mark done"}>{it.done ? "◼" : "◻"}</button>
          <span className="do-pri-group">
            {[1, 2, 3].map(p => (
              <button key={p} className={"do-pri-btn" + (it.priority === p ? " active" : "")}
                onClick={() => onSetPriority(it.id, it.priority === p ? null : p)}
                aria-label={"Set priority " + p}>{p}</button>
            ))}
          </span>
          <AutoText className="do-in" value={it.text} placeholder="—"
            ref={el => { refs.current[it.id] = el; }}
            onChange={e => onSet(it.id, e.target.value)}
            onKeyDown={e => onKey(e, it, i)} />
          <button className="do-x" onClick={() => onRemove(it.id)} aria-label="Remove item">✕</button>
        </div>
      ))}
      <button className="do-add" onClick={() => append(null)}>+ add line</button>
    </section>
  );
}

// Daily Overview's Homework/Deadlines table — columns verbatim from
// LIFE-2.xlsx's Daily Overview sheet (row 22: Time Req. / Homework Tasks /
// Class / Due Date / Due Time / Status). School-specific as-is, no
// generalization to a generic "deadlines" concept per spec. PERSISTS across
// the daily boundary — rows stay until Status is marked done or removed,
// same reasoning as Weekly Overview's Daily Metrics Log being the one field
// touchWeek doesn't blank (see docs/specs/DAILY_OVERVIEW_SPEC.md Module 7).
// Click-to-sort headers, off by default (insertion order until a header is
// clicked). Due Date and Due Time share one sort key ("due") deliberately —
// sorting by time-of-day alone across different dates isn't meaningful, so
// clicking either header sorts by the combined date+time instead. Sort is
// display-only, same as Tasks' priority sort: the underlying store array
// never reorders, so add/remove-by-id stays stable.
const HW_EMPTY = (v) => v === "" || v == null;
// Time Required is freeform text ("2 hrs", "30 min", "1.5 hrs 15 min") — a
// plain string sort put "30 min" after "2 hrs" because "3" > "2" as the first
// character, treating minutes and hours as the same unit. Parse to total
// minutes instead so sorting is by actual duration. Unrecognized text (no hr/
// min unit and not a bare number) returns null and sorts last, same as a
// blank due date — an unparseable value isn't a duration of zero, it's unknown.
function parseTimeRequiredMinutes(str) {
  if (!str) return null;
  const s = String(str).trim().toLowerCase();
  if (!s) return null;
  let total = 0, matched = false;
  const hrMatch = s.match(/(\d+(?:\.\d+)?)\s*h(?:rs?|ours?)?\b/);
  if (hrMatch) { total += parseFloat(hrMatch[1]) * 60; matched = true; }
  const minMatch = s.match(/(\d+(?:\.\d+)?)\s*m(?:ins?|inutes?)?\b/);
  if (minMatch) { total += parseFloat(minMatch[1]); matched = true; }
  if (!matched) {
    const bare = s.match(/^(\d+(?:\.\d+)?)$/); // a bare number with no unit — assume minutes
    if (bare) { total = parseFloat(bare[1]); matched = true; }
  }
  return matched ? total : null;
}
function homeworkSortValue(it, key) {
  if (key === "due") return (!it.dueDate && !it.dueTime) ? null : (it.dueDate || "") + "T" + (it.dueTime || "");
  if (key === "timeRequired") return parseTimeRequiredMinutes(it.timeRequired);
  return it[key];
}
// `dir` only flips the real-value comparison — blanks staying last in BOTH
// directions was the point (a blank due date shouldn't jump to the top just
// because the direction flipped), so it can't be folded into a single
// `* dir` multiply applied uniformly outside this function.
function homeworkCompare(a, b, dir) {
  const ae = HW_EMPTY(a), be = HW_EMPTY(b);
  if (ae && be) return 0;
  if (ae) return 1;
  if (be) return -1;
  return (a < b ? -1 : a > b ? 1 : 0) * dir;
}

function HomeworkTable({ items, onAdd, onSet, onRemove, onToggleDone }) {
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState("asc");
  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };
  const sorted = useMemo(() => {
    if (!sortKey) return items;
    const dir = sortDir === "asc" ? 1 : -1;
    return [...items].sort((a, b) => homeworkCompare(homeworkSortValue(a, sortKey), homeworkSortValue(b, sortKey), dir));
  }, [items, sortKey, sortDir]);
  const arrow = (key) => (sortKey === key ? (sortDir === "asc" ? " ▲" : " ▼") : "");
  const sortBtn = (key, label) => (
    <button className={"do-hw-sort" + (sortKey === key ? " active" : "")} onClick={() => toggleSort(key)}>{label}{arrow(key)}</button>
  );

  return (
    <section className="do-mod f-rail">
      <div className="wk-mod-head"><span>Homework / Deadlines</span><span className="wk-tag">persists across days · click a column to sort</span></div>
      {items.length === 0 && <div className="do-empty">no homework or deadlines logged</div>}
      {items.length > 0 && (
        <div className="do-hw-table">
          <div className="do-hw-row do-hw-head">
            <span />
            {sortBtn("timeRequired", "Time Req.")}
            {sortBtn("task", "Task")}
            {sortBtn("cls", "Class")}
            {sortBtn("due", "Due Date")}
            {sortBtn("due", "Due Time")}
            {sortBtn("status", "Status")}
            <span />
          </div>
          {sorted.map(it => (
            <div className={"do-hw-row" + (it.done ? " done" : "")} key={it.id}>
              <button className="do-check" onClick={() => onToggleDone(it.id)}
                aria-label={it.done ? "Mark not done" : "Mark done"}>{it.done ? "◼" : "◻"}</button>
              <input className="do-hw-in" value={it.timeRequired} placeholder="—"
                onChange={e => onSet(it.id, "timeRequired", e.target.value)} />
              <input className="do-hw-in" value={it.task} placeholder="—"
                onChange={e => onSet(it.id, "task", e.target.value)} />
              <input className="do-hw-in" value={it.cls} placeholder="—"
                onChange={e => onSet(it.id, "cls", e.target.value)} />
              <input className="do-hw-in" type="date" value={it.dueDate}
                onChange={e => onSet(it.id, "dueDate", e.target.value)} />
              <input className="do-hw-in" type="time" value={it.dueTime}
                onChange={e => onSet(it.id, "dueTime", e.target.value)} />
              <input className="do-hw-in" value={it.status} placeholder="—"
                onChange={e => onSet(it.id, "status", e.target.value)} />
              <button className="do-x" onClick={() => onRemove(it.id)} aria-label="Remove row">✕</button>
            </div>
          ))}
        </div>
      )}
      <button className="do-add" onClick={onAdd}>+ add row</button>
    </section>
  );
}

// Contact Tracker's Roster — Module 1 (see docs/specs/CONTACT_TRACKER_SPEC.md). All
// fields freeform except Frequency (controlled set — the interval math in
// contactNextDate needs to recognize the exact value) and Priority (1–5,
// matches the source sheet's own scale, NOT Daily Overview's 1/2/3). Next
// Contact is always read-only — it's derived, never typed in.
// Overdue sorts first (oldest-next-date first, i.e. most overdue), then
// due-today, then everything else by soonest next-date (nulls — no
// lastContact/frequency yet — last, display order among themselves). Ties
// within a bucket keep insertion order (stable sort). This is display-only,
// same convention as Daily Overview's Homework auto-sort — stored order is
// untouched so add/remove never reshuffles unrelated rows.
function sortRoster(items) {
  const bucket = (it) => contactOverdue(it) ? 0 : contactDueToday(it) ? 1 : 2;
  return items
    .map((it, i) => ({ it, i, b: bucket(it), next: contactNextDate(it) }))
    .sort((a, b) => a.b - b.b || (a.next || "9999-99-99").localeCompare(b.next || "9999-99-99") || a.i - b.i)
    .map(x => x.it);
}

function ContactRoster({ items, onAdd, onSet, onRemove }) {
  const sorted = useMemo(() => sortRoster(items), [items]);
  const overdueCount = items.filter(it => contactOverdue(it)).length;
  const dueTodayCount = items.filter(it => contactDueToday(it)).length;
  return (
    <section className="do-mod f-rail ct-roster">
      <div className="wk-mod-head">
        <span>Roster</span>
        <span className="wk-tag">
          {items.length} contact{items.length === 1 ? "" : "s"}
          {overdueCount > 0 && <span className="ct-tag-alarm"> · {overdueCount} overdue</span>}
          {dueTodayCount > 0 && <span className="ct-tag-due"> · {dueTodayCount} due today</span>}
        </span>
      </div>
      {items.length === 0 && <div className="do-empty">no contacts logged yet</div>}
      {items.length > 0 && (
        <div className="ct-table">
          <div className="ct-row ct-head">
            <span>Name</span><span>Category</span><span>Last Contact</span><span>Frequency</span>
            <span>Next Contact</span><span>Priority</span><span>Method</span><span>Location</span><span>Notes</span><span />
          </div>
          {sorted.map(it => {
            const next = contactNextDate(it);
            const overdue = contactOverdue(it);
            const dueToday = contactDueToday(it);
            return (
              <div className={"ct-row" + (overdue ? " overdue" : dueToday ? " due-today" : "")} key={it.id}>
                <input className="ct-in" value={it.name} placeholder="—" onChange={e => onSet(it.id, "name", e.target.value)} />
                <input className="ct-in" value={it.category} placeholder="—" onChange={e => onSet(it.id, "category", e.target.value)} />
                <input className="ct-in" type="date" value={it.lastContact} onChange={e => onSet(it.id, "lastContact", e.target.value)} />
                <select className="ct-select" value={it.frequency} onChange={e => onSet(it.id, "frequency", e.target.value)}>
                  <option value="">—</option>
                  {CONTACT_FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
                <span className="ct-next">{next || "—"}{overdue && <span className="ct-next-tag"> overdue</span>}{dueToday && <span className="ct-next-tag due"> today</span>}</span>
                <span className="ct-pri-group">
                  {[1, 2, 3, 4, 5].map(p => (
                    <button key={p} className={"ct-pri-btn" + (it.priority === p ? " active" : "")}
                      onClick={() => onSet(it.id, "priority", it.priority === p ? null : p)}
                      aria-label={"Set priority " + p}>{p}</button>
                  ))}
                </span>
                <input className="ct-in" value={it.method} placeholder="—" onChange={e => onSet(it.id, "method", e.target.value)} />
                <input className="ct-in" value={it.location} placeholder="—" onChange={e => onSet(it.id, "location", e.target.value)} />
                <input className="ct-in" value={it.notes} placeholder="—" onChange={e => onSet(it.id, "notes", e.target.value)} />
                <button className="do-x" onClick={() => onRemove(it.id)} aria-label="Remove contact">✕</button>
              </div>
            );
          })}
        </div>
      )}
      <button className="do-add" onClick={onAdd}>+ add contact</button>
    </section>
  );
}

// Project Tracker — zone board. See docs/specs/PROJECT_TRACKER_SPEC.md: zone and
// state meanings are INFERRED this session, not confirmed. Four zone clusters
// (Zone L/S/1/Shelf), each a scattered cluster of cards rather than a uniform
// grid — Zone 1 is visually distinct (one large card slot) since it's enforced
// single-occupant by projectMoveZone in store.js.
const PT_ZONE_META = {
  L: { label: "Zone L", tag: "long-term / large" },
  S: { label: "Zone S", tag: "short-term / small" },
  "1": { label: "Zone 1", tag: "current focus · one slot" },
  shelf: { label: "The Shelf", tag: "parked · not yet promoted" },
};
const PT_STATE_CYCLE = PROJECT_STATES; // Active → Standby → Dormant → Archived → Active…

function ProjectCard({ p, onEdit, onMoveZone, onSetState, onRemove, big }) {
  const [open, setOpen] = useState(false);
  const cycleState = () => onSetState(p.id, PT_STATE_CYCLE[(PT_STATE_CYCLE.indexOf(p.state) + 1) % PT_STATE_CYCLE.length]);
  return (
    <div className={"pt-card" + (big ? " big" : "") + (p.state === "Archived" ? " archived" : "")}>
      <div className="pt-card-top">
        <AutoText className="pt-name" value={p.name} placeholder="untitled project"
          onChange={e => onEdit(p.id, "name", e.target.value)} />
        <button className="do-x" onClick={() => onRemove(p.id)} aria-label="Remove project">✕</button>
      </div>
      <div className="pt-card-row">
        <button className={"pt-state pt-state-" + p.state.toLowerCase()} onClick={cycleState}>{p.state}</button>
        <select className="pt-zone-select" value={p.zone} onChange={e => onMoveZone(p.id, e.target.value)}>
          {PROJECT_ZONES.map(z => <option key={z} value={z}>{PT_ZONE_META[z].label}</option>)}
        </select>
      </div>
      <div className="pt-card-row">
        <span className="pt-target-lab">target</span>
        <input className="pt-target" type="date" value={p.targetDate} onChange={e => onEdit(p.id, "targetDate", e.target.value)} />
      </div>
      <button className="pt-notes-toggle" onClick={() => setOpen(o => !o)}>{open ? "▲ notes" : "▼ notes" + (p.notes ? " ·" : "")}</button>
      {open && (
        <AutoText className="pt-notes" value={p.notes} placeholder="—"
          onChange={e => onEdit(p.id, "notes", e.target.value)} />
      )}
    </div>
  );
}

function ProjectTracker({ projects, onAdd, onEdit, onMoveZone, onSetState, onRemove }) {
  const [newName, setNewName] = useState("");
  const submitAdd = () => { onAdd(newName); setNewName(""); };
  const byZone = (z) => projects.filter(p => p.zone === z);
  return (
    <div className="pt-board">
      <div className="pt-add-row">
        <input className="pt-add-in" value={newName} placeholder="new project name — lands in The Shelf"
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && newName.trim()) submitAdd(); }} />
        <button className="do-add" onClick={() => newName.trim() && submitAdd()}>+ add project</button>
      </div>
      <div className="pt-grid">
        {PROJECT_ZONES.map(z => {
          const items = byZone(z);
          const meta = PT_ZONE_META[z];
          const isOne = z === "1";
          return (
            <section key={z} className={"pt-zone" + (isOne ? " pt-zone-one" : "")}>
              <div className="wk-mod-head"><span>{meta.label}</span><span className="wk-tag">{meta.tag} · {items.length}</span></div>
              {items.length === 0 && <div className="do-empty">{isOne ? "no current focus set" : "empty"}</div>}
              <div className="pt-cluster">
                {items.map(p => (
                  <ProjectCard key={p.id} p={p} big={isOne} onEdit={onEdit} onMoveZone={onMoveZone} onSetState={onSetState} onRemove={onRemove} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

// Life Goals — cascading tier tree (Life → Year → Quarter). See
// docs/specs/LIFE_GOALS_SPEC.md: tier structure is INFERRED, not confirmed.
// Unlike Project Tracker's independent zone clusters, this is explicitly
// hierarchical — each tier nests under its parent rather than sitting in its
// own bucket, and a lower tier can't be added until its parent tier exists
// (enforced in store.js's goalAdd, not just suggested here).
const LG_TIER_LABEL = { life: "Life", year: "Year", quarter: "Quarter" };
const LG_STATE_CYCLE = LIFE_GOAL_STATES;

function GoalCard({ g, parentTitle, onEdit, onSetStatus, onRemove }) {
  const [open, setOpen] = useState(false);
  const cycleStatus = () => onSetStatus(g.id, LG_STATE_CYCLE[(LG_STATE_CYCLE.indexOf(g.status) + 1) % LG_STATE_CYCLE.length]);
  return (
    <div className={"lg-card lg-tier-" + g.tier + (g.status === "Archived" ? " archived" : "")}>
      <div className="lg-card-top">
        <span className="lg-tier-tag">{LG_TIER_LABEL[g.tier]}</span>
        <AutoText className="lg-title" value={g.title} placeholder="untitled goal"
          onChange={e => onEdit(g.id, "title", e.target.value)} />
        <button className="do-x" onClick={() => onRemove(g.id)} aria-label="Remove goal">✕</button>
      </div>
      {parentTitle && <div className="lg-rollup">↳ rolls up to: {parentTitle || "—"}</div>}
      <div className="lg-card-row">
        <button className={"pt-state lg-state-" + g.status.toLowerCase()} onClick={cycleStatus}>{g.status}</button>
        {g.tier !== "life" && (
          <input className="lg-period" value={g.period} placeholder={g.tier === "year" ? "e.g. 2026" : "e.g. 2026 Q3"}
            onChange={e => onEdit(g.id, "period", e.target.value)} />
        )}
      </div>
      <button className="pt-notes-toggle" onClick={() => setOpen(o => !o)}>{open ? "▲ notes" : "▼ notes" + (g.notes ? " ·" : "")}</button>
      {open && (
        <AutoText className="pt-notes" value={g.notes} placeholder="—"
          onChange={e => onEdit(g.id, "notes", e.target.value)} />
      )}
    </div>
  );
}

function LifeGoalsBoard({ goals, onAdd, onEdit, onSetStatus, onRemove }) {
  const lifeGoals = goals.filter(g => g.tier === "life");
  const yearGoals = goals.filter(g => g.tier === "year");
  const [newLife, setNewLife] = useState("");
  const [newYear, setNewYear] = useState("");
  const [newYearParent, setNewYearParent] = useState("");
  const [newQuarter, setNewQuarter] = useState("");
  const [newQuarterParent, setNewQuarterParent] = useState("");

  const addLife = () => { if (newLife.trim()) { onAdd("life", null, newLife); setNewLife(""); } };
  const addYear = () => { if (newYear.trim() && newYearParent) { onAdd("year", newYearParent, newYear); setNewYear(""); } };
  const addQuarter = () => { if (newQuarter.trim() && newQuarterParent) { onAdd("quarter", newQuarterParent, newQuarter); setNewQuarter(""); } };

  return (
    <div className="lg-board">
      <div className="lg-add-bars">
        <div className="lg-add-bar">
          <span className="lg-add-lab">Life</span>
          <input className="pt-add-in" value={newLife} placeholder="new life-level theme"
            onChange={e => setNewLife(e.target.value)} onKeyDown={e => e.key === "Enter" && addLife()} />
          <button className="do-add" onClick={addLife}>+ add</button>
        </div>
        <div className="lg-add-bar">
          <span className="lg-add-lab">Year</span>
          {lifeGoals.length === 0 ? <span className="lg-add-blocked">add a Life goal first</span> : (
            <>
              <select className="ct-select lg-parent-select" value={newYearParent} onChange={e => setNewYearParent(e.target.value)}>
                <option value="">— rolls up to —</option>
                {lifeGoals.map(l => <option key={l.id} value={l.id}>{l.title || "untitled"}</option>)}
              </select>
              <input className="pt-add-in" value={newYear} placeholder="new year goal"
                onChange={e => setNewYear(e.target.value)} onKeyDown={e => e.key === "Enter" && addYear()} />
              <button className="do-add" onClick={addYear}>+ add</button>
            </>
          )}
        </div>
        <div className="lg-add-bar">
          <span className="lg-add-lab">Quarter</span>
          {yearGoals.length === 0 ? <span className="lg-add-blocked">add a Year goal first</span> : (
            <>
              <select className="ct-select lg-parent-select" value={newQuarterParent} onChange={e => setNewQuarterParent(e.target.value)}>
                <option value="">— rolls up to —</option>
                {yearGoals.map(y => <option key={y.id} value={y.id}>{y.title || "untitled"}</option>)}
              </select>
              <input className="pt-add-in" value={newQuarter} placeholder="new quarter goal"
                onChange={e => setNewQuarter(e.target.value)} onKeyDown={e => e.key === "Enter" && addQuarter()} />
              <button className="do-add" onClick={addQuarter}>+ add</button>
            </>
          )}
        </div>
      </div>

      {lifeGoals.length === 0 && <div className="do-empty">no life goals set yet</div>}
      <div className="lg-tree">
        {lifeGoals.map(life => {
          const years = goals.filter(g => g.parentId === life.id);
          return (
            <div className="lg-life-block" key={life.id}>
              <GoalCard g={life} onEdit={onEdit} onSetStatus={onSetStatus} onRemove={onRemove} />
              {years.length > 0 && (
                <div className="lg-children">
                  {years.map(year => {
                    const quarters = goals.filter(g => g.parentId === year.id);
                    return (
                      <div className="lg-year-block" key={year.id}>
                        <GoalCard g={year} parentTitle={life.title} onEdit={onEdit} onSetStatus={onSetStatus} onRemove={onRemove} />
                        {quarters.length > 0 && (
                          <div className="lg-children">
                            {quarters.map(q => (
                              <GoalCard key={q.id} g={q} parentTitle={year.title} onEdit={onEdit} onSetStatus={onSetStatus} onRemove={onRemove} />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Number-input step/bounds per metric kind — shared by day cells and the Goal
// column. sumFraction rows (Temple?, Finance Review?, Reflection?) get a Goal
// that's a target COUNT out of 7, not a 0/1 toggle — the sheet's own goal
// values for these (1.0, 5.0, 4.0) are counts, even though the daily kind is
// yesno. That's a rollup concern, not a kind concern.
const NUM_PROPS = {
  scale: { step: 1, min: 1, max: 10 },
  hours: { step: 0.25, min: 0 },
  mins: { step: 1, min: 0 },
  count: { step: 1, min: 0 },
  money: { step: 0.01, min: 0 },
  pct: { step: 1, min: 0, max: 100 },
};
const goalInputKind = (metric) => (metric.rollup === "sumFraction" ? "count" : metric.kind);

function MetricNumberInput({ kind, value, onChange, className, inputRef, onKeyDown }) {
  const p = NUM_PROPS[kind] || NUM_PROPS.count;
  return (
    <input type="number" ref={inputRef} className={className} value={value ?? ""} placeholder="—"
      step={p.step} min={p.min} max={p.max} onKeyDown={onKeyDown}
      onChange={e => onChange(e.target.value === "" ? "" : Number(e.target.value))} />
  );
}
function MetricClockInput({ value, onChange, className, inputRef, onKeyDown }) {
  return (
    <input type="time" ref={inputRef} className={className} value={clockFromMinutes(value)} onKeyDown={onKeyDown}
      onChange={e => onChange(e.target.value ? minutesFromClock(e.target.value) : "")} />
  );
}
// Three-state so "not logged yet" stays visually distinct from an explicit
// no — the sumFraction math treats both as 0 (fixed /7 denominator either
// way), but a glance at the row should still be able to tell them apart.
function MetricYesNoToggle({ value, onChange, inputRef, onKeyDown }) {
  const state = value === 1 ? "yes" : value === 0 ? "no" : "unset";
  const next = () => onChange(state === "unset" ? 1 : state === "yes" ? 0 : "");
  return (
    <button type="button" ref={inputRef} className={"wk-yn " + state} onClick={next} onKeyDown={onKeyDown}
      aria-label={state === "yes" ? "Yes — click for No" : state === "no" ? "No — click to clear" : "Not logged — click for Yes"}>
      {state === "yes" ? "◼" : state === "no" ? "▪" : "◻"}
    </button>
  );
}

// One row of the Daily Metrics Log: 7 day cells + Total + Average + Goal. The
// Goal cell's color is the only place red/green-style feedback appears in
// this sector — favorable (cyan, goal reads as improvement over the current
// run) vs unfavorable (red, goal reads as backslide). Clock rows never color:
// a circular mean doesn't have a simple higher/lower-is-better reading.
function MetricRow({ metric, weekly, todayIdx, onSetDay, onSetGoal, registerCellRef, onCellKeyDown }) {
  const total = metricTotal(weekly, metric);
  const avg = metricAverage(weekly, metric);
  const goal = weekly.metricsGoals?.[metric.id];
  const goalState = metricGoalState(weekly, metric, goal);
  const totalDisplay = metric.rollup === "sumFraction" ? `${total ?? 0}/7` : fmtMetricValue(metric, total);
  const avgDisplay = metric.rollup === "meanCircular" ? clockFromMinutes(avg) || "—" : fmtMetricValue(metric, avg);
  return (
    <div className="wk-dm-row">
      <span className="wk-dm-lab">{metric.label}</span>
      {METRICS_DAYS.map((_, day) => {
        const v = weekly.metrics?.[metric.id]?.[day];
        const set = (val) => onSetDay(metric.id, day, val);
        const cellRef = el => registerCellRef(metric.id, day, el);
        const keyDown = e => onCellKeyDown(metric, day, e);
        return (
          <span key={day} className={"wk-dm-cell" + (day === todayIdx ? " today" : "")}>
            {metric.kind === "yesno"
              ? <MetricYesNoToggle value={v} onChange={set} inputRef={cellRef} onKeyDown={keyDown} />
              : metric.kind === "clock"
                ? <MetricClockInput value={v} onChange={set} className="wk-dm-in" inputRef={cellRef} onKeyDown={keyDown} />
                : <MetricNumberInput kind={metric.kind} value={v} onChange={set} className="wk-dm-in" inputRef={cellRef} onKeyDown={keyDown} />}
          </span>
        );
      })}
      <span className="wk-dm-roll">{totalDisplay}</span>
      <span className="wk-dm-roll">{avgDisplay}</span>
      <span className={"wk-dm-goal " + goalState}>
        {metric.rollup === "meanCircular"
          ? <MetricClockInput value={goal} onChange={v => onSetGoal(metric.id, v)} className="wk-dm-in" />
          : <MetricNumberInput kind={goalInputKind(metric)} value={goal} onChange={v => onSetGoal(metric.id, v)} className="wk-dm-in" />}
      </span>
    </div>
  );
}

// Auto-growing single-field editor. These columns are narrow and the real
// content is long ("Outsource daily metrics and review weekly metrics
// patterns"), so a plain input silently clips it — the text has to wrap. Enter
// still belongs to the list handlers, which preventDefault before a newline
// can land, so this never becomes a multi-line free-for-all.
const AutoText = forwardRef(function AutoText({ value, className, placeholder, onChange, onKeyDown }, ref) {
  const inner = useRef(null);
  const attach = (el) => {
    inner.current = el;
    if (typeof ref === "function") ref(el); else if (ref) ref.current = el;
  };
  const fit = (el) => { el.style.height = "0px"; el.style.height = el.scrollHeight + "px"; };
  useEffect(() => { if (inner.current) fit(inner.current); }, [value]);
  // Height also has to be re-measured when the column WIDTH changes — the band
  // reflows at 1240/900 and on any window resize, and a height measured at the
  // old width leaves big dead gaps between rows. Guarded on width so setting
  // our own height can't feed the observer back into a loop.
  useEffect(() => {
    const el = inner.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    let lastW = el.clientWidth;
    const ro = new ResizeObserver(() => {
      if (el.clientWidth === lastW) return;
      lastW = el.clientWidth;
      fit(el);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <textarea ref={attach} rows={1} className={className} value={value} placeholder={placeholder}
      onChange={onChange} onKeyDown={onKeyDown} spellCheck={false} />
  );
});

// One Glance cell: a stack of short lines rather than a wrapped textarea, so 7
// columns stay legible and each entry stays individually addressable. Same
// keyboard model as WeeklyList — Enter opens the next line, Backspace on an
// empty one removes it.
function GlanceCell({ items, today, onAdd, onSet, onRemove }) {
  const [focusId, setFocusId] = useState(null);
  const refs = useRef({});
  useEffect(() => {
    if (focusId && refs.current[focusId]) { refs.current[focusId].focus(); setFocusId(null); }
  }, [focusId, items]);
  const append = (afterId) => { const id = uid(); onAdd(id, afterId); setFocusId(id); };
  return (
    <div className={"wk-cell" + (today ? " today" : "")}>
      {items.map((it, i) => (
        <AutoText key={it.id} className="wk-cell-in" value={it.text} placeholder=""
          ref={el => { refs.current[it.id] = el; }}
          onChange={e => onSet(it.id, e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter") { e.preventDefault(); append(it.id); }
            else if (e.key === "Backspace" && it.text === "") {
              e.preventDefault();
              const prev = items[i - 1];
              onRemove(it.id);
              if (prev) setFocusId(prev.id);
            }
          }} />
      ))}
      <button className="wk-cell-add" onClick={() => append(null)} aria-label="Add entry">+</button>
    </div>
  );
}

// Four established hues, not a new rainbow — red stays reserved for actual
// alarms per the project rule, so it's deliberately absent here even though
// it'd be an "obvious" fourth line color.
const STATE_COLORS = { dayRating: "var(--flare)", mood: "var(--violet)", energy: "var(--gold)", stress: "var(--holo)" };

// Trend of the four 1–10 "state" metrics (Day Rating / Mood / Energy /
// Stress) across the week — a different view of exactly what the Daily
// Metrics Log already stores, not a new data source. A day with no entry
// yet breaks the line rather than dropping it to 0, since 0 isn't a valid
// reading on a 1–10 scale.
function WeekStateChart({ weekly, now }) {
  const days = metricsDates(now); // SUN–SAT, same order the metrics log uses
  const todayIdx = days.findIndex(d => d.toDateString() === now.toDateString());
  const stateMetrics = METRICS.filter(m => m.group === "state");
  // No preserveAspectRatio="none" — the SVG's intrinsic height instead scales
  // proportionally with the viewBox (see the CSS: width:100%, no fixed
  // height). A mismatched viewBox + "none" would silently stretch circles
  // into ellipses and squash any text; this way the aspect ratio always
  // matches by construction, so nothing distorts at any column width.
  //
  // Day labels live INSIDE this SVG (not a separate HTML grid below it) and
  // share xAt() with the data points, so label and point are guaranteed to
  // line up — a CSS grid centers each label in an equal 1/7 slice, which is
  // a different spacing convention than the edge-to-edge i/6 placement the
  // points use, and the two would drift apart under that approach.
  const W = 560, H = 140, padL = 26, padR = 14, padT = 10, plotBottom = 108, dayLabelY = 128;
  const xAt = (i) => padL + (i / 6) * (W - padL - padR);
  const yAt = (v) => plotBottom - ((v - 1) / 9) * (plotBottom - padT); // 1..10, 1 at the bottom
  const [hover, setHover] = useState(null); // { metric, day, value }

  // Never plot past today, even if a value technically exists for a later
  // day (out-of-order entry, stray test data). The axis stays full-width —
  // only what's actually been lived through gets drawn.
  const lastDay = todayIdx >= 0 ? todayIdx : 6;
  const lines = stateMetrics.map(m => {
    const segments = [];
    let seg = [];
    for (let d = 0; d <= lastDay; d++) {
      const v = weekly.metrics?.[m.id]?.[d];
      if (v === undefined || v === null || v === "") { if (seg.length) segments.push(seg); seg = []; continue; }
      seg.push([d, Number(v)]);
    }
    if (seg.length) segments.push(seg);
    return { metric: m, segments };
  });
  const hasAnyData = lines.some(l => l.segments.some(s => s.length));

  // Hit circles render in a separate final pass (not interleaved per-metric)
  // so a hover target is never covered by a LATER metric's line drawn on top
  // of it in SVG paint order — every point stays reachable regardless of
  // which of the 4 lines happens to pass closest to it.
  const allPoints = lines.flatMap(({ metric, segments }) =>
    segments.flatMap(seg => seg.map(([d, v]) => ({ metric, d, v }))));

  let tip = null;
  if (hover) {
    const px = xAt(hover.d), py = yAt(hover.value);
    const boxW = 76, boxH = 30;
    const bx = Math.max(padL, Math.min(W - padR - boxW, px - boxW / 2));
    const above = py - boxH - 9 >= padT;
    const by = above ? py - boxH - 9 : py + 9;
    tip = { bx, by, boxW, boxH, cx: bx + boxW / 2 };
  }

  return (
    <section className="wk-mod f-instr">
      <div className="wk-mod-head"><span>Week State</span><span className="wk-tag">day rating · mood · energy · stress</span></div>
      {!hasAnyData ? (
        <div className="wk-empty">no daily metrics logged yet this cycle</div>
      ) : (
        <>
          <svg viewBox={`0 0 ${W} ${H}`} className="wk-chart-svg">
            {[1, 4, 7, 10].map(v => (
              <g key={v}>
                <line x1={padL} x2={W - padR} y1={yAt(v)} y2={yAt(v)} className="wk-chart-grid" />
                <text x={padL - 5} y={yAt(v)} textAnchor="end" dominantBaseline="central" className="wk-chart-ylab">{v}</text>
              </g>
            ))}
            {todayIdx >= 0 && <line x1={xAt(todayIdx)} x2={xAt(todayIdx)} y1={padT} y2={dayLabelY - 4} className="wk-chart-today" />}
            {METRICS_DAYS.map((d, i) => (
              <text key={d} x={xAt(i)} y={dayLabelY} textAnchor="middle"
                className={"wk-chart-daylab" + (i === todayIdx ? " today" : "")}>{d.slice(0, 2)}</text>
            ))}
            {lines.map(({ metric, segments }) => (
              <g key={metric.id}>
                {segments.map((seg, si) => (
                  <polyline key={si} points={seg.map(([d, v]) => `${xAt(d)},${yAt(v)}`).join(" ")}
                    fill="none" stroke={STATE_COLORS[metric.id]} strokeWidth="1.6" />
                ))}
                {segments.flat().map(([d, v]) => (
                  <circle key={d} cx={xAt(d)} cy={yAt(v)} r={d === todayIdx ? 3 : 2} fill={STATE_COLORS[metric.id]} />
                ))}
              </g>
            ))}
            {allPoints.map(({ metric, d, v }) => (
              <circle key={metric.id + d} cx={xAt(d)} cy={yAt(v)} r="7" className="wk-chart-hit"
                onMouseEnter={() => setHover({ metric, d, value: v })}
                onMouseLeave={() => setHover(h => (h && h.metric.id === metric.id && h.d === d ? null : h))} />
            ))}
            {tip && (
              <g className="wk-chart-tip">
                <rect x={tip.bx} y={tip.by} width={tip.boxW} height={tip.boxH} rx="2" />
                <text x={tip.cx} y={tip.by + 11} textAnchor="middle" className="wk-chart-tip-lab">{hover.metric.label}</text>
                <text x={tip.cx} y={tip.by + 24} textAnchor="middle" className="wk-chart-tip-val" fill={STATE_COLORS[hover.metric.id]}>
                  {hover.value} · {METRICS_DAYS[hover.d].slice(0, 3)}
                </text>
              </g>
            )}
          </svg>
        </>
      )}
      <div className="wk-chart-legend">
        {stateMetrics.map(m => (
          <span className="wk-chart-chip" key={m.id}><i style={{ background: STATE_COLORS[m.id] }} />{m.label}</span>
        ))}
      </div>
    </section>
  );
}

// 31 rows, banded into 7 labelled groups (state / sleep / focus & growth /
// body / faith & discipline / finance / relationships & planning) in the
// sheet's own order — a thin header row between bands, not nested boxes, so
// the table stays one scannable instrument instead of 7 stacked panels.
function DailyMetricsLog({ weekly, ritual, now, onSetDay, onSetGoal, onCloseWeek, onClearGrid }) {
  const days = metricsDates(now);
  const todayIdx = days.findIndex(d => d.toDateString() === now.toDateString());
  const [clearArmed, setClearArmed] = useState(false);
  const [closedMsg, setClosedMsg] = useState("");
  const armTimer = useRef(null);

  // Tab moves down the column (same day, next metric) instead of across the
  // row (same metric, next day) — entry happens one day at a time, filling
  // all 31 metrics for that day before moving on, so that's the order that
  // should feel natural. Native DOM tab order can't express this on its own
  // since the grid is laid out metric-major (rows), not day-major.
  const cellRefs = useRef({});
  const registerCellRef = (metricId, day, el) => {
    const key = metricId + ":" + day;
    if (el) cellRefs.current[key] = el; else delete cellRefs.current[key];
  };
  const onCellKeyDown = (metric, day, e) => {
    if (e.key !== "Tab") return;
    const idx = METRICS.findIndex(m => m.id === metric.id);
    let nextIdx = idx + (e.shiftKey ? -1 : 1);
    let nextDay = day;
    if (nextIdx < 0) { nextIdx = METRICS.length - 1; nextDay = day - 1; }
    else if (nextIdx >= METRICS.length) { nextIdx = 0; nextDay = day + 1; }
    if (nextDay < 0 || nextDay > 6) return; // edge of the whole grid — let native Tab take over
    const el = cellRefs.current[METRICS[nextIdx].id + ":" + nextDay];
    if (!el) return;
    e.preventDefault();
    el.focus();
    el.select?.();
  };

  const pressClear = () => {
    if (!clearArmed) {
      setClearArmed(true);
      armTimer.current = setTimeout(() => setClearArmed(false), 3000);
      return;
    }
    clearTimeout(armTimer.current);
    setClearArmed(false);
    onClearGrid();
  };
  const pressClose = () => {
    onCloseWeek();
    setClosedMsg(`closed · week ${weekNumber(now)}`);
    setTimeout(() => setClosedMsg(""), 3500);
  };
  useEffect(() => () => clearTimeout(armTimer.current), []);

  return (
    <section className="wk-mod f-dm">
      <div className="wk-mod-head">
        <span>Daily Metrics Log</span>
        <span className="wk-tag">sun–sat · goal color: bright cyan = hitting goal, red = missing it</span>
        <span className="wk-dm-actions">
          {closedMsg && <span className="wk-dm-msg">{closedMsg}</span>}
          <button className="wk-dm-btn" onClick={pressClose}>close week</button>
          <button className={"wk-dm-btn warn" + (clearArmed ? " armed" : "")} onClick={pressClear}>
            {clearArmed ? "confirm clear ⚠" : "clear grid"}
          </button>
        </span>
      </div>
      <div className="wk-dm-scroll">
        <div className="wk-dm-table">
          <div className="wk-dm-row wk-dm-head-row">
            <span className="wk-dm-lab" />
            {METRICS_DAYS.map((d, i) => (
              <span key={d} className={"wk-dm-cell wk-dm-daylab" + (i === todayIdx ? " today" : "")}>
                {d.slice(0, 3)}<i>{days[i].getDate()}</i>
              </span>
            ))}
            <span className="wk-dm-roll">Total</span>
            <span className="wk-dm-roll">Avg</span>
            <span className="wk-dm-roll">Goal</span>
          </div>
          {METRIC_GROUPS.map(g => (
            <div className="wk-dm-band" key={g.key}>
              <div className="wk-dm-band-lab">{g.label}</div>
              {METRICS.filter(m => m.group === g.key).map(m => (
                <MetricRow key={m.id} metric={m} weekly={weekly} todayIdx={todayIdx}
                  onSetDay={onSetDay} onSetGoal={onSetGoal}
                  registerCellRef={registerCellRef} onCellKeyDown={onCellKeyDown} />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="wk-dm-foot">
        {ritual.done}/{ritual.total} ritual steps done · outsourcing this row is a one-way write —
        Weekly Overview never reads it back
      </div>
    </section>
  );
}

// Weekly planning ritual. Two persistence rules live side by side here and must
// stay separate: step text/order edit the forward-carrying template, while the
// checkbox writes this week's completion only.
function RitualList({ steps, checked, done, total, onToggle, onSet, onMove, onAdd, onRemove }) {
  const [focusId, setFocusId] = useState(null);
  const refs = useRef({});
  useEffect(() => {
    if (focusId && refs.current[focusId]) { refs.current[focusId].focus(); setFocusId(null); }
  }, [focusId, steps]);
  const pct = total > 0 ? (done / total) * 100 : 0;
  return (
    <section className="wk-mod f-spine">
      <div className="wk-mod-head"><span>Weekly Planning</span><span className="wk-tag">template persists</span></div>
      <div className="wk-ritual-prog">
        <span className="wk-ritual-count">{String(done).padStart(2, "0")}<i>/{total}</i></span>
        <span className="wk-ritual-bar"><i style={{ width: pct + "%" }} /></span>
      </div>
      <ol className="wk-steps">
        {steps.map((s, i) => (
          <li key={s.id} className={"wk-step" + (checked[s.id] ? " on" : "")}>
            <button className="wk-check" onClick={() => onToggle(s.id)}
              aria-label={checked[s.id] ? "Mark incomplete" : "Mark complete"}>
              {checked[s.id] ? "◼" : "◻"}
            </button>
            <span className="wk-step-n">{String(i + 1).padStart(2, "0")}</span>
            <AutoText className="wk-in wk-step-in" value={s.text}
              ref={el => { refs.current[s.id] = el; }}
              onChange={e => onSet(s.id, e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); const id = uid(); onAdd(id, s.id); setFocusId(id); } }} />
            <span className="wk-step-tools">
              <button onClick={() => onMove(s.id, -1)} disabled={i === 0} aria-label="Move up">▴</button>
              <button onClick={() => onMove(s.id, 1)} disabled={i === steps.length - 1} aria-label="Move down">▾</button>
              <button onClick={() => onRemove(s.id)} aria-label="Remove step">✕</button>
            </span>
          </li>
        ))}
      </ol>
      <button className="wk-add" onClick={() => { const id = uid(); onAdd(id, null); setFocusId(id); }}>+ add step</button>
    </section>
  );
}

// ── Weekly Metrics Outsourcing (Build 1 — passive archive, read-only) ──
// Receives what Weekly Overview's Close Week sends; never writes back, never
// logs directly. Build 2 (streaks, regression/correlation, free-pick viz,
// Kaniel narration) is a separate future session — nothing here reaches for
// any of that.
const outsourcingWeekVacant = (row) => Object.values(row.values).every(v => v == null);

function WeekGlance({ row }) {
  if (outsourcingWeekVacant(row)) return <span className="mo-week-tag">no data logged</span>;
  const dayRating = METRICS.find(m => m.id === "dayRating");
  const sleepHrs = METRICS.find(m => m.id === "sleepHrs");
  const steps = METRICS.find(m => m.id === "steps");
  return (
    <span className="mo-week-glance">
      <span><b>{fmtMetricValue(dayRating, row.values.dayRating)}</b> rating</span>
      <span><b>{fmtMetricValue(sleepHrs, row.values.sleepHrs)}</b> sleep</span>
      <span><b>{fmtMetricValue(steps, row.values.steps)}</b> steps</span>
    </span>
  );
}

function WeekDetail({ row }) {
  if (!row) return <div className="empty-s">select a week from the archive</div>;
  const vacant = outsourcingWeekVacant(row);
  return (
    <div className="mo-detail">
      <div className="mo-detail-head">
        <span className="mo-detail-wk">Week {row.weekNumber}</span>
        <span className="mo-detail-range">{weekRangeLabel(row.weekKey)}</span>
      </div>
      {vacant ? (
        <div className="bz-empty">no data logged this week</div>
      ) : METRIC_GROUPS.map(g => (
        <div className="mo-detail-band" key={g.key}>
          <div className="wk-dm-band-lab">{g.label}</div>
          <div className="mo-detail-grid">
            {METRICS.filter(m => m.group === g.key).map(m => {
              const v = row.values[m.id];
              const display = v == null ? "—"
                : m.rollup === "sumFraction" ? `${v}/7`
                : m.rollup === "meanCircular" ? (clockFromMinutes(v) || "—")
                : fmtMetricValue(m, v);
              return (
                <div className="mo-detail-cell" key={m.id}>
                  <span className="mo-detail-lab">{m.label}</span>
                  <span className="mo-detail-val">{display}</span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function ArchiveView({ rows, selectedKey, onSelect }) {
  const selected = rows.find(r => r.weekKey === selectedKey) || rows[0] || null;
  if (rows.length === 0) {
    return <div className="empty"><div className="empty-t">no archived weeks yet</div>
      <div className="empty-s">nothing arrives here until Weekly Overview closes a week</div></div>;
  }
  return (
    <div className="mo-archive">
      <div className="mo-weeklist">
        {rows.map(r => (
          <button key={r.weekKey} type="button"
            className={"mo-week-row" + (r.weekKey === (selectedKey ?? rows[0].weekKey) ? " active" : "") + (outsourcingWeekVacant(r) ? " vacant" : "")}
            onClick={() => onSelect(r.weekKey)}>
            <span className="mo-week-n">WK {r.weekNumber}</span>
            <span className="mo-week-range">{weekRangeLabel(r.weekKey)}</span>
            <WeekGlance row={r} />
          </button>
        ))}
      </div>
      <WeekDetail row={selected} />
    </div>
  );
}

// Y-domain auto-fits the actual data range per metric — a fixed scale (like
// Week State's 1–10) doesn't generalize across 31 metrics with wildly
// different units. Clock metrics (Bedtime/Wake) pivot around noon before
// scaling, same reasoning as the goal-hit coloring in Daily Metrics Log: a
// raw 0–1439 axis would plot 23:50 and 00:05 at opposite ends even though
// they're 15 minutes apart, and this real dataset's bedtimes actually cross
// that boundary week to week.
function MetricTrendChart({ metric, series }) {
  const [hover, setHover] = useState(null);
  const isClock = metric.kind === "clock";
  const plot = (v) => (isClock ? pivotMinutes(v) : v);
  const unplot = (v) => (isClock ? unpivotMinutes(v) : v);
  const fmtAxis = (v) => (isClock ? clockFromMinutes(unplot(v)) : fmtMetricValue(metric, unplot(v)));

  const W = Math.max(620, series.length * 26), H = 190;
  const padL = 44, padR = 16, padT = 12, plotBottom = 140, dayLabelY = 164;
  const xAt = (i) => padL + (series.length <= 1 ? 0 : (i / (series.length - 1)) * (W - padL - padR));

  const plotted = series.map(s => plot(s.value));
  let lo = Math.min(...plotted), hi = Math.max(...plotted);
  if (lo === hi) { lo -= 1; hi += 1; }
  const pad = (hi - lo) * 0.12;
  lo -= pad; hi += pad;
  const yAt = (v) => plotBottom - ((v - lo) / (hi - lo)) * (plotBottom - padT);

  const gridVals = [lo + (hi - lo) * 0.05, lo + (hi - lo) * 0.5, hi - (hi - lo) * 0.05];
  const points = series.map((s, i) => ({ x: xAt(i), y: yAt(plot(s.value)), s }));

  let tip = null;
  if (hover) {
    const p = points[hover];
    const boxW = 96, boxH = 32;
    const bx = Math.max(0, Math.min(W - boxW, p.x - boxW / 2));
    const above = p.y - boxH - 9 >= padT;
    tip = { bx, by: above ? p.y - boxH - 9 : p.y + 9, boxW, boxH, cx: bx + boxW / 2, s: p.s };
  }

  return (
    <div className="mo-trend-scroll">
      <svg viewBox={`0 0 ${W} ${H}`} className="wk-chart-svg mo-trend-svg">
        {gridVals.map((v, i) => (
          <g key={i}>
            <line x1={padL} x2={W - padR} y1={yAt(v)} y2={yAt(v)} className="wk-chart-grid" />
            <text x={padL - 6} y={yAt(v)} textAnchor="end" dominantBaseline="central" className="wk-chart-ylab">{fmtAxis(v)}</text>
          </g>
        ))}
        <polyline points={points.map(p => `${p.x},${p.y}`).join(" ")} fill="none" stroke="var(--holo)" strokeWidth="1.6" />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="2.2" fill="var(--holo)" />
        ))}
        {series.map((s, i) => (
          <text key={s.weekKey} x={xAt(i)} y={dayLabelY} textAnchor="middle" className="wk-chart-daylab">{s.weekNumber}</text>
        ))}
        {points.map((p, i) => (
          <circle key={"hit" + i} cx={p.x} cy={p.y} r="8" className="wk-chart-hit"
            onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(h => (h === i ? null : h))} />
        ))}
        {tip && (
          <g className="wk-chart-tip">
            <rect x={tip.bx} y={tip.by} width={tip.boxW} height={tip.boxH} rx="2" />
            <text x={tip.cx} y={tip.by + 12} textAnchor="middle" className="wk-chart-tip-lab">week {tip.s.weekNumber}</text>
            <text x={tip.cx} y={tip.by + 25} textAnchor="middle" className="wk-chart-tip-val" fill="var(--holo)">
              {isClock ? clockFromMinutes(tip.s.value) : fmtMetricValue(metric, tip.s.value)}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}

// Calendar-time windows, not "last N data points" — a vacation week already
// drops out of outsourcingSeries entirely, so counting surviving points would
// silently stretch "2 months" to cover however far back it took to find 8
// real ones. Filtering by actual date keeps the label honest.
const TREND_RANGES = [
  { key: "2mo", label: "2 Months", days: 61 },
  { key: "q", label: "Quarter", days: 91 },
  { key: "6mo", label: "6 Months", days: 183 },
  { key: "all", label: "All Time", days: null },
];

function TrendView({ store, now, metricId, onMetricChange, rangeKey, onRangeChange }) {
  const metric = METRICS.find(m => m.id === metricId);
  const fullSeries = outsourcingSeries(store, metricId);
  const range = TREND_RANGES.find(r => r.key === rangeKey) || TREND_RANGES[TREND_RANGES.length - 1];
  const series = range.days == null ? fullSeries : (() => {
    const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() - range.days);
    const cutoffKey = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, "0")}-${String(cutoff.getDate()).padStart(2, "0")}`;
    return fullSeries.filter(s => s.weekKey >= cutoffKey);
  })();
  return (
    <div className="mo-trend">
      <div className="mo-trend-head">
        <span className="wk-tag">one metric · build 2 adds regression, streaks, overlays</span>
        <span className="mo-ranges">
          {TREND_RANGES.map(r => (
            <button key={r.key} className={"mo-range-btn" + (r.key === range.key ? " active" : "")}
              onClick={() => onRangeChange(r.key)}>{r.label}</button>
          ))}
        </span>
        <select className="mo-select" value={metricId} onChange={e => onMetricChange(e.target.value)} aria-label="Metric">
          {METRIC_GROUPS.map(g => (
            <optgroup key={g.key} label={g.label}>
              {METRICS.filter(m => m.group === g.key).map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
            </optgroup>
          ))}
        </select>
      </div>
      {fullSeries.length === 0 ? (
        <div className="empty-s">no archived weeks have a value for {metric.label} yet</div>
      ) : series.length === 0 ? (
        <div className="empty-s">no archived weeks for {metric.label} in this range — try a wider one</div>
      ) : <MetricTrendChart metric={metric} series={series} />}
    </div>
  );
}

// ═══ Weekly Metrics Outsourcing — Build 2: analysis toolkit ═══
// Sits on top of Build 1's archive; never touches store.metricsOutsourcing.rows
// or the Archive view. All math lives in store.js — components here only
// call it, format it, and chart it.

function MetricSelect({ value, onChange, label }) {
  return (
    <select className="mo-select" value={value} onChange={e => onChange(e.target.value)} aria-label={label || "Metric"}>
      {METRIC_GROUPS.map(g => (
        <optgroup key={g.key} label={g.label}>
          {METRICS.filter(m => m.group === g.key).map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
        </optgroup>
      ))}
    </select>
  );
}
// A plotted (pivoted, for clock metrics) value back to a human-readable string.
const fmtPlotted = (metric, v) => (metric.kind === "clock" ? clockFromMinutes(unpivotMinutes(v)) : fmtMetricValue(metric, v));

// ── Mode A — Metric vs Metric scatter + regression ──
function ScatterChart({ xMetric, yMetric, pairs, regression }) {
  const [hover, setHover] = useState(null);
  const W = 640, H = 300, padL = 52, padR = 20, padT = 16, padB = 34;
  const xs = pairs.map(p => p.x), ys = pairs.map(p => p.y);
  let xLo = Math.min(...xs), xHi = Math.max(...xs), yLo = Math.min(...ys), yHi = Math.max(...ys);
  if (xLo === xHi) { xLo -= 1; xHi += 1; }
  if (yLo === yHi) { yLo -= 1; yHi += 1; }
  const xPad = (xHi - xLo) * 0.1, yPad = (yHi - yLo) * 0.1;
  xLo -= xPad; xHi += xPad; yLo -= yPad; yHi += yPad;
  const xAt = (v) => padL + ((v - xLo) / (xHi - xLo)) * (W - padL - padR);
  const yAt = (v) => (H - padB) - ((v - yLo) / (yHi - yLo)) * (H - padB - padT);
  const xGrid = [xLo + (xHi - xLo) * 0.06, (xLo + xHi) / 2, xHi - (xHi - xLo) * 0.06];
  const yGrid = [yLo + (yHi - yLo) * 0.08, (yLo + yHi) / 2, yHi - (yHi - yLo) * 0.08];
  const regY1 = regression.slope * xLo + regression.intercept, regY2 = regression.slope * xHi + regression.intercept;

  let tip = null;
  if (hover != null) {
    const p = pairs[hover];
    const boxW = 118, boxH = 34;
    const px = xAt(p.x), py = yAt(p.y);
    const bx = Math.max(0, Math.min(W - boxW, px - boxW / 2));
    const above = py - boxH - 9 >= padT;
    tip = { bx, by: above ? py - boxH - 9 : py + 9, boxW, boxH, cx: bx + boxW / 2, p };
  }

  return (
    <div className="mo-trend-scroll">
      <svg viewBox={`0 0 ${W} ${H}`} className="wk-chart-svg mo-scatter-svg">
        {yGrid.map((v, i) => (
          <g key={"y" + i}>
            <line x1={padL} x2={W - padR} y1={yAt(v)} y2={yAt(v)} className="wk-chart-grid" />
            <text x={padL - 6} y={yAt(v)} textAnchor="end" dominantBaseline="central" className="wk-chart-ylab">{fmtPlotted(yMetric, v)}</text>
          </g>
        ))}
        {xGrid.map((v, i) => (
          <text key={"x" + i} x={xAt(v)} y={H - padB + 14} textAnchor="middle" className="wk-chart-daylab">{fmtPlotted(xMetric, v)}</text>
        ))}
        <line x1={xAt(xLo)} y1={yAt(regY1)} x2={xAt(xHi)} y2={yAt(regY2)} stroke="var(--gold)" strokeWidth="1.4" strokeDasharray="4 3" />
        {pairs.map((p, i) => <circle key={i} cx={xAt(p.x)} cy={yAt(p.y)} r="2.6" fill="var(--holo)" />)}
        {pairs.map((p, i) => (
          <circle key={"hit" + i} cx={xAt(p.x)} cy={yAt(p.y)} r="8" className="wk-chart-hit"
            onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(h => (h === i ? null : h))} />
        ))}
        {tip && (
          <g className="wk-chart-tip">
            <rect x={tip.bx} y={tip.by} width={tip.boxW} height={tip.boxH} rx="2" />
            <text x={tip.cx} y={tip.by + 12} textAnchor="middle" className="wk-chart-tip-lab">week {tip.p.weekNumber}</text>
            <text x={tip.cx} y={tip.by + 25} textAnchor="middle" className="wk-chart-tip-val" fill="var(--holo)" fontSize="9">
              {fmtPlotted(xMetric, tip.p.x)} · {fmtPlotted(yMetric, tip.p.y)}
            </text>
          </g>
        )}
      </svg>
      <div className="mo-axis-labels"><span>{xMetric.label} →</span><span>↑ {yMetric.label}</span></div>
    </div>
  );
}

function RegressionScatterView({ store }) {
  const [xId, setXId] = useState("dayRating");
  const [yId, setYId] = useState("sleepHrs");
  const xMetric = METRICS.find(m => m.id === xId), yMetric = METRICS.find(m => m.id === yId);
  const pairs = metricPairSeries(store, xId, yId);
  const enough = pairs.length >= CORR_MIN_WEEKS;
  const regression = enough ? linearRegression(pairs.map(p => p.x), pairs.map(p => p.y)) : null;
  const lagPairs = laggedPairSeries(store, xId, yId);
  const lagEnough = lagPairs.length >= LAG_MIN_WEEKS;
  const lagR = lagEnough ? pearsonR(lagPairs.map(p => p.x), lagPairs.map(p => p.y)) : null;

  return (
    <div className="mo-analysis">
      <div className="mo-analysis-head">
        <span className="wk-tag">each archived week is one point · needs {CORR_MIN_WEEKS}+ overlapping weeks</span>
        <span className="mo-pair-picks">
          <MetricSelect value={xId} onChange={setXId} label="X metric" />
          <span className="mo-pair-vs">vs</span>
          <MetricSelect value={yId} onChange={setYId} label="Y metric" />
        </span>
      </div>
      {!enough || !regression ? (
        <div className="empty-s">only {pairs.length} overlapping week{pairs.length === 1 ? "" : "s"} for {xMetric.label} vs {yMetric.label} — need at least {CORR_MIN_WEEKS}</div>
      ) : (
        <>
          <ScatterChart xMetric={xMetric} yMetric={yMetric} pairs={pairs} regression={regression} />
          <div className="mo-stat-row">
            <span className="mo-stat"><b>r</b> {regression.r.toFixed(2)}</span>
            <span className="mo-stat"><b>R²</b> {regression.r2.toFixed(2)}</span>
            <span className="mo-stat"><b>slope</b> {regression.slope.toFixed(3)}</span>
            <span className="mo-stat"><b>n</b> {pairs.length} weeks</span>
          </div>
          <div className="mo-lag-compare">
            <span className="mo-detail-lab" style={{ margin: 0 }}>Lagged (this week's {xMetric.label} → next week's {yMetric.label})</span>
            <span className="mo-lag-val">
              {!lagEnough
                ? `not enough shifted pairs yet (${lagPairs.length}/${LAG_MIN_WEEKS})`
                : <>same-week r <b>{regression.r.toFixed(2)}</b> · lagged r <b className={Math.abs(lagR) > Math.abs(regression.r) ? "hi" : ""}>{lagR.toFixed(2)}</b> ({lagPairs.length} pairs)</>}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

// ── Mode B — Metric vs Time, with regression trend line + moving average ──
function MetricRegressionChart({ metric, series, showMA }) {
  const [hover, setHover] = useState(null);
  const W = Math.max(620, series.length * 26), H = 200;
  const padL = 46, padR = 16, padT = 12, plotBottom = 150, dayLabelY = 174;
  const xAt = (i) => padL + (series.length <= 1 ? 0 : (i / (series.length - 1)) * (W - padL - padR));

  const idx = series.map((_, i) => i);
  const plotted = series.map(s => metricPlotValue(metric, s.value));
  const reg = linearRegression(idx, plotted);
  const ma = showMA ? movingAverage(plotted, 4) : null;

  const allVals = [...plotted, ...(ma ? ma.filter(v => v != null) : [])];
  let lo = Math.min(...allVals), hi = Math.max(...allVals);
  if (lo === hi) { lo -= 1; hi += 1; }
  const pad = (hi - lo) * 0.12; lo -= pad; hi += pad;
  const yAt = (v) => plotBottom - ((v - lo) / (hi - lo)) * (plotBottom - padT);
  const gridVals = [lo + (hi - lo) * 0.05, lo + (hi - lo) * 0.5, hi - (hi - lo) * 0.05];

  const points = series.map((s, i) => ({ x: xAt(i), y: yAt(plotted[i]), s }));
  const maPoints = ma ? ma.map((v, i) => (v == null ? null : { x: xAt(i), y: yAt(v) })).filter(Boolean) : [];
  const regY1 = reg ? yAt(reg.slope * 0 + reg.intercept) : null;
  const regY2 = reg ? yAt(reg.slope * (series.length - 1) + reg.intercept) : null;

  let tip = null;
  if (hover != null) {
    const p = points[hover];
    const boxW = 96, boxH = 32;
    const bx = Math.max(0, Math.min(W - boxW, p.x - boxW / 2));
    const above = p.y - boxH - 9 >= padT;
    tip = { bx, by: above ? p.y - boxH - 9 : p.y + 9, boxW, boxH, cx: bx + boxW / 2, s: p.s };
  }

  return (
    <div className="mo-trend-scroll">
      <svg viewBox={`0 0 ${W} ${H}`} className="wk-chart-svg mo-trend-svg">
        {gridVals.map((v, i) => (
          <g key={i}>
            <line x1={padL} x2={W - padR} y1={yAt(v)} y2={yAt(v)} className="wk-chart-grid" />
            <text x={padL - 6} y={yAt(v)} textAnchor="end" dominantBaseline="central" className="wk-chart-ylab">{fmtPlotted(metric, v)}</text>
          </g>
        ))}
        {reg && <line x1={xAt(0)} y1={regY1} x2={xAt(series.length - 1)} y2={regY2} stroke="var(--gold)" strokeWidth="1.3" strokeDasharray="4 3" />}
        {maPoints.length > 1 && <polyline points={maPoints.map(p => `${p.x},${p.y}`).join(" ")} fill="none" stroke="var(--violet)" strokeWidth="1.5" opacity="0.9" />}
        <polyline points={points.map(p => `${p.x},${p.y}`).join(" ")} fill="none" stroke="var(--holo)" strokeWidth="1.6" />
        {points.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="2.2" fill="var(--holo)" />)}
        {series.map((s, i) => <text key={s.weekKey} x={xAt(i)} y={dayLabelY} textAnchor="middle" className="wk-chart-daylab">{s.weekNumber}</text>)}
        {points.map((p, i) => (
          <circle key={"hit" + i} cx={p.x} cy={p.y} r="8" className="wk-chart-hit"
            onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(h => (h === i ? null : h))} />
        ))}
        {tip && (
          <g className="wk-chart-tip">
            <rect x={tip.bx} y={tip.by} width={tip.boxW} height={tip.boxH} rx="2" />
            <text x={tip.cx} y={tip.by + 12} textAnchor="middle" className="wk-chart-tip-lab">week {tip.s.weekNumber}</text>
            <text x={tip.cx} y={tip.by + 25} textAnchor="middle" className="wk-chart-tip-val" fill="var(--holo)">{fmtMetricValue(metric, tip.s.value)}</text>
          </g>
        )}
      </svg>
      <div className="mo-chart-legend">
        <span className="mo-legend-chip"><i style={{ background: "var(--holo)" }} />actual</span>
        <span className="mo-legend-chip"><i style={{ background: "var(--gold)" }} />trend line</span>
        {showMA && <span className="mo-legend-chip"><i style={{ background: "var(--violet)" }} />4-week avg</span>}
      </div>
    </div>
  );
}

function TrendRegressionView({ store, metricId, onMetricChange, showMA, onToggleMA }) {
  const metric = METRICS.find(m => m.id === metricId);
  const series = outsourcingSeries(store, metricId);
  const enough = series.length >= CORR_MIN_WEEKS;
  const reg = enough ? linearRegression(series.map((_, i) => i), series.map(s => metricPlotValue(metric, s.value))) : null;
  const perWeek = reg && metric.kind !== "clock" ? Math.abs(reg.slope) : null;
  return (
    <div className="mo-analysis">
      <div className="mo-analysis-head">
        <span className="wk-tag">one metric over every archived week · needs {CORR_MIN_WEEKS}+ weeks</span>
        <label className="mo-ma-toggle"><input type="checkbox" checked={showMA} onChange={e => onToggleMA(e.target.checked)} />4-wk moving avg</label>
        <MetricSelect value={metricId} onChange={onMetricChange} />
      </div>
      {!enough ? (
        <div className="empty-s">only {series.length} archived week{series.length === 1 ? "" : "s"} for {metric.label} — need at least {CORR_MIN_WEEKS}</div>
      ) : (
        <>
          <MetricRegressionChart metric={metric} series={series} showMA={showMA} />
          <div className="mo-stat-row">
            <span className="mo-stat"><b>{reg.slope > 0 ? "trending up" : reg.slope < 0 ? "trending down" : "flat"}</b>
              {perWeek != null && ` ~${perWeek.toFixed(2)}/week`}</span>
            <span className="mo-stat"><b>R²</b> {reg.r2.toFixed(2)}</span>
            <span className="mo-stat"><b>n</b> {series.length} weeks</span>
          </div>
        </>
      )}
    </div>
  );
}

function AnalysisView({ store }) {
  const [mode, setMode] = useState("metric");
  const [trendMetric, setTrendMetric] = useState("dayRating");
  const [showMA, setShowMA] = useState(true);
  return (
    <div className="mo-trend">
      <div className="mo-tabs mo-submode">
        <button className={"mo-tab" + (mode === "metric" ? " active" : "")} onClick={() => setMode("metric")}>Metric vs Metric</button>
        <button className={"mo-tab" + (mode === "time" ? " active" : "")} onClick={() => setMode("time")}>Metric vs Time</button>
      </div>
      {mode === "metric"
        ? <RegressionScatterView store={store} />
        : <TrendRegressionView store={store} metricId={trendMetric} onMetricChange={setTrendMetric} showMA={showMA} onToggleMA={setShowMA} />}
    </div>
  );
}

// ── Insights — Kaniel badge + streaks + outliers + correlations + stats ──
function InsightRow({ id, dismissed, onDismiss, children }) {
  if (dismissed.includes(id)) return null;
  return (
    <div className="mo-insight-row">
      <span className="mo-insight-body">{children}</span>
      <button className="mo-insight-x" onClick={() => onDismiss(id)} aria-label="Dismiss">✕</button>
    </div>
  );
}

function KanielBadge({ count }) {
  const [msg, setMsg] = useState("");
  const press = () => {
    setMsg("kaniel // narration offline — needs a backend, not wired yet");
    setTimeout(() => setMsg(""), 4200);
  };
  return (
    <div className="mo-kaniel-badge">
      <button className="mo-kaniel-btn" onClick={press}>
        <span className="mo-kaniel-tag">kaniel //</span>
        <span className="mo-kaniel-count">{count}</span> flagged this scan
      </button>
      {msg && <span className="mo-kaniel-msg">{msg}</span>}
    </div>
  );
}

function StreaksPanel({ streaks, dismissed, onDismiss }) {
  const visible = streaks.filter(s => !dismissed.includes(s.id));
  return (
    <section className="mo-insight-panel">
      <div className="wk-mod-head"><span>Active Streaks</span><span className="wk-tag">goal-hit + same-direction runs</span></div>
      {visible.length === 0 ? <div className="bz-empty">no active streaks right now</div> : streaks.map(s => {
        const metric = METRICS.find(m => m.id === s.metricId);
        return (
          <InsightRow key={s.id} id={s.id} dismissed={dismissed} onDismiss={onDismiss}>
            <b>{metric.label}</b> — {s.kind === "goal"
              ? <>{s.length}-week goal streak</>
              : <>{s.length}-week {s.direction} streak</>}
          </InsightRow>
        );
      })}
    </section>
  );
}
function OutliersPanel({ outliers, dismissed, onDismiss }) {
  const visible = outliers.filter(o => !dismissed.includes(o.id));
  return (
    <section className="mo-insight-panel">
      <div className="wk-mod-head"><span>Outliers</span><span className="wk-tag">z-score vs. each metric's own history</span></div>
      {visible.length === 0 ? <div className="bz-empty">nothing unusual flagged</div> : outliers.map(o => {
        const metric = METRICS.find(m => m.id === o.metricId);
        return (
          <InsightRow key={o.id} id={o.id} dismissed={dismissed} onDismiss={onDismiss}>
            <b>{metric.label}</b> — week {o.weekNumber} ({fmtMetricValue(metric, o.value)}), {Math.abs(o.z).toFixed(1)}σ {o.z > 0 ? "above" : "below"} norm
          </InsightRow>
        );
      })}
    </section>
  );
}
function CorrelationsPanel({ corrs, lagCorrs, dismissed, onDismiss }) {
  const visCorrs = corrs.filter(c => !dismissed.includes(c.id));
  const visLag = lagCorrs.filter(c => !dismissed.includes(c.id));
  return (
    <section className="mo-insight-panel">
      <div className="wk-mod-head"><span>Notable Correlations</span><span className="wk-tag">|r| ≥ 0.5 · same-week and 1-week-lagged</span></div>
      {visCorrs.length === 0 && visLag.length === 0 ? <div className="bz-empty">nothing strongly correlated yet</div> : (
        <>
          {corrs.map(c => {
            const x = METRICS.find(m => m.id === c.xId), y = METRICS.find(m => m.id === c.yId);
            return (
              <InsightRow key={c.id} id={c.id} dismissed={dismissed} onDismiss={onDismiss}>
                <b>{x.label}</b> ↔ <b>{y.label}</b> — r {c.r.toFixed(2)} ({c.n} weeks)
              </InsightRow>
            );
          })}
          {lagCorrs.map(c => {
            const x = METRICS.find(m => m.id === c.xId), y = METRICS.find(m => m.id === c.yId);
            return (
              <InsightRow key={c.id} id={c.id} dismissed={dismissed} onDismiss={onDismiss}>
                <b>{x.label}</b> → next week's <b>{y.label}</b> — lagged r {c.r.toFixed(2)} ({c.n} pairs)
              </InsightRow>
            );
          })}
        </>
      )}
    </section>
  );
}
function MetricStatsCard({ store, now, metricId, onMetricChange, rangeKey, onRangeChange }) {
  const metric = METRICS.find(m => m.id === metricId);
  const range = TREND_RANGES.find(r => r.key === rangeKey) || TREND_RANGES[TREND_RANGES.length - 1];
  const sinceKey = range.days == null ? null : (() => {
    const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() - range.days);
    return `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, "0")}-${String(cutoff.getDate()).padStart(2, "0")}`;
  })();
  const dist = metricDistribution(store, metricId, sinceKey);
  const hitRate = metricGoalHitRate(store, metricId);
  return (
    <section className="mo-insight-panel">
      <div className="wk-mod-head">
        <span>Metric Stats</span>
        <span className="mo-ranges">
          {TREND_RANGES.map(r => (
            <button key={r.key} className={"mo-range-btn" + (r.key === range.key ? " active" : "")} onClick={() => onRangeChange(r.key)}>{r.label}</button>
          ))}
        </span>
        <MetricSelect value={metricId} onChange={onMetricChange} />
      </div>
      {!dist ? <div className="bz-empty">no archived weeks for {metric.label} in this range</div> : (
        <div className="mo-detail-grid" style={{ marginTop: 6 }}>
          <div className="mo-detail-cell"><span className="mo-detail-lab">Mean</span><span className="mo-detail-val">{fmtPlotted(metric, dist.mean)}</span></div>
          <div className="mo-detail-cell"><span className="mo-detail-lab">Median</span><span className="mo-detail-val">{fmtPlotted(metric, dist.median)}</span></div>
          <div className="mo-detail-cell"><span className="mo-detail-lab">Std Dev</span><span className="mo-detail-val">{dist.stddev == null ? "—" : dist.stddev.toFixed(2)}</span></div>
          <div className="mo-detail-cell"><span className="mo-detail-lab">Min</span><span className="mo-detail-val">{fmtPlotted(metric, dist.min)}</span></div>
          <div className="mo-detail-cell"><span className="mo-detail-lab">Max</span><span className="mo-detail-val">{fmtPlotted(metric, dist.max)}</span></div>
          <div className="mo-detail-cell"><span className="mo-detail-lab">Weeks</span><span className="mo-detail-val">{dist.count}</span></div>
        </div>
      )}
      <div className="mo-goalrate">
        {!hitRate ? <span className="wk-tag">no current goal set for {metric.label} in Weekly Overview</span> : (
          <span>goal-hit rate (vs. today's goal) <b>{hitRate.pct.toFixed(0)}%</b> — {hitRate.hits}/{hitRate.total} weeks</span>
        )}
      </div>
    </section>
  );
}

function InsightsView({ store, now, onDismiss }) {
  const [statsMetric, setStatsMetric] = useState("dayRating");
  const [statsRange, setStatsRange] = useState("all");
  const dismissed = store.metricsOutsourcing.dismissedInsights;
  // 465 same-week pairs + 930 ordered lagged pairs over 38 real weeks runs in
  // single-digit milliseconds (checked directly) — no debounce/caching needed,
  // just keep it out of the render path on every keystroke elsewhere via useMemo.
  const streaks = useMemo(() => allActiveStreaks(store), [store]);
  const outliers = useMemo(() => allOutliers(store), [store]);
  const corrs = useMemo(() => allCorrelations(store), [store]);
  const lagCorrs = useMemo(() => allLaggedCorrelations(store), [store]);
  const flaggedCount = [...streaks, ...outliers, ...corrs, ...lagCorrs].filter(x => !dismissed.includes(x.id)).length;
  return (
    <div className="mo-insights">
      <KanielBadge count={flaggedCount} />
      <StreaksPanel streaks={streaks} dismissed={dismissed} onDismiss={onDismiss} />
      <OutliersPanel outliers={outliers} dismissed={dismissed} onDismiss={onDismiss} />
      <CorrelationsPanel corrs={corrs} lagCorrs={lagCorrs} dismissed={dismissed} onDismiss={onDismiss} />
      <MetricStatsCard store={store} now={now} metricId={statsMetric} onMetricChange={setStatsMetric}
        rangeKey={statsRange} onRangeChange={setStatsRange} />
    </div>
  );
}

function MetricsOutsourcingSector({ store, now, onDismissInsight }) {
  const [view, setView] = useState("archive");
  const [selectedKey, setSelectedKey] = useState(null);
  const [trendMetric, setTrendMetric] = useState(METRICS[0].id);
  const [trendRange, setTrendRange] = useState("all");
  const rows = outsourcingRows(store);
  return (
    <div className="zoneview fade-up">
      <div className="zv-head">
        <span className="zv-code">▥</span>
        <span className="zv-name">Weekly Metrics Outsourcing · live sector</span>
        {store.metricsOutsourcing.seeded && <span className="bz-mockbar">real historical figures · not yet from a live close</span>}
        <span className="mo-tabs">
          <button className={"mo-tab" + (view === "archive" ? " active" : "")} onClick={() => setView("archive")}>Archive</button>
          <button className={"mo-tab" + (view === "trend" ? " active" : "")} onClick={() => setView("trend")}>Trend</button>
          <button className={"mo-tab" + (view === "analysis" ? " active" : "")} onClick={() => setView("analysis")}>Analysis</button>
          <button className={"mo-tab" + (view === "insights" ? " active" : "")} onClick={() => setView("insights")}>Insights</button>
        </span>
      </div>
      <div className="mo-subnote">
        passive archive — receives Weekly Overview's Close Week output only; never logs directly, never writes back
      </div>
      {view === "archive" && <ArchiveView rows={rows} selectedKey={selectedKey} onSelect={setSelectedKey} />}
      {view === "trend" && (
        <TrendView store={store} now={now} metricId={trendMetric} onMetricChange={setTrendMetric}
          rangeKey={trendRange} onRangeChange={setTrendRange} />
      )}
      {view === "analysis" && <AnalysisView store={store} />}
      {view === "insights" && <InsightsView store={store} now={now} onDismiss={onDismissInsight} />}
    </div>
  );
}

// ── BUDGET SECTOR ──
// Money field that keeps its own text while focused, so typing "12." or "-" isn't
// eaten by a number round-trip. Commits a parsed number on every valid keystroke
// (empty → 0) and shows the formatted figure (1,234.50) when not focused.
function MoneyInput({ value, onChange, className = "bz-in money", placeholder = "0.00", negative = false }) {
  const [text, setText] = useState(null);
  const raw = value === "" || value == null || Number(value) === 0 ? "" : String(value);
  // typed text wins only while it still matches the stored value — if the parent
  // resets it (e.g. a spend was just logged) the field clears even while focused
  const typing = text !== null && (parseFloat(text) || 0) === (Number(value) || 0);
  const shown = typing ? text : (raw === "" ? "" : Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  const ok = negative ? /^-?\d*\.?\d{0,2}$/ : /^\d*\.?\d{0,2}$/;
  return (
    <input className={className} inputMode="decimal" value={shown} placeholder={placeholder}
      onFocus={() => setText(raw)} onBlur={() => setText(null)}
      onChange={e => {
        const t = e.target.value;
        if (!ok.test(t)) return;
        setText(t);
        const n = parseFloat(t);
        onChange(Number.isFinite(n) ? n : 0);
      }} />
  );
}

// Name + value rows shared by Capital on Hand (accounts) and Assets.
function BzValueList({ items, empty, addLabel, nameHolder, onAdd, onSet, onRemove }) {
  return (
    <>
      {items.length === 0 && <div className="bz-empty">{empty}</div>}
      {items.map(it => (
        <div key={it.id} className="bz-edit-row">
          <input className="bz-in" value={it.name} placeholder={nameHolder} onChange={e => onSet(it.id, "name", e.target.value)} />
          <MoneyInput value={it.value} negative onChange={v => onSet(it.id, "value", v)} />
          <button className="do-x" onClick={() => onRemove(it.id)} aria-label={"Remove " + (it.name || "row")}>✕</button>
        </div>
      ))}
      <button className="do-add" onClick={onAdd}>{addLabel}</button>
    </>
  );
}

// One category: live meter + quick-tap spend row, with an edit drawer for the
// monthly amount, an opening/correction figure, recent entries (undo) and delete.
function CategoryCard({ c, entries, open, onToggle, onSet, onLog, onUndo, onDelete }) {
  const [amt, setAmt] = useState(0);
  const [note, setNote] = useState("");
  const pct = categoryPct(c), state = categoryState(c);
  const lit = Math.min(20, Math.round((pct / 100) * 20));
  const submit = () => { if (!(amt > 0)) return; onLog(amt, note); setAmt(0); setNote(""); };
  const onEnter = (e) => { if (e.key === "Enter") submit(); };
  return (
    <div className={"bz-cat " + state}>
      <div className="bz-cat-head">
        <input className="bz-in" value={c.name} placeholder="category name" onChange={e => onSet("name", e.target.value)} />
        <span className="bz-cat-pct">{Math.round(pct)}%</span>
      </div>
      <div className="bz-meter">
        {Array.from({ length: 20 }).map((_, i) => <i key={i} className={i < lit ? "on" : ""} />)}
      </div>
      <div className="bz-cat-sub">
        {Number(c.budgeted) > 0
          ? <>{fmtMoney(c.spent)} of {fmtMoney(c.budgeted)} · {fmtMoney(c.budgeted - c.spent)} left</>
          : <>{fmtMoney(c.spent)} spent · no monthly budget set</>}
      </div>
      <div className="bz-spend" onKeyDown={onEnter}>
        <MoneyInput value={amt} onChange={setAmt} placeholder="spend $" />
        <input className="bz-in" value={note} placeholder="note" onChange={e => setNote(e.target.value)} />
        <button className="bz-log-btn" disabled={!(amt > 0)} onClick={submit}>log</button>
        <button className={"bz-edit-btn" + (open ? " on" : "")} aria-expanded={open} onClick={onToggle} title="edit category">⋯</button>
      </div>
      {open && (
        <div className="bz-cat-edit">
          <label><span>monthly budget</span><MoneyInput value={c.budgeted} onChange={v => onSet("budgeted", v)} /></label>
          <label><span>spent so far</span><MoneyInput value={c.spent} onChange={v => onSet("spent", v)} /></label>
          <div className="bz-cat-note">logging adds to spent so far · editing it directly sets an opening figure or corrects a slip</div>
          {entries.length === 0
            ? <div className="bz-empty">no entries logged this month</div>
            : entries.slice(0, 6).map(e => (
                <div key={e.id} className="bz-entry">
                  <span className="amt">{fmtMoney(e.amount)}</span>
                  <span className="note">{e.note || "—"}</span>
                  <span className="when">{e.at.slice(5, 10)}</span>
                  <button className="do-x" onClick={() => onUndo(e.id)} aria-label="Undo entry" title="undo this entry">✕</button>
                </div>
              ))}
          <button className="bz-del" onClick={onDelete}>delete category</button>
        </div>
      )}
    </div>
  );
}

// top-level on purpose: declared inside CloseOutDialog it would remount (and drop
// focus from its input) on every keystroke
function CloseOutLine({ label, start, end, first, onStart }) {
  const d = Math.round((end - start) * 100) / 100;
  return (
    <div className="co-line">
      <span className="k">{label}</span>
      {first
        ? <MoneyInput className="bz-in money co-start" value={start} negative onChange={onStart} />
        : <span className="co-start">{fmtMoney(start)}</span>}
      <span className="co-arrow">→</span>
      <span className="co-end">{fmtMoney(end)}</span>
      <span className={"co-io " + (d < 0 ? "neg" : "pos")}>{(d >= 0 ? "+" : "-") + fmtMoney(Math.abs(d))}</span>
    </div>
  );
}

// Month-end confirm. Shows exactly what will be snapshotted and reset, and never
// runs by itself — closing out zeroes category spending, so it waits for a yes.
// The snapshot uses the figures as they stand now, hence the nudge to update
// Capital on Hand / Assets first ("later" leaves everything untouched).
function CloseOutDialog({ budget, now, onConfirm, onLater }) {
  const [open, setOpen] = useState({});
  const p = closeOutPreview(budget, open, now);
  if (!p) return null;
  return (
    <div className="tile-modal-backdrop">
      <div className="tile-modal sync-dialog">
        <div className="tm-head"><span className="tm-title">month-end · close out {p.month}</span></div>
        <div className="sd-why">
          Before you confirm, make sure Capital on Hand and Assets show their real month-end balances — the snapshot uses the figures as they are right now.
        </div>
        <CloseOutLine label="Capital on Hand" start={p.capStart} end={p.capEnd} first={p.firstCapital} onStart={v => setOpen(o => ({ ...o, capitalStart: v }))} />
        <CloseOutLine label="Net Worth" start={p.nwStart} end={p.nwEnd} first={p.firstNetWorth} onStart={v => setOpen(o => ({ ...o, netWorthStart: v }))} />
        {(p.firstCapital || p.firstNetWorth) && <div className="co-note">first close-out — type what each figure was at the start of {p.month} (defaults to no change)</div>}
        <div className="co-note">
          Resets spending to $0.00 across {p.categoryCount} categor{p.categoryCount === 1 ? "y" : "ies"} · monthly budgets carry over · logged entries are kept.
          {p.over.length > 0 && <> Over budget this month: <b>{p.over.join(", ")}</b>.</>}
        </div>
        <div className="sd-actions" style={{ marginTop: 14 }}>
          <button className="sd-btn rec" onClick={() => onConfirm(open)}>close out {p.month}<small>snapshot + reset</small></button>
          <button className="sd-btn" onClick={onLater}>later<small>nothing changes</small></button>
        </div>
      </div>
    </div>
  );
}

// `write(fn)` runs fn on the budget slice and saves it — the same shape every
// other sector's writers use. Derived figures (net worth, flags, tiles) all
// recompute from the slice, so entry here flows straight to the dashboard.
function BudgetScreen({ budget, now, flags, onDismissFlag, write, pendingMonth, onReviewCloseOut }) {
  const setAccount = (id, f, v) => write(b => ({ ...b, capital: { ...b.capital, accounts: b.capital.accounts.map(x => x.id === id ? { ...x, [f]: v } : x) } }));
  const addAccount = () => write(b => ({ ...b, capital: { ...b.capital, accounts: [...b.capital.accounts, { id: uid(), name: "", value: 0 }] } }));
  const removeAccount = (id) => write(b => ({ ...b, capital: { ...b.capital, accounts: b.capital.accounts.filter(x => x.id !== id) } }));
  const setAsset = (id, f, v) => write(b => ({ ...b, assets: b.assets.map(x => x.id === id ? { ...x, [f]: v } : x) }));
  const addAsset = () => write(b => ({ ...b, assets: [...b.assets, { id: uid(), name: "", value: 0 }] }));
  const removeAsset = (id) => write(b => ({ ...b, assets: b.assets.filter(x => x.id !== id) }));
  const addOwe = (direction) => write(b => ({ ...b, oweLedger: [...b.oweLedger, { id: uid(), direction, person: "", amount: 0, reason: "", due: "", status: "open" }] }));
  const setOwe = (id, f, v) => write(b => ({ ...b, oweLedger: b.oweLedger.map(x => x.id === id ? { ...x, [f]: v } : x) }));
  const removeOwe = (id) => write(b => ({ ...b, oweLedger: b.oweLedger.filter(x => x.id !== id) }));
  // display-only order: open before paid, then soonest due first (undated last)
  const [editCat, setEditCat] = useState(null);
  const addCategory = () => { const id = uid(); write(b => ({ ...b, categories: [...b.categories, { id, name: "", budgeted: 0, spent: 0 }] })); setEditCat(id); };
  const setCategory = (id, f, v) => write(b => ({ ...b, categories: b.categories.map(x => x.id === id ? { ...x, [f]: v } : x) }));
  const deleteCategory = (c) => {
    if (!window.confirm(`Delete "${c.name || "this category"}" and its logged entries? This can't be undone.`)) return;
    write(b => removeCategory(b, c.id));
    setEditCat(null);
  };
  const oweRows = [...budget.oweLedger].sort((a, b) =>
    (a.status === "paid") - (b.status === "paid") || (a.due || "9999").localeCompare(b.due || "9999"));

  return (
    <div className="zoneview fade-up">
      <div className="zv-head"><span className="zv-code">💰</span>
        <span className="zv-name">Budget · live sector</span>
        <span className="bz-month">cycle {monthKey()}</span></div>

      <div className="bz-hero">
        <div className="bz-stat big"><div className="bz-val">{fmtMoney(netWorth(budget))}</div><div className="bz-lab">Net Worth · derived</div></div>
        <div className="bz-stat"><div className="bz-val">{fmtMoney(capitalTotal(budget))}</div><div className="bz-lab">Capital on Hand</div></div>
        <div className="bz-stat"><div className="bz-val">{fmtMoney(assetsTotal(budget))}</div><div className="bz-lab">Assets</div></div>
        <div className="bz-stat"><div className="bz-val">{String(flags.length).padStart(2, "0")}</div><div className="bz-lab">Open Flags</div></div>
      </div>

      {pendingMonth && (
        <div className="bz-flags">
          <div className="bz-flag">
            <span className="bz-flag-tag">kaniel // month-end</span>
            <span className="bz-flag-msg">{pendingMonth} has ended and is waiting to be closed out</span>
            <button className="bz-flag-x" onClick={onReviewCloseOut}>review ›</button>
          </div>
        </div>
      )}
      {flags.length > 0 && (
        <div className="bz-flags">
          {flags.map(f => (
            <div key={f.id} className={"bz-flag" + (f.severity === "alarm" ? " alarm" : "")}>
              <span className="bz-flag-tag">kaniel // {f.severity}</span>
              <span className="bz-flag-msg">{f.message}</span>
              <button className="bz-flag-x" onClick={() => onDismissFlag(f.id)} aria-label="Dismiss flag">dismiss ✕</button>
            </div>
          ))}
        </div>
      )}

      <div className="bz-grid">
        <section className="bz-mod tall">
          <div className="bz-mod-head"><span>Capital on Hand</span>
            <span className="bz-tag">live accounts · edit in place</span></div>
          <BzValueList items={budget.capital.accounts} empty="no accounts" addLabel="+ add account" nameHolder="account"
            onAdd={addAccount} onSet={setAccount} onRemove={removeAccount} />
          <div className="bz-row bz-total"><span className="k">total</span><span>{fmtMoney(capitalTotal(budget))}</span></div>
          <div style={{ marginTop: 10 }}><MonthLog rows={budget.capital.monthlyLog} /></div>
        </section>

        <section className="bz-mod">
          <div className="bz-mod-head"><span>Assets</span>
            <span className="bz-tag">manual · portfolio pull later</span></div>
          <BzValueList items={budget.assets} empty="no assets logged" addLabel="+ add asset" nameHolder="asset"
            onAdd={addAsset} onSet={setAsset} onRemove={removeAsset} />
          <div className="bz-row bz-total"><span className="k">total</span><span>{fmtMoney(assetsTotal(budget))}</span></div>
        </section>

        <section className="bz-mod">
          <div className="bz-mod-head"><span>Net Worth Log</span>
            <span className="bz-tag">auto close-out</span></div>
          <MonthLog rows={budget.netWorthLog} />
        </section>

        <section className="bz-mod wide">
          <div className="bz-mod-head"><span>Owe Ledger</span>
            <span className="bz-tag">i owe {fmtMoney(iOweOpen(budget))} · owed to me {fmtMoney(owedToMeOpen(budget))} · open only · paid entries leave net worth — update Capital yourself</span></div>
          {oweRows.length > 0 && (
            <div className="bz-owe-table">
              <div className="bz-owe-row bz-owe-head">
                <span>Direction</span><span>Person</span><span>Amount</span><span>Reason</span><span>Due</span><span>Paid</span><span />
              </div>
              {oweRows.map(o => {
                const late = isOverdue(o, now);
                return (
                  <div key={o.id} className={"bz-owe-row" + (late ? " overdue" : "") + (o.status === "paid" ? " paid" : "")}>
                    <button className="bz-dir bz-dir-btn" title="flip direction"
                      onClick={() => setOwe(o.id, "direction", o.direction === "iowe" ? "owedme" : "iowe")}>
                      {o.direction === "iowe" ? "i owe" : "owed me"}</button>
                    <input className="bz-in" value={o.person} placeholder="person" onChange={e => setOwe(o.id, "person", e.target.value)} />
                    <MoneyInput value={o.amount} onChange={v => setOwe(o.id, "amount", v)} />
                    <input className="bz-in" value={o.reason} placeholder="reason" onChange={e => setOwe(o.id, "reason", e.target.value)} />
                    <input className={"bz-in bz-due" + (late ? " late" : "")} type="date" value={o.due} onChange={e => setOwe(o.id, "due", e.target.value)} />
                    <button className="bz-paid-btn" aria-pressed={o.status === "paid"} title="mark paid / reopen"
                      onClick={() => setOwe(o.id, "status", o.status === "paid" ? "open" : "paid")}>{o.status === "paid" ? "◼" : "◻"}</button>
                    <button className="do-x" onClick={() => removeOwe(o.id)} aria-label="Remove entry">✕</button>
                  </div>
                );
              })}
            </div>
          )}
          {oweRows.length === 0 && <div className="bz-empty">ledger clear — nothing open in either direction</div>}
          <div className="bz-add-pair">
            <button className="do-add" onClick={() => addOwe("iowe")}>+ i owe</button>
            <button className="do-add" onClick={() => addOwe("owedme")}>+ owed to me</button>
          </div>
        </section>

        <section className="bz-mod wide">
          <div className="bz-mod-head"><span>Category Budget</span>
            <span className="bz-tag">flags at 75% and 100% · type an amount, press enter to log</span></div>
          {budget.categories.length === 0 && <div className="bz-empty">no categories yet</div>}
          <div className="bz-cats">
            {budget.categories.map(c => (
              <CategoryCard key={c.id} c={c} entries={monthEntries(budget, c.id, now)} open={editCat === c.id}
                onToggle={() => setEditCat(editCat === c.id ? null : c.id)}
                onSet={(f, v) => setCategory(c.id, f, v)}
                onLog={(amount, note) => write(b => logSpend(b, c.id, amount, note))}
                onUndo={(entryId) => write(b => undoSpend(b, entryId))}
                onDelete={() => deleteCategory(c)} />
            ))}
          </div>
          <button className="do-add" onClick={addCategory}>+ add category</button>
        </section>
      </div>
    </div>
  );
}

function GridApp({ authSession, onSignOut }) {
  const [screen, setScreen] = useState("lock"); // lock | boot | dashboard | zone | allsectors
  const [sector, setSector] = useState(null);
  const [pin, setPin] = useState("");
  const [pinErr, setPinErr] = useState(false);
  const [cmd, setCmd] = useState("");
  const [cmdStatus, setCmdStatus] = useState("");
  const [moodIdx, setMoodIdx] = useState(2);
  const [actionIdx, setActionIdx] = useState(0);
  const [insightVisible, setInsightVisible] = useState(true);
  const [expandedTile, setExpandedTile] = useState(null);
  const [sectorSearch, setSectorSearch] = useState("");
  // persistent store (see store.js). Budget starts blank — loadStore drops any
  // leftover placeholder records once; everything else is real entry.
  const [store, setStore] = useState(loadStore);
  // ── cloud sync ── (engine + safety rules: src/syncEngine.js; table: docs/supabase/schema.sql)
  const storeRef = useRef(store); storeRef.current = store;
  const [sync, setSync] = useState({ status: "checking", conflict: null, syncedAt: null });
  const engineRef = useRef(null);
  const syncUserId = authSession?.user?.id;
  useEffect(() => {
    if (!syncUserId) return;
    const engine = createSyncEngine({
      userId: syncUserId, cloud, getStore: () => storeRef.current, onStatus: setSync,
      applyRemote: (data) => { const s = saveStore(normalizeStore(data)); storeRef.current = s; setStore(s); return s; },
    });
    engineRef.current = engine;
    engine.start();
    const onVis = () => { if (document.visibilityState === "hidden") engine.flushNow(); else engine.syncNow(); };
    const onOnline = () => engine.syncNow();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("online", onOnline);
    return () => { document.removeEventListener("visibilitychange", onVis); window.removeEventListener("online", onOnline); engine.dispose(); engineRef.current = null; };
  }, [syncUserId]);
  useEffect(() => { engineRef.current?.notifyChange(); }, [store]);
  const cockpitRef = useRef(null);
  const coreRef = useRef(null);
  // one thread for now — the tiles the other three pointed at were placeholder
  // structure and have been removed; new veins get added as sectors go live
  const netWorthRef = useRef(null);
  const veinSources = useMemo(() => [{ ref: netWorthRef }], []);
  const now = useClock();
  const isMobile = useIsMobile();
  const reduce = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const mood = MOOD_CYCLE[moodIdx], moodMeta = MOOD_META[mood];
  const action = ACTION_CYCLE[actionIdx], actionMeta = ACTION_META[action];

  const pressKey = (k) => {
    setPinErr(false);
    if (k === "del") return setPin(p => p.slice(0, -1));
    if (k === "clr") return setPin("");
    if (pin.length >= 4) return;
    setPin(p => (p + k).slice(0, 4));
  };
  const enterGrid = useCallback(() => {
    if (pin.length !== 4) { setPinErr(true); return; }
    // month tracking runs on every successful entry — full auto-close-out
    // hooks in here once the Capital on Hand module lands. touchWeek does the
    // equivalent for Weekly Overview, and its reset IS fully live: crossing the
    // Sunday boundary blanks the current-week-only modules. touchDay does the
    // same for Daily Overview at the midnight boundary.
    setStore(s => ({ ...touchDay(touchWeek(touchMonth(s))) }));
    if (reduce) return setScreen("dashboard");
    setScreen("boot"); setTimeout(() => setScreen("dashboard"), 2000);
  }, [pin, reduce]);

  useEffect(() => {
    if (screen !== "lock") return;
    const onKey = (e) => {
      if (/^[0-9]$/.test(e.key)) pressKey(e.key);
      else if (e.key === "Backspace") pressKey("del");
      else if (e.key === "Enter") enterGrid();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [screen, pin, enterGrid]);

  const sendCmd = () => {
    if (!cmd.trim()) return;
    setCmd(""); setActionIdx(ACTION_CYCLE.indexOf("thinking"));
    setCmdStatus("kaniel // intelligence core offline — comes online in a later build");
    setTimeout(() => setCmdStatus(""), 4200);
  };
  const openSector = (s) => {
    if (s.key === "budget") { setScreen("budget"); return; } // live sector, real screen
    if (s.key === "weekly") { setScreen("weekly"); return; }
    if (s.key === "metricsOutsourcing") { setScreen("metricsOutsourcing"); return; }
    if (s.key === "dailyOverview") { setScreen("dailyOverview"); return; }
    if (s.key === "contactTracker") { setScreen("contactTracker"); return; }
    if (s.key === "projects") { setScreen("projects"); return; }
    if (s.key === "lifeGoals") { setScreen("lifeGoals"); return; }
    setSector(s); setScreen("zone");
  };
  const cycleMood = () => setMoodIdx(i => (i + 1) % MOOD_CYCLE.length);
  const cycleAction = () => setActionIdx(i => (i + 1) % ACTION_CYCLE.length);

  const clock = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  const dateStr = now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
  const dayOfWeek = now.toLocaleDateString([], { weekday: "long" }).toUpperCase();
  const session = "SX-" + now.getHours().toString().padStart(2, "0") + now.getMinutes().toString().padStart(2, "0");

  const filteredSectors = ALL_SECTORS.filter(s => s.label.toLowerCase().includes(sectorSearch.toLowerCase()));
  const budget = store.budget;
  const weekly = store.weekly;
  const daily = store.daily;
  const contactTracker = store.contactTracker;
  const projectTracker = store.projectTracker;
  const lifeGoals = store.lifeGoals;
  const budgetFlags = activeFlags(budget, now);

  // ── weekly writers ──
  // Every keystroke here is real user data, not seeded.
  //
  // These updaters MUST stay pure — return a new slice, never mutate in place.
  // StrictMode double-invokes state updaters in dev to surface exactly this: an
  // earlier mutating version spliced each added row in twice under one id, and
  // the twins then shared a value because listSet matches on id.
  const writeWeekly = (fn) => setStore(s => saveStore({ ...s, weekly: fn(s.weekly) }));
  const setTheme = (v) => writeWeekly(w => ({ ...w, theme: v }));
  const setPriority = (i, v) => writeWeekly(w => ({ ...w, priorities: w.priorities.map((p, k) => (k === i ? v : p)) }));
  const listAdd = (field) => (id, afterId) => writeWeekly(w => {
    if (w[field].some(x => x.id === id)) return w; // idempotent under double-invoke
    const next = [...w[field]];
    const at = afterId ? next.findIndex(x => x.id === afterId) : -1;
    next.splice(at < 0 ? next.length : at + 1, 0, { id, text: "" });
    return { ...w, [field]: next };
  });
  const listSet = (field) => (id, text) => writeWeekly(w => ({
    ...w, [field]: w[field].map(x => (x.id === id ? { ...x, text } : x)),
  }));
  const listRemove = (field) => (id) => writeWeekly(w => ({ ...w, [field]: w[field].filter(x => x.id !== id) }));
  const listToggleDone = (field) => (id) => writeWeekly(w => ({
    ...w, [field]: w[field].map(x => (x.id === id ? { ...x, done: !x.done } : x)),
  }));

  // Week at a Glance — glance[rowKey][dayIndex] is a list of short entries.
  const glanceOf = (rowKey, day) => weekly.glance?.[rowKey]?.[day] || [];
  const putCell = (w, rowKey, day, list) => ({
    ...w, glance: { ...w.glance, [rowKey]: { ...(w.glance[rowKey] || {}), [day]: list } },
  });
  const glanceAdd = (rowKey, day) => (id, afterId) => writeWeekly(w => {
    const list = w.glance?.[rowKey]?.[day] || [];
    if (list.some(x => x.id === id)) return w; // idempotent under double-invoke
    const next = [...list];
    const at = afterId ? next.findIndex(x => x.id === afterId) : -1;
    next.splice(at < 0 ? next.length : at + 1, 0, { id, text: "" });
    return putCell(w, rowKey, day, next);
  });
  const glanceSet = (rowKey, day) => (id, text) => writeWeekly(w =>
    putCell(w, rowKey, day, (w.glance?.[rowKey]?.[day] || []).map(x => (x.id === id ? { ...x, text } : x))));
  const glanceRemove = (rowKey, day) => (id) => writeWeekly(w =>
    putCell(w, rowKey, day, (w.glance?.[rowKey]?.[day] || []).filter(x => x.id !== id)));
  const setStopStart = (field, v) => writeWeekly(w => ({ ...w, stopStart: { ...w.stopStart, [field]: v } }));

  // ── daily writers ──
  // Fully independent of writeWeekly — Daily Overview never touches the
  // `weekly` slice (see docs/specs/DAILY_OVERVIEW_SPEC.md).
  const writeDaily = (fn) => setStore(s => saveStore({ ...s, daily: fn(s.daily) }));
  const setDailyField = (field) => (v) => writeDaily(d => ({ ...d, [field]: v }));
  const dailyListAdd = (field) => (id, afterId) => writeDaily(d => {
    if (d[field].some(x => x.id === id)) return d; // idempotent under double-invoke
    const next = [...d[field]];
    const at = afterId ? next.findIndex(x => x.id === afterId) : -1;
    const extra = field === "tasks" ? { priority: null, done: false } : {};
    next.splice(at < 0 ? next.length : at + 1, 0, { id, text: "", ...extra });
    return { ...d, [field]: next };
  });
  const dailyListSet = (field) => (id, text) => writeDaily(d => ({
    ...d, [field]: d[field].map(x => (x.id === id ? { ...x, text } : x)),
  }));
  const dailyListRemove = (field) => (id) => writeDaily(d => ({ ...d, [field]: d[field].filter(x => x.id !== id) }));
  const dailyListToggleDone = (field) => (id) => writeDaily(d => ({
    ...d, [field]: d[field].map(x => (x.id === id ? { ...x, done: !x.done } : x)),
  }));
  const dailyTaskSetPriority = (id, v) => writeDaily(d => ({
    ...d, tasks: d.tasks.map(x => (x.id === id ? { ...x, priority: v } : x)),
  }));

  // Homework/Deadlines — PERSISTS across the daily boundary (see the `daily`
  // slice comment in store.js), so this is a plain add/set/remove trio, not
  // wired through touchDay's reset at all.
  const homeworkAdd = () => writeDaily(d => ({
    ...d, homework: [...d.homework, { id: uid(), timeRequired: "", task: "", cls: "", dueDate: "", dueTime: "", status: "", done: false }],
  }));
  const homeworkSet = (id, field, v) => writeDaily(d => ({
    ...d, homework: d.homework.map(x => (x.id === id ? { ...x, [field]: v } : x)),
  }));
  const homeworkRemove = (id) => writeDaily(d => ({ ...d, homework: d.homework.filter(x => x.id !== id) }));
  const homeworkToggleDone = (id) => writeDaily(d => ({
    ...d, homework: d.homework.map(x => (x.id === id ? { ...x, done: !x.done } : x)),
  }));

  // People to Reach Out To's synced half — live-computed from Contact
  // Tracker, not stored here (see contactSyncTargets in store.js). Recomputes
  // on every render since it's cheap and date-dependent; the Extras list
  // below stays a separate, manually-entered daily list per the spec.
  const contactSyncList = useMemo(() => contactSyncTargets(contactTracker), [contactTracker]);

  // ── budget writer ── (mutators live in store.js or in BudgetScreen itself)
  const writeBudget = (fn) => setStore(s => saveStore({ ...s, budget: fn(s.budget) }));
  // month-end: asked once per session ("later" hides it until next login, the banner
  // in Budget stays). Held back until sync's first check finishes and while a sync
  // conflict is open, so a stale browser can't close out before seeing the cloud copy.
  const pendingMonth = pendingCloseOut(budget, now);
  const [closeOutLater, setCloseOutLater] = useState(false);
  const showCloseOut = !!pendingMonth && !closeOutLater && screen !== "lock" && screen !== "boot" && !sync.conflict && sync.status !== "checking";

  // ── contact tracker writers ──
  const writeContactTracker = (fn) => setStore(s => saveStore({ ...s, contactTracker: fn(s.contactTracker) }));
  const contactAdd = () => writeContactTracker(ct => ({
    ...ct, contacts: [...ct.contacts, {
      id: uid(), name: "", category: "", lastContact: "", frequency: "", priority: null, method: "", location: "", notes: "",
    }],
  }));
  const contactSet = (id, field, v) => writeContactTracker(ct => ({
    ...ct, contacts: ct.contacts.map(x => (x.id === id ? { ...x, [field]: v } : x)),
  }));
  const contactRemove = (id) => writeContactTracker(ct => ({ ...ct, contacts: ct.contacts.filter(x => x.id !== id) }));

  // ── project tracker writers ── (mutators live in store.js, see PROJECT_TRACKER_SPEC.md)
  const writeProjectTracker = (fn) => setStore(s => saveStore({ ...s, projectTracker: fn(s.projectTracker) }));
  const projAdd = (name) => writeProjectTracker(pt => projectAdd(pt, name));
  const projEdit = (id, field, v) => writeProjectTracker(pt => projectEdit(pt, id, field, v));
  const projMoveZone = (id, zone) => writeProjectTracker(pt => projectMoveZone(pt, id, zone));
  const projSetState = (id, state) => writeProjectTracker(pt => projectSetState(pt, id, state));
  const projRemove = (id) => writeProjectTracker(pt => projectRemove(pt, id));

  // ── life goals writers ── (mutators live in store.js, see LIFE_GOALS_SPEC.md)
  const writeLifeGoals = (fn) => setStore(s => saveStore({ ...s, lifeGoals: fn(s.lifeGoals) }));
  const glAdd = (tier, parentId, title) => writeLifeGoals(lg => goalAdd(lg, tier, parentId, title));
  const glEdit = (id, field, v) => writeLifeGoals(lg => goalEdit(lg, id, field, v));
  const glSetStatus = (id, status) => writeLifeGoals(lg => goalSetStatus(lg, id, status));
  const glRemove = (id) => {
    const kids = goalDescendants(lifeGoals, id).length;
    if (kids > 0 && !window.confirm(`This also removes ${kids} goal${kids === 1 ? "" : "s"} rolled up under it. Remove anyway?`)) return;
    writeLifeGoals(lg => goalRemove(lg, id));
  };

  // ── backup / restore ── (see exportBackup/parseBackup in store.js)
  const importRef = useRef(null);
  const [backupMsg, setBackupMsg] = useState("");
  const flashBackup = (m) => { setBackupMsg(m); setTimeout(() => setBackupMsg(""), 5000); };
  const downloadText = (filename, text) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const doExport = () => { downloadText(`the-grid-backup-${dayKey(new Date())}.json`, exportBackup(store)); flashBackup("backup downloaded"); };
  const handleSignOut = async () => {
    await engineRef.current?.flushNow();
    const st = engineRef.current ? sync.status : "synced";
    if (["pending", "saving", "offline", "error", "conflict"].includes(st) &&
        !window.confirm("Some changes haven't reached the cloud yet. Sign out anyway? They stay safe in this browser and sync when you sign back in.")) return;
    onSignOut();
  };
  const doImport = async (file) => {
    if (!file) return;
    const res = parseBackup(await file.text());
    if (!res.ok) { flashBackup("import failed — " + res.error); return; }
    const when = res.exportedAt ? new Date(res.exportedAt).toLocaleString() : "unknown date";
    if (!window.confirm(`Replace ALL current Grid data with the backup from ${when}? This can't be undone — export first if you want a copy of what's here now.`)) return;
    setStore(saveStore(res.store));
    flashBackup("backup restored");
  };

  const setReflectionField = (field, v) => writeDaily(d => ({ ...d, reflection: { ...d.reflection, [field]: v } }));
  // Learning Matrix / Spirituality don't exist yet — same honest inert idiom
  // as Kaniel's narration stub (Weekly Metrics Outsourcing) and the Contact
  // Tracker sync banner above: a real, wired button, transient message
  // instead of a fake action, auto-clears rather than needing a close click.
  const [reflectionStub, setReflectionStub] = useState("");
  const onReflectionStub = (label) => {
    setReflectionStub(label + " — not wired yet, sector not built");
    setTimeout(() => setReflectionStub(""), 3000);
  };

  // Ritual. Completion writes the weekly slice; text and order write the
  // template slice. Two rules, two destinations — never merge these.
  const writeRitual = (fn) => setStore(s => saveStore({ ...s, ritual: fn(s.ritual) }));
  const ritualToggle = (id) => writeWeekly(w => {
    const next = { ...w.ritualChecked };
    if (next[id]) delete next[id]; else next[id] = true;
    return { ...w, ritualChecked: next };
  });
  const ritualSet = (id, text) => writeRitual(r => ({ ...r, steps: r.steps.map(s => (s.id === id ? { ...s, text } : s)) }));
  const ritualAdd = (id, afterId) => writeRitual(r => {
    if (r.steps.some(s => s.id === id)) return r;
    const next = [...r.steps];
    const at = afterId ? next.findIndex(s => s.id === afterId) : -1;
    next.splice(at < 0 ? next.length : at + 1, 0, { id, text: "" });
    return { ...r, steps: next };
  });
  const ritualRemove = (id) => writeRitual(r => ({ ...r, steps: r.steps.filter(s => s.id !== id) }));
  const ritualMove = (id, dir) => writeRitual(r => {
    const i = r.steps.findIndex(s => s.id === id), j = i + dir;
    if (i < 0 || j < 0 || j >= r.steps.length) return r;
    const next = [...r.steps];
    [next[i], next[j]] = [next[j], next[i]];
    return { ...r, steps: next };
  });

  // MON–SUN columns for the Glance grid (the metrics log's SUN–SAT scheme is
  // separate and lands in increment 3). Today may legitimately be absent from
  // this span on the Sunday you plan — the boundary Sunday is not a column.
  const glanceCols = glanceDates(now);
  const todayIdx = glanceCols.findIndex(d => d.toDateString() === now.toDateString());
  const ritual = ritualDone(store);

  // Daily Metrics Log — day cells and goals write the weekly slice directly;
  // Close Week / Clear Grid are separate store-level actions (see store.js),
  // deliberately not bundled into one button per the user's actual workflow.
  const metricSetDay = (id, day, val) => writeWeekly(w => {
    const cur = { ...(w.metrics[id] || {}) };
    if (val === "" || val === null || val === undefined) delete cur[day]; else cur[day] = val;
    return { ...w, metrics: { ...w.metrics, [id]: cur } };
  });
  const metricSetGoal = (id, val) => writeWeekly(w => ({
    ...w, metricsGoals: { ...w.metricsGoals, [id]: val === "" ? undefined : val },
  }));
  const doCloseWeek = () => setStore(s => closeWeek(s));
  const doClearGrid = () => setStore(s => clearMetricsGrid(s));
  // dismissals persist so the same flag doesn't re-fire on the next visit
  const onDismissFlag = (id) => setStore(s => ({ ...dismissFlag(s, id) }));
  const onDismissInsight = (id) => setStore(s => ({ ...dismissInsight(s, id) }));

  // ── budget → dashboard ──
  // Derived from the store rather than hardcoded, so these tiles can't drift
  // out of sync with the sector. Deps are budget-only (not `now`) so the
  // per-second clock tick doesn't rebuild the tile field; overdue state only
  // changes on a date boundary.
  const burn = cycleBurn(budget);
  // Every tile on the dashboard is backed by a real sector — the field grows
  // as each sector gets built, rather than being pre-populated with invented
  // slots. Budget was the only one; Weekly Overview is the second.
  const budgetTiles = useMemo(() => {
    const b = cycleBurn(budget), od = overdueCount(budget), io = inOutSeries(budget);
    const odSplit = overdueSplit(budget);
    const overdueItems = budget.oweLedger.filter(o => isOverdue(o));
    return [
      {
        label: "Net Worth", cockpit: true, size: "lg",
        raw: netWorth(budget), masked: true, value: fmtMoney(netWorth(budget)),
        spark: netWorthSeries(budget),
        detail: <MonthLog rows={budget.netWorthLog} />,
      },
      // ring stays cyan until the total actually exceeds budget — the 75% rule
      // is per-category (per spec), so here 75 is a reference mark, not a state
      {
        label: "Budget Used", shape: "ring", pct: b.pct,
        state: b.pct >= 100 ? "over" : "ok", alarm: b.pct >= 100,
        value: Math.round(b.pct) + "%", sub: fmtMoney(b.spent) + " / " + fmtMoney(b.budgeted),
        detail: <CategoryBreakdown categories={budget.categories} />,
      },
      {
        label: "Overdue", shape: "overdue", split: odSplit, alarm: od > 0,
        value: String(od).padStart(2, "0"),
        detail: overdueItems.length === 0 ? <div className="bz-empty">nothing overdue — ledger clear</div> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {overdueItems.map(o => (
              <div key={o.id} className="bz-owe overdue">
                <span className="bz-dir">{o.direction === "iowe" ? "i owe" : "owed me"}</span>
                <span className="who">{o.person}</span>
                <span className="amt">{fmtMoney(o.amount)}</span>
                <span className="due">{o.due}</span>
              </div>
            ))}
          </div>
        ),
      },
      // Runway isn't honestly derivable without an income model — real monthly
      // In/Out answers the same "trending up?" question.
      {
        label: "Capital Flow · In / Out", shape: "chart", series: io,
        latest: io.at(-1)?.value ?? 0,
        value: (io.at(-1)?.value ?? 0) >= 0 ? "+" + fmtMoney(io.at(-1)?.value ?? 0) : fmtMoney(io.at(-1)?.value ?? 0),
        detail: <MonthLog rows={budget.capital.monthlyLog} />,
      },
    ];
  }, [budget]);

  // ── weekly overview → dashboard ──
  // Tasks and Goals completion are computed independently and shown as two
  // separate rings in one tile — never averaged into a single number, since
  // a finished task list and a stalled goal list are different signals.
  const weeklyTiles = useMemo(() => {
    const tp = tasksProgress(weekly), gp = goalsProgress(weekly);
    const checklist = (items, empty) => items.length === 0 ? <div className="bz-empty">{empty}</div> : items.map(it => (
      <div key={it.id} className={"tm-check-row" + (it.done ? " done" : "")}>
        <span>{it.done ? "◼" : "◻"}</span><span>{it.text || "—"}</span>
      </div>
    ));
    return [
      {
        label: "Weekly Execution", shape: "execution",
        tasksPct: tp.total > 0 ? (tp.done / tp.total) * 100 : 0,
        tasksDisplay: `${tp.done}/${tp.total}`,
        goalsPct: gp.total > 0 ? (gp.done / gp.total) * 100 : 0,
        goalsDisplay: `${gp.done}/${gp.total}`,
        value: `${tp.done}/${tp.total} tasks · ${gp.done}/${gp.total} goals`,
        // same two rings, just bigger — opening the modal shouldn't introduce
        // a different number format than the tile itself already shows
        headline: (
          <div className="tm-exec-head">
            <ArcGauge value={tp.total > 0 ? (tp.done / tp.total) * 100 : 0} display={`${tp.done}/${tp.total}`} size={76} valueSize={16} label="Tasks" />
            <ArcGauge value={gp.total > 0 ? (gp.done / gp.total) * 100 : 0} display={`${gp.done}/${gp.total}`} size={76} valueSize={16} label="Goals" />
          </div>
        ),
        detail: (
          <>
            <div className="tm-detail-lab">Weekly Tasks</div>
            {checklist(weekly.tasks, "no tasks logged for this cycle")}
            <div className="tm-detail-lab">This Week's Goals</div>
            {checklist(weekly.goals, "no goals set for this cycle")}
          </>
        ),
      },
    ];
  }, [weekly]);

  // ── daily overview → dashboard ──
  // Today's Tasks deliberately omits a Goals ring — Today's Goals has no
  // completion checkbox per spec, so there's nothing to average a ring from.
  // Today's Homework's alarm is a live-computed boolean (homeworkOverdueCount
  // > 0), same as Budget's own Overdue tile — not routed through the
  // persisted/dismissable flag engine, which is Budget-specific for now.
  const dailyTiles = useMemo(() => {
    const tp = tasksProgress(daily);
    const dueToday = homeworkDueToday(daily, now);
    const overdue = homeworkOverdueCount(daily, now);
    const checklist = (items, empty) => items.length === 0 ? <div className="bz-empty">{empty}</div> : items.map(it => (
      <div key={it.id} className={"tm-check-row" + (it.done ? " done" : "")}>
        <span>{it.done ? "◼" : "◻"}</span><span>{it.text || "—"}</span>
      </div>
    ));
    const allHomeworkSorted = [...daily.homework].sort((a, b) =>
      homeworkCompare(homeworkSortValue(a, "due"), homeworkSortValue(b, "due"), 1));
    return [
      {
        label: "Today's Tasks", shape: "execution",
        tasksPct: tp.total > 0 ? (tp.done / tp.total) * 100 : 0,
        tasksDisplay: `${tp.done}/${tp.total}`,
        value: `${tp.done}/${tp.total} tasks today`,
        headline: <ArcGauge value={tp.total > 0 ? (tp.done / tp.total) * 100 : 0} display={`${tp.done}/${tp.total}`} size={76} valueSize={16} label="Tasks" />,
        detail: (
          <>
            <div className="tm-detail-lab">Today's Tasks</div>
            {checklist(daily.tasks, "no tasks logged for today")}
          </>
        ),
      },
      {
        label: "Today's Homework", shape: "homework",
        items: dueToday, overdueCount: overdue, alarm: overdue > 0,
        value: String(dueToday.length).padStart(2, "0"),
        sub: overdue > 0 ? `${overdue} overdue` : (dueToday.length ? "due today" : "clear"),
        detail: (
          <>
            <div className="tm-detail-lab">All Homework / Deadlines</div>
            {allHomeworkSorted.length === 0 ? <div className="bz-empty">no homework or deadlines logged</div> : allHomeworkSorted.map(it => (
              <div key={it.id} className={"tm-check-row" + (it.done ? " done" : "")}>
                <span>{it.done ? "◼" : "◻"}</span>
                <span>{it.task || "—"}{it.cls ? ` · ${it.cls}` : ""}{it.dueDate ? ` · ${it.dueDate}${it.dueTime ? " " + it.dueTime : ""}` : ""}</span>
              </div>
            ))}
          </>
        ),
      },
    ];
  }, [daily, now]);

  const dashboardTiles = [...budgetTiles, ...weeklyTiles, ...dailyTiles];

  return (
    <div className="grid-root">
      <style>{CSS}</style>
      <Starfield />
      <div className="grid-veil" /><div className="grid-scan" /><div className="grid-vignette" />
      <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />

      <div className="stage">
        {screen !== "lock" && screen !== "boot" && (
          <div className="topbar">
            <div className="tb-left">
              {screen === "zone" || screen === "allsectors" || screen === "budget" || screen === "weekly" || screen === "metricsOutsourcing" || screen === "dailyOverview" || screen === "contactTracker" || screen === "projects" || screen === "lifeGoals"
                ? <button className="tb-back" onClick={() => setScreen("dashboard")}>◄ grid dashboard</button>
                : <span className="live"><span className="dot-live" />the grid // online</span>}
            </div>
            <div className="tb-right">
              {screen === "dashboard" && (
                <>
                  <button className="tb-dev" onClick={cycleMood}>dev: mood ({moodMeta.label})</button>
                  <button className="tb-dev" onClick={cycleAction}>dev: state ({actionMeta.label})</button>
                </>
              )}
              {backupMsg && <span className="tb-backup-msg">{backupMsg}</span>}
              <button className="tb-back" onClick={doExport} title="download a full backup of all Grid data">export</button>
              <button className="tb-back" onClick={() => importRef.current?.click()} title="restore from a backup file (replaces current data)">import</button>
              <input ref={importRef} type="file" accept="application/json,.json" style={{ display: "none" }}
                onChange={e => { doImport(e.target.files[0]); e.target.value = ""; }} />
              <button className={"tb-sync " + sync.status} onClick={() => engineRef.current?.syncNow()}
                title={(sync.error ? sync.error + " — " : "") + (sync.syncedAt ? "last synced " + new Date(sync.syncedAt).toLocaleTimeString() + " — " : "") + "click to sync now"}>
                cloud: {({ checking: "checking", synced: "synced", pending: "unsaved", saving: "saving…", offline: "offline", error: "error", conflict: "choose copy" })[sync.status] ?? sync.status}
              </button>
              <button className="tb-back" onClick={handleSignOut} title={"signed in as " + (authSession?.user?.email ?? "")}>sign out</button>
              <span>ses {session}</span><span className="live">{clock}</span>
            </div>
          </div>
        )}

        {screen === "lock" && (
          <div className="lock-wrap fade-up">
            <div className="lock-title">The Grid</div>
            <div className="lock-sub">// access node · session key required</div>
            <div className="pin-dots">{[0,1,2,3].map(i => <div key={i} className={"pin-dot" + (pinErr ? " err" : pin.length > i ? " on" : "")} />)}</div>
            <div className="pad">
              {["1","2","3","4","5","6","7","8","9"].map(n => <button key={n} className="key" onClick={() => pressKey(n)}>{n}</button>)}
              <button className="key util" onClick={() => pressKey("clr")}>clr</button>
              <button className="key" onClick={() => pressKey("0")}>0</button>
              <button className="key util" onClick={() => pressKey("del")}>del</button>
            </div>
            <button className={"enter-grid" + (pin.length === 4 ? " ready" : "")} onClick={enterGrid}>enter the grid</button>
            <div className="lock-note">session key is a ritual, not security. your login is what protects your data.</div>
          </div>
        )}

        {screen === "boot" && (
          <div className="boot">
            {BOOT_LINES.map((l, i) => <div key={i} className="boot-line" style={{ animationDelay: `${i * 0.34}s` }}>&gt; {l[0]} <span className="ok">[{l[1]}]</span></div>)}
          </div>
        )}

        {screen === "dashboard" && !isMobile && (
          <>
          <div className="scan-strip">
            {Array.from({ length: 26 }).map((_, i) => <i key={i} className={i % 4 === 0 ? "on" : ""} />)}
          </div>
          <div className="cockpit fade-up" ref={cockpitRef}>
            <VeinLines containerRef={cockpitRef} targetRef={coreRef} sources={veinSources} />
            <div className="col left">
              <div className="dock-fan">
                <DockPanel title="Sector Feed" angle={76} side="left" offset={0} wrap={false} tooltip>
                  <div className="chip-field">
                    {[{label:"Zone L",value:"04"},{label:"Zone S",value:"02"},{label:"Zone 1",value:"11"},{label:"Shelf",value:"23"}].map((c,i) => (
                      <div key={i} className="stat-chip"><div className="sc-val">{c.value}</div><div className="sc-lab">{c.label}</div></div>
                    ))}
                  </div>
                </DockPanel>
                <DockPanel title="Recent Adds" angle={76} side="left" offset={18} wrap={false} tooltip>
                  <div className="rank-list">
                    {RECENT_ADDS.map((r, i) => (
                      <div key={i} className={"rank-row" + (r.alarm ? "" : " ok")}>
                        <span className="rr-n">{i+1}</span><span className="rr-name">{r.name}</span><span className="rr-val">{r.days}d</span>
                      </div>
                    ))}
                  </div>
                </DockPanel>
                <DockPanel title="Velocity" angle={76} side="left" offset={36} wrap={false} tooltip>
                  <Sparkline points={SPARK_POINTS} />
                </DockPanel>
              </div>
              <DockPanel title="Load" angle={31} side="left">
                <div className="chip-field">
                  {[{label:"Open",value:"12"},{label:"Due Today",value:"03"},{label:"Blocked",value:"01"},{label:"Overdue",value:"02",alarm:true}].map((c,i) => (
                    <div key={i} className={"stat-chip" + (c.alarm ? " alarm" : "")}><div className="sc-val">{c.value}</div><div className="sc-lab">{c.label}</div></div>
                  ))}
                </div>
              </DockPanel>
              <DockPanel title="Stalest" angle={16} side="left">
                <div className="rank-list">
                  {STALEST.map((r, i) => (
                    <div key={i} className={"rank-row" + (r.alarm ? "" : " ok")}>
                      <span className="rr-n">{i+1}</span><span className="rr-name">{r.name}</span><span className="rr-val">{r.days}d</span>
                    </div>
                  ))}
                </div>
              </DockPanel>
            </div>

            <div className="col center-col">
              {/* standalone HUD instrument, deliberately separate from the
                  small topbar clock/session readout — meant to be noticeable
                  at a glance, not a footnote */}
              <div className="day-hero"><b>{dayOfWeek}</b><i>{dateStr}</i></div>

              <div className="tile-field">
                {dashboardTiles.map((t, i) => (
                  <MicroTile key={"bt"+i} t={t} onOpen={setExpandedTile} ref={i === 0 ? netWorthRef : null} />
                ))}
              </div>

              {/* weekly theme — text pulled straight from Weekly Overview's
                  header, no computation. Sits in normal flow ABOVE the
                  absolutely-centered Kaniel/ring composition on purpose: that
                  block's height feeds a translate(-50%,-50%) centering, so
                  anything appended inside it pushes the sector-ring labels
                  below it closer together. A separate flow row above avoids
                  that entirely rather than fighting for pixels near the core. */}
              {weekly.theme && (
                <div className="week-theme-line"><i>this week</i><b>{weekly.theme}</b></div>
              )}
              {/* Daily Overview's 1% Goal — same treatment/placement reasoning
                  as the weekly theme line directly above it. */}
              {daily.goal1pct && (
                <div className="week-theme-line"><i>today's 1%</i><b>{daily.goal1pct}</b></div>
              )}

              <div className="dial-field">
                <DialGreeble />
                <InstrumentRing moodCls={moodMeta.cls} />
                <SectorRing onOpen={openSector} onAllSectors={() => setScreen("allsectors")} />
                <div className="kaniel">
                  <div className="k-assembly" ref={coreRef}>
                    <KanielCore mood={mood} action={action} />
                  </div>
                  <div className="kaniel-name">Kaniel</div>
                  <div className="kaniel-mood-row">
                    <span className={"kaniel-mood " + moodMeta.cls}>{moodMeta.label}</span>
                    <span style={{ color: "var(--holo-dim)" }}>·</span>
                    <span className={"kaniel-action " + actionMeta.cls}>{actionMeta.label}</span>
                  </div>
                </div>
              </div>

              <div className="cmd">
                <span className="caret">&gt;</span>
                <input value={cmd} onChange={e => setCmd(e.target.value)} onKeyDown={e => { if (e.key === "Enter") sendCmd(); }} placeholder="ask kaniel…" aria-label="Ask Kaniel" />
                {!cmd && <span className="blink" />}
              </div>
              <div className="cmd-status" style={{ opacity: cmdStatus ? 1 : 0 }}>{cmdStatus}</div>

              {insightVisible ? (
                <div className="insight-card">
                  <div className="insight-head"><span className="insight-tag">kaniel //</span>
                    <button className="insight-x" onClick={() => setInsightVisible(false)} aria-label="Dismiss suggestion">✕</button></div>
                  <div className="insight-body">"Website redesign" has been untouched for 12 days — two more and it auto-shelves. Want me to bump the deadline or archive it now?</div>
                  <div className="insight-foot">mock suggestion · fired on-demand · dismissal will be logged in the real build</div>
                </div>
              ) : (<button className="insight-restore" onClick={() => setInsightVisible(true)}>restore demo suggestion</button>)}
            </div>

            <div className="col right">
              <DockPanel title="Life Sectors" angle={74} side="right">
                <div className="chip-field">
                  {[
                    { label: "Budget Used", value: Math.round(burn.pct) + "%", alarm: burn.pct >= 100 },
                    { label: "Overdue", value: String(overdueCount(budget)).padStart(2, "0"), alarm: overdueCount(budget) > 0 },
                    { label: "Workouts/wk", value: "03" },
                    { label: "Sleep Avg", value: "6.8h", alarm: true },
                  ].map((c,i) => (
                    <div key={i} className={"stat-chip" + (c.alarm ? " alarm" : "")}><div className="sc-val">{c.value}</div><div className="sc-lab">{c.label}</div></div>
                  ))}
                </div>
              </DockPanel>
              <DockPanel title="Streaks" angle={59} side="right">
                <div className="rank-list">
                  {STREAKS.map((r, i) => (
                    <div key={i} className={"rank-row" + (r.alarm ? "" : " ok")}>
                      <span className="rr-n">{i+1}</span><span className="rr-name">{r.name}</span><span className="rr-val">{r.days}d</span>
                    </div>
                  ))}
                </div>
              </DockPanel>
              <DockPanel title="Budget Health" angle={44} side="right">
                <div style={{ display: "flex", justifyContent: "center" }}>
                  <ArcGauge value={Math.round(burn.pct)} label="Cycle Used" alarm={burn.pct >= 100} />
                </div>
                {/* condensed category burn — same gold/red states as the sector,
                    so an over-budget line reads without opening Budget */}
                <div style={{ marginTop: 8 }}><CategoryBreakdown categories={budget.categories} /></div>
              </DockPanel>
              <DockPanel title="Uplink" angle={29} side="right">
                <div className="chip-field">
                  {[{label:"Last Sync",value:"2m"},{label:"Devices",value:"03"},{label:"Queue",value:"00"},{label:"Cache",value:"48MB"}].map((c,i) => (
                    <div key={i} className="stat-chip"><div className="sc-val">{c.value}</div><div className="sc-lab">{c.label}</div></div>
                  ))}
                </div>
              </DockPanel>
              <DockPanel title="Diagnostics" angle={14} side="right">
                <div style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--holo-dim)", lineHeight: 1.9, textTransform: "uppercase" }}>
                  storage · nominal<br />kaniel core · standby<br />last sync · —<br />drift · +0.004
                </div>
              </DockPanel>
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <div className="bottom-widgets">
                <div className="map-panel">
                  <div className="map-head"><span>Travel Log</span><span className="dp-mock">mock</span></div>
                  <WorldMap />
                </div>
                {/* the exact same component as Weekly Overview's own chart —
                    not a copy, so a daily entry logged there is reflected
                    here on next render with no separate data path to drift.
                    Left unwrapped in its own f-instr frame rather than boxed
                    inside a second map-panel shell, which would mean two
                    stacked headers and a chart no longer rendered "as-is". */}
                <WeekStateChart weekly={weekly} now={now} />
              </div>
              <div className="chip-row">
                <span className="rchip"><span className="k">session</span><span className="v">{session}</span></span>
                <span className="rchip"><span className="k">sync</span><span className="v">idle</span></span>
                <span className="rchip"><span className="k">grid</span><span className="v">online</span></span>
                <span className={"rchip" + (mood === "agitated" || mood === "critical" ? " alarm" : "")}><span className="k">kaniel</span><span className="v">{moodMeta.label}</span></span>
                <span className="rchip"><span className="k">sectors</span><span className="v">{LIVE_SECTOR_COUNT} / {ALL_SECTORS.length} live</span></span>
                {/* precursor to the global notification bus — counts flags across
                    sectors; only Budget emits them today */}
                <span className={"rchip" + (budgetFlags.length ? " alarm" : "")}><span className="k">flags</span><span className="v">{String(budgetFlags.length).padStart(2, "0")}</span></span>
                <span className="rchip"><span className="k">{dateStr}</span></span>
              </div>
            </div>
          </div>
          </>
        )}

        {screen === "dashboard" && isMobile && (
          <div className="mobile-stack fade-up">
            <div className="kaniel" style={{ position: "static", transform: "none", marginTop: 6, paddingTop: 0 }}>
              <div className="k-assembly" style={{ width: 200, height: 200 }}>
                <KanielCore mood={mood} action={action} />
              </div>
              <div className="kaniel-name">Kaniel</div>
              <div className="kaniel-mood-row"><span className={"kaniel-mood " + moodMeta.cls}>{moodMeta.label}</span><span>·</span><span className={"kaniel-action " + actionMeta.cls}>{actionMeta.label}</span></div>
              <div className="cmd"><span className="caret">&gt;</span>
                <input value={cmd} onChange={e => setCmd(e.target.value)} onKeyDown={e => { if (e.key === "Enter") sendCmd(); }} placeholder="ask kaniel…" />
                {!cmd && <span className="blink" />}
              </div>
            </div>
            <div className="mobile-tiles">
              {dashboardTiles.map((t,i) => <MicroTile key={i} t={t} onOpen={setExpandedTile} />)}
            </div>
            <div className="mobile-sectors" style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
              {PINNED_SECTORS.map(s => (
                <button key={s.key} className={"mobile-sector-btn" + (s.locked ? " locked" : "")} onClick={() => openSector(s)}>
                  <span className="msb-glyph">{s.glyph}</span>{s.label}
                </button>
              ))}
              <button className="mobile-sector-btn" onClick={() => setScreen("allsectors")}><span className="msb-glyph">▤</span>All Sectors</button>
            </div>
            {insightVisible && (
              <div className="insight-card">
                <div className="insight-head"><span className="insight-tag">kaniel //</span><button className="insight-x" onClick={() => setInsightVisible(false)}>✕</button></div>
                <div className="insight-body">"Website redesign" has been untouched for 12 days — two more and it auto-shelves.</div>
              </div>
            )}
            <div className="map-panel"><div className="map-head"><span>Travel Log</span><span className="dp-mock">mock</span></div><WorldMap /></div>
          </div>
        )}

        {screen === "allsectors" && (
          <div className="zoneview fade-up" style={{ display: "flex", flexDirection: "column" }}>
            <div className="zv-head"><span className="zv-code">▤</span><span className="zv-name">All Sectors · {LIVE_SECTOR_COUNT} live / {ALL_SECTORS.length} total</span></div>
            <div className="allsec-search">
              <span style={{ color: "var(--holo-dim)", fontFamily: "var(--mono)" }}>⌕</span>
              <input value={sectorSearch} onChange={e => setSectorSearch(e.target.value)} placeholder="search sectors…" />
            </div>
            <div className="allsec-grid">
              {filteredSectors.map(s => (
                <div key={s.key} className={"allsec-item" + (s.locked ? " locked" : "")} onClick={() => openSector(s)}>
                  <div className="allsec-glyph">{s.glyph}</div>
                  <div className="allsec-label">{s.label}</div>
                  <div className="allsec-tag">{s.locked ? "not yet built" : "live"}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {screen === "budget" && (
          <BudgetScreen budget={budget} now={now} flags={budgetFlags} onDismissFlag={onDismissFlag} write={writeBudget}
            pendingMonth={pendingMonth} onReviewCloseOut={() => setCloseOutLater(false)} />
        )}

        {screen === "weekly" && (
          <div className="zoneview fade-up">
            <div className="zv-head">
              <span className="zv-code">▦</span>
              <span className="zv-name">Weekly Overview · live sector</span>
              <span className="wk-headright">
                <span className="wk-wk"><i>week</i><b>{weekNumber(now)}</b></span>
                <span className="wk-boundary">cycle {weekKey(now)} · resets sun</span>
              </span>
            </div>

            <div className="wk-theme">
              <span className="wk-theme-lab">Theme</span>
              <input className="wk-theme-in" value={weekly.theme} maxLength={64}
                placeholder="name the week" onChange={e => setTheme(e.target.value)} />
              <span className="wk-today">{dateStr}</span>
            </div>

            <div className="wk-band">
              <div className="wk-rail">
                <section className="wk-mod f-tick">
                  <div className="wk-mod-head"><span>Priorities</span><span className="wk-tag">after God</span></div>
                  {weekly.priorities.map((p, i) => (
                    <div className="wk-pri-row" key={i}>
                      <span className="wk-rank">{String(i + 1).padStart(2, "0")}</span>
                      <AutoText className="wk-in" value={p} placeholder="—"
                        onChange={e => setPriority(i, e.target.value)} />
                    </div>
                  ))}
                </section>

                <WeeklyList
                  title="Weekly Tasks" tag="current week only" frame="f-rail"
                  items={weekly.tasks} empty="no tasks logged for this cycle"
                  onAdd={listAdd("tasks")} onSet={listSet("tasks")} onRemove={listRemove("tasks")}
                  onToggleDone={listToggleDone("tasks")} />

                <WeeklyList
                  title="This Week's Goals" tag="pulls from life goals later" progress frame="f-rail alt"
                  items={weekly.goals} empty="no goals set for this cycle"
                  onAdd={listAdd("goals")} onSet={listSet("goals")} onRemove={listRemove("goals")}
                  onToggleDone={listToggleDone("goals")} />
              </div>

              <div className="wk-center">
                <section className="wk-mod f-instr">
                  <div className="wk-mod-head"><span>Week at a Glance</span>
                    {/* Deliberate scope cut, not a missing feature: calendar push
                        (Grid → external calendar, outbound only) is its own build. */}
                    <span className="wk-tag">mon–sun · no calendar sync — pushed separately</span></div>
                  <div className="wk-gl">
                    <div className="wk-gl-head">
                      <span className="wk-gl-corner" />
                      {GLANCE_DAYS.map((d, i) => (
                        <span key={d} className={"wk-gl-day" + (i === todayIdx ? " today" : "")}>
                          <b>{d.slice(0, 3)}</b>
                          <i>{glanceCols[i].getDate()}</i>
                        </span>
                      ))}
                    </div>
                    {GLANCE_ROWS.map(row => (
                      <div className={"wk-gl-row" + (row.key === "reminders" ? " reminders" : "")} key={row.key}>
                        <span className="wk-gl-lab">{row.label}</span>
                        {GLANCE_DAYS.map((_, i) => (
                          <GlanceCell key={i} items={glanceOf(row.key, i)} today={i === todayIdx}
                            onAdd={glanceAdd(row.key, i)} onSet={glanceSet(row.key, i)} onRemove={glanceRemove(row.key, i)} />
                        ))}
                      </div>
                    ))}
                  </div>
                </section>

                {/* OTHER from the sheet — a week-level pair, never per-day */}
                <section className="wk-ss">
                  <label className="wk-ss-half stop">
                    <span className="wk-ss-lab">Stop</span>
                    <input className="wk-in" value={weekly.stopStart?.stop || ""}
                      placeholder="what to cut this week"
                      onChange={e => setStopStart("stop", e.target.value)} />
                  </label>
                  <label className="wk-ss-half start">
                    <span className="wk-ss-lab">Start</span>
                    <input className="wk-in" value={weekly.stopStart?.start || ""}
                      placeholder="what to begin this week"
                      onChange={e => setStopStart("start", e.target.value)} />
                  </label>
                </section>

                <WeekStateChart weekly={weekly} now={now} />
              </div>

              <RitualList
                steps={store.ritual.steps} checked={weekly.ritualChecked || {}}
                done={ritual.done} total={ritual.total}
                onToggle={ritualToggle} onSet={ritualSet} onMove={ritualMove}
                onAdd={ritualAdd} onRemove={ritualRemove} />
            </div>

            <DailyMetricsLog weekly={weekly} ritual={ritual} now={now}
              onSetDay={metricSetDay} onSetGoal={metricSetGoal}
              onCloseWeek={doCloseWeek} onClearGrid={doClearGrid} />
          </div>
        )}

        {screen === "metricsOutsourcing" && <MetricsOutsourcingSector store={store} now={now} onDismissInsight={onDismissInsight} />}

        {screen === "dailyOverview" && (
          <div className="zoneview fade-up">
            <div className="zv-head">
              <span className="zv-code">◐</span>
              <span className="zv-name">Daily Overview · live sector</span>
              <span className="do-headright">
                <span className="do-day"><i>day</i><b>{dayOfYear(now)}</b></span>
                <span className="do-boundary">{dayKey(now)} · resets midnight</span>
              </span>
            </div>

            <div className="do-theme">
              <span className="do-theme-lab">Theme</span>
              <input className="do-theme-in" value={daily.theme} maxLength={64}
                placeholder="name the day" onChange={e => setDailyField("theme")(e.target.value)} />
              <span className="do-today">{dateStr}</span>
            </div>

            <div className="do-goal">
              <span className="do-goal-lab">1% Goal</span>
              <input className="do-goal-in" value={daily.goal1pct} maxLength={120}
                placeholder="one small improvement for today" onChange={e => setDailyField("goal1pct")(e.target.value)} />
            </div>

            <section className="do-ref">
              <div className="wk-mod-head"><span>Today's Reference</span>
                <span className="wk-tag">live-linked to weekly overview · read-only, edit there</span></div>
              {todayIdx < 0 ? (
                <div className="empty-s">today isn't part of this week's glance span yet — check back after the boundary tick</div>
              ) : (
                <>
                  <div className="do-ref-grid">
                    {GLANCE_ROWS.map(row => {
                      const items = glanceOf(row.key, todayIdx);
                      return (
                        <div className={"do-ref-row" + (row.key === "reminders" ? " reminders" : "")} key={row.key}>
                          <span className="do-ref-lab">{row.label}</span>
                          <div className="do-ref-items">
                            {items.length === 0 ? <span className="do-ref-empty">—</span> :
                              items.map(it => <span className="do-ref-item" key={it.id}>{it.text || "—"}</span>)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="do-ref-ss">
                    <span className="do-ref-ss-half"><b>Stop</b>{weekly.stopStart?.stop || "—"}</span>
                    <span className="do-ref-ss-half"><b>Start</b>{weekly.stopStart?.start || "—"}</span>
                  </div>
                </>
              )}
            </section>

            <DailyRankedList
              title="Priorities" tag="resets daily · independent of weekly priorities"
              items={daily.priorities} empty="no priorities set for today"
              onAdd={dailyListAdd("priorities")} onSet={dailyListSet("priorities")} onRemove={dailyListRemove("priorities")} />

            <DailyTaskList
              items={daily.tasks} empty="no tasks logged for today"
              onAdd={dailyListAdd("tasks")} onSet={dailyListSet("tasks")} onRemove={dailyListRemove("tasks")}
              onToggleDone={dailyListToggleDone("tasks")} onSetPriority={dailyTaskSetPriority} />

            <DailyRankedList
              title="Today's Goals" tag="resets daily" variant="bullet"
              items={daily.goals} empty="no goals set for today"
              onAdd={dailyListAdd("goals")} onSet={dailyListSet("goals")} onRemove={dailyListRemove("goals")} />

            {/* Real sync, Module 3 of the Contact Tracker spec — pulls contacts where
                contactOverdue/contactDueToday is true. Read-only here; edit the
                contact itself in the Roster. The manual Extras list stays layered
                on top, unchanged. */}
            <section className="do-mod f-tick ct-sync">
              <div className="wk-mod-head"><span>People to Reach Out To</span><span className="wk-tag">synced from contact tracker</span></div>
              {contactSyncList.length === 0 && <div className="do-empty">no overdue or due-today contacts</div>}
              {contactSyncList.map(c => (
                <div className={"ct-sync-row" + (c.overdue ? " overdue" : " due-today")} key={c.id}>
                  <span className="ct-sync-name">{c.name || "—"}</span>
                  <span className="ct-sync-tag">{c.overdue ? "overdue" : "due today"}</span>
                </div>
              ))}
            </section>
            <DailyRankedList
              title="Extras" tag="manually flagged · persists across days"
              items={daily.people} empty="no extra names flagged for today"
              onAdd={dailyListAdd("people")} onSet={dailyListSet("people")} onRemove={dailyListRemove("people")} />

            <HomeworkTable items={daily.homework} onAdd={homeworkAdd} onSet={homeworkSet} onRemove={homeworkRemove} onToggleDone={homeworkToggleDone} />

            <section className="do-mod f-tick">
              <div className="wk-mod-head"><span>Reflection</span><span className="wk-tag">resets daily</span></div>
              <div className="do-refl-row">
                <span className="do-refl-lab">What did you learn?</span>
                <AutoText className="do-in" value={daily.reflection.learned} placeholder="—"
                  onChange={e => setReflectionField("learned", e.target.value)} />
                <button className="do-refl-btn" onClick={() => onReflectionStub("Log in Learning Matrix")}>Log in Learning Matrix</button>
              </div>
              <div className="do-refl-row">
                <span className="do-refl-lab">Where was God's hand?</span>
                <AutoText className="do-in" value={daily.reflection.godsHand} placeholder="—"
                  onChange={e => setReflectionField("godsHand", e.target.value)} />
                <button className="do-refl-btn" onClick={() => onReflectionStub("Log in Spirituality")}>Log in Spirituality</button>
              </div>
              <div className="do-refl-row">
                <span className="do-refl-lab">How can I improve tomorrow?</span>
                <AutoText className="do-in" value={daily.reflection.improve} placeholder="—"
                  onChange={e => setReflectionField("improve", e.target.value)} />
              </div>
              {reflectionStub && <div className="do-refl-stub">{reflectionStub}</div>}
            </section>
          </div>
        )}

        {screen === "contactTracker" && (
          <div className="zoneview fade-up">
            <div className="zv-head">
              <span className="zv-code">◫</span>
              <span className="zv-name">Contact Tracker · live sector</span>
            </div>
            <ContactRoster items={contactTracker.contacts} onAdd={contactAdd} onSet={contactSet} onRemove={contactRemove} />
          </div>
        )}

        {screen === "projects" && (
          <div className="zoneview fade-up">
            <div className="zv-head">
              <span className="zv-code">◆</span>
              <span className="zv-name">Project Tracker · live sector</span>
            </div>
            <ProjectTracker projects={projectTracker.projects}
              onAdd={projAdd} onEdit={projEdit} onMoveZone={projMoveZone} onSetState={projSetState} onRemove={projRemove} />
          </div>
        )}

        {screen === "lifeGoals" && (
          <div className="zoneview fade-up">
            <div className="zv-head">
              <span className="zv-code">◎</span>
              <span className="zv-name">Life Goals · live sector</span>
            </div>
            <LifeGoalsBoard goals={lifeGoals.goals}
              onAdd={glAdd} onEdit={glEdit} onSetStatus={glSetStatus} onRemove={glRemove} />
          </div>
        )}

        {screen === "zone" && sector && (
          <div className="zoneview fade-up">
            <div className="zv-head"><span className="zv-code">{sector.glyph}</span>
              <span className="zv-name">{sector.label}{sector.locked ? " · not yet built" : " · zones land in phase 2"}</span></div>
            <div className="empty">
              <div className="empty-ring"><span>{sector.glyph}</span></div>
              <div className="empty-t">no signals in this sector</div>
              <div className="empty-s">real structure lands later in the life-os expansion</div>
            </div>
          </div>
        )}
      </div>
      <TileModal tile={expandedTile} onClose={() => setExpandedTile(null)} />
      {showCloseOut && (
        <CloseOutDialog budget={budget} now={now} onLater={() => setCloseOutLater(true)}
          onConfirm={(opening) => writeBudget(b => closeOutMonth(b, opening))} />
      )}
      {sync.conflict && (
        <SyncConflictDialog conflict={sync.conflict} local={store}
          onResolve={(choice) => engineRef.current?.resolve(choice)}
          onDownloadCloud={() => downloadText(`the-grid-CLOUD-copy-${dayKey(new Date())}.json`, exportBackup(normalizeStore(sync.conflict.remote.data)))}
          onDownloadLocal={() => downloadText(`the-grid-THIS-BROWSER-copy-${dayKey(new Date())}.json`, exportBackup(store))} />
      )}
    </div>
  );
}

// Shown when the sync engine refuses to guess. Deliberately cannot be dismissed by
// clicking outside — sync is paused until one side is chosen. Both copies can be
// downloaded first, so no choice here is irreversible.
const SYNC_REASONS = {
  "unlinked-both": "This browser has its own data, and your cloud copy has data too. They have never been linked, so The Grid won't guess which one wins.",
  "diverged": "This browser and the cloud both changed since they last synced.",
  "local-empty": "This browser's data looks empty, but your cloud copy has data. This usually means browser storage was cleared. Restoring from the cloud is almost certainly what you want.",
  "remote-older": "The cloud copy is older than what this browser last synced with — something rolled it back. Check both before choosing.",
};
function SyncConflictDialog({ conflict, local, onResolve, onDownloadCloud, onDownloadLocal }) {
  const sum = (s) => { const x = summarizeStore(s); return `${x.contacts} contacts · ${x.weeklyItems} weekly items · ${x.dailyItems} daily items · ${x.archivedWeeks} archived weeks`; };
  const remote = conflict.remote;
  return (
    <div className="tile-modal-backdrop">
      <div className="tile-modal alarm sync-dialog">
        <div className="tm-head"><span className="tm-title">cloud sync · choose a copy</span></div>
        <div className="sd-why">{SYNC_REASONS[conflict.reason] ?? "The two copies differ."}</div>
        <div className="sd-cols">
          <div className="sd-col"><b>cloud copy</b><i>saved {remote?.updated_at ? new Date(remote.updated_at).toLocaleString() : "—"}</i><span>{sum(remote?.data ? normalizeStore(remote.data) : null)}</span>
            <button className="sd-dl" onClick={onDownloadCloud}>download it first</button></div>
          <div className="sd-col"><b>this browser</b><i>right now</i><span>{sum(local)}</span>
            <button className="sd-dl" onClick={onDownloadLocal}>download it first</button></div>
        </div>
        <div className="sd-actions">
          <button className={"sd-btn" + (conflict.reason === "local-empty" ? " rec" : "")} onClick={() => onResolve("cloud")}>use cloud copy<small>replaces this browser</small></button>
          <button className="sd-btn" onClick={() => onResolve("local")}>use this browser's copy<small>replaces the cloud copy</small></button>
        </div>
      </div>
    </div>
  );
}

// ── auth gate ──
// Login comes BEFORE the PIN ritual. The Supabase session persists in this
// browser, so it's one login per browser, not per visit. Local data is never
// touched by signing in or out — sync (step 2) layers on top of it.
function AuthShell({ children }) {
  return (
    <div className="grid-root">
      <style>{CSS}</style>
      <Starfield />
      <div className="grid-veil" /><div className="grid-scan" /><div className="grid-vignette" />
      <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
      <div className="stage">{children}</div>
    </div>
  );
}

function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const submit = async (e) => {
    e.preventDefault();
    if (busy || !email || !password) return;
    setBusy(true); setErr("");
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) setErr(error.message); // on success onAuthStateChange swaps this screen out
    setBusy(false);
  };
  return (
    <AuthShell>
      <form className="lock-wrap fade-up" onSubmit={submit}>
        <div className="lock-title">The Grid</div>
        <div className="lock-sub">// operator login · email + password</div>
        <input className="auth-in" type="email" autoComplete="username" placeholder="email"
          value={email} onChange={e => setEmail(e.target.value)} />
        <input className="auth-in" type="password" autoComplete="current-password" placeholder="password"
          value={password} onChange={e => setPassword(e.target.value)} />
        {err && <div className="auth-err">{err}</div>}
        <button type="submit" className={"enter-grid" + (email && password && !busy ? " ready" : "")}>{busy ? "checking…" : "sign in"}</button>
        <div className="lock-note">this login is what protects your data. invite-only — there is no sign-up here.</div>
      </form>
    </AuthShell>
  );
}

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = still checking, null = signed out
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);
  if (session === undefined) return <AuthShell><div className="lock-wrap"><div className="lock-sub">// checking session…</div></div></AuthShell>;
  if (!session) return <LoginScreen />;
  return <GridApp authSession={session} onSignOut={() => supabase.auth.signOut()} />;
}
