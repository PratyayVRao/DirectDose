/* Today's meals. Picks a breakfast, lunch, snack and dinner that together meet daily nutrition goals.
   Default goals follow the Dietary Guidelines for Americans 2025-2030 and the FDA Daily Values on food labels.
   The plan also leans toward low glycemic index foods, more so when the account's own test meals ran high,
   and shows the carb dose for each meal at the account's own carb ratio. */
(function () {
'use strict';
const MEALS = window.MEALS || [];
const { $, $$, fmt, esc, say, toast } = DD;
/* [id, label, which kind of meal fills it] */
const SLOTS = [['b', 'Breakfast', 'b'], ['s1', 'Morning snack', 's'], ['l', 'Lunch', 'l'], ['s2', 'Afternoon snack', 's'], ['d', 'Dinner', 'd']];
const DIETS = [['veg', 'Vegetarian', 'mpbf'], ['vegan', 'Vegan', 'mpbfed'], ['nopork', 'No pork', 'p'], ['nobeef', 'No beef', 'b'], ['nofish', 'No fish', 'f'], ['noegg', 'No egg', 'e'], ['df', 'Dairy-free', 'd'], ['gf', 'Gluten-free', 'g'], ['nf', 'Nut-free', 'n'], ['sf', 'Soy-free', 'y']];
const CUISINES = [...new Set(MEALS.map(m => m[2]))];
const PRIS = [['protein', 'More protein'], ['fiber', 'More fiber'], ['steady', 'Steady blood sugar'], ['lowcarb', 'Fewer carbs'], ['heart', 'Heart-healthy']];
const CALS = [1600, 2000, 2400, 2800];
const PORTION = { 0.75: '¾', 1: '1', 1.25: '1¼', 1.5: '1½', 1.75: '1¾', 2: '2' };
const C = { carbs: 4, fiber: 5, prot: 6, fat: 7, sat: 8, sugar: 9, gi: 10, plate: 11 };

const prefs = () => {
  const d = DD.data;
  d.prefs = Object.assign({ diet: [], cuisine: [], avoid: '', pri: [], cal: 2000, kg: null, unit: 'kg' }, d.prefs || {});
  delete d.prefs.carb; delete d.prefs.shuffle;
  return d.prefs;
};
const today = () => new Date().toDateString();
const kcal = m => 4 * (m[C.carbs] - m[C.fiber]) + 2 * m[C.fiber] + 4 * m[C.prot] + 9 * m[C.fat];
const rng = seed => { let x = seed | 0 || 1; return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return ((x >>> 0) % 10000) / 10000; }; };
const hash = s => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7);

/* what the account's own data says */
function profile() {
  const d = DD.data, tests = (d.icr && d.icr.tests || []).filter(t => t.v);
  const spiky = tests.filter(t => t.v === 'weak' || (t.bg2 != null && t.bg2 - t.bg0 > 80)).length >= 2;
  const lows = tests.filter(t => t.v === 'low').length;
  return { icr: d.settings.icr || null, spiky, lows };
}
function targets(p, pr) {
  const cal = p.cal || 2000, k = p.kg || 70, pri = new Set(p.pri);
  return {
    cal, pri, kgKnown: !!p.kg,
    protLo: Math.round((pri.has('protein') ? 1.4 : 1.2) * k), protHi: Math.round(1.6 * k),
    fiber: Math.round(cal / 1000 * (pri.has('fiber') ? 17.5 : 14)),
    carbMax: Math.round(cal * (pri.has('lowcarb') ? .40 : .55) / 4),
    fatMax: Math.round(cal * .35 / 9),
    satMax: Math.round(cal * (pri.has('heart') ? .07 : .10) / 9),
    sugarMeal: 10,
    wGI: 1 + (pri.has('steady') ? 2 : 0) + (pr.spiky ? 1 : 0)
  };
}
function allowed(m, p) {
  const banned = DIETS.filter(d => p.diet.includes(d[0])).map(d => d[2]).join('');
  if ([...m[3]].some(c => banned.includes(c))) return false;
  const avoid = p.avoid.toLowerCase().split(',').map(s => s.trim()).filter(Boolean);
  const text = (m[0] + ' ' + m[C.plate]).toLowerCase();
  return !avoid.some(a => text.includes(a));
}

