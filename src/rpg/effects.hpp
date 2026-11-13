#pragma once
// Shared consumables and timed effects for every epoch (MAP01–MAP10).
// Everything here is DATA: a new consumable is one row in `consumables`, a new effect is one row in
// `effectDefs` (+ its label/icon in src/rpg/effects.js), new loot is one row in `drops`.
// The engine only knows four effect kinds and applies them through a handful of hooks
// (outgoing damage, incoming damage, movement speed, regeneration).
namespace tj {
enum EffectKind { KindDamage, KindDefense, KindSpeed, KindRegen, EffectKindCount };
enum EffectId { EffNone, EffStrength, EffGuard, EffSwift, EffForge, EffRegen, EffectIdCount };
// visual: 0 rising sparks, 1 shield ring, 2 speed trail, 3 embers, 4 green motes
struct EffectDef { int kind, magnitude, duration, visual; uint32_t color; };
constexpr EffectDef effectDefs[EffectIdCount]={
    {0,0,0,0,0},
    {KindDamage, 30, 15*60, 0, 0xe0503a},  // Strength infusion: +30% damage, 15 s
    {KindDefense,25, 15*60, 1, 0x8fc3ee},  // Guard infusion: -25% incoming damage, 15 s
    {KindSpeed,  20, 12*60, 2, 0x7ff5e4},  // Swift infusion: +20% movement speed, 12 s
    {KindDamage, 25, 20*60, 3, 0xf59a2a},  // Forge coal (MAP02): fiery weapon, +25% damage, 20 s
    {KindRegen,   3, 10*60, 4, 0x8fd36b},  // Dried curd: +3 HP every second, 10 s
};
// Stacking rules: the same effect never stacks with itself (re-use refreshes it to full duration);
// different effects of one kind add up but are capped per kind, so no combination makes the hero immortal.
constexpr int KindCap[EffectKindCount]={60,40,35,6};
constexpr int MaxEffects=4;          // at most four effects at once; a fifth replaces the one ending soonest
constexpr int UseCooldown=40;        // ticks between two consumables (no spam-healing)
struct ActiveEffect { int id=0,ticks=0; };

struct ConsumableDef { int item, heal, effect; };
constexpr ConsumableDef consumables[]={
    {IKit,45,0}, {IHerb,25,0}, {IHerbBig,50,0},
    {IStrength,0,EffStrength}, {IGuard,0,EffGuard}, {ISwift,0,EffSwift},
    {ICoal,0,EffForge}, {ICurd,0,EffRegen},
};
// Loot by enemy type: {type, item, qty, chance %}. Strong enemies always drop something valuable.
struct Drop { int type,item,qty,chance; };
constexpr Drop drops[]={
    {Wolf,IHerb,1,45},
    {Stranger,IArrows,4,100},{Stranger,IHerb,1,40},
    {Archer,IArrows,7,100},
    {Bear,IKit,1,100},{Bear,IArrows,8,100},{Bear,IHerbBig,1,100},
    {Shade,IHerb,1,50},
    {Wraith,IArrows,4,40},{Wraith,ICurd,1,25},
    {Keeper,IKit,1,100},{Keeper,IArrows,10,100},{Keeper,IHerbBig,1,100},
    {Rider,IKit,1,100},{Rider,IArrows,12,100},{Rider,IHerbBig,1,100},
};
}
