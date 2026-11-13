"""MAP02 characters: bronze-age villagers, shade-touched warriors, raiders, cattle and sheep,
the ash wraith and the boss «Бұрмаланған от сақшысы» (distorted keeper of the sacred fire)."""
import math
from .core import *
from . import chars as C

C.STYLES.update({
    'smith': dict(skin='skin2', hair='black', hairstyle='crop', top='hide', topkind='apron', trim='gold', legs='fur', legshade=1,
                  boots='hide', beard='black', bare_arms=True, build='broad', bracelets=True),
    'matriarch': dict(skin='skin2', hair='grey', hairstyle='braid', top='red', topkind='cloak', trim='gold', legs='red', legshade=1,
                      boots='hide', headband='gold', necklace=True, staff=True, stoop=1),
    'guard': dict(skin='skin', hair='black', hairstyle='tail', top='fur', topkind='tunic', trim='gold', legs='hide', legshade=0,
                  boots='fur', headband='gold', bracelets=True),
    'shepherd': dict(skin='skin', hair='black', hairstyle='messy', top='steppe', topkind='tunic', trim='hide', legs='hide', legshade=0,
                     boots='fur', build='child'),
    'grainkeeper': dict(skin='skin2', hair='black', hairstyle='braid', top='sand', topkind='dress', trim='ochre', legs='sand', legshade=1,
                        boots='hide', headband='ochre', necklace=True),
    'villager': dict(skin='skin', hair='black', hairstyle='crop', top='dirt', topkind='tunic', trim='ochre', legs='hide', legshade=1,
                     boots='fur', bare_arms=True),
    'villagerw': dict(skin='skin2', hair='black', hairstyle='braid', top='ochre', topkind='dress', trim='gold', legs='ochre', legshade=1,
                      boots='hide'),
    'shade': dict(skin='skin', hair='black', hairstyle='crop', top='dirt', topkind='tunic', trim='ochre', legs='hide', legshade=1,
                  boots='fur', bare_arms=True, shade=True),
    'raider': dict(skin='skin2', hair='black', hairstyle='tail', top='fur', topkind='tunic', trim='red', legs='wolf', legshade=0,
                   boots='fur', headband='red', paint=True, pack='bowback'),
})

_orig_human_frame = C.human_frame
def human_frame(style, view, anim, f):
    img = _orig_human_frame(style, view, anim, f)
    px = img.load()
    if style.get('bracelets'):   # bronze bracelets catch the light at the wrists
        for y in range(32):
            for x in range(32):
                r, g, b, a = px[x, y]
                if a and r > 150 and g > 100 and b < 110 and y > 17 and (x + y + f) % 7 == 0:
                    px[x, y] = (226, 180, 90, 255)
    if style.get('shade'):       # a villager hollowed by the shadow: purple-black, ember eyes, aura
        for y in range(32):
            for x in range(32):
                r, g, b, a = px[x, y]
                if a: px[x, y] = (int(r * .3 + 22), int(g * .22 + 12), int(b * .38 + 34), a)
        p = Px(img)
        hy = 9 + (2 if anim == 'death' else 0)
        if view in ('s', 'se', 'e'):
            ex = {'s': (14, 17), 'se': (16, 18), 'e': (18, 18)}[view]
            for x in ex: p.set(x, hy, (255, 120, 60, 255))
        for k in range(5):
            p.set(10 + (k * 5 + f * 3) % 13, 4 + (k * 3 + f) % 6, c('purple', 5, 150))
    return img
C.human_frame = human_frame

C.SPECIES.update({
    'cow': dict(ramp='hide', cell=32, L=12, H=6.5, leg=7, head=4, ears=True, tail='short', belly='bark', snout=3, horns=True),
    'sheep': dict(ramp='grey', cell=32, L=8.5, H=6, leg=4, head=3, ears=True, tail='puff', belly='grey', snout=2),
})

