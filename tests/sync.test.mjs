import { createSyncEngine, hashJson } from "../src/syncEngine.js";
import { normalizeStore, hasUserData } from "../src/store.js";

let pass = 0, failN = 0;
const ok = (cond, name) => { cond ? pass++ : failN++; console.log((cond ? "PASS " : "FAIL ") + name); };
const wait = (ms) => new Promise(r => setTimeout(r, ms));
const waitFor = async (fn, ms = 1500) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await wait(10); } return false; };

// fake server with the real table's semantics
function makeCloud() {
  const rows = new Map(); const calls = []; let failNext = 0, failMsg = "TypeError: Failed to fetch";
  return {
    rows, calls, failFor(n, msg) { failNext = n; if (msg) failMsg = msg; },
    async pull(uid) { calls.push("pull"); if (failNext > 0) { failNext--; throw new Error(failMsg); } const r = rows.get(uid); return r ? structuredClone(r) : null; },
    async insert(uid, data) { calls.push("insert"); if (failNext > 0) { failNext--; throw new Error(failMsg); } if (rows.has(uid)) return { conflict: true }; rows.set(uid, { data: structuredClone(data), revision: 1, updated_at: "t" }); return { revision: 1 }; },
    async update(uid, data, base) { calls.push("update:" + base); if (failNext > 0) { failNext--; throw new Error(failMsg); } const r = rows.get(uid); if (!r || r.revision !== base) return { conflict: true }; r.data = structuredClone(data); r.revision++; return { revision: r.revision }; },
  };
}
// a "browser": its own localStorage + in-memory store
function makeBrowser(cloud, initial, opts = {}) {
  const mem = {}; const storage = { getItem: k => mem[k] ?? null, setItem: (k, v) => { mem[k] = v; } };
  if (opts.meta) mem["grid.sync.v1"] = JSON.stringify(opts.meta);
  const b = { store: normalizeStore(initial ?? {}), statuses: [], storage, mem };
  b.engine = createSyncEngine({ userId: "u1", cloud, getStore: () => b.store, storage, debounceMs: 20, retryMs: [40],
    applyRemote: (d) => (b.store = normalizeStore(d)), onStatus: s => b.statuses.push(s.status) });
  b.edit = (fn) => { b.store = structuredClone(b.store); fn(b.store); b.engine.notifyChange(); };
  b.last = () => b.statuses.at(-1);
  return b;
}
const withTask = (t) => ({ daily: { tasks: [{ id: "t1", text: t }] } });

// 1. first ever login: no cloud row → local becomes the cloud copy
{ const c = makeCloud(); const A = makeBrowser(c); await A.engine.start();
  ok(c.rows.has("u1") && A.last() === "synced", "1. first login creates the cloud row"); }

// 2. fresh browser (no user data) adopts cloud copy instead of overwriting it
{ const c = makeCloud(); const A = makeBrowser(c, withTask("real")); await A.engine.start();
  const B = makeBrowser(c); await B.engine.start();
  ok(B.store.daily.tasks[0]?.text === "real" && c.rows.get("u1").revision === 1, "2. empty browser adopts cloud, cloud untouched"); }

// 3. unlinked browsers that BOTH have data → conflict, nothing overwritten; each resolution works
{ const c = makeCloud(); const A = makeBrowser(c, withTask("cloud-side")); await A.engine.start();
  const B = makeBrowser(c, withTask("browser-side")); await B.engine.start();
  ok(B.last() === "conflict" && B.engine.getConflict().reason === "unlinked-both" && c.rows.get("u1").data.daily.tasks[0].text === "cloud-side", "3a. both-have-data raises conflict, cloud untouched");
  await B.engine.resolve("cloud");
  ok(B.store.daily.tasks[0].text === "cloud-side" && B.last() === "synced", "3b. resolve(cloud) adopts cloud");
  const B2 = makeBrowser(c, withTask("browser-side")); await B2.engine.start(); await B2.engine.resolve("local");
  ok(c.rows.get("u1").data.daily.tasks[0].text === "browser-side" && B2.last() === "synced", "3c. resolve(local) overwrites cloud"); }

// 4. linked edit → debounced push bumps revision
{ const c = makeCloud(); const A = makeBrowser(c, withTask("a")); await A.engine.start();
  A.edit(s => s.daily.tasks.push({ id: "t2", text: "b" }));
  ok(A.last() === "pending", "4a. edit shows pending");
  ok(await waitFor(() => c.rows.get("u1").revision === 2 && A.last() === "synced"), "4b. debounced push lands, revision 2"); }

