"""MAP03 «Сақтар әлемі»: Saka people (pointed felt hats), corrupted warriors, horses, the ghost snow
leopard of the kurgans, the boss «Алтын сауытты салт атты» and Saka props (felt tents, wagons,
bronze cauldrons and altars, animal-style standards, royal kurgans, a log tomb chamber)."""
import math
from .core import *
from . import chars as C
from . import chars2 as C2   # noqa: F401  (keeps the MAP02 frame wrappers in the chain)

# ---------------------------------------------------------------- people
C.STYLES.update({
    'sakachief': dict(skin='skin', hair='grey', hairstyle='crop', top='red', topkind='cloak', trim='gold', legs='hide', legshade=1,
                      boots='hide', beard='grey', necklace=True, peakhat='red', stoop=0),
    'sakaguard': dict(skin='skin2', hair='black', hairstyle='tail', top='grey', topkind='tunic', trim='gold', legs='hide', legshade=0,
                      boots='hide', beard='black', bracelets=True, peakhat='hide', pack='bowback'),
    'arna': dict(skin='skin2', hair='black', hairstyle='braid', top='scarf', topkind='tunic', trim='gold', legs='hide', legshade=1,
                 boots='hide', peakhat='red', pack='quiver'),
    'goldsmith': dict(skin='skin', hair='black', hairstyle='crop', top='hide', topkind='apron', trim='gold', legs='fur', legshade=1,
                      boots='hide', beard='black', bare_arms=True, bracelets=True, headband='gold'),
    'abyz': dict(skin='skin', hair='grey', hairstyle='messy', top='blue', topkind='cloak', trim='gold', legs='blue', legshade=1,
                 boots='hide', beard='grey', necklace=True, staff=True, stoop=2, peakhat='blue'),
    'sakaboy': dict(skin='skin', hair='black', hairstyle='messy', top='steppe', topkind='tunic', trim='red', legs='hide', legshade=0,
                    boots='fur', build='child', peakhat='hide'),
    'sakamother': dict(skin='skin2', hair='black', hairstyle='braid', top='red', topkind='dress', trim='gold', legs='red', legshade=1,
                       boots='hide', headband='gold', necklace=True),
    'sakawarrior': dict(skin='skin', hair='black', hairstyle='tail', top='hide', topkind='tunic', trim='red', legs='fur', legshade=0,
                        boots='hide', peakhat='fur', pack='bowback', bracelets=True),
    'sakacorrupt': dict(skin='skin', hair='black', hairstyle='tail', top='grey', topkind='tunic', trim='red', legs='fur', legshade=0,
                        boots='hide', peakhat='fur', corrupt=True),
    'steppearcher': dict(skin='skin2', hair='black', hairstyle='tail', top='steppe', topkind='tunic', trim='hide', legs='hide', legshade=0,
                         boots='fur', peakhat='steppe', pack='bowback', paint=True),
})
HAT_SHADE = {'red': 'red', 'hide': 'hide', 'blue': 'blue', 'fur': 'fur', 'steppe': 'steppe'}


def _hat(p, cx, base_y, half, height, ramp, tilt=0):
    """Pointed felt hat (үшкір бөрік): a cone, shaded left-to-right, with a darker brim."""
    for k in range(height + 1):
        y = base_y - k
        if y < 0: break
        w = half * (1 - k / (height + .5))
        x0, x1 = cx - w + tilt * k / height, cx + w + tilt * k / height
        for x in range(int(round(x0)), int(round(x1)) + 1):
            u = (x - x0) / max(1, x1 - x0)
            p.set(x, y, tone(ramp, .78 - u * .45 - k / (height * 3), x, y))
    p.hline(int(cx - half), int(cx + half), base_y, c(ramp, 1))
    p.set(cx + tilt, base_y - height, c('gold', 4))


