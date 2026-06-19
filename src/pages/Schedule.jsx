import { useState, useMemo, useEffect, useRef } from 'react';
import schedule from '../data/schedule.json';
import PhaseFilter from '../components/PhaseFilter';
import MatchCard from '../components/MatchCard';
import { useLanguage } from '../i18n/LanguageContext';
import TimezoneNote from '../components/TimezoneNote';
import { compareKickoff, groupMatchesByDate } from '../utils/matchOrder';
import { kickoffMs } from '../utils/matchTime';
import { useCachedScores } from '../hooks/useLiveScores';

function getNextMatchId(matches) {
  const now = Date.now();
  for (const match of [...matches].sort(compareKickoff)) {
    const ms = kickoffMs(match);
    if (ms != null && ms > now) return match.id;
  }
  return null;
}

function absoluteTopOf(el) {
  const rect = el.getBoundingClientRect();
  return window.scrollY + rect.top;
}

// Scroll so element's top ends up `offset` pixels below the viewport top.
// Then run a short corrective loop to re-align if layout shifts happen.
function alignElementToOffset(el, offset = 0, smooth = true) {
  if (!el) return;
  // initial aligned top (document coordinates)
  const absoluteTop = absoluteTopOf(el);
  const targetScrollTop = Math.max(0, Math.round(absoluteTop - offset));
  window.scrollTo({ top: targetScrollTop, behavior: smooth ? 'smooth' : 'auto' });

  // corrective loop: re-check element position after short delays and correct if needed.
  let attempts = 0;
  const maxAttempts = 8;
  const tolerance = 4; // px
  const check = () => {
    const rect = el.getBoundingClientRect();
    const currentTop = rect.top;
    const delta = currentTop - offset;
    if (Math.abs(delta) > tolerance && attempts < maxAttempts) {
      // scroll by delta to place element at desired offset
      // use 'auto' for corrections to avoid long smooth animations stacking
      window.scrollBy({ top: Math.round(delta), behavior: 'auto' });
      attempts += 1;
      // next check after a small delay to let layout settle
      setTimeout(check, 80);
    }
  };
  // start checks after a bit of time for images/fonts to settle
  setTimeout(check, 120);
}

