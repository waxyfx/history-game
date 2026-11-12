"""Terrain tiles, autotile fringes and world props for MAP01 (Stone Age steppe)."""
import math, random
from .core import *

T = 16
# Terrain ids must match src/rpg/world.hpp (generated enum mirrors this list).
TERRAINS = ['grass', 'steppe', 'dirt', 'sand', 'water', 'shallow', 'rock', 'cave', 'cavewall', 'camp']
# Blend priority: higher priority terrain bleeds over lower neighbours.
PRIORITY = {'water': 0, 'shallow': 1, 'cave': 1, 'sand': 2, 'dirt': 3, 'camp': 3, 'steppe': 4, 'grass': 5}

def pnoise(x, y, period, cells, seed):
    """Periodic value noise: tiles seamlessly every `period` pixels."""
    s = period / cells
    fx, fy = x / s, y / s
    x0, y0 = math.floor(fx), math.floor(fy)
    tx, ty = fx - x0, fy - y0
    tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty)
    def n(a, b): return noise2(a % cells, b % cells, seed)
    return (n(x0, y0) * (1 - tx) + n(x0 + 1, y0) * tx) * (1 - ty) + (n(x0, y0 + 1) * (1 - tx) + n(x0 + 1, y0 + 1) * tx) * ty

def texture(kind, variant, frame=0):
    img = new(T, T); p = Px(img)
    rnd = random.Random(hash((kind, variant)) & 0xffff)
    for y in range(T):
        for x in range(T):
            n1 = pnoise(x, y, 16, 4, 11 + variant * 3)
            n2 = pnoise(x, y, 16, 8, 23 + variant * 5)
            if kind == 'grass':
                v = .4 + n1 * .3 + (n2 - .5) * .14
                p.set(x, y, tone('grass', v * .6 + .2, x, y))
            elif kind == 'steppe':
                v = .35 + n1 * .35 + (n2 - .5) * .16
                p.set(x, y, tone('steppe', v * .62 + .12, x, y))
            elif kind == 'dirt':
                v = .35 + n1 * .3 + (n2 - .5) * .3
                p.set(x, y, tone('dirt', v * .7 + .12, x, y))
            elif kind == 'camp':
                v = .4 + n1 * .25 + (n2 - .5) * .2
                p.set(x, y, tone('warmstone', v * .6 + .25, x, y))
            elif kind == 'sand':
                v = .45 + n1 * .3 + (n2 - .5) * .2
                p.set(x, y, tone('sand', v * .75 + .12, x, y))
            elif kind in ('water', 'shallow'):
                t = frame / 4
                w1 = pnoise(x + frame * 4, y + frame * 2, 16, 4, 31 + variant)
                w2 = pnoise(x - frame * 4, y + frame * 4, 16, 4, 47 + variant)
                v = (w1 + w2) * .5
                if kind == 'water':
                    p.set(x, y, tone('water', .16 + v * .38, x, y))
                else:
                    p.set(x, y, tone('water', .42 + v * .3, x, y))
                if abs(w1 - w2) < .012:
                    p.set(x, y, c('water', 5 if kind == 'water' else 6))
            elif kind == 'rock':
                v = .35 + n1 * .35 + (n2 - .5) * .25
                p.set(x, y, tone('warmstone', v * .7 + .2, x, y))
            elif kind == 'cave':
                v = .25 + n1 * .3 + (n2 - .5) * .25
                p.set(x, y, tone('stone', v * .55 + .05, x, y))
            elif kind == 'cavewall':
                v = .2 + n1 * .3
                p.set(x, y, tone('purple', v * .35 + .02, x, y))
    # Decorative details per terrain.
    if kind in ('grass', 'steppe'):
        ramp = 'grass' if kind == 'grass' else 'steppe'
        for _ in range(5 + variant):
            x, y = rnd.randrange(1, 15), rnd.randrange(3, 15)
            p.set(x, y, c(ramp, 4)); p.set(x, y - 1, c(ramp, 5 if kind == 'steppe' else 4))
            p.set(x + 1, y, c(ramp, 1))
        if variant == 3 and kind == 'grass':
            for fx, fy, col in ((4, 5, c('flower', 3)), (11, 10, c('grey', 5))):
                p.set(fx, fy, col); p.set(fx + 1, fy, c('flower', 4))
        if variant == 2 and kind == 'steppe':
            for fx, fy in ((5, 4), (10, 11)):
                p.set(fx, fy, c('steppe', 5)); p.set(fx, fy + 1, c('steppe', 2))
    elif kind in ('dirt', 'camp'):
        for _ in range(3 + variant):
            x, y = rnd.randrange(1, 15), rnd.randrange(1, 15)
            p.set(x, y, c('stone', 4)); p.set(x + 1, y, c('stone', 5)); p.set(x, y + 1, c('dirt', 0))
        if variant == 1:
            for x in range(3, 12):
                p.set(x, 7 + (x // 4) % 2, c('dirt', 1))
    elif kind == 'sand':
        for _ in range(4):
            x, y = rnd.randrange(1, 15), rnd.randrange(1, 15)
            p.set(x, y, c('sand', 0)); p.set(x + 1, y, c('sand', 4))
    elif kind == 'rock':
        for _ in range(2):
            x, y = rnd.randrange(2, 12), rnd.randrange(2, 12)
            for i in range(rnd.randrange(3, 6)):
                p.set(x + i, y + (i // 2), c('warmstone', 1))
                p.set(x + i, y + (i // 2) + 1, c('warmstone', 4))
        if variant >= 2:
            p.set(5, 9, c('grass', 3)); p.set(6, 8, c('grass', 4)); p.set(4, 8, c('grass', 3))
    elif kind == 'cave':
        for _ in range(3):
            x, y = rnd.randrange(1, 15), rnd.randrange(1, 15)
            p.set(x, y, c('stone', 0)); p.set(x + 1, y - 1, c('stone', 4))
    return img

def fringe(kind, mask_dir, over_water=False, seed=0):
    """Ragged band of `kind` texture entering a lower-priority tile from one edge/corner.
    mask_dir: 'n','e','s','w','ne','se','sw','nw'."""
    base = texture(kind, 0)
    bp = base.load()
    img = new(T, T); p = Px(img)
    depth = 5 if kind not in ('dirt', 'camp') else 4
    for y in range(T):
        for x in range(T):
            jag = (pnoise(x, y, 16, 8, 91 + seed) - .5) * 4 + (noise2(x, y, 7 + seed) - .5) * 1.5
            if mask_dir in ('n', 's', 'e', 'w'):
                d = {'n': y, 's': T - 1 - y, 'w': x, 'e': T - 1 - x}[mask_dir]
            else:
                cx = 0 if 'w' in mask_dir else T - 1
                cy = 0 if 'n' in mask_dir else T - 1
                d = math.hypot(x - cx, y - cy) - 1
            if d < depth + jag:
                col = bp[x, y]
                if d > depth + jag - 1.2:
                    # Lip of the bleeding terrain: darker rim reads as a slight height step.
                    col = (int(col[0] * .72), int(col[1] * .74), int(col[2] * .78), 255)
                p.set(x, y, col)
            elif over_water and d < depth + jag + 1.6:
                p.set(x, y, c('water', 6, 210) if (x + y) % 3 else c('water', 5, 200))
            elif over_water and d < depth + jag + 3 and noise2(x, y, 3) > .55:
                p.set(x, y, c('water', 5, 120))
    if kind in ('grass', 'steppe'):
        ramp = 'grass' if kind == 'grass' else 'steppe'
        # Grass blades overhanging the edge.
        for i in range(0, T, 3):
            for (x, y) in ([(i + 1, depth)] if mask_dir == 'n' else [(i + 1, T - 1 - depth)] if mask_dir == 's' else
                           [(depth, i + 1)] if mask_dir == 'w' else [(T - 1 - depth, i + 1)] if mask_dir == 'e' else []):
                if noise2(x, y, 5) > .4:
                    p.set(x, y, c(ramp, 3))
    return img

def rock_face(variant, cave=False):
    img = new(T, T); p = Px(img)
    ramp = 'stone' if cave else 'warmstone'
    for y in range(T):
        for x in range(T):
            strata = math.sin((y + pnoise(x, 0, 16, 4, 5 + variant) * 5) * 1.3)
            v = .45 - y / 30 + strata * .12 + (pnoise(x, y, 16, 8, 9 + variant) - .5) * .3
            p.set(x, y, tone(ramp, v * (.7 if cave else .9) + (.05 if cave else .1), x, y))
    for x in range(T):
        p.set(x, 0, c(ramp, 5)); p.set(x, 1, c(ramp, 4 if (x + variant) % 5 else 5))
        p.set(x, T - 1, c(ramp, 0)); p.set(x, T - 2, c(ramp, 1))
    rnd = random.Random(variant * 13 + cave)
    for _ in range(2):
        x = rnd.randrange(2, 14)
        for y in range(3, rnd.randrange(8, 14)):
            p.set(x + (y // 5), y, c(ramp, 0))
    if not cave and variant == 1:
        for x, y in ((3, 4), (4, 4), (4, 3), (12, 6)):
            p.set(x, y, c('grass', 3))
    if cave and variant == 2:
        for y in range(4, 10):
            p.set(9, y, c('water', 4, 160))
    return img

# ---------------------------------------------------------------- props
def shadow(w, h, alpha=90):
    img = new(w, h); p = Px(img)
    p.ellipse(w / 2, h / 2, w / 2 - .5, h / 2 - .5, None,
              shade=lambda nx, ny: (10, 22, 24, int(alpha * (1 - (nx * nx + ny * ny)) ** .5 + 20)))
    return img

def tree_poplar(variant=0):
    w, h = 44, 70
    img = new(w, h); p = Px(img)
    cx = w // 2
    # Trunk with bark texture.
    for y in range(40, h - 2):
        half = 3 if y < h - 6 else 4 + (y - (h - 6)) // 2
        for x in range(cx - half, cx + half):
            v = .25 + (x - (cx - half)) / (2 * half) * .5
            p.set(x, y, tone('wood', v, x, y))
    p.line(cx, 46, cx - 9, 34, c('wood', 2)); p.line(cx + 1, 44, cx + 10, 31, c('wood', 2))
    rnd = random.Random(31 + variant)
    blobs = [(cx, 26, 15, 18), (cx - 9, 34, 9, 9), (cx + 9, 33, 10, 9), (cx - 2, 12, 11, 11), (cx + 4, 20, 10, 12)]
    for bx, by, rx, ry in blobs:
        p.ellipse(bx, by, rx, ry, None, shade=lambda nx, ny, bx=bx, by=by: tone('leaf', .62 - ny * .3 - nx * .22 + (noise2(int(nx * 40 + bx), int(ny * 40 + by), variant) - .5) * .35, int(nx * 20 + bx), int(ny * 20 + by)))
    # Leaf clusters for texture.
    for _ in range(70):
        x = rnd.randrange(cx - 18, cx + 18); y = rnd.randrange(4, 44)
        if img.getpixel((x, y))[3]:
            light = .75 - (y / 44) * .45 - (x - cx) / 60
            p.set(x, y, tone('leaf', light + .12, x, y)); p.set(x + 1, y + 1, tone('leaf', light - .25, x, y))
    for _ in range(8):
        x = rnd.randrange(cx - 10, cx + 4); y = rnd.randrange(6, 26)
        if img.getpixel((x, y))[3]:
            p.set(x, y, c('leaf', 6))
    return outline(img), (cx, h - 3)

def tree_birch(variant=0):
    w, h = 34, 60
    img = new(w, h); p = Px(img)
    cx = w // 2
    for y in range(26, h - 2):
        for x in range(cx - 2, cx + 2):
            p.set(x, y, c('bark', 4 if x < cx + 1 else 3))
        if y % 5 == variant % 3:
            p.set(cx - 1 + (y // 5) % 2, y, c('bark', 0)); p.set(cx + (y // 5) % 2, y, c('bark', 1))
    p.line(cx, 34, cx - 6, 24, c('bark', 3))
    rnd = random.Random(7 + variant)
    for bx, by, rx, ry in [(cx, 20, 12, 15), (cx - 6, 28, 8, 7), (cx + 6, 26, 8, 8), (cx + 1, 9, 8, 8)]:
        p.ellipse(bx, by, rx, ry, None, shade=lambda nx, ny, bx=bx, by=by: tone('green2' if variant % 2 else 'leaf', .7 - ny * .3 - nx * .2 + (noise2(int(nx * 30 + bx), int(ny * 30 + by), 3) - .5) * .4, int(nx * 9 + bx), int(ny * 9 + by)))
    for _ in range(50):
        x = rnd.randrange(cx - 13, cx + 13); y = rnd.randrange(3, 36)
        if img.getpixel((x, y))[3]:
            p.set(x, y, c('leaf', 5 if y < 18 else 3))
    return outline(img), (cx, h - 3)

def tree_willow():
    w, h = 50, 50
    img = new(w, h); p = Px(img)
    cx = w // 2
    for y in range(28, h - 2):
        for x in range(cx - 3, cx + 3):
            p.set(x, y, tone('wood', .3 + (x - cx + 3) / 12, x, y))
    p.ellipse(cx, 20, 21, 15, None, shade=lambda nx, ny: tone('green2', .65 - ny * .35 - nx * .2, int(nx * 21 + cx), int(ny * 15 + 20)))
    # Drooping strands.
    for i in range(-19, 20, 3):
        length = 10 + int(noise2(i, 0, 4) * 10)
        for j in range(length):
            p.set(cx + i + (j // 6), 24 + j, c('green2', 3 if j < length - 2 else 4))
    return outline(img), (cx, h - 3)

def bush(variant):
    w, h = 22, 18
    img = new(w, h); p = Px(img)
    for bx, by, rx, ry in [(11, 10, 9, 7), (6, 12, 5, 5), (16, 12, 5, 5)]:
        p.ellipse(bx, by, rx, ry, None, shade=lambda nx, ny, bx=bx, by=by: tone('leaf', .66 - ny * .35 - nx * .15 + (noise2(int(nx * 9 + bx), int(ny * 9 + by), variant) - .5) * .35, int(nx * 9 + bx), int(ny * 9 + by)))
    if variant == 1:
        for x, y in ((7, 8), (13, 6), (15, 11), (9, 12), (11, 9)):
            p.set(x, y, c('red', 3)); p.set(x, y - 1, c('red', 5))
    if variant == 2:
        for x, y in ((6, 7), (14, 8), (10, 5)):
            p.set(x, y, c('flower', 4))
    return outline(img), (11, 16)

def tallgrass(frame, steppe=False):
    w, h = 16, 18
    img = new(w, h); p = Px(img)
    ramp = 'steppe' if steppe else 'grass'
    sway = [0, 1, 2, 1][frame]
    for i, bx in enumerate((2, 4, 6, 8, 10, 12, 13, 5, 9)):
        hh = 9 + (i * 5) % 7
        for j in range(hh):
            t = j / hh
            x = bx + round(sway * t * t * (1.5 if i % 2 else 1))
            p.set(x, 16 - j, c(ramp, 2 + int(t * 3) if i % 3 else 1 + int(t * 3)))
        if steppe and i % 3 == 0:  # Feather-grass (ковыль) plumes.
            p.set(bx + sway, 16 - hh, c('steppe', 5)); p.set(bx + sway + 1, 16 - hh + 1, c('grey', 5))
    return img, (8, 16)

def reeds(frame):
    w, h = 16, 22
    img = new(w, h); p = Px(img)
    sway = [0, 1, 1, 0][frame]
    for i, bx in enumerate((3, 6, 8, 11, 13)):
        hh = 14 + (i * 3) % 5
        for j in range(hh):
            t = j / hh
            p.set(bx + round(sway * t * t * 2), 20 - j, c('green2', 2 + int(t * 2)))
        if i % 2 == 0:
            for k in range(3):
                p.set(bx + sway * 2, 20 - hh + k, c('wood', 2))
    return img, (8, 20)

def tulips(variant):
    img = new(10, 8); p = Px(img)
    cols = [('flower', 1, 2), ('flower', 3, 4), ('red', 4, 5)][variant]
    for x, y in ((2, 3), (6, 2), (8, 5)):
        p.vline(x, y + 1, 7, c('grass', 3))
        p.set(x, y, c(cols[0], cols[1])); p.set(x + 1, y, c(cols[0], cols[2])); p.set(x, y - 1, c(cols[0], cols[2]))
    return img, (5, 7)

def rock(size, variant=0, cave=False):
    dims = {0: (12, 10), 1: (20, 16), 2: (32, 26), 3: (50, 40)}[size]
    w, h = dims
    img = new(w, h); p = Px(img)
    ramp = 'stone' if cave else ('warmstone' if variant % 2 else 'stone')
    rnd = random.Random(size * 7 + variant)
    pts = []
    n = 9
    for i in range(n):
        a = math.pi * 2 * i / n
        rr = .82 + rnd.random() * .18
        pts.append((w / 2 + math.cos(a) * (w / 2 - 1) * rr, h * .58 + math.sin(a) * (h * .42 - 1) * rr))
    def sh(x, y):
        nx = (x - w / 2) / (w / 2); ny = (y - h * .5) / (h * .5)
        facet = noise2(int(x / 4), int(y / 4), variant) * .2
        return tone(ramp, .62 - nx * .25 - ny * .35 + facet, x, y)
    p.poly(pts, None, shade=sh)
    for _ in range(size + 1):
        x = rnd.randrange(3, w - 3); y = rnd.randrange(h // 3, h - 3)
        p.line(x, y, x + rnd.randrange(-4, 5), y + rnd.randrange(2, 5), c(ramp, 1))
    if size >= 2 and not cave:
        for x in range(w // 3, w // 3 + 5):  # Moss cap
            p.set(x, int(h * .2) + (x % 2), c('grass', 3)); p.set(x + 1, int(h * .2) + 1, c('grass', 2))
    if size == 3:
        for x in range(8, w - 8, 6):
            p.vline(x + rnd.randrange(3), h // 2, h - 4, c(ramp, 1))
    return outline(img), (w // 2, h - 3)

def log():
    img = new(30, 12); p = Px(img)
    for x in range(2, 26):
        for y in range(3, 10):
            p.set(x, y, tone('wood', .65 - abs(y - 5) * .12, x, y))
    p.ellipse(26, 6, 3, 4, None, shade=lambda nx, ny: c('wood', 5) if nx * nx + ny * ny < .4 else c('wood', 3))
    p.set(26, 6, c('wood', 2))
    for x in range(4, 24, 5):
        p.set(x, 5, c('wood', 1)); p.set(x + 1, 5, c('wood', 1))
    p.set(10, 2, c('grass', 3)); p.set(11, 2, c('grass', 4))
    return outline(img), (15, 10)

def bones(kind):
    if kind == 'tusk':
        img = new(28, 14); p = Px(img)
        for i in range(22):
            y = 10 - int(math.sin(i / 22 * math.pi) * 6)
            p.set(3 + i, y, c('bark', 5)); p.set(3 + i, y + 1, c('bark', 4)); p.set(3 + i, y + 2, c('bark', 3))
        return outline(img), (14, 12)
    if kind == 'skull':
        img = new(14, 10); p = Px(img)
        p.ellipse(7, 5, 5, 4, c('bark', 4))
        p.set(5, 5, c('ink', 1)); p.set(9, 5, c('ink', 1)); p.hline(5, 9, 8, c('bark', 3))
        p.line(2, 2, 0, 0, c('bark', 4)); p.line(12, 2, 13, 0, c('bark', 4))
        return outline(img), (7, 8)
    img = new(18, 10); p = Px(img)  # scattered ribs/antler
    for i in range(4):
        p.line(3 + i * 4, 8, 5 + i * 4, 2, c('bark', 4))
    p.hline(2, 16, 8, c('bark', 3))
    return outline(img), (9, 8)

def footprint(kind):
    img = new(10, 10); p = Px(img)
    col = c('dirt', 0, 170)
    if kind == 'paw':
        p.ellipse(5, 6, 2, 2, col)
        for x, y in ((2, 3), (4, 2), (6, 2), (8, 3)):
            p.set(x, y, col)
        p.set(5, 9, c('dirt', 0, 90))
    elif kind == 'hoof':
        p.rect(3, 3, 2, 4, col); p.rect(6, 3, 2, 4, col)
    elif kind == 'human':
        p.ellipse(5, 6, 2, 3, col); p.set(4, 2, col); p.set(6, 2, col)
    elif kind == 'drag':
        for x in range(10):
            p.set(x, 4 + (x // 3) % 2, col); p.set(x, 7, c('dirt', 0, 110))
    return img, (5, 5)

def scar():
    """Scorched landing ring where the time tunnel dropped Aibar."""
    w, h = 56, 34
    img = new(w, h); p = Px(img)
    for y in range(h):
        for x in range(w):
            nx = (x - w / 2) / (w / 2); ny = (y - h / 2) / (h / 2)
            d = nx * nx + ny * ny
            if d < 1:
                jag = noise2(x, y, 9) * .25
                if d < .55 + jag:
                    p.set(x, y, tone('dirt', .15 + d * .3 + jag * .4, x, y))
                elif d < .8 + jag:
                    p.set(x, y, c('ink', 2, 140))
    for i in range(16):
        a = i / 16 * math.pi * 2
        x = w / 2 + math.cos(a) * w * .36; y = h / 2 + math.sin(a) * h * .36
        p.set(x, y, c('cyan', 3, 200)); p.set(x + 1, y, c('cyan', 2, 160))
    return img, (w // 2, h // 2)

def tent(variant=0):
    """Conical hide tent on a pole frame (palaeolithic dwelling, artistic reconstruction)."""
    w, h = 50, 56
    img = new(w, h); p = Px(img)
    cx, base, top = w // 2, h - 4, 6
    ramp = 'hide' if variant == 0 else 'fur'
    def sh(x, y):
        t = (y - top) / (base - top)
        half = 2 + t * 21
        nx = (x - cx) / max(1, half)
        seam = (int((x - cx) / max(1, half) * 4 + 4) % 2 == 0)
        v = .62 - nx * .35 - t * .12 + (.05 if seam else 0) + (noise2(x, y, 4) - .5) * .12
        return tone(ramp, v, x, y)
    p.poly([(cx - 2, top), (cx + 2, top), (cx + 23, base), (cx - 23, base)], None, shade=sh)
    # Stitched hide seams.
    for k in (-12, -4, 5, 13):
        p.line(cx + k * .15, top + 4, cx + k, base - 1, c(ramp, 1))
        for y in range(top + 6, base - 2, 4):
            t = (y - top) / (base - top)
            p.set(cx + k * t, y, c(ramp, 5))
    # Door flap.
    p.poly([(cx - 1, base - 22), (cx + 1, base - 22), (cx + 8, base), (cx - 8, base)], c('ink', 2))
    p.poly([(cx + 1, base - 22), (cx + 9, base), (cx + 4, base)], c(ramp, 2))
    # Poles crossing at the top.
    for dx in (-4, -1, 2, 5):
        p.line(cx, top + 2, cx + dx, 0, c('wood', 3))
    p.hline(cx - 22, cx + 22, base, c(ramp, 0))
    if variant == 1:  # Ochre painted band.
        for x in range(cx - 14, cx + 15):
            t = (x - cx) / 14
            yy = base - 14 + int(abs(t) * 2)
            if img.getpixel((x, yy))[3] and abs(x - cx) > 8:
                p.set(x, yy, c('ochre', 3)); p.set(x, yy + 1, c('ochre', 2))
    return outline(img), (cx, base)

def hut():
    """Dome hut of hides held down by mammoth bones (Upper Palaeolithic style)."""
    w, h = 60, 46
    img = new(w, h); p = Px(img)
    cx, cy = w // 2, 30
    p.ellipse(cx, cy, 27, 20, None, shade=lambda nx, ny: tone('hide', .6 - nx * .3 - ny * .3 + (noise2(int(nx * 20), int(ny * 20), 2) - .5) * .2, int(nx * 27 + cx), int(ny * 20 + cy)))
    for y in range(cy + 8, h):
        for x in range(w):
            if img.getpixel((x, min(h - 1, y)))[3] and y > cy + 12:
                p.set(x, y, CLEAR)
    # Bone arches and tusks.
    for i, a in enumerate((-2.4, -1.9, -1.4, -.9)):
        x0 = cx + math.cos(a) * 26; y0 = cy + math.sin(a) * 19
        p.line(x0, y0, cx + math.cos(a) * 20, cy + 12, c('bark', 4))
    for side in (-1, 1):
        for i in range(14):
            t = i / 14
            x = cx + side * (24 - t * 6); y = cy + 12 - math.sin(t * math.pi) * 6 - t * 4
            p.set(x, y, c('bark', 5)); p.set(x, y + 1, c('bark', 3))
    # Stacked jaw bones along the base.
    for x in range(cx - 25, cx + 26, 5):
        p.ellipse(x, cy + 12, 3, 2, c('bark', 4)); p.set(x - 1, cy + 12, c('bark', 2))
    p.ellipse(cx, cy + 6, 7, 6, c('ink', 1))
    for y in range(cy + 6, cy + 12):
        p.hline(cx - 7, cx + 7, y, c('ink', 1))
    p.rect(cx - 6, cy + 10, 12, 2, c('hide', 1))
    return outline(img), (cx, cy + 13)

def firepit():
    img = new(26, 16); p = Px(img)
    p.ellipse(13, 9, 10, 5, c('ink', 2))
    for i in range(10):
        a = i / 10 * math.pi * 2
        x = 13 + math.cos(a) * 10; y = 9 + math.sin(a) * 5
        p.ellipse(x, y, 2.4, 2, None, shade=lambda nx, ny: tone('stone', .7 - ny * .5 - nx * .2, 0, 0))
    p.line(8, 9, 18, 7, c('wood', 1)); p.line(9, 6, 17, 10, c('wood', 2))
    p.set(12, 8, c('fire', 1)); p.set(14, 9, c('fire', 2))
    return outline(img), (13, 11)

def flame(frame):
    w, h = 18, 22
    img = new(w, h); p = Px(img)
    rnd = random.Random(frame * 5 + 1)
    for y in range(h):
        t = y / h
        half = (math.sin(t * math.pi * .95) * 6.5) * (1 - t * .25)
        sway = math.sin(t * 6 + frame * 1.6) * 2 * (1 - t)
        for x in range(w):
            d = abs(x - w / 2 - sway) / max(.6, half)
            if d < 1:
                heat = (1 - d) * .8 + t * .45 + (rnd.random() - .5) * .25
                p.set(x, y, tone('fire', heat, x, y))
    for i in range(3):
        p.set(rnd.randrange(5, 13), rnd.randrange(0, 6), c('fire', 4))
    return img, (9, 20)

def rack():
    """Drying frame with stretched hides."""
    img = new(34, 30); p = Px(img)
    for x in (3, 30):
        p.vline(x, 3, 28, c('wood', 2)); p.vline(x + 1, 3, 28, c('wood', 4))
    p.hline(2, 31, 4, c('wood', 3)); p.hline(2, 31, 5, c('wood', 1))
    for i, x0 in enumerate((6, 18)):
        pts = [(x0, 6), (x0 + 10, 6), (x0 + 11, 20), (x0 + 5, 23), (x0 - 1, 20)]
        p.poly(pts, None, shade=lambda x, y, i=i: tone('hide', .7 - (y - 6) / 30 - i * .1, x, y))
        for y in range(8, 20, 3):
            p.set(x0 + 5, y, c('hide', 2))
    return outline(img), (17, 28)

def meatrack():
    img = new(28, 28); p = Px(img)
    p.line(3, 26, 14, 3, c('wood', 3)); p.line(25, 26, 14, 3, c('wood', 3))
    p.hline(5, 23, 9, c('wood', 2))
    for x in (8, 13, 18):
        p.vline(x, 10, 11, c('wood', 1))
        p.rect(x - 1, 12, 3, 7, c('red', 2)); p.vline(x, 12, 18, c('red', 3)); p.set(x - 1, 12, c('red', 4))
    return outline(img), (14, 26)

def toolpile():
    img = new(18, 10); p = Px(img)
    rnd = random.Random(4)
    for i in range(7):
        x, y = rnd.randrange(2, 15), rnd.randrange(3, 8)
        p.poly([(x, y), (x + 3, y - 1), (x + 4, y + 1), (x + 1, y + 2)], c('stone', 4 + i % 2))
        p.set(x + 1, y, c('stone', 6))
    p.rect(9, 5, 6, 3, c('stone', 3)); p.hline(9, 14, 5, c('stone', 5))
    return outline(img), (9, 8)

def storage():
    img = new(26, 16); p = Px(img)
    p.ellipse(13, 9, 11, 6, c('dirt', 0))
    p.ellipse(13, 8, 9, 5, None, shade=lambda nx, ny: tone('hide', .6 - ny * .3 - nx * .2, 0, 0))
    for i in range(8):
        a = i / 8 * math.pi * 2
        p.ellipse(13 + math.cos(a) * 10, 9 + math.sin(a) * 5, 2, 1.6, c('stone', 4))
    p.ellipse(13, 6, 3, 2, c('stone', 5))
    return outline(img), (13, 12)

def hidemat():
    img = new(26, 14); p = Px(img)
    p.poly([(2, 4), (8, 1), (19, 2), (24, 6), (21, 12), (6, 12), (1, 9)], None,
           shade=lambda x, y: tone('fur', .65 - y / 20 + (noise2(x, y, 3) - .5) * .25, x, y))
    return outline(img), (13, 8)

def spearrack():
    img = new(26, 30); p = Px(img)
    p.hline(2, 23, 20, c('wood', 2)); p.vline(3, 14, 28, c('wood', 3)); p.vline(22, 14, 28, c('wood', 3))
    for i, x in enumerate((7, 12, 17)):
        p.line(x, 28, x + 2, 2, c('wood', 4))
        p.poly([(x + 1, 4), (x + 3, 0), (x + 4, 5)], c('stone', 5))
    return outline(img), (13, 28)

def basket():
    img = new(14, 14); p = Px(img)
    p.poly([(2, 3), (12, 3), (11, 12), (3, 12)], None,
           shade=lambda x, y: c('sand', 2) if (x + y) % 3 else c('sand', 1))
    p.hline(2, 12, 3, c('sand', 4))
    for x in (5, 8):
        p.set(x, 2, c('red', 3)); p.set(x + 1, 2, c('flower', 3))
    return outline(img), (7, 12)

def windbreak():
    img = new(36, 22); p = Px(img)
    for i in range(9):
        x = 2 + i * 4
        hh = 14 + (i * 3) % 5
        p.vline(x, 20 - hh, 20, c('wood', 3)); p.vline(x + 1, 20 - hh, 20, c('wood', 1))
    p.hline(1, 35, 9, c('wood', 4)); p.hline(1, 35, 14, c('wood', 2))
    return outline(img), (18, 20)

def post(tied=False):
    img = new(16, 32); p = Px(img)
    p.rect(6, 4, 4, 26, c('wood', 2)); p.vline(7, 4, 29, c('wood', 4))
    for y in (12, 16):
        p.hline(5, 10, y, c('sand', 3))
    p.set(8, 3, c('wood', 1))
    return outline(img), (8, 29)

def totem():
    img = new(18, 44); p = Px(img)
    p.rect(7, 10, 4, 33, c('wood', 2)); p.vline(8, 10, 42, c('wood', 4))
    # Antlers crown.
    for side in (-1, 1):
        p.line(9, 10, 9 + side * 7, 2, c('bark', 4))
        p.line(9 + side * 4, 6, 9 + side * 7, 7, c('bark', 4))
        p.line(9 + side * 2, 8, 9 + side * 1, 3, c('bark', 4))
    p.ellipse(9, 12, 4, 3, c('bark', 4)); p.set(8, 12, c('ink', 1)); p.set(10, 12, c('ink', 1))
    for y in (20, 26, 32):
        p.hline(6, 11, y, c('ochre', 3))
    return outline(img), (9, 42)

def cave_mouth():
    w, h = 72, 58
    img = new(w, h); p = Px(img)
    pts = [(2, h - 2), (5, 26), (14, 10), (30, 2), (46, 3), (60, 12), (68, 28), (70, h - 2)]
    p.poly(pts, None, shade=lambda x, y: tone('warmstone', .6 - (x - w / 2) / 90 - y / 140 + (noise2(x // 3, y // 3, 4) - .5) * .25, x, y))
    for x in range(w):
        for y in range(h):
            nx = (x - w / 2) / 20; ny = (y - (h - 2)) / 30
            if nx * nx + ny * ny < 1 and y > 20:
                depth = 1 - (nx * nx + ny * ny)
                p.set(x, y, c('ink', 0) if depth > .35 else c('purple', 1))
    for x in range(8, w - 8, 7):
        p.line(x, 8 + (x * 3) % 7, x + 2, 22, c('warmstone', 1))
    for x, y in ((20, 24), (50, 22), (28, 14)):
        p.set(x, y, c('grass', 3)); p.set(x + 1, y - 1, c('grass', 4))
    return outline(img), (w // 2, h - 2)

def boulder_block():
    img, _ = rock(3, 3)
    return img, (img.width // 2, img.height - 3)

def pressure_stone(on):
    img = new(18, 12); p = Px(img)
    p.ellipse(9, 7, 8, 4, c('stone', 2))
    p.ellipse(9, 6 if not on else 7, 7, 3, None, shade=lambda nx, ny: tone('stone', .7 - ny * .4, 0, 0))
    col = c('cyan', 3) if on else c('ochre', 3)
    for x, y in ((6, 6), (9, 5), (12, 6)):
        p.set(x, y + (1 if on else 0), col)
    return outline(img), (9, 9)

def lever():
    img = new(24, 22); p = Px(img)
    p.ellipse(8, 17, 6, 3, c('stone', 3))
    p.line(6, 16, 20, 3, c('wood', 4)); p.line(7, 17, 21, 4, c('wood', 2))
    return outline(img), (9, 18)

def crack():
    img = new(18, 26); p = Px(img)
    p.poly([(8, 1), (11, 4), (13, 12), (11, 24), (6, 24), (5, 12)], c('ink', 0))
    p.line(8, 1, 6, 12, c('stone', 1)); p.line(11, 4, 12, 20, c('stone', 2))
    for x, y in ((4, 18), (14, 20), (5, 8)):  # Hanging roots hint at a passage.
        p.vline(x, y - 5, y, c('grass', 2))
    return img, (9, 24)

def stalagmite(v):
    img = new(14, 24); p = Px(img)
    hh = 20 - v * 4
    p.poly([(7, 22 - hh), (12, 22), (2, 22)], None, shade=lambda x, y: tone('stone', .75 - (x - 2) / 14 - (y / 40), x, y))
    p.set(7, 22 - hh + 1, c('stone', 6))
    return outline(img), (7, 22)

def crystal():
    img = new(12, 18); p = Px(img)
    for (x0, hh) in ((5, 14), (2, 8), (8, 10)):
        p.poly([(x0 + 1, 16 - hh), (x0 + 3, 16 - hh + 3), (x0 + 3, 16), (x0, 16), (x0, 16 - hh + 3)], None,
               shade=lambda x, y: tone('purple', .8 - (x % 3) * .15 - y / 40, x, y))
    return outline(img), (6, 16)

def page_fragment(frame):
    img = new(16, 18); p = Px(img)
    glow = [0, 1, 2, 1][frame]
    for r in range(7, 2, -1):
        p.ellipse(8, 9, r + glow * .5, r * .9, c('gold', 4, 18 + (7 - r) * 14))
    pts = [(4, 4), (11, 3), (12, 12), (5, 14)]
    p.poly(pts, None, shade=lambda x, y: tone('gold', .9 - (y - 3) / 25 - (x - 4) / 40, x, y))
    for y in (6, 8, 10):
        p.hline(6, 10, y + (1 if y > 7 else 0) * 0, c('ochre', 2))
    p.set(11, 3, c('gold', 5)); p.set(3 + glow, 1, c('gold', 5)); p.set(13, 10 - glow, c('gold', 5))
    return img, (8, 14)

PETRO = {
    # Motifs inspired by Central Asian rock art: archer, argali/ibex, sun-headed figure, hunters with dogs.
    'archer': ["....x....", "...xxx...", "....x..x.", "..xxxxx.x", "....x..x.", "...x.x...", "..x...x.."],
    'ibex':   ["x.......x", ".x.....x.", "..xxxxx..", ".xxxxxxx.", ".x.x.x.x.", ".x.x.x.x."],
    'sun':    ["x.x.x.x.x", ".xxxxxxx.", "xx.x.x.xx", ".xxxxxxx.", "x.x.x.x.x", "....x....", "...xxx...", "..x.x.x..", "....x....", "...x.x..."],
    'deer':   ["..x.x....", "...x.....", "...xxxxx.", "..xxxxxxx", "..x.x..x.", "..x.x..x."],
    'mark':   ["xxx...xxx", "x..x.x..x", "...xxx...", "..xx.xx..", ".x..x..x.", "x...x...x", "...xxx..."],
}

def petroglyph_panel(motifs, zulmat=False):
    w, h = 40, 30
    img = new(w, h); p = Px(img)
    p.poly([(1, 4), (10, 1), (32, 2), (39, 8), (38, 26), (24, 29), (4, 27)], None,
           shade=lambda x, y: tone('warmstone', .55 - y / 70 + (noise2(x // 2, y // 2, 8) - .5) * .25, x, y))
    ox = 5
    for m in motifs:
        art = PETRO[m]
        col = c('purple', 5) if (zulmat and m == 'mark') else c('ochre', 3)
        for yy, row in enumerate(art):
            for xx, ch in enumerate(row):
                if ch == 'x':
                    p.set(ox + xx, 6 + yy, col)
        ox += 11
    return outline(img), (w // 2, h - 2)

def gate(frame):
    """Chronicler time-gate ring (2087 tech) for the camp transition."""
    w, h = 56, 60
    img = new(w, h); p = Px(img)
    cx, cy = w // 2, 28
    for y in range(h):
        for x in range(w):
            nx = (x - cx) / 24; ny = (y - cy) / 26
            d = math.hypot(nx, ny)
            if .78 < d < 1:
                p.set(x, y, tone('stone', .7 - ny * .3, x, y))
            elif d <= .78:
                swirl = math.sin(math.atan2(ny, nx) * 3 + d * 8 - frame * 1.4)
                v = .55 + swirl * .25 - d * .3
                p.set(x, y, tone('cyan', v, x, y) if frame >= 0 else CLEAR)
    for a in range(0, 360, 45):
        r = math.radians(a)
        p.set(cx + math.cos(r) * 22, cy + math.sin(r) * 24, c('gold', 4))
    p.rect(cx - 16, h - 6, 32, 4, c('stone', 3)); p.hline(cx - 16, cx + 16, h - 6, c('stone', 5))
    return outline(img), (cx, h - 3)

def chrono_tent():
    w, h = 50, 40
    img = new(w, h); p = Px(img)
    p.poly([(4, h - 4), (25, 4), (46, h - 4)], None, shade=lambda x, y: tone('teal', .65 - (x - 25) / 50 - y / 120, x, y))
    p.poly([(20, h - 4), (25, 18), (30, h - 4)], c('ink', 1))
    p.hline(4, 46, h - 4, c('teal', 0))
    for x in range(10, 41, 2):
        y = int(h - 4 - (25 - abs(x - 25)) * 1.4) + 6
        if img.getpixel((x, min(h - 1, y)))[3]:
            p.set(x, y, c('gold', 3))
    return outline(img), (25, h - 4)

def holotable(frame):
    img = new(26, 26); p = Px(img)
    p.rect(4, 14, 18, 8, c('stone', 2)); p.hline(4, 21, 14, c('stone', 4))
    for i in range(5):
        y = 12 - i * 2 - (frame % 2)
        p.hline(8 + i, 17 - i, y, c('cyan', 3, 120 + i * 20))
    p.ellipse(13, 6 - frame % 2, 3, 2, c('gold', 4, 200))
    return outline(img), (13, 21)
