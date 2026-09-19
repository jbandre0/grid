// THE GRID — persistent data layer · v1
// Single versioned localStorage key, pure functions only (no React in here).
// Budget is the first sector with real data; later sectors join this same
// store. Flags are structured events ({id, sector, type, severity, message,
// createdAt}) so the future notification bus can consume them unchanged.
// Honest constraint: localStorage is per-browser/per-device — no sync until
// the sync phase lands.

const KEY = "grid.store.v1";

export const monthKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

export const dayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// Nth day of the calendar year, for Daily Overview's Header module.
export const dayOfYear = (d = new Date()) =>
  Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - new Date(d.getFullYear(), 0, 1)) / 86400000) + 1;

export const fmtMoney = (n) => {
  const v = Number(n) || 0;
  return (v < 0 ? "-$" : "$") + Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// Week at a Glance rows. Four per-day rows only — the sheet's fifth row, OTHER,
// was never per-day: it is a single STOP:/START: pair spanning the week, so it
// renders as its own week-level band (weekly.stopStart) rather than 7 empty
// cells pretending to be days.
export const GLANCE_ROWS = [
  { key: "obligations", label: "Obligations" },
  { key: "needs", label: "Needs" },
  { key: "wants", label: "Wants" },
  { key: "reminders", label: "Reminders" },
];

// The weekly planning ritual, verbatim from the source sheet — this is real
// user content, not placeholder text. Seeded once as the editable template.
const RITUAL_DEFAULTS = [
  "Update decision journal if needed",
  "Outsource daily metrics and review weekly metrics patterns",
  "Review time audit sheet for the week",
  "Review all finances",
  "Review health",
  "Weekly close: Create STOP doing list and notice what worked",
  "Review life goals and last week's goals",
  "Review rulebook of personal standards",
  "Identify weekly theme",
  "Record all obligations for the week",
  "Plan calls, meetings, social time",
  "Make the week's task list based on goals",
  'Add "wants" to the week',
  "Assign tasks to days based on each day's schedule",
  "Add all obligations to Apple Calendar",
  "Update action items sheet and review progress",
  "Close with Matthew McConaughey motivational speech",
];

// The 31 Daily Metrics Log rows, verbatim labels + kind/rollup from the spec
// table. `dir` is which direction is "good," used only for the goal/average
// comparison color — grounded in the sheet's own goal annotations where they
// existed (e.g. Stress Level's goal was "<2.5", Phone Time's "<3.5"). Clock
// metrics (Bedtime/Wake) are "lower" — earlier is better — but their compare
// value gets noon-pivoted before the goal check (see metricGoalState), same
// caveat the circular mean itself carries: only well-behaved when values
// cluster near midnight, not for a metric that's genuinely all over the clock.
// `group` bands the 31 rows into 7 labelled sections in the UI, in the sheet's
// own order — this is a display concern only, not a data concern.
export const METRICS = [
  { id: "dayRating", label: "Day Rating", kind: "scale", rollup: "mean", dir: "higher", group: "state" },
  { id: "mood", label: "Mood", kind: "scale", rollup: "mean", dir: "higher", group: "state" },
  { id: "energy", label: "Energy", kind: "scale", rollup: "mean", dir: "higher", group: "state" },
  { id: "stress", label: "Stress Level", kind: "scale", rollup: "mean", dir: "lower", group: "state" },
  { id: "bedtime", label: "Bedtime", kind: "clock", rollup: "meanCircular", dir: "lower", group: "sleep" },
  { id: "wake", label: "Wake Time", kind: "clock", rollup: "meanCircular", dir: "lower", group: "sleep" },
  { id: "sleepHrs", label: "Sleep Hrs.", kind: "hours", rollup: "both", dir: "higher", group: "sleep" },
  { id: "scriptureMin", label: "Scripture Min.", kind: "mins", rollup: "both", dir: "higher", group: "focusGrowth" },
  { id: "studyQuality", label: "Study Quality", kind: "scale", rollup: "mean", dir: "higher", group: "focusGrowth" },
  { id: "phoneHrs", label: "Phone Time Hrs.", kind: "hours", rollup: "both", dir: "lower", group: "focusGrowth" },
  { id: "deepWorkHrs", label: "Deep Work Hrs.", kind: "hours", rollup: "both", dir: "higher", group: "focusGrowth" },
  { id: "onlineLearnMin", label: "Online Learning Min.", kind: "mins", rollup: "both", dir: "higher", group: "focusGrowth" },
  { id: "readingMin", label: "Reading Min.", kind: "mins", rollup: "both", dir: "higher", group: "focusGrowth" },
  { id: "steps", label: "Steps", kind: "count", rollup: "both", dir: "higher", group: "body" },
  { id: "water", label: "Water Intake (cups)", kind: "count", rollup: "both", dir: "higher", group: "body" },
  { id: "nutritionQ", label: "Nutrition Q", kind: "scale", rollup: "mean", dir: "higher", group: "body" },
  { id: "workoutHrs", label: "Workout Hrs.", kind: "hours", rollup: "both", dir: "higher", group: "body" },
  { id: "workoutIntensity", label: "Workout Intensity", kind: "scale", rollup: "mean", dir: "higher", group: "body" },
  { id: "temple", label: "Temple?", kind: "yesno", rollup: "sumFraction", dir: "higher", group: "faithDiscipline" },
  { id: "serviceActs", label: "Service Acts", kind: "count", rollup: "both", dir: "higher", group: "faithDiscipline" },
  { id: "distractions", label: "Distractions (/10)", kind: "scale", rollup: "mean", dir: "lower", group: "faithDiscipline" },
  { id: "moneySpent", label: "Money Spent", kind: "money", rollup: "both", dir: "lower", group: "finance" },
  { id: "moneyEarned", label: "Money Earned", kind: "money", rollup: "both", dir: "higher", group: "finance" },
  { id: "impulseBuys", label: "Impulse Buys", kind: "count", rollup: "both", dir: "lower", group: "finance" },
  { id: "impulseCost", label: "Impulse Cost", kind: "money", rollup: "both", dir: "lower", group: "finance" },
  { id: "financeReview", label: "Finance Review?", kind: "yesno", rollup: "sumFraction", dir: "higher", group: "finance" },
  { id: "mcs", label: "MCs", kind: "count", rollup: "both", dir: "higher", group: "relPlanning" },
  { id: "qualityFamHrs", label: "Quality Fam Hrs.", kind: "hours", rollup: "both", dir: "higher", group: "relPlanning" },
  { id: "qualityFriendsHrs", label: "Quality Friends Hrs.", kind: "hours", rollup: "both", dir: "higher", group: "relPlanning" },
  { id: "pctPlan", label: "%Time Spent to Plan", kind: "pct", rollup: "mean", dir: "higher", group: "relPlanning" },
  { id: "reflection", label: "Reflection?", kind: "yesno", rollup: "sumFraction", dir: "higher", group: "relPlanning" },
];

export const METRIC_GROUPS = [
  { key: "state", label: "State" },
  { key: "sleep", label: "Sleep" },
  { key: "focusGrowth", label: "Focus & Growth" },
  { key: "body", label: "Body" },
  { key: "faithDiscipline", label: "Faith & Discipline" },
  { key: "finance", label: "Finance" },
  { key: "relPlanning", label: "Relationships & Planning" },
];

const DEFAULT_STORE = {
  version: 1,
  budget: {
    // capital on hand — live accounts, manually updated when checked
    capital: {
      accounts: [
        { id: "cash", name: "Cash", value: 0 },
        { id: "bank", name: "Bank", value: 0 },
      ],
      monthlyLog: [], // { month, start, end, notes } — in/out derived (end − start)
    },
    assets: [],        // { id, name, value } — manual for now (portfolio pull is a future integration)
    oweLedger: [],     // { id, direction: "iowe"|"owedme", person, amount, reason, due, status: "open"|"paid" }
    categories: [],    // { id, name, budgeted, spent } — spent resets on month close-out
    spendEntries: [],  // { id, categoryId, amount, note, at }
    netWorthLog: [],   // { month, start, end, notes } — same close-out behavior as capital
    dismissedFlags: [], // flag ids — dismissals persist so the same flag doesn't re-fire
    lastSeenMonth: null, // drives auto month-close-out on first login of a new month
    seeded: null,       // marks which mock seed (if any) populated this store
  },
  // Weekly Overview — live, current-week-only. Nothing here is archived; history
  // belongs to the future Weekly Metrics Outsourcing sector, which this feeds
  // one-directionally. Increment 1 fields only; Week at a Glance, the ritual
  // checklist and the metrics log attach later through loadStore's merge-forward.
  weekly: {
    weekKey: null,                    // Sunday-boundary key of the week currently loaded
    theme: "",                        // short weekly theme, e.g. "LOOK OUTWARDS."
    priorities: ["", "", "", "", ""], // ranked, after God — blanks each new week
    tasks: [],                        // { id, text, done } — freeform, blanks each new week
    goals: [],                        // { id, text, done } — freeform, blanks each new week
    glance: {},                       // { rowKey: { dayIndex 0..6 (MON..SUN): [{ id, text }] } }
    stopStart: { stop: "", start: "" }, // week-level, not per-day (see GLANCE_ROWS note)
    ritualChecked: {},                // { stepId: true } — completion only, blanks each week
    // Daily Metrics Log. Deliberately NOT cleared by touchWeek, unlike every
    // other field above — the user's own workflow is manual: Close Week, THEN
    // Clear Grid, THEN set next week's goals, all as separate button presses,
    // possibly well after the Sunday boundary has already ticked over. Tying
    // this to the automatic reset would risk wiping Saturday's entries before
    // they've been closed out.
    metrics: {},       // { [metricId]: { 0..6: value } }, indexed by metricsDates (SUN–SAT)
    metricsGoals: {},  // { [metricId]: number } — plain numbers only, no comparator text
  },
  // The ritual TEMPLATE lives outside `weekly` on purpose. Step text and order
  // persist forward as the template for every future week; only the checkbox
  // state (weekly.ritualChecked) resets. Keeping them in separate slices means a
  // future blanket reset of `weekly` can never take the template with it.
  ritual: { steps: RITUAL_DEFAULTS.map((text, i) => ({ id: `r${i + 1}`, text })) },
  // Daily Overview — live, current-day-only. Fully independent of `weekly`;
  // Today's Reference reads weekly.glance/stopStart directly rather than
  // copying into this slice (see docs/specs/DAILY_OVERVIEW_SPEC.md). Most fields blank at
  // the daily boundary; `people` and `homework` are the deliberate exceptions
  // (see touchDay) — a name you didn't reach or a deadline still days out
  // shouldn't vanish at midnight.
  daily: {
    dayKey: null,          // local-date boundary key of the day currently loaded
    goal1pct: "",           // "1% Goal" one-line text — blanks daily
    theme: "",                // daily theme text — blanks daily
    priorities: [],            // { id, text } — freeform ranked list, blanks daily
    tasks: [],                  // { id, text, priority, done } — independent of weekly.tasks, blanks daily
    goals: [],                   // { id, text } — freeform bullet list, blanks daily
    people: [],                   // { id, text } — "extras" ranked list, freeform. PERSISTS across days
                                   // (Contact Tracker sync is a future addition — see docs/specs/DAILY_OVERVIEW_SPEC.md).
    homework: [],                  // { id, timeRequired, task, cls, dueDate, dueTime, status, done }. PERSISTS across days.
                                    // `done` is separate from the freeform `status` text — it's what
                                    // suppresses the overdue alarm once an assignment is actually
                                    // finished, same reasoning as Owe Ledger not flagging a paid row.
    reflection: { learned: "", godsHand: "", improve: "" }, // blanks daily
  },
  // Contact Tracker — a roster, not a log. `nextContact` is deliberately NOT
  // stored: it's derived fresh from lastContact + CONTACT_INTERVAL_DAYS[frequency]
  // (see contactNextDate below), so it can never drift out of sync with a
  // hand-edited lastContact/frequency the way a cached field could.
  contactTracker: {
    contacts: [], // { id, name, category, lastContact, frequency, priority, method, location, notes }
  },
  // One-directional write target for Close Week. Weekly Overview never reads
  // this back. Weekly Metrics Outsourcing (Build 1) is the passive read-only
  // archive on the receiving end — it displays these rows, it never writes them.
  metricsOutsourcing: {
    rows: [], // { weekKey, weekNumber, closedAt, values: { [metricId]: number|null } }
    seeded: null, // marks which mock seed (if any) populated this store
    dismissedInsights: [], // Build 2 — streak/outlier/correlation ids, dismissals persist
  },
};

// Budget used to ship placeholder records tagged `mock: true` (retired — Budget
// now starts blank and is filled by real entry). Any that survive in a saved
// store, cloud copy or old backup are dropped on load. Only tagged records go;
// anything the user entered has no tag and is never touched.
const isMock = (r) => !!(r && r.mock);
const budgetLists = (b) => [b?.capital?.accounts, b?.capital?.monthlyLog, b?.assets, b?.oweLedger, b?.categories, b?.spendEntries, b?.netWorthLog];
export const budgetHasMock = (b) => budgetLists(b).some(l => Array.isArray(l) && l.some(isMock));
function stripMockBudget(b) {
  if (!budgetHasMock(b)) return b;
  const keep = (l) => Array.isArray(l) ? l.filter(r => !isMock(r)) : l;
  const capital = { ...b.capital, accounts: keep(b.capital?.accounts), monthlyLog: keep(b.capital?.monthlyLog) };
  if (!capital.accounts.length) capital.accounts = structuredClone(DEFAULT_STORE.budget.capital.accounts);
  return { ...b, capital, assets: keep(b.assets), oweLedger: keep(b.oweLedger), categories: keep(b.categories),
    spendEntries: keep(b.spendEntries), netWorthLog: keep(b.netWorthLog), seeded: null };
}

// merge defaults forward so older stores (and older backup files) pick up newly
// added fields without losing anything already saved
function mergeDefaults(parsed) {
  return {
    ...structuredClone(DEFAULT_STORE),
    ...parsed,
    budget: stripMockBudget({ ...structuredClone(DEFAULT_STORE.budget), ...(parsed.budget || {}) }),
    weekly: { ...structuredClone(DEFAULT_STORE.weekly), ...(parsed.weekly || {}) },
    daily: { ...structuredClone(DEFAULT_STORE.daily), ...(parsed.daily || {}) },
    contactTracker: { ...structuredClone(DEFAULT_STORE.contactTracker), ...(parsed.contactTracker || {}) },
    // steps only merge forward if the template was never touched — once the
    // user has edited it, their list wins outright and defaults never re-add
    ritual: parsed.ritual?.steps?.length ? parsed.ritual : structuredClone(DEFAULT_STORE.ritual),
    metricsOutsourcing: { ...structuredClone(DEFAULT_STORE.metricsOutsourcing), ...(parsed.metricsOutsourcing || {}) },
  };
}

// exported so sync can normalise a cloud copy exactly like a local load does
export const normalizeStore = (obj) => mergeDefaults(obj || {});

// ── "does this store hold anything the user actually entered?" ──
// Sync's safety rules hinge on this: a store that is only defaults + Budget's
// mock placeholder is NOT user data, so an empty/fresh browser can adopt the
// cloud copy without asking, and can never silently overwrite a cloud copy that
// has real entries. Budget only counts records that lost their `mock: true` tag.
export function hasUserData(s) {
  if (!s || typeof s !== "object") return false;
  const filled = (v) => typeof v === "string" ? v.trim() !== "" : v != null;
  const anyFilled = (arr) => Array.isArray(arr) && arr.some(x => (typeof x === "object" && x ? (x.text ?? x.name ?? "") !== "" || Object.keys(x).length > 2 : filled(x)));
  const w = s.weekly || {}, d = s.daily || {}, c = s.contactTracker || {}, mo = s.metricsOutsourcing || {}, b = s.budget || {};
  if (filled(w.theme) || anyFilled(w.priorities) || (w.tasks || []).length || (w.goals || []).length) return true;
  if (filled(w.stopStart?.stop) || filled(w.stopStart?.start)) return true;
  if (Object.keys(w.ritualChecked || {}).length || Object.keys(w.metrics || {}).length) return true;
  if (Object.values(w.metricsGoals || {}).some(v => v != null)) return true;
  for (const row of Object.values(w.glance || {})) for (const cell of Object.values(row || {})) if ((cell || []).length) return true;
  if (filled(d.theme) || filled(d.goal1pct)) return true;
  if ((d.priorities || []).length || (d.tasks || []).length || (d.goals || []).length || (d.people || []).length || (d.homework || []).length) return true;
  if (Object.values(d.reflection || {}).some(filled)) return true;
  if ((c.contacts || []).length) return true;
  if ((mo.rows || []).length) return true;
  const recs = [...(b.capital?.accounts || []), ...(b.capital?.monthlyLog || []), ...(b.assets || []), ...(b.oweLedger || []),
    ...(b.categories || []), ...(b.spendEntries || []), ...(b.netWorthLog || [])];
  if (recs.some(r => r && !r.mock && !(r.id && (r.id === "cash" || r.id === "bank") && !Number(r.value)))) return true;
  return false;
}

// one-line human summary for the sync conflict dialog
export function summarizeStore(s) {
  const w = s?.weekly || {}, d = s?.daily || {};
  return {
    contacts: s?.contactTracker?.contacts?.length || 0,
    weeklyItems: (w.tasks?.length || 0) + (w.goals?.length || 0),
    dailyItems: (d.tasks?.length || 0) + (d.priorities?.length || 0) + (d.goals?.length || 0) + (d.homework?.length || 0),
    archivedWeeks: s?.metricsOutsourcing?.rows?.length || 0,
  };
}

export function loadStore() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULT_STORE);
    const parsed = JSON.parse(raw);
    const merged = mergeDefaults(parsed);
    if (budgetHasMock(parsed.budget)) saveStore(merged); // persist the one-time placeholder wipe
    return merged;
  } catch {
    return structuredClone(DEFAULT_STORE);
  }
}

