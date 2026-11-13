"""Shared level description + C++/JS emitter for every epoch map.

A level script (map01.py, map02.py, ...) fills a Level and calls write(). The engine is data-driven:
lights, flames, cover, plates, colliders, area lighting, zone particles, NPC roles, pickups and the
enemy sprite sheets all come from the generated header, so a new epoch needs no engine branch.
"""
import json, os
from rpgart import world as W

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
TS = 16
# Kind flags (mirrored in src/rpg/world.hpp)
DECAL, LIGHT, TALL, COVER, FLAME, PLATE, TALLBOX, FLICKER = 1, 2, 4, 8, 16, 32, 64, 128
FIRE = (250, 150, 60, 78, 8)
# name: sprite base, frames, anim (0 static/variants, 1 sway, 2 fast loop, 3 slow loop), collider (hw, hh)
#        or per-variant sizes, flags, light (r, g, b, radius, y-offset)
KINDS = {
    # ---- MAP01 (stone age)
    'poplar': ('O_POPLAR_0', 2, 0, (4, 3), TALL), 'birch': ('O_BIRCH_0', 2, 0, (3, 2), TALL), 'willow': ('O_WILLOW', 1, 0, (4, 3), TALL),
    'bush': ('O_BUSH_0', 3, 0, (7, 4), 0), 'tallgrass': ('O_TALLGRASS_0', 4, 1, (0, 0), COVER), 'feather': ('O_FEATHER_0', 4, 1, (0, 0), COVER),
    'reeds': ('O_REEDS_0', 4, 1, (0, 0), COVER), 'tulips': ('O_TULIPS_0', 3, 0, (0, 0), DECAL),
    'rock': ('O_ROCK_0', 4, 0, [(0, 0), (7, 4), (13, 5), (22, 8)], 0), 'crock': ('O_CROCK_0', 4, 0, [(0, 0), (7, 4), (13, 5), (22, 8)], 0),
    'log': ('O_LOG', 1, 0, (12, 3), 0), 'tusk': ('O_TUSK', 1, 0, (0, 0), DECAL), 'skull': ('O_SKULL', 1, 0, (0, 0), DECAL),
    'ribs': ('O_RIBS', 1, 0, (0, 0), DECAL), 'track': ('O_TRACK_PAW', 4, 0, (0, 0), DECAL), 'scar': ('O_SCAR', 1, 0, (0, 0), DECAL),
    'tent': ('O_TENT_0', 2, 0, (20, 7), TALLBOX), 'hut': ('O_HUT', 1, 0, (24, 6), TALLBOX),
    'firepit': ('O_FIREPIT', 1, 0, (8, 4), LIGHT | FLAME | FLICKER, FIRE), 'rack': ('O_RACK', 1, 0, (15, 3), 0),
    'meatrack': ('O_MEATRACK', 1, 0, (10, 3), 0), 'toolpile': ('O_TOOLPILE', 1, 0, (0, 0), DECAL), 'storage': ('O_STORAGE', 1, 0, (9, 4), 0),
    'hidemat': ('O_HIDEMAT', 1, 0, (0, 0), DECAL), 'spearrack': ('O_SPEARRACK', 1, 0, (10, 3), 0), 'basket': ('O_BASKET', 1, 0, (4, 3), 0),
    'windbreak': ('O_WINDBREAK', 1, 0, (16, 3), 0), 'post': ('O_POST', 1, 0, (3, 3), 0), 'totem': ('O_TOTEM', 1, 0, (4, 3), 0),
    'cavemouth': ('O_CAVEMOUTH', 1, 0, (0, 0), 0), 'boulder': ('O_BOULDER', 1, 0, (22, 8), 0), 'plate': ('O_PLATE_0', 2, 0, (0, 0), DECAL | PLATE),
    'lever': ('O_LEVER', 1, 0, (4, 3), 0), 'crack': ('O_CRACK', 1, 0, (0, 0), 0), 'stalag': ('O_STALAG_0', 2, 0, (4, 3), 0),
    'crystal': ('O_CRYSTAL', 1, 2, (3, 2), LIGHT, (120, 50, 170, 30, 6)), 'page': ('O_PAGE_0', 4, 2, (0, 0), LIGHT, (200, 170, 70, 44, 6)),
    'petro': ('O_PETRO_0', 5, 0, (18, 4), 0), 'gate': ('O_GATE_0', 4, 2, (0, 0), LIGHT, (60, 190, 200, 70, 26)),
    'ctent': ('O_CTENT', 1, 0, (20, 6), TALLBOX), 'holo': ('O_HOLO_0', 2, 3, (9, 4), LIGHT, (50, 160, 170, 34, 10)),
    'cfire': ('O_FIREPIT', 1, 0, (8, 4), LIGHT | FLAME | FLICKER, FIRE),
    # ---- MAP02 (bronze age)
    'dugout': ('O_DUGOUT_0', 2, 0, (28, 8), TALLBOX), 'furnace': ('O_FURNACE_0', 4, 2, (8, 5), LIGHT | FLICKER, (255, 120, 40, 64, 12)),
    'furnacecold': ('O_FURNACECOLD', 1, 0, (8, 5), 0), 'anvil': ('O_ANVIL', 1, 0, (8, 4), 0), 'bellows': ('O_BELLOWS', 1, 0, (6, 3), 0),
    'mould': ('O_MOULD', 1, 0, (0, 0), DECAL), 'crucible': ('O_CRUCIBLE', 1, 0, (0, 0), DECAL), 'charcoal': ('O_CHARCOAL', 1, 0, (9, 4), 0),
    'ore': ('O_ORE', 1, 0, (8, 4), 0), 'slag': ('O_SLAG', 1, 0, (0, 0), DECAL), 'toolrack': ('O_TOOLRACK', 1, 0, (12, 3), 0),
    'jar': ('O_JAR_0', 3, 0, (5, 3), 0), 'grainpit': ('O_GRAINPIT', 1, 0, (9, 4), 0), 'quern': ('O_QUERN', 1, 0, (6, 3), 0),
    'fence': ('O_FENCE_0', 2, 0, (16, 3), 0), 'hearth': ('O_HEARTH_0', 2, 0, (18, 7), 0),
    'hearthfire': ('O_HEARTHFIRE_0', 4, 2, (0, 0), LIGHT | FLICKER, (255, 170, 70, 120, 18)),
    'menhir': ('O_MENHIR_0', 2, 0, (5, 3), TALL), 'pgstone': ('O_PGSTONE_0', 3, 0, (12, 4), 0), 'cist': ('O_CIST', 1, 0, (16, 6), 0),
    'mausoleum': ('O_MAUSOLEUM', 1, 0, (30, 10), TALLBOX), 'kurgan': ('O_KURGAN', 1, 0, (30, 8), 0), 'torch': ('O_TORCH_0', 4, 2, (2, 2), LIGHT | FLICKER, (255, 160, 70, 52, 22)),
    'beam': ('O_BEAM', 1, 0, (4, 3), TALL), 'mural': ('O_MURAL_0', 4, 0, (24, 5), 0), 'ember': ('O_EMBER_0', 3, 2, (0, 0), DECAL | LIGHT, (220, 90, 40, 26, 2)),
    'pillar': ('O_PILLAR_0', 2, 0, (7, 4), 0), 'tablet': ('O_TABLET_0', 2, 3, (5, 3), LIGHT, (220, 170, 90, 40, 10)),
    'trapdoor': ('O_TRAPDOOR_0', 2, 0, (0, 0), DECAL), 'stairs': ('O_STAIRS', 1, 0, (0, 0), DECAL), 'ashpile': ('O_ASHPILE', 1, 0, (0, 0), DECAL),
    'symbol': ('O_SYMBOL', 1, 0, (0, 0), DECAL), 'altar': ('O_ALTAR', 1, 0, (12, 5), 0), 'deadtree': ('O_DEADTREE_0', 2, 0, (3, 2), TALL),
    'brazier': ('O_BRAZIER', 1, 0, (5, 3), LIGHT | FLAME | FLICKER, (250, 140, 60, 60, 12)), 'sheaf': ('O_SHEAF', 1, 1, (3, 2), 0),
}

