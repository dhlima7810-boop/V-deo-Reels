// Dia 3 — "Os amigos poderosos". Cada cena começa na fala `from`. lt = segundos desde o início dessa fala.
const { St, En, Wd } = LIB;
const at = (id, w, k) => Wd(id, w, k);
const cam = (x, s, dx = 0, dy = 0, cx = W / 2, cy = 800) => { x.translate(cx + dx, cy + dy); x.scale(s, s); x.translate(-cx, -cy); };
// cartão de investigação sem rosto
function card(x, cx, cy, label, a, o = {}) {
  x.save(); x.translate(cx, cy); x.rotate(o.rot || 0); x.globalAlpha *= a;
  x.shadowColor = 'rgba(0,0,0,.6)'; x.shadowBlur = 20; x.fillStyle = C.paper; x.fillRect(-120, -130, 240, 260); x.shadowColor = 'transparent';
  x.fillStyle = '#2a2722'; x.beginPath(); x.arc(0, -40, 50, 0, 7); x.fill(); x.fillRect(-70, 10, 140, 60);
  T(x, label, 0, 100, { size: 34, w: 700, color: C.ink });
  x.fillStyle = C.red; x.beginPath(); x.arc(0, -120, 10, 0, 7); x.fill();
  x.restore();
}
function glass(x, cx, cy, s, rot) {
  x.save(); x.translate(cx, cy); x.rotate(rot); x.scale(s, s); x.strokeStyle = C.gold; x.lineWidth = 6;
  x.beginPath(); x.moveTo(-40, -140); x.quadraticCurveTo(-40, -20, 0, -10); x.quadraticCurveTo(40, -20, 40, -140); x.closePath(); x.stroke();
  x.fillStyle = 'rgba(201,162,74,.5)'; x.beginPath(); x.moveTo(-36, -90); x.quadraticCurveTo(-36, -22, 0, -14); x.quadraticCurveTo(36, -22, 36, -90); x.closePath(); x.fill();
  x.beginPath(); x.moveTo(0, -10); x.lineTo(0, 80); x.moveTo(-40, 80); x.lineTo(40, 80); x.stroke(); x.restore();
}

