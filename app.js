/* DirectDose app. Plain JS, no build step. */

/* ---------- CONFIG ----------
   Sign-in runs through Supabase. Google's client ID and secret live in the Supabase dashboard
   (Authentication > Providers > Google), never in this file.
   supabaseAnonKey: the project's publishable key (Project Settings > API keys). Safe to ship in a browser. */
const CONFIG = {
  supabaseUrl: 'https://dtjgtudjsndkkwovwevm.supabase.co',
  supabaseAnonKey: 'sb_publishable_jZwZVnklz_fpcodihcVPXg_aXqN-s2v',
  /* USDA FoodData Central key for the online food search. DEMO_KEY is rate limited.
     Get a free one at https://fdc.nal.usda.gov/api-key-signup */
  usdaApiKey: 'DEMO_KEY'
};

/* ---------- pure math (also used by tests) ---------- */
const MMOL = 18.016;
function floorTo(x, step) { return Math.floor(x / step + 1e-9) * step; }
function calcBolus({ carbs, icr, isf, target, bg, iob = 0, step = 0.5 }) {
  if (bg < 70) return { status: bg < 54 ? 'severe-low' : 'low', dose: 0, food: carbs / icr, corr: 0, iob };
  const food = carbs / icr;
  const corr = (bg - target) / isf;
  const raw = food + corr - iob;
  const dose = raw <= 0 ? 0 : floorTo(raw, step);
  return { status: 'ok', food, corr, iob, raw, dose };
}
function calcRatios(tdd, kg) {
  const lb = kg ? kg * 2.20462 : null;
  return {
    icr: { r500: 500 / tdd, walsh: kg ? 5.7 * kg / tdd : null, davidson: lb ? 2.8 * lb / tdd : null },
    isf: { r1800: 1800 / tdd, walsh: 1960 / tdd, davidson: 1700 / tdd }
  };
}
function calcBasalT1(tdd, sharePct) {
  const basal = tdd * sharePct / 100;
  return { basal, rate: basal / 24, bolus: tdd - basal };
}
if (typeof module !== 'undefined') module.exports = { calcBolus, calcRatios, calcBasalT1, floorTo };

if (typeof document !== 'undefined') (function () {
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const fmt = (n, d = 1) => (Math.round(n * 10 ** d) / 10 ** d).toLocaleString('en-US', { maximumFractionDigits: d });
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = el => { const v = parseFloat(el.value); return isFinite(v) ? v : null; };

/* ---------- storage (falls back to memory) ---------- */
const mem = {};
const store = {
  get(k, d) { try { const v = localStorage.getItem('dd.' + k); return v ? JSON.parse(v) : (k in mem ? mem[k] : d); } catch (e) { return k in mem ? mem[k] : d; } },
  set(k, v) { mem[k] = v; try { localStorage.setItem('dd.' + k, JSON.stringify(v)); } catch (e) {} },
  del(k) { delete mem[k]; try { localStorage.removeItem('dd.' + k); } catch (e) {} }
};
let session = store.get('session', null);
if (session && session.cloud) session = null; /* cloud sessions are restored by Supabase */
const dataKey = () => 'data.' + (session ? session.email : 'guest');
const blank = () => ({ settings: {}, log: [], check: { day: '', done: [] } });
let data = Object.assign(blank(), store.get(dataKey(), {}));
let pushT;
function save() {
  store.set(dataKey(), data);
  if (DD.sb && session && session.cloud) { clearTimeout(pushT); pushT = setTimeout(() => DD.sb.from('user_data').upsert({ user_id: session.id, data, updated_at: new Date().toISOString() }).then(r => { if (r.error) toast('Couldn\'t sync. Saved on this device.'); }), 600); }
}

/* ---------- Bates ---------- */
$$('canvas[data-bates]').forEach(c => Bates.mount(c, c.dataset.bates));
function say(bubble, cv, text, pose, tone) {
  if (bubble.dataset.t === text) return;
  bubble.dataset.t = text; bubble.textContent = text;
  bubble.classList.remove('warn', 'danger', 'swap');
  if (tone) bubble.classList.add(tone);
  void bubble.offsetWidth; bubble.classList.add('swap');
  if (cv && cv._bates) { if (pose && cv._bates.pose !== pose) cv._bates.set(pose); else cv._bates.act(1.3); }
}
let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2800); }

/* ---------- router + sliding nav ink ---------- */
const VIEWS = ['home', 'bolus', 'basal', 'ratio', 'meals', 'about', 'account'];
const routeHooks = {};
const ink = $('#ink'), links = $('#links');
let navActive = null;
function moveInk(a) {
  if (!a) { ink.style.opacity = 0; return; }
  ink.style.opacity = 1; ink.style.width = a.offsetWidth + 'px'; ink.style.transform = 'translateX(' + a.offsetLeft + 'px)';
}
links.addEventListener('pointerover', e => { const a = e.target.closest('a'); if (a) moveInk(a); });
links.addEventListener('pointerleave', () => moveInk(navActive));
links.addEventListener('focusin', e => moveInk(e.target.closest('a')));
links.addEventListener('focusout', () => moveInk(navActive));
addEventListener('resize', () => moveInk(navActive));
function route() {
  let h = location.hash.replace('#', '') || 'home';
  if (h.includes('=')) h = 'home';
  const guide = h === 'guide';
  const view = guide ? 'home' : (VIEWS.includes(h) ? h : 'home');
  $$('.view').forEach(v => v.hidden = v.dataset.view !== view);
  navActive = $('.links a[data-nav="' + h + '"]'); moveInk(navActive);
  if (guide) requestAnimationFrame(() => $('#guideTop').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' }));
  else window.scrollTo(0, 0);
  if (view === 'bolus') loadSettingsIntoBolus();
  (routeHooks[view] || []).forEach(f => f());
  $$('.view:not([hidden]) canvas.bates').forEach(c => c._bates && c._bates.kick());
  requestAnimationFrame(onScroll);
}
addEventListener('hashchange', route);

/* ---------- hero ---------- */
const HERO = [
  ['wave', 'Hi, I\'m Bates.'],
  ['point', 'About to eat? Start with Meal dose.'],
  ['think', 'Carbs hit first. Fat and protein show up late.'],
  ['thumbs', 'Checked your sugar today? Nice.'],
  ['hop', 'All of this is free.'],
  ['wave', 'Scroll down. I\'ll walk with you.']
];
let heroI = 0;
const heroCv = $('#heroBates');
function heroNext() {
  heroI = (heroI + 1) % HERO.length;
  const [pose, line] = HERO[heroI];
  heroCv._bates.set(pose); heroCv._bates.act(1.8);
  const b = $('#heroBubble'); b.textContent = line; b.classList.remove('swap'); void b.offsetWidth; b.classList.add('swap');
}
heroCv.addEventListener('click', heroNext);
heroCv.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); heroNext(); } });

