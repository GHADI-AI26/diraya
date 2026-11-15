"""Rebuild the final model bundle exactly as the competition notebook does.

Mirrors the approved notebook notebooks/Dirayah.ipynb, Sections 04-07:
same feature lists, same chronological split and same model settings. The
alert / decline thresholds use the app's validation-based rules (200th-ranked
validation score; 10th percentile of validation predictions). It is used when `models/sila_final_models.pkl`
is missing or was saved with a different scikit-learn version.
"""
from __future__ import annotations

import inspect

import numpy as np
import pandas as pd
import sklearn
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import HistGradientBoostingClassifier, HistGradientBoostingRegressor
from sklearn.metrics import (average_precision_score, f1_score, mean_absolute_error,
                             mean_squared_error, precision_recall_curve, precision_score,
                             r2_score, recall_score)
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

from .features import build_history_features

RANDOM_STATE = 42

FEATURES_V1 = [
    "collections_in_amount", "payments_out_amount", "avg_operating_balance",
    "active_products_count", "coll_chg_3m_vs_prev3m", "pay_chg_3m_vs_prev3m",
    "bal_chg_3m_vs_prev3m", "relationship_tenure_months", "digital_logins_count",
    "calendar_month"]
FEATURES_V2 = FEATURES_V1 + [
    "coll_yoy_chg", "pay_yoy_chg", "bal_yoy_chg", "txn_count_chg_3m_vs_prev3m",
    "coll_cv_6m", "products_chg_6m", "own_transfer_ratio_3m", "payroll_stopped_flag",
    "months_observed", "ramadan_days", "eid_holiday_days", "hajj_days"]
BASE_NUMERIC = FEATURES_V2 + [
    "collections_in_count", "payments_out_count", "month_end_balance", "payroll_amount",
    "pos_acquiring_amount", "trade_finance_amount", "tax_zakat_payments_amount",
    "own_account_transfers_out_amount", "credit_limit_amount", "credit_utilization_pct",
    "corporate_card_txn_count", "complaints_count", "has_payroll_service",
    "has_credit_facility", "has_trade_finance", "has_pos_acquiring", "has_corporate_cards",
    "has_term_deposit", "annual_revenue_sar_kyc", "employee_count_kyc", "pre_ramadan_days"]
CATEGORICAL = ["industry", "company_size", "region"]

T1, T2, T3 = "y1_deterioration_next3m", "y2_activity_change_next3m", "y3_dip_is_structural"


