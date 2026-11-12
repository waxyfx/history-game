import {spawnSync} from 'node:child_process';
import {access, mkdir} from 'node:fs/promises';
import {resolve, join} from 'node:path';
import {existsSync} from 'node:fs';
const defaultSdk='C:/Users/serik/Desktop/тарих/tools/emsdk';
const sdk=process.env.EMSDK||(existsSync(defaultSdk)?defaultSdk:null);
if(!sdk)throw new Error('Set EMSDK to your existing Emscripten SDK directory. See docs/topdown.md.');
const python=process.env.PYTHON || (process.platform==='win32' ? join(sdk,'python','3.13.3_64bit','python.exe') : 'python3');
const emcc=process.env.EMCC || join(sdk,'upstream','emscripten','em++.py');
await access(emcc);
await mkdir('public/engine/rpg',{recursive:true});
const names=['init','atlas','atlas_size','atlas_ready','input','tick','render','pixels','pause','ack','event_count','event','events_clear',
  'state','tile','solid','equip','item_count','item_info','item_text','item_add','use','projectile','enemy','enemy_count','enemy_set','enemy_damage',
  'groups','group_alive_reset','hero','party','peer','peer_off','peer_arrow','damage','revive','respawn','checkpoint','heal','teleport','control',
  'cinematic','camera','shake','light','light_now','fog','torch','shadow','pose','face','walk_to','tag','ia','trigger_arm','npc','npc_set',
  'npc_goto','npc_routine','npc_flags','npc_face','spawn_fx','spawn_item','save_buffer','save','load'].map(n=>'_tj_'+n);
const testing=process.argv.includes('--test');
if(testing){await mkdir('tests/fixtures',{recursive:true});names.push('_fixture_player','_fixture_enemy','_fixture_hp','_fixture_arc');}
// 24 MiB fixed memory: 9 MiB sprite atlas + framebuffer, light buffer and map data.
const args=[emcc,testing?'tests/rpg-fixture.cpp':'src/rpg/engine.cpp','-std=c++17','-O2','-Wall','-Wextra','-Werror',
    '--no-entry','-sSTANDALONE_WASM=1','-sFILESYSTEM=0','-sINITIAL_MEMORY=25165824',
    '-sSTACK_SIZE=131072','-sALLOW_MEMORY_GROWTH=0','-sEXPORTED_FUNCTIONS='+JSON.stringify(names),
    '-o',testing?'tests/fixtures/rpg-fixture.wasm':'public/engine/rpg/tarikh-rpg.wasm'];
const result=spawnSync(python,args,{stdio:'inherit',env:{...process.env,EM_CONFIG:process.env.EM_CONFIG||resolve(sdk,'.emscripten')}});
if(result.error)throw result.error;
if(result.status)process.exit(result.status);
console.log('Built '+(testing?'tests/fixtures/rpg-fixture.wasm':'public/engine/rpg/tarikh-rpg.wasm'));
