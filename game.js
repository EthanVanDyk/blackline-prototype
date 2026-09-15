/* Presentation, keyboard controls, generated audio, and fixed-step game loop. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const fail = message => { $('errorMessage').textContent = message; $('errorScreen').classList.remove('hidden'); };
  if (!window.THREE || !window.BlacklineCore) { fail('A local game file is missing. Extract the whole ZIP before opening index.html.'); return; }
  const T = window.THREE, C = window.BlacklineCore;
  let bank = 0;
  try { bank = Number(localStorage.getItem('blackline-prototype-bank-v1')) || 0; } catch (_) { /* file:// storage can be disabled */ }
  const game = new C.Game({ bank });
  let renderer;
  try {
    renderer = new T.WebGLRenderer({ canvas: $('world'), antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.35));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
  } catch (e) { fail('WebGL could not initialize. ' + e.message); return; }
  const scene = new T.Scene(); scene.background = new T.Color(0x172b36); scene.fog = new T.Fog(0x172b36, 105, 440);
  const camera = new T.PerspectiveCamera(60, window.innerWidth / window.innerHeight, .15, 1500);
  scene.add(new T.HemisphereLight(0xa7d4e7, 0x6b5542, 2.0));
  const moon = new T.DirectionalLight(0xc8e3eb, 2.4); moon.position.set(-180, 220, -100); scene.add(moon);
  const sunset = new T.DirectionalLight(0xffb778, 1.2); sunset.position.set(160, 40, 110); scene.add(sunset);
  const mat = (color, roughness = .85, metalness = .05) => new T.MeshStandardMaterial({ color, roughness, metalness });
  const materials = { road: mat(0x222c32), apron: mat(0x405052), wall: mat(0x394c56), roof: mat(0x273d45),
    copper: mat(0xe69448, .5, .55), rubber: mat(0x0b141b), glass: mat(0x203643, .16, .6),
    dark: mat(0x182830), white: mat(0xc1cbcb), steel: mat(0x5e7279, .55, .5) };
  const unitBox = new T.BoxGeometry(1, 1, 1);
  function box(w, h, d, x, y, z, material, parent = scene) {
    const m = new T.Mesh(unitBox, material); m.scale.set(w, h, d); m.position.set(x, y, z); parent.add(m); return m;
  }
  function batchBoxes(list, material, parent = scene) {
    const inst = new T.InstancedMesh(unitBox, material, list.length), o = new T.Object3D();
    list.forEach((b, i) => { o.position.set(b[3], b[4], b[5]); o.scale.set(b[0], b[1], b[2]); o.rotation.set(0, b[6] || 0, 0); o.updateMatrix(); inst.setMatrixAt(i, o.matrix); });
    inst.instanceMatrix.needsUpdate = true; parent.add(inst); return inst;
  }
  function flat(w, d, x, z, material, y = .03, parent = scene) {
    const m = new T.Mesh(new T.PlaneGeometry(w, d), material); m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); parent.add(m); return m;
  }
  function labelTexture(text, color = '#e2eeee', bg = '#101f29', width = 512, height = 128) {
    const c = document.createElement('canvas'); c.width = width; c.height = height;
    const ctx = c.getContext('2d'); ctx.fillStyle = bg; ctx.fillRect(0, 0, width, height);
    ctx.font = 'bold 54px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = color; ctx.fillText(text, width / 2, height / 2, width - 30);
    const tex = new T.CanvasTexture(c); tex.colorSpace = T.SRGBColorSpace; return tex;
  }
  function sign(text, x, y, z, w = 16, h = 4, color = '#e0e9e6', parent = scene) {
    const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ map: labelTexture(text, color), side: T.DoubleSide }));
    m.position.set(x, y, z); parent.add(m); return m;
  }
  function sprite(text, color, w = 11, h = 2.75) {
    const s = new T.Sprite(new T.SpriteMaterial({ map: labelTexture(text, color), transparent: true, depthTest: false, opacity: .9 }));
    s.scale.set(w, h, 1); return s;
  }
  function glowTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const cx = c.getContext('2d'), g = cx.createRadialGradient(32, 32, 3, 32, 32, 31);
    g.addColorStop(0, '#ffffffff'); g.addColorStop(.4, '#ffffff88'); g.addColorStop(1, '#ffffff00');
    cx.fillStyle = g; cx.fillRect(0, 0, 64, 64); return new T.CanvasTexture(c);
  }
  const glow = glowTexture();
  function glowPlane(w, d, x, z, color, opacity, parent = scene) {
    return flat(w, d, x, z, new T.MeshBasicMaterial({ color, map: glow, transparent: true, opacity, depthWrite: false }), .065, parent);
  }
  // Original low-poly district; no downloaded models, textures, or audio.
  flat(2200, 2200, 0, 0, mat(0x112d3b, .24, .35), -.8);
  box(462, 1, 402, 0, -.51, 0, materials.apron);
  const roadPaint = [], curb = [], fence = [];
  for (const x of C.WORLD.roadX) {
    flat(28, 370, x, 0, materials.road, .005);
    for (let z = -174; z < 180; z += 13) if (C.WORLD.roadZ.every(r => Math.abs(z - r) > 21)) roadPaint.push([.17, .025, 5, x, .045, z]);
    curb.push([.18, .02, 360, x - 12.7, .045, 0], [.18, .02, 360, x + 12.7, .045, 0]);
  }
  for (const z of C.WORLD.roadZ) {
    flat(430, 28, 0, z, materials.road, .015);
    for (let x = -208; x < 215; x += 13) if (C.WORLD.roadX.every(r => Math.abs(x - r) > 21)) roadPaint.push([5, .025, .17, x, .049, z]);
    curb.push([428, .02, .18, 0, .05, z - 12.7], [428, .02, .18, 0, .05, z + 12.7]);
  }
  batchBoxes(roadPaint, mat(0xb1b7ab)); batchBoxes(curb, mat(0x9a8b61));
  // Boundary barriers align with the simulation bounds.
  for (let x = -222; x < 224; x += 8) fence.push([6, 1.05, .8, x, .525, -194], [6, 1.05, .8, x, .525, 194]);
  for (let z = -187; z < 194; z += 8) fence.push([.8, 1.05, 6, -224, .525, z], [.8, 1.05, 6, 224, .525, z]);
  batchBoxes(fence, mat(0x7c827b));
  const yellowTicks = fence.filter((_, i) => i % 2 === 0).map(b => [b[0], .035, b[2], b[3], 1.07, b[5]]);
  batchBoxes(yellowTicks, new T.MeshBasicMaterial({ color: 0xbfa065 }));
  const windowBoxes = [], ribBoxes = [], roofBoxes = [];
  C.WORLD.solids.forEach((o, i) => {
    if (o.kind === 'warehouse') {
      const wallMat = mat([0x344954, 0x415252, 0x334852, 0x3d5155, 0x344951, 0x35434c][i]);
      box(o.w, o.height, o.d, o.x, o.height / 2, o.z, wallMat);
      box(o.w + 1.5, .65, o.d + 1.5, o.x, o.height + .25, o.z, materials.roof);
      box(o.w + .4, .75, o.d + .4, o.x, 1.1, o.z, materials.dark);
      for (let j = -2; j <= 2; j++) {
        box(9, 6.8, .25, o.x + j * 15, 3.45, o.z + o.d / 2 + .14, materials.dark);
        windowBoxes.push([7.5, 1.4, .28, o.x + j * 15, 9.4, o.z + o.d / 2 + .16]);
        ribBoxes.push([.38, o.height, .5, o.x + j * 16, o.height / 2, o.z + o.d / 2 + .28]);
      }
      for (const dx of [-20, 20]) roofBoxes.push([8, 1.6, 12, o.x + dx, o.height + 1.3, o.z]);
      sign(['CALDER FREIGHT', 'LOWBANK STORAGE', 'IRON QUAY / 03', 'BAY TRANSFER', 'SARU IMPOUND', 'BLACKLINE MOTOR'][i], o.x, 8.2, o.z + o.d / 2 + .45, 23, 2.5, i === 4 ? '#c0cfea' : '#ceb99a');
      sign(String(i + 1).padStart(2, '0'), o.x + o.w / 2 + .05, 6, o.z, 9, 5).rotation.y = Math.PI / 2;
    } else {
      const cm = mat(i % 2 ? 0x9c543c : 0x3b7279);
      box(o.w, o.height, o.d, o.x, o.height / 2, o.z, cm);
      for (let n = 0; n < 8; n++) ribBoxes.push([.2, o.height + .04, o.d + .05, o.x - o.w / 2 + o.w * n / 7, o.height / 2, o.z]);
    }
  });
  batchBoxes(windowBoxes, new T.MeshStandardMaterial({ color: 0xe4bb7c, emissive: 0xd8a254, emissiveIntensity: .5, roughness: .5 }));
  batchBoxes(ribBoxes, materials.steel); batchBoxes(roofBoxes, materials.dark);
  // Sparse street lamps and their painted pools of light, avoiding expensive shadow passes.
  const poles = [], lampHeads = [];
  for (const x of C.WORLD.roadX) for (const z of C.WORLD.roadZ) {
    poles.push([.35, 11, .35, x + 20, 5.5, z + 20], [5, .22, .22, x + 17.6, 10.8, z + 20]);
    lampHeads.push([1.6, .2, 1.3, x + 15.6, 10.6, z + 20]);
    glowPlane(20, 20, x + 15, z + 20, 0xfbb361, .16);
  }
  batchBoxes(poles, materials.dark); batchBoxes(lampHeads, new T.MeshBasicMaterial({ color: 0xffd495 }));
  for (let i = 0; i < 22; i++) {
    const x = -550 + i * 51, h = 20 + ((i * 47) % 65);
    box(25 + i % 4 * 8, h, 26, x, h / 2 - 1, -320 - i % 3 * 35, mat(0x233641));
  }
  for (const [x, z] of [[-240, -130], [-120, -215], [90, -215], [245, 95]]) {
    const g = new T.Group(); scene.add(g); g.position.set(x, 0, z);
    const legs = [[2, 45, 2, -15, 22.5, 0], [2, 45, 2, 15, 22.5, 0], [33, 3, 4, 0, 45, 0],
      [2, 3, 72, 0, 45, 25], [.18, 33, .18, 0, 27, 52], [6, 2, 2, 0, 10.5, 52]];
    batchBoxes(legs, mat(0x8b7051), g);
  }
  sign('IRON QUAY', -180, 6.5, 183, 27, 4, '#ffba69');
  const garage = new T.Group(); scene.add(garage); garage.position.set(-60, 0, 183);
  box(25, 11, 12, 0, 5.5, 0, materials.wall, garage); box(17, 7, .4, 0, 3.5, -6.1, materials.dark, garage);
  const garageSign = sign('BLACKLINE / SAFEHOUSE', 0, 9, -6.4, 22, 2.4, '#7ce9c7', garage); garageSign.rotation.y = Math.PI;
  glowPlane(32, 27, -60, 160, 0x4eddb5, .23);
  function makeCar(color, trim, kind) {
    const root = new T.Group(), body = new T.Group(); root.add(body); scene.add(root);
    const paint = mat(color, .38, .45), accent = new T.MeshStandardMaterial({ color: trim, emissive: trim, emissiveIntensity: .18, roughness: .4, metalness: .3 });
    glowPlane(4.8, 7.5, 0, 0, 0x000000, .55, root);
    glowPlane(4.2, 6, 0, 0, trim, .25, root).position.y = .075;
    box(2.35, .65, 4.8, 0, .93, 0, paint, body);
    box(2.5, .17, 4.88, 0, .56, 0, materials.dark, body);
    box(1.92, .65, 2.12, 0, 1.54, .3, materials.glass, body);
    box(1.94, .09, 1.68, 0, 1.9, .4, paint, body);
    box(.2, .03, 4.5, -.63, 1.275, 0, accent, body);
    box(.16, .025, 1.68, -.62, 1.96, .4, accent, body);
    box(2.35, .09, .38, 0, 1.57, 2.12, paint, body);
    box(.12, .4, .16, -.85, 1.36, 2.12, materials.dark, body); box(.12, .4, .16, .85, 1.36, 2.12, materials.dark, body);
    box(2.3, .16, .15, 0, .72, -2.43, materials.dark, body);
    const head = new T.MeshBasicMaterial({ color: 0xe0f9ff }), tail = new T.MeshBasicMaterial({ color: 0xff5147 });
    for (const x of [-.74, .74]) { box(.72, .16, .06, x, 1.08, -2.42, head, body); box(.8, .16, .06, x, 1.08, 2.42, tail, body); }
    const wheels = [];
    for (const x of [-1.16, 1.16]) for (const z of [-1.53, 1.54]) {
      const pivot = new T.Group(); pivot.position.set(x, .48, z); root.add(pivot);
      const tyre = new T.Mesh(new T.CylinderGeometry(.46, .46, .34, 12), materials.rubber); tyre.rotation.z = Math.PI / 2; pivot.add(tyre);
      const rim = new T.Mesh(new T.CylinderGeometry(.29, .29, .355, 8), materials.steel); rim.rotation.z = Math.PI / 2; pivot.add(rim);
      wheels.push({ pivot, front: z < 0 });
    }
    const lights = [];
    if (kind === 'police') {
      box(2.42, .22, 2, 0, 1.13, .3, mat(0x264c72), body);
      box(1.8, .1, .55, 0, 2, .4, materials.dark, body);
      for (const x of [-.5, .5]) lights.push(box(.8, .16, .48, x, 2.14, .4, new T.MeshBasicMaterial({ color: x < 0 ? 0xff4045 : 0x4094ff }), body));
    }
    const tag = sprite(kind === 'team' ? 'ELI / RUNBACK' : 'SARU', kind === 'team' ? '#7cf5e0' : '#ffa098', 7, 1.75);
    tag.position.set(0, 4.3, 0); tag.visible = kind !== 'player'; root.add(tag);
    const flame = new T.Mesh(new T.ConeGeometry(.24, 1.4, 7), new T.MeshBasicMaterial({ color: 0x6ce5ff }));
    flame.rotation.x = Math.PI / 2; flame.position.set(-.7, .61, 2.9); flame.visible = false; root.add(flame);
    return { root, body, wheels, lights, tag, flame, kind };
  }
  const playerModel = makeCar(0x172e36, 0xe8974c, 'player');
  const teamModel = makeCar(0x175258, 0x65f8da, 'team');
  const copModel = makeCar(0xc5d2d2, 0x317dcb, 'police'); teamModel.root.visible = copModel.root.visible = false;
  function makeMarker(color, text) {
    const group = new T.Group(); scene.add(group);
    const material = new T.MeshBasicMaterial({ color, transparent: true, opacity: .8, side: T.DoubleSide, depthWrite: false });
    const ring = new T.Mesh(new T.RingGeometry(12.5, 13.2, 48), material); ring.rotation.x = -Math.PI / 2; ring.position.y = .13; group.add(ring);
    const inner = new T.Mesh(new T.RingGeometry(10.6, 10.75, 48), material); inner.rotation.x = -Math.PI / 2; inner.position.y = .14; group.add(inner);
    const glowMat = new T.MeshBasicMaterial({ color, transparent: true, opacity: .55 });
    box(.28, 5.5, .28, -12.8, 2.75, 0, glowMat, group); box(.28, 5.5, .28, 12.8, 2.75, 0, glowMat, group);
    const tag = sprite(text, '#' + new T.Color(color).getHexString(), 15, 3.75); tag.position.y = 7; group.add(tag);
    return { group, ring, inner, tag };
  }
  const gateMarker = makeMarker(0xffb45c, 'RECORDING GATE');
  const pickupMarker = makeMarker(0xffab58, 'TAKE THE ARCHIVE'); pickupMarker.group.position.set(C.PICKUP.x, 0, C.PICKUP.z);
  const exitMarker = makeMarker(0x63e9b3, 'EXTRACTION'); exitMarker.group.position.set(C.EXTRACTION.x, 0, C.EXTRACTION.z);
  const archiveBox = box(1.25, .7, 1.75, C.PICKUP.x, 1.5, C.PICKUP.z, materials.copper);
  let routeLine = null;
  function drawRecordedRoute() {
    if (routeLine) { scene.remove(routeLine); routeLine.geometry.dispose(); routeLine.material.dispose(); }
    const points = game.record.filter((_, i) => i % 3 === 0).map(p => new T.Vector3(p.x, .12, p.z));
    routeLine = new T.Line(new T.BufferGeometry().setFromPoints(points), new T.LineBasicMaterial({ color: 0x66e4d6, transparent: true, opacity: .55 })); scene.add(routeLine);
  }
  // Small synthesized sound bank; AudioContext begins only after a user gesture.
  let audio = null, muted = false;
  function startAudio() {
    if (audio) { audio.ctx.resume().catch(() => {}); return; }
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)(), master = ctx.createGain(); master.gain.value = .18; master.connect(ctx.destination);
      const engine = ctx.createOscillator(), filter = ctx.createBiquadFilter(), gain = ctx.createGain();
      engine.type = 'sawtooth'; engine.frequency.value = 40; filter.type = 'lowpass'; filter.frequency.value = 260; gain.gain.value = .17;
      engine.connect(filter); filter.connect(gain); gain.connect(master); engine.start();
      const siren = ctx.createOscillator(), sirenGain = ctx.createGain(); siren.type = 'sine'; sirenGain.gain.value = 0;
      siren.connect(sirenGain); sirenGain.connect(master); siren.start();
      const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), samples = noiseBuffer.getChannelData(0);
      for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
      const noise = ctx.createBufferSource(), noiseFilter = ctx.createBiquadFilter(), noiseGain = ctx.createGain();
      noise.buffer = noiseBuffer; noise.loop = true; noiseFilter.type = 'bandpass'; noiseFilter.frequency.value = 1300; noiseGain.gain.value = 0;
      noise.connect(noiseFilter); noiseFilter.connect(noiseGain); noiseGain.connect(master); noise.start();
      audio = { ctx, master, engine, filter, gain, siren, sirenGain, noiseGain };
    } catch (_) { /* Silent mode is fully playable. */ }
  }
  function soundUpdate() {
    if (!audio) return;
    const a = audio, t = a.ctx.currentTime, active = ['rehearsal', 'live'].includes(game.phase) && !game.paused;
    a.master.gain.setTargetAtTime(muted ? 0 : .18, t, .04);
    a.gain.gain.setTargetAtTime(active ? .1 + game.player.speed / 400 : .025, t, .07);
    a.engine.frequency.setTargetAtTime(35 + game.player.speed * 2 + (game.player.boosting ? 12 : 0), t, .07);
    a.filter.frequency.setTargetAtTime(180 + game.player.speed * 20, t, .05);
    a.siren.frequency.setTargetAtTime(650 + 220 * Math.sin(game.time * 7), t, .015);
    const copVolume = active && game.heat && game.police ? C.clamp(1 - C.distance(game.player, game.police) / 140, 0, 1) * .16 : 0;
    a.sirenGain.gain.setTargetAtTime(copVolume, t, .1);
    a.noiseGain.gain.setTargetAtTime(active ? (game.player.boosting ? .14 : game.player.drift ? .06 : 0) : 0, t, .05);
  }
  function chime(success) {
    if (!audio || muted) return;
    const a = audio, t = a.ctx.currentTime;
    [0, .1, .2].forEach((delay, i) => {
      const osc = a.ctx.createOscillator(), g = a.ctx.createGain();
      osc.type = 'sine'; osc.frequency.value = success ? [440, 554, 659][i] : [210, 180, 130][i];
      g.gain.setValueAtTime(.3, t + delay); g.gain.exponentialRampToValueAtTime(.001, t + delay + .25);
      osc.connect(g); g.connect(a.master); osc.start(t + delay); osc.stop(t + delay + .3);
    });
  }
  const keys = new Set(); let camMode = 0, lastPhase = '', toastUntil = 0, radioUntil = 0, eventSeen = 0;
  let look = new T.Vector3(), cameraSnap = true, testDriver = null;
  const input = () => testDriver ? testDriver.input(game) : ({ throttle: keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0,
    brake: keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0,
    steer: (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0),
    handbrake: keys.has('Space'), nitro: keys.has('ShiftLeft') || keys.has('ShiftRight') });
  function focusGame() { $('world').focus({ preventScroll: true }); }
  function rehearsal() { keys.clear(); testDriver = null; game.startRehearsal(); lastPhase = ''; cameraSnap = true; if (routeLine) routeLine.visible = false; focusGame(); }
  function live() { keys.clear(); testDriver = null; game.startLive(); lastPhase = ''; drawRecordedRoute(); cameraSnap = true; focusGame(); }
  function retry() { keys.clear(); testDriver = null; game.retry(); lastPhase = ''; if (game.phase === 'countdown') drawRecordedRoute(); cameraSnap = true; focusGame(); }
  function pause(value) { if (!['rehearsal', 'live', 'countdown'].includes(game.phase)) return; game.paused = value; keys.clear(); $('pauseScreen').classList.toggle('hidden', !value); if (!value) focusGame(); }
  function mute() { muted = !muted; $('muteButton').textContent = muted ? 'AUDIO OFF' : 'AUDIO ON'; $('muteButton').setAttribute('aria-label', muted ? 'Unmute audio' : 'Mute audio'); }
  $('startButton').onclick = () => { startAudio(); rehearsal(); };
  $('liveButton').onclick = () => { startAudio(); live(); };
  $('recordAgainButton').onclick = rehearsal; $('newRecordingButton').onclick = rehearsal; $('newLapButton').onclick = rehearsal;
  $('againButton').onclick = live; $('retryButton').onclick = retry; $('resumeButton').onclick = () => pause(false);
  $('pauseButton').onclick = () => pause(true); $('muteButton').onclick = mute;
  window.addEventListener('keydown', e => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code) && document.activeElement === $('world')) e.preventDefault();
    if (!e.repeat) {
      if (e.code === 'Escape' || e.code === 'KeyP') { e.preventDefault(); pause(!game.paused); return; }
      if (e.code === 'KeyM') mute();
      if (e.code === 'KeyC') { camMode = 1 - camMode; cameraSnap = true; game.event('radio', camMode ? 'TACTICAL CAMERA / North stays at the top of the minimap.' : 'CHASE CAMERA / Follow the nose of the car.'); }
      if (e.code === 'KeyR' && ['rehearsal', 'live', 'countdown'].includes(game.phase)) { retry(); return; }
      if (e.code === 'Enter' && game.phase === 'intro') { startAudio(); rehearsal(); return; }
      if (e.code === 'KeyE' && game.phase === 'ready') { startAudio(); live(); return; }
    }
    keys.add(e.code);
  });
  window.addEventListener('keyup', e => keys.delete(e.code));
  window.addEventListener('blur', () => { keys.clear(); pause(true); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(true); });
  $('world').addEventListener('webglcontextlost', e => { e.preventDefault(); pause(true); fail('The browser lost its graphics context. Reload to retry; banked cash is retained.'); });
  window.addEventListener('resize', () => { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); });
  function updateCar(model, c, visualTime) {
    if (!c) { model.root.visible = false; return; }
    model.root.visible = true; model.root.position.set(c.x, 0, c.z); model.root.rotation.y = -c.h;
    model.body.rotation.z = (c.steer || 0) * Math.min(c.speed / 400, .07);
    model.body.position.y = Math.sin(visualTime * 22) * Math.min(c.speed / 2200, .018);
    model.wheels.forEach(w => { w.pivot.rotation.y = w.front ? -(c.steer || 0) * .42 : 0; w.pivot.rotation.x = c.wheel || 0; });
    model.flame.visible = !!c.boosting;
    model.flame.scale.y = .75 + .25 * Math.sin(visualTime * 65);
    if (model.kind === 'police') model.lights.forEach((l, i) => l.material.color.setHex(Math.floor(visualTime * 9) % 2 === i ? (i ? 0x76bbff : 0xff5757) : 0x182330));
  }
  function updateCamera(dt, elapsed) {
    const c = game.player;
    if (game.phase === 'intro') {
      camera.position.set(120 + Math.sin(elapsed * .04) * 25, 200, 270); camera.lookAt(-35, 0, 0); cameraSnap = true; return;
    }
    const fx = Math.sin(c.h), fz = -Math.cos(c.h), desired = new T.Vector3();
    const lookAt = new T.Vector3(c.x + fx * 11, 1, c.z + fz * 11);
    if (camMode) { desired.set(c.x + 22, 90, c.z + 55); lookAt.set(c.x, 0, c.z - 10); }
    else {
      const back = 20 + c.speed * .12; desired.set(c.x - fx * back, 14 + c.speed * .035, c.z - fz * back);
      if (!C.clearLine(c, { x: desired.x, z: desired.z }, 1)) desired.y = 33;
    }
    const smoothing = cameraSnap ? 1 : 1 - Math.exp(-5 * dt);
    camera.position.lerp(desired, smoothing); look.lerp(lookAt, smoothing); camera.lookAt(look); cameraSnap = false;
    const fov = (camMode ? 56 : 60) + (c.boosting ? 5 : 0);
    if (Math.abs(camera.fov - fov) > .02) { camera.fov = C.mix(camera.fov, fov, Math.min(1, dt * 3)); camera.updateProjectionMatrix(); }
  }
  const map = $('minimap').getContext('2d');
  function drawMap() {
    const w = 440, h = 380, sx = w / 490, sz = h / 425;
    const xy = p => [w / 2 + p.x * sx, h / 2 + p.z * sz];
    map.clearRect(0, 0, w, h); map.fillStyle = '#10222c'; map.fillRect(14, 14, w - 28, h - 28);
    map.strokeStyle = '#3c4e54'; map.lineWidth = 28 * sx;
    for (const x of C.WORLD.roadX) { map.beginPath(); map.moveTo(...xy({ x, z: -180 })); map.lineTo(...xy({ x, z: 180 })); map.stroke(); }
    for (const z of C.WORLD.roadZ) { map.beginPath(); map.moveTo(...xy({ x: -210, z })); map.lineTo(...xy({ x: 210, z })); map.stroke(); }
    for (const o of C.WORLD.solids) { const p = xy(o); map.fillStyle = '#172f3a'; map.fillRect(p[0] - o.w * sx / 2, p[1] - o.d * sz / 2, o.w * sx, o.d * sz); }
    map.strokeStyle = '#657374'; map.lineWidth = 1; map.strokeRect(w / 2 - 224 * sx, h / 2 - 194 * sz, 448 * sx, 388 * sz);
    if (game.phase === 'rehearsal') {
      map.strokeStyle = '#b38649'; map.lineWidth = 2; map.setLineDash([6, 7]); map.beginPath(); map.moveTo(...xy(C.START));
      C.GATES.forEach(g => map.lineTo(...xy(g))); map.stroke(); map.setLineDash([]);
    } else if (game.record.length > 2) {
      map.strokeStyle = '#52aa9ca0'; map.lineWidth = 2; map.beginPath();
      game.record.forEach((p, i) => { if (i % 8 === 0) { if (i === 0) map.moveTo(...xy(p)); else map.lineTo(...xy(p)); } }); map.stroke();
    }
    const dot = (p, color, r, ring = false) => { const a = xy(p); map.beginPath(); map.arc(a[0], a[1], r, 0, Math.PI * 2); if (ring) { map.strokeStyle = color; map.lineWidth = 2; map.stroke(); } else { map.fillStyle = color; map.fill(); } };
    if (game.phase === 'rehearsal') C.GATES.forEach((g, i) => { dot(g, i < game.gate ? '#60cbbb' : '#d19a58', 5); if (i === game.gate) dot(g, '#ffc77b', 13, true); });
    else { if (!game.hasArchive) { dot(C.PICKUP, '#ffb35b', 7); dot(C.PICKUP, '#ffb35b', 15, true); } dot(C.EXTRACTION, '#62e6b5', 8); }
    if (game.team) dot(game.team, '#67f0de', 6);
    if (game.police) dot(game.police, game.heat ? '#ff6868' : '#a8666b', 6);
    const p = xy(game.player); map.save(); map.translate(...p); map.rotate(game.player.h);
    map.beginPath(); map.moveTo(0, -10); map.lineTo(6.5, 7); map.lineTo(0, 3); map.lineTo(-6.5, 7); map.closePath(); map.fillStyle = '#fff4dc'; map.fill(); map.strokeStyle = '#081018'; map.lineWidth = 1.5; map.stroke(); map.restore();
  }
  const money = n => '$' + Math.round(n).toLocaleString('en-US');
  const show = (id, visible) => $(id).classList.toggle('hidden', !visible);
  function phaseUI() {
    if (lastPhase === game.phase) return;
    lastPhase = game.phase;
    if (['intro', 'ready', 'success', 'bust'].includes(game.phase)) keys.clear();
    show('intro', game.phase === 'intro'); show('hud', game.phase !== 'intro');
    show('readyScreen', game.phase === 'ready'); show('resultScreen', ['success', 'bust'].includes(game.phase)); show('pauseScreen', false);
    if (game.phase === 'ready') { $('recordSummary').textContent = `${game.rehearsalTime.toFixed(1)} seconds · ${game.record.length} recorded samples · five gates passed.`; drawRecordedRoute(); }
    if (game.phase === 'success' || game.phase === 'bust') {
      const won = game.phase === 'success'; chime(won);
      $('resultKicker').textContent = won ? 'DEAD FREIGHT / COMPLETE' : 'DEAD FREIGHT / BUSTED';
      $('resultTitle').textContent = won ? 'Clean getaway.' : 'End of the line.';
      $('resultDescription').textContent = won ? 'The archive is safe. Your recorded diversion bought the crew a way out.' : 'SARU contained your car. This attempt’s unbanked cash is lost; your existing bank is untouched.';
      $('resultMoney').textContent = won ? '+' + money(game.lastPayout) : 'HAUL LOST'; $('resultMoney').style.color = won ? 'var(--cyan)' : 'var(--red)';
      $('resultStats').textContent = `${game.liveTime.toFixed(1)}s live run · ${game.stats.evasions} evasion${game.stats.evasions === 1 ? '' : 's'} · bank ${money(game.bank)}`;
      if (won) { try { localStorage.setItem('blackline-prototype-bank-v1', String(game.bank)); } catch (_) { /* optional persistence */ } }
    }
  }
  function updateHUD() {
    phaseUI(); if (game.phase === 'intro') return;
    $('bank').textContent = money(game.bank); $('haul').textContent = money(game.haul);
    $('multiplier').textContent = `EXTRACTION ×${game.multiplier.toFixed(2)}`;
    $('speed').textContent = String(Math.round(game.player.speed * 3.6)).padStart(3, '0');
    const forward = game.player.vx * Math.sin(game.player.h) - game.player.vz * Math.cos(game.player.h);
    $('gear').textContent = forward < -1 ? 'R' : game.player.speed < .5 ? 'N' : String(Math.min(6, 1 + Math.floor(game.player.speed / 9)));
    $('driveState').textContent = game.player.boosting ? 'NITROUS' : game.player.drift ? 'DRIFT' : camMode ? 'TACTICAL / GRIP' : 'GRIP';
    $('driveState').style.color = game.player.drift ? 'var(--amber)' : 'var(--cyan)';
    $('nitroFill').style.width = game.player.nitro + '%'; $('nitroValue').textContent = Math.round(game.player.nitro) + '%';
    $('nitroHint').textContent = game.player.boosting ? 'BOOST ACTIVE' : game.drafting ? 'DRAFTING / RECHARGING' : game.player.clean > .9 ? 'CLEAN LINE / RECHARGING' : 'HOLD SHIFT TO BOOST';
    $('stepRecord').className = game.phase === 'rehearsal' || game.phase === 'ready' ? 'active' : 'done';
    $('stepTake').className = game.hasArchive ? 'done' : ['live', 'countdown'].includes(game.phase) ? 'active' : '';
    $('stepExit').className = game.phase === 'success' ? 'done' : game.hasArchive ? 'active' : '';
    let objective = '', hint = '', progress = 0;
    if (game.phase === 'rehearsal') {
      objective = `Record your line · ${game.gate + 1} / 5`; hint = `${C.GATES[game.gate].label} · ${Math.round(C.distance(game.player, game.target))} m · brake before the corners`;
      progress = game.gate / 5;
    } else if (game.phase === 'ready') { objective = 'Diversion captured'; hint = 'Launch the live job when you’re ready.'; progress = 1; }
    else if (!game.hasArchive) { objective = 'Take the archive'; hint = `Orange marker · ${Math.round(C.distance(game.player, C.PICKUP))} m · slow below 36 km/h to collect`; progress = game.hold / .7; }
    else if (game.heat > 0) { objective = 'Lose the patrol'; hint = 'Break sightlines for 5.5 seconds. The green garage stays locked during pursuit.'; }
    else { objective = 'Bring it home'; hint = `Green garage · ${Math.round(C.distance(game.player, C.EXTRACTION))} m · slow below 29 km/h to bank`; progress = game.hold; }
    $('phaseLabel').textContent = game.phase === 'rehearsal' ? 'REHEARSAL' : game.phase === 'ready' ? 'PLAN READY' : 'LIVE RUN';
    $('objective').textContent = objective; $('objectiveHint').textContent = hint; $('objectiveFill').style.width = Math.min(100, progress * 100) + '%';
    show('countdown', game.phase === 'countdown'); $('countdown').textContent = Math.max(1, Math.ceil(game.countdown || 0));
    show('pursuit', !!game.police && !['success', 'bust'].includes(game.phase));
    if (game.police) {
      $('heatText').textContent = game.heat ? 'HEAT ' + game.heat : 'CLEAR';
      $('heat1').className = game.heat >= 1 ? 'lit' : ''; $('heat2').className = game.heat >= 2 ? 'lit red' : '';
      $('copStatus').textContent = !game.heat ? 'GARAGE ACCESS OPEN' : game.police.seen ? 'VISUAL CONTACT' : game.police.target === 'diversion' ? 'ELI DRAWS THE PATROL' : `SEARCHING · ${Math.max(0, 5.5 - game.police.search).toFixed(1)}s`;
      $('searchFill').style.width = (game.heat ? C.clamp(game.police.search / 5.5, 0, 1) * 100 : 100) + '%';
      show('bustWarning', game.bust > .01); $('bustFill').style.width = game.bust * 100 + '%';
    }
    for (const e of game.events.filter(e => e.id > eventSeen)) {
      eventSeen = e.id; $('radio').textContent = e.text; radioUntil = performance.now() + 7200;
      if (['gate', 'evaded', 'pickup'].includes(e.type)) { $('toast').textContent = e.text; toastUntil = performance.now() + 2400; if (e.type === 'gate') chime(true); }
    }
    show('toast', performance.now() < toastUntil && ['live', 'rehearsal'].includes(game.phase));
    $('radio').style.opacity = performance.now() < radioUntil ? '1' : '.25';
    drawMap();
  }
  let previous = performance.now(), elapsed = 0, accumulator = 0, hudClock = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(.1, Math.max(0, (now - previous) / 1000)); previous = now; elapsed += dt;
    if (game.paused) accumulator = 0;
    else {
      accumulator = Math.min(accumulator + dt, .1);
      while (accumulator >= 1 / 120) { game.step(1 / 120, input()); accumulator -= 1 / 120; }
    }
    updateCar(playerModel, game.player, elapsed); updateCar(teamModel, game.team, elapsed); updateCar(copModel, game.police, elapsed);
    gateMarker.group.visible = game.phase === 'rehearsal';
    if (gateMarker.group.visible) gateMarker.group.position.set(game.target.x, 0, game.target.z);
    pickupMarker.group.visible = !game.hasArchive && ['live', 'countdown', 'intro'].includes(game.phase);
    exitMarker.group.visible = ['live', 'countdown', 'intro'].includes(game.phase);
    archiveBox.visible = pickupMarker.group.visible; archiveBox.position.y = 1.8 + Math.sin(elapsed * 2) * .25; archiveBox.rotation.y = elapsed * .65;
    [gateMarker, pickupMarker, exitMarker].forEach(m => { m.inner.rotation.z = elapsed * .35; m.tag.position.y = 7 + Math.sin(elapsed * 2) * .2; });
    updateCamera(dt, elapsed); soundUpdate(); hudClock += dt;
    if (hudClock > .05 || lastPhase !== game.phase) { hudClock = 0; updateHUD(); }
    renderer.render(scene, camera);
  }
  // Local QA uses the public simulation inputs, never a teleport or a forced win.
  window.BlacklineApp = { game, rehearsal, live, retry, pause, renderer,
    setTestDriver(driver) { testDriver = driver; }, getTestDriver() { return testDriver; },
    inputStatus() { return Array.from(keys).join(', ') || 'none'; }, cameraStatus() { return camMode ? 'tactical' : 'chase'; } };
  if (new URLSearchParams(location.search).has('qa')) {
    const s = document.createElement('script'); s.src = 'tests/driver.js';
    s.onload = () => { const q = document.createElement('script'); q.src = 'tests/browser-qa.js'; document.body.appendChild(q); };
    document.body.appendChild(s);
  }
  requestAnimationFrame(frame);
})();
