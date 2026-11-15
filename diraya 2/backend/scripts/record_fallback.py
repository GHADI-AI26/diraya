"""Record real API outputs for Diraya's offline "Recorded replay" mode.

Runs the live engine (real models) and writes JSON files into frontend/public/recorded/.
The frontend only uses these files when the backend cannot be reached, and labels them
as recorded output - never as live inference.

    cd backend && python -m scripts.record_fallback
"""
from __future__ import annotations

import json
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.engine import Engine  # noqa: E402
from app.main import DATA_PATH, DEMO_COMPANIES, FRONTEND_DIR, MODELS_DIR  # noqa: E402

# Demo companies and the months whose live readings we record.
RECORD = {
    "PC00514": ["2025-06", "2025-09", "2025-12"],
    "PC01474": ["2025-12"],
    "PC01857": ["2025-04", "2025-05", "2025-06", "2025-12"],
    "PC01232": ["2025-12"],
    "PC00002": ["2025-08", "2025-09", "2025-12"],
}
EXTRA_TOP = 12  # also record the December reading of the top of the attention list


def dump(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, allow_nan=False, separators=(",", ":")), encoding="utf-8")


def main() -> None:
    out = FRONTEND_DIR / "recorded"
    if out.exists():
        shutil.rmtree(out)
    engine = Engine(DATA_PATH, MODELS_DIR)
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    status = engine.status()
    status["live"] = False
    dump(out / "status.json", status)
    dump(out / "portfolio.json", engine.portfolio)
    dump(out / "traces.json", engine.traces())
    dump(out / "demo.json", {"companies": DEMO_COMPANIES})

    plan = {cid: list(months) for cid, months in RECORD.items()}
    for row in engine.portfolio["attention"][:EXTRA_TOP]:
        plan.setdefault(row["customer_id"], [engine.snapshot_month])

    index = {"recorded_at": stamp, "companies": {}}
    for cid, months in plan.items():
        for month in months:
            data = engine.company(cid, month)
            data["inference"]["live"] = False
            data["inference"]["recorded_at"] = stamp
            dump(out / "companies" / f"{cid}__{month}.json", data)
        index["companies"][cid] = sorted(months)
    dump(out / "index.json", index)
    size = sum(f.stat().st_size for f in out.rglob("*.json")) / 1e6
    print(f"Recorded {sum(len(m) for m in plan.values())} company readings for {len(plan)} companies "
          f"({size:.1f} MB) at {stamp} -> {out}")


if __name__ == "__main__":
    main()
