// "Como nasce um carro": low-poly 3D explainer with an on-screen mechanic (Téo) who talks.
// Everything is a pure function of time t (seconds); render.js steps frame by frame.
// Narration timing + mouth amplitude come from narracao.json.
import * as THREE from 'three';

const NARR = await (await fetch('./narracao.json')).json();
const L = Object.fromEntries(NARR.lines.map(l => [l.id, l]));
const S = id => L[id].start;
const E = id => L[id].end;
const Wd = (id, w, n = 0) => {
  const ws = L[id].words.filter(x => x.w.toLowerCase().startsWith(w));
  if (!ws.length) { console.log('MISSING WORD', id, w); return L[id].start; }
  return (ws[n] || ws[0]).start;
};
const DUR = NARR.duration;
const AMP = NARR.amp;
const ampAt = t => { const i = Math.floor(t * 100); let s = 0; for (let k = -2; k <= 2; k++) s += AMP[Math.min(AMP.length - 1, Math.max(0, i + k))] || 0; return s / 5; };

// ---------- helpers ----------
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
const camera = new THREE.PerspectiveCamera(56, W / H, .1, 2000);

const skyU = { top: { value: new THREE.Color('#2f86e6') }, hor: { value: new THREE.Color('#c4e6ff') } };
const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), new THREE.ShaderMaterial({
  uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false,
  vertexShader: `varying vec3 vp;void main(){vp=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader: `uniform vec3 top;uniform vec3 hor;varying vec3 vp;void main(){float h=clamp(vp.y*1.4,0.,1.);gl_FragColor=vec4(mix(hor,top,pow(h,.6)),1.);
  #include <colorspace_fragment>
  }`
}));
scene.add(sky);
scene.fog = new THREE.Fog(new THREE.Color('#c4e6ff'), 120, 460);
const hemi = new THREE.HemisphereLight('#e4f3ff', '#7a8f6a', 1.55); scene.add(hemi);
const sun = new THREE.DirectionalLight('#fff3dc', 2.5); sun.position.set(18, 40, 26); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 120 });
sun.shadow.bias = -.0006; sun.shadow.normalBias = .03; scene.add(sun); scene.add(sun.target);

const matCache = {};
const M = (c, extra) => { const k = c + (extra ? JSON.stringify(extra) : ''); return matCache[k] || (matCache[k] = new THREE.MeshLambertMaterial({ color: c, flatShading: true, ...(extra || {}) })); };
function mk(geo, mat, x = 0, y = 0, z = 0, parent = scene, shadow = true) {
  const m = new THREE.Mesh(geo, typeof mat === 'string' ? M(mat) : mat);
  m.position.set(x, y, z); m.castShadow = shadow; m.receiveShadow = true; parent.add(m); return m;
}
const G = (parent = scene) => { const g = new THREE.Group(); parent.add(g); return g; };
const BOX = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const CYL = (r1, r2, h, n = 10) => new THREE.CylinderGeometry(r1, r2, h, n);
function extrude(pts, depth) { // side profile in x/y, extruded along z, centered
  const sh = new THREE.Shape(pts.map(p => new THREE.Vector2(p[0], p[1])));
  const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false }); g.translate(0, 0, -depth / 2); return g;
}

// ---------- world ----------
const GRASS = '#7cc456';
mk(BOX(900, 2, 900), GRASS, 0, -1, 0).castShadow = false;
const FLOOR = mk(BOX(44, .1, 26), '#cfd3d8', -6, .05, -3); FLOOR.castShadow = false;
const TOP = .1;
// floor markings
for (const [x, z, w, d] of [[-6, 10, 44, .25], [-6, -16, 44, .25], [-28, -3, .25, 26], [16, -3, .25, 26.2]]) mk(BOX(w, .02, d), '#f2c94c', x, TOP + .01, z, scene, false);
const ring = mk(new THREE.RingGeometry(3.6, 3.9, 40), M('#f2c94c', { side: THREE.DoubleSide }), 0, TOP + .015, 0, scene, false); ring.rotation.x = -Math.PI / 2;
for (let i = 0; i < 10; i++) mk(BOX(.9, .02, .45), i % 2 ? '#1d1f22' : '#f2c94c', -10 + i * .9, TOP + .01, 6.5, scene, false);
// road out of the factory along +x
mk(BOX(500, .06, 6), '#55595f', 266, .04, 0, scene, false);
for (let i = 0; i < 90; i++) mk(BOX(2.2, .02, .22), '#f4f4f4', 20 + i * 5.5, .08, 0, scene, false);
for (const z of [3.1, -3.1]) mk(BOX(500, .03, .25), '#e8e8e8', 266, .07, z, scene, false);

// factory hall in the back
const hall = G(); hall.position.set(-6, 0, -24);
mk(BOX(46, 9, 12), '#efe8dc', 0, 4.5, 0, hall);
mk(BOX(46.4, .6, 12.4), '#7b2ff7', 0, 9.2, 0, hall);
for (let i = 0; i < 0; i++) { const r = mk(new THREE.CylinderGeometry(.01, 2.6, 7.6, 3), '#d9d2c6', -19 + i * 7.6, 10.6, 0, hall); r.rotation.set(0, 0, Math.PI / 2); r.rotation.y = Math.PI / 2; r.scale.set(1, 1, .9); }
for (let i = 0; i < 5; i++) mk(BOX(5, 6, .2), '#5b6470', -18 + i * 9, 3, 6.05, hall);
for (let i = 0; i < 12; i++) mk(BOX(2.2, 1.3, .2), '#9ec8ea', -20 + i * 3.6, 7.4, 6.08, hall);
const chim = mk(CYL(.8, 1, 10, 10), '#b8bec6', 16, 9, -2, hall);
// trees, clouds, hills
const R = rng(7);
function tree(x, z, s) {
  const g = G(); g.position.set(x, 0, z); g.scale.setScalar(s);
  mk(CYL(.25, .35, 1.6, 6), '#7a4b2a', 0, .8, 0, g);
  mk(new THREE.ConeGeometry(1.5, 2.6, 7), R() < .5 ? '#3f9b45' : '#52ad4a', 0, 2.6, 0, g);
  mk(new THREE.ConeGeometry(1.1, 2, 7), '#5cbf52', 0, 3.7, 0, g);
}
for (let i = 0; i < 170; i++) {
  const x = -120 + R() * 320, z = -90 + R() * 150;
  if (x > -32 && x < 20 && z > -32 && z < 12) continue;
  if (Math.abs(z) < 6 && x > 10) continue;
  tree(x, z, .9 + R() * 1.1);
}
for (let i = 0; i < 9; i++) { const h = mk(new THREE.IcosahedronGeometry(30 + R() * 25, 0), '#6fb34d', -200 + i * 70, -12, -240 - R() * 60, scene, false); h.scale.y = .5; }
const clouds = [];
for (let i = 0; i < 14; i++) {
  const g = G(); g.position.set(-150 + R() * 340, 34 + R() * 26, -120 + R() * 110);
  for (let j = 0; j < 5; j++) { const m = mk(new THREE.IcosahedronGeometry(3 + R() * 3, 0), M('#ffffff', { emissive: '#bcd6ee' }), (j - 2) * 3.5, R() * 2, R() * 3, g, false); }
  clouds.push({ g, x0: g.position.x });
}
// props
for (const [x, z, c] of [[-24, -12, '#c98a4b'], [-23, -10, '#c98a4b'], [-24, -10.5, '#3d7fd6'], [12, -13, '#c98a4b'], [13.5, -13, '#2f8f46'], [-26, 6, '#c98a4b']]) mk(BOX(1.4, 1.4, 1.4), c, x, TOP + .7, z);
for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) { const tg = G(); tg.position.set(9 + i * 1.3, TOP, -14 + j * 1.3); mk(CYL(.55, .55, .35, 12), '#1d1f22', 0, .2 + j * 0, 0, tg); }

// ---------- paint material (sweep shader) ----------
const PU = { uA: { value: -9 }, uB: { value: -9 }, uHeat: { value: 0 }, uS: { value: -9 }, uShine: { value: 0 },
  cSteel: { value: new THREE.Color('#b9c0c9') }, cPrim: { value: new THREE.Color('#eef0f3') }, cPaint: { value: new THREE.Color('#7b2ff7') } };
const paint = new THREE.MeshLambertMaterial({ color: '#ffffff', flatShading: true });
paint.onBeforeCompile = sh => {
  Object.assign(sh.uniforms, PU);
  sh.vertexShader = 'varying vec3 vW;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n vW = (modelMatrix * vec4(transformed,1.)).xyz;');
  sh.fragmentShader = 'varying vec3 vW;uniform float uA,uB,uHeat,uS,uShine;uniform vec3 cSteel,cPrim,cPaint;\n' + sh.fragmentShader
    .replace('#include <color_fragment>', `#include <color_fragment>
      float pa = 1.0 - smoothstep(uA - .18, uA + .18, vW.x);
      float pb = 1.0 - smoothstep(uB - .18, uB + .18, vW.x);
      diffuseColor.rgb = mix(mix(cSteel, cPrim, pa), cPaint, pb);`)
    .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      totalEmissiveRadiance += vec3(1.0, .32, .04) * uHeat;
      totalEmissiveRadiance += vec3(.55) * uShine * exp(-pow((vW.x - uS) * 2.2, 2.0));`);
};
paint.customProgramCacheKey = () => 'paintsweep';

