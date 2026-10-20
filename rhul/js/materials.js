// Procedural PBR textures and materials. Every texture is painted on a canvas at start-up:
// an albedo layer, a height layer (turned into a normal map) and a roughness layer.
// Colours are estimates from photographs and the Historic England list description, not measurements.
import { T, mulberry32, clamp } from './util.js';

let ANISO = 4;
export function setAnisotropy(a) { ANISO = a; }

function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function heightToNormal(hc, strength = 2) {
  const w = hc.width, h = hc.height, src = hc.getContext('2d').getImageData(0, 0, w, h).data;
  const out = canvas(w, h), ctx = out.getContext('2d'), img = ctx.createImageData(w, h), d = img.data;
  const H = (x, y) => src[(((y + h) % h) * w + ((x + w) % w)) * 4] / 255;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (H(x + 1, y) - H(x - 1, y)) * strength, dy = (H(x, y + 1) - H(x, y - 1)) * strength;
    let nx = -dx, ny = dy, nz = 1; const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    const i = (y * w + x) * 4; d[i] = (nx * 0.5 + 0.5) * 255; d[i + 1] = (ny * 0.5 + 0.5) * 255; d[i + 2] = (nz * 0.5 + 0.5) * 255; d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0); return out;
}
function tex(c, srgb, repeat = true) {
  const t = new T.CanvasTexture(c);
  if (repeat) t.wrapS = t.wrapT = T.RepeatWrapping;
  t.anisotropy = ANISO; if (srgb) t.encoding = T.sRGBEncoding;
  return t;
}
// Paint albedo, height and roughness layers with one painter function and return the three textures.
// The painter gets {a, h, r} 2D contexts (albedo / height / roughness), size, and an rng.
const cache = new Map();
export function painted(key, size, painter, { normal = 2.0, w = size, h = size } = {}) {
  if (cache.has(key)) return cache.get(key);
  const A = canvas(w, h), Hc = canvas(w, h), R = canvas(w, h);
  const a = A.getContext('2d'), hh = Hc.getContext('2d'), r = R.getContext('2d');
  hh.fillStyle = '#808080'; hh.fillRect(0, 0, w, h); r.fillStyle = '#d0d0d0'; r.fillRect(0, 0, w, h);
  painter({ a, h: hh, r, w, H: h, rnd: mulberry32(key.length * 977 + w) });
  const out = { map: tex(A, true), normalMap: normal ? tex(heightToNormal(Hc, normal), false) : null, roughnessMap: tex(R, false), canvas: A };
  cache.set(key, out); return out;
}
const rgb = (r, g, b) => `rgb(${r | 0},${g | 0},${b | 0})`;
const gray = v => rgb(v, v, v);
function jitterColor(hex, rnd, amt) {
  const n = parseInt(hex.slice(1), 16); let r = n >> 16 & 255, g = n >> 8 & 255, b = n & 255;
  const k = 1 + (rnd() - 0.5) * amt, t = (rnd() - 0.5) * amt * 30;
  return rgb(clamp(r * k + t, 0, 255), clamp(g * k + t * 0.6, 0, 255), clamp(b * k, 0, 255));
}
function grain(ctx, w, h, rnd, alpha, n = 4000, size = 1.6) {
  for (let i = 0; i < n; i++) { const v = rnd() < 0.5 ? 0 : 255; ctx.fillStyle = `rgba(${v},${v},${v},${alpha * rnd()})`; ctx.fillRect(rnd() * w, rnd() * h, size, size); }
}