# ---------------------------------------------------------------- ash wraith (40 px cell)
def wraith_frame(view, anim, f):
    cell = 40
    img = new(cell, cell); p = Px(img)
    t = f / max(1, C.FRAMES[anim])
    bob = math.sin(t * math.pi * 2) * 1.5
    fade = 1.0
    if anim == 'death': fade = [1, .7, .4][min(2, f)]
    if anim == 'roar': bob -= 2
    cx, top = 20, 6 + bob
    for y in range(int(top), 36):
        tt = (y - top) / 30
        half = 4.5 + tt * 6 + math.sin(y * .5 + f) * 1.2
        for x in range(cell):
            d = abs(x - cx - math.sin(y * .3 + f) * tt * 2) / half
            if d < 1 and not (y > 30 and noise2(x, y + f, 4) > .45):
                v = .55 - d * .3 - tt * .2
                p.set(x, y, c('grey', max(0, int(v * 4)), int(220 * fade * (1 - tt * .5))))
    p.ellipse(cx, top + 4, 4, 4.5, c('ink', 2, int(240 * fade)))
    if view != 'n':
        ox = 2 if view == 'e' else 0
        p.set(cx - 1 + ox, top + 4, c('fire', 4, int(255 * fade))); p.set(cx + 2 + ox - (1 if ox else 0), top + 4, c('fire', 4, int(255 * fade)))
    p.ellipse(cx, top + 14, 2.5, 2.5, c('fire', 3, int(200 * fade)))        # ember core
    if anim == 'roar':                                                       # casting a fire bolt
        p.ellipse(cx + (8 if view == 'e' else 0), top + 12 - (0 if view == 'e' else 6), 3 + f, 3 + f, c('fire', 4, 200))
    for k in range(4):
        p.set(cx - 6 + (k * 4 + f * 2) % 13, 34 - (k * 5 + f * 3) % 20, c('fire', 2, 150))
    if anim == 'hurt' and f == 0:
        px = img.load()
        for y in range(cell):
            for x in range(cell):
                r, g, b, a = px[x, y]
                if a: px[x, y] = (min(255, r + 90), min(255, g + 70), min(255, b + 60), a)
    return img

