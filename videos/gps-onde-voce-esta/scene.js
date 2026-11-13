// Como o GPS sabe onde você está — "O Sat". Space/neon low-poly explainer, own world, guide character, diorama sets,
// whip/dive transitions and post-processing. Everything is a pure function of time t.
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
const vig = new ShaderPass(VignetteShader); vig.uniforms.offset.value = .95; vig.uniforms.darkness.value = .98; composer.addPass(vig);
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
const SGw = G(), SPw = G(); SGw.visible = SPw.visible = false;
const glow = (c, k) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k), toneMapped: false });
const tmpc = new THREE.Color();
const CY = '#22e6ff', MG = '#ff3d9a', LM = '#b6ff4a', GD = '#ffcf4a', NV = '#070b24';
function dynTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; return { tex: tx, c, g, draw: (...a) => { draw(g, w, h, ...a); tx.needsUpdate = true; } }; }
function bokeh(parent, cols, spread, cy, z0, z1, sizes, seed) {
  const r = rng(seed);
  for (const [cnt, size, op] of sizes) {
    const pos = new Float32Array(cnt * 3), col = new Float32Array(cnt * 3);
    for (let i = 0; i < cnt; i++) { pos.set([(r() - .5) * spread[0], (r() - .5) * spread[1] + cy, z0 + r() * (z1 - z0)], i * 3); const c = new THREE.Color(cols[Math.floor(r() * cols.length)]); col.set([c.r, c.g, c.b], i * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const p = new THREE.Points(g, new THREE.PointsMaterial({ size, map: softDot, transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true, sizeAttenuation: true })); p.frustumCulled = false; parent.add(p);
  }
}
function stars(parent, n, R, seed, size = 1.1) {
  const r = rng(seed), pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const u = r() * TAU, v = Math.acos(2 * r() - 1), rr = R * (.8 + r() * .2); pos.set([rr * Math.sin(v) * Math.cos(u), rr * Math.cos(v), rr * Math.sin(v) * Math.sin(u)], i * 3); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const p = new THREE.Points(g, new THREE.PointsMaterial({ size, map: softDot, transparent: true, opacity: .9, depthWrite: false, blending: THREE.AdditiveBlending, color: '#cfe0ff', sizeAttenuation: false })); p.frustumCulled = false; parent.add(p); return p;
}
const gridTex = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#0a1240'; g.fillRect(0, 0, w, h); g.strokeStyle = '#22e6ff'; g.lineWidth = 4; g.strokeRect(0, 0, w, h); g.strokeStyle = '#22e6ff55'; g.lineWidth = 2; g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke(); });
gridTex.wrapS = gridTex.wrapT = THREE.RepeatWrapping;
function ground(parent, size, rep, y = 0) { const t = gridTex.clone(); t.needsUpdate = true; t.repeat.set(rep, rep); const m = mk(new THREE.PlaneGeometry(size, size), new THREE.MeshStandardMaterial({ map: t, roughness: .6, emissive: '#0a1a50', emissiveMap: t, emissiveIntensity: .5 }), 0, y, 0, parent, false); m.rotation.x = -Math.PI / 2; m.receiveShadow = false; return m; }

// ===================================================================================== SAT (guide character)
function makeSat(sc = 1) {
  const root = G(), body = G(root);
  const gold = new THREE.MeshPhysicalMaterial({ color: GD, roughness: .28, metalness: .35, clearcoat: .6, emissive: '#ff9a1a', emissiveIntensity: .12 });
  const cube = mk(RBOX(1.9, 1.9, 1.9, .35), gold, 0, 0, 0, body); cube.castShadow = false;
  const panelTex = canvasTex(256, 128, (g, w, h) => { g.fillStyle = '#1a3fd0'; g.fillRect(0, 0, w, h); g.strokeStyle = '#8fb6ff'; g.lineWidth = 3; for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * w / 4, 0); g.lineTo(i * w / 4, h); g.stroke(); } for (let j = 0; j <= 2; j++) { g.beginPath(); g.moveTo(0, j * h / 2); g.lineTo(w, j * h / 2); g.stroke(); } });
  const pm = new THREE.MeshStandardMaterial({ map: panelTex, roughness: .35, metalness: .3, emissive: '#1030a0', emissiveIntensity: .45 });
  const panels = [-1, 1].map(k => { const a = G(body); a.position.x = k * 1.0; mk(CYL(.07, .07, .9, 8), M('#c7cdd8'), k * .35, 0, 0, a, false).rotation.z = Math.PI / 2; const p = mk(BOX(3.0, 1.5, .09), pm, k * 2.4, 0, 0, a, false); return a; });
  mk(CYL(.05, .05, .9, 6), M('#c7cdd8'), 0, 1.35, 0, body, false);
  const tip = mk(new THREE.SphereGeometry(.2, 12, 10), glow(MG, 1.6), 0, 1.85, 0, body, false);
  const dish = mk(new THREE.SphereGeometry(.55, 14, 8, 0, TAU, 0, Math.PI / 2), M('#e8ecf5'), 0, -1.0, 0, body, false); dish.rotation.x = Math.PI;
  const lids = [], pupils = [], black = SM('#101014');
  for (const k of [-1, 1]) {
    const e = G(body); e.position.set(k * .42, .22, .96);
    mk(new THREE.SphereGeometry(.28, 16, 12), SM('#fff'), 0, 0, 0, e, false);
    const pu = G(e); pu.position.z = .22; pupils.push(pu); mk(new THREE.SphereGeometry(.14, 12, 10), black, 0, 0, 0, pu, false); mk(new THREE.SphereGeometry(.04, 6, 5), new THREE.MeshBasicMaterial({ color: '#fff' }), .05, .06, .12, pu, false);
    const lid = G(e); mk(new THREE.SphereGeometry(.3, 16, 8, 0, TAU, 0, Math.PI / 2), gold, 0, 0, 0, lid, false); lids.push(lid);
  }
  const mouths = { smile: mk(new THREE.TorusGeometry(.2, .05, 6, 16, Math.PI), black, 0, -.16, 1.0, body, false), o: mk(new THREE.TorusGeometry(.12, .05, 6, 14), black, 0, -.3, 1.0, body, false), grin: mk(new THREE.SphereGeometry(.24, 14, 8, 0, TAU, Math.PI / 2, Math.PI / 2), SM('#5a1d1d'), 0, -.2, .96, body, false) };
  mouths.smile.rotation.z = Math.PI; mouths.grin.rotation.x = -.35; mouths.grin.scale.set(1.1, .8, .6);
  const cheeks = [-1, 1].map(k => { const c = mk(new THREE.SphereGeometry(.14, 10, 8), SM('#ff7a9a', { transparent: true, opacity: .8 }), k * .78, -.1, .85, body, false); c.scale.set(1, .6, .4); return c; });
  root.scale.setScalar(sc); root.visible = false;
  return { root, body, panels, tip, lids, pupils, mouths, cheeks };
}
const sat = makeSat();
function applySat(g, st, t) {
  g.root.visible = !!st.vis; if (!st.vis) return;
  g.root.position.copy(st.pos); g.root.rotation.set(st.rx || 0, st.ry || 0, st.rz || 0); g.root.scale.setScalar(st.s ?? 1);
  const sq = st.sq ?? (1 + .04 * Math.sin(t * 4 + (st.ph || 0))); g.body.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
  g.panels.forEach((p, i) => p.rotation.x = Math.sin(t * 1.2 + i) * .08);
  g.tip.scale.setScalar(.8 + .4 * Math.abs(Math.sin(t * 5 + (st.ph || 0))) + (st.shout || 0) * .6);
  const mood = st.mood || 'happy';
  const blink = Math.max(0, 1 - Math.abs(((t + (st.ph || 0) + .3) % 3.3) - .1) / .09);
  const lid = Math.max({ happy: .12, joy: .05, think: .4, shout: 0 }[mood] ?? .12, blink);
  g.lids.forEach(l => l.rotation.x = lerp(-1.55, 1.5, lid));
  g.pupils.forEach(p => { p.position.x = st.px ?? 0; p.position.y = st.py ?? 0; });
  const mm = { happy: 'smile', joy: 'grin', think: 'smile', shout: 'o' }[mood];
  for (const k in g.mouths) g.mouths[k].visible = k === mm;
  g.cheeks.forEach(c => c.visible = mood === 'joy' || mood === 'happy');
}
// extra little satellites (same model, no face needed visible)
const sats = [sat, ...[1, 2, 3, 4, 5, 6, 7, 8].map(() => makeSat())];

