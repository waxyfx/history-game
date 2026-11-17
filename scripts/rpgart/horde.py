"""MAP06 «Алтын Орда»: Saraychik on the Zhaiyk (Ural), mid-14th century. Townspeople and nomads of the Ulus of
Jochi — a scribe of genealogies, a Khorezmian merchant, a bowyer, a yam (relay) rider, a madrasa teacher, the noyon
who carries a forged yarlyk (the boss), footmen and archers — and the props of a steppe trading city: a brick minaret,
a madrasa portal, a domed mausoleum, the bazaar, the mint, a caravanserai gate, a yam post, archive shelves.
Original pixel art in the shared palette."""
import math
from .core import *
from . import chars as C
from . import turk as T   # noqa: F401 (keeps the earlier frame wrappers in the chain)

C.STYLES.update({
    'scribe': dict(skin='skin', hair='black', hairstyle='crop', top='blue', topkind='cloak', trim='gold', legs='ink', legshade=1,
                   boots='hide', beard='black', turban='grey'),
    'khorezm': dict(skin='skin2', hair='black', hairstyle='crop', top='ochre', topkind='cloak', trim='red', legs='sand', legshade=1,
                    boots='hide', beard='black', turban='sand', pack='satchel'),
    'bowyer': dict(skin='skin2', hair='black', hairstyle='braid', top='hide', topkind='tunic', trim='wood', legs='fur', legshade=0,
                   boots='hide', beard='grey', furcap='fur', build='broad'),
    'yamchi': dict(skin='skin2', hair='black', hairstyle='braid', top='red', topkind='tunic', trim='gold', legs='ink', legshade=1,
                   boots='hide', helm='grey', pack='bowback', bracelets=True),
    'mudarris': dict(skin='skin', hair='grey', hairstyle='crop', top='grey', topkind='cloak', trim='teal', legs='grey', legshade=1,
                     boots='hide', beard='grey', turban='grey', staff=True, stoop=1),
    'herald': dict(skin='skin2', hair='black', hairstyle='braid', top='purple', topkind='tunic', trim='gold', legs='ink', legshade=1,
                   boots='hide', beard='black', helm='gold', pack='bowback', bracelets=True, lamellar=True),
    'hordeman': dict(skin='skin2', hair='black', hairstyle='braid', top='steppe', topkind='tunic', trim='red', legs='hide', legshade=0,
                     boots='hide', helm='grey', lamellar=True),
    'hordearcher': dict(skin='skin', hair='black', hairstyle='braid', top='blue', topkind='tunic', trim='hide', legs='hide', legshade=0,
                        boots='fur', furcap='fur', pack='quiver'),
    'gerwoman': dict(skin='skin2', hair='black', hairstyle='braid', top='teal', topkind='dress', trim='gold', legs='teal', legshade=1,
                     boots='hide', headband='red', necklace=True),
})

_prev_human = C.human_frame
def human_frame(style, view, anim, f):
    img = _prev_human(style, view, anim, f)
    if not (style.get('turban') or style.get('helm') or style.get('lamellar')): return img
    px = img.load()
    rows = [y for y in range(32) if any(px[x, y][3] for x in range(32))]
    top = rows[0] if rows else 99
    if top > 8: return img
    xs = [x for y in range(top, top + 4) for x in range(32) if px[x, y][3]]
    cx = sum(xs) / len(xs)
    p = Px(img)
    if style.get('turban'):     # a wound cloth turban (madrasa, merchants)
        r = style['turban']
        p.ellipse(cx, top + 2, 5.2, 3.2, None, shade=lambda nx, ny: tone(r, .75 - nx * .25 - ny * .2, 0, 0))
        for k in range(-4, 5, 3): p.set(cx + k, top + 1 + (k % 2), tone(r, .35, 0, 0))
    if style.get('helm'):       # pointed iron helmet with a mail aventail
        r = style['helm']
        p.poly([(cx - 5, top + 4), (cx, top - 3), (cx + 5, top + 4)], None, shade=lambda x, y: tone(r, .7 - (x - cx + 5) / 20, x, y))
        p.hline(int(cx - 5), int(cx + 5), top + 4, tone(r, .3, 0, 0)); p.set(cx, top - 4, c('gold', 4))
        if view != 'n':
            for y in range(top + 5, top + 9): p.set(cx - 5, y, c('grey', 3)); p.set(cx + 5, y, c('grey', 3))
    if style.get('lamellar') and anim != 'death':   # rows of lamellae on the chest
        for y in range(top + 11, top + 18, 2):
            for x in range(int(cx - 4), int(cx + 5), 2):
                if px[x, y][3]: p.set(x, y, c('grey', 4 if (x + y) % 4 else 2))
    return outline(img)
