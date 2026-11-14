// Scenario controls exist only in the test binary, never in the shipped game.
#include "../src/rpg/engine.cpp"
extern "C" {
void fixture_player(int x,int y,int facing){auto& p=tj::me();p.x=x;p.y=y;p.facing=facing;tj::game.zone=tj::zoneAt(p.x,p.y);tj::snapCamera();}
void fixture_enemy(int index,int x,int y){auto& e=tj::enemies[index];e.x=e.homeX=e.nx=x;e.y=e.homeY=e.ny=y;e.active=true;e.hp=tj::enemySpecs[e.type].health;e.state=tj::Idle;tj::game.groups|=1<<e.group;}
int fixture_hp(){return tj::me().hp;}
int fixture_arc(int weapon,int facing,int x,int y,int tx,int ty){return tj::inArc(weapon,facing,x,y,tx,ty)&&tj::lineClear(x,y,tx,ty);}
}
