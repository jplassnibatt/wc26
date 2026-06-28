import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../i18n/LanguageContext';
import { useModalA11y } from '../hooks/useModalA11y';

const toMs = (ts) => (ts?.toMillis ? ts.toMillis() : (ts ? new Date(ts).getTime() : 0));

function timeAgo(ms, t) {
  if (!ms) return '';
  const diff = Date.now() - ms;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return t('notifNow');
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

export default function NotificationCenter() {
  const { profile, markNotifications } = useAuth();
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const panelRef = useModalA11y({ active: open, onEscape: () => setOpen(false) });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDocs(
          query(collection(db, 'notifications'), orderBy('createdAt', 'desc'), limit(50))
        );
        if (!cancelled) setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch { /* feed not readable yet — show nothing */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const clearedAt = profile?.notificationsClearedAt || 0;
  const seenAt = profile?.notificationsSeenAt || 0;
  const visible = items.filter((n) => toMs(n.createdAt) > clearedAt);
  const unread = items.filter((n) => toMs(n.createdAt) > seenAt).length;

  const openPanel = () => {
    setOpen(true);
    if (unread > 0) markNotifications({ seenAt: Date.now() });
  };

  const handleClear = () => {
    markNotifications({ clearedAt: Date.now() });
  };

  // Tapping a feed item jumps to its target page (same #hash deep links as the
  // push notifications). App.jsx's hashchange listener does the actual routing.
  const handleItemClick = (url) => {
    setOpen(false);
    if (!url) return;
    const i = url.indexOf('#');
    const hash = i >= 0 ? url.slice(i) : '';
    if (!hash) return;
    if (window.location.hash === hash) {
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    } else {
      window.location.hash = hash;
    }
  };

  return (
    <>
      <button
        type="button"
        className="notif-bell"
        onClick={() => (open ? setOpen(false) : openPanel())}
        aria-label={t('notifTitle')}
        aria-expanded={open}
      >
        🔔
        {unread > 0 && (
          <span className="notif-bell__badge" aria-label={`${unread}`}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="notif-overlay" onClick={() => setOpen(false)} />
          <div
            className="notif-panel"
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={t('notifTitle')}
          >
            <div className="notif-panel__head">
              <span className="notif-panel__title">{t('notifTitle')}</span>
              {visible.length > 0 && (
                <button type="button" className="notif-panel__clear" onClick={handleClear}>
                  {t('notifClear')}
                </button>
              )}
            </div>

            {visible.length === 0 ? (
              <p className="notif-panel__empty">{t('notifEmpty')}</p>
            ) : (
              <ul className="notif-panel__list">
                {visible.map((n) => {
                  const i = (n.url || '').indexOf('#');
                  const hasLink = i >= 0 && n.url.slice(i).length > 1;
                  return (
                    <li
                      key={n.id}
                      className={`notif-item ${n.type === 'release' ? 'notif-item--release' : ''} ${hasLink ? 'notif-item--link' : ''}`}
                      role={hasLink ? 'button' : undefined}
                      tabIndex={hasLink ? 0 : undefined}
                      onClick={hasLink ? () => handleItemClick(n.url) : undefined}
                      onKeyDown={hasLink ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleItemClick(n.url); }
                      } : undefined}
                    >
                      {n.type === 'release' && (
                        <span className="notif-item__tag">🆕 {t('notifRelease')}</span>
                      )}
                      <span className="notif-item__title">{n.title}</span>
                      {n.body && <span className="notif-item__body">{n.body}</span>}
                      <span className="notif-item__time">{timeAgo(toMs(n.createdAt), t)}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </>
  );
}