/* one day: three meals and two snacks. The meals share one portion size (up to 1½ servings) so calories land
   near the goal; snacks double only when the day would still fall well short. */
function evalDay(day, T, p) {
  let main = 0, snack = 0;
  day.forEach((m, i) => { if (SLOTS[i][2] === 's') snack += kcal(m); else main += kcal(m); });
  const f = Math.min(1.5, Math.max(.75, Math.round((T.cal - snack) / main * 4) / 4));
  const ks = f === 1.5 && main * 1.5 + snack < T.cal * .92 ? 2 : 1;
  const k = day.map((m, i) => SLOTS[i][2] === 's' ? ks : f);
  let c = 0, fib = 0, pr = 0, fat = 0, sat = 0, sugarMax = 0, cal = 0, P = 0;
  day.forEach((m, i) => {
    c += m[C.carbs] * k[i]; fib += m[C.fiber] * k[i]; pr += m[C.prot] * k[i]; fat += m[C.fat] * k[i]; sat += m[C.sat] * k[i]; cal += kcal(m) * k[i];
    const mc = m[C.carbs] * k[i], ms = m[C.sugar] * k[i];
    sugarMax = Math.max(sugarMax, ms);
    P += Math.max(0, ms - T.sugarMeal) * 1.5;
    P += (m[C.gi] - 1) * mc / 15 * T.wGI;
    if (T.pri.has('steady') && SLOTS[i][2] !== 's') P += Math.max(0, mc - 60) * .4;
    if (p.cuisine.length && !p.cuisine.includes(m[2])) P += 6;
  });
  P += Math.abs(cal - T.cal) / T.cal * 60;
  if (pr < T.protLo) P += (T.protLo - pr) * (T.pri.has('protein') ? 1.2 : .6);
  if (pr > T.protHi * 1.15) P += (pr - T.protHi * 1.15) * .3;
  if (fib < T.fiber) P += (T.fiber - fib) * (T.pri.has('fiber') ? 1.6 : .8);
  if (c > T.carbMax) P += (c - T.carbMax) * (T.pri.has('lowcarb') ? .75 : .25);
  if (T.pri.has('lowcarb')) P += c * .03;
  if (fat > T.fatMax) P += (fat - T.fatMax) * .3;
  if (sat > T.satMax) P += (sat - T.satMax) * (T.pri.has('heart') ? 3 : 1);
  return { P, k, c, fib, pr, fat, sat, sugarMax, cal };
}

function prefilter(type, T, p, seed, avoidNames, size) {
  const R = rng(seed);
  return MEALS.filter(m => m[1] === type && allowed(m, p)).map(m => {
    let s = (m[C.gi] - 1) * m[C.carbs] / 15 * T.wGI - m[C.fiber] * .6 - m[C.prot] * .12 + Math.max(0, m[C.sugar] - 10) * 1.5 + m[C.sat] * .25;
    if (p.cuisine.length && !p.cuisine.includes(m[2])) s += 6;
    if (avoidNames.has(m[0])) s += 14;
    return [s + R() * 9, m];
  }).sort((a, b) => a[0] - b[0]).slice(0, size).map(x => x[1]);
}
function bestDay(T, p, seed, avoidNames) {
  const pools = SLOTS.map(([, , type], i) => prefilter(type, T, p, seed + (type === 's' ? 3 : i) * 977, avoidNames, type === 's' ? 8 : 10));
  if (pools.some(x => !x.length)) return null;
  const R = rng(seed + 5);
  let best = null;
  for (const b of pools[0]) for (const s1 of pools[1]) for (const l of pools[2]) for (const s2 of pools[3]) {
    if (s1 === s2 && pools[1].length > 1) continue;
    for (const d of pools[4]) {
      const score = evalDay([b, s1, l, s2, d], T, p).P + R() * 2;
      if (!best || score < best.score) best = { score, day: [b, s1, l, s2, d] };
    }
  }
  return best.day;
}

