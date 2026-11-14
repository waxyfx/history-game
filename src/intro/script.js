// TARIKH JOLY · кіріспе сценарийі мен раскадровкасы / сценарий и раскадровка вступления.
// Timings are absolute seconds from the start of the intro. Every line has kk + ru text.
// kind: speech | thought | shout | sys | caption | sfx | flash | title
// p: bubble centre in % of the stage, tip: where the tail points (speaker), w: max width in %.

export const CAST = {
 hero: {kk: 'Айбар', ru: 'Айбар'},
 villain: {kk: 'Зұлмат', ru: 'Зулмат'},
 sys: {kk: 'ЖҮЙЕ', ru: 'СИСТЕМА'},
};

export const SHOTS = [
 // ── 1. БОЛАШАҚ / БУДУЩЕЕ ─────────────────────────────────────────────
 {id: 'city', scene: 1, dur: 9, trans: 'black', lines: [
  {at: .8, end: 8.7, kind: 'caption', p: [20, 11], w: 30, kk: 'Болашақ. 2087 жыл.', ru: 'Будущее. 2087 год.'},
  {at: 3.2, end: 8.7, kind: 'caption', p: [26, 22], w: 40, kk: 'Алатау ғылым қаласы. Шежіре институты — уақытты зерттейтін орын.', ru: 'Научный город Алатау. Институт Шежире, где изучают время.'},
 ], sfx: [[0, 'cityAmb', 9.4], [3.4, 'flyby'], [6.6, 'flyby']]},
 {id: 'lab', scene: 1, dur: 10, trans: 'fade', lines: [
  {at: .4, end: 4.9, kind: 'caption', p: [24, 10], w: 40, kk: 'Институттың ең батыл жобасы — Уақыт қақпасы.', ru: 'Самый смелый проект института — Врата времени.'},
  {at: 2.8, end: 6.6, kind: 'sys', who: 'sys', p: [33, 23], tip: [27, 36], w: 30, kk: 'Қуат 40%. Қақпа тұрақты.', ru: 'Мощность 40%. Врата стабильны.'},
  {at: 5.4, end: 9.8, kind: 'speech', who: 'hero', p: [52, 22], tip: [33, 41], w: 34, kk: 'Тамаша. Бүгін тек бақылаймыз — тарихқа қол сұқпаймыз.', ru: 'Отлично. Сегодня только наблюдаем — в историю не вмешиваемся.'},
 ], sfx: [[0, 'hum', 75.5], [.5, 'typing'], [2.6, 'beep'], [3.6, 'typing']]},
 {id: 'chronicle', scene: 1, dur: 11, trans: 'fade', lines: [
  {at: .6, end: 5.2, kind: 'thought', who: 'hero', p: [27, 17], tip: [24, 40], w: 32, kk: 'Шежіре — даланың жады. Он дәуір, он парақ.', ru: 'Шежире — память степи. Десять эпох, десять страниц.'},
  {at: 5.4, end: 10.8, kind: 'caption', p: [70, 86], w: 50, kk: 'Айбар — жас шежіреші. Оның міндеті: тарихты өзгертпей, сақтау.', ru: 'Айбар — молодой летописец. Его долг — хранить историю, не изменяя её.'},
 ], sfx: [[.8, 'chime']]},

 // ── 2. АНТАГОНИСТ ────────────────────────────────────────────────────
 {id: 'alarm', scene: 2, dur: 9, trans: 'cut', lines: [
  {at: .6, end: 4, kind: 'sys', who: 'sys', p: [50, 12], w: 36, kk: 'Рұқсатсыз кіру!', ru: 'Несанкционированный доступ!'},
  {at: 4.8, end: 8.9, kind: 'shout', who: 'hero', p: [30, 20], tip: [22, 38], w: 34, kk: 'Профессор Зұлмат?! Сізге мұнда кіруге тыйым салынған!', ru: 'Профессор Зулмат?! Вам запрещено здесь находиться!'},
 ], sfx: [[.1, 'alarm', 7.8], [2.4, 'door'], [3.2, 'steps']]},
 {id: 'villain', scene: 2, dur: 9, trans: 'flash', lines: [
  {at: .4, end: 4.2, kind: 'speech', who: 'villain', p: [20, 16], tip: [42, 40], w: 30, kk: 'Тыйым? Бұл Қақпаны мен жасадым, Айбар.', ru: 'Запрещено? Эти Врата создал я, Айбар.'},
  {at: 4.4, end: 8.9, kind: 'speech', who: 'villain', p: [25, 74], tip: [45, 56], w: 32, kk: 'Тарих — жеңілістер мен қателердің тізбегі. Мен оны түзетемін.', ru: 'История — цепь поражений и ошибок. Я её исправлю.'},
 ], sfx: [[.1, 'sting']]},
 {id: 'standoff', scene: 2, dur: 9, trans: 'fade', lines: [
  {at: .4, end: 4.6, kind: 'speech', who: 'villain', p: [72, 13], tip: [67, 30], w: 34, kk: 'Шежірені қайта жазамын. Өткенін ұмытқан халықты басқару оңай.', ru: 'Я перепишу Шежире. Народом, забывшим прошлое, легко управлять.'},
  {at: 4.8, end: 8.9, kind: 'shout', who: 'hero', p: [28, 14], tip: [33, 31], w: 34, kk: 'Өткенін білмеген болашағын да білмейді! Мен жол бермеймін.', ru: 'Кто не знает прошлого, не знает и будущего! Я вас не пропущу.'},
 ]},

 // ── 3. ҚАҚТЫҒЫС / ПРОТИВОСТОЯНИЕ ────────────────────────────────────
 {id: 'key', scene: 3, dur: 5.5, trans: 'cut', lines: [
  {at: .6, end: 1.9, kind: 'sfx', p: [62, 30], rot: -8, kk: 'ШЫРТ!', ru: 'ЩЁЛК!'},
  {at: 1.4, end: 5.4, kind: 'sys', who: 'sys', p: [70, 80], w: 34, kk: 'Қуат 100%… 140%… 180%…', ru: 'Мощность 100%… 140%… 180%…'},
 ], sfx: [[.6, 'click'], [1, 'powerUp']]},
 {id: 'struggle', scene: 3, dur: 14.5, trans: 'flash', lines: [
  {at: .3, end: 3.8, kind: 'shout', who: 'hero', p: [36, 12], tip: [30, 26], w: 22, kk: 'ТОҚТАҢЫЗ!', ru: 'СТОЙТЕ!'},
  {at: 4.3, end: 5.6, kind: 'sfx', p: [52, 40], rot: 10, kk: 'ДҮҢК!', ru: 'БДЫЩ!'},
  {at: 5.1, end: 8.4, kind: 'speech', who: 'villain', p: [78, 34], tip: [66, 44], w: 24, kk: 'Кеш қалдың, бала!', ru: 'Поздно, мальчишка!'},
  {at: 8.8, end: 10.2, kind: 'sfx', p: [30, 70], rot: -12, kk: 'ГҮРС!', ru: 'БАХ!'},
  {at: 10, end: 14.3, kind: 'sys', who: 'sys', p: [70, 70], w: 34, kk: 'Қорғаныс құлпы бұзылды!', ru: 'Защитная блокировка сломана!'},
 ], sfx: [[.1, 'whoosh'], [4.3, 'punch'], [4.9, 'punch'], [8.8, 'crash'], [9, 'sparks'], [9.6, 'alarm', 4.6]]},
 {id: 'tear', scene: 3, dur: 8, trans: 'cut', lines: [
  {at: .3, end: 1.8, kind: 'sfx', p: [50, 24], rot: -6, kk: 'ЖЫРТ!', ru: 'ТРРРЕСК!'},
  {at: 1.2, end: 4.4, kind: 'speech', who: 'hero', p: [20, 76], tip: [2, 92], w: 28, kk: 'Жоқ… Шежіренің парақтары!', ru: 'Нет… страницы Шежире!'},
  {at: 4.6, end: 7.9, kind: 'speech', who: 'villain', p: [78, 72], tip: [98, 92], w: 28, kk: 'Енді тарих — менің қолымда!', ru: 'Теперь история — в моих руках!'},
 ], sfx: [[.3, 'tear'], [.6, 'pages'], [7.4, 'boom']]},

 // ── 4. УАҚЫТ ҚАҚПАСЫ / МАШИНА ВРЕМЕНИ ────────────────────────────────
 {id: 'overload', scene: 4, dur: 12, trans: 'flash', lines: [
  {at: .4, end: 4.4, kind: 'sys', who: 'sys', p: [50, 10], w: 44, kk: 'Қуат 250%! Уақыт жарығы ашылуда!', ru: 'Мощность 250%! Открывается временной разлом!'},
  {at: 1, end: 2.6, kind: 'sfx', p: [50, 44], rot: 4, kk: 'ГУ-У-У!', ru: 'ВУУУМ!'},
  {at: 4.6, end: 7.4, kind: 'shout', who: 'villain', p: [78, 24], tip: [68, 40], w: 26, kk: 'Не?! Қақпа… мені тартып жатыр!', ru: 'Что?! Врата… затягивают меня!'},
  {at: 7.6, end: 11.8, kind: 'shout', who: 'villain', p: [62, 82], tip: [56, 58], w: 38, kk: 'Менің көлеңкелерім сені тарихтың әр парағында күтеді!', ru: 'Мои тени будут ждать тебя на каждой странице истории!'},
 ], sfx: [[0, 'boom'], [.2, 'zaps', 11.6], [.2, 'rumble', 18.8], [3, 'glass'], [7.2, 'dissolve']]},
 {id: 'decision', scene: 4, dur: 6.5, trans: 'cut', lines: [
  {at: .4, end: 3.8, kind: 'thought', who: 'hero', p: [70, 20], tip: [52, 38], w: 34, kk: 'Парақтар он дәуірге шашырады… Оларды тек мен қайтара аламын.', ru: 'Страницы разлетелись по десяти эпохам… Вернуть их могу только я.'},
  {at: 4, end: 6.4, kind: 'shout', who: 'hero', p: [72, 70], tip: [54, 60], w: 26, kk: 'Мен оларды табамын!', ru: 'Я найду их!'},
 ], sfx: [[0, 'heart'], [1.1, 'heart'], [2.2, 'heart'], [5.9, 'whoosh']]},
 {id: 'tunnel', scene: 4, dur: 8.5, trans: 'flash', lines: [
  ...['Қазақ хандығы|Казахское ханство', 'Алтын Орда|Золотая Орда', 'Қарахан дәуірі|Эпоха Караханидов', 'Қарлұқтар|Карлуки', 'Түргештер|Тюргеши', 'Түрік қағанаты|Тюркский каганат', 'Ғұндар дәуірі|Эпоха гуннов', 'Сақтар әлемі|Мир саков', 'Қола дәуірі|Бронзовый век', 'Тас дәуірі|Каменный век']
   .map((pair, i) => {const [kk, ru] = pair.split('|'); return {at: .5 + i * .72, end: .5 + i * .72 + (i === 9 ? 1.6 : .62), kind: 'flash', p: [50, 50], kk, ru, big: i === 9};}),
 ], sfx: [[0, 'tunnel', 8.1], ...Array.from({length: 10}, (_, i) => [.5 + i * .72, 'swish']), [8.1, 'flashBoom']]},

 // ── 5. ЕЖЕЛГІ ҚАЗАҚСТАН / ДРЕВНИЙ КАЗАХСТАН ─────────────────────────
 {id: 'wake', scene: 5, dur: 6, trans: 'white', lines: [
  {at: 1.2, end: 5.8, kind: 'thought', who: 'hero', p: [50, 78], w: 34, kk: 'Жел… Тыныштық… Мен қайдамын?', ru: 'Ветер… Тишина… Где я?'},
 ], sfx: [[0, 'wind', 36], [3.4, 'eagle']]},
 {id: 'steppe', scene: 5, dur: 13, trans: 'fade', lines: [
  {at: .6, end: 5.6, kind: 'caption', p: [26, 11], w: 42, kk: 'Тас дәуірі. Болашақ Қазақстанның ұлан-байтақ даласы.', ru: 'Каменный век. Бескрайняя степь будущего Казахстана.'},
  {at: 5.4, end: 9.2, kind: 'sys', who: 'sys', p: [30, 26], tip: [21, 60], w: 34, kk: 'Дәуір — тас ғасыры. Нақты кезең анықталмады.', ru: 'Эпоха — каменный век. Точный период не определён.'},
  {at: 9.4, end: 12.9, kind: 'speech', who: 'hero', p: [36, 30], tip: [22, 52], w: 28, kk: 'Түтін… Жақын жерде адамдар бар.', ru: 'Дым… Где-то рядом есть люди.'},
 ], sfx: [[1, 'gallop', 5.5], [7, 'eagle']]},
 {id: 'tool', scene: 5, dur: 8, trans: 'fade', lines: [
  {at: .4, end: 3.8, kind: 'speech', who: 'hero', p: [30, 16], tip: [24, 30], w: 30, kk: 'Тас құрал… Жиегі әлі өткір.', ru: 'Каменное орудие… Край ещё острый.'},
  {at: 4, end: 7.9, kind: 'speech', who: 'hero', p: [80, 18], tip: [70, 36], w: 30, kk: 'Ал анау жарық… Шежіренің алғашқы парағы!', ru: 'А тот свет… первая страница Шежире!'},
 ], sfx: [[.6, 'stone'], [4.2, 'chime']]},

 // ── 6. ОЙЫН БАСТАЛАДЫ / НАЧАЛО ИГРЫ ─────────────────────────────────
 {id: 'handoff', scene: 6, dur: 9, trans: 'fade', lines: [
  {at: .4, end: 5.2, kind: 'caption', p: [50, 13], w: 56, kk: 'Шежірешілер лагері — дәуірлер арасындағы баспана. Алғашқы із сонда басталады.', ru: 'Лагерь летописцев — приют между эпохами. Первый след начинается там.'},
  {at: 5.3, end: 9, kind: 'title', p: [50, 46], kk: '1-деңгей · Алғашқы іздер', ru: 'Уровень 1 · Первые следы', subKk: 'Тас дәуірі', subRu: 'Каменный век'},
 ]},
];

