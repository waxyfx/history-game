#pragma once
#include <math.h>
namespace tj {
enum Weapon { Sword, Spear, Bow };
struct WeaponSpec { int damage,windup,recovery; float range,width; };
constexpr WeaponSpec weapons[]={{30,7,24,24,14},{24,11,34,42,6},{22,15,35,160,0}};
struct Vec { float x,y; };
constexpr Vec directions[]={{0,-1},{.70710678f,-.70710678f},{1,0},{.70710678f,.70710678f},
    {0,1},{-.70710678f,.70710678f},{-1,0},{-.70710678f,-.70710678f}};
struct Attack {
    int age=0,weapon=0,facing=4,cooldown=0;
    bool active=false,connected=false;
    float x=0,y=0;
};
struct Projectile {
    bool active=false;
    int zone=0,owner=-1,damage=0;
    float x=0,y=0,dx=0,dy=0,remaining=0;
};
constexpr int MaxProjectiles=32;
enum EnemyState { Idle, Patrol, Chase, Attacking, Hurt, Death };
struct EnemySpec { int health,damage,windup,recovery;float speed,detection,range; };
constexpr EnemySpec enemySpecs[]={{60,16,22,65,.65f,76,23},{72,20,28,80,.5f,76,40},{50,12,36,100,.45f,76,68}};
struct Enemy {
    int type=0,zone=1,health=60,state=Idle,facing=4,timer=45,phase=0;
    float x=0,y=0,homeX=0,homeY=0;
    Attack attack;
};
constexpr int EnemyCount=3;
inline bool inArc(int weapon,int facing,float x,float y,float tx,float ty) {
    auto d=directions[facing];float dx=tx-x,dy=ty-y;
    float forward=dx*d.x+dy*d.y,side=dx*d.y-dy*d.x;
    return forward>0&&forward<=weapons[weapon].range&&fabsf(side)<=weapons[weapon].width;
}
inline int heading(float dx,float dy) {
    if(fabsf(dx)>fabsf(dy)*2.414214f)return dx>0?2:6;
    if(fabsf(dy)>fabsf(dx)*2.414214f)return dy>0?4:0;
    return dy>0?(dx>0?3:5):(dx>0?1:7);
}
}
