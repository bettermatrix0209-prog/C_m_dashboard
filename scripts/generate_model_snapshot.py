from __future__ import annotations

import argparse
import json
import os
from pathlib import Path

import pandas as pd


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate dashboard model snapshot from inventory_metrics sheet."
    )
    parser.add_argument(
        "--input",
        default=os.getenv(
            "MODEL_DATA_XLSX",
            "/Users/leesiwon/Desktop/Final Project/coverage_inventory_model_results_latest.xlsx",
        ),
        help="Path to coverage_inventory_model_results_latest.xlsx",
    )
    parser.add_argument(
        "--output",
        default="src/data/modelSnapshot.ts",
        help="Output TypeScript file path.",
    )
    parser.add_argument(
        "--service-level",
        type=float,
        default=0.98,
        help="Service level to prioritize when selecting monthly records.",
    )
    return parser.parse_args()


def build_snapshot(xlsx_path: Path, service_level: float) -> dict[str, object]:
    inventory = pd.read_excel(xlsx_path, sheet_name="inventory_metrics")
    inventory["date"] = pd.to_datetime(inventory["date"], errors="coerce")
    inventory = inventory.dropna(subset=["date"])

    snapshot: dict[str, object] = {
        "source_file": xlsx_path.name,
        "service_level_default": service_level,
        "generated_at": pd.Timestamp.now().isoformat(),
        "by_hs": {},
    }

    by_hs: dict[str, dict[str, float | str]] = {}
    for hs_code, group in inventory.groupby("hs_code"):
        selected = group.copy()
        selected["sl_diff"] = (selected["service_level"] - service_level).abs()
        per_month = (
            selected.sort_values(["date", "sl_diff"])
            .groupby("date", as_index=False)
            .first()
            .sort_values("date")
        )

        latest = per_month.iloc[-1]
        by_hs[str(int(hs_code))] = {
            "latest_date": latest["date"].strftime("%Y-%m"),
            "mu_D": float(latest["mu_D"]),
            "sigma_D": float(latest["sigma_D"]),
            "mu_L": float(latest["mu_L"]),
            "sigma_L": float(latest["sigma_L"]),
            "service_level": float(latest["service_level"]),
        }

    snapshot["by_hs"] = by_hs
    return snapshot


def write_typescript(snapshot: dict[str, object], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    ts_content = "export const MODEL_SNAPSHOT = " + json.dumps(snapshot, indent=2) + " as const;\n"
    output_path.write_text(ts_content, encoding="utf-8")


def main() -> None:
    args = parse_args()
    source = Path(args.input).expanduser().resolve()
    output = Path(args.output)

    if not source.exists():
        raise FileNotFoundError(f"Input file not found: {source}")

    snapshot = build_snapshot(source, service_level=args.service_level)
    write_typescript(snapshot, output)

    print(f"Generated {output} from {source}")


if __name__ == "__main__":
    main()
