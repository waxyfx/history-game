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
const names=['init','input','tick','render','pixels','pause','ack','state','tile','equip','projectile','enemy','item_count','item_info','item_text','use','save_buffer','save','load'].map(n=>'_tj_'+n);
const testing=process.argv.includes('--test');
if(testing){await mkdir('tests/fixtures',{recursive:true});names.push('_fixture_player','_fixture_arc','_fixture_wall','_fixture_enemy','_fixture_damage','_fixture_hurt');}
const args=[emcc,testing?'tests/rpg-fixture.cpp':'src/rpg/engine.cpp','-std=c++17','-O2','-Wall','-Wextra','-Werror',
    '--no-entry','-sSTANDALONE_WASM=1','-sFILESYSTEM=0','-sINITIAL_MEMORY=2097152',
    '-sSTACK_SIZE=65536','-sALLOW_MEMORY_GROWTH=0','-sEXPORTED_FUNCTIONS='+JSON.stringify(names),
    '-o',testing?'tests/fixtures/rpg-fixture.wasm':'public/engine/rpg/tarikh-rpg.wasm'];
const result=spawnSync(python,args,{stdio:'inherit',env:{...process.env,EM_CONFIG:process.env.EM_CONFIG||resolve(sdk,'.emscripten')}});
if(result.error)throw result.error;
if(result.status)process.exit(result.status);
console.log('Built '+(testing?'tests/fixtures/rpg-fixture.wasm':'public/engine/rpg/tarikh-rpg.wasm'));
