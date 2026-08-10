# assets.py — fotorealisme-verktøyene (fase 8): asset-import, modifiers,
# HDRI-miljø og bildeteksturer. Det som løfter broen fra stilisert til
# premium: ekte modeller, avrundede kanter, ekte lys-miljø, ekte flater.

from __future__ import annotations

import os

import bpy

try:
    from . import core
except ImportError:  # flat import i headless-testene
    import core


# ---------------------------------------------------------------- import

_IMPORTERS = {
    ".glb": lambda p: bpy.ops.import_scene.gltf(filepath=p),
    ".gltf": lambda p: bpy.ops.import_scene.gltf(filepath=p),
    ".fbx": lambda p: bpy.ops.import_scene.fbx(filepath=p),
    ".obj": lambda p: bpy.ops.wm.obj_import(filepath=p),
    ".usd": lambda p: bpy.ops.wm.usd_import(filepath=p),
    ".usdc": lambda p: bpy.ops.wm.usd_import(filepath=p),
    ".usdz": lambda p: bpy.ops.wm.usd_import(filepath=p),
}


def import_asset(filepath: str, name_prefix: str | None = None) -> dict:
    """Importer GLTF/GLB/FBX/OBJ/USD. Returnerer navnene på nye objekter."""
    ext = os.path.splitext(filepath)[1].lower()
    if ext not in _IMPORTERS:
        raise ValueError(f"ustøttet format '{ext}' — gyldige: {sorted(_IMPORTERS)}")
    if not os.path.exists(filepath):
        raise ValueError(f"fila finnes ikke: {filepath}")
    core._undo_push(f"import_asset {os.path.basename(filepath)}")
    before = {o.name for o in bpy.data.objects}
    _IMPORTERS[ext](filepath)
    imported = [o for o in bpy.data.objects if o.name not in before]
    if name_prefix:
        for i, obj in enumerate(imported):
            obj.name = f"{name_prefix}_{i}" if len(imported) > 1 else name_prefix
    return {
        "imported": [o.name for o in imported],
        "types": {o.name: o.type for o in imported},
    }


# ---------------------------------------------------------------- modifiers

# Semantiske modifiers m/ navngitte parametre — ikke rå bpy-props.
_MODIFIERS = {
    "bevel": ("BEVEL", {"width": "width", "segments": "segments"}),
    "subdivision": ("SUBSURF", {"viewport_levels": "levels", "render_levels": "render_levels"}),
    "solidify": ("SOLIDIFY", {"thickness": "thickness"}),
    "mirror": ("MIRROR", {}),
    "smooth": ("SMOOTH", {"factor": "factor", "iterations": "iterations"}),
}


def add_modifier(object_name: str, type: str, params: dict | None = None,
                 name: str | None = None) -> dict:
    obj = core._require_object(object_name)
    if type not in _MODIFIERS:
        raise ValueError(f"ukjent modifier '{type}' — gyldige: {sorted(_MODIFIERS)}")
    bl_type, mapping = _MODIFIERS[type]
    core._undo_push(f"add_modifier {type} → {object_name}")
    modifier = obj.modifiers.new(name=name or type.capitalize(), type=bl_type)
    for key, value in (params or {}).items():
        if key not in mapping:
            raise ValueError(f"ukjent parameter '{key}' for {type} — gyldige: {sorted(mapping)}")
        setattr(modifier, mapping[key], value)
    if type == "bevel":
        # skarpe primitiver + bevel = premium-kanter; shade smooth gjør resten
        modifier.limit_method = "ANGLE"
    return {"object": object_name, "modifier": modifier.name, "type": type}


def apply_modifier(object_name: str, modifier_name: str) -> dict:
    """DESTRUKTIVT (§11): baker modifieren inn i meshen."""
    obj = core._require_object(object_name)
    if modifier_name not in [m.name for m in obj.modifiers]:
        raise ValueError(f"'{object_name}' har ingen modifier '{modifier_name}'")
    core._undo_push(f"apply_modifier {modifier_name}")
    with bpy.context.temp_override(object=obj, active_object=obj, selected_objects=[obj]):
        bpy.ops.object.modifier_apply(modifier=modifier_name)
    return {"applied": modifier_name, "object": object_name}


