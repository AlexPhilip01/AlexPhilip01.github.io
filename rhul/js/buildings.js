// Parametric models for every traced campus building except Founder's.
// Footprints come from the campus-map trace (regularised in tools/build_data.py). Façade styles follow the
// original project's observations from a drive round the campus; storey counts and heights are estimates.
import { T, Soup, instanced, mulberry32, obb, offsetRing, ringArea, pointInRing, ringCentroid } from './util.js';
import * as MT from './materials.js';

// ------------------------------------------------------------------ archetypes
// bay: width of one façade bay (m); sh: storey height (m); parapet: height above the top storey (m)
export const ARCH = {
  kiosk: { bay: 3.0, sh: 3.0, parapet: 0.35, label: 'Small single-storey building' },
  brick_small: { bay: 3.2, sh: 3.4, parapet: 0.45, label: 'Small brick building' },
  brick_flat: { bay: 3.4, sh: 3.4, parapet: 0.8, label: 'Red-brick building, flat roof' },
  brick_banded: { bay: 3.6, sh: 3.8, parapet: 1.1, label: 'Red-brick building with a pale band at the top' },
  shilling: { bay: 6.0, sh: 4.0, parapet: 0.6, label: 'Grey panels with dark diagonal bands' },
  brick_timber: { bay: 4.6, sh: 3.8, parapet: 0.7, label: 'Orange brick with dark timber cladding' },
  panel_block: { bay: 4.2, sh: 4.0, parapet: 0.7, label: 'Teaching block: dark brick piers between pale and dark panel bands' },
  buff_hall: { bay: 3.4, sh: 3.1, parapet: 0.6, label: 'Buff-brick hall of residence' },
  clad_hall: { bay: 3.6, sh: 3.0, parapet: 0.8, label: 'Five-storey hall in rainscreen cladding' },
  gowar: { bay: 4.6, sh: 3.0, parapet: 0.6, label: 'Board-marked concrete hall raised on columns' },
  victorian_pool: { bay: 3.0, sh: 4.4, parapet: 0, label: 'Victorian single-storey pool hall: red brick and pebble-dash, hipped tiled roof with glazing' },
  library: { bay: 3.0, sh: 3.9, parapet: 1.1, label: 'Modern library building with a roof terrace' },
  low_shed: { bay: 5.0, sh: 4.0, parapet: 0.3, label: 'Low single-storey structure' }
};