/* ---------- line art: one continuous line that draws with scroll ---------- */
const la = $('#lineart'), lctx = la.getContext('2d');
let laDrawn = -1;
function drawLine(p) {
  const L = window.LINEART; if (!L) return;
  const total = L.p.length / 2 - 1, n = Math.round(total * p);
  const dpr = Math.min(2, devicePixelRatio || 1), w = Math.round(la.clientWidth * dpr), h = Math.round(la.clientHeight * dpr);
  if (!w) return;
  if (la.width !== w || la.height !== h) { la.width = w; la.height = h; laDrawn = -1; }
  if (n === laDrawn) return;
  let from = laDrawn;
  if (n < laDrawn || laDrawn < 0) { lctx.clearRect(0, 0, w, h); from = 0; }
  lctx.strokeStyle = 'rgba(0,108,104,.55)'; lctx.lineWidth = .75 * dpr; lctx.lineJoin = 'round';
  lctx.beginPath();
  for (let i = from; i < n; i++) { lctx.moveTo(L.p[i * 2] / 1000 * w, L.p[i * 2 + 1] / 1000 * h); lctx.lineTo(L.p[i * 2 + 2] / 1000 * w, L.p[i * 2 + 3] / 1000 * h); }
  lctx.stroke();
  if (n > 0 && n < total) { lctx.fillStyle = '#006C68'; }
  laDrawn = n;
}

/* ---------- partners ---------- */
(function () {
  const track = $('#track'), orig = [...track.children];
  const fill = () => {
    let n = 0;
    while (track.scrollWidth < innerWidth * 1.2 && n++ < 6) orig.forEach(c => track.appendChild(c.cloneNode(true)));
    [...track.children].forEach(c => { const k = c.cloneNode(true); k.setAttribute('aria-hidden', 'true'); track.appendChild(k); });
  };
  if (document.readyState === 'complete') fill(); else addEventListener('load', fill);
})();

/* ---------- scene art, drawn in code ---------- */
const P = (d, delay = 0, cls = '') => `<path class="d ${cls}" pathLength="1" d="${d}" style="--d:${delay}"/>`;
const T = (x, y, s, delay = 0, anchor = 'start', cls = '') => `<text class="f ${cls}" x="${x}" y="${y}" text-anchor="${anchor}" style="--d:${delay}">${s}</text>`;
function smooth(p) {
  let d = 'M' + p[0];
  for (let i = 0; i < p.length - 1; i++) {
    const a = p[i - 1] || p[i], b = p[i], c = p[i + 1], e = p[i + 2] || c;
    d += 'C' + [b[0] + (c[0] - a[0]) / 6, b[1] + (c[1] - a[1]) / 6, c[0] - (e[0] - b[0]) / 6, c[1] - (e[1] - b[1]) / 6, c[0], c[1]].map(v => v.toFixed(1));
  }
  return d;
}
const hex = (cx, cy, r) => 'M' + [0, 1, 2, 3, 4, 5].map(i => [(cx + r * Math.cos(i * Math.PI / 3 + .5)).toFixed(1), (cy + r * Math.sin(i * Math.PI / 3 + .5)).toFixed(1)]).join('L') + 'Z';
const wavy = (x0, y, x1, amp = 5) => { const p = []; for (let x = x0, i = 0; x <= x1; x += 46, i++) p.push([x, y + (i % 2 ? amp : -amp)]); return smooth(p); };
const ring = (cx, cy, r) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
const HEXF = (cx, cy, r, delay) => `<path class="f fillm" d="${hex(cx, cy, r)}" style="--d:${delay}"/>`;
const AX = P('M40 20V250H460') + T(40, 276, 'now', .1) + T(460, 276, '5 h', .1, 'end');
const ART = {
  fuel: () => `<clipPath id="vessel"><rect x="8" y="76" width="464" height="58"/></clipPath>` + T(12, 54, 'glucose in your blood') +
    P(wavy(10, 70, 470)) + P(wavy(10, 140, 470), .05) +
    `<g clip-path="url(#vessel)"><g class="flow">${[-30, 40, 110, 180, 250, 320, 390, 460, 530].map((x, i) => HEXF(x, 105 + (i % 3 - 1) * 6, 13, .1)).join('')}</g></g>` +
    P('M240 150V200M228 188l12 14 12-14', .3) + P('M213 216A52 52 0 1 0 267 216', .4) + T(240, 268, 'cell', .5, 'middle') +
    P('M330 204h-52M290 204v11M302 204v8', .6) + P(ring(343, 204, 13), .65) + T(364, 210, 'insulin', .7),
  types: () => T(120, 36, 'Type 1', 0, 'middle') + T(360, 36, 'Type 2', 0, 'middle') +
    P('M93 122A62 62 0 1 0 147 122', .1) + `<path class="f ghost" d="M178 108h-46M144 108v10M156 108v8${ring(190, 108, 12)}" style="--d:.3"/>` + T(120, 274, 'no key', .4, 'middle', 'tiny') +
    [[60, 70], [92, 62], [150, 70], [40, 110]].map((h, i) => HEXF(h[0], h[1], 11, .35 + i * .05)).join('') +
    P('M333 122A62 62 0 1 0 387 122', .2) + P('M418 108h-46M384 108v10M396 108v8', .45) + P(ring(430, 108, 12), .5) + P('M332 124l9 9 9-9 9 9 9-9 9 9 9-9', .6, 'thick') + T(360, 274, 'key fits, door sticks', .65, 'middle', 'tiny') +
    [[300, 70], [332, 62], [280, 110]].map((h, i) => HEXF(h[0], h[1], 11, .5 + i * .05)).join('') + HEXF(360, 190, 11, .7),
  speeds: () => AX + P(smooth([[40, 240], [70, 150], [105, 60], [150, 120], [210, 215], [300, 240], [460, 244]]), .1, 'thick') + T(124, 54, 'carbs', .3) +
    P(smooth([[40, 240], [130, 225], [230, 150], [300, 140], [380, 180], [460, 222]]), .3) + T(250, 126, 'fat', .5) +
    P(smooth([[40, 240], [220, 236], [330, 205], [400, 196], [460, 206]]), .5, 'thin') + T(350, 230, 'protein', .65),
  carbs: () => P(hex(52, 55, 22), 0) + T(262, 62, 'sugars: fast', .1) +
    [0, 1, 2, 3, 4].map(i => P(hex(52 + i * 42, 150, 22), .2 + i * .04)).join('') + T(262, 157, 'starches: slower', .4) +
    [0, 1, 2, 3, 4].map(i => P(hex(52 + i * 42, 245, 22), .45 + i * .04)).join('') + P(wavy(20, 236, 250, 9), .65, 'thick') + P(wavy(20, 256, 250, -9), .7, 'thick') + T(262, 252, 'fiber: slows it all', .75),
  range: () => P('M36 70H470', 0, 'thin') + P('M36 180H470', .05, 'thin') + T(0, 76, '180', .1) + T(8, 186, '70', .1) +
    P(smooth([[36, 150], [80, 110], [130, 140], [180, 60], [230, 100], [280, 130], [330, 170], [370, 196], [410, 150], [470, 120]]), .2, 'thick') +
    `<g id="tirPin"><path d="M36 0H470" class="ghost"/><circle cx="253" cy="0" r="9" class="fillm"/></g>`
};
$$('svg[data-art]').forEach(s => s.innerHTML = ART[s.dataset.art]());
/* wobble the linework but keep lettering crisp */
$$('svg[data-art]').forEach(s => {
  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g'); g.setAttribute('class', 'rough');
  /* an invisible frame keeps the filter region from collapsing on flat lines */
  g.innerHTML = '<rect x="-10" y="-10" width="500" height="320" fill="none" stroke="none"/>';
  [...s.children].forEach(n => { if (n.tagName !== 'text') g.appendChild(n); });
  s.insertBefore(g, s.firstChild);
});

