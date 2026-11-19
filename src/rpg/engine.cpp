// Tarikh Joly - MAP01 "Алғашқы іздер" top-down engine (C++17 -> standalone WASM).
// C++ owns simulation (movement, collisions, combat, AI, interaction, events) and
// renders the RGBA framebuffer from the sprite atlas. JS owns story, UI, audio and network.
#include "world.hpp"
#include "combat.hpp"
#include "inventory.hpp"
#include "effects.hpp"
namespace tj {
Renderer renderer;
enum Keys { Up=1, Down=2, Left=4, Right=8, Interact=16, Strike=32, Run=64, Reload=128, Parry=256 };
constexpr int MaxPlayers=3;

// ------------------------------------------------------------------ events (polled by JS)
enum EventType { EV_NONE, EV_SFX, EV_INTERACT, EV_TRIGGER, EV_ENEMY_DIED, EV_PICKUP, EV_HURT, EV_DOWN, EV_DEAD,
                 EV_REVIVED, EV_ZONE, EV_ENEMY_HIT, EV_PEER_HIT, EV_REVIVE_PEER, EV_PLATES, EV_ALERT, EV_HOLD_START, EV_NOAMMO,
                 EV_EFFECT /* a=effect id, b=1 start, 2 refreshed, 0 ended */, EV_USED /* a=item, b=healed hp */,
                 EV_RELOAD /* a=1 started, 0 done */, EV_PARRY, EV_IMPACT /* a=x, b=y: where a player's round stopped */ };
enum Sfx { SFX_STEP_GRASS, SFX_STEP_DIRT, SFX_STEP_WATER, SFX_STEP_CAVE, SFX_SWORD, SFX_SPEAR, SFX_BOW, SFX_ARROW_HIT,
           SFX_ENEMY_HURT, SFX_ENEMY_DIE, SFX_HOWL, SFX_GROWL, SFX_ROAR, SFX_SWIPE, SFX_SHOUT, SFX_PICKUP, SFX_SPLASH,
           SFX_HOOVES, SFX_BLOCK, SFX_DOWN, SFX_REVIVE, SFX_IMPACT, SFX_BOWSTRING,
           SFX_MUSKET, SFX_RIFLE, SFX_SMG, SFX_PULSE, SFX_RELOAD, SFX_BOLT, SFX_DRY, SFX_VENT, SFX_PARRY, SFX_RICOCHET };
struct Event { int type,a,b; };
Event events[96]; int eventCount=0;
void emit(int type,int a=0,int b=0){ if(eventCount<96)events[eventCount++]={type,a,b}; }

// ------------------------------------------------------------------ entities
struct Player {
    bool active=false,remote=false;
    int sheet=art::SH_AIBAR;
    float x=0,y=0,tx=0,ty=0;
    int facing=4,anim=art::A_IDLE,animTime=0;
    int hp=100,maxhp=100,hurt=0,invuln=0;
    int keys=0; bool moving=false,running=false;
    int weapon=Sword; Attack attack;
    int down=0,dead=0,pose=-1,poseTime=0;
    float stepAcc=0;
    int holdKind=-1,holdId=-1,holdTicks=0,holdNeed=0;
    int netFrame=0;
    int burstLeft=0,burstT=0,combo=0,lastStrike=-999,combo_last=-999;   // burst fire, quick chain clock, the three-cut series clock
    // Ranged slot state: rounds in the weapon (taken from the cartridges), reload / bolt / overheat timers.
    int mag=0,reloadT=0,cycleT=0,fireCd=0,aimT=0,autoN=0,overheat=0,dryT=0; float heat=0;
    int parryT=0,parryCd=0,counterT=0;   // MAP05 sabre: the parry window, its cooldown, the counter-cut window
    int loadOnGrant=0;   // a gun handed over before its cartridges: it is loaded with the first ones given
};
struct Npc {
    bool active=true,hidden=false,talk=true;
    int sheet=0; float x=0,y=0; int facing=4,anim=art::A_IDLE,animTime=0;
    int way=0,wait=0,mode=0; // 0 routine, 1 scripted goto, 2 hold position
    float gx=0,gy=0; bool run=false; int holdAnim=art::A_IDLE,bubble=0,alert=0,greeted=0;
};
struct Animal { bool active=true; int sheet; float x,y,hx,hy,vx=0,vy=0,tvx=0,tvy=0; int facing=2,anim=art::A_IDLE,animTime=0,timer=0,flee=0,calm=0,turn=0,bump=0; };
struct Enemy {
    bool active=true,enabled=true;
    int type=0,group=0,hp=0,state=Idle,facing=4,timer=0,anim=art::A_IDLE,animTime=0,target=-1,alerted=0,seed=0,hitFlash=0,showBar=0,phase=1,special=0,illusions=0;
    float px[3]{},py[3]{};
    int leash=0;   // ticks of walking home after giving up the chase (no re-alert, no shout)
    float x=0,y=0,homeX=0,homeY=0,dx=0,dy=0,nx=0,ny=0,lx=0,ly=0; // lx/ly: the hero a tick ago (MAP05 prediction)
    int aux=0;
    Attack attack;
};
struct Pickup { bool active=false; int item=0,qty=0,id=-1; float x=0,y=0; int bob=0; };
struct Particle { float x,y,vx,vy; short life,max; uint8_t type; uint32_t color; };
constexpr int MaxParticles=420, MaxPickups=40;

// Pickups, NPC roles, areas, lights and enemy sheets are level data (gen/mapNN.hpp).

struct Game {
    int ticks=0,zone=0,visited=1,lives=3,gameover=0,paused=0,control=1,cinematic=0,netRole=0,partySize=1;
    Inventory inv;
    float camX=0,camY=0,camTX=0,camTY=0,camSpeed=2; int camMode=0,shake=0;
    int ambT[3]={200,200,200},amb[3]={200,200,200},worldAmb[3]={200,200,200};
    int fog=0,fogCur=0,torch=0;
    int checkX=level::SpawnX,checkY=level::SpawnY;
    int focusKind=-1,focusId=-1;
    int bullets=0,burst=0,bossFloor=0;   // MAP08–MAP10: firearms, burst fire, sabre combo, the finale's health floor (%)
    int questKind=-1,questId=-1;   // the current objective (set by JS): a bobbing marker shows where to go
    unsigned triggerFired=0,triggerArmed=0xffffffffu,staticPicked=0;
    int platesMask=0,groups=0x3,kills=0,lastPickup=0,alarm=0;
    int shadowX=0,shadowY=0,shadowAlpha=0;
    unsigned completedTasks=0,storyEvents=0;
    int prevKeys=0,interactCooldown=0,hurtFlash=0;
    int hitRanged=0; float knockNow=0;   // the hit being resolved: from a projectile (no parry) / a heavy blow's extra push
    float flashX=0,flashY=0; int flashT=0,flashKind=0;   // the last muzzle flash
    ActiveEffect fx[MaxEffects]; int useCooldown=0;
} game;
Player players[MaxPlayers];
Npc npcs[NpcCount];
Animal animals[AnimalCount];
Enemy enemies[EnemyCount];
Projectile projectiles[MaxProjectiles];
Pickup pickups[MaxPickups];
Particle particles[MaxParticles];
uint8_t cloud[64*64];
unsigned rngState=12345;
inline unsigned rng(){ rngState=rngState*1664525u+1013904223u; return rngState>>8; }
inline float frand(){ return (rng()&0xffff)/65535.f; }
static unsigned hash2(unsigned x,unsigned y){unsigned n=x*374761393u+y*668265263u+17;n=(n^(n>>13))*1274126177u;return n^(n>>16);}

Player& me(){ return players[0]; }
int areaIndex(){ return areaOfZone[game.zone<0||game.zone>=ZoneCount?0:game.zone]; }
const Area& area(){ return areas[areaIndex()]; }

void sfx(int id,float x,float y){
    float dx=x-(game.camX+Width/2),dy=y-(game.camY+Height/2);
    int d=int(sqrtf(dx*dx+dy*dy)); if(d>420)return;
    emit(EV_SFX,id,d|((dx<0?1:0)<<15));
}
void particle(float x,float y,float vx,float vy,int life,int type,uint32_t color=0){
    for(auto& p:particles)if(p.life<=0){p={x,y,vx,vy,(short)life,(short)life,(uint8_t)type,color};return;}
}

// ------------------------------------------------------------------ setup
void spawnPickup(int item,int qty,float x,float y,int id=-1){
    for(auto& p:pickups)if(!p.active){p={true,item,qty,id,x,y,int(rng()%60)};return;}
}
void initActors(){
    for(int i=0;i<NpcCount;++i){Npc n;n.sheet=npcDefs[i].sheet;n.x=npcDefs[i].x;n.y=npcDefs[i].y;n.wait=npcDefs[i].way[0].wait;n.anim=npcDefs[i].way[0].anim;npcs[i]=n;}
    for(int i=0;i<NpcCount;++i)if(npcDefs[i].flags&1)npcs[i].active=false;
    for(int i=0;i<AnimalCount;++i){Animal a;a.sheet=animalDefs[i].sheet;a.x=a.hx=animalDefs[i].x;a.y=a.hy=animalDefs[i].y;a.timer=int(rng()%200);animals[i]=a;}
    for(int i=0;i<EnemyCount;++i){Enemy e;e.type=enemyDefs[i].type;e.group=enemyDefs[i].group;e.x=e.homeX=enemyDefs[i].x;e.y=e.homeY=enemyDefs[i].y;
        e.hp=enemySpecs[e.type].health;e.seed=i*7+3;e.nx=e.x;e.ny=e.y;e.timer=int(rng()%90);enemies[i]=e;}
    for(auto& p:pickups)p.active=false;
    for(int i=0;i<PickupDefCount;++i)spawnPickup(pickupDefs[i].item,pickupDefs[i].qty,pickupDefs[i].x,pickupDefs[i].y,i);
}
void initCloud(){
    unsigned s=77;
    uint8_t base[16*16];for(int i=0;i<256;++i){s=s*1103515245u+12345u;base[i]=(s>>16)&255;}
    for(int y=0;y<64;++y)for(int x=0;x<64;++x){
        float fx=x/4.f,fy=y/4.f;int x0=int(fx),y0=int(fy);float tx=fx-x0,ty=fy-y0;tx=tx*tx*(3-2*tx);ty=ty*ty*(3-2*ty);
        auto b=[&](int a,int c){return float(base[(c&15)*16+(a&15)]);};
        float v=(b(x0,y0)*(1-tx)+b(x0+1,y0)*tx)*(1-ty)+(b(x0,y0+1)*(1-tx)+b(x0+1,y0+1)*tx)*ty;
        cloud[y*64+x]=uint8_t(v);
    }
}

// ------------------------------------------------------------------ combat helpers
bool launch(int owner,float x,float y,int facing,int damage,bool cosmetic=false,bool fire=false){
    for(auto& p:projectiles)if(!p.active){auto d=directions[facing];float sp=fire?2.6f:4.2f;
        p.active=true;p.cosmetic=cosmetic;p.fire=fire;p.bullet=0;p.owner=owner;p.damage=damage;p.facing=facing;p.x=x+d.x*6;p.y=y+d.y*6;p.dx=d.x*sp;p.dy=d.y*sp;
        p.remaining=owner<0?weapons[Bow].range+20:220;return true;}
    return false;
}
// The hero's arrow: a fuller draw flies faster and farther and hits harder.
bool launchArrow(float x,float y,int facing,int damage,int draw){
    for(auto& p:projectiles)if(!p.active){auto d=directions[facing];float sp=fire.speed+draw*.04f;
        p=Projectile{};p.active=true;p.owner=-1;p.damage=damage*(80+draw)/80;p.facing=facing;p.x=x+d.x*6;p.y=y+d.y*6;p.dx=d.x*sp;p.dy=d.y*sp;
        p.remaining=weapons[Bow].range+20+draw*2;return true;}
    return false;
}
// A lead round: several times an arrow's speed, a free angle (spread), its own range.
bool launchBullet(float x,float y,float dx,float dy,int damage){
    for(auto& p:projectiles)if(!p.active){
        p=Projectile{};p.active=true;p.bullet=1;p.owner=-1;p.damage=damage;p.facing=heading(dx,dy);p.x=x;p.y=y;p.dx=dx*fire.speed;p.dy=dy*fire.speed;
        p.remaining=weapons[Bow].range;return true;}
    return false;
}
bool startAttack(Attack& a,int weapon,int facing,float x,float y){
    if(a.cooldown||a.active)return false;
    a.age=0;a.weapon=weapon;a.facing=facing;a.cooldown=weapons[weapon].windup+weapons[weapon].recovery;a.active=true;a.connected=false;a.counter=false;a.draw=0;a.x=x;a.y=y;return true;
}
// ------------------------------------------------------------------ timed effects (data in effects.hpp)
int effectSum(int kind){ int s=0; for(const auto& f:game.fx)if(f.id&&effectDefs[f.id].kind==kind)s+=effectDefs[f.id].magnitude; return s>KindCap[kind]?KindCap[kind]:s; }
int outgoingDamage(int base){ return base*(100+effectSum(KindDamage))/100; }
int incomingDamage(int dmg){ int r=dmg*(100-effectSum(KindDefense))/100; return r<1?1:r; }
float speedFactor(){ return 1.f+effectSum(KindSpeed)/100.f; }
bool hasEffect(int id){ for(const auto& f:game.fx)if(f.id==id)return true; return false; }
void burst(float x,float y,uint32_t color,int n){ for(int i=0;i<n;++i)particle(x+(frand()-.5f)*12,y-4-frand()*18,(frand()-.5f)*1.2f,-.3f-frand()*1.1f,26,0,rgba(color)); }
// Same effect: refresh to full duration (no magnitude stacking). New effect: free slot, else replace the one ending soonest.
void applyEffect(int id){
    if(id<=0||id>=EffectIdCount)return;
    for(auto& f:game.fx)if(f.id==id){f.ticks=effectDefs[id].duration;emit(EV_EFFECT,id,2);return;}
    ActiveEffect* slot=nullptr;for(auto& f:game.fx)if(!f.id){slot=&f;break;}
    if(!slot){slot=&game.fx[0];for(auto& f:game.fx)if(f.ticks<slot->ticks)slot=&f;emit(EV_EFFECT,slot->id,0);}
    slot->id=id;slot->ticks=effectDefs[id].duration;emit(EV_EFFECT,id,1);
    burst(me().x,me().y,effectDefs[id].color,18);
}
void clearEffects(){ for(auto& f:game.fx)f=ActiveEffect{}; }
// Timers run only while the game runs (not during cutscenes, dialogue or pause).
void tickEffects(){
    Player& p=me();
    if(game.useCooldown)--game.useCooldown;
    if(game.cinematic||p.hp<=0||p.down||p.dead)return;
    for(auto& f:game.fx)if(f.id){const EffectDef& d=effectDefs[f.id];
        if(d.kind==KindRegen&&f.ticks%60==0&&p.hp<p.maxhp){p.hp+=d.magnitude;if(p.hp>p.maxhp)p.hp=p.maxhp;}
        bool ending=f.ticks<180&&(f.ticks/8)%2;              // last 3 s: visuals flicker
        if(!ending){
            if(d.visual==0&&game.ticks%3==0){particle(p.x+(frand()-.5f)*12,p.y-2-frand()*16,(frand()-.5f)*.3f,-.5f,22,0,rgba(d.color));particle(p.x+(frand()-.5f)*8,p.y-6-frand()*12,0,-.7f,16,0,rgba(0xffb08a));}
            else if(d.visual==2&&p.moving&&game.ticks%2==0)particle(p.x-directions[p.facing].x*5+(frand()-.5f)*4,p.y-2-frand()*10,-directions[p.facing].x*.4f,0,16,0,rgba(d.color,200));
            else if(d.visual==3&&game.ticks%4==0)particle(p.x+directions[p.facing].x*8+(frand()-.5f)*6,p.y-8-frand()*8,(frand()-.5f)*.4f,-.7f,20,0,rgba(frand()<.5f?d.color:0xffd35a));
            else if(d.visual==4&&game.ticks%9==0)particle(p.x+(frand()-.5f)*10,p.y-frand()*14,0,-.35f,30,0,rgba(d.color));
        }
        if(--f.ticks<=0){emit(EV_EFFECT,f.id,0);burst(p.x,p.y,0xd8d8d8,10);f=ActiveEffect{};}
    }
}
void dropLoot(const Enemy& e){
    int k=0;
    for(const auto& d:drops)if(d.type==e.type&&int(rng()%100)<d.chance){spawnPickup(d.item,d.qty,e.x+(k%3-1)*9,e.y+(k/3)*6);++k;}
    if(e.type==Shade)for(int i=0;i<16;++i)particle(e.x,e.y-12,(frand()-.5f)*2,-frand()*2,40,0,rgba(0xa35cc0));
}
bool isBossType(int t){ return t==Keeper||t==Rider||t==Witness||t==Image||t==Herald||t==Zulmat; }
void alertGroup(int group){ for(auto& e:enemies)if(e.group==group&&e.hp>0&&!e.alerted){e.alerted=1;emit(EV_ALERT,int(&e-enemies),e.type);} }
void hurtEnemy(Enemy& e,int damage,float fromX,float fromY){
    if(e.hp<=0||!e.enabled)return;
    if(e.type==Bear&&e.state==Stunned)damage=damage*3/2;
    if(e.type==Rider){
        // On foot the golden armour deflects every frontal blow; the back, the moment after his strike and the daze are open.
        if(e.phase>=2&&e.special!=5&&e.special!=6&&e.state!=Roar){auto d=directions[e.facing];float ax=fromX-e.x,ay=fromY-e.y,l=sqrtf(ax*ax+ay*ay)+.01f;
            if((ax*d.x+ay*d.y)/l>.3f){for(int i=0;i<8;++i)particle(e.x+d.x*8,e.y-14,(frand()-.5f)*2.4f,-frand()*1.6f,16,0,rgba(0xffe08a));
                e.showBar=240;alertGroup(e.group);sfx(SFX_BLOCK,e.x,e.y);emit(EV_ALERT,int(&e-enemies),-1);return;}}
        if(e.special==6)damage*=2;
    }
    if(e.type==Witness){ // behind three banners no blow lands; spent, he takes half again as much
        if(e.state==Roar||(e.phase==2&&e.illusions)){for(int i=0;i<8;++i)particle(e.x,e.y-20,(frand()-.5f)*2.4f,-frand()*1.6f,16,0,rgba(0xd29ae6));
            e.showBar=240;alertGroup(e.group);sfx(SFX_BLOCK,e.x,e.y);return;}
        if(e.special==6)damage=damage*3/2;
        // Each face must be fought: burst damage stops at the next phase boundary.
        int floor=e.phase==1?enemySpecs[e.type].health*2/3:e.phase==2?enemySpecs[e.type].health/3:0;
        if(damage>e.hp-floor)damage=e.hp-floor;
        if(damage<=0)return;
    }
    if(e.type==Zulmat){ // shielded while he writes; in the finale his health stops at the level's floor
        if(e.state==Roar||e.special==7){for(int i=0;i<8;++i)particle(e.x,e.y-20,(frand()-.5f)*2.4f,-frand()*1.6f,16,0,rgba(0x7ff5e4));
            e.showBar=240;sfx(SFX_BLOCK,e.x,e.y);return;}
        if(e.special==5)damage=damage*3/2;
        int maxh=enemySpecs[e.type].health,floor=e.phase==1?maxh*2/3:e.phase==2?maxh/3:maxh*game.bossFloor/100;
        if(damage>e.hp-floor)damage=e.hp-floor;
        if(damage<=0)return;
    }
    if(e.type==Herald){ // seals and the reading shield him; at full gallop blows only graze him
        if(e.state==Roar||(e.phase==2&&e.illusions)||(e.phase==3&&e.special==7)){for(int i=0;i<8;++i)particle(e.x,e.y-20,(frand()-.5f)*2.4f,-frand()*1.6f,16,0,rgba(0xffd24a));
            e.showBar=240;alertGroup(e.group);sfx(SFX_BLOCK,e.x,e.y);return;}
        if(e.phase==1&&e.special!=3)damage/=2;
        if(e.special==5||e.special==6)damage=damage*3/2;
        int floor=e.phase==1?enemySpecs[e.type].health*2/3:e.phase==2?enemySpecs[e.type].health/3:0;
        if(damage>e.hp-floor)damage=e.hp-floor;
        if(damage<=0)return;
    }
    if(e.type==Image){ // the second image: blows pass through him while he refuses to fight
        if(e.special==9||e.state==Roar){for(int i=0;i<8;++i)particle(e.x+(frand()-.5f)*10,e.y-16-frand()*10,(frand()-.5f)*1.6f,-frand()*1.2f,18,0,rgba(0x86cdbd));
            e.showBar=240;if(e.special!=9){sfx(SFX_BLOCK,e.x,e.y);}return;}
        if(e.special==5||e.special==6)damage=damage*3/2;
        int floor=e.phase==1?enemySpecs[e.type].health*2/3:enemySpecs[e.type].health/3;
        if(damage>e.hp-floor)damage=e.hp-floor;
        if(damage<=0)return;
    }
    e.hp=e.hp>damage?e.hp-damage:0;e.hitFlash=8;e.showBar=240;
    alertGroup(e.group);e.alerted=1;
    float dx=e.x-fromX,dy=e.y-fromY,len=sqrtf(dx*dx+dy*dy)+.01f;
    float kb=e.type==Bear?2:7+(isBossType(e.type)?0:game.knockNow);
    if(!blockedFeet(e.x+dx/len*kb,e.y,5,3))e.x+=dx/len*kb;
    if(!blockedFeet(e.x,e.y+dy/len*kb,5,3))e.y+=dy/len*kb;
    for(int i=0;i<5;++i)particle(e.x,e.y-8,(frand()-.5f)*2,-frand()*1.5f,18,0,rgba(0xf3d68b));
    if(e.hp==0){e.state=Death;e.timer=isBossType(e.type)?200:150;e.illusions=0;e.attack.active=false;e.animTime=0;++game.kills;dropLoot(e);
        sfx(SFX_ENEMY_DIE,e.x,e.y);emit(EV_ENEMY_DIED,int(&e-enemies),e.type);}
    else { if(!isBossType(e.type)&&(e.type!=Bear||e.state!=Charge)){e.state=Hurt;e.timer=12+int(game.knockNow*1.5f);e.attack.active=false;} sfx(SFX_ENEMY_HURT,e.x,e.y); }
}
// Player-side hit on an enemy: the host applies it, a network client only predicts the flash.
void playerHitsEnemy(int index,int damage,float fx,float fy){
    Enemy& e=enemies[index];
    if(game.netRole==1){e.hitFlash=8;e.showBar=240;emit(EV_ENEMY_HIT,index,damage);sfx(SFX_ENEMY_HURT,e.x,e.y);return;}
    hurtEnemy(e,damage,fx,fy);
}
void parryFx(Player& p){
    auto d=directions[p.facing];
    for(int i=0;i<14;++i)particle(p.x+d.x*10,p.y-12+d.y*4,(frand()-.5f)*3+d.x,(frand()-.5f)*2-1,14,0,rgba(frand()<.5f?0xfff6c8:0xffd24a));
    sfx(SFX_PARRY,p.x,p.y);game.shake=3;emit(EV_PARRY);
}
void damageLocal(int damage){
    Player& p=me();
    if(damage<=0||p.hp<=0||p.invuln||p.down||p.dead||game.cinematic)return;
    if(p.parryT>0&&!game.hitRanged){   // MAP05 sabre: the blade meets the blow; the attacker is thrown off balance
        p.parryT=0;p.counterT=50;p.invuln=12;parryFx(p);
        auto d=directions[p.facing];
        for(auto& e:enemies)if(e.enabled&&e.hp>0){float dx=e.x-p.x,dy=e.y-p.y,l=sqrtf(dx*dx+dy*dy)+.01f;
            if(l<48&&(dx*d.x+dy*d.y)/l>-.2f){ if(!isBossType(e.type)&&e.type!=Bear){e.state=Stunned;e.timer=70;e.attack.active=false;}
                else {e.showBar=240;e.hitFlash=6;} }}
        return;
    }
    damage=incomingDamage(damage);
    if(effectSum(KindDefense))burst(p.x,p.y,0x8fc3ee,6);
    p.hp=damage>=p.hp?0:p.hp-damage;p.invuln=50;p.hurt=12;p.attack.active=false;p.holdTicks=0;game.hurtFlash=14;game.shake=6;
    emit(EV_HURT,damage,p.hp);
    if(p.hp==0){
        clearEffects();
        p.keys=0;p.moving=false;
        if(game.partySize>1){p.down=60*30;emit(EV_DOWN);sfx(SFX_DOWN,p.x,p.y);}
        else {p.dead=100;sfx(SFX_DOWN,p.x,p.y);}
    }
}
void hitPlayer(int slot,int damage){
    if(slot==0)damageLocal(damage);
    else if(players[slot].active&&players[slot].hp>0&&!players[slot].down)emit(EV_PEER_HIT,slot,damage);
}
void strikeEnemies(const Attack& a){
    for(int i=0;i<EnemyCount;++i){auto& e=enemies[i];
        if(e.enabled&&e.hp>0&&inArc(a.weapon,a.facing,a.x,a.y-4,e.x,e.y-4,a.charge?14:a.counter?8:0)&&lineClear(a.x,a.y,e.x,e.y)){
            game.knockNow=a.weapon<2?melee[a.weapon].knock:0;
            playerHitsEnemy(i,outgoingDamage(weapons[a.weapon].damage)*(a.charge?3:a.counter?4:2)/2,a.x,a.y);game.knockNow=0;}}
    // MAP06: only a lance charge breaks the herald's tamga seals.
    if(a.charge)for(auto& e:enemies)if(e.type==Herald&&e.phase==2&&e.enabled&&e.illusions&&e.hp>0)for(int k=0;k<3;++k)if((e.illusions&(1<<k))&&inArc(a.weapon,a.facing,a.x,a.y-4,e.px[k],e.py[k]-4,14)){
        e.illusions&=~(1<<k);sfx(SFX_IMPACT,e.px[k],e.py[k]);game.shake=6;for(int i=0;i<22;++i)particle(e.px[k],e.py[k]-8,(frand()-.5f)*3,(frand()-.5f)*3,30,0,rgba(0xffd24a));}
    for(auto& e:enemies)if((e.type==Rider||((e.type==Witness||e.type==Image)&&e.phase==2))&&e.enabled&&e.illusions&&e.hp>0)for(int k=0;k<3;++k)if((e.illusions&(1<<k))&&inArc(a.weapon,a.facing,a.x,a.y-4,e.px[k],e.py[k]-4)&&lineClear(a.x,a.y,e.px[k],e.py[k])){
        e.illusions&=~(1<<k);sfx(SFX_BLOCK,e.px[k],e.py[k]);for(int i=0;i<22;++i)particle(e.px[k],e.py[k]-18,(frand()-.5f)*3,(frand()-.5f)*3,30,0,rgba(0xd29ae6));}
    // NPC reaction: villagers flinch when someone swings next to them.
    for(auto& n:npcs)if(n.active&&!n.hidden){float dx=n.x-a.x,dy=n.y-a.y;if(dx*dx+dy*dy<48*48)n.alert=90;}
}

// ------------------------------------------------------------------ players
int animFrameTicks(int anim){
    switch(anim){case art::A_WALK:return 7;case art::A_RUN:return 5;case art::A_IDLE:return 16;case art::A_WORK:return 11;
        case art::A_TALK:return 14;case art::A_SIT:return 36;case art::A_GRAZE:return 24;case art::A_HURT:return 7;case art::A_DEATH:return 12;
        case art::A_VICTORY:return 14;case art::A_INTERACT:return 9;case art::A_REVIVE:return 16;case art::A_HOWL:return 30;case art::A_ROAR:return 20;
        case art::A_CHARGE:return 4;default:return 8;}
}
void setAnim(int& anim,int& t,int next){ if(anim!=next){anim=next;t=0;} }
int stepSfx(float x,float y){int t=terrainAt(int(x)/Tile,int(y)/Tile);
    return t==Shallow||t==Water?SFX_STEP_WATER:t==Cave?SFX_STEP_CAVE:(t==Dirt||t==Sand||t==Camp)?SFX_STEP_DIRT:SFX_STEP_GRASS;}

// ---------------------------------------------------------------- firearms (the ranged slot when it is not a bow)
void startReload(Player& p){
    int ammo=game.inv.counts[IArrows-1];
    if(fire.kind==FireBow||fire.kind==FireBeam||p.reloadT||p.mag>=fire.mag||ammo<=p.mag)return;
    p.reloadT=fire.reload;p.burstLeft=0;p.autoN=0;p.loadOnGrant=0;sfx(SFX_RELOAD,p.x,p.y);emit(EV_RELOAD,1);
}
void dryFire(Player& p){ if(!p.dryT){emit(EV_NOAMMO);sfx(SFX_DRY,p.x,p.y);p.dryT=30;} }
// A beam: instant, along the line of sight, through up to fire.pierce+1 enemies, stopped by walls.
struct Beam { float x0,y0,x1,y1; int life; } beams[4];
void fireBeam(float x,float y,float dx,float dy,int damage){
    bool hit[EnemyCount]={};int hits=0;float cx=x,cy=y;
    for(float t=0;t<weapons[Bow].range;t+=3){
        cx=x+dx*t;cy=y+dy*t;
        if(solidAt(cx,cy+6)){for(int i=0;i<6;++i)particle(cx,cy,(frand()-.5f)*1.6f,-frand()*1.4f,12,0,rgba(0x7ff5e4));break;}
        bool stop=false;
        for(int i=0;i<EnemyCount;++i){auto& e=enemies[i];if(hit[i]||!e.enabled||e.hp<=0)continue;
            float hh=e.type==Bear?16:9;
            if(fabsf(e.x-cx)<(e.type==Bear?13:8)&&cy>e.y-hh-12&&cy<e.y+2){hit[i]=true;
                playerHitsEnemy(i,isBossType(e.type)||e.type==Bear?damage*3/5:damage,cx-dx*8,cy-dy*8);
                for(int k=0;k<8;++k)particle(cx,cy,(frand()-.5f)*2.4f,(frand()-.5f)*2.4f,14,0,rgba(frand()<.5f?0xe8fdff:0x7ff5e4));
                if(++hits>fire.pierce){stop=true;break;}}}
        if(stop)break;
    }
    for(auto& b:beams)if(b.life<=0){b={x,y,cx,cy,9};break;}
    emit(EV_IMPACT,int(cx),int(cy));
}
// One round leaves the weapon: muzzle flash, smoke, recoil, the report; then the weapon's own cycle.
bool fireRound(Player& p,int facing){
    int& ammo=game.inv.counts[IArrows-1];
    if(ammo<=0){dryFire(p);return false;}
    if(fire.kind==FireBeam){ if(p.overheat)return false; }
    else if(p.mag<=0){startReload(p);return false;}
    --ammo; if(fire.kind!=FireBeam)--p.mag;
    auto d=directions[facing];
    float ang=atan2f(d.y,d.x),spread=fire.spread*(p.moving?1.8f:1.f)+(fire.kind==FireAuto?(p.autoN<12?p.autoN:12)*.012f:0);
    ang+=(frand()-.5f)*spread;
    float dx=cosf(ang),dy=sinf(ang),mx=p.x+d.x*11,my=p.y-9+d.y*6;
    int dmg=outgoingDamage(weapons[Bow].damage);
    if(fire.kind==FireBeam)fireBeam(mx,my,dx,dy,dmg); else launchBullet(mx,my,dx,dy,dmg);
    // flash
    game.flashX=mx;game.flashY=my;game.flashT=fire.kind==FireAuto?3:5;game.flashKind=fire.kind;
    uint32_t hot=fire.kind==FireBeam?0xe8fdff:0xfff2b0,warm=fire.kind==FireBeam?0x7ff5e4:0xffa030;
    for(int i=0;i<(fire.kind==FireAuto?4:9);++i)particle(mx+d.x*2,my,d.x*(1.2f+frand()*1.6f)+(frand()-.5f)*.8f,d.y*(1.2f+frand()*1.6f)+(frand()-.5f)*.8f,4+int(frand()*4),0,rgba(frand()<.5f?hot:warm));
    // smoke: black powder billows, the rifle puffs, the sub-machine gun wisps, the beam vents nothing
    int puffs=fire.kind==FireMusket?6:fire.kind==FireRifle?2:fire.kind==FireAuto?(p.autoN%3==0):0;
    for(int i=0;i<puffs;++i)particle(mx+d.x*(4+i*3)+(frand()-.5f)*4,my-2+(frand()-.5f)*3,d.x*.35f+(frand()-.5f)*.3f,-.18f-frand()*.25f,50+int(frand()*30),1);
    // recoil: the shooter is pushed back, the view kicks
    float r=fire.recoil;
    if(r>0){ if(!blockedFeet(p.x-d.x*r,p.y))p.x-=d.x*r; if(!blockedFeet(p.x,p.y-d.y*r))p.y-=d.y*r; int k=int(r*1.6f+.5f); if(game.shake<k)game.shake=k; }
    sfx(fire.kind==FireMusket?SFX_MUSKET:fire.kind==FireRifle?SFX_RIFLE:fire.kind==FireAuto?SFX_SMG:SFX_PULSE,p.x,p.y);
    p.aimT=fire.kind==FireAuto?10:20;
    if(fire.kind==FireRifle)p.cycleT=fire.cycle;                       // work the bolt
    if(fire.kind==FireBeam){p.heat+=fire.cycle;if(p.heat>=100){p.heat=100;p.overheat=fire.reload;sfx(SFX_VENT,p.x,p.y);}}
    if(fire.kind==FireAuto)++p.autoN;
    for(auto& an:animals){float ax=an.x-p.x,ay=an.y-p.y;if(!an.flee&&ax*ax+ay*ay<160*160)an.flee=80;}
    for(auto& n:npcs)if(n.active&&!n.hidden){float ax=n.x-p.x,ay=n.y-p.y;if(ax*ax+ay*ay<90*90)n.alert=90;}
    return true;
}
// The trigger. Single-shot weapons fire after the trigger delay (attack windup: the flintlock's flash in the pan);
// the sub-machine gun fires as long as the trigger is held (a tap still sends a short burst of three).
void pullTrigger(Player& p){
    if(p.reloadT||p.cycleT||p.overheat||p.attack.active||p.fireCd)return;
    if(game.inv.counts[IArrows-1]<=0){dryFire(p);return;}
    if(fire.kind!=FireBeam&&p.mag<=0){startReload(p);return;}
    if(fire.kind==FireAuto){
        if(!(game.prevKeys&Strike)&&p.burstLeft<2)p.burstLeft=3;
        if(fireRound(p,p.facing)){p.fireCd=fire.gap;if(p.burstLeft)--p.burstLeft;}
        return;
    }
    if(startAttack(p.attack,Bow,p.facing,p.x,p.y)){p.fireCd=p.attack.cooldown;if(fire.kind==FireMusket)sfx(SFX_BOWSTRING,p.x,p.y);}
}
void playerStrike(){
    Player& p=me();
    if(game.paused||game.cinematic||!game.control||p.hp<=0||p.down||p.dead||p.hurt)return;
    if(p.weapon==Bow&&fire.kind!=FireBow){pullTrigger(p);return;}
    if(p.weapon==Bow&&game.inv.counts[IArrows-1]==0){ if(!p.attack.cooldown){emit(EV_NOAMMO);p.attack.cooldown=30;} return; }
    if(startAttack(p.attack,p.weapon,p.facing,p.x,p.y)){
        auto& A=p.attack;const auto& w=weapons[p.weapon];
        A.charge=melee[1].mode==1&&p.weapon==Spear&&p.running&&p.moving;
        if(p.weapon==Sword&&p.counterT>0){   // the counter-cut after a parry: at once, wider, twice as hard
            A.counter=true;p.counterT=0;A.age=w.windup>2?w.windup-2:0;A.cooldown=A.cooldown>A.age?A.cooldown-A.age:0;
            auto d=directions[p.facing];for(int i=0;i<10;++i)particle(p.x+d.x*12,p.y-10,d.x*(1.5f+frand()),d.y*(1.5f+frand())-.3f,14,0,rgba(0xfff6c8));}
        else if(p.weapon==Sword&&melee[0].mode==3&&game.ticks-p.lastStrike<30){   // akinakes / knife: the follow-up cut comes at once
            A.age=w.windup>2?w.windup-2:0;A.cooldown=A.cooldown>A.age?A.cooldown-A.age:0;}
        if(p.weapon==Sword)p.lastStrike=game.ticks;
        if(melee[0].mode==1&&p.weapon==Sword){   // MAP07 sabre: the third quick cut of a series is a finishing blow
            p.combo=game.ticks-p.combo_last<48?p.combo+1:1;p.combo_last=game.ticks;
            if(p.combo>=3){p.combo=0;p.attack.charge=true;game.shake=4;auto d=directions[p.facing];for(int i=0;i<12;++i)particle(p.x+d.x*10,p.y-8,d.x*(1.5f+frand()),d.y*(1.5f+frand())-.4f,16,0,rgba(0xfff2c4));}}
        if(p.attack.charge){auto d=directions[p.facing];for(int i=0;i<10;++i)particle(p.x-d.x*6,p.y-2,(frand()-.5f)*.8f-d.x,-frand()*.6f,18,2);}
        sfx(p.weapon==Sword?SFX_SWORD:p.weapon==Spear?SFX_SPEAR:SFX_BOWSTRING,p.x,p.y);
        for(auto& a:animals){float dx=a.x-p.x,dy=a.y-p.y;if(!a.flee&&dx*dx+dy*dy<110*110)a.flee=70;}
    }
}
void updateFocus(){
    Player& p=me();
    game.focusKind=-1;game.focusId=-1;
    if(p.hp<=0||p.down||p.dead||game.cinematic)return;
    float best=1e9;auto fd=directions[p.facing];
    for(int i=0;i<InteractCount;++i){
        if(!world.iaEnabled[i])continue;const auto& ia=interacts[i];
        if(ia.tag&&world.hiddenTag[ia.tag])continue;
        float dx=ia.x-p.x,dy=ia.y-p.y,d=dx*dx+dy*dy;
        if(d>ia.r*ia.r)continue;
        float dot=(dx*fd.x+dy*fd.y)/(sqrtf(d)+.01f);
        float score=d*(dot<-.2f?2.2f:1);
        if(score<best){best=score;game.focusKind=0;game.focusId=i;}
    }
    for(int i=0;i<NpcCount;++i){const auto& n=npcs[i];
        if(!n.active||n.hidden||!n.talk)continue;
        float dx=n.x-p.x,dy=n.y-p.y,d=dx*dx+dy*dy;
        // People win over a nearby marker (a hearth, a pole) unless the marker is much closer: E talks to the person.
        float dot=(dx*fd.x+dy*fd.y)/(sqrtf(d)+.01f),score=d*.4f*(dot<-.2f?2.2f:1);
        if(d<26*26&&score<best){best=score;game.focusKind=1;game.focusId=i;}
    }
    for(int s=1;s<MaxPlayers;++s){const auto& o=players[s];
        if(!o.active||!o.down)continue;
        float dx=o.x-p.x,dy=o.y-p.y,d=dx*dx+dy*dy;
        if(d<26*26&&d*.5f<best){best=d*.5f;game.focusKind=2;game.focusId=s;}
    }
}
void tickHold(){
    Player& p=me();
    bool holding=(p.keys&Interact)&&game.focusKind>=0&&!p.moving&&!p.attack.active;
    int need=0;
    if(game.focusKind==0)need=world.iaHold[game.focusId];
    if(game.focusKind==2)need=150;
    if(!holding||!need||p.holdKind!=game.focusKind||p.holdId!=game.focusId){
        if(holding&&need&&(p.holdKind!=game.focusKind||p.holdId!=game.focusId)){p.holdKind=game.focusKind;p.holdId=game.focusId;p.holdTicks=0;p.holdNeed=need;emit(EV_HOLD_START,game.focusKind,game.focusId);}
        else if(!holding){p.holdTicks=0;p.holdKind=-1;p.holdId=-1;}
        return;
    }
    p.holdNeed=need;
    if(++p.holdTicks>=need){
        p.holdTicks=0;
        if(game.focusKind==2){emit(EV_REVIVE_PEER,game.focusId);sfx(SFX_REVIVE,p.x,p.y);}
        else emit(EV_INTERACT,0,game.focusId|0x10000);
        p.holdKind=-1;p.holdId=-1;p.keys&=~Interact;
    }
}
void pressInteract(){
    Player& p=me();
    if(game.interactCooldown||game.focusKind<0)return;
    if(game.focusKind==0&&world.iaHold[game.focusId])return; // hold interactions start in tickHold
    if(game.focusKind==2)return;
    game.interactCooldown=12;
    if(game.focusKind==1){Npc& n=npcs[game.focusId];float dx=p.x-n.x,dy=p.y-n.y;n.facing=heading(dx,dy);p.facing=heading(-dx,-dy);}
    p.pose=art::A_INTERACT;p.poseTime=24;
    emit(EV_INTERACT,game.focusKind,game.focusId);
}
void tickLocalPlayer(){
    Player& p=me();
    if(p.invuln)--p.invuln;
    if(p.hurt)--p.hurt;
    if(p.poseTime>0&&--p.poseTime==0)p.pose=-1;
    auto& a=p.attack;
    if(a.cooldown)--a.cooldown;
    if(p.fireCd)--p.fireCd; if(p.aimT)--p.aimT; if(p.dryT)--p.dryT; if(p.parryT)--p.parryT; if(p.parryCd)--p.parryCd; if(p.counterT)--p.counterT;
    if(p.cycleT){ if(--p.cycleT==fire.cycle/2)sfx(SFX_BOLT,p.x,p.y); }
    if(p.overheat){ if(p.overheat%8==0)particle(p.x+(frand()-.5f)*6,p.y-14,(frand()-.5f)*.4f,-.5f,30,1); if(--p.overheat==0)p.heat=0; }
    else if(p.heat>0){ p.heat-=.6f; if(p.heat<0)p.heat=0; }
    if(p.reloadT&&(p.weapon!=Bow||fire.kind==FireBow||fire.kind==FireBeam))p.reloadT=0;   // switched away: the reload is abandoned
    if(p.reloadT&&--p.reloadT==0){ int ammo=game.inv.counts[IArrows-1]; p.mag=ammo<fire.mag?ammo:fire.mag; sfx(SFX_BOLT,p.x,p.y); emit(EV_RELOAD,0); }
    if(!(p.keys&Strike)&&!p.burstLeft&&p.fireCd==0)p.autoN=0;
    if(p.dead){ if(--p.dead==0)emit(EV_DEAD); setAnim(p.anim,p.animTime,art::A_DEATH); return; }
    if(p.down){ if(--p.down==0){emit(EV_DEAD);} setAnim(p.anim,p.animTime,art::A_DEATH); return; }
    if(a.active){
        ++a.age;
        const auto& w=weapons[a.weapon];
        // The bow is drawn while the button is held (up to 40 ticks past the draw): aim with the arrows, release to loose.
        if(a.weapon==Bow&&fire.kind==FireBow&&a.age==w.windup&&(p.keys&Strike)&&a.draw<40&&game.inv.counts[IArrows-1]>0){
            ++a.draw;--a.age;++a.cooldown; if(a.draw==40)for(int i=0;i<4;++i)particle(p.x+directions[a.facing].x*8,p.y-12,(frand()-.5f)*.6f,-frand()*.6f,10,0,rgba(0xfff2c4)); }
        // Bayonet: a step into the thrust.
        if(a.weapon==Spear&&melee[1].mode==2&&a.age<w.windup){auto d=directions[a.facing];float s=1.6f;
            if(!blockedFeet(p.x+d.x*s,p.y))p.x+=d.x*s; if(!blockedFeet(p.x,p.y+d.y*s))p.y+=d.y*s;}
        if(a.age==w.windup){
            if(a.weapon==Bow&&fire.kind==FireBow){ if(game.inv.counts[IArrows-1]>0&&launchArrow(p.x,p.y-8,a.facing,outgoingDamage(w.damage),a.draw)){--game.inv.counts[IArrows-1];sfx(SFX_BOW,p.x,p.y);} }
            else if(a.weapon==Bow){ fireRound(p,a.facing); }
            else if(!a.connected){strikeEnemies(a);a.connected=true;}
        }
        if(a.age>=w.windup+(a.weapon==Bow&&fire.kind!=FireBow?6:12))a.active=false;
    }
    // Sub-machine gun: a tap's burst continues after the trigger is released.
    if(p.burstLeft&&fire.kind==FireAuto&&p.weapon==Bow&&!(p.keys&Strike)&&!p.fireCd&&!p.reloadT){
        if(fireRound(p,p.facing)){--p.burstLeft;p.fireCd=fire.gap;} else p.burstLeft=0;}
    // An empty weapon starts reloading by itself once the shot has settled; R reloads a part-empty one.
    if(p.weapon==Bow&&fire.kind!=FireBow&&fire.kind!=FireBeam&&!p.reloadT&&!a.active&&!p.aimT&&!p.cycleT&&!p.burstLeft){
        if(p.mag==0&&game.inv.counts[IArrows-1]>0)startReload(p);
        else if((p.keys&Reload)&&!(game.prevKeys&Reload))startReload(p);}
    // Parry (MAP05 sabre): F raises the blade for a short window.
    if(melee[0].mode==2&&p.weapon==Sword&&(p.keys&Parry)&&!(game.prevKeys&Parry)&&!p.parryCd&&!a.active&&!p.hurt&&!p.dead&&!p.down){
        p.parryT=14;p.parryCd=42;sfx(SFX_SWORD,p.x,p.y);}
    if(game.paused||!game.control||game.cinematic){p.moving=false;}
    else {
        if((p.keys&Strike))playerStrike();
        int dx=((p.keys&Right)!=0)-((p.keys&Left)!=0);
        int dy=((p.keys&Down)!=0)-((p.keys&Up)!=0);
        p.moving=false;
        if(a.active&&a.weapon==Bow&&fire.kind==FireBow&&a.draw>0&&(dx||dy)){int f=dy<0?(dx<0?7:dx>0?1:0):dy>0?(dx<0?5:dx>0?3:4):(dx<0?6:2);p.facing=f;a.facing=f;}
        if(!a.active&&!p.hurt&&(dx||dy)&&p.holdTicks==0){
            p.facing=dy<0?(dx<0?7:dx>0?1:0):dy>0?(dx<0?5:dx>0?3:4):(dx<0?6:2);
            p.running=(p.keys&Run)!=0;
            float speed=(p.running&&!p.reloadT?1.8f:1.15f)*speedFactor()*(p.reloadT&&fire.kind==FireMusket?.55f:1.f);
            int t=terrainAt(int(p.x)/Tile,int(p.y)/Tile);
            if(t==Shallow)speed*=.6f;
            if(dx&&dy)speed*=.70710678f;
            bool moved=false;
            if(!blockedFeet(p.x+dx*speed,p.y)){p.x+=dx*speed;moved=dx!=0;}
            if(!blockedFeet(p.x,p.y+dy*speed)){p.y+=dy*speed;moved=moved||dy!=0;}
            p.moving=moved;
            if(moved){
                p.stepAcc+=speed;
                if(p.stepAcc>(p.running?13:16)){p.stepAcc=0;sfx(stepSfx(p.x,p.y),p.x,p.y);
                    if(t==Shallow)for(int i=0;i<4;++i)particle(p.x,p.y-1,(frand()-.5f)*1.4f,-frand()*1.2f,14,0,rgba(0xd4efe2,200));
                    else if(p.running&&(t==Dirt||t==Sand||t==Steppe))particle(p.x-directions[p.facing].x*4,p.y,0,-.2f,20,2);}
                // Footsteps: a running hero startles the herd; a calm walk lets him pass close (no endless re-scare).
                if(p.running)for(auto& an:animals){float ax=an.x-p.x,ay=an.y-p.y;if(!an.flee&&!an.calm&&ax*ax+ay*ay<80*80)an.flee=60;}
            }
        }
    }
    // Animation selection.
    int next=art::A_IDLE;
    if(a.active)next=a.weapon==Sword?art::A_SWORD:a.weapon==Spear?art::A_SPEAR:art::A_BOW;
    else if(p.parryT>0)next=art::A_SWORD;
    else if(p.hurt)next=art::A_HURT;
    else if(p.aimT>0&&p.weapon==Bow&&!p.moving)next=art::A_BOW;
    else if(p.reloadT>0&&!p.moving)next=art::A_INTERACT;
    else if(p.holdTicks>0)next=game.focusKind==2?art::A_REVIVE:art::A_INTERACT;
    else if(p.pose>=0)next=p.pose;
    else if(p.moving)next=p.running?art::A_RUN:art::A_WALK;
    setAnim(p.anim,p.animTime,next);
    ++p.animTime;
}
int playerFrame(const Player& p){
    if(p.anim==art::A_SWORD&&!p.attack.active&&p.parryT>0)return 0;   // guard raised
    if(p.anim==art::A_BOW&&!p.attack.active)return 2;                  // holding the aim after a shot
    if(p.anim==art::A_SWORD||p.anim==art::A_SPEAR||p.anim==art::A_BOW){
        const auto& w=weapons[p.attack.weapon];int age=p.attack.age;
        if(age<w.windup*2/3)return 0; if(age<w.windup)return 1; if(age<w.windup+6)return 2; return 3;
    }
    int n=art::animFrames[p.anim],f=p.animTime/animFrameTicks(p.anim);
    if(p.anim==art::A_DEATH)return f>=n?n-1:f;
    if(p.anim==art::A_VICTORY||p.anim==art::A_INTERACT)return f>=n?n-1:f;
    return f%n;
}
void tickRemotePlayers(){
    for(int s=1;s<MaxPlayers;++s){auto& p=players[s];if(!p.active)continue;
        float dx=p.tx-p.x,dy=p.ty-p.y;
        if(dx*dx+dy*dy>200*200){p.x=p.tx;p.y=p.ty;}
        else {p.x+=dx*.25f;p.y+=dy*.25f;}
        ++p.animTime;
    }
}

// ------------------------------------------------------------------ NPCs and animals
bool npcBlocked(float x,float y){ return blockedFeet(x,y,3,2); }
void walkTo(float& x,float& y,int& facing,float tx,float ty,float speed,bool collide=true){
    float dx=tx-x,dy=ty-y,len=sqrtf(dx*dx+dy*dy);
    if(len<.5f)return;
    if(len<speed)speed=len;
    facing=heading(dx,dy);dx*=speed/len;dy*=speed/len;
    if(!collide||!npcBlocked(x+dx,y))x+=dx; else if(!npcBlocked(x,y+(dy>0?speed:-speed)))y+=dy>0?speed:-speed;
    if(!collide||!npcBlocked(x,y+dy))y+=dy; else if(!npcBlocked(x+(dx>0?speed:-speed),y))x+=dx>0?speed:-speed;
}
void tickNpcs(){
    Player& p=me();
    for(int i=0;i<NpcCount;++i){Npc& n=npcs[i];if(!n.active)continue;
        ++n.animTime;
        if(n.alert)--n.alert;
        float dx=p.x-n.x,dy=p.y-n.y,d2=dx*dx+dy*dy;
        bool near=d2<40*40&&!p.down&&!p.dead&&!n.hidden;
        if(n.mode==1){
            float gx=n.gx-n.x,gy=n.gy-n.y;
            if(gx*gx+gy*gy<1.2f){n.mode=2;setAnim(n.anim,n.animTime,n.holdAnim);}
            else {walkTo(n.x,n.y,n.facing,n.gx,n.gy,n.run?1.6f:.8f,false);setAnim(n.anim,n.animTime,n.run&&art::sheets[n.sheet].anim[art::A_RUN].x>=0?art::A_RUN:art::A_WALK);}
            continue;
        }
        if(n.mode==2){ if(near&&n.talk&&!game.cinematic){n.facing=heading(dx,dy);} continue; }
        if(near&&n.talk&&!game.cinematic){
            // Villagers stop and turn towards the stranger.
            n.facing=heading(dx,dy);
            if(n.anim==art::A_WALK||n.anim==art::A_RUN)setAnim(n.anim,n.animTime,art::A_IDLE);
            if(!n.greeted){n.greeted=1;}
            continue;
        }
        if(n.alert>0){setAnim(n.anim,n.animTime,art::A_IDLE);continue;}
        const auto& def=npcDefs[i];
        const auto& w=def.way[n.way];
        float wx=w.x-n.x,wy=w.y-n.y;
        if(wx*wx+wy*wy>2){
            bool runner=(npcDefs[i].flags&2)!=0;
            walkTo(n.x,n.y,n.facing,w.x,w.y,runner?1.2f:.55f);
            setAnim(n.anim,n.animTime,runner&&art::sheets[n.sheet].anim[art::A_RUN].x>=0?art::A_RUN:art::A_WALK);
        } else {
            int want=art::sheets[n.sheet].anim[w.anim].x>=0?w.anim:art::A_IDLE;
            setAnim(n.anim,n.animTime,want);
            if(w.facing>=0)n.facing=w.facing;
            if(--n.wait<=0){n.way=(n.way+1)%def.ways;n.wait=def.way[n.way].wait;}
        }
    }
}
// Animals move like animals: velocity eases toward a goal (no instant turns), they face where they actually go, a blocked
// path makes them pick another heading instead of treading in place, and a scare runs its course before they calm down.
void tickAnimals(){
    for(auto& a:animals){if(!a.active)continue;
        ++a.animTime;
        bool hare=a.sheet==art::SH_HARE;
        float px=0,py=0,best=1e9;bool moving=false;
        for(auto& p:players)if(p.active){float dx=a.x-p.x,dy=a.y-p.y,d=dx*dx+dy*dy;if(d<best){best=d;px=p.x;py=p.y;moving=p.moving;}}
        if(a.calm>0)--a.calm;
        if(a.turn>0)--a.turn;
        if(a.bump>0)--a.bump;
        float scare=hare?64.f:40.f;
        // Only a stranger walking up startles the herd; someone standing still among them is left alone.
        if(!a.flee&&!a.calm&&moving&&best<scare*scare)a.flee=hare?60:45;
        float topSpeed;
        if(a.flee>0){
            if(--a.flee==0)a.calm=90;   // a pause before they can be scared again
            float dx=a.x-px,dy=a.y-py,len=sqrtf(dx*dx+dy*dy)+.01f;
            topSpeed=hare?2.2f:1.3f;
            a.tvx=dx/len*topSpeed;a.tvy=dy/len*topSpeed*.8f;
            float hx=a.x-a.hx,hy=a.y-a.hy;
            if(hx*hx+hy*hy>200*200){a.tvx=-hx/200*topSpeed*.6f;a.tvy=-hy/200*topSpeed*.6f;}
        } else {
            topSpeed=hare?.6f:.32f;
            if(--a.timer<=0){
                a.timer=150+int(rng()%260);
                if(rng()%5<2){a.tvx=0;a.tvy=0;}   // stand and graze
                else{float ang=frand()*6.283f;a.tvx=cosf(ang)*topSpeed;a.tvy=sinf(ang)*topSpeed*.7f;
                    float hx=a.hx-a.x,hy=a.hy-a.y,d=sqrtf(hx*hx+hy*hy);
                    if(d>56){a.tvx=hx/d*topSpeed;a.tvy=hy/d*topSpeed*.7f;}}
            }
        }
        float k=a.flee>0?.12f:.04f;   // ease the velocity toward the goal
        a.vx+=(a.tvx-a.vx)*k;a.vy+=(a.tvy-a.vy)*k;
        float speed=sqrtf(a.vx*a.vx+a.vy*a.vy);
        if(speed>.05f){
            bool bx=blockedFeet(a.x+a.vx,a.y,4,2),by=blockedFeet(a.x,a.y+a.vy,4,2);
            if(!bx)a.x+=a.vx; if(!by)a.y+=a.vy;
            if(bx&&by){   // a wall or a fence: turn away once, then let the new heading ease in (no spinning on the spot)
                if(!a.bump){float ang=atan2f(a.vy,a.vx)+3.1416f*(.5f+frand());
                    a.tvx=cosf(ang)*topSpeed;a.tvy=sinf(ang)*topSpeed*.7f;a.bump=40;}
                a.vx*=.3f;a.vy*=.3f;
            } else if(bx){a.tvx=-a.tvx*.5f;a.vx=0;} else if(by){a.tvy=-a.tvy*.5f;a.vy=0;}
            // Turn only when clearly moving and not more often than every 20 ticks: no flicker between
            // neighbouring directions on a diagonal or while easing in/out.
            if(speed>.12f&&!a.turn){int h=heading(a.vx,a.vy);if(h!=a.facing){a.facing=h;a.turn=20;}}
            setAnim(a.anim,a.animTime,a.flee>0&&speed>.8f?art::A_RUN:art::A_WALK);
            if(!hare&&a.flee>0&&a.flee%34==0)sfx(SFX_HOOVES,a.x,a.y);
        } else setAnim(a.anim,a.animTime,(!hare&&a.timer%240<170)?art::A_GRAZE:art::A_IDLE);
    }
}

// ------------------------------------------------------------------ enemies (host / solo authority)
bool enemyBlocked(const Enemy& e,float x,float y){
    int hw=e.type==Bear?8:5;
    if(blockedFeet(x,y,hw,3))return true;
    for(const auto& p:players)if(p.active&&p.hp>0&&!p.down&&fabsf(p.x-x)<hw+4&&fabsf(p.y-y)<6)return true;
    for(const auto& o:enemies)if(&o!=&e&&o.enabled&&o.hp>0&&fabsf(o.x-x)<hw+5&&fabsf(o.y-y)<6)return true;
    return false;
}
void moveEnemy(Enemy& e,float dx,float dy){
    if(!enemyBlocked(e,e.x+dx,e.y))e.x+=dx;
    if(!enemyBlocked(e,e.x,e.y+dy))e.y+=dy;
}
void walkEnemy(Enemy& e,float tx,float ty,float speed){
    float dx=tx-e.x,dy=ty-e.y,len=sqrtf(dx*dx+dy*dy);
    if(len<1)return;
    e.facing=heading(dx,dy);moveEnemy(e,dx*speed/len,dy*speed/len);
}
int nearestPlayer(const Enemy& e,float& dist){
    int best=-1;dist=1e9;
    for(int s=0;s<MaxPlayers;++s){const auto& p=players[s];
        if(!p.active||p.hp<=0||p.down||p.dead)continue;
        float dx=p.x-e.x,dy=p.y-e.y,d=sqrtf(dx*dx+dy*dy);
        float detect=enemySpecs[e.type].detection*(inCover(p.x,p.y)&&!p.attack.active&&!p.running?.45f:1.f);
        if(e.alerted)detect=detect*1.8f+40;
        if(d<dist&&(d<detect)&&lineClear(e.x,e.y-6,p.x,p.y-6)){dist=d;best=s;}
    }
    return best;
}
void enemyResolveAttack(Enemy& e){
    const auto& spec=enemySpecs[e.type];
    if(e.type==Archer){launch(int(&e-enemies),e.x,e.y-8,e.attack.facing,spec.damage);sfx(SFX_BOW,e.x,e.y);return;}
    if(e.type==Wraith){launch(int(&e-enemies),e.x,e.y-14,e.attack.facing,spec.damage,false,true);sfx(SFX_BOWSTRING,e.x,e.y);return;}
    float reach=e.type==Wolf?20:e.type==Bear?30:e.type==Shade?26:34,width=e.type==Bear?20:e.type==Wolf||e.type==Shade?12:8;
    sfx(e.type==Wolf?SFX_GROWL:e.type==Bear?SFX_SWIPE:SFX_SPEAR,e.x,e.y);
    auto d=directions[e.attack.facing];
    for(int s=0;s<MaxPlayers;++s){auto& p=players[s];if(!p.active||p.hp<=0||p.down)continue;
        float dx=p.x-e.x,dy=p.y-e.y,fw=dx*d.x+dy*d.y,side=dx*d.y-dy*d.x;
        if(fw>-4&&fw<reach&&fabsf(side)<width)hitPlayer(s,spec.damage);}
}
// ------------------------------------------------------------------ boss: «Бұрмаланған от сақшысы»
// Three phases (100-66-33%). Attacks are always telegraphed on the ground first:
//   slam   - red ring around the boss, then a shockwave (close range)
//   breath - a cone toward the target, then a stream of fire (mid range)
//   pillars (phase 3) - three circles under the players, then columns of fire
// Phase 2 wakes two ash wraiths (the group after the boss's group).
int bossIndex=-1;
void keeperHitArea(float cx,float cy,float r,int dmg){
    for(int s=0;s<MaxPlayers;++s){auto& p=players[s];if(!p.active||p.hp<=0||p.down)continue;
        float dx=p.x-cx,dy=(p.y-cy)*1.3f;if(dx*dx+dy*dy<r*r)hitPlayer(s,dmg);}
}
bool inCone(const Enemy& e,float px,float py,float len,float cosHalf){
    auto d=directions[e.facing];float dx=px-e.x,dy=py-(e.y-8),l=sqrtf(dx*dx+dy*dy)+.01f;
    return l<len&&(dx*d.x+dy*d.y)/l>cosHalf;
}
void tickKeeper(Enemy& e){
    const auto& spec=enemySpecs[e.type];
    bossIndex=int(&e-enemies);
    if(e.state==Death){ if(e.timer>0)--e.timer;
        if(e.timer%6==0&&e.timer>60)for(int i=0;i<6;++i)particle(e.x+(frand()-.5f)*40,e.y-10-frand()*30,(frand()-.5f)*1.5f,-frand()*1.5f,40,0,rgba(frand()<.5f?0xffb347:0x8a8a8a));
        if(!e.timer)e.active=false; setAnim(e.anim,e.animTime,art::A_DEATH); return; }
    if(game.cinematic){setAnim(e.anim,e.animTime,art::A_IDLE);return;}
    float dist;int target=nearestPlayer(e,dist);
    if(target<0){ setAnim(e.anim,e.animTime,art::A_IDLE); e.special=0; return; }
    const Player& p=players[target];
    float dx=p.x-e.x,dy=p.y-e.y;
    int maxhp=spec.health,phase=e.hp*3>maxhp*2?1:e.hp*3>maxhp?2:3;
    if(!e.alerted){e.alerted=1;alertGroup(e.group);e.state=Roar;e.timer=90;game.shake=24;sfx(SFX_ROAR,e.x,e.y);}
    if(phase>e.phase){e.phase=phase;e.state=Roar;e.timer=70;e.special=0;game.shake=20;sfx(SFX_ROAR,e.x,e.y);
        for(int i=0;i<24;++i)particle(e.x,e.y-20,(frand()-.5f)*3,(frand()-.5f)*3,40,0,rgba(0xffb347));}
    if(e.state==Roar){ setAnim(e.anim,e.animTime,art::A_ROAR); if(--e.timer<=0){e.state=Chase;e.attack.cooldown=40;} return; }
    float speed=spec.speed*(phase==3?1.35f:1.f);
    int tele=phase==3?30:40;
    switch(e.special){
    case 1: // slam telegraph -> impact
        setAnim(e.anim,e.animTime,art::A_SWIPE);
        if(--e.timer<=0){keeperHitArea(e.x,e.y,66,spec.damage+2);game.shake=16;sfx(SFX_IMPACT,e.x,e.y);
            for(int i=0;i<36;++i){float a=i/36.f*6.283f;particle(e.x+cosf(a)*20,e.y+sinf(a)*12,cosf(a)*2.2f,sinf(a)*1.4f,26,2);}
            e.special=0;e.attack.cooldown=phase==3?50:70;}
        return;
    case 2: // breath telegraph
        setAnim(e.anim,e.animTime,art::A_ROAR);
        if(--e.timer<=0){e.special=3;e.timer=54;}
        return;
    case 3: // fire stream
        setAnim(e.anim,e.animTime,art::A_ROAR);
        if(e.timer%3==0){auto d=directions[e.facing];for(int i=0;i<3;++i)particle(e.x+d.x*12,e.y-12+d.y*8,d.x*(3+frand()*2)+(frand()-.5f),d.y*(3+frand()*2)+(frand()-.5f),26,0,rgba(frand()<.5f?0xffd24a:0xe0621f));}
        if(e.timer%9==0)for(int s=0;s<MaxPlayers;++s){auto& q=players[s];if(q.active&&q.hp>0&&!q.down&&inCone(e,q.x,q.y,130,.8f))hitPlayer(s,8);}
        if(--e.timer<=0){e.special=0;e.attack.cooldown=phase==3?40:60;}
        return;
    case 4: // fire pillars telegraph -> eruption
        setAnim(e.anim,e.animTime,art::A_CHARGE);
        if(--e.timer<=0){for(int k=0;k<3;++k){keeperHitArea(e.px[k],e.py[k],20,20);for(int i=0;i<14;++i)particle(e.px[k]+(frand()-.5f)*14,e.py[k],(frand()-.5f)*.6f,-1.5f-frand()*2,30,0,rgba(0xffb347));}
            game.shake=10;sfx(SFX_IMPACT,e.x,e.y);e.special=0;e.attack.cooldown=60;}
        return;
    }
    if(e.attack.cooldown)--e.attack.cooldown;
    e.facing=heading(dx,dy);
    if(!e.attack.cooldown){
        if(phase==3&&dist>40&&(e.seed++%3)==0){e.special=4;e.timer=50;
            for(int k=0;k<3;++k){const Player& q=players[k<MaxPlayers&&players[k].active?k:target];e.px[k]=q.x+(k==0?0:(frand()-.5f)*60);e.py[k]=q.y+(k==0?0:(frand()-.5f)*40);}
            sfx(SFX_ROAR,e.x,e.y);return;}
        if(dist<62){e.special=1;e.timer=tele;sfx(SFX_GROWL,e.x,e.y);return;}
        if(dist<190){e.special=2;e.timer=tele-6;sfx(SFX_ROAR,e.x,e.y);return;}
    }
    if(dist>30){walkEnemy(e,p.x,p.y,dist>110?speed*1.6f:speed);setAnim(e.anim,e.animTime,dist>110?art::A_CHARGE:art::A_WALK);}
    else setAnim(e.anim,e.animTime,art::A_IDLE);
}
// ------------------------------------------------------------------ boss: the golden-armoured rider (MAP03)
// Phase 1 (mounted): a telegraphed charge along a line (a wall leaves him dazed: double damage) and arrow volleys.
// Phase 2 (on foot): the golden armour deflects frontal hits; strike from the side/back or right after his akinak cut.
// Phase 3 (mirror): two illusions mirror him around the hero; only the real one casts a shadow and a gold glint,
// only his bolts hurt; a blow shatters an illusion. Phase 2 also wakes the group after his (corrupted warriors).
bool isBoss(int type){ return isBossType(type); }
void riderIllusions(Enemy& e,const Player& p){
    for(int k=1;k<3;++k)if(e.illusions&(1<<k)){float a=k==1?2.094f:-2.094f,dx=e.x-p.x,dy=e.y-p.y;
        e.px[k]=p.x+dx*cosf(a)-dy*sinf(a);e.py[k]=p.y+dx*sinf(a)+dy*cosf(a);}
}
void tickRider(Enemy& e){
    const auto& spec=enemySpecs[e.type];
    bossIndex=int(&e-enemies);
    if(e.state==Death){ if(e.timer>0)--e.timer;
        if(e.timer%5==0&&e.timer>50)for(int i=0;i<5;++i)particle(e.x+(frand()-.5f)*36,e.y-10-frand()*30,(frand()-.5f)*1.4f,-frand()*1.4f,40,0,rgba(frand()<.6f?0xffd24a:0xa35cc0));
        if(!e.timer)e.active=false; setAnim(e.anim,e.animTime,art::A_DEATH); return; }
    if(game.cinematic){setAnim(e.anim,e.animTime,e.phase==1?art::A_IDLE:art::A_INTERACT);return;}
    // Phases follow health even when nobody is in sight (damage from afar must not skip a phase change).
    int maxhp=spec.health,phase=e.hp*5>maxhp*3?1:e.hp*4>maxhp?2:3;
    if(phase>e.phase){e.phase=phase;e.state=Roar;e.timer=90;e.special=0;e.illusions=0;game.shake=22;sfx(SFX_ROAR,e.x,e.y);
        for(int i=0;i<40;++i)particle(e.x+(frand()-.5f)*30,e.y-10-frand()*20,(frand()-.5f)*2.5f,-frand()*2,46,phase==2?1:0,phase==2?0:rgba(0xa35cc0));}
    float dist;int target=nearestPlayer(e,dist);
    if(target<0){ setAnim(e.anim,e.animTime,e.phase==1?art::A_IDLE:art::A_INTERACT); if(e.state!=Roar)e.special=0; else if(--e.timer<=0){e.state=Chase;if(e.phase==3){e.illusions=6;riderIllusions(e,me());}} return; }
    const Player& p=players[target];
    float dx=p.x-e.x,dy=p.y-e.y;
    if(!e.alerted){e.alerted=1;alertGroup(e.group);e.state=Roar;e.timer=80;game.shake=20;sfx(SFX_HOOVES,e.x,e.y);}
    if(e.state==Roar){ setAnim(e.anim,e.animTime,e.phase==1?art::A_IDLE:art::A_ROAR);
        if(--e.timer<=0){e.state=Chase;e.attack.cooldown=30;if(e.phase==3){e.illusions=6;riderIllusions(e,p);}} return; }
    if(e.phase==3&&!e.illusions&&game.ticks%420==0){e.special=8;e.timer=50;sfx(SFX_ROAR,e.x,e.y);}
    riderIllusions(e,p);
    bool mounted=e.phase==1;
    if(e.attack.cooldown)--e.attack.cooldown;
    switch(e.special){
    case 1: setAnim(e.anim,e.animTime,art::A_IDLE); if(--e.timer<=0){e.special=2;e.timer=50;e.attack.connected=false;sfx(SFX_HOOVES,e.x,e.y);} return;
    case 2:{ // gallop along the telegraphed line
        setAnim(e.anim,e.animTime,art::A_RUN);
        float lx=e.px[0]-e.x,ly=e.py[0]-e.y,l=sqrtf(lx*lx+ly*ly)+.01f,sx=lx/l*4.2f,sy=ly/l*4.2f;
        bool wall=blockedFeet(e.x+sx*2,e.y+sy*2,8,4);
        if(!wall){e.x+=sx;e.y+=sy;}
        if(game.ticks%2==0)particle(e.x-sx*3,e.y,(frand()-.5f)*.6f,-.3f,22,2);
        if(!e.attack.connected)for(int s=0;s<MaxPlayers;++s){auto& q=players[s];if(q.active&&q.hp>0&&!q.down&&fabsf(q.x-e.x)<15&&fabsf(q.y-e.y)<12){hitPlayer(s,spec.damage+6);e.attack.connected=true;}}
        if(wall){e.special=6;e.timer=120;game.shake=20;sfx(SFX_IMPACT,e.x,e.y);for(int i=0;i<20;++i)particle(e.x+sx*3,e.y-8,(frand()-.5f)*2,-frand()*2,30,2);}
        else if(--e.timer<=0||l<8){e.special=0;e.attack.cooldown=50;}
        return;}
    case 3: setAnim(e.anim,e.animTime,art::A_BOW);
        if(--e.timer<=0){for(int k=-1;k<=1;++k){launch(int(&e-enemies),e.x,e.y-22,(e.facing+k+8)&7,spec.damage-8);}
            sfx(SFX_BOW,e.x,e.y);e.special=e.seed++%2?3:0;e.timer=e.special?20:0;e.attack.cooldown=70;}
        return;
    case 4: setAnim(e.anim,e.animTime,art::A_SWIPE); // akinak: wind-up then a cut in front
        if(--e.timer<=0){for(int s=0;s<MaxPlayers;++s){auto& q=players[s];if(q.active&&q.hp>0&&!q.down&&inCone(e,q.x,q.y+8,48,.45f))hitPlayer(s,spec.damage);}
            sfx(SFX_SWORD,e.x,e.y);e.special=5;e.timer=70;}
        return;
    case 5: setAnim(e.anim,e.animTime,art::A_INTERACT); if(--e.timer<=0){e.special=0;e.attack.cooldown=30;} return; // guard down
    case 6: setAnim(e.anim,e.animTime,mounted?art::A_IDLE:art::A_INTERACT); // dazed after the wall
        if(e.timer%10==0)particle(e.x+(frand()-.5f)*14,e.y-40,0,-.3f,20,0,rgba(0xfff2c4));
        if(--e.timer<=0){e.special=0;e.attack.cooldown=40;} return;
    case 7: setAnim(e.anim,e.animTime,art::A_ROAR); // mirror bolts: only the real one hurts
        if(--e.timer<=0){launch(int(&e-enemies),e.x,e.y-24,heading(dx,dy),spec.damage-6,false,true);
            for(int k=1;k<3;++k)if(e.illusions&(1<<k))launch(int(&e-enemies),e.px[k],e.py[k]-24,heading(p.x-e.px[k],p.y-e.py[k]),0,true,true);
            e.special=0;e.attack.cooldown=60;}
        return;
    case 8: setAnim(e.anim,e.animTime,art::A_ROAR); if(--e.timer<=0){e.illusions=6;e.special=0;riderIllusions(e,p);for(int i=0;i<20;++i)particle(e.x,e.y-20,(frand()-.5f)*3,(frand()-.5f)*3,30,0,rgba(0xa35cc0));} return;
    }
    if(!mounted&&e.animTime%16!=0){} else e.facing=heading(dx,dy); // on foot he turns slowly: flanking works
    if(mounted){
        if(!e.attack.cooldown){
            if(dist>56&&(e.seed++%3)!=2){e.special=1;e.timer=46;e.px[0]=p.x+dx/(dist+.01f)*80;e.py[0]=p.y+dy/(dist+.01f)*80;sfx(SFX_SHOUT,e.x,e.y);return;}
            if(dist<170){e.special=3;e.timer=34;return;}
        }
        // Circle the hero at bow range like a horse archer.
        float a=atan2f(-dy,-dx)+.035f,R=96;
        walkEnemy(e,p.x+cosf(a)*R,p.y+sinf(a)*R*.8f,spec.speed*1.3f);setAnim(e.anim,e.animTime,art::A_WALK);
        return;
    }
    if(!e.attack.cooldown){
        if(dist<46){e.special=4;e.timer=phase==3?20:26;sfx(SFX_GROWL,e.x,e.y);return;}
        if(phase==3&&dist<180&&(e.seed++%2)){e.special=7;e.timer=34;return;}
    }
    if(dist>30){walkEnemy(e,p.x,p.y,spec.speed*(phase==3?1.3f:1.f));setAnim(e.anim,e.animTime,art::A_INTERACT);}
    else setAnim(e.anim,e.animTime,art::A_CHARGE); // guard stance
}
void drawRiderTelegraphs(const Enemy& e){
    int cx=int(e.x)-renderer.camX,cy=int(e.y)-renderer.camY;
    unsigned pulse=120+unsigned(60*sinf(game.ticks*.4f));uint32_t red=rgba(0xe0421f,pulse);
    if(e.special==1){float lx=e.px[0]-e.x,ly=e.py[0]-e.y,l=sqrtf(lx*lx+ly*ly)+.01f;
        for(float t=0;t<l;t+=3){int x=cx+int(lx/l*t),y=cy+int(ly/l*t);for(int k=-9;k<=9;k+=9)renderer.pixel(x+int(-ly/l*k),y+int(lx/l*k),red);}
        int ex=int(e.px[0])-renderer.camX,ey=int(e.py[0])-renderer.camY;for(int i=0;i<24;++i){float a=i/24.f*6.283f;renderer.pixel(ex+int(cosf(a)*10),ey+int(sinf(a)*7),red);}}
    if(e.special==3){auto d=directions[e.facing];for(int l=12;l<120;l+=5)for(int k=-l*4/10;k<=l*4/10;k+=4)renderer.pixel(cx+int(d.x*l-d.y*k),cy-14+int(d.y*l+d.x*k),red);}
    if(e.special==4){auto d=directions[e.facing];for(int i=-10;i<=10;++i){float a=atan2f(d.y,d.x)+i*.08f;renderer.pixel(cx+int(cosf(a)*42),cy-6+int(sinf(a)*32),red);}}
    if(e.special==7||e.special==8){for(int k=0;k<3;++k){if(k&&!(e.illusions&(1<<k))&&e.special==7)continue;int x=k?int(e.px[k])-renderer.camX:cx,y=k?int(e.py[k])-renderer.camY:cy;
        for(int i=0;i<30;++i){float a=i/30.f*6.283f+game.ticks*.1f;renderer.pixel(x+int(cosf(a)*12),y-30+int(sinf(a)*12),rgba(0xd29ae6,pulse));}}}
    if(e.special==6){for(int i=0;i<3;++i){float a=game.ticks*.15f+i*2.09f;renderer.pixel(cx+int(cosf(a)*9),cy-46+int(sinf(a)*3),rgba(0xfff2c4));}}
}
// ------------------------------------------------------------------ boss: the three-faced witness (MAP04)
// Phase 1 "whistling arrows": he marks the ground under the hero (a shrinking ring), then a volley lands there.
// Phase 2 "three banners": untouchable while his three banners stand; cut them down (he sweeps a slow line of
//   shadow meanwhile) and he collapses, open to blows, until he raises them again.
// Phase 3 "echo": he marks where the hero stands and dashes there, three times; then he is spent and open.
void witnessBanners(Enemy& e){ e.illusions=7; for(int k=0;k<3;++k){float a=1.5708f+k*2.0944f;e.px[k]=e.homeX+cosf(a)*62;e.py[k]=e.homeY+sinf(a)*40+6;} }
void tickWitness(Enemy& e){
    const auto& spec=enemySpecs[e.type];
    bossIndex=int(&e-enemies);
    if(e.state==Death){ if(e.timer>0)--e.timer;
        if(e.timer%5==0&&e.timer>50)for(int i=0;i<5;++i)particle(e.x+(frand()-.5f)*36,e.y-10-frand()*34,(frand()-.5f)*1.4f,-frand()*1.4f,40,0,rgba(0xa35cc0));
        if(!e.timer)e.active=false; setAnim(e.anim,e.animTime,art::A_DEATH); return; }
    if(game.cinematic){setAnim(e.anim,e.animTime,art::A_IDLE);return;}
    int maxhp=spec.health,phase=e.hp*3>maxhp*2?1:e.hp*3>maxhp?2:3;
    if(phase>e.phase){e.phase=phase;e.state=Roar;e.timer=80;e.special=0;e.illusions=0;e.seed=0;game.shake=20;sfx(SFX_ROAR,e.x,e.y);
        for(int i=0;i<36;++i)particle(e.x+(frand()-.5f)*30,e.y-10-frand()*24,(frand()-.5f)*2.5f,-frand()*2,44,0,rgba(0xa35cc0));}
    if(e.state==Roar){ setAnim(e.anim,e.animTime,art::A_ROAR); if(--e.timer<=0){e.state=Chase;e.attack.cooldown=30;if(e.phase==2){e.x=e.homeX;e.y=e.homeY;witnessBanners(e);}} return; }
    float dist;int target=nearestPlayer(e,dist);
    if(target<0){ setAnim(e.anim,e.animTime,art::A_IDLE); if(e.special!=6)e.special=0; return; }
    const Player& p=players[target];
    float dx=p.x-e.x,dy=p.y-e.y;
    if(!e.alerted){e.alerted=1;alertGroup(e.group);e.state=Roar;e.timer=70;game.shake=14;sfx(SFX_ROAR,e.x,e.y);return;}
    if(e.attack.cooldown)--e.attack.cooldown;
    e.facing=heading(dx,dy);
    if(e.special==6){ setAnim(e.anim,e.animTime,art::A_HURT); if(e.timer%10==0)particle(e.x+(frand()-.5f)*14,e.y-44,0,-.3f,20,0,rgba(0xfff2c4));
        if(--e.timer<=0){e.special=0;e.attack.cooldown=40;e.seed=0;if(e.phase==2)witnessBanners(e);} return; }
    if(e.phase==1){
        if(e.special==1){ setAnim(e.anim,e.animTime,art::A_BOW);
            if(--e.timer<=0){keeperHitArea(e.px[0],e.py[0],26,spec.damage);game.shake=8;sfx(SFX_ARROW_HIT,e.px[0],e.py[0]);
                for(int i=0;i<12;++i)particle(e.px[0]+(frand()-.5f)*30,e.py[0]-frand()*40,0,2.5f,14,0,rgba(0xe8dcc0));
                e.special=0;e.attack.cooldown=(++e.seed%3)?16:80;}
            return; }
        if(!e.attack.cooldown&&dist<230){e.special=1;e.timer=52;e.px[0]=p.x;e.py[0]=p.y;sfx(SFX_BOWSTRING,e.x,e.y);return;}
        if(dist<70)walkEnemy(e,e.x-dx,e.y-dy,spec.speed); else if(dist>150)walkEnemy(e,p.x,p.y,spec.speed*.7f);
        setAnim(e.anim,e.animTime,dist<70||dist>150?art::A_WALK:art::A_IDLE); return;
    }
    if(e.phase==2){ // rooted behind the banners; a beam of shadow sweeps around him
        setAnim(e.anim,e.animTime,art::A_CHARGE);
        if(!e.illusions){e.special=6;e.timer=170;sfx(SFX_IMPACT,e.x,e.y);game.shake=12;return;}
        // A lighthouse beam: constant turn (one sweep about every 6 s), so it can be read and dodged.
        e.dx+=.017f;if(e.dx>6.2832f)e.dx-=6.2832f;
        if(game.ticks%4==0)for(int s=0;s<MaxPlayers;++s){auto& q=players[s];if(!q.active||q.hp<=0||q.down)continue;
            float qx=q.x-e.x,qy=q.y-e.y,along=qx*cosf(e.dx)+qy*sinf(e.dx),side=-qx*sinf(e.dx)+qy*cosf(e.dx);
            if(along>14&&along<120&&fabsf(side)<7&&lineClear(e.x,e.y,q.x,q.y))hitPlayer(s,12);}
        return;
    }
    if(e.special==3){ setAnim(e.anim,e.animTime,art::A_ROAR); if(--e.timer<=0){e.special=4;e.timer=30;e.attack.connected=false;sfx(SFX_HOOVES,e.x,e.y);} return; }
    if(e.special==4){ setAnim(e.anim,e.animTime,art::A_SWIPE);
        float lx=e.px[0]-e.x,ly=e.py[0]-e.y,l=sqrtf(lx*lx+ly*ly)+.01f,sp=l<6?l:6;
        if(!blockedFeet(e.x+lx/l*sp,e.y+ly/l*sp,6,4)){e.x+=lx/l*sp;e.y+=ly/l*sp;} else l=0;
        if(game.ticks%2==0)particle(e.x,e.y-16,(frand()-.5f),(frand()-.5f),18,0,rgba(0xa35cc0));
        if(!e.attack.connected)for(int s=0;s<MaxPlayers;++s){auto& q=players[s];if(q.active&&q.hp>0&&!q.down&&fabsf(q.x-e.x)<13&&fabsf(q.y-e.y)<11){hitPlayer(s,spec.damage+2);e.attack.connected=true;}}
        if(l<7||--e.timer<=0){ if(++e.seed>=3){e.special=6;e.timer=120;} else {e.special=0;e.attack.cooldown=14;} }
        return; }
    if(!e.attack.cooldown){e.special=3;e.timer=30;e.px[0]=p.x;e.py[0]=p.y;sfx(SFX_GROWL,e.x,e.y);return;}
    setAnim(e.anim,e.animTime,art::A_IDLE);
}
void drawWitnessTelegraphs(const Enemy& e){
    int cx=int(e.x)-renderer.camX,cy=int(e.y)-renderer.camY;
    unsigned pulse=120+unsigned(60*sinf(game.ticks*.4f));uint32_t red=rgba(0xe0421f,pulse),vio=rgba(0xd29ae6,pulse);
    if((e.phase==1&&e.special==1)||(e.phase==3&&(e.special==3||e.special==4))){int x=int(e.px[0])-renderer.camX,y=int(e.py[0])-renderer.camY;
        int r=e.phase==1?26:13;for(int i=0;i<48;++i){float a=i/48.f*6.283f;renderer.pixel(x+int(cosf(a)*r),y+int(sinf(a)*r*.76f),red);}
        if(e.phase==1){int rr=26*e.timer/52;for(int i=0;i<32;++i){float a=i/32.f*6.283f;renderer.pixel(x+int(cosf(a)*rr),y+int(sinf(a)*rr*.76f),rgba(0xffe08a,pulse));}}
        else for(float t=0;t<1;t+=.04f)renderer.pixel(cx+int((x-cx)*t),cy-10+int((y-cy+10)*t),vio);}
    if(e.phase==2&&e.illusions){for(int l=14;l<120;l+=2){renderer.pixel(cx+int(cosf(e.dx)*l),cy+int(sinf(e.dx)*l),vio);
            renderer.pixel(cx+int(cosf(e.dx)*l-sinf(e.dx)*6),cy+int(sinf(e.dx)*l+cosf(e.dx)*6),rgba(0xa35cc0,60));
            renderer.pixel(cx+int(cosf(e.dx)*l+sinf(e.dx)*6),cy+int(sinf(e.dx)*l-cosf(e.dx)*6),rgba(0xa35cc0,60));}}
    if(e.special==6)for(int i=0;i<3;++i){float a=game.ticks*.15f+i*2.09f;renderer.pixel(cx+int(cosf(a)*9),cy-50+int(sinf(a)*3),rgba(0xfff2c4));}
}
void drawKeeperTelegraphs(const Enemy& e){
    int cx=int(e.x)-renderer.camX,cy=int(e.y)-renderer.camY;
    unsigned pulse=120+unsigned(60*sinf(game.ticks*.4f));
    uint32_t red=rgba(0xe0421f,pulse),core=rgba(0xffb347,pulse/2);
    if(e.special==1){ // ring
        for(int i=0;i<96;++i){float a=i/96.f*6.283f;renderer.pixel(cx+int(cosf(a)*54),cy+int(sinf(a)*41),red);renderer.pixel(cx+int(cosf(a)*53),cy+int(sinf(a)*40),red);}
        int r=54*(40-e.timer)/40;for(int i=0;i<64;++i){float a=i/64.f*6.283f;renderer.pixel(cx+int(cosf(a)*r),cy+int(sinf(a)*r*.76f),core);}
    }
    if(e.special==2||e.special==3){ // cone
        auto d=directions[e.facing];
        for(int l=10;l<96;l+=4)for(int k=-l*6/10;k<=l*6/10;k+=3){
            float px=d.x*l-d.y*k,py=d.y*l+d.x*k;
            renderer.pixel(cx+int(px),cy-8+int(py),e.special==2?red:rgba(0xffd24a,60));}
    }
    if(e.special==4)for(int k=0;k<3;++k){int pxk=int(e.px[k])-renderer.camX,pyk=int(e.py[k])-renderer.camY;
        for(int i=0;i<40;++i){float a=i/40.f*6.283f;renderer.pixel(pxk+int(cosf(a)*20),pyk+int(sinf(a)*15),red);}
        renderer.ellipse(pxk,pyk,20*(50-e.timer)/50,15*(50-e.timer)/50,rgba(0xe0421f,50));}
}
// ------------------------------------------------------------------ boss: «Екінші бейне», the second image (MAP05)
// Phase 1 "prediction": he moves as the hero's mirror image across the hall's axis and reads the hero's step:
//   a ring marks where the hero WILL be, then a cut lands there; a swing at close range is answered with a
//   telegraphed counter-cut. After each strike he lowers the blade for a moment (open, +50% damage).
// Phase 2 "contradiction": three copies stand around the hero. Every one draws a dash line, but only his own
//   is real (the copies' lines are dotted and never hurt). The real one turns to the hero, casts a shadow and
//   raises dust; the copies look away. A blow dissolves a copy; with all copies gone he is exposed.
// Phase 3 "refusal": he lowers the blade for good; blows pass through him and the story takes over (EV_ALERT 99).
inline float clampf(float v,float a,float b){ return v<a?a:v>b?b:v; }
void imageCopies(Enemy& e,const Player& p){
    e.illusions=7; float base=atan2f(e.y-p.y,e.x-p.x);
    for(int k=0;k<3;++k){float a=base+(k+1)*1.5708f;e.px[k]=clampf(p.x+cosf(a)*84,e.homeX-300,e.homeX+300);e.py[k]=clampf(p.y+sinf(a)*52,e.homeY-56,e.homeY+72);}
}
void tickImage(Enemy& e){
    const auto& spec=enemySpecs[e.type];
    bossIndex=int(&e-enemies);
    if(e.state==Death){ if(e.timer>0)--e.timer;
        if(e.timer%4==0&&e.timer>40)for(int i=0;i<4;++i)particle(e.x+(frand()-.5f)*20,e.y-6-frand()*28,(frand()-.5f)*.8f,-frand()*1.6f,40,0,rgba(0x86cdbd));
        if(!e.timer)e.active=false; setAnim(e.anim,e.animTime,art::A_IDLE); return; }
    if(game.cinematic){setAnim(e.anim,e.animTime,e.special==9?art::A_IDLE:art::A_INTERACT);return;}
    int maxhp=spec.health,phase=e.hp*3>maxhp*2?1:e.hp*3>maxhp?2:3;
    if(phase>e.phase){e.phase=phase;e.state=Roar;e.timer=phase==3?50:70;e.special=0;e.illusions=0;e.seed=0;game.shake=phase==3?8:16;sfx(SFX_IMPACT,e.x,e.y);
        for(int i=0;i<30;++i)particle(e.x+(frand()-.5f)*24,e.y-8-frand()*24,(frand()-.5f)*2,-frand()*2,40,0,rgba(0x86cdbd));}
    float dist;int target=nearestPlayer(e,dist);
    const Player& L0=players[target<0?0:target];
    if(e.state==Roar){ setAnim(e.anim,e.animTime,art::A_INTERACT); if(--e.timer<=0){e.state=Chase;e.attack.cooldown=40;
            if(e.phase==2)imageCopies(e,L0); if(e.phase==3){e.special=9;if(!e.aux){e.aux=1;emit(EV_ALERT,int(&e-enemies),99);}}}
        e.lx=L0.x;e.ly=L0.y; return; }
    if(e.special==9){ e.facing=heading(L0.x-e.x,L0.y-e.y); setAnim(e.anim,e.animTime,art::A_IDLE);
        if(!e.aux){e.aux=1;emit(EV_ALERT,int(&e-enemies),99);}
        if(game.ticks%9==0)particle(e.x+(frand()-.5f)*12,e.y-frand()*26,0,-.4f,30,0,rgba(0x86cdbd,150)); return; }
    if(target<0){ setAnim(e.anim,e.animTime,art::A_IDLE); if(e.special!=6&&e.special!=5)e.special=0; return; }
    const Player& p=players[target];
    float dx=p.x-e.x,dy=p.y-e.y;
    if(!e.alerted){e.alerted=1;alertGroup(e.group);e.state=Roar;e.timer=60;sfx(SFX_IMPACT,e.x,e.y);e.lx=p.x;e.ly=p.y;return;}
    if(e.attack.cooldown)--e.attack.cooldown;
    float vx=p.x-e.lx,vy=p.y-e.ly; e.lx=p.x;e.ly=p.y;
    if(e.special==5||e.special==6){ setAnim(e.anim,e.animTime,art::A_HURT);
        if(e.timer%10==0)particle(e.x+(frand()-.5f)*12,e.y-34,0,-.3f,20,0,rgba(0xfff2c4));
        if(--e.timer<=0){bool exposed=e.special==6;e.special=0;e.attack.cooldown=36;e.seed=0;if(exposed&&e.phase==2)imageCopies(e,p);} return; }
    if(e.phase==1){
        if(e.special==1){ setAnim(e.anim,e.animTime,art::A_INTERACT);
            if(--e.timer<=0){keeperHitArea(e.px[0],e.py[0],24,spec.damage);game.shake=7;sfx(SFX_SWORD,e.px[0],e.py[0]);
                for(int i=0;i<14;++i)particle(e.px[0]+(frand()-.5f)*28,e.py[0]-frand()*20,(frand()-.5f),-frand()*1.4f,18,0,rgba(0x86cdbd));
                e.special=5;e.timer=55;e.attack.cooldown=60;}
            return; }
        if(e.special==4){ setAnim(e.anim,e.animTime,art::A_SWORD); e.facing=heading(dx,dy);
            if(--e.timer<=0){for(int s=0;s<MaxPlayers;++s){auto& q=players[s];if(q.active&&q.hp>0&&!q.down&&inCone(e,q.x,q.y+8,46,.45f))hitPlayer(s,spec.damage);}
                sfx(SFX_SWORD,e.x,e.y);e.special=5;e.timer=60;}
            return; }
        if(!e.attack.cooldown){
            if(dist<50&&(p.attack.active||(e.seed++%3)==0)){e.special=4;e.timer=24;sfx(SFX_GROWL,e.x,e.y);return;}
            if(dist>=50){e.special=1;e.timer=48;   // where the hero will be in ~0.7 s
                e.px[0]=clampf(p.x+vx*42,e.homeX-300,e.homeX+300);e.py[0]=clampf(p.y+vy*42,e.homeY-56,e.homeY+72);sfx(SFX_BOWSTRING,e.x,e.y);return;}
        }
        // The mirror: he walks to the hero's reflection across the hall's vertical axis.
        float mx=clampf(2*e.homeX-p.x,e.homeX-300,e.homeX+300),my=clampf(p.y,e.homeY-56,e.homeY+72);
        float md=sqrtf((mx-e.x)*(mx-e.x)+(my-e.y)*(my-e.y));
        if(md>6&&dist>34){walkEnemy(e,mx,my,spec.speed);setAnim(e.anim,e.animTime,art::A_WALK);} else setAnim(e.anim,e.animTime,art::A_IDLE);
        e.facing=heading(dx,dy);
        return;
    }
    // phase 2
    if(e.illusions==0&&e.special!=3&&e.special!=4){e.special=6;e.timer=150;sfx(SFX_IMPACT,e.x,e.y);game.shake=10;
        for(int i=0;i<20;++i)particle(e.x,e.y-16,(frand()-.5f)*2,(frand()-.5f)*2,30,0,rgba(0xfff2c4));return;}
    if(e.special==3){ setAnim(e.anim,e.animTime,art::A_INTERACT); e.facing=heading(e.px[0]-e.x,e.py[0]-e.y);
        if(--e.timer<=0){e.special=4;e.timer=32;e.attack.connected=false;sfx(SFX_SWIPE,e.x,e.y);} return; }
    if(e.special==4){ setAnim(e.anim,e.animTime,art::A_RUN);
        float lx=e.px[0]-e.x,ly=e.py[0]-e.y,l=sqrtf(lx*lx+ly*ly)+.01f,sp=l<5.5f?l:5.5f;
        if(!blockedFeet(e.x+lx/l*sp,e.y+ly/l*sp,5,3)){e.x+=lx/l*sp;e.y+=ly/l*sp;} else l=0;
        if(game.ticks%2==0)particle(e.x,e.y-2,(frand()-.5f)*.6f,-.3f,20,2);
        if(!e.attack.connected)for(int s=0;s<MaxPlayers;++s){auto& q=players[s];if(q.active&&q.hp>0&&!q.down&&fabsf(q.x-e.x)<12&&fabsf(q.y-e.y)<10){hitPlayer(s,spec.damage+2);e.attack.connected=true;}}
        if(l<6||--e.timer<=0){ if(++e.seed>=3){e.special=5;e.timer=90;} else {e.special=0;e.attack.cooldown=26;} }
        return; }
    e.facing=heading(dx,dy);
    if(!e.attack.cooldown&&dist<200){e.special=3;e.timer=34;e.px[0]=p.x;e.py[0]=p.y;sfx(SFX_GROWL,e.x,e.y);return;}
    if(dist>70){walkEnemy(e,p.x,p.y,spec.speed*.8f);setAnim(e.anim,e.animTime,art::A_WALK);if(game.ticks%5==0)particle(e.x,e.y,(frand()-.5f)*.5f,-.2f,18,2);}
    else setAnim(e.anim,e.animTime,art::A_IDLE);
}
void drawImageTelegraphs(const Enemy& e){
    int cx=int(e.x)-renderer.camX,cy=int(e.y)-renderer.camY;
    unsigned pulse=120+unsigned(60*sinf(game.ticks*.4f));uint32_t red=rgba(0xe0421f,pulse),cyan=rgba(0x86cdbd,pulse);
    if(e.phase==1&&e.special==1){int x=int(e.px[0])-renderer.camX,y=int(e.py[0])-renderer.camY;
        for(int i=0;i<48;++i){float a=i/48.f*6.283f;renderer.pixel(x+int(cosf(a)*24),y+int(sinf(a)*24*.76f),red);}
        int rr=24*e.timer/48;for(int i=0;i<32;++i){float a=i/32.f*6.283f;renderer.pixel(x+int(cosf(a)*rr),y+int(sinf(a)*rr*.76f),cyan);}
        for(float t=0;t<1;t+=.05f)renderer.pixel(cx+int((x-cx)*t),cy-12+int((y-cy+12)*t),rgba(0x86cdbd,80));}
    if(e.phase==1&&e.special==4){auto d=directions[e.facing];for(int i=-10;i<=10;++i){float a=atan2f(d.y,d.x)+i*.08f;renderer.pixel(cx+int(cosf(a)*42),cy-6+int(sinf(a)*32),red);}}
    if(e.phase==2&&(e.special==3||e.special==4)){int x=int(e.px[0])-renderer.camX,y=int(e.py[0])-renderer.camY;
        for(float t=0;t<1;t+=.025f)renderer.pixel(cx+int((x-cx)*t),cy-6+int((y-cy+6)*t),red);
        for(int i=0;i<40;++i){float a=i/40.f*6.283f;renderer.pixel(x+int(cosf(a)*12),y+int(sinf(a)*9),red);}
        for(int k=0;k<3;++k)if(e.illusions&(1<<k)){int qx=int(e.px[k])-renderer.camX,qy=int(e.py[k])-renderer.camY;   // false signals: dotted, harmless
            for(float t=0;t<1;t+=.05f)if(int(t*20)%2==0)renderer.pixel(qx+int((x-qx)*t),qy-6+int((y-qy+6)*t),rgba(0xe0421f,pulse/2));}}
    if(e.special==5||e.special==6)for(int i=0;i<3;++i){float a=game.ticks*.15f+i*2.09f;renderer.pixel(cx+int(cosf(a)*8),cy-36+int(sinf(a)*3),rgba(0xfff2c4));}
}
// ------------------------------------------------------------------ boss: «Жалған жарлықтың иесі», the herald of the forged yarlyk (MAP06)
// Phase 1 "yam gallop": he rides the rim of the hall like a relay rider (his path is drawn on the floor); now and
//   then he reins in and looses a fan of arrows (a cone is shown first). At full gallop blows only graze him.
// Phase 2 "paiza": he raises the golden tablet and three tamga seals light up around him; while any seal burns he is
//   untouchable and the seals pulse (a ring shows before each pulse). Only a running lance charge breaks a seal.
// Phase 3 "the forged yarlyk": he reads the decree aloud — lines of the text sweep across the hall one by one, each
//   with one gap to stand in (shown before it moves). After the reading he is winded and open.
void heraldSeals(Enemy& e){ e.illusions=7; for(int k=0;k<3;++k){float a=-1.5708f+k*2.0944f;e.px[k]=e.homeX+cosf(a)*96;e.py[k]=e.homeY+sinf(a)*48+4;} }
void tickHerald(Enemy& e){
    const auto& spec=enemySpecs[e.type];
    bossIndex=int(&e-enemies);
    if(e.state==Death){ if(e.timer>0)--e.timer;
        if(e.timer%5==0&&e.timer>50)for(int i=0;i<5;++i)particle(e.x+(frand()-.5f)*30,e.y-10-frand()*30,(frand()-.5f)*1.4f,-frand()*1.4f,40,0,rgba(frand()<.6f?0xffd24a:0x8f1d22));
        if(!e.timer)e.active=false; setAnim(e.anim,e.animTime,art::A_DEATH); return; }
    if(game.cinematic){setAnim(e.anim,e.animTime,art::A_IDLE);return;}
    int maxhp=spec.health,phase=e.hp*3>maxhp*2?1:e.hp*3>maxhp?2:3;
    if(phase>e.phase){e.phase=phase;e.state=Roar;e.timer=80;e.special=0;e.illusions=0;e.seed=0;game.shake=18;sfx(SFX_SHOUT,e.x,e.y);
        for(int i=0;i<36;++i)particle(e.x+(frand()-.5f)*30,e.y-10-frand()*24,(frand()-.5f)*2.5f,-frand()*2,44,0,rgba(0xffd24a));}
    if(e.state==Roar){ setAnim(e.anim,e.animTime,art::A_VICTORY);
        if(--e.timer<=0){e.state=Chase;e.attack.cooldown=30;if(e.phase>=2){e.x=e.homeX;e.y=e.homeY;}if(e.phase==2)heraldSeals(e);} return; }
    float dist;int target=nearestPlayer(e,dist);
    if(target<0){ setAnim(e.anim,e.animTime,art::A_IDLE); if(e.special!=6&&e.special!=5)e.special=0; return; }
    const Player& p=players[target];
    float dx=p.x-e.x,dy=p.y-e.y;
    if(!e.alerted){e.alerted=1;alertGroup(e.group);e.state=Roar;e.timer=70;game.shake=12;sfx(SFX_HOOVES,e.x,e.y);return;}
    if(e.attack.cooldown)--e.attack.cooldown;
    if(e.special==5||e.special==6){ setAnim(e.anim,e.animTime,art::A_HURT);   // winded / exposed
        if(e.timer%10==0)particle(e.x+(frand()-.5f)*14,e.y-34,0,-.3f,20,0,rgba(0xfff2c4));
        if(--e.timer<=0){bool ex=e.special==6;e.special=0;e.attack.cooldown=36;e.seed=0;if(ex&&e.phase==2)heraldSeals(e);} return; }
    if(e.phase==1){
        if(e.special==3){ setAnim(e.anim,e.animTime,art::A_BOW); e.facing=heading(dx,dy);
            if(--e.timer<=0){for(int k=-1;k<=1;++k)launch(int(&e-enemies),e.x,e.y-14,(e.facing+k+8)&7,spec.damage-6);
                sfx(SFX_BOW,e.x,e.y);e.special=0;e.attack.cooldown=130;}
            return; }
        if(!e.attack.cooldown&&dist<230){e.special=3;e.timer=34;sfx(SFX_BOWSTRING,e.x,e.y);return;}
        // the gallop: a fixed ellipse round the hall's centre (drawn on the floor), trampling whoever stands on it
        e.dx+=.012f;if(e.dx>6.2832f)e.dx-=6.2832f;
        float tx=e.homeX+cosf(e.dx)*150,ty=e.homeY+sinf(e.dx)*58;
        walkEnemy(e,tx,ty,spec.speed);setAnim(e.anim,e.animTime,art::A_RUN);
        if(game.ticks%3==0)particle(e.x,e.y,(frand()-.5f)*.6f,-.3f,18,2);
        for(int s=0;s<MaxPlayers;++s){auto& q=players[s];if(q.active&&q.hp>0&&!q.down&&!q.invuln&&fabsf(q.x-e.x)<12&&fabsf(q.y-e.y)<9)hitPlayer(s,spec.damage);}
        return;
    }
    if(e.phase==2){   // rooted at the centre behind the burning seals
        setAnim(e.anim,e.animTime,art::A_INTERACT); e.facing=heading(dx,dy);
        if(!e.illusions){e.special=6;e.timer=160;sfx(SFX_IMPACT,e.x,e.y);game.shake=12;return;}
        if(++e.seed>=150){e.seed=0;}
        if(e.seed==110)for(int k=0;k<3;++k)if(e.illusions&(1<<k))keeperHitArea(e.px[k],e.py[k],30,spec.damage-4);   // the pulse
        return;
    }
    // phase 3 — the reading: three lines sweep the hall top to bottom, each with one gap
    if(e.special==7){ setAnim(e.anim,e.animTime,art::A_INTERACT);
        ++e.aux; int line=e.aux/70, t=e.aux%70;
        if(t==0){e.py[0]=e.homeY-62;e.px[1]=e.homeX+(frand()-.5f)*360;}
        if(t>=24){e.py[0]+=3.2f;   // the line moves after a 24-tick warning
            for(int s=0;s<MaxPlayers;++s){auto& q=players[s];if(q.active&&q.hp>0&&!q.down&&!q.invuln&&fabsf(q.y-e.py[0])<6&&fabsf(q.x-e.px[1])>22)hitPlayer(s,spec.damage-2);}}
        if(line>=3){e.special=5;e.timer=120;e.aux=0;sfx(SFX_IMPACT,e.x,e.y);}
        return; }
    if(!e.attack.cooldown){e.special=7;e.aux=0;sfx(SFX_SHOUT,e.x,e.y);return;}
    setAnim(e.anim,e.animTime,art::A_IDLE);
}
void drawHeraldTelegraphs(const Enemy& e){
    int cx=int(e.x)-renderer.camX,cy=int(e.y)-renderer.camY;
    unsigned pulse=120+unsigned(60*sinf(game.ticks*.4f));uint32_t red=rgba(0xe0421f,pulse),gold=rgba(0xffd24a,pulse);
    int hx=int(e.homeX)-renderer.camX,hy=int(e.homeY)-renderer.camY;
    if(e.phase==1){for(int i=0;i<96;i+=2){float a=i/96.f*6.283f;renderer.pixel(hx+int(cosf(a)*150),hy+int(sinf(a)*58),rgba(0xb8442b,90));}
        if(e.special==3){auto d=directions[e.facing];for(int l=12;l<150;l+=5)for(int k=-l*4/10;k<=l*4/10;k+=4)renderer.pixel(cx+int(d.x*l-d.y*k),cy-12+int(d.y*l+d.x*k),red);}}
    if(e.phase==2&&e.illusions)for(int k=0;k<3;++k)if(e.illusions&(1<<k)){int x=int(e.px[k])-renderer.camX,y=int(e.py[k])-renderer.camY;
        renderer.sprite(art::O_TAMGA,int(e.px[k]),int(e.py[k]));
        for(int i=0;i<24;++i){float a=i/24.f*6.283f+game.ticks*.05f;renderer.pixel(x+int(cosf(a)*9),y-2+int(sinf(a)*5),gold);}
        if(e.seed>80&&e.seed<110){int r=30;for(int i=0;i<48;++i){float a=i/48.f*6.283f;renderer.pixel(x+int(cosf(a)*r),y+int(sinf(a)*r*.76f),red);}}}
    if(e.phase==3&&e.special==7){int y=int(e.py[0])-renderer.camY,gx=int(e.px[1])-renderer.camX,t=e.aux%70;
        uint32_t col=t<24?rgba(0xffd24a,pulse/2):rgba(0xe0421f,200);
        for(int x=hx-330;x<hx+330;x+=2)if(abs(x-gx)>22){renderer.pixel(x,y,col);renderer.pixel(x,y+1,col);}
        for(int i=0;i<12;++i){renderer.pixel(gx-22,y-6+i,rgba(0x86cdbd,pulse));renderer.pixel(gx+22,y-6+i,rgba(0x86cdbd,pulse));}}
    if(e.special==5||e.special==6)for(int i=0;i<3;++i){float a=game.ticks*.15f+i*2.09f;renderer.pixel(cx+int(cosf(a)*8),cy-38+int(sinf(a)*3),rgba(0xfff2c4));}
}
// ------------------------------------------------------------------ boss: Зұлмат, the two hands (MAP10, the finale)
// Phase 1 "the Heir": he marks a line toward the hero and dashes along it; close in, a wide cut. The back of the dash is open.
// Phase 2 "the Chronicler": rooted at the centre, he writes — three lines of ink sweep the hall, each with one gap; then he
//   is winded and open. Two ink shades (his group) wake with this phase.
// Phase 3 "both hands": dash and line alternate faster. His health stops at the floor the level sets (tj_boss_floor)
//   until the story lets the fight end; then every blow of the sword lands double.
void tickZulmat(Enemy& e){
    const auto& spec=enemySpecs[e.type];
    bossIndex=int(&e-enemies);
    if(e.state==Death){ if(e.timer>0)--e.timer;
        if(e.timer%4==0&&e.timer>40)for(int i=0;i<6;++i)particle(e.x+(frand()-.5f)*40,e.y-10-frand()*40,(frand()-.5f)*1.6f,-frand()*1.6f,44,0,rgba(frand()<.5f?0x1a1424:0x7ff5e4));
        if(!e.timer)e.active=false; setAnim(e.anim,e.animTime,art::A_DEATH); return; }
    if(game.cinematic){setAnim(e.anim,e.animTime,art::A_IDLE);return;}
    int maxhp=spec.health,phase=e.hp*3>maxhp*2?1:e.hp*3>maxhp?2:3;
    if(phase>e.phase){e.phase=phase;e.state=Roar;e.timer=80;e.special=0;e.aux=0;e.seed=0;game.shake=18;sfx(SFX_SHOUT,e.x,e.y);
        for(int i=0;i<40;++i)particle(e.x+(frand()-.5f)*30,e.y-10-frand()*30,(frand()-.5f)*2.6f,-frand()*2,44,0,rgba(frand()<.5f?0x7ff5e4:0x2a1f3a));}
    if(e.state==Roar){ setAnim(e.anim,e.animTime,art::A_VICTORY);
        if(--e.timer<=0){e.state=Chase;e.attack.cooldown=30;if(e.phase==2){e.x=e.homeX;e.y=e.homeY;}} return; }
    float dist;int target=nearestPlayer(e,dist);
    if(target<0){ setAnim(e.anim,e.animTime,art::A_IDLE); return; }
    const Player& p=players[target];
    float dx=p.x-e.x,dy=p.y-e.y;
    if(!e.alerted){e.alerted=1;alertGroup(e.group);e.state=Roar;e.timer=70;game.shake=12;sfx(SFX_SHOUT,e.x,e.y);return;}
    if(e.attack.cooldown)--e.attack.cooldown;
    if(e.special==5){ setAnim(e.anim,e.animTime,art::A_HURT);   // winded: open
        if(e.timer%10==0)particle(e.x+(frand()-.5f)*14,e.y-34,0,-.3f,20,0,rgba(0x7ff5e4));
        if(--e.timer<=0){e.special=0;e.attack.cooldown=e.phase==3?24:40;} return; }
    if(e.special==1){ setAnim(e.anim,e.animTime,art::A_SWORD);   // dash telegraph: the line is drawn
        if(--e.timer<=0){e.special=2;e.timer=22;sfx(SFX_SWIPE,e.x,e.y);} return; }
    if(e.special==2){ setAnim(e.anim,e.animTime,art::A_RUN);    // the dash
        float lx=e.px[0]-e.x,ly=e.py[0]-e.y,l=sqrtf(lx*lx+ly*ly)+.01f;float sp=5.2f;
        if(l>sp){e.x+=lx/l*sp;e.y+=ly/l*sp;}
        if(game.ticks%2==0)particle(e.x,e.y-12,(frand()-.5f)*.6f,-.2f,22,0,rgba(0x2a1f3a));
        for(int s=0;s<MaxPlayers;++s){auto& q=players[s];if(q.active&&q.hp>0&&!q.down&&!q.invuln&&fabsf(q.x-e.x)<13&&fabsf(q.y-e.y)<10)hitPlayer(s,spec.damage);}
        if(l<=sp||--e.timer<=0){e.special=5;e.timer=e.phase==3?50:70;game.shake=6;} return; }
    if(e.special==3){ setAnim(e.anim,e.animTime,art::A_SWORD); e.facing=heading(dx,dy);   // the wide cut
        if(--e.timer<=0){auto d=directions[e.facing];keeperHitArea(e.x+d.x*20,e.y+d.y*14,30,spec.damage);sfx(SFX_SWORD,e.x,e.y);e.special=0;e.attack.cooldown=50;} return; }
    if(e.special==7){ setAnim(e.anim,e.animTime,art::A_INTERACT);   // writing: lines sweep down with one gap each
        ++e.aux; int len=e.phase==3?56:70, line=e.aux/len, t=e.aux%len;
        if(t==0){e.py[1]=e.homeY-70;e.px[1]=e.homeX+(frand()-.5f)*360;}
        if(t>=22){e.py[1]+=3.4f;
            for(int s=0;s<MaxPlayers;++s){auto& q=players[s];if(q.active&&q.hp>0&&!q.down&&!q.invuln&&fabsf(q.y-e.py[1])<6&&fabsf(q.x-e.px[1])>22)hitPlayer(s,spec.damage-4);}}
        if(line>=(e.phase==3?2:3)){e.special=5;e.timer=e.phase==3?70:110;e.aux=0;sfx(SFX_IMPACT,e.x,e.y);}
        return; }
    if(!e.attack.cooldown){
        bool write=e.phase==2||(e.phase==3&&(e.seed++&1));
        if(write){e.special=7;e.aux=0;if(e.phase==2){e.x=e.homeX;e.y=e.homeY;}sfx(SFX_SHOUT,e.x,e.y);return;}
        if(dist<34){e.special=3;e.timer=20;return;}
        e.special=1;e.timer=e.phase==3?26:36;e.px[0]=p.x;e.py[0]=p.y;e.facing=heading(dx,dy);sfx(SFX_GROWL,e.x,e.y);return;
    }
    if(e.phase==2){setAnim(e.anim,e.animTime,art::A_IDLE);return;}
    if(dist>30){walkEnemy(e,p.x,p.y,spec.speed);setAnim(e.anim,e.animTime,art::A_WALK);}
    else setAnim(e.anim,e.animTime,art::A_IDLE);
}
void drawZulmatTelegraphs(const Enemy& e){
    int cx=int(e.x)-renderer.camX,cy=int(e.y)-renderer.camY;
    unsigned pulse=120+unsigned(60*sinf(game.ticks*.4f));uint32_t ink=rgba(0x7ff5e4,pulse),red=rgba(0xe0421f,200);
    int hx=int(e.homeX)-renderer.camX;
    if(e.special==1){float lx=e.px[0]-e.x,ly=e.py[0]-e.y,l=sqrtf(lx*lx+ly*ly)+.01f;
        for(float t=0;t<l;t+=3){int x=cx+int(lx/l*t),y=cy-6+int(ly/l*t);renderer.pixel(x,y,ink);renderer.pixel(x,y+1,ink);}
        int ex=int(e.px[0])-renderer.camX,ey=int(e.py[0])-renderer.camY;for(int i=0;i<24;++i){float a=i/24.f*6.283f;renderer.pixel(ex+int(cosf(a)*11),ey+int(sinf(a)*7),red);}}
    if(e.special==3){auto d=directions[e.facing];for(int i=-10;i<=10;++i){float a=atan2f(d.y,d.x)+i*.08f;renderer.pixel(cx+int(cosf(a)*30),cy-6+int(sinf(a)*22),red);}}
    if(e.special==7){int len=e.phase==3?56:70,t=e.aux%len,y=int(e.py[1])-renderer.camY,gx=int(e.px[1])-renderer.camX;
        uint32_t col=t<22?rgba(0x7ff5e4,pulse/2):rgba(0x1a1424,230);
        for(int x=hx-330;x<hx+330;x+=2)if(abs(x-gx)>22){renderer.pixel(x,y,col);renderer.pixel(x,y+1,col);renderer.pixel(x+1,y+1,col);}
        for(int i=0;i<12;++i){renderer.pixel(gx-22,y-6+i,rgba(0xffd24a,pulse));renderer.pixel(gx+22,y-6+i,rgba(0xffd24a,pulse));}}
    if(e.special==5)for(int i=0;i<3;++i){float a=game.ticks*.15f+i*2.09f;renderer.pixel(cx+int(cosf(a)*8),cy-40+int(sinf(a)*3),rgba(0xfff2c4));}
}
void drawBossBar(const Enemy& e){
    int w=260,x=(Width-w)/2,y=Height-30;
    renderer.rect(x-2,y-2,w+4,9,rgba(0x120f14,220));
    renderer.rect(x,y,w,5,rgba(0x3a1210,230));
    renderer.rect(x,y,w*e.hp/enemySpecs[e.type].health,5,rgba(e.phase==3?0xffd24a:e.phase==2?0xf59a2a:0xe0621f));
    for(int k=1;k<3;++k)renderer.rect(x+w*k/3,y-1,1,7,rgba(0xfff2c4,160));
}
void tickEnemy(Enemy& e){
    if(e.type==Keeper&&e.state!=Hurt){ ++e.animTime;if(e.hitFlash)--e.hitFlash;if(e.showBar)--e.showBar; tickKeeper(e); return; }
    if(e.type==Rider){ ++e.animTime;if(e.hitFlash)--e.hitFlash;if(e.showBar)--e.showBar; tickRider(e); return; }
    if(e.type==Witness){ ++e.animTime;if(e.hitFlash)--e.hitFlash;if(e.showBar)--e.showBar; tickWitness(e); return; }
    if(e.type==Image){ ++e.animTime;if(e.hitFlash)--e.hitFlash;if(e.showBar)--e.showBar; tickImage(e); return; }
    if(e.type==Herald){ ++e.animTime;if(e.hitFlash)--e.hitFlash;if(e.showBar)--e.showBar; tickHerald(e); return; }
    if(e.type==Zulmat){ ++e.animTime;if(e.hitFlash)--e.hitFlash;if(e.showBar)--e.showBar; tickZulmat(e); return; }
    const auto& spec=enemySpecs[e.type];auto& a=e.attack;
    ++e.animTime;
    if(e.hitFlash)--e.hitFlash;
    if(e.showBar)--e.showBar;
    if(a.cooldown)--a.cooldown;
    if(e.state==Death){ if(e.timer>0)--e.timer; if(!e.timer)e.active=false; setAnim(e.anim,e.animTime,art::A_DEATH); return; }
    if(game.cinematic){setAnim(e.anim,e.animTime,art::A_IDLE);return;}
    if(e.state==Hurt){ if(--e.timer<=0)e.state=Chase; setAnim(e.anim,e.animTime,art::A_HURT); return; }
    if(e.state==Stunned){ if(--e.timer<=0)e.state=Chase; setAnim(e.anim,e.animTime,art::A_IDLE);
        if(e.timer%10==0)particle(e.x+(frand()-.5f)*12,e.y-30,0,-.3f,20,0,rgba(0xfff2c4)); return; }
    if(a.active){
        ++a.age;
        if((e.type==Wolf||e.type==Shade)&&a.age<spec.windup){ auto d=directions[a.facing]; if(a.age>spec.windup-8)moveEnemy(e,d.x*2.2f,d.y*2.2f); }
        if(a.age==spec.windup)enemyResolveAttack(e);
        if(a.age>=spec.windup+12){a.active=false;e.state=e.type==Wolf?Circle:Chase;e.timer=40+int(rng()%40);}
        setAnim(e.anim,e.animTime,e.type==Wolf?art::A_BITE:e.type==Bear?art::A_SWIPE:e.type==Archer?art::A_BOW:e.type==Shade?art::A_SWORD:e.type==Wraith?art::A_ROAR:art::A_SPEAR);
        return;
    }
    float dist;int target=nearestPlayer(e,dist);
    if(e.leash>0){--e.leash;target=-1;}
    e.target=target;
    if(target<0){
        e.alerted=e.alerted>0&&e.state==Chase?e.alerted:0;
        // Patrol around home.
        if(e.state==Roar||e.state==Charge||e.state==Telegraph)e.state=Idle;
        float px=e.homeX+((e.timer/150)%2?18:-18),py=e.homeY+((e.seed+e.timer/150)%3-1)*8;
        float hx=px-e.x,hy=py-e.y;
        if(hx*hx+hy*hy<3){e.state=Idle;setAnim(e.anim,e.animTime,art::A_IDLE);}
        else {e.state=Patrol;walkEnemy(e,px,py,spec.speed*.45f);setAnim(e.anim,e.animTime,art::A_WALK);}
        ++e.timer;
        if(e.type==Wolf&&e.timer%900==e.seed*31%900)sfx(SFX_HOWL,e.x,e.y);
        return;
    }
    const Player& p=players[target];
    float dx=p.x-e.x,dy=p.y-e.y;
    if(!e.alerted){e.alerted=1;alertGroup(e.group);
        if(e.type==Bear){e.state=Roar;e.timer=70;sfx(SFX_ROAR,e.x,e.y);game.shake=18;}
        else sfx(e.type==Wolf?SFX_HOWL:SFX_SHOUT,e.x,e.y);}
    // Leash: give up when the target drags them far away from home.
    float hx=p.x-e.homeX,hy=p.y-e.homeY;
    if(hx*hx+hy*hy>260*260&&e.type!=Bear){e.alerted=0;e.state=Patrol;e.leash=240;return;}
    if(e.state==Roar){ e.facing=heading(dx,dy); setAnim(e.anim,e.animTime,art::A_ROAR); if(--e.timer<=0){e.state=Chase;e.timer=90;} return; }
    if(e.type==Bear){
        if(e.state==Telegraph){ setAnim(e.anim,e.animTime,art::A_ROAR); if(--e.timer<=0){e.state=Charge;e.timer=55;float len=sqrtf(dx*dx+dy*dy)+.01f;e.dx=dx/len;e.dy=dy/len;e.facing=heading(dx,dy);sfx(SFX_ROAR,e.x,e.y);} return; }
        if(e.state==Charge){
            setAnim(e.anim,e.animTime,art::A_CHARGE);
            float nx=e.x+e.dx*3.4f,ny=e.y+e.dy*3.4f;
            if(blockedFeet(nx,ny,8,3)){e.state=Stunned;e.timer=110;game.shake=14;sfx(SFX_IMPACT,e.x,e.y);
                for(int i=0;i<10;++i)particle(e.x+e.dx*12,e.y,(frand()-.5f)*2,-frand()*1.5f,24,2);return;}
            for(int s=0;s<MaxPlayers;++s){auto& q=players[s];if(q.active&&q.hp>0&&!q.down&&fabsf(q.x-nx)<14&&fabsf(q.y-ny)<10){hitPlayer(s,30);e.state=Chase;e.timer=80;a.cooldown=60;return;}}
            e.x=nx;e.y=ny;if(e.animTime%8==0)particle(e.x,e.y,0,-.3f,18,2);
            if(--e.timer<=0){e.state=Chase;e.timer=100;}
            return;
        }
        if(dist>46&&dist<230&&e.timer<=0&&!a.cooldown){e.state=Telegraph;e.timer=30;e.facing=heading(dx,dy);return;}
        if(e.timer>0)--e.timer;
    }
    if(e.type==Archer||e.type==Wraith){
        e.facing=heading(dx,dy);
        if(dist<56){ walkEnemy(e,e.x-dx,e.y-dy,spec.speed); e.facing=heading(dx,dy); setAnim(e.anim,e.animTime,art::A_RUN); return; }
        if(dist<=spec.range&&!a.cooldown){startAttack(a,Bow,e.facing,e.x,e.y);a.cooldown=spec.windup+spec.recovery;e.state=Attacking;return;}
        if(dist>spec.range-10){walkEnemy(e,p.x,p.y,spec.speed);setAnim(e.anim,e.animTime,art::A_WALK);}
        else setAnim(e.anim,e.animTime,art::A_IDLE);
        return;
    }
    if(e.type==Wolf&&e.state==Circle){
        // Pack tactic: strafe around the target before lunging again.
        float len=dist+.01f,sx=-dy/len,sy=dx/len; if(e.seed%2){sx=-sx;sy=-sy;}
        float want=dist<34?-.6f:dist>58?.6f:0;
        moveEnemy(e,sx*spec.speed+dx/len*want,sy*spec.speed+dy/len*want);
        e.facing=heading(dx,dy);setAnim(e.anim,e.animTime,art::A_RUN);
        if(--e.timer<=0)e.state=Chase;
        return;
    }
    e.state=Chase;
    if(dist<=spec.range&&!a.cooldown){
        e.facing=heading(dx,dy);startAttack(a,e.type,e.facing,e.x,e.y);a.cooldown=spec.windup+spec.recovery;e.state=Attacking;
        if(e.type==Wolf)sfx(SFX_GROWL,e.x,e.y);
        return;
    }
    if(dist>spec.range-2){walkEnemy(e,p.x,p.y,spec.speed);setAnim(e.anim,e.animTime,e.type==Bear?art::A_WALK:art::A_RUN);}
    else {e.facing=heading(dx,dy);setAnim(e.anim,e.animTime,art::A_IDLE);}
}
void tickEnemies(){
    for(auto& e:enemies){
        e.enabled=((game.groups>>e.group)&1)||(bossIndex>=0&&enemies[bossIndex].hp>0&&enemies[bossIndex].phase>=2&&e.group==enemies[bossIndex].group+1);
        if(!e.active||!e.enabled)continue;
        if(game.netRole==1){ // Network client: smooth towards the host snapshot.
            ++e.animTime;if(e.hitFlash)--e.hitFlash;if(e.showBar)--e.showBar;
            float dx=e.nx-e.x,dy=e.ny-e.y; if(dx*dx+dy*dy>120*120){e.x=e.nx;e.y=e.ny;}else{e.x+=dx*.2f;e.y+=dy*.2f;}
            if(e.state==Death&&e.timer>0&&--e.timer==0)e.active=false;
            continue;
        }
        tickEnemy(e);
    }
}
void tickProjectiles(){
    for(auto& p:projectiles)if(p.active){
        float stepLen=sqrtf(p.dx*p.dx+p.dy*p.dy)/4;
        for(int step=0;step<4&&p.active;++step){
            p.x+=p.dx/4;p.y+=p.dy/4;p.remaining-=stepLen;
            if(p.remaining<=0){p.active=false;if(p.bullet)emit(EV_IMPACT,int(p.x),int(p.y));break;}
            if(solidAt(p.x,p.y+6)){p.active=false;
                if(p.bullet){emit(EV_IMPACT,int(p.x),int(p.y));sfx(SFX_RICOCHET,p.x,p.y);for(int i=0;i<5;++i)particle(p.x,p.y,(frand()-.5f)*2.2f,-frand()*1.8f,10,0,rgba(frand()<.5f?0xfff2b0:0xb8b0a0));particle(p.x,p.y,0,-.2f,18,2);}
                else {sfx(SFX_ARROW_HIT,p.x,p.y);for(int i=0;i<3;++i)particle(p.x,p.y,(frand()-.5f),-frand(),12,0,rgba(0xcfc8b0));}
                break;}
            if(p.cosmetic)continue;
            if(p.owner<0){
                for(int i=0;i<EnemyCount;++i){auto& e=enemies[i];
                    float hh=e.type==Bear?16:9;
                    if(e.enabled&&e.hp>0&&fabsf(e.x-p.x)<(e.type==Bear?13:8)&&p.y>e.y-hh-12&&p.y<e.y+2){
                        float l=sqrtf(p.dx*p.dx+p.dy*p.dy)+.01f;   // knock back along the flight, as far as an arrow would
                        playerHitsEnemy(i,(isBossType(e.type)||e.type==Bear)?p.damage*3/5:p.damage,p.x-p.dx/l*12,p.y-p.dy/l*12);p.active=false;
                        if(p.bullet)emit(EV_IMPACT,int(p.x),int(p.y));
                        if(p.bullet)for(int k=0;k<6;++k)particle(p.x,p.y,(frand()-.5f)*2+p.dx/l,(frand()-.5f)*2-.5f,10,0,rgba(frand()<.5f?0xfff2b0:0xc04030));
                        else sfx(SFX_ARROW_HIT,p.x,p.y);break;}}
            } else if(game.netRole==0){
                for(int s=0;s<MaxPlayers;++s){auto& q=players[s];
                    if(q.active&&q.hp>0&&!q.down&&fabsf(q.x-p.x)<6&&p.y>q.y-22&&p.y<q.y+2){game.hitRanged=1;hitPlayer(s,p.damage);game.hitRanged=0;p.active=false;break;}}
            }
        }
    }
}
void tickPickups(){
    Player& p=me();
    if(p.hp<=0||p.down||p.dead)return;
    for(auto& k:pickups)if(k.active){
        ++k.bob;
        float dx=k.x-p.x,dy=k.y-p.y;
        if(dx*dx+dy*dy<11*11){
            int& c=game.inv.counts[k.item-1];
            if(c>=items[k.item-1].limit)continue;
            c+=k.qty;if(c>items[k.item-1].limit)c=items[k.item-1].limit;
            k.active=false;if(k.id>=0)game.staticPicked|=1u<<k.id;
            game.lastPickup=k.item;emit(EV_PICKUP,k.item,k.qty);sfx(SFX_PICKUP,k.x,k.y);
            for(int i=0;i<6;++i)particle(k.x,k.y-4,(frand()-.5f)*1.5f,-frand()*1.5f,16,0,rgba(0xf3d68b));
        }
    }
}
void tickWorldFx(){
    // Plates: co-op mechanism, any player standing on a plate presses it.
    int mask=0;
    for(int i=0,bit=0;i<ObjCount;++i){const Obj& o=objs[i];if(!(kinds[o.kind].flags&F_PLATE))continue;
        bool on=false;
        if(!world.hiddenTag[o.tag])for(const auto& p:players)if(p.active&&p.hp>0&&fabsf(p.x-o.x)<9&&fabsf(p.y-o.y)<7)on=true;
        if(on)mask|=1<<bit;
        if(o.tag)world.variant[o.tag]=on;
        ++bit;}
    if(mask!=game.platesMask){game.platesMask=mask;emit(EV_PLATES,mask);}
    // Ambient particles in view.
    int ax=int(game.camX),ay=int(game.camY);
    bool overworld=area().outdoor;
    bool dusk=game.amb[2]>game.amb[0]||game.amb[0]<170;
    if(overworld&&game.ticks%5==0)particle(ax+frand()*Width,ay+frand()*Height,.25f+frand()*.3f,-.05f,140,dusk?5:0,dusk?rgba(0xf6f0a0,0):rgba(0xfff2c4,150));
    int fx=zoneFx[game.zone<ZoneCount?game.zone:0];
    if((fx&1)&&game.ticks%23==0)particle(ax+frand()*Width,ay-4,.3f,.35f,300,4);
    if((fx&2)&&game.ticks%9==0)particle(ax+frand()*Width,ay+frand()*Height,0,.12f,120,0,rgba(0x86c8c0,120));
    if((fx&4)&&game.ticks%4==0)particle(ax+frand()*Width,ay-2,.15f+frand()*.2f,.22f+frand()*.15f,260,0,rgba(0xa8a39a,140));
    if((fx&8)&&game.ticks%5==0)particle(ax+frand()*Width,ay+Height+2,(frand()-.5f)*.3f,-.4f-frand()*.3f,220,0,rgba(0xffb347,190));
    if(game.fogCur>20&&game.ticks%3==0)particle(ax+frand()*Width,ay+frand()*Height,.2f+frand()*.2f,-.02f,160,6);
    for(int i=0;i<ObjCount;++i){const Obj& o=objs[i];
        if(!(kinds[o.kind].flags&F_FLICKER)||(o.tag&&world.hiddenTag[o.tag])||o.x<ax-40||o.x>ax+Width+40||o.y<ay-40||o.y>ay+Height+60)continue;
        if((game.ticks+i*7)%14==0)particle(o.x+(frand()-.5f)*6,o.y-14,.15f+(frand()-.5f)*.2f,-.45f,90,1);
        if((game.ticks+i*3)%7==0)particle(o.x+(frand()-.5f)*6,o.y-10,(frand()-.5f)*.4f,-.8f-frand()*.4f,40,0,rgba(0xffb347));
    }
    for(auto& q:particles)if(q.life>0){--q.life;q.x+=q.vx;q.y+=q.vy;if(q.type==4)q.vx=.3f+sinf((q.life+q.y)*.05f)*.4f;if(q.type==5){q.vx=sinf((q.life*7+int(q.x))*.03f)*.3f;q.vy=cosf((q.life*5+int(q.y))*.04f)*.2f;}}
}
void tickTriggers(){
    Player& p=me();
    for(int i=0;i<TriggerCount;++i){const auto& t=triggers[i];
        if(!((game.triggerArmed>>i)&1)||((game.triggerFired>>i)&1))continue;
        if(p.x>=t.x0&&p.x<t.x1&&p.y>=t.y0&&p.y<t.y1){game.triggerFired|=1u<<i;emit(EV_TRIGGER,i);}
    }
}
void tickCamera(){
    const Player& p=me();
    float tx,ty;
    if(game.camMode==0){auto d=directions[p.facing];tx=p.x+d.x*(p.moving?14:4)-Width/2;ty=p.y-10+d.y*(p.moving?10:3)-Height/2;
        game.camX+=(tx-game.camX)*.12f;game.camY+=(ty-game.camY)*.12f;}
    else {tx=game.camTX-Width/2;ty=game.camTY-Height/2;float dx=tx-game.camX,dy=ty-game.camY,len=sqrtf(dx*dx+dy*dy);
        if(len<=game.camSpeed){game.camX=tx;game.camY=ty;}else{game.camX+=dx/len*game.camSpeed;game.camY+=dy/len*game.camSpeed;}}
    const Area& a=area();
    if(game.camX<a.x0)game.camX=a.x0; if(game.camY<a.y0)game.camY=a.y0;
    if(game.camX>a.x1-Width)game.camX=a.x1-Width; if(game.camY>a.y1-Height)game.camY=a.y1-Height;
}
void snapCamera(){ game.camMode=0;const Player& p=me();game.camX=p.x-Width/2;game.camY=p.y-10-Height/2;tickCamera();game.camX=p.x-Width/2;game.camY=p.y-10-Height/2;
    const Area& a=area();if(game.camX<a.x0)game.camX=a.x0;if(game.camY<a.y0)game.camY=a.y0;if(game.camX>a.x1-Width)game.camX=a.x1-Width;if(game.camY>a.y1-Height)game.camY=a.y1-Height; }

void tick(){
    if(game.paused)return;
    ++game.ticks; // events accumulate until JS clears them
    if(game.interactCooldown)--game.interactCooldown;
    if(game.hurtFlash)--game.hurtFlash;
    if(game.shake)--game.shake;
    const Area& ar_=area();
    for(int k=0;k<3;++k){int target=ar_.dark?(k==0?ar_.r:k==1?ar_.g:ar_.b):game.ambT[k];if(game.amb[k]<target)++game.amb[k];else if(game.amb[k]>target)--game.amb[k];}
    if(game.fogCur<game.fog)game.fogCur+=2;else if(game.fogCur>game.fog)game.fogCur-=2;
    Player& p=me();
    if(!game.gameover){
        tickLocalPlayer();
        tickEffects();
        if(!game.cinematic&&p.hp>0&&!p.down&&!p.dead){updateFocus();tickHold();if((p.keys&Interact)&&!(game.prevKeys&Interact))pressInteract();}
        else {game.focusKind=-1;game.focusId=-1;}
        game.prevKeys=p.keys;
    }
    tickRemotePlayers();tickNpcs();tickAnimals();tickEnemies();tickProjectiles();tickPickups();tickWorldFx();
    if(!game.cinematic)tickTriggers();
    int z=zoneAt(p.x,p.y);
    if(z!=game.zone){game.zone=z;game.visited|=1<<z;emit(EV_ZONE,z);}
    tickCamera();
}

// ------------------------------------------------------------------ rendering
static const int view5[8]={4,3,2,1,0,1,2,3};
static const bool flip5[8]={false,false,false,false,false,true,true,true};
static const int view3[8]={2,1,1,1,0,1,1,1};
void drawActor(int sheet,int anim,int f,int facing,float x,float y,unsigned alpha=255,int flash=0,uint32_t tint=0,bool castShadow=true){
    const auto& sh=art::sheets[sheet];
    int view=sh.views==5?view5[facing]:view3[facing];bool flip=sh.views==5?flip5[facing]:(facing>=5);
    int shadow=sh.cell>=48?4:sheet==art::SH_HARE?0:2;
    if(castShadow&&(anim!=art::A_DEATH||f<2))renderer.sprite(art::X_SHADOW_0+shadow,int(x),int(y),false,alpha*2/3);
    if(!renderer.frame(sheet,anim,view,f,int(x),int(y),flip,alpha,flash,tint))renderer.frame(sheet,art::A_IDLE,view,0,int(x),int(y),flip,alpha,flash,tint);
}
int loopFrame(int anim,int time){int n=art::animFrames[anim];int f=time/animFrameTicks(anim);return anim==art::A_DEATH?(f>=n?n-1:f):f%n;}
void drawTerrain(){
    int cx=int(game.camX),cy=int(game.camY);
    int tx0=cx/Tile,ty0=cy/Tile,tx1=(cx+Width)/Tile,ty1=(cy+Height)/Tile;
    static const int ndx[8]={0,1,0,-1,1,1,-1,-1},ndy[8]={-1,0,1,0,-1,1,1,-1};
    for(int ty=ty0;ty<=ty1;++ty)for(int tx=tx0;tx<=tx1;++tx){
        int t=terrainAt(tx,ty);unsigned h=hash2(tx,ty);
        int v=art::terrainAnimated[t]?int((h+game.ticks/18)&3):int(h&3);
        if((t==Grass||t==Steppe)&&(h>>8)%5)v=h%2; // calmer base: decorated variants are rarer
        renderer.tile(art::terrainBase[t]+v,tx*Tile,ty*Tile);
        if(isWall(t))continue;
        int p=priority(t);
        // Bleed higher-priority neighbours over this tile, lowest first.
        for(int pr=p+1;pr<=8;++pr)for(int d=0;d<8;++d){
            int nt=terrainAt(tx+ndx[d],ty+ndy[d]);if(priority(nt)!=pr||isWall(nt))continue;
            if(d>=4){int a=terrainAt(tx+ndx[d],ty),b=terrainAt(tx,ty+ndy[d]);if(a==nt||b==nt)continue;}
            int idx=art::terrainWet[t]&&art::fringeWaterBase[nt]>=0?art::fringeWaterBase[nt]+d:art::fringeBase[nt]>=0?art::fringeBase[nt]+d:-1;
            if(idx>=0)renderer.tile(idx,tx*Tile,ty*Tile);
        }
    }
    // Cliff faces (2.5D): drawn where a wall tile meets open ground to the south.
    for(int ty=ty0-1;ty<=ty1;++ty)for(int tx=tx0;tx<=tx1;++tx){
        int t=terrainAt(tx,ty);if(!isWall(t))continue;
        int s=terrainAt(tx,ty+1),n=terrainAt(tx,ty-1),w=terrainAt(tx-1,ty),e=terrainAt(tx+1,ty);
        int sx=tx*Tile-int(game.camX),sy=ty*Tile-int(game.camY);
        bool dim=t!=Rock;
        if(!isWall(s)){
            renderer.tile(art::terrainFace[t]+int(hash2(tx,ty)%3)*art::terrainFaceStride[t],tx*Tile,ty*Tile);
            renderer.rect(sx,sy+Tile,Tile,3,rgba(0x0b1a1c,90));renderer.rect(sx,sy+Tile+3,Tile,2,rgba(0x0b1a1c,45));
        }
        if(!isWall(n))renderer.rect(sx,sy,Tile,1,rgba(dim?0x6f6a80:0xe8d6b0,dim?90:150));
        if(!isWall(w))renderer.rect(sx,sy,1,Tile,rgba(0x120f14,120));
        if(!isWall(e))renderer.rect(sx+Tile-1,sy,1,Tile,rgba(0x120f14,120));
    }
}
int objSprite(const Obj& o,int i){
    const Kind& k=kinds[o.kind];
    if(k.anim==0){int v=o.tag&&world.variant[o.tag]?world.variant[o.tag]:o.variant;return k.sprite+(v<k.frames?v:0);}
    if(k.anim==1){ // wind sway, ping-pong
        static const int pp[4]={0,1,2,1};
        float wind=sinf(game.ticks*.013f+o.x*.012f+o.y*.004f)+sinf(game.ticks*.031f+o.y*.02f)*.5f;
        int f=pp[(int((wind+1.5f)*1.4f))&3];return k.sprite+(f<k.frames?f:0);}
    if(k.anim==2)return k.sprite+((game.ticks/8+i)%k.frames);
    return k.sprite+((game.ticks/30+i)%k.frames);
}
struct Drawable { int y; short type,idx; };
Drawable drawList[1200];
void addDraw(int& n,int y,int type,int idx){ if(n<1200)drawList[n++]={y,(short)type,(short)idx}; }
void drawBar(int x,int y,int w,int value,int max,uint32_t color){
    int sx=x-int(game.camX)-w/2,sy=y-int(game.camY);
    renderer.rect(sx-1,sy-1,w+2,4,rgba(0x120f14,200));
    renderer.rect(sx,sy,w,2,rgba(0x3a1210,220));
    renderer.rect(sx,sy,w*value/(max?max:1),2,color);
}
void drawRing(int x,int y,int progress,int need,uint32_t color){
    int sx=x-int(game.camX),sy=y-int(game.camY);
    int n=need?progress*32/need:0;
    for(int i=0;i<32;++i){float a=i/32.f*6.283f-1.5708f;int px=sx+int(cosf(a)*7),py=sy+int(sinf(a)*7);
        renderer.pixel(px,py,i<n?color:rgba(0x120f14,150));renderer.pixel(px+1,py,i<n?color:rgba(0x120f14,90));}
}
const uint32_t peerColors[3]={0x86cdbd,0x86a6c8,0xf0b878};
void render(){
    renderer.camX=int(game.camX)+(game.shake?int(rng()%5)-2:0);renderer.camY=int(game.camY)+(game.shake?int(rng()%5)-2:0);
    if(!atlasReady){ // Without the atlas (tests / failed fetch) draw a readable flat map.
        for(int y=0;y<Height;++y)for(int x=0;x<Width;++x){int t=terrainAt((x+renderer.camX)/Tile,(y+renderer.camY)/Tile);
            static const unsigned col[TerrainCount]={0x55833f,0xa29a52,0x97764d,0xd0bb82,0x1d5a76,0x4aa0a8,0x7c6b60,0x465150,0x1f1029,0x9e8b7b};
            renderer.pixels[y*Width+x]=rgba(col[t]^((hash2(x+renderer.camX,y+renderer.camY)&7)*0x010101));}
        for(const auto& p:players)if(p.active)renderer.rect(int(p.x)-renderer.camX-4,int(p.y)-renderer.camY-18,8,18,rgba(0x2f7f7a));
        for(const auto& e:enemies)if(e.active&&e.enabled)renderer.rect(int(e.x)-renderer.camX-5,int(e.y)-renderer.camY-12,10,12,rgba(0x8a2c1f));
        for(const auto& n:npcs)if(n.active&&!n.hidden)renderer.rect(int(n.x)-renderer.camX-4,int(n.y)-renderer.camY-18,8,18,rgba(0xa47442));
        return;
    }
    int cx=renderer.camX,cy=renderer.camY;
    drawTerrain();
    // Decals and draw list.
    int n=0;
    for(int i=0;i<ObjCount;++i){const Obj& o=objs[i];
        if(o.x<cx-80||o.x>cx+Width+80||o.y<cy-8||o.y>cy+Height+90)continue;
        if(o.tag&&world.hiddenTag[o.tag])continue;
        if(kinds[o.kind].flags&1)renderer.sprite(objSprite(o,i),o.x,o.y);
        else addDraw(n,o.y,0,i);
    }
    for(int s=0;s<MaxPlayers;++s)if(players[s].active)addDraw(n,int(players[s].y),1,s);
    for(int i=0;i<NpcCount;++i)if(npcs[i].active&&!npcs[i].hidden)addDraw(n,int(npcs[i].y),2,i);
    for(int i=0;i<AnimalCount;++i)if(animals[i].active)addDraw(n,int(animals[i].y),3,i);
    for(int i=0;i<EnemyCount;++i)if(enemies[i].active&&enemies[i].enabled)addDraw(n,int(enemies[i].y),4,i);
    for(int i=0;i<MaxPickups;++i)if(pickups[i].active)addDraw(n,int(pickups[i].y),5,i);
    for(int i=0;i<MaxProjectiles;++i)if(projectiles[i].active)addDraw(n,int(projectiles[i].y)+8,6,i);
    if(game.shadowAlpha>0)addDraw(n,game.shadowY,7,0);
    for(int i=1;i<n;++i){Drawable d=drawList[i];int j=i-1;while(j>=0&&drawList[j].y>d.y){drawList[j+1]=drawList[j];--j;}drawList[j+1]=d;}
    const Player& L=me();
    for(int k=0;k<n;++k){const Drawable& d=drawList[k];
        switch(d.type){
        case 0:{const Obj& o=objs[d.idx];const Kind& kd=kinds[o.kind];int id=objSprite(o,d.idx);unsigned alpha=255;
            if(kd.flags&4){const auto& s=art::spr[id];if(L.y<o.y-2&&L.y>o.y-s.ay&&L.x>o.x-s.ax+4&&L.x<o.x-s.ax+s.w-4)alpha=150;}
            renderer.sprite(id,o.x,o.y,(o.variant&1)&&kd.anim==1,alpha);
            if(kd.flags&F_FLAME)renderer.sprite(art::O_FLAME_0+((game.ticks/6+d.idx)&3),o.x,o.y-2);
            break;}
        case 1:{const Player& p=players[d.idx];
            int f=d.idx==0?playerFrame(p):p.netFrame;
            unsigned alpha=(p.invuln&&(game.ticks/3)%2)?150:255;
            uint32_t tint=0;
            if(d.idx==0)for(const auto& fx:game.fx)if(fx.id&&effectDefs[fx.id].kind==KindDamage&&!(fx.ticks<180&&(fx.ticks/8)%2))tint=rgba(effectDefs[fx.id].color,unsigned(70+30*((game.ticks/10)%2)));
            drawActor(p.sheet,p.anim,f,p.facing,p.x,p.y,alpha,p.hurt>8?90:0,tint);
            // Ground glow under the hero for every active effect (colour of the effect), shield ring for defence.
            if(d.idx==0){int k=0;for(const auto& fx:game.fx)if(fx.id&&!(fx.ticks<180&&(fx.ticks/8)%2)){
                unsigned a=unsigned(120+60*((game.ticks/14+k)%2));float rx=9+k*2,ry=3+k*.6f;++k;
                for(int q=0;q<28;++q){float an=q/28.f*6.2832f;renderer.pixel(int(p.x+cosf(an)*rx)-cx,int(p.y+1+sinf(an)*ry)-cy,rgba(effectDefs[fx.id].color,a));}}}
            if(d.idx==0)for(const auto& fx:game.fx)if(fx.id&&effectDefs[fx.id].visual==1&&!(fx.ticks<180&&(fx.ticks/8)%2)){
                unsigned a=unsigned(110+50*((game.ticks/12)%2));
                for(int k=0;k<36;++k){float an=k/36.f*6.2832f;if(k%3==2)continue;
                    renderer.pixel(int(p.x+cosf(an)*11)-cx,int(p.y-11+sinf(an)*15)-cy,rgba(effectDefs[fx.id].color,a));}
            }
            break;}
        case 2:{const Npc& c=npcs[d.idx];drawActor(c.sheet,c.anim,loopFrame(c.anim,c.animTime),c.facing,c.x,c.y);break;}
        case 3:{const Animal& a=animals[d.idx];drawActor(a.sheet,a.anim,loopFrame(a.anim,a.animTime),a.facing,a.x,a.y);break;}
        case 4:{const Enemy& e=enemies[d.idx];
            int f;
            if(e.attack.active){const auto& s=enemySpecs[e.type];int age=e.attack.age;f=age<s.windup*2/3?0:age<s.windup?1:age<s.windup+6?2:3;}
            else f=loopFrame(e.anim,e.animTime);
            unsigned alpha=e.state==Death&&e.timer<60?unsigned(e.timer*4):255;
            uint32_t tint=e.type==Bear&&e.state==Telegraph&&(game.ticks/4)%2?rgba(0xe06a3f,90):0;
            int sheet=enemySheet[e.type];
            if(e.type==Shade&&e.state!=Death){   // the shade's touch: a violet aura round an ordinary villager
                int ax=int(e.x)-renderer.camX,ay=int(e.y)-renderer.camY-12;unsigned pul=46+unsigned(18*sinf(game.ticks*.12f+d.idx));
                renderer.ellipse(ax,ay,11,16,rgba(0x8e44c8,pul));renderer.ellipse(ax,ay+12,9,3,rgba(0x5b2a8a,pul+30));
                if(game.ticks%7==d.idx%7)particle(e.x+(frand()-.5f)*14,e.y-6-frand()*20,(frand()-.5f)*.3f,-.4f-frand()*.4f,26,0,rgba(0xb07ee0,180));}
            if(e.type==Witness&&e.phase==2)for(int k=0;k<3;++k)if(e.illusions&(1<<k))renderer.sprite(art::O_BANNER_0+k,int(e.px[k]),int(e.py[k]));
            if(e.type==Image&&e.phase==2&&e.state!=Death)for(int k=0;k<3;++k)if(e.illusions&(1<<k)){const Player& L0=me();   // copies look away; no shadow
                drawActor(sheet,e.anim,f,(heading(L0.x-e.px[k],L0.y-e.py[k])+4)&7,e.px[k],e.py[k],unsigned(190+30*((game.ticks/8+k)%2)),0,rgba(0x86cdbd,70),false);}
            if(e.type==Rider&&e.illusions)for(int k=1;k<3;++k)if(e.illusions&(1<<k)){const Player& L0=me();
                drawActor(sheet,e.anim,f,heading(L0.x-e.px[k],L0.y-e.py[k]),e.px[k],e.py[k],unsigned(150+40*((game.ticks/6+k)%2)),0,rgba(0xa35cc0,110),false);}
            drawActor(sheet,e.anim,f,e.facing,e.x,e.y,alpha,e.hitFlash>4?110:0,tint);
            if(e.type==Rider&&e.illusions&&(game.ticks/20)%3==0)renderer.pixel(int(e.x)-renderer.camX+3,int(e.y)-renderer.camY-34,rgba(0xfff6c8));
            break;}
        case 5:{const Pickup& k=pickups[d.idx];int bob=(k.bob/12)%2;
            static const int icon[ItemCount+1]={0,art::I_SWORD,art::I_SPEAR,art::I_BOW,art::I_ARROWS,art::I_KIT,art::I_TOOL,art::I_TORCH,art::I_PAGE,art::I_HERB,art::I_QUIVER,art::I_OCHRE,art::I_FLUTE,art::I_CRYSTAL,art::I_NECKLACE,
                art::I_TABLET,art::I_EMBER,art::I_MOULD,art::I_SEAL,art::I_BRACELET,
                art::I_HERBBIG,art::I_STRENGTH,art::I_GUARD,art::I_SWIFT,art::I_COAL,art::I_CURD};
            renderer.sprite(art::X_SHADOW_0,int(k.x),int(k.y));
            renderer.sprite(icon[k.item],int(k.x),int(k.y)-bob-1);
            if((k.bob/20)%3==0)renderer.pixel(int(k.x)+3-cx,int(k.y)-14-cy,rgba(0xfff2c4));
            break;}
        case 6:{const Projectile& p=projectiles[d.idx];if(p.fire)renderer.sprite(art::X_FIREBOLT_0+((game.ticks/5)&1),int(p.x),int(p.y));
            else if(p.bullet){int x=int(p.x)-renderer.camX,y=int(p.y)-renderer.camY;float l=sqrtf(p.dx*p.dx+p.dy*p.dy)+.01f;
                for(int k=0;k<10;++k)renderer.pixel(x-int(p.dx/l*k),y-int(p.dy/l*k),rgba(k<2?0xfffbe0:0xffd890,230-k*22));}   // a tracer streak, not an arrow
            else renderer.sprite(art::X_ARROW_0+p.facing,int(p.x),int(p.y));break;}
        case 7:{int f=(game.ticks/7)&3;renderer.sprite(art::Z_SHADOW_0+f,game.shadowX,game.shadowY,false,unsigned(game.shadowAlpha));break;}
        }
    }
    // Pulse-rifle beams and the muzzle flash.
    for(auto& b:beams)if(b.life>0){
        float dx=b.x1-b.x0,dy=b.y1-b.y0,l=sqrtf(dx*dx+dy*dy)+.01f;int n=int(l);unsigned al=unsigned(255*b.life/9);
        for(int k=0;k<=n;k+=1){int x=int(b.x0+dx*k/l)-cx,y=int(b.y0+dy*k/l)-cy;renderer.pixel(x,y,rgba(0xe8fdff,al));
            if((k+game.ticks)%3==0){renderer.pixel(x,y-1,rgba(0x7ff5e4,al*2/3));renderer.pixel(x,y+1,rgba(0x7ff5e4,al*2/3));}}
        --b.life;}
    if(game.flashT>0){int x=int(game.flashX)-cx,y=int(game.flashY)-cy,r=game.flashT>2?3:2;
        uint32_t core=game.flashKind==FireBeam?0xe8fdff:0xfffbe0,rim=game.flashKind==FireBeam?0x7ff5e4:0xffa030;
        for(int k=-r;k<=r;++k){renderer.pixel(x+k,y,rgba(k==0?core:rim,230));renderer.pixel(x,y+k,rgba(k==0?core:rim,230));}
        renderer.pixel(x+1,y+1,rgba(core,200));renderer.pixel(x-1,y-1,rgba(core,200));renderer.pixel(x+1,y-1,rgba(rim,180));renderer.pixel(x-1,y+1,rgba(rim,180));
        --game.flashT;}
    // Particles.
    for(const auto& q:particles)if(q.life>0){
        int x=int(q.x),y=int(q.y);
        if(q.type==0){unsigned a=q.color>>24;renderer.pixel(x-cx,y-cy,(q.color&0xffffff)|((a*q.life/q.max)<<24));}
        else if(q.type==1){int f=3-q.life*4/(q.max+1);renderer.sprite(art::X_SMOKE_0+(f<0?0:f),x,y,false,unsigned(110*q.life/q.max+20));}
        else if(q.type==2){int f=3-q.life*4/(q.max+1);renderer.sprite(art::X_DUST_0+(f<0?0:f),x,y,false,180);}
        else if(q.type==4){renderer.sprite(art::X_LEAF_0+((q.life/20)&1),x,y);}
        else if(q.type==5){int a=q.life>q.max-20?(q.max-q.life)*10:q.life<20?q.life*10:200;renderer.pixel(x-cx,y-cy,rgba(0xf6f0a0,a));renderer.pixel(x-cx+1,y-cy,rgba(0xf6f0a0,a/3));}
        else if(q.type==6){renderer.sprite(art::X_SMOKE_3,x,y,false,unsigned((q.life>q.max/2?q.max-q.life:q.life)*game.fogCur/220));}
    }
    // World-space UI: interaction marker, NPC bubbles, health bars, hold rings, peers.
    if(game.focusKind==0){const auto& ia=interacts[game.focusId];renderer.sprite(art::X_MARK_0+((game.ticks/10)&3),ia.x,ia.y-20);}
    else if(game.focusKind==1){const Npc& c=npcs[game.focusId];renderer.sprite(art::X_MARK_0+((game.ticks/10)&3),int(c.x),int(c.y)-30);}
    if(game.questKind>=0&&!game.cinematic&&!(game.questKind==game.focusKind&&game.questId==game.focusId)){
        int qx=0,qy=0;bool ok=false,bob=(game.ticks/16)&1;
        if(game.questKind==0&&game.questId<InteractCount&&world.iaEnabled[game.questId]){qx=interacts[game.questId].x;qy=interacts[game.questId].y-28;ok=true;}
        else if(game.questKind==1&&game.questId<NpcCount&&npcs[game.questId].active&&!npcs[game.questId].hidden){qx=int(npcs[game.questId].x);qy=int(npcs[game.questId].y)-40;ok=true;}
        if(ok){renderer.sprite(art::X_MARK_0,qx,qy-bob*2,false,200);for(int k=0;k<3;++k)renderer.pixel(qx-renderer.camX,qy+4+k-bob*2-renderer.camY,rgba(0xfff2c4,200));}
    }
    for(const auto& c:npcs)if(c.active&&!c.hidden){
        if(c.alert)renderer.sprite(art::X_BUBBLE_ALERT,int(c.x)+6,int(c.y)-28);
        else if(c.bubble&&(game.focusKind!=1||&npcs[game.focusId]!=&c))renderer.sprite(c.bubble==2?art::X_BUBBLE_QUEST:art::X_BUBBLE_TALK,int(c.x)+6,int(c.y)-28-((game.ticks/20)%2));
    }
    for(const auto& e:enemies)if(e.type==Keeper&&e.active&&e.enabled&&e.hp>0)drawKeeperTelegraphs(e);
    for(const auto& e:enemies)if(e.type==Rider&&e.active&&e.enabled&&e.hp>0)drawRiderTelegraphs(e);
    for(const auto& e:enemies)if(e.type==Witness&&e.active&&e.enabled&&e.hp>0)drawWitnessTelegraphs(e);
    for(const auto& e:enemies)if(e.type==Image&&e.active&&e.enabled&&e.hp>0)drawImageTelegraphs(e);
    for(const auto& e:enemies)if(e.type==Herald&&e.active&&e.enabled&&e.hp>0)drawHeraldTelegraphs(e);
    for(const auto& e:enemies)if(e.type==Zulmat&&e.active&&e.enabled&&e.hp>0)drawZulmatTelegraphs(e);
    for(const auto& e:enemies)if(!isBoss(e.type)&&e.active&&e.enabled&&e.hp>0&&(e.showBar||e.alerted)){
        int w=e.type==Bear?30:16;drawBar(int(e.x),int(e.y)-(e.type==Bear?44:e.type==Wolf?24:32),w,e.hp,enemySpecs[e.type].health,rgba(e.type==Bear?0xe06a3f:0xb8442b));
        if(e.state==Telegraph||(e.attack.active&&e.attack.age<enemySpecs[e.type].windup))renderer.sprite(art::X_BUBBLE_ALERT,int(e.x),int(e.y)-(e.type==Bear?46:34));
    }
    if(L.holdTicks>0)drawRing(int(L.x),int(L.y)-34,L.holdTicks,L.holdNeed,rgba(0xf3d68b));
    for(int s=1;s<MaxPlayers;++s){const auto& p=players[s];if(!p.active)continue;
        int px=int(p.x)-cx,py=int(p.y)-cy-34;
        uint32_t col=rgba(peerColors[s]);
        renderer.pixel(px,py+3,col);renderer.rect(px-1,py+1,3,1,col);renderer.rect(px-2,py,5,1,col);
        drawBar(int(p.x),int(p.y)-30,14,p.hp,p.maxhp,rgba(0x4ea59a));
        if(p.down){renderer.sprite(art::X_RING_0+((game.ticks/8)%3),int(p.x),int(p.y)-2);}
    }
    if(L.down)renderer.sprite(art::X_RING_0+((game.ticks/8)%3),int(L.x),int(L.y)-2);
    // Lighting.
    int ar=game.amb[0],ag=game.amb[1],ab=game.amb[2];
    bool dark=ar<190||ag<190||ab<190;
    bool overworld=area().outdoor;
    if(dark||overworld){
        renderer.lightBegin(ar,ag,ab);
        if(overworld&&ar>=180){
            // Drifting cloud shadows.
            int t=game.ticks;
            for(int y=0;y<Height;y+=2)for(int x=0;x<Width;x+=2){
                int wx=(x+cx)/7+t/9,wy=(y+cy)/7+t/23;
                int v=cloud[(wy&63)*64+(wx&63)];
                if(v>150){int dk=(v-150)/3;if(dk>32)dk=32;
                    for(int yy=0;yy<2;++yy)for(int xx=0;xx<2;++xx){uint8_t* l=renderer.light+((y+yy)*Width+x+xx)*3;l[0]-=dk;l[1]-=dk*9/10;l[2]-=dk*7/10;}}
            }
        }
        float boost=dark?1.f:.35f;
        for(int i=0;i<ObjCount;++i){const Obj& o=objs[i];
            if(o.x<cx-120||o.x>cx+Width+120||o.y<cy-120||o.y>cy+Height+120)continue;
            if(o.tag&&world.hiddenTag[o.tag])continue;
            int fl=int(hash2(game.ticks/5,i)%9);
            const Kind& kd=kinds[o.kind];
            if(!(kd.flags&F_LIGHT))continue;
            int rad=kd.lrad;
            if(kd.flags&F_FLICKER)rad=int((rad+fl)*(dark?1:.6f));
            renderer.lightAdd(o.x,o.y-kd.ly,rad,int(kd.lr*boost),int(kd.lg*boost),int(kd.lb*boost));
        }
        for(const auto& q:projectiles)if(q.active&&q.fire)renderer.lightAdd(int(q.x),int(q.y),34,int(220*boost),int(110*boost),int(40*boost));
        for(const auto& e:enemies)if(e.active&&e.enabled&&e.type==Keeper&&e.hp>0)renderer.lightAdd(int(e.x),int(e.y)-26,96,int(230*boost),int(120*boost),int(50*boost));
        for(const auto& e:enemies)if(e.active&&e.enabled&&e.type==Rider&&e.hp>0)renderer.lightAdd(int(e.x),int(e.y)-30,72,int(220*boost),int(180*boost),int(90*boost));
        if(dark){
            for(const auto& p:players)if(p.active){
                bool torch=game.torch&&area().dark;
                renderer.lightAdd(int(p.x),int(p.y)-10,torch?104+int(hash2(game.ticks/6,7)%7):30,torch?220:50,torch?150:120,torch?80:120);
            }
            if(game.shadowAlpha>0)renderer.lightAdd(game.shadowX,game.shadowY-20,40,70,20,110);
        }
        renderer.lightApply();
    }
    if(game.fogCur>0){uint32_t c=rgba(0x341a45,game.fogCur/3);renderer.rect(0,0,Width,Height,c);}
    for(const auto& e:enemies)if(isBoss(e.type)&&e.active&&e.enabled&&e.hp>0&&e.alerted)drawBossBar(e);
    // Vignette and hurt flash.
    for(int i=0;i<14;++i){
        uint32_t c=game.hurtFlash?rgba(0x8a2c1f,(14-i)*game.hurtFlash):rgba(0x0b1416,(14-i)*4);
        renderer.rect(i,i,Width-2*i,1,c);renderer.rect(i,Height-1-i,Width-2*i,1,c);
        renderer.rect(i,i+1,1,Height-2*i-2,c);renderer.rect(Width-1-i,i+1,1,Height-2*i-2,c);
    }
}
void reset(){
    game=Game{};
    for(auto& p:players)p=Player{};
    Player& p=me();p.active=true;p.x=p.tx=level::SpawnX;p.y=p.ty=level::SpawnY;p.facing=3;
    for(auto& q:projectiles)q.active=false;
    for(auto& q:particles)q.life=0;
    initWorld();initActors();
    eventCount=0;
    snapCamera();
}
}
#include "save.hpp"