// ---------- the car ----------
const car = G();                 // whole car (moves when it drives away)
const bodyG = G(car);            // body: lifted by the hanger in s7/s8
const chassisG = G(car);         // powertrain + wheels
const parts = [];                // every part, for the exploded view
function part(obj, explodeDir) { obj.userData.home = obj.position.clone(); obj.userData.hrot = obj.rotation.clone(); obj.userData.ex = explodeDir; parts.push(obj); return obj; }
const HULL = [[-2.3, .5], [2.3, .5], [2.36, .98], [1.0, 1.12], [-1.7, 1.12], [-2.32, 1.08]];
const CAB = [[-1.7, 1.12], [1.0, 1.12], [.42, 1.93], [-1.12, 1.93]];
const hull = part(mk(extrude(HULL, 1.8), paint, 0, 0, 0, bodyG), V(0, -.4, 0));
const cabin = part(mk(extrude(CAB, 1.64), paint, 0, 0, 0, bodyG), V(0, .9, 0));
const roof = part(mk(BOX(1.62, .08, 1.7), paint, -.35, 1.96, 0, bodyG), V(0, 2.2, 0));
const hood = part(mk(BOX(1.42, .07, 1.84), paint, 1.68, 1.08, 0, bodyG), V(1.6, 1.2, 0)); hood.rotation.z = -.1; hood.userData.hrot = hood.rotation.clone();
const trunk = part(mk(BOX(.66, .07, 1.84), paint, -2.0, 1.13, 0, bodyG), V(-1.6, 1.1, 0));
const doors = [];
for (const [x, z] of [[.95, 1], [-.1, 1], [.95, -1], [-.1, -1]]) { // hinge at the front edge
  const g = G(bodyG); g.position.set(x, 0, z * .915);
  const d = mk(BOX(1.0, .56, .06), paint, -.5, .82, 0, g); mk(BOX(.18, .05, .07), '#2b2d33', -.82, .95, z * .03, g);
  part(g, V(0, .2, z * 1.6)); doors.push({ g, z });
}
const bodyMain = [hull, cabin, roof, hood, trunk, ...doors.map(d => d.g)];
// glass
const glassMat = M('#27425e', { emissive: '#0c1a2a' });
const glass = [];
for (const z of [.83, -.83]) {
  const gl = mk(extrude([[-1.6, 1.2], [.9, 1.2], [.38, 1.86], [-1.06, 1.86]], .02), glassMat, 0, 0, z, bodyG, false); glass.push(part(gl, V(0, .4, z * 2)));
}
function slab(a, b, w, th, mat, parent) { const len = Math.hypot(b[0] - a[0], b[1] - a[1]); const m = mk(BOX(len, th, w), mat, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 0, parent, false); m.rotation.z = Math.atan2(b[1] - a[1], b[0] - a[0]); return m; }
glass.push(part(slab([1.02, 1.13], [.43, 1.95], 1.58, .03, glassMat, bodyG), V(1.5, .8, 0)));
glass.push(part(slab([-1.72, 1.13], [-1.13, 1.95], 1.58, .03, glassMat, bodyG), V(-1.5, .8, 0)));
for (const g of glass) g.position.add(V(0, 0, 0)), g.userData.home = g.position.clone();
glass[2].position.x += .02; glass[2].position.y += .02; glass[2].userData.home = glass[2].position.clone();
glass[3].position.x -= .02; glass[3].position.y += .02; glass[3].userData.home = glass[3].position.clone();
// lights + bumpers + grille
const headMat = new THREE.MeshLambertMaterial({ color: '#fff6c8', emissive: '#fff1a8', emissiveIntensity: 0, flatShading: true });
const heads = [.6, -.6].map(z => part(mk(BOX(.08, .16, .42), headMat, 2.37, .86, z, bodyG, false), V(1.4, .3, z)));
const tailMat = new THREE.MeshLambertMaterial({ color: '#c62828', emissive: '#ff2a2a', emissiveIntensity: 0, flatShading: true });
const tails = [.62, -.62].map(z => part(mk(BOX(.06, .14, .36), tailMat, -2.34, .9, z, bodyG, false), V(-1.4, .3, z)));
const bumpers = [part(mk(BOX(.22, .26, 1.9), '#2b2d33', 2.4, .6, 0, bodyG), V(1.6, -.2, 0)), part(mk(BOX(.22, .26, 1.9), '#2b2d33', -2.4, .62, 0, bodyG), V(-1.6, -.2, 0))];
const grille = part(mk(BOX(.05, .14, .7), '#1d1f22', 2.38, .86, 0, bodyG, false), V(1.4, .2, 0));
// seats
const seats = [];
for (const [x, z] of [[.15, .4], [.15, -.4], [-.95, .4], [-.95, -.4]]) {
  const g = G(bodyG); g.position.set(x, .75, z);
  mk(BOX(.5, .14, .5), '#3a3f4a', 0, .1, 0, g); const bk = mk(BOX(.13, .6, .5), '#3a3f4a', -.25, .42, 0, g); bk.rotation.z = -.12;
  part(g, V(0, 1.6, z * 3)); seats.push({ g, z });
}
// powertrain
const rails = [part(mk(BOX(4.0, .16, .14), '#3b3f46', 0, .38, .55, chassisG), V(0, -.3, .5)), part(mk(BOX(4.0, .16, .14), '#3b3f46', 0, .38, -.55, chassisG), V(0, -.3, -.5))];
const axles = [1.45, -1.45].map(x => { const a = mk(CYL(.07, .07, 2.0, 8), '#5b5f66', x, .45, 0, chassisG); a.rotation.x = Math.PI / 2; return part(a, V(0, -.6, 0)); });
const engine = G(chassisG); engine.position.set(1.55, .72, 0);
mk(BOX(.8, .5, .8), '#9aa3ad', 0, 0, 0, engine); mk(BOX(.84, .14, .7), '#d64545', 0, .32, 0, engine);
const pistons = []; for (let i = 0; i < 4; i++) pistons.push(mk(CYL(.07, .07, .3, 8), '#e6e8eb', 0, .45, -.27 + i * .18, engine));
mk(CYL(.15, .15, .1, 10), '#2c2f33', -.42, 0, 0, engine).rotation.z = Math.PI / 2;
part(engine, V(1.2, 1.6, 0));
const gearbox = G(chassisG); gearbox.position.set(.8, .6, 0);
const gb = mk(CYL(.26, .16, .7, 8), '#7d8590', 0, 0, 0, gearbox); gb.rotation.z = Math.PI / 2;
part(gearbox, V(0, 1.3, .6));
const exhaust = part(mk(CYL(.06, .06, 3.2, 6), '#8a8f96', -.8, .42, -.3, chassisG), V(-.6, -.5, -.8)); exhaust.rotation.z = Math.PI / 2; exhaust.userData.hrot = exhaust.rotation.clone();
// wheels
const wheels = [];
for (const [x, z] of [[1.45, 1], [-1.45, 1], [1.45, -1], [-1.45, -1]]) {
  const g = G(chassisG); g.position.set(x, .45, z * .98);
  const spin = G(g);
  const tire = mk(CYL(.45, .45, .32, 14), '#1d1f22', 0, 0, 0, spin); tire.rotation.x = Math.PI / 2;
  const rim = mk(CYL(.27, .27, .34, 8), '#cfd3d8', 0, 0, 0, spin); rim.rotation.x = Math.PI / 2;
  for (let k = 0; k < 4; k++) { const s = mk(BOX(.48, .07, .35), '#9aa0a6', 0, 0, 0, spin, false); s.rotation.z = k * Math.PI / 4; }
  part(g, V(x * .3, 0, z * 1.8)); wheels.push({ g, spin, z });
}
// skid (body carrier before the marriage)
const skid = G(car);
for (const z of [.6, -.6]) mk(BOX(4.2, .14, .18), '#3d7fd6', 0, .17, z, skid);
for (const [x, z] of [[1.7, .6], [-1.7, .6], [1.7, -.6], [-1.7, -.6]]) mk(BOX(.18, .3, .18), '#3d7fd6', x, .38, z, skid);