/* references */
const REFS = [
  ['Diabetes Control and Complications Trial Research Group (1993). The effect of intensive treatment of diabetes on the development and progression of long-term complications.', 'New England Journal of Medicine', 'https://doi.org/10.1056/NEJM199309303291401'],
  ['Bell et al. (2015). Impact of fat, protein, and glycemic index on postprandial glucose control in type 1 diabetes.', 'Diabetes Care', 'https://doi.org/10.2337/dc15-0100'],
  ['Effects of meals with different glycaemic index on postprandial blood glucose response in patients with type 1 diabetes (2011).', 'Diabetic Medicine', 'https://pubmed.ncbi.nlm.nih.gov/21219435/'],
  ['Impact of dietary protein on postprandial glycaemic control and insulin requirements in type 1 diabetes (2019).', 'Diabetic Medicine', 'https://pubmed.ncbi.nlm.nih.gov/31454430/'],
  ['Additional insulin is required in both the early and late postprandial periods for meals high in protein and fat (2021).', 'Diabetes Care', 'https://pubmed.ncbi.nlm.nih.gov/33954780/'],
  ['Giacco et al. (2000). Long-term dietary treatment with increased amounts of fiber-rich low-glycemic index natural foods.', 'Diabetes Care', 'https://doi.org/10.2337/diacare.23.10.1461'],
  ['Carbohydrate-last meal pattern lowers postprandial glucose and insulin excursions in type 2 diabetes (2017).', 'BMJ Open Diabetes Research & Care', 'https://pubmed.ncbi.nlm.nih.gov/28989726/'],
  ['Zeevi et al. (2015). Personalized nutrition by prediction of glycemic responses.', 'Cell', 'https://doi.org/10.1016/j.cell.2015.11.001'],
  ['Plasma insulin profiles after subcutaneous injection: how close can we get to physiology in people with diabetes? (2015).', '', 'https://pubmed.ncbi.nlm.nih.gov/26041603/'],
  ['Premeal injection of rapid-acting insulin reduces postprandial glycemic excursions in type 1 diabetes (2010).', 'Diabetes Care', 'https://pubmed.ncbi.nlm.nih.gov/20693354/'],
  ['Ziegler et al. (2013). Use of an insulin bolus advisor improves glycemic control in multiple daily insulin injection therapy patients.', 'Diabetes Care', 'https://doi.org/10.2337/dc13-0251'],
  ['Battelino et al. (2019). Clinical targets for continuous glucose monitoring data interpretation.', 'Diabetes Care', 'https://pubmed.ncbi.nlm.nih.gov/31177185/']
];
$('#refList').innerHTML = REFS.map((r, i) => `<li id="ref${i + 1}">${esc(r[0])} ${r[1] ? '<i>' + esc(r[1]) + '</i>. ' : ''}<a href="${r[2]}" target="_blank" rel="noopener">Read paper</a></li>`).join('');
document.addEventListener('click', e => {
  const a = e.target.closest('.ref'); if (!a) return;
  e.preventDefault();
  const li = $('#ref' + a.dataset.ref); if (!li) return;
  $('#refs').open = true;
  li.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
  li.classList.add('flash'); setTimeout(() => li.classList.remove('flash'), 2000);
});

/* time in range */
const tirR = $('#tirRange');
function tir() {
  const v = +tirR.value;
  $('#tirVal').textContent = v;
  $('#tirPin').setAttribute('transform', 'translate(0,' + clamp(250 - v, 8, 232) + ')');
  $('#tirMsg').textContent = v < 54 ? 'is a serious low. Treat it now.' : v < 70 ? 'is low. Fast sugar time.' : v <= 180 ? 'is in range.' : v <= 250 ? 'is high.' : 'is very high.';
}
tirR.addEventListener('input', tir); tir();