// ====================================================================== ABI
extern "C" {
void tj_init(){ static bool once=false; if(!once){tj::initCloud();once=true;} tj::reset(); tj::render(); }
uintptr_t tj_atlas(){ return reinterpret_cast<uintptr_t>(tj::atlasPixels); }
int tj_atlas_size(int field){ return field==0?tj::art::AtlasW:tj::art::AtlasH; }
void tj_atlas_ready(int ready){ tj::atlasReady=ready; }
void tj_input(int mask){ tj::me().keys=tj::game.paused?0:(mask&511); }   // + R reload (128), F parry (256)
void tj_tick(){ tj::tick(); }
void tj_render(){ tj::render(); }
uintptr_t tj_pixels(){ return reinterpret_cast<uintptr_t>(tj::renderer.pixels); }
void tj_pause(int paused){ tj::game.paused=paused!=0;tj::me().keys=0;tj::me().moving=false; }
void tj_ack(){ tj::eventCount=0; }
int tj_event_count(){ return tj::eventCount; }
int tj_event(int i,int field){ if(i<0||i>=tj::eventCount)return -1; const auto& e=tj::events[i]; return field==0?e.type:field==1?e.a:e.b; }
void tj_events_clear(){ tj::eventCount=0; }
int tj_state(int field){
    const auto& g=tj::game;const auto& p=tj::me();
    switch(field){
        case 0:return int(p.x*1000);case 1:return int(p.y*1000);case 2:return g.zone;case 3:return p.facing;case 4:return p.animTime;
        case 5:return 0;case 6:return g.focusKind<0?0:g.focusKind*1000+g.focusId+1;case 7:return g.visited;case 8:return p.hp;case 9:return g.lives;
        case 10:return g.ticks;case 11:return tj::Width;case 12:return tj::Height;case 13:return p.weapon;case 14:return g.inv.counts[tj::IArrows-1];
        case 15:return p.attack.active;case 16:return p.attack.cooldown;case 17:return p.invuln;case 18:return p.dead;case 19:return g.gameover;
        case 20:return p.hurt;case 21:return g.lastPickup;case 22:return p.anim;case 23:return tj::playerFrame(p);case 24:return p.down;
        case 25:return g.focusKind;case 26:return g.focusId;case 27:return p.holdTicks;case 28:return p.holdNeed;case 29:return int(g.camX);
        case 30:return int(g.camY);case 31:return g.platesMask;case 32:return g.kills;case 33:return p.moving;case 34:return p.running;
        case 35:return tj::areaIndex();case 36:return g.triggerFired;case 37:return g.cinematic;case 38:return p.maxhp;case 39:return g.staticPicked;
        case 40:return g.useCooldown;case 41:return tj::effectSum(tj::KindDamage);case 42:return tj::effectSum(tj::KindDefense);case 43:return tj::effectSum(tj::KindSpeed);
        // weapon state (HUD, tests): 50 ranged kind, 51 rounds loaded, 52 magazine, 53 reload left, 54 reload time, 55 bolt left,
        // 56 heat %, 57 overheat left, 58 parry window, 59 counter window, 60 bow draw, 61 melee mode (blade), 62 pole mode
        case 50:return tj::fire.kind;case 51:return p.mag;case 52:return tj::fire.mag;case 53:return p.reloadT;case 54:return tj::fire.reload;
        case 55:return p.cycleT;case 56:return int(p.heat);case 57:return p.overheat;case 58:return p.parryT;case 59:return p.counterT;
        case 60:return p.attack.draw;case 61:return tj::melee[0].mode;case 62:return tj::melee[1].mode;
        default:return -1;
    }
}
int tj_tile(int x,int y){ int t=tj::terrainAt(x,y); return x<0||y<0||x>=tj::MapW||y>=tj::MapH?-1:t; }
int tj_solid(int x,int y){ return tj::blockedFeet(float(x),float(y))?1:0; }
int tj_equip(int weapon){
    auto& p=tj::me();
    if(weapon<0||weapon>2||p.hp<=0||p.attack.active||p.attack.cooldown)return 0;
    if(tj::game.inv.counts[weapon]<=0)return 0;
    if(weapon!=p.weapon){p.reloadT=0;p.burstLeft=0;p.autoN=0;p.aimT=0;p.parryT=0;p.counterT=0;p.fireCd=0;}   // nothing carries over to the new weapon
    p.weapon=weapon;return 1;
}
int tj_item_count(int item){ return item>=1&&item<=tj::ItemCount?tj::game.inv.counts[item-1]:-1; }
int tj_item_info(int item,int field){ if(item<1||item>tj::ItemCount)return -1;const auto& d=tj::items[item-1];return field==0?d.type:field==1?d.limit:-1; }
uintptr_t tj_item_text(int item,int field){
    if(item<1||item>tj::ItemCount||field<0||field>2)return 0;const auto& d=tj::items[item-1];
    return reinterpret_cast<uintptr_t>(field==0?d.id:field==1?d.name:d.description);
}
int tj_item_add(int item,int count){
    if(item<1||item>tj::ItemCount)return 0;int& c=tj::game.inv.counts[item-1];int lim=tj::items[item-1].limit;
    int before=c;c+=count;if(c>lim)c=lim;if(c<0)c=0;
    auto& p=tj::me();
    if(item==tj::IArrows&&p.loadOnGrant&&c>0){p.mag=c<tj::fire.mag?c:tj::fire.mag;p.loadOnGrant=0;}
    return c-before;
}
int tj_use(int item){
    auto& g=tj::game;auto& p=tj::me();
    if(item<1||item>tj::ItemCount||g.inv.counts[item-1]<=0||p.hp<=0||p.down||p.attack.active)return 0;
    if(item<=3)return tj_equip(item-1);
    for(const auto& c:tj::consumables)if(c.item==item){
        if(g.useCooldown)return -2;                         // too soon after the previous consumable
        if(c.heal&&!c.effect&&p.hp>=p.maxhp)return -3;      // healing at full health would waste the item
        int healed=0;
        if(c.heal){int before=p.hp;p.hp+=c.heal;if(p.hp>p.maxhp)p.hp=p.maxhp;healed=p.hp-before;
            for(int i=0;i<16;++i)tj::particle(p.x+(tj::frand()-.5f)*14,p.y-2-tj::frand()*18,(tj::frand()-.5f)*.5f,-.6f-tj::frand()*.6f,26,0,tj::rgba(0x8fe36b));}
        if(c.effect)tj::applyEffect(c.effect);
        --g.inv.counts[item-1];g.useCooldown=tj::UseCooldown;tj::emit(tj::EV_USED,item,healed);
        return 1;
    }
    return 0;
}
// Active effects for the HUD: field 0 id, 1 ticks left, 2 full duration, 3 kind, 4 magnitude.
int tj_effect(int slot,int field){
    if(slot<0||slot>=tj::MaxEffects)return -1;const auto& f=tj::game.fx[slot];if(!f.id)return field==0?0:-1;const auto& d=tj::effectDefs[f.id];
    switch(field){case 0:return f.id;case 1:return f.ticks;case 2:return d.duration;case 3:return d.kind;case 4:return d.magnitude;default:return -1;}
}
int tj_projectile(int index,int field){
    if(index<0||index>=tj::MaxProjectiles)return -1;const auto& p=tj::projectiles[index];
    switch(field){case 0:return p.active;case 1:return int(p.x*1000);case 2:return int(p.y*1000);case 3:return p.owner;case 4:return p.bullet;default:return -1;}
}
int tj_enemy(int index,int field){
    if(index<0||index>=tj::EnemyCount)return -1;const auto& e=tj::enemies[index];
    switch(field){case 0:return e.hp;case 1:return e.state;case 2:return int(e.x*1000);case 3:return int(e.y*1000);case 4:return e.type;
        case 5:return e.attack.cooldown;case 6:return e.active&&e.enabled;case 7:return e.facing;case 8:return e.anim;case 9:return e.animTime;
        case 10:return e.attack.active?e.attack.age:-1;case 11:return e.group;case 12:return e.alerted;case 13:return e.target;case 14:return e.phase;case 15:return e.special;case 16:return e.illusions;
        case 17:case 18:case 19:{int k=field-17;return int(e.px[k]*1000);}case 20:case 21:case 22:{int k=field-20;return int(e.py[k]*1000);}default:return -1;}
}
int tj_enemy_count(){ return tj::EnemyCount; }
// Network client: apply the host snapshot of one enemy.
void tj_enemy_set(int i,int x,int y,int hp,int state,int facing,int anim,int animTime,int attackAge){
    if(i<0||i>=tj::EnemyCount)return;auto& e=tj::enemies[i];
    e.nx=x;e.ny=y;if(!e.active&&hp>0){e.active=true;e.x=x;e.y=y;}
    if(hp<e.hp)e.showBar=200;
    e.hp=hp;e.facing=facing;if(e.anim!=anim||e.state!=state){e.anim=anim;e.animTime=animTime;}
    if(state==tj::Death&&e.state!=tj::Death)e.timer=150;
    e.state=state;e.attack.active=attackAge>=0;e.attack.age=attackAge<0?0:attackAge;
}
void tj_enemy_damage(int i,int damage,int fromSlot){
    if(i<0||i>=tj::EnemyCount||tj::game.netRole!=0)return;
    const auto& p=tj::players[fromSlot>=0&&fromSlot<3?fromSlot:0];
    tj::hurtEnemy(tj::enemies[i],damage,p.x,p.y);
}
void tj_groups(int mask){ tj::game.groups=mask; }
void tj_group_alive_reset(int group){ for(auto& e:tj::enemies)if(e.group==group){e.active=true;e.hp=tj::enemySpecs[e.type].health;e.state=tj::Idle;e.x=e.homeX;e.y=e.homeY;e.alerted=0;} }
// Players / co-op
void tj_hero(int sheet){ if(sheet>=0&&sheet<tj::art::SheetCount)tj::me().sheet=sheet; }
void tj_party(int size,int role){ tj::game.partySize=size<1?1:size>3?3:size; tj::game.netRole=role; }
void tj_peer(int slot,int x,int y,int facing,int anim,int frame,int hp,int flags,int sheet){
    if(slot<1||slot>=tj::MaxPlayers)return;auto& p=tj::players[slot];
    if(!p.active){p.active=true;p.x=x;p.y=y;}
    p.remote=true;p.tx=x;p.ty=y;p.facing=facing&7;p.anim=anim;p.netFrame=frame;p.hp=hp;p.down=flags&1?1:0;p.sheet=sheet;
    p.attack.active=(flags&2)!=0;p.running=(flags&4)!=0;
}
void tj_peer_off(int slot){ if(slot>=1&&slot<tj::MaxPlayers)tj::players[slot].active=false; }
void tj_peer_arrow(int slot,int x,int y,int facing){ (void)slot;tj::launch(-9,x,y,facing&7,0,true); }
void tj_damage(int amount){ tj::damageLocal(amount); }
void tj_revive(int hp){ auto& p=tj::me(); if(p.down||p.dead){p.down=0;p.dead=0;p.hp=hp>0?hp:40;p.invuln=120;tj::emit(tj::EV_REVIVED);tj::sfx(tj::SFX_REVIVE,p.x,p.y);} }
void tj_respawn(int loseLife){
    auto& p=tj::me();auto& g=tj::game;
    if(loseLife&&g.lives>0)--g.lives;
    if(!g.lives){g.gameover=1;return;}
    tj::clearEffects();
    p.dead=0;p.down=0;p.hp=p.maxhp;p.invuln=150;p.x=g.checkX;p.y=g.checkY;p.attack=tj::Attack{};
    p.reloadT=p.cycleT=p.fireCd=p.aimT=p.burstLeft=p.autoN=p.overheat=p.parryT=p.parryCd=p.counterT=0;p.heat=0;
    { int ammo=g.inv.counts[tj::IArrows-1]; p.mag=ammo<tj::fire.mag?ammo:tj::fire.mag; }   // back at the checkpoint with a loaded weapon
    g.zone=tj::zoneAt(p.x,p.y);
    for(auto& e:tj::enemies)if(e.hp>0){e.x=e.homeX;e.y=e.homeY;e.alerted=0;e.state=tj::Idle;e.attack.active=false;}
    for(auto& q:tj::projectiles)q.active=false;
    tj::snapCamera();
}
void tj_checkpoint(int x,int y){ tj::game.checkX=x;tj::game.checkY=y; }
void tj_heal(int amount){ auto& p=tj::me(); if(p.hp>0&&!p.down){p.hp+=amount;if(p.hp>p.maxhp)p.hp=p.maxhp;} }
void tj_teleport(int x,int y){ auto& p=tj::me();p.x=x;p.y=y;p.tx=x;p.ty=y;tj::game.zone=tj::zoneAt(p.x,p.y);tj::game.visited|=1<<tj::game.zone;tj::snapCamera(); }
// Story / cutscene controls
void tj_control(int on){ tj::game.control=on; if(!on){tj::me().keys=0;tj::me().moving=false;} }
void tj_cinematic(int on){ tj::game.cinematic=on; if(on){tj::me().keys=0;tj::me().moving=false;tj::me().attack.active=false;} }
void tj_camera(int mode,int x,int y,int speed100){ tj::game.camMode=mode;tj::game.camTX=x;tj::game.camTY=y;tj::game.camSpeed=speed100/100.f; }
void tj_shake(int ticks){ tj::game.shake=ticks; }
void tj_light(int r,int g,int b){ tj::game.ambT[0]=r;tj::game.ambT[1]=g;tj::game.ambT[2]=b; }
void tj_light_now(int r,int g,int b){ tj_light(r,g,b);tj::game.amb[0]=r;tj::game.amb[1]=g;tj::game.amb[2]=b; }
void tj_fog(int amount){ tj::game.fog=amount; }
void tj_torch(int on){ tj::game.torch=on; }
void tj_shadow(int x,int y,int alpha){ tj::game.shadowX=x;tj::game.shadowY=y;tj::game.shadowAlpha=alpha; }
// MAP06 weapon progression: a level re-tunes a slot (and the lance charge) from its own flags after every load.
void tj_weapon_tune(int w,int damage,int windup,int recovery,int range,int width){ if(w<0||w>2)return; auto& s=tj::weapons[w];
    if(damage<=0){s=tj::baseWeapons[w];return;} s.damage=damage;s.windup=windup;s.recovery=recovery;s.range=float(range);s.width=float(width); }
void tj_lance(int on){ tj::melee[1].mode=on?1:0; }
// MAP07–MAP10 mechanics: sabre combo, firearms (bullet shots), burst fire (rounds per trigger), the finale's health floor.
void tj_sabre(int on){ tj::melee[0].mode=on?1:0; }
// Weapon profiles (src/rpg/weapons.js). Ranged: kind (FireKind), magazine, reload / vent ticks, bolt ticks or heat per
// shot, ticks between automatic rounds, enemies pierced, speed ×100, spread (radians ×1000), recoil ×100.
void tj_fire(int kind,int mag,int reload,int cycle,int gap,int pierce,int speed,int spread,int recoil,int empty){
    using namespace tj;auto& f=fire;auto& p=me();int old=f.kind;
    f.kind=kind<0?0:kind>4?4:kind;f.mag=mag<0?0:mag;f.reload=reload;f.cycle=cycle;f.gap=gap<1?1:gap;f.pierce=pierce;
    f.speed=speed>0?speed/100.f:4.2f;f.spread=spread/1000.f;f.recoil=recoil/100.f;
    int ammo=tj::game.inv.counts[tj::IArrows-1];
    // A weapon the story hands over comes loaded; one taken up by swapping (empty=1) has to be loaded first.
    if(old!=f.kind||p.mag>f.mag){p.mag=empty?0:ammo<f.mag?ammo:f.mag;p.reloadT=0;p.burstLeft=0;p.cycleT=0;p.overheat=0;p.heat=0;p.loadOnGrant=!empty&&!ammo&&f.mag>0;}
}
void tj_melee(int slot,int mode,int knock){ if(slot<0||slot>1)return; tj::melee[slot].mode=mode;tj::melee[slot].knock=float(knock); }
void tj_bullets(int on){ tj::game.bullets=on<0?0:on>2?2:on; }   // 1 lead, 2 energy
void tj_burst(int n){ tj::game.burst=n<1?0:n>5?5:n; }
void tj_boss_floor(int pct){ tj::game.bossFloor=pct<0?0:pct>90?90:pct; }
void tj_quest(int kind,int id){ tj::game.questKind=kind;tj::game.questId=id; }
void tj_pose(int anim,int ticks){ auto& p=tj::me();p.pose=anim;p.poseTime=ticks;p.animTime=0;p.anim=anim; }
void tj_face(int facing){ tj::me().facing=facing&7; }
void tj_walk_to(int x,int y){ auto& p=tj::me();float dx=x-p.x,dy=y-p.y,len=sqrtf(dx*dx+dy*dy);
    if(len<1.2f){p.moving=false;return;} p.facing=tj::heading(dx,dy);p.x+=dx/len*1.0f;p.y+=dy/len*1.0f;p.moving=true;tj::setAnim(p.anim,p.animTime,tj::art::A_WALK); }
void tj_tag(int tag,int hidden){ if(tag>0&&tag<tj::TagCount)tj::world.hiddenTag[tag]=hidden?1:0; }
void tj_ia(int i,int enabled,int holdTicks){ if(i>=0&&i<tj::InteractCount){tj::world.iaEnabled[i]=enabled?1:0;tj::world.iaHold[i]=holdTicks;} }
void tj_trigger_arm(int i,int armed){ if(i>=0&&i<tj::TriggerCount){ if(armed){tj::game.triggerArmed|=1u<<i;tj::game.triggerFired&=~(1u<<i);} else tj::game.triggerArmed&=~(1u<<i);} }
int tj_npc(int i,int field){ if(i<0||i>=tj::NpcCount)return -1;const auto& n=tj::npcs[i];
    switch(field){case 0:return int(n.x);case 1:return int(n.y);case 2:return n.active&&!n.hidden;case 3:return n.mode;case 4:return n.anim;default:return -1;} }
void tj_npc_set(int i,int x,int y,int facing,int anim,int active){ if(i<0||i>=tj::NpcCount)return;auto& n=tj::npcs[i];
    n.x=x;n.y=y;n.facing=facing&7;n.active=active!=0;n.hidden=false;n.mode=2;n.holdAnim=anim;tj::setAnim(n.anim,n.animTime,anim); }
void tj_npc_goto(int i,int x,int y,int run,int anim){ if(i<0||i>=tj::NpcCount)return;auto& n=tj::npcs[i];n.mode=1;n.gx=x;n.gy=y;n.run=run!=0;n.holdAnim=anim;n.active=true; }
void tj_npc_routine(int i){ if(i>=0&&i<tj::NpcCount)tj::npcs[i].mode=0; }
void tj_npc_flags(int i,int talk,int bubble,int hidden){ if(i<0||i>=tj::NpcCount)return;auto& n=tj::npcs[i];n.talk=talk!=0;n.bubble=bubble;n.hidden=hidden!=0; }
void tj_npc_face(int i,int facing){ if(i>=0&&i<tj::NpcCount)tj::npcs[i].facing=facing&7; }
void tj_spawn_fx(int type,int x,int y,int count){ for(int k=0;k<count;++k)tj::particle(x+(tj::frand()-.5f)*10,y+(tj::frand()-.5f)*6,(tj::frand()-.5f)*1.6f,-tj::frand()*1.4f,type==1?80:30,type,type==0?tj::rgba(0xf3d68b):type==7?tj::rgba(0xd29ae6):0); }
void tj_spawn_item(int item,int qty,int x,int y){ tj::spawnPickup(item,qty,x,y); }
// Persistence
uintptr_t tj_save_buffer(){ return reinterpret_cast<uintptr_t>(tj::saveWords); }
int tj_save(){ return tj::serialize(); }
int tj_load(int length){ return tj::restore(length); }
}
