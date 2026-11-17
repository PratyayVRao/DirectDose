/* One-line drawings that draw themselves as you scroll.
   <canvas data-line="read"> picks a drawing from lineart.js. Drawing starts once the canvas is on screen and
   finishes while it's still on screen. It never draws faster than about 2.4 seconds end to end, so a drawing
   that's already on screen when a page opens still animates from the start. Scrolling back up un-draws it,
   and leaving the page resets it so it draws again next visit.
   data-reveal="#id" fades that element in as the drawing finishes. */
(function () {
'use strict';
const ART = window.LINEARTS || {}, reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const items = [...document.querySelectorAll('canvas[data-line]')].map(cv => {
  const a = ART[cv.dataset.line]; if (!a) return null;
  cv.style.aspectRatio = cv.dataset.fit ? '' : a.w + ' / ' + a.h;
  return { cv, a, ctx: cv.getContext('2d'), total: a.p.length / 2 - 1, shown: 0, painted: -1, reveal: cv.dataset.reveal ? document.querySelector(cv.dataset.reveal) : null };
}).filter(Boolean);

function target(it) {
  const r = it.cv.getBoundingClientRect(), vh = innerHeight;
  /* fully on screen: finish it, even if the page can't scroll any further */
  if (r.top >= 0 && r.bottom <= vh - 10) return 1;
  const start = vh * .9, end = Math.max(vh * .06, vh * .48 - r.height / 2);
  return clamp((start - r.top) / Math.max(180, start - end));
}
function paint(it) {
  const { cv, ctx, a } = it, dpr = Math.min(2, devicePixelRatio || 1);
  const W = Math.round(cv.clientWidth * dpr), H = Math.round(cv.clientHeight * dpr);
  if (!W || !H) return;
  if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; it.painted = -1; }
  /* fit the drawing inside the canvas, centered */
  const s = Math.min(W / a.w, H / a.h), dw = a.w * s, dh = a.h * s, ox = (W - dw) / 2, oy = (H - dh) / 2;
  const X = i => ox + a.p[i * 2] / 1000 * dw, Y = i => oy + a.p[i * 2 + 1] / 1000 * dh;
  const n = Math.round(it.total * it.shown);
  if (n === it.painted) return;
  let from = it.painted;
  if (n < it.painted || it.painted < 0 || it.tip) { ctx.clearRect(0, 0, W, H); from = 0; }
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.strokeStyle = cv.dataset.ink || 'rgba(0,108,104,.55)'; ctx.lineWidth = (+cv.dataset.weight || .8) * dpr * Math.max(.8, Math.min(1.4, dw / dpr / 360));
  ctx.beginPath();
  for (let i = from; i < n; i++) { ctx.moveTo(X(i), Y(i)); ctx.lineTo(X(i + 1), Y(i + 1)); }
  ctx.stroke();
  /* the pen tip, while it's still drawing */
  it.tip = n > 0 && n < it.total;
  if (it.tip) { ctx.fillStyle = '#006C68'; ctx.beginPath(); ctx.arc(X(n), Y(n), 3.2 * dpr, 0, 7); ctx.fill(); }
  it.painted = n;
  if (it.reveal) {
    /* the photo fades in as the last strokes go down, and the sketch fades out under it */
    const k = clamp((it.shown - .78) / .22);
    it.reveal.style.opacity = k.toFixed(3); cv.style.opacity = (1 - k * .92).toFixed(3);
  }
}
let last = performance.now();
function frame(now) {
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  items.forEach(it => {
    const visible = it.cv.offsetParent !== null;
    if (!visible) { if (it.shown) { it.shown = 0; it.painted = -1; if (it.reveal) it.reveal.style.opacity = 0; } return; }
    const goal = reduce ? 1 : target(it);
    if (Math.abs(goal - it.shown) < .0005 && it.painted >= 0) return;
    const step = reduce ? 1 : dt / 2.4 * (goal < it.shown ? 1.6 : 1);
    it.shown += clamp(goal - it.shown, -step, step);
    paint(it);
  });
  requestAnimationFrame(frame);
}
addEventListener('resize', () => items.forEach(it => it.painted = -1));
if (items.length) requestAnimationFrame(frame);
})();
