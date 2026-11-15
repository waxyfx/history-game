"""MAP05 «Жадтың көлеңкесі» — Zhetysu near Suyab, about 711–712 (hand-designed layout).

Areas: 'world' (zones 0-7), 'under' beneath the ruined sanctuary (zones 8-9 + the hidden imperial room), 'camp' (zone 10).
Zones: 0 night steppe, 1 Türgesh aul, 2 burnt gate, 3 Kök-Türk camp, 4 balbal field, 5 mirror lake, 6 road,
       7 sanctuary hill, 8 hidden runic chamber, 9 hall of images, 10 Chroniclers' Camp.
"""
import math, os, random, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from rpgart.core import fbm, noise2
from rpgart.levelgen import Level, TS

W, H = 112, 118
L = Level('map05', W, H)
rnd = random.Random(1505)
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
            n = fbm(x, y, 11, 3, 95)
            L.grid[y][x] = T['meadow'] if n > .72 else T['steppe'] if n > .3 else T['grass']
            z = 6 if 34 <= x < 62 and 44 <= y < 72 else 0
            if 70 <= x and 4 <= y < 32: z = 3
            elif 4 <= x < 33 and 10 <= y < 44: z = 1
            elif 33 <= x < 45 and 18 <= y < 36: z = 2
            elif 45 <= x < 70 and 32 <= y < 54: z = 4
            elif x < 32 and 44 <= y < 74: z = 5
            elif 76 <= x and 36 <= y < 72: z = 7
            L.zone[y][x] = z
    for y in range(WY):
        for x in range(W):
            e = min(x, y, W - 1 - x, WY - 1 - y)
            if e < 2 + (noise2(x, y, 5) > .58): L.set(x, y, 'rock')
    # The mirror lake: still, round, a sandy north shore where the reflection walks.
    blob(17, 61, 10, 6.5, 'sand', .15, 21)
    blob(17, 62, 8.6, 5.2, 'shallow', .1, 22)
    blob(17, 62.6, 7.4, 4.4, 'water', .08, 23)
    blob(22, 26, 12, 13, 'dirt', .3, 24, only=(T['steppe'], T['grass'], T['meadow']))   # trodden ground of the aul
    blob(38, 28, 4, 6, 'ash', .4, 25)                                                    # the burnt gate
    blob(88, 17, 14, 9, 'dirt', .3, 26)                                                  # the Kök-Türk camp
    blob(57, 42, 9, 6, 'dirt', .2, 27, only=(T['steppe'], T['grass'], T['meadow']))      # the memorial enclosure (trodden earth)
    for cx, cy, rx, ry, s in ((92, 46, 7, 4, 31), (100, 58, 6, 5, 32), (84, 52, 4, 3, 33), (106, 40, 3, 4, 34), (8, 8, 4, 3, 35)):
        blob(cx, cy, rx, ry, 'rock', .5, s)
    blob(94, 52, 6, 3, 'clay', .2, 36)
    path([(40, 68), (40, 56), (40, 44), (38, 32)], 1.2)
    path([(40, 50), (50, 46), (56, 45)], 1.0)
    path([(60, 38), (72, 26), (84, 20)], 1.1)
    path([(64, 44), (80, 48), (94, 52)], 1.0, 'sand')
    path([(36, 50), (26, 52)], .9, 'sand')

