# geometry_nodes.py — semantiske Geometry Nodes-verktøy (§14, §30).
#
# Mål: parametriske, GJENBRUKBARE assets — eksponerte parametre på Group
# Input, ikke hardkodede konstanter. Node-typer valideres mot bpy (prefiks-
# gated), sockets refereres ved navn.

from __future__ import annotations

import bpy

try:
    from . import core
except ImportError:  # flat import i headless-testene
    import core

_ALLOWED_PREFIXES = ("GeometryNode", "ShaderNode", "FunctionNode", "NodeGroup")


def create_geometry_nodes(object_name: str, group_name: str) -> dict:
    obj = core._require_object(object_name)
    core._undo_push(f"create_geometry_nodes {group_name}")
    group = bpy.data.node_groups.new(group_name, "GeometryNodeTree")
    group.interface.new_socket("Geometry", in_out="INPUT", socket_type="NodeSocketGeometry")
    group.interface.new_socket("Geometry", in_out="OUTPUT", socket_type="NodeSocketGeometry")
    group_in = group.nodes.new("NodeGroupInput")
    group_in.name = "Group Input"
    group_in.location = (-400, 0)
    group_out = group.nodes.new("NodeGroupOutput")
    group_out.name = "Group Output"
    group_out.location = (400, 0)
    modifier = obj.modifiers.new(name=group_name, type="NODES")
    modifier.node_group = group
    return {"group": group.name, "modifier": modifier.name, "object": object_name}


def add_node(group: str, type: str, name: str | None = None,
             location: list | None = None) -> dict:
    tree = _require_group(group)
    if not type.startswith(_ALLOWED_PREFIXES):
        raise ValueError(f"node-type '{type}' er ikke tillatt (prefiks {_ALLOWED_PREFIXES})")
    core._undo_push(f"add_node {type}")
    try:
        node = tree.nodes.new(type)
    except RuntimeError as exc:
        raise ValueError(f"ukjent node-type '{type}': {exc}") from exc
    if name:
        node.name = name
    if location:
        node.location = location
    return {
        "node": node.name,
        "type": type,
        "inputs": [s.name for s in node.inputs],
        "outputs": [s.name for s in node.outputs],
    }


def connect_nodes(group: str, from_node: str, from_socket: str,
                  to_node: str, to_socket: str) -> dict:
    tree = _require_group(group)
    source = _require_node(tree, from_node)
    target = _require_node(tree, to_node)
    out_socket = _require_socket(source.outputs, from_socket, f"{from_node}.outputs")
    in_socket = _require_socket(target.inputs, to_socket, f"{to_node}.inputs")
    core._undo_push(f"connect {from_node}→{to_node}")
    tree.links.new(out_socket, in_socket)
    return {"connected": f"{from_node}.{from_socket} → {to_node}.{to_socket}"}


def set_node_input(group: str, node: str, input: str, value) -> dict:
    tree = _require_group(group)
    target = _require_node(tree, node)
    socket = _require_socket(target.inputs, input, f"{node}.inputs")
    core._undo_push(f"set_node_input {node}.{input}")
    socket.default_value = value
    return {"node": node, "input": input, "value": value}


_SOCKET_TYPES = {
    "int": "NodeSocketInt",
    "float": "NodeSocketFloat",
    "vector": "NodeSocketVector",
    "bool": "NodeSocketBool",
}


def expose_parameter(group: str, node: str, input: str, parameter_name: str,
                     socket_type: str = "float", default=None) -> dict:
    """Koble en node-input til Group Input som navngitt, eksponert parameter."""
    tree = _require_group(group)
    target = _require_node(tree, node)
    in_socket = _require_socket(target.inputs, input, f"{node}.inputs")
    if socket_type not in _SOCKET_TYPES:
        raise ValueError(f"ukjent socket_type '{socket_type}' — gyldige: {sorted(_SOCKET_TYPES)}")
    core._undo_push(f"expose_parameter {parameter_name}")
    interface_socket = tree.interface.new_socket(
        parameter_name, in_out="INPUT", socket_type=_SOCKET_TYPES[socket_type])
    if default is not None:
        interface_socket.default_value = default
    group_in = next((n for n in tree.nodes if n.type == "GROUP_INPUT"), None)
    if group_in is None:
        raise ValueError("gruppen mangler Group Input-node")
    out_socket = _require_socket(group_in.outputs, parameter_name, "Group Input.outputs")
    tree.links.new(out_socket, in_socket)
    return {"exposed": parameter_name, "to": f"{node}.{input}", "socket_type": socket_type}


