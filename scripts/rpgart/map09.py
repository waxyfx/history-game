"""MAP09 «Хат» — Soviet Kazakhstan: Alma-Ata, autumn 1941 (hand-designed).

One area. Zones: 0 the railway station (evacuation trains), 1 the evacuated plant, 2 the training ground, 3 the library,
4 the apple orchard, 5 the street with the loudspeaker, 6 the hall of memory (boss: the Heir), 7 the post office.
"""
import math, os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from rpgart.core import fbm, noise2
from rpgart.levelgen import Level, TS

W, H = 90, 74
L = Level('map09', W, H)
P = lambda x, y: (x * TS, y * TS)

def blob(cx, cy, rx, ry, t, jag=.25, seed=0, only=None):
    for y in range(int(cy - ry - 2), int(cy + ry + 3)):
        for x in range(int(cx - rx - 2), int(cx + rx + 3)):
            d = ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2
            if d <= 1 + (noise2(x, y, seed + 3) - .5) * jag and (only is None or L.get(x, y) in only): L.set(x, y, t)

def build():
    T = L.T
    for y in range(H):
        for x in range(W):
            n = fbm(x, y, 12, 3, 109)
            L.grid[y][x] = T['grass'] if n > .3 else T['meadow']
            z = 5
            if y >= 58: z = 0
            elif x < 30 and 30 <= y < 58: z = 1
            elif x < 30 and y < 30: z = 2
            elif x >= 62 and 30 <= y < 58: z = 3
            elif x >= 62 and y < 30: z = 4
            elif 34 <= x < 58 and y < 22: z = 6
            elif 46 <= x < 60 and 44 <= y < 56: z = 7
            L.zone[y][x] = z
    for y in range(H):
        for x in range(W):
            if min(x, y, W - 1 - x, H - 1 - y) < 2 + (noise2(x, y, 5) > .62): L.set(x, y, 'rock')
    L.fill(2, 60, W - 2, 72, 'dirt')                     # the station yard
    for x in range(2, W - 2): L.set(x, 66, 'pave')        # the platform edge
    L.fill(32, 22, 60, 58, 'pave')                       # the street
    L.fill(4, 32, 28, 56, 'dirt')                        # the plant's yard
    L.fill(6, 6, 28, 28, 'steppe')                       # the training ground
    L.fill(64, 34, 86, 54, 'pave')                       # the library square
    L.fill(64, 6, 86, 28, 'grass')                       # the orchard
    # the hall of memory: timber floor, log walls, door at the south (x 45–47)
    L.fill(36, 4, 57, 20, 'timber')
    for x in range(35, 58):
        for y in (3, 20):
            if not (y == 20 and 44 <= x <= 47): L.set(x, y, 'logwall')
    for y in range(3, 21):
        for x in (35, 57): L.set(x, y, 'logwall')
    for x in range(30, 34): L.set(x, 44, 'pave')         # side lanes
    for x in range(58, 64): L.set(x, 44, 'pave')
    for y in range(28, 32): L.set(16, y, 'dirt'); L.set(74, y, 'grass')

def place():
    o, t = L.obj, L.tag
    o('gate', *P(46, 68), 0)
    # the station
    for x in (14, 34, 62, 78): o('wagon9', *P(x, 63.4))
    o('bales', *P(24, 70)); o('shellcrate', *P(52, 70)); o('streetlamp', *P(40, 70)); o('streetlamp', *P(56, 70))
    o('jar', *P(72, 70), 2, t('deport'))
    # the plant
    o('factory', *P(16, 42)); o('lathe', *P(8, 50)); o('lathe', *P(14, 52)); o('lathe', *P(20, 50))
    for k, (x, y) in enumerate(((24, 54), (26, 48), (6, 54))): o('shellcrate', *P(x, y), 0, t(f'crate{k + 1}'))
    o('poster', *P(28, 44), 0, t('turksib'))
    # the training ground
    for x in (10, 22): o('target', *P(x, 8.4))           # rifle targets (north edge)
    for x in (12, 16, 20): o('target', *P(x, 20.6))      # bayonet dummies
    for x in (8, 14, 20): o('target', *P(x, 14.4))       # the burst line (PPSh)
    o('weaponrack', *P(26, 24))
    # the street and the post office
    o('loudspeaker', *P(46, 30)); o('bench', *P(40, 34)); o('bench', *P(52, 34)); o('streetlamp', *P(36, 26)); o('streetlamp', *P(56, 26))
    o('officedesk', *P(53, 49), 0, t('postbag')); o('shelves', *P(49, 46.6)); o('poster', *P(58, 46))
    # the library
    o('shelves', *P(68, 38)); o('shelves', *P(76, 38)); o('scrolltable', *P(72, 44), 0, t('cards')); o('poster', *P(82, 40), 1, t('heroines'))
    o('bench', *P(74, 50))
    # the orchard
    for x, y in ((66, 8), (72, 10), (78, 8), (84, 12), (68, 16), (76, 18), (82, 22), (70, 24)): o('apple', *P(x, y))
    o('kulpytas', *P(86, 26), 0, t('famine')); o('jar', *P(64.6, 26.6), 1, t('ninestars'))
    # the hall of memory
    for x in (38, 54): o('torch', *P(x, 6))
    for x in (40, 46, 52): o('poster', *P(x, 4.6))
    o('shelves', *P(38, 18)); o('shelves', *P(54, 18)); o('scrolltable', *P(46, 6.4), 0, t('names'))
    # the Virgin Lands poster by the platform (audit №14); the closed library shelf, the returned letters at the post office
    # and the street loudspeaker already stand above
    o('poster', *P(84, 67.4))

