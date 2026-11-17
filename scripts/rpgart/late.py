"""MAP07–MAP10: the Kazakh Khanate (1728), the Russian Empire (Akmola, 1838), Soviet Kazakhstan (Alma-Ata, 1941) and
independent Kazakhstan (Almaty, 2087). People of four eras (all fictional), their bosses, the hero's sheets for the late
eras (with a long gun; with the fire in the lost eye), weapon icons and the props of each map.
Original pixel art in the shared palette."""
import math
from .core import *
from . import chars as C
from . import horde as HORDE   # noqa: F401 (keeps the earlier frame wrappers in the chain)

S = dict
C.STYLES.update({
    # ---- MAP07: an aul of the Middle Zhuz before the battle at the Bulanty
    'aksakal': S(skin='skin2', hair='grey', hairstyle='crop', top='blue', topkind='cloak', trim='gold', legs='ink', legshade=1, boots='hide', beard='grey', furcap='fur', staff=True, stoop=1),
    'bi': S(skin='skin', hair='grey', hairstyle='crop', top='red', topkind='cloak', trim='gold', legs='ink', legshade=1, boots='hide', beard='grey', furcap='black', staff=True),
    'batyr': S(skin='skin2', hair='black', hairstyle='braid', top='red', topkind='tunic', trim='gold', legs='ink', legshade=1, boots='hide', beard='black', helm='grey', lamellar=True, build='broad'),
    'zhyrshy': S(skin='skin', hair='black', hairstyle='crop', top='teal', topkind='cloak', trim='gold', legs='ink', legshade=1, boots='hide', beard='black', furcap='fur'),
    'apa': S(skin='skin2', hair='grey', hairstyle='braid', top='purple', topkind='dress', trim='gold', legs='purple', legshade=1, boots='hide', turban='sand', necklace=True),
    'usta': S(skin='skin2', hair='black', hairstyle='crop', top='hide', topkind='apron', trim='bark', legs='hide', legshade=0, boots='hide', beard='black', build='broad'),
    'qyz': S(skin='skin', hair='black', hairstyle='braid', top='red', topkind='dress', trim='gold', legs='red', legshade=1, boots='hide', headband='gold', necklace=True),
    'jungar': S(skin='skin2', hair='black', hairstyle='braid', top='ochre', topkind='tunic', trim='red', legs='hide', legshade=0, boots='hide', helm='grey', lamellar=True),
    'jungararcher': S(skin='skin2', hair='black', hairstyle='braid', top='purple', topkind='tunic', trim='hide', legs='hide', legshade=0, boots='fur', furcap='fur', pack='quiver'),
    'noyon': S(skin='skin2', hair='black', hairstyle='braid', top='grey', topkind='cloak', trim='red', legs='ink', legshade=1, boots='hide', beard='black', helm='gold', lamellar=True, build='broad'),
    # ---- MAP08: Akmola fort, 1838
    'tilmash': S(skin='skin', hair='black', hairstyle='crop', top='blue', topkind='jacket', trim='gold', legs='ink', legshade=1, boots='stone', beard='black', furcap='black'),
    'sarbaz': S(skin='skin2', hair='black', hairstyle='braid', top='steppe', topkind='tunic', trim='red', legs='hide', legshade=0, boots='hide', furcap='fur', pack='quiver'),
    'sentry8': S(skin='skin', hair='hair', hairstyle='crop', top='green2', topkind='jacket', trim='red', legs='ink', legshade=1, boots='stone', helm='grey', gun=True),
    'teacher': S(skin='skin', hair='grey', hairstyle='crop', top='ink', topkind='jacket', trim='grey', legs='ink', legshade=1, boots='stone', beard='grey'),
    'akbope': S(skin='skin2', hair='black', hairstyle='braid', top='teal', topkind='dress', trim='gold', legs='teal', legshade=1, boots='hide', turban='grey'),
    'tatar': S(skin='skin', hair='black', hairstyle='crop', top='ochre', topkind='cloak', trim='green2', legs='ink', legshade=1, boots='hide', beard='black', furcap='black', pack='satchel'),
    'barymta': S(skin='skin2', hair='black', hairstyle='hood', top='wolf', topkind='tunic', trim='red', legs='hide', legshade=0, boots='hide', scarf='red'),
    'chronicler': S(skin='skin', hair='grey', hairstyle='hood', top='purple', topkind='cloak', trim='cyan', legs='ink', legshade=1, boots='stone', scarf='cyan'),
    # ---- MAP09: Alma-Ata, autumn 1941
    'instructor': S(skin='skin2', hair='black', hairstyle='crop', top='steppe', topkind='jacket', trim='red', legs='steppe', legshade=1, boots='ink', helm='steppe', gun=True),
    'worker': S(skin='skin2', hair='black', hairstyle='braid', top='blue', topkind='apron', trim='grey', legs='ink', legshade=1, boots='ink', headband='red'),
    'librarian': S(skin='skin', hair='grey', hairstyle='bun', top='ink', topkind='dress', trim='grey', legs='ink', legshade=1, boots='ink'),
    'akyn': S(skin='skin2', hair='grey', hairstyle='crop', top='hide', topkind='cloak', trim='gold', legs='ink', legshade=1, boots='hide', beard='grey', furcap='fur', staff=True, stoop=1),
    'evacuee': S(skin='skin', hair='hair', hairstyle='messy', top='grey', topkind='jacket', trim='ink', legs='blue', legshade=0, boots='ink', build='child'),
    'postwoman': S(skin='skin2', hair='black', hairstyle='bun', top='steppe', topkind='jacket', trim='ochre', legs='ink', legshade=1, boots='ink', pack='satchel'),
    'heir': S(skin='skin', hair='black', hairstyle='short', top='purple', topkind='cloak', trim='gold', legs='ink', legshade=1, boots='ink', scarf='purple'),
    # ---- MAP10: Almaty 2087, the Shezhire Institute
    'prof': S(skin='skin2', hair='grey', hairstyle='crop', top='grey', topkind='jacket', trim='cyan', legs='ink', legshade=1, boots='stone', beard='grey', device=True),
    'guard10': S(skin='skin', hair='black', hairstyle='crop', top='ink', topkind='jacket', trim='cyan', legs='ink', legshade=1, boots='ink', device=True),
    'citizen': S(skin='skin2', hair='hair', hairstyle='bun', top='teal', topkind='jacket', trim='gold', legs='blue', legshade=0, boots='stone', device=True),
    'zulmat': S(skin='skin', hair='black', hairstyle='hood', top='purple', topkind='cloak', trim='gold', legs='ink', legshade=1, boots='ink', scarf='purple', build='broad'),
    # ---- the hero for the late eras
    'aibargun': S(C.STYLES['aibar'], gun=True),
    'aibarfire': S(C.STYLES['aibar'], eyefire=True),
})

