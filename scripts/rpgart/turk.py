"""MAP05 «Жадтың көлеңкесі»: Turkic Khaganate (c. 711–712, Zhetysu). People of a Türgesh aul and of the
Kök-Türk camp (Tonyukuk, Kül Tegin), the second Aibar (the twin / the boss «Екінші бейне»), stone balbals,
a runic stele, a burnt palisade gate — plus the props of the team easter eggs in MAP01–MAP05
(original pixel art only: a masked iron throne, a glowing chip blueprint and a leather jacket, a chess board
and a black visor mask, a green portal lab, terracotta soldiers and a crowned emperor)."""
import math
from .core import *
from . import chars as C
from . import hun as HUN   # noqa: F401 (keeps the earlier frame wrappers in the chain)

C.STYLES.update({
    'tonyukuk': dict(skin='skin', hair='grey', hairstyle='braid', top='blue', topkind='cloak', trim='gold', legs='hide', legshade=1,
                     boots='hide', beard='grey', staff=True, stoop=1, necklace=True),
    'kultegin': dict(skin='skin2', hair='black', hairstyle='braid', top='red', topkind='tunic', trim='gold', legs='ink', legshade=1,
                     boots='hide', bracelets=True, pack='bowback', diadem=True),
    'irkin': dict(skin='skin', hair='grey', hairstyle='crop', top='hide', topkind='cloak', trim='red', legs='hide', legshade=1,
                  boots='fur', beard='grey', furcap='fur', staff=True, stoop=2),
    'kumis': dict(skin='skin2', hair='black', hairstyle='braid', top='blue', topkind='dress', trim='gold', legs='blue', legshade=1,
                  boots='hide', headband='red', necklace=True),
    'togyz': dict(skin='skin2', hair='black', hairstyle='crop', top='hide', topkind='tunic', trim='wood', legs='fur', legshade=0,
                  boots='hide', beard='black', build='broad'),
    'sentry': dict(skin='skin', hair='black', hairstyle='tail', top='steppe', topkind='tunic', trim='red', legs='hide', legshade=0,
                   boots='hide', furcap='wolf', pack='quiver'),
    'turkherd': dict(skin='skin2', hair='black', hairstyle='crop', top='fur', topkind='cloak', trim='hide', legs='hide', legshade=1,
                     boots='fur', furcap='fur', staff=True),
    'ayan': dict(skin='skin', hair='black', hairstyle='crop', top='ochre', topkind='tunic', trim='hide', legs='hide', legshade=0,
                 boots='fur', build='child'),
    # The second Aibar: the same cut, a grey scarf, a torn trim, an unblinking cyan glint (no device on the wrist).
    'twin': dict(skin='skin', hair='hair', hairstyle='short', top='teal', topkind='jacket', trim='grey',
                 legs='blue', legshade=0, boots='wood', scarf='wolf', pack='quiver', twin=True),
    'turkcorrupt': dict(skin='skin2', hair='black', hairstyle='braid', top='grey', topkind='tunic', trim='red', legs='fur', legshade=0,
                        boots='hide', furcap='wolf', corrupt=True),
    # Historical figures (original pixel art): Tomyris, queen of the Massagetae (6th c. BC; MAP03 «time echo»),
    # and Bilge as Tardush shad (later Bilge kagan; MAP05, 711–712).
    'tomyris': dict(skin='skin', hair='black', hairstyle='braid', top='red', topkind='tunic', trim='gold', legs='hide', legshade=1,
                    boots='hide', peakhat='gold', necklace=True, bracelets=True, pack='quiver'),
    'bilge': dict(skin='skin2', hair='black', hairstyle='braid', top='teal', topkind='cloak', trim='gold', legs='ink', legshade=1,
                  boots='hide', beard='black', bracelets=True, diadem=True),
    # MAP05 easter egg: a crowned emperor from beyond time (eyes bound with white cloth, arms folded).
    'qin': dict(skin='skin', hair='black', hairstyle='tail', top='black', topkind='cloak', trim='gold', legs='ink', legshade=1,
                boots='wood', qin=True),
})

