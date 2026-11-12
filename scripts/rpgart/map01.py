"""MAP01 «Алғашқы іздер» layout generator.

One tile grid holds three areas (the engine clamps the camera to the area):
  overworld (zones 0-4), the secret cave interior (zone 5) and the chroniclers'
  camp hub that opens after the level is completed (zone 6).
Outputs src/rpg/gen/map01.hpp, src/rpg/gen/map01.js and a preview PNG in test-results/.
"""
import math, os, random, sys, json
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from rpgart.core import fbm, noise2
from rpgart import world as W

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MW, MH, TS = 112, 108, 16
T = {k: i for i, k in enumerate(W.TERRAINS)}
grid = [[T['steppe']] * MW for _ in range(MH)]
zone = [[0] * MW for _ in range(MH)]
rnd = random.Random(2087)

AREAS = {  # name: (x0, y0, x1, y1) in tiles, inclusive-exclusive
    'world': (0, 0, 112, 72),
    'cave': (0, 73, 50, 108),
    'camp': (54, 73, 98, 102),
}

# Object kinds: name -> (sprite base, frames, anim, collider half w, half h, flags)
# anim: 0 static, 1 wind sway, 2 loop (fire/glow), 3 loop slow. flags: 1 decal, 2 light, 4 tall (fades near player)
KINDS = [
    ('poplar', 'O_POPLAR_0', 2, 0, 4, 3, 4), ('birch', 'O_BIRCH_0', 2, 0, 3, 2, 4), ('willow', 'O_WILLOW', 1, 0, 4, 3, 4),
    ('bush', 'O_BUSH_0', 3, 0, 7, 4, 0), ('tallgrass', 'O_TALLGRASS_0', 4, 1, 0, 0, 0), ('feather', 'O_FEATHER_0', 4, 1, 0, 0, 0),
    ('reeds', 'O_REEDS_0', 4, 1, 0, 0, 0), ('tulips', 'O_TULIPS_0', 3, 0, 0, 0, 1), ('rock', 'O_ROCK_0', 4, 0, 0, 0, 0),
    ('crock', 'O_CROCK_0', 4, 0, 0, 0, 0), ('log', 'O_LOG', 1, 0, 12, 3, 0), ('tusk', 'O_TUSK', 1, 0, 0, 0, 1),
    ('skull', 'O_SKULL', 1, 0, 0, 0, 1), ('ribs', 'O_RIBS', 1, 0, 0, 0, 1), ('track', 'O_TRACK_PAW', 4, 0, 0, 0, 1),
    ('scar', 'O_SCAR', 1, 0, 0, 0, 1), ('tent', 'O_TENT_0', 2, 0, 20, 7, 0), ('hut', 'O_HUT', 1, 0, 24, 6, 0),
    ('firepit', 'O_FIREPIT', 1, 0, 8, 4, 2), ('rack', 'O_RACK', 1, 0, 15, 3, 0), ('meatrack', 'O_MEATRACK', 1, 0, 10, 3, 0),
    ('toolpile', 'O_TOOLPILE', 1, 0, 0, 0, 1), ('storage', 'O_STORAGE', 1, 0, 9, 4, 0), ('hidemat', 'O_HIDEMAT', 1, 0, 0, 0, 1),
    ('spearrack', 'O_SPEARRACK', 1, 0, 10, 3, 0), ('basket', 'O_BASKET', 1, 0, 4, 3, 0), ('windbreak', 'O_WINDBREAK', 1, 0, 16, 3, 0),
    ('post', 'O_POST', 1, 0, 3, 3, 0), ('totem', 'O_TOTEM', 1, 0, 4, 3, 0), ('cavemouth', 'O_CAVEMOUTH', 1, 0, 0, 0, 0),
    ('boulder', 'O_BOULDER', 1, 0, 22, 8, 0), ('plate', 'O_PLATE_0', 2, 0, 0, 0, 1), ('lever', 'O_LEVER', 1, 0, 4, 3, 0),
    ('crack', 'O_CRACK', 1, 0, 0, 0, 0), ('stalag', 'O_STALAG_0', 2, 0, 4, 3, 0), ('crystal', 'O_CRYSTAL', 1, 2, 3, 2, 2),
    ('page', 'O_PAGE_0', 4, 2, 0, 0, 2), ('petro', 'O_PETRO_0', 5, 0, 18, 4, 0), ('gate', 'O_GATE_0', 4, 2, 0, 0, 2),
    ('ctent', 'O_CTENT', 1, 0, 20, 6, 0), ('holo', 'O_HOLO_0', 2, 3, 9, 4, 2), ('cfire', 'O_FIREPIT', 1, 0, 8, 4, 2),
]
KIND = {k[0]: i for i, k in enumerate(KINDS)}
objects = []   # (kind, x, y, variant, tag)
TAGS = ['none']
def tag(name):
    if name not in TAGS:
        TAGS.append(name)
    return TAGS.index(name)