function confetti() {
  if (reduce) return;
  const c = $('#confetti'), x = c.getContext('2d');
  c.width = innerWidth; c.height = innerHeight;
  const cols = ['#006C68', '#D5EAE4', '#A9CEC6', '#FFFFFF', '#063F3C'];
  const ps = Array.from({ length: 110 }, () => ({ x: innerWidth / 2, y: innerHeight * .6, vx: (Math.random() - .5) * 16, vy: -Math.random() * 16 - 4, s: Math.random() * 8 + 4, r: Math.random() * 6, c: cols[Math.random() * cols.length | 0] }));
  let f = 0;
  (function tick() {
    x.clearRect(0, 0, c.width, c.height);
    ps.forEach(p => { p.x += p.vx; p.y += p.vy; p.vy += .45; p.r += .2; x.save(); x.translate(p.x, p.y); x.rotate(p.r); x.fillStyle = p.c; x.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * .6); x.restore(); });
    if (++f < 130) requestAnimationFrame(tick); else x.clearRect(0, 0, c.width, c.height);
  })();
}

/* ---------- scroll: scenes draw, the line draws, Bates walks (and runs when you scroll fast) ---------- */
const scenes = $$('.scene'), guideEl = $('#guideTop'), walker = $('#walker'), who = $('#walkerWho'), wLabel = $('#walkerLabel'), wCv = $('#walkerBates');
$('#walkerTrack').innerHTML = scenes.map((s, i) => `<i style="left:${i / (scenes.length - 1) * 100}%"></i>`).join('');
let walkTargetX = null, walkShownX = null, walkDir = 1;
wCv._bates.opts.phase = (t, dt, ph) => {
  if (walkTargetX == null) return ph;
  if (walkShownX == null) walkShownX = walkTargetX;
  const gap = walkTargetX - walkShownX, dist = Math.abs(gap);
  /* he covers the gap at a speed that grows with how far behind he is: walk up to ~90px/s, run up to ~520px/s */
  const speed = dist < .5 ? 0 : Math.min(520, 40 + dist * 3.2);
  const stepPx = Math.min(dist, speed * dt);
  walkShownX += Math.sign(gap) * stepPx;
  if (dist > 2) walkDir = Math.sign(gap);
  const run = clamp((speed - 110) / 220);
  wCv._bates.run += (run - wCv._bates.run) * Math.min(1, dt * 6);
  who.style.left = walkShownX.toFixed(1) + 'px';
  who.classList.toggle('back', walkDir < 0);
  const stride = 62 + 110 * wCv._bates.run; /* px per full cycle: a run covers more ground per step */
  if (stepPx > 0) return ph + stepPx / stride * 2 * Math.PI;
  /* standing still: settle into the nearest standing pose */
  const rest = Math.round(ph / Math.PI) * Math.PI;
  return ph + (rest - ph) * Math.min(1, dt * 8);
};
let ticking = false;
function onScroll() {
  ticking = false;
  if ($('[data-view=home]').hidden) { walker.classList.remove('on'); return; }
  const vh = innerHeight;
  const rr = $('#research').getBoundingClientRect();
  drawLine(reduce ? 1 : clamp((vh * .95 - rr.top) / (vh * .8)));
  let current = 0;
  scenes.forEach((s, i) => {
    const r = s.getBoundingClientRect();
    if (r.bottom < -200 || r.top > vh + 200) { if (r.top > vh + 200) s.style.setProperty('--p', reduce ? 1 : 0); return; }
    const p = reduce ? 1 : clamp((vh * .92 - r.top) / (vh * .62));
    s.style.setProperty('--p', p.toFixed(3));
    if (r.top < vh * .55) current = i;
  });
  const g = guideEl.getBoundingClientRect(), on = g.top < vh * .5 && g.bottom > vh * .7;
  walker.classList.toggle('on', on);
  if (on) {
    const first = scenes[0].getBoundingClientRect().top, last = scenes[scenes.length - 1].getBoundingClientRect().top;
    walkTargetX = 20 + clamp((vh * .55 - first) / (last - first)) * (innerWidth - 40);
    wLabel.textContent = scenes[current].dataset.name;
    wCv._bates.kick();
  }
}
addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
addEventListener('resize', onScroll);

/* footer stroller: walks on his own */
(function () {
  const cv = $('#stroll'); let x = -120;
  cv._bates.opts.phase = (t, dt, ph) => {
    const w = cv.parentElement.clientWidth;
    x += 46 * dt; if (x > w + 20) x = -140;
    cv.style.transform = 'translateX(' + x.toFixed(1) + 'px)';
    return ph + 46 * dt * (2 * Math.PI / 67);
  };
  if (reduce) cv.style.transform = 'translateX(8vw)';
})();

/* ================= BOLUS ================= */
let gUnit = 'mg', roundStep = 0.5, plate = [], lastCalc = null;
const B = { icr: $('#bIcr'), isf: $('#bIsf'), target: $('#bTarget'), bg: $('#bBg'), iob: $('#bIob') };
const toMg = v => v == null ? null : (gUnit === 'mmol' ? v * MMOL : v);
const fromMg = v => gUnit === 'mmol' ? Math.round(v / MMOL * 10) / 10 : Math.round(v);
const gLabel = () => gUnit === 'mmol' ? 'mmol/L' : 'mg/dL';

