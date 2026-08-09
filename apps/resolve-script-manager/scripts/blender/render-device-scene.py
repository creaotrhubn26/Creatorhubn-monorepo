"""
render-device-scene.py — headless Cycles hero-render av en enhet i et studio-
environment, animert kamera-orbit → PNG-sekvens. Ffmpeg (utenfor) koder til MP4.

Parametrisk enhet bygget NATIVE i Blender (+Z opp) → ingen glTF-orienterings-felle.
Premium Cycles-materialer (anodisert alu-kropp + emissiv glass-skjerm).

Kjør:
  blender --background --python render-device-scene.py -- \
      --out <dir> --frames 36 --device ipad [--shot screenshot.png]
"""
import bpy, sys, os, math

# ---- argparse (etter '--') --------------------------------------------------
argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
def arg(flag, default=None):
    return argv[argv.index(flag) + 1] if flag in argv else default

OUT = arg('--out', '/tmp/blender-device')
FRAMES = int(arg('--frames', '36'))
DEVICE = arg('--device', 'ipad')
SHOT = arg('--shot', None)
SCREENDIR = arg('--screendir', None)  # skrive-animasjon: screen_<frame>.png per bilde
DECKDIR = arg('--deckdir', None)      # laptop-tastatur: deck_<frame>.png per bilde
ROTX = float(arg('--rotx', '0'))  # app «vipp» (grader)
ROTY = float(arg('--roty', '0'))  # app «snu» (turntable, grader)
ROTZ = float(arg('--rotz', '0'))  # app «rull» (grader)
os.makedirs(OUT, exist_ok=True)

_screen_img = None  # bpy-image-datablock som byttes per frame (skrive-animasjon)
_deck_img = None    # bpy-image-datablock for tastatur-dekket (byttes per frame)

# Enhets-proporsjoner (bredde, høyde, tykkelse i BU) + skjerm-innfelling.
DIMS = {
    'iphone': (0.72, 1.48, 0.09, 0.05),
    'ipad':   (1.20, 1.60, 0.07, 0.04),
    'macbook':(1.60, 1.00, 0.06, 0.035),  # kun panel (clamshell-base droppes i v1)
}
W, H, D, INSET = DIMS.get(DEVICE, DIMS['ipad'])

# ---- ren scene --------------------------------------------------------------
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = 'CYCLES'

# GPU (Metal) om tilgjengelig, ellers CPU.
prefs = bpy.context.preferences.addons['cycles'].preferences
try:
    prefs.compute_device_type = 'METAL'
    prefs.get_devices()
    for d in prefs.devices:
        d.use = True
    scene.cycles.device = 'GPU'
except Exception as e:
    print('GPU utilgjengelig, bruker CPU:', e)
    scene.cycles.device = 'CPU'

scene.cycles.samples = 48
scene.cycles.use_denoising = True
try:
    scene.cycles.denoiser = 'OPENIMAGEDENOISE'
except Exception:
    pass
scene.render.resolution_x = 1280
scene.render.resolution_y = 720
scene.render.film_transparent = False
scene.view_settings.view_transform = 'AgX'  # filmisk (Blender 4+/5 default)


def mat_metal():
    m = bpy.data.materials.new('Body'); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (0.015, 0.016, 0.02, 1)
    b.inputs['Metallic'].default_value = 1.0
    b.inputs['Roughness'].default_value = 0.34
    return m


def mat_screen():
    global _screen_img
    m = bpy.data.materials.new('Screen'); m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    emis = nt.nodes.new('ShaderNodeEmission')
    emis.inputs['Strength'].default_value = 1.4
    # Skrive-animasjon: last første frame-skjerm, ref beholdes for per-frame-bytte.
    first = os.path.join(SCREENDIR, 'screen_0001.png') if SCREENDIR else None
    src = first if (first and os.path.exists(first)) else (SHOT if (SHOT and os.path.exists(SHOT)) else None)
    if src:
        img = nt.nodes.new('ShaderNodeTexImage')
        img.image = bpy.data.images.load(src)
        if SCREENDIR:
            _screen_img = img.image
        nt.links.new(img.outputs['Color'], emis.inputs['Color'])
    else:
        emis.inputs['Color'].default_value = (0.05, 0.12, 0.45, 1)
    nt.links.new(emis.outputs['Emission'], out.inputs['Surface'])
    return m