_prev_human = C.human_frame
def human_frame(style, view, anim, f):
    img = _prev_human(style, view, anim, f)
    if not (style.get('diadem') or style.get('twin') or style.get('qin')): return img
    px = img.load()
    rows = [y for y in range(32) if any(px[x, y][3] for x in range(32))]
    top = rows[0] if rows else 99
    if top > 8: return img
    xs = [x for y in range(top, top + 4) for x in range(32) if px[x, y][3]]
    cx = sum(xs) / len(xs)
    p = Px(img)
    front = view != 'n'
    if style.get('diadem'):   # a gold diadem with a bird on the brow (cf. the Kül Tegin bust)
        p.hline(int(cx - 4), int(cx + 4), top + 2, c('gold', 4)); p.set(cx, top, c('gold', 5)); p.set(cx - 1, top + 1, c('gold', 3)); p.set(cx + 1, top + 1, c('gold', 3))
    if style.get('twin') and front and anim not in ('death',):
        eye = int(cx + (1 if view in ('e', 'se', 'ne') else 0))
        p.set(eye - 1, top + 5, c('cyan', 3)); p.set(eye + 2, top + 5, c('cyan', 3))
    if style.get('qin'):      # flat mian crown board with bead strings; white cloth over the eyes
        p.rect(int(cx - 6), top - 1 if top else 0, 13, 2, c('ink', 1)); p.hline(int(cx - 6), int(cx + 6), max(0, top - 1), c('gold', 4))
        for k in range(-5, 6, 2):
            for y in range(top + 1, top + 4): p.set(cx + k, y, c('gold', 3) if (y + k) % 2 else c('red', 4))
        if front:
            p.hline(int(cx - 4), int(cx + 4), top + 5, c('grey', 5)); p.hline(int(cx - 4), int(cx + 4), top + 6, c('grey', 4))
            p.set(cx + 5, top + 7, c('grey', 4)); p.set(cx + 6, top + 8, c('grey', 4))
    return outline(img)
C.human_frame = human_frame

C.PORTRAITS.extend(['tomyris', 'bilge', 'tonyukuk', 'kultegin', 'irkin', 'kumis', 'togyz', 'sentry', 'turkherd', 'ayan', 'twin', 'qin', 'stele'])
_prev_portrait = C.portrait
def portrait(name):
    if name == 'stele':   # the runic stone «speaks» (inscriptions, system notes)
        img = new(48, 48); p = Px(img)
        for y in range(48):
            for x in range(48): p.set(x, y, tone('blue', .12 + y / 48 * .12, x, y))
        p.poly([(14, 46), (16, 6), (24, 2), (32, 6), (34, 46)], None, shade=lambda x, y: tone('stone', .62 - (x - 14) / 50 - y / 160, x, y))
        for row in range(8):
            for k in range(3): p.set(19 + k * 4 + (row % 2), 10 + row * 4, c('ink', 1)); p.set(20 + k * 4, 11 + row * 4, c('ink', 1))
        return outline(img)
    img = _prev_portrait(name)
    st = C.STYLES.get(name, {})
    p = Px(img)
    if st.get('furcap'):
        p.ellipse(24, 14, 13, 8, None, shade=lambda nx, ny: tone(st['furcap'], .7 - nx * .25 - ny * .2, 0, 0))
        for x in range(10, 39): p.set(x, 20, c('fur', 4)); p.set(x, 21, c('fur', 3 if x % 2 else 2))
    if st.get('diadem'):
        p.hline(13, 35, 13, c('gold', 4)); p.hline(13, 35, 14, c('gold', 2))
        p.poly([(22, 12), (24, 6), (26, 12)], c('gold', 5)); p.set(24, 8, c('red', 4))
    if st.get('twin'):    # same face; a cold rim light and a steady cyan glint
        for y in range(48):
            for x in range(4): p.set(44 + x, y, c('cyan', 1, 120))
        p.set(19, 25, c('cyan', 3)); p.set(29, 25, c('cyan', 3))
    if st.get('qin'):
        p.rect(8, 5, 32, 4, c('ink', 1)); p.hline(8, 39, 5, c('gold', 4)); p.hline(8, 39, 8, c('gold', 2))
        for k in range(9, 40, 3):
            for y in range(9, 16): p.set(k, y, c('gold', 4) if y % 2 else c('red', 4))
        p.rect(12, 22, 24, 5, c('grey', 5)); p.hline(12, 35, 26, c('grey', 3))
    return img