/* the plan for today is kept until something changes */
function planKey(p) { return JSON.stringify([p.diet, p.cuisine, p.avoid, p.pri, p.cal, p.kg]); }
function getPlan(T, p, force) {
  const d = DD.data, key = planKey(p), byName = n => MEALS.find(m => m[0] === n);
  let plan = d.mealPlan;
  if (!force && plan && plan.day === today() && plan.key === key) {
    const day = SLOTS.map(([s]) => byName(plan.picks[s]));
    if (day.every(m => m && allowed(m, p))) return day;
  }
  const old = plan && plan.day === today() && plan.seen ? plan : { seen: {}, n: 0 };
  const n = (old.n || 0) + (force ? 1 : 0);
  const recent = new Set(Object.values(d.mealRecent || {}).flat());
  const avoidNames = new Set([...recent, ...(force && plan ? Object.values(plan.picks) : [])]);
  const day = bestDay(T, p, hash(today() + key) + n * 7919, avoidNames);
  if (!day) return null;
  d.mealPlan = { day: today(), key, n, picks: Object.fromEntries(SLOTS.map(([s], i) => [s, day[i][0]])), seen: Object.fromEntries(SLOTS.map(([s], i) => [s, [...new Set([...(old.seen && old.seen[s] || []), day[i][0]])]])) };
  return day;
}
function swap(slot) {
  const p = prefs(), pr = profile(), T = targets(p, pr), d = DD.data, plan = d.mealPlan;
  const i = SLOTS.findIndex(x => x[0] === slot), type = SLOTS[i][2], byName = n => MEALS.find(m => m[0] === n);
  const day = SLOTS.map(([s]) => byName(plan.picks[s]));
  const others = new Set(day.filter((m, j) => j !== i).map(m => m[0]));
  let seen = new Set(plan.seen[slot] || []);
  let pool = MEALS.filter(m => m[1] === type && allowed(m, p) && !seen.has(m[0]) && !others.has(m[0]));
  if (!pool.length) { seen = new Set([day[i][0]]); pool = MEALS.filter(m => m[1] === type && allowed(m, p) && !seen.has(m[0]) && !others.has(m[0])); }
  if (!pool.length) return toast('No other ' + SLOTS[i][1].toLowerCase() + ' fits your filters.');
  const R = rng(Date.now() & 0xffff);
  const best = pool.map(m => { const t = day.slice(); t[i] = m; return [evalDay(t, T, p).P + R() * 6, m]; }).sort((a, b) => a[0] - b[0])[0][1];
  plan.picks[slot] = best[0]; plan.seen[slot] = [...seen, best[0]];
  DD.save(); render(slot);
}

