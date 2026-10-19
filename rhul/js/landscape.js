// Trees, street furniture, walls, the main entrance and other features placed from evidence.
// Tree positions: the tree symbols of the traced campus map. Species are assigned by setting (woodland/lawn) and are not surveyed.
import { T, Soup, instanced, mulberry32, hash2, lathe, mergeGeometries, pointInRing } from './util.js';
import * as MT from './materials.js';
import { CLS } from './ground.js';

// ------------------------------------------------------------------ trees
function blobCrown(seed, n, spread, detail = 0) {
  const r = mulberry32(seed), parts = [];
  for (let i = 0; i < n; i++) {
    const g = new T.IcosahedronGeometry(1, detail); // non-indexed in r128
    const s = 0.5 + r() * 0.32, sy = s * (0.78 + r() * 0.25), a = r() * Math.PI * 2, d = i ? spread * (0.42 + r() * 0.5) : 0;
    const cx = Math.cos(a) * d, cy = i ? (r() - 0.3) * 0.55 : 0.12, cz = Math.sin(a) * d;
    const p = g.attributes.position, nrm = g.attributes.normal;
    for (let k = 0; k < p.count; k++) {
      const x = p.getX(k), y = p.getY(k), z = p.getZ(k);
      // smooth ellipsoid normals so the canopy reads as soft foliage rather than facets
      const nx = x / s, ny = y / sy, nz = z / s, l = Math.hypot(nx, ny, nz) || 1; nrm.setXYZ(k, nx / l, ny / l, nz / l);
      p.setXYZ(k, x * s + cx, y * sy + cy, z * s + cz);
    }
    parts.push(g);
  }
  const m = mergeGeometries(parts, { color: true });
  // darken the underside and inside (cheap ambient occlusion)
  const p = m.attributes.position, c = m.attributes.color;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i), k = 0.5 + 0.5 * Math.min(1, Math.max(0, (y + 0.8) / 1.5)); c.setXYZ(i, k, k, k); }
  return m;
}
function coneCrown(tiers = 4) {
  const parts = [];
  for (let i = 0; i < tiers; i++) { const t = i / tiers, g = new T.ConeGeometry(1.0 - t * 0.7, 0.9, 7, 1).toNonIndexed(); g.translate(0, i * 0.55, 0); parts.push(g); }
  const m = mergeGeometries(parts, { color: true }); const p = m.attributes.position, c = m.attributes.color;
  for (let i = 0; i < p.count; i++) { const k = 0.6 + 0.4 * Math.min(1, (p.getY(i) + 0.45) / 2.5); c.setXYZ(i, k, k, k); }
  m.computeVertexNormals(); return m;
}
function cedarCrown() { // Cedar of Lebanon: wide, flat, layered plates
  const parts = [], r = mulberry32(3);
  [[0.0, 1.0], [0.55, 0.86], [1.05, 0.7], [1.5, 0.5], [1.85, 0.3]].forEach(([y, s]) => {
    for (let k = 0; k < 3; k++) { const g = new T.CylinderGeometry(s * (0.8 + r() * 0.3), s * (0.9 + r() * 0.3), 0.22, 9).toNonIndexed(); g.translate((r() - 0.5) * 0.4 * s, y, (r() - 0.5) * 0.4 * s); g.rotateY(r() * 3); parts.push(g); }
  });
  const m = mergeGeometries(parts, { color: true }); const p = m.attributes.position, c = m.attributes.color;
  for (let i = 0; i < p.count; i++) { const k = p.getY(i) % 0.55 < 0.12 ? 0.6 : 1.0; c.setXYZ(i, k, k, k); }
  return m;
}
function leafTexture() {
  return MT.painted('leaves', 128, ({ a, h, r, w, rnd }) => {
    a.fillStyle = '#7a7a7a'; a.fillRect(0, 0, w, w);
    for (let i = 0; i < 900; i++) { const v = 150 + rnd() * 85; a.fillStyle = `rgb(${v},${v},${v})`; a.beginPath(); a.ellipse(rnd() * w, rnd() * w, 2 + rnd() * 3, 1 + rnd() * 2, rnd() * 3, 0, 7); a.fill(); h.fillStyle = `rgb(${v},${v},${v})`; h.fillRect(rnd() * w, rnd() * w, 3, 3); }
    r.fillStyle = '#e8e8e8'; r.fillRect(0, 0, w, w);
  }, { normal: 3 });
}

