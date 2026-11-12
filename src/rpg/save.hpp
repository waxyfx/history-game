#pragma once
// Explicit little-endian WASM words, no compiler struct layout or pointers.
// v1 (31 words) is migrated by supplying empty task/event flags; v2 has 33.
namespace tj {
constexpr uint32_t SaveMagic=0x544a5250,SaveVersion=2;
uint32_t saveWords[64];
uint32_t saveChecksum(int count) {
    uint32_t hash=2166136261u;
    for(int i=0;i<count;++i)if(i!=3)for(int shift=0;shift<32;shift+=8){hash^=(saveWords[i]>>shift)&255;hash*=16777619u;}
    return hash;
}
int serialize() {
    if(game.transition||game.attack.active||game.dying)return 0;
    auto* w=saveWords;
    w[0]=SaveMagic;w[1]=SaveVersion;w[2]=33;w[3]=0;
    w[4]=uint32_t(game.x*1000);w[5]=uint32_t(game.y*1000);w[6]=game.zone;
    w[7]=game.health;w[8]=game.lives;w[9]=game.weapon;w[10]=game.visited;w[11]=game.facing;w[12]=game.inventory.picked;
    for(int i=0;i<ItemCount;++i)w[13+i]=game.inventory.counts[i];
    // Word 21 reserved; must remain zero in both schemas.
    w[21]=0;
    for(int i=0;i<EnemyCount;++i){w[22+i*3]=enemies[i].health;w[23+i*3]=uint32_t(enemies[i].x*1000);w[24+i*3]=uint32_t(enemies[i].y*1000);}
    w[31]=game.completedTasks;w[32]=game.storyEvents;w[3]=saveChecksum(33);
    return 33*4;
}
bool validFeet(int zone,float x,float y) {
    return !solid(zone,x-4,y-3)&&!solid(zone,x+4,y-3)&&!solid(zone,x-4,y+3)&&!solid(zone,x+4,y+3);
}
int restore(int length) {
    const auto* w=saveWords;
    if(length<16||length>int(sizeof(saveWords))||length%4||w[0]!=SaveMagic)return -1;
    if(w[1]!=1&&w[1]!=SaveVersion)return -2;
    int count=w[1]==1?31:33;
    if(length!=count*4||w[2]!=uint32_t(count)||w[3]!=saveChecksum(count))return -1;
    if(w[4]>=Width*1000||w[5]>=Height*1000||w[6]>=ZoneCount||w[7]>100||w[8]>3||w[9]>2||w[10]<1||w[10]>=(1u<<ZoneCount)||w[11]>7||w[12]>=(1u<<PickupCount)||w[21]!=0)return -1;
    if((w[7]==0)!=(w[8]==0)||!(w[10]&(1u<<w[6])))return -1;
    Game next;next.x=w[4]/1000.f;next.y=w[5]/1000.f;next.zone=w[6];
    if(!validFeet(next.zone,next.x,next.y))return -1;
    next.health=w[7];next.lives=w[8];next.weapon=w[9];next.visited=w[10];next.facing=w[11];next.inventory.picked=w[12];
    for(int i=0;i<ItemCount;++i) {
        if(w[13+i]>uint32_t(items[i].limit)||(i<3&&w[13+i]!=1))return -1;
        next.inventory.counts[i]=w[13+i];
    }
    Enemy restored[EnemyCount];
    for(int i=0;i<EnemyCount;++i) {
        if(w[22+i*3]>uint32_t(enemySpecs[i].health)||w[23+i*3]>=Width*1000||w[24+i*3]>=Height*1000)return -1;
        restored[i]=Enemy{};auto& e=restored[i];e.type=i;e.health=w[22+i*3];e.homeX=232+i*80;e.homeY=264;
        e.x=w[23+i*3]/1000.f;e.y=w[24+i*3]/1000.f;
        if(!validFeet(1,e.x,e.y))return -1;
        e.state=e.health?Idle:Death;e.timer=45;e.attack.cooldown=60;
    }
    if(w[1]==2){next.completedTasks=w[31];next.storyEvents=w[32];}
    next.gameover=!next.lives;next.event=next.gameover?5:0;
    next.paused=game.paused;next.invulnerable=60;
    // Commit only after all validation. Frame state and projectiles are reset.
    game=next;for(int i=0;i<EnemyCount;++i)enemies[i]=restored[i];
    for(auto& p:projectiles)p.active=false;
    return w[1]==1?2:1;
}
}
