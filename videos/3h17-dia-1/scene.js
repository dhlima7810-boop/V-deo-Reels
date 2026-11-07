// 3h17 · Dia 1 — terror em 3D realista (Three.js, PBR, neblina, luz motivada, pós com grão).
// Tudo é função pura do tempo t (segundos): sem relógio, sem Math.random (só rng com semente).
// Os tempos das falas vêm de narracao.json (gerado por tts.py).
import * as THREE from 'three';

const NARR = await (await fetch('./narracao.json')).json();
const L = Object.fromEntries(NARR.lines.map(l => [l.id, l]));
const S = id => L[id].start, E = id => L[id].end;
const TAIL = 0;                         // narracao.json já termina com 0,9 s de preto: história = 58 s
const DUR = NARR.duration + TAIL;
const KNOCKS = [E('l20') + .6, E('l20') + .95, E('l20') + 1.3];
window.KNOCKS = KNOCKS;

// ---------- helpers ----------
const cl = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const P = (t, a, b) => cl((t - a) / (b - a));
const sm = x => x * x * (3 - 2 * x);
const eio = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const lerp = (a, b, x) => a + (b - a) * x;
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let x = Math.imul(seed ^ seed >>> 15, 1 | seed); x = x + Math.imul(x ^ x >>> 7, 61 | x) ^ x; return ((x ^ x >>> 14) >>> 0) / 4294967296; }; }
const V = (x, y, z) => new THREE.Vector3(x, y, z);
// tremor "de mão": soma de senos lentos, determinística
const hand = (t, a = 1, s = 0) => V(
  a * (0.010 * Math.sin(t * 0.73 + s) + 0.006 * Math.sin(t * 1.91 + 2 * s) + 0.003 * Math.sin(t * 4.3 + s)),
  a * (0.008 * Math.sin(t * 0.61 + 1.3 + s) + 0.005 * Math.sin(t * 2.37 + s) + 0.002 * Math.sin(t * 5.1)),
  a * (0.006 * Math.sin(t * 0.47 + 0.7 + s)));

// ---------- renderer ----------
const W = 1080, H = 1920;
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('c'), antialias: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.NoToneMapping;           // ACES + exposição no pós
const rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4 });
const camera = new THREE.PerspectiveCamera(40, W / H, .02, 200);

// ---------- texturas procedurais (canvas + semente) ----------
function canvasTex(w, h, draw, srgb = true, rep = [1, 1]) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); t.anisotropy = 4; return t;
}
function noise(g, w, h, seed, n, a, size = 2, col = '0,0,0') {
  const r = rng(seed); for (let i = 0; i < n; i++) { g.fillStyle = `rgba(${col},${a * r()})`; const s = size * (0.5 + r()); g.fillRect(r() * w, r() * h, s, s); }
}
function blotches(g, w, h, seed, n, rad, a, col) {
  const r = rng(seed); for (let i = 0; i < n; i++) { const x = r() * w, y = r() * h, R = rad * (0.4 + r());
    const gr = g.createRadialGradient(x, y, 0, x, y, R); gr.addColorStop(0, `rgba(${col},${a * r()})`); gr.addColorStop(1, `rgba(${col},0)`); g.fillStyle = gr; g.fillRect(x - R, y - R, 2 * R, 2 * R); }
}
const plaster = (base, seed) => canvasTex(512, 512, (g, w, h) => { g.fillStyle = base; g.fillRect(0, 0, w, h); blotches(g, w, h, seed, 60, 90, .10, '0,0,0'); blotches(g, w, h, seed + 1, 40, 70, .06, '255,255,255'); noise(g, w, h, seed + 2, 9000, .10, 2); }, true, [2, 2]);
const woodFloor = canvasTex(1024, 1024, (g, w, h) => {
  const r = rng(11); const ph = h / 8;
  for (let i = 0; i < 8; i++) { const off = r() * w; for (let k = -1; k < 3; k++) {
    const x0 = off + k * w * 0.55, l = 40 + r() * 30; g.fillStyle = `hsl(28,${30 + r() * 12}%,${l * 0.5}%)`; g.fillRect(x0, i * ph, w * 0.55, ph);
    for (let s = 0; s < 26; s++) { g.strokeStyle = `rgba(20,10,5,${0.08 + r() * 0.12})`; g.lineWidth = 1 + r() * 2; g.beginPath(); const y = i * ph + r() * ph; g.moveTo(x0, y); g.bezierCurveTo(x0 + w * .2, y + (r() - .5) * 8, x0 + w * .35, y + (r() - .5) * 8, x0 + w * .55, y + (r() - .5) * 6); g.stroke(); }
    g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(x0, i * ph, 3, ph); } g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(0, i * ph, w, 3); }
  noise(g, w, h, 12, 20000, .12, 2);
}, true, [2, 2]);
const tiles = (base, seed, n = 8, grout = '#3a3a36') => canvasTex(512, 512, (g, w, h) => {
  g.fillStyle = grout; g.fillRect(0, 0, w, h); const r = rng(seed); const s = w / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const v = r() * 10 - 5; g.fillStyle = base; g.globalAlpha = 1; g.fillRect(i * s + 3, j * s + 3, s - 6, s - 6); g.fillStyle = `rgba(${v > 0 ? '255,255,255' : '0,0,0'},${Math.abs(v) / 60})`; g.fillRect(i * s + 3, j * s + 3, s - 6, s - 6); }
  blotches(g, w, h, seed + 3, 30, 60, .12, '0,0,0'); noise(g, w, h, seed + 4, 6000, .1, 2);
}, true, [3, 3]);
const fabric = (base, seed) => canvasTex(256, 256, (g, w, h) => { g.fillStyle = base; g.fillRect(0, 0, w, h); const r = rng(seed); for (let y = 0; y < h; y += 2) { g.fillStyle = `rgba(0,0,0,${r() * .08})`; g.fillRect(0, y, w, 1); } noise(g, w, h, seed + 1, 5000, .15, 1.5); blotches(g, w, h, seed + 2, 20, 40, .1, '0,0,0'); }, true, [3, 3]);
const blocks = canvasTex(512, 512, (g, w, h) => {
  g.fillStyle = '#4a4a46'; g.fillRect(0, 0, w, h); const r = rng(77); const bw = w / 4, bh = h / 8;
  for (let j = 0; j < 8; j++) for (let i = -1; i < 5; i++) { const x = i * bw + (j % 2) * bw / 2; const l = 34 + r() * 10; g.fillStyle = `hsl(60,4%,${l}%)`; g.fillRect(x + 3, j * bh + 3, bw - 6, bh - 6); }
  blotches(g, w, h, 78, 50, 80, .25, '20,25,15'); noise(g, w, h, 79, 15000, .18, 2);
}, true, [3, 1]);
const dirt = canvasTex(512, 512, (g, w, h) => { g.fillStyle = '#3b3a35'; g.fillRect(0, 0, w, h); blotches(g, w, h, 90, 90, 70, .3, '15,15,10'); blotches(g, w, h, 91, 40, 50, .12, '120,115,100'); noise(g, w, h, 92, 30000, .25, 2); }, true, [6, 6]);
const roughNoise = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#b0b0b0'; g.fillRect(0, 0, w, h); blotches(g, w, h, 5, 40, 40, .35, '255,255,255'); blotches(g, w, h, 6, 40, 40, .35, '0,0,0'); }, false, [3, 3]);

