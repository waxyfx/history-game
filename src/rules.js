import {uuid} from './uuid.js';
export const normalize=s=>String(s).normalize('NFKC').trim().toLocaleLowerCase('kk').replace(/\s+/g,' ');
export function grade(value,accepted){return accepted.some(a=>Array.isArray(a)?Array.isArray(value)&&a.length===value.length&&a.every((v,i)=>normalize(v)===normalize(value[i])):!Array.isArray(value)&&normalize(a)===normalize(value));}
export const thresholds=[30,60,100,140,190,240,300,360,430,500];
export const reward=attempt=>attempt===1?100:attempt===2?60:30;
export function newProgress(){return {version:2,id:uuid(),status:'active',level:1,lives:3,score:0,stage:'study',answers:{},mistakes:[],activeSeconds:0,completed:[],character:0};}
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
