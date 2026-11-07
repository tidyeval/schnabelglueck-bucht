import { STAGES } from '../src/stages.js';
import test from 'node:test';
import { routeController } from './route-controller.js';
import assert from 'node:assert/strict';
import { createGame, step, WORLD, netShape, hitsNet, beakPosition, press, hitsBoat, hitsFisher, hitsTerrain, terrainBlocks, ENERGY, airState, hitsPuffer, pufferRadius, paceAt, UNDERWATER_BANDS, LEAP, RARE, rollRare } from '../src/game.js';

test('Pip dives, catches a school, earns the mission once, and a shark ends the stage', () => {
  const g = createGame(() => .5);
  g.items = [];
  for (let i = 0; i < 60; i++) step(g, 1 / 60, true);
  assert.ok(g.player.y > WORLD.water, 'holding dives into the sea');
  for (let i = 0; i < 120; i++) step(g, 1 / 60, false);
  assert.ok(g.player.y < WORLD.water, 'releasing returns to the sky');
  g.player.y = 470; g.player.vy = 0; g.player.wet = true; g.energy = 50;
  g.items = Array.from({ length: 5 }, () => ({ kind: 'fish', ...beakPosition(g.player) }));
  let events = step(g, 1 / 60, true);
  assert.equal(g.fish, 5); assert.equal(g.score, 160); assert.equal(g.mission, true);
  assert.equal(events.filter(e => e.kind === 'mission').length, 1);
  assert.ok(g.energy > 69); assert.equal(g.items.length, 0);
  g.items = [{ kind: 'fish', ...beakPosition(g.player), golden: true }];
  events = step(g, 1 / 60, true);
  assert.equal(g.score, 260); assert.ok(!events.some(e => e.kind === 'mission'));
  g.items = [{ kind: 'shark', x: g.player.x, y: g.player.y, baseY: g.player.y }];
  assert.ok(step(g, 1 / 60, true).some(e => e.kind === 'hurt'));
  assert.equal(g.ended, true); assert.equal(g.endReason, 'shark');
  const score = g.score;
  assert.deepEqual(step(g, 1, true), [], 'ended runs cannot award more fish');
  assert.equal(g.score, score);
  const timed = createGame(); timed.time = WORLD.duration - .01;
  assert.ok(!step(timed, .02, false).some(e => e.kind === 'end'), 'time alone never ends an adventure');
});

test('nets leave clear escape routes, boundaries hold and long frames do not teleport Pip', () => {
  for (const y of [200, 640]) {
    const g = createGame(); g.player.y = y; g.items = [{ kind: 'boat', x: g.player.x + 70, y: WORLD.water, cast: 2.2 }];
    assert.ok(!step(g, .01, false).some(e => e.kind === 'hurt'));
  }
  const g = createGame(); g.player.y = 450; g.items = [{ kind: 'boat', x: g.player.x + 70, y: WORLD.water, cast: 2.2 }];
  assert.ok(step(g, .01, true).some(e => e.kind === 'hurt'));
  const bounds = createGame(); bounds.items = []; bounds.nextEncounter = Infinity;
  const before = bounds.player.y; step(bounds, 100, true); assert.ok(bounds.player.y - before < 15);
  for (let i = 0; i < 1000; i++) { bounds.player.breath = WORLD.breath; step(bounds, .05, true); }
  assert.equal(bounds.player.y, 710);
  assert.ok(g.player.y <= 710, 'Pip remains above the mission panel');
  assert.ok(g.items.length < 35, 'offscreen entities are discarded');
});

test('fishermen announce a fixed cast, splash once and retrieve their visible net', () => {
  const g = createGame(); g.items = [{ kind: 'boat', x: 481, y: WORLD.water, cast: -1 }];
  const boat = g.items[0];
  const events = step(g, .01, false);
  assert.equal(events.filter(e => e.kind === 'warning').length, 1);
  assert.equal(netShape(boat), null, 'no hidden net during windup');
  let splashes = 0;
  for (let i = 0; i < 84; i++) splashes += step(g, .01, false).filter(e => e.kind === 'netSplash').length;
  assert.equal(netShape(boat), null, 'Pip receives at least 0.85 seconds of windup');
  for (let i = 0; i < 12; i++) step(g, .01, false);
  assert.equal(netShape(boat).phase, 'flight');
  const shape = netShape(boat);
  g.player.y = 740;
  assert.deepEqual(netShape(boat), shape, 'the throw never homes in on Pip');
  for (let i = 0; i < 160; i++) splashes += step(g, .01, true).filter(e => e.kind === 'netSplash').length;
  assert.equal(splashes, 1);
  assert.equal(netShape(boat).phase, 'haul');
  assert.equal(boat.reactionKind, 'miss');
  boat.cast = 3.25;
  assert.equal(netShape(boat), null, 'retrieved nets cannot hit Pip');
  for (const cast of [1, 1.5, 2.2, 2.8]) {
    const net = netShape({ x: 300, cast });
    assert.ok(hitsNet({ x: net.x, y: net.y + (net.phase === 'flight' ? 0 : net.depth / 2) + 8 }, net));
    assert.ok(!hitsNet({ x: net.x + net.width + 30, y: net.y + 8 }, net));
  }
});

