// Tratamento de água v2 — "A jornada da Gota". Low-poly 3D explainer with its own world (mountain valley at golden
// morning), a drop character, diorama sets, whip/dive transitions and post-processing.
// Everything is a pure function of time t (seconds); render.js steps frame by frame. Timing from narracao.json.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { VignetteShader } from 'three/addons/shaders/VignetteShader.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const NARR = await (await fetch('./narracao.json')).json();
const L = Object.fromEntries(NARR.lines.map(l => [l.id, l]));
const S = id => L[id].start;
const E = id => L[id].end;
const Wd = (id, w, n = 0) => { const ws = L[id].words.filter(x => x.w.toLowerCase().startsWith(w)); return (ws[n] || ws[0]).start; };
const DUR = NARR.duration;

// ---------- math ----------
const cl = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const P = (t, a, b) => cl((t - a) / (b - a));
const eo = x => 1 - Math.pow(1 - x, 3);
const ei = x => x * x * x;
const eio = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const back = x => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
const elastic = x => x <= 0 ? 0 : x >= 1 ? 1 : Math.pow(2, -9 * x) * Math.sin((x * 10 - .75) * 2.0944) + 1;
const lerp = (a, b, x) => a + (b - a) * x;
const pop = (t, a, d = .4) => t < a ? 0 : back(P(t, a, a + d));
const bounce = (t, a, d = .6) => t < a ? 0 : elastic(P(t, a, a + d));
const win = (t, a, b, f = .3) => t < a || t > b ? 0 : Math.min(eo(P(t, a, a + f)), 1 - ei(P(t, b - f, b)));
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let x = Math.imul(seed ^ seed >>> 15, 1 | seed); x = x + Math.imul(x ^ x >>> 7, 61 | x) ^ x; return ((x ^ x >>> 14) >>> 0) / 4294967296; }; }
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;
function hash2(i, j) { let h = Math.imul(i, 374761393) + Math.imul(j, 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
function vnoise(x, z) { const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j; const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz); return lerp(lerp(hash2(i, j), hash2(i + 1, j), sx), lerp(hash2(i, j + 1), hash2(i + 1, j + 1), sx), sz); }
function fbm(x, z) { let s = 0, a = .5, f = 1; for (let k = 0; k < 4; k++) { s += a * vnoise(x * f, z * f); a *= .5; f *= 2.03; } return s; }
const sstep = (a, b, x) => { const u = cl((x - a) / (b - a)); return u * u * (3 - 2 * u); };

// ---------- renderer / post ----------
const W = 1080, H = 1920;
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('c'), antialias: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, W / H, .1, 3000);
const rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4 });
const composer = new EffectComposer(renderer, rt);
composer.setPixelRatio(1); composer.setSize(W, H);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(W / 2, H / 2), .42, .55, .88); composer.addPass(bloom);
const blurPass = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, amount: { value: 0 }, dir: { value: new THREE.Vector2(1, 0) } },
  vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader: `uniform sampler2D tDiffuse;uniform float amount;uniform vec2 dir;varying vec2 vUv;
  void main(){ if(amount<.001){gl_FragColor=texture2D(tDiffuse,vUv);return;} vec4 c=vec4(0.);float tw=0.;
    for(int i=-8;i<=8;i++){float f=float(i)/8.;float w=1.-abs(f)*.6;c+=texture2D(tDiffuse,vUv+dir*f*amount)*w;tw+=w;}
    gl_FragColor=c/tw;}`
}); composer.addPass(blurPass);
const vig = new ShaderPass(VignetteShader); vig.uniforms.offset.value = .95; vig.uniforms.darkness.value = 1.15; composer.addPass(vig);
composer.addPass(new OutputPass());

