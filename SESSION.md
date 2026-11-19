# Session: turn / into a bolder, no-scroll old-school desktop where real Win98/XP icons open the content windows
Tier: long   Branch: session/bold-desktop   Test: pnpm build
Out of scope: real content (copy stays placeholder, no invented facts), EN pages, edge-drag window resizing, saving window positions between visits, new skins, Lighthouse/LCP re-measurement (src/data/measurements.json stays hand-recorded), deploy, any runtime dependency.

## Decisions
Builders read this section. F1 copies it to docs/desktop.md so it survives when SESSION.md is deleted.

**Env.** System node is broken. Every pnpm/node command needs `export PATH="$HOME/.local/node/bin:$PATH"` first. The icon script needs Python 3 with Pillow (Pillow 13 is installed). It is a dev-only tool, never run by `pnpm build`.

**Brief corrections, checked on disk.**
- PNG variant numbers do NOT reliably mean size. `help_book_big` has no 48 px variant. `help_book_small-10.png` is 16 px.
- So the pipeline reads the real pixel size with Pillow. Per base name it takes the largest size, then the largest file at that size (the highest colour depth).
- The contrast audit is 94 rows today: 23 pairs × 4 skins + 2 shared. It is not 26.

**1. Icons → windows.** These nine ship. The atlas order is the index `--i`.

| i | key | label (JSON) | XP source (aero, xp, y2k) | 98 source (90s) | opens |
|---|---|---|---|---|---|
| 0 | inicio | Inicio | computer_explorer-1 | computer_explorer-1 | Hero (`#inicio`), open on first load |
| 1 | contacto | Contacto | msmsgs_1-2 | users_green-1 | Contact (`#contacto`) |
| 2 | cv | CV.doc | wordpad_128-1 | wordpad_154-0 (32 px) | Cv (`#cv`) |
| 3 | proyectos | Proyectos | directory_closed-1 | directory_closed-1 | Projects (`#proyectos`) |
| 4 | blog | Blog.txt | notepad-2 | notepad-1 | Blog (`#blog`) |
| 5 | pantalla | Pantalla | display_properties-2 | display_properties-1 | new Display window: ThemeSwitch plus a `<noscript>` note |
| 6 | leeme | Léeme.txt | help_book_small-2 | help_book_small-1 | new Readme window: how to use the desktop, plus the garnish now in Footer.astro |
| 7 | styleguide | Style guide | world-2 | world-1 | shortcut link to `/styleguide/` (no window) |
| 8 | papelera | Papelera | recycle_bin_empty-1 | recycle_bin_empty-1 | new Trash window: empty-state copy only |

Each atlas has one more row: the 16 px variant of the same base, for title bars and taskbar buttons. A source with no 48 px variant is centred unscaled in its 48 px cell. Projects keeps its own pixel-art `px-*` items: the `pixel-set` ingredient stays as it is.

**2. Icon delivery.**
- **Format.** Two lossless WebP sprite atlases, 9 columns × (48 + 16) px = 432×64 px: `public/icons/xp.webp` and `public/icons/98.webp`.
- **Measured with a trial build of exactly this set.**
  - XP: 26.5 KB WebP vs 32.9 KB PNG vs 37.6 KB as 18 separate PNGs.
  - 98: 5.2 KB WebP vs 13.4 KB PNG.
  - Lossless keeps the pixels exact. Quantised PNG8 breaks the XP alpha.
