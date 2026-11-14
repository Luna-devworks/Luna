/* Luna Server: accounts, Moon Dust economy, shop + limited marketplace, games, profiles, multiplayer rooms, chat.
   Needs only Node 18+ (no npm packages).   node server.js [--port 8080] [--admin Name] [--owner Name]
   Environment (for Render etc.):  PORT, LUNA_OWNER, LUNA_OWNER_CODE, LUNA_ADMINS, LUNA_NAME,
                                   SUPABASE_URL, SUPABASE_SERVICE_KEY, LUNA_DATA_DIR                                  */
'use strict';
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto'), os = require('os');
const Data = require('./luna-data.js');
let Filter; try { Filter = require('./luna-filter.js'); } catch (e) { Filter = { filter: t => t }; }
const { createStore } = require('./store.js');

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.ico': 'image/x-icon', '.jpg': 'image/jpeg', '.txt': 'text/plain', '.webmanifest': 'application/manifest+json', '.exe': 'application/octet-stream' };
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const rid = n => crypto.randomBytes(n).toString('hex');
const now = () => Date.now();
const safeEq = (a, b) => { const x = Buffer.from(sha(a)), y = Buffer.from(sha(b)); return crypto.timingSafeEqual(x, y); };
const hashPw = (pw, salt) => new Promise((res, rej) => crypto.scrypt(pw, salt, 32, (e, k) => e ? rej(e) : res(k.toString('hex'))));
const readJSON = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return d; } };
function lanAddresses() {
  const out = [];
  Object.values(os.networkInterfaces()).forEach(l => (l || []).forEach(i => { if (i.family === 'IPv4' && !i.internal) out.push(i.address); }));
  return out;
}
function frame(op, payload) {
  const len = payload.length; let h;
  if (len < 126) h = Buffer.from([0x80 | op, len]);
  else if (len < 65536) { h = Buffer.alloc(4); h[0] = 0x80 | op; h[1] = 126; h.writeUInt16BE(len, 2); }
  else { h = Buffer.alloc(10); h[0] = 0x80 | op; h[1] = 127; h.writeUInt32BE(0, 2); h.writeUInt32BE(len, 6); }
  return Buffer.concat([h, payload]);
}