// ── backup / restore ──
// Export wraps the whole store in a small envelope so an import can tell a
// Grid backup from any random JSON file. Import validates the envelope AND
// the slices that must be objects, then runs the result through mergeDefaults
// so a backup taken before a newer field existed still loads cleanly.
export function exportBackup(store) {
  return JSON.stringify({ app: "the-grid", version: store.version ?? 1, exportedAt: new Date().toISOString(), store }, null, 2);
}
export function parseBackup(text) {
  let obj;
  try { obj = JSON.parse(text); } catch { return { ok: false, error: "not valid JSON" }; }
  if (obj?.app !== "the-grid" || !obj.store || typeof obj.store !== "object") return { ok: false, error: "not a THE GRID backup file" };
  for (const k of ["budget", "weekly", "daily", "contactTracker", "metricsOutsourcing"]) {
    if (obj.store[k] != null && (typeof obj.store[k] !== "object" || Array.isArray(obj.store[k]))) return { ok: false, error: `backup has a malformed "${k}" section` };
  }
  return { ok: true, store: mergeDefaults(obj.store), exportedAt: obj.exportedAt };
}

export function saveStore(store) {
  localStorage.setItem(KEY, JSON.stringify(store));
  return store;
}

// month tracking scaffold — called on every successful PIN entry. Full
// auto-close-out (snapshot logs, reset category budgets, recap flag) lands
// with the Capital on Hand entry increment; for now this only tracks the month.
export function touchMonth(store) {
  const b = store.budget;
  const now = monthKey();
  if (b.lastSeenMonth === now) return store;
  b.lastSeenMonth = now;
  return saveStore(store);
}

