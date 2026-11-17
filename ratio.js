/* Ratio finder: a structured carb-ratio check repeated over several days.
   Method follows the published self-check protocol (start in range, no insulin on board, low-fat counted meal,
   compare the reading about 4 hours later with the starting one, change in small steps, repeat to confirm). */
(function (root) {
'use strict';
const RULES = { startLo: 90, startHi: 140, band: 30, low: 70, step: 0.10, maxTests: 7, drift: 0.30 };

function verdictOf(t) {
  const readings = [t.bg2, t.bg4].filter(v => v != null);
  if (t.low || readings.some(v => v < RULES.low)) return 'low';
  const d = t.bg4 - t.bg0;
  return d > RULES.band ? 'weak' : d < -RULES.band ? 'strong' : 'ok';
}
function roundRatio(r) { return r >= 20 ? Math.round(r) : Math.round(r * 2) / 2; }
function stepRatio(cur, dir) { /* dir +1: more grams per unit (less insulin). -1: fewer grams per unit (more insulin) */
  let n = roundRatio(cur * (1 + RULES.step * dir));
  if (n === cur) n = cur + (cur >= 20 ? 1 : .5) * dir;
  return Math.max(1, n);
}
/* Replays every finished test and says where the program stands. */
function replay(start, tests) {
  let cur = start, okRun = 0, dir = null, dirN = 0, status = 'running', reason = '', last = '';
  const done = tests.filter(t => t.bg4 != null || t.low);
  for (const t of done) {
    const v = verdictOf(t); t.v = v; t.used = cur; last = v;
    if (v === 'low') { cur = stepRatio(cur, 1); okRun = 0; dir = null; dirN = 0; last = 'low'; }
    else if (v === 'ok') { okRun++; dir = null; dirN = 0; if (okRun >= 2) { status = 'done'; break; } }
    else { okRun = 0; if (dir === v) dirN++; else { dir = v; dirN = 1; } if (dirN >= 2) { cur = stepRatio(cur, v === 'weak' ? -1 : 1); dir = null; dirN = 0; last = v + '-changed'; } }
    if (cur > start * (1 + RULES.drift) || cur < start * (1 - RULES.drift)) { status = 'stopped'; reason = 'drift'; break; }
  }
  if (status === 'running' && done.length >= RULES.maxTests) { status = 'stopped'; reason = 'limit'; }
  return { current: cur, status, reason, okRun, waiting: dirN === 1 ? dir : null, count: done.length, last };
}
if (typeof module !== 'undefined') { module.exports = { verdictOf, stepRatio, replay, RULES }; return; }

const { $, num, fmt, esc, say, toast } = DD;
const app = $('#ratioApp');
const st = () => { const d = DD.data; d.icr = d.icr || { start: null, tests: [] }; return d.icr; };
const pending = () => st().tests.find(t => t.bg4 == null && !t.low);

const WORD = { ok: 'On target', weak: 'Ended high', strong: 'Ended low', low: 'Went low' };
function chart(t) {
  const pts = [[0, t.bg0]]; if (t.bg2 != null) pts.push([2, t.bg2]); if (t.bg4 != null) pts.push([4, t.bg4]);
  const all = pts.map(p => p[1]).concat([t.bg0 - 40, t.bg0 + 80]), lo = Math.min(...all) - 10, hi = Math.max(...all) + 10;
  const X = h => 30 + h / 4 * 200, Y = v => 84 - (v - lo) / (hi - lo) * 74;
  return `<svg class="mini" viewBox="0 0 250 100" role="img" aria-label="Blood sugar during the test">
    <rect x="30" y="${Y(t.bg0 + 30)}" width="200" height="${Y(t.bg0 - 30) - Y(t.bg0 + 30)}" class="band"/>
    <path class="trace" pathLength="1" d="M${pts.map(p => X(p[0]).toFixed(0) + ' ' + Y(p[1]).toFixed(0)).join('L')}"/>
    ${pts.map(p => `<circle cx="${X(p[0])}" cy="${Y(p[1])}" r="5"/><text x="${X(p[0])}" y="${Y(p[1]) - 9}" text-anchor="middle">${Math.round(p[1])}</text>`).join('')}
    <text x="30" y="98">start</text><text x="130" y="98" text-anchor="middle">2 h</text><text x="230" y="98" text-anchor="end">4 h</text></svg>`;
}
function tracker(r) {
  const tests = st().tests;
  return `<ol class="days">${Array.from({ length: RULES.maxTests }, (_, i) => { const t = tests[i]; const v = t && t.v; return `<li class="${v || (t ? 'pend' : '')}"><b>${i + 1}</b><span>${v ? WORD[v] : t ? 'In progress' : ''}</span></li>`; }).join('')}</ol>`;
}
function render() {
  const s = st(), bub = $('#ratBubble'), cv = $('#ratBates');
  if (!s.start) {
    const have = DD.data.settings.icr || '';
    app.innerHTML = `<fieldset class="card"><legend><span class="n">1</span>Your starting ratio</legend>
      <div class="fields two"><label>Carb ratio from your care team<span class="inp"><em>1 :</em><input id="ratStart" type="number" inputmode="decimal" min="1" max="150" step="0.5" value="${have}" placeholder="10"><em>g</em></span></label>
      <label>No ratio yet? Total daily insulin<span class="inp"><input id="ratTdd" type="number" inputmode="decimal" min="1" step="0.5" placeholder="40"><em>units/day</em></span></label></div>
      <p class="fine" id="ratEst"></p>
      <button class="btn sk primary" id="ratBegin">Start my test week</button></fieldset>
      <div class="card how"><h4>How it works</h4><ol class="howlist">
        <li><b>Pick a calm day.</b> Blood sugar between ${RULES.startLo} and ${RULES.startHi}, no mealtime insulin in the last 4 hours, not sick, no hard exercise.</li>
        <li><b>Eat a simple meal you can count.</b> Low in fat. Take the dose the tool shows.</li>
        <li><b>Check again at 2 hours and 4 hours.</b> No snacks, no extra insulin in between.</li>
        <li><b>Repeat on other days.</b> If you end within ${RULES.band} points of where you started, twice, that's your ratio.</li></ol>
        <p class="fine">Under 18? Do this with a parent or guardian. If you ever go under ${RULES.low}, stop the test and treat the low.</p></div>`;
    say(bub, cv, 'Let\'s find the ratio that fits you. It takes a few test meals over a week.', 'wave');
    const est = () => { const tdd = num($('#ratTdd')); if (tdd && tdd > 5 && tdd < 300 && !num($('#ratStart'))) { const e = Math.round(500 / tdd); $('#ratEst').textContent = 'Estimate from the 500 rule: 1 : ' + e + '. Check this with your care team before you dose with it.'; return e; } $('#ratEst').textContent = ''; return null; };
    $('#ratTdd').addEventListener('input', est); $('#ratStart').addEventListener('input', est);
    $('#ratBegin').addEventListener('click', () => {
      const v = num($('#ratStart')) || est();
      if (!v || v < 1 || v > 150) return toast('Enter your carb ratio, or your total daily insulin.');
      s.start = v; s.tests = []; s.began = Date.now(); DD.save(); render();
    });
    return;
  }
  const r = replay(s.start, s.tests), p = pending();
  let body = '';
  if (r.status === 'done') {
    body = `<div class="card sk final"><p class="result-label">Your carb ratio</p><div class="dose ratio"><span>1 :</span><b>${r.current}</b><span>g</span></div>
      <p>Two test meals ended on target at this ratio. It's saved and used for your meal doses from now on. You can change it any time.</p>
      <p class="go"><a class="btn sk primary" href="#bolus">Use it in Meal dose</a><button class="btn sk small" id="ratReset">Start over</button></p>
      <p class="fine">Show these results to your care team. Ratios can differ by meal and change over time, so re-test if your numbers drift.</p></div>`;
    say(bub, cv, 'That\'s your number: 1 to ' + r.current + '. Nice work sticking with it.', 'hop');
  } else if (r.status === 'stopped') {
    body = `<div class="card sk final"><p class="result-label">Time to ask your care team</p>
      <p>${r.reason === 'drift' ? 'Your ratio has moved more than 30% from where you started.' : 'Seven tests didn\'t settle on one ratio.'} That can mean something else is going on, like basal insulin, timing, or carb counts. Take these results to your care team.</p>
      <p>Last ratio tested: <b>1 : ${r.current}</b>. Your saved ratio has not been changed.</p>
      <button class="btn sk small" id="ratReset">Start over</button></div>`;
    say(bub, cv, 'This one needs a human expert. Bring them the list below.', 'point', 'warn');
  } else if (p) {
    const hrs = (Date.now() - p.t) / 36e5;
    body = `<fieldset class="card"><legend><span class="n">${r.count + 1}</span>Finish today's test</legend>
      <p>You started at <b>${p.bg0} mg/dL</b>, ate <b>${p.carbs} g</b> of carbs and took <b>${fmt(p.dose, 1)} units</b>${hrs < 48 ? ', ' + (hrs < 1 ? 'less than an hour' : fmt(hrs, 1) + ' hours') + ' ago' : ''}.</p>
      <div class="fields two"><label>At 2 hours <i class="opt">optional</i><span class="inp"><input id="ratBg2" type="number" inputmode="decimal" value="${p.bg2 == null ? '' : p.bg2}"><em>mg/dL</em></span></label>
      <label>At about 4 hours<span class="inp"><input id="ratBg4" type="number" inputmode="decimal"><em>mg/dL</em></span></label></div>
      <label class="tick"><input type="checkbox" id="ratLow"> I went low or had to treat a low</label>
      <div class="row-between"><button class="btn sk small" id="ratCancel">This test didn't count</button><button class="btn sk primary" id="ratFinish">Save result</button></div></fieldset>`;
    say(bub, cv, hrs < 3 ? 'No snacks and no extra insulin until the 4-hour check. Under ' + RULES.low + '? Stop and treat it.' : 'Time for your 4-hour check.', hrs < 3 ? 'sit' : 'point');
  } else {
    body = `<fieldset class="card"><legend><span class="n">${r.count + 1}</span>Today's test meal</legend>
      <div class="ticks-col"><label class="tick"><input type="checkbox" class="ratRule"> No mealtime insulin in the last 4 hours</label>
      <label class="tick"><input type="checkbox" class="ratRule"> I'm not sick and haven't done hard exercise today</label>
      <label class="tick"><input type="checkbox" class="ratRule"> My meal is simple, low in fat, and I can count the carbs</label></div>
      <div class="fields two"><label>Blood sugar now<span class="inp"><input id="ratBg0" type="number" inputmode="decimal" placeholder="${RULES.startLo}–${RULES.startHi}"><em>mg/dL</em></span></label>
      <label>Carbs in the meal<span class="inp"><input id="ratCarbs" type="number" inputmode="decimal" placeholder="45"><em>g</em></span></label></div>
      <p class="testdose" id="ratDose"></p>
      <button class="btn sk primary" id="ratGo" disabled>I took the dose. Start the test</button></fieldset>`;
    say(bub, cv, r.last === 'low' ? 'You went low, so I eased the ratio to 1 : ' + r.current + ' right away. Less insulin per meal.'
      : r.last === 'weak-changed' ? 'Two tests ended high. New ratio: 1 : ' + r.current + '. A little more insulin per meal.'
      : r.last === 'strong-changed' ? 'Two tests ended low. New ratio: 1 : ' + r.current + '. A little less insulin per meal.'
      : r.waiting ? 'That one ended ' + (r.waiting === 'weak' ? 'high' : 'low') + '. One more test to be sure before I change anything.'
      : r.okRun === 1 ? 'On target! One more like that and we\'re done.'
      : 'Ready when you are. Testing 1 : ' + r.current + '.', r.last === 'low' ? 'point' : r.okRun ? 'thumbs' : 'think', r.last === 'low' ? 'warn' : '');
  }
  const hist = s.tests.filter(t => t.v).slice().reverse();
  app.innerHTML = `<div class="rat-top"><div><p class="result-label">Testing</p><div class="dose ratio"><span>1 :</span><b>${r.current}</b><span>g</span></div></div>${tracker(r)}</div>${body}
    ${hist.length ? `<div class="card"><div class="row-between"><h4>Your tests</h4>${r.status === 'running' ? '<button class="btn sk small" id="ratReset">Start over</button>' : ''}</div><ul class="tests">${hist.map(t => `<li class="${t.v}">${chart(t)}<div><b>${WORD[t.v]}</b><span>${new Date(t.t).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} · ${t.carbs} g carbs · ${fmt(t.dose, 1)} u at 1 : ${t.used}</span><span>${t.v === 'low' ? 'Too much insulin for this meal.' : t.v === 'ok' ? 'Back within ' + RULES.band + ' of your start.' : t.v === 'weak' ? 'Ended ' + Math.round(t.bg4 - t.bg0) + ' above your start.' : 'Ended ' + Math.round(t.bg0 - t.bg4) + ' below your start.'}</span></div></li>`).join('')}</ul></div>` : ''}`;
  if (window.anime && !DD.reduce) anime({ targets: '#ratioApp .trace', strokeDashoffset: [1, 0], duration: 900, delay: anime.stagger(120), easing: 'easeOutQuad' });

  /* wiring */
  const reset = $('#ratReset');
  if (reset) reset.addEventListener('click', () => { if (reset.dataset.arm) { DD.data.icr = { start: null, tests: [] }; DD.save(); render(); } else { reset.dataset.arm = 1; reset.textContent = 'Press again to erase tests'; } });
  if ($('#ratGo')) {
    const upd = () => {
      const bg = num($('#ratBg0')), carbs = num($('#ratCarbs')), rules = DD.$$('.ratRule').every(c => c.checked), out = $('#ratDose');
      let ok = false;
      if (bg != null && (bg < RULES.startLo || bg > RULES.startHi)) { out.className = 'testdose no'; out.textContent = bg < RULES.low ? 'You\'re low. Treat it now. No test today.' : 'Not a test day. Start between ' + RULES.startLo + ' and ' + RULES.startHi + '. Dose the way you normally do and try another day.'; }
      else if (bg != null && carbs != null && (carbs < 15 || carbs > 100)) { out.className = 'testdose no'; out.textContent = 'Pick a meal with 15 to 100 g of carbs for a fair test.'; }
      else if (bg != null && carbs) { const dose = DD.floorTo(carbs / r.current, .5); out.className = 'testdose'; out.innerHTML = 'Dose for this test: <b>' + fmt(dose, 1) + ' units</b> <span>(' + carbs + ' g ÷ ' + r.current + ', rounded down)</span>'; ok = rules && dose > 0; }
      else { out.className = 'testdose'; out.textContent = ''; }
      $('#ratGo').disabled = !ok;
    };
    app.querySelectorAll('input').forEach(i => i.addEventListener('input', upd));
    $('#ratGo').addEventListener('click', () => {
      const carbs = num($('#ratCarbs'));
      s.tests.push({ t: Date.now(), bg0: num($('#ratBg0')), carbs, dose: DD.floorTo(carbs / r.current, .5), icr: r.current, bg2: null, bg4: null });
      DD.save(); render(); toast('Test started. Check again in 2 and 4 hours.');
    });
  }
  if ($('#ratFinish')) {
    $('#ratCancel').addEventListener('click', () => { s.tests.splice(s.tests.indexOf(p), 1); DD.save(); render(); });
    $('#ratFinish').addEventListener('click', () => {
      const b2 = num($('#ratBg2')), b4 = num($('#ratBg4')), low = $('#ratLow').checked;
      if (b4 == null && !low) return toast('Enter your 4-hour reading.');
      if ([b2, b4].some(v => v != null && (v < 20 || v > 600))) return toast('One of those readings looks off.');
      p.bg2 = b2; p.bg4 = b4 == null ? Math.min(p.bg0, 65) : b4; p.low = low; p.end = Date.now();
      const after = replay(s.start, s.tests);
      if (after.status === 'done') {
        DD.data.settings = Object.assign({}, DD.data.settings, { icr: after.current, icrSource: 'finder', icrDate: Date.now() });
        DD.save(); DD.emit('settings'); DD.confetti(); toast('Your ratio is saved: 1 : ' + after.current);
      } else DD.save();
      render();
    });
  }
}
DD.onRoute('ratio', render);
DD.on('account', () => { if (!$('[data-view=ratio]').hidden) render(); });
DD.ratio = { replay };
})(this);
