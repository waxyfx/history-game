import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const binary=await readFile(new URL('../public/engine/rpg/tarikh-rpg.wasm',import.meta.url));
const module=await WebAssembly.compile(binary);
const UP=1, DOWN=2, LEFT=4, RIGHT=8, INTERACT=16;
function start() {
    const e=new WebAssembly.Instance(module,{}).exports;
    e._initialize?.();
    e.tj_init();
    return e;
}
function position(e) { return [e.tj_state(0)/1000,e.tj_state(1)/1000]; }
function tick(e,count=1) { for(let i=0;i<count;i++)e.tj_tick(); }
function move(e,keys,count) { e.tj_input(keys);tick(e,count);e.tj_input(0); }
function frame(e) {
    e.tj_render();
    return new Uint8Array(e.memory.buffer,e.tj_pixels(),480*320*4).slice();
}
function enterTransition(e,keys) {
    e.tj_input(keys);
    for(let i=0;i<500&&!e.tj_state(5);i++)e.tj_tick();
    e.tj_input(0);
    assert.equal(e.tj_state(5),24,'Walking through the zone exit starts a fade');
}

test('RPG WASM: standalone module renders an opaque, varied RGBA framebuffer',()=>{
    assert.deepEqual(WebAssembly.Module.imports(module),[]);
    const e=start(),pixels=frame(e);
    assert.equal(e.tj_state(11),480);assert.equal(e.tj_state(12),320);
    assert.equal(e.memory.buffer.byteLength,2097152);
    for(let i=3;i<pixels.length;i+=4)assert.equal(pixels[i],255);
    assert(new Set(new Uint32Array(pixels.buffer)).size>40,'Terrain, sprites and blended shadows have distinct colors');
    assert.equal(e.tj_state(7),1);
    assert.equal(e.tj_tile(-1,0,0),-1);
});

test('RPG WASM: all eight headings move with equal speed',()=>{
    const directions=[[UP,0,0,-1],[UP|RIGHT,1,1,-1],[RIGHT,2,1,0],
        [DOWN|RIGHT,3,1,1],[DOWN,4,0,1],[DOWN|LEFT,5,-1,1],
        [LEFT,6,-1,0],[UP|LEFT,7,-1,-1]];
    for(const [keys,facing,sx,sy] of directions) {
        const e=start(),[x,y]=position(e);
        move(e,keys,10);
        const [nx,ny]=position(e);
        assert.equal(Math.sign(nx-x),sx);assert.equal(Math.sign(ny-y),sy);
        assert.equal(e.tj_state(3),facing);
        assert(Math.abs(Math.hypot(nx-x,ny-y)-15)<0.003,'Diagonal movement must be normalized');
    }
    const e=start(),before=position(e);
    move(e,UP|DOWN|LEFT|RIGHT,60);
    assert.deepEqual(position(e),before,'Opposite directions cancel');
});

test('RPG WASM: machine, river and outer wall block movement; bridge permits crossing',()=>{
    const e=start();
    move(e,UP,120);
    const [x,y]=position(e);
    assert.equal(x,104);assert(y>=131&&y<133,'Feet stop outside the machine collider');
    assert.equal(e.tj_tile(0,6,7),1);
    move(e,UP,120);assert.deepEqual(position(e),[x,y]);
    e.tj_init();
    move(e,RIGHT,139); // x=312.5, in the river crossing.
    assert(position(e)[0]>312);
    assert.equal(e.tj_tile(0,19,10),0,'Bridge is traversable');
    assert.equal(e.tj_tile(0,19,8),1,'Water is solid');
    move(e,UP,120);
    assert(position(e)[1]>=147&&position(e)[1]<149,'Player cannot walk from bridge into river');
    e.tj_init();
    move(e,LEFT,120);
    const edge=position(e);
    assert(edge[0]>=20&&edge[0]<22);
    move(e,LEFT,120);assert.deepEqual(position(e),edge,'Closed map border is solid');
    assert.equal(e.tj_state(2),0);
});

test('RPG WASM: pause and dialogue freeze simulation and clear movement on resume',()=>{
    const e=start();
    e.tj_input(RIGHT);e.tj_pause(1);
    const before=position(e),time=e.tj_state(10);
    tick(e,100);assert.deepEqual(position(e),before);assert.equal(e.tj_state(10),time);
    e.tj_input(DOWN);e.tj_pause(0);tick(e,10);
    assert.deepEqual(position(e),before,'Paused input cannot remain held after resume');
    move(e,UP,14);e.tj_input(INTERACT);
    assert.equal(e.tj_state(6),1,'Machine interaction emits its event near the machine');
    const atMachine=position(e),dialogTime=e.tj_state(10);
    e.tj_input(RIGHT);tick(e,100);
    assert.deepEqual(position(e),atMachine);assert.equal(e.tj_state(10),dialogTime);
    e.tj_ack();tick(e,10);
    assert.equal(e.tj_state(6),0);assert.deepEqual(position(e),atMachine);
    move(e,RIGHT,10);assert(position(e)[0]>atMachine[0]);
});

test('RPG WASM: two fixed screens transition both ways with safe spawn and NPC interaction',()=>{
    const e=start();
    enterTransition(e,RIGHT);
    tick(e,11);assert.equal(e.tj_state(2),0);
    tick(e);assert.equal(e.tj_state(2),1);assert.deepEqual(position(e),[24,168]);
    assert.equal(e.tj_state(7),3);
    const black=frame(e);
    for(let i=0;i<black.length;i+=4)assert.deepEqual([...black.subarray(i,i+4)],[16,30,34,255]);
    tick(e,12);assert.equal(e.tj_state(5),0);
    move(e,RIGHT,107);e.tj_input(INTERACT);
    assert.equal(e.tj_state(6),2,'Camp guide is reachable through the main route');
    e.tj_ack();
    enterTransition(e,LEFT);tick(e,12);
    assert.equal(e.tj_state(2),0);assert.deepEqual(position(e),[456,168]);
    tick(e,12);tick(e,120);
    assert.equal(e.tj_state(5),0,'Spawn does not immediately trigger a return transition');
    assert.equal(e.tj_tile(0,28,10),0);
});

test('RPG WASM: walking and idle frames animate while terrain remains fixed',()=>{
    const e=start(),initial=frame(e);
    move(e,RIGHT,7);
    assert.equal(e.tj_state(4),7);
    const walking=frame(e);
    assert.notDeepEqual(walking,initial);
    // A dry terrain patch away from any moving sprite does not scroll.
    for(let y=45;y<55;y++)for(let x=100;x<110;x++) {
        const offset=(y*480+x)*4;
        assert.deepEqual(walking.subarray(offset,offset+4),initial.subarray(offset,offset+4));
    }
    tick(e);assert.equal(e.tj_state(4),0,'Released input returns to idle');
    const idle=frame(e),[x,y]=position(e);
    tick(e,40);const nextIdle=frame(e);
    const beacon=((Math.floor(y)-11)*480+Math.floor(x)+4)*4;
    assert.notDeepEqual(idle.subarray(beacon,beacon+4),nextIdle.subarray(beacon,beacon+4));
    assert.deepEqual(position(e),[x,y]);
});
