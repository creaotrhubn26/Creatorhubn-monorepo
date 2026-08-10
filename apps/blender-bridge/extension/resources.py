# resources.py — scene-resources (arkitekturdokumentets §5-6).
#
# Eksponerer Blender-tilstand som adresserbare, strukturerte ressurser så
# Claude kan hente KUN den delen av scene-grafen som er relevant:
#
#   blender://scene              blender://selection
#   blender://context            blender://render/settings
#   blender://object/<navn>      blender://material/<navn>
#   blender://camera/<navn>      blender://collection/<navn>
#
# Statiske ressurser listes alltid; dynamiske (object/material/…) listes med
# gjeldende forekomster. resolve() tar en vilkårlig URI.

from __future__ import annotations

import math

import bpy

try:
    from . import core
except ImportError:  # flat import i headless-selvtesten
    import core


def list_resources() -> list[dict]:
    resources = [
        {"uri": "blender://scene", "name": "Scene-oversikt"},
        {"uri": "blender://selection", "name": "Gjeldende selection"},
        {"uri": "blender://context", "name": "Blender-kontekst (mode/workspace/frame)"},
        {"uri": "blender://render/settings", "name": "Render-innstillinger"},
    ]
    for obj in bpy.context.scene.objects:
        resources.append({"uri": f"blender://object/{obj.name}", "name": f"{obj.type}: {obj.name}"})
    for mat in bpy.data.materials:
        resources.append({"uri": f"blender://material/{mat.name}", "name": f"Materiale: {mat.name}"})
    for tree in bpy.data.node_groups:
        if tree.bl_idname == "GeometryNodeTree":
            resources.append({"uri": f"blender://geometry-nodes/{tree.name}",
                              "name": f"Geometry Nodes: {tree.name}"})
    for coll in bpy.data.collections:
        resources.append({"uri": f"blender://collection/{coll.name}", "name": f"Collection: {coll.name}"})
    return resources


def resolve(uri: str) -> dict:
    if not uri.startswith("blender://"):
        raise ValueError(f"ugyldig uri '{uri}' — må starte med blender://")
    path = uri[len("blender://"):]
    if path == "scene":
        return core.get_scene()
    if path == "selection":
        return core.get_selection()
    if path == "context":
        return get_context()
    if path == "render/settings":
        return get_render_settings()
    if path.startswith("object/"):
        return core.inspect_object(path[len("object/"):])
    if path.startswith("camera/"):
        return core.inspect_object(path[len("camera/"):])
    if path.startswith("material/"):
        return get_material(path[len("material/"):])
    if path.startswith("geometry-nodes/"):
        try:
            from . import geometry_nodes
        except ImportError:
            import geometry_nodes
        return geometry_nodes.get_node_graph(path[len("geometry-nodes/"):])
    if path.startswith("collection/"):
        return get_collection(path[len("collection/"):])
    raise ValueError(f"ukjent ressurs '{uri}'")


def get_context() -> dict:
    ctx = bpy.context
    scene = ctx.scene
    # workspace/skjerm finnes ikke i --background — grasiøst fravær.
    workspace = getattr(getattr(ctx, "workspace", None), "name", None)
    active = ctx.view_layer.objects.active
    return {
        "workspace": workspace,
        "mode": ctx.mode,
        "active_object": active.name if active else None,
        "selected_objects": [o.name for o in ctx.selected_objects],
        "active_collection": ctx.view_layer.active_layer_collection.name
        if ctx.view_layer.active_layer_collection else None,
        "current_frame": scene.frame_current,
        "camera": scene.camera.name if scene.camera else None,
        "render_engine": scene.render.engine,
    }


def get_render_settings() -> dict:
    render = bpy.context.scene.render
    return {
        "engine": render.engine,
        "resolution": [render.resolution_x, render.resolution_y],
        "resolution_percentage": render.resolution_percentage,
        "fps": render.fps,
        "filepath": render.filepath,
        "film_transparent": render.film_transparent,
    }


def get_material(name: str) -> dict:
    mat = bpy.data.materials.get(name)
    if mat is None:
        raise ValueError(f"ukjent materiale '{name}'")
    info: dict = {"name": mat.name, "use_nodes": mat.use_nodes, "users": mat.users}
    if mat.use_nodes:
        bsdf = next((n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
        if bsdf is not None:
            principled = {}
            for socket in bsdf.inputs:
                if socket.is_linked:
                    principled[socket.name] = "<linked>"
                else:
                    value = socket.default_value
                    try:
                        principled[socket.name] = list(value)
                    except TypeError:
                        principled[socket.name] = value
            info["principled"] = principled
        info["nodes"] = [{"name": n.name, "type": n.type} for n in mat.node_tree.nodes]
    return info


def get_collection(name: str) -> dict:
    coll = bpy.data.collections.get(name)
    if coll is None:
        raise ValueError(f"ukjent collection '{name}'")
    return {
        "name": coll.name,
        "objects": [o.name for o in coll.objects],
        "children": [c.name for c in coll.children],
    }


def _fmt_deg(radians: float) -> float:
    return round(math.degrees(radians), 3)
