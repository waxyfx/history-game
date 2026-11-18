"""MAP06 «Алтын Орда» — Saraychik on the Zhaiyk (Ural), about 1350 (hand-designed layout).

Areas: 'world' (zones 0-7), 'under' beneath the madrasa (zones 8-9). No camp between epochs (the portal is broken).
Zones: 0 steppe road, 1 town quarter, 2 bazaar · mint · caravanserai, 3 madrasa and mosque, 4 necropolis,
       5 the Zhaiyk and the ford, 6 yam station · cavalry field, 7 nomad camp (west bank), 8 archive, 9 hall of the yarlyk.
"""
import math, os, random, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from rpgart.core import fbm, noise2
from rpgart.levelgen import Level, TS

W, H = 112, 118
L = Level('map06', W, H)
rnd = random.Random(1606)
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
            n = fbm(x, y, 12, 3, 106)
            L.grid[y][x] = T['steppe'] if n > .4 else T['grass'] if n > .2 else T['meadow']
            z = 0
            if 44 <= x < 74 and 2 <= y < 22: z = 6
            elif 40 <= x < 76 and 22 <= y < 46: z = 1
            elif 40 <= x < 66 and 46 <= y < 64: z = 2
            elif 76 <= x < 104 and 20 <= y < 44: z = 3
            elif 80 <= x and 44 <= y < 70: z = 4
            elif x < 22 and 26 <= y < 72: z = 7
            elif 22 <= x < 36: z = 5
            L.zone[y][x] = z
    for y in range(WY):
        for x in range(W):
            e = min(x, y, W - 1 - x, WY - 1 - y)
            if e < 2 + (noise2(x, y, 5) > .58): L.set(x, y, 'rock')
    for y in range(2, WY - 2):   # the Zhaiyk: wide, slow; a ford at y 50–55, a ferry landing at y 33
        cx = 29 + 2.5 * math.sin(y / 9)
        for x in range(int(cx - 5), int(cx + 6)):
            d = abs(x + .5 - cx)
            if d < 2.6: L.set(x, y, 'water')
            elif d < 3.4: L.set(x, y, 'shallow')
            elif d < 4.6 and L.get(x, y) != T['rock']: L.set(x, y, 'sand')
    for y in range(50, 56):
        cx = 29 + 2.5 * math.sin(y / 9)
        for x in range(int(cx - 4), int(cx + 5)):
            if L.get(x, y) == T['water']: L.set(x, y, 'shallow')
    blob(58, 33, 17, 11, 'dirt', .25, 11)        # the town's beaten earth
    blob(52, 54, 12, 8, 'pave', .2, 12)          # bazaar paving
    blob(90, 32, 13, 9, 'pave', .15, 13)         # madrasa court
    blob(94, 56, 12, 9, 'sand', .3, 14)          # necropolis
    blob(58, 12, 13, 7, 'dirt', .3, 15)          # cavalry field
    blob(11, 46, 8, 14, 'grass', .25, 16, only=(T['steppe'], T['meadow']))
    for cx, cy, rx, ry, s in ((104, 10, 4, 3, 31), (8, 8, 4, 3, 32), (106, 70, 3, 3, 33)): blob(cx, cy, rx, ry, 'rock', .5, s)
    path([(44, 70), (46, 62), (50, 54), (54, 46), (58, 38)], 1.3)            # the arrival road into town
    path([(58, 38), (76, 34), (86, 34)], 1.2, 'pave')                        # to the madrasa
    path([(58, 30), (58, 20), (58, 12)], 1.1)                                # to the yam station
    path([(48, 54), (34, 53), (20, 52), (12, 48)], 1.1, 'sand')              # over the ford to the nomads
    path([(66, 54), (84, 56), (94, 56)], 1.0, 'sand')                        # to the necropolis

def build_under():
    for y in range(TY, H):
        for x in range(0, 66):
            L.grid[y][x] = L.T['cavewall']; L.zone[y][x] = 9
    for y in range(TY, H):
        for x in range(66, W): L.grid[y][x] = L.T['rock']; L.zone[y][x] = 9
    L.fill(16, 81, 49, 88, 'timber')
    for y in range(81, 88):
        for x in range(16, 49): L.zone[y][x] = 8
    L.fill(30, 88, 35, 91, 'cave'); L.fill(12, 91, 53, 100, 'pave'); L.fill(30, 100, 35, 103, 'cave')
    L.fill(16, 103, 49, 110, 'cave'); L.fill(30, 110, 35, 117, 'cave')

