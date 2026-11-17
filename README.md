# teacher-landing

Static landing site for a Chilean ESL teacher, dressed as a 2004 desktop
(Frutiger Aero base, Y2K accents). **Astro + hand-written CSS, no Tailwind, no UI kit.**

The design brief, budget, traps and phases live in the vault:
`Projects/Teacher Landing/Teacher Landing.md` (hub) and
`Pitches/Teacher Landing - Pitch.md`.

**Phase 0 (style gate) is built and waiting for review.** See
[`docs/phase-0.md`](docs/phase-0.md) for the measurements, the verdict and the
blocked decisions. Phase 1 has not started.

## Commands

```sh
pnpm install
pnpm dev              # http://localhost:4321 — / and /styleguide/
pnpm build            # astro check && astro build
pnpm preview          # production build, for Lighthouse

pnpm measure:contrast # WCAG audit → src/data/contrast.json (exits 1 on failure)
pnpm measure:weight   # gzip weight from dist/ → src/data/weight.json
pnpm measure          # build + both
```

## Structure

```
src/
  components/           Window, Sky, Taskbar, Ticker, VisitorCounter, Boot*
    styleguide/         Plate (one skin) + IngredientDemo
  data/                 UI copy, styleguide copy, generated measurements
  layouts/Base.astro    head, meta, font preload, SVG sprite, styles
  pages/index.astro     skeleton (ES, `/`) — Phase 1 replaces it
  pages/styleguide.astro  the design gate: two plates, 13 ingredients, numbers
  scripts/desktop.js    drag, window controls, start menu, boot, sound, skin switch
  styles/tokens.css     aero + y2k skins
  styles/base.css       every ingredient, token-driven
  cursors/              SVG sources for the PNG cursors in public/
public/
  fonts/                Silkscreen 400/700, Latin subset + OFL licence
  cursors/              32 px PNG cursors
scripts/                contrast + weight reports
docs/phase-0.md         the Phase 0 record
```

## Rules

- Budget: ≤ 100 KB HTML+CSS+JS gzipped per page, ≤ 350 KB first load, LCP < 2.5 s on 4G.
- No component library, no CSS framework, no animation library.
- Copy and prices live in content files (`src/data/` now, `src/content/` in Phase 2),
  never in `.astro` markup.
- Spanish is the default locale (`/`), English under `/en/`.
- Effects are added to the styleguide first, then to a section.
- Every text pair on a gradient or translucent surface has to pass AA in
  `src/data/contrast.json` before it ships.
