/* Luna controller: third-person camera + WASD / touch joystick movement. */
(function (global) {
  'use strict';
  var Luna = global.Luna;

  Luna.makeRenderer = function (canvas, shadows) {
    var THREE = global.THREE, mobile = Luna.isMobile();
    var r = new THREE.WebGLRenderer({ canvas: canvas, antialias: !mobile });
    r.setPixelRatio(Math.min(global.devicePixelRatio || 1, mobile ? 1.5 : 2));
    if (shadows) { r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap; }
    return r;
  };

  Luna.fitRenderer = function (renderer, camera, el) {
    var w = el.clientWidth || 300, h = el.clientHeight || 200, pr = renderer.getPixelRatio(), c = renderer.domElement;
    if (c.width === Math.floor(w * pr) && c.height === Math.floor(h * pr)) return;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  };

  /* o: { dom (canvas), hud (element for touch UI), camera, avatar (Group), boxes (array), spawn [x,y,z], mobile } */
  Luna.Controller = function (o) {
    var self = this, THREE = global.THREE;
    this.enabled = true; this.walk = o.walk || Luna.WALK; this.jumpPower = o.jump || Luna.JUMP;
    this.p = { x: o.spawn[0], y: o.spawn[1], z: o.spawn[2], vx: 0, vy: 0, vz: 0, onGround: false };
    this.yaw = Math.PI; this.pitch = 0.35; this.dist = 16; this.rot = 0; this.t = 0; this.speed = 0;
    var keys = {}, joy = { x: 0, y: 0 }, jump = false, drag = false, last = [0, 0], touchCam = null, touchJoy = null, joyOrigin = [0, 0], cleanup = [], pinchLast = 0;

    function on(t, e, f, opt) { t.addEventListener(e, f, opt); cleanup.push(function () { t.removeEventListener(e, f, opt); }); }
    function typing(e) { var t = e.target; return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable); }

    on(global, 'keydown', function (e) {
      if (typing(e)) return;
      keys[e.code] = true;
      if (e.code === 'Space' && self.enabled) { jump = true; e.preventDefault(); }
      if (e.code === 'Enter' && o.onChatKey) o.onChatKey();
      if (e.code === 'Slash' && o.onChatKey) o.onChatKey('/');
      if (e.code === 'Escape' && o.onEscape) o.onEscape();
      if (e.code === 'Tab' && o.onTab) { e.preventDefault(); o.onTab(true); }
    });
    on(global, 'keyup', function (e) { keys[e.code] = false; if (e.code === 'Space') jump = false; if (e.code === 'Tab' && o.onTab) o.onTab(false); });
    on(global, 'blur', function () { keys = {}; jump = false; });
    on(o.dom, 'contextmenu', function (e) { e.preventDefault(); });
    on(o.dom, 'mousedown', function (e) { if (e.button === 2 || e.button === 1) { drag = true; last = [e.clientX, e.clientY]; } });
    on(global, 'mouseup', function () { drag = false; });
    on(global, 'mousemove', function (e) {
      if (!drag || !self.enabled) return;
      self.yaw -= (e.clientX - last[0]) * 0.006; self.pitch += (e.clientY - last[1]) * 0.006;
      self.pitch = Math.max(-0.25, Math.min(1.45, self.pitch)); last = [e.clientX, e.clientY];
    });
    on(o.dom, 'wheel', function (e) { self.dist = Math.max(4, Math.min(45, self.dist + e.deltaY * 0.02)); e.preventDefault(); }, { passive: false });

    /* touch UI */
    var layer, knob, base, jbtn;
    if (o.mobile && o.hud) {
      layer = document.createElement('div'); layer.className = 'touch-layer';
      base = document.createElement('div'); base.className = 'joy-base'; knob = document.createElement('div'); knob.className = 'joy-knob';
      base.appendChild(knob); layer.appendChild(base);
      jbtn = document.createElement('div'); jbtn.className = 'jump-btn'; jbtn.textContent = '⤒'; layer.appendChild(jbtn);
      o.hud.appendChild(layer);
      on(jbtn, 'touchstart', function (e) { jump = true; e.preventDefault(); e.stopPropagation(); }, { passive: false });
      on(jbtn, 'touchend', function () { jump = false; });
      on(layer, 'touchstart', function (e) {
        for (var i = 0; i < e.changedTouches.length; i++) {
          var t = e.changedTouches[i];
          if (t.target === jbtn) continue;
          if (t.clientX < global.innerWidth * 0.5 && touchJoy === null) {
            touchJoy = t.identifier; joyOrigin = [t.clientX, t.clientY];
            base.style.display = 'block'; base.style.left = (t.clientX - 60) + 'px'; base.style.top = (t.clientY - 60) + 'px'; knob.style.transform = 'translate(0,0)';
          } else if (touchCam === null) { touchCam = t.identifier; last = [t.clientX, t.clientY]; }
        }
        e.preventDefault();
      }, { passive: false });
      on(layer, 'touchmove', function (e) {
        for (var i = 0; i < e.changedTouches.length; i++) {
          var t = e.changedTouches[i];
          if (t.identifier === touchJoy) {
            var dx = t.clientX - joyOrigin[0], dy = t.clientY - joyOrigin[1], len = Math.hypot(dx, dy), max = 55;
            if (len > max) { dx = dx / len * max; dy = dy / len * max; }
            joy.x = dx / max; joy.y = -dy / max; knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
          } else if (t.identifier === touchCam) {
            self.yaw -= (t.clientX - last[0]) * 0.008; self.pitch = Math.max(-0.25, Math.min(1.45, self.pitch + (t.clientY - last[1]) * 0.008)); last = [t.clientX, t.clientY];
          }
        }
        /* two fingers (not the joystick) = pinch to zoom the camera */
        var free = []; for (var q = 0; q < e.touches.length; q++) if (e.touches[q].identifier !== touchJoy) free.push(e.touches[q]);
        if (free.length >= 2) {
          var pd = Math.hypot(free[0].clientX - free[1].clientX, free[0].clientY - free[1].clientY);
          if (pinchLast > 0) self.dist = Math.max(4, Math.min(45, self.dist * pinchLast / Math.max(20, pd)));
          pinchLast = pd;
        } else pinchLast = 0;
        e.preventDefault();
      }, { passive: false });
      var end = function (e) {
        for (var i = 0; i < e.changedTouches.length; i++) {
          var id = e.changedTouches[i].identifier;
          if (id === touchJoy) { touchJoy = null; joy.x = joy.y = 0; base.style.display = 'none'; }
          if (id === touchCam) touchCam = null;
        }
      };
      on(layer, 'touchend', end); on(layer, 'touchcancel', end);
    }

    this.teleport = function (x, y, z) { var p = self.p; p.x = x; p.y = y; p.z = z; p.vx = p.vy = p.vz = 0; };
    this.update = function (dt) {
      dt = Math.min(dt, 0.1); var p = self.p, ix = 0, iy = 0;
      if (self.enabled) {
        if (keys.KeyW || keys.ArrowUp) iy += 1; if (keys.KeyS || keys.ArrowDown) iy -= 1;
        if (keys.KeyD || keys.ArrowRight) ix += 1; if (keys.KeyA || keys.ArrowLeft) ix -= 1;
        ix += joy.x; iy += joy.y;
      } else jump = false;
      var l = Math.hypot(ix, iy); if (l > 1) { ix /= l; iy /= l; }
      var sy = Math.sin(self.yaw), cy = Math.cos(self.yaw);
      var dx = -sy * iy + cy * ix, dz = -cy * iy - sy * ix, mag = Math.hypot(dx, dz);
      p.vx = dx * self.walk; p.vz = dz * self.walk;
      if (jump && p.onGround) { p.vy = self.jumpPower || Luna.JUMP; p.onGround = false; }
      Luna.stepPlayer(p, o.boxes, dt);
      if (mag > 0.1) {
        var target = Math.atan2(dx, dz), d = target - self.rot;
        while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
        self.rot += d * Math.min(1, dt * 14);
      }
      self.speed = mag * self.walk; self.t += dt;
      var a = o.avatar; a.position.set(p.x, p.y, p.z); a.rotation.y = self.rot;
      Luna.animate(a, self.t, self.speed, !p.onGround);
      var cp = Math.cos(self.pitch), tx = p.x, ty = p.y + 3.4, tz = p.z;
      o.camera.position.set(tx + Math.sin(self.yaw) * cp * self.dist, ty + Math.sin(self.pitch) * self.dist, tz + Math.cos(self.yaw) * cp * self.dist);
      if (o.camera.position.y < 0.5) o.camera.position.y = 0.5;
      o.camera.lookAt(tx, ty, tz);
    };
    this.state = function () { var p = self.p; return { x: p.x, y: p.y, z: p.z, r: self.rot, s: self.speed, a: !p.onGround }; };
    this.destroy = function () { cleanup.forEach(function (f) { f(); }); if (layer && layer.parentNode) layer.parentNode.removeChild(layer); };
  };
})(window);