const MS = (o) => new THREE.MeshStandardMaterial({ roughness: .85, metalness: 0, ...o });
const mats = {
  wall: MS({ map: plaster('#6f7773', 1), roughness: .95 }),
  ceil: MS({ map: plaster('#6c706c', 2), roughness: 1 }),
  floor: MS({ map: woodFloor, roughness: .62, roughnessMap: roughNoise }),
  sheet: MS({ map: fabric('#8b9096', 3), roughness: 1 }),
  blanket: MS({ map: fabric('#3b4652', 4), roughness: 1 }),
  pillow: MS({ map: fabric('#a4a7a6', 5), roughness: 1 }),
  wood: MS({ map: woodFloor, color: '#8a7a6a', roughness: .55 }),
  darkwood: MS({ color: '#2e2620', roughness: .6 }),
  door: MS({ map: plaster('#8d8a80', 7), roughness: .7 }),
  metal: MS({ color: '#8a8d90', metalness: .9, roughness: .35 }),
  black: MS({ color: '#08090a', roughness: .4 }),
  hoodie: MS({ map: fabric('#56595c', 8), roughness: 1 }),
  jeans: MS({ map: fabric('#1d2330', 9), roughness: 1 }),
  hair: MS({ color: '#0c0b0b', roughness: .7 }),
  skin: MS({ color: '#8a6450', roughness: .6 }),
  blouse: MS({ map: fabric('#5e1a24', 10), roughness: .95 }),
  pants: MS({ map: fabric('#26262a', 11), roughness: 1 }),
  tileW: MS({ map: tiles('#9fa59f', 20, 8), roughness: .3 }),
  tileF: MS({ map: tiles('#6d6b66', 21, 4, '#2b2a28'), roughness: .5 }),
  counter: MS({ color: '#4c4f4e', roughness: .25, metalness: .05 }),
  cabinet: MS({ map: plaster('#7d8680', 22), roughness: .6 }),
  steel: MS({ color: '#a7abad', metalness: 1, roughness: .28 }),
  glass: new THREE.MeshPhysicalMaterial({ color: '#dfe8ea', roughness: .03, metalness: 0, transparent: true, opacity: .28, ior: 1.5, specularIntensity: 1, clearcoat: 1, side: THREE.DoubleSide, depthWrite: false }),
  blocks: MS({ map: blocks, roughness: .95 }),
  dirt: MS({ map: dirt, roughness: 1 }),
  gate: MS({ color: '#2a2c2c', metalness: .7, roughness: .6 }),
  rust: MS({ color: '#3a2a22', metalness: .4, roughness: .8 }),
};

// ambiente pra reflexos (PMREM de uma salinha escura com 2 janelas)
const pmrem = new THREE.PMREMGenerator(renderer);
{ const es = new THREE.Scene(); es.background = new THREE.Color('#050607');
  const b = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: '#9fb6c6' }));
  b.position.set(4, 2, -3); b.scale.set(2, 2.5, .1); es.add(b);
  const b2 = b.clone(); b2.material = new THREE.MeshBasicMaterial({ color: '#c08050' }); b2.position.set(-5, 1, 2); b2.scale.set(.6, 3, .1); es.add(b2);
  var ENV = pmrem.fromScene(es, 0.04).texture; }

function mk(geo, mat, x = 0, y = 0, z = 0, parent, cast = true) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = true; parent.add(m); return m;
}
const BOX = (w, h, d) => new THREE.BoxGeometry(w, h, d);
function roundedBox(w, h, d, r = .04, seg = 3) { // caixa com cantos suaves (colchão, travesseiro)
  const g = new THREE.BoxGeometry(w, h, d, 8, 4, 8); const p = g.attributes.position; const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const ix = Math.abs(v.x) / (w / 2), iy = Math.abs(v.y) / (h / 2), iz = Math.abs(v.z) / (d / 2);
    const k = Math.max(0, ix + iy + iz - 2.2); v.multiplyScalar(1 - k * r); p.setXYZ(i, v.x, v.y, v.z); }
  g.computeVertexNormals(); return g;
}
function bumpy(geo, seed, amp) { // deforma levemente (pano, cobertor amassado)
  const r = rng(seed); const p = geo.attributes.position; const ph = [r() * 6, r() * 6, r() * 6];
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const d = amp * (Math.sin(x * 7 + ph[0]) * Math.sin(z * 5 + ph[1]) + 0.5 * Math.sin(x * 13 + z * 11 + ph[2])); p.setY(i, y + (y > 0 ? d : 0)); }
  geo.computeVertexNormals(); return geo;
}

