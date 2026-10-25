// The visitor's car (the original project's white coupé with AP badges) and its driving model.
import { T, clamp, wrapAngle, distToSegment } from './util.js';
import * as MT from './materials.js';
import { CLS } from './ground.js';

export function buildCar() {
  const root = new T.Group(); root.name = 'car'; root.rotation.order = 'YXZ';
  const body = new T.Group(); root.add(body);
  const paint = new T.MeshStandardMaterial({ color: '#f7f6f2', roughness: 0.28, metalness: 0.15, envMapIntensity: 1.1 });
  const glass = new T.MeshStandardMaterial({ color: '#1c2430', roughness: 0.05, metalness: 0.5, envMapIntensity: 1.4, transparent: true, opacity: 0.82 });
  const dark = MT.std('car:dark', { color: '#1d1a26', rough: 0.6 }), trim = MT.std('car:trim', { color: '#2e2a3a', rough: 0.5, metal: 0.3 });
  const rim = MT.std('car:rim', { color: '#565866', rough: 0.3, metal: 0.8 }), chrome = MT.std('car:chrome', { color: '#d7dae2', rough: 0.15, metal: 1.0, envI: 1.4 });
  const caliper = MT.std('car:caliper', { color: '#d4a83a', rough: 0.4, metal: 0.3 });
  const add = (geo, m, x, y, z, rx = 0, ry = 0, parent = body) => { const o = new T.Mesh(geo, m); o.position.set(x, y, z); o.rotation.x = rx; o.rotation.y = ry; o.castShadow = true; parent.add(o); return o; };
  const profile = (pts, width) => { const sh = new T.Shape(); pts.forEach(([z, y], i) => i ? sh.lineTo(z, y) : sh.moveTo(z, y)); const g = new T.ExtrudeGeometry(sh, { depth: width, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 2 }); g.translate(0, 0, -width / 2); g.rotateY(-Math.PI / 2); return g; };
  const bc = document.createElement('canvas'); bc.width = bc.height = 256; const bx = bc.getContext('2d');
  bx.fillStyle = '#22183a'; bx.beginPath(); bx.arc(128, 128, 124, 0, 7); bx.fill();
  bx.strokeStyle = '#d7dae2'; bx.lineWidth = 10; bx.beginPath(); bx.arc(128, 128, 112, 0, 7); bx.stroke();
  bx.strokeStyle = '#d4a83a'; bx.lineWidth = 8; bx.beginPath(); bx.arc(128, 128, 96, 0, 7); bx.stroke();
  bx.fillStyle = '#ffffff'; bx.textAlign = 'center'; bx.textBaseline = 'middle'; bx.font = '800 92px "Arial Black", sans-serif'; bx.fillText('AP', 128, 134);
  const bt = new T.CanvasTexture(bc); bt.encoding = T.sRGBEncoding; const badgeM = new T.MeshStandardMaterial({ map: bt, roughness: 0.3, metalness: 0.4 });
  const badge = (r, x, y, z, rx, ry, parent = body) => { const m = new T.Mesh(new T.CircleGeometry(r, 32), badgeM); m.position.set(x, y, z); m.rotation.set(rx, ry, 0); parent.add(m); };
  add(profile([[-2.3, 0.3], [2.3, 0.3], [2.32, 0.62], [2.18, 0.8], [1.0, 0.92], [-1.7, 0.95], [-2.28, 0.9], [-2.34, 0.6]], 1.86), paint, 0, 0, 0);
  const gl = add(profile([[-1.75, 0.9], [-0.95, 1.33], [0.42, 1.35], [1.15, 0.9]], 1.56), glass, 0, 0, 0); gl.renderOrder = 2; gl.castShadow = false;
  [[-0.4, '#2b2f3a', '#d9a77f', '#141414'], [0.4, '#6b2737', '#f1c9a5', '#6b4a2b']].forEach(([px, coat, skin, hair]) => {
    const p = new T.Group(); p.position.set(px, 0.62, -0.25); p.scale.setScalar(0.8); body.add(p);
    const t = new T.Mesh(new T.BoxGeometry(0.42, 0.44, 0.3), MT.std('coat' + coat, { color: coat })); t.position.y = 0.3; p.add(t);
    const h = new T.Mesh(new T.SphereGeometry(0.13, 10, 8), MT.std('skin' + skin, { color: skin, rough: 0.6 })); h.position.y = 0.64; p.add(h);
    const hr = new T.Mesh(new T.SphereGeometry(0.135, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), MT.std('hair' + hair, { color: hair })); hr.position.y = 0.66; p.add(hr);
  });
  add(profile([[-0.98, 1.31], [-0.82, 1.39], [0.3, 1.41], [0.45, 1.33]], 1.6), paint, 0, 0, 0);
  for (const x of [-0.95, 0.95]) { add(new T.BoxGeometry(0.04, 0.05, 2.7), trim, x, 0.93, -0.3); add(new T.BoxGeometry(0.06, 0.1, 2.3), trim, x, 0.34, 0); add(new T.BoxGeometry(0.22, 0.09, 0.14), paint, x * 0.98, 1.0, 0.82); }
  add(new T.BoxGeometry(1.96, 0.05, 0.34), trim, 0, 0.3, 2.22); add(new T.BoxGeometry(1.2, 0.14, 0.06), dark, 0, 0.5, 2.31);
  const headM = MT.std('car:head', { color: '#f4fbff', rough: 0.1, emissive: '#d8e6ff' }), tailM = MT.std('car:tail', { color: '#ff2a4a', rough: 0.3, emissive: '#7a0010' });
  for (const sd of [-1, 1]) { const l = new T.Mesh(new T.BoxGeometry(0.56, 0.05, 0.06), headM); l.position.set(sd * 0.62, 0.68, 2.27); l.rotation.y = sd * 0.12; body.add(l); }
  badge(0.11, 0, 0.83, 2.2, -1.2, 0);
  const tl = new T.Mesh(new T.BoxGeometry(1.76, 0.07, 0.06), tailM); tl.position.set(0, 0.8, -2.34); body.add(tl);
  add(new T.BoxGeometry(1.7, 0.05, 0.2), trim, 0, 0.97, -2.18); add(new T.BoxGeometry(1.6, 0.12, 0.24), trim, 0, 0.34, -2.24);
  const ex = new T.CylinderGeometry(0.07, 0.07, 0.16, 12); ex.rotateX(Math.PI / 2);
  for (const x of [-0.55, -0.4, 0.4, 0.55]) add(ex, chrome, x, 0.33, -2.38);
  badge(0.1, 0, 0.66, -2.37, 0, Math.PI);
  const tyre = new T.CylinderGeometry(0.42, 0.42, 0.34, 24); tyre.rotateZ(Math.PI / 2);
  const rimG = new T.CylinderGeometry(0.29, 0.29, 0.36, 20); rimG.rotateZ(Math.PI / 2);
  const tyreM = MT.std('car:tyre', { color: '#141416', rough: 0.85 });
  const wheels = [];
  for (const [x, z] of [[-0.9, 1.42], [0.9, 1.42], [-0.9, -1.42], [0.9, -1.42]]) {
    const hub = new T.Group(); hub.position.set(x, 0.42, z); body.add(hub);
    add(new T.BoxGeometry(0.1, 0.22, 0.16), caliper, x * 0.93, 0.5, z + 0.12);
    const w = add(tyre, tyreM, 0, 0, 0, 0, 0, hub); w.add(new T.Mesh(rimG, rim));
    for (let k = 0; k < 5; k++) { const sp = new T.Mesh(new T.BoxGeometry(0.04, 0.5, 0.07), chrome); sp.position.x = Math.sign(x) * 0.19; sp.rotation.x = k / 5 * Math.PI; w.add(sp); }
    badge(0.08, Math.sign(x) * 0.19, 0, 0, 0, Math.sign(x) * Math.PI / 2, w);
    wheels.push({ hub, w, front: z > 0 });
  }
  // soft contact shadow under the car (helps it sit on the ground when the sun is high)
  const cs = document.createElement('canvas'); cs.width = cs.height = 64; const cx = cs.getContext('2d'); const gr = cx.createRadialGradient(32, 32, 4, 32, 32, 32); gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); cx.fillStyle = gr; cx.fillRect(0, 0, 64, 64);
  const blob = new T.Mesh(new T.PlaneGeometry(2.6, 5.4), new T.MeshBasicMaterial({ map: new T.CanvasTexture(cs), transparent: true, depthWrite: false }));
  blob.rotation.x = -Math.PI / 2; blob.position.y = 0.02; root.add(blob);
  root.scale.setScalar(1.08);
  return { root, body, wheels };
}

