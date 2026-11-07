// O Garoto da Mata · Parte 1 — ilustrações do Krea animadas em Canvas 2D.
// Tudo é função pura do tempo t: zoom/pan, neblina, grão, luzes, olhos e legendas. Sem Math.random.
const NARR = await (await fetch('./narracao.json')).json();
const CFG = await (await fetch('./cenas.json')).json();
await document.fonts.load('600 64px Oswald');
const W = 1080, H = 1920, DUR = NARR.duration;
const cv = document.getElementById('c'), g = cv.getContext('2d');

// ---------- helpers ----------
const cl = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const P = (t, a, b) => cl((t - a) / (b - a));
const sm = x => x * x * (3 - 2 * x);
const eio = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const lerp = (a, b, x) => a + (b - a) * x;
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let x = Math.imul(seed ^ seed >>> 15, 1 | seed); x = x + Math.imul(x ^ x >>> 7, 61 | x) ^ x; return ((x ^ x >>> 14) >>> 0) / 4294967296; }; }
const hash = n => { const r = rng(n * 7919 + 13); return r(); };
const flick = (t, rate = 9, seed = 1) => { const k = Math.floor(t * rate); return hash(k * 31 + seed); }; // valor que muda em degraus

// ---------- tempos: cada cena vai do começo da 1ª fala dela (-0,35 s) até a próxima ----------
const byScene = {};
for (const l of NARR.lines) (byScene[l.scene] ||= []).push(l);
const SC = CFG.cenas.map(c => ({ ...c, lines: byScene[c.n] }));
SC.forEach((c, i) => { c.t0 = i === 0 ? 0 : c.lines[0].start - .35; });
SC.forEach((c, i) => { c.t1 = i < SC.length - 1 ? SC[i + 1].t0 : DUR; });
const XF = .45; // duração do cross-fade (cenas com corteSeco entram sem fade)

// ---------- imagens (fallback pro placeholder enquanto as do Krea não chegam) ----------
const load = src => new Promise(r => { const im = new Image(); im.onload = () => r(im); im.onerror = () => r(null); im.src = src; });
for (const c of SC) c.im = (await load(c.img)) || (await load(`imagens/placeholder-${String(c.n).padStart(2, '0')}.png`));

// ---------- texturas: grão e neblina (com semente) ----------
function noiseCanvas(w, h, seed, blur, alpha) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); const r = rng(seed);
  const id = x.createImageData(w, h); for (let i = 0; i < w * h; i++) { const v = r() * 255; id.data.set([v, v, v, alpha], i * 4); } x.putImageData(id, 0, 0);
  if (!blur) return c; const c2 = document.createElement('canvas'); c2.width = w; c2.height = h; const y = c2.getContext('2d'); y.filter = `blur(${blur}px)`; y.drawImage(c, 0, 0); return c2;
}
const GRAIN = [0, 1, 2, 3, 4, 5].map(i => noiseCanvas(540, 960, 100 + i, 0, 255));
function fogCanvas(seed) {
  const c = document.createElement('canvas'); c.width = 1400; c.height = 900; const x = c.getContext('2d'); const r = rng(seed);
  for (let i = 0; i < 70; i++) { const px = r() * 1400, py = 200 + r() * 600, R = 120 + r() * 260; const gr = x.createRadialGradient(px, py, 0, px, py, R);
    gr.addColorStop(0, `rgba(190,205,205,${.10 + r() * .12})`); gr.addColorStop(1, 'rgba(190,205,205,0)'); x.fillStyle = gr; x.fillRect(px - R, py - R, 2 * R, 2 * R); }
  return c;
}
const FOG = [fogCanvas(7), fogCanvas(8)];

