// Como o corpo fecha um corte — "A Plaqueta". Low-poly 3D explainer, own world ("inside the body"), guide character,
// diorama sets, whip/dive transitions and post-processing. Everything is a pure function of time t.
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


scene.fog.near = 1e5; scene.fog.far = 2e5;
const sets = {};
function set(name, x) { const g = G(); g.position.set(x, 0, 0); g.visible = false; sets[name] = g; return g; }
const O = n => sets[n].position;
const SKIN = '#f2c09f', SKIN_D = '#e2a682', RBC = '#d9283c';
const glow = (c, k) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k) });
function bokehField(parent, n, cols, spread, z0, z1, sizes, seed) {
  const r = rng(seed), out = [];
  for (const [cnt, size, op] of sizes) {
    const pos = new Float32Array(cnt * 3), col = new Float32Array(cnt * 3);
    for (let i = 0; i < cnt; i++) { pos.set([(r() - .5) * spread[0], (r() - .5) * spread[1] + spread[2], z0 + r() * (z1 - z0)], i * 3); const c = new THREE.Color(cols[Math.floor(r() * cols.length)]); col.set([c.r, c.g, c.b], i * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const p = new THREE.Points(g, new THREE.PointsMaterial({ size, map: softDot, transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true, sizeAttenuation: true }));
    parent.add(p); out.push(p);
  }
  return out;
}
// red blood cell (donut-ish disc)
const rbcGeo = new THREE.TorusGeometry(.52, .34, 10, 22);
const rbcMat = SM(RBC, { roughness: .32 });
const RBCm = (parent, s = 1) => { const m = mk(rbcGeo, rbcMat, 0, 0, 0, parent, false); m.scale.setScalar(s); return m; };

// ===================================================================================== PLAQ (guide character)
function makePlaq() {
  const root = G(), body = G(root);
  const mat = new THREE.MeshPhysicalMaterial({ color: '#ffc94d', roughness: .3, clearcoat: .8, clearcoatRoughness: .3, emissive: '#ff9a1a', emissiveIntensity: .12 });
  const shell = mk(new THREE.SphereGeometry(1, 32, 18), mat, 0, 0, 0, body); shell.scale.set(1.15, .55, 1.15); shell.castShadow = true;
  const gr = rng(5); for (let i = 0; i < 9; i++) { const a = gr() * TAU, rr = gr() * .7; mk(new THREE.SphereGeometry(.09 + gr() * .06, 8, 6), SM('#e39a1f'), Math.cos(a) * rr, .5, Math.sin(a) * rr * .6 - .2, body, false); }
  const spikes = []; for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; const s = mk(new THREE.ConeGeometry(.2, .9, 8), SM('#ffb52e', { emissive: '#ff8a00', emissiveIntensity: .25 }), Math.cos(a) * 1.15, 0, Math.sin(a) * 1.15, body, false); s.rotation.set(0, 0, 0); s.lookAt(V(Math.cos(a) * 3, 0, Math.sin(a) * 3)); s.rotateX(Math.PI / 2); spikes.push(s); }
  const lids = [], pupils = []; const black = SM('#141414', { roughness: .3 });
  for (const k of [-1, 1]) {
    const e = G(body); e.position.set(k * .36, .12, .92);
    mk(new THREE.SphereGeometry(.24, 16, 12), SM('#ffffff', { roughness: .3 }), 0, 0, 0, e, false);
    const pu = G(e); pu.position.z = .19; pupils.push(pu); mk(new THREE.SphereGeometry(.12, 12, 10), black, 0, 0, 0, pu, false); mk(new THREE.SphereGeometry(.035, 6, 5), new THREE.MeshBasicMaterial({ color: '#ffffff' }), .04, .05, .1, pu, false);
    const lid = G(e); mk(new THREE.SphereGeometry(.26, 16, 8, 0, TAU, 0, Math.PI / 2), mat, 0, 0, 0, lid, false); lid.userData.k = k; lids.push(lid);
  }
  const mouths = { smile: mk(new THREE.TorusGeometry(.15, .045, 6, 16, Math.PI), black, 0, -.14, 1.0, body, false), o: mk(new THREE.TorusGeometry(.08, .04, 6, 14), black, 0, -.16, 1.0, body, false), grin: mk(new THREE.SphereGeometry(.18, 14, 8, 0, TAU, Math.PI / 2, Math.PI / 2), SM('#5a1d1d'), 0, -.1, .96, body, false), frown: mk(new THREE.TorusGeometry(.12, .04, 6, 16, Math.PI), black, 0, -.24, 1.0, body, false) };
  mouths.smile.rotation.z = Math.PI; mouths.grin.rotation.x = -.35; mouths.grin.scale.set(1.1, .8, .6);
  const cheeks = [-1, 1].map(k => { const c = mk(new THREE.SphereGeometry(.12, 10, 8), SM('#ff8f6a', { transparent: true, opacity: .8 }), k * .66, -.05, .8, body, false); c.scale.set(1, .6, .4); return c; });
  const arms = [-1, 1].map(k => { const a = G(body); a.position.set(k * 1.1, 0, .2); mk(new THREE.CapsuleGeometry(.1, .5, 3, 6), SM('#ffb52e'), k * .3, 0, 0, a, false).rotation.z = Math.PI / 2; return a; });
  root.visible = false;
  return { root, body, mat, spikes, lids, pupils, mouths, cheeks, arms };
}
const plaq = makePlaq();
function applyPlaq(st, t) {
  const g = plaq; g.root.visible = !!st.vis; if (!st.vis) return;
  g.root.position.copy(st.pos); g.root.rotation.set(st.rx || 0, st.ry || 0, st.rz || 0); g.root.scale.setScalar(st.s ?? 1);
  const sq = st.sq ?? (1 + .05 * Math.sin(t * 5)); g.body.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
  const act = st.act ?? 0; g.spikes.forEach((s, i) => s.scale.setScalar(Math.max(act * (.85 + .15 * Math.sin(t * 9 + i)), .001)));
  g.mat.color.set('#ffc94d').lerp(tmpc.set('#ffa22e'), act * .6);
  const mood = st.mood || 'happy';
  const blink = Math.max(0, 1 - Math.abs(((t + .3) % 3.1) - .1) / .09);
  let lid = { happy: .15, scared: 0, determined: .45, joy: .1, worried: .3 }[mood] ?? .15; lid = Math.max(lid, blink);
  g.lids.forEach(l => { l.rotation.x = lerp(-1.55, 1.5, lid); l.rotation.z = mood === 'determined' ? -l.userData.k * .4 : mood === 'worried' ? l.userData.k * .35 : 0; });
  g.pupils.forEach(p => { p.position.x = st.px ?? 0; p.position.y = st.py ?? 0; p.scale.setScalar(mood === 'scared' ? .7 : 1); });
  const mm = { happy: 'smile', scared: 'o', determined: 'frown', joy: 'grin', worried: 'o' }[mood];
  for (const k in g.mouths) g.mouths[k].visible = k === mm;
  g.cheeks.forEach(c => c.visible = mood === 'joy' || mood === 'happy');
  const wave = st.wave ?? 0; g.arms.forEach((a, i) => { a.rotation.z = (i ? 1 : -1) * (.3 + wave * (1 + .5 * Math.sin(t * 12))) ; a.rotation.y = 0; });
}

// ===================================================================================== DESK (s1, s12, s13)
const DESK = set('desk', 0);
mk(RBOX(70, 1, 44, .3), M('#b07a4e', { roughness: .6 }), 0, -.5, -6, DESK);
for (let i = 0; i < 9; i++) mk(BOX(70, .02, .12), M('#94623a'), 0, .01, -26 + i * 5.2 + Math.sin(i) * .8, DESK, false);
bokehField(DESK, 0, ['#ffcf8a', '#ff9f7a', '#ffe6b0'], [90, 40, 14], -40, -26, [[40, 3.5, .35], [20, 7, .22]], 41);
mk(BOX(120, 60, 1), M('#5b3a3a'), 0, 20, -46, DESK, false);
{ const mug = G(DESK); mug.position.set(-13, 0, -9); mk(CYL(1.6, 1.4, 3.6, 24), SM('#3d7fd6', { roughness: .35 }), 0, 1.8, 0, mug); mk(new THREE.TorusGeometry(.9, .22, 8, 16), SM('#3d7fd6'), 1.7, 1.9, 0, mug).rotation.y = 0; mk(CYL(1.45, 1.45, .1, 24), SM('#4a2a18', { roughness: .2 }), 0, 3.4, 0, mug); }
{ const pencil = G(DESK); pencil.position.set(9, .35, 5); pencil.rotation.y = .6; mk(CYL(.3, .3, 7, 6), M('#f2c94c'), 0, 0, 0, pencil).rotation.z = Math.PI / 2; mk(new THREE.ConeGeometry(.3, .9, 6), M('#e8c9a0'), 3.95, 0, 0, pencil).rotation.z = -Math.PI / 2; mk(CYL(.32, .32, .8, 6), M('#e2483d'), -3.8, 0, 0, pencil).rotation.z = Math.PI / 2; }
for (let i = 0; i < 3; i++) mk(RBOX(9, .5, 6.5, .1), M(['#e2483d', '#2bb3a3', '#f3efe4'][i]), -9 + i * .3, .25 + i * .5, -16 + i * .2, DESK);
// calendar
const calTex = n => canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h); g.fillStyle = '#e2483d'; g.fillRect(0, 0, w, 70); g.fillStyle = '#fff'; g.font = 'bold 44px Inter, sans-serif'; g.textAlign = 'center'; g.fillText('NOV', w / 2, 52); g.fillStyle = '#222'; g.font = '900 130px Inter, sans-serif'; g.fillText(String(n), w / 2, 205); });
const cal = G(DESK); cal.position.set(6.5, 0, -5.5); cal.rotation.y = -.25;
mk(RBOX(5, .6, 2.2, .1), M('#3a3f46'), 0, .3, 0, cal); mk(BOX(4.6, 4.6, .3), M('#3a3f46'), 0, 2.8, -.6, cal).rotation.x = -.15;
const calPages = [15, 14, 13, 12].map((n, i) => { const pv = G(cal); pv.position.set(0, 5, -.35 + i * .02); pv.rotation.x = -.15; const pg = mk(new THREE.PlaneGeometry(4.2, 4.2), new THREE.MeshStandardMaterial({ map: calTex(n), side: THREE.DoubleSide, roughness: .8 }), 0, -2.15, .02, pv, false); return pv; });
for (let i = 0; i < 4; i++) mk(new THREE.TorusGeometry(.18, .05, 6, 12), SM('#c7cdd2', { metalness: .6 }), -1.5 + i, 5, -.4, cal, false);
// hand
const HAND = G(DESK); HAND.position.set(-3.5, 3.4, 0);
const skinM = SM(SKIN, { roughness: .55 }), nailM = SM('#f7d6c8', { roughness: .25 });
mk(RBOX(5, 1.9, 4.6, .8), skinM, 0, 0, 0, HAND);
mk(CYL(1.9, 2.1, 9, 20), skinM, -6.5, -.2, 0, HAND).rotation.z = Math.PI / 2;
mk(CYL(2.15, 2.2, 1.4, 20), SM('#2bb3a3'), -4.2, -.2, 0, HAND).rotation.z = Math.PI / 2;
function finger(z, r, lens, y = 0) {
  const base = G(HAND); base.position.set(2.2, y, z); const joints = [base]; let parent = base;
  lens.forEach((L, i) => { const j = i === 0 ? base : G(parent); if (i > 0) j.position.x = lens[i - 1]; mk(new THREE.CapsuleGeometry(r * (1 - i * .06), L, 4, 12), skinM, L / 2, 0, 0, j).rotation.z = Math.PI / 2; if (i > 0) joints.push(j); parent = j; });
  const tip = mk(new THREE.SphereGeometry(r * .62, 12, 8), nailM, lens[lens.length - 1] * .78, r * .62, 0, parent, false); tip.scale.set(1.2, .35, 1);
  return joints;
}
const fIndex = finger(1.55, .58, [1.7, 1.3, 1.1], .15), fMid = finger(.5, .6, [1.8, 1.3, 1.05]), fRing = finger(-.6, .56, [1.7, 1.2, 1]), fPinky = finger(-1.6, .48, [1.4, 1, .9], -.1);
const thumbB = G(HAND); thumbB.position.set(.6, .2, 2.3); thumbB.rotation.y = -.7;
const fThumb = (() => { const b = G(thumbB); mk(new THREE.CapsuleGeometry(.62, 1.6, 4, 12), skinM, .8, 0, 0, b).rotation.z = Math.PI / 2; const j = G(b); j.position.x = 1.6; mk(new THREE.CapsuleGeometry(.56, 1.1, 4, 12), skinM, .55, 0, 0, j).rotation.z = Math.PI / 2; const n = mk(new THREE.SphereGeometry(.36, 12, 8), nailM, .85, .36, 0, j, false); n.scale.set(1.2, .35, 1); return [b, j]; })();
const cutMark = mk(new THREE.CapsuleGeometry(.05, .8, 3, 6), SM('#9e1028', { emissive: '#7a0010', emissiveIntensity: .3 }), .55, 0, .58, fIndex[2], false);
const bloodDrop = mk(new THREE.SphereGeometry(.45, 20, 14), new THREE.MeshPhysicalMaterial({ color: '#c0102a', roughness: .1, clearcoat: 1, emissive: '#5a0010', emissiveIntensity: .2 }), .55, -.25, .7, fIndex[2], false);
const scab = mk(RBOX(.35, 1.0, .25, .1), M('#5a2e1a', { roughness: .9 }), .55, 0, .6, fIndex[2], false);
const paperTex = canvasTex(256, 320, (g, w, h) => { g.fillStyle = '#fbfaf5'; g.fillRect(0, 0, w, h); g.strokeStyle = '#9ec8ea'; g.lineWidth = 2; for (let y = 40; y < h; y += 22) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); } g.strokeStyle = '#f29aa6'; g.beginPath(); g.moveTo(40, 0); g.lineTo(40, h); g.stroke(); });
const paper = mk(new THREE.BoxGeometry(6, 7.5, .03), new THREE.MeshStandardMaterial({ map: paperTex, roughness: .9 }), 0, 0, 0, DESK);
const healSparks = []; for (let i = 0; i < 6; i++) healSparks.push(mk(new THREE.OctahedronGeometry(.16, 0), glow('#fff6b0', 2.5), 0, 0, 0, DESK, false));
function setFingers(thumbsUp) {
  const k = eio(thumbsUp);
  [fMid, fRing, fPinky].forEach((f, i) => { f[0].rotation.z = -1.25 - i * .05; f[1].rotation.z = -1.35; f[2].rotation.z = -1.1; });
  fIndex[0].rotation.z = lerp(.05, -1.2, k); fIndex[1].rotation.z = lerp(.02, -1.35, k); fIndex[2].rotation.z = lerp(0, -1.1, k);
  thumbB.rotation.set(0, lerp(-.7, -1.5, k), 0); fThumb[1].rotation.z = lerp(.1, 0, k);
  HAND.rotation.x = -k * Math.PI / 2;
}