// ---------------------------------------------------------------- brick
// English-bond style brickwork. tile = metres covered by the texture; courses of 75 mm.
export function brick(key, { base = '#b04a3a', vary = 0.11, mortar = '#cdbfa8', tile = 0.9, size = 512, burnt = 0.025 } = {}) {
  return painted('brick:' + key, size, ({ a, h, r, w, rnd }) => {
    const course = 0.075 / tile * w, len = 0.225 / tile * w, joint = Math.max(1.5, 0.01 / tile * w);
    a.fillStyle = mortar; a.fillRect(0, 0, w, w); h.fillStyle = '#5a5a5a'; h.fillRect(0, 0, w, w); r.fillStyle = '#e6e6e6'; r.fillRect(0, 0, w, w);
    const rows = Math.round(w / course);
    for (let row = 0; row < rows; row++) {
      const y = row * w / rows, header = row % 2 === 1, bl = header ? len / 2 : len, off = header ? len / 4 : 0;
      for (let x = -off; x < w; x += bl) {
        const c = rnd() < burnt ? jitterColor('#5d2a26', rnd, 0.3) : jitterColor(base, rnd, vary);
        a.fillStyle = c; a.fillRect(x + joint / 2, y + joint / 2, bl - joint, w / rows - joint);
        h.fillStyle = gray(170 + rnd() * 40);
        h.fillRect(x + joint / 2, y + joint / 2, bl - joint, w / rows - joint);
        r.fillStyle = gray(200 + rnd() * 30);
        r.fillRect(x + joint / 2, y + joint / 2, bl - joint, w / rows - joint);
        if (x + bl > w && x < w) { a.fillRect(x - w + joint / 2, y + joint / 2, bl - joint, w / rows - joint); }
      }
    }
    grain(a, w, w, rnd, 0.06, w * 12);
  }, { normal: 3 });
}
// smooth dressed stone (ashlar) in courses
export function stone(key, { base = '#d8ccb2', tile = 1.2, course = 0.3, block = 0.75, size = 256 } = {}) {
  return painted('stone:' + key, size, ({ a, h, r, w, rnd }) => {
    a.fillStyle = base; a.fillRect(0, 0, w, w); h.fillStyle = '#909090'; h.fillRect(0, 0, w, w); r.fillStyle = '#c8c8c8'; r.fillRect(0, 0, w, w);
    const rows = Math.max(1, Math.round(tile / course)), rh = w / rows;
    for (let row = 0; row < rows; row++) {
      const bl = block / tile * w, off = row % 2 ? bl / 2 : 0;
      for (let x = -off; x < w; x += bl) {
        a.fillStyle = jitterColor(base, rnd, 0.06); a.fillRect(x + 1, row * rh + 1, bl - 2, rh - 2);
        a.fillStyle = 'rgba(80,70,60,0.35)'; a.fillRect(x, row * rh, bl, 1); a.fillRect(x, row * rh, 1, rh);
        h.fillStyle = '#5c5c5c'; h.fillRect(x, row * rh, bl, 1); h.fillRect(x, row * rh, 1, rh);
      }
    }
    grain(a, w, w, rnd, 0.08, w * 30, 1.2);
  }, { normal: 1.5 });
}
// plain clay or concrete roof tiles in overlapping courses (rows run along u)
export function roofTiles(key, { base = '#56545a', vary = 0.12, tile = 1.0, size = 256, row = 0.16, width = 0.27 } = {}) {
  return painted('roof:' + key, size, ({ a, h, r, w, rnd }) => {
    const rows = Math.round(tile / row), rh = w / rows, cw = width / tile * w;
    a.fillStyle = base; a.fillRect(0, 0, w, w); r.fillStyle = '#c0c0c0'; r.fillRect(0, 0, w, w);
    for (let k = 0; k < rows; k++) {
      const off = k % 2 ? cw / 2 : 0;
      for (let x = -off; x < w; x += cw) {
        a.fillStyle = jitterColor(base, rnd, vary); a.fillRect(x + 0.5, k * rh, cw - 1, rh);
        const g = a.createLinearGradient(0, k * rh, 0, (k + 1) * rh); g.addColorStop(0, 'rgba(255,255,255,0.07)'); g.addColorStop(1, 'rgba(0,0,0,0.22)');
        a.fillStyle = g; a.fillRect(x + 0.5, k * rh, cw - 1, rh);
        const hg = h.createLinearGradient(0, k * rh, 0, (k + 1) * rh); hg.addColorStop(0, '#606060'); hg.addColorStop(1, '#b0b0b0');
        h.fillStyle = hg; h.fillRect(x + 0.5, k * rh, cw - 1, rh);
      }
    }
    grain(a, w, w, rnd, 0.07, w * 20, 1.2);
  }, { normal: 2.5 });
}
// standing-seam lead / zinc
export function leadRoof(key, { base = '#7f8c87', seam = 0.5, tile = 1.0, size = 128 } = {}) {
  return painted('lead:' + key, size, ({ a, h, r, w, rnd }) => {
    a.fillStyle = base; a.fillRect(0, 0, w, w); r.fillStyle = '#909090'; r.fillRect(0, 0, w, w);
    const n = Math.round(tile / seam);
    for (let k = 0; k < n; k++) { const x = k * w / n; a.fillStyle = 'rgba(255,255,255,0.12)'; a.fillRect(x, 0, 2, w); h.fillStyle = '#e0e0e0'; h.fillRect(x, 0, 2, w); }
    for (let i = 0; i < 40; i++) { a.fillStyle = `rgba(${rnd() < .5 ? '60,80,70' : '200,210,200'},${0.06 * rnd()})`; a.fillRect(0, rnd() * w, w, 1 + rnd() * 6); }
  }, { normal: 2 });
}
export function asphalt(key = 'asphalt', { base = '#4a4c50', tile = 4, size = 512 } = {}) {
  return painted('asphalt:' + key, size, ({ a, h, r, w, rnd }) => {
    a.fillStyle = base; a.fillRect(0, 0, w, w); r.fillStyle = '#e0e0e0'; r.fillRect(0, 0, w, w);
    for (let i = 0; i < w * 30; i++) { const v = 40 + rnd() * 90; a.fillStyle = rgb(v, v, v + 4); const s = 0.6 + rnd() * 1.4; a.fillRect(rnd() * w, rnd() * w, s, s); h.fillStyle = rgb(v + 60, v + 60, v + 60); h.fillRect(rnd() * w, rnd() * w, s, s); }
    for (let i = 0; i < 18; i++) { a.fillStyle = `rgba(20,20,22,${0.05 + rnd() * 0.07})`; a.beginPath(); a.ellipse(rnd() * w, rnd() * w, 20 + rnd() * 70, 10 + rnd() * 40, rnd() * 3, 0, 7); a.fill(); }
  }, { normal: 1.2 });
}
// concrete block paving (stretcher bond); plaza and car parks
export function blockPaving(key, { base = '#a9a196', vary = 0.08, tile = 2.4, size = 512, bw = 0.2, bh = 0.1, herring = false } = {}) {
  return painted('paving:' + key, size, ({ a, h, r, w, rnd }) => {
    a.fillStyle = '#6d675f'; a.fillRect(0, 0, w, w); h.fillStyle = '#404040'; h.fillRect(0, 0, w, w); r.fillStyle = '#d8d8d8'; r.fillRect(0, 0, w, w);
    const cw = bw / tile * w, ch = bh / tile * w;
    for (let y = 0, k = 0; y < w; y += ch, k++) for (let x = (k % 2) * cw / 2 - cw; x < w; x += cw) {
      a.fillStyle = jitterColor(base, rnd, vary); a.fillRect(x + 1, y + 1, cw - 2, ch - 2);
      h.fillStyle = '#b0b0b0'; h.fillRect(x + 1, y + 1, cw - 2, ch - 2);
    }
    grain(a, w, w, rnd, 0.06, w * 10);
  }, { normal: 1.5 });
}
// large slab paving (squares, plazas)
export function slabs(key, { base = '#bdb6a8', tile = 3.6, slab = 0.6, size = 512 } = {}) {
  return painted('slabs:' + key, size, ({ a, h, r, w, rnd }) => {
    a.fillStyle = '#8c857b'; a.fillRect(0, 0, w, w); h.fillStyle = '#505050'; h.fillRect(0, 0, w, w); r.fillStyle = '#c8c8c8'; r.fillRect(0, 0, w, w);
    const n = Math.round(tile / slab), c = w / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { a.fillStyle = jitterColor(base, rnd, 0.06); a.fillRect(i * c + 1, j * c + 1, c - 2, c - 2); h.fillStyle = '#a8a8a8'; h.fillRect(i * c + 1, j * c + 1, c - 2, c - 2); }
    grain(a, w, w, rnd, 0.07, w * 16);
  }, { normal: 1.2 });
}
export function gravel(key, { base = '#c2ad86', tile = 3, size = 512 } = {}) {
  return painted('gravel:' + key, size, ({ a, h, r, w, rnd }) => {
    a.fillStyle = base; a.fillRect(0, 0, w, w); r.fillStyle = '#f0f0f0'; r.fillRect(0, 0, w, w);
    for (let i = 0; i < w * 40; i++) { const s = 0.8 + rnd() * 2; a.fillStyle = jitterColor(base, rnd, 0.35); const x = rnd() * w, y = rnd() * w; a.fillRect(x, y, s, s); h.fillStyle = gray(120 + rnd() * 100); h.fillRect(x, y, s, s); }
  }, { normal: 1.0 });
}
export function grass(key = 'lawn', { base = '#5f8a3e', tile = 3, size = 512, dry = 0.15 } = {}) {
  return painted('grass:' + key, size, ({ a, h, r, w, rnd }) => {
    a.fillStyle = base; a.fillRect(0, 0, w, w); r.fillStyle = '#f2f2f2'; r.fillRect(0, 0, w, w);
    for (let i = 0; i < w * 50; i++) {
      const x = rnd() * w, y = rnd() * w, l = 2 + rnd() * 5;
      a.strokeStyle = rnd() < dry ? jitterColor('#9a9a52', rnd, 0.3) : jitterColor(base, rnd, 0.45);
      a.lineWidth = 0.8; a.beginPath(); a.moveTo(x, y); a.lineTo(x + (rnd() - 0.5) * 2, y - l); a.stroke();
    }
    for (let i = 0; i < 30; i++) { a.fillStyle = `rgba(${rnd() < 0.5 ? '40,60,20' : '140,160,70'},${0.05 * rnd()})`; a.beginPath(); a.arc(rnd() * w, rnd() * w, 10 + rnd() * 40, 0, 7); a.fill(); }
  }, { normal: 0.6 });
}
export function leafLitter(key = 'wood', { base = '#4f5a33', tile = 4, size = 512 } = {}) {
  return painted('litter:' + key, size, ({ a, h, r, w, rnd }) => {
    a.fillStyle = base; a.fillRect(0, 0, w, w); r.fillStyle = '#f0f0f0'; r.fillRect(0, 0, w, w);
    const leaf = ['#6b5a34', '#7a6a3c', '#556b2f', '#3f4f26', '#8a7444', '#5d4a2c'];
    for (let i = 0; i < w * 14; i++) { a.fillStyle = leaf[(rnd() * leaf.length) | 0]; a.globalAlpha = 0.5 + rnd() * 0.5; a.beginPath(); a.ellipse(rnd() * w, rnd() * w, 1 + rnd() * 3, 0.6 + rnd() * 1.5, rnd() * 3, 0, 7); a.fill(); }
    a.globalAlpha = 1;
  }, { normal: 0.8 });
}
export function concrete(key, { base = '#a7a59f', tile = 3, size = 256, board = 0 } = {}) {
  return painted('concrete:' + key, size, ({ a, h, r, w, rnd }) => {
    a.fillStyle = base; a.fillRect(0, 0, w, w); r.fillStyle = '#d8d8d8'; r.fillRect(0, 0, w, w);
    if (board) { const n = Math.round(tile / board); for (let k = 0; k < n; k++) { const y = k * w / n; a.fillStyle = `rgba(0,0,0,${0.04 + rnd() * 0.06})`; a.fillRect(0, y, w, w / n); a.fillStyle = 'rgba(0,0,0,0.12)'; a.fillRect(0, y, w, 1); h.fillStyle = '#707070'; h.fillRect(0, y, w, 1); } }
    grain(a, w, w, rnd, 0.1, w * 25, 1.2);
    for (let i = 0; i < 10; i++) { a.fillStyle = `rgba(60,60,50,${0.04 * rnd()})`; a.fillRect(rnd() * w, 0, 2 + rnd() * 8, w); }
  }, { normal: 1 });
}
export function timber(key, { base = '#5a4434', tile = 2, size = 256, board = 0.15 } = {}) {
  return painted('timber:' + key, size, ({ a, h, r, w, rnd }) => {
    a.fillStyle = base; a.fillRect(0, 0, w, w);
    const n = Math.round(tile / board);
    for (let k = 0; k < n; k++) { const x = k * w / n; a.fillStyle = jitterColor(base, rnd, 0.2); a.fillRect(x, 0, w / n - 1, w); a.fillStyle = 'rgba(0,0,0,0.35)'; a.fillRect(x + w / n - 1, 0, 1, w); h.fillStyle = '#404040'; h.fillRect(x + w / n - 1, 0, 1, w); }
    for (let i = 0; i < w * 3; i++) { a.fillStyle = `rgba(0,0,0,${0.05 * rnd()})`; a.fillRect(rnd() * w, rnd() * w, 1, 4 + rnd() * 20); }
  }, { normal: 1.5 });
}

