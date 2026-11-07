import { STAGES } from '../src/stages.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, step, hitsTerrain, beakPosition } from '../src/game.js';

test('split schools offer two catchable lanes with room above the coral', () => {
  for (const [stage, kind] of [[0, 'turtle'], [1, 'coral']]) {
    const game = createGame(() => .5, stage);
    game.wave = STAGES[stage].encounters.indexOf(kind);
    game.distance = game.nextEncounter; game.items = [];
    step(game, .01, false);
    const lower = game.items.filter(i => i.kind === 'fish' && i.lane === 'alternate');
    assert.equal(lower.length, 7);
    for (const fish of lower) {
      const upper = game.items.find(i => i.kind === 'fish' && i.x === fish.x && i.y < fish.y);
      assert.ok(upper && fish.y - upper.y >= 90);
      for (const target of [upper, fish]) {
        const g = createGame(); g.nextEncounter = Infinity;
        g.player.y = target.y + 20.52; g.player.wet = true;
        const beak = beakPosition(g.player);
        g.items = [{ ...target, x: beak.x }];
        step(g, .001, false);
        assert.equal(g.fish, 1);
        if (kind === 'coral') assert.equal(hitsTerrain(g.player, {kind: 'coral', x: g.player.x}), false);
      }
    }
  }
});

test('buoys require diving and buoy/coral narrows the route without closing it', () => {
  for (const kind of ['buoy', 'coral']) {
    const item = {kind, x: 118};
    assert.equal(hitsTerrain({x: 118, y: 530}, item), false);
    const g = createGame(); g.items = [item]; g.nextEncounter = Infinity;
    g.player.y = kind === 'buoy' ? 360 : 650; g.player.wet = true;
    step(g, .001, false);
    assert.equal(g.endReason, kind);
  }
  for (const y of [265, 360, 440]) assert.ok(hitsTerrain({x: 118, y}, {kind: 'buoy', x: 118}));
  const g = createGame(() => .5, 3);
  g.wave = STAGES[3].encounters.findIndex(entry => entry.startsWith('buoy-coral'));
  g.distance = g.nextEncounter; g.items = []; step(g, .01, false);
  const buoy = g.items.find(i => i.kind === 'buoy'), coral = g.items.find(i => i.kind === 'coral');
  assert.equal(buoy.x, coral.x);
  for (const y of [500, 530, 565]) for (const item of [buoy, coral]) assert.equal(hitsTerrain({x: item.x, y}, item), false);
});
