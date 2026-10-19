// RHUL Campus Drive: entry point. Builds the scene from rhul/data/campus.json and runs the app loop.
import { T, clamp, nextFrame, ringCentroid, pointInPoly, ringArea, flatten } from './util.js';
import * as MT from './materials.js';
import { makeLandcover, buildGround, buildKerbs, buildMarkings, CLS } from './ground.js';
import { buildFounders } from './founders.js';
import { buildBuildings, ARCH } from './buildings.js';
import { buildTrees, buildFurniture, buildEntrance, buildExtras, treeOk } from './landscape.js';
import { Grid } from './collision.js';
import { buildCar, Driver } from './vehicle.js';
import { CameraRig, MODES, MODE_LABEL } from './cameras.js';
import { buildTraffic, buildWalkers } from './traffic.js';
import { Router } from './router.js';
import { Tour } from './tour.js';
import { CampusMap } from './map.js';
import { ENTRIES, SRC, CONF_LABEL } from './info.js';

const $ = id => document.getElementById(id);
const isPhone = matchMedia('(max-width: 760px)').matches;
const coarse = matchMedia('(pointer: coarse)').matches;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const BASE = new URL('../', import.meta.url).href; // rhul/

function progress(label, f) { const el = $('loadingBar'); if (el) el.style.width = Math.round(f * 100) + '%'; const t = $('loadingText'); if (t) t.textContent = label; }
function loadImage(src) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Could not load ' + src)); i.src = src; }); }
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

