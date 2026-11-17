/* Bates puppet engine.
   Each pose image is cut into parts (polygons in original 1024x1536 art coordinates),
   and the parts are rotated around joints on a canvas. No sprite sheets, no bobbing boxes. */
(function () {
'use strict';
const S = 2 / 3, SKIN = '#CAE5DA', DEG = Math.PI / 180, sin = Math.sin, cos = Math.cos, abs = Math.abs, max = Math.max;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* part: {id, z:-1 behind body | 1 in front, poly, pivot, over:[x,y,r] overlap disc, kids:[...]}
   eyes: [x,y,w,h] boxes on the part named in eyesOn (or body). anim(t,h,a,root): t seconds, h hover 0..1 */
const RIGS = {
  wave: {
    size: [1024, 1536], pad: [70, 10, 90, 10], eyesOn: 'head', eyes: [[412, 208, 86, 60], [526, 194, 84, 62]],
    parts: [
      { id: 'arm', z: -1, pivot: [668, 606], over: [652, 568, 52],
        poly: [622, 596, 690, 530, 700, 440, 688, 286, 905, 286, 905, 452, 778, 486, 716, 642, 690, 664, 644, 646],
        kids: [{ id: 'hand', z: 1, pivot: [734, 458], over: [734, 458, 32], poly: [700, 446, 688, 286, 905, 286, 905, 448, 792, 488] }] },
      { id: 'head', z: 1, pivot: [505, 386], over: [505, 388, 34],
        poly: [180, 0, 792, 0, 792, 274, 700, 286, 650, 326, 610, 362, 556, 380, 548, 372, 462, 372, 445, 386, 380, 394, 320, 374, 180, 342] }
    ],
    anim(t, h, a) {
      a.arm = 1.2 * sin(t * 1.3) + h * (9 + 9 * sin(t * 8));
      a.hand = h * 14 * sin(t * 8 - 1);
      a.head = .8 * sin(t * .9) + h * 3.5 * sin(t * 4);
    }
  },
  thumbs: {
    size: [1024, 1536], pad: [40, 10, 60, 10], eyesOn: 'head', eyes: [[398, 220, 86, 62], [522, 186, 86, 62]],
    parts: [
      { id: 'arm', z: -1, pivot: [668, 606], over: [648, 562, 52],
        poly: [620, 600, 668, 512, 650, 440, 660, 326, 748, 326, 748, 560, 726, 640, 690, 664, 644, 648] },
      { id: 'head', z: 1, pivot: [505, 380], over: [505, 384, 34],
        poly: [190, 0, 782, 0, 782, 258, 700, 264, 650, 300, 625, 340, 560, 372, 548, 366, 462, 366, 440, 380, 400, 388, 360, 394, 330, 374, 250, 366, 190, 330] }
    ],
    anim(t, h, a) {
      a.arm = 1 * sin(t * 1.2) + h * (4 + 7 * sin(t * 7));
      a.head = .8 * sin(t * .8) + h * 3 * sin(t * 7 + 1.2);
    }
  },
  point: {
    size: [1024, 1536], pad: [40, 10, 60, 10], eyesOn: 'head', eyes: [[396, 202, 82, 66], [514, 156, 82, 58]],
    parts: [
      { id: 'arm', z: -1, pivot: [638, 604], over: [614, 566, 48],
        poly: [580, 602, 640, 522, 668, 440, 652, 380, 698, 276, 772, 276, 772, 462, 714, 482, 690, 622, 656, 656, 610, 642],
        kids: [{ id: 'hand', z: 1, pivot: [692, 456], over: [692, 456, 27], poly: [666, 446, 652, 380, 698, 276, 772, 276, 772, 458, 716, 480] }] },
      { id: 'head', z: 1, pivot: [480, 388], over: [482, 392, 32],
        poly: [160, 0, 722, 0, 722, 214, 640, 236, 600, 300, 560, 340, 520, 374, 440, 374, 410, 396, 330, 402, 290, 376, 165, 330] }
    ],
    anim(t, h, a) {
      a.arm = 1 * sin(t * 1.1) + h * 6 * sin(t * 9);
      a.hand = h * 10 * sin(t * 9 - .9);
      a.head = .8 * sin(t * .9) - h * 2.5;
    }
  },
  think: {
    size: [1024, 1536], pad: [40, 10, 40, 10], eyesOn: 'head', eyes: [[466, 222, 84, 62], [562, 156, 82, 60]],
    parts: [
      { id: 'arm', z: 1, pivot: [690, 612], over: [690, 612, 30],
        poly: [548, 340, 644, 322, 668, 400, 737, 560, 717, 634, 664, 630, 612, 598, 630, 520, 600, 440, 588, 380, 550, 364] },
      { id: 'head', z: -1, pivot: [505, 384], over: [505, 386, 30],
        poly: [200, 0, 752, 0, 752, 214, 690, 250, 662, 300, 644, 322, 548, 340, 548, 366, 524, 388, 450, 388, 430, 402, 380, 402, 330, 386, 200, 346] }
    ],
    anim(t, h, a) {
      a.arm = h * 2.4 * sin(t * 9);
      a.head = 1 * sin(t * .8) + h * 2.2 * sin(t * 2.2);
    }
  },
  hop: {
    size: [1024, 1536], pad: [40, 70, 50, 10], eyesOn: 'head', eyes: [[408, 222, 88, 66], [546, 160, 84, 60]],
    parts: [
      { id: 'armR', z: -1, pivot: [734, 420], over: [716, 420, 42],
        poly: [722, 370, 736, 466, 802, 402, 847, 232, 888, 202, 888, 102, 768, 102, 766, 216, 740, 350] },
      { id: 'armL', z: -1, pivot: [362, 556], over: [366, 548, 42],
        poly: [322, 510, 412, 582, 346, 630, 300, 642, 244, 562, 184, 442, 188, 362, 287, 362, 287, 440, 272, 480] },
      { id: 'shin', z: -1, pivot: [436, 992], over: [436, 992, 44],
        poly: [350, 940, 420, 936, 440, 1052, 340, 1062, 332, 1184, 158, 1184, 158, 898, 330, 898] },
      { id: 'head', z: 1, pivot: [540, 382], over: [540, 384, 32],
        poly: [190, 0, 737, 0, 737, 200, 700, 250, 650, 320, 600, 354, 586, 386, 500, 392, 480, 372, 430, 386, 340, 396, 290, 372, 190, 330] }
    ],
    anim(t, h, a, root) {
      const k = .25 + .75 * h, j = abs(sin(t * 5));
      a.armR = k * 9 * sin(t * 10); a.armL = -k * 9 * sin(t * 10 + .6);
      a.shin = k * 9 * sin(t * 5 + .5); a.head = k * 3 * sin(t * 5);
      root.dy = -h * 46 * j; root.sy = 1 + h * .03 * (j - .5);
    }
  },
  sit: {
    size: [1024, 1536], pad: [20, 10, 20, 10], eyes: [[412, 312, 84, 62], [544, 258, 86, 60]],
    fills: [{ rect: [200, 1004, 626, 312], color: '#C3E4DA' }],
    parts: [
      { id: 'shinL', z: 1, pivot: [386, 952], over: [386, 962, 56], poly: [324, 986, 440, 986, 440, 1180, 470, 1270, 470, 1510, 222, 1510, 222, 1270, 310, 1180] },
      { id: 'shinR', z: 1, pivot: [650, 952], over: [650, 962, 54], poly: [600, 1002, 700, 986, 690, 1180, 706, 1270, 765, 1400, 765, 1515, 480, 1515, 480, 1330, 556, 1270, 576, 1180] }
    ],
    anim(t, h, a) {
      const k = 1.6 + h * 4.5;
      a.shinL = k * sin(t * 2.4); a.shinR = k * sin(t * 2.4 + 2.6);
    }
  },
  read: {
    size: [1219, 1290], pad: [20, 10, 20, 10], eyesOn: 'head', eyes: [[470, 346, 110, 70], [626, 306, 108, 62]],
    parts: [
      { id: 'head', z: 1, pivot: [625, 505], over: [625, 508, 40],
        poly: [215, 0, 932, 0, 932, 330, 800, 342, 790, 400, 745, 442, 700, 476, 690, 492, 560, 492, 540, 482, 470, 502, 420, 532, 396, 472, 330, 472, 215, 402] }
    ],
    anim(t, h, a) { a.head = 1.1 * sin(t * .9) + h * 3 * sin(t * 3); }
  },
  walk: {
    size: [1024, 1536], pad: [110, 30, 110, 10], eyesOn: 'head', eyes: [[598, 222, 76, 58]], walk: true,
    parts: [
      { id: 'farArm', z: -1, pivot: [556, 596], over: [582, 662, 44], poly: [597, 626, 612, 640, 700, 718, 812, 788, 838, 842, 812, 904, 738, 904, 733, 822, 640, 764, 594, 704] },
      { id: 'farLeg', z: -1, pivot: [456, 986], over: [456, 992, 72],
        poly: [366, 1002, 488, 1050, 424, 1110, 332, 1216, 340, 1290, 362, 1400, 362, 1510, 96, 1510, 96, 1290, 200, 1250, 234, 1190, 298, 1090],
        kids: [{ id: 'farShin', z: 1, pivot: [378, 1092], over: [376, 1094, 40], poly: [316, 1080, 427, 1110, 332, 1216, 340, 1290, 362, 1400, 362, 1510, 96, 1510, 96, 1290, 200, 1250, 234, 1190] }] },
      { id: 'nearLeg', z: -1, pivot: [532, 986], over: [540, 1000, 72],
        poly: [488, 1050, 620, 1002, 652, 1100, 702, 1230, 800, 1250, 915, 1290, 915, 1510, 604, 1510, 590, 1250, 540, 1092],
        kids: [{ id: 'nearShin', z: 1, pivot: [598, 1106], over: [598, 1106, 42], poly: [553, 1108, 652, 1086, 702, 1230, 800, 1250, 915, 1290, 915, 1510, 604, 1510, 590, 1250] }] },
      { id: 'nearArm', z: 1, pivot: [430, 560], over: [424, 598, 34], poly: [370, 588, 470, 626, 432, 720, 346, 900, 312, 992, 218, 988, 218, 900, 300, 760] },
      { id: 'head', z: 1, pivot: [520, 402], over: [522, 404, 30], poly: [240, 0, 722, 0, 722, 330, 652, 376, 576, 396, 560, 420, 506, 412, 470, 396, 430, 402, 360, 402, 260, 300] }
    ],
    anim(t, h, a, root, ph, run) {
      /* run 0..1 blends the walk into a run: longer stride, higher knees, bigger arm swing, forward lean, more air */
      const r = run || 0, T = 56 + 24 * r, Ta = 62 + 34 * r, c = (1 - cos(ph)) / 2, s = sin(ph);
      a.nearLeg = T * c - 10 * r; a.farLeg = -T * c + 10 * r;
      a.nearShin = (52 + 42 * r) * max(0, -s); a.farShin = (52 + 42 * r) * max(0, s);
      a.nearArm = -Ta * c + 12 * r; a.farArm = Ta * c - 12 * r;
      a.head = 1.5 * sin(ph * 2) - 5 * r;
      root.dy = -(14 + 30 * r) * abs(s); root.rot = 10 * r;
    }
  }
};
['hello', 'back'].forEach(n => RIGS[n] = { size: [1024, 1536], pad: [10, 10, 10, 10], parts: [], anim() {} });

const cache = {};
function mk(w, h) { const c = document.createElement('canvas'); c.width = Math.ceil(w); c.height = Math.ceil(h); return c; }
function trace(x, poly) { x.beginPath(); for (let i = 0; i < poly.length; i += 2) x[i ? 'lineTo' : 'moveTo'](poly[i] * S, poly[i + 1] * S); x.closePath(); }
function buildPart(img, p) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (let i = 0; i < p.poly.length; i += 2) { x0 = Math.min(x0, p.poly[i]); x1 = max(x1, p.poly[i]); y0 = Math.min(y0, p.poly[i + 1]); y1 = max(y1, p.poly[i + 1]); }
  if (p.over) { x0 = Math.min(x0, p.over[0] - p.over[2]); x1 = max(x1, p.over[0] + p.over[2]); y0 = Math.min(y0, p.over[1] - p.over[2]); y1 = max(y1, p.over[1] + p.over[2]); }
  x0 = max(0, Math.floor(x0 * S) - 2); y0 = max(0, Math.floor(y0 * S) - 2); x1 = Math.min(img.width, Math.ceil(x1 * S) + 2); y1 = Math.min(img.height, Math.ceil(y1 * S) + 2);
  const c = mk(x1 - x0, y1 - y0), x = c.getContext('2d');
  x.translate(-x0, -y0); x.fillStyle = x.strokeStyle = '#000'; x.lineWidth = 2; x.lineJoin = 'round';
  trace(x, p.poly); x.fill(); x.stroke();
  if (p.over) { x.beginPath(); x.arc(p.over[0] * S, p.over[1] * S, p.over[2] * S, 0, 7); x.fill(); }
  x.globalCompositeOperation = 'source-in'; x.drawImage(img, 0, 0);
  x.globalCompositeOperation = 'destination-out';
  (p.kids || []).forEach(k => { trace(x, k.poly); x.fill(); });
  return { id: p.id, z: p.z, c, x: x0, y: y0, px: p.pivot[0] * S, py: p.pivot[1] * S, kids: (p.kids || []).map(k => buildPart(img, k)) };
}
function load(pose) {
  if (cache[pose]) return cache[pose];
  return cache[pose] = new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const rig = RIGS[pose], body = mk(img.width, img.height), x = body.getContext('2d');
      x.drawImage(img, 0, 0);
      x.globalCompositeOperation = 'destination-out'; x.fillStyle = '#000';
      rig.parts.forEach(p => { trace(x, p.poly); x.fill(); });
      x.globalCompositeOperation = 'destination-over';
      (rig.fills || []).forEach(f => { x.fillStyle = f.color; x.fillRect(f.rect[0] * S, f.rect[1] * S, f.rect[2] * S, f.rect[3] * S); });
      res({ rig, img, body, parts: rig.parts.map(p => buildPart(img, p)), w: img.width, h: img.height });
    };
    img.onerror = rej; img.src = 'img/bates-' + pose + '.webp';
  });
}