- **How a skin picks its atlas.** `tokens.css` holds an asset token, `--icon-atlas: url('/icons/xp.webp')`, in aero and xp; 90s uses `98.webp`; y2k inherits aero. Icons draw it with `background-image: var(--icon-atlas)` and `background-position: calc(var(--i) * -48px) 0`. The 16 px row is at `calc(var(--i) * -48px) -48px`, so a 16 px icon sits in its 48 px column. Use `image-rendering: pixelated`.
- **Why one file per skin.** A browser only fetches a background image that applies, so a visitor downloads one atlas: the one for the active skin.
- **Index file.** `src/data/icons.json` maps key → `{ i, xp, w98, size48xp, size48w98 }`, with source filenames for credits.
- **Weight rows (`scripts/weight.mjs`, raw bytes, because WebP does not gzip).**
  - `Iconos XP (atlas WebP)` ≤ 30 KB
  - `Iconos 98 (atlas WebP)` ≤ 8 KB
  - New `Primera carga de / (peor caso)` = / HTML+CSS+JS + fonts + cursors + XP atlas, ≤ 350 KB. Expected about 70 KB.
  - The existing styleguide worst-case row adds both atlases, because the plates show every skin. Expected about 82 KB.
  - / total HTML+CSS+JS stays ≤ 100 KB. The soft target is ≤ 32 KB; it is 18.5 KB today.
- **Credits.** Add a `public/icons/NOTICE.txt`: Microsoft icons, non-commercial learning project, source pack, curated set only.

**3. No-scroll desktop.**

*Desktop mode*, when `(min-width: 48rem) and (min-height: 32rem)`:
- **Layout.** `main#main.desk` is `position: fixed; inset: 0 0 var(--taskbar-h) 0; overflow: hidden`. `--taskbar-h` is 48px (54px under the 540px taskbar container rule). Backdrop and taskbar are unchanged.
- **Icon grid.** A `<nav aria-label>` holding a `<ul>`. Cells are 88×96 px (`--icon-cell-w` / `--icon-cell-h`), with `grid-auto-flow: column`, `grid-template-rows: repeat(auto-fill, var(--icon-cell-h))`, padding 12px. Icons fill top-down, then the next column, like Windows. At 800px tall that is 2 columns.
- **Windows.** They live in the same `.desk` as `position: absolute` and can overlap icons.
- **Cascade.** The first window sits at x = (icon columns × 88) + 24, y = 16. Each next one moves +28/+28, clamped inside the desk.
- **Default widths** (min with the desk width minus the start x minus 16):
  - inicio 34rem, contacto 26rem, cv 30rem, proyectos 34rem
  - blog 40rem, pantalla 24rem, leeme 30rem, papelera 22rem
- **Height.** `max-height` = desk height − 32px. `.window__body` scrolls inside (`overflow: auto; overscroll-behavior: contain`). The page itself never scrolls.

*Selection and keyboard.* Each icon is a real link: `<a href="#cv" data-desk-icon="cv">`, or `/styleguide/` for the shortcut.
- **Mouse.** Click (`event.detail ≥ 1`) selects; double-click opens.
- **Touch, keyboard and AT.** `pointerType === 'touch'` opens on a single tap. A click with `event.detail === 0` (keyboard or assistive tech) opens.
- **Roving tabindex.** The grid is one Tab stop. Arrow keys move the selection column-major (Up/Down inside a column, Left/Right across columns). Home and End jump to the ends. Enter and Space open.
- **Opening** focuses the window (`tabindex="-1"` on the section, labelled by its title). It brings the window to the front and syncs the hash with `history.replaceState`. `hashchange` opens the target window, so the start-menu and nav anchors keep working.
- **Closing.** Esc while focus is inside a window closes it. Esc in an open start menu still closes the menu first. Closing returns focus to the opener icon.
- **Taskbar.** Shows one button per open window: active is pressed; clicking the active one minimises it; clicking a minimised one restores it. Without JS the existing nav anchors stay.

*Drag, maximise, resize.*
- **Drag.** The existing drag code clamps against `.desk` (add it to the `.stage, .plinth` box selector), so the title bar always stays inside the desk. A `pointerdown` anywhere in a window brings it to the front and marks it `.is-active`; the others get inactive chrome.
- **Maximise.** Double-clicking a desk window's title bar toggles maximise. It still resets the position on styleguide demo windows. Max fills the desk (`inset: 0`), not the old `8px 8px 60px`.
- **Resize.** There is no edge resizing. On viewport `resize`, re-clamp every open window. If the media query flips, switch mode live.

