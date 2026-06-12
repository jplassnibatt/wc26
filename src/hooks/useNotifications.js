import { useState, useEffect, useCallback } from 'react';
import { getToken, onMessage } from 'firebase/messaging';
import { doc, setDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { messagingPromise, db, firebaseConfig } from '../firebase';
import { useAuth } from './useAuth';
import { logError } from '../utils/logError';

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;
// This device's registered FCM token; presence = notifications on here.
const TOKEN_KEY = 'wc26-notif-token';

const storedToken = () => {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
};

// Pass the Firebase config to the service worker via its registration URL so it
// can init without a committed config file.
const SW_QS = new URLSearchParams({
  apiKey: firebaseConfig.apiKey || '',
  authDomain: firebaseConfig.authDomain || '',
  projectId: firebaseConfig.projectId || '',
  messagingSenderId: firebaseConfig.messagingSenderId || '',
  appId: firebaseConfig.appId || '',
}).toString();

const initialPermission = () =>
  typeof Notification !== 'undefined' ? Notification.permission : 'default';

export function useNotifications() {
  const { user, profile } = useAuth();
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState(initialPermission);
  const [busy, setBusy] = useState(false);
  const [enabled, setEnabled] = useState(() => !!storedToken());

  // Reconcile: a device with permission granted whose token is listed in the
  // user doc but that lost (or never had) the local marker — e.g. subscribed
  // on a build that didn't store it — shows as ON without re-prompting.
  // getToken with granted permission never prompts and returns the same token.
  useEffect(() => {
    if (!supported || enabled || !Array.isArray(profile?.fcmTokens) || profile.fcmTokens.length === 0) return undefined;
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return undefined;
    let cancelled = false;
    (async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (!reg?.active) return;
        const m = await messagingPromise;
        if (!m || !VAPID_KEY) return;
        const token = await getToken(m, { vapidKey: VAPID_KEY, serviceWorkerRegistration: reg });
        if (cancelled || !token || !profile.fcmTokens.includes(token)) return;
        try { localStorage.setItem(TOKEN_KEY, token); } catch { /* storage unavailable */ }
        setEnabled(true);
      } catch { /* reconcile is best-effort */ }
    })();
    return () => { cancelled = true; };
  }, [supported, enabled, profile]);

  useEffect(() => {
    let mounted = true;
    messagingPromise.then((m) => {
      if (mounted) setSupported(!!m && !!VAPID_KEY && 'Notification' in window);
    });
    return () => { mounted = false; };
  }, []);

  // Show foreground messages (data-only) as notifications too.
  useEffect(() => {
    let unsub;
    messagingPromise.then((m) => {
      if (!m) return;
      unsub = onMessage(m, (payload) => {
        const d = payload.data || {};
        if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
        const title = d.title || 'Mundial 2026';
        const opts = { body: d.body || '', icon: '/icon-192.png' };
        try {
          new Notification(title, opts);
        } catch {
          // iOS PWAs don't support the Notification constructor — show it via
          // the service worker registration (created in enable()) instead.
          navigator.serviceWorker?.getRegistration()
            .then((reg) => reg?.showNotification(title, opts))
            .catch(() => { /* no registration — nothing to show */ });
        }
      });
    });
    return () => { if (unsub) unsub(); };
  }, []);

  // Returns null on success, an error string on failure (for the UI to show).
  const enable = useCallback(async () => {
    if (!user) return null;
    setBusy(true);
    try {
      // The permission request MUST be the first thing in the tap handler:
      // iOS discards the transient user activation across awaited I/O and then
      // rejects the request without ever showing the dialog.
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') { setBusy(false); return null; }

      const m = await messagingPromise;
      if (!m || !VAPID_KEY) { setBusy(false); return 'messaging unavailable'; }

      const reg = await navigator.serviceWorker.register(`/firebase-messaging-sw.js?${SW_QS}`);
      // iOS: getToken against an installing worker can fail — wait until active.
      await navigator.serviceWorker.ready;
      const token = await getToken(m, { vapidKey: VAPID_KEY, serviceWorkerRegistration: reg });
      if (!token) { setBusy(false); return 'no token'; }
      await setDoc(doc(db, 'users', user.uid), { fcmTokens: arrayUnion(token) }, { merge: true });
      try { localStorage.setItem(TOKEN_KEY, token); } catch { /* storage unavailable */ }
      setEnabled(true);
      setBusy(false);
      return null;
    } catch (e) {
      logError('NOTIF_ENABLE_FAILED', 'Falha ao ativar notificações', { e: String(e), userId: user.uid });
      setBusy(false);
      return String(e?.message || e);
    }
  }, [user]);

  // Stops pushes to this device by removing its token from the user doc — the
  // sender only targets tokens listed there. The browser permission stays
  // granted, so re-enabling never re-prompts; getToken returns the same token.
  const disable = useCallback(async () => {
    if (!user) return;
    setBusy(true);
    try {
      const token = storedToken();
      if (token) {
        await setDoc(doc(db, 'users', user.uid), { fcmTokens: arrayRemove(token) }, { merge: true });
      }
      try { localStorage.removeItem(TOKEN_KEY); } catch { /* storage unavailable */ }
      setEnabled(false);
    } catch (e) {
      logError('NOTIF_DISABLE_FAILED', 'Falha ao desativar notificações', { e: String(e) });
    }
    setBusy(false);
  }, [user]);

  return { supported, permission, busy, enabled, enable, disable };
}
