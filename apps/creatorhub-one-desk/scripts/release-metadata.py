#!/usr/bin/env python3
"""Validate and render CreatorHub One Desk release metadata."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

APP_DIR = Path(__file__).resolve().parent.parent
NOTES_PATH = APP_DIR / "release-notes.json"
ALLOWED_KINDS = {"new", "improved", "fixed", "security"}


def load_release(version: str) -> dict[str, Any]:
    data = json.loads(NOTES_PATH.read_text(encoding="utf-8"))
    releases = data.get("releases")
    if not isinstance(releases, list):
        raise ValueError("release-notes.json må inneholde en releases-liste")

    matches = [release for release in releases if release.get("version") == version]
    if len(matches) != 1:
        raise ValueError(f"Forventet nøyaktig én release for versjon {version}, fant {len(matches)}")
    release = matches[0]

    for field in ("publishedAt", "title", "summary"):
        if not isinstance(release.get(field), str) or not release[field].strip():
            raise ValueError(f"Release {version} mangler gyldig {field}")
    if not isinstance(release.get("critical"), bool):
        raise ValueError(f"Release {version} mangler boolean-feltet critical")
    sections = release.get("sections")
    if not isinstance(sections, list) or not sections:
        raise ValueError(f"Release {version} må ha minst én seksjon")
    for section in sections:
        if section.get("kind") not in ALLOWED_KINDS:
            raise ValueError(f"Ukjent release-type: {section.get('kind')}")
        if not isinstance(section.get("title"), str) or not section["title"].strip():
            raise ValueError("Alle release-seksjoner må ha tittel")
        if not isinstance(section.get("items"), list) or not section["items"]:
            raise ValueError(f"Seksjonen {section['title']} må ha minst ett punkt")
        if not all(isinstance(item, str) and item.strip() for item in section["items"]):
            raise ValueError(f"Seksjonen {section['title']} har et ugyldig punkt")
    return release


def render_markdown(release: dict[str, Any]) -> str:
    lines = [f"# {release['title']}", "", release["summary"], ""]
    if release["critical"]:
        lines.extend(["> Dette er en kritisk oppdatering.", ""])
    for section in release["sections"]:
        lines.extend([f"## {section['title']}", ""])
        lines.extend(f"- {item}" for item in section["items"])
        lines.append("")
    return "\n".join(lines).rstrip() + "\n"


def main() -> None:
    parser = argparse.ArgumentParser()
    subparsers = parser.add_subparsers(dest="command", required=True)

    validate = subparsers.add_parser("validate")
    validate.add_argument("--version", required=True)

    markdown = subparsers.add_parser("markdown")
    markdown.add_argument("--version", required=True)
    markdown.add_argument("--output", required=True, type=Path)

    manifest = subparsers.add_parser("manifest")
    manifest.add_argument("--version", required=True)
    manifest.add_argument("--signature-file", required=True, type=Path)
    manifest.add_argument("--url", required=True)
    manifest.add_argument("--platform", required=True)
    manifest.add_argument("--output", required=True, type=Path)

    args = parser.parse_args()
    release = load_release(args.version)

    if args.command == "validate":
        print(f"Release metadata for {args.version} er gyldig")
        return
    if args.command == "markdown":
        args.output.write_text(render_markdown(release), encoding="utf-8")
        return

    signature = args.signature_file.read_text(encoding="utf-8").strip()
    payload = {
        "version": args.version,
        # Keep updater notes human-readable for Desk versions released before the
        # structured update center. Newer clients parse this canonical Markdown
        # back into sections, while older clients can display it as plain text.
        "notes": render_markdown(release),
        "pub_date": release["publishedAt"],
        "platforms": {
            args.platform: {
                "signature": signature,
                "url": args.url,
            }
        },
    }
    args.output.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
