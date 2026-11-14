"""MAP04 «Ғұндар дәуірі»: Xiongnu (Hun), Wusun and Kangju people, the mounted lancer, the hooded
knot-keeper (the third party), the boss «Үш жүзді айғақшы» and props (mud-brick fort, banners, caravan
bales, knot cords, tally sticks, slab tombs, a river raft)."""
import math
from .core import *
from . import chars as C
from . import chars2 as C2
from . import saka as S   # noqa: F401 (keeps earlier frame wrappers in the chain)

C.STYLES.update({
    'hunchief': dict(skin='skin2', hair='black', hairstyle='tail', top='fur', topkind='cloak', trim='gold', legs='hide', legshade=1,
                     boots='hide', beard='black', necklace=True, furcap='wolf', bracelets=True),
    'hunwarrior': dict(skin='skin2', hair='black', hairstyle='tail', top='hide', topkind='tunic', trim='red', legs='fur', legshade=0,
                       boots='hide', furcap='fur', pack='bowback'),
    'hunscout': dict(skin='skin', hair='black', hairstyle='braid', top='steppe', topkind='tunic', trim='hide', legs='hide', legshade=0,
                     boots='fur', furcap='saiga', pack='quiver'),
    'hunenvoy': dict(skin='skin', hair='black', hairstyle='crop', top='blue', topkind='cloak', trim='gold', legs='hide', legshade=1,
                     boots='hide', furcap='fur', necklace=True),
    'wusunbek': dict(skin='skin', hair='grey', hairstyle='crop', top='teal', topkind='cloak', trim='gold', legs='hide', legshade=1,
                     boots='hide', beard='grey', peakhat='hide', staff=True),
    'wusunhealer': dict(skin='skin2', hair='black', hairstyle='braid', top='sand', topkind='dress', trim='red', legs='sand', legshade=1,
                        boots='hide', headband='red', necklace=True),
    'kangjubek': dict(skin='skin2', hair='black', hairstyle='crop', top='purple', topkind='cloak', trim='gold', legs='blue', legshade=1,
                      boots='hide', beard='black', headband='gold', bracelets=True),
    'merchant': dict(skin='skin', hair='black', hairstyle='crop', top='ochre', topkind='cloak', trim='sand', legs='sand', legshade=1,
                     boots='hide', beard='black', headband='sand', pack='satchel'),
    'knotkeeper': dict(skin='skin', hair='grey', hairstyle='crop', top='grey', topkind='cloak', trim='stone', legs='grey', legshade=1,
                       boots='fur', hood=True),
    'huncorrupt': dict(skin='skin2', hair='black', hairstyle='tail', top='hide', topkind='tunic', trim='red', legs='fur', legshade=0,
                       boots='hide', furcap='fur', corrupt=True),
})

_prev_human = C.human_frame
def human_frame(style, view, anim, f):
    img = _prev_human(style, view, anim, f)
    cap, hood = style.get('furcap'), style.get('hood')
    if not (cap or hood): return img
    px = img.load()
    rows = [y for y in range(32) if any(px[x, y][3] for x in range(32))]
    top = rows[0] if rows else 99
    if top > 6: return img
    xs = [x for y in range(top, top + 4) for x in range(32) if px[x, y][3]]
    cx = sum(xs) / len(xs)
    p = Px(img)
    if cap:      # round fur-trimmed cap of the steppe riders
        p.ellipse(cx, top + 2, 4.6, 3, None, shade=lambda nx, ny: tone(cap, .7 - nx * .25 - ny * .2, 0, 0))
        p.hline(int(cx - 5), int(cx + 5), top + 4, c('fur', 4)); p.hline(int(cx - 4), int(cx + 4), top + 5, c('fur', 2))
    if hood:     # deep grey hood: the face is never seen; white knotted cords hang on the chest
        back = view == 'n'
        for y in range(top, top + 10):
            w = 5.2 - abs(y - top - 4) * .35
            for x in range(int(cx - w), int(cx + w) + 1):
                inner = (not back) and abs(x - cx - (1.5 if view in ('e', 'se', 'ne') else 0)) < 2.2 and top + 4 <= y <= top + 8
                p.set(x, y, c('ink', 0) if inner else tone('grey', .5 - (x - cx) / 14 - (y - top) / 40, x, y))
        if not back and anim != 'death':
            for k in range(4):
                x = int(cx - 3 + k * 2)
                for y in range(top + 12, top + 17 + (k % 2) * 2): p.set(x, y, c('grey', 5) if (y + k) % 3 else c('gold', 3))
    return outline(img)
