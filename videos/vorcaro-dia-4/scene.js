// Dia 4 — "Como o esquema acabou". Cada cena começa na fala `from`. lt = segundos desde o início dessa fala.
const { St, En, Wd } = LIB;
const at = (id, w, k) => Wd(id, w, k);
const cam = (x, s, dx = 0, dy = 0, cx = W / 2, cy = 800) => { x.translate(cx + dx, cy + dy); x.scale(s, s); x.translate(-cx, -cy); };
function shield(x, label, sub) {
  x.fillStyle = 'rgba(239,234,224,.95)'; x.beginPath(); x.moveTo(-260, -300); x.lineTo(260, -300); x.lineTo(260, 0); x.quadraticCurveTo(250, 220, 0, 340); x.quadraticCurveTo(-250, 220, -260, 0); x.closePath(); x.fill();
  x.strokeStyle = C.ink; x.lineWidth = 10; x.stroke();
  T(x, label, 0, -60, { font: F.serif, w: 900, size: 170, color: C.ink }); if (sub) T(x, sub, 0, 80, { font: F.mono, w: 800, size: 30, color: C.ink, ls: 3 });
}
function crown(x, cx, cy, s, rot = 0, split = 0) {
  x.save(); x.translate(cx, cy); x.rotate(rot); x.scale(s, s); x.fillStyle = C.gold;
  [[-1, -split], [1, split]].forEach(([side, d]) => { x.save(); x.translate(d * 60, Math.abs(d) * 40); x.rotate(d * .4); x.beginPath();
    if (side < 0) { x.moveTo(-130, 60); x.lineTo(-150, -60); x.lineTo(-70, 0); x.lineTo(0, -90); x.lineTo(-10, 60); }
    else { x.moveTo(-10, 60); x.lineTo(0, -90); x.lineTo(70, 0); x.lineTo(150, -60); x.lineTo(130, 60); }
    x.closePath(); x.fill(); x.restore(); });
  x.restore();
}