C.portrait = portrait

HUMAN_SHEETS = {
    'tonyukuk': ['idle', 'walk', 'talk'], 'kultegin': ['idle', 'walk', 'talk'], 'irkin': ['idle', 'walk', 'talk'],
    'kumis': ['idle', 'walk', 'talk', 'work'], 'togyz': ['idle', 'walk', 'talk', 'work'], 'sentry': ['idle', 'walk', 'talk'],
    'turkherd': ['idle', 'walk', 'talk'], 'ayan': ['idle', 'walk', 'run', 'talk'],
    'twin': ['idle', 'walk', 'run', 'sword', 'hurt', 'death', 'interact', 'talk', 'victory'],
    'turkcorrupt': ['idle', 'walk', 'run', 'sword', 'hurt', 'death'], 'qin': ['idle', 'talk', 'victory'],
    'tomyris': ['idle', 'walk', 'talk', 'bow'], 'bilge': ['idle', 'walk', 'talk'],
}
ANIMAL_SHEETS = {}

# ---------------------------------------------------------------- MAP05 props
def balbal(v):
    """Small rough standing stone with a scratched face (balbal); v=2 has turned its face toward the viewer."""
    img = new(14, 24); p = Px(img)
    h = (17, 15, 18)[v]
    p.ellipse(7, 21, 6, 2, (10, 14, 20, 90))
    p.poly([(2, 21), (3, 21 - h + 3), (6, 21 - h), (10, 21 - h + 2), (12, 21)], None,
           shade=lambda x, y: tone('stone', .6 - (x - 2) / 26 + (noise2(x, y, v + 3) - .5) * .12, x, y))
    ey = 21 - h + 5
    if v == 2: p.set(5, ey, c('ink', 0)); p.set(8, ey, c('ink', 0)); p.hline(5, 8, ey + 3, c('ink', 1))
    else: p.set(5 + v, ey, c('stone', 1)); p.set(8 + v, ey, c('stone', 1)); p.hline(6 + v, 7 + v, ey + 3, c('stone', 1))
    return outline(img), (7, 22)

def stele(v):
    """Tall stele with Old Turkic runes; v=1 bears the ibex tamga on top."""
    img = new(22, 52); p = Px(img)
    p.ellipse(11, 49, 10, 3, (10, 14, 20, 100))
    p.rect(3, 44, 16, 6, c('stone', 2)); p.hline(3, 18, 44, c('stone', 4))
    p.poly([(5, 45), (5, 8), (11, 3), (17, 8), (17, 45)], None, shade=lambda x, y: tone('stone', .66 - (x - 5) / 30 - y / 200, x, y))
    for col in range(2):
        for row in range(9):
            x, y = 8 + col * 5, 12 + row * 3.5
            g = (row * 3 + col * 5 + v) % 4
            p.vline(x, y, y + 2, c('ink', 1))
            if g == 0: p.set(x + 1, y, c('ink', 1))
            elif g == 1: p.set(x - 1, y + 1, c('ink', 1))
            elif g == 2: p.set(x + 1, y + 2, c('ink', 1))
    if v == 1:   # ibex tamga
        p.line(9, 9, 11, 6, c('ink', 1)); p.line(11, 6, 13, 9, c('ink', 1)); p.set(11, 10, c('ink', 1))
    return outline(img), (11, 48)

