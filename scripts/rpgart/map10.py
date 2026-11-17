"""MAP10 «Он бірінші тігіс» — independent Kazakhstan: Almaty, 2087; the Shezhire Institute in the foothills (hand-designed).

One area. Zones: 0 the Almaty street (apple trees, lamps), 1 Republic Square (the Independence monument), 2 the Institute
lobby, 3 the archive (servers), 4 the hall of the Gate (the final fight), 5 the park on the hill.
"""
import math, os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from rpgart.core import fbm, noise2
from rpgart.levelgen import Level, TS

W, H = 86, 72
L = Level('map10', W, H)
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
            n = fbm(x, y, 12, 3, 110)
            L.grid[y][x] = T['grass'] if n > .28 else T['meadow']
            z = 0
            if y < 22 and 20 <= x < 64: z = 4
            elif 24 <= y < 44 and 26 <= x < 58: z = 2
            elif 24 <= y < 44 and x >= 58: z = 3
            elif x < 26 and 22 <= y < 52: z = 1
            elif x >= 64 and y < 24: z = 5
            L.zone[y][x] = z
    for y in range(H):
        for x in range(W):
            if min(x, y, W - 1 - x, H - 1 - y) < 2 + (noise2(x, y, 5) > .64): L.set(x, y, 'rock')
    L.fill(2, 48, W - 2, 70, 'pave')           # the street
    for x in range(2, W - 2): L.set(x, 58, 'dirt')   # a planted strip
    blob(14, 36, 10, 11, 'pave', .1, 12)       # Republic Square
    # The Institute: lobby + archive (deepwall shell), the hall of the Gate to the north; doors at x 41–43.
    L.fill(26, 24, 80, 44, 'pave')
    for x in range(25, 81):
        for y in (23, 44):
            if not (y == 44 and 40 <= x <= 44) and not (y == 23 and 40 <= x <= 44): L.set(x, y, 'deepwall')
    for y in range(23, 45):
        for x in (25, 80): L.set(x, y, 'deepwall')
        if not 32 <= y <= 35: L.set(58, y, 'deepwall')
    L.fill(21, 3, 64, 22, 'pave')
    for x in range(20, 65):
        for y in (2, 22):
            if not (y == 22 and 40 <= x <= 44): L.set(x, y, 'deepwall')
    for y in range(2, 23):
        for x in (20, 64): L.set(x, y, 'deepwall')
    L.fill(40, 22, 45, 24, 'pave')             # the doorway between the lobby and the hall
    blob(74, 12, 9, 8, 'grass', .2, 14)        # the park on the hill

def place():
    o, t = L.obj, L.tag
    o('gate', *P(42, 64), 0)
    # the street
    for x in range(6, 82, 10): o('streetlamp', *P(x, 50))
    for x in range(10, 82, 12): o('apple', *P(x, 58))
    o('bench', *P(30, 52)); o('bench', *P(56, 52)); o('jar', *P(70, 66), 1, t('tenge'))
    # Republic Square: the monument
    o('pillar', *P(14, 34), 1); o('banner', *P(10, 30), 1); o('banner', *P(18, 30), 1); o('menhir', *P(14, 31.4), 0, t('monument'))
    o('kulpytas', *P(6, 44), 0, t('zheltoqsan'))
    # the lobby
    for x in (30, 54): o('labpanel', *P(x, 26))
    o('scrolltable', *P(42, 30), 0, t('book')); o('bench', *P(34, 38)); o('bench', *P(50, 38))
    o('banner', *P(38, 25.6), 1, t('symbols')); o('labbench', *P(30, 40), 0, t('constitution'))
    # the archive
    for x in range(62, 80, 4): o('server', *P(x, 27))
    for x in range(62, 80, 4): o('server', *P(x, 36))
    o('officedesk', *P(70, 41), 0, t('semey')); o('jar', *P(78, 41.6), 2, t('tencharms'))
    # the hall of the Gate
    o('gate', *P(42, 6), 1, t('gatecore')); for_x = [24, 60]
    for x in for_x: o('labpanel', *P(x, 4))
    for x in (26, 58): o('server', *P(x, 16))
    # the park
    for x, y in ((68, 6), (76, 8), (82, 14), (70, 18)): o('apple', *P(x, y))
    o('bench', *P(74, 14), 0, t('astana'))

def emit():
    build(); place()
    I = L.interact; tag = L.tag
    I('gate10', *P(42, 64.8), 26)
    I('monument', *P(14, 32.2), 22, tag('monument'))
    I('symbols', *P(38, 26.4), 18, tag('symbols'))
    I('book', *P(42, 30.8), 20, tag('book'))
    I('semey', *P(70, 41.8), 20, tag('semey'))
    I('constitution', *P(30, 40.8), 18, tag('constitution'))
    I('zheltoqsan', *P(6, 44.8), 18, tag('zheltoqsan'))
    I('tenge', *P(70, 66.8), 16, tag('tenge'))
    I('astana', *P(74, 14.8), 18, tag('astana'))
    I('tencharms', *P(78, 42.4), 14, tag('tencharms'))
    I('halldoor', *P(42, 23.4), 22)
    I('gatecore', *P(42, 8), 26, tag('gatecore'))
    for key, x0, y0, x1, y1 in (('square', 4, 24, 24, 48), ('lobby', 27, 25, 57, 43), ('hall', 22, 4, 63, 21), ('archive', 59, 25, 79, 43)):
        L.trigger(key, x0, y0, x1, y1)
    W_ = lambda *a: a
    L.npc('dana', 'DANA', 38, 34, [W_(38, 34, 600, 'idle'), W_(36, 36, 260, 'talk')])
    L.npc('erlan', 'ERLAN', 46, 34, [W_(46, 34, 600, 'idle'), W_(48, 36, 260, 'talk')])
    L.npc('prof', 'PROF', 42, 28.6, [W_(42, 28.6, 600, 'work', 0), W_(44, 29, 260, 'talk')])
    L.npc('guard10', 'GUARD10', 66, 32, [W_(66, 32, 600, 'idle')])
    L.npc('citizen', 'CITIZEN', 18, 38, [W_(18, 38, 520, 'idle'), W_(12, 40, 260, 'talk')])
    L.npc('twin10', 'TWIN', 42, 24.6, [W_(42, 24.6, 600, 'idle')], inactive=True)
    L.npc('knot', 'KNOTKEEPER', 42, 10, [W_(42, 10, 600, 'idle')], inactive=True)
    L.animals.extend([('HORSE', 78, 20)])
    # Enemies: 4/5 Zulmat's shades in the street and the archive, 4/5 in the hall, 11 Zulmat.
    L.enemies.extend([(4, 24, 54, 1), (5, 60, 54, 1),
                      (4, 66, 30, 2), (5, 74, 38, 2),
                      (4, 30, 10, 3), (4, 54, 10, 3),
                      (11, 42, 12, 4)])
    L.enemy_sheets = {0: 'WOLF', 1: 'STRANGER', 2: 'ARCHER', 3: 'BEAR', 4: 'SHADE', 5: 'WRAITH', 11: 'ZULMAT'}
    L.pickups = [(9, 2, 22, 62), (9, 2, 60, 62), (25, 2, 14, 46), (21, 1, 76, 30), (23, 1, 50, 40), (20, 1, 30, 28), (5, 1, 42, 40), (4, 10, 80, 66)]
    L.area('world', 0, 0, W, H)
    L.zone_area = [0] * 6
    L.zone_fx = [0] * 6
    L.teleports = ['gate10']
    L.spawn = (42, 66.4)
    L.write()

if __name__ == '__main__':
    emit()
