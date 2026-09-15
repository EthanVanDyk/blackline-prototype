/* Deterministic steering/throttle driver for regression and browser QA only. */
(function () {
  'use strict';
  const C = typeof module !== 'undefined' && module.exports ? require('../core.js') : window.BlacklineCore;
  class Driver {
    constructor(mode) {
      this.mode = mode; this.index = 0; this.picked = false;
      this.path = mode === 'rehearsal' ? C.GATES.map(p => ({ ...p })) :
        [{ x: -180, z: 0 }, { x: 60, z: 0 }, { ...C.PICKUP, stop: true },
          { x: 60, z: -150 }, { x: 180, z: -150 }, { x: 180, z: 150 }, { ...C.EXTRACTION, stop: true }];
    }
    input(game) {
      if (game.phase === 'countdown') return {};
      const c = game.player;
      if (this.mode === 'bust') return { brake: c.speed > .5 ? 1 : 0 };
      if (this.mode === 'live' && game.hasArchive && this.index === 2) this.index++;
      let p = this.path[this.index];
      if (!p) return { brake: c.speed > .5 ? 1 : 0 };
      let d = C.distance(c, p);
      if (!p.stop && d < 8 && this.index < this.path.length - 1) { p = this.path[++this.index]; d = C.distance(c, p); }
      const err = C.angle(Math.atan2(p.x - c.x, -(p.z - c.z)) - c.h);
      const boosting = this.mode === 'live' && game.hasArchive && d > 85 && Math.abs(err) < .12 && c.speed > 18 && c.nitro > 2;
      let desired = Math.min(this.mode === 'live' ? (boosting ? 53 : 41) : 30, Math.sqrt(Math.max(0, d - 3) * 13));
      desired = Math.min(desired, 7 + 48 * Math.max(0, Math.cos(err)) ** 5);
      if (p.stop && d < 10) desired = 0;
      return { steer: C.clamp(err * 2.5, -1, 1), throttle: c.speed < desired ? 1 : 0,
        brake: c.speed > desired + .8 ? 1 : 0, nitro: boosting, handbrake: false };
    }
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = Driver;
  if (typeof window !== 'undefined') window.BlacklineTestDriver = Driver;
})();