// ===================================================================================== SKIN cross-section (s2, s9, s10, s11)
const SKS = set('skin', 300);
const NOTCH_B = 1.7, TOP = 8;
const hw = y => .35 + (y - NOTCH_B) / (TOP - NOTCH_B) * 2.9;
function layer(y0, y1, col, notched, z0 = -6, z1 = 6) {
  const shapes = [];
  if (!notched) { const s = new THREE.Shape(); s.moveTo(-22, y0); s.lineTo(22, y0); s.lineTo(22, y1); s.lineTo(-22, y1); s.closePath(); shapes.push(s); }
  else for (const k of [-1, 1]) { const s = new THREE.Shape(); s.moveTo(22 * k, y0); s.lineTo(22 * k, y1); s.lineTo(hw(y1) * k, y1); s.lineTo(hw(y0) * k, y0); s.closePath(); shapes.push(s); }
  const geo = new THREE.ExtrudeGeometry(shapes, { depth: z1 - z0, bevelEnabled: false }); geo.translate(0, 0, z0);
  return mk(geo, M(col, { roughness: .7 }), 0, 0, 0, SKS);
}
layer(-7, 0, '#ffd77a', false); layer(0, NOTCH_B, '#f0909e', false); layer(NOTCH_B, 6.6, '#f29aa6', true); layer(6.6, TOP, SKIN, true);
mk(BOX(44.2, .25, 12.2), M('#e8b08f'), 0, TOP + .02, 0, SKS).visible = false;
{ const r = rng(51); for (let i = 0; i < 60; i++) { const x = -21.5 + (i % 30) * 1.45 + (i >= 30 ? .7 : 0), y = i >= 30 ? 7.0 : 7.65; if (Math.abs(x) < hw(y) + .5) continue; const c = mk(RBOX(1.3, .6, .4, .12), SM(i % 3 ? '#f6cdb0' : '#efbf9f'), x, y, 6.05, SKS, false); mk(new THREE.SphereGeometry(.13, 8, 6), SM('#c2685a'), x, y, 6.25, SKS, false); }
  for (let i = 0; i < 22; i++) { const x = -21 + r() * 42, y = -6.5 + r() * 6; mk(new THREE.SphereGeometry(.8 + r() * .6, 14, 10), SM('#ffe08a', { roughness: .4 }), x, y, 6, SKS, false).scale.z = .35; }
  for (let i = 0; i < 16; i++) { const x = -21 + r() * 42; if (Math.abs(x) < 4) continue; const pts = []; for (let k = 0; k < 6; k++) pts.push(V(x + Math.sin(k + i) * .6, 2 + k * .8, 6.05)); mk(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 20, .08, 5), SM('#f7c0c8'), 0, 0, 0, SKS, false); } }
