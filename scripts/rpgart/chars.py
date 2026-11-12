"""Animated character sheets (humans and animals) and dialogue portraits.

Humans are drawn in five views (S, SE, E, NE, N); the engine mirrors SE/E/NE for
the three western headings, which gives full 8-direction sprites.
Animals use three views (S, E, N); diagonals use the side view.
"""
import math
from .core import *

HUMAN_VIEWS = ['s', 'se', 'e', 'ne', 'n']
ANIMAL_VIEWS = ['s', 'e', 'n']
# Animation ids are shared with the engine (src/rpg/atlas.hpp mirrors this order).
ANIMS = ['idle', 'walk', 'run', 'sword', 'spear', 'bow', 'hurt', 'death', 'interact', 'revive', 'victory',
         'work', 'talk', 'sit', 'bite', 'howl', 'graze', 'swipe', 'roar', 'charge']
FRAMES = {'idle': 4, 'walk': 6, 'run': 6, 'sword': 4, 'spear': 4, 'bow': 4, 'hurt': 2, 'death': 4, 'interact': 3,
          'revive': 2, 'victory': 3, 'work': 4, 'talk': 2, 'sit': 2, 'bite': 4, 'howl': 2, 'graze': 2, 'swipe': 4,
          'roar': 2, 'charge': 4}
FWD = {'s': (0, 1), 'se': (.8, .55), 'e': (1, 0), 'ne': (.8, -.55), 'n': (0, -1)}

# ------------------------------------------------------------------ styles
STYLES = {
    'aibar': dict(skin='skin', hair='hair', hairstyle='short', top='teal', topkind='jacket', trim='gold',
                  legs='blue', legshade=0, boots='wood', scarf='scarf', device=True, pack='quiver'),
    'dana': dict(skin='skin2', hair='hair', hairstyle='bun', top='blue', topkind='jacket', trim='cyan',
                 legs='ink', legshade=1, boots='wood', scarf='gold', device=True, pack='satchel'),
    'erlan': dict(skin='skin', hair='hair', hairstyle='crop', top='ochre', topkind='jacket', trim='teal',
                  legs='blue', legshade=0, boots='stone', scarf='teal', device=True, pack='quiver'),
    'elder': dict(skin='skin2', hair='grey', hairstyle='long', top='fur', topkind='cloak', trim='bark',
                  legs='hide', legshade=1, boots='hide', beard='grey', staff=True, necklace=True, stoop=1),
    'hunter': dict(skin='skin', hair='black', hairstyle='tail', top='hide', topkind='tunic', trim='ochre',
                   legs='hide', legshade=0, boots='fur', headband='ochre', pack='bowback', bare_arms=True),
    'crafter': dict(skin='skin2', hair='black', hairstyle='crop', top='warmstone', topkind='apron', trim='hide',
                    legs='hide', legshade=1, boots='fur', beard='black', bare_arms=True, build='broad'),
    'child': dict(skin='skin', hair='black', hairstyle='messy', top='fur', topkind='tunic', trim='ochre',
                  legs='skin', legshade=2, boots='fur', build='child', feather=True),
    'cook': dict(skin='skin2', hair='black', hairstyle='braid', top='hide', topkind='dress', trim='ochre',
                 legs='hide', legshade=0, boots='fur', necklace=True),
    'scraper': dict(skin='skin', hair='black', hairstyle='long', top='fur', topkind='tunic', trim='bark',
                    legs='hide', legshade=1, boots='fur', beard='black', bare_arms=True),
    'stranger': dict(skin='skin2', hair='black', hairstyle='hood', top='wolf', topkind='tunic', trim='red',
                     legs='fur', legshade=0, boots='fur', paint=True, bare_arms=True),
    'archer': dict(skin='skin2', hair='black', hairstyle='hood', top='fur', topkind='tunic', trim='red',
                   legs='wolf', legshade=1, boots='fur', paint=True, pack='bowback'),
}

def body_dims(style):
    if style.get('build') == 'child':
        return dict(feet=29, hip=23, sh=18, head=13.5, hr=3.6, tw=7, sw=4)
    broad = style.get('build') == 'broad'
    return dict(feet=29, hip=21, sh=14, head=9, hr=4.1, tw=10 if broad else 9, sw=6 if broad else 5)

