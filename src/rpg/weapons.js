// Weapon profiles: what each era's weapon actually does in the engine (src/rpg/engine.cpp, combat.hpp).
// A weapon is its numbers (tj_weapon_tune: slot, damage, windup, recovery, range, width) AND its behaviour:
//   ranged slot (tj_fire): a bow, or a firearm with its own cycle — flintlock, bolt-action rifle, sub-machine gun —
//   or the 2087 pulse rifle (a hitscan beam that overheats);
//   blade / pole (tj_melee): plain cut, three-cut series, parry + counter, quick chain; thrust, lance charge, bayonet lunge.
// Changing an icon or a name never changes any of this: the profile does.

// FireKind (combat.hpp)
export const FIRE_KIND = {bow: 0, musket: 1, rifle: 2, auto: 3, beam: 4};
// [kind, magazine, reload (or vent) ticks, bolt ticks (or heat per shot), ticks between automatic rounds, enemies pierced,
//  speed ×100 (px per tick), spread (radians ×1000), recoil ×100 (px)]
export const FIRE = {
  bow: [0, 0, 0, 0, 1, 0, 420, 0, 0],
  compositeBow: [0, 0, 0, 0, 1, 0, 500, 0, 0],                // MAP06: a flatter, faster arrow
  musket: [1, 1, 150, 0, 1, 0, 1500, 40, 300],               // MAP08 flintlock: one round, ~2.5 s to reload, smoke, a hard kick
  mosin: [2, 5, 120, 48, 1, 0, 1800, 12, 220],               // MAP09 Mosin: five-round clip, the bolt between shots
  ppsh: [3, 35, 140, 0, 5, 0, 1400, 70, 60],                 // MAP09 PPSh: 35-round magazine, ~12 rounds a second while held
  pulse: [4, 0, 110, 34, 1, 1, 0, 8, 50],                    // MAP10 pulse rifle: instant beam through two, overheats after ~5 quick shots
};
// Blade modes: 0 plain, 1 three-cut series (third cut finishes), 2 parry (F) + counter-cut, 3 quick chain.
// Pole modes: 0 thrust, 1 running lance charge, 2 bayonet lunge. [mode, knock px]
export const MELEE = {
  institute: [0, 0],    // the Institute's light blade (MAP01–MAP06): one wide quick cut
  akinakes: [3, 0],     // MAP03 Saka akinakes: short reach, the follow-up cut comes at once
  turkSabre: [2, 0],    // MAP05 Turkic sabre: parry with F, then a counter-cut
  shashka: [1, 0],      // MAP07–MAP08 сабля/қылыш: the three-cut series, the third finishes
  knife: [3, 0],        // MAP09 bayonet-knife: fast chain, short
  merged: [1, 4],       // MAP10 the merged sword: the series, heavier
  spear: [0, 3],        // MAP01 stone spear: a long thrust that pushes
  lance: [1, 0],        // MAP06–MAP07 cavalry lance / naiza: charge at a run
  bayonet: [2, 0],      // MAP08–MAP09 bayonet: a step into the thrust
  ionLance: [1, 2],     // MAP10 ion naiza: charge, a jolt on contact
};

// Apply an era's arsenal. Slots not mentioned keep the engine's base numbers.
export function arsenal(E, {fire = FIRE.bow, blade = MELEE.institute, pole = MELEE.spear, empty = 0} = {}) {
  E.tj_fire?.(...fire, empty ? 1 : 0);
  E.tj_melee?.(0, ...blade);
  E.tj_melee?.(1, ...pole);
}
