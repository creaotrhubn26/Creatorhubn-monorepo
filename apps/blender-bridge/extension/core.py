# core.py — observer + executor for Claude×Blender-broen.
#
# Ren bpy-modul: importerbar både fra extension-serveren (GUI) og headless
# (`blender --background --python tests/headless_selftest.py`). Alle verktøy er
# SEMANTISKE (arkitekturdokumentets §4 — aldri exec av vilkårlig Python), og
# registeret TOOLS er eneste kilde for både HTTP-endepunktet og MCP tools/list
# (Role Room MCP-mønsteret).
#
# Muterende verktøy pusher undo-steg først → «AI-transaksjon» = undo-gruppe.

from __future__ import annotations

import math

import bpy
from mathutils import Vector

# ---------------------------------------------------------------- observer


def get_scene() -> dict:
    scene = bpy.context.scene
    objects = list(scene.objects)
    return {
        "name": scene.name,
        "frame_current": scene.frame_current,
        "render_engine": scene.render.engine,
        "counts": {
            "objects": len(objects),
            "meshes": sum(1 for o in objects if o.type == "MESH"),
            "lights": sum(1 for o in objects if o.type == "LIGHT"),
            "cameras": sum(1 for o in objects if o.type == "CAMERA"),
        },
        "objects": [
            {"name": o.name, "type": o.type, "location": list(o.location)}
            for o in objects
        ],
        "active_camera": scene.camera.name if scene.camera else None,
    }


def get_selection() -> dict:
    ctx = bpy.context
    return {
        "mode": ctx.mode,
        "active_object": ctx.view_layer.objects.active.name
        if ctx.view_layer.objects.active
        else None,
        "selected_objects": [o.name for o in ctx.selected_objects],
    }


def inspect_object(name: str) -> dict:
    obj = _require_object(name)
    info = {
        "name": obj.name,
        "type": obj.type,
        "location": list(obj.location),
        "rotation_euler_deg": [math.degrees(a) for a in obj.rotation_euler],
        "scale": list(obj.scale),
        "dimensions": list(obj.dimensions),
        "visible": not obj.hide_render,
        "modifiers": [m.name for m in getattr(obj, "modifiers", [])],
        "materials": [s.material.name for s in obj.material_slots if s.material],
    }
    if obj.type == "LIGHT":
        light = obj.data
        info["light"] = {
            "light_type": light.type,
            "energy": light.energy,
            "color": list(light.color),
        }
    if obj.type == "CAMERA":
        cam = obj.data
        info["camera"] = {
            "focal_length_mm": cam.lens,
            "dof_enabled": cam.dof.use_dof,
        }
    return info


def validate_scene() -> dict:
    warnings = []
    for obj in bpy.context.scene.objects:
        if obj.type == "MESH" and tuple(obj.scale) != (1.0, 1.0, 1.0):
            warnings.append(f"unapplied scale: {obj.name} {tuple(obj.scale)}")
    for image in bpy.data.images:
        if image.source == "FILE" and not image.packed_file and not image.filepath_from_user():
            warnings.append(f"missing texture path: {image.name}")
    scene = bpy.context.scene
    if scene.camera is None:
        warnings.append("no active camera")
    return {"ok": not warnings, "warnings": warnings, "checks": ["scale", "textures", "camera"]}


# ---------------------------------------------------------------- executor

_PRIMITIVES = {
    "cube": lambda: bpy.ops.mesh.primitive_cube_add(),
    "sphere": lambda: bpy.ops.mesh.primitive_uv_sphere_add(),
    "cylinder": lambda: bpy.ops.mesh.primitive_cylinder_add(),
    "plane": lambda: bpy.ops.mesh.primitive_plane_add(),
    "empty": lambda: bpy.ops.object.empty_add(),
}


