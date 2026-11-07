import { STAGES } from './stages.js';
// Stage atmosphere, set-piece scenery and game-feel overlays. Everything here is
// presentation only: nothing in this file is used for collisions or scoring.
import { WORLD, clamp, sardinePositions, currentSpan } from './game.js';
import { blink, cuteEye, happyEye, manatee } from './cute.js';
const TAU = Math.PI * 2;
const SHOW_TIME = 13;


const wrap = (value, span) => (value % span + span) % span;
const hash = i => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
function fill(c, colour, draw) { c.beginPath(); draw(c); c.fillStyle = colour; c.fill(); }
function stroke(c, colour, width, draw) { c.beginPath(); draw(c); c.strokeStyle = colour; c.lineWidth = width; c.stroke(); }
function vertical(c, y1, y2, stops) {
  const g = c.createLinearGradient(0, y1, 0, y2);
  for (const [at, colour] of stops) g.addColorStop(at, colour);
  return g;
}

export function showState(game, reducedMotion) {
  if (reducedMotion || !game.show) return null;
  const age = game.time - game.show.start;
  if (age < 0 || age > SHOW_TIME) return null;
  return { name: game.show.name, age, envelope: clamp(Math.min(age / 1.5, (SHOW_TIME - age) / 2), 0, 1) };
}
// Passing ships and storms make the surface line heave; the collision water line is unchanged.
export function swellOf(game, stage, reducedMotion) {
  const show = showState(game, reducedMotion);
  return STAGES[stage].theme.swell + (show && show.name === 'trawler' ? show.envelope * 1.5 : 0);
}

// Scenery is painted first, tinted in place, and the sky is slipped in behind it.
export function drawSky(c, stage, water, d, motion, game, reducedMotion, drawScenery) {
  const th = STAGES[stage].theme;
  const show = game ? showState(game, reducedMotion) : null;
  drawScenery();
  if (show?.name === 'trawler') trawler(c, water, show, motion);
  if (th.tint) { c.globalCompositeOperation = 'source-atop'; c.fillStyle = th.tint; c.fillRect(-30, -30, 540, water + 30); }
  c.globalCompositeOperation = 'source-over';
  c.globalCompositeOperation = 'destination-over';
  // Far shoreline: slowest layer.
  for (let layer = 0; layer < 2; layer++) {
    c.globalAlpha = layer ? .55 : .85;
    fill(c, th.far, p => {
      const shift = d * (layer ? .012 : .028);
      p.moveTo(-30, water);
      for (let x = -30; x <= 520; x += 20) {
        const u = (x + shift) * (layer ? .006 : .011);
        p.lineTo(x, water - (layer ? 46 : 20) - Math.sin(u) * (layer ? 24 : 11) - Math.sin(u * 2.7 + 1) * (layer ? 10 : 6));
      }
      p.lineTo(520, water); p.closePath();
    });
  }
  c.globalAlpha = 1;
  if (STAGES[stage].id === 'harbor') {
    // Harbour cranes and masts.
    for (let i = 0; i < 4; i++) {
      const x = wrap(i * 190 - d * .045, 760) - 120;
      stroke(c, '#89aaa0', 4, p => { p.moveTo(x, water); p.lineTo(x, water - 96); p.moveTo(x - 14, water - 96); p.lineTo(x + 62, water - 78); p.moveTo(x, water - 110); p.lineTo(x + 30, water - 86); p.moveTo(x, water - 110); p.lineTo(x, water - 96); });
      stroke(c, '#89aaa099', 1.5, p => { p.moveTo(x + 58, water - 79); p.lineTo(x + 58, water - 40); });
    }
  }
  if (show?.name === 'rainbow') rainbow(c, water, show);
  // Sun, or moon and stars over the night reef.
  if (STAGES[stage].id === 'reef') {
    fill(c, '#f6f1d6', p => p.arc(392, 118, 25, 0, TAU));
    fill(c, '#f6f1d622', p => p.arc(392, 118, 44, 0, TAU));
    fill(c, '#f6f1d612', p => p.arc(392, 118, 70, 0, TAU));
    for (let i = 0; i < 46; i++) {
      const twinkle = reducedMotion ? .7 : .55 + Math.sin(motion * (1 + hash(i) * 2) + i) * .45;
      c.globalAlpha = clamp(twinkle, .1, 1) * (1 - hash(i + 9) * .5);
      fill(c, '#fff8e0', p => p.arc(hash(i + 1) * 480, hash(i + 2) * (water - 110), hash(i + 3) > .8 ? 1.6 : 1, 0, TAU));
    }
    c.globalAlpha = 1;
  } else if (STAGES[stage].id === 'lagoon') {
    // A low evening sun.
    fill(c, '#ffc98a', p => p.arc(370, water - 58, 34, 0, TAU));
    fill(c, '#ffd9a066', p => p.arc(370, water - 58, 52, 0, TAU));
    fill(c, '#ffcf9a30', p => p.arc(370, water - 58, 80, 0, TAU));
  } else {
    fill(c, '#ffe7a6', p => p.arc(397, water - 140, 29, 0, TAU));
    fill(c, '#fff4c777', p => p.arc(397, water - 140, 43, 0, TAU));
    fill(c, '#fff0bd35', p => p.arc(397, water - 140, 61, 0, TAU));
  }
  c.fillStyle = vertical(c, water - 150, water, [[0, th.glow.slice(0, 7) + '00'], [1, th.glow]]); c.fillRect(-30, water - 150, 540, 150);
  c.fillStyle = vertical(c, 0, water, th.sky); c.fillRect(-30, -30, 540, water + 30);
  c.globalCompositeOperation = 'source-over';
  if (show?.name === 'goldenHour') goldenHour(c, water, show, motion);
  if (show?.name === 'shootingStars') shootingStars(c, water, show);
}