// ── week math (Weekly Overview) ──
// The canonical week boundary is Sunday 00:00: resets fire there, and the week
// number is derived from it so the number changes on the same tick as the reset.
// ISO week numbers would roll over on Monday and lag the reset by a day.
//
// TWO DELIBERATE DAY ORDERS — do not unify them (see docs/specs/WEEKLY_OVERVIEW_SPEC.md):
//   · Week at a Glance runs MON–SUN — you plan on Sunday for the week that
//     starts the next morning, so its 7 columns are boundary+1 … boundary+7.
//   · Daily Metrics Log runs SUN–SAT — it logs the week you are living through,
//     so its 7 columns are boundary+0 … boundary+6.
// They overlap by six days and differ by one at each end. That is intended.
const pad2 = (n) => String(n).padStart(2, "0");
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

export const weekStart = (d = new Date()) => addDays(d, -d.getDay()); // getDay(): 0 = Sunday
export const weekKey = (d = new Date()) => {
  const s = weekStart(d);
  return `${s.getFullYear()}-${pad2(s.getMonth() + 1)}-${pad2(s.getDate())}`;
};

// Week 1 is always the week containing Jan 1, so a week straddling New Year
// belongs to the incoming year. Verified against the source sheet: Aug 1 2026
// lands in week 31, which only this rule reproduces.
export const weekNumber = (d = new Date()) => {
  const s = weekStart(d), end = addDays(s, 6);
  const y = end.getFullYear() > s.getFullYear() ? end.getFullYear() : s.getFullYear();
  const first = weekStart(new Date(y, 0, 1));
  return Math.round((s - first) / 86400000 / 7) + 1;
};

