// Aterro sanitário + biogás: low-poly 3D explainer. Everything is a pure function of time t (seconds),
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
function groundBox(x0, x1, z0, z1) { const m = new THREE.Mesh(BOX(x1 - x0, 8, z1 - z0), groundMats); m.position.set((x0 + x1) / 2, -4, (z0 + z1) / 2); m.receiveShadow = true; scene.add(m); }
const PIT = 8, PIT_D = 5;
groundBox(-400, 400, -400, -PIT); groundBox(-400, 400, PIT, 400); groundBox(-400, -PIT, -PIT, PIT); groundBox(PIT, 400, -PIT, PIT);
mk(BOX(16, .4, 16), DIRT, 0, -PIT_D - .2, 0);                              // pit floor
const cover = mk(BOX(17, .3, 17), GRASS, 0, -.14, 0); cover.receiveShadow = true; cover.castShadow = false;                    // hides the pit until it is dug

// river
const RIVER_BLUE = new THREE.Color('#47a6ee'), RIVER_DIRTY = new THREE.Color('#7b7a3c');
const riverMat = new THREE.MeshLambertMaterial({ color: RIVER_BLUE.clone(), flatShading: true });
mk(BOX(7, .1, 800), riverMat, 24, .02, 0, scene, false);
mk(BOX(1, .12, 800), '#c9b48a', 20, .03, 0, scene, false); mk(BOX(1, .12, 800), '#c9b48a', 28, .03, 0, scene, false);

// trees, rocks, clouds
const R = rng(7);
function tree(x, z, s) {
  const g = G(); g.position.set(x, 0, z); g.scale.setScalar(s);
  mk(new THREE.CylinderGeometry(.25, .35, 1.6, 6), '#7a4b2a', 0, .8, 0, g);
  mk(new THREE.ConeGeometry(1.5, 2.6, 7), R() < .5 ? '#3f9b45' : '#52ad4a', 0, 2.6, 0, g);
  mk(new THREE.ConeGeometry(1.1, 2, 7), '#5cbf52', 0, 3.7, 0, g);
}
for (let i = 0; i < 160; i++) {
  const a = R() * Math.PI * 2, r = 34 + R() * 150, x = Math.cos(a) * r, z = Math.sin(a) * r;
  if (x > -62 && x < -18 && z > -30 && z < 8) continue;           // city
  if (x > 17 && x < 31) continue;                                  // river
  if (x > -30 && x < -6 && z > -26 && z < -4) continue;            // plant
  if (Math.abs(x) < 20 && Math.abs(z) < 20) continue;
  tree(x, z, .8 + R() * .9);
}
for (let i = 0; i < 60; i++) { const a = R() * 6.28, r = 18 + R() * 120; const x = Math.cos(a) * r, z = Math.sin(a) * r; if (x > 17 && x < 31) continue; if (x > -62 && x < -6 && z > -30 && z < 8) continue; mk(new THREE.DodecahedronGeometry(.3 + R() * .5, 0), '#9aa0a6', x, .1, z); }
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
// trash bags piling up in the street (scene 1)
const bags = [];
for (let i = 0; i < 46; i++) {
  const gx = Math.floor(RC() * 5) - 2, side = RC() < .5 ? -1 : 1;
  const x = CITY.x + 3.75 * (RC() < .5 ? 1 : -1) + (RC() - .5) * 1.2 + (RC() < .3 ? 7.5 : 0), z = CITY.z + gx * 7.5 + side * (1.5 + RC() * 1.5) + 7;
  const m = mk(new THREE.DodecahedronGeometry(.55 + RC() * .3, 0), RC() < .7 ? '#26292e' : '#3c7a3f', x, .5, z);
  m.scale.set(1, .8, 1); m.rotation.set(RC(), RC() * 6, RC());
  bags.push({ m, t: .3 + i * .055 });
}

for (let i = 0; i < 40; i++) {
  const m = mk(new THREE.DodecahedronGeometry(.5 + RC() * .35, 0), RC() < .65 ? '#26292e' : '#3c7a3f', -36.2 + (RC() - .5) * 3.2, .45 + (i > 22 ? .7 : 0), 2 + RC() * 9, scene);
  m.scale.set(1, .8, 1); m.rotation.set(RC(), RC() * 6, RC()); bags.push({ m, t: .2 + i * .065 });
}
// ---------- trash pieces ----------
const TRASH = ['#26292e', '#26292e', '#3c7a3f', '#e7e7e7', '#d64545', '#3d7fd6', '#f2c94c', '#9aa0a6', '#8a5a35', '#f08a3c'];
function trashPiece(r, parent = scene) {
  const k = Math.floor(r() * 4), s = .5 + r() * .6;
  const geo = k === 0 ? new THREE.DodecahedronGeometry(.6 * s, 0) : k === 1 ? BOX(.9 * s, .6 * s, .7 * s) : k === 2 ? new THREE.IcosahedronGeometry(.5 * s, 0) : new THREE.CylinderGeometry(.25 * s, .25 * s, .8 * s, 7);
  const m = mk(geo, TRASH[Math.floor(r() * TRASH.length)], 0, 0, 0, parent);
  m.rotation.set(r() * 6, r() * 6, r() * 6); return m;
}

