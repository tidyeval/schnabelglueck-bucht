import { STAGES } from '../src/stages.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, step, WORLD, FRENZY, NEAR_MISS, rollSetPieces, rollDecor, sardinePositions, beakPosition, paceAt, hitsTerrain } from '../src/game.js';

const quiet = stage => { const g = createGame(() => .5, stage); g.items = []; g.nextEncounter = Infinity; return g; };
const run = (g, seconds, holding, each) => { const events = []; for (let t = 0; t < seconds && !g.ended; t += 1 / 60) { events.push(...step(g, 1 / 60, typeof holding === 'function' ? holding(g) : holding)); each?.(g); } return events; };

test('a deep dive launches Pip above gliding height and he settles back onto it', () => {
  const deep = quiet(0); run(deep, 2.2, true); assert.ok(deep.player.y > 650);
  let top = Infinity; run(deep, 4, false, g => { top = Math.min(top, g.player.y); });
  assert.ok(top < 230 && top >= 150, `deep jump apex ${top}`);
  assert.equal(deep.player.y, 265); assert.equal(deep.player.jump, false);
  const shallow = quiet(0); run(shallow, .75, true); assert.ok(shallow.player.wet && shallow.player.y < 470);
  top = Infinity; run(shallow, 4, false, g => { top = Math.min(top, g.player.y); });
  assert.equal(top, 265, 'a shallow dive keeps the familiar glide');
});

test('holding during a jump dives again instead of floating', () => {
  const g = quiet(0); run(g, 2.2, true); for (let i = 0; i < 400 && !(g.player.y < 250); i++) step(g, 1 / 60, false); assert.ok(!g.player.wet && g.player.y < 250);
  run(g, 1.2, true); assert.ok(g.player.wet);
});

test('a close shave with a shark pays once; distance or a hit pays nothing', () => {
  const pass = offset => {
    const g = quiet(0); run(g, 1.2, true); const y = g.player.y;
    g.items.push({ kind: 'shark', x: g.player.x + 200, y: y + offset, baseY: y + offset, phase: 'spent', near: undefined });
    const events = [];
    for (let i = 0; i < 400 && !g.ended; i++) { g.player.y = y; g.player.vy = 0; g.player.breath = WORLD.breath; g.energy = 100; const shark = g.items.find(item => item.kind === 'shark'); if (shark) { shark.y = y + offset; shark.phase = 'spent'; } events.push(...step(g, 1 / 60, true)); g.player.y = y; }
    return { g, count: events.filter(e => e.kind === 'nearMiss').length };
  };
  const close = pass(34 + NEAR_MISS.margin - 6); assert.equal(close.count, 1); assert.equal(close.g.score, NEAR_MISS.points);
  const far = pass(115); assert.equal(far.count, 0); assert.equal(far.g.score, 0);
  const hit = pass(0); assert.equal(hit.count, 0); assert.equal(hit.g.endReason, 'shark');
});

test('fifteen fish in a row start one frenzy with double points and reachable bonus fish', () => {
  const g = quiet(1); g.nextEncounter = 1e9; run(g, 1, true);
  const feed = () => { const beak = beakPosition(g.player); g.items.push({ kind: 'fish', x: beak.x, y: beak.y, golden: false }); return step(g, .001, true); };
  let events = []; for (let i = 0; i < FRENZY.combo; i++) events.push(...feed());
  assert.equal(events.filter(e => e.kind === 'frenzy').length, 1); assert.ok(g.frenzy > 0);
  const before = g.score; feed(); assert.equal(g.score - before, 10 * 4 * 2);
  g.items.push({ kind: 'coral', x: 900 });
  run(g, 2, true, game => { game.player.breath = WORLD.breath; game.energy = 100; });
  const bonus = g.items.filter(item => item.bonus);
  assert.ok(bonus.length > 3);
  const terrain = g.items.filter(item => item.kind === 'coral');
  for (const fish of bonus) { assert.ok(fish.y > WORLD.water + 40 && fish.y <= 690); assert.ok(!terrain.some(block => hitsTerrain(fish, block))); }
  g.items = g.items.filter(item => item.kind !== 'coral'); assert.ok(!g.ended);
  assert.equal(run(g, 8, true, game => { game.player.breath = WORLD.breath; game.energy = 100; game.comboTime = 5; game.combo = 20; }).filter(e => e.kind === 'frenzy').length, 0, 'no second frenzy inside one streak');
  assert.equal(g.frenzy, 0);
});

