// Mini-map and full campus map, drawn from the same data as the 3D scene (no separately placed markers).
import { clamp, pointInPoly, ringCentroid } from './util.js';

const COL = { 0: [235, 233, 226], 1: [214, 230, 192], 2: [170, 201, 150], 3: [128, 133, 143], 5: [226, 220, 207], 7: [221, 204, 166] };
const CAT = { historic: '#b5523b', academic: '#4f6f94', residential: '#8f8478', social: '#d9762f', feature: '#b5523b', unknown: '#9a9ea6', sport: '#4f8f5a' };

export class CampusMap {
  constructor(opts) {
    Object.assign(this, opts); // mini, big, bigWrap, data, lc, items, onSelect, getCar, getRoute, getTraffic
    this.mctx = this.mini.getContext('2d'); this.bctx = this.big.getContext('2d');
    this.view = { cx: 0, cz: 0, k: 1 }; this.open = false; this.selected = null; this.hover = null;
    this.base = this.baseLayer();
    const G = this.data.grid; this.gridT = [G.a, G.d, G.b, G.e, G.c, G.f];
    this.roadPath = new Path2D(); for (const e of this.data.roads.edges) { const p = e[4]; this.roadPath.moveTo(p[0][0], p[0][1]); for (let i = 1; i < p.length; i++) this.roadPath.lineTo(p[i][0], p[i][1]); }
    this.footPath = new Path2D(); for (const e of this.data.paths.edges) { const p = e[4]; this.footPath.moveTo(p[0][0], p[0][1]); for (let i = 1; i < p.length; i++) this.footPath.lineTo(p[i][0], p[i][1]); }
    for (const it of this.items) { it.path = new Path2D(); for (const r of it.rings) { it.path.moveTo(r[0][0], r[0][1]); for (let i = 1; i < r.length; i++) it.path.lineTo(r[i][0], r[i][1]); it.path.closePath(); } }
    const xs = this.data.outline.map(p => p[0]), zs = this.data.outline.map(p => p[1]);
    this.bounds = { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) };
    this.bindBig();
  }
  baseLayer() {
    const { w, h, cls } = this.lc, c = document.createElement('canvas'); c.width = w; c.height = h;
    const ctx = c.getContext('2d'), img = ctx.createImageData(w, h), d = img.data;
    for (let i = 0; i < w * h; i++) { const col = COL[cls[i]] || COL[1]; d[i * 4] = col[0]; d[i * 4 + 1] = col[1]; d[i * 4 + 2] = col[2]; d[i * 4 + 3] = 255; }
    ctx.putImageData(img, 0, 0); return c;
  }
  fitCampus() {
    const r = this.big.getBoundingClientRect(), b = this.bounds;
    this.view.cx = (b.x0 + b.x1) / 2; this.view.cz = (b.z0 + b.z1) / 2;
    this.view.k = Math.min(r.width / (b.x1 - b.x0), r.height / (b.z1 - b.z0)) * 0.95;
  }
  setOpen(v) {
    this.open = v; this.bigWrap.hidden = !v;
    if (v) { this.resizeBig(); if (!this.opened) { this.fitCampus(); this.opened = true; } }
  }
  resizeBig() { const r = this.big.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2); this.big.width = Math.round(r.width * dpr); this.big.height = Math.round(r.height * dpr); this.dpr = dpr; }
  centreOn(x, z, k) { this.view.cx = x; this.view.cz = z; if (k) this.view.k = k; }
  screenToWorld(px, py) { const r = this.big.getBoundingClientRect(); return [this.view.cx + (px - r.left - r.width / 2) / this.view.k, this.view.cz + (py - r.top - r.height / 2) / this.view.k]; }
  pick(x, z) {
    for (let i = this.items.length - 1; i >= 0; i--) { const it = this.items[i]; if (it.rings && it.rings.length && pointInPoly(x, z, it.rings[0], it.rings.slice(1))) return it; }
    return null;
  }
  bindBig() {
    const el = this.big, pts = new Map(); let pinch = null, moved = 0, downAt = null;
    el.addEventListener('pointerdown', e => { pts.set(e.pointerId, [e.clientX, e.clientY]); try { el.setPointerCapture(e.pointerId); } catch (_) { /* pointer already gone */ } moved = 0; downAt = [e.clientX, e.clientY]; if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = Math.hypot(a[0] - b[0], a[1] - b[1]); } });
    el.addEventListener('pointermove', e => {
      if (!pts.has(e.pointerId)) { const [x, z] = this.screenToWorld(e.clientX, e.clientY); const it = this.pick(x, z); this.hover = it; el.style.cursor = it ? 'pointer' : 'grab'; return; }
      const p = pts.get(e.pointerId), dx = e.clientX - p[0], dy = e.clientY - p[1]; p[0] = e.clientX; p[1] = e.clientY; moved += Math.abs(dx) + Math.abs(dy);
      if (pts.size === 2) { const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pinch) this.zoomAt((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, d / pinch); pinch = d; return; }
      this.view.cx -= dx / this.view.k; this.view.cz -= dy / this.view.k;
    });
    const up = e => {
      pts.delete(e.pointerId); if (pts.size < 2) pinch = null;
      if (!pts.size && moved < 6 && downAt) { const [x, z] = this.screenToWorld(e.clientX, e.clientY); const it = this.pick(x, z); this.select(it, { fromMap: true }); }
    };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', e => { e.preventDefault(); this.zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.18 : 1 / 1.18); }, { passive: false });
  }
  zoomAt(px, py, f) {
    const [wx, wz] = this.screenToWorld(px, py), k = clamp(this.view.k * f, 0.25, 12);
    const r = this.big.getBoundingClientRect();
    this.view.k = k; this.view.cx = wx - (px - r.left - r.width / 2) / k; this.view.cz = wz - (py - r.top - r.height / 2) / k;
  }
  select(it, opts = {}) { this.selected = it; this.onSelect && this.onSelect(it, opts); }
  // ------------------------------------------------------------------ drawing
  layers(ctx, S, k, cx, cz, { big, labels }) {
    const W = ctx.canvas.width, H = ctx.canvas.height;
    ctx.save(); ctx.setTransform(S * k, 0, 0, S * k, W / 2 - cx * S * k, H / 2 - cz * S * k);
    const kk = S * k;
    ctx.save(); ctx.transform(...this.gridT); ctx.imageSmoothingEnabled = k * S > 1.4; ctx.drawImage(this.base, -0.5, -0.5); ctx.restore();
    // footpaths (pedestrian only): dashed tan; roads (drivable): solid with a white centre line
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(150,118,66,0.85)'; ctx.lineWidth = Math.max(0.9, 1.4 / kk * (big ? 1.2 : 1)); ctx.setLineDash([3 / kk, 3 / kk]); ctx.stroke(this.footPath); ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1 / kk; ctx.stroke(this.roadPath);
    // buildings
    for (const it of this.items) {
      ctx.fillStyle = CAT[it.category] || CAT.unknown; ctx.fill(it.path, 'evenodd');
      ctx.strokeStyle = 'rgba(20,24,28,0.55)'; ctx.lineWidth = 0.8 / kk; ctx.stroke(it.path);
    }
    const sel = this.selected;
    if (sel && sel.path) { ctx.strokeStyle = '#ff7a1a'; ctx.lineWidth = 3.2 / kk; ctx.stroke(sel.path); ctx.fillStyle = 'rgba(255,122,26,0.25)'; ctx.fill(sel.path, 'evenodd'); }
    if (big && this.hover && this.hover !== sel) { ctx.strokeStyle = '#fff1df'; ctx.lineWidth = 2 / kk; ctx.stroke(this.hover.path); }
    // route
    const route = this.getRoute && this.getRoute();
    if (route && route.length > 1) { ctx.strokeStyle = '#ff7a1a'; ctx.lineWidth = 3.5 / kk; ctx.setLineDash([7 / kk, 5 / kk]); ctx.beginPath(); ctx.moveTo(route[0][0], route[0][1]); for (const p of route) ctx.lineTo(p[0], p[1]); ctx.stroke(); ctx.setLineDash([]); }
    // traffic
    const tr = this.getTraffic ? this.getTraffic() : [];
    ctx.fillStyle = '#e0303f'; for (const p of tr) { ctx.beginPath(); ctx.arc(p.x, p.z, 2.6 / kk * (big ? 1.4 : 1.6), 0, 7); ctx.fill(); }
    ctx.restore();
    // labels in screen space
    if (labels) {
      ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const fs = Math.round((big ? 12.5 : 10) * S);
      const placed = [];
      const toS = (x, z) => [W / 2 + (x - cx) * kk, H / 2 + (z - cz) * kk];
      for (const it of this.items.concat(this.points || [])) {
        if (!it.label || (it.minK && k < it.minK)) continue;
        const [sx, sy] = toS(it.lx, it.lz); if (sx < -60 || sy < -20 || sx > W + 60 || sy > H + 20) continue;
        ctx.font = `${it.area ? 'italic 600' : '700'} ${fs}px Manrope, system-ui, sans-serif`;
        const tw = ctx.measureText(it.label).width, bx = [sx - tw / 2 - 4 * S, sy - fs * 0.7, tw + 8 * S, fs * 1.4];
        if (placed.some(b => bx[0] < b[0] + b[2] && bx[0] + bx[2] > b[0] && bx[1] < b[1] + b[3] && bx[1] + bx[3] > b[1])) continue;
        placed.push(bx);
        ctx.fillStyle = it.area ? 'rgba(32,42,48,0.55)' : 'rgba(32,42,48,0.86)'; ctx.fillRect(...bx);
        ctx.fillStyle = it === sel ? '#ff9a4a' : '#fff1df'; ctx.fillText(it.label, sx, sy + 0.5);
      }
      ctx.restore();
    }
  }
  drawPlayer(ctx, S, k, cx, cz, car) {
    const W = ctx.canvas.width, H = ctx.canvas.height, x = W / 2 + (car.x - cx) * S * k, y = H / 2 + (car.z - cz) * S * k, L = 9 * S;
    ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI - car.h);
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#eb641e'; ctx.lineWidth = 2.2 * S;
    ctx.beginPath(); ctx.moveTo(0, -L); ctx.lineTo(L * 0.62, L * 0.72); ctx.lineTo(0, L * 0.34); ctx.lineTo(-L * 0.62, L * 0.72); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
  }
  drawNorth(ctx, S, x, y) {
    ctx.save(); ctx.translate(x, y); ctx.fillStyle = 'rgba(32,42,48,0.85)'; ctx.beginPath(); ctx.arc(0, 0, 13 * S, 0, 7); ctx.fill();
    ctx.fillStyle = '#eb641e'; ctx.beginPath(); ctx.moveTo(0, -10 * S); ctx.lineTo(5 * S, 3 * S); ctx.lineTo(0, 0); ctx.lineTo(-5 * S, 3 * S); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff1df'; ctx.font = `700 ${8 * S}px Manrope, sans-serif`; ctx.textAlign = 'center'; ctx.fillText('N', 0, 10 * S); ctx.restore();
  }
  drawScale(ctx, S, k, x, y) {
    const target = 120 / k, nice = [10, 20, 50, 100, 200, 500].find(n => n >= target * 0.6) || 500, px = nice * k * S;
    ctx.save(); ctx.fillStyle = 'rgba(32,42,48,0.85)'; ctx.fillRect(x - 6 * S, y - 16 * S, px + 12 * S, 22 * S);
    ctx.strokeStyle = '#fff1df'; ctx.lineWidth = 2 * S; ctx.beginPath(); ctx.moveTo(x, y - 6 * S); ctx.lineTo(x, y); ctx.lineTo(x + px, y); ctx.lineTo(x + px, y - 6 * S); ctx.stroke();
    ctx.fillStyle = '#fff1df'; ctx.font = `600 ${10 * S}px Manrope, sans-serif`; ctx.fillText(nice + ' m', x + 4 * S, y - 6 * S); ctx.restore();
  }
  draw() {
    const car = this.getCar();
    // mini-map: north up, centred on the car
    const m = this.mini, r = m.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2), size = Math.round(r.width * dpr);
    if (size > 0) {
      if (m.width !== size) { m.width = m.height = size; }
      const c = this.mctx, R = size / 2, k = size / dpr / 300; // 300 m across
      c.clearRect(0, 0, size, size); c.save(); c.beginPath(); c.arc(R, R, R - 1, 0, 7); c.clip();
      c.fillStyle = '#ebe9e2'; c.fillRect(0, 0, size, size);
      this.layers(c, dpr, k, car.x, car.z, { big: false, labels: size > 150 });
      this.drawPlayer(c, dpr, k, car.x, car.z, car);
      c.restore();
      c.strokeStyle = '#eb641e'; c.lineWidth = 3 * dpr; c.beginPath(); c.arc(R, R, R - 1.5 * dpr, 0, 7); c.stroke();
      c.fillStyle = '#eb641e'; c.font = `700 ${11 * dpr}px Manrope, sans-serif`; c.textAlign = 'center'; c.fillText('N', R, 13 * dpr);
    }
    if (this.open) {
      const b = this.big, c = this.bctx, S = this.dpr || 1;
      c.fillStyle = '#ebe9e2'; c.fillRect(0, 0, b.width, b.height);
      this.layers(c, S, this.view.k, this.view.cx, this.view.cz, { big: true, labels: true });
      this.drawPlayer(c, S, this.view.k, this.view.cx, this.view.cz, car);
      this.drawNorth(c, S, b.width - 26 * S, 26 * S);
      this.drawScale(c, S, this.view.k, 16 * S, b.height - 16 * S);
    }
  }
}
export function labelPoint(rings) { const c = ringCentroid(rings[0]); return c; }
