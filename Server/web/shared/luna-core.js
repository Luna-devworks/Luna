/* Luna core: networking helpers, physics, world building, sandboxed JavaScript scripting. */
(function (global) {
  'use strict';
  var D = global.LunaData;
  var BASE = (document.currentScript && document.currentScript.src) ? document.currentScript.src.replace(/[^\/]*$/, '') : '';
  var Luna = global.Luna = { version: D.VERSION, ORANGE: '#FF7A00', base: BASE, data: D, config: global.LunaConfig || {}, itemCache: {} };

  /* ---------- utils ---------- */
  Luna.isMobile = function () {
    if (global.lunaNative) return false;
    var ua = navigator.userAgent || '';
    return /Android|iPhone|iPad|iPod|Mobile|Silk/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  };
  Luna.loadThree = function () {
    return new Promise(function (res, rej) {
      if (global.THREE) return res(global.THREE);
      function load(src, fail) {
        var s = document.createElement('script');
        s.src = src; s.onload = function () { res(global.THREE); }; s.onerror = fail;
        document.head.appendChild(s);
      }
      load(BASE + 'vendor/three.min.js', function () {
        load('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js', function () {
          rej(new Error('Could not load the 3D engine (three.js). Check your internet connection.'));
        });
      });
    });
  };
  Luna.filter = function (t) { return global.LunaFilter ? global.LunaFilter.filter(t) : t; };
  Luna.esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  Luna.fmt = function (n) { n = Math.floor(Number(n) || 0); return n.toLocaleString ? n.toLocaleString('en-US') : String(n); };
  Luna.ago = function (ts) {
    if (!ts) return 'never';
    var s = Math.max(0, (Date.now() - ts) / 1000);
    if (s < 60) return 'just now'; if (s < 3600) return Math.floor(s / 60) + ' min ago'; if (s < 86400) return Math.floor(s / 3600) + ' h ago';
    if (s < 86400 * 30) return Math.floor(s / 86400) + ' d ago'; return new Date(ts).toLocaleDateString();
  };
  Luna.beep = function (freq, dur) {
    try {
      var AC = global.AudioContext || global.webkitAudioContext; if (!AC) return;
      Luna._ac = Luna._ac || new AC(); var c = Luna._ac, o = c.createOscillator(), g = c.createGain();
      freq = Math.max(80, Math.min(2000, +freq || 440)); dur = Math.max(0.03, Math.min(1, +dur || 0.2));
      o.type = 'square'; o.frequency.value = freq; g.gain.value = 0.07; o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime + dur);
    } catch (e) { }
  };

  /* A server address typed by a player. Local / LAN addresses use http, everything else https (needed for Render etc). */
  Luna.normServer = function (s) {
    s = String(s || '').trim();
    if (!s) return '';
    if (!/^https?:\/\//i.test(s)) {
      var local = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1)/i.test(s) || /^\d+\.\d+\.\d+\.\d+(:\d+)?$/.test(s);
      s = (local ? 'http://' : 'https://') + s;
    }
    return s.replace(/\/+$/, '');
  };
  Luna.wsUrl = function (server) { return server.replace(/^http/i, 'ws') + '/ws'; };
  Luna.api = function (server, path, body, token, timeoutMs) {
    var h = { 'Content-Type': 'application/json' };
    if (token) h.Authorization = 'Bearer ' + token;
    var ctl = global.AbortController ? new AbortController() : null, tm = ctl ? setTimeout(function () { ctl.abort(); }, timeoutMs || 25000) : null;
    return fetch(server + path, { method: body ? 'POST' : 'GET', headers: h, body: body ? JSON.stringify(body) : undefined, signal: ctl ? ctl.signal : undefined })
      .then(function (r) {
        if (tm) clearTimeout(tm);
        return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) { var e = new Error(j.error || ('Server error ' + r.status)); e.status = r.status; throw e; } return j; });
      }, function (e) { if (tm) clearTimeout(tm); throw e; });
  };
  /* free hosting (Render) puts servers to sleep: keep asking until it answers (up to ~90 s) */
  Luna.wake = function (server, onTick) {
    var start = Date.now();
    return new Promise(function (res, rej) {
      (function once() {
        Luna.api(server, '/api/info', null, null, 8000).then(res, function () {
          var s = Math.round((Date.now() - start) / 1000);
          if (s > 90) return rej(new Error('The server did not answer. Check the address, or try again in a minute.'));
          if (onTick) onTick(s); setTimeout(once, 2500);
        });
      })();
    });
  };
  Luna.store = {
    get: function (k, d) { try { var v = localStorage.getItem('luna.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('luna.' + k, JSON.stringify(v)); } catch (e) { } },
    del: function (k) { try { localStorage.removeItem('luna.' + k); } catch (e) { } }
  };
  Luna.session = function () { var s = Luna.store.get('session', null); return s && s.server && s.token ? s : null; };

  /* ---------- data re-exports ---------- */
  ['SKINS', 'FACES', 'HAIRS', 'HAIR_COLORS', 'SHIRT_STYLES', 'PANTS_STYLES', 'PALETTE', 'DEFAULT_AVATAR', 'defaultPlace'].forEach(function (k) { Luna[k] = D[k]; });
  Luna.cleanAvatar = function (a) { return D.cleanAvatar(a, true); };
  Luna.cleanPlace = D.cleanPlace;

  Luna.canvasTex = function (w, h, draw) {
    var THREE = global.THREE, c = document.createElement('canvas'); c.width = w; c.height = h;
    var x = c.getContext('2d'); x.imageSmoothingEnabled = false; draw(x, w, h);
    var t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; return t;
  };

  /* ---------- labels / chat bubbles ---------- */
  function sprite(canvas, sx, sy) {
    var THREE = global.THREE, t = new THREE.CanvasTexture(canvas);
    var s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false }));
    s.scale.set(sx, sy, 1); s.renderOrder = 10; return s;
  }
  Luna.makeLabel = function (name, admin) {
    var c = document.createElement('canvas'); c.width = 512; c.height = 96; var x = c.getContext('2d');
    x.font = 'bold 44px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    var label = (admin ? '★ ' : '') + name, w = Math.min(496, x.measureText(label).width + 40);
    x.fillStyle = 'rgba(10,8,14,.6)'; x.fillRect(256 - w / 2, 12, w, 72);
    x.fillStyle = admin ? '#FFB066' : '#fff'; x.fillText(label, 256, 50);
    return sprite(c, 5.3, 1);
  };
  Luna.makeBubble = function (text) {
    var c = document.createElement('canvas'); c.width = 512; c.height = 256; var x = c.getContext('2d');
    x.font = 'bold 34px sans-serif'; x.textBaseline = 'top';
    var words = String(text).split(/\s+/), lines = [], cur = '';
    words.forEach(function (w) { var n = cur ? cur + ' ' + w : w; if (x.measureText(n).width > 440 && cur) { lines.push(cur); cur = w; } else cur = n; });
    if (cur) lines.push(cur); lines = lines.slice(0, 4);
    var wd = 0; lines.forEach(function (l) { wd = Math.max(wd, x.measureText(l).width); });
    var bw = wd + 40, bh = lines.length * 42 + 28, top = 256 - bh - 20;
    x.fillStyle = '#fff'; x.strokeStyle = '#FF7A00'; x.lineWidth = 6;
    x.beginPath(); x.rect(256 - bw / 2, top, bw, bh); x.fill(); x.stroke();
    x.beginPath(); x.moveTo(240, top + bh); x.lineTo(256, top + bh + 18); x.lineTo(272, top + bh); x.fill();
    x.fillStyle = '#222'; x.textAlign = 'center'; lines.forEach(function (l, i) { x.fillText(l, 256, top + 14 + i * 42); });
    return sprite(c, 6, 3);
  };

  /* ---------- physics (axis-aligned boxes) ---------- */
  Luna.PW = 0.8; Luna.PH = 5.2; Luna.GRAV = -110; Luna.JUMP = 38; Luna.WALK = 16;
  Luna.partBox = function (p) {
    var a = (p.rot || 0) * Math.PI / 180, c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a));
    var hx = (c * p.size[0] + s * p.size[2]) / 2, hz = (s * p.size[0] + c * p.size[2]) / 2, hy = p.size[1] / 2;
    return { part: p, minx: p.pos[0] - hx, maxx: p.pos[0] + hx, miny: p.pos[1] - hy, maxy: p.pos[1] + hy, minz: p.pos[2] - hz, maxz: p.pos[2] + hz };
  };
  /* is the player standing in / touching this part? (margin makes standing on top count) */
  Luna.touching = function (s, b, m) {
    return s.x + Luna.PW > b.minx - m && s.x - Luna.PW < b.maxx + m && s.z + Luna.PW > b.minz - m && s.z - Luna.PW < b.maxz + m && s.y + Luna.PH > b.miny - m && s.y < b.maxy + m;
  };
  function hit(p, b) {
    var e = 1e-4;
    return p.x + Luna.PW > b.minx + e && p.x - Luna.PW < b.maxx - e && p.z + Luna.PW > b.minz + e && p.z - Luna.PW < b.maxz - e && p.y + Luna.PH > b.miny + e && p.y < b.maxy - e;
  }
  Luna.stepPlayer = function (p, boxes, dt) {
    var n = Math.max(1, Math.ceil(dt / 0.016)), h = dt / n, i, j, b;
    for (i = 0; i < n; i++) {
      p.vy += Luna.GRAV * h;
      p.x += p.vx * h;
      for (j = 0; j < boxes.length; j++) { b = boxes[j]; if (hit(p, b)) { if (b.maxy - p.y <= 1.2 && b.maxy - p.y > 0) { p.y = b.maxy; } else p.x = p.vx > 0 ? b.minx - Luna.PW : b.maxx + Luna.PW; } }
      p.z += p.vz * h;
      for (j = 0; j < boxes.length; j++) { b = boxes[j]; if (hit(p, b)) { if (b.maxy - p.y <= 1.2 && b.maxy - p.y > 0) { p.y = b.maxy; } else p.z = p.vz > 0 ? b.minz - Luna.PW : b.maxz + Luna.PW; } }
      p.y += p.vy * h; p.onGround = false;
      for (j = 0; j < boxes.length; j++) {
        b = boxes[j];
        if (hit(p, b)) { if (p.vy <= 0) { p.y = b.maxy; p.onGround = true; } else p.y = b.miny - Luna.PH; p.vy = 0; }
      }
    }
  };

  /* ---------- worlds ---------- */
  function gridTex(color) {
    var THREE = global.THREE;
    var t = Luna.canvasTex(64, 64, function (x) { x.fillStyle = color; x.fillRect(0, 0, 64, 64); x.fillStyle = 'rgba(255,255,255,.9)'; x.fillRect(0, 0, 32, 32); x.fillRect(32, 32, 32, 32); });
    t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  }
  function partMat(p) {
    var THREE = global.THREE, opt = { color: p.color, transparent: p.alpha < 1, opacity: p.alpha };
    if (p.mat === 'neon') return new THREE.MeshBasicMaterial(opt);
    if (p.mat === 'metal') { opt.shininess = 90; opt.specular = 0x999999; return new THREE.MeshPhongMaterial(opt); }
    return new THREE.MeshLambertMaterial(opt);
  }
  Luna.buildPlace = function (placeIn) {
    var THREE = global.THREE, place = Luna.cleanPlace(placeIn), group = new THREE.Group(), meshes = {}, boxes = [];
    var world = { place: place, group: group, meshes: meshes, boxes: boxes };
    function build(p) {
      var geo = p.type === 'sphere' ? new THREE.SphereGeometry(0.5, 24, 16) : p.type === 'cylinder' ? new THREE.CylinderGeometry(0.5, 0.5, 1, 28) : new THREE.BoxGeometry(1, 1, 1);
      var mat = partMat(p);
      if (p.tex === 'grid' && p.type === 'box') {
        var gt = gridTex(p.color); gt.repeat.set(p.size[0] / 8, p.size[2] / 8);
        mat = [mat, mat, new THREE.MeshLambertMaterial({ map: gt }), mat, mat, mat];
      }
      var m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; m.userData.partId = p.id;
      meshes[p.id] = m; group.add(m); world.sync(p);
    }
    world.sync = function (p) {
      var m = meshes[p.id]; if (!m) return;
      m.position.set(p.pos[0], p.pos[1], p.pos[2]); m.scale.set(p.size[0], p.size[1], p.size[2]); m.rotation.y = (p.rot || 0) * Math.PI / 180;
      var mats = Array.isArray(m.material) ? m.material : [m.material];
      mats.forEach(function (mt) { if (mt.map) return; mt.color.set(p.color); mt.opacity = p.alpha; mt.transparent = p.alpha < 1; });
      world.rebuildBoxes();
    };
    world.rebuildBoxes = function () { boxes.length = 0; place.parts.forEach(function (p) { if (p.collide) boxes.push(Luna.partBox(p)); }); };
    world.add = function (p) { place.parts.push(p); build(p); };
    world.remove = function (p) {
      var m = meshes[p.id]; if (m) { group.remove(m); m.geometry.dispose(); delete meshes[p.id]; }
      var i = place.parts.indexOf(p); if (i >= 0) place.parts.splice(i, 1); world.rebuildBoxes();
    };
    world.rebuildMesh = function (p) { var m = meshes[p.id]; if (m) { group.remove(m); m.geometry.dispose(); delete meshes[p.id]; } build(p); };
    place.parts.forEach(build); world.rebuildBoxes();
    return world;
  };

  Luna.buildSky = function (scene, renderer, shadows) {
    var THREE = global.THREE;
    scene.add(new THREE.HemisphereLight(0xffffff, 0xffc9a0, 0.75));
    var sun = new THREE.DirectionalLight(0xffffff, 0.75); sun.position.set(60, 100, 40);
    if (shadows) {
      sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
      var c = sun.shadow.camera; c.left = -80; c.right = 80; c.top = 80; c.bottom = -80; c.near = 1; c.far = 300;
    }
    scene.add(sun); scene.add(sun.target);
    var moon = new THREE.Mesh(new THREE.SphereGeometry(14, 24, 16), new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false }));
    moon.position.set(-260, 190, -420); scene.add(moon);
    var clouds = [], cm = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.92 });
    for (var i = 0; i < 14; i++) {
      var cl = new THREE.Group(), n = 3 + Math.floor(Math.random() * 3);
      for (var j = 0; j < n; j++) { var b = new THREE.Mesh(new THREE.BoxGeometry(10 + Math.random() * 10, 4, 8 + Math.random() * 6), cm); b.position.set(j * 9 - n * 4, Math.random() * 2, Math.random() * 4); cl.add(b); }
      cl.position.set((Math.random() - 0.5) * 500, 70 + Math.random() * 40, (Math.random() - 0.5) * 500); scene.add(cl); clouds.push(cl);
    }
    return {
      sun: sun, moon: moon,
      update: function (dt, focus) {
        clouds.forEach(function (c) { c.position.x += dt * 2; if (c.position.x > 280) c.position.x = -280; });
        if (focus) { sun.position.set(focus.x + 60, focus.y + 100, focus.z + 40); sun.target.position.set(focus.x, focus.y, focus.z); }
      }
    };
  };

  /* ---------- JavaScript scripting: runs inside a sandboxed Web Worker ----------
     Player-made scripts never touch the page: no DOM, no storage, no network. They talk to the game through
     a small API and every request they make is validated here before it is applied. */
  function workerMain() {
    'use strict';
    var post = self.postMessage.bind(self);
    ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'importScripts', 'indexedDB', 'caches', 'BroadcastChannel', 'Worker', 'SharedWorker', 'postMessage', 'navigator', 'location'].forEach(function (k) {
      var o = self;
      while (o && o !== Object.prototype) { try { Object.defineProperty(o, k, { value: undefined, writable: false, configurable: false }); } catch (e) { } o = Object.getPrototypeOf(o); }
    });
    var C = { PW: 0.8, PH: 5.2 };
    var parts = {}, order = [], updates = [], chats = [], touches = [], timers = [], stats = {}, time = 0, ops = [], sets = {}, nid = 1, created = 0, pl = { name: 'Player', x: 0, y: 0, z: 0 };
    function emit(o) { if (ops.length < 1200) ops.push(o); }
    function emitSet(id, k, v) { sets[id + '|' + k] = { op: 'set', id: id, k: k, v: v }; }
    function box(p) {
      var a = (p.rot || 0) * Math.PI / 180, c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a));
      var hx = (c * p.size[0] + s * p.size[2]) / 2, hz = (s * p.size[0] + c * p.size[2]) / 2, hy = p.size[1] / 2;
      return { minx: p.pos[0] - hx, maxx: p.pos[0] + hx, miny: p.pos[1] - hy, maxy: p.pos[1] + hy, minz: p.pos[2] - hz, maxz: p.pos[2] + hz };
    }
    function n3(v, d) { return [+(v && v.x) || d, +(v && v.y) || d, +(v && v.z) || d]; }
    function proxy(p) {
      if (p._px) return p._px;
      var o = {
        onTouch: function (fn) { if (typeof fn === 'function' && touches.length < 400) touches.push({ p: p, fn: fn, inside: false }); },
        destroy: function () { if (p._dead) return; p._dead = true; delete parts[p.id]; emit({ op: 'destroy', id: p.id }); }
      };
      Object.defineProperties(o, {
        name: { get: function () { return p.name; } },
        position: { get: function () { return { x: p.pos[0], y: p.pos[1], z: p.pos[2] }; }, set: function (v) { p.pos = n3(v, 0); emitSet(p.id, 'pos', p.pos.slice()); } },
        size: { get: function () { return { x: p.size[0], y: p.size[1], z: p.size[2] }; }, set: function (v) { p.size = n3(v, 1).map(function (n) { return Math.max(0.05, n); }); emitSet(p.id, 'size', p.size.slice()); } },
        rotation: { get: function () { return p.rot; }, set: function (v) { p.rot = +v || 0; emitSet(p.id, 'rot', p.rot); } },
        color: { get: function () { return p.color; }, set: function (v) { if (/^#[0-9a-fA-F]{6}$/.test(v)) { p.color = v; emitSet(p.id, 'color', v); } } },
        transparency: { get: function () { return 1 - p.alpha; }, set: function (v) { p.alpha = Math.min(1, Math.max(0, 1 - (+v || 0))); emitSet(p.id, 'alpha', p.alpha); } },
        canCollide: { get: function () { return p.collide; }, set: function (v) { p.collide = !!v; emitSet(p.id, 'collide', p.collide); } }
      });
      p._px = o; return o;
    }
    var player = {
      get name() { return pl.name; },
      get position() { return { x: pl.x, y: pl.y, z: pl.z }; },
      teleport: function (x, y, z) { emit({ op: 'tp', x: +x || 0, y: +y || 0, z: +z || 0 }); },
      kill: function () { emit({ op: 'kill' }); },
      setSpeed: function (v) { emit({ op: 'speed', v: +v || 16 }); },
      setJumpPower: function (v) { emit({ op: 'jump', v: +v || 38 }); }
    };
    var game = {
      time: 0, player: player, random: Math.random,
      findPart: function (name) { for (var i = 0; i < order.length; i++) { var p = parts[order[i]]; if (p && p.name === name) return proxy(p); } return null; },
      getParts: function () { var r = []; order.forEach(function (id) { if (parts[id]) r.push(proxy(parts[id])); }); return r; },
      createPart: function (o) {
        if (created >= 300) return null; created++; o = o || {};
        var id = 's' + (nid++) + Math.random().toString(36).slice(2, 5);
        var p = { id: id, name: String(o.name || 'Part').slice(0, 40), type: (o.type === 'sphere' || o.type === 'cylinder') ? o.type : 'box', pos: o.position ? n3(o.position, 0) : [0, 5, 0], size: o.size ? n3(o.size, 1).map(function (n) { return Math.max(0.05, n); }) : [4, 1, 4], rot: +o.rotation || 0, color: /^#[0-9a-fA-F]{6}$/.test(o.color) ? o.color : '#FF7A00', alpha: 1, collide: o.canCollide !== false, kind: 'none', mat: 'plastic', tex: '' };
        parts[id] = p; order.push(id); emit({ op: 'create', part: p }); return proxy(p);
      },
      onUpdate: function (fn) { if (typeof fn === 'function' && updates.length < 100) updates.push(fn); },
      onChat: function (fn) { if (typeof fn === 'function' && chats.length < 100) chats.push(fn); },
      after: function (sec, fn) { if (typeof fn === 'function' && timers.length < 300) timers.push({ t: Math.max(0, +sec || 0), fn: fn, rep: 0 }); },
      every: function (sec, fn) { if (typeof fn === 'function' && timers.length < 300) timers.push({ t: Math.max(0.05, +sec || 1), fn: fn, rep: Math.max(0.05, +sec || 1) }); },
      say: function (m) { emit({ op: 'say', text: String(m).slice(0, 200) }); },
      setStat: function (k, v) { k = String(k).slice(0, 20); stats[k] = v; emit({ op: 'stat', k: k, v: String(v).slice(0, 20) }); },
      getStat: function (k) { return stats[String(k).slice(0, 20)]; },
      sound: function (f, d) { emit({ op: 'sound', f: +f || 440, d: +d || 0.2 }); }
    };
    var con = { log: function () { emit({ op: 'log', text: Array.prototype.join.call(arguments, ' ').slice(0, 300) }); } };
    function guard(fn, a, b) { try { fn(a, b); } catch (e) { emit({ op: 'error', text: String(e && e.message || e) }); } }
    function finish() {
      for (var k in sets) { emit(sets[k]); } sets = {};
      var o = ops; ops = []; post({ t: 'done', ops: o });
    }
    self.onmessage = function (e) {
      var m = e.data;
      try {
        if (m.t === 'init') {
          C = m.consts; pl.name = m.name || 'Player';
          m.parts.forEach(function (p) { parts[p.id] = p; order.push(p.id); });
          m.scripts.forEach(function (s) {
            try { new Function('game', 'console', '"use strict";\n' + s.code)(game, con); }
            catch (er) { emit({ op: 'error', text: '[' + s.name + '] ' + (er && er.message) }); }
          });
        } else if (m.t === 'tick') {
          time += m.dt; game.time = time; pl.x = m.x; pl.y = m.y; pl.z = m.z;
          updates.forEach(function (f) { guard(f, m.dt); });
          for (var i = timers.length - 1; i >= 0; i--) {
            var t = timers[i]; t.t -= m.dt;
            if (t.t <= 0) { guard(t.fn); if (t.rep) t.t += t.rep; else timers.splice(i, 1); }
          }
          touches.forEach(function (t) {
            if (t.p._dead) return; var b = box(t.p);
            var inside = pl.x + C.PW > b.minx - 0.3 && pl.x - C.PW < b.maxx + 0.3 && pl.z + C.PW > b.minz - 0.3 && pl.z - C.PW < b.maxz + 0.3 && pl.y + C.PH > b.miny - 0.3 && pl.y < b.maxy + 0.3;
            if (inside && !t.inside) guard(t.fn, player);
            t.inside = inside;
          });
        } else if (m.t === 'chat') {
          chats.forEach(function (f) { guard(f, m.name, m.text); });
        }
      } catch (er) { emit({ op: 'error', text: String(er && er.message || er) }); }
      finish();
    };
  }

  Luna.ScriptHost = function (world, opts) {
    opts = opts || {};
    var self = this, worker = null, url = null, pending = 0, acc = 0, since = 0, idx = {}, createdN = 0;
    this.errors = [];
    function log(m) { if (opts.log) opts.log(m); }
    function v3(v, lo) { if (!Array.isArray(v) || v.length < 3) return null; var r = []; for (var i = 0; i < 3; i++) { var n = Number(v[i]); if (!isFinite(n)) return null; n = Math.max(-100000, Math.min(100000, n)); if (lo !== undefined) n = Math.max(lo, n); r.push(n); } return r; }
    world.place.parts.forEach(function (p) { idx[p.id] = p; });

    function apply(o) {
      if (!o || typeof o !== 'object') return;
      var p, n;
      switch (o.op) {
        case 'set':
          p = idx[o.id]; if (!p) return;
          if (o.k === 'pos' && (n = v3(o.v))) p.pos = n;
          else if (o.k === 'size' && (n = v3(o.v, 0.05))) p.size = n;
          else if (o.k === 'rot' && isFinite(+o.v)) p.rot = +o.v;
          else if (o.k === 'color' && /^#[0-9a-fA-F]{6}$/.test(o.v)) p.color = o.v;
          else if (o.k === 'alpha' && isFinite(+o.v)) p.alpha = Math.min(1, Math.max(0, +o.v));
          else if (o.k === 'collide') p.collide = !!o.v;
          else return;
          world.sync(p); break;
        case 'create':
          if (createdN >= 300 || !o.part) return;
          p = Luna.cleanPlace({ parts: [o.part] }).parts[0]; if (!p || idx[p.id]) return;
          createdN++; idx[p.id] = p; world.add(p); break;
        case 'destroy': p = idx[o.id]; if (p) { world.remove(p); delete idx[o.id]; } break;
        case 'say': if (opts.say) opts.say(String(o.text).slice(0, 200)); break;
        case 'log': log(String(o.text)); break;
        case 'error': self.errors.push(String(o.text)); log('ERROR ' + o.text); break;
        case 'tp': if (opts.teleport && isFinite(+o.x) && isFinite(+o.y) && isFinite(+o.z)) opts.teleport(+o.x, +o.y, +o.z); break;
        case 'kill': if (opts.kill) opts.kill(); break;
        case 'speed': if (opts.setSpeed) opts.setSpeed(Math.max(4, Math.min(60, +o.v || 16))); break;
        case 'jump': if (opts.setJump) opts.setJump(Math.max(10, Math.min(120, +o.v || 38))); break;
        case 'stat': if (opts.stat) opts.stat(String(o.k).slice(0, 20), String(o.v).slice(0, 20)); break;
        case 'sound': Luna.beep(o.f, o.d); break;
      }
    }
    this.run = function () {
      if (!world.place.scripts.some(function (s) { return s.code.trim(); })) return;
      try {
        url = URL.createObjectURL(new Blob(['(' + workerMain.toString() + ')()'], { type: 'text/javascript' }));
        worker = new Worker(url);
      } catch (e) { self.errors.push('Scripts are not available here: ' + e.message); log('ERROR ' + e.message); return; }
      worker.onmessage = function (e) { pending = Math.max(0, pending - 1); since = performance.now(); var m = e.data; if (m && m.ops) m.ops.forEach(apply); };
      worker.onerror = function (e) { self.errors.push(e.message || 'Script error'); log('ERROR ' + (e.message || 'Script error')); pending = Math.max(0, pending - 1); };
      var slim = world.place.parts.map(function (p) { return { id: p.id, name: p.name, type: p.type, pos: p.pos.slice(), size: p.size.slice(), rot: p.rot, color: p.color, alpha: p.alpha, collide: p.collide }; });
      pending++; since = performance.now();
      worker.postMessage({ t: 'init', consts: { PW: Luna.PW, PH: Luna.PH }, name: opts.playerName ? opts.playerName() : 'Player', parts: slim, scripts: world.place.scripts });
    };
    this.chat = function (name, text) { if (worker) { pending++; worker.postMessage({ t: 'chat', name: String(name), text: String(text) }); } };
    this.tick = function (dt) {
      if (!worker) return; acc += dt;
      if (pending > 0) {
        if (performance.now() - since > 4000) { self.errors.push('A script ran too long and was stopped.'); log('ERROR A script ran too long and was stopped.'); self.stop(); }
        return;
      }
      var s = opts.playerState(); pending++; since = performance.now();
      worker.postMessage({ t: 'tick', dt: Math.min(acc, 0.25), x: s.x, y: s.y, z: s.z }); acc = 0;
    };
    this.stop = function () { if (worker) { try { worker.terminate(); } catch (e) { } worker = null; } if (url) { try { URL.revokeObjectURL(url); } catch (e) { } url = null; } };
  };
})(window);