// Tree symbols on an illustrated map are approximate: trees that would stand on, or within 2.2 m of, a road or
// paved area are left out (the same rule is used for collisions, so nothing invisible blocks the car).
export function treeOk(lc, founders, x, z) {
  const c = lc.at(x, z); if (c === CLS.ROAD || c === CLS.PAVING) return false;
  for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; if (lc.at(x + Math.cos(a) * 2.2, z + Math.sin(a) * 2.2) === CLS.ROAD) return false; }
  return !(founders && pointInRing(x, z, founders.outline));
}
export function buildTrees(data, lc, founders, { phone = false } = {}) {
  const group = new T.Group(); group.name = 'trees';
  const leaf = leafTexture();
  const crownM = new T.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: 0.95, metalness: 0, map: leaf.map, normalMap: leaf.normalMap, envMapIntensity: 0.3 });
  const barkM = MT.std('bark', { color: '#43372d', rough: 0.95, envI: 0.1 });
  // dimensions in metres for a map size of 1 (mature campus trees are typically 10-20 m tall; estimates)
  const low = () => new T.IcosahedronGeometry(1, 0);
  const species = {
    broad: { crown: blobCrown(11, 9, 0.7), crownLow: low(), trunkH: 2.6, crownY: 6.0, crownS: [4.4, 3.9, 4.4], colors: ['#557a3e', '#5f8344', '#6a8a4a', '#4e7139', '#71894f', '#5a7d40'] },
    oak: { crown: blobCrown(23, 10, 0.82), crownLow: low(), trunkH: 2.4, crownY: 6.2, crownS: [5.2, 4.1, 5.2], colors: ['#4f7037', '#5a7a3c', '#476734', '#63803f'] },
    conifer: { crown: coneCrown(5), crownLow: (() => { const g = new T.ConeGeometry(1, 2.4, 6).toNonIndexed(); g.translate(0, 1.0, 0); return g; })(), trunkH: 2.4, crownY: 2.6, crownS: [2.7, 5.0, 2.7], colors: ['#344f36', '#3a573c', '#2f4732'] },
    birch: { crown: blobCrown(31, 6, 0.45), crownLow: low(), trunkH: 3.2, crownY: 7.0, crownS: [2.6, 4.2, 2.6], colors: ['#7a9450', '#86a05a', '#6f8b4a'], bark: '#bdb7aa' },
    cedar: { crown: cedarCrown(), crownLow: (() => { const g = new T.CylinderGeometry(1, 1, 1.6, 8).toNonIndexed(); g.translate(0, 0.9, 0); return g; })(), trunkH: 3.8, crownY: 3.4, crownS: [7.2, 4.4, 7.2], colors: ['#2e4a34', '#33523a', '#3a5a40'] }
  };
  for (const s of Object.values(species)) { const p = s.crownLow; if (!p.index && p.attributes.normal) { const pp = p.attributes.position; for (let k = 0; k < pp.count; k++) { const x = pp.getX(k), y = pp.getY(k), z = pp.getZ(k), l = Math.hypot(x, y, z) || 1; if (s.crownLow.type === 'IcosahedronGeometry') p.attributes.normal.setXYZ(k, x / l, y / l, z / l); } } if (!p.attributes.color) { const c = new Float32Array(p.attributes.position.count * 3).fill(0.85); p.setAttribute('color', new T.BufferAttribute(c, 3)); } }
  const trunkGeo = new T.CylinderGeometry(0.2, 0.34, 1, 6); trunkGeo.translate(0, 0.5, 0);
  const CH = 220, chunks = new Map();
  const r = mulberry32(17);
  const fc = founders ? founders.features : null;
  let cedarCount = 0, skipped = 0; const cedars = [];
  data.trees.forEach(([x, z, s], i) => {
    if (phone && i % 2) return;
    if (!treeOk(lc, founders, x, z)) { skipped++; return; }
    const c = lc.at(x, z);
    let sp;
    const h = hash2(x * 0.37, z * 0.71);
    // a few great cedars stand alone on the lawns round Founder's (original project, from the campus video)
    const dF = fc ? Math.hypot(x - fc.lanternTower[0], z - fc.lanternTower[1]) : 1e9;
    if (dF < 200 && s > 1.1 && c === CLS.LAWN && cedarCount < 28 && cedars.every(q => Math.hypot(q[0] - x, q[1] - z) > 20)) { sp = 'cedar'; cedarCount++; cedars.push([x, z]); }
    else if (c === CLS.WOOD) sp = h < 0.08 ? 'conifer' : h < 0.48 ? 'oak' : h < 0.56 ? 'birch' : 'broad';
    else sp = h < 0.1 ? 'birch' : h < 0.16 ? 'conifer' : h < 0.42 ? 'oak' : 'broad';
    const key = Math.floor(x / CH) + ',' + Math.floor(z / CH);
    if (!chunks.has(key)) chunks.set(key, {});
    const ch = chunks.get(key); (ch[sp] = ch[sp] || []).push({ x, z, s: s * (0.85 + r() * 0.35), ry: r() * 6.28, col: species[sp].colors[(r() * species[sp].colors.length) | 0], v: 0.85 + r() * 0.3 });
  });
  const lods = [];
  for (const [key, ch] of chunks) {
    const hi = new T.Group(), lo = new T.Group(); hi.name = lo.name = 'trees:' + key;
    for (const [sp, list] of Object.entries(ch)) {
      const S = species[sp];
      const trunks = list.map(t => ({ x: t.x, z: t.z, sx: t.s * 1.3, sy: S.trunkH * t.s + 1.2, sz: t.s * 1.3 }));
      const crowns = list.map(t => ({ x: t.x, y: S.crownY * t.s, z: t.z, sx: S.crownS[0] * t.s, sy: S.crownS[1] * t.s, sz: S.crownS[2] * t.s, ry: t.ry, color: new T.Color(t.col).multiplyScalar(t.v) }));
      const bark = S.bark ? MT.std('bark:' + sp, { color: S.bark, rough: 0.9 }) : barkM;
      hi.add(instanced(trunkGeo, bark, trunks, { shadow: true }));
      hi.add(instanced(S.crown, crownM, crowns, { shadow: true, color: true }));
      lo.add(instanced(S.crownLow, crownM, crowns, { shadow: false, color: true }));
    }
    const [cx, cz] = key.split(',').map(Number);
    const centre = new T.Vector3((cx + 0.5) * CH, 0, (cz + 0.5) * CH);
    group.add(hi, lo); lo.visible = false;
    lods.push({ hi, lo, centre });
  }
  // switch chunks between detailed and simple crowns by distance from the camera
  function update(camPos) {
    for (const L of lods) { const d = Math.hypot(L.centre.x - camPos.x, L.centre.z - camPos.z) - CH * 0.7; const far = d > (phone ? 180 : 300); L.hi.visible = !far; L.lo.visible = far; }
  }
  return { group, update, skipped, count: [...chunks.values()].reduce((n, ch) => n + Object.values(ch).reduce((a, l) => a + l.length, 0), 0) };
}

