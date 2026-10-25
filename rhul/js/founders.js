// Founder's Building (Royal Holloway College, W. H. Crossland, 1879-87; Grade I, NHLE 1028946).
//
// What is VERIFIED and used here (Historic England list entry, NHLE statue entries, Wikipedia, Victorian Web):
//  - red brick with stone bands and dressings; tiled roofs; 4 storeys plus attic; plan around two courtyards (north, south)
//  - entrance front faces north-west: central arch, three-storey centre section with entablature, balustrade and clock face;
//    the north tower is the Clock Tower
//  - north-east and south-west sides: pavilions at the ends and centre with full-height semicircular bays (centre: flat bay of
//    three windows and an extra storey), secondary flat pavilions with paired columns, tertiary splayed bays; four-pane sashes
//    between pilasters with keystoned architraves; balusters under first- and second-floor sills; pavilions rise through the roof
//    with conical roofs and lucarnes, a domed roof behind topped by a lead bell turret
//  - south-east front: central pavilion with four circular turrets rising to a louvred bell turret (the Dragon Tower); three-storey
//    sections either side; arched windows with circular windows above; balustrade with urns
//  - range between the courts with a central octagonal turret (the Lantern Tower); dining hall between the courts;
//    chapel east and picture gallery west of the entrance; single-storey colonnades in the courts
//  - statue of Queen Victoria in the North Quad and of Thomas and Jane Holloway in the South Quad (positions from their NHLE grid refs)
//
// What is ESTIMATED (no measured drawings were available): overall length and width, courtyard sizes, range depths,
// storey heights, tower and roof heights, window sizes and spacing, chimney and dormer positions, roof colour.
import { T, Soup, instanced, mulberry32, lathe } from './util.js';
import * as MT from './materials.js';

// ------------------------------------------------------------------ dimensions (metres; estimates unless noted)
export const DIM = {
  L: 158, W: 120,            // overall length (NW-SE) and width (NE-SW) of the main ranges, excluding projections (data.founders.dims overrides)
  Q: 48, WQ: 78,             // courtyard size along and across the building
  COL: 3.0,                  // colonnade depth along the courtyard sides of the wings
  floors: [0, 5.0, 9.2, 13.2], eaves: 17.6, cornice: 1.0,
  roofLow: 6.2, roofTop: 8.4 // mansard: steep lower slope height, ridge height above eaves
};
const S = { brickTile: 0.9, stoneTile: 1.2 };

function uvScale(g, su, sv) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv); return g; }
function translate(g, x, y, z) { g.translate(x, y, z); return g; }

// a reusable model part instanced many times: parts = { materialKey: geometry }
class Kit {
  constructor(name, parts) { this.name = name; this.parts = parts; this.list = []; }
  add(x, y, z, ry = 0, extra = {}) { this.list.push({ x, y, z, ry, ...extra }); }
  build(group, M) {
    if (!this.list.length) return;
    for (const [k, g] of Object.entries(this.parts)) {
      // fine detail (window frames, glazing, pilasters, balusters) is too small for the shadow map to resolve
      const cast = k !== 'glass' && k !== 'paint' && !/^(sash|sash2|ground|top|arched|arched-big|bullseye|pilaster|baluster)$/.test(this.name);
      const im = instanced(g, M[k], this.list, { shadow: cast, receive: true });
      im.name = 'founders:' + this.name + ':' + k; group.add(im);
    }
  }
}

// ------------------------------------------------------------------ part geometry
function windowParts({ w, h, arched = false, key = true, sill = true, bars = 2, bal = false }) {
  const st = new Soup(), pa = new Soup();
  const jw = 0.22, d = 0.18;
  st.box(-w / 2 - jw / 2, 0, d / 2, jw, h + 0.1, d, 0, 1);
  st.box(w / 2 + jw / 2, 0, d / 2, jw, h + 0.1, d, 0, 1);
  if (arched) {
    const segs = 9, r = w / 2;
    for (let i = 0; i < segs; i++) {
      const a0 = Math.PI * i / segs, a1 = Math.PI * (i + 1) / segs, am = (a0 + a1) / 2;
      const cx = Math.cos(am) * (r + jw / 2), cy = h / 2 + Math.sin(am) * (r + jw / 2);
      st.box(cx, cy, d / 2, jw * 1.05, (a1 - a0) * (r + jw) * 1.08, d, 0, 1);
      // rotate the voussoir: approximate by a box tilted in the plane; Soup.box has no roll, so stack small boxes instead
    }
    if (key) st.box(0, h / 2 + r + 0.12, d / 2 + 0.03, 0.34, 0.5, d + 0.06, 0, 1);
  } else {
    st.box(0, h / 2 + 0.16, d / 2, w + jw * 2 + 0.16, 0.3, d, 0, 1);
    if (key) st.box(0, h / 2 + 0.24, d / 2 + 0.04, 0.32, 0.52, d + 0.08, 0, 1);
    st.box(0, h / 2 + 0.42, d / 2 + 0.02, w + jw * 2 + 0.4, 0.1, d + 0.1, 0, 1); // little entablature
  }
  if (sill) st.box(0, -h / 2 - 0.08, 0.15, w + 0.55, 0.16, 0.3, 0, 1);
  if (bal) { // balustrade panel under the sill (balusters suggested by a recessed panel and rails)
    st.box(0, -h / 2 - 0.95, 0.1, w + 0.4, 0.12, 0.22, 0, 1);
    st.box(0, -h / 2 - 0.55, 0.04, w + 0.2, 0.7, 0.08, 0, 1);
  }
  // white-painted sash frames and glazing bars (four-pane sashes)
  const b = 0.06, z = 0.05;
  pa.box(0, h / 2 - b / 2, z, w, b, 0.05); pa.box(0, -h / 2 + b / 2, z, w, b, 0.05);
  pa.box(-w / 2 + b / 2, 0, z, b, h, 0.05); pa.box(w / 2 - b / 2, 0, z, b, h, 0.05);
  pa.box(0, 0.05 * h, z, w, b * 1.3, 0.06); // meeting rail
  if (bars >= 2) pa.box(0, 0, z + 0.005, b * 0.8, h, 0.04);
  const g = new T.Shape();
  g.moveTo(-w / 2, -h / 2); g.lineTo(w / 2, -h / 2); g.lineTo(w / 2, h / 2);
  if (arched) g.absarc(0, h / 2, w / 2, 0, Math.PI, false); else g.lineTo(-w / 2, h / 2);
  g.lineTo(-w / 2, -h / 2);
  const glassG = new T.ShapeGeometry(g, 8); glassG.translate(0, 0, 0.03);
  if (arched) { pa.box(0, h / 2, z, w, b, 0.05); }
  return { stone: st.geometry(), paint: pa.geometry(), glass: glassG };
}
function circleWindowParts(r) {
  const ring = new T.TorusGeometry(r + 0.12, 0.16, 6, 20); ring.translate(0, 0, 0.1);
  const g = new T.CircleGeometry(r, 20); g.translate(0, 0, 0.03);
  const pa = new Soup(); pa.box(0, 0, 0.05, 2 * r, 0.06, 0.05); pa.box(0, 0, 0.05, 0.06, 2 * r, 0.05);
  return { stone: ring, glass: g, paint: pa.geometry() };
}
function dormerParts({ w = 1.3, h = 2.0, pediment = 'tri' }) {
  // a stone-framed lucarne standing on the roof slope, with a small pitched roof behind its pediment
  const st = new Soup(), rf = new Soup();
  const W = w + 0.8, D = 2.2;
  st.box(-W / 2 + 0.2, 0, 0, 0.4, h + 0.4, 0.5); st.box(W / 2 - 0.2, 0, 0, 0.4, h + 0.4, 0.5);
  st.box(0, -h / 2 - 0.25, 0, W, 0.3, 0.6);
  st.box(0, h / 2 + 0.25, 0.02, W + 0.2, 0.3, 0.6);
  if (pediment === 'tri') {
    const ph = 0.9; for (let i = 0; i < 5; i++) { const t = (i + 0.5) / 5; st.box(0, h / 2 + 0.4 + t * ph * 0.9, 0, (W + 0.2) * (1 - t), ph / 5, 0.5); }
  } else {
    for (let i = 0; i < 6; i++) { const a = Math.PI * (i + 0.5) / 6; st.box(Math.cos(a) * W / 2.4, h / 2 + 0.45 + Math.sin(a) * W / 2.6, 0, 0.35, 0.35, 0.5); }
    st.box(0, h / 2 + 0.6, 0, W * 0.75, 0.6, 0.45);
  }
  // cheeks and roof running back into the main slope
  st.box(-W / 2 + 0.1, -0.1, -D / 2, 0.2, h, D); st.box(W / 2 - 0.1, -0.1, -D / 2, 0.2, h, D);
  const y0 = h / 2 + 0.35, rh = 0.9;
  rf.quad([-W / 2 - 0.1, y0, 0.25], [0, y0 + rh, 0.25], [0, y0 + rh, -D], [-W / 2 - 0.1, y0, -D], [0, 0], [1, 0], [1, 2], [0, 2]);
  rf.quad([0, y0 + rh, 0.25], [W / 2 + 0.1, y0, 0.25], [W / 2 + 0.1, y0, -D], [0, y0 + rh, -D], [0, 0], [1, 0], [1, 2], [0, 2]);
  const wp = windowParts({ w, h, key: false, sill: false, bars: 2 });
  return { stone: st.geometry(), roof: rf.geometry(), glass: wp.glass, paint: wp.paint };
}
function chimneyParts(h) {
  // massive brick stack with stone strapwork bands and a shell-like cap (NHLE: shell motifs; phoenixes on the entrance front)
  const br = new Soup(), st = new Soup();
  br.box(0, h / 2, 0, 2.0, h, 1.1, 0, 1 / S.brickTile);
  for (const y of [h * 0.35, h * 0.7]) st.box(0, y, 0, 2.15, 0.28, 1.25, 0, 1);
  st.box(0, h + 0.15, 0, 2.35, 0.3, 1.4, 0, 1);
  for (let i = -1; i <= 1; i++) { st.box(i * 0.62, h + 0.55, 0, 0.42, 0.5, 0.42, 0, 1); }
  const shell = new T.SphereGeometry(0.55, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2); shell.scale(1.7, 0.8, 1); shell.translate(0, h + 0.8, 0);
  return { brick: br.geometry(), stone: mergeStd([st.geometry(), shell]) };
}
function mergeStd(list) { const s = new Soup(); const g = list.map(x => x.index ? x.toNonIndexed() : x); const out = new T.BufferGeometry(); let n = 0; g.forEach(x => n += x.attributes.position.count); const p = new Float32Array(n * 3), nn = new Float32Array(n * 3), u = new Float32Array(n * 2); let o = 0; g.forEach(x => { p.set(x.attributes.position.array, o * 3); nn.set(x.attributes.normal.array, o * 3); if (x.attributes.uv) u.set(x.attributes.uv.array, o * 2); o += x.attributes.position.count; }); out.setAttribute('position', new T.BufferAttribute(p, 3)); out.setAttribute('normal', new T.BufferAttribute(nn, 3)); out.setAttribute('uv', new T.BufferAttribute(u, 2)); out.computeBoundingSphere(); return out; }
function balusterGeo() { return lathe([[0, 0], [0.11, 0], [0.11, 0.08], [0.07, 0.12], [0.06, 0.22], [0.12, 0.42], [0.06, 0.6], [0.08, 0.66], [0.12, 0.7], [0, 0.7]], 6); }
function urnGeo() { return lathe([[0, 0], [0.22, 0], [0.22, 0.1], [0.12, 0.18], [0.3, 0.45], [0.28, 0.65], [0.16, 0.75], [0.2, 0.8], [0.06, 0.95], [0.08, 1.05], [0, 1.15]], 10); }
function finialGeo(h = 2.2) { return lathe([[0, 0], [0.18, 0], [0.18, 0.15], [0.09, 0.3], [0.2, 0.55], [0.08, 0.8], [0.05, h * 0.75], [0.12, h * 0.8], [0.02, h]], 8); }

