// Shortest routes over the road graph extracted from the campus map (car parks are part of the network).
import { distToSegment, clamp } from './util.js';

export class Router {
  constructor(roads) {
    this.nodes = roads.nodes; this.edges = roads.edges;
    this.adj = this.nodes.map(() => []);
    this.edges.forEach((e, i) => { this.adj[e[0]].push(i); this.adj[e[1]].push(i); });
  }
  // closest point on any road edge: { edge, seg, t, x, z, d }
  nearest(x, z) {
    let best = null;
    this.edges.forEach((e, i) => {
      const p = e[4];
      for (let k = 0; k < p.length - 1; k++) {
        const d = distToSegment(x, z, p[k][0], p[k][1], p[k + 1][0], p[k + 1][1]);
        if (!best || d < best.d) {
          const dx = p[k + 1][0] - p[k][0], dz = p[k + 1][1] - p[k][1], L2 = dx * dx + dz * dz || 1, t = clamp(((x - p[k][0]) * dx + (z - p[k][1]) * dz) / L2, 0, 1);
          best = { edge: i, seg: k, t, x: p[k][0] + dx * t, z: p[k][1] + dz * t, d };
        }
      }
    });
    return best;
  }
  // nearest road point that has `clear` metres of space round it (no hard obstacles), for stopping and parking
  nearestClear(x, z, grid, clear = 4) {
    const cand = [];
    this.edges.forEach(e => { for (const p of e[4]) cand.push([Math.hypot(p[0] - x, p[1] - z), p[0], p[1]]); });
    cand.sort((a, b) => a[0] - b[0]);
    const hardNear = (px, pz) => { for (let a = 0; a < 12; a++) for (const r of [clear * 0.5, clear]) { const qx = px + Math.cos(a * Math.PI / 6) * r, qz = pz + Math.sin(a * Math.PI / 6) * r; const k = grid.idx(qx, qz); if (k < 0 || grid.solid[k] === 1) return true; } return false; };
    for (let i = 0; i < Math.min(cand.length, 400); i++) if (!hardNear(cand[i][1], cand[i][2])) return [cand[i][1], cand[i][2]];
    return cand.length ? [cand[0][1], cand[0][2]] : [x, z];
  }
  // polyline from a point on an edge to one end of the edge
  partial(at, toEnd) {
    const p = this.edges[at.edge][4], out = [[at.x, at.z]];
    if (toEnd === 1) for (let k = at.seg + 1; k < p.length; k++) out.push(p[k]);
    else for (let k = at.seg; k >= 0; k--) out.push(p[k]);
    return out;
  }
  // route between two arbitrary points, snapped to the nearest roads
  // heading (optional): the car's current heading; starting off in the opposite direction costs a U-turn penalty
  route(ax, az, bx, bz, heading = null) {
    const A = this.nearest(ax, az), B = this.nearest(bx, bz);
    if (!A || !B) return null;
    if (A.edge === B.edge) { // same edge: walk along it
      const p = this.edges[A.edge][4], fwd = A.seg < B.seg || (A.seg === B.seg && A.t <= B.t), out = [[A.x, A.z]];
      if (fwd) for (let k = A.seg + 1; k <= B.seg; k++) out.push(p[k]); else for (let k = A.seg; k > B.seg; k--) out.push(p[k]);
      out.push([B.x, B.z]); return { pts: out, start: A, end: B };
    }
    const ea = this.edges[A.edge], eb = this.edges[B.edge];
    const N = this.nodes.length, dist = new Float64Array(N).fill(Infinity), prev = new Int32Array(N).fill(-1), prevE = new Int32Array(N).fill(-1);
    const len = poly => { let s = 0; for (let k = 0; k < poly.length - 1; k++) s += Math.hypot(poly[k + 1][0] - poly[k][0], poly[k + 1][1] - poly[k][1]); return s; };
    const toB = this.partial(A, 1), toA = this.partial(A, 0);
    let penB = 0, penA = 0;
    if (heading !== null) {
      const p = ea[4], q0 = p[A.seg], q1 = p[A.seg + 1], dx = q1[0] - q0[0], dz = q1[1] - q0[1], fwd = Math.sin(heading) * dx + Math.cos(heading) * dz;
      const deg = n => this.adj[n].length;
      // turning round on a narrow campus road is slow: prefer to drive on, unless the road ahead is a dead end
      if (fwd >= 0) { if (deg(ea[1]) > 1) penA = 60; } else { if (deg(ea[0]) > 1) penB = 60; }
    }
    dist[ea[1]] = Math.min(dist[ea[1]], len(toB) + penB); dist[ea[0]] = Math.min(dist[ea[0]], len(toA) + penA);
    const open = new Set([ea[0], ea[1]]);
    while (open.size) {
      let u = -1, du = Infinity; for (const n of open) if (dist[n] < du) { du = dist[n]; u = n; }
      open.delete(u);
      for (const ei of this.adj[u]) {
        const e = this.edges[ei], v = e[0] === u ? e[1] : e[0], nd = du + e[2];
        if (nd < dist[v]) { dist[v] = nd; prev[v] = u; prevE[v] = ei; open.add(v); }
      }
    }
    const endA = this.partial(B, 0), endB = this.partial(B, 1); // from B to edge start / end
    const c0 = dist[eb[0]] + len(endA), c1 = dist[eb[1]] + len(endB);
    if (!isFinite(c0) && !isFinite(c1)) return null;
    const goal = c0 <= c1 ? eb[0] : eb[1], tail = (c0 <= c1 ? endA : endB).slice().reverse();
    // walk back from the goal node
    const chain = []; let n = goal;
    while (prev[n] !== -1) { chain.push([prevE[n], prev[n], n]); n = prev[n]; }
    chain.reverse();
    const out = (n === ea[1] ? toB : toA).slice();
    for (const [ei, from] of chain) { const p = this.edges[ei][4]; const seq = this.edges[ei][0] === from ? p : p.slice().reverse(); for (let k = 1; k < seq.length; k++) out.push(seq[k]); }
    for (let k = 1; k < tail.length; k++) out.push(tail[k]);
    return { pts: removeSpurs(dedupe(out)), start: A, end: B };
  }
}
// cut out-and-back excursions (the path running up a spur and straight back), which no driver would take
export function removeSpurs(p) {
  let pts = p.slice(), changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < pts.length - 2 && !changed; i++) {
      let acc = 0;
      for (let j = i + 2; j < pts.length && acc < 80; j++) {
        acc += Math.hypot(pts[j][0] - pts[j - 1][0], pts[j][1] - pts[j - 1][1]);
        if (acc > 4 && Math.hypot(pts[j][0] - pts[i][0], pts[j][1] - pts[i][1]) < 1.6) { pts.splice(i + 1, j - i); changed = true; break; }
      }
    }
  }
  return pts;
}
function dedupe(p) { const out = [p[0]]; for (let k = 1; k < p.length; k++) if (Math.hypot(p[k][0] - out[out.length - 1][0], p[k][1] - out[out.length - 1][1]) > 0.5) out.push(p[k]); return out; }