$$('[data-unit]').forEach(b => b.addEventListener('click', () => {
  if (b.dataset.unit === gUnit) return;
  const vals = ['isf', 'target', 'bg'].map(k => toMg(num(B[k])));
  gUnit = b.dataset.unit;
  $$('[data-unit]').forEach(x => x.classList.toggle('on', x === b));
  ['isf', 'target', 'bg'].forEach((k, i) => { if (vals[i] != null) B[k].value = fromMg(vals[i]); });
  $$('[data-view=bolus] .gu').forEach(e => e.textContent = gLabel());
  B.isf.placeholder = gUnit === 'mmol' ? '2.8' : '50';
  B.target.placeholder = gUnit === 'mmol' ? '6.0' : '110';
  compute();
}));
$$('[data-round]').forEach(b => b.addEventListener('click', () => {
  roundStep = +b.dataset.round; $$('[data-round]').forEach(x => x.classList.toggle('on', x === b)); compute();
}));
Object.values(B).forEach(el => el.addEventListener('input', () => {
  if (['bIcr', 'bIsf', 'bTarget'].includes(el.id)) $('#bExampleFlag').hidden = true;
  compute();
}));
function loadSettingsIntoBolus(force) {
  const s = data.settings;
  if (force) { B.icr.value = B.isf.value = B.target.value = ''; $('#bExampleFlag').hidden = true; }
  if (s.icr && !B.icr.value) B.icr.value = s.icr;
  if (s.isf && !B.isf.value) B.isf.value = fromMg(s.isf);
  if (s.target && !B.target.value) B.target.value = fromMg(s.target);
  $('#bIcrNote').textContent = s.icr && s.icrSource === 'finder' && +B.icr.value === s.icr ? 'Carb ratio from your ratio test' + (s.icrDate ? ', ' + new Date(s.icrDate).toLocaleDateString([], { month: 'short', day: 'numeric' }) : '') + '. Change it any time.' : '';
  compute();
}
$('#bSaveSettings').addEventListener('click', () => {
  const icr = num(B.icr), isf = toMg(num(B.isf)), target = toMg(num(B.target));
  if (!icr || !isf || !target) return toast('Fill in all three settings first.');
  if (!$('#bExampleFlag').hidden) return toast('Those are example numbers. Enter your own first.');
  data.settings = Object.assign({}, data.settings, { icr, isf, target }, icr !== data.settings.icr ? { icrSource: 'manual', icrDate: Date.now() } : {}); save(); DD.emit('settings');
  toast(session ? 'Settings saved to your account.' : 'Settings saved on this device.');
});
$('#bExample').addEventListener('click', () => {
  B.icr.value = 10; B.isf.value = fromMg(50); B.target.value = fromMg(110); B.bg.value = fromMg(164); B.iob.value = '';
  plate = []; addFood(FOODS.find(f => f[0] === 'Rice with chicken'));
  $('#bExampleFlag').hidden = false; compute();
});

/* food search */
const q = $('#foodQ'), drop = $('#foodDrop');
let hits = [], act = 0;
function search(term) {
  const t = term.trim().toLowerCase(); if (!t) return [];
  const scored = [];
  FOODS.forEach(f => {
    const name = f[0].toLowerCase(), extra = (f[6] || '').toLowerCase();
    let s = -1;
    if (name.startsWith(t)) s = 0;
    else if (name.split(/[\s,\/]+/).some(w => w.startsWith(t))) s = 1;
    else if (name.includes(t)) s = 2;
    else if (extra.split(' ').some(w => w.startsWith(t))) s = 3;
    if (s >= 0) scored.push([s, f]);
  });
  return scored.sort((a, b) => a[0] - b[0] || a[1][0].localeCompare(b[1][0])).slice(0, 8).map(x => x[1]);
}
/* online lookup: USDA FoodData Central.
   Branded foods are the nutrition labels manufacturers submit to USDA, so typing "chobani" lists Chobani products
   with the carbs printed on their label. Generic foods come from USDA's survey and reference data. */
