"""MAP04 «Ғұндар дәуірі» — the Talas steppe about 40 BC (hand-designed layout).

Areas: 'world' (zones 0-7), 'under' beneath the old burial ground (zones 8-9), 'camp' (zone 10).
Zones: 0 steppe, 1 Kangju camp, 2 Wusun aul, 3 caravan road, 4 envoys' stone, 5 Zhizhi's fort,
       6 river crossing, 7 old burial ground, 8 the knot-keeper's hollow, 9 hall of witnesses, 10 Chroniclers' Camp.
"""
import math, os, random, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from rpgart.core import fbm, noise2
from rpgart.levelgen import Level, TS

W, H = 112, 118
L = Level('map04', W, H)
rnd = random.Random(1404)
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
                    if math.hypot(x + .5 - px, y + .5 - py) < w + noise2(x, y, 9) * .5 and L.get(x, y) not in (L.T['rock'], L.T['water']):
                        L.set(x, y, t)

WY, TY = 76, 80

def build_world():
    T = L.T
    for y in range(WY):
        for x in range(W):
            n = fbm(x, y, 12, 3, 91)
            L.grid[y][x] = T['sand'] if n > .7 else T['steppe'] if n > .34 else T['grass']
            z = 0
            if 76 <= x and 6 <= y < 28: z = 7
            elif 74 <= x and 28 <= y < 56: z = 5
            elif 40 <= x < 64 and 10 <= y < 30: z = 1
            elif x < 24 and 12 <= y < 52: z = 2
            elif 24 <= x < 40 and 30 <= y < 50: z = 6
            elif 46 <= x < 64 and 32 <= y < 48: z = 4
            elif 40 <= x and y >= 54: z = 3
            L.zone[y][x] = z
    for y in range(WY):
        for x in range(W):
            e = min(x, y, W - 1 - x, WY - 1 - y)
            if e < 2 + (noise2(x, y, 5) > .58): L.set(x, y, 'rock')
    for y in range(2, WY - 2):   # the Talas: wide, slow, sandy banks; one ford
        cx = 30 + 3.5 * math.sin(y / 10) - (y > 54) * (y - 54) * .2
        for x in range(int(cx - 5), int(cx + 6)):
            d = abs(x + .5 - cx)
            if d < 2.2: L.set(x, y, 'water')
            elif d < 3: L.set(x, y, 'shallow')
            elif d < 4.4 and L.get(x, y) != T['rock']: L.set(x, y, 'sand')
    for y in range(38, 43):
        cx = 30 + 3.5 * math.sin(y / 10)
        for x in range(int(cx - 4), int(cx + 5)):
            if L.get(x, y) == T['water']: L.set(x, y, 'shallow')
    blob(52, 21, 9, 6, 'dirt', .3, 11); blob(12, 32, 8, 12, 'grass', .25, 12, only=(T['steppe'], T['sand']))
    blob(54, 40, 6, 4.5, 'pave', .2, 13); blob(90, 42, 12, 9.5, 'clay', .15, 14)
    blob(92, 16, 12, 8, 'sand', .3, 15); blob(64, 62, 8, 4, 'dirt', .3, 16)
    blob(104, 66, 4, 3, 'rock', .5, 17); blob(46, 6, 5, 2.5, 'rock', .5, 18); blob(8, 62, 4, 3, 'rock', .5, 19)
    path([(40, 68), (46, 60), (52, 50), (54, 45)], 1.2)
    path([(42, 61), (60, 61), (84, 60), (104, 58)], 1.5)             # the caravan road
    path([(35, 40), (46, 40)], 1.1); path([(60, 40), (76, 42)], 1.2)  # crossing — stone — fort gate
    path([(54, 35), (52, 28)], 1.0); path([(26, 40), (18, 36)], 1.0)
    path([(90, 31), (92, 24)], 1.0, 'sand')

def build_under():
    for y in range(TY, H):
        for x in range(0, 66):
            L.grid[y][x] = L.T['cavewall']; L.zone[y][x] = 9
    L.fill(30, 104, 35, 116, 'cave'); L.fill(16, 96, 49, 104, 'cave'); L.fill(30, 92, 35, 97, 'cave')
    L.fill(12, 84, 53, 93, 'pave'); L.fill(30, 83, 35, 85, 'cave'); L.fill(22, 81, 43, 84, 'timber')
    for y in range(81, 84):
        for x in range(22, 43): L.zone[y][x] = 8