_prev_human_frame = C.human_frame
def human_frame(style, view, anim, f):
    img = _prev_human_frame(style, view, anim, f)
    px = img.load()
    if style.get('corrupt'):   # touched by Zulmat: violet bleed, ember eyes; the person is still visible
        for y in range(32):
            for x in range(32):
                r, g, b, a = px[x, y]
                if a: px[x, y] = (int(r * .55 + 40), int(g * .45 + 18), int(b * .55 + 62), a)
    hat = style.get('peakhat')
    if hat:
        rows = [y for y in range(32) if any(px[x, y][3] for x in range(32))]
        top = rows[0] if rows else 99
        if top <= 6:   # standing (lying frames keep the bare head)
            xs = [x for y in range(top, top + 4) for x in range(32) if px[x, y][3]]
            cx = sum(xs) / len(xs)
            p = Px(img)
            child = style.get('build') == 'child'
            tilt = -1 if view in ('e', 'se', 'ne') else 0
            _hat(p, cx + (.5 if view in ('e', 'se', 'ne') else 0), top + 3, 4.6 if not child else 3.8, 8 if not child else 6, HAT_SHADE.get(hat, hat), tilt)
            img = outline(img)
            px = img.load()
    if style.get('corrupt') and view in ('s', 'se', 'e') and anim != 'death':
        p = Px(img)
        rows = [y for y in range(32) if any(px[x, y][3] for x in range(32))]
        ey = (rows[0] if rows else 0) + 9
        for x in {'s': (14, 17), 'se': (16, 18), 'e': (18, 18)}[view]: p.set(x, ey, (255, 110, 230, 255))
        for k in range(4): p.set(9 + (k * 5 + f * 3) % 14, 2 + (k * 3 + f) % 6, c('purple', 5, 140))
    return img
C.human_frame = human_frame

C.PORTRAITS.extend(['sakachief', 'sakaguard', 'arna', 'goldsmith', 'abyz', 'sakaboy', 'sakamother', 'sakawarrior', 'goldrider'])
_prev_portrait = C.portrait
def portrait(name):
    if name == 'goldrider': return rider_portrait()
    img = _prev_portrait(name)
    st = C.STYLES.get(name, {})
    if st.get('peakhat'):
        p = Px(img)
        child = st.get('build') == 'child'
        _hat(p, 24, 16 if not child else 18, 13 if not child else 11, 15 if not child else 12, HAT_SHADE.get(st['peakhat'], st['peakhat']))
        for k in range(3): p.set(16 + k * 8, 14 if not child else 16, c('gold', 4))   # gold appliqués on the felt
    return img
C.portrait = portrait