class Puppet {
  constructor(canvas, pose, opts = {}) {
    this.cv = canvas; this.ctx = canvas.getContext('2d'); this.opts = opts;
    this.h = 0; this.hT = 0; this.burst = 0; this.blink = 0; this.nextBlink = 1.5 + Math.random() * 3; this.t0 = performance.now(); this.last = 0;
    this.visible = true; this.phase = 0; this.run = 0;
    canvas.addEventListener('pointerenter', () => this.hT = 1);
    canvas.addEventListener('pointerleave', () => this.hT = 0);
    canvas.addEventListener('pointerdown', () => this.act(1.8));
    if ('IntersectionObserver' in window) new IntersectionObserver(e => { this.visible = e[0].isIntersecting; if (this.visible) this.kick(); }).observe(canvas);
    this.set(pose, true);
  }
  act(sec = 1.6) { this.burst = sec; this.kick(); }
  set(pose, quiet) {
    if (!RIGS[pose]) pose = 'wave';
    if (pose === this.pose) return; this.pose = pose;
    const r = RIGS[pose], p = r.pad;
    this.cv.style.aspectRatio = (r.size[0] + p[0] + p[2]) + ' / ' + (r.size[1] + p[1] + p[3]);
    load(pose).then(d => { if (this.pose !== pose) return; this.d = d; if (!quiet) this.act(1.5); this.kick(); this.draw(0, 0); });
  }
  kick() { if (!this.raf && !reduce) this.raf = requestAnimationFrame(n => this.tick(n)); }
  tick(now) {
    this.raf = 0;
    if (!this.visible || this.cv.offsetParent === null && getComputedStyle(this.cv).position !== 'fixed') return;
    const t = (now - this.t0) / 1000, dt = Math.min(.05, t - this.last); this.last = t;
    if (this.burst > 0) this.burst -= dt;
    const target = max(this.hT, this.burst > 0 ? 1 : 0);
    this.h += (target - this.h) * Math.min(1, dt * 7);
    this.nextBlink -= dt;
    if (this.nextBlink < 0) { this.blinkT = .16; this.nextBlink = 2 + Math.random() * 4; }
    if (this.blinkT > 0) { this.blinkT -= dt; this.blink = sin(max(0, this.blinkT) / .16 * Math.PI); } else this.blink = 0;
    if (this.opts.phase) this.phase = this.opts.phase(t, dt, this.phase);
    this.draw(t, this.h);
    this.kick();
  }
  draw(t, h) {
    const d = this.d; if (!d) return;
    const cv = this.cv, ctx = this.ctx, r = d.rig, p = r.pad, dpr = Math.min(2, devicePixelRatio || 1);
    const cw = Math.round(cv.clientWidth * dpr), ch = Math.round(cv.clientHeight * dpr);
    if (!cw || !ch) return;
    if (cv.width !== cw || cv.height !== ch) { cv.width = cw; cv.height = ch; }
    const k = ch / ((r.size[1] + p[1] + p[3]) * S);
    const a = {}, root = { dx: 0, dy: 0, sy: 1, rot: 0 };
    r.anim(t, h, a, root, this.phase, this.run);
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cw, ch);
    ctx.setTransform(k, 0, 0, k, p[0] * S * k, p[1] * S * k);
    ctx.translate(root.dx * S, root.dy * S);
    if (root.rot) { ctx.translate(d.w / 2, d.h); ctx.rotate(root.rot * DEG); ctx.translate(-d.w / 2, -d.h); }
    if (root.sy !== 1) { ctx.translate(0, d.h); ctx.scale(2 - root.sy, root.sy); ctx.translate(0, -d.h); }
    ctx.imageSmoothingQuality = 'high';
    const eyes = (part) => {
      if (!r.eyes || this.blink < .03) return;
      const b = this.blink * .88;
      r.eyes.forEach(e => {
        const x = e[0] * S, y = e[1] * S, w = e[2] * S, hh = e[3] * S, src = part ? part.c : d.body, ox = part ? part.x : 0, oy = part ? part.y : 0;
        ctx.save(); ctx.beginPath(); ctx.ellipse(x + w / 2, y + hh / 2, w / 2, hh / 2, 0, 0, 7); ctx.clip();
        ctx.fillStyle = SKIN; ctx.fillRect(x, y, w, hh);
        ctx.drawImage(src, x - ox, y - oy, w, hh, x, y + hh * b, w, hh * (1 - b));
        ctx.restore();
      });
    };
    const drawPart = q => {
      ctx.save(); ctx.translate(q.px, q.py); ctx.rotate((a[q.id] || 0) * DEG); ctx.translate(-q.px, -q.py);
      q.kids.forEach(c => { if (c.z < 0) drawPart(c); });
      ctx.drawImage(q.c, q.x, q.y);
      if (r.eyesOn === q.id) eyes(q);
      q.kids.forEach(c => { if (c.z > 0) drawPart(c); });
      ctx.restore();
    };
    d.parts.forEach(q => { if (q.z < 0) drawPart(q); });
    ctx.drawImage(d.body, 0, 0);
    if (!r.eyesOn) eyes(null);
    d.parts.forEach(q => { if (q.z > 0) drawPart(q); });
  }
}
window.Bates = { Puppet, RIGS, mount(el, pose, opts) { return el._bates || (el._bates = new Puppet(el, pose, opts)); } };
})();
