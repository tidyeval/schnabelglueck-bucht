import { STAGES } from '../src/stages.js';
const PAIR_PATTERNS = new Map(STAGES.flatMap((stage, index) => Object.entries(stage.pairPatterns).map(([wave, form]) => [`${index}:${wave}`, form])));
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, step, WORLD, paceAt, hitsTerrain } from '../src/game.js';
import { readProgress } from '../src/progress.js';
import { routeController } from './route-controller.js';

test('one continuous pace rises smoothly, carries across nests and excludes paused/feeding time', () => {
  let previous = paceAt(0);
  for (let t = 1; t <= 300; t++) {
    const next = paceAt(t);
    assert.ok(next.speed >= previous.speed && next.speed - previous.speed <= .67);
    assert.ok(next.spacing <= previous.spacing && next.spacing >= 640);
    previous = next;
  }
  const first = createGame(); first.time = 55;
  const next = createGame(Math.random, 1, first.elapsed + first.time);
  assert.equal(next.speed, paceAt(55).speed);
  assert.equal(next.player.breath, WORLD.breath);
  next.feeding = 1; step(next, .05, false); assert.equal(next.elapsed + next.time, 55);
  assert.equal('difficulty' in next, false);
});

test('every authored fish stays underwater and outside terrain, including island and nest routes', () => {
  const depths = new Set();
  for (const seed of [0, .5, .99]) for (let stage = 0; stage < STAGES.length; stage++) {
    const g = createGame(() => seed, stage);
    for (let wave = 0; wave <= STAGES[stage].encounters.length; wave++) {
      g.items = []; g.distance = g.nextEncounter; step(g, .01, false);
      const terrain = g.items.filter(i => ['island', 'reef', 'coral', 'buoy', 'mangrove'].includes(i.kind));
      for (const f of g.items.filter(i => i.kind === 'fish')) {
        assert.ok(f.y >= WORLD.water + 35 && f.y <= 710, `${stage}/${wave}: fish at ${f.y}`);
        assert.equal(f.flying, undefined);
        assert.ok(!terrain.some(t => hitsTerrain(f, t)));
        if (!f.golden) depths.add(f.y < 465 ? 'upper' : f.y < 565 ? 'middle' : 'lower');
      }
    }
  }
  assert.deepEqual([...depths].sort(), ['lower','middle','upper']);
});

test('removing difficulty preserves possessions, unlocks and the best previous stage scores', () => {
  const prefs = readProgress(JSON.stringify({ difficulty: 'hard', bests: [900, 0, 100], difficultyBests: {easy: [50, 800, 0], medium: [400, 700, 0], hard: [1000, 0, 200]}, completed: 2, totalFish: 42, outfit: 'flower', music: false }));
  assert.deepEqual(prefs.bests, [1000, 800, 0, 200]);
  assert.equal(prefs.totalFish, 42); assert.equal(prefs.completed, 2); assert.equal(prefs.outfit, 'flower'); assert.equal(prefs.music, false);
  assert.equal('difficulty' in prefs, false); assert.equal('difficultyBests' in prefs, false);
  assert.deepEqual(readProgress(JSON.stringify(prefs)), prefs);
});


test('the journey reaches full pace during the final stage and adds sharks in every stage', () => {
  assert.deepEqual(paceAt(55), { speed: 210, spacing: 720 });
  assert.deepEqual(paceAt(100), { speed: 230, spacing: 680 });
  assert.deepEqual(paceAt(150), { speed: 255, spacing: 640 });
  assert.deepEqual(paceAt(300), paceAt(150));
  for (let stage = 0; stage < STAGES.length; stage++) {
    const g = createGame(() => .5, stage);
    let sharks = 0;
    for (let wave = 0; wave < STAGES[stage].encounters.length; wave++) {
      g.items = []; g.distance = g.nextEncounter; step(g, .01, false);
      sharks += g.items.filter(item => item.kind === 'shark').length;
    }
    assert.ok(sharks === [6, 8, 7, 13][stage], `stage ${stage}: ${sharks} sharks`);
  }
});

test('paired sharks progress from staggered to parallel with recovery encounters', () => {
  const forms = [], stageBands = new Map(), warningTimes = [];
  for (let stage = 0; stage < STAGES.length; stage++) {
    const g = createGame(() => .5, stage);
    for (let wave = 0; wave < STAGES[stage].encounters.length; wave++) {
      g.items = []; g.distance = g.nextEncounter; step(g, .01, false);
      const trace = g.encounterTrace.at(-1);
      if (trace.entry === 'shark-shark') {
        forms.push(trace.form);
        warningTimes[stage] ??= g.items.find(item => item.kind === 'shark').warningTime;
        assert.equal(new Set(trace.bands).size, 2, `${stage}/${wave}: pair uses distinct bands`);
        const signature = trace.bands.join(',');
        const previous = stageBands.get(stage);
        if (previous) assert.notEqual(signature, previous, `${stage}/${wave}: pair changes its band combination`);
        stageBands.set(stage, signature);
        const next = STAGES[stage].encounters[wave + 1];
        assert.ok(!next || next !== 'shark-shark', `${stage}/${wave}: pair is followed by recovery`);
      }
    }
  }
  assert.equal(forms[0], 'staggered');
  assert.ok(forms.includes('parallel'));
  assert.deepEqual([...PAIR_PATTERNS.values()].sort(), forms.sort());
  assert.ok(PAIR_PATTERNS.has('0:4'), 'paired decisions begin by the middle of the bay');
  assert.deepEqual([0, 1, 2, 3].map(stage => [...PAIR_PATTERNS.keys()].filter(key => key.startsWith(`${stage}:`)).length), [2, 3, 3, 5]);
  assert.deepEqual(warningTimes, [.95, .8, .74, .68]);
});