// open dump (lixão) pile
const RP = rng(99), PILE = V(1, 0, 2), pile = [];
for (let i = 0; i < 150; i++) {
  const a = RP() * 6.28, rr = 5 * Math.sqrt(RP()), h = (1 - rr / 5) * 2.6 * (.4 + RP() * .6) + .3;
  pile.push({ m: trashPiece(RP), p: V(PILE.x + Math.cos(a) * rr, h, PILE.z + Math.sin(a) * rr), t: S('s2') + .35 + RP() * 1.7, rot: RP() * 3 });
}
// chorume trail from the pile to the river
const stain = [];
for (let i = 0; i < 34; i++) {
  const u = i / 33, x = PILE.x + 3 + u * (20.5 - PILE.x - 3), z = PILE.z + Math.sin(u * 7) * 1.6 + u * 3;
  const m = mk(new THREE.CylinderGeometry(.9 + Math.sin(i) * .25, .9, .08, 7), '#5a3a1d', x, .06, z, scene, false);
  stain.push({ m, u });
}
const pileStain = mk(new THREE.CylinderGeometry(6, 6, .06, 9), '#5a3a1d', PILE.x, .04, PILE.z, scene, false);
// rain + storm clouds
const RR = rng(5), rain = [], storm = G();
const rainMat = new THREE.MeshBasicMaterial({ color: '#d7ecff', transparent: true, opacity: .8 });
for (let i = 0; i < 360; i++) { const m = new THREE.Mesh(BOX(.06, 1.4, .06), rainMat); m.userData = { x: -10 + RR() * 34, z: -8 + RR() * 22, o: RR() * 30 }; scene.add(m); rain.push(m); }
for (let i = 0; i < 9; i++) { const m = mk(new THREE.IcosahedronGeometry(3.5 + RR() * 2.5, 0), '#6d7680', -6 + i * 3.6, 20 + RR() * 2, -2 + RR() * 6, storm, false); }

// ---------- truck & compactor ----------
function makeTruck() {
  const g = G();
  mk(BOX(6.4, .5, 2.2), '#2c2f33', 0, .9, 0, g);
  mk(BOX(1.8, 2, 2.3), '#f2f2f2', 2.4, 2.1, 0, g); mk(BOX(.1, .9, 1.9), '#5c8fc4', 3.31, 2.45, 0, g);
  mk(BOX(1.8, .5, 2.32), '#f08a3c', 2.4, 1.3, 0, g);
  const bedPivot = G(g); bedPivot.position.set(-2.6, 1.2, 0);
  mk(BOX(4.4, 2.2, 2.4), '#2f8f46', 2.2, 1.1, 0, bedPivot);
  mk(BOX(4.5, .3, 2.5), '#256f37', 2.2, 2.25, 0, bedPivot);
  for (const [x, z] of [[2.2, 1.1], [2.2, -1.1], [-1.6, 1.1], [-1.6, -1.1], [-2.6, 1.1], [-2.6, -1.1]]) { const w = mk(new THREE.CylinderGeometry(.6, .6, .45, 10), '#1d1f22', x, .6, z, g); w.rotation.x = Math.PI / 2; }
  g.userData.bed = bedPivot; g.visible = false; return g;
}
const truck = makeTruck();
const dozer = G();
mk(BOX(2.6, 1.2, 1.9), '#f5b51b', 0, 1.3, 0, dozer); mk(BOX(1.2, 1.2, 1.5), '#f5b51b', -.4, 2.5, 0, dozer); mk(BOX(1.05, .8, 1.52), '#4f7fb0', -.4, 2.6, 0, dozer);
const roller = mk(new THREE.CylinderGeometry(.75, .75, 2.3, 10), '#5b5f66', 1.9, .75, 0, dozer); roller.rotation.x = Math.PI / 2;
for (const z of [.9, -.9]) mk(BOX(2.4, .8, .45), '#2c2f33', -.4, .45, z, dozer);
dozer.visible = false;

// ---------- pit liners ----------
const IN_CLAY = PIT - .3, IN_MANTA = IN_CLAY - .15;
function liner(inner, th, col, fromTop) {
  const parts = [];
  const walls = [[0, inner + th / 2, inner * 2 + th * 2, th], [0, -inner - th / 2, inner * 2 + th * 2, th], [inner + th / 2, 0, th, inner * 2], [-inner - th / 2, 0, th, inner * 2]];
  for (const [x, z, w, d] of walls) {
    const geo = BOX(w, PIT_D, d); geo.translate(0, fromTop ? -PIT_D / 2 : PIT_D / 2, 0);
    const m = mk(geo, col, x, fromTop ? .02 : -PIT_D, z); m.scale.y = .001; parts.push(m);
  }
  const fl = mk(BOX(inner * 2, th, inner * 2), col, 0, -PIT_D + th / 2 + (fromTop ? .3 : 0), 0); fl.scale.set(.001, 1, .001);
  return { walls: parts, floor: fl };
}
const clay = liner(IN_CLAY, .3, '#d4874a', false);
const manta = liner(IN_MANTA, .15, '#2a2d33', true);

// ---------- leachate pipes + treatment pond ----------
function pipeSeg(a, b, r, col) {
  const len = a.distanceTo(b); const geo = new THREE.CylinderGeometry(r, r, len, 8); geo.translate(0, len / 2, 0);
  const m = mk(geo, col, a.x, a.y, a.z); m.quaternion.setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize()); m.scale.y = .001; return { m, a, b, len };
}
const POND = V(12, 0, 11);
const leachPath = [V(-6, -4.3, 0), V(7.4, -4.3, 0), V(7.4, .35, 0), V(12, .35, 0), V(12, .35, 7.6)];
const leachPipes = leachPath.slice(1).map((b, i) => pipeSeg(leachPath[i], b, .32, '#e9ecef'));
const leachSide = [pipeSeg(V(0, -4.3, -6), V(0, -4.3, 6), .28, '#e9ecef')];
const pondRim = mk(new THREE.CylinderGeometry(4.2, 4.4, .3, 12), '#a3a8ae', POND.x, .12, POND.z);
const pondWater = mk(new THREE.CylinderGeometry(3.7, 3.7, .32, 12), '#6f8a4e', POND.x, .14, POND.z, scene, false);
const drops = []; for (let i = 0; i < 14; i++) drops.push(mk(new THREE.IcosahedronGeometry(.28, 0), '#6b4a22', 0, -99, 0, scene, false));
function along(path, u) { // u in [0,1] by arc length
  const lens = path.slice(1).map((b, i) => b.distanceTo(path[i])); const tot = lens.reduce((a, b) => a + b, 0); let d = u * tot;
  for (let i = 0; i < lens.length; i++) { if (d <= lens[i]) return path[i].clone().lerp(path[i + 1], d / lens[i]); d -= lens[i]; }
  return path[path.length - 1].clone();
}