const SCENES = [
  // 0-5s: E.M. com etiqueta R$ 100 → "BANCO PÚBLICO!"
  { from: 'c1', draw(x, lt, t) {
    x.save(); cam(x, 1 + lt * .012);
    x.fillStyle = '#6e542f'; x.fillRect(W / 2 - 230, 520, 460, 380); x.strokeStyle = '#3d2e18'; x.lineWidth = 6; x.strokeRect(W / 2 - 230, 520, 460, 380);
    T(x, 'E.M.', W / 2, 710, { font: F.serif, w: 900, size: 130, color: '#2a2014' });
    x.save(); x.translate(W / 2 + 150, 540); x.rotate(.2); x.fillStyle = C.red; x.beginPath(); x.moveTo(-130, -60); x.lineTo(90, -60); x.lineTo(150, 0); x.lineTo(90, 60); x.lineTo(-130, 60); x.closePath(); x.fill();
    T(x, 'R$ 100', -20, 4, { font: F.serif, w: 900, size: 60, color: C.paper }); x.restore();
    T(x, 'QUEM COMPRA?', W / 2, 330, { font: F.serif, w: 900, size: 96, a: lin(lt, -.1, .3) });
    const p = at('c1', 'público'); stamp(x, 'BANCO PÚBLICO!', W / 2, 1120, lin(t, p - .1, p + .5), { size: 84, rot: -.08 });
    const m = at('c1', 'maravilhosa'); T(x, 'que jogada maravilhosa...', W / 2, 1300, { font: F.serif, w: 400, italic: true, size: 54, color: C.dim, a: lin(t, m - .4, m) });
    x.restore();
  } },
  // 5-16s: carteiras de crédito do Master pro BRB; R$ 12 bi; "vento"; "Vorcaro nega"
  { from: 'c2', draw(x, lt, t) {
    x.save(); cam(x, 1 + lt * .005);
    bank(x, 260, 560, .62, lin(lt, 0, 1), 'MASTER', { color: C.gold });
    bank(x, 820, 560, .62, lin(lt, .3, 1.3), 'BRB');
    T(x, 'banco do governo do DF', 820, 730, { font: F.mono, w: 500, size: 24, color: C.dim, a: lin(t, at('c2', 'governo') - .2, at('c2', 'governo') + .2) });
    const c = at('c2', 'comprou'), v = at('c3', 'vento');
    for (let i = 0; i < 8; i++) {
      const q = eio(lin(t, c - .2 + i * .3, c + .8 + i * .3)); if (q <= 0) continue;
      const empty = i % 3 !== 0, fade = empty ? 1 - .8 * lin(t, v - .2 + i * .04, v + .3 + i * .04) : 1;
      x.save(); x.globalAlpha = fade; x.translate(lerp(260, 820, q), 900 - Math.sin(q * Math.PI) * 120 + (q >= 1 ? -Math.floor(i / 2) * 10 : 0)); x.rotate((hash(i) - .5) * .2);
      x.fillStyle = '#8a6a3c'; x.fillRect(-90, -60, 180, 120); x.strokeStyle = '#3d2e18'; x.lineWidth = 3; x.strokeRect(-90, -60, 180, 120);
      T(x, 'CRÉDITO', 0, 4, { font: F.mono, w: 800, size: 22, color: '#2a2014' }); x.restore();
      if (empty && t > v) { x.save(); x.globalAlpha = lin(t, v, v + .3) * .9; T(x, '?', 820 + (i - 4) * 18, 900 - Math.floor(i / 2) * 10, { font: F.serif, w: 900, size: 60, color: C.red }); x.restore(); }
    }
    const b = at('c2', '12'); T(x, 'R$ 12 BILHÕES', W / 2, 1150, { font: F.serif, w: 900, size: 104, color: C.paper, a: lin(t, b - .2, b + .2) });
    T(x, 'EM CARTEIRAS DE CRÉDITO', W / 2, 1240, { font: F.mono, w: 800, size: 30, color: C.dim, ls: 4, a: lin(t, b + .2, b + .5) });
    stamp(x, 'PF: ERA VENTO', W / 2, 330, lin(t, v - .1, v + .5), { size: 76, rot: -.06 });
    const ng = at('c3', 'nega');
    x.save(); x.globalAlpha = lin(t, ng - .3, ng); x.fillStyle = '#26231e'; x.fillRect(W / 2 - 230, 1310, 460, 80); T(x, 'VORCARO NEGA', W / 2, 1352, { font: F.mono, w: 800, size: 36, color: C.paper2, ls: 4 }); x.restore();
    x.restore();
  } },
  // 17-20s: "VAMOS SUPOR" — cartela de hipótese
  { from: 'c4', draw(x, lt, t) {
    x.save(); cam(x, 1 + lt * .02);
    typeT(x, 'E COMO SE CONVENCE', 140, 600, lin(lt, 0, .9), { size: 44, w: 800 });
    typeT(x, 'UM BANCO PÚBLICO?', 140, 670, lin(lt, .8, 1.6), { size: 44, w: 800 });
    const s = at('c4', 'supor');
    x.save(); x.translate(W / 2, 900); x.globalAlpha = eback(lin(t, s - .5, s)); x.fillStyle = C.paper; x.fillRect(-440, -90, 880, 180);
    T(x, 'VAMOS SUPOR', 0, 6, { font: F.serif, w: 900, size: 96, color: C.ink }); x.restore();
    T(x, '(hipótese)', W / 2, 1060, { font: F.serif, w: 400, italic: true, size: 44, color: C.dim, a: lin(t, s, s + .3) });
    x.restore();
  } },
  // 20-24s: jantar, drink, champanhe, amigos do amigo
  { from: 'c5', draw(x, lt, t) {
    x.save(); cam(x, 1 + lt * .01);
    const g = x.createRadialGradient(W / 2, 900, 50, W / 2, 900, 700); g.addColorStop(0, 'rgba(201,162,74,.28)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, W, H);
    x.fillStyle = '#1d1a15'; x.fillRect(80, 1060, 920, 30);
    const ch = at('c5', 'champanhe'), clink = Math.sin(clamp(lin(t, ch - .3, ch + .3)) * Math.PI);
    glass(x, 430 + clink * 30, 980, 1.2, .25 * clink); glass(x, 650 - clink * 30, 980, 1.2, -.25 * clink);
    for (let i = 0; i < 4; i++) { x.save(); x.globalAlpha = .9; banker(x, 140 + i * 270, 1380, .45, { glow: false }); x.restore(); }
    const lbl = [['JANTAR', 'jantar', 230, 400], ['DRINK', 'drink', 820, 470], ['CHAMPANHE', 'champanhe', 300, 600], ['AMIGOS DO AMIGO', 'amigos', 760, 680]];
    lbl.forEach(([s, w, px, py], i) => { const k = eback(lin(t, at('c5', w) - .2, at('c5', w) + .2)); x.save(); x.translate(px, py); x.rotate((hash(i + 5) - .5) * .15); x.scale(clamp(k, 0, 1.2), clamp(k, 0, 1.2));
      x.font = `700 48px ${F.cond}`; const w2 = x.measureText(s).width + 50; x.fillStyle = C.paper; x.fillRect(-w2 / 2, -40, w2, 80); T(x, s, 0, 3, { size: 48, w: 700, color: C.ink }); x.restore(); });
    x.restore();
  } },
  // 24-27s: contracheque do fiscal
  { from: 'c6', draw(x, lt, t) {
    x.save(); cam(x, 1 + lt * .015);
    T(x, 'VAMOS SUPOR DE NOVO', W / 2, 330, { font: F.mono, w: 800, size: 40, color: C.red, ls: 6, a: lin(lt, 0, .3) });
    paper(x, W / 2, 800, 760, 600, .02, { seed: 41 });
    x.save(); x.translate(W / 2, 800); x.rotate(.02);
    T(x, 'CONTRACHEQUE', 0, -220, { font: F.mono, w: 800, size: 34, color: C.ink, ls: 6 });
    typeT(x, 'CARGO: FISCAL', -300, -110, lin(t, at('c6', 'fiscal') - .4, at('c6', 'fiscal') + .3), { color: C.ink, size: 40, w: 800 });
    T(x, 'SALÁRIO', -300, 10, { font: F.mono, w: 500, size: 34, color: C.ink, align: 'left' });
    counter(x, 20000 * eo(lin(t, at('c6', '20') - .3, at('c6', '20') + .4)), 0, 130, { color: C.ink, size: 110 });
    x.restore(); x.restore();
  } },
  // 27-33s: cartão com senha, Noronha, sacolas
  { from: 'c7', draw(x, lt, t) {
    x.save(); cam(x, 1 + lt * .01);
    const n = at('c7', 'noronha'), c = at('c7', 'cartão'), s = at('c7', 'shopping');
    // passagem
    x.save(); x.translate(W / 2 - 60, 420); x.rotate(-.08); x.globalAlpha = eback(lin(t, n - .4, n)); x.fillStyle = C.paper; x.fillRect(-340, -90, 680, 180);
    x.strokeStyle = C.ink; x.setLineDash([10, 8]); x.lineWidth = 3; x.beginPath(); x.moveTo(170, -90); x.lineTo(170, 90); x.stroke(); x.setLineDash([]);
    T(x, 'CARTÃO DE EMBARQUE', -90, -45, { font: F.mono, w: 800, size: 24, color: C.ink }); T(x, 'FERNANDO DE NORONHA', -90, 20, { size: 44, w: 700, color: C.ink }); T(x, '✈', 255, 0, { size: 80, color: C.ink }); x.restore();
    // cartão preto + post-it
    x.save(); x.translate(W / 2 + 40, 740); x.rotate(.06); x.globalAlpha = eback(lin(t, c - .4, c));
    x.fillStyle = '#121212'; x.shadowColor = 'rgba(0,0,0,.8)'; x.shadowBlur = 30; x.fillRect(-300, -180, 600, 360); x.shadowColor = 'transparent';
    x.strokeStyle = C.gold; x.lineWidth = 3; x.strokeRect(-300, -180, 600, 360); x.fillStyle = C.gold; x.fillRect(-240, -90, 90, 70);
    T(x, '•••• •••• •••• 2026', 0, 60, { font: F.mono, w: 800, size: 38, color: C.paper2 }); T(x, 'BLACK', 200, -120, { font: F.serif, w: 900, size: 44, color: C.gold });
    const sn = at('c7', 'senha'); x.save(); x.translate(220, 140); x.rotate(-.12); x.globalAlpha = lin(t, sn - .2, sn + .1); x.fillStyle = '#e8d35a'; x.fillRect(-110, -90, 220, 180); T(x, 'senha:', 0, -30, { font: F.mono, w: 800, size: 30, color: C.ink }); T(x, '1234', 0, 30, { font: F.mono, w: 800, size: 48, color: C.ink }); x.restore();
    x.restore();
    // sacolas
    for (let i = 0; i < 4; i++) { const k = eback(lin(t, s - .3 + i * .1, s + .1 + i * .1)); if (k <= 0) continue; x.save(); x.translate(220 + i * 210, 1130 + (1 - k) * 300); x.scale(.85, .85);
      x.fillStyle = i % 2 ? C.paper : '#1d1a15'; x.strokeStyle = C.gold; x.lineWidth = 3; x.fillRect(-80, -100, 160, 200); x.strokeRect(-80, -100, 160, 200);
      x.beginPath(); x.arc(0, -100, 40, Math.PI, 0); x.stroke(); T(x, 'GRIFE', 0, 10, { font: F.serif, w: 900, size: 34, color: i % 2 ? C.ink : C.gold }); x.restore(); }
    x.restore();
  } },
  // 33-34s: "É CRIME?" "IMAGINA."
  { from: 'c8', lead: .2, draw(x, lt, t) {
    x.save(); cam(x, 1 + lt * .04);
    T(x, 'É CRIME?', W / 2, 650, { font: F.serif, w: 900, size: 170 });
    const i = at('c8', 'imagina'); T(x, 'imagina.', W / 2, 860, { font: F.serif, w: 700, italic: true, size: 140, color: C.red, a: lin(t, i - .1, i + .05) });
    x.restore();
  } },
  // 35-40s: recortes: palestra em Portugal, festa, jantar, "as meninas" (tarja)
  { from: 'c9', draw(x, lt, t) {
    x.save(); cam(x, 1 + lt * .01);
    T(x, 'DIZEM QUE...', W / 2, 260, { font: F.mono, w: 800, size: 44, color: C.red, ls: 8, a: lin(lt, 0, .3) });
    const it = [['PALESTRA PAGA EM PORTUGAL', 'palestrinha', 520, -.04], ['FESTA', 'festa', 760, .05], ['JANTAR', 'jantar', 960, -.03], ['E ATÉ AS MENINAS', 'meninas', 1180, .03]];
    it.forEach(([s, w, py, r], i) => { const k = eback(lin(t, at('c9', w) - .3, at('c9', w) + .1)); if (k <= 0) return;
      x.save(); x.translate(W / 2 + (i % 2 ? 60 : -40), py); x.rotate(r); x.scale(lerp(1.4, 1, clamp(k)), lerp(1.4, 1, clamp(k))); x.globalAlpha = clamp(k);
      x.font = `900 ${i ? 80 : 56}px ${F.serif}`; const ww = x.measureText(s).width + 70;
      paper(x, 0, 0, ww, i ? 140 : 120, 0, { seed: 50 + i }); T(x, s, 0, 6, { font: F.serif, w: 900, size: i ? 80 : 56, color: C.ink });
      if (i === 3) { const p = lin(t, at('c9', 'meninas') + .3, at('c9', 'meninas') + .7); x.fillStyle = '#000'; x.fillRect(-ww / 2 + 210, -45, (ww - 250) * eo(p), 90); }
      x.restore(); });
    x.restore();
  } },
  // 40-46s: parede de investigação: deputado, senador, prefeito, pastor, comediante, influencer
  { from: 'c10', draw(x, lt, t) {
    x.save(); cam(x, 1.08 - lt * .012);
    x.fillStyle = '#1a1712'; x.fillRect(40, 220, 1000, 1200);
    banker(x, W / 2, 1010, .5, { glowColor: 'rgba(215,38,43,.3)' });
    const ws = ['deputado', 'senador', 'prefeito', 'pastor', 'comediante', 'influencer'], lb = ['DEPUTADO', 'SENADOR', 'PREFEITO', 'PASTOR', 'COMEDIANTE', 'INFLUENCER'];
    const pos = [[220, 500], [540, 460], [860, 510], [210, 1180], [540, 1260], [870, 1180]];
    ws.forEach((w, i) => { const k = lin(t, at('c10', w) - .2, at('c10', w) + .15); if (k <= 0) return;
      strokeP(x, lin(k, .3, 1), 800, x => { x.moveTo(pos[i][0], pos[i][1] - 120); x.lineTo(W / 2, 900); }, { color: C.red, lw: 4 });
      card(x, pos[i][0], pos[i][1], lb[i], eo(k * 1.5), { rot: (hash(i * 3) - .5) * .12 }); });
    T(x, 'A LISTA TINHA DE TUDO', W / 2, 270, { font: F.mono, w: 800, size: 34, color: C.paper2, ls: 4, a: lin(lt, .1, .4) });
    x.restore();
  } },
  // 46-49s: PF investiga; investigação ≠ condenação
  { from: 'c11', draw(x, lt, t) {
    x.save(); cam(x, 1 + lt * .01);
    const ang = lt * 1.6, mx = W / 2 + Math.cos(ang) * 200, my = 800 + Math.sin(ang * 1.3) * 160;
    for (let i = 0; i < 7; i++) { x.fillStyle = 'rgba(239,234,224,.12)'; x.fillRect(140, 560 + i * 70, 800 * (.6 + hash(i) * .4), 26); }
    x.strokeStyle = C.paper; x.lineWidth = 16; x.beginPath(); x.arc(mx, my, 150, 0, 7); x.stroke();
    x.lineWidth = 30; x.lineCap = 'round'; x.beginPath(); x.moveTo(mx + 110, my + 110); x.lineTo(mx + 260, my + 260); x.stroke();
    T(x, 'POLÍCIA FEDERAL', W / 2, 330, { font: F.mono, w: 800, size: 40, color: C.paper2, ls: 8 });
    const iv = at('c11', 'investiga'); T(x, 'INVESTIGA', W / 2, 430, { font: F.serif, w: 900, size: 110, color: C.red, a: lin(t, iv - .2, iv + .2) });
    T(x, 'investigação ≠ condenação', W / 2, 1300, { font: F.serif, w: 400, italic: true, size: 48, color: C.dim, a: lin(lt, 1, 1.5) });
    x.restore();
  } },
  // 50-54s: os outros banqueiros acendem as luzes
  { from: 'c12', draw(x, lt, t) {
    const b = at('c12', 'banqueiros');
    x.save(); cam(x, 1 + lt * .02, 0, 0, W / 2, 1000);
    for (let i = 0; i < 4; i++) { const bx = 100 + i * 240, bh = 700 + hash(i + 2) * 300, by = 1350 - bh;
      x.fillStyle = '#121110'; x.fillRect(bx, by, 200, bh);
      for (let r = 0; r < 14; r++) for (let c2 = 0; c2 < 3; c2++) { const on = t > b - .6 + hash(i * 50 + r * 3 + c2) * 1.2;
        x.fillStyle = on ? 'rgba(239,220,170,.85)' : 'rgba(255,255,255,.05)'; x.fillRect(bx + 25 + c2 * 55, by + 30 + r * 48, 35, 28); } }
    T(x, 'NÃO FOI POLÍTICO', W / 2, 330, { font: F.mono, w: 800, size: 40, color: C.dim, ls: 6, a: lin(t, at('c12', 'político') - .2, at('c12', 'político') + .2) });
    T(x, 'OS OUTROS', W / 2, 440, { font: F.serif, w: 900, size: 100, a: lin(t, b - .5, b - .2) });
    T(x, 'BANQUEIROS', W / 2, 560, { font: F.serif, w: 900, size: 120, color: C.red, a: lin(t, b - .1, b + .2) });
    x.restore();
  } },
];
