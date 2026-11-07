// node render.js stills t1,t2,...          -> out/still_<t>.png
// node render.js frames <fps> <i> <n>      -> out/frames/f_000000.jpg (worker i de n, quadros i, i+n, ...)
// node render.js meta                      -> imprime DURATION e KNOCKS
// Cada quadro é renderAt(frame/fps): função pura do tempo. Nunca grava a tela.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = __dirname, OUT = path.join(ROOT, 'out'); fs.mkdirSync(path.join(OUT, 'frames'), { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => { const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); r.end(d); }); });
(async () => {
  await new Promise(r => srv.listen(0, r)); const port = srv.address().port;
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  page.on('console', m => console.log('[page]', m.text())); page.on('pageerror', e => console.log('[err]', e.message));
  await page.goto(`http://localhost:${port}/index.html`);
  await page.waitForFunction('window.READY === true', null, { timeout: 180000 });
  const mode = process.argv[2];
  if (mode === 'meta') console.log(JSON.stringify(await page.evaluate('({d: window.DURATION, k: window.KNOCKS})')));
  else if (mode === 'stills') {
    for (const t of process.argv[3].split(',').map(Number)) {
      await page.evaluate(t => window.renderAt(t), t);
      await page.screenshot({ path: path.join(OUT, `still_${t.toFixed(2)}.png`) });
    }
  } else {
    const fps = +process.argv[3], wi = +process.argv[4], wn = +process.argv[5];
    const dur = await page.evaluate('window.DURATION'), n = Math.round(dur * fps); const t0 = Date.now();
    for (let i = wi; i < n; i += wn) {
      const fn = path.join(OUT, 'frames', `f_${String(i).padStart(6, '0')}.jpg`);
      if (fs.existsSync(fn)) continue;
      await page.evaluate(t => window.renderAt(t), i / fps);
      fs.writeFileSync(fn + '.tmp', await page.screenshot({ type: 'jpeg', quality: 94 })); fs.renameSync(fn + '.tmp', fn);
      if ((i - wi) % (60 * wn) === 0) console.log(`w${wi} frame ${i}/${n}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    }
  }
  await browser.close(); srv.close();
})();