// smooth a polyline with Chaikin corner cutting (keeps the route on the road while rounding junction corners)
export function smoothPath(pts, iters = 2) {
  let p = pts;
  for (let it = 0; it < iters; it++) {
    const q = [p[0]];
    for (let k = 0; k < p.length - 1; k++) { const [ax, az] = p[k], [bx, bz] = p[k + 1]; q.push([ax * 0.75 + bx * 0.25, az * 0.75 + bz * 0.25], [ax * 0.25 + bx * 0.75, az * 0.25 + bz * 0.75]); }
    q.push(p[p.length - 1]); p = q;
  }
  // resample at ~2 m
  const out = [p[0]]; let carry = 0;
  for (let k = 0; k < p.length - 1; k++) {
    const [ax, az] = p[k], [bx, bz] = p[k + 1], L = Math.hypot(bx - ax, bz - az);
    let s = 2 - carry; while (s < L) { out.push([ax + (bx - ax) * s / L, az + (bz - az) * s / L]); s += 2; } carry = L - (s - 2);
  }
  out.push(p[p.length - 1]);
  return out;
}

// pure-pursuit follower: returns steering / throttle / brake to follow a path, plus progress.
// Speed is limited by bends ahead (lateral acceleration) and by the distance needed to slow for them; the car turns round
// with a multi-point turn when the path starts behind it, and backs out if it gets wedged.
export class Follower {
  constructor(pts) {
    this.pts = pts; this.i = 0; this.done = false; this.total = 0; this.cum = [0];
    for (let k = 1; k < pts.length; k++) { this.total += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]); this.cum.push(this.total); }
    // curvature-limited speed at each point (lateral acceleration 2.6 m/s^2), then a backward pass for braking (2.5 m/s^2)
    const n = pts.length, vcap = new Float32Array(n).fill(30);
    for (let k = 2; k < n - 2; k++) {
      const a = Math.atan2(pts[k][0] - pts[k - 2][0], pts[k][1] - pts[k - 2][1]), b = Math.atan2(pts[k + 2][0] - pts[k][0], pts[k + 2][1] - pts[k][1]);
      const ang = Math.abs(Math.atan2(Math.sin(b - a), Math.cos(b - a))), seg = (this.cum[k + 2] - this.cum[k - 2]) / 2 || 1, kappa = ang / seg;
      vcap[k] = kappa > 1e-4 ? Math.sqrt(2.6 / kappa) : 30;
    }
    vcap[n - 1] = 0;
    for (let k = n - 2; k >= 0; k--) { const d = this.cum[k + 1] - this.cum[k]; vcap[k] = Math.min(vcap[k], Math.sqrt(vcap[k + 1] * vcap[k + 1] + 2 * 2.5 * d)); }
    this.vcap = vcap;
    this.stuckT = 0; this.recover = 0; this.recSteer = 0; this.recoveries = 0; this.recStage = 0; this.turn = null; this.turns = 0;
  }
  remaining() { return Math.max(0, this.total - this.cum[this.i]); }
  control(car, cruise = 8, dt = 1 / 60) {
    const P = this.pts;
    let best = this.i, bd = Infinity;
    for (let k = this.i; k < Math.min(P.length, this.i + 30); k++) { const d = Math.hypot(P[k][0] - car.x, P[k][1] - car.z); if (d < bd) { bd = d; best = k; } }
    this.i = best;
    if (this.recover > 0) { // a short sequence of escape moves: straight ahead, then reverse on opposite lock, then straight back
      this.recover -= dt; const st = this.recStage % 3;
      if (st === 0) return { steer: 0, throttle: car.v < 1.5 ? 0.8 : 0, brake: car.v < -0.3 ? 1 : 0 };
      if (st === 1) return { steer: this.recSteer, throttle: 0, brake: car.v > 0.3 ? 1 : 0.8 };
      return { steer: 0, throttle: 0, brake: car.v > 0.3 ? 1 : 0.8 };
    }
    const Ld = clamp(3 + Math.abs(car.v) * 0.7, 3.5, 10);
    let k = this.i, acc = 0; while (k < P.length - 1 && acc < Ld) { acc += Math.hypot(P[k + 1][0] - P[k][0], P[k + 1][1] - P[k][1]); k++; }
    const [tx, tz] = P[k];
    const want = Math.atan2(tx - car.x, tz - car.z); let dh = want - car.h; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
    // multi-point turn when the path lies behind the car
    if (!this.turn && Math.abs(dh) > 1.9 && Math.abs(car.v) < 3) { this.turn = { dir: Math.sign(dh) || 1, phase: 1, t: 0, still: 0 }; this.turns++; }
    if (this.turn) {
      const T = this.turn; T.t += dt; T.still = Math.abs(car.v) < 0.3 ? T.still + dt : 0;
      if (Math.abs(dh) < 0.6) this.turn = null;
      else {
        // each phase runs long enough for the wheels to swing lock to lock; switch early only if properly blocked
        if ((T.phase === 1 && (T.t > 3.4 || (T.t > 1.2 && T.still > 0.9))) || (T.phase === -1 && (T.t > 2.8 || (T.t > 1.2 && T.still > 0.9)))) { T.phase = -T.phase; T.t = 0; T.still = 0; }
        if (T.phase === 1) return { steer: T.dir, throttle: car.v < 2.4 ? 1 : 0, brake: car.v < -0.3 ? 1 : 0 };
        return { steer: -T.dir, throttle: 0, brake: car.v > 0.3 ? 1 : 1 };
      }
    }
    const rem = this.remaining();
    let vT = Math.min(cruise, this.vcap[Math.min(P.length - 1, this.i + 1)], Math.sqrt(2 * 2.5 * Math.max(0, rem - 1.5)));
    vT = Math.max(vT, rem > 3 ? 2.0 : 0);
    if (Math.abs(dh) > 1.0) vT = Math.min(vT, 2.2);
    if (rem < 2.5 && Math.abs(car.v) < 0.6) this.done = true;
    const steer = clamp(dh * 2.4, -1, 1), throttle = car.v < vT - 0.3 ? 0.9 : 0;
    if (throttle > 0 && Math.abs(car.v) < 0.25 && !this.done) this.stuckT += dt; else this.stuckT = Math.max(0, this.stuckT - dt);
    if (this.stuckT > 1.0) { this.stuckT = 0; this.recover = 1.3; this.recSteer = -Math.sign(steer || 1); this.recStage = this.recoveries; this.recoveries++; }
    return { steer, throttle, brake: car.v > vT + 0.6 ? 0.8 : 0 };
  }
}
