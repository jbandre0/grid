// Budget logic tests — pure functions from src/store.js, no browser needed.
// Run: npm run test:budget
import {
  normalizeStore, logSpend, undoSpend, removeCategory, monthEntries,
  pendingCloseOut, closeOutPreview, closeOutMonth, deriveFlags, netWorth, categoryState,
} from "../src/store.js";

let passed = 0, failed = 0;
const test = (name, fn) => {
  try { fn(); passed++; console.log("PASS", name); }
  catch (e) { failed++; console.log("FAIL", name, "\n   ", e.message); }
};
const eq = (a, b, msg = "") => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); };

const blank = () => normalizeStore({}).budget;
const withCats = () => {
  const b = blank();
  b.categories = [{ id: "food", name: "Food", budgeted: 200, spent: 0 }, { id: "fun", name: "Fun", budgeted: 100, spent: 0 }];
  return b;
};
const SEP = new Date(2026, 8, 19, 12), OCT = new Date(2026, 9, 2, 9), NOV = new Date(2026, 10, 3, 9);

test("placeholder (mock) records are stripped on load; real ones survive", () => {
  const m = (o) => ({ ...o, mock: true });
  const b = normalizeStore({ budget: {
    capital: { accounts: [m({ id: "cash", name: "Cash", value: 5 })], monthlyLog: [m({ month: "2026-07", start: 1, end: 2 })] },
    assets: [m({ id: "a", name: "S", value: 9 }), { id: "real", name: "Mine", value: 1 }],
    categories: [m({ id: "c", name: "X", budgeted: 1, spent: 1 })], netWorthLog: [m({ month: "2026-07", start: 1, end: 2 })],
    oweLedger: [m({ id: "o" })], seeded: "mock-v2",
  } }).budget;
  eq(b.assets.map(a => a.id), ["real"]);
  eq(b.categories.length, 0); eq(b.oweLedger.length, 0); eq(b.netWorthLog.length, 0); eq(b.capital.monthlyLog.length, 0);
  eq(b.capital.accounts.map(a => [a.id, a.value]), [["cash", 0], ["bank", 0]], "default accounts restored at 0");
  eq(b.seeded, null);
});

test("logSpend adds an entry and moves spent together", () => {
  const b = logSpend(withCats(), "food", 12.34, " lunch ", SEP);
  eq(b.categories[0].spent, 12.34); eq(b.spendEntries.length, 1);
  eq([b.spendEntries[0].amount, b.spendEntries[0].note, b.spendEntries[0].categoryId], [12.34, "lunch", "food"]);
});
test("logSpend rounds to cents and ignores bad input", () => {
  let b = logSpend(withCats(), "food", 0.1, "", SEP); b = logSpend(b, "food", 0.2, "", SEP);
  eq(b.categories[0].spent, 0.3, "0.1+0.2");
  const same = logSpend(b, "food", 0, "", SEP); eq(same, b); eq(logSpend(b, "food", -5), b); eq(logSpend(b, "nope", 5), b);
});
test("undoSpend reverses exactly that entry and clamps at zero", () => {
  let b = logSpend(withCats(), "food", 60, "a", SEP); b = logSpend(b, "food", 100, "b", SEP);
  b = undoSpend(b, b.spendEntries[1].id);
  eq(b.categories[0].spent, 60); eq(b.spendEntries.length, 1);
  b.categories[0].spent = 10; // corrected downward by hand
  b = undoSpend(b, b.spendEntries[0].id); eq(b.categories[0].spent, 0, "never negative");
});
test("opening figure + entries stay consistent (entries adjust relatively)", () => {
  const b0 = withCats(); b0.categories[0].spent = 50;            // "already spent so far"
  let b = logSpend(b0, "food", 25, "", SEP); eq(b.categories[0].spent, 75);
  b = undoSpend(b, b.spendEntries[0].id); eq(b.categories[0].spent, 50);
});
test("removeCategory drops its entries but keeps others'", () => {
  let b = logSpend(withCats(), "food", 5, "", SEP); b = logSpend(b, "fun", 7, "", SEP);
  b = removeCategory(b, "food");
  eq(b.categories.map(c => c.id), ["fun"]); eq(b.spendEntries.map(e => e.categoryId), ["fun"]);
});
test("monthEntries: this month only, newest first", () => {
  let b = logSpend(withCats(), "food", 1, "old", new Date(2026, 7, 30, 12));
  b = logSpend(b, "food", 2, "a", SEP); b = logSpend(b, "food", 3, "b", SEP);
  eq(monthEntries(b, "food", SEP).map(e => e.note), ["b", "a"]);
});