export const GLANCE_DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];
export const METRICS_DAYS = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
export const glanceDates = (d = new Date()) => Array.from({ length: 7 }, (_, i) => addDays(weekStart(d), i + 1));
export const metricsDates = (d = new Date()) => Array.from({ length: 7 }, (_, i) => addDays(weekStart(d), i));

// Blanks the current-week-only modules when the Sunday boundary passes. Runs on
// every successful PIN entry, alongside touchMonth. Nothing is archived on the
// way out — that is the spec, not an oversight.
export function touchWeek(store) {
  // tolerate a store shape saved before this slice existed
  const w = (store.weekly ||= structuredClone(DEFAULT_STORE.weekly));
  const k = weekKey();
  if (w.weekKey === k) return store;
  w.weekKey = k;
  w.theme = "";
  w.priorities = ["", "", "", "", ""];
  w.tasks = [];
  w.goals = [];
  w.glance = {};
  w.stopStart = { stop: "", start: "" };
  // completion state only — store.ritual.steps (the template) is deliberately
  // untouched here. These two rules must not be collapsed into one.
  w.ritualChecked = {};
  return saveStore(store);
}

// ── day boundary (Daily Overview) ──
// Runs on every successful PIN entry, alongside touchMonth/touchWeek. Blanks
// the current-day-only modules when the calendar date rolls over. `people`
// and `homework` are deliberately skipped — see the `daily` slice comment.
export function touchDay(store) {
  const d = (store.daily ||= structuredClone(DEFAULT_STORE.daily));
  const k = dayKey();
  if (d.dayKey === k) return store;
  d.dayKey = k;
  d.goal1pct = "";
  d.theme = "";
  d.priorities = [];
  d.tasks = [];
  d.goals = [];
  d.reflection = { learned: "", godsHand: "", improve: "" };
  return saveStore(store);
}

// ── Daily Overview → dashboard ──
// Today's Homework tile: rows due today (auto, from the real calendar date —
// not user-picked), plus a live overdue count (past-due, not done) for the
// tile's alarm state. Not routed through Budget's deriveFlags/dismissFlag
// (that engine is Budget-specific and dismissal-persisted); this mirrors how
// Budget's own Overdue TILE also computes its alarm boolean directly rather
// than reading the flag list — the persisted, dismissable flag engine is a
// separate, larger piece (see BUILD_STATE.md's notification-bus open item).
export function homeworkDueToday(daily, now = new Date()) {
  const k = dayKey(now);
  return (daily?.homework || []).filter(h => h.dueDate === k);
}
export function homeworkOverdueCount(daily, now = new Date()) {
  const k = dayKey(now);
  return (daily?.homework || []).filter(h => h.dueDate && h.dueDate < k && !h.done).length;
}

// ── Contact Tracker ──
// Interval-days per Frequency, reverse-engineered from LIFE-2.xlsx's own
// Last Contact / Next Contact columns (checked against all 27 real rows):
// Biweekly reads as "~2×/week" (+3d) in that sheet, NOT "every 2 weeks" —
// Bimonthly is the one that means every 2 weeks (+14d). Counterintuitive but
// matches the source exactly; don't "fix" this to dictionary definitions.
export const CONTACT_INTERVAL_DAYS = {
  Daily: 1, Weekly: 7, Biweekly: 3, Bimonthly: 14, Monthly: 30, Quarterly: 90,
};
export const CONTACT_FREQUENCIES = Object.keys(CONTACT_INTERVAL_DAYS);

// nextContact is deliberately never stored (see the contactTracker slice
// comment) — always derived fresh from lastContact + the interval above.
// Returns null when there's not enough to compute from (no lastContact, or
// no/unrecognized frequency) rather than guessing.
export function contactNextDate(contact) {
  const days = CONTACT_INTERVAL_DAYS[contact?.frequency];
  if (!contact?.lastContact || !days) return null;
  const [y, m, d] = contact.lastContact.split("-").map(Number);
  if (!y || !m || !d) return null;
  return dayKey(addDays(new Date(y, m - 1, d), days));
}
export function contactOverdue(contact, now = new Date()) {
  const next = contactNextDate(contact);
  return next != null && next < dayKey(now);
}
export function contactDueToday(contact, now = new Date()) {
  return contactNextDate(contact) === dayKey(now);
}

export const ritualDone = (store) => {
  const steps = store.ritual?.steps || [];
  const checked = store.weekly?.ritualChecked || {};
  return { done: steps.filter(s => checked[s.id]).length, total: steps.length };
};

// Explicit done checkbox on each row — independent of the inline n/m parser
// below, which is a display-only progress meter, not a completion signal.
export const tasksProgress = (weekly) => {
  const tasks = weekly?.tasks || [];
  return { done: tasks.filter(t => t.done).length, total: tasks.length };
};
export const goalsProgress = (weekly) => {
  const goals = weekly?.goals || [];
  return { done: goals.filter(g => g.done).length, total: goals.length };
};

// The source sheet writes progress inline in goal text ("- 5 gym workouts 1/5").
// Parsed for display only — the raw text stays the stored value, so this never
// constrains what can be typed.
export const goalProgress = (text) => {
  const m = /(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)\s*$/.exec(String(text || "").trim());
  if (!m) return null;
  const done = Number(m[1]), total = Number(m[2]);
  if (!(total > 0)) return null;
  return { done, total, pct: Math.max(0, Math.min(100, (done / total) * 100)), done_eq_total: done >= total };
};