const SCENES = [
  // 0-5s: escudo do FGC vira e mostra os bancos segurando
  { from: 'd1', draw(x, lt, t) {
    x.save(); cam(x, 1 + lt * .01);
    const p = at('d1', 'privado'), f = eio(lin(t, p - .6, p)), k = Math.cos(f * Math.PI);
    x.save(); x.translate(W / 2, 700); x.scale(Math.abs(k) * .98 + .02, 1);
    if (k > 0) shield(x, 'FGC', 'É DO GOVERNO?');
    else { x.scale(-1, 1); shield(x, '', ''); for (let i = 0; i < 4; i++) bank(x, -150 + (i % 2) * 300, -120 + Math.floor(i / 2) * 230, .32, 1, 'BANCO', { color: C.ink }); }
    x.restore();
    stamp(x, 'PRIVADO', W / 2, 330, lin(t, p - .05, p + .5), { size: 100, rot: -.08 });
    const b = at('d1', 'bancos'); T(x, 'QUEM BANCA: OS BANCOS', W / 2, 1200, { size: 60, w: 700, color: C.gold, a: lin(t, b - .3, b), ls: 3 });
    x.restore();
  } },
  // 6-9s: farra do boi
  { from: 'd2', draw(x, lt, t) {
    x.save(); cam(x, 1 + lt * .02);
    const g = x.createRadialGradient(W / 2, 900, 50, W / 2, 900, 800); g.addColorStop(0, 'rgba(201,162,74,.35)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, W, H);
    banker(x, W / 2, 1300, 1, { glowColor: 'rgba(201,162,74,.4)', rim: 'rgba(201,162,74,.9)' });
    for (let i = 0; i < 90; i++) { const sp = 200 + hash(i) * 250, y = ((hash(i * 3) * 2200 + lt * sp) % 2200) - 200, xx = hash(i * 7) * W + Math.sin(lt * 2 + i) * 30;
      x.save(); x.translate(xx, y); x.rotate(lt * 3 + i); x.fillStyle = i % 3 ? C.gold : C.red; x.fillRect(-8, -4, 16, 8); x.restore(); }
    const f = at('d2', 'farra'); T(x, 'FARRA DO BOI', W / 2, 450, { font: F.serif, w: 900, size: 130, a: lin(t, f - .2, f + .2) });
    T(x, 'tudo bem.', W / 2, 580, { font: F.serif, w: 400, italic: true, size: 56, color: C.dim, a: lin(t, at('d2', 'tudo') - .2, at('d2', 'tudo') + .1) });
    x.restore();
  } },
  // 9-14s: o rombo se espalha; "essa porra vai sobrar pra mim"
  { from: 'd3', draw(x, lt, t) {
    const pr = at('d3', 'porra'), sh = lin(t, pr, pr + .06) * (1 - lin(t, pr + .1, pr + .4)) * 14;
    x.save(); cam(x, 1 + lt * .01, Math.sin(t * 85) * sh, 0);
    for (let i = 0; i < 3; i++) bank(x, 220 + i * 320, 1180, .45, 1, 'BANCO');
    const r = 80 + 520 * eo(lin(t, at('d3', 'rombo') - .2, at('d3', 'conta')));
    x.fillStyle = 'rgba(215,38,43,.85)'; x.beginPath();
    for (let a = 0; a <= 64; a++) { const an = a / 64 * Math.PI * 2, rr = r * (1 + .12 * Math.sin(an * 5 + lt) + .06 * Math.sin(an * 11 - lt * 2)); const px = W / 2 + Math.cos(an) * rr, py = 600 + Math.sin(an) * rr * .7; a ? x.lineTo(px, py) : x.moveTo(px, py); }
    x.closePath(); x.fill();
    T(x, 'ROMBO', W / 2, 600, { font: F.serif, w: 900, size: 140, color: C.paper, a: lin(t, at('d3', 'rombo') - .1, at('d3', 'rombo') + .3) * (1 - lin(t, pr - .6, pr - .35)) });
    x.save(); x.globalAlpha = lin(t, pr - .5, pr - .3); x.fillStyle = 'rgba(0,0,0,.75)'; x.fillRect(0, 0, W, H); x.restore();
    T(x, 'ESSA PORRA', W / 2, 640, { font: F.serif, w: 900, size: 150, color: C.red, a: lin(t, pr - .15, pr) });
    T(x, 'VAI SOBRAR', W / 2, 800, { font: F.serif, w: 900, size: 120, a: lin(t, pr + .2, pr + .35) });
    T(x, 'PRA MIM.', W / 2, 940, { font: F.serif, w: 900, size: 120, a: lin(t, pr + .5, pr + .65) });
    x.restore();
  } },
  // 15-19s: pedrinha no sapato → crachá do Banco Central
  { from: 'd4', draw(x, lt, t) {
    x.save(); cam(x, 1 + lt * .012);
    const p = at('d4', 'pedrinha'), g = at('d4', 'galípolo');
    // sapato social de perfil
    x.save(); x.translate(W / 2, 700); x.globalAlpha = 1 - lin(t, g - .5, g - .1);
    x.fillStyle = '#0d0c0b'; x.strokeStyle = 'rgba(239,234,224,.5)'; x.lineWidth = 4; x.beginPath(); x.moveTo(-300, 60); x.quadraticCurveTo(-300, -60, -180, -80); x.lineTo(-40, -80); x.quadraticCurveTo(80, -20, 280, 0); x.quadraticCurveTo(340, 20, 320, 60); x.closePath(); x.fill(); x.stroke();
    const q = eo(lin(t, p - .5, p)); x.fillStyle = C.paper2; x.beginPath(); x.ellipse(-100, lerp(-500, -60, q), 26, 20, .3, 0, 7); x.fill();
    T(x, 'PEDRINHA NO SAPATO', 0, 260, { font: F.mono, w: 800, size: 40, color: C.paper2, ls: 4, a: lin(t, p - .2, p + .2) }); x.restore();
    // crachá
    x.save(); x.translate(W / 2, 740); x.rotate(-.03); x.globalAlpha = eback(lin(t, g - .4, g + .1));
    x.fillStyle = C.paper; x.fillRect(-330, -230, 660, 460); x.fillStyle = '#1b3a5c'; x.fillRect(-330, -230, 660, 90);
    T(x, 'BANCO CENTRAL DO BRASIL', 0, -185, { font: F.mono, w: 800, size: 30, color: C.paper, ls: 3 });
    x.fillStyle = '#2a2722'; x.fillRect(-290, -110, 200, 250); x.fillStyle = '#4a463e'; x.beginPath(); x.arc(-190, -30, 60, 0, 7); x.fill(); x.fillRect(-260, 40, 140, 90);
    T(x, 'GABRIEL', -50, -60, { font: F.serif, w: 900, size: 58, color: C.ink, align: 'left' }); T(x, 'GALÍPOLO', -50, 20, { font: F.serif, w: 900, size: 58, color: C.ink, align: 'left' });
    T(x, 'PRESIDENTE', -50, 100, { font: F.mono, w: 800, size: 28, color: '#4a4238', align: 'left', ls: 3 });
    x.restore();
    x.restore();
  } },
  // 19-23s: venda pro BRB vetada; o cerco fecha
  { from: 'd5', draw(x, lt, t) {
    x.save(); cam(x, 1 + lt * .012);
    const ce = eio(lin(t, at('d5', 'apertou') - .3, at('d5', 'cerco') + .4));
    x.strokeStyle = C.red; x.lineWidth = 6; x.setLineDash([24, 18]); x.lineDashOffset = -lt * 60; x.beginPath(); x.arc(W / 2, 780, lerp(640, 360, ce), 0, 7); x.stroke(); x.setLineDash([]);
    paper(x, W / 2, 780, 560, 640, .02, { seed: 61 });
    x.save(); x.translate(W / 2, 780); x.rotate(.02);
    T(x, 'CONTRATO DE COMPRA', 0, -250, { font: F.mono, w: 800, size: 30, color: C.ink, ls: 3 });
    T(x, 'BRB', 0, -130, { font: F.serif, w: 900, size: 110, color: C.ink }); T(x, 'compra o', 0, -40, { font: F.serif, w: 400, italic: true, size: 44, color: C.ink }); T(x, 'MASTER', 0, 50, { font: F.serif, w: 900, size: 110, color: C.ink });
    for (let i = 0; i < 3; i++) { x.fillStyle = 'rgba(21,20,18,.5)'; x.fillRect(-220, 150 + i * 40, 440 * (.6 + hash(i + 4) * .4), 16); }
    x.restore();
    stamp(x, 'VETADO', W / 2, 820, lin(t, at('d5', 'barrou') - .05, at('d5', 'barrou') + .5), { size: 130, rot: -.18 });
    T(x, 'BANCO CENTRAL', W / 2, 1250, { font: F.mono, w: 800, size: 36, color: C.dim, ls: 6, a: lin(lt, .2, .5) });
    x.restore();
  } },
  // 23-27s: "dizem que" — vender o banco por R$ 1
  { from: 'd6', draw(x, lt, t) {
    x.save(); cam(x, 1 + lt * .012);
    T(x, 'DIZEM QUE...', W / 2, 300, { font: F.mono, w: 800, size: 44, color: C.red, ls: 8, a: lin(lt, 0, .3) });
    paper(x, W / 2, 800, 720, 760, -.02, { seed: 71 });
    x.save(); x.translate(W / 2, 800); x.rotate(-.02);
    T(x, 'PROPOSTA', 0, -300, { font: F.mono, w: 800, size: 34, color: C.ink, ls: 6 });
    T(x, 'VENDA DO', 0, -190, { font: F.serif, w: 900, size: 80, color: C.ink }); T(x, 'BANCO MASTER', 0, -100, { font: F.serif, w: 900, size: 80, color: C.ink });
    T(x, 'VALOR:', 0, 20, { font: F.mono, w: 800, size: 34, color: '#4a4238' });
    const r = at('d6', 'real'); T(x, 'R$ 1,00', 0, 130, { font: F.serif, w: 900, size: 150, color: C.red, a: lin(t, r - .2, r + .1) });
    typeT(x, 'e sai andando.', -200, 270, lin(t, at('d6', 'sair') - .2, at('d6', 'andando') + .4), { color: C.ink, size: 40 });
    x.restore(); x.restore();
  } },
  // 27-32s: telefone ligando pra Brasília; "deu merda"
  { from: 'd7', draw(x, lt, t) {
    const m = at('d7', 'merda'), sh = lin(t, m, m + .06) * (1 - lin(t, m + .1, m + .4)) * 14;
    x.save(); cam(x, 1 + lt * .01, Math.sin(t * 85) * sh, 0);
    const ring = Math.sin(t * 40) * 6 * (Math.sin(t * 3) > 0 ? 1 : 0) * (1 - lin(t, m - .4, m - .2));
    x.save(); x.translate(W / 2 + ring, 760); x.rotate(ring * .004);
    x.fillStyle = '#111'; x.strokeStyle = C.dim; x.lineWidth = 6; x.beginPath(); x.roundRect(-200, -380, 400, 760, 50); x.fill(); x.stroke();
    x.fillStyle = '#1c1a16'; x.fillRect(-170, -320, 340, 600);
    T(x, 'LIGANDO...', 0, -200, { font: F.mono, w: 800, size: 34, color: C.paper2 });
    T(x, 'BRASÍLIA', 0, -100, { font: F.serif, w: 900, size: 70, color: C.paper });
    T(x, '.'.repeat(1 + Math.floor(t * 3) % 3), 0, -30, { font: F.serif, w: 900, size: 70, color: C.paper });
    x.fillStyle = '#2f9e4a'; x.beginPath(); x.arc(0, 180, 55, 0, 7); x.fill();
    x.restore();
    T(x, 'COSTAS QUENTES?', W / 2, 270, { font: F.mono, w: 800, size: 44, color: C.gold, ls: 6, a: lin(t, at('d7', 'costas') - .2, at('d7', 'costas') + .2) });
    x.save(); x.globalAlpha = lin(t, m - .3, m - .1); x.fillStyle = 'rgba(0,0,0,.8)'; x.fillRect(0, 0, W, H); x.restore();
    T(x, 'DEU', W / 2, 640, { font: F.serif, w: 900, size: 160, a: lin(t, m - .3, m - .1) });
    T(x, 'MERDA.', W / 2, 820, { font: F.serif, w: 900, size: 200, color: C.red, a: lin(t, m - .1, m) });
    x.restore();
  } },
  // 33-39s: aeroporto à noite, sirene, 17/11/2025, PRESO
  { from: 'd8', draw(x, lt, t) {
    x.save(); cam(x, 1 + lt * .015, 0, 0, W / 2, 1000);
    // pista em perspectiva
    for (let i = 0; i < 16; i++) { const z = ((i / 16 + lt * .15) % 1), y = lerp(860, 1500, z * z), s = lerp(.2, 1.6, z * z);
      x.fillStyle = `rgba(239,220,170,${.2 + .7 * z})`; x.fillRect(W / 2 - 330 * s - 8 * s, y, 16 * s, 8 * s); x.fillRect(W / 2 + 330 * s - 8 * s, y, 16 * s, 8 * s); }
    // avião (silhueta)
    x.save(); x.translate(W / 2, 760); x.fillStyle = '#1e1c19'; x.beginPath(); x.ellipse(0, 0, 60, 300, Math.PI / 2, 0, 7); x.fill();
    x.beginPath(); x.moveTo(-40, 0); x.lineTo(-330, 70); x.lineTo(-330, 100); x.lineTo(0, 50); x.lineTo(330, 100); x.lineTo(330, 70); x.lineTo(40, 0); x.fill();
    x.beginPath(); x.moveTo(-20, -40); x.lineTo(0, -200); x.lineTo(20, -40); x.fill(); x.restore();
    // sirene
    const ph = Math.sin(t * 9); const g = x.createRadialGradient(ph > 0 ? 0 : W, 1600, 50, ph > 0 ? 0 : W, 1600, 1100);
    g.addColorStop(0, ph > 0 ? 'rgba(215,38,43,.55)' : 'rgba(40,90,220,.5)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, W, H);
    typeT(x, '17/11/2025', 290, 330, lin(lt, .2, 1.4), { size: 70, w: 800 });
    T(x, 'AEROPORTO · INDO PRO EXTERIOR', W / 2, 430, { font: F.mono, w: 800, size: 30, color: C.paper2, ls: 3, a: lin(t, at('d8', 'aeroporto') - .2, at('d8', 'aeroporto') + .2) });
    stamp(x, 'PRESO', W / 2, 1180, lin(t, at('d8', 'prendeu') - .05, at('d8', 'prendeu') + .5), { size: 140, rot: -.1 });
    x.restore();
  } },
  // 39-46s: Master liquidado; FGC cobre 41 bilhões
  { from: 'd9', draw(x, lt, t) {
    x.save(); cam(x, 1 + lt * .008);
    const f = at('d9', 'fechou'), off = t > f ? (hash(Math.floor(t * 14)) > .5 && t < f + .6 ? .6 : (t > f + .6 ? .05 : 1)) : 1;
    x.save(); x.translate(W / 2, 420); x.fillStyle = '#0d0c0a'; x.fillRect(-440, -120, 880, 240); x.strokeStyle = `rgba(201,162,74,${off})`; x.lineWidth = 6; x.strokeRect(-420, -100, 840, 200);
    T(x, 'BANCO MASTER', 0, 6, { font: F.serif, w: 900, size: 104, color: `rgba(201,162,74,${Math.max(.12, off)})` }); x.restore();
    stamp(x, 'LIQUIDADO', W / 2, 460, lin(t, f + .5, f + 1.0), { size: 110, rot: -.12 });
    const b = at('d9', '41');
    shieldMini: { x.save(); x.translate(W / 2, 830); x.scale(.55, .55); x.globalAlpha = lin(t, at('d9', 'fgc') - .3, at('d9', 'fgc')); shield(x, 'FGC', ''); x.restore(); }
    counter(x, 41e9 * eo(lin(t, b - .6, b + .8)), W / 2, 1140, { fmt: v => 'R$ ' + (v / 1e9).toFixed(0) + ' BILHÕES', size: 100, color: C.red, a: lin(t, b - .6, b - .4) });
    T(x, 'O MAIOR RESGATE DA HISTÓRIA DO FUNDO', W / 2, 1250, { font: F.mono, w: 800, size: 28, color: C.dim, ls: 2, a: lin(t, b + .6, b + 1) });
    x.restore();
  } },
  // 46-51s: a coroa de "gênio" cai e quebra; 2026 preso de novo
  { from: 'd10', draw(x, lt, t) {
    x.save(); cam(x, 1 + lt * .012);
    banker(x, W / 2, 1300, 1.1);
    const g = St('d10'), q = at('d10', 'que'), fall = eio(lin(t, q - .1, q + .7)), br = lin(t, q + .6, q + 1.2);
    crown(x, W / 2, lerp(780, 1180, fall), 1, fall * .5, eo(br) * 1.5);
    T(x, 'GÊNIO?', W / 2, 430, { font: F.serif, w: 900, size: 170, a: lin(lt, -.1, .2) * (1 - lin(t, q, q + .3) * .7) });
    const c = at('d10', 'golpezinho'); stamp(x, 'GOLPEZINHO CHOCHO', W / 2, 600, lin(t, c - .05, c + .5), { size: 76, rot: -.07 });
    T(x, 'EM 2026, PRESO DE NOVO · CASO SEGUE NA JUSTIÇA', W / 2, 250, { font: F.mono, w: 800, size: 24, color: C.dim, ls: 1, a: lin(lt, 1.5, 2) });
    x.restore();
  } },
  // 51-55s: manchete final
  { from: 'd11', draw(x, lt, t) {
    x.save(); cam(x, 1 + lt * .02);
    paper(x, W / 2, 760, 900, 700, -.02, { seed: 81 });
    x.save(); x.translate(W / 2, 760); x.rotate(-.02);
    T(x, 'O QUE FICA', 0, -260, { font: F.mono, w: 800, size: 32, color: C.ink, ls: 8 }); x.fillStyle = C.ink; x.fillRect(-400, -225, 800, 4);
    T(x, typed('QUANTO CUSTA', lin(lt, .3, 1.0)), 0, -110, { font: F.serif, w: 900, size: 110, color: C.ink });
    T(x, typed('BRASÍLIA?', lin(lt, .9, 1.5)), 0, 20, { font: F.serif, w: 900, size: 130, color: C.ink });
    x.restore();
    const b = at('d11', 'barato'); stamp(x, 'BARATO DEMAIS', W / 2 + 40, 1010, lin(t, b - .05, b + .5), { size: 80, rot: -.1 });
    x.restore();
  } },
];
