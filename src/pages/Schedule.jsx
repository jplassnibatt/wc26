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

// Scroll helper that accounts for sticky header + sticky phase filter heights.
function scrollElementToTopWithOffset(el, offset = 0, smooth = true) {
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const absoluteTop = window.scrollY + rect.top;
  const top = Math.max(0, absoluteTop - offset);
  window.scrollTo({ top, behavior: smooth ? 'smooth' : 'auto' });
}

export default function Schedule({ onTeamClick }) {
  const [activePhase, setActivePhase] = useState('group');
  const { t } = useLanguage();
  const cachedScores = useCachedScores();

  // refs for the list container and to avoid repeated auto-scrolls
  const listRef = useRef(null);
  const scrolledRef = useRef(false);

  const translatedPhases = useMemo(
    () => schedule.phases.map((p) => ({ ...p, name: t(`phase.${p.id}`) })),
    [t]
  );

  const phase = schedule.phases.find((p) => p.id === activePhase);

  // Compute the "next" match id for the currently visible phase
  const nextMatchId = useMemo(() => getNextMatchId(phase?.matches || []), [phase]);

  const matchesByDate = useMemo(
    () => (phase ? groupMatchesByDate(phase.matches) : {}),
    [phase]
  );

  // reset scrolled flag when the visible phase or next match changes so auto-scroll can re-run
  useEffect(() => {
    scrolledRef.current = false;
  }, [activePhase, nextMatchId]);

  // Auto-scroll to today's date block (viewer timezone). If none, scroll to the
  // first upcoming date (kickoff >= now). Uses a small offset so the sticky header
  // and phase filter do not cover the entry.
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

    const run = () => {
      // 1) Try to find today's date key in the same format used by groupMatchesByDate (YYYY-MM-DD in viewer timezone)
      const now = new Date();
      const y = now.getFullYear();
      const mo = String(now.getMonth() + 1).padStart(2, '0');
      const da = String(now.getDate()).padStart(2, '0');
      const todayKey = `${y}-${mo}-${da}`;

      if (matchesByDate[todayKey]) {
        const el = root.querySelector(`[data-date="${todayKey}"]`);
        if (el) {
          scrollElementToTopWithOffset(el, totalOffset, true);
          scrolledRef.current = true;
          return;
        }
      }

      // 2) Fallback: find the first date with an upcoming match (kickoff >= now)
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

      // 3) If none upcoming, use the first available date
      if (!targetDateKey && dateKeys.length > 0) {
        targetDateKey = dateKeys[0];
      }

      if (targetDateKey) {
        const el = root.querySelector(`[data-date="${targetDateKey}"]`);
        if (el) {
          scrollElementToTopWithOffset(el, totalOffset, true);
          scrolledRef.current = true;
        }
      }
    };

    // Defer the measurement/scroll to after paint/layout to make scroll positioning reliable.
    requestAnimationFrame(() => requestAnimationFrame(run));
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