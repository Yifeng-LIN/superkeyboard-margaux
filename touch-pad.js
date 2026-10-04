/* =====================================================================
   touch-pad.js — manettes tactiles partagées des jeux « Jeu Margaux »
   ---------------------------------------------------------------------
   Affiche une croix directionnelle (ou un joystick) et des boutons
   d'action en bas de l'écran, et envoie de VRAIES touches clavier :
   les jeux déjà écrits au clavier fonctionnent sans être modifiés.

   Utilisation dans un jeu :
     <script src="../touch-pad.js"></script>
     <script>TouchPad.init({
       dpad: 'arrows',                       // ou false, ou {up:'KeyW',...}
       buttons: [{ label:'💣', sub:'bombe', code:'Space', key:' ' }],
       home: '../',                          // bouton ✕ en haut à gauche
     });</script>
   ===================================================================== */
(function (global) {
  'use strict';

  var KEYCODES = { ArrowUp:38, ArrowDown:40, ArrowLeft:37, ArrowRight:39, Space:32, Enter:13, Escape:27,
                   KeyW:87, KeyA:65, KeyS:83, KeyD:68, KeyQ:81, KeyZ:90, KeyE:69, KeyR:82, KeyF:70, KeyC:67, ShiftLeft:16 };
  var KEYNAMES = { ArrowUp:'ArrowUp', ArrowDown:'ArrowDown', ArrowLeft:'ArrowLeft', ArrowRight:'ArrowRight',
                   Space:' ', Enter:'Enter', Escape:'Escape', KeyW:'w', KeyA:'a', KeyS:'s', KeyD:'d',
                   KeyQ:'q', KeyZ:'z', KeyE:'e', KeyR:'r', KeyF:'f', KeyC:'c', ShiftLeft:'Shift' };

  var coarse = matchMedia('(any-pointer: coarse)').matches || (navigator.maxTouchPoints || 0) > 0 || 'ontouchstart' in window;
  var fine   = matchMedia('(any-pointer: fine)').matches;
  var active = coarse && !fine;     // tablette / téléphone sans souris
  var used   = false;               // un doigt a touché l'écran : on bascule définitivement
  var root = null, cfg = null, held = {};

  /* ---------- envoi de vraies touches clavier ---------- */
  function fire(type, code, key) {
    var kc = KEYCODES[code] || 0;
    var ev;
    try {
      ev = new KeyboardEvent(type, { key: key, code: code, keyCode: kc, which: kc, bubbles: true, cancelable: true, composed: true });
    } catch (e) {                                   // très vieux navigateurs
      ev = document.createEvent('Event'); ev.initEvent(type, true, true);
      ev.key = key; ev.code = code; ev.keyCode = kc; ev.which = kc;
    }
    try { Object.defineProperty(ev, 'keyCode', { get: function () { return kc; } }); } catch (e) {}
    try { Object.defineProperty(ev, 'which',   { get: function () { return kc; } }); } catch (e) {}
    (document.activeElement && document.activeElement !== document.body ? document.activeElement : document).dispatchEvent(ev);
  }
  function press(code, key, repeat) {
    if (held[code]) return;
    held[code] = { key: key };
    fire('keydown', code, key);
    if (repeat) held[code].timer = setInterval(function () { fire('keydown', code, key); }, 110);
  }
  function release(code) {
    var h = held[code]; if (!h) return;
    if (h.timer) clearInterval(h.timer);
    delete held[code];
    fire('keyup', code, h.key);
  }
  function releaseAll() { Object.keys(held).forEach(release); }

  /* ---------- styles ---------- */
  var CSS = [
    '#tpad,#tpad *{box-sizing:border-box;-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none}',
    '#tpad{position:fixed;inset:0;z-index:2147483000;pointer-events:none;font-family:"Fredoka",system-ui,"Segoe UI",sans-serif}',
    '#tpad.off{display:none}',
    '#tpad button{pointer-events:auto;border:3px solid rgba(255,255,255,.92);color:#1d3557;font-family:inherit;font-weight:700;cursor:pointer;',
    'background:radial-gradient(circle at 40% 33%,rgba(255,255,255,.97),rgba(206,220,236,.92));box-shadow:0 5px 0 rgba(0,0,0,.26),0 9px 20px rgba(0,0,0,.3);line-height:1;touch-action:none}',
    '#tpad button:active{transform:translateY(3px);box-shadow:0 2px 0 rgba(0,0,0,.26)}',
    '#tpad button small{display:block;font-size:10px;font-weight:600;opacity:.72;margin-top:2px}',
    /* croix directionnelle */
    '#tp-dpad{position:absolute;left:calc(14px + env(safe-area-inset-left));bottom:calc(14px + env(safe-area-inset-bottom));',
    'display:grid;grid-template-columns:repeat(3,56px);grid-template-rows:repeat(3,56px);gap:5px}',
    '#tp-dpad button{border-radius:16px;font-size:23px}',
    '#tp-dpad .sp{pointer-events:none}',
    /* joystick */
    '#tp-stick{position:absolute;left:calc(18px + env(safe-area-inset-left));bottom:calc(18px + env(safe-area-inset-bottom));width:146px;height:146px;border-radius:50%;',
    'background:radial-gradient(circle,rgba(255,255,255,.2),rgba(255,255,255,.07));border:3px solid rgba(255,255,255,.5);box-shadow:0 6px 18px rgba(0,0,0,.3);pointer-events:auto;touch-action:none}',
    '#tp-knob{position:absolute;left:50%;top:50%;width:64px;height:64px;margin:-32px 0 0 -32px;border-radius:50%;',
    'background:radial-gradient(circle at 40% 35%,#fff,#cfd8e3);border:3px solid rgba(255,255,255,.95);box-shadow:0 4px 12px rgba(0,0,0,.35)}',
    /* boutons d'action */
    '#tp-acts{position:absolute;right:calc(16px + env(safe-area-inset-right));bottom:calc(16px + env(safe-area-inset-bottom));display:flex;flex-direction:row-reverse;align-items:flex-end;gap:12px}',
    '#tp-acts button{width:88px;height:88px;border-radius:50%;font-size:30px}',
    '#tp-acts button:nth-child(n+2){width:72px;height:72px;font-size:25px}',
    /* barre du haut : retour + plein écran */
    '#tp-top{position:absolute;left:calc(10px + env(safe-area-inset-left));top:calc(10px + env(safe-area-inset-top));display:flex;gap:8px}',
    '#tp-top button{height:42px;padding:0 15px;border-radius:21px;font-size:16px}',
    '#tp-top button.fs{width:42px;padding:0;border-radius:21px;font-size:18px}',
    '#tp-sheet{position:absolute;inset:0;background:rgba(0,0,0,.55);display:none;align-items:center;justify-content:center;pointer-events:auto;padding:16px}',
    '#tp-sheet.open{display:flex}',
    '#tp-sheet>div{background:#fff;border-radius:22px;padding:16px;max-width:min(560px,94vw);max-height:84vh;overflow-y:auto;touch-action:pan-y;box-shadow:0 18px 50px rgba(0,0,0,.45)}',
    '#tp-sheet h4{font-size:19px;margin-bottom:12px;color:#1d3557;text-align:center}',
    '#tp-sheet .gr{display:grid;grid-template-columns:repeat(auto-fill,minmax(128px,1fr));gap:9px}',
    '#tp-sheet .gr button{height:52px;border-radius:14px;font-size:15px;padding:0 10px}',
    '#tp-sheet .cl{margin-top:12px;width:100%;height:46px;border-radius:14px;font-size:16px}',
    '#tp-rot{position:fixed;inset:0;background:rgba(10,14,25,.93);color:#fff;z-index:2147483100;display:none;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:24px}',
    '#tp-rot.on{display:flex}',
    '#tp-rot .ph{font-size:72px;animation:tprot 1.8s ease-in-out infinite}',
    '@keyframes tprot{0%,40%{transform:rotate(0)}60%,100%{transform:rotate(-90deg)}}',
    '#tp-rot p{font-size:20px;font-weight:700;margin-top:18px;line-height:1.5}',
    '#tp-rot small{display:block;font-size:14px;opacity:.7;margin-top:10px}',
    '#tp-help{position:absolute;left:50%;transform:translateX(-50%);top:calc(62px + env(safe-area-inset-top));max-width:76vw;text-align:center;',
    'background:rgba(0,0,0,.5);color:#fff;font-size:13px;padding:6px 12px;border-radius:12px;transition:opacity .7s;pointer-events:none}',
    '#tp-help.gone{opacity:0}',
    /* petits écrans / paysage bas */
    '@media (max-width:560px),(max-height:430px){',
    '#tp-dpad{grid-template-columns:repeat(3,46px);grid-template-rows:repeat(3,46px)}#tp-dpad button{font-size:19px;border-radius:13px}',
    '#tp-stick{width:116px;height:116px}#tp-knob{width:52px;height:52px;margin:-26px 0 0 -26px}',
    '#tp-acts button{width:70px;height:70px;font-size:25px}#tp-acts button:nth-child(n+2){width:58px;height:58px;font-size:21px}',
    '#tp-top button{height:36px;padding:0 12px;font-size:14px}#tp-help{font-size:11.5px;max-width:78vw;top:calc(54px + env(safe-area-inset-top))}}'
  ].join('');

  function el(tag, id, html) { var e = document.createElement(tag); if (id) e.id = id; if (html != null) e.innerHTML = html; return e; }

  function bindHold(btn, code, key, repeat) {
    btn.addEventListener('pointerdown', function (e) {
      e.preventDefault(); e.stopPropagation(); switchOn();
      try { btn.setPointerCapture(e.pointerId); } catch (err) {}
      press(code, key, repeat);
    });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (ev) {
      btn.addEventListener(ev, function () { release(code); });
    });
  }

  function build() {
    root = el('div', 'tpad'); root.className = active ? '' : 'off';
    var st = el('style'); st.textContent = CSS; document.head.appendChild(st);

    /* --- haut : retour au menu + plein écran (jamais en bas) --- */
    var top = el('div', 'tp-top');
    if (cfg.home !== false) {
      var home = el('button', null, '✕ Menu');
      home.addEventListener('click', function () { releaseAll(); location.href = cfg.home || '../'; });
      top.appendChild(home);
    }
    (cfg.topButtons || []).forEach(function (b) {
      var t = el('button', null, b.label + (b.sub ? '<small>' + b.sub + '</small>' : ''));
      if (b.onClick) t.addEventListener('click', b.onClick);
      else t.addEventListener('pointerdown', function (e) { e.preventDefault(); switchOn(); press(b.code, b.key || KEYNAMES[b.code] || '', false); setTimeout(function () { release(b.code); }, 90); });
      top.appendChild(t);
    });
    var doc = document.documentElement;
    if (cfg.fullscreen !== false && (doc.requestFullscreen || doc.webkitRequestFullscreen)) {
      var fs = el('button', 'tp-fs', '⛶'); fs.className = 'fs';
      fs.addEventListener('click', function () {
        var cur = document.fullscreenElement || document.webkitFullscreenElement;
        if (cur) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
        else { var r = doc.requestFullscreen || doc.webkitRequestFullscreen; var p = r.call(doc); if (p && p.catch) p.catch(function () {}); }
      });
      top.appendChild(fs);
    }
    root.appendChild(top);

    /* --- déplacement --- */
    var map = cfg.dpad;
    if (map === 'arrows') map = { up:'ArrowUp', down:'ArrowDown', left:'ArrowLeft', right:'ArrowRight' };
    else if (map === 'wasd') map = { up:'KeyW', down:'KeyS', left:'KeyA', right:'KeyD' };
    if (map) {
      if (cfg.stick === 'joystick') buildStick(map); else buildDpad(map);
    }

    /* --- boutons d'action --- */
    if (cfg.buttons && cfg.buttons.length) {
      var acts = el('div', 'tp-acts');
      cfg.buttons.forEach(function (b) {
        var btn = el('button', null, b.label + (b.sub ? '<small>' + b.sub + '</small>' : ''));
        bindHold(btn, b.code, b.key != null ? b.key : (KEYNAMES[b.code] || ''), !!b.repeat);
        acts.appendChild(btn);
      });
      root.appendChild(acts);
    }

    if (cfg.menu && cfg.menu.items && cfg.menu.items.length) {
      var sheet = el('div', 'tp-sheet'), inner = el('div');
      inner.appendChild(el('h4', null, cfg.menu.title || 'Actions'));
      var gr = el('div'); gr.className = 'gr';
      cfg.menu.items.forEach(function (it) {
        var b = el('button', null, it.label);
        b.addEventListener('click', function () {
          switchOn(); press(it.code, it.key != null ? it.key : (KEYNAMES[it.code] || ''), false);
          setTimeout(function () { release(it.code); }, 90);
          sheet.classList.remove('open');
        });
        gr.appendChild(b);
      });
      inner.appendChild(gr);
      var close = el('button', null, 'Fermer'); close.className = 'cl';
      close.addEventListener('click', function () { sheet.classList.remove('open'); });
      inner.appendChild(close); sheet.appendChild(inner);
      sheet.addEventListener('click', function (e) { if (e.target === sheet) sheet.classList.remove('open'); });
      root.appendChild(sheet);
      var open = el('button', null, (cfg.menu.label || '⚙') + '<small>actions</small>');
      open.addEventListener('click', function () { switchOn(); sheet.classList.add('open'); });
      top.appendChild(open);
    }
    if (cfg.landscape) {
      var rot = el('div', 'tp-rot', '<div class="ph">📱</div><p>Tourne ton téléphone<br>pour jouer !</p><small>Ce jeu se joue en écran large</small>');
      document.body.appendChild(rot);
      var checkRot = function () {
        var portrait = innerHeight > innerWidth && innerWidth < 820;
        rot.classList.toggle('on', !!(portrait && (active || used)));
      };
      addEventListener('resize', checkRot); addEventListener('orientationchange', function () { setTimeout(checkRot, 300); });
      window.__tpCheckRot = checkRot; setTimeout(checkRot, 50);
    }
    if (cfg.help) {
      var h = el('div', 'tp-help', cfg.help); root.appendChild(h);
      setTimeout(function () { h.classList.add('gone'); }, 14000);
    }
    document.body.appendChild(root);
    if (active) document.body.classList.add('tp-on');
  }

  function buildDpad(map) {
    var pad = el('div', 'tp-dpad');
    var cells = [null, map.up, null, map.left, map.down, map.right, null, null, null];
    var icons = { }; icons[map.up] = '▲'; icons[map.down] = '▼'; icons[map.left] = '◀'; icons[map.right] = '▶';
    cells.forEach(function (code) {
      if (!code) { var sp = el('span'); sp.className = 'sp'; pad.appendChild(sp); return; }
      var b = el('button', null, icons[code]);
      bindHold(b, code, KEYNAMES[code] || '', true);
      pad.appendChild(b);
    });
    root.appendChild(pad);
  }

  function buildStick(map) {
    var box = el('div', 'tp-stick'), knob = el('i', 'tp-knob'); box.appendChild(knob);
    var id = null, cx = 0, cy = 0, r = 52;
    function apply(dx, dy) {
      var d = Math.hypot(dx, dy), m = Math.min(1, d / r);
      if (d > 1) { dx /= d; dy /= d; } else { dx = dy = 0; }
      knob.style.transform = 'translate(' + (dx * m * r) + 'px,' + (dy * m * r) + 'px)';
      var T = 0.38;
      set(map.right, dx * m >  T); set(map.left, dx * m < -T);
      set(map.down,  dy * m >  T); set(map.up,   dy * m < -T);
    }
    function set(code, want) { if (want) press(code, KEYNAMES[code] || '', false); else release(code); }
    box.addEventListener('pointerdown', function (e) {
      e.preventDefault(); e.stopPropagation(); switchOn(); id = e.pointerId;
      var b = box.getBoundingClientRect(); cx = b.left + b.width / 2; cy = b.top + b.height / 2; r = b.width * 0.36;
      try { box.setPointerCapture(e.pointerId); } catch (err) {}
      apply(e.clientX - cx, e.clientY - cy);
    });
    box.addEventListener('pointermove', function (e) { if (e.pointerId !== id) return; e.preventDefault(); apply(e.clientX - cx, e.clientY - cy); });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (ev) {
      box.addEventListener(ev, function (e) { if (e.pointerId !== id) return; id = null; knob.style.transform = ''; [map.up, map.down, map.left, map.right].forEach(release); });
    });
    root.appendChild(box);
  }

  function switchOn() {
    if (used) return; used = true;
    if (!active) { active = true; if (root) root.classList.remove('off'); }
    document.body.classList.add('tp-on');
    if (window.__tpCheckRot) window.__tpCheckRot();
  }

  function init(options) {
    cfg = options || {};
    function start() {
      build();
      addEventListener('touchstart', function () { switchOn(); }, { passive: true });
      addEventListener('blur', releaseAll);
      // iOS renvoie des dimensions périmées juste après la rotation : on relance plusieurs fois
      function nudge() { [50, 200, 450, 900].forEach(function (d) { setTimeout(function () { dispatchEvent(new Event('resize')); }, d); }); }
      addEventListener('orientationchange', nudge);
      if (window.visualViewport) window.visualViewport.addEventListener('resize', nudge);
      document.addEventListener('visibilitychange', function () { if (document.hidden) releaseAll(); });
      // pas de zoom ni de rebond de page sur tablette
      ['gesturestart', 'gesturechange', 'gestureend'].forEach(function (ev) { document.addEventListener(ev, function (e) { e.preventDefault(); }); });
      document.addEventListener('touchmove', function (e) { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
      document.addEventListener('dblclick', function (e) { e.preventDefault(); });
    }
    if (document.body) start(); else addEventListener('DOMContentLoaded', start);
  }

  global.TouchPad = { init: init, press: press, release: release, isTouch: function () { return active; } };
})(window);