/* ---------- drawing ---------- */
function goalRow(label, val, lo, hi, unit, kind) {
  const max = (hi || lo) * 1.35, pct = Math.min(100, val / max * 100), a = lo ? lo / max * 100 : 0, b = hi ? Math.min(100, hi / max * 100) : 100;
  const ok = kind === 'min' ? val >= lo * .97 : kind === 'max' ? val <= hi * 1.03 : val >= lo * .93 && val <= hi * 1.07;
  const word = ok ? 'on track' : (kind === 'max' || (kind === 'range' && val > hi)) ? 'a bit high' : 'a bit low';
  const goal = kind === 'min' ? 'at least ' + fmt(lo, 0) : kind === 'max' ? 'under ' + fmt(hi, 0) : fmt(lo, 0) + '–' + fmt(hi, 0);
  return `<div class="goal ${ok ? 'ok' : 'off'}"><div class="g-top"><b>${label}</b><span>${fmt(val, 0)}${unit} <em>· goal ${goal}${unit}</em></span><i>${word}</i></div>
    <div class="g-bar"><span class="g-zone" style="left:${a}%;width:${b - a}%"></span><span class="g-fill" style="width:${pct}%"></span></div></div>`;
}
function render(changed) {
  const p = prefs(), pr = profile(), T = targets(p, pr);
  $('#mealPri').innerHTML = PRIS.map(x => `<button class="pill ${p.pri.includes(x[0]) ? 'on' : ''}" data-pri="${x[0]}">${x[1]}</button>`).join('');
  $('#mealCal').innerHTML = CALS.map(c => `<button class="${p.cal === c ? 'on' : ''}" data-cal="${c}">${c.toLocaleString('en-US')}</button>`).join('');
  $('#mealDiet').innerHTML = DIETS.map(d => `<button class="pill ${p.diet.includes(d[0]) ? 'on' : ''}" data-diet="${d[0]}">${d[1]}</button>`).join('');
  $('#mealCuisine').innerHTML = CUISINES.map(c => `<button class="pill ${p.cuisine.includes(c) ? 'on' : ''}" data-cuisine="${esc(c)}">${esc(c)}</button>`).join('');
  if (document.activeElement !== $('#mealAvoid')) $('#mealAvoid').value = p.avoid;
  if (document.activeElement !== $('#mealKg')) $('#mealKg').value = p.kg ? Math.round(p.unit === 'lb' ? p.kg * 2.20462 : p.kg) : '';
  $('#mealKgUnit').textContent = p.unit;

  const day = getPlan(T, p, changed === 'new');
  if (!day) {
    $('#mealPlan').innerHTML = '<div class="card"><h4>Nothing fits those filters</h4><p class="fine">Loosen a filter or clear the foods to skip.</p></div>';
    $('#mealGoals').innerHTML = ''; return;
  }
  DD.data.mealRecent = Object.assign({}, DD.data.mealRecent, { [today()]: day.map(m => m[0]) });
  const ks = Object.keys(DD.data.mealRecent); if (ks.length > 4) delete DD.data.mealRecent[ks[0]];
  DD.save();

  const e = evalDay(day, T, p);
  const short = T.cal - e.cal;
  $('#mealGoals').innerHTML = `<div class="row-between"><h4>Today vs your goals</h4><span class="fine">${fmt(e.cal, 0)} of ${T.cal.toLocaleString('en-US')} calories</span></div>
    ${short > T.cal * .08 ? `<p class="fine">About ${fmt(Math.round(short / 50) * 50, 0)} calories short. Add a side like fruit, yogurt, or a handful of nuts.</p>` : ''}
    ${goalRow('Protein', e.pr, T.protLo, T.protHi, ' g', 'range')}
    ${goalRow('Fiber', e.fib, T.fiber, null, ' g', 'min')}
    ${goalRow('Carbs', e.c, null, T.carbMax, ' g', 'max')}
    ${goalRow('Fat', e.fat, null, T.fatMax, ' g', 'max')}
    ${goalRow('Saturated fat', e.sat, null, T.satMax, ' g', 'max')}
    ${goalRow('Added sugar, most in one meal', e.sugarMax, null, T.sugarMeal, ' g', 'max')}
    ${T.kgKnown ? '' : '<p class="fine">Protein goal is for a 70 kg adult. Add your weight to set yours.</p>'}`;

  let units = 0;
  $('#mealPlan').innerHTML = day.map((m, i) => {
    const [slot, label] = SLOTS[i], k = e.k[i], c = Math.round(m[C.carbs] * k);
    const small = SLOTS[i][2] === 's';
    const dose = pr.icr ? DD.floorTo(c / pr.icr, .5) : null; if (dose != null) units += dose;
    const tags = [m[C.gi] === 1 ? 'slow carbs' : m[C.gi] === 2 ? 'medium-speed carbs' : 'fast carbs', m[C.fiber] * k >= 8 ? 'high fiber' : null, m[C.prot] * k >= 25 ? 'high protein' : null, m[C.fat] * k >= 25 || m[C.prot] * k >= 40 ? 'rich meal: blood sugar may rise late' : null].filter(Boolean);
    return `<article class="meal card sk${small ? ' snack' : ''}" data-slot="${slot}"><p class="result-label">${label} · ${esc(m[2])}</p><h4>${esc(m[0])}</h4>
      <p class="plate-desc">${k !== 1 ? `<b class="portion">${PORTION[k]} servings</b> of ` : ''}${esc(m[C.plate])}</p>
      <div class="macros"><div><b>${c}</b><span>g carbs</span></div><div><b>${Math.round(m[C.fiber] * k)}</b><span>g fiber</span></div><div><b>${Math.round(m[C.prot] * k)}</b><span>g protein</span></div><div><b>${dose == null ? '–' : fmt(dose, 1)}</b><span>${dose == null ? 'find your ratio' : 'units for carbs'}</span></div></div>
      <p class="fine">${tags.join(' · ')}</p>
      <div class="row-between"><button class="btn sk small" data-swap="${slot}">Swap</button><button class="btn sk small primary" data-use="${slot}">Dose this meal</button></div></article>`;
  }).join('');
  $('#mealTotals').innerHTML = pr.icr
    ? 'At your ratio of 1 : ' + pr.icr + ', today\'s food needs about <b>' + fmt(units, 1) + ' units</b> of mealtime insulin before any correction. Meal dose adds the correction from your blood sugar reading.'
    : 'Find your carb ratio and each meal will show its own insulin dose. <a href="#ratio">Find my ratio</a>';

  const msg = T.pri.has('lowcarb') ? 'Eating fewer carbs changes how much insulin you need. Talk to your care team before you switch.'
    : pr.spiky ? 'Your test meals ran high, so I picked slower carbs and more fiber today.'
    : pr.lows ? 'You\'ve had a low during testing. Eat the whole meal when you dose for it.'
    : !T.kgKnown ? 'Add your weight below and I\'ll set your protein goal.'
    : 'Every goal is covered. Tap Swap to trade any meal.';
  say($('#mealBubble'), $('#mealBates'), msg, T.pri.has('lowcarb') || pr.lows ? 'point' : 'thumbs', T.pri.has('lowcarb') ? 'warn' : '');

  DD._meals = Object.fromEntries(day.map((m, i) => [SLOTS[i][0], [m, e.k[i]]]));
  if (window.anime && !DD.reduce) {
    const tgt = changed && SLOTS.some(x => x[0] === changed) ? '.meal[data-slot="' + changed + '"]' : changed ? '.meal' : null;
    if (tgt) anime({ targets: tgt, translateY: [16, 0], rotate: [-2, 0], opacity: [.3, 1], delay: anime.stagger(60), duration: 520, easing: 'easeOutBack' });
    anime({ targets: '#mealGoals .g-fill', scaleX: [0, 1], duration: 700, delay: anime.stagger(50), easing: 'easeOutCubic' });
  }
}

