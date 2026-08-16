# rigging.py — armature/skeleton-verktøyene: Rigify meta-rig + generate,
# automatic-weights skinning, pose og keyframe. Lukker det siste hullet i
# broen: mesh → rigget, animerbar 3D-modell.

from __future__ import annotations

import math

import bpy
from mathutils import Vector

try:
    from . import core
except ImportError:  # flat import i headless-testene
    import core


# ---------------------------------------------------------------- armature

def _set_active(obj) -> None:
    for o in bpy.context.selected_objects:
        o.select_set(False)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)


_ARMATURE_PRESETS = {"humanoid_metarig", "simple_chain"}


def create_armature(preset: str = "humanoid_metarig", name: str | None = None,
                    bones: list | None = None) -> dict:
    """humanoid_metarig: Rigify sin ferdige meta-rig (kall generate_rig etterpå).
    simple_chain: håndbygd bone-hierarki fra bones=[{name, head, tail, parent?}]."""
    if preset not in _ARMATURE_PRESETS:
        raise ValueError(f"ukjent preset '{preset}' — gyldige: {sorted(_ARMATURE_PRESETS)}")
    if preset == "simple_chain" and not bones:
        raise ValueError("simple_chain krever 'bones': [{name, head, tail, parent?}]")
    core._undo_push(f"create_armature {preset}")
    if preset == "humanoid_metarig":
        bpy.ops.object.armature_human_metarig_add()
        obj = bpy.context.active_object
    else:
        arm_data = bpy.data.armatures.new("Armature")
        obj = bpy.data.objects.new(arm_data.name, arm_data)
        bpy.context.scene.collection.objects.link(obj)
        _set_active(obj)
        bpy.ops.object.mode_set(mode="EDIT")
        try:
            edit_bones = arm_data.edit_bones
            for b in bones:
                if "name" not in b or "head" not in b or "tail" not in b:
                    raise ValueError("hver bone trenger name, head, tail")
                eb = edit_bones.new(b["name"])
                eb.head = Vector(b["head"])
                eb.tail = Vector(b["tail"])
                parent = b.get("parent")
                if parent:
                    eb.parent = edit_bones.get(parent)
                    if eb.parent is None:
                        raise ValueError(f"ukjent parent-bone '{parent}' for '{b['name']}'")
        finally:
            bpy.ops.object.mode_set(mode="OBJECT")
    if name:
        obj.name = name
    return {"created": obj.name, "type": obj.type, "preset": preset}


def generate_rig(armature_name: str) -> dict:
    """Bygg full kontroll-rig fra Rigify-metarig (rigify_generate)."""
    obj = core._require_object(armature_name)
    if obj.type != "ARMATURE":
        raise ValueError(f"'{armature_name}' er ikke en armature")
    core._undo_push(f"generate_rig {armature_name}")
    before = {o.name for o in bpy.data.objects}
    _set_active(obj)
    bpy.ops.pose.rigify_generate()
    after = [o for o in bpy.data.objects if o.name not in before]
    generated = next((o.name for o in after if o.type == "ARMATURE"), None)
    if generated is None:
        raise ValueError("rigify_generate produserte ingen ny armature — sjekk at metarigen er gyldig")
    return {"metarig": armature_name, "generated_rig": generated}


def skin_mesh(mesh_name: str, armature_name: str) -> dict:
    """Skinn mesh til armature med automatic weights (Ctrl+P → Armature Deform)."""
    mesh_obj = core._require_object(mesh_name)
    armature_obj = core._require_object(armature_name)
    if mesh_obj.type != "MESH":
        raise ValueError(f"'{mesh_name}' er ikke et mesh")
    if armature_obj.type != "ARMATURE":
        raise ValueError(f"'{armature_name}' er ikke en armature")
    core._undo_push(f"skin_mesh {mesh_name} → {armature_name}")
    for o in bpy.context.selected_objects:
        o.select_set(False)
    mesh_obj.select_set(True)
    armature_obj.select_set(True)
    bpy.context.view_layer.objects.active = armature_obj
    bpy.ops.object.parent_set(type="ARMATURE_AUTO")
    return {"mesh": mesh_name, "armature": armature_name, "parent_type": "ARMATURE_AUTO"}


def pose_bone(armature_name: str, bone_name: str, rotation_euler_deg: list | None = None,
             location: list | None = None) -> dict:
    obj = core._require_object(armature_name)
    if obj.type != "ARMATURE":
        raise ValueError(f"'{armature_name}' er ikke en armature")
    pbone = obj.pose.bones.get(bone_name)
    if pbone is None:
        valid = sorted(b.name for b in obj.pose.bones)
        raise ValueError(f"ukjent bone '{bone_name}' — gyldige: {valid}")
    core._undo_push(f"pose_bone {bone_name}")
    if rotation_euler_deg is not None:
        pbone.rotation_mode = "XYZ"
        pbone.rotation_euler = [math.radians(a) for a in rotation_euler_deg]
    if location is not None:
        pbone.location = Vector(location)
    return {
        "armature": armature_name,
        "bone": bone_name,
        "rotation_euler_deg": [math.degrees(a) for a in pbone.rotation_euler],
        "location": list(pbone.location),
    }


def keyframe_pose(armature_name: str, frame: int, bones: list | None = None) -> dict:
    obj = core._require_object(armature_name)
    if obj.type != "ARMATURE":
        raise ValueError(f"'{armature_name}' er ikke en armature")
    targets = bones or [b.name for b in obj.pose.bones]
    core._undo_push(f"keyframe_pose {armature_name} @ {frame}")
    keyed = []
    for bone_name in targets:
        pbone = obj.pose.bones.get(bone_name)
        if pbone is None:
            continue
        pbone.keyframe_insert(data_path="rotation_euler", frame=frame)
        pbone.keyframe_insert(data_path="location", frame=frame)
        keyed.append(bone_name)
    return {"armature": armature_name, "frame": frame, "bones": keyed}


def list_bones(armature_name: str) -> dict:
    obj = core._require_object(armature_name)
    if obj.type != "ARMATURE":
        raise ValueError(f"'{armature_name}' er ikke en armature")
    return {
        "armature": armature_name,
        "bones": [
            {"name": b.name, "parent": b.parent.name if b.parent else None}
            for b in obj.data.bones
        ],
    }


RIG_TOOLS = {
    "create_armature": {"level": "safe", "fn": create_armature, "description": "Lag armature. preset=humanoid_metarig (Rigify meta-rig, kall generate_rig etterpå) | simple_chain (bones=[{name,head,tail,parent?}]). Args: preset?, name?, bones?.", "mutates": True},
    "generate_rig": {"level": "modify", "fn": generate_rig, "description": "Bygg full kontroll-rig fra Rigify-metarig (rigify_generate). Args: armature_name. Returnerer navnet på generert rig.", "mutates": True},
    "skin_mesh": {"level": "modify", "fn": skin_mesh, "description": "Skinn mesh til armature m/ automatic weights (parent_set ARMATURE_AUTO). Args: mesh_name, armature_name.", "mutates": True},
    "pose_bone": {"level": "modify", "fn": pose_bone, "description": "Sett pose-bone rotasjon/posisjon. Args: armature_name, bone_name, rotation_euler_deg?, location?.", "mutates": True},
    "keyframe_pose": {"level": "modify", "fn": keyframe_pose, "description": "Sett keyframe på pose-bone(r) ved frame. Args: armature_name, frame, bones? (default: alle).", "mutates": True},
    "list_bones": {"level": "safe", "fn": list_bones, "description": "List bones + foreldre-hierarki på armature. Args: armature_name.", "mutates": False},
}
