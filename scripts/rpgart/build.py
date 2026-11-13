"""Builds the MAP01 sprite atlas and the generated C++/JS descriptors.

Run:  python scripts/rpgart/build.py
Outputs:
  public/art/rpg/atlas.png   - single RGBA atlas (PNG, filter 0, decoded by src/rpg/png.js)
  src/rpg/gen/atlas.hpp      - sprite rectangles, object kinds, animation sheets
  src/rpg/gen/atlas.js       - portrait/icon rectangles for the DOM UI
"""
import math, os, sys, struct, zlib
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from rpgart.core import *
from rpgart import world as W, chars as C, chars2 as C2, bronze as B

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

sprites = []          # (name, img, (ax, ay))
def add(name, art):
    img, anchor = art if isinstance(art, tuple) else (art, (art.width // 2, art.height - 1))
    sprites.append((name, img, anchor))

# ------------------------------------------------------------ fx + icons
def fx_smoke(f):
    img = new(14, 14); p = Px(img)
    r = 3 + f * 1.2
    p.ellipse(7, 7, r, r, None, shade=lambda nx, ny: c('grey', 3 - (f > 1), int(150 - f * 30 - (nx * nx + ny * ny) * 60)))
    return img, (7, 7)

def fx_dust(f):
    img = new(10, 8); p = Px(img)
    for k in range(3):
        p.ellipse(3 + k * 2 + f * .5, 5 - f * .6, 1.5 + f * .5, 1.2 + f * .4, c('sand', 3, 170 - f * 40))
    return img, (5, 6)

def fx_spark(f):
    img = new(13, 13); p = Px(img)
    r = 2 + f * 2
    for a in range(0, 360, 45):
        x = 6 + math.cos(math.radians(a + f * 10)) * r; y = 6 + math.sin(math.radians(a + f * 10)) * r
        p.set(x, y, c('gold', 5 - f)); p.set((x + 6) / 2, (y + 6) / 2, c('gold', 4) if f < 2 else CLEAR)
    if f == 0: p.ellipse(6, 6, 2, 2, c('gold', 5))
    return img, (6, 6)

def fx_mark(f):  # Interaction marker (golden diamond).
    img = new(9, 11); p = Px(img)
    dy = [0, -1, -1, 0][f]
    p.poly([(4, 1 + dy), (8, 5 + dy), (4, 9 + dy), (0, 5 + dy)], c('gold', 4))
    p.poly([(4, 2 + dy), (6, 5 + dy), (4, 8 + dy), (2, 5 + dy)], c('gold', 5))
    return outline(img), (4, 10)

def fx_bubble(kind):
    img = new(11, 13); p = Px(img)
    p.ellipse(5, 5, 5, 5, c('grey', 5)); p.poly([(3, 9), (6, 9), (2, 12)], c('grey', 5))
    col = c('red', 3) if kind == 'alert' else c('teal', 2)
    if kind == 'alert':
        p.vline(5, 2, 6, col); p.set(5, 8, col)
    elif kind == 'talk':
        for x in (3, 5, 7): p.set(x, 5, c('ink', 1))
    else:
        p.hline(4, 6, 2, col); p.set(7, 3, col); p.set(6, 4, col); p.set(5, 5, col); p.set(5, 7, col)
    return outline(img), (5, 12)

def fx_arrow(d):
    img = new(15, 15); p = Px(img)
    a = d * math.pi / 4 - math.pi / 2
    dx, dy = math.cos(a), math.sin(a)
    for k in range(-6, 6):
        p.set(7 + dx * k, 7 + dy * k, c('wood', 4))
    p.set(7 + dx * 6, 7 + dy * 6, c('stone', 6)); p.set(7 + dx * 5, 7 + dy * 5, c('stone', 5))
    p.set(7 - dx * 6 - dy, 7 - dy * 6 + dx, c('grey', 5)); p.set(7 - dx * 6 + dy, 7 - dy * 6 - dx, c('grey', 5))
    return img, (7, 7)

def fx_leaf(f):
    img = new(5, 5); p = Px(img)
    p.set(2, 2, c('leaf', 5)); p.set(1 + f, 1, c('leaf', 4)); p.set(3 - f, 3, c('gold', 3))
    return img, (2, 2)

def fx_ring(f):
    img = new(26, 14); p = Px(img)
    for k in range(48):
        a = k / 48 * math.pi * 2
        r = 6 + f * 2
        p.set(13 + math.cos(a) * r * 1.6 / 1.3, 7 + math.sin(a) * r * .55, c('cyan', 3 if k % 2 else 4, 220 - f * 40))
    return img, (13, 7)

def icon(kind):
    img = new(16, 16); p = Px(img)
    if kind == 'sword':
        p.line(3, 12, 12, 3, c('grey', 5)); p.line(4, 12, 12, 4, c('grey', 3)); p.line(2, 10, 5, 13, c('gold', 4)); p.set(2, 13, c('wood', 3)); p.set(3, 14, c('wood', 2))
    elif kind == 'spear':
        p.line(2, 14, 12, 4, c('wood', 4)); p.poly([(11, 2), (14, 1), (13, 5), (11, 5)], c('stone', 5))
    elif kind == 'bow':
        for k in range(-6, 7): p.set(6 + (36 - k * k) * .12, 8 + k, c('wood', 4))
        p.vline(5, 2, 14, c('grey', 5))
    elif kind == 'arrows':
        for k in (-2, 0, 2):
            p.line(3 + k, 13, 12 + k, 3, c('wood', 4)); p.set(12 + k, 3, c('stone', 6)); p.set(3 + k, 13, c('grey', 5))
    elif kind == 'kit':
        p.rect(3, 5, 10, 8, c('teal', 3)); p.rect(3, 5, 10, 2, c('teal', 4)); p.rect(7, 7, 2, 5, c('grey', 5)); p.rect(5, 9, 6, 2, c('grey', 5))
    elif kind == 'herb':
        for k in range(4): p.line(8, 14, 4 + k * 3, 4 + (k % 2) * 2, c('leaf', 4 + k % 2))
        p.hline(6, 10, 12, c('hide', 3))
    elif kind == 'tool':
        p.poly([(4, 13), (6, 4), (11, 2), (12, 10), (8, 14)], None, shade=lambda x, y: tone('stone', .8 - (x - 4) / 12, x, y))
        p.line(7, 5, 10, 11, c('stone', 2))
    elif kind == 'page':
        p.poly([(3, 3), (12, 2), (13, 13), (4, 14)], None, shade=lambda x, y: tone('gold', .95 - y / 20, x, y))
        for y in (5, 8, 11): p.hline(5, 11, y, c('ochre', 2))
    elif kind == 'quiver':
        p.rect(5, 4, 6, 10, c('hide', 3)); p.vline(5, 4, 13, c('hide', 1))
        for x in (6, 8, 10): p.vline(x, 1, 4, c('wood', 4)); p.set(x, 1, c('grey', 5))
    elif kind == 'ochre':
        p.ellipse(8, 9, 5, 4, None, shade=lambda nx, ny: tone('ochre', .8 - ny * .4 - nx * .2, 0, 0))
    elif kind == 'flute':
        p.line(3, 12, 13, 4, c('bark', 5)); p.line(3, 13, 13, 5, c('bark', 3))
        for k in (5, 8, 11): p.set(k, 13 - k * .8 + 1, c('ink', 1))
    elif kind == 'crystal':
        p.poly([(8, 1), (11, 6), (9, 15), (6, 15), (5, 6)], None, shade=lambda x, y: tone('purple', .9 - (x - 5) / 8, x, y))
    elif kind == 'torch':
        p.line(5, 14, 9, 5, c('wood', 3)); p.ellipse(10, 4, 3, 3, c('fire', 3)); p.set(10, 3, c('fire', 5))
    elif kind == 'necklace':
        for k in range(9):
            a = math.pi * k / 8
            p.set(8 + math.cos(a) * 5, 5 + math.sin(a) * 6, c('bark', 5))
        p.poly([(7, 11), (9, 11), (8, 15)], c('bark', 5))
    return outline(img), (8, 15)

# ------------------------------------------------------------ registry
FRINGES = ('grass', 'steppe', 'dirt', 'sand', 'camp', 'shallow', 'ash', 'clay', 'pave')
WATER_FRINGES = ('grass', 'steppe', 'dirt', 'sand')
def register():
    for k in W.TERRAINS:
        for v in range(4):
            add(f'T_{k}_{v}', (W.texture(k, v, frame=v if k in ('water', 'shallow') else 0), (0, 0)))
    DIRS = ['n', 'e', 's', 'w', 'ne', 'se', 'sw', 'nw']
    for k in FRINGES:
        for d in DIRS:
            add(f'F_{k}_{d}', (W.fringe(k, d, False, seed=len(k)), (0, 0)))
    for k in ('grass', 'steppe', 'dirt', 'sand'):
        for d in DIRS:
            add(f'FW_{k}_{d}', (W.fringe(k, d, True, seed=len(k)), (0, 0)))
    for v in range(3):
        add(f'FACE_rock_{v}', (W.rock_face(v), (0, 0)))
        add(f'FACE_cave_{v}', (W.rock_face(v, cave=True), (0, 0)))
    for v in range(3):
        add(f'FACE_deep_{v}', (W.rock_face(v, deep=True), (0, 0)))
    # Props
    for v in range(2): add(f'O_poplar_{v}', W.tree_poplar(v))
    for v in range(2): add(f'O_birch_{v}', W.tree_birch(v))
    add('O_willow', W.tree_willow())
    for v in range(3): add(f'O_bush_{v}', W.bush(v))
    for f in range(4): add(f'O_tallgrass_{f}', W.tallgrass(f))
    for f in range(4): add(f'O_feather_{f}', W.tallgrass(f, steppe=True))
    for f in range(4): add(f'O_reeds_{f}', W.reeds(f))
    for v in range(3): add(f'O_tulips_{v}', W.tulips(v))
    for s in range(4): add(f'O_rock_{s}', W.rock(s, s))
    for s in range(4): add(f'O_crock_{s}', W.rock(s, s + 1, cave=True))
    add('O_log', W.log())
    add('O_tusk', W.bones('tusk')); add('O_skull', W.bones('skull')); add('O_ribs', W.bones('ribs'))
    for k in ('paw', 'hoof', 'human', 'drag'): add(f'O_track_{k}', W.footprint(k))
    add('O_scar', W.scar())
    add('O_tent_0', W.tent(0)); add('O_tent_1', W.tent(1)); add('O_hut', W.hut())
    add('O_firepit', W.firepit())
    for f in range(4): add(f'O_flame_{f}', W.flame(f))
    add('O_rack', W.rack()); add('O_meatrack', W.meatrack()); add('O_toolpile', W.toolpile())
    add('O_storage', W.storage()); add('O_hidemat', W.hidemat()); add('O_spearrack', W.spearrack())
    add('O_basket', W.basket()); add('O_windbreak', W.windbreak()); add('O_post', W.post()); add('O_totem', W.totem())
    add('O_cavemouth', W.cave_mouth()); add('O_boulder', W.boulder_block())
    add('O_plate_0', W.pressure_stone(False)); add('O_plate_1', W.pressure_stone(True)); add('O_lever', W.lever())
    add('O_crack', W.crack()); add('O_stalag_0', W.stalagmite(0)); add('O_stalag_1', W.stalagmite(1))
    add('O_crystal', W.crystal())
    for f in range(4): add(f'O_page_{f}', W.page_fragment(f))
    add('O_petro_0', W.petroglyph_panel(['archer', 'ibex', 'deer']))
    add('O_petro_1', W.petroglyph_panel(['sun', 'archer', 'ibex']))
    add('O_petro_2', W.petroglyph_panel(['deer', 'deer', 'archer']))
    add('O_petro_3', W.petroglyph_panel(['ibex', 'sun', 'ibex']))
    add('O_petro_z', W.petroglyph_panel(['archer', 'mark', 'ibex'], zulmat=True))
    for f in range(4): add(f'O_gate_{f}', W.gate(f))
    add('O_ctent', W.chrono_tent())
    for f in range(2): add(f'O_holo_{f}', W.holotable(f))
    for f in range(4): add(f'Z_shadow_{f}', (C.zulmat_frame(f), (16, 45)))
    # FX
    for sz, (w, h) in enumerate(((10, 4), (14, 6), (20, 7), (30, 10), (44, 14))):
        add(f'X_shadow_{sz}', (W.shadow(w, h), (w // 2, h // 2)))
    for f in range(4): add(f'X_smoke_{f}', fx_smoke(f))
    for f in range(4): add(f'X_dust_{f}', fx_dust(f))
    for f in range(3): add(f'X_spark_{f}', fx_spark(f))
    for f in range(4): add(f'X_mark_{f}', fx_mark(f))
    for k in ('alert', 'talk', 'quest'): add(f'X_bubble_{k}', fx_bubble(k))
    for d in range(8): add(f'X_arrow_{d}', fx_arrow(d))
    for f in range(2): add(f'X_leaf_{f}', fx_leaf(f))
    for f in range(3): add(f'X_ring_{f}', fx_ring(f))
    for k in ('sword', 'spear', 'bow', 'arrows', 'kit', 'herb', 'tool', 'page', 'quiver', 'ochre', 'flute', 'crystal', 'torch', 'necklace'):
        add(f'I_{k}', icon(k))
    # ---- MAP02 (bronze age)
    for v in range(2): add(f'O_dugout_{v}', B.dugout(v))
    for f in range(4): add(f'O_furnace_{f}', B.furnace(f))
    add('O_furnacecold', B.furnace(0, cold=True)); add('O_anvil', B.anvil()); add('O_bellows', B.bellows())
    add('O_mould', B.mould()); add('O_crucible', B.crucible())
    for k in ('charcoal', 'ore', 'slag'): add(f'O_{k}', B.heap(k))
    add('O_toolrack', B.toolrack())
    for v in range(3): add(f'O_jar_{v}', B.jar(v))
    add('O_grainpit', B.grainpit()); add('O_quern', B.quern())
    for v in range(2): add(f'O_fence_{v}', B.fence(v))
    for v in range(2): add(f'O_hearth_{v}', B.hearth(v))
    for f in range(4): add(f'O_hearthfire_{f}', B.hearthfire(f))
    for v in range(2): add(f'O_menhir_{v}', B.menhir(v))
    for v in range(3): add(f'O_pgstone_{v}', B.pgstone(v))
    add('O_cist', B.cist()); add('O_mausoleum', B.mausoleum()); add('O_kurgan', B.kurgan())
    for f in range(4): add(f'O_torch_{f}', B.torch(f))
    add('O_beam', B.beam())
    for v in range(4): add(f'O_mural_{v}', B.mural(v))
    for f in range(3): add(f'O_ember_{f}', B.ember(f))
    for v in range(2): add(f'O_pillar_{v}', B.pillar(v))
    for f in range(2): add(f'O_tablet_{f}', B.tablet(f))
    for v in range(2): add(f'O_trapdoor_{v}', B.trapdoor(v))
    add('O_stairs', B.stairs()); add('O_ashpile', B.ashpile()); add('O_symbol', B.symbol()); add('O_altar', B.altar())
    for v in range(2): add(f'O_deadtree_{v}', B.deadtree(v))
    add('O_brazier', B.brazier()); add('O_sheaf', B.sheaf())
    for f in range(2): add(f'X_firebolt_{f}', B.firebolt(f))
    for k in ('tablet', 'ember', 'mould', 'seal', 'bracelet'): add(f'I_{k}', B.icon(k))
    for n in C.PORTRAITS:
        add(f'P_{n}', (C.portrait(n), (0, 0)))

HUMAN_SHEETS = {
    'smith': ['idle', 'walk', 'talk', 'work'], 'matriarch': ['idle', 'walk', 'talk'], 'guard': ['idle', 'walk', 'talk', 'spear'],
    'shepherd': ['idle', 'walk', 'run', 'talk'], 'grainkeeper': ['idle', 'walk', 'talk', 'work'], 'villager': ['idle', 'walk', 'talk', 'work'],
    'villagerw': ['idle', 'walk', 'talk', 'work'], 'shade': ['idle', 'walk', 'run', 'sword', 'hurt', 'death'],
    'raider': ['idle', 'walk', 'run', 'spear', 'bow', 'hurt', 'death'],
    'aibar': ['idle', 'walk', 'run', 'sword', 'spear', 'bow', 'hurt', 'death', 'interact', 'revive', 'victory'],
    'dana': ['idle', 'walk', 'run', 'sword', 'spear', 'bow', 'hurt', 'death', 'interact', 'revive', 'victory'],
    'erlan': ['idle', 'walk', 'run', 'sword', 'spear', 'bow', 'hurt', 'death', 'interact', 'revive', 'victory'],
    'elder': ['idle', 'walk', 'talk'],
    'hunter': ['idle', 'walk', 'talk', 'sit', 'bow', 'hurt'],
    'crafter': ['idle', 'walk', 'talk', 'work'],
    'child': ['idle', 'walk', 'run', 'talk'],
    'cook': ['idle', 'walk', 'talk', 'work'],
    'scraper': ['idle', 'walk', 'talk', 'work', 'spear'],
    'stranger': ['idle', 'walk', 'run', 'spear', 'hurt', 'death'],
    'archer': ['idle', 'walk', 'run', 'bow', 'hurt', 'death'],
}
ANIMAL_SHEETS = {
    'cow': ['idle', 'walk', 'run', 'graze'], 'sheep': ['idle', 'walk', 'run', 'graze'],
    'wolf': ['idle', 'walk', 'run', 'bite', 'hurt', 'death', 'howl'],
    'saiga': ['idle', 'walk', 'run', 'graze', 'hurt', 'death'],
    'bear': ['idle', 'walk', 'charge', 'swipe', 'roar', 'hurt', 'death'],
    'hare': ['idle', 'run'],
}

def pack(items, width):
    """Shelf packer. items: list of (key, w, h). Returns {key: (x, y)}, height."""
    order = sorted(items, key=lambda t: (-t[2], -t[1]))
    pos = {}
    x = y = shelf = 0
    for key, w, h in order:
        if x + w > width:
            x = 0; y += shelf; shelf = 0
        pos[key] = (x, y)
        x += w + 1
        shelf = max(shelf, h + 1)
    return pos, y + shelf

def write_png(path, img):
    w, h = img.size
    raw = img.tobytes()
    rows = b''.join(b'\x00' + raw[y * w * 4:(y + 1) * w * 4] for y in range(h))
    def chunk(t, d): return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    data = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0)) + \
        chunk(b'IDAT', zlib.compress(rows, 9)) + chunk(b'IEND', b'')
    with open(path, 'wb') as f:
        f.write(data)

def main():
    register()
    blocks = []  # (key, img, meta)
    sheet_meta = {}
    for name, anims in HUMAN_SHEETS.items():
        for a in anims:
            n = C.FRAMES[a]
            img = new(n * 32, 5 * 32)
            for vi, v in enumerate(C.HUMAN_VIEWS):
                for f in range(n):
                    img.alpha_composite(C.human_frame(C.STYLES[name], v, a, f), (f * 32, vi * 32))
            blocks.append((('S', name, a), img))
        sheet_meta[name] = dict(cell=32, views=5, anchor=(16, 29), anims=anims)
    for sp, anims in ANIMAL_SHEETS.items():
        cell = C.SPECIES[sp]['cell']
        for a in anims:
            n = C.FRAMES[a]
            img = new(n * cell, 3 * cell)
            for vi, v in enumerate(C.ANIMAL_VIEWS):
                for f in range(n):
                    img.alpha_composite(C.animal_frame(sp, v, a, f), (f * cell, vi * cell))
            blocks.append((('S', sp, a), img))
        sheet_meta[sp] = dict(cell=cell, views=3, anchor=(cell // 2, cell - 3), anims=anims)
    for name, (cell, fn, anims) in C2.CUSTOM.items():
        for a in anims:
            n = C.FRAMES[a]
            img = new(n * cell, 3 * cell)
            for vi, v in enumerate(C.ANIMAL_VIEWS):
                for f in range(n):
                    img.alpha_composite(fn(v, a, f), (f * cell, vi * cell))
            blocks.append((('S', name, a), img))
        sheet_meta[name] = dict(cell=cell, views=3, anchor=(cell // 2, cell - 4), anims=anims)
    items = [(('P', i), s[1].width, s[1].height) for i, s in enumerate(sprites)] + [(b[0], b[1].width, b[1].height) for b in blocks]
    WIDTH = 2048
    pos, height = pack(items, WIDTH)
    height = (height + 15) // 16 * 16
    atlas = new(WIDTH, height)
    for i, (name, img, anchor) in enumerate(sprites):
        atlas.alpha_composite(img, pos[('P', i)])
    for key, img in blocks:
        atlas.alpha_composite(img, pos[key])
    os.makedirs(os.path.join(ROOT, 'public/art/rpg'), exist_ok=True)
    os.makedirs(os.path.join(ROOT, 'src/rpg/gen'), exist_ok=True)
    write_png(os.path.join(ROOT, 'public/art/rpg/atlas.png'), atlas)

    def cname(n): return n.upper().replace('-', '_')
    lines = ['// Generated by scripts/rpgart/build.py - do not edit by hand.', '#pragma once', 'namespace tj { namespace art {',
             f'constexpr int AtlasW={WIDTH}, AtlasH={height};',
             'struct Spr { short x,y,w,h,ax,ay; };', 'enum SprId {']
    lines.append(',\n'.join('  ' + cname(n) for n, _, _ in sprites) + ',\n  SprCount };')
    lines.append('constexpr Spr spr[SprCount]={')
    lines.append(',\n'.join('  {%d,%d,%d,%d,%d,%d}' % (pos[('P', i)][0], pos[('P', i)][1], img.width, img.height, a[0], a[1])
                            for i, (n, img, a) in enumerate(sprites)) + '};')
    lines.append('enum AnimId { ' + ', '.join('A_' + a.upper() for a in C.ANIMS) + ', AnimCount };')
    lines.append('constexpr unsigned char animFrames[AnimCount]={' + ','.join(str(C.FRAMES[a]) for a in C.ANIMS) + '};')
    names = list(sheet_meta)
    lines.append('enum SheetId { ' + ', '.join('SH_' + cname(n) for n in names) + ', SheetCount };')
    lines.append('struct Block { short x,y; };')
    lines.append('struct Sheet { short cell,views,ax,ay; Block anim[AnimCount]; };')
    lines.append('constexpr Sheet sheets[SheetCount]={')
    rows = []
    for n in names:
        m = sheet_meta[n]
        bl = []
        for a in C.ANIMS:
            if a in m['anims']:
                x, y = pos[('S', n, a)]
                bl.append('{%d,%d}' % (x, y))
            else:
                bl.append('{-1,-1}')
        rows.append('  {%d,%d,%d,%d,{%s}}' % (m['cell'], m['views'], m['anchor'][0], m['anchor'][1], ','.join(bl)))
    lines.append(',\n'.join(rows) + '};')
    lines.append('constexpr const char* terrainNames[]={' + ','.join('"%s"' % t for t in W.TERRAINS) + '};')
    # Terrain rules shared by every level (drawTerrain / collisions in the engine).
    idx = {n: i for i, (n, _, _) in enumerate(sprites)}
    face = {'rock': ('FACE_rock_0', 2), 'cavewall': ('FACE_cave_0', 2), 'deepwall': ('FACE_deep_0', 1)}
    lines.append('constexpr unsigned char terrainPriority[]={' + ','.join(str(W.PRIORITY.get(t, 9)) for t in W.TERRAINS) + '};')
    lines.append('constexpr unsigned char terrainSolid[]={' + ','.join('1' if t in W.SOLID else '0' for t in W.TERRAINS) + '};')
    lines.append('constexpr short terrainBase[]={' + ','.join(str(idx[f'T_{t}_0']) for t in W.TERRAINS) + '};')
    lines.append('constexpr short terrainFace[]={' + ','.join(str(idx[face[t][0]]) if t in face else '-1' for t in W.TERRAINS) + '};')
    lines.append('constexpr unsigned char terrainFaceStride[]={' + ','.join(str(face[t][1]) if t in face else '0' for t in W.TERRAINS) + '};')
    lines.append('constexpr short fringeBase[]={' + ','.join(str(idx[f'F_{t}_n']) if t in FRINGES else '-1' for t in W.TERRAINS) + '};')
    lines.append('constexpr short fringeWaterBase[]={' + ','.join(str(idx[f'FW_{t}_n']) if t in WATER_FRINGES else '-1' for t in W.TERRAINS) + '};')
    lines.append('constexpr unsigned char terrainWet[]={' + ','.join('1' if t in ('water', 'shallow') else '0' for t in W.TERRAINS) + '};')
    lines.append('constexpr unsigned char terrainAnimated[]={' + ','.join('1' if t in ('water', 'shallow') else '0' for t in W.TERRAINS) + '};')
    lines.append('}}')
    with open(os.path.join(ROOT, 'src/rpg/gen/atlas.hpp'), 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines) + '\n')
    js = {n[2:].lower(): [pos[('P', i)][0], pos[('P', i)][1], img.width, img.height]
          for i, (n, img, a) in enumerate(sprites) if n.startswith('P_') or n.startswith('I_')}
    import json
    with open(os.path.join(ROOT, 'src/rpg/gen/atlas.js'), 'w', encoding='utf-8') as f:
        f.write('// Generated by scripts/rpgart/build.py - do not edit by hand.\n')
        f.write(f'export const ATLAS_SIZE = [{WIDTH}, {height}];\n')
        f.write('export const ATLAS_RECTS = ' + json.dumps(js, separators=(',', ':')) + ';\n')
        f.write('export const ANIMS = ' + json.dumps(C.ANIMS) + ';\n')
        f.write('export const SHEETS = ' + json.dumps(names) + ';\n')
    print(f'atlas {WIDTH}x{height}, {len(sprites)} sprites, {len(blocks)} animation blocks')

if __name__ == '__main__':
    main()
