/* Guide scenes 5 to 9, animated with anime.js. Each one is a little moving picture instead of a chart. */
(function () {
'use strict';
const { $, $$, reduce } = DD;
const A = window.anime;
const hex = (r) => 'M' + [0, 1, 2, 3, 4, 5].map(i => [(r * Math.cos(i * Math.PI / 3 + .5)).toFixed(1), (r * Math.sin(i * Math.PI / 3 + .5)).toFixed(1)]).join('L') + 'Z';
const DROP = 'M0-11C7-1 8 4 0 10C-8 4-7-1 0-11Z';
const person = (x, y, i) => `<g class="person" data-i="${i}" transform="translate(${x} ${y})"><g class="pin"><circle cy="-16" r="8"/><path d="M-11 18V4a11 11 0 0 1 22 0v14Z"/></g></g>`;
const onSee = (el, fn) => { if (!('IntersectionObserver' in window)) return fn(); const io = new IntersectionObserver(e => { if (e[0].isIntersecting) { io.disconnect(); fn(); } }, { threshold: .3 }); io.observe(el); };

/* ---- 05 plate: sugar pieces travel from the plate to the blood ---- */
const PLATE = {
  alone: { food: 'rice', dur: 900, gap: 110, wait: 0, peak: 1, say: 'Whoosh. The sugar rushes in all at once.' },
  protein: { food: 'rice + chicken', dur: 1800, gap: 330, wait: 0, peak: .68, say: 'Slower. The sugar trickles in.' },
  fat: { food: 'rice + greasy food', dur: 2100, gap: 380, wait: 1700, peak: .72, say: 'Nothing at first. Then it shows up late.' },
  fiber: { food: 'rice + beans and veggies', dur: 2000, gap: 420, wait: 0, peak: .48, say: 'Slow and gentle. The smallest rise.' }
};
const plateSvg = $('#stPlate');
plateSvg.innerHTML = `<g class="rough"><rect x="-10" y="-10" width="500" height="320" fill="none" stroke="none"/>
  <circle cx="92" cy="140" r="66"/><circle cx="92" cy="140" r="46" class="thin"/>
  <path id="stPipe" d="M160 140C230 140 240 70 300 70S360 150 404 150" class="ghost"/>
  <rect x="410" y="34" width="50" height="216" rx="5"/></g>
  <rect id="stFill" x="415" y="245" width="40" height="0" class="fillt"/>
  ${[0, 1, 2, 3, 4, 5, 6, 7].map(() => `<path class="stDot fillm" d="${hex(10)}" style="opacity:0"/>`).join('')}
  <text id="stFood" x="92" y="232" text-anchor="middle">rice</text><text x="435" y="272" text-anchor="middle">blood sugar</text>
  <text x="402" y="42" text-anchor="end" class="tiny">high</text><text x="402" y="248" text-anchor="end" class="tiny">low</text>`;
let plateTl;
function playPlate(kind) {
  const c = PLATE[kind];
  $$('[data-pair]').forEach(b => b.classList.toggle('on', b.dataset.pair === kind));
  $('#stFood').textContent = c.food; $('#pairText').textContent = c.say;
  const fill = $('#stFill'), dots = $$('.stDot');
  if (reduce || !A) { fill.setAttribute('height', 206 * c.peak); fill.setAttribute('y', 245 - 206 * c.peak); return; }
  if (plateTl) plateTl.pause(); A.remove(dots); A.remove(fill);
  dots.forEach(d => { d.style.opacity = 0; d.style.transform = ''; });
  fill.setAttribute('height', 0); fill.setAttribute('y', 245);
  const path = A.path('#stPipe'), total = c.wait + c.dur + c.gap * 7;
  plateTl = A.timeline({ loop: true });
  plateTl.add({ targets: dots, translateX: path('x'), translateY: path('y'), opacity: [{ value: 1, duration: 60 }, { value: 1, duration: c.dur - 260 }, { value: 0, duration: 200 }], duration: c.dur, delay: A.stagger(c.gap, { start: c.wait }), easing: 'linear' }, 0)
    .add({ targets: fill, height: 206 * c.peak, y: 245 - 206 * c.peak, duration: total - c.wait - 200, easing: 'easeOutSine' }, c.wait + c.dur * .7)
    .add({ targets: fill, height: 0, y: 245, duration: 900, easing: 'easeInOutQuad' }, '+=900');
}
$$('[data-pair]').forEach(b => b.addEventListener('click', () => playPlate(b.dataset.pair)));
$('#pairText').textContent = PLATE.alone.say;
onSee(plateSvg, () => playPlate('alone'));

/* ---- 06 everyone is different: same snack, three different rises ---- */
const youSvg = $('#stYou'), LV = [.55, .3, .9];
youSvg.innerHTML = `<text x="240" y="26" text-anchor="middle">same banana, three kids</text><g class="rough"><rect x="-10" y="-10" width="500" height="320" fill="none" stroke="none"/>
  ${[90, 240, 390].map((x, i) => `<g class="face"><circle cx="${x}" cy="84" r="34"/><circle cx="${x - 12}" cy="78" r="3" class="fillt"/><circle cx="${x + 12}" cy="78" r="3" class="fillt"/><path d="M${x - 13} 94q13 ${10 + i * 3} 26 0"/></g><rect x="${x - 20}" y="138" width="40" height="124" rx="5"/>`).join('')}</g>
  ${[90, 240, 390].map((x, i) => `<rect class="youFill fillt" x="${x - 15}" y="257" width="30" height="0"/>`).join('')}
  <text x="90" y="288" text-anchor="middle" class="tiny">goes up some</text><text x="240" y="288" text-anchor="middle" class="tiny">barely moves</text><text x="390" y="288" text-anchor="middle" class="tiny">goes up a lot</text>`;
onSee(youSvg, () => {
  const fills = $$('.youFill');
  const cnt = $('#mealCount');
  if (reduce || !A) { fills.forEach((f, i) => { f.setAttribute('height', 114 * LV[i]); f.setAttribute('y', 257 - 114 * LV[i]); }); return; }
  const o = { v: 0 }; A({ targets: o, v: 46898, round: 1, duration: 1800, easing: 'easeOutExpo', update: () => cnt.textContent = o.v.toLocaleString('en-US') });
  A.timeline({ loop: true })
    .add({ targets: '#stYou .face', rotate: [-6, 6], duration: 500, direction: 'alternate', delay: A.stagger(120), easing: 'easeInOutSine' })
    .add({ targets: fills, height: (el, i) => 114 * LV[i], y: (el, i) => 257 - 114 * LV[i], duration: 1300, delay: A.stagger(260), easing: 'easeOutElastic(1,.7)' }, 300)
    .add({ targets: fills, height: 0, y: 257, duration: 700, easing: 'easeInQuad', delay: 1600 });
});

/* ---- 07 two jobs: a slow drip all day, a quick burst at meals ---- */
const jobSvg = $('#stJobs');
jobSvg.innerHTML = `<text x="120" y="30" text-anchor="middle">BASAL</text><text x="360" y="30" text-anchor="middle">BOLUS</text>
  <g class="rough"><rect x="-10" y="-10" width="500" height="320" fill="none" stroke="none"/>
  <path d="M24 70H216"/><path d="M240 20V280" class="ghost"/>
  <circle cx="44" cy="238" r="13"/><path d="M44 214v-8M44 262v8M20 238h-8M68 238h8M27 221l-6-6M61 221l6-6M27 255l-6 6M61 255l6 6" class="thin"/>
  <path d="M206 226a16 16 0 1 0 2 26a20 20 0 0 1-2-26Z"/>
  <path d="M80 238H180" class="thin"/>
  <circle id="stMeal" cx="360" cy="190" r="44"/><circle cx="360" cy="190" r="28" class="thin"/></g>
  ${[40, 76, 112, 148, 184].map(x => `<path class="drip fillm" d="${DROP}" style="transform:translate(${x}px,84px)"/>`).join('')}
  ${[0, 1, 2, 3, 4, 5].map(i => `<path class="burst fillm" d="${DROP}" style="opacity:0"/>`).join('')}
  <text x="120" y="288" text-anchor="middle" class="tiny">a slow drip, day and night</text><text x="360" y="288" text-anchor="middle" class="tiny">a quick dose at meals</text>`;
onSee(jobSvg, () => {
  if (reduce || !A) return;
  $$('.drip').forEach((d, i) => { const x = 40 + i * 36; A({ targets: d, translateX: [x, x], translateY: [84, 200], opacity: [{ value: 1, duration: 100 }, { value: 1, duration: 1500 }, { value: 0, duration: 300 }], duration: 1900, delay: i * 380, loop: true, easing: 'easeInQuad' }); });
  const bursts = $$('.burst');
  A.timeline({ loop: true })
    .add({ targets: '#stMeal', scale: [.6, 1], duration: 600, easing: 'easeOutElastic(1,.5)' })
    .add({ targets: bursts, translateX: (el, i) => [360 + Math.cos(i * 1.05 - 2.6) * 110, 360 + Math.cos(i * 1.05 - 2.6) * 22], translateY: (el, i) => [190 + Math.sin(i * 1.05 - 2.6) * 110, 190 + Math.sin(i * 1.05 - 2.6) * 22], opacity: [{ value: 1, duration: 80 }, { value: 1, duration: 500 }, { value: 0, duration: 220 }], duration: 800, delay: A.stagger(50), easing: 'easeInCubic' }, 250)
    .add({ duration: 1200 });
  jobSvg.querySelector('#stMeal').style.transformOrigin = '360px 190px';
});

/* ---- 08 head start: food is fast, insulin is slow ---- */
const raceSvg = $('#stRace');
raceSvg.innerHTML = `<g class="rough"><rect x="-10" y="-10" width="500" height="320" fill="none" stroke="none"/>
  <path d="M70 100H410" class="thin"/><path d="M70 200H410" class="thin"/><path d="M420 50V250"/><path d="M420 52l36 14-36 14" class="fillm"/></g>
  <text x="62" y="106" text-anchor="end">food</text><text x="62" y="206" text-anchor="end">insulin</text><text x="420" y="274" text-anchor="middle" class="tiny">your blood</text>
  <path id="rFood" class="fillm" d="${hex(13)}" transform="translate(84 100)"/><path id="rIns" class="fillt" d="${DROP}" transform="translate(84 200) scale(1.3)"/>
  <text id="rSay" x="240" y="158" text-anchor="middle"></text>`;
let raceTl, raceMode = 'together';
function playRace(m) {
  raceMode = m; $$('[data-race]').forEach(b => b.classList.toggle('on', b.dataset.race === m));
  const say = $('#rSay'), early = m === 'early';
  const done = early ? 'They arrive together. Smooth.' : 'Sugar got there first. Spike!';
  if (reduce || !A) { say.textContent = done; return; }
  if (raceTl) raceTl.pause(); A.remove('#rFood'); A.remove('#rIns'); A.remove(say);
  say.textContent = early ? 'Insulin goes first…' : 'Ready, set, go!'; say.style.opacity = 1;
  raceTl = A.timeline({ loop: true });
  raceTl.add({ targets: '#rIns', translateX: [84, 404], translateY: [200, 200], scale: [1.3, 1.3], duration: 3000, easing: 'linear' }, 0)
    .add({ targets: '#rFood', translateX: [84, 404], translateY: [100, 100], duration: 1300, easing: 'easeInOutSine', begin: () => { if (early) say.textContent = 'Now eat!'; } }, early ? 1700 : 0)
    .add({ targets: say, opacity: [0, 1], duration: 300, begin: () => say.textContent = done }, early ? 3000 : 1300)
    .add({ targets: '#rFood', scale: early ? 1 : [1, 1.7, 1], duration: 500, easing: 'easeOutElastic(1,.5)' }, early ? 3000 : 1300)
    .add({ duration: 1600, complete: () => { say.textContent = early ? 'Insulin goes first…' : 'Ready, set, go!'; } }, 3100);
}
$$('[data-race]').forEach(b => b.addEventListener('click', () => playRace(b.dataset.race)));
onSee(raceSvg, () => playRace('together'));

/* ---- 09 calculator: 10 people each way ---- */
const calcSvg = $('#stCalc');
calcSvg.innerHTML = `<text x="20" y="34">with a dose calculator</text><text x="20" y="174">doing the math by hand</text>
  ${Array.from({ length: 10 }, (_, i) => person(40 + i * 44, 86, i < 6 ? 'a' : '')).join('')}
  ${Array.from({ length: 10 }, (_, i) => person(40 + i * 44, 226, i < 3 ? 'b' : '')).join('')}
  <text x="460" y="128" text-anchor="end" class="tiny">about 6 in 10 improved (56%)</text><text x="460" y="268" text-anchor="end" class="tiny">about 3 in 10 improved (34%)</text>`;
onSee(calcSvg, () => {
  const all = $$('#stCalc .pin'), win = $$('#stCalc .person[data-i="a"] .pin, #stCalc .person[data-i="b"] .pin');
  if (reduce || !A) { win.forEach(w => w.classList.add('lit')); return; }
  A.timeline({ loop: true })
    .add({ targets: all, scale: [0, 1], duration: 600, delay: A.stagger(45), easing: 'easeOutElastic(1,.6)', begin: () => win.forEach(w => w.classList.remove('lit')) })
    .add({ targets: win, translateY: [0, -12, 0], duration: 520, delay: A.stagger(90), easing: 'easeOutQuad', begin: () => win.forEach((w, i) => setTimeout(() => w.classList.add('lit'), i * 90)) }, '+=200')
    .add({ duration: 2600 });
});

/* ---- headline pops and the dot grid, for the rest of the page ---- */
if (A && !reduce) {
  $$('.scene').forEach(s => onSee(s, () => {
    A({ targets: s.querySelector('.num'), translateX: [-40, 0], rotate: [-8, 0], duration: 900, easing: 'easeOutElastic(1,.6)' });
    A({ targets: s.querySelector('h3'), translateY: [26, 0], duration: 700, easing: 'easeOutBack' });
  }));
  A({ targets: '.tile', translateY: [30, 0], rotate: [-3, 0], duration: 900, delay: A.stagger(110, { start: 150 }), easing: 'easeOutElastic(1,.7)' });
  A({ targets: '.press img', translateY: [14, 0], duration: 700, delay: A.stagger(120, { start: 500 }), easing: 'easeOutBack' });
}
const grid = $('#dotGrid');
if (grid) {
  const cols = 26, rows = 5;
  grid.innerHTML = Array.from({ length: cols * rows }, () => '<i></i>').join('');
  const cells = [...grid.children];
  const ripple = from => { if (!A || reduce) return; A.remove(cells); A({ targets: cells, scale: [{ value: 2.6, duration: 220, easing: 'easeOutQuad' }, { value: 1, duration: 500, easing: 'easeInOutQuad' }], rotate: [{ value: 45, duration: 220 }, { value: 0, duration: 500 }], delay: A.stagger(34, { grid: [cols, rows], from }) }); };
  grid.addEventListener('pointerdown', e => { const i = cells.indexOf(e.target); if (i >= 0) ripple(i); });
  let last = 0; grid.addEventListener('pointermove', e => { const i = cells.indexOf(e.target), now = Date.now(); if (i >= 0 && now - last > 900) { last = now; ripple(i); } });
  onSee(grid, () => ripple('center'));
}
if (A && !reduce) DD.onRoute('about', () => A({ targets: '.shot', translateY: [30, 0], rotate: (el, i) => [(i % 2 ? 5 : -5), (i % 3 - 1) * 1.2], opacity: [.2, 1], duration: 800, delay: A.stagger(70), easing: 'easeOutElastic(1,.8)' }));
})();