// ── daily metrics log ──
// Clock values are stored as raw minutes-from-midnight (0–1439), same unit the
// circular-mean pivot expects — no separate "corrected" value.
export const minutesFromClock = (hhmm) => {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
};
export const clockFromMinutes = (mins) => {
  if (mins == null || Number.isNaN(mins)) return "";
  const wrapped = ((Math.round(mins) % 1440) + 1440) % 1440;
  return `${pad2(Math.floor(wrapped / 60))}:${pad2(wrapped % 60)}`;
};
// Noon-pivot — see docs/specs/WEEKLY_OVERVIEW_SPEC.md for the worked example. Any time
// ≥ 12:00 shifts by −24h; shared by the circular mean below AND by
// metricGoalState's clock comparison, so both read "earlier/later" the same
// way across the midnight boundary. Only well-behaved when values cluster,
// which real bedtimes do.
// Exported so any UI plotting a clock metric on a continuous axis (e.g. the
// Weekly Metrics Outsourcing trend chart) can pivot the same way instead of
// re-deriving this — a raw 0–1439 scale plots 23:50 and 00:05 at opposite
// ends of the axis even though they're 15 minutes apart.
export const pivotMinutes = (v) => (v >= 720 ? v - 1440 : v);
export const unpivotMinutes = (v) => (v < 0 ? v + 1440 : v);
const circularMeanMinutes = (values) => {
  if (!values.length) return null;
  const pivoted = values.map(pivotMinutes);
  const mean = pivoted.reduce((s, v) => s + v, 0) / pivoted.length;
  return mean < 0 ? mean + 1440 : mean;
};

const enteredMetricValues = (weekly, id) =>
  Object.values(weekly.metrics?.[id] || {}).filter(v => v !== null && v !== undefined && v !== "").map(Number);

// Total is meaningless for meanCircular rows (a summed clock time means
// nothing) and for sumFraction it's a fixed-denominator count, not a sum.
export function metricTotal(weekly, metric) {
  const vals = enteredMetricValues(weekly, metric.id);
  if (metric.rollup === "meanCircular") return null;
  if (metric.rollup === "sumFraction") return vals.filter(v => v === 1).length;
  if (!vals.length) return null;
  return vals.reduce((s, v) => s + v, 0);
}
// Average is meaningless for sumFraction rows — spec displays those as n/7,
// not a mean. Everything else averages over ENTERED days only (not ÷7), which
// is what makes a live, partial-week average an honest signal rather than one
// artificially dragged toward zero early in the week.
export function metricAverage(weekly, metric) {
  const vals = enteredMetricValues(weekly, metric.id);
  if (metric.rollup === "sumFraction") return null;
  if (!vals.length) return null;
  if (metric.rollup === "meanCircular") return circularMeanMinutes(vals);
  return vals.reduce((s, v) => s + v, 0) / vals.length;
}
// The single number a Goal gets compared against: the running average for
// mean/both/meanCircular rows, the running count for sumFraction rows (a
// goal like "temple 1×/week" is a target count, not a target average). A
// metric with no `dir` (none currently) would return null here and never color.
export function metricCompareValue(weekly, metric) {
  if (!metric.dir) return null;
  if (metric.rollup === "sumFraction") return metricTotal(weekly, metric);
  return metricAverage(weekly, metric);
}
// favorable = the running average is AT OR BEYOND the goal — you're hitting
// it (equal counts as a hit, not a shrug). unfavorable = the average is
// behind the goal — you're missing it. This reads the goal as a target to
// clear, not as a proposal to evaluate — don't invert this again.
export function metricGoalState(weekly, metric, goal) {
  if (!metric.dir) return "neutral";
  const g = Number(goal);
  if (goal === "" || goal == null || Number.isNaN(g)) return "neutral";
  const cmp = metricCompareValue(weekly, metric);
  if (cmp == null) return "neutral";
  // Clock rows compare on the same noon-pivoted scale the average was built
  // on, not raw minutes-from-midnight — a straight numeric compare would read
  // 00:10 as "way earlier" than 23:45, which is backwards. Re-pivoting the
  // already-wrapped average recovers the signed value used internally, as
  // long as both cluster near midnight (same caveat the average carries).
  const [a, b] = metric.rollup === "meanCircular" ? [pivotMinutes(cmp), pivotMinutes(g)] : [cmp, g];
  if (metric.dir === "lower") return a <= b ? "favorable" : "unfavorable";
  return a >= b ? "favorable" : "unfavorable";
}

const roundTrim = (v, d = 1) => { const f = 10 ** d; return Math.round(v * f) / f; };
export function fmtMetricValue(metric, v) {
  if (v == null) return "—";
  switch (metric.kind) {
    case "money": return fmtMoney(v);
    case "pct": return Math.round(v) + "%";
    case "clock": return clockFromMinutes(v);
    case "scale": return String(roundTrim(v, 1));
    default: return String(roundTrim(v, 2)); // hours, mins, count
  }
}

// Manually triggered (tied to ritual step "Outsource daily metrics…") —
// explicitly not a silent background auto-trigger like Budget's month
// close-out. Upserts one row keyed by weekKey, so pressing it twice in the
// same week updates rather than duplicates. Does NOT clear the grid — that's
// its own separate, explicit action (clearMetricsGrid), because the real
// workflow is close → clear → set next week's goals as three distinct steps,
// not one bundled reset.
const OUTSOURCE_STEP_ID = "r2";
export function closeWeek(store) {
  const w = store.weekly;
  const values = {};
  METRICS.forEach(m => { values[m.id] = m.rollup === "sumFraction" ? metricTotal(w, m) : metricAverage(w, m); });
  const k = weekKey();
  const row = { weekKey: k, weekNumber: weekNumber(), closedAt: new Date().toISOString(), values };
  const rows = [...store.metricsOutsourcing.rows.filter(r => r.weekKey !== k), row];
  const hasStep = store.ritual.steps.some(s => s.id === OUTSOURCE_STEP_ID);
  const ritualChecked = (hasStep && !w.ritualChecked[OUTSOURCE_STEP_ID])
    ? { ...w.ritualChecked, [OUTSOURCE_STEP_ID]: true } : w.ritualChecked;
  return saveStore({
    ...store,
    weekly: { ...w, ritualChecked },
    metricsOutsourcing: { ...store.metricsOutsourcing, rows },
  });
}
// Clears only the day-value cells. Goals are untouched on purpose — the
// user's workflow edits them as its own separate step right after clearing.
export function clearMetricsGrid(store) {
  return saveStore({ ...store, weekly: { ...store.weekly, metrics: {} } });
}

