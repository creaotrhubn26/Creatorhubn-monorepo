# export_pipeline.py — asset-eksporten som mater iPad-appen (arkitekturens
# siste ledd: Blender = master source → USD/USDZ/GLB + metadata → StageOne).
#
# Manifestet er nøkkelen: rr_-custom-properties (satt av Studio Kit) følger
# IKKE alltid med gjennom eksport-formatene — derfor eksporteres de som
# sidecar-JSON iPad-appen leser sammen med geometrifila.

from __future__ import annotations

import json
import math
import os

import bpy

try:
    from . import core
except ImportError:  # flat import i headless-testene
    import core

_FORMATS = {".usd", ".usdc", ".usdz", ".glb", ".gltf"}


def _export(filepath: str, selected_only: bool) -> None:
    ext = os.path.splitext(filepath)[1].lower()
    if ext not in _FORMATS:
        raise ValueError(f"ustøttet format '{ext}' — gyldige: {sorted(_FORMATS)}")
    if ext in (".usd", ".usdc", ".usdz"):
        # NB: export_textures-kwargen forsvant i Blender 5 — teksturer følger
        # med via export_materials.
        bpy.ops.wm.usd_export(filepath=filepath, selected_objects_only=selected_only,
                              export_materials=True)
    else:
        bpy.ops.export_scene.gltf(filepath=filepath, use_selection=selected_only)


def export_scene_file(filepath: str) -> dict:
    """Eksporter hele scenen (USD/USDZ/GLB/GLTF etter filendelse)."""
    core._undo_push(f"export_scene {os.path.basename(filepath)}")
    _export(filepath, selected_only=False)
    if not os.path.exists(filepath):
        raise ValueError("eksporten produserte ingen fil")
    return {"exported": filepath, "bytes": os.path.getsize(filepath)}


def export_collection(collection: str, filepath: str) -> dict:
    """Eksporter én collection (f.eks. LIGHTING eller ett asset) som egen fil."""
    coll = bpy.data.collections.get(collection)
    if coll is None:
        raise ValueError(f"ukjent collection '{collection}'")
    core._undo_push(f"export_collection {collection}")
    objects = list(coll.all_objects)
    if not objects:
        raise ValueError(f"collection '{collection}' er tom")
    for obj in bpy.context.view_layer.objects:
        obj.select_set(False)
    for obj in objects:
        obj.select_set(True)
    try:
        _export(filepath, selected_only=True)
    finally:
        for obj in objects:
            obj.select_set(False)
    return {"exported": filepath, "objects": [o.name for o in objects],
            "bytes": os.path.getsize(filepath)}


def export_asset_manifest(filepath: str) -> dict:
    """Sidecar-JSON: alle rr_-taggede objekter m/ metadata + transform +
    lys-/kameradata — det iPad-appen trenger for å gjenskape produksjonsoppsettet."""
    core._undo_push("export_asset_manifest")
    entries = []
    for obj in bpy.context.scene.objects:
        rr_keys = [k for k in obj.keys() if isinstance(k, str) and k.startswith("rr_")]
        if not rr_keys:
            continue
        entry = {
            "name": obj.name,
            "meta": {k[3:]: _plain(obj[k]) for k in rr_keys},
            "location": list(obj.location),
            "rotation_euler_deg": [math.degrees(a) for a in obj.rotation_euler],
            "scale": list(obj.scale),
            "children": [c.name for c in obj.children],
        }
        light = next((c for c in obj.children if c.type == "LIGHT"), None)
        if obj.type == "LIGHT":
            light = obj
        if light is not None:
            entry["light"] = {
                "type": light.data.type,
                "energy": light.data.energy,
                "color": list(light.data.color),
                "size": getattr(light.data, "size", None),
            }
        camera = next((c for c in obj.children if c.type == "CAMERA"), None)
        if camera is not None:
            entry["camera"] = {
                "focal_length_mm": camera.data.lens,
                "sensor_width_mm": camera.data.sensor_width,
                "f_stop": camera.data.dof.aperture_fstop,
            }
        entries.append(entry)
    payload = {"version": 1, "generator": "claude-bridge-studio-kit", "assets": entries}
    with open(filepath, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2, ensure_ascii=False)
    return {"manifest": filepath, "assets": len(entries)}


def _plain(value):
    try:
        return value.to_list()  # IDPropertyArray
    except AttributeError:
        return value if isinstance(value, (int, float, str, bool)) else str(value)


def export_studio_package(directory: str, name: str = "studio") -> dict:
    """Full leveranse til iPad: scene.usdz + scene.glb + manifest.json i én mappe."""
    os.makedirs(directory, exist_ok=True)
    usdz = os.path.join(directory, f"{name}.usdz")
    glb = os.path.join(directory, f"{name}.glb")
    manifest = os.path.join(directory, f"{name}.manifest.json")
    export_scene_file(usdz)
    export_scene_file(glb)
    result = export_asset_manifest(manifest)
    return {"package": directory,
            "files": [os.path.basename(p) for p in (usdz, glb, manifest)],
            "assets_in_manifest": result["assets"]}


EXPORT_TOOLS = {
    "export_scene_file": {"level": "safe", "fn": export_scene_file, "description": "Eksporter hele scenen — format fra filendelse: .usd/.usdc/.usdz/.glb/.gltf. Args: filepath.", "mutates": False},
    "export_collection": {"level": "safe", "fn": export_collection, "description": "Eksporter én collection som egen asset-fil (usd/usdz/glb). Args: collection, filepath.", "mutates": False},
    "export_asset_manifest": {"level": "safe", "fn": export_asset_manifest, "description": "Sidecar-JSON m/ alle rr_-taggede produksjonsobjekter (metadata, transform, lys- og kameradata) — det iPad-appen leser. Args: filepath.", "mutates": False},
    "export_studio_package": {"level": "safe", "fn": export_studio_package, "description": "Full iPad-leveranse: <name>.usdz + .glb + .manifest.json i én mappe. Args: directory, name?.", "mutates": False},
}