export const TOTAL = SHOTS.reduce((sum, s) => sum + s.dur, 0);

// Absolute start times; lines and cues are converted from shot-local to absolute here.
let start = 0;
for (const shot of SHOTS) {
 shot.start = start;
 for (const line of shot.lines) {line.t0 = start + line.at; line.t1 = start + line.end; line.shot = shot.id;}
 shot.cues = (shot.sfx || []).map(([at, name, dur]) => ({t: start + at, name, dur}));
 start += shot.dur;
}
export const LINES = SHOTS.flatMap(s => s.lines);
export const SCENE_TITLES = {
 1: {kk: 'Болашақ', ru: 'Будущее'}, 2: {kk: 'Зұлмат', ru: 'Антагонист'}, 3: {kk: 'Қақтығыс', ru: 'Противостояние'},
 4: {kk: 'Уақыт қақпасы', ru: 'Машина времени'}, 5: {kk: 'Ежелгі дала', ru: 'Древний Казахстан'}, 6: {kk: 'Ойын басталады', ru: 'Начало игры'},
};

// Optional recorded voice-over: drop files at /intro/voice/<lang>/<line-id>.mp3 and list the ids here.
// Without recordings, the player falls back to subtle synthesized "voice blips" while text types.
export const VOICE_FILES = {kk: [], ru: []};
LINES.forEach((line, i) => {line.id = `${line.shot}-${i}`;});
