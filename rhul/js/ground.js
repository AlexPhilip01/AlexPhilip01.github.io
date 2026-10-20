// Ground: one large plane whose shader blends tiled surface textures by the campus land-cover map
// (traced from the campus map; see tools/build_data.py), plus kerbs along every road edge and the road markings.
import { T, Soup, instanced, mulberry32 } from './util.js';
import * as MT from './materials.js';

export const CLS = { OUTSIDE: 0, LAWN: 1, WOOD: 2, ROAD: 3, PAVING: 5, PATH: 7 };

// land-cover lookups in scene metres
export function makeLandcover(data, img) {
  const G = data.grid, w = G.w, h = G.h;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
  const px = ctx.getImageData(0, 0, w, h).data, cls = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) cls[i] = px[i * 4];
  const det = G.a * G.e - G.b * G.d;
  const inv = { a: G.e / det, b: -G.b / det, d: -G.d / det, e: G.a / det };
  const toGrid = (x, z) => { const X = x - G.c, Z = z - G.f; return [inv.a * X + inv.b * Z, inv.d * X + inv.e * Z]; };
  function at(x, z) {
    const [gx, gy] = toGrid(x, z), ix = Math.round(gx), iy = Math.round(gy);
    if (ix < 0 || iy < 0 || ix >= w || iy >= h) return CLS.OUTSIDE;
    return cls[iy * w + ix];
  }
  return { cls, w, h, toGrid, at, inv, G };
}

function splatTextures(lc) {
  const { w, h, cls } = lc, n = w * h;
  const a = new Uint8Array(n * 4), b = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) {
    const c = cls[i], o = i * 4;
    a[o] = c === 3 ? 255 : 0; a[o + 1] = c === 7 ? 255 : 0; a[o + 2] = c === 5 ? 255 : 0; a[o + 3] = c === 2 ? 255 : 0;
    b[o] = c === 0 ? 255 : 0; b[o + 3] = 255;
  }
  // separable 3-tap box blur, twice (close to a Gaussian of about one cell, as used for the kerb contours)
  const tmp = new Uint8Array(n * 4);
  const blur = (src) => {
    for (let pass = 0; pass < 2; pass++) {
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) for (let k = 0; k < 4; k++) {
        const i = (y * w + x) * 4 + k, l = x > 0 ? i - 4 : i, r = x < w - 1 ? i + 4 : i;
        tmp[i] = (src[l] + src[i] + src[r]) / 3;
      }
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) for (let k = 0; k < 4; k++) {
        const i = (y * w + x) * 4 + k, u = y > 0 ? i - w * 4 : i, d = y < h - 1 ? i + w * 4 : i;
        src[i] = (tmp[u] + tmp[i] + tmp[d]) / 3;
      }
    }
  };
  blur(a); blur(b);
  const mk = arr => { const t = new T.DataTexture(arr, w, h, T.RGBAFormat); t.magFilter = T.LinearFilter; t.minFilter = T.LinearFilter; t.flipY = false; t.needsUpdate = true; return t; };
  return [mk(a), mk(b)];
}

