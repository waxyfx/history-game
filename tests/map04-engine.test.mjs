import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const wasm=await WebAssembly.compile(await readFile(new URL('../public/engine/rpg/tarikh-rpg-4.wasm',import.meta.url)));
function start(){const e=new WebAssembly.Instance(wasm,{}).exports;e._initialize?.();e.tj_init();return e;}
function tick(e,n){for(let i=0;i<n;i++){e.tj_heal(100);e.tj_tick();}}
const boss=e=>Array.from({length:e.tj_enemy_count()},(_,i)=>i).find(i=>e.tj_enemy(i,4)===8);
test('MAP04 fortress has continuous side walls and one open west gate',()=>{
 const e=start();
 for(let y=33*16;y<=52*16;y++){
  assert.equal(e.tj_solid(102.5*16,y),1,'east wall y='+y);
  if(y<39.5*16||y>44.5*16)assert.equal(e.tj_solid(78.5*16,y),1,'west wall y='+y);
 }
 assert.equal(e.tj_solid(78.5*16,42*16),0,'west gate open');
 for(let x=79*16;x<=103*16;x++)for(const y of [33*16,52*16])assert.equal(e.tj_solid(x,y),1,'horizontal wall');
});
test('MAP04 native Witness fights all three phases, banners break, triple echo ends in vulnerability',()=>{
 const e=start(),i=boss(e);assert.notEqual(i,undefined);
 e.tj_groups(1<<5);e.tj_teleport(32*16,90*16);tick(e,100);
 assert.equal(e.tj_enemy(i,14),1);
 tick(e,80);assert.equal(e.tj_enemy(i,14),1);
 e.tj_enemy_damage(i,10000,0);assert.equal(e.tj_enemy(i,0),520,'burst stops at phase boundary');
 tick(e,1);assert.equal(e.tj_enemy(i,14),2);
 e.tj_enemy_damage(i,10000,0);assert.equal(e.tj_enemy(i,0),520,'transition is protected');
 tick(e,85);assert.equal(e.tj_enemy(i,16),7,'three shields');
 e.tj_enemy_damage(i,10000,0);assert.equal(e.tj_enemy(i,0),520,'banners prevent damage');
 for(let k=0;k<3;k++){
  const a=1.5708+k*2.0944,x=512+Math.cos(a)*62,y=1392+Math.sin(a)*40+6;
  e.tj_teleport(Math.round(x),Math.round(y+18));e.tj_face(0);e.tj_input(32);tick(e,10);e.tj_input(0);tick(e,30);
  assert.equal(e.tj_enemy(i,16)&(1<<k),0,'banner '+k+' destroyed');
 }
 assert.equal(e.tj_enemy(i,15),6,'shield collapse exposes witness');
 e.tj_enemy_damage(i,10000,0);assert.equal(e.tj_enemy(i,0),260);
 tick(e,1);assert.equal(e.tj_enemy(i,14),3);tick(e,85);
 let dashes=0,last=0,spent=false;
 for(let t=0;t<400;t++){
  tick(e,1);const state=e.tj_enemy(i,15);if(state===4&&last!==4)dashes++;
  if(state===6){spent=true;break;}last=state;
 }
 assert.equal(dashes,3);assert(spent,'three echo dashes followed by recovery');
 e.tj_enemy_damage(i,10000,0);assert.equal(e.tj_enemy(i,0),0,'boss defeated only in final face');
});
