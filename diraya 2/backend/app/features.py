"""Shared feature engineering for Diraya.

`build_history_features` is copied verbatim from the approved notebook
(notebooks/Dirayah.ipynb, Section 05). The model bundle stores the same
source code; `engine.py` checks at start-up that both are identical, so the API
always generates features exactly the way the models were trained.

Rule: features use ONLY the current and previous months of each customer.
"""
import numpy as np
import pandas as pd


def build_history_features(data):
    """Per-customer history features using only the current and previous months.
    Assumes one row per customer-month with consecutive months (checked in Section 02)."""
    d = data.sort_values(["customer_id", "as_of_month"])
    customer = d["customer_id"]
    t = d.groupby("customer_id").cumcount().astype(float)     # month counter within each customer

    def lag(series, k):                                        # value k months earlier
        return series.groupby(customer).shift(k)

    def rolling(series, window, stat):                         # rolling stat over the last `window` months
        result = getattr(series.groupby(customer).rolling(window, min_periods=window), stat)()
        return result.reset_index(level=0, drop=True).reindex(d.index)

    def trend(series, window=6):                               # slope of a straight line over the window
        mean_t, mean_y = rolling(t, window, "mean"), rolling(series, window, "mean")
        covariance = rolling(t * series, window, "mean") - mean_t * mean_y
        variance = rolling(t * t, window, "mean") - mean_t ** 2
        return covariance / variance

    def relative_change(current, reference):
        return current / reference.where(reference != 0) - 1

    def streak(flag):                                          # consecutive months where flag is True
        flag = flag.astype(int)
        block = (flag == 0).groupby(customer).cumsum()
        return flag.groupby([customer, block]).cumsum()

    coll = d["collections_in_amount"]
    pay = d["payments_out_amount"]
    bal = d["avg_operating_balance"]
    txn = d["collections_in_count"] + d["payments_out_count"]
    products = d["active_products_count"].astype(float)

    f = pd.DataFrame(index=d.index)
    f["hist_coll_trend_6m"] = trend(np.log1p(coll.clip(lower=0)))
    f["hist_pay_trend_6m"] = trend(np.log1p(pay.clip(lower=0)))
    f["hist_txn_trend_6m"] = trend(np.log1p(txn.clip(lower=0)))
    f["hist_bal_trend_6m"] = trend(np.arcsinh(bal / 1000))
    f["hist_coll_chg_1m"] = relative_change(coll, lag(coll, 1))
    f["hist_txn_chg_1m"] = relative_change(txn, lag(txn, 1))
    f["hist_coll_vs_12m_avg"] = relative_change(coll, rolling(coll, 12, "mean"))
    coll_3m = rolling(coll, 3, "mean")
    f["hist_coll_drawdown_12m"] = relative_change(coll_3m, rolling(coll_3m, 10, "max"))
    f["hist_bal_decline_streak"] = streak(bal < lag(bal, 1)).where(t > 0)
    f["hist_coll_decline_streak"] = streak(coll < lag(coll, 1)).where(t > 0)
    bal_mean_6m = rolling(bal, 6, "mean").abs()
    f["hist_bal_cv_6m"] = rolling(bal, 6, "std") / bal_mean_6m.where(bal_mean_6m > 0)
    f["hist_products_std_6m"] = rolling(products, 6, "std")
    f["hist_products_drop_from_max_6m"] = products - rolling(products, 6, "max")
    logins_3m = rolling(d["digital_logins_count"], 3, "mean")
    f["hist_logins_chg_3m"] = relative_change(logins_3m, lag(logins_3m, 3))
    f["hist_payroll_vs_6m_avg"] = relative_change(d["payroll_amount"], rolling(d["payroll_amount"], 6, "mean"))
    f["hist_complaints_6m"] = rolling(d["complaints_count"].astype(float), 6, "sum")
    f["hist_util_chg_3m"] = d["credit_utilization_pct"] - lag(d["credit_utilization_pct"], 3)

    return f.replace([np.inf, -np.inf], np.nan).reindex(data.index)