export function buildGround(data, lc, renderer) {
  const group = new T.Group(); group.name = 'ground';
  const [s1, s2] = splatTextures(lc);
  const det = { grass: MT.grass('lawn', { base: '#5b763f', tile: 3, dry: 0.22 }), litter: MT.leafLitter('wood', { tile: 4 }), asphalt: MT.asphalt('road', { base: '#4b4d52', tile: 4 }), paving: MT.blockPaving('plaza', { base: '#b2a795', tile: 2.4 }), gravel: MT.gravel('path', { base: '#bfae8c', tile: 3 }) };
  const noise = (() => { // low-frequency colour variation to hide texture repetition
    const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'), r = mulberry32(5);
    x.fillStyle = '#808080'; x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 260; i++) { const v = (r() * 255) | 0; x.fillStyle = `rgba(${v},${v},${v},0.16)`; x.beginPath(); x.arc(r() * 256, r() * 256, 8 + r() * 40, 0, 7); x.fill(); }
    const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; return t;
  })();
  for (const k in det) { det[k].map.encoding = T.LinearEncoding; det[k].map.needsUpdate = true; }
  const m = new T.MeshStandardMaterial({ color: '#ffffff', roughness: 1, metalness: 0, envMapIntensity: 0.35 });
  const G = lc.G, inv = lc.inv;
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, {
      tSplat: { value: s1 }, tSplat2: { value: s2 }, tGrass: { value: det.grass.map }, tLitter: { value: det.litter.map }, tAsphalt: { value: det.asphalt.map },
      tPaving: { value: det.paving.map }, tGravel: { value: det.gravel.map }, tNoise: { value: noise },
      gInv: { value: new T.Vector4(inv.a, inv.b, inv.d, inv.e) }, gOff: { value: new T.Vector4(G.c, G.f, G.w, G.h) }
    });
    sh.vertexShader = 'varying vec3 vWPos;\n' + sh.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n  vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = `varying vec3 vWPos;
uniform sampler2D tSplat, tSplat2, tGrass, tLitter, tAsphalt, tPaving, tGravel, tNoise;
uniform vec4 gInv, gOff;
float roughOut;
vec3 tex(sampler2D t, vec2 uv) { return sRGBToLinear(texture2D(t, uv)).rgb; }
` + sh.fragmentShader
      .replace('#include <map_fragment>', `
  vec2 rel = vWPos.xz - gOff.xy;
  vec2 g = vec2(gInv.x * rel.x + gInv.y * rel.y, gInv.z * rel.x + gInv.w * rel.y);
  vec2 suv = (g + 0.5) / gOff.zw;
  vec4 s1 = texture2D(tSplat, suv);
  float outside = texture2D(tSplat2, suv).r;
  if (suv.x < 0.0 || suv.y < 0.0 || suv.x > 1.0 || suv.y > 1.0) { s1 = vec4(0.0); outside = 1.0; }
  vec2 w = vWPos.xz;
  float nz = texture2D(tNoise, w / 90.0).r, nz2 = texture2D(tNoise, w / 23.0 + 0.37).r;
  vec3 grassC = mix(tex(tGrass, w / 3.0), tex(tGrass, w / 7.3 + 0.5), 0.35) * (0.8 + 0.3 * nz);
  grassC = mix(grassC, vec3(dot(grassC, vec3(0.3, 0.59, 0.11))), 0.12);
  vec3 outsideC = mix(grassC * vec3(0.92, 0.95, 0.8), tex(tLitter, w / 9.0) * 0.85, 0.35 + 0.35 * smoothstep(0.35, 0.7, nz)) * (0.85 + 0.2 * nz2);
  vec3 woodC = mix(tex(tLitter, w / 4.0), grassC * 0.7, 0.25 + 0.3 * nz2);
  vec3 roadC = tex(tAsphalt, w / 4.0) * (0.88 + 0.24 * nz2);
  vec3 paveC = tex(tPaving, w / 2.4) * (0.9 + 0.15 * nz);
  vec3 pathC = tex(tGravel, w / 3.0) * (0.9 + 0.15 * nz2);
  float wOut = smoothstep(0.3, 0.7, outside), wWood = smoothstep(0.25, 0.75, s1.a), wPave = smoothstep(0.38, 0.62, s1.b), wPath = smoothstep(0.38, 0.62, s1.g), wRoad = smoothstep(0.44, 0.56, s1.r);
  vec3 col = grassC; roughOut = 1.0;
  col = mix(col, outsideC, wOut);
  col = mix(col, woodC, wWood);
  col = mix(col, paveC, wPave); roughOut = mix(roughOut, 0.85, wPave);
  col = mix(col, pathC, wPath); roughOut = mix(roughOut, 0.95, wPath);
  // a darker, wetter-looking strip along the road edge (gutter)
  float gutter = smoothstep(0.35, 0.5, s1.r) * (1.0 - smoothstep(0.5, 0.62, s1.r));
  col = mix(col, roadC, wRoad); roughOut = mix(roughOut, 0.82, wRoad);
  col *= 1.0 - 0.18 * gutter;
  diffuseColor.rgb *= col;`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n  roughnessFactor = roughOut;');
  };
  m.customProgramCacheKey = () => 'rhul-ground-v1';
  const geo = new T.PlaneGeometry(4000, 4000, 1, 1); geo.rotateX(-Math.PI / 2);
  const ground = new T.Mesh(geo, m); ground.receiveShadow = true; ground.name = 'ground:terrain';
  group.add(ground);
  void renderer;
  return { group, ground };
}

