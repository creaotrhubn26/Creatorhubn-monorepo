"""
gen-device-glb.py — Blender-integrasjon: generér EGNE, DETALJERTE device-kropper
(telefon/tablet) som .glb for Mockup Studios 3D-glTF-slot. KUN kroppen (med side-
knapper + bak-kamera-modul m/ linser) — appen legger skjermen selv i app-frame
(unngår Blender↔glTF-orienterings-kaos; deterministisk).

Konvensjon (Blender): bredde X, dybde Y (front = +Y), høyde Z. glTF +Yup-eksport gjør
Blender +Y→app +Z (front, mot kamera), +Z→app +Y (opp). Appen måler bbox + fester
skjermen på +Z-fronten.

Kjør: blender --background --python gen-device-glb.py -- <ut-mappe>
"""
import bpy
import sys
import os
import math


def clear():
    bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete()
    for m in list(bpy.data.materials):
        bpy.data.materials.remove(m)


def make_mat(name, color, metallic, roughness):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Metallic'].default_value = metallic
    b.inputs['Roughness'].default_value = roughness
    return m


def rbox(w, d, h, bevel, name, mat, loc=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=2)
    o = bpy.context.active_object; o.name = name
    o.scale = (w / 2, d / 2, h / 2); bpy.ops.object.transform_apply(scale=True)
    bev = o.modifiers.new('b', 'BEVEL'); bev.width = bevel; bev.segments = 3
    bpy.ops.object.modifier_apply(modifier='b')
    o.location = loc
    o.data.materials.clear(); o.data.materials.append(mat)
    return o


def lens(r, depth, name, mat, loc):
    # sylinder-akse peker -Y (bakover): roter 90° om X
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=depth, vertices=24)
    o = bpy.context.active_object; o.name = name
    o.rotation_euler = (math.radians(90), 0, 0)
    bpy.ops.object.transform_apply(rotation=True)
    o.location = loc
    o.data.materials.clear(); o.data.materials.append(mat)
    return o


def build_body(variant, w, h, d, bevel, cam, out):
    clear()
    body_m = make_mat('Body', (0.09, 0.10, 0.12), 0.9, 0.32)
    glass_m = make_mat('Glass', (0.02, 0.02, 0.03), 0.2, 0.15)
    rbox(w, d, h, bevel, variant + '_body', body_m)
    # side-knapper (Blender ±X): power høyre, 2 volum venstre
    bx = w / 2
    rbox(0.02, d * 0.5, h * 0.10, 0.006, 'btn_pwr', body_m, (bx, 0, h * 0.12))
    rbox(0.02, d * 0.5, h * 0.07, 0.006, 'btn_vu', body_m, (-bx, 0, h * 0.14))
    rbox(0.02, d * 0.5, h * 0.07, 0.006, 'btn_vd', body_m, (-bx, 0, h * 0.03))
    # bak-kamera-modul (Blender -Y = app -Z bakside), øvre venstre
    by = (d / 2)
    plate = rbox(cam['plate'] * w, 0.03, cam['plate'] * w, cam['plate'] * w * 0.28,
                 'cam_plate', body_m, (-w * 0.24, by + 0.012, h * 0.15))
    void = plate
    # linser (glass), protruderer bakover
    n = cam['lenses']
    for i in range(n):
        col = i % 2
        row = i // 2
        lx = -w * 0.24 + (col - 0.5) * cam['plate'] * w * 0.42
        lz = h * 0.15 + (0.5 - row) * cam['plate'] * w * 0.42
        lens(cam['lr'] * w, 0.05, 'lens_%d' % i, glass_m, (lx, by + 0.028, lz))
    # blits (liten glass-prikk) hvis 3 linser
    if n >= 3:
        lens(cam['lr'] * w * 0.4, 0.04, 'flash', glass_m, (-w * 0.24 + cam['plate'] * w * 0.3, by + 0.024, h * 0.15))
    _ = void
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=os.path.join(out, variant + '.glb'),
                              export_format='GLB', use_selection=True)


def main():
    argv = sys.argv
    out = argv[argv.index('--') + 1] if '--' in argv else '.'
    os.makedirs(out, exist_ok=True)
    build_body('iphone', 1.0, 2.06, 0.11, 0.05, {'plate': 0.30, 'lenses': 3, 'lr': 0.075}, out)
    build_body('ipad', 1.0, 1.334, 0.055, 0.03, {'plate': 0.12, 'lenses': 1, 'lr': 0.04}, out)
    print('WROTE glb ->', out)


if __name__ == '__main__':
    main()