// ---------- tela do celular (canvas, redesenhada por quadro) ----------
const phoneC = document.createElement('canvas'); phoneC.width = 540; phoneC.height = 1140;
const phoneG = phoneC.getContext('2d'); const phoneTex = new THREE.CanvasTexture(phoneC); phoneTex.colorSpace = THREE.SRGBColorSpace; phoneTex.anisotropy = 8;
const FONT = "'Inter','DejaVu Sans',sans-serif";
function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
const WAVE = (() => { const r = rng(317); return Array.from({ length: 42 }, (_, i) => 0.25 + 0.75 * Math.abs(Math.sin(i * 0.7 + r() * 2)) * (0.5 + r() * 0.5)); })();
function drawPhone(o) { // o: {clock, notif (0..1), player (progress or -1), bright}
  const g = phoneG, w = 540, h = 1140;
  const bg = g.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, '#0b1420'); bg.addColorStop(1, '#03050a'); g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(120,150,190,.08)'; g.beginPath(); g.arc(380, 300, 260, 0, 7); g.fill();
  g.fillStyle = '#dfe6ee'; g.textAlign = 'center';
  g.font = `300 32px ${FONT}`; g.fillText('sábado, 7 de novembro', w / 2, 150);
  g.font = `200 172px ${FONT}`; g.fillText(o.clock, w / 2, 320);
  if (o.notif > 0) { const a = o.notif, y = 400 + (1 - a) * -30; g.globalAlpha = a;
    rr(g, 28, y, w - 56, 150, 30); g.fillStyle = 'rgba(40,48,58,.92)'; g.fill();
    g.fillStyle = '#3e8f5c'; rr(g, 52, y + 30, 64, 64, 16); g.fill();
    g.fillStyle = '#e9f2ea'; g.fillRect(78, y + 44, 12, 26); g.fillRect(74, y + 76, 20, 4); g.beginPath(); g.arc(84, y + 58, 13, 0, Math.PI); g.lineWidth = 3; g.strokeStyle = '#e9f2ea'; g.stroke();
    g.textAlign = 'left'; g.fillStyle = '#f2f4f6'; g.font = `600 30px ${FONT}`; g.fillText('Eu', 136, y + 56);
    g.fillStyle = '#9aa4ae'; g.font = `400 24px ${FONT}`; g.textAlign = 'right'; g.fillText(o.clock, w - 56, y + 56);
    g.textAlign = 'left'; g.fillStyle = '#c9d0d6'; g.font = `400 27px ${FONT}`; g.fillText('🎤 Áudio · 0:07', 136, y + 100);
    g.globalAlpha = 1; }
  if (o.player >= 0) { const y = 640; rr(g, 28, y, w - 56, 190, 36); g.fillStyle = 'rgba(28,36,44,.95)'; g.fill();
    g.fillStyle = '#e9eef2'; g.beginPath(); g.moveTo(70, y + 72); g.lineTo(70, y + 118); g.lineTo(108, y + 95); g.fill();
    const n = WAVE.length, x0 = 140, ww = 330; for (let i = 0; i < n; i++) { const hh = WAVE[i] * 70 * (o.level ?? 1) + 6; const on = i / n < o.player;
      g.fillStyle = on ? '#7fd0a0' : '#5d6873'; rr(g, x0 + i * ww / n, y + 95 - hh / 2, 4.5, hh, 2); g.fill(); }
    g.fillStyle = '#8f99a3'; g.font = `400 24px ${FONT}`; g.textAlign = 'left'; g.fillText(`0:0${Math.min(7, Math.floor(o.player * 7))}`, x0, y + 170);
    g.textAlign = 'right'; g.fillText('Eu · ' + o.clock, w - 60, y + 170); }
  g.textAlign = 'center'; g.fillStyle = 'rgba(220,230,240,.5)'; rr(g, w / 2 - 70, h - 40, 140, 8, 4); g.fill();
  phoneTex.needsUpdate = true;
}
function makePhone(parent) {
  const g = new THREE.Group(); parent.add(g);
  const body = mk(roundedBox(.072, .008, .152, .5), MS({ color: '#111315', roughness: .3, metalness: .6, envMap: ENV }), 0, 0, 0, g);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(.066, .1393), new THREE.MeshBasicMaterial({ map: phoneTex, toneMapped: false }));
  scr.rotation.x = -Math.PI / 2; scr.position.y = .0042; g.add(scr);
  const glow = new THREE.PointLight('#7fb0ff', 0, 2.2, 1.6); glow.position.set(0, .06, 0); g.add(glow);
  return { g, scr, glow };
}

// ---------- personagens (proporção humana, roupa fixa) ----------
const CAP = (r, l) => new THREE.CapsuleGeometry(r, l, 6, 14);
function limb(parent, mat, r, len, x, y, z, rx = 0, rz = 0) { const p = new THREE.Group(); p.position.set(x, y, z); p.rotation.set(rx, 0, rz); parent.add(p); mk(CAP(r, len), mat, 0, -len / 2 - r * .5, 0, p); return p; }
function makeCaio(pose) { // pose: 'sit' | 'lie'
  const g = new THREE.Group();
  const torso = new THREE.Group(); g.add(torso);
  mk(bumpy(CAP(.17, .36), 40, .006).scale(1, 1, .7), mats.hoodie, 0, 0, 0, torso);
  mk(new THREE.SphereGeometry(.105, 24, 18).scale(.92, 1.08, 1), mats.skin, 0, .4, 0.012, torso);           // cabeça
  mk(new THREE.SphereGeometry(.112, 24, 18, 0, Math.PI * 2, 0, Math.PI * .62).scale(.98, 1.05, 1.05), mats.hair, 0, .43, -.005, torso); // cabelo
  const hood = mk(new THREE.SphereGeometry(.15, 24, 16, 0, Math.PI * 2, Math.PI * .45, Math.PI * .55).scale(1.05, .7, .9), mats.hoodie, 0, .27, -.06, torso); hood.rotation.x = .5; // capuz caído nas costas
  mk(new THREE.TorusGeometry(.07, .008, 8, 24, Math.PI * 1.1), MS({ color: '#d9d9d6', roughness: .4 }), 0, .26, .03, torso).rotation.set(1.35, 0, -Math.PI * .05); // fone no pescoço
  const armL = limb(torso, mats.hoodie, .055, .26, -.2, .2, 0, 0, .12), armR = limb(torso, mats.hoodie, .055, .26, .2, .2, 0, 0, -.12);
  const foreR = limb(armR, mats.hoodie, .048, .22, 0, -.31, 0); mk(new THREE.SphereGeometry(.045, 12, 10), mats.skin, 0, -.31, 0, foreR);
  const foreL = limb(armL, mats.hoodie, .048, .22, 0, -.31, 0); mk(new THREE.SphereGeometry(.045, 12, 10), mats.skin, 0, -.31, 0, foreL);
  const legL = limb(g, mats.jeans, .075, .38, -.09, -.28, 0), legR = limb(g, mats.jeans, .075, .38, .09, -.28, 0);
  const shinL = limb(legL, mats.jeans, .065, .36, 0, -.46, 0), shinR = limb(legR, mats.jeans, .065, .36, 0, -.46, 0);
  if (pose === 'sit') {
    legL.rotation.x = legR.rotation.x = -Math.PI / 2; shinL.rotation.x = shinR.rotation.x = Math.PI / 2;
    torso.rotation.x = .18;                                   // curvado
    armR.rotation.set(-2.25, 0, -.35); foreR.rotation.set(-1.55, 0, 0); // celular no ouvido
    armL.rotation.set(-.5, 0, .05); foreL.rotation.set(-.9, 0, 0);
  }
  return { g, torso, armR, foreR, head: torso };
}
function makeMom() {
  const g = new THREE.Group(); const torso = new THREE.Group(); torso.position.y = 1.2; g.add(torso);
  mk(bumpy(CAP(.16, .34), 50, .005).scale(1, 1, .68), mats.blouse, 0, 0, 0, torso);
  mk(new THREE.SphereGeometry(.1, 24, 18).scale(.92, 1.1, 1), mats.skin, 0, .4, 0, torso);
  mk(new THREE.SphereGeometry(.106, 24, 18, 0, Math.PI * 2, 0, Math.PI * .7), MS({ color: '#1a1210', roughness: .6 }), 0, .42, -.006, torso);
  mk(new THREE.SphereGeometry(.06, 16, 12), MS({ color: '#1a1210', roughness: .6 }), 0, .47, -.1, torso);  // coque
  const aL = limb(torso, mats.blouse, .05, .25, -.19, .2, 0, -.6, .1), aR = limb(torso, mats.blouse, .05, .25, .19, .2, 0, -.6, -.1);
  const fL = limb(aL, mats.skin, .042, .22, 0, -.3, 0, -.9), fR = limb(aR, mats.skin, .042, .22, 0, -.3, 0, -.9);
  limb(g, mats.pants, .08, .4, -.09, .92, 0); limb(g, mats.pants, .07, .38, .09, .92, 0);
  mk(CAP(.07, .3), mats.pants, -.09, .25, 0, g); mk(CAP(.065, .3), mats.pants, .09, .25, 0, g);
  return { g, torso, aL, aR, fL, fR };
}