def build_under():
    for y in range(TY, H):
        for x in range(0, 66):
            L.grid[y][x] = L.T['cavewall']; L.zone[y][x] = 9
    L.fill(16, 81, 49, 88, 'pave'); L.fill(22, 81, 43, 83, 'timber')
    for y in range(81, 88):
        for x in range(16, 49): L.zone[y][x] = 8
    L.fill(30, 88, 35, 91, 'cave')
    L.fill(12, 91, 53, 100, 'pave')
    L.fill(30, 100, 35, 103, 'cave')
    L.fill(16, 103, 49, 110, 'cave')
    L.fill(30, 110, 35, 117, 'cave')
    L.fill(9, 104, 16, 107, 'cave')     # the hidden passage (blocked by a loose rock until pushed)
    L.fill(2, 100, 10, 113, 'pave')     # the clay army's room

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
    for x, y in ((46, 70), (58, 66), (68, 70), (12, 74 - 4), (100, 72), (66, 56), (30, 48), (52, 60)): o('feather', *P(x, y))
    for x, y, v in ((26, 70, 1), (74, 66, 2), (60, 30, 0), (44, 12, 1), (66, 8, 2)): o('rock', *P(x, y), v)
    for x, y in ((48, 64), (14, 50), (66, 30), (30, 70)): o('deadtree', *P(x, y), rnd.randrange(2))
    # ---- Türgesh aul (palisade on the east side, the gate burnt)
    for x, y, v in ((12, 18, 0), (22, 15, 1), (9, 30, 1), (25, 33, 0), (15, 39, 0)): o('yurt', *P(x, y), v)
    o('firepit', *P(18, 25)); o('cauldron', *P(15, 25)); o('anvil', *P(8, 36.5)); o('hitch', *P(28, 22)); o('jar', *P(27, 37), 1)
    o('cradle', *P(28.5, 35.6), 0, t('cradle')); o('runeboard', *P(21, 21.5), 0, t('runeboard')); o('banner', *P(18, 20.4), 1)
    for half in range(28, 82):
        y = half / 2
        if not 51 <= half <= 59: o('palisade', *P(33.5, y), 1 if 44 <= half <= 66 else 0)
    o('burntgate', *P(33.6, 29.4))
    for x, y in ((37, 26), (39, 31), (36.5, 33)): o('ashpile', *P(x, y))
    o('scarf', *P(38.4, 29.6), 0, t('scarf', hidden=True))
    # ---- Kök-Türk camp
    for x, y, v in ((78, 11, 0), (92, 9, 1), (101, 17, 0), (79, 25, 1)): o('yurt', *P(x, y), v)
    o('banner', *P(86, 14), 0); o('banner', *P(90.5, 14), 0); o('firepit', *P(88, 19.5)); o('weaponrack', *P(96, 25)); o('hitch', *P(73, 18))
    o('wagon', *P(100, 26)); o('target', *P(104, 10))
    # ---- balbal field: kurgan, the stele with runes, a stone statue, a line of balbals to the east
    o('kurgan', *P(56, 36.6)); o('stele', *P(55.4, 40.6), 1, t('stele')); o('statue', *P(58.6, 41.2), 0, t('statue'))
    for k in range(6): o('balbal', *P(61.5 + k * 1.5, 41.4), k % 2)
    o('balbal', *P(70.5, 41.4), 2, t('balbalx', hidden=True))
    # ---- mirror lake
    o('reeds', *P(8, 58)); o('reeds', *P(27, 63)); o('reeds', *P(24, 57.5)); o('crock', *P(13, 68.2), 1, t('lakestone'))
    # ---- sanctuary hill: broken pillars, the descent, a tamga on the rock, the wolf den
    for x, y in ((88, 48), (100, 49), (90, 56), (98, 56)): o('pillar', *P(x, y), 1)
    o('tunnel', *P(94, 52), 0, t('chamberdoor')); o('tamga', *P(103.4, 43.8), 0, t('tamga'))
    o('cavemouth', *P(84.5, 63)); o('skull', *P(87, 64.5)); o('ribs', *P(82, 65))
    o('ashpile', *P(64, 62)); o('track', *P(62.6, 61), 2, t('oldcamp')); o('track', *P(65.4, 60.6), 2); o('track', *P(63.4, 63.6), 2)
    # ---- under: the hidden runic chamber, the seal, the hall of images, the antechamber
    o('runewall', *P(22, 81.6), 0); o('runewall', *P(42, 81.6), 0); o('runewall', *P(32, 81.6), 1, t('inscription'))
    for x in (18, 46): o('torch', *P(x, 84))
    o('crock', *P(31, 89.4), 3, t('chamberseal')); o('crock', *P(34, 89.4), 3, t('chamberseal'))
    for x in (16, 49): o('pillar', *P(x, 93.5), 0)
    for x in (16, 49): o('pillar', *P(x, 98.5), 0)
    for x, y in ((14, 96), (51, 96), (18, 108), (46, 108), (32, 104)): o('torch', *P(x, y))
    o('stairs', *P(32, 114)); o('beam', *P(29.5, 111)); o('beam', *P(35.5, 111))
    o('crock', *P(15.6, 105.6), 2, t('qinseal'))
    # ---- the clay army (MAP05 easter egg): rows of soldiers, a throne
    for row, y in enumerate((106.5, 109.5, 112.4)):
        for x in (3.6, 6, 8.4): o('terracotta', *P(x, y), (row + int(x)) % 2)
    o('qinthrone', *P(6, 102.4))
    # ---- Chroniclers' Camp
    o('ctent', *P(78, 92)); o('ctent', *P(100, 92)); o('ctent', *P(80, 106)); o('holo', *P(89, 95)); o('cfire', *P(89, 102))
    o('gate', *P(89, 86), 0); o('gate', *P(102, 105), 0)
    for x, y in ((72, 98), (106, 98), (96, 110)): o('poplar', *P(x, y), 0)

