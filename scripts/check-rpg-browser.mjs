import {spawn} from 'node:child_process';
import {access,mkdtemp,readFile,writeFile,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';

const base=process.argv[2]||'http://127.0.0.1:5173';
const candidates=process.env.BROWSER_EXE?[process.env.BROWSER_EXE]:[
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'];
let exe;
for(const candidate of candidates){try{await access(candidate);exe=candidate;break;}catch{}}
assert(exe,'Set BROWSER_EXE to an installed Chromium browser');
const profile=await mkdtemp(join(tmpdir(),'tarikh-rpg-'));
const child=spawn(exe,['--headless=new','--remote-debugging-port=0','--user-data-dir='+profile,'--no-first-run','--disable-background-networking','about:blank'],{stdio:'ignore',windowsHide:true});
let ws;
try{
  let port;
  for(let i=0;i<100&&!port;i++){try{port=(await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];}catch{await delay(100);}}
  assert(port,'Browser launch failed');
  const target=(await (await fetch('http://localhost:'+port+'/json/list')).json()).find(t=>t.type==='page');
  ws=new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
  let id=0;const pending=new Map(),errors=[];
  ws.onmessage=e=>{
    const msg=JSON.parse(e.data);
    if(msg.method==='Runtime.exceptionThrown')errors.push(msg.params.exceptionDetails.text);
    if(msg.method==='Runtime.consoleAPICalled'&&msg.params.type==='error')errors.push(JSON.stringify(msg.params.args));
    if(pending.has(msg.id)){pending.get(msg.id)(msg);pending.delete(msg.id);}
  };
  async function call(method,params={}){
    const n=++id;let timer;
    const response=new Promise((resolve,reject)=>{pending.set(n,resolve);timer=setTimeout(()=>{pending.delete(n);reject(new Error('CDP timeout: '+method));},15000);});
    ws.send(JSON.stringify({id:n,method,params}));
    try{const msg=await response;if(msg.error)throw Error(msg.error.message);return msg.result;}finally{clearTimeout(timer);}
  }
  async function js(expression){const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.text);return r.result.value;}
  async function wait(expression){for(let i=0;i<150;i++){if(await js(expression))return;await delay(100);}throw Error('Timed out: '+expression);}
  const key=(type,code,key)=>call('Input.dispatchKeyEvent',{type,code,key});
  const screenshot=async name=>{const r=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});await writeFile('test-results/'+name+'.png',Buffer.from(r.data,'base64'));};
  await mkdir('test-results',{recursive:true});
  await call('Runtime.enable');await call('Page.enable');
  await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await call('Page.navigate',{url:base+'/rpg.html'});
  await wait('document.querySelector("#pause")?.disabled===false');
  assert.equal(await js('document.querySelector("#zone").textContent'),'Апат орны');
  assert(await js('document.querySelector("#world").getContext("2d").getImageData(104,168,1,1).data[3]===255'));
  await screenshot('rpg-arrival');
  // Pause must freeze even terrain animation and must discard held inputs.
  await key('keyDown','Escape','Escape');await key('keyUp','Escape','Escape');
  await wait('document.querySelector("#dialog").open');
  const pausedFrame=await js('document.querySelector("#world").toDataURL()');
  await key('keyDown','KeyD','d');await delay(200);await key('keyUp','KeyD','d');
  assert.equal(await js('document.querySelector("#world").toDataURL()'),pausedFrame);
  await js('document.querySelector("#dialog-close").click()');
  await key('keyDown','KeyD','d');
  await wait('document.querySelector("#zone").textContent==="Ежелгі қоныс"');
  await key('keyUp','KeyD','d');await delay(300);
  assert.match(await js('document.querySelector("#discovered").textContent'),/02 \/ 0[26] АЙМАҚ/);
  await screenshot('rpg-camp');
  // A held east input reaches the NPC collider; E must open the C++ proximity event.
  await key('keyDown','KeyD','d');await delay(2600);await key('keyUp','KeyD','d');
  await key('keyDown','KeyE','e');await key('keyUp','KeyE','e');
  await wait('document.querySelector("#dialog").open');
  assert.equal(await js('document.querySelector("#dialog-title").textContent'),'Алғашқы байланыс');
  await screenshot('rpg-dialog');await js('document.querySelector("#dialog-close").click()');
  await key('keyDown','KeyA','a');await wait('document.querySelector("#zone").textContent==="Апат орны"');
  await key('keyUp','KeyA','a');await delay(300);
  await call('Emulation.setDeviceMetricsOverride',{width:834,height:1112,deviceScaleFactor:1,mobile:false});
  await delay(100);
  assert(await js('document.documentElement.scrollWidth<=innerWidth'));
  assert.equal(await js('parseInt(getComputedStyle(document.querySelector("#world")).width)%480'),0);
  await screenshot('rpg-tablet');
  assert.deepEqual(errors,[],'No browser runtime or console errors');
  console.log('PASS: WASM canvas, pause, keyboard input, both zone transitions, NPC dialog, tablet layout, integer scaling, no console errors.');
  console.log('Screenshots: test-results/rpg-{arrival,camp,dialog,tablet}.png');
}finally{ws?.close();child.kill();}
