import fs from 'node:fs';
import create from '../public/engine/doom.js';
const get=n=>fs.readFileSync(new URL('../public/engine/'+n,import.meta.url));
const m=await create({wasmBinary:get('doom.wasm'),preRun:[m=>{for(const n of ['freedoom2.wad','tarikh.wad'])m.FS.writeFile('/'+n,get(n))}],print:console.log,printErr:console.error});
for(let n=1;n<=10;n++){
 m._th_level(n); for(let t=0;t<12;t++)m._th_tick();
 const x=m._th_x();m._th_key(119,1);for(let t=0;t<12;t++)m._th_tick();m._th_key(119,0);
 if(m._th_x()<=x||m._th_health()<=0)throw Error('Map '+n+' movement failed '+x+'/'+m._th_x());
 console.log('MAP',n,'movement',x,'=>',m._th_x(),'health',m._th_health());
}
