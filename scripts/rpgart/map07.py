"""MAP07 «Жеті ата» — the Kazakh Khanate: an aul of the Middle Zhuz by the Bulanty river, spring 1728 (hand-designed).

One area. Zones: 0 steppe road, 1 the aul, 2 the bi's council yurt, 3 the smith's yard and the training ground,
4 pastures (the four kinds of livestock), 5 the Bulanty ford, 6 the hill of kulpytas (the ancestors), 7 the ridge where
the Dzungar vanguard stands (boss: the noyon of the grey banners).
"""
import math, os, random, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from rpgart.core import fbm, noise2
from rpgart.levelgen import Level, TS

W, H = 90, 72
L = Level('map07', W, H)
rnd = random.Random(1707)
P = lambda x, y: (x * TS, y * TS)

def blob(cx, cy, rx, ry, t, jag=.25, seed=0, only=None):
    for y in range(int(cy - ry - 2), int(cy + ry + 3)):
        for x in range(int(cx - rx - 2), int(cx + rx + 3)):
            d = ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2
            if d <= 1 + (noise2(x, y, seed + 3) - .5) * jag and (only is None or L.get(x, y) in only): L.set(x, y, t)

def path(pts, w=1.2, t='dirt'):
    for (ax, ay), (bx, by) in zip(pts, pts[1:]):
        n = int(max(abs(bx - ax), abs(by - ay)) * 3) + 1
        for i in range(n + 1):
            px, py = ax + (bx - ax) * i / n, ay + (by - ay) * i / n
            for y in range(int(py - w - 1), int(py + w + 2)):
                for x in range(int(px - w - 1), int(px + w + 2)):
                    if math.hypot(x + .5 - px, y + .5 - py) < w + noise2(x, y, 9) * .5 and L.get(x, y) not in (L.T['rock'], L.T['water']): L.set(x, y, t)

def build():
    T = L.T
    for y in range(H):
        for x in range(W):
            n = fbm(x, y, 12, 3, 107)
            L.grid[y][x] = T['steppe'] if n > .38 else T['grass'] if n > .2 else T['meadow']
            z = 0
            if 30 <= x < 58 and 30 <= y < 52: z = 1
            elif 58 <= x < 72 and 30 <= y < 46: z = 2
            elif 34 <= x < 58 and 14 <= y < 30: z = 3
            elif x < 26 and 20 <= y < 62: z = 4
            elif 26 <= x < 34: z = 5
            elif 72 <= x and 30 <= y < 60: z = 6
            elif y < 14 and x >= 40: z = 7
            L.zone[y][x] = z
    for y in range(H):
        for x in range(W):
            if min(x, y, W - 1 - x, H - 1 - y) < 2 + (noise2(x, y, 5) > .6): L.set(x, y, 'rock')
    for y in range(2, H - 2):   # the Bulanty: narrow, a ford at y 40–45
        cx = 30 + 1.8 * math.sin(y / 7)
        for x in range(int(cx - 4), int(cx + 5)):
            d = abs(x + .5 - cx)
            if d < 1.7: L.set(x, y, 'water' if not 40 <= y <= 45 else 'shallow')
            elif d < 2.5: L.set(x, y, 'shallow')
            elif d < 3.4 and L.get(x, y) != T['rock']: L.set(x, y, 'sand')
    blob(44, 41, 13, 9, 'camp', .25, 11)       # the aul's trodden ground
    blob(65, 38, 6, 5, 'dirt', .2, 12)          # before the council yurt
    blob(46, 22, 10, 6, 'dirt', .3, 13)         # the smith's yard and training ground
    blob(80, 45, 7, 10, 'steppe', .3, 14)       # the hill
    blob(62, 7, 20, 5, 'dirt', .35, 15)         # the ridge
    for cx, cy, rx, ry, s in ((84, 14, 4, 4, 31), (8, 10, 4, 3, 32), (86, 66, 3, 3, 33), (40, 4, 3, 2, 34)): blob(cx, cy, rx, ry, 'rock', .5, s)
    path([(44, 68), (44, 58), (44, 48)], 1.2)                 # the road into the aul
    path([(46, 36), (46, 28), (46, 20), (56, 12)], 1.0)       # up to the training ground and the ridge
    path([(52, 40), (64, 38)], 1.0)                           # to the council yurt
    path([(40, 44), (30, 43), (18, 42)], 1.0, 'sand')         # over the ford to the pastures
    path([(56, 46), (72, 46), (80, 46)], 1.0)                 # to the hill