*Phone mode* (outside that query) is one window at a time:
- **Icons.** A grid of `repeat(auto-fill, minmax(5.5rem, 1fr))`, up to 4 columns. 9 icons fit in 3 rows at 390×844, so the page still does not scroll.
- **Windows.** Opening one turns it into a full-screen sheet (`position: fixed; inset: 0 0 var(--taskbar-h) 0`) and closes any other. Drag is off and min/max are hidden; close returns to the grid. A short landscape phone is also phone mode.

*No JS* (pure CSS, `:target`):
- **Which window shows.** Desk windows are `display: none` unless `:target`.
- **Default window.** Hero is rendered LAST in the desk, and `#inicio` shows by default via `.window:target ~ #inicio { display: none }`. That is a sibling rule, so it does not need `:has()`.
- **Close.** Each desk window has a no-JS close link (`<a class="winbtn" href="#main" data-nojs-close>`), which JS removes. The JS min/max/close buttons render `hidden`, and JS un-hides them (the same pattern ThemeSwitch uses).
- **Phone.** It uses the same rules as full-screen sheets.

*Motion.* Open, close and minimise get a 120ms scale/fade only inside `prefers-reduced-motion: no-preference`. Boot behaviour is unchanged.

**4. "Bolder" in tokens.** Everything is in `tokens.css`; components keep using tokens only.
- **Type scale (shared `:root`).**
  - `--fs-xs` .75rem, `--fs-sm` .875rem, `--fs-base` 1rem, `--fs-lg` 1.125rem
  - `--fs-xl` 1.5rem, `--fs-2xl` 2rem, `--fs-3xl` 2.75rem
  - Title bar text goes from .8rem to `--fs-sm` 700. Desk labels are `--fs-sm` 700. Window body copy is `--fs-base`. The Hero name is `--fs-3xl`.
- **Chrome (shared).**
  - `--bar-h` 40px (was 34)
  - `--win-border` 2px (was 1)
  - `--winbtn-w` 28px, `--winbtn-h` 24px (were 24×20)
  - Desk icons are 48px, against the old 34px CSS folder.
- **Per-skin chrome.** A heavier `--win-shadow`.
- **New per-skin tokens.** Every skin defines all of them; y2k inherits.
  - `--icon-atlas`, `--accent`, `--accent-ink`
  - `--desk-label-ink`, `--desk-label-bg` (a translucent chip, so labels are measurable over any backdrop)
  - `--desk-select-bg`, `--desk-select-ink`
  - `--chrome-inactive`, `--bar-ink-inactive`
  - `--task-bg`, `--task-ink`, `--task-bg-on`, `--task-ink-on`
- **Accent direction.**
  - aero: a deep aqua-blue
  - xp: Luna blue
  - 90s: navy `#000080` with white ink
- **New contrast pairs in `scripts/contrast.mjs`.** 5 pairs × 4 skins = 20 rows, so 94 becomes 114. The desk tokens join `REQUIRED`.
  - Escritorio · etiqueta: the chip composited over every backdrop stop, like the tray
  - Escritorio · seleccionado
  - Barra inactiva
  - Tarea
  - Tarea · activa
- **Thresholds.** All new pairs ≥ 4.5:1. `Barra de ventana` and `Escritorio · seleccionado` ≥ 7:1 in all four skins. Bolder means AAA on the main chrome. Every existing pair still passes.

**5. /styleguide/ keeps working.**
- **Components.** Window.astro and Taskbar.astro changes are additive optional props. With no new props their HTML is unchanged.
- **desktop.js.** The window manager only runs when `[data-desk]` exists. The old `[data-windows]` close/reopen path and the drag demo are untouched.
- **New ingredient `desk-icons`.** It comes with an IngredientDemo case: the grid in each page skin, with the selected and focus states. Plate.astro swaps its CSS-drawn `.deskicon` for the real `DeskIcon` (aria-hidden), so the plates audit the atlas in every skin.
- **Generated data.** The contrast and weight tables render from regenerated JSON.
- **Gate.** `pnpm check:desk` also asserts that every styleguide ingredient id still renders.

