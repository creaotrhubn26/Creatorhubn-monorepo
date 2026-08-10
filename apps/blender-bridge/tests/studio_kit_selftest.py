# studio_kit_selftest.py — Studio Kit mot ekte bpy:
#   blender --background --python apps/blender-bridge/tests/studio_kit_selftest.py

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "extension"))
import core  # noqa: E402
import studio_kit as kit  # noqa: E402

import bpy  # noqa: E402


def main() -> None:
    # rommet: reelle mål + collections-disiplin
    result = kit.create_studio(width=6, depth=8, height=4)
    assert "FLOOR" in result["objects"]
    floor = bpy.data.objects["FLOOR"]
    assert abs(floor.dimensions.x - 6.0) < 0.01, floor.dimensions
    assert abs(floor.dimensions.y - 8.0) < 0.01
    assert floor["rr_type"] == "architecture"
    root = bpy.data.collections["PHOTO_STUDIO"]
    assert "ARCHITECTURE" in [c.name for c in root.children]
    assert floor.name in [o.name for o in bpy.data.collections["ARCHITECTURE"].objects]

    # cyclorama: kurvet, hvit, smooth
    cyc = kit.add_cyclorama(width=5, height=3, location_y=3.5)
    obj = bpy.data.objects["CYC_WALL"]
    assert abs(obj.dimensions.x - 5.0) < 0.01, obj.dimensions
    assert obj.dimensions.z >= 2.9
    assert all(p.use_smooth for p in obj.data.polygons)
    assert obj["rr_category"] == "cyclorama"

    # softbox-rigg: root + body + diffusjon + EKTE lys + metadata
    box = kit.add_softbox("KEY_TEST", [-2.2, -1.8, 2.4], size=1.2,
                          temperature=5600, power=700, aim_at=[0, 0, 1.5])
    root_obj = bpy.data.objects["KEY_TEST"]
    assert root_obj["rr_type"] == "light" and root_obj["rr_power"] == 700
    light = bpy.data.objects["KEY_TEST_Light"]
    assert light.type == "LIGHT" and light.data.type == "AREA"
    assert abs(light.data.size - 1.2) < 0.01
    assert abs(light.data.energy - 700) < 0.01
    assert light.parent == root_obj
    # 5600K skal være varm-hvit: r > b
    r, g, b = light.data.color
    assert r > b, (r, g, b)

    # kamera-rigg: fysisk korrekt + aktiv
    cam = kit.add_camera_rig("CAMERA_A", position=[0, -5, 1.5],
                             focal_length=50, f_stop=2.8, aim_at=[0, 0, 1.4])
    render_cam = bpy.data.objects["CAMERA_A_RENDER"]
    assert bpy.context.scene.camera == render_cam
    assert render_cam.data.sensor_width == 36.0
    assert render_cam.data.dof.use_dof and abs(render_cam.data.dof.aperture_fstop - 2.8) < 0.01
    assert render_cam.parent == bpy.data.objects["CAMERA_A_RIG"]

    # preset: beauty = 3 rigger, alle i LIGHTING/GRIP-collections
    preset = kit.apply_lighting_preset("beauty", subject_position=[0, 2.0, 1.6])
    assert set(preset["created"]) == {"BEAUTY_KEY", "FILL_UNDER", "HAIR_LIGHT"}
    assert bpy.data.objects["BEAUTY_KEY_Light"].data.type == "AREA"
    try:
        kit.apply_lighting_preset("finnes-ikke")
        raise AssertionError("ukjent preset skulle feile")
    except ValueError:
        pass

    # verktøyene er i katalogen
    for name in ["create_studio", "add_cyclorama", "add_softbox", "add_camera_rig",
                 "apply_lighting_preset", "add_reflector"]:
        assert name in core.TOOLS, name

    print("STUDIO KIT SELFTEST PASSED")


try:
    main()
except Exception as exc:  # noqa: BLE001
    import traceback
    traceback.print_exc()
    print(f"STUDIO KIT SELFTEST FAILED: {exc}")
    sys.exit(1)