test('air warns, replenishes above water, and exhaustion ends the run immediately', () => {
  const g = createGame(); g.items = []; g.nextEncounter = Infinity;
  let warned = 0;
  for (let i = 0; i < 600 && !g.ended; i++) warned += step(g, 1 / 60, true).filter(e => e.kind === 'airWarning').length;
  assert.equal(warned, 1); assert.equal(g.ended, true); assert.equal(g.endReason, 'air');
  assert.equal(g.player.breath, 0); assert.equal(g.player.wet, true);
  assert.deepEqual(step(g, .05, false), []);
  const fresh = createGame(); fresh.items = []; fresh.nextEncounter = Infinity; fresh.player.breath = 1;
  for (let i = 0; i < 120; i++) step(fresh, 1 / 60, false);
  assert.equal(fresh.player.breath, WORLD.breath);
});

test('fisher contact is fatal while hull and net contact cost energy', () => {
  for (const [y, offset, cast, fatal] of [[280, 7, -1, true], [380, 0, -1, false], [450, 70, 2.2, false]]) {
    const g = createGame(); g.player.y = y;
    g.items = [{ kind: 'boat', x: g.player.x + offset, cast }];
    assert.equal(step(g, .01, false).filter(e => e.kind === 'hurt').length, 1);
    assert.equal(g.ended, fatal); assert.equal(g.endReason, fatal ? 'fisher' : undefined);
    assert.equal(g.energy, fatal ? 100 : 70);
  }
  const speeds = [];
  for (let stage = 0; stage < STAGES.length; stage++) {
    const g = createGame(Math.random, stage); step(g, .01, false); speeds.push(g.speed);
  }
  assert.ok(speeds.every((speed, i) => !i || speeds[i - 1] < speed), 'later starts continue the journey pace');
});

test('authored stages introduce individual dangers before combinations and finish safely', () => {
  const seen = new Set();
  for (let stage = 0; stage < STAGES.length; stage++) {
    const g = createGame(() => .5, stage);
    for (let wave = 0; wave < STAGES[stage].encounters.length; wave++) {
      g.items = []; g.distance = g.nextEncounter; step(g, .01, false);
      const dangers = g.items.filter(i => !['fish', 'bubble', 'turtle', 'baitball', 'current'].includes(i.kind));
      dangers.forEach(i => seen.add(i.kind));
      if (STAGES[stage].encounters[wave] === 'calm') assert.equal(dangers.length, 0);
      assert.equal(dangers.length, STAGES[stage].encounters[wave].split('-').filter(kind => !['calm', 'turtle'].includes(kind)).length);
    }
    g.items = []; g.distance = g.nextEncounter; step(g, .01, false);
    assert.ok(g.items.some(i => i.kind === 'nest' && i.final));
    assert.equal(g.nextEncounter, Infinity);
  }
  assert.deepEqual([...seen].sort(), ['boat', 'buoy', 'coral', 'diver', 'driftwood', 'gull', 'island', 'jelly', 'mangrove', 'puffer', 'reef', 'shark', 'surfer', 'whirlpool'].sort());
});

test('representative safe routes remain playable in every stage with empty and full cargo', () => {
  for (const dt of [1 / 30, 1 / 60, .016]) for (let stage = 0; stage < STAGES.length; stage++) for (const cargo of [0, 20]) {
    const g = createGame(() => .99, stage); g.cargo = cargo;
    const control = routeController(); let last = false;
    while (g.time < 110 && !g.ended) {
      const holding = control(g); if (holding && !last) press(g); last = holding;
      step(g, dt, holding);
    }
    assert.equal(g.endReason, 'complete', `stage ${stage}, cargo ${cargo}, dt ${dt}`);
    assert.ok(g.time >= 30 && g.time <= 100);
    assert.ok(g.fish > 55); assert.equal(g.cargo, 0); assert.ok(g.delivered > 0);
    assert.ok(g.items.every(i => ['nest', 'fish', 'bubble'].includes(i.kind)), 'safe arrival has no lingering hazards');
  }
});

test('sharks track faster later, telegraph a fixed dash, and stop pursuing above water', () => {
  const movement = [];
  for (const time of [0, 120]) {
    const g = createGame(); g.time = time; g.player.y = 450; g.player.wet = true;
    const shark = { kind: 'shark', x: 470, y: 640 }; g.items = [shark];
    for (let i = 0; i < 10; i++) step(g, .05, true);
    movement.push(640 - shark.y);
    shark.x = 350; step(g, .01, true); assert.equal(shark.phase, 'warn');
    for (let i = 0; i < 18; i++) step(g, .05, true);
    assert.equal(shark.phase, 'dash'); const direction = shark.dashY;
    g.player.y = 420; step(g, .01, false); assert.equal(shark.dashY, direction);
    g.player.y = 265; g.player.wet = false; step(g, .01, false); assert.equal(shark.phase, 'cruise');
  }
  assert.ok(movement[1] > movement[0] * 2);
});

