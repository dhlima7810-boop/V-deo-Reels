// Dia 2 — "A máquina de inflar dinheiro". Cada cena começa na fala `from`. lt = segundos desde o início dessa fala.
const { St, En, Wd } = LIB;
const at = (id, w, k) => Wd(id, w, k);
const cam = (x, s, dx = 0, dy = 0, cx = W / 2, cy = 800) => { x.translate(cx + dx, cy + dy); x.scale(s, s); x.translate(-cx, -cy); };
// caixa de fundo de investimento
function fund(x, cx, cy, s, label, o = {}) {
  x.save(); x.translate(cx, cy); x.scale(s, s); x.globalAlpha *= o.a ?? 1;
  x.fillStyle = '#1c1a16'; x.fillRect(-120, -90, 240, 180); x.strokeStyle = o.color || C.paper; x.lineWidth = 5; x.strokeRect(-120, -90, 240, 180);
  T(x, 'FUNDO', 0, -30, { font: F.mono, w: 800, size: 28, color: C.dim, ls: 4 });
  T(x, label, 0, 30, { font: F.serif, w: 900, size: 70, color: o.color || C.paper });
  x.restore();
}
// placar de preço
function price(x, v, cx, cy, o = {}) {
  x.save(); x.translate(cx, cy);
  x.fillStyle = '#111'; x.fillRect(-300, -100, 600, 200); x.strokeStyle = C.dim; x.lineWidth = 4; x.strokeRect(-300, -100, 600, 200);
  T(x, 'R$ ' + v.toFixed(2).replace('.', ','), 0, 6, { font: F.mono, w: 800, size: 110, color: o.color || C.paper });
  x.restore();
}
// Congresso estilizado (silhueta)
function congress(x, cx, cy, s, a = 1) {
  x.save(); x.translate(cx, cy); x.scale(s, s); x.globalAlpha *= a; x.fillStyle = '#16140f';
  x.fillRect(-40, -420, 34, 420); x.fillRect(6, -420, 34, 420);
  x.fillRect(-380, -40, 760, 40);
  x.beginPath(); x.arc(-230, -40, 110, Math.PI, 0); x.fill();
  x.beginPath(); x.moveTo(110, -40); x.quadraticCurveTo(230, -40, 360, -170); x.lineTo(100, -170); x.quadraticCurveTo(160, -100, 110, -40); x.fill();
  x.restore();
}