// ---------- hologram (s2) ----------
const holo = G(); const holoMat = new THREE.MeshBasicMaterial({ color: '#19b8ff' });
const holoTubes = [];
function holoEdges(geo, mtx) {
  const eg = new THREE.EdgesGeometry(geo, 20); const p = eg.attributes.position;
  for (let i = 0; i < p.count; i += 2) {
    const a = V(p.getX(i), p.getY(i), p.getZ(i)).applyMatrix4(mtx), b = V(p.getX(i + 1), p.getY(i + 1), p.getZ(i + 1)).applyMatrix4(mtx);
    const len = a.distanceTo(b); if (len < .02) continue;
    const g = CYL(.05, .05, len, 5); g.translate(0, len / 2, 0);
    const m = new THREE.Mesh(g, holoMat); m.position.copy(a); m.quaternion.setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize()); holo.add(m);
    holoTubes.push({ m, k: (a.x + 2.6) / 5.2 });
  }
}
car.updateMatrixWorld(true);
for (const o of [hull, cabin, hood, trunk]) holoEdges(o.geometry, o.matrixWorld);
for (const w of wheels) holoEdges(new THREE.CylinderGeometry(.45, .45, .32, 14).rotateX(Math.PI / 2), w.g.matrixWorld);
holoTubes.sort((a, b) => a.k - b.k);
const projector = mk(CYL(1.6, 1.8, .14, 24), '#1f3550', 0, TOP + .07, 0, holo, false);
const projGlow = mk(CYL(1.3, 1.3, .02, 24), new THREE.MeshBasicMaterial({ color: '#7fe3ff' }), 0, TOP + .15, 0, holo, false);
const beam = mk(new THREE.CylinderGeometry(3.2, 1.3, 2.6, 24, 1, true), new THREE.MeshBasicMaterial({ color: '#7fe3ff', transparent: true, opacity: .12, side: THREE.DoubleSide, depthWrite: false }), 0, 1.4, 0, holo, false);

// ---------- press (s3) ----------
const PR = V(-13, 0, -3);
const press = G(); press.position.copy(PR);
mk(BOX(4.4, 1, 3.2), '#5b6470', 0, TOP + .5, 0, press);
for (const x of [-2.4, 2.4]) mk(BOX(.8, 7, .9), '#3d7fd6', x, TOP + 3.5, 0, press);
mk(BOX(5.8, 1.5, 3.4), '#3d7fd6', 0, 7.3, 0, press);
mk(BOX(1.4, .3, 3.5), '#f2c94c', -1.6, 7.3, 0, press); mk(BOX(1.4, .3, 3.5), '#f2c94c', 1.6, 7.3, 0, press);
const ram = G(press); mk(BOX(3.8, 1.1, 2.7), '#2c2f33', 0, 0, 0, ram); mk(CYL(.35, .35, 1.6, 10), '#cfd3d8', 0, 1.3, 0, ram);
const RAM_UP = 5.4, RAM_DN = TOP + 1.0 + .08 + .55;
const sheetMat = M('#c9ced6');
const sheet = mk(BOX(3.0, .06, 2.0), sheetMat, 0, TOP + 1.03, 0, press);
const panelShapes = [
  () => { const g = new THREE.Group(); mk(BOX(1.6, .06, 1.0), sheetMat, 0, 0, 0, g); mk(BOX(.9, .07, .5), '#8d949c', .2, .005, .15, g, false); return g; },     // door
  () => { const g = new THREE.Group(); mk(BOX(2.0, .06, 1.7), sheetMat, 0, 0, 0, g); mk(BOX(1.8, .1, 1.4), sheetMat, 0, .05, 0, g); return g; },               // roof
  () => { const g = new THREE.Group(); mk(BOX(1.6, .06, 1.9), sheetMat, 0, 0, 0, g); mk(BOX(1.2, .09, .3), sheetMat, 0, .04, 0, g); return g; },                // hood
  () => { const g = new THREE.Group(); mk(BOX(1.6, .06, 1.0), sheetMat, 0, 0, 0, g); mk(BOX(.9, .07, .5), '#8d949c', .2, .005, .15, g, false); return g; },     // door 2
];
const SLAMS = [Wd('s3', 'amassa'), Wd('s3', 'portas'), Wd('s3', 'teto'), Wd('s3', 'capô'), Wd('s3b', 'batida'), Wd('s3b', 'toneladas')];
const formed = panelShapes.map((f, i) => { const g = f(); press.add(g); g.traverse(o => { o.castShadow = true; }); g.userData.i = i; return g; });
const rack = G(press); rack.position.set(4.6, 0, 1.6);
mk(BOX(.15, 2.6, 2.2), '#5b6470', -.9, TOP + 1.3, 0, rack); mk(BOX(2, .15, 2.2), '#5b6470', 0, TOP + .08, 0, rack);

// ---------- robots (s4-s6) ----------
const robots = [];
for (const [x, z] of [[3.1, 2.3], [-3.1, 2.3], [3.1, -2.3], [-3.1, -2.3]]) {
  const g = G(); g.position.set(x, TOP, z);
  mk(CYL(.5, .6, .4, 10), '#3b3f46', 0, .2, 0, g);
  const yaw = G(g); yaw.position.y = .4; mk(CYL(.42, .42, .4, 10), '#f08a3c', 0, .2, 0, yaw);
  const sh = G(yaw); sh.position.y = .55; mk(new THREE.SphereGeometry(.28, 10, 8), '#2c2f33', 0, 0, 0, sh);
  const ua = BOX(.3, 1.7, .3); ua.translate(0, .85, 0); mk(ua, '#f08a3c', 0, 0, 0, sh);
  const el = G(sh); el.position.y = 1.7; mk(new THREE.SphereGeometry(.22, 10, 8), '#2c2f33', 0, 0, 0, el);
  const fa = BOX(.22, 1.4, .22); fa.translate(0, .7, 0); mk(fa, '#f08a3c', 0, 0, 0, el);
  const tip = G(el); tip.position.y = 1.4; mk(new THREE.ConeGeometry(.12, .3, 8), '#2c2f33', 0, .1, 0, tip).rotation.x = Math.PI;
  const tipP = G(tip); tipP.position.y = .3;
  g.userData = { yaw, sh, el, tip, tipP, x, z, ph: robots.length * 1.7 };
  robots.push(g);
}
const sparkMat = new THREE.MeshBasicMaterial({ color: '#fff2a0' });
const sparks = []; const RS = rng(31);
for (let i = 0; i < 90; i++) sparks.push({ m: mk(BOX(.05, .05, .2), sparkMat, 0, -99, 0, scene, false), r: robots[i % 4], vx: RS() - .5, vy: RS() * .8 + .2, vz: RS() - .5, o: RS() });
const mistMats = [new THREE.MeshBasicMaterial({ color: '#f4f6f8', transparent: true, opacity: .55, depthWrite: false }), new THREE.MeshBasicMaterial({ color: '#9b6bff', transparent: true, opacity: .55, depthWrite: false })];
const mist = []; for (let i = 0; i < 70; i++) mist.push({ m: mk(new THREE.IcosahedronGeometry(.16, 0), mistMats[0], 0, -99, 0, scene, false), r: robots[i % 4], o: RS(), j: RS() });

