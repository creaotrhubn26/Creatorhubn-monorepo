# assets_selftest.py — fase 8-verktøyene mot ekte bpy:
#   blender --background --python apps/blender-bridge/tests/assets_selftest.py

import os
import sys
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "extension"))
import core  # noqa: E402
import geometry_nodes as gn  # noqa: E402
import assets  # noqa: E402

import bpy  # noqa: E402


def main() -> None:
    tmp = tempfile.gettempdir()

    # --- modifiers: bevel + subsurf øker evaluert geometri
    core.create_object("cube", name="Hero", location=[0, 0, 1])
    base = gn.evaluated_stats("Hero")["vertices"]
    assets.add_modifier("Hero", "bevel", {"width": 0.05, "segments": 3})
    beveled = gn.evaluated_stats("Hero")["vertices"]
    assert beveled > base, (base, beveled)
    assets.add_modifier("Hero", "subdivision", {"viewport_levels": 2, "render_levels": 2})
    subdivided = gn.evaluated_stats("Hero")["vertices"]
    assert subdivided > beveled, (beveled, subdivided)
    assets.shade_smooth("Hero")

    # apply_modifier baker inn i base-meshen
    base_mesh_before = len(core._require_object("Hero").data.vertices)
    assets.apply_modifier("Hero", "Bevel")
    base_mesh_after = len(core._require_object("Hero").data.vertices)
    assert base_mesh_after > base_mesh_before, (base_mesh_before, base_mesh_after)
    try:
        assets.apply_modifier("Hero", "FinnesIkke")
        raise AssertionError("ukjent modifier skulle feile")
    except ValueError:
        pass

    # --- eksport→import roundtrip (GLB)
    glb = os.path.join(tmp, "bridge_asset_test.glb")
    with bpy.context.temp_override(selected_objects=[core._require_object("Hero")]):
        bpy.ops.export_scene.gltf(filepath=glb, use_selection=True)
    result = assets.import_asset(glb, name_prefix="Imported")
    assert result["imported"], result
    assert any(n.startswith("Imported") for n in result["imported"]), result
    try:
        assets.import_asset("/tmp/finnes-ikke.glb")
        raise AssertionError("manglende fil skulle feile")
    except ValueError:
        pass
    try:
        assets.import_asset(__file__)
        raise AssertionError("ustøttet format skulle feile")
    except ValueError:
        pass

    # --- tekstur: lag et lite bilde, koble til Base Color + Roughness + Normal
    img = bpy.data.images.new("TestTex", width=8, height=8)
    png = os.path.join(tmp, "bridge_tex.png")
    img.filepath_raw = png
    img.file_format = "PNG"
    img.save()
    core.create_material("MAT_Tex", base_color=[0.5, 0.5, 0.5])
    assets.set_material_texture("MAT_Tex", "Base Color", png)
    assets.set_material_texture("MAT_Tex", "Roughness", png)
    assets.set_material_texture("MAT_Tex", "Normal", png)
    mat = bpy.data.materials["MAT_Tex"]
    types = [n.type for n in mat.node_tree.nodes]
    assert types.count("TEX_IMAGE") == 3, types
    assert "NORMAL_MAP" in types, types
    # roughness-teksturen skal være Non-Color
    non_color = [n for n in mat.node_tree.nodes if n.type == "TEX_IMAGE"
                 and n.image.colorspace_settings.name == "Non-Color"]
    assert len(non_color) == 2, [n.image.colorspace_settings.name for n in mat.node_tree.nodes if n.type == "TEX_IMAGE"]

    # --- world: HDRI-graf + farge
    assets.set_world_hdri(png, strength=1.5, rotation_deg=90)
    world_types = [n.type for n in bpy.context.scene.world.node_tree.nodes]
    for expected in ("TEX_ENVIRONMENT", "BACKGROUND", "MAPPING", "TEX_COORD", "OUTPUT_WORLD"):
        assert expected in world_types, world_types
    assets.set_world_color([0.02, 0.02, 0.03], strength=0.8)

    print("ASSETS SELFTEST PASSED")


try:
    main()
except Exception as exc:  # noqa: BLE001
    import traceback
    traceback.print_exc()
    print(f"ASSETS SELFTEST FAILED: {exc}")
    sys.exit(1)
