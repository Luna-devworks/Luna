/* Luna game: multiplayer 3D world with chat, checkpoints, kill bricks and sandboxed game scripts. */
(function (global) {
  'use strict';
  var Luna = global.Luna, G = global.LunaGame = {};

  /* o: { server, token, user, mode, root, logo, gameId, onAvatar, onExit, editorCtx } */
  G.start = function (o) {
    var root = o.root, mobile = Luna.isMobile() || o.mode === 'mobile', gid = o.gameId || 'hub';
    root.innerHTML = '<div class="loading"><div class="spin"></div>Joining…</div>';
    Luna.loadThree().then(function () { run(); }).catch(function (e) {
      root.innerHTML = '<div class="auth"><div class="auth-r" style="grid-column:1/-1"><div class="box"><h2>Could not start</h2><p>' + Luna.esc(e.message) + '</p><button class="btn block" id="bk">Back</button></div></div></div>';
      root.querySelector('#bk').onclick = function () { o.onExit(); };
    });

    function run() {
      var THREE = global.THREE, ws, running = true, myId = null, me = null, players = {}, bubbles = [], lines = [], stats = {}, cp = null, inKind = {}, kindParts = [], kindT = 0, title = 'Luna';
      var scene, camera, renderer, sky, world, ctl, scripts = null, copts, myGroup, chatOpen = false, lastSend = 0, lastPos = '', ready = false, editor = null, lastT = 0, uiScale = 1;

      root.innerHTML = '<div class="game"><canvas></canvas><div class="hud">' +
        '<div class="hbtns"><button class="btn sm" id="bmenu">Menu</button>' + (mobile ? '<button class="btn sm alt" id="bchat">Chat</button><button class="btn sm alt" id="bpl">Players</button>' : '') + '</div>' +
        '<div class="toast" id="toast"></div><div class="plist" id="plist"></div><div class="statbox" id="statbox"></div>' +
        '<div class="chatbox"><div class="chatlog" id="clog"></div><div class="chatin" id="cin"><input type="text" id="cinp" maxlength="200" placeholder="Chat… (/help)" autocomplete="off"><button class="btn sm" id="csend">Send</button></div></div>' +
        '<div class="menu" id="menu"><div class="box"><h2 id="mtitle" style="text-align:center;font-size:18px"></h2>' +
        '<button class="btn" id="mres">Resume</button><button class="btn alt" id="mresp">Respawn</button><button class="btn alt" id="mav">Wardrobe</button>' + (document.fullscreenEnabled ? '<button class="btn alt" id="mfs">Fullscreen</button>' : '') + '<button class="btn danger" id="mleave">Leave game</button></div></div>' +
        '<div class="menu" id="avov" style="overflow:auto;align-items:flex-start"><div style="background:var(--p1);border:2px solid var(--o);width:min(900px,100%);margin:auto;padding:14px"><div class="row" style="margin-bottom:8px"><b class="sp" style="font-size:16px;text-transform:uppercase;letter-spacing:.06em">Wardrobe</b><button class="btn sm alt" id="avclose">Close</button></div><div id="avroot"></div></div></div>' +
        '</div></div>';
      var gameEl = root.querySelector('.game'), canvas = root.querySelector('canvas'), hud = root.querySelector('.hud');
      var $ = function (s) { return root.querySelector(s); };

      /* ---- UI helpers ---- */
      function toast(t) { var e = $('#toast'); if (!e) return; e.textContent = t; e.style.display = 'block'; clearTimeout(toast.t); toast.t = setTimeout(function () { e.style.display = 'none'; }, 4000); }
      function addLine(html, cls) {
        var log = $('#clog'), d = document.createElement('div'); d.className = cls || ''; d.innerHTML = html; log.appendChild(d); lines.push(d);
        while (lines.length > 80) { var x = lines.shift(); if (x.parentNode) x.parentNode.removeChild(x); }
        setTimeout(function () { d.classList.add('old'); }, 9000); log.scrollTop = log.scrollHeight;
      }
      function renderPlayers() {
        var h = '<b>Players</b>'; Object.keys(players).forEach(function (id) { var p = players[id]; h += '<div>' + (p.admin ? '★ ' : '') + Luna.esc(p.name) + '</div>'; });
        $('#plist').innerHTML = h + '<div>' + Luna.esc(me ? me.name : '') + ' (you)</div>';
      }
      function renderStats() {
        var k = Object.keys(stats), b = $('#statbox'); if (!b) return;
        b.style.display = k.length ? 'block' : 'none'; b.innerHTML = k.map(function (x) { return Luna.esc(x) + ': ' + Luna.esc(stats[x]); }).join('<br>');
      }
      function openChat(pre) { chatOpen = true; ctl.enabled = false; $('#cin').classList.add('on'); $('#clog').classList.add('open'); var i = $('#cinp'); i.value = pre || ''; setTimeout(function () { i.focus(); }, 0); }
      function closeChat() { chatOpen = false; ctl.enabled = true; $('#cin').classList.remove('on'); $('#clog').classList.remove('open'); $('#cinp').blur(); }
      function sendChat() { var i = $('#cinp'), t = i.value.trim(); i.value = ''; if (t && ws.readyState === 1) ws.send(JSON.stringify({ t: 'chat', text: t })); closeChat(); }
      function showMenu(on) { $('#menu').classList.toggle('on', on); ctl.enabled = !on && !chatOpen; }
      function exit(reason) {
        if (!running) return; running = false;
        try { ws.close(); } catch (e) { }
        if (scripts) scripts.stop(); if (editor) { editor.destroy(); editor = null; }
        if (ctl) ctl.destroy();
        if (renderer) { renderer.dispose(); try { renderer.forceContextLoss(); } catch (e) { } }
        o.onExit(reason);
      }
      function respawn() { var sp = cp ? cp.pos : world.place.spawn; ctl.teleport(sp[0], sp[1] + 0.3, sp[2]); }

      /* ---- players ---- */
      function makePlayer(p) {
        var g = Luna.buildAvatar(p.avatar), lab = Luna.makeLabel(p.name, p.admin); lab.position.y = 7.1; g.add(lab);
        var e = { id: p.id, name: p.name, admin: p.admin, avatar: p.avatar, g: g, lab: lab, tx: p.x || 0, ty: p.y || 0, tz: p.z || 0, tr: p.r || 0, s: 0, a: false, t: Math.random() * 10 };
        g.position.set(e.tx, e.ty, e.tz); return e;
      }
      function addPlayer(p) {
        if (p.id === myId) return;
        if (players[p.id]) { scene.remove(players[p.id].g); LunaUI.disposeObj(players[p.id].g); }
        players[p.id] = makePlayer(p); scene.add(players[p.id].g); renderPlayers();
      }
      function removePlayer(id) { var e = players[id]; if (e) { scene.remove(e.g); LunaUI.disposeObj(e.g); delete players[id]; renderPlayers(); } }
      function setMyAvatar(av, name, admin) {
        var pos = null, rot = 0; if (myGroup) { pos = myGroup.position.clone(); rot = myGroup.rotation.y; scene.remove(myGroup); LunaUI.disposeObj(myGroup); }
        myGroup = Luna.buildAvatar(av); var lab = Luna.makeLabel(name, admin); lab.position.y = 7.1; myGroup.add(lab);
        if (pos) { myGroup.position.copy(pos); myGroup.rotation.y = rot; }
        scene.add(myGroup); if (copts) copts.avatar = myGroup;
      }
      function showBubble(id, text) {
        var host = id === myId ? myGroup : (players[id] && players[id].g); if (!host) return;
        bubbles = bubbles.filter(function (b) { if (b.id === id) { b.host.remove(b.s); return false; } return true; });
        var s = Luna.makeBubble(text); s.position.y = 9.2; host.add(s); bubbles.push({ id: id, s: s, host: host, until: performance.now() + 7000 });
      }

      /* ---- world ---- */
      function loadPlace(place) {
        if (scripts) scripts.stop();
        if (world) { scene.remove(world.group); LunaUI.disposeObj(world.group); }
        world = Luna.buildPlace(place); scene.add(world.group); stats = {}; renderStats(); cp = null; inKind = {};
        scene.background = new THREE.Color(world.place.sky); scene.fog = new THREE.Fog(world.place.sky, 120, 500);
        if (copts) copts.boxes = world.boxes;
        if (ctl) { ctl.walk = world.place.walk; ctl.jumpPower = world.place.jump; }
        kindParts = world.place.parts.filter(function (p) { return p.kind && p.kind !== 'none'; });
        scripts = new Luna.ScriptHost(world, {
          say: function (m) { addLine('<b>[Game]</b> ' + Luna.esc(Luna.filter(m)), 'sys'); }, log: function (m) { if (global.console) console.log('[Luna script]', m); },
          playerName: function () { return me ? me.name : 'Player'; }, playerState: function () { return ctl.state(); },
          teleport: function (x, y, z) { ctl.teleport(x, y, z); }, kill: respawn,
          setSpeed: function (v) { ctl.walk = v; }, setJump: function (v) { ctl.jumpPower = v; },
          stat: function (k, v) { stats[k] = v; renderStats(); }
        });
        scripts.run();
      }
      function processKinds() {
        var s = ctl.state();
        for (var i = 0; i < kindParts.length; i++) {
          var p = kindParts[i], b = Luna.partBox(p);
          if (!Luna.touching(s, b, 0.15)) { inKind[p.id] = false; continue; }
          if (p.kind === 'kill') { respawn(); return; }
          if (p.kind === 'checkpoint') { if (!cp || cp.id !== p.id) { cp = { id: p.id, pos: [p.pos[0], b.maxy, p.pos[2]] }; toast('Checkpoint saved'); Luna.beep(520, 0.12); } }
          else if (p.kind === 'bounce') { ctl.p.vy = 72; }
          else if (p.kind === 'goal') { if (!inKind[p.id]) { toast('You reached the goal!'); Luna.beep(780, 0.25); } }
          inKind[p.id] = true;
        }
      }

      function init(m) {
        myId = m.id; me = m.you; title = (m.game && m.game.title) || 'Luna'; $('#mtitle').textContent = title;
        scene = new THREE.Scene(); camera = new THREE.PerspectiveCamera(65, 1, 0.1, 1200);
        renderer = Luna.makeRenderer(canvas, !mobile); sky = Luna.buildSky(scene, renderer, !mobile);
        setMyAvatar(me.avatar, me.name, me.admin);
        var pl = Luna.cleanPlace(m.place), sp = pl.spawn;
        copts = { dom: canvas, hud: hud, camera: camera, avatar: myGroup, boxes: [], spawn: [sp[0] + (Math.random() - .5) * 3, sp[1], sp[2] + (Math.random() - .5) * 3], mobile: mobile, walk: pl.walk, jump: pl.jump,
          onChatKey: function (pre) { if (!chatOpen && !$('#menu').classList.contains('on') && !$('#avov').classList.contains('on')) openChat(pre === '/' ? '/' : ''); },
          onEscape: function () { if (chatOpen) closeChat(); else if ($('#avov').classList.contains('on')) closeAv(); else showMenu(!$('#menu').classList.contains('on')); },
          onTab: function (on) { $('#plist').classList.toggle('on', on); } };
        ctl = new Luna.Controller(copts);
        loadPlace(pl);
        (m.players || []).forEach(addPlayer); renderPlayers();
        (m.chat || []).forEach(function (c) { chatLine(c, true); });
        addLine('Welcome to ' + Luna.esc(title) + '! Press Enter to chat.' + (me.admin ? ' You are an admin: type /help.' : ''), 'sys');
        ready = true; var ld = root.querySelector('.loading'); if (ld) ld.remove();
        lastT = performance.now(); requestAnimationFrame(frame);
      }
      function chatLine(c, quiet) {
        addLine((c.admin ? '<span style="color:#ff9a3d">★ </span>' : '') + '<b>' + Luna.esc(c.name) + ':</b> ' + Luna.esc(c.text), c.admin ? 'adm' : '');
        if (!quiet) { showBubble(c.id, c.text); if (scripts) scripts.chat(c.name, c.text); }
      }

      /* ---- network ---- */
      try { ws = new WebSocket(Luna.wsUrl(o.server) + '?token=' + encodeURIComponent(o.token) + '&game=' + encodeURIComponent(gid)); }
      catch (e) { exit(); return; }
      ws.onmessage = function (ev) {
        var m; try { m = JSON.parse(ev.data); } catch (e) { return; }
        if (m.t === 'welcome') { init(m); return; }
        if (!ready) return;
        switch (m.t) {
          case 'join': addPlayer(m.p); addLine(Luna.esc(m.p.name) + ' joined.', 'sys'); break;
          case 'leave': if (players[m.id]) addLine(Luna.esc(players[m.id].name) + ' left.', 'sys'); removePlayer(m.id); break;
          case 'snap': m.s.forEach(function (r) { var e = players[r[0]]; if (e) { e.tx = r[1]; e.ty = r[2]; e.tz = r[3]; e.tr = r[4]; e.s = r[5]; e.a = !!r[6]; } }); break;
          case 'chat': chatLine(m); break;
          case 'sys': addLine(Luna.esc(m.text), 'sys'); if (m.big) toast(m.text); break;
          case 'avatar':
            if (m.id === myId) { me.avatar = m.avatar; setMyAvatar(m.avatar, me.name, me.admin); o.onAvatar && o.onAvatar(m.avatar); }
            else if (players[m.id]) { var p = players[m.id]; addPlayer({ id: m.id, name: p.name, admin: p.admin, avatar: m.avatar, x: p.tx, y: p.ty, z: p.tz, r: p.tr }); }
            break;
          case 'role': if (m.id === myId) { me.admin = m.admin; setMyAvatar(me.avatar, me.name, me.admin); } else if (players[m.id]) { var q = players[m.id]; addPlayer({ id: q.id, name: q.name, admin: m.admin, avatar: q.avatar, x: q.tx, y: q.ty, z: q.tz, r: q.tr }); } break;
          case 'tp': ctl.teleport(m.x, m.y, m.z); break;
          case 'place': loadPlace(m.place); break;
          case 'kick': alert(m.reason || 'You were removed from the game.'); exit(m.auth ? 'auth' : undefined); break;
        }
      };
      ws.onclose = function () {
        if (!running) return;
        if (!ready) { root.innerHTML = '<div class="auth"><div class="auth-r" style="grid-column:1/-1"><div class="box"><h2>Could not join</h2><p>The game may be full, unavailable, or your login expired.</p><button class="btn block" id="bk">Back</button></div></div></div>'; root.querySelector('#bk').onclick = function () { exit('auth'); }; return; }
        toast('Disconnected from the server.'); ctl.enabled = false; showMenu(true); var r = $('#mres'); if (r) r.style.display = 'none';
      };

      /* ---- buttons ---- */
      function closeAv() { $('#avov').classList.remove('on'); if (editor) { editor.destroy(); editor = null; } ctl.enabled = !chatOpen; }
      $('#bmenu').onclick = function () { showMenu(true); };
      $('#mres').onclick = function () { showMenu(false); };
      $('#mresp').onclick = function () { respawn(); showMenu(false); };
      $('#mleave').onclick = function () { exit(); };
      var fs = $('#mfs'); if (fs) fs.onclick = function () { try { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen(); } catch (e) { } };
      $('#mav').onclick = function () {
        showMenu(false); ctl.enabled = false; $('#avov').classList.add('on');
        editor = LunaApp.editor($('#avroot'), me.avatar, {
          onSave: function (av) { return Luna.api(o.server, '/api/avatar', { avatar: av }, o.token).then(function (r) { o.onAvatar && o.onAvatar(r.avatar); }); },
          onShop: function () { UI_noShop(); }
        }, o.editorCtx);
      };
      function UI_noShop() { LunaUI.toast('Visit the Shop from the main menu (leave the game first).'); }
      $('#avclose').onclick = closeAv;
      $('#csend').onclick = sendChat;
      $('#cinp').onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); sendChat(); } else if (e.key === 'Escape') closeChat(); };
      var bc = $('#bchat'); if (bc) bc.onclick = function () { chatOpen ? closeChat() : openChat(''); };
      var bp = $('#bpl'); if (bp) bp.onclick = function () { $('#plist').classList.toggle('on'); };
      $('#avov').addEventListener('mousedown', function (e) { e.stopPropagation(); });

      /* ---- main loop ---- */
      var fc = 0;
      function frame(now) {
        if (!running) return; requestAnimationFrame(frame);
        var dt = Math.min(0.1, (now - lastT) / 1000); lastT = now;
        ctl.update(dt);
        if (ctl.p.y < -80) respawn();
        if (++fc % 20 === 0) kindParts = world.place.parts.filter(function (p) { return p.kind && p.kind !== 'none'; });
        processKinds(); scripts.tick(dt);
        var k = 1 - Math.exp(-dt * 12);
        Object.keys(players).forEach(function (id) {
          var e = players[id], g = e.g, d = e.tr - g.rotation.y;
          g.position.x += (e.tx - g.position.x) * k; g.position.y += (e.ty - g.position.y) * k; g.position.z += (e.tz - g.position.z) * k;
          while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; g.rotation.y += d * k;
          e.t += dt; Luna.animate(g, e.t, e.s, e.a);
        });
        bubbles = bubbles.filter(function (b) { if (now > b.until) { b.host.remove(b.s); return false; } return true; });
        sky.update(dt, ctl.p);
        Luna.fitRenderer(renderer, camera, gameEl);
        renderer.render(scene, camera);
        if (now - lastSend > 66 && ws.readyState === 1) {
          var st = ctl.state(), msg = { t: 'pos', x: +st.x.toFixed(2), y: +st.y.toFixed(2), z: +st.z.toFixed(2), r: +st.r.toFixed(2), s: +st.s.toFixed(1), a: st.a ? 1 : 0 }, str = JSON.stringify(msg);
          if (str !== lastPos) { ws.send(str); lastPos = str; } lastSend = now;
        }
      }
    }
  };
})(window);