def create_object(kind: str, name: str | None = None, location: list | None = None) -> dict:
    if kind not in _PRIMITIVES:
        raise ValueError(f"ukjent kind '{kind}' — gyldige: {sorted(_PRIMITIVES)}")
    _undo_push(f"create_object {kind}")
    _PRIMITIVES[kind]()
    obj = bpy.context.active_object
    if name:
        obj.name = name
    if location:
        obj.location = Vector(location)
    return {"created": obj.name, "type": obj.type}


def delete_object(name: str) -> dict:
    obj = _require_object(name)
    _undo_push(f"delete_object {name}")
    bpy.data.objects.remove(obj, do_unlink=True)
    return {"deleted": name}


def set_transform(
    name: str,
    location: list | None = None,
    rotation_euler_deg: list | None = None,
    scale: list | None = None,
) -> dict:
    obj = _require_object(name)
    _undo_push(f"set_transform {name}")
    if location is not None:
        obj.location = Vector(location)
    if rotation_euler_deg is not None:
        obj.rotation_euler = [math.radians(a) for a in rotation_euler_deg]
    if scale is not None:
        obj.scale = Vector(scale)
    return inspect_object(obj.name)


def create_material(
    name: str,
    base_color: list | None = None,
    metallic: float | None = None,
    roughness: float | None = None,
) -> dict:
    _undo_push(f"create_material {name}")
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    for parameter, value in (
        ("Base Color", base_color),
        ("Metallic", metallic),
        ("Roughness", roughness),
    ):
        if value is not None:
            _set_principled_input(mat, parameter, value)
    return {"created": mat.name}


def set_material_parameter(material: str, parameter: str, value) -> dict:
    mat = bpy.data.materials.get(material)
    if mat is None:
        raise ValueError(f"ukjent materiale '{material}'")
    _undo_push(f"set_material_parameter {material}.{parameter}")
    _set_principled_input(mat, parameter, value)
    return {"material": material, "parameter": parameter, "value": value}


def assign_material(object_name: str, material: str) -> dict:
    obj = _require_object(object_name)
    mat = bpy.data.materials.get(material)
    if mat is None:
        raise ValueError(f"ukjent materiale '{material}'")
    _undo_push(f"assign_material {object_name}")
    if obj.material_slots:
        obj.material_slots[0].material = mat
    else:
        obj.data.materials.append(mat)
    return {"object": object_name, "material": material}


_LIGHT_TYPES = {"POINT", "SUN", "SPOT", "AREA"}


def create_light(
    type: str = "AREA",
    name: str | None = None,
    location: list | None = None,
    energy: float | None = None,
    color: list | None = None,
) -> dict:
    light_type = type.upper()
    if light_type not in _LIGHT_TYPES:
        raise ValueError(f"ukjent lystype '{type}' — gyldige: {sorted(_LIGHT_TYPES)}")
    _undo_push(f"create_light {light_type}")
    data = bpy.data.lights.new(name or f"Light_{light_type}", light_type)
    obj = bpy.data.objects.new(data.name, data)
    bpy.context.scene.collection.objects.link(obj)
    if location:
        obj.location = Vector(location)
    if energy is not None:
        data.energy = energy
    if color is not None:
        data.color = color
    return {"created": obj.name, "light_type": light_type}


def configure_light(
    name: str,
    energy: float | None = None,
    color: list | None = None,
    size: float | None = None,
    spot_size_deg: float | None = None,
) -> dict:
    obj = _require_object(name)
    if obj.type != "LIGHT":
        raise ValueError(f"'{name}' er ikke et lys")
    _undo_push(f"configure_light {name}")
    light = obj.data
    if energy is not None:
        light.energy = energy
    if color is not None:
        light.color = color
    if size is not None and hasattr(light, "size"):
        light.size = size
    if spot_size_deg is not None and hasattr(light, "spot_size"):
        light.spot_size = math.radians(spot_size_deg)
    return inspect_object(name)


