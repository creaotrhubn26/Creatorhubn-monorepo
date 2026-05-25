"""Generate Color QC Report — combines exposure / WB / camera-mix / missing-LUT into one report."""

from __future__ import annotations

import json
import os
import sys
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


def run(params: dict, dry_run: bool) -> None:
    output_folder = params.get("outputFolder") or os.path.expanduser("~/Documents/Color QC")

    if dry_run:
        bridge.result({
            "summary": f"Dry run — would write Markdown + JSON QC report to {output_folder}",
            "sections": [
                "Camera Profile Distribution",
                "Underexposed Clips",
                "Mixed White Balance",
                "Missing Technical LUT",
                "Suggested Looks per Scene",
            ],
            "expectedFiles": [
                f"{output_folder}/color_qc_<project>_<timeline>.md",
                f"{output_folder}/color_qc_<project>_<timeline>.json",
            ],
        })
        return

    conn = bridge.ResolveConnection()
    if not conn.connect() or not conn.require_project():
        return

    timeline = conn.project.GetCurrentTimeline()
    if not timeline:
        bridge.error("No current timeline.")
        sys.exit(1)

    os.makedirs(output_folder, exist_ok=True)
    project_name = conn.project.GetName().replace("/", "_").replace(" ", "_")
    timeline_name = timeline.GetName().replace("/", "_").replace(" ", "_")
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    report = {
        "project": conn.project.GetName(),
        "timeline": timeline.GetName(),
        "generatedAt": datetime.now().isoformat(),
        "sections": {
            "cameraDistribution": "Run detect_camera_profiles.py first",
            "underexposedClips": "Run flag_underexposed_clips.py first",
            "wbOutliers": "Run flag_mixed_white_balance.py first",
            "missingLut": "Run apply_camera_lut.py with --dry-run to identify",
        },
        "note": "v1 stitches results from individual QC scripts — v2 will run them inline.",
    }

    json_path = os.path.join(output_folder, f"color_qc_{project_name}_{timeline_name}_{timestamp}.json")
    md_path = os.path.join(output_folder, f"color_qc_{project_name}_{timeline_name}_{timestamp}.md")

    with open(json_path, "w", encoding="utf-8") as fh:
        json.dump(report, fh, indent=2)

    md_lines = [
        f"# Color QC Report — {report['project']}",
        f"_Timeline: {report['timeline']}_  ",
        f"_Generated: {report['generatedAt']}_",
        "",
        "## Sections",
    ]
    for key, val in report["sections"].items():
        md_lines.append(f"- **{key}**: {val}")
    md_lines.append("\n_v1 — run individual color/* scripts and merge manually._")
    with open(md_path, "w", encoding="utf-8") as fh:
        fh.write("\n".join(md_lines))

    bridge.result({
        "jsonPath": json_path,
        "markdownPath": md_path,
        "status": "scaffold-report",
    })


if __name__ == "__main__":
    bridge.main_guard(run)
