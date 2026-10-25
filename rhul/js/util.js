// Shared helpers: maths, random numbers, polygons and geometry merging.
// THREE (r128) is loaded globally by rhul.html.
export const T = window.THREE;

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const wrapAngle = a => Math.atan2(Math.sin(a), Math.cos(a));
export const nextFrame = () => new Promise(r => requestAnimationFrame(() => r()));

export function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
// deterministic hash noise for a 2D point (0..1)
export function hash2(x, y) { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }

// ---------------------------------------------------------------- polygons (arrays of [x, z])
export function ringArea(o) { let a = 0; for (let i = 0; i < o.length; i++) { const p = o[i], q = o[(i + 1) % o.length]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; }
export function ringCentroid(o) {
  let a = 0, cx = 0, cz = 0;
  for (let i = 0; i < o.length; i++) { const p = o[i], q = o[(i + 1) % o.length], c = p[0] * q[1] - q[0] * p[1]; a += c; cx += (p[0] + q[0]) * c; cz += (p[1] + q[1]) * c; }
  a /= 2; return [cx / (6 * a), cz / (6 * a)];
}
export function pointInRing(x, z, o) {
  let inside = false;
  for (let i = 0, j = o.length - 1; i < o.length; j = i++) {
    const [xi, zi] = o[i], [xj, zj] = o[j];
    if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}
export function pointInPoly(x, z, outer, holes = []) { if (!pointInRing(x, z, outer)) return false; for (const h of holes) if (pointInRing(x, z, h)) return false; return true; }
export function ringBounds(o) { let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const [x, z] of o) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); } return { x0, x1, z0, z1 }; }
export function distToSegment(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1e-9;
  const t = clamp(((px - ax) * dx + (pz - az) * dz) / L2, 0, 1);
  return Math.hypot(px - ax - dx * t, pz - az - dz * t);
}
// minimum-area oriented box of a ring: centre, long side L, short side W, unit direction of long side
export function obb(o) {
  let best = null;
  for (let k = 0; k < o.length; k++) {
    const [ax, az] = o[k], [bx, bz] = o[(k + 1) % o.length], L = Math.hypot(bx - ax, bz - az); if (L < 0.3) continue;
    const ux = (bx - ax) / L, uz = (bz - az) / L; let a0 = 1e9, a1 = -1e9, b0 = 1e9, b1 = -1e9;
    for (const [x, z] of o) { const p = x * ux + z * uz, q = -x * uz + z * ux; a0 = Math.min(a0, p); a1 = Math.max(a1, p); b0 = Math.min(b0, q); b1 = Math.max(b1, q); }
    const area = (a1 - a0) * (b1 - b0); if (!best || area < best.area) best = { area, ux, uz, a0, a1, b0, b1 };
  }
  const { ux, uz, a0, a1, b0, b1 } = best, pm = (a0 + a1) / 2, qm = (b0 + b1) / 2;
  let L = a1 - a0, W = b1 - b0, dx = ux, dz = uz;
  if (W > L) { [L, W] = [W, L]; dx = -uz; dz = ux; }
  return { cx: pm * ux - qm * uz, cz: pm * uz + qm * ux, L, W, dx, dz, area: best.area };
}
// offset a closed ring outward (positive d) using mitred joins, clamped for sharp corners
export function offsetRing(o, d) {
  const ccw = ringArea(o) > 0, s = ccw ? 1 : -1, out = [];
  for (let i = 0; i < o.length; i++) {
    const p = o[(i + o.length - 1) % o.length], c = o[i], n = o[(i + 1) % o.length];
    let e1x = c[0] - p[0], e1z = c[1] - p[1], e2x = n[0] - c[0], e2z = n[1] - c[1];
    const l1 = Math.hypot(e1x, e1z) || 1, l2 = Math.hypot(e2x, e2z) || 1; e1x /= l1; e1z /= l1; e2x /= l2; e2z /= l2;
    // outward normals (for a CCW ring in x-right z-down space, outward is (dz, -dx) * s)
    const n1x = e1z * s, n1z = -e1x * s, n2x = e2z * s, n2z = -e2x * s;
    let mx = n1x + n2x, mz = n1z + n2z; const ml = Math.hypot(mx, mz) || 1; mx /= ml; mz /= ml;
    const cosHalf = mx * n1x + mz * n1z; const k = d / Math.max(0.35, cosHalf);
    out.push([c[0] + mx * k, c[1] + mz * k]);
  }
  return out;
}

