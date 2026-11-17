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
  call.hidden = false; place();
  if (cv._bates) { cv._bates.kick(); cv._bates.act(2.5); }
  /* on a phone the speech bubble steps aside after a few seconds; Bates stays and still opens the widget */
  if (innerWidth <= 680) setTimeout(() => { call.querySelector('.bubble').hidden = true; place(); }, 7000);
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
$('#imGo').addEventListener('click', () => { const l = launcher(); if (l) l.click(); else tab.click(); });
cv.addEventListener('click', () => $('#imGo').click());
$('#imX').addEventListener('click', () => { call.hidden = true; try { sessionStorage.setItem('dd.imHide', '1'); } catch (e) {} });
})();