// ---------- oven (s6b) ----------
const oven = G(); const ovenIn = M('#ff7a2a', { emissive: '#ff5a10', emissiveIntensity: .8 });
for (const z of [-2.0]) { mk(BOX(5.4, 4, .3), '#8e959e', 0, 2, z * 1.05, oven); mk(BOX(5.2, 3.8, .05), ovenIn, 0, 2, z * .97, oven, false); }
for (const x of [2.7, -2.7]) mk(BOX(.3, 4, 4.4), '#8e959e', x, 2, 0, oven);
for (const x of [2.55, -2.55]) mk(BOX(.04, 3.8, 4.0), ovenIn, x, 2, 0, oven, false);
mk(BOX(5.4, .3, 4.5), '#8e959e', 0, 4.0, 0, oven); mk(BOX(5.2, .05, 4.0), ovenIn, 0, 3.83, 0, oven, false);
for (let i = 0; i < 3; i++) mk(BOX(.4, .2, 4.0), M('#ffd23a', { emissive: '#ff9a20' }), -1.8 + i * 1.8, 3.72, 0, oven, false);
mk(BOX(5.6, .3, 4.4), '#f2c94c', 0, 4.1, 0, oven);
const heat = []; for (let i = 0; i < 30; i++) heat.push({ m: mk(new THREE.IcosahedronGeometry(.12, 0), M('#ffb15a', { emissive: '#ff8a20' }), 0, -99, 0, scene, false), o: RS(), x: RS() * 4.6 - 2.3, z: RS() * 3 - 1.5 });

// ---------- hanger (s7-s8) ----------
const hanger = G(); const HY = 'f2c94c';
mk(BOX(.3, 30, .3), '#f2c94c', 0, 17.3, 0, hanger);
mk(BOX(4.0, .25, .3), '#f2c94c', 0, 2.3, 0, hanger);
for (const x of [1.7, -1.7]) {
  mk(BOX(.2, .2, 2.7), '#f2c94c', x, 2.3, 0, hanger);
  for (const z of [1.25, -1.25]) mk(BOX(.18, 2.0, .18), '#f2c94c', x, 1.35, z, hanger);
  mk(BOX(.2, .16, 2.7), '#e0a800', x, .36, 0, hanger);
}

// ---------- hearts (s8) ----------
const hs = new THREE.Shape(); hs.moveTo(0, -.5); hs.bezierCurveTo(-.9, .1, -.45, .75, 0, .35); hs.bezierCurveTo(.45, .75, .9, .1, 0, -.5);
const heartGeo = new THREE.ExtrudeGeometry(hs, { depth: .15, bevelEnabled: false }); heartGeo.translate(0, 0, -.075);
const hearts = []; const RH = rng(88);
for (let i = 0; i < 16; i++) hearts.push({ m: mk(heartGeo, M('#ff2e63', { emissive: '#a0103a' }), 0, -99, 0, scene, false), x: (RH() - .5) * 4.5, z: (RH() - .5) * 2.4, d: RH() * .9, s: .5 + RH() * .5 });

// ---------- 30 mil peças: bolts swirling (s10) ----------
const bolts = []; const RBo = rng(64); const BCOL = ['#cfd3d8', '#9aa0a6', '#f2c94c', '#3d7fd6', '#d64545', '#2b2d33', '#7b2ff7'];
for (let i = 0; i < 260; i++) {
  const k = Math.floor(RBo() * 3); const geo = k === 0 ? BOX(.12, .12, .12) : k === 1 ? CYL(.05, .05, .22, 6) : new THREE.TorusGeometry(.08, .03, 4, 8);
  bolts.push({ m: mk(geo, BCOL[Math.floor(RBo() * BCOL.length)], 0, -99, 0, scene, false), a: RBo() * 6.28, r: 2.4 + RBo() * 3.4, y: .3 + RBo() * 4.2, sp: .6 + RBo() * .9, rx: RBo() * 6 });
}

// ---------- conveyor of finished cars (s10b) ----------
function quickCar(col) {
  const g = G(); const pm = M(col);
  mk(extrude(HULL, 1.8), pm, 0, 0, 0, g); mk(extrude(CAB, 1.64), pm, 0, 0, 0, g);
  for (const z of [.84, -.84]) mk(extrude([[-1.6, 1.2], [.9, 1.2], [.38, 1.86], [-1.06, 1.86]], .02), glassMat, 0, 0, z, g, false);
  for (const [x, z] of [[1.45, 1], [-1.45, 1], [1.45, -1], [-1.45, -1]]) { const w = mk(CYL(.45, .45, .32, 12), '#1d1f22', x, .45, z * .98, g); w.rotation.x = Math.PI / 2; }
  mk(BOX(.22, .26, 1.9), '#2b2d33', 2.4, .6, 0, g); mk(BOX(.22, .26, 1.9), '#2b2d33', -2.4, .62, 0, g);
  g.visible = false; return g;
}
const LINE_Z = -9.5;
const belt = mk(BOX(44, .3, 2.6), '#3b3f46', -6, TOP + .15, LINE_Z, scene);
const lineCars = ['#d64545', '#3d7fd6', '#f2f2f2', '#2f8f46', '#f2c94c', '#1d1f22', '#ff2e63', '#7b2ff7'].map(quickCar);

