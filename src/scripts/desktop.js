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

/* ------------------------------------------------------------ desk windows */
/* Only `/` has [data-desk]. Without JS its windows open through :target (see
   base.css); here JS takes over. Visibility is driven inline (hidden + display)
   because the :target and default-window rules would beat a bare `hidden`. */

const desk = document.querySelector('[data-desk]');
const deskWins = desk ? $$('.window[data-app]', desk) : [];
const deskWin = (app) => deskWins.find((win) => win.dataset.app === app);
const deskOpen = () => deskWins.filter((win) => !win.hidden);
/* phone mode has no default window: the icon grid is the resting state */
const wideDesk = window.matchMedia('(min-width: 48rem) and (min-height: 32rem)');
let zTop = 2; /* base.css gives desk windows z-index 2 */

function setShown(win, on) {
  win.hidden = !on;
  win.style.display = on ? 'flex' : 'none';
}

function activate(win) {
  for (const w of deskWins) w.classList.toggle('is-active', w === win);
  win.style.zIndex = String(++zTop);
}

function openWindow(app, { focus = true, sync = true } = {}) {
  const win = deskWin(app);
  if (!win) return;
  if (win.hidden) {
    /* cascade: the first free step, so closing one never stacks two on a spot */
    const used = deskOpen().map((w) => w._n);
    let n = 0;
    while (used.includes(n)) n++;
    win._n = n % 8;
    win.style.setProperty('--n', String(win._n));
    setShown(win, true);
  }
  activate(win);
  /* the desk never scrolls: undo any scroll a fragment jump may have caused */
  desk.scrollTo(0, 0);
  if (focus) win.focus({ preventScroll: true });
  if (sync) history.replaceState(null, '', `#${app}`);
}

function closeWindow(app) {
  const win = deskWin(app);
  if (!win || win.hidden) return;
  setShown(win, false);
  win.classList.remove('is-active', 'is-min', 'is-max');
  for (const btn of $$('[aria-pressed]', win)) btn.setAttribute('aria-pressed', 'false');
  if (location.hash === `#${app}`) history.replaceState(null, '', location.pathname + location.search);
  const top = deskOpen().sort((a, b) => a.style.zIndex - b.style.zIndex).pop();
  if (top) activate(top);
  desk.querySelector(`[data-desk-icon="${app}"]`)?.focus({ preventScroll: true });
}

/* ------------------------------------------------------------ desk icons */
/* Selection and keyboard. The grid is ONE tab stop (roving tabindex): the
   current icon has tabindex 0, the rest -1. Without JS every icon stays a
   plain link in the tab order. */

const deskIcons = desk ? $$('.desk__icons [data-desk-icon]', desk) : [];
let currentIcon = null; /* the roving tab stop */
let selectedIcon = null;
let lastPointerType = 'mouse';

function setCurrent(icon) {
  currentIcon = icon;
  for (const el of deskIcons) el.tabIndex = el === icon ? 0 : -1;
}

function selectIcon(icon, { focus = true } = {}) {
  if (selectedIcon && selectedIcon !== icon) delete selectedIcon.dataset.selected;
  selectedIcon = icon;
  if (!icon) return;
  icon.dataset.selected = 'true';
  setCurrent(icon);
  /* a link does not take focus on click in every browser */
  if (focus && document.activeElement !== icon) icon.focus({ preventScroll: true });
}

/* the grid as columns of icons, read from the layout: it is column-major on
   the desk and row-major (auto-fill) in phone mode, and the column count
   follows the window height */
function iconColumns() {
  const columns = [];
  for (const icon of deskIcons) {
    const rect = icon.getBoundingClientRect();
    if (!rect.width && !rect.height) continue;
    const left = Math.round(rect.left);
    let col = columns.find((c) => Math.abs(c.left - left) < 4);
    if (!col) columns.push((col = { left, items: [] }));
    col.items.push({ icon, top: rect.top });
  }
  columns.sort((a, b) => a.left - b.left);
  for (const col of columns) col.items.sort((a, b) => a.top - b.top);
  return columns;
}

