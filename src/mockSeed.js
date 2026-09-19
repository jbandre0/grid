// THE GRID — Budget mock seed · PLACEHOLDER DATA ONLY
//
// Phase 0 convention: this is fake data for looking at the system, not real
// figures. Every seeded record carries `mock: true` so the UI can label it at
// a glance and so replacing a record with real data drops the label naturally
// — no bulk "clear fake data" action needed, per the per-sector manual
// replacement plan.
//
// Structural choices worth stating plainly:
//   · Owe Ledger people are deliberately generic ("Person A/B/C") — real names
//     were not supplied and are not invented here.
//   · Assets use "Stocks" (named in the Budget spec's portfolio-integration
//     note) plus one generic durable asset. Rename when real ones are known.
//   · Category NAMES are real (supplied by the user); every amount is fake.
//
// Seeded edge cases (so alert states are visible, not just clean numbers):
//   · Owe Ledger — one overdue in EACH direction, still Open → alarm flags
//   · Capital monthly log — one month with a negative In/Out
//   · Net Worth log — one month with a negative In/Out
//   · One Paid ledger row, to confirm Paid does NOT flag even when past due
//   · Categories — two in the 75–100% caution band, one past 100% (alarm),
//     and four comfortably under, so all three meter states are visible

export const MOCK_SEED_VERSION = "mock-v2";

const mock = (o) => ({ ...o, mock: true });

export const MOCK_BUDGET = {
  capital: {
    accounts: [
      mock({ id: "cash", name: "Cash", value: 340.18 }),
      mock({ id: "bank", name: "Bank", value: 2145.67 }),
    ],
    monthlyLog: [
      mock({ month: "2026-04", start: 1800.00, end: 2210.40, notes: "placeholder" }),
      mock({ month: "2026-05", start: 2210.40, end: 1980.12, notes: "placeholder · down month" }),
      mock({ month: "2026-06", start: 1980.12, end: 2480.55, notes: "placeholder" }),
      mock({ month: "2026-07", start: 2480.55, end: 2485.85, notes: "placeholder" }),
    ],
  },
  assets: [
    mock({ id: "a-stocks", name: "Stocks", value: 3200.00 }),
    mock({ id: "a-vehicle", name: "Vehicle", value: 4100.00 }),
  ],
  oweLedger: [
    // overdue · I owe → alarm
    mock({ id: "o-1", direction: "iowe", person: "Person A", amount: 240.00, reason: "placeholder", due: "2026-07-15", status: "open" }),
    // overdue · owed to me → alarm
    mock({ id: "o-2", direction: "owedme", person: "Person B", amount: 150.00, reason: "placeholder", due: "2026-06-10", status: "open" }),
    // open but not yet due → no flag
    mock({ id: "o-3", direction: "owedme", person: "Person C", amount: 85.00, reason: "placeholder", due: "2026-08-20", status: "open" }),
    // past due but PAID → must not flag
    mock({ id: "o-4", direction: "iowe", person: "Person A", amount: 60.00, reason: "placeholder", due: "2026-07-30", status: "paid" }),
  ],
  // real category names, fake amounts. States: ok < 75% · warn 75–100% · over > 100%
  categories: [
    mock({ id: "c-home",    name: "Home (Rent etc)",  budgeted: 1000.00, spent: 950.00 }),  // 95%  → warn
    mock({ id: "c-food",    name: "Food & Dining",    budgeted: 450.00,  spent: 371.25 }),  // 82%  → warn
    mock({ id: "c-shopping",name: "Shopping",         budgeted: 120.00,  spent: 168.40 }),  // 140% → over
    mock({ id: "c-tithing", name: "Tithing",          budgeted: 300.00,  spent: 180.00 }),  // 60%  → ok
    mock({ id: "c-auto",    name: "Auto & Transport", budgeted: 200.00,  spent: 96.40 }),   // 48%  → ok
    mock({ id: "c-fun",     name: "Entertainment",    budgeted: 100.00,  spent: 42.00 }),   // 42%  → ok
    mock({ id: "c-edu",     name: "Education",        budgeted: 250.00,  spent: 75.00 }),   // 30%  → ok
  ],
  spendEntries: [],
  netWorthLog: [
    mock({ month: "2026-04", start: 5200.00, end: 5980.30, notes: "placeholder" }),
    mock({ month: "2026-05", start: 5980.30, end: 5430.75, notes: "placeholder · down month" }),
    mock({ month: "2026-06", start: 5430.75, end: 6120.10, notes: "placeholder" }),
    mock({ month: "2026-07", start: 6120.10, end: 6890.45, notes: "placeholder" }),
  ],
};

// True once ANY record has lost its `mock: true` marker — i.e. the user has
// started replacing placeholders with real figures. Guards the re-seed below.
function hasRealData(b) {
  const records = [
    ...b.capital.accounts, ...b.capital.monthlyLog, ...b.assets,
    ...b.oweLedger, ...b.categories, ...b.netWorthLog,
  ];
  return records.some(r => !r.mock);
}

// Applies the mock set. Re-applies when the seed version changes (so an
// updated placeholder set lands during Phase 0 review), but bails the moment
// the store holds anything real — replacement is manual and per-sector, and
// this must never overwrite a confirmed figure.
export function seedMockBudget(store) {
  const b = store.budget;
  if (b.seeded === MOCK_SEED_VERSION) return store;
  if (b.seeded && hasRealData(b)) return store;
  Object.assign(b, structuredClone(MOCK_BUDGET), { seeded: MOCK_SEED_VERSION });
  return store;
}