test('sharks and turtles use stable upper, middle and lower underwater bands', () => {
  const seen = { shark: new Set(), turtle: new Set() };
  for (let stage = 0; stage < STAGES.length; stage++) for (let wave = 0; wave < STAGES[stage].encounters.length; wave++) {
    const g = createGame(() => .5, stage); g.wave = wave; g.items = []; g.distance = g.nextEncounter;
    step(g, .01, false);
    for (const item of g.items.filter(item => item.kind === 'shark' || item.kind === 'turtle')) {
      seen[item.kind].add(item.lane);
      assert.equal(item.baseY, UNDERWATER_BANDS.find(band => band.id === item.lane).y);
      Object.assign(g.player, { y: item.lane === 'upper' ? 700 : 400, wet: true });
      for (let i = 0; i < 120; i++) step(g, .01, false);
      assert.ok(Math.abs(item.y - item.baseY) <= 38, `${item.kind} stays in its announced band`);
    }
  }
  assert.deepEqual([...seen.shark].sort(), ['lower', 'middle', 'upper']);
  assert.deepEqual([...seen.turtle].sort(), ['lower', 'middle', 'upper']);
});

test('bubbles refill capped air once', () => {
  const g = createGame(); g.player.breath = 4;
  g.items = [{ kind: 'bubble', x: g.player.x, y: g.player.y }];
  assert.equal(step(g, .01, false).filter(e => e.kind === 'airBonus').length, 1);
  assert.ok(g.player.breath > 6); assert.equal(g.items.length, 0);
  g.player.breath = 7.9; g.items = [{ kind: 'bubble', x: g.player.x, y: g.player.y }]; step(g, .01, false);
  assert.equal(g.player.breath, WORLD.breath);

});


test('air tricks need a breach and complete turns; double/triple presses award once', () => {
  for (const count of [2, 3]) {
    const g = createGame(); g.items = []; g.nextEncounter = Infinity;
    press(g); press(g); assert.equal(g.player.turns, 0, 'no tricks before a dive');
    g.player.y = 373; g.player.wet = true; g.player.vy = -210;
    step(g, .02, false);
    for (let i = 0; i < count; i++) { press(g); step(g, .05, false); }
    assert.equal(g.score, 0, 'no bonus before a full rotation');
    assert.equal(g.player.turns, count - 1);
    const events = [];
    for (let i = 0; i < 30; i++) events.push(...step(g, .05, false));
    assert.equal(g.score, count === 2 ? 50 : 120);
    assert.equal(events.filter(e => e.kind === 'trick').length, 1);
    press(g); press(g); for (let i = 0; i < 30; i++) step(g, .05, false);
    assert.equal(g.score, count === 2 ? 50 : 120, 'one bonus per breach');
  }
});

test('water and surface collisions cancel incomplete tricks without bonus', () => {
  for (const failure of ['water', 'boat', 'fisher']) {
    const g = createGame(); g.items = []; g.nextEncounter = Infinity;
    g.player.y = 373; g.player.wet = true; g.player.vy = -210; step(g, .02, false);
    press(g); step(g, .05, false); press(g); step(g, .05, false);
    if (failure === 'water') { g.player.y = 375; g.player.vy = 240; }
    else { g.player.y = failure === 'boat' ? 365 : 280; g.items = [{ kind: 'boat', x: g.player.x + (failure === 'boat' ? 80 : 0), cast: -1 }]; }
    step(g, .01, true);
    assert.equal(g.score, 0);
    if (failure === 'water') assert.equal(g.player.turns, 0);
    else if (failure === 'fisher') { assert.equal(g.ended, true); assert.equal(g.endReason, 'fisher'); assert.equal(g.player.turns, 0); }
    else { assert.equal(g.ended, false); assert.ok(g.energy < 100); assert.equal(g.player.turns, 0); }
  }
  assert.ok(hitsBoat({ x: 118, y: 370 }, { x: 198 }), 'bow contact counts before centers meet');
  assert.ok(!hitsBoat({ x: 118, y: 440 }, { x: 118 }), 'clear water below hull remains safe');
});

test('fisher contact ends the stage while gull contact reacts without repeat damage', () => {
  const fisher = createGame(); fisher.nextEncounter = Infinity; fisher.player.y = 280;
  const boat = { kind: 'boat', x: fisher.player.x + 7, cast: -1, reaction: 0 }; fisher.items = [boat];
  assert.ok(hitsFisher(fisher.player, boat));
  assert.ok(step(fisher, .01, false).some(event => event.kind === 'hurt'));
  assert.equal(fisher.endReason, 'fisher'); assert.equal(fisher.energy, 100);

  const gullRun = createGame(); gullRun.nextEncounter = Infinity; gullRun.player.y = 285;
  const gull = { kind: 'gull', x: gullRun.player.x, y: 285 }; gullRun.items = [gull];
  step(gullRun, .01, false);
  assert.equal(gull.reactionKind, 'confused'); assert.ok(gull.reaction > 1 && gullRun.player.confused > 1); assert.equal(gullRun.energy, 85);
  for (let i = 0; i < 24; i++) step(gullRun, .05, false);
  assert.equal(gullRun.player.confused, 0); assert.equal(gull.reaction, 0); assert.equal(gullRun.energy, 85);
});

