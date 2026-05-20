import { useState, useMemo } from 'react';
import schedule from '../data/schedule.json';
import PhaseFilter from '../components/PhaseFilter';
import MatchCard from '../components/MatchCard';
import { useLanguage } from '../i18n/LanguageContext';

function getNextMatchId(matches) {
  const now = new Date();
  for (const match of matches) {
    const [h, m] = match.kickoff_bst.split(':').map(Number);
    const matchDate = new Date(match.date + 'T00:00:00');
    matchDate.setHours(h, m, 0, 0);
    if (matchDate > now) return match.id;
  }
  return null;
}

export default function Schedule({ onTeamClick }) {
  const [activePhase, setActivePhase] = useState('group');
  const { t } = useLanguage();

  const translatedPhases = useMemo(
    () => schedule.phases.map((p) => ({ ...p, name: t(`phase.${p.id}`) })),
    [t]
  );

  const phase = schedule.phases.find((p) => p.id === activePhase);
  const allGroupMatches = schedule.phases.find((p) => p.id === 'group')?.matches || [];
  const nextMatchId = useMemo(() => getNextMatchId(allGroupMatches), []);

  const matchesByDate = useMemo(() => {
    if (!phase) return {};
    const grouped = {};
    for (const match of phase.matches) {
      if (!grouped[match.date]) grouped[match.date] = [];
      grouped[match.date].push(match);
    }
    return grouped;
  }, [phase]);

  return (
    <div className="schedule">
      <PhaseFilter
        phases={translatedPhases}
        active={activePhase}
        onSelect={setActivePhase}
      />

      <div className="schedule__list">
        {Object.entries(matchesByDate).map(([date, matches]) => {
          const d = new Date(date + 'T00:00:00');
          const label = d.toLocaleDateString(t('dateLocale'), {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          });

          return (
            <div key={date} className="schedule__day">
              <h3 className="schedule__day-label">{label}</h3>
              {matches.map((match, i) => (
                <MatchCard
                  key={match.id}
                  match={match}
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