# ---- deck-materiale (laptop-tastatur) ---------------------------------------
def mat_deck():
    global _deck_img
    m = bpy.data.materials.new('Deck'); m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.inputs['Roughness'].default_value = 0.5
    first = os.path.join(DECKDIR, 'deck_0001.png') if DECKDIR else None
    if first and os.path.exists(first):
        img = nt.nodes.new('ShaderNodeTexImage'); img.image = bpy.data.images.load(first)
        _deck_img = img.image
        nt.links.new(img.outputs['Color'], bsdf.inputs['Base Color'])
    else:
        bsdf.inputs['Base Color'].default_value = (0.09, 0.09, 0.1, 1)
    nt.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    return m


body = None
if DEVICE == 'macbook':
    # ---- clamshell: base (tastatur-dekk) + hengslet skjerm-panel --------------
    baseTh, baseDepth, panelTh = 0.05, W * 0.68, 0.04
    # Base (fremkant nær kamera ved -Y, hengsel bak ved +Y).
    # (size=1-cube/plane spenner ±0.5 → skaler med FULL dimensjon, ikke /2.)
    bpy.ops.mesh.primitive_cube_add(size=1)
    base = bpy.context.active_object
    base.scale = (W, baseDepth, baseTh)
    bpy.ops.object.transform_apply(scale=True)
    base.location = (0, 0, baseTh / 2)
    base.modifiers.new('bev', 'BEVEL').width = 0.01
    base.data.materials.append(mat_metal())
    # Tastatur-dekk på topp av basen (peker +Z opp).
    bpy.ops.mesh.primitive_plane_add(size=1)
    deck = bpy.context.active_object
    deck.scale = (W * 0.985, baseDepth * 0.985, 1)
    bpy.ops.object.transform_apply(scale=True)
    deck.location = (0, 0, baseTh + 0.001)
    deck.data.materials.append(mat_deck())
    # Skjerm-panel, hengslet ved bakkant (+Y), lent bakover.
    hinge = math.radians(102)
    panel = bpy.data.objects.new('panel_empty', None)
    scene.collection.objects.link(panel)
    panel.location = (0, baseDepth / 2, baseTh)  # bakre kant, ved dekk-nivå (kobler til tastaturet)
    panel.rotation_euler = (-(hinge - math.radians(90)), 0, 0)  # len bakover fra loddrett
    bpy.ops.mesh.primitive_cube_add(size=1)
    plate = bpy.context.active_object
    plate.scale = (W, H, panelTh)
    bpy.ops.object.transform_apply(scale=True)
    plate.rotation_euler = (math.radians(90), 0, 0)  # reis platen loddrett (høyde langs Z)
    plate.location = (0, 0, H / 2)
    plate.data.materials.append(mat_metal())
    plate.parent = panel
    # Skjerm-plan på panelets front (-Y, mot kamera).
    bpy.ops.mesh.primitive_plane_add(size=1)
    screen = bpy.context.active_object
    screen.scale = (W - INSET * 2, H - INSET * 2, 1)
    bpy.ops.object.transform_apply(scale=True)
    screen.rotation_euler = (math.radians(90), 0, 0)
    screen.location = (0, -panelTh / 2 - 0.002, H / 2)
    screen.data.materials.append(mat_screen())
    screen.parent = panel
    # Turntable (ROTY) om Z: parent alt til én rot-empty ved origo og roter den
    # (så base + panel roterer om SAMME pivot — ellers glir de fra hverandre).
    root = bpy.data.objects.new('laptop_root', None); scene.collection.objects.link(root)
    for o in (base, deck, panel):
        o.parent = root
    root.rotation_euler = (0, 0, math.radians(ROTY))
    body = base  # kamera-mål
else:
    # ---- slab (telefon/tablet): avrundet kropp + skjerm-plan -----------------
    bpy.ops.mesh.primitive_cube_add(size=1)
    body = bpy.context.active_object
    body.scale = (W / 2, H / 2, D / 2)
    bpy.ops.object.transform_apply(scale=True)
    bev = body.modifiers.new('bev', 'BEVEL')
    bev.width = min(W, H) * 0.06; bev.segments = 6
    bpy.ops.object.shade_smooth()
    body.data.materials.append(mat_metal())
    bpy.ops.mesh.primitive_plane_add(size=1)
    screen = bpy.context.active_object
    screen.scale = ((W - INSET * 2) / 2, (H - INSET * 2) / 2, 1)
    screen.location = (0, 0, D / 2 + 0.002)
    bpy.ops.object.transform_apply(scale=True)
    screen.data.materials.append(mat_screen())
    base_tilt = max(35, min(90, 72 - ROTX * 0.4))
    for o in (body, screen):
        o.rotation_euler = (math.radians(base_tilt), math.radians(ROTZ), math.radians(18 + ROTY))