test('an active air trick kicks each gull once for 75 points and keeps spinning', () => {
  const g = createGame(); g.nextEncounter = Infinity; Object.assign(g.player, { y: 285, wet: false, turns: 1, spin: .1 });
  const gull = { kind: 'gull', x: g.player.x, y: 285 }; g.items = [gull];
  const events = step(g, .001, false);
  assert.equal(events.filter(event => event.kind === 'kick').length, 1);
  assert.equal(g.score, 75); assert.equal(g.energy, 100); assert.equal(g.player.turns, 1);
  assert.equal(gull.kicked, true); assert.equal(gull.hit, undefined); assert.ok(g.player.kick > 0);
  gull.x = g.player.x; gull.y = 285; step(g, .001, false); assert.equal(g.score, 75);
  for (let i = 0; i < 20; i++) step(g, .05, false);
  assert.equal(g.score, 125, 'the completed single salto still awards its regular bonus');

  const wet = createGame(); wet.nextEncounter = Infinity; Object.assign(wet.player, { y: 400, wet: true, turns: 1 });
  wet.items = [{ kind: 'gull', x: wet.player.x, y: 400 }]; step(wet, .001, false);
  assert.equal(wet.score, 0, 'water contact is never a kung-fu kick');
});

test('gulls and driftwood collide, jelly tentacles pulse, whirlpools pull without instant death', () => {
  for (const [kind, y] of [['gull', 285], ['driftwood', 360], ['jelly', 640]]) {
    const g = createGame(); g.player.y = y; g.player.wet = y > 372;
    g.items = [{ kind, x: g.player.x, y }]; step(g, .01, false);
    assert.equal(g.ended, false); assert.ok(g.energy < 100);
  }
  for (const [time, fatal] of [[Math.PI / 4, true], [Math.PI * 3 / 4, false]]) {
    const g = createGame(); g.time = time; g.player.y = 700; g.player.wet = true;
    g.items = [{ kind: 'jelly', x: g.player.x, y: 640 }]; step(g, .001, false);
    assert.equal(g.energy < 90, fatal, 'contracted tentacles leave room below');
  }
  const g = createGame(); g.player.y = 620; g.player.wet = true;
  g.items = [{ kind: 'whirlpool', x: g.player.x, y: 640 }];
  const before = g.player.y; step(g, .01, false); assert.ok(g.player.y > before); assert.equal(g.ended, false);
  for (let i = 0; i < 120; i++) step(g, 1 / 60, false);
  assert.equal(g.player.wet, false, 'releasing escapes the pull');
});

test('diver locks aim before firing, reloads, and missed harpoons award only once', () => {
  const g = createGame(); g.nextEncounter = Infinity; g.player.y = 470; g.player.wet = true;
  const diver = { kind: 'diver', x: 470, y: 620, phase: 'idle' }; g.items = [diver];
  for (let i = 0; i < 23; i++) step(g, .05, true);
  assert.equal(diver.phase, 'locked'); assert.ok(!g.items.some(item => item.kind === 'harpoon'));
  const aim = [diver.aimX, diver.aimY]; g.player.y = 430;
  for (let i = 0; i < 10; i++) step(g, .05, false);
  assert.deepEqual([diver.aimX, diver.aimY], aim);
  for (let i = 0; i < 3; i++) step(g, .05, false);
  assert.equal(diver.phase, 'reload');
  const shot = g.items.find(item => item.kind === 'harpoon'); assert.ok(shot);
  const direction = [shot.vx, shot.vy]; g.player.y = 265; g.player.wet = false;
  step(g, .01, false); assert.deepEqual([shot.vx, shot.vy], direction);
  const safe = createGame(); safe.items = [{ kind: 'harpoon', x: 70, y: 500, vx: -200, vy: 0, life: 2 }];
  assert.equal(step(safe, .01, false).filter(e => e.kind === 'outsmart').length, 1);
  step(safe, .01, false); assert.equal(safe.score, 25);
  const hit = createGame(); hit.player.y = 500; hit.player.wet = true;
  hit.items = [{ kind: 'harpoon', x: 120, y: 500, vx: -200, vy: 0, life: 2 }]; step(hit, .01, false);
  assert.equal(hit.ended, false); assert.equal(hit.energy, 75);
});

test('surfers leave a low-air ascent clear; later layers retain a middle corridor and rewards', () => {
  const g = createGame(); g.nextEncounter = Infinity; g.player.y = 470; g.player.wet = true; g.player.breath = 2.8;
  const surfer = { kind: 'surfer', x: 180, y: WORLD.water }; g.items = [surfer];
  for (let i = 0; i < 90 && !g.ended; i++) step(g, 1 / 60, false);
  assert.equal(surfer.escaping, true); assert.equal(g.ended, false); assert.equal(g.player.wet, false);
  const hit = createGame(); hit.player.y = 350; hit.items = [{ kind: 'surfer', x: 118, y: WORLD.water }]; step(hit, .01, false);
  assert.equal(hit.ended, false); assert.equal(hit.energy, 80);

});