// ---------- Téo, the mechanic ----------
const SKIN = '#b9784a';
const teo = G(); teo.scale.setScalar(.92);
const tBody = G(teo);
for (const x of [.2, -.2]) { mk(BOX(.32, .8, .36), '#24427a', x, .42, 0, tBody); mk(BOX(.36, .16, .5), '#2a2a2a', x, .08, .06, tBody); }
mk(BOX(.98, .9, .58), '#2f6fd6', 0, 1.25, 0, tBody);
mk(BOX(.6, .3, .02), '#2f6fd6', 0, 1.55, .3, tBody);
mk(BOX(.3, .22, .03), '#f2c94c', .18, 1.2, .3, tBody);
mk(BOX(.7, .1, .6), '#f2f2f2', 0, 1.72, 0, tBody);
const arms = {};
for (const side of [1, -1]) { // +1 = his left (screen right when facing camera)
  const sh = G(tBody); sh.position.set(side * .6, 1.6, 0);
  const a = BOX(.26, .72, .28); a.translate(0, -.36, 0); mk(a, '#f2f2f2', 0, 0, 0, sh);
  const fa = BOX(.24, .1, .26); fa.translate(0, -.1, 0); mk(fa, '#2f6fd6', 0, -.15, 0, sh);
  mk(BOX(.24, .24, .24), SKIN, 0, -.84, 0, sh);
  arms[side] = sh;
}
// wrench in his right hand
const wr = G(arms[-1]); wr.position.set(0, -.9, .08); mk(BOX(.08, .5, .06), '#9aa0a6', 0, -.2, 0, wr); mk(BOX(.22, .12, .06), '#9aa0a6', 0, -.48, 0, wr);
const head = G(tBody); head.position.set(0, 1.78, 0);
mk(BOX(.2, .14, .2), SKIN, 0, .05, 0, head);
mk(BOX(1.0, .92, .88), SKIN, 0, .58, 0, head);
mk(BOX(1.04, .2, .92), '#2a1a12', 0, 1.0, -.02, head);
const eyes = [];
for (const x of [.22, -.22]) {
  const e = G(head); e.position.set(x, .66, .45);
  mk(new THREE.SphereGeometry(.12, 10, 8), '#ffffff', 0, 0, 0, e, false).scale.set(1, 1.15, .5);
  mk(new THREE.SphereGeometry(.065, 8, 6), '#141414', 0, 0, .05, e, false);
  eyes.push(e);
  const br = mk(BOX(.22, .05, .04), '#2a1a12', x, .84, .47, head, false); br.userData.x = x; eyes[eyes.length - 1].userData.brow = br;
}
mk(BOX(.12, .14, .1), '#a8693f', 0, .55, .47, head, false);
const mouth = mk(BOX(.3, .08, .04), '#5a1a1a', 0, .34, .445, head, false);
const cap = G(head); cap.position.y = 1.08;
mk(BOX(1.08, .28, .96), '#7b2ff7', 0, 0, 0, cap); mk(BOX(.9, .06, .45), '#5a1fc0', 0, -.12, .62, cap);
const tri = new THREE.Shape(); tri.moveTo(-.1, -.12); tri.lineTo(.14, 0); tri.lineTo(-.1, .12); tri.lineTo(-.1, -.12);
const triG = new THREE.ExtrudeGeometry(tri, { depth: .02, bevelEnabled: false });
mk(triG, M('#ffc93c', { emissive: '#6a4a00' }), 0, 0, .485, cap, false);

// char placement per line: [x, z] or null (off screen); gestures: wave | point | pat | thumbs | shrug | idle
const CHAR = {
  s1: [[0, 4.2], 'wave'], s2: [[-2.9, 3.1], 'point'], s3: [[-9.6, .6], 'point'], s3b: [null], s4: [[-5.2, 3.6], 'point'],
  s5: [[-3.4, 2.4], 'pat'], s6: [[-5.4, 4.2], 'point'], s6b: [null], s7: [[-3.6, 2.9], 'point'], s8: [[3.5, 2.6], 'point'], s8b: [[3.5, 2.6], 'shrug'],
  s9: [[-3.8, 3.0], 'point'], s10: [[-4.6, 4.2], 'wave'], s10b: [null], s11: [null], s12: [[-1.5, 3.4], 'wave'],
};

// ---------- labels ----------
const labs = [];
function label(text, pos, t0, t1, opts = {}) { const el = document.createElement('div'); el.className = 'lab' + (opts.big ? ' big' : ''); el.textContent = text; document.getElementById('labs').appendChild(el); labs.push({ el, pos, t0, t1, rot: opts.rot ?? -4, follow: opts.follow }); }
label('PROJETO', V(0, 2.9, 0), Wd('s2', 'projeto'), E('s2') + .2);
label('PRENSA', V(PR.x, 8.6, PR.z), Wd('s3', 'prensa'), Wd('s3', 'portas'));
label('AÇO', V(PR.x + 1, 1.8, PR.z + 1.2), Wd('s3', 'aço'), E('s3') + .2, { rot: 4 });
label('+1.000 TONELADAS', V(PR.x, 7.6, PR.z + 1), Wd('s3b', 'força'), E('s3b') + .3, { big: true });
label('ROBÔS', V(3.1, 4.2, 2.3), Wd('s4', 'robôs'), Wd('s4', 'quatro'));
label('4.000 SOLDAS', V(0, 3.2, 0), Wd('s4', 'quatro'), E('s4') + .3, { big: true });
label('CARROCERIA', V(0, 3, 0), Wd('s5', 'carroceria'), E('s5') + .2);
label('PINTURA', V(0, 3, 0), Wd('s6', 'pintura'), E('s6') + .1);
label('FORNO', V(0, 4.6, 0), Wd('s6b', 'forno'), E('s6b') + .2, { follow: 'oven' });
label('MOTOR', V(1.55, 1.6, 0), Wd('s7', 'motor'), E('s7') + .2);
label('CÂMBIO', V(.6, .4, 1.2), Wd('s7', 'câmbio'), E('s7') + .2, { rot: 4 });
label('CASAMENTO', V(0, 6.2, 0), Wd('s8', 'casamento'), E('s8b') - .4, { big: true });
label('RODAS', V(1.45, 1.4, 1.4), Wd('s9', 'rodas'), Wd('s9', 'bancos'));
label('BANCOS', V(-.4, 2.6, 1), Wd('s9', 'bancos'), Wd('s9', 'vidros'), { rot: 3 });
label('VIDROS', V(0, 2.7, 0), Wd('s9', 'vidros'), Wd('s9', 'faróis'));
label('FARÓIS', V(2.4, 1.6, .6), Wd('s9', 'faróis'), E('s9') + .3, { rot: 3 });
label('30.000 PEÇAS', V(0, 5.6, 0), Wd('s10', 'trinta'), E('s10') + .2, { big: true });
label('1 CARRO A CADA 1-2 MIN', V(-6, 4, LINE_Z), Wd('s10b', 'termina'), E('s10b') + .2);
label('TESTE', V(0, 3, 0), Wd('s11', 'teste'), E('s11'), { follow: 'car' });