// ---------- fill layers -> mound ----------
const fallIn = []; const RF = rng(42);
for (let i = 0; i < 40; i++) fallIn.push({ m: trashPiece(RF), p: V(-6 + RF() * 12, -4.1 + RF() * .6, -6 + RF() * 12), t: S('s6') + .7 + RF() * 1.2 });
const mound = G();
const layers = [];
const BOT = -PIT_D + .45;
for (let k = 0; k < 6; k++) {
  const half = k < 3 ? IN_MANTA : IN_MANTA - (k - 2) * 1.45, y0 = BOT + k * 1.55;
  const tg = BOX(half * 2, 1.1, half * 2); tg.translate(0, .55, 0);
  const trashL = mk(tg, '#6e6b66', 0, y0, 0, mound);
  const bits = G(trashL); const rb = rng(300 + k);
  for (let i = 0; i < 26 + k * 2; i++) { const b = mk(BOX(.5 + rb() * .5, .3, .4 + rb() * .5), TRASH[Math.floor(rb() * TRASH.length)], (rb() - .5) * half * 1.8, 1.1, (rb() - .5) * half * 1.8, bits); b.rotation.y = rb() * 3; }
  for (let i = 0; i < 16; i++) { const side = Math.floor(rb() * 4); const s = (rb() - .5) * half * 1.8; const b = mk(BOX(.45, .35, .45), TRASH[Math.floor(rb() * TRASH.length)], side === 0 ? half : side === 1 ? -half : s, .2 + rb() * .7, side === 2 ? half : side === 3 ? -half : s, bits); }
  const eg = BOX(half * 2 + .02, .45, half * 2 + .02); eg.translate(0, .225, 0);
  const earth = mk(eg, new THREE.MeshLambertMaterial({ color: '#9b6a3f', flatShading: true }), 0, y0 + 1.1, 0, mound);
  trashL.scale.y = .001; earth.scale.set(.001, 1, 1);
  layers.push({ trashL, earth, bits, half, y0, top: y0 + 1.55 });
}
const MOUND_TOP = layers[5].top;
// flames + smoke on the mound (pressure)
const flames = []; const RFl = rng(77);
const flameSpots = [[-4.3, 3], [4.3, -1.5], [-1, 4.7], [2.5, 3.6], [-3.5, -3], [5.6, 2.5], [0, -3.6], [-5.8, 0]];
for (const [x, z] of flameSpots) {
  const g = G(); const k = Math.max(...layers.map((l, i) => (Math.abs(x) <= l.half && Math.abs(z) <= l.half) ? i : -1));
  g.position.set(x, layers[Math.max(k, 0)].top, z);
  mk(new THREE.ConeGeometry(.7, 1.9, 6), M('#ff7a1a', { emissive: '#ff5a00', emissiveIntensity: .6 }), 0, .95, 0, g, false);
  mk(new THREE.ConeGeometry(.42, 1.2, 6), M('#ffd23a', { emissive: '#ffb800', emissiveIntensity: .7 }), 0, .7, .1, g, false);
  g.scale.setScalar(.001); flames.push({ g, ph: RFl() * 6 });
}
const smoke = []; for (let i = 0; i < 24; i++) smoke.push({ m: mk(new THREE.IcosahedronGeometry(1, 0), '#7a7f86', 0, -99, 0, scene, false), s: flameSpots[i % 8], o: RFl() });

// gas wells + main gas line
const wells = []; const wellSpots = [[0, 0], [2.6, 2.6], [-2.6, -2.6], [2.6, -2.6], [-2.6, 2.6]];
for (const [x, z] of wellSpots) {
  const g = G(); const k = Math.max(...layers.map((l, i) => (Math.abs(x) <= l.half - .3 && Math.abs(z) <= l.half - .3) ? i : -1));
  const top = layers[k].top;
  mk(new THREE.CylinderGeometry(.38, .38, 9, 8), '#eef0f2', 0, -2.5, 0, g);
  mk(new THREE.CylinderGeometry(.5, .5, .5, 8), '#f08a3c', 0, 2.2, 0, g);
  mk(new THREE.CylinderGeometry(.3, .3, .5, 8), '#5b5f66', 0, 2.6, 0, g);
  g.userData = { x, z, top }; g.visible = false; wells.push(g);
}
const PLANT = V(-18, 0, -16);
const gasPath = [V(-IN_MANTA - .2, .45, -3), V(-11, .45, -3), V(-11, .45, -13), V(PLANT.x + 4.5, .45, -13)];
const gasPipes = gasPath.slice(1).map((b, i) => pipeSeg(gasPath[i], b, .38, '#f2c94c'));
const gasDots = []; for (let i = 0; i < 18; i++) gasDots.push(mk(new THREE.IcosahedronGeometry(.32, 0), M('#fff27a', { emissive: '#ffe24a', emissiveIntensity: .8 }), 0, -99, 0, scene, false));
const wellBubbles = []; for (let i = 0; i < 20; i++) wellBubbles.push(mk(new THREE.IcosahedronGeometry(.3, 0), M('#fff27a', { emissive: '#ffe24a', emissiveIntensity: .8 }), 0, -99, 0, scene, false));

