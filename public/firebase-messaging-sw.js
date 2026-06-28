/* Firebase Cloud Messaging service worker.
 * Receives the Firebase config via query params on the registration URL, so we
 * don't have to hardcode/commit it. Messages are sent data-only; this worker
 * builds the visible notification (works on Android, desktop, and installed
 * iOS PWAs). */
/* eslint-disable no-undef */
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

const params = new URLSearchParams(self.location.search);
firebase.initializeApp({
  apiKey: params.get('apiKey'),
  authDomain: params.get('authDomain'),
  projectId: params.get('projectId'),
  messagingSenderId: params.get('messagingSenderId'),
  appId: params.get('appId'),
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const d = payload.data || {};
  self.registration.showNotification(d.title || 'Mundial 2026', {
    body: d.body || '',
    icon: '/icon-192.png',
    badge: '/favicon-32.png',
    tag: d.tag || undefined,
    data: { url: d.url || '/' },
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (wins) => {
      // Reuse an open tab/PWA window: focus it and tell the running app to route
      // to the notification's target (App.jsx applies the hash). Without this the
      // window just regains focus on whatever page it was already showing.
      for (const w of wins) {
        if ('focus' in w) {
          w.postMessage({ type: 'notif-nav', url });
          try { await w.focus(); } catch { /* focus can reject if not allowed */ }
          // navigate() also works when the window is SW-controlled (cold tabs).
          if ('navigate' in w) { try { await w.navigate(url); } catch { /* ignore */ } }
          return;
        }
      }
      // No window open — open a fresh one straight at the target URL.
      return clients.openWindow(url);
    })
  );
});
