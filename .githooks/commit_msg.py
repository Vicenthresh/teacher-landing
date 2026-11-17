#!/usr/bin/env python3
"""commit-msg hook for the project-commits skill (portable: works in any repo).

Rules, in order:
  1. Merge / Revert / fixup! / squash! subjects are git's own words: always allowed.
  2. Subject must be `Area: subject` (this also accepts conventional commits: fix:, docs:).
  3. `State:` (if present) must be a valid project state.
  4. `Agent:` (if present) must be a single lowercase word (opencode, claude, human...).
  5. `Model:` (optional, may repeat) must be a model id: lowercase, no spaces
     (deepseek-v4.1-flash, claude-opus-5-5, opencode-go/qwen3.8-flash).
  6. `Review:` (optional) must start with none, review, opus-check or council.
  7. If `.githooks/project-commits.conf` sets `hub_paths`, a commit that stages files
     under those prefixes must carry a `Hub:` trailer.

Config (optional, committed next to the hook):  hub_paths = Pitches/ Projects/
Bypass for a quick human fix: git commit --no-verify
"""
import re
import subprocess
import sys
from pathlib import Path

STATES = {"pitch", "plan", "scaffold", "active", "paused", "done", "abandoned"}
REVIEWS = {"none", "review", "opus-check", "council"}
EXEMPT = ("Merge ", "Revert ", "fixup! ", "squash! ", "amend! ")
HERE = Path(__file__).resolve().parent


def hub_paths():
    conf = HERE / "project-commits.conf"
    if not conf.exists():
        return []
    for line in conf.read_text(encoding="utf-8").splitlines():
        m = re.match(r"^\s*hub_paths\s*=\s*(.+?)\s*$", line)
        if m:
            return m.group(1).split()
    return []


def staged_files():
    out = subprocess.run(["git", "diff", "--cached", "--name-only"], capture_output=True, text=True)
    return out.stdout.splitlines() if out.returncode == 0 else []


def fail(msg):
    print(f"commit-msg: {msg}\nFormat: 'Area: subject' + optional Hub:/State:/Agent:/Model:/Review: trailers "
          f"(skill: project-commits; bypass: --no-verify)")
    return 1


def main():
    raw = Path(sys.argv[1]).read_text(encoding="utf-8")
    body = "\n".join(l for l in raw.splitlines() if not l.startswith("#")).strip()
    if not body:
        return fail("empty message")
    subject = body.splitlines()[0]
    if subject.startswith(EXEMPT):
        return 0
    if not re.match(r"^[^:]{2,40}: .{5,72}$", subject):
        return fail(f"subject must be 'Area: subject' (got: {subject!r})")

    trailer = lambda k: (re.search(rf"^{k}: (.+?)\s*$", body, re.M) or [None, None])[1]
    state, agent, hub = trailer("State"), trailer("Agent"), trailer("Hub")

    if state and state not in STATES:
        return fail(f"bad State: {state!r} (want one of: {sorted(STATES)})")
    if agent and not re.match(r"^[a-z][a-z0-9._-]*$", agent):
        return fail(f"bad Agent: {agent!r} (want one lowercase word, e.g. opencode, claude, human)")
    for model in re.findall(r"^Model: (.+?)\s*$", body, re.M):
        if not re.match(r"^[a-z0-9][a-z0-9._/-]*$", model):
            return fail(f"bad Model: {model!r} (want a lowercase model id, e.g. deepseek-v4.1-flash)")
    review = trailer("Review")
    if review and review.split()[0] not in REVIEWS:
        return fail(f"bad Review: {review!r} (want one of: {sorted(REVIEWS)}, optionally followed by detail)")

    prefixes = hub_paths()
    if prefixes and not hub and any(f.startswith(tuple(prefixes)) for f in staged_files()):
        return fail(f"commit touches {' / '.join(prefixes)} but has no 'Hub: [[Note]]' trailer")
    return 0


if __name__ == "__main__":
    sys.exit(main())