## Foundation
- [x] F1 Icon pipeline, atlases, weight rows and the decisions record | files: scripts/icons.py, public/icons/xp.webp, public/icons/98.webp, public/icons/NOTICE.txt, src/data/icons.json, scripts/weight.mjs, package.json, docs/desktop.md | accept:
  - `scripts/icons.py` (`python3 -I`, Pillow only) reads `.assets/windows-icons/{winxp,win98}` and picks by real pixel size, then by bytes. It writes both 432×64 lossless WebP atlases plus icons.json in the Decisions §1 order.
  - It exits 1 with a clear message if `.assets` is missing. `--check` regenerates in memory and exits 1 if the committed files differ.
  - `package.json` gains `"icons": "python3 -I scripts/icons.py"`.
  - weight.mjs gains the two atlas rows and the `/` worst-case row from §2, and adds both atlases to the styleguide worst case. The XP atlas is ≤ 30 KB and the 98 atlas ≤ 8 KB.
  - `docs/desktop.md` holds the Decisions section verbatim. | test: `python3 -I scripts/icons.py --check && pnpm build && pnpm measure:weight`
- [x] F2 Bolder and desk tokens across all four skins, plus the new contrast pairs | files: src/styles/tokens.css, scripts/contrast.mjs | accept:
  - The shared type scale and chrome tokens exist (§4).
  - aero, xp and 90s each define every new per-skin token. 90s points `--icon-atlas` at `/icons/98.webp`; y2k inherits.
  - contrast.mjs has the 5 new pairs (the label chip composited over backdrops) and the extended `REQUIRED`.
  - The audit prints 114 rows, 0 failures. `Barra de ventana` and `Escritorio · seleccionado` are ≥ 7:1 in every skin. | test: `pnpm build && pnpm measure:contrast`
- [x] F3 Static desk shell: markup, copy and CSS, working with no JS | files: src/components/DeskIcon.astro, src/components/Desktop.astro, src/components/Window.astro, src/components/Taskbar.astro, src/components/sections/{Hero,Contact,Cv,Projects,Blog}.astro, src/pages/index.astro, src/data/home.es.json, src/data/site.es.json, src/styles/base.css | accept:
  - **Markup.** `/` renders `main#main.desk[data-desk]` with an icon `<nav>` of 6 icons: inicio, contacto, cv, proyectos, blog and the styleguide shortcut. Each is a `DeskIcon` link with `style="--i:N"` from icons.json and its label from `home.es.json` `desk.icons`. The 5 section windows render with Hero last.
  - **Window.astro** gains the optional props `app`, `atlasIcon` (a 16 px atlas icon in the title bar) and `nojsClose`. It gets `aria-labelledby` to a title id. Its button labels move from hard-coded Spanish to `site.es.json` `window.{min,max,close}`. Output for callers that pass none of these is unchanged.
  - **Taskbar.astro** gains an optional `tasks` prop, which renders an empty `[data-tasks]` strip.
  - **Headings.** One visually hidden `<h1>` (the site brand) sits on the desk; the Hero name becomes `h2`.
  - **Footer.** `<Footer />` comes off `/` (its garnish returns in T6).
  - **CSS.** base.css gets the §3 grid, absolute windows, phone-mode CSS and the `:target` rules. The page has no vertical scrollbar at 1280×800 or 390×844, and with JS off every icon opens its window. | test: `pnpm build && test "$(grep -o 'data-desk-icon=' dist/index.html | wc -l)" -eq 6`
- [x] F4 Window-manager glue in desktop.js | files: src/scripts/desktop.js | accept:
  - A `[data-desk]`-gated block adds `html.has-desk`, removes the no-JS close links and un-hides the JS controls.
  - `openWindow(app)` un-hides, cascades, brings to front and focuses; `closeWindow(app)` hides and returns focus to the opener. Desk close runs before the legacy `[data-windows]` path.
  - It handles a z-index counter, `.is-active`, `hashchange` and `replaceState`, and opens Hero on load when there is no hash.
  - Single-click open for now (T1 adds selection). The styleguide drag and close demos behave as before.
  - / JS gzip grows ≤ 2.5 KB. | test: `pnpm build && pnpm measure:weight`