test('full cargo slows ascent, caps at capacity and feeding unloads once before flight resumes', () => {
  const empty = createGame(), loaded = createGame();
  for (const g of [empty, loaded]) { g.items = []; g.player.y = 600; g.player.wet = true; g.nextEncounter = Infinity; }
  loaded.cargo = WORLD.capacity;
  for (let i = 0; i < 30; i++) { step(empty, 1 / 60, false); step(loaded, 1 / 60, false); }
  assert.ok(loaded.player.y > empty.player.y + 10);
  loaded.items = [{ kind: 'fish', ...beakPosition(loaded.player) }]; step(loaded, .001, false);
  assert.equal(loaded.cargo, WORLD.capacity);
  loaded.player.wet = false; loaded.player.y = 280;
  const nest = { kind: 'nest', x: 180, y: WORLD.water, served: false, celebration: 0 }; loaded.items = [nest];
  step(loaded, .01, false); assert.equal(loaded.feeding, 1.8);
  const score = loaded.score, time = loaded.time, x = nest.x;
  step(loaded, .05, true); assert.equal(loaded.time, time); assert.equal(nest.x, x); assert.equal(loaded.score, score);
  const events = [];
  for (let i = 0; i < 36; i++) events.push(...step(loaded, .05, false));
  assert.equal(loaded.cargo, 0); assert.equal(loaded.delivered, WORLD.capacity);
  assert.equal(loaded.score, score + WORLD.capacity * 15);
  assert.equal(events.filter(e => e.kind === 'delivery').length, 1);
  step(loaded, .01, false); assert.equal(loaded.score, score + WORLD.capacity * 15);
  const skip = createGame(); skip.player.y = 550; skip.player.wet = true; skip.cargo = 10;
  skip.items = [{ kind: 'nest', x: 118, y: WORLD.water, served: false, celebration: 0 }]; step(skip, .01, true);
  assert.equal(skip.feeding, 0); assert.equal(skip.cargo, 10); assert.equal(skip.ended, false);
});


test('islands force flight, reefs leave a clear passage and full cargo can ascend after warning', () => {
  const island = { kind: 'island', x: 118 }, reef = { kind: 'reef', x: 118 };
  assert.ok(!hitsTerrain({ x: 118, y: 265 }, island));
  for (const y of [350, 500, 710]) assert.ok(hitsTerrain({ x: 118, y }, island));
  assert.ok(!hitsTerrain({ x: 118, y: 530 }, reef));
  for (const y of [420, 630]) assert.ok(hitsTerrain({ x: 118, y }, reef));
  const g = createGame(); g.time = 120; g.cargo = WORLD.capacity; g.player.y = 710; g.player.wet = true;
  g.items = [{ kind: 'island', x: g.player.x + 90 + paceAt(120).speed * 3 - 1 }]; g.nextEncounter = Infinity;
  assert.ok(step(g, .01, false).some(e => e.kind === 'islandWarning'));
  for (let i = 0; i < 240 && !g.ended; i++) step(g, 1 / 60, false);
  assert.equal(g.ended, false); assert.equal(g.player.wet, false);
});


test('turtles react once without moving Pip or taking air/cargo', () => {
  const g = createGame(); g.items = [{ kind: 'turtle', x: 118, y: 440, baseY: 440 }]; g.nextEncounter = Infinity;
  g.player.y = 440; g.player.wet = true; g.cargo = 12;
  const control = structuredClone({ ...g, random: undefined }); control.random = Math.random; control.items = [];
  step(g, .001, false); step(control, .001, false);
  assert.equal(g.ended, false); assert.equal(g.cargo, 12);
  assert.equal(g.player.y, control.player.y); assert.equal(g.player.vy, control.player.vy); assert.equal(g.player.breath, control.player.breath);
  assert.ok(g.player.bump > 0 && g.items[0].reaction > 0);
  const bump = g.player.bump; step(g, .001, false); assert.ok(g.player.bump < bump);
});

test('organic terrain collision follows the visible corner and retains the passage', () => {
  const island={kind:'island',x:100};
  assert.equal(hitsTerrain({x:20,y:320},island),false,'outside the shaped top-left corner');
  assert.equal(hitsTerrain({x:22,y:322},island),true,'Pip touches the shaped corner');
  assert.equal(hitsTerrain({x:100,y:311},island),false);
  assert.equal(hitsTerrain({x:100,y:313},island),true);
  assert.equal(hitsTerrain({x:100,y:530},{kind:'reef',x:100}),false);
});

test('successive fishermen keep four distinct stable looks', () => {
  const g=createGame(Math.random, 0);
  for(let i=0;i<5;i++) {
    g.wave=STAGES[0].encounters.indexOf('boat');g.items=[];g.distance=g.nextEncounter;
    step(g,.01,false);
    const boat=g.items.find(item=>item.kind==='boat');
    assert.equal(boat.look,(i+1)%4);
    step(g,.01,false);assert.equal(boat.look,(i+1)%4);
  }
});


test('depth-aware air warning allows .75 seconds of continued descent before release', () => {
  const thresholds = [];
  for (const y of [395, 710]) for (const cargo of [0, 20]) {
    const g = createGame(); g.nextEncounter = Infinity; g.items = []; g.cargo = cargo;
    Object.assign(g.player, { y, wet: true, vy: 240, breath: 8 });
    const threshold = airState(g.player, cargo).warningAt; thresholds.push(threshold);
    g.player.breath = threshold;
    assert.ok(airState(g.player, cargo).level);
    for (let i = 0; i < 45; i++) step(g, 1 / 60, true);
    for (let i = 0; i < 240 && g.player.wet && !g.ended; i++) step(g, 1 / 60, false);
    assert.equal(g.ended, false, `${y}/${cargo}`); assert.equal(g.player.wet, false);
    assert.ok(g.player.breath > 0); assert.equal(airState(g.player, cargo).level, 0); assert.ok(g.player.relief > 0);
  }
  assert.ok(thresholds[3] > thresholds[2] && thresholds[2] > thresholds[0]);
  const g = createGame(); g.nextEncounter = Infinity; Object.assign(g.player, { y: 500, wet: true, breath: 2 });
  assert.ok(airState(g.player).level);
  g.items = [{ kind: 'bubble', x: 118, y: 500 }]; step(g, .01, false);
  assert.equal(airState(g.player).level, 0);
});