// ── weekly metrics outsourcing (Build 1 — passive archive, read-only) ──
// Newest first, matching how you'd actually browse a history: most recent
// week at the top.
export const outsourcingRows = (store) =>
  [...store.metricsOutsourcing.rows].sort((a, b) => (a.weekKey < b.weekKey ? 1 : -1));
// One metric's values across every archived week, oldest first — the natural
// reading direction for a trend line. Rows with no value for this metric
// (never logged that metric that week, or the week was a full blank/vacation
// close) are skipped entirely rather than coming through as a fake 0.
export const outsourcingSeries = (store, metricId) =>
  [...store.metricsOutsourcing.rows]
    .filter(r => r.values[metricId] != null)
    .sort((a, b) => (a.weekKey < b.weekKey ? -1 : 1))
    .map(r => ({ weekKey: r.weekKey, weekNumber: r.weekNumber, value: r.values[metricId] }));

const fmtDateKey = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
// weekKey is already the Sunday start; the archive displays the full
// Sun–Sat span so a week reads as a range, not a single anchor date.
export const weekRangeLabel = (weekKey) => {
  const start = new Date(weekKey + "T00:00:00");
  const end = addDays(start, 6);
  return `${fmtDateKey(start)} – ${fmtDateKey(end)}`;
};
// weekKey shifted by N days, still landing on a Sunday for any multiple of 7 —
// used by lagged correlation to find "the following archived week" precisely,
// not just "whatever the next surviving data point happens to be" (a gap of
// several vacation weeks would otherwise silently masquerade as a 1-week lag).
const shiftWeekKey = (wk, days) => fmtDateKey(addDays(new Date(wk + "T00:00:00"), days));

// ── weekly metrics outsourcing — Build 2: analysis toolkit ──────────────────
// Everything below operates on weekly averages only (no daily granularity at
// this layer) and reads store.metricsOutsourcing.rows — it never writes to
// it. Clock metrics (Bedtime/Wake) are pivoted around noon before ANY numeric
// use (regression, correlation, z-score, distribution, moving average) via
// metricPlotValue/metricUnplotValue below — the same reasoning as the Trend
// chart: a raw 0–1439-minute value plots/averages/correlates nonsensically
// across the midnight boundary.

// ── math primitives (pure, no store access) ──
export const mean = (xs) => (xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : null);
export const median = (xs) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b), mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};
// Sample stddev (n−1) — this is always a subset of history, never the full
// population of all weeks that could ever exist.
export const stddev = (xs) => {
  if (xs.length < 2) return null;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((s, v) => s + (v - m) ** 2, 0) / (xs.length - 1));
};
export const zScore = (v, m, sd) => (sd ? (v - m) / sd : null);
export const pearsonR = (xs, ys) => {
  if (xs.length < 2 || xs.length !== ys.length) return null;
  const mx = mean(xs), my = mean(ys);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < xs.length; i++) {
    const dx = xs[i] - mx, dy = ys[i] - my;
    sxy += dx * dy; sxx += dx * dx; syy += dy * dy;
  }
  if (sxx === 0 || syy === 0) return null; // one side has zero variance — undefined, not zero
  return sxy / Math.sqrt(sxx * syy);
};
// Ordinary least squares. r/r2 come along since they share the same sums.
export const linearRegression = (xs, ys) => {
  if (xs.length < 2) return null;
  const mx = mean(xs), my = mean(ys);
  let sxy = 0, sxx = 0;
  for (let i = 0; i < xs.length; i++) { const dx = xs[i] - mx; sxy += dx * (ys[i] - my); sxx += dx * dx; }
  if (sxx === 0) return null;
  const slope = sxy / sxx, intercept = my - slope * mx, r = pearsonR(xs, ys);
  return { slope, intercept, r, r2: r == null ? null : r * r };
};
// Trailing window; the first (window−1) points have no full window yet and
// come back null rather than an average of a partial, misleadingly-short span.
export const movingAverage = (values, window) =>
  values.map((_, i) => (i < window - 1 ? null : mean(values.slice(i - window + 1, i + 1))));

export const metricPlotValue = (metric, raw) => (metric.kind === "clock" ? pivotMinutes(raw) : raw);
export const metricUnplotValue = (metric, plotted) => (metric.kind === "clock" ? unpivotMinutes(plotted) : plotted);

// ── paired series across two metrics ──
// Only weeks where BOTH metrics have a real value contribute a point —
// asymmetric gaps (one metric logged, the other not, in the same week) drop
// that week rather than guessing.
export function metricPairSeries(store, xId, yId) {
  const xMetric = METRICS.find(m => m.id === xId), yMetric = METRICS.find(m => m.id === yId);
  const out = [];
  for (const r of store.metricsOutsourcing.rows) {
    const xv = r.values[xId], yv = r.values[yId];
    if (xv == null || yv == null) continue;
    out.push({ weekKey: r.weekKey, weekNumber: r.weekNumber,
      x: metricPlotValue(xMetric, xv), y: metricPlotValue(yMetric, yv) });
  }
  return out.sort((a, b) => (a.weekKey < b.weekKey ? -1 : 1));
}
// X this week vs Y the FOLLOWING archived week (weekKey + 7 days exactly) —
// not just "the next surviving data point," which would silently stretch a
// 1-week lag across however many vacation weeks sit in between.
export function laggedPairSeries(store, xId, yId) {
  const xMetric = METRICS.find(m => m.id === xId), yMetric = METRICS.find(m => m.id === yId);
  const byKey = new Map(store.metricsOutsourcing.rows.map(r => [r.weekKey, r]));
  const out = [];
  for (const r of store.metricsOutsourcing.rows) {
    const xv = r.values[xId];
    if (xv == null) continue;
    const nextRow = byKey.get(shiftWeekKey(r.weekKey, 7));
    if (!nextRow) continue;
    const yv = nextRow.values[yId];
    if (yv == null) continue;
    out.push({ weekKey: r.weekKey, nextWeekKey: nextRow.weekKey,
      x: metricPlotValue(xMetric, xv), y: metricPlotValue(yMetric, yv) });
  }
  return out.sort((a, b) => (a.weekKey < b.weekKey ? -1 : 1));
}

export const CORR_MIN_WEEKS = 4;
export const LAG_MIN_WEEKS = 6;
const STREAK_MIN = 2; // minimum consecutive weeks before something counts as a "streak" worth surfacing

