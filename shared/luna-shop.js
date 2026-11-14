/* Luna shop: browse + buy items, limited marketplace (resale with 20% owner fee), and the owner's item maker. */
(function (global) {
  'use strict';
  var Luna = global.Luna, UI = global.LunaUI, D = global.LunaData, esc = Luna.esc, Shop = global.LunaShop = {};
  var $ = function (s, r) { return (r || document).querySelector(s); };

  /* ---------------- shop page ---------------- */
  Shop.page = function (ctx) {
    var v = ctx.view, st = { slot: '', sort: 'new', q: '' }, t = null;
    v.innerHTML = '<div class="wrap"><h1 class="pt">Shop</h1><p class="sub">Spend Moon Dust on hats, faces, shirts and more. Limited items can be traded between players.</p>' +
      '<div class="tabs2" id="stabs"><button data-s="" class="on">All</button>' + D.SLOTS.map(function (s) { return '<button data-s="' + s + '">' + D.SLOT_NAMES[s] + '</button>'; }).join('') + '</div>' +
      '<div class="filters"><input type="search" id="sq" placeholder="Search items"><select id="ss"><option value="new">Newest</option><option value="popular">Best selling</option><option value="low">Price: low to high</option><option value="high">Price: high to low</option></select></div><div class="cards items" id="il"><div class="hint">Loading…</div></div></div>';
    function load() {
      ctx.api('/api/shop?slot=' + st.slot + '&sort=' + st.sort + '&q=' + encodeURIComponent(st.q)).then(function (r) {
        var l = $('#il'); if (!l) return;
        r.items.forEach(function (i) { Luna.itemCache[i.id] = i; });
        l.innerHTML = r.items.length ? r.items.map(function (i) { return UI.itemCard(i); }).join('') : '<div class="empty" style="grid-column:1/-1">Nothing here yet.</div>';
      }).catch(function (e) { var l = $('#il'); if (l) l.innerHTML = '<div class="empty">' + esc(e.message) + '</div>'; });
    }
    $('#stabs').onclick = function (e) { var b = e.target.closest('button'); if (!b) return; st.slot = b.dataset.s; Array.prototype.forEach.call(this.children, function (x) { x.classList.toggle('on', x === b); }); load(); };
    $('#sq').oninput = function () { st.q = this.value; clearTimeout(t); t = setTimeout(load, 300); };
    $('#ss').onchange = function () { st.sort = this.value; load(); };
    load();
  };

  /* ---------------- item window ---------------- */
  Shop.itemModal = function (ctx, id) {
    var view = null, m = UI.modal('Item', '<div class="hint">Loading…</div>', { onClose: function () { if (view) view.destroy(); } });
    function load() { ctx.api('/api/item/' + encodeURIComponent(id)).then(render).catch(function (e) { m.el.innerHTML = '<div class="empty">' + esc(e.message) + '</div>'; }); }
    function wear(it) {
      var av = Luna.cleanAvatar(ctx.user.avatar); delete av.defs; av.eq[it.slot] = it.id;
      ctx.api('/api/avatar', { avatar: av }).then(function (r) { ctx.user.avatar = r.avatar; Luna.store.set('avatar', r.avatar); UI.toast('Now wearing ' + it.name); }).catch(function (e) { UI.toast(e.message, true); });
    }
    function render(r) {
      var it = r.item, my = r.mine; Luna.itemCache[it.id] = it;
      var av = Luna.cleanAvatar(ctx.user.avatar); av.eq[it.slot] = it.id; av.defs = Object.assign({}, av.defs); av.defs[it.id] = it;
      var h = '<div class="im"><div><div class="prev" id="iv"></div><div class="hint" style="text-align:center">Drag to turn. This is you, trying it on.</div></div><div>' +
        '<h2 style="font-size:22px">' + esc(it.name) + '</h2><div class="row" style="margin:6px 0">' + UI.kindTag(it) + '<span class="tag">' + esc(D.SLOT_ONE[it.slot]) + '</span><span class="hint" style="margin:0">by <a href="javascript:void 0" data-p="' + esc(it.creator) + '">' + esc(it.creator) + '</a></span></div>' +
        '<p style="margin:8px 0">' + esc(it.desc || 'No description.') + '</p>';
      if (it.kind === 'unique') h += '<div class="hint">Limited Unique: ' + (it.stock != null ? 'only ' + Luna.fmt(it.stock) + ' will ever be sold' : 'limited stock') + '. Every copy has its own serial number. ' + (it.remaining != null ? '<b>' + Luna.fmt(it.remaining) + ' left.</b>' : '') + '</div>';
      else if (it.kind === 'limited') h += '<div class="hint">Limited: can be traded with other players.' + (it.remaining != null ? ' <b>' + Luna.fmt(it.remaining) + ' left.</b>' : '') + '</div>';
      if (it.canBuy) h += '<div class="bigprice">' + UI.dust(it.price) + '</div>' + (it.kind === 'normal' && it.owned ? '<button class="btn" data-w="1">Wear</button> <span class="tag on">Owned</span>' : '<button class="btn" id="buy">Buy from Luna</button>');
      else h += '<div class="bigprice"><span class="hint">' + (it.soldOut ? 'Sold out' : 'Off sale') + ' from Luna</span></div>' + (it.owned && it.kind === 'normal' ? '<button class="btn" data-w="1">Wear</button>' : '');
      if (it.kind !== 'normal') {
        h += '<h3 style="margin:18px 0 8px;font-size:13px;color:var(--o2)">Resellers</h3>';
        h += r.resellers.length ? '<table class="t"><tr><th>Seller</th>' + (it.kind === 'unique' ? '<th>Serial</th>' : '') + '<th>Price</th><th></th></tr>' + r.resellers.map(function (x) {
          return '<tr><td>' + esc(x.seller) + '</td>' + (it.kind === 'unique' ? '<td>#' + x.serial + '</td>' : '') + '<td>' + UI.dust(x.price) + '</td><td>' + (x.mine ? '<span class="hint" style="margin:0">Yours</span>' : '<button class="btn sm" data-rb="' + x.uid + '" data-rp="' + x.price + '">Buy</button>') + '</td></tr>';
        }).join('') + '</table>' : '<div class="hint">Nobody is selling this right now.</div>';
        if (my.length) {
          h += '<h3 style="margin:18px 0 8px;font-size:13px;color:var(--o2)">Your copies</h3><table class="t">' + my.map(function (x) {
            return '<tr><td>' + (x.serial ? '#' + x.serial : 'Copy') + '</td><td>' + (x.listed ? 'Listed for ' + UI.dust(x.listed) : '<span class="hint" style="margin:0">Not for sale</span>') + '</td><td style="text-align:right">' + (x.listed ? '<button class="btn sm alt" data-un="' + x.uid + '">Take off sale</button> ' : '') + '<button class="btn sm alt" data-sl="' + x.uid + '">' + (x.listed ? 'Change price' : 'Sell') + '</button></td></tr>';
          }).join('') + '</table><div class="hint">When you sell to another player, ' + Math.round(D.FEE * 100) + '% of the price goes to the Luna owner and you keep the rest.</div><button class="btn sm" data-w="1" style="margin-top:8px">Wear one</button>';
        }
      }
      h += '</div></div>';
      m.el.innerHTML = h;
      if (view) view.destroy(); view = UI.AvatarView(m.q('#iv'), av);
      var b = m.q('#buy'); if (b) b.onclick = function () { UI.confirm('Buy ' + it.name, 'Pay ' + Luna.fmt(it.price) + ' Moon Dust?', 'Buy').then(function (y) { if (y) buy({ item: it.id }); }); };
      m.el.onclick = function (e) {
        var t = e.target.closest('[data-rb],[data-sl],[data-un],[data-w]'); if (!t) return;
        if (t.dataset.w) return wear(it);
        if (t.dataset.rb) return UI.confirm('Buy ' + it.name, 'Pay ' + Luna.fmt(+t.dataset.rp) + ' Moon Dust to another player?', 'Buy').then(function (y) { if (y) buy({ item: it.id, listing: t.dataset.rb }); });
        if (t.dataset.un) return ctx.api('/api/sell', { uid: t.dataset.un, price: 0 }).then(function () { UI.toast('Taken off sale.'); load(); }).catch(function (er) { UI.toast(er.message, true); });
        if (t.dataset.sl) UI.prompt('Sell ' + it.name, 'Price in Moon Dust (you get ' + Math.round((1 - D.FEE) * 100) + '%)', '', 'number').then(function (p) {
          if (p === null) return; ctx.api('/api/sell', { uid: t.dataset.sl, price: Math.floor(+p) }).then(function (r2) { UI.toast('Listed. You will get ' + Luna.fmt(r2.youGet) + ' Moon Dust when it sells.'); load(); }).catch(function (er) { UI.toast(er.message, true); });
        });
      };
    }
    function buy(body) { ctx.api('/api/buy', body).then(function (r) { UI.toast('Purchased!'); ctx.refreshMe(); load(); }).catch(function (e) { UI.toast(e.message, true); }); }
    load();
  };

  /* ---------------- owner dashboard ---------------- */
  Shop.ownerPage = function (ctx) {
    var v = ctx.view, tab = 'items', editing = null, destroyMaker = null;
    v.innerHTML = '<div class="wrap"><h1 class="pt">Owner dashboard</h1><p class="sub">Only you can see this. Make hats and other items, set prices, and create limited editions.</p><div class="tabs2" id="ot"><button data-t="items" class="on">Items</button><button data-t="make">Item maker</button><button data-t="eco">Economy</button></div><div id="oc"></div></div>';
    ctx.onCleanup(function () { if (destroyMaker) destroyMaker(); });
    function setTab(t) { if (destroyMaker) { destroyMaker(); destroyMaker = null; } tab = t; Array.prototype.forEach.call($('#ot').children, function (x) { x.classList.toggle('on', x.dataset.t === t); }); (t === 'items' ? items : t === 'make' ? maker : eco)(); }
    $('#ot').onclick = function (e) { var b = e.target.closest('button'); if (b) { editing = null; setTab(b.dataset.t); } };

    function items() {
      var c = $('#oc'); c.innerHTML = '<div class="hint">Loading…</div>';
      ctx.api('/api/owner/items').then(function (r) {
        c.innerHTML = '<div style="overflow:auto"><table class="t"><tr><th></th><th>Name</th><th>Type</th><th>Price</th><th>Sold</th><th>Status</th><th></th></tr>' + r.items.map(function (it) {
          Luna.itemCache[it.id] = it;
          return '<tr><td><img src="' + Luna.itemIcon(it, 48) + '" width="40" height="40" style="image-rendering:pixelated" alt=""></td><td><b>' + esc(it.name) + '</b><div class="hint" style="margin:0">' + esc(D.SLOT_ONE[it.slot]) + '</div></td><td>' + (UI.kindTag(it) || '<span class="tag">Normal</span>') + '</td><td>' + UI.dust(it.price) + '</td><td>' + Luna.fmt(it.sold) + (it.stock != null ? ' / ' + Luna.fmt(it.stock) : '') + '</td><td><span class="tag ' + (it.canBuy ? 'on' : 'off') + '">' + (it.canBuy ? 'On sale' : it.soldOut ? 'Sold out' : 'Off sale') + '</span></td><td><button class="btn sm alt" data-e="' + it.id + '">Edit</button></td></tr>';
        }).join('') + '</table></div>';
        c.onclick = function (e) { var b = e.target.closest('[data-e]'); if (!b) return; editing = r.items.filter(function (x) { return x.id === b.dataset.e; })[0]; setTab('make'); };
      }).catch(function (e) { c.innerHTML = '<div class="empty">' + esc(e.message) + '</div>'; });
    }

    function eco() {
      var c = $('#oc'); c.innerHTML = '<div class="hint">Loading…</div>';
      ctx.api('/api/owner/stats').then(function (s) {
        c.innerHTML = '<div class="stats"><div class="stat"><b>' + UI.dust(s.balance) + '</b><span>Your balance</span></div><div class="stat"><b>' + Luna.fmt(s.sales) + '</b><span>Items sold</span></div><div class="stat"><b>' + Luna.fmt(s.users) + '</b><span>Accounts</span></div><div class="stat"><b>' + Luna.fmt(s.online) + '</b><span>Online now</span></div></div>' +
          '<div class="panel"><h3>How money flows</h3><p class="hint" style="margin-top:0">Items you make are sold under your name: <b>100%</b> of the Moon Dust from the shop goes to you. When players resell Limited items to each other, the seller gets ' + Math.round((1 - D.FEE) * 100) + '% and <b>' + Math.round(D.FEE * 100) + '%</b> goes to you. Everyone also gets free Moon Dust every ' + D.CLAIM_HOURS + ' hours. Moon Dust in circulation: ' + Luna.fmt(s.circulating) + '. Storage: ' + esc(s.storage) + '.</p></div>' +
          '<div class="panel"><h3>Give Moon Dust</h3><div class="row"><input type="text" id="gn" placeholder="Username" style="flex:1;min-width:140px"><input type="number" id="ga" placeholder="Amount" style="width:140px"><button class="btn" id="gb">Send</button></div><div class="hint">Use a negative amount to take Moon Dust away.</div></div>' +
          '<div class="panel"><h3>Your recent activity</h3>' + (s.log.length ? '<table class="t">' + s.log.slice(0, 25).map(function (x) { return '<tr><td>' + esc(x.why) + '</td><td style="text-align:right;color:' + (x.d > 0 ? 'var(--grn)' : '#ff8a8e') + '">' + (x.d > 0 ? '+' : '') + Luna.fmt(x.d) + '</td></tr>'; }).join('') + '</table>' : '<div class="hint">Nothing yet.</div>') + '</div>';
        $('#gb').onclick = function () { ctx.api('/api/owner/grant', { name: $('#gn').value, amount: +$('#ga').value }).then(function (r) { UI.toast('Done. They now have ' + Luna.fmt(r.dust) + '.'); }).catch(function (e) { UI.toast(e.message, true); }); };
      }).catch(function (e) { c.innerHTML = '<div class="empty">' + esc(e.message) + '</div>'; });
    }

    /* ----- item maker ----- */
    function maker() {
      var it = editing ? JSON.parse(JSON.stringify(editing)) : { id: '', name: '', desc: '', slot: 'hat', kind: 'normal', price: 100, stock: null, onSale: true, data: { parts: [] } };
      it.data = D.cleanItemData(it.slot, it.data); if (it.onSale === undefined) it.onSale = true;
      var locked = !!(editing && editing.sold > 0), pv, pt = null, c = $('#oc');
      c.innerHTML = '<div class="mk"><div>' +
        '<div class="panel"><h3>' + (editing ? 'Edit item' : 'New item') + '</h3><label>Name</label><input type="text" id="mn" maxlength="40"><label>Description</label><textarea id="md" rows="2" maxlength="200"></textarea>' +
        '<div class="pr3" style="grid-template-columns:1fr 1fr;gap:10px"><div><label>Type of item</label><select id="ms"' + (locked ? ' disabled' : '') + '>' + D.SLOTS.map(function (s) { return '<option value="' + s + '">' + D.SLOT_ONE[s] + '</option>'; }).join('') + '</select></div>' +
        '<div><label>Rarity</label><select id="mk"' + (locked ? ' disabled' : '') + '><option value="normal">Normal (anyone, unlimited)</option><option value="limited">Limited (tradable)</option><option value="unique">Limited Unique (numbered)</option></select></div>' +
        '<div><label>Price (Moon Dust)</label><input type="number" id="mp" min="0"></div><div><label>Stock (blank = unlimited)</label><input type="number" id="mst" min="0" placeholder="unlimited"></div></div>' +
        '<label style="display:flex;gap:8px;align-items:center;text-transform:none;letter-spacing:0;font-size:14px"><input type="checkbox" id="mo"> On sale in the shop</label>' +
        '<div class="hint">Limited items can be resold by players (you earn ' + Math.round(D.FEE * 100) + '% of every resale). Limited Unique items get serial numbers #1, #2, #3… and need a stock number.</div></div>' +
        '<div class="panel" id="sd"></div></div>' +
        '<div><div class="prev" id="mv"></div><div class="row" style="margin-top:12px"><button class="btn sp" id="msave">' + (editing ? 'Save changes' : 'Create item') + '</button>' + (editing && !editing.sold ? '<button class="btn danger" id="mdel">Delete</button>' : '') + '</div><div class="err" id="merr"></div></div></div>';
      $('#mn').value = it.name; $('#md').value = it.desc; $('#ms').value = it.slot; $('#mk').value = it.kind; $('#mp').value = it.price; $('#mst').value = it.stock == null ? '' : it.stock; $('#mo').checked = it.onSale !== false;
      pv = UI.AvatarView($('#mv'), Luna.cleanAvatar(ctx.user.avatar));
      destroyMaker = function () { pv.destroy(); clearTimeout(pt); };

      function preview() {
        clearTimeout(pt); pt = setTimeout(function () {
          var av = Luna.cleanAvatar(ctx.user.avatar); av.eq[it.slot] = 'preview_item'; av.defs = Object.assign({}, av.defs, { preview_item: { id: 'preview_item', name: it.name, slot: it.slot, data: D.cleanItemData(it.slot, it.data) } }); pv.set(av);
        }, 120);
      }
      function colorIn(k, val) { return '<input type="color" data-k="' + k + '" value="' + val + '">'; }
      function slotEditor() {
        var s = it.slot, d = it.data, h = '<h3>Design</h3>';
        if (s === 'face') {
          h += '<label>Expression</label><select data-k="expr">' + D.FACE_EXPRS.map(function (x) { return '<option>' + x + '</option>'; }).join('') + '</select><label>Feature colour</label>' + colorIn('color', d.color);
        } else if (s === 'shirt') {
          h += '<label>Pattern</label><select data-k="pattern">' + D.SHIRT_PATTERNS.map(function (x) { return '<option>' + x + '</option>'; }).join('') + '</select><div class="pr3" style="grid-template-columns:1fr 1fr;gap:10px"><div><label>Main colour</label>' + colorIn('c1', d.c1) + '</div><div><label>Accent colour</label>' + colorIn('c2', d.c2) + '</div></div>';
        } else if (s === 'pants') {
          h += '<div class="pr3" style="grid-template-columns:1fr 1fr;gap:10px"><div><label>Pattern</label><select data-k="pattern">' + D.PANTS_PATTERNS.map(function (x) { return '<option>' + x + '</option>'; }).join('') + '</select></div><div><label>Length</label><select data-k="style"><option>long</option><option>shorts</option></select></div><div><label>Main colour</label>' + colorIn('c1', d.c1) + '</div><div><label>Accent colour</label>' + colorIn('c2', d.c2) + '</div></div>';
        } else {
          h += '<div class="row"><select id="tpl" style="flex:1"><option value="">Start from…</option>' + D.SEED_ITEMS.filter(function (x) { return x.slot === s; }).map(function (x) { return '<option value="' + x.id + '">' + esc(x.name) + '</option>'; }).join('') + '</select><button class="btn sm" id="addp">+ Add part</button></div>' +
            '<div class="hint">Parts are boxes, cylinders and spheres. ' + (s === 'back' ? 'Positions are relative to the torso; the back is -Z.' : 'Positions are relative to the head (top of head is Y 0.65, front is +Z).') + ' Max 40 parts.</div><div id="plist">';
          d.parts.forEach(function (p, i) {
            var r = p.r || [0, 0, 0];
            h += '<div class="panel" style="padding:8px;margin:8px 0" data-pi="' + i + '"><div class="row" style="gap:6px"><select data-f="t" style="width:auto"><option value="b"' + (p.t === 'b' ? ' selected' : '') + '>Box</option><option value="c"' + (p.t === 'c' ? ' selected' : '') + '>Cylinder</option><option value="s"' + (p.t === 's' ? ' selected' : '') + '>Sphere</option></select><input type="color" data-f="c" value="' + p.c + '" style="width:60px"><label style="margin:0;display:flex;gap:4px;align-items:center;text-transform:none;letter-spacing:0"><input type="checkbox" data-f="g"' + (p.g ? ' checked' : '') + '>Glow</label><span class="sp"></span><button class="btn sm alt" data-dup="' + i + '">Copy</button><button class="btn sm danger" data-del="' + i + '">X</button></div>' +
              '<label>Size W H D</label><div class="pr3">' + [0, 1, 2].map(function (k) { return '<input type="number" step="0.05" data-f="s.' + k + '" value="' + p.s[k] + '">'; }).join('') + '</div><label>Position X Y Z</label><div class="pr3">' + [0, 1, 2].map(function (k) { return '<input type="number" step="0.05" data-f="p.' + k + '" value="' + p.p[k] + '">'; }).join('') + '</div><label>Rotate X Y Z (degrees)</label><div class="pr3">' + [0, 1, 2].map(function (k) { return '<input type="number" step="5" data-f="r.' + k + '" value="' + r[k] + '">'; }).join('') + '</div></div>';
          });
          h += '</div>';
        }
        $('#sd').innerHTML = h;
        Array.prototype.forEach.call($('#sd').querySelectorAll('select[data-k]'), function (n) { n.value = d[n.dataset.k]; });
      }
      function basics() { it.name = $('#mn').value; it.desc = $('#md').value; it.kind = $('#mk').value; it.price = Math.max(0, Math.floor(+$('#mp').value || 0)); var st = $('#mst').value; it.stock = st === '' ? null : Math.max(0, Math.floor(+st)); it.onSale = $('#mo').checked; }
      ['mn', 'md', 'mk', 'mp', 'mst', 'mo'].forEach(function (id) { $('#' + id).oninput = $('#' + id).onchange = basics; });
      $('#ms').onchange = function () { it.slot = this.value; it.data = D.cleanItemData(it.slot, {}); if (it.slot === 'hat' || it.slot === 'acc' || it.slot === 'back') it.data.parts = [{ t: 'b', s: [1, 1, 1], p: [0, it.slot === 'hat' ? 1.2 : 0, 0], c: '#FF7A00' }]; slotEditor(); preview(); };
      var sd = $('#sd');
      sd.addEventListener('input', function (e) {
        var n = e.target, k = n.dataset.k, f = n.dataset.f;
        if (k) { it.data[k] = n.value; preview(); return; }
        if (!f) return; var row = n.closest('[data-pi]'), p = it.data.parts[+row.dataset.pi]; if (!p) return;
        var val = n.type === 'checkbox' ? (n.checked ? 1 : 0) : n.type === 'number' ? parseFloat(n.value) : n.value;
        if (n.type === 'number' && !isFinite(val)) return;
        if (f.indexOf('.') > 0) { var a = f.split('.'); if (a[0] === 'r' && !p.r) p.r = [0, 0, 0]; p[a[0]][+a[1]] = val; } else if (f === 'g') { if (val) p.g = 1; else delete p.g; } else p[f] = val;
        preview();
      });
      sd.addEventListener('click', function (e) {
        var t = e.target, parts = it.data.parts;
        if (t.id === 'addp') { if (parts.length < 40) { parts.push({ t: 'b', s: [1, 1, 1], p: [0, 0, 0], c: '#FFFFFF' }); slotEditor(); preview(); } }
        else if (t.dataset.del) { parts.splice(+t.dataset.del, 1); slotEditor(); preview(); }
        else if (t.dataset.dup) { var q = JSON.parse(JSON.stringify(parts[+t.dataset.dup])); q.p[0] = -q.p[0]; if (parts.length < 40) { parts.push(q); slotEditor(); preview(); } }
      });
      sd.addEventListener('change', function (e) {
        if (e.target.id === 'tpl' && e.target.value) { var sd0 = D.SEED_MAP[e.target.value]; it.data = D.cleanItemData(it.slot, JSON.parse(JSON.stringify(sd0.data))); slotEditor(); preview(); }
        else if (e.target.dataset.f === 't') { /* handled by input */ }
      });
      $('#msave').onclick = function () {
        basics(); var err = $('#merr'); err.textContent = '';
        var body = { id: it.id || '', name: it.name, desc: it.desc, slot: it.slot, kind: it.kind, price: it.price, stock: it.stock, onSale: it.onSale, data: it.data };
        ctx.api('/api/owner/item', body).then(function () { UI.toast(editing ? 'Saved.' : 'Item created and in the shop.'); editing = null; setTab('items'); }).catch(function (er) { err.textContent = er.message; });
      };
      var del = $('#mdel'); if (del) del.onclick = function () { UI.confirm('Delete item', 'Delete "' + esc(it.name) + '"? Nobody owns it yet.', 'Delete', true).then(function (y) { if (y) ctx.api('/api/owner/item/delete', { id: it.id }).then(function () { editing = null; setTab('items'); }).catch(function (er) { UI.toast(er.message, true); }); }); };
      slotEditor(); preview();
    }
    items();
  };
})(window);