// square French dome over a rectangular base (half sizes ax, az), rising h; bulge >1 makes it fuller
function squareDome(ax, az, h, { segs = 10, bulge = 0.55, top = 0.18 } = {}) {
  const s = new Soup();
  const r = t => (1 - top) * Math.pow(Math.cos(t * Math.PI / 2), bulge) + top;
  const faces = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  for (const [fx, fz] of faces) {
    for (let i = 0; i < segs; i++) {
      const t0 = i / segs, t1 = (i + 1) / segs, r0 = r(t0), r1 = r(t1), y0 = h * t0, y1 = h * t1;
      // corners of this face strip; face normal direction (fx,fz); across direction (-fz, fx)
      const P = (rr, yy, side) => { const ex = fx ? ax : az, ac = fx ? az : ax; return [fx * ex * rr + -fz * side * ac * rr, yy, fz * ex * rr + fx * side * ac * rr]; };
      const a = P(r0, y0, -1), b = P(r0, y0, 1), c = P(r1, y1, 1), d = P(r1, y1, -1);
      const len = (fx ? az : ax) * 2;
      s.quad(a, d, c, b, [0, t0 * h], [0, t1 * h], [len * r1, t1 * h], [len * r0, t0 * h]);
    }
  }
  return s.geometry();
}
// open bell turret: octagonal base, turned posts, lead ogee cap and finial (NHLE: lead-roofed bell turret on turned balusters)
function bellTurret(r, h) {
  const st = new Soup();
  const parts = { stone: [], lead: [], gold: [] };
  st.box(0, 0.3, 0, r * 2.2, 0.6, r * 2.2, 0, 1);
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; st.box(Math.sin(a) * r, 0.6 + h * 0.3, Math.cos(a) * r, 0.28, h * 0.6, 0.28, a, 1); }
  st.box(0, 0.6 + h * 0.62, 0, r * 2.3, 0.3, r * 2.3, 0, 1);
  parts.stone.push(st.geometry());
  const cap = lathe([[r * 1.25, 0], [r * 1.2, 0.25], [r * 0.95, h * 0.25], [r * 0.45, h * 0.45], [r * 0.18, h * 0.55], [r * 0.12, h * 0.62], [0, h * 0.66]], 12);
  cap.translate(0, 0.75 + h * 0.62, 0); parts.lead.push(cap);
  const fin = finialGeo(h * 0.5); fin.translate(0, 0.75 + h * 0.62 + h * 0.62, 0); parts.gold.push(fin);
  return parts;
}

function clockTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  x.fillStyle = '#efe8d6'; x.beginPath(); x.arc(128, 128, 120, 0, 7); x.fill();
  x.strokeStyle = '#1d1d1d'; x.lineWidth = 6; x.stroke(); x.lineWidth = 2; x.beginPath(); x.arc(128, 128, 96, 0, 7); x.stroke();
  x.fillStyle = '#1d1d1d'; x.font = '700 22px Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  const R = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
  R.forEach((n, i) => { const a = i * Math.PI / 6; x.save(); x.translate(128 + Math.sin(a) * 106, 128 - Math.cos(a) * 106); x.rotate(a); x.fillText(n, 0, 0); x.restore(); });
  x.strokeStyle = '#1d1d1d'; x.lineCap = 'round'; x.lineWidth = 8; x.beginPath(); x.moveTo(128, 128); x.lineTo(128 + 50, 128 - 18); x.stroke();
  x.lineWidth = 5; x.beginPath(); x.moveTo(128, 128); x.lineTo(128 - 12, 128 - 82); x.stroke();
  const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; return t;
}

