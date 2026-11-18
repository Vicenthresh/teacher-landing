#!/usr/bin/env python3
"""Build the desktop icon atlases and src/data/icons.json.

Dev-only tool: `pnpm build` never runs it. Needs Python 3 and Pillow.

    python3 -I scripts/icons.py           regenerate the committed files
    python3 -I scripts/icons.py --check   regenerate in memory, exit 1 if the
                                          committed files differ

Source: .assets/windows-icons/{winxp,win98} (the Microsoft icon packs, kept
out of git). The curated set and its order are the index `--i` in the CSS.
See docs/desktop.md, Decisions section 1 and 2.

PNG variant numbers do NOT mean size (help_book_small-10 is 16 px), so the real
pixel size is read with Pillow. Per base name we take the largest size, then
the largest file at that size (the highest colour depth).
"""

import json
import re
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    sys.exit("icons.py: Pillow is missing (pip install Pillow).")

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / ".assets" / "windows-icons"
PACKS = {
    "xp": ASSETS / "winxp" / "winxp-icons" / "png",
    "98": ASSETS / "win98" / "win98-icons" / "png",
}
OUT_DIR = ROOT / "public" / "icons"
OUT_JSON = ROOT / "src" / "data" / "icons.json"

BIG, SMALL = 48, 16
COLS = 9
ATLAS_SIZE = (COLS * BIG, BIG + SMALL)  # 432 x 64

# i, key, XP base (aero, xp, y2k), 98 base (90s). Order is the index --i.
ICONS = [
    ("inicio", "computer_explorer", "computer_explorer"),
    ("contacto", "msmsgs_1", "users_green"),
    ("cv", "wordpad_128", "wordpad_154"),
    ("proyectos", "directory_closed", "directory_closed"),
    ("blog", "notepad", "notepad"),
    ("pantalla", "display_properties", "display_properties"),
    ("leeme", "help_book_small", "help_book_small"),
    ("styleguide", "world", "world"),
    ("papelera", "recycle_bin_empty", "recycle_bin_empty"),
]
assert len(ICONS) == COLS


def fail(message):
    print(f"icons.py: {message}", file=sys.stderr)
    sys.exit(1)


def variants(pack_dir, base):
    """Every PNG of a base name as (side, bytes, name, path), by real size."""
    found = []
    for path in pack_dir.glob(f"{base}-*.png"):
        if not re.fullmatch(re.escape(base) + r"-\d+\.png", path.name):
            continue
        with Image.open(path) as im:
            width, height = im.size
        if width != height:
            continue
        found.append((width, path.stat().st_size, path.name, path))
    return found


def pick(pack_dir, base, want):
    """Largest size <= want, then the largest file at that size."""
    options = [v for v in variants(pack_dir, base) if v[0] <= want]
    if not options:
        fail(f"no icon <= {want}px for '{base}' in {pack_dir}")
    side = max(v[0] for v in options)
    chosen = max((v for v in options if v[0] == side), key=lambda v: (v[1], v[2]))
    return chosen[3], side


def load(path):
    with Image.open(path) as im:
        return im.convert("RGBA")


def build(pack):
    pack_dir = PACKS[pack]
    atlas = Image.new("RGBA", ATLAS_SIZE, (0, 0, 0, 0))
    names = []
    sizes = []
    for i, entry in enumerate(ICONS):
        base = entry[1] if pack == "xp" else entry[2]
        big_path, big_side = pick(pack_dir, base, BIG)
        # the 16 px row: exactly the 16 px variant, never scaled
        small_path, small_side = pick(pack_dir, base, SMALL)
        if small_side != SMALL:
            fail(f"'{base}' in {pack_dir} has no {SMALL}px variant")
        big = load(big_path)
        # a coat smaller than 48 px is centred unscaled in its 48 px cell
        offset = (i * BIG + (BIG - big.width) // 2, (BIG - big.height) // 2)
        atlas.alpha_composite(big, offset)
        atlas.alpha_composite(load(small_path), (i * BIG, BIG))
        names.append(big_path.name)
        sizes.append(big_side)
    return atlas, names, sizes


def encode(atlas, dest):
    atlas.save(dest, "WEBP", lossless=True, quality=100, method=6)


def render():
    if not ASSETS.is_dir():
        fail(
            f"{ASSETS.relative_to(ROOT)} is missing. The icon packs are not in git: "
            "put winxp/ and win98/ under .assets/windows-icons/."
        )
    for pack, pack_dir in PACKS.items():
        if not pack_dir.is_dir():
            fail(f"{pack_dir.relative_to(ROOT)} is missing.")
    xp, xp_names, xp_sizes = build("xp")
    w98, w98_names, w98_sizes = build("98")
    index = {}
    for i, entry in enumerate(ICONS):
        index[entry[0]] = {
            "i": i,
            "xp": xp_names[i],
            "w98": w98_names[i],
            "size48xp": xp_sizes[i],
            "size48w98": w98_sizes[i],
        }
    text = json.dumps(index, indent=2, ensure_ascii=False) + "\n"
    return {"xp.webp": xp, "98.webp": w98}, text


def pixels(im):
    """RGBA bytes with the invisible RGB zeroed, so the encoder's choice for
    fully transparent pixels never shows up as a difference."""
    data = bytearray(im.convert("RGBA").tobytes())
    for p in range(0, len(data), 4):
        if data[p + 3] == 0:
            data[p] = data[p + 1] = data[p + 2] = 0
    return bytes(data)


def check(atlases, text):
    problems = []
    for name, atlas in atlases.items():
        path = OUT_DIR / name
        if not path.is_file():
            problems.append(f"{path.relative_to(ROOT)} is missing")
            continue
        with Image.open(path) as committed:
            if committed.size != ATLAS_SIZE or pixels(committed) != pixels(atlas):
                problems.append(f"{path.relative_to(ROOT)} differs from the sources")
    if not OUT_JSON.is_file() or OUT_JSON.read_text(encoding="utf-8") != text:
        problems.append(f"{OUT_JSON.relative_to(ROOT)} differs from the sources")
    return problems


def main(argv):
    flags = set(argv[1:])
    if flags - {"--check"}:
        fail("usage: icons.py [--check]")
    atlases, text = render()
    if "--check" in flags:
        problems = check(atlases, text)
        if problems:
            for line in problems:
                print(f"icons.py: {line}", file=sys.stderr)
            print("icons.py: run `pnpm icons` and commit the result.", file=sys.stderr)
            sys.exit(1)
        print("icons.py: atlases and icons.json match the sources.")
        return
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for name, atlas in atlases.items():
        encode(atlas, OUT_DIR / name)
        print(f"icons.py: wrote public/icons/{name} ({(OUT_DIR / name).stat().st_size} bytes)")
    OUT_JSON.write_text(text, encoding="utf-8")
    print("icons.py: wrote src/data/icons.json")


if __name__ == "__main__":
    main(sys.argv)