function rainbow(c, water, show) {
  const colours = ['#f08a7c', '#f6b877', '#f7e08e', '#a5d6a0', '#8ec7dc', '#a99fd6'];
  colours.forEach((colour, i) => {
    c.globalAlpha = .5 * show.envelope;
    c.beginPath(); c.arc(150, water + 40, 250 - i * 7, Math.PI, TAU); c.strokeStyle = colour; c.lineWidth = 7.5; c.stroke();
  });
  c.globalAlpha = 1;
}
function trawler(c, water, show, motion) {
  const x = 640 - show.age * 78, y = water - 4 + Math.sin(motion * 1.1) * 2;
  c.save(); c.translate(x, y);
  fill(c, '#6d7f86', p => { p.moveTo(-150, -34); p.lineTo(150, -34); p.lineTo(128, 6); p.lineTo(-118, 6); p.closePath(); });
  fill(c, '#8f4f4a', p => { p.moveTo(-143, -16); p.lineTo(141, -16); p.lineTo(128, 6); p.lineTo(-118, 6); p.closePath(); });
  fill(c, '#d9d2bb', p => p.rect(-40, -74, 92, 40)); fill(c, '#c0b8a0', p => p.rect(-22, -96, 50, 24));
  fill(c, '#5d6a70', p => p.rect(12, -124, 15, 30));
  for (let i = 0; i < 4; i++) fill(c, '#f8dc94', p => p.rect(-30 + i * 20, -64, 11, 11));
  stroke(c, '#59676d', 3, p => { p.moveTo(-96, -34); p.lineTo(-96, -118); p.moveTo(-96, -114); p.lineTo(-150, -58); p.moveTo(-96, -114); p.lineTo(-44, -74); });
  for (let i = 0; i < 5; i++) { const rise = (motion * .5 + i * .2) % 1; c.globalAlpha = (1 - rise) * .5; fill(c, '#e9e3d6', p => p.arc(20 + rise * 70, -130 - rise * 60, 8 + rise * 16, 0, TAU)); }
  c.globalAlpha = 1;
  fill(c, '#f3faeaaa', p => p.ellipse(140, 6, 46, 6, 0, 0, TAU)); fill(c, '#f3faea77', p => p.ellipse(-20, 8, 150, 5, 0, 0, TAU));
  c.restore();
}
function goldenHour(c, water, show, motion) {
  const e = show.envelope;
  c.fillStyle = `rgba(255,214,130,${.2 * e})`; c.fillRect(-30, -30, 540, water + 30);
  c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 5; i++) {
    c.globalAlpha = (.07 + Math.sin(motion * .8 + i) * .02) * e;
    fill(c, '#ffe9a8', p => { const x = 90 + i * 85; p.moveTo(x, -10); p.lineTo(x + 60, -10); p.lineTo(x + 170, water); p.lineTo(x + 40, water); p.closePath(); });
  }
  c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
  for (let i = 0; i < 40; i++) {
    const life = wrap(show.age * .5 + hash(i), 1), x = hash(i + 50) * 480, y = life * water;
    c.globalAlpha = Math.sin(life * Math.PI) * .8 * e;
    fill(c, '#fff4c0', p => p.arc(x + Math.sin(show.age + i) * 8, y, 1.4 + hash(i + 9) * 1.6, 0, TAU));
  }
  c.globalAlpha = 1;
}
function shootingStars(c, water, show) {
  for (const [at, x, y] of [[1.2, 420, 40], [3.6, 300, 70], [5.9, 470, 110], [8.1, 360, 30], [9.4, 250, 90]]) {
    const u = (show.age - at) / .9;
    if (u < 0 || u > 1) continue;
    const hx = x - u * 220, hy = y + u * 120, fade = Math.sin(u * Math.PI);
    const g = c.createLinearGradient(hx, hy, hx + 90, hy - 49);
    g.addColorStop(0, `rgba(255,248,214,${fade})`); g.addColorStop(1, 'rgba(255,248,214,0)');
    stroke(c, g, 2.4, p => { p.moveTo(hx, hy); p.lineTo(hx + 90, hy - 49); });
    c.globalAlpha = fade; fill(c, '#fffbe8', p => p.arc(hx, hy, 2.8, 0, TAU)); c.globalAlpha = 1;
  }
}
// A dolphin drawn facing left (the way it travels): rostrum, rounded melon, dorsal fin and fluke.
function dolphin(c, t, seed) {
  const tail = Math.sin(t * 9 + seed) * .22;
  c.save(); c.translate(52, -2); c.rotate(tail);
  fill(c, '#5f8fb6', p => { p.moveTo(-6, 0); p.quadraticCurveTo(10, -4, 22, -18); p.quadraticCurveTo(18, -4, 26, -1); p.quadraticCurveTo(18, 3, 22, 16); p.quadraticCurveTo(10, 4, -6, 2); p.closePath(); });
  c.restore();
  fill(c, '#5f8fb6', p => { p.moveTo(-4, -18); p.quadraticCurveTo(4, -40, 20, -42); p.quadraticCurveTo(12, -30, 16, -14); p.closePath(); });
  const body = c.createLinearGradient(0, -22, 0, 18);
  body.addColorStop(0, '#7fb0d6'); body.addColorStop(.55, '#6a9cc4'); body.addColorStop(1, '#5f8fb6');
  fill(c, body, p => {
    p.moveTo(-66, 3); p.quadraticCurveTo(-64, -2, -52, -4);
    p.bezierCurveTo(-50, -20, -30, -24, -8, -21);
    p.bezierCurveTo(22, -17, 44, -8, 58, -3);
    p.lineTo(58, 2);
    p.bezierCurveTo(40, 10, 10, 19, -18, 18);
    p.bezierCurveTo(-38, 17, -50, 11, -56, 7);
    p.quadraticCurveTo(-64, 7, -66, 3); p.closePath();
  });
  fill(c, '#eef5f7', p => { p.moveTo(-60, 6); p.bezierCurveTo(-46, 12, -26, 17, -4, 15); p.bezierCurveTo(16, 13, 34, 8, 46, 3); p.bezierCurveTo(28, 14, 2, 20, -20, 19); p.bezierCurveTo(-40, 18, -54, 12, -60, 6); });
  fill(c, '#5a88ad', p => { p.moveTo(-22, 10); p.quadraticCurveTo(-18, 26, -4, 30); p.quadraticCurveTo(-8, 18, -8, 10); p.closePath(); });
  fill(c, '#ffffff55', p => p.ellipse(-24, -15, 14, 3.2, -.12, 0, TAU));
  stroke(c, '#3f6a8c', 1.4, p => { p.moveTo(-64, 4); p.quadraticCurveTo(-58, 7, -50, 5); });
  cuteEye(c, -38, -6, 4.8, blink(t, seed), '#1d3b52');
  fill(c, '#ff9fae77', p => p.ellipse(-33, 3, 4.2, 2.4, 0, 0, TAU));
}
// A mother dolphin and her calf leap along the sea and show where the bonus fish swim.
export function drawDolphins(c, game, water, motion, reducedMotion) {
  const show = showState(game, reducedMotion);
  if (show?.name !== 'dolphins') return;
  for (let k = 0; k < 2; k++) {
    const u = wrap(show.age * .5 - k * .16, 1.7) / 1.7;
    if (u > 1) continue;
    const height = k ? 66 : 92, size = k ? .58 : .9;
    const x = 640 - u * 600 - k * 30, lift = Math.sin(u * Math.PI), y = water + 22 - lift * height;
    // Face the direction of travel: the curve's slope tilts the nose up, then down.
    const angle = Math.atan2(-Math.cos(u * Math.PI) * height * Math.PI, -600) - Math.PI;
    c.save(); c.translate(x, y); c.rotate(angle); c.scale(size, size); dolphin(c, motion, k * 3); c.restore();
    if (lift < .3) for (let i = 0; i < 6; i++) {
      const spray = 1 - lift / .3;
      c.globalAlpha = spray * .85; fill(c, '#ffffff', p => p.arc(x + (i - 2.5) * 9 * size, water - 3 - hash(i + k * 7) * 18 * spray, 2.4 * size + 1, 0, TAU));
    }
    c.globalAlpha = 1;
  }
}

