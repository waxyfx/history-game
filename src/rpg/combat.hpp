#pragma once
#include <math.h>
namespace tj {
enum Weapon { Sword, Spear, Bow };
struct WeaponSpec { int damage,windup,recovery; float range,width; };
// Sword: wide fast arc. Spear: long narrow thrust. Bow: arrow after a draw.
// Base stats; a level may tune them at run time (tj_weapon_tune: MAP06 composite bow, cavalry lance).
constexpr WeaponSpec baseWeapons[]={{26,6,20,26,16},{30,10,30,44,7},{24,14,26,200,0}};
inline WeaponSpec weapons[]={baseWeapons[0],baseWeapons[1],baseWeapons[2]};
// What the ranged slot (2) actually is. A bow looses arrows (drawn by holding the button, aimed while drawn); the
// firearms are not bows: a fast lead round with a muzzle flash, smoke and recoil, a magazine filled from the
// cartridges by reloading, and their own cycle — a flintlock reloads after every shot, a bolt-action rifle works its
// bolt between shots, a sub-machine gun fires while the trigger is held. The pulse rifle (2087) is a hitscan beam
// that pierces and overheats instead of reloading.
enum FireKind { FireBow, FireMusket, FireRifle, FireAuto, FireBeam };
struct FireProfile { int kind,mag,reload,cycle,gap,pierce; float speed,spread,recoil; };
constexpr FireProfile bowProfile{FireBow,0,0,0,0,0,4.2f,0,0};
inline FireProfile fire=bowProfile;
// Melee profiles. Slot 0 (blade): 0 plain cut, 1 three-cut series with a finisher (shashka / sabre of MAP07–08),
// 2 parry + counter-cut (Turkic sabre), 3 quick chain (akinakes, knife: a follow-up cut comes almost at once).
// Slot 1 (pole): 0 thrust, 1 running lance charge, 2 bayonet lunge (a step into the thrust).
// knock: extra push on a hit (a heavy blow staggers).
struct MeleeProfile { int mode; float knock; };
inline MeleeProfile melee[2]={{0,0},{0,0}};
struct Vec { float x,y; };
constexpr Vec directions[]={{0,-1},{.70710678f,-.70710678f},{1,0},{.70710678f,.70710678f},
    {0,1},{-.70710678f,.70710678f},{-1,0},{-.70710678f,-.70710678f}};
enum EnemyType { Wolf, Stranger, Archer, Bear, Shade, Wraith, Keeper, Rider, Witness, Image, Herald, Zulmat, EnemyTypeCount };
enum EnemyState { Idle, Patrol, Chase, Attacking, Hurt, Death, Circle, Retreat, Roar, Charge, Stunned, Telegraph };
struct EnemySpec { int health,damage,windup,recovery; float speed,detection,range; };
constexpr EnemySpec enemySpecs[EnemyTypeCount]={
    {48,9,16,54,1.25f,112,17},   // wolf: fast pack hunter, circles then lunges
    {72,15,22,62,.82f,104,30},   // stranger with spear
    {56,11,32,84,.78f,150,128},  // stranger archer keeps distance
    {280,24,28,70,.85f,175,32},  // cave bear: roar, charge, swipe (faster, notices from farther)
    {64,14,16,50,1.05f,124,22},  // shade-touched warrior: lunging cut
    {42,12,30,72,.72f,150,118},  // ash wraith: floats, throws fire bolts
    {640,22,36,50,.82f,230,40},  // boss: distorted keeper of the sacred fire
    {720,20,30,50,1.15f,220,42}, // boss: the golden-armoured rider (MAP03)
    {780,18,30,50,1.0f,240,46},  // boss: the three-faced witness (MAP04)
    {760,16,26,50,.95f,230,36},  // boss: «Екінші бейне», the second image (MAP05)
    {820,18,28,50,1.6f,240,40},  // boss: the herald of the forged yarlyk (MAP06)
    {1200,20,26,46,1.4f,260,46}};  // boss: Зұлмат, the two hands (MAP10)
struct Attack {
    int age=0,weapon=0,facing=4,cooldown=0;
    bool active=false,connected=false,charge=false;   // charge: a running lance thrust (MAP06)
    bool counter=false;   // a counter-cut right after a parry
    int draw=0;           // bow: ticks the string was held past the draw (a stronger, farther arrow)
    float x=0,y=0;
};
struct Projectile {
    bool active=false,cosmetic=false,fire=false;
    int bullet=0;   // 0 arrow, 1 lead round (fast, small)
    int owner=-1,damage=0,facing=0; // owner: <0 player slot -(slot+1), >=0 enemy index
    float x=0,y=0,dx=0,dy=0,remaining=0;
};
constexpr int MaxProjectiles=48;
inline bool inArc(int weapon,int facing,float x,float y,float tx,float ty,float extra=0) {
    auto d=directions[facing];float dx=tx-x,dy=ty-y;
    float forward=dx*d.x+dy*d.y,side=dx*d.y-dy*d.x;
    return forward>-2&&forward<=weapons[weapon].range+extra&&fabsf(side)<=weapons[weapon].width;
}
inline int heading(float dx,float dy) {
    if(fabsf(dx)>fabsf(dy)*2.414214f)return dx>0?2:6;
    if(fabsf(dy)>fabsf(dx)*2.414214f)return dy>0?4:0;
    return dy>0?(dx>0?3:5):(dx>0?1:7);
}
}