- [x] F5 Structural gate: `check:desk` | files: scripts/desk-check.mjs, package.json | accept:
  - A dependency-free Node script parses `dist/index.html` and `dist/styleguide/index.html` with regex and asserts:
    - every `[data-desk-icon]` href resolves to a `.window[data-app]` id or a site path
    - every desk window has `aria-labelledby` → an existing id, one no-JS close link and hidden JS close/min/max buttons
    - every icon key exists in `icons.json` and its `--i` is within range
    - exactly one `<h1>` on `/`
    - no inline `style` on `/` carries a colour value
    - every `themes.items` and ingredient id from `styleguide.es.json` renders as `id="ing-<id>"` on /styleguide/
  - It exits 1 with a list of failures.
  - `package.json` gains `"check:desk"`, and `measure` becomes build + contrast + weight + check:desk. | test: `pnpm build && pnpm check:desk`

## Tasks
- [ ] T1 Icon selection and keyboard model | size: medium | files: src/scripts/desktop.js, src/components/DeskIcon.astro, src/styles/base.css | accept:
  - The §3 model works: select on click, open on double-click, single-tap open on touch, `detail === 0` opens, roving tabindex, column-major arrows, Home/End, Enter/Space.
  - The selected state uses `--desk-select-bg/ink`, and a focus ring is visible on top of the selection in all 3 page skins.
  - A click on empty desk clears the selection.
  - Verified in preview at 1280×800 (mouse and keyboard only). | test: `pnpm build && pnpm check:desk`
- [ ] T2 Taskbar window buttons and minimise | size: medium | files: src/components/Taskbar.astro, src/pages/index.astro, src/scripts/desktop.js, src/styles/base.css, src/data/site.es.json | accept:
  - `/` passes `tasks`. With JS the nav anchors hide and `[data-tasks]` lists one button per open window: its 16 px atlas icon plus the title, `aria-pressed` on the active one.
  - Click the active one to minimise; click a minimised one to restore and focus. The min button minimises into the taskbar.
  - Strip and button labels come from site.es.json.
  - The styleguide taskbar demos render unchanged (no `tasks` prop). | test: `pnpm build && pnpm measure:contrast && pnpm check:desk`
- [ ] T3 Drag, maximise and viewport resize on the desk | size: medium | files: src/scripts/desktop.js, src/styles/base.css | accept:
  - Drag clamps to `.desk` and the title bar can never leave it; `pointerdown` brings the window to the front.
  - Double-clicking a desk title bar toggles max, and max fills the desk above the taskbar. Styleguide demo windows keep dblclick-to-reset.
  - The cascade and default widths match §3. A window resize re-clamps open windows, and crossing the breakpoint switches mode without a reload.
  - Verified by dragging into all four edges at 1280×800 and 1024×600. | test: `pnpm build && pnpm check:desk`
- [ ] T4 Phone mode: one window at a time | size: medium | files: src/scripts/desktop.js, src/styles/base.css | accept:
  - Outside the §3 query: the icon grid fits without scroll at 390×844 and 844×390. A tap opens one full-screen sheet and closes any other; drag is off and min/max are hidden.
  - Close and Esc return to the grid with focus on the opener. The window body scrolls internally; the page never does.
  - Verified in preview at 390×844 with JS on and off. | test: `pnpm build && pnpm check:desk`
- [ ] T5 Apply the bolder visual language | size: medium | files: src/styles/base.css, src/components/Window.astro | accept:
  - base.css uses the §4 tokens: `--bar-h`, `--win-border`, the winbtn size, the type scale for title bars, labels, body and Hero name, and inactive chrome (`--chrome-inactive`, `--bar-ink-inactive`) on non-active desk windows.
  - No new literal colours enter base.css.
  - The styleguide plates and ingredient cards still render in every skin with no overflowing title bars at 612px plate width.
  - Before/after screenshots of / in aero, xp and 90s go to the thread. | test: `pnpm measure && pnpm check:desk`
