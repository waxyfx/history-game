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
  const size=(width,height,mobile)=>call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile});
  await size(1366,768,false);await call('Network.enable');await call('Network.setBlockedURLs',{urls:['*tarikh.wad.pack*']});
  await call('Page.navigate',{url:base});await click('[data-act="choose"]');await click('[data-act="new"]');await wait('!!document.querySelector(\'[data-act="retry"]\')');
  await call('Network.setBlockedURLs',{urls:[]});await click('[data-act="retry"]');await click('#modal [data-act="close"]');await wait('!!document.querySelector("#map-player")?.getAttribute("cx")');
  await call('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});await size(390,844,true);
  const touch=(type,x,y)=>call('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x,y,id:1}]});
  await touch('touchStart',190,420);await touch('touchEnd');await wait('getComputedStyle(document.querySelector(".rotate")).display==="flex"');
  await size(844,390,true);await wait('getComputedStyle(document.querySelector(".rotate")).display==="none"');
  const rect=await js('(()=>{const r=document.querySelector("#joystick").getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]})()');
  const before=await js('document.querySelector("#map-player").getAttribute("cx")');
  await touch('touchStart',...rect);await touch('touchMove',rect[0],rect[1]-35);await delay(500);await touch('touchEnd');
  assert.notEqual(await js('document.querySelector("#map-player").getAttribute("cx")'),before);
  console.log(await js('navigator.userAgent'),': retry, desktop boot, portrait guard, landscape touch movement OK');
 }finally{ws?.close();child.kill();}
}
for(const exe of names)await check(exe);