// =====================================================================
// SET 1: QUARTO (x 0)   — quarto 4 x 2.7 x 5, porta em z=-2.5, cama encostada em z=+2.5
// =====================================================================
const scQuarto = new THREE.Scene(); scQuarto.fog = new THREE.FogExp2('#05070a', .09);
scQuarto.environment = ENV; scQuarto.environmentIntensity = .05;
const Q = scQuarto;
mk(new THREE.PlaneGeometry(4, 5).rotateX(-Math.PI / 2), mats.floor, 0, 0, 0, Q, false);
mk(new THREE.PlaneGeometry(4, 5).rotateX(Math.PI / 2), mats.ceil, 0, 2.7, 0, Q, false);
mk(new THREE.PlaneGeometry(5, 2.7).rotateY(Math.PI / 2), mats.wall, -2, 1.35, 0, Q, false);
mk(new THREE.PlaneGeometry(5, 2.7).rotateY(-Math.PI / 2), mats.wall, 2, 1.35, 0, Q, false);
mk(new THREE.PlaneGeometry(4, 2.7).rotateY(Math.PI), mats.wall, 0, 1.35, 2.5, Q, false);
// parede da porta (com vão), porta fechada com fresta embaixo
const DX = .7, DW = .86, DH = 2.08;
mk(BOX(2 + DX - DW / 2, 2.7, .12), mats.wall, (-2 + DX - DW / 2) / 2, 1.35, -2.56, Q);
mk(BOX(2 - DX - DW / 2, 2.7, .12), mats.wall, (2 + DX + DW / 2) / 2, 1.35, -2.56, Q);
mk(BOX(DW, 2.7 - DH, .12), mats.wall, DX, DH + (2.7 - DH) / 2, -2.56, Q);
for (const s of [-1, 1]) mk(BOX(.06, DH, .16), mats.door, DX + s * (DW / 2 + .03), DH / 2, -2.53, Q);
mk(BOX(DW + .12, .06, .16), mats.door, DX, DH + .03, -2.53, Q);
const doorPivot = new THREE.Group(); doorPivot.position.set(DX - DW / 2, 0, -2.52); Q.add(doorPivot);
const door = mk(BOX(DW - .01, DH - .02, .04), mats.door, DW / 2, DH / 2 + .012, 0, doorPivot);
for (const [y0, y1] of [[.25, .95], [1.15, 1.85]]) mk(BOX(DW - .2, y1 - y0, .006), MS({ map: plaster('#858277', 31), roughness: .75 }), DW / 2, (y0 + y1) / 2, .023, doorPivot);
const knob = mk(new THREE.SphereGeometry(.03, 16, 12), mats.metal, DW - .08, 1.0, .05, doorPivot); knob.material = MS({ color: '#9a8f78', metalness: 1, roughness: .3, envMap: ENV });
// corredor atrás da porta + luz vazando pela fresta
mk(new THREE.PlaneGeometry(3, 3).rotateX(-Math.PI / 2), mats.floor, DX, 0, -4, Q, false);
const hallLight = new THREE.PointLight('#d8b48a', 0, 4, 1.2); hallLight.position.set(DX + .6, .5, -3.6); Q.add(hallLight);
// faixa de luz da fresta (canvas: sombra dos pés passando)
const gapC = document.createElement('canvas'); gapC.width = 256; gapC.height = 8; const gapG = gapC.getContext('2d');
const gapTex = new THREE.CanvasTexture(gapC); gapTex.colorSpace = THREE.SRGBColorSpace;
const gapStrip = new THREE.Mesh(new THREE.PlaneGeometry(DW - .02, .012), new THREE.MeshBasicMaterial({ map: gapTex, toneMapped: false })); gapStrip.position.set(DX, .006, -2.5); Q.add(gapStrip);
const gapGlowC = document.createElement('canvas'); gapGlowC.width = 256; gapGlowC.height = 128; const gapGlowG = gapGlowC.getContext('2d');
const gapGlowTex = new THREE.CanvasTexture(gapGlowC); gapGlowTex.colorSpace = THREE.SRGBColorSpace;
const gapGlow = new THREE.Mesh(new THREE.PlaneGeometry(DW + .5, .55).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: gapGlowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); gapGlow.position.set(DX, .003, -2.5 + .27); Q.add(gapGlow);
function drawGap(level, feet) { // feet: posição x (0..1) do par de pés ou null
  const prof = x => { if (feet == null) return 1; let s = 1; for (const o of [-.07, .07]) { const d = Math.abs(x - (feet + o)); s *= cl((d - .035) / .03); } return .08 + .92 * s; };
  for (let i = 0; i < 256; i++) { const x = i / 255, v = .75 * level * prof(x) * (0.85 + 0.15 * Math.sin(x * 9));
    gapG.fillStyle = `rgb(${255 * v | 0},${205 * v | 0},${150 * v | 0})`; gapG.fillRect(i, 0, 1, 8);
    for (let j = 0; j < 128; j++) { const a = v * 0.13 * Math.pow(1 - j / 128, 2.6); gapGlowG.fillStyle = `rgba(255,200,140,${a})`; gapGlowG.fillRect(i, j, 1, 1); } }
  gapTex.needsUpdate = gapGlowTex.needsUpdate = true;
}
// cama
const bed = new THREE.Group(); bed.position.set(.85, 0, 1.45); Q.add(bed);
mk(BOX(1.5, .3, 2.1), mats.darkwood, 0, .17, 0, bed);
mk(BOX(1.56, .9, .08), mats.darkwood, 0, .47, 1.06, bed);
mk(roundedBox(1.44, .2, 2.02, .35), mats.sheet, 0, .42, 0, bed);
const blanket = mk(bumpy(new THREE.BoxGeometry(1.5, .08, 1.35, 30, 2, 30), 3, .018), mats.blanket, 0, .54, -.32, bed);
mk(roundedBox(.62, .13, .38, .6), mats.pillow, -.3, .59, .78, bed).rotation.y = .06;
mk(roundedBox(.62, .13, .38, .6), mats.pillow, .36, .58, .76, bed).rotation.y = -.05;
// criado-mudo + celular + abajur apagado
const stand = new THREE.Group(); stand.position.set(-.3, 0, 2.2); Q.add(stand);
mk(BOX(.46, .55, .4), mats.wood, 0, .275, 0, stand); mk(BOX(.4, .005, .01), mats.black, 0, .4, -.201, stand);
mk(new THREE.CylinderGeometry(.06, .08, .03, 24), mats.darkwood, -.12, .565, .05, stand);
mk(new THREE.CylinderGeometry(.012, .012, .26, 12), mats.metal, -.12, .69, .05, stand);
mk(new THREE.CylinderGeometry(.08, .12, .16, 24, 1, true), MS({ color: '#b8b0a0', roughness: 1, side: THREE.DoubleSide }), -.12, .86, .05, stand);
mk(new THREE.CylinderGeometry(.035, .03, .1, 18), MS({ color: '#d8d4cc', roughness: .3 }), .14, .6, .1, stand); // copo d'água
const phone1 = makePhone(stand); phone1.g.position.set(.05, .556, -.06); phone1.g.rotation.y = .25;
// janela (parede x=-2) com persiana: luz de poste laranja entra em faixas
const win = new THREE.Group(); win.position.set(-1.98, 1.45, .4); Q.add(win);
mk(BOX(.06, 1.1, 1.0), MS({ color: '#1a1c1e', roughness: .6 }), -.06, 0, 0, win, false);
const winBack = mk(new THREE.PlaneGeometry(.98, 1.08).rotateY(Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff8a3a').multiplyScalar(2.2), toneMapped: false }), -.09, 0, 0, win, false);
for (let i = 0; i < 14; i++) { const s = mk(BOX(.012, .05, .98), MS({ color: '#8f8b82', roughness: .7 }), .03, -.52 + i * .078, 0, win); s.rotation.z = 1.05; }
mk(BOX(.08, .04, 1.08), mats.door, .02, -.57, 0, win);
const street = new THREE.SpotLight('#ff9a4a', 0, 12, .38, .5, 1.2); street.position.set(-4.2, 3.1, .1); street.target.position.set(.6, .3, .9);
street.castShadow = true; street.shadow.mapSize.set(1024, 1024); street.shadow.bias = -.0004; street.shadow.camera.near = .5; street.shadow.camera.far = 10; Q.add(street, street.target);
const moon = new THREE.HemisphereLight('#2a3a50', '#0a0806', 0); Q.add(moon);
// pôster e prateleira pra dar vida às paredes
mk(BOX(.01, .62, .44), MS({ map: plaster('#3c4a52', 33), roughness: .8 }), 1.99, 1.6, 1.9, Q).rotation.y = 0;
mk(BOX(.5, .03, .22), mats.wood, 1.88, 1.25, -1.0, Q); mk(BOX(.16, .22, .14), MS({ color: '#2d3a2f', roughness: .9 }), 1.86, 1.38, -1.05, Q);
mk(BOX(.04, .18, .13), MS({ color: '#6b2f2a', roughness: .9 }), 1.9, 1.36, -.86, Q);
// Caio
const caioSit = makeCaio('sit'); caioSit.g.position.set(.32, .98, .5); caioSit.g.rotation.y = -Math.PI / 2; Q.add(caioSit.g);
const phoneHand = makePhone(caioSit.foreR); phoneHand.g.position.set(.03, -.34, .02); phoneHand.g.rotation.set(0, 0, Math.PI / 2);
// Caio deitado: volume embaixo do cobertor + cabeça no travesseiro
const caioLie = new THREE.Group(); Q.add(caioLie);
mk(bumpy(new THREE.CapsuleGeometry(.22, 1.1, 6, 16).rotateX(Math.PI / 2).scale(1.2, .55, 1), 60, .02), mats.blanket, .7, .62, .95, caioLie).rotation.y = .05;
mk(new THREE.SphereGeometry(.105, 24, 18), mats.skin, .62, .74, 2.02, caioLie);
mk(new THREE.SphereGeometry(.115, 24, 18, 0, Math.PI * 2, 0, Math.PI * .7), mats.hair, .62, .75, 2.04, caioLie).rotation.x = 1.3;
const phoneLie = makePhone(caioLie); phoneLie.g.position.set(.6, .9, 1.78); phoneLie.g.rotation.set(1.25, 0, 0);

// =====================================================================
// SET 2: COZINHA (manhã cinza, luz fria da janela)
// =====================================================================
const scCoz = new THREE.Scene(); scCoz.fog = new THREE.FogExp2('#202629', .06); scCoz.environment = ENV; scCoz.environmentIntensity = .5;
const K = scCoz;
mk(new THREE.PlaneGeometry(5, 5).rotateX(-Math.PI / 2), mats.tileF, 0, 0, 0, K, false);
mk(new THREE.PlaneGeometry(5, 2.7), mats.tileW, 0, 1.35, -.62, K, false);
mk(new THREE.PlaneGeometry(5, 2.7).rotateY(Math.PI / 2), mats.wall, -2.5, 1.35, 1.5, K, false);
mk(new THREE.PlaneGeometry(5, 2.7).rotateX(Math.PI / 2), mats.ceil, 0, 2.7, 1.5, K, false);
// bancada com cuba (cuba = 4 placas + fundo)
const CT = .92; // altura da bancada
mk(BOX(1.05, .04, .62), mats.counter, -1.0, CT, -.3, K); mk(BOX(1.05, .04, .62), mats.counter, 1.0, CT, -.3, K);
mk(BOX(.95, .04, .1), mats.counter, 0, CT, -.56, K); mk(BOX(.95, .04, .08), mats.counter, 0, CT, -.03, K);
mk(BOX(.8, .01, .42), mats.steel, 0, CT - .2, -.3, K);
for (const [x, z, w, d] of [[-.4, -.3, .01, .44], [.4, -.3, .01, .44], [0, -.51, .8, .01], [0, -.09, .8, .01]]) mk(BOX(w, .2, d), mats.steel, x, CT - .1, z, K);
mk(BOX(3.1, CT - .06, .58), mats.cabinet, 0, (CT - .06) / 2, -.31, K);
for (let i = -3; i <= 3; i++) mk(BOX(.004, CT - .2, .01), MS({ color: '#2b2e2c' }), i * .45, (CT - .06) / 2, -.015, K, false);
mk(new THREE.CylinderGeometry(.012, .012, .3, 12), mats.steel, 0, CT + .15, -.52, K);
mk(new THREE.CylinderGeometry(.011, .011, .2, 12).rotateX(Math.PI / 2), mats.steel, 0, CT + .3, -.43, K);
// janela sobre a pia
const kw = mk(new THREE.PlaneGeometry(1.1, .9), new THREE.MeshBasicMaterial({ color: '#c9d6dc' }), 0, 1.75, -.615, K, false);
for (const x of [-.55, 0, .55]) mk(BOX(.04, .94, .05), mats.cabinet, x, 1.75, -.6, K);
for (const y of [1.3, 2.2]) mk(BOX(1.14, .05, .06), mats.cabinet, 0, y, -.6, K);
const daylight = new THREE.DirectionalLight('#bcd0dc', 0); daylight.position.set(.4, 2.6, -3.5); daylight.target.position.set(0, .4, 1.2);
daylight.castShadow = true; daylight.shadow.mapSize.set(1024, 1024); Object.assign(daylight.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: .5, far: 10 }); daylight.shadow.bias = -.0005; K.add(daylight, daylight.target);
const kAmb = new THREE.HemisphereLight('#9fb0ba', '#2a2622', 0); K.add(kAmb);
const kFill = new THREE.PointLight('#b9ccd8', 0, 4, 1.5); kFill.position.set(.3, 1.9, -.3); K.add(kFill);
// louça na bancada
mk(new THREE.CylinderGeometry(.11, .09, .03, 28), MS({ color: '#d4d6d2', roughness: .2, envMap: ENV }), -.75, CT + .035, -.35, K);
mk(new THREE.CylinderGeometry(.11, .09, .03, 28), MS({ color: '#d4d6d2', roughness: .2, envMap: ENV }), -.76, CT + .065, -.36, K);
mk(new THREE.CylinderGeometry(.04, .035, .1, 20), MS({ color: '#e3e0d8', roughness: .3 }), .75, CT + .07, -.4, K);
// mãe (de costas, na pia)
const mom = makeMom(); mom.g.position.set(-.05, 0, .42); K.add(mom.g);
// o copo (lathe) — perto da borda, à direita da cuba
const glassPts = [V(0, 0, 0), V(.032, 0, 0), V(.034, .004, 0), V(.04, .11, 0), V(.038, .11, 0), V(.031, .006, 0), V(0, .008, 0)].map(v => new THREE.Vector2(v.x, v.y));
const glassGeo = new THREE.LatheGeometry(glassPts, 40);
const glass = new THREE.Group(); K.add(glass); mk(glassGeo, mats.glass, 0, 0, 0, glass, false);
const GLASS0 = V(.5, CT + .02, -.06);
// cacos no chão (set "C2", mesmo cenário)
const shards = new THREE.Group(); K.add(shards);
{ const r = rng(909); for (let i = 0; i < 70; i++) { const s = .006 + r() * .03 * (i < 10 ? 2 : 1); const g = new THREE.BufferGeometry();
    const a = [V(0, 0, 0), V(s * (0.6 + r()), 0, s * (r() - .5)), V(s * (r() - .5), 0, s * (0.6 + r()))]; g.setFromPoints(a); g.computeVertexNormals();
    const m = new THREE.Mesh(g, mats.glass); const ang = r() * 6.28, d = Math.pow(r(), 1.6) * .55;
    m.position.set(.45 + Math.cos(ang) * d, .002 + r() * .004, .55 + Math.sin(ang) * d * .8); m.rotation.set((r() - .5) * .5, r() * 6, (r() - .5) * .5); shards.add(m); }
  const base = mk(new THREE.CylinderGeometry(.034, .032, .01, 30, 1, true, 0, 4), mats.glass, .47, .02, .52, shards, false); base.rotation.z = 1.3; }

// =====================================================================
// SET 3: QUINTAL (noite, neblina, poste laranja, muro e portão com fresta)
// =====================================================================
const scQuintal = new THREE.Scene(); scQuintal.fog = new THREE.FogExp2('#0b0e10', .15); scQuintal.background = new THREE.Color('#06080a');
const Y = scQuintal;
mk(new THREE.PlaneGeometry(30, 30).rotateX(-Math.PI / 2), mats.dirt, 0, 0, 0, Y, false);
mk(BOX(9, 2.3, .2), mats.blocks, -2.2, 1.15, -4, Y); mk(BOX(9, 2.3, .2), mats.blocks, 9.2, 1.15, -4, Y);
mk(BOX(9.2, .08, .3), MS({ color: '#3a3a36', roughness: 1 }), -2.2, 2.34, -4, Y);
// portão de ferro (x 2.3..4.7) entreaberto
const gate = new THREE.Group(); gate.position.set(2.35, 0, -4); Y.add(gate);
for (let i = 0; i < 22; i++) mk(BOX(.035, 2.1, .035), mats.gate, .05 + i * .1, 1.08, 0, gate);
for (const y of [.15, 1.0, 2.05]) mk(BOX(2.2, .05, .05), mats.rust, 1.1, y, 0, gate);
mk(BOX(.12, 2.4, .12), mats.blocks, 2.3, 1.2, -4, Y); mk(BOX(.12, 2.4, .12), mats.blocks, 4.62, 1.2, -4, Y);
gate.rotation.y = .06;
mk(BOX(2.6, 2.6, .02), MS({ color: '#2a3036', roughness: 1 }), 3.5, 1.2, -6.5, Y, false); // rua escura atrás do portão
const back = new THREE.PointLight('#6f8fb0', 6, 6, 1.4); back.position.set(3.6, 1.6, -6.0); Y.add(back);
// vulto do cachorro atrás do portão
const dog = new THREE.Group(); dog.position.set(3.2, 0, -4.45); Y.add(dog);
mk(new THREE.CapsuleGeometry(.16, .45, 6, 12).rotateZ(Math.PI / 2), mats.black, 0, .5, 0, dog);
mk(new THREE.SphereGeometry(.13, 16, 12), mats.black, .38, .66, 0, dog); mk(new THREE.ConeGeometry(.05, .1, 8), mats.black, .36, .8, .04, dog);
// poste + luz laranja + cone de luz falso
mk(new THREE.CylinderGeometry(.06, .08, 5.2, 12), mats.rust, -3.2, 2.6, -2.6, Y);
mk(BOX(.8, .06, .1), mats.rust, -2.85, 5.1, -2.6, Y); mk(BOX(.3, .1, .2), MS({ color: '#ffcf9a', emissive: '#ffb060', emissiveIntensity: 4 }), -2.5, 5.05, -2.6, Y);
const lamp = new THREE.SpotLight('#ff9a48', 0, 14, .62, .55, 1.3); lamp.position.set(-2.5, 5.0, -2.6); lamp.target.position.set(1.8, 0, -3.4);
lamp.castShadow = true; lamp.shadow.mapSize.set(1024, 1024); lamp.shadow.bias = -.0005; Y.add(lamp, lamp.target);
const coneMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: { k: { value: 0 } },
  vertexShader: 'varying float vy; varying vec3 vn; varying vec3 vv; void main(){ vy = uv.y; vec4 mv = modelViewMatrix*vec4(position,1.); vn = normalize(normalMatrix*normal); vv = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }',
  fragmentShader: 'uniform float k; varying float vy; varying vec3 vn; varying vec3 vv; void main(){ float e = pow(abs(dot(vn,vv)), 1.5); gl_FragColor = vec4(vec3(1.,.55,.25)*k*e*pow(vy,1.6)*.55, 1.); }' });
