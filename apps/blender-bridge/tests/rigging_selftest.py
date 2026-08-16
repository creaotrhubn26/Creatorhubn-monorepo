# rigging_selftest.py — rigging-verktøyene mot ekte bpy:
#   blender --background --python apps/blender-bridge/tests/rigging_selftest.py

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "extension"))
import core  # noqa: E402
import rigging  # noqa: E402

import addon_utils  # noqa: E402
import bpy  # noqa: E402


def main() -> None:
    if not addon_utils.check("rigify")[1]:
        bpy.ops.preferences.addon_enable(module="rigify")

    # --- humanoid_metarig → generate_rig
    created = rigging.create_armature(preset="humanoid_metarig", name="TestMetarig")
    assert created["created"] == "TestMetarig", created
    assert created["type"] == "ARMATURE", created

    generated = rigging.generate_rig("TestMetarig")
    rig_name = generated["generated_rig"]
    assert rig_name, generated
    rig_obj = core._require_object(rig_name)
    assert rig_obj.type == "ARMATURE", rig_obj.type

    # --- skin_mesh: automatic weights parents mesh under armature + adds modifier
    core.create_object("cube", name="TestMesh", location=[0, 0, 1])
    mesh_obj = core._require_object("TestMesh")
    mesh_obj.scale = (1.5, 1.0, 4.0)
    skin = rigging.skin_mesh("TestMesh", rig_name)
    assert skin["parent_type"] == "ARMATURE_AUTO", skin
    assert mesh_obj.parent is not None and mesh_obj.parent.name == rig_name, mesh_obj.parent
    assert any(m.type == "ARMATURE" for m in mesh_obj.modifiers), [m.type for m in mesh_obj.modifiers]
    assert len(mesh_obj.vertex_groups) > 0, "automatic weights skulle laget vertex groups"

    # --- list_bones + pose_bone + keyframe_pose on the generated control rig
    bones = rigging.list_bones(rig_name)["bones"]
    assert len(bones) > 10, len(bones)  # Rigify human rig har mange kontroll-bones
    target_bone = bones[0]["name"]

    posed = rigging.pose_bone(rig_name, target_bone, rotation_euler_deg=[0, 0, 30])
    assert abs(posed["rotation_euler_deg"][2] - 30) < 0.01, posed

    keyed = rigging.keyframe_pose(rig_name, frame=10, bones=[target_bone])
    assert keyed["bones"] == [target_bone], keyed
    assert rig_obj.animation_data is not None and rig_obj.animation_data.action is not None
    action = rig_obj.animation_data.action
    fcurve_frames = {
        kp.co[0]
        for layer in action.layers
        for strip in layer.strips
        for channelbag in strip.channelbags
        for fc in channelbag.fcurves
        for kp in fc.keyframe_points
    }
    assert 10.0 in fcurve_frames, fcurve_frames

    # --- simple_chain preset
    chain = rigging.create_armature(
        preset="simple_chain",
        name="TestChain",
        bones=[
            {"name": "Root", "head": [0, 0, 0], "tail": [0, 0, 1]},
            {"name": "Child", "head": [0, 0, 1], "tail": [0, 0, 2], "parent": "Root"},
        ],
    )
    assert chain["created"] == "TestChain", chain
    chain_bones = rigging.list_bones("TestChain")["bones"]
    assert {b["name"]: b["parent"] for b in chain_bones} == {"Root": None, "Child": "Root"}, chain_bones

    # --- error paths
    try:
        rigging.create_armature(preset="not_a_preset")
        raise AssertionError("ukjent preset skulle feile")
    except ValueError:
        pass
    try:
        rigging.create_armature(preset="simple_chain")
        raise AssertionError("simple_chain uten bones skulle feile")
    except ValueError:
        pass
    try:
        rigging.pose_bone(rig_name, "IkkeEnBone")
        raise AssertionError("ukjent bone skulle feile")
    except ValueError:
        pass
    try:
        rigging.skin_mesh(rig_name, "TestMesh")  # byttet om — armature er ikke mesh
        raise AssertionError("feil objekttype skulle feile")
    except ValueError:
        pass

    print("RIGGING SELFTEST PASSED")


try:
    main()
except Exception as exc:  # noqa: BLE001
    import traceback
    traceback.print_exc()
    print(f"RIGGING SELFTEST FAILED: {exc}")
    sys.exit(1)
