// Scenario controls exist only in the test binary, never in the shipped game.
#include "../src/rpg/engine.cpp"
extern "C" {
void fixture_player(int x,int y,int facing) {tj::game.x=x;tj::game.y=y;tj::game.facing=facing;}
int fixture_arc(int weapon,int facing,int x,int y,int tx,int ty) {
    return tj::inArc(weapon,facing,x,y,tx,ty)&&tj::lineClear(tj::game.zone,x,y,tx,ty);
}
void fixture_wall(int x,int y) {tj::zones[0].terrain[y][x]=tj::Cliff;}
void fixture_enemy(int index,int type,int x,int y) {
    auto& e=tj::enemies[index];e=tj::Enemy{};e.zone=0;e.type=type;e.health=tj::enemySpecs[type].health;
    e.x=e.homeX=x;e.y=e.homeY=y;
}
int fixture_damage() {return tj::incomingDamage;}
void fixture_hurt(int damage) {tj::damagePlayer(damage);}
}
