// Tratamento de água: low-poly 3D explainer. Everything is a pure function of time t (seconds),
// so render.js can step frame by frame. Narration timing comes from narracao.json (window.NARR).
import * as THREE from 'three';

const NARR = await (await fetch('./narracao.json')).json();
const L = Object.fromEntries(NARR.lines.map(l => [l.id, l]));
const S = id => L[id].start;
const E = id => L[id].end;
const Wd = (id, w, n = 0) => { const ws = L[id].words.filter(x => x.w.toLowerCase().startsWith(w)); return (ws[n] || ws[0]).start; };
const DUR = NARR.duration;

// ---------- math helpers ----------
const cl = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const P = (t, a, b) => cl((t - a) / (b - a));
const eo = x => 1 - Math.pow(1 - x, 3);
const ei = x => x * x * x;
const eio = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const back = x => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
const lerp = (a, b, x) => a + (b - a) * x;
const pop = (t, a, d = .4) => t < a ? 0 : back(P(t, a, a + d));
const win = (t, a, b, f = .3) => t < a || t > b ? 0 : Math.min(eo(P(t, a, a + f)), 1 - ei(P(t, b - f, b)));
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let x = Math.imul(seed ^ seed >>> 15, 1 | seed); x = x + Math.imul(x ^ x >>> 7, 61 | x) ^ x; return ((x ^ x >>> 14) >>> 0) / 4294967296; }; }
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------- renderer / scene ----------
const W = 1080, H = 1920;
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('c'), antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(58, W / H, .1, 2000);