// ------------------------------------------------------------------ the building
export function buildFounders(data) {
  const F = data.founders;
  const g = new T.Group(); g.name = "Founder's Building";
  const [ax, az] = F.axis, ry = Math.atan2(ax, az);
  g.position.set(F.centre[0], 0, F.centre[1]); g.rotation.y = ry;
  const toScene = (lx, lz) => [F.centre[0] + lx * az + lz * ax, F.centre[1] - lx * ax + lz * az];

  const brickT = MT.brick('founders', { base: MT.PALETTE.foundersBrick, mortar: MT.PALETTE.mortar, tile: S.brickTile });
  const stoneT = MT.stone('founders', { base: MT.PALETTE.foundersStone, tile: S.stoneTile });
  const roofT = MT.roofTiles('founders', { base: MT.PALETTE.foundersRoof, tile: 1.0 });
  const leadT = MT.leadRoof('founders', { base: MT.PALETTE.lead });
  const M = {
    brick: MT.std('f:brick', { tex: brickT, rough: 0.9 }),
    stone: MT.std('f:stone', { tex: stoneT, rough: 0.75 }),
    roof: MT.std('f:roof', { tex: roofT, rough: 0.85, envI: 0.25 }),
    lead: MT.std('f:lead', { tex: leadT, rough: 0.6, metal: 0.25, envI: 0.45 }),
    glass: MT.glass('f:glass', { color: '#233038' }),
    paint: MT.std('f:paint', { color: '#f2efe6', rough: 0.5 }),
    gold: MT.std('f:gold', { color: '#c8a24a', rough: 0.35, metal: 0.9, envI: 1.2 }),
    marble: MT.std('f:marble', { color: '#ece9e2', rough: 0.45 }),
    dark: MT.std('f:dark', { color: '#1a1714', rough: 1 }),
    iron: MT.std('f:iron', { color: '#16181a', rough: 0.6, metal: 0.6 })
  };
  if (F.dims) Object.assign(DIM, { L: F.dims.L, W: F.dims.W, Q: F.dims.Q, WQ: F.dims.WQ });
  const { L, W, Q, WQ, COL, floors, eaves, cornice } = DIM;
  const HL = L / 2, HW = W / 2, QC = F.quad_spacing / 2;
  const qz0 = QC - Q / 2, qz1 = QC + Q / 2;     // courtyard extent (|z|), each side of the centre
  const qx = WQ / 2;                             // courtyard half-width
  const brick = new Soup(), stone = new Soup(), roof = new Soup(), lead = new Soup(), dark = new Soup(), iron = new Soup();
  const bt = 1 / S.brickTile, stt = 1 / S.stoneTile;
  const rects = []; // footprint rectangles (local) for collision and the map

  // ---- kits
  const winMain = new Kit('sash', windowParts({ w: 1.3, h: 2.55, bal: true }));
  const winPlain = new Kit('sash2', windowParts({ w: 1.3, h: 2.55 }));
  const winGround = new Kit('ground', windowParts({ w: 1.4, h: 2.9 }));
  const winTop = new Kit('top', windowParts({ w: 1.2, h: 1.9, key: false }));
  const winArch = new Kit('arched', windowParts({ w: 1.6, h: 3.2, arched: true }));
  const winBig = new Kit('arched-big', windowParts({ w: 2.2, h: 4.6, arched: true, bars: 2 }));
  const bull = new Kit('bullseye', circleWindowParts(0.75));
  const dormer = new Kit('lucarne', dormerParts({ pediment: 'tri' }));
  const dormerR = new Kit('lucarne-round', dormerParts({ pediment: 'round' }));
  const chimneyH = 6.5, chim = new Kit('chimney', chimneyParts(chimneyH));
  const pilaster = new Kit('pilaster', { stone: (() => { const s = new Soup(); s.box(0, 0.5, 0.07, 0.48, 1, 0.14, 0, 1); return s.geometry(); })() });
  const baluster = new Kit('baluster', { stone: balusterGeo() });
  const urn = new Kit('urn', { stone: urnGeo() });
  const finial = new Kit('finial', { stone: finialGeo(2.2) });
  const column = new Kit('column', { stone: (() => { const c = lathe([[0, 0], [0.42, 0], [0.42, 0.3], [0.3, 0.42], [0.26, 0.5], [0.22, 4.3], [0.32, 4.45], [0.42, 4.7], [0.42, 4.85], [0, 4.85]], 12); return c; })() });

  // ---- helpers to place things on a facade: start point (x,z), unit direction (tx,tz), outward normal (nx,nz)
  const faceRy = (nx, nz) => Math.atan2(nx, nz);
  function windowsAlong(x0, z0, tx, tz, nx, nz, len, spacing, rows, { skip = [], offset = 0.02 } = {}) {
    const n = Math.max(1, Math.round(len / spacing)), step = len / n, ryy = faceRy(nx, nz);
    for (let i = 0; i < n; i++) {
      const s = (i + 0.5) * step; if (skip.some(([a, b]) => s > a && s < b)) continue;
      const x = x0 + tx * s + nx * offset, z = z0 + tz * s + nz * offset;
      for (const [kit, y] of rows) kit.add(x, y, z, ryy);
      // pilasters between windows on the main floors
      if (i > 0 && !skip.some(([a, b]) => s - step / 2 > a && s - step / 2 < b)) {
        const px = x0 + tx * (s - step / 2) + nx * offset, pz = z0 + tz * (s - step / 2) + nz * offset;
        pilaster.add(px, floors[1] + 0.35, pz, ryy, { sy: floors[3] - floors[1] - 0.5 });
      }
    }
    return n;
  }
  const ROWS = [[winGround, floors[0] + 2.35], [winMain, floors[1] + 2.05], [winMain, floors[2] + 1.95], [winTop, floors[3] + 1.6]];
  const ROWS_Q = [[winGround, floors[0] + 2.35], [winPlain, floors[1] + 2.05], [winPlain, floors[2] + 1.95], [winTop, floors[3] + 1.6]];

  // horizontal stone bands round a rectangle: plinth, floor string courses, main cornice and parapet
  function bands(x0, x1, z0, z1, top) {
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, sx = x1 - x0, sz = z1 - z0;
    const ring = (y, h, out) => { stone.box(cx, y, z0 - out / 2, sx + out * 2, h, out + 0.02, 0, stt); stone.box(cx, y, z1 + out / 2, sx + out * 2, h, out + 0.02, 0, stt); stone.box(x0 - out / 2, y, cz, out + 0.02, h, sz, 0, stt); stone.box(x1 + out / 2, y, cz, out + 0.02, h, sz, 0, stt); };
    ring(0.5, 1.0, 0.12);                                      // plinth
    for (let k = 1; k < floors.length; k++) if (floors[k] < top - 1) ring(floors[k] - 0.1, 0.32, 0.1); // string courses
    ring(top - cornice / 2, cornice, 0.32);                     // entablature / cornice
    ring(top + 0.12, 0.25, 0.5);                                // cornice lip
  }
  function balustradeAlong(x0, z0, tx, tz, len, y, { urns = 0 } = {}) {
    const n = Math.floor(len / 0.32), ryy = Math.atan2(tx, tz);
    for (let i = 0; i < n; i++) baluster.add(x0 + tx * (i + 0.5) * len / n, y + 0.12, z0 + tz * (i + 0.5) * len / n, 0);
    stone.box(x0 + tx * len / 2, y + 0.06, z0 + tz * len / 2, Math.abs(tx) * len + Math.abs(tz) * 0.42, 0.12, Math.abs(tz) * len + Math.abs(tx) * 0.42, 0, stt);
    stone.box(x0 + tx * len / 2, y + 0.88, z0 + tz * len / 2, Math.abs(tx) * len + Math.abs(tz) * 0.38, 0.14, Math.abs(tz) * len + Math.abs(tx) * 0.38, 0, stt);
    if (urns) for (let i = 0; i <= urns; i++) { const s = i * len / urns; urn.add(x0 + tx * s, y + 0.95, z0 + tz * s, 0); stone.box(x0 + tx * s, y + 0.5, z0 + tz * s, 0.5, 0.9, 0.5, 0, stt); }
    void ryy;
  }
  // mansard roof over a range rectangle, ridge along X (alongX) or Z
  function mansard(x0, x1, z0, z1, alongX, base = eaves + 0.4, { low = DIM.roofLow, top = DIM.roofTop, inset = 2.3, overhang = 0.3, dormers = true, chimneys = true } = {}) {
    const A0 = alongX ? x0 : z0, A1 = alongX ? x1 : z1, B0 = alongX ? z0 : x0, B1 = alongX ? z1 : x1;
    const P = (a, b, y) => alongX ? [a, y, b] : [b, y, a];
    const bm = (B0 + B1) / 2, o = overhang;
    const prof = [[B0 - o, base], [B0 + inset, base + low], [bm, base + top], [B1 - inset, base + low], [B1 + o, base]];
    for (let k = 0; k < prof.length - 1; k++) {
      const [b0, y0] = prof[k], [b1, y1] = prof[k + 1], sl = Math.hypot(b1 - b0, y1 - y0);
      const a = P(A0, b0, y0), b = P(A0, b1, y1), c = P(A1, b1, y1), d = P(A1, b0, y0);
      const len = A1 - A0;
      if (alongX) roof.quad(a, b, c, d, [0, 0], [0, sl], [len, sl], [len, 0]); else roof.quad(d, c, b, a, [0, 0], [0, sl], [len, sl], [len, 0]);
    }
    // gable ends (hidden behind pavilions or neighbouring ranges, but closed for safety)
    for (const A of [A0, A1]) {
      const pts = prof.map(([b, y]) => P(A, b, y));
      for (let k = 1; k < pts.length - 1; k++) { const tri = [pts[0], pts[k], pts[k + 1]]; if ((A === A0) === alongX) roof.tri(tri[0], tri[2], tri[1], [0, 0], [1, 0], [0, 1]); else roof.tri(tri[0], tri[1], tri[2], [0, 0], [1, 0], [0, 1]); }
    }
    // lead ridge
    lead.box(alongX ? (A0 + A1) / 2 : bm, base + top + 0.08, alongX ? bm : (A0 + A1) / 2, alongX ? A1 - A0 : 0.5, 0.16, alongX ? 0.5 : A1 - A0, 0, 1);
    // lucarnes on both steep slopes, chimneys astride the ridge line
    const len = A1 - A0;
    if (dormers) {
      const n = Math.max(1, Math.floor(len / 7.2));
      for (let i = 0; i < n; i++) {
        const a = A0 + (i + 0.5) * len / n;
        for (const side of [-1, 1]) {
          const b = side < 0 ? B0 + inset * 0.55 : B1 - inset * 0.55;
          const [x, , z] = P(a, b, 0), nrm = alongX ? [0, side] : [side, 0];
          (i % 3 === 1 ? dormerR : dormer).add(x, base + low * 0.45, z, faceRy(nrm[0], nrm[1]));
        }
      }
    }
    if (chimneys) {
      const n = Math.max(1, Math.floor(len / 13));
      for (let i = 0; i < n; i++) {
        const a = A0 + (i + 0.5) * len / n + 2.5, [x, , z] = P(a, bm + (i % 2 ? 2.2 : -2.2), 0);
        chim.add(x, base + low, z, alongX ? 0 : Math.PI / 2);
      }
    }
  }
  function rangeBox(x0, x1, z0, z1, h) {
    brick.box((x0 + x1) / 2, h / 2, (z0 + z1) / 2, x1 - x0, h, z1 - z0, 0, bt);
    bands(x0, x1, z0, z1, h);
    rects.push([x0, x1, z0, z1]);
  }

  // ================= ranges round the two courtyards
  // north-west (entrance) and south-east ranges span the full width; the wings run between them; the middle range divides the courts
  rangeBox(-HW, HW, -HL, -qz1, eaves);                 // NW range
  rangeBox(-30, 30, qz1, HL, floors[3] + 1.0);          // SE range, three-storey centre section either side of the Dragon Tower
  rangeBox(-HW, -30, qz1, HL, eaves); rangeBox(30, HW, qz1, HL, eaves);
  rangeBox(qx, HW, -qz1, qz1, eaves);                  // NE wing
  rangeBox(-HW, -qx, -qz1, qz1, eaves);                // SW wing
  rangeBox(-qx, qx, -qz0, qz0, eaves);                 // middle range (chapel, picture gallery, dining hall)
  mansard(-HW, HW, -HL, -qz1, true);
  mansard(-HW, -30, qz1, HL, true); mansard(30, HW, qz1, HL, true);
  mansard(-30, 30, qz1, HL, true, floors[3] + 1.4, { low: 3.2, top: 4.6, dormers: false });
  mansard(qx, HW, -qz1, qz1, false); mansard(-HW, -qx, -qz1, qz1, false);
  // the middle range has the tall chapel and gallery: a higher, rounder roof
  mansard(-qx, qx, -qz0, qz0, true, eaves + 0.4, { low: 7.4, top: 10.2, inset: 3.2, chimneys: false });

  // ================= outer facades (windows); skip zones leave room for pavilions
  // NE (x=+HW) and SW (x=-HW) sides run along z from -HL to +HL
  const P1 = 18, PC = 20;                                   // corner and centre pavilion widths along the long sides
  const sec = [-46, 46], ter = [-27, 27];                   // secondary and tertiary pavilion centres along z
  for (const side of [1, -1]) {
    const x = side * HW, skip = [[0, P1 + 0.6], [L - P1 - 0.6, L], [HL - PC / 2 - 0.6, HL + PC / 2 + 0.6]];
    for (const c of sec) skip.push([HL + c - 4.2, HL + c + 4.2]);
    for (const c of ter) skip.push([HL + c - 3.3, HL + c + 3.3]);
    const z0 = side > 0 ? -HL : HL, tz = side > 0 ? 1 : -1;
    // skip zones were defined from the -HL end; mirror them for the side that runs the other way
    const sk = side > 0 ? skip : skip.map(([a, b]) => [L - b, L - a]);
    windowsAlong(x, z0, 0, tz, side, 0, L, 2.38, ROWS, { skip: sk });
  }
  // NW front (z=-HL) and SE front (z=+HL) run along x
  for (const side of [-1, 1]) {
    const z = side * HL, x0 = side < 0 ? HW : -HW, tx = side < 0 ? -1 : 1;
    const skip = [[0, 16.6], [W - 16.6, W], [HW - 11.5, HW + 11.5]];
    if (side > 0) {
      // SE front: arched windows with circular windows above in the three-storey centre sections
      windowsAlong(x0, z, tx, 0, 0, side, W, 2.6, [[winGround, floors[0] + 2.35], [winMain, floors[1] + 2.05], [winMain, floors[2] + 1.95], [winTop, floors[3] + 1.6]], { skip: skip.concat([[HW - 30, HW + 30]]) });
      for (const s0 of [-30, 11]) for (let i = 0; i < 6; i++) {
        const xx = s0 + (i + 0.5) * 19 / 6;
        winArch.add(xx, floors[0] + 2.5, z + 0.02, 0); winArch.add(xx, floors[1] + 2.4, z + 0.02, 0); winArch.add(xx, floors[2] + 2.0, z + 0.02, 0);
        bull.add(xx, floors[2] + 3.55, z + 0.02, 0);
        if (i) pilaster.add(xx - 19 / 12, floors[0] + 0.9, z + 0.02, 0, { sy: floors[3] - 0.4 });
      }
      balustradeAlong(-30, HL + 0.35, 1, 0, 19, floors[3] + 1.25, { urns: 4 }); balustradeAlong(11, HL + 0.35, 1, 0, 19, floors[3] + 1.25, { urns: 4 });
    } else {
      // NW entrance front: six bays each side of the centre section, fielded pilasters, swagged sills
      windowsAlong(x0, z, tx, 0, 0, side, W, 5.6, ROWS, { skip });
    }
  }

  // ================= corner pavilions with semicircular bays, conical roofs and domed roofs with bell turrets
  const bayR = 3.4, pavH = eaves + 1.0;
  function roundBay(x, z, nx, nz, h) {
    const geo = new T.CylinderGeometry(bayR, bayR, h, 20, 1, true, -Math.PI / 2, Math.PI);
    uvScale(geo, Math.PI * bayR * bt, h * bt); geo.rotateY(Math.atan2(nx, nz)); geo.translate(x, h / 2, z);
    extraBrick.push(geo);
    for (let k = 0; k < floors.length; k++) {
      const ring = new T.CylinderGeometry(bayR + 0.12, bayR + 0.12, k ? 0.32 : 1.0, 20, 1, true, -Math.PI / 2, Math.PI);
      ring.rotateY(Math.atan2(nx, nz)); ring.translate(x, k ? floors[k] : 0.5, z); extraStone.push(ring);
    }
    const cor = new T.CylinderGeometry(bayR + 0.38, bayR + 0.3, 1.0, 20, 1, false, -Math.PI / 2, Math.PI); cor.rotateY(Math.atan2(nx, nz)); cor.translate(x, h - 0.5, z); extraStone.push(cor);
    const cone = new T.ConeGeometry(bayR + 0.35, 7.5, 20, 1, true); uvScale(cone, 8, 4); cone.translate(x, h + 3.75, z); extraRoof.push(cone);
    finial.add(x, h + 7.3, z, 0);
    // two windows per floor on the curve
    for (const a of [-0.55, 0.55]) {
      const base = Math.atan2(nx, nz) + a, wx = x + Math.sin(base) * (bayR + 0.02), wz = z + Math.cos(base) * (bayR + 0.02);
      for (const [kit, y] of ROWS) kit.add(wx, y, wz, base);
    }
  }
  const extraBrick = [], extraStone = [], extraRoof = [], extraLead = [], extraGold = [], extraMarble = [];
  function pavilion(cx, cz, sx, sz, h, { domeH = 9.5, turretR = 1.4, turretH = 4.6, bays = [] } = {}) {
    rangeBox(cx - sx / 2, cx + sx / 2, cz - sz / 2, cz + sz / 2, h);
    const dome = squareDome(sx / 2 + 0.25, sz / 2 + 0.25, domeH, { bulge: 0.6, top: 0.22 });
    dome.translate(cx, h + 0.35, cz); extraRoof.push(dome);
    const bt2 = bellTurret(turretR, turretH);
    bt2.stone.forEach(x => { x.translate(cx, h + 0.35 + domeH, cz); extraStone.push(x); });
    bt2.lead.forEach(x => { x.translate(cx, h + 0.35 + domeH, cz); extraLead.push(x); });
    bt2.gold.forEach(x => { x.translate(cx, h + 0.35 + domeH, cz); extraGold.push(x); });
    // lucarnes on each dome face
    for (const [nx, nz, half] of [[1, 0, sx / 2], [-1, 0, sx / 2], [0, 1, sz / 2], [0, -1, sz / 2]]) {
      dormerR.add(cx + nx * (half - 1.1), h + 2.2, cz + nz * (half - 1.1), faceRy(nx, nz));
    }
    for (const b of bays) roundBay(...b, h);
  }
  const cs = [[1, -1], [1, 1], [-1, -1], [-1, 1]];
  for (const [sx, sz] of cs) {
    const cx = sx * (HW - 16 / 2 + 1.4), cz = sz * (HL - P1 / 2 + 1.4);
    pavilion(cx, cz, 16, P1, pavH, {
      bays: [[sx * (HW + 1.4), cz, sx, 0], [cx, sz * (HL + 1.4), 0, sz]]
    });
  }
  // centre pavilions of the long sides: flat bay of three windows, an extra storey, ornate entablature
  for (const sx of [1, -1]) {
    const cx = sx * (HW - 6 + 1.8);
    pavilion(cx, 0, 12, PC, pavH + 4.2, { domeH: 10.5, turretR: 1.6, turretH: 5.2 });
    const x = sx * (HW + 1.8) + sx * 0.02;
    for (let i = 0; i < 3; i++) { const z = (i - 1) * 3.2; for (const [kit, y] of ROWS) kit.add(x, y, z, faceRy(sx, 0)); winMain.add(x, pavH + 1.9, z, faceRy(sx, 0)); }
    // entrance doorway with rusticated semicircular arch and steps
    dark.box(x + sx * 0.04, 1.9, 0, 0.05, 3.8, 2.4); stone.box(x + sx * 0.12, 4.0, 0, 0.25, 0.9, 3.6, 0, stt);
    for (let k = 0; k < 4; k++) stone.box(x + sx * (0.6 + k * 0.35), 0.1 + k * 0.17 - 0.68 + 0.6, 0, 0.35 + (3 - k) * 0.35, 0.17, 4.6 - k * 0.3, 0, stt);
    balustradeAlong(x + sx * 0.25, -PC / 2, 0, 1, PC, pavH + 4.2 + 0.4, { urns: 2 });
  }
  // secondary pavilions: flat, quoined, paired columns in a recess, pedimented lucarne above
  for (const sx of [1, -1]) for (const c of sec) {
    rangeBox(HW * sx > 0 ? HW - 0.6 : -HW - 0.6, HW * sx > 0 ? HW + 0.6 : -HW + 0.6, c - 4, c + 4, eaves + 0.6);
    for (const d of [-3.4, 3.4]) for (const dd of [-0.6, 0.6]) column.add(sx * (HW + 1.0), floors[1] + 0.2, c + d + dd, 0);
    for (let k = 0; k < 9; k++) { const y = 0.5 + k * 2.0; stone.box(sx * (HW + 0.65), y, c - 3.95, 0.12, 0.9, 0.9, 0, stt); stone.box(sx * (HW + 0.65), y, c + 3.95, 0.12, 0.9, 0.9, 0, stt); }
    for (const [kit, y] of ROWS) for (const dz of [-1.4, 1.4]) kit.add(sx * (HW + 0.62), y, c + dz, faceRy(sx, 0));
    dormer.add(sx * (HW - 0.4), eaves + 1.4, c, faceRy(sx, 0));
  }
  // tertiary pavilions: full-height splayed (canted) bays
  for (const sx of [1, -1]) for (const c of ter) {
    const x0 = sx * HW, d = 1.5, fw = 3.6, sw = 1.3, h = eaves;
    const pts = [[x0, c - fw / 2 - sw], [x0 + sx * d, c - fw / 2], [x0 + sx * d, c + fw / 2], [x0, c + fw / 2 + sw]];
    let u = 0;
    for (let k = 0; k < 3; k++) { const [a0, b0] = pts[k], [a1, b1] = pts[k + 1]; if (sx > 0) u += brick.wall(a0, b0, a1, b1, 0, h, u, bt, bt); else u += brick.wall(a1, b1, a0, b0, 0, h, u, bt, bt); }
    for (const [kit, y] of ROWS) kit.add(x0 + sx * (d + 0.02), y, c, faceRy(sx, 0));
    for (const k of [0, 2]) {
      const [a0, b0] = pts[k], [a1, b1] = pts[k + 1], mx = (a0 + a1) / 2, mz = (b0 + b1) / 2, ll = Math.hypot(a1 - a0, b1 - b0);
      let nx = (b1 - b0) / ll, nz = -(a1 - a0) / ll; if (nx * sx < 0) { nx = -nx; nz = -nz; }
      for (const [kit, y] of ROWS_Q) kit.add(mx + nx * 0.02, y, mz + nz * 0.02, Math.atan2(nx, nz));
    }
    stone.box(x0 + sx * d / 2, eaves - 0.4, c, d + 0.5, 0.9, fw + 2 * sw, 0, stt);
    rects.push([Math.min(x0, x0 + sx * d), Math.max(x0, x0 + sx * d), c - fw / 2 - sw, c + fw / 2 + sw]);
  }

  // ================= north-west entrance: arch, three-storey centre section, clock face, the Clock Tower above
  {
    const z = -HL, cw = 23, depth = 2.4;
    rangeBox(-cw / 2, cw / 2, z - depth, z + 4, floors[3] + 1.0);
    balustradeAlong(-cw / 2, z - depth - 0.25, 1, 0, cw, floors[3] + 1.0 + 0.3, { urns: 4 });
    // central arch through to the North Quad
    const arch = new T.Shape(); arch.moveTo(-2.6, 0); arch.lineTo(-2.6, 4.2); arch.absarc(0, 4.2, 2.6, Math.PI, 0, true); arch.lineTo(2.6, 0); arch.lineTo(-2.6, 0);
    const archMesh = new T.Mesh(new T.ShapeGeometry(arch, 12), M.dark); archMesh.position.set(0, 0, z - depth - 0.04); archMesh.rotation.y = Math.PI; g.add(archMesh);
    for (let i = 0; i <= 12; i++) { const a = Math.PI * i / 12; stone.box(Math.cos(a) * 3.0, 4.2 + Math.sin(a) * 3.0, z - depth - 0.18, 0.75, 0.75, 0.36, 0, stt); }
    for (const sx of [-1, 1]) stone.box(sx * 3.05, 2.1, z - depth - 0.18, 0.8, 4.2, 0.36, 0, stt);
    stone.box(0, 7.6, z - depth - 0.25, 1.0, 1.3, 0.5, 0, stt); // keystone
    // pilasters and windows of the centre section
    for (const sx of [-1, 1]) { for (const dx of [5.2, 9.3]) { winMain.add(sx * dx, floors[1] + 2.05, z - depth - 0.02, Math.PI); winMain.add(sx * dx, floors[2] + 1.95, z - depth - 0.02, Math.PI); winGround.add(sx * dx, floors[0] + 2.35, z - depth - 0.02, Math.PI); } pilaster.add(sx * 7.25, 0.9, z - depth - 0.02, Math.PI, { sy: floors[3] - 0.6 }); pilaster.add(sx * 11.2, 0.9, z - depth - 0.02, Math.PI, { sy: floors[3] - 0.6 }); }
    winArch.add(0, floors[2] + 2.0, z - depth - 0.02, Math.PI);
    // the Clock Tower (north tower), rising behind the centre section
    const tw = 11, td = 8, th0 = floors[3] + 1.0, th = 30, tcz = z - depth + 0.5 + td / 2;
    rangeBox(-tw / 2, tw / 2, tcz - td / 2, tcz + td / 2, th);
    // clock faces on all four sides (NHLE: clock face on the entrance front)
    const clockMat = new T.MeshStandardMaterial({ map: clockTexture(), roughness: 0.6 });
    for (const [nx, nz, half] of [[0, -1, td / 2], [0, 1, td / 2], [1, 0, tw / 2], [-1, 0, tw / 2]]) {
      const c = new T.Mesh(new T.CircleGeometry(1.85, 32), clockMat); c.position.set(nx * (half + 0.2), th0 + 8.5, tcz + nz * (half + 0.2)); c.rotation.y = faceRy(nx, nz); g.add(c);
      const ring = new T.TorusGeometry(2.0, 0.22, 6, 28); ring.rotateY(faceRy(nx, nz)); ring.translate(nx * (half + 0.18), th0 + 8.5, tcz + nz * (half + 0.18)); extraStone.push(ring);
      // louvred belfry openings above
      for (const o of [-1.6, 1.6]) { const lx = nx ? nx * (half + 0.05) : o, lz = nz ? tcz + nz * (half + 0.05) : tcz + o; dark.box(lx, th - 3.4, lz, nx ? 0.08 : 1.2, 3.6, nz ? 0.08 : 1.2); }
      // pinnacles at the corners
    }
    for (const [sx, sz] of cs) { finial.add(sx * (tw / 2 + 0.1), th + 1.1, tcz + sz * (td / 2 + 0.1), 0); stone.box(sx * (tw / 2 + 0.1), th + 0.5, tcz + sz * (td / 2 + 0.1), 0.9, 1.0, 0.9, 0, stt); }
    balustradeAlong(-tw / 2, tcz - td / 2 - 0.1, 1, 0, tw, th + 0.25); balustradeAlong(-tw / 2, tcz + td / 2 + 0.1, 1, 0, tw, th + 0.25);
    const tdome = squareDome(tw / 2 - 0.6, td / 2 - 0.6, 8.0, { bulge: 0.75, top: 0.25 }); tdome.translate(0, th + 0.4, tcz); extraLead.push(tdome);
    const bt3 = bellTurret(1.5, 5.0); for (const k of ['stone', 'lead', 'gold']) bt3[k].forEach(x => { x.translate(0, th + 8.4, tcz); ({ stone: extraStone, lead: extraLead, gold: extraGold })[k].push(x); });
  }
  // ================= south-east front: central pavilion with four circular turrets and a louvred bell turret (the Dragon Tower)
  {
    const z = HL, pw = 20, pd = 13, ph = eaves + 3.5;
    rangeBox(-pw / 2, pw / 2, z - pd + 2.2, z + 2.2, ph);
    for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
      const x = sx * (pw / 2), zz = z + 2.2 + (sz > 0 ? 0 : -pd), r = 2.3, h = ph + 4.5;
      const cyl = new T.CylinderGeometry(r, r, h, 18, 1, true); uvScale(cyl, 2 * Math.PI * r * bt, h * bt); cyl.translate(x, h / 2, zz); extraBrick.push(cyl);
      for (let k = 1; k < 5; k++) { const ring = new T.CylinderGeometry(r + 0.1, r + 0.1, 0.3, 18, 1, true); ring.translate(x, k * h / 5, zz); extraStone.push(ring); }
      const cap = lathe([[r + 0.3, 0], [r + 0.3, 0.6], [r * 0.9, 1.2], [r * 0.5, 2.6], [r * 0.15, 3.6], [0, 3.9]], 14); cap.translate(x, h, zz); extraLead.push(cap);
      urn.add(x, h + 3.9, zz, 0);
      // radial buttress from the turret up towards the central bell stage
      const bx = new T.BoxGeometry(0.8, 6.5, 0.8); bx.rotateZ(-sx * 0.55); bx.rotateY(sz > 0 ? 0.6 * sx : -0.6 * sx); bx.translate(x * 0.62, ph + 4.0, z + 2.2 - pd / 2 + (sz > 0 ? pd / 2 : -pd / 2) * 0.62); extraStone.push(bx);
    }
    // central vaulted entrance and arched windows with circular windows above
    const dz = z + 2.2 + 0.03;
    const arch = new T.Shape(); arch.moveTo(-2.2, 0); arch.lineTo(-2.2, 3.4); arch.absarc(0, 3.4, 2.2, Math.PI, 0, true); arch.lineTo(2.2, 0); arch.lineTo(-2.2, 0);
    const am = new T.Mesh(new T.ShapeGeometry(arch, 10), M.dark); am.position.set(0, 0, dz); g.add(am);
    for (let i = 0; i <= 10; i++) { const a = Math.PI * i / 10; stone.box(Math.cos(a) * 2.55, 3.4 + Math.sin(a) * 2.55, dz + 0.12, 0.65, 0.65, 0.3, 0, stt); }
    for (const sx of [-1, 1]) { winArch.add(sx * 4.6, floors[0] + 2.5, dz, 0); winArch.add(sx * 4.6, floors[1] + 2.4, dz, 0); winArch.add(sx * 4.6, floors[2] + 2.0, dz, 0); bull.add(sx * 4.6, floors[3] + 1.6, dz, 0); }
    winBig.add(0, floors[1] + 3.0, dz, 0); bull.add(0, floors[2] + 3.2, dz, 0); bull.add(0, floors[3] + 2.2, dz, 0);
    // central stage and louvred bell turret
    const sc = z + 2.2 - pd / 2, sh = 6;
    brick.box(0, ph + sh / 2, sc, 8, sh, 8, 0, bt); bands(-4, 4, sc - 4, sc + 4, ph + sh);
    for (const [nx, nz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) for (let k = 0; k < 5; k++) iron.box(nx * 4.03 + (nz ? (k - 2) * 0.55 : 0), ph + 2.0 + 0.0, sc + nz * 4.03 + (nx ? (k - 2) * 0.55 : 0), nx ? 0.06 : 0.35, 3.0, nz ? 0.06 : 0.35);
    const dome = lathe([[4.6, 0], [4.6, 0.5], [4.0, 1.6], [3.0, 3.2], [1.6, 4.6], [0.6, 5.3], [0, 5.5]], 8); dome.rotateY(Math.PI / 8); dome.translate(0, ph + sh + 0.35, sc); extraLead.push(dome);
    const bt4 = bellTurret(1.2, 4.2); for (const k of ['stone', 'lead', 'gold']) bt4[k].forEach(x => { x.translate(0, ph + sh + 5.6, sc); ({ stone: extraStone, lead: extraLead, gold: extraGold })[k].push(x); });
  }
  // ================= the middle range: chapel (east), picture gallery (west), the Lantern Tower over the centre
  {
    // tall arched windows of the chapel and gallery on both courtyard faces
    for (const sz of [-1, 1]) {
      const z = sz * qz0;
      for (let i = 0; i < 6; i++) { const x = 8 + i * 5.0; winBig.add(x, floors[1] + 4.2, z + sz * 0.02, faceRy(0, sz)); winGround.add(x, floors[0] + 2.35, z + sz * 0.02, faceRy(0, sz)); }
      for (let i = 0; i < 6; i++) { const x = -8 - i * 5.0; winBig.add(x, floors[1] + 4.2, z + sz * 0.02, faceRy(0, sz)); winGround.add(x, floors[0] + 2.35, z + sz * 0.02, faceRy(0, sz)); }
      for (let i = 0; i < 7; i++) pilaster.add(5.5 + i * 5.0, floors[1], z + sz * 0.02, faceRy(0, sz), { sy: eaves - floors[1] - 1.0 }), pilaster.add(-5.5 - i * 5.0, floors[1], z + sz * 0.02, faceRy(0, sz), { sy: eaves - floors[1] - 1.0 });
    }
    // entrance porch from the North Quad: brick barrel-vaulted porch with steps and wrought-iron screens
    const pz = -qz0, pw = 7, pd = 4.5;
    rangeBox(-pw / 2, pw / 2, pz - pd, pz, 7.2);
    const pa = new T.Shape(); pa.moveTo(-1.9, 0); pa.lineTo(-1.9, 3.0); pa.absarc(0, 3.0, 1.9, Math.PI, 0, true); pa.lineTo(1.9, 0); pa.lineTo(-1.9, 0);
    const pm = new T.Mesh(new T.ShapeGeometry(pa, 10), M.dark); pm.position.set(0, 0, pz - pd - 0.03); pm.rotation.y = Math.PI; g.add(pm);
    for (let k = 0; k < 3; k++) stone.box(0, 0.12 + k * 0.17 - 0.17, pz - pd - 0.4 - k * 0.35, pw + 1 - k * 0.6, 0.17 + 0.17 * (2 - k), 0.35 + (2 - k) * 0.35, 0, stt);
    for (let k = 0; k < 9; k++) iron.box(-1.6 + k * 0.4, 1.5, pz - pd - 0.08, 0.05, 3.0, 0.05);
    // octagonal Lantern Tower: drum, radiating quarter-arch buttresses, lantern and finial
    const rH = eaves + 0.4 + 10.2, drumR = 5.6, drumH = 6.0;
    const drum = new T.CylinderGeometry(drumR, drumR, drumH, 8, 1, true); drum.rotateY(Math.PI / 8); uvScale(drum, 2 * Math.PI * drumR * bt, drumH * bt); drum.translate(0, rH - 2 + drumH / 2, 0); extraBrick.push(drum);
    for (const y of [rH - 1.5, rH + drumH - 2.4]) { const r = new T.CylinderGeometry(drumR + 0.25, drumR + 0.25, 0.5, 8); r.rotateY(Math.PI / 8); r.translate(0, y, 0); extraStone.push(r); }
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      winArch.add(Math.sin(a + Math.PI / 8) * (drumR * 0.93), rH + 1.6, Math.cos(a + Math.PI / 8) * (drumR * 0.93), a + Math.PI / 8);
      // quarter-arch buttress: a curved rib from the drum rim to the lantern
      for (let k = 0; k < 6; k++) { const t = (k + 0.5) / 6, r = drumR - t * 3.4, y = rH + drumH - 2 + Math.sin(t * Math.PI / 2) * 4.2; stone.box(Math.sin(a) * r, y, Math.cos(a) * r, 0.55, 1.0, 0.55, a, stt); }
      finial.add(Math.sin(a) * drumR, rH + drumH - 1.7, Math.cos(a) * drumR, 0);
    }
    const lanR = 2.2, lanY = rH + drumH + 2.0;
    const lan = new T.CylinderGeometry(lanR, lanR, 3.6, 8, 1, true); lan.rotateY(Math.PI / 8); lan.translate(0, lanY + 1.8, 0); extraStone.push(lan);
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + Math.PI / 8; dark.box(Math.sin(a) * (lanR * 0.93), lanY + 1.8, Math.cos(a) * (lanR * 0.93), 0.9, 2.4, 0.9); }
    const ldome = lathe([[lanR + 0.3, 0], [lanR + 0.3, 0.4], [lanR * 0.9, 1.3], [lanR * 0.4, 2.4], [0, 2.8]], 8); ldome.rotateY(Math.PI / 8); ldome.translate(0, lanY + 3.6, 0); extraLead.push(ldome);
    const lf = finialGeo(3.0); lf.translate(0, lanY + 6.3, 0); extraGold.push(lf);
  }
  // ================= courtyards: colonnades along the wings, centre pavilions with semicircular pediments, quad walls' windows
  for (const sz of [-1, 1]) {
    const zc = sz * QC, z0 = zc - Q / 2, z1 = zc + Q / 2;
    // windows on the four courtyard walls
    windowsAlong(-qx, sz * qz1, 1, 0, 0, -sz, WQ, 2.5, ROWS_Q, {}); // inner face of the NW or SE range
    for (const sx of [1, -1]) {
      const x = sx * qx, zs = sx > 0 ? z0 : z1, dz = sx > 0 ? 1 : -1;
      windowsAlong(x, zs, 0, dz, -sx, 0, Q, 2.45, ROWS_Q, { skip: [[Q / 2 - 4, Q / 2 + 4]] });
      // colonnade: single storey, arcaded, balustrade on top
      const cx = x - sx * COL / 2;
      stone.box(cx, 0.15, zc, COL, 0.3, Q, 0, stt);
      stone.box(cx, 4.35, zc, COL + 0.3, 0.7, Q, 0, stt);
      roof.box(cx, 4.75, zc, COL, 0.1, Q, 0, 1);
      for (let k = 0; k <= 12; k++) { const zz = z0 + k * Q / 12; stone.box(x - sx * COL + sx * 0.3, 2.0, zz, 0.6, 4.0, 0.6, 0, stt); }
      balustradeAlong(x - sx * COL + sx * 0.25, z0, 0, 1, Q, 4.7, { urns: 6 });
      // centre pavilion on the wing's courtyard face: semicircular pediment over triple windows, bull's-eye above
      const pzc = zc;
      brick.box(x - sx * 0.6, eaves / 2 + 0.5, pzc, 1.2, eaves + 1.0, 8.4, 0, bt);
      for (let i = 0; i < 9; i++) { const a = Math.PI * i / 8; stone.box(x - sx * 1.25, eaves + 1.2 + Math.sin(a) * 3.4, pzc + Math.cos(a) * 4.2, 0.4, 0.5, 0.9, 0, stt); }
      for (const dzz of [-1.6, 0, 1.6]) { winMain.add(x - sx * 1.22, floors[1] + 2.05, pzc + dzz, faceRy(-sx, 0)); winMain.add(x - sx * 1.22, floors[2] + 1.95, pzc + dzz, faceRy(-sx, 0)); }
      bull.add(x - sx * 1.22, floors[3] + 1.6, pzc, faceRy(-sx, 0));
    }
    // lawns, gravel paths and the statue (positions of both statues are from their NHLE grid references)
  }

  // ================= statues
  const statues = new T.Group(); g.add(statues);
  function plinth(z, h, w) { stone.box(0, 0.25, z, w + 1.6, 0.5, w + 1.6, 0, stt); stone.box(0, 0.65, z, w + 0.8, 0.3, w + 0.8, 0, stt); stone.box(0, 0.8 + h / 2, z, w, h, w, 0, stt); stone.box(0, 0.8 + h + 0.15, z, w + 0.5, 0.3, w + 0.5, 0, stt); }
  // Queen Victoria beside a throne, on a plinth carried by four bulbous columns (NHLE 1189442)
  {
    const z = -QC; plinth(z, 1.6, 2.2);
    for (const [sx, sz] of cs) { const c = lathe([[0, 0], [0.3, 0], [0.42, 0.3], [0.45, 0.6], [0.3, 0.95], [0.2, 1.1], [0.32, 1.25], [0, 1.3]], 10); c.translate(sx * 0.9, 2.7, z + sz * 0.9); extraStone.push(c); }
    stone.box(0, 4.15, z, 2.6, 0.3, 2.6, 0, stt);
    const robe = lathe([[0, 0], [0.75, 0], [0.62, 0.6], [0.42, 1.25], [0.3, 1.55], [0.22, 1.7], [0, 1.72]], 14); robe.translate(0.2, 4.3, z); extraMarble.push(robe);
    const head = new T.SphereGeometry(0.17, 12, 8); head.translate(0.2, 6.15, z); extraMarble.push(head);
    const crown = new T.CylinderGeometry(0.12, 0.15, 0.12, 10); crown.translate(0.2, 6.33, z); extraMarble.push(crown);
    const throne = new T.BoxGeometry(0.9, 1.6, 0.8); throne.translate(-0.55, 5.1, z + 0.1); extraMarble.push(throne);
  }
  // Thomas Holloway standing and Jane Holloway seated; Baroque plinth with four muses at the corners (NHLE 1028947)
  {
    const z = QC; plinth(z, 2.0, 3.0);
    for (const [sx, sz] of cs) { const m = lathe([[0, 0], [0.42, 0], [0.36, 0.5], [0.24, 0.85], [0.14, 0.95], [0.16, 1.1], [0, 1.25]], 10); m.translate(sx * 1.85, 0.8, z + sz * 1.85); extraMarble.push(m); }
    const fig = lathe([[0, 0], [0.42, 0], [0.38, 0.9], [0.3, 1.4], [0.18, 1.6], [0, 1.62]], 12); fig.translate(-0.45, 3.1, z); extraMarble.push(fig);
    const hd = new T.SphereGeometry(0.15, 10, 8); hd.translate(-0.45, 4.85, z); extraMarble.push(hd);
    const seat = new T.BoxGeometry(0.8, 0.6, 0.7); seat.translate(0.5, 3.4, z); extraMarble.push(seat);
    const fig2 = lathe([[0, 0], [0.4, 0], [0.32, 0.55], [0.2, 0.9], [0, 0.92]], 12); fig2.translate(0.5, 3.7, z); extraMarble.push(fig2);
    const hd2 = new T.SphereGeometry(0.14, 10, 8); hd2.translate(0.5, 4.75, z); extraMarble.push(hd2);
  }

  // ================= assemble
  const add = (geo, m, name, cast = true) => { const mesh = new T.Mesh(geo, m); mesh.name = 'founders:' + name; mesh.castShadow = cast; mesh.receiveShadow = true; g.add(mesh); return mesh; };
  add(brick.geometry(), M.brick, 'brick');
  add(stone.geometry(), M.stone, 'stone');
  add(roof.geometry(), M.roof, 'roof');
  if (!lead.empty) add(lead.geometry(), M.lead, 'lead');
  if (!dark.empty) add(dark.geometry(), M.dark, 'openings', false);
  if (!iron.empty) add(iron.geometry(), M.iron, 'ironwork');
  const flat = list => list.length ? mergeStd(list) : null;
  [[extraBrick, M.brick, 'curved-brick'], [extraStone, M.stone, 'curved-stone'], [extraRoof, M.roof, 'cones-domes'], [extraLead, M.lead, 'lead-domes'], [extraGold, M.gold, 'gilt'], [extraMarble, M.marble, 'statues']]
    .forEach(([l, m, n]) => { const geo = flat(l); if (geo) add(geo, m, n); });
  for (const k of [winMain, winPlain, winGround, winTop, winArch, winBig, bull, dormer, dormerR, chim, pilaster, baluster, urn, finial, column]) k.build(g, M);

  // courtyard ground: lawns with gravel paths (layout estimated)
  const quadGround = new T.Group(); quadGround.name = 'founders:courtyards'; g.add(quadGround);
  const lawnM = MT.std('f:lawn', { tex: MT.grass('quad', { base: '#567a3c', tile: 3, dry: 0.2 }), rough: 0.95, envI: 0.2 });
  const gravelM = MT.std('f:gravel', { tex: MT.gravel('quad', { base: '#c8b791', tile: 3 }), rough: 0.95 });
  for (const sz of [-1, 1]) {
    const zc = sz * QC, w = WQ - 2 * COL, d = Q;
    const gs = new Soup(), ls = new Soup();
    gs.cap([[-w / 2, zc - d / 2], [w / 2, zc - d / 2], [w / 2, zc + d / 2], [-w / 2, zc + d / 2]], 0.05, [], false, 1 / 3);
    const lw = w - 7, ld = d - 7;
    for (const [qx0, qz0b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const x0 = qx0 < 0 ? -lw / 2 : 1.6, x1 = qx0 < 0 ? -1.6 : lw / 2, z0 = zc + (qz0b < 0 ? -ld / 2 : 1.6), z1 = zc + (qz0b < 0 ? -1.6 : ld / 2);
      // lawn quarters with the corner nearest the statue cut back for a round gravel circle
      ls.cap([[x0, z0], [x1, z0], [x1, z1], [x0, z1]], 0.09, [], false, 1 / 3);
    }
    const c = new T.Mesh(new T.CircleGeometry(5.0, 32), gravelM); c.rotation.x = -Math.PI / 2; c.position.set(0, 0.1, zc); c.receiveShadow = true; quadGround.add(c);
    const gm = new T.Mesh(gs.geometry(), gravelM); gm.receiveShadow = true; quadGround.add(gm);
    const lm = new T.Mesh(ls.geometry(), lawnM); lm.receiveShadow = true; quadGround.add(lm);
  }

  // ---- outputs in scene coordinates
  const rectToScene = ([x0, x1, z0, z1]) => [toScene(x0, z0), toScene(x1, z0), toScene(x1, z1), toScene(x0, z1)];
  const blockers = rects.map(rectToScene);
  // bounding outline of the main block (for the map) with the two courtyards as holes
  const outline = rectToScene([-HW - 1.6, HW + 1.6, -HL - 2.6, HL + 2.4]);
  const quads = [-1, 1].map(sz => rectToScene([-qx, qx, sz * QC - Q / 2, sz * QC + Q / 2]));
  const features = {
    entrance: toScene(0, -HL - 3), clockTower: toScene(0, -HL + 3.5), northQuad: toScene(0, -QC), southQuad: toScene(0, QC),
    lanternTower: toScene(0, 0), chapel: toScene(21, 0), gallery: toScene(-21, 0), diningHall: toScene(0, 5), dragonTower: toScene(0, HL - 4),
    foundersSquareFront: toScene(HW + 2, 0), southFront: toScene(0, HL + 4)
  };
  g.updateMatrixWorld(true);
  return { group: g, blockers, outline, quads, features, toScene, heightAt: () => eaves, H: eaves };
}
