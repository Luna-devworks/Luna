/* Luna shared data + validation. Runs in the browser AND on the server. No DOM, no three.js. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LunaData = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var D = { VERSION: '1.0.0' };

  /* ---------- economy (Moon Dust) ---------- */
  D.CLAIM_HOURS = 5;        // free Moon Dust every 5 hours
  D.CLAIM_BASE = 50;        // 50 minimum
  D.CLAIM_BONUS_STEP = 5;   // +5 per claim streak step...
  D.CLAIM_BONUS_MAX = 50;   // ...up to +50 (so 50 to 100 per claim)
  D.START_DUST = 100;
  D.FEE = 0.2;              // 20% of every player-to-player sale goes to the owner account
  D.MAX_GAMES = 12; D.MAX_PARTS = 2000;

  /* ---------- avatar lists ---------- */
  D.SKINS = ['#FFDBAC', '#F1C27D', '#E0AC69', '#C68642', '#8D5524', '#5C3A21', '#FFE0BD', '#F6C9B8', '#FFD54F', '#A5D6A7', '#90CAF9', '#CE93D8'];
  D.FACES = ['smile', 'happy', 'cool', 'wink', 'surprised', 'tongue', 'angry', 'sleepy'];
  D.FACE_EXPRS = D.FACES.concat(['cat', 'robot', 'love', 'shades', 'blush', 'uwu', 'glitch']);
  D.HAIRS = ['none', 'short', 'spiky', 'long', 'bun', 'mohawk', 'pony', 'afro'];
  D.HAIR_COLORS = ['#1B1B1B', '#3B2A1A', '#6B4423', '#B5651D', '#E6B800', '#F5F5F5', '#FF7A00', '#D32F2F', '#7B1FA2', '#1976D2', '#2E7D32', '#EC407A'];
  D.SHIRT_STYLES = ['plain', 'stripes', 'luna', 'jersey', 'pocket', 'vneck'];
  D.SHIRT_PATTERNS = ['plain', 'stripes', 'luna', 'jersey', 'pocket', 'vneck', 'checker', 'stars', 'hoodie', 'gradient', 'heart'];
  D.PANTS_STYLES = ['plain', 'shorts'];
  D.PANTS_PATTERNS = ['plain', 'stripe', 'checker', 'patch'];
  D.PALETTE = ['#FF7A00', '#FFFFFF', '#FFB066', '#D35400', '#1B1B1B', '#555555', '#D32F2F', '#EC407A', '#7B1FA2', '#1976D2', '#00ACC1', '#2E7D32', '#9CCC65', '#FDD835', '#6D4C41', '#BDBDBD'];
  D.SLOTS = ['hat', 'face', 'acc', 'back', 'shirt', 'pants'];
  D.SLOT_NAMES = { hat: 'Hats', face: 'Faces', acc: 'Face Gear', back: 'Back Items', shirt: 'Shirts', pants: 'Pants' };
  D.SLOT_ONE = { hat: 'Hat', face: 'Face', acc: 'Face Gear', back: 'Back Item', shirt: 'Shirt', pants: 'Pants' };
  D.KINDS = { normal: 'Normal', limited: 'Limited', unique: 'Limited Unique' };
  D.GENRES = ['Obby', 'Hangout', 'Adventure', 'Racing', 'Roleplay', 'Showcase', 'Other'];
  D.PART_KINDS = ['none', 'kill', 'checkpoint', 'bounce', 'goal'];
  D.MATS = ['plastic', 'neon', 'metal'];
  D.DEFAULT_AVATAR = { skin: '#F1C27D', face: 'smile', hair: 'short', hairColor: '#3B2A1A', shirt: '#FF7A00', shirtStyle: 'luna', pants: '#2B2B2B', pantsStyle: 'plain', shoes: '#FFFFFF', eq: { hat: '', face: '', acc: '', back: '', shirt: '', pants: '' } };

  /* ---------- tiny validators ---------- */
  var ID = /^[a-z0-9_]{1,32}$/;
  function hex(v, d) { return (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v)) ? v : d; }
  function pick(v, list, d) { return list.indexOf(v) >= 0 ? v : d; }
  function num(v, d, lo, hi) { v = Number(v); if (!isFinite(v)) v = d; if (lo !== undefined) v = Math.max(lo, v); if (hi !== undefined) v = Math.min(hi, v); return v; }
  D.hex = hex; D.pick = pick; D.num = num; D.isId = function (s) { return typeof s === 'string' && ID.test(s); };

  D.cleanAvatar = function (a, keepDefs) {
    a = a && typeof a === 'object' ? a : {}; var F = D.DEFAULT_AVATAR, e = a.eq && typeof a.eq === 'object' ? a.eq : {}, eq = {};
    D.SLOTS.forEach(function (s) { eq[s] = (typeof e[s] === 'string' && ID.test(e[s])) ? e[s] : ''; });
    var out = {
      skin: hex(a.skin, F.skin), face: pick(a.face, D.FACES, F.face), hair: pick(a.hair, D.HAIRS, F.hair), hairColor: hex(a.hairColor, F.hairColor),
      shirt: hex(a.shirt, F.shirt), shirtStyle: pick(a.shirtStyle, D.SHIRT_STYLES, F.shirtStyle), pants: hex(a.pants, F.pants),
      pantsStyle: pick(a.pantsStyle, D.PANTS_STYLES, F.pantsStyle), shoes: hex(a.shoes, F.shoes), eq: eq
    };
    if (keepDefs && a.defs && typeof a.defs === 'object') out.defs = a.defs;
    return out;
  };

  /* ---------- items ---------- */
  function cleanParts(list) {
    var out = [];
    (Array.isArray(list) ? list : []).slice(0, 40).forEach(function (p) {
      if (!p || typeof p !== 'object') return;
      var q = {
        t: pick(p.t, ['b', 'c', 's'], 'b'),
        s: [0, 1, 2].map(function (i) { return num(p.s && p.s[i], 1, 0.05, 6); }),
        p: [0, 1, 2].map(function (i) { return num(p.p && p.p[i], 0, -6, 6); }),
        c: hex(p.c, '#FF7A00')
      };
      if (p.r && p.r.length) q.r = [0, 1, 2].map(function (i) { return num(p.r[i], 0, -180, 180); });
      if (p.g) q.g = 1;
      out.push(q);
    });
    return out;
  }
  D.cleanItemData = function (slot, d) {
    d = d && typeof d === 'object' ? d : {};
    if (slot === 'face') return { expr: pick(d.expr, D.FACE_EXPRS, 'smile'), color: hex(d.color, '#1a1a1a') };
    if (slot === 'shirt') return { pattern: pick(d.pattern, D.SHIRT_PATTERNS, 'plain'), c1: hex(d.c1, '#FF7A00'), c2: hex(d.c2, '#FFFFFF') };
    if (slot === 'pants') return { pattern: pick(d.pattern, D.PANTS_PATTERNS, 'plain'), style: pick(d.style, ['long', 'shorts'], 'long'), c1: hex(d.c1, '#2B2B2B'), c2: hex(d.c2, '#FFFFFF') };
    return { parts: cleanParts(d.parts) };
  };
  /* returns the editable part of an item definition (server adds sold / created / creator) */
  D.cleanItem = function (it) {
    it = it && typeof it === 'object' ? it : {};
    var slot = pick(it.slot, D.SLOTS, 'hat'), kind = pick(it.kind, ['normal', 'limited', 'unique'], 'normal');
    var stock = (it.stock === null || it.stock === undefined || it.stock === '') ? null : Math.floor(num(it.stock, 0, 0, 1000000));
    if (kind === 'unique' && stock === null) stock = 100;
    return {
      id: ID.test(it.id) ? it.id : '', name: String(it.name || 'New Item').slice(0, 40), desc: String(it.desc || '').slice(0, 200),
      slot: slot, kind: kind, price: Math.floor(num(it.price, 10, 0, 1000000)), stock: stock, onSale: it.onSale !== false, data: D.cleanItemData(slot, it.data)
    };
  };

  /* ---------- places (games) ---------- */
  D.defaultPlace = function () {
    return {
      name: 'Luna Baseplate', sky: '#FFE9D2', spawn: [0, 3, 0], walk: 16, jump: 38,
      parts: [{ id: 'p1', name: 'Baseplate', type: 'box', pos: [0, -0.5, 0], size: [300, 1, 300], rot: 0, color: '#FF7A00', alpha: 1, collide: true, tex: 'grid', kind: 'none', mat: 'plastic' },
      { id: 'p2', name: 'SpawnPad', type: 'box', pos: [0, 0.1, 0], size: [8, 0.2, 8], rot: 0, color: '#FFFFFF', alpha: 1, collide: true, tex: '', kind: 'none', mat: 'plastic' }],
      scripts: []
    };
  };
  D.cleanPlace = function (pl) {
    pl = (pl && typeof pl === 'object') ? pl : D.defaultPlace();
    var out = { name: String(pl.name || 'Untitled').slice(0, 40), sky: hex(pl.sky, '#FFE9D2'), spawn: [0, 3, 0], walk: num(pl.walk, 16, 6, 50), jump: num(pl.jump, 38, 15, 100), parts: [], scripts: [] }, seen = {};
    if (Array.isArray(pl.spawn)) out.spawn = [num(pl.spawn[0], 0), num(pl.spawn[1], 3), num(pl.spawn[2], 0)];
    (Array.isArray(pl.parts) ? pl.parts : []).slice(0, D.MAX_PARTS).forEach(function (p, i) {
      if (!p || typeof p !== 'object') return;
      var id = String(p.id || 'p' + i).replace(/[^\w\-]/g, '').slice(0, 24) || 'p' + i; if (seen[id]) id = id.slice(0, 18) + '_' + i; seen[id] = 1;
      out.parts.push({
        id: id, name: String(p.name || 'Part').slice(0, 40), type: pick(p.type, ['box', 'sphere', 'cylinder'], 'box'),
        pos: [num(p.pos && p.pos[0], 0), num(p.pos && p.pos[1], 0), num(p.pos && p.pos[2], 0)],
        size: [num(p.size && p.size[0], 4, 0.05), num(p.size && p.size[1], 1, 0.05), num(p.size && p.size[2], 4, 0.05)],
        rot: num(p.rot, 0), color: hex(p.color, '#FF7A00'), alpha: num(p.alpha, 1, 0, 1), collide: p.collide !== false, tex: p.tex === 'grid' ? 'grid' : '',
        kind: pick(p.kind, D.PART_KINDS, 'none'), mat: pick(p.mat, D.MATS, 'plastic')
      });
    });
    (Array.isArray(pl.scripts) ? pl.scripts : []).slice(0, 30).forEach(function (s) { if (s && typeof s === 'object') out.scripts.push({ name: String(s.name || 'Script').slice(0, 40), code: String(s.code || '').slice(0, 40000) }); });
    return out;
  };

  /* ---------- built-in shop items (seeded into the server database once; the owner can edit them) ---------- */
  function B(w, h, d, x, y, z, c, o) { var p = { t: 'b', s: [w, h, d], p: [x, y, z], c: c }; if (o && o.r) p.r = o.r; if (o && o.g) p.g = 1; return p; }
  function Cy(w, h, d, x, y, z, c, o) { var p = B(w, h, d, x, y, z, c, o); p.t = 'c'; return p; }
  var T = 1704067200000, seeds = [];
  function S(id, name, slot, price, desc, data, more) {
    var it = { id: id, name: name, slot: slot, price: price, desc: desc, data: data, kind: 'normal', stock: null, onSale: true, builtin: true, created: T + seeds.length * 1000 };
    if (more) for (var k in more) it[k] = more[k];
    seeds.push(it);
  }
  function mirror(fn) { return fn(-1).concat(fn(1)); }
  /* hats (head-local: top of head is y=0.65, front is +z) */
  S('hat_cap', 'Orange Cap', 'hat', 25, 'The classic Luna cap.', { parts: [B(1.48, .4, 1.48, 0, .77, 0, '#FF7A00'), B(1.4, .08, .7, 0, .6, 1, '#D35400')] });
  S('hat_cap_night', 'Night Cap', 'hat', 25, 'For late-night building sessions.', { parts: [B(1.48, .4, 1.48, 0, .77, 0, '#1B1B1B'), B(1.4, .08, .7, 0, .6, 1, '#333333')] });
  S('hat_beanie', 'Cozy Beanie', 'hat', 40, 'Warm, soft, slightly purple.', { parts: [B(1.5, .6, 1.5, 0, .8, 0, '#7B1FA2'), B(.3, .3, .3, 0, 1.23, 0, '#FFFFFF')] });
  S('hat_cat', 'Cat Ears', 'hat', 60, 'Two very alert ears.', { parts: mirror(function (s) { return [B(.4, .4, .2, s * .45, .85, -.05, '#2A2A2A'), B(.2, .22, .1, s * .45, .82, .08, '#FF9FB5')]; }) });
  S('hat_chef', 'Chef Hat', 'hat', 80, 'Cooking up something big.', { parts: [B(1.4, .3, 1.4, 0, .8, 0, '#FFFFFF'), B(1.7, .8, 1.7, 0, 1.35, 0, '#FFFFFF')] });
  S('hat_cowboy', 'Cowboy Hat', 'hat', 110, 'Howdy, moon traveller.', { parts: [B(2.2, .08, 1.8, 0, .68, 0, '#8D5A2B'), B(1.3, .55, 1.3, 0, .95, 0, '#8D5A2B'), B(1.32, .12, 1.32, 0, .8, 0, '#3B2A1A')] });
  S('hat_phones', 'Headphones', 'hat', 140, 'Always listening to something good.', { parts: [B(1.6, .12, .25, 0, .8, 0, '#222222'), B(.12, .55, .25, -.74, .55, 0, '#222222'), B(.12, .55, .25, .74, .55, 0, '#222222'), B(.3, .62, .55, -.85, .05, 0, '#FF7A00'), B(.3, .62, .55, .85, .05, 0, '#FF7A00')] });
  S('hat_horns', 'Little Horns', 'hat', 150, 'Mostly harmless.', { parts: mirror(function (s) { return [B(.25, .45, .25, s * .42, .85, 0, '#F0E6D2'), B(.15, .35, .15, s * .5, 1.2, 0, '#F0E6D2'), B(.08, .2, .08, s * .55, 1.45, 0, '#F0E6D2')]; }) });
  S('hat_top', 'Top Hat', 'hat', 180, 'Very fancy. Very tall.', { parts: [B(2, .1, 2, 0, .7, 0, '#1B1B1B'), B(1.2, 1.1, 1.2, 0, 1.25, 0, '#1B1B1B'), B(1.22, .22, 1.22, 0, .9, 0, '#FF7A00')] });
  S('hat_wizard', 'Wizard Hat', 'hat', 220, 'Pointy. Mysterious. Purple.', { parts: [B(1.9, .1, 1.9, 0, .7, 0, '#5B2A86'), B(1.3, .5, 1.3, 0, .98, 0, '#5B2A86'), B(.9, .5, .9, 0, 1.48, 0, '#5B2A86'), B(.5, .5, .5, 0, 1.95, 0, '#5B2A86'), B(.25, .4, .25, 0, 2.4, 0, '#5B2A86'), B(1.32, .15, 1.32, 0, .8, 0, '#FFC107')] });
  S('hat_crown', 'Gold Crown', 'hat', 400, 'Fit for a moon king.', { parts: [B(1.4, .35, 1.4, 0, .8, 0, '#FFC107'), B(.25, .35, .25, -.5, 1.15, -.5, '#FFC107'), B(.25, .35, .25, .5, 1.15, -.5, '#FFC107'), B(.25, .35, .25, -.5, 1.15, .5, '#FFC107'), B(.25, .35, .25, .5, 1.15, .5, '#FFC107'), B(.25, .35, .25, 0, 1.15, 0, '#FFC107'), B(.2, .2, .1, 0, .8, .72, '#E53935', { g: 1 })] });
  S('hat_halo', 'Moon Halo', 'hat', 600, 'A floating ring of moonlight. Limited: you can trade it with other players.',
    { parts: [B(1.4, .08, .14, 0, 1.3, .7, '#FFE9A0', { g: 1 }), B(1.4, .08, .14, 0, 1.3, -.7, '#FFE9A0', { g: 1 }), B(.14, .08, 1.4, .7, 1.3, 0, '#FFE9A0', { g: 1 }), B(.14, .08, 1.4, -.7, 1.3, 0, '#FFE9A0', { g: 1 })] }, { kind: 'limited' });
  S('hat_lunar', 'Lunar Crown', 'hat', 1500, 'Only 100 will ever exist. Each one has its own serial number.',
    { parts: [B(1.4, .35, 1.4, 0, .8, 0, '#CFD8FF'), B(.25, .6, .25, -.5, 1.25, -.5, '#E8ECFF'), B(.25, .6, .25, .5, 1.25, -.5, '#E8ECFF'), B(.25, .6, .25, -.5, 1.25, .5, '#E8ECFF'), B(.25, .6, .25, .5, 1.25, .5, '#E8ECFF'), B(.3, .3, .3, 0, 1.7, 0, '#7DE8FF', { g: 1 }), B(1.42, .06, 1.42, 0, .92, 0, '#7DE8FF', { g: 1 })] }, { kind: 'unique', stock: 100 });
  /* faces */
  [['face_cat', 'Cat Face', 'cat', 30, '#1a1a1a'], ['face_robot', 'Robot', 'robot', 60, '#55CCFF'], ['face_love', 'Heart Eyes', 'love', 40, '#E53935'], ['face_shades', 'Cool Shades', 'shades', 50, '#1a1a1a'], ['face_blush', 'Blushing', 'blush', 25, '#1a1a1a'], ['face_uwu', 'UwU', 'uwu', 30, '#1a1a1a']].forEach(function (f) {
    S(f[0], f[1], 'face', f[3], 'A new look for your face.', { expr: f[2], color: f[4] });
  });
  S('face_glitch', 'Glitch', 'face', 300, 'Something is not quite rendering right. Limited edition.', { expr: 'glitch', color: '#FF00AA' }, { kind: 'limited' });
  /* shirts */
  S('shirt_stripes', 'Blue Stripes', 'shirt', 30, 'Sailor approved.', { pattern: 'stripes', c1: '#1976D2', c2: '#FFFFFF' });
  S('shirt_hoodie', 'Night Hoodie', 'shirt', 60, 'Cosy hoodie with a pocket.', { pattern: 'hoodie', c1: '#2B2540', c2: '#FF7A00' });
  S('shirt_stars', 'Starry Tee', 'shirt', 70, 'Wear the night sky.', { pattern: 'stars', c1: '#1B1B3A', c2: '#FFE9A0' });
  S('shirt_checker', 'Red Checker', 'shirt', 40, 'Picnic ready.', { pattern: 'checker', c1: '#D32F2F', c2: '#FFFFFF' });
  S('shirt_heart', 'Heart Tee', 'shirt', 35, 'Spread the love.', { pattern: 'heart', c1: '#EC407A', c2: '#FFFFFF' });
  S('shirt_sunset', 'Sunset Fade', 'shirt', 80, 'Orange to purple.', { pattern: 'gradient', c1: '#FF7A00', c2: '#7B1FA2' });
  S('shirt_jersey', 'Green Jersey', 'shirt', 50, 'Number seven.', { pattern: 'jersey', c1: '#2E7D32', c2: '#FFFFFF' });
  S('shirt_racer', 'Lunar Racer', 'shirt', 250, 'Limited racing tee. Tradeable.', { pattern: 'stripes', c1: '#1B1B1B', c2: '#FF7A00' }, { kind: 'limited' });
  /* pants */
  S('pants_jeans', 'Dark Jeans', 'pants', 20, 'Goes with everything.', { pattern: 'plain', style: 'long', c1: '#1F2A44', c2: '#FFFFFF' });
  S('pants_cargo', 'Cargo Shorts', 'pants', 25, 'Lots of pockets (not really).', { pattern: 'plain', style: 'shorts', c1: '#6D4C41', c2: '#FFFFFF' });
  S('pants_track', 'Track Pants', 'pants', 45, 'Orange side stripe.', { pattern: 'stripe', style: 'long', c1: '#222222', c2: '#FF7A00' });
  S('pants_checker', 'Checker Shorts', 'pants', 40, 'Black and white checks.', { pattern: 'checker', style: 'shorts', c1: '#222222', c2: '#FFFFFF' });
  S('pants_camo', 'Forest Camo', 'pants', 50, 'You cannot see these.', { pattern: 'patch', style: 'long', c1: '#4B5D3A', c2: '#2F3A24' });
  /* back items (torso-local: back is -z) */
  S('back_pack', 'Orange Backpack', 'back', 90, 'Room for all your stuff.', { parts: [B(1.4, 1.5, .6, 0, .1, -.8, '#FF7A00'), B(1, .5, .2, 0, -.35, -1.15, '#D35400')] });
  S('back_cape', 'Red Cape', 'back', 120, 'Heroic.', { parts: [B(1.8, 2.1, .1, 0, -.05, -.58, '#C62828'), B(2.1, .25, .45, 0, .95, -.35, '#8E1B1B')] });
  S('back_wings', 'Moon Wings', 'back', 350, 'Soft glowing wings.', { parts: mirror(function (s) { return [B(.7, 1.8, .1, s * 1.1, .6, -.75, '#FFFFFF', { r: [0, 0, -s * 20] }), B(.6, 1.4, .1, s * 1.7, .2, -.8, '#E8E8F5', { r: [0, 0, -s * 35] }), B(.5, 1, .1, s * 2.2, -.2, -.85, '#CFD2EA', { r: [0, 0, -s * 50] })]; }) });
  S('back_jet', 'Jetpack', 'back', 280, 'Does not actually fly. Looks great though.', { parts: [Cy(.5, 1.4, .5, -.5, 0, -.8, '#888888'), Cy(.5, 1.4, .5, .5, 0, -.8, '#888888'), B(.3, .4, .3, -.5, -.95, -.8, '#FFB066', { g: 1 }), B(.3, .4, .3, .5, -.95, -.8, '#FFB066', { g: 1 })] });
  /* face gear (head-local) */
  S('acc_shades', 'Sunglasses', 'acc', 70, 'Too cool for the moon.', { parts: [B(.55, .3, .1, -.32, .12, .7, '#111111'), B(.55, .3, .1, .32, .12, .7, '#111111'), B(.3, .08, .1, 0, .18, .7, '#111111'), B(.08, .08, .5, -.64, .18, .4, '#111111'), B(.08, .08, .5, .64, .18, .4, '#111111')] });
  S('acc_round', 'Round Glasses', 'acc', 60, 'Smart looking.', { parts: [B(.5, .5, .08, -.32, .1, .7, '#8D5A2B'), B(.5, .5, .08, .32, .1, .7, '#8D5A2B'), B(.36, .36, .1, -.32, .1, .71, '#CFE8FF', { g: 1 }), B(.36, .36, .1, .32, .1, .71, '#CFE8FF', { g: 1 }), B(.2, .08, .08, 0, .14, .7, '#8D5A2B')] });
  S('acc_stache', 'Mustache', 'acc', 45, 'Distinguished.', { parts: [B(.8, .14, .12, 0, -.2, .7, '#3B2A1A'), B(.18, .2, .12, -.45, -.28, .7, '#3B2A1A'), B(.18, .2, .12, .45, -.28, .7, '#3B2A1A')] });
  S('acc_mask', 'Moon Mask', 'acc', 130, 'A glowing half mask.', { parts: [B(1.34, .45, .08, 0, .1, .68, '#FFE9D2', { g: 1 }), B(.25, .1, .1, -.3, .12, .74, '#111111'), B(.25, .1, .1, .3, .12, .74, '#111111')] });

  D.SEED_ITEMS = seeds;
  D.SEED_MAP = {}; seeds.forEach(function (s) { D.SEED_MAP[s.id] = s; });
  return D;
});
