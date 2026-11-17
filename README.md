# teacher-landing

Static landing site for a Chilean ESL teacher, dressed as a 2004 desktop
(Frutiger Aero base, Y2K accents). **Astro + hand-written CSS, no Tailwind, no UI kit.**

The design brief, budget, traps and phases live in the vault:
`Projects/Teacher Landing/Teacher Landing.md` (hub) and
`Pitches/Teacher Landing - Pitch.md`.

## Commands

```sh
pnpm install
pnpm dev        # http://localhost:4321
pnpm build      # astro check && astro build
pnpm preview
```

## Structure

```
src/
  components/Window.astro   # one window chrome, reused everywhere
  layouts/Base.astro        # <head>, meta, styles
  pages/index.astro         # hero skeleton (ES, `/`)
  pages/styleguide.astro    # the design gate — build ingredients here first
  styles/tokens.css         # colours, type, spacing; per-skin overrides
  styles/base.css           # reset + window/button/glass
public/favicon.svg
```

## Rules

- Budget: ≤ 100 KB HTML+CSS+JS gzipped per page, ≤ 350 KB first load, LCP < 2.5 s on 4G.
- No component library, no CSS framework, no animation library.
- Copy and prices live in content files, never in `.astro` markup.
- Spanish is the default locale (`/`), English under `/en/`.
- Effects are added to the styleguide first, then to a section.