def emit():
    build_world(); build_under(); build_camp(); place()
    I = L.interact; tag = L.tag
    I('campturk', *P(102, 105.8), 26); I('campgate', *P(89, 86.8), 26); I('holo', *P(89, 95.8), 22)
    I('turkgate', *P(40, 67.8), 26)
    I('cradle', *P(28.5, 36.2), 20, tag('cradle'))
    I('runeboard', *P(21, 22.2), 18, tag('runeboard'))
    I('burntgate', *P(36, 29.6), 24)
    I('scarf', *P(38.4, 30.2), 16, tag('scarf'))
    I('stele', *P(55.4, 41.4), 20, tag('stele'))
    I('statue', *P(58.6, 42), 18, tag('statue'))
    I('balbals', *P(65, 42.2), 22)
    I('lakestone', *P(13, 68.8), 18, tag('lakestone'))
    I('tamga', *P(103.4, 44.6), 18, tag('tamga'))
    I('wolfden', *P(84.5, 64), 20)
    I('oldcamp', *P(64, 62.6), 20, tag('oldcamp'))
    I('chamberdoor', *P(94, 52.6), 22, tag('chamberdoor'))
    I('stairsup', *P(32, 114.6), 22)
    I('inscription', *P(32, 82.8), 24, tag('inscription'))
    I('qincrack', *P(16.6, 105.6), 18, tag('qinseal'))
    I('qinthrone', *P(6, 103.2), 20)
    for key, x0, y0, x1, y1 in (('gate', 34, 22, 43, 35), ('field', 46, 33, 69, 50), ('lake', 6, 50, 30, 55), ('herd', 44, 52, 50, 58),
                               ('hush', 38, 44, 43, 48), ('hill', 78, 38, 108, 70), ('sight', 36, 56, 45, 62), ('hall', 16, 103, 49, 110),
                               ('arena', 12, 91, 53, 100), ('ktcamp', 72, 8, 106, 30)):
        L.trigger(key, x0, y0, x1, y1)
    W_ = lambda *a: a
    L.npc('irkin', 'IRKIN', 18, 27.4, [W_(18, 27.4, 520, 'idle', 0), W_(20, 28.6, 240, 'talk'), W_(16, 28.4, 300, 'idle', 2)])
    L.npc('kumis', 'KUMIS', 26.4, 36.4, [W_(26.4, 36.4, 420, 'work', 2), W_(24, 35.4, 260, 'talk'), W_(27, 37.6, 300, 'idle', 2)])
    L.npc('togyz', 'TOGYZ', 10, 37, [W_(10, 37, 420, 'work', 2), W_(12, 35, 240, 'talk'), W_(9, 39, 260, 'idle')])
    L.npc('sentry', 'SENTRY', 36.4, 27.2, [W_(36.4, 27.2, 600, 'idle', 2)])
    L.npc('ayan', 'AYAN', 21, 31, [W_(21, 31, 300, 'idle'), W_(24, 29, 160, 'idle'), W_(19, 33, 200, 'idle')])
    L.npc('herd', 'TURKHERD', 44, 46, [W_(44, 46, 160, 'idle'), W_(48, 55, 60, 'walk'), W_(44, 60, 120, 'idle'), W_(38, 52, 60, 'walk')])
    L.npc('tonyukuk', 'TONYUKUK', 86, 18.4, [W_(86, 18.4, 600, 'idle'), W_(84, 20, 300, 'talk', 2)])
    L.npc('kultegin', 'KULTEGIN', 92.4, 20, [W_(92.4, 20, 420, 'idle', 6), W_(95, 22, 260, 'talk'), W_(91, 23, 300, 'idle', 6)])
    L.npc('twin', 'TWIN', 60, 46, [W_(60, 46, 600, 'idle')], inactive=True)
    L.npc('reflect', 'TWIN', 17, 57, [W_(17, 57, 600, 'idle')], inactive=True)
    L.npc('qin', 'QIN', 6, 104.6, [W_(6, 104.6, 900, 'idle', 4)])
    L.npc('dana', 'DANA', 85, 97, [W_(85, 97, 500, 'idle'), W_(82, 101, 300, 'talk')])
    L.npc('erlan', 'ERLAN', 93, 97, [W_(93, 97, 500, 'talk'), W_(96, 101, 300, 'idle')])
    L.animals.extend([('HORSE', 72, 14), ('HORSE', 76, 20), ('HORSE', 98, 30), ('SHEEP', 30, 14), ('SHEEP', 28, 12.6), ('SHEEP', 31, 11.4),
                      ('CAMEL', 104, 24), ('HORSE', 26, 44)])
    # Enemies (type, x, y, group): 0 wolves by the den, 4 corrupted echoes of the raid, 5 shades on the field,
    # 4 shades below, 9 «Екінші бейне» (the second image).
    L.enemies.extend([(0, 84, 58, 1), (0, 88, 61, 1), (0, 81, 62, 1),
                      (4, 44, 24, 2), (4, 47, 30, 2), (4, 43, 35, 2),
                      (5, 50, 48, 3), (5, 66, 48, 3),
                      (4, 22, 106, 4), (4, 43, 106, 4), (4, 32, 108, 4),
                      (9, 32, 95, 5)])
    L.enemy_sheets = {0: 'WOLF', 1: 'SENTRY', 2: 'SENTRY', 3: 'HUNRIDER', 4: 'TURKCORRUPT', 5: 'WRAITH', 6: 'KEEPER', 7: 'GOLDRIDER', 8: 'WITNESS', 9: 'TWIN'}
    L.pickups = [(9, 2, 44, 62), (4, 8, 48, 52), (25, 2, 14, 22), (9, 1, 30, 46), (23, 1, 6, 48), (4, 8, 70, 44), (21, 1, 84, 30),
                 (9, 2, 104, 30), (20, 1, 56, 8), (22, 1, 32, 112), (9, 2, 18, 108), (21, 1, 46, 108), (5, 1, 32, 102), (4, 10, 14, 96)]
    L.area('world', 0, 0, W, WY)
    L.area('under', 0, TY, 66, H, dark=(46, 50, 74), outdoor=False)
    L.area('camp', 66, TY, W, H)
    L.zone_area = [0] * 8 + [1, 1, 2]
    L.zone_fx = [0, 0, 4, 0, 0, 0, 0, 4, 2, 2, 0]
    L.teleports = ['campturk', 'turkgate', 'chamberdoor', 'stairsup']
    L.spawn = (89, 99)
    L.write()

if __name__ == '__main__':
    emit()
