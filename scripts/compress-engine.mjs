import {gzipSync} from 'node:zlib';
import {readFile,writeFile} from 'node:fs/promises';
const manifest={};
for(const name of ['freedoom2.wad','tarikh.wad','doom.wasm']){
 const raw=await readFile('public/engine/'+name);
 const zip=gzipSync(raw,{level:9});
 await writeFile('public/engine/'+name+'.pack',zip);
 manifest[name]={raw:raw.length,compressed:zip.length};
}
await writeFile('src/resource-sizes.json',JSON.stringify(manifest));