- [ ] T6 New windows: Pantalla, Léeme, Papelera | size: medium | files: src/components/sections/Display.astro, src/components/sections/Readme.astro, src/components/sections/Trash.astro, src/components/sections/Footer.astro, src/pages/index.astro, src/data/home.es.json | accept:
  - Three new desk windows and their icons (`pantalla`, `leeme`, `papelera`), for 9 icons total.
  - **Pantalla** holds `ThemeSwitch` plus a `<noscript>` note from JSON. The tray switch stays.
  - **Léeme** holds the how-to (double-click, Enter, Esc, taskbar) plus the old footer garnish: badges, construction strip and footer line. It has no "back to top" link. Footer.astro is deleted or folded into Readme.
  - **Papelera** shows an empty-state line.
  - All copy is in home.es.json and invents no facts. | test: `pnpm build && pnpm check:desk && test "$(grep -o 'data-desk-icon=' dist/index.html | wc -l)" -eq 9`
- [ ] T7 Motion and reduced motion | size: small | files: src/styles/base.css, src/scripts/desktop.js | accept:
  - Open, close and minimise animate (120ms scale/fade) only under `prefers-reduced-motion: no-preference`. With reduce there are zero transitions on desk windows and icons.
  - JS never waits on `animationend` when motion is reduced.
  - Verified with emulated reduced motion in preview. | test: `pnpm build && pnpm measure:weight`
- [ ] T8 Styleguide: the `desk-icons` ingredient and real icons on the plates | size: medium | files: src/pages/styleguide.astro, src/components/styleguide/IngredientDemo.astro, src/components/styleguide/Plate.astro, src/data/styleguide.es.json, src/styles/base.css | accept:
  - A new `desk-icons` item in `themes.items` (verdict, notes, motion, cost from the measured atlas sizes) renders the grid in aero, xp, 90s and y2k plinths, with one icon selected and one focused.
  - Plate.astro uses `DeskIcon` (aria-hidden) instead of the CSS folder. The old `.deskicon__art` CSS is removed.
  - `check:desk` sees `ing-desk-icons`, and both audits pass. | test: `pnpm measure && pnpm check:desk`
- [ ] T9 Accessibility and no-JS pass | size: small | files: src/components/DeskIcon.astro, src/components/Desktop.astro, src/components/Window.astro, src/scripts/desktop.js, src/styles/base.css | accept:
  - With JS off: every icon opens its window, the close link works, and no visible control is dead.
  - With JS on: keyboard-only reaches every icon, window control and taskbar button. Focus is visible in aero, xp and 90s.
  - Window sections expose their title as the accessible name. Esc order is start menu → window.
  - Skip link lands on the desk. Boot `inert` still covers the desk.
  - Findings and fixes are listed in the commit body. | test: `pnpm build && pnpm check:desk`
- [ ] T10 Regenerate audits, docs and screenshots | size: small | files: src/data/contrast.json, src/data/weight.json, docs/desktop.md, README.md, docs/screenshots/desk-aero.png, docs/screenshots/desk-xp.png, docs/screenshots/desk-90s.png, docs/screenshots/desk-mobile.png | accept:
  - `pnpm measure` regenerates both JSON files: 114/114 pairs, 0 rows over budget.
  - docs/desktop.md gains a phase-0-style measurements table with the real numbers: / and /styleguide/ gzip, both atlases, both worst first loads, pair count.
  - The README describes the desktop, the `icons` and `check:desk` commands and the icon credits, and its screenshot table points at the 4 new `desk-*.png` (the old `home-*.png` are removed).
  - docs/phase-0.md is left as the historical record. | test: `pnpm measure && pnpm check:desk && ls docs/screenshots/desk-{aero,xp,90s,mobile}.png`