# Bosses that reuse the older behaviours ask for beast animations: draw them with human poses.
ALIAS = {'roar': 'talk', 'swipe': 'sword', 'charge': 'run', 'bite': 'sword', 'howl': 'victory', 'graze': 'idle'}
_prev_human = C.human_frame
def human_frame(style, view, anim, f):
    if anim in ALIAS:
        a = ALIAS[anim]; return _prev_human(style, view, a, f % C.FRAMES[a])
    return _prev_human(style, view, anim, f)
C.human_frame = human_frame

C.PORTRAITS.extend(['bi', 'aksakal', 'batyr', 'zhyrshy', 'apa', 'usta', 'qyz', 'noyon', 'tilmash', 'sarbaz', 'sentry8', 'teacher', 'akbope', 'tatar',
                    'chronicler', 'instructor', 'worker', 'librarian', 'akyn', 'evacuee', 'postwoman', 'heir', 'prof', 'guard10', 'citizen', 'aibarfire'])

NPC = ['idle', 'walk', 'talk']
NPCW = ['idle', 'walk', 'talk', 'work']
FIGHT = ['idle', 'walk', 'run', 'hurt', 'death']
HERO = ['idle', 'walk', 'run', 'sword', 'spear', 'bow', 'hurt', 'death', 'interact', 'revive', 'victory']
HUMAN_SHEETS = {
    'bi': NPC, 'aksakal': NPC, 'batyr': NPC + ['run', 'sword', 'spear'], 'zhyrshy': NPCW, 'apa': NPCW, 'usta': NPCW, 'qyz': NPC + ['run'],
    'jungar': FIGHT + ['spear', 'sword'], 'jungararcher': FIGHT + ['bow'],
    'noyon': ['idle', 'walk', 'run', 'bow', 'roar', 'swipe', 'charge', 'hurt', 'death', 'talk'],
    'tilmash': NPCW, 'sarbaz': NPC + ['run', 'bow'], 'sentry8': NPC + ['bow'], 'teacher': NPC, 'akbope': NPCW, 'tatar': NPC,
    'barymta': FIGHT + ['spear', 'sword'],
    'chronicler': ['idle', 'walk', 'run', 'talk', 'sword', 'bow', 'hurt', 'death', 'interact', 'victory'],
    'instructor': NPC + ['bow'], 'worker': NPCW, 'librarian': NPCW, 'akyn': NPC, 'evacuee': NPC + ['run'], 'postwoman': NPC + ['run'],
    'heir': ['idle', 'walk', 'talk', 'roar', 'swipe', 'charge', 'hurt', 'death'],
    'prof': NPCW, 'guard10': NPC, 'citizen': NPC,
    # Түйінші is the MAP04 'knotkeeper' sheet (the same man, the same cloak).
    'zulmat': ['idle', 'walk', 'run', 'talk', 'sword', 'hurt', 'death', 'interact', 'victory'],
    'aibargun': HERO, 'aibarfire': HERO,
}
ANIMAL_SHEETS = {}

