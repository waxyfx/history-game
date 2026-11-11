#include "world.hpp"
#include "combat.hpp"
#include "inventory.hpp"
namespace tj {
Renderer renderer;
Zone zones[ZoneCount];
struct Game {
    float x=104,y=168;
    int zone=0,keys=0,ticks=0,walk=0,facing=4;
    int transition=0,target=0,event=0,paused=0,visited=1;
    bool moving=false;
    int weapon=Sword,lastPickup=0;
    Inventory inventory;
    int health=100,lives=3,invulnerable=0,hurt=0,dying=0,gameover=0;
    unsigned completedTasks=0,storyEvents=0;
    Attack attack;
} game;
Projectile projectiles[MaxProjectiles];
Enemy enemies[EnemyCount];
int incomingDamage=0;
enum Keys { Up=1, Down=2, Left=4, Right=8, Interact=16, Strike=32 };
static unsigned noise(unsigned x,unsigned y) {
    unsigned n=x*374761393u+y*668265263u+17;
    n=(n^(n>>13))*1274126177u;return n^(n>>16);
}
bool solid(int zone,float px,float py) {
    if(px<0||py<0||px>=Width||py>=Height)return true;
    int tx=int(px)/Tile,ty=int(py)/Tile;
    int tile=zones[zone].terrain[ty][tx];
    return tile==Water||tile==Cliff||solidObject(zones[zone].objects[ty][tx]);
}
bool lineClear(int zone,float x,float y,float tx,float ty) {
    float dx=tx-x,dy=ty-y;int steps=int(fmaxf(fabsf(dx),fabsf(dy)))+1;
    for(int i=1;i<=steps;++i)if(solid(zone,x+dx*i/steps,y+dy*i/steps))return false;
    return true;
}
bool blocked(float px,float py) {
    for(const auto& e:enemies)if(e.health>0&&e.zone==game.zone&&fabsf(e.x-px)<9&&fabsf(e.y-py)<7)return true;
    for(int dy=-3;dy<=3;dy+=6)for(int dx=-4;dx<=4;dx+=8) {
        int x=int(px+dx),y=int(py+dy);
        if(x<0||y<0||x>=Width||y>=Height)return true;
        int tx=x/Tile,ty=y/Tile;
        int tile=zones[game.zone].terrain[ty][tx];
        if(tile==Water||tile==Cliff||solidObject(zones[game.zone].objects[ty][tx]))return true;
    }
    return false;
}
void clearCombat() {game.attack=Attack{};for(auto& p:projectiles)p.active=false;
    for(auto& e:enemies){e.attack=Attack{};if(e.health>0){e.state=Idle;e.timer=45;}}}
void initEnemies() {
    for(int i=0;i<EnemyCount;++i) {
        enemies[i]=Enemy{};auto& e=enemies[i];e.type=i;e.health=enemySpecs[i].health;
        e.x=e.homeX=232+i*80;e.y=e.homeY=264;
    }
}
void hurtEnemy(Enemy& e,int damage) {
    if(e.health<=0)return;
    e.health=e.health>damage?e.health-damage:0;
    e.state=e.health?Hurt:Death;e.timer=e.health?14:60;
    e.attack.active=false;e.attack.cooldown=enemySpecs[e.type].recovery;
}
void strikeEnemies(const Attack& a) {
    for(auto& e:enemies)if(e.zone==game.zone&&e.health>0&&inArc(a.weapon,a.facing,a.x,a.y,e.x,e.y)&&lineClear(game.zone,a.x,a.y,e.x,e.y))hurtEnemy(e,weapons[a.weapon].damage);
}
bool enemyBlocked(const Enemy& e,float x,float y) {
    if(e.zone==game.zone&&fabsf(game.x-x)<10&&fabsf(game.y-y)<8)return true;
    if(solid(e.zone,x-4,y-3)||solid(e.zone,x+4,y+3)||solid(e.zone,x-4,y+3)||solid(e.zone,x+4,y-3))return true;
    for(const auto& other:enemies)if(&other!=&e&&other.zone==e.zone&&other.health>0&&fabsf(other.x-x)<9&&fabsf(other.y-y)<8)return true;
    return false;
}
void walkEnemy(Enemy& e,float tx,float ty,float speed) {
    float dx=tx-e.x,dy=ty-e.y,len=sqrtf(dx*dx+dy*dy);
    if(len<1)return;
    e.facing=heading(dx,dy);dx*=speed/len;dy*=speed/len;
    if(!enemyBlocked(e,e.x+dx,e.y))e.x+=dx;
    if(!enemyBlocked(e,e.x,e.y+dy))e.y+=dy;
}
bool launch(int zone,int owner,float x,float y,int facing,int damage);
bool startAttack(Attack& a,int weapon,int facing,float x,float y);
void tickEnemies() {
    for(auto& e:enemies)if(e.zone==game.zone) {
        const auto& spec=enemySpecs[e.type];auto& a=e.attack;
        if(a.cooldown)--a.cooldown;
        if(e.state==Death||e.state==Hurt){if(e.timer>0)--e.timer;if(!e.timer&&e.health>0)e.state=Idle;continue;}
        if(a.active) {
            ++a.age;
            if(a.age==spec.windup) {
                if(e.type==Bow)launch(e.zone,int(&e-enemies),a.x,a.y,a.facing,spec.damage);
                else if(inArc(e.type,a.facing,a.x,a.y,game.x,game.y)&&lineClear(e.zone,a.x,a.y,game.x,game.y))incomingDamage=spec.damage;
            }
            if(a.age>=spec.windup+10){a.active=false;e.state=Idle;}
            continue;
        }
        float dx=game.x-e.x,dy=game.y-e.y,dist=sqrtf(dx*dx+dy*dy);
        float hx=game.x-e.homeX,hy=game.y-e.homeY;
        bool sees=dist<spec.detection&&hx*hx+hy*hy<120*120&&lineClear(e.zone,e.x,e.y,game.x,game.y);
        if(sees) {
            e.facing=heading(dx,dy);
            if(dist<=spec.range) {
                e.state=Idle;
                if(!a.cooldown){startAttack(a,e.type,e.facing,e.x,e.y);a.cooldown=spec.windup+spec.recovery;e.state=Attacking;}
            }else {e.state=Chase;walkEnemy(e,game.x,game.y,spec.speed);}
        }else {
            float px=e.homeX+(e.phase?16:-16);
            if(fabsf(e.x-px)<2&&fabsf(e.y-e.homeY)<2){e.state=Idle;if(--e.timer<=0){e.phase=1-e.phase;e.timer=45;}}
            else {e.state=Patrol;walkEnemy(e,px,e.homeY,spec.speed*.5f);}
        }
    }
}
bool launch(int zone,int owner,float x,float y,int facing,int damage) {
    for(auto& p:projectiles)if(!p.active) {
        auto d=directions[facing];p={true,zone,owner,damage,x,y,d.x*3,d.y*3,160};return true;
    }
    return false;
}
bool startAttack(Attack& a,int weapon,int facing,float x,float y) {
    if(a.cooldown||a.active)return false;
    a={0,weapon,facing,weapons[weapon].windup+weapons[weapon].recovery,true,false,x,y};return true;
}
void playerStrike() {
    if(game.paused||game.event||game.transition||game.health<=0||game.hurt||(game.weapon==Bow&&game.inventory.counts[3]==0))return;
    startAttack(game.attack,game.weapon,game.facing,game.x,game.y);
}
void damagePlayer(int damage) {
    if(damage<=0||game.health<=0||game.invulnerable||game.transition||game.paused||game.event)return;
    game.health=damage>=game.health?0:game.health-damage;
    game.invulnerable=60;game.hurt=14;game.attack.active=false;
    if(game.health==0){--game.lives;game.dying=60;game.moving=false;game.keys=0;clearCombat();}
}
void tickCombat() {
    incomingDamage=0;
    auto& a=game.attack;
    if(a.cooldown)--a.cooldown;
    if(a.active) {
        ++a.age;
        if(a.age==weapons[a.weapon].windup&&a.weapon==Bow) {
            if(launch(game.zone,-1,a.x,a.y,a.facing,weapons[Bow].damage))--game.inventory.counts[3];
        }
        if(a.age==weapons[a.weapon].windup&&a.weapon!=Bow&&!a.connected){strikeEnemies(a);a.connected=true;}
        if(a.age>=weapons[a.weapon].windup+10)a.active=false;
    }
    tickEnemies();
    for(auto& p:projectiles)if(p.active&&p.zone==game.zone) {
        // Sweep in one-pixel steps: thin obstacles cannot be skipped.
        for(int step=0;step<3&&p.active;++step) {
            p.x+=p.dx/3;p.y+=p.dy/3;p.remaining-=1;
            if(p.remaining<=0||solid(p.zone,p.x,p.y))p.active=false;
            if(!p.active)break;
            if(p.owner<0) {
                for(auto& e:enemies)if(e.health>0&&e.zone==p.zone&&fabsf(e.x-p.x)<6&&fabsf(e.y-p.y)<7){hurtEnemy(e,p.damage);p.active=false;break;}
            }else if(fabsf(game.x-p.x)<6&&fabsf(game.y-p.y)<7){incomingDamage=p.damage;p.active=false;}
        }
    }
}
void interact() {
    if(game.event||game.transition||game.attack.active||game.health<=0)return;
    for(int i=0;i<PickupCount;++i) {
        const auto& p=pickups[i];float dx=p.x-game.x,dy=p.y-game.y;
        if(p.zone!=game.zone||(game.inventory.picked&(1u<<i))||dx*dx+dy*dy>22*22||!lineClear(game.zone,game.x,game.y,p.x,p.y))continue;
        int& count=game.inventory.counts[p.item-1];
        if(count>=items[p.item-1].limit)continue;
        count+=p.quantity;if(count>items[p.item-1].limit)count=items[p.item-1].limit;
        game.inventory.picked|=1u<<i;game.lastPickup=p.item;game.event=6;return;
    }
    float best=34*34;
    for(int y=0;y<Rows;++y)for(int x=0;x<Cols;++x) {
        int object=zones[game.zone].objects[y][x],event=0;
        if(object==Machine)event=1;
        if(object==Guide)event=2;
        if(object==Workbench)event=3;
        if(object==Fire)event=4;
        if(object==Hunter)event=7;
        if(object==Elder)event=8;
        if(object==Petroglyph)event=9;
        if(object==Rift)event=10;
        float dx=x*Tile+8-game.x,dy=y*Tile+8-game.y,d=dx*dx+dy*dy;
        if(event&&d<best){best=d;game.event=event;}
    }
    if(game.event>=1&&game.event<=10&&game.event!=5&&game.event!=6)game.storyEvents|=1u<<(game.event-1);
}
void tick() {
    if(game.paused||game.event)return;
    ++game.ticks;
    if(game.gameover)return;
    if(game.dying) {
        if(--game.dying==0) {
            if(!game.lives){game.gameover=1;game.event=5;}
            else {
                game.x=game.zone?24:104;game.y=168;game.health=100;game.hurt=0;game.invulnerable=120;game.keys=0;
                for(auto& e:enemies){e.x=e.homeX;e.y=e.homeY;}
            }
        }
        return;
    }
    if(game.transition) {
        --game.transition;
        if(game.transition==12) {
            int prev=game.zone;
            game.zone=game.target;
            if(prev==0 && game.zone==1) { game.x=24; game.y=168; }
            else if(prev==1 && game.zone==0) { game.x=Width-24; game.y=168; }
            else if(prev==1 && game.zone==2) { game.x=240; game.y=Height-24; }
            else if(prev==2 && game.zone==1) { game.x=240; game.y=24; }
            else if(prev==1 && game.zone==3) { game.x=24; game.y=168; }
            else if(prev==3 && game.zone==1) { game.x=Width-24; game.y=168; }
            else if(prev==1 && game.zone==4) { game.x=240; game.y=24; }
            else if(prev==4 && game.zone==1) { game.x=240; game.y=Height-24; }
            else if(prev==3 && game.zone==4) { game.x=336; game.y=24; }
            else if(prev==4 && game.zone==3) { game.x=336; game.y=Height-24; }
            else if(prev==4 && game.zone==5) { game.x=96; game.y=Height-24; }
            else if(prev==5 && game.zone==4) { game.x=96; game.y=24; }
            else { game.x=game.zone?24:Width-24; game.y=168; }
            game.visited|=1<<game.zone;
        }
        return;
    }
    if(game.invulnerable)--game.invulnerable;
    if(game.hurt)--game.hurt;
    tickCombat();damagePlayer(incomingDamage);
    if(game.health<=0)return;
    if(game.keys&Strike)playerStrike();
    if(game.attack.active){game.moving=false;game.walk=0;return;}
    int dx=((game.keys&Right)!=0)-((game.keys&Left)!=0);
    int dy=((game.keys&Down)!=0)-((game.keys&Up)!=0);
    game.moving=dx||dy;
    if(!game.moving){game.walk=0;return;}
    game.facing=dy<0?(dx<0?7:dx>0?1:0):dy>0?(dx<0?5:dx>0?3:4):(dx<0?6:2);
    float speed=dx&&dy?1.0606601718f:1.5f; // 90 pixels/second, normalized.
    bool moved=false;
    if(!blocked(game.x+dx*speed,game.y)){game.x+=dx*speed;moved=dx!=0;}
    if(!blocked(game.x,game.y+dy*speed)){game.y+=dy*speed;moved=moved||dy!=0;}
    game.moving=moved;if(moved)++game.walk;else game.walk=0;
    if(game.zone==0 && game.x>=Width-7) {
        game.target=1; game.transition=24; game.moving=false; game.walk=0; clearCombat();
    } else if(game.zone==1 && game.x<=7) {
        game.target=0; game.transition=24; game.moving=false; game.walk=0; clearCombat();
    } else if(game.zone==1 && game.y<=7 && game.x>=208 && game.x<=272) {
        game.target=2; game.transition=24; game.moving=false; game.walk=0; clearCombat();
    } else if(game.zone==1 && game.x>=Width-7) {
        game.target=3; game.transition=24; game.moving=false; game.walk=0; clearCombat();
    } else if(game.zone==1 && game.y>=Height-7 && game.x>=208 && game.x<=272) {
        game.target=4; game.transition=24; game.moving=false; game.walk=0; clearCombat();
    } else if(game.zone==2 && game.y>=Height-7 && game.x>=208 && game.x<=272) {
        game.target=1; game.transition=24; game.moving=false; game.walk=0; clearCombat();
    } else if(game.zone==3 && game.x<=7) {
        game.target=1; game.transition=24; game.moving=false; game.walk=0; clearCombat();
    } else if(game.zone==3 && game.y>=Height-7 && game.x>=288 && game.x<=368) {
        game.target=4; game.transition=24; game.moving=false; game.walk=0; clearCombat();
    } else if(game.zone==4 && game.y<=7 && game.x>=208 && game.x<=272) {
        game.target=1; game.transition=24; game.moving=false; game.walk=0; clearCombat();
    } else if(game.zone==4 && game.y<=7 && game.x>=288 && game.x<=368) {
        game.target=3; game.transition=24; game.moving=false; game.walk=0; clearCombat();
    } else if(game.zone==4 && game.y<=7 && game.x>=64 && game.x<=128) {
        game.target=5; game.transition=24; game.moving=false; game.walk=0; clearCombat();
    } else if(game.zone==5 && game.y>=Height-7 && game.x>=64 && game.x<=128) {
        game.target=4; game.transition=24; game.moving=false; game.walk=0; clearCombat();
    }
}
void terrain() {
    const Zone& z=zones[game.zone];
    for(int y=0;y<Height;++y)for(int x=0;x<Width;++x) {
        int kind=z.terrain[y/Tile][x/Tile];
        unsigned n=noise(x,y),rgb=0;
        switch(kind) {
            case Grass: rgb=n%19==0?0x536943:n%11==0?0x364f38:0x405d3e;break;
            case Dirt: rgb=n%17==0?0xa39062:n%9==0?0x786946:0x8a7952;break;
            case Water: rgb=((x+y/3+game.ticks/8)%19<3)?0x6faaa4:((n%5)?0x3b777f:0x43858b);break;
            case Bridge: rgb=y%5==0?0x594c36:x%16==0?0xc3a573:0x9f8155;break;
            case Cliff: rgb=(x%16<2||y%12<2)?0x344443:n%7==0?0x647062:0x4b5951;break;
            case CaveFloor: rgb=(x%16<2||y%14<2)?0x222a2c:n%7==0?0x364244:0x2b3537;break;
        }
        renderer.pixel(x,y,rgba(rgb));
        if(kind==Water&&x%16==2&&y%7==0)renderer.rect(x,y,4,1,rgba(0xb1d4be,90));
    }
    // Small grass shoots and flowers remain in world coordinates.
    for(int y=2;y<Rows-1;++y)for(int x=1;x<Cols-1;++x)if(z.terrain[y][x]==Grass) {
        int px=x*16+(noise(x,y)%10)+2,py=y*16+9;
        renderer.rect(px,py,1,3,rgba(0x76905b));renderer.pixel(px-1,py-1,rgba(0x76905b));
        if(noise(x,y)%7==0)renderer.rect(px+4,py+3,2,2,rgba(0xc3ad74));
    }
}
void human(int x,int y,bool npc) {
    const uint32_t palette[]={rgba(0x253438),rgba(npc?0x9c704a:0x387b83),rgba(npc?0xc29a69:0x69b5b0),rgba(0xd0a278),rgba(0x563e32),rgba(0xddd0a0)};
    static const char body[]=
        "....0000...."
        "...044440..."
        "...433334..."
        "...033330..."
        "....0330...."
        "...011110..."
        "..01222110.."
        "..01222110.."
        "..03111130.."
        "...011110..."
        "...055550..."
        "...011110...";
    renderer.ellipse(x,y+1,7,3,rgba(0x102a2b,90));
    bool flip=game.facing>4;
    renderer.sprite(x-6,y-18,body,12,12,palette,npc?false:flip);
    if(!npc&&(game.facing==0||game.facing==1||game.facing==7))renderer.rect(x-2,y-15,4,3,palette[4]);
    int step=!npc&&game.moving?((game.walk/7)%4):0;
    renderer.rect(x-3,y-6,2,step==1?5:4,palette[0]);
    renderer.rect(x+1,y-6,2,step==3?5:4,palette[0]);
    renderer.rect(x-4,y-(step==1?1:2),3,2,palette[4]);
    renderer.rect(x+1,y-(step==3?1:2),3,2,palette[4]);
    if(!npc) { // Traveler's satchel and temporal beacon.
        renderer.rect(x+3,y-11,3,5,rgba(0xc49a60));
        renderer.pixel(x+4,y-11,rgba((game.ticks/40)%2?0xffdc9d:0x87d9cb));
    }
}
void tree(int x,int y) {
    renderer.ellipse(x+1,y+2,15,5,rgba(0x122c2a,65));
    renderer.rect(x-3,y-16,6,17,rgba(0x443c2b));
    renderer.rect(x-1,y-14,2,15,rgba(0x806643));
    const unsigned colors[]={0x233e32,0x2d4f35,0x3c623c,0x537347,0x6c8650};
    for(int tier=0;tier<4;++tier) {
        int cy=y-12-tier*5,rx=16-tier*3;
        renderer.ellipse(x,cy,rx,6,rgba(colors[tier]));
        renderer.ellipse(x-3,cy-2,rx-4,3,rgba(colors[tier+1]));
        for(int i=0;i<5;++i)renderer.pixel(x-rx+4+i*3,cy+2,rgba(0x294a32));
    }
}
void object(int kind,int x,int y) {
    if(kind==Tree){tree(x,y);return;}
    if(kind==Guide){human(x,y,true);return;}
    if(kind==Rock) {
        renderer.ellipse(x+2,y+2,10,4,rgba(0x21312c,80));
        renderer.ellipse(x,y-3,9,7,rgba(0x485552));
        renderer.ellipse(x-2,y-5,7,5,rgba(0x7a8270));
        renderer.rect(x-5,y-8,5,2,rgba(0xa1a38b));renderer.rect(x+2,y-4,2,5,rgba(0x626d62));return;
    }
    if(kind==Shelter) {
        renderer.ellipse(x,y+3,24,5,rgba(0x263b2e,95));
        for(int yy=-28;yy<3;++yy) {
            int half=(yy+29)*3/4;
            renderer.rect(x-half,y+yy,half*2+1,1,rgba(yy%4==0?0xc1a270:0xab8858));
            renderer.pixel(x-half,y+yy,rgba(0xe1c58d));
        }
        for(int yy=-12;yy<3;++yy)renderer.rect(x-(yy+13)/3,y+yy,(yy+13)*2/3+1,1,rgba(0x3a3b2e));
        renderer.rect(x-1,y-31,2,5,rgba(0x604b34));
        renderer.rect(x-14,y-1,2,6,rgba(0x604b34));renderer.rect(x+14,y-1,2,6,rgba(0x604b34));return;
    }
    if(kind==Fire) {
        renderer.ellipse(x,y,10,5,rgba(0x5a5340));
        renderer.rect(x-6,y-1,12,3,rgba(0x44362b));
        int flicker=(game.ticks/7)%3;
        for(int i=0;i<6;++i) {
            int h=5+(i*7+flicker*3)%8;
            renderer.rect(x-5+i*2,y-h,2,h,rgba(i%2?0xd27e40:0xe3ab55));
        }
        renderer.rect(x-2,y-5,4,5,rgba(0xf2dc91));
        renderer.pixel(x+flicker*2-3,y-17-flicker,rgba(0xd7bd89));return;
    }
    if(kind==Machine) {
        renderer.ellipse(x,y+2,18,7,rgba(0x1c3030,110));
        renderer.ellipse(x,y-4,16,12,rgba(0x304953));
        renderer.ellipse(x,y-6,13,10,rgba(0x9bafa4));
        renderer.ellipse(x,y-7,10,7,rgba(0x446c74));
        renderer.ellipse(x,y-9,7,4,rgba(0x80b2ae));
        renderer.rect(x-20,y-3,8,4,rgba(0x7f8c81));renderer.rect(x+13,y-1,9,4,rgba(0x626e69));
        renderer.rect(x-8,y+3,16,3,rgba(0x263f47));
        for(int i=0;i<3;++i)renderer.rect(x-6+i*5,y+3,2,1,rgba((game.ticks/30)%2?0xd9b46c:0x90d5cd));
        return;
    }
    if(kind==Workbench) {
        renderer.ellipse(x,y+2,12,4,rgba(0x273c30,75));
        renderer.rect(x-10,y-8,20,8,rgba(0x685a42));
        renderer.rect(x-10,y-9,20,3,rgba(0xae9365));
        renderer.ellipse(x-4,y-10,3,2,rgba(0xa7b3a0));
        renderer.rect(x+3,y-12,2,6,rgba(0xd1c1a1));
        return;
    }
    if(kind==Hunter) {
        human(x,y,true);
        renderer.rect(x-5,y-14,2,10,rgba(0x8a6239));
        renderer.pixel(x-6,y-15,rgba(0xcbb387));
        renderer.pixel(x-6,y-4,rgba(0xcbb387));
        return;
    }
    if(kind==Elder) {
        human(x,y,true);
        renderer.rect(x-2,y-11,4,5,rgba(0xe8e8d8));
        renderer.rect(x-4,y-9,8,3,rgba(0x735738));
        return;
    }
    if(kind==Petroglyph) {
        renderer.rect(x-6,y-8,12,12,rgba(0x232d2c,120));
        renderer.pixel(x,y-6,rgba(0xe0b571));
        renderer.pixel(x-2,y-5,rgba(0xe0b571));renderer.pixel(x+2,y-5,rgba(0xe0b571));
        renderer.rect(x-1,y-4,3,2,rgba(0xf4dc9d));
        renderer.pixel(x-3,y-2,rgba(0xd2aa68));renderer.pixel(x-4,y-3,rgba(0xd2aa68));renderer.pixel(x-3,y-4,rgba(0xd2aa68));
        renderer.rect(x-2,y-1,5,2,rgba(0xd2aa68));
        renderer.pixel(x-1,y+2,rgba(0xd2aa68));renderer.pixel(x+2,y+2,rgba(0xd2aa68));
        return;
    }
    if(kind==Rift) {
        renderer.ellipse(x,y+2,16,6,rgba(0x1a0f28,140));
        int phase=(game.ticks/5)%8;
        for(int r=12;r>=2;r-=2) {
            uint32_t c=((r+phase)%2)?rgba(0xa855f7,180):rgba(0x38bdf8,180);
            renderer.ellipse(x,y-6-(8-r)/2,r,r/2+1,c);
        }
        renderer.rect(x-1,y-14,2,14,rgba(0xffffff,220));
        renderer.pixel(x+(phase%4)-2,y-16,rgba(0xf472b6));
        return;
    }
}
void weaponArt(int x,int y,int weapon,int facing,int age,bool attacking,uint32_t color) {
    auto d=directions[facing];auto side=Vec{-d.y,d.x};
    if(weapon==Bow) {
        for(int i=-5;i<=5;++i) {
            float bend=(25-i*i)*.12f;
            renderer.pixel(int(x+d.x*(7+bend)+side.x*i),int(y-9+d.y*(7+bend)+side.y*i),color);
        }
        if(attacking&&age<weapons[Bow].windup)renderer.rect(x-1,y-10,3,2,rgba(0xf0dfa0));
    }else {
        int length=weapon==Sword?13:25;
        int extension=attacking&&age>=weapons[weapon].windup?9:0;
        for(int i=3;i<length+extension;++i) {
            int px=int(x+d.x*i),py=int(y-8+d.y*i);
            renderer.pixel(px,py,i>length-6?rgba(0xe4e4c6):color);
            if(weapon==Sword)renderer.pixel(px+1,py,rgba(0xa5b9b0));
        }
        if(attacking&&age>=weapons[weapon].windup&&age<weapons[weapon].windup+5)
            for(int i=-5;i<=5;++i)renderer.pixel(int(x+d.x*(length+extension)+side.x*i),int(y-8+d.y*(length+extension)+side.y*i),rgba(0xf7edbb));
    }
}
void render() {
    terrain();
    for(int i=0;i<PickupCount;++i)if(pickups[i].zone==game.zone&&!(game.inventory.picked&(1u<<i))) {
        const auto& p=pickups[i];int x=int(p.x),y=int(p.y);
        renderer.ellipse(x,y+1,5,2,rgba(0x193c34,100));
        if(p.item==4){for(int k=-2;k<=2;k+=2){renderer.rect(x+k,y-8,1,8,rgba(0xcdbb83));renderer.pixel(x+k-1,y-8,rgba(0xf1e7b3));}}
        else if(p.item==5){renderer.rect(x-4,y-7,8,7,rgba(0x9f634f));renderer.rect(x-1,y-6,2,5,rgba(0xf2dfb6));renderer.rect(x-3,y-4,6,1,rgba(0xf2dfb6));}
        else if(p.item==6){renderer.ellipse(x,y-4,4,3,rgba(0xb3baa1));renderer.rect(x,y-3,2,6,rgba(0x80643d));}
        else {renderer.rect(x-2,y-8,5,7,rgba(p.item==7?0x91cac3:0xd8bb6d));renderer.pixel(x+3,y-9,rgba(0xf6e9b7));}
        if(game.ticks%60<30)renderer.pixel(x,y-12,rgba(0xf3dfa0));
    }
    // Stable row depth order, with the player inserted at their feet.
    for(int row=0;row<Rows;++row) {
        for(int col=0;col<Cols;++col)if(zones[game.zone].objects[row][col])
            object(zones[game.zone].objects[row][col],col*Tile+8,row*Tile+8);
        if(int(game.y)/Tile==row){
            int x=int(game.x),y=int(game.y);
            if(game.health<=0){renderer.ellipse(x,y,9,3,rgba(0x69b5b0));renderer.rect(x+5,y-3,4,3,rgba(0xd0a278));}
            else if(!game.invulnerable||game.ticks%6<4) {
                human(x,y,false);
                if(game.hurt)renderer.rect(x-3,y-12,6,7,rgba(0xf0a591,170));
                weaponArt(x,y,game.weapon,game.attack.active?game.attack.facing:game.facing,game.attack.age,game.attack.active,rgba(0xcbb387));
            }
        }
        for(const auto& e:enemies)if(e.zone==game.zone&&int(e.y)/Tile==row) {
            int x=int(e.x),y=int(e.y);unsigned color=e.type==Sword?0xb76a57:e.type==Spear?0xa58cba:0xb69d56;
            if(e.health<=0){renderer.ellipse(x,y,8,3,rgba(color,e.timer>0?180:65));continue;}
            human(x,y,true);
            renderer.rect(x-3,y-12,6,6,rgba(e.state==Hurt&&e.timer%4<2?0xffe5ba:color));
            renderer.rect(x-4,y-17,8,3,rgba(0x433943));
            if(e.state==Patrol||e.state==Chase)renderer.pixel(x+(game.ticks/8%2?3:-3),y,rgba(color));
            weaponArt(x,y,e.type,e.attack.active?e.attack.facing:e.facing,e.attack.age,e.attack.active,rgba(color));
            renderer.rect(x-8,y-23,16,2,rgba(0x252e2e));
            renderer.rect(x-8,y-23,16*e.health/enemySpecs[e.type].health,2,rgba(color));
            if(e.state==Attacking)renderer.rect(x-1,y-28,2,3,rgba(0xf7cc70));
        }
    }
    for(const auto& p:projectiles)if(p.active&&p.zone==game.zone)
        for(int i=0;i<7;++i)renderer.pixel(int(p.x-p.dx*i/3),int(p.y-8-p.dy*i/3),rgba(i<2?0xf1e4b5:0xbeb08d));
    // Vignette keeps edges quiet without moving or scaling the camera.
    for(int i=0;i<10;++i) {
        uint32_t c=rgba(0x10272a,(10-i)*6);
        renderer.rect(i,i,Width-2*i,1,c);renderer.rect(i,Height-1-i,Width-2*i,1,c);
        renderer.rect(i,i,1,Height-2*i,c);renderer.rect(Width-1-i,i,1,Height-2*i,c);
    }
    if(game.transition) {
        int alpha=(12-(game.transition>12?game.transition-12:12-game.transition))*255/12;
        renderer.rect(0,0,Width,Height,rgba(0x101e22,alpha));
    }
}
}
#include "save.hpp"
extern "C" {
void tj_init() { tj::game=tj::Game{};tj::initEnemies();tj::clearCombat();for(int i=0;i<tj::ZoneCount;++i)tj::makeZone(tj::zones[i],i);tj::render(); }
int tj_enemy(int index,int field) {
    if(index<0||index>=tj::EnemyCount)return -1;const auto& e=tj::enemies[index];
    switch(field){case 0:return e.health;case 1:return e.state;case 2:return int(e.x*1000);case 3:return int(e.y*1000);case 4:return e.type;case 5:return e.attack.cooldown;default:return -1;}
}
void tj_input(int mask) {
    int next=mask&63;
    if(!tj::game.paused&&(next&tj::Interact)&&!(tj::game.keys&tj::Interact))tj::interact();
    tj::game.keys=next;
    if((next&tj::Strike))tj::playerStrike();
}
int tj_equip(int weapon) {if(weapon<0||weapon>2||tj::game.health<=0||tj::game.transition||tj::game.attack.active||tj::game.attack.cooldown)return 0;tj::game.weapon=weapon;return 1;}
int tj_item_count(int item) {return item>=1&&item<=tj::ItemCount?tj::game.inventory.counts[item-1]:-1;}
int tj_item_info(int item,int field) {if(item<1||item>tj::ItemCount)return -1;const auto& d=tj::items[item-1];return field==0?d.type:field==1?d.limit:-1;}
uintptr_t tj_item_text(int item,int field) {
    if(item<1||item>tj::ItemCount||field<0||field>2)return 0;const auto& d=tj::items[item-1];
    return reinterpret_cast<uintptr_t>(field==0?d.id:field==1?d.name:d.description);
}
int tj_use(int item) {
    auto& g=tj::game;
    if(item<1||item>tj::ItemCount||g.inventory.counts[item-1]<=0||g.health<=0||g.attack.active||g.transition)return 0;
    if(item<=3)return tj_equip(item-1);
    if(item==5&&g.health<100){g.health+=35;if(g.health>100)g.health=100;--g.inventory.counts[4];return 1;}
    return 0;
}
int tj_projectile(int index,int field) {
    if(index<0||index>=tj::MaxProjectiles)return -1;
    const auto& p=tj::projectiles[index];
    switch(field){case 0:return p.active;case 1:return int(p.x*1000);case 2:return int(p.y*1000);case 3:return p.owner;default:return -1;}
}
void tj_tick() { tj::tick(); }
void tj_render() { tj::render(); }
uintptr_t tj_pixels() { return reinterpret_cast<uintptr_t>(tj::renderer.pixels); }
uintptr_t tj_save_buffer() {return reinterpret_cast<uintptr_t>(tj::saveWords);}
int tj_save() {return tj::serialize();}
int tj_load(int length) {return tj::restore(length);}
void tj_pause(int paused) {tj::game.paused=paused!=0;tj::game.keys=0;tj::game.moving=false;}
void tj_ack() {tj::game.event=0;tj::game.keys=0;}
int tj_state(int field) {
    const auto& g=tj::game;
    switch(field) {
        case 0:return int(g.x*1000);case 1:return int(g.y*1000);
        case 2:return g.zone;case 3:return g.facing;case 4:return g.walk;
        case 5:return g.transition;case 6:return g.event;case 7:return g.visited;
        case 8:return g.health;case 9:return g.lives;case 10:return g.ticks;
        case 11:return tj::Width;case 12:return tj::Height;
        case 13:return g.weapon;case 14:return g.inventory.counts[3];case 15:return g.attack.active;
        case 16:return g.attack.cooldown;case 17:return g.invulnerable;case 18:return g.dying;
        case 19:return g.gameover;case 20:return g.hurt;case 21:return g.lastPickup;default:return -1;
    }
}
int tj_tile(int zone,int x,int y) {
    if(zone<0||zone>=tj::ZoneCount||x<0||y<0||x>=tj::Cols||y>=tj::Rows)return -1;
    int tile=tj::zones[zone].terrain[y][x];
    return tile==tj::Water||tile==tj::Cliff||tj::solidObject(tj::zones[zone].objects[y][x])?1:0;
}
}