def shade_smooth(object_name: str, smooth: bool = True) -> dict:
    obj = core._require_object(object_name)
    if obj.type != "MESH":
        raise ValueError(f"'{object_name}' er ikke et mesh")
    core._undo_push(f"shade_smooth {object_name}")
    for polygon in obj.data.polygons:
        polygon.use_smooth = smooth
    return {"object": object_name, "smooth": smooth}


# ---------------------------------------------------------------- miljø

def set_world_hdri(filepath: str, strength: float = 1.0, rotation_deg: float = 0.0) -> dict:
    """HDRI-miljøbelysning: Environment Texture → Background → World Output."""
    import math

    if not os.path.exists(filepath):
        raise ValueError(f"fila finnes ikke: {filepath}")
    core._undo_push("set_world_hdri")
    world = bpy.context.scene.world or bpy.data.worlds.new("World")
    bpy.context.scene.world = world
    world.use_nodes = True
    nodes = world.node_tree.nodes
    links = world.node_tree.links
    nodes.clear()
    output = nodes.new("ShaderNodeOutputWorld")
    background = nodes.new("ShaderNodeBackground")
    background.inputs["Strength"].default_value = strength
    env = nodes.new("ShaderNodeTexEnvironment")
    env.image = bpy.data.images.load(filepath, check_existing=True)
    mapping = nodes.new("ShaderNodeMapping")
    mapping.inputs["Rotation"].default_value[2] = math.radians(rotation_deg)
    coords = nodes.new("ShaderNodeTexCoord")
    links.new(coords.outputs["Generated"], mapping.inputs["Vector"])
    links.new(mapping.outputs["Vector"], env.inputs["Vector"])
    links.new(env.outputs["Color"], background.inputs["Color"])
    links.new(background.outputs["Background"], output.inputs["Surface"])
    return {"hdri": os.path.basename(filepath), "strength": strength}


def set_world_color(color: list, strength: float = 1.0) -> dict:
    core._undo_push("set_world_color")
    world = bpy.context.scene.world or bpy.data.worlds.new("World")
    bpy.context.scene.world = world
    world.use_nodes = True
    background = next((n for n in world.node_tree.nodes if n.type == "BACKGROUND"), None)
    if background is None:
        raise ValueError("world mangler Background-node — kall set_world_hdri først eller bruk default world")
    value = list(color) + [1.0] if len(color) == 3 else list(color)
    background.inputs["Color"].default_value = value
    background.inputs["Strength"].default_value = strength
    return {"color": color, "strength": strength}


# ---------------------------------------------------------------- teksturer