export default function Schedule({ onTeamClick }) {
  const [activePhase, setActivePhase] = useState('group');
  const { t } = useLanguage();
  const cachedScores = useCachedScores();

  const listRef = useRef(null);
  const scrolledRef = useRef(false);

  const translatedPhases = useMemo(
    () => schedule.phases.map((p) => ({ ...p, name: t(`phase.${p.id}`) })),
    [t]
  );

  const phase = schedule.phases.find((p) => p.id === activePhase);

  // Compute nextMatchId from currently visible phase matches
  const nextMatchId = useMemo(() => getNextMatchId(phase?.matches || []), [phase]);

  const matchesByDate = useMemo(
    () => (phase ? groupMatchesByDate(phase.matches) : {}),
    [phase]
  );

  // Reset scrolled flag when phase or nextMatchId changes so auto-scroll runs again.
  useEffect(() => {
    scrolledRef.current = false;
  }, [activePhase, nextMatchId]);

  useEffect(() => {
    if (scrolledRef.current) return;
    if (!matchesByDate || Object.keys(matchesByDate).length === 0) return;

    const root = listRef.current;
    if (!root) return;

    // compute offsets: header + phase filter + small gap
    const headerEl = document.querySelector('.app-header');
    const phaseFilterEl = document.querySelector('.phase-filter');
    const headerHeight = headerEl ? headerEl.getBoundingClientRect().height : 0;
    const phaseFilterHeight = phaseFilterEl ? phaseFilterEl.getBoundingClientRect().height : 0;
    const gap = 8;
    const totalOffset = headerHeight + phaseFilterHeight + gap;

    let attempts = 0;
    const maxAttempts = 16;

    const tryFindAndScroll = () => {
      if (scrolledRef.current) return;

      // 0) Global badge search: if the UI shows the Next Match badge anywhere, prefer that exact card.
      const globalBadge = document.querySelector('.match-card__next-badge');
      if (globalBadge) {
        const card = globalBadge.closest('.match-card');
        if (card) {
          alignElementToOffset(card, totalOffset, true);
          scrolledRef.current = true;
          return;
        }
      }

      // 1) Exact element lookup by computed nextMatchId (if available)
      if (nextMatchId != null) {
        const matchEl = root.querySelector(`[data-match-id="${nextMatchId}"]`);
        if (matchEl) {
          alignElementToOffset(matchEl, totalOffset, true);
          scrolledRef.current = true;
          return;
        }
      }

      // 2) Look for a local badge inside the list
      const badgeEl = root.querySelector('.match-card__next-badge');
      if (badgeEl) {
        const card = badgeEl.closest('.match-card');
        if (card) {
          alignElementToOffset(card, totalOffset, true);
          scrolledRef.current = true;
          return;
        }
      }

      // 3) Class-based fallback inside the list
      const nextClassEl = root.querySelector('.match-card--next');
      if (nextClassEl) {
        alignElementToOffset(nextClassEl, totalOffset, true);
        scrolledRef.current = true;
        return;
      }

      // 4) Retry a few frames while DOM settles
      attempts++;
      if (attempts < maxAttempts) {
        requestAnimationFrame(tryFindAndScroll);
        return;
      }

      // 5) Fallback: today's block (viewer timezone)
      const now = new Date();
      const y = now.getFullYear();
      const mo = String(now.getMonth() + 1).padStart(2, '0');
      const da = String(now.getDate()).padStart(2, '0');
      const todayKey = `${y}-${mo}-${da}`;

      if (matchesByDate[todayKey]) {
        const el = root.querySelector(`[data-date="${todayKey}"]`);
        if (el) {
          alignElementToOffset(el, totalOffset, true);
          scrolledRef.current = true;
          return;
        }
      }

      // 6) Final fallback: first upcoming date (kickoff >= now) or first date
      const nowMs = Date.now();
      const dateKeys = Object.keys(matchesByDate).sort();
      let targetDateKey = null;
      for (const dateKey of dateKeys) {
        const matches = matchesByDate[dateKey];
        for (const match of matches) {
          const ms = kickoffMs(match);
          if (ms != null && ms >= nowMs) {
            targetDateKey = dateKey;
            break;
          }
        }
        if (targetDateKey) break;
      }
      if (!targetDateKey && dateKeys.length > 0) targetDateKey = dateKeys[0];

      if (targetDateKey) {
        const el = root.querySelector(`[data-date="${targetDateKey}"]`);
        if (el) {
          alignElementToOffset(el, totalOffset, true);
          scrolledRef.current = true;
        }
      }
    };

    // wait a couple of paints for DOM & layout to stabilize
    requestAnimationFrame(() => requestAnimationFrame(tryFindAndScroll));
  }, [matchesByDate, nextMatchId]);

  return (
    <div className="schedule">
      <PhaseFilter
        phases={translatedPhases}
        active={activePhase}
        onSelect={setActivePhase}
      />

      <TimezoneNote />

      <div className="schedule__list" ref={listRef}>
        {Object.entries(matchesByDate).map(([date, matches]) => {
          const d = new Date(date + 'T00:00:00');
          const label = d.toLocaleDateString(t('dateLocale'), {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          });

          return (
            <div key={date} className="schedule__day" data-date={date}>
              <h3 className="schedule__day-label">{label}</h3>
              {matches.map((match, i) => (
                <MatchCard
                  key={match.id}
                  match={match}
                  matchScore={cachedScores[String(match.id)]}
                  isNext={match.id === nextMatchId && activePhase === 'group'}
                  showCalButton
                  onTeamClick={onTeamClick}
                  index={i}
                />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}