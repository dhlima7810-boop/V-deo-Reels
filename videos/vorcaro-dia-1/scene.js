// Dia 1 — "O segredo dos bancos". Cada cena começa na fala `from`. lt = segundos desde o início dessa fala.
const { St, En, Wd } = LIB;
const at = (id, w, k) => Wd(id, w, k);               // tempo absoluto de uma palavra
const cam = (x, s, dx = 0, dy = 0, cx = W / 2, cy = 800) => { x.translate(cx + dx, cy + dy); x.scale(s, s); x.translate(-cx, -cy); };

const SCENES = [
  // 0-8s: manchete de jornal se monta; silhueta em contraluz; "BANDIDO" carimbado
  { from: 'a1', draw(x, lt, t) {
    x.save(); cam(x, 1 + lt * .012);
    banker(x, W / 2, 1180, 1.25);
    paper(x, W / 2, 470, 900, 520, -.03, { seed: 2 });
    x.save(); x.translate(W / 2, 470); x.rotate(-.03);
    T(x, 'CASO BANCO MASTER', 0, -190, { font: F.mono, w: 800, size: 30, color: C.ink, ls: 8 });
    x.fillStyle = C.ink; x.fillRect(-400, -160, 800 * eo(lin(lt, -.1, .4)), 4);
    const h1 = 'O BANQUEIRO', p1 = lin(lt, -.12, .45);
    T(x, typed(h1, p1), 0, -70, { font: F.serif, w: 900, size: 112, color: C.ink });
    T(x, typed('DE BILHÕES', lin(lt, .45, .95)), 0, 50, { font: F.serif, w: 900, size: 112, color: C.ink });
    T(x, typed('Investigações, prisão e um rombo histórico', lin(lt, .9, 1.7)), 0, 150, { font: F.serif, w: 400, size: 34, color: '#3a352c', italic: true });
    x.restore();
    stamp(x, 'BANDIDO', W / 2 + 40, 700, lin(t, at('a1', 'bandido') - .05, at('a1', 'bandido') + .6), { size: 120, rot: -.14 });
    x.restore();
  } },
  // 3-8s: "GÊNIO?" com coroa dourada sobre a silhueta
  { from: 'a2', draw(x, lt, t) {
    x.save(); cam(x, 1.05 + lt * .01, 0, 0, W / 2, 900);
    banker(x, W / 2, 1220, 1.3, { glowColor: 'rgba(201,162,74,.45)', rim: 'rgba(201,162,74,.9)' });
    const g = at('a2', 'gênio'), k = eback(lin(t, g - .2, g + .4));
    x.save(); x.translate(W / 2, 680 - (1 - k) * 200); x.globalAlpha = clamp(k);
    x.fillStyle = C.gold; x.beginPath(); x.moveTo(-130, 60); x.lineTo(-150, -60); x.lineTo(-70, 0); x.lineTo(0, -90); x.lineTo(70, 0); x.lineTo(150, -60); x.lineTo(130, 60); x.closePath(); x.fill();
    x.restore();
    T(x, 'GÊNIO?', W / 2, 400, { font: F.serif, w: 900, size: 190, color: C.paper, a: lin(t, g - .1, g + .3) });
    const c = at('a2', 'maior');
    typeT(x, '"o maior criminoso da face da Terra"', 120, 520, lin(t, c - .1, En('a2')), { size: 34, color: C.dim });
    x.restore();
  } },
  // 8-13s: dossiê abre, carimbo "O ESQUEMA"
  { from: 'a3', draw(x, lt, t) {
    x.save(); cam(x, 1 + lt * .015);
    const op = eio(lin(lt, .3, 1.3));
    folder(x, W / 2 + 60, 820, 720, 900, op, 'CASO VORCARO', { rot: .03 });
    if (op > .5) {
      x.save(); x.translate(W / 2 + 60, 760); x.rotate(.03);
      typeT(x, 'ASSUNTO: COMO FUNCIONAVA', -280, -280, lin(lt, 1.2, 2.2), { color: C.ink, size: 30, w: 800 });
      typeT(x, 'STATUS: EM INVESTIGAÇÃO', -280, -230, lin(lt, 1.8, 2.8), { color: C.ink, size: 30 });
      for (let i = 0; i < 6; i++) { x.fillStyle = C.ink; x.fillRect(-280, -150 + i * 58, (360 + hash(i) * 200) * eo(lin(lt, 2 + i * .1, 2.6 + i * .1)), 26); }
      x.restore();
    }
    stamp(x, 'O ESQUEMA', W / 2 + 40, 980, lin(t, at('a3', 'esquema') - .05, at('a3', 'esquema') + .6), { size: 110, rot: -.1 });
    x.restore();
  } },
  // 13-17s: banco guarda só uma fatia da nota e empresta o resto
  { from: 'a4', draw(x, lt, t) {
    x.save(); cam(x, 1 + lt * .01);
    bank(x, W / 2, 720, 1.2, lin(lt, 0, 1.4), 'BANCO');
    const sp = lin(t, at('a4', 'emprestar'), at('a4', 'emprestar') + 1.0);
    for (let i = 0; i < 10; i++) {
      const keep = i === 0, e = eio(lin(sp, i * .05, .6 + i * .04));
      const bx = 240 + i * 66, by = 1110;
      const tx = keep ? W / 2 - 30 : W + 200 + i * 40, ty = keep ? 900 : 1000 - i * 30;
      x.save(); x.globalAlpha = lin(lt, .6, 1);
      x.fillStyle = keep ? C.gold : '#b9a36a'; x.fillRect(lerp(bx, tx, e), lerp(by, ty, e), 60, 120); x.restore();
    }
    T(x, 'GUARDA 1 PARTE', W / 2, 1290, { font: F.mono, w: 800, size: 34, color: C.gold, a: lin(sp, .6, .9), ls: 4 });
    T(x, 'EMPRESTA O RESTO →', W / 2, 1350, { font: F.mono, w: 800, size: 34, color: C.paper, a: lin(sp, .7, 1), ls: 4 });
    stamp(x, 'NÃO TEM', W / 2, 250, lin(t, at('a4', 'não') - .05, at('a4', 'não') + .6), { size: 100, rot: .08 });
    x.restore();
  } },
  // 17-21s: R$ 1.000 vira R$ 10.000
  { from: 'a5', draw(x, lt, t) {
    x.save(); cam(x, 1 + lt * .01);
    const m = at('a5', 'mil'), d = at('a5', 'dez');
    T(x, 'NO CAIXA', 300, 360, { font: F.mono, w: 800, size: 32, color: C.dim, ls: 6 });
    counter(x, 1000 * eo(lin(t, m - .4, m + .3)), 300, 470, { size: 96 });
    T(x, 'EMPRESTA', 780, 360, { font: F.mono, w: 800, size: 32, color: C.dim, ls: 6, a: lin(t, d - .6, d - .2) });
    counter(x, 10000 * eo(lin(t, d - .2, d + .6)), 780, 470, { size: 96, color: C.red, a: lin(t, d - .6, d - .2) });
    // um bloco no caixa, dez blocos emprestados
    x.fillStyle = C.gold; x.fillRect(250, 1000 - 70 * eback(lin(t, m - .2, m + .3)), 100, 70 * eback(lin(t, m - .2, m + .3)));
    for (let i = 0; i < 10; i++) { const k = eback(lin(t, d - .1 + i * .07, d + .3 + i * .07)); x.fillStyle = i % 2 ? '#b9a36a' : '#a89058'; x.fillRect(560 + (i % 2) * 120, 1000 - (Math.floor(i / 2) + 1) * 74 * k, 100, 70 * k); }
    T(x, '×10', W / 2, 760, { font: F.serif, w: 900, size: 150, color: C.paper, a: lin(t, d, d + .4) });
    x.strokeStyle = C.dim; x.lineWidth = 3; x.beginPath(); x.moveTo(120, 1010); x.lineTo(960, 1010); x.stroke();
    x.restore();
  } },
  // 21-24s: entra mais do que sai
  { from: 'a6', draw(x, lt, t) {
    x.save(); cam(x, 1 + lt * .01);
    bank(x, W / 2, 760, .9, 1, '');
    const e = at('a6', 'entrar'), s = at('a6', 'sai'), pul = .5 + .5 * Math.sin(t * 7);
    const arrow = (y, dir, wd, col, p) => { x.save(); x.globalAlpha = p; x.fillStyle = col; x.translate(W / 2, y); x.scale(dir, 1);
      x.beginPath(); x.moveTo(-500, -wd / 2); x.lineTo(-180, -wd / 2); x.lineTo(-180, -wd); x.lineTo(-60, 0); x.lineTo(-180, wd); x.lineTo(-180, wd / 2); x.lineTo(-500, wd / 2); x.closePath(); x.fill(); x.restore(); };
    arrow(1110, 1, 90 + pul * 8, C.paper, lin(t, e - .3, e + .1));
    arrow(1290, -1, 30, C.red, lin(t, s - .3, s + .1));
    T(x, 'ENTRA', 170, 1030, { size: 46, w: 700, align: 'left', a: lin(t, e - .3, e + .1) });
    T(x, 'SAI', 910, 1225, { size: 46, w: 700, color: C.red, align: 'right', a: lin(t, s - .3, s + .1) });
    x.restore();
  } },
  // 24-28s: cofre com o "índice de Basileia"
  { from: 'a7', draw(x, lt, t) {
    x.save(); cam(x, 1 + lt * .012);
    const cx = W / 2, cy = 760, r = 300;
    x.fillStyle = '#1b1915'; x.beginPath(); x.arc(cx, cy, r + 40, 0, 7); x.fill();
    x.strokeStyle = C.dim; x.lineWidth = 10; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.stroke();
    const rot = eio(lin(lt, .2, 1.8)) * 4;
    x.save(); x.translate(cx, cy); x.rotate(rot);
    for (let i = 0; i < 6; i++) { x.rotate(Math.PI / 3); x.fillStyle = C.paper2; x.fillRect(-8, -r + 40, 16, 110); }
    x.fillStyle = C.paper2; x.beginPath(); x.arc(0, 0, 60, 0, 7); x.fill(); x.restore();
    // medidor de reserva
    const b = at('a7', 'basileia'), f = eo(lin(t, at('a7', 'reserva') - .2, b + .5));
    x.strokeStyle = C.red; x.lineWidth = 26; x.lineCap = 'butt'; x.beginPath(); x.arc(cx, cy, r + 80, Math.PI * .8, Math.PI * (.8 + 1.4 * .35 * f)); x.stroke();
    x.strokeStyle = 'rgba(239,234,224,.2)'; x.beginPath(); x.arc(cx, cy, r + 80, Math.PI * (.8 + 1.4 * .35 * f), Math.PI * 2.2); x.stroke();
    x.save(); x.translate(W / 2, 290); x.rotate(-.02); x.globalAlpha = eback(lin(t, b - .25, b + .2));
    x.fillStyle = C.paper; x.fillRect(-330, -55, 660, 110); T(x, 'ÍNDICE DE BASILEIA', 0, 4, { size: 58, w: 700, color: C.ink, ls: 3 }); x.restore();
    T(x, 'RESERVA OBRIGATÓRIA POR LEI', W / 2, 1250, { font: F.mono, w: 800, size: 32, color: C.dim, ls: 4, a: lin(t, at('a7', 'reserva') - .2, at('a7', 'reserva') + .2) });
    x.restore();
  } },
  // 28-32s: ficha "título público"
  { from: 'a8', draw(x, lt, t) {
    x.save(); cam(x, 1 + lt * .012);
    paper(x, W / 2, 760, 760, 900, .025, { seed: 7 });
    x.save(); x.translate(W / 2, 760); x.rotate(.025);
    T(x, 'TESOURO NACIONAL', 0, -360, { font: F.mono, w: 800, size: 34, color: C.ink, ls: 6 });
    T(x, 'TÍTULO', 0, -200, { font: F.serif, w: 900, size: 150, color: C.ink, a: lin(t, at('a8', 'título') - .2, at('a8', 'título') + .1) });
    T(x, 'PÚBLICO', 0, -50, { font: F.serif, w: 900, size: 150, color: C.ink, a: lin(t, at('a8', 'público') - .2, at('a8', 'público') + .1) });
    for (let i = 0; i < 5; i++) { x.fillStyle = 'rgba(21,20,18,.6)'; x.fillRect(-300, 80 + i * 50, (420 + hash(i + 9) * 180) * eo(lin(lt, .6 + i * .12, 1.2 + i * .12)), 18); }
    x.restore();
    stamp(x, 'VIRA DINHEIRO RÁPIDO', W / 2, 1140, lin(t, at('a8', 'vira') - .05, at('a8', 'vira') + .6), { size: 62, rot: -.08 });
    x.restore();
  } },
  // 32-37s: patrimônio sobe, crédito sobe 10x
  { from: 'a9', draw(x, lt, t) {
    x.save(); cam(x, 1 + lt * .01);
    T(x, 'GUARDA ISSO', W / 2, 260, { font: F.mono, w: 800, size: 38, color: C.red, ls: 10, a: lin(lt, 0, .3) });
    const p = eio(lin(t, at('a9', 'patrimônio') - .3, at('a9', 'emprestar') + .6));
    const base = 1180, bw = 260;
    x.fillStyle = C.gold; x.fillRect(220, base - 80 - 120 * p, bw, 80 + 120 * p);
    x.fillStyle = C.paper; x.fillRect(600, base - 120 - 700 * p, bw, 120 + 700 * p);
    T(x, 'PATRIMÔNIO', 350, base + 60, { size: 44, w: 600 });
    T(x, 'PODE EMPRESTAR', 730, base + 60, { size: 44, w: 600 });
    x.strokeStyle = C.dim; x.lineWidth = 3; x.beginPath(); x.moveTo(140, base); x.lineTo(940, base); x.stroke();
    T(x, '×10', 730, base - 200 - 700 * p, { font: F.serif, w: 900, size: 100, color: C.red, a: lin(p, .5, .9) });
    x.restore();
  } },
  // 37-41s: letreiro velho "BANCO MÁXIMA", piscando e torto + silhueta chegando
  { from: 'a10', draw(x, lt, t) {
    x.save(); cam(x, 1 + lt * .012);
    const fl = (hash(Math.floor(t * 12)) > .25) ? 1 : .35;
    x.save(); x.translate(W / 2, 520); x.rotate(.06);
    x.fillStyle = '#1e1b17'; x.fillRect(-420, -110, 840, 220); x.strokeStyle = '#3a342b'; x.lineWidth = 8; x.strokeRect(-420, -110, 840, 220);
    T(x, 'BANCO MÁXIMA', 0, 6, { font: F.serif, w: 900, size: 104, color: `rgba(239,234,224,${.4 + .5 * fl})` });
    x.strokeStyle = '#000'; x.lineWidth = 5; x.beginPath(); x.moveTo(120, -110); x.lineTo(160, -20); x.lineTo(130, 40); x.lineTo(190, 110); x.stroke(); // rachadura
    x.restore();
    const q = at('a10', 'quebrando');
    T(x, 'MEIO QUEBRANDO', W / 2, 760, { font: F.mono, w: 800, size: 40, color: C.red, ls: 8, a: lin(t, q - .2, q + .2) });
    banker(x, lerp(1400, 760, eo(lin(lt, 0, 1.6))), 1350, .95);
    x.restore();
  } },
  // 41-45s: placa vira (flip 3D) e revela "BANCO MASTER" dourado
  { from: 'a11', draw(x, lt, t) {
    x.save(); cam(x, 1.02 + lt * .015);
    const m = at('a11', 'master'), f = eio(lin(t, m - .7, m)), ang = f * Math.PI, k = Math.cos(ang);
    x.save(); x.translate(W / 2, 520 + 40 * f); x.rotate(.06 * (1 - f)); x.scale(1, Math.abs(k) * .98 + .02);
    if (k > 0) { x.fillStyle = '#1e1b17'; x.fillRect(-420, -110, 840, 220); T(x, 'BANCO MÁXIMA', 0, 6, { font: F.serif, w: 900, size: 104, color: 'rgba(239,234,224,.7)' }); }
    else { x.fillStyle = '#0d0c0a'; x.fillRect(-440, -120, 880, 240); x.strokeStyle = C.gold; x.lineWidth = 6; x.strokeRect(-420, -100, 840, 200);
      const g = x.createLinearGradient(-400, 0, 400, 0), sh = lin(t, m, m + 1.2); g.addColorStop(0, C.gold); g.addColorStop(clamp(sh - .1), C.gold); g.addColorStop(clamp(sh), '#fff4cf'); g.addColorStop(clamp(sh + .1), C.gold); g.addColorStop(1, C.gold);
      T(x, 'BANCO MASTER', 0, 6, { font: F.serif, w: 900, size: 104, color: g }); }
    x.restore();
    const c = at('a11', 'chique');
    T(x, '(bem mais chique, né?)', W / 2, 800, { font: F.serif, w: 400, italic: true, size: 50, color: C.dim, a: lin(t, c - .3, c) });
    banker(x, 760, 1350, .95, { glowColor: 'rgba(201,162,74,.4)', rim: 'rgba(201,162,74,.9)' });
    x.restore();
  } },
  // 45-49s: gráfico de juros, barra do Master rompe o topo
  { from: 'a12', draw(x, lt, t) {
    const j = at('a12', 'juros'), shake = lin(t, j + .6, j + .7) * (1 - lin(t, j + .7, j + 1.1)) * 10;
    x.save(); cam(x, 1, Math.sin(t * 90) * shake, Math.cos(t * 77) * shake);
    T(x, 'QUANTO O BANCO PAGA', W / 2, 250, { font: F.mono, w: 800, size: 34, color: C.dim, ls: 6 });
    const base = 1250, names = ['BANCO A', 'BANCO B', 'BANCO C'], hs = [300, 340, 320];
    names.forEach((n, i) => { const p = eo(lin(lt, .1 + i * .12, .7 + i * .12)); x.fillStyle = '#5b574f'; x.fillRect(150 + i * 200, base - hs[i] * p, 150, hs[i] * p); T(x, n, 225 + i * 200, base + 50, { font: F.mono, w: 800, size: 26, color: C.dim }); });
    const p = eio(lin(t, j - .2, j + .7)); x.fillStyle = C.red; x.fillRect(780, base - 1200 * p, 170, 1200 * p);
    T(x, 'MASTER', 865, base + 50, { font: F.mono, w: 800, size: 30, color: C.red });
    x.strokeStyle = C.dim; x.lineWidth = 3; x.beginPath(); x.moveTo(110, base); x.lineTo(980, base); x.stroke();
    x.restore();
  } },
  // 49-52s: escurece; "AMANHÃ: A MALANDRAGEM"
  { from: 'a13', draw(x, lt, t) {
    x.save(); cam(x, 1 + lt * .02);
    banker(x, W / 2, 1300, 1.1, { glowColor: 'rgba(215,38,43,.35)' });
    T(x, 'AMANHÃ', W / 2, 520, { font: F.mono, w: 800, size: 40, color: C.dim, ls: 14, a: lin(lt, .1, .5) });
    const m = at('a13', 'malandragem');
    T(x, 'A MALANDRAGEM', W / 2, 640, { font: F.serif, w: 900, size: 98, color: C.paper, a: lin(t, m - .2, m + .2) });
    x.fillStyle = C.red; x.fillRect(W / 2 - 300, 720, 600 * eo(lin(t, m, m + .5)), 8);
    x.restore();
  } },
];
