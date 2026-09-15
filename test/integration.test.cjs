/* Headless integration test, NOT a visual/WebGL browser test.
   Executes the actual game.js with real Three.js scene/geometry classes, a DOM
   fixture and a stubbed renderer/audio surface. No browser or network is used. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const test = require('node:test');
const C = require('../core.js');
const Three = require('../vendor/three.min.js');
const Driver = require('./driver.js');

function harness() {
  let now = 0, renderCalls = 0, raf;
  const handlers = {}, docHandlers = {}, stored = new Map(), elements = new Map();
  const canvas2d = new Proxy({}, { get: (o, k) => k in o ? o[k] : k === 'createRadialGradient' ? () => ({ addColorStop() {} }) : () => {}, set: (o,k,v) => (o[k]=v,true) });
  const document = { hidden: false, activeElement: null, addEventListener(k, fn) { docHandlers[k] = fn; },
    getElementById: id => { assert(elements.has(id), 'Unknown HTML element: ' + id); return elements.get(id); },
    createElement: tag => element(tag) };
  function element(tag) {
    const classes = new Set();
    return { tag, style: {}, textContent: '', innerHTML: '', value: '', children: [], listeners: {},
      classList: { add: c => classes.add(c), remove: c => classes.delete(c), contains: c => classes.has(c),
        toggle(c, force) { const on = force === undefined ? !classes.has(c) : force; if(on)classes.add(c);else classes.delete(c);return on; } },
      appendChild(n) { this.children.push(n); }, setAttribute(k,v) { this[k]=v; },
      focus() { document.activeElement=this; }, addEventListener(k, fn) { this.listeners[k] = fn; }, getContext: () => canvas2d };
  }
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  for (const m of html.matchAll(/id="([^"]+)"/g)) elements.set(m[1], element(m[1]));
  document.body = element('body');
  class Renderer {
    constructor() { this.info = { render: { calls: 0, triangles: 0 } }; }
    setPixelRatio() {} setSize() {}
    render(scene, camera) {
      assert(scene.isScene && camera.isPerspectiveCamera); scene.updateMatrixWorld(); camera.updateMatrixWorld();
      renderCalls++; let count = 0; scene.traverse(o => { if(o.isMesh)count++; });
      this.info.render.calls = count; assert(count > 100, 'The real district geometry must have been created.');
    }
  }
  const win = { THREE: { ...Three, WebGLRenderer: Renderer }, BlacklineCore: C, innerWidth: 1280, innerHeight: 800, devicePixelRatio: 1,
    addEventListener(k, fn) { handlers[k] = fn; } };
  const context = vm.createContext({ window: win, document, location: { search: '' }, performance: { now: () => now },
    localStorage: { getItem: k => stored.get(k), setItem: (k,v) => stored.set(k,v) }, URLSearchParams,
    requestAnimationFrame(fn) { raf = fn; }, console, Math, Set });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../game.js'), 'utf8'), context, { filename: 'game.js' });
  assert.equal(elements.get('errorMessage').textContent, '', 'Startup must not show a fatal error.');
  function frames(seconds) { for(let i=0;i<Math.ceil(seconds*60);i++) { now += 1000/60; const cb=raf; cb(now); } }
  function key(code, up=false) { handlers[up ? 'keyup' : 'keydown']({ code, repeat:false, preventDefault() {} }); }
  return { app: win.BlacklineApp, elements, stored, frames, key, handlers, get renders() { return renderCalls; } };
}

test('Actual presentation starts, responds to keyboard, updates HUD, switches camera and pauses', () => {
  const h = harness(); h.frames(.1); assert(h.renders > 0);
  h.elements.get('startButton').onclick(); assert.equal(h.app.game.phase, 'rehearsal');
  h.key('KeyW'); h.frames(3); h.key('KeyW',true);
  assert(h.app.game.player.speed > 20); assert(Number(h.elements.get('speed').textContent) > 60);
  h.key('KeyC'); h.frames(.1); assert.equal(h.app.cameraStatus(), 'tactical');
  h.key('Escape'); const z=h.app.game.player.z; h.frames(2); assert.equal(h.app.game.player.z,z);
  assert.equal(h.elements.get('pauseScreen').classList.contains('hidden'),false);
  h.elements.get('resumeButton').onclick(); h.key('KeyW'); h.frames(.5); h.key('KeyW',true); assert(h.app.game.player.z<z);
  h.handlers.blur(); assert(h.app.game.paused);
  h.elements.get('newRecordingButton').onclick(); h.frames(.1);
  assert.equal(h.app.game.phase,'rehearsal'); assert.equal(h.app.game.paused,false);
  assert(h.elements.get('pauseScreen').classList.contains('hidden'),'A fresh recording closes the pause overlay even when its phase name is unchanged.');
});

test('Actual HUD and result screen bank one full simulated heist and preserve held throttle at GO', () => {
  const h = harness(); h.elements.get('startButton').onclick(); h.app.setTestDriver(new Driver('rehearsal'));
  for(let i=0;i<150 && h.app.game.phase!=='ready';i++)h.frames(1);
  assert.equal(h.app.game.phase,'ready'); assert(!h.elements.get('readyScreen').classList.contains('hidden'));
  assert(h.elements.get('recordSummary').textContent.includes('recorded samples'));
  h.elements.get('liveButton').onclick(); h.frames(.1); h.key('KeyW'); h.frames(4); h.key('KeyW',true);
  assert(h.app.game.player.speed>5, 'Held throttle must survive the countdown-to-live transition.');
  h.app.live(); h.app.setTestDriver(new Driver('live'));
  for(let i=0;i<130 && !['success','bust'].includes(h.app.game.phase);i++)h.frames(1);
  assert.equal(h.app.game.phase,'success'); assert.equal(h.elements.get('resultMoney').textContent,'+$6,000');
  assert.equal(h.elements.get('bank').textContent,'$6,000'); assert.equal(h.stored.get('blackline-prototype-bank-v1'),'6000');
  h.frames(3); assert.equal(h.app.game.bank,6000);
  h.elements.get('againButton').onclick(); h.frames(.2); assert.equal(h.app.game.phase,'countdown'); assert.equal(h.app.game.bank,6000);
});
