/* Opt-in visible browser QA. Open index.html?qa=1. Never enabled in normal play. */
(function () {
  const app = window.BlacklineApp, Driver = window.BlacklineTestDriver;
  const panel = document.createElement('details'); panel.className = 'qaPanel'; panel.open = true;
  panel.innerHTML = '<summary>DEVELOPER PLAYTEST</summary><button id="qaWin">Drive full win loop</button><button id="qaBust">Drive bust loop</button><button id="qaRelease">Release controls</button><pre id="qaStatus">Ready.</pre>';
  document.body.appendChild(panel);
  let mode = '', lastPhase = '', result = 'No automatic scenario started.';
  function run(which) { mode = which; result = 'Driving with simulated steering/throttle inputs.'; app.rehearsal(); app.setTestDriver(new Driver('rehearsal')); }
  document.getElementById('qaWin').onclick = () => run('win');
  document.getElementById('qaBust').onclick = () => run('bust');
  document.getElementById('qaRelease').onclick = () => { mode = ''; app.setTestDriver(null); result = 'Keyboard control restored.'; };
  setInterval(() => {
    const g = app.game;
    if (mode && g.phase === 'ready') { app.live(); app.setTestDriver(new Driver('live')); }
    if (mode === 'bust' && g.hasArchive && g.phase === 'live') app.setTestDriver(new Driver('bust'));
    if (mode && ['success', 'bust'].includes(g.phase)) {
      result = (g.phase === (mode === 'win' ? 'success' : 'bust') ? 'PASS' : 'FAIL') + ': ' + mode + ' scenario reached ' + g.phase + '.';
      mode = ''; app.setTestDriver(null);
    }
    document.getElementById('qaStatus').textContent = `${result}\nPhase: ${g.phase}${g.paused ? ' / PAUSED' : ''}\nLap: ${g.rehearsalTime.toFixed(1)}s / gate ${g.gate}\nLive: ${g.liveTime.toFixed(1)}s\nHeat: ${g.heat} / peak ${g.peakHeat}\nHaul: ${g.haul} / bank: ${g.bank}\nPlayer: ${g.player.x.toFixed(1)}, ${g.player.z.toFixed(1)}\nCamera: ${app.cameraStatus()}\nKeys: ${app.inputStatus()}\nDraw calls: ${app.renderer.info.render.calls}\nTriangles: ${app.renderer.info.render.triangles}`;
    lastPhase = g.phase;
  }, 100);
})();
