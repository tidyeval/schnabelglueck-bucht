import test from 'node:test';
import assert from 'node:assert/strict';
import { readStoredProgress, saveAttempt, saveSetting } from '../src/storage.js';

test('a failed snapshot keeps the attempt recoverable and a retry credits it only once', () => {
  const entries = new Map();
  let failSnapshot = true;
  const storage = {
    get length() { return entries.size; },
    key: i => [...entries.keys()][i],
    getItem: key => entries.get(key) ?? null,
    setItem(key, value) {
      if (failSnapshot && key === 'pelican-bucht-test-v1') throw new Error('Storage full');
      entries.set(key, value);
    },
  };
  const attempt = { id: 'one', layout: 4, stage: 2, fish: 7, score: 80, endReason: 'complete' };
  assert.throws(() => saveAttempt(attempt, storage), /Storage full/);
  assert.equal(readStoredProgress(storage).totalFish, 7);
  failSnapshot = false;
  const saved = saveAttempt(attempt, storage);
  assert.equal(saved.totalFish, 7);
  assert.equal(saved.bests[2], 80);
  assert.equal(saved.completed, 3);
  assert.deepEqual(saved.attemptIds, ['one']);
  assert.deepEqual(saveAttempt(attempt, storage), saved);

  // A setting from an older tab must merge with the latest attempts and preferences.
  saveSetting('language', 'es', storage);
  saveAttempt({ ...attempt, id: 'two', fish: 3 }, storage);
  const updated = saveSetting('music', false, storage);
  assert.equal(updated.totalFish, 10);
  assert.equal(updated.language, 'es');
  assert.equal(updated.music, false);
  assert.deepEqual(updated.attemptIds, ['one', 'two']);
});

test('the test version does not read or change the original game progress', () => {
  const original = '{"record":987,"totalFish":99}';
  const entries = new Map([['pelican-v1', original], ['pelican-v1-attempt:old', '{"id":"old","fish":10}']]);
  const storage = {
    get length() { return entries.size; },
    key: i => [...entries.keys()][i],
    getItem: key => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value),
  };
  assert.equal(readStoredProgress(storage).totalFish, 0);
  saveAttempt({ id: 'test', layout: 4, stage: 0, fish: 3, score: 10, endReason: 'energy' }, storage);
  assert.equal(readStoredProgress(storage).totalFish, 3);
  assert.equal(entries.get('pelican-v1'), original);
  assert.equal(entries.get('pelican-v1-attempt:old'), '{"id":"old","fish":10}');
});