const cone = new THREE.Mesh(new THREE.ConeGeometry(2.2, 5, 32, 1, true), coneMat); cone.position.set(-2.1, 2.5, -2.3); cone.rotation.z = -.22; Y.add(cone);
const yAmb = new THREE.HemisphereLight('#1d2a36', '#050404', 0); Y.add(yAmb);
// varal e balde pra dar escala
mk(new THREE.CylinderGeometry(.004, .004, 5).rotateZ(Math.PI / 2), mats.black, .5, 1.9, -1.6, Y);
mk(BOX(.5, .7, .01), MS({ map: fabric('#6a6e70', 70), roughness: 1, side: THREE.DoubleSide }), .1, 1.55, -1.6, Y).rotation.y = .1;
mk(new THREE.CylinderGeometry(.16, .13, .3, 20), MS({ color: '#2f4a5e', roughness: .7 }), 1.3, .15, -2.6, Y);

// ---------- pós (ACES, grão, vinheta, aberração, dessaturação fria) ----------
const post = new THREE.ShaderMaterial({ uniforms: { tex: { value: rt.texture }, exposure: { value: 1 }, frame: { value: 0 }, fade: { value: 1 }, ca: { value: .0016 }, flick: { value: 1 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy,0.,1.); }',
  fragmentShader: `uniform sampler2D tex; uniform float exposure, frame, fade, ca, flick; varying vec2 vUv;
  vec3 aces(vec3 x){ x *= .6; return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.); }
  float h(vec2 p){ p = fract(p*vec2(443.897,441.423)); p += dot(p, p.yx+19.19); return fract((p.x+p.y)*p.x); }
  vec3 lin2s(vec3 c){ return mix(c*12.92, 1.055*pow(c,vec3(1./2.4))-.055, step(.0031308,c)); }
  void main(){ vec2 d = vUv-.5; float r2 = dot(d*vec2(.5625,1.),d*vec2(.5625,1.))*4.;
    vec3 c; c.r = texture2D(tex, vUv - d*ca*r2*4.).r; c.g = texture2D(tex, vUv).g; c.b = texture2D(tex, vUv + d*ca*r2*4.).b;
    c = aces(c*exposure*flick); float l = dot(c, vec3(.2126,.7152,.0722));
    c = mix(vec3(l), c, .62);                                   // dessatura
    c = c*vec3(.92,1.,1.03) + vec3(.0,.012,.018)*(1.-l);        // sombras azul-esverdeadas
    c *= mix(1., .18, smoothstep(.15, 1.25, r2));               // vinheta forte
    c = lin2s(c);
    float g = h(vUv*vec2(1080.,1920.)*.5 + frame*7.13) - .5; c += g*.085*(1.-l*.5);
    gl_FragColor = vec4(c*fade, 1.); }` });
