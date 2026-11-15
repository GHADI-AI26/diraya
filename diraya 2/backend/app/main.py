"""Diraya API server (ASGI).

Built on Starlette - the ASGI toolkit that FastAPI itself is built on - and served by
uvicorn. One process serves both the JSON API (/api/...) and the compiled frontend.

Run from the `backend/` folder (Diraya · دِراية):
    uvicorn app.main:app --port 8000
"""
from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from starlette.applications import Starlette
from starlette.concurrency import run_in_threadpool
from starlette.middleware import Middleware
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.gzip import GZipMiddleware
from starlette.requests import Request
import re

from starlette.responses import FileResponse, JSONResponse
from starlette.routing import Mount, Route
from starlette.staticfiles import StaticFiles

from .engine import Engine

ROOT = Path(__file__).resolve().parents[2]
DATA_PATH = Path(os.getenv("LAMHA_DATA", os.getenv("ATHAR_DATA", ROOT / "data" / "pulse_corporate_banking_monthly.csv")))
MODELS_DIR = Path(os.getenv("LAMHA_MODELS", os.getenv("ATHAR_MODELS", ROOT / "models")))
FRONTEND_DIR = Path(os.getenv("LAMHA_FRONTEND", os.getenv("ATHAR_FRONTEND", ROOT / "frontend" / "public")))
# The presenter's OWN copy of the Thmanyah fonts (added with backend/scripts/add_thmanyah.py).
# Outside the public folder, excluded from git/Docker/ZIP, and served ONLY to a browser on this same computer:
# the Thmanyah licence forbids hosting the font or letting third parties download it.
LOCAL_FONTS_DIR = Path(os.getenv("LAMHA_LOCAL_FONTS", ROOT / "fonts-local" / "thmanyah"))
FONT_FILE = re.compile(r"^thmanyah(sans|serifdisplay|seriftext)-(Light|Regular|Medium|Bold|Black)\.(woff2|otf)$")
LOOPBACK = {"127.0.0.1", "::1", "localhost"}

# Companies used in the guided demo (all outputs are computed live by the models).
DEMO_COMPANIES = [
    {"customer_id": "PC00514", "role": "Investigation",
     "why": "Five of six warning signals are visible in its history."},
    {"customer_id": "PC01474", "role": "Top of the list",
     "why": "Highest deterioration ranking score in December 2025."},
    {"customer_id": "PC01857", "role": "Replay",
     "why": "Alerted in May 2025, a test month the model never saw; the dataset records a deterioration within the next 3 months."},
    {"customer_id": "PC01232", "role": "Non-structural dip",
     "why": "Alerted, but its current dip is assessed as non-structural."},
]

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
engine: Engine | None = None


@asynccontextmanager
async def lifespan(app):
    global engine
    engine = await run_in_threadpool(Engine, DATA_PATH, MODELS_DIR)
    fonts = [p for p in _local_font_files() if p.suffix == ".woff2"]
    if len(fonts) >= 15:
        print(f"Thmanyah fonts found ({len(fonts)} files): the Arabic site renders in Thmanyah.", flush=True)
    else:
        print(f"\n*** Thmanyah fonts NOT found in {LOCAL_FONTS_DIR} ({len(fonts)} of 15 woff2 files).\n"
              "*** Arabic text will NOT be in Thmanyah. Download the font from https://font.thmanyah.com/ and run:\n"
              "***   python3 backend/scripts/add_thmanyah.py ~/Downloads/Thmanyah-Font-Family.zip\n", flush=True)
    yield


def error(status: int, message: str) -> JSONResponse:
    return JSONResponse({"error": message}, status_code=status)


async def status(request: Request):
    return JSONResponse(engine.status())


async def portfolio(request: Request):
    return JSONResponse(engine.portfolio)


async def traces(request: Request):
    return JSONResponse(await run_in_threadpool(engine.traces))


async def companies(request: Request):
    query = request.query_params.get("q", "")
    try:
        limit = max(1, min(int(request.query_params.get("limit", 20)), 100))
    except ValueError:
        return error(400, "limit must be an integer")
    return JSONResponse({"results": engine.search(query, limit)})


async def company(request: Request):
    customer_id = request.path_params["customer_id"].upper()
    if not engine.has_customer(customer_id):
        return error(404, f"Unknown customer {customer_id}")
    month = request.query_params.get("month")
    return JSONResponse(await run_in_threadpool(engine.company, customer_id, month))


async def score(request: Request):
    try:
        body = await request.json()
    except Exception:
        return error(400, "Body must be JSON: {\"records\": [ {...monthly row...}, ... ]}")
    records = body.get("records") if isinstance(body, dict) else None
    if not isinstance(records, list) or not records:
        return error(400, "Provide a non-empty 'records' list with one customer's monthly history.")
    try:
        result = await run_in_threadpool(engine.score_records, records)
    except ValueError as exc:
        return error(422, str(exc))
    return JSONResponse(result)


def _same_computer(request: Request) -> bool:
    """True only for a browser on this machine talking to this server directly (no proxy, no LAN, no deployment)."""
    host = (request.headers.get("host") or "").rsplit(":", 1)[0].strip("[]").lower()
    return (request.client is not None and request.client.host in LOOPBACK and host in LOOPBACK
            and "x-forwarded-for" not in request.headers and "forwarded" not in request.headers)


def _local_font_files() -> list[Path]:
    if not LOCAL_FONTS_DIR.is_dir():
        return []
    files = [p for p in LOCAL_FONTS_DIR.iterdir() if FONT_FILE.match(p.name)]
    woff2 = {p.stem for p in files if p.suffix == ".woff2"}
    return sorted(p for p in files if p.suffix == ".woff2" or p.stem not in woff2)


async def local_font_file(request: Request):
    name = request.path_params["name"]
    if not _same_computer(request) or not FONT_FILE.match(name):
        return error(404, "not found")
    path = LOCAL_FONTS_DIR / name
    if not path.is_file():
        return error(404, "not found")
    return FileResponse(path, headers={"Cache-Control": "no-store", "X-Robots-Tag": "noindex"})


async def demo(request: Request):
    return JSONResponse({"companies": DEMO_COMPANIES})


routes = [
    Route("/api/status", status),
    Route("/api/portfolio", portfolio),
    Route("/api/traces", traces),
    Route("/api/demo", demo),
    Route("/api/companies", companies),
    Route("/api/companies/{customer_id}", company),
    Route("/api/score", score, methods=["POST"]),
    Route("/local-fonts/{name}", local_font_file),
    Mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend"),
]

app = Starlette(
    routes=routes,
    lifespan=lifespan,
    middleware=[
        Middleware(GZipMiddleware, minimum_size=1000),
        Middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["GET", "POST"], allow_headers=["*"]),
    ],
)
