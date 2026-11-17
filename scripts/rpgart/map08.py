"""MAP08 «Өрт» — the Russian Empire: the Akmola fortress (Akmolinsk prikaz) on the Esil, 1838 (hand-designed).

One area. Zones: 0 steppe road, 1 the fortress (courtyard, the district office), 2 the trade yard by the east gate,
3 the aul under the walls, 4 the sarbaz camp in the hills, 5 the Esil, 6 the shooting range, 7 the office archive.
The fire: after the night attack the burnt marks (tag 'burnt') appear inside the walls.
"""
import math, os, random, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from rpgart.core import fbm, noise2
from rpgart.levelgen import Level, TS

W, H = 92, 76
L = Level('map08', W, H)
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
                    if math.hypot(x + .5 - px, y + .5 - py) < w + noise2(x, y, 9) * .5 and L.get(x, y) not in (L.T['rock'], L.T['water'], L.T['logwall']): L.set(x, y, t)

FX0, FY0, FX1, FY1 = 34, 20, 64, 46   # the palisade

def build():
    T = L.T
    for y in range(H):
        for x in range(W):
            n = fbm(x, y, 12, 3, 108)
            L.grid[y][x] = T['steppe'] if n > .36 else T['grass'] if n > .2 else T['meadow']
            z = 0
            if FX0 <= x <= FX1 and FY0 <= y <= FY1: z = 7 if (x < 44 and y < 28) else 1
            elif FX1 < x < 76 and 24 <= y < 44: z = 2
            elif 14 <= x < FX0 and 26 <= y < 54: z = 3
            elif x < 30 and y < 24: z = 4
            elif x >= 76: z = 5
            elif FX1 < x < 76 and 46 <= y < 64: z = 6
            L.zone[y][x] = z
    for y in range(H):
        for x in range(W):
            if min(x, y, W - 1 - x, H - 1 - y) < 2 + (noise2(x, y, 5) > .6): L.set(x, y, 'rock')
    for y in range(2, H - 2):   # the Esil
        cx = 82 + 2.2 * math.sin(y / 8)
        for x in range(int(cx - 5), int(cx + 6)):
            d = abs(x + .5 - cx)
            if d < 2.4: L.set(x, y, 'water')
            elif d < 3.2: L.set(x, y, 'shallow')
            elif d < 4.4 and L.get(x, y) != T['rock']: L.set(x, y, 'sand')
    L.fill(FX0 + 1, FY0 + 1, FX1, FY1, 'dirt')
    L.fill(36, 22, 44, 28, 'timber')                     # the district office
    for x in range(FX0, FX1 + 1):
        for y in (FY0, FY1):
            if not (y == FY1 and 48 <= x <= 51): L.set(x, y, 'logwall')
    for y in range(FY0, FY1 + 1):
        for x in (FX0, FX1):
            if not (x == FX1 and 32 <= y <= 35): L.set(x, y, 'logwall')
    for x in range(36, 45):                              # the office walls (door at x 40)
        if x != 40: L.set(x, 28, 'logwall')
    for y in range(21, 29): L.set(44, y, 'logwall')
    blob(70, 34, 6, 8, 'dirt', .3, 12)       # trade yard
    blob(24, 40, 8, 10, 'camp', .3, 13)      # the aul
    blob(16, 12, 10, 7, 'steppe', .3, 14)    # the hills
    blob(70, 54, 6, 7, 'dirt', .3, 15)       # range
    for cx, cy, rx, ry, s in ((10, 6, 5, 3, 31), (6, 64, 4, 3, 32), (60, 70, 4, 2, 33)): blob(cx, cy, rx, ry, 'rock', .5, s)
    path([(49, 72), (49, 58), (49, 46)], 1.2)
    path([(64, 33), (72, 33)], 1.0); path([(34, 40), (24, 40)], 1.0)
    path([(49, 50), (68, 54)], 1.0); path([(24, 32), (18, 16)], 1.0)