// ------------------------------------------------------------------ furniture
export function buildFurniture(data, lc, founders) {
  const g = new T.Group(); g.name = 'street furniture';
  const F = data.furniture;
  const fcen = founders ? founders.features.lanternTower : [0, 0];
  // lamps: black Victorian lanterns round Founder's, disc-topped modern columns elsewhere (original project, from the video)
  const posts = [], discs = [], vposts = [], vlamps = [];
  for (const [x, z] of F.lamps) {
    const c = lc.at(x, z); if (c === CLS.ROAD) continue; if (founders && pointInRing(x, z, founders.outline)) continue;
    if (Math.hypot(x - fcen[0], z - fcen[1]) < 160) { vposts.push({ x, z }); vlamps.push({ x, y: 3.85, z }); } else { posts.push({ x, z }); discs.push({ x, y: 5.95, z }); }
  }
  const steel = MT.std('steel:grey', { color: '#767c83', rough: 0.45, metal: 0.7 }), black = MT.std('iron:black', { color: '#1d2522', rough: 0.5, metal: 0.5 });
  const pg = new T.CylinderGeometry(0.07, 0.1, 6, 6); pg.translate(0, 3, 0);
  g.add(instanced(pg, steel, posts));
  g.add(instanced(new T.CylinderGeometry(0.6, 0.5, 0.16, 12), steel, discs));
  const vg = new T.CylinderGeometry(0.08, 0.15, 3.5, 8); vg.translate(0, 1.75, 0);
  g.add(instanced(vg, black, vposts));
  g.add(instanced(new T.CylinderGeometry(0.24, 0.24, 0.4, 8), black, vposts.map(p => ({ ...p, y: 0.2 }))));
  g.add(instanced(new T.BoxGeometry(0.42, 0.55, 0.42), MT.std('lamp:glass', { color: '#fff1cf', rough: 0.2, emissive: '#3a3020' }), vlamps, { shadow: false }));
  g.add(instanced(new T.ConeGeometry(0.42, 0.42, 4), black, vlamps.map(p => ({ ...p, y: p.y + 0.48, ry: Math.PI / 4 }))));
  // timber bollards with a red band
  const bl = F.bollards.filter(([x, z]) => lc.at(x, z) !== CLS.ROAD && !(founders && pointInRing(x, z, founders.outline))).map(([x, z]) => ({ x, y: 0.5, z }));
  g.add(instanced(new T.CylinderGeometry(0.12, 0.12, 1.0, 8), MT.std('bollard', { tex: MT.timber('bollard', { base: '#b08c64', tile: 1 }), rough: 0.8 }), bl));
  g.add(instanced(new T.CylinderGeometry(0.125, 0.125, 0.1, 8), MT.std('bollard:band', { color: '#b3392c', rough: 0.6 }), bl.map(b => ({ ...b, y: 0.86 }))));
  // car-park barriers, arms raised
  const stripe = document.createElement('canvas'); stripe.width = 8; stripe.height = 64; const sx = stripe.getContext('2d');
  for (let k = 0; k < 8; k++) { sx.fillStyle = k % 2 ? '#f4f4f0' : '#c8202a'; sx.fillRect(0, k * 8, 8, 8); }
  const st = new T.CanvasTexture(stripe); st.encoding = T.sRGBEncoding;
  const armM = new T.MeshStandardMaterial({ map: st, roughness: 0.5 }), red = MT.std('barrier:red', { color: '#b5222b', rough: 0.5 });
  for (const [x, z, ry] of F.barriers) {
    const b = new T.Group(); b.position.set(x, 0, z); b.rotation.y = ry; g.add(b);
    const body = new T.Mesh(new T.BoxGeometry(0.42, 1.05, 0.42), red); body.position.y = 0.52; body.castShadow = true; b.add(body);
    const arm = new T.Mesh(new T.BoxGeometry(0.11, 4.6, 0.11), armM); arm.position.set(0, 3.4, 0.12); arm.rotation.z = 0.05; arm.castShadow = true; b.add(arm);
  }
  // canopies on the plazas (Union Plaza has a permanent canopy: official virtual tour). Shape and colour follow the original project.
  const canopyM = MT.std('canopy', { color: '#ee7a2c', rough: 0.7 }), white = MT.std('paint:white2', { color: '#ececea', rough: 0.5 });
  F.gazebos.forEach(([x, z], k) => {
    const q = new T.Group(); q.position.set(x, 0, z); q.rotation.y = k * 0.7; g.add(q);
    for (const [a, b] of [[-1.9, -1.9], [1.9, -1.9], [-1.9, 1.9], [1.9, 1.9]]) { const p = new T.Mesh(new T.CylinderGeometry(0.05, 0.05, 2.4, 6), white); p.position.set(a, 1.2, b); q.add(p); }
    const top = new T.Mesh(new T.ConeGeometry(3.0, 1.2, 4), canopyM); top.position.y = 3.0; top.rotation.y = Math.PI / 4; top.castShadow = true; q.add(top);
    const ed = new T.Mesh(new T.BoxGeometry(4.2, 0.3, 4.2), canopyM); ed.position.y = 2.4; q.add(ed);
  });
  // brick boundary wall with stone coping along Egham Hill (original project)
  const wl = [], cp = [];
  for (const run of F.a30wall) for (let k = 0; k < run.length - 1; k++) {
    const [ax, az] = run[k], [bx, bz] = run[k + 1], L = Math.hypot(bx - ax, bz - az); if (L < 0.2) continue;
    const ry = Math.atan2(bx - ax, bz - az), x = (ax + bx) / 2, z = (az + bz) / 2;
    wl.push({ x, y: 0.95, z, sx: 0.5, sy: 1.9, sz: L + 0.05, ry }); cp.push({ x, y: 1.96, z, sx: 0.66, sy: 0.12, sz: L + 0.05, ry });
  }
  const brickM = MT.std('wall:brick', { tex: MT.brick('boundary', { base: '#a24f38', tile: 0.9, size: 256 }), rough: 0.9 });
  const stoneM = MT.std('wall:coping', { tex: MT.stone('coping2', { base: '#ddd5c4' }), rough: 0.7 });
  g.add(instanced(new T.BoxGeometry(1, 1, 1), brickM, wl)); g.add(instanced(new T.BoxGeometry(1, 1, 1), stoneM, cp));
  // low brick wall and railings round the campus boundary, left open where roads and paths cross it
  const ow = [], rails = [];
  const o = data.outline;
  for (let i = 0; i < o.length; i++) {
    const [ax, az] = o[i], [bx, bz] = o[(i + 1) % o.length], L = Math.hypot(bx - ax, bz - az); if (L < 0.5) continue;
    let open = false; for (let t = 0; t <= 1 && !open; t += 0.1) for (let ox = -8; ox <= 8 && !open; ox += 4) for (let oz = -8; oz <= 8 && !open; oz += 4) { const c = lc.at(ax + (bx - ax) * t + ox, az + (bz - az) * t + oz); if (c === CLS.ROAD || c === CLS.PATH) open = true; }
    if (open) continue;
    ow.push({ x: (ax + bx) / 2, y: 0.4, z: (az + bz) / 2, sx: 0.4, sy: 0.8, sz: L, ry: Math.atan2(bx - ax, bz - az) });
    for (let t = 0; t < L; t += 2.4) rails.push({ x: ax + (bx - ax) * t / L, y: 1.35, z: az + (bz - az) * t / L });
  }
  g.add(instanced(new T.BoxGeometry(1, 1, 1), brickM, ow));
  g.add(instanced(new T.BoxGeometry(0.06, 1.1, 0.06), black, rails));
  // benches on Founder's Square (official: paved areas and benches; positions estimated)
  if (founders) {
    const p = founders.features.foundersSquareFront, c = founders.features.lanternTower;
    const ux = (p[0] - c[0]), uz = (p[1] - c[1]), ul = Math.hypot(ux, uz), nx = ux / ul, nz = uz / ul;
    const benches = [];
    for (let k = -3; k <= 3; k++) { if (!k) continue; const x = p[0] + nx * 16 + -nz * k * 9, z = p[1] + nz * 16 + nx * k * 9; if (lc.at(x, z) !== CLS.ROAD) benches.push({ x, y: 0, z, ry: Math.atan2(-nx, -nz) }); }
    const bs = new Soup(); bs.box(0, 0.45, 0, 1.8, 0.08, 0.45, 0, 1); bs.box(0, 0.75, -0.2, 1.8, 0.4, 0.06, 0, 1); bs.box(-0.8, 0.22, 0, 0.08, 0.45, 0.45, 0, 1); bs.box(0.8, 0.22, 0, 0.08, 0.45, 0.45, 0, 1);
    g.add(instanced(bs.geometry(), MT.std('bench', { tex: MT.timber('bench', { base: '#8a6a4a', tile: 1 }), rough: 0.8 }), benches));
  }
  return g;
}

