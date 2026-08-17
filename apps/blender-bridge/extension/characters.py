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


def _cone_between(head: Vector, tail: Vector, radius1: float, radius2: float, name: str) -> "bpy.types.Object":
    """Som _cylinder_between, men med to radier (tapered) — radius1 ved
    `head`, radius2 ved `tail`. Gir skuldre/midje-taper i stedet for et rør."""
    direction = tail - head
    length = max(direction.length, 0.01)
    bpy.ops.mesh.primitive_cone_add(radius1=radius1, radius2=radius2, depth=length, location=(head + tail) / 2)
    obj = bpy.context.active_object
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(direction.normalized())
    obj.name = name
    return obj


def _sphere_at(location: Vector, radius: float, name: str, scale: tuple | None = None) -> "bpy.types.Object":
    bpy.ops.mesh.primitive_uv_sphere_add(radius=radius, location=location)
    obj = bpy.context.active_object
    obj.name = name
    if scale:
        obj.scale = Vector(scale)
    return obj


def _box_at(location: Vector, size: tuple, name: str) -> "bpy.types.Object":
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.active_object
    obj.scale = Vector(size)
    obj.name = name
    return obj


def _ensure_material(name: str, base_color: list, roughness: float | None = None) -> str:
    if bpy.data.materials.get(name) is None:
        core.create_material(name, base_color=base_color, roughness=roughness)
    return name


def _child_of_bone(obj, armature_obj, bone_name: str) -> None:
    """Fest `obj` til en pose-bone uten å hoppe i posisjon — objektet blir
    værende der det står nå, men følger bonen når den senere poseres/animeres."""
    con = obj.constraints.new("CHILD_OF")
    con.target = armature_obj
    con.subtarget = bone_name
    con.inverse_matrix = (armature_obj.matrix_world @ armature_obj.pose.bones[bone_name].matrix).inverted()


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
        # Tapered i stedet for rett rør: smalere midje, bredere skuldre — leser
        # umiddelbart mer menneskelig enn en uniform sylinder.
        _cone_between(head("spine"), torso_top, r_torso * 0.72, r_torso * 1.18, "Torso"),
        _cylinder_between(torso_top, head_top, r_neck, "Neck"),
        # Hodet: egg-form (høyere enn bredt) i stedet for perfekt kule.
        _sphere_at(head_top + Vector((0, 0, r_head * 0.8)), r_head, "Head", scale=(1.0, 0.94, 1.16)),
    ]
    for side in ("L", "R"):
        if head(f"upper_arm.{side}"):
            parts.append(_cylinder_between(head(f"upper_arm.{side}"), tail(f"upper_arm.{side}"), r_upper_arm, f"UpperArm.{side}"))
        if head(f"forearm.{side}"):
            parts.append(_cylinder_between(head(f"forearm.{side}"), tail(f"forearm.{side}"), r_forearm, f"Forearm.{side}"))
        hand_pt = tail(f"hand.{side}") or tail(f"forearm.{side}")
        if hand_pt:
            # Flatet i stedet for en perfekt kule — leser mer som en hånd, mindre som et kuleledd.
            parts.append(_sphere_at(hand_pt, r_hand, f"Hand.{side}", scale=(1.15, 0.85, 0.7)))
        if head(f"thigh.{side}"):
            parts.append(_cylinder_between(head(f"thigh.{side}"), tail(f"thigh.{side}"), r_thigh, f"Thigh.{side}"))
        if head(f"shin.{side}"):
            parts.append(_cylinder_between(head(f"shin.{side}"), tail(f"shin.{side}"), r_shin, f"Shin.{side}"))
        foot_pt = head(f"foot.{side}")
        if foot_pt:
            parts.append(_sphere_at(foot_pt, r_foot, f"Foot.{side}", scale=(1.0, 1.4, 0.75)))

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