export function drawWater(c, stage, water, d, motion, game, reducedMotion) {
  const th = STAGES[stage].theme;
  c.fillStyle = vertical(c, water, 850, [[0, th.water[0]], [1, th.water[1]]]); c.fillRect(-30, water, 540, 880 - water);
  c.fillStyle = vertical(c, water, water + 110, [[0, th.surface], [1, th.surface.slice(0, 7) + '00']]); c.fillRect(-30, water, 540, 110);
  // Moon path just below the surface.
  if (STAGES[stage].id === 'reef') {
    for (let k = 0; k < 9; k++) {
      const width = 26 - k * 2.4 + Math.sin(motion * 2.6 + k * 1.7) * 7;
      c.globalAlpha = (.5 - k * .05) * .7;
      fill(c, '#eef3ff', p => p.ellipse(392 + Math.sin(motion * 1.3 + k) * 5, water + 9 + k * 9, Math.max(3, width), 2.2, 0, 0, TAU));
    }
    c.globalAlpha = 1;
  }
  // Light shafts sway slowly and fade with depth.
  for (let i = 0; i < 6; i++) {
    const x = i * 108 - 150 + Math.sin(motion * .15 + i * .7) * 22, wide = 38 + (i % 3) * 16;
    const g = c.createLinearGradient(0, water, 0, 820);
    const alpha = th.rayAlpha * (.7 + (reducedMotion ? .15 : Math.sin(motion * .6 + i * 2.1) * .3));
    g.addColorStop(0, th.rays + Math.round(clamp(alpha, 0, 1) * 255).toString(16).padStart(2, '0')); g.addColorStop(1, th.rays + '00');
    fill(c, g, p => { p.moveTo(x, water); p.lineTo(x + wide, water); p.lineTo(x + wide + 150, 850); p.lineTo(x + 70, 850); p.closePath(); });
  }
  // Distant underwater rocks, slower than the play layer.
  c.globalAlpha = .5;
  fill(c, th.rocks, p => {
    p.moveTo(-30, 850);
    for (let x = -30; x <= 520; x += 16) { const u = (x + d * .1) * .013; p.lineTo(x, 770 - Math.abs(Math.sin(u)) * 62 - Math.sin(u * 3.1) * 14); }
    p.lineTo(520, 850); p.closePath();
  });
  c.globalAlpha = 1;
  if (STAGES[stage].id === 'harbor') {
    // Pier posts fade with depth.
    for (let i = 0; i < 5; i++) {
      const x = wrap(i * 173 - d * .16, 760) - 120;
      c.fillStyle = vertical(c, water, water + 300, [[0, '#3d5f5244'], [1, '#3d5f5200']]); c.fillRect(x, water, 11, 300);
    }
  }
  for (let i = 0; i < 30; i++) {
    const x = wrap(i * 83.73 - d * .27, 520) - 20, y = water + 25 + (i * 41.4) % (820 - water);
    fill(c, th.mote, p => p.arc(x, y + Math.sin(motion + i) * 4, i % 3 === 0 ? 2 : 1, 0, TAU));
  }
  if (STAGES[stage].id === 'reef') plankton(c, water, d, motion, game, reducedMotion);
  if (STAGES[stage].id === 'lagoon') {
    // Sun path on the calm lagoon.
    for (let k = 0; k < 7; k++) {
      c.globalAlpha = .35 - k * .04;
      fill(c, '#ffe2b0', p => p.ellipse(370 + Math.sin(motion * 1.3 + k) * 5, water + 8 + k * 9, Math.max(3, 24 - k * 2.6 + Math.sin(motion * 2.6 + k * 1.7) * 6), 2.2, 0, 0, TAU));
    }
    c.globalAlpha = 1;
  }
}
// Bioluminescence: dim everywhere, bright where Pip disturbs the water.
function plankton(c, water, d, motion, game, reducedMotion) {
  const p = game?.player;
  c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 54; i++) {
    const x = wrap(hash(i) * 560 - d * (.32 + hash(i + 5) * .2), 560) - 40;
    const y = water + 34 + hash(i + 1) * (790 - water) + (reducedMotion ? 0 : Math.sin(motion * .8 + i) * 6);
    const near = p && p.wet ? clamp(1 - Math.hypot(x - p.x, y - p.y) / 150, 0, 1) : 0;
    const pulse = reducedMotion ? .5 : .5 + Math.sin(motion * (1.3 + hash(i + 2)) + i * 3) * .5;
    const glow = .1 + pulse * .16 + near * .7, size = 1.3 + hash(i + 3) * 1.6 + near * 2.5;
    c.globalAlpha = clamp(glow, 0, 1);
    fill(c, i % 4 ? '#5ff0e0' : '#9db8ff', q => q.arc(x, y, size, 0, TAU));
    c.globalAlpha = clamp(glow * .28, 0, 1);
    fill(c, '#5ff0e0', q => q.arc(x, y, size * 3.4, 0, TAU));
  }
  c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
}
// Bay seabed light net, drawn over the sand.
export function drawCaustics(c, stage, d, motion, reducedMotion) {
  if (STAGES[stage].id !== 'bay') return;
  c.globalCompositeOperation = 'lighter';
  for (let row = 0; row < 3; row++) {
    stroke(c, `rgba(255,250,200,${.13 - row * .03})`, 2.2 - row * .5, p => {
      for (let x = -20; x <= 500; x += 10) {
        const u = (x + d * .27) * .045 + row * 1.9, wobble = reducedMotion ? 0 : motion * (1.1 + row * .3);
        const y = 806 + row * 13 + Math.sin(u + wobble) * 6 + Math.sin(u * 2.3 - wobble * .7) * 3;
        if (x === -20) p.moveTo(x, y); else p.lineTo(x, y);
      }
    });
  }
  c.globalCompositeOperation = 'source-over';
}
// Special moments: a small wonder that crosses the screen once per run.
const RARE_TIME = 15;
export function drawRare(c, game, water, motion, reducedMotion) {
  if (!game.rareShow || reducedMotion) return;
  const age = game.time - game.rareShow.start;
  if (age < 0 || age > RARE_TIME) return;
  const name = game.rareShow.name;
  if (name === 'hatchlings') for (let i = 0; i < 5; i++) hatchling(c, 560 - age * 46 + i * 34, water + 22 + Math.sin(motion * 2 + i) * 3 + (i % 2) * 6, motion + i * .4, i);
  if (name === 'otters') { const ox = 580 - age * 42; c.save(); c.translate(ox, water); c.scale(1.5, 1.5); c.translate(-ox, -water); otters(c, ox, water, motion); c.restore(); }
  if (name === 'manateeCalf') {
    const x = 620 - age * 44;
    manatee(c, x, 640, motion, 1, 1.05);
    manatee(c, x + 34 + Math.sin(motion * .9) * 6, 668, motion + .7, 2, .55);
    if (Math.sin(motion * 1.7) > .3) fill(c, '#ff9fb0aa', p => { const hx = x + 52, hy = 640 - 26 - wrap(motion * 14, 20); p.moveTo(hx, hy + 3); p.bezierCurveTo(hx - 5, hy - 1, hx - 2, hy - 5, hx, hy - 2); p.bezierCurveTo(hx + 2, hy - 5, hx + 5, hy - 1, hx, hy + 3); });
  }
  if (name === 'manta') manta(c, 640 - age * 52, 560 + Math.sin(age * .8) * 30, motion);
}
function hatchling(c, x, y, t, seed) {
  const paddle = Math.sin(t * 9) * .6;
  c.save(); c.translate(x, y); c.scale(1.3, 1.3);
  for (const [fx, side] of [[-5, 1], [5, -1]]) { c.save(); c.translate(fx, 3); c.rotate(side * paddle); fill(c, '#5f8f6a', p => p.ellipse(side * -3, 4, 3, 7, side * .5, 0, TAU)); c.restore(); }
  fill(c, '#7aa57a', p => p.ellipse(-11, -1, 5, 4.5, 0, 0, TAU));
  fill(c, '#5a7a52', p => p.ellipse(0, 0, 10, 7, 0, 0, TAU));
  fill(c, '#86a86a', p => p.ellipse(-1, -1.5, 7, 4.5, 0, 0, TAU));
  cuteEye(c, -12.5, -2, 1.9, blink(t, seed), '#1d2b20');
  c.restore();
}
function otters(c, x, water, t) {
  const bob = Math.sin(t * 1.6) * 2;
  for (const [dx, phase, shell] of [[0, 0, true], [46, 1.4, false]]) {
    const ox = x + dx, oy = water - 2 + bob + Math.sin(t * 1.6 + phase) * 1.5;
    c.save(); c.translate(ox, oy);
    fill(c, '#7a5638', p => { p.moveTo(14, -2); p.quadraticCurveTo(26, -10, 30, -4); p.quadraticCurveTo(24, 0, 14, 2); p.closePath(); });
    fill(c, '#8b6444', p => p.ellipse(0, 0, 18, 8, 0, 0, TAU));
    fill(c, '#b08b66', p => p.ellipse(-2, -3, 12, 4, 0, 0, TAU));
    fill(c, '#8b6444', p => p.ellipse(-19, -5, 9, 8, 0, 0, TAU));
    fill(c, '#f1e2c8', p => p.ellipse(-21, -4, 6.5, 5.5, 0, 0, TAU));
    fill(c, '#8b6444', p => p.arc(-14, -12, 2.6, 0, TAU));
    fill(c, '#3a2a20', p => p.ellipse(-26, -5, 1.8, 1.3, 0, 0, TAU));
    happyEye(c, -21, -7, 1.8, '#3a2a20');
    fill(c, '#ff9aa266', p => p.ellipse(-19, -2, 2, 1.2, 0, 0, TAU));
    if (shell) { fill(c, '#f5c6b6', p => p.ellipse(-4, -7, 5, 3.5, 0, 0, TAU)); stroke(c, '#d99a8a', .8, p => { p.moveTo(-8, -7); p.lineTo(0, -7); p.moveTo(-4, -10); p.lineTo(-4, -4); }); }
    c.restore();
  }
  // Holding paws, so they never drift apart.
  stroke(c, '#7a5638', 3, p => { p.moveTo(x + 6, water - 8 + bob); p.quadraticCurveTo(x + 18, water - 16 + bob, x + 30, water - 10 + bob); });
  fill(c, '#7a5638', p => p.arc(x + 18, water - 14 + bob, 3, 0, TAU));
}
// Seen from above, a manta glides head first with its wings flapping slowly.
function manta(c, x, y, t) {
  const flap = Math.sin(t * 1.6), reach = 66 + flap * 10, sweep = flap * 10;
  c.save(); c.translate(x, y);
  c.globalCompositeOperation = 'lighter';
  const glow = c.createRadialGradient(0, 0, 10, 0, 0, 100); glow.addColorStop(0, '#9fd8ff26'); glow.addColorStop(1, '#9fd8ff00');
  fill(c, glow, p => p.arc(0, 0, 100, 0, TAU)); c.globalCompositeOperation = 'source-over';
  stroke(c, '#2c4f78', 2.2, p => { p.moveTo(30, 0); p.quadraticCurveTo(60, Math.sin(t * 3) * 5, 88, 2); });
  const wing = side => p => { p.moveTo(-30, 0); p.bezierCurveTo(-28, side * 30, -6 + sweep, side * reach, 6 + sweep, side * reach); p.bezierCurveTo(14 + sweep, side * reach * .7, 22, side * 22, 34, 0); p.closePath(); };
  for (const side of [-1, 1]) fill(c, '#2f5a88', wing(side));
  for (const side of [-1, 1]) fill(c, '#3f6f9e88', p => p.ellipse(-2 + sweep * .4, side * reach * .45, 10, 18, side * .3, 0, TAU));
  fill(c, '#3d6a98', p => p.ellipse(0, 0, 30, 13, 0, 0, TAU));
  for (const side of [-1, 1]) fill(c, '#3d6a98', p => p.ellipse(-33, side * 8, 7, 3, side * .45, 0, TAU));
  fill(c, '#a8cae866', p => p.ellipse(-4, -3, 16, 4, 0, 0, TAU));
  for (const side of [-1, 1]) cuteEye(c, -24, side * 10, 2.8, blink(t, side + 5), '#0e1f33');
  c.restore();
}
export function drawWhale(c, game, motion, reducedMotion) {
  const show = showState(game, reducedMotion);
  if (show?.name !== 'whale') return;
  const x = 760 - show.age * 92, y = 590 + Math.sin(show.age * .7) * 16, tail = Math.sin(show.age * 1.6) * .18;
  c.save(); c.translate(x, y); c.globalAlpha = .62;
  fill(c, '#16385a', p => { p.moveTo(-190, 6); p.bezierCurveTo(-170, -62, -20, -78, 110, -40); p.bezierCurveTo(160, -26, 200, -8, 236, -2); p.bezierCurveTo(190, 20, 120, 52, 0, 58); p.bezierCurveTo(-90, 60, -170, 44, -190, 6); });
  c.save(); c.translate(232, -2); c.rotate(tail);
  fill(c, '#16385a', p => { p.moveTo(-6, 0); p.quadraticCurveTo(40, -50, 78, -44); p.quadraticCurveTo(58, -12, 60, 0); p.quadraticCurveTo(58, 14, 80, 44); p.quadraticCurveTo(40, 50, -6, 0); });
  c.restore();
  fill(c, '#12304d', p => { p.moveTo(-40, 44); p.quadraticCurveTo(-10, 100, 48, 104); p.quadraticCurveTo(22, 70, 30, 46); p.closePath(); });
  for (let i = 0; i < 6; i++) stroke(c, '#2c5a80', 2, p => { p.moveTo(-176 + i * 6, 16 + i * 6); p.quadraticCurveTo(-110, 38 + i * 4, -30 + i * 8, 34 + i * 4); });
  fill(c, '#0b2137', p => p.arc(-146, -8, 4, 0, TAU));
  c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 14; i++) { c.globalAlpha = .25 + Math.sin(motion * 2 + i) * .15; fill(c, '#6ff0e4', p => p.arc(-160 + i * 26, -34 + Math.sin(i * 1.7) * 22, 2.4, 0, TAU)); }
  c.restore(); c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
  if (x > -200 && x < 560) for (let i = 0; i < 7; i++) {
    const rise = wrap(motion * .35 + i * .143, 1);
    stroke(c, `rgba(214,244,255,${(1 - rise) * .5})`, 1.2, p => p.arc(x - 150 + Math.sin(i * 5) * 12, y - 50 - rise * 150, 2 + (i % 3) * 1.5, 0, TAU));
  }
}

