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
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if ('focus' in w) return w.focus();
      }
      return clients.openWindow(url);
    })
  );
});