// ===================================================================================== PHONE set (s1, s11, s12, s13)
const PH = set('phone', 0);
const mapD = dynTex(512, 1024, (g, w, h) => {
  g.fillStyle = '#0c1a44'; g.fillRect(0, 0, w, h);
  for (let gy = 0; gy < 4; gy++) for (let gx = 0; gx < 3; gx++) { g.fillStyle = (gx + gy) % 2 ? '#13276a' : '#102259'; g.fillRect(gx * 170 + 14, gy * 256 + 14, 142, 228); }
  g.fillStyle = '#1b6b3a'; g.fillRect(14 + 170, 14 + 256 * 2, 142, 228);
  g.strokeStyle = '#2fd3ff'; g.lineWidth = 10; for (let gx = 0; gx <= 3; gx++) { g.beginPath(); g.moveTo(gx * 170 + 0, 0); g.lineTo(gx * 170 + 0, h); g.stroke(); } for (let gy = 0; gy <= 4; gy++) { g.beginPath(); g.moveTo(0, gy * 256); g.lineTo(w, gy * 256); g.stroke(); }
  g.strokeStyle = MG; g.lineWidth = 22; g.lineCap = 'round'; g.beginPath(); g.moveTo(256, 0); g.lineTo(256, h); g.stroke();
});
mapD.draw(); mapD.tex.wrapS = mapD.tex.wrapT = THREE.RepeatWrapping; mapD.tex.repeat.set(1, .5);
const phone = G(PH);
mk(RBOX(5.4, 11, .7, .55), M('#14162e', { roughness: .3, metalness: .5, flatShading: false }), 0, 0, 0, phone);
const screen = mk(new THREE.PlaneGeometry(4.9, 10.4), new THREE.MeshBasicMaterial({ map: mapD.tex, toneMapped: false }), 0, 0, .36, phone, false);
mk(new THREE.CapsuleGeometry(.12, .8, 3, 8), M('#05060f'), 0, 4.95, .37, phone, false).rotation.z = Math.PI / 2;
const pin = G(phone); pin.position.set(0, 0, .6);
const pinBall = mk(new THREE.SphereGeometry(.42, 20, 14), glow(LM, 1.5), 0, 0, 0, pin, false);
const pinRing = mk(new THREE.TorusGeometry(.8, .07, 8, 36), glow(LM, 1.3), 0, 0, 0, pin, false);
const pinRing2 = mk(new THREE.TorusGeometry(.8, .05, 8, 36), glow(LM, 1.0), 0, 0, 0, pin, false);
bokeh(PH, ['#ffb85a', '#22e6ff', '#ff3d9a', '#ffe6a0'], [90, 40, 10], -4, -40, -20, [[60, 4, .4], [24, 8, .25]], 91);
// s12: incoming rings + crossed-out upload arrow
const inRings = []; for (let i = 0; i < 6; i++) inRings.push(mk(new THREE.TorusGeometry(1, .025, 8, 48), glow(CY, 1.0), 0, 0, 0, PH, false));
const arrowTex = canvasTex(256, 256, (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(128, 30); g.lineTo(206, 120); g.lineTo(150, 120); g.lineTo(150, 220); g.lineTo(106, 220); g.lineTo(106, 120); g.lineTo(50, 120); g.closePath(); g.fill(); g.strokeStyle = '#ff2e4d'; g.lineWidth = 22; g.lineCap = 'round'; g.beginPath(); g.moveTo(40, 40); g.lineTo(216, 216); g.moveTo(216, 40); g.lineTo(40, 216); g.stroke(); });
const noSend = mk(new THREE.PlaneGeometry(3.4, 3.4), new THREE.MeshBasicMaterial({ map: arrowTex, transparent: true, toneMapped: false }), 0, 0, 0, PH, false);
// s13 night sky: stars + ground
const skyStars = stars(PH, 700, 400, 92, 1.6);
const phGround = ground(PH, 400, 40, -6.5);
const skySats = [];