const postScene = new THREE.Scene(); postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), post)); const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

// ---------- planos (shots) ----------
const T = {
  A2: S('l3') - .15, B: S('l4') - .5, C: S('l7') - .4, Cg: S('l8') + .05, C2: S('l9') - .3,
  D: S('l10') - .6, E: S('l14') - .5, E2: S('l15') - .3, F: S('l18') - .4, X: S('l22') - .45,
};
const IMPACT = T.C2;
const SHOTS = [
  ['A1', 0], ['A2', T.A2], ['B', T.B], ['C', T.C], ['Cg', T.Cg], ['C2', T.C2], ['D', T.D], ['E', T.E], ['E2', T.E2], ['F', T.F], ['X', T.X]];
const shotAt = t => { let s = SHOTS[0]; for (const x of SHOTS) if (t >= x[1]) s = x; const i = SHOTS.indexOf(s); return { id: s[0], t0: s[1], t1: (SHOTS[i + 1] || [0, DUR])[1] }; };

function lookFrom(p, target, t, amp = 1, seed = 0) { camera.up.set(0, 1, 0); camera.position.copy(p).add(hand(t, amp, seed)); camera.lookAt(target.clone().add(hand(t * .8, amp * .6, seed + 3))); }
// câmera olhando a tela do celular com o texto em pé: d = distância na normal, b = recuo pro lado de baixo da tela
function lookPhone(ph, d, b, t, amp = .3, seed = 0, aim = 0) {
  ph.g.updateWorldMatrix(true, false); const m = ph.g.matrixWorld;
  const c = V(0, .004, 0).applyMatrix4(m), n = V(0, 1, 0).transformDirection(m), top = V(0, 0, -1).transformDirection(m);
  camera.position.copy(c).addScaledVector(n, d).addScaledVector(top, -b).add(hand(t, amp, seed));
  camera.up.copy(top); camera.lookAt(c.clone().addScaledVector(top, aim).add(hand(t * .8, amp * .5, seed + 3)));
}
const fmtClock = t => (t < S('l16') ? '3:16' : '3:17');