# ------------------------------------------------------------------ poses
def pose_for(anim, f, n):
    """Return pose parameters. legs/arms: (forward, lift/up). weapon: (kind, phase)."""
    t = f / n
    P = dict(bob=0, lean=0, legs=[(0, 0), (0, 0)], arms=[(0, 0), (0, 0)], weapon=None, kneel=0, lie=0,
             headdy=0, flash=False, bowdraw=0)
    s = math.sin(t * math.pi * 2)
    if anim == 'idle':
        P['bob'] = 1 if f in (1, 2) else 0
        P['arms'] = [(0, .05 * (f % 2)), (0, .05 * (f % 2))]
    elif anim == 'walk':
        P['legs'] = [(s * 1.0, max(0, math.cos(t * math.pi * 2)) * .8), (-s * 1.0, max(0, -math.cos(t * math.pi * 2)) * .8)]
        P['arms'] = [(-s * .7, 0), (s * .7, 0)]
        P['bob'] = 1 if f in (1, 4) else 0
    elif anim == 'run':
        P['legs'] = [(s * 1.6, max(0, math.cos(t * math.pi * 2)) * 1.5), (-s * 1.6, max(0, -math.cos(t * math.pi * 2)) * 1.5)]
        P['arms'] = [(-s * 1.1, .6), (s * 1.1, .6)]
        P['bob'] = 1 if f in (0, 3) else 0
        P['lean'] = 1
    elif anim == 'sword':
        P['arms'] = [(.3, .2), [(-.6, 1.9), (1.4, 1.0), (1.6, -.1), (.6, .2)][f]]
        P['weapon'] = ('sword', f)
        P['lean'] = [0, 1, 1, 0][f]
        P['legs'] = [(.6, 0), (-.4, 0)]
    elif anim == 'spear':
        P['arms'] = [[(.2, .8), (.9, .8), (1.0, .8), (.5, .8)][f], [(-.9, .7), (1.8, .7), (2.0, .7), (.4, .7)][f]]
        P['weapon'] = ('spear', f)
        P['lean'] = [0, 1, 1, 0][f]
        P['legs'] = [(.8, 0), (-.5, 0)]
    elif anim == 'bow':
        P['arms'] = [(1.5, 1.0), [(.6, 1.0), (-.6, 1.0), (-.8, 1.0), (.3, .6)][f]]
        P['weapon'] = ('bow', f)
        P['bowdraw'] = [0, 1, 2, 0][f]
        P['legs'] = [(.5, 0), (-.5, 0)]
    elif anim == 'hurt':
        P['lean'] = -1; P['arms'] = [(-.5, .8), (-.5, .8)]; P['headdy'] = -1 if f == 0 else 0
        P['flash'] = f == 0
    elif anim == 'death':
        P['kneel'] = [0, 1, 2, 2][f]; P['lie'] = [0, 0, 1, 2][f]
        P['arms'] = [(-.3, .6), (-.3, .6)]
    elif anim == 'interact':
        P['arms'] = [(.2, 0), [(.6, .3), (1.4, .5), (1.2, .2)][f]]
        P['lean'] = 1 if f else 0
    elif anim == 'revive':
        P['kneel'] = 1; P['arms'] = [(1.2, -.2 + f * .3), (1.2, -.2 + f * .3)]
    elif anim == 'victory':
        P['arms'] = [(0, 0), [(0, 1.4), (.1, 2.3), (.1, 2.3)][f]]
        P['bob'] = [0, 1, 0][f]
        P['weapon'] = ('page', f) if f else None
    elif anim == 'work':
        P['arms'] = [(.8, .3), [(.9, 1.4), (1.1, .2), (1.0, -.1), (.9, .7)][f]]
        P['lean'] = 1; P['weapon'] = ('stone', f)
    elif anim == 'talk':
        P['arms'] = [(0, 0), [(.6, .9), (.9, 1.2)][f]]
        P['bob'] = f
    elif anim == 'sit':
        P['kneel'] = 2; P['arms'] = [(-.6, .2), (-.6, .2)]; P['bob'] = f
    return P