// ---------- camera ----------
const cut = (t0, t1, p0, p1, l0, l1, ease = eio) => ({ t0, t1, p0: V(...p0), p1: V(...p1), l0: V(...l0), l1: V(...l1), ease });
const shots = [
  cut(0, S('s2'), [.4, 2.3, 10.5], [.2, 2.1, 8.6], [0, 1.6, 4], [0, 1.6, 4], eo),
  cut(S('s2'), S('s3'), [5.5, 3.0, 7.8], [3, 2.8, 8.4], [-.8, 1.2, 0], [-.6, 1.1, 0]),
  cut(S('s3'), S('s3b'), [-6.5, 4.2, 8], [-8, 3.6, 6.8], [-12.6, 3, -3], [-13, 2.8, -3]),
  cut(S('s3b'), S('s4'), [-11.2, 2.2, 6.5], [-12.2, 1.9, 5.4], [-13, 3.6, -3], [-13, 3.8, -3]),
  cut(S('s4'), S('s5'), [8, 6.5, 10], [6, 5.2, 9], [-.6, 1, 0], [-.4, 1, 0]),
  cut(S('s5'), S('s6'), [-6.5, 2.6, 9], [-2.5, 2.4, 10], [-.8, 1.2, 0], [-.6, 1.2, 0]),
  cut(S('s6'), S('s6b'), [6.5, 4.2, 8], [7.5, 3.6, 5], [-.5, 1, 0], [0, 1, 0]),
  cut(S('s6b'), S('s7'), [3.5, 3.6, 10], [1.5, 3.0, 9], [0, 1.7, 0], [0, 1.5, 0]),
  cut(S('s7'), S('s8'), [5, 1.0, 7], [4, 1.5, 6.2], [-.4, 1.8, 0], [-.4, 1.9, 0]),
  cut(S('s8'), S('s8b'), [-5, 2.4, 8], [-4, 3.0, 7.2], [.4, 2.0, 0], [.4, 1.8, 0]),
  cut(S('s8b'), S('s9'), [4.6, 2.3, 8.6], [4.3, 2.1, 7.8], [3.0, 1.7, 2.4], [3.0, 1.7, 2.4]),
  cut(S('s9'), S('s10'), [6.5, 3.0, 7.5], [4.8, 2.6, 8], [-.6, 1, 0], [-.4, 1, 0]),
  cut(S('s10'), S('s10b'), [0, 6.5, 13], [2.5, 7.5, 13.5], [-.5, 2, 0], [-.3, 2.2, 0]),
  cut(S('s10b'), S('s11'), [2, 9, 14], [-3, 13, 19], [-4, 1, -6], [-5, 1, -7]),
  cut(S('s11'), S('s12'), [7.8, 1.9, 6.8], [7.1, 1.7, 6.1], [.6, 1.1, .5], [.6, 1.1, .5]),
];
// s12: tracking shot following the car
const DRIVE = Wd('s12', 'anda') - .15;
const carX = t => { if (t < DRIVE) return 0; const d = t - DRIVE; return d < 1.4 ? 3.2 * d * d : 3.2 * 1.96 + 8.96 * (d - 1.4) + 1.5 * (d - 1.4) ** 2; };
function camAt(t) {
  if (t >= S('s12')) {
    const x = carX(t), u = P(t, S('s12'), E('s12') + .8);
    const endWide = eio(P(t, Wd('s12', 'desenho') - .3, DUR));
    camera.position.set(lerp(x - 3.5, 30, endWide) + lerp(4, 0, eio(P(t, S('s12'), DRIVE + 1))), lerp(1.7, 6, endWide), lerp(6.8, 16, endWide));
    camera.lookAt(x + lerp(1.5, 0, endWide), lerp(1, 1, endWide), 0);
    return;
  }
  let s = shots[0]; for (const x of shots) if (t >= x.t0) s = x;
  const u = s.ease(P(t, s.t0, s.t1));
  camera.position.copy(s.p0).lerp(s.p1, u);
  const look = s.l0.clone().lerp(s.l1, u);
  camera.position.x += Math.sin(t * .9) * .08; camera.position.y += Math.sin(t * 1.3 + 1) * .06;
  let shake = 0;
  for (const T of SLAMS) shake += Math.max(0, 1 - Math.abs(t - T - .03) / .25) * (T >= S('s3b') ? .22 : .12);
  shake += Math.max(0, 1 - Math.abs(t - Wd('s8', 'encaixa') - .1) / .3) * .12;
  shake += win(t, Wd('s11', 'liga'), S('s12') + .2, .1) * .03;
  if (shake) { camera.position.x += Math.sin(t * 61) * shake; camera.position.y += Math.sin(t * 47 + 2) * shake; }
  camera.lookAt(look);
}

// ---------- per-frame state ----------
const capEl = document.getElementById('cap'), flashEl = document.getElementById('flash');
const tmp = V(0, 0, 0);
function place(o, dx = 0, dy = 0, dz = 0) { const h = o.userData.home; o.position.set(h.x + dx, h.y + dy, h.z + dz); }

