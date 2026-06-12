import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '../i18n/LanguageContext';

// iOS Safari anchors position:fixed elements to the visual viewport, so the
// keyboard pushes the nav to the middle of the screen, over the content.
// While the keyboard is open the nav is useless anyway — hide it.
function useKeyboardOpen() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return undefined;
    const onResize = () => setOpen(window.innerHeight - vv.height > 150);
    vv.addEventListener('resize', onResize);
    return () => vv.removeEventListener('resize', onResize);
  }, []);

  return open;
}

export default function BottomNav({ active, onNavigate, favoriteCount }) {
  const { t } = useLanguage();
  const keyboardOpen = useKeyboardOpen();

  const tabs = [
    { id: 'schedule', label: t('navSchedule'), icon: '🏆' },
    { id: 'teams', label: t('navTeams'), icon: '🌍' },
    { id: 'bets', label: t('navBets'), icon: '🎯' },
    { id: 'my-matches', label: t('navMyMatches'), icon: '⭐' },
  ];

  return (
    <nav className={`bottom-nav ${keyboardOpen ? 'bottom-nav--keyboard-open' : ''}`}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`bottom-nav__tab ${active === tab.id ? 'bottom-nav__tab--active' : ''}`}
          onClick={() => onNavigate(tab.id)}
        >
          <span className="bottom-nav__icon">{tab.icon}</span>
          {tab.id === 'my-matches' && favoriteCount > 0 && (
            <motion.span
              className="bottom-nav__badge"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              key={favoriteCount}
            >
              {favoriteCount}
            </motion.span>
          )}
          <span className="bottom-nav__label">{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}