test("no close-out pending in the same month, or before tracking starts", () => {
  const b = withCats(); eq(pendingCloseOut(b, SEP), null, "untracked");
  b.lastSeenMonth = "2026-09"; eq(pendingCloseOut(b, SEP), null, "same month");
  eq(closeOutMonth(b, {}, SEP), b, "no-op returns same object");
});
test("close-out pending once the calendar month moves on", () => {
  const b = withCats(); b.lastSeenMonth = "2026-09"; eq(pendingCloseOut(b, OCT), "2026-09");
});
test("first close-out snapshots current figures, opening start is honoured", () => {
  const b = withCats(); b.lastSeenMonth = "2026-09";
  b.capital.accounts = [{ id: "cash", name: "Cash", value: 1500 }];
  b.assets = [{ id: "a", name: "Car", value: 4000 }];
  b.oweLedger = [{ id: "o1", direction: "owedme", person: "P", amount: 100, due: "", status: "open" },
                 { id: "o2", direction: "iowe", person: "Q", amount: 40, due: "", status: "open" },
                 { id: "o3", direction: "iowe", person: "R", amount: 999, due: "", status: "paid" }];
  eq(netWorth(b), 1500 + 4000 + 100 - 40);
  const p = closeOutPreview(b, { capitalStart: 1000, netWorthStart: 5000 }, OCT);
  eq([p.month, p.capStart, p.capEnd, p.nwStart, p.nwEnd, p.firstCapital], ["2026-09", 1000, 1500, 5000, 5560, true]);
  const c = closeOutMonth(b, { capitalStart: 1000, netWorthStart: 5000 }, OCT);
  eq(c.capital.monthlyLog, [{ month: "2026-09", start: 1000, end: 1500, notes: "" }]);
  eq(c.netWorthLog, [{ month: "2026-09", start: 5000, end: 5560, notes: "" }]);
  eq(c.lastSeenMonth, "2026-10"); eq(pendingCloseOut(c, OCT), null, "cleared after close");
});
test("later close-outs start from the previous row's end", () => {
  let b = withCats(); b.lastSeenMonth = "2026-09"; b.capital.accounts = [{ id: "cash", name: "Cash", value: 1500 }];
  b = closeOutMonth(b, {}, OCT);
  b.capital.accounts[0].value = 1800;
  b = closeOutMonth(b, {}, NOV);
  eq(b.capital.monthlyLog.map(r => [r.month, r.start, r.end]), [["2026-09", 1500, 1500], ["2026-10", 1500, 1800]]);
});
test("close-out resets spent, keeps budgets and entries, flags overspend in the recap", () => {
  let b = withCats(); b.lastSeenMonth = "2026-09";
  b = logSpend(b, "food", 250, "big", SEP); b = logSpend(b, "fun", 10, "", SEP);
  const c = closeOutMonth(b, {}, OCT);
  eq(c.categories.map(x => [x.spent, x.budgeted]), [[0, 200], [0, 100]]);
  eq(c.spendEntries.length, 2, "history kept");
  eq(c.lastCloseOut.over, ["Food"]);
});
test("a multi-month gap logs only the last tracked month, never two rows for one month", () => {
  let b = withCats(); b.lastSeenMonth = "2026-07";
  b = closeOutMonth(b, {}, NOV);
  eq(b.capital.monthlyLog.map(r => r.month), ["2026-07"]); eq(b.lastSeenMonth, "2026-11");
  b.lastSeenMonth = "2026-07"; b = closeOutMonth(b, {}, NOV);
  eq(b.capital.monthlyLog.map(r => r.month), ["2026-07"], "replaced, not duplicated");
});
test("recap flag: shown in the month it was closed, dismissable id, gone next month", () => {
  let b = withCats(); b.lastSeenMonth = "2026-09"; b = closeOutMonth(b, {}, OCT);
  const f = deriveFlags(b, OCT).find(x => x.type === "month-recap");
  eq([f.id, f.severity], ["recap-2026-09", "attentive"]);
  eq(deriveFlags(b, NOV).some(x => x.type === "month-recap"), false);
});
test("categories at or past budget read as over; unbudgeted never flag", () => {
  eq(categoryState({ budgeted: 100, spent: 100 }), "over"); eq(categoryState({ budgeted: 0, spent: 500 }), "ok");
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
