import { readProgress, applyAttempt } from './progress.js';

const STORAGE_KEY = 'pelican-v1', ATTEMPT_PREFIX = `${STORAGE_KEY}-attempt:`;

export function isProgressKey(key) {
  return key === STORAGE_KEY || Boolean(key?.startsWith(ATTEMPT_PREFIX));
}

/** Replay the attempt ledger; storage access failures propagate to the caller. */
export function readStoredProgress(storage = localStorage) {
  const progress = readProgress(storage.getItem(STORAGE_KEY));
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (!key?.startsWith(ATTEMPT_PREFIX)) continue;
    try { applyAttempt(progress, JSON.parse(storage.getItem(key))); } catch { /* Ignore malformed ledger entries. */ }
  }
  return progress;
}

/** Startup remains playable without storage; explicit saves report errors separately. */
export function restoreProgress() {
  let prefs;
  try { prefs = readStoredProgress(); } catch { prefs = readProgress(); }
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs)); } catch { /* A later explicit save will report failure. */ }
  return prefs;
}

/** Merge only the changed preference into the latest stored progress. Throws on failure. */
export function saveSetting(key, value, storage = localStorage) {
  const latest = readStoredProgress(storage);
  latest[key] = value;
  storage.setItem(STORAGE_KEY, JSON.stringify(latest));
  return latest;
}

/** Keep the ledger entry even if the snapshot write fails, so retries remain idempotent. */
export function saveAttempt(attempt, storage = localStorage) {
  storage.setItem(ATTEMPT_PREFIX + attempt.id, JSON.stringify(attempt));
  const latest = readStoredProgress(storage);
  storage.setItem(STORAGE_KEY, JSON.stringify(latest));
  return latest;
}
