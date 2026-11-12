import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const mod=await WebAssembly.compile(await readFile(new URL('./fixtures/rpg-fixture.wasm',import.meta.url)));
const start=()=>{const e=new WebAssembly.Instance(mod,{}).exports;e._initialize?.();e.tj_init();return e;};
const tick=(e,n)=>{for(let i=0;i<n;i++)e.tj_tick();};
test('Combat A: sword cone, longer narrow spear and solid occlusion',()=>{
 const e=start();
 assert.equal(e.fixture_arc(0,2,136,168,156,178),1);
 assert.equal(e.fixture_arc(0,2,136,168,126,168),0);
 assert.equal(e.fixture_arc(0,2,136,168,172,168),0);
 assert.equal(e.fixture_arc(1,2,136,168,172,168),1);
 assert.equal(e.fixture_arc(1,2,136,168,156,178),0);
 e.fixture_wall(9,10);assert.equal(e.fixture_arc(1,2,136,168,172,168),0);
});
test('Combat B: each weapon damages and kills; one melee strike hits once',()=>{
 for(const [weapon,distance] of [[0,20],[1,35],[2,65]]){
  const e=start();e.fixture_player(136,168,2);e.fixture_enemy(0,0,136+distance,168);e.tj_equip(weapon);
  e.tj_input(32);e.tj_input(0);tick(e,40);
  assert.equal(e.tj_enemy(0,0),60-[30,24,22][weapon]);
  e.tj_input(32);tick(e,200);e.tj_input(0);assert.equal(e.tj_enemy(0,0),0);assert.equal(e.tj_enemy(0,1),5);
 }
});
test('Combat B: detection, chase, attacks, hurt, death and cooldown',()=>{
 const e=start();e.fixture_player(136,168,2);e.fixture_enemy(0,0,196,168);tick(e,1);
 assert.equal(e.tj_enemy(0,1),2);assert(e.tj_enemy(0,2)<196000);
 let hits=0;for(let i=0;i<200;i++){tick(e,1);if(e.fixture_damage())hits++;}
 assert(hits>0&&hits<4,'Enemy melee attacks have a recovery interval');
 const archer=start();archer.fixture_player(136,168,2);archer.fixture_enemy(0,2,196,168);tick(archer,40);
 assert.equal(archer.tj_projectile(0,0),1);assert.equal(archer.tj_projectile(0,3),0);
 archer.fixture_player(400,168,2);tick(archer,140);assert([0,1].includes(archer.tj_enemy(0,1)));
});
test('Player C: immunity prevents same-frame damage, three deaths and safe respawn',()=>{
 const e=start();e.fixture_hurt(16);assert.equal(e.tj_state(8),84);assert(e.tj_state(20)>0);
 e.fixture_hurt(90);assert.equal(e.tj_state(8),84);tick(e,60);
 for(let lives=2;lives>=0;lives--){
  e.fixture_hurt(1000);assert.equal(e.tj_state(8),0);assert.equal(e.tj_state(9),lives);
  e.fixture_hurt(1000);assert.equal(e.tj_state(9),lives);
  assert.equal(e.tj_equip(1),0);e.tj_input(32);tick(e,60);
  if(lives){assert.equal(e.tj_state(8),100);assert.equal(e.tj_state(0),104000);assert.equal(e.tj_state(1),168000);tick(e,120);}
 }
 assert.equal(e.tj_state(19),1);assert.equal(e.tj_state(6),5);tick(e,1000);assert.equal(e.tj_state(9),0);
 e.tj_init();assert.equal(e.tj_state(8),100);assert.equal(e.tj_state(9),3);
});
test('Player C: actual archer projectile deals damage, wall protects player',()=>{
 for(const wall of [false,true]){
  const e=start();e.fixture_player(136,168,2);e.fixture_enemy(0,2,196,168);
  if(wall)e.fixture_wall(10,10);
  tick(e,100);assert.equal(e.tj_state(8),wall?100:88);
 }
});
test('Inventory D: pickup once, ammo, use kit, metadata, invalid actions',()=>{
 const e=start();e.fixture_player(136,184,2);e.tj_input(16);e.tj_input(0);
 assert.equal(e.tj_state(6),6);assert.equal(e.tj_item_count(5),2);assert.equal(e.tj_state(21),5);
 e.tj_ack();e.tj_input(16);e.tj_input(0);assert.equal(e.tj_item_count(5),2);
 assert.equal(e.tj_use(5),0,'Full health does not waste a kit');
 e.fixture_hurt(50);assert.equal(e.tj_use(5),1);assert.equal(e.tj_state(8),85);assert.equal(e.tj_item_count(5),1);
 assert.equal(e.tj_use(5),1);assert.equal(e.tj_state(8),100);assert.equal(e.tj_item_count(5),0);
 assert.equal(e.tj_use(5),0);assert.equal(e.tj_use(6),0);assert.equal(e.tj_use(999),0);
 e.fixture_player(168,184,2);e.tj_input(16);e.tj_input(0);assert.equal(e.tj_item_count(4),20);e.tj_ack();
 assert.equal(e.tj_use(3),1);assert.equal(e.tj_state(13),2);assert.equal(e.tj_item_info(8,0),5);
 const ptr=e.tj_item_text(8,0),bytes=new Uint8Array(e.memory.buffer);
 assert.equal(new TextDecoder().decode(bytes.subarray(ptr,bytes.indexOf(0,ptr))),'chronicle-shard');
});
test('Combat A: windup, real arrows, swept collision, cooldown and finite ammo',()=>{
 const e=start();e.fixture_player(136,168,2);e.tj_equip(2);
 e.tj_input(32);e.tj_input(0);tick(e,14);
 assert.equal(e.tj_state(14),12);assert.equal(e.tj_projectile(0,0),0);
 tick(e,1);assert.equal(e.tj_state(14),11);assert.equal(e.tj_projectile(0,0),1);
 const x=e.tj_projectile(0,1);tick(e,2);assert(e.tj_projectile(0,1)>x);
 assert.equal(e.tj_equip(0),0,'Cannot skip cooldown by switching');
 tick(e,60);assert.equal(e.tj_projectile(0,0),0,'Limited range');
 e.fixture_wall(9,10);e.tj_input(32);tick(e,600);e.tj_input(0);
 assert.equal(e.tj_state(14),0);tick(e,100);assert.equal(e.tj_projectile(0,0),0);
 e.tj_input(32);tick(e,200);assert.equal(e.tj_state(14),0);
});