// ------------------------------------------------------------------ driving model
// A kinematic bicycle model with frame-rate independent sub-stepping. Collisions sample the car's outline against
// the occupancy grid; on contact the car slides along the obstacle instead of stopping dead or passing through.
export class Driver {
  constructor({ grid, lc, a30, roadNodes, roadEdges }) {
    this.grid = grid; this.lc = lc; this.a30 = a30; this.roadNodes = roadNodes; this.roadEdges = roadEdges;
    this.x = 0; this.z = 0; this.h = 0; this.v = 0; this.steer = 0; this.roadRules = true; this.wheelRot = 0;
    this.len = 4.6; this.wid = 2.0; this.wheelbase = 2.85; this.lastHit = 0; this.autopilot = false; this.manoeuvring = false;
  }
  place(x, z, h) { this.x = x; this.z = z; this.h = h; this.v = 0; this.steer = 0; }
  onA30(x, z) { const A = this.a30; for (let i = 0; i < A.length - 1; i++) if (distToSegment(x, z, A[i][0], A[i][1], A[i + 1][0], A[i + 1][1]) < 9) return true; return false; }
  surface(x, z) { return this.lc.at(x, z); }
  // speed limit (m/s) where the car is: 40 mph on Egham Hill, 20 mph on campus roads, walking pace off-road in free-roam
  limit() {
    const c = this.surface(this.x, this.z);
    if (c === CLS.ROAD) return this._a30 ? 17.9 : 9.0;
    if (c === CLS.PAVING || c === CLS.PATH) return 4.5;
    return 4.0;
  }
  blockedAt(x, z, h) {
    const c = Math.cos(h), s = Math.sin(h), hl = this.len / 2, hw = this.wid / 2;
    // forward (sin h, cos h); right (-cos h, sin h)
    const pts = [[hl, hw], [hl, -hw], [-hl, hw], [-hl, -hw], [hl, 0], [-hl, 0], [0, hw], [0, -hw], [hl * 0.5, hw], [hl * 0.5, -hw], [-hl * 0.5, hw], [-hl * 0.5, -hw]];
    let n = 0;
    const rules = this.roadRules && !this.autopilot, ins = 0.75; // the body may overhang a kerb slightly
    for (const [f, r] of pts) {
      const px = x + s * f - c * r, pz = z + c * f + s * r;
      if (this.grid.isSolid(px, pz, this.autopilot && this.manoeuvring)) { n++; continue; }
      const qx = x + s * f * (1 - ins / hl) - c * r * (1 - ins / hw), qz = z + c * f * (1 - ins / hl) + s * r * (1 - ins / hw);
      if (rules) { const k = this.surface(qx, qz); if (k !== CLS.ROAD) n++; }
      else if (this.surface(qx, qz) === CLS.OUTSIDE && !this.autopilot) n++;
    }
    return n;
  }
  update(dt, input) {
    if (!(dt > 0)) return;
    if (!Number.isFinite(this.v)) this.v = 0;
    const steps = Math.max(1, Math.ceil(dt / (1 / 120))), h = dt / steps;
    this._a30 = this.onA30(this.x, this.z);
    const vmax = this.limit();
    for (let k = 0; k < steps; k++) this.step(h, input, vmax);
    this.wheelRot += this.v * dt / 0.45;
  }
  step(dt, { throttle = 0, brake = 0, steer = 0, handbrake = false }, vmax) {
    // longitudinal
    let a = 0;
    if (throttle > 0) a = this.v < -0.3 ? 9 * throttle : 4.2 * throttle * (1 - Math.max(0, this.v) / (vmax + 0.01));
    if (brake > 0) a = this.v > 0.3 ? -9.5 * brake : -3.0 * brake * (1 - Math.max(0, -this.v) / 5);
    const decel = (rate) => { const dv = Math.min(Math.abs(this.v), rate * dt); this.v -= Math.sign(this.v) * dv; };
    if (handbrake) decel(12); else if (!throttle && !brake) decel(1.6); else this.v += a * dt;
    if (this.v > vmax) this.v = Math.max(vmax, this.v - 6 * dt); // slow down smoothly when entering a slower surface
    this.v = clamp(this.v, -5, 25);
    // steering: rate-limited, with less lock at speed
    const maxLock = 0.55 * (1 - 0.65 * Math.min(1, Math.abs(this.v) / 18));
    const want = clamp(steer, -1, 1) * maxLock;
    this.steer += clamp(want - this.steer, -2.2 * dt, 2.2 * dt);
    // kinematic bicycle model about the rear axle (as a real car pivots), expressed for the car's centre
    const yaw = this.v / this.wheelbase * Math.tan(this.steer), ra = this.wheelbase / 2;
    const rx = this.x - Math.sin(this.h) * ra, rz = this.z - Math.cos(this.h) * ra;
    const nh = this.h + yaw * dt;
    const nrx = rx + Math.sin(this.h + yaw * dt / 2) * this.v * dt, nrz = rz + Math.cos(this.h + yaw * dt / 2) * this.v * dt;
    const nx = nrx + Math.sin(nh) * ra, nz = nrz + Math.cos(nh) * ra;
    const now = this.blockedAt(this.x, this.z, this.h);
    const tryMove = (x, z, hh) => { const b = this.blockedAt(x, z, hh); return b === 0 || b < now; };
    if (tryMove(nx, nz, nh)) { this.x = nx; this.z = nz; this.h = nh; return; }
    // slide: keep the component of motion along the obstacle
    if (tryMove(nx, this.z, nh)) { this.x = nx; this.h = nh; this.v *= 0.96; this.lastHit = performance.now(); return; }
    if (tryMove(this.x, nz, nh)) { this.z = nz; this.h = nh; this.v *= 0.96; this.lastHit = performance.now(); return; }
    if (tryMove(this.x, this.z, nh)) { this.h = nh; }
    this.v = -this.v * 0.15; this.lastHit = performance.now();
  }
  // move to the nearest point on the road network, facing along the road
  resetToRoad() {
    let best = null, bd = 1e9;
    for (const e of this.roadEdges) { const p = e[4]; for (let i = 0; i < p.length - 1; i++) { const d = distToSegment(this.x, this.z, p[i][0], p[i][1], p[i + 1][0], p[i + 1][1]); if (d < bd) { bd = d; best = [p[i], p[i + 1]]; } } }
    if (!best) return;
    const [a, b] = best, dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz || 1, t = clamp(((this.x - a[0]) * dx + (this.z - a[1]) * dz) / L2, 0, 1);
    let x = a[0] + dx * t, z = a[1] + dz * t, h = Math.atan2(dx, dz);
    if (Math.abs(wrapAngle(h - this.h)) > Math.PI / 2) h += Math.PI;
    const save = this.roadRules; this.roadRules = false;
    for (let k = 0; k < 20 && this.blockedAt(x, z, h); k++) { x += Math.sin(h) * 1.5; z += Math.cos(h) * 1.5; }
    this.roadRules = save;
    this.place(x, z, h);
  }
}
