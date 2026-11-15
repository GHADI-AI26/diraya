"""(Re)build the model bundle from the dataset, exactly as the competition notebook does.

    python -m scripts.build_models            # rebuild only if the saved bundle does not match this scikit-learn
    python -m scripts.build_models --force    # always rebuild

Writes models/sila_final_models.local.pkl (the original notebook bundle is never overwritten).
The server prefers the .local bundle when it exists and matches the installed scikit-learn version.
"""
from __future__ import annotations

import argparse
import sys
import time
import warnings
from pathlib import Path

import joblib
import pandas as pd
import sklearn

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.main import DATA_PATH, MODELS_DIR  # noqa: E402
from app.training import build_bundle  # noqa: E402


def bundle_ok(path: Path) -> bool:
    if not path.exists():
        return False
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            return joblib.load(path).get("scikit_learn_version") == sklearn.__version__
    except Exception:
        return False


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--if-needed", action="store_true", help="(default) rebuild only when necessary")
    args = parser.parse_args()
    primary, local = MODELS_DIR / "sila_final_models.pkl", MODELS_DIR / "sila_final_models.local.pkl"
    if not args.force and (bundle_ok(local) or bundle_ok(primary)):
        print(f"Model bundle already matches scikit-learn {sklearn.__version__} - nothing to do.")
        return
    start = time.time()
    bundle = build_bundle(pd.read_csv(DATA_PATH))
    joblib.dump(bundle, local)
    t = bundle["test_results"]
    print(f"Rebuilt in {time.time() - start:.0f}s -> {local}")
    print(f"Test: T1 PR-AUC {t['target1']['PR-AUC']:.4f} | T2 MAE {t['target2']['MAE']:.4f} | T3 PR-AUC {t['target3']['PR-AUC']:.4f}")


if __name__ == "__main__":
    main()
