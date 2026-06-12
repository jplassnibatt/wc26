import { useState } from 'react';
import * as Sentry from '@sentry/react';
import { useLanguage } from '../i18n/LanguageContext';
import { getTheme, setTheme } from '../theme';
import { useAuth } from '../hooks/useAuth';
import { usePools } from '../hooks/usePools';
import { useNotifications } from '../hooks/useNotifications';

const THEME_OPTIONS = [
  { value: 'system', icon: '🌗', labelKey: 'themeSystem' },
  { value: 'light', icon: '☀️', labelKey: 'themeLight' },
  { value: 'dark', icon: '🌙', labelKey: 'themeDark' },
];

export default function HamburgerMenu({ onNavigate }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [theme, setThemeState] = useState(getTheme);
  const { t } = useLanguage();
  const { user, profile, isAnonymous, signInWithGoogle, signOutUser } = useAuth();
  const { activePool } = usePools();
  const {
    supported: notifSupported,
    permission: notifPermission,
    busy: notifBusy,
    enabled: notifEnabled,
    enable: enableNotifs,
    disable: disableNotifs,
  } = useNotifications();
  const [linkingAccount, setLinkingAccount] = useState(false);
  const isAdmin = user?.uid && user.uid === import.meta.env.VITE_ADMIN_UID;

  const handleNav = (page) => {
    setOpen(false);
    onNavigate(page);
  };

  const handleShare = async () => {
    const code = activePool?.inviteCode;
    if (!code) return;

    const appUrl = window.location.origin + window.location.pathname;
    const text = t('shareMessage').replace('{code}', code).replace('{url}', appUrl);

    if (navigator.share) {
      try {
        await navigator.share({ text });
      } catch {
        // user cancelled share
      }
    } else {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <>
      <button
        className="hamburger-btn"
        onClick={() => setOpen(!open)}
        aria-label="Menu"
      >
        <span className={`hamburger-icon ${open ? 'hamburger-icon--open' : ''}`}>
          <span />
          <span />
          <span />
        </span>
      </button>

      {open && <div className="hamburger-overlay" onClick={() => setOpen(false)} />}

      <div className={`hamburger-menu ${open ? 'hamburger-menu--open' : ''}`}>
        <button className="hamburger-menu__close" onClick={() => setOpen(false)} aria-label="Close menu">
          ✕
        </button>
        {profile && (
          <div className="hamburger-menu__profile">
            <span className="hamburger-menu__avatar">{profile.nickname?.charAt(0).toUpperCase()}</span>
            <div>
              <span className="hamburger-menu__nick">{profile.nickname}</span>
              {activePool && (
                <span className="hamburger-menu__group">{activePool.name}</span>
              )}
            </div>
          </div>
        )}

        <nav className="hamburger-menu__nav">
          <button className="hamburger-menu__item" onClick={() => handleNav('pools')}>
            <span>🎱</span> {t('poolMyPools')}
          </button>
          {activePool && (
            <button className="hamburger-menu__item hamburger-menu__item--share" onClick={handleShare}>
              <span>📩</span> {copied ? t('copiedToClipboard') : t('inviteFriends')}
            </button>
          )}
          <button className="hamburger-menu__item" onClick={() => handleNav('rules')}>
            <span>📋</span> {t('navRules')}
          </button>
          <button className="hamburger-menu__item" onClick={() => handleNav('missing')}>
            <span>👻</span> {t('navMissing')}
          </button>
          {notifSupported && (
            <button
              className="hamburger-menu__item"
              onClick={async () => {
                if (notifEnabled) { disableNotifs(); return; }
                const err = await enableNotifs();
                if (err) alert(`${t('notifEnableFailed')}\n${err}`);
              }}
              disabled={notifBusy || notifPermission === 'denied'}
            >
              <span>{notifEnabled ? '🔕' : '🔔'}</span>{' '}
              {notifPermission === 'denied'
                ? t('notifBlocked')
                : notifBusy
                  ? t('saving')
                  : notifEnabled ? t('notifDisable') : t('notifEnable')}
            </button>
          )}
          {isAdmin && (
            <button className="hamburger-menu__item" onClick={() => handleNav('admin')}>
              <span>🔧</span> Admin
            </button>
          )}
        </nav>

        <div className="hamburger-menu__theme">
          <span className="hamburger-menu__theme-label">{t('themeTitle')}</span>
          <div className="hamburger-menu__theme-options" role="radiogroup" aria-label={t('themeTitle')}>
            {THEME_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                role="radio"
                aria-checked={theme === opt.value}
                className={`hamburger-menu__theme-btn ${theme === opt.value ? 'hamburger-menu__theme-btn--active' : ''}`}
                onClick={() => {
                  setTheme(opt.value);
                  setThemeState(opt.value);
                }}
              >
                <span>{opt.icon}</span> {t(opt.labelKey)}
              </button>
            ))}
          </div>
        </div>

        <div className="hamburger-menu__account">
          {isAnonymous ? (
            <button
              className="hamburger-menu__item hamburger-menu__item--link"
              onClick={async () => {
                setLinkingAccount(true);
                try {
                  await signInWithGoogle();
                } catch (err) {
                  console.error('Link error:', err);
                  const cancelled = err.code === 'auth/popup-closed-by-user'
                    || err.code === 'auth/cancelled-popup-request';
                  if (!cancelled) {
                    Sentry.captureException(err, {
                      tags: { flow: 'google-link' },
                      extra: { code: err.code, userAgent: navigator.userAgent },
                    });
                    alert(err.code === 'auth/popup-blocked' ? t('authPopupBlocked') : t('authGoogleError'));
                  }
                }
                setLinkingAccount(false);
              }}
              disabled={linkingAccount}
            >
              <span>🔗</span> {linkingAccount ? t('saving') : t('authLinkAccount')}
            </button>
          ) : (
            <>
              {profile?.email && (
                <div className="hamburger-menu__email">{profile.email}</div>
              )}
              <button
                className="hamburger-menu__item hamburger-menu__item--signout"
                onClick={async () => {
                  setOpen(false);
                  await signOutUser();
                }}
              >
                <span>🚪</span> {t('authSignOut')}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