// ---------- desenho de uma cena ----------
function camOf(c, t) { const u = eio(P(t, c.t0, c.t1 + XF)); const a = c.cam.de, b = c.cam.para; return { x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u), s: lerp(a.s, b.s, u) }; }
function drawScene(c, t, alpha) {
  if (alpha <= 0) return; const im = c.im; const cam = camOf(c, t); const fx = c.fx || {};
  // tremor
  let jx = 0, jy = 0; if (fx.treme) { jx = fx.treme * (3 * Math.sin(t * 13.1) + 2 * Math.sin(t * 29.7)); jy = fx.treme * (3 * Math.sin(t * 11.3 + 1) + 2 * Math.sin(t * 23.9)); }
  if (fx.batidas) for (const k of KNOCKS) { const d = t - k; if (d >= 0 && d < .25) { const e = Math.exp(-d * 18); jx += 14 * e * Math.sin(d * 90); jy += 10 * e * Math.cos(d * 70); } }
  // "cover" + zoom em volta do centro (x,y)
  const base = Math.max(W / im.width, H / im.height) * cam.s; const iw = im.width * base, ih = im.height * base;
  let ox = W / 2 - cam.x * iw, oy = H / 2 - cam.y * ih; ox = cl(ox, W - iw, 0); oy = cl(oy, H - ih, 0);
  const toS = (nx, ny) => [ox + nx * iw + jx, oy + ny * ih + jy];
  g.save(); g.globalAlpha = alpha;
  // luz da cena (lâmpada piscando / acende)
  let bright = 1;
  if (fx.pisca) { const f = flick(t, 7, 3); bright = f < .12 ? .35 : f < .2 ? .7 : 1; }
  if (fx.acende) bright = .25 + .75 * sm(P(t, c.t0 + .9, c.t0 + 1.6));
  g.filter = `brightness(${bright}) contrast(1.08) saturate(.85)`;
  g.drawImage(im, ox + jx, oy + jy, iw, ih); g.filter = 'none';
  // olhos vermelhos brilhando (pulsam; na cena 5 acendem antes do resto)
  if (fx.olhos) { const pulse = .75 + .25 * Math.sin(t * 3.2); const on = fx.acende ? sm(P(t, c.t0 + .1, c.t0 + .6)) : 1;
    g.globalCompositeOperation = 'lighter';
    for (const [ex, ey] of fx.olhos) { const [sx, sy] = toS(ex, ey); const R = 40 * cam.s * (iw / W);
      const gr = g.createRadialGradient(sx, sy, 0, sx, sy, R); gr.addColorStop(0, `rgba(255,90,70,${.85 * pulse * on})`); gr.addColorStop(.3, `rgba(255,30,20,${.45 * pulse * on})`); gr.addColorStop(1, 'rgba(255,0,0,0)');
      g.fillStyle = gr; g.fillRect(sx - R, sy - R, 2 * R, 2 * R); }
    g.globalCompositeOperation = 'source-over'; }
  // fachos de lanterna varrendo
  if (fx.lanternas) { g.globalCompositeOperation = 'lighter';
    fx.lanternas.forEach(([bx, by], i) => { const ph = [1.1, -.9, .4][i % 3]; const [sx, sy] = toS(bx, by); const ang = -Math.PI / 2 + .55 * Math.sin(t * .7 + ph * 2);
      g.save(); g.translate(sx, sy); g.rotate(ang); const len = 1500; const gr = g.createLinearGradient(0, 0, len, 0); gr.addColorStop(0, 'rgba(255,240,200,.32)'); gr.addColorStop(1, 'rgba(255,240,200,0)');
      g.fillStyle = gr; g.beginPath(); g.moveTo(0, 0); g.lineTo(len, -150); g.lineTo(len, 150); g.closePath(); g.fill(); g.restore(); });
    g.globalCompositeOperation = 'source-over'; }
  if (fx.drone) { const [sx, sy] = toS(fx.drone[0] + .02 * Math.sin(t * .5), fx.drone[1]); const on = Math.sin(t * 6) > .3 ? 1 : .15;
    g.globalCompositeOperation = 'lighter'; const gr = g.createRadialGradient(sx, sy, 0, sx, sy, 30); gr.addColorStop(0, `rgba(255,40,40,${on})`); gr.addColorStop(1, 'rgba(255,0,0,0)'); g.fillStyle = gr; g.fillRect(sx - 30, sy - 30, 60, 60); g.globalCompositeOperation = 'source-over'; }
  // círculo vermelho no mapa (desenhado à mão, aparece com a fala)
  if (fx.circulo) { const [cx, cy, r] = fx.circulo; const [sx, sy] = toS(cx, cy); const R = r * iw; const k = sm(P(t, c.t0 + 1.0, c.t0 + 2.2));
    g.strokeStyle = 'rgba(200,30,30,.9)'; g.lineWidth = 9; g.lineCap = 'round'; g.beginPath();
    for (let i = 0; i <= 80 * k; i++) { const a = -1 + i / 80 * Math.PI * 2.15; const rr = R * (1 + .06 * Math.sin(i * .3)); const px = sx + Math.cos(a) * rr * 1.15, py = sy + Math.sin(a) * rr * .8; i ? g.lineTo(px, py) : g.moveTo(px, py); }
    g.stroke(); }
  // bússola: agulha girando sem parar (desenhada em código em cima da imagem)
  if (fx.bussola) { const [cx, cy, r] = fx.bussola; const [sx, sy] = toS(cx, cy); const R = r * iw; const spin = t * (3 + 2 * Math.sin(t * .8)) + 3 * Math.sin(t * 2.3);
    g.save(); g.translate(sx, sy); g.rotate(spin); g.shadowColor = 'rgba(0,0,0,.8)'; g.shadowBlur = 10;
    g.fillStyle = '#b3201c'; g.beginPath(); g.moveTo(0, -R * .85); g.lineTo(R * .1, 0); g.lineTo(-R * .1, 0); g.fill();
    g.fillStyle = '#ddd8c8'; g.beginPath(); g.moveTo(0, R * .85); g.lineTo(R * .1, 0); g.lineTo(-R * .1, 0); g.fill();
    g.fillStyle = '#222'; g.beginPath(); g.arc(0, 0, R * .07, 0, 7); g.fill(); g.restore(); }
  // brilho estranho atrás da cerca
  if (fx.brilho) { const [bx, by, col] = fx.brilho; const [sx, sy] = toS(bx, by); const p = .55 + .45 * Math.sin(t * 2.1) * Math.sin(t * .7 + 1); const R = 520;
    g.globalCompositeOperation = 'lighter'; const gr = g.createRadialGradient(sx, sy, 0, sx, sy, R); gr.addColorStop(0, col + Math.round(80 * p).toString(16).padStart(2, '0')); gr.addColorStop(1, col + '00');
    g.fillStyle = gr; g.fillRect(sx - R, sy - R, 2 * R, 2 * R); g.globalCompositeOperation = 'source-over'; }
  // neblina passando
  if (fx.neblina) { g.globalAlpha = alpha * fx.neblina * .45; g.globalCompositeOperation = 'screen';
    FOG.forEach((f, i) => { const sp = i ? 22 : -14; const x0 = ((t * sp + i * 500) % 1400 + 1400) % 1400; for (const dx of [-1400, 0, 1400]) g.drawImage(f, dx + x0 - 160, 1100 + i * 220, 1400 * 1.2, 900); });
    g.globalCompositeOperation = 'source-over'; }
  g.restore();
}