def place():
    o, t = L.obj, L.tag
    o('gate', *P(44, 67), 0)
    for x, y in ((40, 72), (52, 70), (70, 68), (14, 18), (100, 72), (72, 50)): o('feather', *P(x, y))
    for x, y in ((38, 66), (68, 70), (106, 20)): o('deadtree', *P(x, y), rnd.randrange(2))
    # ---- town quarter: adobe houses and felt yurts side by side (the city and the steppe in one street)
    for x, y in ((46, 26), (52, 24), (66, 25), (71, 30)): o('fortwall', *P(x, y), 0)
    for x, y, v in ((46, 36, 1), (64, 40, 0), (70, 37, 1), (52, 42, 0)): o('yurt', *P(x, y), v)
    o('kiln', *P(62, 30)); o('cauldron', *P(57, 33)); o('carpet', *P(50, 33)); o('hitch', *P(68, 44)); o('jar', *P(47, 30), 1)
    o('bowbench', *P(60, 27.6), 0, t('bowbench')); o('banner', *P(58, 22.6), 0)
    # ---- bazaar, mint, caravanserai
    for k, (x, y) in enumerate(((44, 50), (49, 49), (54, 50), (44, 56), (60, 55))): o('stall', *P(x, y), k % 3)
    o('coinpress', *P(52, 58), 0, t('mint')); o('caravangate', *P(61, 49.4)); o('bales', *P(57, 59)); o('bales', *P(48, 60), 0, t('sinew'))
    o('wagon', *P(64, 60)); o('pillar', *P(66.4, 50), 1, t('fivemarks')); o('balbal', *P(57.6, 49.6), 1, t('balbalblock'))
    # ---- madrasa and mosque, the library copy of the genealogy, the way down to the archive
    o('iwan', *P(90, 27)); o('minaret', *P(80, 26)); o('minaret', *P(100, 26))
    o('scrolltable', *P(84, 36), 0, t('genealogy')); o('shelves', *P(96, 36.6)); o('scrolltable', *P(97, 38.8), 0, t('margin'))
    o('tunnel', *P(90, 29.4), 0, t('archivedoor')); o('carpet', *P(90, 33))
    # ---- necropolis: the tradition places Uzbek khan's grave in Saraychik
    o('turbe', *P(94, 52), 0, t('turbe')); o('turbe', *P(102, 58)); o('turbe', *P(86, 60))
    for x, y, v in ((90, 56, 0), (98, 62, 1), (92, 64, 0), (104, 52, 1), (84, 52, 0)): o('kayraktas', *P(x, y), v)
    # ---- yam station and cavalry field: lance rack, targets for the charge, long-range bow targets
    o('yampost', *P(54, 12), 0, t('yamregister')); o('lancerack', *P(62, 8.4)); o('hitch', *P(48, 10)); o('hitch', *P(68, 18))
    for x in (56, 61, 66): o('target', *P(x, 16.4))
    for x in (51, 65): o('target', *P(x, 4.4))
    # ---- the Zhaiyk: ferry, reeds
    o('raft', *P(29, 33)); o('reeds', *P(25, 40)); o('reeds', *P(33, 22)); o('reeds', *P(34, 62))
    o('deadtree', *P(25, 20), 1, t('bark'))
    # ---- nomad camp (west bank)
    for x, y, v in ((8, 38, 0), (15, 34, 1), (7, 56, 1), (16, 60, 0)): o('yurt', *P(x, y), v)
    o('firepit', *P(12, 46)); o('cauldron', *P(10, 49)); o('hitch', *P(17, 44)); o('basket', *P(6, 47), 0, t('horn'))
    o('carpet', *P(14, 52), 0, t('scribehome'))
    # ---- under: the archive and the hall of the yarlyk
    for x in (20, 44): o('shelves', *P(x, 82.4))
    o('scrolltable', *P(32, 83.2), 0, t('origscroll')); o('shelves', *P(26, 86.6)); o('shelves', *P(38, 86.6))
    o('crock', *P(23.4, 85.8), 1, t('thread'))
    for x in (18, 46): o('torch', *P(x, 84.6))
    o('crock', *P(31, 89.4), 3, t('archiveseal')); o('crock', *P(34, 89.4), 3, t('archiveseal'))
    for x, y in ((14, 96), (51, 96), (18, 108), (46, 108), (32, 104)): o('torch', *P(x, y))
    for x in (16, 49): o('pillar', *P(x, 93.5), 0); o('pillar', *P(x, 98.5), 0)
    o('stairs', *P(32, 114)); o('beam', *P(29.5, 111)); o('beam', *P(35.5, 111))