const gray = v => `rgb(${v | 0},${v | 0},${v | 0})`;
function brickArea(a, h, x, y, w, hh, base, rnd, course = 7, mortar = 'rgba(235,225,205,0.35)') {
  a.fillStyle = base; a.fillRect(x, y, w, hh);
  for (let yy = y; yy < y + hh; yy += course) {
    a.fillStyle = mortar; a.fillRect(x, yy, w, 1);
    h.fillStyle = '#606060'; h.fillRect(x, yy, w, 1);
    const off = ((yy / course) | 0) % 2 ? 7 : 0;
    for (let xx = x - off; xx < x + w; xx += 14) { a.fillRect(Math.max(x, xx), yy, 1, course); a.fillStyle = `rgba(${rnd() < 0.5 ? '0,0,0' : '255,255,255'},${0.06 * rnd()})`; a.fillRect(Math.max(x, xx + 1), yy + 1, 13, course - 1); a.fillStyle = mortar; }
  }
}
// glass pane with frame; writes albedo, height (recessed) and roughness (smooth glass)
function pane(a, h, r, x, y, w, hh, { frame = '#f1efe9', fw = 4, glass = '#2b3946', mull = 0, trans = 0 } = {}) {
  a.fillStyle = frame; a.fillRect(x, y, w, hh);
  const g = a.createLinearGradient(x, y, x + w * 0.4, y + hh); g.addColorStop(0, '#46596a'); g.addColorStop(0.5, glass); g.addColorStop(1, '#1e2730');
  a.fillStyle = g; a.fillRect(x + fw, y + fw, w - 2 * fw, hh - 2 * fw);
  a.fillStyle = frame;
  for (let i = 1; i <= mull; i++) a.fillRect(x + i * w / (mull + 1) - fw / 3, y, fw * 0.66, hh);
  if (trans) a.fillRect(x, y + hh * trans - fw / 3, w, fw * 0.66);
  h.fillStyle = '#303030'; h.fillRect(x + fw, y + fw, w - 2 * fw, hh - 2 * fw);
  h.fillStyle = '#a0a0a0'; h.fillRect(x, y, w, fw); h.fillRect(x, y + hh - fw, w, fw);
  r.fillStyle = gray(18); r.fillRect(x + fw, y + fw, w - 2 * fw, hh - 2 * fw);
}
// The painted bay texture for each archetype. Canvas is 256 x 256 = one bay x one storey.
const BAYS = {
  kiosk: ({ a, h, r, rnd }) => { a.fillStyle = '#c9c4b8'; a.fillRect(0, 0, 256, 256); MTgrain(a, rnd); pane(a, h, r, 70, 60, 116, 120, { frame: '#4a4f55', fw: 5 }); },
  brick_small: ({ a, h, r, rnd }) => { brickArea(a, h, 0, 0, 256, 256, '#9e4b38', rnd); pane(a, h, r, 78, 62, 100, 120, { mull: 1 }); a.fillStyle = '#d9d2c4'; a.fillRect(70, 182, 116, 8); },
  brick_flat: ({ a, h, r, rnd }) => { brickArea(a, h, 0, 0, 256, 256, '#a2513a', rnd); pane(a, h, r, 56, 70, 144, 120, { mull: 1 }); a.fillStyle = '#e4ddd0'; a.fillRect(50, 190, 156, 8); },
  brick_banded: ({ a, h, r, rnd }) => { brickArea(a, h, 0, 0, 256, 256, '#a14d38', rnd); pane(a, h, r, 40, 80, 176, 100, { mull: 2, frame: '#e9e7e1' }); },
  shilling: ({ a, h, r, rnd }) => {
    a.fillStyle = '#c9ccd0'; a.fillRect(0, 0, 256, 256); a.fillStyle = 'rgba(0,0,0,0.08)'; for (let y = 0; y < 256; y += 32) a.fillRect(0, y, 256, 2); for (let x = 0; x < 256; x += 64) a.fillRect(x, 0, 2, 256);
    a.fillStyle = '#2d323a'; a.beginPath(); a.moveTo(36, 0); a.lineTo(92, 0); a.lineTo(72, 256); a.lineTo(48, 256); a.fill(); a.beginPath(); a.moveTo(168, 0); a.lineTo(208, 0); a.lineTo(236, 256); a.lineTo(184, 256); a.fill();
    r.fillStyle = gray(70); r.beginPath(); r.moveTo(36, 0); r.lineTo(92, 0); r.lineTo(72, 256); r.lineTo(48, 256); r.fill();
    a.fillStyle = '#c94b3c'; for (let i = 0; i < 14; i++) { a.beginPath(); a.arc(104 + (i * 37) % 60, 12 + (i * 23) % 230, 4, 0, 7); a.fill(); }
    pane(a, h, r, 120, 96, 44, 70, { frame: '#3b4048', fw: 4 });
  },
  brick_timber: ({ a, h, r, rnd }) => {
    a.fillStyle = '#5a4434'; a.fillRect(0, 0, 256, 120); for (let x = 0; x < 256; x += 12) { a.fillStyle = `rgba(0,0,0,${0.18 + rnd() * 0.12})`; a.fillRect(x, 0, 2, 120); h.fillStyle = '#505050'; h.fillRect(x, 0, 2, 120); }
    brickArea(a, h, 0, 120, 256, 136, '#c0683f', rnd);
    pane(a, h, r, 28, 26, 200, 70, { mull: 3, frame: '#2b2b2e' }); pane(a, h, r, 50, 160, 72, 70, { frame: '#2b2b2e' });
  },
  panel_block: ({ a, h, r, rnd }) => {
    a.fillStyle = '#efeee8'; a.fillRect(0, 0, 256, 256);
    pane(a, h, r, 40, 40, 216, 130, { frame: '#e9e9e3', fw: 3, mull: 3, glass: '#1d232b' });
    a.fillStyle = '#20262d'; a.fillRect(40, 190, 216, 40); r.fillStyle = gray(90); r.fillRect(40, 190, 216, 40);
    brickArea(a, h, 0, 0, 36, 256, '#4a2f28', rnd, 7, 'rgba(0,0,0,0.25)');
    h.fillStyle = '#c0c0c0'; h.fillRect(0, 0, 36, 256);
  },
  buff_hall: ({ a, h, r, rnd }) => { brickArea(a, h, 0, 0, 256, 256, '#cfa877', rnd, 7, 'rgba(255,250,235,0.35)'); a.fillStyle = '#b98b5c'; a.fillRect(0, 222, 256, 10); pane(a, h, r, 40, 64, 78, 110, {}); pane(a, h, r, 138, 64, 78, 110, {}); },
  buff_bay: ({ a, h, r, rnd }) => { brickArea(a, h, 0, 0, 256, 256, '#cfa877', rnd, 7, 'rgba(255,250,235,0.35)'); a.fillStyle = '#b98b5c'; a.fillRect(0, 222, 256, 10); pane(a, h, r, 22, 64, 64, 110, {}); a.fillStyle = '#9b2b2e'; a.fillRect(120, 170, 120, 40); pane(a, h, r, 120, 40, 120, 130, { mull: 2 }); },
  clad_beige: ({ a, h, r }) => cladPanel(a, h, r, '#d6c4a6'), clad_terra: ({ a, h, r }) => cladPanel(a, h, r, '#b8583a'), clad_grey: ({ a, h, r }) => cladPanel(a, h, r, '#7d8086'),
  gowar: ({ a, h, r, rnd }) => {
    a.fillStyle = '#a3a39c'; a.fillRect(0, 0, 256, 256); for (let y = 0; y < 256; y += 12) { a.fillStyle = `rgba(60,60,55,${0.08 + rnd() * 0.1})`; a.fillRect(0, y, 256, 2); h.fillStyle = '#707070'; h.fillRect(0, y, 256, 2); }
    pane(a, h, r, 30, 70, 90, 100, { frame: '#e7e7e2' }); pane(a, h, r, 156, 70, 70, 100, { frame: rnd() < 0.5 ? '#e2b432' : '#e7e7e2' });
  },
  victorian_pool: ({ a, h, r, rnd }) => { a.fillStyle = '#d8d0bf'; a.fillRect(0, 0, 256, 256); for (let i = 0; i < 2500; i++) { a.fillStyle = `rgba(${rnd() < 0.5 ? '120,110,95' : '255,250,240'},${0.25 * rnd()})`; a.fillRect(rnd() * 256, rnd() * 160, 2, 2); } brickArea(a, h, 0, 160, 256, 96, '#9e4b38', rnd); a.fillStyle = '#9e4b38'; a.fillRect(0, 70, 256, 14); pane(a, h, r, 84, 92, 88, 60, { mull: 1 }); },
  library: ({ a, h, r, rnd }) => { a.fillStyle = '#c9b999'; a.fillRect(0, 0, 256, 256); MTgrain(a, rnd); pane(a, h, r, 54, 0, 148, 236, { frame: '#3a3f45', fw: 4, trans: 0.72, glass: '#2a3743' }); a.fillStyle = '#c8bda4'; a.fillRect(0, 236, 256, 20); h.fillStyle = '#d0d0d0'; h.fillRect(0, 0, 54, 256); h.fillRect(202, 0, 54, 256); },
  library_ground: ({ a, h, r }) => { a.fillStyle = '#3a3f45'; a.fillRect(0, 0, 256, 256); pane(a, h, r, 6, 6, 244, 244, { frame: '#3a3f45', fw: 3, trans: 0.8, glass: '#33424f' }); },
  low_shed: ({ a, h, r }) => { a.fillStyle = '#7b8077'; a.fillRect(0, 0, 256, 256); for (let x = 0; x < 256; x += 16) { a.fillStyle = 'rgba(0,0,0,0.18)'; a.fillRect(x, 0, 3, 256); h.fillStyle = '#e0e0e0'; h.fillRect(x + 4, 0, 6, 256); } }
};
function cladPanel(a, h, r, col) {
  a.fillStyle = col; a.fillRect(0, 0, 256, 256);
  a.fillStyle = 'rgba(0,0,0,0.12)'; for (let y = 0; y < 256; y += 64) a.fillRect(0, y, 256, 3); a.fillRect(126, 0, 3, 256);
  h.fillStyle = '#505050'; for (let y = 0; y < 256; y += 64) h.fillRect(0, y, 256, 3); h.fillRect(126, 0, 3, 256);
  r.fillStyle = gray(150); r.fillRect(0, 0, 256, 256);
  pane(a, h, r, 64, 64, 128, 120, { frame: '#5b6067', fw: 6, mull: 1 });
}
function MTgrain(a, rnd) { for (let i = 0; i < 3000; i++) { a.fillStyle = `rgba(${rnd() < 0.5 ? '0,0,0' : '255,255,255'},${0.05 * rnd()})`; a.fillRect(rnd() * 256, rnd() * 256, 1.5, 1.5); } }