C.human_frame = human_frame

C.PORTRAITS.extend(['hunchief', 'hunwarrior', 'hunscout', 'hunenvoy', 'wusunbek', 'wusunhealer', 'kangjubek', 'merchant', 'knotkeeper', 'witness'])
_prev_portrait = C.portrait
def portrait(name):
    if name == 'witness':
        img = new(48, 48); p = Px(img)
        for y in range(48):
            for x in range(48): p.set(x, y, tone('purple', .14 + y / 48 * .18, x, y))
        for k, (mx, ramp) in enumerate(((12, 'wolf'), (24, 'gold'), (36, 'teal'))):   # three masks, one voice
            p.ellipse(mx, 24 - (k == 1) * 4, 7, 10, None, shade=lambda nx, ny, r=ramp: tone(r, .7 - nx * .3 - ny * .2, 0, 0))
            for ex in (mx - 3, mx + 3): p.rect(ex - 1, 21 - (k == 1) * 4, 2, 2, (255, 110, 230, 255))
            p.hline(mx - 3, mx + 3, 29 - (k == 1) * 4, c('ink', 0))
        return outline(img)
    img = _prev_portrait(name)
    st = C.STYLES.get(name, {})
    p = Px(img)
    if st.get('furcap'):
        p.ellipse(24, 14, 13, 8, None, shade=lambda nx, ny: tone(st['furcap'], .7 - nx * .25 - ny * .2, 0, 0))
        for x in range(10, 39): p.set(x, 20, c('fur', 4)); p.set(x, 21, c('fur', 3 if x % 2 else 2))
    if st.get('hood'):
        for y in range(4, 44):
            w = 17 - abs(y - 22) * .35
            for x in range(int(24 - w), int(24 + w)):
                inner = abs(x - 24) < 9 and 14 <= y <= 36
                p.set(x, y, c('ink', 0) if inner else tone('grey', .55 - (x - 8) / 60 - y / 120, x, y))
        for k in range(5):
            for y in range(38, 47): p.set(14 + k * 5, y, c('grey', 5) if (y + k) % 3 else c('gold', 3))
        p.set(21, 26, c('grey', 3)); p.set(27, 26, c('grey', 3))
    return img
C.portrait = portrait

C.SPECIES.update({'camel': dict(ramp='saiga', cell=48, L=13, H=6.5, leg=10, head=3.6, ears=True, tail='short', belly='sand', snout=3, hump=True)})