// vessel (segments that can constrict) at front face
const VES_Y = .85, VES_Z = 5.4;
const vesSegs = []; for (let i = 0; i < 44; i++) { const x = -21.5 + i; const m = mk(new THREE.CylinderGeometry(1.1, 1.1, 1.02, 20, 1, true), new THREE.MeshStandardMaterial({ color: '#c2324a', transparent: true, opacity: .55, roughness: .3, side: THREE.DoubleSide, depthWrite: false }), x, VES_Y, VES_Z, SKS, false); m.rotation.z = Math.PI / 2; m.renderOrder = 3; vesSegs.push({ m, x }); }
const vesRBC = []; { const r = rng(52); for (let i = 0; i < 34; i++) vesRBC.push({ m: RBCm(SKS, .75), o: r(), y: (r() - .5) * 1, z: (r() - .5) * .9, ph: r() * 6 }); }
const leak = []; { const r = rng(53); for (let i = 0; i < 28; i++) leak.push({ m: RBCm(SKS, .6), o: r(), dx: (r() - .5) * 2, ph: r() * 6 }); }
// clot/scab fill + new tissue
function notchFill(y0, y1, col, z0 = -5.9, z1 = 5.9) { const s = new THREE.Shape(); s.moveTo(-hw(y0), y0); s.lineTo(hw(y0), y0); s.lineTo(hw(y1), y1); s.lineTo(-hw(y1), y1); s.closePath(); const g = new THREE.ExtrudeGeometry(s, { depth: z1 - z0, bevelEnabled: false }); g.translate(0, 0, z0); return mk(g, M(col, { roughness: .8 }), 0, 0, 0, SKS); }
const clotFill = notchFill(NOTCH_B, TOP + .5, '#8a1424'); const clotMat = clotFill.material = new THREE.MeshStandardMaterial({ color: '#8a1424', roughness: .6, flatShading: true });
const cracks = []; { const r = rng(54); for (let i = 0; i < 10; i++) { const m = mk(BOX(.06, .05, 1.4 + r() * 2), M('#2a120a'), (r() - .5) * 5, TOP + .53, (r() - .5) * 9, SKS, false); m.rotation.y = r() * 3; cracks.push(m); } }
const dermFillG = (() => { const s = new THREE.Shape(); s.moveTo(-hw(NOTCH_B), NOTCH_B); s.lineTo(hw(NOTCH_B), NOTCH_B); s.lineTo(hw(6.6), 6.6); s.lineTo(-hw(6.6), 6.6); s.closePath(); const g = new THREE.ExtrudeGeometry(s, { depth: 11.6, bevelEnabled: false }); g.translate(0, -NOTCH_B, -5.8); return g; })();
const dermFill = mk(dermFillG, M('#f7a8b4'), 0, NOTCH_B, 0, SKS); dermFill.scale.y = .001;
const newCells = []; { for (let row = 0; row < 2; row++) for (let i = 0; i < 9; i++) { const side = i % 2 ? 1 : -1, k = Math.floor(i / 2); const c = G(SKS); mk(RBOX(1.25, .6, .4, .12), SM(row ? '#f6cdb0' : '#f9d9c2'), 0, 0, 0, c, false); mk(new THREE.SphereGeometry(.13, 8, 6), SM('#c2685a'), 0, 0, .2, c, false); newCells.push({ c, row, side, k, y: row ? 7.0 : 7.65 }); } }
const capillaries = []; { const r = rng(57); for (let i = 0; i < 7; i++) { const pts = []; let x = (r() - .5) * 2, y = NOTCH_B + .2; for (let k = 0; k < 7; k++) { pts.push(V(x, y, 5.95)); x += (r() - .5) * 1.4; y += .65; } const curve = new THREE.CatmullRomCurve3(pts); const g = new THREE.TubeGeometry(curve, 50, .12, 6); const m = mk(g, SM('#e8233f', { emissive: '#b0001a', emissiveIntensity: .35 }), 0, 0, 0, SKS, false); g.setDrawRange(0, 0); capillaries.push({ m, g, d: i * .12 }); } }
const collagen = []; { const r = rng(58); for (let i = 0; i < 9; i++) { const pts = []; const y0 = NOTCH_B + .6 + i * .5; for (let k = 0; k <= 12; k++) { const x = -hw(y0) + k / 12 * hw(y0) * 2; pts.push(V(x, y0 + Math.sin(k * 1.3 + i) * .18, 6.0 + Math.cos(k * 1.3 + i) * .1)); } const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, .09, 6); const m = mk(g, SM('#fff0f3', { emissive: '#ffc2cf', emissiveIntensity: .3 }), 0, 0, 0, SKS, false); g.setDrawRange(0, 0); collagen.push({ m, g, d: i * .09 }); } }
bokehField(SKS, 0, ['#ff9fae', '#ffd2a8'], [80, 50, 5], -40, -25, [[40, 3, .3]], 59);

