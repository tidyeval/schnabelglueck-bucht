import { STAGES } from './stages.js';

/**
 * Mutable simulation state, created per attempt. Rendering only reads it.
 * `stage` is the journey/save index; STAGES[stage].id identifies its content.
 * `time` advances during active travel; `elapsed` carries time from earlier stages.
 * Feeding and settling suspend travel; `ended` makes subsequent steps no-ops.
 * The app may stop an attempt and attach its persistence ID; progress tracks accounting.
 * @typedef {ReturnType<typeof createGame>} GameState
 */

/**
 * Shared item fields; encounter() initializes additional behavior fields by kind.
 * Positions are world coordinates. `caught` schedules removal after the current step.
 * @typedef {object} GameItem
 * @property {'fish'|'shark'|'turtle'|'boat'|'gull'|'diver'|'harpoon'|'surfer'|'jelly'|'puffer'|'driftwood'|'whirlpool'|'bubble'|'nest'|'baitball'|'current'|'island'|'reef'|'buoy'|'coral'|'mangrove'} kind
 * @property {number} x
 * @property {number} [y] Terrain derives its vertical bounds from its kind.
 * @property {boolean} [caught]
 */

/**
 * Events are returned in simulation order; presentation consumers only read state.
 * Position/payload fields are present only when relevant to that event.
 * @typedef {object} GameEvent
 * @property {'end'|'delivery'|'rare'|'show'|'airWarning'|'splash'|'breach'|'islandWarning'|'reefWarning'|'sardine'|'feast'|'current'|'warning'|'netSplash'|'outsmart'|'airBonus'|'fishLeap'|'catch'|'airCatch'|'frenzy'|'mission'|'nearMiss'|'kick'|'hurt'|'trick'} kind
 * @property {number} [x]
 * @property {number} [y]
 * @property {string} [name]
 * @property {number} [points]
 * @property {number} [count]
 * @property {number} [combo]
 * @property {number} [turns]
 * @property {number} [power]
 * @property {boolean} [golden]
 */

export const WORLD = { capacity: 20, width: 480, height: 850, water: 360, duration: 75, breath: 8 };
export const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
export const playerTilt = player => clamp(player.vy / 340, -.5, .78) - (player.spin || 0);
export function beakPosition(player) {
  const angle = playerTilt(player);
  return { x: player.x + .76 * (66 * Math.cos(angle) + 27 * Math.sin(angle)), y: player.y + .76 * (66 * Math.sin(angle) - 27 * Math.cos(angle)) };
}

// These points are used by both the illustration and collision detection.
export function netShape(boat) {
  const age = boat.cast;
  if (age < .85 || age >= 3.25) return null;
  let x, y, width, depth, phase;
  if (age < 1.45) {
    const progress = (age - .85) / .6;
    phase = 'flight'; x = boat.x + 28 - 98 * progress;
    y = WORLD.water - 75 + 83 * progress - 95 * Math.sin(Math.PI * progress);
    width = 12 + 40 * progress; depth = 8 + 12 * Math.sin(Math.PI * progress);
    return { phase, x, y, width, depth, points: Array.from({ length: 12 }, (_, i) => ({ x: x + Math.cos(i / 12 * Math.PI * 2) * width, y: y + Math.sin(i / 12 * Math.PI * 2) * depth })) };
  }
  const sink = clamp((age - 1.45) / .65, 0, 1);
  const haul = clamp((age - 2.55) / .7, 0, 1);
  phase = age < 2.1 ? 'sink' : age < 2.55 ? 'soak' : 'haul';
  x = boat.x - 70 + haul * 82; y = WORLD.water + 8 - haul * 48;
  width = 52 * (1 - haul * .8); depth = (8 + 164 * sink) * (1 - haul);
  return { phase, x, y, width, depth, points: [[-.82,0],[.82,0],[1,.28],[.85,.8],[.4,1],[-.4,1],[-.85,.8],[-1,.28]].map(([dx, dy]) => ({ x: x + dx * width, y: y + dy * depth })) };
}

