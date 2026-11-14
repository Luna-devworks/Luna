/* Luna avatars: blocky 3D avatar builder, shop-item rendering (3D parts) and 2D item icons. */
(function (global) {
  'use strict';
  var Luna = global.Luna, D = global.LunaData;

  Luna.itemDef = function (id, av) {
    if (!id) return null;
    return (av && av.defs && av.defs[id]) || Luna.itemCache[id] || D.SEED_MAP[id] || null;
  };
  Luna.randomAvatar = function () {
    function r(l) { return l[Math.floor(Math.random() * l.length)]; }
    return Luna.cleanAvatar({ skin: r(Luna.SKINS), face: r(Luna.FACES), hair: r(Luna.HAIRS), hairColor: r(Luna.HAIR_COLORS), shirt: r(Luna.PALETTE), shirtStyle: r(Luna.SHIRT_STYLES), pants: r(Luna.PALETTE), pantsStyle: r(Luna.PANTS_STYLES), shoes: r(Luna.PALETTE) });
  };

  /* ---------- 2D texture painters (shared by the 3D model and the 2D shop icons) ---------- */
  function pix(x, rows, ox, oy, s, color) { x.fillStyle = color; rows.forEach(function (r, j) { for (var i = 0; i < r.length; i++) if (r[i] === '1') x.fillRect(ox + i * s, oy + j * s, s, s); }); }
  var HEART = ['0110110', '1111111', '1111111', '0111110', '0011100', '0001000'];

  function drawFace(x, kind, skin, color) {
    x.fillStyle = skin; x.fillRect(0, 0, 128, 128);
    var K = color || '#1a1a1a'; x.fillStyle = K; x.strokeStyle = K; x.lineWidth = 9; x.lineCap = 'square';
    function eyes(h) { x.fillRect(30, 44, 16, h); x.fillRect(82, 44, 16, h); }
    function smile() { x.fillRect(38, 92, 52, 8); x.fillRect(30, 84, 10, 10); x.fillRect(88, 84, 10, 10); }
    if (kind === 'smile') { eyes(24); smile(); }
    else if (kind === 'happy') {
      [[28, 66], [80, 66]].forEach(function (p) { x.beginPath(); x.moveTo(p[0], p[1]); x.lineTo(p[0] + 10, p[1] - 14); x.lineTo(p[0] + 20, p[1]); x.stroke(); });
      x.fillRect(38, 82, 52, 26); x.fillStyle = '#e53935'; x.fillRect(48, 96, 32, 12);
    } else if (kind === 'cool') {
      x.fillRect(18, 42, 92, 26); x.fillStyle = '#fff'; x.fillRect(28, 46, 10, 6); x.fillRect(80, 46, 10, 6); x.fillStyle = K;
      x.fillRect(44, 92, 40, 8); x.fillRect(80, 86, 10, 8);
    } else if (kind === 'wink') { x.fillRect(30, 44, 16, 24); x.fillRect(80, 60, 20, 8); smile(); }
    else if (kind === 'surprised') { x.fillRect(28, 38, 20, 28); x.fillRect(80, 38, 20, 28); x.fillRect(52, 84, 24, 28); x.fillStyle = skin; x.fillRect(58, 90, 12, 16); }
    else if (kind === 'tongue') { eyes(24); x.fillRect(36, 88, 56, 8); x.fillStyle = '#e53935'; x.fillRect(66, 94, 18, 20); }
    else if (kind === 'angry') {
      eyes(20); x.lineWidth = 8; x.beginPath(); x.moveTo(24, 34); x.lineTo(50, 46); x.moveTo(104, 34); x.lineTo(78, 46); x.stroke();
      x.fillRect(40, 92, 48, 8); x.fillRect(34, 98, 10, 10); x.fillRect(84, 98, 10, 10);
    } else if (kind === 'sleepy') { x.fillRect(26, 58, 22, 8); x.fillRect(80, 58, 22, 8); x.fillRect(52, 92, 24, 8); }
    else if (kind === 'cat') {
      x.fillRect(28, 48, 14, 26); x.fillRect(86, 48, 14, 26); x.fillStyle = '#ff8fa8'; x.fillRect(58, 76, 12, 8);
      x.fillStyle = K; x.fillRect(46, 90, 16, 6); x.fillRect(66, 90, 16, 6); x.lineWidth = 4;
      x.beginPath(); x.moveTo(2, 68); x.lineTo(28, 76); x.moveTo(2, 86); x.lineTo(28, 82); x.moveTo(126, 68); x.lineTo(100, 76); x.moveTo(126, 86); x.lineTo(100, 82); x.stroke();
    } else if (kind === 'robot') {
      x.fillStyle = '#111'; x.fillRect(12, 34, 104, 44); x.fillStyle = K; x.fillRect(26, 46, 24, 18); x.fillRect(78, 46, 24, 18);
      x.fillStyle = '#333'; x.fillRect(30, 90, 68, 24); x.fillStyle = K; for (var i = 0; i < 5; i++) x.fillRect(36 + i * 13, 94, 5, 16);
    } else if (kind === 'love') {
      pix(x, HEART, 16, 36, 7, K); pix(x, HEART, 70, 36, 7, K);
      x.fillStyle = '#1a1a1a'; x.fillRect(38, 96, 52, 8); x.fillRect(30, 88, 10, 10); x.fillRect(88, 88, 10, 10);
    } else if (kind === 'shades') {
      x.fillStyle = '#1a1a1a'; x.fillRect(10, 40, 108, 8); x.fillRect(16, 44, 42, 28); x.fillRect(70, 44, 42, 28);
      x.fillStyle = '#9fd8ff'; x.fillRect(22, 50, 14, 6); x.fillRect(76, 50, 14, 6);
      x.fillStyle = '#1a1a1a'; x.fillRect(38, 94, 52, 8); x.fillRect(30, 86, 10, 10); x.fillRect(88, 86, 10, 10);
    } else if (kind === 'blush') {
      eyes(24); smile(); x.fillStyle = 'rgba(255,90,130,.7)'; x.fillRect(14, 70, 24, 14); x.fillRect(90, 70, 24, 14);
    } else if (kind === 'uwu') {
      x.lineWidth = 8; [[24, 62], [78, 62]].forEach(function (p) { x.beginPath(); x.moveTo(p[0], p[1]); x.lineTo(p[0] + 12, p[1] - 14); x.lineTo(p[0] + 24, p[1]); x.stroke(); });
      x.lineWidth = 6; x.beginPath(); x.moveTo(40, 88); x.lineTo(52, 100); x.lineTo(64, 90); x.lineTo(76, 100); x.lineTo(88, 88); x.stroke();
      x.fillStyle = 'rgba(255,90,130,.7)'; x.fillRect(12, 72, 22, 12); x.fillRect(94, 72, 22, 12);
    } else if (kind === 'glitch') {
      x.fillStyle = '#00FFFF'; x.fillRect(24, 44, 16, 24); x.fillRect(76, 44, 16, 24); x.fillStyle = K; x.fillRect(34, 44, 16, 24); x.fillRect(86, 44, 16, 24);
      x.lineWidth = 7; x.strokeStyle = '#1a1a1a'; x.beginPath(); x.moveTo(30, 96); x.lineTo(46, 88); x.lineTo(62, 100); x.lineTo(78, 88); x.lineTo(98, 96); x.stroke();
      x.fillStyle = 'rgba(255,0,170,.45)'; x.fillRect(0, 70, 128, 8); x.fillStyle = 'rgba(0,255,255,.35)'; x.fillRect(0, 104, 128, 6);
    } else { eyes(24); smile(); }
  }
  function drawShirt(x, st, c1, c2, skin) {
    var w = 64, h = 64, y, r, c; x.fillStyle = c1; x.fillRect(0, 0, w, h);
    if (st === 'stripes') { x.fillStyle = c2; for (y = 6; y < h; y += 16) x.fillRect(0, y, w, 7); }
    else if (st === 'luna') { x.fillStyle = c2; x.beginPath(); x.arc(32, 32, 16, 0, 7); x.fill(); x.fillStyle = c1; x.beginPath(); x.arc(40, 27, 14, 0, 7); x.fill(); }
    else if (st === 'jersey') { x.fillStyle = c2; x.fillRect(0, 0, w, 6); x.font = 'bold 34px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('7', 32, 38); }
    else if (st === 'pocket') { x.fillStyle = 'rgba(0,0,0,.22)'; x.fillRect(38, 14, 18, 18); x.fillStyle = c1; x.fillRect(40, 16, 14, 14); }
    else if (st === 'vneck') { x.fillStyle = skin || '#F1C27D'; x.beginPath(); x.moveTo(18, 0); x.lineTo(46, 0); x.lineTo(32, 20); x.closePath(); x.fill(); }
    else if (st === 'checker') { x.fillStyle = c2; for (r = 0; r < h; r += 16) for (c = 0; c < w; c += 16) if (((r + c) / 16) % 2 === 0) x.fillRect(c, r, 16, 16); }
    else if (st === 'stars') { x.fillStyle = c2; [[10, 10], [40, 8], [26, 24], [50, 34], [14, 44], [36, 52], [56, 56]].forEach(function (p) { x.fillRect(p[0], p[1], 4, 4); x.fillRect(p[0] + 1, p[1] - 2, 2, 8); x.fillRect(p[0] - 2, p[1] + 1, 8, 2); }); }
    else if (st === 'hoodie') { x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(10, 38, 44, 18); x.fillStyle = c2; x.fillRect(24, 0, 4, 18); x.fillRect(36, 0, 4, 18); }
    else if (st === 'gradient') { var g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, c1); g.addColorStop(1, c2); x.fillStyle = g; x.fillRect(0, 0, w, h); }
    else if (st === 'heart') { pix(x, HEART, 14, 16, 5, c2); }
  }
  function drawPants(x, pat, style, c1, c2, skin, shoes) {
    var short = style === 'shorts', ph = short ? 13 : 32;
    x.fillStyle = short ? skin : c1; x.fillRect(0, 0, 16, 32);
    if (short) { x.fillStyle = c1; x.fillRect(0, 0, 16, 13); }
    x.fillStyle = c2;
    if (pat === 'stripe') x.fillRect(0, 0, 3, ph);
    else if (pat === 'checker') { for (var r = 0; r < ph; r += 8) for (var c = 0; c < 16; c += 8) if (((r + c) / 8) % 2 === 0) x.fillRect(c, r, 8, 8); }
    else if (pat === 'patch') { [[1, 3, 6, 5], [8, 10, 6, 6], [3, 18, 7, 5], [9, 24, 5, 3], [2, 26, 5, 4]].forEach(function (q) { if (q[1] < ph) x.fillRect(q[0], q[1], q[2], Math.min(q[3], ph - q[1])); }); }
    x.fillStyle = shoes || '#FFFFFF'; x.fillRect(0, 26, 16, 6);
  }
  Luna.draw = { face: drawFace, shirt: drawShirt, pants: drawPants };

  /* ---------- 3D avatar ---------- */
  function addParts(parent, d, L) {
    var THREE = global.THREE;
    ((d.data && d.data.parts) || []).forEach(function (p) {
      var geo = p.t === 'c' ? new THREE.CylinderGeometry(0.5, 0.5, 1, 16) : p.t === 's' ? new THREE.SphereGeometry(0.5, 14, 10) : new THREE.BoxGeometry(1, 1, 1);
      var mat = p.g ? new THREE.MeshBasicMaterial({ color: p.c }) : L({ color: p.c });
      var m = new THREE.Mesh(geo, mat); m.scale.set(p.s[0], p.s[1], p.s[2]); m.position.set(p.p[0], p.p[1], p.p[2]);
      if (p.r) m.rotation.set(p.r[0] * Math.PI / 180, p.r[1] * Math.PI / 180, p.r[2] * Math.PI / 180);
      m.castShadow = true; parent.add(m);
    });
  }

  Luna.buildAvatar = function (avIn) {
    var THREE = global.THREE, av = Luna.cleanAvatar(avIn), g = new THREE.Group(), tex = Luna.canvasTex;
    g.userData.av = av;
    function L(o) { return new THREE.MeshLambertMaterial(o); }
    function mesh(w, h, d, mat, x, y, z, parent) {
      var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = true; (parent || g).add(m); return m;
    }
    function worn(slot) { var d = Luna.itemDef(av.eq[slot], av); return d && d.slot === slot && d.data ? d : null; }
    var iShirt = worn('shirt'), iPants = worn('pants'), iFace = worn('face'), iHat = worn('hat'), iAcc = worn('acc'), iBack = worn('back');
    var sC = iShirt ? iShirt.data.c1 : av.shirt, sC2 = iShirt ? iShirt.data.c2 : '#FFFFFF', sP = iShirt ? iShirt.data.pattern : av.shirtStyle;
    var pC = iPants ? iPants.data.c1 : av.pants, pC2 = iPants ? iPants.data.c2 : '#FFFFFF', pP = iPants ? iPants.data.pattern : 'plain', pS = iPants ? iPants.data.style : av.pantsStyle;

    var skin = L({ color: av.skin }), shirtM = L({ color: sC }), hairM = L({ color: av.hairColor }), H = 1.3;
    var side = L({ map: tex(64, 64, function (x) { x.fillStyle = sC; x.fillRect(0, 0, 64, 64); }) });
    var front = L({ map: tex(64, 64, function (x) { drawShirt(x, sP, sC, sC2, av.skin); }) });
    var torso = mesh(2, 2, 1, [side, side, shirtM, L({ color: pC }), front, side], 0, 3, 0);
    var faceM = L({ map: tex(128, 128, function (x) { iFace ? drawFace(x, iFace.data.expr, av.skin, iFace.data.color) : drawFace(x, av.face, av.skin); }) });
    var head = mesh(H, H, H, [skin, skin, skin, skin, faceM, skin], 0, 4 + H / 2, 0);
    g.userData.head = head;
    var shortSleeve = (sP === 'jersey' || sP === 'pocket');
    var armTex = L({ map: tex(16, 32, function (x) { x.fillStyle = av.skin; x.fillRect(0, 0, 16, 32); x.fillStyle = sC; x.fillRect(0, 0, 16, shortSleeve ? 14 : 24); }) });
    function arm(sx) { var p = new THREE.Group(); p.position.set(sx, 4, 0); g.add(p); mesh(1, 2, 1, [armTex, armTex, shirtM, skin, armTex, armTex], 0, -1, 0, p); return p; }
    g.userData.armL = arm(-1.5); g.userData.armR = arm(1.5);
    var legTex = L({ map: tex(16, 32, function (x) { drawPants(x, pP, pS, pC, pC2, av.skin, av.shoes); }) });
    function leg(sx) { var p = new THREE.Group(); p.position.set(sx, 2, 0); g.add(p); mesh(1, 2, 1, [legTex, legTex, L({ color: pC }), L({ color: av.shoes }), legTex, legTex], 0, -1, 0, p); return p; }
    g.userData.legL = leg(-0.5); g.userData.legR = leg(0.5);

    var t = H / 2;
    function hm(w, h, d, x, y, z, m) { return mesh(w, h, d, m || hairM, x, y, z, head); }
    var hs = av.hair;
    if (iHat && (hs === 'afro' || hs === 'mohawk' || hs === 'bun' || hs === 'spiky')) hs = 'short';
    if (hs !== 'none') {
      if (hs !== 'mohawk' && hs !== 'afro') { hm(H + 0.12, 0.32, H + 0.12, 0, t + 0.02, 0); hm(H + 0.12, 0.7, 0.3, 0, t - 0.4, -t - 0.02); }
      if (hs === 'spiky') [[-0.45, -0.3], [0.45, -0.3], [0, 0], [-0.45, 0.35], [0.45, 0.35], [0, -0.45]].forEach(function (p) { hm(0.32, 0.45, 0.32, p[0], t + 0.4, p[1]); });
      if (hs === 'long') { hm(H + 0.12, 2.1, 0.3, 0, -0.6, -t - 0.02); hm(0.25, 1.2, 0.7, -t - 0.02, 0.05, -0.2); hm(0.25, 1.2, 0.7, t + 0.02, 0.05, -0.2); }
      if (hs === 'bun') hm(0.6, 0.6, 0.6, 0, t + 0.55, -0.2);
      if (hs === 'mohawk') { hm(0.35, 0.55, H + 0.1, 0, t + 0.2, 0); hm(0.3, 0.9, 0.3, 0, t - 0.25, -t); }
      if (hs === 'pony') { hm(0.34, 1.3, 0.34, 0, -0.1, -t - 0.35); hm(0.45, 0.25, 0.45, 0, t - 0.25, -t - 0.2); }
      if (hs === 'afro') hm(2.0, 1.2, 1.6, 0, t + 0.1, -0.25);
    }
    if (iHat) addParts(head, iHat, L);
    if (iAcc) addParts(head, iAcc, L);
    if (iBack) addParts(torso, iBack, L);
    return g;
  };

  Luna.animate = function (g, t, speed, air) {
    var u = g.userData; if (!u.armL) return;
    var amp = Math.min(1, speed / 10) * 0.9, s = Math.sin(t * 9) * amp;
    if (air) { u.armL.rotation.x = u.armR.rotation.x = -2.5; u.legL.rotation.x = 0.35; u.legR.rotation.x = -0.35; return; }
    u.armL.rotation.x = s; u.armR.rotation.x = -s; u.legL.rotation.x = -s; u.legR.rotation.x = s;
  };

  /* ---------- 2D icons for the shop / inventory ---------- */
  var iconCache = {};
  Luna.itemIcon = function (def, size) {
    size = size || 96; var d = def.data || {}, key = def.slot + size + JSON.stringify(d);
    if (iconCache[key]) return iconCache[key];
    var c = document.createElement('canvas'); c.width = c.height = size; var x = c.getContext('2d'); x.imageSmoothingEnabled = false;
    var bg = x.createLinearGradient(0, 0, 0, size); bg.addColorStop(0, '#2c2640'); bg.addColorStop(1, '#1b1726'); x.fillStyle = bg; x.fillRect(0, 0, size, size);
    function sub(w, h, fn) { var k = document.createElement('canvas'); k.width = w; k.height = h; var kx = k.getContext('2d'); kx.imageSmoothingEnabled = false; fn(kx); return k; }
    if (def.slot === 'face') {
      x.drawImage(sub(128, 128, function (k) { drawFace(k, d.expr, '#F1C27D', d.color); }), size * .14, size * .14, size * .72, size * .72);
    } else if (def.slot === 'shirt') {
      x.fillStyle = d.c1 || '#fff'; x.fillRect(size * .08, size * .22, size * .84, size * .26);
      x.drawImage(sub(64, 64, function (k) { drawShirt(k, d.pattern, d.c1, d.c2, '#F1C27D'); }), size * .24, size * .2, size * .52, size * .62);
      x.fillStyle = '#F1C27D'; x.fillRect(size * .08, size * .42, size * .16, size * .12); x.fillRect(size * .76, size * .42, size * .16, size * .12);
    } else if (def.slot === 'pants') {
      var lg = sub(16, 32, function (k) { drawPants(k, d.pattern, d.style, d.c1, d.c2, '#F1C27D', '#FFFFFF'); });
      x.drawImage(lg, size * .24, size * .12, size * .25, size * .76); x.drawImage(lg, size * .51, size * .12, size * .25, size * .76);
    } else {
      var back = def.slot === 'back', list = (d.parts || []).slice(), base = back ? { w: 2, h: 2, c: '#FF7A00' } : { w: 1.3, h: 1.3, c: '#F1C27D' };
      var minx = -base.w / 2, maxx = base.w / 2, miny = -base.h / 2, maxy = base.h / 2;
      list.forEach(function (p) {
        var a = (p.r ? p.r[2] : 0) * Math.PI / 180, cw = Math.abs(Math.cos(a)), sw = Math.abs(Math.sin(a)), hw = (cw * p.s[0] + sw * p.s[1]) / 2, hh = (sw * p.s[0] + cw * p.s[1]) / 2, px = back ? -p.p[0] : p.p[0];
        minx = Math.min(minx, px - hw); maxx = Math.max(maxx, px + hw); miny = Math.min(miny, p.p[1] - hh); maxy = Math.max(maxy, p.p[1] + hh);
      });
      var sc = Math.min(size * .8 / (maxx - minx), size * .8 / (maxy - miny)), cx = size / 2 - (minx + maxx) / 2 * sc, cy = size / 2 + (miny + maxy) / 2 * sc;
      x.fillStyle = base.c; x.globalAlpha = back ? .55 : .9; x.fillRect(cx - base.w / 2 * sc, cy - base.h / 2 * sc, base.w * sc, base.h * sc); x.globalAlpha = 1;
      list.sort(function (a, b) { return back ? b.p[2] - a.p[2] : a.p[2] - b.p[2]; }).forEach(function (p) {
        var px = back ? -p.p[0] : p.p[0], rz = p.r ? p.r[2] * (back ? 1 : -1) : 0;
        x.save(); x.translate(cx + px * sc, cy - p.p[1] * sc); if (rz) x.rotate(rz * Math.PI / 180);
        x.fillStyle = p.c; if (p.g) { x.shadowColor = p.c; x.shadowBlur = size * .08; }
        if (p.t === 's') { x.beginPath(); x.ellipse(0, 0, p.s[0] / 2 * sc, p.s[1] / 2 * sc, 0, 0, 7); x.fill(); }
        else { x.fillRect(-p.s[0] / 2 * sc, -p.s[1] / 2 * sc, p.s[0] * sc, p.s[1] * sc); x.shadowBlur = 0; x.strokeStyle = 'rgba(0,0,0,.35)'; x.lineWidth = 1; x.strokeRect(-p.s[0] / 2 * sc, -p.s[1] / 2 * sc, p.s[0] * sc, p.s[1] * sc); }
        x.restore();
      });
    }
    return iconCache[key] = c.toDataURL();
  };
})(window);