// ---------- power plant ----------
const plant = G(); plant.position.copy(PLANT);
mk(BOX(9, 5, 7), '#dfe3e8', 0, 2.5, 0, plant); mk(BOX(9.3, .6, 7.3), '#3d7fd6', 0, 5.2, 0, plant);
mk(BOX(2, 3, .1), '#5b6470', 2, 1.5, 3.55, plant);
for (const x of [-3, -1]) mk(new THREE.CylinderGeometry(.5, .6, 4, 8), '#b8bec6', x, 7, -1.5, plant);
const genG = G(plant); genG.position.set(4.6, 0, 5.4);
const gen = mk(new THREE.CylinderGeometry(1.5, 1.5, 3.4, 12), '#3d7fd6', 0, 1.7, 0, genG); gen.rotation.z = Math.PI / 2;
mk(BOX(3.6, .4, 2.6), '#5b5f66', 0, .2, 0, genG);
const rotor = G(genG); rotor.position.set(1.85, 1.7, 0);
for (let i = 0; i < 4; i++) { const b = mk(BOX(.2, 2.4, .5), '#f2c94c', 0, 0, 0, rotor); b.rotation.x = i * Math.PI / 4; }
const motor = mk(BOX(2.6, 2, 2.2), '#f08a3c', -1.2, 1.6, 5.4, plant);
const flareG = G(plant); flareG.position.set(-6.5, 0, 4);
mk(new THREE.CylinderGeometry(.3, .4, 8, 8), '#9aa0a6', 0, 4, 0, flareG);
const flare = G(flareG); flare.position.y = 8;
mk(new THREE.ConeGeometry(.6, 1.8, 6), M('#ff7a1a', { emissive: '#ff5a00', emissiveIntensity: .6 }), 0, .9, 0, flare, false);
mk(new THREE.ConeGeometry(.35, 1.1, 6), M('#ffd23a', { emissive: '#ffb800', emissiveIntensity: .7 }), 0, .6, 0, flare, false);
plant.scale.setScalar(.001);
const exhaust = []; for (let i = 0; i < 8; i++) exhaust.push({ m: mk(new THREE.IcosahedronGeometry(.6, 0), '#c8ccd2', 0, -99, 0, scene, false), o: i / 8 });
// power line plant -> city
const poles = [], wires = [], volts = [];
const lineA = V(PLANT.x - 5, 0, PLANT.z + 1), lineB = V(CITY.x + 18, 0, CITY.z + 6);
const NP = 4;
for (let i = 0; i <= NP; i++) { const p = lineA.clone().lerp(lineB, i / NP); const g = G(); g.position.copy(p); mk(new THREE.CylinderGeometry(.18, .22, 7, 6), '#7a4b2a', 0, 3.5, 0, g); mk(BOX(.25, .25, 2.4), '#7a4b2a', 0, 6.6, 0, g); g.scale.y = .001; poles.push(g); }
for (let i = 0; i < NP; i++) for (const dz of [-1, 1]) { const a = lineA.clone().lerp(lineB, i / NP).add(V(0, 6.8, dz)), b = lineA.clone().lerp(lineB, (i + 1) / NP).add(V(0, 6.8, dz)); wires.push(pipeSeg(a, b, .05, '#1d1f22')); }
for (let i = 0; i < 12; i++) volts.push(mk(new THREE.IcosahedronGeometry(.35, 0), M('#fff27a', { emissive: '#ffe24a', emissiveIntensity: 1 }), 0, -99, 0, scene, false));

// ---------- micro world (inside the mound) ----------
const MW = V(300, 15, 0);
const micro = G(); micro.position.copy(MW);
const room = new THREE.Mesh(BOX(60, 40, 60), new THREE.MeshLambertMaterial({ color: '#3a2717', side: THREE.BackSide })); micro.add(room);
mk(BOX(40, 30, 2), '#4a321e', 0, 0, -6, micro);
const RM = rng(11);
for (let i = 0; i < 70; i++) { const m = mk(new THREE.DodecahedronGeometry(.6 + RM() * 1.2, 0), RM() < .5 ? '#5a3c23' : '#6b4a2c', (RM() - .5) * 26, (RM() - .5) * 24, -5 + RM() * 1.2, micro); }
const foodDefs = [[-3.5, 3.2, '#d63a3a', 'apple'], [3.4, 3.8, '#f2d04c', 'banana'], [-3.8, -2.6, '#d9a45a', 'bread'], [3.2, -2.2, '#6cc04a', 'leaf'], [0, .6, '#e86b2a', 'peel'], [0, -6, '#d63a3a', 'apple']];
const foods = foodDefs.map(([x, y, c, k]) => {
  const geo = k === 'apple' ? new THREE.IcosahedronGeometry(1.5, 0) : k === 'banana' ? new THREE.CapsuleGeometry(.6, 2.6, 2, 7) : k === 'bread' ? BOX(2.8, 1.8, 1.8) : k === 'leaf' ? new THREE.CylinderGeometry(1.6, 1.6, .25, 7) : new THREE.TorusGeometry(1.1, .4, 5, 8);
  const m = mk(geo, c, x, y, -3.6, micro); m.rotation.set(RM() * 2, RM() * 2, RM() * 2); if (k === 'banana') m.rotation.set(0, 0, 1.2); if (k === 'leaf') m.rotation.set(1.3, 0, .4); return m;
});
const bact = []; const BC = ['#7ed957', '#5cc8a8', '#a3e05a'];
for (let i = 0; i < 11; i++) {
  const f = foods[i % foods.length]; const g = G(micro);
  const ang = RM() * 6.28; g.userData = { fx: f.position.x + Math.cos(ang) * 2, fy: f.position.y + Math.sin(ang) * 1.6, ph: RM() * 6, f: i % foods.length, sx: (RM() - .5) * 16, sy: (RM() - .5) * 14 };
  const body = mk(new THREE.CapsuleGeometry(.48, 1.1, 3, 8), BC[i % 3], 0, 0, 0, g); body.rotation.z = Math.PI / 2;
  for (const s of [-1, 1]) { mk(new THREE.SphereGeometry(.19, 8, 6), '#ffffff', .35 + s * .22, .18, .4, g, false); mk(new THREE.SphereGeometry(.1, 6, 5), '#111111', .37 + s * .22, .18, .55, g, false); }
  for (let j = 0; j < 3; j++) { const c = mk(BOX(.05, .05, .7), '#4f9a3a', -1 - j * .1, (j - 1) * .2, 0, g, false); c.rotation.y = Math.PI / 2; }
  g.scale.setScalar(.001); bact.push(g);
}
const bubbles = []; const RB = rng(55);
for (let i = 0; i < 70; i++) {
  const ch4 = RB() < .6; const m = mk(new THREE.SphereGeometry(ch4 ? .42 : .34, 10, 8), new THREE.MeshLambertMaterial({ color: ch4 ? '#f3ef72' : '#d4dbe2', emissive: ch4 ? '#6b6610' : '#3a4048', transparent: true, opacity: .9 }), 0, -99, 0, micro, false);
  bubbles.push({ m, b: i % bact.length, t0: Wd('s9', 'soltam') - .3 + RB() * (E('s9') - Wd('s9', 'soltam') + .6), wob: RB() * 6 });
}