function hitsPolygon(x, y, points) {
  const radius = 18;
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[j], b = points[i];
    const dx = b.x - a.x, dy = b.y - a.y;
    const u = clamp(((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy || 1), 0, 1);
    if (Math.hypot(x - a.x - u * dx, y - a.y - u * dy) <= radius) return true;
    if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

export function hitsNet(player, net) {
  return net ? hitsPolygon(player.x, player.y - 8, net.points) : false;
}

// One trick attempt per breach; a third quick press upgrades the running spin.
/** @param {GameState} game */
export function press(game) {
  const p = game.player;
  if (game.ended || game.feeding || p.wet || game.time > p.trickUntil) return;
  if (p.trickUsed) {
    if (p.turns === 1 && game.time - p.tapAt <= .32) p.turns = 2;
    return;
  }
  p.taps = game.time - p.tapAt <= .32 ? p.taps + 1 : 1;
  p.tapAt = game.time;
  if (p.taps === 2) { p.turns = 1; p.spin = 0; p.trickUsed = true; }
}

export function hitsBoat(player, boat) {
  const x = player.x, y = player.y - 8, radius = 18;
  // Hull and fisherman, matching the visible drawing rather than its center only.
  return [[-77, 77, -17, 28], [-30, 25, -100, -17]].some(([left, right, top, bottom]) =>
    Math.hypot(x - clamp(x, boat.x + left, boat.x + right), y - clamp(y, WORLD.water + top, WORLD.water + bottom)) < radius);
}

export function hitsFisher(player, boat) {
  const x = player.x, y = player.y - 8, radius = 18;
  return Math.hypot(x - clamp(x, boat.x - 30, boat.x + 25), y - clamp(y, WORLD.water - 100, WORLD.water - 17)) < radius;
}

// Solid scenery. A mangrove's canopy and root curtain block the sky lane, so Pip dives under it.
export const TERRAIN = ['island', 'reef', 'buoy', 'coral', 'mangrove'];
export function terrainBlocks(item) {
  return (item.kind === 'buoy' ? [[-32, 245, 64, 220]]
    : item.kind === 'mangrove' ? [[-72, 232, 144, 293]]
    : item.kind === 'coral' ? [[-85, 610, 170, 240]]
    : item.kind === 'island' ? [[-70, 330, 140, 520]] : [[-60, 382, 120, 68], [-85, 610, 170, 240]])
    .map(([x, y, width, height]) => {
      x += item.x;
      const points = [[14,0],[width * .3,0],[width * .55,0],[width * .76,3],[width - 14,2],[width - 5,7],[width,14],
        [width - 4,height * .27],[width,height * .5],[width - 7,height * .73],[width,height - 14],[width - 5,height - 5],[width - 14,height],
        [width * .68,height - 3],[width * .42,height],[14,height],[5,height - 5],[0,height - 14],[6,height * .76],[1,height * .52],
        [8,height * .3],[0,14],[2,8],[6,2]].map(([dx, dy]) => ({ x: x + dx, y: y + dy }));
      return { x, y, width, height, points };
    });
}
// Swimmers overtake the scrolling world, so they must find a gap around rocks, coral and buoys.
// Returns the closest height to y that keeps a body of halfHeight clear of terrain ahead.
export function terrainSafeY(items, x, y, halfHeight = 32, ahead = 150) {
  let free = [[WORLD.water + 40, 790]];
  for (const block of items.filter(item => TERRAIN.includes(item.kind)).flatMap(terrainBlocks)) {
    if (block.x > x + 70 || block.x + block.width < x - ahead) continue;
    const top = block.y - halfHeight - 6, bottom = block.y + block.height + halfHeight + 6;
    free = free.flatMap(([a, b]) => [[a, Math.min(b, top)], [Math.max(a, bottom), b]]).filter(([a, b]) => b > a);
  }
  if (!free.length) return y;
  const [a, b] = free.reduce((best, gap) => Math.abs(clamp(y, ...gap) - y) < Math.abs(clamp(y, ...best) - y) ? gap : best);
  return clamp(y, a, b);
}
export function hitsTerrain(player, item) {
  return terrainBlocks(item).some(b => hitsPolygon(player.x, player.y, b.points));
}

// One journey: more speed and less space as active play time accumulates.
export function paceAt(seconds) {
  const points = [[0, 190, 760], [55, 210, 720], [100, 230, 680], [150, 255, 640]];
  seconds = Math.max(0, seconds);
  const upper = points.findIndex(point => seconds <= point[0]);
  if (upper < 0) return { speed: 255, spacing: 640 };
  if (upper === 0) return { speed: 190, spacing: 760 };
  const [fromTime, fromSpeed, fromSpacing] = points[upper - 1];
  const [toTime, toSpeed, toSpacing] = points[upper];
  const progress = (seconds - fromTime) / (toTime - fromTime);
  return { speed: fromSpeed + (toSpeed - fromSpeed) * progress, spacing: fromSpacing + (toSpacing - fromSpacing) * progress };
}
export const UNDERWATER_BANDS = [
  { id: 'upper', y: 420 },
  { id: 'middle', y: 535 },
  { id: 'lower', y: 650 },
];
// Spectacle between the regular encounters, rolled anew for every run. Calm waves get an
// optional reward (bait ball, current or dolphins); shows are scenery only.
const pick = (list, random) => list.splice(Math.floor(random() * list.length), 1)[0];
export function rollSetPieces(stage, random) {
  const pieces = new Map(), pool = STAGES[stage].setPieces, encounters = STAGES[stage].encounters, calm = [...pool.calm], shows = [...pool.shows];
  encounters.forEach((entry, wave) => { if (entry === 'turtle-turtle-gull') pieces.set(wave, pick(calm, random)); });
  // Keep shows apart from each other and from calm pieces so no two overlap on screen.
  let open = encounters.map((_, wave) => wave).filter(wave => wave >= 2 && ![...pieces.keys()].some(taken => Math.abs(taken - wave) <= 1));
  for (let i = 0; i < pool.count && open.length; i++) {
    const wave = open[Math.floor(random() * open.length)];
    pieces.set(wave, pick(shows, random));
    open = open.filter(other => Math.abs(other - wave) > 1);
  }
  return pieces;
}
// Every run holds one special moment per stage, a little wonder at a random point.
export const RARE = { chance: 1 };
export function rollRare(stage, random) {
  if (random() >= RARE.chance) return null;
  return { name: STAGES[stage].rareMoment, wave: 2 + Math.floor(random() * (STAGES[stage].encounters.length - 4)) };
}
// Background residents and small character moments, scattered differently every run.
export function rollDecor(stage, random) {
  const residents = [...STAGES[stage].residents];
  pick(residents, random);
  return { residents, offsets: residents.map(() => 200 + random() * 1300), sleepy: random() < .5, catHouse: Math.floor(random() * 6) };
}
export const FRENZY = { combo: 15, duration: 6, interval: .24 };
export const JUMP = { from: 430, range: 250, boost: 300, gravity: 700, ceiling: 150 };
export const NEAR_MISS = { margin: 26, points: 30 };
export function sardinePositions(ball, time) {
  return ball.seeds.map((seed, i) => {
    const angle = seed * 6.283 + time * (1.1 + (i % 5) * .22) * (i % 2 ? 1 : -1);
    const radius = (16 + (seed * 97 % 1) * 46) * (1 + ball.scatter * 1.1);
    return { x: ball.x + Math.cos(angle) * radius * 1.25, y: ball.y + Math.sin(angle) * radius * .8, eaten: ball.eaten[i], heading: Math.cos(angle) * (i % 2 ? 1 : -1) };
  });
}
export const currentSpan = item => ({ left: item.x, right: item.x + item.length, top: item.y - 46, bottom: item.y + 46 });
function hazardGap(item, p) {
  const dx = Math.abs(item.x - p.x), dy = Math.abs(item.y - p.y);
  if (item.kind === 'shark') return p.wet ? Math.max(dx - 58, dy - 34) : Infinity;
  if (item.kind === 'gull') return item.kicked ? Infinity : Math.max(dx - 36, dy - 30);
  if (item.kind === 'jelly') return Math.max(dx - 35, item.y - 35 - p.y, p.y - (item.y + 20 + item.phase * 65));
  if (item.kind === 'puffer') return item.phase === 'puffed' ? Math.hypot(dx, dy) - pufferRadius(item) - 18 : Infinity;
  return Infinity;
}
export const LEAP = { from: WORLD.water + 40, height: 125, duration: 1.1, at: 430 };
export function leapY(t) { return LEAP.from - Math.sin(clamp(t / LEAP.duration, 0, 1) * Math.PI) * LEAP.height; }
export const ENERGY = { fish: 4, golden: 12, grace: 2, drain: 3, flightDrain: 8, protection: 1.2 };
const contactDamage = { shark: 35, boat: 30, diver: 20, harpoon: 25, surfer: 20, gull: 15, jelly: 20, driftwood: 15, puffer: 30 };

// Includes continued descent during reaction time and the turn from diving to rising.
export function airState(player, cargo = 0) {
  if (!player.wet) return { level: 0, urgency: 0, warningAt: 0 };
  const ascent = 210 - cargo / WORLD.capacity * 45;
  const reactionDepth = Math.min(710, player.y + .75 * (240 + cargo / WORLD.capacity * 20));
  const warningAt = Math.max(2, (reactionDepth - WORLD.water - 12) / ascent + 1.35);
  const margin = player.breath - Math.max(0, player.y - WORLD.water - 12) / ascent;
  const level = player.breath <= warningAt ? (margin <= 1 ? 2 : 1) : 0;
  return { level, urgency: level ? clamp(1 - margin / 2.1, .2, 1) : 0, warningAt };
}
export function pufferRadius(item) {
  return 22 + 23 * (item.phase === 'puffed' ? 1 : item.phase === 'inflate' ? clamp(1 - item.timer / .45, 0, 1) : item.phase === 'deflate' ? clamp(item.timer / .7, 0, 1) : 0);
}
export function hitsPuffer(player, item) {
  return item.phase === 'puffed' && Math.hypot(player.x - item.x, player.y - item.y) < pufferRadius(item) + 18;
}
function encounter(game) {
  const entry = STAGES[game.stage].encounters[game.wave];
  if (!entry) {
    game.items.push({ kind: 'nest', final: true, x: 1050, y: WORLD.water, served: false, celebration: 0 });
    [440, 425, 410].forEach((y, i) => game.items.push({ kind: 'fish', x: 550 + i * 80, y, route: game.wave }));
    game.nextEncounter = Infinity;
    return;
  }
  const sharkCount = entry.split('-').filter(kind => kind === 'shark').length;
  if (sharkCount + game.items.filter(item => item.kind === 'shark' && !item.caught).length > 2) {
    game.nextEncounter = game.distance + 180;
    return;
  }
  const wave = game.wave;
  const [kind, ...companions] = entry.split('-');
  const pairPattern = STAGES[game.stage].pairPatterns[wave] || 'single';
  const variant = Math.floor(game.random() * 3);
  let bandVariant = (Math.floor(game.random() * 3) + wave + Math.floor(wave / 3)) % UNDERWATER_BANDS.length;
  if (sharkCount > 1) {
    if (bandVariant === game.lastPairBand) bandVariant = (bandVariant + 1) % UNDERWATER_BANDS.length;
    game.lastPairBand = bandVariant;
  }
  const arc = (base, height) => Array.from({ length: 11 }, (_, i) => base + Math.sin(i / 10 * Math.PI) * height);
  const depths = kind === 'boat' ? [432,475,530,595,620,620,615,560,490,435,405]
    : ['reef', 'buoy'].includes(kind) ? [440,470,490,510,520,530,530,510,470,435,405]
    : kind === 'shark' ? arc([410, 475, 540][variant], 30)
    : kind === 'island' ? arc(410, 30)
    : kind === 'mangrove' ? arc(430, 200)
    : kind === 'turtle' ? arc([410,475,565][variant], 40)
    : kind === 'coral' ? arc(410, 35)
    : arc(440, 65);
  const addFish = (x, y, lane = 'main') => game.items.push({ kind: 'fish', x, y, golden: false, lane, route: game.wave });
  depths.forEach((y, i) => addFish(540 + i * 64, y));
  // Parallel schools share a curved shape, but occupy separate water depths.
  if (['turtle', 'coral'].includes(kind) || kind === 'gull') {
    const base = kind === 'turtle' && variant === 2 ? 435 : kind === 'coral' ? 515 : 580;
    arc(base, 35).slice(2, 9).forEach((y, i) => addFish(668 + i * 64, y, 'alternate'));
  }
  if (kind === 'boat') game.items.push({ kind, x: 890, y: WORLD.water, cast: -1, hit: false, look: game.boats++ % 4 });
  const animalPosition = (index = 0) => {
    const bandIndex = kind === 'shark' && STAGES[game.stage].id === 'bay' && wave === 1 ? 1 : (bandVariant + index) % UNDERWATER_BANDS.length;
    return UNDERWATER_BANDS[bandIndex];
  };
  const bands = [];
  if (kind === 'shark' || kind === 'turtle') {
    const band = animalPosition(); bands.push(band.id);
    game.items.push({ kind, x: kind === 'shark' ? 880 : 890, y: band.y, baseY: band.y, lane: band.id, encounterForm: pairPattern, warningTime: STAGES[game.stage].id === 'bay' && wave === 1 ? 1.15 : STAGES[game.stage].sharkWarning });
  }
  if (kind === 'puffer') game.items.push({ kind, x: 890, y: 665, phase: 'idle', timer: 0 });
  companions.forEach((companion, index) => {
    const guardedCorridor = kind === 'buoy' && companions.includes('coral') && companion === 'shark';
    const band = guardedCorridor ? UNDERWATER_BANDS[0] : ['shark', 'turtle'].includes(companion) ? animalPosition(index + 1) : null;
    if (band) bands.push(band.id);
    const y = companion === 'gull' ? 285 : band?.y ?? 665;
    const pairX = pairPattern === 'parallel' ? 900 + index * 30 : pairPattern === 'staggered' ? 1010 + index * 120 : 960 + index * 120;
    game.items.push({ kind: companion, x: companion === 'coral' ? 890 : pairX,
      y, baseY: y, lane: band?.id, encounterForm: pairPattern, warningTime: companion === 'shark' ? STAGES[game.stage].sharkWarning : undefined,
      phase: companion === 'puffer' ? 'idle' : 0, timer: 0 });
  });
  if (sharkCount > 1) {
    const freeBand = UNDERWATER_BANDS.find(band => !bands.includes(band.id));
    game.items.filter(item => item.kind === 'fish' && item.route === wave && item.lane === 'main').forEach((fish, index) => {
      fish.y = freeBand.y + Math.sin(index / 10 * Math.PI) * 24;
    });
  } else if (STAGES[game.stage].id === 'bay' && wave === 1) {
    game.items.filter(item => item.kind === 'fish' && !item.golden && item.route === wave && item.lane === 'main').forEach((fish, index) => {
      fish.y = UNDERWATER_BANDS[1].y + Math.sin(index / 10 * Math.PI) * 20;
    });
  }
  game.encounterTrace.push({ stage: game.stage, wave, entry, form: pairPattern, bands });
  if (game.rare?.wave === wave) { game.rareShow = { name: game.rare.name, start: game.time }; game.pendingRare = game.rare.name; }
  const piece = game.pieces.get(wave);
  if (piece === 'baitball') {
    const seeds = Array.from({ length: 22 }, (_, i) => (i * .618034 + .13) % 1);
    game.items.push({ kind: 'baitball', x: 1010, y: 560, seeds, eaten: seeds.map(() => false), scatter: 0, left: seeds.length });
  } else if (piece === 'current') {
    const taken = bands.length ? bands : [];
    const band = UNDERWATER_BANDS.find(candidate => !taken.includes(candidate.id)) || UNDERWATER_BANDS[1];
    game.items.push({ kind: 'current', x: 700, y: band.y, length: 560, entered: false });
    for (let i = 0; i < 8; i++) game.items.push({ kind: 'fish', x: 760 + i * 62, y: band.y + Math.sin(i * .9) * 14, golden: false, lane: 'alternate', route: wave, bonus: true });
  } else if (piece) {
    game.show = { name: piece, start: game.time };
    game.pendingShow = piece;
    if (piece === 'dolphins') for (let i = 0; i < 10; i++) game.items.push({ kind: 'fish', x: 780 + i * 56, y: 520 - Math.sin(i / 9 * Math.PI) * 70, golden: false, lane: 'alternate', route: wave, bonus: true });
  }
  if (TERRAIN.includes(kind)) game.items.push({ kind, x: 890 });
  // A swimmer whose band crosses this wave's rock starts ahead of it, so it swims away instead of through.
  const rocks = game.items.filter(item => TERRAIN.includes(item.kind) && item.x >= 800).flatMap(terrainBlocks);
  for (const swimmer of game.items.filter(item => ['shark', 'turtle'].includes(item.kind) && item.x >= 850)) {
    const blocking = rocks.filter(block => swimmer.baseY + 42 > block.y && swimmer.baseY - 42 < block.y + block.height);
    if (blocking.length) swimmer.x = Math.min(...blocking.map(block => block.x)) - 120;
  }
  if (kind !== 'island') game.items.push({ kind: 'fish', x: kind === 'shark' ? 1050 : 860, y: sharkCount > 1 ? UNDERWATER_BANDS[bandVariant].y : ['reef', 'buoy', 'coral'].includes(kind) ? 530 : kind === 'mangrove' ? 680 : kind === 'boat' ? 710 : kind === 'shark' ? 555 : 650, golden: true });
  if (['gull', 'jelly', 'driftwood', 'whirlpool'].includes(kind)) game.items.push({ kind, x: 890, y: kind === 'gull' ? 285 : kind === 'driftwood' ? WORLD.water : 640, phase: 0 });
  if (kind === 'diver') game.items.push({ kind, x: 890, y: 620, phase: 'idle', timer: 0 });
  if (kind === 'surfer') game.items.push({ kind, x: 890, y: WORLD.water, escaping: false });
  game.items.push({ kind: 'bubble', x: 1120, y: 540 });
  // End the school below the surface, then leave room to breathe and do a trick.
  [440, 415, 400].forEach((y, i) => addFish(1220 + i * 60, y, 'exit'));
  // Now and then a fish leaps out of the breathing gap: a bonus for a well-timed breach.
  if ((variant + wave) % 2 === 0 && kind !== 'island') game.items.push({ kind: 'fish', x: 1460, y: LEAP.from, golden: false, lane: 'alternate', route: wave, bonus: true, leap: 0 });
  const terrain = game.items.filter(item => TERRAIN.includes(item.kind));
  game.items = game.items.filter(item => item.kind !== 'fish' || !terrain.some(block => hitsTerrain(item, block)));
  game.wave++;
  const nextEntry = STAGES[game.stage].encounters[game.wave] || '';
  const approachSpace = TERRAIN.some(obstacle => nextEntry.split('-').includes(obstacle)) ? 180 : 0;
  const recoverySpace = sharkCount > 1 || entry === 'turtle-turtle-gull' ? 90 : entry === 'buoy-coral-shark' ? 120 : 0;
  game.nextEncounter += paceAt(game.elapsed + game.time).spacing + approachSpace + recoverySpace + (kind === 'island' ? 180 : 0);
}

/**
 * @param {() => number} [random] Random draws in [0, 1); inject for reproducible runs.
 * @param {number} [stage] Journey/save index, clamped to the available stages.
 * @param {number} [elapsed] Earlier active journey seconds; defaults to this stage's pace.
 */
export function createGame(random = Math.random, stage = 0, elapsed) {
  stage = Number.isInteger(stage) ? clamp(stage, 0, STAGES.length - 1) : 0;
  elapsed = Number.isFinite(elapsed) ? Math.max(0, elapsed) : STAGES[stage].startElapsed;
  const pieces = rollSetPieces(stage, random), decor = rollDecor(stage, random), rare = rollRare(stage, random);
  return {
    pieces, decor, rare, rareShow: null,
    elapsed, stage, random, time: 0, distance: 0, speed: paceAt(elapsed).speed, energy: 100, score: 0, fish: 0,
    cargo: 0, delivered: 0, feeding: 0, feedingTotal: 0, combo: 0, comboTime: 0, bestCombo: 0, diveFish: 0, mission: false,
    player: { x: 118, y: 265, vy: 0, wet: false, gulp: 0, breach: 0, breath: WORLD.breath, spin: 0, turns: 0, trickUntil: -1, taps: 0, tapAt: -10, trickUsed: false },
    items: [
      { kind: 'boat', x: 460, y: WORLD.water, cast: -1, hit: false, look: 0 },
      { kind: 'gull', x: 640, y: 285, phase: 0 },
      { kind: 'shark', x: 780, y: 420, baseY: 420, lane: 'upper', encounterForm: 'single', warningTime: 1.15 },
      ...Array.from({ length: 5 }, (_, i) => ({ kind: 'fish', x: 340 + i * 48, y: 590 + Math.sin(i * .6) * 18, golden: false })),
    ],
    frenzy: 0, frenzySpawn: 0, frenzyArmed: true, boost: 0, nearMisses: 0, show: null,
    nextEncounter: 100, wave: 0, boats: 1, lastPairBand: -1, encounterTrace: [], ended: false,
  };
}

/**
 * Advance the supplied state in place; no DOM, storage, audio or rendering effects.
 * @param {GameState} game
 * @param {number} dt Simulation seconds, clamped to [0, .05].
 * @param {boolean} holding Whether the dive control is held.
 * @returns {GameEvent[]} Events from this step only, in occurrence order.
 */
export function step(game, dt, holding) {
  if (game.ended) return [];
  dt = clamp(dt, 0, .05);
  const events = [];
  const p = game.player;
  if (game.feeding > 0 || game.settling > 0) return advanceNest(game, dt);
  game.time += dt;
  const waitingNest = game.items.find(item => item.kind === 'nest' && item.final && item.x <= p.x + 55);
  game.speed = waitingNest ? 0 : paceAt(game.elapsed + game.time).speed * (1 + .35 * game.boost);
  if (game.pendingRare) { events.push({ kind: 'rare', name: game.pendingRare }); game.pendingRare = null; }
  if (game.pendingShow) { events.push({ kind: 'show', name: game.pendingShow }); game.pendingShow = null; }
  game.frenzy = Math.max(0, game.frenzy - dt);
  game.distance += game.speed * dt;
  p.hurt = Math.max(0, (p.hurt || 0) - dt);
  // Check before encounters/nest arrival: coasting cannot bypass exhaustion.
  const energyDrain = p.wet ? ENERGY.drain : ENERGY.flightDrain;
  game.energy = Math.max(0, game.energy - Math.min(dt, Math.max(0, game.time - ENERGY.grace)) * energyDrain);
  if (game.energy <= 0) {
    game.ended = true; game.endReason = 'energy'; return [{ kind: 'end' }];
  }
  const previousAir = airState(p, game.cargo);
  p.breath = clamp(p.breath + dt * (p.wet ? -1 : WORLD.breath / 2), 0, WORLD.breath);
  if (!previousAir.level && airState(p, game.cargo).level) events.push({ kind: 'airWarning' });
  if (p.breath === 0) {
    game.ended = true; game.endReason = 'air';
    return [...events, { kind: 'end' }];
  }
  movePlayer(game, dt, holding, previousAir, events);
  updateCombo(game, dt);
  return advanceWorld(game, dt, events);
}

function advanceNest(game, dt) {
  const p = game.player;
  if (game.feeding > 0) {
    game.feeding = Math.max(0, game.feeding - dt);
    const remaining = Math.ceil(game.feedingTotal * game.feeding / 1.8);
    game.cargo = Math.min(game.cargo, remaining);
    if (!game.feeding) {
      const points = game.feedingTotal * 15;
      game.score += points; game.delivered += game.feedingTotal; game.cargo = 0;
      p.breach = .6; p.vy = -235; p.breath = WORLD.breath; p.feedX = undefined;
      if (game.items.some(item => item.kind === 'nest' && item.final && item.served)) game.settling = 1.2;
      return [{ kind: 'delivery', points, count: game.feedingTotal, x: p.x, y: p.y }];
    }
    return [];
  }
  if (game.settling > 0) {
    game.settling = Math.max(0, game.settling - dt);
    if (!game.settling) { game.ended = true; game.endReason = 'complete'; return [{ kind: 'end' }]; }
    return [];
  }
}

function movePlayer(game, dt, holding, previousAir, events) {
  const p = game.player;
  const weight = game.cargo / WORLD.capacity;
  const target = holding ? (p.wet ? 240 + weight * 20 : 255) : (p.wet ? -210 + weight * 45 : -100 + weight * 25);
  if (p.jump && !p.wet && !holding) {
    // A deep dive launches Pip ballistically above his usual gliding height.
    p.vy += JUMP.gravity * dt;
    p.y += p.vy * dt;
    if (p.y < JUMP.ceiling) { p.y = JUMP.ceiling; p.vy = Math.max(0, p.vy); }
    if (p.y >= 265 && p.vy > 0) { p.y = 265; p.vy = 0; p.jump = false; }
    else if (p.y > 265 && p.vy >= -100) p.jump = false;
  } else {
    p.vy += (target - p.vy) * (1 - Math.exp(-dt * (p.wet ? 9 : 6)));
    p.y = clamp(p.y + p.vy * dt, Math.min(265, p.y), 710);
    if (p.y >= 265) p.jump = false;
    if (p.y === 265 || p.y === 710) p.vy = 0;
  }
  if (p.wet) p.deepest = Math.max(p.deepest || 0, p.y);
  p.relief = Math.max(0, (p.relief || 0) - dt); p.bump = Math.max(0, (p.bump || 0) - dt); p.confused = Math.max(0, (p.confused || 0) - dt); p.kick = Math.max(0, (p.kick || 0) - dt);
  p.gulp = Math.max(0, p.gulp - dt); p.breach = Math.max(0, p.breach - dt);
  const wet = p.y > WORLD.water + 12;
  if (wet !== p.wet) {
    const lift = wet ? 0 : clamp(((p.deepest || 0) - JUMP.from) / JUMP.range, 0, 1);
    events.push({ kind: wet ? 'splash' : 'breach', x: p.x, y: WORLD.water, power: wet ? clamp(p.vy / 255, .3, 1) : .45 + lift * .55 });
    if (wet) { game.diveFish = 0; p.turns = 0; p.spin = 0; p.kick = 0; p.trickUntil = -1; p.deepest = p.y; p.jump = false; }
    else {
      p.relief = previousAir.level ? 1.5 : .65; p.breach = .6; p.vy = -235 - lift * JUMP.boost; p.jump = lift > .3; p.lift = lift;
      p.trickUntil = game.time + 1.2 + lift * .5; p.taps = 0; p.tapAt = -10; p.trickUsed = false;
    }
    p.wet = wet;
  }
  if (p.turns && !p.wet) p.spin = Math.min(p.turns * Math.PI * 2, p.spin + dt * Math.PI * 2 / .65);
}

function updateCombo(game, dt) {
  const p = game.player;
  game.comboTime = Math.max(0, game.comboTime - dt);
  if (!game.comboTime) game.combo = 0;
  if (!game.combo) game.frenzyArmed = true;
  if (game.frenzy > 0 && game.speed > 0 && game.nextEncounter !== Infinity) {
    game.frenzySpawn -= dt;
    if (game.frenzySpawn <= 0) {
      game.frenzySpawn = FRENZY.interval;
      const bonus = { kind: 'fish', x: 540, y: clamp((p.wet ? p.y : 450) + Math.sin(game.time * 3.2) * 46, 410, 690), golden: false, lane: 'alternate', bonus: true };
      const blocked = game.items.some(item => TERRAIN.includes(item.kind) && Math.abs(item.x - bonus.x) < 150);
      if (!blocked) game.items.push(bonus);
    }
  }
}

function updateShark(game, item, dt, events) {
  const p = game.player;
  const journeyTime = game.elapsed + game.time;
  item.x -= (12 + Math.min(32, Math.floor(journeyTime / 20) * 4)) * dt;
  const pursuit = 16 + Math.min(62, Math.max(0, journeyTime - 20) * .34);
  item.reaction = Math.max(0, (item.reaction || 0) - dt);
  if (!p.wet || item.x < p.x - 65) { item.phase = 'cruise'; item.attackTime = 0; }
  else if (item.x < 480) {
    if (!item.phase || item.phase === 'cruise') item.phase = 'track';
    if (item.phase === 'track') {
      const lane = UNDERWATER_BANDS.find(candidate => candidate.id === item.lane);
      const targetY = lane ? clamp(p.y, lane.y - 24, lane.y + 24) : p.y;
      item.y += clamp(targetY - item.y, -pursuit * dt, pursuit * dt);
      if (item.x < p.x + 240) { item.phase = 'warn'; item.attackTime = item.warningTime ?? .85; events.push({ kind: 'warning', x: item.x, y: item.y - 65 }); }
    } else if (item.phase === 'warn') {
      item.attackTime -= dt;
      if (item.attackTime <= 0) { item.phase = 'dash'; item.attackTime = .55; item.dashY = clamp((p.y - item.y) * 1.4, -110, 110); }
    } else if (item.phase === 'dash') {
      item.x -= (35 + pursuit) * dt; item.y += item.dashY * dt; item.attackTime -= dt;
      if (item.attackTime <= 0) { item.phase = 'spent'; item.reaction = .9; }
    }
  }
  const lane = UNDERWATER_BANDS.find(candidate => candidate.id === item.lane);
  const laneY = lane ? clamp(item.y, lane.y - 38, lane.y + 38) : clamp(item.y, WORLD.water + 70, 720);
  // Terrain wins over the lane: off screen the shark simply starts in the gap, on screen it steers there.
  const safeY = terrainSafeY(game.items, item.x, laneY);
  item.y = safeY === laneY ? laneY : item.x > 520 ? safeY : item.y + clamp(safeY - item.y, -260 * dt, 260 * dt);
}

function updateDiver(game, item, dt, events) {
  const p = game.player;
  if (item.phase === 'idle' && item.x < 475 && p.wet) { item.phase = 'aim'; item.timer = 1.1; }
  if (item.phase === 'aim') {
    item.aimX = p.x; item.aimY = p.y; item.timer -= dt;
    if (item.timer <= 0) { item.phase = 'locked'; item.timer = .6; events.push({ kind: 'warning', x: item.x, y: item.y - 50 }); }
  } else if (item.phase === 'locked') {
    item.timer -= dt;
    if (item.timer <= 0) {
      const dx = item.aimX - item.x, dy = item.aimY - item.y, length = Math.hypot(dx, dy) || 1;
      const speed = 180 + Math.min(65, game.time * .35);
      game.items.push({ kind: 'harpoon', x: item.x - 30, y: item.y, vx: dx / length * speed, vy: dy / length * speed, life: 2.8, firedAt: game.time });
      item.phase = 'reload'; item.timer = 3;
    }
  } else if (item.phase === 'reload') {
    item.timer -= dt; if (item.timer <= 0 && item.x > p.x + 120) item.phase = 'idle';
  }
}

function updateBoat(game, item, dt, events) {
  const p = game.player;
  item.reaction = Math.max(0, (item.reaction || 0) - dt);
  if (item.cast < 0 && item.x <= 480) {
    item.cast = 0;
    events.push({ kind: 'warning', x: item.x, y: WORLD.water - 125 });
  } else if (item.cast >= 0) {
    const before = item.cast;
    item.cast += dt;
    if (before < 1.45 && item.cast >= 1.45) events.push({ kind: 'netSplash', x: item.x - 70, y: WORLD.water });
    // Once the fully sunken net has passed Pip, the fisherman reels it in.
    if (item.cast >= 2.1 && item.cast < 2.55 && item.x - 18 < p.x - 20) item.cast = 2.55;
    if (before < 2.55 && item.cast >= 2.55) { item.reaction = 1.2; item.reactionKind = 'miss'; }
  }
}

function updateFish(game, item, dt, beak, events) {
  const p = game.player;
  if (item.leap !== undefined && (item.leap > 0 || item.x < LEAP.at) && item.leap < LEAP.duration) {
    const clear = !item.leap && game.items.some(other => TERRAIN.includes(other.kind) && Math.abs(other.x - item.x) < 260);
    if (clear) item.leap = undefined;
    else {
      if (!item.leap) events.push({ kind: 'fishLeap', x: item.x, y: WORLD.water });
      item.leap += dt; item.y = leapY(item.leap);
      if (item.leap >= LEAP.duration) events.push({ kind: 'fishLeap', x: item.x, y: WORLD.water });
    }
  }
  if (Math.hypot((item.x - beak.x) / 1.15, item.y - beak.y) < 32) {
    item.caught = true;
    game.fish++; game.cargo = Math.min(WORLD.capacity, game.cargo + 1); game.combo++; if (p.wet) game.diveFish++;
    game.comboTime = 8.5; p.gulp = .42;
    game.bestCombo = Math.max(game.bestCombo, game.combo);
    const points = (item.golden ? 50 : 10) * Math.min(4, 1 + Math.floor(game.combo / 5)) * (game.frenzy > 0 ? 2 : 1);
    game.score += points;
    game.energy = Math.min(100, game.energy + (item.golden ? ENERGY.golden : ENERGY.fish));
    events.push({ kind: 'catch', x: item.x, y: item.y, points, golden: item.golden, combo: game.combo });
    // Snapping a leaping fish out of the air doubles its points.
    if (!p.wet && item.leap > 0) { game.score += points; events.push({ kind: 'airCatch', x: item.x, y: item.y, points: points * 2 }); }
    if (game.combo >= FRENZY.combo && game.frenzyArmed && !game.frenzy) {
      game.frenzyArmed = false; game.frenzy = FRENZY.duration; game.frenzySpawn = 0;
      events.push({ kind: 'frenzy', x: p.x, y: p.y });
    }
    if (game.diveFish >= 5 && !game.mission) {
      game.mission = true; game.score += 100;
      events.push({ kind: 'mission', x: p.x, y: p.y });
    }
  }
}

function resolveHazard(game, item, events) {
  const p = game.player;
  if (!item.hit && !item.nearDone) {
    item.near = Math.min(item.near ?? Infinity, hazardGap(item, p));
    if (item.x < p.x - 70) {
      item.nearDone = true;
      if (item.near < NEAR_MISS.margin && !p.hurt) {
        game.score += NEAR_MISS.points; game.nearMisses++;
        events.push({ kind: 'nearMiss', x: p.x, y: p.y, points: NEAR_MISS.points });
      }
    }
  }
  const netHit = item.kind === 'boat' && hitsNet(p, netShape(item));
  const fisherHit = item.kind === 'boat' && hitsFisher(p, item);
  const hit = item.kind === 'shark'
    ? Math.abs(item.x - p.x) < 58 && Math.abs(item.y - p.y) < 34
    : TERRAIN.includes(item.kind) ? hitsTerrain(p, item)
    : item.kind === 'puffer' ? hitsPuffer(p, item)
    : item.kind === 'diver' ? Math.abs(item.x - p.x) < 45 && Math.abs(item.y - p.y) < 30
    : item.kind === 'harpoon' ? Math.hypot(item.x - p.x, item.y - p.y) < 25
    : item.kind === 'surfer' ? Math.abs(item.x - p.x) < 65 && p.y > WORLD.water - 90 && p.y < WORLD.water + 30
    : item.kind === 'gull' ? Math.abs(item.x - p.x) < 36 && Math.abs(item.y - p.y) < 30
    : item.kind === 'jelly' ? Math.abs(item.x - p.x) < 35 && p.y > item.y - 35 && p.y < item.y + 20 + item.phase * 65
    : item.kind === 'driftwood' ? Math.abs(item.x - p.x) < 65 && Math.abs(p.y - WORLD.water) < 30
    : hitsBoat(p, item) || netHit;
  const fatalHit = item.kind === 'shark' || item.kind === 'reef' || item.kind === 'diver' || fisherHit;
  if (hit && item.kind === 'gull' && !p.wet && p.turns) {
    item.kicked = true; item.reaction = 1; item.reactionKind = 'kicked';
    p.kick = .45;
    game.score += 75; events.push({ kind: 'kick', x: item.x, y: item.y, points: 75 });
    return;
  }
  if (hit && fatalHit) {
    item.hit = true; p.bump = .6; p.turns = 0; p.spin = 0;
    game.combo = 0; game.comboTime = 0; game.ended = true;
    game.endReason = fisherHit ? 'fisher' : item.kind;
    events.push({ kind: 'hurt', x: p.x, y: p.y }, { kind: 'end' });
    return;
  }
  if (hit && (!contactDamage[item.kind] || (!item.hit && !p.hurt))) {
    if (contactDamage[item.kind]) {
      if (item.kind === 'gull') { item.reaction = 1.1; item.reactionKind = 'confused'; p.confused = 1.1; }
      if (fisherHit) { item.reaction = 1.2; item.reactionKind = 'angry'; }
      item.hit = true; p.hurt = ENERGY.protection; p.bump = .6;
      game.energy = Math.max(0, game.energy - contactDamage[item.kind]);
      game.combo = 0; game.comboTime = 0; p.turns = 0; p.spin = 0;
      events.push({ kind: 'hurt', x: p.x, y: p.y });
      if (game.energy > 0) return;
    }
    game.ended = true;
    game.endReason = contactDamage[item.kind] ? 'energy' : item.kind;
    events.push(...(contactDamage[item.kind] ? [] : [{ kind: 'hurt', x: p.x, y: p.y }]), { kind: 'end' });
    return;
  }
}

function advanceWorld(game, dt, events) {
  const p = game.player;
  let inCurrent = false;
  if (game.distance >= game.nextEncounter) encounter(game);
  const beak = beakPosition(p);
  for (const item of game.items) {
    item.x -= game.speed * dt;
    if (TERRAIN.includes(item.kind) && !item.warned && item.x < Math.max(760, p.x + 90 + game.speed * 3)) {
      item.warned = true; events.push({ kind: item.kind === 'island' ? 'islandWarning' : 'reefWarning' });
    }
    if (item.kind === 'nest') {
      item.celebration = Math.max(0, item.celebration - dt);
      if (!item.served && !p.wet && (item.final || game.cargo > 0) && Math.abs(item.x - p.x) < 65) {
        item.served = true; item.celebration = 3; game.feeding = 1.8; game.feedingTotal = game.cargo;
        p.y = 285; p.vy = 0; p.spin = 0; p.turns = 0; p.feedX = item.x - 55;
        return events;
      }
      continue;
    }
    if (item.kind === 'baitball') {
      const near = Math.hypot(item.x - p.x, item.y - p.y) < 120;
      item.scatter = clamp(item.scatter + (near ? dt * 2.5 : -dt * .6), 0, 1);
      sardinePositions(item, game.time).forEach((sardine, i) => {
        if (sardine.eaten || Math.hypot(sardine.x - beak.x, sardine.y - beak.y) > 26) return;
        item.eaten[i] = true; item.left--;
        game.score += 5; game.energy = Math.min(100, game.energy + 1); game.comboTime = Math.max(game.comboTime, 3); p.gulp = .3;
        events.push({ kind: 'sardine', x: sardine.x, y: sardine.y, points: 5 });
      });
      if (!item.left && !item.cleared) { item.cleared = true; item.caught = true; game.score += 100; events.push({ kind: 'feast', x: p.x, y: p.y, points: 100 }); }
      continue;
    }
    if (item.kind === 'current') {
      const span = currentSpan(item);
      if (p.wet && p.x > span.left && p.x < span.right && p.y > span.top && p.y < span.bottom) {
        inCurrent = true;
        if (!item.entered) { item.entered = true; events.push({ kind: 'current', x: p.x, y: p.y }); }
      }
      if (span.right < -40) item.caught = true;
      continue;
    }
    if (item.kind === 'turtle') {
      item.x -= (18 + Math.min(15, game.time * .1)) * dt;
      const turtleSafe = terrainSafeY(game.items, item.x, item.baseY, 42);
      item.baseY = item.x > 520 ? turtleSafe : item.baseY + clamp(turtleSafe - item.baseY, -200 * dt, 200 * dt);
      item.y = item.baseY + Math.sin(game.time * 1.8) * 10;
      item.reaction = Math.max(0, (item.reaction || 0) - dt);
      if (!item.touched && Math.hypot((item.x - p.x) / 1.6, item.y - p.y) < 36) {
        item.touched = true; item.reaction = .8; p.bump = .6;
      }
      continue;
    }
    if (item.kind === 'puffer') {
      if (item.phase === 'idle' && item.x < 470) { item.phase = 'startle'; item.timer = .55; }
      else if (item.phase !== 'idle' && item.phase !== 'rest') {
        item.timer -= dt;
        if (item.timer <= 0) {
          const next = { startle: ['inflate', .45], inflate: ['puffed', 1.25], puffed: ['deflate', .7], deflate: ['rest', 0] }[item.phase];
          [item.phase, item.timer] = next;
        }
      }
    }
    if (item.kind === 'shark') {
      updateShark(game, item, dt, events);
      if (item.x < p.x - 90) { item.caught = true; continue; }
    }
    if (item.kind === 'diver') {
      updateDiver(game, item, dt, events);
    }
    if (item.kind === 'harpoon') {
      item.x += item.vx * dt; item.y += item.vy * dt; item.life -= dt;
      if (item.life <= 0 || item.y < WORLD.water + 18 || item.y > 760) { item.caught = true; continue; }
      const wood = game.items.find(other => other.kind === 'driftwood' && Math.abs(other.x - item.x) < 55 && Math.abs(other.y - item.y) < 25);
      if (wood) { item.caught = true; events.push({ kind: 'netSplash', x: item.x, y: item.y }); continue; }
      if (item.x < p.x - 35 && !item.rewarded && !item.hit) { item.rewarded = true; game.score += 25; events.push({ kind: 'outsmart', points: 25, x: p.x, y: p.y }); }
    }
    if (item.kind === 'surfer') {
      item.reaction = Math.max(0, (item.reaction || 0) - dt);
      if (!item.passed && item.x < p.x - 70) { item.passed = true; item.reaction = 1; }
      if (!item.warned && item.x < 480) { item.warned = true; events.push({ kind: 'warning', x: item.x, y: WORLD.water - 100 }); }
      // With low air the surfer turns away before entering Pip's ascent corridor.
      if (p.wet && p.breath < 3 && item.x > p.x - 85) item.escaping = true;
      if (item.escaping) { item.x += (game.speed + 220) * dt; if (item.x > 600) item.caught = true; }
      else item.x -= 15 * dt;
    }
    if (item.kind === 'gull') {
      item.reaction = Math.max(0, (item.reaction || 0) - dt);
      if (item.kicked) {
        item.x += (game.speed + 320) * dt; item.y -= 110 * dt;
        if (item.x > 650 || item.y < 100) item.caught = true;
        continue;
      }
      if (!item.warned && item.x < 480) { item.warned = true; events.push({ kind: 'warning', x: item.x, y: item.y - 40 }); }
      item.x -= 20 * dt; item.y = 285 + Math.sin(game.time * 2) * 18;
    }
    if (item.kind === 'jelly') item.phase = (Math.sin(game.time * 2) + 1) / 2;
    if (item.kind === 'whirlpool') {
      if (p.wet && Math.hypot(item.x - p.x, item.y - p.y) < 115) p.y = Math.min(710, p.y + 65 * dt);
      continue;
    }
    if (item.kind === 'bubble') {
      if (Math.hypot(item.x - p.x, item.y - p.y) < 35) {
        item.caught = true; p.breath = Math.min(WORLD.breath, p.breath + 2);
        events.push({ kind: 'airBonus', x: item.x, y: item.y });
      }
      continue;
    }
    if (item.kind === 'boat') {
      updateBoat(game, item, dt, events);
    }
    if (item.kind === 'fish') {
      updateFish(game, item, dt, beak, events);
    } else {
      resolveHazard(game, item, events);
      if (game.ended) return events;
    }
  }
  game.boost = clamp(game.boost + (inCurrent ? dt * 3 : -dt * 1.6), 0, 1);
  if (p.turns && p.spin >= p.turns * Math.PI * 2 && game.energy > 0) {
    const points = p.turns === 2 ? 120 : 50;
    game.score += points; events.push({ kind: 'trick', x: p.x, y: p.y, points, turns: p.turns });
    p.turns = 0; p.spin = 0;
  }
  game.items = game.items.filter(item => !item.caught && (item.x > -180 || item.kind === 'current'));
  return events;
}
