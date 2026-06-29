import { useState, useCallback, useRef, useEffect, Suspense } from 'react';
import BottomNav from './components/BottomNav';
import Schedule from './pages/Schedule';
import MyMatches from './pages/MyMatches';
import Teams from './pages/Teams';
import Bets from './pages/Bets';
import Bracket from './pages/Bracket';
import HamburgerMenu from './components/HamburgerMenu';
import NotificationCenter from './components/NotificationCenter';
import PoolSelector from './components/PoolSelector';
import PoolManager from './components/PoolManager';
import AuthScreen from './components/AuthScreen';
import InstallBanner from './components/InstallBanner';
import { useFavorites } from './hooks/useFavorites';
import { useLanguage } from './i18n/LanguageContext';
import { useAuth } from './hooks/useAuth';
import lazyWithReload from './utils/lazyWithReload';
import logo from './assets/logo.png';
import './App.css';

// Lazy-loaded pages — TeamProfile + Admin pull in the 48 team files / player
// index, so deferring them (and the rarely-first Rules/Missing) keeps the
// initial bundle light. lazyWithReload recovers from stale chunks after a deploy.
const TeamProfile = lazyWithReload(() => import('./pages/TeamProfile'));
const Admin = lazyWithReload(() => import('./pages/Admin'));
const Rules = lazyWithReload(() => import('./pages/Rules'));
const Missing = lazyWithReload(() => import('./pages/Missing'));

const ADMIN_UID = import.meta.env.VITE_ADMIN_UID;

// Pages reachable via a #hash deep link (notification targets). 'admin' is gated
// separately on isAdmin; 'team' needs an iso and is reached in-app, not by hash.
const HASH_PAGES = new Set(['schedule', 'bracket', 'my-matches', 'teams', 'bets', 'pools', 'rules']);

export default function App() {
  const [page, setPage] = useState('schedule');
  const [animClass, setAnimClass] = useState('page-enter-done');
  const [teamIso, setTeamIso] = useState(null);
  // A specific match to focus (from a "#match-<id>" notification deep link).
  const [focusMatch, setFocusMatch] = useState(null);
  const clearFocusMatch = useCallback(() => setFocusMatch(null), []);
  const prevPageRef = useRef('schedule');
  const mainRef = useRef(null); // the app-shell scroll container (<main>)
  const { favorites, toggleFavorite, isFavorite } = useFavorites();
  const { t } = useLanguage();
  const { user, profile, loading } = useAuth();
  const isAdmin = user?.uid && user.uid === ADMIN_UID;

  const navigate = useCallback((newPage) => {
    // Re-tapping the tab you're already on scrolls back to the top.
    if (newPage === page) {
      mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    // Silent redirect for non-admin trying to access admin
    if (newPage === 'admin' && !isAdmin) {
      return;
    }
    setAnimClass('page-exit');
    setTimeout(() => {
      setPage(newPage);
      mainRef.current?.scrollTo({ top: 0 }); // new page starts at the top
      setAnimClass('page-enter');
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setAnimClass('page-enter-done');
        });
      });
    }, 150);
  }, [page, isAdmin]);

  const navigateToTeam = useCallback((iso) => {
    prevPageRef.current = page;
    setTeamIso(iso);
    setAnimClass('page-exit');
    setTimeout(() => {
      setPage('team');
      mainRef.current?.scrollTo({ top: 0 });
      setAnimClass('page-enter');
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setAnimClass('page-enter-done');
        });
      });
    }, 150);
  }, [page]);

  const navigateBackFromTeam = useCallback(() => {
    navigate(prevPageRef.current);
  }, [navigate]);

  // Hash-based deep links — used by notification clicks (e.g. /#bets) so a tapped
  // push lands on the relevant page instead of just opening the home screen.
  useEffect(() => {
    const handleHash = () => {
      const target = window.location.hash.replace(/^#/, '');
      if (!target) return;
      if (target === 'admin') {
        if (isAdmin) setPage('admin');
        return;
      }
      // "#match-<id>" → open the betting page focused on that match.
      const mMatch = /^match-(\d+)$/.exec(target);
      if (mMatch) {
        setPage('bets');
        setFocusMatch(Number(mMatch[1]));
        return;
      }
      if (HASH_PAGES.has(target)) setPage(target);
    };
    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, [isAdmin]);

  // The service worker posts here when a background notification is clicked while
  // a window is already open. Apply the target's hash → the listener above routes.
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const onMessage = (e) => {
      if (e.data?.type !== 'notif-nav' || !e.data.url) return;
      const i = e.data.url.indexOf('#');
      const hash = i >= 0 ? e.data.url.slice(i) : '';
      if (hash && window.location.hash !== hash) window.location.hash = hash;
      else if (hash) window.dispatchEvent(new HashChangeEvent('hashchange'));
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, []);

  if (loading) {
    return (
      <div className="app">
        <div className="app-loading">
          <img src={logo} alt="Mundial 2026" className="app-header__logo" />
          <span className="app-loading__text">⚽</span>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header__content">
          <div className="app-header__side app-header__side--left">
            {profile?.nickname && <HamburgerMenu onNavigate={navigate} />}
          </div>
          <div className="app-header__brand">
            <img src={logo} alt="Mundial 2026" className="app-header__logo" />
            <h1 className="app-header__title">
              <span className="app-header__mundial">{t('appTitle')}</span>{' '}
              <span className="app-header__year">{t('appYear')}</span>
            </h1>
          </div>
          <div className="app-header__side app-header__side--right">
            {profile?.nickname && <NotificationCenter />}
          </div>
        </div>
        {profile?.nickname && (
          <PoolSelector onManagePools={() => navigate('pools')} />
        )}
      </header>

      {!profile || !profile.nickname ? (
        <AuthScreen />
      ) : (
        <>
          <main className="app-main" ref={mainRef}>
            <div className={`page-wrapper ${animClass}`}>
              <Suspense fallback={<div className="app-loading__text" style={{ textAlign: 'center', padding: 40 }}>⚽</div>}>
                {page === 'schedule' && <Schedule onTeamClick={navigateToTeam} />}
                {page === 'my-matches' && (
                  <MyMatches favorites={favorites} onNavigate={navigate} onTeamClick={navigateToTeam} />
                )}
                {page === 'teams' && (
                  <Teams
                    favorites={favorites}
                    toggleFavorite={toggleFavorite}
                    isFavorite={isFavorite}
                    onTeamClick={navigateToTeam}
                  />
                )}
                {page === 'bets' && <Bets onTeamClick={navigateToTeam} focusMatch={focusMatch} onFocusHandled={clearFocusMatch} />}
                {page === 'bracket' && <Bracket onTeamClick={navigateToTeam} />}
                {page === 'team' && (
                  <TeamProfile
                    iso={teamIso}
                    onBack={navigateBackFromTeam}
                    onTeamClick={navigateToTeam}
                  />
                )}
                {page === 'pools' && <PoolManager />}
                {page === 'rules' && <Rules />}
                {page === 'missing' && <Missing />}
                {page === 'admin' && isAdmin && <Admin />}
              </Suspense>
            </div>
          </main>

          <InstallBanner />

          <BottomNav
            active={page === 'team' ? prevPageRef.current : page}
            onNavigate={navigate}
          />
        </>
      )}
    </div>
  );
}
