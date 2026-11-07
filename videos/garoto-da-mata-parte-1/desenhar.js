// node desenhar.js [n,...]  -> imagens/NN.png (1350x2400) a partir de desenhos.html
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1.25 });
  p.on('pageerror', e => console.log('[err]', e.message));
  await p.goto('file://' + path.join(__dirname, 'desenhos.html')); await p.waitForFunction('window.READY === true');
  const list = process.argv[2] ? process.argv[2].split(',').map(Number) : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  for (const n of list) { await p.evaluate(n => window.desenhar(n), n); await p.screenshot({ path: path.join(__dirname, 'imagens', String(n).padStart(2, '0') + '.png') }); console.log('ok', n); }
  await b.close();
})();