/* ---------- controls ---------- */
const commit = how => { DD.save(); render(how || 'all'); };
document.addEventListener('click', e => {
  const t = e.target.closest('[data-diet],[data-cuisine],[data-swap],[data-use],[data-pri],[data-cal]'); if (!t || !t.closest('[data-view=meals]')) return;
  const p = prefs();
  if (t.dataset.diet) { const k = t.dataset.diet; p.diet = p.diet.includes(k) ? p.diet.filter(x => x !== k) : p.diet.concat(k); commit(); }
  else if (t.dataset.cuisine) { const k = t.dataset.cuisine; p.cuisine = p.cuisine.includes(k) ? p.cuisine.filter(x => x !== k) : p.cuisine.concat(k); commit(); }
  else if (t.dataset.pri) { const k = t.dataset.pri; p.pri = p.pri.includes(k) ? p.pri.filter(x => x !== k) : p.pri.concat(k).slice(-2); commit(); }
  else if (t.dataset.cal) { p.cal = +t.dataset.cal; commit(); }
  else if (t.dataset.swap) swap(t.dataset.swap);
  else if (t.dataset.use) {
    const [m, k] = DD._meals[t.dataset.use];
    DD.loadPlate([[m[0], (k !== 1 ? PORTION[k] + ' servings: ' : '') + m[C.plate], Math.round(m[C.carbs] * k), Math.round(m[C.fiber] * k), Math.round(m[C.prot] * k), Math.round(m[C.fat] * k)]]);
  }
});
$('#mealAvoid').addEventListener('change', e => { prefs().avoid = e.target.value; commit(); });
$('#mealKg').addEventListener('change', e => { const p = prefs(), v = parseFloat(e.target.value); p.kg = v > 0 ? (p.unit === 'lb' ? v / 2.20462 : v) : null; if (p.kg && (p.kg < 20 || p.kg > 250)) { p.kg = null; toast('That weight looks off. Check the number and units.'); } commit(); });
$('#mealKgUnit').addEventListener('click', () => { const p = prefs(); p.unit = p.unit === 'kg' ? 'lb' : 'kg'; DD.save(); render(); });
$('#mealShuffle').addEventListener('click', () => commit('new'));
DD.onRoute('meals', () => render('all'));
DD.on('account', () => { if (!$('[data-view=meals]').hidden) render(); });
DD.on('settings', () => { if (!$('[data-view=meals]').hidden) render(); });
DD.meals = { evalDay, targets, bestDay };
})();
