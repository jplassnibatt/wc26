import { useLanguage } from '../i18n/LanguageContext';

// The dock is a plain flex child at the bottom of the app-shell (see .app /
// .app-main in App.css) — NOT position:fixed. Because it lives in normal flow it
// can't mis-anchor on iOS and the keyboard simply overlays it, so the old
// visualViewport/focusout keyboard-hiding workaround is no longer needed.
export default function BottomNav({ active, onNavigate }) {
  const { t } = useLanguage();

  const tabs = [
    { id: 'schedule', label: t('navSchedule'), icon: '🏆' },
    { id: 'teams', label: t('navTeams'), icon: '🌍' },
    { id: 'bets', label: t('navBets'), icon: '🎯' },
    { id: 'bracket', label: t('navBracket'), icon: '🗂️' },
  ];

  return (
    <nav className="bottom-nav">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`bottom-nav__tab ${active === tab.id ? 'bottom-nav__tab--active' : ''}`}
          aria-current={active === tab.id ? 'page' : undefined}
          onClick={() => onNavigate(tab.id)}
        >
          <span className="bottom-nav__icon">{tab.icon}</span>
          <span className="bottom-nav__label">{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}
