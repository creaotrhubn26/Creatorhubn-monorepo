# studio_kit.py — THE ROLE ROOM STUDIO KIT (domenelaget).
#
# Fotostudio-semantikk oppå kjerneverktøyene: rom-generator, kurvet cyclorama,
# produksjonslys (mesh + ekte lys + metadata som ÉN rigg), kamera-rigger og
# lyssettings-presets. Alt i reelle meter, alt i disiplinerte collections
# (PHOTO_STUDIO/ARCHITECTURE/LIGHTING/CAMERAS/…), alt med custom properties
# (rr_type/rr_category/…) så iPad-appen kan skille produksjonsutstyr fra
# ren geometri ved eksport.

from __future__ import annotations

import math

import bpy
from mathutils import Vector

try:
    from . import core
except ImportError:  # flat import i headless-testene
    import core

_COLLECTIONS = ["ARCHITECTURE", "LIGHTING", "CAMERAS", "TALENT", "GRIP", "FURNITURE", "PROPS"]


# ---------------------------------------------------------------- hjelpere

def _studio_collection(sub: str):
    root = bpy.data.collections.get("PHOTO_STUDIO")
    if root is None:
        root = bpy.data.collections.new("PHOTO_STUDIO")
        bpy.context.scene.collection.children.link(root)
    coll = bpy.data.collections.get(sub)
    if coll is None:
        coll = bpy.data.collections.new(sub)
        root.children.link(coll)
    return coll


def _link(obj, sub: str):
    for coll in list(obj.users_collection):
        coll.objects.unlink(obj)
    _studio_collection(sub).objects.link(obj)