def build_camp():
    for y in range(TY, H):
        for x in range(66, W):
            L.grid[y][x] = L.T['rock']; L.zone[y][x] = 10
    blob(89, 99, 21, 16, 'grass', .2, 52, only=(L.T['rock'],)); blob(89, 99, 18, 14, 'camp', .25, 51)
    for y in range(TY, H):
        for x in range(66, W):
            if min(x - 66, W - 1 - x, y - TY, H - 1 - y) < 2: L.set(x, y, 'rock')

def place():
    o, t = L.obj, L.tag
    o('gate', *P(40, 67), 0)
    for x, y in ((46, 70), (60, 68), (70, 70), (16, 60), (100, 70), (66, 50), (44, 52)): o('feather', *P(x, y))
    for x, y, v in ((24, 66, 1), (74, 66, 2), (96, 64, 1), (68, 30, 0), (20, 8, 2)): o('rock', *P(x, y), v)
    for x, y in ((50, 66), (14, 54), (70, 14)): o('deadtree', *P(x, y), rnd.randrange(2))
    # ---- Kangju camp
    for x, y, v in ((46, 17, 1), (58, 17, 0), (47, 26, 0), (58, 25, 1)): o('yurt', *P(x, y), v)
    o('banner', *P(52, 17), 2); o('firepit', *P(52, 22)); o('hitch', *P(62, 21)); o('wagon', *P(42, 22)); o('weaponrack', *P(55, 27.5))
    # ---- Wusun aul (west bank)
    for x, y, v in ((8, 20, 0), (16, 22, 0), (7, 30, 1), (15, 42, 0), (8, 44, 1)): o('yurt', *P(x, y), v)
    o('banner', *P(12, 27), 1); o('firepit', *P(12, 33)); o('cauldron', *P(15, 32)); o('hitch', *P(19, 28)); o('jar', *P(10, 37), 1)
    for x in range(4, 16, 2): o('fence', *P(x + 1, 49), 0 if x % 4 else 1)
    o('cords', *P(19, 44), 0, t('cordwest'))
    # ---- river crossing
    o('raft', *P(27, 43)); o('reeds', *P(25, 37)); o('reeds', *P(35, 44)); o('reeds', *P(26, 46)); o('deerstone', *P(37, 38.6), 0, t('borderstone'))
    # ---- envoys' stone: three banners around a slab
    o('slabtomb', *P(54, 39.6)); o('banner', *P(49.5, 38), 0); o('banner', *P(58.5, 38), 1); o('banner', *P(54, 35.6), 2)
    o('tally', *P(54, 41.4), 0, t('tally'))
    # ---- caravan road
    o('bales', *P(62, 59.4)); o('bales', *P(66, 62.6), 0, t('silkbale')); o('wagon', *P(70, 59)); o('hitch', *P(58, 63)); o('firepit', *P(64, 64))
    o('cords', *P(74, 62.6), 0, t('cord11'))
    # ---- Zhizhi's fort: rammed-earth wall with a west gate
    for x in range(79, 103, 3): o('fortwall', *P(x + 1.5, 33), 0); o('fortwall', *P(x + 1.5, 52), 0)
    # A wall segment has a 5px half-depth: 48px spacing left walkable gaps.
    # Overlap the side segments at 8px intervals, preserving only the west gate.
    for half_y in range(66, 105):
        y = half_y / 2
        if not 80 <= half_y <= 88: o('fortwall', *P(78.5, y), 0)
        o('fortwall', *P(102.5, y), 0)
    o('fortwall', *P(78.2, 34.6), 1); o('banner', *P(81, 41), 0); o('banner', *P(81, 44.4), 0)
    for x, y, v in ((86, 38, 1), (96, 38, 0), (96, 48, 1)): o('yurt', *P(x, y), v)
    o('firepit', *P(90, 43)); o('weaponrack', *P(86, 48)); o('target', *P(84, 50)); o('cauldron', *P(93, 46)); o('hitch', *P(99, 43))
    o('symbol', *P(100.6, 44), 0, t('wallmark'))
    # ---- old burial ground
    for x, y in ((84, 12), (100, 12), (104, 20), (82, 22)): o('slabtomb', *P(x, y))
    o('kurgan', *P(93, 12)); o('tunnel', *P(93, 15), 0, t('tombdoor')); o('bellpost', *P(88, 18), 0, t('bell'))
    o('post', *P(98, 21)); o('storage', *P(105, 14.6), 0, t('oldkit'))
    o('basket', *P(79, 10), 0, t('whistle'))
    # ---- under: antechamber, hall of witnesses, the hollow
    o('stairs', *P(32, 110)); o('beam', *P(29.5, 106)); o('beam', *P(35.5, 106))
    for x in (20, 26, 39, 45): o('pillar', *P(x, 98.5), 0)
    for x, y in ((18, 103), (46, 103), (32, 97), (14, 91), (51, 91)): o('torch', *P(x, y))
    for x in (16, 49): o('pillar', *P(x, 86), 0)
    o('crock', *P(31, 84.4), 3, t('hollowseal')); o('crock', *P(34, 84.4), 3, t('hollowseal'))
    # The film's last frame: two lines of the same boot-prints meet in the dust; one line leaves.
    for k, (x, y) in enumerate(((22.5, 91.6), (24.5, 90.8), (26.5, 90), (28.5, 89.4), (30.5, 88.6), (41.5, 91.6), (39.5, 90.8), (37.5, 90), (35.5, 89.4), (33.5, 88.6), (32, 87.2), (32, 85.8))):
        o('track', *P(x, y), 2, t('filmprints', hidden=True))
    o('ctent', *P(26, 83)); o('holo', *P(32.5, 82.4), 0, t('knotdesk')); o('cords', *P(37, 83), 0); o('cords', *P(40.5, 83), 0); o('bellpost', *P(23.2, 83.4), 0)
    # ---- Chroniclers' Camp
    o('ctent', *P(78, 92)); o('ctent', *P(100, 92)); o('ctent', *P(80, 106)); o('holo', *P(89, 95)); o('cfire', *P(89, 102))
    o('gate', *P(89, 86), 0); o('gate', *P(102, 105), 0)
    for x, y in ((72, 98), (106, 98), (96, 110)): o('poplar', *P(x, y), 0)