# ---------------------------------------------------------------- icons (weapons of the late eras, ammunition)
def icon(kind):
    img = new(16, 16); p = Px(img)
    if kind == 'sabre':
        for k in range(10): p.set(4 + k, 12 - k - (k * k) * .03, c('grey', 5 if k > 1 else 4))
        p.line(2, 11, 6, 14, c('gold', 4)); p.set(2, 14, c('wood', 3)); p.set(3, 15, c('wood', 2))
    elif kind == 'naiza':
        p.line(2, 14, 12, 4, c('wood', 4)); p.poly([(11, 2), (14, 1), (13, 5), (11, 5)], c('grey', 5)); p.set(10, 7, c('red', 4)); p.set(9, 7, c('red', 3))
    elif kind in ('musket', 'rifle', 'ppsh'):
        p.line(1, 11, 14, 5, c('stone', 2)); p.line(1, 12, 6, 10, c('wood', 3)); p.line(1, 13, 5, 11, c('wood', 2))
        if kind == 'musket': p.set(8, 9, c('gold', 4)); p.set(9, 8, c('stone', 4))
        if kind == 'rifle': p.line(12, 6, 15, 4, c('grey', 5))
        if kind == 'ppsh': p.ellipse(8, 11, 2.2, 2.2, c('stone', 3)); p.line(9, 7, 14, 5, c('stone', 4))
    elif kind == 'bayonet':
        p.line(3, 13, 13, 3, c('grey', 5)); p.line(3, 14, 6, 11, c('ink', 2)); p.set(13, 2, c('grey', 6))
    elif kind == 'pulse':   # MAP10 pulse rifle: a white-and-teal body, a glowing barrel
        p.rect(2, 8, 11, 4, c('grey', 5)); p.rect(4, 12, 3, 3, c('grey', 3)); p.line(12, 9, 15, 8, c('cyan', 5)); p.rect(6, 9, 4, 2, c('cyan', 4)); p.set(14, 8, c('cyan', 5))
    elif kind == 'ionlance':
        p.line(2, 14, 11, 5, c('grey', 5)); p.line(3, 14, 12, 5, c('stone', 3)); p.poly([(11, 2), (15, 1), (14, 5), (11, 5)], c('cyan', 5)); p.set(12, 3, c('cyan', 3))
    elif kind == 'cells':
        for k in range(3): p.rect(3 + k * 4, 4, 3, 9, c('grey', 4)); p.rect(4 + k * 4, 6, 1, 5, c('cyan', 5))
    elif kind == 'knife':
        p.line(5, 11, 12, 4, c('grey', 5)); p.line(3, 13, 5, 11, c('wood', 3)); p.set(6, 12, c('stone', 4))
    elif kind in ('balls', 'cartridges'):
        for k in range(3):
            if kind == 'balls': p.ellipse(5 + k * 3, 10 - k % 2 * 2, 1.6, 1.6, c('grey', 4))
            else: p.rect(4 + k * 3, 4, 2, 9, c('gold', 4)); p.set(4 + k * 3, 4, c('stone', 5))
    return outline(img), (0, 0)
ICONS = ['sabre', 'naiza', 'musket', 'rifle', 'ppsh', 'bayonet', 'knife', 'balls', 'cartridges', 'pulse', 'ionlance', 'cells']

