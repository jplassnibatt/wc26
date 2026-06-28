import { useState, useMemo } from 'react';
import schedule from '../data/schedule.json';
import PhaseFilter from '../components/PhaseFilter';
import MatchCard from '../components/MatchCard';
import { useLanguage } from '../i18n/LanguageContext';
import TimezoneNote from '../components/TimezoneNote';
import { compareKickoff, groupMatchesByDate } from '../utils/matchOrder';
import { kickoffMs } from '../utils/matchTime';
import { useCachedScores } from '../hooks/useLiveScores';
import { useScrollToToday } from '../hooks/useScrollToToday';
import { resolveKnockout } from '../utils/knockout';
import { currentPhase } from '../utils/phases';

function getNextMatchId(matches) {
  const now = Date.now();
  for (const match of [...matches].sort(compareKickoff)) {
    const ms = kickoffMs(match);
    if (ms != null && ms > now) return match.id;
  }
  return null;
}

export default function Schedule({ onTeamClick }) {
  const [activePhase, setActivePhase] = useState(currentPhase);
  const { t } = useLanguage();
  const cachedScores = useCachedScores();
  // Fill knockout fixtures with the teams already certain from group results.
  const resolvedKO = useMemo(() => resolveKnockout(cachedScores), [cachedScores]);

  const translatedPhases = useMemo(
    () => schedule.phases.map((p) => ({ ...p, name: t(`phase.${p.id}`) })),
    [t]
  );

  const phase = schedule.phases.find((p) => p.id === activePhase);
  // "Today" / "next match" affordances apply while viewing the phase the
  // tournament is currently in (the default phase on open).
  const phaseIsCurrent = activePhase === currentPhase();
  const nextMatchId = useMemo(() => getNextMatchId(phase?.matches || []), [phase]);

  const matchesByDate = useMemo(
    () => (phase ? groupMatchesByDate(phase.matches) : {}),
    [phase]
  );

  // Land on today's fixtures (current phase only) and keep them pinned as the
  // live scores load in and shift the layout above today.
  const dayRefs = useScrollToToday(matchesByDate, phaseIsCurrent);

  return (
    <div className="schedule">
      <PhaseFilter
        phases={translatedPhases}
        active={activePhase}
        onSelect={setActivePhase}
      />

      <TimezoneNote />

      <div className="schedule__list">
        {Object.entries(matchesByDate).map(([date, matches]) => {
          const d = new Date(date + 'T00:00:00');
          const label = d.toLocaleDateString(t('dateLocale'), {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          });

          return (
            <div
              key={date}
              className="schedule__day"
              ref={(el) => {
                if (el) dayRefs.current[date] = el;
                else delete dayRefs.current[date];
              }}
            >
              <h3 className="schedule__day-label">{label}</h3>
              {matches.map((match, i) => (
                <MatchCard
                  key={match.id}
                  match={match}
                  matchScore={cachedScores[String(match.id)]}
                  isNext={match.id === nextMatchId && phaseIsCurrent}
                  showCalButton
                  onTeamClick={onTeamClick}
                  resolvedHome={resolvedKO[match.id]?.home}
                  resolvedAway={resolvedKO[match.id]?.away}
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