// ---------------------------------------------------------------- material factory
const mats = new Map();
export function mat(key, make) { if (!mats.has(key)) mats.set(key, make()); return mats.get(key); }
export function std(key, { color = '#ffffff', tex: t = null, rough = 0.85, metal = 0, envI = 0.6, side, vertexColors = false, transparent = false, opacity = 1, emissive } = {}) {
  return mat(key, () => {
    const m = new T.MeshStandardMaterial({ color, roughness: rough, metalness: metal, envMapIntensity: envI, vertexColors, transparent, opacity });
    if (t) { m.map = t.map; if (t.normalMap) { m.normalMap = t.normalMap; m.normalScale = new T.Vector2(1, 1); } m.roughnessMap = t.roughnessMap; }
    if (side) m.side = side; if (emissive) m.emissive = new T.Color(emissive);
    return m;
  });
}
// window glass: dark, smooth, reflects the environment
export function glass(key = 'glass', { color = '#2c3a44', rough = 0.08, envI = 1.3 } = {}) {
  return std('glass:' + key, { color, rough, metal: 0.4, envI });
}
export const PALETTE = {
  foundersBrick: '#ad4c3b', foundersStone: '#dcd1b9', foundersRoof: '#4b5058', lead: '#7d8a85', mortar: '#d2c6af',
  buffBrick: '#c9a274', redBrick: '#9e4b38', orangeBrick: '#bd6b46', darkBrick: '#5a3a30'
};