// ------------------------------------------------------------------ main entrance on Egham Hill (Historic England 1294234), lodge, footbridge
export function buildEntrance(data, lc) {
  const g0 = new T.Group(); g0.name = 'main entrance';
  const [ax, az] = data.routes.gate, [bx, bz] = data.routes.inner;
  const L = Math.hypot(bx - ax, bz - az), dx = (bx - ax) / L, dz = (bz - az) / L;
  const gx = ax + dx * 10, gz = az + dz * 10, h = Math.atan2(dx, dz);
  const g = new T.Group(); g.position.set(gx, 0, gz); g.rotation.y = h; g0.add(g); // local +z = into campus
  const stoneP = MT.std('gate:stone', { tex: MT.stone('gate', { base: '#d9d3c2', tile: 1.0 }), rough: 0.75 });
  const brickM = MT.std('gate:brick', { tex: MT.brick('lodge', { base: '#a8553c', tile: 0.9, size: 256 }), rough: 0.9 });
  const iron = MT.std('iron:gates', { color: '#141418', rough: 0.45, metal: 0.7 });
  const roofM = MT.std('lodge:roof', { tex: MT.roofTiles('lodge', { base: '#6e3d2e', tile: 1.0 }), rough: 0.85, envI: 0.2 });
  const mk = (geo, m, x, y, z, parent = g) => { const o = new T.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; parent.add(o); return o; };
  // five stone piers topped with urns (NHLE); spacing estimated
  const pier = (x, hh, w) => {
    mk(new T.BoxGeometry(w, hh, w), stoneP, x, hh / 2, 0);
    for (let y = 0.6; y < hh - 0.5; y += 0.55) mk(new T.BoxGeometry(w + 0.08, 0.1, w + 0.08), stoneP, x, y, 0);
    mk(new T.BoxGeometry(w + 0.35, 0.35, w + 0.35), stoneP, x, hh + 0.17, 0);
    const urn = lathe([[0, 0], [0.22, 0], [0.22, 0.1], [0.12, 0.18], [0.3, 0.45], [0.28, 0.65], [0.16, 0.75], [0.2, 0.8], [0.06, 0.95], [0.08, 1.05], [0, 1.15]].map(([r, y]) => [r * w * 1.1, y * w * 1.1]), 12);
    mk(urn, stoneP, x, hh + 0.35, 0);
  };
  const piers = [[-10.2, 3.4, 1.0], [-4.1, 4.4, 1.3], [4.1, 4.4, 1.3], [6.6, 3.6, 1.0], [11.2, 3.4, 1.0]];
  piers.forEach(([x, hh, w]) => pier(x, hh, w));
  // short quadrant walls of balusters sweeping back from the outer piers
  const bal = lathe([[0, 0], [0.09, 0], [0.09, 0.06], [0.05, 0.1], [0.05, 0.2], [0.1, 0.38], [0.05, 0.55], [0.07, 0.6], [0, 0.62]], 6);
  const balList = [];
  for (const [x0, x1, sgn] of [[-10.2, -4.1, -1], [6.6, 11.2, 1]]) {
    const n = 16;
    for (let i = 0; i <= n; i++) {
      const t = i / n, x = x0 + (x1 - x0) * t, z = -Math.sin(t * Math.PI) * 1.4 * 0 + (sgn < 0 ? -(1 - t) : -t) * 2.2; // curve back toward the road
      balList.push({ x, y: 0.75, z });
    }
    const cx = (x0 + x1) / 2, cz = sgn < 0 ? -1.1 : -1.1, len = Math.hypot(x1 - x0, 2.2), ry = Math.atan2(x1 - x0, (sgn < 0 ? 2.2 : -2.2));
    mk(new T.BoxGeometry(0.6, 0.75, len), stoneP, cx, 0.37, cz).rotation.y = ry;
    mk(new T.BoxGeometry(0.5, 0.12, len), stoneP, cx, 1.42, cz).rotation.y = ry;
  }
  g.add(instanced(bal, stoneP, balList));
  // plain iron-bar gates with spear-head tips, standing open
  const leaf = (x, w, ang) => {
    const lf = new T.Group(); lf.position.set(x, 0, 0.2); lf.rotation.y = ang; lf.userData.noCollide = true; g.add(lf);
    const n = Math.round(w / 0.16);
    for (let k = 0; k <= n; k++) { const bar = mk(new T.BoxGeometry(0.035, 2.6, 0.035), iron, 0, 1.4, 0, lf); bar.position.z = k * w / n * Math.sign(-x || 1) * -1; const tip = mk(new T.ConeGeometry(0.05, 0.16, 4), iron, 0, 2.78, bar.position.z, lf); void tip; }
    for (const y of [0.3, 1.0, 2.5]) mk(new T.BoxGeometry(0.05, 0.06, w), iron, 0, y, -Math.sign(-x || 1) * -w / 2, lf);
  };
  leaf(-3.4, 3.4, -0.25); leaf(3.4, 3.4, 0.25); leaf(5.35, 1.8, 0.4);
  // name board on the inner pier (name only, no crest)
  const nb = document.createElement('canvas'); nb.width = 512; nb.height = 128; const nx = nb.getContext('2d');
  nx.fillStyle = '#16181c'; nx.fillRect(0, 0, 512, 128); nx.fillStyle = '#f2f2ee'; nx.textAlign = 'center'; nx.font = '700 40px Georgia, serif'; nx.fillText('ROYAL HOLLOWAY', 256, 56); nx.font = '600 24px Georgia, serif'; nx.fillText('UNIVERSITY OF LONDON', 256, 98);
  const nt = new T.CanvasTexture(nb); nt.encoding = T.sRGBEncoding;
  const sign = new T.Mesh(new T.PlaneGeometry(2.2, 0.55), new T.MeshStandardMaterial({ map: nt, roughness: 0.6 })); sign.position.set(-7.2, 1.25, -1.35); sign.rotation.y = Math.PI; g.add(sign);
  // Alex's plaque, as in the original project
  const pl = document.createElement('canvas'); pl.width = 512; pl.height = 200; const px = pl.getContext('2d');
  px.fillStyle = '#e2dccb'; px.fillRect(0, 0, 512, 200); px.strokeStyle = '#8a7a5a'; px.lineWidth = 8; px.strokeRect(10, 10, 492, 180);
  px.fillStyle = '#3a3226'; px.textAlign = 'center'; px.font = '600 26px Georgia, serif'; px.fillText('CAMPUS DRIVE BY', 256, 62); px.font = '700 60px Georgia, serif'; px.fillText('ALEX PHILIP', 256, 128); px.font = '500 20px Georgia, serif'; px.fillText('MSc Information Security 2022–2024', 256, 168);
  const pt = new T.CanvasTexture(pl); pt.encoding = T.sRGBEncoding;
  const plaque = new T.Mesh(new T.PlaneGeometry(2.4, 0.94), new T.MeshStandardMaterial({ map: pt, roughness: 0.7 })); plaque.position.set(-14.5, 1.15, -0.32); plaque.rotation.y = Math.PI; g.add(plaque);
  mk(new T.BoxGeometry(2.7, 1.2, 0.3), stoneP, -14.5, 1.15, -0.15);
  // the lodge (NHLE: red brick with stone dressings, splayed bay window, tiled roof, stone eaves cornice, two chimney stacks)
  {
    const lg = new T.Group(); lg.position.set(-17.5, 0, 7.0); g.add(lg);
    const wall = new T.BoxGeometry(12, 3.8, 8); mk(wall, brickM, 0, 1.9, 0, lg);
    mk(new T.BoxGeometry(12.5, 0.32, 8.5), stoneP, 0, 3.86, 0, lg);
    for (const [x, z] of [[-6, -4], [6, -4], [-6, 4], [6, 4]]) mk(new T.BoxGeometry(0.5, 3.8, 0.5), stoneP, x, 1.9, z, lg);
    const roof = mk(new T.ConeGeometry(1, 1, 4), roofM, 0, 5.4, 0, lg); roof.rotation.y = Math.PI / 4; roof.scale.set(9.4, 3.0, 6.6);
    for (const x of [-3.2, 3.2]) { mk(new T.BoxGeometry(1.0, 3.6, 0.9), brickM, x, 7.0, 0.6, lg); mk(new T.BoxGeometry(1.2, 0.3, 1.1), stoneP, x, 8.9, 0.6, lg); }
    // splayed bay window facing the drive
    const bay = new T.CylinderGeometry(1.7, 1.7, 3.2, 3, 1, false, 0, Math.PI); const bm = mk(bay, brickM, 2.2, 1.6, 4.0, lg); bm.rotation.y = 0;
    const glassM = MT.glass('lodge');
    for (const x of [-3.6, -0.8]) mk(new T.BoxGeometry(1.0, 1.6, 0.06), glassM, x, 2.0, 4.04, lg);
    for (const x of [-4.5, -1.5, 1.5, 4.5]) mk(new T.BoxGeometry(1.0, 1.6, 0.06), glassM, x, 2.0, -4.04, lg);
  }
  // green steel footbridge across Egham Hill to the left of the gates (original project, from the campus video)
  {
    const A = data.routes.A30; let best = 0, bd = 1e9;
    A.forEach(([x, z], i) => { const d = Math.hypot(x - ax, z - az); if (d < bd && i < A.length - 1) { bd = d; best = i; } });
    const [p, q] = [A[best], A[best + 1]], tl = Math.hypot(q[0] - p[0], q[1] - p[1]), tx = (q[0] - p[0]) / tl, tz = (q[1] - p[1]) / tl;
    const side = Math.sign(-(dx * tz - dz * tx)) || 1;
    const fx = ax + tx * 29 * side, fz = az + tz * 29 * side;
    const fb = new T.Group(); fb.position.set(fx, 0, fz); fb.rotation.y = Math.atan2(-tz, tx); g0.add(fb);
    const GRN = MT.std('bridge:green', { color: '#6f8f78', rough: 0.5, metal: 0.6 }), span = 26, H = 5.6;
    mk(new T.BoxGeometry(2.4, 0.3, span), GRN, 0, H, 0, fb);
    for (const x of [-1.15, 1.15]) { mk(new T.BoxGeometry(0.1, 0.1, span), GRN, x, H + 1.4, 0, fb); mk(new T.BoxGeometry(0.12, 0.12, span), GRN, x, H + 0.2, 0, fb); const bal = []; for (let z = -span / 2; z <= span / 2; z += 1.3) bal.push({ x, y: H + 0.85, z }); fb.add(instanced(new T.BoxGeometry(0.06, 1.3, 0.06), GRN, bal)); }
    for (const z of [-span / 2, span / 2]) for (const x of [-1.1, 1.1]) mk(new T.BoxGeometry(0.4, H, 0.4), GRN, x, H / 2, z, fb);
    for (const e of [-1, 1]) {
      const stair = new T.Mesh(new T.BoxGeometry(1.6, 0.3, Math.hypot(9, H)), GRN); stair.position.set(1.4 + 4.5, H / 2, e * span / 2); stair.rotation.y = Math.PI / 2; stair.rotation.x = Math.atan2(H, 9) * 1; stair.castShadow = true;
      const pivot = new T.Group(); pivot.position.set(0, 0, 0); fb.add(pivot); pivot.add(stair);
    }
  }
  g0.updateMatrixWorld(true);
  return { group: g0, start: { x: ax + dx * 2.5, z: az + dz * 2.5, h }, gate: { x: gx, z: gz, h } };
}