def statue():
    """Turkic stone statue (тас мүсін): a man holding a cup at the chest."""
    img = new(18, 36); p = Px(img)
    p.ellipse(9, 33, 8, 2.5, (10, 14, 20, 90))
    p.poly([(3, 33), (3, 14), (5, 10), (13, 10), (15, 14), (15, 33)], None, shade=lambda x, y: tone('warmstone', .6 - (x - 3) / 30, x, y))
    p.ellipse(9, 7, 4.5, 5, None, shade=lambda nx, ny: tone('warmstone', .66 - nx * .3, 0, 0))
    p.set(7, 6, c('ink', 1)); p.set(11, 6, c('ink', 1)); p.hline(7, 11, 9, c('warmstone', 1))
    p.rect(7, 17, 4, 4, c('warmstone', 1)); p.hline(6, 12, 17, c('warmstone', 5))
    p.hline(3, 15, 24, c('warmstone', 2))
    return outline(img), (9, 34)

def palisade(v):
    """Wooden stake palisade of the aul; v=1 charred."""
    img = new(48, 34); p = Px(img)
    for k in range(8):
        x = 2 + k * 6; top = 3 + (k * 5) % 4
        for y in range(top, 31):
            for dx in range(5):
                base = tone('wood', .55 - dx / 12 - y / 120, x + dx, y) if v == 0 else tone('ink', .6 + (noise2(x + dx, y, 4) - .5) * .5, x + dx, y)
                p.set(x + dx, y, base)
        p.poly([(x, top), (x + 2, top - 3), (x + 4, top)], c('wood', 3) if v == 0 else c('ink', 2))
        if v == 1 and k % 3 == 1:
            for y in range(top + 6, top + 9): p.set(x + 2, y, c('fire', 2))
    p.hline(1, 46, 12, c('hide', 2) if v == 0 else c('ink', 1)); p.hline(1, 46, 24, c('hide', 2) if v == 0 else c('ink', 1))
    return outline(img), (24, 32)

def burntgate():
    img = new(56, 44); p = Px(img)
    for side in (0, 1):
        x0 = 2 if side == 0 else 42
        p.rect(x0, 4, 12, 38, c('ink', 1)); p.rect(x0 + 1, 5, 10, 36, c('wood', 1))
        for y in range(6, 40, 5): p.hline(x0 + 1, x0 + 10, y, c('ink', 0))
    for k in range(5):   # a fallen door leaf, scorched
        p.line(14 + k * 5, 40, 18 + k * 5, 30, c('ink', 2)); p.line(15 + k * 5, 40, 19 + k * 5, 30, c('wood', 1))
    for k in range(10): p.set(16 + (k * 7) % 24, 38 - (k * 3) % 8, c('fire', 2 + k % 2))
    return outline(img), (28, 42)

def cradle():
    """Бесік — a wooden cradle with a red cover."""
    img = new(20, 16); p = Px(img)
    p.rect(3, 6, 14, 6, c('wood', 3)); p.hline(3, 16, 6, c('wood', 5))
    p.line(2, 14, 5, 11, c('wood', 2)); p.line(17, 14, 14, 11, c('wood', 2))
    p.rect(5, 4, 10, 3, c('red', 3)); p.hline(5, 14, 4, c('red', 5)); p.vline(10, 1, 4, c('wood', 4))
    return outline(img), (10, 14)

def runeboard():
    """A wooden board with a runic note of thanks hung on a post."""
    img = new(16, 28); p = Px(img)
    p.vline(7, 6, 26, c('wood', 2)); p.vline(8, 6, 26, c('wood', 3))
    p.rect(1, 3, 14, 10, c('wood', 4)); p.hline(1, 14, 3, c('wood', 5))
    for k in range(5): p.vline(3 + k * 2.5, 5, 10, c('ink', 1)); p.set(4 + k * 2.5, 6 + k % 3, c('ink', 1))
    return outline(img), (8, 26)