def place():
    o, t = L.obj, L.tag
    o('gate', *P(44, 66), 0)
    for x, y in ((40, 64), (52, 62), (66, 66), (14, 14), (70, 22), (22, 66)): o('feather', *P(x, y))
    # the aul
    for x, y, v in ((36, 34, 0), (42, 33, 1), (50, 34, 0), (38, 47, 1), (52, 48, 0), (56, 40, 1)): o('yurt', *P(x, y), v)
    o('kerege', *P(48, 44)); o('firepit', *P(44, 40)); o('cauldron', *P(46, 38), 0); o('hitch', *P(34, 40))
    o('saba', *P(34.6, 38), 0, t('saba')); o('tuskiiz', *P(55.4, 36), 0, t('tuskiiz')); o('carpet', *P(48, 40))
    # the council yurt and the bi's court
    o('yurt', *P(66, 36), 1); o('banner', *P(62, 34), 0); o('carpet', *P(66, 40.6)); o('scrolltable', *P(68.6, 40.4), 0, t('jarghy'))
    # the smith's yard and the training ground
    o('kiln', *P(40, 18)); o('anvil', *P(42.4, 19.6)); o('sabrerack', *P(38, 22), 0, t('sabrerack')); o('lancerack', *P(52, 16))
    for x in (46, 50, 54): o('target', *P(x, 24.6))       # sabre dummies
    for x in (44, 50, 56): o('target', *P(x, 15.2))       # naiza targets
    o('jar', *P(36.6, 18.6), 1, t('oldbox'))
    # pastures: horses, sheep, camels, cows (the four kinds)
    o('fence', *P(12, 30), 0); o('fence', *P(18, 30), 1); o('hitch', *P(8, 44)); o('yurt', *P(10, 52), 0); o('firepit', *P(14, 50))
    o('bales', *P(20, 56), 0, t('qyzhorse'))
    # the hill of ancestors
    for x, y, v in ((76, 40, 0), (80, 38, 0), (84, 42, 0), (78, 48, 0), (83, 50, 0)): o('kulpytas', *P(x, y), v)
    o('kulpytas', *P(80, 44), 0, t('ancestor')); o('menhir', *P(86, 34), 0, t('gatestone'))
    o('jar', *P(74.6, 52.6), 0, t('ninepits'))
    # the ridge: the Dzungar vanguard
    for x in (50, 74): o('banner', *P(x, 5), 2)
    o('yurt', *P(80, 6), 0); o('firepit', *P(70, 10)); o('wagon', *P(52, 10))
    o('reeds', *P(29, 26)); o('reeds', *P(31, 56)); o('willow', *P(26, 34)); o('birch', *P(34, 60), 1)

def emit():
    build(); place()
    I = L.interact; tag = L.tag
    I('gate7', *P(44, 66.8), 26)
    I('saba', *P(34.6, 38.8), 18, tag('saba'))
    I('tuskiiz', *P(55.4, 36.8), 18, tag('tuskiiz'))
    I('jarghy', *P(68.6, 41.2), 20, tag('jarghy'))
    I('sabrerack', *P(38, 22.8), 20, tag('sabrerack'))
    I('lancerack', *P(52, 16.8), 20)
    I('oldbox', *P(36.6, 19.4), 16, tag('oldbox'))
    I('qyzhorse', *P(20, 56.8), 18, tag('qyzhorse'))
    I('ancestor', *P(80, 44.8), 22, tag('ancestor'))
    I('gatestone', *P(86, 34.8), 18, tag('gatestone'))
    I('ninepits', *P(74.6, 53.4), 16, tag('ninepits'))
    I('pasture', *P(14, 34), 22)
    for key, x0, y0, x1, y1 in (('aul', 34, 30, 56, 50), ('ridge', 42, 2, 86, 16), ('hill', 72, 32, 88, 56), ('ford', 26, 38, 34, 48)):
        L.trigger(key, x0, y0, x1, y1)
    W_ = lambda *a: a
    L.npc('aksakal', 'AKSAKAL', 46, 42, [W_(46, 42, 520, 'idle'), W_(44, 44, 240, 'talk'), W_(48, 42.6, 300, 'idle')])
    L.npc('batyr', 'BATYR', 48, 26.4, [W_(48, 26.4, 480, 'idle'), W_(52, 26, 260, 'talk'), W_(44, 27, 300, 'idle', 2)])
    L.npc('zhyrshy', 'ZHYRSHY', 42, 38, [W_(42, 38, 520, 'work', 4), W_(40, 40, 240, 'talk')])
    L.npc('apa', 'APA', 38, 44, [W_(38, 44, 520, 'work', 4), W_(36, 42, 260, 'talk')])
    L.npc('usta', 'USTA', 42, 20, [W_(42, 20, 520, 'work', 2), W_(40, 21, 240, 'talk')])
    L.npc('qyz', 'QYZ', 16, 40, [W_(16, 40, 420, 'idle'), W_(12, 46, 260, 'talk'), W_(20, 44, 300, 'idle')])
    L.npc('bi', 'BI', 64, 41, [W_(64, 41, 600, 'talk', 4)])
    L.npc('twin7', 'TWIN', 84, 36, [W_(84, 36, 600, 'idle')], inactive=True)
    L.animals.extend([('HORSE', 8, 26), ('HORSE', 12, 24), ('HORSE', 18, 26), ('SHEEP', 6, 36), ('SHEEP', 9, 38), ('SHEEP', 12, 37),
                      ('CAMEL', 8, 58), ('CAMEL', 12, 60), ('COW', 18, 50), ('COW', 22, 52), ('HORSE', 36, 40)])
    # Enemies (type, x, y, group): 1/2 the Dzungar vanguard on the road to the ford, 1/2 their riders' screen on the ridge,
    # 0 wolves by the pastures, 8 the noyon of the grey banners (three banners: the Witness behaviour).
    L.enemies.extend([(0, 6, 64, 1), (0, 10, 66, 1),
                      (1, 22, 12, 2), (2, 18, 10, 2), (1, 26, 8, 2),
                      (1, 50, 8, 3), (2, 56, 6, 3), (1, 74, 9, 3),
                      (8, 62, 7, 4)])
    L.enemy_sheets = {0: 'WOLF', 1: 'JUNGAR', 2: 'JUNGARARCHER', 3: 'BEAR', 4: 'SHADE', 5: 'WRAITH', 8: 'NOYON'}
    L.pickups = [(9, 2, 30, 34), (4, 8, 50, 52), (25, 2, 14, 48), (21, 1, 60, 26), (23, 1, 70, 52), (9, 2, 80, 30), (22, 1, 40, 12), (20, 1, 86, 60)]
    L.area('world', 0, 0, W, H)
    L.zone_area = [0] * 8
    L.zone_fx = [0] * 8
    L.teleports = ['gate7']
    L.spawn = (44, 68.4)
    L.write()

if __name__ == '__main__':
    emit()
