// Registers the offline fallback (public/sw.js) on the production site only: the dev server keeps no caches.
export function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator) || location.protocol !== 'https:') return;
  addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(e => console.warn('service worker', e)); }, {once: true});
}
