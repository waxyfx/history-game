"""Inventory icons for the shared consumables (all epochs): herbs, infusions, forge coal, dried curd."""
import math
from .core import *


def _flask(p, liquid):
    # Small clay flask with a leather cord: the same silhouette for every infusion, liquid colour differs.
    p.ellipse(8, 10, 5, 4, None, shade=lambda nx, ny: tone('ochre', .7 - nx * .2 - ny * .25, 0, 0))
    p.rect(6, 3, 4, 4, c('ochre', 3)); p.rect(6, 2, 4, 1, c('hide', 2))
    p.ellipse(8, 11, 3, 2, None, shade=lambda nx, ny: tone(liquid, .85 - (nx * nx + ny * ny) * .4, 0, 0))
    p.set(6, 9, c(liquid, 5)); p.hline(5, 11, 6, c('hide', 3))


def icon(kind):
    img = new(16, 16); p = Px(img)
    if kind == 'herbbig':
        for k in range(6): p.line(8, 14, 2 + k * 2.4, 3 + (k % 2) * 2, c('leaf', 3 + k % 3))
        for x, y in ((4, 4), (9, 2), (13, 5)): p.set(x, y, c('flower', 3)); p.set(x + 1, y, c('flower', 4))
        p.hline(5, 11, 12, c('hide', 3)); p.hline(5, 11, 13, c('hide', 2))
    elif kind == 'strength':
        _flask(p, 'red')
    elif kind == 'guard':
        _flask(p, 'blue')
    elif kind == 'swift':
        _flask(p, 'cyan')
    elif kind == 'coal':
        p.ellipse(8, 10, 6, 4, None, shade=lambda nx, ny: tone('hide', .6 - ny * .3, 0, 0))
        p.hline(4, 12, 6, c('hide', 1))
        for x, y, k in ((6, 6, 4), (9, 5, 5), (11, 7, 3)): p.set(x, y, c('fire', k)); p.set(x, y - 1, c('fire', 2))
    elif kind == 'curd':
        for x, y in ((5, 10), (10, 10), (8, 6), (12, 6), (4, 6)):
            p.ellipse(x, y, 2, 2, None, shade=lambda nx, ny: tone('sand', .95 - (nx + ny) * .15, 0, 0))
    return outline(img), (8, 15)


KINDS = ('herbbig', 'strength', 'guard', 'swift', 'coal', 'curd')
