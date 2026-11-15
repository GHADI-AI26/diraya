"""Diraya backend tests: notebook consistency, eligibility rules and leakage safety.

Run from backend/:   python -m pytest -q
Slow bundle-rebuild check:   LAMHA_SLOW=1 python -m pytest -q
"""
import os

import numpy as np
import pandas as pd
import pytest

from app.engine import Engine
from app.features import build_history_features
from app.main import DATA_PATH, MODELS_DIR


@pytest.fixture(scope="session")
def engine():
    return Engine(DATA_PATH, MODELS_DIR)


def test_feature_code_matches_notebook(engine):
    assert engine.feature_code_matches, "backend/app/features.py differs from the notebook bundle source"


def test_snapshot_matches_notebook_section_09(engine):
    # Operational demo figures for the 2025-12 snapshot, produced by the approved models
    # (not printed in Dirayah.ipynb; locked here so the demo cannot drift)
    p = engine.portfolio
    assert p["snapshot_month"] == "2025-12"
    assert p["kpis"]["customers"] == 2960
    assert p["kpis"]["alerts"] == 139
    assert p["kpis"]["t3_eligible"] == 213
    counts = {d["key"]: d["count"] for d in p["distribution"]}
    assert counts == {"priority": 49, "checkin": 90, "review_dip": 0, "monitor": 283, "routine": 2538}


def test_thresholds_come_from_bundle(engine):
    t = engine.thresholds()
    assert t["t1_alert"] == pytest.approx(0.0753139, abs=1e-6)
    assert t["t2_decline"] == pytest.approx(-0.0345824, abs=1e-6)
    assert t["t3_structural"] == pytest.approx(0.5605647, abs=1e-6)


def test_test_metrics_match_notebook(engine):
    m = engine.test_metrics()
    # Saved test outputs of the approved notebook, notebooks/Dirayah.ipynb (Section 07)
    t1, t2, t3 = m["target1"], m["target2"], m["target3"]
    assert t1["PR-AUC"] == pytest.approx(0.3725, abs=5e-5)
    assert t1["Precision@200"] == pytest.approx(0.495)
    assert t1["Recall@200"] == pytest.approx(0.3882, abs=5e-5)
    assert t1["Correct alerts in Top-200 (records)"] == 99
    assert t1["Distinct companies in Top-200"] == 123
    assert t1["Deteriorations in test (records)"] == 255
    assert t1["Monthly top-50 list: average precision"] == pytest.approx(0.452)
    assert t1["Random-guess PR-AUC"] == pytest.approx(0.0180, abs=5e-5)
    assert t2["MAE"] == pytest.approx(0.1224, abs=5e-5)
    assert t2["RMSE"] == pytest.approx(0.1878, abs=5e-5)
    assert t2["R2"] == pytest.approx(0.2273, abs=5e-5)
    assert t3["PR-AUC"] == pytest.approx(0.6127, abs=5e-5)
    assert t3["Precision"] == pytest.approx(0.6395, abs=5e-5)
    assert t3["Recall"] == pytest.approx(0.5612, abs=5e-5)
    assert t3["F1"] == pytest.approx(0.5978, abs=5e-5)


def test_target3_only_for_dip_months(engine):
    rows = engine.data
    non_dip = rows[rows["is_dip_month"] == 0].iloc[0]
    reading = engine.company(non_dip["customer_id"], non_dip["as_of_month"])["reading"]["t3"]
    assert reading == {**reading, "eligible": False, "score": None, "assessment": "Not applicable"}
    assert rows.loc[rows["is_dip_month"] == 0, "t3_score"].isna().all()
    dip = rows[rows["is_dip_month"] == 1].iloc[0]
    reading = engine.company(dip["customer_id"], dip["as_of_month"])["reading"]["t3"]
    assert reading["eligible"] and reading["assessment"] in ("Structural", "Non-Structural")


def test_live_inference_uses_only_past_data(engine):
    # Scoring a company with history truncated at a month must equal the full-history score for that month.
    for cid, month in [("PC00514", "2025-06"), ("PC01857", "2025-05"), ("PC01474", "2025-12")]:
        live = engine.company(cid, month)
        full = engine.data[(engine.data["customer_id"] == cid) & (engine.data["as_of_month"] == month)].iloc[0]
        assert live["inference"]["data_cutoff"] == month
        assert live["reading"]["t1"]["score"] == pytest.approx(full["t1_score"], abs=1e-12)
        assert live["reading"]["t2"]["prediction"] == pytest.approx(full["t2_pred"], abs=1e-12)


def test_history_features_are_past_only():
    df = pd.read_csv(DATA_PATH)
    full = build_history_features(df)
    cut = build_history_features(df[df["as_of_month"] <= "2024-06"])
    assert np.allclose(full.loc[cut.index].values, cut.values, equal_nan=True)


def test_score_records_matches_company_reading(engine):
    raw = engine.raw[engine.raw["customer_id"] == "PC00514"]
    records = raw.replace({np.nan: None}).to_dict(orient="records")
    result = engine.score_records(records)
    reading = engine.company("PC00514")["reading"]
    assert result["deterioration"]["score"] == pytest.approx(reading["t1"]["score"], abs=1e-12)
    assert result["activity_change"]["prediction"] == pytest.approx(reading["t2"]["prediction"], abs=1e-12)
    assert result["structural_decline"]["assessment"] == reading["t3"]["assessment"]


def test_score_records_rejects_bad_input(engine):
    with pytest.raises(ValueError):
        engine.score_records([{"customer_id": "X"}])


@pytest.mark.skipif("1" not in (os.getenv("LAMHA_SLOW"), os.getenv("ATHAR_SLOW")), reason="set LAMHA_SLOW=1 to rebuild the bundle (~40 s)")
def test_rebuilt_bundle_reproduces_notebook_models(engine):
    from app.training import build_bundle
    rebuilt = build_bundle(engine.raw)
    sample = engine.data.sample(3000, random_state=0)
    for key, method in [("target1_deterioration", "predict_proba"), ("target2_activity_change", "predict"),
                        ("target3_structural", "predict_proba")]:
        a = getattr(engine.bundle[key]["model"], method)(sample[engine.bundle[key]["features"]])
        b = getattr(rebuilt[key]["model"], method)(sample[rebuilt[key]["features"]])
        assert np.allclose(a, b)
    assert rebuilt["target1_deterioration"]["alert_threshold"] == pytest.approx(engine.t1["alert_threshold"])
    assert rebuilt["target3_structural"]["threshold"] == pytest.approx(engine.t3["threshold"])
