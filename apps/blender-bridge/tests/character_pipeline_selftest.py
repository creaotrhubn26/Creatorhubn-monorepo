# character_pipeline_selftest.py — full "walking skeleton" gjennom hele
# kjeden: metarig -> stilisert kropp -> generate_rig -> skin -> pose+keyframe
# -> kamera/lys -> render_animation (mp4). Kjøres INNE i Blender:
#   blender --background --python apps/blender-bridge/tests/character_pipeline_selftest.py

import os
import sys
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "extension"))
import core  # noqa: E402
import rigging  # noqa: E402
import characters  # noqa: E402

import addon_utils  # noqa: E402
import bpy  # noqa: E402


def main() -> None:
    if not addon_utils.check("rigify")[1]:
        bpy.ops.preferences.addon_enable(module="rigify")

    # --- metarig + stilisert kropp (FØR generate_rig — trenger metarig-navn)
    rigging.create_armature(preset="humanoid_metarig", name="Metarig")
    body = characters.create_humanoid_body("Metarig", name="Doctor")
    assert body["parts"] >= 13, body  # torso+nakke+hode+2x(overarm,underarm,hånd,lår,legg,fot)
    body_obj = core._require_object("Doctor")
    assert body_obj.type == "MESH", body_obj.type

    # --- generate + skin
    generated = rigging.generate_rig("Metarig")
    rig_name = generated["generated_rig"]
    skin = rigging.skin_mesh("Doctor", rig_name)
    assert skin["parent_type"] == "ARMATURE_AUTO", skin
    assert len(body_obj.vertex_groups) > 0

    # --- pose + keyframe et par frames (enkel armsving-antydning)
    bones = rigging.list_bones(rig_name)["bones"]
    bone_names = sorted({b["name"] for b in bones})
    arm_bone = next((n for n in bone_names if "upper_arm_ik" in n.lower() or "upper_arm.l" in n.lower()), None)
    if arm_bone is None and bone_names:
        arm_bone = bone_names[0]
    assert arm_bone, "fant ingen pose-bone å teste med"
    rigging.keyframe_pose(rig_name, frame=1, bones=[arm_bone])
    rigging.pose_bone(rig_name, arm_bone, rotation_euler_deg=[0, 0, 25])
    rigging.keyframe_pose(rig_name, frame=12, bones=[arm_bone])

    # --- lys + kamera
    core.create_light(type="AREA", name="Key", location=[-2, -3, 3], energy=800)
    core.create_camera(name="Cam", location=[0, -3.5, 1.2], focal_length_mm=50)
    core.point_camera_at("Cam", "Doctor")

    # --- render_animation: kort klipp, EEVEE for CI-fart
    out = os.path.join(tempfile.gettempdir(), "bridge_character_pipeline.mp4")
    result = core.render_animation(filepath=out, start_frame=1, end_frame=12, fps=12, resolution=270, engine="EEVEE")
    assert os.path.exists(result["rendered"]), result
    assert os.path.getsize(result["rendered"]) > 0, result
    assert result["frames"] == 12, result

    print("CHARACTER PIPELINE SELFTEST PASSED —", result["rendered"], os.path.getsize(result["rendered"]), "bytes")


try:
    main()
except Exception as exc:  # noqa: BLE001
    import traceback
    traceback.print_exc()
    print(f"CHARACTER PIPELINE SELFTEST FAILED: {exc}")
    sys.exit(1)
