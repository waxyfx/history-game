import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const mod=await WebAssembly.compile(await readFile(new URL('../public/engine/rpg/tarikh-rpg.wasm',import.meta.url)));
function start(){const e=new WebAssembly.Instance(mod,{}).exports;e._initialize?.();e.tj_init();return e;}
const tick=(e,n)=>{for(let i=0;i<n;i++)e.tj_tick();};
function save(e){const n=e.tj_save();assert(n>0);return new Uint32Array(e.memory.buffer,e.tj_save_buffer(),n/4).slice();}
function load(e,w){new Uint32Array(e.memory.buffer,e.tj_save_buffer(),w.length).set(w);return e.tj_load(w.byteLength);}
function checksum(w){let h=2166136261;for(let i=0;i<w.length;i++)if(i!==3)for(let s=0;s<32;s+=8){h=Math.imul(h^((w[i]>>>s)&255),16777619)>>>0;}w[3]=h;return w;}
test('Save E: C++ round trip preserves position, health, weapon, ammo, inventory, flags and dead enemies',()=>{
 const e=start();e.tj_input(8);tick(e,20);e.tj_input(0);e.tj_equip(2);
 // A validated save scenario represents previously collected/used progress.
 const w=save(e);w[7]=51;w[8]=2;w[12]=1;w[17]=1;w[16]=7;w[22]=0;w[31]=4;w[32]=3;
 assert.equal(load(e,checksum(w)),1);
 const restored=start();assert.equal(load(restored,save(e)),1);
 assert.deepEqual([...save(restored)],[...save(e)]);
 assert.equal(restored.tj_state(8),51);assert.equal(restored.tj_state(9),2);assert.equal(restored.tj_item_count(5),1);
 assert.equal(restored.tj_state(14),7);assert.equal(restored.tj_enemy(0,0),0);
});
test('Save E: corruption, invalid values and future versions are rejected atomically; v1 migrates',()=>{
 const e=start(),original=save(e);
 for(const mutate of [w=>w[0]=0,w=>w[4]=999999,w=>w[7]=101,w=>w[8]=0,w=>w[9]=3,w=>w[16]=1000,w=>w[22]=999,w=>w[4]=0,w=>w[6]=6]){
  const w=original.slice();mutate(w);assert.equal(load(e,checksum(w)),-1);assert.deepEqual([...save(e)],[...original]);
 }
 const bad=original.slice();bad[7]=1;assert.equal(load(e,bad),-1);
 const future=original.slice();future[1]=99;assert.equal(load(e,checksum(future)),-2);
 const legacy=original.slice(0,31);legacy[1]=1;legacy[2]=31;assert.equal(load(e,checksum(legacy)),2);assert.equal(save(e)[1],2);
 for(const length of [-1,0,3,15,10000])assert.equal(e.tj_load(length),-1);
});
test('Save E: unfinished attacks are not serialized; defeat remains defeat',()=>{
 const e=start();e.tj_input(32);e.tj_input(0);assert.equal(e.tj_save(),0);tick(e,40);const w=save(e);
 w[7]=0;w[8]=0;assert.equal(load(e,checksum(w)),1);assert.equal(e.tj_state(19),1);assert.equal(e.tj_state(6),5);
});
