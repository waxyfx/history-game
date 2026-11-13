#pragma once
// Save format v3: explicit little-endian WASM words (no struct layout, no pointers).
// v1/v2 belonged to the single-screen prototype map and cannot be mapped onto MAP01 v3;
// they are rejected with -2 so the UI can explain why and start a fresh journey.
namespace tj {
constexpr uint32_t SaveMagic=0x544a5250,SaveVersion=3;
constexpr int SaveCount=24+ItemCount+EnemyCount*2;
uint32_t saveWords[96];
uint32_t saveChecksum(int count) {
    uint32_t hash=2166136261u;
    for(int i=0;i<count;++i)if(i!=3)for(int shift=0;shift<32;shift+=8){hash^=(saveWords[i]>>shift)&255;hash*=16777619u;}
    return hash;
}
int serialize() {
    const Player& p=players[0];
    if(p.attack.active||p.dead||p.down||game.cinematic)return 0;
    auto* w=saveWords;
    w[0]=SaveMagic;w[1]=SaveVersion;w[2]=SaveCount;w[3]=0;
    w[4]=uint32_t(p.x*1000);w[5]=uint32_t(p.y*1000);w[6]=game.zone;w[7]=p.hp;w[8]=game.lives;w[9]=p.weapon;
    w[10]=game.visited;w[11]=p.facing;w[12]=game.staticPicked;
    uint32_t tags=0;for(int i=1;i<TagCount&&i<32;++i)if(world.hiddenTag[i])tags|=1u<<i;
    uint32_t ias=0;for(int i=0;i<InteractCount&&i<32;++i)if(world.iaEnabled[i])ias|=1u<<i;
    w[13]=tags;w[14]=ias;w[15]=game.triggerFired;w[16]=game.triggerArmed;w[17]=game.groups;w[18]=game.torch;
    w[19]=game.checkX;w[20]=game.checkY;w[21]=game.kills;w[22]=game.completedTasks;w[23]=game.storyEvents;
    for(int i=0;i<ItemCount;++i)w[24+i]=game.inv.counts[i];
    for(int i=0;i<EnemyCount;++i){const auto& e=enemies[i];w[24+ItemCount+i*2]=e.active?e.hp:0;w[25+ItemCount+i*2]=e.alerted;}
    w[3]=saveChecksum(SaveCount);
    return SaveCount*4;
}
int restore(int length) {
    const auto* w=saveWords;
    if(length<16||length>int(sizeof(saveWords))||length%4||w[0]!=SaveMagic)return -1;
    if(w[1]!=SaveVersion)return -2;
    // Accept the current layout and the MAP01 layout written before the item list grew (14 items).
    int nItems=int(w[2])-24-EnemyCount*2;
    if((nItems!=ItemCount&&nItems!=LegacyItemCount)||length!=int(w[2])*4||w[3]!=saveChecksum(int(w[2])))return -1;
    float x=w[4]/1000.f,y=w[5]/1000.f;
    if(w[4]>=uint32_t(MapW*Tile*1000)||w[5]>=uint32_t(MapH*Tile*1000)||w[6]>=uint32_t(ZoneCount)||w[7]>100||w[8]>3||w[9]>2||w[11]>7)return -1;
    if(w[10]<1||w[10]>=(1u<<ZoneCount)||(w[7]==0)!=(w[8]==0))return -1;
    if(blockedFeet(x,y))return -1;
    for(int i=0;i<nItems;++i)if(w[24+i]>uint32_t(items[i].limit))return -1;
    if(w[24]!=1)return -1; // the sword is never lost
    for(int i=0;i<EnemyCount;++i)if(w[24+nItems+i*2]>uint32_t(enemySpecs[enemyDefs[i].type].health))return -1;
    // Validation passed: rebuild the world, then apply the saved state.
    int paused=game.paused,netRole=game.netRole,party=game.partySize,sheet=players[0].sheet;
    reset();
    game.paused=paused;game.netRole=netRole;game.partySize=party;
    Player& p=players[0];p.sheet=sheet;
    p.x=p.tx=x;p.y=p.ty=y;game.zone=w[6];p.hp=w[7];game.lives=w[8];p.weapon=w[9];game.visited=w[10];p.facing=w[11];
    game.staticPicked=w[12];
    for(auto& k:pickups)if(k.active&&k.id>=0&&((game.staticPicked>>k.id)&1))k.active=false;
    for(int i=1;i<TagCount&&i<32;++i)world.hiddenTag[i]=(w[13]>>i)&1;
    for(int i=0;i<InteractCount&&i<32;++i)world.iaEnabled[i]=(w[14]>>i)&1;
    game.triggerFired=w[15];game.triggerArmed=w[16];game.groups=w[17];game.torch=w[18];
    game.checkX=w[19];game.checkY=w[20];game.kills=w[21];game.completedTasks=w[22];game.storyEvents=w[23];
    for(int i=0;i<ItemCount;++i)game.inv.counts[i]=i<nItems?w[24+i]:0;
    for(int i=0;i<EnemyCount;++i){auto& e=enemies[i];e.hp=w[24+nItems+i*2];e.active=e.hp>0;e.alerted=0;}
    game.gameover=!game.lives;p.invuln=60;
    if(!p.hp)p.hp=p.maxhp;
    snapCamera();
    return 1;
}
}