// ---------------------------------------------------------------- geometry
// merge non-indexed (or indexed) BufferGeometries that share position/normal/uv (+ optional color)
export function mergeGeometries(list, { color = false } = {}) {
  const geos = list.filter(Boolean).map(g => g.index ? g.toNonIndexed() : g);
  let n = 0; for (const g of geos) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2), col = color ? new Float32Array(n * 3) : null;
  let o = 0;
  for (const g of geos) {
    const c = g.attributes.position.count;
    pos.set(g.attributes.position.array, o * 3);
    if (g.attributes.normal) nor.set(g.attributes.normal.array, o * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
    if (col) { if (g.attributes.color) col.set(g.attributes.color.array, o * 3); else col.fill(1, o * 3, (o + c) * 3); }
    o += c;
  }
  const m = new T.BufferGeometry();
  m.setAttribute('position', new T.BufferAttribute(pos, 3));
  m.setAttribute('normal', new T.BufferAttribute(nor, 3));
  m.setAttribute('uv', new T.BufferAttribute(uv, 2));
  if (col) m.setAttribute('color', new T.BufferAttribute(col, 3));
  m.computeBoundingSphere(); m.computeBoundingBox();
  return m;
}

// A growable triangle soup with world-space UVs, used to build walls, roofs and trims cheaply.
export class Soup {
  constructor() { this.p = []; this.n = []; this.u = []; this.c = null; }
  tri(a, b, c, ua, ub, uc, col) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    this.p.push(...a, ...b, ...c); this.n.push(nx, ny, nz, nx, ny, nz, nx, ny, nz); this.u.push(...ua, ...ub, ...uc);
    if (col) { (this.c || (this.c = [])).push(...col, ...col, ...col); }
  }
  // quad a-b-c-d (counter-clockwise seen from the front)
  quad(a, b, c, d, ua, ub, uc, ud, col) { this.tri(a, b, c, ua, ub, uc, col); this.tri(a, c, d, ua, uc, ud, col); }
  // vertical wall from (x0,z0) to (x1,z1), y from y0 to y1; outward normal on the right of the travel direction
  // u runs along the wall in metres (or in tiles when uScale given), v up in metres
  wall(x0, z0, x1, z1, y0, y1, uStart = 0, uScale = 1, vScale = 1, vStart = 0) {
    const L = Math.hypot(x1 - x0, z1 - z0);
    const u0 = uStart * uScale, u1 = (uStart + L) * uScale, v0 = vStart + y0 * vScale, v1 = vStart + y1 * vScale;
    this.quad([x0, y0, z0], [x0, y1, z0], [x1, y1, z1], [x1, y0, z1], [u0, v0], [u0, v1], [u1, v1], [u1, v0]);
    return L;
  }
  box(cx, cy, cz, sx, sy, sz, ry = 0, uvScale = 1) {
    const c = Math.cos(ry), s = Math.sin(ry), hx = sx / 2, hy = sy / 2, hz = sz / 2;
    const P = (x, y, z) => [cx + x * c + z * s, cy + y, cz - x * s + z * c];
    const v = [P(-hx, -hy, -hz), P(hx, -hy, -hz), P(hx, hy, -hz), P(-hx, hy, -hz), P(-hx, -hy, hz), P(hx, -hy, hz), P(hx, hy, hz), P(-hx, hy, hz)];
    const k = uvScale;
    this.quad(v[4], v[5], v[6], v[7], [0, 0], [sx * k, 0], [sx * k, sy * k], [0, sy * k]); // +z
    this.quad(v[1], v[0], v[3], v[2], [0, 0], [sx * k, 0], [sx * k, sy * k], [0, sy * k]); // -z
    this.quad(v[5], v[1], v[2], v[6], [0, 0], [sz * k, 0], [sz * k, sy * k], [0, sy * k]); // +x
    this.quad(v[0], v[4], v[7], v[3], [0, 0], [sz * k, 0], [sz * k, sy * k], [0, sy * k]); // -x
    this.quad(v[7], v[6], v[2], v[3], [0, 0], [sx * k, 0], [sx * k, sz * k], [0, sz * k]); // top
    this.quad(v[0], v[1], v[5], v[4], [0, 0], [sx * k, 0], [sx * k, sz * k], [0, sz * k]); // bottom
  }
  // horizontal polygon (ring of [x,z]) at height y, facing up (or down)
  cap(ring, y, holes = [], down = false, uvScale = 1) {
    const shape = new T.Shape(ring.map(([x, z]) => new T.Vector2(x, z)));
    for (const h of holes) shape.holes.push(new T.Path(h.map(([x, z]) => new T.Vector2(x, z))));
    const pts = shape.extractPoints(1); let contour = pts.shape, hs = pts.holes;
    if (T.ShapeUtils.isClockWise(contour)) contour = contour.reverse();
    hs = hs.map(h => T.ShapeUtils.isClockWise(h) ? h : h.reverse());
    const faces = T.ShapeUtils.triangulateShape(contour, hs);
    const all = contour.concat(...hs);
    for (const f of faces) {
      const [a, b, c] = f.map(i => all[i]);
      const A = [a.x, y, a.y], B = [b.x, y, b.y], C = [c.x, y, c.y];
      const ua = [a.x * uvScale, a.y * uvScale], ub = [b.x * uvScale, b.y * uvScale], uc = [c.x * uvScale, c.y * uvScale];
      // triangulateShape returns CCW in (x, y=z) space which faces -y in our xz-down frame; flip for up
      if (down) this.tri(A, B, C, ua, ub, uc); else this.tri(A, C, B, ua, uc, ub);
    }
  }
  get empty() { return this.p.length === 0; }
  geometry() {
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new T.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new T.Float32BufferAttribute(this.u, 2));
    if (this.c) g.setAttribute('color', new T.Float32BufferAttribute(this.c, 3));
    g.computeBoundingSphere(); g.computeBoundingBox();
    return g;
  }
}