# ---------------------------------------------------------------- props
def tuskiiz():
    """A felt wall hanging with a ram's-horn ornament (MAP07)."""
    img = new(30, 30); p = Px(img)
    p.vline(3, 2, 28, c('wood', 3)); p.vline(26, 2, 28, c('wood', 3)); p.hline(3, 26, 3, c('wood', 4))
    p.rect(5, 5, 20, 20, c('red', 3)); p.rect(7, 7, 16, 16, c('red', 2))
    for sx in (-1, 1):
        for k in range(6): p.set(15 + sx * (2 + k), 15 - int(3 * math.sin(k / 5 * math.pi)), c('gold', 4))
        p.set(15 + sx * 8, 16, c('gold', 4)); p.set(15 + sx * 7, 17, c('gold', 3))
    p.vline(15, 9, 21, c('gold', 4))
    return outline(img), (15, 28)

def kerege():
    """A yurt lattice wall being raised: the frame before the felt."""
    img = new(40, 26); p = Px(img)
    for k in range(-10, 30, 4):
        p.line(2 + k, 24, 14 + k, 6, c('wood', 4)); p.line(14 + k, 24, 2 + k, 6, c('wood', 3))
    img2 = new(40, 26); img2.alpha_composite(img.crop((0, 0, 40, 26)))
    p2 = Px(img2)
    for y in range(26):
        for x in range(40):
            if x < 2 or x > 37: p2.set(x, y, (0, 0, 0, 0))
    p2.hline(2, 37, 6, c('wood', 5)); p2.ellipse(20, 3, 4, 2, c('wood', 3))
    return outline(img2), (20, 24)

def saba():
    """A leather saba of kumys on a tripod."""
    img = new(22, 26); p = Px(img)
    p.line(3, 24, 11, 2, c('wood', 3)); p.line(19, 24, 11, 2, c('wood', 3))
    p.ellipse(11, 15, 7, 8, None, shade=lambda nx, ny: tone('hide', .55 - nx * .25 - ny * .2, 0, 0))
    p.rect(9, 5, 4, 3, c('hide', 2)); p.vline(11, 1, 6, c('wood', 5))
    return outline(img), (11, 24)

def kulpytas():
    """A carved stone grave post (kulpytas)."""
    img = new(14, 34); p = Px(img)
    p.rect(3, 6, 8, 26, c('warmstone', 3)); p.rect(3, 6, 2, 26, c('warmstone', 4)); p.ellipse(7, 5, 4, 3, c('warmstone', 3))
    for y in (11, 17, 23): p.hline(4, 9, y, c('warmstone', 1)); p.set(6, y + 2, c('warmstone', 1)); p.set(8, y + 2, c('warmstone', 1))
    return outline(img), (7, 32)

def sabrerack():
    img = new(30, 28); p = Px(img)
    p.hline(2, 27, 10, c('wood', 3)); p.vline(4, 8, 26, c('wood', 2)); p.vline(25, 8, 26, c('wood', 2))
    for k in range(3):
        x = 8 + k * 7
        for j in range(14): p.set(x + j * .18 + (j * j) * .01, 11 + j, c('grey', 5))
        p.hline(x - 2, x + 2, 11, c('gold', 4)); p.vline(x, 6, 10, c('wood', 4))
    return outline(img), (15, 26)

def blockhouse():
    """A log blockhouse of the fortress line (MAP08)."""
    img = new(56, 50); p = Px(img)
    for y in range(16, 48, 4):
        for x in range(4, 52): p.set(x, y, c('wood', 3)); p.set(x, y + 1, c('wood', 2)); p.set(x, y + 2, c('wood', 2)); p.set(x, y + 3, c('wood', 1))
    p.poly([(0, 18), (28, 2), (56, 18)], None, shade=lambda x, y: tone('wood', .45 - (y - 2) / 60, x, y))
    for x in (14, 40): p.rect(x - 2, 24, 4, 3, c('ink', 0))
    p.rect(24, 34, 8, 14, c('wood', 1)); p.hline(24, 31, 34, c('wood', 4))
    return outline(img), (28, 47)