async function main() {
  progress('Loading campus data…', 0.03);
  let data, img;
  try {
    [data, img] = await Promise.all([fetch(BASE + 'data/campus.json').then(r => { if (!r.ok) throw new Error('campus.json ' + r.status); return r.json(); }), loadImage(BASE + 'data/landcover.png')]);
  } catch (e) { fail('The campus data could not be loaded (' + e.message + '). Please reload the page.'); return; }

  // ---------------------------------------------------------------- renderer and scene
  const canvas = $('scene');
  let renderer;
  try { renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: /[?&]capture/.test(location.search) }); }
  catch (e) { document.body.classList.add('no-webgl'); fail('Your browser could not start WebGL, which this 3D campus needs.'); return; }
  const maxPR = Math.min(devicePixelRatio || 1, 2);
  let pr = isPhone ? Math.min(maxPR, 1.5) : maxPR;
  renderer.setPixelRatio(pr); renderer.setSize(innerWidth, innerHeight, false);
  renderer.outputEncoding = T.sRGBEncoding; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.95;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
  MT.setAnisotropy(Math.min(8, renderer.capabilities.getMaxAnisotropy()));
  const scene = new T.Scene();
  const HORIZON = new T.Color('#c9d9e6');
  scene.fog = new T.FogExp2(HORIZON, 0.0006);
  const camera = new T.PerspectiveCamera(isPhone ? 62 : 50, innerWidth / innerHeight, 0.3, 4000);

  // ---------------------------------------------------------------- sky, sun and environment
  // default: a clear early-afternoon sun from the south-south-west (azimuth 205°, elevation 42°)
  const az = 205 * Math.PI / 180, el = 42 * Math.PI / 180;
  const sunDir = new T.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)).normalize();
  const skyMat = new T.ShaderMaterial({
    side: T.BackSide, depthWrite: false, fog: false,
    uniforms: { sunDir: { value: sunDir }, top: { value: new T.Color('#3f74b8') }, mid: { value: new T.Color('#9cc3e6') }, low: { value: HORIZON }, time: { value: 0 }, clouds: { value: 1 } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); vec4 p = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w; }',
    fragmentShader: `uniform vec3 sunDir, top, mid, low; uniform float time, clouds; varying vec3 vP;
      float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h21(i),h21(i+vec2(1,0)),f.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x), f.y); }
      float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * n2(p); p *= 2.03; a *= 0.5; } return s; }
      void main(){
        vec3 d = normalize(vP); float h = d.y;
        vec3 c = mix(low, mid, smoothstep(-0.02, 0.18, h)); c = mix(c, top, smoothstep(0.18, 0.75, h));
        float sd = max(dot(d, sunDir), 0.0); c += vec3(1.0, 0.92, 0.75) * (pow(sd, 900.0) * 6.0 + pow(sd, 12.0) * 0.18);
        if (h > 0.02 && clouds > 0.5) { vec2 uv = d.xz / (h + 0.12) * 1.6 + vec2(time * 0.004, time * 0.002); float n = fbm(uv); float cov = smoothstep(0.52, 0.8, n) * smoothstep(0.02, 0.2, h);
          vec3 cc = mix(vec3(0.98, 0.98, 1.0), vec3(0.72, 0.76, 0.82), smoothstep(0.6, 0.95, fbm(uv * 1.7 + 3.1))); c = mix(c, cc + pow(sd, 6.0) * 0.12, cov * 0.9); }
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <encodings_fragment>
      }`
  });
  const sky = new T.Mesh(new T.SphereGeometry(1800, 32, 16), skyMat); sky.frustumCulled = false; sky.renderOrder = -10; scene.add(sky);
  {
    // image-based light for reflections: the same sky plus a warm ground, prefiltered
    const envScene = new T.Scene(); const s2 = new T.Mesh(new T.SphereGeometry(100, 32, 16), skyMat.clone()); s2.material.uniforms.clouds.value = 0; envScene.add(s2);
    const groundE = new T.Mesh(new T.CircleGeometry(100, 32), new T.MeshBasicMaterial({ color: '#6f7a5a' })); groundE.rotation.x = -Math.PI / 2; groundE.position.y = -2; envScene.add(groundE);
    const pm = new T.PMREMGenerator(renderer); scene.environment = pm.fromScene(envScene, 0.04).texture; pm.dispose();
  }
  const hemi = new T.HemisphereLight('#dfeaf7', '#6b6750', 0.5); scene.add(hemi);
  const sun = new T.DirectionalLight('#fff1dc', 2.15); sun.castShadow = true;
  const SH = isPhone ? 1024 : 2048, SHR = isPhone ? 60 : 95;
  sun.shadow.mapSize.set(SH, SH); Object.assign(sun.shadow.camera, { left: -SHR, right: SHR, top: SHR, bottom: -SHR, near: 1, far: 700 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04; scene.add(sun, sun.target);

  // ---------------------------------------------------------------- campus
  progress('Laying out the grounds…', 0.12); await nextFrame();
  const lc = makeLandcover(data, img);
  const ground = buildGround(data, lc, renderer); scene.add(ground.group);
  scene.add(buildKerbs(data)); scene.add(buildMarkings(data));
  progress("Building Founder's Building…", 0.25); await nextFrame();
  const founders = buildFounders(data); founders.features.foundersSquare = founders.toScene(data.founders.dims.W / 2 + 24, 0); scene.add(founders.group);
  progress('Building the campus…', 0.45); await nextFrame();
  const blds = buildBuildings(data, founders); scene.add(blds.group);
  progress('Planting trees…', 0.6); await nextFrame();
  const trees = buildTrees(data, lc, founders, { phone: isPhone }); scene.add(trees.group);
  progress('Street furniture…', 0.72); await nextFrame();
  const furniture = buildFurniture(data, lc, founders); scene.add(furniture);
  const entrance = buildEntrance(data, lc); scene.add(entrance.group);
  const extras = buildExtras(data); scene.add(extras);

  // ---------------------------------------------------------------- map items (shared by the map, picking, search and the info panel)
  const entryByRef = {}; ENTRIES.forEach(e => { if (e.ref.building) entryByRef[e.ref.building] = e; });
  const items = [];
  const catOf = b => b.data.name && entryByRef[b.id] ? entryByRef[b.id].category : /hall|gowar/.test(b.arch) ? 'residential' : b.data.map_class === 'academic' ? 'academic' : 'unknown';
  items.push({ key: 'B25', kind: 'founders', rings: [founders.outline, ...founders.quads.map(q => q.slice().reverse())], category: 'historic', entry: ENTRIES.find(e => e.id === 'founders'), height: 30, centre: founders.features.lanternTower, label: "Founder's Building" });
  for (const b of blds.list) {
    const e = entryByRef[b.id];
    items.push({ key: b.id, kind: 'building', rings: [b.ring, ...b.holes], category: catOf(b), entry: e || null, height: b.height, base: b.base, centre: b.centre, b, label: e ? (e.conf === 'candidate' ? e.name + '?' : e.name.replace(/ \(.*\)$/, '').replace(' halls', '')) : null });
  }
  for (const it of items) { const c = it.centre || ringCentroid(it.rings[0]); it.lx = c[0]; it.lz = c[1]; }
  const placeXZ = id => { const p = data.places.find(q => q.id === id); if (p) return [p.x, p.z]; if (id === 'gate') return [entrance.gate.x, entrance.gate.z]; if (id === 'tennis') return data.extras.tennis.slice(0, 2); return null; };
  const entryPos = e => e.ref.building ? (items.find(i => i.key === e.ref.building) || {}).centre : e.ref.feature ? founders.features[e.ref.feature] : e.ref.place ? placeXZ(e.ref.place) : e.ref.xz;
  const points = ENTRIES.filter(e => !e.ref.building).map(e => { const p = entryPos(e); return p ? { label: e.name.replace(' (entrance front)', ''), lx: p[0], lz: p[1], area: e.conf === 'area', entry: e, minK: e.ref.feature ? 1.6 : 0 } : null; }).filter(Boolean);

  // ---------------------------------------------------------------- collision grid
  progress('Working out where you can drive…', 0.8); await nextFrame();
  const xs = data.outline.map(p => p[0]), zs = data.outline.map(p => p[1]);
  const grid = new Grid(Math.min(...xs) - 250, Math.min(...zs) - 250, Math.max(...xs) + 250, Math.max(...zs) + 250, 0.5);
  items.forEach((it, idx) => {
    if (it.kind === 'founders') { for (const r of founders.blockers) grid.fillPolygon([r], { height: 26, owner: idx }); return; }
    if (it.base > 0.5) { grid.fillPolygon(it.rings, { solid: 0, height: it.height, owner: idx }); return; } // raised on columns: drive underneath
    grid.fillPolygon(it.rings, { height: it.height, owner: idx });
  });
  // columns under raised buildings, tree trunks, lamp posts, bollards and walls
  for (const g2 of [blds.group]) g2.traverse(o => { if (o.isInstancedMesh && /pilotis/.test(o.material.name || '') ) void 0; });
  // obstacles use exactly the same filters as the visible props (nothing invisible blocks the car)
  const offRoad = (x, z) => { const c = lc.at(x, z); return c !== CLS.ROAD; };
  data.trees.forEach(([x, z, s], i) => { if ((!isPhone || i % 2 === 0) && treeOk(lc, founders, x, z)) grid.fillCircle(x, z, 0.3 * s, true); });
  for (const [x, z] of data.furniture.lamps) if (offRoad(x, z) && !pointInPoly(x, z, founders.outline)) grid.fillCircle(x, z, 0.18, true);
  for (const [x, z] of data.furniture.bollards) if (offRoad(x, z) && !pointInPoly(x, z, founders.outline)) grid.fillCircle(x, z, 0.14, true);
  for (const run of data.furniture.a30wall) for (let k = 0; k < run.length - 1; k++) grid.fillSegment(run[k][0], run[k][1], run[k + 1][0], run[k + 1][1], 0.5);
  scene.updateMatrixWorld(true);
  const box = new T.Box3();
  for (const g2 of [entrance.group, extras]) g2.traverse(o => {
    if (!o.isMesh || o.isInstancedMesh) return; if (o.material && o.material.transparent) return;
    for (let q = o; q; q = q.parent) if (q.userData.noCollide) return; // gates stand open against the piers
    box.setFromObject(o); if (box.max.y < 0.9 || box.min.y > 1.0) return; if (box.max.x - box.min.x > 20 || box.max.z - box.min.z > 20) return;
    grid.fillPolygon([[[box.min.x, box.min.z], [box.max.x, box.min.z], [box.max.x, box.max.z], [box.min.x, box.max.z]]], { height: Math.max(0, box.max.y) });
  });
  // bake small static props into one mesh per material (fewer draw calls)
  flatten(entrance.group); flatten(extras); flatten(furniture);

  // ---------------------------------------------------------------- car, traffic, people
  const car = buildCar(); flatten(car.body, { keep: o => car.wheels.some(w => w.hub === o) }); scene.add(car.root);
  const router = new Router(data.roads);
  const driver = new Driver({ grid, lc, a30: data.routes.A30, roadEdges: data.roads.edges });
  driver.place(entrance.start.x, entrance.start.z, entrance.start.h);
  const traffic = buildTraffic(data, scene);
  const walkers = buildWalkers(data, scene, isPhone ? 14 : 34);

  // ---------------------------------------------------------------- cameras, map, tour
  const rig = new CameraRig(camera, canvas, grid);
  rig.pos.set(driver.x - 260, 220, driver.z + 160); rig.target.set(founders.features.lanternTower[0], 0, founders.features.lanternTower[1]);
  camera.position.copy(rig.pos); camera.lookAt(rig.target);
  rig.setMode('chase', { force: true }); rig.blend = reduceMotion ? 1 : 0;
  const map = new CampusMap({ mini: $('minimap'), big: $('bigmap'), bigWrap: $('mapPanel'), data, lc, items, onSelect: (it, o) => selectItem(it, o), getCar: () => driver, getRoute: () => tour.route, getTraffic: () => traffic.vehicles.map(v => v.mesh.position) });
  map.points = points;
  const tour = new Tour({ router, driver, rig, onStop: s => { showEntry(s.entry, { auto: true }); highlight(s.item || null); }, onState: st => tourUI(st) });
  const F = founders.features;
  const near = (p, d = 1) => p;
  const stop = (id, focus, approach, view, dwell = 12, opts = {}) => ({ entry: ENTRIES.find(e => e.id === id), focus, approach, view, dwell, ...opts, title: ENTRIES.find(e => e.id === id).name });
  const itemFor = key => items.find(i => i.key === key);
  // stops follow the campus from the main gate, round Founder's, through the academic heart, north, east and south, and back
  tour.setStops([
    stop('gates', [entrance.gate.x, entrance.gate.z], null, { r: 32, h: 14, ty: 3, spin: 0.08 }, 9, { stay: true }),
    stop('clock-tower', F.clockTower, near(F.entrance), { r: 85, h: 42, ty: 18, spin: 0.07 }, 12),
    stop('north-quad', F.northQuad, null, { r: 48, h: 46, ty: 4, spin: 0.1 }, 11, { stay: true }),
    stop('chapel', F.chapel, null, { r: 60, h: 40, ty: 12, spin: 0.08 }, 10, { stay: true }),
    stop('south-quad', F.southQuad, null, { r: 48, h: 46, ty: 4, spin: 0.1 }, 10, { stay: true }),
    stop('founders-square', F.foundersSquare, F.foundersSquare, { r: 70, h: 30, ty: 8, spin: 0.06 }, 12, { item: itemFor('B48') }),
    stop('academic', placeXZ('academic'), placeXZ('academic'), { r: 90, h: 50, ty: 8 }, 11),
    stop('north', placeXZ('north'), placeXZ('north'), { r: 80, h: 45, ty: 6 }, 10),
    stop('union', itemFor('B04').centre, itemFor('B04').centre, { r: 70, h: 35, ty: 6 }, 11, { item: itemFor('B04') }),
    stop('shilling', itemFor('B20').centre, itemFor('B20').centre, { r: 55, h: 30, ty: 8 }, 10, { item: itemFor('B20') }),
    stop('hub', placeXZ('hub'), placeXZ('hub'), { r: 90, h: 45, ty: 8 }, 10),
    stop('gowar', itemFor('B66').centre, itemFor('B66').centre, { r: 90, h: 45, ty: 8 }, 10, { item: itemFor('B66') }),
    stop('sports', placeXZ('sports'), placeXZ('sports'), { r: 100, h: 50, ty: 4 }, 9),
    stop('woodland', placeXZ('woodland'), placeXZ('woodland'), { r: 90, h: 40, ty: 4 }, 10),
    stop('pool', itemFor('B28').centre, itemFor('B28').centre, { r: 40, h: 22, ty: 3 }, 9, { item: itemFor('B28') }),
    stop('dragon-tower', F.dragonTower, F.southFront, { r: 90, h: 40, ty: 18, spin: 0.06 }, 12, { item: itemFor('B25') }),
    stop('founders', F.lanternTower, null, { r: 210, h: 120, ty: 10, spin: 0.05 }, 12, { stay: true, item: itemFor('B25') })
  ]);

  // ---------------------------------------------------------------- selection, highlight and the info panel
  const hl = new T.Group(); hl.name = 'highlight'; scene.add(hl);
  const hlMat = new T.LineBasicMaterial({ color: '#ff7a1a', transparent: true, opacity: 0.95, depthTest: false });
  const beacon = new T.Mesh(new T.ConeGeometry(1.6, 3.4, 4), new T.MeshBasicMaterial({ color: '#ff7a1a' })); beacon.rotation.x = Math.PI; beacon.visible = false; scene.add(beacon);
  let selected = null;
  function highlight(it) {
    while (hl.children.length) { const c = hl.children.pop(); c.geometry.dispose(); }
    selected = it || null; beacon.visible = !!it; map.selected = it || null;
    if (!it) return;
    const pos = [];
    for (const r of it.rings) for (let i = 0; i < r.length; i++) { const a = r[i], b = r[(i + 1) % r.length]; for (const y of [0.15, it.height]) pos.push(a[0], y, a[1], b[0], y, b[1]); pos.push(a[0], 0.15, a[1], a[0], it.height, a[1]); }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    const lines = new T.LineSegments(g, hlMat); lines.renderOrder = 5; hl.add(lines);
    beacon.position.set(it.centre[0], it.height + 6, it.centre[1]);
  }
  const card = $('card'), cardBody = $('cardBody');
  let shownKey = null, dismissed = null;
  function sourcesHTML(list) { return '<p class="sources">Sources: ' + list.map(k => SRC[k]).filter(Boolean).map(s => `<a href="${s.url}" target="_blank" rel="noopener">${esc(s.label)}</a>`).join(' · ') + '</p>'; }
  function showEntry(e, { auto = false, item = null } = {}) {
    if (!e && !item) { hideCard(); return; }
    const key = e ? e.id : item.key; if (auto && dismissed === key) return; shownKey = key;
    let html;
    if (e) {
      html = `<p class="eyebrow"><span class="conf conf-${e.conf}">${esc(CONF_LABEL[e.conf])}</span></p><h2>${esc(e.name)}</h2>` +
        `<p class="func">${esc(e.func)}</p>` + e.text.map(t => `<p>${esc(t)}</p>`).join('') + (e.sig ? `<p class="sig">${esc(e.sig)}</p>` : '') + sourcesHTML(e.sources);
    } else {
      const b = item.b, A = ARCH[b.arch] || {}, area = Math.round(Math.abs(ringArea(item.rings[0])));
      html = `<p class="eyebrow"><span class="conf conf-unnamed">Name not yet identified</span></p><h2>Building ${esc(item.key)}</h2>` +
        `<p class="func">${esc(A.label || 'Campus building')}</p><p>Footprint about ${area.toLocaleString()} m² (from the campus map trace); modelled as ${b.storeys} storey${b.storeys > 1 ? 's' : ''}, about ${Math.round(item.height)} m tall (estimated).</p>` +
        `<p class="sig">Its position comes from the campus map; its name has not been verified, so it is not labelled. The façade style follows the original project's campus video.</p>`;
    }
    html += `<div class="card-actions"><button class="btn small" data-act="focus">Focus camera</button><button class="btn small" data-act="drive">Drive there</button><button class="btn small ghost" data-act="close" aria-label="Close panel">Close</button></div>`;
    cardBody.innerHTML = html; card.classList.add('on'); card.dataset.key = key;
    cardBody.querySelector('[data-act="focus"]').onclick = () => focusOn(e, item);
    cardBody.querySelector('[data-act="drive"]').onclick = () => { const p = item ? item.centre : entryPos(e); if (p && tour.driveTo(p[0], p[1], e ? e.name : item.key)) { rig.setMode('chase'); toast('Driving to ' + (e ? e.name : 'building ' + item.key) + ' by road. Press any driving key to take over.'); } };
    cardBody.querySelector('[data-act="close"]').onclick = () => { dismissed = key; hideCard(); highlight(null); };
  }
  function hideCard() { card.classList.remove('on'); shownKey = null; }
  function focusOn(e, item) {
    const it = item || (e && e.ref.building ? itemFor(e.ref.building) : null);
    const p = it ? it.centre : entryPos(e); if (!p) return;
    const rad = it ? Math.sqrt(Math.abs(ringArea(it.rings[0]))) * 0.7 : 25;
    rig.focus(p[0], p[1], Math.max(18, rad), it ? Math.min(it.height * 0.4, 14) : 4);
    setCamButton();
  }
  function selectItem(it, opts = {}) {
    if (!it) { highlight(null); return; }
    if (it.entry && !it.kind) { const e = it.entry; showEntry(e); const bi = e.ref.building ? itemFor(e.ref.building) : null; highlight(bi); if (opts.fromSearch) focusOn(e, bi); return; }
    highlight(it); showEntry(it.entry, { item: it.entry ? null : it }); if (it.entry) dismissed = null;
    if (opts.fromSearch) focusOn(it.entry, it);
  }
  // tap/click on a building in the 3D view selects it
  // (the camera rig's own pointerup handler is registered first, so lastTap is already set; it is read now, not after a
  // timeout, so that a slow frame cannot make a genuine tap look stale)
  canvas.addEventListener('pointerup', () => { const tap = rig.lastTap; rig.lastTap = null; if (tap) setTimeout(() => pickAt(tap), 0); });
  function pickAt(tap) {
    const r = canvas.getBoundingClientRect(), ndc = new T.Vector2((tap.x - r.left) / r.width * 2 - 1, -((tap.y - r.top) / r.height * 2 - 1));
    const ray = new T.Raycaster(); ray.setFromCamera(ndc, camera);
    const o = ray.ray.origin, d = ray.ray.direction;
    for (let s = 1; s < 900; s += 0.6) { const x = o.x + d.x * s, y = o.y + d.y * s, z = o.z + d.z * s; if (y < 0) break; const own = grid.ownerAt(x, z); if (own >= 0 && y <= items[own].height + 0.5) { selectItem(items[own]); return; } }
  }

  // ---------------------------------------------------------------- input
  const keys = {};
  const isTyping = e => { const t = e.target; return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable); };
  const DRIVE = { arrowup: 'up', w: 'up', arrowdown: 'down', s: 'down', arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right', ' ': 'space', shift: 'shift', q: 'q', e: 'e' };
  addEventListener('keydown', e => {
    if (isTyping(e)) { if (e.key === 'Escape') e.target.blur(); return; }
    const k = e.key.toLowerCase();
    if (DRIVE[k]) {
      keys[DRIVE[k]] = true; if (k !== 'shift') e.preventDefault();
      if (['up', 'down', 'left', 'right', 'space'].includes(DRIVE[k]) && rig.mode !== 'drone') takeOver();
      started();
    }
    if (e.repeat) return;
    if (k === 'c') { cycleCam(); }
    else if (k >= '1' && k <= '4') { rig.setMode(MODES[+k - 1]); setCamButton(); }
    else if (k === 'm') { map.setOpen(!map.open); }
    else if (k === 'escape') { if (map.open) map.setOpen(false); else if ($('help').hidden === false) $('help').hidden = true; else { hideCard(); highlight(null); } }
    else if (k === 'r') { tour.stop(); driver.resetToRoad(); toast('Car moved to the nearest road.'); }
    else if (k === 't') { toggleTour(); }
    else if (k === 'p' && tour.active) { tour.pause(); }
    else if (k === 'n' && tour.active) { tour.skip(); }
    else if (k === 'f') { setRoadRules(!driver.roadRules); }
    else if (k === 'h' || k === '?') { $('help').hidden = !$('help').hidden; }
  });
  addEventListener('keyup', e => { const k = e.key.toLowerCase(); if (DRIVE[k]) keys[DRIVE[k]] = false; });
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
  const touch = { up: false, down: false, left: false, right: false };
  document.querySelectorAll('[data-pad]').forEach(b => {
    const k = b.dataset.pad;
    const on = e => { e.preventDefault(); touch[k] = true; b.classList.add('on'); if (rig.mode !== 'drone') takeOver(); started(); };
    const off = e => { e.preventDefault(); touch[k] = false; b.classList.remove('on'); };
    b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off); b.addEventListener('pointerleave', off);
  });
  function takeOver() { if (tour.active || tour.autopilot) { tour.stop('takeover'); toast('You have the wheel.'); } }
  let hasStarted = false;
  function started() { if (!hasStarted) { hasStarted = true; $('hint').classList.add('hide'); if (shownKey === 'start') hideCard(); } }

  // ---------------------------------------------------------------- HUD controls
  const camBtn = $('camBtn');
  function setCamButton() { camBtn.textContent = (isPhone ? '' : 'View: ') + MODE_LABEL[rig.mode]; camBtn.setAttribute('aria-label', 'Camera view: ' + MODE_LABEL[rig.mode] + '. Press to change.'); }
  function cycleCam() { const i = MODES.indexOf(rig.mode); const m = MODES[(i + 1) % MODES.length]; if (m === 'orbit') rig.setMode('orbit', { target: [driver.x, 1.5, driver.z], dist: 30 }); else rig.setMode(m); setCamButton(); toast(MODE_LABEL[m] + ' view' + (m === 'drone' ? ': arrows or WASD to fly, Q/E down/up, drag to look' : m === 'orbit' ? ': drag to orbit, scroll or pinch to zoom' : '')); }
  camBtn.addEventListener('click', () => { cycleCam(); started(); });
  setCamButton();
  const tourBtn = $('tourBtn');
  function toggleTour() { started(); if (tour.active) tour.stop(); else { tour.start(0); toast('Guided tour: the car drives itself along campus roads. Use the arrow keys or WASD to take over at any time.'); } }
  tourBtn.addEventListener('click', toggleTour);
  $('tourPause').addEventListener('click', () => tour.pause());
  $('tourSkip').addEventListener('click', () => tour.skip());
  $('tourStop').addEventListener('click', () => tour.stop());
  function tourUI(st) {
    const bar = $('tourBar'), on = st.active || !!st.autopilot;
    bar.hidden = !on; tourBtn.setAttribute('aria-pressed', String(st.active)); tourBtn.textContent = st.active ? (isPhone ? 'Stop' : 'Stop tour') : (isPhone ? 'Tour' : 'Auto tour');
    $('tourPause').hidden = !st.active; $('tourSkip').hidden = !st.active;
    $('tourPause').textContent = st.paused ? 'Resume' : 'Pause';
    if (st.autopilot) $('tourTitle').textContent = 'Driving to ' + st.autopilot.label;
    else if (st.active) $('tourTitle').textContent = `Stop ${st.k + 1} of ${st.n}: ${st.stop.title}`;
    if (st.reason && st.reason.startsWith('arrived:')) toast('Arrived: ' + st.reason.slice(8));
    if (st.reason === 'finished') toast('That was the tour. The car is yours.');
    if (!on) { setCamButton(); }
  }
  $('mapBtn').addEventListener('click', () => { map.setOpen(!map.open); started(); });
  $('mapClose').addEventListener('click', () => map.setOpen(false));
  $('mapFit').addEventListener('click', () => map.fitCampus());
  $('mapMe').addEventListener('click', () => map.centreOn(driver.x, driver.z, 2.4));
  $('mapIn').addEventListener('click', () => { const r = $('bigmap').getBoundingClientRect(); map.zoomAt(r.left + r.width / 2, r.top + r.height / 2, 1.4); });
  $('mapOut').addEventListener('click', () => { const r = $('bigmap').getBoundingClientRect(); map.zoomAt(r.left + r.width / 2, r.top + r.height / 2, 1 / 1.4); });
  $('minimap').addEventListener('click', () => { map.setOpen(true); started(); });
  $('minimap').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); map.setOpen(true); } });
  $('helpBtn').addEventListener('click', () => { $('help').hidden = !$('help').hidden; closeMore(); });
  const moreBtn = $('moreBtn'); function closeMore() { document.body.classList.remove('more-open'); moreBtn.setAttribute('aria-expanded', 'false'); }
  moreBtn.addEventListener('click', () => { const o = document.body.classList.toggle('more-open'); moreBtn.setAttribute('aria-expanded', String(o)); });
  for (const id of ['rulesBtn', 'resetBtn', 'soundBtn']) $(id).addEventListener('click', () => setTimeout(closeMore, 400));
  if (isPhone) tourBtn.textContent = 'Tour';
  $('helpClose').addEventListener('click', () => { $('help').hidden = true; });
  $('resetBtn').addEventListener('click', () => { tour.stop(); driver.resetToRoad(); toast('Car moved to the nearest road.'); });
  function setRoadRules(v) { driver.roadRules = v; const b = $('rulesBtn'); b.setAttribute('aria-pressed', String(!v)); b.textContent = v ? 'Roads only' : 'Free roam'; toast(v ? 'Roads only: the car stays on campus roads and car parks.' : 'Free roam: footpaths, lawns and woods at walking pace.'); }
  $('rulesBtn').addEventListener('click', () => setRoadRules(!driver.roadRules));
  // search
  const searchIn = $('mapSearch'), results = $('mapResults');
  const searchables = ENTRIES.map(e => ({ name: e.name, sub: CONF_LABEL[e.conf], entry: e })).concat(items.filter(i => !i.entry && i.kind === 'building').map(i => ({ name: 'Building ' + i.key, sub: (ARCH[i.b.arch] || {}).label || '', item: i })));
  function runSearch() {
    const q = searchIn.value.trim().toLowerCase(); results.innerHTML = '';
    if (!q) { results.hidden = true; return; }
    const hits = searchables.filter(s => s.name.toLowerCase().includes(q) || (s.entry && (s.entry.func + ' ' + s.entry.text.join(' ')).toLowerCase().includes(q))).slice(0, 8);
    results.hidden = false;
    if (!hits.length) { results.innerHTML = '<li class="none">No match. Many campus buildings are not yet identified by name.</li>'; return; }
    hits.forEach((h, i) => { const li = document.createElement('li'); li.innerHTML = `<button type="button"><b>${esc(h.name)}</b><span>${esc(h.sub)}</span></button>`; li.firstChild.onclick = () => choose(h); results.appendChild(li); if (!i) results.dataset.first = ''; });
    results._hits = hits;
  }
  function choose(h) {
    results.hidden = true; searchIn.value = h.name;
    const it = h.item || (h.entry.ref.building ? itemFor(h.entry.ref.building) : null), p = it ? it.centre : entryPos(h.entry);
    if (p) map.centreOn(p[0], p[1], 2.2);
    if (it) selectItem(it, { fromSearch: true }); else { selectItem({ entry: h.entry }, { fromSearch: true }); }
  }
  searchIn.addEventListener('input', runSearch);
  searchIn.addEventListener('keydown', e => { if (e.key === 'Enter' && results._hits && results._hits.length) { choose(results._hits[0]); } });
  // sound (off until switched on)
  let audio = null; const soundBtn = $('soundBtn');
  soundBtn.addEventListener('click', () => {
    if (!audio) { const ctx = new (window.AudioContext || window.webkitAudioContext)(); const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain(); o1.type = 'sawtooth'; o2.type = 'square'; f.type = 'lowpass'; f.frequency.value = 500; g.gain.value = 0; o1.connect(f); o2.connect(f); f.connect(g); g.connect(ctx.destination); o1.start(); o2.start(); audio = { ctx, o1, o2, f, g, on: false }; }
    audio.on = !audio.on; if (audio.on) audio.ctx.resume(); soundBtn.setAttribute('aria-pressed', String(audio.on)); soundBtn.textContent = audio.on ? 'Sound on' : 'Sound off';
  });
  function engineSound() { if (!audio) return; const t = audio.ctx.currentTime, v = Math.abs(driver.v), rpm = 38 + v * 6.5; audio.o1.frequency.setTargetAtTime(rpm, t, 0.08); audio.o2.frequency.setTargetAtTime(rpm * 0.5, t, 0.08); audio.f.frequency.setTargetAtTime(300 + v * 60, t, 0.1); audio.g.gain.setTargetAtTime(audio.on ? 0.05 + v * 0.004 : 0, t, 0.1); }
  let toastT = 0; function toast(msg) { const el = $('toast'); el.textContent = msg; el.classList.add('on'); toastT = performance.now(); setTimeout(() => { if (performance.now() - toastT >= 3900) el.classList.remove('on'); }, 4000); }

  // start card
  cardBody.innerHTML = $('tpl-start').innerHTML; card.classList.add('on'); shownKey = 'start';
  // proximity: show the card for the nearest landmark you drive up to (as in the original project)
  const prox = ENTRIES.filter(e => e.tour || e.ref.building).map(e => { const p = entryPos(e); const it = e.ref.building ? itemFor(e.ref.building) : null; const rad = it ? Math.sqrt(Math.abs(ringArea(it.rings[0]))) * 0.75 + 18 : e.ref.place ? ((data.places.find(q => q.id === e.ref.place) || {}).r || 60) : 40; return p ? { e, p, rad, it } : null; }).filter(Boolean);
  let proxCheck = 0;
  function proximity() {
    if (!hasStarted || tour.active || map.open || selected) return;
    let best = null, bd = 1e9; for (const q of prox) { const d = Math.hypot(q.p[0] - driver.x, q.p[1] - driver.z); if (d < q.rad && d < bd) { bd = d; best = q; } }
    if (best && shownKey !== best.e.id) { if (dismissed !== best.e.id) showEntry(best.e, { auto: true }); }
    else if (!best && shownKey && shownKey !== 'start' && !selected && card.dataset.auto !== 'pinned') { hideCard(); dismissed = null; }
  }

  // ---------------------------------------------------------------- loop
  const speedEl = $('speed');
  let last = performance.now(), frameAvg = 16, lastAdapt = performance.now(), time = 0;
  const fsun = new T.Vector3();
  function frame(now) {
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now; time += dt;
    frameAvg = frameAvg * 0.95 + (dt * 1000) * 0.05;
    // driving
    const auto = tour.update(dt);
    if (rig.mode === 'drone' && !auto) { rig.droneMove(dt, { ...keys, up: keys.up || touch.up, down: keys.down || touch.down, left: keys.left || touch.left, right: keys.right || touch.right }); driver.update(dt, { brake: 1 }); }
    else if (auto) driver.update(dt, auto);
    else driver.update(dt, { throttle: (keys.up || touch.up) ? 1 : 0, brake: (keys.down || touch.down) ? 1 : 0, steer: ((keys.left || touch.left) ? 1 : 0) - ((keys.right || touch.right) ? 1 : 0), handbrake: keys.space });
    car.root.position.set(driver.x, 0, driver.z); car.root.rotation.y = driver.h;
    car.body.rotation.z = clamp(-driver.steer * driver.v * 0.012, -0.05, 0.05);
    for (const w of car.wheels) { w.w.rotation.x = driver.wheelRot; if (w.front) w.hub.rotation.y = driver.steer; }
    if (!reduceMotion) { traffic.update(dt, driver); walkers.update(dt); skyMat.uniforms.time.value = time; }
    rig.update(dt, driver);
    trees.update(camera.position);
    if (selected) beacon.position.y = selected.height + 6 + Math.sin(now / 300) * 0.8, beacon.rotation.y += dt;
    // shadows follow what the camera looks at; snap to texels to stop shimmering
    const focus = rig.mode === 'chase' || rig.mode === 'driver' ? new T.Vector3(driver.x, 0, driver.z) : rig.target.clone().setY(0);
    const texel = (2 * SHR) / SH; focus.x = Math.round(focus.x / texel) * texel; focus.z = Math.round(focus.z / texel) * texel;
    fsun.copy(sunDir).multiplyScalar(300).add(focus); sun.position.copy(fsun); sun.target.position.copy(focus); sun.target.updateMatrixWorld();
    sky.position.copy(camera.position);
    if (now - proxCheck > 250) { proxCheck = now; proximity(); }
    map.draw(); engineSound();
    speedEl.textContent = Math.round(Math.abs(driver.v) * 2.237) + ' mph';
    if (tour.active || tour.autopilot) $('tourDist').textContent = tour.phase === 'drive' ? tour.remainingLabel() : 'Looking around';
    renderer.render(scene, camera);
    // adaptive resolution: keep frames under ~33 ms on slower devices
    if (now - lastAdapt > 1500) { lastAdapt = now; const target = isPhone ? 30 : 22; if (frameAvg > target && pr > maxPR * 0.55) { pr = Math.max(maxPR * 0.55, pr - 0.15); renderer.setPixelRatio(pr); renderer.setSize(innerWidth, innerHeight, false); } else if (frameAvg < 13 && pr < (isPhone ? Math.min(maxPR, 1.5) : maxPR)) { pr = Math.min(maxPR, pr + 0.1); renderer.setPixelRatio(pr); renderer.setSize(innerWidth, innerHeight, false); } }
    requestAnimationFrame(frame);
  }
  addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); if (map.open) map.resizeBig(); });
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  progress('Ready', 1);
  $('loading').classList.add('done'); setTimeout(() => { $('loading').hidden = true; }, 600);
  requestAnimationFrame(frame);
  if (coarse) document.body.classList.add('touch');

  // hooks used by the automated tests (harmless in normal use)
  // render one frame from a given pose and return it as an image (used by the automated visual checks)
  function view(pos, target, { hideCar = false } = {}) {
    camera.position.set(...pos); camera.lookAt(new T.Vector3(...target));
    const f = new T.Vector3(target[0], 0, target[2]), texel = (2 * SHR) / SH; f.x = Math.round(f.x / texel) * texel; f.z = Math.round(f.z / texel) * texel;
    sun.position.copy(sunDir).multiplyScalar(300).add(f); sun.target.position.copy(f); sun.target.updateMatrixWorld();
    sky.position.copy(camera.position); trees.update(camera.position); car.root.visible = !hideCar;
    renderer.render(scene, camera); const url = canvas.toDataURL('image/jpeg', 0.88); car.root.visible = true; return url;
  }
  window.__rhul = { start: entrance.start, THREE: T, renderer, scene, camera, driver, rig, tour, map, items, grid, lc, data, founders, keys, select: k => selectItem(itemFor(k)), entries: ENTRIES, frameAvg: () => frameAvg, trees, view, sun };
  void pointInPoly; void near;
}
function fail(msg) { const t = $('loadingText'); if (t) t.textContent = msg; const b = $('loadingBar'); if (b) b.style.background = '#c0392b'; }
main().catch(e => { console.error(e); fail('Something went wrong while building the campus: ' + e.message); });
