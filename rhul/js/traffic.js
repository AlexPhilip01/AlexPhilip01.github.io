// Buses and cars on Egham Hill (A30) and students walking the campus footpaths.
import { T, mulberry32, clamp, flatten } from './util.js';
import * as MT from './materials.js';

function mk(geo, m, x, y, z, p) { const o = new T.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; p.add(o); return o; }
function simpleCar(col) {
  const g = new T.Group(), paint = MT.std('traffic:' + col, { color: col, rough: 0.3, metal: 0.2, envI: 1 });
  mk(new T.BoxGeometry(1.85, 0.72, 4.4), paint, 0, 0.72, 0, g);
  mk(new T.BoxGeometry(1.66, 0.6, 2.3), MT.glass('traffic'), 0, 1.36, -0.2, g);
  mk(new T.BoxGeometry(1.68, 0.08, 2.3), paint, 0, 1.69, -0.2, g);
  const tyre = MT.std('car:tyre', { color: '#141416', rough: 0.85 });
  for (const [x, z] of [[-0.93, 1.4], [0.93, 1.4], [-0.93, -1.4], [0.93, -1.4]]) { const w = mk(new T.CylinderGeometry(0.37, 0.37, 0.28, 14), tyre, x, 0.37, z, g); w.rotation.z = Math.PI / 2; }
  return g;
}
function simpleBus(dest) {
  const g = new T.Group(), red = MT.std('bus:red', { color: '#c8102e', rough: 0.4, metal: 0.1 });
  mk(new T.BoxGeometry(2.5, 2.9, 11), red, 0, 1.9, 0, g);
  const gl = MT.glass('bus');
  mk(new T.BoxGeometry(2.52, 0.95, 10.4), gl, 0, 2.15, 0, g);
  mk(new T.BoxGeometry(2.3, 1.0, 0.06), gl, 0, 2.2, 5.52, g);
  const c = document.createElement('canvas'); c.width = 180; c.height = 36; const x = c.getContext('2d');
  x.fillStyle = '#111'; x.fillRect(0, 0, 180, 36); x.fillStyle = '#ffcf33'; x.font = '700 22px Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(dest, 90, 19);
  const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding;
  const d = new T.Mesh(new T.PlaneGeometry(1.8, 0.36), new T.MeshBasicMaterial({ map: t })); d.position.set(0, 3.0, 5.53); g.add(d);
  const tyre = MT.std('car:tyre', { color: '#141416', rough: 0.85 });
  for (const [xx, z] of [[-1.15, 3.6], [1.15, 3.6], [-1.15, -3.4], [1.15, -3.4]]) { const w = mk(new T.CylinderGeometry(0.5, 0.5, 0.3, 14), tyre, xx, 0.5, z, g); w.rotation.z = Math.PI / 2; }
  return g;
}

export function buildTraffic(data, scene) {
  const A = data.routes.A30.map(([x, z]) => new T.Vector3(x, 0, z));
  const curve = new T.CatmullRomCurve3(A, false, 'centripetal'), len = curve.getLength();
  // bus routes stopping at the university are listed by AccessAble (8, 441, 500, RH1-3); destinations shown are illustrative
  const vehicles = [];
  const add = (mesh, t, speed, dir) => { flatten(mesh); scene.add(mesh); vehicles.push({ mesh, t, speed, cur: speed, dir, lane: 2.0 }); };
  add(simpleBus('441'), 0.2, 9, 1); add(simpleBus('8'), 0.7, 9, -1);
  add(simpleCar('#111114'), 0.45, 12, 1); add(simpleCar('#e9e9ea'), 0.9, 12, -1); add(simpleCar('#2c4f7a'), 0.05, 11, -1);
  const tg = new T.Vector3();
  function update(dt, car) {
    for (const o of vehicles) {
      const p = curve.getPointAt(o.t); tg.copy(curve.getTangentAt(o.t)).multiplyScalar(o.dir);
      const ax = car.x - p.x, az = car.z - p.z, ahead = ax * tg.x + az * tg.z, side = Math.abs(ax * tg.z - az * tg.x);
      let target = o.speed; if (ahead > 0 && ahead < 16 && side < 4) target = ahead < 8 ? 0 : o.speed * (ahead - 8) / 8; // give way to the visitor
      o.cur += (target - o.cur) * Math.min(1, dt * 2);
      o.t += o.dir * o.cur * dt / len; if (o.t > 1) o.t = 0; if (o.t < 0) o.t = 1;
      const q = curve.getPointAt(clamp(o.t, 0, 1)); tg.copy(curve.getTangentAt(clamp(o.t, 0, 1))).multiplyScalar(o.dir);
      o.mesh.position.set(q.x - tg.z * o.lane, 0, q.z + tg.x * o.lane); // keep left
      o.mesh.rotation.y = Math.atan2(tg.x, tg.z);
    }
  }
  return { vehicles, update, curve };
}

