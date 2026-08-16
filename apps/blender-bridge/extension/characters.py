# characters.py — stilisert kroppsmesh bygget fra primitiver, størrelsestilpasset
# en Rigify humanoid_metarig sine faktiske bein. Ingen eksterne assets: kapsel-
# figur (sylindre + kuler), bevel+shade_smooth gir den avrundede "premium"-looken.

from __future__ import annotations

import bpy
from mathutils import Vector

try:
    from . import core
except ImportError:  # flat import i headless-testene
    import core
try:
    from . import assets as _assets
except ImportError:
    import assets as _assets


def _cylinder_between(head: Vector, tail: Vector, radius: float, name: str) -> "bpy.types.Object":
    direction = tail - head
    length = max(direction.length, 0.01)
    bpy.ops.mesh.primitive_cylinder_add(radius=radius, depth=length, location=(head + tail) / 2)
    obj = bpy.context.active_object
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(direction.normalized())
    obj.name = name
    return obj


def _sphere_at(location: Vector, radius: float, name: str) -> "bpy.types.Object":
    bpy.ops.mesh.primitive_uv_sphere_add(radius=radius, location=location)
    obj = bpy.context.active_object
    obj.name = name
    return obj


_REQUIRED_BONES = ("spine", "upper_arm.L", "thigh.L")


def create_humanoid_body(armature_name: str, name: str | None = None) -> dict:
    """Bygg stilisert kapsel-kropp (sylindre+kuler) size-matchet mot en
    Rigify humanoid_metarig sine bein. Kall FØR generate_rig — trenger
    metarig-navnene (spine, upper_arm.L, ...), ikke den genererte riggens
    DEF-*-navn. Skinn til den GENERERTE riggen etterpå med skin_mesh."""
    arm_obj = core._require_object(armature_name)
    if arm_obj.type != "ARMATURE":
        raise ValueError(f"'{armature_name}' er ikke en armature")
    bones = arm_obj.data.bones
    if any(bones.get(b) is None for b in _REQUIRED_BONES):
        raise ValueError(
            f"'{armature_name}' mangler forventede Rigify-bones {_REQUIRED_BONES} — "
            "bruk create_armature(preset='humanoid_metarig') FØR generate_rig"
        )
    core._undo_push(f"create_humanoid_body {armature_name}")

    def world(local_pt) -> Vector:
        return arm_obj.matrix_world @ Vector(local_pt)

    def head(bname):
        b = bones.get(bname)
        return world(b.head_local) if b else None

    def tail(bname):
        b = bones.get(bname)
        return world(b.tail_local) if b else None

    height = arm_obj.dimensions.z or 1.8
    r_torso, r_neck, r_head = height * 0.09, height * 0.035, height * 0.055
    r_upper_arm, r_forearm, r_hand = height * 0.032, height * 0.026, height * 0.03
    r_thigh, r_shin, r_foot = height * 0.055, height * 0.04, height * 0.035

    torso_top = tail("spine.004") or tail("spine.003") or tail("spine.002")
    head_top = tail("spine.006") or tail("spine.005") or torso_top

    parts = [
        _cylinder_between(head("spine"), torso_top, r_torso, "Torso"),
        _cylinder_between(torso_top, head_top, r_neck, "Neck"),
        _sphere_at(head_top + Vector((0, 0, r_head * 0.8)), r_head, "Head"),
    ]
    for side in ("L", "R"):
        if head(f"upper_arm.{side}"):
            parts.append(_cylinder_between(head(f"upper_arm.{side}"), tail(f"upper_arm.{side}"), r_upper_arm, f"UpperArm.{side}"))
        if head(f"forearm.{side}"):
            parts.append(_cylinder_between(head(f"forearm.{side}"), tail(f"forearm.{side}"), r_forearm, f"Forearm.{side}"))
        hand_pt = tail(f"hand.{side}") or tail(f"forearm.{side}")
        if hand_pt:
            parts.append(_sphere_at(hand_pt, r_hand, f"Hand.{side}"))
        if head(f"thigh.{side}"):
            parts.append(_cylinder_between(head(f"thigh.{side}"), tail(f"thigh.{side}"), r_thigh, f"Thigh.{side}"))
        if head(f"shin.{side}"):
            parts.append(_cylinder_between(head(f"shin.{side}"), tail(f"shin.{side}"), r_shin, f"Shin.{side}"))
        foot_pt = head(f"foot.{side}")
        if foot_pt:
            parts.append(_sphere_at(foot_pt, r_foot, f"Foot.{side}"))

    for o in bpy.context.selected_objects:
        o.select_set(False)
    for p in parts:
        p.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    body = bpy.context.active_object
    if name:
        body.name = name
    _assets.add_modifier(body.name, "bevel", {"width": height * 0.012, "segments": 3})
    _assets.shade_smooth(body.name)
    return {"created": body.name, "type": body.type, "armature": armature_name, "parts": len(parts)}


CHARACTER_TOOLS = {
    "create_humanoid_body": {
        "level": "safe",
        "fn": create_humanoid_body,
        "description": "Bygg stilisert kapsel-kropp (sylindre+kuler, bevel+shade_smooth) size-matchet mot en humanoid_metarig. Args: armature_name (metarig, FØR generate_rig), name?. Skinn til DEN GENERERTE riggen etterpå med skin_mesh.",
        "mutates": True,
    },
}
