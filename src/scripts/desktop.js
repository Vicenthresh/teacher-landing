/* Vanilla desktop behaviour.
 *
 * Budget: this file is the whole JS payload for the site. No libraries, no
 * frameworks, no polyfills. Everything degrades to readable HTML without it:
 * the boot screen is hidden until asked, the start menu is a normal list, the
 * windows are just sections.
 */

const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

const store = {
  get(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* private mode: the toggle still works for this page */
    }
  },
  session(key) {
    try {
      return sessionStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setSession(key, value) {
    try {
      sessionStorage.setItem(key, value);
    } catch {
      /* ignore */
    }
  },
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------------------------------------------------------------- sounds */
/* WebAudio instead of OGG files: 0 KB of assets, nothing loaded until the
   person turns sound on, and the context is only created on a real gesture. */

let audioContext = null;
let soundOn = store.get('tl:sound') === 'on';

function beep(kind = 'click') {
  if (!soundOn) return;
  try {
    const w = /** @type {any} */ (window);
    audioContext ??= new (w.AudioContext || w.webkitAudioContext)();
    if (audioContext.state === 'suspended') audioContext.resume();
    const now = audioContext.currentTime;
    const notes =
      kind === 'boot'
        ? [
            [523.25, 0],
            [659.25, 0.11],
            [783.99, 0.22],
            [1046.5, 0.33],
          ]
        : kind === 'open'
          ? [
              [880, 0],
              [1174.66, 0.055],
            ]
          : [[660, 0]];

    for (const [freq, delay] of notes) {
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.type = 'square';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now + delay);
      gain.gain.exponentialRampToValueAtTime(0.035, now + delay + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + 0.075);
      osc.connect(gain).connect(audioContext.destination);
      osc.start(now + delay);
      osc.stop(now + delay + 0.09);
    }
  } catch {
    /* audio is a bonus, never a requirement */
  }
}

function syncSoundToggles() {
  for (const btn of $$('[data-sound]')) {
    btn.dataset.on = String(soundOn);
    btn.setAttribute('aria-pressed', String(soundOn));
    const label = soundOn ? btn.dataset.labelOn : btn.dataset.labelOff;
    if (label) {
      btn.setAttribute('aria-label', label);
      btn.setAttribute('title', label);
    }
  }
}

/* ------------------------------------------------------------ window bits */

for (const win of $$('[data-drag]')) {
  const bar = win.querySelector('.window__bar');
  if (!bar) continue;
  win._dx = 0;
  win._dy = 0;

  bar.addEventListener('dblclick', () => {
    win.style.transform = '';
    win._dx = 0;
    win._dy = 0;
  });
}

let drag = null;

document.addEventListener('pointerdown', (event) => {
  if (event.button !== 0 || event.target.closest('button')) return;
  const bar = event.target.closest('.window__bar');
  const win = bar && bar.closest('[data-drag]');
  if (!win || win.classList.contains('is-max')) return;

  const rect = win.getBoundingClientRect();
  const box = (win.closest('.stage, .plinth') || document.body).getBoundingClientRect();
  const ox = win._dx || 0;
  const oy = win._dy || 0;

  drag = {
    win,
    bar,
    id: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    ox,
    oy,
    left: rect.left - ox,
    top: rect.top - oy,
    width: rect.width,
    box,
  };

  bar.setPointerCapture(event.pointerId);
  win.classList.add('is-dragging');
  event.preventDefault();
});

document.addEventListener('pointermove', (event) => {
  if (!drag || event.pointerId !== drag.id) return;
  const minX = drag.box.left + 6 - drag.left;
  const maxX = drag.box.right - 6 - (drag.left + drag.width);
  const minY = drag.box.top + 6 - drag.top;
  const maxY = drag.box.bottom - 44 - drag.top;
  const dx = clamp(drag.ox + event.clientX - drag.startX, Math.min(minX, maxX), Math.max(minX, maxX));
  const dy = clamp(drag.oy + event.clientY - drag.startY, Math.min(minY, maxY), Math.max(minY, maxY));
  drag.win.style.transform = `translate(${dx}px, ${dy}px)`;
  drag.win._dx = dx;
  drag.win._dy = dy;
});

function endDrag() {
  if (!drag) return;
  drag.win.classList.remove('is-dragging');
  drag = null;
}

document.addEventListener('pointerup', endDrag);
document.addEventListener('pointercancel', endDrag);

document.addEventListener('click', (event) => {
  const control = event.target.closest('[data-win]');
  if (control) {
    const win = control.closest('.window');
    if (!win) return;
    const action = control.dataset.win;

    if (action === 'min') {
      const on = win.classList.toggle('is-min');
      control.setAttribute('aria-pressed', String(on));
    }

    if (action === 'max') {
      const on = win.classList.toggle('is-max');
      control.setAttribute('aria-pressed', String(on));
      if (on) win.style.transform = '';
    }

    if (action === 'close') {
      const host = win.closest('[data-windows]');
      if (!host) return;
      host.classList.add('has-closed');
      host.querySelector('[data-reopen]')?.focus();
    }
    return;
  }

  const reopen = event.target.closest('[data-reopen]');
  if (reopen) {
    const host = reopen.closest('[data-windows]');
    if (!host) return;
    host.classList.remove('has-closed');
    host.querySelector('[data-win="max"]')?.focus();
  }
});

/* --------------------------------------------------------------- start menu */

for (const bar of $$('[data-taskbar]')) {
  const button = bar.querySelector('[data-start]');
  const menu = bar.querySelector('[data-menu]');
  if (!button || !menu) continue;

  const items = () => $$('a[href], button', menu);

  const setOpen = (open, moveFocus = true) => {
    menu.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
    if (open && moveFocus) {
      items()[0]?.focus({ preventScroll: true });
      beep('open');
    }
  };

  button.addEventListener('click', () => setOpen(menu.hidden));

  bar.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !menu.hidden) {
      setOpen(false, false);
      button.focus();
      return;
    }
    if (menu.hidden || (event.key !== 'ArrowDown' && event.key !== 'ArrowUp')) return;
    event.preventDefault();
    const list = items();
    const index = list.indexOf(document.activeElement);
    const next = event.key === 'ArrowDown' ? index + 1 : index - 1;
    list[(next + list.length) % list.length]?.focus();
  });

  document.addEventListener('pointerdown', (event) => {
    if (!bar.contains(event.target) && !menu.hidden) setOpen(false, false);
  });
}