# ---------------------------------------------------------------- animals
C.SPECIES.update({
    'horse': dict(ramp='hide', cell=48, L=13, H=6.5, leg=10, head=4.2, ears=True, tail='bushy', belly='hide', snout=4),
    'leopard': dict(ramp='sand', cell=32, L=10, H=4, leg=5, head=3.4, ears=True, tail='bushy', belly='grey', snout=2),
})
_prev_animal = C.animal_frame
def animal_frame(sp, view, anim, f):
    img = _prev_animal(sp, view, anim, f)
    if sp == 'horse':   # dark mane and hooves
        px = img.load(); p = Px(img)
        cell = img.width
        for y in range(cell):
            for x in range(cell):
                r, g, b, a = px[x, y]
                if a and y > cell - 6 and r < 150: px[x, y] = (40, 30, 24, a)
        rows = [y for y in range(cell) if any(px[x, y][3] for x in range(cell))]
        if rows and view == 'e':
            top = rows[0]
            for k in range(7): p.set(cell // 2 + 8 + k, top + 3 + k // 3, c('black', 2))
    if sp == 'leopard':   # the kurgan guardian: snow-leopard rosettes, ghostly violet rim, white eyes
        px = img.load()
        cell = img.width
        for y in range(cell):
            for x in range(cell):
                r, g, b, a = px[x, y]
                if not a: continue
                r, g, b = int(r * .8 + 30), int(g * .8 + 30), int(b * .8 + 40)
                if noise2(x // 2, y // 2, 61) > .72: r, g, b = 70, 58, 74
                px[x, y] = (r, g, b, int(a * .92))
        p = Px(img)
        for y in range(cell):
            for x in range(cell):
                if px[x, y][3] and (x == 0 or not px[x - 1, y][3] or not px[min(cell - 1, x + 1), y][3]): p.set(x, y, c('purple', 5, 200))
    return img
C.animal_frame = animal_frame

# ---------------------------------------------------------------- the boss (64 px): golden-armoured rider
GOLD_RIDER_ANIMS = ['idle', 'walk', 'run', 'bow', 'interact', 'swipe', 'charge', 'roar', 'hurt', 'death']
MOUNTED = ('idle', 'walk', 'run', 'bow')

def _rider_body(p, cx, by, view, f, anim, lean=0, gold=1.0):
    side = view == 'e'; back = view == 'n'
    tw = 8 if not side else 6
    # Torso: golden scale armour (thousands of small plates — the «Golden Man» costume)
    for y in range(by, by + 13):
        for x in range(int(cx - tw + lean), int(cx + tw + lean)):
            u = (x - (cx - tw + lean)) / (2 * tw)
            scale = ((x + (y // 2) % 2) % 2 == 0) and (y % 2 == 0)
            p.set(x, y, tone('gold', (.75 - u * .4 - (y - by) / 50 - (.2 if back else 0) - (.12 if scale else 0)) * gold, x, y))
    p.hline(int(cx - tw + lean), int(cx + tw - 1 + lean), by + 12, c('red', 2))   # belt
    # Head with the tall pointed golden headdress
    hx, hy = cx + lean + (1 if side else 0), by - 4
    p.ellipse(hx, hy, 3.5, 4, None, shade=lambda nx, ny: tone('skin', .65 - nx * .2, 0, 0) if not back else tone('black', .5, 0, 0))
    if not back:
        ex = (hx - 1.5, hx + 1.5) if not side else (hx + 1.5,)
        for x in ex: p.set(x, hy, (255, 110, 230, 255))
    for k in range(14):
        y = hy - 3 - k; w = 4.5 * (1 - k / 15)
        p.hline(int(hx - w), int(hx + w), y, c('gold', 4 if k % 3 else 5))
        if k % 4 == 1: p.set(hx - w, y, c('gold', 2)); p.set(hx + w, y, c('gold', 2))
    for s in (-1, 1):   # golden arrows / feathers on the headdress
        p.line(hx + s * 3, hy - 6, hx + s * 7, hy - 16, c('gold', 5)); p.set(hx + s * 7, hy - 17, c('gold', 3))
    return hx, hy


def gold_rider_frame(view, anim, f):
    cell = 64
    img = new(cell, cell); p = Px(img)
    n = C.FRAMES[anim]; t = f / n
    side = view == 'e'; back = view == 'n'
    cx, ground = 32, 60
    if anim == 'death':
        sink = [0, 6, 14, 22][min(3, f)]
        for k in range(26 + f * 6):   # the gold scatters, the shadow lifts
            p.set(cx + int((noise2(k, f, 3) - .5) * 44), ground - 1 - int(noise2(k, 9, f) * 6), c('gold', 3 + k % 3))
        if f < 3:
            _rider_body(p, cx, 32 + sink, view, f, anim, gold=1 - f * .25)
        for k in range(20): p.set(cx + int((noise2(k, 4, f) - .5) * 30), 20 + int(noise2(k, 7, f) * 30) - f * 4, c('purple', 4, 180))
        return outline(img)
    if anim in MOUNTED:
        stride = {'walk': 2.2, 'run': 4.0}.get(anim, 0)
        s = math.sin(t * math.pi * 2)
        by = 44 + (1 if anim == 'run' and f % 2 else 0)
        hl, hh = (16, 7.5) if side else (8, 8)
        # Shadow horse: black body, violet mane fire
        legs = ((-hl * .6, 0), (hl * .6, .5)) if side else ((-4, 0), (4, .5))
        for lx, ph in legs:
            sw = math.sin((t + ph) * math.pi * 2) * stride
            for o in (0, 1):
                p.line(cx + lx + o, by + 4, cx + lx + o + sw, ground, c('black', 2 + o))
        p.ellipse(cx, by, hl, hh, None, shade=lambda nx, ny: tone('black', .55 - ny * .3 - nx * .1, 0, 0))
        if side:
            hx, hy = cx + hl + 3, by - 7 - (2 if anim == 'run' else 0)
            p.line(cx + hl - 2, by - 2, hx, hy, c('black', 2)); p.line(cx + hl - 1, by - 1, hx + 1, hy + 1, c('black', 3))
            p.ellipse(hx + 2, hy, 4, 2.6, c('black', 3)); p.set(hx + 3, hy - 1, (255, 110, 230, 255))
            for k in range(8): p.set(cx + hl - 6 + k, by - 6 - (k % 3) - int(s), c('purple', 5 - k % 2, 220))
            for k in range(7): p.set(cx - hl - 1 - k, by - 2 + k // 2 + int(s), c('purple', 4, 200))
        else:
            hy = by - 6 if not back else by - 3
            p.ellipse(cx, hy + (4 if not back else 0), 3, 5 if not back else 3, c('black', 3))
            if not back: p.set(cx - 1, hy + 2, (255, 110, 230, 255)); p.set(cx + 1, hy + 2, (255, 110, 230, 255))
            for k in range(6): p.set(cx - 3 + k, hy - 2 - k % 2, c('purple', 5, 220))
        # Saddle cloth with an animal-style (deer) appliqué
        p.rect(cx - 6, by - 7, 12, 5, c('red', 3)); p.set(cx - 1, by - 6, c('gold', 5)); p.set(cx + 1, by - 6, c('gold', 5))
        hx, hy = _rider_body(p, cx, by - 19, view, f, anim)
        for s_ in ((-1, 1) if not side else (1,)):   # the rider's legs astride the horse
            lx = cx + s_ * (5 if not side else 2)
            p.line(lx, by - 7, lx + (s_ if not side else 3), by + 3, c('red', 2)); p.line(lx + 1, by - 7, lx + 1 + (s_ if not side else 3), by + 3, c('red', 1))
            p.hline(int(lx + (s_ if not side else 3) - 1), int(lx + (s_ if not side else 3) + 2), by + 4, c('hide', 1))
        if anim == 'bow':   # composite bow drawn for the volley
            draw = [0, 2, 3, 0][f]
            bx = cx + (9 if side else 0); bym = by - 12
            for k in range(-6, 7): p.set(bx - draw * (0 if side else 0) + (36 - k * k) * .1 * (1 if side else 0), bym + k if side else bym - 2, c('wood', 4))
            if not side:
                for k in range(-6, 7): p.set(cx + k, bym - 2 - (36 - k * k) * .08, c('wood', 4))
            p.line(bx - draw, bym - 6, bx - draw, bym + 6, c('grey', 5))
    else:
        # On foot: akinak (short sword), shield stance, the mirror, hurt
        lean = 0; arm = 0
        if anim == 'swipe': lean = [-1, -2, 3, 1][f]; arm = [1.2, 1.6, -.5, 0][f]
        if anim == 'roar': arm = 1.8
        by = 28
        for s in (-1, 1):   # legs (trousers, soft boots)
            sw = math.sin((t + (s + 1) * .25) * math.pi * 2) * (2 if anim == 'interact' else 0)
            p.line(cx + s * 3 + lean * .5, by + 13, cx + s * 3 + sw, ground, c('red', 2)); p.line(cx + s * 3 + 1 + lean * .5, by + 13, cx + s * 3 + 1 + sw, ground, c('red', 1))
            p.hline(int(cx + s * 3 + sw - 1), int(cx + s * 3 + sw + 2), ground, c('hide', 1))
        hx, hy = _rider_body(p, cx, by, view, f, anim, lean)
        for s in (-1, 1):
            if side and s < 0: continue
            sx, sy = cx + s * 7 + lean, by + 2
            ax, ay = sx + s * 4 + (5 if side else 0) * (1 if arm > 0 else 0), sy + 11 - arm * 9
            p.line(sx, sy, ax, ay, c('gold', 3)); p.line(sx + 1, sy, ax + 1, ay, c('gold', 2))
            if s == 1 and anim == 'swipe':   # the akinak
                p.line(ax, ay, ax + 8 * (1 if f < 2 else -1), ay - 8 + f * 6, c('grey', 5)); p.set(ax, ay, c('gold', 5))
        if anim == 'charge':   # warded: a golden ring of reflected light (frontal guard)
            for k in range(24):
                a = k / 24 * math.pi * 2
                p.set(cx + math.cos(a) * 14 + (4 if side else 0), by + 6 + math.sin(a) * 16, c('gold', 5, 150 + 60 * (k % 2)))
        if anim == 'roar':     # the bronze mirror raised: Zulmat looks through it
            mx, my = cx + (6 if side else 0), by - 22
            p.ellipse(mx, my, 6, 6, None, shade=lambda nx, ny: tone('gold', .7 - nx * .3, 0, 0))
            p.ellipse(mx, my, 4, 4, c('purple', 4 + f % 2))
            for k in range(10): a = k / 10 * math.pi * 2 + f; p.set(mx + math.cos(a) * 9, my + math.sin(a) * 9, c('purple', 5, 200))
    img = outline(img)
    if anim == 'hurt' and f == 0:
        px = img.load()
        for y in range(cell):
            for x in range(cell):
                r, g, b, a = px[x, y]
                if a: px[x, y] = (min(255, r + 80), min(255, g + 70), min(255, b + 60), a)
    return img


def rider_portrait():
    W_ = 48
    img = new(W_, W_); p = Px(img)
    for y in range(W_):
        for x in range(W_): p.set(x, y, tone('purple', .18 + y / W_ * .2, x, y))
    p.ellipse(24, 30, 9, 11, None, shade=lambda nx, ny: tone('skin', .62 - nx * .25, 0, 0))
    for x in (20, 28): p.rect(x - 1, 29, 3, 2, (255, 110, 230, 255))
    for k in range(24):
        y = 20 - k; w = 9 * (1 - k / 25)
        p.hline(int(24 - w), int(24 + w), y, c('gold', 4 if k % 3 else 5))
    for s in (-1, 1): p.line(24 + s * 6, 16, 24 + s * 14, 2, c('gold', 5))
    for y in range(41, 48):
        for x in range(8, 40): p.set(x, y, tone('gold', .7 - abs(x - 24) / 40 - ((x + y) % 2) * .1, x, y))
    return outline(img)


C2.CUSTOM['goldrider'] = (64, gold_rider_frame, GOLD_RIDER_ANIMS)
HUMAN_SHEETS = {
    'sakachief': ['idle', 'walk', 'talk'], 'sakaguard': ['idle', 'walk', 'talk', 'spear'], 'arna': ['idle', 'walk', 'run', 'talk', 'bow'],
    'goldsmith': ['idle', 'walk', 'talk', 'work'], 'abyz': ['idle', 'walk', 'talk'], 'sakaboy': ['idle', 'walk', 'run', 'talk'],
    'sakamother': ['idle', 'walk', 'talk', 'work'], 'sakawarrior': ['idle', 'walk', 'talk', 'spear', 'sit'],
    'sakacorrupt': ['idle', 'walk', 'run', 'spear', 'hurt', 'death'], 'steppearcher': ['idle', 'walk', 'run', 'bow', 'hurt', 'death'],
}
ANIMAL_SHEETS = {'horse': ['idle', 'walk', 'run', 'graze'], 'leopard': ['idle', 'walk', 'run', 'bite', 'hurt', 'death', 'howl']}

# ---------------------------------------------------------------- props
def yurt(v):
    """Felt tent (киіз шатыр): pale or dark felt, red felt appliqué band, smoke hole."""
    img = new(56, 44); p = Px(img)
    felt = 'sand' if v == 0 else 'fur'
    p.ellipse(28, 40, 26, 4, (10, 22, 24, 90))
    for y in range(14, 40):
        w = 24 if y > 22 else 24 - (22 - y) ** 1.6 * .5
        for x in range(int(28 - w), int(28 + w)):
            u = (x - (28 - w)) / (2 * w)
            p.set(x, y, tone(felt, .8 - u * .45 - (y - 14) / 90 + (noise2(x // 2, y // 2, 4) - .5) * .08, x, y))
    for x in range(5, 51): p.set(x, 25, c('red', 3)); p.set(x, 26, c('red', 2))
    for x in range(6, 50, 5): p.set(x, 24, c('gold', 4)); p.set(x + 1, 27, c('gold', 3))
    for k in range(-8, 9): p.set(28 + k, 9 + abs(k) * .5, c(felt, 1))
    p.ellipse(28, 11, 4, 2, c('ink', 1))
    p.rect(23, 29, 10, 11, c('red', 2)); p.rect(24, 30, 8, 10, c('red', 3))
    for y in range(30, 40, 3): p.hline(24, 31, y, c('gold', 3))
    return outline(img), (28, 41)

def wagon():
    img = new(54, 36); p = Px(img)
    p.ellipse(27, 33, 24, 3, (10, 22, 24, 90))
    for x0 in (9, 45):
        p.ellipse(x0, 28, 6, 6, c('wood', 1)); p.ellipse(x0, 28, 4.5, 4.5, c('wood', 3))
        for k in range(6): a = k / 6 * math.pi; p.line(x0 - math.cos(a) * 4, 28 - math.sin(a) * 4, x0 + math.cos(a) * 4, 28 + math.sin(a) * 4, c('wood', 2))
    p.rect(6, 20, 42, 5, c('wood', 3)); p.hline(6, 47, 20, c('wood', 4))
    for y in range(4, 20):
        w = 19 - max(0, 9 - y) ** 1.3
        for x in range(int(27 - w), int(27 + w)):
            p.set(x, y, tone('sand', .78 - (x - 8) / 70 - (20 - y) / 60, x, y))
    for x in range(10, 45, 6): p.vline(x, 8, 19, c('sand', 2))
    p.line(48, 22, 54, 20, c('wood', 2))
    return outline(img), (27, 34)

def hitch():
    img = new(26, 26); p = Px(img)
    for x in (4, 21): p.rect(x, 6, 2, 19, c('wood', 3)); p.vline(x, 6, 24, c('wood', 4))
    p.rect(2, 8, 22, 2, c('wood', 4)); p.hline(2, 23, 8, c('wood', 5))
    p.line(10, 10, 13, 17, c('hide', 3)); p.line(13, 17, 15, 16, c('hide', 3))
    return outline(img), (13, 25)

def cauldron(f):
    """Bronze cauldron on a conical foot (сақ қазаны) over a small fire."""
    img = new(26, 28); p = Px(img)
    p.ellipse(13, 25, 11, 3, c('ink', 1))
    for k in range(5):
        x = 6 + k * 3.5; h = 3 + ((k + f) % 3)
        p.line(x, 25, x + 1, 25 - h, c('fire', 3 + (k + f) % 3))
    p.rect(11, 18, 4, 5, c('gold', 1))
    p.ellipse(13, 13, 9, 7, None, shade=lambda nx, ny: tone('gold', .55 - nx * .3 - ny * .2, 0, 0))
    p.ellipse(13, 8, 8, 2.2, c('gold', 4)); p.ellipse(13, 8, 6, 1.4, c('ink', 1))
    for s in (-1, 1): p.ellipse(13 + s * 9, 6, 2, 2, c('gold', 2)); p.set(13 + s * 9, 6, CLEAR)
    return outline(img), (13, 26)

def sakaltar():
    """Bronze offering table with standing snow-leopard figures (after the Zhetysu altars)."""
    img = new(34, 26); p = Px(img)
    p.ellipse(17, 23, 15, 3, (10, 22, 24, 90))
    for x in (6, 27): p.rect(x, 14, 3, 9, c('gold', 2))
    p.rect(3, 11, 28, 4, c('gold', 3)); p.hline(3, 30, 11, c('gold', 5)); p.hline(3, 30, 14, c('gold', 1))
    for x0 in (6, 22):   # two little leopards along the rim
        p.rect(x0, 7, 6, 3, c('gold', 4)); p.rect(x0 + 5, 5, 3, 3, c('gold', 4)); p.set(x0 + 7, 5, c('gold', 5))
        p.vline(x0, 10, 10, c('gold', 2)); p.vline(x0 + 5, 10, 10, c('gold', 2)); p.set(x0 - 1, 6, c('gold', 3))
    return outline(img), (17, 24)

def standard():
    """Pole with an animal-style finial: a deer with branching antlers, curled legs."""
    img = new(18, 48); p = Px(img)
    p.vline(9, 14, 46, c('wood', 3)); p.vline(10, 14, 46, c('wood', 2))
    p.poly([(4, 10), (13, 10), (14, 13), (5, 14)], c('gold', 4))
    p.ellipse(13, 8, 2, 2, c('gold', 4))
    for k in range(5): p.set(12 - k, 6 - k, c('gold', 5)); p.set(10 - k, 4 - (k % 2), c('gold', 3)); p.set(14 + k % 2, 5 - k, c('gold', 5))
    p.set(6, 14, c('gold', 3)); p.set(11, 14, c('gold', 3))
    for y in range(16, 26): p.set(8 - (y % 3 == 0), y, c('red', 3))
    return outline(img), (9, 46)

def deerstone():
    img = new(16, 36); p = Px(img)
    p.ellipse(8, 34, 7, 2, (10, 22, 24, 90))
    p.poly([(3, 34), (3, 5), (8, 2), (13, 5), (13, 34)], None, shade=lambda x, y: tone('stone', .65 - (x - 3) / 22, x, y))
    for k, y in enumerate((9, 17, 25)):   # stylised flying deer, beaks and antlers in a line
        p.line(4, y + 3, 11, y, c('stone', 1)); p.line(5, y + 4, 12, y + 1, c('stone', 1))
        for a in range(3): p.set(6 + a * 2, y - 1 - a % 2, c('stone', 1))
    p.hline(3, 12, 30, c('stone', 1))
    return outline(img), (8, 34)

def target():
    img = new(20, 24); p = Px(img)
    p.line(5, 22, 8, 10, c('wood', 3)); p.line(15, 22, 12, 10, c('wood', 3))
    p.ellipse(10, 10, 7, 7, c('sand', 4)); p.ellipse(10, 10, 5, 5, c('red', 3)); p.ellipse(10, 10, 2.5, 2.5, c('sand', 5))
    p.line(12, 9, 17, 5, c('wood', 4)); p.set(17, 5, c('grey', 5))
    return outline(img), (10, 23)

def weaponrack():
    img = new(30, 30); p = Px(img)
    p.rect(3, 6, 2, 22, c('wood', 3)); p.rect(25, 6, 2, 22, c('wood', 3)); p.rect(2, 9, 26, 2, c('wood', 4))
    for k in range(3):   # akinaks (short swords with butterfly guards)
        x = 8 + k * 6
        p.vline(x, 11, 22, c('grey', 5)); p.vline(x + 1, 11, 22, c('grey', 3)); p.hline(x - 2, x + 3, 11, c('gold', 4)); p.rect(x, 7, 2, 4, c('hide', 3))
    for k in range(-7, 8): p.set(15 + k, 26 - (49 - k * k) * .08, c('wood', 4))
    return outline(img), (15, 28)

def goldtable():
    img = new(36, 24); p = Px(img)
    p.ellipse(18, 22, 16, 2.5, (10, 22, 24, 90))
    p.rect(3, 11, 30, 4, c('wood', 3)); p.hline(3, 32, 11, c('wood', 4))
    for x in (5, 29): p.rect(x, 15, 2, 7, c('wood', 2))
    for k, x in enumerate((7, 12, 17, 22, 27)):
        p.rect(x, 8, 3, 3, c('gold', 4 + k % 2)); p.set(x + 1, 8, c('gold', 5))
    p.rect(14, 4, 6, 4, c('stone', 3))
    return outline(img), (18, 23)

def royalkurgan():
    """A royal mound with a ring of stones (крепида) at its foot."""
    img = new(112, 52); p = Px(img)
    p.ellipse(56, 44, 54, 8, (10, 22, 24, 80))
    for y in range(8, 46):
        tt = (y - 8) / 38; w = 50 * min(1, math.sin(min(1, tt * 1.15) * math.pi / 2) * 1.02)
        for x in range(int(56 - w), int(56 + w)):
            u = (x - (56 - w)) / max(1, 2 * w)
            p.set(x, y, tone('grass', .7 - u * .35 + (noise2(x // 3, y // 3, 9) - .5) * .12 - tt * .1, x, y))
    for k in range(26):
        a = k / 26 * math.pi
        x, y = 56 - math.cos(a) * 52, 44 + math.sin(a) * 5
        p.ellipse(x, y, 2.6, 1.8, c('stone', 3 + k % 2))
    return outline(img), (56, 46)

def ringstone(v):
    img = new(12, 10); p = Px(img)
    p.ellipse(6, 6, 5 - v, 3.4, None, shade=lambda nx, ny: tone('stone', .7 - nx * .3 - ny * .2, 0, 0))
    return outline(img), (6, 8)

def coffin():
    """Larch log sarcophagus of the tomb chamber."""
    img = new(40, 20); p = Px(img)
    p.rect(2, 6, 36, 11, c('wood', 2))
    for y in range(6, 17): p.hline(2, 37, y, tone('wood', .55 - (y - 6) / 30, 0, y))
    p.hline(2, 37, 6, c('wood', 5)); p.hline(2, 37, 11, c('wood', 1))
    for x in (8, 20, 32): p.set(x, 8, c('gold', 4)); p.set(x + 1, 8, c('gold', 5))
    return outline(img), (20, 18)

def goldarmor(f):
    """The ceremonial golden costume on a stand (after the Esik «Golden Man» reconstruction)."""
    img = new(24, 46); p = Px(img)
    p.ellipse(12, 44, 10, 2, (10, 22, 24, 90))
    p.vline(12, 30, 44, c('wood', 2))
    for y in range(14, 32):
        w = 6 + (y - 14) * .15
        for x in range(int(12 - w), int(12 + w)): p.set(x, y, tone('gold', .8 - (x - 6) / 28 - ((x + y) % 2) * .12, x, y))
    for k in range(14):
        y = 13 - k; w = 4 * (1 - k / 15)
        p.hline(int(12 - w), int(12 + w), y, c('gold', 4 if k % 3 else 5))
    for s in (-1, 1): p.line(12 + s * 3, 8, 12 + s * 7, 0, c('gold', 5))
    if f % 2: p.set(9, 18, (255, 250, 220, 255)); p.set(15, 24, (255, 250, 220, 255))
    return outline(img), (12, 44)

def mirror(f):
    """Zulmat's bronze mirror on a stand: a violet eye in the disc."""
    img = new(22, 34); p = Px(img)
    p.ellipse(11, 32, 8, 2, c('purple', 1, 160))
    p.vline(11, 16, 32, c('gold', 2)); p.hline(7, 15, 32, c('gold', 2))
    p.ellipse(11, 10, 8, 8, None, shade=lambda nx, ny: tone('gold', .7 - nx * .3 - ny * .2, 0, 0))
    p.ellipse(11, 10, 6, 6, c('purple', 3 + f % 3))
    p.ellipse(11, 10, 2.5, 1.5, c('purple', 6)); p.set(11, 10, c('ink', 0))
    for k in range(8): a = k / 8 * math.pi * 2 + f * .4; p.set(11 + math.cos(a) * 10, 10 + math.sin(a) * 10, c('purple', 5, 180))
    return outline(img), (11, 32)

def decal(kind):
    img = new(24, 16); p = Px(img)
    if kind == 'horsebones':
        p.ellipse(12, 8, 8, 3, c('grey', 4)); p.ellipse(20, 6, 3, 2, c('grey', 5))
        for x in range(6, 18, 3): p.line(x, 6, x - 1, 11, c('grey', 5))
    elif kind == 'tunnel':   # robbers' tunnel dug in antiquity
        p.ellipse(12, 8, 9, 5, c('dirt', 0)); p.ellipse(12, 9, 7, 3.5, c('ink', 0))
        for x in range(4, 21, 4): p.set(x, 3, c('dirt', 4))
    elif kind == 'plaques':
        for k, (x, y) in enumerate(((6, 8), (11, 6), (15, 10), (19, 7))): p.rect(x, y, 2, 2, c('gold', 4 + k % 2))
    elif kind == 'shard':     # a broken bronze mirror, violet residue
        p.poly([(8, 5), (15, 4), (14, 11), (9, 12)], None, shade=lambda x, y: tone('gold', .6 - (x - 8) / 20, x, y))
        for x, y in ((11, 7), (12, 9), (13, 8)): p.set(x, y, c('purple', 5))
    elif kind == 'hoofs':
        for x, y in ((5, 5), (9, 9), (14, 6), (18, 10)):
            p.ellipse(x, y, 1.6, 1.2, c('dirt', 0)); p.set(x, y, c('purple', 3, 160))
    return img, (12, 8)

def snowpine(v):
    """Tien Shan spruce on the foothills."""
    img = new(28, 54); p = Px(img)
    p.ellipse(14, 51, 9, 2.5, (10, 22, 24, 90))
    p.rect(13, 40, 3, 11, c('bark', 2))
    for k in range(7):
        y = 6 + k * 5; w = 3 + k * 1.6
        for yy in range(y, y + 7):
            ww = w * (yy - y + 2) / 8
            for x in range(int(14 - ww), int(14 + ww)):
                p.set(x, yy, tone('leaf', .45 - (x - 14 + ww) / (ww * 4 + 1) * .3 - k * .02, x, yy))
        if v and k < 4: p.hline(int(14 - w * .6), int(14 + w * .3), y + 1, c('grey', 5))
    return outline(img), (14, 51)

def register(add):
    for v in range(2): add(f'O_YURT_{v}', yurt(v))
    add('O_WAGON', wagon()); add('O_HITCH', hitch())
    for f in range(4): add(f'O_CAULDRON_{f}', cauldron(f))
    add('O_SAKALTAR', sakaltar()); add('O_STANDARD', standard()); add('O_DEERSTONE', deerstone())
    add('O_TARGET', target()); add('O_WEAPONRACK', weaponrack()); add('O_GOLDTABLE', goldtable())
    add('O_ROYALKURGAN', royalkurgan())
    for v in range(2): add(f'O_RINGSTONE_{v}', ringstone(v))
    add('O_COFFIN', coffin())
    for f in range(2): add(f'O_GOLDARMOR_{f}', goldarmor(f))
    for f in range(4): add(f'O_MIRROR_{f}', mirror(f))
    for k in ('horsebones', 'tunnel', 'plaques', 'shard', 'hoofs'): add(f'O_{k.upper()}', decal(k))
    for v in range(2): add(f'O_SNOWPINE_{v}', snowpine(v))
