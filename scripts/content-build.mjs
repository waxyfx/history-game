import {writeFile,mkdir} from 'node:fs/promises';import {epochs} from '../src/content.js';import {answers} from './answers.mjs';
await mkdir('public/data',{recursive:true});
await writeFile('public/data/practice-answers.json',JSON.stringify(answers));
const quote=s=>"'"+String(s).replaceAll("'","''")+"'";
const sql=epochs.map(e=>`insert into private.questions(id,level,accepted,explanation) values (${quote(e.id)},${e.index},${quote(JSON.stringify(answers[e.id]))}::jsonb,${quote(e.explanation)}) on conflict(id) do update set accepted=excluded.accepted, explanation=excluded.explanation;`).join('\n');
await writeFile('supabase/migrations/002_content.sql',sql+'\n');