// the second lodge and the tennis courts, placed in the original project from the campus video
export function buildExtras(data) {
  const g = new T.Group(); g.name = 'lodge and tennis courts';
  const [lx, lz, lr] = data.extras.lodge2;
  const brickM = MT.std('lodge2:brick', { tex: MT.brick('lodge2', { base: '#c0623f', tile: 0.9, size: 256 }), rough: 0.9 });
  const stoneM = MT.std('lodge2:stone', { color: '#e2d9c6', rough: 0.7 }), roofM = MT.std('lodge:roof2', { tex: MT.roofTiles('lodge2', { base: '#6e3d2e' }), rough: 0.85, envI: 0.2 });
  const lg = new T.Group(); lg.position.set(lx, 0, lz); lg.rotation.y = lr; g.add(lg);
  const mk = (geo, m, x, y, z, p = lg) => { const o = new T.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; p.add(o); return o; };
  mk(new T.BoxGeometry(11, 3.8, 7.5), brickM, 0, 1.9, 0);
  for (const [x, z] of [[-5.5, -3.75], [5.5, -3.75], [-5.5, 3.75], [5.5, 3.75]]) mk(new T.BoxGeometry(0.55, 3.8, 0.55), stoneM, x, 1.9, z);
  mk(new T.BoxGeometry(11.6, 0.3, 8.1), stoneM, 0, 3.9, 0);
  const rf = mk(new T.ConeGeometry(1, 1, 4), roofM, 0, 5.4, 0); rf.rotation.y = Math.PI / 4; rf.scale.set(8.6, 3.0, 6.0);
  mk(new T.BoxGeometry(1.0, 2.6, 1.0), brickM, 0, 7.2, 0); mk(new T.BoxGeometry(1.2, 0.3, 1.2), stoneM, 0, 8.6, 0);
  const glassM = MT.glass('lodge2');
  for (const x of [-3.2, 0, 3.2]) for (const sd of [-1, 1]) mk(new T.BoxGeometry(0.9, 1.5, 0.06), glassM, x, 2.0, sd * 3.79);
  // tennis courts: two courts in a fenced enclosure (official map lists tennis courts and car park P12 'Tennis Courts')
  const [tx, tz, tr] = data.extras.tennis;
  const tc = new T.Group(); tc.position.set(tx, 0, tz); tc.rotation.y = tr; g.add(tc);
  const surf = new T.Mesh(new T.BoxGeometry(34, 0.04, 30), MT.std('court:surround', { color: '#9a4b45', rough: 0.8 })); surf.position.y = 0.03; surf.receiveShadow = true; tc.add(surf);
  const line = MT.std('court:line', { color: '#f2f2ee', rough: 0.6 }), net = MT.std('court:net', { color: '#1d1f22', rough: 0.8 });
  for (const z of [-7.2, 7.2]) {
    const c = new T.Mesh(new T.BoxGeometry(23.8, 0.03, 11), MT.std('court:green', { color: '#4d7a5a', rough: 0.8 })); c.position.set(0, 0.06, z); c.receiveShadow = true; tc.add(c);
    for (const [xx, dz, Lx, t] of [[0, -5.5, 23.8, 0.08], [0, 5.5, 23.8, 0.08], [0, -4.1, 23.8, 0.06], [0, 4.1, 23.8, 0.06], [0, 0, 12.8, 0.06]]) { const l = new T.Mesh(new T.BoxGeometry(Lx, 0.02, t), line); l.position.set(xx, 0.085, z + dz); tc.add(l); }
    for (const [xx, Lz] of [[-11.9, 11], [11.9, 11], [-6.4, 8.2], [6.4, 8.2]]) { const l = new T.Mesh(new T.BoxGeometry(0.08, 0.02, Lz), line); l.position.set(xx, 0.085, z); tc.add(l); }
    const n = new T.Mesh(new T.BoxGeometry(0.05, 0.95, 12.6), net); n.position.set(0, 0.5, z); tc.add(n);
  }
  const meshT = (() => { const c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d'); x.strokeStyle = 'rgba(40,46,44,.9)'; x.lineWidth = 2; for (let i = -32; i < 64; i += 8) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 32, 32); x.stroke(); x.beginPath(); x.moveTo(i + 32, 0); x.lineTo(i, 32); x.stroke(); } const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; return t; })();
  for (const [x, z, L, r] of [[0, -15, 34, 0], [0, 15, 34, 0], [-17, 0, 30, Math.PI / 2], [17, 0, 30, Math.PI / 2]]) {
    const t = meshT.clone(); t.needsUpdate = true; t.repeat.set(L / 1.2, 4.6 / 1.2);
    const f = new T.Mesh(new T.PlaneGeometry(L, 4.6), new T.MeshBasicMaterial({ map: t, transparent: true, side: T.DoubleSide, depthWrite: false })); f.position.set(x, 2.3, z); f.rotation.y = r; tc.add(f);
    const posts = []; for (let k = -L / 2; k <= L / 2 + 0.01; k += 3.4) posts.push({ x: x + Math.cos(r) * k, y: 2.35, z: z - Math.sin(r) * k });
    tc.add(instanced(new T.BoxGeometry(0.1, 4.7, 0.1), MT.std('fence:post', { color: '#3b403d', rough: 0.6, metal: 0.4 }), posts));
  }
  return g;
}
