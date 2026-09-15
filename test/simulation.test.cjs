'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const C = require('../core.js');
const Driver = require('./driver.js');
const DT = 1 / 120;
function drive(game, driver, limit, until) {
  for (let i = 0; i < limit / DT && !until(game); i++) game.step(DT, driver.input(game));
}
function recordedGame(bank = 0) {
  const g = new C.Game({ bank }); g.startRehearsal();
  drive(g, new Driver('rehearsal'), 150, s => s.phase === 'ready');
  assert.equal(g.phase, 'ready', 'A physical steering/throttle driver must complete the rehearsal.');
  return g;
}

test('Accelerating, braking, reversing and steering obey the core controls', () => {
  const c = C.car({ x: -180, z: 130 });
  for (let i = 0; i < 4 / DT; i++) C.stepCar(c, { throttle: 1 }, DT);
  assert(c.speed > 23 && c.z < 80);
  for (let i = 0; i < 3 / DT; i++) C.stepCar(c, { brake: 1 }, DT);
  assert(c.vz > 0, 'Holding brake after stopping selects reverse.');
  const turning = C.car({ x: -180, z: 75 }); turning.vz = -12;
  for (let i = 0; i < .7 / DT; i++) C.stepCar(turning, { throttle: 1, steer: 1 }, DT);
  assert(Math.abs(turning.h) > .1);
});

test('Handbrake produces more slip than grip steering without inventing boost', () => {
  const grip = C.car({ x: 0, z: -150, h: Math.PI / 2 }), drift = C.car({ x: 0, z: -150, h: Math.PI / 2 });
  grip.vx = drift.vx = 24;
  let gripSlip = 0, driftSlip = 0;
  for (let i = 0; i < .5 / DT; i++) {
    C.stepCar(grip, { throttle: 1, steer: .75 }, DT);
    C.stepCar(drift, { throttle: 1, steer: .75, handbrake: true }, DT);
    gripSlip = Math.max(gripSlip, Math.abs(grip.slip)); driftSlip = Math.max(driftSlip, Math.abs(drift.slip));
  }
  assert(driftSlip > gripSlip * 2); assert(driftSlip > .15); assert.equal(drift.boosting, false);
});

test('Nitrous depletes under boost and replenishes through clean driving', () => {
  const g = C.car({ x: -180, z: 150 }); g.vz = -23; g.nitro = 70;
  for (let i = 0; i < 1.5 / DT; i++) C.stepCar(g, { throttle: 1, nitro: true }, DT);
  assert(g.nitro < 38); const low = g.nitro;
  for (let i = 0; i < 2.5 / DT; i++) C.stepCar(g, { throttle: 1 }, DT);
  assert(g.nitro > low + 5); assert(g.nitro <= 100);
});

test('Warehouse occlusion blocks actual sightlines and navigation avoids solids', () => {
  assert.equal(C.clearLine({ x: -60, z: 75 }, { x: 60, z: 75 }), false);
  assert.equal(C.clearLine({ x: -60, z: 0 }, { x: 60, z: 0 }), true);
  const from = { x: -60, z: 75 }, to = { x: 60, z: 75 }, path = C.pathfind(from, to);
  assert(path.length >= 3);
  let prior = from;
  for (const p of path) { assert(C.clearLine(prior, p, 2)); prior = p; }
  assert(C.distance(prior, to) < .01);
});

test('Solid impacts and district boundaries cannot be driven through at high speed', () => {
  const c = C.car({ x: -60, z: 75, h: Math.PI / 2 }); c.vx = 55;
  for (let i = 0; i < 2 / DT; i++) C.stepCar(c, { throttle: 1, nitro: true }, DT);
  assert(c.x <= -42 - c.radius + .01, 'The center warehouse must remain solid.');
  const edge = C.car({ x: -180, z: -170 }); edge.vz = -55;
  for (let i = 0; i < 2 / DT; i++) C.stepCar(edge, { throttle: 1, nitro: true }, DT);
  assert(edge.z >= -C.WORLD.boundZ + edge.radius - .01);
});