def set_gn_parameter(object_name: str, parameter_name: str, value) -> dict:
    """Sett verdien på en eksponert parameter på objektets GN-modifier."""
    obj = core._require_object(object_name)
    modifier = next((m for m in obj.modifiers if m.type == "NODES" and m.node_group), None)
    if modifier is None:
        raise ValueError(f"'{object_name}' har ingen Geometry Nodes-modifier")
    item = next(
        (i for i in modifier.node_group.interface.items_tree
         if getattr(i, "in_out", None) == "INPUT" and i.name == parameter_name),
        None)
    if item is None:
        valid = [i.name for i in modifier.node_group.interface.items_tree
                 if getattr(i, "in_out", None) == "INPUT"]
        raise ValueError(f"ukjent parameter '{parameter_name}' — gyldige: {valid}")
    core._undo_push(f"set_gn_parameter {parameter_name}")
    if hasattr(modifier, "properties"):  # Blender 5.x-API
        modifier.properties.inputs[item.identifier]["value"] = value
    else:  # Blender 4.x
        modifier[item.identifier] = value
    obj.update_tag()
    bpy.context.view_layer.update()
    return {"object": object_name, "parameter": parameter_name, "value": value}


def get_node_graph(group: str) -> dict:
    tree = _require_group(group)
    return {
        "group": tree.name,
        "nodes": [
            {"name": n.name, "type": n.bl_idname,
             "inputs": [s.name for s in n.inputs],
             "outputs": [s.name for s in n.outputs]}
            for n in tree.nodes
        ],
        "links": [
            f"{l.from_node.name}.{l.from_socket.name} → {l.to_node.name}.{l.to_socket.name}"
            for l in tree.links
        ],
        "exposed_inputs": [
            {"name": i.name, "type": i.socket_type}
            for i in tree.interface.items_tree
            if getattr(i, "in_out", None) == "INPUT"
        ],
    }


def evaluated_stats(object_name: str) -> dict:
    """Vertex-/instansetall ETTER modifiers — for å verifisere at GN-oppsettet virker."""
    obj = core._require_object(object_name)
    depsgraph = bpy.context.evaluated_depsgraph_get()
    evaluated = obj.evaluated_get(depsgraph)
    mesh = evaluated.to_mesh()
    stats = {"vertices": len(mesh.vertices), "polygons": len(mesh.polygons)}
    evaluated.to_mesh_clear()
    return stats


# ---------------------------------------------------------------- hjelpere


def _require_group(name: str):
    tree = bpy.data.node_groups.get(name)
    if tree is None:
        raise ValueError(f"ukjent node-gruppe '{name}'")
    return tree


def _require_node(tree, name: str):
    node = tree.nodes.get(name)
    if node is None:
        raise ValueError(f"ukjent node '{name}' i '{tree.name}' — noder: {[n.name for n in tree.nodes]}")
    return node


def _require_socket(collection, name: str, where: str):
    socket = collection.get(name) if hasattr(collection, "get") else None
    if socket is None:
        socket = next((s for s in collection if s.name == name), None)
    if socket is None:
        raise ValueError(f"ukjent socket '{name}' i {where} — gyldige: {[s.name for s in collection]}")
    return socket


GN_TOOLS = {
    "create_geometry_nodes": {"level": "safe", "fn": create_geometry_nodes, "description": "Ny Geometry Nodes-modifier + gruppe m/ Group Input/Output. Args: object_name, group_name.", "mutates": True},
    "gn_add_node": {"level": "safe", "fn": add_node, "description": "Legg node i GN-gruppe. Args: group, type (bl_idname, f.eks. GeometryNodeMeshLine), name?, location?[x,y]. Returnerer input/output-socketnavn.", "mutates": True},
    "gn_connect": {"level": "safe", "fn": connect_nodes, "description": "Koble sockets ved navn. Args: group, from_node, from_socket, to_node, to_socket.", "mutates": True},
    "gn_set_input": {"level": "modify", "fn": set_node_input, "description": "Sett default-verdi på node-input. Args: group, node, input, value.", "mutates": True},
    "gn_expose_parameter": {"level": "safe", "fn": expose_parameter, "description": "Eksponer node-input som navngitt parameter på Group Input (§30: eksponerte parametre, ikke hardkodede konstanter). Args: group, node, input, parameter_name, socket_type (int|float|vector|bool), default?.", "mutates": True},
    "gn_set_parameter": {"level": "modify", "fn": set_gn_parameter, "description": "Sett eksponert parameter-verdi på objektets GN-modifier. Args: object_name, parameter_name, value.", "mutates": True},
    "gn_get_graph": {"level": "safe", "fn": get_node_graph, "description": "Les node-grafen: noder, lenker, eksponerte parametre. Args: group.", "mutates": False},
    "gn_evaluated_stats": {"level": "safe", "fn": evaluated_stats, "description": "Vertex-/polygontall ETTER modifiers — verifiser at GN-oppsettet gir geometri. Args: object_name.", "mutates": False},
}