def create_camera(
    name: str | None = None,
    location: list | None = None,
    focal_length_mm: float | None = None,
    make_active: bool = True,
) -> dict:
    _undo_push("create_camera")
    data = bpy.data.cameras.new(name or "Camera")
    obj = bpy.data.objects.new(data.name, data)
    bpy.context.scene.collection.objects.link(obj)
    if location:
        obj.location = Vector(location)
    if focal_length_mm is not None:
        data.lens = focal_length_mm
    if make_active:
        bpy.context.scene.camera = obj
    return {"created": obj.name, "active": make_active}


def point_camera_at(camera: str, target: str) -> dict:
    cam = _require_object(camera)
    target_obj = _require_object(target)
    _undo_push(f"point_camera_at {camera}")
    direction = target_obj.location - cam.location
    cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    return {"camera": camera, "target": target}


def configure_camera(
    name: str,
    focal_length_mm: float | None = None,
    dof_enabled: bool | None = None,
    dof_focus_object: str | None = None,
    f_stop: float | None = None,
) -> dict:
    obj = _require_object(name)
    if obj.type != "CAMERA":
        raise ValueError(f"'{name}' er ikke et kamera")
    _undo_push(f"configure_camera {name}")
    cam = obj.data
    if focal_length_mm is not None:
        cam.lens = focal_length_mm
    if dof_enabled is not None:
        cam.dof.use_dof = dof_enabled
    if dof_focus_object is not None:
        cam.dof.focus_object = _require_object(dof_focus_object)
    if f_stop is not None:
        cam.dof.aperture_fstop = f_stop
    return inspect_object(name)


def render_preview(filepath: str | None = None, resolution: int = 512) -> dict:
    import tempfile
    import os

    scene = bpy.context.scene
    if scene.camera is None:
        raise ValueError("ingen aktiv kamera — kall create_camera først")
    path = filepath or os.path.join(tempfile.gettempdir(), "blender_bridge_preview.png")
    prev = (
        scene.render.engine,
        scene.render.resolution_x,
        scene.render.resolution_y,
        scene.render.filepath,
    )
    try:
        # EEVEE for hastighet — engine-navnet varierer mellom versjoner.
        for engine in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE", "BLENDER_WORKBENCH"):
            try:
                scene.render.engine = engine
                break
            except TypeError:
                continue
        aspect = prev[2] / prev[1] if prev[1] else 9 / 16
        scene.render.resolution_x = resolution
        scene.render.resolution_y = max(1, int(resolution * aspect))
        scene.render.filepath = path
        bpy.ops.render.render(write_still=True)
    finally:
        (
            scene.render.engine,
            scene.render.resolution_x,
            scene.render.resolution_y,
            scene.render.filepath,
        ) = prev
    return {"rendered": path, "resolution": resolution}


def render_final(
    filepath: str | None = None,
    resolution: int = 1920,
    samples: int = 128,
) -> dict:
    """Cycles-render i full kvalitet — bruk ETTER at preview-loopen er ferdig."""
    import os
    import tempfile

    scene = bpy.context.scene
    if scene.camera is None:
        raise ValueError("ingen aktiv kamera — kall create_camera først")
    path = filepath or os.path.join(tempfile.gettempdir(), "blender_bridge_final.png")
    prev = (
        scene.render.engine,
        scene.render.resolution_x,
        scene.render.resolution_y,
        scene.render.filepath,
        scene.cycles.samples if hasattr(scene, "cycles") else None,
    )
    try:
        scene.render.engine = "CYCLES"
        scene.cycles.samples = samples
        aspect = prev[2] / prev[1] if prev[1] else 9 / 16
        scene.render.resolution_x = resolution
        scene.render.resolution_y = max(1, int(resolution * aspect))
        scene.render.filepath = path
        bpy.ops.render.render(write_still=True)
    finally:
        scene.render.engine = prev[0]
        scene.render.resolution_x = prev[1]
        scene.render.resolution_y = prev[2]
        scene.render.filepath = prev[3]
        if prev[4] is not None and hasattr(scene, "cycles"):
            scene.cycles.samples = prev[4]
    # Post-hook (§36): final render leveres aldri uten QA vedlagt.
    return {"rendered": path, "resolution": resolution, "samples": samples,
            "engine": "CYCLES", "qa": validate_scene()}


