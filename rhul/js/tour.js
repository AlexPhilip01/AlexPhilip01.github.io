// Guided tour: drives the car along real roads (shortest routes on the road graph) between stops, then shows each
// landmark with a slow cinematic camera move while its information card is displayed.
// The car never teleports; pedestrian-only places (the quads, Founder's Square) are shown from the air while the car waits on the road.
import { T, clamp } from './util.js';
import { smoothPath, Follower } from './router.js';

export class Tour {
  constructor({ router, driver, rig, onStop, onState }) {
    this.router = router; this.driver = driver; this.rig = rig; this.onStop = onStop; this.onState = onState;
    this.stops = []; this.active = false; this.paused = false; this.k = 0; this.phase = 'idle'; this.t = 0; this.follow = null; this.route = null;
    this.autopilot = null; // single-destination drive ("Drive there")
  }
  setStops(stops) { this.stops = stops; }
  start(from = 0) { this.active = true; this.paused = false; this.k = from; this.autopilot = null; this.rig.setMode('cinematic'); this.beginLeg(); this.emit(); }
  stop(reason = 'stopped') { if (!this.active && !this.autopilot) return; this.active = false; this.autopilot = null; this.phase = 'idle'; this.route = null; if (this.rig.mode === 'cinematic') this.rig.setMode('chase'); this.emit(reason); }
  pause() { if (!this.active) return; this.paused = !this.paused; this.emit(); }
  skip() {
    if (!this.active) return;
    if (this.phase === 'dwell') { this.next(); return; }
    this.k = Math.min(this.stops.length - 1, this.k + 1); this.beginLeg(); this.emit();
  }
  next() { if (this.k >= this.stops.length - 1) { this.stop('finished'); return; } this.k++; this.beginLeg(); this.emit(); }
  beginLeg() {
    const s = this.stops[this.k], d = this.driver;
    if (s.stay || !s.approach) { this.phase = 'dwell'; this.t = 0; this.follow = null; this.route = null; this.onStop && this.onStop(s, this.k); return; }
    const goal = this.router.nearestClear(s.approach[0], s.approach[1], d.grid);
    const r = this.router.route(d.x, d.z, goal[0], goal[1], d.h);
    if (!r || r.pts.length < 2) { this.phase = 'dwell'; this.t = 0; this.onStop && this.onStop(s, this.k); return; }
    this.route = smoothPath(r.pts, 2); this.follow = new Follower(this.route); this.phase = 'drive'; this.t = 0;
  }
  // drive to a single destination ("Drive there" from the map or info panel)
  driveTo(x, z, label) {
    this.active = false; const d = this.driver, goal = this.router.nearestClear(x, z, d.grid), r = this.router.route(d.x, d.z, goal[0], goal[1], d.h);
    if (!r) return false;
    this.route = smoothPath(r.pts, 2); this.autopilot = { follow: new Follower(this.route), label, x, z }; this.phase = 'drive';
    this.emit(); return true;
  }
  remainingLabel() {
    const f = this.autopilot ? this.autopilot.follow : this.follow; if (!f) return '';
    const m = f.remaining(); return m > 950 ? (m / 1000).toFixed(1) + ' km' : Math.round(m / 10) * 10 + ' m';
  }
  emit(reason) { this.onState && this.onState({ active: this.active, paused: this.paused, phase: this.phase, k: this.k, n: this.stops.length, stop: this.stops[this.k], autopilot: this.autopilot, reason }); }
  // returns driver input, or null when the user is in control
  update(dt) {
    const d = this.driver;
    d.autopilot = !!(this.autopilot || (this.active && this.phase === 'drive')); // routes follow road centrelines, so kerbs are not enforced
    const fl = this.autopilot ? this.autopilot.follow : this.follow;
    d.manoeuvring = !!(d.autopilot && fl && (fl.turn || fl.recover > 0));
    if (this.autopilot) {
      const c = this.autopilot.follow.control(d, 9, dt);
      if (this.autopilot.follow.done) { const lab = this.autopilot.label; this.autopilot = null; this.route = null; this.phase = 'idle'; this.emit('arrived:' + lab); return { brake: 1 }; }
      return c;
    }
    if (!this.active) return null;
    const s = this.stops[this.k];
    if (this.paused) { this.cinePause(dt); return { brake: 1, handbrake: true }; }
    if (this.phase === 'drive') {
      const c = this.follow.control(d, 9, dt);
      this.cineChase(dt);
      if (this.follow.done) { this.phase = 'dwell'; this.t = 0; this.onStop && this.onStop(s, this.k); this.emit(); }
      return c;
    }
    // dwell: hold the car, fly the camera round the landmark
    this.t += dt;
    this.cineOrbit(s, this.t);
    if (this.t > (s.dwell || 12)) this.next();
    return { brake: 1, handbrake: true };
  }
  cineChase() {
    const d = this.driver, c = this.rig.cine, fx = Math.sin(d.h), fz = Math.cos(d.h);
    c.pos.set(d.x - fx * 15 + fz * 4, 8.5, d.z - fz * 15 - fx * 4); c.target.set(d.x + fx * 10, 1.5, d.z + fz * 10);
  }
  cinePause() { /* keep the current camera */ }
  cineOrbit(s, t) {
    const c = this.rig.cine, v = s.view || {}, r = v.r || 60, h = v.h || 25, ty = v.ty || 6;
    const a0 = v.yaw ?? Math.atan2(this.driver.x - s.focus[0], this.driver.z - s.focus[1]);
    const a = a0 + t * (v.spin ?? 0.12);
    c.pos.set(s.focus[0] + Math.sin(a) * r, h, s.focus[1] + Math.cos(a) * r); c.target.set(s.focus[0], ty, s.focus[1]);
    void clamp; void T;
  }
}