// ---------- labels ----------
const labs = [];
function label(text, pos, t0, t1, opts = {}) { const el = document.createElement('div'); el.className = 'lab' + (opts.big ? ' big' : ''); el.textContent = text; document.getElementById('labs').appendChild(el); labs.push({ el, pos, t0, t1, rot: opts.rot ?? -4 }); }
label('LIXÃO', V(1, 4.6, 2), Wd('s2', 'terreno'), E('s2') + .2);
label('CHORUME', V(13, 1.6, 6), Wd('s3', 'chorume'), E('s3'));
label('ARGILA', V(-5.2, -1.5, 7.6), Wd('s4', 'argila'), E('s4') + .1);
label('MANTA', V(4.8, -2.4, -7.4), Wd('s4', 'manta'), E('s4') + .1, { rot: 3 });
label('LAGOA DE TRATAMENTO', V(POND.x, 3.2, POND.z), Wd('s5', 'lagoa'), E('s5') + .1);
label('COMPACTA', V(0, -.5, 0), Wd('s6', 'compacta'), Wd('s6', 'cobre'));
label('TERRA', V(0, 1, 2), Wd('s6', 'terra') - .1, E('s6') + .1, { rot: 3 });
label('CAMADAS', V(-9, 2.5, 6), Wd('s7', 'camada', 1), E('s7'));
label('SEM OXIGÊNIO', V(MW.x, MW.y + 7.5, MW.z), Wd('s8', 'oxig') - .1, E('s8'));
label('BACTÉRIAS', V(MW.x - 1, MW.y - 6.2, MW.z + 1), Wd('s8', 'bact'), E('s8'), { rot: 3 });
label('CH₄ METANO', V(MW.x - 3.2, MW.y + 6.5, MW.z), Wd('s9', 'metano'), E('s9') + .1);
label('CO₂', V(MW.x + 3.8, MW.y + 4, MW.z), Wd('s9', 'carb'), E('s9') + .1, { rot: 4 });
label('BIOGÁS', V(MW.x, MW.y + 3.5, MW.z + 2), Wd('s9', 'biog') - .05, E('s9') + .2, { big: true });
label('PRESSÃO', V(0, MOUND_TOP + 4.5, 0), Wd('s10', 'press'), E('s10'));
label('DRENOS DE GÁS', V(-1, MOUND_TOP + 5.5, 0), Wd('s11', 'tubos') + .2, E('s11') + .1);
label('USINA', V(PLANT.x - 2, 8.5, PLANT.z), Wd('s12', 'usina'), Wd('s12', 'queima') + .3);
label('MOTOR', V(PLANT.x - 1.2, 3.8, PLANT.z + 5.4), Wd('s12', 'motor'), Wd('s12', 'gira'));
label('GERADOR', V(PLANT.x + 4.6, 4.4, PLANT.z + 5.4), Wd('s12', 'gerador') - .1, E('s12') + .3, { rot: 3 });
label('ENERGIA', V(lineA.x - 9, 9, lineA.z + 2), Wd('s13', 'vira'), DUR);

// ---------- camera ----------
const cut = (t0, t1, p0, p1, l0, l1, ease = eio) => ({ t0, t1, p0: V(...p0), p1: V(...p1), l0: V(...l0), l1: V(...l1), ease });
const DIVE = Wd('s8', 'sem') - .25;
const mw = (x, y, z) => [MW.x + x, MW.y + y, MW.z + z];
const shots = [
  cut(0, S('s2'), [-36.2, 12, 25], [-36.2, 9, 18.5], [-36.2, 0, -4], [-36.2, 0, -5]),
  cut(S('s2'), S('s3'), [13, 8, 19], [10, 7.5, 16], [-1, 1, 1], [0, 1, 1]),
  cut(S('s3'), S('s4'), [3, 13, 24], [10, 12, 22], [2, 0, 2], [9, 0, 4]),
  cut(S('s4'), S('s5'), [0, 21, 22], [3, 14, 15], [0, -2, 0], [0, -3.5, 0]),
  cut(S('s5'), S('s6'), [16, 13, 24], [19, 9, 21], [5, -2, 4], [9, -1, 7]),
  cut(S('s6'), S('s7'), [-14, 9, 16], [-9, 8, 15], [-3, -3, 0], [0, -3, 0]),
  cut(S('s7'), DIVE, [0, 12, 30], [0, 17, 31], [0, 0, 0], [0, 2, 0]),
  cut(DIVE, DIVE + .7, [0, 17, 31], [0, 6.5, 2.5], [0, 2, 0], [0, 2, -2], ei),
  cut(DIVE + .7, S('s9'), mw(0, -.5, 19), mw(0, 0, 14.5), mw(0, -.5, 0), mw(0, 0, 0)),
  cut(S('s9'), S('s10'), mw(0, 0, 14.5), mw(0, 2.5, 17), mw(0, 0, 0), mw(0, 2.5, 0)),
  cut(S('s10'), S('s11'), [0, 9, 27], [5, 8, 23], [0, 3, 0], [0, 3, 0]),
  cut(S('s11'), Wd('s11', 'puxa'), [-3, 11, 22], [-5, 12, 21], [0, 4, 0], [-1, 4, 0]),
  cut(Wd('s11', 'puxa'), S('s12'), [-5, 12, 21], [-14, 12, 14], [-1, 4, 0], [-12, 1, -10]),
  cut(S('s12'), S('s13'), [-8, 5.5, -1], [-9.5, 6, 1], [-16, 2.5, -11], [-17, 2.5, -12]),
  cut(S('s13'), DUR + .1, [-2, 20, 22], [0, 25, 30], [-22, 2, -13], [-24, 4, -14]),
];
function camAt(t) {
  let s = shots[0]; for (const x of shots) if (t >= x.t0) s = x;
  const u = s.ease(P(t, s.t0, s.t1));
  camera.position.copy(s.p0).lerp(s.p1, u);
  const look = s.l0.clone().lerp(s.l1, u);
  // handheld drift + shakes
  camera.position.x += Math.sin(t * .9) * .15; camera.position.y += Math.sin(t * 1.3 + 1) * .1;
  let shake = 0;
  shake += win(t, Wd('s4', 'cava'), Wd('s4', 'gigante') + .4, .1) * .25;
  shake += win(t, Wd('s10', 'press'), E('s10') + .2, .15) * (.15 + .25 * P(t, S('s10'), E('s10')));
  if (shake) { camera.position.x += Math.sin(t * 61) * shake; camera.position.y += Math.sin(t * 47 + 2) * shake; }
  camera.lookAt(look);
}

