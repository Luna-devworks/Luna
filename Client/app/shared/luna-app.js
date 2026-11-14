/* Luna app: login, navigation shell, home, games, avatar, profiles, wallet. (Shop + owner tools live in luna-shop.js) */
(function (global) {
  'use strict';
  var Luna = global.Luna, UI = global.LunaUI, App = global.LunaApp = {};
  var $ = function (s, r) { return (r || document).querySelector(s); }, esc = Luna.esc;
  App.disposeObj = UI.disposeObj;

  function leftText(ms) { var s = Math.max(0, Math.ceil(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); return (h ? h + 'h ' : '') + (h || m ? m + 'm ' : '') + (s % 60) + 's'; }
  function para(s) { return esc(s).replace(/\n/g, '<br>'); }

  /* ---------------- avatar editor (body + wardrobe) ---------------- */
  /* cb: { onSave(av) -> Promise, onShop() }   ctx: { api(path, body) } */
  App.editor = function (el, avIn, cb, ctx) {
    cb = cb || {};
    var av = Luna.cleanAvatar(avIn), tab = 'body', slot = 'hat', inv = null, saveT = null, alive = true;
    el.innerHTML = '<div class="ed"><div class="prev"></div><div class="opts"></div></div>';
    var view = UI.AvatarView($('.prev', el), av), opts = $('.opts', el);

    function setMsg(t, cls) { var m = $('#avmsg', opts); if (m) { m.className = 'hint ' + (cls || ''); m.textContent = t; } }
    function strip() { var a = JSON.parse(JSON.stringify(av)); delete a.defs; return a; }
    function save() {
      if (!alive || !cb.onSave) return;
      Promise.resolve(cb.onSave(strip())).then(function () { setMsg('Saved. Your look is live.', 'ok'); }).catch(function (er) { setMsg(er.message, 'err'); });
    }
    function changed() { av = Luna.cleanAvatar(av); view.set(av); mark(); clearTimeout(saveT); setMsg('Saving…'); saveT = setTimeout(save, 700); }

    function swatches(key, list, label) {
      var h = '<label>' + label + '</label><div class="sw">';
      list.forEach(function (c) { h += '<i data-k="' + key + '" data-v="' + c + '" style="background:' + c + '"></i>'; });
      return h + '<input type="color" data-c="' + key + '" value="' + av[key] + '" title="Custom colour"></div>';
    }
    function chips(key, list, label) {
      var h = '<label>' + label + '</label><div class="chips">';
      list.forEach(function (c) { h += '<span class="chip" data-k="' + key + '" data-v="' + c + '">' + c + '</span>'; });
      return h + '</div>';
    }
    function bodyHtml() {
      return '<div class="row" style="margin:10px 0 0"><button class="btn sm alt" data-a="rand">Randomize</button><button class="btn sm alt" data-a="reset">Reset</button></div>' +
        swatches('skin', Luna.SKINS, 'Skin') + chips('face', Luna.FACES, 'Face') + chips('hair', Luna.HAIRS, 'Hair style') + swatches('hairColor', Luna.HAIR_COLORS, 'Hair colour') +
        swatches('shirt', Luna.PALETTE, 'Shirt colour') + chips('shirtStyle', Luna.SHIRT_STYLES, 'Shirt style') +
        swatches('pants', Luna.PALETTE, 'Pants colour') + chips('pantsStyle', Luna.PANTS_STYLES, 'Pants style') + swatches('shoes', Luna.PALETTE, 'Shoes') +
        '<div class="hint">Shirts, pants and faces from your wardrobe override these basic ones.</div>';
    }
    function wearHtml() {
      var h = '<div class="slotbar">';
      LunaData.SLOTS.forEach(function (s) { h += '<span class="chip' + (s === slot ? ' on' : '') + '" data-s="' + s + '">' + LunaData.SLOT_NAMES[s] + '</span>'; });
      h += '</div>';
      if (!inv) return h + '<div class="hint">Loading your items…</div>';
      var seen = {}, list = [];
      inv.items.forEach(function (e) { var d = inv.defs[e.item]; if (!d || d.slot !== slot) return; var s = seen[e.item]; if (!s) { s = seen[e.item] = { d: d, n: 0, free: 0 }; list.push(s); } s.n++; if (!e.listed) s.free++; });
      if (av.eq[slot]) h += '<button class="btn sm alt" data-off="1" style="margin-bottom:10px">Take off ' + esc(LunaData.SLOT_ONE[slot]) + '</button>';
      if (!list.length) return h + '<div class="empty">You do not own any ' + esc(LunaData.SLOT_NAMES[slot].toLowerCase()) + ' yet.<br><br><button class="btn sm" data-shop="1">Visit the shop</button></div>';
      h += '<div class="cards items">';
      list.forEach(function (s) {
        var c = UI.itemCard(Object.assign({}, s.d, { owned: 0 }), av.eq[slot] === s.d.id);
        if (!s.free) c = c.replace('<div class="in">', '<div class="in" style="opacity:.5"><div class="hint" style="margin:0 0 4px">Listed for sale</div>');
        else if (s.n > 1) c = c.replace('<div class="in">', '<div class="in"><div class="hint" style="margin:0 0 4px">x' + s.n + '</div>');
        h += c;
      });
      return h + '</div>';
    }
    function draw() {
      opts.innerHTML = '<div class="tabs2" style="margin-top:8px"><button data-t="body" class="' + (tab === 'body' ? 'on' : '') + '">Body</button><button data-t="wear" class="' + (tab === 'wear' ? 'on' : '') + '">Wardrobe</button></div><div id="avmsg" class="hint" style="margin:0 0 6px"></div><div id="tabc">' + (tab === 'body' ? bodyHtml() : wearHtml()) + '</div>';
      mark();
      if (tab === 'wear' && !inv && ctx) ctx.api('/api/inventory').then(function (r) { inv = r; Object.keys(r.defs).forEach(function (k) { Luna.itemCache[k] = r.defs[k]; }); if (alive && tab === 'wear') draw(); }).catch(function (e) { setMsg(e.message, 'err'); });
    }
    function mark() {
      Array.prototype.forEach.call(opts.querySelectorAll('[data-k]'), function (n) { n.classList.toggle('on', String(av[n.dataset.k]).toLowerCase() === n.dataset.v.toLowerCase()); });
      Array.prototype.forEach.call(opts.querySelectorAll('[data-c]'), function (n) { n.value = av[n.dataset.c]; });
    }
    opts.addEventListener('click', function (e) {
      var t = e.target.closest('[data-t],[data-k],[data-a],[data-s],[data-i],[data-off],[data-shop]'); if (!t) return;
      if (t.dataset.t) { tab = t.dataset.t; draw(); }
      else if (t.dataset.k) { av[t.dataset.k] = t.dataset.v; changed(); }
      else if (t.dataset.a === 'rand') { var r = Luna.randomAvatar(); r.eq = av.eq; r.defs = av.defs; av = r; changed(); draw(); }
      else if (t.dataset.a === 'reset') { var d = Luna.cleanAvatar(Luna.DEFAULT_AVATAR); d.eq = av.eq; d.defs = av.defs; av = d; changed(); draw(); }
      else if (t.dataset.s) { slot = t.dataset.s; draw(); }
      else if (t.dataset.off) { av.eq[slot] = ''; changed(); draw(); }
      else if (t.dataset.shop) { cb.onShop && cb.onShop(); }
      else if (t.dataset.i) {
        var id = t.dataset.i, def = inv && inv.defs[id]; if (!def) return;
        if (t.querySelector('[style*="opacity"]')) return UI.toast('That item is listed for sale. Take it off the market to wear it.', true);
        av.defs = av.defs || {}; av.defs[id] = def; av.eq[slot] = av.eq[slot] === id ? '' : id; changed(); draw();
      }
    });
    opts.addEventListener('input', function (e) { var k = e.target.dataset && e.target.dataset.c; if (!k) return; av[k] = e.target.value; changed(); });
    draw();
    return { destroy: function () { alive = false; clearTimeout(saveT); view.destroy(); el.innerHTML = ''; } };
  };

  /* ---------------- main app ---------------- */
  /* cfg: { el, mode: 'client' | 'mobile' | 'web', logo, playUrl, downloadUrl } */
  App.start = function (cfg) {
    var root = cfg.el, mode = cfg.mode, logo = cfg.logo || 'shared/logo.png', S = { server: '', token: '', user: null };
    var cleanups = [], editorInst = null, viewEl = null, studioInst = null, lc = Luna.config || {};

    function brand() { return '<div class="logo"><img src="' + logo + '" alt="">Luna</div>'; }
    function defaultServer() {
      if (lc.server) return lc.server.replace(/^https?:\/\//, '');
      var s = Luna.store.get('server', ''); if (s) return s;
      if (/^https?:$/.test(location.protocol) && !/pages\.dev$/.test(location.hostname) && location.hostname !== 'localhost' || location.port === '8080') return location.host;
      return 'localhost:8080';
    }
    function saveSession() { Luna.store.set('avatar', S.user && S.user.avatar); Luna.store.set('server', S.server.replace(/^https?:\/\//, '')); Luna.store.set('session', { server: S.server, token: S.token }); }
    function ctx() {
      return {
        get server() { return S.server; }, get token() { return S.token; }, get user() { return S.user; }, view: viewEl,
        api: function (p, b) { return Luna.api(S.server, p, b, S.token); },
        go: go, onCleanup: function (f) { cleanups.push(f); }, refreshMe: refreshMe, openStudio: openStudio, play: play
      };
    }

    function blockPC() {
      root.innerHTML = '<div class="auth"><div class="auth-l">' + brand() + '<h1>Mobile only</h1><p>Browser play is for phones and tablets. On a PC, play with the Luna app for Windows.</p></div><div class="auth-r"><div class="box"><h2>Get Luna for Windows</h2><p class="hint">One download. No setup.</p><a class="btn block" href="' + (cfg.downloadUrl || lc.downloadUrl || '#') + '">Download</a></div></div></div>';
    }

    /* ---------- login ---------- */
    function login(msg) {
      destroyAll();
      var showSrv = !(lc.server && lc.allowCustomServer === false);
      root.innerHTML = '<div class="auth"><div class="auth-l"><img src="' + logo + '" alt=""><h1>Luna</h1><p>Build worlds. Play with friends. Collect rare hats. Free, forever.</p></div>' +
        '<div class="auth-r"><div class="box"><h2>Sign in</h2><p class="hint" style="margin-top:0">New here? Pick "Create account".</p>' +
        '<div class="seg"><button data-m="login" class="on">Log in</button><button data-m="register">Create account</button></div>' +
        '<label>Username</label><input type="text" id="usr" autocapitalize="off" autocorrect="off" autocomplete="username" maxlength="20" placeholder="3-20 letters, numbers, _">' +
        '<label>Password</label><input type="password" id="pwd" autocomplete="current-password" placeholder="at least 6 characters">' +
        '<div id="ownerbox" style="display:none"><label>Owner code</label><input type="password" id="ocode" placeholder="only for the Luna owner account"></div>' +
        '<button class="btn block" id="go" style="margin-top:16px">Log in</button><div class="err" id="err">' + esc(msg || '') + '</div>' +
        (showSrv ? '<details class="adv"><summary>Server settings</summary><label>Luna server</label><input type="text" id="srv" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="localhost:8080"></details>' : '') +
        (global.lunaNative && global.lunaNative.startServer ? '<button class="btn alt sm block" id="host" style="margin-top:12px">Host a server on this PC</button><div class="hint" id="hostinfo"></div>' : '') +
        '<details class="adv"><summary>Owner setup</summary><div class="hint">The owner account is created by registering the name set as LUNA_OWNER on your server, with the owner code.</div><button class="btn alt sm" id="showown">I have an owner code</button></details>' +
        '</div></div></div>';
      var srv = $('#srv'); if (srv) srv.value = defaultServer();
      var kind = 'login', err = $('#err');
      Array.prototype.forEach.call(root.querySelectorAll('.seg button'), function (b) { b.onclick = function () { kind = b.dataset.m; Array.prototype.forEach.call(root.querySelectorAll('.seg button'), function (x) { x.classList.toggle('on', x === b); }); $('#go').textContent = kind === 'login' ? 'Log in' : 'Create account'; }; });
      $('#showown').onclick = function () { $('#ownerbox').style.display = 'block'; };
      function go() {
        var server = Luna.normServer(srv ? srv.value : defaultServer()), u = $('#usr').value.trim(), p = $('#pwd').value;
        err.className = 'err'; err.textContent = '';
        if (!server) { err.textContent = 'Enter the server address.'; return; }
        if (!/^[A-Za-z0-9_]{3,20}$/.test(u)) { err.textContent = 'Username must be 3-20 letters, numbers or _.'; return; }
        if (p.length < 6) { err.textContent = 'Password must be at least 6 characters.'; return; }
        $('#go').disabled = true; err.className = 'err hint'; err.textContent = 'Connecting…';
        Luna.wake(server, function (s) { err.textContent = 'Waking the server up… ' + s + 's (free hosting can take about a minute)'; })
          .then(function () { err.textContent = 'Signing in…'; return Luna.api(server, '/api/' + kind, { username: u, password: p, ownerCode: $('#ocode').value, avatar: kind === 'register' ? Luna.randomAvatar() : undefined }); })
          .then(function (r) { S.server = server; S.token = r.token; S.user = r.user; saveSession(); go2home(); })
          .catch(function (e) { $('#go').disabled = false; err.className = 'err'; err.textContent = e.message; });
      }
      $('#go').onclick = go; $('#pwd').onkeydown = function (e) { if (e.key === 'Enter') go(); };
      var h = $('#host');
      if (h) h.onclick = function () {
        h.disabled = true;
        global.lunaNative.startServer().then(function (r) {
          if (srv) srv.value = 'localhost:' + r.port;
          $('#hostinfo').innerHTML = 'Server running. Friends on your network can join with <b>' + r.addresses.map(function (a) { return a + ':' + r.port; }).join('</b> or <b>') + '</b>. The first account you create is the owner.';
        }).catch(function (e) { $('#hostinfo').textContent = 'Could not start: ' + e.message; h.disabled = false; });
      };
    }
    function logout() { try { Luna.api(S.server, '/api/logout', {}, S.token).catch(function () { }); } catch (e) { } Luna.store.del('session'); S.token = ''; S.user = null; login(); }
    function destroyAll() { runCleanups(); if (studioInst) { studioInst = null; } }
    function runCleanups() { var c = cleanups; cleanups = []; c.forEach(function (f) { try { f(); } catch (e) { } }); if (editorInst) { editorInst.destroy(); editorInst = null; } }

    /* ---------- shell + router ---------- */
    var NAV = [['home', 'Home', 'home'], ['games', 'Games', 'games'], ['avatar', 'Avatar', 'shirt'], ['shop', 'Shop', 'bag'], ['create', 'Create', 'cube'], ['profile', 'Profile', 'user']];
    function renderShell() {
      var nav = NAV.slice(); if (S.user.owner) nav.push(['owner', 'Owner', 'crown']);
      root.innerHTML = '<div class="shell"><aside class="side">' + brand() + '<nav class="nav">' + nav.map(function (n) { return '<button data-r="' + n[0] + '">' + UI.icon(n[2]) + '<span>' + n[1] + '</span></button>'; }).join('') + '</nav></aside>' +
        '<div class="main"><header class="bar">' + brand() + '<span class="sp"></span><button class="chip" id="dustbtn" title="Wallet"></button><button class="chip" id="userbtn"></button></header><div class="view" id="view"></div></div></div>';
      viewEl = $('#view'); refreshBar();
      Array.prototype.forEach.call(root.querySelectorAll('.nav button'), function (b) { b.onclick = function () { go(b.dataset.r === 'profile' ? 'profile/' + S.user.name : b.dataset.r); }; });
      $('#dustbtn').onclick = walletModal; $('#userbtn').onclick = userModal;
      viewEl.addEventListener('click', function (e) {
        var t = e.target.closest('[data-g],[data-p],[data-i]'); if (!t) return;
        if (t.dataset.g) go('game/' + t.dataset.g); else if (t.dataset.p) go('profile/' + t.dataset.p); else if (t.dataset.i && global.LunaShop) global.LunaShop.itemModal(ctx(), t.dataset.i);
      });
    }
    function refreshBar() {
      var d = $('#dustbtn'), u = $('#userbtn'); if (d) d.innerHTML = UI.dust(S.user.dust); if (u) u.innerHTML = esc(S.user.name) + UI.badges(S.user);
    }
    function refreshMe() { return Luna.api(S.server, '/api/me', null, S.token).then(function (r) { S.user = r.user; refreshBar(); return S.user; }); }
    function go(h) { var t = '#/' + h; if (location.hash === t) route(); else location.hash = t; }
    function go2home() { renderShell(); if (!/^#\/./.test(location.hash) || /^#\/studio/.test(location.hash)) location.hash = '#/home'; route(); }
    function route() {
      if (!S.user) return;
      var parts = location.hash.replace(/^#\//, '').split('/'), r = parts[0] || 'home', arg = decodeURIComponent(parts.slice(1).join('/') || '');
      if (r === 'studio') { openStudio(arg === 'new' ? '' : arg); return; }
      if (!viewEl || !viewEl.isConnected) renderShell();
      runCleanups(); viewEl.scrollTop = 0;
      var navKey = r === 'game' ? 'games' : r;
      Array.prototype.forEach.call(root.querySelectorAll('.nav button'), function (b) { b.classList.toggle('on', b.dataset.r === navKey || (b.dataset.r === 'profile' && r === 'profile' && arg.toLowerCase() === S.user.name.toLowerCase())); });
      var fn = { home: pgHome, games: pgGames, game: pgGame, avatar: pgAvatar, profile: pgProfile, create: pgCreate, shop: pgShop, owner: pgOwner }[r] || pgHome;
      try { fn(arg); } catch (e) { viewEl.innerHTML = '<div class="wrap"><div class="empty">Something went wrong: ' + esc(e.message) + '</div></div>'; }
    }
    global.addEventListener('hashchange', function () { if (S.user && root.isConnected && !root.querySelector('.game') ) route(); });

    /* ---------- modals ---------- */
    function claimWidget(el) {
      var timer = null;
      function draw() {
        var left = S.user.nextClaim - Date.now();
        el.innerHTML = '<h3>Moon Dust</h3><div class="bigprice">' + UI.dust(S.user.dust) + '</div>' +
          (left > 0 ? '<button class="btn block" disabled>Next claim in ' + leftText(left) + '</button>' : '<button class="btn block" id="cl">Claim free Moon Dust</button>') +
          '<p class="hint">Claim <b>50+ Moon Dust every 5 hours</b>. It is free, always. Claim again within 10 hours to grow a streak bonus (up to +50).' + (S.user.streak > 1 ? ' Current streak: <b>' + S.user.streak + '</b>.' : '') + '</p>';
        var b = $('#cl', el); if (b) b.onclick = function () {
          b.disabled = true;
          Luna.api(S.server, '/api/dust/claim', {}, S.token).then(function (r) { S.user.dust = r.dust; S.user.nextClaim = r.nextClaim; S.user.streak = r.streak; refreshBar(); UI.toast('+' + r.gained + ' Moon Dust' + (r.bonus ? ' (streak bonus +' + r.bonus + ')' : '')); draw(); })
            .catch(function (e) { UI.toast(e.message, true); refreshMe().then(draw); });
        };
      }
      draw(); timer = setInterval(function () { if (!el.isConnected) { clearInterval(timer); return; } draw(); }, 1000);
      return function () { clearInterval(timer); };
    }
    function walletModal() {
      var m = UI.modal('Wallet', '<div id="cw"></div><h3 style="margin:18px 0 8px;font-size:13px;color:var(--o2)">Recent activity</h3><div id="txl" class="hint">Loading…</div>');
      claimWidget(m.q('#cw'));
      Luna.api(S.server, '/api/wallet', null, S.token).then(function (w) {
        m.q('#txl').innerHTML = w.log.length ? '<table class="t">' + w.log.slice(0, 20).map(function (x) { return '<tr><td>' + esc(x.why) + '</td><td style="text-align:right;color:' + (x.d > 0 ? 'var(--grn)' : '#ff8a8e') + '">' + (x.d > 0 ? '+' : '') + Luna.fmt(x.d) + '</td></tr>'; }).join('') + '</table>' : 'Nothing yet.';
      }).catch(function () { });
    }
    function userModal() {
      var m = UI.modal(S.user.name, '<div class="row" style="flex-direction:column;align-items:stretch"><button class="btn" data-a="p">View profile</button><button class="btn alt" data-a="w">Wallet</button><button class="btn danger" data-a="o">Log out</button></div><div class="hint">Connected to ' + esc(S.server.replace(/^https?:\/\//, '')) + '</div>', { small: true });
      m.el.onclick = function (e) { var a = e.target.dataset && e.target.dataset.a; if (!a) return; m.close(); if (a === 'p') go('profile/' + S.user.name); else if (a === 'w') walletModal(); else logout(); };
    }

    /* ---------- pages ---------- */
    function pgHome() {
      viewEl.innerHTML = '<div class="wrap"><h1 class="pt">Welcome back, ' + esc(S.user.name) + '</h1><p class="sub">Jump in, build something, or pick up a new hat.</p>' +
        '<div class="grid2"><div class="panel"><div class="row" style="align-items:stretch;flex-wrap:nowrap"><div class="prev" id="hv" style="width:150px;flex:none;aspect-ratio:3/4"></div><div class="sp"><h3>Luna Hub</h3><p class="hint">The social space of Luna. Hang out, chat and show off your style.</p><button class="btn" id="hub">Play</button><div class="hint" id="hubinfo"></div></div></div></div><div class="panel" id="claim"></div></div>' +
        '<h2 class="st">Popular games</h2><div class="cards" id="pop"><div class="hint">Loading…</div></div><h2 class="st">New in the shop</h2><div class="cards items" id="newi"></div></div>';
      var hv = UI.AvatarView($('#hv'), S.user.avatar); cleanups.push(function () { hv.destroy(); });
      cleanups.push(claimWidget($('#claim')));
      $('#hub').onclick = function () { play('hub'); };
      Luna.api(S.server, '/api/games?sort=popular', null, S.token).then(function (r) {
        $('#pop').innerHTML = r.games.length ? r.games.slice(0, 8).map(function (g) { return UI.gameCard(g, S.server); }).join('') : '<div class="empty">No games yet.</div>';
        var hub = r.games.filter(function (g) { return g.id === 'hub'; })[0]; if (hub && $('#hubinfo')) $('#hubinfo').innerHTML = '<span class="dot"></span>' + hub.online + ' online';
      }).catch(function (e) { $('#pop').innerHTML = '<div class="empty">' + esc(e.message) + '</div>'; });
      Luna.api(S.server, '/api/shop?sort=new', null, S.token).then(function (r) { $('#newi').innerHTML = r.items.slice(0, 6).map(function (i) { Luna.itemCache[i.id] = i; return UI.itemCard(i); }).join(''); }).catch(function () { });
    }

    function pgGames() {
      var st = { tab: 'games', sort: 'popular', genre: '', q: '' };
      viewEl.innerHTML = '<div class="wrap"><h1 class="pt">Discover</h1><div class="tabs2"><button data-t="games" class="on">Games</button><button data-t="people">People</button></div><div id="gp"></div></div>';
      function games() {
        $('#gp').innerHTML = '<div class="filters"><input type="search" id="gq" placeholder="Search games" value="' + esc(st.q) + '"><select id="gs"><option value="popular">Popular</option><option value="new">Newest</option></select><select id="gg"><option value="">All genres</option>' + LunaData.GENRES.map(function (g) { return '<option>' + g + '</option>'; }).join('') + '</select></div><div class="cards" id="gl"></div>';
        $('#gs').value = st.sort; $('#gg').value = st.genre;
        var t = null;
        function load() { Luna.api(S.server, '/api/games?sort=' + st.sort + '&genre=' + encodeURIComponent(st.genre) + '&q=' + encodeURIComponent(st.q), null, S.token).then(function (r) { var l = $('#gl'); if (l) l.innerHTML = r.games.length ? r.games.map(function (g) { return UI.gameCard(g, S.server); }).join('') : '<div class="empty" style="grid-column:1/-1">No games found.</div>'; }).catch(function (e) { var l = $('#gl'); if (l) l.innerHTML = '<div class="empty">' + esc(e.message) + '</div>'; }); }
        $('#gq').oninput = function () { st.q = this.value; clearTimeout(t); t = setTimeout(load, 300); }; $('#gs').onchange = function () { st.sort = this.value; load(); }; $('#gg').onchange = function () { st.genre = this.value; load(); };
        load();
      }
      function people() {
        $('#gp').innerHTML = '<div class="filters"><input type="search" id="pq" placeholder="Search players by name"></div><div id="pl"><div class="empty">Type a name to find someone.</div></div>';
        var t = null; $('#pq').oninput = function () {
          var v = this.value.trim(); clearTimeout(t); if (!v) { $('#pl').innerHTML = '<div class="empty">Type a name to find someone.</div>'; return; }
          t = setTimeout(function () { Luna.api(S.server, '/api/users/search?q=' + encodeURIComponent(v), null, S.token).then(function (r) { $('#pl').innerHTML = r.users.length ? r.users.map(function (u) { return '<div class="lrow" data-p="' + esc(u.name) + '" style="cursor:pointer"><b>' + esc(u.name) + '</b>' + UI.badges(u) + '<span class="sp"></span><span class="hint" style="margin:0"><span class="dot' + (u.online ? '' : ' off') + '"></span>' + (u.online ? 'Online' : 'Offline') + '</span></div>'; }).join('') : '<div class="empty">No players found.</div>'; }); }, 300);
        };
      }
      viewEl.querySelector('.tabs2').onclick = function (e) { var b = e.target.closest('button'); if (!b) return; st.tab = b.dataset.t; Array.prototype.forEach.call(this.children, function (x) { x.classList.toggle('on', x === b); }); st.tab === 'games' ? games() : people(); };
      games();
    }

    function pgGame(id) {
      viewEl.innerHTML = '<div class="wrap"><div class="hint">Loading…</div></div>';
      Luna.api(S.server, '/api/game/' + encodeURIComponent(id), null, S.token).then(function (r) {
        var g = r.game;
        viewEl.innerHTML = '<div class="wrap"><div class="grid2" style="grid-template-columns:1.3fr 1fr"><div style="border:2px solid var(--line)">' + UI.thumb(g, S.server) + '</div><div>' +
          '<h1 class="pt">' + esc(g.title) + '</h1><p class="sub">by <a href="javascript:void 0" data-p="' + esc(g.owner) + '">' + esc(g.owner) + '</a> · <span class="tag">' + esc(g.genre) + '</span>' + (g.status !== 'public' ? ' <span class="tag off">Draft</span>' : '') + '</p>' +
          '<div class="row"><button class="btn" id="pl">Play</button><button class="btn alt" id="lk">' + (g.liked ? 'Liked' : 'Like') + ' · <span id="lkn">' + g.likes + '</span></button></div>' +
          '<div class="stats" style="margin-top:16px;grid-template-columns:repeat(3,1fr)"><div class="stat"><b>' + Luna.fmt(g.plays) + '</b><span>Plays</span></div><div class="stat"><b>' + g.online + '</b><span>Playing now</span></div><div class="stat"><b>' + g.maxPlayers + '</b><span>Max players</span></div></div></div></div>' +
          '<h2 class="st">About this game</h2><div class="panel">' + (g.desc ? para(g.desc) : '<span class="hint">No description.</span>') + '<div class="hint">Updated ' + Luna.ago(g.updated) + '</div></div>' +
          (g.canEdit ? '<div class="row"><button class="btn alt" id="ed">Edit in Studio</button>' + (g.id !== 'hub' ? '<button class="btn danger" id="dl">Delete</button>' : '') + '</div>' : '') + '</div>';
        $('#pl').onclick = function () { play(g.id); };
        $('#lk').onclick = function () { Luna.api(S.server, '/api/game/like', { id: g.id }, S.token).then(function (x) { $('#lk').firstChild.textContent = x.liked ? 'Liked · ' : 'Like · '; $('#lkn').textContent = x.likes; }).catch(function (e) { UI.toast(e.message, true); }); };
        var ed = $('#ed'); if (ed) ed.onclick = function () { go('studio/' + g.id); };
        var dl = $('#dl'); if (dl) dl.onclick = function () { UI.confirm('Delete game', 'Delete "' + esc(g.title) + '" for good?', 'Delete', true).then(function (y) { if (y) Luna.api(S.server, '/api/game/delete', { id: g.id }, S.token).then(function () { go('create'); }).catch(function (e) { UI.toast(e.message, true); }); }); };
      }).catch(function (e) { viewEl.innerHTML = '<div class="wrap"><div class="empty">' + esc(e.message) + '</div></div>'; });
    }

    function pgAvatar() {
      viewEl.innerHTML = '<div class="wrap"><h1 class="pt">Avatar</h1><p class="sub">Drag the preview to turn around. Changes save automatically.</p><div id="edroot"></div></div>';
      editorInst = App.editor($('#edroot'), S.user.avatar, {
        onSave: function (av) { return Luna.api(S.server, '/api/avatar', { avatar: av }, S.token).then(function (r) { S.user.avatar = r.avatar; Luna.store.set('avatar', r.avatar); }); },
        onShop: function () { go('shop'); }
      }, ctx());
    }

    function pgProfile(name) {
      name = name || S.user.name;
      viewEl.innerHTML = '<div class="wrap"><div class="hint">Loading…</div></div>';
      Luna.api(S.server, '/api/profile/' + encodeURIComponent(name), null, S.token).then(function (p) {
        function items(list, sel) { return list.length ? '<div class="cards items">' + list.map(function (x) { var it = sel ? x.item : x; Luna.itemCache[it.id] = it; var c = UI.itemCard(Object.assign({}, it, { owned: 0 })); return x.serial ? c.replace('<div class="nm">', '<div class="nm">#' + x.serial + ' ') : c; }).join('') + '</div>' : '<div class="hint">Nothing here yet.</div>'; }
        viewEl.innerHTML = '<div class="wrap"><div class="prof"><div><div class="panel" style="padding:0"><div class="prev pv" id="pv" style="border:0"></div></div>' +
          '<div class="pname">' + esc(p.name) + ' ' + UI.badges(p) + '</div><div class="hint" style="margin:0"><span class="dot' + (p.online ? '' : ' off') + '"></span>' + (p.online ? 'Online' : 'Last seen ' + Luna.ago(p.lastSeen)) + '</div></div>' +
          '<div><div class="panel"><div class="row"><h3 class="sp">About</h3>' + (p.me ? '<button class="btn sm alt" id="eb">Edit</button>' : '') + '</div><div id="bio">' + (p.bio ? para(p.bio) : '<span class="hint">No bio yet.</span>') + '</div></div>' +
          '<div class="stats"><div class="stat"><b>' + p.stats.games + '</b><span>Games</span></div><div class="stat"><b>' + Luna.fmt(p.stats.plays) + '</b><span>Plays</span></div><div class="stat"><b>' + p.stats.items + '</b><span>Items</span></div><div class="stat"><b>' + new Date(p.created).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) + '</b><span>Joined</span></div></div>' +
          '<div class="panel"><h3>Currently wearing</h3>' + items(p.wearing) + '</div><div class="panel"><h3>Collectibles</h3>' + items(p.collectibles, true) + '</div>' +
          '<div class="panel"><h3>Creations</h3>' + (p.games.length ? '<div class="cards">' + p.games.map(function (g) { return UI.gameCard(g, S.server); }).join('') + '</div>' : '<div class="hint">No public games yet.</div>') + '</div></div></div></div>';
        var pv = UI.AvatarView($('#pv'), p.avatar); cleanups.push(function () { pv.destroy(); });
        var eb = $('#eb'); if (eb) eb.onclick = function () {
          var m = UI.modal('Edit bio', '<textarea id="bt" maxlength="240" rows="4" placeholder="Tell people about yourself">' + esc(p.bio) + '</textarea><div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn" id="bs">Save</button></div>', { small: true });
          m.q('#bs').onclick = function () { Luna.api(S.server, '/api/bio', { bio: m.q('#bt').value }, S.token).then(function (r) { S.user.bio = r.bio; m.close(); pgProfile(p.name); }).catch(function (e) { UI.toast(e.message, true); }); };
        };
      }).catch(function (e) { viewEl.innerHTML = '<div class="wrap"><div class="empty">' + esc(e.message) + '</div></div>'; });
    }

    function pgCreate() {
      viewEl.innerHTML = '<div class="wrap"><div class="row"><h1 class="pt sp">Create</h1><button class="btn" id="nw">New game</button></div><p class="sub">Build a world in Luna Studio, describe it, and publish it for everyone. No logo needed: Luna takes the thumbnail for you.</p><div id="mg"><div class="hint">Loading…</div></div></div>';
      $('#nw').onclick = function () { go('studio/new'); };
      Luna.api(S.server, '/api/my/games', null, S.token).then(function (r) {
        $('#mg').innerHTML = r.games.length ? r.games.map(function (g) {
          return '<div class="lrow">' + UI.thumb(g, S.server) + '<div class="mid"><b>' + esc(g.title) + '</b> <span class="tag ' + (g.status === 'public' ? 'on' : 'off') + '">' + (g.status === 'public' ? 'Public' : 'Draft') + '</span><div class="hint" style="margin:4px 0 0">' + Luna.fmt(g.plays) + ' plays · ' + g.likes + ' likes · updated ' + Luna.ago(g.updated) + '</div></div>' +
            '<button class="btn sm" data-ed="' + g.id + '">Edit</button><button class="btn sm alt" data-g="' + g.id + '">View</button></div>';
        }).join('') : '<div class="empty">You have not made a game yet. Press "New game" to start.</div>';
        $('#mg').onclick = function (e) { var b = e.target.closest('[data-ed]'); if (b) go('studio/' + b.dataset.ed); };
      }).catch(function (e) { $('#mg').innerHTML = '<div class="empty">' + esc(e.message) + '</div>'; });
    }
    function pgShop() { global.LunaShop ? global.LunaShop.page(ctx()) : (viewEl.innerHTML = '<div class="empty">Shop not loaded.</div>'); }
    function pgOwner() { global.LunaShop ? global.LunaShop.ownerPage(ctx()) : (viewEl.innerHTML = '<div class="empty">Not loaded.</div>'); }

    /* ---------- studio + game ---------- */
    function openStudio(gameId) {
      if (!global.LunaStudio) { UI.toast('Studio is not available here.', true); go('create'); return; }
      runCleanups(); root.innerHTML = '<div id="studioroot" style="position:fixed;inset:0"></div>';
      global.LunaStudio.start({ el: $('#studioroot'), logo: logo, gameId: gameId || '', session: { server: S.server, token: S.token }, onExit: function () { location.hash = '#/create'; renderShell(); route(); } });
    }
    function play(gameId) {
      if (mode === 'web' && !(Luna.isMobile() && cfg.playUrl)) { UI.modal('Play on mobile or in the app', '<p style="margin-top:0">Browser play is for phones and tablets. On a PC, play with the Luna app for Windows.</p><a class="btn block" href="' + (cfg.downloadUrl || lc.downloadUrl || '#') + '">Download for Windows</a>', { small: true }); return; }
      if (mode === 'web') { location.href = cfg.playUrl + '#/game/' + gameId; return; }
      runCleanups();
      global.LunaGame.start({
        server: S.server, token: S.token, user: S.user, mode: mode, root: root, logo: logo, gameId: gameId,
        onAvatar: function (av) { S.user.avatar = av; },
        onExit: function (reason) { if (reason === 'auth') logout(); else { renderShell(); location.hash = '#/game/' + gameId; route(); } },
        editorCtx: ctx()
      });
    }

    /* ---------- boot ---------- */
    if (mode === 'mobile' && !Luna.isMobile()) { blockPC(); return; }
    var ses = Luna.session();
    if (ses) {
      root.innerHTML = '<div class="loading"><div class="spin"></div><div id="bs">Signing in…</div></div>';
      Luna.wake(ses.server, function (s) { var b = $('#bs'); if (b) b.textContent = 'Waking the server up… ' + s + 's'; })
        .then(function () { return Luna.api(ses.server, '/api/me', null, ses.token); })
        .then(function (r) { S.server = ses.server; S.token = ses.token; S.user = r.user; go2home(); })
        .catch(function (e) { if (e && e.status === 401) { Luna.store.del('session'); login(); } else login(e && e.message); });
    } else login();
  };
})(window);
