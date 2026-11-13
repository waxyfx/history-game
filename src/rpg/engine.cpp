// Tarikh Joly - MAP01 "Алғашқы іздер" top-down engine (C++17 -> standalone WASM).
// C++ owns simulation (movement, collisions, combat, AI, interaction, events) and
// renders the RGBA framebuffer from the sprite atlas. JS owns story, UI, audio and network.
#include "world.hpp"
#include "combat.hpp"
#include "inventory.hpp"
#include "effects.hpp"
namespace tj {
Renderer renderer;
enum Keys { Up=1, Down=2, Left=4, Right=8, Interact=16, Strike=32, Run=64 };
constexpr int MaxPlayers=3;

// ------------------------------------------------------------------ events (polled by JS)
enum EventType { EV_NONE, EV_SFX, EV_INTERACT, EV_TRIGGER, EV_ENEMY_DIED, EV_PICKUP, EV_HURT, EV_DOWN, EV_DEAD,
                 EV_REVIVED, EV_ZONE, EV_ENEMY_HIT, EV_PEER_HIT, EV_REVIVE_PEER, EV_PLATES, EV_ALERT, EV_HOLD_START, EV_NOAMMO,
                 EV_EFFECT /* a=effect id, b=1 start, 2 refreshed, 0 ended */, EV_USED /* a=item, b=healed hp */ };
enum Sfx { SFX_STEP_GRASS, SFX_STEP_DIRT, SFX_STEP_WATER, SFX_STEP_CAVE, SFX_SWORD, SFX_SPEAR, SFX_BOW, SFX_ARROW_HIT,
           SFX_ENEMY_HURT, SFX_ENEMY_DIE, SFX_HOWL, SFX_GROWL, SFX_ROAR, SFX_SWIPE, SFX_SHOUT, SFX_PICKUP, SFX_SPLASH,
           SFX_HOOVES, SFX_BLOCK, SFX_DOWN, SFX_REVIVE, SFX_IMPACT, SFX_BOWSTRING };
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
};
struct Npc {
    bool active=true,hidden=false,talk=true;
    int sheet=0; float x=0,y=0; int facing=4,anim=art::A_IDLE,animTime=0;
    int way=0,wait=0,mode=0; // 0 routine, 1 scripted goto, 2 hold position
    float gx=0,gy=0; bool run=false; int holdAnim=art::A_IDLE,bubble=0,alert=0,greeted=0;
};
struct Animal { bool active=true; int sheet; float x,y,hx,hy,vx=0,vy=0; int facing=2,anim=art::A_IDLE,animTime=0,timer=0,flee=0; };
struct Enemy {
    bool active=true,enabled=true;
    int type=0,group=0,hp=0,state=Idle,facing=4,timer=0,anim=art::A_IDLE,animTime=0,target=-1,alerted=0,seed=0,hitFlash=0,showBar=0,phase=1,special=0,illusions=0;
    float px[3]{},py[3]{};
    float x=0,y=0,homeX=0,homeY=0,dx=0,dy=0,nx=0,ny=0;
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
    unsigned triggerFired=0,triggerArmed=0xffffffffu,staticPicked=0;
    int platesMask=0,groups=0x3,kills=0,lastPickup=0,alarm=0;
    int shadowX=0,shadowY=0,shadowAlpha=0;
    unsigned completedTasks=0,storyEvents=0;
    int prevKeys=0,interactCooldown=0,hurtFlash=0;
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
        p.active=true;p.cosmetic=cosmetic;p.fire=fire;p.owner=owner;p.damage=damage;p.facing=facing;p.x=x+d.x*6;p.y=y+d.y*6;p.dx=d.x*sp;p.dy=d.y*sp;p.remaining=220;return true;}
    return false;
}
bool startAttack(Attack& a,int weapon,int facing,float x,float y){
    if(a.cooldown||a.active)return false;
    a.age=0;a.weapon=weapon;a.facing=facing;a.cooldown=weapons[weapon].windup+weapons[weapon].recovery;a.active=true;a.connected=false;a.x=x;a.y=y;return true;
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
    e.hp=e.hp>damage?e.hp-damage:0;e.hitFlash=8;e.showBar=240;
    alertGroup(e.group);e.alerted=1;
    float dx=e.x-fromX,dy=e.y-fromY,len=sqrtf(dx*dx+dy*dy)+.01f;
    float kb=e.type==Bear?2:7;
    if(!blockedFeet(e.x+dx/len*kb,e.y,5,3))e.x+=dx/len*kb;
    if(!blockedFeet(e.x,e.y+dy/len*kb,5,3))e.y+=dy/len*kb;
    for(int i=0;i<5;++i)particle(e.x,e.y-8,(frand()-.5f)*2,-frand()*1.5f,18,0,rgba(0xf3d68b));
    if(e.hp==0){e.state=Death;e.timer=e.type==Keeper||e.type==Rider?200:150;e.illusions=0;e.attack.active=false;e.animTime=0;++game.kills;dropLoot(e);
        sfx(SFX_ENEMY_DIE,e.x,e.y);emit(EV_ENEMY_DIED,int(&e-enemies),e.type);}
    else { if(e.type!=Keeper&&e.type!=Rider&&(e.type!=Bear||e.state!=Charge)){e.state=Hurt;e.timer=12;e.attack.active=false;} sfx(SFX_ENEMY_HURT,e.x,e.y); }
}
// Player-side hit on an enemy: the host applies it, a network client only predicts the flash.
void playerHitsEnemy(int index,int damage,float fx,float fy){
    Enemy& e=enemies[index];
    if(game.netRole==1){e.hitFlash=8;e.showBar=240;emit(EV_ENEMY_HIT,index,damage);sfx(SFX_ENEMY_HURT,e.x,e.y);return;}
    hurtEnemy(e,damage,fx,fy);
}
void damageLocal(int damage){
    Player& p=me();
    if(damage<=0||p.hp<=0||p.invuln||p.down||p.dead||game.cinematic)return;
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
        if(e.enabled&&e.hp>0&&inArc(a.weapon,a.facing,a.x,a.y-4,e.x,e.y-4)&&lineClear(a.x,a.y,e.x,e.y))playerHitsEnemy(i,outgoingDamage(weapons[a.weapon].damage),a.x,a.y);}
    for(auto& e:enemies)if(e.type==Rider&&e.illusions&&e.hp>0)for(int k=1;k<3;++k)if((e.illusions&(1<<k))&&inArc(a.weapon,a.facing,a.x,a.y-4,e.px[k],e.py[k]-4)){
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

void playerStrike(){
    Player& p=me();
    if(game.paused||game.cinematic||!game.control||p.hp<=0||p.down||p.dead||p.hurt)return;
    if(p.weapon==Bow&&game.inv.counts[IArrows-1]==0){ if(!p.attack.cooldown){emit(EV_NOAMMO);p.attack.cooldown=30;} return; }
    if(startAttack(p.attack,p.weapon,p.facing,p.x,p.y)){
        sfx(p.weapon==Sword?SFX_SWORD:p.weapon==Spear?SFX_SPEAR:SFX_BOWSTRING,p.x,p.y);
        for(auto& a:animals){float dx=a.x-p.x,dy=a.y-p.y;if(dx*dx+dy*dy<110*110)a.flee=90;}
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
        if(d<26*26&&d*.8f<best){best=d*.8f;game.focusKind=1;game.focusId=i;}
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
    if(p.dead){ if(--p.dead==0)emit(EV_DEAD); setAnim(p.anim,p.animTime,art::A_DEATH); return; }
    if(p.down){ if(--p.down==0){emit(EV_DEAD);} setAnim(p.anim,p.animTime,art::A_DEATH); return; }
    if(a.active){
        ++a.age;
        const auto& w=weapons[a.weapon];
        if(a.age==w.windup){
            if(a.weapon==Bow){ if(game.inv.counts[IArrows-1]>0&&launch(-1,p.x,p.y-8,a.facing,outgoingDamage(w.damage))){--game.inv.counts[IArrows-1];sfx(SFX_BOW,p.x,p.y);} }
            else if(!a.connected){strikeEnemies(a);a.connected=true;}
        }
        if(a.age>=w.windup+12)a.active=false;
    }
    if(game.paused||!game.control||game.cinematic){p.moving=false;}
    else {
        if((p.keys&Strike))playerStrike();
        int dx=((p.keys&Right)!=0)-((p.keys&Left)!=0);
        int dy=((p.keys&Down)!=0)-((p.keys&Up)!=0);
        p.moving=false;
        if(!a.active&&!p.hurt&&(dx||dy)&&p.holdTicks==0){
            p.facing=dy<0?(dx<0?7:dx>0?1:0):dy>0?(dx<0?5:dx>0?3:4):(dx<0?6:2);
            p.running=(p.keys&Run)!=0;
            float speed=(p.running?1.8f:1.15f)*speedFactor();
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
                for(auto& an:animals){float ax=an.x-p.x,ay=an.y-p.y;if(ax*ax+ay*ay<(p.running?90*90:62*62))an.flee=80;}
            }
        }
    }
    // Animation selection.
    int next=art::A_IDLE;
    if(a.active)next=a.weapon==Sword?art::A_SWORD:a.weapon==Spear?art::A_SPEAR:art::A_BOW;
    else if(p.hurt)next=art::A_HURT;
    else if(p.holdTicks>0)next=game.focusKind==2?art::A_REVIVE:art::A_INTERACT;
    else if(p.pose>=0)next=p.pose;
    else if(p.moving)next=p.running?art::A_RUN:art::A_WALK;
    setAnim(p.anim,p.animTime,next);
    ++p.animTime;
}
int playerFrame(const Player& p){
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
void tickAnimals(){
    for(auto& a:animals){if(!a.active)continue;
        ++a.animTime;
        bool hare=a.sheet==art::SH_HARE;
        // Flee from the nearest player.
        float px=0,py=0,best=1e9;
        for(auto& p:players)if(p.active){float dx=a.x-p.x,dy=a.y-p.y,d=dx*dx+dy*dy;if(d<best){best=d;px=p.x;py=p.y;}}
        if(best<(hare?70*70:60*60))a.flee=a.flee>40?a.flee:70;
        if(a.flee>0){
            --a.flee;
            float dx=a.x-px,dy=a.y-py,len=sqrtf(dx*dx+dy*dy)+.01f;
            float sp=hare?2.4f:2.0f;
            float nx=a.x+dx/len*sp,ny=a.y+dy/len*sp;
            float hx=nx-a.hx,hy=ny-a.hy;
            if(hx*hx+hy*hy>220*220){nx=a.x+(a.hx-a.x)*.01f;ny=a.y+(a.hy-a.y)*.01f;}
            if(!blockedFeet(nx,a.y,4,2))a.x=nx; if(!blockedFeet(a.x,ny,4,2))a.y=ny;
            a.facing=heading(dx,dy);setAnim(a.anim,a.animTime,art::A_RUN);
            if(!hare&&a.flee%30==0)sfx(SFX_HOOVES,a.x,a.y);
            continue;
        }
        if(--a.timer<=0){
            a.timer=120+int(rng()%240);
            if(rng()%3==0){a.vx=0;a.vy=0;}
            else{float ang=frand()*6.283f;a.vx=cosf(ang)*.35f;a.vy=sinf(ang)*.25f;
                if((a.x-a.hx)*(a.x-a.hx)+(a.y-a.hy)*(a.y-a.hy)>60*60){a.vx=(a.hx-a.x)*.006f;a.vy=(a.hy-a.y)*.006f;}}
        }
        if(a.vx!=0||a.vy!=0){
            if(!blockedFeet(a.x+a.vx,a.y,4,2))a.x+=a.vx; if(!blockedFeet(a.x,a.y+a.vy,4,2))a.y+=a.vy;
            a.facing=heading(a.vx,a.vy);setAnim(a.anim,a.animTime,art::A_WALK);
        } else setAnim(a.anim,a.animTime,(!hare&&a.timer%240<150)?art::A_GRAZE:art::A_IDLE);
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
        if(--e.timer<=0){keeperHitArea(e.x,e.y,54,spec.damage+2);game.shake=16;sfx(SFX_IMPACT,e.x,e.y);
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
        if(e.timer%9==0)for(int s=0;s<MaxPlayers;++s){auto& q=players[s];if(q.active&&q.hp>0&&!q.down&&inCone(e,q.x,q.y,96,.82f))hitPlayer(s,7);}
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
        if(dist<52){e.special=1;e.timer=tele;sfx(SFX_GROWL,e.x,e.y);return;}
        if(dist<140){e.special=2;e.timer=tele-6;sfx(SFX_ROAR,e.x,e.y);return;}
    }
    if(dist>30){walkEnemy(e,p.x,p.y,speed);setAnim(e.anim,e.animTime,art::A_WALK);}
    else setAnim(e.anim,e.animTime,art::A_IDLE);
}
// ------------------------------------------------------------------ boss: the golden-armoured rider (MAP03)
// Phase 1 (mounted): a telegraphed charge along a line (a wall leaves him dazed: double damage) and arrow volleys.
// Phase 2 (on foot): the golden armour deflects frontal hits; strike from the side/back or right after his akinak cut.
// Phase 3 (mirror): two illusions mirror him around the hero; only the real one casts a shadow and a gold glint,
// only his bolts hurt; a blow shatters an illusion. Phase 2 also wakes the group after his (corrupted warriors).
bool isBoss(int type){ return type==Keeper||type==Rider; }
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
    if(hx*hx+hy*hy>260*260&&e.type!=Bear){e.alerted=0;e.state=Patrol;return;}
    if(e.state==Roar){ e.facing=heading(dx,dy); setAnim(e.anim,e.animTime,art::A_ROAR); if(--e.timer<=0){e.state=Chase;e.timer=90;} return; }
    if(e.type==Bear){
        if(e.state==Telegraph){ setAnim(e.anim,e.animTime,art::A_ROAR); if(--e.timer<=0){e.state=Charge;e.timer=55;float len=sqrtf(dx*dx+dy*dy)+.01f;e.dx=dx/len;e.dy=dy/len;e.facing=heading(dx,dy);sfx(SFX_ROAR,e.x,e.y);} return; }
        if(e.state==Charge){
            setAnim(e.anim,e.animTime,art::A_CHARGE);
            float nx=e.x+e.dx*2.9f,ny=e.y+e.dy*2.9f;
            if(blockedFeet(nx,ny,8,3)){e.state=Stunned;e.timer=110;game.shake=14;sfx(SFX_IMPACT,e.x,e.y);
                for(int i=0;i<10;++i)particle(e.x+e.dx*12,e.y,(frand()-.5f)*2,-frand()*1.5f,24,2);return;}
            for(int s=0;s<MaxPlayers;++s){auto& q=players[s];if(q.active&&q.hp>0&&!q.down&&fabsf(q.x-nx)<14&&fabsf(q.y-ny)<10){hitPlayer(s,30);e.state=Chase;e.timer=80;a.cooldown=60;return;}}
            e.x=nx;e.y=ny;if(e.animTime%8==0)particle(e.x,e.y,0,-.3f,18,2);
            if(--e.timer<=0){e.state=Chase;e.timer=100;}
            return;
        }
        if(dist>46&&dist<150&&e.timer<=0&&!a.cooldown){e.state=Telegraph;e.timer=34;e.facing=heading(dx,dy);return;}
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
        for(int step=0;step<4&&p.active;++step){
            p.x+=p.dx/4;p.y+=p.dy/4;p.remaining-=1.05f;
            if(p.remaining<=0){p.active=false;break;}
            if(solidAt(p.x,p.y+6)){p.active=false;sfx(SFX_ARROW_HIT,p.x,p.y);for(int i=0;i<3;++i)particle(p.x,p.y,(frand()-.5f),-frand(),12,0,rgba(0xcfc8b0));break;}
            if(p.cosmetic)continue;
            if(p.owner<0){
                for(int i=0;i<EnemyCount;++i){auto& e=enemies[i];
                    float hh=e.type==Bear?16:9;
                    if(e.enabled&&e.hp>0&&fabsf(e.x-p.x)<(e.type==Bear?13:8)&&p.y>e.y-hh-12&&p.y<e.y+2){playerHitsEnemy(i,p.damage,p.x-p.dx*3,p.y-p.dy*3);p.active=false;sfx(SFX_ARROW_HIT,p.x,p.y);break;}}
            } else if(game.netRole==0){
                for(int s=0;s<MaxPlayers;++s){auto& q=players[s];
                    if(q.active&&q.hp>0&&!q.down&&fabsf(q.x-p.x)<6&&p.y>q.y-22&&p.y<q.y+2){hitPlayer(s,p.damage);p.active=false;break;}}
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
        case 6:{const Projectile& p=projectiles[d.idx];if(p.fire)renderer.sprite(art::X_FIREBOLT_0+((game.ticks/5)&1),int(p.x),int(p.y));else renderer.sprite(art::X_ARROW_0+p.facing,int(p.x),int(p.y));break;}
        case 7:{int f=(game.ticks/7)&3;renderer.sprite(art::Z_SHADOW_0+f,game.shadowX,game.shadowY,false,unsigned(game.shadowAlpha));break;}
        }
    }
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
    for(const auto& c:npcs)if(c.active&&!c.hidden){
        if(c.alert)renderer.sprite(art::X_BUBBLE_ALERT,int(c.x)+6,int(c.y)-28);
        else if(c.bubble&&(game.focusKind!=1||&npcs[game.focusId]!=&c))renderer.sprite(c.bubble==2?art::X_BUBBLE_QUEST:art::X_BUBBLE_TALK,int(c.x)+6,int(c.y)-28-((game.ticks/20)%2));
    }
    for(const auto& e:enemies)if(e.type==Keeper&&e.active&&e.enabled&&e.hp>0)drawKeeperTelegraphs(e);
    for(const auto& e:enemies)if(e.type==Rider&&e.active&&e.enabled&&e.hp>0)drawRiderTelegraphs(e);
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
void tj_input(int mask){ tj::me().keys=tj::game.paused?0:(mask&127); }
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
        default:return -1;
    }
}
int tj_tile(int x,int y){ int t=tj::terrainAt(x,y); return x<0||y<0||x>=tj::MapW||y>=tj::MapH?-1:t; }
int tj_solid(int x,int y){ return tj::blockedFeet(float(x),float(y))?1:0; }
int tj_equip(int weapon){
    auto& p=tj::me();
    if(weapon<0||weapon>2||p.hp<=0||p.attack.active||p.attack.cooldown)return 0;
    if(tj::game.inv.counts[weapon]<=0)return 0;
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
    int before=c;c+=count;if(c>lim)c=lim;if(c<0)c=0;return c-before;
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
    switch(field){case 0:return p.active;case 1:return int(p.x*1000);case 2:return int(p.y*1000);case 3:return p.owner;default:return -1;}
}
int tj_enemy(int index,int field){
    if(index<0||index>=tj::EnemyCount)return -1;const auto& e=tj::enemies[index];
    switch(field){case 0:return e.hp;case 1:return e.state;case 2:return int(e.x*1000);case 3:return int(e.y*1000);case 4:return e.type;
        case 5:return e.attack.cooldown;case 6:return e.active&&e.enabled;case 7:return e.facing;case 8:return e.anim;case 9:return e.animTime;
        case 10:return e.attack.active?e.attack.age:-1;case 11:return e.group;case 12:return e.alerted;case 13:return e.target;case 14:return e.phase;case 15:return e.special;case 16:return e.illusions;default:return -1;}
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