class Level:
    def __init__(self, name, w, h, terrain='steppe'):
        self.name, self.w, self.h = name, w, h
        self.T = {k: i for i, k in enumerate(W.TERRAINS)}
        self.grid = [[self.T[terrain]] * w for _ in range(h)]
        self.zone = [[0] * w for _ in range(h)]
        self.objects, self.tags, self.tag_hidden = [], ['none'], set()
        self.interacts, self.triggers, self.npcs, self.animals, self.enemies, self.pickups = [], [], [], [], [], []
        self.areas, self.zone_area, self.zone_fx, self.enemy_sheets, self.teleports = [], [], [], {}, []
        self.spawn = (0, 0)
    # terrain helpers
    def set(self, x, y, t):
        if 0 <= x < self.w and 0 <= y < self.h: self.grid[y][x] = self.T[t]
    def get(self, x, y):
        return self.grid[y][x] if 0 <= x < self.w and 0 <= y < self.h else self.T['rock']
    def fill(self, x0, y0, x1, y1, t):
        for y in range(y0, y1):
            for x in range(x0, x1): self.set(x, y, t)
    def zone_rect(self, x0, y0, x1, y1, z):
        for y in range(max(0, y0), min(self.h, y1)):
            for x in range(max(0, x0), min(self.w, x1)): self.zone[y][x] = z
    def tag(self, name, hidden=False):
        if name not in self.tags: self.tags.append(name)
        if hidden: self.tag_hidden.add(name)
        return self.tags.index(name)
    def obj(self, kind, x, y, variant=0, tag=0):
        assert kind in KINDS, kind
        self.objects.append((kind, int(x), int(y), variant, tag))
    def interact(self, key, x, y, r=22, tag=0):
        assert key not in [i[0] for i in self.interacts], key
        self.interacts.append((key, int(x), int(y), r, tag))
    def trigger(self, key, x0, y0, x1, y1):
        self.triggers.append((key, int(x0 * TS), int(y0 * TS), int(x1 * TS), int(y1 * TS)))
    def npc(self, key, sheet, x, y, ways, inactive=False, runner=False):
        """ways: (x, y, wait, anim[, facing])"""
        self.npcs.append((key, sheet, x, y, ways, (1 if inactive else 0) | (2 if runner else 0)))
    def area(self, name, x0, y0, x1, y1, dark=None, outdoor=True):
        """dark: ambient (r, g, b) used instead of the story light, with the player's torch."""
        self.areas.append((name, x0, y0, x1, y1, dark, outdoor))

    def write(self):
        L = self
        used = [k for k in KINDS if any(o[0] == k for o in L.objects)]
        kid = {k: i for i, k in enumerate(used)}
        lines = [f'// Generated by scripts/rpgart/{L.name}.py - do not edit by hand.', '#pragma once', 'namespace tj { namespace level {',
                 f'constexpr int MapW={L.w}, MapH={L.h};',
                 'enum TerrainId { ' + ', '.join('TR_' + t.upper() for t in W.TERRAINS) + ', TerrainCount };']
        terr = ''.join(''.join(chr(48 + L.grid[y][x]) for x in range(L.w)) for y in range(L.h))
        zon = ''.join(''.join(chr(48 + L.zone[y][x]) for x in range(L.w)) for y in range(L.h))
        for name, s in (('terrain', terr), ('zones', zon)):
            lines.append(f'constexpr const char {name}[]=')
            for y in range(L.h): lines.append('  "' + s[y * L.w:(y + 1) * L.w].replace('\\', '\\\\').replace('"', '\\"') + '"')
            lines.append(';')
        lines.append('struct Area { short x0,y0,x1,y1; unsigned char dark,outdoor,r,g,b; };')
        lines.append('constexpr Area areas[]={' + ','.join('{%d,%d,%d,%d,%d,%d,%d,%d,%d}' % (a[1] * TS, a[2] * TS, a[3] * TS, a[4] * TS, 1 if a[5] else 0, 1 if a[6] else 0, *(a[5] or (200, 200, 200))) for a in L.areas) + '};')
        lines.append(f'constexpr int ZoneCount={len(L.zone_area)};')
        lines.append('constexpr unsigned char areaOfZone[ZoneCount]={' + ','.join(map(str, L.zone_area)) + '};')
        lines.append('constexpr unsigned char zoneFx[ZoneCount]={' + ','.join(map(str, L.zone_fx)) + '}; // 1 leaves, 2 drips, 4 ash, 8 embers')
        lines.append('enum KindId { ' + ', '.join('K_' + k.upper() for k in used) + ', KindCount };')
        lines.append('struct Kind { short sprite,frames,anim,flags; unsigned char lr,lg,lb,lrad,ly; };')
        rows = []
        for k in used:
            d = KINDS[k]; light = d[5] if len(d) > 5 else (0, 0, 0, 0, 0)
            rows.append('{art::%s,%d,%d,%d,%d,%d,%d,%d,%d}' % (d[0], d[1], d[2], d[4], *light))
        lines.append('constexpr Kind kinds[KindCount]={' + ','.join(rows) + '};')
        lines.append('enum TagId { ' + ', '.join('TAG_' + t.upper() for t in L.tags) + ', TagCount };')
        lines.append('constexpr unsigned char tagHidden[TagCount]={' + ','.join('1' if t in L.tag_hidden else '0' for t in L.tags) + '};')
        objs = sorted(L.objects, key=lambda o: o[2])
        lines.append('struct Obj { unsigned char kind,variant,tag; short x,y; unsigned char hw,hh; };')
        lines.append(f'constexpr int ObjCount={len(objs)};')
        orows = []
        for k, x, y, v, t in objs:
            c = KINDS[k][3]; hw, hh = (c[min(v, len(c) - 1)] if isinstance(c, list) else c)
            orows.append('{%d,%d,%d,%d,%d,%d,%d}' % (kid[k], v, t, x, y, hw, hh))
        lines.append('constexpr Obj objs[ObjCount]={' + ','.join(orows) + '};')
        lines.append('struct IaDef { short x,y,r; unsigned char tag; };')
        lines.append('enum InteractId { ' + ', '.join('IA_' + i[0].upper() for i in L.interacts) + ', InteractCount };')
        lines.append('constexpr IaDef interacts[InteractCount]={' + ','.join('{%d,%d,%d,%d}' % (i[1], i[2], i[3], i[4]) for i in L.interacts) + '};')
        lines.append('struct Trigger { short x0,y0,x1,y1; };')
        lines.append('enum TriggerId { ' + ', '.join('TG_' + t[0].upper() for t in L.triggers) + ', TriggerCount };')
        lines.append('constexpr Trigger triggers[TriggerCount]={' + ','.join('{%d,%d,%d,%d}' % t[1:] for t in L.triggers) + '};')
        lines.append('struct Way { short x,y,wait; unsigned char anim; signed char facing; };')
        lines.append('struct NpcDef { unsigned char sheet,ways,flags; short x,y; Way way[6]; }; // flags: 1 inactive at start, 2 runner')
        lines.append('enum NpcId { ' + ', '.join('NPC_' + n[0].upper() for n in L.npcs) + ', NpcCount };')
        rows = []
        for key, sheet, x, y, ways, fl in L.npcs:
            assert len(ways) <= 6
            wl = ','.join('{%d,%d,%d,art::A_%s,%d}' % (w[0] * TS, w[1] * TS, w[2], w[3].upper(), w[4] if len(w) > 4 else -1) for w in ways)
            rows.append('{art::SH_%s,%d,%d,%d,%d,{%s}}' % (sheet, len(ways), fl, x * TS, y * TS, wl))
        lines.append('constexpr NpcDef npcDefs[NpcCount]={' + ','.join(rows) + '};')
        lines.append('struct AnimalDef { unsigned char sheet; short x,y; };')
        lines.append(f'constexpr int AnimalCount={len(L.animals)};')
        lines.append('constexpr AnimalDef animalDefs[AnimalCount>0?AnimalCount:1]={' + (','.join('{art::SH_%s,%d,%d}' % (s, x * TS, y * TS) for s, x, y in L.animals) or '{0,0,0}') + '};')
        lines.append('struct EnemyDef { unsigned char type,group; short x,y; };')
        lines.append(f'constexpr int EnemyCount={len(L.enemies)};')
        lines.append('constexpr EnemyDef enemyDefs[EnemyCount]={' + ','.join('{%d,%d,%d,%d}' % (t, g, x * TS, y * TS) for t, x, y, g in L.enemies) + '};')
        # Sprite sheet per enemy type: wolf, stranger, archer, bear, shade, wraith, keeper
        es = [L.enemy_sheets.get(i, 'WOLF') for i in range(7)]
        lines.append('constexpr unsigned char enemySheet[7]={' + ','.join('art::SH_' + s for s in es) + '};')
        lines.append('struct PickupDef { short item,qty,x,y; };')
        lines.append(f'constexpr int PickupDefCount={len(L.pickups)};')
        lines.append('constexpr PickupDef pickupDefs[PickupDefCount>0?PickupDefCount:1]={' + (','.join('{%d,%d,%d,%d}' % (i, q, x * TS, y * TS) for i, q, x, y in L.pickups) or '{0,0,0,0}') + '};')
        lines.append(f'constexpr int SpawnX={int(L.spawn[0] * TS)}, SpawnY={int(L.spawn[1] * TS)};')
        lines.append('}}')
        with open(os.path.join(ROOT, f'src/rpg/gen/{L.name}.hpp'), 'w', encoding='utf-8') as f:
            f.write('\n'.join(lines) + '\n')
        meta = dict(size=[L.w, L.h], tile=TS, areas={a[0]: list(a[1:5]) for a in L.areas}, interacts=[i[0] for i in L.interacts],
                    triggers=[t[0] for t in L.triggers], npcs=[n[0] for n in L.npcs], tags=L.tags,
                    teleports=L.teleports, enemies=[dict(type=t, group=g) for t, x, y, g in L.enemies],
                    interactPos={i[0]: [i[1], i[2]] for i in L.interacts}, npcPos={n[0]: [n[2] * TS, n[3] * TS] for n in L.npcs})
        with open(os.path.join(ROOT, f'src/rpg/gen/{L.name}.js'), 'w', encoding='utf-8') as f:
            f.write(f'// Generated by scripts/rpgart/{L.name}.py - do not edit by hand.\n')
            f.write(f'export const {L.name.upper()} = ' + json.dumps(meta, ensure_ascii=False, separators=(',', ':')) + ';\n')
        print(f'{L.name} {L.w}x{L.h}: {len(objs)} objects, {len(L.interacts)} interactables, {len(L.triggers)} triggers, {len(L.npcs)} npcs, {len(L.enemies)} enemies')
