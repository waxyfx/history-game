"""Shared palette and pixel helpers for the MAP01 pixel-art generator.

Everything in the atlas is drawn from this single palette so that tiles,
characters, effects and portraits read as one art set ("modern 16-bit").
"""
import math, random
from PIL import Image

def hexc(h, a=255):
    h = h.lstrip('#')
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)

# Ramps go dark -> light. Hue-shifted: shadows lean cool/teal, lights lean warm.
RAMPS = {
    'ink':    ['#120f14', '#1d1a22', '#2a2630'],
    'grass':  ['#1f3a2c', '#2c4f33', '#3d6a3b', '#55833f', '#7a9c4a', '#a3b85e'],
    'steppe': ['#3a4430', '#55603a', '#7a7d44', '#a29a52', '#c7b66a', '#e3d18e'],
    'dirt':   ['#3b2b22', '#57402d', '#77593b', '#97764d', '#b8975f', '#d6b878'],
    'sand':   ['#6b5a3e', '#8f7a52', '#b49c68', '#d0bb82', '#e8d6a0'],
    'stone':  ['#1e2427', '#2f383a', '#465150', '#5f6b66', '#7f8a7f', '#a5ad9b', '#cfd2bd'],
    'warmstone': ['#2b2422', '#433835', '#5e504a', '#7c6b60', '#9e8b7b', '#c2ae98'],
    'water':  ['#0f2a3a', '#16405a', '#1d5a76', '#2a7a8f', '#4aa0a8', '#86c8c0', '#d4efe2'],
    'wood':   ['#2a1c14', '#45301f', '#634629', '#83603a', '#a57d4d', '#c9a26b'],
    'bark':   ['#2b2620', '#4a4237', '#6f6655', '#9a917a', '#cfc8b0', '#efeadb'],
    'leaf':   ['#16301f', '#1f4428', '#2d5e31', '#437a37', '#62963f', '#8db354', '#bcd27a'],
    'hide':   ['#3d2618', '#5c3a22', '#7f5530', '#a47442', '#c7975c', '#e6c08a'],
    'fur':    ['#262019', '#3e352b', '#5a4d3e', '#7a6a55', '#9e8c70', '#c4b393'],
    'wolf':   ['#1f2226', '#363a3e', '#525654', '#73766e', '#9a9a8c', '#c9c6b4'],
    'bear':   ['#1b1310', '#2e211a', '#463225', '#5f4532', '#7c5c42', '#9c7a58'],
    'saiga':  ['#4a3624', '#6e5235', '#93734a', '#b89863', '#dcc08a', '#f2e2b8'],
    'skin':   ['#4a2b20', '#6e3f2c', '#9c6142', '#c98a5f', '#e0a97c', '#f2cba0'],
    'skin2':  ['#3d241b', '#5c3626', '#82523a', '#a86d4c', '#c88d66', '#e2b08a'],
    'hair':   ['#0e0b0b', '#17110f', '#2a221d', '#33525a', '#4c6f72'],
    'black':  ['#0d0a0a', '#1a1411', '#2b211b', '#3d3027', '#57463a'],
    'grey':   ['#2c2a2a', '#4d4a47', '#7a7670', '#a8a39a', '#d8d3c6', '#f4f0e4'],
    'teal':   ['#0b2628', '#123c40', '#1f5e5f', '#2f7f7a', '#4ea59a', '#86cdbd'],
    'scarf':  ['#5e2410', '#8c3a16', '#b4561a', '#e98a2f', '#f6b25a', '#fbd896'],
    'gold':   ['#5a3c12', '#8a6020', '#b8862e', '#e2b45a', '#f3d68b', '#fff2c4'],
    'cyan':   ['#0d4a52', '#147a80', '#2fb5b0', '#7ff5e4', '#d6fff7'],
    'purple': ['#120a18', '#1f1029', '#341a45', '#4f2766', '#74398a', '#a35cc0', '#d29ae6'],
    'red':    ['#3a1210', '#5e1d17', '#8a2c1f', '#b8442b', '#e06a3f', '#f39a63'],
    'ochre':  ['#4a2214', '#77351a', '#a24c22', '#c86a30', '#e0904a', '#f0b878'],
    'fire':   ['#5e1d17', '#a8341c', '#e0621f', '#f59a2a', '#ffd24a', '#fff3b0'],
    'blue':   ['#1a2238', '#28365a', '#3a527e', '#5878a4', '#86a6c8', '#c4d8ea'],
    'green2': ['#1a2a1a', '#2b4127', '#405c35', '#5c7c44', '#80a052'],
    'flower': ['#8a1f2a', '#c8323a', '#ee5a4a', '#f7d24a', '#fff1a0'],
}
R = {k: [hexc(c) for c in v] for k, v in RAMPS.items()}
CLEAR = (0, 0, 0, 0)

def c(name, i, a=255):
    col = R[name][max(0, min(len(R[name]) - 1, i))]
    return (col[0], col[1], col[2], a)

def new(w, h):
    return Image.new('RGBA', (w, h), CLEAR)

