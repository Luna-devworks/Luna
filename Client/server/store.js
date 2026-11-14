/* Luna storage: one tiny key/value layer with two back-ends.
     - local file  (default)  -> <data dir>/luna-db.json
     - Supabase    (set SUPABASE_URL + SUPABASE_SERVICE_KEY) -> table public.luna_kv  (see supabase-setup.sql)
   The server keeps everything in memory while running and writes changes here a moment after they happen. */
'use strict';
const fs = require('fs'), path = require('path');

function createStore(o) {
  const dir = o.dir, useSb = !!(o.supabaseUrl && o.supabaseKey);
  const base = useSb ? String(o.supabaseUrl).replace(/\/+$/, '') : '';
  const dirty = new Map();               // key -> value (or null = delete)
  let timer = null, flushing = Promise.resolve(), mem = {}, fileDb = null;

  function sbHeaders(extra) {
    const h = Object.assign({ apikey: o.supabaseKey, 'Content-Type': 'application/json' }, extra || {});
    if (String(o.supabaseKey).startsWith('eyJ')) h.Authorization = 'Bearer ' + o.supabaseKey;   // legacy service_role JWT keys
    return h;
  }
  async function sb(method, pathq, body, extra) {
    const r = await fetch(base + '/rest/v1/' + pathq, { method, headers: sbHeaders(extra), body: body === undefined ? undefined : JSON.stringify(body) });
    if (!r.ok) { const t = await r.text().catch(() => ''); throw new Error('Supabase ' + r.status + ' ' + t.slice(0, 240)); }
    return method === 'GET' ? r.json() : null;
  }

  async function load() {
    if (useSb) {
      const out = {}; let off = 0;
      for (;;) {
        const page = await sb('GET', 'luna_kv?select=key,value&order=key&limit=500&offset=' + off);
        page.forEach(r => { out[r.key] = r.value; });
        if (page.length < 500) break; off += 500;
      }
      return out;
    }
    fs.mkdirSync(dir, { recursive: true });
    fileDb = path.join(dir, 'luna-db.json');
    try { mem = JSON.parse(fs.readFileSync(fileDb, 'utf8')); } catch (e) { mem = {}; }
    return JSON.parse(JSON.stringify(mem));
  }

  async function doFlush() {
    if (!dirty.size) return;
    const batch = [...dirty.entries()]; dirty.clear();
    if (!useSb) {
      batch.forEach(([k, v]) => { if (v === null) delete mem[k]; else mem[k] = v; });
      try { fs.writeFileSync(fileDb + '.tmp', JSON.stringify(mem)); fs.renameSync(fileDb + '.tmp', fileDb); }
      catch (e) { console.error('[store] save failed:', e.message); batch.forEach(([k, v]) => { if (!dirty.has(k)) dirty.set(k, v); }); schedule(5000); }
      return;
    }
    const ups = batch.filter(([k, v]) => v !== null), dels = batch.filter(([k, v]) => v === null).map(([k]) => k), done = new Set();
    try {
      for (let i = 0; i < ups.length; i += 40) {
        const chunk = ups.slice(i, i + 40);
        await sb('POST', 'luna_kv?on_conflict=key', chunk.map(([k, v]) => ({ key: k, value: v, updated_at: new Date().toISOString() })), { Prefer: 'resolution=merge-duplicates,return=minimal' });
        chunk.forEach(([k]) => done.add(k));
      }
      for (const k of dels) { await sb('DELETE', 'luna_kv?key=eq.' + encodeURIComponent(k)); done.add(k); }
    } catch (e) {
      console.error('[store] Supabase write failed (will retry):', e.message);
      batch.forEach(([k, v]) => { if (!done.has(k) && !dirty.has(k)) dirty.set(k, v); });
      schedule(8000);
    }
  }
  function schedule(ms) { if (timer) return; timer = setTimeout(() => { timer = null; flushing = flushing.then(doFlush, doFlush); }, ms); }
  function put(k, v) { dirty.set(k, v); schedule(400); }
  function del(k) { dirty.set(k, null); schedule(400); }
  async function flush() { if (timer) { clearTimeout(timer); timer = null; } flushing = flushing.then(doFlush, doFlush); await flushing; }

  return { load, put, del, flush, mode: useSb ? 'supabase' : 'file' };
}
module.exports = { createStore };
