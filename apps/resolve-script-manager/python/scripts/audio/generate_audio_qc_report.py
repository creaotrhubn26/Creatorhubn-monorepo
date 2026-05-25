"""Generate Audio QC Report — stitches results from detect_audio_sources / analyze_loudness /
flag_clipping / flag_low_dialogue into a single Markdown + JSON report.

Can take pre-computed results via --params, or run each sub-script live.
"""

from __future__ import annotations

import json
import os
import sys
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


def run(params: dict, dry_run: bool) -> None:
    output_folder = params.get("outputFolder") or os.path.expanduser("~/Documents/Audio QC")
    delivery = params.get("deliveryTarget", "wedding")

    # These can be passed in pre-computed (UI runs the analyses first, then composes the report)
    sources = params.get("sourcesResult")
    loudness = params.get("loudnessResult")
    clipping = params.get("clippingResult")
    low_dialogue = params.get("lowDialogueResult")

    if dry_run:
        bridge.result({
            "summary": f"Dry run — would build Audio QC Report for delivery target '{delivery}'",
            "outputFolder": output_folder,
            "willInclude": [
                "Source distribution (lav mics, recorder dumps, music, sfx, unknown)",
                "Integrated LUFS distribution + average",
                "Clipping flags (clips ≥ -0.1 dBFS)",
                "Low-dialogue flags (clips < -28 LUFS)",
                "Delivery target deviation (wedding/youtube/podcast/broadcast)",
                "Suggested follow-ups",
            ],
        })
        return

    os.makedirs(output_folder, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    report = {
        "generatedAt": datetime.now().isoformat(),
        "deliveryTarget": delivery,
        "sources": sources,
        "loudness": loudness,
        "clipping": clipping,
        "lowDialogue": low_dialogue,
    }

    json_path = os.path.join(output_folder, f"audio_qc_{timestamp}.json")
    md_path = os.path.join(output_folder, f"audio_qc_{timestamp}.md")

    with open(json_path, "w", encoding="utf-8") as fh:
        json.dump(report, fh, indent=2)

    lines = [
        f"# Audio QC Report",
        f"_Generated: {report['generatedAt']}_  ",
        f"_Delivery target: **{delivery}**_",
        "",
    ]
    if sources:
        lines.extend(["## Source Distribution", ""])
        for label, count in (sources.get("summary") or {}).items():
            lines.append(f"- **{label}**: {count}")
        warnings = sources.get("warnings", [])
        for w in warnings:
            lines.append(f"- ⚠ {w}")
        lines.append("")
    if loudness:
        lines.extend([
            "## Loudness",
            f"- Average integrated: **{loudness.get('averageLufs')} LUFS**",
            f"- Max true peak: **{loudness.get('maxTruePeak')} dBTP**",
            f"- Clips below target: {len(loudness.get('clipsBelowTarget') or [])}",
            f"- Clips above true-peak ceiling: {len(loudness.get('clipsAboveTruePeak') or [])}",
            "",
        ])
    if clipping:
        lines.extend([
            "## Clipping Flags",
            f"- Scanned: {clipping.get('clipsScanned', 0)}",
            f"- Flagged (≥ {clipping.get('threshold')} dBFS): **{clipping.get('clippedCount', 0)}**",
            "",
        ])
        for f in (clipping.get("flagged") or [])[:10]:
            lines.append(f"  - {f['name']} — peak {f['peakDb']:.1f} dBFS")
        lines.append("")
    if low_dialogue:
        lines.extend([
            "## Low-Dialogue Flags",
            f"- Scanned: {low_dialogue.get('clipsScanned', 0)}",
            f"- Below {low_dialogue.get('threshold')} LUFS: **{low_dialogue.get('lowDialogueCount', 0)}**",
            "",
        ])
        for f in (low_dialogue.get("flagged") or [])[:10]:
            lines.append(f"  - {f['name']} — {f['lufs']:.1f} LUFS")
        lines.append("")

    lines.extend([
        "## Suggested Follow-Ups",
        "- Run `generate_music_ducking_plan` to attenuate music under dialogue",
        "- Export problem clips with `export_dialogue_stems` for external AI cleanup",
        "- Re-render at the delivery LUFS target with Resolve's `loudnorm` audio target",
    ])

    with open(md_path, "w", encoding="utf-8") as fh:
        fh.write("\n".join(lines))

    bridge.result({
        "jsonPath": json_path,
        "markdownPath": md_path,
        "deliveryTarget": delivery,
    })


if __name__ == "__main__":
    bridge.main_guard(run)