def emit():
    build_world(); build_under(); place()
    I = L.interact; tag = L.tag
    I('gate6', *P(44, 67.8), 26)
    I('genealogy', *P(84, 36.8), 20, tag('genealogy'))
    I('mint', *P(52, 58.6), 20, tag('mint'))
    I('yamregister', *P(54, 12.6), 18, tag('yamregister'))
    I('bowbench', *P(60, 28.4), 20, tag('bowbench'))
    I('lancerack', *P(62, 9.2), 20)
    I('horn', *P(6, 47.6), 18, tag('horn'))
    I('sinew', *P(48, 60.6), 18, tag('sinew'))
    I('bark', *P(25, 20.6), 18, tag('bark'))
    I('archivedoor', *P(90, 30), 22, tag('archivedoor'))
    I('stairsup', *P(32, 114.6), 22)
    I('origscroll', *P(32, 84), 24, tag('origscroll'))
    I('caravangate', *P(61, 50.2), 22)
    # secrets
    I('turbe', *P(94, 52.8), 22, tag('turbe'))
    I('margin', *P(97, 39.6), 18, tag('margin'))
    I('balbalblock', *P(57.6, 50.4), 16, tag('balbalblock'))
    I('thread', *P(23.4, 86.6), 16, tag('thread'))
    I('scribehome', *P(14, 52.6), 18, tag('scribehome'))
    I('fivemarks', *P(66.4, 50.8), 16, tag('fivemarks'))
    for key, x0, y0, x1, y1 in (('town', 40, 22, 76, 46), ('field', 46, 2, 74, 20), ('ford', 22, 48, 36, 58), ('madrasa', 78, 24, 102, 42),
                               ('hall', 16, 103, 49, 110), ('arena', 12, 91, 53, 100), ('necropolis', 80, 46, 108, 68)):
        L.trigger(key, x0, y0, x1, y1)
    W_ = lambda *a: a
    L.npc('scribe', 'SCRIBE', 86, 38.6, [W_(86, 38.6, 520, 'work', 0), W_(88, 37, 240, 'talk'), W_(84, 39.4, 300, 'idle', 0)])
    L.npc('khorezm', 'KHOREZM', 50, 52, [W_(50, 52, 420, 'idle'), W_(55, 53, 260, 'talk'), W_(47, 54, 300, 'idle')])
    L.npc('bowyer', 'BOWYER', 58, 28.6, [W_(58, 28.6, 520, 'work', 2), W_(56, 30, 240, 'talk')])
    L.npc('yamchi', 'YAMCHI', 60, 13, [W_(60, 13, 480, 'idle'), W_(64, 12, 260, 'talk'), W_(57, 11, 300, 'idle', 2)])
    L.npc('mudarris', 'MUDARRIS', 92, 33, [W_(92, 33, 500, 'idle'), W_(88, 33, 260, 'talk'), W_(95, 34, 300, 'idle')])
    L.npc('qarabuqa', 'HERALD', 60, 36, [W_(60, 36, 600, 'idle', 4)], inactive=True)
    L.npc('aysha', 'GERWOMAN', 12, 50, [W_(12, 50, 420, 'work', 4), W_(14, 47, 260, 'talk')])
    L.npc('twin6', 'TWIN', 57, 6, [W_(57, 6, 600, 'idle')], inactive=True)
    L.animals.extend([('HORSE', 50, 6), ('HORSE', 54, 4.6), ('HORSE', 70, 10), ('HORSE', 66, 4), ('CAMEL', 63, 62), ('CAMEL', 58, 63),
                      ('SHEEP', 4, 62), ('SHEEP', 6, 64), ('SHEEP', 9, 63), ('HORSE', 18, 40)])
    # Enemies (type, x, y, group): 1 footmen and 2 archers of Qarabuqa's patrol, 3 his mounted lancers (after the arming),
    # 4/5 ink shades below (the margins come alive), 10 the herald of the forged yarlyk.
    L.enemies.extend([(1, 40, 60, 1), (2, 36, 62, 1), (1, 38, 64, 1),
                      (3, 70, 6, 2), (3, 72, 14, 2),
                      (1, 100, 66, 3), (2, 104, 62, 3),
                      (5, 22, 106, 4), (5, 43, 106, 4), (4, 32, 108, 4),
                      (10, 32, 95, 5)])
    L.enemy_sheets = {0: 'WOLF', 1: 'HORDEMAN', 2: 'HORDEARCHER', 3: 'HUNRIDER', 4: 'TURKCORRUPT', 5: 'WRAITH', 6: 'KEEPER', 7: 'GOLDRIDER', 8: 'WITNESS', 9: 'TWIN', 10: 'HERALD'}
    L.pickups = [(9, 2, 46, 64), (4, 8, 50, 46), (25, 2, 12, 42), (9, 1, 30, 46), (23, 1, 6, 30), (4, 10, 70, 24), (21, 1, 84, 46),
                 (9, 2, 104, 40), (20, 1, 66, 4), (22, 1, 32, 112), (9, 2, 19, 109), (21, 1, 47, 109), (5, 1, 32, 102), (4, 10, 15, 97)]
    L.area('world', 0, 0, W, WY)
    L.area('under', 0, TY, W, H, dark=(52, 46, 40), outdoor=False)
    L.zone_area = [0] * 8 + [1, 1]
    L.zone_fx = [0, 0, 0, 0, 0, 0, 0, 0, 2, 2]
    L.teleports = ['gate6', 'archivedoor', 'stairsup']
    L.spawn = (44, 69.4)
    L.write()

if __name__ == '__main__':
    emit()