// ===================================================================================== VESSEL interior (s3)
const VESS = set('ves', 600);
const tunG = new THREE.CylinderGeometry(4.2, 4.2, 220, 32, 60, true); tunG.rotateX(Math.PI / 2);
{ const p = tunG.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const a = Math.atan2(y, x); const k = 1 + .06 * Math.sin(z * .5 + a * 3) + .04 * Math.sin(a * 8); p.setX(i, x * k); p.setY(i, y * k); } tunG.computeVertexNormals(); }
mk(tunG, new THREE.MeshStandardMaterial({ color: '#b8233c', roughness: .35, side: THREE.BackSide, emissive: '#3a0010', emissiveIntensity: .4 }), 0, 0, -100, VESS, false);
const vRBC = []; { const r = rng(61); for (let i = 0; i < 90; i++) { const a = r() * TAU, rr = .8 + r() * 2.8; vRBC.push({ m: RBCm(VESS, .95 + r() * .3), x: Math.cos(a) * rr, y: Math.sin(a) * rr, z0: r() * 120, sp: 10 + r() * 6, rx: r() * 6, ry: r() * 6 }); } }
const vPlat = []; { const r = rng(62); for (let i = 0; i < 12; i++) { const m = mk(new THREE.SphereGeometry(.45, 14, 10), SM('#ffc94d', { emissive: '#ff9a1a', emissiveIntensity: .15 }), 0, 0, 0, VESS, false); m.scale.set(1, .5, 1); const a = r() * TAU, rr = 1 + r() * 2.5; vPlat.push({ m, x: Math.cos(a) * rr, y: Math.sin(a) * rr, z0: r() * 60, ph: r() * 6 }); } }
bokehField(VESS, 0, ['#ffd27a', '#ff9f8a'], [7, 7, 0], -200, 10, [[120, .35, .6]], 63);

// ===================================================================================== CLOT (s4, s5, s6)
const CLO = set('clot', 900);
const wallG = new THREE.RingGeometry(2.4, 40, 64, 12); { const p = wallG.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setZ(i, .25 * Math.sin(x * .7) * Math.sin(y * .6) - Math.max(0, 3.4 - Math.hypot(x, y)) * .35); } wallG.computeVertexNormals(); }
mk(wallG, new THREE.MeshStandardMaterial({ color: '#c2324a', roughness: .4, flatShading: true, side: THREE.DoubleSide }), 0, 0, 0, CLO, false);
mk(new THREE.TorusGeometry(2.45, .35, 10, 40), SM('#a51e36'), 0, 0, -.25, CLO, false);
mk(new THREE.CircleGeometry(6, 32), new THREE.MeshBasicMaterial({ color: '#2a0610' }), 0, 0, -4, CLO, false);
bokehField(CLO, 0, ['#ffd27a', '#ff9f8a', '#ffffff'], [40, 60, 0], 3, 14, [[70, .3, .55], [14, 1.2, .25]], 71);
// plug platelets (spiral into the hole)
const plugP = []; { const r = rng(72); for (let i = 0; i < 26; i++) { const a = i * 2.4, rr = 2.3 * Math.sqrt(1 - i / 26) + .1; const m = G(CLO); const b = mk(new THREE.SphereGeometry(.55, 14, 10), SM('#ffc94d', { emissive: '#ff9a1a', emissiveIntensity: .15 }), 0, 0, 0, m, false); b.scale.set(1, .5, 1); const sp = []; for (let k = 0; k < 8; k++) { const aa = k / 8 * TAU; const c = mk(new THREE.ConeGeometry(.1, .45, 6), SM('#ffb52e'), Math.cos(aa) * .55, 0, Math.sin(aa) * .55, m, false); c.lookAt(V(Math.cos(aa) * 3, 0, Math.sin(aa) * 3)); c.rotateX(Math.PI / 2); sp.push(c); } m.rotation.x = Math.PI / 2;
  plugP.push({ m, sp, tx: Math.cos(a) * rr, ty: Math.sin(a) * rr, tz: .2 + (i % 3) * .25, sx: -14 - r() * 6, sy: (r() - .5) * 10, d: i / 26, ph: r() * 6 }); } }
const fibrin = []; { const r = rng(73); for (let i = 0; i < 46; i++) { const a = r() * TAU, b = a + Math.PI + (r() - .5) * 1.6, ra = 2.2 + r() * 2.5, rb = 2.2 + r() * 2.5; const A = V(Math.cos(a) * ra, Math.sin(a) * ra, .9 + r() * .8), B = V(Math.cos(b) * rb, Math.sin(b) * rb, .9 + r() * .8); const len = A.distanceTo(B); const g = new THREE.CylinderGeometry(.03, .03, len, 5); g.translate(0, len / 2, 0); const m = mk(g, glow('#fff1c2', .85), A.x, A.y, A.z, CLO, false); m.quaternion.setFromUnitVectors(V(0, 1, 0), B.clone().sub(A).normalize()); m.scale.y = .001; fibrin.push({ m, d: r() }); } }
const trapped = []; { const r = rng(74); for (let i = 0; i < 24; i++) { const a = r() * TAU, rr = r() * 3.6; trapped.push({ m: RBCm(CLO, .9), tx: Math.cos(a) * rr, ty: Math.sin(a) * rr, tz: 1.1 + r() * .9, sx: -18 + r() * 4, sy: (r() - .5) * 12, d: r(), rx: r() * 6, ry: r() * 6 }); } }
const flowRBC = []; { const r = rng(75); for (let i = 0; i < 30; i++) flowRBC.push({ m: RBCm(CLO, .9), y: (r() - .5) * 18, z: 2.5 + r() * 5, x0: r() * 50, rx: r() * 6, ry: r() * 6 }); }
const squirt = []; { const r = rng(76); for (let i = 0; i < 8; i++) squirt.push({ m: RBCm(CLO, .5), a: r() * TAU, o: r() }); }

