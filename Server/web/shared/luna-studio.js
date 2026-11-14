/* Luna Studio: build worlds, script them in JavaScript, test, save drafts and publish games. Works on PC and phones. */
(function (global) {
  'use strict';
  var Luna = global.Luna, UI = global.LunaUI, D = global.LunaData, esc = Luna.esc;
  var TEMPLATE = "// Luna Studio script (JavaScript). Scripts run in a safe sandbox.\n// game.findPart(name)  game.createPart({...})  game.onUpdate(fn)  game.onChat(fn)\n// game.after(sec, fn)  game.every(sec, fn)  game.say(text)  game.setStat(name, value)\n// game.player.teleport(x,y,z)  game.player.setSpeed(n)  game.player.kill()\n// Use the Insert menu above for ready-made examples.\n";
  var SNIPPETS = {
    'Say hello when touched': "var pad = game.findPart('Start') || game.findPart('SpawnPad');\nif (pad) pad.onTouch(function (player) { game.say('Welcome, ' + player.name + '!'); });\n",
    'Spinning part': "var p = game.findPart('Platform');\nif (p) game.onUpdate(function (dt) { p.rotation += 60 * dt; });\n",
    'Moving platform': "var m = game.findPart('Platform');\nif (m) { var x0 = m.position.x;\n  game.onUpdate(function () { m.position = { x: x0 + Math.sin(game.time * 1.5) * 8, y: m.position.y, z: m.position.z }; });\n}\n",
    'Coins and score': "var score = 0; game.setStat('Coins', 0);\nfor (var i = 0; i < 5; i++) { (function (i) {\n  var c = game.createPart({ name: 'Coin', type: 'cylinder', position: { x: i * 6 - 12, y: 3, z: 10 }, size: { x: 2, y: 0.4, z: 2 }, color: '#FFC107', canCollide: false });\n  c.onTouch(function () { c.destroy(); score++; game.setStat('Coins', score); game.sound(880, 0.1); });\n})(i); }\n",
    'Fast and high jumper': "game.player.setSpeed(28);\ngame.player.setJumpPower(55);\n",
    'Timer message': "game.every(10, function () { game.say('10 more seconds passed!'); });\n",
    'Chat command': "game.onChat(function (name, text) { if (text === '!hi') game.say('Hi ' + name + '!'); });\n"
  };
  var HELP = '<p style="margin-top:0">Scripts are JavaScript and run safely inside a sandbox. Everything is on the <b>game</b> object:</p><pre style="white-space:pre-wrap;font-size:12px;background:var(--bg);padding:10px;border:2px solid var(--line)">game.findPart("Name")      -> a part (or null)\ngame.getParts()            -> all parts\ngame.createPart({name,type,position,size,color,canCollide})\ngame.onUpdate(function (dt) {})\ngame.onChat(function (name, text) {})\ngame.after(seconds, fn)    game.every(seconds, fn)\ngame.say("text")           game.sound(freq, seconds)\ngame.setStat("Coins", 5)   game.getStat("Coins")\ngame.time                  game.random()\n\npart.position / size       {x,y,z}   (assign a new object to move)\npart.rotation              degrees\npart.color                 "#RRGGBB"\npart.transparency          0 to 1\npart.canCollide            true / false\npart.onTouch(function (player) {})\npart.destroy()\n\ngame.player.name / position\ngame.player.teleport(x, y, z)\ngame.player.kill()         (respawn)\ngame.player.setSpeed(n)    game.player.setJumpPower(n)</pre><p class="hint">Part behaviours (no code needed): Kill, Checkpoint, Bounce, Goal. Set them in the Properties panel.</p>';

  global.LunaStudio = {
    start: function (cfg) {
      var root = cfg.el, logo = cfg.logo || 'shared/logo.png', alive = true, sess = cfg.session || Luna.session();
      root.innerHTML = '<div class="loading"><div class="spin"></div>Loading Luna Studio…</div>';
      Luna.loadThree().then(init).catch(function (e) { root.innerHTML = '<div class="auth"><div class="auth-r" style="grid-column:1/-1"><div class="box"><h2>Could not start Studio</h2><p>' + esc(e.message) + '</p></div></div></div>'; });

      function init() {
        var THREE = global.THREE, $ = function (s) { return root.querySelector(s); };
        root.innerHTML = '<div class="studio" data-tab="view"><div class="sbar"><img src="' + logo + '" alt=""><b>Studio</b>' +
          '<select id="btpl" style="width:auto;min-height:34px;padding:4px 8px"><option value="">New…</option><option value="blank">Blank world</option><option value="obby">Obby template</option><option value="hangout">Hangout template</option></select>' +
          '<button class="btn sm alt" id="bmy">My games</button><button class="btn sm alt" id="bopen">Open file</button><button class="btn sm alt" id="bsave">Save file</button>' +
          '<button class="btn sm alt" id="bdraft">Save draft</button><button class="btn sm" id="bpub">Publish</button><button class="btn sm" id="bplay">Play test</button><span class="sp"></span><span id="smsg" class="hint" style="margin:0 6px"></span><button class="btn sm alt" id="bexit">Exit</button><input type="file" id="fopen" accept=".luna,.json,application/json" style="display:none"></div>' +
          '<div class="sbar2"><button class="btn sm alt" id="badd1">+ Block</button><button class="btn sm alt" id="badd2">+ Sphere</button><button class="btn sm alt" id="badd3">+ Cylinder</button><span style="width:8px"></span><button class="btn sm alt" id="bundo">Undo</button><button class="btn sm alt" id="bredo">Redo</button><button class="btn sm alt" id="bdup">Copy</button><button class="btn sm alt" id="bdel">Delete</button><span style="width:8px"></span><span class="hint" style="margin:0">Snap</span><select id="snap"><option value="0">Off</option><option value="0.5">0.5</option><option value="1" selected>1</option><option value="2">2</option><option value="4">4</option></select><button class="btn sm alt" id="bhelp">Help</button></div>' +
          '<div class="mtabs"><button data-t="view" class="on">View</button><button data-t="expl">Parts</button><button data-t="props">Edit</button><button data-t="code">Code</button></div>' +
          '<div class="smain"><div class="panel2" id="expl"></div><div class="vp"><canvas></canvas><div class="sbtn" id="sbtn"></div></div><div class="panel2 prop" id="props"></div>' +
          '<div class="script"><div class="panel2" id="slist"></div><textarea id="code" spellcheck="false" autocapitalize="off" autocorrect="off"></textarea><div class="console" id="con">Console: script output appears here when you Play test.\n</div></div></div></div>';
        var studio = $('.studio'), vp = $('.vp'), canvas = $('canvas'), props = $('#props'), expl = $('#expl'), slist = $('#slist'), code = $('#code'), con = $('#con');
        var renderer = Luna.makeRenderer(canvas, false), camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1500), scene = new THREE.Scene(), sky = Luna.buildSky(scene, renderer, false);
        var world = null, selId = null, helper = null, scriptIdx = 0, mode = 'edit', play = null, saveT = null, cam = { yaw: 0.6, pitch: 0.5, dist: 40, t: new THREE.Vector3(0, 3, 0) };
        var meta = { id: '', title: '', desc: '', genre: 'Obby', maxPlayers: 20, status: 'draft' }, hist = [], hi = -1, clip = null, dirtyFlag = false;

        function msg(t, ok) { var e = $('#smsg'); e.textContent = t; e.className = 'hint ' + (ok ? 'ok' : ''); e.style.margin = '0 6px'; clearTimeout(msg.t); msg.t = setTimeout(function () { e.textContent = ''; }, 5000); }
        function log(t) { con.textContent += t + '\n'; con.scrollTop = con.scrollHeight; if (con.textContent.length > 20000) con.textContent = con.textContent.slice(-12000); }
        function snapV(v) { var s = parseFloat($('#snap').value) || 0; return s ? Math.round(v / s) * s : v; }
        function place() { return world.place; }
        function part(id) { var ps = place().parts; for (var i = 0; i < ps.length; i++) if (ps[i].id === id) return ps[i]; return null; }
        function uid() { return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }
        function touch() { dirtyFlag = true; clearTimeout(saveT); saveT = setTimeout(function () { Luna.store.set('studio.autosave', { place: place(), meta: meta }); }, 600); }

        /* ---------- history ---------- */
        function snapshot() { var p = place(); return JSON.stringify({ name: p.name, sky: p.sky, spawn: p.spawn, walk: p.walk, jump: p.jump, parts: p.parts }); }
        function commit() { var s = snapshot(); if (hist[hi] === s) return; hist = hist.slice(0, hi + 1); hist.push(s); if (hist.length > 80) hist.shift(); hi = hist.length - 1; touch(); }
        function restore(s) { var o = JSON.parse(s); o.scripts = place().scripts; load(o, true); }
        function undo() { if (hi > 0) { hi--; restore(hist[hi]); } }
        function redo() { if (hi < hist.length - 1) { hi++; restore(hist[hi]); } }

        /* ---------- place management ---------- */
        function load(pl, keep) {
          if (world) { scene.remove(world.group); UI.disposeObj(world.group); }
          pl = Luna.cleanPlace(pl); if (!pl.scripts.length) pl.scripts.push({ name: 'Main', code: TEMPLATE });
          world = Luna.buildPlace(pl); scene.add(world.group); scene.background = new THREE.Color(pl.sky); scene.fog = null;
          if (!keep) scriptIdx = 0; if (scriptIdx >= pl.scripts.length) scriptIdx = 0;
          var keepSel = keep && selId && part(selId) ? selId : null; selId = null; select(keepSel); drawList(); drawScripts();
        }
        function fresh(pl, m) { stopPlay(); meta = m || { id: '', title: '', desc: '', genre: 'Obby', maxPlayers: 20, status: 'draft' }; load(pl); hist = []; hi = -1; commit(); }
        function add(p, name, type, pos, size, color, kind) { p.parts.push({ id: uid(), name: name, type: type, pos: pos, size: size, rot: 0, color: color, alpha: 1, collide: true, tex: '', kind: kind || 'none', mat: 'plastic' }); }
        function template(k) {
          var p = D.defaultPlace(); p.scripts = [{ name: 'Main', code: TEMPLATE }];
          if (k === 'obby') {
            p.name = 'My Obby'; p.sky = '#9BD7FF'; p.parts = []; add(p, 'Lava', 'box', [0, -8, 150], [400, 1, 400], '#E5484D', 'kill'); add(p, 'Start', 'box', [0, 0, 0], [12, 1, 12], '#FFFFFF');
            var z = 0, y = 0; for (var i = 1; i <= 14; i++) { z += 12 + (i % 3) * 2; y += (i % 2) * 1.5; var cpad = i % 5 === 0; add(p, cpad ? 'Checkpoint' : 'Platform', 'box', [Math.round(Math.sin(i * 1.7) * 8), y, z], [7, 1, 7], cpad ? '#3ECF8E' : (i % 2 ? '#FF7A00' : '#7B1FA2'), cpad ? 'checkpoint' : 'none'); }
            add(p, 'Bounce pad', 'box', [0, y, z + 14], [5, 1, 5], '#5CC8FF', 'bounce'); add(p, 'Goal', 'box', [0, y + 14, z + 32], [10, 1, 10], '#FFC107', 'goal'); p.spawn = [0, 3, 0];
          } else if (k === 'hangout') {
            p.name = 'My Hangout'; p.sky = '#FFE9D2'; p.parts = []; add(p, 'Ground', 'box', [0, -0.5, 0], [200, 1, 200], '#7BC96F'); p.parts[0].tex = 'grid'; add(p, 'Plaza', 'box', [0, 0.1, 0], [40, 0.2, 40], '#E8D8C3'); add(p, 'Stage', 'box', [0, 1, -16], [20, 2, 8], '#FF7A00');
            for (var t = 0; t < 8; t++) { var a = t / 8 * 6.283, tx = Math.cos(a) * 34, tz = Math.sin(a) * 34; add(p, 'Trunk', 'cylinder', [tx, 3, tz], [2, 6, 2], '#6D4C41'); add(p, 'Leaves', 'sphere', [tx, 8, tz], [8, 8, 8], '#2E7D32'); }
            for (var b = 0; b < 4; b++) add(p, 'Bench', 'box', [b * 8 - 12, 1, 12], [5, 1, 1.6], '#8D5A2B');
            p.spawn = [0, 3, 8];
          } else { p.name = 'My World'; }
          return p;
        }

        /* ---------- selection ---------- */
        function select(id) {
          selId = id; if (helper) { scene.remove(helper); helper = null; }
          if (id && world.meshes[id]) { helper = new THREE.BoxHelper(world.meshes[id], 0x111111); scene.add(helper); }
          drawProps(); markList();
        }
        function changed(p) { world.sync(p); if (helper && p.id === selId) helper.update(); touch(); }
        function addPart(type) {
          var p = { id: uid(), name: type[0].toUpperCase() + type.slice(1), type: type, pos: [Math.round(cam.t.x), Math.round(cam.t.y + 2), Math.round(cam.t.z)], size: [4, 4, 4], rot: 0, color: '#FF7A00', alpha: 1, collide: true, tex: '', kind: 'none', mat: 'plastic' };
          world.add(p); select(p.id); drawList(); commit();
        }
        function delSel() { var p = part(selId); if (!p) return; world.remove(p); select(null); drawList(); commit(); }
        function dupSel() { var p = part(selId); if (!p) return; var c = JSON.parse(JSON.stringify(p)); c.id = uid(); c.name = p.name; c.pos[0] += p.size[0] + 1; world.add(c); select(c.id); drawList(); commit(); }

        /* ---------- explorer + properties ---------- */
        function drawList() {
          var h = '<h4>Parts</h4><div class="plistitem" data-id="">World settings</div>';
          place().parts.forEach(function (p) { h += '<div class="plistitem" data-id="' + p.id + '"><span>' + esc(p.name) + '</span><small style="color:var(--mut)">' + p.type + (p.kind !== 'none' ? ' · ' + p.kind : '') + '</small></div>'; });
          expl.innerHTML = h; markList();
        }
        function markList() { Array.prototype.forEach.call(expl.querySelectorAll('.plistitem'), function (n) { n.classList.toggle('on', n.dataset.id === (selId || '')); }); }
        expl.addEventListener('click', function (e) { var n = e.target.closest('.plistitem'); if (n) { select(n.dataset.id || null); if (n.dataset.id && studio.dataset.tab === 'expl') { studio.dataset.tab = 'props'; syncTabs(); } } });
        function numIn(f, step) { return '<input type="number" step="' + (step || 0.5) + '" data-f="' + f + '">'; }
        function drawProps() {
          var p = part(selId);
          if (!p) {
            props.innerHTML = '<h4>World</h4><label>Name</label><input type="text" data-pf="name" maxlength="40"><label>Sky colour</label><input type="color" data-pf="sky">' +
              '<label>Spawn point (x y z)</label><div class="pr3">' + ['0', '1', '2'].map(function (i) { return '<input type="number" step="0.5" data-pf="spawn.' + i + '">'; }).join('') + '</div><button class="btn sm alt block" id="spview" style="margin-top:8px">Spawn at view centre</button>' +
              '<label>Walk speed</label><input type="number" data-pf="walk" min="6" max="50"><label>Jump power</label><input type="number" data-pf="jump" min="15" max="100">' +
              '<p class="hint">Tap a part to edit it. Drag = orbit, right-drag / two fingers = pan and zoom. Drag a selected part to move it.</p>';
          } else {
            props.innerHTML = '<h4>Properties</h4><label>Name</label><input type="text" data-f="name" maxlength="40"><label>Shape</label><select data-f="type"><option>box</option><option>sphere</option><option>cylinder</option></select>' +
              '<label>Position</label><div class="pr3">' + numIn('pos.0') + numIn('pos.1') + numIn('pos.2') + '</div><label>Size</label><div class="pr3">' + numIn('size.0') + numIn('size.1') + numIn('size.2') + '</div>' +
              '<label>Rotation (Y°)</label>' + numIn('rot', 5) + '<label>Colour</label><input type="color" data-f="color"><div class="swrow">' + D.PALETTE.map(function (c) { return '<i data-sw="' + c + '" style="background:' + c + '"></i>'; }).join('') + '</div>' +
              '<label>Transparency (0-1)</label>' + numIn('tr', 0.1) + '<label>Material</label><select data-f="mat"><option>plastic</option><option>neon</option><option>metal</option></select>' +
              '<label>Behaviour</label><select data-f="kind"><option value="none">None</option><option value="kill">Kill (respawn)</option><option value="checkpoint">Checkpoint</option><option value="bounce">Bounce pad</option><option value="goal">Goal</option></select>' +
              '<label style="display:flex;gap:8px;align-items:center;text-transform:none;letter-spacing:0;font-size:14px"><input type="checkbox" data-f="collide"> Solid (collides)</label>' +
              '<label>Nudge step</label><input type="number" id="step" value="1" step="0.5"><div class="pr3" style="margin-top:6px">' + ['x-', 'y-', 'z-', 'x+', 'y+', 'z+'].map(function (b) { return '<button class="btn sm alt" data-n="' + b + '">' + b.toUpperCase() + '</button>'; }).join('') + '</div>';
          }
          syncProps();
        }
        function getV(o, k) { if (k === 'tr') return +(1 - o.alpha).toFixed(3); if (k.indexOf('.') > 0) { var a = k.split('.'); return o[a[0]][+a[1]]; } return o[k]; }
        function setV(o, k, v) { if (k === 'tr') o.alpha = Math.min(1, Math.max(0, 1 - v)); else if (k.indexOf('.') > 0) { var a = k.split('.'); o[a[0]][+a[1]] = v; } else o[k] = v; }
        function syncProps() {
          var p = part(selId);
          Array.prototype.forEach.call(props.querySelectorAll('[data-f],[data-pf]'), function (n) {
            if (document.activeElement === n) return; var o = n.dataset.f ? p : place(), k = n.dataset.f || n.dataset.pf; if (!o) return;
            var v = getV(o, k); if (n.type === 'checkbox') n.checked = !!v; else n.value = (typeof v === 'number') ? +v.toFixed(3) : v;
          });
        }
        props.addEventListener('input', function (e) {
          var n = e.target, p = part(selId), k = n.dataset.f || n.dataset.pf; if (!k) return;
          var o = n.dataset.f ? p : place(); if (!o) return;
          var v = n.type === 'checkbox' ? n.checked : (n.type === 'number' ? parseFloat(n.value) : n.value);
          if (n.type === 'number' && !isFinite(v)) return; if (n.type === 'number' && /^size/.test(k)) v = Math.max(0.05, v);
          setV(o, k, v);
          if (n.dataset.f) { if (k === 'type' || k === 'mat') { world.rebuildMesh(p); select(p.id); } else if (k === 'name') drawList(); changed(p); }
          else { if (k === 'sky') scene.background = new THREE.Color(place().sky); touch(); }
        });
        props.addEventListener('change', commit);
        props.addEventListener('click', function (e) {
          var t = e.target, p = part(selId);
          if (t.id === 'spview') { place().spawn = [cam.t.x, cam.t.y + 1, cam.t.z]; syncProps(); commit(); msg('Spawn point moved.', true); }
          else if (t.dataset.sw && p) { p.color = t.dataset.sw; changed(p); syncProps(); commit(); }
          else if (t.dataset.n && p) { var s = parseFloat($('#step').value) || 1, ax = 'xyz'.indexOf(t.dataset.n[0]); p.pos[ax] += (t.dataset.n[1] === '+' ? s : -s); changed(p); syncProps(); commit(); }
        });

        /* ---------- scripts ---------- */
        function curScript() { return place().scripts[scriptIdx]; }
        function drawScripts() {
          var h = '<h4>Scripts</h4>'; place().scripts.forEach(function (s, i) { h += '<div class="plistitem' + (i === scriptIdx ? ' on' : '') + '" data-i="' + i + '">' + esc(s.name) + '</div>'; });
          h += '<div class="row" style="margin-top:6px;flex-wrap:nowrap"><button class="btn sm alt sp" id="sadd">+</button><button class="btn sm danger sp" id="sdel">-</button></div><label>Name</label><input type="text" id="sname" maxlength="40"><label>Insert</label><select id="snip"><option value="">Example…</option>' + Object.keys(SNIPPETS).map(function (k) { return '<option>' + k + '</option>'; }).join('') + '</select>';
          slist.innerHTML = h; var s = curScript(); $('#sname').value = s ? s.name : ''; code.value = s ? s.code : ''; code.disabled = !s;
        }
        slist.addEventListener('click', function (e) {
          var n = e.target.closest('.plistitem');
          if (n) { if (curScript()) curScript().code = code.value; scriptIdx = +n.dataset.i; drawScripts(); }
          else if (e.target.id === 'sadd') { place().scripts.push({ name: 'Script ' + (place().scripts.length + 1), code: TEMPLATE }); scriptIdx = place().scripts.length - 1; drawScripts(); touch(); }
          else if (e.target.id === 'sdel' && place().scripts.length) { place().scripts.splice(scriptIdx, 1); scriptIdx = Math.max(0, scriptIdx - 1); drawScripts(); touch(); }
        });
        slist.addEventListener('input', function (e) { if (e.target.id === 'sname' && curScript()) { curScript().name = e.target.value; var it = slist.querySelector('.plistitem.on'); if (it) it.textContent = e.target.value; touch(); } });
        slist.addEventListener('change', function (e) { if (e.target.id === 'snip' && e.target.value && curScript()) { code.value += (code.value && !/\n$/.test(code.value) ? '\n' : '') + '\n' + SNIPPETS[e.target.value]; curScript().code = code.value; e.target.value = ''; touch(); } });
        code.addEventListener('input', function () { if (curScript()) { curScript().code = code.value; touch(); } });
        code.addEventListener('keydown', function (e) { if (e.key === 'Tab') { e.preventDefault(); var s = code.selectionStart; code.value = code.value.slice(0, s) + '  ' + code.value.slice(code.selectionEnd); code.selectionStart = code.selectionEnd = s + 2; curScript().code = code.value; touch(); } });

        /* ---------- viewport: orbit / pan / zoom / pick / drag-move ---------- */
        var ptrs = {}, moved = false, startP = null, ray = new THREE.Raycaster(), drag = null;
        function ptrCount() { return Object.keys(ptrs).length; }
        function setRay(e) { var r = canvas.getBoundingClientRect(); ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera); }
        function hitPart(e) { setRay(e); var h = ray.intersectObjects(world.group.children, false); return h.length ? h[0].object.userData.partId : null; }
        function planePt(e, y) { setRay(e); var pt = new THREE.Vector3(); return ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -y), pt) ? pt : null; }
        canvas.addEventListener('pointerdown', function (e) {
          if (mode !== 'edit') return; canvas.setPointerCapture(e.pointerId); ptrs[e.pointerId] = { x: e.clientX, y: e.clientY, b: e.button };
          if (ptrCount() === 1) {
            moved = false; startP = [e.clientX, e.clientY]; drag = null;
            if (selId && e.button === 0 && hitPart(e) === selId) { var p = part(selId), pt = planePt(e, p.pos[1]); if (pt) drag = { p: p, dx: p.pos[0] - pt.x, dz: p.pos[2] - pt.z }; }
          } else drag = null;
        });
        canvas.addEventListener('pointermove', function (e) {
          var p = ptrs[e.pointerId]; if (!p || mode !== 'edit') return;
          var dx = e.clientX - p.x, dy = e.clientY - p.y;
          if (ptrCount() === 2) {
            var ids = Object.keys(ptrs), a = ptrs[ids[0]], b = ptrs[ids[1]], d0 = Math.hypot(a.x - b.x, a.y - b.y);
            p.x = e.clientX; p.y = e.clientY; var d1 = Math.hypot(a.x - b.x, a.y - b.y);
            if (d0 > 0 && d1 > 0) cam.dist = Math.max(4, Math.min(500, cam.dist * d0 / d1)); moved = true; return;
          }
          p.x = e.clientX; p.y = e.clientY;
          if (Math.hypot(e.clientX - startP[0], e.clientY - startP[1]) > 5) moved = true; if (!moved) return;
          if (drag) { var pt = planePt(e, drag.p.pos[1]); if (pt) { drag.p.pos[0] = snapV(pt.x + drag.dx); drag.p.pos[2] = snapV(pt.z + drag.dz); changed(drag.p); syncProps(); } return; }
          if (p.b === 2 || e.shiftKey) { var k = cam.dist * 0.0016, sy = Math.sin(cam.yaw), cy = Math.cos(cam.yaw); cam.t.x -= cy * dx * k; cam.t.z += sy * dx * k; cam.t.y += dy * k; }
          else { cam.yaw -= dx * 0.008; cam.pitch = Math.max(-1.4, Math.min(1.5, cam.pitch + dy * 0.008)); }
        });
        function up(e) {
          var had = ptrs[e.pointerId]; delete ptrs[e.pointerId];
          if (drag && moved) commit(); var wasDrag = !!drag; if (ptrCount() === 0) drag = null;
          if (had && !moved && mode === 'edit' && ptrCount() === 0 && had.b === 0 && !wasDrag) select(hitPart(e));
          else if (had && !moved && wasDrag && ptrCount() === 0) select(hitPart(e));
        }
        canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', function (e) { delete ptrs[e.pointerId]; drag = null; });
        canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
        canvas.addEventListener('wheel', function (e) { if (mode !== 'edit') return; cam.dist = Math.max(4, Math.min(500, cam.dist * (1 + e.deltaY * 0.001))); e.preventDefault(); }, { passive: false });

        /* ---------- keyboard ---------- */
        function onKey(e) {
          if (mode !== 'edit') return; var t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
          var p = part(selId), s = parseFloat(($('#step') || {}).value) || 1, k = e.key.toLowerCase();
          if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
          else if ((e.ctrlKey || e.metaKey) && k === 'y') { e.preventDefault(); redo(); }
          else if ((e.key === 'Delete' || e.key === 'Backspace') && p) { e.preventDefault(); delSel(); }
          else if ((e.ctrlKey || e.metaKey) && k === 'd' && p) { e.preventDefault(); dupSel(); }
          else if (k === 'f' && p) { cam.t.set(p.pos[0], p.pos[1], p.pos[2]); cam.dist = Math.max(10, Math.max.apply(null, p.size) * 3); }
          else if (p && /^Arrow|^Page/.test(e.key)) {
            e.preventDefault(); if (e.key === 'ArrowLeft') p.pos[0] -= s; if (e.key === 'ArrowRight') p.pos[0] += s; if (e.key === 'ArrowUp') p.pos[2] -= s; if (e.key === 'ArrowDown') p.pos[2] += s; if (e.key === 'PageUp') p.pos[1] += s; if (e.key === 'PageDown') p.pos[1] -= s;
            changed(p); syncProps(); commit();
          }
        }
        global.addEventListener('keydown', onKey);

        /* ---------- play test ---------- */
        function startPlay() {
          if (curScript()) curScript().code = code.value;
          var copy = JSON.parse(JSON.stringify(place())), ps = new THREE.Scene(), pw = Luna.buildPlace(copy), cp = null, inK = {};
          ps.background = new THREE.Color(pw.place.sky); ps.fog = new THREE.Fog(pw.place.sky, 120, 500);
          var psky = Luna.buildSky(ps, renderer, false); ps.add(pw.group);
          var av = Luna.buildAvatar(Luna.store.get('avatar', Luna.DEFAULT_AVATAR)); ps.add(av);
          var sp = pw.place.spawn, ctl = new Luna.Controller({ dom: canvas, hud: vp, camera: camera, avatar: av, boxes: pw.boxes, spawn: sp, mobile: Luna.isMobile(), walk: pw.place.walk, jump: pw.place.jump, onEscape: stopPlay });
          function respawn() { var s = cp || pw.place.spawn; ctl.teleport(s[0], s[1] + 0.3, s[2]); }
          var host = new Luna.ScriptHost(pw, { say: function (m) { log('[say] ' + m); }, log: log, playerName: function () { return 'You'; }, playerState: function () { return ctl.state(); }, teleport: function (x, y, z) { ctl.teleport(x, y, z); }, kill: respawn, setSpeed: function (v) { ctl.walk = v; }, setJump: function (v) { ctl.jumpPower = v; }, stat: function (k, v) { log('[stat] ' + k + ' = ' + v); } });
          con.textContent = 'Play test started (Esc or Stop to end)\n'; host.run();
          play = { scene: ps, world: pw, ctl: ctl, host: host, sky: psky, av: av, respawn: respawn, kinds: function () {
            var s = ctl.state(); pw.place.parts.forEach(function (p) {
              if (!p.kind || p.kind === 'none') return; var b = Luna.partBox(p); if (!Luna.touching(s, b, 0.15)) { inK[p.id] = false; return; }
              if (p.kind === 'kill') respawn(); else if (p.kind === 'checkpoint') { if (!cp || cp[3] !== p.id) { cp = [p.pos[0], b.maxy, p.pos[2], p.id]; log('Checkpoint saved'); } }
              else if (p.kind === 'bounce') ctl.p.vy = 72; else if (p.kind === 'goal' && !inK[p.id]) log('Goal reached!');
              inK[p.id] = true;
            });
          } }; mode = 'play';
          $('#sbtn').innerHTML = '<button class="btn sm danger" id="bstop">Stop</button>'; $('#bstop').onclick = stopPlay; $('#bplay').disabled = true;
          if (studio.dataset.tab !== 'view') { studio.dataset.tab = 'view'; syncTabs(); }
        }
        function stopPlay() {
          if (!play) return; play.host.stop(); play.ctl.destroy(); UI.disposeObj(play.scene); play = null; mode = 'edit'; $('#sbtn').innerHTML = ''; $('#bplay').disabled = false; log('Play test stopped.');
        }

        /* ---------- toolbar ---------- */
        $('#btpl').onchange = function () {
          var k = this.value; this.value = ''; if (!k) return;
          UI.confirm('Start new world', 'Replace the current world? Unsaved changes will be lost.', 'Replace', true).then(function (y) { if (y) { fresh(template(k)); msg('New world ready.', true); } });
        };
        $('#badd1').onclick = function () { addPart('box'); }; $('#badd2').onclick = function () { addPart('sphere'); }; $('#badd3').onclick = function () { addPart('cylinder'); };
        $('#bundo').onclick = undo; $('#bredo').onclick = redo; $('#bdup').onclick = dupSel; $('#bdel').onclick = delSel; $('#bplay').onclick = startPlay;
        $('#bhelp').onclick = function () { UI.modal('Scripting help', HELP); };
        $('#bsave').onclick = function () {
          if (curScript()) curScript().code = code.value;
          var blob = new Blob([JSON.stringify(place(), null, 1)], { type: 'application/json' }), a = document.createElement('a');
          a.href = URL.createObjectURL(blob); a.download = (place().name || 'place').replace(/[^\w\- ]/g, '') + '.luna'; document.body.appendChild(a); a.click(); a.remove(); msg('Saved to your downloads.', true);
        };
        $('#bopen').onclick = function () { $('#fopen').click(); };
        $('#fopen').onchange = function (e) {
          var f = e.target.files[0]; if (!f) return; var r = new FileReader();
          r.onload = function () { try { fresh(JSON.parse(r.result), meta); msg('Opened ' + f.name, true); } catch (er) { msg('That file is not a valid Luna world.'); } };
          r.readAsText(f); e.target.value = '';
        };
        $('#bexit').onclick = function () { stopPlay(); cleanup(); cfg.onExit && cfg.onExit(); };
        function needLogin() { if (!sess) { msg('Log in to Luna first.'); return true; } return false; }
        function api(p, b) { return Luna.api(sess.server, p, b, sess.token); }

        $('#bmy').onclick = function () {
          if (needLogin()) return; var m = UI.modal('My games', '<div class="hint">Loading…</div>');
          api('/api/my/games').then(function (r) {
            m.el.innerHTML = r.games.length ? r.games.map(function (g) { return '<div class="lrow"><div class="mid"><b>' + esc(g.title) + '</b> <span class="tag ' + (g.status === 'public' ? 'on' : 'off') + '">' + g.status + '</span></div><button class="btn sm" data-o="' + g.id + '">Open</button></div>'; }).join('') : '<div class="empty">No saved games yet.</div>';
            m.el.onclick = function (e) { var b = e.target.closest('[data-o]'); if (b) { m.close(); openRemote(b.dataset.o); } };
          }).catch(function (e) { m.el.innerHTML = '<div class="empty">' + esc(e.message) + '</div>'; });
        };
        function openRemote(id) {
          if (needLogin()) return;
          return api('/api/game/' + encodeURIComponent(id) + '/place').then(function (r) { var g = r.game; fresh(r.place, { id: g.id, title: g.title, desc: g.desc, genre: g.genre, maxPlayers: g.maxPlayers, status: g.status }); msg('Opened "' + g.title + '"', true); }).catch(function (e) { msg(e.message); });
        }
        function thumb() {
          if (helper) helper.visible = false; Luna.fitRenderer(renderer, camera, vp); setCam(); renderer.render(scene, camera);
          var t = document.createElement('canvas'); t.width = 384; t.height = 216; var x = t.getContext('2d'), cw = canvas.width, ch = canvas.height, tw = cw, th = cw * 9 / 16;
          if (th > ch) { th = ch; tw = ch * 16 / 9; } x.drawImage(canvas, (cw - tw) / 2, (ch - th) / 2, tw, th, 0, 0, 384, 216);
          if (helper) helper.visible = true; return t.toDataURL('image/jpeg', 0.72);
        }
        function saveRemote(publish) {
          if (needLogin()) return; if (curScript()) curScript().code = code.value;
          var m = UI.modal(publish ? 'Publish game' : 'Save draft', '<label style="margin-top:0">Title</label><input type="text" id="gt" maxlength="40" placeholder="Name your game">' +
            '<label>Description</label><textarea id="gd" rows="4" maxlength="800" placeholder="What is this game about? How do you play? Tell players what to expect."></textarea>' +
            '<div class="pr3" style="grid-template-columns:1fr 1fr;gap:10px"><div><label>Genre</label><select id="gg">' + D.GENRES.map(function (g) { return '<option>' + g + '</option>'; }).join('') + '</select></div><div><label>Max players</label><input type="number" id="gm" min="1" max="50"></div></div>' +
            '<label>Thumbnail</label><img id="gi" style="width:100%;max-width:320px;display:block;border:2px solid var(--line)" alt=""><div class="hint">Luna takes the thumbnail from your current Studio view, so no logo is needed. Close this window, move the camera, and press the button again to retake it.</div>' +
            '<div class="err" id="ge"></div><div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn" id="gs">' + (publish ? 'Publish' : 'Save draft') + '</button></div>', {});
          var img = thumb(); m.q('#gi').src = img; m.q('#gt').value = meta.title || place().name || ''; m.q('#gd').value = meta.desc || ''; m.q('#gg').value = meta.genre || 'Other'; m.q('#gm').value = meta.maxPlayers || 20;
          m.q('#gs').onclick = function () {
            var btn = this; btn.disabled = true; m.q('#ge').textContent = '';
            meta.title = m.q('#gt').value; meta.desc = m.q('#gd').value; meta.genre = m.q('#gg').value; meta.maxPlayers = +m.q('#gm').value || 20;
            api('/api/game/save', { id: meta.id || undefined, title: meta.title, desc: meta.desc, genre: meta.genre, maxPlayers: meta.maxPlayers, place: place(), thumb: img, publish: publish }).then(function (r) {
              meta.id = r.id; meta.status = r.game.status; touch(); dirtyFlag = false; m.close(); msg(publish ? 'Published! Players can find it under Games.' : 'Draft saved.', true);
            }).catch(function (e) { btn.disabled = false; m.q('#ge').textContent = e.message; });
          };
        }
        $('#bdraft').onclick = function () { saveRemote(false); }; $('#bpub').onclick = function () { saveRemote(true); };

        /* ---------- mobile tabs ---------- */
        function syncTabs() { Array.prototype.forEach.call($('.mtabs').children, function (b) { b.classList.toggle('on', b.dataset.t === studio.dataset.tab); }); }
        $('.mtabs').onclick = function (e) { var b = e.target.closest('button'); if (b) { studio.dataset.tab = b.dataset.t; syncTabs(); } };

        /* ---------- loop ---------- */
        function setCam() { var cp = Math.cos(cam.pitch); camera.position.set(cam.t.x + Math.sin(cam.yaw) * cp * cam.dist, cam.t.y + Math.sin(cam.pitch) * cam.dist, cam.t.z + Math.cos(cam.yaw) * cp * cam.dist); camera.lookAt(cam.t); }
        var last = performance.now();
        function frame(now) {
          if (!alive) return; requestAnimationFrame(frame);
          var dt = Math.min(0.1, (now - last) / 1000); last = now; Luna.fitRenderer(renderer, camera, vp);
          if (mode === 'play' && play) {
            play.ctl.update(dt); play.host.tick(dt); play.kinds(); if (play.ctl.p.y < -80) play.respawn();
            play.sky.update(dt, play.ctl.p); renderer.render(play.scene, camera);
          } else { setCam(); sky.update(dt, null); renderer.render(scene, camera); }
        }
        function cleanup() { alive = false; global.removeEventListener('keydown', onKey); renderer.dispose(); try { renderer.forceContextLoss(); } catch (e) { } }

        /* ---------- start ---------- */
        var auto = Luna.store.get('studio.autosave', null);
        fresh(template('blank'));
        requestAnimationFrame(frame);
        if (cfg.gameId) openRemote(cfg.gameId);
        else if (auto && auto.place && auto.place.parts && !(auto.meta && auto.meta.id) && auto.place.parts.length > 2) {
          UI.confirm('Unsaved work found', 'Continue where you left off last time?', 'Continue').then(function (y) { if (y) fresh(auto.place, auto.meta); });
        }
      }
    }
  };
})(window);