def emit():
    build(); place()
    I = L.interact; tag = L.tag
    I('gate9', *P(46, 68.8), 26)
    for k, (x, y) in enumerate(((24, 54.8), (26, 48.8), (6, 54.8))): I(f'crate{k + 1}', *P(x, y), 16, tag(f'crate{k + 1}'))
    I('turksib', *P(28, 44.8), 16, tag('turksib'))
    I('riflerack', *P(26, 24.8), 20)
    I('postbag', *P(53, 49.8), 20, tag('postbag'))
    I('cards', *P(72, 44.8), 20, tag('cards'))
    I('heroines', *P(82, 40.8), 16, tag('heroines'))
    I('famine', *P(86, 26.8), 18, tag('famine'))
    I('ninestars', *P(64.6, 27.4), 14, tag('ninestars'))
    I('deport', *P(72, 70.8), 16, tag('deport'))
    I('names', *P(46, 7.2), 22, tag('names'))
    I('lists', *P(58, 49.8), 16)
    I('banned', *P(68, 38.8), 16)      # the library's closed shelf: books of the Alash authors (1937–38)
    I('alzhir', *P(49, 47.4), 16)      # the post office shelf: letters returned from «26-я точка» (ALZhIR)
    I('tyn', *P(84, 68.2), 16)         # a poster of 1954 by the platform: the Virgin Lands
    I('baikonur', *P(46, 30.8), 18)    # the street loudspeaker speaks from 12 April 1961
    for key, x0, y0, x1, y1 in (('station', 2, 58, 88, 72), ('orchard', 64, 6, 86, 28), ('hall', 36, 4, 57, 19), ('street', 34, 26, 58, 40)):
        L.trigger(key, x0, y0, x1, y1)
    W_ = lambda *a: a
    L.npc('postwoman', 'POSTWOMAN', 50, 52, [W_(50, 52, 520, 'idle'), W_(54, 52, 260, 'talk')])
    L.npc('worker', 'WORKER', 14, 49.6, [W_(14, 49.6, 520, 'work', 4), W_(12, 51, 260, 'talk')])
    L.npc('librarian', 'LIBRARIAN', 72, 41, [W_(72, 41, 520, 'work', 4), W_(70, 42, 260, 'talk')])
    L.npc('akyn', 'AKYN', 76, 48, [W_(76, 48, 600, 'idle'), W_(78, 50, 260, 'talk')])
    L.npc('evacuee', 'EVACUEE', 30, 62, [W_(30, 62, 420, 'idle'), W_(36, 61, 260, 'talk')])
    L.npc('instructor', 'INSTRUCTOR', 24, 18, [W_(24, 18, 520, 'idle'), W_(26, 16, 260, 'talk')])
    L.npc('twin9', 'TWIN', 74, 14, [W_(74, 14, 600, 'idle')], inactive=True)
    L.npc('mother', 'CITIZEN', 66, 44, [W_(66, 44, 600, 'idle')], inactive=True)
    L.animals.extend([('HORSE', 40, 50), ('COW', 70, 30)])
    # Enemies: 4/5 shades of oblivion in the orchard's dusk and the hall, 6 the Heir (the keeper's behaviour).
    L.enemies.extend([(4, 70, 20, 1), (4, 80, 16, 1),
                      (4, 40, 14, 2), (5, 52, 10, 2), (4, 48, 16, 2),
                      (6, 46, 11, 3)])
    L.enemy_sheets = {0: 'WOLF', 1: 'STRANGER', 2: 'ARCHER', 3: 'BEAR', 4: 'SHADE', 5: 'WRAITH', 6: 'HEIR'}
    L.pickups = [(9, 2, 40, 44), (4, 10, 12, 26), (25, 2, 70, 56), (21, 1, 60, 36), (23, 1, 8, 36), (9, 2, 80, 30), (22, 1, 44, 24), (4, 12, 84, 60)]
    L.area('world', 0, 0, W, H)
    L.zone_area = [0] * 8
    L.zone_fx = [0] * 8
    L.teleports = ['gate9']
    L.spawn = (46, 70.4)
    L.write()

if __name__ == '__main__':
    emit()