// kerbs along road edges: the road lies to the left of every polyline, the kerb to its right
export function buildKerbs(data) {
  const s = new Soup(), H = 0.12, Wd = 0.26;
  for (const line of data.road_edges) {
    for (let i = 0; i < line.length - 1; i++) {
      const [x0, z0] = line[i], [x1, z1] = line[i + 1], L = Math.hypot(x1 - x0, z1 - z0); if (L < 0.05) continue;
      const rx = (z1 - z0) / L, rz = -(x1 - x0) / L; // right-hand normal in the x/z frame
      // vertical face toward the road, then the top
      s.quad([x0, 0, z0], [x1, 0, z1], [x1, H, z1], [x0, H, z0], [0, 0], [L, 0], [L, H], [0, H]);
      s.quad([x0, H, z0], [x1, H, z1], [x1 + rx * Wd, H, z1 + rz * Wd], [x0 + rx * Wd, H, z0 + rz * Wd], [0, 0], [L, 0], [L, Wd], [0, Wd]);
    }
  }
  const mat = MT.std('kerb', { tex: MT.concrete('kerb', { base: '#b9b6ae', tile: 2 }), rough: 0.85 });
  const mesh = new T.Mesh(s.geometry(), mat); mesh.receiveShadow = true; mesh.castShadow = false; mesh.name = 'ground:kerbs';
  return mesh;
}

// road markings placed in the original project from the campus video (centre dashes, double yellow lines, zebra crossings)
export function buildMarkings(data) {
  const g = new T.Group(); g.name = 'road markings';
  const F = data.furniture;
  const white = MT.std('paint:white', { color: '#e9e8e2', rough: 0.6 }), yellow = MT.std('paint:yellow', { color: '#e0b92a', rough: 0.6 });
  const flat = new T.BoxGeometry(1, 0.02, 1);
  const dashes = F.dashes.map(([x, z, a]) => ({ x, y: 0.012, z, ry: a, sx: 0.12, sz: 2.4 }));
  const dm = instanced(flat, white, dashes, { shadow: false }); g.add(dm);
  const yl = [];
  for (const l of F.yellow) for (let k = 0; k + 3 < l.length; k += 2) {
    const ax = l[k], az = l[k + 1], bx = l[k + 2], bz = l[k + 3], L = Math.hypot(bx - ax, bz - az); if (L < 0.05) continue;
    const ry = Math.atan2(bx - ax, bz - az), nx = (bz - az) / L, nz = -(bx - ax) / L;
    for (const o of [-0.15, 0.15]) yl.push({ x: (ax + bx) / 2 + nx * o, y: 0.013, z: (az + bz) / 2 + nz * o, sx: 0.1, sz: L + 0.04, ry });
  }
  g.add(instanced(flat, yellow, yl, { shadow: false }));
  const stripes = [], posts = [], signs = [];
  for (const [x, z, a] of F.zebras) {
    const nx = Math.cos(a), nz = -Math.sin(a);
    for (let k = -3; k <= 3; k++) stripes.push({ x: x + nx * k * 1.0, y: 0.014, z: z + nz * k * 1.0, sx: 0.5, sz: 2.6, ry: a });
    for (const sd of [-1, 1]) { const px = x + nx * sd * 5.1 - Math.sin(a) * sd * 2, pz = z + nz * sd * 5.1 - Math.cos(a) * sd * 2; posts.push({ x: px, y: 1.3, z: pz }); signs.push({ x: px, y: 2.35, z: pz, ry: a + (sd > 0 ? Math.PI : 0) }); }
  }
  g.add(instanced(flat, white, stripes, { shadow: false }));
  g.add(instanced(new T.CylinderGeometry(0.045, 0.045, 2.6, 6), MT.std('post:grey', { color: '#8d9399', rough: 0.5, metal: 0.6 }), posts));
  const st = document.createElement('canvas'); st.width = 64; st.height = 80; const x = st.getContext('2d');
  x.fillStyle = '#f4c419'; x.fillRect(0, 0, 64, 80); x.fillStyle = '#fff'; x.beginPath(); x.moveTo(32, 6); x.lineTo(60, 54); x.lineTo(4, 54); x.closePath(); x.fill(); x.strokeStyle = '#d0202a'; x.lineWidth = 5; x.stroke();
  x.fillStyle = '#111'; x.fillRect(29, 24, 6, 14); x.beginPath(); x.arc(32, 20, 4, 0, 7); x.fill(); x.fillRect(25, 38, 4, 10); x.fillRect(35, 38, 4, 10);
  x.fillStyle = '#fff'; x.fillRect(6, 60, 52, 16); x.fillStyle = '#111'; x.font = '700 8px Arial'; x.textAlign = 'center'; x.fillText('Humped', 32, 67); x.fillText('crossing', 32, 75);
  const stex = new T.CanvasTexture(st); stex.encoding = T.sRGBEncoding;
  g.add(instanced(new T.PlaneGeometry(0.7, 0.88), new T.MeshStandardMaterial({ map: stex, side: T.DoubleSide, roughness: 0.6 }), signs, { shadow: false }));
  return g;
}
