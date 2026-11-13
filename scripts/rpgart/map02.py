"""MAP02 «Күлге көмілген шындық» — bronze-age settlement (hand-designed layout).

Areas: 'world' (zones 0-7) and the underground below the forge (zone 8).
Zones: 0 outskirts, 1 central square, 2 dwellings, 3 forge quarter, 4 granary,
       5 pastures, 6 sanctuary, 7 burial ground, 8 underground.
"""
import math, os, random, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from rpgart.core import fbm, noise2
from rpgart.levelgen import Level, TS

L = Level('map02', 100, 108)
rnd = random.Random(1201)
P = lambda x, y: (x * TS, y * TS)

def blob(cx, cy, rx, ry, t, jag=.25, seed=0, only=None):
    for y in range(int(cy - ry - 2), int(cy + ry + 3)):
        for x in range(int(cx - rx - 2), int(cx + rx + 3)):
            d = ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2
            if d <= 1 + (noise2(x, y, seed + 3) - .5) * jag and (only is None or L.get(x, y) in only):
                L.set(x, y, t)

def path(pts, w=1.2, t='clay'):
    for (ax, ay), (bx, by) in zip(pts, pts[1:]):
        n = int(max(abs(bx - ax), abs(by - ay)) * 3) + 1
        for i in range(n + 1):
            px, py = ax + (bx - ax) * i / n, ay + (by - ay) * i / n
            for y in range(int(py - w - 1), int(py + w + 2)):
                for x in range(int(px - w - 1), int(px + w + 2)):
                    if math.hypot(x + .5 - px, y + .5 - py) < w + noise2(x, y, 9) * .5 and L.get(x, y) not in (L.T['rock'], L.T['water']):
                        L.set(x, y, t)

def build_world():
    W, H = 100, 68
    T = L.T
    for y in range(H):
        for x in range(W):
            n = fbm(x, y, 12, 3, 41)
            L.grid[y][x] = T['grass'] if n > .62 else T['steppe']
            # zones (refined below)
            z = 0
            if 40 <= x < 62 and y < 17: z = 6
            elif x < 32 and y < 24: z = 5
            elif 62 <= x < 88 and 18 <= y < 42: z = 3
            elif 40 <= x < 62 and 42 <= y < 60: z = 4
            elif x >= 64 and y >= 42: z = 7
            elif 24 <= x < 40 and 20 <= y < 52: z = 2
            elif 40 <= x < 62 and 17 <= y < 42: z = 1
            L.zone[y][x] = z
    # Border cliffs with a gap only at the south-west road.
    for y in range(H):
        for x in range(W):
            e = min(x, y, W - 1 - x, H - 1 - y)
            if e < 2 + (noise2(x, y, 5) > .55): L.set(x, y, 'rock')
    # Stream along the west edge, crossed by stepping stones (shallow).
    for y in range(2, H - 2):
        cx = 9 + 2.2 * math.sin(y / 6.5)
        for x in range(int(cx - 3), int(cx + 4)):
            d = abs(x + .5 - cx)
            if d < 1.4: L.set(x, y, 'water')
            elif d < 2.2: L.set(x, y, 'shallow')
            elif d < 3.2 and L.get(x, y) != T['rock']: L.set(x, y, 'sand')
    for y in (39, 40, 41):
        cx = 9 + 2.2 * math.sin(y / 6.5)
        for x in range(int(cx - 3), int(cx + 4)):
            if L.get(x, y) == T['water']: L.set(x, y, 'shallow')
    # Sanctuary hill: rocky rim, paved top.
    blob(51, 9, 12, 7, 'rock', .4, 11)
    blob(51, 9.5, 9.5, 5.5, 'pave', .2, 12)
    for x in range(48, 55):
        for y in range(14, 18): L.set(x, y, 'clay')              # ramp down to the square
    # Central square, dwellings, forge quarter, granary
    blob(51, 31, 10, 7.5, 'clay', .25, 21)
    blob(51, 31, 4.5, 3, 'pave', .1, 22)
    blob(32, 36, 7, 15, 'clay', .35, 23, only=(T['grass'], T['steppe']))
    blob(74, 30, 11, 9, 'ash', .35, 24)
    blob(74, 30, 6, 4, 'clay', .3, 25)
    blob(51, 50, 9, 6, 'clay', .3, 26)
    # Hidden workshop: a rock pocket south-east of the granary with one narrow entrance.
    for y in range(51, 59):
        for x in range(60, 69): L.set(x, y, 'rock')
    for y in range(53, 57):
        for x in range(62, 67): L.set(x, y, 'ash')
    L.set(61, 55, 'ash'); L.set(60, 55, 'ash'); L.set(61, 54, 'ash'); L.set(60, 54, 'ash')
    # Pastures
    blob(16, 13, 12, 8, 'grass', .3, 31, only=(T['steppe'],))
    # Burial ground: dry steppe with pale earth around the monuments
    blob(80, 55, 13, 8, 'steppe', .3, 41)
    blob(87, 58, 6, 4, 'dirt', .3, 42)
    # Roads
    path([(6, 62), (14, 56), (20, 48), (28, 40), (40, 33), (46, 32)], 1.3)
    path([(56, 32), (63, 31), (68, 30)], 1.3)
    path([(51, 38), (51, 44)], 1.2)
    path([(42, 27), (34, 20), (26, 16)], 1.0)
    path([(58, 38), (66, 44), (76, 50)], 1.0, 'dirt')
    path([(12, 40), (20, 40)], 1.0, 'dirt')
    # Ash trails around the furnaces and the dead hearth
    blob(51, 31, 2.5, 1.6, 'ash', .1, 51)