export function drawBaitball(c, item, motion, night) {
  const sardines = sardinePositions(item, motion);
  if (night) { c.globalCompositeOperation = 'lighter'; c.globalAlpha = .12; fill(c, '#7fe9ff', p => p.ellipse(item.x, item.y, 86 * (1 + item.scatter * .7), 58 * (1 + item.scatter * .7), 0, 0, TAU)); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; }
  sardines.forEach((s, i) => {
    if (s.eaten) return;
    const flip = s.heading < 0 ? -1 : 1, shimmer = .55 + Math.sin(motion * 9 + i * 1.3) * .45;
    c.save(); c.translate(s.x, s.y); c.scale(flip * 1.5, 1.5);
    fill(c, '#8fb6c4', p => { p.moveTo(7, 0); p.lineTo(13, -4.5); p.lineTo(13, 4.5); p.closePath(); });
    fill(c, '#bfdcec', p => p.ellipse(0, 0, 8.5, 3.6, 0, 0, TAU)); fill(c, '#5f8fb0', p => p.ellipse(0, -1.6, 7.5, 1.6, 0, 0, TAU));
    c.globalAlpha = shimmer; fill(c, '#ffffff', p => p.ellipse(-1, -1, 5, 1.2, 0, 0, TAU)); c.globalAlpha = 1;
    fill(c, '#2c4f57', p => p.arc(-5, -.5, 1, 0, TAU));
    c.restore();
  });
}
export function drawCurrent(c, item, motion, reducedMotion) {
  const span = currentSpan(item), left = Math.max(-20, span.left), right = Math.min(500, span.right);
  if (right <= left) return;
  const band = c.createLinearGradient(0, span.top, 0, span.bottom);
  band.addColorStop(0, '#d9fff400'); band.addColorStop(.5, '#d9fff466'); band.addColorStop(1, '#d9fff400');
  c.fillStyle = band; c.fillRect(left, span.top, right - left, span.bottom - span.top);
  c.save(); c.beginPath(); c.rect(left, span.top, right - left, span.bottom - span.top); c.clip();
  for (let i = 0; i < 16; i++) {
    const y = span.top + 8 + hash(i) * (span.bottom - span.top - 16);
    const x = span.left + wrap(hash(i + 4) * item.length - (reducedMotion ? 0 : motion * (240 + hash(i + 2) * 160)), item.length);
    stroke(c, `rgba(240,255,250,${.3 + hash(i + 7) * .4})`, 1.6, p => { p.moveTo(x, y); p.lineTo(x + 26 + hash(i + 1) * 34, y); });
  }
  for (let x = span.left + 40; x < span.right; x += 90) stroke(c, '#f4fff9cc', 3, p => { p.moveTo(x, item.y - 10); p.lineTo(x + 10, item.y); p.lineTo(x, item.y + 10); p.moveTo(x + 12, item.y - 10); p.lineTo(x + 22, item.y); p.lineTo(x + 12, item.y + 10); });
  c.restore();
}

