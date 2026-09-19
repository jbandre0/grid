// THE GRID — cloud sync engine. Framework-free (no React, no Supabase import) so
// it can be tested with a fake `cloud`. See src/cloud.js for the real adapter and
// docs/supabase/schema.sql for the table.
//
// MODEL: local-first. localStorage stays the working copy; the cloud row is the
// durable copy. Each push is an optimistic-concurrency update ("only if the cloud
// revision is still the one I last saw"), so a stale browser can never silently
// overwrite newer data. Three refusals protect against data loss:
//   1. unlinked browser with real data + cloud with real data  → ask (never guess)
//   2. both sides changed since the last sync                  → ask
//   3. this browser looks EMPTY but the cloud copy has data     → ask (cleared/corrupt storage)
// A fresh browser with no user data simply adopts the cloud copy. The server also
// keeps a daily snapshot of the previous copy (grid_store_history) as a last resort.
import { hasUserData } from "./store.js";

const META_KEY = "grid.sync.v1";

// FNV-1a over the JSON text + length — cheap change detector, not security.
export function hashJson(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return str.length + ":" + (h >>> 0).toString(16);
}

const looksOffline = (e) => (typeof navigator !== "undefined" && navigator.onLine === false)
  || /failed to fetch|networkerror|network request failed|load failed/i.test(String(e?.message ?? e));

export function createSyncEngine({
  userId, cloud, getStore, applyRemote, onStatus,
  storage = globalThis.localStorage,
  debounceMs = 2500, retryMs = [5000, 15000, 30000, 60000], now = () => Date.now(),
}) {
  let meta = null;
  try { meta = JSON.parse(storage.getItem(META_KEY)); } catch { meta = null; }
  let ready = false, disposed = false, busy = false, again = false;
  let timer = null, retryTimer = null, retryIdx = 0;
  let conflict = null, lastStatus = null;

  const writeMeta = () => { try { storage.setItem(META_KEY, JSON.stringify(meta)); } catch { /* quota: non-fatal, next load re-reconciles */ } };
  const isLinked = () => !!meta && meta.userId === userId && meta.revision != null;
  const localJson = () => JSON.stringify(getStore());
  const locallyChanged = () => !isLinked() || hashJson(localJson()) !== meta.hash;

  const emit = (status, extra = {}) => {
    lastStatus = status;
    onStatus?.({ status, syncedAt: meta?.syncedAt ?? null, conflict, ...extra });
  };
  const schedule = (ms) => { clearTimeout(timer); timer = setTimeout(() => { flush(); }, ms); };

  function fail(e) {
    if (disposed) return;
    const offline = looksOffline(e);
    emit(offline ? "offline" : "error", { error: String(e?.message ?? e) });
    clearTimeout(retryTimer);
    const wait = retryMs[Math.min(retryIdx++, retryMs.length - 1)];
    retryTimer = setTimeout(() => { ready ? flush() : reconcile(); }, wait);
  }

  function remember(revision, storeObj, remoteData) {
    meta = { userId, revision, hash: hashJson(JSON.stringify(storeObj)), remoteHadData: hasUserData(remoteData ?? storeObj), syncedAt: now() };
    writeMeta();
    retryIdx = 0;
  }

  function adopt(remote) {
    const applied = applyRemote(remote.data);
    remember(remote.revision, applied ?? getStore(), remote.data);
    conflict = null;
    emit("synced");
  }

  function raise(reason, remote) {
    conflict = { reason, remote };
    clearTimeout(timer);
    emit("conflict");
  }

  // one low-level write; returns true if it landed
  async function write(base) {
    const json = localJson();
    const data = JSON.parse(json); // payload is exactly what we hashed, even if the live object mutates
    const res = base == null ? await cloud.insert(userId, data) : await cloud.update(userId, data, base);
    if (disposed) return false;
    if (res.conflict) return false;
    meta = { userId, revision: res.revision, hash: hashJson(json), remoteHadData: hasUserData(data), syncedAt: now() };
    writeMeta();
    retryIdx = 0;
    return true;
  }

  async function push(base) {
    if (busy) { again = true; return; }
    busy = true; emit("saving");
    try {
      const ok = await write(base === undefined ? (isLinked() ? meta.revision : null) : base);
      if (disposed) return;
      if (!ok) {
        // someone else moved the revision (or the row appeared/vanished): show both sides, never overwrite
        const remote = await cloud.pull(userId);
        if (disposed) return;
        if (!remote) { busy = false; return push(null); }
        raise("diverged", remote);
      } else if (locallyChanged()) again = true; // edited while saving
      else emit("synced");
    } catch (e) { fail(e); }
    finally { busy = false; if (again && !disposed && !conflict) { again = false; schedule(0); } }
  }

  async function flush() {
    if (!ready || disposed || conflict) return;
    if (!isLinked()) return reconcile();
    if (!locallyChanged()) { emit("synced"); return; }
    if (meta.remoteHadData && !hasUserData(getStore())) {
      try { const remote = await cloud.pull(userId); if (!disposed && remote) raise("local-empty", remote); else if (!disposed) await push(); }
      catch (e) { fail(e); }
      return;
    }
    await push();
  }

  async function reconcile() {
    if (disposed || busy) { if (busy) again = true; return; }
    clearTimeout(retryTimer);
    emit("checking");
    let remote;
    try { remote = await cloud.pull(userId); } catch (e) { return fail(e); }
    if (disposed) return;
    const local = getStore();
    const lHas = hasUserData(local);

    if (!remote) { ready = true; return push(null); }              // first ever sync: this becomes the cloud copy
    const rHas = hasUserData(remote.data);

    if (!isLinked()) {
      ready = true;
      if (!lHas) return adopt(remote);                             // fresh browser: take the cloud copy
      if (!rHas) return push(remote.revision);                     // cloud is blank, browser has data: upload it
      return raise("unlinked-both", remote);                       // both have data, never linked: ask
    }
    ready = true;
    if (remote.revision === meta.revision) {
      if (!locallyChanged()) return emit("synced");
      return flush();
    }
    if (remote.revision > meta.revision) {
      if (!locallyChanged()) return adopt(remote);                 // cloud moved on, nothing local to lose
      return raise("diverged", remote);
    }
    return raise("remote-older", remote);                          // cloud is BEHIND what we last synced: don't trust either blindly
  }

  return {
    async start() { await reconcile(); if (ready && !conflict && !disposed) this.notifyChange(); },
    notifyChange() {
      if (!ready || disposed || conflict) return;
      if (!locallyChanged()) { if (lastStatus !== "synced") emit("synced"); return; }
      if (lastStatus !== "pending" && lastStatus !== "saving") emit("pending");
      schedule(debounceMs);
    },
    syncNow() { return conflict ? undefined : reconcile(); },
    async flushNow() { clearTimeout(timer); if (ready && !conflict) await flush(); return lastStatus; },
    async resolve(choice) {
      if (!conflict) return;
      const { remote } = conflict; conflict = null;
      if (choice === "cloud") return adopt(remote);
      return push(remote ? remote.revision : null);                // "local": overwrite cloud, but only if it hasn't moved again
    },
    getConflict: () => conflict,
    dispose() { disposed = true; clearTimeout(timer); clearTimeout(retryTimer); },
  };
}