def watchtower():
    img = new(30, 66); p = Px(img)
    for x in (6, 23): p.vline(x, 16, 64, c('wood', 3)); p.vline(x + 1, 16, 64, c('wood', 2))
    for y in range(24, 62, 10): p.line(6, y, 23, y + 8, c('wood', 2)); p.line(23, y, 6, y + 8, c('wood', 2))
    p.rect(2, 10, 26, 8, c('wood', 3)); p.hline(2, 27, 10, c('wood', 5)); p.poly([(0, 10), (15, 0), (30, 10)], c('wood', 2))
    return outline(img), (15, 64)

def cannon():
    img = new(34, 20); p = Px(img)
    p.rect(6, 6, 22, 5, c('stone', 2)); p.hline(6, 27, 6, c('stone', 4)); p.ellipse(28, 8, 2, 3, c('ink', 0))
    for x in (9, 22): p.ellipse(x, 14, 4.5, 4.5, None, shade=lambda nx, ny: tone('wood', .5 - ny * .2, 0, 0)); p.set(x, 14, c('stone', 4))
    p.line(2, 16, 8, 10, c('wood', 3))
    return outline(img), (16, 18)

def officedesk():
    """A clerk's desk of the district office: papers, an inkwell, a seal."""
    img = new(36, 24); p = Px(img)
    p.rect(3, 10, 30, 6, c('wood', 3)); p.hline(3, 32, 10, c('wood', 5)); p.vline(5, 16, 22, c('wood', 2)); p.vline(30, 16, 22, c('wood', 2))
    for k in range(3): p.rect(8 + k * 5, 6 - k % 2, 6, 5, c('sand', 5 - k % 2))
    p.ellipse(26, 7, 2, 2, c('ink', 1)); p.line(27, 2, 25, 7, c('grey', 5)); p.rect(29, 6, 3, 3, c('red', 3))
    return outline(img), (18, 22)

def powderkeg():
    img = new(16, 18); p = Px(img)
    p.ellipse(8, 10, 6, 7, None, shade=lambda nx, ny: tone('wood', .55 - nx * .25, 0, 0))
    for y in (5, 10, 15): p.hline(3, 13, y, c('stone', 2))
    return outline(img), (8, 16)

def burnt():
    img = new(40, 20); p = Px(img)
    for k in range(5): p.line(3 + k * 7, 17 - k % 2 * 3, 10 + k * 6, 6 + k % 3 * 3, c('ink', 1))
    for k in range(12): p.set(4 + k * 3, 16 - k % 3, c('fire', 2 + k % 2))
    return img, (20, 17)

def factory():
    """The front of an evacuated plant: brick, tall windows, a chimney (MAP09)."""
    img = new(80, 70); p = Px(img)
    from .horde import brick
    brick(p, 2, 22, 76, 46, 'red', .45)
    for x in range(8, 72, 12):
        p.rect(x, 30, 8, 18, c('blue', 2)); p.hline(x, x + 7, 39, c('stone', 3)); p.vline(x + 4, 30, 47, c('stone', 3))
    p.rect(64, 0, 9, 24, c('red', 2)); p.hline(63, 73, 0, c('stone', 3))
    p.rect(30, 52, 20, 16, c('wood', 1)); p.poly([(2, 22), (40, 10), (78, 22)], c('stone', 2))
    return outline(img), (40, 67)

def lathe():
    img = new(34, 22); p = Px(img)
    p.rect(3, 8, 28, 5, c('stone', 3)); p.hline(3, 30, 8, c('stone', 5)); p.rect(4, 13, 4, 8, c('stone', 2)); p.rect(26, 13, 4, 8, c('stone', 2))
    p.rect(6, 3, 6, 6, c('green2', 3)); p.ellipse(18, 6, 3, 3, c('grey', 4)); p.hline(12, 24, 6, c('grey', 5))
    return outline(img), (17, 20)

def shellcrate():
    img = new(26, 18); p = Px(img)
    p.rect(2, 6, 22, 10, c('green2', 2)); p.hline(2, 23, 6, c('green2', 4))
    for k in range(4): p.rect(5 + k * 5, 2, 3, 6, c('gold', 4)); p.set(6 + k * 5, 1, c('stone', 5))
    return outline(img), (13, 16)

def loudspeaker():
    img = new(16, 46); p = Px(img)
    p.vline(7, 6, 44, c('wood', 3)); p.vline(8, 6, 44, c('wood', 2))
    p.poly([(9, 4), (15, 0), (15, 10), (9, 7)], c('grey', 4)); p.rect(6, 3, 4, 5, c('grey', 2))
    return outline(img), (8, 44)

