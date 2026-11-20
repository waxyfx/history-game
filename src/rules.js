import {uuid} from './uuid.js';
export const normalize=s=>String(s).normalize('NFKC').trim().toLocaleLowerCase('kk').replace(/\s+/g,' ');
export function grade(value,accepted){return accepted.some(a=>Array.isArray(a)?Array.isArray(value)&&a.length===value.length&&a.every((v,i)=>normalize(v)===normalize(value[i])):!Array.isArray(value)&&normalize(a)===normalize(value));}
export const thresholds=[30,60,100,140,190,240,300,360,430,500];
export const reward=attempt=>attempt===1?100:attempt===2?60:30;
export function newProgress(){return {version:2,id:uuid(),status:'active',level:1,lives:3,score:0,stage:'study',answers:{},mistakes:[],activeSeconds:0,completed:[],character:0};}
// Browser storage is untrusted input. Validate before spreading it into game state
// or rendering scores/history as HTML; never use these local results for ranking.
export function validProgress(p){
 const integer=(n,min,max)=>Number.isInteger(n)&&n>=min&&n<=max;
 if(!p||p.version!==2||typeof p.id!=='string'||p.id.length>80||!['active','failed','finished'].includes(p.status))return false;
 if(!integer(p.level,1,11)||!integer(p.lives,0,3)||!integer(p.score,0,1100)||!integer(p.character,0,9))return false;
 if(!['study','fragment','repair','exit'].includes(p.stage)||!Number.isFinite(p.activeSeconds)||p.activeSeconds<0)return false;
 if((p.level===11)!==(p.status==='finished'))return false;
 if(!Array.isArray(p.completed)||p.completed.length!==p.level-1||!p.completed.every((v,i)=>v===i+1))return false;
 if(!Array.isArray(p.mistakes)||p.mistakes.length>10000||!p.mistakes.every(id=>typeof id==='string'&&id.length<=80))return false;
 if(!p.answers||typeof p.answers!=='object'||Array.isArray(p.answers)||Object.keys(p.answers).length>10)return false;
 return Object.entries(p.answers).every(([id,a])=>id.length<=80&&a&&typeof a.correct==='boolean'&&integer(a.attempts,1,1000000)&&integer(a.awarded,0,100)&&a.awarded===(a.correct?reward(a.attempts):0));
}
export function readHistory(raw){try{const list=JSON.parse(raw);return Array.isArray(list)?list.filter(p=>validProgress(p)&&typeof p.endedAt==='string'&&Number.isFinite(Date.parse(p.endedAt))).slice(-100):[];}catch{return [];}}
export function answerProgress(p,id,correct,phase='main'){
 const n=structuredClone(p);
 if(phase==='main'||phase==='repair'){
  if(n.status!=='active'||n.answers[id]?.correct||n.stage==='fragment')return n;
  const attempts=(n.answers[id]?.attempts||0)+1;
  const awarded=correct?reward(attempts):0;
  n.answers[id]={correct,attempts,awarded};n.score+=awarded;n.stage=correct?'exit':'fragment';
  if(!correct)n.mistakes.push(id);
 }else if(phase==='rescue'){n.lives=correct?1:0;}
 return n;
}
export function finishProgress(p,id){
 const n=structuredClone(p);
 if(n.status!=='active'||!n.answers[id]?.correct||n.stage!=='exit')throw Error('Алдымен міндетті тапсырманы дұрыс орында.');
 if(n.score<thresholds[n.level-1]){n.status='failed';return n;}
 n.completed.push(n.level);n.level++;n.stage='study';if(n.level>10)n.status='finished';return n;
}
export function teamRanking(members){return ['Көк бөрі','Алтын қыран'].map((team,i)=>{const m=members.filter(x=>x.team===i);return {team,count:m.length,score:m.reduce((s,x)=>s+(x.score||0),0)/Math.max(1,m.length)};});}