let onlineT, onlineQ = '', online = [];
const tidy = s => String(s || '').toLowerCase().replace(/(^|[\s(\/&-])\w/g, m => m.toUpperCase()).replace(/\s+/g, ' ').trim();
const nut = (f, id, no) => { const x = (f.foodNutrients || []).find(z => z.nutrientId === id || String(z.nutrientNumber) === no); return x && isFinite(x.value) ? x.value : 0; };
function usdaFood(f) {
  const m = (f.foodMeasures || []).filter(m => m.gramWeight > 0 && !/not specified/i.test(m.disseminationText || '')).sort((a, b) => (a.rank || 99) - (b.rank || 99))[0];
  const g = m ? m.gramWeight : 100, k = g / 100;
  return [tidy(f.description || 'Food'), (m ? m.disseminationText + ', ' : '') + Math.round(g) + ' g', Math.round(nut(f, 1005, '205') * k), Math.round(nut(f, 1079, '291') * k), Math.round(nut(f, 1003, '203') * k), Math.round(nut(f, 1004, '204') * k), '', 'USDA'];
}
function brandedFood(f) {
  /* search results give nutrients per 100 g (or 100 ml); the label serving converts them back to per serving */
  const unit = String(f.servingSizeUnit || '').toLowerCase(), size = +f.servingSize;
  const isMl = /^(ml|mlt)$/.test(unit), ok = size > 0 && /^(g|grm|gm|ml|mlt)$/.test(unit);
  const k = ok ? size / 100 : 1, u = isMl ? 'ml' : 'g';
  const brand = tidy(f.brandName || f.brandOwner || '');
  let desc = tidy(f.description || 'Food');
  if (brand && desc.toLowerCase().startsWith(brand.toLowerCase())) desc = desc.slice(brand.length).replace(/^[\s,:-]+/, '');
  const house = tidy(f.householdServingFullText || '').toLowerCase();
  const serving = ok ? (house && !/^[\d.]+\s*(g|grm|ml|mlt|onz|oz)$/i.test(house) ? house + ' (' + Math.round(size) + ' ' + u + ')' : Math.round(size) + ' ' + u) : '100 ' + u;
  return [(brand ? brand + ' ' : '') + desc, serving, Math.round(nut(f, 1005, '205') * k), Math.round(nut(f, 1079, '291') * k), Math.round(nut(f, 1003, '203') * k), Math.round(nut(f, 1004, '204') * k), '', 'label'];
}
const CACHE_DAYS = 7;
function cached(t) { const c = store.get('fdc', {})[t.toLowerCase()]; return c && Date.now() - c.at < CACHE_DAYS * 864e5 ? c.items : null; }
function remember(t, items) { const all = store.get('fdc', {}); all[t.toLowerCase()] = { at: Date.now(), items }; const keys = Object.keys(all); if (keys.length > 120) keys.sort((a, b) => all[a].at - all[b].at).slice(0, keys.length - 120).forEach(k => delete all[k]); store.set('fdc', all); }
async function fdcSearch(t, types, size) {
  const r = await fetch('https://api.nal.usda.gov/fdc/v1/foods/search?api_key=' + encodeURIComponent(CONFIG.usdaApiKey) + '&pageSize=' + size + '&dataType=' + encodeURIComponent(types) + '&query=' + encodeURIComponent(t));
  if (!r.ok) throw new Error('USDA ' + r.status);
  return (await r.json()).foods || [];
}
function fetchOnline(t) {
  clearTimeout(onlineT);
  if (!CONFIG.usdaApiKey || t.length < 3) return;
  const hit = cached(t); if (hit) { online = hit; onlineQ = t; return renderDrop(); }
  onlineT = setTimeout(async () => {
    const [b, g] = await Promise.all([fdcSearch(t, 'Branded', 12).catch(() => []), fdcSearch(t, 'Survey (FNDDS),SR Legacy,Foundation', 5).catch(() => [])]);
    if (q.value.trim() !== t) return;
    const seen = new Set();
    const brandHit = b.some(f => (f.brandName || f.brandOwner || '').toLowerCase().includes(t.toLowerCase()));
    const list = (brandHit ? b.map(brandedFood).concat(g.map(usdaFood)) : g.map(usdaFood).concat(b.map(brandedFood)))
      .filter(x => x[2] >= 0 && !seen.has(x[0].toLowerCase() + x[1]) && seen.add(x[0].toLowerCase() + x[1]));
    online = list.slice(0, 12); onlineQ = t; if (list.length) remember(t, online); renderDrop();
  }, 400);
}
const hl = (name, t) => { const i = name.toLowerCase().indexOf(t.toLowerCase()); return i < 0 ? esc(name) : esc(name.slice(0, i)) + '<mark>' + esc(name.slice(i, i + t.length)) + '</mark>' + esc(name.slice(i + t.length)); };
function renderDrop() {
  const t = q.value.trim();
  if (!t) { drop.hidden = true; q.setAttribute('aria-expanded', 'false'); return; }
  hits = search(t);
  if (onlineQ === t && online.some(o => o[7] === 'label' && o[0].toLowerCase().startsWith(t.toLowerCase()))) hits = hits.slice(0, 3);
  if (onlineQ === t) hits = hits.concat(online.filter(o => !hits.some(h => h[0].toLowerCase() === o[0].toLowerCase()))); else fetchOnline(t);
  drop.innerHTML = hits.map((f, i) => `<li role="option" id="opt${i}" data-i="${i}" class="${i === act ? 'act' : ''}" aria-selected="${i === act}"><span>${hl(f[0], t)}<small>${esc(f[1])}${f[7] === 'label' ? ' · <em class="lbl">nutrition label</em>' : f[7] ? ' · USDA' : ''}</small></span><b class="c">${f[2]} g</b></li>`).join('') +
    `<li role="option" id="opt${hits.length}" data-i="${hits.length}" class="custom ${act === hits.length ? 'act' : ''}"><span>Add “${esc(t)}” with my own carbs</span><b class="c">+</b></li>`;
  drop.hidden = false; q.setAttribute('aria-expanded', 'true'); q.setAttribute('aria-activedescendant', 'opt' + act);
  const a = $('.act', drop); if (a) a.scrollIntoView({ block: 'nearest' });
}
function pick(i) {
  if (i < hits.length) addFood(hits[i]); else addFood([q.value.trim(), 'your own count', 0, 0, 0, 0], true);
  q.value = ''; drop.hidden = true; q.setAttribute('aria-expanded', 'false'); q.focus();
}
q.addEventListener('input', () => { act = 0; renderDrop(); });
q.addEventListener('focus', renderDrop);
q.addEventListener('keydown', e => {
  if (drop.hidden) return;
  if (e.key === 'ArrowDown') { act = Math.min(act + 1, hits.length); renderDrop(); e.preventDefault(); }
  else if (e.key === 'ArrowUp') { act = Math.max(act - 1, 0); renderDrop(); e.preventDefault(); }
  else if (e.key === 'Enter') { pick(act); e.preventDefault(); }
  else if (e.key === 'Escape') { drop.hidden = true; }
});
drop.addEventListener('mousedown', e => { const li = e.target.closest('li'); if (li) { e.preventDefault(); pick(+li.dataset.i); } });
document.addEventListener('click', e => { if (!e.target.closest('.search')) drop.hidden = true; });

let uid = 0;
function addFood(f, custom) {
  plate.push({ id: ++uid, name: f[0], serving: f[1], per: f[2], fiber: f[3], prot: f[4], fat: f[5], qty: 1, carbs: f[2], edited: !!custom, custom: !!custom });
  renderPlate(custom ? uid : null); compute();
}
function renderPlate(focusId) {
  $('#plate').innerHTML = plate.map(p => `<li data-id="${p.id}">
    <span class="nm">${esc(p.name)}<small>${esc(p.serving)}${p.edited && !p.custom ? ' · carbs edited' : ''}</small></span>
    <span class="qty"><button type="button" data-q="-0.5" aria-label="Less ${esc(p.name)}">−</button><span>× ${p.qty}</span><button type="button" data-q="0.5" aria-label="More ${esc(p.name)}">+</button></span>
    <span class="carb"><input type="number" inputmode="decimal" min="0" step="1" value="${fmt(p.carbs, 1).replace(/,/g, '')}" id="carb${p.id}" aria-label="Carbs for ${esc(p.name)}"><em>g</em></span>
    <button type="button" class="rm" aria-label="Remove ${esc(p.name)}">×</button></li>`).join('');
  $('#plateEmpty').hidden = plate.length > 0;
  if (focusId) { const el = $('#carb' + focusId); el.value = ''; el.focus(); }
}
$('#plate').addEventListener('click', e => {
  const li = e.target.closest('li'); if (!li) return;
  const p = plate.find(x => x.id === +li.dataset.id);
  if (e.target.closest('.rm')) { plate = plate.filter(x => x !== p); renderPlate(); compute(); return; }
  const qb = e.target.closest('[data-q]');
  if (qb) {
    const old = p.qty; p.qty = Math.max(0.5, p.qty + +qb.dataset.q);
    p.carbs = p.edited ? Math.round(p.carbs / old * p.qty * 10) / 10 : p.per * p.qty;
    renderPlate(); compute();
  }
});
$('#plate').addEventListener('input', e => {
  if (!e.target.matches('.carb input')) return;
  const p = plate.find(x => x.id === +e.target.closest('li').dataset.id);
  p.carbs = Math.max(0, parseFloat(e.target.value) || 0); p.edited = true; compute();
});
const totals = () => plate.reduce((t, p) => ({ carbs: t.carbs + p.carbs, fiber: t.fiber + p.fiber * p.qty, prot: t.prot + p.prot * p.qty, fat: t.fat + p.fat * p.qty }), { carbs: 0, fiber: 0, prot: 0, fat: 0 });

function compute() {
  const t = totals();
  $('#tCarb').textContent = fmt(t.carbs, 0); $('#tFiber').textContent = fmt(t.fiber, 0); $('#tProt').textContent = fmt(t.prot, 0); $('#tFat').textContent = fmt(t.fat, 0);
  const bub = $('#bBubble'), img = $('#bBates'), doseEl = $('#bDose'), box = doseEl.parentElement;
  const icr = num(B.icr), isf = toMg(num(B.isf)), target = toMg(num(B.target)), bg = toMg(num(B.bg)), iob = num(B.iob) || 0;
  const bad = { icr: icr != null && (icr < 1 || icr > 150), isf: isf != null && (isf < 5 || isf > 400), target: target != null && (target < 70 || target > 200), bg: bg != null && (bg < 20 || bg > 700), iob: iob < 0 || iob > 50 };
  Object.keys(B).forEach(k => B[k].closest('.inp').classList.toggle('bad', !!bad[k]));
  const clear = () => { doseEl.textContent = '–'; box.classList.remove('none'); ['bkFood', 'bkCorr', 'bkIob'].forEach(i => $('#' + i).textContent = '–'); $('#bMath').textContent = ''; $('#bLog').disabled = true; lastCalc = null; };
  if (Object.values(bad).some(Boolean)) {
    const k = Object.keys(bad).find(x => bad[x]);
    const nm = { icr: 'carb ratio', isf: 'correction factor', target: 'target', bg: 'blood sugar reading', iob: 'insulin on board' }[k];
    clear(); return say(bub, img, 'That ' + nm + ' looks off. Check the number and the units.', 'point', 'warn');
  }
  if (!icr || !isf || !target) { clear(); return say(bub, img, 'Add your carb ratio, correction factor, and target. They\'re on your prescription.', 'think'); }
  if (bg == null) { clear(); return say(bub, img, 'Now your blood sugar reading.', 'think'); }

  const r = calcBolus({ carbs: t.carbs, icr, isf, target, bg, iob, step: roundStep });
  const old = doseEl.textContent;
  if (r.status !== 'ok') {
    clear(); doseEl.textContent = '0'; box.classList.add('none');
    $('#bMath').textContent = 'No dose under ' + fromMg(70) + ' ' + gLabel() + '.';
    return say(bub, img, r.status === 'severe-low'
      ? 'That\'s a serious low. Take 15 to 20 g of fast sugar now. No insulin. If you feel confused or faint, get help right away.'
      : 'You\'re low. No insulin yet. Take about 15 g of fast carbs, recheck in 15 minutes, repeat until you\'re above ' + fromMg(70) + '.', 'point', 'danger');
  }
  box.classList.remove('none');
  doseEl.textContent = r.dose.toFixed(roundStep === 1 ? 0 : 1);
  $('#doseBarN').textContent = doseEl.textContent;
  if (doseEl.textContent !== old) { doseEl.classList.remove('tick'); void doseEl.offsetWidth; doseEl.classList.add('tick'); }
  const sign = v => (v >= 0 ? '+' : '−') + fmt(Math.abs(v), 2);
  $('#bkFood').textContent = fmt(t.carbs, 0) + ' g ÷ ' + icr + ' = ' + fmt(r.food, 2) + ' u';
  $('#bkCorr').textContent = '(' + fromMg(bg) + ' − ' + fromMg(target) + ') ÷ ' + fromMg(isf) + ' = ' + sign(r.corr) + ' u';
  $('#bkIob').textContent = iob ? '−' + fmt(iob, 2) + ' u' : 'none entered';
  $('#bMath').textContent = fmt(r.food, 2) + ' ' + sign(r.corr).replace(/^([+−])/, '$1 ') + (iob ? ' − ' + fmt(iob, 2) : '') + ' = ' + fmt(Math.max(r.raw, 0), 2) + ' units, rounded down to ' + doseEl.textContent + '.';
  lastCalc = { dose: r.dose, carbs: t.carbs, bg, items: plate.map(p => p.name) };
  const example = !$('#bExampleFlag').hidden;
  $('#bLog').disabled = example;
  $('#bLogNote').textContent = example ? 'Example numbers can\'t be logged.' : (session ? '' : 'Saves on this device. Sign in to keep it.');

  if (r.raw <= 0 && (t.carbs > 0 || bg > target)) return say(bub, img, 'The insulin already on board covers this. No extra dose.', 'point', 'warn');
  if (r.dose >= 20 || t.carbs >= 150) return say(bub, img, 'That\'s a big number. Go back over every input before you dose.', 'point', 'warn');
  if (bg > 250) return say(bub, img, 'That reading is high. With type 1, check ketones the way your care plan says, and call your team if it stays up.', 'point', 'warn');
  if (t.fat >= 30 || t.prot >= 40) return say(bub, img, 'Heavy on ' + (t.fat >= 30 && t.prot >= 40 ? 'fat and protein' : t.fat >= 30 ? 'fat' : 'protein') + '. Sugar may climb again hours later. Check again, and ask your team how to dose meals like this.', 'think', 'warn');
  if (!plate.length) return say(bub, img, 'Correction only. Add food if you\'re eating.', 'think');
  if (example) return say(bub, img, 'See how it works? Now use your own numbers.', 'wave');
  say(bub, img, 'Math checks out. Read each input once more, then dose the way you were taught.', 'thumbs');
}
$('#bLog').addEventListener('click', () => {
  if (!lastCalc) return;
  data.log.unshift(Object.assign({ t: Date.now() }, lastCalc)); data.log = data.log.slice(0, 200); save();
  DD.emit('log'); toast('Saved to your log.'); say($('#bBubble'), $('#bBates'), 'Logged. Future you says thanks.', 'hop'); $('#bBates')._bates.act(2.5);
});

/* phones: the dose result sits below the form, so a bar at the bottom shows it while you type */
const doseBar = $('#doseBar');
let resultSeen = false;
if ('IntersectionObserver' in window) new IntersectionObserver(e => { resultSeen = e[0].isIntersecting; syncDoseBar(); }).observe($('#bResult'));
function syncDoseBar() { const n = $('#bDose').textContent; doseBar.hidden = resultSeen || $('[data-view=bolus]').hidden || !/\d/.test(n) || innerWidth > 900; }
doseBar.addEventListener('click', () => $('#bResult').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }));
setInterval(syncDoseBar, 600);
$('#mealJump').addEventListener('click', () => $('[data-view=meals] aside').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }));