const SKY_TOP = new THREE.Color('#2f86e6'), SKY_HOR = new THREE.Color('#c4e6ff');
const DUSK_TOP = new THREE.Color('#25306e'), DUSK_HOR = new THREE.Color('#ff9a62');
const skyU = { top: { value: SKY_TOP.clone() }, hor: { value: SKY_HOR.clone() } };
const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), new THREE.ShaderMaterial({
  uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false,
  vertexShader: `varying vec3 vp;void main(){vp=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader: `uniform vec3 top;uniform vec3 hor;varying vec3 vp;void main(){float h=clamp(vp.y*1.4,0.,1.);gl_FragColor=vec4(mix(hor,top,pow(h,.6)),1.);
  #include <colorspace_fragment>
  }`
}));
scene.add(sky);
scene.fog = new THREE.Fog(SKY_HOR.clone(), 110, 420);

const hemi = new THREE.HemisphereLight('#e4f3ff', '#6b8f45', 1.5); scene.add(hemi);
const sun = new THREE.DirectionalLight('#fff3dc', 2.6); sun.position.set(26, 48, 30); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -50, right: 50, top: 50, bottom: -50, near: 1, far: 160 });
sun.shadow.bias = -.0006; sun.shadow.normalBias = .03; scene.add(sun);

const matCache = {};
const M = (c, extra) => { const k = c + (extra ? JSON.stringify(extra) : ''); return matCache[k] || (matCache[k] = new THREE.MeshLambertMaterial({ color: c, flatShading: true, ...(extra || {}) })); };
function mk(geo, mat, x = 0, y = 0, z = 0, parent = scene, shadow = true) {
  const m = new THREE.Mesh(geo, typeof mat === 'string' ? M(mat) : mat);
  m.position.set(x, y, z); m.castShadow = shadow; m.receiveShadow = true; parent.add(m); return m;
}
const G = (parent = scene) => { const g = new THREE.Group(); parent.add(g); return g; };
const BOX = (w, h, d) => new THREE.BoxGeometry(w, h, d);

// ---------- world ----------
const GRASS = '#7cc456', DIRT = '#8d5b36';
const groundMats = [M(DIRT), M(DIRT), M(GRASS), M(DIRT), M(DIRT), M(DIRT)];
{ const m = new THREE.Mesh(BOX(800, 8, 800), groundMats); m.position.set(0, -4, 0); m.receiveShadow = true; scene.add(m); }

// muddy river along z at x = 24
const RIVER_X = 24;
mk(BOX(7, .1, 800), '#8a7340', RIVER_X, .02, 0, scene, false);
mk(BOX(1, .12, 800), '#c9b48a', RIVER_X - 4, .03, 0, scene, false); mk(BOX(1, .12, 800), '#c9b48a', RIVER_X + 4, .03, 0, scene, false);

// trees, rocks, clouds
const R = rng(7);
function tree(x, z, s) {
  const g = G(); g.position.set(x, 0, z); g.scale.setScalar(s);
  mk(new THREE.CylinderGeometry(.25, .35, 1.6, 6), '#7a4b2a', 0, .8, 0, g);
  mk(new THREE.ConeGeometry(1.5, 2.6, 7), R() < .5 ? '#3f9b45' : '#52ad4a', 0, 2.6, 0, g);
  mk(new THREE.ConeGeometry(1.1, 2, 7), '#5cbf52', 0, 3.7, 0, g);
}
for (let i = 0; i < 170; i++) {
  const a = R() * Math.PI * 2, r = 30 + R() * 150, x = Math.cos(a) * r, z = Math.sin(a) * r;
  if (x > -62 && x < -6 && z > -30 && z < 22) continue;           // city, tower, house
  if (x > 17 && x < 31) continue;                                  // river
  if (Math.abs(x) < 22 && Math.abs(z) < 22) continue;              // station
  tree(x, z, .8 + R() * .9);
}
for (let i = 0; i < 50; i++) { const a = R() * 6.28, r = 22 + R() * 120; const x = Math.cos(a) * r, z = Math.sin(a) * r; if (x > 17 && x < 31) continue; if (x > -62 && x < -6 && z > -30 && z < 22) continue; mk(new THREE.DodecahedronGeometry(.3 + R() * .5, 0), '#9aa0a6', x, .1, z); }
const clouds = [];
for (let i = 0; i < 14; i++) {
  const g = G(); const a = R() * 6.28, r = 70 + R() * 160; g.position.set(Math.cos(a) * r, 38 + R() * 30, Math.sin(a) * r - 40);
  for (let j = 0; j < 5; j++) { const m = mk(new THREE.IcosahedronGeometry(3 + R() * 3, 0), '#ffffff', (j - 2) * 3.5, R() * 2, R() * 3, g, false); m.material = M('#ffffff', { emissive: '#bcd6ee' }); }
  clouds.push({ g, x0: g.position.x });
}

// ---------- city ----------
const CITY = V(-40, 0, -10);
const winMat = new THREE.MeshLambertMaterial({ color: '#3b5878', emissive: '#ffd45e', emissiveIntensity: 0, flatShading: true });
const cityG = G(); cityG.position.copy(CITY);
const BCOL = ['#f3d9a8', '#ea9f7c', '#9ec8ea', '#f6f1e6', '#c8b4e6', '#a6d9b8', '#f1b5b5'];
const RC = rng(21);
mk(BOX(40, .06, 40), '#8e9399', 0, .03, 0, cityG, false);
for (let gx = -2; gx <= 2; gx++) for (let gz = -2; gz <= 2; gz++) {
  const w = 4 + RC() * 1.5, d = 4 + RC() * 1.5, h = 4 + RC() * 13 * (1 - (Math.abs(gx) + Math.abs(gz)) * .12);
  const x = gx * 7.5, z = gz * 7.5;
  mk(BOX(w + 1.2, .2, d + 1.2), '#c9ccd0', x, .1, z, cityG);
  mk(BOX(w, h, d), BCOL[Math.floor(RC() * BCOL.length)], x, h / 2 + .2, z, cityG);
  mk(BOX(w * .6, .5, d * .6), '#7d8590', x, h + .45, z, cityG);
  for (let fy = 1.6; fy < h - .6; fy += 1.8) for (let k = -1; k <= 1; k++) {
    mk(BOX(.7, .9, .08), winMat, x + k * w / 3.2, fy + .2, z + d / 2 + .04, cityG, false);
    mk(BOX(.08, .9, .7), winMat, x + w / 2 + .04, fy + .2, z + k * d / 3.2, cityG, false);
  }
}
// big water drop over the city (s1)
const DROP_BLUE = '#4fb3f0';
const dropG = G(); dropG.position.set(CITY.x, 25, CITY.z);
mk(new THREE.IcosahedronGeometry(2.6, 1), M(DROP_BLUE, { emissive: '#1d6fa8', emissiveIntensity: .35 }), 0, 0, 0, dropG, false);
{ const c = mk(new THREE.ConeGeometry(1.95, 3.2, 10), M(DROP_BLUE, { emissive: '#1d6fa8', emissiveIntensity: .35 }), 0, 2.85, 0, dropG, false); }
mk(new THREE.SphereGeometry(.55, 8, 6), M('#ffffff', { emissive: '#ffffff', emissiveIntensity: .6 }), -1, .8, 2, dropG, false);
dropG.scale.setScalar(.001);

// ---------- microbes (used in the river and in the micro world) ----------
const MCOL = ['#b65fd6', '#e07ad0', '#8f6ee0'];
function microbe(parent, i, s = 1) {
  const g = G(parent);
  const body = mk(new THREE.CapsuleGeometry(.48, 1.1, 3, 8), MCOL[i % 3], 0, 0, 0, g); body.rotation.z = Math.PI / 2;
  const eyes = G(g);
  for (const k of [-1, 1]) { mk(new THREE.SphereGeometry(.19, 8, 6), '#ffffff', .35 + k * .22, .18, .4, eyes, false); mk(new THREE.SphereGeometry(.1, 6, 5), '#111111', .37 + k * .22, .18, .55, eyes, false); }
  for (let j = 0; j < 4; j++) { const sp = mk(new THREE.ConeGeometry(.12, .4, 5), MCOL[(i + 1) % 3], -.2 + j * .25, .55, 0, g, false); }
  g.scale.setScalar(.001); g.userData.s = s; return g;
}
// river dirt + river microbes
const RD = rng(13), riverBits = [], riverBugs = [];
for (let i = 0; i < 70; i++) { const m = mk(new THREE.DodecahedronGeometry(.18 + RD() * .25, 0), RD() < .6 ? '#5e4524' : '#7a5a2e', RIVER_X - 3 + RD() * 6, .12, 0, scene, false); riverBits.push({ m, z0: RD() * 60, x: RIVER_X - 3 + RD() * 6 }); }
for (let i = 0; i < 9; i++) { const g = microbe(scene, i, .7); riverBugs.push({ g, x: RIVER_X - 2.5 + RD() * 5, z: -4 + RD() * 11, ph: RD() * 6 }); }

// ---------- treatment station ----------
const CONC = '#c9ccd0';
mk(BOX(36, .2, 16), '#b9bdc2', 1, .1, 3, scene);
const glassMat = new THREE.MeshLambertMaterial({ color: '#d8efff', transparent: true, opacity: .22, depthWrite: false });
function tank(cx, cz, w, d, h, waterTop, waterCol, glassFront) {
  const g = G(); g.position.set(cx, .2, cz);
  const th = .35;
  mk(BOX(w + th * 2, .3, d + th * 2), CONC, 0, .15, 0, g);
  mk(BOX(w + th * 2, h, th), CONC, 0, h / 2, -d / 2 - th / 2, g);
  mk(BOX(th, h, d), CONC, -w / 2 - th / 2, h / 2, 0, g); mk(BOX(th, h, d), CONC, w / 2 + th / 2, h / 2, 0, g);
  if (glassFront) { const gl = mk(BOX(w + th * 2, h, .08), glassMat, 0, h / 2, d / 2 + .04, g, false); gl.renderOrder = 3; mk(BOX(w + th * 2, .25, th), CONC, 0, h - .12, d / 2 + th / 2, g); }
  else mk(BOX(w + th * 2, h, th), CONC, 0, h / 2, d / 2 + th / 2, g);
  const wm = new THREE.MeshLambertMaterial({ color: waterCol, flatShading: true, transparent: !!glassFront, opacity: glassFront ? .55 : 1, depthWrite: !glassFront });
  const wg = BOX(w, 1, d); wg.translate(0, .5, 0);
  const water = mk(wg, wm, 0, .3, 0, g, false); water.scale.y = waterTop - .3; water.renderOrder = 2;
  g.userData = { water, wm, waterTop };
  g.scale.setScalar(.001); return g;
}
const BROWN = new THREE.Color('#8a6a3a'), CLEARISH = new THREE.Color('#8fb6c4'), CLEAN = new THREE.Color(DROP_BLUE);
const MIX = V(10, 0, 3), DEC = V(1, 0, 3), FIL = V(-9, 0, 3);
const mixT = tank(MIX.x, MIX.z, 4, 4, 2.2, 1.9, '#8a6a3a', false);
const decT = tank(DEC.x, DEC.z, 9, 5, 2.6, 2.3, '#8a6a3a', true);
const filT = tank(FIL.x, FIL.z, 4.5, 4.5, 3.6, 3.3, '#8fb6c4', true);
// pump house
const pump = G(); pump.position.set(16.5, .2, 3);
mk(BOX(3, 2.6, 3), '#dfe3e8', 0, 1.3, 0, pump); mk(BOX(3.3, .4, 3.3), '#3d7fd6', 0, 2.8, 0, pump); mk(BOX(1, 1.6, .1), '#5b6470', 0, .8, 1.55, pump);
pump.scale.setScalar(.001);
// mixer paddle + hopper with powder (s4)
const paddle = G(mixT); paddle.position.set(0, 1.2, 0);
mk(new THREE.CylinderGeometry(.1, .1, 2.6, 6), '#5b5f66', 0, .6, 0, paddle);
for (let i = 0; i < 2; i++) { const b = mk(BOX(2.6, .6, .12), '#f08a3c', 0, 0, 0, paddle); b.rotation.y = i * Math.PI / 2; }
const hopper = G(); hopper.position.set(MIX.x, 6.2, MIX.z);
mk(new THREE.ConeGeometry(1.2, 1.6, 8), '#eef0f2', 0, 0, 0, hopper).rotation.x = Math.PI;
mk(new THREE.CylinderGeometry(1.2, 1.2, 1.2, 8), '#eef0f2', 0, 1.4, 0, hopper);
mk(new THREE.CylinderGeometry(1.25, 1.25, .35, 8), '#3d7fd6', 0, 1.6, 0, hopper);
hopper.scale.setScalar(.001);
const powder = []; const RPw = rng(3);
for (let i = 0; i < 40; i++) powder.push({ m: mk(BOX(.16, .16, .16), M('#ffffff', { emissive: '#cccccc', emissiveIntensity: .3 }), 0, -99, 0, scene, false), x: (RPw() - .5) * 1.2, z: (RPw() - .5) * 1.2, o: RPw() });
// flocs settling in the decanter (s6)
const decFlocs = []; const RFl = rng(77);
for (let i = 0; i < 34; i++) { const m = mk(new THREE.DodecahedronGeometry(.22 + RFl() * .2, 0), RFl() < .5 ? '#6e4f26' : '#83602f', 0, 0, 0, decT, false); decFlocs.push({ m, x: -4 + RFl() * 8, y: .9 + RFl() * 1.3, z: -2 + RFl() * 4.2, fy: .5 + RFl() * .15, d: RFl() * .9, ph: RFl() * 6 }); }
const sludgeG = BOX(9, 1, 5); sludgeG.translate(0, .5, 0);
const sludge = mk(sludgeG, '#5e4524', 0, .3, 0, decT, false); sludge.scale.y = .001;
// filter layers (s7)
const FL = [['PEDRA', '#8d9399', .3, 1.0, 'pedra'], ['AREIA', '#e8cf8a', 1.0, 1.75, 'areia'], ['CARVÃO', '#2b2b2b', 1.75, 2.45, 'carv']];
const filLayers = FL.map(([n, c, y0, y1]) => { const g = BOX(4.5, y1 - y0, 4.5); g.translate(0, (y1 - y0) / 2, 0); const m = mk(g, c, 0, y0, 0, filT, false); m.scale.y = .001; return m; });
const rocks = []; const RRk = rng(9);
for (let i = 0; i < 14; i++) { const m = mk(new THREE.DodecahedronGeometry(.32 + RRk() * .1, 0), '#7b8288', -1.9 + (i % 7) * .63, .62, 2.05, filT, false); m.scale.setScalar(.001); rocks.push(m); }
const filDrops = []; for (let i = 0; i < 16; i++) filDrops.push({ m: mk(new THREE.IcosahedronGeometry(.16, 0), '#7a6a3e', 0, -99, 0, filT, false), x: -1.8 + (i % 8) * .5, z: 1.9, o: i / 16 });

// ---------- pipes ----------
function pipeSeg(a, b, r, col) {
  const len = a.distanceTo(b); const geo = new THREE.CylinderGeometry(r, r, len, 8); geo.translate(0, len / 2, 0);
  const m = mk(geo, col, a.x, a.y, a.z); m.quaternion.setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize()); m.scale.y = .001; return { m, a, b, len };
}
function along(path, u) { // u in [0,1] by arc length
  const lens = path.slice(1).map((b, i) => b.distanceTo(path[i])); const tot = lens.reduce((a, b) => a + b, 0); let d = u * tot;
  for (let i = 0; i < lens.length; i++) { if (d <= lens[i]) return path[i].clone().lerp(path[i + 1], d / lens[i]); d -= lens[i]; }
  return path[path.length - 1].clone();
}
const pipes = (path, r, col) => path.slice(1).map((b, i) => pipeSeg(path[i], b, r, col));
const growPipes = (ps, u) => ps.forEach((p, i) => { p.m.scale.y = Math.max(eo(cl(u * ps.length - i)), .001); });
const flowDots = (dots, path, on, t, t0, speed) => dots.forEach((d, i) => { if (!on) { d.position.y = -99; return; } const u = ((t - t0) * speed + i / dots.length) % 1; d.position.copy(along(path, u)); });
const dotsOf = (n, col, r = .3) => Array.from({ length: n }, () => mk(new THREE.IcosahedronGeometry(r, 0), M(col, { emissive: col, emissiveIntensity: .35 }), 0, -99, 0, scene, false));

const rawPath = [V(RIVER_X - 1.5, .45, 3), V(12.6, .45, 3), V(12.6, 2.1, 3), V(11.6, 2.1, 3)];
const rawPipes = pipes(rawPath, .34, '#e9ecef'); const rawDots = dotsOf(16, '#8a6a3a');
const link1 = pipeSeg(V(8.3, 1.6, 3), V(5.4, 1.6, 3), .3, '#e9ecef'), link2 = pipeSeg(V(-3.4, 1.6, 3), V(-6.6, 1.6, 3), .3, '#e9ecef');
const RES = V(-18, 0, -13.75);
const treatPath = [V(-11.4, .55, 3), V(-14, .55, 3), V(-14, .55, -13.75), V(RES.x, .55, -13.75), V(RES.x, 11.2, -13.75)];
const treatPipes = pipes(treatPath, .34, '#3d7fd6'); const treatDots = dotsOf(22, DROP_BLUE);
const distPath = [V(RES.x, .35, RES.z), V(-28.75, .35, RES.z), V(-28.75, .35, 12), V(-21, .35, 12)];
const distPipes = pipes(distPath, .34, '#3d7fd6'); const distDots = dotsOf(26, DROP_BLUE);
const cityPath = [V(-28.75, .35, RES.z), V(-54, .35, RES.z)];
const cityPipes = pipes(cityPath, .3, '#3d7fd6'); const cityDots = dotsOf(12, DROP_BLUE);

// ---------- dosing: chlorine + fluoride drums, giant tooth (s9) ----------
const dose = G(); dose.position.set(-12.4, .2, -1.2);
const drum = (x, z, col) => { const g = G(dose); g.position.set(x, 0, z); mk(new THREE.CylinderGeometry(.75, .75, 2, 10), col, 0, 1, 0, g); mk(new THREE.CylinderGeometry(.8, .8, .18, 10), '#eef0f2', 0, 2.05, 0, g); return g; };
drum(0, 1.4, '#3ba55c'); drum(0, -1.2, '#3d7fd6');
mk(new THREE.CylinderGeometry(.08, .08, 1.6, 6), '#eef0f2', -.8, 2.1, -1.2, dose).rotation.z = Math.PI / 2;
mk(new THREE.CylinderGeometry(.08, .08, 1.6, 6), '#eef0f2', -.8, 2.1, 1.4, dose).rotation.z = Math.PI / 2;
dose.scale.setScalar(.001);
const fluDrops = dotsOf(6, '#7cc7ff', .16);
const fluPath = [V(-12.4, 2.4, -2.4), V(-14, 2.3, -2.4), V(-14, .7, -2.4)];
const tooth = G(); tooth.position.set(-10, 2.8, -4.6);
const TW = M('#ffffff', { emissive: '#dfe8f0', emissiveIntensity: .35 });
mk(BOX(1.9, 1.3, 1.5), TW, 0, .3, 0, tooth); mk(new THREE.SphereGeometry(.55, 8, 6), TW, -.5, .95, 0, tooth); mk(new THREE.SphereGeometry(.55, 8, 6), TW, .5, .95, 0, tooth);
for (const x of [-.5, .5]) mk(new THREE.ConeGeometry(.42, 1.4, 6), TW, x, -1, 0, tooth).rotation.x = Math.PI;
for (const k of [-1, 1]) { mk(new THREE.SphereGeometry(.16, 8, 6), '#111111', k * .35, .45, .76, tooth, false); }
mk(BOX(.5, .08, .05), '#111111', 0, .05, .76, tooth, false);
const sparks = []; for (let i = 0; i < 5; i++) sparks.push(mk(new THREE.OctahedronGeometry(.32, 0), M('#fff27a', { emissive: '#ffe24a', emissiveIntensity: 1 }), 0, 0, 0, tooth, false));
tooth.scale.setScalar(.001);

// ---------- water tower (s10) ----------
const tower = G(); tower.position.copy(RES);
for (const [x, z] of [[-1.9, -1.9], [1.9, -1.9], [-1.9, 1.9], [1.9, 1.9]]) mk(new THREE.CylinderGeometry(.28, .32, 11.2, 6), '#9aa0a6', x, 5.6, z, tower);
for (const y of [3.5, 7.5]) { mk(BOX(4.2, .2, .2), '#9aa0a6', 0, y, 1.9, tower); mk(BOX(4.2, .2, .2), '#9aa0a6', 0, y, -1.9, tower); }
mk(new THREE.CylinderGeometry(3.2, 3.2, 4.2, 14), '#eef0f2', 0, 13.3, 0, tower);
mk(new THREE.ConeGeometry(3.5, 1.6, 14), '#3d7fd6', 0, 16.2, 0, tower);
mk(BOX(1.2, 3.6, .12), '#2b3440', 0, 13.3, 3.2, tower);
const fillG = BOX(1, 3.4, .14); fillG.translate(0, 1.7, 0);
const towerFill = mk(fillG, M(DROP_BLUE, { emissive: '#1d6fa8', emissiveIntensity: .4 }), 0, 11.6, 3.22, tower, false); towerFill.scale.y = .001;
tower.scale.set(1, .001, 1);

// ---------- house + faucet + glass (s12) ----------
const HOUSE = V(-21, 0, 12);
const house = G(); house.position.copy(HOUSE);
mk(BOX(5, 4, 5), '#f3d9a8', 0, 2, 0, house);
{ const r = mk(new THREE.ConeGeometry(4.3, 2.4, 4), '#d65a45', 0, 5.2, 0, house); r.rotation.y = Math.PI / 4; }
mk(BOX(1.2, 2.2, .1), '#8a5a35', 1.6, 1.1, 2.52, house);
mk(BOX(1, 1, .1), '#9ec8ea', -1.6, 2.9, 2.52, house);
const fau = G(house); fau.position.set(-.6, 0, 2.5);
mk(BOX(2, .35, 1.1), '#f6f7f8', 0, 1.05, .55, fau);                       // basin
mk(BOX(1.7, .1, .9), '#c6ccd2', 0, 1.24, .55, fau);
mk(new THREE.CylinderGeometry(.11, .11, .35, 8), '#b8bec6', 0, 2.3, .14, fau).rotation.x = Math.PI / 2;
mk(new THREE.CylinderGeometry(.09, .09, .5, 8), '#b8bec6', 0, 2.3, .5, fau).rotation.x = Math.PI / 2;
mk(new THREE.CylinderGeometry(.09, .09, .22, 8), '#b8bec6', 0, 2.2, .72, fau);
const handle = G(fau); handle.position.set(0, 2.52, .3);
mk(new THREE.CylinderGeometry(.05, .05, .2, 6), '#b8bec6', 0, -.08, 0, handle);
mk(BOX(.6, .07, .07), '#d65a45', 0, 0, 0, handle); mk(BOX(.07, .07, .6), '#d65a45', 0, 0, 0, handle);
const streamG = new THREE.CylinderGeometry(.06, .06, 1, 8); streamG.translate(0, -.5, 0);
const stream = mk(streamG, M('#8fd3ff', { emissive: '#4fb3f0', emissiveIntensity: .5 }), 0, 2.1, .72, fau, false); stream.scale.y = .001;
const glassG = G(fau); glassG.position.set(0, 1.29, .72);
{ const gm = new THREE.MeshLambertMaterial({ color: '#ffffff', transparent: true, opacity: .32, depthWrite: false, side: THREE.DoubleSide }); const gl = mk(new THREE.CylinderGeometry(.26, .21, .62, 12, 1, true), gm, 0, .31, 0, glassG, false); gl.renderOrder = 3; }
const gw = new THREE.CylinderGeometry(.24, .2, 1, 12); gw.translate(0, .5, 0);
const glassWater = mk(gw, M(DROP_BLUE, { emissive: '#1d6fa8', emissiveIntensity: .3 }), 0, .02, 0, glassG, false); glassWater.scale.y = .001;
const splash = []; for (let i = 0; i < 8; i++) splash.push(mk(new THREE.IcosahedronGeometry(.05, 0), '#bfe6ff', 0, -99, 0, fau, false));

// ---------- micro world (zoom into the water) ----------
const MW = V(300, 15, 0);
const micro = G(); micro.position.copy(MW);
micro.add(new THREE.Mesh(BOX(60, 40, 60), new THREE.MeshLambertMaterial({ color: '#2a6f9e', side: THREE.BackSide })));
mk(BOX(44, 34, 2), '#2f7cb0', 0, 0, -7, micro, false);
const RM = rng(11);
for (let i = 0; i < 30; i++) mk(new THREE.SphereGeometry(.15 + RM() * .25, 6, 5), M('#bfe6ff', { emissive: '#5fa8d8', emissiveIntensity: .4 }), (RM() - .5) * 26, (RM() - .5) * 24, -5.5 + RM(), micro, false);
// dirt grains -> flocs (s5)
const FLOC_C = [[-3.2, 4.2], [2.8, 3.4], [-.2, .4], [-3.6, -3.2], [3.4, -2.6], [.2, -6], [-2, 7.5], [3.6, 7.2]];
const grains = [];
for (let i = 0; i < 90; i++) { const m = mk(new THREE.DodecahedronGeometry(.22 + RM() * .22, 0), RM() < .5 ? '#6e4f26' : '#9a7440', 0, 0, 0, micro, false); const c = FLOC_C[i % FLOC_C.length]; const a = RM() * 6.28, b = RM() * 3.14, r = .3 + RM() * .75; grains.push({ m, sx: (RM() - .5) * 11, sy: (RM() - .5) * 18, cx: c[0] + Math.cos(a) * Math.sin(b) * r, cy: c[1] + Math.sin(a) * Math.sin(b) * r, cz: Math.cos(b) * r, d: RM() * .5, ph: RM() * 6 }); }
const coag = []; for (let i = 0; i < 26; i++) coag.push({ m: mk(BOX(.22, .22, .22), M('#ffffff', { emissive: '#ffffff', emissiveIntensity: .5 }), 0, 0, 0, micro, false), x: (RM() - .5) * 10, o: RM() * 1.2, c: FLOC_C[i % FLOC_C.length] });
// microbes vs chlorine (s8)
const bugs = [];
for (let i = 0; i < 9; i++) { const g = microbe(micro, i); bugs.push({ g, x: [-3.4, 3, 0, -3.8, 3.6, -.4, -2.2, 2.4, .4][i], y: [4.8, 3.8, 1, -2.4, -2.8, -6, 7.6, 7.2, -9][i], ph: RM() * 6, d: i * .07, survivor: i === 2 }); }
const chlor = []; for (let i = 0; i < 46; i++) chlor.push({ m: mk(new THREE.IcosahedronGeometry(.2, 0), M('#7dff6a', { emissive: '#3bd13a', emissiveIntensity: .6 }), 0, -99, 0, micro, false), x: (RM() - .5) * 11, o: RM(), sp: .8 + RM() * .6 });

// ---------- labels ----------
const labs = [];
function label(text, pos, t0, t1, opts = {}) { const el = document.createElement('div'); el.className = 'lab' + (opts.big ? ' big' : ''); el.textContent = text; document.getElementById('labs').appendChild(el); labs.push({ el, pos, t0, t1, rot: opts.rot ?? -4 }); }
const mwp = (x, y, z) => V(MW.x + x, MW.y + y, MW.z + z);
label('ÁGUA LIMPA', V(CITY.x, 31, CITY.z), Wd('s1', 'água'), E('s1') + .2);
label('RIO', V(RIVER_X, 1.5, -2), Wd('s2', 'rio'), Wd('s2', 'marrom') + .4);
label('MICRÓBIOS', V(RIVER_X, 2.2, 3), Wd('s2', 'micr'), E('s2') + .2, { rot: 3 });
label('BOMBA', V(16.5, 4.4, 3), Wd('s3', 'bombeia'), Wd('s3', 'estação') - .1, { rot: 3 });
label('ESTAÇÃO DE TRATAMENTO', V(0, 6, 3), Wd('s3', 'estação'), E('s3') + .2);
label('SULFATO DE ALUMÍNIO', V(MIX.x, 8.6, MIX.z), Wd('s4', 'sulfato') - .1, E('s4') + .2);
label('FLOCOS', mwp(0, 10.5, 0), Wd('s5', 'flocos') - .1, E('s5') + .2, { big: true });
label('DECANTAÇÃO', V(DEC.x, 4.6, DEC.z), Wd('s6', 'decanta') - .1, E('s6') + .2);
FL.forEach(([n, , y0, y1, w], i) => label(n, V(FIL.x + 1.6, .2 + (y0 + y1) / 2, FIL.z + 2.4), Wd('s7', w) - .05, E('s7') + .2, { rot: i % 2 ? 3 : -3 }));
label('MICRÓBIOS', mwp(0, 11, 0), S('s8') + .2, Wd('s8', 'cloro') - .1);
label('CLORO', mwp(-2.5, 10.5, 0), Wd('s8', 'cloro') - .05, E('s8') + .2, { big: true });
label('FLÚOR', V(-12.4, 4.6, -2.4), Wd('s9', 'flúor') - .05, E('s9') + .2);
label("CAIXA D'ÁGUA", V(RES.x, 19, RES.z), Wd('s10', 'caixa') - .05, E('s10') + .2);
label('GRAVIDADE', V(-24, 6, -6), Wd('s11', 'gravidade') - .05, E('s11') + .2);
label('ÁGUA TRATADA', V(HOUSE.x - .6, 3.3, HOUSE.z + 3.2), Wd('s12', 'limpinha') - .1, E('s12') + .2, { big: true });
label('RIO', V(RIVER_X, 2, 3), Wd('s13', 'passou'), DUR, { rot: 3 });
label('TORNEIRA', V(HOUSE.x, 6.8, HOUSE.z), Wd('s13', 'passou') + .25, DUR);

// ---------- camera ----------
const cut = (t0, t1, p0, p1, l0, l1, ease = eio) => ({ t0, t1, p0: V(...p0), p1: V(...p1), l0: V(...l0), l1: V(...l1), ease });
const mw = (x, y, z) => [MW.x + x, MW.y + y, MW.z + z];
const C = CITY;
const shots = [
  cut(0, S('s2'), [C.x + 6, 30, C.z + 52], [C.x + 3, 24, C.z + 40], [C.x, 12, C.z], [C.x, 13, C.z]),
  cut(S('s2'), S('s3'), [RIVER_X - 7, 4.5, 16], [RIVER_X - 6, 3.5, 11], [RIVER_X, 0, -2], [RIVER_X + .5, 0, -5]),
  cut(S('s3'), S('s4'), [34, 15, 16], [29, 13.5, 13], [4, 0, 3], [2, 0, 3]),
  cut(S('s4'), S('s5'), [15, 8, 13], [14, 7, 11], [MIX.x, 2, MIX.z], [MIX.x, 2.4, MIX.z]),
  cut(S('s5'), S('s6'), mw(0, 1, 22), mw(0, 1, 18), mw(0, 1, 0), mw(0, 1, 0)),
  cut(S('s6'), S('s7'), [6, 9, 20.5], [3, 8, 17.5], [DEC.x, .8, DEC.z], [DEC.x, .8, DEC.z]),
  cut(S('s7'), S('s8'), [-7, 3.6, 14.5], [-8.5, 2.8, 12.5], [FIL.x, 1.8, FIL.z], [FIL.x, 1.7, FIL.z]),
  cut(S('s8'), S('s9'), mw(0, 1, 21), mw(1, 1.5, 18), mw(0, 1, 0), mw(.5, 1, 0)),
  cut(S('s9'), S('s10'), [-1.5, 6, -15], [-3, 5.5, -13.5], [-12, 2.2, -2.4], [-12, 2.4, -2.4]),
  cut(S('s10'), S('s11'), [-10, 1.5, 1], [-11, 2, -1], [RES.x, 7, RES.z], [RES.x, 11, RES.z]),
  cut(S('s11'), S('s12'), [-8, 34, 26], [-12, 36, 30], [-24, 0, -3], [-26, 0, -2]),
  cut(S('s12'), S('s13'), [HOUSE.x + .9, 2.5, HOUSE.z + 6.7], [HOUSE.x + .2, 2.2, HOUSE.z + 5.6], [HOUSE.x - .6, 1.75, HOUSE.z + 3.1], [HOUSE.x - .6, 1.7, HOUSE.z + 3.2]),
  cut(S('s13'), DUR + .1, [HOUSE.x + .2, 2.2, HOUSE.z + 5.6], [4, 34, 46], [HOUSE.x - .6, 1.7, HOUSE.z + 3.2], [-5, 0, -2]),
];
function camAt(t) {
  let s = shots[0]; for (const x of shots) if (t >= x.t0) s = x;
  const u = s.ease(P(t, s.t0, s.t1));
  camera.position.copy(s.p0).lerp(s.p1, u);
  const look = s.l0.clone().lerp(s.l1, u);
  camera.position.x += Math.sin(t * .9) * .12; camera.position.y += Math.sin(t * 1.3 + 1) * .08;
  camera.lookAt(look);
}
const MICRO_ON = t => (t >= S('s5') && t < S('s6')) || (t >= S('s8') && t < S('s9'));

// ---------- per-frame state ----------
const capEl = document.getElementById('capw'), flashEl = document.getElementById('flash');
const allWords = NARR.lines.flatMap(l => l.words.map((w, i) => ({ ...w, end2: i < l.words.length - 1 ? l.words[i + 1].start : l.end + .12 })));
const tmpc = new THREE.Color();
function setState(t) {
  for (const c of clouds) c.g.position.x = c.x0 + t * .8;
  winMat.emissiveIntensity = 0;

  // s1 drop over the city
  const ds = pop(t, Wd('s1', 'água') - .2, .5) * (1 - eo(P(t, S('s2') - .2, S('s2'))));
  dropG.scale.setScalar(Math.max(ds, .001)); dropG.position.y = 25 + Math.sin(t * 2.2) * .5; dropG.rotation.y = t * .6;

  // s2 river dirt + bugs
  for (const b of riverBits) b.m.position.set(b.x, .12 + Math.sin(t * 2 + b.z0) * .03, ((b.z0 + t * 1.4) % 60) - 30);
  riverBugs.forEach((b, i) => { const s = pop(t, Wd('s2', 'micr') - .25 + i * .06, .4) * (1 - eo(P(t, S('s3'), S('s3') + .3))); b.g.scale.setScalar(Math.max(s * .7, .001)); b.g.position.set(b.x + Math.sin(t * 1.5 + b.ph) * .3, .5 + Math.sin(t * 3 + b.ph) * .15, b.z + Math.cos(t * 1.2 + b.ph) * .3); b.g.rotation.set(0, Math.sin(t + b.ph) * .8, Math.sin(t * 5 + b.ph) * .25); });

  // s3 station builds
  pump.scale.setScalar(Math.max(pop(t, Wd('s3', 'bombeia') - .2, .45), .001));
  growPipes(rawPipes, P(t, Wd('s3', 'bombeia'), Wd('s3', 'até') + .3));
  [mixT, decT, filT].forEach((k, i) => k.scale.setScalar(Math.max(pop(t, Wd('s3', 'até') + i * .2, .45), .001)));
  link1.m.scale.y = Math.max(eo(P(t, Wd('s3', 'estação'), Wd('s3', 'estação') + .4)), .001);
  link2.m.scale.y = Math.max(eo(P(t, Wd('s3', 'estação') + .2, Wd('s3', 'estação') + .6)), .001);
  flowDots(rawDots, rawPath, t > Wd('s3', 'essa'), t, Wd('s3', 'essa'), .32);
  const fillU = eo(P(t, Wd('s3', 'estação'), Wd('s3', 'tratamento') + .8));
  for (const k of [mixT, decT, filT]) k.userData.water.scale.y = Math.max((k.userData.waterTop - .3) * (.15 + .85 * fillU), .001);

  // s4 hopper + powder + paddle
  hopper.scale.setScalar(Math.max(pop(t, S('s4') - .1, .4) * (1 - eo(P(t, E('s4') + .1, E('s4') + .4))), .001));
  const pOn = t > Wd('s4', 'pó') - .2 && t < S('s5');
  powder.forEach(p => { if (!pOn) { p.m.position.y = -99; return; } const u = ((t - Wd('s4', 'pó')) * 1.4 + p.o) % 1; p.m.position.set(MIX.x + p.x * (1 + u), 5.4 - u * 3.4, MIX.z + p.z * (1 + u)); p.m.rotation.set(t * 3 + p.o * 9, t * 2, 0); });
  paddle.rotation.y = t * 2.4;
  mixT.userData.wm.color.copy(BROWN).lerp(tmpc.set('#b39a6c'), eo(P(t, Wd('s4', 'pó'), E('s4'))) * .7);

  // s5 micro: grains clump into flocs
  const clump = P(t, Wd('s5', 'grudar') - .3, Wd('s5', 'bolinhas') + .3);
  grains.forEach(g => { const u = eio(cl((clump - g.d * .5) / .7)); g.m.position.set(lerp(g.sx, g.cx, u) + Math.sin(t * 1.7 + g.ph) * .25 * (1 - u), lerp(g.sy, g.cy, u) + Math.sin(t * 1.3 + g.ph) * .25 * (1 - u) - P(t, Wd('s5', 'flocos'), E('s5') + .5) * 1.5, lerp(0, g.cz, u)); g.m.rotation.set(t + g.ph, t * .7, 0); g.m.visible = t >= S('s5') && t < S('s6'); });
  coag.forEach(c => { const u = P(t, S('s5') + c.o * .4, S('s5') + c.o * .4 + 1.2); const st = eio(P(t, Wd('s5', 'grudar') - .3, Wd('s5', 'bolinhas'))); c.m.visible = t >= S('s5') && t < S('s6'); c.m.position.set(lerp(c.x, c.c[0], st), lerp(12 - u * 12, c.c[1] + .6, st), lerp(1, .9, st)); c.m.rotation.set(t * 2 + c.o, t, 0); });

  // s6 decanter flocs sink, water clears
  const sink = P(t, Wd('s6', 'afundam') - .3, Wd('s6', 'tanque') + .6);
  decFlocs.forEach(f => { const u = eio(cl((sink - f.d * .4) / .6)); f.m.position.set(f.x + Math.sin(t + f.ph) * .1 * (1 - u), lerp(f.y + Math.sin(t * 1.6 + f.ph) * .12, f.fy, u), f.z); f.m.rotation.set(f.ph + t * .4 * (1 - u), f.ph, 0); f.m.visible = t > S('s5') && t < S('s9'); });
  sludge.scale.y = Math.max(eo(P(t, Wd('s6', 'tanque'), Wd('s6', 'decanta') + .5)) * .32, .001);
  decT.userData.wm.color.copy(BROWN).lerp(CLEARISH, eo(P(t, Wd('s6', 'afundam'), E('s6'))));

  // s7 filter layers
  FL.forEach(([n, c, y0, y1, w], i) => { filLayers[i].scale.y = Math.max(eo(P(t, Wd('s7', w) - .3, Wd('s7', w) + .15)), .001); });
  rocks.forEach((r, i) => r.scale.setScalar(Math.max(pop(t, Wd('s7', 'pedra') - .25 + i * .02, .3), .001)));
  const dropOn = t > Wd('s7', 'passa') - .3 && t < S('s9');
  filDrops.forEach(d => { if (!dropOn) { d.m.position.y = -99; return; } const u = ((t * .9) + d.o) % 1; d.m.position.set(d.x, 3.6 - u * 1.2, d.z); });
  growPipes(treatPipes.slice(0, 3), P(t, E('s7') - .5, E('s7')));
  growPipes(treatPipes.slice(3), P(t, S('s10') + .2, Wd('s10', 'sobe') + .4));
  flowDots(treatDots, treatPath, t > E('s7') - .2, t, E('s7') - .2, .22);
  for (const d of treatDots) if (d.position.y > -50) { const u = d.position.y; if (t < S('s10') + .4 && (d.position.z < -12.5 || u > 1)) d.position.y = -99; }

  // s9 dosing + tooth
  dose.scale.setScalar(Math.max(pop(t, E('s7') - .4, .4), .001));
  flowDots(fluDrops, fluPath, t > Wd('s9', 'flúor') - .3 && t < E('s9') + .4, t, Wd('s9', 'flúor'), .9);
  const ts = pop(t, Wd('s9', 'dentes') - .3, .5) * (1 - eo(P(t, E('s9') + .1, S('s10'))));
  tooth.scale.setScalar(Math.max(ts * .75, .001)); tooth.rotation.y = 2.6 + Math.sin(t * 2.2) * .35; tooth.position.y = 2.8 + Math.sin(t * 3) * .15;
  sparks.forEach((s, i) => { const a = i / 5 * 6.28 + t * 1.5; s.position.set(Math.cos(a) * 1.8, .5 + Math.sin(a) * 1.5, .3); s.scale.setScalar(.6 + .4 * Math.sin(t * 9 + i)); s.rotation.y = t * 3; });

  // s10 tower
  tower.scale.y = Math.max(eo(P(t, S('s10') - .1, S('s10') + .7)), .001);
  towerFill.scale.y = Math.max(eo(P(t, Wd('s10', 'sobe') - .2, Wd('s10', 'alto') + .4)), .001);

  // s11 distribution
  growPipes(distPipes, P(t, S('s11') - .1, Wd('s11', 'canos') + .5));
  growPipes(cityPipes, P(t, Wd('s11', 'gravidade'), Wd('s11', 'canos') + .3));
  flowDots(distDots, distPath, t > Wd('s11', 'empurra') - .3, t, Wd('s11', 'empurra') - .3, .2);
  flowDots(cityDots, cityPath, t > Wd('s11', 'empurra'), t, Wd('s11', 'empurra'), .35);
  winMat.emissiveIntensity = 0;

  // s12 faucet
  const open = eo(P(t, Wd('s12', 'sai') - .5, Wd('s12', 'sai')));
  handle.rotation.y = open * 1.6;
  stream.scale.y = Math.max(open * .9 * (1 + .03 * Math.sin(t * 30)), .001);
  glassWater.scale.y = Math.max(.56 * eo(P(t, Wd('s12', 'sai'), E('s12') + 1.2)), .001);
  splash.forEach((s, i) => { if (open < .9) { s.position.y = -99; return; } const u = ((t * 2.2) + i / 8) % 1, a = i * .8; const top = 1.31 + glassWater.scale.y; s.position.set(Math.cos(a) * .25 * u, top + Math.sin(u * Math.PI) * .25, .72 + Math.sin(a) * .25 * u); });

  // flash on micro cuts
  let fl = 0; for (const c of [S('s5'), S('s6'), S('s8'), S('s9')]) fl = Math.max(fl, 1 - Math.abs(t - c) / .2);
  flashEl.style.opacity = Math.max(0, fl).toFixed(3);

  // micro world: bugs + chlorine
  const mOn2 = t >= S('s8') && t < S('s9');
  bugs.forEach(b => {
    const life = b.survivor ? 1 : 1 - eio(P(t, Wd('s8', 'mata') + b.d, Wd('s8', 'mata') + b.d + .45));
    const s = pop(t, S('s8') - .1 + b.d, .4) * life;
    b.g.scale.setScalar(mOn2 ? Math.max(s * 1.5, .001) : .001);
    b.g.position.set(b.x + Math.sin(t * 2 + b.ph) * .3, b.y + Math.sin(t * 3 + b.ph) * .25, -1 + Math.sin(t + b.ph) * .3);
    b.g.rotation.set(0, b.survivor ? Math.sin(t * 4) * .6 : 0, Math.sin(t * 5 + b.ph) * .25 + (1 - life) * 4);
  });
  const cOn = mOn2 && t > Wd('s8', 'coloca');
  chlor.forEach(c => { if (!cOn) { c.m.position.y = -99; return; } const u = ((t - Wd('s8', 'coloca')) * .55 * c.sp + c.o) % 1; c.m.position.set(c.x + Math.sin(u * 7 + c.o * 9) * .4, 12 - u * 24, 1.5); });

  // visibility: micro world only while we are inside it
  micro.visible = MICRO_ON(t);

  camAt(t);
  sky.position.copy(camera.position);
}

function uiAt(t) {
  let cur = null; for (const w of allWords) if (t >= w.start && t < w.end2) cur = w;
  if (cur) {
    const word = cur.w.charAt(0).toUpperCase() + cur.w.slice(1);
    capEl.textContent = word; capEl.style.color = cur.hl ? '#FFD21F' : '#ffffff';
    const s = .7 + .3 * back(P(t, cur.start, cur.start + .12)); capEl.style.transform = `scale(${s.toFixed(3)})`;
    capEl.style.fontSize = word.length > 9 ? '104px' : '124px';
  } else capEl.textContent = '';
  camera.updateMatrixWorld();
  for (const l of labs) {
    if (t < l.t0 || t > l.t1) { l.el.style.display = 'none'; continue; }
    const v = l.pos.clone().project(camera);
    if (v.z > 1) { l.el.style.display = 'none'; continue; }
    const s = pop(t, l.t0, .35) * (1 - ei(P(t, l.t1 - .18, l.t1)));
    const x = (v.x + 1) / 2 * W, y = (1 - v.y) / 2 * H;
    l.el.style.display = 'block';
    const lw = l.el.offsetWidth;
    const x2 = cl(x, lw / 2 + 50, W - lw / 2 - 150), y2 = cl(y, 230, 1060);
    l.el.style.transform = `translate(${x2.toFixed(1)}px,${y2.toFixed(1)}px) translate(-50%,-50%) rotate(${l.rot}deg) scale(${Math.max(s, 0).toFixed(3)})`;
  }
}

let autoHidden = [];
function hideCollapsed() {
  for (const o of autoHidden) o.visible = true; autoHidden = [];
  scene.traverse(o => { if (o.visible && o !== scene && Math.min(Math.abs(o.scale.x), Math.abs(o.scale.y), Math.abs(o.scale.z)) < .003) { o.visible = false; autoHidden.push(o); } });
}
window.renderAt = t => { setState(t); hideCollapsed(); uiAt(t); renderer.render(scene, camera); };
window.DURATION = DUR;
await document.fonts.load('900 100px Inter');
window.renderAt(0);
window.READY = true;