// ===================================================================================== BACTERIA vs WHITE CELLS (s7, s8)
const BAC = set('bac', 1200);
mk(new THREE.PlaneGeometry(120, 120), M('#e88a98', { roughness: .8 }), 0, 0, -12, BAC, false);
{ const r = rng(81); for (let i = 0; i < 26; i++) { const pts = []; let x = (r() - .5) * 40, y = (r() - .5) * 40, z = -10 + r() * 6; const a = r() * TAU; for (let k = 0; k < 6; k++) { pts.push(V(x, y, z)); x += Math.cos(a) * 5 + (r() - .5) * 2; y += Math.sin(a) * 5 + (r() - .5) * 2; } mk(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, .25 + r() * .3, 6), SM(r() < .5 ? '#f7c0c8' : '#f3a7b4'), 0, 0, 0, BAC, false); } }
bokehField(BAC, 0, ['#ffe1e6', '#ffd27a'], [40, 60, 0], -6, 10, [[70, .35, .5], [16, 1.3, .2]], 82);
const bVessel = mk(CYL(2.6, 2.6, 60, 24, true), new THREE.MeshStandardMaterial({ color: '#c2324a', roughness: .35, side: THREE.DoubleSide }), -9.5, 0, -3, BAC, false);
const bacteria = []; { const r = rng(83);
  for (let i = 0; i < 7; i++) { const g = G(BAC); const inner = G(g);
    const body = mk(new THREE.CapsuleGeometry(.42, 1.0, 4, 10), SM(i % 2 ? '#6ccf4a' : '#58b83c', { roughness: .4 }), 0, 0, 0, inner); body.rotation.z = Math.PI / 2;
    for (let k = 0; k < 8; k++) mk(new THREE.SphereGeometry(.07, 6, 5), SM('#3f8f2a'), -.6 + k * .17, (k % 2 ? .3 : -.3), .3, inner, false);
    for (const s of [-1, 1]) { mk(new THREE.SphereGeometry(.17, 10, 8), SM('#ffffff'), .35 + s * .2, .12, .32, inner, false); mk(new THREE.SphereGeometry(.09, 8, 6), SM('#141414'), .37 + s * .2, .1, .46, inner, false); const br = mk(BOX(.3, .06, .06), SM('#1e3a12'), .35 + s * .2, .33, .4, inner, false); br.rotation.z = s * -.45; }
    const tail = []; for (let k = 0; k < 4; k++) tail.push(mk(new THREE.SphereGeometry(.08, 6, 5), SM('#58b83c'), -1.0 - k * .22, 0, 0, inner, false));
    const sx = 6 + r() * 4, sy = 12 + r() * 6;
    bacteria.push({ g, inner, tail, sx, sy, tx: -2 + r() * 7, ty: -5 + r() * 11, d: i * .12, ph: r() * 6, eat: i < 4 ? 0 : 1 }); } }
// white blood cells: wobbly blobs
const wbcs = []; for (let i = 0; i < 2; i++) {
  const g = G(BAC); const geo = new THREE.IcosahedronGeometry(2.6, 4); const base = geo.attributes.position.array.slice();
  const m = mk(geo, new THREE.MeshPhysicalMaterial({ color: '#efe6ff', roughness: .25, transmission: 0, transparent: true, opacity: .78, clearcoat: .6, depthWrite: false }), 0, 0, 0, g, false); m.renderOrder = 3;
  const nuc = G(g); for (let k = 0; k < 3; k++) mk(new THREE.SphereGeometry(.7, 14, 10), SM('#8f6ee0', { roughness: .4 }), -.6 + k * .6, (k % 2) * .5 - .3, -.4, nuc, false);
  const eyes = []; for (const s of [-1, 1]) { mk(new THREE.SphereGeometry(.32, 12, 10), SM('#ffffff'), s * .55, .8, 2.3, g, false); eyes.push(mk(new THREE.SphereGeometry(.16, 10, 8), SM('#141414'), s * .55, .8, 2.58, g, false)); }
  const mouth = mk(new THREE.TorusGeometry(.32, .07, 6, 16, Math.PI), SM('#141414'), 0, .1, 2.45, g, false); mouth.rotation.z = Math.PI;
  wbcs.push({ g, m, geo, base, nuc, eyes, mouth, ph: i * 2.1 });
}

// ===================================================================================== LABELS
const labs = [];
function label(text, posFn, t0, t1, opts = {}) { const el = document.createElement('div'); el.className = 'lab' + (opts.big ? ' big' : ''); el.textContent = text; document.getElementById('labs').appendChild(el); labs.push({ el, posFn: typeof posFn === 'function' ? posFn : () => posFn, t0, t1, rot: opts.rot ?? -4 }); }
const at = (n, x, y, z) => V(O(n).x + x, y, z);
label('VASO SANGUÍNEO', at('skin', -9, 3.6, 6), Wd('s2', 'vaso') - .05, E('s2') + .3);
label('PLAQUETAS', () => plaq.root.position.clone().add(V(0, 2.6, 0)), Wd('s3', 'plaquetas') - .05, E('s3') + .3);
label('TAMPÃO', at('clot', 0, 4.8, 1), Wd('s4', 'tampão') - .1, E('s4') + .3, { big: true });
label('FIBRINA', at('clot', 2.2, 4.8, 1), Wd('s5', 'fibrina') - .05, E('s5') + .3);
label('COÁGULO', at('clot', 0, 5.2, 1), Wd('s6', 'coágulo') - .1, E('s6') + .3, { big: true });
label('BACTÉRIAS', at('bac', 3, 9, 0), Wd('s7', 'bactérias') - .05, E('s7') + .3);
label('GLÓBULOS BRANCOS', () => wbcs[0].g.position.clone().add(O('bac')).add(V(0, 4, 0)), Wd('s8', 'glóbulos') - .05, E('s8') + .3);
label('CASQUINHA', at('skin', 0, 11.5, 2), Wd('s9', 'casquinha') - .1, E('s9') + .3, { big: true });
label('CÉLULAS DA PELE', at('skin', 0, 10.2, 5), Wd('s10', 'células') - .05, E('s10') + .3);
label('COLÁGENO', at('skin', 1.5, 6.4, 6), Wd('s11', 'colágeno') - .05, E('s11') + .3);
label('PELE NOVA', () => V(-3.5 + 6, 6.3, 2), Wd('s12', 'inteira') - .1, E('s12') + .3, { big: true });

// ===================================================================================== TIMELINE
const CUTS = [{ t: S('s2'), k: 'dive' }, { t: S('s3'), k: 'dive' }, { t: S('s4'), k: 'whip', d: 1 }, { t: S('s5'), k: 'whip', d: -1 }, { t: S('s6'), k: 'whip', d: 1 }, { t: S('s7'), k: 'dive' }, { t: S('s8'), k: 'whip', d: -1 },
  { t: S('s9'), k: 'dive' }, { t: S('s10'), k: 'whip', d: 1 }, { t: S('s11'), k: 'whip', d: -1 }, { t: S('s12'), k: 'dive' }, { t: S('s13'), k: 'whip', d: 1 }];
function shotOf(t) { const ids = ['s2', 's3', 's4', 's5', 's6', 's7', 's8', 's9', 's10', 's11', 's12', 's13']; let k = 0; for (let i = 0; i < ids.length; i++) if (t >= S(ids[i])) k = i + 1; return ['desk1', 'skin1', 'ves', 'clot1', 'clot2', 'clot3', 'bac1', 'bac2', 'skin2', 'skin3', 'skin4', 'desk2', 'desk3'][k]; }
const SET_OF = { desk1: 'desk', skin1: 'skin', ves: 'ves', clot1: 'clot', clot2: 'clot', clot3: 'clot', bac1: 'bac', bac2: 'bac', skin2: 'skin', skin3: 'skin', skin4: 'skin', desk2: 'desk', desk3: 'desk' };
const SKY = { desk: ['#3a2422', '#7a4a3a'], skin: ['#5a0e22', '#c2405a'], ves: ['#3a0612', '#3a0612'], clot: ['#3a0612', '#6a1424'], bac: ['#7a2a3a', '#e88a98'] };