/* ------------------------------------------------------------------- boot */

const boot = document.querySelector('[data-boot]');
const main = document.querySelector('main');
let bootTimer = null;

function closeBoot() {
  if (!boot) return;
  window.clearTimeout(bootTimer);
  boot.hidden = true;
  document.body.style.overflow = '';
  if (main) main.inert = false;
  store.setSession('tl:boot', '1');
}

function playBoot() {
  if (!boot) return;
  boot.hidden = false;
  document.body.style.overflow = 'hidden';
  /* nothing behind the curtain while it is up: keyboard included */
  if (main) main.inert = true;
  bootTimer = window.setTimeout(closeBoot, 1900);
  beep('boot');
}

if (boot) {
  boot.addEventListener('click', closeBoot);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !boot.hidden) closeBoot();
  });

  if (boot.dataset.bootMode === 'auto' && !store.session('tl:boot') && !reduceMotion()) {
    playBoot();
  }
}

for (const trigger of $$('[data-boot-trigger]')) {
  trigger.addEventListener('click', playBoot);
}

/* ---------------------------------------------------------------- counter */

const hits = Number(store.session('tl:hits') || '0') + 1;
store.setSession('tl:hits', String(hits));
for (const counter of $$('[data-counter]')) {
  const digits = counter.querySelector('[data-digits]');
  if (!digits) continue;
  const base = Number(counter.dataset.base || '0');
  digits.textContent = String(base + hits).padStart(6, '0');
}

/* ------------------------------------------------------------------ skins */
/* Two kinds of [data-skin-set] button share one handler:
 *   with aria-controls    → scoped: skins one subtree (the styleguide audit).
 *   without aria-controls → global: skins <html>, persists `tl:skin`, syncs
 *                           every global switch. y2k is not a page theme, so
 *                           the global kind is whitelisted. */

const PAGE_SKINS = ['aero', 'xp', '90s'];
const globalSwitches = () => $$('[data-skin-set]:not([aria-controls])');

function syncSkinSwitches() {
  const current = document.documentElement.dataset.skin;
  for (const btn of globalSwitches()) {
    btn.setAttribute('aria-pressed', String(btn.dataset.skinSet === current));
  }
}

function setPageSkin(id) {
  if (!PAGE_SKINS.includes(id)) return;
  const root = document.documentElement;
  root.dataset.skin = id;
  store.set('tl:skin', id);
  syncSkinSwitches();
  /* theme-color follows the skin: the backdrop base colour is the token */
  const color = getComputedStyle(root).getPropertyValue('--backdrop-base').trim();
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta && color) meta.setAttribute('content', color);
}

for (const toggle of $$('[data-skin-set]')) {
  toggle.addEventListener('click', () => {
    if (!toggle.hasAttribute('aria-controls')) {
      /* the delegated click handler below already beeps when sound is on */
      setPageSkin(toggle.dataset.skinSet);
      return;
    }
    const host = document.getElementById(toggle.getAttribute('aria-controls'));
    if (!host) return;
    host.dataset.skin = toggle.dataset.skinSet;
    for (const sibling of $$('[data-skin-set]', toggle.parentElement)) {
      sibling.setAttribute('aria-pressed', String(sibling === toggle));
    }
    /* the delegated global click handler below already beeps for buttons */
  });
}

/* the global switch is `hidden` in the HTML so no-JS visitors see no dead UI */
for (const group of $$('[data-themeswitch][hidden]')) group.hidden = false;
syncSkinSwitches();

/* --------------------------------------------------------- global clicks */

document.addEventListener('click', (event) => {
  const sound = event.target.closest('[data-sound]');
  if (sound) {
    soundOn = !soundOn;
    store.set('tl:sound', soundOn ? 'on' : 'off');
    syncSoundToggles();
    beep('click');
    return;
  }

  const demo = event.target.closest('a[data-demo]');
  if (demo) {
    event.preventDefault();
    return;
  }

  if (soundOn && event.target.closest('button, .taskbar__nav a, .startmenu a')) {
    beep('click');
  }
});

syncSoundToggles();