def emit():
    build_world(); build_under(); build_camp(); place()
    I = L.interact; tag = L.tag
    I('camphun', *P(102, 105.8), 26); I('campgate', *P(89, 86.8), 26); I('holo', *P(89, 95.8), 22)
    I('hungate', *P(40, 67.8), 26)
    I('tallystone', *P(54, 42), 20, tag('tally'))
    I('council', *P(54, 37), 22)
    I('muster', *P(84, 50.6), 20)
    I('borderstone', *P(37, 39.4), 20, tag('borderstone'))
    I('envoypost', *P(98, 21.6), 20)
    I('whistle', *P(79, 10.6), 18, tag('whistle'))
    I('ramparts', *P(90, 35.2), 22)
    I('wallmark', *P(100.6, 44.6), 18, tag('wallmark'))
    I('silk', *P(66, 63.2), 20, tag('silkbale'))
    I('cord11', *P(74, 63.2), 20, tag('cord11'))
    I('cordwest', *P(19, 44.6), 20, tag('cordwest'))
    I('bell', *P(88, 18.6), 18, tag('bell'))
    I('oldkit', *P(105, 15.2), 18, tag('oldkit'))
    I('tombdoor', *P(93, 15.6), 22, tag('tombdoor'))
    I('stairsup', *P(32, 110.6), 22)
    I('masks', *P(32, 88.6), 24)
    I('knotdesk', *P(32.5, 83.2), 24, tag('knotdesk'))
    for key, x0, y0, x1, y1 in (('stone', 47, 33, 62, 46), ('fortgate', 70, 38, 77, 47), ('burial', 78, 6, 110, 27), ('crossing', 33, 34, 42, 46),
                               ('hall', 16, 96, 49, 104), ('arena', 12, 84, 53, 93), ('aul', 14, 24, 23, 48)):
        L.trigger(key, x0, y0, x1, y1)
    W_ = lambda *a: a
    L.npc('zhizhi', 'HUNCHIEF', 90, 40.6, [W_(90, 40.6, 500, 'idle'), W_(93, 42, 240, 'talk'), W_(88, 44, 300, 'idle', 6)])
    L.npc('shuga', 'HUNSCOUT', 82, 46, [W_(82, 46, 360, 'idle', 6), W_(86, 44, 240, 'talk'), W_(83, 40, 260, 'idle', 6)])
    L.npc('guard', 'HUNWARRIOR', 76.5, 44, [W_(76.5, 44, 600, 'idle', 6)])
    L.npc('fengliao', 'WUSUNHEALER', 12, 30, [W_(12, 30, 460, 'idle'), W_(15, 34, 260, 'talk'), W_(10, 35, 300, 'idle')])
    L.npc('wusunbek', 'WUSUNBEK', 16, 38, [W_(16, 38, 420, 'idle', 2), W_(13, 40, 260, 'talk')])
    L.npc('kangju', 'KANGJUBEK', 52, 24.4, [W_(52, 24.4, 460, 'idle'), W_(55, 22, 240, 'talk'), W_(49, 23, 280, 'idle', 2)])
    L.npc('merchant', 'MERCHANT', 60, 62, [W_(60, 62, 420, 'work', 2), W_(66, 60.6, 260, 'talk'), W_(63, 65.4, 240, 'idle')])
    L.npc('envoy', 'HUNENVOY', 98, 23, [W_(98, 23, 600, 'sit')])
    L.npc('knot', 'KNOTKEEPER', 30, 82.6, [W_(30, 82.6, 600, 'idle')], inactive=True)
    L.npc('dana', 'DANA', 85, 97, [W_(85, 97, 500, 'idle'), W_(82, 101, 300, 'talk')])
    L.npc('erlan', 'ERLAN', 93, 97, [W_(93, 97, 500, 'talk'), W_(96, 101, 300, 'idle')])
    L.animals.extend([('CAMEL', 68, 64), ('CAMEL', 72, 57.6), ('CAMEL', 58, 58), ('HORSE', 60, 23), ('HORSE', 64, 19), ('HORSE', 20, 26),
                      ('HORSE', 98, 45), ('SHEEP', 6, 51.5), ('SHEEP', 10, 52), ('SHEEP', 13, 51.4)])
    # Enemies (type, x, y, group): 1 deserter, 2 scout-archer, 3 mounted lancer, 4 corrupted warrior, 5 shadow, 8 the witness.
    L.enemies.extend([(2, 16, 64, 1), (2, 22, 68, 1), (1, 19, 62, 1),
                      (4, 95, 20, 2), (4, 101, 23, 2), (4, 98, 26, 2),
                      (3, 36, 36, 3), (3, 38, 44, 3),
                      (5, 22, 99, 4), (5, 43, 99, 4), (5, 32, 101, 4),
                      (8, 32, 87, 5),
                      (4, 15, 91, 6), (4, 50, 91, 6)])
    L.enemy_sheets = {0: 'WOLF', 1: 'HUNWARRIOR', 2: 'HUNSCOUT', 3: 'HUNRIDER', 4: 'HUNCORRUPT', 5: 'WRAITH', 6: 'KEEPER', 7: 'GOLDRIDER', 8: 'WITNESS'}
    L.pickups = [(9, 2, 44, 64), (4, 8, 50, 56), (25, 2, 14, 24), (9, 1, 34, 48), (23, 1, 6, 58), (4, 8, 70, 46), (21, 1, 84, 26),
                 (9, 2, 106, 8), (20, 1, 56, 8), (22, 1, 32, 106), (9, 2, 18, 100), (21, 1, 46, 100), (5, 1, 32, 95), (4, 10, 14, 86)]
    L.area('world', 0, 0, W, WY)
    L.area('under', 0, TY, 66, H, dark=(48, 50, 70), outdoor=False)
    L.area('camp', 66, TY, W, H)
    L.zone_area = [0] * 8 + [1, 1, 2]
    L.zone_fx = [4, 4, 0, 4, 4, 0, 0, 4, 0, 2, 0]
    L.teleports = ['camphun', 'hungate', 'tombdoor', 'stairsup']
    L.spawn = (89, 99)
    L.write()

if __name__ == '__main__':
    emit()