def _boosting_preprocessor(numeric):
    return ColumnTransformer([
        ("num", "passthrough", numeric),
        ("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=False), CATEGORICAL)])


def _best_f1_threshold(y_true, scores):
    precision, recall, thresholds = precision_recall_curve(y_true, scores)
    f1 = 2 * precision * recall / np.clip(precision + recall, 1e-12, None)
    return thresholds[np.nanargmax(f1[:-1])]


def _monthly_top50_precision(months, y, scores):
    frame = pd.DataFrame({"month": months, "y": y, "score": scores})
    frame["rank"] = frame.groupby("month")["score"].rank(ascending=False, method="first")
    return float(frame[frame["rank"] <= 50].groupby("month")["y"].mean().mean())


def _split(frame, target):
    labelled = frame.dropna(subset=[target])
    return [labelled[labelled["suggested_split"] == s] for s in ("train", "valid", "test")]


def build_bundle(df: pd.DataFrame) -> dict:
    history = build_history_features(df)
    hist_features = list(history.columns)
    data = df.join(history)
    final_numeric = BASE_NUMERIC + hist_features
    final_features = final_numeric + CATEGORICAL

    # Target 1 - deterioration
    t1_train, t1_valid, t1_test = _split(data, T1)
    t1_model = Pipeline([
        ("prep", _boosting_preprocessor(final_numeric)),
        ("model", HistGradientBoostingClassifier(max_iter=200, learning_rate=0.05, max_leaf_nodes=15,
                                                 l2_regularization=1.0, random_state=RANDOM_STATE))])
    t1_model.fit(t1_train[final_features], t1_train[T1].astype(int))
    t1_valid_scores = t1_model.predict_proba(t1_valid[final_features])[:, 1]
    t1_alert_threshold = np.sort(t1_valid_scores)[::-1][199]
    t1_test_scores = t1_model.predict_proba(t1_test[final_features])[:, 1]
    y1_test = t1_test[T1].astype(int).values
    top200 = np.argsort(-t1_test_scores, kind="stable")[:200]

    # Target 2 - activity change
    t2_train, t2_valid, t2_test = _split(data, T2)
    t2_model = Pipeline([
        ("prep", _boosting_preprocessor(final_numeric)),
        ("model", HistGradientBoostingRegressor(
            loss="absolute_error", learning_rate=0.03, max_iter=300, max_leaf_nodes=31,
            min_samples_leaf=20, l2_regularization=5.0, max_features=0.8,
            early_stopping=False, random_state=RANDOM_STATE))])
    t2_model.fit(t2_train[final_features], t2_train[T2])
    t2_decline_cutoff = np.percentile(t2_model.predict(t2_valid[final_features]), 10)
    t2_test_pred = t2_model.predict(t2_test[final_features])

    # Target 3 - structural decline (labelled dip months only)
    t3_train, t3_valid, t3_test = _split(data, T3)
    t3_model = Pipeline([
        ("prep", _boosting_preprocessor(final_numeric)),
        ("model", HistGradientBoostingClassifier(
            max_iter=200, learning_rate=0.05, max_leaf_nodes=15, min_samples_leaf=20,
            l2_regularization=1.0, class_weight="balanced", random_state=RANDOM_STATE))])
    t3_model.fit(t3_train[final_features], t3_train[T3].astype(int))
    t3_threshold = _best_f1_threshold(t3_valid[T3].astype(int), t3_model.predict_proba(t3_valid[final_features])[:, 1])
    t3_test_scores = t3_model.predict_proba(t3_test[final_features])[:, 1]
    y3_test = t3_test[T3].astype(int)
    t3_pred = (t3_test_scores >= t3_threshold).astype(int)

    return {
        "target1_deterioration": {"model": t1_model, "features": final_features,
                                  "alert_threshold": float(t1_alert_threshold), "eligibility": "all customers"},
        "target2_activity_change": {"model": t2_model, "features": final_features,
                                    "decline_cutoff": float(t2_decline_cutoff), "eligibility": "all customers"},
        "target3_structural": {"model": t3_model, "features": final_features,
                               "threshold": float(t3_threshold), "eligibility": "is_dip_month == 1"},
        "history_feature_code": inspect.getsource(build_history_features),
        "test_results": {
            "target1": {"PR-AUC": average_precision_score(y1_test, t1_test_scores),
                        "Random-guess PR-AUC": float(y1_test.mean()),
                        "Precision@200": y1_test[top200].mean(),
                        "Recall@200": y1_test[top200].sum() / y1_test.sum(),
                        "Correct alerts in Top-200 (records)": float(y1_test[top200].sum()),
                        "Distinct companies in Top-200": float(len(set(t1_test["customer_id"].values[top200]))),
                        "Deteriorations in test (records)": float(y1_test.sum()),
                        "Monthly top-50 list: average precision": _monthly_top50_precision(
                            t1_test["as_of_month"].values, y1_test, t1_test_scores)},
            "target2": {"MAE": mean_absolute_error(t2_test[T2], t2_test_pred),
                        "RMSE": float(np.sqrt(mean_squared_error(t2_test[T2], t2_test_pred))),
                        "R2": r2_score(t2_test[T2], t2_test_pred)},
            "target3": {"PR-AUC": average_precision_score(y3_test, t3_test_scores),
                        "Random-guess PR-AUC": float(y3_test.mean()),
                        "Threshold (from validation)": float(t3_threshold),
                        "Precision": precision_score(y3_test, t3_pred),
                        "Recall": recall_score(y3_test, t3_pred),
                        "F1": f1_score(y3_test, t3_pred)}},
        "scikit_learn_version": sklearn.__version__,
        "rebuilt_by": "lamha backend/app/training.py",
    }
