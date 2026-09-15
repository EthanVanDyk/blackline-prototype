/* Blackline prototype simulation. No renderer, network, or engine dependency.
   Units: metres, seconds, radians. Heading 0 is north (negative Z).
   MIT licensed; see LICENSE.txt. */
(function () {
  'use strict';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const angle = a => Math.atan2(Math.sin(a), Math.cos(a));
  const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  const mix = (a, b, t) => a + (b - a) * t;
  const START = { x: -180, z: 112, h: 0 };
  const PICKUP = { x: 60, z: -85 };
  const EXTRACTION = { x: -60, z: 150 };
  const GATES = [
    { x: -180, z: -150, label: 'NORTH QUAY' },
    { x: 180, z: -150, label: 'EAST CRANE' },
    { x: 180, z: 150, label: 'SOUTH FREIGHT' },
    { x: -180, z: 150, label: 'WEST TURN' },
    { ...START, label: 'RECORDING FINISH' }
  ];
  const ROAD_X = [-180, -60, 60, 180], ROAD_Z = [-150, 0, 150];
  const solids = [];
  for (const x of [-120, 0, 120]) for (const z of [-75, 75]) {
    solids.push({ x, z, w: 84, d: 100, height: 12 + (x === 0 ? 5 : 0), kind: 'warehouse' });
  }
  solids.push(
    { x: -210, z: -65, w: 12, d: 42, height: 5, kind: 'containers' },
    { x: 210, z: 65, w: 12, d: 42, height: 5, kind: 'containers' },
    { x: 100, z: 180, w: 35, d: 9, height: 5, kind: 'containers' },
    { x: -80, z: -180, w: 40, d: 9, height: 5, kind: 'containers' }
  );
  const WORLD = { boundX: 224, boundZ: 194, roadWidth: 28, roadX: ROAD_X, roadZ: ROAD_Z, solids };
  const nodes = [];
  for (const z of ROAD_Z) for (const x of ROAD_X) nodes.push({ x, z });
  function isRoad(p) {
    return (ROAD_X.some(x => Math.abs(x - p.x) < 17) && Math.abs(p.z) < 170) ||
      (ROAD_Z.some(z => Math.abs(z - p.z) < 17) && Math.abs(p.x) < 202);
  }
  // Slab intersection on the ground plane. Buildings are both solid and opaque.
  function segmentRect(a, b, rect, pad = 0) {
    let lo = 0, hi = 1;
    for (const [axis, half] of [['x', rect.w / 2], ['z', rect.d / 2]]) {
      const d = b[axis] - a[axis], mn = rect[axis] - half - pad, mx = rect[axis] + half + pad;
      if (Math.abs(d) < 1e-8) { if (a[axis] < mn || a[axis] > mx) return false; }
      else {
        let t0 = (mn - a[axis]) / d, t1 = (mx - a[axis]) / d;
        if (t0 > t1) [t0, t1] = [t1, t0];
        lo = Math.max(lo, t0); hi = Math.min(hi, t1);
        if (lo > hi) return false;
      }
    }
    return true;
  }
  const clearLine = (a, b, pad = 0) => !solids.some(r => segmentRect(a, b, r, pad));
  function segmentDistance(p, a, b) {
    const dx = b.x - a.x, dz = b.z - a.z;
    const t = clamp(((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1), 0, 1);
    return Math.hypot(p.x - a.x - dx * t, p.z - a.z - dz * t);
  }
  // Small road graph with visible start/end connections. Police never route through solids.
  function pathfind(from, to) {
    if (clearLine(from, to, 3)) return [{ x: to.x, z: to.z }];
    const cost = nodes.map(n => clearLine(from, n, 3) ? distance(from, n) : Infinity);
    const prev = nodes.map(() => -1), visited = new Set();
    let best = Infinity, end = -1;
    for (let iter = 0; iter < nodes.length; iter++) {
      let u = -1;
      for (let i = 0; i < nodes.length; i++) if (!visited.has(i) && (u < 0 || cost[i] < cost[u])) u = i;
      if (u < 0 || !Number.isFinite(cost[u])) break;
      visited.add(u);
      if (clearLine(nodes[u], to, 3) && cost[u] + distance(nodes[u], to) < best) {
        best = cost[u] + distance(nodes[u], to); end = u;
      }
      for (let v = 0; v < nodes.length; v++) {
        if (v === u || (nodes[u].x !== nodes[v].x && nodes[u].z !== nodes[v].z)) continue;
        const c = cost[u] + distance(nodes[u], nodes[v]);
        if (c < cost[v] && clearLine(nodes[u], nodes[v], 3)) { cost[v] = c; prev[v] = u; }
      }
    }
    if (end < 0) return [{ x: from.x, z: from.z }];
    const path = [{ x: to.x, z: to.z }];
    for (let n = end; n >= 0; n = prev[n]) path.unshift({ ...nodes[n] });
    return path;
  }
  function car(p = START) {
    return { x: p.x, z: p.z, h: p.h || 0, vx: 0, vz: 0, steer: 0, speed: 0, slip: 0,
      nitro: 72, boosting: false, drift: false, clean: 0, hit: 0, wheel: 0, radius: 2.05 };
  }
  function collideStatic(c) {
    let impact = 0;
    const bounce = (nx, nz) => {
      const vn = c.vx * nx + c.vz * nz;
      if (vn < 0) { impact = Math.max(impact, -vn); c.vx -= 1.14 * vn * nx; c.vz -= 1.14 * vn * nz; c.vx *= .76; c.vz *= .76; }
    };
    for (const r of solids) {
      const minX = r.x - r.w / 2, maxX = r.x + r.w / 2, minZ = r.z - r.d / 2, maxZ = r.z + r.d / 2;
      const px = clamp(c.x, minX, maxX), pz = clamp(c.z, minZ, maxZ);
      let dx = c.x - px, dz = c.z - pz, d = Math.hypot(dx, dz);
      if (d >= c.radius) continue;
      if (d < 1e-8) {
        const faces = [[Math.abs(c.x - minX), -1, 0], [Math.abs(maxX - c.x), 1, 0],
          [Math.abs(c.z - minZ), 0, -1], [Math.abs(maxZ - c.z), 0, 1]].sort((a, b) => a[0] - b[0]);
        const f = faces[0]; c.x += f[1] * (f[0] + c.radius); c.z += f[2] * (f[0] + c.radius); bounce(f[1], f[2]);
      } else {
        dx /= d; dz /= d; c.x += dx * (c.radius - d); c.z += dz * (c.radius - d); bounce(dx, dz);
      }
    }
    if (c.x < -WORLD.boundX + c.radius) { c.x = -WORLD.boundX + c.radius; bounce(1, 0); }
    if (c.x > WORLD.boundX - c.radius) { c.x = WORLD.boundX - c.radius; bounce(-1, 0); }
    if (c.z < -WORLD.boundZ + c.radius) { c.z = -WORLD.boundZ + c.radius; bounce(0, 1); }
    if (c.z > WORLD.boundZ - c.radius) { c.z = WORLD.boundZ - c.radius; bounce(0, -1); }
    if (impact > 2) { c.hit = 1.1; c.clean = 0; }
    return impact;
  }
  function stepCar(c, input, dt, police = false) {
    let fx = Math.sin(c.h), fz = -Math.cos(c.h), rx = Math.cos(c.h), rz = Math.sin(c.h);
    let forward = c.vx * fx + c.vz * fz;
    const throttle = clamp(input.throttle || 0, 0, 1), brake = clamp(input.brake || 0, 0, 1);
    const hb = !!input.handbrake && Math.abs(forward) > 5;
    c.steer = mix(c.steer, clamp(input.steer || 0, -1, 1), 1 - Math.exp(-9 * dt));
    const turn = (police ? 2.2 : 1.75) * clamp(Math.abs(forward) / 7, 0, 1) * clamp(33 / (Math.abs(forward) + 20), .58, 1.15);
    c.h = angle(c.h + c.steer * turn * (hb ? 1.6 : 1) * Math.sign(forward || 1) * dt);
    fx = Math.sin(c.h); fz = -Math.cos(c.h); rx = Math.cos(c.h); rz = Math.sin(c.h);
    forward = c.vx * fx + c.vz * fz;
    let lateral = c.vx * rx + c.vz * rz;
    const grip = hb ? 1.05 : (police ? 9.5 : 7.8);
    lateral *= Math.exp(-grip * dt);
    c.boosting = !police && !!input.nitro && c.nitro > .5 && forward > 5 && throttle > 0 && !hb;
    const max = police ? 31 : (c.boosting ? 55 : 42);
    if (throttle) forward += (c.boosting ? 17 : 10.8) * throttle * dt * clamp(1 - Math.max(0, forward) / (max + 9), .18, 1.5);
    if (brake) {
      if (forward > .6) forward = Math.max(0, forward - brake * 24 * dt);
      else forward = Math.max(-9, forward - brake * 8 * dt);
    }
    if (throttle && forward < 0) forward = Math.min(0, forward + 20 * dt);
    if (!throttle && !brake) forward *= Math.exp(-.24 * dt);
    forward *= Math.exp(-(isRoad(c) ? .045 : .34) * dt);
    if (hb) forward *= Math.exp(-.4 * dt);
    forward = clamp(forward, -9, max);
    c.vx = fx * forward + rx * lateral; c.vz = fz * forward + rz * lateral;
    c.x += c.vx * dt; c.z += c.vz * dt;
    c.hit = Math.max(0, c.hit - dt);
    const impact = collideStatic(c);
    c.speed = Math.hypot(c.vx, c.vz);
    c.slip = Math.atan2(lateral, Math.max(3, Math.abs(forward)));
    c.drift = Math.abs(c.slip) > .11 && c.speed > 8;
    c.wheel += forward * dt / .4;
    if (!police) {
      if (c.boosting) c.nitro = Math.max(0, c.nitro - 23 * dt);
      else if (c.speed > 12 && Math.abs(c.slip) < .13 && Math.abs(c.steer) < .4 && c.hit <= 0 && isRoad(c)) {
        c.clean += dt; if (c.clean > .9) c.nitro = Math.min(100, c.nitro + 6 * dt);
      } else c.clean = 0;
    }
    return impact;
  }
  function replayAt(record, t, cursor = 0) {
    if (!record.length) return null;
    let i = Math.min(cursor, record.length - 1);
    while (i + 1 < record.length && record[i + 1].t <= t) i++;
    const a = record[i], b = record[Math.min(i + 1, record.length - 1)];
    const f = clamp((t - a.t) / (b.t - a.t || 1), 0, 1);
    return { x: mix(a.x, b.x, f), z: mix(a.z, b.z, f), h: angle(a.h + angle(b.h - a.h) * f),
      speed: mix(a.speed, b.speed, f), cursor: i };
  }
  class Game {
    constructor(options = {}) {
      this.bank = Math.max(0, Number(options.bank) || 0);
      this.phase = 'intro'; this.paused = false; this.time = 0; this.player = car();
      this.record = []; this.events = []; this.eventId = 0; this.gate = 0; this.rehearsalTime = 0;
      this.haul = 0; this.peakHeat = 0; this.heat = 0; this.bust = 0; this.hold = 0;
      this.team = null; this.police = null; this.hasArchive = false; this.liveTime = 0;
      this.stats = { collisions: 0, driftSeconds: 0, nitroUsed: 0, evasions: 0, diversionSeconds: 0 };
    }
    event(type, text) { this.events.push({ id: ++this.eventId, type, text, t: this.time }); if (this.events.length > 40) this.events.shift(); }
    resetStats() { this.stats = { collisions: 0, driftSeconds: 0, nitroUsed: 0, evasions: 0, diversionSeconds: 0 }; }
    startRehearsal() {
      this.phase = 'rehearsal'; this.paused = false; this.player = car(); this.gate = 0;
      this.rehearsalTime = 0; this.record = [{ t: 0, ...START, speed: 0 }]; this.sampleClock = 0;
      this.haul = 0; this.heat = 0; this.peakHeat = 0; this.bust = 0; this.hold = 0;
      this.team = null; this.police = null; this.hasArchive = false; this.liveTime = 0; this.resetStats();
      this.event('radio', 'ELI / Follow the amber gates. I’m recording your line.');
    }
    startLive() {
      if (this.record.length < 2) return false;
      this.phase = 'countdown'; this.countdown = 3; this.paused = false;
      this.player = car({ x: -173, z: 116, h: 0 }); this.player.nitro = 100;
      this.team = { ...replayAt(this.record, 0), active: true, cursor: 0, wheel: 0 };
      this.police = { ...car({ x: -180, z: 172, h: 0 }), radius: 2.1, alert: true,
        lastKnown: { x: -173, z: 116 }, seen: false, search: 0, searchDelay: 0,
        target: 'diversion', planClock: 0, path: [], seenTime: 0, sweep: 0 };
      this.liveTime = 0; this.haul = 0; this.peakHeat = 1; this.heat = 1;
      this.hasArchive = false; this.bust = 0; this.hold = 0; this.lastPayout = 0; this.resetStats();
      this.event('radio', 'ELI / I’ll run your recording. Cut inland and take the archive.'); return true;
    }
    retry() { if (this.record.length > 2 && this.phase !== 'rehearsal') this.startLive(); else this.startRehearsal(); }
    get multiplier() { return this.peakHeat >= 2 ? 1.2 : this.peakHeat === 1 ? 1.1 : 1; }
    get target() { return this.phase === 'rehearsal' ? GATES[this.gate] : this.hasArchive ? EXTRACTION : PICKUP; }
    pickup() {
      this.hasArchive = true; this.haul = 5000; this.heat = 2; this.peakHeat = 2; this.hold = 0;
      const p = this.police;
      p.alert = true; p.search = 0; p.searchDelay = 1.2; p.lastKnown = { ...PICKUP }; p.planClock = 0; p.path = [];
      this.event('pickup', 'ARCHIVE SECURED / $5,000 at risk. Break sightlines, then reach the green garage.');
    }
    finish(won) {
      if (this.phase !== 'live') return;
      if (won) {
        this.lastPayout = Math.round(this.haul * this.multiplier); this.bank += this.lastPayout;
        this.event('success', 'CLEAN GETAWAY / Archive delivered. Crew paid.'); this.phase = 'success';
      } else { this.lastPayout = 0; this.event('bust', 'BUSTED / The unbanked haul is gone. Your bank is safe.'); this.phase = 'bust'; }
      this.haul = 0; this.hold = 0; this.player.boosting = false;
    }
    updatePolice(dt) {
      const p = this.police, c = this.player;
      const visual = distance(p, c) < (this.peakHeat >= 2 ? 88 : 75) && clearLine(p, c);
      const decoyPriority = !this.hasArchive && this.team && this.team.active && distance(p, c) > 17;
      const seen = visual && !decoyPriority;
      p.seen = seen;
      let goal = p.lastKnown;
      if (decoyPriority) { p.target = 'diversion'; goal = this.team; this.stats.diversionSeconds += dt; }
      else if (seen && (p.alert || this.hasArchive)) {
        p.alert = true; p.target = 'player'; p.lastKnown = { x: c.x, z: c.z }; goal = c;
        p.search = 0; p.seenTime += dt;
        if (p.seenTime > 11) this.peakHeat = Math.max(2, this.peakHeat);
      } else {
        p.target = p.alert ? 'search' : 'idle'; goal = p.lastKnown;
        if (p.alert && distance(p, goal) < 9) {
          // Search only around the last observation; do not query the hidden car position.
          const near = nodes.filter(n => distance(n, p.lastKnown) < 200);
          p.sweep += dt;
          if (near.length && p.sweep > 2) goal = near[Math.floor(p.sweep / 5) % near.length];
        }
      }
      if (p.alert) {
        this.heat = this.peakHeat;
        if (seen) p.search = 0;
        else if (p.searchDelay > 0) p.searchDelay -= dt;
        else p.search += dt;
        if (p.search >= 5.5) {
          p.alert = false; this.heat = 0; this.bust = 0; this.stats.evasions++;
          this.event('evaded', `PURSUIT EVADED / Extraction multiplier ×${this.multiplier.toFixed(2)}`);
        }
      } else this.heat = 0;
      p.planClock -= dt;
      if (p.planClock <= 0) { p.path = pathfind(p, goal); p.planClock = .45; }
      while (p.path.length > 1 && distance(p, p.path[0]) < 9) p.path.shift();
      const aim = p.path[0] || goal;
      const err = angle(Math.atan2(aim.x - p.x, -(aim.z - p.z)) - p.h);
      const far = distance(p, goal), max = this.heat === 2 ? 21 : 19;
      const desired = p.target === 'idle' ? 0 : (far < 6 ? 0 : Math.min(max, 7 + 24 * Math.max(0, Math.cos(err))));
      stepCar(p, { steer: clamp(err * 2.4, -1, 1), throttle: p.speed < desired ? 1 : 0,
        brake: p.speed > desired + 1 ? 1 : 0 }, dt, true);
      // Gentle physical contact. Teammate playback is deliberately kinematic in this slice.
      const d = distance(p, c), min = c.radius + p.radius;
      if (d < min && d > .001) {
        const nx = (c.x - p.x) / d, nz = (c.z - p.z) / d;
        c.x += nx * (min - d) * .6; c.z += nz * (min - d) * .6;
        p.x -= nx * (min - d) * .4; p.z -= nz * (min - d) * .4;
        c.vx *= .97; c.vz *= .97; collideStatic(c); collideStatic(p);
      }
      if (p.alert && seen && distance(p, c) < 9.5 && c.speed < 5.5) this.bust = Math.min(1, this.bust + dt / 3.6);
      else this.bust = Math.max(0, this.bust - dt * .6);
      if (this.bust >= 1) this.finish(false);
    }
    step(dt, input = {}) {
      if (this.paused || !['rehearsal', 'live', 'countdown'].includes(this.phase)) return;
      dt = clamp(dt, 0, .025); this.time += dt;
      if (this.phase === 'countdown') {
        this.countdown -= dt;
        if (this.countdown <= 0) { this.phase = 'live'; this.event('radio', 'ELI / Runback is live. Your line, my wheels.'); }
        return;
      }
      const old = { x: this.player.x, z: this.player.z };
      const beforeNitro = this.player.nitro;
      const impact = stepCar(this.player, input, dt);
      if (impact > 4) this.stats.collisions++;
      if (this.player.drift) this.stats.driftSeconds += dt;
      this.stats.nitroUsed += Math.max(0, beforeNitro - this.player.nitro);
      if (this.phase === 'rehearsal') {
        this.rehearsalTime += dt; this.sampleClock += dt;
        if (this.sampleClock >= .05) { this.sampleClock %= .05; this.record.push({ t: this.rehearsalTime,
          x: this.player.x, z: this.player.z, h: this.player.h, speed: this.player.speed }); }
        if (segmentDistance(GATES[this.gate], old, this.player) < 20) {
          this.gate++; this.event('gate', `LINE CAPTURED / ${Math.min(this.gate, GATES.length)} of ${GATES.length} gates`);
          if (this.gate === GATES.length) {
            this.record.push({ t: this.rehearsalTime, x: this.player.x, z: this.player.z, h: this.player.h, speed: this.player.speed });
            this.phase = 'ready'; this.player.boosting = false;
            this.event('ready', 'RUNBACK READY / Your diversion is recorded. Launch the live job.');
          }
        }
        if (this.rehearsalTime > 180 && this.phase === 'rehearsal') {
          this.startRehearsal(); this.event('radio', 'ELI / Three-minute recording limit. Fresh tape; try the amber lap again.');
        }
        return;
      }
      this.liveTime += dt;
      const t = replayAt(this.record, this.liveTime, this.team.cursor);
      Object.assign(this.team, t); this.team.active = this.liveTime < this.record[this.record.length - 1].t;
      this.team.wheel += (this.team.active ? this.team.speed : 0) * dt / .4;
      if (!this.team.active) this.team.speed = 0;
      this.drafting = false;
      const ds = distance(this.player, this.team);
      if (this.team.active && ds > 7 && ds < 30 && this.player.speed > 10 && clearLine(this.player, this.team)) {
        const ahead = ((this.team.x - this.player.x) * Math.sin(this.player.h) -
          (this.team.z - this.player.z) * Math.cos(this.player.h)) / ds;
        this.drafting = ahead > .96 && Math.abs(angle(this.player.h - this.team.h)) < .25;
        if (this.drafting && !this.player.boosting) this.player.nitro = Math.min(100, this.player.nitro + dt * 9);
      }
      this.updatePolice(dt);
      if (this.phase !== 'live') return;
      if (!this.hasArchive) {
        this.hold = distance(this.player, PICKUP) < 14 && this.player.speed < 10 ? this.hold + dt : 0;
        if (this.hold >= .7) this.pickup();
      } else {
        this.hold = distance(this.player, EXTRACTION) < 15 && this.player.speed < 8 && this.heat === 0 ? this.hold + dt : 0;
        if (this.hold >= 1) this.finish(true);
      }
    }
  }
  const api = { Game, WORLD, START, PICKUP, EXTRACTION, GATES, nodes, car, stepCar, collideStatic,
    isRoad, clearLine, segmentRect, pathfind, replayAt, distance, angle, clamp, mix };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.BlacklineCore = api;
})();
