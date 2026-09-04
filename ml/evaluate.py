"""Evaluate de-identified extraction predictions without third-party packages."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

FLAGS = {"normal", "high", "low", "unknown"}


def load_jsonl(path: Path) -> list[dict]:
    rows = []
    with path.open(encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, 1):
            if line.strip():
                rows.append({"line": line_number, **json.loads(line)})
    return rows


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--predictions", type=Path, required=True)
    args = parser.parse_args()
    rows = load_jsonl(args.predictions)
    valid = 0
    true_positive = false_positive = false_negative = 0

    for row in rows:
        try:
            expected = json.loads(row["expected"])
            predicted = json.loads(row["predicted"])
            if not isinstance(predicted, list):
                continue
            valid += 1
        except (KeyError, TypeError, json.JSONDecodeError):
            continue

        expected_flags = {(str(item.get("test", "")).casefold(), item.get("flag")) for item in expected if item.get("flag") in FLAGS}
        predicted_flags = {(str(item.get("test", "")).casefold(), item.get("flag")) for item in predicted if item.get("flag") in FLAGS}
        true_positive += len(expected_flags & predicted_flags)
        false_positive += len(predicted_flags - expected_flags)
        false_negative += len(expected_flags - predicted_flags)

    precision = true_positive / (true_positive + false_positive) if true_positive + false_positive else 0.0
    recall = true_positive / (true_positive + false_negative) if true_positive + false_negative else 0.0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
    result = {
        "rows": len(rows),
        "json_validity": valid / len(rows) if rows else 0.0,
        "flag_precision": precision,
        "flag_recall": recall,
        "flag_f1": f1,
    }
    print(json.dumps(result, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
