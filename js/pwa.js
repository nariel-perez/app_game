/**
 * pwa.js — Controlador de instalación PWA y bloqueo de orientación horizontal
 */

(function () {
  let deferredPrompt = null;

  window.addEventListener('DOMContentLoaded', () => {
    const btnInstall = document.getElementById('btn-install-pwa');

    // Registrar Service Worker para soporte offline
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }

    // Capturar el evento de instalación de Chrome / Edge / Android
    window.addEventListener('beforeinstallprompt', e => {
      e.preventDefault();
      deferredPrompt = e;
      if (btnInstall) {
        btnInstall.classList.remove('hidden');
      }
    });

    if (btnInstall) {
      btnInstall.addEventListener('click', async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        await deferredPrompt.userChoice;
        deferredPrompt = null;
        btnInstall.classList.add('hidden');
      });
    }

    window.addEventListener('appinstalled', () => {
      deferredPrompt = null;
      if (btnInstall) {
        btnInstall.classList.add('hidden');
      }
    });

    // Intentar fijar orientación horizontal cuando se ejecuta como PWA instalada
    if (screen.orientation && typeof screen.orientation.lock === 'function') {
      if (window.matchMedia('(display-mode: standalone)').matches) {
        screen.orientation.lock('landscape').catch(() => {});
      }
    }
  });
})();
