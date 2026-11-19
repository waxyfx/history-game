// Shared archery range (MAP02 bow lesson, MAP06 composite-bow trial): watches the player's arrows in flight against
// targets. A target is {x, y, w?} in pixels (its base); an arrow counts once. An arrow that struck a target's post stops
// in the same tick, so it is judged by where it was last seen.
// Firearm rounds are far too fast to be seen frame by frame: the engine reports where each one stopped (EV_IMPACT),
// and the watchers judge those points too.
let impacts = [], impactSeq = 0;
export function noteImpact(x, y) { impacts.push([x, y, ++impactSeq]); if (impacts.length > 64) impacts.shift(); }
export function makeArrowWatch(E) {
  const flying = new Set(), last = new Map();
  let seen = impactSeq;
  return function watch(targets, onHit) {
    const check = (i, ax, ay, below) => {
      for (const t of targets) if (!flying.has(i) && Math.abs(ax - t.x) < (t.w || 7) && ay > t.y - 22 && ay < t.y + below) { flying.add(i); onHit(t, ax, ay); }
    };
    for (const [x, y, n] of impacts) if (n > seen) { seen = n; for (const t of targets) if (Math.abs(x - t.x) < (t.w || 7) && y > t.y - 22 && y < t.y + 12) { onHit(t, x, y); break; } }
    for (let i = 0; i < 48; i++) {
      if (!E.tj_projectile(i, 0) || E.tj_projectile(i, 3) >= 0 || E.tj_projectile(i, 4) === 1) {   // rounds: judged by impact
        if (last.has(i)) { const [lx, ly] = last.get(i); check(i, lx, ly, 12); last.delete(i); }
        flying.delete(i); continue;
      }
      const ax = E.tj_projectile(i, 1) / 1000, ay = E.tj_projectile(i, 2) / 1000;
      last.set(i, [ax, ay]);
      check(i, ax, ay, 4);
    }
  };
}