// ---------- per-frame state ----------
const capEl = document.getElementById('capw'), flashEl = document.getElementById('flash');
const allWords = NARR.lines.flatMap((l, li) => l.words.map((w, i) => ({ ...w, end2: i < l.words.length - 1 ? l.words[i + 1].start : l.end + .12 })));
const tmpc = new THREE.Color();
function setState(t) {
  // sky / dusk
  const dusk = eio(P(t, S('s13') + .3, Wd('s13', 'luz') + .2));
  skyU.top.value.copy(SKY_TOP).lerp(DUSK_TOP, dusk); skyU.hor.value.copy(SKY_HOR).lerp(DUSK_HOR, dusk); scene.fog.color.copy(skyU.hor.value);
  hemi.intensity = lerp(1.5, .55, dusk); sun.intensity = lerp(2.6, 1.1, dusk); sun.color.set('#fff3dc').lerp(tmpc.set('#ff9a55'), dusk);
  winMat.emissiveIntensity = eo(P(t, Wd('s13', 'vira'), Wd('s13', 'luz') + .5)) * 1.4;
  for (const c of clouds) c.g.position.x = c.x0 + t * .8;
  sky.position.copy(camera.position);

  // s1 bags
  for (const b of bags) { const s = pop(t, b.t, .3); b.m.scale.set(s, s * .8, s); b.m.visible = s > .002; }

  // s2-s3 dump pile, removed at s4
  const clean = eio(P(t, S('s4'), S('s4') + .6));
  for (const p of pile) {
    const u = P(t, p.t, p.t + .45);
    p.m.visible = t >= p.t && clean < 1;
    p.m.position.set(p.p.x, lerp(p.p.y + 9, p.p.y, eo(u)), p.p.z); p.m.rotation.y = p.rot + u * 2;
    p.m.scale.setScalar(1 - clean);
  }
  // truck in s2 (dump) and s6 (into pit)
  truck.visible = false;
  if (t >= S('s2') - .1 && t < S('s3')) {
    truck.visible = true; const u = eo(P(t, S('s2') - .1, S('s2') + 1.1));
    truck.position.set(lerp(-20, -6.8, u), 0, 3); truck.rotation.y = 0; truck.userData.bed.rotation.z = -eo(P(t, S('s2') + .9, S('s2') + 1.5)) * .75;
  }
  if (t >= S('s6') - .1 && t < Wd('s6', 'trator') + .6) {
    truck.visible = true; const u = eo(P(t, S('s6') - .1, S('s6') + .7));
    truck.position.set(lerp(-26, -11.6, u), 0, 1.5); truck.rotation.y = 0; truck.userData.bed.rotation.z = -eo(P(t, S('s6') + .55, S('s6') + 1.0)) * .8;
  }
  // rain + storm (s3)
  const rainOn = win(t, S('s3') - .2, Wd('s3', 'escorre'), .4);
  storm.visible = rainOn > 0; storm.position.x = lerp(-30, 0, eo(P(t, S('s3') - .4, S('s3') + .6))); storm.position.y = lerp(10, 0, rainOn);
  for (const r of rain) { r.visible = rainOn > .05; const d = r.userData; r.position.set(d.x, 20 - ((t * 28 + d.o) % 21), d.z); r.scale.y = rainOn; }
  // chorume
  const st = P(t, Wd('s3', 'chorume') - .3, Wd('s3', 'rio') + .3);
  pileStain.visible = st > 0 && clean < 1; pileStain.scale.set(eo(P(t, Wd('s3', 'chorume') - .5, Wd('s3', 'chorume') + .2)) * (1 - clean), 1, eo(P(t, Wd('s3', 'chorume') - .5, Wd('s3', 'chorume') + .2)) * (1 - clean));
  for (const s of stain) { const v = clean < 1 ? cl((st - s.u * .9) * 8) : 0; s.m.visible = v > .01; s.m.scale.set(v, 1, v); }
  riverMat.color.copy(RIVER_BLUE).lerp(RIVER_DIRTY, eo(P(t, Wd('s3', 'rio') - .2, Wd('s3', 'rio') + .3)) * (1 - eio(P(t, S('s5'), S('s5') + 1.5))) * .85);

  // s4 dig + liners
  const dig = eio(P(t, Wd('s4', 'cava'), Wd('s4', 'gigante') + .3));
  cover.scale.set(1 - dig, 1, 1 - dig); cover.visible = dig < 1;
  const cy = eo(P(t, Wd('s4', 'argila') - .5, Wd('s4', 'argila') + .25));
  for (const w of clay.walls) w.scale.y = Math.max(cy, .001); clay.floor.scale.set(Math.max(eo(P(t, Wd('s4', 'forra') - .2, Wd('s4', 'argila'))), .001), 1, Math.max(eo(P(t, Wd('s4', 'forra') - .2, Wd('s4', 'argila'))), .001));
  const my = eo(P(t, Wd('s4', 'manta') - .35, Wd('s4', 'plást') + .1));
  for (const w of manta.walls) w.scale.y = Math.max(my, .001);
  manta.floor.scale.set(Math.max(eo(P(t, Wd('s4', 'plást') - .2, Wd('s4', 'plást') + .4)), .001), 1, Math.max(eo(P(t, Wd('s4', 'plást') - .2, Wd('s4', 'plást') + .4)), .001));
  manta.floor.position.y = -PIT_D + .15 / 2 + .3;

  // s5 pipes + pond
  const pp = P(t, S('s5') + .1, Wd('s5', 'canos') + .4);
  leachPipes.forEach((p, i) => { p.m.scale.y = Math.max(eo(cl(pp * leachPipes.length - i)), .001); });
  leachSide[0].m.scale.y = Math.max(eo(P(t, S('s5'), S('s5') + .6)), .001);
  const flowOn = t > Wd('s5', 'desce') && t < S('s7');
  drops.forEach((d, i) => { if (!flowOn) { d.position.y = -99; return; } const u = ((t - Wd('s5', 'desce')) * .35 + i / drops.length) % 1; d.position.copy(along(leachPath, u)); d.position.y += .45; });
  const pf = eo(P(t, Wd('s5', 'lagoa') - .4, E('s5')));
  pondWater.scale.set(.1 + .9 * pf, 1, .1 + .9 * pf); pondWater.visible = t > Wd('s5', 'lagoa') - .4;
  pondRim.scale.setScalar(Math.max(pop(t, Wd('s5', 'até') - .1, .4), .001));

  // s6 fill-in, compactor, layers
  for (const f of fallIn) {
    const u = P(t, f.t, f.t + .55); const gone = eo(P(t, Wd('s6', 'trator'), Wd('s6', 'compacta') + .2));
    f.m.visible = t >= f.t && gone < 1;
    f.m.position.set(lerp(-8, f.p.x, eo(u)), lerp(3, f.p.y, u * u) + Math.sin(u * Math.PI) * 2, lerp(1.5, f.p.z, eo(u))); f.m.scale.setScalar(1 - gone);
  }
  const L0t = eo(P(t, Wd('s6', 'trator') - .2, Wd('s6', 'compacta') + .2)), L0e = eo(P(t, Wd('s6', 'cobre') - .1, Wd('s6', 'terra') + .3));
  const layerT = [[L0t, L0e]];
  for (let k = 1; k < 6; k++) { const a = S('s7') + .05 + (k - 1) * ((E('s7') - S('s7') - .2) / 5); layerT.push([eo(P(t, a, a + .3)), eo(P(t, a + .2, a + .45))]); }
  layers.forEach((l, k) => {
    l.trashL.scale.y = Math.max(layerT[k][0], .001); l.trashL.visible = layerT[k][0] > .001;
    l.earth.scale.x = Math.max(layerT[k][1], .001); l.earth.visible = layerT[k][1] > .001;
    l.bits.visible = layerT[k][1] < .999 || k === 5;
    l.earth.material.color.set('#9b6a3f').lerp(tmpc.set(GRASS), k >= 2 ? eo(P(t, E('s7') - .2, E('s7') + .6)) : 0);
  });
  dozer.visible = t > Wd('s6', 'trator') - .3 && t < Wd('s6', 'terra') + .2;
  if (dozer.visible) { const u = P(t, Wd('s6', 'trator') - .3, Wd('s6', 'terra')); dozer.position.set(Math.sin(u * Math.PI * 2.2) * 4.5, -PIT_D + .45 + 1.1 * L0t, Math.sin(u * 5) * 1.5); dozer.rotation.y = Math.cos(u * Math.PI * 2.2) > 0 ? 0 : Math.PI; roller.rotation.y = t * 6; }

  // s10 pressure: mound pulses, flames + smoke
  const pres = P(t, Wd('s10', 'press') - .3, E('s10'));
  const pulse = t > S('s10') && t < S('s11') + .3 ? 1 + .05 * pres * (.5 + .5 * Math.sin(t * 14)) : 1;
  mound.scale.set(1 + (pulse - 1) * .4, pulse, 1 + (pulse - 1) * .4);
  const fOff = eo(P(t, S('s11'), S('s11') + .5));
  flames.forEach((f, i) => { const s = pop(t, Wd('s10', 'pegar') - .25 + i * .07, .35) * (1 - fOff); f.g.scale.set(s * (1 + .12 * Math.sin(t * 20 + f.ph)), s * (1 + .2 * Math.sin(t * 17 + f.ph)), s); f.g.visible = s > .002; });
  smoke.forEach((sm, i) => { const on = t > Wd('s10', 'pegar') && t < S('s11') + 1.2; if (!on) { sm.m.position.y = -99; return; } const u = ((t - Wd('s10', 'pegar')) * .5 + sm.o) % 1; const f = flames[i % 8].g.position; sm.m.position.set(f.x + u * 1.5, f.y + 1.5 + u * 6, f.z); sm.m.scale.setScalar((.3 + u * .8) * (1 - fOff * .8)); });

  // s11 wells + gas line
  wells.forEach((w, i) => { const a = Wd('s11', 'tubos') - .15 + i * .12; const u = eo(P(t, a, a + .35)); w.visible = t > a; w.position.set(w.userData.x, lerp(w.userData.top + 14, w.userData.top, u) * mound.scale.y, w.userData.z); });
  const gp = P(t, Wd('s11', 'puxa') - .2, Wd('s11', 'fora') + .2);
  gasPipes.forEach((p, i) => { p.m.scale.y = Math.max(eo(cl(gp * gasPipes.length - i)), .001); });
  const gasOn = t > Wd('s11', 'puxa') + .2;
  gasDots.forEach((d, i) => { if (!gasOn) { d.position.y = -99; return; } const u = ((t - Wd('s11', 'puxa')) * .45 + i / gasDots.length) % 1; d.position.copy(along(gasPath, u)); d.position.y += .2; });
  wellBubbles.forEach((b, i) => { const w = wells[i % 5]; if (t < Wd('s11', 'puxa') - .3 || t > S('s13')) { b.position.y = -99; return; } const u = ((t * .9) + i * .37) % 1; b.position.set(w.userData.x + Math.sin(u * 9 + i) * .2, w.userData.top + 2.9 + u * 3, w.userData.z); b.scale.setScalar(1 - u); });

  // s12 plant
  const pl = pop(t, Wd('s11', 'fora') - .2, .5); plant.scale.setScalar(Math.max(pl, .001));
  rotor.rotation.x = t < Wd('s12', 'gira') - .2 ? 0 : (t - Wd('s12', 'gira') + .2) ** 2 * 6;
  motor.scale.setScalar(1 + (t > Wd('s12', 'queima') ? .04 * Math.sin(t * 40) : 0));
  flare.scale.setScalar(t > Wd('s12', 'queima') - .1 ? (1 + .15 * Math.sin(t * 19)) * eo(P(t, Wd('s12', 'queima') - .1, Wd('s12', 'queima') + .3)) : .001);
  exhaust.forEach(e => { if (t < Wd('s12', 'motor')) { e.m.position.y = -99; return; } const u = ((t - Wd('s12', 'motor')) * .8 + e.o) % 1; e.m.position.set(PLANT.x - 1.2 + u * .8, 3 + u * 4, PLANT.z + 5.4); e.m.scale.setScalar(.4 + u); });
  poles.forEach((p, i) => { p.scale.y = Math.max(eo(P(t, Wd('s12', 'gerador') - .4 + i * .08, Wd('s12', 'gerador') + i * .08)), .001); });
  wires.forEach((w, i) => { w.m.scale.y = Math.max(eo(P(t, Wd('s12', 'gerador') + .1 + (i >> 1) * .08, Wd('s12', 'gerador') + .4 + (i >> 1) * .08)), .001); });
  volts.forEach((v, i) => { const t0 = E('s12') - .2; if (t < t0) { v.position.y = -99; return; } const u = ((t - t0) * .5 + i / volts.length) % 1; v.position.copy(lineA.clone().lerp(lineB, u)).add(V(0, 6.8, i % 2 ? 1 : -1)); });

  // micro world
  const mOn = t > DIVE + .5 && t < S('s10');
  bact.forEach((g, i) => {
    const d = g.userData; const s = pop(t, Wd('s8', 'bilh') - .2 + i * .06, .4);
    g.scale.setScalar(Math.max(s, .001));
    const go = eo(P(t, Wd('s8', 'come') - .3, Wd('s8', 'podre') + .3));
    g.position.set(lerp(d.sx, d.fx, go) + Math.sin(t * 2 + d.ph) * .3, lerp(d.sy, d.fy, go) + Math.sin(t * 3 + d.ph) * .25, -1.4 + Math.sin(t + d.ph) * .3);
    g.rotation.z = Math.sin(t * 5 + d.ph) * .25; g.scale.y *= 1 + .08 * Math.sin(t * 9 + d.ph);
  });
  foods.forEach((f, i) => { const eat = eo(P(t, Wd('s8', 'comer'), E('s9'))); f.scale.setScalar(1 - .45 * eat); });
  bubbles.forEach(b => {
    const u = P(t, b.t0, b.t0 + 2.6); if (u <= 0 || u >= 1 || !mOn) { b.m.position.y = -99; return; }
    const g = bact[b.b]; b.m.position.set(g.position.x + Math.sin(u * 8 + b.wob) * .5, g.position.y + .6 + u * 13, g.position.z + .6); b.m.scale.setScalar(Math.min(1, u * 6) * (1 + u * .6));
  });

  // flash on dive cut
  flashEl.style.opacity = Math.max(0, 1 - Math.abs(t - (DIVE + .7)) / .22).toFixed(3);

  camAt(t);
  sky.position.copy(camera.position);
}

