"""Run in Blender background mode to export the original Ziki hero as glTF 2.0."""
import math
from pathlib import Path
import bpy
from mathutils import Vector

bpy.ops.wm.read_factory_settings(use_empty=True)
path = Path(__file__).resolve().parents[1] / 'public/assets/ziki.glb'

def material(name, hexcode, rough=.43, emission=0):
    m = bpy.data.materials.new(name)
    def linear(v):
        return v / 12.92 if v < .04045 else ((v + .055) / 1.055) ** 2.4
    rgb = tuple(linear(int(hexcode[i:i+2], 16) / 255) for i in (0, 2, 4))
    m.use_nodes = True
    node = m.node_tree.nodes.get('Principled BSDF')
    node.inputs['Base Color'].default_value = (*rgb, 1)
    node.inputs['Roughness'].default_value = rough
    if emission:
        (node.inputs.get('Emission Color') or node.inputs['Emission']).default_value = (*rgb, 1)
        node.inputs['Emission Strength'].default_value = emission
    return m

blue = material('Lake blue enamel', '2473cd')
ice = material('Pale blue shell inset', 'a6e8ed')
dark = material('Deep ink structure', '152338')
glass = material('Visor glass', '142941', .22)
pink = material('Peach cheeks', 'ff957f', .6, .55)
light = material('Mint display', '98fff0', .4, 2)
orange = material('Tangerine rotor guard', 'f28038')
cream = material('Ivory guard stripe', 'ffe4a5')

def mesh(name, mat, parent=None, smooth=True):
    ob = bpy.context.object
    ob.name = name
    ob.parent = parent
    ob.data.materials.append(mat)
    if smooth:
        for p in ob.data.polygons:
            p.use_smooth = True
    return ob

def ball(name, p, s, mat, parent=None, *, segments=20, rings=12):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, radius=1, location=p)
    ob = mesh(name, mat, parent)
    ob.scale = s
    return ob

def box(name, p, dims, bevel, mat, parent=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=p)
    ob = mesh(name, mat, parent, False)
    ob.dimensions = dims
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    mod = ob.modifiers.new('Soft edges', 'BEVEL')
    mod.width, mod.segments = bevel, 4
    mod = ob.modifiers.new('Face normals', 'WEIGHTED_NORMAL')
    mod.keep_sharp = True
    return ob

def torus(name, p, r, tube, mat, parent=None):
    bpy.ops.mesh.primitive_torus_add(location=p, major_segments=28, minor_segments=10, major_radius=r, minor_radius=tube)
    return mesh(name, mat, parent)

def pivot(name, p):
    ob = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(ob)
    ob.location = p
    return ob

def arm(p, q):
    from mathutils import Vector
    u, v = Vector(p), Vector(q)
    obj = box('Rotor arm', (u + v) / 2, (.08, .07, (v-u).length), .026, dark)
    obj.rotation_mode = 'QUATERNION'
    obj.rotation_quaternion = (v-u).to_track_quat('Z', 'Y')

box('Rounded body', (0, 0, 0), (.67, .5, .39), .13, blue)
ball('Top shell inset', (0, .035, .19), (.21, .17, .034), ice)
ball('Green status LED', (0, -.025, .225), (.044, .044, .018), light)
box('Screen bezel', (0, -.235, -.015), (.56, .13, .28), .06, ice)
box('Visor glass', (0, -.294, -.013), (.49, .085, .225), .039, glass)
for sign in (-1, 1):
    ball('Mint eye', (sign*.112, -.34, .01), (.04, .014, .054), light)
    ball('Peach cheek', (sign*.162, -.339, -.057), (.031, .01, .015), pink)

mouth_pixels = 20

def mouth_positions(index):
    angle = math.tau * index / mouth_pixels
    across, up = math.cos(angle), math.sin(angle)
    smile_x, frown_x = .039 * across, .046 * across
    # Both lips are close together at rest. The round pose opens them in opposite directions.
    smile = Vector((smile_x, -.342, -.062 + 5*smile_x**2 + .002*up))
    frown = Vector((frown_x, -.358, -.041 - 12*frown_x**2 + .002*up))
    surprise = Vector((.045*across, -.357, -.052 + .039*up))
    return smile, frown, surprise

for index in range(mouth_pixels):
    smile, _, _ = mouth_positions(index)
    pixel = ball('Visor mouth', smile, (.012, .008, .011), light, segments=12, rings=8)
    pixel.vertex_groups.new(name=str(index)).add(list(range(len(pixel.data.vertices))), 1, 'REPLACE')
for sign in (-1, 1):
    brow = ball('Sad brow', (sign * .115, -.355, .07), (.046, .012, .011), light)
    brow.rotation_euler.y = sign * .47

for i, (x, y) in enumerate([(-.56,-.31),(.56,-.31),(-.56,.31),(.56,.31)]):
    arm((x*.37, y*.41, .015), (x, y, .105))
    torus('Orange rotor guard', (x, y, .109), .238, .035, orange)
    torus('Ivory top stripe', (x, y, .137), .239, .01, cream)
    ro = pivot(f'Rotor_{i+1}', (x, y, .112))
    ball('Propeller hub', (0, 0, 0), (.061, .061, .032), blue, ro)
    for a in (0, math.pi*2/3, math.pi*4/3):
        ob = ball('Propeller blade', (.09*math.cos(a), .09*math.sin(a), 0), (.09, .035, .012), dark, ro)
        ob.rotation_euler.z = a
    ball('Motor cap', (x, y, .074), (.07, .07, .037), blue)

# Batch static parts by material and keep the visor features editable.
groups = {}
for ob in list(bpy.context.scene.objects):
    if ob.type != 'MESH' or ob.name.startswith(('Mint eye', 'Sad brow')):
        continue
    bpy.ops.object.select_all(action='DESELECT')
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    for modifier in list(ob.modifiers):
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    key = (ob.parent, 'Visor mouth' if ob.name.startswith('Visor mouth') else ob.data.materials[0].name)
    groups.setdefault(key, []).append(ob)
for (parent, material_name), items in groups.items():
    if len(items) < 2:
        continue
    bpy.ops.object.select_all(action='DESELECT')
    for ob in items:
        ob.select_set(True)
    chosen = items[0]
    bpy.context.view_layer.objects.active = chosen
    bpy.ops.object.join()
    chosen.name = (parent.name + ' / ' if parent else '') + material_name

# Preserve vertex correspondence so the game can interpolate the lip curve.
mouth = bpy.data.objects['Visor mouth']
mouth.shape_key_add(name='Basis')
to_local = mouth.matrix_world.inverted().to_3x3()
positions = [mouth_positions(int(group.name)) for group in mouth.vertex_groups]
for pose_index, name in enumerate(('Frown', 'Surprise'), start=1):
    pose = mouth.shape_key_add(name=name)
    offsets = [to_local @ (points[pose_index] - points[0]) for points in positions]
    for vertex in mouth.data.vertices:
        pose.data[vertex.index].co += offsets[vertex.groups[0].group]

bpy.ops.export_scene.gltf(filepath=str(path), export_format='GLB', export_apply=True)