def attach_face_and_hair(rig_name: str, name_prefix: str = "", hair_color: list | None = None) -> dict:
    """Legg øyne+munn+hår på figuren — små egne objekter festet til
    'head'-bonen på DEN GENERERTE riggen (CHILD_OF, ikke del av kroppsmeshen,
    så de trenger ingen skinning og følger automatisk med når hodet poseres).
    Kall ETTER generate_rig+skin_mesh. Args: rig_name (generert rig),
    name_prefix? (unikt per figur, f.eks. "Doctor_"), hair_color? [r,g,b]."""
    rig_obj = core._require_object(rig_name)
    if rig_obj.type != "ARMATURE":
        raise ValueError(f"'{rig_name}' er ikke en armature")
    head_bone = rig_obj.pose.bones.get("head")
    if head_bone is None:
        candidates = sorted(
            b.name for b in rig_obj.pose.bones
            if "head" in b.name.lower() and not b.name.startswith(("DEF-", "MCH-", "ORG-"))
        )
        raise ValueError(f"fant ikke 'head'-bone på '{rig_name}' — kandidater: {candidates}")
    core._undo_push(f"attach_face_and_hair {rig_name}")

    # head_bone.head sitter ved nakkebasen — TAIL er der skallen begynner
    # (samme punkt create_humanoid_body bygger hode-kulen ut fra). matrix.translation
    # peker feil (nakke-høyde), derfor .tail her, ikke .matrix.
    height = rig_obj.dimensions.z or 1.8
    r_head = height * 0.055
    skull_base = rig_obj.matrix_world @ Vector(head_bone.tail)
    face_center = skull_base + Vector((0, 0, r_head * 0.8))
    scale = height / 1.98  # skaler ansiktsdetaljer proporsjonalt med figurhøyden

    dark = _ensure_material(f"{name_prefix}FaceDarkMat", [0.06, 0.05, 0.05], roughness=0.35)
    hair_mat = _ensure_material(f"{name_prefix}HairMat", hair_color or [0.25, 0.16, 0.10], roughness=0.55)

    created = []
    for side, x in (("L", -0.04 * scale), ("R", 0.04 * scale)):
        eye = _sphere_at(face_center + Vector((x, -0.08 * scale, 0.015 * scale)), 0.018 * scale, f"{name_prefix}Eye.{side}")
        core.assign_material(eye.name, dark)
        _child_of_bone(eye, rig_obj, "head")
        created.append(eye.name)

    mouth = _box_at(face_center + Vector((0, -0.09 * scale, -0.06 * scale)), (0.04 * scale, 0.018 * scale, 0.016 * scale), f"{name_prefix}Mouth")
    core.assign_material(mouth.name, dark)
    _child_of_bone(mouth, rig_obj, "head")
    created.append(mouth.name)

    hair = _sphere_at(face_center + Vector((0, 0.02 * scale, 0.09 * scale)), 0.085 * scale, f"{name_prefix}Hair", scale=(1.05, 1.0, 0.9))
    core.assign_material(hair.name, hair_mat)
    _child_of_bone(hair, rig_obj, "head")
    created.append(hair.name)

    return {"rig": rig_name, "created": created}


CHARACTER_TOOLS = {
    "create_humanoid_body": {
        "level": "safe",
        "fn": create_humanoid_body,
        "description": "Bygg stilisert kapsel-kropp (tapered torso, egg-hode, flatede hender, bevel+shade_smooth) size-matchet mot en humanoid_metarig. Args: armature_name (metarig, FØR generate_rig), name?. Skinn til DEN GENERERTE riggen etterpå med skin_mesh.",
        "mutates": True,
    },
    "attach_face_and_hair": {
        "level": "safe",
        "fn": attach_face_and_hair,
        "description": "Legg øyne+munn+hår på figuren, festet (CHILD_OF) til 'head'-bonen på DEN GENERERTE riggen — følger automatisk med når hodet poseres. Args: rig_name (generert rig, ETTER generate_rig+skin_mesh), name_prefix? (unikt per figur), hair_color? [r,g,b].",
        "mutates": True,
    },
}