def build_under():
    T = L.T
    for y in range(70, 108):
        for x in range(0, 56):
            L.grid[y][x] = T['deepwall']; L.zone[y][x] = 8
    halls = [(27, 102, 5, 3), (27, 95, 11, 4), (27, 84, 7, 4), (44, 82, 8, 7), (8, 87, 4, 3), (40, 96, 6, 3)]
    for i, (cx, cy, rx, ry) in enumerate(halls):
        blob(cx, cy, rx, ry, 'deep', .3, 60 + i)
    for y in range(87, 92): L.set(27, y, 'deep'); L.set(28, y, 'deep')     # hall -> tablet chamber
    for x in range(33, 38): L.set(x, 84, 'deep'); L.set(x, 85, 'deep')    # tablet chamber -> boss sanctum
    for x in range(37, 41): L.set(x, 96, 'deep'); L.set(x, 97, 'deep')    # hall -> wraith gallery
    for y in range(99, 101): L.set(27, y, 'deep')
    for x in range(12, 17): L.set(x, 89, 'deep'); L.set(x, 90, 'deep')    # secret room link (ash wall)

def place():
    o, t = L.obj, L.tag
    # ---- outskirts (arrival)
    for x, y, v in ((5, 30, 0), (18, 26, 1), (14, 50, 0), (21, 60, 1), (4, 46, 1), (19, 34, 0)): o('deadtree', *P(x, y), v)
    for x, y in ((7, 36), (13, 44), (16, 58), (11, 28), (22, 52)): o('reeds' if x < 13 else 'feather', *P(x, y))
    for x, y, v in ((16, 47, 2), (22, 56, 1), (6, 54, 1), (24, 44, 0)): o('rock', *P(x, y), v)
    o('ashpile', *P(13, 60)); o('symbol', *P(15, 61))
    # ---- central square: the dead sacred hearth, people, torches
    o('hearth', *P(51, 31.6), 0, t('hearthcold'))
    o('hearth', *P(51, 31.6), 1, t('hearthlit', hidden=True))
    o('hearthfire', *P(51, 31.2), 0, t('hearthfire', hidden=True))
    for x, y in ((44, 26), (58, 26), (44, 36.5), (58, 36.5)): o('torch', *P(x, y))
    for x, y, v in ((46, 34, 0), (56, 28, 2), (55, 35, 1)): o('jar', *P(x, y), v)
    o('altar', *P(51, 24.5))
    o('menhir', *P(41.5, 31), 1); o('menhir', *P(60.5, 31), 1)
    # ---- dwellings quarter
    for (x, y, v, tg) in ((30, 25, 0, ''), (28, 35.5, 1, 'doorhouse'), (33, 45.5, 0, ''), (37, 22, 1, '')):
        o('dugout', *P(x, y), v, t(tg) if tg else 0)
    for x, y, v in ((25, 30, 0), (35, 40, 2), (26, 41, 1), (36, 30, 0)): o('jar', *P(x, y), v)
    o('quern', *P(31, 39.5)); o('fence', *P(26, 48.5), 1); o('symbol', *P(29.5, 37.6), 0, t('doorsymbol'))
    o('rock', *P(24.5, 26.5), 1, t('loosestone'))
    o('sheaf', *P(38.5, 34)); o('sheaf', *P(24, 34.5))
    # ---- forge quarter
    o('furnacecold', *P(68, 26), 0, t('furnacecold1')); o('furnace', *P(68, 26), 0, t('furnacelit1', hidden=True))
    o('furnacecold', *P(80, 27), 0, t('furnacecold2')); o('furnace', *P(80, 27), 0, t('furnacelit2', hidden=True))
    o('furnacecold', *P(76, 36), 0, t('furnacecold3')); o('furnace', *P(76, 36), 0, t('furnacelit3', hidden=True))
    o('anvil', *P(73, 30.2)); o('bellows', *P(66.5, 27.2)); o('bellows', *P(81.6, 28.4))
    o('trapdoor', *P(73, 32.8), 0, t('trapdoor'))
    o('trapdoor', *P(73, 32.8), 1, t('trapopen', hidden=True))
    o('toolrack', *P(70, 23.5)); o('dugout', *P(80, 21.5), 1)
    o('mould', *P(70.5, 32)); o('crucible', *P(75.5, 31.5)); o('mould', *P(78, 33))
    o('charcoal', *P(84, 31)); o('ore', *P(84.5, 35)); o('slag', *P(66, 33)); o('slag', *P(79, 39)); o('ashpile', *P(70, 37))
    for x, y in ((64.5, 24), (84, 24.5), (64.5, 37)): o('torch', *P(x, y))
    o('symbol', *P(72, 34.6), 0, t('forgetrack'))
    # ---- granary
    for x, y in ((46, 48), (51, 47), (56, 48), (47, 52.5), (55, 52.5)): o('grainpit', *P(x, y))
    for x, y, v in ((44, 50, 0), (44, 51.4, 2), (58, 50, 0), (58.6, 51.6, 1), (52, 54.5, 0)): o('jar', *P(x, y), v)
    o('quern', *P(50, 51)); o('quern', *P(53, 50.6)); o('sheaf', *P(48.5, 45.5)); o('sheaf', *P(54, 45.4))
    o('sheaf', *P(59.6, 54.6), 0, t('sheafstack')); o('sheaf', *P(59.6, 55.4), 0, t('sheafstack'))
    o('furnacecold', *P(64.5, 54)); o('mould', *P(63, 56), 0, t('hiddenmould')); o('crucible', *P(66, 56)); o('ashpile', *P(64, 55.6))
    # ---- pastures
    for x0, y0, x1, y1 in ((6, 7, 18, 16), (19, 9, 28, 19)):
        for x in range(x0, x1, 2): o('fence', *P(x + 1, y0), 0); o('fence', *P(x + 1, y1), 1 if x % 4 else 0)
    o('dugout', *P(24, 4.5), 0)
    for x, y in ((8, 20), (12, 21), (27, 21), (4, 13), (22, 6)): o('tallgrass', *P(x, y))
    o('sheaf', *P(17, 21)); o('jar', *P(25.5, 7.5), 1)
    # ---- sanctuary
    for i in range(8):
        a = i / 8 * math.pi * 2
        o('menhir', *P(51 + math.cos(a) * 7.5, 9.5 + math.sin(a) * 4.2), 0 if i % 2 else 1)
    o('pgstone', *P(44.5, 7), 0); o('pgstone', *P(57.5, 7.4), 1); o('pgstone', *P(51, 5.2), 2, t('pgaibar'))
    o('cist', *P(51, 11.6)); o('brazier', *P(47.5, 12)); o('brazier', *P(54.5, 12))
    # ---- burial ground
    for x, y in ((72, 48), (90, 47), (76, 62), (68, 57)): o('kurgan', *P(x, y))
    for x, y in ((80, 51), (84, 63), (73, 54)): o('cist', *P(x, y))
    o('mausoleum', *P(88, 58.4), 0, t('mausoleum'))
    for x, y, v in ((82, 45, 1), (94, 52, 0), (70, 64, 1)): o('deadtree', *P(x, y), v)
    for x, y in ((78, 58), (92, 62), (66, 50)): o('feather', *P(x, y))
    # ---- underground
    o('stairs', *P(27, 104)); o('beam', *P(23.5, 101)); o('beam', *P(30.5, 101))
    for i, x in enumerate((19, 24.5, 30, 35.5)): o('mural', *P(x, 91.6), i)
    for x, y in ((18, 96), (36, 96), (22, 99), (32, 99)): o('ember', *P(x, y), int(x) % 3)
    o('beam', *P(20, 93.5)); o('beam', *P(34, 93.5))
    o('crock', *P(12.5, 89.2), 2, t('ashwall')); o('crock', *P(12.5, 90.7), 2, t('ashwall')); o('ashpile', *P(14.5, 90))
    o('pillar', *P(6.5, 85.4), 1, t('instpillar')); o('pillar', *P(10, 85.4), 0); o('crucible', *P(8, 88.6), 0, t('tinstone'))
    o('tablet', *P(27, 81.6), 0, t('tablet'))
    for x, y in ((23.5, 82), (30.5, 82)): o('torch', *P(x, y))
    o('brazier', *P(44, 80), 0, t('keeperfire')); o('ember', *P(40, 84)); o('ember', *P(48, 85)); o('ember', *P(44, 87))
    for x, y in ((38.5, 78.5), (49.5, 78.5)): o('pillar', *P(x, y), 0)
    for x, y in ((42, 96), (45, 95)): o('ember', *P(x, y))
    o('crock', *P(44, 97.5), 1)