test('A complete rehearsal records actual timestamps/poses and replay follows them', () => {
  const g = recordedGame();
  assert.equal(g.gate, 5); assert(g.record.length > 500); assert(g.rehearsalTime > 30 && g.rehearsalTime < 90);
  for (let i = 1; i < g.record.length; i++) assert(g.record[i].t > g.record[i - 1].t);
  for (const sample of [g.record[50], g.record[200], g.record[400]]) {
    const replay = C.replayAt(g.record, sample.t);
    assert(C.distance(sample, replay) < 1e-6); assert(Math.abs(C.angle(sample.h - replay.h)) < 1e-6);
  }
  g.startLive(); for (let i = 0; i < 4 / DT; i++) g.step(DT, {});
  const actual = C.replayAt(g.record, g.liveTime);
  assert(C.distance(g.team, actual) < 1e-6);
});

test('End-to-end winning run: recording, diversion, archive, evasion, extraction and exact payout', () => {
  const g = recordedGame(1200); g.startLive();
  drive(g, new Driver('live'), 130, s => ['success', 'bust'].includes(s.phase));
  assert.equal(g.phase, 'success'); assert.equal(g.peakHeat, 2); assert.equal(g.heat, 0);
  assert.equal(g.lastPayout, 6000); assert.equal(g.bank, 7200); assert.equal(g.haul, 0);
  assert(g.stats.diversionSeconds > 10); assert(g.stats.evasions >= 1); assert(g.stats.nitroUsed > 10);
  g.finish(true); assert.equal(g.bank, 7200, 'A completed run must not pay twice.');
});

test('Bust at the archive loses the entire unbanked haul and preserves banked cash', () => {
  const g = recordedGame(7200); g.startLive();
  drive(g, new Driver('live'), 100, s => s.hasArchive || s.phase === 'bust');
  assert.equal(g.haul, 5000); assert.equal(g.heat, 2);
  drive(g, new Driver('bust'), 80, s => s.phase === 'bust');
  assert.equal(g.phase, 'bust'); assert.equal(g.haul, 0); assert.equal(g.bank, 7200); assert.equal(g.lastPayout, 0);
  const frames = g.record.length; g.retry();
  assert.equal(g.phase, 'countdown'); assert.equal(g.record.length, frames); assert.equal(g.bank, 7200);
});

test('Pause freezes simulation and an active pursuit blocks banking', () => {
  const g = recordedGame(); g.startLive();
  for (let i = 0; i < 4 / DT; i++) g.step(DT, { throttle: 1 });
  const before = [g.player.x, g.player.z, g.liveTime, g.police.x, g.police.z]; g.paused = true;
  for (let i = 0; i < 10 / DT; i++) g.step(DT, { throttle: 1, nitro: true });
  assert.deepEqual([g.player.x, g.player.z, g.liveTime, g.police.x, g.police.z], before);
  g.paused = false;
  // Deliberately arrange a gate-condition fixture; the full-win test above drives naturally.
  Object.assign(g.player, C.car({ ...C.EXTRACTION })); g.pickup();
  Object.assign(g.police, C.car({ x: -60, z: 140, h: Math.PI }));
  g.police.alert = true; g.police.lastKnown = { ...C.EXTRACTION }; g.police.path = []; g.police.planClock = 0; g.police.search = 0;
  for (let i = 0; i < 1.3 / DT; i++) g.step(DT, {});
  assert.equal(g.phase, 'live'); assert.equal(g.haul, 5000); assert.equal(g.bank, 0);
});

test('Fixed-step handling gives comparable results at 60 and 120 Hz', () => {
  function run(dt) { const c = C.car({ x: -180, z: 150 }); for (let i = 0; i < Math.round(5 / dt); i++) C.stepCar(c, { throttle: 1 }, dt); return c; }
  const a = run(1/60), b = run(1/120); assert(C.distance(a, b) < .3); assert(Math.abs(a.speed - b.speed) < .1);
});