test('a bait ball is optional food: points and a little energy, no cargo, a bonus for clearing it', () => {
  const g = quiet(0); run(g, 1, true); g.energy = 50;
  const seeds = Array.from({ length: 22 }, (_, i) => (i * .618034 + .13) % 1);
  const ball = { kind: 'baitball', x: 400, y: 560, seeds, eaten: seeds.map(() => false), scatter: 0, left: 22 };
  g.items.push(ball);
  const events = [];
  for (let i = 0; i < 60 && ball.left; i++) {
    const target = sardinePositions(ball, g.time + .001).find(s => !s.eaten), beak = beakPosition(g.player);
    ball.x += beak.x - target.x; ball.y += beak.y - target.y; ball.scatter = 0;
    events.push(...step(g, .001, true));
  }
  assert.equal(events.filter(e => e.kind === 'sardine').length, 22); assert.equal(ball.left, 0);
  assert.equal(events.filter(e => e.kind === 'feast').length, 1);
  assert.equal(g.score, 22 * 5 + 100); assert.equal(g.cargo, 0); assert.equal(g.fish, 0); assert.ok(g.energy > 70);
  assert.ok(!g.items.includes(ball));
});

test('a current speeds the journey only while Pip swims inside it', () => {
  const g = quiet(1); g.nextEncounter = 1e9; run(g, 1.4, true);
  const base = paceAt(g.elapsed + g.time).speed;
  g.items.push({ kind: 'current', x: g.player.x - 20, y: g.player.y, length: 2000, entered: false });
  const events = run(g, 1, true, game => { game.items[0].y = game.player.y; game.player.breath = WORLD.breath; });
  assert.equal(events.filter(e => e.kind === 'current').length, 1);
  assert.ok(g.speed > base * 1.3, `${g.speed} vs ${base}`);
  g.items[0].y = g.player.y + 300; run(g, 1.2, true, game => { game.player.breath = WORLD.breath; });
  assert.ok(Math.abs(g.speed - paceAt(g.elapsed + g.time).speed) < .5);
});

test('every run rolls its own set pieces, always on safe waves and never overlapping', () => {
  let seed = 7;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let stage = 0; stage < STAGES.length; stage++) {
    const layouts = new Set();
    for (let run = 0; run < 200; run++) {
      const pieces = rollSetPieces(stage, random), pool = STAGES[stage].setPieces;
      layouts.add(JSON.stringify([...pieces].sort()));
      for (const [wave, piece] of pieces) {
        assert.ok(STAGES[stage].encounters[wave], `${stage}:${wave}`);
        if (pool.calm.includes(piece)) assert.equal(STAGES[stage].encounters[wave], 'turtle-turtle-gull', `${piece} needs calm water`);
        else assert.ok(pool.shows.includes(piece), piece);
      }
      const waves = [...pieces.keys()].sort((a, b) => a - b);
      waves.slice(1).forEach((wave, i) => assert.ok(wave - waves[i] > 1, `pieces ${waves} overlap`));
      assert.equal(new Set(pieces.values()).size, pieces.size, 'no piece twice in one run');
    }
    assert.ok(layouts.size > 5, `stage ${stage} should vary between runs, got ${layouts.size} layouts`);
    const decor = rollDecor(stage, random);
    assert.equal(decor.residents.length, decor.offsets.length);
  }
});