const SCENES = [
  // 0-8s: recorte de anúncio — 140% do CDI, 20% ao ano
  { from: 'b1', draw(x, lt, t) {
    x.save(); cam(x, 1 + lt * .01);
    paper(x, W / 2, 700, 860, 1000, -.02, { seed: 11 });
    x.save(); x.translate(W / 2, 700); x.rotate(-.02);
    T(x, 'CLASSIFICADOS · INVESTIMENTOS', 0, -440, { font: F.mono, w: 800, size: 26, color: C.ink, ls: 4 });
    x.fillStyle = C.ink; x.fillRect(-380, -410, 760, 4);
    T(x, 'RENDA', 0, -320, { font: F.serif, w: 900, size: 90, color: C.ink, a: lin(lt, 0, .3) });
    T(x, 'GARANTIDA!', 0, -220, { font: F.serif, w: 900, size: 90, color: C.ink, a: lin(lt, .1, .4) });
    const a = at('b1', 'absurdos'); T(x, '(juros absurdos)', 0, -130, { font: F.serif, w: 400, italic: true, size: 40, color: '#4a4238', a: lin(t, a - .2, a + .2) });
    const c = at('b1', '140');
    T(x, '140%', 0, 30, { font: F.serif, w: 900, size: 230, color: C.red, a: lin(t, c - .2, c) });
    T(x, 'DO CDI', 0, 200, { font: F.cond, w: 700, size: 70, color: C.ink, a: lin(t, c, c + .3) });
    const v = at('b1', '20');
    T(x, 'ou 20% ao ano', 0, 330, { font: F.mono, w: 800, size: 54, color: C.ink, a: lin(t, v - .2, v + .1) });
    x.restore();
    stamp(x, 'ABSURDO', W / 2 + 120, 1170, lin(t, a - .05, a + .55), { size: 72, rot: .12 });
    x.restore();
  } },
  // 8-12s: CDB = você empresta pro banco e recebe com juros
  { from: 'b3', draw(x, lt, t) {
    x.save(); cam(x, 1 + lt * .01);
    T(x, 'CDB', W / 2, 300, { font: F.serif, w: 900, size: 170, color: C.paper, a: lin(lt, -.2, .2) });
    T(x, 'VOCÊ', 230, 820, { size: 56, w: 700 }); bank(x, 820, 860, .5, 1, '');
    for (let i = 0; i < 5; i++) {
      const p = eio(lin(lt, .3 + i * .12, 1.2 + i * .12)), q = eio(lin(t, at('b3', 'juros') - .4 + i * .08, at('b3', 'juros') + .4 + i * .08));
      const xx = q > 0 ? lerp(760, 260, q) : lerp(260, 760, p), yy = q > 0 ? 1100 + Math.sin(q * Math.PI) * 60 : 700 - Math.sin(p * Math.PI) * 80;
      x.fillStyle = C.gold; x.beginPath(); x.arc(xx + i * 6, yy, 30, 0, 7); x.fill();
    }
    const j = at('b3', 'juros'); for (let i = 0; i < 3; i++) { const q = eback(lin(t, j + .2 + i * .1, j + .6 + i * .1)); x.fillStyle = C.red; x.beginPath(); x.arc(260 + i * 70, 1220, 26 * q, 0, 7); x.fill(); }
    T(x, '+ JUROS', 400, 1310, { size: 52, w: 700, color: C.red, a: lin(t, j, j + .3) });
    x.restore();
  } },
  // 12-21s: "por que todo mundo topava?" + escudo do FGC
  { from: 'b4', draw(x, lt, t) {
    x.save(); cam(x, 1 + lt * .008);
    typeT(x, 'POR QUE TODO MUNDO TOPAVA?', 110, 300, lin(lt, 0, 1.2), { size: 40, w: 800 });
    for (let i = 0; i < 9; i++) bill(x, 380 + (i % 3) * 160, 1100 - Math.floor(i / 3) * 60, 300, 130, (hash(i) - .5) * .3, 'R$ 100');
    const f = at('b4', 'fgc'), k = eo(lin(t, f - .4, f + .2));
    x.save(); x.translate(W / 2, lerp(-300, 860, k));
    x.fillStyle = 'rgba(239,234,224,.95)'; x.beginPath(); x.moveTo(-260, -300); x.lineTo(260, -300); x.lineTo(260, 0); x.quadraticCurveTo(250, 220, 0, 340); x.quadraticCurveTo(-250, 220, -260, 0); x.closePath(); x.fill();
    x.strokeStyle = C.ink; x.lineWidth = 10; x.stroke();
    T(x, 'FGC', 0, -60, { font: F.serif, w: 900, size: 170, color: C.ink });
    T(x, 'FUNDO GARANTIDOR', 0, 80, { font: F.mono, w: 800, size: 30, color: C.ink, ls: 3 });
    x.restore();
    const s = at('b5', 'seguro'), m = at('b5', '250');
    T(x, 'É UM SEGURO', W / 2, 1360, { size: 56, w: 700, color: C.gold, a: lin(t, s - .2, s + .2), ls: 4 });
    x.save(); x.translate(W / 2, 450); x.rotate(-.04); x.globalAlpha = eback(lin(t, m - .3, m + .2));
    x.fillStyle = C.red; x.fillRect(-380, -60, 760, 120); T(x, 'ATÉ R$ 250 MIL POR CPF', 0, 4, { size: 56, w: 700, color: C.paper }); x.restore();
    x.restore();
  } },
  // 21-23s: "se der merda, alguém paga" — tipografia cinética
  { from: 'b6', draw(x, lt, t) {
    const m = at('b6', 'merda'), p = at('b6', 'paga'), sh = lin(t, m, m + .08) * (1 - lin(t, m + .1, m + .4)) * 14;
    x.save(); cam(x, 1 + lt * .03, Math.sin(t * 80) * sh, 0);
    T(x, 'SE DER', W / 2, 560, { font: F.serif, w: 900, size: 120, a: lin(lt, -.1, .2) });
    T(x, 'MERDA,', W / 2, 720, { font: F.serif, w: 900, size: 200, color: C.red, a: lin(t, m - .15, m) });
    T(x, 'ALGUÉM', W / 2, 920, { font: F.serif, w: 900, size: 120, a: lin(t, p - .5, p - .3) });
    T(x, 'PAGA.', W / 2, 1060, { font: F.serif, w: 900, size: 150, color: C.gold, a: lin(t, p - .1, p + .1) });
    x.restore();
  } },
  // 23-29s: dinheiro escorre para fundos; aparece a ficha E.M.
  { from: 'b7', draw(x, lt, t) {
    x.save(); cam(x, 1 + lt * .01);
    T(x, 'A MALANDRAGEM', W / 2, 260, { font: F.mono, w: 800, size: 44, color: C.red, ls: 10, a: lin(lt, 0, .3) });
    bank(x, W / 2, 560, .55, 1, 'MASTER');
    const d = at('b7', 'montava'), xs = [250, 540, 830], lb = ['A', 'B', 'C'];
    xs.forEach((fx, i) => {
      const p = lin(t, d - .3 + i * .15, d + .5 + i * .15);
      strokeP(x, p, 600, x => { x.moveTo(W / 2, 690); x.lineTo(W / 2, 760); x.lineTo(fx, 760); x.lineTo(fx, 860); }, { color: C.gold, lw: 6 });
      fund(x, fx, 960, .9, lb[i], { a: lin(p, .7, 1) });
      for (let k = 0; k < 3; k++) { const q = ((t * .9 + k / 3 + i * .2) % 1); if (p >= 1) { x.fillStyle = C.gold; x.beginPath(); x.arc(lerp(W / 2, fx, clamp(q * 2)), q < .5 ? 760 : lerp(760, 860, (q - .5) * 2), 9, 0, 7); x.fill(); } }
    });
    const e = at('b7', 'em');
    x.save(); x.translate(W / 2, 1260); x.globalAlpha = eback(lin(t, e - .2, e + .3)); x.scale(.6 + .4 * clamp(x.globalAlpha), .6 + .4 * clamp(x.globalAlpha));
    x.fillStyle = C.paper; x.fillRect(-170, -70, 340, 140); T(x, 'E.M.', 0, 6, { font: F.serif, w: 900, size: 100, color: C.ink }); x.restore();
    x.restore();
  } },
  // 29-32s: ficha cadastral "E.M. — EMPRESA MERDA S.A."
  { from: 'b8', draw(x, lt, t) {
    x.save(); cam(x, 1 + lt * .015);
    paper(x, W / 2, 760, 820, 900, .02, { seed: 21 });
    x.save(); x.translate(W / 2, 760); x.rotate(.02);
    T(x, 'FICHA CADASTRAL', 0, -380, { font: F.mono, w: 800, size: 32, color: C.ink, ls: 6 });
    T(x, 'E.M.', 0, -240, { font: F.serif, w: 900, size: 170, color: C.ink });
    typeT(x, 'EMPRESA MERDA S.A.', -330, -80, lin(lt, 0, .9), { color: C.ink, size: 44, w: 800 });
    typeT(x, 'Valor da ação: R$ 1,00', -330, 0, lin(lt, .7, 1.4), { color: C.ink, size: 34 });
    typeT(x, 'Situação: só existe', -330, 60, lin(t, at('b8', 'só') - .3, at('b8', 'existe') + .3), { color: C.ink, size: 34 });
    x.restore();
    const c = at('b8', 'coitada'); T(x, '(coitada)', W / 2 + 160, 1260, { font: F.serif, w: 400, italic: true, size: 64, color: C.paper, a: lin(t, c - .2, c + .1) });
    x.restore();
  } },
  // 32-44s: preço da ação: R$ 1 → R$ 10 → R$ 100
  { from: 'b9', draw(x, lt, t) {
    const d = at('b10', 'dez'), c = at('b11', 'cem'), m = at('b11', 'mão');
    const sh = lin(t, c, c + .05) * (1 - lin(t, c + .1, c + .5)) * 16;
    x.save(); cam(x, 1 + (t - St('b9')) * .006, Math.sin(t * 90) * sh, 0);
    T(x, 'AÇÃO E.M.', W / 2, 300, { font: F.mono, w: 800, size: 40, color: C.dim, ls: 8 });
    const v = t < d - .1 ? 1 : t < c - .1 ? 10 : 100;
    const flip = Math.min(Math.abs(t - (d - .1)), Math.abs(t - (c - .1)));
    x.save(); x.translate(W / 2, 470); x.scale(1, clamp(flip / .1, .05, 1)); price(x, v, 0, 0, { color: v === 1 ? C.paper : v === 10 ? C.gold : C.red }); x.restore();
    // Fundo A compra 2 milhões; Fundo B compra caro
    const a = at('b9', 'fundo'), b = at('b10', 'outro');
    fund(x, 270, 860, 1, 'A', { a: lin(t, a - .3, a) });
    T(x, '2.000.000 ações', 270, 1010, { font: F.mono, w: 800, size: 30, a: lin(t, at('b9', 'dois') - .2, at('b9', 'dois') + .2) });
    fund(x, 810, 860, 1, 'B', { a: lin(t, b - .3, b), color: C.gold });
    T(x, 'mesmo grupo', 810, 1010, { font: F.mono, w: 800, size: 30, color: C.gold, a: lin(t, at('b10', 'mesmo') - .2, at('b10', 'mesmo') + .2) });
    // ações pulando de A para B
    for (let i = 0; i < 6; i++) { const q = lin(t, b + .5 + i * .15, b + 1.1 + i * .15); if (q > 0 && q < 1) { x.fillStyle = C.paper; x.fillRect(lerp(330, 750, q) - 20, 820 - Math.sin(q * Math.PI) * 180, 40, 50); } }
    T(x, 'EXEMPLO SIMPLIFICADO', W / 2, 1180, { font: F.mono, w: 800, size: 28, color: C.dim, ls: 4, a: lin(t, d - .3, d) });
    T(x, 'PERDEU A MÃO', W / 2, 1290, { font: F.serif, w: 900, size: 90, color: C.red, a: lin(t, m - .2, m + .1) });
    x.restore();
  } },
  // 44-51s: balanço incha de 2 para 200 milhões, depois CDB jorrando
  { from: 'b12', draw(x, lt, t) {
    x.save(); cam(x, 1 + lt * .008);
    const p = eio(lin(t, at('b12', 'viram') - .2, at('b12', 'duzentos') + .6));
    paper(x, W / 2, 640, 820 + 60 * p, 560 + 40 * p, -.015, { seed: 31 });
    x.save(); x.translate(W / 2, 640); x.rotate(-.015);
    T(x, 'BALANÇO · ATIVO', 0, -210, { font: F.mono, w: 800, size: 30, color: C.ink, ls: 6 });
    const v = lerp(2, 200, p); const wob = p > 0 && p < 1 ? Math.sin(t * 40) * 4 : 0;
    T(x, `R$ ${Math.round(v)} milhões`, wob, 0, { font: F.serif, w: 900, size: 96 + 30 * p, color: p > .5 ? C.red : C.ink });
    T(x, '(no papel)', 0, 170, { font: F.serif, w: 400, italic: true, size: 44, color: '#4a4238', a: lin(t, at('b13', 'papel') - .3, at('b13', 'papel')) });
    x.restore();
    // CDBs saindo da impressora
    const c = at('b13', 'vende');
    for (let i = 0; i < 12; i++) { const q = lin(t, c - .3 + i * .12, c + .5 + i * .12); if (q <= 0) continue;
      x.save(); x.translate(lerp(W / 2, 140 + (i % 6) * 160, eo(q)), lerp(1000, 1080 + Math.floor(i / 6) * 150, eo(q))); x.rotate((hash(i + 3) - .5) * .4);
      x.fillStyle = C.paper2; x.fillRect(-70, -45, 140, 90); T(x, 'CDB', 0, 2, { size: 40, w: 700, color: C.ink }); x.restore(); }
    x.restore();
  } },
  // 51-54s: fundo em cima de fundo em cima de fundo
  { from: 'b14', draw(x, lt, t) {
    x.save(); cam(x, 1.0 - lt * .03, 0, 0, W / 2, 1300);
    for (let i = 0; i < 14; i++) { const q = eback(lin(lt, i * .16, i * .16 + .3)); if (q <= 0) continue;
      fund(x, W / 2 + (hash(i * 7) - .5) * 90, 1300 - i * 150 - (1 - q) * 300, .9, String.fromCharCode(65 + i), { a: clamp(q) }); }
    x.restore();
  } },
  // 55-59s: etiqueta de R$ 100 colada na E.M. — quem compra?
  { from: 'b15', draw(x, lt, t) {
    x.save(); cam(x, 1 + lt * .012);
    x.fillStyle = '#6e542f'; x.fillRect(W / 2 - 260, 620, 520, 420); x.strokeStyle = '#3d2e18'; x.lineWidth = 6; x.strokeRect(W / 2 - 260, 620, 520, 420);
    T(x, 'E.M.', W / 2, 830, { font: F.serif, w: 900, size: 150, color: '#2a2014' });
    const c = at('b15', 'cem'), k = eback(lin(t, c - .15, c + .2));
    x.save(); x.translate(W / 2 + 170, 640); x.rotate(.2); x.scale(lerp(1.8, 1, clamp(k)), lerp(1.8, 1, clamp(k))); x.globalAlpha = clamp(k * 2);
    x.fillStyle = C.red; x.beginPath(); x.moveTo(-150, -70); x.lineTo(110, -70); x.lineTo(170, 0); x.lineTo(110, 70); x.lineTo(-150, 70); x.closePath(); x.fill();
    T(x, 'R$ 100', -20, 4, { font: F.serif, w: 900, size: 70, color: C.paper }); x.restore();
    T(x, 'QUEM COMPRA?', W / 2, 1250, { font: F.serif, w: 900, size: 100, a: lin(t, at('b15', 'alguém') - .2, at('b15', 'alguém') + .2) });
    x.restore();
  } },
  // 59-61s: Brasília à noite, "OS AMIGOS"
  { from: 'b16', draw(x, lt, t) {
    x.save(); cam(x, 1 + lt * .03, 0, 0, W / 2, 1100);
    const g = x.createRadialGradient(W / 2, 1100, 50, W / 2, 1100, 800); g.addColorStop(0, 'rgba(215,38,43,.4)'); g.addColorStop(1, 'rgba(215,38,43,0)'); x.fillStyle = g; x.fillRect(0, 0, W, H);
    congress(x, W / 2, 1240, 1.2);
    const a = at('b16', 'amigos');
    T(x, 'OS AMIGOS', W / 2, 520, { font: F.serif, w: 900, size: 140, a: lin(t, a - .2, a + .2) });
    T(x, 'AMANHÃ', W / 2, 400, { font: F.mono, w: 800, size: 40, color: C.dim, ls: 14, a: lin(t, a, a + .4) });
    x.restore();
  } },
];