// ---------- sky / light ----------
const skyU = { top: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, sunDir: { value: V(.55, .28, -.78).normalize() }, sunCol: { value: new THREE.Color('#ffcf9a') }, sunAmt: { value: 1 } };
const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), new THREE.ShaderMaterial({
  uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false,
  vertexShader: `varying vec3 vp;void main(){vp=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader: `uniform vec3 top;uniform vec3 hor;uniform vec3 sunDir;uniform vec3 sunCol;uniform float sunAmt;varying vec3 vp;
  void main(){float h=clamp(vp.y*1.25,0.,1.);vec3 c=mix(hor,top,pow(h,.5));float s=max(dot(normalize(vp),sunDir),0.);
  c+=sunCol*(pow(s,700.)*6.+pow(s,24.)*.35)*sunAmt;gl_FragColor=vec4(c,1.);}`
}));
scene.add(sky);
scene.fog = new THREE.Fog(new THREE.Color('#f3cfa6'), 70, 420);
const hemi = new THREE.HemisphereLight('#d6e6ff', '#8a7350', 1.25); scene.add(hemi);
const sun = new THREE.DirectionalLight('#ffd2a1', 3.0); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -36, right: 36, top: 36, bottom: -36, near: 1, far: 220 });
sun.shadow.bias = -.0005; sun.shadow.normalBias = .04; scene.add(sun); scene.add(sun.target);
const SUN_OFF = V(55, 48, 30);
function aimSun(p) { sun.position.copy(p).add(SUN_OFF); sun.target.position.copy(p); sun.target.updateMatrixWorld(); }
const camLight = new THREE.PointLight('#bff6ff', 0, 30, 1.6); scene.add(camLight);

// ---------- builders ----------
const matCache = {};
const M = (c, o = {}) => { const k = c + JSON.stringify(o); return matCache[k] || (matCache[k] = new THREE.MeshStandardMaterial({ color: c, roughness: .82, metalness: 0, flatShading: true, ...o })); };
const SM = (c, o = {}) => M(c, { flatShading: false, roughness: .45, ...o });
function mk(geo, mat, x = 0, y = 0, z = 0, parent = scene, shadow = true) {
  const m = new THREE.Mesh(geo, typeof mat === 'string' ? M(mat) : mat);
  m.position.set(x, y, z); m.castShadow = shadow; m.receiveShadow = true; parent.add(m); return m;
}
const G = (parent = scene) => { const g = new THREE.Group(); parent.add(g); return g; };
const BOX = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const RBOX = (w, h, d, r = .25) => new RoundedBoxGeometry(w, h, d, 3, r);
const CYL = (rt, rb, h, s = 16, open = false) => new THREE.CylinderGeometry(rt, rb, h, s, 1, open);
function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; return tx; }
const softDot = canvasTex(64, 64, (g, w, h) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.45, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
const rayTex = canvasTex(64, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,250,220,.9)'); gr.addColorStop(1, 'rgba(255,250,220,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); const gx = g.createLinearGradient(0, 0, w, 0); gx.addColorStop(0, 'rgba(0,0,0,1)'); gx.addColorStop(.5, 'rgba(0,0,0,0)'); gx.addColorStop(1, 'rgba(0,0,0,1)'); g.globalCompositeOperation = 'destination-out'; g.fillStyle = gx; g.fillRect(0, 0, w, h); });

// ===================================================================================== WORLD
const world = G();
const rx = z => 36 + 7 * Math.sin(z / 22) + 3 * Math.sin(z / 9 + 1);
const HILL = V(-30, 0, -27);
function heightAt(x, z) {
  let h = (fbm(x / 34 + 10, z / 34) - .5) * 7;
  h += 15 * Math.exp(-((x - HILL.x) ** 2 + (z - HILL.z) ** 2) / 300);
  const r = Math.hypot(x, z); h += Math.max(0, r - 95) * .22;
  h = lerp(0, h, sstep(21, 32, Math.hypot(x - 2, z - 1)));                       // station pad
  const tw = sstep(14, 26, Math.hypot((x + 42) * .9, z - 22));                   // town: gentle slope
  h = lerp(.4 + (22 - z) * .05 + (x + 42) * -.03, h, tw);
  const dr = Math.abs(x - rx(z)); h = lerp(-1.7, h, sstep(4.2, 9, dr));          // river channel
  return h;
}
HILL.y = heightAt(HILL.x, HILL.z);
{ // terrain
  const g = new THREE.PlaneGeometry(440, 440, 150, 150); g.rotateX(-Math.PI / 2);
  const p = g.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, heightAt(p.getX(i), p.getZ(i)));
  const ng = g.toNonIndexed(); const q = ng.attributes.position; const cols = new Float32Array(q.count * 3); const c = new THREE.Color();
  const GR = ['#b4cf63', '#a6c75a', '#bfd66e', '#9fc157'].map(x => new THREE.Color(x));
  for (let f = 0; f < q.count; f += 3) {
    const y = (q.getY(f) + q.getY(f + 1) + q.getY(f + 2)) / 3, x = (q.getX(f) + q.getX(f + 1) + q.getX(f + 2)) / 3, z = (q.getZ(f) + q.getZ(f + 1) + q.getZ(f + 2)) / 3;
    const n = hash2(Math.floor(x * 3.1), Math.floor(z * 2.7));
    c.copy(GR[Math.floor(n * 4)]);
    if (y < -.9) c.set('#a88456');
    else if (y < -.3) c.set('#c3b06c');
    const dr = Math.abs(x - rx(z)); if (dr > 9 && Math.hypot(x, z) > 120) c.lerp(new THREE.Color('#8fa85a'), .5);
    if (y > 9) c.lerp(new THREE.Color('#d9c68a'), cl((y - 9) / 10) * .6);
    for (let k = 0; k < 3; k++) cols.set([c.r, c.g, c.b], (f + k) * 3);
  }
  ng.setAttribute('color', new THREE.BufferAttribute(cols, 3)); ng.computeVertexNormals();
  const m = new THREE.Mesh(ng, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .95 })); m.receiveShadow = true; world.add(m);
}
// river water (animated vertices)
const RW_NU = 8, RW_NZ = 240;
const riverGeo = new THREE.PlaneGeometry(1, 1, RW_NU, RW_NZ);
const riverMat = new THREE.MeshStandardMaterial({ color: '#9b7346', roughness: .3, metalness: .05, flatShading: true });
const river = new THREE.Mesh(riverGeo, riverMat); river.receiveShadow = true; world.add(river);
function updRiver(t) {
  const p = riverGeo.attributes.position;
  for (let j = 0; j <= RW_NZ; j++) for (let i = 0; i <= RW_NU; i++) {
    const k = j * (RW_NU + 1) + i, u = i / RW_NU * 2 - 1, z = -220 + j / RW_NZ * 440;
    p.setXYZ(k, rx(z) + u * 5.4, -.62 + .08 * Math.sin(z * .7 - t * 2.6 + u * 2.2) + .05 * Math.sin(z * 1.7 + t * 3.3 + u * 5), z);
  }
  p.needsUpdate = true; riverGeo.computeVertexNormals();
}
const mudSwirl = []; { const r = rng(4); for (let i = 0; i < 46; i++) { const m = mk(new THREE.CylinderGeometry(.5 + r() * .9, .5, .04, 7), M(r() < .5 ? '#7a5530' : '#b28c5a', { transparent: true, opacity: .8 }), 0, -.5, 0, world, false); mudSwirl.push({ m, z0: r() * 90, u: r() * 1.6 - .8, ph: r() * 6 }); } }
// mountains
{ const r = rng(17);
  for (let i = 0; i < 13; i++) {
    const a = -Math.PI * .95 + i / 12 * Math.PI * 1.25 + (r() - .5) * .2, R = 230 + r() * 50;
    const h = 70 + r() * 70, rad = 45 + r() * 30;
    const geo = new THREE.ConeGeometry(rad, h, 7, 4); const p = geo.attributes.position;
    for (let k = 0; k < p.count; k++) { const y = p.getY(k); if (y < h / 2 - .1) { p.setX(k, p.getX(k) * (1 + (r() - .5) * .25)); p.setZ(k, p.getZ(k) * (1 + (r() - .5) * .25)); p.setY(k, y + (r() - .5) * 4); } }
    geo.computeVertexNormals();
    const m = mk(geo, M(i % 2 ? '#8b8fc4' : '#9a93c6'), Math.sin(a) * R, h / 2 - 8, -Math.cos(a) * R, world, false);
    const cap = mk(new THREE.ConeGeometry(rad * .34, h * .34, 7, 1), M('#f5f3ff'), 0, h * .34, 0, m, false); cap.position.y = h / 2 - h * .17 + .5;
  }
}
// trees
const trees = [];
{ const r = rng(7);
  for (let i = 0; i < 420; i++) {
    const x = (r() - .5) * 360, z = (r() - .5) * 360;
    if (Math.hypot(x - 2, z - 1) < 30) continue;
    if (Math.abs(x - rx(z)) < 8) continue;
    if (Math.hypot((x + 42) * .9, z - 22) < 24) continue;
    if (Math.hypot(x - HILL.x, z - HILL.z) < 8) continue;
    if (Math.hypot(x, z) > 175) continue;
    const g = G(world); g.position.set(x, heightAt(x, z) - .1, z); const s = .8 + r() * .9; g.scale.setScalar(s);
    if (r() < .6) { // pine
      mk(CYL(.18, .25, 1.2, 6), '#6b4a30', 0, .6, 0, g);
      mk(new THREE.ConeGeometry(1.4, 2.4, 7), r() < .5 ? '#2f7d6d' : '#3a8a72', 0, 2.1, 0, g);
      mk(new THREE.ConeGeometry(1.0, 2, 7), '#45987a', 0, 3.3, 0, g);
    } else { // round tree
      mk(CYL(.2, .28, 1.5, 6), '#6b4a30', 0, .75, 0, g);
      mk(new THREE.IcosahedronGeometry(1.35, 0), r() < .2 ? '#f0a8a0' : r() < .5 ? '#e3b64e' : '#9cc14a', 0, 2.4, 0, g);
    }
    trees.push({ g, ph: r() * 6, k: r() < .5 ? 1 : -1 });
  }
  for (let i = 0; i < 70; i++) { const x = (r() - .5) * 300, z = (r() - .5) * 300; if (Math.hypot(x - 2, z - 1) < 26 || Math.abs(x - rx(z)) < 6) continue; mk(new THREE.DodecahedronGeometry(.4 + r() * .8, 0), '#b9ab95', x, heightAt(x, z), z, world); }
}
// clouds + birds
const clouds = []; { const r = rng(3); for (let i = 0; i < 12; i++) { const g = G(world); g.position.set((r() - .5) * 400, 55 + r() * 30, -60 - r() * 200); for (let j = 0; j < 6; j++) mk(new THREE.SphereGeometry(4 + r() * 4, 10, 8), M('#fff6ee', { emissive: '#f5d9c2', emissiveIntensity: .35, flatShading: false }), (j - 2.5) * 5, r() * 3, r() * 4, g, false); clouds.push({ g, x0: g.position.x }); } }
const birds = []; { const r = rng(8); for (let i = 0; i < 7; i++) { const g = G(world); const wl = mk(BOX(1.2, .06, .35), '#3d3a4a', -.6, 0, 0, G(g), false), wr = mk(BOX(1.2, .06, .35), '#3d3a4a', .6, 0, 0, G(g), false); mk(BOX(.3, .2, .6), '#3d3a4a', 0, 0, 0, g, false); birds.push({ g, wl: wl.parent, wr: wr.parent, R: 30 + r() * 30, h: 22 + r() * 14, ph: r() * 6, sp: .12 + r() * .08, cx: -20 + r() * 30, cz: -10 + r() * 30 }); } }

// town (hillside village, terracotta roofs)
const houses = [];
const WALLS = ['#f6e7c8', '#f3d1c2', '#d9ecf2', '#f7f0e1', '#e8dcf3', '#d8efd9', '#fbe2a8'], ROOFS = ['#d0613f', '#c4553a', '#e07a52', '#b9503a'];
function house(x, z, rot, s, parent = world) {
  const r = rng(Math.floor(x * 31 + z * 17 + 999));
  const g = G(parent); g.position.set(x, parent === world ? heightAt(x, z) : 0, z); g.rotation.y = rot;
  const inner = G(g); inner.scale.setScalar(s);
  const w = 3 + r() * 1.6, d = 3 + r() * 1.2, h = 2.4 + r() * 1.4;
  mk(RBOX(w, h, d, .12), WALLS[Math.floor(r() * WALLS.length)], 0, h / 2, 0, inner);
  const rg = new THREE.CylinderGeometry(d * .66, d * .66, w + .5, 3); rg.rotateZ(Math.PI / 2); rg.rotateX(-Math.PI / 2);
  const roof = mk(rg, ROOFS[Math.floor(r() * ROOFS.length)], 0, h + d * .3, 0, inner); roof.scale.set(1, .8, 1);
  mk(BOX(.5, 1.2, .5), '#a9846a', w * .25, h + d * .45, d * .1, inner);
  mk(BOX(.8, 1.4, .08), '#8a5a35', -w * .2, .7, d / 2 + .02, inner);
  const winM = M('#5a7fa8', { emissive: '#ffd27a', emissiveIntensity: 0 });
  mk(BOX(.7, .7, .08), winM, w * .22, h * .62, d / 2 + .02, inner, false);
  return { g, inner, h };
}
{ const r = rng(55);
  for (let gx = 0; gx < 7; gx++) for (let gz = 0; gz < 6; gz++) {
    const x = -62 + gx * 6.2 + (r() - .5) * 1.6, z = 6 + gz * 6.3 + (r() - .5) * 1.6;
    if (Math.hypot((x + 42) * .9, z - 22) > 21) continue;
    if (Math.abs(z - 22 - (x + 42) * .15) < 2.2) continue; // main street
    const hs = house(x, z, (r() - .5) * .5 + (r() < .5 ? 0 : Math.PI / 2), .9 + r() * .25); hs.d = Math.hypot(x + 30, z - 30); houses.push(hs);
  }
}
const HOME = houses.reduce((a, b) => (b.g.position.x > a.g.position.x - 3 && b.g.position.z > a.g.position.z ? b : a), houses[0]).g.position.clone();
// street
{ const pts = []; for (let i = 0; i <= 20; i++) { const x = -64 + i * 2.2; const z = 22 + (x + 42) * .15; pts.push(V(x, heightAt(x, z) + .05, z)); }
  const curve = new THREE.CatmullRomCurve3(pts); const g = new THREE.TubeGeometry(curve, 60, 1.3, 4, false); const m = mk(g, '#c9b28f', 0, 0, 0, world, false); m.scale.y = .25; m.position.y = .25; }
// little fountain in the town square
const fountain = G(world); fountain.position.set(-44, heightAt(-44, 19), 19);
mk(CYL(1.6, 1.8, .6, 14), '#e8e2d6', 0, .3, 0, fountain); mk(CYL(1.3, 1.3, .1, 14), SM('#3fb6e6', { emissive: '#1a7fb0', emissiveIntensity: .2 }), 0, .62, 0, fountain, false); mk(CYL(.15, .2, 1.5, 8), '#e8e2d6', 0, 1, 0, fountain);

// ---------- treatment station ----------
const ST = G(world);
const TEAL = '#2bb3a3', WHITE = '#f1efe9';
mk(RBOX(48, .5, 26, .2), '#d8d1c3', 2, .0, 1, ST);
const pieces = [];
function piece(g, delay) { pieces.push({ g, delay, y0: g.position.y }); return g; }
function roundTank(x, z, r, h, waterCol) {
  const g = G(ST); g.position.set(x, .25, z);
  mk(CYL(r, r, h, 28, true), M(WHITE, { side: THREE.DoubleSide, flatShading: false, roughness: .6 }), 0, h / 2, 0, g);
  mk(new THREE.TorusGeometry(r, .14, 6, 28), TEAL, 0, h, 0, g).rotation.x = Math.PI / 2;
  mk(CYL(r, r, .2, 28), '#cfcac0', 0, .1, 0, g);
  const w = mk(CYL(r - .05, r - .05, .1, 28), SM(waterCol, { roughness: .2 }), 0, h - .35, 0, g, false);
  g.userData.water = w; return g;
}
const sMix = piece(roundTank(15, 2, 3, 2.4, '#9b7346'), 0);
const sDec = G(ST); sDec.position.set(3, .25, 2); piece(sDec, .15);
{ const w = 12, d = 6, h = 2.2; for (const [x, z, a, b] of [[0, -d / 2, w + .5, .35], [0, d / 2, w + .5, .35], [-w / 2, 0, .35, d], [w / 2, 0, .35, d]]) mk(BOX(a, h, b), WHITE, x, h / 2, z, sDec); mk(BOX(w + .5, .2, .45), TEAL, 0, h, -d / 2, sDec); mk(BOX(w + .5, .2, .45), TEAL, 0, h, d / 2, sDec);
  sDec.userData.water = mk(BOX(w - .2, .1, d - .2), SM('#a99263', { roughness: .2 }), 0, h - .35, 0, sDec, false); }
const sF1 = piece(roundTank(-7, -1.5, 2.2, 3, '#93b4b0'), .3), sF2 = piece(roundTank(-7, 5.5, 2.2, 3, '#93b4b0'), .4);
const sCl = piece(roundTank(-14, 2, 2.4, 2.6, '#64c6ec'), .5);
const sBld = G(ST); sBld.position.set(0, .25, -10); piece(sBld, .6);
mk(RBOX(18, 5, 6, .3), WHITE, 0, 2.5, 0, sBld); mk(RBOX(18.3, .5, 6.3, .2), TEAL, 0, 5.1, 0, sBld);
mk(BOX(15, 1.4, .1), M('#36566e', { emissive: '#bfe9ff', emissiveIntensity: .15 }), 0, 3, 3.02, sBld, false);
{ const d = G(sBld); d.position.set(-5, 5.3, 0); mk(CYL(.9, .9, 1.4, 12), '#dfe3e6', 0, .7, 0, d); }
const pumpH = G(ST); pumpH.position.set(23.5, .25, 2); piece(pumpH, -.1);
mk(RBOX(4, 3, 4, .2), WHITE, 0, 1.5, 0, pumpH); mk(RBOX(4.3, .4, 4.3, .15), TEAL, 0, 3.1, 0, pumpH);
// pipes with flanges
function pipe(pts, r, col, parent = world, seg = 40) {
  const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', .05);
  const m = mk(new THREE.TubeGeometry(curve, seg, r, 10, false), SM(col, { roughness: .35, metalness: .25 }), 0, 0, 0, parent);
  m.userData.curve = curve; return m;
}
const intakeMouth = V(rx(2) - 3.6, -.25, 2);
const pIntake = pipe([intakeMouth, V(26, .4, 2), V(25.6, 1, 2)], .45, '#d9dde0');
const pLinks = [pipe([V(21.5, 1.2, 2), V(18, 1.2, 2)], .35, '#d9dde0'), pipe([V(12, 1.4, 2), V(9.2, 1.4, 2)], .35, '#d9dde0'), pipe([V(-3.2, 1.4, 2), V(-5, 1.4, -1.5)], .35, '#d9dde0'), pipe([V(-3.2, 1.4, 3), V(-5, 1.4, 5.5)], .35, '#d9dde0'), pipe([V(-9.2, 1.2, 2), V(-11.6, 1.2, 2)], .35, TEAL)];
const flanges = [];
// workers
const workers = [];
function person(parent, col) { const g = G(parent); mk(new THREE.CapsuleGeometry(.32, .7, 3, 8), SM(col), 0, .75, 0, g); mk(new THREE.SphereGeometry(.28, 10, 8), SM('#e7b38c'), 0, 1.55, 0, g); mk(new THREE.SphereGeometry(.31, 10, 8, 0, TAU, 0, Math.PI / 2), SM('#ffcf3a'), 0, 1.62, 0, g); return g; }
for (let i = 0; i < 4; i++) { const g = person(ST, ['#2bb3a3', '#f08a3c', '#3d7fd6', '#2bb3a3'][i]); workers.push({ g, a: V(-12 + i * 7, .25, 9.5), b: V(-6 + i * 7, .25, 9.5), ph: i * 1.7 }); }

// hill reservoir + glass pipe up the hill
const RES = G(world); RES.position.set(HILL.x, HILL.y - .3, HILL.z);
mk(CYL(5.4, 5.6, .8, 24), '#d8d1c3', 0, .4, 0, RES);
mk(CYL(5, 5, 6, 32, true), M(WHITE, { side: THREE.DoubleSide, flatShading: false, roughness: .55 }), 0, 3.8, 0, RES);
mk(new THREE.SphereGeometry(5.05, 32, 10, 0, TAU, 0, Math.PI / 2), SM(TEAL, { roughness: .4 }), 0, 6.8, 0, RES).scale.y = .32;
const resGlass = mk(CYL(5.06, 5.06, 5.4, 32, true, ), new THREE.MeshStandardMaterial({ color: '#cfefff', transparent: true, opacity: .25, roughness: .05, side: THREE.DoubleSide, depthWrite: false }), 0, 3.8, 0, RES, false);
resGlass.geometry = new THREE.CylinderGeometry(5.07, 5.07, 5.4, 32, 1, true, -Math.PI / 3, Math.PI * 2 / 3); resGlass.renderOrder = 4;
const resWaterG = CYL(4.95, 4.95, 1, 32); resWaterG.translate(0, .5, 0);
const resWater = mk(resWaterG, SM('#4cc3f0', { emissive: '#1b86c4', emissiveIntensity: .25, roughness: .15 }), 0, 1.1, 0, RES, false); resWater.scale.y = .2;
mk(BOX(.6, 1.2, .6), '#9aa0a6', 4.2, 7.3, 0, RES);
const upPts = []; { const a = V(-14, 0, 2), b = V(HILL.x + 4.4, 0, HILL.z + 4.4); for (let i = 0; i <= 16; i++) { const p = a.clone().lerp(b, i / 16); p.y = heightAt(p.x, p.z) + .55; upPts.push(p); } upPts.push(V(HILL.x + 3.6, HILL.y + 6.4, HILL.z + 3.6)); }
const upCurve = new THREE.CatmullRomCurve3(upPts, false, 'catmullrom', .2);
const upPipe = mk(new THREE.TubeGeometry(upCurve, 90, .55, 12, false), new THREE.MeshStandardMaterial({ color: '#d6f2ff', transparent: true, opacity: .32, roughness: .05, depthWrite: false }), 0, 0, 0, world, false); upPipe.renderOrder = 4;

// glowing journey path (s13)
const journeyPts = [V(rx(10), 0, 10), intakeMouth.clone().setY(.6), V(24, 1.2, 2), V(15, 1.6, 2), V(3, 1.6, 2), V(-7, 1.8, 2), V(-14, 1.6, 2), ...upPts.slice(2, 17).map(p => p.clone().setY(p.y + .4)), V(HILL.x, HILL.y + 7.5, HILL.z), V(HILL.x - 4, HILL.y + 2, HILL.z + 8), V(-36, heightAt(-36, -4) + 1, -4), V(HOME.x, HOME.y + 3, HOME.z)];
const journeyCurve = new THREE.CatmullRomCurve3(journeyPts, false, 'catmullrom', .3);
const journeyGeo = new THREE.TubeGeometry(journeyCurve, 400, .35, 8, false);
const journey = mk(journeyGeo, new THREE.MeshBasicMaterial({ color: '#8ff4ff' }), 0, 0, 0, world, false); journey.material.color.multiplyScalar(2.2);
const journeyHead = mk(new THREE.SphereGeometry(.9, 16, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffffff').multiplyScalar(3) }), 0, 0, 0, world, false);

// ===================================================================================== GOTA (character)
const DIRT_C = [new THREE.Color('#8a6236'), new THREE.Color('#c2b07c'), new THREE.Color('#55c6ff')];
function makeGota() {
  const root = G(), body = G(root);
  const pts = []; for (let i = 0; i <= 36; i++) { const a = Math.PI * (1 - i / 36); pts.push(new THREE.Vector2(Math.sin(a) * Math.pow(Math.sin(a / 2), 1.3) * 1.15, Math.cos(a) * 1.1 + .1)); }
  const mat = new THREE.MeshPhysicalMaterial({ color: '#8a6236', roughness: .18, metalness: 0, clearcoat: 1, clearcoatRoughness: .15, emissive: '#000000' });
  const shell = mk(new THREE.LatheGeometry(pts, 40), mat, 0, 0, 0, body); shell.castShadow = true;
  mk(new THREE.SphereGeometry(.13, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffffff').multiplyScalar(1.6) }), -.38, .55, .5, body, false).scale.set(1, 1.6, 1);
  const lids = [], pupils = [], whites = [];
  const black = SM('#141414', { roughness: .3 });
  for (const k of [-1, 1]) {
    const e = G(body); e.position.set(k * .3, .05, .62);
    whites.push(mk(new THREE.SphereGeometry(.22, 16, 12), SM('#ffffff', { roughness: .3 }), 0, 0, .04, e, false));
    const pu = G(e); pu.position.z = .2; pupils.push(pu);
    mk(new THREE.SphereGeometry(.115, 12, 10), black, 0, 0, 0, pu, false);
    mk(new THREE.SphereGeometry(.035, 6, 5), new THREE.MeshBasicMaterial({ color: '#ffffff' }), .04, .05, .1, pu, false);
    const lid = G(e); lid.position.z = .04; mk(new THREE.SphereGeometry(.245, 16, 8, 0, TAU, 0, Math.PI / 2), mat, 0, 0, 0, lid, false); lid.userData.k = k; lids.push(lid);
  }
  const mouths = {
    smile: mk(new THREE.TorusGeometry(.16, .045, 6, 16, Math.PI), black, 0, -.3, .8, body, false),
    frown: mk(new THREE.TorusGeometry(.13, .04, 6, 16, Math.PI), black, 0, -.42, .8, body, false),
    o: mk(new THREE.TorusGeometry(.09, .04, 6, 14), black, 0, -.36, .8, body, false),
    grin: mk(new THREE.SphereGeometry(.2, 14, 8, 0, TAU, Math.PI / 2, Math.PI / 2), SM('#5a1d1d'), 0, -.28, .74, body, false),
  };
  mouths.smile.rotation.z = Math.PI; mouths.grin.rotation.x = -.35; mouths.grin.scale.set(1.1, .8, .6);
  const cheeks = [-1, 1].map(k => mk(new THREE.SphereGeometry(.12, 10, 8), SM('#ff8fa3', { transparent: true, opacity: .8 }), k * .52, -.22, .55, body, false));
  cheeks.forEach(c => c.scale.set(1, .6, .4));
  const r = rng(91), specks = [];
  for (let i = 0; i < 14; i++) { const a = (r() - .5) * 2.6, y = -.8 + r() * 1.4; const rad = .85 - Math.abs(y + .1) * .25; const m = mk(new THREE.DodecahedronGeometry(.07 + r() * .07, 0), '#4e3418', Math.sin(a) * rad, y, Math.cos(a) * rad * .95, body, false); if (Math.abs(Math.sin(a) * rad) < .5 && y > -.5 && y < .3) m.position.z *= .3; specks.push(m); }
  const bugs = []; for (let i = 0; i < 5; i++) { const b = microbe(i, .32, root); bugs.push(b); }
  const sparks = []; for (let i = 0; i < 4; i++) sparks.push(mk(new THREE.OctahedronGeometry(.18, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff6b0').multiplyScalar(2.5) }), 0, 0, 0, root, false));
  root.visible = false;
  return { root, body, mat, lids, pupils, mouths, cheeks, specks, bugs, sparks };
}
// microbe: capsule with spikes, eyes and a wiggly tail
const MCOL = ['#b86ad8', '#e27bcf', '#8f74e6'];
function microbe(i, s, parent) {
  const g = G(parent); const inner = G(g); inner.scale.setScalar(s);
  const body = mk(new THREE.CapsuleGeometry(.5, 1.1, 4, 10), SM(MCOL[i % 3], { roughness: .35 }), 0, 0, 0, inner); body.rotation.z = Math.PI / 2;
  for (let j = 0; j < 5; j++) mk(new THREE.ConeGeometry(.1, .32, 6), SM(MCOL[(i + 1) % 3]), -.5 + j * .25, .55, 0, inner, false);
  const pupils = [];
  for (const k of [-1, 1]) { mk(new THREE.SphereGeometry(.2, 12, 10), SM('#ffffff'), .38 + k * .23, .16, .38, inner, false); const p = mk(new THREE.SphereGeometry(.1, 10, 8), SM('#141414'), .4 + k * .23, .16, .55, inner, false); pupils.push(p); }
  const tail = []; for (let j = 0; j < 4; j++) tail.push(mk(new THREE.SphereGeometry(.13 - j * .02, 8, 6), SM(MCOL[i % 3]), -1.15 - j * .28, 0, 0, inner, false));
  const puffs = []; for (let j = 0; j < 6; j++) puffs.push(mk(new THREE.IcosahedronGeometry(.35, 1), new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0, roughness: 1, depthWrite: false }), 0, 0, 0, g, false));
  const stars = []; for (let j = 0; j < 3; j++) stars.push(mk(new THREE.OctahedronGeometry(.25, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffe14a').multiplyScalar(2) }), 0, 0, 0, g, false));
  return { g, inner, pupils, tail, puffs, stars, ph: i * 1.3 };
}
function animMicrobe(b, t, alive = 1, scared = 0) {
  b.tail.forEach((s, j) => { s.position.y = Math.sin(t * 9 - j * .9 + b.ph) * .12 * (j + 1); });
  b.pupils.forEach(p => p.scale.setScalar(1 - .45 * scared));
  b.inner.rotation.z = Math.sin(t * 4 + b.ph) * .15 + scared * Math.sin(t * 40) * .08;
  b.inner.scale.y = b.inner.scale.x * (1 + .06 * Math.sin(t * 8 + b.ph));
}
const gota = makeGota();
const gotaDirtCol = d => d > .5 ? DIRT_C[1].clone().lerp(DIRT_C[0], (d - .5) * 2) : DIRT_C[2].clone().lerp(DIRT_C[1], d * 2);
function applyGota(st, t) {
  const g = gota; g.root.visible = !!st.vis; if (!st.vis) return;
  g.root.position.copy(st.pos); g.root.rotation.set(st.rx || 0, st.ry || 0, st.rz || 0); g.root.scale.setScalar(st.s ?? 1);
  const sq = st.sq ?? (1 + .04 * Math.sin(t * 5)); const sx = st.sv ? st.sv[0] : 1 / Math.sqrt(sq), sy = st.sv ? st.sv[1] : sq, sz = st.sv ? st.sv[2] : 1 / Math.sqrt(sq);
  g.body.scale.set(sx, sy, sz); g.body.position.y = (sy - 1) * 1;
  const d = st.dirt ?? 1; g.mat.color.copy(gotaDirtCol(d)); g.mat.emissive.set('#1d8fd6').multiplyScalar(Math.pow(1 - d, 2) * .35);
  const blink = Math.max(0, 1 - Math.abs(((t + .7) % 3.3) - .1) / .09);
  const mood = st.mood || 'neutral';
  let lid = { neutral: .18, grumpy: .5, scared: 0, happy: .2, relaxed: .95, dizzy: .3, joy: .1, squeeze: .7 }[mood] ?? .18;
  lid = Math.max(lid, blink);
  g.lids.forEach(l => { l.rotation.x = lerp(-1.55, 1.5, lid); l.rotation.z = mood === 'grumpy' ? -l.userData.k * .45 : mood === 'scared' ? l.userData.k * .25 : 0; });
  const px = st.px ?? 0, py = st.py ?? 0;
  g.pupils.forEach((p, i) => { let x = px, y = py; if (mood === 'dizzy') { const a = t * 13 + i * Math.PI; x = Math.cos(a) * .07; y = Math.sin(a) * .07; } p.position.x = x; p.position.y = y; p.scale.setScalar(mood === 'scared' ? .7 : 1); });
  const mm = { neutral: 'smile', grumpy: 'frown', scared: 'o', happy: 'grin', relaxed: 'smile', dizzy: 'o', joy: 'grin', squeeze: 'o' }[mood];
  for (const k in g.mouths) g.mouths[k].visible = k === mm;
  g.cheeks.forEach(c => c.visible = ['happy', 'joy', 'relaxed'].includes(mood));
  g.specks.forEach((s, i) => s.scale.setScalar(Math.max(cl((d - .25) / .6 - i * .02), .001)));
  const bu = st.bugs ?? 0;
  g.bugs.forEach((b, i) => { const a = t * 1.6 + i * TAU / 5; b.g.position.set(Math.cos(a) * 1.5, .2 + Math.sin(t * 2 + i) * .5, Math.sin(a) * 1.2); b.g.rotation.y = -a; b.g.scale.setScalar(Math.max(bu * pop(t, (st.bugT ?? 0) + i * .08, .4), .001)); animMicrobe(b, t); });
  const sp = st.spark ?? 0;
  g.sparks.forEach((s, i) => { const a = t * 1.8 + i * TAU / 4; s.position.set(Math.cos(a) * 1.4, .4 + Math.sin(a * 1.3) * .6, Math.sin(a) * .9 + .3); s.scale.setScalar(Math.max(sp * (.6 + .4 * Math.sin(t * 9 + i * 2)), .001)); s.rotation.y = t * 4; });
}

// ===================================================================================== SETS
const sets = {};
function set(name, x) { const g = G(); g.position.set(x, 0, 0); g.visible = false; sets[name] = g; return g; }
const O = n => sets[n].position;

// ---- tunnel (s3) ----
const TUN = set('tun', 1000);
mk(CYL(3.2, 3.2, 180, 24, true), M('#56656e', { side: THREE.BackSide, roughness: .5, metalness: .4 }), 0, 0, -80, TUN, false).rotation.x = Math.PI / 2;
const tunRings = []; for (let i = 0; i < 36; i++) { const m = mk(new THREE.TorusGeometry(3.05, .09, 6, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color('#8ff4ff').multiplyScalar(2.2) }), 0, 0, 8 - i * 5, TUN, false); tunRings.push(m); }
mk(BOX(4.2, .1, 180), M('#8a6a3e', { roughness: .25 }), 0, -2.4, -80, TUN, false);
const tunBits = []; { const r = rng(12); for (let i = 0; i < 40; i++) tunBits.push({ m: mk(new THREE.DodecahedronGeometry(.08 + r() * .1, 0), '#5e4524', 0, 0, 0, TUN, false), x: (r() - .5) * 3, y: (r() - .5) * 3, z0: r() * 60 }); }

// ---- mixing tank with vortex (s4) ----
const MIXS = set('mix', 1200);
mk(new THREE.CylinderGeometry(60, 60, .2, 24), M('#cbc3b4'), 0, -.1, 0, MIXS);
mk(CYL(6, 6, 4, 48, true), M('#eef1f2', { side: THREE.DoubleSide, flatShading: false, roughness: .55 }), 0, 2, 0, MIXS);
mk(new THREE.TorusGeometry(6, .22, 8, 48), TEAL, 0, 4, 0, MIXS).rotation.x = Math.PI / 2;
for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; mk(BOX(.3, 4, .3), '#cfd5d8', Math.cos(a) * 6.15, 2, Math.sin(a) * 6.15, MIXS); }
const VX_R = 5.9, VX_NR = 14, VX_NA = 64;
const vortexGeo = new THREE.RingGeometry(.05, VX_R, VX_NA, VX_NR); vortexGeo.rotateX(-Math.PI / 2);
vortexGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(vortexGeo.attributes.position.count * 3), 3));
const vortex = mk(vortexGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .25, flatShading: true }), 0, 3.3, 0, MIXS, false);
const vxBase = vortexGeo.attributes.position.array.slice();
const cA = new THREE.Color('#8d6538'), cB = new THREE.Color('#c09a62'), cW = new THREE.Color('#e9e4d6');
function vortexDepth(r, t) { return -1.6 * Math.exp(-r * r / 6) * eo(P(t, S('s4') - .3, S('s4') + .8)); }
function updVortex(t) {
  const p = vortexGeo.attributes.position, c = vortexGeo.attributes.color; const pw = P(t, Wd('s4', 'pó'), E('s4'));
  for (let i = 0; i < p.count; i++) {
    const x = vxBase[i * 3], z = vxBase[i * 3 + 2], r = Math.hypot(x, z), a = Math.atan2(z, x);
    p.setY(i, vortexDepth(r, t) + .05 * Math.sin(a * 5 + r * 2 - t * 6));
    const s = .5 + .5 * Math.sin(a * 3 + r * 1.4 - t * 5);
    const col = cA.clone().lerp(cB, s); col.lerp(cW, pw * .55 * (.5 + .5 * Math.sin(a * 6 - r - t * 7)));
    c.setXYZ(i, col.r, col.g, col.b);
  }
  p.needsUpdate = true; c.needsUpdate = true; vortexGeo.computeVertexNormals();
}
// robot arm with powder nozzle
const arm = G(MIXS); arm.position.set(0, 0, -7.6);
mk(CYL(.9, 1.1, 6.5, 16), SM('#f08a3c'), 0, 3.25, 0, arm);
const armJ = G(arm); armJ.position.y = 6.6; mk(new THREE.SphereGeometry(.8, 16, 12), SM('#3a3f46'), 0, 0, 0, armJ);
const armA = G(armJ); mk(RBOX(.9, .9, 5.2, .3), SM('#f08a3c'), 0, 0, 2.6, armA);
const armK = G(armA); armK.position.z = 5.2; mk(new THREE.SphereGeometry(.55, 14, 10), SM('#3a3f46'), 0, 0, 0, armK);
const armB = G(armK); mk(RBOX(.7, 2.4, .7, .25), SM('#f08a3c'), 0, -1.2, 0, armB);
const nozzle = G(armB); nozzle.position.y = -2.6; mk(new THREE.ConeGeometry(.6, .9, 16), SM('#e9ecef', { metalness: .4, roughness: .3 }), 0, 0, 0, nozzle).rotation.x = Math.PI;
const powder = []; { const r = rng(5); for (let i = 0; i < 90; i++) powder.push({ m: mk(new THREE.OctahedronGeometry(.07 + r() * .07, 0), new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: .4 }), 0, -99, 0, MIXS, false), o: r(), dx: (r() - .5), dz: (r() - .5), a: r() * TAU }); }
const mixBg = []; for (let i = 0; i < 5; i++) { const g = G(MIXS); g.position.set(-22 + i * 11, 0, -26); mk(CYL(3.5, 3.5, 9, 20), M(i % 2 ? '#e8e4dc' : '#d9e9e6', { flatShading: false }), 0, 4.5, 0, g); mk(new THREE.TorusGeometry(3.5, .18, 6, 20), TEAL, 0, 9, 0, g).rotation.x = Math.PI / 2; }
mk(BOX(120, 30, 1), M('#e9dfcf'), 0, 15, -34, MIXS);
for (let i = 0; i < 6; i++) mk(BOX(6, 10, .2), M('#bfe0f0', { emissive: '#fff1d6', emissiveIntensity: .8 }), -30 + i * 12, 18, -33.4, MIXS, false);

// ---- micro world (s5 flocs, s8 chlorine) ----
const MIC = set('mic', 1400);
const bokeh = [];
{ const r = rng(33); for (const [n, size, op] of [[90, .5, .55], [40, 1.4, .35], [16, 3.2, .22]]) {
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { pos.set([(r() - .5) * 30, (r() - .5) * 46, -14 - r() * 18 + (size > 3 ? 26 : 0)], i * 3); const c = new THREE.Color(r() < .5 ? '#9fe9ff' : '#ffffff'); col.set([c.r, c.g, c.b], i * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const p = new THREE.Points(g, new THREE.PointsMaterial({ size, map: softDot, transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true, sizeAttenuation: true }));
    MIC.add(p); bokeh.push(p);
} }
const FLOC_C = [[-3.4, 5.2], [3.1, 4.2], [-.3, 1.2], [-3.8, -2.6], [3.4, -2.2], [.2, -6.2], [-1.6, 9], [3.2, 8.6]];
const grains = []; { const r = rng(21); for (let i = 0; i < 110; i++) { const m = mk(new THREE.DodecahedronGeometry(.2 + r() * .22, 0), SM(r() < .5 ? '#6e4f26' : '#9a7440', { flatShading: true, roughness: .8 }), 0, 0, 0, MIC, false); const c = FLOC_C[i % FLOC_C.length]; const a = r() * TAU, b = r() * Math.PI, rr = .3 + r() * .8; grains.push({ m, sx: (r() - .5) * 12, sy: (r() - .5) * 22, sz: (r() - .5) * 4, cx: c[0] + Math.cos(a) * Math.sin(b) * rr, cy: c[1] + Math.sin(a) * Math.sin(b) * rr, cz: Math.cos(b) * rr, d: r() * .5, ph: r() * 6 }); } }
const crystals = []; { const r = rng(22); for (let i = 0; i < 30; i++) crystals.push({ m: mk(new THREE.OctahedronGeometry(.22, 0), new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#e8f8ff', emissiveIntensity: 1.2, roughness: .2 }), 0, 0, 0, MIC, false), x: (r() - .5) * 12, o: r(), c: FLOC_C[i % FLOC_C.length] }); }
const bugs = []; { const pos = [[-3.3, 5.6], [3.2, 4.3], [0, 1.2], [-3.6, -2.4], [3.6, -2.8], [-.4, -6.4], [-2.4, 9.2], [2.6, 8.4], [.6, -10]];
  pos.forEach(([x, y], i) => { const b = microbe(i, 1.35, MIC); b.x = x; b.y = y; b.d = i * .07; b.survivor = i === 2; bugs.push(b); }); }
const chlor = []; { const r = rng(23); for (let i = 0; i < 60; i++) chlor.push({ m: mk(new THREE.OctahedronGeometry(.2, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color('#7dff6a').multiplyScalar(1.8) }), 0, -99, 0, MIC, false), x: (r() - .5) * 12, o: r(), sp: .8 + r() * .6 }); }

// ---- decanter cutaway (s6) ----
const DECS = set('dec', 1600);
mk(BOX(80, .4, 40), M('#cbc3b4'), 0, -.2, 0, DECS);
mk(BOX(22, 8.5, .8), M('#bdb5a8'), 0, 4.25, -3.4, DECS); mk(BOX(22, .8, 7.6), M('#bdb5a8'), 0, .4, 0, DECS);
mk(BOX(.8, 8.5, 7.6), M('#bdb5a8'), -11.4, 4.25, 0, DECS); mk(BOX(.8, 8.5, 7.6), M('#bdb5a8'), 11.4, 4.25, 0, DECS);
for (const x of [-11.4, 11.4]) mk(BOX(.82, 8.52, .2), M('#6c645a'), x, 4.25, 3.75, DECS, false);
mk(BOX(23.6, .82, .2), M('#6c645a'), 0, .4, 3.75, DECS, false);
mk(BOX(23.6, .3, .9), TEAL, 0, 8.6, -3.4, DECS);
const decWaterMat = new THREE.MeshStandardMaterial({ color: '#8d7347', transparent: true, opacity: .45, roughness: .2, depthWrite: false });
const decWater = mk(BOX(22, 6.6, 6.8), decWaterMat, 0, 4.1, 0, DECS, false); decWater.renderOrder = 2;
const DS_NX = 40; const decSurfG = new THREE.PlaneGeometry(22, 6.8, DS_NX, 8); decSurfG.rotateX(-Math.PI / 2);
const decSurfMat = new THREE.MeshStandardMaterial({ color: '#a88a55', roughness: .15, flatShading: true });
const decSurf = mk(decSurfG, decSurfMat, 0, 7.4, 0, DECS, false); const dsBase = decSurfG.attributes.position.array.slice();
const rays = []; for (let i = 0; i < 6; i++) { const m = mk(new THREE.PlaneGeometry(2.4, 9), new THREE.MeshBasicMaterial({ map: rayTex, transparent: true, opacity: .35, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }), -9 + i * 3.6, 3.6, .5, DECS, false); m.rotation.z = .35; rays.push(m); }
const flocsD = []; { const r = rng(61); for (let i = 0; i < 70; i++) { const g = G(DECS); for (let k = 0; k < 3; k++) mk(new THREE.DodecahedronGeometry(.18 + r() * .14, 0), SM(r() < .5 ? '#6e4f26' : '#83602f', { flatShading: true }), (r() - .5) * .35, (r() - .5) * .35, (r() - .5) * .35, g, false);
  const x = -10 + r() * 20; flocsD.push({ g, x, y: 2 + r() * 5, z: -2.6 + r() * 5.4, fy: 1.05 + Math.max(0, 1.6 - Math.abs(x) * .14) * r(), d: r(), ph: r() * 6 }); } }
const SL_NX = 40; const sludgeG = new THREE.PlaneGeometry(21.8, 6.6, SL_NX, 6); sludgeG.rotateX(-Math.PI / 2);
const sludge = mk(sludgeG, M('#6a4b26'), 0, .85, 0, DECS, false); const slBase = sludgeG.attributes.position.array.slice();
const decBubbles = []; { const r = rng(64); for (let i = 0; i < 20; i++) decBubbles.push({ m: mk(new THREE.SphereGeometry(.08 + r() * .08, 8, 6), SM('#e8fbff', { transparent: true, opacity: .7 }), 0, -99, 0, DECS, false), x: -10 + r() * 20, z: -2 + r() * 4, o: r() }); }

// ---- filter column cutaway (s7) ----
const FILS = set('fil', 1800);
mk(BOX(60, .4, 40), M('#cbc3b4'), 0, -.2, 0, FILS);
mk(BOX(9, 13, .8), M('#bdb5a8'), 0, 6.5, -3, FILS); mk(BOX(.8, 13, 6.4), M('#bdb5a8'), -4.9, 6.5, 0, FILS); mk(BOX(.8, 13, 6.4), M('#bdb5a8'), 4.9, 6.5, 0, FILS);
mk(BOX(10.6, .6, 6.4), M('#bdb5a8'), 0, .3, 0, FILS);
for (const x of [-4.9, 4.9]) mk(BOX(.82, 13.02, .2), M('#6c645a'), x, 6.5, 3.25, FILS, false);
mk(BOX(10.6, .4, .9), TEAL, 0, 13.1, -3, FILS);
const filWater = mk(BOX(9, 3.6, 5.6), new THREE.MeshStandardMaterial({ color: '#94b8b4', transparent: true, opacity: .42, depthWrite: false, roughness: .2 }), 0, 9.6, 0, FILS, false); filWater.renderOrder = 2;
const FL = [['pedra', 'PEDRA', .6, 3.4, '#9b9a94', 90, .34, .5], ['areia', 'AREIA', 3.4, 5.8, '#e6cc86', 650, .12, .17], ['carv', 'CARVÃO', 5.8, 7.8, '#2a2a2e', 230, .2, .26]];
const dummy = new THREE.Object3D();
const layerData = FL.map(([w, lab, y0, y1, col, n, r0, r1], li) => {
  const geo = li === 1 ? new THREE.BoxGeometry(1, 1, 1) : new THREE.DodecahedronGeometry(1, 0);
  const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', flatShading: true, roughness: li === 2 ? .3 : .85, metalness: li === 2 ? .3 : 0 });
  const im = new THREE.InstancedMesh(geo, mat, n); im.frustumCulled = false; im.castShadow = false; im.receiveShadow = true; FILS.add(im);
  const r = rng(70 + li), items = [];
  const cols = li === 1 ? ['#e6cc86', '#d8b872', '#efd99a'] : li === 0 ? ['#9b9a94', '#8a8378', '#b0aca3'] : ['#2a2a2e', '#343338', '#1e1e22'];
  for (let i = 0; i < n; i++) { const s = r0 + r() * (r1 - r0); items.push({ x: (r() - .5) * 8.6, y: y0 + s + r() * (y1 - y0 - 2 * s), z: -2.6 + Math.pow(r(), .6) * 5.6, s, ry: r() * 6, delay: r() * .9, h0: 8 + r() * 6 }); im.setColorAt(i, new THREE.Color(cols[i % 3])); }
  return { im, items, w, lab, y0, y1 };
});
const filOut = pipe([V(0, -0, 0), V(0, .01, 0)], .01, '#ffffff', FILS); filOut.visible = false;
const filSpecks = []; { const r = rng(77); for (let i = 0; i < 26; i++) filSpecks.push({ m: mk(new THREE.DodecahedronGeometry(.06 + r() * .05, 0), '#5a3d1e', 0, -99, 0, FILS, false), x: (r() - .5) * 2, z: r(), stop: 6.2 + r() * 2.2 - (i % 3) * 1.2 }); }

// ---- tooth & fluoride (s9) ----
const TOO = set('too', 2000);
mk(new THREE.CylinderGeometry(9, 9, .6, 40), SM('#8fd6c9', { roughness: .6 }), 0, -.3, 0, TOO);
mk(new THREE.TorusGeometry(9, .3, 8, 40), SM(TEAL), 0, 0, 0, TOO).rotation.x = Math.PI / 2;
const bottle = G(TOO); bottle.position.set(-2.4, 8.2, 0);
mk(CYL(.8, .8, 1.8, 16), SM('#3d7fd6', { roughness: .25 }), 0, 0, 0, bottle); mk(new THREE.ConeGeometry(.8, 1, 16), SM('#e9ecef'), 0, -1.4, 0, bottle).rotation.x = Math.PI;
mk(CYL(.5, .6, .5, 16), SM('#ffffff'), 0, 1.15, 0, bottle);
const fluDrop = mk(new THREE.SphereGeometry(.22, 12, 10), new THREE.MeshStandardMaterial({ color: '#7cc7ff', emissive: '#4fb3f0', emissiveIntensity: 1.2 }), 0, -99, 0, TOO, false);
const tooth = G(TOO); tooth.position.set(2.6, 0, -.5);
const toothIn = G(tooth);
{ const TW = SM('#fbfbf7', { roughness: .35 });
  mk(RBOX(3.2, 2.4, 2.6, .7), TW, 0, 3.6, 0, toothIn); mk(new THREE.SphereGeometry(.9, 16, 12), TW, -.8, 4.8, 0, toothIn); mk(new THREE.SphereGeometry(.9, 16, 12), TW, .8, 4.8, 0, toothIn);
  for (const x of [-.8, .8]) { const c = mk(new THREE.ConeGeometry(.75, 2.6, 12), TW, x, 1.4, 0, toothIn); c.rotation.x = Math.PI; c.rotation.z = -x * .12; }
  for (const k of [-1, 1]) { mk(new THREE.SphereGeometry(.28, 14, 10), SM('#ffffff'), k * .55, 4, 1.25, toothIn, false); mk(new THREE.SphereGeometry(.15, 12, 10), SM('#141414'), k * .55, 4, 1.48, toothIn, false); }
  const sm = mk(new THREE.TorusGeometry(.4, .07, 6, 16, Math.PI), SM('#141414'), 0, 3.3, 1.3, toothIn, false); sm.rotation.z = Math.PI;
  for (const k of [-1, 1]) mk(new THREE.SphereGeometry(.2, 10, 8), SM('#ff9fb0', { transparent: true, opacity: .8 }), k * 1.05, 3.4, 1.15, toothIn, false).scale.set(1, .6, .4);
}
const shield = mk(new THREE.SphereGeometry(3.6, 32, 20), new THREE.MeshStandardMaterial({ color: '#7fe3ff', emissive: '#3fc6ff', emissiveIntensity: .5, transparent: true, opacity: .22, roughness: .1, depthWrite: false, side: THREE.DoubleSide }), 0, 3.4, 0, tooth, false); shield.renderOrder = 5;
const shieldRing = mk(new THREE.TorusGeometry(3.7, .06, 6, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color('#bff6ff').multiplyScalar(2.5) }), 0, 3.4, 0, tooth, false);
const tooSparks = []; for (let i = 0; i < 7; i++) tooSparks.push(mk(new THREE.OctahedronGeometry(.3, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff6b0').multiplyScalar(2.5) }), 0, 0, 0, tooth, false));
for (let i = 0; i < 18; i++) { const r = rng(300 + i); const g = G(TOO); g.position.set((r() - .5) * 60, -2 - r() * 8, -20 - r() * 20); mk(new THREE.IcosahedronGeometry(3 + r() * 4, 0), SM(['#ffd6e0', '#cfe9ff', '#fff1c9'][i % 3], { flatShading: true }), 0, 0, 0, g, false); }

// ---- slope cross-section (s11) ----
const SLO = set('slo', 2200);
const slopeY = x => 7 - x * .32 + Math.sin(x * .35) * .4;
function slab(yTop, yBot, col, z0, z1) {
  const sh = new THREE.Shape(); const xs = []; for (let i = 0; i <= 40; i++) xs.push(-26 + i * 52 / 40);
  sh.moveTo(xs[0], yBot(xs[0])); xs.forEach(x => sh.lineTo(x, yTop(x))); for (let i = xs.length - 1; i >= 0; i--) sh.lineTo(xs[i], yBot(xs[i]));
  const geo = new THREE.ExtrudeGeometry(sh, { depth: z1 - z0, bevelEnabled: false }); geo.translate(0, 0, z0);
  return mk(geo, M(col), 0, 0, 0, SLO);
}
slab(x => slopeY(x) - 1.2, x => -9, '#8a5c3a', -4, 3);
slab(x => slopeY(x) - .35, x => slopeY(x) - 1.2, '#a8714a', -4, 3);
slab(x => slopeY(x), x => slopeY(x) - .35, '#9cc14a', -4, -1.2);
slab(x => slopeY(x) + .02, x => slopeY(x) - .35, '#7d7a76', -1.2, 3);
for (let i = 0; i < 9; i++) { const x = -24 + i * 6; mk(BOX(1.4, .05, .25), '#f4f1e6', x, slopeY(x) + .05, .9, SLO, false).rotation.z = Math.atan(-.32); }
const sloStones = []; { const r = rng(88); for (let i = 0; i < 50; i++) { const x = -25 + r() * 50, y = -8 + r() * (slopeY(x) - 2 + 8); mk(new THREE.DodecahedronGeometry(.15 + r() * .3, 0), '#6e4a2e', x, y, 3.02, SLO, false); } }
const sloTank = G(SLO); sloTank.position.set(-21, slopeY(-21), -1); mk(CYL(3.2, 3.2, 4.5, 24), SM(WHITE), 0, 2.25, 0, sloTank); mk(new THREE.SphereGeometry(3.2, 24, 8, 0, TAU, 0, Math.PI / 2), SM(TEAL), 0, 4.5, 0, sloTank).scale.y = .35;
const sloHouses = [house(18, -2, 0, 1.2, SLO), house(23.5, -2.4, .2, 1.1, SLO)]; sloHouses.forEach(h => h.g.position.y = slopeY(h.g.position.x));
const car = G(SLO); mk(RBOX(3, 1, 1.6, .3), SM('#e2483d', { roughness: .3 }), 0, .8, 0, car); mk(RBOX(1.7, .8, 1.4, .3), SM('#e2483d', { roughness: .3 }), -.2, 1.5, 0, car); mk(BOX(1.5, .55, 1.42), M('#9fd3f0', { emissive: '#bfe9ff', emissiveIntensity: .2 }), -.2, 1.5, 0, car, false);
const wheels = []; for (const [x, z] of [[-.9, .8], [.9, .8], [-.9, -.8], [.9, -.8]]) { const w = mk(CYL(.38, .38, .3, 12), SM('#222'), x, .38, z, car); w.rotation.x = Math.PI / 2; wheels.push(w); }
const slPipePts = []; for (let i = 0; i <= 30; i++) { const x = -20 + i * 38 / 30; slPipePts.push(V(x, slopeY(x) - 2.6, 3.05)); }
slPipePts.unshift(V(-21, slopeY(-21) - .2, 3.05)); slPipePts.push(V(18.6, slopeY(18.6) - 1.5, 3.05), V(18.8, slopeY(18.8) + .3, 3.05));
const slCurve = new THREE.CatmullRomCurve3(slPipePts, false, 'catmullrom', .3);
mk(new THREE.TubeGeometry(slCurve, 160, .62, 12, false), new THREE.MeshStandardMaterial({ color: '#d6f2ff', transparent: true, opacity: .3, roughness: .05, depthWrite: false }), 0, 0, 0, SLO, false).renderOrder = 4;
mk(new THREE.TubeGeometry(slCurve, 160, .66, 12, false), M('#3a2a1c', { side: THREE.BackSide }), 0, 0, -.05, SLO, false);
const arrow = G(SLO); { const am = SM('#FFD21F', { emissive: '#FFB800', emissiveIntensity: .35 }); mk(BOX(.9, 4, .5), am, 0, 2, 0, arrow); mk(new THREE.ConeGeometry(1.2, 1.6, 4), am, 0, -.6, 0, arrow).rotation.set(Math.PI, Math.PI / 4, 0); }
const speedLines = []; for (let i = 0; i < 10; i++) speedLines.push(mk(BOX(1.6, .05, .05), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffffff').multiplyScalar(1.5), transparent: true, opacity: .8 }), 0, -99, 0, SLO, false));

// ---- kitchen (s12) ----
const KIT = set('kit', 2400);
mk(BOX(40, .2, 30), M('#d9b48a'), 0, -.1, 0, KIT);
{ const r = rng(44); for (let i = 0; i < 16; i++) for (let j = 0; j < 12; j++) mk(BOX(.96, .96, .1), M(((i + j) % 2) ? '#f7f3ea' : '#dff1ef', { roughness: .4 }), -7.5 + i, 3.2 + j, -2.05, KIT, false); }
mk(BOX(20, 20, .2), M('#f3e6d3'), 0, 10, -2.2, KIT);
const winG = G(KIT); winG.position.set(4.6, 10, -2);
mk(BOX(5.6, 4.2, .3), M('#ffffff'), 0, 0, 0, winG); mk(BOX(5, 3.6, .1), new THREE.MeshBasicMaterial({ map: canvasTex(256, 192, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#7fb6e8'); gr.addColorStop(1, '#ffd9b0'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.fillStyle = '#9a93c6'; g.beginPath(); g.moveTo(0, 150); g.lineTo(70, 80); g.lineTo(140, 140); g.lineTo(200, 90); g.lineTo(256, 150); g.lineTo(256, 192); g.lineTo(0, 192); g.fill(); g.fillStyle = '#b4cf63'; g.fillRect(0, 160, w, 40); }) }), 0, 0, .2, winG, false);
mk(BOX(.15, 3.6, .2), M('#ffffff'), 0, 0, .25, winG);
mk(RBOX(16, 3, 4, .1), M('#c98d5a'), 0, 1.5, 0, KIT);
const counter = mk(RBOX(16.4, .35, 4.3, .1), SM('#f2f2f0', { roughness: .3 }), 0, 3.15, 0, KIT);
mk(BOX(4.4, .5, 2.8), SM('#c7cdd2', { metalness: .5, roughness: .3 }), 0, 3.12, 0, KIT);
const fau = G(KIT); fau.position.set(0, 3.3, -1.6);
const chrome = SM('#dfe5ea', { metalness: .85, roughness: .18 });
mk(CYL(.25, .3, 2.4, 16), chrome, 0, 1.2, 0, fau);
const spoutCurve = new THREE.CatmullRomCurve3([V(0, 2.3, 0), V(0, 3.2, .3), V(0, 3.1, 1.3), V(0, 2.5, 1.6)]);
mk(new THREE.TubeGeometry(spoutCurve, 30, .2, 12, false), chrome, 0, 0, 0, fau);
const SPOUT = V(0, 2.4, 1.6);
const fHandle = G(fau); fHandle.position.set(0, 2.5, 0); mk(RBOX(.35, .35, 1.4, .15), chrome, 0, .2, .4, fHandle).rotation.x = -.5;
const glass = G(KIT); glass.position.set(0, 3.37, -.1);
mk(new THREE.CylinderGeometry(.75, .62, 2, 24, 1, true), new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: .28, roughness: .05, side: THREE.DoubleSide, depthWrite: false }), 0, 1, 0, glass, false).renderOrder = 4;
mk(CYL(.62, .62, .08, 24), new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: .5 }), 0, .04, 0, glass, false);
const gwG = CYL(.72, .6, 1, 24); gwG.translate(0, .5, 0);
const glassWater = mk(gwG, SM('#5cc8ff', { emissive: '#1d8fd6', emissiveIntensity: .35, transparent: true, opacity: .85, roughness: .1 }), 0, .08, 0, glass, false); glassWater.scale.y = .001;
const splash = []; { const r = rng(18); for (let i = 0; i < 16; i++) splash.push({ m: mk(new THREE.SphereGeometry(.07 + r() * .06, 8, 6), SM('#bfe9ff', { emissive: '#5cc8ff', emissiveIntensity: .6 }), 0, -99, 0, KIT, false), a: r() * TAU, v: 1.5 + r() * 2.5, h: 2 + r() * 2 }); }
const plant = G(KIT); plant.position.set(-6, 3.3, -.6); mk(CYL(.6, .45, 1, 12), SM('#d0613f'), 0, .5, 0, plant); for (let i = 0; i < 6; i++) { const l = mk(new THREE.SphereGeometry(.5, 8, 6), SM('#5fae4a'), Math.cos(i) * .4, 1.4 + (i % 3) * .3, Math.sin(i) * .4, plant); l.scale.set(.6, 1.3, .3); l.rotation.z = Math.cos(i) * .5; }

// splash ring for river (s2)
const riverSplash = []; { const r = rng(19); for (let i = 0; i < 14; i++) riverSplash.push({ m: mk(new THREE.SphereGeometry(.1 + r() * .08, 8, 6), SM('#b08a58'), 0, -99, 0, world, false), a: r() * TAU, v: 1 + r() * 2, h: 2 + r() * 2.5 }); }
const ripple = mk(new THREE.TorusGeometry(1, .06, 6, 32), M('#d9c39a'), 0, -99, 0, world, false); ripple.rotation.x = Math.PI / 2;

// ===================================================================================== LABELS
const labs = [];
function label(text, posFn, t0, t1, opts = {}) { const el = document.createElement('div'); el.className = 'lab' + (opts.big ? ' big' : ''); el.textContent = text; document.getElementById('labs').appendChild(el); labs.push({ el, posFn: typeof posFn === 'function' ? posFn : () => posFn, t0, t1, rot: opts.rot ?? -4 }); }
const at = (n, x, y, z) => V(O(n).x + x, y, z);
label('CIDADE INTEIRA', V(-44, 9, 20), Wd('s1', 'cidade') - .05, E('s1') + .25);
label('RIO', () => V(rx(-4), 1.6, -4), Wd('s2', 'rio') - .05, Wd('s2', 'marrom') + .5);
label('MICRÓBIOS', () => gota.root.position.clone().add(V(0, 2.8, 0)), Wd('s2', 'micr') - .05, E('s2') + .3, { rot: 3 });
label('ESTAÇÃO DE TRATAMENTO', V(2, 9, 1), Wd('s3', 'estação') - .05, E('s3') + .3);
label('SULFATO DE ALUMÍNIO', at('mix', 0, 9.6, -2), Wd('s4', 'sulfato') - .1, E('s4') + .3);
label('FLOCOS', at('mic', 0, 12, 0), Wd('s5', 'flocos') - .1, E('s5') + .3, { big: true });
label('DECANTAÇÃO', at('dec', 0, 10.5, 0), Wd('s6', 'decanta') - .1, E('s6') + .3);
layerData.forEach((ld, i) => label(ld.lab, at('fil', 2.2, (ld.y0 + ld.y1) / 2 + .2, 3.3), Wd('s7', ld.w) - .05, i < 2 ? Wd('s7', layerData[i + 1].w) - .02 : E('s7') + .3, { rot: i % 2 ? 3 : -3 }));
label('CLORO', at('mic', -2.5, 12, 0), Wd('s8', 'cloro') - .05, E('s8') + .3, { big: true });
label('FLÚOR', at('too', -2.4, 10.4, 0), Wd('s9', 'flúor') - .05, E('s9') + .3);
label("CAIXA D'ÁGUA", V(HILL.x, HILL.y + 10.5, HILL.z), Wd('s10', 'caixa') - .05, E('s10') + .3);
label('GRAVIDADE', () => arrow.position.clone().add(V(2.4, 2.6, 0)).add(O('slo')), Wd('s11', 'gravidade') - .05, E('s11') + .3);
label('ÁGUA TRATADA', at('kit', 0, 8.6, 0), Wd('s12', 'limpinha') - .1, E('s12') + .3, { big: true });
label('RIO', () => V(rx(10), 2.5, 10), Wd('s13', 'passou') - .1, DUR, { rot: 3 });
label('TORNEIRA', () => V(HOME.x, HOME.y + 6, HOME.z), Wd('s13', 'passou') + .2, DUR);

// ===================================================================================== TIMELINE
const T_SUCK = S('s3'), T_TUN = S('s3') + .55, T_REV = Wd('s3', 'até') + .15;
const CUTS = [{ t: S('s2'), k: 'whip', d: 1 }, { t: T_TUN, k: 'dive' }, { t: T_REV, k: 'whip', d: -1 }, { t: S('s4'), k: 'whip', d: 1 }, { t: S('s5'), k: 'dive' }, { t: S('s6'), k: 'dive' }, { t: S('s7'), k: 'whip', d: -1 },
  { t: S('s8'), k: 'dive' }, { t: S('s9'), k: 'dive' }, { t: S('s10'), k: 'whip', d: 1 }, { t: S('s11'), k: 'whip', d: -1 }, { t: S('s12'), k: 'whip', d: 1 }, { t: S('s13'), k: 'whip', d: -1 }];
function shotOf(t) {
  if (t < S('s2')) return 'town'; if (t < T_TUN) return 'river'; if (t < T_REV) return 'tun'; if (t < S('s4')) return 'station'; if (t < S('s5')) return 'mix'; if (t < S('s6')) return 'mic5';
  if (t < S('s7')) return 'dec'; if (t < S('s8')) return 'fil'; if (t < S('s9')) return 'mic8'; if (t < S('s10')) return 'too'; if (t < S('s11')) return 'res'; if (t < S('s12')) return 'slo'; if (t < S('s13')) return 'kit'; return 'final';
}
const SET_OF = { town: null, river: null, tun: 'tun', station: null, mix: 'mix', mic5: 'mic', dec: 'dec', fil: 'fil', mic8: 'mic', too: 'too', res: null, slo: 'slo', kit: 'kit', final: null };
const SKY = { world: ['#7fb6e8', '#ffd9b0'], tun: ['#1b2228', '#1b2228'], mix: ['#e9dfcf', '#f4ead8'], mic: ['#0b3f5a', '#1f86a8'], dec: ['#cfe3ea', '#f6ead6'], fil: ['#d6e6ea', '#f6ead6'], too: ['#5fb4e6', '#ffe0b8'], slo: ['#8fc3ee', '#ffe0b8'], kit: ['#f3e6d3', '#f3e6d3'] };
const dirtAt = t => t < S('s5') + 1 ? 1 : t < E('s5') ? lerp(1, .78, P(t, Wd('s5', 'grudar'), E('s5'))) : t < S('s7') ? lerp(.78, .55, P(t, Wd('s6', 'afundam'), E('s6'))) : t < S('s8') ? lerp(.55, .2, P(t, Wd('s7', 'passa'), E('s7') + .3)) : t < S('s10') ? lerp(.2, .06, P(t, Wd('s8', 'cloro'), E('s8'))) : lerp(.06, 0, P(t, S('s10'), S('s11')));

// ===================================================================================== PER-FRAME STATE
const capEl = document.getElementById('capw'), flashEl = document.getElementById('flash');
const allWords = NARR.lines.flatMap(l => l.words.map((w, i) => ({ ...w, end2: i < l.words.length - 1 ? l.words[i + 1].start : l.end + .12 })));
const tmpc = new THREE.Color();
let cam = { p: V(0, 0, 0), l: V(0, 0, 0), fov: 50 };
function setCam(p, l, fov = 50) { cam.p.copy(p); cam.l.copy(l); cam.fov = fov; }

function setState(t) {
  const shot = shotOf(t), setName = SET_OF[shot];
  for (const k in sets) sets[k].visible = k === setName;
  world.visible = !setName;
  const sc = SKY[setName || 'world']; skyU.top.value.set(sc[0]); skyU.hor.value.set(sc[1]); skyU.sunAmt.value = setName ? 0 : 1;
  if (setName) { scene.fog.near = 1e5; scene.fog.far = 2e5; } else { scene.fog.near = 70; scene.fog.far = 420; scene.fog.color.set('#f3cfa6'); }
  hemi.intensity = setName === 'mic' ? 1.6 : 1.25; camLight.intensity = 0; camLight.distance = 30;
  const gs = { vis: false };

  // ------------- world animation (always cheap) -------------
  if (!setName) {
    updRiver(t);
    for (const m of mudSwirl) { const z = ((m.z0 + t * 1.6) % 90) - 45; m.m.position.set(rx(z) + m.u * 4, -.5 + .06 * Math.sin(t * 2 + m.ph), z); m.m.rotation.y = t * .6 + m.ph; }
    for (const tr of trees) tr.g.rotation.z = Math.sin(t * 1.3 + tr.ph) * .025 * tr.k;
    for (const c of clouds) c.g.position.x = c.x0 + t * 1.2;
    for (const b of birds) { const a = t * b.sp + b.ph; b.g.position.set(b.cx + Math.cos(a) * b.R, b.h + Math.sin(t * .7 + b.ph) * 2, b.cz + Math.sin(a) * b.R); b.g.rotation.y = -a; const f = Math.sin(t * 11 + b.ph) * .6; b.wl.rotation.z = f; b.wr.rotation.z = -f; }
    houses.forEach(h => { const s = t < .05 ? 1 : 1; const a = .05 + h.d * .028; const u = bounce(t, a, .7); h.inner.scale.set(1, Math.max(u, .001), 1); h.inner.position.y = (1 - eo(P(t, a, a + .3))) * 6; });
    // station assembly
    const asm = T_REV;
    pieces.forEach(pc => { const a = asm + .1 + pc.delay * .8; const u = P(t, a, a + .45); pc.g.position.y = pc.y0 + (1 - eo(u)) * 18; pc.g.rotation.y = (1 - eo(u)) * 1.2; const sq = t > a + .45 ? 1 - .18 * Math.exp(-(t - a - .45) * 9) * Math.cos((t - a - .45) * 25) : 1; pc.g.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq)); pc.g.visible = t > a - .01 || t > S('s5'); });
    const fill = eo(P(t, Wd('s3', 'tratamento') - .2, E('s3') + .6)); [sMix, sF1, sF2, sCl].forEach(k => k.userData.water.visible = fill > .01); sDec.userData.water.visible = fill > .01;
    sMix.userData.water.rotation.y = t;
    workers.forEach(w => { const u = .5 + .5 * Math.sin(t * .5 + w.ph); w.g.position.lerpVectors(w.a, w.b, u); w.g.rotation.y = Math.cos(t * .5 + w.ph) > 0 ? Math.PI / 2 : -Math.PI / 2; w.g.position.y = .25 + Math.abs(Math.sin(t * 7 + w.ph)) * .08; });
    // reservoir
    resWater.scale.y = Math.max(lerp(.2, 4.4, eio(P(t, Wd('s10', 'caixa') - .3, Wd('s10', 'alto') + .5))), .001);
    // journey line
    const jd = eio(P(t, Wd('s13', 'próxima'), Wd('s13', 'passou') + .2));
    journey.visible = jd > 0; journeyGeo.setDrawRange(0, Math.floor(journeyGeo.index.count * jd / 3) * 3);
    journeyHead.visible = jd > 0 && jd < 1; if (journeyHead.visible) journeyHead.position.copy(journeyCurve.getPointAt(jd));
    houses.forEach(h => h.inner.children.forEach(c => { if (c.material && c.material.emissive && c.material.color.getHexString() === '5a7fa8') c.material.emissiveIntensity = jd * 1.4; }));
    // river splash
    const sp0 = S('s2') + .2; const GJ = V(rx(5) - 1.5, 0, 5);
    riverSplash.forEach(s => { const u = (t - sp0) / .9; if (u < 0 || u > 1 || shot !== 'river') { s.m.position.y = -99; return; } s.m.position.set(GJ.x + Math.cos(s.a) * s.v * u, -.4 + s.h * u - 4.5 * u * u * .9, GJ.z + Math.sin(s.a) * s.v * u); });
    const ru = P(t, sp0, sp0 + 1.4); ripple.position.set(GJ.x, -.45, GJ.z); ripple.scale.setScalar(.5 + ru * 4); ripple.visible = ru > 0 && ru < 1 && shot === 'river';
  }

  // ------------- shots -------------
  if (shot === 'town') {
    const u = P(t, 0, S('s2'));
    setCam(V(lerp(-8, -22, eio(u)), lerp(34, 22, eio(u)), lerp(72, 54, eio(u))), V(lerp(-40, -43, u), lerp(1, 3, u), lerp(20, 21, u)), 50);
  }
  if (shot === 'river') {
    const GJ = V(rx(5) - 1.5, 0, 5); const jump = S('s2') + .2;
    const ju = P(t, jump, jump + .8);
    let pos = GJ.clone(); pos.y = t < jump ? -3 : lerp(-1.5, .55, eo(ju)) + (ju < 1 ? Math.sin(ju * Math.PI) * 2.2 : 0) + Math.sin(t * 2.6) * .1;
    let sv = null, mood = 'grumpy', px = 0, py = 0;
    if (t < jump + .8) mood = 'scared';
    // suck into the intake
    const su = P(t, T_SUCK, T_TUN);
    if (su > 0) { const k = ei(su); pos.lerp(intakeMouth.clone().add(V(0, .2, 0)), k); sv = [1 - .45 * k, 1 - .3 * k, 1]; mood = 'scared'; px = .08; }
    gs.vis = true; gs.pos = pos; gs.mood = mood; gs.dirt = 1; gs.sv = sv && [sv[0], sv[1], 1 + 1.6 * ei(su)]; gs.ry = su > 0 ? lerp(0, -1.2, su) : -.5 + Math.sin(t * 1.3) * .2; gs.px = px; gs.py = py;
    gs.bugs = 1; gs.bugT = Wd('s2', 'micr') - .15; gs.s = 1.25;
    const u = P(t, S('s2'), T_TUN);
    const look = pos.clone().lerp(intakeMouth, su * .6); look.y = lerp(.6, .4, su);
    setCam(V(GJ.x - 9 + u * 2.5, 3.6 - u * .6, GJ.z + 10 - u * 2.5), look, lerp(46, 40, ei(su)));
  }
  if (shot === 'tun') {
    const o = O('tun'); const u = P(t, T_TUN, T_REV);
    const gz = -u * 95; gs.vis = true; gs.pos = V(o.x + Math.sin(t * 7) * .25, -.3 + Math.sin(t * 5) * .2, gz); gs.mood = 'scared'; gs.dirt = 1; gs.sv = [.85, .9, 1.5]; gs.s = .9; gs.rz = Math.sin(t * 6) * .3;
    setCam(V(o.x + Math.sin(t * 3) * .3, .4, gz + 5.5), V(o.x, -.3, gz - 2), 62);
    camLight.position.set(o.x, 1, gz + 3); camLight.intensity = 26;
    tunBits.forEach(b => b.m.position.set(o.x + b.x, b.y, gz + 6 - ((b.z0 + t * 20) % 60)));
  }
  if (shot === 'station') {
    const u = eio(P(t, T_REV, S('s4')));
    setCam(V(lerp(44, 30, u), lerp(34, 26, u), lerp(44, 36, u)), V(lerp(6, 3, u), 0, lerp(2, 0, u)), 46);
  }
  if (shot === 'mix') {
    const o = O('mix'); updVortex(t);
    const r0 = lerp(3.6, 1.4, P(t, S('s4'), E('s4'))), a = -t * 3.2;
    const gp = V(o.x + Math.cos(a) * r0, 3.3 + vortexDepth(r0, t) + .75, Math.sin(a) * r0);
    gs.vis = true; gs.pos = gp; gs.ry = t * 7; gs.mood = 'dizzy'; gs.dirt = 1; gs.s = .95; gs.rz = .35 * Math.sin(t * 6);
    // arm sweeps & powders
    armJ.rotation.y = Math.sin(t * .9) * .35; armA.rotation.x = .35 + Math.sin(t * 1.3) * .06; armK.rotation.x = -.35 - Math.sin(t * 1.3) * .06; armB.rotation.y = t * 2;
    MIXS.updateMatrixWorld(true); const nz = new THREE.Vector3(); nozzle.getWorldPosition(nz); nz.sub(o);
    const pOn = t > Wd('s4', 'pó') - .2;
    powder.forEach(p => { if (!pOn) { p.m.position.y = -99; return; } const k = ((t - Wd('s4', 'pó')) * 1.3 + p.o) % 1; const rr = 1.8 * k; p.m.position.set(nz.x + p.dx * rr + Math.cos(p.a + t * 3) * k * 1.2, nz.y - .5 - k * (nz.y - 3.1), nz.z + p.dz * rr + Math.sin(p.a + t * 3) * k * 1.2); p.m.rotation.set(t * 4 + p.o * 7, t * 3, 0); });
    const u = eio(P(t, S('s4'), S('s5')));
    // dive into the drop at the end
    const dv = ei(P(t, S('s5') - .45, S('s5')));
    const cp = V(o.x + lerp(4, -1, u), lerp(14, 11.5, u), lerp(13, 11, u)).lerp(gp.clone().add(V(0, .6, 2.2)), dv);
    setCam(cp, V(o.x, 2.4, 0).lerp(gp, dv), lerp(48, 30, dv));
  }
  if (shot === 'mic5' || shot === 'mic8') {
    const o = O('mic');
    bokeh.forEach((b, i) => { b.position.y = Math.sin(t * .3 + i) * 1.5; b.position.x = Math.cos(t * .2 + i) * 1; });
    const f5 = shot === 'mic5';
    grains.forEach(g => g.m.visible = f5); crystals.forEach(c => c.m.visible = f5); bugs.forEach(b => b.g.visible = !f5); chlor.forEach(c => c.m.visible = !f5);
    if (f5) {
      const clump = P(t, Wd('s5', 'grudar') - .3, Wd('s5', 'bolinhas') + .4);
      grains.forEach(g => { const k = eio(cl((clump - g.d * .45) / .6)); const sink = P(t, Wd('s5', 'flocos') - .2, E('s5') + .4) * 1.2;
        g.m.position.set(lerp(g.sx, g.cx, k) + Math.sin(t * 1.7 + g.ph) * .3 * (1 - k), lerp(g.sy, g.cy, k) + Math.sin(t * 1.3 + g.ph) * .3 * (1 - k) - sink, lerp(g.sz, g.cz, k)); g.m.rotation.set(t * .8 + g.ph, t * .6, 0); });
      crystals.forEach(c => { const fall = P(t, S('s5') + c.o * .6, S('s5') + c.o * .6 + 1.3); const st = eio(P(t, Wd('s5', 'grudar') - .3, Wd('s5', 'bolinhas'))); c.m.position.set(lerp(c.x, c.c[0] + .3, st), lerp(14 - fall * 14, c.c[1] + .5, st), lerp(1.5, .9, st)); c.m.rotation.set(t * 2 + c.o, t * 1.5, 0); c.m.scale.setScalar(1 + .3 * Math.sin(t * 8 + c.o * 9)); });
      const u = P(t, S('s5'), S('s6'));
      setCam(V(lerp(-2, 1.5, u), lerp(1.8, .6, u), lerp(26, 21, eio(u))), V(0, lerp(1.6, 1, u), 0), 50);
      const out = ei(P(t, S('s6') - .35, S('s6'))); cam.p.z -= out * 12;
    } else {
      const cOn = t > Wd('s8', 'coloca');
      chlor.forEach(c => { if (!cOn) { c.m.position.y = -99; return; } const k = ((t - Wd('s8', 'coloca')) * .6 * c.sp + c.o) % 1; c.m.position.set(c.x + Math.sin(k * 7 + c.o * 9) * .4, 14 - k * 28, 1.6); c.m.rotation.set(t * 5, t * 3, 0); });
      bugs.forEach(b => {
        const hit = Wd('s8', 'mata') + b.d, dead = b.survivor ? 0 : P(t, hit, hit + .35);
        const scared = cl(P(t, Wd('s8', 'cloro'), Wd('s8', 'cloro') + .3) - (b.survivor ? 0 : 0));
        const s = pop(t, S('s8') - .2 + b.d, .4) * (1 - ei(dead));
        b.inner.scale.setScalar(Math.max(s * 1.35, .001));
        const flee = scared * Math.sin(t * 3 + b.ph) * .6;
        b.g.position.set(b.x + Math.sin(t * 2 + b.ph) * .35 + flee, b.y + Math.sin(t * 3 + b.ph) * .3, Math.sin(t + b.ph) * .4);
        b.g.rotation.y = b.survivor ? Math.sin(t * 4) * .6 : Math.sin(t * .8 + b.ph) * .4;
        animMicrobe(b, t, 1, scared); b.inner.scale.setScalar(Math.max(s * 1.35, .001));
        const pu = P(t, hit + .1, hit + 1.1);
        b.puffs.forEach((p, j) => { if (b.survivor || pu <= 0 || pu >= 1) { p.material.opacity = 0; p.visible = false; return; } p.visible = true; const a = j / 6 * TAU; p.position.set(Math.cos(a) * pu * 1.6, Math.sin(a) * pu * 1.6 + pu * .8, 0); p.scale.setScalar(.6 + pu * 1.4); p.material.opacity = (1 - pu) * .85; });
        b.stars.forEach((st, j) => { if (b.survivor || pu <= 0 || pu >= 1) { st.visible = false; return; } st.visible = true; const a = j / 3 * TAU + .5; st.position.set(Math.cos(a) * pu * 2.4, Math.sin(a) * pu * 2.4 + pu, .5); st.rotation.set(t * 6, t * 4, 0); st.scale.setScalar(1 - pu); });
      });
      const u = P(t, S('s8'), S('s9'));
      setCam(V(lerp(1.5, -1, u), lerp(1, 2, u), lerp(28, 22, eio(u))), V(0, lerp(1, 1.5, u), 0), 50);
      const out = ei(P(t, S('s9') - .35, S('s9'))); cam.p.z -= out * 14;
    }
    cam.p.x += o.x; cam.l.x += o.x;
    const din = 1 - eo(P(t, shot === 'mic5' ? S('s5') : S('s8'), (shot === 'mic5' ? S('s5') : S('s8')) + .45)); cam.fov += din * -18;
  }
  if (shot === 'dec') {
    const o = O('dec'); const u = P(t, S('s6'), S('s7'));
    const sink = P(t, Wd('s6', 'afundam') - .2, Wd('s6', 'decanta') + .4);
    flocsD.forEach(f => { const k = eio(cl((sink - f.d * .5) / .5)); f.g.position.set(f.x + Math.sin(t * 1.2 + f.ph) * .25 * (1 - k), lerp(f.y + Math.sin(t * 1.5 + f.ph) * .15, f.fy, k), f.z); f.g.rotation.set(f.ph + t * .5 * (1 - k), f.ph + t * .3, 0); });
    const sl = eo(P(t, Wd('s6', 'tanque'), Wd('s6', 'decanta') + .8));
    { const p = sludgeG.attributes.position; for (let i = 0; i < p.count; i++) { const x = slBase[i * 3], z = slBase[i * 3 + 2]; p.setY(i, sl * (.35 + Math.max(0, 1.2 - Math.abs(x) * .1) * .7 + .12 * Math.sin(x * 2 + z * 3))); } p.needsUpdate = true; sludgeG.computeVertexNormals(); }
    { const p = decSurfG.attributes.position; for (let i = 0; i < p.count; i++) { const x = dsBase[i * 3], z = dsBase[i * 3 + 2]; p.setY(i, .06 * Math.sin(x * .9 - t * 1.6) + .04 * Math.sin(z * 2 + t)); } p.needsUpdate = true; decSurfG.computeVertexNormals(); }
    const clear = eo(P(t, Wd('s6', 'afundam'), E('s6') + .3));
    decWaterMat.color.set('#8d7347').lerp(tmpc.set('#9cc9c8'), clear); decWaterMat.opacity = lerp(.55, .3, clear); decSurfMat.color.set('#a88a55').lerp(tmpc.set('#a9d8dc'), clear);
    rays.forEach((r, i) => { r.material.opacity = (.18 + .28 * clear) * (.7 + .3 * Math.sin(t * 1.2 + i)); r.rotation.z = .35 + Math.sin(t * .5 + i) * .05; });
    decBubbles.forEach(b => { const k = ((t * .35) + b.o) % 1; b.m.position.set(b.x + Math.sin(k * 9) * .2, 1.4 + k * 5.8, b.z); });
    const gx = lerp(-6, 4, u);
    gs.vis = true; gs.pos = V(o.x + gx, 7.45 + Math.sin(t * 1.6) * .12, .6); gs.mood = t > Wd('s6', 'afundam') ? 'relaxed' : 'neutral'; gs.dirt = dirtAt(t); gs.rz = Math.sin(t * 1.2) * .12; gs.s = 1.1; gs.sq = 1 + .03 * Math.sin(t * 3);
    setCam(V(o.x + lerp(-5, 3, eio(u)), lerp(9.5, 8, u), lerp(20, 17.5, u)), V(o.x + lerp(-3.5, 2.5, u), 4.6, 0), 50);
  }
  if (shot === 'fil') {
    const o = O('fil');
    layerData.forEach((ld, li) => { const t0 = S('s7') + .25 + li * .75; ld.items.forEach((it, i) => { const k = P(t, t0 + it.delay * .55, t0 + it.delay * .55 + .45); const y = it.y + (1 - (k < 1 ? ei(k) : 1)) * it.h0; const sq = k >= 1 ? 1 : 1; dummy.position.set(it.x, k <= 0 ? -99 : y, it.z); dummy.rotation.set(it.ry, it.ry * 2, 0); dummy.scale.setScalar(it.s * sq); dummy.updateMatrix(); ld.im.setMatrixAt(i, dummy.matrix); }); ld.im.instanceMatrix.needsUpdate = true; });
    const go = P(t, Wd('s7', 'passa') - .2, S('s8') - .05);
    const gy = t < Wd('s7', 'passa') ? 9.6 + Math.sin(t * 2) * .15 : lerp(9.6, .9, eio(go));
    const inLayer = gy < 7.9 && gy > .9;
    gs.vis = true; gs.pos = V(o.x + Math.sin(t * 5) * .15 * (inLayer ? 1 : 0), gy, 2.2); gs.dirt = dirtAt(t); gs.s = .85;
    gs.mood = inLayer ? 'squeeze' : t < Wd('s7', 'passa') ? 'scared' : 'neutral'; gs.py = -.06; gs.sq = inLayer ? .82 + .12 * Math.sin(t * 22) : 1 + .03 * Math.sin(t * 4);
    filSpecks.forEach((s, i) => { if (t < Wd('s7', 'passa')) { s.m.position.set(o.x + s.x - o.x * 0 + Math.sin(t * 2 + i) * .8, 9 + Math.sin(t * 1.5 + i) * .9 + (i % 4) * .3, 1.4 + s.z); s.m.position.x = s.x + Math.sin(t * 2 + i) * .8; return; } const y = Math.max(gy + .2, s.stop); s.m.position.set(s.x * .6, y, 2.1 + s.z * .4); });
    filWater.material.color.set('#94b8b4'); camLight.position.set(o.x, 8, 9); camLight.intensity = 60; camLight.distance = 40;
    const u = P(t, S('s7'), S('s8'));
    const camY = t < Wd('s7', 'passa') ? lerp(8, 6.6, eio(P(t, S('s7'), Wd('s7', 'passa')))) : lerp(6.6, 4.6, eio(go));
    setCam(V(o.x + lerp(2.5, -1.5, u), camY + 1.2, lerp(21, 18.5, u)), V(o.x, camY, 0), 50);
    const dv = ei(P(t, S('s8') - .4, S('s8'))); if (dv > 0) { cam.p.lerp(gs.pos.clone().add(V(0, .4, 2.2)), dv); cam.l.lerp(gs.pos, dv); cam.fov -= dv * 18; }
  }
  if (shot === 'too') {
    const o = O('too'); const u = P(t, S('s9'), S('s10'));
    const dropT = Wd('s9', 'flúor') - .45; const du = P(t, dropT, dropT + .45);
    fluDrop.position.set(-2.4, du > 0 && du < 1 ? lerp(6.4, 2.6, du * du) : -99, 0);
    const absorb = P(t, dropT + .45, dropT + 1.1);
    gs.vis = true; gs.pos = V(o.x - 2.4, 1.15 + Math.abs(Math.sin(t * 3)) * .2, 0); gs.dirt = dirtAt(t); gs.mood = t > Wd('s9', 'dentes') ? 'joy' : 'happy'; gs.ry = lerp(0, .5, P(t, Wd('s9', 'proteger'), Wd('s9', 'dentes'))); gs.s = 1.2;
    gs.sq = 1 + .1 * Math.sin(absorb * Math.PI * 3) * (1 - absorb) + .03 * Math.sin(t * 5); gs.spark = absorb > 0 ? 1 - absorb * .3 : 0;
    const tj = Wd('s9', 'proteger') - .25; const ju = P(t, tj, tj + .55);
    tooth.position.y = ju <= 0 ? -12 : ju < 1 ? lerp(-6, 0, eo(ju)) + Math.sin(ju * Math.PI) * 2.5 : 0;
    const land = t > tj + .55 ? Math.exp(-(t - tj - .55) * 7) * Math.cos((t - tj - .55) * 24) : 0; toothIn.scale.set(1 + land * .15, 1 - land * .2, 1 + land * .15);
    tooth.rotation.y = -.3 + Math.sin(t * 1.8) * .15;
    const sh = eo(P(t, Wd('s9', 'dentes') - .1, Wd('s9', 'dentes') + .4)); shield.scale.setScalar(Math.max(sh * (1 + .03 * Math.sin(t * 6)), .001)); shieldRing.scale.setScalar(Math.max(sh, .001)); shieldRing.rotation.set(Math.PI / 2 + Math.sin(t) * .3, t * 1.5, 0);
    tooSparks.forEach((s, i) => { const a = i / 7 * TAU + t * 1.4; s.position.set(Math.cos(a) * 4.2, 3.4 + Math.sin(a * 2) * 2.2, Math.sin(a) * 2); s.scale.setScalar(Math.max(sh * (.6 + .4 * Math.sin(t * 8 + i)), .001)); s.rotation.y = t * 4; });
    bottle.rotation.z = Math.sin(t * 2) * .05; bottle.position.y = 8.2 + Math.sin(t * 1.5) * .15;
    setCam(V(o.x + lerp(-2, 1.5, eio(u)), lerp(8.5, 9, u), lerp(21, 19, u)), V(o.x + lerp(-.1, .3, u), 3.4, 0), 50);
  }
  if (shot === 'res') {
    const up = lerp(.3, 1, eio(P(t, S('s10') + .05, Wd('s10', 'caixa') + .1)));
    const gp = upCurve.getPointAt(Math.min(up, .999));
    const inTank = P(t, Wd('s10', 'caixa') + .1, Wd('s10', 'caixa') + .6);
    let pos = gp.clone(); if (inTank > 0) { pos = V(HILL.x + 2, HILL.y + lerp(6.5, 1.4 + resWater.scale.y + .5, eo(inTank)), HILL.z + 2.4); }
    gs.vis = true; gs.pos = pos; gs.dirt = 0; gs.mood = inTank > 0 ? 'joy' : 'scared'; gs.s = inTank > 0 ? 1.1 : .55; gs.sv = inTank > 0 ? null : [.8, .8, 1.3];
    if (inTank <= 0) { const tg = upCurve.getTangentAt(Math.min(up, .999)); gs.ry = Math.atan2(tg.x, tg.z) + Math.PI; }
    gs.spark = .6;
    const camU = eio(P(t, S('s10'), S('s11')));
    const pA = gp.clone().add(V(9, 6, 15)), pB = V(HILL.x + 16, HILL.y + 8, HILL.z + 22);
    const k = P(t, Wd('s10', 'caixa') - .6, Wd('s10', 'caixa') + .4);
    setCam(pA.clone().lerp(pB, eio(k)).add(V(0, camU * 2, 0)), gp.clone().lerp(V(HILL.x, HILL.y + 4.5, HILL.z), .3 + .7 * eio(k)), 48);
  }
  if (shot === 'slo') {
    const o = O('slo'); const u = P(t, S('s11') + .1, Wd('s11', 'casa') + .3);
    const k = u * u * .55 + u * .45;
    const gp = slCurve.getPointAt(Math.min(k, .999)); const tg = slCurve.getTangentAt(Math.min(k, .999));
    gs.vis = true; gs.pos = gp.clone().add(o); gs.dirt = 0; gs.mood = 'joy'; gs.s = .55; gs.rz = Math.atan2(tg.y, tg.x) * .6; gs.sv = [1.25, .85, 1]; gs.spark = .7;
    speedLines.forEach((s, i) => { const kk = ((t * 2.5) + i / 10) % 1; s.position.copy(gp).add(V(-1.4 - kk * 3, (i % 3 - 1) * .35, .5)); s.scale.x = 1 - kk; s.visible = u > .02 && u < .99; });
    car.position.set(lerp(-18, 14, P(t, S('s11'), S('s12'))), 0, .9); car.position.y = slopeY(car.position.x) + .02; car.rotation.z = Math.atan(-.32); wheels.forEach(w => w.rotation.y = t * 10);
    arrow.position.set(lerp(-6, 6, P(t, S('s11'), S('s12'))), slopeY(0) + 6.5 + Math.sin(t * 4) * .25, .5); arrow.rotation.z = Math.atan(-.32) * .6; arrow.scale.setScalar(Math.max(pop(t, Wd('s11', 'gravidade') - .1, .5), .001));
    setCam(V(o.x + gp.x + .8, gp.y + 5, 20), V(o.x + gp.x + .6, gp.y + 2.8, 0), 50);
  }
  if (shot === 'kit') {
    const o = O('kit'); const u = P(t, S('s12'), S('s13'));
    const open = eo(P(t, Wd('s12', 'sai') - .55, Wd('s12', 'sai') - .1)); fHandle.rotation.y = open * .9;
    const out = Wd('s12', 'sai') - .1; const fu = P(t, out, out + .45);
    const spoutW = V(o.x, 3.3 + SPOUT.y, -1.6 + SPOUT.z);
    const land = out + .45;
    const fill = eo(P(t, land, land + 1.2)); glassWater.scale.y = Math.max(fill * 1.55, .001);
    let pos, sv = null, mood = 'happy';
    if (t < out) { pos = spoutW.clone().add(V(0, -.2 * open, 0)); sv = [open * .5 + .001, open * .4 + .001, open * .5 + .001]; mood = 'scared'; }
    else if (fu < 1) { pos = spoutW.clone().add(V(0, -fu * fu * 2.7, 0)); sv = [.8, 1.35, .8]; mood = 'joy'; }
    else { pos = V(o.x, 3.37 + .08 + fill * 1.55 + .6 + Math.sin(t * 3) * .06, -.1); mood = 'joy'; }
    gs.vis = true; gs.pos = pos; gs.sv = sv; gs.s = .48; gs.dirt = 0; gs.mood = mood; gs.spark = t > land ? 1 : 0; gs.sq = t > land ? 1 + .25 * Math.exp(-(t - land) * 6) * Math.cos((t - land) * 22) : undefined;
    splash.forEach(s => { const k = (t - land) / .8; if (k < 0 || k > 1) { s.m.position.y = -99; return; } s.m.position.set(o.x + Math.cos(s.a) * s.v * k * .7, 3.37 + .3 + s.h * k - 5 * k * k, -.1 + Math.sin(s.a) * s.v * k * .7); });
    plant.rotation.z = Math.sin(t * 1.4) * .03;
    setCam(V(o.x + lerp(3.5, 1.2, eio(u)), lerp(7.5, 6.4, u), lerp(11, 7.6, eio(u))), V(o.x, lerp(4.6, 5, u), -.5), 50);
  }
  if (shot === 'final') {
    const u = eio(P(t, S('s13'), DUR - .4));
    const hp = HOME.clone();
    setCam(hp.clone().add(V(lerp(8, 40, u), lerp(20, 70, u), lerp(24, 70, u))), hp.clone().lerp(V(-6, 0, -6), u).add(V(0, lerp(2, 0, u), 0)), lerp(46, 50, u));
  }

  // ------------- whip / dive transitions -------------
  let whip = 0, blur = 0, flash = 0;
  for (const c of CUTS) {
    const d = t - c.t, k = 1 - Math.abs(d) / .17;
    if (k <= 0) continue;
    if (c.k === 'whip') { const e = k * k; whip += (d < 0 ? 1 : -1) * c.d * e * .55; blur = Math.max(blur, e); }
    else { flash = Math.max(flash, k * k); blur = Math.max(blur, k * .4); }
  }
  const dir = cam.l.clone().sub(cam.p); dir.applyAxisAngle(V(0, 1, 0), whip); cam.l.copy(cam.p).add(dir);
  camera.position.copy(cam.p); camera.position.x += Math.sin(t * .9) * .06; camera.position.y += Math.sin(t * 1.3 + 1) * .05;
  camera.fov = cam.fov; camera.updateProjectionMatrix(); camera.lookAt(cam.l);
  blurPass.uniforms.amount.value = blur * .09; blurPass.uniforms.dir.value.set(1, 0);
  flashEl.style.opacity = (flash * .9).toFixed(3);
  sky.position.copy(camera.position);
  aimSun(setName ? O(setName).clone().add(V(cam.l.x - O(setName).x, 0, 0)) : cam.l.clone().setY(0));
  applyGota(gs, t);
}

function uiAt(t) {
  let cur = null; for (const w of allWords) if (t >= w.start && t < w.end2) cur = w;
  if (cur) {
    const word = cur.w.charAt(0).toUpperCase() + cur.w.slice(1);
    capEl.textContent = word; capEl.style.color = cur.hl ? '#FFD21F' : '#ffffff';
    const s = .7 + .3 * back(P(t, cur.start, cur.start + .12)); capEl.style.transform = `scale(${s.toFixed(3)}) rotate(${(cur.hl ? -2 : 0)}deg)`;
    capEl.style.fontSize = word.length > 9 ? '104px' : '124px';
  } else capEl.textContent = '';
  camera.updateMatrixWorld();
  for (const l of labs) {
    if (t < l.t0 || t > l.t1) { l.el.style.display = 'none'; continue; }
    const v = l.posFn().clone().project(camera);
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
  scene.traverseVisible(o => { if (o !== scene && Math.min(Math.abs(o.scale.x), Math.abs(o.scale.y), Math.abs(o.scale.z)) < .003) { o.visible = false; autoHidden.push(o); } });
}
window.renderAt = t => { setState(t); hideCollapsed(); uiAt(t); composer.render(); };
window.DURATION = DUR;
await document.fonts.load('900 100px Inter');
window.renderAt(0);
window.READY = true;
