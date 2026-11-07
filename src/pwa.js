import { Capacitor } from '@capacitor/core';
import { t } from './i18n.js';

/** Bind install/update controls once; return the action for a safe menu frame. */
export function setupPwa(toast) {
  const $ = id => document.getElementById(id);
  function text(id, value) { if ($(id).textContent !== String(value)) $(id).textContent = value; }
  let installPrompt, registration, applyingUpdate = false, reloadReady = false;
  const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  $('install').hidden = Capacitor.isNativePlatform() || standalone();
  window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installPrompt = event; $('install').hidden = false; });
  window.addEventListener('appinstalled', () => { installPrompt = null; $('install').hidden = true; });
  $('install').onclick = async () => {
    if (!installPrompt) { $('install-help').showModal(); return; }
    const prompt = installPrompt; installPrompt = null;
    try { await prompt.prompt(); } catch { $('install-help').showModal(); }
  };
  $('install-help').querySelector('button').onclick = () => $('install-help').close();
  function updateStatus() {
    const downloading = Boolean(registration?.installing);
    $('update').disabled = downloading;
    text('update', reloadReady || registration?.waiting ? t('updateReady') : downloading ? t('updateLoading') : t('update'));
  }
  $('update').onclick = async () => {
    if (reloadReady) { location.reload(); return; }
    if (registration?.waiting) { applyingUpdate = true; registration.waiting.postMessage({ type: 'SKIP_WAITING' }); return; }
    if (!registration) { toast(t('offlinePreparing')); return; }
    $('update').disabled = true; text('update', t('updateChecking'));
    try {
      await registration.update();
      // update() finishes the check, not the installation of the downloaded files.
      if (registration.installing) toast(t('updateLoaded'));
      else if (registration.waiting) toast(t('updateNow'));
      else toast(t('upToDate'));
    } catch { toast(t('updateFailed')); }
    finally { updateStatus(); }
  };
  if (import.meta.env.PROD && !Capacitor.isNativePlatform() && 'serviceWorker' in navigator) {
    const hadController = Boolean(navigator.serviceWorker.controller);
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (applyingUpdate) location.reload();
      else if (hadController) { reloadReady = true; updateStatus(); }
    });
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { updateViaCache: 'none' }).then(reg => {
      registration = reg; $('update').hidden = false;
      const watchDownload = () => {
        const worker = reg.installing; updateStatus();
        worker?.addEventListener('statechange', () => {
          updateStatus();
          if (worker.state === 'installed' && reg.waiting) toast(t('updateMenu'));
          if (worker.state === 'redundant') toast(t('updateUnavailable'));
        });
      };
      watchDownload(); reg.addEventListener('updatefound', watchDownload);
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) reg.update().catch(() => {});
      });
    }).catch(() => toast(t('offlineUnavailable')));
  }
  // The caller invokes this only in the menu, with no open dialog.
  return function applyPendingUpdate() {
    if (applyingUpdate) return;
    if (registration?.waiting) { applyingUpdate = true; registration.waiting.postMessage({ type: 'SKIP_WAITING' }); }
    else if (reloadReady) { applyingUpdate = true; location.reload(); }
  };
}
