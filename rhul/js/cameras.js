// Camera modes: chase, driver (first person), drone (elevated free look), orbit (architectural inspection) and
// cinematic (driven by the guided tour). Switching blends smoothly from the previous view.
import { T, clamp, lerp, wrapAngle } from './util.js';

export const MODES = ['chase', 'driver', 'drone', 'orbit'];
export const MODE_LABEL = { chase: 'Chase', driver: 'Driver', drone: 'Drone', orbit: 'Orbit', cinematic: 'Tour' };

export class CameraRig {
  constructor(camera, dom, grid) {
    this.cam = camera; this.dom = dom; this.grid = grid;
    this.mode = 'chase'; this.prevMode = 'chase';
    this.look = { yaw: 0, pitch: 0, idle: 99 };
    this.orbit = { target: new T.Vector3(), yaw: 0.6, pitch: 0.45, dist: 90, auto: true, idle: 0 };
    this.drone = { pos: new T.Vector3(), yaw: 0, pitch: -0.55 };
    this.cine = { pos: new T.Vector3(), target: new T.Vector3() };
    this.pos = new T.Vector3(); this.target = new T.Vector3();
    this.blend = 1; this.fromPos = new T.Vector3(); this.fromTarget = new T.Vector3();
    this.drag = null; this.pinch = null;
    this.bindPointer();
  }
  setMode(m, opts = {}) {
    if (m === this.mode && !opts.force) return;
    this.fromPos.copy(this.cam.position); this.fromTarget.copy(this.target); this.blend = 0;
    this.prevMode = this.mode; this.mode = m;
    if (m === 'drone' && !opts.keep) { this.drone.pos.copy(this.cam.position); this.drone.pos.y = Math.max(this.drone.pos.y, 55); const d = new T.Vector3().subVectors(this.target, this.cam.position); this.drone.yaw = Math.atan2(d.x, d.z); this.drone.pitch = -0.6; }
    if (m === 'orbit' && opts.target) { this.orbit.target.set(opts.target[0], opts.target[1] || 0, opts.target[2] ?? opts.target[1]); }
    if (m === 'orbit') { if (opts.dist) this.orbit.dist = opts.dist; this.orbit.auto = true; this.orbit.idle = 0; if (opts.yaw !== undefined) this.orbit.yaw = opts.yaw; }
    this.look.yaw = 0; this.look.pitch = 0;
  }
  focus(x, z, radius = 40, height = 0) {
    this.setMode('orbit', { force: true });
    this.orbit.target.set(x, height, z); this.orbit.dist = clamp(radius * 2.4, 35, 420); this.orbit.pitch = 0.5; this.orbit.auto = true; this.orbit.idle = 0;
  }
  bindPointer() {
    const el = this.dom;
    const pts = new Map();
    el.addEventListener('pointerdown', e => { pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); try { el.setPointerCapture(e.pointerId); } catch (_) { /* pointer already gone */ } if (pts.size === 1) this.drag = { x: e.clientX, y: e.clientY, moved: 0 }; if (pts.size === 2) { const [a, b] = [...pts.values()]; this.pinch = Math.hypot(a.x - b.x, a.y - b.y); } });
    el.addEventListener('pointermove', e => {
      if (!pts.has(e.pointerId)) return;
      const p = pts.get(e.pointerId), dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
      if (pts.size === 2) { const [a, b] = [...pts.values()], d = Math.hypot(a.x - b.x, a.y - b.y); if (this.pinch) this.zoom((this.pinch - d) * 0.01); this.pinch = d; return; }
      if (this.drag) this.drag.moved += Math.abs(dx) + Math.abs(dy);
      this.rotate(dx, dy);
    });
    const up = e => { pts.delete(e.pointerId); if (pts.size < 2) this.pinch = null; if (!pts.size) { this.lastTap = this.drag && this.drag.moved < 6 ? { x: e.clientX, y: e.clientY, t: performance.now() } : null; this.drag = null; } };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', e => { e.preventDefault(); this.zoom(Math.sign(e.deltaY) * 0.12); }, { passive: false });
    el.addEventListener('dblclick', () => { this.look.yaw = 0; this.look.pitch = 0; });
  }
  rotate(dx, dy) {
    const k = 0.0055;
    if (this.mode === 'orbit') { this.orbit.yaw -= dx * k; this.orbit.pitch = clamp(this.orbit.pitch + dy * k * 0.8, 0.05, 1.45); this.orbit.auto = false; this.orbit.idle = 0; }
    else if (this.mode === 'drone') { this.drone.yaw -= dx * k; this.drone.pitch = clamp(this.drone.pitch - dy * k, -1.5, 0.3); }
    else { this.look.yaw -= dx * k; this.look.pitch = clamp(this.look.pitch + dy * k * 0.7, -0.5, 1.0); this.look.idle = 0; }
  }
  zoom(z) {
    if (this.mode === 'orbit') this.orbit.dist = clamp(this.orbit.dist * (1 + z), 12, 700);
    else if (this.mode === 'drone') this.drone.pos.y = clamp(this.drone.pos.y * (1 + z), 8, 600);
  }
  // keys move the drone when it is active: returns true if it consumed them
  droneMove(dt, keys) {
    const sp = (keys.shift ? 70 : 28) * dt * (1 + this.drone.pos.y / 120), f = (keys.up ? 1 : 0) - (keys.down ? 1 : 0), s = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    const fx = Math.sin(this.drone.yaw), fz = Math.cos(this.drone.yaw);
    this.drone.pos.x += (fx * f - fz * s) * sp; this.drone.pos.z += (fz * f + fx * s) * sp;
    if (keys.q) this.drone.pos.y = Math.max(6, this.drone.pos.y - 20 * dt); if (keys.e) this.drone.pos.y = Math.min(600, this.drone.pos.y + 20 * dt);
  }
  update(dt, car) {
    const P = new T.Vector3(), Tg = new T.Vector3();
    const fx = Math.sin(car.h), fz = Math.cos(car.h);
    this.look.idle += dt;
    if (this.mode === 'chase') {
      if (!this.drag && this.look.idle > 2.5 && Math.abs(car.v) > 1) { this.look.yaw *= Math.max(0, 1 - dt * 1.5); this.look.pitch *= Math.max(0, 1 - dt * 1.5); }
      const back = car.v < -0.5 && Math.abs(this.look.yaw) < 0.2;
      const ang = car.h + (back ? 0 : Math.PI) + this.look.yaw, dist = 9.5 * Math.cos(this.look.pitch * 0.6), hgt = 3.9 + this.look.pitch * 9;
      Tg.set(car.x + (Math.abs(this.look.yaw) < 0.3 ? fx * 5 : 0), 1.3, car.z + (Math.abs(this.look.yaw) < 0.3 ? fz * 5 : 0));
      P.set(car.x + Math.sin(ang) * dist, Math.max(1.2, hgt), car.z + Math.cos(ang) * dist);
      // keep the camera out of buildings: stop it at the first obstacle between the car and the camera
      const t = this.grid.rayHeight(car.x, 1.6, car.z, P.x, P.y, P.z, 0.5);
      if (t < 1) P.set(car.x + (P.x - car.x) * Math.max(0.2, t), P.y, car.z + (P.z - car.z) * Math.max(0.2, t));
      const k = 1 - Math.exp(-dt * (this.drag ? 14 : 4));
      this.pos.lerp(P, this.blend < 1 ? 1 : k); this.target.lerp(Tg, this.blend < 1 ? 1 : 1 - Math.exp(-dt * 8));
    } else if (this.mode === 'driver') {
      // UK cars are right-hand drive: the driver sits on the right (local -x)
      const rx = -Math.cos(car.h), rz = Math.sin(car.h);
      this.pos.set(car.x + rx * 0.4 * 1.08 - fx * 0.2, 1.22 * 1.08, car.z + rz * 0.4 * 1.08 - fz * 0.2);
      const yaw = car.h + this.look.yaw, pitch = -this.look.pitch * 0.6;
      this.target.set(this.pos.x + Math.sin(yaw) * 10, this.pos.y + Math.tan(pitch) * 10, this.pos.z + Math.cos(yaw) * 10);
    } else if (this.mode === 'drone') {
      const d = this.drone, gh = this.grid.heightAt(d.pos.x, d.pos.z); if (d.pos.y < gh + 4) d.pos.y = gh + 4;
      this.pos.copy(d.pos);
      this.target.set(d.pos.x + Math.sin(d.yaw) * Math.cos(d.pitch) * 20, d.pos.y + Math.sin(d.pitch) * 20, d.pos.z + Math.cos(d.yaw) * Math.cos(d.pitch) * 20);
    } else if (this.mode === 'orbit') {
      const o = this.orbit; o.idle += dt; if (o.auto || o.idle > 6) o.yaw += dt * 0.09;
      Tg.copy(o.target);
      P.set(o.target.x + Math.sin(o.yaw) * Math.cos(o.pitch) * o.dist, o.target.y + Math.sin(o.pitch) * o.dist + 2, o.target.z + Math.cos(o.yaw) * Math.cos(o.pitch) * o.dist);
      const gh = this.grid.heightAt(P.x, P.z); if (P.y < gh + 3) P.y = gh + 3;
      const k = 1 - Math.exp(-dt * 5); this.pos.lerp(P, this.blend < 1 ? 1 : k); this.target.lerp(Tg, this.blend < 1 ? 1 : k);
    } else if (this.mode === 'cinematic') {
      const k = 1 - Math.exp(-dt * 1.6);
      this.pos.lerp(this.cine.pos, this.blend < 1 ? 1 : k); this.target.lerp(this.cine.target, this.blend < 1 ? 1 : k);
      const gh = this.grid.heightAt(this.pos.x, this.pos.z); if (this.pos.y < gh + 2) this.pos.y = gh + 2;
    }
    // blend from the previous view over about a second
    if (this.blend < 1) {
      this.blend = Math.min(1, this.blend + dt * 1.1); const s = this.blend * this.blend * (3 - 2 * this.blend);
      this.cam.position.lerpVectors(this.fromPos, this.pos, s);
      const tg = new T.Vector3().lerpVectors(this.fromTarget, this.target, s);
      this.cam.lookAt(tg);
    } else { this.cam.position.copy(this.pos); this.cam.lookAt(this.target); }
    void lerp; void wrapAngle;
  }
}