# ---------------------------------------------------------------- the boss (64 px cell)
def keeper_frame(view, anim, f):
    cell = 64
    img = new(cell, cell); p = Px(img)
    n = C.FRAMES[anim]; t = f / n
    cx, ground = 32, 60
    side = view == 'e'; back = view == 'n'
    lean = 0; arm_up = 0.0; breath = 0; sink = 0
    if anim == 'idle': arm_up = .1 * (f % 2)
    if anim == 'walk': lean = [0, 1, 1, 0, -1, -1][f % 6]
    if anim == 'swipe': arm_up = [1.2, 1.6, -.4, 0][f]; lean = [-1, -2, 3, 1][f]       # ground slam
    if anim == 'roar': breath = f + 1; lean = -1                                          # fire breath
    if anim == 'charge': arm_up = [1.0, 1.8, 1.8, 1.2][f]                                 # summon pillars
    if anim == 'death': sink = [0, 10, 22][min(2, f)]
    # Cloak of ash (lower body)
    for y in range(30 + sink, ground):
        tt = (y - 30) / 30
        half = 10 + tt * 9
        for x in range(cell):
            d = abs(x - cx - lean * tt) / half
            if d < 1 and not (y > ground - 4 and noise2(x, y + f, 2) > .5):
                p.set(x, y, tone('ink', .35 + (1 - d) * .3 - tt * .2 + (noise2(x // 2, y // 2 + f, 5) - .5) * .2, x, y))
                if noise2(x, y + f * 3, 9) > .965: p.set(x, y, c('fire', 3))
    if anim == 'death' and f >= 1:
        for k in range(30): p.set(cx + int((noise2(k, f, 1) - .5) * 40), ground - 2 - int(noise2(k, 3, f) * 10), c('grey', 2 + k % 2))
        if f == 2: return outline(img)
    by = 18 + sink
    # Torso: bronze plates
    tw = 12 if not side else 9
    for y in range(by, by + 16):
        for x in range(cx - tw + lean, cx + tw + lean):
            u = (x - (cx - tw + lean)) / (2 * tw)
            plate = ((y - by) // 4) % 2
            p.set(x, y, tone('gold', .6 - u * .4 - (y - by) / 60 - plate * .1 - (.15 if back else 0), x, y))
    for y in range(by + 2, by + 16, 4): p.hline(cx - tw + 1 + lean, cx + tw - 2 + lean, y, c('gold', 1))
    # Arms wreathed in flame
    for s in (-1, 1):
        if side and s < 0: continue
        sx = cx + s * (tw + 1) + lean; sy = by + 2
        hx = sx + s * 6 * (0 if side else 1) + (6 if side else 0) * (1 if arm_up > 0 else 0)
        hy = sy + 16 - arm_up * 14
        for o in (-1, 0, 1, 2): p.line(sx + o * s * .5, sy, hx + o * s * .5, hy, c('gold', 2 if o < 1 else 1))
        p.line(sx, sy + 1, hx, hy + 1, c('fire', 2, 140))
        for k in range(8):
            a = k / 8 * math.pi * 2 + f
            p.set(hx + math.cos(a) * 3.5, hy + math.sin(a) * 3.5 - 1, c('fire', 2 + k % 3))
        p.ellipse(hx, hy, 2.5, 2.5, c('fire', 4))
    # Head: bronze mask with a crown of rays (a twisted sun-headed figure)
    hx, hy = cx + lean + (2 if side else 0), by - 6
    for k in range(9):
        a = math.pi + k / 8 * math.pi
        r1, r2 = 7, 13 + (k % 2) * 3
        p.line(hx + math.cos(a) * r1, hy + math.sin(a) * r1, hx + math.cos(a) * r2, hy + math.sin(a) * r2, c('gold', 3 if k % 2 else 4))
    p.ellipse(hx, hy, 7, 8, None, shade=lambda nx, ny: tone('gold', .75 - nx * .3 - ny * .2, 0, 0) if not back else tone('ink', .4, 0, 0))
    if not back:
        ex = (hx - 3, hx + 3) if not side else (hx + 2, hx + 5)
        for x in ex: p.rect(x - 1, hy - 1, 2, 2, c('fire', 5)); p.set(x, hy + 1, c('fire', 3))
        p.hline(hx - 3 + (2 if side else 0), hx + 3, hy + 4, c('gold', 0))
    if breath:   # flame pouring from the mask
        dx, dy = (1, .2) if side else (0, 1)
        if back: dx, dy = 0, -1
        for k in range(10 + breath * 6):
            spread = k * .35
            for j in range(-int(spread), int(spread) + 1):
                x = hx + dx * (8 + k) + (-dy) * j * .6; y = hy + 6 + dy * k + dx * j * .6
                p.set(x, y, c('fire', max(1, 5 - k // 5), max(60, 230 - k * 8)))
    img = outline(img)
    if anim == 'hurt' and f == 0:
        px = img.load()
        for y in range(cell):
            for x in range(cell):
                r, g, b, a = px[x, y]
                if a: px[x, y] = (min(255, r + 80), min(255, g + 60), min(255, b + 60), a)
    return img

CUSTOM = {
    'wraith': (40, wraith_frame, ['idle', 'walk', 'roar', 'hurt', 'death']),
    'keeper': (64, keeper_frame, ['idle', 'walk', 'swipe', 'roar', 'charge', 'hurt', 'death']),
}

C.PORTRAITS.extend(['smith', 'matriarch', 'guard', 'shepherd', 'grainkeeper', 'villager', 'keeper'])
_orig_portrait = C.portrait
def portrait(name):
    if name != 'keeper': return _orig_portrait(name)
    W_ = 48
    img = new(W_, W_); p = Px(img)
    for y in range(W_):
        for x in range(W_): p.set(x, y, tone('red', .15 + y / W_ * .2, x, y))
    for k in range(11):
        a = math.pi + k / 10 * math.pi
        p.line(24 + math.cos(a) * 12, 26 + math.sin(a) * 12, 24 + math.cos(a) * 22, 26 + math.sin(a) * 22, c('gold', 3 + k % 2))
    p.ellipse(24, 27, 12, 14, None, shade=lambda nx, ny: tone('gold', .8 - nx * .3 - ny * .2, 0, 0))
    for x in (19, 29): p.rect(x - 2, 25, 4, 3, c('fire', 5)); p.set(x, 28, c('fire', 3))
    p.hline(19, 29, 33, c('gold', 0))
    for k in range(40): p.set(int(noise2(k, 4, 2) * 48), 40 + int(noise2(k, 5, 2) * 8), c('fire', 2 + k % 3))
    return outline(img)
C.portrait = portrait