function bayMaterial(name) {
  return MT.std('bay:' + name, { tex: MT.painted('bay:' + name, 256, BAYS[name], { normal: 2.2 }), rough: 0.85, metal: 0.05, envI: 0.9 });
}
const PLAIN = {
  kiosk: '#c9c4b8', brick_small: '#9e4b38', brick_flat: '#a2513a', brick_banded: '#ece9e1', shilling: '#c9ccd0', brick_timber: '#5a4434',
  panel_block: '#2a2f36', buff_hall: '#cfa877', clad_hall: '#e2e2de', gowar: '#a3a39c', victorian_pool: '#9e4b38', library: '#c9b999', low_shed: '#7b8077'
};
function plainMaterial(arch) {
  const col = PLAIN[arch];
  if (/brick|buff|pool/.test(arch) && arch !== 'brick_banded') return MT.std('plain:' + arch, { tex: MT.brick('plain:' + col, { base: col, tile: 1.2, size: 256, burnt: 0.04 }), rough: 0.9 });
  return MT.std('plain:' + arch, { color: col, rough: 0.8 });
}

// ------------------------------------------------------------------ geometry builder
export function buildBuildings(data, founders) {
  const group = new T.Group(); group.name = 'campus buildings';
  const soups = new Map(); // material -> Soup
  const S = m => { if (!soups.has(m)) soups.set(m, new Soup()); return soups.get(m); };
  const roofFlat = MT.std('roof:flat', { tex: MT.concrete('roof', { base: '#55585b', tile: 4 }), rough: 0.95, envI: 0.15 });
  const roofTile = MT.std('roof:tile', { tex: MT.roofTiles('halls', { base: '#74402f', tile: 1.0 }), rough: 0.85, envI: 0.2 });
  const roofSlate = MT.std('roof:slate', { tex: MT.roofTiles('slate', { base: '#4a4f57', tile: 1.0 }), rough: 0.7, envI: 0.25 });
  const coping = MT.std('coping', { tex: MT.stone('coping', { base: '#d5d0c6', tile: 1.2 }), rough: 0.7 });
  const glassRoof = MT.glass('rooflight', { color: '#5f7d8c', rough: 0.05 });
  const terraceDeck = MT.std('deck', { tex: MT.timber('deck', { base: '#8d6d4f', tile: 2 }), rough: 0.85 });
  const glassBal = MT.std('glass:balustrade', { color: '#9fb8c4', rough: 0.05, metal: 0.1, transparent: true, opacity: 0.35, envI: 1.4 });
  const lanterns = [], pilotis = [];
  const list = [];
  const rnd = mulberry32(7);
  let cladK = 0, buffK = 0;
  const inFounders = (x, z) => founders && pointInRing(x, z, founders.outline);

  for (const b of data.buildings) {
    if (b.arch === 'founders' || b.arch === 'lodge') continue;
    if (inFounders(b.c[0], b.c[1])) continue; // small items traced inside Founder's courtyards (statue bases)
    let arch = b.arch, A = ARCH[arch];
    if (!A) { console.warn('unknown archetype', arch); arch = 'brick_flat'; A = ARCH[arch]; }
    if (b.id === 'B65') { arch = 'low_shed'; A = ARCH.low_shed; }
    if (b.id === 'B48') { arch = 'library'; A = ARCH.library; }
    const storeys = arch === 'library' ? 4 : arch === 'low_shed' ? 1 : (b.storeys || 2);
    const lift = b.pilotis || 0, wallTop = lift + storeys * A.sh, top = wallTop + A.parapet;
    const ring = b.o, holes = b.h || [];
    const box = obb(ring), rectFill = Math.abs(ringArea(ring)) / (box.L * box.W);
    let bayKey = arch;
    if (arch === 'clad_hall') bayKey = ['clad_beige', 'clad_terra', 'clad_grey'][cladK++ % 3];
    if (arch === 'buff_hall') bayKey = (buffK++ % 3) ? 'buff_bay' : 'buff_hall';
    const wallM = bayMaterial(bayKey), plainM = plainMaterial(arch);
    const pitched = (arch === 'buff_hall' && rectFill > 0.86 && box.W < 24) || arch === 'victorian_pool' || arch === 'brick_small';
    const rings = [ring, ...holes]; // outer ring is counter-clockwise, holes clockwise: walls face away from the solid
    // walls: whole bays per edge, one row of the bay texture per storey
    for (const rg of rings) {
      for (let i = 0; i < rg.length; i++) {
        const [x0, z0] = rg[i], [x1, z1] = rg[(i + 1) % rg.length], L = Math.hypot(x1 - x0, z1 - z0);
        if (L < 0.05) continue;
        const n = Math.max(1, Math.round(L / A.bay));
        if (arch === 'library') {
          S(bayMaterial('library_ground')).wall(x0, z0, x1, z1, 0, A.sh, 0, n / L, 1 / A.sh);
          S(wallM).wall(x0, z0, x1, z1, A.sh, wallTop, 0, n / L, 1 / A.sh, -1);
        } else S(wallM).wall(x0, z0, x1, z1, lift, wallTop, 0, n / L, 1 / A.sh, -lift / A.sh);
        if (!pitched && A.parapet > 0) S(plainM).wall(x0, z0, x1, z1, wallTop, top, 0, 1 / 1.2, 1 / 1.2);
      }
    }
    if (lift) { // underside and columns (Gowar is raised over parking)
      S(MT.std('soffit', { color: '#8d8d87', rough: 0.9 })).cap(ring, lift, holes, true, 1 / 3);
      for (const rg of [ring]) for (let i = 0; i < rg.length; i++) { const [x0, z0] = rg[i], [x1, z1] = rg[(i + 1) % rg.length], L = Math.hypot(x1 - x0, z1 - z0); for (let t = 1.2; t < L - 0.8; t += 6.5) pilotis.push({ x: x0 + (x1 - x0) * t / L, y: lift / 2, z: z0 + (z1 - z0) * t / L, sy: lift }); }
    }
    let roofTop = top;
    if (pitched) {
      // pitched (gable or hipped) roof over the oriented box of the footprint
      const ov = 0.45, Lr = box.L + ov * 2, Wr = box.W + ov * 2, rh = arch === 'victorian_pool' ? Math.min(4.2, box.W * 0.35) : Math.min(4.8, box.W * 0.34);
      const hip = arch === 'victorian_pool' || arch === 'brick_small' ? Math.min(Wr / 2, Lr / 2) * 0.95 : 0;
      const dx = box.dx, dz = box.dz, px = -dz, pz = dx; // along / across
      const P = (u, v, y) => [box.cx + dx * u + px * v, y, box.cz + dz * u + pz * v];
      const y0 = wallTop, ridgeHalf = Lr / 2 - hip, R = arch === 'victorian_pool' ? roofSlate : roofTile;
      const rs = S(R), sl = Math.hypot(Wr / 2, rh);
      rs.quad(P(-Lr / 2, -Wr / 2, y0), P(-ridgeHalf, 0, y0 + rh), P(ridgeHalf, 0, y0 + rh), P(Lr / 2, -Wr / 2, y0), [0, 0], [hip, sl], [Lr - hip, sl], [Lr, 0]);
      rs.quad(P(Lr / 2, Wr / 2, y0), P(ridgeHalf, 0, y0 + rh), P(-ridgeHalf, 0, y0 + rh), P(-Lr / 2, Wr / 2, y0), [0, 0], [hip, sl], [Lr - hip, sl], [Lr, 0]);
      if (hip > 0) {
        rs.tri(P(Lr / 2, -Wr / 2, y0), P(ridgeHalf, 0, y0 + rh), P(Lr / 2, Wr / 2, y0), [0, 0], [Wr / 2, sl], [Wr, 0]);
        rs.tri(P(-Lr / 2, Wr / 2, y0), P(-ridgeHalf, 0, y0 + rh), P(-Lr / 2, -Wr / 2, y0), [0, 0], [Wr / 2, sl], [Wr, 0]);
      } else {
        const gs = S(plainM);
        gs.tri(P(Lr / 2 - ov, -Wr / 2 + ov, y0), P(Lr / 2 - ov, 0, y0 + rh - 0.1), P(Lr / 2 - ov, Wr / 2 - ov, y0), [0, 0], [box.W / 2, rh], [box.W, 0]);
        gs.tri(P(-Lr / 2 + ov, Wr / 2 - ov, y0), P(-Lr / 2 + ov, 0, y0 + rh - 0.1), P(-Lr / 2 + ov, -Wr / 2 + ov, y0), [0, 0], [box.W / 2, rh], [box.W, 0]);
      }
      if (arch === 'victorian_pool') { // glazed section over the pool (NHLE 1378057)
        const gl = S(glassRoof); gl.quad(P(-ridgeHalf * 0.8, -1.2, y0 + rh - 0.35), P(-ridgeHalf * 0.8, 0, y0 + rh + 0.05), P(ridgeHalf * 0.8, 0, y0 + rh + 0.05), P(ridgeHalf * 0.8, -1.2, y0 + rh - 0.35), [0, 0], [0, 1], [1, 1], [1, 0]);
        gl.quad(P(ridgeHalf * 0.8, 1.2, y0 + rh - 0.35), P(ridgeHalf * 0.8, 0, y0 + rh + 0.05), P(-ridgeHalf * 0.8, 0, y0 + rh + 0.05), P(-ridgeHalf * 0.8, 1.2, y0 + rh - 0.35), [0, 0], [0, 1], [1, 1], [1, 0]);
      }
      // if the footprint is not quite a rectangle, close the gap under the eaves with a flat roof
      if (rectFill < 0.97) S(roofFlat).cap(ring, y0 - 0.02, holes, false, 1 / 4);
      roofTop = y0 + rh;
    } else if (A.parapet > 0) {
      // flat roof inside a parapet with a coping
      const inner = offsetRing(ring, -0.35), innerHoles = holes.map(h => offsetRing(h, 0.35));
      for (const rg of [inner, ...innerHoles]) for (let i = 0; i < rg.length; i++) {
        const [x0, z0] = rg[i], [x1, z1] = rg[(i + 1) % rg.length]; S(plainM).wall(x1, z1, x0, z0, wallTop, top - 0.05, 0, 1 / 1.2, 1 / 1.2);
      }
      S(coping).cap(ring, top, [inner], false, 1 / 1.2);
      for (let k = 0; k < holes.length; k++) S(coping).cap(innerHoles[k], top, [holes[k]], false, 1 / 1.2);
      S(roofFlat).cap(inner, wallTop + 0.05, innerHoles, false, 1 / 4);
      // white band at the top of the Students' Union block, as in the campus video
      if (arch === 'brick_banded') for (let i = 0; i < ring.length; i++) { const [x0, z0] = ring[i], [x1, z1] = ring[(i + 1) % ring.length]; S(coping).wall(x0, z0, x1, z1, top, top + 0.15, 0, 1, 1); }
      if (arch === 'panel_block' && b.area > 700) {
        for (const t of [-0.28, 0.28]) { const x = box.cx + box.dx * box.L * t, z = box.cz + box.dz * box.L * t; if (pointInRing(x, z, inner) && pointInRing(x + 3, z, inner) && pointInRing(x - 3, z, inner) && pointInRing(x, z + 3, inner) && pointInRing(x, z - 3, inner)) lanterns.push({ x, z, y: wallTop, ry: Math.atan2(box.dx, box.dz) }); }
      }
      if (arch === 'library') { // roof terrace (official virtual tour): a timber deck inside the parapet; its extent is an estimate
        const deckRing = offsetRing(ring, -2.2);
        S(terraceDeck).cap(deckRing, wallTop + 0.16, [], false, 1 / 2);
        // glass screen standing just inside the parapet
        for (let i = 0; i < deckRing.length; i++) { const [x0, z0] = deckRing[i], [x1, z1] = deckRing[(i + 1) % deckRing.length]; S(glassBal).wall(x0, z0, x1, z1, wallTop + 0.16, top + 0.9, 0, 1, 1); S(glassBal).wall(x1, z1, x0, z0, wallTop + 0.16, top + 0.9, 0, 1, 1); }
      }
    } else {
      S(roofFlat).cap(ring, wallTop, holes, false, 1 / 4);
    }
    const height = Math.max(roofTop, top);
    list.push({ id: b.id, ring, holes, height, base: lift, arch, storeys, label: A.label, data: b, centre: b.c });
  }
  for (const [m, s] of soups) { if (s.empty) continue; const mesh = new T.Mesh(s.geometry(), m); mesh.castShadow = true; mesh.receiveShadow = true; mesh.name = 'buildings:' + (m.name || ''); group.add(mesh); }
  if (pilotis.length) group.add(instanced(new T.BoxGeometry(0.7, 1, 0.7), MT.std('pilotis', { tex: MT.concrete('pilotis', { base: '#9a9a93' }), rough: 0.9 }), pilotis));
  if (lanterns.length) {
    const frame = MT.std('lantern-frame', { color: '#3a3f46', rough: 0.6, metal: 0.4 });
    group.add(instanced(new T.BoxGeometry(4.4, 0.9, 4.4), frame, lanterns.map(l => ({ ...l, y: l.y + 0.45 }))));
    const pyr = new T.ConeGeometry(3.05, 2.4, 4, 1); pyr.rotateY(Math.PI / 4);
    group.add(instanced(pyr, glassRoof, lanterns.map(l => ({ ...l, y: l.y + 2.1 }))));
  }
  void rnd; void ringCentroid;
  return { group, list };
}
