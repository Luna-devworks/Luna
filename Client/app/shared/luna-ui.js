/* Luna UI helpers: icons, modals, toasts, thumbnails, item cards, 3D avatar viewer. */
(function (global) {
  'use strict';
  var Luna = global.Luna, UI = global.LunaUI = {};
  var ICONS = {
    home: '<path d="M2 8 8 2l6 6M4 7v7h8V7"/>',
    games: '<path d="M2 2h5v5H2zM9 2h5v5H9zM2 9h5v5H2zM9 9h5v5H9z"/>',
    user: '<path d="M5 2h6v6H5zM2 14v-3h12v3"/>',
    bag: '<path d="M3 5h10v9H3zM6 5V2h4v3"/>',
    cube: '<path d="M8 1l6 3.5v7L8 15 2 11.5v-7zM2 4.5 8 8l6-3.5M8 8v7"/>',
    search: '<path d="M2 2h8v8H2zM10 10l4 4"/>',
    close: '<path d="M3 3l10 10M13 3 3 13"/>',
    shirt: '<path d="M1 5l4-3 3 1.5L11 2l4 3-2 3-1-1v7H4V7L3 8z"/>',
    crown:'<path d="M2 12V5l3 3 3-5 3 5 3-3v7zM2 14h12"/>',
    moon: '<path d="M10 2A6 6 0 1 0 14 10A5 5 0 0 1 10 2Z"/>'
  };
  UI.icon = function (n, cls) { return '<svg class="ic' + (n === 'moon' ? ' fill' : '') + ' ' + (cls || '') + '" viewBox="0 0 16 16">' + (ICONS[n] || '') + '</svg>'; };
  UI.dust = function (n) { return '<span class="dust"><svg viewBox="0 0 16 16">' + ICONS.moon + '</svg>' + Luna.fmt(n) + '</span>'; };
  UI.kindTag = function (it) { return it.kind === 'unique' ? '<span class="tag uniq">Limited U</span>' : it.kind === 'limited' ? '<span class="tag lim">Limited</span>' : ''; };
  UI.badges = function (u) { return (u.owner ? '<span class="tag own">Owner</span>' : u.admin ? '<span class="tag adm">Admin</span>' : ''); };
  UI.disposeObj = function (o) {
    o.traverse(function (n) {
      if (n.geometry) n.geometry.dispose();
      if (n.material) (Array.isArray(n.material) ? n.material : [n.material]).forEach(function (m) { if (m.map) m.map.dispose(); m.dispose(); });
    });
  };

  /* ---------- modal / toast / confirm / prompt ---------- */
  UI.modal = function (title, html, o) {
    o = o || {};
    var ov = document.createElement('div'); ov.className = 'ov';
    ov.innerHTML = '<div class="modal' + (o.small ? ' sm' : '') + '"><div class="mh"><h3>' + Luna.esc(title) + '</h3><button class="xbtn" data-x aria-label="Close">' + UI.icon('close') + '</button></div><div class="mb">' + html + '</div></div>';
    document.body.appendChild(ov);
    var closed = false, api = {
      el: ov.querySelector('.mb'), q: function (s) { return ov.querySelector(s); },
      close: function () { if (closed) return; closed = true; document.removeEventListener('keydown', key); ov.remove(); if (o.onClose) o.onClose(); }
    };
    function key(e) { if (e.key === 'Escape') api.close(); }
    document.addEventListener('keydown', key);
    ov.addEventListener('mousedown', function (e) { if (e.target === ov) api.close(); });
    ov.querySelector('[data-x]').onclick = api.close;
    return api;
  };
  UI.toast = function (msg, bad) {
    var t = document.createElement('div'); t.className = 'gtoast' + (bad ? ' bad' : ''); t.textContent = msg; document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 3800);
  };
  UI.confirm = function (title, text, ok, danger) {
    return new Promise(function (res) {
      var done = false, m = UI.modal(title, '<p style="margin-top:0">' + text + '</p><div class="row" style="justify-content:flex-end"><button class="btn alt" data-n>Cancel</button><button class="btn' + (danger ? ' danger' : '') + '" data-y>' + Luna.esc(ok || 'OK') + '</button></div>', { small: true, onClose: function () { if (!done) res(false); } });
      m.q('[data-n]').onclick = function () { m.close(); }; m.q('[data-y]').onclick = function () { done = true; m.close(); res(true); };
    });
  };
  UI.prompt = function (title, label, value, type) {
    return new Promise(function (res) {
      var done = false, m = UI.modal(title, '<label style="margin-top:0">' + Luna.esc(label) + '</label><input type="' + (type || 'text') + '" id="pin" value="' + Luna.esc(value || '') + '"><div class="row" style="justify-content:flex-end;margin-top:14px"><button class="btn alt" data-n>Cancel</button><button class="btn" data-y>OK</button></div>', { small: true, onClose: function () { if (!done) res(null); } });
      var i = m.q('#pin'); setTimeout(function () { i.focus(); i.select(); }, 30);
      function ok() { done = true; var v = i.value; m.close(); res(v); }
      m.q('[data-n]').onclick = function () { m.close(); }; m.q('[data-y]').onclick = ok; i.onkeydown = function (e) { if (e.key === 'Enter') ok(); };
    });
  };

  /* ---------- cards ---------- */
  UI.thumb = function (g, server) {
    var bg = 'linear-gradient(160deg,' + (g.sky || '#FFE9D2') + ',#2a2040)', img = g.hasThumb ? 'url(' + server + '/api/thumb/' + g.id + '?v=' + g.updated + '),' : '';
    return '<div class="thumb" style="background-image:' + img + bg + '">' + (g.online ? '<span class="live">' + g.online + ' playing</span>' : '') + '</div>';
  };
  UI.gameCard = function (g, server) {
    return '<a class="card-g" data-g="' + g.id + '">' + UI.thumb(g, server) + '<div class="gt">' + Luna.esc(g.title) + '</div><div class="gm">by ' + Luna.esc(g.owner) + ' · ' + Luna.fmt(g.plays) + ' plays</div></a>';
  };
  UI.priceHtml = function (it) {
    if (it.canBuy) return UI.dust(it.price);
    if (it.lowest !== null && it.lowest !== undefined) return '<span class="hint" style="margin:0">From</span> ' + UI.dust(it.lowest);
    return '<span class="hint" style="margin:0">' + (it.soldOut ? 'Sold out' : 'Off sale') + '</span>';
  };
  UI.itemCard = function (it, on) {
    return '<div class="item' + (on ? ' on' : '') + '" data-i="' + it.id + '"><img src="' + Luna.itemIcon(it, 128) + '" alt=""><div class="tg">' + UI.kindTag(it) + '</div>' + (it.owned ? '<span class="ow tag on">Owned</span>' : '') +
      '<div class="in"><div class="nm">' + Luna.esc(it.name) + '</div><div class="pr">' + UI.priceHtml(it) + '</div></div></div>';
  };

  /* ---------- 3D avatar viewer ---------- */
  UI.AvatarView = function (el, av, o) {
    o = o || {};
    var canvas = document.createElement('canvas'); el.innerHTML = ''; el.appendChild(canvas);
    var alive = true, model = null, cur = Luna.cleanAvatar(av), dragging = false, lastX = 0, THREE, scene, camera, renderer;
    function rebuild() {
      if (!THREE) return; var y = model ? model.rotation.y : 0.5;
      if (model) { scene.remove(model); UI.disposeObj(model); }
      model = Luna.buildAvatar(cur); model.rotation.y = y; scene.add(model);
    }
    Luna.loadThree().then(function () {
      if (!alive) return; THREE = global.THREE; scene = new THREE.Scene(); camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
      camera.position.set(0, o.camY || 3.6, o.dist || 15); camera.lookAt(0, o.lookY || 2.7, 0);
      scene.add(new THREE.HemisphereLight(0xffffff, 0xffc9a0, 0.95));
      var d = new THREE.DirectionalLight(0xffffff, 0.6); d.position.set(5, 10, 8); scene.add(d);
      renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(global.devicePixelRatio || 1, 2));
      rebuild();
      var last = performance.now();
      (function loop(now) {
        if (!alive) return; requestAnimationFrame(loop);
        var dt = Math.min(0.1, (now - last) / 1000); last = now;
        var w = canvas.clientWidth, h = canvas.clientHeight;
        if (w && h && (canvas.width !== Math.floor(w * renderer.getPixelRatio()) || canvas.height !== Math.floor(h * renderer.getPixelRatio()))) { renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
        if (!dragging && model && o.spin !== 0) model.rotation.y += dt * (o.spin || 0.6);
        renderer.render(scene, camera);
      })(last);
    }).catch(function (e) { el.innerHTML = '<p class="hint" style="padding:16px">' + Luna.esc(e.message) + '</p>'; });
    canvas.addEventListener('pointerdown', function (e) { dragging = true; lastX = e.clientX; try { canvas.setPointerCapture(e.pointerId); } catch (er) { } });
    canvas.addEventListener('pointermove', function (e) { if (dragging && model) { model.rotation.y += (e.clientX - lastX) * 0.012; lastX = e.clientX; } });
    canvas.addEventListener('pointerup', function () { dragging = false; });
    return {
      set: function (a) { cur = Luna.cleanAvatar(a); rebuild(); },
      destroy: function () { alive = false; if (model) UI.disposeObj(model); if (renderer) { renderer.dispose(); try { renderer.forceContextLoss(); } catch (e) { } } el.innerHTML = ''; }
    };
  };
})(window);