C.human_frame = human_frame

C.PORTRAITS.extend(['scribe', 'khorezm', 'bowyer', 'yamchi', 'mudarris', 'herald', 'gerwoman'])
_prev_portrait = C.portrait
def portrait(name):
    img = _prev_portrait(name)
    st = C.STYLES.get(name, {})
    p = Px(img)
    if st.get('turban'):
        p.ellipse(24, 12, 15, 8, None, shade=lambda nx, ny: tone(st['turban'], .75 - nx * .25 - ny * .2, 0, 0))
        for k in range(12, 37, 6): p.line(k, 8, k + 4, 16, tone(st['turban'], .35, 0, 0))
    if st.get('helm'):
        p.poly([(9, 18), (24, 1), (39, 18)], None, shade=lambda x, y: tone(st['helm'], .7 - (x - 9) / 60, x, y))
        p.hline(9, 39, 18, tone(st['helm'], .3, 0, 0)); p.set(24, 0, c('gold', 5))
    return img
C.portrait = portrait

HUMAN_SHEETS = {
    'scribe': ['idle', 'walk', 'talk', 'work'], 'khorezm': ['idle', 'walk', 'talk'], 'bowyer': ['idle', 'walk', 'talk', 'work'],
    'yamchi': ['idle', 'walk', 'run', 'talk', 'spear'], 'mudarris': ['idle', 'walk', 'talk'], 'gerwoman': ['idle', 'walk', 'talk', 'work'],
    'herald': ['idle', 'walk', 'run', 'talk', 'bow', 'spear', 'hurt', 'death', 'interact', 'victory'],
    'hordeman': ['idle', 'walk', 'run', 'spear', 'hurt', 'death'], 'hordearcher': ['idle', 'walk', 'run', 'bow', 'hurt', 'death'],
}
ANIMAL_SHEETS = {}