// Instanced mesh from a list of transforms {x,y,z, rx,ry,rz, sx,sy,sz, color}
const _o = new T.Object3D();
export function instanced(geo, mat, list, { shadow = true, receive = true, color = false } = {}) {
  const im = new T.InstancedMesh(geo, mat, Math.max(1, list.length));
  list.forEach((it, i) => {
    _o.position.set(it.x, it.y || 0, it.z);
    _o.rotation.set(it.rx || 0, it.ry || 0, it.rz || 0, 'YXZ');
    _o.scale.set(it.sx || it.s || 1, it.sy || it.s || 1, it.sz || it.s || 1);
    _o.updateMatrix(); im.setMatrixAt(i, _o.matrix);
    if (color && it.color) im.setColorAt(i, it.color);
  });
  im.count = list.length; im.castShadow = shadow; im.receiveShadow = receive;
  im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
  // r128 culls an InstancedMesh with its base geometry's sphere; give it one that encloses every instance
  if (!geo.boundingSphere) geo.computeBoundingSphere();
  const r0 = geo.boundingSphere.radius + geo.boundingSphere.center.length();
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, z0 = 1e9, z1 = -1e9, smax = 0;
  for (const it of list) { const y = it.y || 0; x0 = Math.min(x0, it.x); x1 = Math.max(x1, it.x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); z0 = Math.min(z0, it.z); z1 = Math.max(z1, it.z); smax = Math.max(smax, it.sx || it.s || 1, it.sy || it.s || 1, it.sz || it.s || 1); }
  if (list.length) {
    const g2 = new T.BufferGeometry(); // shares attribute buffers; only the bounds differ
    for (const k in geo.attributes) g2.setAttribute(k, geo.attributes[k]);
    if (geo.index) g2.setIndex(geo.index);
    g2.groups = geo.groups;
    g2.boundingSphere = new T.Sphere(new T.Vector3((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), Math.hypot(x1 - x0, y1 - y0, z1 - z0) / 2 + r0 * smax);
    im.geometry = g2;
  }
  return im;
}

// compute a correct bounding sphere for an InstancedMesh (r128 uses the base geometry's sphere, which breaks culling)
export function fitInstancedBounds(im) {
  const box = new T.Box3(), b = new T.Box3(), m = new T.Matrix4();
  if (!im.geometry.boundingBox) im.geometry.computeBoundingBox();
  for (let i = 0; i < im.count; i++) { im.getMatrixAt(i, m); b.copy(im.geometry.boundingBox).applyMatrix4(m); box.union(b); }
  const sphere = new T.Sphere(); box.getBoundingSphere(sphere);
  im.geometry = im.geometry.clone(); im.geometry.boundingSphere = sphere; im.geometry.boundingBox = box;
  return im;
}

export function lathe(profile, segs = 16) { return new T.LatheGeometry(profile.map(([r, y]) => new T.Vector2(r, y)), segs); }

export function disposeTree(o) { o.traverse(c => { if (c.geometry) c.geometry.dispose(); const m = c.material; if (m) (Array.isArray(m) ? m : [m]).forEach(x => x.dispose()); }); }

// Merge every static, single-material mesh under `group` into one mesh per material (baked into the group's space).
// Instanced meshes and anything `keep` returns true for are left alone. Cuts draw calls for detailed static props.
export function flatten(group, { keep = () => false } = {}) {
  group.updateMatrixWorld(true);
  const inv = new T.Matrix4().copy(group.matrixWorld).invert();
  const buckets = new Map(), remove = [];
  const kept = new Set();
  group.traverse(o => { if (o !== group && keep(o)) o.traverse(c => kept.add(c)); });
  group.traverse(o => {
    if (!o.isMesh || o.isInstancedMesh || kept.has(o) || Array.isArray(o.material) || o.material.transparent) return;
    const m = new T.Matrix4().multiplyMatrices(inv, o.matrixWorld);
    const g = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()); g.applyMatrix4(m);
    const key = o.material.uuid + ':' + (o.castShadow ? 1 : 0);
    if (!buckets.has(key)) buckets.set(key, { mat: o.material, cast: o.castShadow, list: [] });
    buckets.get(key).list.push(g); remove.push(o);
  });
  for (const o of remove) o.parent.remove(o);
  for (const b of buckets.values()) { const mesh = new T.Mesh(mergeGeometries(b.list), b.mat); mesh.castShadow = b.cast; mesh.receiveShadow = true; mesh.name = 'flat:' + (b.mat.name || ''); group.add(mesh); }
  return group;
}
