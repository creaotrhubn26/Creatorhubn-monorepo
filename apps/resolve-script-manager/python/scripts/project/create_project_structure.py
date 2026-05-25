"""Create a new Resolve project with a template's bin structure (wedding_film, podcast, …)."""

from __future__ import annotations

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


TEMPLATES_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "templates")


def load_template(template_id: str) -> dict | None:
    """Resolve a template by id, display name, or slug; supports both file conventions."""
    # 1. Try templates index for canonical lookup
    index_path = os.path.join(TEMPLATES_DIR, "_index.json")
    if os.path.isfile(index_path):
        with open(index_path, "r", encoding="utf-8") as fh:
            index = json.load(fh)
        needle = template_id.strip().lower().replace(" ", "_").replace("-", "_")
        for entry in index.get("templates", []):
            entry_id = entry.get("id", "").lower()
            entry_name = entry.get("name", "").lower().replace(" ", "_").replace("-", "_")
            if needle in (entry_id, entry_name):
                file_name = entry.get("file")
                if file_name:
                    path = os.path.join(TEMPLATES_DIR, file_name)
                    if os.path.isfile(path):
                        with open(path, "r", encoding="utf-8") as fh:
                            return json.load(fh)

    # 2. Direct file lookups (try both naming conventions)
    for candidate in (f"{template_id}.json", f"{template_id}_bins.json"):
        path = os.path.join(TEMPLATES_DIR, candidate)
        if os.path.isfile(path):
            with open(path, "r", encoding="utf-8") as fh:
                return json.load(fh)

    return None


def list_available_templates() -> list[str]:
    index_path = os.path.join(TEMPLATES_DIR, "_index.json")
    if os.path.isfile(index_path):
        with open(index_path, "r", encoding="utf-8") as fh:
            index = json.load(fh)
        return [f"{t['id']} ({t.get('name', t['id'])})" for t in index.get("templates", [])]
    return []


def run(params: dict, dry_run: bool) -> None:
    project_name = params.get("projectName", "Untitled Project")
    template_id = params.get("template", "wedding_film")

    template = load_template(template_id)
    if not template:
        available = list_available_templates()
        bridge.error(
            f"Template '{template_id}' not found. Available: {', '.join(available) if available else '(no _index.json)'}",
        )
        sys.exit(1)

    bridge.log(f"Preparing project '{project_name}' from template '{template['name']}'")

    if dry_run:
        bridge.result({
            "summary": f"Dry run — would create project '{project_name}' with {len(template['bins'])} bins",
            "bins": template["bins"],
            "defaultTimelines": template.get("defaultTimelines", []),
        })
        return

    conn = bridge.ResolveConnection()
    if not conn.connect():
        return

    pm = conn.project_manager
    project = pm.CreateProject(project_name)
    if not project:
        bridge.error(f"CreateProject failed — name '{project_name}' may already exist")
        sys.exit(1)

    media_pool = project.GetMediaPool()
    root_folder = media_pool.GetRootFolder()

    created_bins: list[str] = []
    for bin_name in template["bins"]:
        folder = media_pool.AddSubFolder(root_folder, bin_name)
        if folder:
            created_bins.append(bin_name)
        else:
            bridge.warn(f"AddSubFolder returned None for '{bin_name}'")

    bridge.result({
        "projectName": project_name,
        "binsCreated": created_bins,
        "templateUsed": template["id"],
    })


if __name__ == "__main__":
    bridge.main_guard(run)
