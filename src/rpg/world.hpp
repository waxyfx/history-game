#pragma once
#include <math.h>
#include "renderer.hpp"
// One engine, many epochs: the build selects the generated level header (scripts/rpgart/mapNN.py).
// Everything level-specific (terrain, zones, areas, props, lights, NPCs, enemies, pickups) is data.
#ifndef TJ_LEVEL
#define TJ_LEVEL 1
#endif
#if TJ_LEVEL == 2
#include "gen/map02.hpp"
#else
#include "gen/map01.hpp"
#endif
namespace tj {
using namespace level;
// Kind flags (scripts/rpgart/levelgen.py)
enum KindFlag { F_DECAL=1, F_LIGHT=2, F_TALL=4, F_COVER=8, F_FLAME=16, F_PLATE=32, F_TALLBOX=64, F_FLICKER=128 };
enum Terrain { Grass=TR_GRASS, Steppe=TR_STEPPE, Dirt=TR_DIRT, Sand=TR_SAND, Water=TR_WATER, Shallow=TR_SHALLOW,
               Rock=TR_ROCK, Cave=TR_CAVE, CaveWall=TR_CAVEWALL, Camp=TR_CAMP };
inline int priority(int t){ return art::terrainPriority[t]; }

struct World {
    uint8_t hiddenTag[TagCount]{};   // 1: tagged props hidden (and not solid)
    uint8_t variant[TagCount]{};     // per-tag sprite variant override (plates on/off)
    uint8_t cover[MapW*MapH]{};      // tall grass / reeds: stealth cover
    uint16_t bucketStart[(MapW/8+1)*(MapH/8+1)+1]{};
    uint16_t bucketItems[ObjCount]{};
    uint8_t iaEnabled[InteractCount]{};
    uint16_t iaHold[InteractCount]{};
};
World world;

inline int terrainAt(int tx,int ty){ if(tx<0||ty<0||tx>=MapW||ty>=MapH)return Rock; return terrain[ty*MapW+tx]-'0'; }
inline int zoneAt(float x,float y){ int tx=int(x)/Tile,ty=int(y)/Tile; if(tx<0||ty<0||tx>=MapW||ty>=MapH)return 0; return zones[ty*MapW+tx]-'0'; }
inline bool solidTerrain(int t){ return art::terrainSolid[t]; }
inline bool isWall(int t){ return art::terrainFace[t]>=0; }
inline void collider(const Obj& o,int& hw,int& hh){ hw=o.hw;hh=o.hh; }
inline bool objectSolid(const Obj& o){ return o.hw>0&&!(o.tag&&world.hiddenTag[o.tag]); }

void initWorld() {
    world=World{};
    // Collision buckets: 8x8 tile cells holding the props whose collider touches them.
    int bw=MapW/8+1,bh=MapH/8+1;
    static uint16_t counts[(MapW/8+1)*(MapH/8+1)];
    for(auto& c:counts)c=0;
    for(int i=0;i<ObjCount;++i){int b=(objs[i].y/Tile/8)*bw+objs[i].x/Tile/8; if(b>=0&&b<bw*bh)++counts[b];}
    int acc=0;for(int b=0;b<bw*bh;++b){world.bucketStart[b]=acc;acc+=counts[b];counts[b]=0;}
    world.bucketStart[bw*bh]=acc;
    for(int i=0;i<ObjCount;++i){int b=(objs[i].y/Tile/8)*bw+objs[i].x/Tile/8; if(b>=0&&b<bw*bh)world.bucketItems[world.bucketStart[b]+counts[b]++]=i;}
    for(int i=0;i<ObjCount;++i){
        if(!(kinds[objs[i].kind].flags&F_COVER))continue;
        int tx=objs[i].x/Tile,ty=objs[i].y/Tile;
        for(int dy=-1;dy<=0;++dy)for(int dx=-1;dx<=0;++dx){int x=tx+dx+((objs[i].x%Tile)>=8),y=ty+dy+1;if(x>=0&&y>=0&&x<MapW&&y<MapH)world.cover[y*MapW+x]=1;}
    }
    // Story-gated props start hidden; JS reveals them through tj_tag().
    for(int t=0;t<TagCount;++t)world.hiddenTag[t]=tagHidden[t];
}

template<class F> void forObjectsNear(float x,float y,int radiusTiles,F f) {
    int bw=MapW/8+1,bh=MapH/8+1;
    int bx0=(int(x)/Tile-radiusTiles)/8,bx1=(int(x)/Tile+radiusTiles)/8,by0=(int(y)/Tile-radiusTiles)/8,by1=(int(y)/Tile+radiusTiles)/8;
    if(bx0<0)bx0=0;if(by0<0)by0=0;if(bx1>=bw)bx1=bw-1;if(by1>=bh)by1=bh-1;
    for(int by=by0;by<=by1;++by)for(int bx=bx0;bx<=bx1;++bx){int b=by*bw+bx;
        for(int k=world.bucketStart[b];k<world.bucketStart[b+1];++k)f(world.bucketItems[k]);}
}

// Point solidity for projectiles and line of sight.
bool solidAt(float px,float py) {
    if(px<0||py<0||px>=MapW*Tile||py>=MapH*Tile)return true;
    if(solidTerrain(terrainAt(int(px)/Tile,int(py)/Tile)))return true;
    bool hit=false;
    forObjectsNear(px,py,3,[&](int i){const Obj& o=objs[i];if(hit||!objectSolid(o))return;
        if(kinds[o.kind].flags&F_TALLBOX){if(px>o.x-o.hw&&px<o.x+o.hw&&py>o.y-o.hh*3&&py<o.y+2)hit=true;return;}
        if(fabsf(px-o.x)<o.hw&&fabsf(py-o.y)<o.hh)hit=true;});
    return hit;
}
// Feet box (8x6) used by every walking actor.
bool blockedFeet(float px,float py,int hw=4,int hh=3) {
    for(int dy=-hh;dy<=hh;dy+=hh*2)for(int dx=-hw;dx<=hw;dx+=hw*2){
        int x=int(px+dx),y=int(py+dy);
        if(x<0||y<0||x>=MapW*Tile||y>=MapH*Tile)return true;
        if(solidTerrain(terrainAt(x/Tile,y/Tile)))return true;
    }
    bool hit=false;
    forObjectsNear(px,py,3,[&](int i){const Obj& o=objs[i];if(hit||!objectSolid(o))return;
        if(fabsf(px-o.x)<o.hw+hw&&fabsf(py-o.y)<o.hh+hh)hit=true;});
    return hit;
}
bool lineClear(float x,float y,float tx,float ty) {
    float dx=tx-x,dy=ty-y;int steps=int(fmaxf(fabsf(dx),fabsf(dy))/3)+1;
    for(int i=1;i<steps;++i)if(solidAt(x+dx*i/steps,y+dy*i/steps-4))return false;
    return true;
}
inline bool inCover(float x,float y){int tx=int(x)/Tile,ty=int(y)/Tile;return tx>=0&&ty>=0&&tx<MapW&&ty<MapH&&world.cover[ty*MapW+tx];}
}
