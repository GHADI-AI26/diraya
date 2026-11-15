# دِراية · DIRAYA

Arabic-first, bilingual early-warning platform for corporate banking relationship managers. It flags likely **relationship deterioration** about three months ahead. It does not predict confirmed customer departure or bank switching.

> **Synthetic data.** 3,000 synthetic Saudi companies, 36 months (2023-01 → 2025-12). Scores rank companies; they are not calibrated probabilities. Predictions are not confirmed outcomes.

## Start on macOS

Requires Python 3.10 or newer (`python3 --version`).

```bash
cd diraya
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
bash run.sh
```

Open **http://127.0.0.1:8000** in Safari, Chrome or Firefox. Stop the server with `Ctrl+C`.

Next time, only these are needed:

```bash
cd diraya
source .venv/bin/activate
bash run.sh
```

## Thmanyah font (needed for the Arabic typography)

The Thmanyah licence forbids bundling the font, so it is **not** in this ZIP. Add your own copy once:

1. Download it from https://font.thmanyah.com/ and keep `Thmanyah-Font-Family.zip` in **Downloads**.
2. Run `bash run.sh`. It copies the 15 official files into `fonts-local/thmanyah/` and the server prints
   `Thmanyah fonts found (15 files): the Arabic site renders in Thmanyah.`

If the ZIP is somewhere else:

```bash
python3 backend/scripts/add_thmanyah.py ~/path/to/Thmanyah-Font-Family.zip
```

The wordmark «دِراية», Arabic headlines and Arabic interface text all use Thmanyah. To check it on your Mac, follow the steps in [docs/TYPOGRAPHY.md](docs/TYPOGRAPHY.md).

## Pages

| URL | Page |
|---|---|
| `#/experience` | Experience mode (landing page, 4 scenes). Space or Enter for next, `1`–`4` to jump, `Esc` for the platform |
| `#/platform` | Portfolio: KPIs, health distribution, risk map, attention list, test results |
| `#/platform/company/PC00514` | Case file with live model inference |
| `#/platform/method` | Methodology and final test metrics |

Add `?lang=en` for English, or `?mode=recorded` to replay recorded model outputs without the backend.

## Source of truth

`notebooks/Dirayah.ipynb` is the approved notebook (unmodified copy). The bundled models in `models/sila_final_models.pkl` give identical predictions to the models it trains, row for row. Its test results, shown on the site:

| Target | Test results |
|---|---|
| 1 · Relationship deterioration | PR-AUC 0.3725 · Precision@200 49.5% (99 of 200 customer-month records; 123 distinct companies) · Recall@200 38.8% · monthly Top-50 list, average precision 45.2% · test prevalence 1.8% |
| 2 · Future activity change | MAE 0.1224 · RMSE 0.1878 · R² 0.227 |
| 3 · Structural decline | PR-AUC 0.6127 · Precision 64.0% · Recall 56.1% · F1 0.598 |

The December 2025 portfolio figures (2,960 companies, 139 alerts, 49 priority reviews) are produced by these same models with the app's validation-based thresholds. They are predictions, not outcomes, and are not printed in the notebook.

## Tests

```bash
cd backend
python -m pytest -q
```

Arabic demo script: [docs/DEMO_AR.md](docs/DEMO_AR.md).


## Public deployment — GitHub + Render

The public version automatically uses the openly licensed IBM Plex Sans Arabic and
Noto Naskh Arabic fallbacks. Thmanyah remains available **only on your local Mac**
when you have the official files installed. Do not upload or deploy `fonts-local/`.

1. Create a new GitHub repository, and upload the **contents of `diraya/`** as the
   repository root (not the parent ZIP).
2. Ensure `fonts-local/`, `.venv/`, any passwords or API keys are not committed.
3. In Render, choose **New > Blueprint**, connect the GitHub repository, and
   approve the `render.yaml` web service.
4. Wait for the deployment to finish, then open the `https://...onrender.com`
   URL Render gives you. The first visit on the free plan may take a little longer.
5. Check `https://YOUR-RENDER-URL/api/status`, then test the homepage, portfolio,
   methodology, company details, and both languages.

**Thmanyah licence:** A public site that serves the Thmanyah font files requires
written permission from the rights holder. The public fallback is intentionally
different from the local Thmanyah rendering. Do not treat outlined logo lettering
as permission to publish font files. If you obtain written web-hosting permission,
revisit the public font configuration.

**Model reproducibility:** Deployment should be checked against the approved
`notebooks/Dirayah.ipynb` before sharing widely. The website's demo data and
scores are synthetic, not real bank outcomes.