// pedestrians: random walks along the footpath graph extracted from the campus map.
// All walkers share five instanced meshes (legs, torso, head, bag) whose matrices are updated each frame.
export function buildWalkers(data, scene, n) {
  const P = data.paths, adj = P.nodes.map(() => []);
  P.edges.forEach((e, i) => { if (e[2] > 3) { adj[e[0]].push(i); adj[e[1]].push(i); } });
  const rnd = mulberry32(99), walkers = [];
  const cols = ['#eb641e', '#202a30', '#0a6ec4', '#00b585', '#f17cb0', '#b4c4d0', '#7a2e2e', '#3c3c44', '#c9b28a'];
  const skin = ['#f1c9a5', '#d9a77f', '#a8714c', '#7a4b2e'], trousers = ['#1d1f26', '#2f3442', '#24324a', '#4a3f35'];
  const usable = P.edges.map((e, i) => i).filter(i => P.edges[i][2] > 8);
  const mat = new T.MeshStandardMaterial({ color: '#ffffff', roughness: 0.8 });
  const legG = new T.BoxGeometry(0.15, 0.85, 0.17); legG.translate(0, -0.43, 0);
  const parts = { legL: legG, legR: legG, torso: new T.BoxGeometry(0.46, 0.7, 0.28), head: new T.SphereGeometry(0.13, 10, 8), bag: new T.BoxGeometry(0.32, 0.42, 0.16) };
  const meshes = {};
  for (const [k, g] of Object.entries(parts)) { const m = new T.InstancedMesh(g, mat, Math.max(1, n)); m.castShadow = true; m.receiveShadow = false; m.frustumCulled = false; m.instanceMatrix.setUsage(T.DynamicDrawUsage); scene.add(m); meshes[k] = m; }
  for (let k = 0; k < n && usable.length; k++) {
    const col = new T.Color(cols[k % cols.length]), tr = new T.Color(trousers[k % 4]), sk = new T.Color(skin[(k * 7) % 4]);
    meshes.legL.setColorAt(k, tr); meshes.legR.setColorAt(k, tr); meshes.torso.setColorAt(k, col); meshes.head.setColorAt(k, sk);
    const hasBag = rnd() < 0.6; meshes.bag.setColorAt(k, new T.Color(['#111111', '#5a3e2b', '#1b4f9c'][k % 3]));
    const ei = usable[(rnd() * usable.length) | 0];
    walkers.push({ edge: ei, t: rnd(), dir: rnd() < 0.5 ? 1 : -1, sp: 1.1 + rnd() * 0.4, ph: rnd() * 6, off: (rnd() - 0.5) * 1.2, hasBag, x: 0, z: 0, h: 0 });
  }
  for (const m of Object.values(meshes)) { m.count = walkers.length; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
  const pointOn = (pts, s) => {
    let acc = 0;
    for (let i = 0; i < pts.length - 1; i++) { const l = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]); if (acc + l >= s) { const f = (s - acc) / (l || 1); return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f, Math.atan2(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1])]; } acc += l; }
    const a = pts[pts.length - 2], b = pts[pts.length - 1]; return [b[0], b[1], Math.atan2(b[0] - a[0], b[1] - a[1])];
  };
  const M = new T.Matrix4(), B = new T.Matrix4(), L = new T.Matrix4(), Q = new T.Quaternion(), E = new T.Euler(), V = new T.Vector3(), S1 = new T.Vector3(1, 1, 1), S0 = new T.Vector3(0, 0, 0);
  function update(dt) {
    walkers.forEach((w, k) => {
      const e = P.edges[w.edge], Ln = e[2];
      w.t += w.dir * w.sp * dt / Ln; w.ph += dt * w.sp * 4.4;
      if (w.t > 1 || w.t < 0) {
        const node = w.t > 1 ? e[1] : e[0], opts = adj[node].filter(i => i !== w.edge);
        const ni = opts.length ? opts[(Math.random() * opts.length) | 0] : w.edge;
        const ne = P.edges[ni]; w.edge = ni; w.dir = ne[0] === node ? 1 : -1; w.t = w.dir > 0 ? 0 : 1;
      }
      const Ed = P.edges[w.edge], [x, z, h] = pointOn(Ed[4], clamp(w.t, 0, 1) * Ed[2]), hh = w.dir > 0 ? h : h + Math.PI;
      w.x = x + Math.cos(hh) * w.off; w.z = z - Math.sin(hh) * w.off; w.h = hh;
      B.compose(V.set(w.x, 0, w.z), Q.setFromEuler(E.set(0, hh, 0)), S1);
      M.makeTranslation(0, 1.22, 0).premultiply(B); meshes.torso.setMatrixAt(k, M);
      M.makeTranslation(0, 1.72, 0).premultiply(B); meshes.head.setMatrixAt(k, M);
      if (w.hasBag) { M.makeTranslation(0, 1.25, -0.22).premultiply(B); } else M.compose(V.set(0, -10, 0), Q.identity(), S0);
      meshes.bag.setMatrixAt(k, M);
      const sw = Math.sin(w.ph) * 0.45;
      L.makeRotationX(sw).premultiply(M.makeTranslation(-0.1, 0.86, 0)).premultiply(B); meshes.legL.setMatrixAt(k, L);
      L.makeRotationX(-sw).premultiply(M.makeTranslation(0.1, 0.86, 0)).premultiply(B); meshes.legR.setMatrixAt(k, L);
    });
    for (const m of Object.values(meshes)) m.instanceMatrix.needsUpdate = true;
  }
  return { walkers, update };
}