// ── distribution stats + goal-hit rate (single metric, optional range) ──
export function metricDistribution(store, metricId, sinceWeekKey) {
  const metric = METRICS.find(m => m.id === metricId);
  const series = outsourcingSeries(store, metricId).filter(s => !sinceWeekKey || s.weekKey >= sinceWeekKey);
  if (!series.length) return null;
  const plotted = series.map(s => metricPlotValue(metric, s.value));
  return {
    count: plotted.length,
    mean: metricUnplotValue(metric, mean(plotted)),
    median: metricUnplotValue(metric, median(plotted)),
    stddev: stddev(plotted),
    min: metricUnplotValue(metric, Math.min(...plotted)),
    max: metricUnplotValue(metric, Math.max(...plotted)),
  };
}
// Reads the CURRENT live goal from weekly.metricsGoals — Build 1's archived
// rows never captured what the goal was AT THE TIME (closeWeek() only sends
// the resulting average), so a true historical-goal rate isn't reconstructable
// without changing the Phase 1 write shape, which this build doesn't touch.
// "Hit rate" here means: of all archived weeks, how many would have met
// today's goal.
export function metricGoalHitRate(store, metricId) {
  const metric = METRICS.find(m => m.id === metricId);
  const goal = store.weekly?.metricsGoals?.[metricId];
  if (goal === undefined || goal === null || goal === "") return null;
  const series = outsourcingSeries(store, metricId);
  if (!series.length) return null;
  const g = metricPlotValue(metric, Number(goal));
  const hits = series.filter(s => {
    const v = metricPlotValue(metric, s.value);
    return metric.dir === "lower" ? v <= g : v >= g;
  }).length;
  return { hits, total: series.length, pct: (hits / series.length) * 100, goal: Number(goal) };
}

// ── streaks (current goal, and same-direction runs, per metric) ──
export function metricGoalStreak(store, metricId) {
  const metric = METRICS.find(m => m.id === metricId);
  const goal = store.weekly?.metricsGoals?.[metricId];
  if (goal === undefined || goal === null || goal === "") return 0;
  const g = metricPlotValue(metric, Number(goal));
  let streak = 0;
  for (const r of outsourcingRows(store)) { // newest first
    const v = r.values[metricId];
    if (v == null) break; // a missing/vacation week breaks the streak — can't confirm a hit
    const hit = metric.dir === "lower" ? metricPlotValue(metric, v) <= g : metricPlotValue(metric, v) >= g;
    if (!hit) break;
    streak++;
  }
  return streak;
}
export function metricTrendStreak(store, metricId) {
  const metric = METRICS.find(m => m.id === metricId);
  const series = outsourcingSeries(store, metricId);
  if (series.length < 2) return { length: 0, direction: null };
  const plotted = series.map(s => metricPlotValue(metric, s.value));
  const deltas = [];
  for (let i = 1; i < plotted.length; i++) deltas.push(plotted[i] - plotted[i - 1]);
  const lastSign = Math.sign(deltas[deltas.length - 1]);
  if (lastSign === 0) return { length: 0, direction: null };
  let length = 0;
  for (let i = deltas.length - 1; i >= 0 && Math.sign(deltas[i]) === lastSign; i--) length++;
  const improving = metric.dir === "lower" ? lastSign < 0 : lastSign > 0;
  return { length, direction: improving ? "improving" : "declining" };
}
export function allActiveStreaks(store) {
  const out = [];
  for (const metric of METRICS) {
    const gs = metricGoalStreak(store, metric.id);
    if (gs >= STREAK_MIN) out.push({ id: `streak-goal-${metric.id}`, metricId: metric.id, kind: "goal", length: gs });
    const ts = metricTrendStreak(store, metric.id);
    if (ts.length >= STREAK_MIN) out.push({ id: `streak-trend-${metric.id}`, metricId: metric.id, kind: "trend", length: ts.length, direction: ts.direction });
  }
  return out.sort((a, b) => b.length - a.length);
}

// ── outliers (z-score vs. the metric's own full history) ──
export function metricOutliers(store, metricId, zThreshold = 2) {
  const metric = METRICS.find(m => m.id === metricId);
  const series = outsourcingSeries(store, metricId);
  if (series.length < 4) return []; // too few points to know what "normal" is
  const plotted = series.map(s => metricPlotValue(metric, s.value));
  const m = mean(plotted), sd = stddev(plotted);
  if (!sd) return [];
  return series
    .map((s, i) => ({ id: `outlier-${metricId}-${s.weekKey}`, metricId, weekKey: s.weekKey, weekNumber: s.weekNumber, value: s.value, z: zScore(plotted[i], m, sd) }))
    .filter(s => Math.abs(s.z) >= zThreshold)
    .sort((a, b) => Math.abs(b.z) - Math.abs(a.z));
}
export function allOutliers(store, zThreshold = 2) {
  const out = [];
  for (const metric of METRICS) out.push(...metricOutliers(store, metric.id, zThreshold));
  return out.sort((a, b) => Math.abs(b.z) - Math.abs(a.z));
}

// ── correlation scans across every metric pair ──
export function allCorrelations(store, rThreshold = 0.5) {
  const out = [];
  for (let i = 0; i < METRICS.length; i++) {
    for (let j = i + 1; j < METRICS.length; j++) {
      const pairs = metricPairSeries(store, METRICS[i].id, METRICS[j].id);
      if (pairs.length < CORR_MIN_WEEKS) continue;
      const r = pearsonR(pairs.map(p => p.x), pairs.map(p => p.y));
      if (r != null && Math.abs(r) >= rThreshold) {
        out.push({ id: `corr-${METRICS[i].id}-${METRICS[j].id}`, xId: METRICS[i].id, yId: METRICS[j].id, r, n: pairs.length });
      }
    }
  }
  return out.sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
}
export function allLaggedCorrelations(store, rThreshold = 0.5) {
  const out = [];
  for (const x of METRICS) {
    for (const y of METRICS) {
      if (x.id === y.id) continue;
      const pairs = laggedPairSeries(store, x.id, y.id);
      if (pairs.length < LAG_MIN_WEEKS) continue;
      const r = pearsonR(pairs.map(p => p.x), pairs.map(p => p.y));
      if (r != null && Math.abs(r) >= rThreshold) {
        out.push({ id: `lagcorr-${x.id}-${y.id}`, xId: x.id, yId: y.id, r, n: pairs.length });
      }
    }
  }
  return out.sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
}

// dismissals persist so a still-active streak/outlier/correlation doesn't
// re-surface every visit — same idiom as Budget's flag dismissals
export function dismissInsight(store, id) {
  const mo = store.metricsOutsourcing;
  if (!mo.dismissedInsights.includes(id)) mo.dismissedInsights.push(id);
  return saveStore(store);
}

// ── derivations ──
const sum = (xs, f) => xs.reduce((s, x) => s + (Number(f(x)) || 0), 0);
export const capitalTotal = (b) => sum(b.capital.accounts, a => a.value);
export const assetsTotal = (b) => sum(b.assets, a => a.value);
export const owedToMeOpen = (b) => sum(b.oweLedger.filter(o => o.direction === "owedme" && o.status === "open"), o => o.amount);
export const iOweOpen = (b) => sum(b.oweLedger.filter(o => o.direction === "iowe" && o.status === "open"), o => o.amount);
// Net Worth = Capital on Hand + Assets + (Owed to Me, Open) − (I Owe, Open)
// — receivables count before collection (flagged assumption in the spec)
export const netWorth = (b) => capitalTotal(b) + assetsTotal(b) + owedToMeOpen(b) - iOweOpen(b);

