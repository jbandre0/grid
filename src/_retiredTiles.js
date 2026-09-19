// RETIRED — Phase 0 placeholder dashboard tiles. Not imported anywhere.
//
// These were removed from the KPI dashboard because their *structure* was
// invented, not just their numbers: none of them had a data model behind them
// (no Project Tracker zones, no health/habits/travel sectors, no time audit).
// The dashboard is being rebuilt from real structure outward, one sector at a
// time, so a tile only earns a slot once something actually produces its value.
//
// Kept purely as reference for label/shape ideas when those sectors get built.
// This project isn't under version control, which is the only reason this file
// exists — delete it freely once the ideas are recorded elsewhere.

export const RETIRED_HERO_KPIS = [
  { label: "Active Projects", value: "07", sub: "split L4·S2·1·11", alarm: false, size: "lg", cockpit: true, ticks: 7, ticksTotal: 10 },
  { label: "Neglect Flags", value: "02", sub: "oldest 19d", alarm: true, size: "lg", cockpit: true },
];

export const RETIRED_MICRO_TILES_TOP = [
  { label: "Zone L", value: "04", sub: "of 17 total", cockpit: true, ticks: 2, ticksTotal: 8 }, { label: "Zone S", value: "02" }, { label: "Zone 1", value: "11" },
  { label: "Shelf", value: "23" }, { label: "Stale >7d", value: "03", alarm: true }, { label: "Tags", value: "18" },
  { label: "System Health", value: "82", shape: "arcshape" }, { label: "Streak", value: "14d", shape: "tall" },
  { label: "Budget Used", value: "68%", shape: "wide" },
  { label: "Runway", value: "4.2mo" }, { label: "Workouts/wk", value: "03" }, { label: "Sleep Avg", value: "6.8h", alarm: true, shape: "tall" },
  { label: "Trips Logged", value: "09" }, { label: "Decisions Open", value: "02" }, { label: "Gratitude Streak", value: "31d", shape: "wide" },
  { label: "Scholarships", value: "05" },
];

export const RETIRED_MICRO_TILES_BOTTOM = [
  { label: "Reading Pace", value: "1.2/wk", shape: "wide" }, { label: "Contacts Due", value: "07", alarm: true },
  { label: "Skill Reps", value: "44", shape: "tall" }, { label: "Time Audit Δ", value: "-3.1h", alarm: true, shape: "wide" },
  { label: "Bucket List", value: "6/40" }, { label: "Income Streams", value: "03" },
  { label: "Networking Pings", value: "02", shape: "tall" }, { label: "Car Service", value: "1.2k mi", shape: "wide" },
  { label: "Study Plan", value: "wk 4" }, { label: "Meal Plan Adh.", value: "77", shape: "arcshape" },
];

// also retired: the "Grid Uptime" badge (ArcGauge 91) that sat beside the map
