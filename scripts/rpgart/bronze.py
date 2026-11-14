"""MAP02 (bronze age) props: dwellings, metallurgy, granary, pastures, sanctuary, burials, underground.
Reconstruction notes (artistic): Andronovo-type semi-dugout houses with timber-and-earth roofs,
clay shaft furnaces with bellows, stone casting moulds, geometric-ornament pottery, stone cists and a
Begazy-Dandybai-style stone mausoleum. Murals, the tablet and the Institute symbol are fiction."""
import math, random
from .core import *

def dugout(variant=0):
    """Semi-dugout house: low earthen mound on a timber frame, ramp entrance, smoke hole."""
    w, h = 76, 52
    img = new(w, h); p = Px(img)
    cx, base = w // 2, h - 6
    # Earth mound roof
    p.ellipse(cx, base - 14, 35, 17, None, shade=lambda nx, ny: tone('dirt', .55 - ny * .35 - nx * .2 + (noise2(int(nx * 30), int(ny * 30), 3 + variant) - .5) * .25, int(nx * 35 + cx), int(ny * 17)))
    for y in range(base - 4, h):
        for x in range(w):
            if img.getpixel((x, y))[3] and y > base - 2: p.set(x, y, CLEAR)
    # Grass tufts on the turf roof
    rnd = random.Random(variant + 3)
    for _ in range(26):
        x = rnd.randrange(cx - 30, cx + 30); y = rnd.randrange(base - 30, base - 6)
        if img.getpixel((x, y))[3]: p.set(x, y, c('steppe', 3)); p.set(x, y - 1, c('steppe', 4))
    # Timber rafters peeking out of the roof edge
    for k in range(-28, 30, 7):
        p.line(cx + k, base - 4, cx + k * 1.05, base - 8, c('wood', 2))
    # Smoke hole with soot
    p.ellipse(cx + 6, base - 27, 4, 2, c('ink', 1)); p.ellipse(cx + 6, base - 28, 3, 1, c('fur', 1))
    # Entrance ramp and doorway frame
    p.poly([(cx - 7, base - 2), (cx + 7, base - 2), (cx + 10, base + 4), (cx - 10, base + 4)], c('dirt', 1))
    p.rect(cx - 6, base - 16, 12, 14, c('ink', 0))
    p.rect(cx - 8, base - 18, 2, 18, c('wood', 3)); p.rect(cx + 6, base - 18, 2, 18, c('wood', 3)); p.rect(cx - 8, base - 19, 16, 2, c('wood', 4))
    if variant == 1:  # felt curtain with ornament
        p.rect(cx - 6, base - 16, 12, 10, c('red', 2))
        for x in range(cx - 5, cx + 6, 3): p.set(x, base - 12, c('gold', 3)); p.set(x + 1, base - 11, c('gold', 3))
    return outline(img), (cx, base)