def emit():
    build_world(); build_under(); place()
    I = L.interact; tag = L.tag
    I('hearth', *P(51, 32.2), 30)
    I('brokenaxe', *P(70.5, 32.4), 20)
    I('forgetrack', *P(72, 34.8), 20, tag('forgetrack'))
    I('bracelet', *P(34.5, 41.5), 18)
    I('doorsymbol', *P(29.5, 37.8), 20, tag('doorsymbol'))
    I('secretnote', *P(24.5, 26.8), 18, tag('loosestone'))
    I('granary', *P(51, 47.8), 24)
    I('pgaibar', *P(51, 6.2), 22, tag('pgaibar'))
    I('cist', *P(51, 12.4), 24)
    I('mausoleum', *P(88, 59.2), 28, tag('mausoleum'))
    I('sheafstack', *P(59.6, 55.6), 20, tag('sheafstack'))
    I('hiddenmould', *P(63, 56.2), 20, tag('hiddenmould'))
    I('trapdoor', *P(73, 33.2), 22, tag('trapdoor'))
    I('stairsup', *P(27, 104.4), 22)
    for i, x in enumerate((19, 24.5, 30, 35.5)): I(f'mural{i + 1}', *P(x, 92.4), 22)
    I('ashwall', *P(13.8, 89.6), 22, tag('ashwall'))
    I('instpillar', *P(6.5, 86), 20, tag('instpillar'))
    I('tinstone', *P(8, 88.8), 18, tag('tinstone'))
    I('tablet', *P(27, 82.6), 22, tag('tablet'))
    I('keeperfire', *P(44, 81), 24, tag('keeperfire'))
    I('sakagate', *P(51, 25.2), 26)
    for key, x0, y0, x1, y1 in (('square', 41, 24, 61, 39), ('forge', 63, 22, 86, 40), ('sanctuary', 42, 3, 60, 14),
                               ('murals', 14, 90, 40, 99), ('arena', 37, 76, 52, 89), ('burial', 66, 44, 96, 66), ('workshop', 61, 53, 67, 57)):
        L.trigger(key, x0, y0, x1, y1)
    W_ = lambda *a: a
    L.npc('elder', 'MATRIARCH', 49, 29, [W_(49, 29, 420, 'idle'), W_(53, 29.2, 260, 'talk'), W_(51, 26, 300, 'idle', 0)])
    L.npc('smith', 'SMITH', 72, 30.6, [W_(72, 30.6, 520, 'work', 2), W_(69, 29, 200, 'idle'), W_(72, 30.6, 520, 'work', 2), W_(77, 33, 240, 'idle')])
    L.npc('guard', 'GUARD', 45, 33, [W_(45, 33, 380, 'idle', 6), W_(45, 27, 300, 'idle', 6), W_(57, 27, 300, 'idle', 2), W_(57, 35, 300, 'idle', 2)])
    L.npc('shepherd', 'SHEPHERD', 14, 18, [W_(14, 18, 240, 'idle'), W_(22, 15, 140, 'idle'), W_(10, 11, 160, 'idle'), W_(24, 20, 120, 'talk')], runner=True)
    L.npc('grainkeeper', 'GRAINKEEPER', 50, 49.4, [W_(50, 49.4, 400, 'work', 4), W_(46, 46.5, 200, 'idle'), W_(55, 50.6, 360, 'work', 4)])
    L.npc('villager1', 'VILLAGER', 31, 31, [W_(31, 31, 300, 'work', 4), W_(36, 37, 200, 'idle'), W_(28, 42, 260, 'talk')])
    L.npc('villager2', 'VILLAGERW', 35, 27, [W_(35, 27, 320, 'work', 4), W_(46, 37, 220, 'talk'), W_(30, 45, 240, 'idle')])
    L.npc('missing1', 'VILLAGER', 48, 34.5, [W_(48, 34.5, 600, 'sit')], inactive=True)
    L.npc('missing2', 'VILLAGERW', 54, 34.5, [W_(54, 34.5, 600, 'sit')], inactive=True)
    L.npc('missing3', 'VILLAGER', 51, 36, [W_(51, 36, 600, 'sit')], inactive=True)
    L.npc('smithdown', 'SMITH', 25, 96.5, [W_(25, 96.5, 600, 'idle')], inactive=True)
    L.animals.extend([('COW', 9, 10), ('COW', 13, 12.5), ('COW', 22, 13), ('COW', 25, 16), ('SHEEP', 10, 13.5), ('SHEEP', 15, 9.5),
                      ('SHEEP', 21, 11), ('SHEEP', 24, 12), ('SHEEP', 12, 15), ('SHEEP', 17, 13)])
    # Enemies: 0 wolf, 1 raider (spear), 2 raider (bow), 4 shade, 5 wraith, 6 keeper.  (type, x, y, group)
    L.enemies.extend([(0, 78, 60, 1), (0, 82, 61.5, 1),
                      (1, 16, 33, 2), (2, 20, 30.5, 2),
                      (4, 47, 8.5, 3), (4, 55, 8.5, 3), (4, 51, 12.8, 3),
                      (5, 42, 96, 4), (5, 46, 97.5, 4), (5, 20, 84.5, 4),
                      (6, 44, 84, 5), (5, 39, 79.5, 6), (5, 49, 79.5, 6)])
    L.enemy_sheets = {0: 'WOLF', 1: 'RAIDER', 2: 'RAIDER', 3: 'BEAR', 4: 'SHADE', 5: 'WRAITH', 6: 'KEEPER'}
    L.pickups = [(4, 6, 18, 49), (9, 2, 26, 22), (4, 8, 82, 38), (9, 1, 60, 41), (5, 1, 94, 50), (4, 6, 46, 15),
                 (9, 2, 22, 100), (4, 8, 40, 98), (5, 1, 33, 86), (9, 2, 48, 92)]
    L.area('world', 0, 0, 100, 68)
    L.area('under', 0, 70, 56, 108, dark=(46, 34, 40), outdoor=False)
    L.zone_area = [0, 0, 0, 0, 0, 0, 0, 0, 1]
    L.zone_fx = [4, 4, 4, 12, 4, 0, 4, 4, 8]
    L.teleports = ['trapdoor', 'stairsup']
    L.spawn = (12, 62)
    L.write()

if __name__ == '__main__':
    emit()
