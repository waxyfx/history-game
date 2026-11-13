"""MAP03 «Сақтар әлемі» — a Saka settlement in the Zhetysu foothills (hand-designed layout).

Areas: 'world' (zones 0-9), 'tomb' under the royal kurgan (zones 10-11), 'camp' — the Chroniclers' Camp (zone 12).
Zones: 0 steppe, 1 assembly square, 2 felt tents, 3 goldsmith's workshop, 4 pastures, 5 warriors' camp,
       6 kurgan field, 7 sacred hill, 8 foothills, 9 the ford (attack site), 10 the royal tomb, 11 mirror chamber,
       12 Chroniclers' Camp.
"""
import math, os, random, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from rpgart.core import fbm, noise2
from rpgart.levelgen import Level, TS

W, H = 112, 118
L = Level('map03', W, H)
rnd = random.Random(1303)
P = lambda x, y: (x * TS, y * TS)

def blob(cx, cy, rx, ry, t, jag=.25, seed=0, only=None):
    for y in range(int(cy - ry - 2), int(cy + ry + 3)):
        for x in range(int(cx - rx - 2), int(cx + rx + 3)):
            d = ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2
            if d <= 1 + (noise2(x, y, seed + 3) - .5) * jag and (only is None or L.get(x, y) in only):
                L.set(x, y, t)

def path(pts, w=1.2, t='dirt'):
    for (ax, ay), (bx, by) in zip(pts, pts[1:]):
        n = int(max(abs(bx - ax), abs(by - ay)) * 3) + 1
        for i in range(n + 1):
            px, py = ax + (bx - ax) * i / n, ay + (by - ay) * i / n
            for y in range(int(py - w - 1), int(py + w + 2)):
                for x in range(int(px - w - 1), int(px + w + 2)):
                    if math.hypot(x + .5 - px, y + .5 - py) < w + noise2(x, y, 9) * .5 and L.get(x, y) not in (L.T['rock'], L.T['water'], L.T['snowrock']):
                        L.set(x, y, t)

WY = 76   # world rows 0..75