// ---------- legenda: UMA palavra por vez, grande, no meio (estilo das referências) ----------
const KEYS = CFG.palavras.flatMap(k => k.split(' '));
const syl = w => Math.max(1, (w.toLowerCase().match(/[aeiouáéíóúâêôãõà]+/g) || []).length);
const WORDS = [];
for (const l of NARR.lines) { const ws = l.text.split(/\s+/); const wt = ws.map(w => syl(w) + (/[.,:!?…]$/.test(w) ? 1.3 : 0)); const tot = wt.reduce((a, b) => a + b, 0);
  let cur = l.start; ws.forEach((w, i) => { const d = (l.end - l.start) * wt[i] / tot; WORDS.push({ w: w.replace(/[.,:!?…]+/g, '').replace(/\.\.\./g, ''), s: cur, e: cur + d, line: l }); cur += d; }); }
function caption(t) {
  let k = -1; for (let i = 0; i < WORDS.length; i++) if (t >= WORDS[i].s - .03) k = i;
  if (k < 0) return; const W0 = WORDS[k]; if (t > W0.line.end + .35) return;     // some na pausa entre falas
  const w = W0.w.toUpperCase(); if (!w) return;
  const pop = 1 + .18 * Math.exp(-(t - W0.s) * 14);                                // entra com um "pop" leve
  const key = KEYS.includes(W0.w.toLowerCase());
  g.save(); g.translate(500, 1400); g.scale(pop, pop); g.font = `700 ${w.length > 9 ? 104 : 124}px Oswald`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  g.lineWidth = 20; g.strokeStyle = '#000'; g.strokeText(w, 0, 0); g.fillStyle = key ? '#ff3b2e' : (W0.line.voice ? '#cfd8d4' : '#ffffff'); g.fillText(w, 0, 0);
  g.restore();
}

// ---------- pós: vinheta + grão ----------
function post(t, f) {
  const vg = g.createRadialGradient(540, 900, 300, 540, 960, 1250); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.78)'); g.fillStyle = vg; g.fillRect(0, 0, W, H);
  g.save(); g.globalAlpha = .07; g.globalCompositeOperation = 'overlay'; g.drawImage(GRAIN[f % GRAIN.length], 0, 0, W, H); g.restore();
}

const L8 = NARR.lines.find(l => l.id === 's8');
const KNOCKS = [L8.end - .2, L8.end + .12, L8.end + .44].map(x => x); // batidas logo depois de "bateram na porta"
window.KNOCKS = KNOCKS;
window.SCENES = SC.map(c => ({ n: c.n, t0: c.t0, t1: c.t1 }));
window.DURATION = DUR;
window.renderAt = t => {
  const f = Math.round(t * 60);
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  const i = SC.findIndex(c => t >= c.t0 && t < c.t1); const c = SC[i < 0 ? SC.length - 1 : i];
  const prev = SC[SC.indexOf(c) - 1];
  const fadeIn = c.fx?.corteSeco || !prev ? 1 : sm(P(t, c.t0, c.t0 + XF));
  if (prev && fadeIn < 1) drawScene(prev, t, 1);
  drawScene(c, t, fadeIn);
  // fade de entrada no 1º quadro e pro preto no fim
  const endFade = 1 - sm(P(t, DUR - .7, DUR - .1));
  if (endFade < 1) { g.fillStyle = `rgba(0,0,0,${1 - endFade})`; g.fillRect(0, 0, W, H); }
  post(t, f); caption(t);
};
window.renderAt(0);
window.READY = true;
