import { STAGES } from './stages.js';
import { WORLD, clamp, netShape, playerTilt, terrainBlocks, airState, pufferRadius, LEAP } from './game.js';
import { blink, cuteEye, happyEye, star, drawResidents, roofCat } from './cute.js';
import { drawSky, drawWater, drawCaustics, drawWhale, drawDolphins, drawBaitball, drawCurrent, drawJuice, swellOf, drawRare } from './scenery.js';
const TAU = Math.PI * 2;
function ellipse(c, x, y, rx, ry, fill, rotation = 0) {
  c.beginPath(); c.ellipse(x, y, rx, ry, rotation, 0, TAU); c.fillStyle = fill; c.fill();
}
function path(c, fill, draw, stroke, width = 1) {
  c.beginPath(); draw(c); if (fill) { c.fillStyle = fill; c.fill(); }
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = width; c.stroke(); }
}
function gradient(c, y1, y2, a, b) {
  const g = c.createLinearGradient(0, y1, 0, y2); g.addColorStop(0, a); g.addColorStop(1, b); return g;
}
function cloud(c, x, y, size, opacity = .65) {
  c.save(); c.translate(x, y); c.scale(size, size); c.globalAlpha = opacity;
  path(c, '#d7c8a842', p => { p.moveTo(-55, 10); p.quadraticCurveTo(0, 25, 51, 11); p.quadraticCurveTo(0, 31, -55, 10); });
  path(c, '#fffaf0', p => { p.moveTo(-58, 8); p.bezierCurveTo(-68, -6, -45, -18, -31, -12); p.bezierCurveTo(-26, -42, 15, -38, 21, -17); p.bezierCurveTo(48, -27, 62, -5, 48, 10); p.quadraticCurveTo(0, 21, -58, 8); });
  ellipse(c, -12, -18, 20, 13, '#fffdf5aa', -.12); c.restore();
}
function palm(c, x, y, scale, t) {
  c.save(); c.translate(x, y); c.scale(scale, scale); c.rotate(Math.sin(t * .5) * .015);
  path(c, gradient(c, -100, 2, '#c4a476', '#897153'), p => { p.moveTo(-6, 2); p.quadraticCurveTo(10, -46, 0, -100); p.lineTo(5, -100); p.quadraticCurveTo(21, -47, 6, 2); p.closePath(); }, '#76654e', 1);
  for (let y = -16; y > -88; y -= 18) path(c, null, p => { p.moveTo(0, y); p.quadraticCurveTo(7, y + 4, 11, y + 1); }, '#dac29477', 1.2);
  for (let i = 0; i < 6; i++) {
    c.save(); c.translate(3, -98); c.rotate((i - 2.5) * .58);
    path(c, i % 2 ? '#6f9e73' : '#477c63', p => { p.moveTo(0, 0); p.quadraticCurveTo(38, -32, 65, 8); p.quadraticCurveTo(47, -1, 36, 3); p.quadraticCurveTo(23, -5, 0, 0); }, '#426b58', .7);
    path(c, null, p => { p.moveTo(4, -2); p.quadraticCurveTo(34, -15, 61, 6); }, '#b3bd7d88', .8); c.restore();
  }
  ellipse(c, 0, -92, 5, 6, '#a17c53'); ellipse(c, 9, -93, 5, 6, '#8e7952'); c.restore();
}
function island(c, x, water, t) {
  c.save(); c.translate(x, water);
  path(c, '#bdd0a9', p => { p.moveTo(-170, -8); p.quadraticCurveTo(-105, -80, -44, -82); p.quadraticCurveTo(-5, -83, 26, -62); p.quadraticCurveTo(62, -32, 120, -6); p.closePath(); }, '#739176', 1);
  path(c, '#f2dfb7', p => { p.moveTo(-170, 0); p.quadraticCurveTo(-88, -23, -4, -10); p.quadraticCurveTo(82, -12, 129, 2); p.quadraticCurveTo(46, 11, -31, 5); p.closePath(); }, '#d0b98d', 1);
  path(c, '#8bb79a', p => { p.moveTo(-130, -10); p.quadraticCurveTo(-65, -80, 10, -51); p.quadraticCurveTo(38, -37, 49, -15); p.closePath(); });
  // Small lighthouse, its rounded silhouette stays readable behind the player.
  path(c, '#fbf2d8', p => { p.moveTo(-57, -52); p.lineTo(-51, -118); p.lineTo(-32, -118); p.lineTo(-25, -52); p.closePath(); });
  path(c, '#e2a078', p => { p.moveTo(-54, -87); p.lineTo(-30, -87); p.lineTo(-29, -74); p.lineTo(-55, -74); p.closePath(); });
  c.fillStyle = '#527c76'; c.fillRect(-51, -129, 20, 12);
  path(c, '#cf8262', p => { p.moveTo(-57, -130); p.lineTo(-41, -142); p.lineTo(-25, -130); p.closePath(); });
  c.fillStyle = '#ffe5a1'; c.fillRect(-44, -126, 6, 8);
  palm(c, 28, -30, .55, t); c.restore();
}
export function fish(c, x, y, scale = 1, golden = false, t = 0, scared = 0, tilt = 0) {
  const swim = Math.sin(t * (tilt ? 16 : 7)) * .16;
  c.save(); c.translate(x, y); c.scale(scale, scale); c.rotate(Math.sin(t * 3) * .035 + tilt);
  const col = golden ? '#f6cd5f' : '#efa98e', edge = golden ? '#b9823e' : '#af6f66';
  c.save(); c.translate(10, 0); c.rotate(swim); c.translate(-10, 0);
  path(c, golden ? '#e6a94c' : '#d68172', p => { p.moveTo(9, 0); p.lineTo(28, -13); p.quadraticCurveTo(23, 0, 28, 13); p.closePath(); }, edge, 1); c.restore();
  ellipse(c, 0, 0, 18, 10.5, gradient(c, -10, 11, col, golden ? '#e9ae51' : '#d98b7d'));
  ellipse(c, -5, 3, 10, 5, golden ? '#ffe9a1' : '#ffd3b9');
  path(c, golden ? '#e3a448' : '#d47d70', p => { p.moveTo(-1, -8); p.lineTo(8, -16); p.lineTo(12, -5); p.closePath(); }, edge, .8);
  path(c, null, p => { p.moveTo(-2, -7); p.quadraticCurveTo(5, -2, 12, -1); }, '#fff0c477', 1.2);
  cuteEye(c, -9.5, -2.5, 4.2 + scared * 1.2, scared ? 1 : blink(t, y * .013), '#315653');
  ellipse(c, -6.5, 3.6, 3, 1.7, '#f3868a55');
  if (scared) ellipse(c, -14, 4, 1.6, 2.2 * scared, edge);
  else path(c, null, p => { p.moveTo(-15, 3); p.quadraticCurveTo(-12.5, 5.5, -10, 4); }, edge, 1);
  if (golden) { c.strokeStyle = '#fff0bd'; c.lineWidth = 1.7; c.beginPath(); c.moveTo(-4, -19); c.lineTo(-4, -27); c.moveTo(-8, -23); c.lineTo(0, -23); c.stroke(); }
  c.restore();
}
function pelicanWing(c, lift, fold, back) {
  c.save(); c.translate(back ? -14 : -10, back ? -5 : 0);
  if (back) c.scale(.88, .9);
  const elbow = -23 + fold * 6, tip = -57 + fold * 18;
  const ey = -lift * 24, ty = -lift * 57;
  path(c, back ? '#dce7d3' : gradient(c, -55, 55, '#fffbed', '#d1dfca'), p => {
    p.moveTo(2,-4); p.quadraticCurveTo(-9,-11,elbow,ey-7);
    p.quadraticCurveTo(tip+13,ty-7,tip,ty);
    p.quadraticCurveTo(tip-4,ty+5,tip+8,ty+7);
    p.quadraticCurveTo(tip-1,ty+13,tip+14,ty+13);
    p.quadraticCurveTo(tip+8,ty+20,tip+23,ty+17);
    p.quadraticCurveTo(elbow-2,ey+15,-7,10);p.quadraticCurveTo(3,7,2,-4);
  },back?'#a4b9a3':'#87957b',1.1);
  for(let i=0;i<3;i++) path(c,null,p=>{p.moveTo(elbow+8,ey+3+i*2);p.quadraticCurveTo(tip+25,ty+7+i*3,tip+9+i*6,ty+6+i*5)},'#b7cbb2',1);
  c.restore();
}
export function pelican(c, {
  x, y, scale, time: t, tilt = 0, outfit = 'classic', wet = false, happy = false,
  gulp = 0, breach = 0, cargo = 0, breath = WORLD.breath, reducedMotion = false, expression = {},
}) {
  const confused = expression.confused || 0;
  c.save(); c.translate(x, y); c.rotate(tilt + (reducedMotion ? 0 : Math.sin(confused * 18) * .28 * Math.min(1, confused))); c.scale(scale, scale);
  // Squash on splashdown, stretch along the flight path when moving fast.
  if (!reducedMotion) { const sq = expression.squash || 0, st = expression.stretch || 0; c.scale(1 + st + sq * .17, 1 - st * .7 - sq * .17); }
  const fullness = cargo / WORLD.capacity;
  const state = airState({ y, wet, breath }, cargo);
  const lowAir = state.level > 0, urgency = state.urgency;
  const relief = expression.relief || 0, bump = reducedMotion ? 0 : expression.bump || 0;
  const shake = reducedMotion ? 0 : Math.sin(relief * 25) * .07 * Math.min(1, relief);
  const yawn = reducedMotion ? 0 : expression.yawn || 0;
  const tired = Math.max(yawn * .8, happy || relief > 0 ? 0 : clamp((35 - (expression.energy ?? 100)) / 35, 0, 1));
  const hurt = (expression.hurt || 0) > 0;
  const headAngle = (lowAir ? -.12 - urgency * .22 : expression.nest ? -.16 : shake + tired * .2) + (expression.look || 0);
  const headPose = () => { c.translate(66, -27); c.rotate(headAngle); c.translate(-66, 27); };
  if (bump) c.transform(1, 0, Math.sin(bump * 22) * .07, 1, 0, 0);
  if (!reducedMotion && expression.shiver > 0) c.rotate(Math.sin(expression.shiver * 48) * .07 * Math.min(1, expression.shiver * 3));
  const wobble = reducedMotion ? 0 : Math.sin(t * 6) * fullness * 3 + Math.sin(gulp * 22) * gulp * 8;
  const bite = Math.max(yawn * 1.3, lowAir ? 0 : gulp > 0 ? Math.sin((1 - gulp / .42) * Math.PI) : relief > .8 ? .45 : expression.fish ? .18 : 0);
  // Shared, stable phase: brisk downstroke and slower, folded recovery.
  const cycle = (t * 1.3) % 1, down = cycle < .42;
  const progress = down ? cycle / .42 : (cycle - .42) / .58;
  const lift = Math.cos(progress * Math.PI) * (down ? 1 : -1) * (1 - tired * .3) - tired * .25;
  const fold = down ? 0 : Math.sin(progress * Math.PI);
  const flap = wet ? Math.sin(t * (7 + urgency * 8)) * (.15 + urgency * .35) : lift;
  const outline = '#786f5d';
  // A soft painted shadow and separated tail feathers keep Pip readable over sea and sky.
  ellipse(c, -5, 17, 47, 25, '#315e5a22', -.12);
  path(c, '#d8e3ce', p => { p.moveTo(-39, 7); p.lineTo(-68, -4); p.quadraticCurveTo(-62, 10, -39, 20); p.moveTo(-40, 11); p.lineTo(-65, 17); p.quadraticCurveTo(-53, 25, -31, 22); }, outline, 1.2);
  if (!wet) pelicanWing(c, lift, fold, true);
  c.save(); if (wet) { c.translate(-5, -8); c.rotate(-.3); }
  c.strokeStyle = '#d9955c'; c.lineWidth = 5; c.lineCap = 'round';
  for (let i = 0; i < 2; i++) {
    const kicking = expression.kick > 0 && i === 1, dx = kicking ? 42 : -24 + i * 19, dy = kicking ? 14 : 36 + flap * 2;
    c.beginPath(); c.moveTo(-17 + i * 17, 27); c.lineTo(dx, dy); c.stroke();
    path(c, '#e7a662', p => { p.moveTo(dx - 5, dy - 3); p.lineTo(dx + (kicking ? 15 : -12), dy + 4); p.lineTo(dx + (kicking ? 7 : -1), dy + 8); p.lineTo(dx + (kicking ? 17 : 7), dy + 12); p.lineTo(dx + 4, dy + 10); p.closePath(); }, '#c98550', .8);
  }
  c.restore();
  ellipse(c, -17, 7, 38, 30 + bite * 2, gradient(c, -20, 38, '#fffaf0', '#dce6d0'), -.16);
  c.save(); headPose();
  path(c, gradient(c, -57, 21, '#fffdf2', '#ecedd7'), p => { p.moveTo(1, 17); p.bezierCurveTo(-11, 3, -5, -15, -1, -39); p.bezierCurveTo(5, -69, 42, -65, 44, -40); p.bezierCurveTo(45, -25, 20, -15, 20, 4); p.quadraticCurveTo(17, 20, 1, 17); }, outline, 1.1);
  // Pip's tousled crown is his main character mark at every rendered scale.
  path(c, '#fffdf2', p => { p.moveTo(4, -56); p.quadraticCurveTo(-5, -70, 4, -73); p.quadraticCurveTo(10, -70, 12, -61); p.quadraticCurveTo(10, -77, 18, -75); p.quadraticCurveTo(25, -68, 21, -59); }, outline, 1);
  const pouch = p => { p.moveTo(37, -40); p.lineTo(91, -25); p.bezierCurveTo(72, -15 + bite * 11, 57, 7 + bite * 15 + fullness * 46 + wobble, 40, -7); p.quadraticCurveTo(31, -18, 37, -40); };
  path(c, gradient(c, -35, 8, '#f3c574', '#dc9758'), pouch, '#bd774b', 1.1);
  path(c, '#f8d79055', p => { p.moveTo(42, -31); p.quadraticCurveTo(63, -23, 82, -23); p.quadraticCurveTo(64, -14, 47, -9); p.quadraticCurveTo(39, -18, 42, -31); });
  // The catch wriggles inside the pouch; when it is nearly full a tail pokes out of the beak.
  c.save(); c.beginPath(); pouch(c); c.clip();
  if (fullness > .2) for (let i = 0; i < Math.ceil(fullness * 3); i++) {
    const fx = 50 + i * 9, fy = -11 + fullness * 12 + i * 3 + (reducedMotion ? 0 : Math.sin(t * 5 + i * 2) * 1.6), flick = reducedMotion ? 0 : Math.sin(t * 9 + i * 3) * 2;
    ellipse(c, fx, fy, 5.5, 2.6, '#b0684e77', -.25 + i * .15);
    path(c, '#b0684e77', p => { p.moveTo(fx + 4, fy); p.lineTo(fx + 9, fy - 3 + flick); p.lineTo(fx + 9, fy + 3 + flick); p.closePath(); });
  }
  c.restore();
  if (fullness > .75) {
    const flap = reducedMotion ? 0 : Math.sin(t * 8) * 3;
    path(c, '#d68172', p => { p.moveTo(76, -28); p.lineTo(82, -42 + flap); p.quadraticCurveTo(84, -35, 89, -38 + flap); p.lineTo(83, -27); p.closePath(); }, '#af6f66', .8);
  }
  c.save(); c.translate(35, -40); c.rotate(-bite * .22); c.translate(-35, 40);
  path(c, gradient(c, -44, -21, '#ffe19a', '#efb75f'), p => { p.moveTo(35, -43); p.quadraticCurveTo(67, -38, 94, -27); p.quadraticCurveTo(101, -22, 87, -22); p.lineTo(35, -30); p.closePath(); }, '#bd774b', 1);
  c.restore();
  path(c, null, p => { p.moveTo(38, -30); p.quadraticCurveTo(66, -26, 90, -25); }, '#b8764c', 1.3);
  if (lowAir) {
    ellipse(c, 25, -46, 4.8 + urgency, 5.8 + urgency, '#294b49'); ellipse(c, 25.5, -49.5, 1.5, 1.7, '#fffdf1');
    path(c, null, p => { p.moveTo(18, -54 - urgency * 2); p.lineTo(32, -51 + urgency); }, '#8f765f', 1.8);
    if (!reducedMotion) for (let i = 0; i < Math.ceil(urgency * 3); i++) { const rise = (t * (18 + urgency * 9) + i * 10) % 25; ellipse(c, 91 + i * 5, -27 - rise, 1.5 + i * .5, 1.5 + i * .5, '#e4f8e3aa'); }
  } else if (confused) {
    path(c, null, p => { p.moveTo(19, -50); p.lineTo(30, -41); p.moveTo(30, -50); p.lineTo(19, -41); }, '#31524f', 2.2);
  } else if (hurt) path(c, null, p => { p.moveTo(20, -49); p.lineTo(27, -45); p.lineTo(20, -42); }, '#31524f', 2.8);
  else if (tired > 0) {
    ellipse(c, 25, -45, 4.4, 5.4 - tired * 3.5, '#294b49');
    path(c, null, p => { p.moveTo(18, -48 + tired * 2); p.quadraticCurveTo(25, -51 + tired * 4, 32, -48 + tired * 2); }, '#8f765f', 2);
  } else if (expression.wink > 0 && !reducedMotion) {
    path(c, null, p => { p.moveTo(19, -45); p.quadraticCurveTo(26, -51, 32, -45); }, '#31524f', 2.8);
    star(c, 40, -60, 3 + expression.wink * 4, '#ffd66e', t * 4); ellipse(c, 21, -35, 7, 4, '#ff9fae77');
  } else if (happy || relief > 0) path(c, null, p => { p.moveTo(20, -43); p.quadraticCurveTo(26, -50, 32, -43); }, '#31524f', 2.8);
  else if (expression.sparkle > 0) { star(c, 25.5, -46, 7.5, '#f2b640', reducedMotion ? 0 : t * 3); star(c, 25.5, -46, 3.6, '#fff4c4', reducedMotion ? 0 : t * 3); }
  else { const gaze = expression.fish ? clamp((expression.fish.y - y) * .03, -2, 2) : 0; cuteEye(c, 25.5 + (expression.fish ? 1 : 0), -46 + gaze, 6.2, expression.fish || reducedMotion ? 1 : blink(t, .5)); }
  if (!lowAir) path(c, null, p => { p.moveTo(18, -53); p.quadraticCurveTo(25, -57, 32, -52); }, '#aa9271', 1.1);
  ellipse(c, 21, -35, 5.6, 3.3, '#e8aa94');
  // Dizzy little stars instead of a harsh red flash after a bump.
  if (hurt && !reducedMotion) for (let i = 0; i < 3; i++) { const a = t * 6 + i * TAU / 3; star(c, 20 + Math.cos(a) * 22, -72 + Math.sin(a) * 7, 4.5, i % 2 ? '#ffd66e' : '#fff0b0', a); }
  c.restore();
  if (wet) {
  c.save(); c.translate(-12, 5); c.scale(.8, .6);
  path(c, gradient(c, 0, 35, '#f3f5e4', '#ccdcca'), p => { p.moveTo(-35, -3); p.bezierCurveTo(-16, -7, 0, 7, -5, 22); p.quadraticCurveTo(-14, 32, -23, 26); p.quadraticCurveTo(-37, 25, -43, 12); p.quadraticCurveTo(-48, 3, -35, -3); }, outline, 1);
  for (let i = 0; i < 4; i++) path(c, null, p => { p.moveTo(-36 + i * 8, 10); p.quadraticCurveTo(-31 + i * 8, 19, -25 + i * 7, 21); }, i === 3 ? '#b4c9b7' : '#c1d3c0', 1.1);
  c.restore();
  } else pelicanWing(c, lift, fold, false);
  if (wet) {
    for (let i = 0; i < 3; i++) ellipse(c, -36 + i * 12, -4 + Math.sin(t * 5 + i) * 2, 1.4, 3, '#d8f2deaa', -.2);
  }
  c.save(); headPose();
  if (outfit === 'flower') {
    path(c, null, p => { p.moveTo(6, -59); p.quadraticCurveTo(1, -69, -5, -72); }, '#668b69', 2);
    for (let i = 0; i < 5; i++) ellipse(c, 7 + Math.cos(i / 5 * TAU) * 7, -61 + Math.sin(i / 5 * TAU) * 7, 5.5, 4.5, i % 2 ? '#e9a29e' : '#f0b3a5', i / 5 * TAU);
    ellipse(c, 7, -61, 4, 4, '#f6cf76'); ellipse(c, 5.8, -62.3, 1.2, 1.2, '#fff2b5');
  }
  if (outfit === 'sailor') {
    path(c, '#f8f5e7', p => { p.moveTo(1, -62); p.lineTo(-1, -74); p.quadraticCurveTo(21, -85, 35, -72); p.lineTo(32, -61); p.closePath(); }, outline, 1);
    path(c, '#477884', p => { p.moveTo(0, -67); p.quadraticCurveTo(17, -62, 34, -66); p.lineTo(33, -61); p.quadraticCurveTo(17, -58, 0, -63); p.closePath(); });
    ellipse(c, 20, -76, 2.3, 2.3, '#f1c56d');
  }
  c.restore(); c.restore();
}
function shark(c, item, t) {
  const hurry = item.phase === 'dash' ? 11 : item.phase === 'warn' ? 16 : 4;
  const tail = Math.sin(t * hurry) * (item.phase === 'dash' ? .3 : .16);
  c.save(); c.translate(item.x, item.y); c.rotate(Math.sin(t * (item.phase === 'warn' ? 16 : 1.5)) * .04);
  if (item.phase === 'warn') c.scale(.92, 1.15);
  if (item.reaction > 0) c.rotate(-.1 * item.reaction);
  c.save(); c.translate(43, 0); c.rotate(tail); c.translate(-43, 0);
  path(c, '#557f89', p => { p.moveTo(39, 0); p.lineTo(80, -30); p.quadraticCurveTo(72, -8, 67, 0); p.quadraticCurveTo(75, 10, 82, 27); p.closePath(); }, '#426974', 1.2); c.restore();
  path(c, '#638e98', p => { p.moveTo(-7, -18); p.quadraticCurveTo(6, -50, 21, -51); p.quadraticCurveTo(20, -30, 26, -14); p.closePath(); }, '#426974', 1.1);
  ellipse(c, 0, 0, 55, 26, gradient(c, -26, 25, '#83abb0', '#527d89'));
  path(c, '#bad0c8', p => { p.moveTo(-50, 8); p.quadraticCurveTo(-12, 28, 46, 12); p.quadraticCurveTo(14, 29, -24, 22); p.closePath(); });
  path(c, '#648d96', p => { p.moveTo(3, 8); p.lineTo(24, 34); p.quadraticCurveTo(20, 17, 25, 9); p.closePath(); }, '#426974', 1);
  cuteEye(c, -33, -4, 5.4, item.reaction > 0 ? 0 : blink(t, item.baseY * .01), '#294e55');
  path(c, null, p => { p.moveTo(-43, 8); p.quadraticCurveTo(-29, 18, -13, 7); }, '#3d6670', 2.1);
  ellipse(c, -38, 3, 5, 2.8, '#d89e9999');
  path(c, null, p => { p.moveTo(-40, -13); p.quadraticCurveTo(-32, -18, -23, -13); }, '#527783', 1.2);
  for (let i = 0; i < 3; i++) path(c, null, p => { p.moveTo(-7 + i * 5, -5); p.quadraticCurveTo(-11 + i * 5, 1, -7 + i * 5, 7); }, '#597e88', 1.4);
  c.restore();
}
function turtle(c, item, t) {
  c.save(); c.translate(item.x, item.y);
  const tuck = Math.min(1, (item.reaction || 0) * 3);
  const paddle = Math.sin(t * 3 + item.baseY) * .35 * (1 - tuck);
  ellipse(c, 24, -18, 22, 8, '#76aa8d', -.5 - paddle);
  ellipse(c, -14, -21, 24, 9, '#87b895', .6 + paddle);
  ellipse(c, 29, 18, 22, 8, '#72a68a', .5 + paddle);
  ellipse(c, 1, 2, 37, 27, '#cbd5a0');
  ellipse(c, 2, -3, 34, 25, gradient(c, -28, 24, '#a7c982', '#658e72'));
  path(c, '#8eb478', p => { p.moveTo(-11, -17); p.lineTo(9, -20); p.lineTo(21, -3); p.lineTo(9, 12); p.lineTo(-10, 9); p.lineTo(-19, -4); p.closePath(); }, '#d8dfa2', 1.8);
  for (const [x, y, ex, ey] of [[-11,-17,-18,-25],[9,-20,17,-25],[21,-3,35,-3],[9,12,17,20],[-10,9,-20,16],[-19,-4,-31,-7]]) path(c, null, p => { p.moveTo(x,y); p.lineTo(ex,ey); }, '#d3dfa6', 1.5);
  c.save(); c.translate(tuck * 16, 0);
  ellipse(c, -37, -3, 19, 15, gradient(c, -17, 14, '#acd0a5', '#7fac8d'), -.1);
  cuteEye(c, -43, -7, 5.6, tuck > .5 ? 0 : blink(t, item.baseY * .02 + 1), '#2b5050');
  ellipse(c, -44, 3, 5, 3, '#eab6a0');
  path(c, null, p => { p.moveTo(-54, 1); p.quadraticCurveTo(-50, 6, -46, 3); }, '#557e6d', 1.4);
  path(c, null, p => { p.moveTo(-51, -13); p.quadraticCurveTo(-43, -17, -35, -13); }, '#69947d', 1);
  c.restore();
  ellipse(c, -13, 21, 25, 10, '#93bd96', -.6 - paddle);
  c.restore();
}
function puffer(c, item, t) {
  const r = pufferRadius(item), inflated = item.phase === 'puffed';
  const startled = ['startle', 'inflate'].includes(item.phase);
  c.save(); c.translate(item.x, item.y);
  ellipse(c, r - 2, 2, 12, 7, '#d7a665', Math.sin(t * 6) * .2);
  ellipse(c, 0, 0, r - (inflated ? 5 : 0), r - (inflated ? 5 : 0), gradient(c, -r, r, '#f3d997', '#d4a566'));
  ellipse(c, -5, r * .27, r * .66, r * .48, '#fff0c4');
  if (inflated) for (let i = 0; i < 12; i++) {
    const a = i / 12 * TAU;
    path(c, '#c48f58', p => { p.moveTo(Math.cos(a - .09) * (r - 7), Math.sin(a - .09) * (r - 7)); p.lineTo(Math.cos(a) * r, Math.sin(a) * r); p.lineTo(Math.cos(a + .09) * (r - 7), Math.sin(a + .09) * (r - 7)); p.closePath(); });
  }
  for (const dx of [-10, 4]) {
    cuteEye(c, dx, -7, startled ? 7 : 5, item.phase === 'rest' ? 0 : startled ? 1 : blink(t, item.x * .001 + 2), '#4a6158');
  }
  ellipse(c, -18, 3, 5, 3, '#e7ab91');
  if (startled) ellipse(c, -5, 5, 3, 5, '#956e51');
  else path(c, null, p => { p.moveTo(-10, 5); p.quadraticCurveTo(-5, 10, 0, 5); }, '#956e51', 1.5);
  c.restore();
}