// ===================================================================================== SPACE set (s2, s3)
const SP = set('space', 300);
const earthGeo = new THREE.IcosahedronGeometry(10, 4);
{ const p = earthGeo.attributes.position, col = new Float32Array(p.count * 3); for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const n = fbm(x * .22 + 40, z * .22 + y * .22 + 40); const land = n > .55; const c = new THREE.Color(land ? (n > .68 ? '#d9f2a0' : '#35c46a') : (n < .4 ? '#1a3fd0' : '#2a6bff')); col.set([c.r, c.g, c.b], i * 3); } earthGeo.setAttribute('color', new THREE.BufferAttribute(col, 3)); }
const earth = mk(earthGeo.toNonIndexed(), new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .8, emissive: '#0a1a50', emissiveIntensity: .35 }), 0, 0, 0, SP, false);
{ const cc = earthGeo.toNonIndexed(); const col = new Float32Array(cc.attributes.position.count * 3); const p = cc.attributes.position; for (let i = 0; i < p.count; i += 3) { const x = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3, y = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3, z = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3; const n = fbm(x * .22 + 40, z * .22 + y * .22 + 40); const land = n > .55; const c = new THREE.Color(land ? (n > .68 ? '#d9f2a0' : '#35c46a') : (n < .4 ? '#1a3fd0' : '#2a6bff')); for (let k = 0; k < 3; k++) col.set([c.r, c.g, c.b], (i + k) * 3); } earth.geometry.setAttribute('color', new THREE.BufferAttribute(col, 3)); }
mk(new THREE.SphereGeometry(11, 32, 20), new THREE.MeshBasicMaterial({ color: CY, transparent: true, opacity: .16, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false }), 0, 0, 0, SP, false);
const orbitDefs = [{ R: 15, tilt: .5, rot: 0, sp: .5, n: 3 }, { R: 17.5, tilt: -.7, rot: 1.2, sp: -.4, n: 3 }, { R: 20, tilt: 1.0, rot: 2.4, sp: .33, n: 2 }];
orbitDefs.forEach(o => { const ring = mk(new THREE.TorusGeometry(o.R, .06, 6, 120), glow('#6f8cff', .8), 0, 0, 0, SP, false); ring.rotation.set(Math.PI / 2 + o.tilt, o.rot, 0); });
stars(SP, 900, 500, 93, 1.8);
const orbitSats = []; { let k = 1; orbitDefs.forEach(o => { for (let i = 0; i < o.n; i++) orbitSats.push({ o, a0: i / o.n * TAU, sat: sats[k++] }); }); }
function orbitPos(o, a) { const v = V(Math.cos(a) * o.R, 0, Math.sin(a) * o.R); v.applyEuler(new THREE.Euler(Math.PI / 2 + o.tilt - Math.PI / 2, 0, 0)); v.applyAxisAngle(V(0, 1, 0), o.rot); return v; }
// clock + sound rings for s3
const clockD = dynTex(256, 256, (g, w, h, tt = 0) => { g.fillStyle = '#fff'; g.beginPath(); g.arc(128, 128, 120, 0, TAU); g.fill(); g.strokeStyle = '#141432'; g.lineWidth = 10; g.stroke(); g.fillStyle = '#141432'; for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; g.fillRect(128 + Math.sin(a) * 96 - 5, 128 - Math.cos(a) * 96 - 5, 10, 10); } g.lineCap = 'round'; g.strokeStyle = '#141432'; g.lineWidth = 12; const a1 = tt * .6, a2 = tt * 7.2; g.beginPath(); g.moveTo(128, 128); g.lineTo(128 + Math.sin(a1) * 56, 128 - Math.cos(a1) * 56); g.stroke(); g.strokeStyle = '#ff3d9a'; g.lineWidth = 8; g.beginPath(); g.moveTo(128, 128); g.lineTo(128 + Math.sin(a2) * 92, 128 - Math.cos(a2) * 92); g.stroke(); });
const clockMesh = mk(new THREE.CircleGeometry(1.5, 32), new THREE.MeshBasicMaterial({ map: clockD.tex, transparent: true, toneMapped: false, color: '#8a8a8a' }), 0, 0, 0, SPw, false);
const shoutRings = []; for (let i = 0; i < 5; i++) shoutRings.push(mk(new THREE.TorusGeometry(1, .03, 8, 48), glow(MG, 1.1), 0, 0, 0, SPw, false));
const sparkle = []; for (let i = 0; i < 10; i++) sparkle.push(mk(new THREE.OctahedronGeometry(.18, 0), glow('#ffffff', 2), 0, 0, 0, SPw, false));