function setState(t) {
  for (const c of clouds) c.g.position.x = c.x0 + t * .8;

  // ---- hologram s2
  const hp = P(t, S('s2') + .05, Wd('s2', 'computador') + .2);
  const hOn = t > S('s2') - .05 && t < S('s3') + .05;
  holo.visible = hOn;
  holoTubes.forEach((h, i) => { const v = cl((hp * 1.15 - i / holoTubes.length) * 12); h.m.scale.set(1, Math.max(v, .001), 1); h.m.visible = v > .003; });
  projGlow.material.color.setHSL(.53, 1, .62 + .1 * Math.sin(t * 9));
  beam.material.opacity = .1 + .04 * Math.sin(t * 7);

  // ---- press s3 / s3b
  let hit = 0; for (const T of SLAMS) hit = Math.max(hit, t >= T - .14 && t <= T ? eo(P(t, T - .14, T)) : t > T && t < T + .7 ? 1 - eio(P(t, T, T + .7)) : 0);
  ram.position.y = lerp(RAM_UP, RAM_DN, hit);
  const pressOn = t > S('s3') - .1 && t < S('s4') + .1; press.visible = pressOn;
  // sheet sequence: before slam k the flat sheet slides in; after the slam it turns into formed panel k, which goes to the rack
  let k = -1; for (let i = 0; i < 4; i++) if (t >= SLAMS[i]) k = i;
  const nextT = k < 3 ? SLAMS[k + 1] : SLAMS[4];
  const sIn = k < 0 ? eo(P(t, S('s3'), S('s3') + .4)) : eo(P(t, SLAMS[k] + .5, Math.min(nextT - .05, SLAMS[k] + .9)));
  sheet.visible = k < 3 || t < SLAMS[4] + .02; sheet.position.x = lerp(-4.5, 0, sIn); sheet.position.y = TOP + 1.03;
  if (k >= 0 && k < 3 && t < SLAMS[k] + .5) sheet.visible = false;
  if (k === 3 && t > SLAMS[3]) sheet.visible = t > SLAMS[3] + .5;
  formed.forEach((f, i) => {
    if (t < SLAMS[i]) { f.visible = false; return; }
    f.visible = true; const u = eio(P(t, SLAMS[i] + .35, SLAMS[i] + .9));
    f.position.set(lerp(0, 4.0, u), lerp(TOP + 1.07, TOP + .5 + i * .55, u) + Math.sin(u * Math.PI) * 1.2, lerp(0, 1.6, u));
    f.rotation.set(0, 0, lerp(0, .35, u));
  });
  flashEl.style.opacity = Math.max(...SLAMS.slice(4).map(T => Math.max(0, .55 - Math.abs(t - T) / .2)), Math.max(0, .5 - Math.abs(t - Wd('s8', 'encaixa')) / .25), 0).toFixed(3);

  // ---- car body assembly s4
  const A0 = S('s4') - .2, A1 = Wd('s4', 'quatro');
  const seqT = (i, n) => A0 + (A1 - A0) * i / n;
  const fly = [[hull, V(0, 9, 0)], [cabin, V(0, 10, 0)], [roof, V(0, 7, 0)], [hood, V(5, 4, 0)], [trunk, V(-5, 4, 0)], [doors[0].g, V(0, 1, 6)], [doors[1].g, V(0, 1, 6)], [doors[2].g, V(0, 1, -6)], [doors[3].g, V(0, 1, -6)]];
  fly.forEach(([o, d], i) => { const a = seqT(i, fly.length); const u = eo(P(t, a, a + .45)); o.userData.off = V(d.x * (1 - u), d.y * (1 - u), d.z * (1 - u)); o.visible = t >= a; });
  // body is visible from s4; skid under it until the hanger takes it
  skid.visible = t > A0 && t < Wd('s7', 'isso') + .6;

  // ---- robots
  const rUp = pop(t, S('s4') - .5, .5) * (1 - eio(P(t, S('s6b') - .1, S('s6b') + .5)));
  const weld = t > A0 && t < E('s5') - .2, spray = t > S('s6') && t < E('s6') + .1;
  robots.forEach(r => {
    const d = r.userData; r.visible = rUp > .003; r.scale.setScalar(Math.max(rUp, .001));
    d.yaw.rotation.y = Math.atan2(-d.x, -d.z) + Math.PI + Math.sin(t * 1.7 + d.ph) * (weld || spray ? .35 : .05);
    // y-up arm: rotate around x after yaw so it leans toward the car
    d.yaw.rotation.y = Math.atan2(-d.x, -d.z);
    const act = weld || spray ? 1 : 0;
    d.sh.rotation.x = .55 + act * (.25 + .15 * Math.sin(t * 2.3 + d.ph));
    d.el.rotation.x = .9 + act * (.35 * Math.sin(t * 1.9 + d.ph * 2));
    d.yaw.rotation.y += act * .35 * Math.sin(t * 1.3 + d.ph);
  });
  scene.updateMatrixWorld();
  sparks.forEach(s => {
    const on = t > A0 + .3 && t < E('s4') + .4 && s.r.visible;
    if (!on) { s.m.position.y = -99; return; }
    const u = ((t * 2.2) + s.o) % 1; s.r.userData.tipP.getWorldPosition(tmp);
    s.m.position.set(tmp.x + s.vx * u * 1.6, tmp.y + s.vy * u * 1.4 - u * u * 1.6, tmp.z + s.vz * u * 1.6);
    s.m.rotation.set(s.vx * 3, s.vz * 3, 0); s.m.scale.setScalar(1 - u * .7);
  });
  const sprayB = t > Wd('s6', 'camadas') - .1;
  mist.forEach(s => {
    if (!spray || !s.r.visible) { s.m.position.y = -99; return; }
    s.m.material = mistMats[sprayB ? 1 : 0];
    const u = ((t * 1.6) + s.o) % 1; s.r.userData.tipP.getWorldPosition(tmp);
    const dir = V(-tmp.x, 1.1 - tmp.y, -tmp.z).normalize();
    s.m.position.set(tmp.x + dir.x * u * 2 + (s.j - .5) * u, tmp.y + dir.y * u * 2 + (s.o - .5) * u * .6, tmp.z + dir.z * u * 2);
    s.m.scale.setScalar(.5 + u * 1.6);
  });

  // ---- paint sweeps (s6), oven heat (s6b), shine
  PU.uA.value = t > S('s7') ? 99 : lerp(-3, 3.2, eio(P(t, Wd('s6', 'pintura') - .2, Wd('s6', 'camadas') - .1)));
  PU.uB.value = t > S('s7') ? 99 : lerp(-3, 3.2, eio(P(t, Wd('s6', 'camadas') - .1, E('s6') + .2)));
  const ovX = 0; const ovY = 9 * (1 - eo(P(t, S('s6b') - .4, Wd('s6b', 'forno') + .1))) + 9 * eio(P(t, E('s6b') - .2, E('s6b') + .4));
  oven.visible = t > S('s6b') - .4 && t < E('s6b') + .4; oven.position.set(0, TOP + ovY, 0);
  PU.uHeat.value = .35 * cl(1 - ovY / 2) * (oven.visible ? 1 : 0) * (.8 + .2 * Math.sin(t * 9));
  ovenIn.emissiveIntensity = .7 + .2 * Math.sin(t * 13);
  heat.forEach(h => { if (!oven.visible) { h.m.position.y = -99; return; } const u = (t * .8 + h.o) % 1; h.m.position.set(h.x, .6 + u * 3.2 + ovY, h.z); h.m.scale.setScalar(1 - u); });
  const shineT = P(t, E('s6b') - .1, S('s7') + .9);
  PU.uS.value = lerp(-4, 4, shineT); PU.uShine.value = shineT > 0 && shineT < 1 ? 1 : 0;
  // shine again at the end of the build (s9) and at the test
  const sh2 = P(t, E('s9') - .4, E('s9') + .5); if (sh2 > 0 && sh2 < 1) { PU.uS.value = lerp(-4, 4, sh2); PU.uShine.value = 1; }

  // ---- s7/s8: hanger lifts the body, powertrain below, marriage
  const hangDown = eo(P(t, S('s7') - .2, S('s7') + .5));
  const lift = eio(P(t, S('s7') + .55, Wd('s7', 'embaixo') + .2));
  const lower = P(t, Wd('s8', 'desce') - .1, Wd('s8', 'encaixa') + .05);
  const bodyY = 3.6 * lift * (1 - eio(lower)) + (lower > 0 && lower < 1 ? 0 : 0);
  bodyG.position.y = bodyY;
  const hangUp = eio(P(t, E('s8') - .1, S('s8b') + .9));
  hanger.visible = t > S('s7') - .2 && t < S('s8b') + 1;
  hanger.position.set(car.position.x, bodyY + 14 * (1 - hangDown) + 14 * hangUp, 0);
  const ptOn = (a) => Math.max(pop(t, a, .4), .001);
  rails.forEach(r => { r.scale.setScalar(ptOn(Wd('s7', 'montam') - .5)); });
  axles.forEach(a => a.scale.setScalar(ptOn(Wd('s7', 'montam') - .3)));
  exhaust.scale.setScalar(ptOn(Wd('s7', 'montam') - .1));
  const eD = eo(P(t, Wd('s7', 'motor') - .25, Wd('s7', 'motor') + .3));
  engine.userData.drop = (1 - eD) * 4; engine.visible = t > Wd('s7', 'motor') - .25;
  const gD = eo(P(t, Wd('s7', 'câmbio') - .25, Wd('s7', 'câmbio') + .3));
  gearbox.userData.drop = (1 - gD) * 4; gearbox.visible = t > Wd('s7', 'câmbio') - .25;
  const running = (t > Wd('s7', 'motor') + .3 && t < S('s8b')) || t > Wd('s11', 'liga');
  pistons.forEach((p, i) => { p.position.y = .45 + (running ? .07 * Math.sin(t * 28 + i * Math.PI / 2) : 0); });

  // ---- s9: wheels, seats, glass, lights
  const w0 = Wd('s9', 'rodas') - .25;
  wheels.forEach((w, i) => {
    const a = w0 + i * .13, u = eo(P(t, a, a + .5));
    w.g.userData.off = V(0, 0, w.z * 5 * (1 - u)); w.g.visible = t > a;
    w.spin.rotation.z = (1 - u) * 8 * w.z;
  });
  bumpers.forEach((b, i) => { b.userData.off = V(0, 3 * (1 - eo(P(t, w0 - .3 + i * .1, w0 + .2 + i * .1))), 0); b.visible = t > w0 - .3; });
  const bA = Wd('s9', 'bancos') - .3, bB = Wd('s9', 'vidros') - .05;
  const doorOpen = win(t, bA, bB + .15, .25);
  doors.forEach(d => { d.g.rotation.y = d.z * 1.15 * doorOpen; });
  seats.forEach((s, i) => { const a = bA + .15 + i * .07, u = eio(P(t, a, a + .45)); s.g.userData.off = V(0, 2.2 * (1 - u) * (1 - u) * 1.5, s.z * 4 * (1 - u)); s.g.visible = t > a; });
  const gA = Wd('s9', 'vidros') - .1;
  glass.forEach((g, i) => { const s = pop(t, gA + i * .08, .3); g.userData.sc = Math.max(s, .001); g.visible = t > gA + i * .08; });
  const fA = Wd('s9', 'faróis') - .1;
  [...heads, ...tails, grille].forEach((h, i) => { h.userData.sc = Math.max(pop(t, fA + (i % 2) * .06, .3), .001); h.visible = t > fA; });
  const lightsOn = cl(P(t, fA + .2, fA + .35)) * (1 - win(t, E('s9') + .3, S('s11'), .2) * .7);
  const test = t > Wd('s11', 'liga') ? 1 + .6 * Math.max(0, Math.sin((t - Wd('s11', 'liga')) * 18)) : 1;
  headMat.emissiveIntensity = lightsOn * 1.2 * test; tailMat.emissiveIntensity = lightsOn * .8;

  // ---- s10 exploded view
  const ex = eio(P(t, Wd('s10', 'total') - .2, Wd('s10', 'trinta'))) * (1 - eio(P(t, E('s10') + .1, S('s10b') + .6)));
  for (const p of parts) {
    const off = p.userData.off || V(0, 0, 0); const dr = p.userData.drop || 0;
    place(p, off.x + p.userData.ex.x * ex, off.y + dr + p.userData.ex.y * ex + (ex ? Math.sin(t * 2 + p.userData.home.x) * .08 * ex : 0), off.z + p.userData.ex.z * ex);
    const sc = p.userData.sc ?? 1; if (p.userData.sc !== undefined) p.scale.setScalar(sc);
    if (ex > 0) p.rotation.set(p.userData.hrot.x + Math.sin(p.userData.home.x * 3) * .3 * ex, p.userData.hrot.y + .4 * ex * Math.sin(p.userData.home.z * 4 + 1), p.userData.hrot.z + Math.cos(p.userData.home.x * 2) * .2 * ex);
    else if (!doors.some(d => d.g === p)) p.rotation.copy(p.userData.hrot);
  }
  bolts.forEach(b => {
    const s = win(t, Wd('s10', 'trinta') - .3, S('s10b') + .3, .4); if (s <= 0) { b.m.position.y = -99; return; }
    const a = b.a + t * b.sp; b.m.position.set(Math.cos(a) * b.r * s, b.y + Math.sin(t * 2 + b.a) * .3, Math.sin(a) * b.r * .7 * s); b.m.rotation.set(b.rx + t * 3, t * 2, 0); b.m.scale.setScalar(s);
  });

  // ---- s10b conveyor
  const lOn = t > S('s10b') - .1 && t < S('s11');
  belt.visible = true;
  lineCars.forEach((c, i) => { c.visible = lOn; c.position.set(-30 + ((i * 6 + (t - S('s10b')) * 4.5) % 48), TOP + .3, LINE_Z); });

  // ---- hearts s8
  const hT = Wd('s8', 'encaixa');
  hearts.forEach(h => { const u = P(t, hT + h.d * .4, hT + 2.4 + h.d); if (u <= 0 || u >= 1) { h.m.position.y = -99; return; } h.m.position.set(h.x * (1 + u * .6), 2.2 + u * 4, h.z); h.m.scale.setScalar(h.s * Math.min(1, u * 6) * (1 - u * .4)); h.m.rotation.y = Math.sin(t * 3 + h.x) * .6; });

  // ---- s11/s12 test + drive
  const idleShake = t > Wd('s11', 'liga') && t < DRIVE + .5 ? .012 * Math.sin(t * 70) : 0;
  car.position.set(carX(t), idleShake, 0);
  const dist = carX(t);
  wheels.forEach(w => { if (t > DRIVE) w.spin.rotation.z = -dist / .45; });
  sun.position.set(18 + car.position.x, 40, 26); sun.target.position.set(car.position.x, 0, 0);

  // ---- Téo
  charAt(t);

  camAt(t);
  sky.position.copy(camera.position);
}