export const logInOut = (row) => (Number(row.end) || 0) - (Number(row.start) || 0);
export const categoryPct = (c) => {
  const budgeted = Number(c.budgeted) || 0;
  if (budgeted <= 0) return 0;
  return ((Number(c.spent) || 0) / budgeted) * 100;
};
// ok → under 75 · warn → 75–100 (caution, gold) · over → past budget (alarm, red)
export const categoryState = (c) => {
  const pct = categoryPct(c);
  return pct >= 100 ? "over" : pct >= 75 ? "warn" : "ok";
};

const startOfToday = (now) => new Date(now.getFullYear(), now.getMonth(), now.getDate());
export const isOverdue = (o, now = new Date()) =>
  o.status === "open" && !!o.due && new Date(o.due + "T00:00:00") < startOfToday(now);

// ── category spend entry ──
// `spent` stays a stored field (every tile and flag reads it); quick-tap logging
// writes the entry AND moves the total in one step, so the two can't drift apart.
// Undo reverses exactly that entry. `spent` can also be set directly (opening
// figure for a mid-cycle start, or a correction) — entries then only ever adjust
// it relatively, which is why undo subtracts rather than recomputes.
const cents = (n) => Math.round((Number(n) || 0) * 100) / 100;
const newId = () => globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2, 10);

export function logSpend(b, categoryId, amount, note = "", now = new Date()) {
  const amt = cents(amount);
  if (!(amt > 0) || !b.categories.some(c => c.id === categoryId)) return b;
  return {
    ...b,
    categories: b.categories.map(c => c.id === categoryId ? { ...c, spent: cents((Number(c.spent) || 0) + amt) } : c),
    spendEntries: [...b.spendEntries, { id: newId(), categoryId, amount: amt, note: String(note || "").trim(), at: now.toISOString() }],
  };
}
export function undoSpend(b, entryId) {
  const e = b.spendEntries.find(x => x.id === entryId);
  if (!e) return b;
  return {
    ...b,
    categories: b.categories.map(c => c.id === e.categoryId ? { ...c, spent: Math.max(0, cents((Number(c.spent) || 0) - e.amount)) } : c),
    spendEntries: b.spendEntries.filter(x => x.id !== entryId),
  };
}
export function removeCategory(b, categoryId) {
  return { ...b, categories: b.categories.filter(c => c.id !== categoryId), spendEntries: b.spendEntries.filter(e => e.categoryId !== categoryId) };
}
// this month's entries for a category, newest first — the only ones undo is offered for
export const monthEntries = (b, categoryId, now = new Date()) =>
  b.spendEntries.filter(e => e.categoryId === categoryId && monthKey(new Date(e.at)) === monthKey(now)).reverse();

// ── flags ──
// Derived fresh from data rather than stored, so a flag clears itself once the
// underlying condition resolves. Ids are stable/content-derived, which is what
// makes a dismissal stick instead of re-firing on the next render.
export function deriveFlags(b, now = new Date()) {
  const out = [];
  b.oweLedger.forEach(o => {
    if (!isOverdue(o, now)) return;
    out.push({
      id: `owe-overdue-${o.id}`,
      sector: "budget", type: "owe-overdue", severity: "alarm",
      message: o.direction === "iowe"
        ? `You owe ${o.person} ${fmtMoney(o.amount)} — past due ${o.due}`
        : `${o.person} owes you ${fmtMoney(o.amount)} — past due ${o.due}`,
      createdAt: o.due,
    });
  });
  const m = monthKey(now);
  b.categories.forEach(c => {
    const state = categoryState(c);
    if (state === "ok") return;
    const pct = Math.round(categoryPct(c));
    out.push(state === "over"
      ? { id: `cat-over-${c.id}-${m}`, sector: "budget", type: "category-over", severity: "alarm",
          message: `${c.name} is over budget — ${fmtMoney(c.spent)} of ${fmtMoney(c.budgeted)} (${pct}%)`, createdAt: m }
      : { id: `cat-warn-${c.id}-${m}`, sector: "budget", type: "category-warn", severity: "attentive",
          message: `${c.name} past 75% — ${fmtMoney(c.spent)} of ${fmtMoney(c.budgeted)} (${pct}%)`, createdAt: m });
  });
  return out;
}

export const activeFlags = (b, now = new Date()) =>
  deriveFlags(b, now).filter(f => !b.dismissedFlags.includes(f.id));

// ── dashboard rollups ──
// Everything the KPI dashboard shows for Budget derives from here, so a tile
// can never drift out of sync with the sector the way the old hardcoded
// mock tiles did.
export function cycleBurn(b) {
  const budgeted = sum(b.categories, c => c.budgeted);
  const spent = sum(b.categories, c => c.spent);
  return { budgeted, spent, pct: budgeted > 0 ? (spent / budgeted) * 100 : 0 };
}
export const overdueCount = (b, now = new Date()) => b.oweLedger.filter(o => isOverdue(o, now)).length;
export const daysPastDue = (o, now = new Date()) =>
  Math.max(0, Math.floor((startOfToday(now) - new Date(o.due + "T00:00:00")) / 86400000));

// Overdue split by direction. A late payable and a late receivable demand
// completely different actions, so the dashboard reports them separately
// rather than collapsing both into one undifferentiated count.
export function overdueSplit(b, now = new Date()) {
  const late = b.oweLedger.filter(o => isOverdue(o, now));
  const side = (dir) => {
    const items = late.filter(o => o.direction === dir);
    return {
      count: items.length,
      oldest: items.reduce((m, o) => Math.max(m, daysPastDue(o, now)), 0),
      amount: sum(items, o => o.amount),
    };
  };
  return { iowe: side("iowe"), owedme: side("owedme") };
}
export const netWorthSeries = (b) => b.netWorthLog.map(r => Number(r.end) || 0);
export const inOutSeries = (b) => b.capital.monthlyLog.map(r => ({ month: r.month, value: logInOut(r) }));

// Masked rendering for the dashboard: keeps the figure's shape and separators
// so the tile doesn't reflow on reveal, without publishing the number.
export const maskMoney = (n) => fmtMoney(n).replace(/\d/g, "•");

export function dismissFlag(store, id) {
  const b = store.budget;
  if (!b.dismissedFlags.includes(id)) b.dismissedFlags.push(id);
  return saveStore(store);
}
