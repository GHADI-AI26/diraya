"""Diraya inference engine.

Loads the dataset and the trained model bundle (predictions identical, row for row,
to the models trained in the approved notebook notebooks/Dirayah.ipynb), generates
history features with the shared notebook function and applies the Relationship
Health rules (these rules are applied by this app; Dirayah.ipynb does not print them):

* Target 1 & 2 score every customer-month record.
* Target 3 is produced ONLY when is_dip_month == 1; otherwise "Not applicable".
* Alert / decline / structural thresholds are the validation-based values stored in the bundle.
* Indicator cut-offs are the 10th percentile of the Target 1 training period (as in the notebook).

Scores are ranking scores, not calibrated probabilities, and predictions are not outcomes.
"""
from __future__ import annotations

import logging
import math
import time
import warnings
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import sklearn

from . import features as shared_features
from .features import build_history_features

log = logging.getLogger("lamha.engine")

T1, T2, T3 = "y1_deterioration_next3m", "y2_activity_change_next3m", "y3_dip_is_structural"

FOLLOW_UP = [  # code, short label, notebook label, description
    ("priority", "Priority review", "1 - Priority RM review",
     "Deterioration alert and a structural dip in the same month."),
    ("checkin", "RM check-in", "2 - RM check-in",
     "Deterioration alert without a structural dip."),
    ("review_dip", "Review dip", "3 - Review dip",
     "Structural dip without a deterioration alert."),
    ("monitor", "Monitor", "4 - Monitor",
     "No alert, but the model expects a notable activity decline."),
    ("routine", "Routine", "5 - Routine",
     "No alert, no structural dip and no notable expected decline."),
]

# Human-readable signal groups used for the model-sensitivity view (Target 1).
SIGNAL_GROUPS = {
    "Product loss": ["products_chg_6m", "hist_products_drop_from_max_6m", "hist_products_std_6m"],
    "Balance erosion": ["bal_chg_3m_vs_prev3m", "bal_yoy_chg", "hist_bal_trend_6m",
                        "hist_bal_decline_streak", "hist_bal_cv_6m"],
    "Collections decline": ["coll_chg_3m_vs_prev3m", "coll_yoy_chg", "hist_coll_trend_6m",
                            "hist_coll_drawdown_12m", "hist_coll_vs_12m_avg", "hist_coll_chg_1m"],
    "Payments & transactions": ["pay_chg_3m_vs_prev3m", "pay_yoy_chg", "hist_pay_trend_6m",
                                "txn_count_chg_3m_vs_prev3m", "hist_txn_trend_6m", "hist_txn_chg_1m"],
    "Service friction": ["hist_complaints_6m", "complaints_count"],
    "Payroll shift": ["payroll_stopped_flag", "hist_payroll_vs_6m_avg"],
    "Credit usage": ["hist_util_chg_3m", "credit_utilization_pct"],
    "Digital engagement": ["hist_logins_chg_3m", "digital_logins_count"],
}

SPLIT_LABELS = {"train": "Training period (model has seen these labels)",
                "valid": "Validation period", "test": "Test period (unseen by the model)",
                "embargo": "Gap between periods", "no_label_horizon": "Future not yet observed"}


def _clean(value):
    """Convert numpy/pandas values to JSON-safe Python values."""
    if value is None:
        return None
    if isinstance(value, (np.floating, float)):
        return None if (math.isnan(value) or math.isinf(value)) else float(value)
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.bool_,)):
        return bool(value)
    return value


def _source_key(code: str) -> str:
    return "\n".join(line.rstrip() for line in code.strip().splitlines())


