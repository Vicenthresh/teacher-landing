#!/usr/bin/env node
/*
 * WCAG contrast audit for the tokens that actually carry text.
 *
 * Gradients and translucent surfaces are resolved first: a text pair is only
 * measured against the pixels it really sits on. For every pair we take the
 * worst stop, so a chrome bar passes only if its lightest stop passes.
 *
 * Skins come from a list (aero, xp, 90s, y2k). xp and 90s must define every
 * token aero defines. Glass, tray and cards are composited over each skin's
 * backdrop colours.
 *
 * Writes src/data/contrast.json (consumed by /styleguide) and exits 1 on a
 * failed pair or a missing token.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const css = readFileSync(resolve(root, 'src/styles/tokens.css'), 'utf8');

/* ---------------------------------------------------------------- tokens */

function blockFor(needle) {
  for (const chunk of css.split('}')) {
    const at = chunk.indexOf('{');
    if (at === -1) continue;
    const selector = chunk.slice(0, at);
    if (!selector.includes(needle)) continue;
    const vars = {};
    for (const m of chunk.slice(at + 1).matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) {
      vars[`--${m[1]}`] = m[2].trim();
    }
    return vars;
  }
  throw new Error(`token block not found: ${needle}`);
}

/* Skins are a list, not a pair. `inherits` skins fall back to aero for any
   token they do not define; the others must define every aero token. */
const SKINS = [
  { id: 'aero', label: 'Aero', inherits: false },
  { id: 'xp', label: 'XP', inherits: false },
  { id: '90s', label: '90s', inherits: false },
  { id: 'y2k', label: 'Y2K', inherits: true },
];

/* Tokens every skin must carry for the draft sections. */
const REQUIRED = [
  '--chat-in-bg', '--chat-in-ink', '--chat-out-bg', '--chat-out-ink',
  '--badge-bg', '--badge-ink', '--card-bg', '--card-ink', '--link',
  '--backdrop-base', '--backdrop-lo', '--backdrop-hi',
];

const aero = blockFor("[data-skin='aero']");
const tokens = { aero };
const contractErrors = [];

for (const skin of SKINS.slice(1)) {
  const own = blockFor(`[data-skin='${skin.id}']`);
  tokens[skin.id] = { ...aero, ...own };
  if (!skin.inherits) {
    const missing = Object.keys(aero).filter((key) => !(key in own));
    if (missing.length) contractErrors.push(`${skin.label} no define: ${missing.join(', ')}`);
  }
}

for (const skin of SKINS) {
  const own = skin.id === 'aero' ? aero : blockFor(`[data-skin='${skin.id}']`);
  const missing = REQUIRED.filter((key) => !(key in own));
  if (missing.length) contractErrors.push(`${skin.label} sin tokens de sección: ${missing.join(', ')}`);
}

/* ---------------------------------------------------------------- colour */

function hex(value) {
  let h = value.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length === 8) h = h.slice(0, 6);
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
    a: 1,
  };
}