test('puffer gives a full second of anticipation and is dangerous only when puffed', () => {
  const g = createGame(Math.random, 2); g.nextEncounter = Infinity;
  const puffer = { kind: 'puffer', x: 470, y: 665, phase: 'idle', timer: 0 }; g.items = [puffer];
  let announced, puffed; const phases = new Set();
  for (let i = 0; i < 240; i++) {
    puffer.x = 470; // Keep the actor on screen to observe its complete animation cycle.
    step(g, 1 / 60, false); phases.add(puffer.phase);
    if (puffer.phase === 'startle') announced ??= g.time;
    if (puffer.phase === 'puffed') puffed ??= g.time;
  }
  assert.ok(puffed - announced >= .8);
  assert.deepEqual([...phases], ['startle', 'inflate', 'puffed', 'deflate', 'rest']);
  for (const phase of ['idle', 'startle', 'inflate', 'puffed', 'deflate', 'rest']) {
    const item = { kind: 'puffer', x: 118, y: 500, phase, timer: .3 };
    assert.equal(hitsPuffer({ x: 118, y: 500 }, item), phase === 'puffed');
    if (phase === 'puffed') {
      const r = pufferRadius(item);
      assert.equal(hitsPuffer({ x: 118 + r + 17, y: 500 }, item), true);
      assert.equal(hitsPuffer({ x: 118 + r + 19, y: 500 }, item), false);
    }
    const run = createGame(); run.nextEncounter = Infinity; run.items = [item]; Object.assign(run.player, { y: 500, wet: true });
    step(run, .001, false); assert.equal(run.ended, false); assert.equal(run.energy, phase === 'puffed' ? 70 : 100);
  }
});

test('empty final nest can be reached, waits for ascent, and settles without advancing world time', () => {
  for (const cargo of [0, 20]) {
    const g = createGame(); g.cargo = cargo; g.nextEncounter = Infinity;
    const nest = { kind: 'nest', final: true, x: 172, y: 360, celebration: 0 }; g.items = [nest];
    Object.assign(g.player, { y: 550, wet: true });
    step(g, .01, false); assert.equal(g.feeding, 0); assert.equal(nest.x, 172);
    for (let i = 0; i < 180 && !g.feeding; i++) step(g, 1 / 60, false);
    assert.equal(g.feeding, 1.8); const time = g.time;
    for (let i = 0; i < 240 && !g.ended; i++) step(g, 1 / 60, true);
    assert.equal(g.endReason, 'complete'); assert.equal(g.time, time); assert.equal(g.delivered, cargo);
  }
});

test('coasting cannot finish any stage; no-food endurance is bounded even without hazards', () => {
  for (let stage = 0; stage < STAGES.length; stage++) {
    const g = createGame(() => .5, stage);
    while (!g.ended && g.time < 110) step(g, 1 / 60, false);
    assert.ok(['energy', 'buoy', 'fisher'].includes(g.endReason)); assert.equal(g.delivered, 0);
    const empty = createGame(() => .5, stage); empty.items = []; empty.nextEncounter = Infinity;
    while (!empty.ended) step(empty, 1 / 60, false);
    assert.ok(Math.abs(empty.time - (2 + 100 / ENERGY.flightDrain)) < 1 / 60); assert.equal(empty.fish, 0);
  }
});

test('a full pouch keeps earning points and replenishing energy, including golden fish', () => {
  for (const golden of [false, true]) {
    const g = createGame(); g.cargo = WORLD.capacity; g.energy = 50;
    g.items = [{kind: 'fish', ...beakPosition(g.player), golden}];
    step(g, .001, false);
    assert.equal(g.cargo, WORLD.capacity); assert.equal(g.fish, 1);
    assert.equal(g.score, golden ? 50 : 10); assert.equal(g.energy, golden ? 62 : 54);
    g.energy = 99; g.items = [{kind: 'fish', ...beakPosition(g.player), golden}]; step(g, .001, false);
    assert.equal(g.energy, 100);
  }
});

test('contacts cost energy once, protect briefly, and never take cargo or air', () => {
  const g = createGame(); g.nextEncounter = Infinity; g.cargo = 10; g.combo = 8; g.comboTime = 4;
  const gull = {kind: 'gull', x: 118, y: 285}; g.items = [gull];
  assert.equal(step(g, .01, false).filter(e => e.kind === 'hurt').length, 1);
  assert.equal(g.energy, 85); assert.equal(g.cargo, 10); assert.equal(g.player.breath, WORLD.breath); assert.equal(g.combo, 0);
  for (let i = 0; i < 125; i++) { gull.x = 118; step(g, .01, false); }
  assert.equal(g.energy, 85, 'same actor cannot drain every frame or after protection expires');
  const next = {kind: 'gull', x: 118, y: 285}; g.items = [next]; g.player.y = 285;
  step(g, .01, false); assert.equal(g.energy, 70, 'a new encounter can hurt again');
  g.items = [{kind: 'gull', x: 118, y: 285}]; step(g, .01, false);
  assert.equal(g.energy, 70, 'overlapping actors cannot stack damage during protection');
  g.player.hurt = 0; g.energy = 10; step(g, .01, false);
  assert.equal(g.endReason, 'energy'); assert.equal(g.energy, 0);
});

