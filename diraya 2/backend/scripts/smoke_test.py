"""End-to-end HTTP smoke test against a running Diraya server.

    uvicorn app.main:app --port 8000      # in one terminal
    python -m scripts.smoke_test          # in another (or: python -m scripts.smoke_test http://host:port)
"""
import csv
import json
import sys
import time
import urllib.request
from pathlib import Path

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000").rstrip("/")
DATA = Path(__file__).resolve().parents[2] / "data" / "pulse_corporate_banking_monthly.csv"


def get(path):
    start = time.perf_counter()
    with urllib.request.urlopen(BASE + path, timeout=30) as r:
        body = r.read()
    return json.loads(body), (time.perf_counter() - start) * 1000


def post(path, payload):
    req = urllib.request.Request(BASE + path, data=json.dumps(payload).encode(), headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())


def check(name, cond, detail=""):
    print(f"{'PASS' if cond else 'FAIL'}  {name}  {detail}")
    if not cond:
        check.failed = True


check.failed = False


def main():
    status, ms = get("/api/status")
    check("status", status["live"] and status["feature_code_matches_notebook"], f"{status['bundle']} ({ms:.0f} ms)")
    portfolio, ms = get("/api/portfolio")
    check("portfolio", portfolio["kpis"]["alerts"] == 139 and portfolio["kpis"]["priority"] == 49, f"({ms:.0f} ms)")
    search, ms = get("/api/companies?q=PC005&limit=5")
    check("search", len(search["results"]) > 0, f"{len(search['results'])} results ({ms:.0f} ms)")
    company, ms = get("/api/companies/PC01857?month=2025-05")
    check("company live inference", company["inference"]["live"] and company["month"] == "2025-05",
          f"score {company['reading']['t1']['score']:.3f}, alert {company['reading']['t1']['alert']} ({ms:.0f} ms)")
    non_dip = next(m for m, d in zip(company["history"]["months"], company["history"]["dip"]) if not d)
    company2, _ = get(f"/api/companies/PC01857?month={non_dip}")
    check("target 3 not applicable outside dip months", company2["reading"]["t3"]["assessment"] == "Not applicable", non_dip)

    with DATA.open(newline="") as f:
        rows = [r for r in csv.DictReader(f) if r["customer_id"] == "PC00514"]
    records = [{k: (None if v == "" else v) for k, v in r.items()} for r in rows]
    scored = post("/api/score", {"records": records})
    reference, _ = get("/api/companies/PC00514")
    check("POST /api/score matches company reading",
          abs(scored["deterioration"]["score"] - reference["reading"]["t1"]["score"]) < 1e-9,
          f"{scored['deterioration']['score']:.4f} / follow-up {scored['follow_up']} ({scored['milliseconds']} ms)")
    try:
        urllib.request.urlopen(BASE + "/api/companies/NOPE", timeout=10)
        check("unknown company -> 404", False)
    except urllib.error.HTTPError as e:
        check("unknown company -> 404", e.code == 404)
    with urllib.request.urlopen(BASE + "/", timeout=10) as r:
        check("frontend served", "دِراية".encode() in r.read())
    sys.exit(1 if check.failed else 0)


if __name__ == "__main__":
    main()