function colorsIn(value) {
  if (!value) return [];
  const out = [];
  for (const m of value.matchAll(/#[0-9a-f]{3,8}\b/gi)) out.push(hex(m[0]));
  for (const m of value.matchAll(/rgba?\(([^)]+)\)/gi)) {
    const [r, g, b, a = '1'] = m[1].split(',').map((n) => n.trim());
    out.push({ r: Number(r), g: Number(g), b: Number(b), a: Number(a) });
  }
  return out;
}

const over = (top, bottom) => ({
  r: top.r * top.a + bottom.r * (1 - top.a),
  g: top.g * top.a + bottom.g * (1 - top.a),
  b: top.b * top.a + bottom.b * (1 - top.a),
  a: 1,
});

function luminance({ r, g, b }) {
  const ch = (v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
}

function ratio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const toHex = (c) =>
  '#' + [c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

/* ------------------------------------------------------------- the pairs */

const HEADING_NOTE = {
  aero: 'metal oscuro sobre panel claro; el trazo solo afina el borde',
  xp: 'azul intenso sobre crema; el trazo solo afina el borde',
  '90s': 'azul marino sobre gris; el trazo solo afina el borde',
  y2k: 'plata clara sobre navy; el trazo solo afina el borde',
};

/* Every colour a panel can sit on: the three backdrop tokens plus the ground
   stops. Glass and tray are composited over each and the worst one wins. */
const backdropsOf = (t) => [
  ...colorsIn(t['--backdrop-base']),
  ...colorsIn(t['--backdrop-lo']),
  ...colorsIn(t['--backdrop-hi']),
  ...colorsIn(t['--ground']),
];

const pairs = (skin) => {
  const t = tokens[skin];
  const backdrops = backdropsOf(t);
  const glassOver = colorsIn(t['--glass']).flatMap((g) => backdrops.map((b) => over(g, b)));
  const trayStops = colorsIn(t['--tray-bg']).flatMap((c) => backdrops.map((b) => over(c, b)));
  const c = (name) => colorsIn(t[name]);

  return [
    { label: 'Texto · panel', fg: c('--ink'), bg: c('--panel'), note: 'párrafo y títulos sólidos' },
    { label: 'Texto suave · panel', fg: c('--ink-soft'), bg: c('--panel'), note: 'texto secundario' },
    { label: 'Texto apagado · panel', fg: c('--ink-mute'), bg: [...c('--panel'), ...c('--panel-2')], note: 'eyebrow y pies de menú' },
    { label: 'Enlace · panel', fg: c('--link'), bg: c('--panel'), note: 'links dentro de ventanas' },
    { label: 'Barra de ventana', fg: c('--bar-ink'), bg: c('--chrome'), note: 'peor stop del cromo' },
    { label: 'Botón de ventana', fg: c('--winbtn-ink'), bg: c('--winbtn-bg'), note: 'minimizar, maximizar, cerrar' },
    { label: 'Botón', fg: c('--btn-ink'), bg: c('--btn-bg'), note: 'peor stop del gloss' },
    { label: 'Botón · pulsado', fg: c('--btn-ink'), bg: c('--btn-bg-on'), note: 'estado :active' },
    { label: 'Vidrio · texto', fg: c('--glass-ink'), bg: glassOver, note: 'vidrio compuesto sobre fondo y pasto' },
    { label: 'Bandeja', fg: c('--tray-ink'), bg: trayStops, note: 'bandeja compuesta sobre el fondo' },
    { label: 'Bandeja · suave', fg: c('--tray-soft'), bg: trayStops, note: 'idioma y etiquetas de la bandeja' },
    { label: 'Ticker', fg: c('--ticker-ink'), bg: c('--ticker-bg'), note: 'línea de avisos' },
    { label: 'Chrome heading · cara', fg: c('--head-face'), bg: c('--panel'), note: HEADING_NOTE[skin] },
    { label: 'Menú Inicio', fg: c('--menu-ink'), bg: c('--menu-bg'), note: 'ítems del menú' },
    { label: 'Menú · hover', fg: c('--menu-hover-ink'), bg: c('--menu-hover'), note: 'ítem enfocado' },
    { label: 'Botón Inicio', fg: c('--start-ink'), bg: c('--start-bg'), note: 'peor stop del botón' },
    { label: 'Chat · recibido', fg: c('--chat-in-ink'), bg: c('--chat-in-bg'), note: 'burbuja de la ventana de contacto' },
    { label: 'Chat · enviado', fg: c('--chat-out-ink'), bg: c('--chat-out-bg'), note: 'burbuja propia' },
    { label: 'Insignia NEW', fg: c('--badge-ink'), bg: c('--badge-bg'), note: 'sello NEW! y etiquetas' },
    { label: 'Tarjeta · texto', fg: c('--card-ink'), bg: c('--card-bg'), note: 'tarjetas del blog' },
    { label: 'Tarjeta · enlace', fg: c('--link'), bg: c('--card-bg'), note: 'enlace "Leer" dentro de la tarjeta' },
    { label: 'Chat · enlace', fg: c('--link'), bg: [...c('--chat-in-bg'), ...c('--chat-out-bg')], note: 'enlaces dentro de burbujas' },
    { label: 'Foco · panel', fg: c('--focus'), bg: [...c('--panel'), ...c('--card-bg')], min: 3, note: 'contraste no textual, 3:1' },
  ];
};

const rows = [];

for (const skin of SKINS) {
  for (const pair of pairs(skin.id)) {
    const min = pair.min ?? 4.5;
    let worst = { value: Infinity, fg: null, bg: null };
    for (const fg of pair.fg) {
      for (const bg of pair.bg) {
        const value = ratio(fg, bg);
        if (value < worst.value) worst = { value, fg, bg };
      }
    }
    if (!isFinite(worst.value)) {
      contractErrors.push(`${skin.label} · ${pair.label}: token ausente o sin colores que auditar`);
      continue;
    }
    rows.push({
      pair: `${skin.label} · ${pair.label}`,
      fg: toHex(worst.fg),
      bg: toHex(worst.bg),
      ratio: worst.value.toFixed(2),
      aa: worst.value >= min ? 'pass' : 'fail',
      min: `${min}:1`,
      note: pair.note,
    });
  }
}

/* Shared, hard-coded pairs from base.css. */
const shared = [
  { pair: 'Ambas · dígitos del contador', fg: '#7bedb0', bg: '#02131c', min: 4.5, note: 'si el contador sobrevive' },
  { pair: 'Ambas · anillo de foco', fg: '#0b4a6b', bg: '#f7fcff', min: 3, note: 'contraste no textual, 3:1' },
];

for (const pair of shared) {
  const value = ratio(hex(pair.fg), hex(pair.bg));
  rows.push({
    ...pair,
    ratio: value.toFixed(2),
    aa: value >= pair.min ? 'pass' : 'fail',
    min: `${pair.min}:1`,
  });
}

const failures = rows.filter((row) => row.aa === 'fail');

for (const message of contractErrors) console.error(`CONTRATO: ${message}`);

writeFileSync(
  resolve(root, 'src/data/contrast.json'),
  JSON.stringify({ generated: new Date().toISOString().slice(0, 10), rows }, null, 2) + '\n',
);

const pad = (s, n) => String(s).padEnd(n);
console.log(`${pad('PAR', 42)} ${pad('RATIO', 7)} ${pad('MÍN', 6)} AA    FG / BG`);
for (const row of rows) {
  console.log(
    `${pad(row.pair, 42)} ${pad(row.ratio, 7)} ${pad(row.min, 6)} ${row.aa === 'pass' ? 'PASA ' : 'FALLA'} ${row.fg} / ${row.bg}`,
  );
}
console.log(`\n${rows.length} pares · ${failures.length} fallan · escrito src/data/contrast.json`);

if (failures.length || contractErrors.length) process.exit(1);