# ---------------------------------------------------------------- AI-oppgaver
# «Angre hele AI-oppgaven» (§12): hver muterende operasjon pusher ett undo-steg
# (_undo_push) — vi teller dem per oppgave og ruller tilbake N steg.

_TASK = {"label": None, "ops": 0}


def begin_task(label: str) -> dict:
    """Start en AI-transaksjon. Alle muterende kall telles til undo_task/end_task."""
    _TASK["label"] = label
    _TASK["ops"] = 0
    _undo_push(f"TASK: {label}")
    return {"task": label, "ops": 0}


def task_status() -> dict:
    return {"task": _TASK["label"], "ops": _TASK["ops"]}


def end_task() -> dict:
    summary = task_status()
    _TASK["label"] = None
    _TASK["ops"] = 0
    return {"ended": summary}


def undo_task() -> dict:
    """Rull tilbake HELE aktiv AI-oppgave (N undo-steg)."""
    count = _TASK["ops"]
    undone = 0
    for _ in range(count):
        try:
            bpy.ops.ed.undo()
            undone += 1
        except RuntimeError:
            break
    summary = {"task": _TASK["label"], "requested": count, "undone": undone}
    _TASK["label"] = None
    _TASK["ops"] = 0
    return summary


def undo_push(label: str = "AI step") -> dict:
    _undo_push(label)
    return {"pushed": label}


def undo() -> dict:
    bpy.ops.ed.undo()
    return {"undone": True}


# ---------------------------------------------------------------- hjelpere


def _require_object(name: str):
    obj = bpy.data.objects.get(name)
    if obj is None:
        raise ValueError(f"ukjent objekt '{name}'")
    return obj


def _undo_push(label: str) -> None:
    if _TASK["label"] is not None and not label.startswith("TASK:"):
        _TASK["ops"] += 1
    try:
        bpy.ops.ed.undo_push(message=f"[Claude] {label}")
    except RuntimeError:
        pass  # headless uten undo-stack — harmløst


