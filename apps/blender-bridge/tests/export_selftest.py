# export_selftest.py — eksport-pipelinen mot ekte bpy:
#   blender --background --python apps/blender-bridge/tests/export_selftest.py

import json
import os
import sys
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "extension"))
import core  # noqa: E402
import studio_kit as kit  # noqa: E402
import export_pipeline as pipeline  # noqa: E402


def main() -> None:
    tmp = os.path.join(tempfile.gettempdir(), "bridge_export_test")

    kit.create_studio(width=6, depth=8, height=4)
    kit.add_softbox("KEY_LIGHT", [-2.2, -1.8, 2.4], size=1.2,
                    temperature=5600, power=700, aim_at=[0, 0, 1.5])
    kit.add_camera_rig("CAMERA_A", position=[0, -5, 1.5], focal_length=85, f_stop=2.0)

    result = pipeline.export_studio_package(tmp, name="test")
    assert set(result["files"]) == {"test.usdz", "test.glb", "test.manifest.json"}, result
    for filename in result["files"]:
        path = os.path.join(tmp, filename)
        assert os.path.getsize(path) > 500, (filename, os.path.getsize(path))

    manifest = json.load(open(os.path.join(tmp, "test.manifest.json")))
    assert manifest["version"] == 1
    by_name = {a["name"]: a for a in manifest["assets"]}
    key = by_name["KEY_LIGHT"]
    assert key["meta"]["type"] == "light" and key["meta"]["category"] == "softbox"
    assert key["meta"]["default_kelvin"] == 5600 and key["meta"]["power"] == 700
    assert key["light"]["type"] == "AREA" and abs(key["light"]["energy"] - 700) < 0.01
    cam = by_name["CAMERA_A_RIG"]
    assert cam["camera"]["focal_length_mm"] == 85 and cam["camera"]["sensor_width_mm"] == 36.0
    assert by_name["FLOOR"]["meta"]["category"] == "floor"

    # collection-eksport + feilhåndtering
    coll = pipeline.export_collection("LIGHTING", os.path.join(tmp, "lighting.glb"))
    assert coll["bytes"] > 100 and any("KEY_LIGHT" in o for o in coll["objects"])
    try:
        pipeline.export_scene_file(os.path.join(tmp, "x.stl"))
        raise AssertionError("ustøttet format skulle feile")
    except ValueError:
        pass
    try:
        pipeline.export_collection("FINNES_IKKE", os.path.join(tmp, "y.glb"))
        raise AssertionError("ukjent collection skulle feile")
    except ValueError:
        pass

    print("EXPORT SELFTEST PASSED")


try:
    main()
except Exception as exc:  # noqa: BLE001
    import traceback
    traceback.print_exc()
    print(f"EXPORT SELFTEST FAILED: {exc}")
    sys.exit(1)