def scarf():
    """An orange scarf lying in the dust — the same as Aibar's."""
    img = new(18, 8); p = Px(img)
    for k in range(14): p.set(2 + k, 3 + math.sin(k * .8) * 1.5, c('scarf', 4)); p.set(2 + k, 4 + math.sin(k * .8) * 1.5, c('scarf', 2))
    p.set(15, 6, c('scarf', 3)); p.set(16, 7, c('scarf', 3))
    return outline(img), (9, 6)

def runewall(v):
    """A wall panel of the hidden chamber; v=1: the line written in Aibar's hand, glowing faintly."""
    img = new(44, 30); p = Px(img)
    for y in range(2, 28):
        for x in range(2, 42): p.set(x, y, tone('warmstone', .5 - y / 90 + (noise2(x // 2, y // 2, 21) - .5) * .12, x, y))
    for row in range(4):
        for k in range(8):
            x, y = 6 + k * 4.5, 6 + row * 5.5
            if v == 1 and row == 3:   # cursive, not runes: a hand that does not belong here
                p.set(x, y + 1, c('cyan', 3)); p.set(x + 1, y, c('cyan', 3)); p.set(x + 2, y + 1, c('cyan', 3)); p.set(x + 3, y + 2, c('cyan', 2))
            else:
                p.vline(x, y, y + 3, c('ink', 1)); p.set(x + 1, y + (k % 3), c('ink', 1))
    return outline(img), (22, 28)

def tamga():
    img = new(14, 10); p = Px(img)
    p.line(3, 8, 7, 2, c('ochre', 2)); p.line(7, 2, 11, 8, c('ochre', 2)); p.line(5, 5, 9, 5, c('ochre', 2)); p.set(7, 1, c('ochre', 3))
    return img, (7, 7)

# ---------------------------------------------------------------- team easter-egg props (original art)
def doomthrone():
    """MAP01 hidden refuge: a throne carved in the rock, an iron mask on a stand, a green cloak over the back."""
    img = new(40, 44); p = Px(img)
    p.ellipse(20, 41, 18, 3, (10, 14, 20, 100))
    p.rect(8, 10, 24, 30, c('stone', 2)); p.rect(10, 12, 20, 26, c('stone', 3)); p.hline(8, 31, 10, c('stone', 5))
    for y in range(12, 36):   # green cloak draped over the back
        for x in range(11, 29):
            if (x - 20) ** 2 / 81 + (y - 22) ** 2 / 300 < 1: p.set(x, y, tone('leaf', .45 - (x - 11) / 50 + (noise2(x, y, 31) - .5) * .1, x, y))
    p.rect(6, 26, 4, 14, c('stone', 2)); p.rect(30, 26, 4, 14, c('stone', 2))
    # iron mask on the seat: brow ridge, eye slits, rivets, a grille mouth
    p.ellipse(20, 30, 6, 7, None, shade=lambda nx, ny: tone('grey', .6 - nx * .3 - ny * .2, 0, 0))
    p.hline(15, 25, 27, c('grey', 1)); p.rect(16, 28, 3, 1, c('ink', 0)); p.rect(22, 28, 3, 1, c('ink', 0))
    for x in (18, 20, 22): p.vline(x, 32, 35, c('grey', 2))
    for x, y in ((15, 25), (25, 25), (14, 31), (26, 31)): p.set(x, y, c('grey', 5))
    return outline(img), (20, 41)

def doomgear(f):
    """Stone gears and a bronze-free 'machine' that should not exist in the Stone Age (turning slowly)."""
    img = new(28, 26); p = Px(img)
    for cx, cy, r, ph in ((9, 12, 7, 0), (20, 16, 5, 1)):
        p.ellipse(cx, cy, r, r, None, shade=lambda nx, ny: tone('stone', .55 - nx * .2 - ny * .2, 0, 0))
        for k in range(8):
            a = k / 8 * 6.283 + (f + ph) * .39 * (1 if ph == 0 else -1.4)
            p.set(cx + math.cos(a) * (r + 1), cy + math.sin(a) * (r + 1), c('stone', 5))
        p.set(cx, cy, c('leaf', 4))
    return outline(img), (14, 24)

def gpuplan(f):
    """MAP02 hidden niche: a clay tablet scratched with a grid of tiny squares that glows green, like a chip plan."""
    img = new(26, 20); p = Px(img)
    p.poly([(2, 16), (4, 3), (23, 2), (24, 16)], None, shade=lambda x, y: tone('ochre', .55 - y / 60, x, y))
    glow = 3 + (f % 2)
    for gy in range(5, 15, 3):
        for gx in range(6, 22, 3): p.rect(gx, gy, 2, 2, c('leaf', glow) if (gx + gy + f) % 4 else c('cyan', 3))
    p.rect(11, 8, 6, 5, c('ink', 1)); p.rect(12, 9, 4, 3, c('leaf', 5))
    return outline(img), (13, 17)

def jacket():
    """A black leather jacket on a wooden peg — four thousand years too early."""
    img = new(18, 26); p = Px(img)
    p.vline(9, 1, 4, c('wood', 3)); p.hline(7, 11, 2, c('wood', 4))
    p.poly([(3, 7), (8, 4), (10, 4), (15, 7), (16, 22), (11, 23), (9, 10), (7, 23), (2, 22)], None,
           shade=lambda x, y: tone('ink', .7 - abs(x - 9) / 18 + (y % 5 == 0) * .15, x, y))
    p.line(8, 5, 6, 12, c('grey', 2)); p.line(10, 5, 12, 12, c('grey', 2)); p.set(13, 15, c('grey', 4))
    return outline(img), (9, 24)

def chess():
    """MAP03 hidden puzzle: a stone chess board with a few pieces (a king surrounded)."""
    img = new(30, 22); p = Px(img)
    p.poly([(2, 18), (6, 6), (24, 6), (28, 18)], c('stone', 2))
    for gy in range(4):
        for gx in range(4):
            x0 = 6 + gx * 4.5 - (gy - 1.5) * .6; y0 = 7 + gy * 2.8
            p.rect(x0, y0, 4, 2, c('gold', 4) if (gx + gy) % 2 else c('ink', 1))
    for x, y, col in ((14, 8, 'purple'), (10, 11, 'grey'), (20, 13, 'grey'), (16, 14, 'grey')):
        p.rect(x, y - 3, 2, 3, c(col, 4)); p.set(x, y - 4, c(col, 5))
    p.set(14, 3, c('gold', 5)); p.vline(14, 2, 4, c('purple', 5))
    return outline(img), (15, 19)

def zeromask():
    """A black visored helmet with a purple-and-gold sigil, on a stand behind the hidden door."""
    img = new(18, 30); p = Px(img)
    p.vline(9, 16, 28, c('wood', 2)); p.hline(5, 13, 28, c('wood', 3))
    p.ellipse(9, 9, 7, 8, None, shade=lambda nx, ny: tone('ink', .8 - nx * .3, 0, 0))
    p.poly([(4, 7), (14, 7), (12, 12), (6, 12)], c('purple', 4)); p.line(6, 8, 12, 11, c('gold', 4)); p.line(12, 8, 6, 11, c('gold', 4))
    p.set(9, 2, c('gold', 5))
    return outline(img), (9, 28)

def greenportal(f):
    """MAP04 hidden lab: a swirling green portal in a stone frame."""
    img = new(32, 40); p = Px(img)
    for y in range(4, 36):
        for x in range(4, 28):
            nx, ny = (x - 16) / 11, (y - 20) / 15
            d = nx * nx + ny * ny
            if d < 1:
                a = math.atan2(ny, nx) + d * 5 - f * .8
                p.set(x, y, c('leaf', 5) if math.sin(a * 3) > .3 else c('green2', 4) if d < .7 else c('leaf', 3))
    for k in range(40):
        a = k / 40 * 6.283
        p.set(16 + math.cos(a) * 12, 20 + math.sin(a) * 16, c('stone', 4)); p.set(16 + math.cos(a) * 13, 20 + math.sin(a) * 17, c('stone', 2))
    return outline(img), (16, 38)

def labbench():
    """A crude bench of flasks and coiled wires, one flask fizzing green."""
    img = new(36, 22); p = Px(img)
    p.rect(2, 10, 32, 4, c('wood', 3)); p.hline(2, 33, 10, c('wood', 5)); p.vline(4, 14, 20, c('wood', 2)); p.vline(31, 14, 20, c('wood', 2))
    for x, col in ((7, 'leaf'), (14, 'cyan'), (22, 'purple')):
        p.ellipse(x, 7, 2.5, 3, c(col, 3)); p.vline(x, 1, 4, c('grey', 4)); p.set(x, 0, c(col, 5))
    for k in range(10): p.set(26 + k % 5, 6 + math.sin(k) * 2, c('gold', 3))
    return outline(img), (18, 20)

def terracotta(v):
    """A clay soldier of the buried army, arms at the sides (v=1 holds a halberd)."""
    img = new(16, 34); p = Px(img)
    p.ellipse(8, 31, 7, 2, (10, 14, 20, 90))
    p.poly([(3, 31), (4, 14), (12, 14), (13, 31)], None, shade=lambda x, y: tone('ochre', .5 - (x - 3) / 30 - y / 140, x, y))
    for y in range(16, 26, 3): p.hline(4, 12, y, c('ochre', 1))
    p.ellipse(8, 9, 3.5, 4, None, shade=lambda nx, ny: tone('ochre', .62 - nx * .2, 0, 0))
    p.rect(6, 4, 5, 2, c('ochre', 2)); p.set(7, 9, c('ochre', 1)); p.set(10, 9, c('ochre', 1))
    if v == 1: p.vline(14, 2, 31, c('wood', 3)); p.poly([(13, 2), (16, 4), (14, 6)], c('stone', 4))
    return outline(img), (8, 32)

def qinthrone():
    img = new(40, 36); p = Px(img)
    p.rect(4, 26, 32, 8, c('red', 1)); p.hline(4, 35, 26, c('gold', 4))
    p.rect(8, 6, 24, 22, c('ink', 1)); p.rect(10, 8, 20, 18, c('red', 2))
    for k in range(5): p.set(12 + k * 4, 10, c('gold', 4)); p.set(12 + k * 4, 24, c('gold', 4))
    p.poly([(14, 14), (20, 11), (26, 14), (20, 21)], c('gold', 3))   # a sun-dragon disc
    p.rect(4, 14, 4, 14, c('gold', 2)); p.rect(32, 14, 4, 14, c('gold', 2))
    return outline(img), (20, 34)

def register(add):
    for v in range(3): add(f'O_BALBAL_{v}', balbal(v))
    for v in range(2): add(f'O_STELE_{v}', stele(v))
    add('O_STATUE', statue())
    for v in range(2): add(f'O_PALISADE_{v}', palisade(v))
    add('O_BURNTGATE', burntgate()); add('O_CRADLE', cradle()); add('O_RUNEBOARD', runeboard()); add('O_SCARF', scarf())
    for v in range(2): add(f'O_RUNEWALL_{v}', runewall(v))
    add('O_TAMGA', tamga())
    add('O_DOOMTHRONE', doomthrone())
    for f in range(4): add(f'O_DOOMGEAR_{f}', doomgear(f))
    for f in range(2): add(f'O_GPUPLAN_{f}', gpuplan(f))
    add('O_JACKET', jacket()); add('O_CHESS', chess()); add('O_ZEROMASK', zeromask())
    for f in range(4): add(f'O_GREENPORTAL_{f}', greenportal(f))
    add('O_LABBENCH', labbench())
    for v in range(2): add(f'O_TERRACOTTA_{v}', terracotta(v))
    add('O_QINTHRONE', qinthrone())