async function start(opts) {
  opts = opts || {};
  const env = process.env, port = opts.port || parseInt(env.PORT, 10) || 8080;
  const dataDir = opts.dataDir || env.LUNA_DATA_DIR || path.join(process.cwd(), 'luna-data');
  const store = createStore({ dir: dataDir, supabaseUrl: opts.supabaseUrl || env.SUPABASE_URL, supabaseKey: opts.supabaseKey || env.SUPABASE_SERVICE_KEY });
  const rows = await store.load();

  /* ---------- in-memory database ---------- */
  const users = {}, games = {}, items = {};
  let cfg = Object.assign({ name: 'Luna', admins: [], maxPlayers: 50, ownerName: '', seeded: [] }, rows.cfg || {});
  Object.keys(rows).forEach(k => {
    if (k.startsWith('u:')) users[k.slice(2)] = rows[k]; else if (k.startsWith('g:')) games[k.slice(2)] = rows[k]; else if (k.startsWith('i:')) items[k.slice(2)] = rows[k];
  });
  const P = { u: u => store.put('u:' + u.ln, u), g: g => store.put('g:' + g.id, g), i: i => store.put('i:' + i.id, i), cfg: () => store.put('cfg', cfg) };

  /* upgrade data written by the older single-world Luna (v0.1) */
  if (!rows.cfg && Object.keys(users).length === 0) {
    const old = readJSON(path.join(dataDir, 'users.json'), null);
    if (old && old.users) {
      Object.keys(old.users).forEach(ln => { users[ln] = old.users[ln]; });
      const oc = readJSON(path.join(dataDir, 'config.json'), {}); if (oc.admins) cfg.admins = oc.admins; if (oc.name) cfg.name = oc.name;
      const op = readJSON(path.join(dataDir, 'place.json'), null);
      if (op) games.hub = { id: 'hub', ownerLn: '', title: 'Luna Hub', desc: 'The social space of Luna.', genre: 'Hangout', maxPlayers: 50, status: 'public', place: Data.cleanPlace(op), thumb: '', plays: 0, likes: [], created: now(), updated: now() };
      console.log('[luna] imported ' + Object.keys(users).length + ' account(s) from the old version');
    }
  }
  function normUser(u, ln) {
    u.ln = ln; u.name = u.name || ln; u.avatar = Data.cleanAvatar(u.avatar, false);
    if (typeof u.dust !== 'number') u.dust = Data.START_DUST;
    u.inv = Array.isArray(u.inv) ? u.inv : []; u.tokens = u.tokens && typeof u.tokens === 'object' ? u.tokens : {}; u.log = Array.isArray(u.log) ? u.log : [];
    u.bio = u.bio || ''; u.nextClaim = u.nextClaim || 0; u.streak = u.streak || 0; u.lastSeen = u.lastSeen || 0; u.created = u.created || now();
    delete u.sessions; return u;
  }
  Object.keys(users).forEach(ln => normUser(users[ln], ln));

  if (env.LUNA_NAME || opts.name) cfg.name = env.LUNA_NAME || opts.name;
  if (env.LUNA_OWNER || opts.owner) cfg.ownerName = env.LUNA_OWNER || opts.owner;
  const ownerCode = env.LUNA_OWNER_CODE || opts.ownerCode || '';
  String(env.LUNA_ADMINS || '').split(',').concat(opts.admins || []).map(s => s.trim()).filter(Boolean).forEach(a => { if (!cfg.admins.some(x => x.toLowerCase() === a.toLowerCase())) cfg.admins.push(a); });
  /* an account named in config as owner becomes owner (covers old accounts too) */
  if (cfg.ownerName && users[cfg.ownerName.toLowerCase()]) { const ou = users[cfg.ownerName.toLowerCase()]; if (!ou.owner) { ou.owner = true; ou.admin = true; P.u(ou); } }
  else if (!cfg.ownerName) { const us = Object.values(users); if (us.length && !us.some(x => x.owner)) { us.sort((a, b) => a.created - b.created)[0].owner = true; us[0].admin = true; P.u(us[0]); } }

  /* seed the shop (once per item; after that the owner controls everything) */
  Data.SEED_ITEMS.forEach(s => {
    if (!cfg.seeded.includes(s.id)) {
      cfg.seeded.push(s.id);
      if (!items[s.id]) { items[s.id] = Object.assign(JSON.parse(JSON.stringify(s)), { sold: 0, creatorLn: '' }); P.i(items[s.id]); }
    }
  });
  if (!games.hub) games.hub = { id: 'hub', ownerLn: '', title: 'Luna Hub', desc: 'The social space of Luna. Hang out, chat and show off your style.', genre: 'Hangout', maxPlayers: 50, status: 'public', place: Data.defaultPlace(), thumb: '', plays: 0, likes: [], created: now(), updated: now() };
  Object.values(games).forEach(g => { g.likes = g.likes || []; g.plays = g.plays || 0; g.place = Data.cleanPlace(g.place); P.g(g); });
  P.cfg();

  /* ---------- indexes ---------- */
  const tokenIdx = new Map(), listings = new Map();   // listings: itemId -> Map(uid -> {uid, ln, price, serial})
  function indexUser(u) {
    Object.keys(u.tokens).forEach(h => tokenIdx.set(h, u.ln));
    u.inv.forEach(e => { if (e.listed > 0) addListing(e, u.ln); });
  }
  function addListing(e, ln) { if (!listings.has(e.item)) listings.set(e.item, new Map()); listings.get(e.item).set(e.uid, { uid: e.uid, ln, price: e.listed, serial: e.serial }); }
  function dropListing(e) { const m = listings.get(e.item); if (m) m.delete(e.uid); }
  Object.values(users).forEach(indexUser);

  const isCfgAdmin = n => cfg.admins.some(a => a.toLowerCase() === n.toLowerCase());
  const ownerUser = () => Object.values(users).find(u => u.owner) || null;
  const ownerName = () => { const o = ownerUser(); return o ? o.name : (cfg.ownerName || 'Luna'); };
  const creatorName = it => (it.creatorLn && users[it.creatorLn]) ? users[it.creatorLn].name : ownerName();

  /* ---------- output shapes ---------- */
  function itemOut(it, me) {
    const rem = it.stock == null ? null : Math.max(0, it.stock - it.sold);
    let lowest = null; const ls = listings.get(it.id); if (ls) ls.forEach(l => { if (lowest === null || l.price < lowest) lowest = l.price; });
    return {
      id: it.id, name: it.name, desc: it.desc, slot: it.slot, kind: it.kind, price: it.price, stock: it.stock, sold: it.sold, remaining: rem,
      canBuy: !!it.onSale && rem !== 0, offSale: !it.onSale, soldOut: rem === 0, creator: creatorName(it), created: it.created, data: it.data, lowest,
      owned: me ? me.inv.filter(e => e.item === it.id).length : 0
    };
  }
  function defsFor(av) {
    const d = {}; Data.SLOTS.forEach(s => { const id = av.eq[s], it = id && items[id]; if (it) d[id] = { id, name: it.name, slot: it.slot, data: it.data, kind: it.kind }; }); return d;
  }
  const avatarOut = u => Object.assign({}, u.avatar, { defs: defsFor(u.avatar) });
  const pub = u => ({ name: u.name, avatar: avatarOut(u), admin: !!u.admin, owner: !!u.owner });
  const selfOut = u => Object.assign(pub(u), { dust: u.dust, nextClaim: u.nextClaim, streak: u.streak, bio: u.bio, created: u.created });
  function sanitizeAvatar(u, raw) {
    const av = Data.cleanAvatar(raw, false);
    Data.SLOTS.forEach(s => { const id = av.eq[s]; if (!id) return; const it = items[id]; if (!it || it.slot !== s || !u.inv.some(e => e.item === id && !e.listed)) av.eq[s] = ''; });
    return av;
  }
  function fixEquip(u) {          // un-equip anything the user no longer owns (sold / listed)
    let ch = false; Data.SLOTS.forEach(s => { const id = u.avatar.eq[s]; if (id && !u.inv.some(e => e.item === id && !e.listed)) { u.avatar.eq[s] = ''; ch = true; } });
    if (ch) { const c = [...players.values()].find(p => p.ln === u.ln); if (c) bcast(c.room, { t: 'avatar', id: c.id, avatar: avatarOut(u) }); }
    return ch;
  }
  const gameOut = (g, me) => {
    const o = users[g.ownerLn], r = rooms.get(g.id);
    return { id: g.id, title: g.title, desc: g.desc, genre: g.genre, maxPlayers: g.maxPlayers, status: g.status, owner: o ? o.name : ownerName(), plays: g.plays, likes: g.likes.length, liked: !!(me && g.likes.includes(me.ln)), online: r ? r.players.size : 0, updated: g.updated, created: g.created, sky: g.place && g.place.sky, hasThumb: !!g.thumb, mine: !!(me && me.ln === g.ownerLn), canEdit: !!(me && canEdit(me, g)) };
  };
  const canEdit = (u, g) => g.ownerLn ? (g.ownerLn === u.ln || !!u.owner) : (!!u.owner || !!u.admin);

  /* ---------- money ---------- */
  function txlog(u, d, why) { u.log.unshift({ t: now(), d, why }); if (u.log.length > 40) u.log.length = 40; }
  function credit(u, n, why) { u.dust += n; txlog(u, n, why); P.u(u); }
  /* seller null / owner = everything to the owner. Anyone else sells with the 20% owner fee. */
  function settle(buyer, price, seller, it, label) {
    const owner = ownerUser(); buyer.dust -= price; txlog(buyer, -price, label); P.u(buyer);
    if (price <= 0) return;
    if (!seller || (owner && seller.ln === owner.ln)) { if (owner) credit(owner, price, 'Sold ' + it.name + ' to ' + buyer.name); return; }
    const fee = price >= 2 ? Math.max(1, Math.floor(price * Data.FEE)) : 0;
    credit(seller, price - fee, 'Sold ' + it.name + ' to ' + buyer.name + (fee ? ' (after ' + Math.round(Data.FEE * 100) + '% fee)' : ''));
    if (owner && fee) credit(owner, fee, 'Fee: ' + it.name + ' (' + seller.name + ' to ' + buyer.name + ')');
  }

  /* ---------- sessions / limits ---------- */
  function newToken(u) {
    const t = rid(24), h = sha(t); u.tokens[h] = now();
    const hs = Object.keys(u.tokens).sort((a, b) => u.tokens[b] - u.tokens[a]);
    hs.slice(6).forEach(x => { delete u.tokens[x]; tokenIdx.delete(x); });
    tokenIdx.set(h, u.ln); P.u(u); return t;
  }
  function userByToken(t) { const ln = t && tokenIdx.get(sha(t)); return ln && users[ln] ? { ln, u: users[ln] } : null; }
  function auth(req) { const h = req.headers.authorization || ''; return userByToken(h.startsWith('Bearer ') ? h.slice(7) : ''); }
  const behindProxy = !!(env.RENDER || env.LUNA_TRUST_PROXY);
  function clientIp(req) { if (behindProxy) { const x = req.headers['x-forwarded-for']; if (x) return String(x).split(',')[0].trim(); } return req.socket.remoteAddress || ''; }
  const buckets = new Map();
  function limited(key, max, ms) { const t = now(), b = buckets.get(key) || { n: 0, t }; if (t - b.t > ms) { b.n = 0; b.t = t; } b.n++; buckets.set(key, b); return b.n > max; }
  const regs = new Map();
  const isPrivateIp = ip => /^(::1|127\.|::ffff:127\.|10\.|192\.168\.|::ffff:192\.168\.|::ffff:10\.)/.test(ip);

  /* ---------- rooms & players ---------- */
  const players = new Map(), rooms = new Map(), muted = new Map(), lastPlay = new Map(), playsDirty = new Set(); let nextId = 1;
  function room(gid) { let r = rooms.get(gid); if (!r) { r = { id: gid, players: new Map(), history: [] }; rooms.set(gid, r); } return r; }
  function bcast(r, obj, except) { const f = frame(1, Buffer.from(JSON.stringify(obj))); r.players.forEach(p => { if (p !== except && !p.socket.destroyed) { try { p.socket.write(f); } catch (e) { } } }); }
  function bcastAll(obj) { rooms.forEach(r => bcast(r, obj)); }
  function send(c, obj) { if (!c.socket.destroyed) { try { c.socket.write(frame(1, Buffer.from(JSON.stringify(obj)))); } catch (e) { } } }
  const pinfo = c => ({ id: c.id, name: c.u.name, admin: !!c.u.admin, avatar: avatarOut(c.u), x: c.x, y: c.y, z: c.z, r: c.r });
  function kick(c, reason, authFlag) { send(c, { t: 'kick', reason, auth: !!authFlag }); setTimeout(() => { try { c.socket.destroy(); } catch (e) { } }, 100); }
  function findOnline(name, r) {
    name = (name || '').toLowerCase(); if (!name) return null; const all = [...(r ? r.players.values() : players.values())];
    return all.find(p => p.u.name.toLowerCase() === name) || all.find(p => p.u.name.toLowerCase().startsWith(name)) || null;
  }

  function command(c, line) {
    const parts = line.slice(1).trim().split(/\s+/), cmd = (parts.shift() || '').toLowerCase(), isAdmin = !!c.u.admin, r = c.room;
    const sys = (t, big) => send(c, { t: 'sys', text: t, big: !!big });
    if (cmd === 'help') return sys(isAdmin ? 'Admin: /kick /ban /unban /mute /unmute /announce /tp /bring /admin /unadmin /setspawn /givedust /players' : 'Commands: /players');
    if (cmd === 'players') return sys('In this game: ' + [...r.players.values()].map(p => p.u.name).join(', '));
    if (!isAdmin) return sys('You do not have permission for that command.');
    const target = () => { const t = findOnline(parts[0], cmd === 'kick' || cmd === 'ban' || cmd === 'mute' || cmd === 'unmute' ? null : r); if (!t) sys('Player not found.'); return t; };
    const protectedTarget = t => { if (t.u.owner) { sys('You cannot do that to the owner.'); return true; } if (t.u.admin && !c.u.owner) { sys('Only the owner can do that to another admin.'); return true; } return false; };
    let t;
    switch (cmd) {
      case 'kick': if (!(t = target()) || protectedTarget(t)) return; bcast(t.room, { t: 'sys', text: t.u.name + ' was kicked.' }); return kick(t, 'You were kicked by an admin.');
      case 'ban': if (!(t = target()) || protectedTarget(t)) return; t.u.banned = true; P.u(t.u); bcast(t.room, { t: 'sys', text: t.u.name + ' was banned.' }); return kick(t, 'You were banned from Luna.', true);
      case 'unban': { const u = users[(parts[0] || '').toLowerCase()]; if (!u) return sys('No such account.'); u.banned = false; P.u(u); return sys(u.name + ' was unbanned.'); }
      case 'mute': { if (!(t = target()) || protectedTarget(t)) return; const m = Math.min(1440, Math.max(1, parseInt(parts[1], 10) || 5)); muted.set(t.ln, now() + m * 60000); send(t, { t: 'sys', text: 'You were muted for ' + m + ' minute(s).' }); return sys(t.u.name + ' muted for ' + m + ' min.'); }
      case 'unmute': { if (!(t = target())) return; muted.delete(t.ln); send(t, { t: 'sys', text: 'You were unmuted.' }); return sys(t.u.name + ' unmuted.'); }
      case 'announce': { const msg = Filter.filter(parts.join(' ').slice(0, 200)); if (!msg) return sys('Usage: /announce message'); return bcastAll({ t: 'sys', text: 'Announcement: ' + msg, big: true }); }
      case 'tp': {
        if (parts.length >= 3 && parts.slice(0, 3).every(n => isFinite(parseFloat(n)))) return send(c, { t: 'tp', x: +parts[0], y: +parts[1], z: +parts[2] });
        if (!(t = target())) return; return send(c, { t: 'tp', x: t.x + 2, y: t.y + 1, z: t.z });
      }
      case 'bring': if (!(t = target())) return; return send(t, { t: 'tp', x: c.x + 2, y: c.y + 1, z: c.z });
      case 'setspawn': { const g = games[r.id]; if (!g || !canEdit(c.u, g)) return sys('You cannot edit this game.'); g.place.spawn = [c.x, c.y + 0.5, c.z]; P.g(g); return sys('Spawn point set to your position.'); }
      case 'admin': case 'unadmin': {
        if (!c.u.owner) return sys('Only the owner can change admins.');
        const u = users[(parts[0] || '').toLowerCase()]; if (!u) return sys('No such account.');
        if (u.owner) return sys('The owner is always an admin.');
        u.admin = cmd === 'admin'; P.u(u);
        const on = [...players.values()].find(p => p.u === u); if (on) bcast(on.room, { t: 'role', id: on.id, admin: u.admin });
        return sys(u.name + (u.admin ? ' is now an admin.' : ' is no longer an admin.'));
      }
      case 'givedust': {
        if (!c.u.owner) return sys('Only the owner can give Moon Dust.');
        const u = users[(parts[0] || '').toLowerCase()], n = Math.floor(Number(parts[1]));
        if (!u || !isFinite(n) || n === 0 || Math.abs(n) > 1000000) return sys('Usage: /givedust name amount');
        credit(u, n, n > 0 ? 'Gift from ' + c.u.name : 'Adjustment by ' + c.u.name); return sys(u.name + ' now has ' + u.dust + ' Moon Dust.');
      }
      default: return sys('Unknown command. Type /help');
    }
  }

  function handle(c, text) {
    let m; try { m = JSON.parse(text); } catch (e) { return; }
    if (m.t === 'pos') {
      const n = v => (typeof v === 'number' && isFinite(v)) ? v : 0;
      c.x = Math.max(-5000, Math.min(5000, n(m.x))); c.y = Math.max(-500, Math.min(5000, n(m.y))); c.z = Math.max(-5000, Math.min(5000, n(m.z)));
      c.r = n(m.r); c.s = n(m.s); c.a = m.a ? 1 : 0; c.dirty = true;
    } else if (m.t === 'chat') {
      const t = now(); if (t - c.lastChat < 600) return; c.lastChat = t;
      let text2 = String(m.text || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 200); if (!text2) return;
      if (text2[0] === '/') return command(c, text2);
      const mu = muted.get(c.ln); if (mu && mu > t) return send(c, { t: 'sys', text: 'You are muted.' }); if (mu) muted.delete(c.ln);
      text2 = Filter.filter(text2);
      const msg = { t: 'chat', id: c.id, name: c.u.name, text: text2, admin: !!c.u.admin };
      c.room.history.push({ id: c.id, name: msg.name, text: text2, admin: msg.admin }); if (c.room.history.length > 30) c.room.history.shift();
      bcast(c.room, msg);
    }
  }

  /* ---------- http helpers ---------- */
  function json(res, code, obj) { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(obj)); }
  const fail = (res, code, msg) => json(res, code, { error: msg });
  function body(req, limit) {
    return new Promise((resolve, reject) => {
      let size = 0; const chunks = [];
      req.on('data', d => { size += d.length; if (size > limit) { reject(new Error('That is too large to send.')); req.destroy(); } else chunks.push(d); });
      req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); } catch (e) { reject(new Error('Bad JSON')); } });
      req.on('error', reject);
    });
  }
  const clean = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);

  /* ---------- API ---------- */
  async function api(req, res, url) {
    const p = url.pathname, q = url.searchParams, ip = clientIp(req), M = req.method;
    try {
      if (p === '/api/info') return json(res, 200, { name: cfg.name, players: players.size, version: Data.VERSION, accounts: Object.keys(users).length, storage: store.mode, claimHours: Data.CLAIM_HOURS, fee: Data.FEE });
      if (p.startsWith('/api/thumb/') && M === 'GET') {
        const g = games[p.slice(11)], m = g && g.thumb && /^data:image\/jpeg;base64,(.+)$/.exec(g.thumb);
        if (!m) { res.writeHead(404); return res.end(); }
        res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=86400' }); return res.end(Buffer.from(m[1], 'base64'));
      }
      if (M === 'POST' && (p === '/api/register' || p === '/api/login')) {
        if (limited('auth:' + ip, 15, 60000)) return fail(res, 429, 'Too many attempts. Wait a minute.');
        const b = await body(req, 20000), name = String(b.username || '').trim(), pw = String(b.password || ''), ln = name.toLowerCase();
        if (p === '/api/register') {
          if (!/^[A-Za-z0-9_]{3,20}$/.test(name)) return fail(res, 400, 'Username must be 3-20 letters, numbers or _.');
          if (pw.length < 6 || pw.length > 100) return fail(res, 400, 'Password must be at least 6 characters.');
          if (Filter.filter(name) !== name) return fail(res, 400, 'That username is not allowed.');
          if (users[ln]) return fail(res, 400, 'That username is already taken.');
          const reserved = !!cfg.ownerName && ln === cfg.ownerName.toLowerCase();
          if (reserved && ownerCode && !safeEq(String(b.ownerCode || ''), ownerCode)) return fail(res, 403, 'That username is reserved for the Luna owner. Open "Owner setup" and enter the owner code.');
          if (!reserved && !isPrivateIp(ip)) { const day = (regs.get(ip) || []).filter(t => now() - t < 86400000); if (day.length >= 6) return fail(res, 429, 'Too many accounts were created from this network today.'); day.push(now()); regs.set(ip, day); }
          const first = Object.keys(users).length === 0, isOwner = reserved || (!cfg.ownerName && first), salt = rid(16);
          const u = users[ln] = normUser({ name, salt, hash: await hashPw(pw, salt), avatar: Data.cleanAvatar(b.avatar, false), admin: isOwner || isCfgAdmin(name), owner: isOwner, banned: false }, ln);
          indexUser(u); P.u(u); return json(res, 200, { token: newToken(u), user: selfOut(u) });
        }
        const u = users[ln]; let ok = false;
        if (u && u.hash) { const a = Buffer.from(await hashPw(pw, u.salt)), bb = Buffer.from(u.hash); ok = a.length === bb.length && crypto.timingSafeEqual(a, bb); }
        if (!ok) return fail(res, 401, 'Wrong username or password.');
        if (u.banned) return fail(res, 403, 'This account is banned from Luna.');
        if (isCfgAdmin(u.name) && !u.admin) { u.admin = true; P.u(u); }
        return json(res, 200, { token: newToken(u), user: selfOut(u) });
      }
      const a = auth(req); if (!a) return fail(res, 401, 'Please log in again.');
      const u = a.u; if (u.banned) return fail(res, 403, 'This account is banned from Luna.');
      if (isCfgAdmin(u.name) && !u.admin) { u.admin = true; P.u(u); }

      /* ----- GET ----- */
      if (M === 'GET') {
        if (p === '/api/me') return json(res, 200, { user: selfOut(u) });
        if (p === '/api/wallet') return json(res, 200, { dust: u.dust, nextClaim: u.nextClaim, streak: u.streak, log: u.log, claim: { base: Data.CLAIM_BASE, hours: Data.CLAIM_HOURS, bonusMax: Data.CLAIM_BONUS_MAX, step: Data.CLAIM_BONUS_STEP } });
        if (p === '/api/inventory') {
          const defs = {}; u.inv.forEach(e => { if (items[e.item] && !defs[e.item]) defs[e.item] = itemOut(items[e.item], u); });
          return json(res, 200, { items: u.inv.filter(e => items[e.item]).map(e => ({ uid: e.uid, item: e.item, serial: e.serial, got: e.got, listed: e.listed })), defs });
        }
        if (p === '/api/shop') {
          const slot = q.get('slot') || '', term = (q.get('q') || '').toLowerCase().trim(), sort = q.get('sort') || 'new';
          let list = Object.values(items).filter(it => it.onSale || (it.kind !== 'normal' && listings.get(it.id) && listings.get(it.id).size));
          if (slot) list = list.filter(it => it.slot === slot); if (term) list = list.filter(it => it.name.toLowerCase().includes(term));
          list.sort(sort === 'low' ? (x, y) => x.price - y.price : sort === 'high' ? (x, y) => y.price - x.price : sort === 'popular' ? (x, y) => y.sold - x.sold : (x, y) => y.created - x.created);
          return json(res, 200, { items: list.slice(0, 300).map(it => itemOut(it, u)) });
        }
        if (p.startsWith('/api/item/')) {
          const it = items[p.slice(10)]; if (!it) return fail(res, 404, 'Item not found.');
          const rs = []; const ls = listings.get(it.id); if (ls) ls.forEach(l => rs.push({ uid: l.uid, price: l.price, serial: l.serial, seller: users[l.ln] ? users[l.ln].name : '?', mine: l.ln === u.ln }));
          rs.sort((x, y) => x.price - y.price);
          return json(res, 200, { item: itemOut(it, u), resellers: rs.slice(0, 30), mine: u.inv.filter(e => e.item === it.id).map(e => ({ uid: e.uid, serial: e.serial, listed: e.listed })) });
        }
        if (p.startsWith('/api/profile/')) {
          const t = users[decodeURIComponent(p.slice(13)).toLowerCase()]; if (!t) return fail(res, 404, 'No such player.');
          const wearing = Data.SLOTS.map(s => t.avatar.eq[s]).filter(id => id && items[id]).map(id => itemOut(items[id], u));
          const coll = t.inv.filter(e => items[e.item] && items[e.item].kind !== 'normal').slice(0, 60).map(e => ({ uid: e.uid, serial: e.serial, item: itemOut(items[e.item], u) }));
          const gs = Object.values(games).filter(g => g.ownerLn === t.ln && g.status === 'public');
          const online = [...players.values()].some(c => c.ln === t.ln);
          return json(res, 200, { name: t.name, avatar: avatarOut(t), bio: t.bio, admin: !!t.admin, owner: !!t.owner, created: t.created, online, lastSeen: online ? now() : t.lastSeen, me: t.ln === u.ln,
            stats: { games: gs.length, plays: gs.reduce((n, g) => n + g.plays, 0), likes: gs.reduce((n, g) => n + g.likes.length, 0), items: t.inv.length }, wearing, collectibles: coll, games: gs.map(g => gameOut(g, u)) });
        }
        if (p === '/api/users/search') {
          const term = (q.get('q') || '').toLowerCase().trim(); if (!term) return json(res, 200, { users: [] });
          const online = new Set([...players.values()].map(c => c.ln));
          return json(res, 200, { users: Object.values(users).filter(x => x.name.toLowerCase().includes(term)).sort((x, y) => (x.name.toLowerCase().startsWith(term) ? 0 : 1) - (y.name.toLowerCase().startsWith(term) ? 0 : 1) || x.name.length - y.name.length).slice(0, 24).map(x => ({ name: x.name, admin: !!x.admin, owner: !!x.owner, online: online.has(x.ln) })) });
        }
        if (p === '/api/games') {
          const term = (q.get('q') || '').toLowerCase().trim(), genre = q.get('genre') || '', sort = q.get('sort') || 'popular';
          let list = Object.values(games).filter(g => g.status === 'public');
          if (term) list = list.filter(g => g.title.toLowerCase().includes(term) || g.desc.toLowerCase().includes(term)); if (genre) list = list.filter(g => g.genre === genre);
          const score = g => (rooms.get(g.id) ? rooms.get(g.id).players.size : 0) * 100 + g.plays + g.likes.length * 5;
          list.sort(sort === 'new' ? (x, y) => y.updated - x.updated : (x, y) => score(y) - score(x));
          return json(res, 200, { games: list.slice(0, 80).map(g => gameOut(g, u)) });
        }
        if (p === '/api/my/games') return json(res, 200, { games: Object.values(games).filter(g => g.ownerLn === u.ln || (g.id === 'hub' && canEdit(u, g))).sort((x, y) => y.updated - x.updated).map(g => gameOut(g, u)) });
        let m = /^\/api\/game\/([a-z0-9]+)(\/place)?$/.exec(p);
        if (m) {
          const g = games[m[1]]; if (!g) return fail(res, 404, 'Game not found.');
          if (g.status !== 'public' && !canEdit(u, g)) return fail(res, 404, 'Game not found.');
          if (m[2]) { if (!canEdit(u, g)) return fail(res, 403, 'You cannot edit this game.'); return json(res, 200, { game: gameOut(g, u), place: g.place }); }
          return json(res, 200, { game: gameOut(g, u) });
        }
        if (p === '/api/owner/items' || p === '/api/owner/stats') {
          if (!u.owner) return fail(res, 403, 'Owner only.');
          if (p === '/api/owner/items') return json(res, 200, { items: Object.values(items).sort((x, y) => y.created - x.created).map(it => Object.assign(itemOut(it, u), { onSale: it.onSale, builtin: !!it.builtin })) });
          const us = Object.values(users);
          return json(res, 200, { users: us.length, games: Object.keys(games).length, items: Object.keys(items).length, circulating: us.reduce((n, x) => n + x.dust, 0), balance: u.dust, sales: Object.values(items).reduce((n, it) => n + it.sold, 0), log: u.log, storage: store.mode, online: players.size });
        }
        return fail(res, 404, 'Not found');
      }
      if (M !== 'POST') return fail(res, 405, 'Method not allowed');

      /* ----- POST ----- */
      if (limited('w:' + u.ln, 60, 10000)) return fail(res, 429, 'Slow down a little.');
      if (p === '/api/logout') { const h = (req.headers.authorization || '').slice(7); delete u.tokens[sha(h)]; tokenIdx.delete(sha(h)); P.u(u); return json(res, 200, { ok: true }); }
      if (p === '/api/avatar') {
        const b = await body(req, 8000); u.avatar = sanitizeAvatar(u, b.avatar); P.u(u);
        const on = [...players.values()].find(x => x.ln === u.ln); if (on) bcast(on.room, { t: 'avatar', id: on.id, avatar: avatarOut(u) });
        return json(res, 200, { avatar: avatarOut(u) });
      }
      if (p === '/api/bio') { const b = await body(req, 2000); u.bio = Filter.filter(clean(b.bio, 240)); P.u(u); return json(res, 200, { bio: u.bio }); }
      if (p === '/api/dust/claim') {
        const t = now(); if (t < u.nextClaim) return json(res, 400, { error: 'Your Moon Dust is not ready yet.', nextClaim: u.nextClaim });
        u.streak = (u.lastClaim && t - u.lastClaim <= 10 * 3600000) ? (u.streak || 0) + 1 : 1;
        const bonus = Math.min(Data.CLAIM_BONUS_MAX, (u.streak - 1) * Data.CLAIM_BONUS_STEP), gain = Data.CLAIM_BASE + bonus;
        u.lastClaim = t; u.nextClaim = t + Data.CLAIM_HOURS * 3600000; credit(u, gain, 'Free Moon Dust' + (bonus ? ' (+' + bonus + ' streak bonus)' : ''));
        return json(res, 200, { gained: gain, bonus, dust: u.dust, nextClaim: u.nextClaim, streak: u.streak });
      }
      if (p === '/api/buy') {
        const b = await body(req, 2000), it = items[b.item]; if (!it) return fail(res, 404, 'Item not found.');
        if (u.inv.length >= 600) return fail(res, 400, 'Your inventory is full.');
        if (b.listing) {
          const ls = listings.get(it.id), l = ls && ls.get(String(b.listing));
          if (!l) return fail(res, 400, 'That listing is gone. Someone may have bought it first.');
          if (l.ln === u.ln) return fail(res, 400, 'You cannot buy your own listing.');
          if (u.dust < l.price) return fail(res, 400, 'You do not have enough Moon Dust.');
          const seller = users[l.ln], e = seller && seller.inv.find(x => x.uid === l.uid); if (!e) { ls.delete(l.uid); return fail(res, 400, 'That listing is gone.'); }
          const price = l.price; seller.inv = seller.inv.filter(x => x !== e); ls.delete(l.uid); e.listed = 0; e.got = now(); u.inv.push(e);
          settle(u, price, seller, it, 'Bought ' + it.name + (e.serial ? ' #' + e.serial : '')); fixEquip(seller); P.u(seller); P.u(u);
          return json(res, 200, { ok: true, dust: u.dust, item: itemOut(it, u) });
        }
        if (!it.onSale) return fail(res, 400, 'This item is off sale.');
        const rem = it.stock == null ? null : it.stock - it.sold; if (rem !== null && rem <= 0) return fail(res, 400, 'Sold out.');
        if (it.kind === 'normal' && u.inv.some(x => x.item === it.id)) return fail(res, 400, 'You already own this item.');
        if (u.dust < it.price) return fail(res, 400, 'You do not have enough Moon Dust.');
        it.sold++; P.i(it); u.inv.push({ uid: rid(4), item: it.id, serial: it.kind === 'unique' ? it.sold : 0, got: now(), listed: 0 });
        settle(u, it.price, it.creatorLn ? users[it.creatorLn] : null, it, 'Bought ' + it.name + (it.kind === 'unique' ? ' #' + it.sold : '')); P.u(u);
        return json(res, 200, { ok: true, dust: u.dust, item: itemOut(it, u) });
      }
      if (p === '/api/sell') {
        const b = await body(req, 2000), e = u.inv.find(x => x.uid === b.uid), it = e && items[e.item]; if (!e || !it) return fail(res, 404, 'You do not own that.');
        const price = Math.floor(Number(b.price) || 0);
        if (!price) { if (e.listed) { dropListing(e); e.listed = 0; P.u(u); } return json(res, 200, { ok: true }); }
        if (it.kind === 'normal') return fail(res, 400, 'Only Limited items can be sold to other players.');
        if (price < 1 || price > 1000000) return fail(res, 400, 'Choose a price between 1 and 1,000,000 Moon Dust.');
        if (e.listed) dropListing(e); e.listed = price; addListing(e, u.ln); fixEquip(u); P.u(u);
        return json(res, 200, { ok: true, fee: Data.FEE, youGet: price - (price >= 2 ? Math.max(1, Math.floor(price * Data.FEE)) : 0) });
      }
      if (p === '/api/game/save') {
        const b = await body(req, 2600000); let g = b.id ? games[String(b.id)] : null;
        if (b.id && !g) return fail(res, 404, 'Game not found.'); if (g && !canEdit(u, g)) return fail(res, 403, 'You cannot edit this game.');
        const title = clean(b.title, 40), desc = clean(b.desc, 800);
        if (Filter.filter(title) !== title || Filter.filter(desc) !== desc) return fail(res, 400, 'The title or description contains words that are not allowed.');
        const publishing = b.publish === true || (b.publish === undefined && g && g.status === 'public');
        if (publishing && g && g.id !== 'hub' || b.publish === true) { if (title.length < 3) return fail(res, 400, 'Give your game a title (at least 3 characters).'); if (desc.length < 10) return fail(res, 400, 'Add a short description (at least 10 characters) so players know what to expect.'); }
        if (!g) {
          if (!u.owner && Object.values(games).filter(x => x.ownerLn === u.ln).length >= Data.MAX_GAMES) return fail(res, 400, 'You can have up to ' + Data.MAX_GAMES + ' games. Delete one first.');
          let id; do { id = rid(5); } while (games[id]); g = games[id] = { id, ownerLn: u.ln, title: 'Untitled', desc: '', genre: 'Other', maxPlayers: 20, status: 'draft', place: Data.defaultPlace(), thumb: '', plays: 0, likes: [], created: now(), updated: now() };
        }
        if (title) g.title = title; g.desc = desc; g.genre = Data.pick(b.genre, Data.GENRES, g.genre); g.maxPlayers = Math.floor(Data.num(b.maxPlayers, g.maxPlayers, 1, 50));
        let placeChanged = false; if (b.place) { g.place = Data.cleanPlace(b.place); placeChanged = true; }
        if (typeof b.thumb === 'string' && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(b.thumb) && b.thumb.length < 90000) g.thumb = b.thumb;
        if (g.id === 'hub') g.status = 'public'; else if (b.publish === true) g.status = 'public'; else if (b.publish === false) g.status = 'draft';
        g.updated = now(); P.g(g);
        const r = rooms.get(g.id); if (r && placeChanged) { bcast(r, { t: 'place', place: g.place }); bcast(r, { t: 'sys', text: 'This game was just updated.', big: true }); }
        return json(res, 200, { id: g.id, game: gameOut(g, u) });
      }
      if (p === '/api/game/delete') {
        const b = await body(req, 1000), g = games[String(b.id)]; if (!g || g.id === 'hub') return fail(res, 404, 'Game not found.');
        if (!canEdit(u, g) && !u.admin) return fail(res, 403, 'You cannot delete this game.');
        const r = rooms.get(g.id); if (r) r.players.forEach(c => kick(c, 'This game was removed.'));
        delete games[g.id]; store.del('g:' + g.id); return json(res, 200, { ok: true });
      }
      if (p === '/api/game/like') {
        const b = await body(req, 1000), g = games[String(b.id)]; if (!g || g.status !== 'public') return fail(res, 404, 'Game not found.');
        const i = g.likes.indexOf(u.ln); if (i >= 0) g.likes.splice(i, 1); else g.likes.push(u.ln); P.g(g); return json(res, 200, { liked: i < 0, likes: g.likes.length });
      }
      if (p.startsWith('/api/owner/')) {
        if (!u.owner) return fail(res, 403, 'Only the Luna owner can do that.');
        if (p === '/api/owner/item') {
          const b = await body(req, 120000), c = Data.cleanItem(b); c.name = Filter.filter(clean(c.name, 40)); c.desc = Filter.filter(clean(c.desc, 200));
          if (c.name.length < 2) return fail(res, 400, 'Give the item a name.');
          let it = b.id ? items[b.id] : null; if (b.id && !it) return fail(res, 404, 'Item not found.');
          if (it) {
            if (it.sold > 0 && (c.slot !== it.slot || c.kind !== it.kind)) return fail(res, 400, 'The type and slot of an item that already sold cannot change.');
            if (c.stock !== null && c.stock < it.sold) c.stock = it.sold;
            Object.assign(it, { name: c.name, desc: c.desc, slot: c.slot, kind: c.kind, price: c.price, stock: c.stock, onSale: c.onSale, data: c.data });
          } else { let id; do { id = 'it_' + rid(4); } while (items[id]); it = items[id] = { id, name: c.name, desc: c.desc, slot: c.slot, kind: c.kind, price: c.price, stock: c.stock, onSale: c.onSale, data: c.data, sold: 0, creatorLn: u.ln, created: now(), builtin: false }; }
          P.i(it); return json(res, 200, { ok: true, item: itemOut(it, u) });
        }
        if (p === '/api/owner/item/delete') {
          const b = await body(req, 1000), it = items[String(b.id)]; if (!it) return fail(res, 404, 'Item not found.');
          if (it.sold > 0 || (listings.get(it.id) && listings.get(it.id).size)) return fail(res, 400, 'Items that already sold cannot be deleted. Turn off "On sale" instead.');
          delete items[it.id]; store.del('i:' + it.id); return json(res, 200, { ok: true });
        }
        if (p === '/api/owner/grant') {
          const b = await body(req, 1000), t = users[String(b.name || '').toLowerCase()], n = Math.floor(Number(b.amount));
          if (!t) return fail(res, 404, 'No such account.'); if (!isFinite(n) || n === 0 || Math.abs(n) > 1000000) return fail(res, 400, 'Choose an amount between -1,000,000 and 1,000,000.');
          credit(t, n, n > 0 ? 'Gift from ' + u.name : 'Adjustment by ' + u.name); return json(res, 200, { ok: true, dust: t.dust });
        }
      }
      return fail(res, 404, 'Not found');
    } catch (e) { return fail(res, 400, e.message || 'Bad request'); }
  }

  /* ---------- static files (the website / client pages) ---------- */
  function serveStatic(req, res, p) {
    const webDir = opts.webDir || null;
    if (!webDir || !fs.existsSync(webDir)) { res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Luna Server is running.\nOpen the Luna app and connect with this address.'); }
    let rel; try { rel = decodeURIComponent(p); } catch (e) { rel = '/'; }
    const rootDir = path.resolve(webDir); let f = path.join(rootDir, rel);
    if (!f.startsWith(rootDir)) { res.writeHead(403); return res.end(); }
    fs.stat(f, (err, st) => {
      if (!err && st.isDirectory()) { if (!rel.endsWith('/')) { res.writeHead(301, { Location: rel + '/' }); return res.end(); } f = path.join(f, 'index.html'); }
      fs.readFile(f, (e2, data) => {
        if (e2) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not found'); }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' }); res.end(data);
      });
    });
  }

  const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*'); res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization'); res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
    let url; try { url = new URL(req.url, 'http://x'); } catch (e) { res.writeHead(400); return res.end(); }
    if (url.pathname === '/healthz') { res.writeHead(200, { 'Content-Type': 'text/plain' }); return res.end('ok'); }
    if (url.pathname.startsWith('/api/')) return api(req, res, url);
    serveStatic(req, res, url.pathname);
  });

  /* ---------- websockets (multiplayer) ---------- */
  server.on('upgrade', (req, socket) => {
    let url; try { url = new URL(req.url, 'http://x'); } catch (e) { return socket.destroy(); }
    const a = url.pathname === '/ws' && userByToken(url.searchParams.get('token')), key = req.headers['sec-websocket-key'], gid = url.searchParams.get('game') || 'hub', g = games[gid];
    const deny = code => { socket.write('HTTP/1.1 ' + code + '\r\nConnection: close\r\n\r\n'); socket.destroy(); };
    if (!a || !key || !g || a.u.banned) return deny('403 Forbidden');
    if (g.status !== 'public' && !canEdit(a.u, g)) return deny('403 Forbidden');
    const r = room(gid), cap = g.id === 'hub' ? cfg.maxPlayers : g.maxPlayers;
    players.forEach(p => { if (p.ln === a.ln) kick(p, 'You logged in from another place.'); });
    if (r.players.size >= cap) return deny('503 Service Unavailable');
    socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + crypto.createHash('sha1').update(key + GUID).digest('base64') + '\r\n\r\n');
    socket.setNoDelay(true);
    const sp = g.place.spawn || [0, 3, 0];
    const c = { id: nextId++, socket, ln: a.ln, u: a.u, room: r, x: sp[0], y: sp[1], z: sp[2], r: 0, s: 0, a: 0, dirty: false, lastChat: 0 };
    let buf = Buffer.alloc(0), frag = [], closed = false;
    function drop() {
      if (closed) return; closed = true; c.u.lastSeen = now(); P.u(c.u);
      players.delete(c.id); if (r.players.get(c.id) === c) { r.players.delete(c.id); bcast(r, { t: 'leave', id: c.id }); }
      try { socket.destroy(); } catch (e) { }
    }
    socket.on('data', chunk => {
      buf = Buffer.concat([buf, chunk]); if (buf.length > 262144) return drop();
      while (buf.length >= 2) {
        const b0 = buf[0], b1 = buf[1], fin = b0 & 0x80, op = b0 & 15, masked = b1 & 0x80; let len = b1 & 127, off = 2;
        if (len === 126) { if (buf.length < 4) break; len = buf.readUInt16BE(2); off = 4; }
        else if (len === 127) { if (buf.length < 10) break; if (buf.readUInt32BE(2) > 0) return drop(); len = buf.readUInt32BE(6); off = 10; }
        if (len > 65536) return drop();
        const mlen = masked ? 4 : 0; if (buf.length < off + mlen + len) break;
        let payload = Buffer.from(buf.slice(off + mlen, off + mlen + len));
        if (masked) { const mask = buf.slice(off, off + 4); for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i & 3]; }
        buf = buf.slice(off + mlen + len);
        if (op === 8) { try { socket.write(frame(8, Buffer.alloc(0))); } catch (e) { } return drop(); }
        if (op === 9) { try { socket.write(frame(10, payload)); } catch (e) { } continue; }
        if (op === 1 || op === 0) {
          if (op === 1) frag = [payload]; else frag.push(payload);
          if (fin) { const text = Buffer.concat(frag).toString('utf8'); frag = []; handle(c, text); }
        }
      }
    });
    socket.on('close', drop); socket.on('error', drop);
    players.set(c.id, c); r.players.set(c.id, c);
    const pk = a.ln + ':' + gid; if (!lastPlay.has(pk) || now() - lastPlay.get(pk) > 600000) { lastPlay.set(pk, now()); g.plays++; playsDirty.add(gid); }
    send(c, { t: 'welcome', id: c.id, you: pub(c.u), game: { id: g.id, title: g.title, desc: g.desc, maxPlayers: g.maxPlayers }, place: g.place, players: [...r.players.values()].map(pinfo), chat: r.history });
    bcast(r, { t: 'join', p: pinfo(c) }, c);
    console.log('[join] ' + c.u.name + ' -> ' + g.title);
  });

  const tick = setInterval(() => {
    rooms.forEach(r => {
      const s = []; r.players.forEach(p => { if (p.dirty) { s.push([p.id, p.x, p.y, p.z, p.r, p.s, p.a]); p.dirty = false; } });
      if (s.length) bcast(r, { t: 'snap', s });
    });
  }, 50);
  const ping = setInterval(() => { const f = frame(9, Buffer.alloc(0)); players.forEach(p => { try { p.socket.write(f); } catch (e) { } }); }, 25000);
  const saver = setInterval(() => { playsDirty.forEach(id => { if (games[id]) P.g(games[id]); }); playsDirty.clear(); }, 120000);

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '0.0.0.0', () => resolve({
      port, dataDir, storage: store.mode, addresses: lanAddresses(), server,
      stop: async () => {
        clearInterval(tick); clearInterval(ping); clearInterval(saver); playsDirty.forEach(id => { if (games[id]) P.g(games[id]); });
        players.forEach(p => { try { p.socket.destroy(); } catch (e) { } }); server.close();
        try { await store.flush(); } catch (e) { }
      }
    }));
  });
}

