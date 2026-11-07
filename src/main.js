import Phaser from 'phaser';
import { STAGES } from './stages.js';
import './style.css';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { createGame, step, press, WORLD, airState } from './game.js';
import { drawWorld } from './art.js';
import { createAudio } from './audio.js';
import { createJuice } from './juice.js';
import { recordAttempt, attemptFromGame } from './progress.js';
import { restoreProgress, readStoredProgress, saveSetting, saveAttempt, isProgressKey } from './storage.js';
import { setupPwa } from './pwa.js';
import { applyTranslations, currentLocale, formatNumber, setLocale, stageName, t } from './i18n.js';

const $ = id => document.getElementById(id);
const app = $('app'), canvas = $('world'), ctx = canvas.getContext('2d');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const prefs = restoreProgress();
let selectedStage = Math.min(prefs.completed, STAGES.length - 1);
const audio = createAudio(prefs);
const juice = createJuice(reducedMotion);
const showLabels = { dolphins: 'showDolphins', goldenHour: 'showGoldenHour', shootingStars: 'showShootingStars' };
const labels = { airCatch: ['fxAirCatch', '#fff2b6', true], nearMiss: ['fxNearMiss', '#ffffff'], frenzy: ['fxFrenzy', '#ffd66e', true], feast: ['fxFeast', '#e3f6ff', true], current: ['fxCurrent', '#dffff6'] };
let phaserScene;
let game = createGame(), mode = 'menu', holding = false, effects = [], last = 0, animation = 0, toastUntil = 0, needsDraw = true;
function text(id, value) { if ($(id).textContent !== String(value)) $(id).textContent = value; }
function syncPrefs(latest) { Object.assign(prefs, latest); }
function persistSettings(key) {
  try {
    syncPrefs(saveSetting(key, prefs[key])); return true;
  } catch { toast(t('settingsSaveFailed')); return false; }
}
function persistAttempt(attempt) {
  try {
    syncPrefs(saveAttempt(attempt)); return true;
  } catch { return false; }
}
function toast(message) { text('toast', message); $('toast').classList.remove('hidden'); toastUntil = performance.now() + 3000; }
function clock(seconds) { return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`; }
function refreshLocale() {
  setLocale(prefs.language); applyTranslations();
  $('game-title').innerHTML = { de: 'Schnabel<em>glück</em>', en: 'Happy <em>Beak</em>', es: 'Pico <em>Feliz</em>' }[currentLocale()];
  document.querySelectorAll('[data-locale]').forEach(button => {
    const selected = button.dataset.locale === currentLocale();
    button.setAttribute('aria-pressed', String(selected));
    button.setAttribute('aria-label', t(`locales.${button.dataset.locale}`));
  });
  refreshMenu();
}
function refreshMenu() {
  document.querySelector('.record').hidden = prefs.record === 0;
  text('record', formatNumber(prefs.record));
  $('stages').replaceChildren(...STAGES.map((stage, i) => {
    const option = document.createElement('option'); option.value = i;
    option.textContent = `${i < prefs.completed ? '✓ ' : ''}${stageName(i)}${i > prefs.completed ? ` · ${t('locked')}` : ''}`;
    option.disabled = i > prefs.completed; return option;
  }));
  $('stages').value = selectedStage;
  text('stage-best', t('best', { score: formatNumber(prefs.bests[selectedStage]) }));
  text('play-label', prefs.completed ? t('continue') : t('play'));
}
$('stages').onchange = () => { selectedStage = Number($('stages').value); refreshMenu(); };
document.querySelectorAll('[data-locale]').forEach(button => button.onclick = () => {
  prefs.language = button.dataset.locale;
  refreshLocale(); persistSettings('language');
});

function closeDialogs() { document.querySelectorAll('dialog[open]').forEach(d => d.close()); }
function start(elapsed) {
  closeDialogs(); game = createGame(Math.random, selectedStage, elapsed); document.body.classList.toggle('night', STAGES[game.stage].night); game.attemptId = crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`; effects = []; juice.reset(); mode = 'playing'; holding = false;
  $('start').classList.add('hidden'); $('hud').classList.remove('hidden'); $('pause').classList.remove('hidden');
  $('toast').classList.add('hidden'); audio.start(); updateHud(); canvas.focus();
}
function home() {
  selectedStage = Math.min(prefs.completed, STAGES.length - 1);
  closeDialogs(); mode = 'menu'; holding = false; effects = []; juice.reset(); audio.start('menu');
  $('start').classList.remove('hidden'); $('hud').classList.add('hidden'); $('pause').classList.add('hidden'); refreshMenu(); $('play').focus();
}
function pause(showDialog = true) {
  if (mode !== 'playing') return;
  mode = 'paused'; holding = false; audio.pause(); phaserScene?.bubbles.pause();
  if (showDialog) $('pause-dialog').showModal();
}
function resume() { phaserScene?.bubbles.resume(); closeDialogs(); holding = false; mode = 'playing'; last = performance.now(); audio.start(game.feeding || game.settling ? 'menu' : 'playing'); canvas.focus(); }
function finish() {
  if (mode === 'ended') return;
  const record = game.score > prefs.bests[game.stage];
  game.ended = true; const attempt = attemptFromGame(game, game.attemptId); recordAttempt(prefs, game, game.attemptId);
  const complete = game.endReason === 'complete';
  const final = complete && game.stage === STAGES.length - 1;
  $('next-stage').classList.toggle('hidden', !complete || final);
  text('again', t('again'));
  mode = 'ended'; holding = false;
  const saved = persistAttempt(attempt); $('retry-save').classList.toggle('hidden', saved);
  text('result-kicker', complete ? (final ? t('allNests') : t('nestReached')) : record ? t('newRecord') : stageName(game.stage));
  text('result-title', game.endReason === 'complete' && final ? t('reasons.final') : t(`reasons.${game.endReason}`) || t('reasons.fallback'));
  text('result-score', formatNumber(game.score)); text('result-fish', formatNumber(game.fish)); text('result-combo', formatNumber(game.bestCombo)); text('result-time', clock(game.time));
  const resultMessage = complete ? (final ? t('finalMission') : t('nextMission', { stage: stageName(game.stage + 1) })) : game.mission ? t('mission') : t('nextGoal');
  text('result-mission', `${resultMessage} ${saved ? t('saved') : t('saveFailed')}`);
  closeDialogs(); $('result-dialog').showModal(); $('pause').classList.add('hidden'); audio.start('menu'); audio.effect('end');
}
let shownScore = 0;
function updateHud() {
  if (game.score > shownScore) { const score = $('score'); score.classList.remove('pop'); void score.offsetWidth; score.classList.add('pop'); }
  shownScore = game.score;
  text('score', formatNumber(game.score)); text('time', clock(Math.floor(game.time)));
  const energy = Math.ceil(game.energy); $('energy').style.width = energy + '%'; $('energy').style.background = energy < 25 ? '#d78560' : '#5c9e79';
  text('energy-value', energy); document.querySelector('.energy-track').setAttribute('aria-valuenow', energy);
  const p = game.player;
  $('air').classList.toggle('hidden', !p.wet && p.breath >= WORLD.breath);
  const { level, urgency } = airState(p, game.cargo);
  $('air').classList.toggle('low-air', level > 0);
  const pulse = reducedMotion ? 2 : 2 + (1 + Math.sin(animation * (5 + urgency * 5))) * 2;
  $('status-panel').style.boxShadow = level ? `0 0 0 ${pulse}px #ffd59a66` : '';
  text('air-label', level ? t('surface') : t('air'));
  text('air-value', `${p.breath.toFixed(1)} s`);
  $('air-fill').style.width = `${p.breath / WORLD.breath * 100}%`;
  document.querySelector('.air-track').setAttribute('aria-valuemax', WORLD.breath);
  document.querySelector('.air-track').setAttribute('aria-valuenow', p.breath.toFixed(1));
}
canvas.tabIndex = 0;
$('play').onclick = () => start(); $('again').onclick = () => { selectedStage = game.stage; start(); };
$('next-stage').onclick = () => { selectedStage = Math.min(game.stage + 1, STAGES.length - 1); start(game.elapsed + game.time); }; $('back-home').onclick = home;
$('pause').onclick = () => pause(); $('resume').onclick = resume;
$('quit').onclick = finish;
$('settings').onclick = () => { pause(false); $('settings-dialog').showModal(); };
function afterSettings() { $('settings-dialog').close(); if (mode === 'paused') $('pause-dialog').showModal(); }
$('settings-dialog').querySelector('.close').onclick = afterSettings;
$('settings-dialog').querySelector('.close-settings').onclick = afterSettings;
for (const key of ['music', 'sound', 'haptics']) { $(key).checked = prefs[key]; $(key).onchange = () => { prefs[key] = $(key).checked; persistSettings(key); }; }
$('retry-save').onclick = () => {
  const attempt = attemptFromGame(game, game.attemptId);
  if (!persistAttempt(attempt)) return;
  $('retry-save').classList.add('hidden');
  const message = $('result-mission').textContent.replace(t('saveFailed'), '').trim();
  text('result-mission', `${message} ${t('saved')}`);
};
window.addEventListener('storage', event => {
  if (!isProgressKey(event.key)) return;
  try { syncPrefs(readStoredProgress()); refreshLocale(); } catch { /* Keep the current in-memory state. */ }
});
$('pause-dialog').addEventListener('cancel', event => { event.preventDefault(); resume(); });
$('settings-dialog').addEventListener('cancel', event => { event.preventDefault(); afterSettings(); });
$('result-dialog').addEventListener('cancel', event => { event.preventDefault(); home(); });
app.addEventListener('pointerdown', event => {
  if (mode !== 'playing' || event.target.closest('button, dialog, input')) return;
  event.preventDefault(); if (!holding) press(game); holding = true; app.setPointerCapture(event.pointerId);
});
for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) app.addEventListener(name, () => { holding = false; });
window.addEventListener('keydown', event => {
  if (event.code === 'Space' && mode === 'playing' && !event.target.closest('button, input, dialog')) { event.preventDefault(); if (!event.repeat && !holding) press(game); holding = true; }
  if (event.code === 'Escape' && mode === 'playing') { event.preventDefault(); pause(); }
});
window.addEventListener('keyup', event => { if (event.code === 'Space') { holding = false; if (mode === 'playing') event.preventDefault(); } });
function resumeMenuAudio() {
  if (!document.hidden && (mode === 'menu' || mode === 'ended')) audio.start('menu');
}
// A real tap/key unlocks Web Audio on mobile, including installed web apps.
document.addEventListener('pointerup', resumeMenuAudio);
document.addEventListener('keydown', resumeMenuAudio);
window.addEventListener('focus', resumeMenuAudio);
window.addEventListener('blur', () => { pause(); audio.pause(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { pause(); audio.pause(); } else resumeMenuAudio(); });
if (Capacitor.isNativePlatform()) {
  App.addListener('appStateChange', ({ isActive }) => { if (!isActive) { pause(); audio.pause(); } else resumeMenuAudio(); });
  App.addListener('backButton', () => {
    if ($('settings-dialog').open) afterSettings();
    else if (mode === 'playing') pause();
    else if (mode === 'paused') resume();
    else if (mode === 'ended') home();
    else App.minimizeApp();
  });
}
function resize() {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = WORLD.width * ratio; canvas.height = WORLD.height * ratio; ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  needsDraw = true;
}
window.addEventListener('resize', resize); resize(); refreshLocale();
// Autoplay where allowed; the gesture listeners resume a suspended mobile context.
audio.start('menu');
const applyPendingUpdate = setupPwa(toast);
function frame(now) {
  const dt = Math.min(.05, Math.max(0, (now - (last || now)) / 1000)); last = now;
  if (mode === 'playing' || mode === 'menu') animation += dt;
  if (mode === 'menu' && !document.querySelector('dialog[open]')) applyPendingUpdate();
  if (mode === 'playing') {
    const wasFeeding = game.feeding > 0;
    for (const event of step(game, dt * juice.timeScale(dt), holding)) {
      if (event.kind === 'end') { finish(); break; }
      juice.onEvent(event, game);
      if (event.kind === 'catch' && !reducedMotion) phaserScene?.bubbles.explode(5, event.x, event.y);
      const label = labels[event.kind];
      if (event.x !== undefined && !['warning', 'sardine'].includes(event.kind)) effects.push({ ...event, life: label ? 1.3 : 1, label: label && t(label[0], { points: event.points }), colour: label?.[1], big: label?.[2] });
      if (event.kind === 'show' && showLabels[event.name]) toast(t(showLabels[event.name]));
      audio.effect(event.kind, event.name);
      if (event.kind === 'delivery') { holding = false; audio.start('menu'); }
    }
    if (!wasFeeding && game.feeding > 0) audio.start('menu');
    updateHud();
  }
  if (mode !== 'paused') { for (const effect of effects) effect.life -= dt; effects = effects.filter(e => e.life > 0); juice.update(dt, game, mode === 'playing'); }
  if (now > toastUntil) $('toast').classList.add('hidden');
  audio.update(animation);
  if (mode !== 'paused' || needsDraw) {
    drawWorld(ctx, game, mode, reducedMotion && mode === 'menu' ? 0 : animation, prefs.outfit, effects, reducedMotion, juice.view());
    needsDraw = false;
  }
}
new Phaser.Game({
  type: Phaser.AUTO, parent: 'phaser-effects', width: WORLD.width, height: WORLD.height, transparent: true,
  audio: { noAudio: true },
  scene: {
    create() {
      phaserScene = this;
      const texture = this.textures.createCanvas('bubble', 12, 12), c = texture.context;
      c.strokeStyle = '#efffe8'; c.lineWidth = 1.5; c.beginPath(); c.arc(6, 6, 4, 0, Math.PI * 2); c.stroke(); texture.refresh();
      this.bubbles = this.add.particles(0, 0, 'bubble', { speed: { min: 18, max: 70 }, angle: { min: 190, max: 350 }, gravityY: -35, lifespan: 550, alpha: { start: .9, end: 0 }, scale: { start: 1, end: .3 }, emitting: false });
    },
    update(now) { frame(now); }
  }
});