def wagon9():
    """A railway goods wagon of the evacuation."""
    img = new(64, 34); p = Px(img)
    p.rect(2, 4, 60, 22, c('red', 2)); p.hline(2, 61, 4, c('red', 4))
    for x in range(6, 60, 6): p.vline(x, 5, 25, c('red', 1))
    p.rect(24, 8, 16, 16, c('red', 1)); p.line(24, 8, 39, 23, c('red', 3)); p.line(39, 8, 24, 23, c('red', 3))
    for x in (12, 52): p.ellipse(x, 28, 4, 4, c('stone', 2)); p.set(x, 28, c('grey', 4))
    return outline(img), (32, 31)

def poster():
    img = new(18, 30); p = Px(img)
    p.vline(3, 2, 28, c('wood', 3)); p.rect(4, 2, 12, 16, c('red', 3)); p.rect(6, 5, 8, 6, c('gold', 4)); p.hline(6, 13, 13, c('gold', 5)); p.hline(6, 11, 15, c('gold', 5))
    return outline(img), (9, 28)

def labpanel():
    """A glass wall of the Shezhire Institute with a running script of light (MAP10)."""
    img = new(48, 44); p = Px(img)
    p.rect(2, 2, 44, 40, c('blue', 1, 200)); p.rect(2, 2, 44, 2, c('cyan', 4)); p.rect(2, 40, 44, 2, c('stone', 3))
    for y in range(8, 38, 5):
        for x in range(6, 42):
            if noise2(x // 2, y, 71) > .5: p.set(x, y, c('cyan', 4, 180))
    return outline(img), (24, 42)

def server():
    img = new(20, 40); p = Px(img)
    p.rect(2, 2, 16, 36, c('stone', 1)); p.rect(3, 3, 14, 34, c('stone', 2))
    for y in range(6, 34, 4): p.hline(4, 15, y, c('stone', 3)); p.set(6, y + 1, c('cyan', 5)); p.set(9, y + 1, c('leaf', 5) if y % 8 else c('gold', 5))
    return outline(img), (10, 38)

def apple():
    """An Almaty apple tree (aport)."""
    img = new(36, 44); p = Px(img)
    p.vline(17, 24, 42, c('bark', 3)); p.vline(18, 24, 42, c('bark', 2)); p.line(18, 30, 25, 24, c('bark', 3))
    p.ellipse(18, 18, 15, 14, None, shade=lambda nx, ny: tone('leaf', .6 - nx * .2 - ny * .25, int(nx * 20), int(ny * 20)))
    for k in range(9): p.ellipse(8 + (k * 7) % 22, 10 + (k * 5) % 16, 1.5, 1.5, c('red', 4))
    return outline(img), (18, 42)

def streetlamp():
    img = new(14, 48); p = Px(img)
    p.vline(6, 8, 46, c('stone', 2)); p.vline(7, 8, 46, c('stone', 3)); p.rect(2, 4, 10, 4, c('stone', 3)); p.rect(3, 8, 8, 2, c('cyan', 5))
    return outline(img), (7, 46)

def bench():
    img = new(30, 16); p = Px(img)
    p.rect(2, 6, 26, 3, c('wood', 4)); p.rect(2, 2, 26, 2, c('wood', 3)); p.vline(4, 9, 14, c('stone', 2)); p.vline(25, 9, 14, c('stone', 2))
    return outline(img), (15, 14)

def register(add):
    add('O_TUSKIIZ', tuskiiz()); add('O_KEREGE', kerege()); add('O_SABA', saba()); add('O_KULPYTAS', kulpytas()); add('O_SABRERACK', sabrerack())
    add('O_BLOCKHOUSE', blockhouse()); add('O_WATCHTOWER', watchtower()); add('O_CANNON', cannon()); add('O_OFFICEDESK', officedesk())
    add('O_POWDERKEG', powderkeg()); add('O_BURNT', burnt())
    add('O_FACTORY', factory()); add('O_LATHE', lathe()); add('O_SHELLCRATE', shellcrate()); add('O_LOUDSPEAKER', loudspeaker())
    add('O_WAGON9', wagon9()); add('O_POSTER', poster())
    add('O_LABPANEL', labpanel()); add('O_SERVER', server()); add('O_APPLE', apple()); add('O_STREETLAMP', streetlamp()); add('O_BENCH', bench())
    for k in ICONS: add(f'I_{k}', icon(k))