def obj(kind, x, y, variant=0, t=0):
    objects.append((KIND[kind], int(x), int(y), variant, t))

interacts = []  # (key, x, y, radius, tag)
def interact(key, x, y, r=22, t=0):
    interacts.append((key, int(x), int(y), r, t))
triggers = []   # (key, x0, y0, x1, y1) in pixels
def trigger(key, x0, y0, x1, y1):
    triggers.append((key, int(x0 * TS), int(y0 * TS), int(x1 * TS), int(y1 * TS)))

def setr(x, y, t):
    if 0 <= x < MW and 0 <= y < MH:
        grid[y][x] = T[t]
def get(x, y):
    if 0 <= x < MW and 0 <= y < MH: return grid[y][x]
    return T['rock']

def river_x(y):
    return 52 + 4.5 * math.sin(y / 10.5) + 1.5 * math.sin(y / 4.3)

def build_world():
    x0, y0, x1, y1 = AREAS['world']
    for y in range(y0, y1):
        for x in range(x0, x1):
            n = fbm(x, y, 14, 3)
            grid[y][x] = T['grass'] if n > .56 else T['steppe']
            # Forest north-west is lush.
            if x < 46 and y < 30: grid[y][x] = T['grass']
            # Zones
            if y < 34 and x >= 52: z = 4
            elif y < 30: z = 3
            elif x < 20: z = 0
            elif x < 50: z = 1
            else: z = 2
            zone[y][x] = z
    # River with sandy/shallow banks.
    for y in range(y0, y1):
        cx = river_x(y)
        width = 2.6 + 1.2 * math.sin(y / 7)
        for x in range(int(cx - 8), int(cx + 9)):
            d = abs(x + .5 - cx)
            if d < width: setr(x, y, 'water')
            elif d < width + 1.1: setr(x, y, 'shallow')
            elif d < width + 2.3 + noise2(x, y, 4) * 1.5: setr(x, y, 'sand')
            elif d < width + 6 and get(x, y) == T['steppe']: setr(x, y, 'grass')
    # Ford to the hunting grounds (shallow crossing) at y 44-47.
    for y in range(43, 48):
        cx = river_x(y)
        for x in range(int(cx - 5), int(cx + 6)):
            if get(x, y) in (T['water'],): setr(x, y, 'shallow')
    # Northern gorge: rock walls either side of the river (y < 30).
    for y in range(0, 31):
        cx = river_x(y)
        for x in range(int(cx - 9), int(cx + 10)):
            d = abs(x + .5 - cx)
            if 4.2 + noise2(x, y, 6) * 1.3 < d < 7.5 + noise2(x, y, 8) * 2:
                setr(x, y, 'rock')
    # Ravine: cliff ridges framing the danger territory.
    for y in range(0, 36):
        for x in range(52, 112):
            n = fbm(x, y, 7, 3, )
            if n > .68 and not (80 <= x <= 90 and y >= 28) and not (94 <= x <= 108 and 8 <= y <= 16):
                setr(x, y, 'rock')
        # Southern cliff wall with a gap at x 82-89.
    for x in range(52, 112):
        for y in range(31, 35):
            if not (82 <= x <= 89) and noise2(x, y, 3) > -.1:
                if y < 33 + noise2(x, 0, 2) * 2: setr(x, y, 'rock')
    for y in range(0, 36):
        for x in range(52, 112):
            if get(x, y) != T['rock'] and get(x, y) != T['water']:
                if fbm(x, y, 9, 2, 3) > .58: setr(x, y, 'dirt')
                elif get(x, y) == T['grass'] and noise2(x, y, 1) > .3: setr(x, y, 'steppe')
    # Clear the camp area and the cave approach inside the ravine.
    for (cx, cy, rx, ry, t) in ((85, 19, 8, 6, 'dirt'), (100, 12, 9, 7, 'dirt'), (70, 24, 6, 5, 'steppe'), (98, 23, 6, 4, 'dirt')):
        for y in range(cy - ry, cy + ry + 1):
            for x in range(cx - rx, cx + rx + 1):
                if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1 + noise2(x, y, 5) * .3: setr(x, y, t)
    # Cliff behind the cave mouth (north-east corner).
    for x in range(94, 110):
        for y in range(0, 6 + int(noise2(x, 1, 3) * 2)):
            setr(x, y, 'rock')
    # Map border cliffs.
    for y in range(y0, y1):
        for x in range(x0, x1):
            e = min(x, y, x1 - 1 - x, y1 - 1 - y)
            if e < 2 + (noise2(x, y, 11) > .55):
                if not (get(x, y) == T['water'] and e >= 1):
                    setr(x, y, 'rock')
    # Paths (dirt) - spawn -> settlement -> ford -> hunting -> ravine; settlement -> forest.
    def path(pts, w=1.3):
        for (ax, ay), (bx, by) in zip(pts, pts[1:]):
            n = int(max(abs(bx - ax), abs(by - ay)) * 3) + 1
            for i in range(n + 1):
                t = i / n
                px, py = ax + (bx - ax) * t, ay + (by - ay) * t
                for yy in range(int(py - w - 1), int(py + w + 2)):
                    for xx in range(int(px - w - 1), int(px + w + 2)):
                        if math.hypot(xx + .5 - px, yy + .5 - py) < w + noise2(xx, yy, 2) * .6:
                            if get(xx, yy) in (T['grass'], T['steppe'], T['sand']):
                                setr(xx, yy, 'dirt')
    path([(14, 52), (18, 48), (23, 44), (27, 42)])
    path([(38, 43), (42, 45), (45, 45)])
    path([(55, 45), (62, 47), (70, 45), (78, 42), (84, 38), (85, 34), (85, 28)])
    path([(31, 34), (29, 28), (24, 20), (20, 14)], 1.0)
    path([(86, 24), (92, 18), (98, 14), (101, 10)], 1.0)
    # Settlement clearing.
    for y in range(31, 52):
        for x in range(20, 44):
            if ((x - 32) / 11) ** 2 + ((y - 41) / 8.5) ** 2 <= 1 + noise2(x, y, 7) * .25 and get(x, y) not in (T['water'], T['shallow'], T['sand']):
                setr(x, y, 'dirt')
    # Spawn meadow: lush grass, scorched ring.
    for y in range(40, 64):
        for x in range(3, 20):
            if get(x, y) == T['steppe'] and fbm(x, y, 6, 2, 9) > .45: setr(x, y, 'grass')
    # Hidden log bridge across the gorge (secret passage forest -> ravine) at y 12-13.
    for x in range(36, 60):
        for y in (12, 13):
            if get(x, y) in (T['water'], T['shallow'], T['rock'], T['sand']):
                setr(x, y, 'dirt')
    # Hidden cache grotto: rock pocket in the forest at (8..13, 6..10).
    for y in range(4, 12):
        for x in range(5, 16):
            if not (7 <= x <= 13 and 6 <= y <= 9): setr(x, y, 'rock')
            else: setr(x, y, 'dirt')
    for y in range(10, 13): setr(10, y, 'dirt'); setr(11, y, 'dirt')