def _mesh_object(name: str, vertices, faces, sub: str, material: str | None = None):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata([Vector(v) for v in vertices], [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    _studio_collection(sub).objects.link(obj)
    if material and (mat := bpy.data.materials.get(material)):
        obj.data.materials.append(mat)
    return obj


def _box(name: str, size, location, sub: str, material: str | None = None):
    sx, sy, sz = size[0] / 2, size[1] / 2, size[2] / 2
    verts = [(x, y, z) for x in (-sx, sx) for y in (-sy, sy) for z in (-sz, sz)]
    faces = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]
    obj = _mesh_object(name, verts, faces, sub, material)
    obj.location = Vector(location)
    return obj


def _ensure_material(name: str, base_color, roughness=0.5, metallic=0.0, emission=None):
    if name in bpy.data.materials:
        return name
    core.create_material(name, base_color=list(base_color), metallic=metallic, roughness=roughness)
    if emission:
        core.set_material_parameter(name, "Emission Color", list(emission[0]) + [1.0])
        core.set_material_parameter(name, "Emission Strength", emission[1])
    return name


def _tag(obj, rr_type: str, category: str, **meta):
    obj["rr_type"] = rr_type
    obj["rr_category"] = category
    for key, value in meta.items():
        obj[f"rr_{key}"] = value


# ---------------------------------------------------------------- rommet

def create_studio(width: float = 8.0, depth: float = 10.0, height: float = 4.0,
                  wall_color: list | None = None) -> dict:
    """Studio-rommet i reelle meter: gulv, tre vegger, tak. Origo = gulvsenter."""
    core._undo_push(f"create_studio {width}x{depth}x{height}")
    floor_mat = _ensure_material("MAT_ConcreteFloor", [0.10, 0.10, 0.11], roughness=0.28)
    wall_mat = _ensure_material("MAT_WallPaint", wall_color or [0.14, 0.14, 0.15], roughness=0.8)
    w, d, h, t = width / 2, depth / 2, height, 0.08

    floor = _box("FLOOR", [width, depth, t], [0, 0, -t / 2], "ARCHITECTURE", floor_mat)
    _tag(floor, "architecture", "floor", width=width, depth=depth)
    for name, size, loc in [
        ("WALL_BACK", [width, t, h], [0, d, h / 2]),
        ("WALL_LEFT", [t, depth, h], [-w, 0, h / 2]),
        ("WALL_RIGHT", [t, depth, h], [w, 0, h / 2]),
        ("CEILING", [width, depth, t], [0, 0, h + t / 2]),
    ]:
        wall = _box(name, size, loc, "ARCHITECTURE", wall_mat)
        _tag(wall, "architecture", "wall")
    return {"studio": f"{width}x{depth}x{height} m",
            "objects": ["FLOOR", "WALL_BACK", "WALL_LEFT", "WALL_RIGHT", "CEILING"]}


def add_cyclorama(width: float = 5.0, height: float = 3.0, radius: float = 0.9,
                  depth: float = 3.0, location_y: float | None = None,
                  color: list | None = None) -> dict:
    """Kurvet cyclorama (gulv → radius → vegg) — sømløs bakgrunn, hvit default."""
    core._undo_push("add_cyclorama")
    mat = _ensure_material("MAT_Cyclorama", color or [0.92, 0.92, 0.92], roughness=0.9)
    segments = 16
    # Profil i YZ (y: dybde foran veggen → 0 = vegglinja; z: høyde):
    # flatt gulv frem, kvartsirkel-radius, vertikal vegg opp til height.
    profile = [(-depth, 0.0)]
    for i in range(segments + 1):
        a = (i / segments) * (math.pi / 2)
        profile.append((-radius + radius * math.sin(a), radius - radius * math.cos(a)))
    profile.append((0.0, height))
    verts, faces = [], []
    xs = (-width / 2, width / 2)
    for y, z in profile:
        verts.append((xs[0], y, z))
        verts.append((xs[1], y, z))
    for i in range(len(profile) - 1):
        a = i * 2
        faces.append((a, a + 1, a + 3, a + 2))
    obj = _mesh_object("CYC_WALL", verts, faces, "ARCHITECTURE", mat)
    obj.location = Vector([0, location_y if location_y is not None else 0, 0])
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    _tag(obj, "architecture", "cyclorama", width=width, height=height, radius=radius)
    return {"created": "CYC_WALL", "width": width, "height": height, "radius": radius}


# ---------------------------------------------------------------- lys-rigger

def add_softbox(name: str, position: list, size: float = 1.2,
                temperature: float = 5600, power: float = 700,
                aim_at: list | None = None, shape: str = "square") -> dict:
    """Softbox-rigg: stoff-body + diffusjonsflate (mesh) + ekte Area-lys +
    metadata — flytt riggen (root-empty), alt følger med."""
    core._undo_push(f"add_softbox {name}")
    root = bpy.data.objects.new(name, None)
    root.empty_display_size = 0.2
    _studio_collection("LIGHTING").objects.link(root)
    root.location = Vector(position)

    fabric = _ensure_material("MAT_SoftboxFabric", [0.02, 0.02, 0.02], roughness=0.9)
    diffusion = _ensure_material("MAT_Diffusion", [0.95, 0.95, 0.95], roughness=0.6)
    body = _box(f"{name}_Body", [size, size, 0.35], [0, 0, 0], "LIGHTING", fabric)
    body.parent = root
    front = _box(f"{name}_Diffusion", [size * 0.94, size * 0.94, 0.01],
                 [0, 0, -0.18], "LIGHTING", diffusion)
    front.parent = root

    light_data = bpy.data.lights.new(f"{name}_Light", "AREA")
    light_data.shape = "DISK" if shape == "disk" else "SQUARE"
    light_data.size = size
    light_data.energy = power
    light_data.color = _kelvin(temperature)
    light = bpy.data.objects.new(f"{name}_Light", light_data)
    _studio_collection("LIGHTING").objects.link(light)
    light.parent = root
    light.location = Vector([0, 0, -0.20])

    if aim_at is not None:
        direction = Vector(aim_at) - Vector(position)
        root.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()

    _tag(root, "light", "softbox", width=size, height=size,
         default_kelvin=temperature, power=power)
    return {"created": name, "parts": [body.name, front.name, light.name],
            "power": power, "kelvin": temperature}


def add_reflector(name: str, position: list, size: float = 1.0,
                  aim_at: list | None = None) -> dict:
    """Passiv reflektor (bounce) — hvit flate, ingen lyskilde."""
    core._undo_push(f"add_reflector {name}")
    mat = _ensure_material("MAT_Reflector", [0.97, 0.97, 0.95], roughness=0.4)
    obj = _box(name, [size, size * 1.4, 0.02], position, "GRIP", mat)
    if aim_at is not None:
        direction = Vector(aim_at) - Vector(position)
        obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    _tag(obj, "grip", "reflector", size=size)
    return {"created": name}


def _kelvin(kelvin: float):
    """Kelvin → RGB (Tanner Helland-approksimasjon, 1000–12000 K)."""
    t = min(max(kelvin, 1000), 12000) / 100
    if t <= 66:
        r = 255.0
        g = 99.4708025861 * math.log(t) - 161.1195681661
        b = 0.0 if t <= 19 else 138.5177312231 * math.log(t - 10) - 305.0447927307
    else:
        r = 329.698727446 * (t - 60) ** -0.1332047592
        g = 288.1221695283 * (t - 60) ** -0.0755148492
        b = 255.0
    return [min(max(v / 255, 0.0), 1.0) for v in (r, g, b)]


# ---------------------------------------------------------------- kamera-rigg

def add_camera_rig(name: str = "CAMERA_A", position: list | None = None,
                   focal_length: float = 50, f_stop: float = 2.8,
                   aim_at: list | None = None, make_active: bool = True) -> dict:
    """Kamera-rigg: render-kamera + enkel body/tripod-modell under felles root."""
    core._undo_push(f"add_camera_rig {name}")
    position = position or [0, -5, 1.5]
    root = bpy.data.objects.new(f"{name}_RIG", None)
    root.empty_display_size = 0.25
    _studio_collection("CAMERAS").objects.link(root)
    root.location = Vector(position)

    cam_data = bpy.data.cameras.new(f"{name}_RENDER")
    cam_data.sensor_width = 36.0
    cam_data.lens = focal_length
    cam_data.dof.use_dof = True
    cam_data.dof.aperture_fstop = f_stop
    cam = bpy.data.objects.new(f"{name}_RENDER", cam_data)
    _studio_collection("CAMERAS").objects.link(cam)
    cam.parent = root

    body_mat = _ensure_material("MAT_CameraBody", [0.05, 0.05, 0.05], roughness=0.4)
    body = _box(f"{name}_MODEL", [0.16, 0.28, 0.14], [0, 0.18, 0], "CAMERAS", body_mat)
    body.parent = root
    leg_mat = _ensure_material("MAT_Tripod", [0.15, 0.15, 0.16], roughness=0.3, metallic=1.0)
    for i, angle in enumerate((0, 120, 240)):
        rad = math.radians(angle)
        leg = _box(f"{name}_Leg{i}", [0.03, 0.03, position[2]],
                   [0.25 * math.cos(rad), 0.18 + 0.25 * math.sin(rad), -position[2] / 2],
                   "CAMERAS", leg_mat)
        leg.parent = root

    if aim_at is not None:
        direction = Vector(aim_at) - Vector(position)
        root.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    if make_active:
        bpy.context.scene.camera = cam
    _tag(root, "camera", "rig", focal_length=focal_length, f_stop=f_stop,
         sensor="36x24")
    return {"created": f"{name}_RIG", "render_camera": cam.name,
            "focal_length": focal_length, "f_stop": f_stop}


# ---------------------------------------------------------------- presets

def apply_lighting_preset(preset: str, subject_position: list | None = None) -> dict:
    """Komplette lyssett fra fotografisk praksis. Motiv-posisjon = hvor
    talentet/produktet står (default origo, 1.6m høyde for portrett)."""
    subject = list(subject_position or [0, 0, 1.5])
    presets = {
        "portrait": _preset_portrait,
        "beauty": _preset_beauty,
        "interview": _preset_interview,
        "product": _preset_product,
    }
    if preset not in presets:
        raise ValueError(f"ukjent preset '{preset}' — gyldige: {sorted(presets)}")
    core._undo_push(f"lighting_preset {preset}")
    created = presets[preset](subject)
    return {"preset": preset, "created": created, "subject": subject}


def _preset_portrait(s):
    add_softbox("KEY_LIGHT", [s[0] - 1.8, s[1] - 1.5, s[2] + 0.9],
                size=1.2, temperature=5600, power=700, aim_at=s)
    add_reflector("REFLECTOR", [s[0] + 1.4, s[1] - 1.0, s[2]], size=1.0, aim_at=s)
    add_softbox("RIM_LIGHT", [s[0] + 1.2, s[1] + 1.8, s[2] + 1.0],
                size=0.6, temperature=6200, power=350, aim_at=s)
    return ["KEY_LIGHT", "REFLECTOR", "RIM_LIGHT"]


def _preset_beauty(s):
    add_softbox("BEAUTY_KEY", [s[0], s[1] - 1.4, s[2] + 1.1],
                size=1.2, temperature=5600, power=800, aim_at=s, shape="disk")
    add_reflector("FILL_UNDER", [s[0], s[1] - 1.0, s[2] - 1.0], size=0.9, aim_at=s)
    add_softbox("HAIR_LIGHT", [s[0], s[1] + 1.6, s[2] + 1.3],
                size=0.5, temperature=5600, power=300, aim_at=s)
    return ["BEAUTY_KEY", "FILL_UNDER", "HAIR_LIGHT"]


def _preset_interview(s):
    add_softbox("KEY_LIGHT", [s[0] - 2.0, s[1] - 1.6, s[2] + 0.8],
                size=1.2, temperature=5600, power=650, aim_at=s)
    add_softbox("FILL_LIGHT", [s[0] + 2.2, s[1] - 1.4, s[2] + 0.5],
                size=1.0, temperature=5600, power=200, aim_at=s)
    add_softbox("BACK_LIGHT", [s[0] - 0.8, s[1] + 2.0, s[2] + 1.2],
                size=0.6, temperature=5000, power=400, aim_at=s)
    return ["KEY_LIGHT", "FILL_LIGHT", "BACK_LIGHT"]


def _preset_product(s):
    add_softbox("KEY_LIGHT", [s[0] - 1.2, s[1] - 1.0, s[2] + 1.2],
                size=1.5, temperature=5600, power=500, aim_at=s)
    add_softbox("FILL_LIGHT", [s[0] + 1.4, s[1] - 0.8, s[2] + 0.6],
                size=1.0, temperature=5600, power=180, aim_at=s)
    add_softbox("RIM_LIGHT", [s[0] + 0.4, s[1] + 1.4, s[2] + 1.4],
                size=0.4, temperature=6500, power=350, aim_at=s)
    return ["KEY_LIGHT", "FILL_LIGHT", "RIM_LIGHT"]


# ---------------------------------------------------------------- register

STUDIO_TOOLS = {
    "create_studio": {"level": "safe", "fn": create_studio, "description": "Bygg studio-rommet i reelle meter (gulv/vegger/tak, betong+malt gips, PHOTO_STUDIO-collections). Args: width, depth, height, wall_color?.", "mutates": True},
    "add_cyclorama": {"level": "safe", "fn": add_cyclorama, "description": "Kurvet cyclorama (sømløs gulv→vegg, shade smooth). Args: width, height, radius?, depth?, location_y?, color? (default hvit).", "mutates": True},
    "add_softbox": {"level": "safe", "fn": add_softbox, "description": "Softbox-RIGG: stoff-body + diffusjonsflate + ekte Area-lys + rr_-metadata under felles root. Args: name, position, size?, temperature? (K), power? (W), aim_at?, shape? (square|disk).", "mutates": True},
    "add_reflector": {"level": "safe", "fn": add_reflector, "description": "Passiv reflektor/bounce. Args: name, position, size?, aim_at?.", "mutates": True},
    "add_camera_rig": {"level": "safe", "fn": add_camera_rig, "description": "Kamera-rigg: fysisk korrekt render-kamera (36mm sensor, DOF) + body/tripod-modell under felles root. Args: name?, position?, focal_length?, f_stop?, aim_at?, make_active?.", "mutates": True},
    "apply_lighting_preset": {"level": "safe", "fn": apply_lighting_preset, "description": "Komplett lyssett: portrait|beauty|interview|product — softbox-rigger + reflektorer siktet på motivet. Args: preset, subject_position? [x,y,z].", "mutates": True},
}