test('sharks, fishermen, reefs and divers end the stage while other creatures only drain energy', () => {
  const fatal = [
    ['shark', {x: 118, y: 500, baseY: 500}],
    ['fisher', {kind: 'boat', x: 125, cast: -1}],
    ['reef', {x: 118, playerY: 420}],
    ['diver', {x: 118, y: 500, phase: 'idle'}],
  ];
  for (const [reason, item] of fatal) {
    const g = createGame(); Object.assign(g.player, {y: reason === 'fisher' ? 280 : item.playerY ?? 500, wet: reason !== 'fisher'});
    g.items = [{kind: reason === 'fisher' ? 'boat' : reason, ...item}];
    const events = step(g, .001, false);
    assert.equal(g.ended, true, reason); assert.equal(g.endReason, reason); assert.ok(events.some(event => event.kind === 'end'));
  }
  for (const item of [{kind:'gull',x:118,y:285},{kind:'jelly',x:118,y:500,phase:1},{kind:'puffer',x:118,y:500,phase:'puffed',timer:1}]) {
    const g = createGame(); Object.assign(g.player, {y:item.y,wet:item.y>WORLD.water}); g.items=[item];
    step(g,.001,false); assert.equal(g.ended,false,item.kind); assert.ok(g.energy<100,item.kind);
  }
});

test('the journey introduces dangers before combining them and has activity in every encounter', () => {
  const learned = new Set();
  for (const stage of STAGES) for (const entry of stage.encounters) {
    const actors = entry.split('-');
    if (actors.length > 1) for (const actor of actors) assert.ok(learned.has(actor), `learn ${actor} before a combination`);
    else learned.add(entry);
    assert.notEqual(entry, 'calm');
  }
  assert.ok(STAGES[0].encounters.filter(k => k.includes('-')).length < STAGES.at(-1).encounters.filter(k => k.includes('-')).length);
});

test('exhaustion at the nest cannot trigger a completion, feeding itself freezes energy', () => {
  const g = createGame(); g.time = 10; g.energy = .01; g.items = [{kind:'nest',final:true,x:118,celebration:0}];
  step(g, .01, false); assert.equal(g.endReason, 'energy'); assert.equal(g.feeding, 0);
  const fed = createGame(); fed.energy = 50; fed.cargo = 20; fed.items = [{kind:'nest',final:true,x:118,celebration:0}];
  step(fed, .01, false); for (let i = 0; i < 200; i++) step(fed, .02, false);
  assert.equal(fed.endReason, 'complete'); assert.equal(fed.energy, 50);
});

test('low energy keeps steering and air unchanged; a harpoon that hit gives no dodge bonus', () => {
  const fresh = createGame(), tired = createGame(); tired.energy = 10;
  for (const g of [fresh,tired]) {g.items = [];g.nextEncounter = Infinity;}
  for (let i=0;i<100;i++) {step(fresh,.01,i<50);step(tired,.01,i<50);}
  assert.equal(tired.player.y,fresh.player.y);assert.equal(tired.player.vy,fresh.player.vy);assert.equal(tired.player.breath,fresh.player.breath);
  const g=createGame();g.nextEncounter=Infinity;Object.assign(g.player,{y:500,wet:true});
  g.items=[{kind:'harpoon',x:118,y:500,vx:-200,vy:0,life:2}];
  assert.ok(step(g,.01,false).some(e=>e.kind==='hurt'));
  for(let i=0;i<30;i++)step(g,.01,false);
  assert.equal(g.score,0,'absorbing a shot is not outsmarting it');
});

test('sharks and turtles never swim through rocks, coral or buoys', () => {
  let seed = 11; const random = () => (seed = seed * 16807 % 2147483647) / 2147483647;
  for (let run = 0; run < 6; run++) for (let stage = 0; stage < STAGES.length; stage++) {
    const g = createGame(random, stage);
    for (let t = 0; t < 140; t += 1 / 30) {
      Object.assign(g.player, { x: -2000, y: 265, breath: WORLD.breath }); g.energy = 100; step(g, 1 / 30, false);
      const blocks = g.items.filter(i => ['reef', 'buoy', 'coral', 'mangrove'].includes(i.kind)).flatMap(terrainBlocks);
      for (const s of g.items.filter(i => i.kind === 'shark' || i.kind === 'turtle')) for (const b of blocks)
        assert.ok(!(s.x + 40 > b.x && s.x - 40 < b.x + b.width && s.y + 20 > b.y && s.y - 20 < b.y + b.height), `${s.kind} inside terrain on stage ${stage}`);
    }
  }
});

