#!/usr/bin/env node
/*
 * WCAG contrast audit for the tokens that actually carry text.
 *
 * Gradients and translucent surfaces are resolved first: a text pair is only
 * measured against the pixels it really sits on. For every pair we take the
 * worst stop, so a chrome bar passes only if its lightest stop passes.
 *
 * Writes src/data/contrast.json (consumed by /styleguide) and exits 1 on a
 * failed pair.
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

const aero = blockFor("[data-skin='aero']");
const y2k = { ...aero, ...blockFor("[data-skin='y2k']") };

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

const SKY = { aero: '#7cc8f5', y2k: '#04263f' };
const GRASS = { aero: '#6fc23c', y2k: '#0a2f22' };

const pairs = (skin) => {
  const t = skin === 'aero' ? aero : y2k;
  const heading = {
    label: 'Chrome heading · cara',
    fg: colorsIn(t['--head-face']),
    bg: colorsIn(t['--panel']),
    note:
      skin === 'aero'
        ? 'metal oscuro sobre panel claro; el trazo solo afina el borde'
        : 'plata clara sobre navy; el trazo solo afina el borde',
  };

  const glassOverSky = over(colorsIn(t['--glass'])[0], hex(SKY[skin]));
  const glassOverGrass = over(colorsIn(t['--glass'])[0], hex(GRASS[skin]));
  const trayStops = colorsIn(t['--tray-bg']).map((c) => over(c, hex(SKY[skin])));

  return [
    { label: 'Texto · panel', fg: colorsIn(t['--ink']), bg: colorsIn(t['--panel']), note: 'párrafo y títulos sólidos' },
    { label: 'Texto suave · panel', fg: colorsIn(t['--ink-soft']), bg: colorsIn(t['--panel']), note: 'texto secundario' },
    { label: 'Enlace · panel', fg: colorsIn(t['--link']), bg: colorsIn(t['--panel']), note: 'links dentro de ventanas' },
    { label: 'Barra de ventana', fg: colorsIn(t['--bar-ink']), bg: colorsIn(t['--chrome']), note: 'peor stop del cromo' },
    { label: 'Botón', fg: colorsIn(t['--btn-ink']), bg: colorsIn(t['--btn-bg']), note: 'peor stop del gloss' },
    { label: 'Vidrio · texto', fg: colorsIn(t['--glass-ink']), bg: [glassOverSky, glassOverGrass], note: 'vidrio compuesto sobre cielo y pasto' },
    { label: 'Bandeja', fg: colorsIn(t['--tray-ink']), bg: trayStops, note: 'bandeja compuesta sobre cielo' },
    { label: 'Bandeja · suave', fg: colorsIn(t['--tray-soft']), bg: trayStops, note: 'idioma y etiquetas de la bandeja' },
    { label: 'Ticker', fg: colorsIn(t['--ticker-ink']), bg: colorsIn(t['--ticker-bg']), note: 'línea de avisos' },
    heading,
    { label: 'Menú Inicio', fg: colorsIn(t['--menu-ink']), bg: colorsIn(t['--menu-bg']), note: 'ítems del menú' },
    { label: 'Botón Inicio', fg: colorsIn(t['--start-ink']), bg: colorsIn(t['--start-bg']), note: 'peor stop del botón' },
  ];
};

const rows = [];

for (const skin of ['aero', 'y2k']) {
  for (const pair of pairs(skin)) {
    let worst = { value: Infinity, fg: null, bg: null };
    for (const fg of pair.fg) {
      for (const bg of pair.bg) {
        const value = ratio(fg, bg);
        if (value < worst.value) worst = { value, fg, bg };
      }
    }
    rows.push({
      pair: `${skin === 'aero' ? 'Aero' : 'Y2K'} · ${pair.label}`,
      fg: toHex(worst.fg),
      bg: toHex(worst.bg),
      ratio: worst.value.toFixed(2),
      aa: worst.value >= 4.5 ? 'pass' : 'fail',
      min: '4.5:1',
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

if (failures.length) process.exit(1);