def set_material_texture(material: str, parameter: str, image_path: str) -> dict:
    """Koble bildetekstur til Principled-input. 'Normal' ruter via NormalMap-node;
    ikke-fargedata (Roughness/Metallic/Normal) settes til Non-Color."""
    mat = bpy.data.materials.get(material)
    if mat is None:
        raise ValueError(f"ukjent materiale '{material}'")
    if not os.path.exists(image_path):
        raise ValueError(f"fila finnes ikke: {image_path}")
    if not mat.use_nodes:
        raise ValueError(f"materialet '{material}' bruker ikke noder")
    bsdf = next((n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
    if bsdf is None:
        raise ValueError(f"materialet '{material}' har ingen Principled BSDF")
    core._undo_push(f"set_material_texture {material}.{parameter}")
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    tex = nodes.new("ShaderNodeTexImage")
    # Non-Color-parametre får EGEN datablock — delt image ville smittet
    # colorspace-endringen over på Base Color-bruk av samme fil.
    needs_non_color = parameter not in ("Base Color", "Emission Color")
    tex.image = bpy.data.images.load(image_path, check_existing=not needs_non_color)
    tex.location = (bsdf.location.x - 400, bsdf.location.y - 200)
    if parameter == "Normal":
        tex.image.colorspace_settings.name = "Non-Color"
        normal_map = nodes.new("ShaderNodeNormalMap")
        links.new(tex.outputs["Color"], normal_map.inputs["Color"])
        links.new(normal_map.outputs["Normal"], bsdf.inputs["Normal"])
    else:
        socket = bsdf.inputs.get(parameter)
        if socket is None:
            valid = [s.name for s in bsdf.inputs]
            raise ValueError(f"ukjent parameter '{parameter}' — gyldige: {valid}")
        if parameter not in ("Base Color", "Emission Color"):
            tex.image.colorspace_settings.name = "Non-Color"
        links.new(tex.outputs["Color"], socket)
    return {"material": material, "parameter": parameter, "image": os.path.basename(image_path)}


def configure_render(exposure: float | None = None, view_transform: str | None = None,
                     look: str | None = None, film_transparent: bool | None = None) -> dict:
    """Fargestyring/eksponering — AgX (default i Blender 5) håndterer høylys
    fotografisk; exposure justerer i stops."""
    core._undo_push("configure_render")
    scene = bpy.context.scene
    if exposure is not None:
        scene.view_settings.exposure = exposure
    if view_transform is not None:
        scene.view_settings.view_transform = view_transform  # "AgX"/"Filmic"/"Standard"
    if look is not None:
        scene.view_settings.look = look  # f.eks. "AgX - Punchy"
    if film_transparent is not None:
        scene.render.film_transparent = film_transparent
    return {
        "exposure": scene.view_settings.exposure,
        "view_transform": scene.view_settings.view_transform,
        "look": scene.view_settings.look,
    }


def save_blend(filepath: str) -> dict:
    """Lagre .blend — Blender-fila er master source for asset-biblioteket."""
    if not filepath.endswith(".blend"):
        raise ValueError("filepath må ende på .blend")
    core._undo_push("save_blend")
    bpy.ops.wm.save_as_mainfile(filepath=filepath)
    return {"saved": filepath}


ASSET_TOOLS = {
    "configure_render": {"level": "modify", "fn": configure_render, "description": "Fargestyring: exposure (stops), view_transform (AgX|Filmic|Standard), look (f.eks. 'AgX - Punchy'), film_transparent?. Fotografisk høylys-håndtering.", "mutates": True},
    "save_blend": {"level": "modify", "fn": save_blend, "description": "Lagre scenen som .blend (master-fila for asset-biblioteket). Args: filepath.", "mutates": False},
    "import_asset": {"level": "safe", "fn": import_asset, "description": "Importer 3D-asset (glb/gltf/fbx/obj/usd/usdz). Args: filepath, name_prefix?. Returnerer nye objektnavn.", "mutates": True},
    "add_modifier": {"level": "modify", "fn": add_modifier, "description": "Legg semantisk modifier: type=bevel(width,segments)|subdivision(viewport_levels,render_levels)|solidify(thickness)|mirror|smooth(factor,iterations). Args: object_name, type, params?, name?. Bevel+shade_smooth = premium-kanter.", "mutates": True},
    "apply_modifier": {"level": "destructive", "fn": apply_modifier, "description": "Bak modifieren inn i meshen. DESTRUKTIVT — krever godkjenning. Args: object_name, modifier_name.", "mutates": True},
    "shade_smooth": {"level": "modify", "fn": shade_smooth, "description": "Shade smooth/flat på mesh. Args: object_name, smooth (default true).", "mutates": True},
    "set_world_hdri": {"level": "modify", "fn": set_world_hdri, "description": "HDRI-miljøbelysning (exr/hdr/png). Args: filepath, strength?, rotation_deg?. Grunnmuren i fotorealistisk lys.", "mutates": True},
    "set_world_color": {"level": "modify", "fn": set_world_color, "description": "Ensfarget world-bakgrunn. Args: color [r,g,b], strength?.", "mutates": True},
    "set_material_texture": {"level": "modify", "fn": set_material_texture, "description": "Koble bildetekstur til Principled-input ('Base Color'/'Roughness'/'Metallic'/'Normal' — Normal ruter via NormalMap, ikke-farge settes Non-Color). Args: material, parameter, image_path.", "mutates": True},
}
