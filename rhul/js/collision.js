// Occupancy grid used for vehicle collisions, camera avoidance and picking.
// Cells are 0.5 m. `solid` marks anything a car cannot pass through; `height` stores the roof height of buildings (m)
// and `owner` the index of the building that covers a cell (for picking and the map).
import { ringBounds } from './util.js';

export class Grid {
  constructor(x0, z0, x1, z1, cell = 0.5) {
    this.cell = cell; this.x0 = x0; this.z0 = z0;
    this.w = Math.ceil((x1 - x0) / cell); this.h = Math.ceil((z1 - z0) / cell);
    this.solid = new Uint8Array(this.w * this.h); // 1 = hard (buildings, walls), 2 = soft (trees, posts, bollards)
    this.height = new Uint8Array(this.w * this.h);
    this.owner = new Int16Array(this.w * this.h).fill(-1);
  }
  idx(x, z) { const i = Math.floor((x - this.x0) / this.cell), j = Math.floor((z - this.z0) / this.cell); return (i < 0 || j < 0 || i >= this.w || j >= this.h) ? -1 : j * this.w + i; }
  isSolid(x, z, ignoreSoft = false) { const k = this.idx(x, z); if (k < 0) return true; const v = this.solid[k]; return v === 1 || (v === 2 && !ignoreSoft); }
  heightAt(x, z) { const k = this.idx(x, z); return k < 0 ? 0 : this.height[k]; }
  ownerAt(x, z) { const k = this.idx(x, z); return k < 0 ? -1 : this.owner[k]; }
  // scanline fill of a polygon (outer ring with optional holes), even-odd rule
  fillPolygon(rings, { solid = 1, height = 0, owner = -1 } = {}) {
    const { z0: bz0, z1: bz1 } = ringBounds(rings[0]);
    const j0 = Math.max(0, Math.floor((bz0 - this.z0) / this.cell)), j1 = Math.min(this.h - 1, Math.ceil((bz1 - this.z0) / this.cell));
    const xs = [];
    for (let j = j0; j <= j1; j++) {
      const z = this.z0 + (j + 0.5) * this.cell; xs.length = 0;
      for (const r of rings) for (let k = 0, m = r.length - 1; k < r.length; m = k++) {
        const [xa, za] = r[m], [xb, zb] = r[k];
        if ((za > z) !== (zb > z)) xs.push(xa + (z - za) * (xb - xa) / (zb - za));
      }
      xs.sort((a, b) => a - b);
      for (let q = 0; q + 1 < xs.length; q += 2) {
        const i0 = Math.max(0, Math.ceil((xs[q] - this.x0) / this.cell - 0.5)), i1 = Math.min(this.w - 1, Math.floor((xs[q + 1] - this.x0) / this.cell - 0.5));
        for (let i = i0; i <= i1; i++) { const k = j * this.w + i; if (solid) this.solid[k] = 1; if (height > this.height[k]) this.height[k] = Math.min(255, Math.ceil(height)); if (owner >= 0) this.owner[k] = owner; }
      }
    }
  }
  fillCircle(x, z, r, soft = false) {
    const i0 = Math.floor((x - r - this.x0) / this.cell), i1 = Math.floor((x + r - this.x0) / this.cell), j0 = Math.floor((z - r - this.z0) / this.cell), j1 = Math.floor((z + r - this.z0) / this.cell);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      if (i < 0 || j < 0 || i >= this.w || j >= this.h) continue;
      const cx = this.x0 + (i + 0.5) * this.cell, cz = this.z0 + (j + 0.5) * this.cell;
      const k = j * this.w + i; if (Math.hypot(cx - x, cz - z) <= r + this.cell * 0.5 && this.solid[k] !== 1) this.solid[k] = soft ? 2 : 1;
    }
  }
  fillSegment(ax, az, bx, bz, w) {
    const L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(L / (this.cell * 0.5)));
    for (let k = 0; k <= n; k++) this.fillCircle(ax + (bx - ax) * k / n, az + (bz - az) * k / n, w / 2);
  }
  // oriented box footprint (centre, size along local x / z, rotation about y as in three.js)
  fillBox(cx, cz, sx, sz, ry, opts) {
    const c = Math.cos(ry), s = Math.sin(ry), hx = sx / 2, hz = sz / 2;
    const P = (x, z) => [cx + x * c + z * s, cz - x * s + z * c];
    this.fillPolygon([[P(-hx, -hz), P(hx, -hz), P(hx, hz), P(-hx, hz)]], opts);
  }
  // first blocking point along a segment, as a fraction 0..1 (1 = clear). Used to keep cameras out of buildings.
  rayHeight(ax, ay, az, bx, by, bz, step = 0.75) {
    const L = Math.hypot(bx - ax, by - ay, bz - az), n = Math.max(1, Math.ceil(L / step));
    for (let k = 1; k <= n; k++) { const t = k / n, x = ax + (bx - ax) * t, y = ay + (by - ay) * t, z = az + (bz - az) * t; if (this.heightAt(x, z) + 0.6 > y) return (k - 1) / n; }
    return 1;
  }
}