module.exports = { start, lanAddresses };

if (require.main === module) {
  const args = process.argv.slice(2), get = n => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : null; };
  const webDir = [get('web'), path.join(__dirname, 'web')].filter(Boolean).find(d => fs.existsSync(d));
  start({
    port: get('port') ? parseInt(get('port'), 10) : undefined, dataDir: get('data') ? path.resolve(get('data')) : undefined,
    webDir: webDir ? path.resolve(webDir) : null, owner: get('owner') || undefined, ownerCode: get('owner-code') || undefined,
    admins: (get('admin') || '').split(',').map(s => s.trim()).filter(Boolean)
  }).then(r => {
    console.log('\n  Luna Server running on port ' + r.port + '   (storage: ' + r.storage + ')\n  Local:   http://localhost:' + r.port);
    r.addresses.forEach(a => console.log('  Network: http://' + a + ':' + r.port));
    console.log('\n  The owner account is ' + (process.env.LUNA_OWNER || get('owner') ? 'the one named in LUNA_OWNER / --owner' : 'the FIRST account created') + '.\n');
    const bye = () => r.stop().then(() => process.exit(0)); process.on('SIGTERM', bye); process.on('SIGINT', bye);
  }).catch(e => { console.error('Could not start: ' + e.message); process.exit(1); });
}
