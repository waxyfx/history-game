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
from rpgart.levelgen import Level
LV = Level('map01', MW, MH)
T = LV.T
grid = LV.grid
zone = LV.zone
rnd = random.Random(2087)

AREAS = {  # name: (x0, y0, x1, y1) in tiles, inclusive-exclusive
    'world': (0, 0, 112, 72),
    'cave': (0, 73, 50, 108),
    'camp': (54, 73, 98, 102),
}

objects = LV.objects   # (kind, x, y, variant, tag)
TAGS = LV.tags
def tag(name, hidden=False):
    return LV.tag(name, hidden)
def obj(kind, x, y, variant=0, t=0):
    LV.obj(kind, x, y, variant, t)

interacts = LV.interacts  # (key, x, y, radius, tag)
def interact(key, x, y, r=22, t=0):
    LV.interact(key, x, y, r, t)
triggers = LV.triggers   # (key, x0, y0, x1, y1) in pixels
def trigger(key, x0, y0, x1, y1):
    LV.trigger(key, x0, y0, x1, y1)

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
    obj('gate', 25 * TS, 83.5 * TS, 0, tag('homegate', hidden=True))

def emit():
    build_world(); build_cave(); build_camp(); scatter()
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
        ('crafter', 'CRAFTER', 37.2, 40.6, [(37.2, 40.6, 520, 'work', 2), (39.2, 41.2, 140, 'idle'), (37.2, 40.6, 520, 'work', 2)]),
        ('cook', 'COOK', 29, 42.5, [(29, 42.5, 420, 'work'), (24, 40.5, 160, 'work'), (27.2, 44, 300, 'work')]),
        ('scraper', 'SCRAPER', 35, 39, [(35, 39, 480, 'work', 0), (31.2, 43, 260, 'talk'), (35, 39, 480, 'work', 0)]),
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

    for key, sheet, x, y, ways in npcs:
        LV.npc(key, sheet, x, y, ways, inactive=key in ('dana', 'erlan'), runner=key == 'child')
    LV.animals.extend(animals)
    LV.enemies.extend(enemies)
    LV.teleports = [t[0] for t in teleports]
    LV.area('world', *AREAS['world'])
    LV.area('cave', *AREAS['cave'], dark=(52, 58, 72), outdoor=False)
    LV.area('camp', *AREAS['camp'])
    LV.zone_area = [0, 0, 0, 0, 0, 1, 2]
    LV.zone_fx = [0, 0, 0, 1, 0, 2, 0]
    LV.enemy_sheets = {0: 'WOLF', 1: 'STRANGER', 2: 'ARCHER', 3: 'BEAR'}
    # item ids: 4 arrows, 5 kit, 9 herbs; shared consumables 20 big herb, 21 strength, 22 guard, 23 swift.
    # New entries are appended so the pickup bits of existing saves keep their meaning.
    LV.pickups = [(9, 2, 9, 45), (4, 6, 62.5, 50), (9, 1, 70, 61), (5, 1, 27, 22), (4, 8, 84, 26),
                  (9, 2, 30, 97), (4, 6, 37, 92), (9, 2, 66, 29), (4, 5, 104, 40), (9, 1, 18, 24),
                  (21, 1, 86, 30),   # strength: on the path from the last track to the strangers' camp
                  (22, 1, 28, 102),  # guard: cave entrance, before the bear
                  (23, 1, 95, 26),   # swift: exploration, the far edge of the ravine
                  (20, 1, 9, 82),    # big herb: secret chamber behind the crack
                  (9, 1, 40, 47)]    # small herb on the road out of the settlement
    LV.spawn = (12, 53.5)
    LV.write()

if __name__ == '__main__':
    emit()