function boat(c, item, water, t, sleepy = false) {
  const [coat, shade, hull, hullShade] = [
    ['#efd08a','#dca956','#d48b64','#aa674e'],
    ['#a6c9bd','#6a9e94','#91b8cb','#567f99'],
    ['#e9aaa0','#c77f78','#b5c797','#7d956d'],
    ['#b9b4d5','#8d88b1','#e4b779','#b78a54'],
  ][item.look ?? 0];
  const age = item.cast, windup = clamp(age / .85, 0, 1), throwing = clamp((age - .85) / .6, 0, 1);
  const hauling = age >= 2.55, resting = age < 0 || age >= 3.25;
  const bob = Math.sin(t * 2) * 2;
  const angry = item.reaction > 0 && item.reactionKind === 'angry';
  const hand = item.reaction > 0 ? { x: (angry ? 70 : 16) + (angry ? Math.sin(t * 28) * 11 : 0), y: -78 } : resting ? { x: 17, y: -38 } : hauling ? { x: -10 + Math.sin(t * 12) * 7, y: -44 } : { x: 16 + windup * 19 - throwing * 65, y: -40 - windup * 45 + throwing * 36 };
  const net = netShape(item);
  if (age >= 0 && age < 1.45) {
    c.save(); c.setLineDash([5, 6]); c.strokeStyle = '#fff1b4'; c.lineWidth = 2;
    c.beginPath(); c.ellipse(item.x - 70, water + 5, 51, 8, 0, 0, TAU); c.stroke(); c.restore();
  }
  if (net) {
    // The same outline defines the collision: no invisible rectangle around the mesh.
    const outline = () => { c.beginPath(); net.points.forEach((p, i) => i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)); c.closePath(); };
    c.save(); outline(); c.fillStyle = '#e8b66a30'; c.fill(); c.clip();
    c.strokeStyle = '#ffe2a7bd'; c.lineWidth = 1.15;
    for (let i = -12; i < 22; i++) {
      const y = net.y + i * 16;
      path(c, null, p => { p.moveTo(net.x - net.width - 5, y); p.quadraticCurveTo(net.x, y + net.width * .55 + 10, net.x + net.width + 5, y + net.width * 1.2); }, '#ffe3adbb', 1.25);
      path(c, null, p => { p.moveTo(net.x + net.width + 5, y); p.quadraticCurveTo(net.x, y + net.width * .55 + 10, net.x - net.width - 5, y + net.width * 1.2); }, '#d7a365bb', 1.25);
    }
    c.restore(); outline(); c.strokeStyle = '#d29a56'; c.lineWidth = 2.5; c.stroke();
    net.points.forEach((p, i) => { if (i % 2 === 0) ellipse(c, p.x, p.y, 3, 4, '#a7835c'); });
    path(c, null, p => { p.moveTo(item.x + hand.x, water + hand.y + bob); p.quadraticCurveTo(item.x + 20, net.y - 16, net.x + net.width * .8, net.y); }, '#eacb92', 1.6);
    if (net.phase !== 'flight') {
      ellipse(c, net.x - net.width * .82, net.y, 5, 3.3, '#f2c883');
      ellipse(c, net.x + net.width * .82, net.y, 5, 3.3, '#f2c883');
      if (net.phase === 'haul') fish(c, net.x, net.y + net.depth * .45, .28, false, t);
    }
  }
  c.save(); c.translate(item.x, water + bob);
  c.rotate(Math.sin(t * 1.4) * .025 + (age >= 0 && age < 1.45 ? Math.sin(windup * Math.PI) * .055 - Math.sin(throwing * Math.PI) * .07 : 0));
  ellipse(c, 0, 24, 73, 7, '#28697120');
  // Bow, cabin-side planks and an open deck give the little boat depth.
  path(c, '#815445', p => { p.moveTo(-77, -17); p.quadraticCurveTo(0, -6, 77, -17); p.quadraticCurveTo(63, 24, 29, 28); p.lineTo(-30, 28); p.quadraticCurveTo(-63, 23, -77, -17); });
  path(c, gradient(c, -15, 26, hull, hullShade), p => { p.moveTo(-71, -9); p.quadraticCurveTo(0, 0, 71, -9); p.quadraticCurveTo(57, 21, 25, 23); p.lineTo(-26, 23); p.quadraticCurveTo(-55, 21, -71, -9); });
  for (const y of [3, 13]) path(c, null, p => { p.moveTo(-61 + y, y); p.quadraticCurveTo(0, y + 5, 61 - y, y); }, '#88574599', 1.2);
  for (const x of [-40, -8, 31]) { path(c, null, p => { p.moveTo(x, 1); p.lineTo(x + 3, 20); }, '#9b614ccc', 1); ellipse(c, x, 6, 1.1, 1.1, '#f7cba0'); }
  path(c, null, p => { p.moveTo(-75, -16); p.quadraticCurveTo(0, -4, 75, -16); }, '#f4c492', 5);
  // Bucket, a glimpse of the catch, and a coiled rope on deck.
  path(c, '#73948e', p => { p.moveTo(32, -35); p.lineTo(53, -35); p.lineTo(50, -12); p.lineTo(35, -12); p.closePath(); });
  ellipse(c, 42, -35, 11, 3.5, '#426e70');
  path(c, null, p => { p.moveTo(33, -31); p.quadraticCurveTo(42, -53, 52, -31); }, '#c5c9af', 1.5);
  fish(c, 43, -34, .35, false, t);
  for (let i = 0; i < 3; i++) { c.beginPath(); c.ellipse(59, -15 - i * 2, 10 - i, 3, 0, 0, TAU); c.strokeStyle = '#e3bf89'; c.lineWidth = 1.8; c.stroke(); }
  // A cream life ring with painted coral bands.
  ellipse(c, 30, 11, 13, 13, '#f8e9c6'); ellipse(c, 30, 11, 7, 7, '#a8644d');
  c.strokeStyle = '#dc8660'; c.lineWidth = 5;
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; c.beginPath(); c.arc(30, 11, 10, a - .2, a + .2); c.stroke(); }
  c.fillStyle = '#ffebc3'; c.font = "bold 7px 'Trebuchet MS'"; c.textAlign = 'center'; c.fillText('LÜTTE LOTTE', -24, 14);
  // Pip gets an expressive opponent: raincoat, rosy nose and a very serious moustache.
  c.save(); c.translate(-7, -17); c.rotate(hauling && !item.hit ? Math.sin(t * 12) * .06 : -windup * (1 - throwing) * .08);
  path(c, gradient(c, -45, 2, coat, shade), p => { p.moveTo(-22, 0); p.lineTo(-20, -32); p.quadraticCurveTo(-18, -48, -1, -47); p.quadraticCurveTo(19, -48, 23, -30); p.lineTo(25, 0); p.closePath(); }, shade, 1);
  path(c, null, p => { p.moveTo(1, -36); p.lineTo(3, -1); }, '#fff0bb', 1.5);
  for (let i = 0; i < 3; i++) ellipse(c, 5, -25 + i * 9, 1.5, 1.5, '#a87944');
  path(c, '#c66f5c', p => { p.moveTo(-11, -37); p.lineTo(1, -30); p.lineTo(12, -39); p.lineTo(3, -35); p.lineTo(5, -25); p.closePath(); }, '#99594d', .7);
  ellipse(c, -2, -55, 17, 20, '#edc3a0');
  ellipse(c, -15, -49, 6, 4, '#e7a58c'); ellipse(c, 11, -49, 4, 3, '#e7a58c');
  path(c, shade, p => { p.moveTo(-24, -64); p.lineTo(-17, -82); p.quadraticCurveTo(0, -89, 15, -79); p.lineTo(22, -63); p.closePath(); });
  path(c, '#8c7451', p => { p.moveTo(-20, -69); p.quadraticCurveTo(0, -62, 19, -68); p.lineTo(21, -63); p.quadraticCurveTo(-1, -56, -23, -63); p.closePath(); });
  path(c, null, p => { p.moveTo(-26, -63); p.quadraticCurveTo(-2, -57, 23, -63); }, coat, 6);
  const annoyed = age >= 0 || angry;
  path(c, null, p => { p.moveTo(-15, -57 - (annoyed ? 2 : 0)); p.lineTo(-8, -55); p.moveTo(0, -55); p.lineTo(7, -57 - (annoyed ? 2 : 0)); }, '#725c48', 2.3);
  const dozing = sleepy && age < 0 && !(item.reaction > 0);
  for (const ex of [-11, 3]) dozing ? happyEye(c, ex, -51, 2.6, '#3e514a') : cuteEye(c, ex, -52, 3.2, annoyed ? 1 : blink(t, item.x * .003 + ex), '#3e514a');
  ellipse(c, -5, -45, 6, 4.5, '#dfaa89');
  path(c, '#fff1d8', p => { p.moveTo(-5, -43); p.quadraticCurveTo(-16, -47, -22, -37); p.quadraticCurveTo(-13, -31, -5, -39); p.quadraticCurveTo(6, -31, 15, -39); p.quadraticCurveTo(4, -47, -5, -43); });
  ellipse(c, -4, -32, hauling ? 4 : 2, hauling ? 3 : 1, '#9b7157'); c.restore();
  path(c, null, p => { p.moveTo(8, -48); p.quadraticCurveTo(24, -40, hand.x, hand.y); }, shade, 9);
  ellipse(c, hand.x, hand.y, 5.5, 5, '#efc7a1');
  if (angry) for (let i = -1; i <= 1; i++) ellipse(c, hand.x + i * 4, hand.y - 4, 2.5, 3, '#efc7a1');
  path(c, null, p => { p.moveTo(-25, -43); p.quadraticCurveTo(-38, -26, -16, -24); }, coat, 8);
  ellipse(c, -16, -24, 5, 4, '#efc7a1');
  if (!net && !angry) {
    for (let i = 0; i < 4; i++) { c.beginPath(); c.ellipse(hand.x + 2, hand.y + 8 + i * 3, 10 + i, 4, -.2, 0, TAU); c.strokeStyle = '#dfc38f'; c.lineWidth = 1.5; c.stroke(); }
  }
  if (dozing) for (let i = 0; i < 3; i++) {
    const z = (t * .45 + i / 3) % 1;
    c.globalAlpha = Math.sin(z * Math.PI); c.fillStyle = '#5f7a8c'; c.font = `bold ${7 + z * 7}px sans-serif`; c.fillText('z', 14 + z * 16 + Math.sin(z * 6) * 3, -90 - z * 30);
  }
  c.globalAlpha = 1;
  c.restore();
}
// A mangrove tree: leafy crown above, a tangle of arching stilt roots down to the dive gap.
// Everything stays inside its terrain block except a few forgiving leaves.
function mangrove(c, item, water, t, night) {
  const x = item.x, b = terrainBlocks(item)[0], bottom = b.y + b.height;
  // Roots fade into the water with depth, so the gap below reads as open.
  const root = c.createLinearGradient(0, water, 0, bottom);
  root.addColorStop(0, night ? '#4e4a44' : '#7a6450'); root.addColorStop(1, night ? '#2e4a50' : '#4f6f5f');
  // A murky tangle behind the roots shows the whole curtain is solid.
  const murk = c.createLinearGradient(0, water, 0, bottom);
  murk.addColorStop(0, night ? '#1a3a4066' : '#3d5e4a55'); murk.addColorStop(1, night ? '#1a3a4022' : '#3d5e4a22');
  path(c, murk, p => { p.moveTo(x - 30, water); p.quadraticCurveTo(x - 72, water + 40, x - 68, bottom - 30); p.quadraticCurveTo(x - 66, bottom, x - 40, bottom - 4); p.quadraticCurveTo(x, bottom + 4, x + 40, bottom - 4); p.quadraticCurveTo(x + 66, bottom, x + 68, bottom - 30); p.quadraticCurveTo(x + 72, water + 40, x + 30, water); p.closePath(); });
  for (let i = 0; i < 10; i++) {
    const a = x - 60 + i * 13, y1 = water + 30 + (i * 29) % 70;
    path(c, null, p => { p.moveTo(a, y1); p.quadraticCurveTo(a + 18, y1 + 30, a + 4 + (i % 3) * 6, y1 + 60); }, night ? '#2c4a4a88' : '#5e6a5288', 1.6);
  }
  const arches = [[-8, -62, 1], [-4, -40, .78], [0, -18, .9], [3, 14, .72], [6, 38, 1], [9, 62, .86], [-2, -52, .5], [4, 50, .55]];
  arches.forEach(([from, to, depth], i) => {
    const tipY = water + (bottom - water) * depth - 4, sway = Math.sin(t * .7 + i * 1.3) * 1.5, out = x + to + sway;
    path(c, null, p => { p.moveTo(x + from, water - 6); p.bezierCurveTo(x + from + (to - from) * .2, water + 30, out - Math.sign(to) * 6, water + 40, out, tipY); }, root, i < 6 ? 5 : 3.2);
    ellipse(c, out, tipY, i < 6 ? 4.5 : 3, 3, night ? '#3c5a5a' : '#6d7f68');
  });
  for (let i = 0; i < 4; i++) ellipse(c, x - 45 + i * 30, water + 60 + (i % 2) * 50, 3.5, 2.5, '#e6dcc055');
  // Prop roots above the surface.
  for (let i = 0; i < 5; i++) {
    const u = i / 4, footX = x - 60 + u * 120;
    path(c, null, p => { p.moveTo(x + (u - .5) * 16, 312); p.quadraticCurveTo(footX - Math.sign(u - .5) * 4, 314, footX, water + 3); }, night ? '#5a4a3e' : '#8b6b52', 4.5);
  }
  path(c, night ? '#5a4a3e' : '#8b6b52', p => { p.moveTo(x - 8, water - 10); p.quadraticCurveTo(x - 4, 320, x - 6, 296); p.lineTo(x + 6, 296); p.quadraticCurveTo(x + 4, 320, x + 8, water - 10); p.closePath(); }, '#6e5240', 1);
  // Crown: layered clusters, shadow below and warm evening light on top.
  const crown = [[-62, 294, 22], [-44, 276, 26], [-18, 262, 28], [12, 256, 29], [40, 268, 27], [63, 288, 22], [-30, 298, 24], [4, 292, 27], [36, 298, 24], [-6, 244, 20], [26, 240, 17]];
  for (const [dx, y, r] of crown) ellipse(c, x + dx, y + 6, r, r * .8, night ? '#24483c' : '#3f7a52');
  for (const [dx, y, r] of crown) ellipse(c, x + dx, y, r * .94, r * .74, night ? '#356452' : '#5c9c5e');
  for (const [dx, y, r] of crown.filter(([, y]) => y < 280)) ellipse(c, x + dx + r * .25, y - r * .32, r * .5, r * .3, night ? '#4c7a6455' : '#a8cf7aaa');
  for (let i = 0; i < 14; i++) {
    const a = i * 2.4, lx = x + Math.cos(a) * (40 + (i % 3) * 14), ly = 274 + Math.sin(a) * 26;
    ellipse(c, lx, ly, 5, 2.4, night ? '#6a9a7a55' : '#c9e39a88', a);
  }
  // A kingfisher keeps watch from the crown.
  c.save(); c.translate(x + 22, 232);
  ellipse(c, 0, 0, 8, 7, '#3f8fb8'); ellipse(c, 1, 3, 6, 4, '#f2a35e'); ellipse(c, -4, -6, 6, 5.5, '#4aa0c8');
  path(c, '#2f3c44', p => { p.moveTo(-9, -7); p.lineTo(-20, -5); p.lineTo(-9, -4); p.closePath(); });
  path(c, '#3f8fb8', p => { p.moveTo(6, 1); p.lineTo(15, 6); p.lineTo(6, 5); p.closePath(); });
  cuteEye(c, -5, -7, 2.3, blink(t, x * .01), '#1d2a30'); ellipse(c, -2, -3, 1.8, 1.1, '#ff8f9a66');
  c.restore();
}
// Every stage has its own spot for the nest: a grassy islet, a harbour piling,
// a mangrove crown (where real brown pelicans nest) or a moonlit rock.
function nestBase(c, x, water, stage, t) {
  if (STAGES[stage].id === 'harbor') {
    for (const [dx, h] of [[-38, 30], [-6, 40], [26, 34]]) {
      path(c, gradient(c, water - h, water + 60, '#a8805c', '#5e4a3a'), p => p.roundRect(x + dx, water - h, 18, h + 60, 4), '#5a4434', 1.2);
      ellipse(c, x + dx + 9, water - h, 9, 3, '#c49a72');
      path(c, null, p => { p.moveTo(x + dx, water - h + 10); p.lineTo(x + dx + 18, water - h + 14); }, '#e8d9b0', 2);
    }
    path(c, null, p => { p.moveTo(x - 30, water - 18); p.quadraticCurveTo(x - 10, water - 8, x + 34, water - 16); }, '#e8d9b0', 2.2);
    ellipse(c, x + 52, water - 2, 10, 4, '#e9f5df66');
  } else if (STAGES[stage].id === 'lagoon') {
    for (let i = 0; i < 5; i++) { const u = i / 4, foot = x - 58 + u * 116; path(c, null, p => { p.moveTo(x + (u - .5) * 20, water - 20); p.quadraticCurveTo(foot, water - 18, foot, water + 6); }, '#8b6b52', 4); }
    for (const [dx, dy, r] of [[-48, -22, 22], [-22, -34, 26], [10, -36, 28], [40, -26, 23], [-4, -18, 26]]) ellipse(c, x + dx, water + dy, r, r * .62, '#4f8a5a');
    for (const [dx, dy, r] of [[-46, -26, 18], [-20, -38, 22], [12, -40, 23], [42, -30, 19]]) ellipse(c, x + dx, water + dy, r, r * .55, '#69a764');
    for (const [dx, dy] of [[-28, -46], [16, -48], [44, -36]]) ellipse(c, x + dx, water + dy, 8, 3, '#f3d08a88');
  } else if (STAGES[stage].id === 'reef') {
    path(c, gradient(c, water - 40, water + 10, '#4a6a8c', '#22405e'), p => { p.moveTo(x - 64, water + 8); p.quadraticCurveTo(x - 58, water - 30, x - 26, water - 38); p.quadraticCurveTo(x + 6, water - 50, x + 36, water - 36); p.quadraticCurveTo(x + 60, water - 24, x + 66, water + 8); p.closePath(); }, '#1b3450', 1.2);
    ellipse(c, x - 20, water - 40, 18, 4, '#9fb8e044');
    for (const [dx, col] of [[-50, '#e48aa8'], [48, '#f2b06a']]) for (let k = -1; k <= 1; k++) path(c, null, p => { p.moveTo(x + dx, water - 2); p.quadraticCurveTo(x + dx + k * 8, water - 12, x + dx + k * 6, water - 20 + Math.abs(k) * 4); }, col, 3);
  } else {
    path(c, '#829c83', p => { p.moveTo(x - 62, water + 7); p.quadraticCurveTo(x - 53, water - 22, x - 33, water - 34); p.quadraticCurveTo(x, water - 48, x + 32, water - 36); p.quadraticCurveTo(x + 53, water - 20, x + 65, water + 7); p.closePath(); }, '#607a69', 1.2);
  }
}
/** @param {Readonly<import('./game.js').GameState>} game Simulation state; drawing must not mutate it. */
export function drawWorld(c, game, mode, t, outfit, effects, reducedMotion = false, fx = null) {
  const menu = mode === 'menu';
  const water = menu ? 466 : WORLD.water;
  const d = menu ? (reducedMotion ? 0 : t * 12) : game.distance;
  const motion = reducedMotion ? 0 : t;
  c.clearRect(0, 0, 480, 850);
  const stage = menu ? 0 : game.stage, theme = STAGES[stage].theme, night = STAGES[stage].night;
  c.save();
  if (fx && (fx.shakeX || fx.shakeY)) { c.translate(240 + fx.shakeX, 425 + fx.shakeY); c.scale(1.03, 1.03); c.translate(-240, -425); }
  drawSky(c, stage, water, d, motion, menu ? null : game, reducedMotion, () => {
    cloud(c, 68 - d * .025 % 160, 92, .95, .55); cloud(c, 406 - d * .015 % 120, 125, .65, .55); cloud(c, 240 - d * .02 % 100, water - 122, .45, .55);
    island(c, 24 - d * .055 % 780, water - 6, motion);
    island(c, 805 - d * .055 % 780, water - 6, motion);
    c.save(); c.translate(415, water - 1); c.scale(.5, .5); path(c, '#e5d3aa', p => { p.moveTo(-80, 0); p.quadraticCurveTo(-15, -31, 69, 0); }); palm(c, 0, -6, .8, motion); palm(c, -23, -5, .53, motion); c.restore();
    if (STAGES[stage].id === 'harbor') {
      for (let i = 0; i < 6; i++) {
        const x = ((i * 115 - d * .12) % 760 + 760) % 760 - 140;
        path(c, '#89aaa0', p => { p.rect(x, water - 50, 65, 43); p.moveTo(x - 5, water - 50); p.lineTo(x + 30, water - 74); p.lineTo(x + 70, water - 50); });
        c.fillStyle = '#d9dac0'; c.fillRect(x + 12, water - 38, 13, 17); c.fillRect(x + 42, water - 38, 13, 17);
        path(c, null, p => { p.moveTo(x, water - 3); p.lineTo(x + 92, water - 3); p.moveTo(x + 8, water - 3); p.lineTo(x + 8, water + 5); }, '#8c8970', 5);
        if (!menu && game.decor?.residents.includes('cat') && i === game.decor.catHouse) roofCat(c, x + 50, water - 54, motion);
      }
    }
    if (STAGES[stage].id === 'lagoon') {
      // Far mangrove islands: soft crowns on thin stilts.
      for (let i = 0; i < 5; i++) {
        const x = ((i * 157 - d * .07) % 780 + 780) % 780 - 150, w = 30 + (i % 3) * 10;
        path(c, null, p => { for (let k = -2; k <= 2; k++) { p.moveTo(x + k * w * .12, water - 18); p.quadraticCurveTo(x + k * w * .3, water - 10, x + k * w * .36, water); } }, '#7f9c84', 1.4);
        for (const [dx, dy, r] of [[-w * .45, -24, w * .34], [-w * .1, -33, w * .42], [w * .32, -27, w * .36]]) ellipse(c, x + dx, water + dy, r, r * .55, '#86a68a');
      }
    }
    // Distant seabirds.
    for (let i = 0; i < 3; i++) { const x = ((320 + i * 47 - d * .08) % 580 + 580) % 580; const y = water - 91 + Math.sin(i * 2) * 22; path(c, null, p => { p.moveTo(x - 7, y); p.quadraticCurveTo(x - 3, y - 5, x, y); p.quadraticCurveTo(x + 4, y - 5, x + 8, y); }, '#799d93', 1.3); }
  });
  drawWater(c, stage, water, d, motion, menu ? null : game, reducedMotion);
  if (!menu) { drawWhale(c, game, motion, reducedMotion); drawDolphins(c, game, water, motion, reducedMotion); drawRare(c, game, water, motion, reducedMotion); }
  if (!menu && STAGES[game.stage].id === 'reef') {
    for (let i = 0; i < 9; i++) {
      const x = ((i * 79 - d * .22) % 650 + 650) % 650 - 80;
      for (let j = -1; j <= 1; j++) path(c, null, p => { p.moveTo(x, 824); p.quadraticCurveTo(x + j * 30, 800, x + j * 24 + Math.sin(motion + i) * 2, 730 + Math.abs(j) * 17); }, i % 2 ? '#c59191' : '#b5a0b9', 8);
      ellipse(c, x + 28, 817, 19, 12, '#b5bb91');
      if (night) { c.globalCompositeOperation = 'lighter'; ellipse(c, x, 738, 16, 16, '#ff9fd012'); c.globalCompositeOperation = 'source-over'; }
    }
  }
  // Sandy seabed and gently moving sea grass frame the action.
  path(c, theme.seabed, p => { p.moveTo(-30, 833); p.bezierCurveTo(120, 807, 172, 852, 282, 832); p.quadraticCurveTo(398, 803, 510, 825); p.lineTo(510, 880); p.lineTo(-30, 880); });
  drawCaustics(c, stage, d, motion, reducedMotion);
  for (let side = 0; side < 2; side++) {
    for (let i = 0; i < 8; i++) { const x = side ? 475 - i * 9 : i * 9 - 15; const h = 37 + (i * 31) % 112;
      path(c, theme.grass[i % 2 ? 0 : 1], p => { p.moveTo(x - 4, 850); p.bezierCurveTo(x - 18, 800, x + Math.sin(motion + i) * 12, 850 - h, x + 12, 840 - h); p.bezierCurveTo(x + 2, 820 - h, x + 20, 805, x + 5, 850); }, '#386f63', .7);
    }
    ellipse(c, side ? 456 : 23, 836, 25, 11, '#96b5a0'); ellipse(c, side ? 426 : 57, 844, 17, 9, '#81a996');
  }
  if (!menu) {
    drawResidents(c, game, stage, water, d, t, reducedMotion);
    const p = game.player, depth = clamp((p.y - water) / (830 - water), 0, 1);
    ellipse(c, p.x + 4, 838, 22 + depth * 22, 4 + depth * 3, `rgba(20,50,60,${p.wet ? .07 + depth * .16 : .05})`);
  }
  if (menu) {
    fish(c, 95 + Math.sin(motion * .6) * 18, 558, .8, false, motion); fish(c, 371 - Math.sin(motion * .5) * 12, 594, .65, true, motion);
    fish(c, 340 + Math.sin(motion * .5) * 12, 785, .65, false, motion); fish(c, 367 + Math.sin(motion * .5) * 12, 766, .45, false, motion);
    ellipse(c, 229, water + 4, 80, 10, '#306e7120');
    // Pip's little show on the start screen: look around, wink at you, snack on a
    // leaping fish, yawn, ruffle the feathers and hop. One loop every 20 seconds.
    const k = motion % 20, bob = Math.sin(motion * 1.6) * 5;
    const phase = (from, to) => k > from && k < to ? (k - from) / (to - from) : 0;
    const hop = phase(17.2, 18) ? -Math.abs(Math.sin(phase(17.2, 18) * Math.PI * 2)) * 16 : 0;
    const look = phase(1, 3) ? Math.sin(phase(1, 3) * Math.PI) * -.22 : phase(4, 5.6) ? Math.sin(phase(4, 5.6) * Math.PI) * .14 : 0;
    const wink = phase(4.3, 5.4) ? Math.sin(phase(4.3, 5.4) * Math.PI) : 0;
    const yawn = phase(11, 12.8) ? Math.sin(phase(11, 12.8) * Math.PI) : 0;
    const shiver = phase(14, 14.8) ? (1 - phase(14, 14.8)) * .5 : 0;
    const leap = phase(7, 8.1), gulp = phase(8.1, 8.52) ? (1 - phase(8.1, 8.52)) * .42 : 0, hearts = phase(8.1, 9.8);
    const y = 378 + bob + hop;
    if (leap) {
      const fx = 452 - leap * 100, fy = water + 12 + (y - 46 - water - 12) * leap - Math.sin(leap * Math.PI) * 80;
      if (leap < .12) ellipse(c, 452, water + 2, 14 + leap * 80, 3, '#f1fbe9aa');
      fish(c, fx, fy, .7, false, motion, 0, .5 + Math.cos(leap * Math.PI) * .6);
    }
    if (hearts) for (let i = 0; i < 3; i++) {
      const hx = 352 + i * 12 + Math.sin(motion * 6 + i) * 4, hy = y - 60 - hearts * 46 - i * 10, r = 5;
      c.globalAlpha = 1 - hearts;
      path(c, '#ff8fa3', p => { p.moveTo(hx, hy + r * .9); p.bezierCurveTo(hx - r * 1.6, hy - r * .2, hx - r * .7, hy - r * 1.4, hx, hy - r * .5); p.bezierCurveTo(hx + r * .7, hy - r * 1.4, hx + r * 1.6, hy - r * .2, hx, hy + r * .9); });
      c.globalAlpha = 1;
    }
    if (phase(14, 16.5)) for (let i = 0; i < 3; i++) {
      const u = phase(14, 16.5), fx = 190 + i * 30 + Math.sin(u * 9 + i) * 10, fy = y - 10 + u * 70 + i * 6;
      c.globalAlpha = 1 - u; ellipse(c, fx, fy, 5, 2, '#fffaf0', Math.sin(u * 7 + i)); c.globalAlpha = 1;
    }
    if (yawn > .5) { c.globalAlpha = (yawn - .5) * 2; c.fillStyle = '#7a8a9a'; c.font = "bold 14px 'Trebuchet MS'"; c.fillText('z', 300 + yawn * 6, y - 96 - yawn * 10); c.globalAlpha = 1; }
    pelican(c, {
      x: 217, y, scale: 1.55, time: motion, tilt: -.06, outfit,
      happy: hop < 0 || (hearts > 0 && hearts < .7), gulp, reducedMotion,
      expression: { look, wink, yawn, shiver },
    });
  } else {
    for (const item of game.items) {
      if (item.kind === 'buoy') {
        const b = terrainBlocks(item)[0];
        const outline = p => { b.points.forEach((v, i) => i ? p.lineTo(v.x, v.y) : p.moveTo(v.x, v.y)); p.closePath(); };
        path(c, gradient(c, b.y, b.y + b.height, '#edb17a', '#bc6555'), outline, '#785950', 2);
        c.save(); c.beginPath(); outline(c); c.clip();
        for (const y of [278, 340, 402]) path(c, '#fff0cf', p => p.rect(b.x, y, b.width, 24));
        c.restore();
        ellipse(c, item.x, 260, 7, 7, '#fff2b9');
        ellipse(c, item.x, water + 5, 42, 7, '#e9f5df66');
      }
      if (item.kind === 'mangrove') mangrove(c, item, water, motion, night);
      if (item.kind === 'coral') {
        const b = terrainBlocks(item)[0];
        path(c, gradient(c, b.y, 850, '#e7a28e', '#98738b'), p => { b.points.forEach((v, i) => i ? p.lineTo(v.x, v.y) : p.moveTo(v.x, v.y)); p.closePath(); }, '#855f79', 2);
        // Branches stay inside the shared collision silhouette.
        for (let i = 0; i < 5; i++) {
          const x = item.x - 55 + i * 27, top = 629 + (i % 2) * 20;
          path(c, null, p => { p.moveTo(x, 830); p.quadraticCurveTo(x - 8, 740, x, top); p.moveTo(x - 2, top + 65); p.quadraticCurveTo(x - 19, top + 50, x - 14, top + 29); p.moveTo(x - 3, top + 105); p.quadraticCurveTo(x + 17, top + 88, x + 13, top + 66); }, i % 2 ? '#f4c0a3' : '#c98199', 9);
          ellipse(c, x, top, 5, 5, '#ffe0b8');
        }
      }
      if (['island', 'reef'].includes(item.kind)) {
        for (const b of terrainBlocks(item)) {
          const outline = p => { b.points.forEach((point, i) => i ? p.lineTo(point.x, point.y) : p.moveTo(point.x, point.y)); p.closePath(); };
          c.save(); c.lineJoin = 'round';
          path(c, gradient(c, b.y, b.y + b.height, '#8eaf96', '#477772'), outline, '#3e6d68', 2);
          c.beginPath(); outline(c); c.clip();
          path(c, '#e4cf9f', p => { p.moveTo(b.x, b.y + 8); p.quadraticCurveTo(b.x + b.width * .25, b.y - 1, b.x + b.width * .52, b.y + 7); p.quadraticCurveTo(b.x + b.width * .78, b.y - 1, b.x + b.width, b.y + 8); p.lineTo(b.x + b.width, b.y + 19); p.quadraticCurveTo(b.x + b.width * .5, b.y + 11, b.x, b.y + 20); p.closePath(); }, '#bfa877', 1);
          const layers = Math.max(1, Math.min(5, Math.ceil(b.height / 95)));
          for (let i = 0; i < layers; i++) {
            const y = b.y + 32 + i * Math.max(1, (b.height - 64) / Math.max(1, layers - 1));
            path(c, i % 2 ? '#70988655' : '#acc09a44', p => p.ellipse(b.x + b.width * (.43 + (i % 2) * .13), y, b.width * .43, Math.min(34, b.height * .34), i % 2 ? -.12 : .15, 0, TAU), '#3d6d6755', 1.3);
            path(c, null, p => { p.moveTo(b.x + b.width * .25, y - 3); p.quadraticCurveTo(b.x + b.width * .43, y + 8, b.x + b.width * .57, y + 2); }, '#d0d0a344', 1.2);
          }
          c.restore();
        }
        if (item.kind === 'island') {
          for (let i = 0; i < 5; i++) ellipse(c, item.x - 45 + i * 22, 329 + Math.sin(i * 2) * 3, 18, 8, i % 2 ? '#79aa80' : '#8db686');
          ellipse(c, item.x + 22, 323, 8, 4, '#f0ccb0'); ellipse(c, item.x + 23, 321, 2, 2, '#f7e7c8');
        } else {
          for (let i = 0; i < 5; i++) path(c, null, p => { p.moveTo(item.x - 60 + i * 27, 610); p.quadraticCurveTo(item.x - 70 + i * 27 + Math.sin(motion + i) * 4, 638, item.x - 55 + i * 27, 657); }, i % 2 ? '#d49a91' : '#e0af95', 5);
        }
      }
      if (item.kind === 'nest') {
        nestBase(c, item.x, water, stage, motion);
        ellipse(c, item.x, water - 26, 54, 14, '#8b6548');
        ellipse(c, item.x, water - 29, 47, 10, '#bb8d5c');
        for (let j = 0; j < 2; j++) {
          const sated = item.served && !game.feeding && game.feedingTotal > 0 && j === 0;
          const eager = !sated && Math.abs(item.x - game.player.x) < 250;
          const hop = eager && !reducedMotion ? Math.max(0, Math.sin(motion * 9 + j * 2)) * 9 : 0;
          const x = item.x - 18 + j * 34, y = water - 43 - hop + (sated ? 9 : 0);
          ellipse(c, x, y, sated ? 19 : 15, sated ? 12 : 18, gradient(c, y - 18, y + 18, '#fff4c8', '#e8c67b'));
          path(c, '#f7dfa0', p => { p.moveTo(x - 9, y - 25); p.lineTo(x - 8, y - 34); p.lineTo(x - 2, y - 27); p.lineTo(x + 3, y - 35); p.lineTo(x + 5, y - 25); p.closePath(); });
          ellipse(c, x - 2, y - 18, 13, 13, '#fff5cf');
          ellipse(c, x - 7, y - 21, 2.2, sated ? 1 : 3, '#345b52'); ellipse(c, x - 7.5, y - 22, .7, 1, '#fff');
          path(c, '#efb358', p => { p.moveTo(x - 12, y - 20); p.lineTo(x - 30, y - (eager ? 27 : 17)); p.lineTo(x - 13, y - 15); p.closePath(); }, '#b97845', .8);
          if (eager) path(c, '#f8cf77', p => { p.moveTo(x - 12, y - 14); p.lineTo(x - 28, y - 12); p.lineTo(x - 13, y - 9); p.closePath(); }, '#b97845', .8);
          ellipse(c, x - 8, y - 12, 3.5, 2, '#edb6a0');
          path(c, '#f4dda1', p => { p.moveTo(x + 5, y - 1); p.quadraticCurveTo(x + 18, y + 2, x + 8, y + 12); p.quadraticCurveTo(x + 2, y + 8, x + 5, y - 1); }, '#d6b66f', .7);
        }
        for (let j = 0; j < 9; j++) path(c, null, p => { p.moveTo(item.x - 49 + j * 11, water - 28 + j % 2 * 5); p.lineTo(item.x - 31 + j * 9, water - 17 - j % 3 * 3); }, j % 2 ? '#dcb676' : '#c9995e', 2.5);
        if (game.feeding && game.feedingTotal > 0 && item.served && item.celebration > 0) {
          const phase = (motion * 4) % 1;
          fish(c, item.x - 25 + phase * 40, water - 71 - Math.sin(phase * Math.PI) * 20, .4, false, motion);

        }
      }
      if (item.kind === 'diver') {
        if (['aim', 'locked'].includes(item.phase)) {
          c.save(); c.setLineDash(item.phase === 'aim' ? [5, 8] : []);
          path(c, null, p => { p.moveTo(item.x - 30, item.y); p.lineTo(item.aimX, item.aimY); }, item.phase === 'locked' ? '#ffd28a' : '#c2e8d277', 2); c.restore();
        }
        const kick = Math.sin(motion * 5) * 5;
        ellipse(c, item.x + 8, item.y, 31, 16, gradient(c, item.y - 16, item.y + 16, '#557e89', '#355f70'));
        path(c, '#e9bc62', p => { p.roundRect(item.x - 1, item.y - 21, 29, 11, 5); }, '#8a7448', 1);
        for (let i = 0; i < 2; i++) path(c, i ? '#e3a255' : '#efb565', p => { p.moveTo(item.x + 29, item.y + i * 7); p.quadraticCurveTo(item.x + 48, item.y + i * 10, item.x + 64, item.y - 5 + i * 19 + kick * (i ? -1 : 1)); p.lineTo(item.x + 48, item.y + 13 + i * 8); p.closePath(); }, '#9d704d', 1);
        ellipse(c, item.x - 23, item.y - 4, 15, 15, gradient(c, item.y - 19, item.y + 11, '#efc39f', '#d99d82'));
        path(c, '#8bc8ca', p => p.roundRect(item.x - 39, item.y - 14, 25, 14, 5), '#294f60', 3);
        path(c, null, p => { p.moveTo(item.x - 27, item.y - 14); p.lineTo(item.x - 27, item.y); }, '#d9f1e7aa', 1);
        ellipse(c, item.x - 30, item.y - 8, 2, 3, '#31596a');
        path(c, null, p => { p.moveTo(item.x - 18, item.y + 10); p.quadraticCurveTo(item.x - 35, item.y + 18, item.x - 49, item.y + 4); }, '#e3b78d', 5);
        path(c, null, p => { p.moveTo(item.x - 53, item.y + 3); p.lineTo(item.x - 20, item.y + 3); }, '#405b61', 5);
        path(c, null, p => { p.moveTo(item.x - 51, item.y - 1); p.lineTo(item.x - 58, item.y + 3); p.lineTo(item.x - 51, item.y + 7); }, '#d7d1a8', 1.5);
        if (!reducedMotion) for (let i = 0; i < 2; i++) { const rise = (motion * 20 + i * 17) % 35; ellipse(c, item.x - 22 + i * 7, item.y - 20 - rise, 2 + i, 2 + i, '#d9f5e088'); }

      }
      if (item.kind === 'harpoon') {
        c.save(); c.translate(item.x, item.y); c.rotate(Math.atan2(item.vy, item.vx));
        path(c, null, p => { p.moveTo(-24, 0); p.lineTo(13, 0); }, '#f3ddb1', 3);
        path(c, '#d6c18e', p => { p.moveTo(4, -6); p.lineTo(14, 0); p.lineTo(4, 6); p.lineTo(8, 0); p.closePath(); }, '#725f4f', 1); c.restore();
      }
      if (item.kind === 'surfer') {
        const bob = Math.sin(motion * 4) * 3, lean = Math.sin(motion * 2.2) * .05;
        const wave = !reducedMotion && item.reaction > 0 ? Math.sin(item.reaction * 18) * 15 : 0;
        path(c, null, p => { p.moveTo(item.x + 65, WORLD.water + 10); p.quadraticCurveTo(item.x + 18, WORLD.water - 22, item.x - 68, WORLD.water + 7); }, '#e8f6dfcc', 6);
        ellipse(c, item.x, WORLD.water + bob, 50, 7, gradient(c, WORLD.water - 6, WORLD.water + 8, '#f5bc80', '#dc7f68'));
        path(c, null, p => { p.moveTo(item.x - 36, WORLD.water + bob); p.quadraticCurveTo(item.x, WORLD.water + bob + 5, item.x + 38, WORLD.water + bob); }, '#fff0b999', 1.5);
        c.save(); c.translate(item.x, WORLD.water + bob); c.scale(item.escaping ? -1 : 1, 1);
        c.rotate(lean);
        path(c, null, p => { p.moveTo(-20, -4); p.lineTo(-5, -28); p.lineTo(14, -4); }, '#dba77f', 9);
        ellipse(c, -20, -3, 7, 3, '#f1c194'); ellipse(c, 14, -3, 7, 3, '#f1c194');
        path(c, gradient(c, -59, -27, '#7eb0a7', '#527f7c'), p => { p.moveTo(-12, -27); p.lineTo(-14, -56); p.lineTo(8, -59); p.lineTo(14, -27); p.closePath(); }, '#456f6e', 1);
        path(c, null, p => { p.moveTo(-10, -49); p.quadraticCurveTo(-23, -47, -36, -39 + wave); p.moveTo(7, -50); p.quadraticCurveTo(20, -56, 31, -61); }, '#edc39a', 7);
        ellipse(c, -36, -39 + wave, 4, 4, '#edc39a'); ellipse(c, 31, -61, 4, 4, '#edc39a');
        ellipse(c, -4, -71, 12, 13, '#edc39a');
        path(c, '#8f5f49', p => { p.arc(-4, -75, 13, Math.PI, Math.PI * 2); p.quadraticCurveTo(5, -77, 9, -71); p.closePath(); });
        ellipse(c, -9, -72, 2, 2.5, '#315852'); ellipse(c, -10, -73, .7, .8, '#fff8e3');
        path(c, null, p => { p.moveTo(-12, -65); p.quadraticCurveTo(-6, -61, 0, -66); }, '#8f5f49', 1.3); c.restore();
      }
      if (item.kind === 'gull') {
        const wing = Math.sin(motion * 10) * 18;
        c.save(); c.translate(item.x, item.y);
        if (!reducedMotion) c.rotate(item.kicked ? (1 - item.reaction) * 8 : item.reactionKind === 'confused' ? Math.sin(item.reaction * 16) * .7 : 0);
        else if (item.kicked) c.rotate(-.35);
        path(c, '#f8f2dc', p => { p.moveTo(0, 0); p.quadraticCurveTo(-18, -18, -38, -wing); p.quadraticCurveTo(-22, 2, -3, 7); p.closePath(); }, '#918b73', 1);
        path(c, '#fff8e8', p => { p.moveTo(0, 0); p.quadraticCurveTo(16, -18, 38, -wing); p.quadraticCurveTo(24, 2, 3, 7); p.closePath(); }, '#918b73', 1);
        ellipse(c, 0, 0, 18, 10, '#eee8d4'); ellipse(c, -13, -7, 9, 9, '#fff9e8');
        path(c, '#e6a953', p => { p.moveTo(-19, -9); p.lineTo(-34, -4); p.lineTo(-19, -1); p.closePath(); }, '#ad7043', .8);
        if (item.reactionKind === 'confused') path(c, null, p => { p.moveTo(-20, -13); p.lineTo(-12, -6); p.moveTo(-12, -13); p.lineTo(-20, -6); }, '#315852', 1.7);
        else { cuteEye(c, -15.5, -10, 3.4, blink(motion, item.baseY * .01 + 3), '#315852'); ellipse(c, -11, -5, 2.6, 1.5, '#f3a0a066'); }
        path(c, null, p => { p.moveTo(9, 5); p.lineTo(21, 9); }, '#b8ad91', 2); c.restore();
      }
      if (item.kind === 'jelly') {
        const pulse = Math.sin(motion * 4) * 2, depth = 20 + item.phase * 65;
        for (let i = -2; i <= 2; i++) path(c, null, p => { p.moveTo(item.x + i * 9, item.y); p.bezierCurveTo(item.x + i * 9 - 12, item.y + depth / 2, item.x + i * 9 + 12, item.y + depth / 2, item.x + i * 9, item.y + depth); }, i % 2 ? '#df9dcecc' : '#efb7dbcc', 3);
        path(c, gradient(c, item.y - 31, item.y + 11, '#f0c8e1', '#cf8fc4'), p => { p.moveTo(item.x - 27 - pulse, item.y); p.quadraticCurveTo(item.x - 25, item.y - 31, item.x, item.y - 31 - pulse); p.quadraticCurveTo(item.x + 25, item.y - 31, item.x + 27 + pulse, item.y); p.quadraticCurveTo(item.x + 18, item.y + 8, item.x + 10, item.y); p.quadraticCurveTo(item.x, item.y + 10, item.x - 10, item.y); p.quadraticCurveTo(item.x - 19, item.y + 8, item.x - 27 - pulse, item.y); }, '#8e6d96', 1);
        ellipse(c, item.x - 9, item.y - 17, 7, 4, '#fff3ed77');
        for (const dx of [-8, 8]) { cuteEye(c, item.x + dx, item.y - 8, 3.6, blink(motion, item.x * .002 + 4), '#655879'); ellipse(c, item.x + dx * 1.6, item.y - 3, 3, 1.6, '#ff8fb066'); }
        path(c, null, p => { p.moveTo(item.x - 5, item.y); p.quadraticCurveTo(item.x, item.y + 4, item.x + 5, item.y); }, '#755e83', 1.2);
      }
      if (item.kind === 'driftwood') {
        ellipse(c, item.x, item.y + 9, 62, 8, '#e9f5df55');
        path(c, gradient(c, item.y - 10, item.y + 13, '#ba895e', '#865a43'), p => { p.roundRect(item.x - 48, item.y - 10, 96, 23, 10); }, '#6f4e40', 2);
        path(c, null, p => { p.moveTo(item.x - 34, item.y); p.quadraticCurveTo(item.x, item.y + 5, item.x + 32, item.y - 1); }, '#d4a77d', 2);
        ellipse(c, item.x + 41, item.y + 1, 5, 8, '#d9ac7b'); ellipse(c, item.x - 25, item.y - 2, 4, 2, '#765040');
        path(c, '#719b78', p => { p.moveTo(item.x - 16, item.y - 7); p.quadraticCurveTo(item.x - 10, item.y - 21, item.x - 2, item.y - 8); p.closePath(); });
      }
      if (item.kind === 'whirlpool') {
        ellipse(c, item.x, item.y + 3, 100, 42, '#255d6a33');
        for (let i = 0; i < 4; i++) { c.beginPath(); c.ellipse(item.x, item.y, 30 + i * 25, 8 + i * 11, motion * .7 + i * .4, 0, Math.PI * 1.6); c.strokeStyle = i % 2 ? '#bde7d799' : '#e7edc6aa'; c.lineWidth = 3; c.stroke(); }
        ellipse(c, item.x, item.y + 4, 17, 6, '#28596888');

      }
      if (item.kind === 'bubble') {
        ellipse(c, item.x, item.y, 18, 18, gradient(c, item.y - 18, item.y + 18, '#e5fff5aa', '#83d7cf33'));
        c.strokeStyle = '#eafff6'; c.lineWidth = 2; c.beginPath(); c.arc(item.x, item.y, 18, 0, TAU); c.stroke();
        ellipse(c, item.x - 5, item.y - 6, 4, 5, '#ffffffcc');

      }
      if (item.kind === 'current') drawCurrent(c, item, motion, reducedMotion);
      if (item.kind === 'baitball') drawBaitball(c, item, game.time, night);
      if (night && (item.kind === 'fish' || item.kind === 'jelly')) { c.globalCompositeOperation = 'lighter'; ellipse(c, item.x, item.y - (item.kind === 'jelly' ? 12 : 0), item.kind === 'jelly' ? 44 : 25, item.kind === 'jelly' ? 40 : 17, item.kind === 'jelly' ? '#ff9ee01c' : item.golden ? '#ffd9701c' : '#ffc9a00e'); c.globalCompositeOperation = 'source-over'; }
      if (item.kind === 'fish') { const gap = Math.hypot(item.x - game.player.x, item.y - game.player.y); fish(c, item.x, item.y, item.golden ? .95 : .8, item.golden, motion, gap < 120 ? 1 - gap / 120 : 0, item.leap > 0 && item.leap < LEAP.duration ? Math.cos(item.leap / LEAP.duration * Math.PI) * .8 : 0); }
      if (item.kind === 'puffer') puffer(c, item, motion);
      if (item.kind === 'turtle') turtle(c, item, motion);
      if (item.kind === 'shark') shark(c, item, motion);
      if (item.kind === 'boat') boat(c, item, water, motion, game.decor?.sleepy);
    }
    const p = game.player;
    c.save();
    pelican(c, {
      x: p.feedX ?? p.x, y: p.y, scale: .76, time: motion,
      tilt: game.feeding ? -.12 + Math.sin(motion * 10) * .06 : playerTilt(p),
      outfit, wet: p.wet, happy: game.feeding > 0 || p.gulp > .1 || fx?.joy > 0,
      gulp: game.feeding ? .2 : p.gulp, breach: p.breach, cargo: game.cargo, breath: p.breath, reducedMotion,
      expression: {
        energy: game.energy, hurt: p.hurt, relief: p.relief, bump: p.bump, confused: p.confused, kick: p.kick,
        squash: fx?.squash, stretch: game.feeding ? 0 : clamp(Math.abs(p.vy) / 3400, 0, .1),
        sparkle: fx?.sparkle, shiver: fx?.shiver,
        fish: game.items.find(i => i.kind === 'fish' && i.x > p.x + 30 && i.x < p.x + 140),
        nest: game.feeding || game.settling || game.items.some(i => i.kind === 'nest' && Math.abs(i.x - p.x) < 260),
      },
    });
    c.restore();
  }
  const swell = menu ? 1 : swellOf(game, stage, reducedMotion);
  for (let i = 0; i < 4; i++) {
    path(c, null, p => { for (let x = -30; x <= 510; x += 8) { const y = water + i * 4 + Math.sin(x * .025 + motion * 1.6 + i * .3) * 3 * swell + Math.sin(x * .011 - motion * .9) * 2.2 * (swell - 1); if (x === -30) p.moveTo(x, y); else p.lineTo(x, y); } }, ['#fff1c8cc', '#dceccf88', '#c3ead455', '#b7e4cc22'][i], i === 0 ? 2 : 1);
  }
  if (!reducedMotion) for (let i = 0; i < 7; i++) {
    const x = ((i * 77 - d * .5) % 540 + 540) % 540 - 30, glint = Math.max(0, Math.sin(motion * 2.4 + i * 1.9));
    c.globalAlpha = glint * .8; path(c, night ? '#eef3ff' : '#fffbe0', p => p.ellipse(x, water + Math.sin(x * .025 + motion * 1.6) * 3 * swell, 5 + glint * 5, 1.3, 0, 0, TAU)); c.globalAlpha = 1;
  }
  if (STAGES[stage].id === 'lagoon' && !menu) {
    c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 6; i++) {
      const x = ((i * 61 + Math.sin(motion * .4 + i) * 30 - d * .3) % 540 + 540) % 540 - 30, y = water - 28 - (i * 37) % 110 + Math.sin(motion * .9 + i * 2) * 10;
      const glow = reducedMotion ? .6 : Math.max(0, Math.sin(motion * (1.2 + (i % 3) * .4) + i * 2.3));
      ellipse(c, x, y, 5, 5, `rgba(255,214,110,${.16 * glow})`); ellipse(c, x, y, 1.5, 1.5, `rgba(255,240,160,${.85 * glow})`);
    }
    c.globalCompositeOperation = 'source-over';
  }
  if (!menu) drawJuice(c, fx, game, water, motion, reducedMotion);
  for (const e of effects) {
    c.save(); c.globalAlpha = Math.min(1, e.life * 2);
    if (e.label) {
      const rise = (1 - e.life) * 34, size = e.big ? 21 : 15;
      c.font = `bold ${size}px 'Trebuchet MS'`; c.textAlign = 'center'; c.lineWidth = 4; c.strokeStyle = '#1f4a4fcc'; c.lineJoin = 'round';
      const lx = clamp(e.x, 80, 400), ly = e.y - 46 - rise;
      c.strokeText(e.label, lx, ly); c.fillStyle = e.colour || '#fff2b6'; c.fillText(e.label, lx, ly);
    }
    if (['catch', 'mission', 'trick', 'outsmart', 'delivery', 'kick', 'feast', 'nearMiss', 'frenzy'].includes(e.kind)) {
      if (!reducedMotion) for (let i = 0; i < 5; i++) { const r = (1 - e.life) * 45; ellipse(c, e.x + Math.cos(i * 1.25) * r, e.y + Math.sin(i * 1.25) * r, 2.5 * e.life, 2.5 * e.life, '#fff2b6'); }
      if (e.kind === 'kick') { c.fillStyle = '#fff2b6'; c.font = "bold 15px 'Trebuchet MS'"; c.textAlign = 'center'; c.fillText(`KUNG-FU +${e.points}`, e.x, e.y - 42); }
    } else if (!fx && !reducedMotion && ['splash', 'breach', 'netSplash'].includes(e.kind)) {
      for (let i = 0; i < 9; i++) { const v = i - 4; const age = 1 - e.life; ellipse(c, e.x + v * age * (e.kind === 'netSplash' ? 31 : 19), e.y - Math.sin(age * Math.PI) * ((e.kind === 'breach' ? 45 : 27) - Math.abs(v) * 3), 2 * e.life, 4 * e.life, '#e8f8de'); }
    }
    c.restore();
  }
  c.restore();
}
