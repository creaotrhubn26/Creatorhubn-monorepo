# gn_selftest.py — bygger dokumentets §14-eksempel headless:
# parametrisk rekke (Mesh Line → Instance on Points → Realize) m/ eksponert
# «Count», og verifiserer at parameteren FAKTISK endrer evaluert geometri.
#   blender --background --python apps/blender-bridge/tests/gn_selftest.py

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "extension"))
import core  # noqa: E402
import geometry_nodes as gn  # noqa: E402


def main() -> None:
    core.create_object("empty", name="RowHost")
    # GN-modifier trenger mesh-objekt — bruk plane
    core.delete_object("RowHost")
    core.create_object("plane", name="Row")

    gn.create_geometry_nodes("Row", "ParametricRow")
    gn.add_node("ParametricRow", "GeometryNodeMeshLine", name="Line", location=[-200, 0])
    gn.add_node("ParametricRow", "GeometryNodeMeshCube", name="CubeSrc", location=[-200, -200])
    gn.add_node("ParametricRow", "GeometryNodeInstanceOnPoints", name="Instance", location=[0, 0])
    gn.add_node("ParametricRow", "GeometryNodeRealizeInstances", name="Realize", location=[200, 0])

    gn.connect_nodes("ParametricRow", "Line", "Mesh", "Instance", "Points")
    gn.connect_nodes("ParametricRow", "CubeSrc", "Mesh", "Instance", "Instance")
    gn.connect_nodes("ParametricRow", "Instance", "Instances", "Realize", "Geometry")
    gn.connect_nodes("ParametricRow", "Realize", "Geometry", "Group Output", "Geometry")

    gn.set_node_input("ParametricRow", "CubeSrc", "Size", [0.4, 0.4, 0.4])
    gn.expose_parameter("ParametricRow", "Line", "Count", "Count",
                        socket_type="int", default=3)

    graph = gn.get_node_graph("ParametricRow")
    assert any(p["name"] == "Count" for p in graph["exposed_inputs"]), graph["exposed_inputs"]
    assert len(graph["links"]) == 5, graph["links"]  # 4 + Group Input→Line

    gn.set_gn_parameter("Row", "Count", 5)
    stats5 = gn.evaluated_stats("Row")
    gn.set_gn_parameter("Row", "Count", 9)
    stats9 = gn.evaluated_stats("Row")
    # 8 verts per kube — parameteren skal drive geometrien
    assert stats5["vertices"] == 5 * 8, stats5
    assert stats9["vertices"] == 9 * 8, stats9

    # feilhåndtering
    try:
        gn.set_gn_parameter("Row", "FinnesIkke", 1)
        raise AssertionError("ukjent parameter skulle feile")
    except ValueError:
        pass
    try:
        gn.add_node("ParametricRow", "CompositorNodeBlur")
        raise AssertionError("ikke-tillatt node-type skulle feile")
    except ValueError:
        pass

    # resource
    import resources
    uris = [r["uri"] for r in resources.list_resources()]
    assert "blender://geometry-nodes/ParametricRow" in uris, uris
    resolved = resources.resolve("blender://geometry-nodes/ParametricRow")
    assert resolved["group"] == "ParametricRow"

    print("GN SELFTEST PASSED")


try:
    main()
except Exception as exc:  # noqa: BLE001
    import traceback; traceback.print_exc()
    print(f"GN SELFTEST FAILED: {exc}")
    sys.exit(1)