class Px:
    """Tiny immediate-mode pixel canvas with clipping and alpha blending."""
    def __init__(self, img):
        self.img = img
        self.p = img.load()
        self.w, self.h = img.size

    def set(self, x, y, col):
        x, y = int(x), int(y)
        if 0 <= x < self.w and 0 <= y < self.h and col and col[3]:
            if col[3] == 255:
                self.p[x, y] = col
            else:
                d = self.p[x, y]
                a = col[3] / 255
                if d[3] == 0:
                    self.p[x, y] = col
                else:
                    self.p[x, y] = (int(col[0] * a + d[0] * (1 - a)), int(col[1] * a + d[1] * (1 - a)),
                                    int(col[2] * a + d[2] * (1 - a)), max(d[3], col[3]))

    def get(self, x, y):
        if 0 <= x < self.w and 0 <= y < self.h:
            return self.p[x, y]
        return CLEAR

    def rect(self, x, y, w, h, col):
        for yy in range(int(y), int(y + h)):
            for xx in range(int(x), int(x + w)):
                self.set(xx, yy, col)

    def hline(self, x0, x1, y, col):
        for x in range(int(min(x0, x1)), int(max(x0, x1)) + 1):
            self.set(x, y, col)

    def vline(self, x, y0, y1, col):
        for y in range(int(min(y0, y1)), int(max(y0, y1)) + 1):
            self.set(x, y, col)

    def line(self, x0, y0, x1, y1, col):
        dx, dy = x1 - x0, y1 - y0
        n = int(max(abs(dx), abs(dy))) + 1
        for i in range(n + 1):
            t = i / max(1, n)
            self.set(round(x0 + dx * t), round(y0 + dy * t), col)

    def ellipse(self, cx, cy, rx, ry, col, shade=None):
        """Filled ellipse. shade(nx, ny) -> colour lets callers light it."""
        for y in range(int(cy - ry - 1), int(cy + ry + 2)):
            for x in range(int(cx - rx - 1), int(cx + rx + 2)):
                nx = (x + .5 - cx) / max(.5, rx)
                ny = (y + .5 - cy) / max(.5, ry)
                if nx * nx + ny * ny <= 1:
                    self.set(x, y, shade(nx, ny) if shade else col)

    def poly(self, pts, col, shade=None):
        ys = [p[1] for p in pts]
        for y in range(int(min(ys)), int(max(ys)) + 1):
            xs = []
            n = len(pts)
            for i in range(n):
                x0, y0 = pts[i]
                x1, y1 = pts[(i + 1) % n]
                if (y0 <= y + .5 < y1) or (y1 <= y + .5 < y0):
                    xs.append(x0 + (y + .5 - y0) * (x1 - x0) / (y1 - y0))
            xs.sort()
            for i in range(0, len(xs) - 1, 2):
                for x in range(int(math.ceil(xs[i] - .5)), int(math.floor(xs[i + 1] - .5)) + 1):
                    self.set(x, y, shade(x, y) if shade else col)

def outline(img, col=None, selective=True):
    """1px outline around opaque pixels. Selective: darkest shade of the neighbour hue."""
    src = img.copy()
    sp = src.load()
    dp = img.load()
    w, h = img.size
    ink = col or c('ink', 1)
    for y in range(h):
        for x in range(w):
            if sp[x, y][3] > 40:
                continue
            best = None
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                xx, yy = x + dx, y + dy
                if 0 <= xx < w and 0 <= yy < h and sp[xx, yy][3] > 160:
                    best = sp[xx, yy]
                    break
            if best:
                if selective and col is None:
                    r, g, b, _ = best
                    dp[x, y] = (int(r * .28 + 10), int(g * .26 + 9), int(b * .3 + 14), 255)
                else:
                    dp[x, y] = ink
    return img

def flip(img):
    return img.transpose(Image.FLIP_LEFT_RIGHT)

def noise2(x, y, seed=0):
    n = (x * 374761393 + y * 668265263 + seed * 2246822519) & 0xffffffff
    n = ((n ^ (n >> 13)) * 1274126177) & 0xffffffff
    return ((n ^ (n >> 16)) & 0xffff) / 65535.0

def smooth_noise(x, y, scale, seed=0):
    fx, fy = x / scale, y / scale
    x0, y0 = math.floor(fx), math.floor(fy)
    tx, ty = fx - x0, fy - y0
    tx = tx * tx * (3 - 2 * tx)
    ty = ty * ty * (3 - 2 * ty)
    a = noise2(x0, y0, seed); b = noise2(x0 + 1, y0, seed)
    cc = noise2(x0, y0 + 1, seed); d = noise2(x0 + 1, y0 + 1, seed)
    return (a * (1 - tx) + b * tx) * (1 - ty) + (cc * (1 - tx) + d * tx) * ty

def fbm(x, y, scale, seed=0, octaves=3):
    v, amp, tot = 0, 1, 0
    for o in range(octaves):
        v += smooth_noise(x, y, scale / (2 ** o), seed + o * 17) * amp
        tot += amp
        amp *= .5
    return v / tot

BAYER4 = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]

def dither(v, x, y):
    """Ordered dithering helper: returns True when v (0..1) beats the Bayer threshold."""
    return v * 16 > BAYER4[y & 3][x & 3] + .5

def tone(ramp, v, x=0, y=0):
    """Map a 0..1 light value to a ramp index with Bayer dithering between steps."""
    rr = R[ramp]
    f = max(0, min(.9999, v)) * (len(rr) - 1)
    i = int(f)
    if i + 1 < len(rr) and dither(f - i, x, y):
        i += 1
    return rr[i]