test('now and then a fish leaps out of the water, catchable in the air and never into terrain', () => {
  let seed = 5; const random = () => (seed = seed * 16807 % 2147483647) / 2147483647;
  let leaps = 0, waves = 0;
  for (let run = 0; run < 6; run++) for (let stage = 0; stage < STAGES.length; stage++) {
    const g = createGame(random, stage);
    for (let t = 0; t < 140; t += 1 / 30) {
      Object.assign(g.player, { x: -2000, y: 265, breath: WORLD.breath }); g.energy = 100;
      leaps += step(g, 1 / 30, false).filter(e => e.kind === 'fishLeap').length / 2;
      for (const f of g.items.filter(i => i.leap > 0)) for (const item of g.items.filter(i => ['island', 'reef', 'buoy', 'coral', 'mangrove'].includes(i.kind)))
        assert.ok(!hitsTerrain(f, item), `leaping fish hits ${item.kind} on stage ${stage}`);
    }
    waves += g.wave;
  }
  assert.ok(leaps > waves * .2 && leaps < waves * .7, `${leaps} leaps in ${waves} waves`);

  const g = createGame(() => .5);
  g.items = [{ kind: 'fish', x: LEAP.at - 1, y: LEAP.from, golden: false, lane: 'alternate', leap: 0 }];
  let top = LEAP.from;
  for (let i = 0; i < 20; i++) { step(g, 1 / 60, false); top = Math.min(top, g.items[0].y); }
  assert.ok(top < WORLD.water - 40, 'the fish rises well above the surface');
  const f = g.items[0];
  Object.assign(g.player, { y: 300, vy: 0, wet: false });
  Object.assign(g.player, { x: g.player.x + (f.x - beakPosition(g.player).x), y: g.player.y + (f.y - beakPosition(g.player).y) });
  step(g, 1 / 60, false);
  assert.equal(g.fish, 1, 'Pip catches it in mid-air');
});

test('mangroves block the sky lane, so Pip dives under the root curtain', () => {
  const tree = { kind: 'mangrove', x: 118 };
  for (const y of [265, 330, 420, 510]) assert.ok(hitsTerrain({ x: 118, y }, tree), `blocked at ${y}`);
  for (const y of [560, 640, 710]) assert.ok(!hitsTerrain({ x: 118, y }, tree), `open at ${y}`);
  const g = createGame(() => .5, 2); g.items = [{ kind: 'mangrove', x: g.player.x }]; g.nextEncounter = Infinity;
  Object.assign(g.player, { y: 300, wet: false });
  step(g, .01, false);
  assert.equal(g.endReason, 'mangrove');
});

test('every run meets its stage\'s special moment once, at a random wave in the middle', () => {
  let seed = 3; const random = () => (seed = seed * 16807 % 2147483647) / 2147483647;
  for (let stage = 0; stage < STAGES.length; stage++) {
    let hits = 0;
    for (let run = 0; run < 3000; run++) {
      const rare = rollRare(stage, random);
      if (!rare) continue;
      hits++; assert.equal(rare.name, STAGES[stage].rareMoment);
      assert.ok(rare.wave >= 2 && rare.wave < STAGES[stage].encounters.length - 2);
    }
    assert.equal(hits, 3000, `stage ${stage}: ${hits} runs with a moment`);
  }
  const g = createGame(() => .5, 2); g.rare = { name: 'manateeCalf', wave: 3 };
  let events = [];
  for (let t = 0; t < 60 && !g.ended; t += 1 / 30) { Object.assign(g.player, { x: -2000, y: 265, breath: WORLD.breath }); g.energy = 100; events.push(...step(g, 1 / 30, false)); }
  assert.deepEqual(events.filter(e => e.kind === 'rare').map(e => e.name), ['manateeCalf']);
});

test('a fish snapped out of the air scores double', () => {
  const g = createGame(() => .5); g.nextEncounter = Infinity;
  Object.assign(g.player, { y: 300, vy: 0, wet: false });
  const beak = beakPosition(g.player);
  g.items = [{ kind: 'fish', x: beak.x, y: beak.y, golden: false, leap: .5 }];
  const events = step(g, 1 / 60, false);
  assert.equal(g.score, 20);
  assert.equal(events.filter(e => e.kind === 'airCatch').length, 1);
  g.items = [{ kind: 'fish', ...beakPosition(g.player), golden: false }];
  step(g, 1 / 60, false);
  assert.equal(g.score, 30, 'a plain catch in the air is not doubled');
});

test('bay fish ease away from Pip while remaining catchable and inside the water', () => {
  const g = createGame(() => .5, 0);
  g.nextEncounter = Infinity;
  g.player.y = 500; g.player.wet = true; g.player.vy = 0;
  const fish = { kind: 'fish', x: 245, y: 525 };
  g.items = [fish];
  for (let i = 0; i < 30; i++) {
    g.player.y = 500; g.player.wet = true; g.player.vy = 0; fish.x = 245;
    step(g, 1 / 60, true);
  }
  assert.ok(fish.y > 540, 'the reaction is visible within half a second');
  assert.ok(fish.y > WORLD.water && Number.isFinite(fish.heading));
  fish.x = beakPosition(g.player).x + g.speed * .01;
  fish.y = beakPosition(g.player).y;
  step(g, .01, true);
  assert.equal(g.fish, 1);
});
