# Desktop session: decisions record

Copied verbatim from the session plan so it survives when SESSION.md is deleted.

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
