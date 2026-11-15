"""Add YOUR copy of the Thmanyah fonts to Diraya on this computer — one step.

    python backend/scripts/add_thmanyah.py ~/Downloads/Thmanyah-Font-Family.zip
    python backend/scripts/add_thmanyah.py "~/Downloads/Thmanyah-Font-Family"      (unzipped folder)

Copies the 15 official font files (woff2, or OTF if no woff2) into fonts-local/thmanyah/.
When you then run Diraya, the Arabic site uses Thmanyah automatically on THIS computer.

Licence: Thmanyah may only be downloaded from https://font.thmanyah.com/ and used on your own devices;
redistributing, uploading or hosting it is forbidden. So fonts-local/ is excluded from git, Docker and the
project ZIP, and the Diraya server refuses to send these files to any other computer. Do not deploy them.
"""
from __future__ import annotations

import re
import shutil
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DEST = ROOT / "fonts-local" / "thmanyah"
PATTERN = re.compile(r"^thmanyah(sans|serifdisplay|seriftext)-(Light|Regular|Medium|Bold|Black)\.(woff2|otf)$")


def pick(names: list[str]) -> dict[str, str]:
    """basename -> member path; prefer woff2, fall back to otf for a style without woff2."""
    found: dict[str, str] = {}
    for n in names:
        base = n.replace("\\", "/").rsplit("/", 1)[-1]
        if "__MACOSX" in n or not PATTERN.match(base):
            continue
        found[base] = n
    stems = {b.rsplit(".", 1)[0] for b in found if b.endswith(".woff2")}
    return {b: p for b, p in found.items() if b.endswith(".woff2") or b.rsplit(".", 1)[0] not in stems}


def main() -> int:
    if len(sys.argv) != 2:
        print(__doc__)
        return 2
    src = Path(sys.argv[1]).expanduser()
    if not src.exists():
        print(f"Not found: {src}")
        return 1
    DEST.mkdir(parents=True, exist_ok=True)
    copied: list[str] = []
    if src.is_file() and zipfile.is_zipfile(src):
        with zipfile.ZipFile(src) as z:
            for base, member in sorted(pick(z.namelist()).items()):
                with z.open(member) as fi, open(DEST / base, "wb") as fo:   # basename only: no path traversal
                    shutil.copyfileobj(fi, fo)
                copied.append(base)
    elif src.is_dir():
        files = {str(p): p for p in src.rglob("*") if p.is_file()}
        for base, member in sorted(pick(list(files)).items()):
            shutil.copyfile(files[member], DEST / base)
            copied.append(base)
    else:
        print("Give the Thmanyah-Font-Family ZIP or its unzipped folder.")
        return 1

    families = {re.match(PATTERN, c).group(1) for c in copied}  # type: ignore[union-attr]
    print(f"Copied {len(copied)} Thmanyah font files to {DEST}")
    for c in copied:
        print("  ", c)
    missing = {"sans", "serifdisplay", "seriftext"} - families
    if missing:
        print("WARNING: no files found for:", ", ".join(sorted(missing)))
    if not copied:
        print("No official Thmanyah font files found (expected names like thmanyahserifdisplay-Bold.woff2).")
        return 1
    print("\nNow run Diraya (./run.sh or run.bat) and open http://127.0.0.1:8000 — "
          "the server prints 'Thmanyah fonts found (15 files)'.")
    print("Reminder: never commit, share or deploy fonts-local/ (Thmanyah licence).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