# ---- studio: gulv + gradient-verden + 3-punkts area-lys ---------------------
_floor_z = -0.012 if DEVICE == 'macbook' else -H * 0.55  # clamshell står på gulvet
bpy.ops.mesh.primitive_plane_add(size=40, location=(0, 0, _floor_z))
floor = bpy.context.active_object
fm = bpy.data.materials.new('Floor'); fm.use_nodes = True
fb = fm.node_tree.nodes['Principled BSDF']
fb.inputs['Base Color'].default_value = (0.05, 0.055, 0.07, 1)
fb.inputs['Roughness'].default_value = 0.4
floor.data.materials.append(fm)

world = bpy.data.worlds.new('W'); scene.world = world; world.use_nodes = True
wnt = world.node_tree
bg = wnt.nodes['Background']
grad = wnt.nodes.new('ShaderNodeTexGradient')
ramp = wnt.nodes.new('ShaderNodeValToRGB')
texco = wnt.nodes.new('ShaderNodeTexCoord')
ramp.color_ramp.elements[0].color = (0.02, 0.02, 0.03, 1)
ramp.color_ramp.elements[1].color = (0.22, 0.24, 0.30, 1)
wnt.links.new(texco.outputs['Generated'], grad.inputs['Vector'])
wnt.links.new(grad.outputs['Color'], ramp.inputs['Fac'])
wnt.links.new(ramp.outputs['Color'], bg.inputs['Color'])
bg.inputs['Strength'].default_value = 0.6


def area(name, loc, energy, size):
    ld = bpy.data.lights.new(name, 'AREA'); ld.energy = energy; ld.size = size
    lo = bpy.data.objects.new(name, ld); lo.location = loc
    bpy.context.collection.objects.link(lo)
    c = lo.constraints.new('TRACK_TO'); c.target = body
    return lo

area('key', (3, -3, 5), 900, 6)
area('fill', (-4, -1, 2.5), 250, 8)
area('rim', (-1.5, 4, 3), 500, 5)

# ---- kamera + orbit-animasjon ----------------------------------------------
cam_data = bpy.data.cameras.new('Cam'); cam_data.lens = 85
cam = bpy.data.objects.new('Cam', cam_data); scene.collection.objects.link(cam)
scene.camera = cam
# Clamshell er høy (skjerm + base) → sikt mot midt-høyde + større avstand.
if DEVICE == 'macbook':
    tgt = bpy.data.objects.new('camtgt', None); scene.collection.objects.link(tgt)
    tgt.location = (0, 0, H * 0.42)
    track = cam.constraints.new('TRACK_TO'); track.target = tgt
    R, Z = 4.6, 3.2
else:
    track = cam.constraints.new('TRACK_TO'); track.target = body
    R, Z = 5.2, 1.9
scene.frame_start = 1; scene.frame_end = FRAMES
for f in range(1, FRAMES + 1):
    a = math.radians(-7 + 14 * (f - 1) / max(1, FRAMES - 1))  # subtil svai ±7° (brukerens vinkel dominerer)
    cam.location = (R * math.sin(a), -R * math.cos(a), Z)
    cam.keyframe_insert('location', frame=f)

# ---- skrive-animasjon: bytt skjerm-tekstur per frame ------------------------
if SCREENDIR and _screen_img is not None:
    def _swap_screen(scn):
        f = scn.frame_current
        p = os.path.join(SCREENDIR, 'screen_%04d.png' % f)
        if os.path.exists(p):
            _screen_img.filepath = p
            _screen_img.reload()
    bpy.app.handlers.frame_change_pre.append(_swap_screen)

if DECKDIR and _deck_img is not None:
    def _swap_deck(scn):
        f = scn.frame_current
        p = os.path.join(DECKDIR, 'deck_%04d.png' % f)
        if os.path.exists(p):
            _deck_img.filepath = p
            _deck_img.reload()
    bpy.app.handlers.frame_change_pre.append(_swap_deck)

# ---- render PNG-sekvens -----------------------------------------------------
scene.render.image_settings.file_format = 'PNG'
scene.render.filepath = os.path.join(OUT, 'frame_')
bpy.ops.render.render(animation=True)
print('FERDIG render →', OUT)