// ===================================================================================== SIGNAL set (s4, s5, s6) — vertical layout
const SG = set('sig', 600);
const earthBig = mk(new THREE.SphereGeometry(90, 64, 32), new THREE.MeshStandardMaterial({ map: (() => { const t = gridTex.clone(); t.needsUpdate = true; t.repeat.set(24, 12); return t; })(), roughness: .7, emissive: '#0a1a50', emissiveIntensity: .5 }), 0, -90, 0, SG, false);
mk(new THREE.SphereGeometry(92, 48, 24), new THREE.MeshBasicMaterial({ color: CY, transparent: true, opacity: .12, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false }), 0, -90, 0, SG, false);
stars(SG, 700, 500, 94, 1.6);
const phoneS = G(SG); phoneS.position.set(0, 2.4, 0); phoneS.scale.setScalar(.45);
mk(RBOX(5.4, 11, .7, .55), M('#14162e', { roughness: .3, metalness: .5, flatShading: false }), 0, 0, 0, phoneS);
mk(new THREE.PlaneGeometry(4.9, 10.4), new THREE.MeshBasicMaterial({ map: mapD.tex, toneMapped: false }), 0, 0, .36, phoneS, false);
phoneS.rotation.y = -.3; phoneS.rotation.x = -.2;
const SAT_N = V(2, 20, 0), SAT_F = V(6, 25, 0), SAT_N2 = V(-4, 11, 0);
const orb = mk(new THREE.SphereGeometry(.9, 16, 12), glow(GD, 2.2), 0, 0, 0, SGw, false);
const orbTrail = []; for (let i = 0; i < 12; i++) orbTrail.push(mk(new THREE.SphereGeometry(.4, 8, 6), glow(GD, 1.4), 0, 0, 0, SGw, false));
const orb2 = mk(new THREE.SphereGeometry(.9, 16, 12), glow('#7fe8ff', 2.2), 0, 0, 0, SGw, false);
const orbTrail2 = []; for (let i = 0; i < 12; i++) orbTrail2.push(mk(new THREE.SphereGeometry(.4, 8, 6), glow('#7fe8ff', 1.4), 0, 0, 0, SGw, false));
const watchD = [0, 1].map(() => dynTex(512, 200, (g, w, h, txt = '0,000 s', col = '#fff') => { g.clearRect(0, 0, w, h); g.fillStyle = '#0b1030f0'; g.beginPath(); g.roundRect(8, 8, w - 16, h - 16, 40); g.fill(); g.strokeStyle = col; g.lineWidth = 10; g.stroke(); g.fillStyle = col; g.font = '900 100px Inter, DejaVu Sans, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, w / 2, h / 2 + 6); }));
const watchM = watchD.map(d => mk(new THREE.PlaneGeometry(7, 2.74), new THREE.MeshBasicMaterial({ map: d.tex, transparent: true, toneMapped: false }), 0, 0, 0, SGw, false));
const distLine = [0, 1].map(i => { const g = new THREE.CylinderGeometry(.09, .09, 1, 6); g.translate(0, .5, 0); return mk(g, glow(i ? '#7fe8ff' : GD, 1.5), 0, 0, 0, SGw, false); });
const ticks = []; for (let i = 0; i < 16; i++) ticks.push(mk(BOX(1.1, .09, .09), glow('#fff', 1.2), 0, 0, 0, SG, false));

// ===================================================================================== SPHERES set (s7..s10)
const SPH = set('sph', 900);
ground(SPH, 140, 14, 0);
stars(SPH, 600, 500, 95, 1.5);
bokeh(SPH, ['#22e6ff', '#ff3d9a', '#6f8cff'], [90, 50, 10], 15, -60, -30, [[50, 4, .3]], 96);
const PP = V(0, 0, 0);
const C = [V(-5, 9, -3), V(6, 8, -4), V(0, 9.5, 6), V(-1, 11, -12)];
const R = C.map(c => c.distanceTo(PP));
const nrm = C[1].clone().sub(C[0]).cross(C[2].clone().sub(C[0])).normalize();
const PPrime = PP.clone().sub(nrm.clone().multiplyScalar(2 * PP.clone().sub(C[0]).dot(nrm)));
const sphCols = [CY, MG, GD, LM];
const shells = C.map((c, i) => {
  const g = G(SPH); g.position.copy(c);
  mk(new THREE.SphereGeometry(R[i], 40, 28), new THREE.MeshBasicMaterial({ color: sphCols[i], transparent: true, opacity: .1, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }), 0, 0, 0, g, false);
  const wf = mk(new THREE.SphereGeometry(R[i], 24, 16), new THREE.MeshBasicMaterial({ color: sphCols[i], wireframe: true, transparent: true, opacity: .35, depthWrite: false, blending: THREE.AdditiveBlending }), 0, 0, 0, g, false);
  return g;
});
const d12 = C[0].distanceTo(C[1]), u12 = C[1].clone().sub(C[0]).normalize(), a12 = (d12 * d12 + R[0] * R[0] - R[1] * R[1]) / (2 * d12), r12 = Math.sqrt(R[0] * R[0] - a12 * a12);
const circle = mk(new THREE.TorusGeometry(r12, .13, 10, 100), glow('#ffffff', 1.8), 0, 0, 0, SPH, false); circle.position.copy(C[0]).add(u12.clone().multiplyScalar(a12)); circle.quaternion.setFromUnitVectors(V(0, 0, 1), u12);
const ptP = mk(new THREE.SphereGeometry(.55, 18, 14), glow(LM, 1.8), PP.x, PP.y, PP.z, SPH, false);
const ptPr = mk(new THREE.SphereGeometry(.55, 18, 14), glow('#ff4d6d', 1.8), PPrime.x, PPrime.y, PPrime.z, SPH, false);
const ptRing = mk(new THREE.TorusGeometry(1.2, .1, 8, 40), glow(LM, 1.5), 0, 0, 0, SPH, false); ptRing.rotation.x = -Math.PI / 2;
const beams = C.map((c, i) => { const g = new THREE.CylinderGeometry(.06, .06, 1, 6); g.translate(0, .5, 0); const m = mk(g, glow(sphCols[i], 1.2), c.x, c.y, c.z, SPH, false); m.quaternion.setFromUnitVectors(V(0, 1, 0), PP.clone().sub(c).normalize()); m.userData.len = R[i]; return m; });
const phoneP = G(SPH); phoneP.scale.setScalar(.2); phoneP.position.set(0, .8, 0);
mk(RBOX(5.4, 11, .7, .55), M('#14162e', { roughness: .3, metalness: .5, flatShading: false }), 0, 0, 0, phoneP);
mk(new THREE.PlaneGeometry(4.9, 10.4), new THREE.MeshBasicMaterial({ map: mapD.tex, toneMapped: false }), 0, 0, .36, phoneP, false);
phoneP.rotation.y = .5; phoneP.rotation.x = -.15;
const fixClock = dynTex(512, 200, (g, w, h, txt = '', col = '#fff') => { g.clearRect(0, 0, w, h); g.fillStyle = '#0b1030f0'; g.beginPath(); g.roundRect(8, 8, w - 16, h - 16, 40); g.fill(); g.strokeStyle = col; g.lineWidth = 10; g.stroke(); g.fillStyle = col; g.font = '900 90px Inter, DejaVu Sans, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, w / 2, h / 2 + 6); });
const fixClockM = mk(new THREE.PlaneGeometry(6, 2.34), new THREE.MeshBasicMaterial({ map: fixClock.tex, transparent: true, toneMapped: false }), 0, 0, 0, SPH, false);

// ===================================================================================== LABELS
const labs = [];
function label(text, posFn, t0, t1, opts = {}) { const el = document.createElement('div'); el.className = 'lab' + (opts.big ? ' big' : ''); el.textContent = text; document.getElementById('labs').appendChild(el); labs.push({ el, posFn: typeof posFn === 'function' ? posFn : () => posFn, t0, t1, rot: opts.rot ?? -4 }); }
const wp = (n, x, y, z) => () => V(O(n).x + x, y, z);
label('SATÉLITES', wp('space', 0, 12, 8), Wd('s2', 'satélites') - .05, E('s2') + .3);
label('RELÓGIO ATÔMICO', () => V(O('space').x + 2.5, 7.4, 40), Wd('s3', 'relógio') - .05, E('s3') + .3, { rot: 3 });
label('VELOCIDADE DA LUZ', wp('sig', 0, 22, 0), Wd('s4', 'velocidade') - .05, E('s4') + .3);
label('ATRASO', wp('sig', 0, 6, 0), Wd('s5', 'atraso') - .1, E('s5') + .3, { big: true });
label('DISTÂNCIA', wp('sig', 0, 1, 0), Wd('s6', 'distância') - .1, E('s6') + .3, { big: true });
label('ESFERA', wp('sph', 0, 17, 0), Wd('s7', 'esfera') - .1, E('s7') + .3, { big: true });
label('CÍRCULO', wp('sph', 0, 16, 0), Wd('s8', 'círculo') - .1, E('s8') + .3, { big: true });
label('SÓ 2 PONTOS', wp('sph', 0, 17, 0), Wd('s9', 'dois') - .05, E('s9') + .3);
label('SEU LOCAL', () => V(O('sph').x, 3.6, 0), Wd('s10', 'certinho') - .1, E('s10') + .3, { big: true });
label('SÓ ESCUTA', wp('phone', 0, 6.4, 0), Wd('s12', 'escuta') - .1, E('s12') + .3, { big: true });

// ===================================================================================== TIMELINE
const IDS = ['s2', 's3', 's4', 's5', 's6', 's7', 's8', 's9', 's10', 's11', 's12', 's13'];
const NAMES = ['phone1', 'space1', 'space2', 'sig1', 'sig2', 'sig3', 'sph1', 'sph2', 'sph3', 'sph4', 'phone2', 'phone3', 'sky'];
const CUTS = [{ t: S('s2'), k: 'dive' }, { t: S('s3'), k: 'whip', d: 1 }, { t: S('s4'), k: 'whip', d: -1 }, { t: S('s5'), k: 'whip', d: 1 }, { t: S('s6'), k: 'whip', d: -1 }, { t: S('s7'), k: 'dive' }, { t: S('s8'), k: 'whip', d: 1 },
  { t: S('s9'), k: 'whip', d: -1 }, { t: S('s10'), k: 'whip', d: 1 }, { t: S('s11'), k: 'dive' }, { t: S('s12'), k: 'whip', d: -1 }, { t: S('s13'), k: 'whip', d: 1 }];
function shotOf(t) { let k = 0; for (let i = 0; i < IDS.length; i++) if (t >= S(IDS[i])) k = i + 1; return NAMES[k]; }
const SET_OF = n => n.startsWith('phone') || n === 'sky' ? 'phone' : n.startsWith('space') ? 'space' : n.startsWith('sig') ? 'sig' : 'sph';
const SKY = { phone: ['#05071f', '#2a1a5c'], space: ['#02030f', '#0e1650'], sig: ['#02030f', '#10205f'], sph: ['#04061c', '#1a1c6a'] };

// ===================================================================================== PER-FRAME STATE
const capEl = document.getElementById('capw'), flashEl = document.getElementById('flash');
const allWords = NARR.lines.flatMap(l => l.words.map((w, i) => ({ ...w, end2: i < l.words.length - 1 ? l.words[i + 1].start : l.end + .12 })));
let cam = { p: V(0, 0, 0), l: V(0, 0, 0), fov: 50 };
function setCam(p, l, fov = 50) { cam.p.copy(p); cam.l.copy(l); cam.fov = fov; }
const fmt = x => x.toFixed(3).replace('.', ',') + ' s';
function packet(orbM, trail, from, to, u) { const k = cl(u); orbM.visible = k > 0 && k < 1; orbM.position.lerpVectors(from, to, k); trail.forEach((m, i) => { const kk = cl(k - (i + 1) * .018); m.visible = orbM.visible && kk > 0; m.position.lerpVectors(from, to, kk); m.scale.setScalar(Math.max(1 - i / 12, .05)); }); }

function setState(t) {
  const shot = shotOf(t), sn = SET_OF(shot);
  for (const k in sets) sets[k].visible = k === sn;
  SGw.visible = sn === 'sig'; SPw.visible = sn === 'space';
  const sc = SKY[sn]; skyU.top.value.set(sc[0]); skyU.hor.value.set(sc[1]); skyU.sunAmt.value = 0;
  hemi.intensity = 1.35; hemi.color.set('#a8c4ff'); hemi.groundColor.set('#2a1a5a'); sun.intensity = 2.6; sun.color.set('#dfe9ff'); camLight.intensity = 0; camLight.distance = 60; camLight.color.set('#cfe0ff');
  sats.forEach(s => s.root.visible = false);
  const o = O(sn);

  if (sn === 'phone') {
    const pz = shot === 'sky' ? 0 : 0;
    const popPin = bounce(t, Wd('s1', 'bolinha') - .05, .6);
    const showPin = shot === 'phone1' ? popPin : 1;
    phone.position.set(0, Math.sin(t * 1.2) * .15, 0); phone.rotation.set(Math.sin(t * .7) * .04, Math.sin(t * .5) * .12 - .1, Math.sin(t * .6) * .02);
    mapD.tex.offset.y = -t * .06;
    pin.scale.setScalar(Math.max(showPin, .001)); const ph = (t * 1.4) % 1; pinRing.scale.setScalar(.6 + ph * 1.6); pinRing.material.color.set(LM).multiplyScalar(1.3 * (1 - ph)); pinRing2.scale.setScalar(.6 + ((ph + .5) % 1) * 1.6); pinRing2.material.color.set(LM).multiplyScalar(1.0 * (1 - (ph + .5) % 1));
    const nightOn = shot === 'sky' || shot === 'phone3';
    skyStars.visible = nightOn; phGround.visible = nightOn; phGround.position.y = -6.5;
    inRings.forEach((r, i) => { const on = shot === 'phone3'; r.visible = on; if (!on) return; const k = ((t * .9) + i / inRings.length) % 1; const s = lerp(6, 2.6, k); r.scale.set(s, s, s); r.position.set(0, lerp(16, 4, k) * 0 + 7.2 * (1 - k) + 0, 1.5 + (1 - k) * 4); r.rotation.x = -Math.PI / 2 * 0; r.position.set(0, 0, lerp(8, 1, k)); r.material.color.set(CY).multiplyScalar(.7 * Math.sin(k * Math.PI)); });
    noSend.visible = shot === 'phone3'; noSend.position.set(2.6, 5.2, 2.5); noSend.scale.setScalar(Math.max(pop(t, S('s12') + 1.0, .45), .001) * .8);
    // s13 satellites net above
    const net = shot === 'sky'; const vp = net ? pop(t, S('s13'), .5) : 0;
    for (let i = 0; i < 8; i++) { const s = sats[i + 1]; const a = (i / 8) * Math.PI + .2; const R = 17; const st = { vis: net, pos: V(Math.cos(a) * R * .9, 4 + Math.sin(a) * R * .9, -6), s: .5 * vp, mood: 'happy', ph: i, ry: Math.cos(a) * .4 }; applySat(s, st, t); }
    if (net) { const k = P(t, S('s13'), DUR); }
    const fl = pin; // keep
    if (shot === 'phone1') { const u = P(t, 0, S('s2')); const din = ei(P(t, S('s2') - .4, S('s2'))); setCam(V(lerp(3, 0, eio(u)) * 1, lerp(2, 0, u), lerp(17, 11.5, eio(u)) - din * 5), V(0, 0, 0), 46 - din * 14); }
    if (shot === 'phone2') { const u = P(t, S('s11'), S('s12')); setCam(V(lerp(-6, 5, eio(u)), lerp(-2, 3, u), lerp(17, 13, u)), V(0, 0, 0), 46); phone.rotation.y += lerp(.3, -.3, u); }
    if (shot === 'phone3') { const u = P(t, S('s12'), S('s13')); setCam(V(lerp(5, 2, eio(u)), lerp(1, 4, u), lerp(16, 20, u)), V(0, 1, 2), 48); }
    if (shot === 'sky') { const u = eio(P(t, S('s13'), DUR)); setCam(V(lerp(3, 0, u), lerp(2, 5, u), lerp(14, 25, u)), V(0, lerp(0, 5, u), 0), lerp(46, 52, u)); phone.scale.setScalar(1); }
    if (shot !== 'sky') phone.scale.setScalar(1);
    const sy = { vis: shot === 'phone3', pos: V(-3.2, 7.2 + Math.sin(t * 2) * .2, -1), s: .9, mood: 'happy', ry: .3, rz: .1 }; applySat(sat, sy, t);
    if (shot === 'sky') { phone.scale.setScalar(lerp(1, .35, eio(P(t, S('s13'), DUR)))); phone.position.y = lerp(0, -4.5, eio(P(t, S('s13'), DUR))); applySat(sat, { vis: true, pos: V(0, lerp(5, 10, eio(P(t, S('s13'), DUR))), -2), s: 1.0, mood: 'joy', ry: 0, ph: 3 }, t); }
    camLight.position.set(0, 8, 16); camLight.intensity = 30;
  }

  if (sn === 'space') {
    earth.rotation.y = t * .06;
    orbitSats.forEach(os => { const a = os.a0 + t * os.o.sp * .6; const p = orbitPos(os.o, a).add(V(o.x, 0, 0)); applySat(os.sat, { vis: true, pos: p, s: .8, mood: 'happy', ph: os.a0, ry: -a + Math.PI * .5, rz: .0 }, t); });
    clockMesh.visible = shot === 'space2'; shoutRings.forEach(r => r.visible = shot === 'space2'); sparkle.forEach(s => s.visible = shot === 'space2');
    if (shot === 'space1') {
      const u = P(t, S('s2'), S('s3')); const din = 1 - eo(P(t, S('s2'), S('s2') + .5));
      setCam(V(o.x + lerp(-10, 8, eio(u)), lerp(7, 10, u), lerp(40, 34, u)), V(o.x, 1, 0), 52 - din * 10);
    }
    if (shot === 'space2') {
      const u = P(t, S('s3'), S('s4')); const sz = 40; const X = o.x; const base = V(0, 20, 0);
      const wob = Math.sin(t * 2) * .2;
      applySat(sat, { vis: true, pos: V(X - 1.6, 3.4, sz), s: 1.1, mood: t > Wd('s3', 'gritando') - .2 ? 'shout' : 'happy', ry: lerp(.35, -.25, eio(u)), shout: t > Wd('s3', 'gritando') ? 1 : 0, ph: 0 }, t);
      clockMesh.position.set(X + 2.5, 4.4, sz + 1.2); clockMesh.scale.setScalar(1.0 * pop(t, S('s3') + .5, .5) + .001); clockD.draw(t - S('s3'));
      const g0 = Wd('s3', 'gritando') - .1;
      shoutRings.forEach((r, i) => { const k = ((t - g0) * .9 + i / 5) % 1; const on = t > g0; r.visible = on; const s = lerp(1.2, 4.5, k); r.scale.set(s, s, s); r.position.set(X - 1.6, 3.4, sz + 1.6); r.material.color.set(MG).multiplyScalar(1.1 * (1 - k)); });
      sparkle.forEach((s, i) => { const a = i / 10 * TAU + t; const rr = 3.6 + Math.sin(t * 3 + i) * .4; s.position.set(X + 2.5 + Math.cos(a) * 2.2, 4.4 + Math.sin(a) * 2.2, sz + 1.5); s.scale.setScalar(Math.max(Math.sin(t * 5 + i * 2) * .5 + .6, .05)); s.rotation.y = t * 3; });
      setCam(V(X + lerp(5, 2, eio(u)), lerp(5.6, 4.6, u), sz + lerp(21, 17, eio(u))), V(X + .5, 3.8, sz), 46);
      applySat(sats[1], { vis: false }, t);
    }
    camLight.position.set(10, 14, 60); camLight.intensity = 40;
  }

  if (sn === 'sig') {
    const phoneP0 = V(o.x, 2.4, 0);
    const near = V(o.x + SAT_N.x, SAT_N.y, 0), far = V(o.x + SAT_F.x, SAT_F.y, 0), near2 = V(o.x + SAT_N2.x, SAT_N2.y, 0);
    const SPD = 1;
    watchM.forEach(m => m.visible = false); distLine.forEach(m => m.visible = false); ticks.forEach(m => m.visible = false); orb2.visible = false; orbTrail2.forEach(m => m.visible = false);
    const setLine = (i, a, b) => { const m = distLine[i]; m.visible = true; m.position.copy(a); const d = b.clone().sub(a); m.scale.set(1, d.length(), 1); m.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize()); };
    if (shot === 'sig1') {
      const u = P(t, S('s4'), S('s5')); const sp = V(o.x + 2, 16, 0);
      applySat(sat, { vis: true, pos: sp, s: 1.2, mood: 'happy', ry: -.3, ph: 1 }, t);
      const t0 = Wd('s4', 'viaja') - .1, t1 = Wd('s4', 'celular') + .15; packet(orb, orbTrail, sp.clone().add(V(0, -1.4, 0)), phoneP0.clone().add(V(0, 1.4, 0)), P(t, t0, t1));
      const pr = P(t, t1 - .1, t1 + .6); setLine(0, sp.clone().add(V(0, -1.4, 0)), phoneP0.clone().add(V(0, 1.2, 0))); distLine[0].material.color.set(GD).multiplyScalar(.5 + .0);
      setCam(V(o.x + lerp(10, 5, eio(u)), lerp(9, 8.5, u), lerp(24, 21, u)), V(o.x + .5, 9, 0), 50);
    }
    if (shot === 'sig2') {
      const u = P(t, S('s5'), S('s6')); const sp = V(o.x + 2, 16, 0);
      applySat(sat, { vis: true, pos: sp, s: 1.2, mood: 'think', ry: -.3, ph: 1 }, t);
      const t0 = S('s5') + .6, t1 = Wd('s5', 'chave') - .4; const k = P(t, t0, t1);
      packet(orb, orbTrail, sp.clone().add(V(0, -1.4, 0)), phoneP0.clone().add(V(0, 1.4, 0)), k);
      setLine(0, sp.clone().add(V(0, -1.4, 0)), phoneP0.clone().add(V(0, 1.2, 0))); distLine[0].material.color.set('#ffffff').multiplyScalar(.7);
      watchM[0].visible = t > t0 - .3; watchM[0].position.set(o.x - 2.6, 9, 1); watchM[0].scale.setScalar(.62 * pop(t, t0 - .3, .4) + .001);
      watchD[0].draw(fmt(.067 * eio(k)), k >= 1 ? LM : '#ffffff');
      setCam(V(o.x + lerp(-6, 4, eio(u)), lerp(9, 10, u), lerp(24, 21, u)), V(o.x, 9, 0), 50);
    }
    if (shot === 'sig3') {
      const u = P(t, S('s6'), S('s7')); const din = ei(P(t, S('s7') - .4, S('s7')));
      applySat(sats[1], { vis: true, pos: near2, s: 1.0, mood: 'happy', ry: .3, ph: 2 }, t); applySat(sat, { vis: true, pos: far, s: 1.0, mood: 'happy', ry: -.3, ph: 1 }, t);
      const tt = Wd('s6', 'quanto') + .3, kN = P(t, tt, tt + 1.1), kF = P(t, tt, tt + 2.0);
      packet(orb, orbTrail, near2.clone().add(V(0, -1.2, 0)), phoneP0.clone().add(V(0, 1.4, 0)), kN); packet(orb2, orbTrail2, far.clone().add(V(0, -1.2, 0)), phoneP0.clone().add(V(0, 1.4, 0)), kF);
      setLine(0, near2.clone().add(V(0, -1.2, 0)), phoneP0.clone().add(V(0, 1.2, 0))); setLine(1, far.clone().add(V(0, -1.2, 0)), phoneP0.clone().add(V(0, 1.2, 0)));
      distLine[0].material.color.set(GD).multiplyScalar(.9); distLine[1].material.color.set('#7fe8ff').multiplyScalar(.9);
      watchM[0].visible = true; watchM[0].position.set(o.x - 4.2, 6, 1); watchM[0].scale.setScalar(.55 * pop(t, tt, .4) + .001); watchD[0].draw(fmt(.067 * eio(kN)), kN >= 1 ? GD : '#ffffff', GD);
      watchM[1].visible = true; watchM[1].position.set(o.x + 4.5, 22, 1); watchM[1].scale.setScalar(.55 * pop(t, tt, .4) + .001); watchD[1].draw(fmt(.072 * eio(kF)), kF >= 1 ? '#7fe8ff' : '#ffffff');
      setCam(V(o.x + lerp(2, -2, eio(u)), lerp(14, 15, u), lerp(34, 30, u)), V(o.x + 1, 13, 0), 50);
      const dv = din; if (dv > 0) cam.p.z -= dv * 8;
    }
    // phone always visible (child of SG)
    phoneS.visible = true;
    camLight.position.set(o.x + 8, 20, 30); camLight.intensity = 60;
  }

  if (sn === 'sph') {
    const oo = o.x;
    const sT = [S('s7'), S('s8'), S('s9'), S('s10')];
    const rev = i => i === 3 ? P(t, sT[3] + .1, sT[3] + .9) : P(t, sT[i] - .1 + (i === 0 ? .2 : 0), sT[i] + .9);
    shells.forEach((g, i) => { const k = eo(rev(i)); g.visible = k > 0; g.scale.setScalar(Math.max(k, .001)); g.position.set(C[i].x, C[i].y, C[i].z); });
    // older shells fade as new appear: emphasise by scaling wire opacity
    shells.forEach((g, i) => { const later = i === 0 ? t > sT[1] : i === 1 ? t > sT[2] : i === 2 ? t > sT[3] : false; g.children[1].material.opacity = later ? .16 : .35; g.children[0].material.opacity = later ? .05 : .1; });
    const cK = eo(P(t, Wd('s8', 'cruzam') - .1, Wd('s8', 'cruzam') + .7)); circle.visible = cK > 0 && t < sT[2] + 1.2 || (t >= sT[2] + 1.2 && false); circle.scale.setScalar(Math.max(cK, .001)); circle.material.color.set('#fff').multiplyScalar(t > sT[2] ? .9 : 1.8);
    const circ3 = t > sT[2] + .5; circle.visible = cK > 0 && !circ3;
    const twoK = bounce(t, Wd('s9', 'dois') - .1, .6); const showP = t > sT[1] + .4 ? 1 : 0;
    ptP.visible = t >= sT[0] + .3 && true; ptP.scale.setScalar(Math.max(.001, t < sT[2] ? .5 : 1) * Math.max(pop(t, sT[0] + .3, .4), .001));
    const ptPrK = bounce(t, Wd('s9', 'dois') - .1, .6) * (1 - eo(P(t, Wd('s10', 'certinho') - .6, Wd('s10', 'certinho') - .1)));
    ptPr.visible = ptPrK > .01; ptPr.scale.setScalar(Math.max(ptPrK, .001));
    // ring around real point on 'certinho'
    const rk = P(t, Wd('s10', 'certinho') - .1, Wd('s10', 'certinho') + 1.2); ptRing.visible = rk > 0; const rs = 1 + rk * 1.5; ptRing.scale.setScalar(rs); ptRing.material.color.set(LM).multiplyScalar(1.5 * (1 - rk));
    beams.forEach((b, i) => { const k = eo(rev(i)); b.visible = k > 0; b.scale.set(1, b.userData.len * k, 1); });
    C.forEach((c, i) => { const k = pop(t, i === 3 ? sT[3] : sT[i] - .1, .5); applySat(sats[i], { vis: k > .01, pos: c.clone().add(V(o.x, 0, 0)), s: .75 * Math.max(k, .001), mood: i === 3 ? 'shout' : 'happy', ph: i, ry: i === 0 ? .6 : i === 1 ? -.6 : 0, shout: 0 }, t); });
    // sats are siblings of scene (not of set): position includes o.x
    shells.forEach(g => g.position.x += 0);
    // clock fix
    const fx = Wd('s10', 'acerta') - .1, fk = P(t, fx, fx + 1.6);
    fixClockM.visible = fk > 0 && t < E('s10') + .2; fixClockM.position.set(-1.5, 9, 9); fixClockM.scale.setScalar(Math.max(pop(t, fx, .4), .001) * .5);
    fixClock.draw(fk < .5 ? 'erro +0,13' : 'erro 0,00', fk < .5 ? '#ff7a8a' : LM);
    phoneP.visible = true;
    if (shot === 'sph1') { const u = P(t, S('s7'), S('s8')); const din = 1 - eo(P(t, S('s7'), S('s7') + .5)); setCam(V(oo + lerp(-14, -6, eio(u)), lerp(15, 13, u), lerp(34, 30, u)), V(oo, 6.5, 0), 52 - din * 12); }
    if (shot === 'sph2') { const u = P(t, S('s8'), S('s9')); setCam(V(oo + lerp(10, 16, eio(u)), lerp(11, 9, u), lerp(32, 28, u)), V(oo, 6, 0), 52); }
    if (shot === 'sph3') { const u = P(t, S('s9'), S('s10')); setCam(V(oo + lerp(16, 3, eio(u)), lerp(10, 14, u), lerp(26, 33, u)), V(oo, 7.5, 0), 52); }
    if (shot === 'sph4') { const u = P(t, S('s10'), S('s11')); const din = ei(P(t, S('s11') - .4, S('s11'))); setCam(V(oo + lerp(2, -5, eio(u)), lerp(14, 9, u), lerp(33, 22, eio(u))), V(oo, lerp(7.5, 2.5, eio(u)), 0), 50 - din * 8); }
    camLight.position.set(oo, 14, 24); camLight.intensity = 50;
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