/* ================= BASAL ================= */
const wtUnit = { t1: 'kg', t2: 'kg' };
$$('.unit-toggle').forEach(b => b.addEventListener('click', () => {
  const k = b.dataset.wt; wtUnit[k] = wtUnit[k] === 'kg' ? 'lb' : 'kg'; b.textContent = wtUnit[k]; basal();
}));
const kgOf = (el, k) => { const v = num(el); return v == null ? null : (wtUnit[k] === 'lb' ? v / 2.20462 : v); };
$$('#basalMode button').forEach(b => b.addEventListener('click', () => {
  $$('#basalMode button').forEach(x => x.classList.toggle('on', x === b));
  $$('[data-basal]').forEach(g => g.hidden = g.dataset.basal !== b.dataset.mode);
  $$('[data-basal]:not([hidden]) canvas.bates').forEach(c => c._bates.kick());
}));
let t1Know = 'yes';
$$('#t1Know button').forEach(b => b.addEventListener('click', () => {
  t1Know = b.dataset.k; $$('#t1Know button').forEach(x => x.classList.toggle('on', x === b));
  $('#t1TddBox').hidden = t1Know !== 'yes'; $('#t1WtBox').hidden = t1Know === 'yes'; basal();
}));
function basal() {
  const kg = kgOf($('#t1Wt'), 't1');
  const tdd = t1Know === 'yes' ? num($('#t1Tdd')) : (kg ? kg * .5 : null);
  const b1 = $('#t1Bubble'), i1 = $('#t1Bates');
  if (!tdd || tdd <= 0) {
    ['t1Basal', 't1Rate', 't1Bolus', 't1TddOut'].forEach(i => $('#' + i).textContent = '–');
    say(b1, i1, t1Know === 'yes' ? 'How much insulin do you take in a whole day? Not sure? Switch to weight.' : 'Your weight, please.', 'sit');
  } else if (tdd > 300 || (kg && (kg < 15 || kg > 300))) {
    say(b1, i1, 'That number looks off. Check it and the units.', 'point', 'warn');
  } else {
    const r = calcBasalT1(tdd, 50);
    $('#t1Basal').textContent = fmt(r.basal, 1); $('#t1Rate').textContent = fmt(r.rate, 2) + ' units/hour';
    $('#t1Bolus').textContent = fmt(r.bolus, 1) + ' units/day'; $('#t1TddOut').textContent = fmt(tdd, 1) + ' units/day' + (t1Know === 'yes' ? '' : ' (estimate)');
    say(b1, i1, 'About half your daily insulin is basal. Your care team fine-tunes it with fasting checks.', 'thumbs');
  }
  const kg2 = kgOf($('#t2Wt'), 't2'), dose = num($('#t2Dose')), fast = num($('#t2Fast')), lo = num($('#t2Lo')) || 80, hi = num($('#t2Hi')) || 130, hypo = $('#t2Hypo').checked;
  const b2 = $('#t2Bubble'), i2 = $('#t2Bates');
  $('#t2Range').textContent = kg2 ? fmt(kg2 * .1, 0) + ' to ' + fmt(kg2 * .2, 0) + ' units' : '0.1–0.2 units/kg';
  let msg = 'Guidelines start at 10 units a day, or 0.1 to 0.2 units per kg. Your prescriber picks.', pose = 'sit', tone = '', tit = '–';
  if (dose != null && dose > 0 && (hypo || fast != null)) {
    if (hypo || (fast != null && fast < 70)) { tit = 'Lower to ' + fmt(dose * .8, 0) + '–' + fmt(dose * .9, 0) + ' units'; msg = 'A low changes things. Guidelines say find the cause, and if there isn\'t one, cut 10 to 20%. Call your care team first.'; pose = 'point'; tone = 'warn'; }
    else if (fast > hi) { tit = '+2 units → ' + fmt(dose + 2, 0); msg = 'Fasting is above target. A common plan adds 2 units every 3 days. Confirm yours with your team.'; pose = 'think'; }
    else if (fast < lo) { tit = '−2 units → ' + fmt(Math.max(dose - 2, 0), 0); msg = 'Fasting is under target. Plans usually step down 2 units. Check with your team.'; pose = 'point'; tone = 'warn'; }
    else { tit = 'Hold at ' + fmt(dose, 0); msg = 'Mornings are in range. Hold steady.'; pose = 'thumbs'; }
    if (kg2 && dose / kg2 > .5 && !hypo) { msg = 'You\'re past 0.5 units per kg. More basal often stops helping there. Ask your team about other options.'; pose = 'point'; tone = 'warn'; }
  }
  $('#t2Tit').textContent = tit;
  say(b2, i2, msg, pose, tone);
}
$$('[data-view=basal] input').forEach(i => i.addEventListener('input', basal));

/* ---------- shared with the other scripts ---------- */
const listeners = {};
const DD = window.DD = {
  tidy, brandedFood, $, $$, num, fmt, esc, clamp, reduce, store, toast, say, confetti, CONFIG, MMOL, calcBolus, calcRatios, floorTo, blank, sb: null,
  get data() { return data; }, set data(v) { data = v; },
  get session() { return session; }, set session(v) { session = v; },
  dataKey, save,
  on(ev, fn) { (listeners[ev] = listeners[ev] || []).push(fn); },
  emit(ev) { (listeners[ev] || []).forEach(f => f()); },
  onRoute(view, fn) { (routeHooks[view] = routeHooks[view] || []).push(fn); },
  moveInk: () => moveInk(navActive),
  /* put a ready-made meal on the plate in the Meal dose tool */
  loadPlate(items) { plate = []; items.forEach(f => addFood(f)); location.hash = 'bolus'; },
  start() { basal(); compute(); route(); if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => moveInk(navActive)); }
};
DD.on('settings', () => loadSettingsIntoBolus(true));
})();