function moveIcon(from, key) {
  const columns = iconColumns();
  const all = columns.flatMap((c) => c.items.map((i) => i.icon));
  if (key === 'Home') return all[0];
  if (key === 'End') return all[all.length - 1];

  const c = columns.findIndex((col) => col.items.some((i) => i.icon === from));
  if (c < 0) return all[0];
  const r = columns[c].items.findIndex((i) => i.icon === from);
  if (key === 'ArrowDown') return columns[c].items[Math.min(r + 1, columns[c].items.length - 1)].icon;
  if (key === 'ArrowUp') return columns[c].items[Math.max(r - 1, 0)].icon;

  const next = columns[clamp(c + (key === 'ArrowRight' ? 1 : -1), 0, columns.length - 1)];
  return next.items[Math.min(r, next.items.length - 1)].icon;
}

function initIcons() {
  if (!deskIcons.length) return;
  setCurrent(deskIcons[0]);
  const grid = deskIcons[0].closest('.desk__icons');

  grid.addEventListener('pointerdown', (event) => {
    lastPointerType = event.pointerType;
  });

  /* Tab into the grid, or closeWindow() handing focus back: that icon is the stop */
  grid.addEventListener('focusin', (event) => {
    const icon = event.target.closest('[data-desk-icon]');
    if (icon) setCurrent(icon);
  });

  grid.addEventListener('keydown', (event) => {
    const icon = event.target.closest('[data-desk-icon]');
    if (!icon || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;

    if (event.key === ' ') {
      /* a link only activates on Enter: Space does the same, as a keyboard click */
      event.preventDefault();
      if (!event.repeat) icon.click();
      return;
    }
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    selectIcon(moveIcon(icon, event.key));
  });
}

if (desk) {
  document.documentElement.classList.add('has-desk');
  for (const link of $$('[data-nojs-close]', desk)) link.remove();
  for (const btn of $$('.window [data-win][hidden]', desk)) btn.hidden = false;
  for (const win of deskWins) setShown(win, false);

  const first = deskWin(location.hash.slice(1));
  if (first || wideDesk.matches) {
    openWindow(first ? first.dataset.app : 'inicio', { focus: false, sync: false });
  }

  window.addEventListener('hashchange', () => {
    const win = deskWin(location.hash.slice(1));
    if (win) openWindow(win.dataset.app, { sync: false });
  });

  desk.addEventListener('pointerdown', (event) => {
    const win = event.target.closest('.window');
    if (win) activate(win);
  });

  initIcons();
}

document.addEventListener('click', (event) => {
  /* desk icons: a modified click keeps its link behaviour; the styleguide
     shortcut and the decorative plate icons have no window and fall through */
  const icon = desk && event.target.closest('[data-desk] [data-desk-icon]');
  if (icon && !(event.ctrlKey || event.metaKey || event.shiftKey)) {
    selectIcon(icon);
    /* mouse: one click selects, a double-click opens. Touch and keyboard/AT
       (detail 0) have no double-click, so one activation opens. */
    const opens = event.detail === 0 || event.detail >= 2 || lastPointerType === 'touch';
    if (!opens) {
      event.preventDefault();
      return;
    }
    if (deskWin(icon.dataset.deskIcon)) {
      event.preventDefault();
      openWindow(icon.dataset.deskIcon);
    }
    /* no window (the styleguide shortcut): the link navigates as usual */
    return;
  }

  /* a click on empty desk (not an icon, not a window) clears the selection */
  if (desk && !icon && event.target.closest('[data-desk]') && !event.target.closest('.window')) {
    selectIcon(null);
  }

  const control = event.target.closest('[data-win]');
  if (control) {
    const win = control.closest('.window');
    if (!win) return;
    const action = control.dataset.win;

    /* a desk window closes here, before the legacy [data-windows] path */
    if (action === 'close' && win.closest('[data-desk]')) {
      closeWindow(win.dataset.app);
      return;
    }

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