function uiAt(t) {
  // caption: one word at a time
  let cur = null; for (const w of allWords) if (t >= w.start && t < w.end2) cur = w;
  if (cur) {
    const word = cur.w.charAt(0).toUpperCase() + cur.w.slice(1);
    capEl.textContent = word; capEl.style.color = cur.hl ? '#FFD21F' : '#ffffff';
    const s = .7 + .3 * back(P(t, cur.start, cur.start + .12)); capEl.style.transform = `scale(${s.toFixed(3)})`;
    capEl.style.fontSize = word.length > 9 ? '104px' : '124px';
  } else capEl.textContent = '';
  // labels
  camera.updateMatrixWorld();
  for (const l of labs) {
    if (t < l.t0 || t > l.t1) { l.el.style.display = 'none'; continue; }
    const v = l.pos.clone().project(camera);
    if (v.z > 1) { l.el.style.display = 'none'; continue; }
    const s = pop(t, l.t0, .35) * (1 - ei(P(t, l.t1 - .18, l.t1)));
    const x = (v.x + 1) / 2 * W, y = (1 - v.y) / 2 * H;
    l.el.style.display = 'block';
    const lw = l.el.offsetWidth, lh = l.el.offsetHeight;
    const x2 = cl(x, lw / 2 + 50, W - lw / 2 - 150), y2 = cl(y, 230, 1060);
    l.el.style.transform = `translate(${x2.toFixed(1)}px,${y2.toFixed(1)}px) translate(-50%,-50%) rotate(${l.rot}deg) scale(${Math.max(s, 0).toFixed(3)})`;
  }
}

// anything collapsed to ~0 scale (pipes, liners, poles before they grow) is hidden so it can't draw hairlines
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