test('the buoy and coral combination keeps its middle passage clear of the fatal shark', () => {
  for (const seed of [0, .5, .99]) {
    const g = createGame(() => seed, 1); g.wave = STAGES[1].encounters.indexOf('buoy-coral-shark'); g.items = []; g.distance = g.nextEncounter;
    step(g, .01, false);
    const shark = g.items.find(item => item.kind === 'shark');
    assert.equal(shark.lane, 'upper');
    assert.equal(hitsTerrain({x:118,y:535},{kind:'buoy',x:118}),false);
    assert.equal(hitsTerrain({x:118,y:535},{kind:'coral',x:118}),false);
  }
});

test('every shark pair leaves a reachable band after a visible reaction delay', () => {
  for (const [key, form] of PAIR_PATTERNS) {
    const [stage, wave] = key.split(':').map(Number), g = createGame(() => .5, stage);
    g.wave = wave; g.items = []; g.distance = g.nextEncounter; g.cargo = WORLD.capacity; g.player.y = 535; g.player.wet = true;
    step(g, .01, false); g.nextEncounter = Infinity;
    const sharks = g.items.filter(item => item.kind === 'shark');
    assert.equal(sharks.length, 2); assert.equal(new Set(sharks.map(item => item.lane)).size, 2);
    assert.ok(sharks.every(shark => shark.warningTime >= .45));
    const free = ['upper', 'middle', 'lower'].find(lane => !sharks.some(shark => shark.lane === lane));
    const routeFish = g.items.filter(item => item.kind === 'fish' && !item.golden && item.route === wave && item.lane === 'main');
    assert.ok(routeFish.every(fish => Math.abs(fish.y - { upper: 420, middle: 535, lower: 650 }[free]) <= 25), `${key}: fish mark the open band`);
    assert.ok(g.items.some(item => item.kind === 'fish' && item.golden && item.y !== { upper: 420, middle: 535, lower: 650 }[free]), `${key}: golden fish rewards risk`);
    const target = { upper: 400, middle: 535, lower: 680 }[free];
    let seenAt, hurt = false, passed = false;
    for (let i = 0; i < 8 * 60 && !g.ended; i++) {
      const nearest = Math.min(...sharks.map(shark => shark.x));
      if (seenAt === undefined && nearest < 650) seenAt = g.time;
      const reacted = seenAt !== undefined && g.time - seenAt >= .45;
      const holding = reacted && g.player.y < target;
      if (reacted && g.player.y > target + 8) g.player.vy = Math.min(g.player.vy, -20);
      const events = step(g, 1 / 60, holding); hurt ||= events.some(event => event.kind === 'hurt');
      passed ||= sharks.every(shark => shark.x < g.player.x - 70);
      if (passed) break;
    }
    assert.equal(hurt, false, `${key} ${form}: free ${free} band remains reachable`);
    assert.equal(passed, true, `${key} ${form}: both sharks pass`);
  }
});

test('encounter traces do not repeat and never overlap more than two sharks', () => {
  for (let stage = 0; stage < STAGES.length; stage++) {
    const g = createGame(() => .99, stage), control = routeController(); let maxSharks = 0;
    for (let i = 0; i < 90 * 60 && !g.ended; i++) {
      step(g, 1 / 60, control(g));
      maxSharks = Math.max(maxSharks, g.items.filter(item => item.kind === 'shark').length);
    }
    assert.equal(g.endReason, 'complete', 'cap is checked through the entire stage');
    const signatures = g.encounterTrace.map(trace => `${trace.entry}:${trace.form}:${trace.bands.join(',')}`);
    for (let i = 1; i < signatures.length; i++) assert.notEqual(signatures[i], signatures[i - 1]);
    assert.ok(maxSharks <= 2, `stage ${stage}: ${maxSharks} active sharks`);
  }
});

test('the first shark interrupts the fish route before thirty seconds but leaves an escape', () => {
  const run = avoid => {
    const g = createGame(() => .5), control = routeController(); let hit = false, warned = false;
    for (let i = 0; i < 15 * 60 && !g.ended && g.wave < 3; i++) {
      let holding = control(g);
      const shark = g.items.find(item => item.kind === 'shark' && !item.hit && item.x > g.player.x - 90 && item.x < g.player.x + 300);
      if (!avoid && shark) holding = shark.y > g.player.y + g.player.vy * .11;
      const events = step(g, 1 / 60, holding);
      hit ||= events.some(event => event.kind === 'hurt') && g.items.some(item => item.kind === 'shark' && item.hit);
      warned ||= events.some(event => event.kind === 'warning');
    }
    return { g, hit, warned };
  };
  const following = run(false), evading = run(true);
  assert.equal(following.hit, true); assert.equal(following.warned, true); assert.ok(following.g.time < 30);
  assert.equal(evading.hit, false); assert.equal(evading.g.ended, false); assert.ok(evading.g.wave >= 3);
});


test('every stage opens with a visible fisherman and gull/shark within the first two seconds', () => {
  for (let stage = 0; stage < STAGES.length; stage++) {
    const g = createGame(() => .5, stage);
    assert.ok(g.items.some(item => item.kind === 'boat' && item.x < WORLD.width));
    const visible = new Set();
    for (let i = 0; i < 120; i++) {
      for (const item of g.items) if (item.x > 0 && item.x < WORLD.width) visible.add(item.kind);
      step(g, 1 / 60, true);
    }
    for (const kind of ['boat', 'gull', 'shark']) assert.ok(visible.has(kind), `${stage}: early ${kind}`);
  }
});