def place():
    o, t = L.obj, L.tag
    o('gate', *P(49, 70), 0)
    for x, y in ((40, 66), (58, 64), (20, 64), (30, 10), (74, 14), (12, 50)): o('feather', *P(x, y))
    # the fortress
    o('blockhouse', *P(38, 44), 0); o('blockhouse', *P(60, 44), 0); o('blockhouse', *P(60, 26), 0)
    o('watchtower', *P(62.4, 22.6)); o('cannon', *P(56, 40)); o('powderkeg', *P(52, 42)); o('powderkeg', *P(53.4, 42.6)); o('banner', *P(49, 22.8), 1)
    o('officedesk', *P(40, 24), 0, t('officedesk')); o('shelves', *P(37.6, 22.6)); o('jar', *P(42.6, 26.2), 2, t('keys'))
    o('wagon', *P(46, 36)); o('hitch', *P(52, 30))
    for x, y in ((46, 30), (54, 34), (40, 38), (58, 32)): o('burnt', *P(x, y), 0, t('burnt'))
    # trade yard
    for k, (x, y) in enumerate(((68, 28), (72, 30), (68, 38))): o('stall', *P(x, y), k % 3)
    o('bales', *P(73, 37)); o('caravangate', *P(66.4, 33.6)); o('wagon', *P(72, 42), 0)
    o('jar', *P(74, 28), 1, t('letter'))
    # the aul under the walls
    for x, y, v in ((20, 34, 0), (26, 34, 1), (18, 44, 1), (26, 46, 0)): o('yurt', *P(x, y), v)
    o('firepit', *P(22, 40)); o('cauldron', *P(24, 39), 0); o('fence', *P(16, 50), 0); o('sheaf', *P(18, 52), 0, t('plough'))
    # the sarbaz camp
    o('yurt', *P(14, 10), 0); o('firepit', *P(18, 14)); o('banner', *P(22, 10), 2); o('hitch', *P(10, 14))
    o('carpet', *P(18, 17), 0, t('dombra'))
    # the range
    for x in (66, 72): o('target', *P(x, 47.4))           # musket targets (north edge of the range)
    for x in (64, 68, 72): o('target', *P(x, 58.6))       # bayonet dummies
    o('weaponrack', *P(62, 54), 0, t('oldsabre'))
    # the teacher's corner: a desk under an awning by the aul
    o('officedesk', *P(30, 30), 0, t('primer')); o('bench', *P(30, 32.6))
    o('reeds', *P(78, 24)); o('reeds', *P(77, 60)); o('willow', *P(76, 40)); o('birch', *P(8, 30), 1)

def emit():
    build(); place()
    I = L.interact; tag = L.tag
    I('gate8', *P(49, 70.8), 26)
    I('officedesk', *P(40, 24.8), 20, tag('officedesk'))
    I('keys', *P(42.6, 27), 14, tag('keys'))
    I('letter', *P(74, 28.8), 16, tag('letter'))
    I('plough', *P(18, 52.8), 16, tag('plough'))
    I('dombra', *P(18, 17.8), 18, tag('dombra'))
    I('oldsabre', *P(62, 54.8), 18, tag('oldsabre'))
    I('primer', *P(30, 30.8), 18, tag('primer'))
    I('musketrack', *P(60, 50), 20)
    for k, (x, y) in enumerate(((39, 44.8), (59, 44.8), (59, 26.8))): I(f'door{k + 1}', *P(x, y), 20)
    for key, x0, y0, x1, y1 in (('fort', 35, 21, 64, 46), ('range', 64, 46, 76, 64), ('camp', 4, 4, 28, 22), ('court', 44, 30, 58, 40)):
        L.trigger(key, x0, y0, x1, y1)
    W_ = lambda *a: a
    L.npc('tilmash', 'TILMASH', 41.6, 25, [W_(41.6, 25, 520, 'work', 4), W_(38.6, 26.4, 260, 'talk')])
    L.npc('akbope', 'AKBOPE', 24, 42, [W_(24, 42, 520, 'work', 4), W_(22, 44, 260, 'talk')])
    L.npc('tatar', 'TATAR', 70, 33, [W_(70, 33, 420, 'idle'), W_(72, 35, 260, 'talk')])
    L.npc('sarbaz', 'SARBAZ', 20, 15, [W_(20, 15, 480, 'idle'), W_(16, 16, 260, 'talk')])
    L.npc('sentry8', 'SENTRY8', 60, 51, [W_(60, 51, 480, 'idle'), W_(64, 52, 260, 'talk')])
    L.npc('teacher', 'TEACHER', 31.6, 31, [W_(31.6, 31, 520, 'idle'), W_(29, 33, 260, 'talk')])
    L.npc('chron', 'CHRONICLER', 50, 34, [W_(50, 34, 600, 'idle')], inactive=True)
    L.animals.extend([('HORSE', 12, 18), ('HORSE', 8, 16), ('SHEEP', 14, 48), ('SHEEP', 18, 48), ('COW', 28, 52), ('CAMEL', 74, 40)])
    # Enemies: 1 horse thieves on the road (barymta), 2 raiders in the night's chaos (inside the walls), 3 ink shades in the
    # smoke, 9 the Chronicler (the second image's behaviour: prediction, copies, then he stops fighting and speaks).
    L.enemies.extend([(1, 30, 62, 1), (1, 34, 64, 1),
                      (1, 46, 32, 2), (1, 56, 36, 2),
                      (4, 42, 40, 3), (4, 54, 30, 3), (5, 48, 26, 3),
                      (9, 50, 35, 4)])
    L.enemy_sheets = {0: 'WOLF', 1: 'BARYMTA', 2: 'SARBAZ', 3: 'BEAR', 4: 'SHADE', 5: 'WRAITH', 9: 'CHRONICLER'}
    L.pickups = [(9, 2, 24, 30), (4, 6, 70, 44), (25, 2, 20, 46), (21, 1, 12, 20), (23, 1, 46, 42), (9, 2, 56, 24), (20, 1, 74, 60)]
    L.area('world', 0, 0, W, H)
    L.zone_area = [0] * 8
    L.zone_fx = [0] * 8
    L.teleports = ['gate8']
    L.spawn = (49, 72.4)
    L.write()

if __name__ == '__main__':
    emit()