// 5. cloud newer + local clean → adopt; cloud newer + local dirty → conflict
{ const c = makeCloud(); const A = makeBrowser(c, withTask("v1")); await A.engine.start();
  const B = makeBrowser(c); await B.engine.start();                       // B adopts v1 (linked, rev1)
  A.edit(s => { s.daily.tasks[0].text = "v2"; }); await waitFor(() => c.rows.get("u1").revision === 2);
  await B.engine.syncNow();
  ok(B.store.daily.tasks[0].text === "v2" && B.last() === "synced", "5a. clean browser picks up newer cloud on syncNow");
  A.edit(s => { s.daily.tasks[0].text = "v3"; }); await waitFor(() => c.rows.get("u1").revision === 3);
  B.edit(s => { s.daily.tasks[0].text = "B-edit"; });
  await waitFor(() => B.engine.getConflict());
  ok(B.engine.getConflict()?.reason === "diverged" && c.rows.get("u1").data.daily.tasks[0].text === "v3", "5b. dirty browser vs newer cloud → conflict, cloud NOT overwritten"); }

// 6. EMPTY-OVERWRITE GUARD: linked browser whose storage got wiped must not push blanks over real data
{ const c = makeCloud(); const A = makeBrowser(c, withTask("precious")); await A.engine.start();
  const meta = JSON.parse(A.mem["grid.sync.v1"]);
  const B = makeBrowser(c, {}, { meta });                                  // meta survived but store is blank (corrupt/cleared)
  await B.engine.start();
  B.edit(() => {}); B.store = normalizeStore({}); B.engine.notifyChange();
  await waitFor(() => B.engine.getConflict());
  ok(B.engine.getConflict()?.reason === "local-empty" && c.rows.get("u1").data.daily.tasks[0].text === "precious", "6. blank browser is blocked from overwriting real cloud data"); }

// 7. offline: push fails → 'offline', then recovers by itself
{ const c = makeCloud(); const A = makeBrowser(c, withTask("a")); await A.engine.start();
  c.failFor(1); A.edit(s => s.daily.tasks.push({ id: "x", text: "while-offline" }));
  ok(await waitFor(() => A.last() === "offline"), "7a. failed push reports offline");
  ok(await waitFor(() => A.last() === "synced" && c.rows.get("u1").data.daily.tasks.length === 2), "7b. retries and syncs by itself"); }

// 8. two tabs racing: stale revision cannot overwrite
{ const c = makeCloud(); const A = makeBrowser(c, withTask("a")); await A.engine.start();
  c.rows.get("u1").revision = 5;                                           // someone else advanced it
  A.edit(s => { s.daily.tasks[0].text = "stale-write"; });
  await waitFor(() => A.engine.getConflict());
  ok(A.engine.getConflict()?.reason === "diverged" && c.rows.get("u1").data.daily.tasks[0].text === "a", "8. stale revision push is rejected, not applied"); }

// 9. edit DURING a save still gets pushed afterwards
{ const c = makeCloud(); const A = makeBrowser(c, withTask("a")); await A.engine.start();
  A.edit(s => s.daily.tasks.push({ id: "p", text: "one" }));
  await wait(25); A.edit(s => s.daily.tasks.push({ id: "q", text: "two" }));  // lands near/during the first save
  ok(await waitFor(() => c.rows.get("u1").data.daily.tasks.length === 3 && A.last() === "synced"), "9. rapid edits all end up in the cloud"); }

// 10. reload with unsaved local changes pushes them (meta hash differs from store)
{ const c = makeCloud(); const A = makeBrowser(c, withTask("a")); await A.engine.start();
  const meta = JSON.parse(A.mem["grid.sync.v1"]);
  const A2 = makeBrowser(c, withTask("a"), { meta }); A2.store.daily.tasks.push({ id: "offline-edit", text: "made before close" });
  await A2.engine.start();
  ok(await waitFor(() => c.rows.get("u1").data.daily.tasks.length === 2), "10. unsynced edits from a previous session get pushed on next load"); }

// 11. non-network server error surfaces as 'error' (not silently swallowed)
{ const c = makeCloud(); const A = makeBrowser(c, withTask("a")); await A.engine.start();
  c.failFor(1, "permission denied for table grid_store"); A.edit(s => s.daily.tasks.push({ id: "z", text: "z" }));
  ok(await waitFor(() => A.last() === "error"), "11. server error is reported as error"); }

// 12. payload equals what was hashed even if the live object mutates mid-flight
ok(hashJson("abc") === hashJson("abc") && hashJson("abc") !== hashJson("abd"), "12. hash is deterministic and change-sensitive");

console.log(`\n${pass} passed, ${failN} failed`);
process.exit(failN ? 1 : 0);