# ---------------------------------------------------------------- props
def brick(p, x0, y0, w, h, ramp='sand', shade=.6):
    for y in range(y0, y0 + h):
        for x in range(x0, x0 + w):
            joint = (y % 4 == 0) or ((x + (y // 4) * 3) % 7 == 0)
            p.set(x, y, tone(ramp, shade - (y - y0) / (h * 3) - (.14 if joint else 0) + (noise2(x // 2, y // 2, 61) - .5) * .08, x, y))

def minaret():
    img = new(24, 72); p = Px(img)
    p.ellipse(12, 69, 10, 3, (10, 14, 20, 90))
    for y in range(8, 68):
        w = 5 + (y - 8) / 60 * 3
        for x in range(int(12 - w), int(12 + w) + 1):
            band = (y // 6) % 3 == 0
            p.set(x, y, tone('teal' if band and 20 < y < 50 else 'sand', .62 - (x - 12 + w) / (w * 5) - (.1 if y % 3 == 0 else 0), x, y))
    p.rect(6, 6, 13, 4, c('sand', 4)); p.poly([(8, 6), (12, 0), (16, 6)], c('teal', 4))
    return outline(img), (12, 69)

def iwan():
    """Madrasa portal (pishtaq): a tall arched niche with a glazed frame."""
    img = new(64, 60); p = Px(img)
    brick(p, 2, 6, 60, 52)
    p.rect(2, 4, 60, 4, c('teal', 3)); p.hline(2, 61, 4, c('teal', 5))
    for y in range(14, 58):
        w = 12 if y > 26 else int(12 * math.sqrt(max(0, 1 - ((26 - y) / 13) ** 2)))
        for x in range(32 - w, 32 + w): p.set(x, y, tone('ink', .6 + (y - 14) / 120, x, y))
    for y in range(12, 58, 3): p.set(18, y, c('teal', 4)); p.set(46, y, c('teal', 4))
    p.rect(26, 50, 12, 8, c('wood', 2))
    return outline(img), (32, 57)

def turbe():
    """A domed brick mausoleum of the city's necropolis."""
    img = new(48, 54); p = Px(img)
    brick(p, 6, 24, 36, 28)
    p.ellipse(24, 22, 16, 13, None, shade=lambda nx, ny: tone('teal', .72 - nx * .25 - ny * .3, 0, 0))
    p.rect(20, 36, 8, 16, c('ink', 1)); p.poly([(20, 36), (24, 31), (28, 36)], c('ink', 1))
    p.set(24, 8, c('gold', 5)); p.vline(24, 6, 9, c('gold', 3))
    return outline(img), (24, 51)

def stall(v):
    img = new(36, 32); p = Px(img)
    ramp = ('red', 'teal', 'ochre')[v]
    for x in range(2, 34): p.vline(x, 4, 9 + (x % 6 < 3), tone(ramp, .6 - (x % 6) / 20, x, 0))
    p.vline(4, 9, 30, c('wood', 3)); p.vline(31, 9, 30, c('wood', 3))
    p.rect(4, 20, 28, 4, c('wood', 4)); p.hline(4, 31, 20, c('wood', 5))
    goods = [('gold', 4), ('red', 3), ('blue', 4), ('leaf', 4)]
    for k in range(6): col = goods[(k + v) % 4]; p.ellipse(8 + k * 4, 18, 1.6, 1.6, c(*col))
    return outline(img), (18, 30)

def coinpress():
    """The mint: an anvil with a die and stacks of stamped coins."""
    img = new(30, 22); p = Px(img)
    p.rect(8, 10, 14, 6, c('stone', 2)); p.rect(6, 8, 18, 3, c('stone', 4)); p.rect(12, 16, 6, 4, c('stone', 2))
    p.rect(13, 2, 4, 7, c('wood', 3)); p.rect(11, 1, 8, 2, c('stone', 5))
    for k in range(3):
        for j in range(3 - k % 2): p.ellipse(3 + j * 2, 18 - j * 2 - k, 2, 1, c('gold', 4 if j % 2 else 3))
    for j in range(4): p.ellipse(25, 18 - j * 1.5, 2.2, 1, c('grey', 4 if j % 2 else 3))
    return outline(img), (15, 20)

def caravangate():
    img = new(64, 56); p = Px(img)
    brick(p, 2, 8, 60, 46, 'sand', .55)
    p.rect(2, 6, 60, 3, c('sand', 4))
    for y in range(20, 54):
        w = 13 if y > 30 else int(13 * math.sqrt(max(0, 1 - ((30 - y) / 11) ** 2)))
        for x in range(32 - w, 32 + w): p.set(x, y, tone('ink', .55 + (y - 20) / 100, x, y))
    for x in (8, 54): p.rect(x - 3, 2, 6, 52, c('sand', 3)); p.rect(x - 4, 0, 8, 3, c('sand', 5))
    return outline(img), (32, 53)

def yampost():
    """A yam relay post: a pole with a hanging paiza tablet and a hitching rail."""
    img = new(26, 40); p = Px(img)
    p.vline(6, 3, 38, c('wood', 3)); p.vline(7, 3, 38, c('wood', 2)); p.hline(6, 13, 5, c('wood', 3))
    p.rect(10, 7, 6, 10, c('gold', 4)); p.rect(11, 8, 4, 8, c('gold', 2)); p.set(13, 10, c('ink', 1)); p.set(13, 13, c('ink', 1))
    p.hline(2, 24, 30, c('wood', 4)); p.vline(22, 28, 38, c('wood', 2))
    return outline(img), (10, 38)

def shelves():
    img = new(48, 40); p = Px(img)
    p.rect(2, 2, 44, 36, c('wood', 1)); p.rect(4, 4, 40, 32, c('wood', 2))
    for row in range(4):
        y = 6 + row * 8; p.hline(4, 43, y + 6, c('wood', 4))
        for k in range(9):
            x = 6 + k * 4.3
            if (k + row) % 3 == 0: p.ellipse(x + 1, y + 4, 2, 1.6, c('sand', 4)); p.set(x + 1, y + 4, c('red', 3))
            else: p.rect(x, y, 3, 6, c(['red', 'blue', 'ochre', 'teal'][(k + row) % 4], 3))
    return outline(img), (24, 38)

def scrolltable():
    """The scribe's table: an unrolled genealogy with branches, ink, a reed pen."""
    img = new(40, 26); p = Px(img)
    p.rect(4, 12, 32, 6, c('wood', 3)); p.hline(4, 35, 12, c('wood', 5)); p.vline(6, 18, 24, c('wood', 2)); p.vline(33, 18, 24, c('wood', 2))
    p.rect(8, 6, 24, 8, c('sand', 4)); p.ellipse(8, 10, 2, 4, c('sand', 3)); p.ellipse(32, 10, 2, 4, c('sand', 3))
    p.vline(20, 7, 12, c('ink', 1))
    for k, x in enumerate((12, 16, 24, 28)): p.line(20, 9, x, 12 - k % 2, c('ink', 1))
    p.set(14, 8, c('red', 4)); p.ellipse(34, 4, 1.5, 1.5, c('ink', 1)); p.line(36, 2, 31, 8, c('wood', 4))
    return outline(img), (20, 24)

def bowbench():
    img = new(34, 22); p = Px(img)
    p.rect(3, 10, 28, 4, c('wood', 3)); p.vline(5, 14, 20, c('wood', 2)); p.vline(29, 14, 20, c('wood', 2))
    for k in range(-8, 9): p.set(17 + k, 7 - (64 - k * k) * .05, c('hide', 4))
    p.line(9, 7, 25, 7, c('grey', 5)); p.ellipse(8, 9, 2, 1.5, c('bark', 5)); p.line(27, 8, 31, 4, c('bark', 4))
    return outline(img), (17, 20)

def lancerack():
    img = new(30, 46); p = Px(img)
    p.hline(2, 27, 30, c('wood', 3)); p.hline(2, 27, 40, c('wood', 3)); p.vline(3, 28, 44, c('wood', 2)); p.vline(26, 28, 44, c('wood', 2))
    for k in range(4):
        x = 7 + k * 5; p.vline(x, 2, 43, c('wood', 4)); p.poly([(x - 1, 3), (x, 0), (x + 1, 3)], c('stone', 5))
        p.set(x + 1, 6, c('red', 4)); p.set(x + 1, 7, c('red', 3))
    return outline(img), (15, 44)

def kayraktas(v):
    """A grave stone with an Arabic-script epitaph (v=1 tilted, older)."""
    img = new(14, 26); p = Px(img)
    p.poly([(2, 24), (2 + v, 6), (7, 2), (12 - v, 6), (12, 24)], None, shade=lambda x, y: tone('warmstone', .6 - (x - 2) / 30, x, y))
    for row in range(5): p.hline(4, 10, 8 + row * 3, c('warmstone', 1)); p.set(5 + row % 3, 9 + row * 3, c('warmstone', 1))
    return outline(img), (7, 24)

def kiln(f):
    img = new(26, 26); p = Px(img)
    p.ellipse(13, 15, 10, 9, None, shade=lambda nx, ny: tone('ochre', .6 - nx * .2 - ny * .2, 0, 0))
    p.ellipse(13, 18, 4, 3, c('fire', 2 + f % 3)); p.rect(11, 3, 4, 5, c('ochre', 2))
    return outline(img), (13, 23)

def carpet():
    img = new(30, 18); p = Px(img)
    p.rect(1, 1, 28, 16, c('red', 2)); p.rect(3, 3, 24, 12, c('red', 3))
    for k in range(3): p.poly([(9 + k * 6, 9), (12 + k * 6, 5), (15 + k * 6, 9), (12 + k * 6, 13)], c('gold', 3))
    return img, (15, 9)

def register(add):
    add('O_MINARET', minaret()); add('O_IWAN', iwan()); add('O_TURBE', turbe())
    for v in range(3): add(f'O_STALL_{v}', stall(v))
    add('O_COINPRESS', coinpress()); add('O_CARAVANGATE', caravangate()); add('O_YAMPOST', yampost()); add('O_SHELVES', shelves())
    add('O_SCROLLTABLE', scrolltable()); add('O_BOWBENCH', bowbench()); add('O_LANCERACK', lancerack())
    for v in range(2): add(f'O_KAYRAKTAS_{v}', kayraktas(v))
    for f in range(4): add(f'O_KILN_{f}', kiln(f))
    add('O_CARPET', carpet())