def furnace(frame, cold=False):
    """Clay shaft furnace with a tuyere; glowing when lit."""
    w, h = 26, 36
    img = new(w, h); p = Px(img)
    cx, base = w // 2, h - 3
    p.poly([(cx - 9, base), (cx - 6, base - 22), (cx - 4, base - 28), (cx + 4, base - 28), (cx + 6, base - 22), (cx + 9, base)], None,
           shade=lambda x, y: tone('ochre', .55 - (x - cx) / 30 - (base - y) / 90 + (noise2(x, y, 5) - .5) * .15, x, y))
    p.ellipse(cx, base - 28, 4, 1.5, c('ink', 0))
    p.rect(cx - 3, base - 8, 6, 6, c('ink', 0))           # tapping arch
    p.line(cx + 8, base - 10, cx + 12, base - 12, c('ochre', 1))  # tuyere
    if not cold:
        glow = [0, 1, 2, 1][frame]
        p.rect(cx - 2, base - 7, 4, 4, c('fire', 3 + (glow > 0)))
        p.set(cx - 1, base - 6, c('fire', 5))
        p.ellipse(cx, base - 28, 3, 1, c('fire', 3 + glow // 2))
        for k in range(3): p.set(cx - 1 + k, base - 30 - glow - k, c('fire', 4, 160))
    else:
        p.rect(cx - 2, base - 6, 4, 3, c('fur', 1)); p.set(cx, base - 5, c('grey', 2))
    return outline(img), (cx, base)

def anvil():
    img = new(26, 18); p = Px(img)
    p.ellipse(13, 12, 11, 5, None, shade=lambda nx, ny: tone('stone', .65 - ny * .4 - nx * .2, 0, 0))
    p.rect(9, 5, 9, 4, c('stone', 4)); p.hline(9, 17, 5, c('stone', 6))
    p.line(19, 8, 24, 3, c('wood', 3)); p.rect(22, 2, 4, 2, c('gold', 3))    # bronze-headed hammer
    p.set(6, 10, c('gold', 4)); p.set(7, 10, c('gold', 3))
    return outline(img), (13, 15)

def bellows():
    img = new(20, 14); p = Px(img)
    p.ellipse(9, 8, 7, 4, None, shade=lambda nx, ny: tone('hide', .6 - ny * .4, 0, 0))
    for x in (5, 9, 13): p.vline(x, 5, 11, c('hide', 2))
    p.line(15, 8, 19, 9, c('wood', 3))
    return outline(img), (10, 11)

def mould():
    img = new(16, 12); p = Px(img)
    p.rect(2, 3, 12, 7, c('warmstone', 3)); p.hline(2, 13, 3, c('warmstone', 5))
    p.poly([(4, 6), (11, 5), (12, 7), (5, 8)], c('warmstone', 1))     # axe-shaped cavity
    p.set(9, 6, c('gold', 3))
    return outline(img), (8, 9)

def crucible():
    img = new(12, 10); p = Px(img)
    p.poly([(2, 3), (10, 3), (8, 9), (4, 9)], c('ochre', 2)); p.hline(2, 10, 3, c('ochre', 4))
    p.hline(4, 8, 4, c('gold', 4))
    return outline(img), (6, 8)

def heap(kind):
    img = new(24, 14); p = Px(img)
    rnd = random.Random(len(kind))
    ramp, acc = {'charcoal': ('ink', 'grey'), 'ore': ('green2', 'teal'), 'slag': ('fur', 'red')}[kind]
    p.ellipse(12, 9, 10, 5, None, shade=lambda nx, ny: tone(ramp, .5 - ny * .4 - nx * .15 + (noise2(int(nx * 20), int(ny * 20), 4) - .5) * .4, 0, 0))
    for _ in range(9):
        x, y = rnd.randrange(4, 20), rnd.randrange(5, 12)
        p.set(x, y, c(acc, 3 if kind != 'charcoal' else 2)); p.set(x + 1, y, c(acc, 4))
    return outline(img), (12, 11)

def toolrack():
    """Frame with bronze sickles, a socketed axe and daggers."""
    img = new(30, 26); p = Px(img)
    p.vline(3, 4, 24, c('wood', 3)); p.vline(26, 4, 24, c('wood', 3)); p.hline(2, 27, 6, c('wood', 4)); p.hline(2, 27, 15, c('wood', 2))
    for i, x in enumerate((7, 13, 19)):
        if i == 0:   # sickle
            for k in range(7): p.set(x + k * .6, 8 + math.sin(k / 6 * math.pi) * -3 + k * .6, c('gold', 4))
        elif i == 1:  # socketed axe
            p.vline(x, 7, 13, c('wood', 4)); p.rect(x - 2, 7, 5, 3, c('gold', 3)); p.set(x + 2, 8, c('gold', 5))
        else:         # dagger
            p.vline(x, 7, 13, c('gold', 4)); p.vline(x + 1, 8, 12, c('gold', 2)); p.hline(x - 1, x + 2, 12, c('wood', 3))
    p.ellipse(15, 20, 4, 2, c('gold', 3))
    return outline(img), (15, 24)

def jar(v):
    """Flat-based pot with incised geometric ornament (Andronovo style)."""
    w, h = (16, 18) if v < 2 else (12, 13)
    img = new(w, h); p = Px(img)
    cx = w // 2
    p.ellipse(cx, h * .55, w * .45, h * .42, None, shade=lambda nx, ny: tone('ochre' if v != 1 else 'dirt', .62 - nx * .3 - ny * .2, int(nx * 9), int(ny * 9)))
    p.rect(cx - w * .32, 1, w * .64, 3, c('ochre', 2)); p.hline(cx - w * .32, cx + w * .32, 1, c('ochre', 4))
    for x in range(int(cx - w * .36), int(cx + w * .36), 3):   # meander / zigzag band
        p.set(x, h * .45, c('ink', 1)); p.set(x + 1, h * .45 + 1, c('ink', 1)); p.set(x + 2, h * .45, c('ink', 1))
    return outline(img), (cx, h - 2)

def grainpit():
    img = new(26, 16); p = Px(img)
    p.ellipse(13, 9, 11, 6, c('dirt', 0))
    p.ellipse(13, 8, 9, 5, None, shade=lambda nx, ny: tone('sand', .65 - ny * .3, 0, 0))
    for k in range(10):
        a = k / 10 * math.pi * 2; p.set(13 + math.cos(a) * 6, 8 + math.sin(a) * 3, c('steppe', 5))
    p.line(4, 6, 22, 11, c('wood', 3)); p.line(5, 11, 21, 5, c('wood', 2))
    return outline(img), (13, 12)

def quern():
    img = new(20, 12); p = Px(img)
    p.ellipse(10, 7, 9, 4, None, shade=lambda nx, ny: tone('stone', .65 - ny * .35, 0, 0))
    p.ellipse(10, 5, 4, 2, c('stone', 5)); p.ellipse(10, 7, 6, 2, c('sand', 4, 180))
    return outline(img), (10, 9)

def fence(v):
    img = new(36, 18); p = Px(img)
    for x in range(1, 36, 7):
        p.vline(x, 3, 16, c('wood', 3)); p.vline(x + 1, 3, 16, c('wood', 1))
    for y in (6, 11): p.hline(0, 35, y, c('wood', 4)); p.hline(0, 35, y + 1, c('wood', 2))
    if v: p.rect(10, 13, 4, 3, c('steppe', 3))
    return outline(img), (18, 16)

def hearth(lit):
    """Sacred hearth: ring of large stones on a clay platform."""
    w, h = 44, 26
    img = new(w, h); p = Px(img)
    cx, cy = w // 2, 14
    p.ellipse(cx, cy, 20, 10, c('ochre', 1))
    p.ellipse(cx, cy, 13, 6, c('ink', 1) if lit else c('fur', 1))
    if not lit:
        rnd = random.Random(9)
        for _ in range(20): p.set(rnd.randrange(cx - 10, cx + 10), rnd.randrange(cy - 4, cy + 4), c('grey', rnd.randrange(1, 4)))
    for k in range(12):
        a = k / 12 * math.pi * 2
        p.ellipse(cx + math.cos(a) * 18, cy + math.sin(a) * 8.5, 3.4, 2.6, None, shade=lambda nx, ny: tone('stone', .7 - ny * .5 - nx * .2, 0, 0))
    for k in range(4):   # bronze plaques set into the platform
        a = k / 4 * math.pi * 2 + .4
        p.set(cx + math.cos(a) * 14, cy + math.sin(a) * 6, c('gold', 4))
    return outline(img), (cx, cy + 4)

def hearthfire(frame):
    w, h = 30, 40
    img = new(w, h); p = Px(img)
    rnd = random.Random(frame * 11 + 2)
    for y in range(h):
        t = y / h
        for lobe in (-5, 0, 5):
            half = math.sin(t * math.pi * .95) * (6 if lobe else 9) * (1 - t * .2)
            sway = math.sin(t * 5 + frame * 1.5 + lobe) * 2.5 * (1 - t)
            for x in range(w):
                d = abs(x - w / 2 - lobe * (1 - t) - sway) / max(.6, half)
                if d < 1:
                    heat = (1 - d) * .75 + t * .5 + (rnd.random() - .5) * .2
                    p.set(x, y + (abs(lobe) // 2), tone('fire', heat, x, y))
    for i in range(5): p.set(rnd.randrange(8, 22), rnd.randrange(0, 10), c('fire', 4))
    return img, (w // 2, h - 3)

def menhir(v):
    w, h = 16, 40 if v == 0 else 30
    img = new(w, h); p = Px(img)
    p.poly([(4, h - 2), (3, 8), (7, 1), (11, 3), (13, h - 2)], None, shade=lambda x, y: tone('stone', .7 - (x - 3) / 14 - y / 120 + (noise2(x // 2, y // 2, v) - .5) * .2, x, y))
    if v == 0:
        for y in (10, 14, 18): p.hline(5, 10, y, c('ochre', 3))
    return outline(img), (8, h - 2)

PG = {
    'sun': ["x.x.x", ".xxx.", "xx.xx", ".xxx.", "x.x.x", "..x..", ".xxx.", "x.x.x", "..x..", ".x.x."],
    'bull': ["x.....x", ".x...x.", "..xxxx.", ".xxxxxx", ".xxxxx.", ".x.x.x.", ".x...x."],
    'archer': ["..x..", ".xxx.", "..x.x", "xxxxx", "..x.x", ".x.x.", "x...x"],
    'aibar': ["..xx..", ".xxxx.", "..xx..", ".xxxxx", "x.xx.x", "..xx..", ".x..x.", ".x..x."],
}
def pgstone(v):
    """Petroglyph boulder (pecked figures). v=2 shows a figure with a scarf - the 'chronicler'."""
    w, h = 34, 26
    img = new(w, h); p = Px(img)
    p.poly([(2, h - 3), (4, 8), (12, 2), (26, 3), (32, 10), (31, h - 3)], None,
           shade=lambda x, y: tone('bear', .55 - (x - 2) / 70 - y / 80 + (noise2(x // 2, y // 2, 4 + v) - .5) * .25, x, y))
    motifs = [['sun', 'bull'], ['archer', 'bull'], ['aibar', 'sun']][v]
    ox = 6
    for m in motifs:
        art = PG[m]
        for yy, row in enumerate(art):
            for xx, ch in enumerate(row):
                if ch == 'x': p.set(ox + xx, 6 + yy, c('sand', 4) if not (m == 'aibar') else c('gold', 4))
        if m == 'aibar': p.set(ox + 4, 9, c('scarf', 3)); p.set(ox + 5, 9, c('scarf', 3))
        ox += len(art[0]) + 6
    return outline(img), (w // 2, h - 3)

def cist():
    """Stone cist grave: rectangle of upright slabs."""
    w, h = 40, 24
    img = new(w, h); p = Px(img)
    p.rect(6, 7, 28, 11, c('dirt', 1))
    for x in range(4, 36, 5):
        for y0 in (5, 17):
            p.rect(x, y0 - 3, 4, 5, c('stone', 4)); p.hline(x, x + 3, y0 - 3, c('stone', 6))
    for y in range(6, 17, 4):
        for x0 in (3, 35):
            p.rect(x0, y - 2, 3, 4, c('stone', 3))
    p.ellipse(20, 12, 3, 2, c('ochre', 3))
    return outline(img), (20, 19)

def mausoleum():
    """Stone-walled mausoleum with a corridor entrance (Begazy-Dandybai type, artistic)."""
    w, h = 80, 60
    img = new(w, h); p = Px(img)
    def wall(x0, y0, x1, y1):
        for y in range(y0, y1):
            for x in range(x0, x1):
                course = (y // 4) % 2
                v = .62 - (y - y0) / 120 + (.08 if ((x + course * 3) % 7) else -.2) + (noise2(x, y, 3) - .5) * .12
                p.set(x, y, tone('warmstone', v, x, y))
    wall(8, 14, 72, 52)
    p.poly([(4, 16), (40, 2), (76, 16)], None, shade=lambda x, y: tone('stone', .55 - (x - 40) / 120 - y / 80, x, y))
    for x in range(10, 72, 6): p.vline(x, 18, 50, c('warmstone', 1))
    p.rect(34, 34, 12, 18, c('ink', 0)); p.rect(32, 32, 16, 3, c('stone', 5))
    for x in (30, 48): p.rect(x, 32, 3, 20, c('stone', 4))
    return outline(img), (40, 52)

def kurgan():
    w, h = 72, 30
    img = new(w, h); p = Px(img)
    p.ellipse(36, 18, 33, 12, None, shade=lambda nx, ny: tone('steppe', .55 - ny * .35 - nx * .2 + (noise2(int(nx * 20), int(ny * 20), 6) - .5) * .2, 0, 0))
    for k in range(18):
        a = k / 18 * math.pi * 2
        p.ellipse(36 + math.cos(a) * 33, 18 + math.sin(a) * 11, 2.2, 1.6, c('stone', 4))
    return outline(img), (36, 26)

def torch(frame):
    img = new(10, 30); p = Px(img)
    p.vline(5, 10, 28, c('wood', 3)); p.vline(4, 12, 28, c('wood', 1))
    fl = [0, 1, 2, 1][frame]
    p.ellipse(5, 7 - fl * .3, 3, 4 + fl * .3, None, shade=lambda nx, ny: tone('fire', .9 - ny * .4 - abs(nx) * .4, 0, 0))
    p.set(5, 2 - fl, c('fire', 5))
    return img, (5, 28)

def beam():
    img = new(16, 40); p = Px(img)
    p.rect(5, 2, 6, 37, c('wood', 2)); p.vline(6, 2, 38, c('wood', 4))
    p.rect(1, 2, 14, 4, c('wood', 3)); p.hline(1, 14, 2, c('wood', 5))
    return outline(img), (8, 38)

def mural(v):
    """Underground wall paintings (fiction): 0 Time Gate, 1 ten epoch signs, 2 page of the Shezhire, 3 the chronicler."""
    w, h = 54, 34
    img = new(w, h); p = Px(img)
    p.rect(1, 1, w - 2, h - 2, None) if False else None
    for y in range(1, h - 1):
        for x in range(1, w - 1):
            p.set(x, y, tone('bear', .45 + (noise2(x // 2, y // 2, 11 + v) - .5) * .25 - y / 120, x, y))
    ink = c('ochre', 3); gold = c('gold', 4); cyan = c('cyan', 3)
    if v == 0:
        for a in range(0, 360, 6):
            r = math.radians(a); p.set(27 + math.cos(r) * 12, 17 + math.sin(r) * 12, gold); p.set(27 + math.cos(r) * 9, 17 + math.sin(r) * 9, cyan)
        p.ellipse(27, 17, 5, 5, c('cyan', 2, 160))
    elif v == 1:
        signs = ["x.x", ".x.", "xxx", "x..", "xx.", ".xx", "x.x", "..x", "xxx", ".x."]
        for i in range(10):
            ox, oy = 5 + (i % 5) * 10, 7 + (i // 5) * 13
            p.ellipse(ox + 2, oy + 2, 4, 4, c('bear', 1))
            for k, ch in enumerate(signs[i]):
                if ch == 'x': p.set(ox + k, oy + 2, gold); p.set(ox + 1, oy + k, gold)
    elif v == 2:
        p.poly([(18, 6), (36, 5), (37, 28), (19, 29)], c('sand', 4))
        for y in range(9, 27, 3): p.hline(21, 34, y, ink)
        p.ellipse(28, 17, 3, 3, c('cyan', 3, 140))
    else:
        art = PG['aibar']
        for yy, row in enumerate(art):
            for xx, ch in enumerate(row):
                if ch == 'x': p.rect(20 + xx * 2, 6 + yy * 2, 2, 2, gold)
        p.rect(24, 12, 6, 2, c('scarf', 3))
        for k in range(8): p.set(36 + k, 10 + k % 3, cyan)
    p.rect(0, 0, w, 1, c('ink', 1)); p.rect(0, h - 1, w, 1, c('ink', 1))
    return outline(img), (w // 2, h - 2)

def ember(frame):
    img = new(14, 8); p = Px(img)
    for k in range(5):
        x = 2 + k * 2.4; y = 4 + math.sin(k + frame) * 1.5
        p.set(x, y, c('fire', 2 + (k + frame) % 3, 230)); p.set(x + 1, y, c('fire', 1, 180))
    return img, (7, 6)

def pillar(v):
    img = new(18, 40); p = Px(img)
    p.rect(4, 4, 10, 34, None) if False else None
    for y in range(4, 38):
        for x in range(4, 14):
            p.set(x, y, tone('stone', .5 - (x - 4) / 30 + (noise2(x, y, 3) - .5) * .15, x, y))
    p.rect(2, 2, 14, 4, c('stone', 4)); p.rect(2, 36, 14, 3, c('stone', 2))
    if v == 1:  # the Institute emblem: a stylised open book with a ring (fiction)
        p.ellipse(9, 18, 4, 4, c('cyan', 3, 220)); p.ellipse(9, 18, 2, 2, c('stone', 2))
        p.line(5, 24, 9, 22, c('cyan', 3)); p.line(13, 24, 9, 22, c('cyan', 3)); p.hline(5, 13, 25, c('cyan', 2))
    return outline(img), (9, 38)

def tablet(frame):
    img = new(18, 24); p = Px(img)
    p.rect(3, 14, 12, 8, c('stone', 3)); p.hline(3, 14, 14, c('stone', 5))
    p.poly([(4, 3), (14, 2), (15, 13), (4, 14)], None, shade=lambda x, y: tone('gold', .75 - (x - 4) / 30 - y / 40, x, y))
    for y in (5, 8, 11): p.hline(6, 12, y, c('gold', 1))
    p.set(8, 4, c('scarf', 3))
    if frame: p.set(13, 3, c('gold', 5)); p.set(12, 2, c('gold', 5))
    return outline(img), (9, 22)

def trapdoor(open_):
    img = new(24, 16); p = Px(img)
    if open_:
        p.rect(3, 3, 18, 11, c('ink', 0))
        for y in range(5, 13, 3): p.hline(6, 18, y, c('wood', 1))
        p.rect(3, 1, 18, 2, c('wood', 3))
    else:
        p.rect(3, 3, 18, 11, c('wood', 3))
        for x in range(3, 21, 4): p.vline(x, 3, 13, c('wood', 1))
        p.ellipse(16, 8, 2, 2, c('gold', 3))
    return outline(img), (12, 13)

def stairs():
    img = new(24, 20); p = Px(img)
    for k in range(5): p.rect(3 + k, 3 + k * 3, 18 - k * 2, 3, tone('stone', .6 - k * .1, 0, 0))
    return outline(img), (12, 18)

def ashpile():
    img = new(20, 10); p = Px(img)
    p.ellipse(10, 6, 9, 3, None, shade=lambda nx, ny: tone('grey', .45 - ny * .3 + (noise2(int(nx * 9), int(ny * 9), 2) - .5) * .3, 0, 0))
    p.set(7, 5, c('fire', 2)); p.set(12, 6, c('fire', 1))
    return img, (10, 7)

def symbol():
    """Strange spiral-and-eye sign scratched on the ground (Zulmat's trace, fiction)."""
    img = new(20, 14); p = Px(img)
    for k in range(40):
        a = k / 6; r = k / 5
        p.set(10 + math.cos(a) * r, 7 + math.sin(a) * r * .6, c('purple', 4, 220))
    p.ellipse(10, 7, 2, 1, c('purple', 6))
    return img, (10, 7)

def altar():
    img = new(30, 20); p = Px(img)
    p.rect(3, 6, 24, 11, None, ) if False else None
    p.poly([(3, 8), (27, 8), (25, 17), (5, 17)], None, shade=lambda x, y: tone('warmstone', .6 - (y - 8) / 25, x, y))
    p.hline(3, 27, 8, c('warmstone', 5))
    p.ellipse(15, 7, 6, 2, c('ochre', 2)); p.set(12, 6, c('gold', 4)); p.set(18, 6, c('gold', 4))
    return outline(img), (15, 17)

def deadtree(v):
    w, h = 30, 46
    img = new(w, h); p = Px(img)
    cx = w // 2
    p.rect(cx - 2, 16, 4, h - 18, c('bark', 1)); p.vline(cx - 1, 16, h - 3, c('bark', 2))
    for (dx, dy, l) in ((-8, -10, 1), (9, -12, 1), (-5, -18, 0), (6, -6, 0)):
        p.line(cx, 24 + dy // 2, cx + dx, 24 + dy, c('bark', 1 + l))
    if v: p.line(cx, 20, cx - 11, 8, c('bark', 1))
    return outline(img), (cx, h - 3)

def brazier():
    img = new(16, 22); p = Px(img)
    p.line(4, 21, 8, 12, c('gold', 2)); p.line(12, 21, 8, 12, c('gold', 2))
    p.poly([(2, 10), (14, 10), (12, 14), (4, 14)], c('gold', 3)); p.hline(2, 14, 10, c('gold', 5))
    return outline(img), (8, 20)

def sheaf():
    img = new(14, 20); p = Px(img)
    for k in range(-4, 5):
        p.line(7, 18, 7 + k, 4, c('steppe', 4 if k % 2 else 3)); p.set(7 + k, 3, c('steppe', 5))
    p.hline(4, 10, 12, c('wood', 3))
    return outline(img), (7, 18)

# ---------------------------------------------------------------- FX + icons
def firebolt(f):
    img = new(12, 12); p = Px(img)
    p.ellipse(6, 6, 4 - f * .5, 3, None, shade=lambda nx, ny: tone('fire', .95 - (nx * nx + ny * ny) * .6, 0, 0))
    p.set(2, 6 + f, c('fire', 3, 160)); p.set(1, 5, c('fire', 2, 120))
    return img, (6, 6)

def icon(kind):
    img = new(16, 16); p = Px(img)
    if kind == 'tablet':
        p.poly([(3, 3), (13, 2), (14, 13), (3, 14)], None, shade=lambda x, y: tone('gold', .8 - x / 40 - y / 40, x, y))
        for y in (5, 8, 11): p.hline(5, 12, y, c('gold', 1))
    elif kind == 'ember':
        p.ellipse(8, 9, 5, 4, None, shade=lambda nx, ny: tone('fire', .95 - (nx * nx + ny * ny) * .5, 0, 0)); p.set(8, 4, c('fire', 5))
    elif kind == 'mould':
        p.rect(2, 4, 12, 9, c('warmstone', 3)); p.poly([(4, 7), (12, 6), (12, 10), (5, 10)], c('warmstone', 1))
    elif kind == 'seal':
        p.ellipse(8, 7, 5, 5, c('cyan', 3)); p.ellipse(8, 7, 3, 3, c('stone', 2)); p.hline(3, 13, 13, c('cyan', 2))
    elif kind == 'bracelet':
        for k in range(16):
            a = k / 16 * math.pi * 2; p.set(8 + math.cos(a) * 5, 8 + math.sin(a) * 4, c('gold', 4 if k % 3 else 5))
        p.set(3, 8, CLEAR); p.set(4, 9, CLEAR)
    return outline(img), (8, 15)
