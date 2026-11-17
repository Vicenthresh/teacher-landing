#!/usr/bin/env node
/*
 * Gzip weight of what a visitor actually downloads, per page.
 *
 * Reads the built dist/ (run `pnpm build` first), follows every stylesheet and
 * module script referenced by each page, and writes src/data/weight.json for
 * /styleguide.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const dist = resolve(root, 'dist');

if (!existsSync(resolve(dist, 'index.html'))) {
  console.error('dist/ is missing. Run `pnpm build` first.');
  process.exit(1);
}

const KB = 1024;
const fmt = (bytes) => `${(bytes / KB).toFixed(1)} KB`;
const gzip = (buffer) => gzipSync(buffer, { level: 9 }).length;

function assetSize(url) {
  const file = resolve(dist, url.replace(/^\//, ''));
  if (!existsSync(file)) return 0;
  const buffer = readFileSync(file);
  return { raw: buffer.length, gzip: gzip(buffer) };
}

function page(url) {
  const html = readFileSync(resolve(dist, url.replace(/^\//, ''), 'index.html'), 'utf8');
  const css = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)].map((m) => m[1]);
  const js = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]);

  const sum = { raw: 0, gzip: 0 };
  for (const href of [...css, ...js]) {
    const size = assetSize(href);
    sum.raw += size.raw;
    sum.gzip += size.gzip;
  }

  return {
    html: { raw: Buffer.byteLength(html), gzip: gzip(Buffer.from(html)) },
    css,
    js,
    cssSize: css.reduce((acc, href) => {
      const size = assetSize(href);
      return { raw: acc.raw + size.raw, gzip: acc.gzip + size.gzip };
    }, { raw: 0, gzip: 0 }),
    jsSize: js.reduce((acc, href) => {
      const size = assetSize(href);
      return { raw: acc.raw + size.raw, gzip: acc.gzip + size.gzip };
    }, { raw: 0, gzip: 0 }),
  };
}

const fonts = ['silkscreen-latin-400.woff2', 'silkscreen-latin-700.woff2'].map((name) => {
  const buffer = readFileSync(resolve(root, 'public/fonts', name));
  return { name, raw: buffer.length, gzip: gzip(buffer) };
});

const cursors = ['arrow.png', 'hand.png', 'move.png'].map((name) => {
  const buffer = readFileSync(resolve(root, 'public/cursors', name));
  return { name, raw: buffer.length, gzip: gzip(buffer) };
});

const pages = {
  '/': page('/'),
  '/styleguide/': page('/styleguide/'),
};

const fontTotals = fonts.reduce((a, f) => ({ raw: a.raw + f.raw, gzip: a.gzip + f.gzip }), { raw: 0, gzip: 0 });
const cursorTotals = cursors.reduce((a, f) => ({ raw: a.raw + f.raw, gzip: a.gzip + f.gzip }), { raw: 0, gzip: 0 });

const rows = [];
for (const [name, key] of [
  ['/', '/'],
  ['/styleguide/', '/styleguide/'],
]) {
  const p = pages[key];
  const total = {
    raw: p.html.raw + p.cssSize.raw + p.jsSize.raw,
    gzip: p.html.gzip + p.cssSize.gzip + p.jsSize.gzip,
  };
  rows.push(
    { item: `${name} · HTML`, raw: fmt(p.html.raw), gzip: fmt(p.html.gzip), budget: '—', over: false },
    { item: `${name} · CSS`, raw: fmt(p.cssSize.raw), gzip: fmt(p.cssSize.gzip), budget: '—', over: false },
    { item: `${name} · JS`, raw: fmt(p.jsSize.raw), gzip: fmt(p.jsSize.gzip), budget: '—', over: false },
    {
      item: `${name} · total HTML+CSS+JS`,
      raw: fmt(total.raw),
      gzip: fmt(total.gzip),
      budget: '≤ 100 KB',
      over: total.gzip > 100 * KB,
    },
  );
}

rows.push({
  item: 'Fuentes (2 woff2)',
  raw: fmt(fontTotals.raw),
  gzip: fmt(fontTotals.gzip),
  budget: '≤ 25 KB',
  over: fontTotals.gzip > 25 * KB,
});

rows.push({
  item: 'Cursores (3 PNG)',
  raw: fmt(cursorTotals.raw),
  gzip: fmt(cursorTotals.gzip),
  budget: '≤ 6 KB',
  over: cursorTotals.gzip > 6 * KB,
});

const worst = pages['/styleguide/'];
const firstLoad = worst.html.gzip + worst.cssSize.gzip + worst.jsSize.gzip + fontTotals.gzip + cursorTotals.gzip;
rows.push({
  item: 'Primera carga de /styleguide/ (peor caso)',
  raw: fmt(worst.html.raw + worst.cssSize.raw + worst.jsSize.raw + fontTotals.raw + cursorTotals.raw),
  gzip: fmt(firstLoad),
  budget: '≤ 350 KB',
  over: firstLoad > 350 * KB,
});

writeFileSync(
  resolve(root, 'src/data/weight.json'),
  JSON.stringify(
    {
      generated: new Date().toISOString().slice(0, 10),
      rows,
      fonts: fonts.map((f) => ({ name: f.name, bytes: f.raw })),
      assets: { css: pages['/'].css, js: pages['/'].js },
      firstLoadBytes: firstLoad,
    },
    null,
    2,
  ) + '\n',
);

const pad = (s, n) => String(s).padEnd(n);
console.log(`${pad('ÍTEM', 44)} ${pad('SIN COMPRIMIR', 14)} ${pad('GZIP', 10)} PRESUPUESTO`);
for (const row of rows) {
  console.log(`${pad(row.item, 44)} ${pad(row.raw, 14)} ${pad(row.gzip, 10)} ${row.budget}${row.over ? '  ← SOBRE' : ''}`);
}

const failures = rows.filter((row) => row.over);
console.log(`\n${failures.length} ítems sobre presupuesto · escrito src/data/weight.json`);
if (failures.length) process.exit(1);
