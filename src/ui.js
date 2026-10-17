import { clamp, lerp } from './utils.js';
import { setVolume, getVolume, ensureAudio, playSound } from './audio.js';
import { applyQuality, quality } from './core.js';

/* ============================================================= helpers */

const $ = (id) => document.getElementById(id);

function fmtTime(t) {
  const m = Math.floor(t / 60);
  const s = (t % 60).toFixed(1).padStart(4, '0');
  return `${m}:${s}`;
}

export function initUI(game) {
  /* ------------------------------------------------------- elements */

  const hud = $('hud');
  const overlay = $('overlay');
  const overlayTitle = $('overlayTitle');
  const overlayText = $('overlayText');
  const overlayHint = $('overlayHint');
  const overlayStats = $('overlayStats');
  const bannerEl = $('banner');
  const flashEl = $('flash');
  const vignette = $('vignette');
  const pauseMenu = $('pauseMenu');

  const playerHpEl = $('playerHp');
  const playerHpText = $('playerHpText');
  const playerEnergyEl = $('playerEnergy');
  const enemyNameEl = $('enemyName');
  const enemyHpEl = $('enemyHp');
  const enemyHpText = $('enemyHpText');
  const roundEl = $('round');
  const timerEl = $('timer');
  const comboEl = $('combo');
  const scoreEl = $('score');

  const joyZone = $('joyZone');
  const joyBase = $('joyBase');
  const joyKnob = $('joyKnob');
  const cameraZone = $('cameraZone');

  const elements = {
    btnPunch: $('btnPunch'),
    btnJump: $('btnJump'),
    btnDash: $('btnDash'),
    btnBlue: $('btnBlue'),
    btnRed: $('btnRed'),
    btnPurple: $('btnPurple'),
    btnInfinity: $('btnInfinity'),
    btnVoid: $('btnVoid'),
    btnPause: $('btnPause'),
    btnResume: $('btnResume'),
    btnRestart: $('btnRestart'),
    btnQuit: $('btnQuit'),
  };

  const volumeSlider = $('volumeSlider');
  const qualitySelect = $('qualitySelect');

  /* --------------------------------------------------- banner/flash */

  let bannerTimer = null;

  function banner(text, duration = 2) {
    bannerEl.textContent = text;
    bannerEl.classList.add('show');
    if (bannerTimer) window.clearTimeout(bannerTimer);
    bannerTimer = window.setTimeout(() => bannerEl.classList.remove('show'), duration * 1000);
  }

  function flash() {
    flashEl.classList.add('show');
    window.setTimeout(() => flashEl.classList.remove('show'), 150);
  }

  function haptic(kind) {
    try {
      if (navigator.vibrate) navigator.vibrate(kind === 'heavy' ? [18, 30, 22] : 12);
    } catch {
      /* ignore */
    }
  }

  /* -------------------------------------------------------- overlay */

  function overlayFor(phase) {
    if (phase === 'playing') {
      overlay.classList.add('hidden');
      pauseMenu.classList.add('hidden');
      hud.classList.remove('hidden');
      return;
    }

    if (phase === 'paused') {
      pauseMenu.classList.remove('hidden');
      overlay.classList.add('hidden');
      return;
    }

    pauseMenu.classList.add('hidden');
    overlay.classList.remove('hidden');
    hud.classList.remove('hidden');

    if (phase === 'menu') {
      overlayTitle.innerHTML = 'GOJO<span>CURSED SHOWDOWN</span>';
      overlayText.textContent =
        'A special-grade curse has breached the barrier. Master your techniques and exorcise it across the cursed zones.';
      overlayStats.innerHTML = '';
      overlayHint.textContent = 'PRESS ENTER OR TAP TO BEGIN';
    } else if (phase === 'roundclear') {
      overlayTitle.innerHTML = `ROUND ${game.round}<span>EXORCISED</span>`;
      overlayText.textContent = 'The barrier shifts to the next cursed zone. The spirits grow stronger.';
      overlayStats.innerHTML = `SCORE ${Math.round(game.score)} &nbsp;·&nbsp; TIME ${fmtTime(game.roundTime)}`;
      overlayHint.textContent = 'PRESS ENTER OR TAP FOR THE NEXT ROUND';
    } else if (phase === 'gameover') {
      overlayTitle.innerHTML = 'GAME OVER<span>THE BARRIER FELL</span>';
      overlayText.textContent = 'The curse overwhelmed you. Refine your technique and try again.';
      overlayStats.innerHTML = `REACHED ROUND ${game.round} &nbsp;·&nbsp; SCORE ${Math.round(game.score)}`;
      overlayHint.textContent = 'PRESS ENTER OR TAP TO RETRY';
    }
  }

  function handleOverlayAction() {
    ensureAudio();
    if (game.phase === 'menu') game.flow.start();
    else if (game.phase === 'roundclear') game.flow.next();
    else if (game.phase === 'gameover') game.flow.restart();
    else if (game.phase === 'paused') game.flow.pause(false);
  }

  overlay.addEventListener('pointerdown', handleOverlayAction);

  /* ----------------------------------------------------------- HUD */

  const abilityButtons = [
    { el: elements.btnBlue, key: 'blueCooldown', cost: 25, trigger: 'blue', cdMax: 3.2 },
    { el: elements.btnRed, key: 'redCooldown', cost: 35, trigger: 'red', cdMax: 4.6 },
    { el: elements.btnPurple, key: 'purpleCooldown', cost: 70, trigger: 'purple', cdMax: 13 },
    { el: elements.btnInfinity, key: 'infinityCooldown', cost: 20, trigger: 'infinity', cdMax: 7 },
    { el: elements.btnVoid, key: 'domainCooldown', cost: 100, trigger: 'domain', cdMax: 12 },
    { el: elements.btnDash, key: 'dashCooldown', cost: 0, trigger: 'dash', cdMax: 1.15 },
    { el: elements.btnPunch, key: 'attackCooldown', cost: 0, trigger: 'melee', cdMax: 0.52 },
    { el: elements.btnJump, key: null, cost: 0, trigger: 'jump', cdMax: 0 },
  ];

  function updateHUD() {
    const p = game.player;

    playerHpEl.style.width = `${clamp((p.hp / p.maxHp) * 100, 0, 100)}%`;
    if (playerHpText) playerHpText.textContent = `${Math.ceil(p.hp)} / ${p.maxHp}`;
    playerEnergyEl.style.width = `${clamp((p.energy / p.maxEnergy) * 100, 0, 100)}%`;

    // focus the enemy HUD on the boss or the first living enemy
    const target =
      game.enemies.find((e) => e.type === 'boss' && e.hp > 0) ||
      game.enemies.find((e) => e.hp > 0) ||
      game.enemies[0];
    if (target) {
      enemyNameEl.textContent =
        target.type === 'boss'
          ? `SPECIAL GRADE — PHASE ${target.phase}`
          : target.type.toUpperCase();
      enemyHpEl.style.width = `${clamp((target.hp / target.maxHp) * 100, 0, 100)}%`;
      if (enemyHpText) enemyHpText.textContent = `${Math.max(0, Math.ceil(target.hp))} / ${target.maxHp}`;
    }

    roundEl.textContent = `ROUND ${game.round}`;
    timerEl.textContent = fmtTime(game.roundTime);
    comboEl.textContent = game.combo > 1 ? `${game.combo} HIT COMBO` : '';
    scoreEl.textContent = `SCORE ${Math.round(game.score)}`;

    // ability cooldown + energy gating
    for (const btn of abilityButtons) {
      if (!btn.el) continue;
      const cd = btn.key ? p[btn.key] || 0 : 0;
      const k = clamp(cd / btn.cdMax, 0, 1);
      const cdEl = btn.el.querySelector('.cd');
      if (cdEl) {
        cdEl.style.height = `${k * 100}%`;
        cdEl.textContent = cd > 0.25 ? cd.toFixed(1) : '';
      }
      const gated = btn.cost > 0 && p.energy < btn.cost;
      btn.el.classList.toggle('gated', gated);
      btn.el.classList.toggle('cooling', cd > 0);
    }

    // domain availability glow
    if (elements.btnVoid) {
      elements.btnVoid.classList.toggle('ready', p.energy >= p.maxEnergy - 0.5);
    }

    // domain vignette
    vignette.classList.toggle('domain', game.domainActive);
    vignette.classList.toggle('lowhp', p.hp < p.maxHp * 0.28 && game.phase === 'playing');
  }

  /* -------------------------------------------------------- joystick */

  const touchMode =
    ('ontouchstart' in window && navigator.maxTouchPoints > 0) ||
    (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  document.body.classList.toggle('touch-mode', touchMode);

  let joyPointerId = null;
  const joy = { active: false, dx: 0, dy: 0 };

  function updateJoystick(clientX, clientY) {
    const rect = joyZone.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const maxR = rect.width * 0.32;

    let dx = clientX - cx;
    let dy = clientY - cy;
    const len = Math.hypot(dx, dy);
    if (len > maxR) {
      dx = (dx / len) * maxR;
      dy = (dy / len) * maxR;
    }

    joy.dx = dx / maxR;
    joy.dy = dy / maxR;

    joyBase.style.left = `${cx + dx}px`;
    joyBase.style.top = `${cy + dy}px`;
    joyKnob.style.transform = `translate(${dx}px, ${dy}px)`;
    game.input.x = joy.dx;
    game.input.y = joy.dy;
  }

  function resetJoystick() {
    joyPointerId = null;
    joy.active = false;
    joy.dx = 0;
    joy.dy = 0;
    game.input.x = 0;
    game.input.y = 0;
    joyBase.style.left = '50%';
    joyBase.style.top = '50%';
    joyKnob.style.transform = 'translate(0px, 0px)';
  }

  if (joyZone) {
    joyZone.addEventListener('pointerdown', (e) => {
      ensureAudio();
      if (joyPointerId !== null) return;
      joyPointerId = e.pointerId;
      joy.active = true;
      joyZone.setPointerCapture(e.pointerId);
      updateJoystick(e.clientX, e.clientY);
      e.preventDefault();
    });
    joyZone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== joyPointerId) return;
      updateJoystick(e.clientX, e.clientY);
      e.preventDefault();
    });
    const end = (e) => {
      if (e.pointerId !== joyPointerId) return;
      resetJoystick();
    };
    joyZone.addEventListener('pointerup', end);
    joyZone.addEventListener('pointercancel', end);
    joyZone.addEventListener('lostpointercapture', resetJoystick);
  }

  /* -------------------------------------------------- camera control */

  let camPointerId = null;
  let camLastX = 0;
  let camLastY = 0;

  if (cameraZone) {
    cameraZone.addEventListener('pointerdown', (e) => {
      if (camPointerId !== null) return;
      camPointerId = e.pointerId;
      camLastX = e.clientX;
      camLastY = e.clientY;
      cameraZone.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    cameraZone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== camPointerId) return;
      game.camera.drag(e.clientX - camLastX, e.clientY - camLastY);
      camLastX = e.clientX;
      camLastY = e.clientY;
      e.preventDefault();
    });
    const endCam = (e) => {
      if (e.pointerId !== camPointerId) return;
      camPointerId = null;
    };
    cameraZone.addEventListener('pointerup', endCam);
    cameraZone.addEventListener('pointercancel', endCam);
  }

  /* -------------------------------------------------------- buttons */
  /* pointerdown only (no click) so a tap can never fire twice. */

  function bindButton(el, trigger, cooldownKey) {
    if (!el) return;
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      ensureAudio();
      const p = game.player;
      const btn = abilityButtons.find((b) => b.el === el);
      if (btn && btn.cost > 0 && p.energy < btn.cost) {
        playSound('denied');
        el.classList.add('denied');
        window.setTimeout(() => el.classList.remove('denied'), 320);
        haptic('light');
        return;
      }
      if (cooldownKey && p[cooldownKey] > 0.05) {
        playSound('denied');
        return;
      }
      el.classList.add('pressed');
      window.setTimeout(() => el.classList.remove('pressed'), 140);
      game.triggers[trigger]();
    });
  }

  bindButton(elements.btnPunch, 'melee', 'attackCooldown');
  bindButton(elements.btnJump, 'jump', null);
  bindButton(elements.btnDash, 'dash', 'dashCooldown');
  bindButton(elements.btnBlue, 'blue', 'blueCooldown');
  bindButton(elements.btnRed, 'red', 'redCooldown');
  bindButton(elements.btnPurple, 'purple', 'purpleCooldown');
  bindButton(elements.btnInfinity, 'infinity', 'infinityCooldown');
  bindButton(elements.btnVoid, 'domain', 'domainCooldown');

  if (elements.btnPause) {
    elements.btnPause.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      ensureAudio();
      game.flow.pause();
    });
  }

  /* ---------------------------------------------------- pause menu */

  if (elements.btnResume) {
    elements.btnResume.addEventListener('click', () => game.flow.pause(false));
  }
  if (elements.btnRestart) {
    elements.btnRestart.addEventListener('click', () => {
      game.flow.pause(false);
      game.flow.restart();
    });
  }
  if (elements.btnQuit) {
    elements.btnQuit.addEventListener('click', () => {
      game.flow.pause(false);
      game.flow.restart();
    });
  }

  if (volumeSlider) {
    volumeSlider.value = String(Math.round(getVolume() * 100));
    volumeSlider.addEventListener('input', () => {
      setVolume(volumeSlider.value / 100);
    });
  }

  if (qualitySelect) {
    qualitySelect.value = quality.level;
    qualitySelect.addEventListener('change', () => {
      applyQuality(qualitySelect.value);
    });
  }

  /* ------------------------------------------------------- keyboard */

  const keys = new Set();
  const PREVENT = new Set([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright']);

  function refreshMoveInput() {
    if (joy.active) return; // joystick wins
    const x = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0);
    const y = (keys.has('s') || keys.has('arrowdown') ? 1 : 0) - (keys.has('w') || keys.has('arrowup') ? 1 : 0);
    game.input.x = x;
    game.input.y = y;
  }

  window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if (PREVENT.has(key)) e.preventDefault();
    ensureAudio();

    if (key === 'enter' || key === ' ') {
      if (game.phase !== 'playing' && game.phase !== 'paused') {
        handleOverlayAction();
        return;
      }
    }
    if (key === 'escape' || key === 'p') {
      game.flow.pause();
      return;
    }

    if (keys.has(key)) return; // no key repeat triggers
    keys.add(key);
    refreshMoveInput();

    if (game.phase !== 'playing') return;

    switch (key) {
      case ' ':
        game.triggers.jump();
        break;
      case 'shift':
        game.triggers.dash();
        break;
      case 'j':
        game.triggers.melee();
        break;
      case 'k':
        game.triggers.blue();
        break;
      case 'l':
        game.triggers.red();
        break;
      case 'i':
        game.triggers.purple();
        break;
      case 'o':
        game.triggers.infinity();
        break;
      case 'u':
        game.triggers.domain();
        break;
    }
  });

  window.addEventListener('keyup', (e) => {
    keys.delete(e.key.toLowerCase());
    refreshMoveInput();
  });

  window.addEventListener('blur', () => {
    keys.clear();
    resetJoystick();
    refreshMoveInput();
  });

  /* ---------------------------------------------------------- mouse */

  const canvas = document.getElementById('game');
  let mouseDown = false;
  let mouseMoved = false;
  let mouseLastX = 0;
  let mouseLastY = 0;

  canvas.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    ensureAudio();
    mouseDown = true;
    mouseMoved = false;
    mouseLastX = e.clientX;
    mouseLastY = e.clientY;
    if (game.phase === 'playing') game.triggers.melee();
    else handleOverlayAction();
  });

  window.addEventListener('mouseup', () => {
    mouseDown = false;
  });

  window.addEventListener('mousemove', (e) => {
    if (!mouseDown) return;
    const dx = e.clientX - mouseLastX;
    const dy = e.clientY - mouseLastY;
    if (Math.abs(dx) + Math.abs(dy) > 2) mouseMoved = true;
    mouseLastX = e.clientX;
    mouseLastY = e.clientY;
    game.camera.drag(dx, dy);
  });

  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      game.camera.zoom(e.deltaY);
    },
    { passive: false },
  );

  /* -------------------------------------------------- misc handling */

  // stop iOS/Android from scrolling, zooming or bouncing
  document.addEventListener(
    'touchmove',
    (e) => {
      if (e.target && e.target.closest && e.target.closest('#pauseMenu .settings')) return;
      e.preventDefault();
    },
    { passive: false },
  );

  document.addEventListener('gesturestart', (e) => e.preventDefault());

  // pause when the app is backgrounded
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && game.phase === 'playing') game.flow.pause(true);
  });

  /* ---------------------------------------------------- domain HUD */

  function setDomainUI(active) {
    vignette.classList.toggle('domain', active);
  }

  /* ------------------------------------------------------ exports */

  game.callbacks.banner = banner;
  game.callbacks.flash = flash;
  game.callbacks.haptic = haptic;
  game.callbacks.overlay = overlayFor;

  overlayFor(game.phase);
  updateHUD();

  return {
    updateHUD,
    banner,
    flash,
    setDomainUI,
    isTouch: touchMode,
  };
}