# ------------------------------------------------------------------ human
def human_frame(style, view, anim, f):
    n = FRAMES[anim]
    P = pose_for(anim, f, n)
    D = body_dims(style)
    img = new(32, 32); p = Px(img)
    fx, fy = FWD[view]
    cx = 16
    kneel = P['kneel']
    drop = kneel * 2 + (1 if P['bob'] else 0)
    lean = P['lean'] + (style.get('stoop', 0) if view in ('se', 'e', 'ne') else 0)
    leanx, leany = fx * lean, fy * lean * .5
    hip = D['hip'] + drop
    sh = D['sh'] + drop
    head = D['head'] + drop + P['headdy']
    feet = D['feet']
    side = view in ('e', 'se', 'ne')
    back = view in ('n', 'ne')
    sk = style['skin']
    top = style['top']
    trim = style.get('trim', 'gold')

    if P['lie'] >= 2:
        return lying(style, view)

    def shade(ramp, base, x, y, side_bias=0):
        v = base + side_bias
        return tone(ramp, v, x, y)

    # Horizontal layout per view.
    if view in ('s', 'n'):
        hips = [cx - 2, cx + 2]; shoulders = [cx - D['sw'], cx + D['sw']]
    elif view in ('se', 'ne'):
        hips = [cx - 1, cx + 2]; shoulders = [cx - D['sw'] + 2, cx + D['sw']]
    else:
        hips = [cx, cx]; shoulders = [cx, cx + 1]

    def leg(i, near=True):
        fwd, lift = P['legs'][i]
        if kneel:
            fwd, lift = (1.0, 0) if i == 0 else (-.4, 2)
        hx = hips[i] + leanx * .3
        footx = hx + fx * fwd * 2.2 + (0 if view in ('s', 'n') else 0)
        footy = feet - lift - (kneel * 1 if i == 1 else 0) + fy * fwd * .9
        if view in ('s', 'n'):
            footy = feet - lift + (fy * fwd * .8)
        ramp = style['legs']
        w = 3 if style.get('build') != 'child' else 2
        steps = max(1, int(abs(footy - hip)))
        for k in range(steps + 1):
            tt = k / steps
            x = hx + (footx - hx) * tt
            y = hip + (footy - hip) * tt
            for dx in range(w):
                light = .55 - dx * .18 - (0 if near else .2) - style.get('legshade', 0) * .08
                p.set(x - w // 2 + dx, y, tone(ramp, light, int(x) + dx, int(y)))
        # Foot / boot.
        b = style['boots']
        bx = footx + (fx * 1 if side else 0)
        for dx in range(-1, 2 + (1 if side else 0)):
            p.set(bx + dx - (1 if side else 0), footy, c(b, 2 if near else 1))
        p.set(bx - 1 + (1 if side else 0), footy - 1, c(b, 3 if near else 2))

    def torso():
        tw = D['tw'] if view in ('s', 'n') else (D['tw'] - 2 if view in ('se', 'ne') else D['tw'] - 3)
        x0 = cx - tw / 2 + leanx + (1 if view in ('se', 'ne') else 0) * .5
        kind = style['topkind']
        for y in range(int(sh), int(hip) + (3 if kind in ('dress', 'cloak', 'tunic', 'apron') else 1)):
            t = (y - sh) / max(1, hip - sh)
            ww = tw - (1 if t > .55 and kind == 'jacket' else 0) + (2 if kind in ('dress', 'cloak') and t > .7 else 0)
            xs = x0 + (tw - ww) / 2
            for x in range(int(xs), int(xs + ww)):
                u = (x - xs) / max(1, ww)
                light = .66 - u * .38 - t * .12
                if view == 'se': light -= max(0, .5 - u) * .1
                if back: light -= .08
                p.set(x, y, tone(top, light, x, y))
        # Belt / hem / trims.
        yb = int(hip) - 1
        if kind == 'jacket':
            for x in range(int(x0) + 1, int(x0 + tw) - 1):
                p.set(x, yb, c(trim, 3 if x % 3 else 4))
            if not back:  # Zip line + collar
                zx = int(cx + leanx + (1 if view == 'se' else 2 if view == 'e' else 0))
                for y in range(int(sh) + 1, yb):
                    p.set(zx, y, c(top, 0))
        elif kind == 'apron':
            if not back:
                p.rect(int(cx - 2 + leanx), int(sh) + 2, 5, int(hip - sh), c('hide', 2))
                p.hline(int(cx - 2 + leanx), int(cx + 2 + leanx), int(sh) + 2, c('hide', 4))
        elif kind == 'cloak':
            for x in range(int(x0) - 1, int(x0 + tw) + 1):
                p.set(x, int(sh), c('fur', 5)); p.set(x, int(sh) + 1, c('fur', 4))
        else:
            for x in range(int(x0), int(x0 + tw)):
                if x % 2: p.set(x, int(hip) + 1, c(trim, 3))
        if style.get('necklace') and not back:
            for i, x in enumerate(range(int(cx - 2 + leanx), int(cx + 3 + leanx))):
                p.set(x, int(sh) + 1 + (1 if 0 < i < 4 else 0), c('bark', 5))
        if style.get('pack') == 'quiver':
            if back:
                p.rect(int(cx + 1 + leanx), int(sh) - 1, 3, 8, c('wood', 3)); p.vline(int(cx + 1 + leanx), int(sh) - 1, int(sh) + 6, c('wood', 1))
                for k in range(3): p.set(int(cx + 1 + k + leanx), int(sh) - 2, c('grey', 4))
            elif view == 's':
                p.line(cx - 3, sh, cx + 3, hip - 2, c('wood', 2))
        if style.get('pack') == 'bowback' and back:
            for k in range(9):
                p.set(int(cx - 3 + k * .7 + leanx), int(sh + k - (abs(k - 4) * .6)), c('wood', 3))
        if style.get('pack') == 'satchel' and view in ('s', 'se', 'e'):
            p.rect(int(cx + 2 + leanx), int(hip) - 3, 3, 3, c('hide', 3))
        if style.get('paint') and not back:
            pass

    def arm(i, near=True):
        f_, up = P['arms'][i]
        sx = shoulders[i] + leanx
        sy = sh + 1 + leany
        ox, oy = fx * f_ * 3.4, fy * f_ * 1.6
        hx = sx + ox + (0 if side else (-1 if i == 0 else 1) * (0 if up > .5 else 0))
        hy = sy + 6 - up * 4.6 + oy
        if view in ('s', 'n') and up > .5:
            hx += (-1 if i == 0 else 1) * up * .6
        ramp = sk if style.get('bare_arms') else style['top']
        steps = max(1, int(max(abs(hx - sx), abs(hy - sy))))
        for k in range(steps + 1):
            tt = k / steps
            x = sx + (hx - sx) * tt; y = sy + (hy - sy) * tt
            col = tone(ramp, .55 - (0 if near else .2), int(x), int(y))
            p.set(x, y, col)
            if style.get('build') != 'child':
                p.set(x + (1 if i == 1 or side else -1) * (1 if view in ('s', 'n') else 0), y, tone(ramp, .4 - (0 if near else .2), int(x), int(y)))
        p.set(hx, hy, c(sk, 3 if near else 2)); p.set(hx, hy + 1, c(sk, 2))
        if style.get('device') and i == 0 and not back:
            p.set(sx + (hx - sx) * .8, sy + (hy - sy) * .8, c('cyan', 3))
        return hx, hy

    def headf():
        hx = cx + leanx * 1.2 + (1 if view in ('se', 'ne') else 1 if view == 'e' else 0) * .6
        hy = head + leany
        r = D['hr']
        hs = style['hairstyle']
        hr = style['hair']
        # Neck
        p.rect(int(hx) - 1, int(hy + r - 1), 2, 2, c(sk, 2))
        # Skull
        p.ellipse(hx, hy, r, r + .4, None, shade=lambda nx, ny: tone(sk, .7 - nx * .25 - ny * .2, int(nx * 9), int(ny * 9)))
        if not back:
            ey = int(hy + .5)
            if view == 's':
                for ex in (int(hx - 2), int(hx + 1)):
                    p.set(ex, ey, c('ink', 0)); p.set(ex, ey - 1, c(sk, 4))
                p.set(int(hx) - (0), ey + 2, c(sk, 1))
            elif view == 'se':
                for ex in (int(hx), int(hx + 2)):
                    p.set(ex, ey, c('ink', 0))
                p.set(int(hx + 3), ey + 1, c(sk, 2))
            elif view == 'e':
                p.set(int(hx + 2), ey, c('ink', 0)); p.set(int(hx + r), ey + 1, c(sk, 3))
            if style.get('paint'):
                for k in (-1, 0, 1):
                    p.set(int(hx) + k + (1 if view != 's' else 0), ey + 2, c('red', 3))
        # Hair styles
        top_y = hy - r - .4
        def hairpx(x, y, light):
            p.set(x, y, tone(hr, light, x, y))
        if hs in ('short', 'crop', 'messy', 'tail', 'bun', 'braid', 'long'):
            for y in range(int(top_y), int(hy + (r if back else (-.5 if hs in ('crop',) else .5)))):
                for x in range(int(hx - r - .5), int(hx + r + 1.5)):
                    nx = (x + .5 - hx) / (r + .6); ny = (y + .5 - hy) / (r + .8)
                    if nx * nx + ny * ny <= 1.05:
                        if not back and view == 'e' and nx > .25 and y > top_y + 2: continue
                        if not back and view == 'se' and nx > .45 and y > top_y + 2: continue
                        if not back and view == 's' and y > top_y + 2 and abs(nx) < .62: continue
                        hairpx(x, y, .55 - ny * .3 - nx * .15)
            if hs == 'short':  # 2087 styled fringe with teal highlight
                if not back:
                    p.set(int(hx - 1), int(top_y + 2), tone(hr, .6, 0, 0)); p.set(int(hx + 1), int(top_y + 3), tone(hr, .45, 0, 0))
                p.set(int(hx), int(top_y), c('hair', 3)); p.set(int(hx + 1), int(top_y), c('hair', 4))
            if hs == 'messy':
                for x in range(int(hx - r), int(hx + r + 1), 2):
                    p.set(x, int(top_y) - 1, tone(hr, .4, x, 0))
            if hs == 'bun':
                p.ellipse(hx - (fx * 2.5 if side else 0), top_y - 1 + (2 if back else 0), 2, 1.6, None,
                          shade=lambda nx, ny: tone(hr, .6 - ny * .3, 0, 0))
            if hs in ('long', 'braid', 'tail'):
                tail = 6 if hs == 'long' else 7
                if back or view in ('s',):
                    for y in range(int(hy), int(hy + tail)):
                        if hs == 'long' or back:
                            for x in range(int(hx - r + (0 if back else 0)), int(hx + r + 1)):
                                if back or abs(x - hx) > r - 1.5:
                                    hairpx(x, y, .4 - (y - hy) / 20)
                elif side:
                    for k in range(tail):
                        hairpx(int(hx - fx * (r + 0) - (1 if k > 3 else 0)), int(hy + k), .4)
                if hs == 'braid' and back:
                    for k in range(4): p.set(int(hx), int(hy + tail + k), tone(hr, .5, k, 0))
        elif hs == 'hood':
            for y in range(int(top_y) - 1, int(hy + r)):
                for x in range(int(hx - r - 1), int(hx + r + 2)):
                    nx = (x + .5 - hx) / (r + 1); ny = (y + .5 - hy) / (r + 1.2)
                    if nx * nx + ny * ny <= 1:
                        if not back and view in ('s', 'se', 'e') and y > top_y + 2 and abs(nx - (.35 if view == 'e' else .15 if view == 'se' else 0)) < .55: continue
                        p.set(x, y, tone('wolf', .55 - ny * .3 - nx * .15, x, y))
            for side_ in (-1, 1):  # Wolf-pelt ears
                p.set(int(hx + side_ * 2), int(top_y) - 2, c('wolf', 3))
        # Grey hair / beard
        if style.get('beard') and not back:
            br = style['beard']
            for y in range(int(hy + 1), int(hy + r + 3)):
                for x in range(int(hx - r + 1), int(hx + r)):
                    nx = (x + .5 - hx) / r
                    if (view == 's' and abs(nx) < .9 and y > hy + 1.5) or (view == 'se' and -.3 < nx < 1.1 and y > hy + 1.5) or (view == 'e' and nx > .1 and y > hy + 1.5):
                        p.set(x, y, tone(br, .55 - (y - hy) / 14, x, y))
        if style.get('headband'):
            for x in range(int(hx - r), int(hx + r + 1)):
                p.set(x, int(top_y + 2), c(style['headband'], 3))
        if style.get('feather'):
            p.line(int(hx + 2), int(top_y), int(hx + 4), int(top_y - 4), c('grey', 5))
            p.set(int(hx + 4), int(top_y - 4), c('red', 4))
        if style.get('scarf'):
            sc = style['scarf']
            yy = int(hy + r)
            p.hline(int(hx - 3), int(hx + 3), yy, c(sc, 3)); p.hline(int(hx - 3), int(hx + 3), yy + 1, c(sc, 2))
            if back or side:
                flutter = 1 if anim in ('run',) else 0
                tx = -fx * (2 + flutter * 2)
                for k in range(4 + flutter):
                    p.set(int(hx + tx * k / 3 - (1 if view == 'n' else 0)), yy + 1 + k * (1 if not flutter else .5), c(sc, 3 - (k > 2)))
        return hx, hy

    def weapon(hand):
        if not P['weapon']:
            return
        kind, ph = P['weapon']
        hx, hy = hand
        if kind == 'sword':
            ang = [-2.2, -.4, .5, .2][ph]
            dirx, diry = fx, fy * .6
            if view in ('s', 'n'):
                dirx = [-.6, .4, .9, .5][ph] * (1 if view == 's' else -1); diry = [-1, -.2, .5, .6][ph] * (1 if view == 's' else -1) if view == 's' else [-1, -.6, -.2, .2][ph]
            else:
                ca, sa = math.cos(ang), math.sin(ang)
                dirx, diry = fx * ca - (-1) * sa * .2, fy * ca * .6 + sa
            for k in range(1, 10):
                col = c('grey', 5) if k > 3 else c('gold', 3) if k == 1 else c('grey', 4)
                p.set(hx + dirx * k, hy + diry * k, col)
            p.set(hx - diry * 1.5, hy + dirx * 1.5, c('gold', 4)); p.set(hx + diry * 1.5, hy - dirx * 1.5, c('gold', 4))
        elif kind == 'spear':
            dirx, diry = (fx, fy * .55) if side else (0, fy)
            back_len, front_len = 7, 11
            for k in range(-back_len, front_len):
                p.set(hx + dirx * k, hy + diry * k - (0 if side else 0), c('wood', 4 if k % 3 else 3))
            tipx, tipy = hx + dirx * front_len, hy + diry * front_len
            p.set(tipx, tipy, c('stone', 6)); p.set(tipx + dirx, tipy + diry, c('stone', 5))
            p.set(tipx - diry, tipy + dirx, c('stone', 4)); p.set(tipx + diry, tipy - dirx, c('stone', 4))
        elif kind == 'bow':
            # Bow is held by the lead hand, string pulled to the rear hand.
            lead = P['arms'][0]
            bx, by = hand  # rear hand
            sx_ = shoulders[0] + leanx + fx * lead[0] * 3.4
            sy_ = sh + 1 + 6 - lead[1] * 4.6 + fy * lead[0] * 1.6
            perpx, perpy = (-fy, fx) if side else (1, 0)
            if view in ('s', 'n'):
                perpx, perpy = 1, 0
            for k in range(-5, 6):
                bend = (25 - k * k) * .09
                p.set(sx_ + perpx * k + fx * bend, sy_ + perpy * k * (.6 if side else .25) + fy * bend * .5 - (0 if side else abs(k) * .0), c('wood', 4))
            top = (sx_ + perpx * 5, sy_ + perpy * 5 * (.6 if side else .25))
            bot = (sx_ - perpx * 5, sy_ - perpy * 5 * (.6 if side else .25))
            pull = P['bowdraw']
            mx, my = (bx, by) if pull else (sx_, sy_)
            p.line(top[0], top[1], mx, my, c('grey', 5)); p.line(bot[0], bot[1], mx, my, c('grey', 5))
            if pull:
                p.line(mx, my, mx + fx * 7, my + fy * 3.5, c('wood', 5)); p.set(mx + fx * 7, my + fy * 3.5, c('stone', 6))
        elif kind == 'stone':
            p.rect(hx - 1, hy - 1, 3, 2, c('stone', 4)); p.set(hx, hy - 1, c('stone', 6))
        elif kind == 'page':
            p.rect(hx - 2, hy - 5, 4, 5, c('gold', 4)); p.set(hx - 1, hy - 4, c('gold', 5)); p.set(hx + 1, hy - 6, c('gold', 5))

    if style.get('staff'):
        stx = shoulders[1] + leanx + (fx * 2 if side else 1)
        def staff():
            p.vline(int(stx), 8 + drop, feet, c('wood', 3)); p.vline(int(stx) + 1, 9 + drop, feet, c('wood', 1))
            p.set(int(stx), 7 + drop, c('bark', 5)); p.set(int(stx) + 1, 7 + drop, c('ochre', 3))
    else:
        staff = None

    # Draw order
    if view in ('s', 'se'):
        leg(0, view == 's'); leg(1, True)
        if view == 'se': arm(0, False)
        torso()
        if view == 's': arm(0, True)
        hand = arm(1, True)
        headf()
        if staff: staff()
        weapon(hand)
    elif view == 'e':
        arm(0, False); leg(0, False)
        torso(); leg(1, True)
        headf()
        hand = arm(1, True)
        if staff: staff()
        weapon(hand)
    elif view == 'ne':
        hand = arm(1, True) if P['arms'][1][0] > .3 else None
        if hand: weapon(hand)
        leg(0, False); leg(1, True)
        arm(0, False)
        torso()
        if not hand:
            hand = arm(1, True); weapon(hand)
        headf()
        if staff: staff()
    else:  # n
        if P['weapon']:
            hand = arm(1, True); weapon(hand)
        leg(0, True); leg(1, True)
        torso()
        arm(0, True)
        if not P['weapon']:
            arm(1, True)
        headf()
        if staff: staff()
    img = outline(img)
    if P['flash']:
        px = img.load()
        for y in range(32):
            for x in range(32):
                r_, g_, b_, a_ = px[x, y]
                if a_:
                    px[x, y] = (min(255, r_ + 90), min(255, g_ + 60), min(255, b_ + 50), a_)
    return img

def lying(style, view):
    img = new(32, 32); p = Px(img)
    y = 26
    p.rect(8, y - 2, 12, 4, c(style['top'], 2)); p.hline(8, 19, y - 2, c(style['top'], 3))
    p.rect(19, y - 1, 7, 3, c(style['legs'], 2))
    p.ellipse(6, y - 1, 3.5, 3, c(style['skin'], 3))
    p.ellipse(5, y - 2, 3.5, 2.5, c(style['hair'] if style['hairstyle'] != 'hood' else 'wolf', 2))
    p.set(26, y, c(style['boots'], 2)); p.set(26, y + 1, c(style['boots'], 2))
    if style.get('scarf'):
        p.rect(9, y - 3, 2, 2, c(style['scarf'], 3))
    return outline(img)

def human_sheet(name, anims):
    style = STYLES[name]
    cols = max(FRAMES[a] for a in anims)
    sheet = new(cols * 32, len(anims) * len(HUMAN_VIEWS) * 32)
    rows = {}
    r = 0
    for a in anims:
        rows[a] = r
        for v in HUMAN_VIEWS:
            for f in range(FRAMES[a]):
                sheet.alpha_composite(human_frame(style, v, a, f), (f * 32, r * 32))
            r += 1
    return sheet, dict(cell=32, cols=cols, views=5, rows=rows, anchor=(16, 29))

# ------------------------------------------------------------------ animals
SPECIES = {
    'wolf': dict(ramp='wolf', cell=32, L=9, H=4.2, leg=5, head=3.2, ears=True, tail='bushy', belly='grey', snout=3),
    'saiga': dict(ramp='saiga', cell=32, L=8, H=4.5, leg=7, head=3.0, ears=False, tail='short', belly='sand', snout=2, nose=True, horns=True),
    'bear': dict(ramp='bear', cell=48, L=14, H=8, leg=6, head=5.2, ears=True, tail='none', belly='bear', snout=3, hump=True),
    'hare': dict(ramp='fur', cell=16, L=4, H=2.5, leg=2, head=2, ears=True, tail='puff', belly='grey', snout=1, longears=True),
}

def animal_frame(sp, view, anim, f):
    S = SPECIES[sp]
    cell = S['cell']
    img = new(cell, cell); p = Px(img)
    ramp = S['ramp']
    n = FRAMES[anim]
    t = f / n
    s = math.sin(t * math.pi * 2)
    gx = cell / 2
    ground = cell - 3
    L, H, leg = S['L'], S['H'], S['leg']
    stride = {'walk': 1.6, 'run': 2.8, 'charge': 3.0}.get(anim, 0)
    bob = (1 if anim in ('run', 'charge') and f % 2 else 0)
    lie = anim == 'death' and f >= 1
    if anim == 'death':
        leg = leg * [1, .5, .1][min(2, f)]
    if anim in ('roar', 'howl'):
        bob = -1 if f else 0
    graze = anim == 'graze'
    by = ground - leg - H + bob + (H * .6 if lie else 0)
    head_up = 3 if anim in ('howl', 'roar') else 0
    lunge = [0, -1, 3, 1][f] if anim in ('bite', 'swipe') else 0

    def body_shade(nx, ny):
        v = .62 - ny * .45 - nx * .1
        if ny > .45: return c(S['belly'], 3)
        return tone(ramp, v + (noise2(int(nx * 9), int(ny * 9), 3) - .5) * .15, int(nx * 10), int(ny * 10))

    if view == 'e':
        # Far legs first.
        for k, (lx, ph) in enumerate(((-L * .6, 0), (L * .6, .5))):
            sw = math.sin((t + ph + .25) * math.pi * 2) * stride
            p.line(gx + lx + 1, by + H * .5, gx + lx + 1 + sw, ground - (1 if sw > 1 else 0) + (0), c(ramp, 1))
        p.ellipse(gx + lunge * .3, by + (2 if S.get('hump') else 0), L, H, None, shade=body_shade)
        if S.get('hump'):
            p.ellipse(gx - L * .2 + lunge * .3, by - H * .45, L * .45, H * .5, None, shade=body_shade)
        for k, (lx, ph) in enumerate(((-L * .6, .5), (L * .6, 0))):
            sw = math.sin((t + ph + .25) * math.pi * 2) * stride
            x0 = gx + lx; y0 = by + H * .5
            p.line(x0, y0, x0 + sw, ground, c(ramp, 2)); p.line(x0 + 1, y0, x0 + 1 + sw, ground, c(ramp, 3))
            p.set(x0 + sw + 1, ground, c(ramp, 0))
        hx = gx + L + 1 + lunge
        hy = by - H * .3 - head_up + (H * 1.4 if graze else 0) + (2 if lie else 0)
        p.ellipse(hx, hy, S['head'] * 1.1, S['head'], None, shade=lambda nx, ny: tone(ramp, .66 - ny * .4, 0, 0))
        p.rect(hx + 1, hy - 1 + (1 if graze else 0), S['snout'] + 1, max(2, S['head'] * .8), c(ramp, 3))
        if S.get('nose'):
            p.ellipse(hx + S['snout'] + 1, hy + .5, 2, 1.8, c(ramp, 4))
        p.set(hx + S['snout'] + 2, hy, c('ink', 0))
        p.set(hx + 1, hy - 1, c('ink', 0) if anim != 'death' else c(ramp, 1))
        if anim in ('bite', 'roar', 'howl', 'swipe') and f in (1, 2):
            p.hline(hx + 1, hx + S['snout'] + 1, hy + S['head'] * .7, c('red', 2))
            p.set(hx + S['snout'], hy + S['head'] * .7 - 1, c('grey', 5))
        if S.get('ears'):
            if S.get('longears'):
                p.line(hx - 1, hy - 1, hx - 3, hy - 5, c(ramp, 3))
            else:
                p.set(hx - 1, hy - S['head'] - 1, c(ramp, 2)); p.set(hx, hy - S['head'] - 1, c(ramp, 3)); p.set(hx - 1, hy - S['head'] - 2, c(ramp, 2))
        if S.get('horns'):
            p.line(hx - 1, hy - 2, hx - 3, hy - 7, c('gold', 4)); p.set(hx - 2, hy - 5, c('gold', 2))
        tx = gx - L - 1
        if S['tail'] == 'bushy':
            wag = int(s * 1.5) if anim in ('idle', 'walk') else -1
            for k in range(5):
                p.set(tx - k, by - 1 + k * .6 + wag * (k / 5), c(ramp, 3)); p.set(tx - k, by + k * .6 + wag * (k / 5), c(ramp, 2))
            p.set(tx - 5, by + 3 + wag, c(S['belly'], 4))
        elif S['tail'] == 'puff':
            p.ellipse(tx, by, 1.5, 1.5, c('grey', 5))
        elif S['tail'] == 'short':
            p.set(tx, by - 1, c(ramp, 2))
        if anim == 'swipe':
            pawx = hx + [-3, 0, 4, 1][f]; pawy = by + [-6, -9, 0, 2][f]
            p.ellipse(pawx, pawy, 2.5, 2.5, c(ramp, 2))
            for k in range(3): p.set(pawx + 2, pawy - 1 + k, c('grey', 5))
    else:
        front = view == 's'
        ww = L * .7 if not S.get('hump') else L * .6
        for k, lx in enumerate((-ww * .55, ww * .55)):
            sw = math.sin((t + k * .5) * math.pi * 2) * stride * .6
            p.line(gx + lx, by + H * .4, gx + lx, ground - max(0, sw), c(ramp, 2 if front else 1))
            p.line(gx + lx + 1, by + H * .4, gx + lx + 1, ground - max(0, -sw), c(ramp, 3 if front else 2))
        p.ellipse(gx, by, ww, H * (1.05 if front else 1.1), None, shade=body_shade)
        if S.get('hump') and not front:
            p.ellipse(gx, by - H * .5, ww * .7, H * .5, None, shade=body_shade)
        if front:
            hy = by - H * .2 - head_up + (H * 1.3 if graze else 0) + lunge * .5
            p.ellipse(gx, hy, S['head'], S['head'], None, shade=lambda nx, ny: tone(ramp, .7 - ny * .35 - nx * .15, 0, 0))
            p.rect(gx - S['snout'] * .5, hy + 1, S['snout'] + 1, S['head'] * .9, c(ramp, 3))
            if S.get('nose'): p.ellipse(gx + .5, hy + S['head'] * .9, 2, 1.6, c(ramp, 4))
            p.set(gx - 1.5, hy - .5, c('ink', 0)); p.set(gx + 2, hy - .5, c('ink', 0))
            p.set(gx + .5, hy + S['head'] * .9 + 1, c('ink', 0))
            if S.get('ears'):
                if S.get('longears'):
                    p.vline(gx - 1, hy - 5, hy - 2, c(ramp, 3)); p.vline(gx + 2, hy - 5, hy - 2, c(ramp, 3))
                else:
                    for sgn in (-1, 1):
                        p.set(gx + sgn * (S['head'] - .5) + .5, hy - S['head'], c(ramp, 2)); p.set(gx + sgn * (S['head'] - .5) + .5, hy - S['head'] - 1, c(ramp, 3))
            if S.get('horns'):
                p.line(gx - 1, hy - 2, gx - 2, hy - 6, c('gold', 4)); p.line(gx + 2, hy - 2, gx + 3, hy - 6, c('gold', 4))
            if anim in ('bite', 'roar', 'howl', 'swipe') and f in (1, 2):
                p.hline(gx - 1, gx + 2, hy + S['head'] + 1, c('red', 2))
        else:
            if S['tail'] == 'bushy':
                for k in range(5): p.set(gx, by + H * .6 + k, c(ramp, 3 - k // 3))
            elif S['tail'] == 'puff':
                p.ellipse(gx, by + H * .5, 1.5, 1.5, c('grey', 5))
            if S.get('ears') and not S.get('longears'):
                hy = by - H - 1
                p.ellipse(gx, hy + 1, S['head'] * .9, S['head'] * .7, c(ramp, 2))
                p.set(gx - 2, hy - 1, c(ramp, 3)); p.set(gx + 2, hy - 1, c(ramp, 3))
            elif S.get('horns'):
                hy = by - H - 1
                p.ellipse(gx, hy + 1, S['head'] * .9, S['head'] * .7, c(ramp, 2))
                p.line(gx - 1, hy, gx - 2, hy - 4, c('gold', 4)); p.line(gx + 2, hy, gx + 3, hy - 4, c('gold', 4))
            elif S.get('longears'):
                p.vline(gx - 1, by - H - 4, by - H, c(ramp, 3)); p.vline(gx + 1, by - H - 4, by - H, c(ramp, 3))
        if anim == 'swipe' and front:
            pawx = gx + [-6, -8, 2, 0][f]; pawy = by + [-4, -8, 3, 2][f]
            p.ellipse(pawx, pawy, 2.5, 2.5, c(ramp, 2))
    img = outline(img)
    if anim == 'hurt' and f == 0:
        px = img.load()
        for y in range(cell):
            for x in range(cell):
                r_, g_, b_, a_ = px[x, y]
                if a_: px[x, y] = (min(255, r_ + 90), min(255, g_ + 60), min(255, b_ + 50), a_)
    return img

def animal_sheet(sp, anims):
    S = SPECIES[sp]
    cell = S['cell']
    cols = max(FRAMES[a] for a in anims)
    sheet = new(cols * cell, len(anims) * 3 * cell)
    rows = {}
    r = 0
    for a in anims:
        rows[a] = r
        for v in ANIMAL_VIEWS:
            for f in range(FRAMES[a]):
                sheet.alpha_composite(animal_frame(sp, v, a, f), (f * cell, r * cell))
            r += 1
    return sheet, dict(cell=cell, cols=cols, views=3, rows=rows, anchor=(cell // 2, cell - 3))

# ------------------------------------------------------------------ shadow of Zulmat
def zulmat_frame(f):
    img = new(32, 48); p = Px(img)
    flick = [0, 1, 0, -1][f]
    for y in range(6, 46):
        t = (y - 6) / 40
        half = 3.2 + t * 7 + (1.5 if 11 < y < 17 else 0)
        for x in range(32):
            d = abs(x - 16 - flick * t) / half
            if d < 1:
                edge = d > .8 and noise2(x, y + f * 7, 5) > .4
                if y > 42 and noise2(x, y + f, 2) > .5: continue
                p.set(x, y, c('purple', 1 if not edge else 3, 235 if y < 40 else 170))
    p.ellipse(16, 8, 4, 4.5, c('purple', 0))
    # Tall collar from the intro silhouette.
    p.poly([(9, 16), (7, 7), (12, 13)], c('purple', 2)); p.poly([(23, 16), (25, 7), (20, 13)], c('purple', 2))
    p.set(14, 8, c('purple', 6)); p.set(18, 8, c('purple', 6)); p.set(14, 7, c('gold', 5, 200)); p.set(18, 7, c('gold', 5, 200))
    for k in range(6):
        p.set(16 + int(math.sin(f + k) * 6), 44 - k * 3, c('purple', 4, 120))
    return img

# ------------------------------------------------------------------ portraits (48x48)
PORTRAITS = ['aibar', 'dana', 'erlan', 'elder', 'hunter', 'crafter', 'child', 'cook', 'scraper', 'stranger', 'zulmat', 'system']

def portrait(name):
    W = 48
    img = new(W, W); p = Px(img)
    # Backdrop: warm steppe dusk gradient, purple for Zulmat, teal for system.
    bg = {'zulmat': 'purple', 'system': 'teal', 'aibar': 'teal', 'dana': 'blue', 'erlan': 'teal'}.get(name, 'ochre')
    for y in range(W):
        for x in range(W):
            v = .25 + y / W * .25 + (noise2(x // 3, y // 3, 4) - .5) * .06
            p.set(x, y, tone(bg, v * (.6 if bg in ('purple', 'teal', 'blue') else .55), x, y))
    if name == 'system':
        for r in range(16, 4, -2):
            p.ellipse(24, 24, r, r, c('cyan', 4 - r // 6, 60 + (16 - r) * 12))
        p.poly([(15, 12), (32, 10), (34, 34), (17, 37)], None, shade=lambda x, y: tone('gold', .9 - (y - 10) / 40, x, y))
        for y in (17, 21, 25, 29):
            p.hline(19, 30, y, c('ochre', 2))
        return outline(img)
    if name == 'zulmat':
        p.ellipse(24, 52, 22, 20, c('purple', 2))
        p.poly([(6, 48), (8, 22), (18, 34)], c('purple', 3)); p.poly([(42, 48), (40, 22), (30, 34)], c('purple', 3))
        p.ellipse(24, 24, 10, 12, c('purple', 1))
        for x, y in ((20, 23), (28, 23)):
            p.rect(x - 1, y, 3, 2, c('gold', 5)); p.set(x, y - 1, c('purple', 6))
        for k in range(30):
            x = int(noise2(k, 1, 3) * 48); y = int(noise2(k, 2, 3) * 48)
            p.set(x, y, c('purple', 5, 140))
        return img
    style = STYLES[name]
    sk, hr = style['skin'], style['hair']
    # Shoulders / clothing
    top = style['top']
    p.ellipse(24, 54, 22, 16, None, shade=lambda nx, ny: tone(top, .62 - nx * .3 - ny * .2, int(nx * 30), int(ny * 30)))
    if style['topkind'] == 'jacket':
        p.vline(24, 40, 47, c(top, 0)); p.hline(10, 38, 42, c(style['trim'], 3))
        p.rect(14, 44, 3, 3, c('cyan', 3)) if style.get('device') else None
    if style['topkind'] == 'cloak':
        for x in range(4, 44, 2):
            p.set(x, 40 + (x % 4 == 0), c('fur', 5))
    p.rect(20, 33, 8, 7, c(sk, 2))
    # Face
    fy = 24 if style.get('build') != 'child' else 26
    rx, ry = (9, 11) if style.get('build') != 'child' else (8, 10)
    p.ellipse(24, fy, rx, ry, None, shade=lambda nx, ny: tone(sk, .72 - nx * .3 - ny * .15, int(nx * 20), int(ny * 20)))
    # Eyes, brows, nose, mouth
    for ex in (20, 28):
        p.rect(ex - 1, fy, 3, 2, c('grey', 5)); p.set(ex, fy, c('ink', 0)); p.set(ex, fy + 1, c('ink', 0))
        p.hline(ex - 2, ex + 1, fy - 2, tone(hr if hr != 'grey' else 'grey', .3, 0, 0))
    p.vline(25, fy + 2, fy + 5, c(sk, 2)); p.set(24, fy + 5, c(sk, 1))
    p.hline(22, 26, fy + 8, c(sk, 1)); p.hline(23, 25, fy + 9, c('red', 3))
    if style.get('paint'):
        for x in range(16, 33, 2): p.set(x, fy + 4, c('red', 3)); p.set(x, fy + 5, c('red', 2))
    if name == 'elder':
        p.hline(18, 22, fy - 4, c(sk, 2)); p.hline(26, 30, fy - 4, c(sk, 2)); p.set(19, fy + 3, c(sk, 2)); p.set(29, fy + 3, c(sk, 2))
    # Hair
    hs = style['hairstyle']
    if hs == 'hood':
        p.ellipse(24, fy - 4, rx + 3, ry, None, shade=lambda nx, ny: tone('wolf', .6 - ny * .3 - nx * .2, int(nx * 20), int(ny * 20)) if ny < -.2 or abs(nx) > .72 else CLEAR)
        p.poly([(13, 12), (15, 3), (19, 10)], c('wolf', 3)); p.poly([(35, 12), (33, 3), (29, 10)], c('wolf', 3))
    else:
        for y in range(fy - ry - 2, fy + (ry if hs in ('long', 'braid', 'tail') else -3)):
            for x in range(24 - rx - 2, 24 + rx + 3):
                nx = (x - 24) / (rx + 2); ny = (y - (fy - 2)) / (ry + 2)
                inside = nx * nx + ny * ny <= 1
                face = abs(nx) < .72 and y > fy - ry + 3
                if inside and not face:
                    p.set(x, y, tone(hr, .6 - ny * .3 - nx * .2, x, y))
        if hs == 'short':
            for x in range(17, 29, 2): p.set(x, fy - ry + 3, tone(hr, .5, x, 0)); p.set(x + 1, fy - ry + 4, tone(hr, .4, x, 0))
            p.set(21, fy - ry - 1, c('hair', 3)); p.set(22, fy - ry - 1, c('hair', 4)); p.set(23, fy - ry, c('hair', 4))
        if hs == 'bun':
            p.ellipse(24, fy - ry - 3, 4, 3, None, shade=lambda nx, ny: tone(hr, .6 - ny * .3, 0, 0))
        if hs in ('long', 'braid', 'tail'):
            for y in range(fy, fy + 14):
                for x in (13, 14, 15, 33, 34, 35):
                    if hs == 'long' or (hs == 'braid' and x in (33, 34)) or (hs == 'tail' and x in (14, 34) and y < fy + 6):
                        p.set(x, y, tone(hr, .45 - (y - fy) / 40, x, y))
        if hs == 'messy':
            for x in range(15, 34, 3): p.line(x, fy - ry - 1, x - 1, fy - ry - 4, tone(hr, .5, x, 0))
    if style.get('beard'):
        br = style['beard']
        for y in range(fy + 4, fy + 16):
            for x in range(15, 34):
                nx = (x - 24) / 9; ny = (y - (fy + 6)) / 10
                if nx * nx + ny * ny < 1 and not (21 <= x <= 27 and fy + 7 <= y <= fy + 9):
                    p.set(x, y, tone(br, .55 - ny * .3, x, y))
    if style.get('headband'):
        p.hline(14, 34, fy - 5, c(style['headband'], 3)); p.hline(14, 34, fy - 4, c(style['headband'], 2))
        p.set(36, fy - 4, c(style['headband'], 3)); p.set(37, fy - 3, c(style['headband'], 3))
    if style.get('feather'):
        p.line(32, fy - 9, 37, fy - 18, c('grey', 5)); p.set(37, fy - 18, c('red', 4)); p.set(36, fy - 16, c('red', 4))
    if style.get('necklace'):
        for x in range(16, 33, 3):
            p.rect(x, 40 + (1 if 20 < x < 30 else 0), 2, 2, c('bark', 5))
    if style.get('scarf'):
        sc = style['scarf']
        p.ellipse(24, 38, 11, 4, None, shade=lambda nx, ny: tone(sc, .65 - ny * .3 - nx * .2, int(nx * 20), int(ny * 20)))
        p.poly([(30, 38), (36, 39), (34, 47), (29, 46)], c(sc, 2))
    return outline(img)