function setQuarto(mode, t) {
  caioSit.g.visible = mode === 'sit'; caioLie.visible = mode === 'lie';
  street.intensity = 9; moon.intensity = .25; hallLight.intensity = 0; drawGap(0.05, null);
}

const capEl = document.getElementById('cap');
let lastCap = null;
function captions(t) {
  let cur = null, a = 0;
  for (const l of NARR.lines) { const a0 = l.start - .12, a1 = l.end + .45; if (t >= a0 && t <= a1 + .3) { cur = l; a = Math.min(P(t, a0, a0 + .3), 1 - P(t, a1, a1 + .3)); } }
  if (cur !== lastCap) { capEl.textContent = cur ? cur.text.replace(/^./, c => c.toUpperCase()) : ''; capEl.className = cur && cur.voice ? 'w' : ''; lastCap = cur; }
  capEl.style.opacity = cur ? sm(cl(a)) : 0;
}

window.DURATION = DUR;
window.renderAt = (t) => {
  const f = Math.round(t * 60);
  const sh = shotAt(t); const u = P(t, sh.t0, sh.t1); let sc = scQuarto; let expo = 1, flick = 1, fade = 1;
  // fade de entrada/saída por plano (cortes secos onde pede susto)
  switch (sh.id) {
    case 'A1': case 'A2': {
      setQuarto('none', t); street.intensity = 4;
      const notif = P(t, .15, .7);
      drawPhone({ clock: '3:17', notif, player: sh.id === 'A2' ? P(t, S('l3'), E('l3b') + .4) : -1, level: .4 + .6 * Math.abs(Math.sin(t * 9)) });
      phone1.glow.intensity = .9 * (0.4 + 0.6 * notif);
      const pp = stand.localToWorld(phone1.g.position.clone());
      if (sh.id === 'A1') lookPhone(phone1, lerp(.42, .26, eio(u)), lerp(.36, .2, eio(u)), t, .5, 0, .02);
      else lookPhone(phone1, lerp(.21, .19, u), .01, t, .2, 2, -.022);
      expo = 1.4; fade = sm(P(t, 0, .25)); break; }
    case 'B': {
      setQuarto('sit', t);
      drawPhone({ clock: '3:17', notif: 0, player: P(t, S('l6') - .2, E('l6')), level: 1 });
      phoneHand.glow.intensity = .12; phone1.glow.intensity = 0;
      lookFrom(V(lerp(1.95, 1.8, u), lerp(1.3, 1.26, u), lerp(.45, .42, u)), V(-1.9, 1.3, .4), t, 1.2, 5);
      expo = 1.25; fade = sm(P(t, sh.t0, sh.t0 + .5)); break; }
    case 'C': case 'Cg': case 'C2': {
      sc = scCoz; daylight.intensity = 2.2; kAmb.intensity = .7; kFill.intensity = 2.5;
      // mãe lavando: braços mexendo devagar
      const wsh = Math.sin(t * 3.1) * .12; mom.aR.rotation.x = -.6 + wsh; mom.aL.rotation.x = -.6 - wsh * .7; mom.torso.rotation.z = Math.sin(t * 1.3) * .02;
      // copo: parado, depois escorrega e cai em câmera lenta
      const slip = S('l8') + .55, fall0 = slip + .45; glass.visible = sh.id !== 'C2'; shards.visible = sh.id === 'C2';
      const ps = GLASS0.clone();
      if (t > slip) ps.x += .06 * sm(P(t, slip, fall0));
      if (t > fall0) { const k = P(t, fall0, IMPACT); ps.x += .05 * k; ps.z += .12 * k; ps.y = lerp(GLASS0.y, .02, k * k); glass.rotation.set(-1.2 * k * k, 0, -1.7 * k); }
      else { glass.rotation.set(0, 0, -.25 * sm(P(t, slip + .25, fall0))); }
      glass.position.copy(ps);
      if (sh.id === 'C') lookFrom(V(lerp(.75, .62, u), 1.55, lerp(2.5, 2.25, u)), V(0, 1.2, -.2), t, 1, 8);
      else if (sh.id === 'Cg') { const k = P(t, fall0, IMPACT); lookFrom(V(lerp(1.0, .95, u), lerp(1.12, .6, sm(k)), lerp(.55, .6, u)), ps.clone().add(V(-.05, .05, -.05)), t, .5, 9); camera.fov = 36; }
      else lookFrom(V(.65, .55, 1.25), V(.45, 0, .55), t, .4, 10);
      expo = 1.05; fade = sh.id === 'C' ? sm(P(t, sh.t0, sh.t0 + .4)) : 1; break; }
    case 'D': {
      sc = scQuintal; lamp.intensity = 420; yAmb.intensity = .25; coneMat.uniforms.k.value = 1;
      const barkStop = S('l12') - .05; dog.visible = t < barkStop;
      dog.position.x = 3.2 + .05 * Math.sin(t * 1.7); dog.children[1].position.y = .66 + (t < barkStop ? .03 * Math.max(0, Math.sin(t * 9)) : 0);
      lookFrom(V(lerp(1.0, 1.4, u), 1.45, lerp(2.8, 2.2, u)), V(3.2, .95, -4), t, 1, 12);
      expo = 1.5; fade = sm(P(t, sh.t0, sh.t0 + .5)); break; }
    case 'E': case 'E2': {
      setQuarto('lie', t); phone1.glow.intensity = 0;
      const notif = P(t, S('l17') - .25, S('l17') + .15);
      drawPhone({ clock: fmtClock(t), notif, player: -1 });
      phoneLie.glow.intensity = .55 + (notif > 0 ? .4 : 0);
      // vibração quando chega
      const vib = t > S('l17') - .25 && t < S('l17') + .6 ? Math.sin(t * 160) * .0016 : 0;
      phoneLie.g.position.x = .6 + vib;
      const pp = caioLie.localToWorld(phoneLie.g.position.clone());
      if (sh.id === 'E') lookFrom(V(.6, lerp(1.2, 1.12, u), lerp(2.38, 2.3, u)), V(.6, .82, 1.6), t, .8, 14);
      else { lookPhone(phoneLie, .27, .03, t, .3, 15, .01); camera.position.add(V(vib * 3, 0, 0)); }
      expo = 1.25; fade = sh.id === 'E' ? sm(P(t, sh.t0, sh.t0 + .5)) : 1; break; }
    case 'F': {
      setQuarto('lie', t); caioLie.visible = false; phone1.glow.intensity = 0;
      drawPhone({ clock: '3:17', notif: 1, player: P(t, S('l18'), E('l20')), level: 1 });
      phoneLie.glow.intensity = .35;
      // luz do corredor acende devagar; pés chegam e param na frente da porta
      const lvl = .25 + .65 * sm(P(t, S('l19'), S('l19') + 2));
      const fp = t < S('l19') + 1 ? null : lerp(-.25, .5, sm(P(t, S('l19') + 1, E('l20') + .4)));
      hallLight.intensity = 1.4 * lvl; drawGap(lvl, fp);
      // batidas: porta treme, tela pisca
      let kick = 0; for (const k of KNOCKS) kick += Math.exp(-Math.max(0, t - k) * 22) * (t >= k ? 1 : 0);
      doorPivot.rotation.y = .004 * kick; door.position.z = -.004 * kick;
      flick = 1 - .25 * kick;
      const dolly = sm(P(t, sh.t0, KNOCKS[0]));
      lookFrom(V(lerp(1.0, .9, dolly), lerp(1.05, .95, dolly), lerp(.6, -.35, dolly)), V(DX, .62, -2.5), t, 1.1 + kick * 2, 17); camera.fov = 50;
      moon.intensity = 9; street.intensity = 14; expo = 1.7 * (window.DBG || 1); fade = sm(P(t, sh.t0, sh.t0 + .35)) * (1 - sm(P(t, sh.t1 - .45, sh.t1))); break; }
    case 'X': fade = 0; break;
  }
  if (sh.id !== 'Cg' && sh.id !== 'F') camera.fov = sh.id === 'A2' || sh.id === 'E2' ? 30 : 40;
  camera.updateProjectionMatrix();
  post.uniforms.exposure.value = expo; post.uniforms.frame.value = f % 997; post.uniforms.fade.value = fade; post.uniforms.flick.value = flick;
  renderer.setRenderTarget(rt); renderer.render(sc, camera); renderer.setRenderTarget(null); renderer.render(postScene, postCam);
  captions(t);
};
drawGap(0, null);
window.renderAt(0);
window.READY = true;
