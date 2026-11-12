#pragma once
#include <math.h>
namespace tj {
enum Weapon { Sword, Spear, Bow };
struct WeaponSpec { int damage,windup,recovery; float range,width; };
// Sword: wide fast arc. Spear: long narrow thrust. Bow: arrow after a draw.
constexpr WeaponSpec weapons[]={{26,6,20,26,16},{30,10,30,44,7},{24,14,26,200,0}};
struct Vec { float x,y; };
constexpr Vec directions[]={{0,-1},{.70710678f,-.70710678f},{1,0},{.70710678f,.70710678f},
    {0,1},{-.70710678f,.70710678f},{-1,0},{-.70710678f,-.70710678f}};
enum EnemyType { Wolf, Stranger, Archer, Bear, EnemyTypeCount };
enum EnemyState { Idle, Patrol, Chase, Attacking, Hurt, Death, Circle, Retreat, Roar, Charge, Stunned, Telegraph };
struct EnemySpec { int health,damage,windup,recovery; float speed,detection,range; };
constexpr EnemySpec enemySpecs[EnemyTypeCount]={
    {48,9,16,54,1.25f,112,17},   // wolf: fast pack hunter, circles then lunges
    {72,15,22,62,.82f,104,30},   // stranger with spear
    {56,11,32,84,.78f,150,128},  // stranger archer keeps distance
    {280,24,28,70,.62f,128,28}}; // cave bear: roar, charge, swipe
struct Attack {
    int age=0,weapon=0,facing=4,cooldown=0;
    bool active=false,connected=false;
    float x=0,y=0;
};
struct Projectile {
    bool active=false,cosmetic=false;
    int owner=-1,damage=0,facing=0; // owner: <0 player slot -(slot+1), >=0 enemy index
    float x=0,y=0,dx=0,dy=0,remaining=0;
};
constexpr int MaxProjectiles=48;
inline bool inArc(int weapon,int facing,float x,float y,float tx,float ty) {
    auto d=directions[facing];float dx=tx-x,dy=ty-y;
    float forward=dx*d.x+dy*d.y,side=dx*d.y-dy*d.x;
    return forward>-2&&forward<=weapons[weapon].range&&fabsf(side)<=weapons[weapon].width;
}
inline int heading(float dx,float dy) {
    if(fabsf(dx)>fabsf(dy)*2.414214f)return dx>0?2:6;
    if(fabsf(dy)>fabsf(dx)*2.414214f)return dy>0?4:0;
    return dy>0?(dx>0?3:5):(dx>0?1:7);
}
}