def build_cave():
    x0, y0, x1, y1 = AREAS['cave']
    for y in range(y0, y1):
        for x in range(x0, x1):
            grid[y][x] = T['cavewall']; zone[y][x] = 5
    halls = [(25, 99, 9, 5), (25, 91, 4, 4), (24, 84, 13, 5), (25, 78, 6, 3), (8, 84, 4, 4), (36, 92, 6, 4)]
    for cx, cy, rx, ry in halls:
        for y in range(cy - ry - 1, cy + ry + 2):
            for x in range(cx - rx - 1, cx + rx + 2):
                if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1 + (noise2(x, y, 3) - .5) * .35:
                    setr(x, y, 'cave')
    for y in range(103, 107): setr(24, y, 'cave'); setr(25, y, 'cave'); setr(26, y, 'cave')
    for x in range(30, 34): setr(x, 93, 'cave'); setr(x, 92, 'cave')
    # Hidden chamber link (opened by the crack): tiles x 12-13, y 84.
    for x in range(12, 15): setr(x, 84, 'cave'); setr(x, 85, 'cave')
    for y in range(87, 96): setr(25, y, 'cave'); setr(24, y, 'cave')

def build_camp():
    x0, y0, x1, y1 = AREAS['camp']
    for y in range(y0, y1):
        for x in range(x0, x1):
            zone[y][x] = 6
            e = min(x - x0, y - y0, x1 - 1 - x, y1 - 1 - y)
            grid[y][x] = T['rock'] if e < 2 + (noise2(x, y, 4) > .6) else (T['camp'] if ((x - 76) / 15) ** 2 + ((y - 87) / 9) ** 2 < 1 else T['steppe'])

