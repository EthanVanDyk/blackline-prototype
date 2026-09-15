# Need for Speed: Blackline — Iron Quay prototype

A playable, unofficial vertical slice: record a diversion, steal a police archive, escape the patrol, and bank the haul. Based on the supplied Blackline GDD. All cars, buildings, sounds, and graphics are original procedural placeholders.

## A click Link : https://ethanvandyk.github.io/blackline-prototype/

## Run on PC

1. Extract **the entire ZIP** using Windows **Extract All**.
2. Open the `blackline-prototype` folder.
3. Double-click `index.html`, or open it with **Chrome or Edge**.
4. Click **Start Rehearsal**.

Keep the files and `vendor` folder together. JavaScript and WebGL must be enabled. Nothing needs installing; no internet connection, account, paid engine, or build step is needed to play. Audio starts after your first click.

If your browser or workplace policy blocks local files, use a local server with Node.js installed:

```sh
cd blackline-prototype
npx serve .
```

Open the localhost address printed by that command. This optional server requires an internet connection on its first installation. Playing the downloaded game itself does not.

**Why this approach:** Three.js plus vanilla JavaScript gives this small 3D slice a direct browser launch. The pinned Three.js library is bundled locally; everything else is plain source. No Godot editor or Windows export toolchain is required.

## Controls

| Key | Action |
| --- | --- |
| W / Up | Accelerate |
| S / Down | Brake; keep holding to reverse |
| A, D / Left, Right | Steer |
| Space + steering | Handbrake drift |
| Left or right Shift | Nitrous |
| C | Chase / overhead tactical camera |
| Esc / P | Pause / resume |
| R | Retry current attempt; forfeit its unbanked haul |
| M | Mute / unmute |
| Enter on title / E when recording is ready | Start rehearsal / launch live run |

Losing window focus pauses the game. Click **Resume** when you return.

## Complete the heist

1. **Rehearse:** Follow five amber gates around Iron Quay. Brake before junctions. There are no police during rehearsal. The game records your actual positions and timing at 20 samples per second, with a three-minute recording limit.
2. **Run it back:** Launch the live heist. After the countdown, cyan teammate **Eli** repeats your recorded lap and draws the patrol. Cut inland toward the orange archive marker.
3. **Take the archive:** Stay inside orange below **36 km/h** briefly to collect **$5,000**. This raises the pursuit to **Heat 2**.
4. **Escape:** Put warehouses between you and the patrol, or outrun its sight radius. Remain unseen for **5.5 seconds** to clear Heat. Nitrous helps on the freight straights; the overhead camera and north-up minimap help with junctions.
5. **Bank:** Enter green extraction with Heat cleared and stay below **29 km/h** for one second. Heat 2 pays **$5,000 × 1.20 = $6,000**. The HUD also supports Heat 1's ×1.10 multiplier; the multiplier retains the highest Heat reached during the attempt.

Being nearly stationary beside a patrol that can see you fills the red containment bar. After **3.6 seconds**, you are busted and lose **all unbanked cash**. This follows the requested prototype rule, simplifying the GDD's partial-loss rule. Existing banked cash stays safe.

Clean, straight driving replenishes nitrous. Following Eli closely on the same heading adds a drafting refill. Release the brake after stopping at objectives to avoid reversing out of them.

Only banked cash is saved locally, when browser storage is available. Recordings and unfinished runs reset on reload. Storage can differ between local-file and localhost launches.

## Implemented and simplified

- One bounded, roughly 450 × 390 m dock district: freight roads, junctions, solid warehouses, containers, and dock scenery.
- One player coupe with grip/slip handling, handbrake, reverse, nitrous, collision response, generated engine audio, and two camera views.
- One physical police car with road-graph navigation, warehouse line-of-sight checks, last-known-position searching, Heat 1–2, evasion, and containment.
- Actual timestamped Runback capture and interpolated teammate playback; full rehearsal → live heist → extraction/bust → retry loop.
- Speed, Heat/search/bust meters, nitrous, bank, at-risk cash, multiplier, minimap, mission prompts, pause, and results.

**Faked:** Eli's playback is kinematic and ignores collisions; it is a visible recording replay, not an autonomous driving model. Police use a small road graph and deliberately forgiving speed limits. Vehicle physics use a flat-plane arcade model and circle/box collisions. There is no suspension simulation or damage system. Archive collection is a timed proximity trigger; cash has no spending system in this slice.

**Scoped out:** The rest of Port Calder, campaign, day/night cycle, traffic population, extra cars, licensed models/music, garage customization, economy, multiplayer, and monetization. Keeping one complete heist avoids turning the prototype into disconnected unfinished systems.

## Verification and source

**12 automated checks passed:** complete physically driven rehearsal and heist, precise payout, bust loss, recording replay, handling, drift, nitrous, collisions, sightlines, pause, keyboard input, HUD, and restart behavior.

The presentation integration checks execute the real UI code and Three.js scene objects with a **stubbed WebGL renderer**. Actual browser/GPU visuals, Windows performance, and human driving feel remain unverified: this development environment's browser security policy blocked local game URLs. These are not claimed as visually tested results.

To repeat the automated checks with Node.js 18 or later, from this folder:

```sh
node --test tests/simulation.test.cjs tests/integration.test.cjs
```

`core.js` contains physics and mission simulation; `game.js` contains rendering, audio, HUD, and input. Optional `?qa=1` adds visible scripted driving controls for developer inspection. Normal play does not load these helpers.

Three.js **0.160.1** is pinned to its classic script distribution for direct file opening. Source: [jsDelivr's npm package](https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.min.js). Its MIT license is included in `vendor/THREE-LICENSE.txt`. New project code is under `LICENSE.txt`; this does not grant rights to franchise names or trademarks.

## Next steps

1. Playtest on Windows Chrome/Edge with a real GPU; tune camera visibility, keyboard steering, and pursuit difficulty.
2. Replace collision-free teammate replay with a route-following driver that recovers from impacts.
3. Add controller input and better tire/suspension feedback while preserving the current complete loop.
4. Expand one system at a time: a second heist route, then a small garage with meaningful handling upgrades.