def build_world():
    T = L.T
    for y in range(WY):
        for x in range(W):
            n = fbm(x, y, 11, 3, 77)
            t = 'meadow' if (y < 30 and n > .38) or n > .7 else 'grass' if n > .52 else 'steppe'
            L.grid[y][x] = T[t]
            z = 0
            if y < 8: z = 8
            elif 50 <= x < 74 and y < 22: z = 7
            elif x >= 80 and y < 36: z = 6
            elif 26 <= x < 50 and y < 28: z = 4
            elif 8 <= x < 32 and 30 <= y < 50: z = 9
            elif 46 <= x < 66 and 30 <= y < 48: z = 1
            elif 32 <= x < 46 and 28 <= y < 58: z = 2
            elif 46 <= x < 68 and 48 <= y < 62: z = 3
            elif 68 <= x < 90 and 36 <= y < 56: z = 5
            L.zone[y][x] = z
    # Snowy ridge of the Tien Shan foothills along the north, rock elsewhere around the edge.
    for x in range(W):
        h = 3 + int(noise2(x // 3, 0, 5) * 3)
        for y in range(h): L.set(x, y, 'snowrock')
        for y in range(h, h + 2 + int(noise2(x, 1, 6) * 2)): L.set(x, y, 'rock')
    for y in range(WY):
        for x in range(W):
            e = min(x, W - 1 - x, WY - 1 - y)
            if e < 2 + (noise2(x, y, 5) > .6): L.set(x, y, 'rock')
    # Mountain river from the ridge to the south, a ford of stones at the attack site.
    for y in range(4, WY - 2):
        cx = 20 + 3 * math.sin(y / 9) + (y > 50) * (y - 50) * .12
        for x in range(int(cx - 4), int(cx + 5)):
            d = abs(x + .5 - cx)
            if d < 1.6: L.set(x, y, 'water')
            elif d < 2.4: L.set(x, y, 'shallow')
            elif d < 3.4 and L.get(x, y) != T['rock']: L.set(x, y, 'sand')
    for y in range(38, 43):
        cx = 20 + 3 * math.sin(y / 9)
        for x in range(int(cx - 3), int(cx + 4)):
            if L.get(x, y) == T['water']: L.set(x, y, 'shallow')
    # Rocky outcrops in the kurgan field and on the sacred hill.
    blob(62, 13, 11, 7, 'rock', .4, 31)
    blob(62, 13.5, 8.5, 5.2, 'pave', .2, 32)
    for x in range(59, 66):
        for y in range(18, 23): L.set(x, y, 'dirt')      # path up the hill
    blob(104, 44, 5, 4, 'rock', .5, 33); blob(76, 66, 4, 3, 'rock', .5, 34); blob(40, 66, 3, 2.5, 'rock', .5, 35)
    # Settlement: trampled square, tent ground, workshop, warriors' camp.
    blob(56, 39, 9, 6.5, 'dirt', .3, 41)
    blob(40, 42, 7, 13, 'grass', .2, 42, only=(T['steppe'], T['meadow']))
    blob(57, 55, 8, 5, 'dirt', .3, 43)
    blob(78, 45, 9, 8, 'dirt', .3, 44)
    blob(94, 21, 13, 10, 'steppe', .3, 45)
    path([(10, 66), (18, 60), (28, 50), (36, 45), (47, 41)], 1.3)
    path([(65, 40), (70, 42), (76, 45)], 1.2)
    path([(56, 45), (56, 51)], 1.1)
    path([(60, 33), (62, 22)], 1.0)
    path([(66, 36), (80, 30), (90, 26)], 1.0, 'steppe')
    path([(40, 30), (38, 22), (34, 16)], 1.0, 'steppe')
    path([(29, 41), (24, 40), (14, 40)], 1.0, 'dirt')

TY = 80   # tomb rows 80..117 (x 0..64); camp x 68..111

def build_tomb():
    for y in range(TY, H):
        for x in range(0, 66):
            L.grid[y][x] = L.T['logwall']; L.zone[y][x] = 10
    L.fill(30, 104, 35, 116, 'cave')                     # robbers' tunnel (dug in antiquity)
    L.fill(16, 96, 49, 104, 'timber')                    # hall of the tomb
    L.fill(4, 96, 15, 104, 'timber'); L.fill(14, 99, 17, 102, 'timber')      # horse burial
    L.fill(50, 96, 60, 104, 'timber'); L.fill(48, 99, 51, 102, 'timber')     # treasury
    L.fill(30, 92, 35, 97, 'timber')                     # passage to the great chamber
    L.fill(12, 84, 53, 93, 'timber')                     # great chamber (arena)
    L.fill(30, 83, 35, 85, 'timber')                     # sealed passage
    L.fill(22, 81, 43, 84, 'timber')                     # mirror chamber
    for y in range(81, 84):
        for x in range(22, 43): L.zone[y][x] = 11
    for y in range(104, 116):
        for x in range(30, 35): L.set(x, y, 'cave')
    for y in range(103, 117):
        for x in (29, 35):
            if L.get(x, y) == L.T['logwall']: L.set(x, y, 'cavewall')

def build_camp():
    for y in range(TY, H):
        for x in range(66, W):
            L.grid[y][x] = L.T['rock']; L.zone[y][x] = 12
    blob(89, 99, 18, 14, 'camp', .25, 51)
    blob(89, 99, 21, 16, 'grass', .2, 52, only=(L.T['rock'],))
    blob(89, 99, 18, 14, 'camp', .25, 51)
    for y in range(TY, H):
        for x in range(66, W):
            e = min(x - 66, W - 1 - x, y - TY, H - 1 - y)
            if e < 2: L.set(x, y, 'rock')

def place():
    o, t = L.obj, L.tag
    # ---- steppe arrival
    o('gate', *P(10, 65), 0)
    for x, y in ((14, 70), (30, 66), (44, 70), (60, 68), (86, 62), (96, 70), (70, 60)): o('feather', *P(x, y))
    for x, y, v in ((24, 72, 1), (50, 66, 2), (80, 70, 1), (100, 58, 0)): o('rock', *P(x, y), v)
    for x, y in ((36, 60), (52, 70), (90, 66)): o('tulips', *P(x, y), rnd.randrange(3))
    # ---- assembly square: fire, standards, cauldron, the elders' felt
    o('firepit', *P(56, 39.4))
    o('standard', *P(51, 35)); o('standard', *P(61, 35)); o('standard', *P(56, 33.4))
    o('cauldron', *P(52.5, 41.5)); o('wagon', *P(64, 44)); o('hitch', *P(48, 44))
    # ---- felt tents
    for x, y, v in ((37, 33, 0), (44, 32, 1), (36, 41, 1), (43, 47, 0), (36, 52, 0)): o('yurt', *P(x, y), v)
    o('yurt', *P(42.5, 39), 0, t('ulpanyurt'))
    o('wagon', *P(46, 53)); o('jar', *P(40, 36), 0); o('jar', *P(33.5, 45), 2); o('hitch', *P(33, 56))
    # ---- goldsmith's workshop
    o('goldtable', *P(56, 54.4)); o('furnace', *P(51.5, 52)); o('anvil', *P(53.5, 55.4)); o('weaponrack', *P(61, 52.4))
    o('charcoal', *P(49, 56)); o('ore', *P(63, 57)); o('cauldron', *P(60, 58))
    # ---- pastures: horses, posts, fences
    for x0, x1, y0 in ((27, 47, 13), (27, 47, 27)):
        for x in range(x0, x1, 2): o('fence', *P(x + 1, y0), 0 if x % 4 else 1)
    o('hitch', *P(30, 20)); o('hitch', *P(44, 18)); o('yurt', *P(46, 9.5), 1)
    for x, y in ((28, 17), (36, 24), (44, 22)): o('tallgrass', *P(x, y))
    # ---- warriors' camp
    o('tent', *P(74, 39), 0); o('tent', *P(84, 39), 1); o('tent', *P(86, 50), 0)
    o('firepit', *P(78, 45)); o('weaponrack', *P(73, 48)); o('standard', *P(80, 41))
    for x, y in ((70, 53), (76, 54), (82, 55)): o('target', *P(x, y))
    o('target', *P(88, 44), 0, t('arnatarget'))
    # ---- sacred hill
    o('sakaltar', *P(62, 12.4), 0, t('altar'))
    for k in range(6):
        a = k / 6 * math.pi * 2
        o('deerstone', *P(62 + math.cos(a) * 6.5, 13.5 + math.sin(a) * 3.6))
    o('standard', *P(57, 9)); o('standard', *P(67, 9)); o('tent', *P(69, 18), 1)
    o('rock', *P(57, 16.6), 2, t('niche'))
    for x, y in ((52, 20), (71, 21), (58, 23)): o('tulips', *P(x, y), 1)
    # ---- foothills: spruces
    for x in list(range(6, 108, 7)):
        y = 9 + noise2(x, 3, 7) * 3
        if not (54 <= x <= 70) and not (16 <= x <= 25): o('snowpine', *P(x, y), x % 2)
    for x, y in ((12, 22), (8, 30), (104, 38), (108, 50), (70, 26)): o('snowpine', *P(x, y), 0)
    # ---- kurgan field: the royal kurgan, smaller mounds, deer stones
    o('royalkurgan', *P(96, 20))
    for x, y in ((84, 28), (106, 30), (88, 12), (104, 12)): o('kurgan', *P(x, y))
    for x, y in ((90, 31), (100, 31), (82, 20)): o('deerstone', *P(x, y))
    o('tunnel', *P(96, 22.6), 0, t('tunnelmark'))
    o('ringstone', *P(92, 23.4), 0, t('sealstone'))
    o('horsebones', *P(86, 33)); o('feather', *P(100, 34))
    # ---- the ford (attack site): hoofprints, a mirror shard, broken arrows
    o('hoofs', *P(24, 41)); o('hoofs', *P(28, 43)); o('hoofs', *P(17, 39))
    o('shard', *P(26, 39), 0, t('shardmark'))
    o('track', *P(29, 40), 3); o('reeds', *P(15, 44)); o('reeds', *P(26, 46))
    o('plaques', *P(30, 45), 0, t('lostplaque'))
    # ---- south-east steppe: an old shepherds' camp, the Institute's marker
    o('firepit', *P(96, 64)); o('wagon', *P(92, 62)); o('pillar', *P(104, 70), 1, t('instmarker'))
    o('rock', *P(64, 70), 1, t('arnacache'))
    # ---- tomb
    o('stairs', *P(32, 110)); o('beam', *P(29.5, 106)); o('beam', *P(35.5, 106))
    for x in (20, 26, 39, 45): o('pillar', *P(x, 98.5), 0)
    o('coffin', *P(24, 101.5)); o('coffin', *P(41, 101.5))
    for x, y in ((18, 103), (46, 103), (32, 97)): o('torch', *P(x, y))
    o('horsebones', *P(7, 99)); o('horsebones', *P(11, 101)); o('horsebones', *P(8, 102.5))
    o('goldarmor', *P(55, 99), 0, t('armorstand', hidden=True)); o('plaques', *P(53, 102)); o('plaques', *P(57, 101.5))
    o('pillar', *P(58, 98.5), 0)
    for x in (16, 24, 41, 49): o('pillar', *P(x, 86), 0)
    for x, y in ((14, 91), (51, 91), (23, 92), (42, 92)): o('torch', *P(x, y))
    o('crock', *P(31, 84.4), 3, t('mirrorseal')); o('crock', *P(34, 84.4), 3, t('mirrorseal'))
    o('mirror', *P(32.5, 82.6), 0, t('zmirror'))
    o('cauldron', *P(25, 82.8)); o('cauldron', *P(40, 82.8))
    # ---- Chroniclers' Camp
    o('ctent', *P(78, 92)); o('ctent', *P(100, 92)); o('ctent', *P(80, 106))
    o('holo', *P(89, 95)); o('cfire', *P(89, 102))
    o('gate', *P(89, 86), 0, t('campgatelight'))
    o('gate', *P(102, 105), 0)
    for x, y in ((72, 98), (106, 98), (96, 110)): o('poplar', *P(x, y), 0)

def emit():
    build_world(); build_tomb(); build_camp(); place()
    I = L.interact; tag = L.tag
    # Camp
    I('campsaka', *P(102, 105.8), 26)
    I('campgate', *P(89, 86.8), 26)
    I('holo', *P(89, 95.8), 22)
    # Steppe
    I('sakagate', *P(10, 65.8), 26)
    I('hoofs', *P(24, 41.6), 22)
    I('shard', *P(26, 39.6), 18, tag('shardmark'))
    I('plaque', *P(30, 45.6), 18, tag('lostplaque'))
    I('goldwork', *P(56, 55.2), 24)
    I('target', *P(88, 44.6), 20, tag('arnatarget'))
    I('altar', *P(62, 13.2), 24, tag('altar'))
    I('niche', *P(57, 17.2), 18, tag('niche'))
    I('kurganseal', *P(92, 24.2), 22, tag('sealstone'))
    I('tunnel', *P(96, 23.2), 22, tag('tunnelmark'))
    I('institute', *P(104, 70.6), 20, tag('instmarker'))
    I('arnacache', *P(64, 70.6), 18, tag('arnacache'))
    I('assembly', *P(56, 40.2), 26)
    # Tomb
    I('stairsup', *P(32, 110.6), 22)
    I('horses', *P(9, 100.6), 26)
    I('treasury', *P(55, 100), 24)
    I('mirroraltar', *P(32.5, 83.4), 24, tag('zmirror'))
    for key, x0, y0, x1, y1 in (('outskirts', 26, 44, 34, 56), ('square', 46, 32, 66, 47), ('ford', 12, 34, 30, 48),
                               ('kurgans', 80, 10, 110, 36), ('hall', 16, 96, 49, 104), ('arena', 12, 84, 53, 93), ('camp', 70, 84, 110, 116)):
        L.trigger(key, x0, y0, x1, y1)
    W_ = lambda *a: a
    L.npc('barsbek', 'SAKACHIEF', 56, 36.6, [W_(56, 36.6, 400, 'idle'), W_(53, 37, 220, 'talk'), W_(59, 37, 260, 'idle', 0)])
    L.npc('qaraman', 'SAKAGUARD', 76, 44, [W_(76, 44, 360, 'idle', 6), W_(80, 47, 300, 'talk'), W_(72, 42, 260, 'idle', 2)])
    L.npc('arna', 'ARNA', 46, 39, [W_(46, 39, 320, 'idle'), W_(44, 44, 200, 'idle'), W_(49, 41, 240, 'talk')])
    L.npc('altynbek', 'GOLDSMITH', 61, 55, [W_(61, 55, 520, 'work', 6), W_(59, 58.5, 220, 'idle'), W_(61, 55, 420, 'work', 6)])
    L.npc('kungey', 'ABYZ', 62, 16, [W_(62, 16, 480, 'idle', 0), W_(66, 17, 260, 'talk'), W_(59, 16.5, 300, 'idle', 0)])
    L.npc('tayzhan', 'SAKABOY', 36, 21, [W_(36, 21, 260, 'idle'), W_(41, 16, 160, 'idle'), W_(31, 24, 180, 'talk')], runner=True)
    L.npc('ulpan', 'SAKAMOTHER', 41, 41, [W_(41, 41, 360, 'work', 4), W_(38, 44, 220, 'idle'), W_(45, 42, 240, 'talk')])
    L.npc('warrior1', 'SAKAWARRIOR', 72, 46, [W_(72, 46, 400, 'idle', 6), W_(70, 50, 280, 'spear', 4)])
    L.npc('warrior2', 'SAKAWARRIOR', 82, 47, [W_(82, 47, 380, 'idle', 2), W_(84, 52, 260, 'spear', 4)])
    L.npc('bexary', 'SAKAWARRIOR', 32, 88, [W_(32, 88, 600, 'sit')], inactive=True)
    L.npc('herder1', 'SAKAWARRIOR', 27, 82.4, [W_(27, 82.4, 600, 'sit')], inactive=True)
    L.npc('herder2', 'SAKAMOTHER', 38, 82.4, [W_(38, 82.4, 600, 'idle')], inactive=True)
    L.npc('foal', 'HORSE', 101, 36, [W_(101, 36, 600, 'idle')], inactive=True)
    L.npc('dana', 'DANA', 85, 97, [W_(85, 97, 500, 'idle'), W_(82, 101, 300, 'talk')])
    L.npc('erlan', 'ERLAN', 93, 97, [W_(93, 97, 500, 'talk'), W_(96, 101, 300, 'idle')])
    L.animals.extend([('HORSE', 30, 16), ('HORSE', 36, 18), ('HORSE', 42, 15), ('HORSE', 33, 23), ('HORSE', 40, 22), ('HORSE', 45, 25),
                      ('SHEEP', 52, 66), ('SHEEP', 55, 68), ('SHEEP', 58, 66), ('SHEEP', 49, 68)])
    # Enemies (type, x, y, group): 0 ghost leopard, 1 corrupted warrior, 2 steppe archer, 4 shade, 7 the rider.
    L.enemies.extend([(2, 88, 64, 1), (2, 98, 66, 1), (1, 92, 67, 1),
                      (0, 86, 18, 2), (0, 104, 24, 2), (0, 98, 28, 2),
                      (1, 14, 36, 3), (1, 26, 36, 3),
                      (4, 22, 99, 4), (4, 43, 99, 4), (4, 32, 101, 4),
                      (1, 18, 88, 5), (1, 47, 88, 5),
                      (7, 32, 88, 6),
                      (1, 15, 91, 7), (1, 50, 91, 7)])
    L.enemy_sheets = {0: 'LEOPARD', 1: 'SAKACORRUPT', 2: 'STEPPEARCHER', 3: 'BEAR', 4: 'SHADE', 5: 'WRAITH', 6: 'KEEPER', 7: 'GOLDRIDER'}
    # Pickups (item, qty, x, y): 4 arrows, 5 kit, 9 small herb, 20 big herb, 21 strength, 22 guard, 23 swift, 25 dried curd.
    L.pickups = [(9, 2, 14, 62), (4, 8, 34, 58), (9, 1, 50, 60), (25, 2, 40, 49), (4, 6, 70, 50), (23, 1, 47, 24),
                 (21, 1, 80, 34), (9, 2, 100, 40), (4, 8, 22, 46), (20, 1, 106, 68),
                 (22, 1, 32, 106), (9, 2, 10, 97), (21, 1, 59, 102), (5, 1, 32, 95), (4, 10, 46, 101)]
    L.area('world', 0, 0, W, WY)
    L.area('tomb', 0, TY, 66, H, dark=(70, 52, 40), outdoor=False)
    L.area('camp', 66, TY, W, H)
    L.zone_area = [0] * 10 + [1, 1, 2]
    L.zone_fx = [0, 0, 0, 8, 1, 0, 0, 1, 1, 0, 2, 2, 0]
    L.teleports = ['campsaka', 'sakagate', 'tunnel', 'stairsup']
    L.spawn = (89, 99)
    L.write()

if __name__ == '__main__':
    emit()