# --------------------------------------------------------------- props
def free(x, y, r=1):
    tx, ty = int(x // TS), int(y // TS)
    for yy in range(ty - r, ty + r + 1):
        for xx in range(tx - r, tx + r + 1):
            if get(xx, yy) not in (T['grass'], T['steppe']): return False
    for o in objects:
        if abs(o[1] - x) < 18 and abs(o[2] - y) < 14: return False
    return True

def scatter():
    # Spawn meadow.
    obj('scar', 12 * TS, 52 * TS)
    for i in range(40):
        x, y = rnd.uniform(4, 19) * TS, rnd.uniform(38, 66) * TS
        if free(x, y, 0):
            r = rnd.random()
            if r < .3: obj('tulips', x, y, rnd.randrange(3))
            elif r < .6: obj('tallgrass', x, y)
            elif r < .72: obj('birch', x, y, rnd.randrange(2))
            elif r < .85: obj('rock', x, y, rnd.randrange(3))
            else: obj('bush', x, y, rnd.randrange(3))
    # Forest
    for i in range(420):
        x, y = rnd.uniform(3, 44) * TS, rnd.uniform(3, 30) * TS
        if 20 <= x / TS <= 32 and 14 <= y / TS <= 34: continue  # keep the path corridor lighter
        if free(x, y, 0):
            r = rnd.random()
            if r < .34: obj('poplar', x, y, rnd.randrange(2))
            elif r < .55: obj('birch', x, y, rnd.randrange(2))
            elif r < .7: obj('bush', x, y, rnd.randrange(3))
            elif r < .85: obj('tallgrass', x, y)
            elif r < .9: obj('log', x, y)
            else: obj('rock', x, y, rnd.randrange(3))
    for i in range(60):  # Willows and reeds along the river.
        y = rnd.uniform(2, 70)
        side = rnd.choice((-1, 1))
        x = (river_x(y) + side * rnd.uniform(4, 6.5)) * TS
        if free(x, y * TS, 0) or get(int(x // TS), int(y)) == T['sand']:
            obj('willow' if rnd.random() < .25 and y > 30 else 'reeds', x, y * TS)
    # Settlement (artistic reconstruction of an Upper Palaeolithic camp).
    for (k, x, y, v) in (('tent', 26, 36, 0), ('tent', 38, 35, 1), ('hut', 25, 47, 0), ('tent', 39, 48, 0),
                         ('firepit', 32, 41, 0), ('firepit', 29.5, 44.5, 0), ('meatrack', 27.5, 43, 0), ('rack', 35, 37.5, 0),
                         ('toolpile', 37.5, 41.5, 0), ('spearrack', 40, 40, 0), ('storage', 22.5, 41, 0), ('storage', 24, 39, 0),
                         ('hidemat', 31, 39.5, 0), ('hidemat', 34.5, 42.8, 0), ('basket', 28.5, 46, 0), ('basket', 36, 45.2, 0),
                         ('windbreak', 32, 33.5, 0), ('totem', 43, 42, 0), ('tusk', 21.5, 44.5, 0), ('skull', 41.5, 37, 0)):
        obj(k, x * TS, y * TS, v)
    # Hunting grounds.
    for i in range(160):
        x, y = rnd.uniform(53, 109) * TS, rnd.uniform(36, 70) * TS
        if free(x, y, 0):
            r = rnd.random()
            if r < .55: obj('feather', x, y)
            elif r < .68: obj('rock', x, y, rnd.randrange(3))
            elif r < .75: obj('bush', x, y, 0)
            elif r < .8: obj(rnd.choice(('tusk', 'ribs', 'skull')), x, y)
            elif r < .9: obj('tulips', x, y, rnd.randrange(3))
            else: obj('tallgrass', x, y)
    # Ravine
    for i in range(140):
        x, y = rnd.uniform(53, 110) * TS, rnd.uniform(3, 34) * TS
        if free(x, y, 0):
            r = rnd.random()
            if r < .35: obj('rock', x, y, rnd.randrange(4))
            elif r < .6: obj('feather', x, y)
            elif r < .7: obj('bush', x, y, 0)
            elif r < .78: obj('ribs', x, y)
            elif r < .9: obj('birch', x, y, 1)
    for (k, x, y, v) in (('firepit', 85, 19.5, 0), ('tent', 81, 16, 1), ('tent', 90, 17, 1), ('totem', 86, 14.5, 0),
                         ('meatrack', 79.5, 21, 0), ('skull', 83, 22.6, 0)):
        obj(k, x * TS, y * TS, v)
    obj('post', 89 * TS, 21 * TS, 0, tag('post'))
    obj('rock', 100 * TS, 21 * TS, 3)  # The rocks where the shadow appears.
    obj('rock', 97 * TS, 19.6 * TS, 2)
    obj('cavemouth', 102 * TS, 6.4 * TS)
    obj('boulder', 102 * TS, 7.2 * TS, 0, tag('boulder'))
    obj('plate', 98 * TS, 11 * TS, 0, tag('plate1')); obj('plate', 106 * TS, 11 * TS, 0, tag('plate2'))
    obj('lever', 94.5 * TS, 9.5 * TS, 0, tag('lever'))
    # Hidden bridge thicket (forest side) and log decals over the gorge.
    for x in range(36, 60, 2):
        if get(x, 12) == T['dirt'] and abs(x + .5 - river_x(12)) < 4:
            obj('log', x * TS + 8, 12.8 * TS)
    obj('bush', 38 * TS, 13 * TS, 0, tag('thicket')); obj('bush', 38 * TS, 12 * TS, 2, tag('thicket'))
    # Forest cache grotto entrance hidden by bushes.
    obj('bush', 10.5 * TS, 11.8 * TS, 1, tag('cachebush'))
    obj('basket', 10 * TS, 7.5 * TS, 0, tag('cache')); obj('skull', 12.5 * TS, 7 * TS)
    # Animal tracks (decals) that tell the hunter's story.
    for (x, y, v) in ((60, 49, 0), (61.5, 48.3, 0), (63, 47.6, 0), (71, 45.5, 2), (72.5, 45, 2), (79, 42.5, 3),
                      (80.5, 41.5, 3), (82, 40.5, 3), (84.5, 37.5, 2), (85, 36.2, 2), (66, 52, 1), (67, 52.6, 1)):
        obj('track', x * TS, y * TS, v)
    # Cave interior.
    for i in range(80):
        x, y = rnd.uniform(3, 47) * TS, rnd.uniform(75, 106) * TS
        tx, ty = int(x // TS), int(y // TS)
        if get(tx, ty) == T['cave'] and all(get(tx + dx, ty + dy) == T['cave'] for dx in (-1, 0, 1) for dy in (-1, 0, 1)):
            if all(abs(o[1] - x) > 20 or abs(o[2] - y) > 16 for o in objects):
                if abs(tx - 25) > 3 or ty > 104:
                    obj('stalag' if rnd.random() < .5 else 'crock', x, y, rnd.randrange(2) if rnd.random() < .5 else rnd.randrange(3))
    for i, (x, y) in enumerate(((15.5, 80.2), (21, 79.7), (29, 79.7), (34.5, 80.2))):
        obj('petro', x * TS, y * TS, i)
    obj('petro', 7 * TS, 80.6 * TS, 1)
    obj('petro', 25 * TS, 76.9 * TS, 4)
    obj('crack', 13.5 * TS, 84.7 * TS, 0, tag('crack'))
    obj('crock', 13.5 * TS, 85.4 * TS, 1, tag('crackrock'))
    obj('crystal', 26.5 * TS, 79 * TS); obj('crystal', 22.5 * TS, 78.6 * TS)
    obj('page', 25 * TS, 78.9 * TS, 0, tag('page2'))
    obj('page', 15 * TS, 50 * TS, 0, tag('page1'))
    obj('basket', 9 * TS, 86.6 * TS, 0, tag('flute')); obj('tusk', 6.5 * TS, 87 * TS)
    obj('crystal', 38 * TS, 91 * TS)
    # Camp hub.
    for (k, x, y, v) in (('ctent', 66, 84, 0), ('ctent', 86, 83, 0), ('holo', 76, 86, 0), ('cfire', 72, 91, 0),
                         ('hidemat', 70, 89, 0), ('birch', 60, 92, 0), ('birch', 92, 93, 1), ('rock', 62, 79, 2), ('rock', 90, 78, 1)):
        obj(k, x * TS, y * TS, v)
    obj('gate', 76 * TS, 79.6 * TS, 0, tag('campgate'))
    obj('gate', 25 * TS, 83.5 * TS, 0, tag('homegate'))

def emit():
    build_world(); build_cave(); build_camp(); scatter()
    objects.sort(key=lambda o: o[2])
    # Interactables
    interact('page1', 15 * TS, 50 * TS, 24, tag('page1'))
    for i, (x, y) in enumerate(((61.5, 48.3), (72, 45.2), (80.5, 41.5), (85, 36.5))):
        interact(f'track{i + 1}', x * TS, y * TS, 20)
    interact('toolpile', 37.5 * TS, 41.5 * TS, 20)
    interact('firepit', 32 * TS, 41 * TS, 22)
    interact('thicket', 38 * TS, 12.6 * TS, 24, tag('thicket'))
    interact('cachebush', 10.5 * TS, 11.8 * TS, 22, tag('cachebush'))
    interact('cache', 10 * TS, 7.5 * TS, 20, tag('cache'))
    interact('rope', 89 * TS, 21 * TS, 22, tag('post'))
    interact('boulder', 102 * TS, 8.4 * TS, 30, tag('boulder'))
    interact('lever', 94.5 * TS, 9.5 * TS, 20, tag('lever'))
    interact('cavemouth', 102 * TS, 6.6 * TS, 18)
    interact('caveexit', 25 * TS, 106 * TS, 22)
    for i, (x, y) in enumerate(((15.5, 80.2), (21, 79.7), (29, 79.7), (34.5, 80.2))):
        interact(f'petro{i + 1}', x * TS, y * TS + 6, 22)
    interact('crack', 13.5 * TS, 85.2 * TS, 22, tag('crack'))
    interact('altar', 7 * TS, 81.2 * TS, 22)
    interact('flute', 9 * TS, 86.6 * TS, 18, tag('flute'))
    interact('zmark', 25 * TS, 77.6 * TS, 20)
    interact('page2', 25 * TS, 79.2 * TS, 20, tag('page2'))
    interact('homegate', 25 * TS, 83.5 * TS, 26, tag('homegate'))
    interact('campgate', 76 * TS, 79.6 * TS, 26, tag('campgate'))
    interact('holo', 76 * TS, 86 * TS, 22)
    # Triggers (story beats when the local player walks in).
    trigger('settlement', 19, 31, 45, 52)
    trigger('hunting', 52, 38, 70, 56)
    trigger('ravine', 80, 25, 92, 30)
    trigger('shadow', 92, 17, 104, 26)
    trigger('cave_hall', 15, 94, 35, 103)
    trigger('cave_paint', 12, 77, 38, 86)
    trigger('plates', 95, 8, 109, 13)
    # NPCs: key, sheet, x, y, waypoints [(x, y, wait, anim)]
    npcs = [
        ('elder', 'ELDER', 33, 39.5, [(33, 39.5, 360, 'idle'), (34.5, 39.6, 200, 'talk'), (42, 41.5, 220, 'idle'), (33, 39.5, 300, 'idle')]),
        ('crafter', 'CRAFTER', 37.2, 40.6, [(37.2, 40.6, 520, 'work'), (39.2, 41.2, 140, 'idle'), (37.2, 40.6, 520, 'work')]),
        ('cook', 'COOK', 29, 42.5, [(29, 42.5, 420, 'work'), (24, 40.5, 160, 'work'), (27.2, 44, 300, 'work')]),
        ('scraper', 'SCRAPER', 35, 39, [(35, 39, 480, 'work'), (31.2, 43, 260, 'talk'), (35, 39, 480, 'work')]),
        ('child', 'CHILD', 30, 38, [(30, 38, 120, 'idle'), (24, 44, 60, 'idle'), (36, 46, 100, 'idle'), (41, 38, 60, 'idle'), (30, 38, 140, 'talk')]),
        ('hunter', 'HUNTER', 89.2, 21.6, [(89.2, 21.6, 600, 'sit')]),
        ('dana', 'DANA', 70, 89, [(70, 89, 400, 'idle'), (74, 88, 200, 'idle')]),
        ('erlan', 'ERLAN', 82, 89, [(82, 89, 400, 'idle'), (79, 90, 200, 'talk')]),
    ]
    # Animals: sheet, x, y (tiles)
    animals = [('SAIGA', 80, 56), ('SAIGA', 82, 57.5), ('SAIGA', 79, 58.5), ('SAIGA', 84, 55.5), ('SAIGA', 81.5, 60),
               ('SAIGA', 96, 48), ('SAIGA', 98, 49.5), ('HARE', 12, 44), ('HARE', 64, 63), ('HARE', 30, 22), ('HARE', 100, 66)]
    # Enemies: type, x, y, group. Types: 0 wolf, 1 stranger (spear), 2 archer, 3 bear.
    enemies = [(0, 75, 49, 1), (0, 77, 47.5, 1), (0, 68, 25, 2), (0, 71, 26.5, 2),
               (1, 83, 21, 3), (1, 87.5, 18.2, 3), (2, 80, 17.8, 3), (3, 25, 97.5, 4)]
    teleports = [  # from interact key -> target pixel position and zone
        ('cavemouth', 25 * TS, 104.5 * TS, 5), ('caveexit', 102 * TS, 10.2 * TS, 4),
        ('homegate', 76 * TS, 82.5 * TS, 6), ('campback', 30 * TS, 43.2 * TS, 1)]

    lines = ['// Generated by scripts/rpgart/map01.py - do not edit by hand.', '#pragma once', 'namespace tj { namespace map01 {',
             f'constexpr int MapW={MW}, MapH={MH};',
             'enum TerrainId { ' + ', '.join('TR_' + t.upper() for t in W.TERRAINS) + ', TerrainCount };']
    terr = ''.join(''.join(chr(48 + grid[y][x]) for x in range(MW)) for y in range(MH))
    zon = ''.join(''.join(chr(48 + zone[y][x]) for x in range(MW)) for y in range(MH))
    lines.append('constexpr const char terrain[]=')
    for y in range(MH): lines.append('  "' + terr[y * MW:(y + 1) * MW] + '"')
    lines.append(';')
    lines.append('constexpr const char zones[]=')
    for y in range(MH): lines.append('  "' + zon[y * MW:(y + 1) * MW] + '"')
    lines.append(';')
    lines.append('struct Area { short x0,y0,x1,y1; };')
    lines.append('constexpr Area areas[]={' + ','.join('{%d,%d,%d,%d}' % (a[0] * TS, a[1] * TS, a[2] * TS, a[3] * TS) for a in AREAS.values()) + '};')
    lines.append('constexpr int areaOfZone[7]={0,0,0,0,0,1,2};')
    lines.append('enum KindId { ' + ', '.join('K_' + k[0].upper() for k in KINDS) + ', KindCount };')
    lines.append('struct Kind { short sprite,frames,anim,hw,hh,flags; };')
    lines.append('constexpr Kind kinds[KindCount]={' + ','.join('{art::%s,%d,%d,%d,%d,%d}' % (k[1], k[2], k[3], k[4], k[5], k[6]) for k in KINDS) + '};')
    lines.append('enum TagId { ' + ', '.join('TAG_' + t.upper() for t in TAGS) + ', TagCount };')
    lines.append('struct Obj { unsigned char kind,variant,tag; short x,y; };')
    lines.append(f'constexpr int ObjCount={len(objects)};')
    lines.append('constexpr Obj objs[ObjCount]={' + ','.join('{%d,%d,%d,%d,%d}' % (o[0], o[3], o[4], o[1], o[2]) for o in objects) + '};')
    lines.append('struct IaDef { short x,y,r; unsigned char tag; };')
    lines.append('enum InteractId { ' + ', '.join('IA_' + i[0].upper() for i in interacts) + ', InteractCount };')
    lines.append('constexpr IaDef interacts[InteractCount]={' + ','.join('{%d,%d,%d,%d}' % (i[1], i[2], i[3], i[4]) for i in interacts) + '};')
    lines.append('struct Trigger { short x0,y0,x1,y1; };')
    lines.append('enum TriggerId { ' + ', '.join('TG_' + t[0].upper() for t in triggers) + ', TriggerCount };')
    lines.append('constexpr Trigger triggers[TriggerCount]={' + ','.join('{%d,%d,%d,%d}' % t[1:] for t in triggers) + '};')
    lines.append('struct Way { short x,y,wait; unsigned char anim; };')
    lines.append('struct NpcDef { unsigned char sheet,ways; short x,y; Way way[5]; };')
    lines.append('enum NpcId { ' + ', '.join('NPC_' + n[0].upper() for n in npcs) + ', NpcCount };')
    rows = []
    for key, sheet, x, y, ways in npcs:
        wl = ','.join('{%d,%d,%d,art::A_%s}' % (wx * TS, wy * TS, wt, a.upper()) for wx, wy, wt, a in ways)
        rows.append('{art::SH_%s,%d,%d,%d,{%s}}' % (sheet, len(ways), x * TS, y * TS, wl))
    lines.append('constexpr NpcDef npcDefs[NpcCount]={' + ','.join(rows) + '};')
    lines.append('struct AnimalDef { unsigned char sheet; short x,y; };')
    lines.append(f'constexpr int AnimalCount={len(animals)};')
    lines.append('constexpr AnimalDef animalDefs[AnimalCount]={' + ','.join('{art::SH_%s,%d,%d}' % (s, x * TS, y * TS) for s, x, y in animals) + '};')
    lines.append('struct EnemyDef { unsigned char type,group; short x,y; };')
    lines.append(f'constexpr int EnemyCount={len(enemies)};')
    lines.append('constexpr EnemyDef enemyDefs[EnemyCount]={' + ','.join('{%d,%d,%d,%d}' % (t, g, x * TS, y * TS) for t, x, y, g in enemies) + '};')
    lines.append('struct Teleport { short x,y,zone; };')
    lines.append('constexpr Teleport teleports[]={' + ','.join('{%d,%d,%d}' % (t[1], t[2], t[3]) for t in teleports) + '};')
    lines.append(f'constexpr int SpawnX={12 * TS}, SpawnY={int(53.5 * TS)};')
    lines.append('}}')
    with open(os.path.join(ROOT, 'src/rpg/gen/map01.hpp'), 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines) + '\n')
    meta = dict(size=[MW, MH], tile=TS, areas=AREAS, interacts=[i[0] for i in interacts], triggers=[t[0] for t in triggers],
                npcs=[n[0] for n in npcs], tags=TAGS, teleports=[t[0] for t in teleports],
                enemies=[dict(type=t, group=g) for t, x, y, g in enemies],
                interactPos={i[0]: [i[1], i[2]] for i in interacts}, npcPos={n[0]: [n[2] * TS, n[3] * TS] for n in npcs})
    with open(os.path.join(ROOT, 'src/rpg/gen/map01.js'), 'w', encoding='utf-8') as f:
        f.write('// Generated by scripts/rpgart/map01.py - do not edit by hand.\n')
        f.write('export const MAP01 = ' + json.dumps(meta, ensure_ascii=False, separators=(',', ':')) + ';\n')
    print(f'map {MW}x{MH}: {len(objects)} objects, {len(interacts)} interactables, {len(triggers)} triggers')

if __name__ == '__main__':
    emit()