// ===================================================================================== PER-FRAME STATE
const capEl = document.getElementById('capw'), flashEl = document.getElementById('flash');
const allWords = NARR.lines.flatMap(l => l.words.map((w, i) => ({ ...w, end2: i < l.words.length - 1 ? l.words[i + 1].start : l.end + .12 })));
const tmpc = new THREE.Color();
let cam = { p: V(0, 0, 0), l: V(0, 0, 0), fov: 50 };
function setCam(p, l, fov = 50) { cam.p.copy(p); cam.l.copy(l); cam.fov = fov; }
const fingerWorld = (u = .55) => { DESK.updateMatrixWorld(true); return fIndex[2].localToWorld(V(u, 0, .6)); };

function setState(t) {
  const shot = shotOf(t), sn = SET_OF[shot];
  for (const k in sets) sets[k].visible = k === sn;
  const sc = SKY[sn]; skyU.top.value.set(sc[0]); skyU.hor.value.set(sc[1]); skyU.sunAmt.value = 0;
  hemi.intensity = 1.25; hemi.color.set('#ffe6dc'); hemi.groundColor.set('#6a3a3a'); sun.intensity = 3; sun.color.set('#ffe0c0'); camLight.intensity = 0; camLight.distance = 30; camLight.color.set('#ffd8c8');
  const ps = { vis: false };

  if (sn === 'desk') {
    const o = O('desk');
    const thumbs = P(t, Wd('s13', 'corpo'), Wd('s13', 'fez') + .3); setFingers(thumbs);
    HAND.position.y = 3.4 + Math.sin(t * 1.1) * .05 + eo(thumbs) * 1.2; HAND.rotation.z = Math.sin(t * .8) * .02;
    const sw = P(t, Wd('s1', 'cortou') - .25, Wd('s1', 'cortou') + .15);
    const fw = fingerWorld();
    paper.visible = sw > 0 && sw < 1; paper.position.set(fw.x - o.x + lerp(9, -9, eio(sw)), fw.y + .2, fw.z + .45); paper.rotation.set(0, 0, lerp(.25, -.15, sw));
    const cutOn = t > Wd('s1', 'cortou') && t < Wd('s12', 'cai') + .2; cutMark.visible = cutOn;
    const drop = eo(P(t, Wd('s1', 'saindo') - .3, E('s1') + .3)) * (t < S('s12') ? 1 : 0);
    bloodDrop.scale.set(Math.max(drop, .001), Math.max(drop * (1 + .25 * P(t, E('s1'), S('s2'))), .001), Math.max(drop * .8, .001)); bloodDrop.position.y = -.25 - drop * .2;
    const sOn = t >= S('s12'); const fall = P(t, Wd('s12', 'cai') - .1, Wd('s12', 'cai') + .9);
    scab.visible = sOn && fall < 1; cutMark.visible = cutOn && !sOn;
    if (sOn) { if (fall > 0) { scab.position.set(.55 + fall * .8, -fall * 4 + Math.sin(fall * Math.PI) * 1.4, .6 + fall * 1.2); scab.rotation.set(fall * 6, fall * 4, 0); } else { scab.position.set(.55, 0, .6); scab.rotation.set(0, 0, 0); } }
    for (let i = 0; i < calPages.length; i++) { const a = Wd('s12', 'dias') - .2 + (3 - i) * .22; calPages[i].rotation.x = -.15 - eio(P(t, a, a + .35)) * (i > 0 ? 2.9 : 0); calPages[i].visible = i === 0 || P(t, a, a + .35) < 1; }
    const hs = P(t, Wd('s12', 'inteira') - .2, Wd('s12', 'inteira') + 1.6);
    healSparks.forEach((s, i) => { const a = i / 6 * TAU + t * 2; s.position.copy(fw).sub(o).add(V(Math.cos(a) * 1.1, Math.sin(a) * 1.1, .5)); s.scale.setScalar(Math.max(Math.sin(hs * Math.PI) * (.7 + .3 * Math.sin(t * 9 + i)), .001)); s.rotation.y = t * 4; });
    if (shot === 'desk1') {
      const u = P(t, 0, S('s2'));
      setCam(fw.clone().add(V(lerp(5, 3.2, eio(u)), lerp(3.2, 1.6, eio(u)), lerp(10, 6.5, eio(u)))), fw.clone().add(V(0, -.2, 0)), 42);
      const dv = ei(P(t, S('s2') - .4, S('s2'))); if (dv > 0) { cam.p.lerp(fw.clone().add(V(0, 0, 1)), dv); cam.fov -= dv * 20; }
    } else {
      const tip = fThumb[1].localToWorld(V(1.25, 0, 0));
      if (t > S('s13') - .1) { ps.vis = true; ps.pos = tip.clone().add(V(0, .7 + Math.abs(Math.sin(t * 4)) * .15, 0)); ps.s = .75; ps.mood = 'joy'; ps.wave = P(t, Wd('s13', 'sozinho') - .3, Wd('s13', 'sozinho')); ps.ry = -.3; }
      if (shot === 'desk2') { const u = P(t, S('s12'), S('s13')); const din = 1 - eo(P(t, S('s12'), S('s12') + .5)); const tg = fw.clone().lerp(V(6.5, 3, -5.5), .45); setCam(tg.clone().add(V(lerp(5, 3, u), lerp(5, 4, u), lerp(16, 13, u))).lerp(fw.clone().add(V(0, 0, 1.2)), din), tg.clone().lerp(fw, din), 46 - din * 20); }
      else { const u = eio(P(t, S('s13'), DUR)); const c = HAND.position.clone().add(o).add(V(1, 1.5, 1)); setCam(c.clone().add(V(lerp(3, 6, u), lerp(2, 5, u), lerp(12, 19, u))), c.clone().add(V(0, lerp(.8, .3, u), 0)), 46); }
    }
  }
  if (sn === 'skin') {
    const o = O('skin');
    const constrict = eo(P(t, Wd('s2', 'aperta') - .1, Wd('s2', 'aperta') + .7)) * (t < S('s3') ? 1 : 0);
    vesSegs.forEach(s => { const k = 1 - .45 * constrict * Math.exp(-(s.x * s.x) / 40) * (1 + .15 * Math.sin(t * 9 - s.x)); s.m.scale.set(k, 1, k); });
    const flow = t < S('s3') ? lerp(1, .35, constrict) : .6;
    vesRBC.forEach(r => { const x = ((r.o * 44 + t * 5 * flow) % 44) - 22; const k = 1 - .45 * constrict * Math.exp(-(x * x) / 40); r.m.position.set(x, VES_Y + r.y * k, VES_Z + r.z * k); r.m.rotation.set(t * 2 + r.ph, Math.PI / 2, t + r.ph); });
    const leakOn = shot === 'skin1';
    leak.forEach(l => { if (!leakOn) { l.m.visible = false; return; } l.m.visible = true; const k = ((t * .9 * (1.2 - .8 * constrict)) + l.o) % 1; l.m.position.set(l.dx * k * 1.6 + Math.sin(k * 6 + l.ph) * .3, VES_Y + .8 + k * 8.5, 3 + l.ph * .3); l.m.rotation.set(t * 3 + l.ph, t * 2, 0); l.m.scale.setScalar(.6 * (1 - k * .3)); });
    const clotOn = t > S('s9') - .01; clotFill.visible = clotOn; cracks.forEach(c => c.visible = false);
    if (clotOn) { const dry = eo(P(t, Wd('s9', 'seca') - .2, Wd('s9', 'endurece') + .5)); clotMat.color.set('#b0223a').lerp(tmpc.set('#8a4a2a'), dry); clotMat.roughness = lerp(.35, .95, dry);
      const shrink = eo(P(t, S('s10') + .3, E('s10'))); clotFill.scale.set(1, 1, 1); clotFill.position.y = 0; clotFill.geometry.boundingBox = null;
      clotFill.scale.y = lerp(1, .35, shrink); clotFill.position.y = lerp(0, TOP * .65 - .0, shrink) + 0;
      cracks.forEach((c, i) => { c.visible = dry > .5 + i * .03; c.position.y = clotFill.position.y + (TOP + .5) * clotFill.scale.y + .03; }); }
    dermFill.scale.y = Math.max(eo(P(t, Wd('s10', 'multiplicam') - .4, E('s11'))), .001);
    newCells.forEach(n => { const a = Wd('s10', 'células') + n.k * .28 + n.row * .14; const u = eo(P(t, a, a + .6)); const xEdge = n.side * (hw(n.y) + .7); const xT = n.side * (hw(n.y) - .7 - n.k * 1.3); n.c.position.set(lerp(xEdge, xT, u), n.y, 6.05); n.c.scale.set(Math.max(u, .001) * (1 + .2 * Math.sin(u * Math.PI)), 1, 1); n.c.visible = t > S('s10') && Math.abs(xT) < hw(n.y) - .05; });
    capillaries.forEach(c => { const u = eo(P(t, Wd('s11', 'vasos') + c.d, Wd('s11', 'crescem') + .9 + c.d)); c.g.setDrawRange(0, Math.floor(c.g.index.count * u / 3) * 3); c.m.visible = u > 0; });
    collagen.forEach(c => { const u = eo(P(t, Wd('s11', 'colágeno') - .2 + c.d, Wd('s11', 'costura') + .5 + c.d)); c.g.setDrawRange(0, Math.floor(c.g.index.count * u / 3) * 3); c.m.visible = u > 0; });
    if (shot === 'skin1') { const u = P(t, S('s2'), S('s3')); const din = 1 - eo(P(t, S('s2'), S('s2') + .45));
      setCam(V(o.x + lerp(-4, 3, eio(u)), lerp(10, 7, u), lerp(30, 24, eio(u))), V(o.x + lerp(-2, 0, u), 3.4, 0), 50 - din * 18);
      const dv = ei(P(t, S('s3') - .4, S('s3'))); if (dv > 0) { cam.p.lerp(V(o.x - 3, VES_Y, VES_Z + 1.5), dv); cam.l.lerp(V(o.x - 6, VES_Y, VES_Z), dv); cam.fov -= dv * 15; } }
    if (shot === 'skin2') { const u = P(t, S('s9'), S('s10')); const din = 1 - eo(P(t, S('s9'), S('s9') + .45)); setCam(V(o.x + lerp(5, 2, u), lerp(16, 14, u), lerp(20, 17, u)), V(o.x, 7.4, 0), 46 - din * 16); }
    if (shot === 'skin3') { const u = P(t, S('s10'), S('s11')); setCam(V(o.x + lerp(-2, 2, eio(u)), lerp(9.5, 9, u), lerp(17, 15, u)), V(o.x, 6.6, 3), 48); }
    if (shot === 'skin4') { const u = P(t, S('s11'), S('s12')); setCam(V(o.x + lerp(3, -2, eio(u)), lerp(6.5, 7.5, u), lerp(15, 18, u)), V(o.x, 4.4, 4), 48);
      const dv = ei(P(t, S('s12') - .35, S('s12'))); if (dv > 0) { cam.p.z += dv * 30; cam.fov += dv * 10; } }
  }
  if (sn === 'ves') {
    const o = O('ves'); const u = P(t, S('s3'), S('s4')); const z = -u * 70;
    vRBC.forEach(r => { const zz = z + 14 - ((r.z0 + t * r.sp * .5) % 120); r.m.position.set(r.x + Math.sin(t + r.rx) * .2, r.y, zz); r.m.rotation.set(r.rx + t * 1.5, r.ry + t, 0); });
    vPlat.forEach(p => { const zz = z + 6 - ((p.z0 + t * 8) % 60); p.m.position.set(p.x, p.y + Math.sin(t * 2 + p.ph) * .3, zz); p.m.rotation.set(Math.sin(t + p.ph) * .5, t, 0); });
    ps.vis = true; ps.pos = V(o.x + Math.sin(t * 2) * .5, -.6 + Math.sin(t * 3) * .25, z - 1); ps.mood = t > Wd('s3', 'plaquetas') ? 'joy' : 'happy'; ps.s = .9; ps.rz = Math.sin(t * 2.5) * .2; ps.ry = Math.sin(t * 1.3) * .3; ps.wave = P(t, Wd('s3', 'plaquetas'), Wd('s3', 'plaquetas') + .2) * (1 - P(t, Wd('s3', 'pedacinhos') + .5, Wd('s3', 'célula')));
    const din = 1 - eo(P(t, S('s3'), S('s3') + .5));
    setCam(V(o.x + Math.sin(t * .9) * .6 + 1.2, .6 + Math.sin(t * .7) * .3, z + 4.6), V(o.x, -.5, z - 1.5), 58 - din * 15);
    camLight.position.set(o.x, 2.5, z + 8); camLight.intensity = 14;
  }
  if (sn === 'clot') {
    const o = O('clot');
    flowRBC.forEach(r => { const x = ((r.x0 + t * 7) % 50) - 25; r.m.position.set(x, r.y + Math.sin(t + r.rx) * .3, r.z); r.m.rotation.set(r.rx + t * 1.4, r.ry + t, 0); });
    const arrive = P(t, Wd('s4', 'quando') - .1, Wd('s4', 'empilham') + .6), stick = P(t, Wd('s4', 'grudentas') - .2, Wd('s4', 'grudentas') + .3);
    plugP.forEach(p => { const k = eio(cl((arrive - p.d * .55) / .45)); p.m.position.set(lerp(p.sx, p.tx, k), lerp(p.sy, p.ty, k), lerp(4, p.tz, k)); p.m.rotation.z = (1 - k) * 3 + p.ph * .2; p.sp.forEach(s => s.scale.setScalar(Math.max(eo(stick), .001))); const wob = t > Wd('s5', 'fraco') - .2 && t < Wd('s5', 'então') ? Math.sin(t * 30 + p.ph) * .12 : 0; p.m.position.x += wob; });
    const fb = P(t, Wd('s5', 'fibrina') - .15, Wd('s6', 'rede') + .5);
    fibrin.forEach(f => { f.m.scale.y = Math.max(eo(cl((fb - f.d * .6) / .4)), .001); });
    const tr = P(t, Wd('s6', 'prende') - .3, Wd('s6', 'coágulo') + .2);
    trapped.forEach(r => { const k = eo(cl((tr - r.d * .5) / .5)); r.m.visible = t > S('s6') - .1 || t > Wd('s5', 'fios'); r.m.position.set(lerp(r.sx, r.tx, k), lerp(r.sy, r.ty, k), r.tz); r.m.rotation.set(r.rx + t * (1 - k), r.ry, 0); });
    const sq = P(t, Wd('s5', 'fraco') - .1, Wd('s5', 'então') + .2);
    squirt.forEach(s => { const k = ((t * 1.6) + s.o) % 1; const on = sq > 0 && sq < 1; s.m.visible = on; s.m.position.set(Math.cos(s.a) * (1 + k * 3), Math.sin(s.a) * (1 + k * 3), .8 + k * 2); });
    // Plaq: the last one that pushes into the plug
    const pl = eo(P(t, S('s4') - .1, Wd('s4', 'encostam') + .4));
    ps.vis = true; ps.pos = V(o.x + lerp(-6, -.6, pl), lerp(3.5, .4, pl), lerp(4, 1.4, pl)); ps.act = eo(stick); ps.mood = t < Wd('s4', 'grudentas') ? 'happy' : t < Wd('s5', 'fraco') ? 'determined' : t < Wd('s5', 'fabrica') ? 'worried' : 'joy'; ps.rx = .3; ps.s = 1.1;
    if (t > S('s5')) { ps.pos = V(o.x - .4, .5, 1.6); ps.wave = P(t, Wd('s6', 'coágulo') - .2, Wd('s6', 'coágulo') + .1); }
    if (shot === 'clot1') { const u = P(t, S('s4'), S('s5')); setCam(V(o.x + lerp(-5, -1, eio(u)), lerp(-2.5, -1, u), lerp(17, 14, u)), V(o.x + lerp(-2, 0, u), .4, 0), 50); }
    if (shot === 'clot2') { const u = P(t, S('s5'), S('s6')); setCam(V(o.x + lerp(5, 3, u), lerp(4, 2.5, u), lerp(13, 11.5, u)), V(o.x, .3, 0), 50); }
    if (shot === 'clot3') { const u = P(t, S('s6'), S('s7')); setCam(V(o.x + lerp(-1, 1, u), lerp(-1.5, .5, u), lerp(10.5, 14.5, eio(u))), V(o.x, .6, 0), 50);
      const dv = ei(P(t, S('s7') - .4, S('s7'))); if (dv > 0) { cam.p.lerp(V(o.x, .2, 2.5), dv); cam.fov -= dv * 15; } }
    camLight.position.set(o.x + 2, 3, 9); camLight.intensity = 30;
  }
  if (sn === 'bac') {
    const o = O('bac');
    const eatT = Wd('s8', 'engolem');
    wbcs.forEach((w, i) => {
      const emerge = eo(P(t, Wd('s8', 'chegam') - .3 + i * .3, Wd('s8', 'brancos') + .2 + i * .3));
      const tgt = i ? V(2.5, -2.8, 0) : V(1, 3, 0);
      w.g.position.set(lerp(-9.5, tgt.x, emerge), lerp(i ? -4 : 2, tgt.y, emerge), lerp(-3, 0, emerge)); w.g.visible = t > S('s8') - .1;
      w.g.scale.set(lerp(.4, 1, emerge), lerp(1.3, 1, emerge), lerp(.4, 1, emerge));
      const reach = Math.sin(P(t, eatT - .2, eatT + .8) * Math.PI);
      const p = w.geo.attributes.position; for (let k = 0; k < p.count; k++) { const x = w.base[k * 3], y = w.base[k * 3 + 1], z = w.base[k * 3 + 2]; const n = 1 + .07 * Math.sin(x * 2.1 + t * 3 + w.ph) * Math.sin(y * 1.7 - t * 2.4) + .05 * Math.sin(z * 2.6 + t * 4); const arm = Math.max(0, x / 2.6) ** 4 * reach * .6; p.setXYZ(k, x * (n + arm), y * n, z * n); }
      p.needsUpdate = true; w.geo.computeVertexNormals();
      w.nuc.rotation.z = t * .4; w.eyes.forEach(e => e.position.x = (e.position.x > 0 ? .55 : -.55) + .08 * Math.sin(t * 1.5));
    });
    bacteria.forEach((b, i) => {
      const sneak = eio(P(t, S('s7') - .2 + b.d, Wd('s7', 'bactérias') + .6 + b.d));
      let x = lerp(b.sx, b.tx, sneak) + Math.sin(t * 2 + b.ph) * .3, y = lerp(b.sy, b.ty, sneak) + Math.sin(t * 3 + b.ph) * .2, z = .8;
      const w = wbcs[i % 2], eu = eo(P(t, eatT + i * .08, eatT + .7 + i * .08));
      let s = 1;
      if (eu > 0) { x = lerp(x, w.g.position.x + Math.cos(i) * .7, eu); y = lerp(y, w.g.position.y + Math.sin(i) * .7, eu); z = lerp(z, w.g.position.z, eu); s = 1 - .45 * eu - .55 * P(t, eatT + 1, eatT + 2); }
      b.g.position.set(x, y, z); b.g.scale.setScalar(Math.max(s, .001)); b.g.rotation.z = Math.atan2(b.ty - b.sy, b.tx - b.sx) * (1 - eu) + Math.sin(t * 4 + b.ph) * .15;
      b.tail.forEach((s2, k) => s2.position.y = Math.sin(t * 12 - k + b.ph) * .1 * (k + 1));
      b.g.visible = t > S('s7') - .3;
    });
    ps.vis = true; ps.s = .8; ps.pos = V(o.x - 4.5, -7 + Math.sin(t * 3) * .15, 2); ps.mood = t < S('s8') ? 'scared' : t > eatT + .3 ? 'joy' : 'happy'; ps.px = .08; ps.wave = P(t, eatT + .5, eatT + .8); ps.ry = .4;
    if (shot === 'bac1') { const u = P(t, S('s7'), S('s8')); const din = 1 - eo(P(t, S('s7'), S('s7') + .45)); setCam(V(o.x + lerp(4, 2, u), lerp(3, 1.5, u), lerp(24, 21, u)), V(o.x + 1.5, 1, 0), 50 - din * 18); }
    else { const u = P(t, S('s8'), S('s9')); setCam(V(o.x + lerp(-3, 1, eio(u)), lerp(.5, 1.5, u), lerp(22, 18.5, u)), V(o.x + .8, 0, 0), 50);
      const dv = ei(P(t, S('s9') - .35, S('s9'))); if (dv > 0) { cam.p.z += dv * 20; } }
    camLight.position.set(o.x, 4, 12); camLight.intensity = 25;
  }

  // ------------- whip / dive -------------
  let whip = 0, blur = 0, flash = 0;
  for (const c of CUTS) { const d = t - c.t, k = 1 - Math.abs(d) / .17; if (k <= 0) continue; if (c.k === 'whip') { const e = k * k; whip += (d < 0 ? 1 : -1) * c.d * e * .55; blur = Math.max(blur, e); } else { flash = Math.max(flash, k * k); blur = Math.max(blur, k * .4); } }
  const dir = cam.l.clone().sub(cam.p); dir.applyAxisAngle(V(0, 1, 0), whip); cam.l.copy(cam.p).add(dir);
  camera.position.copy(cam.p); camera.position.x += Math.sin(t * .9) * .04; camera.position.y += Math.sin(t * 1.3 + 1) * .03;
  camera.fov = cam.fov; camera.updateProjectionMatrix(); camera.lookAt(cam.l);
  blurPass.uniforms.amount.value = blur * .09; flashEl.style.opacity = (flash * .9).toFixed(3);
  sky.position.copy(camera.position);
  aimSun(cam.l.clone());
  applyPlaq(ps, t);
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