let curLine = 'S1';
function lineAt(t) { let id = NARR.lines[0].id; for (const l of NARR.lines) if (t >= l.start - .25) id = l.id; return id; }
function charAt(t) {
  const id = lineAt(t); const [pos, gest] = CHAR[id];
  if (!pos) { teo.visible = false; return; }
  teo.visible = true; teo.position.set(pos[0], TOP, pos[1]);
  // face the camera (yaw only), a bit turned toward the car
  camAt(t);
  const yaw = Math.atan2(camera.position.x - pos[0], camera.position.z - pos[1]);
  teo.rotation.y = yaw;
  const a = ampAt(t); const talking = a > .05;
  mouth.scale.set(1 - a * .2, .5 + a * 3.2, 1); mouth.position.y = .34 - a * .05;
  head.rotation.x = -.05 + a * .08 * Math.sin(t * 9); head.rotation.z = .06 * Math.sin(t * 1.7); head.rotation.y = .08 * Math.sin(t * 1.1);
  tBody.position.y = .02 * Math.sin(t * 4); tBody.rotation.z = .02 * Math.sin(t * 2);
  // blink
  const bp = (t + .4) % 3.3; const bl = bp < .14 ? 1 - Math.sin(bp / .14 * Math.PI) : 1;
  eyes.forEach(e => { e.scale.y = Math.max(bl, .08); e.userData.brow.position.y = .84 + (talking ? .03 * Math.sin(t * 6) : 0) + (gest === 'shrug' ? .05 : 0); });
  // which side is the car on screen? point that way
  const cv = V(car.position.x, 1, 0).project(camera), tv = V(pos[0], 1.5, pos[1]).project(camera);
  const side = cv.x > tv.x ? 1 : -1;
  const l0 = L[id].start - .25, k = eo(P(t, l0, l0 + .35));
  let rl = 0, rr = 0, xl = 0, xr = 0;
  const sw = Math.sin(t * 3) * .05;
  if (gest === 'wave') { rr = -2.6 + .35 * Math.sin(t * 9); rl = .1 + sw; }
  else if (gest === 'point') { if (side > 0) { rl = 1.75 + .08 * Math.sin(t * 2.5); xl = -.25; rr = -.15 + sw; } else { rr = -1.75 - .08 * Math.sin(t * 2.5); xr = -.25; rl = .15 + sw; } }
  else if (gest === 'pat') { if (side > 0) { rl = 1.2 + .15 * Math.abs(Math.sin(t * 6)); } else { rr = -1.2 - .15 * Math.abs(Math.sin(t * 6)); } }
  else if (gest === 'thumbs') { rr = -.3; xr = -1.6 + .05 * Math.sin(t * 5); rl = .15 + sw; }
  else if (gest === 'shrug') { rl = .7 + .1 * Math.sin(t * 4); rr = -.7 - .1 * Math.sin(t * 4); xl = -.6; xr = -.6; tBody.position.y += .04 * Math.abs(Math.sin(t * 5)); }
  else { rl = .12 + sw; rr = -.12 - sw; }
  arms[1].rotation.set(xl * k, 0, lerp(.1, rl, k)); arms[-1].rotation.set(xr * k, 0, lerp(-.1, rr, k));
}

// ---------- captions: one phrase at a time, held, soft fade ----------
const chunks = [];
for (const l of NARR.lines) {
  let cur = [];
  const flush = () => { if (cur.length) chunks.push(cur), cur = []; };
  l.words.forEach((w, i) => {
    cur.push(w); const raw = l.text.split(/\s+/)[i] || '';
    if (/[.,:!?]$/.test(raw) && cur.length >= 2 || cur.length >= 4) flush();
  });
  flush();
}
// merge a lonely trailing word into the previous chunk of the same line
const caps = chunks.map((c, i) => ({ words: c, start: c[0].start - .05 }));
caps.forEach((c, i) => { const nx = caps[i + 1]; c.end = nx && nx.start - c.words[c.words.length - 1].end < .6 ? nx.start : c.words[c.words.length - 1].end + .35; });
function uiAt(t) {
  let cur = null; for (const c of caps) if (t >= c.start && t < c.end) cur = c;
  if (cur) {
    const html = cur.words.map(w => `<span class="${w.hl ? 'y' : ''}">${w.w}</span>`).join(' ');
    if (capEl.dataset.k !== String(cur.start)) { capEl.innerHTML = html; capEl.dataset.k = String(cur.start); }
    const fi = eo(P(t, cur.start, cur.start + .22)), fo = 1 - P(t, cur.end - .12, cur.end);
    capEl.style.opacity = Math.min(fi, fo).toFixed(3);
    capEl.style.transform = `translateY(${((1 - fi) * 26).toFixed(1)}px)`;
  } else capEl.style.opacity = '0';
  camera.updateMatrixWorld();
  for (const l of labs) {
    if (t < l.t0 || t > l.t1) { l.el.style.display = 'none'; continue; }
    const p = l.pos.clone(); if (l.follow === 'oven') p.x += oven.position.x * 0; if (l.follow === 'car') p.x += car.position.x;
    const v = p.project(camera);
    if (v.z > 1) { l.el.style.display = 'none'; continue; }
    const s = pop(t, l.t0, .35) * (1 - ei(P(t, l.t1 - .18, l.t1)));
    const x = (v.x + 1) / 2 * W, y = (1 - v.y) / 2 * H;
    l.el.style.display = 'block';
    const lw = l.el.offsetWidth, lh = l.el.offsetHeight;
    const x2 = cl(x, lw / 2 + 50, W - lw / 2 - 150), y2 = cl(y, 230, 1040);
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
