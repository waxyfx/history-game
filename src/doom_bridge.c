/* Tarikh browser integration, 2026-10-29. GPL-2.0-or-later. */
#include <emscripten.h>
#include "doomgeneric.h"
#include "doomstat.h"
#include "doomkeys.h"
#include "d_event.h"
#include "g_game.h"
#include "p_local.h"
#include "r_main.h"
#include "m_controls.h"
#include "d_loop.h"
static unsigned short queue[256];
static unsigned int rd=0,wr=0;
static unsigned int clockms=0;
static int level=1;
void DG_Init(void){}
void DG_SetWindowTitle(const char *s){}
void DG_SleepMs(uint32_t ms){clockms+=ms;}
uint32_t DG_GetTicksMs(void){return clockms++;}
int DG_GetKey(int *pressed,unsigned char *key){if(rd==wr)return 0;unsigned short v=queue[rd++%256];*pressed=v>>8;*key=v&255;return 1;}
EM_JS(void,paint,(unsigned char *buf),{
 if(!Module.canvas)return;
 if(!Module.frame){Module.frame=new ImageData(640,400);Module.ctx=Module.canvas.getContext('2d',{alpha:false});}
 var dest=Module.frame.data;for(var i=0;i<dest.length;i+=4){dest[i]=HEAPU8[buf+i+2];dest[i+1]=HEAPU8[buf+i+1];dest[i+2]=HEAPU8[buf+i];dest[i+3]=255;}
 Module.ctx.putImageData(Module.frame,0,0);
});
void DG_DrawFrame(void){paint((unsigned char*)DG_ScreenBuffer);}
EMSCRIPTEN_KEEPALIVE void th_key(int key,int down){if(wr-rd<255)queue[wr++%256]=(down<<8)|(key&255);}
EMSCRIPTEN_KEEPALIVE void th_look(int dx){event_t e={ev_mouse,0,dx,0};D_PostEvent(&e);}
static int attackHeld, attackTicks;
EMSCRIPTEN_KEEPALIVE void th_attack(int down){
 attackHeld=down>0;
 if(down>0)attackTicks=3;
 if(down<0)attackTicks=0;
}
EMSCRIPTEN_KEEPALIVE void th_tick(void){
 static int pressed;
 int fire=attackHeld || attackTicks>0;
 if(fire!=pressed){th_key(KEY_FIRE,fire);pressed=fire;}
 if(attackTicks>0)attackTicks--;
 clockms+=28;doomgeneric_Tick();
 if(gamemap==1 && gamestate==GS_LEVEL){
  for(thinker_t *t=thinkercap.next;t!=&thinkercap;t=t->next){
   if(t->function.acp1!=(actionf_p1)P_MobjThinker)continue;
   mobj_t *m=(mobj_t*)t;
   if(m->type!=MT_MISC29 && m->type!=MT_MISC30 && m->type!=MT_MISC37)continue;
   int dir=((leveltime+(m->type==MT_MISC30?54:0))/70)%2?1:-1;
   P_TryMove(m,m->x,m->y+dir*FRACUNIT/2);
  }
 }
}
EMSCRIPTEN_KEEPALIVE int th_x(void){return players[0].mo?players[0].mo->x/FRACUNIT:0;}
EMSCRIPTEN_KEEPALIVE int th_y(void){return players[0].mo?players[0].mo->y/FRACUNIT:0;}
static int attackers, opponents;
void th_record_hit(mobj_t *target,mobj_t *source){
 if(!source)return;
 mobj_t *foe=target->player?source:target;
 int kind=foe->type==MT_POSSESSED?1:foe->type==MT_SERGEANT?2:foe->type==MT_TROOP?4:0;
 if(target->player)attackers|=kind;
 if(source->player)opponents|=kind;
}
EMSCRIPTEN_KEEPALIVE int th_attackers(void){return attackers;}
EMSCRIPTEN_KEEPALIVE int th_opponents(void){return opponents;}
EMSCRIPTEN_KEEPALIVE int th_health(void){return players[0].health;}
EMSCRIPTEN_KEEPALIVE int th_tics(void){return leveltime;}
EMSCRIPTEN_KEEPALIVE void th_quality(int low){R_SetViewSize(11,low?1:0);}
EMSCRIPTEN_KEEPALIVE void th_turnaround(void){if(gamestate==GS_LEVEL && players[0].mo)players[0].mo->angle+=ANG180;}
EMSCRIPTEN_KEEPALIVE int th_angle(void){return players[0].mo?players[0].mo->angle>>16:0;}
EMSCRIPTEN_KEEPALIVE void th_gate(int open){if(gamemap==1){for(int i=0;i<numsectors;i++)if(sectors[i].tag==91)sectors[i].floorheight=(open?0:72)*FRACUNIT;}else if(numsectors>1)sectors[1].ceilingheight=(open?160:0)*FRACUNIT;}
EMSCRIPTEN_KEEPALIVE void th_heal(void){if(players[0].mo){players[0].health=100;players[0].mo->health=100;players[0].playerstate=PST_LIVE;}}
EMSCRIPTEN_KEEPALIVE void th_level(int n){level=n;th_attack(-1);G_DeferedInitNew(sk_easy,1,n);}
EMSCRIPTEN_KEEPALIVE void th_weapon(void){player_t *p=&players[0]; p->pendingweapon=p->readyweapon==wp_pistol?wp_fist:wp_pistol;}
EMSCRIPTEN_KEEPALIVE int th_equipped(void){return players[0].readyweapon==wp_pistol?1:2;}
EMSCRIPTEN_KEEPALIVE int th_arrows(void){return players[0].ammo[am_clip];}
EMSCRIPTEN_KEEPALIVE void th_equip(int slot){
 player_t *p=&players[0];
 weapontype_t next=slot==1?wp_pistol:wp_fist;
 if(next!=p->readyweapon && (slot!=1||th_arrows()>0))p->pendingweapon=next;
}
EMSCRIPTEN_KEEPALIVE int th_speaker(void){
 mobj_t *player=players[0].mo;
 if(gamemap!=1||!player)return 0;
 fixed_t nearest=128*FRACUNIT;
 int speaker=0;
 for(thinker_t *t=thinkercap.next;t!=&thinkercap;t=t->next){
  if(t->function.acp1!=(actionf_p1)P_MobjThinker)continue;
  mobj_t *m=(mobj_t*)t;
  int id=m->type==MT_MISC29?1:m->type==MT_MISC30?2:m->type==MT_MISC37?3:0;
  if(!id)continue;
  fixed_t d=P_AproxDistance(m->x-player->x,m->y-player->y);
  if(d<nearest && P_CheckSight(player,m)){nearest=d;speaker=id;}
 }
 return speaker;
}
EMSCRIPTEN_KEEPALIVE void th_enemy(void){if(gamestate==GS_LEVEL){mobj_t*m=P_SpawnMobj((gamemap==1?548:400)*FRACUNIT,(gamemap==1?842:800)*FRACUNIT,ONFLOORZ,MT_POSSESSED);m->flags|=MF_NOBLOOD;}}
int main(void){
 static char *args[]={"tarikh","-iwad","/freedoom2.wad","-file","/tarikh.wad","-warp","1","-skill","2","-nosound","-nomusic"};
 singletics=1;doomgeneric_Create(sizeof(args)/sizeof(args[0]),args);
 key_up='w';key_down='s';key_strafeleft='a';key_straferight='d';key_fire=KEY_FIRE;key_use='e';
 R_SetViewSize(11,0);return 0;
}
