import { STAGES } from '../src/stages.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { currentLocale, localeFrom, setLocale, stageName, t } from '../src/i18n.js';

test('all supported locales provide player-facing dynamic copy and localized stage names', () => {
  const expectedTitles = { de: 'Schnabelglück', en: 'Happy Beak', es: 'Pico Feliz' };
  for (const [locale, title] of Object.entries(expectedTitles)) {
    setLocale(locale);
    assert.equal(currentLocale(), locale);
    assert.equal(t('title'), title);
    for (const [index, stage] of STAGES.entries()) assert.equal(stageName(index), stage.names[locale]);
    assert.equal(stageName(STAGES.length), '');
    for (const key of ['reasons.air', 'saved', 'saveFailed', 'settingsSaveFailed', 'updateReady', 'updateLoading', 'updateChecking', 'offlinePreparing', 'updateLoaded', 'updateNow', 'upToDate', 'updateFailed', 'updateMenu', 'updateUnavailable', 'offlineUnavailable']) assert.notEqual(t(key), key);
  }
  assert.equal(localeFrom('unsupported'), 'de');
  setLocale('de');
});
