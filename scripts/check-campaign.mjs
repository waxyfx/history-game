import {spawn} from 'node:child_process';
import {mkdtemp,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';
const names=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'];
const base=process.argv[2]||'http://127.0.0.1:5176';
async function check(exe){
 const profile=await mkdtemp(join(tmpdir(),'tarikh-device-'));
 const child=spawn(exe,['--headless=new','--remote-debugging-port=0','--user-data-dir='+profile,'--no-first-run','--disable-background-networking','about:blank'],{stdio:'ignore',windowsHide:true});
 let ws;
 try{
  let port;
  for(let i=0;i<100&&!port;i++){try{port=(await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];}catch{await delay(100);}}
  assert(port,'Browser launch failed');
  const target=(await (await fetch('http://localhost:'+port+'/json/list')).json()).find(t=>t.type==='page');
  ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);
  let id=0;const pending=new Map();ws.onmessage=e=>{const msg=JSON.parse(e.data);if(pending.has(msg.id)){pending.get(msg.id)(msg);pending.delete(msg.id);}};
  async function call(method,params={}){const n=++id;const response=new Promise(r=>pending.set(n,r));ws.send(JSON.stringify({id:n,method,params}));const msg=await response;if(msg.error)throw Error(msg.error.message);return msg.result;}
  async function js(expression){const res=await call('Runtime.evaluate',{expression,returnByValue:true});if(res.exceptionDetails)throw Error(res.exceptionDetails.text);return res.result.value;}
  async function wait(expression){for(let i=0;i<100;i++){if(await js(expression))return;await delay(90);}throw Error('Timed out: '+expression);}
  const click=async sel=>{const el='document.querySelector('+JSON.stringify(sel)+')';await wait(el+'!=null');await js(el+'.click()');};
  const scenario=process.argv[3]||'direct';
  const {answers}=await import('./answers.mjs');
  const {epochs}=await import('../src/content.js');
  const pos=()=>js('[...document.querySelectorAll("#map-player")].map(c=>[+c.getAttribute("cx"),1024-c.getAttribute("cy")])[0]');
  const press=async(code,key,ms)=>{
   const event={code,key,windowsVirtualKeyCode:key.toUpperCase().charCodeAt(0)};
   await call('Input.dispatchKeyEvent',{type:'keyDown',...event});await delay(ms);await call('Input.dispatchKeyEvent',{type:'keyUp',...event});
  };
  async function walk(x,y){
   for(let i=0;i<35;i++){
    const [a,b]=await pos(),dx=x-a,dy=y-b;
    if(Math.hypot(dx,dy)<43)return;
    const horizontal=(x>960&&a<970&&Math.abs(512-b)>32)?false:Math.abs(dx)>Math.abs(dy),delta=horizontal?dx:dy,k=horizontal?(dx>0?'w':'s'):(dy>0?'a':'d');
    await press('Key'+k.toUpperCase(),k,Math.min(1350,Math.max(110,(Math.abs(delta)-32)*3.1)));
    await delay(150);
    if(await js('document.querySelector("#modal h2")?.textContent.includes("Бір өмір жоғалды")')){await click('#modal [data-act="close"]');continue;}if(await js('!!document.querySelector("#modal")'))throw Error('While walking: '+await js('document.querySelector("#modal").innerText'));
   }
   throw Error('Cannot reach '+[x,y]+' from '+await pos());
  }
  async function use(){await press('KeyE','e',35);}
  async function answer(n,wrong=false){
   const e=epochs[n-1],q=e.question,ok=answers[e.id][0];
   if(['choice','map','artifact'].includes(q.type)){
    const index=q.options.findIndex(o=>wrong?o!==ok:o===ok);
    await click('[data-option="'+index+'"]');
   }else if(q.type==='fill'){await js('document.querySelector("#fill-answer").focus()');await call('Input.insertText',{text:wrong?'қате':ok});}
   else if(q.type==='order'){
    for(let j=0;j<ok.length;j++){
     const arr=await js('[...document.querySelectorAll(".order-row strong")].map(x=>x.textContent)');
     for(let k=arr.indexOf(ok[j]);k>j;k--)await click('[data-up="'+k+'"]');
    }
   }else{for(let i=0;i<ok.length;i++)await js('(()=>{const s=document.querySelectorAll("[data-match]")['+i+'];s.value='+JSON.stringify(ok[i])+';s.dispatchEvent(new Event("change"));})()');}
   await click('#submit-answer');await click('#feedback-next');
  }
  await call('Emulation.setDeviceMetricsOverride',{width:1280,height:800,deviceScaleFactor:1,mobile:false});
  await call('Page.navigate',{url:base});await click('[data-act="choose"]');await click('[data-act="new"]');
  for(let n=1;n<=(scenario==='fail'?3:10);n++){
   await click('#modal [data-act="close"]');await delay(180);
   await walk(...(n===1?[735,540]:[350,512]));await use();await click('#begin-question');
   const misses=scenario==='fail'?2:(scenario==='alternate'&&n===1?1:0);
   for(let j=0;j<misses;j++){
    await answer(n,true);await walk(...(n===1?[425,775]:[145,770]));await use();await click('#begin-question');
   }
   await answer(n);
   if(scenario==='combat'){
    const hits=()=>js('document.querySelector("#lives").dataset.attackers');
    for(let life=3;life>0;life--){
     if(life===3){
      await press('KeyW','w',1200);
      await press('KeyA','a',1100);
      await delay(500);
      await press('Space',' ',350);
      await press('KeyQ','q',50);
      await press('Space',' ',350);
     }else{
      await press('KeyW','w',4200);
      await press('Space',' ',350);
     }
     for(let i=0;i<600;i++){
      if(await js('!!document.querySelector("#modal")'))break;
      await delay(100);
     }
     console.log('encounter',life,'enemy damage mask',await hits());
     if(life>1){await wait('document.querySelector("#modal h2")?.textContent.includes("Бір өмір жоғалды")');await click('#modal [data-act="close"]');}
    }
    assert.equal(await hits(),'7','Барлық үш қарсылас (садақшы, қылышшы, найзашы) соққы жасауы тиіс');
    await wait('document.querySelector("#modal")?.innerText.includes("ЕМШІ КӨМЕГІ")');
    await answer(1,true);await wait('document.querySelector("#modal")?.innerText.includes("ЕМШІ КӨМЕГІ")');await answer(1);
    assert.equal(await js('document.querySelector("#lives").textContent'),'♥♡♡');assert.equal(await js('document.querySelector("#score").textContent'),'100 / 30 ұпай');
    console.log('rescue passed after incorrect and correct replies; no extra score. attackers',await hits());break;
   }
   if(n!==1||misses){await walk(n===1?650:340,600);await walk(n===1?810:700,600);if(n===1)await walk(815,515);}
   await walk(1360,512);await use();
   if(n===3&&scenario==='fail'){
    await wait('document.querySelector("#modal")?.innerText.includes("Өту ұпайы жеткіліксіз")');
    await click('#modal [data-act="new"]');await wait('document.querySelector("#score")?.textContent.includes("0 / 30")');
    assert.equal(await js('document.querySelector("#lives").textContent'),'♥♥♥');console.log('failed with 90/100; restarted 0 points, 3 lives');break;
   }
   await wait('document.querySelector("#modal")?.innerText.includes("Міндетті тапсырма орындалды")');
   console.log(scenario,n,qName(n),await js('document.querySelector("#modal p").textContent'));
   if(n<10)await click('#modal [data-act="next"]');
   if(scenario==='alternate'&&n===1){await wait('document.querySelector("#level-title")?.textContent.includes("Қола")');break;}
  }
  function qName(n){return epochs[n-1].question.type;}
 }finally{ws?.close();child.kill();}
}
await check(names[0]);
