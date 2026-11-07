// lib.js — kit visual da série "O Esquema Vorcaro" (documentário investigativo).
// Regra: tudo é função pura de t (segundos). Aleatoriedade só com semente fixa (hash).
const W = 1080, H = 1920;
const C = { bg: '#0A0A0A', bg2: '#16130F', paper: '#EFEAE0', paper2: '#D9D1C1', ink: '#151412', red: '#D7262B', gold: '#C9A24A', dim: '#8A857C', line: 'rgba(239,234,224,.9)' };
const F = { serif: '"Playfair Display"', cond: 'Oswald', mono: '"JetBrains Mono"' };
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lin = (t, a, b) => clamp((t - a) / (b - a));
const lerp = (a, b, x) => a + (b - a) * x;
const eo = x => 1 - Math.pow(1 - clamp(x), 3);
const eio = x => (x = clamp(x), x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const eback = x => { x = clamp(x); const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const brl = n => 'R$ ' + Math.round(n).toLocaleString('pt-BR');

const LIB = (() => {
  let N, SC, chunks = [], grain = [], layerA, layerB, L = {};
  // ---------- tempo da narração ----------
  const St = id => L[id].start, En = id => L[id].end;
  const Wd = (id, w, k = 0) => { const ws = L[id].words.filter(x => x.w.toLowerCase().replace(/[^\wÀ-ú]/g, '').startsWith(w.toLowerCase())); return (ws[k] || ws[0] || L[id].words[0]).start; };

  function init(n, scenes) {
    N = n; n.lines.forEach(l => L[l.id] = l);
    // cenas: começo = início da fala "from" (menos o pre-roll), fim = começo da próxima
    SC = scenes.map(s => ({ ...s, t0: St(s.from) - (s.lead ?? .35) }));
    SC.forEach((s, i) => s.t1 = i + 1 < SC.length ? SC[i + 1].t0 + .35 : N.duration + 1);
    // legendas: uma frase curta por vez (quebra na pontuação ou a cada 6 palavras)
    n.lines.forEach(l => {
      const segs = [[]];
      l.words.forEach((w, i) => { segs[segs.length - 1].push(w); if (/[.,:!?;]$/.test(w.w) && i < l.words.length - 1) segs.push([]); });
      // junta pedaços de 1 palavra no vizinho; divide pedaços longos em partes iguais (máx. ~6 palavras)
      for (let i = segs.length - 1; i > 0; i--) if (segs[i].length < 2 || segs[i - 1].length < 2) { segs[i - 1] = segs[i - 1].concat(segs[i]); segs.splice(i, 1); }
      segs.forEach((sg, si) => {
        const parts = Math.ceil(sg.length / 6), per = Math.ceil(sg.length / parts);
        for (let k = 0; k < sg.length; k += per) { const ws = sg.slice(k, k + per), last = si === segs.length - 1 && k + per >= sg.length; chunks.push({ words: ws, start: ws[0].start, end: last ? l.end + .25 : ws[ws.length - 1].end }); }
      });
    });
    chunks.forEach((c, i) => { const nx = chunks[i + 1]; if (nx && nx.start - c.end < .45) c.end = nx.start; });
    // granulação com semente fixa (8 texturas, escolhidas pelo número do quadro)
    for (let g = 0; g < 8; g++) {
      const cv = document.createElement('canvas'); cv.width = 540; cv.height = 960;
      const x = cv.getContext('2d'), im = x.createImageData(540, 960);
      for (let i = 0; i < 540 * 960; i++) { const v = hash(i * 1.37 + g * 9173.1) * 255; im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = v; im.data[i * 4 + 3] = 255; }
      x.putImageData(im, 0, 0); grain.push(cv);
    }
    const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
    layerA = mk(); layerB = mk();
  }

  // ---------- quadro ----------
  function frame(ctx, t) {
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
    const act = SC.filter(s => t >= s.t0 && t < s.t1);
    act.forEach((s, i) => {
      const lay = i % 2 ? layerB : layerA, x = lay.getContext('2d');
      x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1; x.clearRect(0, 0, W, H);
      s.draw(x, t - St(s.from), t);
      ctx.globalAlpha = eio(lin(t, s.t0, s.t0 + .35)) * (1 - eio(lin(t, s.t1 - .35, s.t1))); ctx.drawImage(lay, 0, 0); ctx.globalAlpha = 1;
    });
    vignette(ctx); captions(ctx, t);
    ctx.globalAlpha = .05; ctx.globalCompositeOperation = 'overlay';
    ctx.drawImage(grain[Math.round(t * 60) % 8], 0, 0, W, H);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    // fade final pro preto antes da vinheta
    const fo = lin(t, N.duration - .5, N.duration);
    if (fo > 0) { ctx.globalAlpha = fo; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
  }

  function vignette(ctx) {
    const g = ctx.createRadialGradient(W / 2, H * .45, H * .25, W / 2, H * .45, H * .75);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.75)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }

  // ---------- legenda: uma frase por vez, fade suave, palavras-chave em vermelho ----------
  function captions(ctx, t) {
    const c = chunks.find(c => t >= c.start - .12 && t < c.end + .15); if (!c) return;
    const a = eo(lin(t, c.start - .12, c.start + .12)) * (1 - lin(t, c.end, c.end + .15));
    const size = 74; ctx.font = `600 ${size}px ${F.cond}`; ctx.textBaseline = 'alphabetic';
    const words = c.words.map(w => ({ s: w.w.toUpperCase(), hl: w.hl }));
    const sp = ctx.measureText(' ').width, maxW = 940; const rows = [[]]; let rw = 0;
    words.forEach(w => { const ww = ctx.measureText(w.s).width; if (rw + ww > maxW && rows[rows.length - 1].length) { rows.push([]); rw = 0; } rows[rows.length - 1].push({ ...w, ww }); rw += ww + sp; });
    const y0 = 1560 - (rows.length - 1) * size * 1.12 / 2 + (1 - a) * 14;
    ctx.save(); ctx.globalAlpha = a;
    rows.forEach((r, ri) => {
      const tw = r.reduce((s, w) => s + w.ww, 0) + sp * (r.length - 1); let x = (W - tw) / 2; const y = y0 + ri * size * 1.12;
      r.forEach(w => {
        ctx.lineJoin = 'round'; ctx.lineWidth = 12; ctx.strokeStyle = 'rgba(0,0,0,.85)'; ctx.strokeText(w.s, x, y);
        ctx.fillStyle = w.hl ? C.red : C.paper; ctx.fillText(w.s, x, y); x += w.ww + sp;
      });
    });
    ctx.restore();
  }

  return { init, frame, St, En, Wd, get N() { return N; } };
})();

// ================= primitivas de desenho =================
function T(x, s, px, py, o = {}) {
  x.save();
  x.font = `${o.italic ? 'italic ' : ''}${o.w || 700} ${o.size || 60}px ${o.font || F.cond}`;
  x.fillStyle = o.color || C.paper; x.textAlign = o.align || 'center'; x.textBaseline = o.base || 'middle';
  if (o.ls) x.letterSpacing = o.ls + 'px';
  x.globalAlpha *= o.a ?? 1;
  if (o.stroke) { x.lineJoin = 'round'; x.lineWidth = o.stroke; x.strokeStyle = o.strokeColor || '#000'; x.strokeText(s, px, py); }
  x.fillText(s, px, py); x.restore();
}
const typed = (s, p) => s.slice(0, Math.floor(s.length * clamp(p)));
// texto datilografado em mono com cursor
function typeT(x, s, px, py, p, o = {}) {
  const sub = typed(s, p); T(x, sub, px, py, { font: F.mono, w: 500, size: 34, align: 'left', ...o });
  if (p < 1 && p > 0) { x.save(); x.font = `${o.w || 500} ${o.size || 34}px ${F.mono}`; const w = x.measureText(sub).width; x.restore(); x.fillStyle = o.color || C.paper; x.fillRect(px + w + 4, py - (o.size || 34) * .45, (o.size || 34) * .5, (o.size || 34) * .9); }
}
// folha de papel envelhecido
function paper(x, cx, cy, w, h, rot = 0, o = {}) {
  x.save(); x.translate(cx, cy); x.rotate(rot);
  x.shadowColor = 'rgba(0,0,0,.6)'; x.shadowBlur = 40; x.shadowOffsetY = 18;
  x.fillStyle = o.color || C.paper; x.fillRect(-w / 2, -h / 2, w, h); x.shadowColor = 'transparent';
  const g = x.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2); g.addColorStop(0, 'rgba(120,90,40,.10)'); g.addColorStop(1, 'rgba(60,40,10,.22)');
  x.fillStyle = g; x.fillRect(-w / 2, -h / 2, w, h);
  x.globalAlpha = .08; x.fillStyle = '#5a4a30';
  for (let i = 0; i < 60; i++) x.fillRect(-w / 2 + hash(i + (o.seed || 1)) * w, -h / 2 + hash(i * 3.1 + (o.seed || 1)) * h, 2 + hash(i * 7) * 6, 2 + hash(i * 5) * 6);
  x.restore();
}
// carimbo: entra grande e bate
function stamp(x, s, cx, cy, p, o = {}) {
  if (p <= 0) return;
  const k = lin(p, 0, .35), sc = lerp(2.4, 1, eo(k)), size = o.size || 90;
  x.save(); x.translate(cx, cy); x.rotate(o.rot ?? -.12); x.scale(sc, sc); x.globalAlpha *= clamp(k * 3) * (o.a ?? .92);
  x.font = `700 ${size}px ${F.cond}`; x.letterSpacing = (size * .06) + 'px'; const w = x.measureText(s).width + size * .7, h = size * 1.35;
  x.strokeStyle = o.color || C.red; x.lineWidth = size * .09; x.strokeRect(-w / 2, -h / 2, w, h);
  x.lineWidth = size * .03; x.strokeRect(-w / 2 + size * .14, -h / 2 + size * .14, w - size * .28, h - size * .28);
  x.fillStyle = o.color || C.red; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(s, 0, size * .05);
  // falhas de tinta
  x.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 70; i++) { x.beginPath(); x.arc(-w / 2 + hash(i * 2.3 + size) * w, -h / 2 + hash(i * 4.7 + size) * h, 1 + hash(i * 9.1) * size * .05, 0, 7); x.fill(); }
  x.restore();
}
// silhueta do banqueiro (sem rosto), contraluz
function banker(x, cx, cy, s = 1, o = {}) {
  x.save(); x.translate(cx, cy); x.scale(s, s);
  if (o.glow !== false) { const g = x.createRadialGradient(0, -120, 40, 0, -60, 620); g.addColorStop(0, o.glowColor || 'rgba(215,38,43,.55)'); g.addColorStop(1, 'rgba(215,38,43,0)'); x.fillStyle = g; x.fillRect(-700, -800, 1400, 1400); }
  x.fillStyle = '#050505';
  x.beginPath(); x.ellipse(0, -330, 92, 112, 0, 0, 7); x.fill();               // cabeça
  x.fillRect(-42, -240, 84, 70);                                               // pescoço
  x.beginPath(); x.moveTo(-300, 400); x.bezierCurveTo(-300, -60, -230, -170, -60, -185); x.lineTo(60, -185); x.bezierCurveTo(230, -170, 300, -60, 300, 400); x.closePath(); x.fill();
  // camisa + gravata dourada
  x.fillStyle = '#d9d1c1'; x.beginPath(); x.moveTo(-58, -182); x.lineTo(0, -40); x.lineTo(58, -182); x.closePath(); x.fill();
  x.fillStyle = C.gold; x.beginPath(); x.moveTo(-14, -170); x.lineTo(14, -170); x.lineTo(24, -40); x.lineTo(0, 10); x.lineTo(-24, -40); x.closePath(); x.fill();
  x.strokeStyle = 'rgba(239,234,224,.18)'; x.lineWidth = 4; // lapelas
  x.beginPath(); x.moveTo(-60, -185); x.lineTo(-120, 60); x.moveTo(60, -185); x.lineTo(120, 60); x.stroke();
  // borda de luz (rim light)
  x.strokeStyle = o.rim || 'rgba(215,38,43,.8)'; x.lineWidth = 3; x.beginPath(); x.ellipse(0, -330, 92, 112, 0, 3.4, 5.9); x.stroke();
  x.restore();
}
// desenha um caminho em traço progressivo
function strokeP(x, p, len, fn, o = {}) {
  x.save(); x.strokeStyle = o.color || C.line; x.lineWidth = o.lw || 5; x.lineCap = 'round'; x.lineJoin = 'round';
  x.setLineDash([len, len]); x.lineDashOffset = len * (1 - clamp(p)); x.beginPath(); fn(x); x.stroke(); x.restore();
}
// prédio de banco em linhas
function bank(x, cx, cy, s, p, label, o = {}) {
  x.save(); x.translate(cx, cy); x.scale(s, s);
  strokeP(x, lin(p, 0, .5), 1400, x => { x.moveTo(-260, -150); x.lineTo(0, -300); x.lineTo(260, -150); x.closePath(); }, o);
  strokeP(x, lin(p, .2, .7), 1220, x => { x.rect(-280, -150, 560, 40); }, o);
  for (let i = 0; i < 5; i++) strokeP(x, lin(p, .3 + i * .06, .7 + i * .06), 620, x => { x.rect(-220 + i * 105, -100, 50, 250); }, o);
  strokeP(x, lin(p, .6, 1), 1300, x => { x.rect(-300, 160, 600, 50); }, o);
  if (label) T(x, label, 0, -195, { font: F.mono, w: 800, size: 30, color: o.color || C.paper, a: lin(p, .6, 1), ls: 4 });
  x.restore();
}
// cédula
function bill(x, cx, cy, w, h, rot = 0, txt = 'R$ 100', o = {}) {
  x.save(); x.translate(cx, cy); x.rotate(rot); x.globalAlpha *= o.a ?? 1;
  x.fillStyle = o.color || '#b9a36a'; x.fillRect(-w / 2, -h / 2, w, h);
  x.strokeStyle = 'rgba(20,20,20,.5)'; x.lineWidth = 3; x.strokeRect(-w / 2 + 10, -h / 2 + 10, w - 20, h - 20);
  x.beginPath(); x.arc(-w * .22, 0, h * .28, 0, 7); x.stroke();
  T(x, txt, w * .16, 0, { font: F.serif, w: 900, size: h * .38, color: '#2a2418' });
  x.restore();
}
// placar que rola até um valor
function counter(x, v, cx, cy, o = {}) { T(x, (o.fmt || brl)(v), cx, cy, { font: F.serif, w: 900, size: 120, ...o }); }
// linha de "fita" amarela/vermelha de aviso
function tape(x, s, cy, p, o = {}) {
  x.save(); x.translate(lerp(-W * 1.2, 0, eo(p)), cy); x.rotate(o.rot || -.05);
  x.fillStyle = o.color || C.red; x.fillRect(-200, -55, W + 400, 110);
  T(x, s, W / 2, 4, { size: 64, w: 700, color: o.ink || C.paper, ls: 6 });
  x.restore();
}
// pasta de dossiê
function folder(x, cx, cy, w, h, open, label, o = {}) {
  x.save(); x.translate(cx, cy); x.rotate(o.rot || 0);
  x.shadowColor = 'rgba(0,0,0,.7)'; x.shadowBlur = 50; x.shadowOffsetY = 20;
  x.fillStyle = '#8a6a3c'; x.fillRect(-w / 2, -h / 2, w, h); x.shadowColor = 'transparent';
  x.fillRect(-w / 2, -h / 2 - 50, w * .35, 60);
  paper(x, 0, -10 - open * 60, w * .9, h * .9, 0, { seed: 4 });
  // capa abrindo (perspectiva falsa)
  const k = Math.cos(open * Math.PI * .92);
  x.save(); x.translate(-w / 2, 0); x.scale(k, 1); x.fillStyle = k > 0 ? '#a07c46' : '#6e542f'; x.fillRect(0, -h / 2, w, h);
  if (k > 0) T(x, label || '', w / 2, -h * .18, { font: F.mono, w: 800, size: 46, color: '#2a2014', ls: 6 });
  x.restore();
  x.restore();
}
