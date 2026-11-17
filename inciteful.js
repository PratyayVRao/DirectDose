/* Bates points at the IncitefulMed "Health Answers" tab so people notice it.
   The tab itself comes from IncitefulMed's script. If that script can't load, a plain link tab stands in. */
(function () {
'use strict';
const { $ } = DD;
const call = $('#imCall'), tab = $('#imTab'), cv = $('#imBates');
let hiddenByUser = false; try { hiddenByUser = sessionStorage.getItem('dd.imHide') === '1'; } catch (e) {}
const launcher = () => document.getElementById('incitefulmed-launcherButton');
function place() {
  const l = launcher() || (tab.hidden ? null : tab); if (!l) return;
  const r = l.getBoundingClientRect(), left = r.left < innerWidth / 2;
  call.classList.toggle('left', left);
  call.style[left ? 'left' : 'right'] = Math.round((left ? r.right : innerWidth - r.left) + 4) + 'px';
  call.style[left ? 'right' : 'left'] = 'auto';
  call.style.top = Math.round(Math.max(96, r.top + r.height / 2 - call.offsetHeight + 34)) + 'px';
}
function show() {
  if (hiddenByUser) return;
  call.hidden = false;
  /* on a phone the bubble would cover the page, so it only opens on the home page */
  const onHome = !location.hash || location.hash === '#home';
  if (innerWidth <= 680 && !onHome) call.classList.add('mini');
  place();
  if (cv._bates) { cv._bates.kick(); cv._bates.act(2.5); }
  /* after a few seconds the bubble tucks away so it doesn't cover the page; Bates keeps peeking and pointing */
  setTimeout(() => { call.classList.add('mini'); place(); }, innerWidth <= 680 ? 6000 : 9000);
  /* a nudge every so often, so it catches the eye without nagging */
  setInterval(() => { if (!call.hidden && cv._bates) cv._bates.act(1.6); }, 9000);
}
let tries = 0;
(function wait() {
  if (launcher()) return show();
  if (window.__imFail || ++tries > 40) { tab.hidden = false; return show(); }
  setTimeout(wait, 250);
})();
addEventListener('resize', place);
/* on a phone the bubble only shows at the very top of the home page, then gets out of the way */
addEventListener('scroll', () => { if (innerWidth <= 680 && scrollY > 120 && !call.classList.contains('mini')) { call.classList.add('mini'); place(); } }, { passive: true });
call.addEventListener('pointerenter', () => { if (call.classList.contains('mini')) { call.classList.remove('mini'); call.dataset.peek = 1; place(); } });
call.addEventListener('pointerleave', () => { if (call.dataset.peek) { delete call.dataset.peek; call.classList.add('mini'); place(); } });
$('#imGo').addEventListener('click', () => { const l = launcher(); if (l) l.click(); else tab.click(); });
cv.addEventListener('click', () => $('#imGo').click());
$('#imX').addEventListener('click', () => { call.hidden = true; try { sessionStorage.setItem('dd.imHide', '1'); } catch (e) {} });
})();