def _set_principled_input(mat, parameter: str, value) -> None:
    bsdf = next((n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
    if bsdf is None:
        raise ValueError(f"materialet '{mat.name}' har ingen Principled BSDF")
    socket = bsdf.inputs.get(parameter)
    if socket is None:
        valid = [s.name for s in bsdf.inputs]
        raise ValueError(f"ukjent parameter '{parameter}' — gyldige: {valid}")
    if socket.type == "RGBA" and isinstance(value, (list, tuple)) and len(value) == 3:
        value = list(value) + [1.0]
    socket.default_value = value


# ---------------------------------------------------------------- register
# Én kilde for HTTP-serveren OG MCP tools/list. description vises til Claude.

TOOLS: dict[str, dict] = {
    "get_scene": {"level": "safe", "fn": get_scene, "description": "Scene-oversikt: tellinger, objekter, aktiv kamera, render-engine.", "mutates": False},
    "get_selection": {"level": "safe", "fn": get_selection, "description": "Gjeldende mode, aktivt objekt og selection.", "mutates": False},
    "inspect_object": {"level": "safe", "fn": inspect_object, "description": "Detaljer om ett objekt (transform, materialer, lys-/kamera-data). Args: name.", "mutates": False},
    "validate_scene": {"level": "safe", "fn": validate_scene, "description": "Enkel scene-QA: unapplied scale, manglende teksturer, aktiv kamera.", "mutates": False},
    "create_object": {"level": "safe", "fn": create_object, "description": "Lag primitiv: kind=cube|sphere|cylinder|plane|empty, name?, location?[x,y,z].", "mutates": True},
    "delete_object": {"level": "destructive", "fn": delete_object, "description": "Slett objekt ved navn. DESTRUKTIVT.", "mutates": True},
    "set_transform": {"level": "modify", "fn": set_transform, "description": "Sett location/rotation_euler_deg/scale på objekt. Args: name + valgfrie [x,y,z].", "mutates": True},
    "create_material": {"level": "safe", "fn": create_material, "description": "Nytt Principled-materiale. Args: name, base_color?[r,g,b], metallic?, roughness?.", "mutates": True},
    "set_material_parameter": {"level": "modify", "fn": set_material_parameter, "description": "Sett Principled-input ved navn (f.eks. 'Metallic', 0.8). Args: material, parameter, value.", "mutates": True},
    "assign_material": {"level": "modify", "fn": assign_material, "description": "Tildel materiale til objekt. Args: object_name, material.", "mutates": True},
    "create_light": {"level": "safe", "fn": create_light, "description": "Nytt lys: type=POINT|SUN|SPOT|AREA, name?, location?, energy?, color?[r,g,b].", "mutates": True},
    "configure_light": {"level": "modify", "fn": configure_light, "description": "Endre lys: energy?, color?, size? (area), spot_size_deg? (spot). Args: name + felter.", "mutates": True},
    "create_camera": {"level": "safe", "fn": create_camera, "description": "Nytt kamera: name?, location?, focal_length_mm?, make_active (default true).", "mutates": True},
    "point_camera_at": {"level": "safe", "fn": point_camera_at, "description": "Sikt kamera mot objekt. Args: camera, target.", "mutates": True},
    "configure_camera": {"level": "modify", "fn": configure_camera, "description": "Endre kamera: focal_length_mm?, dof_enabled?, dof_focus_object?, f_stop?. Args: name + felter.", "mutates": True},
    "render_preview": {"level": "safe", "fn": render_preview, "description": "Rask EEVEE-preview til PNG. Args: filepath? (default temp), resolution? (default 512). Returnerer filsti — les bildet for visuell inspeksjon.", "mutates": False},
    "render_final": {"level": "safe", "fn": render_final, "description": "Cycles-render i full kvalitet (default 1920px/128 samples). Bruk ETTER preview-loopen. Args: filepath?, resolution?, samples?.", "mutates": False},
    "begin_task": {"level": "safe", "fn": begin_task, "description": "Start en AI-transaksjon: alle muterende kall telles så hele oppgaven kan angres samlet. Args: label. Kall FØRST i fler-stegs oppgaver.", "mutates": False},
    "task_status": {"level": "safe", "fn": task_status, "description": "Aktiv AI-oppgave + antall muterende operasjoner.", "mutates": False},
    "end_task": {"level": "safe", "fn": end_task, "description": "Avslutt AI-oppgaven (beholder endringene).", "mutates": False},
    "undo_task": {"level": "modify", "fn": undo_task, "description": "Rull tilbake HELE aktiv AI-oppgave (alle muterende steg siden begin_task).", "mutates": True},
    "undo_push": {"level": "safe", "fn": undo_push, "description": "Marker starten på en AI-transaksjon i undo-historikken. Args: label.", "mutates": False},
    "undo": {"level": "safe", "fn": undo, "description": "Angre siste steg.", "mutates": True},
}


# Geometry Nodes-verktøyene bor i egen modul — merges inn i katalogen her.
try:
    from . import geometry_nodes as _gn
except ImportError:  # flat import i headless-testene
    import geometry_nodes as _gn
TOOLS.update(_gn.GN_TOOLS)
try:
    from . import assets as _assets
except ImportError:
    import assets as _assets
TOOLS.update(_assets.ASSET_TOOLS)
try:
    from . import studio_kit as _studio
except ImportError:
    import studio_kit as _studio
TOOLS.update(_studio.STUDIO_TOOLS)
try:
    from . import export_pipeline as _export
except ImportError:
    import export_pipeline as _export
TOOLS.update(_export.EXPORT_TOOLS)


def call_tool(name: str, args: dict | None = None) -> dict:
    if name not in TOOLS:
        raise ValueError(f"ukjent verktøy '{name}'")
    return TOOLS[name]["fn"](**(args or {}))