# ---------------------------------------------------------------- mounted lancer (48 px, Bear-type AI)
def hun_rider_frame(view, anim, f):
    cell = 48
    img = new(cell, cell); p = Px(img)
    t = f / C.FRAMES[anim]
    side = view == 'e'; back = view == 'n'
    cx, ground = 24, 44
    if anim == 'death':
        sink = [0, 4, 9, 12][min(3, f)]
        p.ellipse(cx, ground - 5 + sink * .3, 13, 5 - sink * .2, c('hide', 2))
        p.ellipse(cx - 8, ground - 3, 4, 3, c('fur', 3))
        return outline(img)
    stride = {'walk': 2, 'charge': 3.6}.get(anim, 0)
    by = 31 + (1 if anim == 'charge' and f % 2 else 0)
    hl, hh = (13, 5.5) if side else (6, 6)
    for lx, ph in (((-hl * .6, 0), (hl * .6, .5)) if side else ((-3, 0), (3, .5))):
        sw = math.sin((t + ph) * math.pi * 2) * stride
        for o in (0, 1): p.line(cx + lx + o, by + 3, cx + lx + o + sw, ground, c('hide', 1 + o))
    p.ellipse(cx, by, hl, hh, None, shade=lambda nx, ny: tone('hide', .6 - ny * .3 - nx * .1, 0, 0))
    if side:
        hx, hy = cx + hl + 2, by - 6 - (1 if anim == 'charge' else 0)
        p.line(cx + hl - 2, by - 2, hx, hy, c('hide', 3)); p.ellipse(hx + 2, hy, 3.4, 2.2, c('hide', 3))
        for k in range(6): p.set(cx + hl - 5 + k, by - 5 - k % 2, c('black', 2))
        for k in range(5): p.set(cx - hl - 1 - k, by - 1 + k // 2, c('black', 2))
    else:
        p.ellipse(cx, by - (4 if not back else 2), 2.6, 4 if not back else 2.6, c('hide', 3))
    p.rect(cx - 4, by - 6, 8, 3, c('red', 2))
    ty = by - 16
    for y in range(ty, ty + 10):
        for x in range(cx - 4, cx + 5): p.set(x, y, tone('fur', .7 - (x - cx + 4) / 16 - (y - ty) / 40, x, y))
    p.ellipse(cx + (1 if side else 0), ty - 3, 3, 3.2, c('skin2', 3) if not back else c('black', 2))
    p.ellipse(cx + (1 if side else 0), ty - 5, 3.4, 2, c('wolf', 3)); p.hline(cx - 3, cx + 4, ty - 3, c('fur', 4))
    reach = {'swipe': [2, 6, 12, 5][f % 4], 'charge': 9, 'roar': -2}.get(anim, 4)
    lx0, ly0 = cx + 4, ty + 3
    if side: p.line(lx0, ly0, lx0 + reach + 8, ly0 + (2 if anim != 'roar' else -10), c('wood', 4)); p.set(lx0 + reach + 9, ly0 + (2 if anim != 'roar' else -11), c('grey', 5))
    else: p.line(cx + 5, ty + 2, cx + 6, ty - 12 + (reach if not back else 0), c('wood', 4)); p.set(cx + 6, ty - 13 + (reach if not back else 0), c('grey', 5))
    img = outline(img)
    if anim == 'hurt' and f == 0:
        px = img.load()
        for y in range(cell):
            for x in range(cell):
                r, g, b, a = px[x, y]
                if a: px[x, y] = (min(255, r + 80), min(255, g + 70), min(255, b + 60), a)
    return img

# ---------------------------------------------------------------- boss «Үш жүзді айғақшы» (64 px)
WITNESS_ANIMS = ['idle', 'walk', 'bow', 'roar', 'swipe', 'charge', 'hurt', 'death']
def witness_frame(view, anim, f):
    cell = 64
    img = new(cell, cell); p = Px(img)
    t = f / C.FRAMES[anim]
    cx, ground = 32, 60
    back = view == 'n'; side = view == 'e'
    sink = [0, 8, 18, 28][min(3, f)] if anim == 'death' else 0
    sway = math.sin(t * math.pi * 2) * (2 if anim in ('walk', 'charge') else 1)
    for y in range(22 + sink, ground):   # robe woven from strips of three banners
        tt = (y - 22) / 38; half = 7 + tt * 9
        for x in range(cell):
            d = (x - cx - sway * tt) / half
            if abs(d) < 1 and not (y > ground - 4 and noise2(x, y + f, 3) > .5):
                ramp = 'wolf' if d < -.33 else 'gold' if d < .33 else 'teal'
                p.set(x, y, tone(ramp, .5 - abs(d) * .2 - tt * .25 + (noise2(x // 2, y // 3, 8) - .5) * .15, x, y))
    if anim == 'death' and f >= 2:
        for k in range(30): p.set(cx + int((noise2(k, f, 2) - .5) * 44), ground - 2 - int(noise2(k, 5, f) * 12), c('purple', 3 + k % 3, 200))
        if f == 3: return outline(img)
    hy = 15 + sink
    faces = ((-9, 'wolf'), (9, 'teal'), (0, 'gold'))   # side masks first, the middle one on top
    turn = {'s': 0, 'e': 5, 'n': 0}[view]
    for dx, ramp in faces:
        mx = cx + dx * (.55 if side else 1) + turn + sway * .3
        my = hy + (3 if dx else 0) + (math.sin((t + dx) * 6.28) * 1.2 if anim == 'roar' else 0)
        p.ellipse(mx, my, 5, 6.5, None, shade=lambda nx, ny, r=ramp: tone(r, (.75 - nx * .3 - ny * .2) if not back else .3, 0, 0))
        if not back:
            for ex in (mx - 2, mx + 2): p.set(ex, my - 1, (255, 110, 230, 255))
            p.hline(int(mx - 2), int(mx + 2), int(my + 3), c('ink', 0))
    for s in (-1, 1):   # arms
        if side and s < 0: continue
        up = {'bow': [.4, .9, 1.1, .5][f % 4], 'roar': 1.5, 'swipe': [1.3, 1.6, -.3, 0][f % 4], 'charge': .8}.get(anim, .1)
        sx, sy = cx + s * 8, 27 + sink
        ax, ay = sx + s * 6 + (4 if side else 0), sy + 12 - up * 12
        p.line(sx, sy, ax, ay, c('purple', 4)); p.line(sx + 1, sy, ax + 1, ay, c('purple', 3))
        if anim == 'bow' and s == 1:
            for k in range(-7, 8): p.set(ax + 3 - k * k * .05, ay + k, c('wood', 4))
            p.vline(int(ax + 1 - [0, 2, 3, 0][f % 4]), int(ay - 7), int(ay + 7), c('grey', 5))
        if anim in ('roar', 'charge'):
            for k in range(6): a = k / 6 * 6.28 + f; p.set(ax + math.cos(a) * 3, ay + math.sin(a) * 3, c('purple', 6, 220))
    img = outline(img)
    if anim == 'hurt' and f == 0:
        px = img.load()
        for y in range(cell):
            for x in range(cell):
                r, g, b, a = px[x, y]
                if a: px[x, y] = (min(255, r + 80), min(255, g + 70), min(255, b + 70), a)
    return img

C2.CUSTOM['hunrider'] = (48, hun_rider_frame, ['idle', 'walk', 'charge', 'swipe', 'roar', 'hurt', 'death'])
C2.CUSTOM['witness'] = (64, witness_frame, WITNESS_ANIMS)
HUMAN_SHEETS = {
    'hunchief': ['idle', 'walk', 'talk'], 'hunwarrior': ['idle', 'walk', 'run', 'talk', 'spear', 'hurt', 'death'],
    'hunscout': ['idle', 'walk', 'run', 'talk', 'bow', 'hurt', 'death'], 'hunenvoy': ['idle', 'walk', 'talk', 'sit'],
    'wusunbek': ['idle', 'walk', 'talk'], 'wusunhealer': ['idle', 'walk', 'talk', 'work'], 'kangjubek': ['idle', 'walk', 'talk'],
    'merchant': ['idle', 'walk', 'talk', 'work'], 'knotkeeper': ['idle', 'walk', 'talk', 'interact'],
    'huncorrupt': ['idle', 'walk', 'run', 'sword', 'hurt', 'death'],
}
ANIMAL_SHEETS = {'camel': ['idle', 'walk', 'run', 'graze']}

# ---------------------------------------------------------------- props
def fortwall(v):
    """Rammed-earth / mud-brick wall of the fortified town; v=1 is a gate tower."""
    w, h = (48, 44) if v == 0 else (40, 60)
    img = new(w, h); p = Px(img)
    for y in range(6, h - 2):
        for x in range(w):
            row = (y // 5) % 2
            brick = (x + row * 5) % 10 == 0 or y % 5 == 0
            p.set(x, y, tone('sand', (.62 - (y - 6) / (h * 2.2) + (noise2(x // 2, y // 2, 12) - .5) * .12) - (.12 if brick else 0), x, y))
    for x in range(0, w, 8): p.rect(x, 2, 5, 5, c('sand', 3)); p.hline(x, x + 4, 2, c('sand', 4))
    if v == 1:
        p.rect(12, h - 26, 16, 24, c('wood', 1)); p.rect(14, h - 24, 12, 22, c('wood', 2))
        for y in range(h - 22, h - 2, 5): p.hline(14, 25, y, c('wood', 0))
        p.rect(4, 14, 5, 7, c('ink', 1)); p.rect(31, 14, 5, 7, c('ink', 1))
    return outline(img), (w // 2, h - 3)

def banner(v):
    """Banner on a pole: 0 Hun (wolf grey), 1 Wusun (teal), 2 Kangju (purple-gold)."""
    img = new(20, 46); p = Px(img)
    ramp = ('wolf', 'teal', 'purple')[v]
    p.vline(4, 2, 44, c('wood', 3)); p.vline(5, 2, 44, c('wood', 2)); p.set(4, 1, c('gold', 4))
    for y in range(4, 22):
        for x in range(6, 18 - (y % 6 == 5) * 2): p.set(x + (y // 7) % 2, y, tone(ramp, .7 - (x - 6) / 30 - (y - 4) / 60, x, y))
    p.rect(9, 9, 5, 5, c('gold', 4) if v != 1 else c('sand', 4)); p.set(11, 11, c(ramp, 1))
    for k in range(3): p.set(8 + k * 4, 23 + k % 2, c('red', 3))
    return outline(img), (5, 44)

def bales():
    img = new(30, 22); p = Px(img)
    for x0, y0, r in ((2, 8, 'sand'), (15, 9, 'ochre'), (8, 1, 'red')):
        p.rect(x0, y0, 13, 10, c(r, 3)); p.hline(x0, x0 + 12, y0, c(r, 5)); p.vline(x0 + 6, y0, y0 + 9, c('hide', 2)); p.hline(x0, x0 + 12, y0 + 5, c('hide', 2))
    return outline(img), (15, 20)

def cords(f):
    """Knotted record cords hanging from a pole: they sway; one knot glints."""
    img = new(24, 40); p = Px(img)
    p.hline(2, 21, 3, c('wood', 3)); p.vline(2, 3, 38, c('wood', 2)); p.vline(21, 3, 38, c('wood', 2))
    for k in range(5):
        x = 5 + k * 3.5; sway = math.sin(f * 1.57 + k) * 1.2
        for y in range(4, 26 + (k * 7) % 9):
            xx = x + sway * (y - 4) / 26
            p.set(xx, y, c('grey', 5) if y % 5 else c('gold', 4 if (k + f) % 4 else 5))
    return outline(img), (12, 38)

def tally():
    img = new(18, 10); p = Px(img)
    p.poly([(1, 3), (16, 2), (16, 6), (1, 7)], c('wood', 4)); p.hline(1, 16, 3, c('wood', 5))
    for x in (4, 7, 10, 13): p.vline(x, 3, 5, c('ink', 1))
    p.rect(13, 5, 3, 2, c('red', 3))
    return outline(img), (9, 8)

def raft():
    img = new(44, 22); p = Px(img)
    for y in range(4, 19, 3):
        p.hline(2, 41, y, c('wood', 4)); p.hline(2, 41, y + 1, c('wood', 2)); p.hline(2, 41, y + 2, c('wood', 1))
    for x in (8, 34): p.vline(x, 3, 19, c('hide', 2))
    return outline(img), (22, 12)

def slabtomb():
    """Slab grave with a low stone fence (тас қоршау)."""
    img = new(40, 26); p = Px(img)
    p.ellipse(20, 22, 18, 3.5, (10, 22, 24, 90))
    for k in range(9):
        a = math.pi + k / 8 * math.pi
        x, y = 20 + math.cos(a) * 16, 17 + math.sin(a) * 9
        p.rect(int(x - 2), int(y - 5), 4, 7, c('stone', 3 + k % 2))
    p.poly([(9, 14), (31, 13), (33, 20), (8, 21)], None, shade=lambda x, y: tone('stone', .65 - (x - 8) / 60, x, y))
    return outline(img), (20, 23)

def bellpost(f):
    img = new(14, 30); p = Px(img)
    p.vline(3, 2, 28, c('wood', 3)); p.hline(3, 11, 3, c('wood', 3))
    bx = 9 + (f % 2)
    p.poly([(bx - 2, 5), (bx + 2, 5), (bx + 3, 10), (bx - 3, 10)], c('gold', 4)); p.set(bx, 11, c('gold', 2))
    return outline(img), (4, 28)

def register(add):
    for v in range(2): add(f'O_FORTWALL_{v}', fortwall(v))
    for v in range(3): add(f'O_BANNER_{v}', banner(v))
    add('O_BALES', bales()); add('O_TALLY', tally()); add('O_RAFT', raft()); add('O_SLABTOMB', slabtomb())
    for f in range(4): add(f'O_CORDS_{f}', cords(f))
    for f in range(2): add(f'O_BELLPOST_{f}', bellpost(f))