// Particles, rings, flashes and the frenzy frame.
export function drawJuice(c, fx, game, water, motion, reducedMotion) {
  if (!fx) return;
  for (const ring of fx.rings || []) {
    const age = 1 - ring.life;
    for (let k = 0; k < 2; k++) {
      const radius = 12 + (age + k * .18) * 78 * ring.power;
      stroke(c, `rgba(244,252,236,${clamp(ring.life - k * .25, 0, 1) * .75})`, 2 - k * .8, p => p.ellipse(ring.x, water + 3, radius, radius * .15, 0, 0, TAU));
    }
  }
  for (const q of fx.particles || []) {
    const life = clamp(q.life / q.max, 0, 1);
    if (q.kind === 'bubble') stroke(c, `rgba(222,250,240,${life * .75})`, 1, p => p.arc(q.x, q.y, q.size, 0, TAU));
    else if (q.kind === 'heart') {
      const r = q.size * (1 + (1 - life) * .3); c.globalAlpha = Math.min(1, life * 2);
      fill(c, q.colour, p => { p.moveTo(q.x, q.y + r * .9); p.bezierCurveTo(q.x - r * 1.6, q.y - r * .2, q.x - r * .7, q.y - r * 1.4, q.x, q.y - r * .5); p.bezierCurveTo(q.x + r * .7, q.y - r * 1.4, q.x + r * 1.6, q.y - r * .2, q.x, q.y + r * .9); });
      fill(c, '#ffffffaa', p => p.ellipse(q.x - r * .5, q.y - r * .55, r * .25, r * .17, -.6, 0, TAU)); c.globalAlpha = 1;
    } else if (q.kind === 'star') {
      c.globalAlpha = Math.min(1, life * 2);
      fill(c, q.colour, p => { for (let i = 0; i < 10; i++) { const a = q.life * 5 + i * Math.PI / 5, rr = i % 2 ? q.size * .45 : q.size; i ? p.lineTo(q.x + Math.cos(a) * rr, q.y + Math.sin(a) * rr) : p.moveTo(q.x + Math.cos(a) * rr, q.y + Math.sin(a) * rr); } p.closePath(); });
      c.globalAlpha = 1;
    }
    else if (q.kind === 'spark') { c.globalAlpha = life; fill(c, q.colour || '#fff2b6', p => { p.moveTo(q.x, q.y - q.size * 2); p.lineTo(q.x + q.size * .6, q.y); p.lineTo(q.x, q.y + q.size * 2); p.lineTo(q.x - q.size * .6, q.y); p.closePath(); }); c.globalAlpha = 1; }
    else { c.globalAlpha = life * (q.kind === 'mist' ? .5 : .95); fill(c, '#f1fbe9', p => p.ellipse(q.x, q.y, q.size, q.size * (q.kind === 'mist' ? 1 : 1.7), Math.atan2(q.vy, q.vx) + Math.PI / 2, 0, TAU)); c.globalAlpha = 1; }
  }
  const p = game.player, rush = Math.max(fx.rush || 0, game.boost || 0);
  if (rush > .05 && !reducedMotion) {
    c.strokeStyle = `rgba(244,255,248,${.3 * rush})`; c.lineWidth = 1.5; c.beginPath();
    for (let i = 0; i < 18; i++) {
      const y = (game.frenzy > 0 ? 60 : water + 20) + hash(i) * (game.frenzy > 0 ? 760 : 800 - water), x = wrap(hash(i + 3) * 620 - motion * (700 + hash(i + 6) * 500), 620) - 70;
      c.moveTo(x, y); c.lineTo(x + 40 + hash(i + 8) * 70 * rush, y);
    }
    c.stroke();
  }
  if (game.frenzy > 0) {
    const pulse = reducedMotion ? .7 : .7 + Math.sin(motion * 9) * .3, edge = clamp(game.frenzy, 0, 1);
    for (const side of [0, 1]) {
      const g = c.createLinearGradient(side ? 480 : 0, 0, side ? 400 : 80, 0);
      g.addColorStop(0, `rgba(255,214,110,${.42 * pulse * edge})`); g.addColorStop(1, 'rgba(255,214,110,0)');
      c.fillStyle = g; c.fillRect(side ? 400 : 0, 0, 80, 850);
    }
  }
  if (fx.pulse > 0) stroke(c, `rgba(255,255,255,${fx.pulse})`, 3, q => q.arc(p.x, p.y - 6, 30 + (1 - fx.pulse) * 70, 0, TAU));
  if (fx.flash > 0) { c.fillStyle = fx.flashColour; c.globalAlpha = clamp(fx.flash, 0, 1); c.fillRect(-30, -30, 540, 910); c.globalAlpha = 1; }
}
export const WATERLINE = WORLD.water;
