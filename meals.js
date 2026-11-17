/* Meal ideas for today. Picks follow the diabetes plate method and published nutrition guidance:
   steady carbs per meal, more fiber, lower glycemic index, enough protein. Personal data tunes the picks.
   [name, slot b/l/d/s, cuisine, contains (m meat, p pork, b beef, f fish, e egg, d dairy, g gluten, n nuts),
    carbs, fiber, protein, fat, glycemic index 1 low / 2 medium / 3 high, what's on the plate] */
(function () {
'use strict';
const MEALS = [
["Ragi dosa with sambar","b","South Indian","",38,7,10,6,1,"2 ragi dosas, 1 cup sambar"],
["Idli with sambar and chutney","b","South Indian","",45,6,11,5,2,"3 idlis, 1 cup sambar, coconut chutney"],
["Vegetable upma","b","South Indian","g",40,5,8,9,2,"1 cup upma with peas and carrots"],
["Pesarattu with ginger chutney","b","South Indian","",30,8,13,6,1,"2 green gram dosas, chutney"],
["Moong dal chilla","b","North Indian","",28,8,14,7,1,"2 chillas, mint chutney"],
["Poha with peanuts and peas","b","North Indian","n",46,4,8,9,2,"1 cup poha, peanuts, peas, lemon"],
["Oatmeal with berries and walnuts","b","American","gn",38,8,9,11,1,"1 cup cooked oats, berries, walnuts"],
["Greek yogurt with berries and seeds","b","American","d",26,5,20,6,1,"plain Greek yogurt, berries, chia seeds"],
["Veggie omelet with whole wheat toast","b","American","eg",28,5,20,16,1,"2-egg omelet with vegetables, 2 slices toast"],
["Avocado toast with egg","b","American","eg",30,8,14,18,1,"2 slices whole grain toast, avocado, 1 egg"],
["Tofu scramble with vegetables and toast","b","American","g",30,6,20,12,1,"tofu, peppers, spinach, 2 slices toast"],
["Chia pudding with fruit","b","American","",28,12,8,12,1,"chia in soy milk, sliced fruit"],
["Huevos rancheros","b","Mexican","e",34,9,18,16,1,"2 eggs, 2 corn tortillas, black beans, salsa"],
["Shakshuka with pita","b","Middle Eastern","eg",36,6,17,14,1,"2 eggs in tomato sauce, 1 small pita"],
["Congee with egg and greens","b","East Asian","e",40,2,12,6,3,"1.5 cups congee, egg, bok choy"],
["Ragi mudde with soppu saaru","l","South Indian","",48,9,12,5,1,"1 ragi ball, greens and lentil curry, salad"],
["Sambar rice with palya","l","South Indian","",55,9,13,8,2,"1 cup rice with sambar, cabbage palya, cucumber"],
["Curd rice with vegetable palya","l","South Indian","d",45,5,10,8,2,"1 cup curd rice, beans palya"],
["Chapati, dal, and sabzi","l","North Indian","g",50,12,17,10,1,"2 chapatis, 1 cup dal, mixed vegetables"],
["Rajma with brown rice","l","North Indian","",58,14,16,6,1,"1 cup rajma, 3/4 cup brown rice, salad"],
["Chicken curry with chapati and salad","l","North Indian","mg",32,6,32,14,1,"1 cup chicken curry, 1 chapati, salad"],
["Grilled chicken salad with quinoa","l","American","m",32,7,36,14,1,"chicken, greens, 3/4 cup quinoa"],
["Turkey and veggie whole wheat wrap","l","American","mg",38,6,28,11,1,"1 wrap, turkey, lettuce, tomato, side of fruit"],
["Tuna salad on whole grain bread","l","American","feg",30,5,26,14,1,"tuna sandwich, carrot sticks"],
["Black bean burrito bowl","l","Mexican","",55,15,17,10,1,"brown rice, black beans, fajita vegetables, salsa"],
["Chicken tacos on corn tortillas","l","Mexican","m",36,6,30,12,2,"3 small tacos, cabbage, salsa"],
["Lentil soup with side salad","l","Mediterranean","",40,15,18,6,1,"1.5 cups lentil soup, green salad"],
["Greek salad with chickpeas and feta","l","Mediterranean","d",30,9,15,18,1,"big salad, 1/2 cup chickpeas, feta"],
["Falafel bowl","l","Middle Eastern","g",48,12,16,18,1,"4 falafel, hummus, salad, 1/2 pita"],
["Tofu and vegetable stir-fry with brown rice","l","East Asian","g",48,7,20,12,1,"tofu, mixed vegetables, 3/4 cup brown rice"],
["Salmon rice bowl with edamame","l","East Asian","f",45,6,32,16,2,"salmon, 3/4 cup rice, edamame, cucumber"],
["Jollof rice with grilled chicken and greens","l","African","m",52,5,30,12,2,"1 cup jollof, chicken, sautéed greens"],
["Bisi bele bath with salad","d","South Indian","",52,9,13,10,2,"1.25 cups bisi bele bath, kosambari salad"],
["Jowar roti with ennegayi","d","South Indian","n",44,10,10,14,1,"2 jowar rotis, stuffed brinjal curry, salad"],
["Grilled fish with palya and rice","d","South Indian","f",35,5,32,10,2,"fish, vegetable palya, 1/2 cup rice"],
["Palak paneer with rotis","d","North Indian","dg",40,8,22,20,1,"1 cup palak paneer, 2 rotis"],
["Chana masala with brown rice","d","North Indian","",56,14,16,9,1,"1 cup chana, 3/4 cup brown rice"],
["Tandoori chicken, dal, and salad","d","North Indian","md",26,9,40,12,1,"2 pieces chicken, 1 cup dal, salad"],
["Baked salmon, roasted vegetables, quinoa","d","American","f",34,7,36,18,1,"salmon, vegetables, 3/4 cup quinoa"],
["Turkey chili with beans","d","American","m",32,11,30,10,1,"1.5 cups chili, side salad"],
["Chicken fajitas","d","Mexican","m",38,7,32,14,2,"chicken, peppers, onions, 3 corn tortillas"],
["Whole wheat pasta with vegetables and chickpeas","d","Mediterranean","g",55,12,18,10,1,"1 cup pasta, vegetables, chickpeas, olive oil"],
["Grilled chicken, Greek salad, small pita","d","Mediterranean","mdg",30,5,38,16,1,"chicken, salad with feta, 1/2 pita"],
["Beef and broccoli with brown rice","d","East Asian","mbg",45,6,30,14,1,"beef, broccoli, 3/4 cup brown rice"],
["Miso-glazed tofu with greens and rice","d","East Asian","g",46,6,22,12,2,"tofu, bok choy, 3/4 cup rice"],
["Chicken shawarma plate with salad","d","Middle Eastern","m",34,7,36,16,1,"chicken, salad, hummus, 1/2 cup rice"],
["Mujadara with cucumber salad","d","Middle Eastern","",54,13,17,10,1,"1.25 cups lentils and rice, salad"],
["Bean and vegetable stew with injera","d","African","",50,12,16,7,1,"1 cup stew, 1 injera, greens"],
["Egusi stew with a small portion of fufu","d","African","m",42,6,28,24,2,"1 cup egusi, 1/2 ball fufu, greens"],
["Apple with peanut butter","s","American","n",22,5,5,9,1,"1 small apple, 1 tbsp peanut butter"],
["Roasted chana","s","South Indian","",18,6,7,2,1,"1/4 cup roasted chickpeas"],
["Sprouted moong salad","s","South Indian","",15,6,8,1,1,"1 cup sprouts, cucumber, lemon"],
["Majjige and a small fruit","s","South Indian","d",18,2,5,2,1,"1 cup buttermilk, 1 small orange"],
["Greek yogurt with berries","s","American","d",14,2,15,2,1,"3/4 cup yogurt, berries"],
["Almonds and a clementine","s","American","n",14,4,6,14,1,"small handful almonds, 1 clementine"],
["Whole grain crackers with cheese","s","American","dg",16,3,8,9,1,"5 crackers, 1 oz cheese"],
["Hummus with carrots and cucumber","s","Mediterranean","",14,5,5,7,1,"1/4 cup hummus, vegetables"],
["Guacamole with veggie sticks","s","Mexican","",12,7,3,13,1,"1/4 cup guacamole, peppers, jicama"],
["Edamame","s","East Asian","",9,5,11,5,1,"3/4 cup edamame in pods"]
];
const DIETS = [['veg', 'Vegetarian', 'mpbf'], ['vegan', 'Vegan', 'mpbfed'], ['nopork', 'No pork', 'p'], ['nobeef', 'No beef', 'b'], ['nofish', 'No fish', 'f'], ['noegg', 'No egg', 'e'], ['df', 'Dairy-free', 'd'], ['gf', 'Gluten-free', 'g'], ['nf', 'Nut-free', 'n']];
const CUISINES = [...new Set(MEALS.map(m => m[2]))];
const SLOTS = [['b', 'Breakfast'], ['l', 'Lunch'], ['d', 'Dinner'], ['s', 'Snack']];
const { $, $$, fmt, esc, say, toast } = DD;
const prefs = () => { const d = DD.data; d.prefs = Object.assign({ diet: [], cuisine: [], carb: 45, avoid: '', shuffle: {} }, d.prefs || {}); return d.prefs; };
const rnd = seed => { let x = seed | 0; return () => { x = (x * 1664525 + 1013904223) | 0; return ((x >>> 0) % 1000) / 1000; }; };

/* what the account's own data says */
function profile() {
  const d = DD.data, tests = (d.icr && d.icr.tests || []).filter(t => t.v), log = d.log || [];
  const high = tests.filter(t => t.v === 'weak' || (t.bg2 != null && t.bg2 - t.bg0 > 80)).length;
  const lows = tests.filter(t => t.v === 'low').length;
  const meals = log.filter(l => l.carbs >= 15);
  const usual = meals.length >= 5 ? Math.round(meals.reduce((s, l) => s + l.carbs, 0) / meals.length) : null;
  return { icr: d.settings.icr || null, spiky: high >= 2, lows, usual, n: meals.length };
}
function allowed(m, p) {
  const banned = DIETS.filter(d => p.diet.includes(d[0])).map(d => d[2]).join('');
  if ([...m[3]].some(c => banned.includes(c))) return false;
  const avoid = p.avoid.toLowerCase().split(',').map(s => s.trim()).filter(Boolean);
  const text = (m[0] + ' ' + m[9]).toLowerCase();
  return !avoid.some(a => text.includes(a));
}
function score(m, p, pr, recent) {
  const target = m[1] === 's' ? 15 : p.carb;
  let s = -Math.abs(m[4] - target) * (m[1] === 's' ? 2 : 1.2);
  s += m[5] * (pr.spiky ? 2.4 : 1.5);
  s += (m[8] === 1 ? 8 : m[8] === 2 ? 3 : -4) * (pr.spiky ? 1.6 : 1);
  s += Math.min(m[6], 30) * .3;
  if (p.cuisine.length && p.cuisine.includes(m[2])) s += 14;
  if (recent.includes(m[0])) s -= 18;
  return s;
}
function plan() {
  const p = prefs(), pr = profile(), day = new Date().toDateString();
  const hist = DD.data.mealHist || {}, recent = Object.keys(hist).filter(k => k !== day).slice(-2).flatMap(k => hist[k]);
  const out = {};
  SLOTS.forEach(([slot]) => {
    const pool = MEALS.filter(m => m[1] === slot && allowed(m, p)).map(m => [score(m, p, pr, recent), m]).sort((a, b) => b[0] - a[0]);
    if (!pool.length) { out[slot] = null; return; }
    const top = pool.slice(0, Math.min(4, pool.length));
    const seed = [...(day + slot)].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) + (p.shuffle[day + slot] || 0) * 7919;
    out[slot] = top[Math.floor(rnd(seed)() * top.length) % top.length][1];
  });
  return { out, pr, p, day };
}
function render() {
  const { out, pr, p, day } = plan();
  DD.data.mealHist = Object.assign({}, DD.data.mealHist, { [day]: Object.values(out).filter(Boolean).map(m => m[0]) });
  const keys = Object.keys(DD.data.mealHist); if (keys.length > 5) delete DD.data.mealHist[keys[0]];
  $('#mealDiet').innerHTML = DIETS.map(d => `<button class="pill ${p.diet.includes(d[0]) ? 'on' : ''}" data-diet="${d[0]}">${d[1]}</button>`).join('');
  $('#mealCuisine').innerHTML = CUISINES.map(c => `<button class="pill ${p.cuisine.includes(c) ? 'on' : ''}" data-cuisine="${esc(c)}">${esc(c)}</button>`).join('');
  $('#mealCarb').value = p.carb; $('#mealCarbOut').textContent = p.carb + ' g';
  if (document.activeElement !== $('#mealAvoid')) $('#mealAvoid').value = p.avoid;
  const why = [];
  why.push(pr.icr ? 'your ratio of 1 : ' + pr.icr : 'no saved ratio yet');
  if (pr.usual) why.push('your logged meals average ' + pr.usual + ' g of carbs');
  if (pr.spiky) why.push('your test meals ran high, so today leans on fiber and slower carbs');
  if (pr.lows) why.push(pr.lows + ' low' + (pr.lows > 1 ? 's' : '') + ' in your tests');
  $('#mealWhy').textContent = 'Built from ' + why.join(', ') + '.';
  $('#mealUsual').hidden = !(pr.usual && Math.abs(pr.usual - p.carb) >= 8);
  if (pr.usual) $('#mealUsual').textContent = 'Match my usual ' + pr.usual + ' g';
  let tc = 0, tf = 0, tp = 0;
  $('#mealPlan').innerHTML = SLOTS.map(([slot, label]) => {
    const m = out[slot];
    if (!m) return `<article class="meal card"><p class="result-label">${label}</p><h4>Nothing fits those filters</h4><p class="fine">Loosen a filter or clear the foods to skip.</p></article>`;
    tc += m[4]; tf += m[5]; tp += m[6];
    const dose = pr.icr ? DD.floorTo(m[4] / pr.icr, .5) : null;
    const tags = [m[8] === 1 ? 'slow carbs' : m[8] === 2 ? 'medium-speed carbs' : 'fast carbs', m[5] >= 8 ? 'high fiber' : null, m[6] >= 25 ? 'high protein' : null, m[7] >= 20 ? 'higher fat: watch for a late rise' : null].filter(Boolean);
    return `<article class="meal card sk" data-slot="${slot}"><p class="result-label">${label} · ${esc(m[2])}</p><h4>${esc(m[0])}</h4><p class="plate-desc">${esc(m[9])}</p>
      <div class="macros"><div><b>${m[4]}</b><span>g carbs</span></div><div><b>${m[5]}</b><span>g fiber</span></div><div><b>${m[6]}</b><span>g protein</span></div><div><b>${dose == null ? '–' : fmt(dose, 1)}</b><span>${dose == null ? 'set a ratio' : 'units for carbs'}</span></div></div>
      <p class="fine">${tags.join(' · ')}</p>
      <div class="row-between"><button class="btn sk small" data-swap="${slot}">Swap</button><button class="btn sk small primary" data-use="${slot}">Dose this meal</button></div></article>`;
  }).join('');
  $('#mealTotals').textContent = 'Today: ' + tc + ' g carbs, ' + tf + ' g fiber, ' + tp + ' g protein. Recipes vary, so check the carbs on your own plate before you dose.';
  say($('#mealBubble'), $('#mealBates'), pr.spiky ? 'Your tests ran high after meals, so I picked slower carbs today.' : p.diet.length || p.cuisine.length ? 'Picked to match your filters.' : 'Half the plate veggies, a quarter protein, a quarter carbs.', 'point');
  DD._meals = out;
}
const commit = () => { DD.save(); render(); };
document.addEventListener('click', e => {
  const t = e.target.closest('[data-diet],[data-cuisine],[data-swap],[data-use]'); if (!t) return;
  const p = prefs(), day = new Date().toDateString();
  if (t.dataset.diet) { const k = t.dataset.diet; p.diet = p.diet.includes(k) ? p.diet.filter(x => x !== k) : p.diet.concat(k); commit(); }
  else if (t.dataset.cuisine) { const k = t.dataset.cuisine; p.cuisine = p.cuisine.includes(k) ? p.cuisine.filter(x => x !== k) : p.cuisine.concat(k); commit(); }
  else if (t.dataset.swap) { p.shuffle[day + t.dataset.swap] = (p.shuffle[day + t.dataset.swap] || 0) + 1; p.shuffle = Object.fromEntries(Object.entries(p.shuffle).filter(([k]) => k.startsWith(day))); commit(); const card = $('.meal[data-slot="' + t.dataset.swap + '"]'); if (card && window.anime && !DD.reduce) anime({ targets: card, rotate: [-3, 0], scale: [.94, 1], duration: 500, easing: 'easeOutElastic(1,.6)' }); }
  else if (t.dataset.use) { const m = DD._meals[t.dataset.use]; DD.loadPlate([[m[0], m[9], m[4], m[5], m[6], m[7]]]); }
});
$('#mealCarb').addEventListener('input', e => { prefs().carb = +e.target.value; $('#mealCarbOut').textContent = e.target.value + ' g'; });
$('#mealCarb').addEventListener('change', commit);
$('#mealAvoid').addEventListener('change', e => { prefs().avoid = e.target.value; commit(); });
$('#mealUsual').addEventListener('click', () => { prefs().carb = Math.max(30, Math.min(75, profile().usual)); commit(); });
$('#mealShuffle').addEventListener('click', () => { const p = prefs(), day = new Date().toDateString(); SLOTS.forEach(([s]) => p.shuffle[day + s] = (p.shuffle[day + s] || 0) + 1); commit(); if (window.anime && !DD.reduce) anime({ targets: '.meal', translateY: [18, 0], opacity: [.3, 1], delay: anime.stagger(70), duration: 450, easing: 'easeOutBack' }); });
DD.onRoute('meals', render);
DD.on('account', () => { if (!$('[data-view=meals]').hidden) render(); });
})();
