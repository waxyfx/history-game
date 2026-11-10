import {spawnSync} from 'node:child_process';import {mkdir,copyFile} from 'node:fs/promises';
await mkdir('dist/licenses',{recursive:true});
for(const n of ['DOOM-GPL.txt','FREEDOOM.txt','ASSETS.md'])await copyFile('public/licenses/'+n,'dist/licenses/'+n);
const r=spawnSync(process.env.PYTHON || 'python',['scripts/source-bundle.py'],{stdio:'inherit'});if(r.error)throw r.error;if(r.status)process.exit(r.status);
