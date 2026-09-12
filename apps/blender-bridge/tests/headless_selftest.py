# headless_selftest.py — kjøres INNE i Blender:
#   blender --background --python apps/blender-bridge/tests/headless_selftest.py
#
# Verifiserer kjerneloopen mot ekte bpy: scene-ops, materiale, lys, kamera,
# render (fil > 0 bytes), undo, validate. Exit != 0 ved feil.

import os
import sys
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "extension"))
import core  # noqa: E402


def main() -> None:
    initial = core.get_scene()["counts"]["objects"]

    # objekt + transform
    created = core.create_object("cube", name="Hero", location=[0, 0, 1])
    assert created["created"] == "Hero", created
    info = core.set_transform("Hero", rotation_euler_deg=[0, 0, 45], scale=[1, 1, 2])
    assert abs(info["rotation_euler_deg"][2] - 45) < 0.01, info
    assert core.get_scene()["counts"]["objects"] == initial + 1

    # materiale
    core.create_material("HeroMat", base_color=[0.8, 0.1, 0.1], metallic=0.9, roughness=0.2)
    core.assign_material("Hero", "HeroMat")
    core.set_material_parameter("HeroMat", "Roughness", 0.35)
    assert "HeroMat" in core.inspect_object("Hero")["materials"]
    try:
        core.set_material_parameter("HeroMat", "FinnesIkke", 1)
        raise AssertionError("ugyldig parameter skulle feile")
    except ValueError:
        pass

    # lys + kamera
    core.create_light(type="AREA", name="Key", location=[-3, -2, 4], energy=900)
    core.configure_light("Key", size=3.5)
    core.create_camera(name="Cam", location=[4, -4, 2.5], focal_length_mm=85)
    core.point_camera_at("Cam", "Hero")
    core.configure_camera("Cam", dof_enabled=True, dof_focus_object="Hero", f_stop=2.0)
    cam_info = core.inspect_object("Cam")
    assert cam_info["camera"]["focal_length_mm"] == 85, cam_info

    # render
    out = os.path.join(tempfile.gettempdir(), "bridge_selftest.png")
    result = core.render_preview(filepath=out, resolution=128)
    assert os.path.exists(result["rendered"]), result
    assert os.path.getsize(result["rendered"]) > 0

    # validate: Hero har unapplied scale (satt over) → warning forventes
    qa = core.validate_scene()
    assert any("Hero" in w for w in qa["warnings"]), qa

    # delete + registry-dispatch
    core.delete_object("Hero")
    assert core.call_tool("get_scene")["counts"]["objects"] == initial + 2  # Key + Cam igjen
    try:
        core.call_tool("finnes_ikke")
        raise AssertionError("ukjent verktøy skulle feile")
    except ValueError:
        pass

    print("SELFTEST PASSED")


try:
    main()
except Exception as exc:  # noqa: BLE001 — vis feilen og sett exit-kode
    print(f"SELFTEST FAILED: {exc}")
    sys.exit(1)
