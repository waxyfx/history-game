// One-time mechanical migration of the original compact UI source.
import {readFile,writeFile} from 'node:fs/promises';
let s=await readFile('src/main.js','utf8');
function replace(a,b){if(!s.includes(a))throw Error('Missing target: '+a.slice(0,80));s=s.replace(a,b);}
replace('Бірінші дұрыс жауап — 100 ұпай. Қайталау және көмек ұпай қоспайды.','Бірінші талпыныста — 100, екіншісінде — 60, үшіншісінде және одан кейін — 30 ұпай. Ұпай тек алғаш дұрыс жауап бергенде қосылады. Емші көмегі ұпай қоспайды.');
replace("if(fresh)showModal(`", "showModal(`");
replace('<div class="eyebrow">МИССИЯ 01</div><h2>Алғашқы жоғалған парақ</h2>', '<div class="eyebrow">ДӘУІР ${progress.level} / 10</div><h2>${epochs[progress.level-1].title}</h2><p><b>Өту шарты: міндетті тапсырма дұрыс орындалуы және жалпы ұпай кемінде ${thresholds[progress.level-1]} болуы керек.</b> Қазір: ${progress.score}. Бұл — ойын басынан жиналған ұпай.</p><p>Бірінші талпыныс: 100 · екінші: 60 · үшінші және кейінгі: 30. Әр тапсырмаға ұпай бір рет беріледі.</p>');
replace("$('#score').textContent=`${progress.score} ұпай`", "$('#score').textContent=`${progress.score} / ${thresholds[progress.level-1]} ұпай`");
replace("function interact(){", "async function interact(){");
replace("if(!running||paused)return;const [x,y]=target();", "if(!running||paused||busy)return;const [x,y]=target();");
replace("else study(progress.stage==='fragment');", "else if(progress.stage==='fragment'){busy=true;paused=true;clearInput();try{if(mode==='online')adoptRun(await durableAction('branch-'+progress.level,'v2_complete_branch',{p_run:progress.id,p_question:epochs[progress.level-1].id}));else progress.stage='repair';save();updateHUD();study(true);}catch(e){toast(safeError(e));paused=false;}finally{busy=false;}}else study(progress.stage==='repair');");
replace("const e=epochs[progress.level-1],q=e.question;let value=", "const e=epochs[progress.level-1],q=e.question;const attempt=(progress.answers[e.id]?.attempts||0)+1;let value=");
replace("phase==='repair'?'ДЕРЕКТІ ТҮЗЕТУ · ҰПАЙ ҚОСЫЛМАЙДЫ'", "phase==='repair'?`ҚАЙТА ТАЛПЫНЫС ${attempt} · ${reward(attempt)} ҰПАЙ`");
replace('<h2>${q.prompt}</h2>${body}', '<h2>${q.prompt}</h2>${phase!==\'rescue\'?`<p class="notice">${attempt}-талпыныс · дұрыс жауап үшін ${reward(attempt)} ұпай. Қате жауаптан кейінгі сыйақы: ${reward(attempt+1)}. Бұрын берілген ұпай қайта есептелмейді.</p>`:\'\'}${body}');
replace("response=await rpc('submit_answer',{p_session:room.id,p_question:e.id,p_answer:value,p_phase:phase});", "response=await durableAction('answer-'+e.id+'-'+phase,'v2_submit_answer',{p_run:progress.id,p_question:e.id,p_answer:value,p_phase:phase});");
replace("progress=answerProgress(progress,e.id,response.correct,phase);if(mode==='online')progress.score=response.score;", "if(mode==='online')adoptRun(response.run);else progress=answerProgress(progress,e.id,response.correct,phase);");
replace('<p>${esc(response.explanation)}</p>', '<p>${esc(response.explanation)}</p>${phase!==\'rescue\'?`<p>Жалпы ұпай: ${progress.score} · қажетті ұпай: ${thresholds[progress.level-1]}. ${response.correct?`Тапсырма сыйақысы: ${progress.answers[e.id]?.awarded||0}.`:`Келесі дұрыс жауап: ${reward((progress.answers[e.id]?.attempts||0)+1)} ұпай.`}</p>`:\'\'}');
const start=s.indexOf('async function finishLevel()'),end=s.indexOf('function pauseMenu()',start);
if(start<0||end<0)throw Error('finish block missing');
s=s.slice(0,start)+`async function finishLevel(){if(busy)return;busy=true;paused=true;clearInput();try{
 const level=progress.level;
 if(mode==='online'){const result=await durableAction('finish-'+level,'v2_finish_level',{p_run:progress.id,p_level:level});adoptRun(result.run);}
 else progress=finishProgress(progress,epochs[level-1].id);
 save();running=false;
 if(progress.status==='failed'){archivePractice();showModal(\`<div class="eyebrow">ТАЛПЫНЫС АЯҚТАЛДЫ</div><h2>Өту ұпайы жеткіліксіз.</h2><p>Міндетті тапсырма дұрыс орындалды, бірақ жалпы ұпай: \$\{progress.score\}; қажетті ұпай: \$\{thresholds[level-1]\}. Нәтиже тарихта сақталды. Жаңа ойын бірінші дәуірден, 0 ұпай және 3 өмірмен басталады.</p>\$\{btn('Бірінші дәуірден қайта бастау',mode==='online'?'ranked':'new','primary')\}\$\{btn('Нәтижелер тарихы','results','outline')\}\`,{closable:false});return;}
 if(progress.status==='finished')archivePractice();
 showModal(\`<div class="eyebrow">ШЕЖІРЕ ПАРАҒЫ ТАБЫЛДЫ</div><h2>\$\{progress.level>10?'Он дәуірдің жолы жалғанды.':'Келесі дәуір сені күтеді.'\}</h2><p>Міндетті тапсырма орындалды. \$\{progress.score\} ≥ \$\{thresholds[level-1]\} ұпай.</p>\$\{btn(progress.level>10?'Нәтижені көру':'Келесі дәуірге өту',progress.level>10?'results':'next','primary')\}\`,{closable:false});
 }catch(e){toast(safeError(e));paused=false;}finally{busy=false;}}
` .replaceAll('\\$','$')+s.slice(end);
replace("${progress.level>10?'Шежіре қалпына келді.':'Саяхатың жалғасады.'}","${progress.status==='failed'?'Талпыныс аяқталды.':progress.level>10?'Шежіре қалпына келді.':'Саяхатың жалғасады.'}");
replace("${progress.level<=10?btn('Жалғастыру',mode==='practice'?'continue':'next','primary'):''}","${progress.status==='failed'?btn('Бірінші дәуірден қайта бастау',mode==='practice'?'new':'ranked','primary'):progress.level<=10?btn('Жалғастыру',mode==='practice'?'continue':'next','primary'):''}");
replace('<h2>Қателерден үйрен</h2>', '<h2>Талпыныстар тарихы</h2>${mode===\'practice\'?JSON.parse(localStorage.getItem(\'tarikh.history\')||\'[]\').map(p=>`<p class="review">${new Date(p.endedAt).toLocaleString(\'kk-KZ\')} · ${p.score} ұпай · ${Math.min(p.level,10)}-дәуір · ${p.status===\'failed\'?\'ұпай жеткіліксіз\':p.status===\'finished\'?\'аяқталды\':\'тоқтатылды\'}</p>`).join(\'\'):\'<p>Толық тарих жеке кабинетте сақталады.</p>\'}<h2>Қателерден үйрен</h2>');
replace("rpc('room_state'", "rpc('v2_room_state'");
const ra=s.indexOf('async function ranked()'),rb=s.indexOf('async function profile()',ra);
s=s.slice(0,ra)+`async function ranked(){try{mode='online';progress={...newProgress(),...await rpc('v2_start_run',{p_session:room.id})};await startGame();}catch(e){toast(safeError(e));}}
`+s.slice(rb);
replace("db.from('attempts').select('*')", "db.from('game_runs').select('*').order('started_at',{ascending:false})");
replace("${a.phase==='finished'?'Аяқталды':'Жалғасуда'}", "${a.status==='finished'?'Аяқталды':a.status==='failed'?'Ұпай жеткіліксіз':'Жалғасуда'}");
await writeFile('src/main.js',s);