class Engine:
    def __init__(self, data_path: Path, models_dir: Path):
        start = time.time()
        self.data_path = Path(data_path)
        self.models_dir = Path(models_dir)

        self.raw = pd.read_csv(self.data_path)
        self.raw = self.raw.sort_values(["customer_id", "as_of_month"]).reset_index(drop=True)
        self.bundle, self.bundle_source = self._load_bundle()

        self.t1 = self.bundle["target1_deterioration"]
        self.t2 = self.bundle["target2_activity_change"]
        self.t3 = self.bundle["target3_structural"]
        self.feature_code_matches = (_source_key(self.bundle["history_feature_code"])
                                     == _source_key(_function_source()))

        history = build_history_features(self.raw)
        self.hist_features = list(history.columns)
        self.data = self.raw.join(history)

        # Score every customer-month once (used for percentiles, the portfolio and the intro).
        self.data["t1_score"] = self.t1["model"].predict_proba(self.data[self.t1["features"]])[:, 1]
        self.data["t2_pred"] = self.t2["model"].predict(self.data[self.t2["features"]])
        dip = self.data["is_dip_month"] == 1
        self.data["t3_score"] = np.nan
        self.data.loc[dip, "t3_score"] = self.t3["model"].predict_proba(self.data.loc[dip, self.t3["features"]])[:, 1]

        # Indicator cut-offs and typical values from the Target 1 TRAINING period (as in the notebook).
        t1_train = self.data[self.data[T1].notna() & (self.data["suggested_split"] == "train")]
        self.cutoffs = t1_train[["bal_chg_3m_vs_prev3m", "coll_chg_3m_vs_prev3m", "hist_coll_trend_6m"]].quantile(0.10)
        numeric = [f for f in self.t1["features"] if f not in ("industry", "company_size", "region")]
        self.train_medians = t1_train[numeric].median()

        self.months = sorted(self.data["as_of_month"].unique())
        self.snapshot_month = self.months[-1]
        self.month_split = self.data.groupby("as_of_month")["suggested_split"].agg(lambda s: s.mode().iat[0]).to_dict()
        self._apply_health(self.data)
        self.portfolio = self._build_portfolio()
        self.startup_seconds = round(time.time() - start, 2)
        log.info("Engine ready in %.1fs (bundle: %s)", self.startup_seconds, self.bundle_source)

    # ------------------------------------------------------------------ loading
    def _load_bundle(self):
        primary = self.models_dir / "sila_final_models.pkl"
        local = self.models_dir / "sila_final_models.local.pkl"
        for path, label in ((local, "rebuilt locally from the dataset"), (primary, "notebook bundle")):
            if not path.exists():
                continue
            try:
                with warnings.catch_warnings():
                    warnings.simplefilter("ignore")
                    bundle = joblib.load(path)
                if bundle.get("scikit_learn_version") == sklearn.__version__:
                    return bundle, f"{path.name} ({label})"
                log.warning("%s was saved with scikit-learn %s, installed is %s - rebuilding",
                            path.name, bundle.get("scikit_learn_version"), sklearn.__version__)
            except Exception as exc:  # pragma: no cover - depends on environment
                log.warning("Could not load %s: %s", path.name, exc)
        from .training import build_bundle
        log.warning("Rebuilding the model bundle from the dataset (one-time, ~30 s)...")
        bundle = build_bundle(self.raw)
        joblib.dump(bundle, local)
        return bundle, f"{local.name} (rebuilt locally from the dataset)"

    # ------------------------------------------------------------- health rules
    def _apply_health(self, frame: pd.DataFrame) -> pd.DataFrame:
        frame["t1_alert"] = frame["t1_score"] >= self.t1["alert_threshold"]
        frame["t2_decline"] = frame["t2_pred"] <= self.t2["decline_cutoff"]
        eligible = frame["is_dip_month"] == 1
        frame["t3_eligible"] = eligible
        frame["t3_structural"] = eligible & (frame["t3_score"] >= self.t3["threshold"])
        frame["follow_up"] = np.select(
            [frame["t1_alert"] & frame["t3_structural"], frame["t1_alert"], frame["t3_structural"], frame["t2_decline"]],
            ["priority", "checkin", "review_dip", "monitor"], default="routine")
        return frame

    def indicators(self, row: pd.Series) -> list[dict]:
        c = self.cutoffs

        def monthly_trend(value):
            return None if value is None or pd.isna(value) else math.exp(value) - 1

        rules = [
            ("products", "Products dropped", "6 months", row["products_chg_6m"], 0, "count",
             not pd.isna(row["products_chg_6m"]) and row["products_chg_6m"] < 0,
             "Active products fell over the last 6 months."),
            ("balance", "Balance down sharply", "3 months vs previous 3", row["bal_chg_3m_vs_prev3m"],
             c["bal_chg_3m_vs_prev3m"], "pct",
             not pd.isna(row["bal_chg_3m_vs_prev3m"]) and row["bal_chg_3m_vs_prev3m"] <= c["bal_chg_3m_vs_prev3m"],
             "Operating balance change is in the worst 10% of the training period."),
            ("collections", "Collections down sharply", "3 months vs previous 3", row["coll_chg_3m_vs_prev3m"],
             c["coll_chg_3m_vs_prev3m"], "pct",
             not pd.isna(row["coll_chg_3m_vs_prev3m"]) and row["coll_chg_3m_vs_prev3m"] <= c["coll_chg_3m_vs_prev3m"],
             "Incoming collections change is in the worst 10% of the training period."),
            ("trend", "Collections trending down", "6-month trend, per month", monthly_trend(row["hist_coll_trend_6m"]),
             monthly_trend(c["hist_coll_trend_6m"]), "pct",
             not pd.isna(row["hist_coll_trend_6m"]) and row["hist_coll_trend_6m"] <= c["hist_coll_trend_6m"],
             "The 6-month collections trend is in the worst 10% of the training period."),
            ("streak", "Balance falling", "consecutive months", row["hist_bal_decline_streak"], 3, "months",
             not pd.isna(row["hist_bal_decline_streak"]) and row["hist_bal_decline_streak"] >= 3,
             "The balance has fallen three or more months in a row."),
            ("payroll", "Payroll stopped", "this month", row["payroll_stopped_flag"], 1, "flag",
             row["payroll_stopped_flag"] == 1, "Payroll processing through the bank has stopped."),
        ]
        return [{"key": k, "label": label, "window": window, "value": _clean(value), "threshold": _clean(threshold),
                 "unit": unit, "triggered": bool(triggered), "explanation": text}
                for k, label, window, value, threshold, unit, triggered, text in rules]

    # --------------------------------------------------------------- portfolio
    def _build_portfolio(self) -> dict:
        snap = self.data[self.data["as_of_month"] == self.snapshot_month].copy()
        snap["percentile"] = snap["t1_score"].rank(pct=True) * 100
        last3 = self.data[self.data["as_of_month"].isin(self.months[-3:])]
        score_3m = last3.groupby("customer_id")["t1_score"].mean()
        snap["score_3m_avg"] = snap["customer_id"].map(score_3m)
        snap["signals"] = snap.apply(lambda r: [i["key"] for i in self.indicators(r) if i["triggered"]], axis=1)
        order = {code: i for i, (code, *_rest) in enumerate(FOLLOW_UP)}
        snap = snap.sort_values(["follow_up", "t1_score"], key=lambda s: s.map(order) if s.name == "follow_up" else -s)
        snap["rank"] = snap["t1_score"].rank(ascending=False, method="first").astype(int)
        self.snapshot = snap.set_index("customer_id", drop=False)

        counts = snap["follow_up"].value_counts()
        kpis = {
            "customers": int(len(snap)),
            "alerts": int(snap["t1_alert"].sum()),
            "priority": int(counts.get("priority", 0)),
            "t3_eligible": int(snap["t3_eligible"].sum()),
            "structural": int(snap["t3_structural"].sum()),
            "expected_decline": int(snap["t2_decline"].sum()),
        }
        distribution = [{"key": code, "label": label, "notebook_label": nb, "description": desc,
                         "count": int(counts.get(code, 0))} for code, label, nb, desc in FOLLOW_UP]
        points = {
            "id": snap["customer_id"].tolist(),
            "x": snap["percentile"].round(2).tolist(),
            "y": snap["t2_pred"].round(4).tolist(),
            "score": snap["t1_score"].round(4).tolist(),
            "category": snap["follow_up"].tolist(),
            "structural": snap["t3_structural"].astype(bool).tolist(),
            "industry": snap["industry"].tolist(),
        }
        attention = [self._summary_row(r) for _, r in snap[snap["follow_up"] != "routine"].head(150).iterrows()]
        return {
            "snapshot_month": self.snapshot_month,
            "kpis": kpis,
            "distribution": distribution,
            "points": points,
            "attention": attention,
            "thresholds": self.thresholds(),
            "test_metrics": self.test_metrics(),
            "industries": sorted(snap["industry"].unique().tolist()),
        }

    def _summary_row(self, r: pd.Series) -> dict:
        return {
            "customer_id": r["customer_id"], "industry": r["industry"], "company_size": r["company_size"],
            "region": r["region"], "rank": int(r["rank"]), "percentile": _clean(r["percentile"]),
            "t1_score": _clean(r["t1_score"]), "t1_alert": bool(r["t1_alert"]),
            "score_3m_avg": _clean(r["score_3m_avg"]), "t2_pred": _clean(r["t2_pred"]),
            "t3_eligible": bool(r["t3_eligible"]), "t3_score": _clean(r["t3_score"]),
            "t3_assessment": self._t3_label(r), "follow_up": r["follow_up"], "signals": list(r["signals"]),
        }

    def _t3_label(self, r) -> str:
        if not r["t3_eligible"]:
            return "Not applicable"
        return "Structural" if r["t3_structural"] else "Non-Structural"

    def thresholds(self) -> dict:
        return {
            "t1_alert": self.t1["alert_threshold"],
            "t2_decline": self.t2["decline_cutoff"],
            "t3_structural": self.t3["threshold"],
            "indicator_cutoffs": {k: _clean(v) for k, v in self.cutoffs.items()},
            "notes": {
                "t1_alert": "Score of the 200th-ranked validation record. Scores rank customers; they are not calibrated probabilities.",
                "t2_decline": "10th percentile of validation predictions.",
                "t3_structural": "Best-F1 threshold on validation. Applied only to dip months (is_dip_month == 1).",
            },
        }

    def test_metrics(self) -> dict:
        tr = self.bundle["test_results"]
        return {k: {m: _clean(v) for m, v in tr[k].items()} for k in tr}

    def traces(self, n_background: int = 90, seed: int = 7) -> dict:
        """Collections histories used by the entrance animation (real data, normalised per company)."""
        snap = self.snapshot
        priority = snap[snap["follow_up"] == "priority"]["customer_id"].tolist()
        rest = snap[snap["follow_up"] == "routine"]["customer_id"].sample(n_background, random_state=seed).tolist()
        pivot = self.data.pivot(index="customer_id", columns="as_of_month", values="collections_in_amount")
        out = []
        for cid in rest + priority:
            series = np.log1p(pivot.loc[cid].clip(lower=0))
            values = series.values
            lo, hi = np.nanmin(values), np.nanmax(values)
            norm = (values - lo) / (hi - lo) if hi > lo else np.zeros_like(values)
            out.append({"id": cid, "flagged": cid in priority,
                        "values": [None if np.isnan(v) else round(float(v), 3) for v in norm]})
        return {"months": [str(m) for m in pivot.columns], "traces": out}

    # ------------------------------------------------------------ companies
    def search(self, query: str = "", limit: int = 20) -> list[dict]:
        snap = self.snapshot
        q = query.strip().lower()
        if q:
            mask = (snap["customer_id"].str.lower().str.contains(q, regex=False)
                    | snap["industry"].str.lower().str.contains(q, regex=False)
                    | snap["region"].str.lower().str.contains(q, regex=False))
            snap = snap[mask]
        return [self._summary_row(r) for _, r in snap.head(limit).iterrows()]

    def has_customer(self, customer_id: str) -> bool:
        return customer_id in set(self.raw["customer_id"].unique())

    def company(self, customer_id: str, month: str | None = None) -> dict:
        t_start = time.perf_counter()
        rows = self.raw[self.raw["customer_id"] == customer_id]
        if rows.empty:
            raise KeyError(customer_id)
        months = rows["as_of_month"].tolist()
        month = month if month in months else months[-1]

        # Live inference using ONLY this company's history up to the selected month.
        visible = rows[rows["as_of_month"] <= month]
        frame = visible.join(build_history_features(visible))
        frame["t1_score"] = self.t1["model"].predict_proba(frame[self.t1["features"]])[:, 1]
        frame["t2_pred"] = self.t2["model"].predict(frame[self.t2["features"]])
        dip = frame["is_dip_month"] == 1
        frame["t3_score"] = np.nan
        if dip.any():
            frame.loc[dip, "t3_score"] = self.t3["model"].predict_proba(frame.loc[dip, self.t3["features"]])[:, 1]
        self._apply_health(frame)
        inference_ms = (time.perf_counter() - t_start) * 1000
        current = frame.iloc[-1]

        # Rank against all companies in the same month (pre-scored population).
        population = self.data.loc[self.data["as_of_month"] == month, "t1_score"]
        rank = int((population > current["t1_score"]).sum()) + 1
        percentile = float((population < current["t1_score"]).mean() * 100 + (population == current["t1_score"]).mean() * 50)

        indicators = self.indicators(current)
        sensitivity = self._sensitivity(frame.iloc[[-1]])
        follow = next(f for f in FOLLOW_UP if f[0] == current["follow_up"])
        label = current[T1]
        full = self.data[self.data["customer_id"] == customer_id]

        result = {
            "customer_id": customer_id,
            "profile": {
                "industry": current["industry"], "company_size": current["company_size"], "region": current["region"],
                "relationship_start_date": current["relationship_start_date"],
                "tenure_months": _clean(current["relationship_tenure_months"]),
                "annual_revenue_sar": _clean(current["annual_revenue_sar_kyc"]),
                "employees": _clean(current["employee_count_kyc"]),
                "active_products": _clean(current["active_products_count"]),
            },
            "month": month,
            "months": months,
            "month_split": self.month_split.get(month),
            "month_split_label": SPLIT_LABELS.get(self.month_split.get(month), ""),
            "is_snapshot": month == self.snapshot_month,
            "history": {
                "months": months,
                "collections": [_clean(v) for v in rows["collections_in_amount"]],
                "payments": [_clean(v) for v in rows["payments_out_amount"]],
                "balance": [_clean(v) for v in rows["avg_operating_balance"]],
                "products": [_clean(v) for v in rows["active_products_count"]],
                "payroll": [_clean(v) for v in rows["payroll_amount"]],
                "dip": [bool(v == 1) for v in rows["is_dip_month"]],
            },
            "trajectory": {
                "months": full["as_of_month"].tolist(),
                "t1_score": [_clean(v) for v in full["t1_score"]],
                "t2_pred": [_clean(v) for v in full["t2_pred"]],
                "t1_alert": [bool(v) for v in full["t1_alert"]],
                "y1_label": [_clean(v) for v in full[T1]],
                "split": full["suggested_split"].tolist(),
            },
            "reading": {
                "t1": {"score": _clean(current["t1_score"]), "alert": bool(current["t1_alert"]),
                       "threshold": self.t1["alert_threshold"], "rank": rank, "of": int(len(population)),
                       "percentile": round(percentile, 2)},
                "t2": {"prediction": _clean(current["t2_pred"]), "decline_cutoff": self.t2["decline_cutoff"],
                       "expected_decline": bool(current["t2_decline"]),
                       "typical_error": self.bundle["test_results"]["target2"]["MAE"]},
                "t3": {"eligible": bool(current["t3_eligible"]), "score": _clean(current["t3_score"]),
                       "threshold": self.t3["threshold"], "assessment": self._t3_label(current)},
            },
            "indicators": indicators,
            "sensitivity": sensitivity,
            "follow_up": {"key": follow[0], "label": follow[1], "notebook_label": follow[2], "description": follow[3]},
            "outcome": None if pd.isna(label) else {
                "deteriorated_next_3m": bool(label == 1),
                "note": "Recorded label in the synthetic dataset for this month (known only in hindsight).",
            },
            "inference": {"live": True, "milliseconds": round(inference_ms, 1), "rows_used": int(len(visible)),
                          "features": len(self.t1["features"]),
                          "data_cutoff": month,
                          "note": "Features were rebuilt from this company's history up to the selected month only."},
        }
        result["brief"] = self._brief(result)
        return result

    def _sensitivity(self, row: pd.DataFrame) -> list[dict]:
        """How the Target 1 ranking score changes if one signal group is set to a typical (training-median) value.
        This describes model behaviour, not causes."""
        base = row[self.t1["features"]].reset_index(drop=True)
        base_score = float(self.t1["model"].predict_proba(base)[:, 1][0])
        variants, names = [], []
        for name, cols in SIGNAL_GROUPS.items():
            variant = base.copy()
            for col in cols:
                variant[col] = self.train_medians[col]
            variants.append(variant)
            names.append(name)
        scores = self.t1["model"].predict_proba(pd.concat(variants, ignore_index=True))[:, 1]
        out = [{"signal": n, "features": SIGNAL_GROUPS[n], "score_if_typical": float(s),
                "delta": float(base_score - s)} for n, s in zip(names, scores)]
        return sorted(out, key=lambda d: -abs(d["delta"]))

    def _brief(self, r: dict) -> dict:
        t1, t2, t3 = r["reading"]["t1"], r["reading"]["t2"], r["reading"]["t3"]
        month_name = pd.Timestamp(r["month"] + "-01").strftime("%B %Y")
        change = f"{t2['prediction'] * 100:+.0f}".replace("-", "\u2212")
        reasons = []
        reasons.append(
            f"Deterioration ranking score {t1['score']:.3f}: #{t1['rank']:,} of {t1['of']:,} companies in {month_name} \u2014 "
            + ("above the alert threshold." if t1["alert"] else "below the alert threshold."))
        reasons.append(
            f"Expected activity change over the next 3 months: {change}% "
            f"(typical model error about \u00b1{t2['typical_error'] * 100:.0f} points).")
        if t3["eligible"]:
            reasons.append(f"This month shows an activity dip, assessed as {t3['assessment']} "
                           f"(score {t3['score']:.2f} vs threshold {t3['threshold']:.2f}).")
        else:
            reasons.append("No activity dip this month, so the structural-decline model does not apply.")
        triggered = [i for i in r["indicators"] if i["triggered"]]
        drivers = [s for s in r["sensitivity"] if s["delta"] > 0.01][:3]

        actions = {
            "priority": ["Schedule a relationship review with the client this month.",
                         "Walk through the observed signals with the client and the product specialists.",
                         "Agree a retention plan and re-check Diraya's reading next month."],
            "checkin": ["Contact the client within the month for a relationship check-in.",
                        "Ask about the observed changes in activity, products and balances.",
                        "Re-check Diraya's reading next month."],
            "review_dip": ["Review the current dip with the client to understand whether it is lasting.",
                           "Re-check Diraya's reading next month."],
            "monitor": ["No contact needed yet \u2014 keep the account on the watch list.",
                        "Re-check Diraya's reading next month."],
            "routine": ["Routine relationship management \u2014 no specific follow-up suggested."],
        }[r["follow_up"]["key"]]
        return {
            "headline": f"{r['customer_id']} \u2014 {r['follow_up']['label']}",
            "category": r["follow_up"]["label"],
            "reasons": reasons,
            "signals": [i["label"] for i in triggered],
            "drivers": [d["signal"] for d in drivers],
            "actions": actions,
            "caveats": [
                "Model output on synthetic data. Scores rank companies; they are not calibrated probabilities.",
                "Predictions are not confirmed future outcomes. Suggested follow-ups are triage prompts, not verified banking decisions.",
            ],
        }

    # --------------------------------------------------------------- scoring API
    def score_records(self, records: list[dict]) -> dict:
        """Score the LATEST month of one customer's monthly history supplied by a client."""
        frame = pd.DataFrame.from_records(records)
        required = set(self.raw.columns) - {T1, T2, T3, "suggested_split", "target_eligible", "month_index"}
        missing = sorted(required - set(frame.columns))
        if missing:
            raise ValueError(f"Missing columns: {missing}")
        if frame["customer_id"].nunique() != 1:
            raise ValueError("Send the monthly history of exactly one customer.")
        frame = frame.sort_values("as_of_month").reset_index(drop=True)
        for col in self.raw.columns:
            if col in frame and pd.api.types.is_numeric_dtype(self.raw[col]):
                frame[col] = pd.to_numeric(frame[col], errors="coerce")
        start = time.perf_counter()
        frame = frame.join(build_history_features(frame))
        last = frame.iloc[[-1]]
        t1_score = float(self.t1["model"].predict_proba(last[self.t1["features"]])[:, 1][0])
        t2_pred = float(self.t2["model"].predict(last[self.t2["features"]])[0])
        eligible = bool(last["is_dip_month"].iloc[0] == 1)
        t3_score = float(self.t3["model"].predict_proba(last[self.t3["features"]])[:, 1][0]) if eligible else None
        structural = eligible and t3_score >= self.t3["threshold"]
        alert = t1_score >= self.t1["alert_threshold"]
        decline = t2_pred <= self.t2["decline_cutoff"]
        follow = ("priority" if alert and structural else "checkin" if alert
                  else "review_dip" if structural else "monitor" if decline else "routine")
        return {
            "customer_id": str(last["customer_id"].iloc[0]), "as_of_month": str(last["as_of_month"].iloc[0]),
            "months_supplied": int(len(frame)),
            "deterioration": {"score": t1_score, "alert": bool(alert), "threshold": self.t1["alert_threshold"]},
            "activity_change": {"prediction": t2_pred, "expected_decline": bool(decline)},
            "structural_decline": ({"eligible": True, "score": t3_score,
                                    "assessment": "Structural" if structural else "Non-Structural"}
                                   if eligible else {"eligible": False, "score": None, "assessment": "Not applicable"}),
            "follow_up": follow,
            "milliseconds": round((time.perf_counter() - start) * 1000, 1),
        }

    def status(self) -> dict:
        return {
            "live": True,
            "product": "Diraya",
            "bundle": self.bundle_source,
            "scikit_learn": sklearn.__version__,
            "feature_code_matches_notebook": self.feature_code_matches,
            "startup_seconds": self.startup_seconds,
            "dataset": {"rows": int(len(self.raw)), "customers": int(self.raw["customer_id"].nunique()),
                        "first_month": self.months[0], "last_month": self.months[-1], "synthetic": True},
            "models": {
                "target1": {"task": "Deterioration within 3 months (classification)",
                            "algorithm": type(self.t1["model"].named_steps["model"]).__name__,
                            "features": len(self.t1["features"]), "eligibility": self.t1["eligibility"]},
                "target2": {"task": "Activity change over 3 months (regression)",
                            "algorithm": type(self.t2["model"].named_steps["model"]).__name__,
                            "features": len(self.t2["features"]), "eligibility": self.t2["eligibility"]},
                "target3": {"task": "Structural vs non-structural dip (classification)",
                            "algorithm": type(self.t3["model"].named_steps["model"]).__name__,
                            "features": len(self.t3["features"]), "eligibility": self.t3["eligibility"]},
            },
            "snapshot_month": self.snapshot_month,
        }


def _function_source() -> str:
    import inspect
    return inspect.getsource(shared_features.build_history_features)
