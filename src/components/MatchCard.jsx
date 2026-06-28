import { useLanguage } from '../i18n/LanguageContext';
import { downloadICS } from '../utils/calendar';
import { kickoffDateStr, kickoffTimeStr } from '../utils/matchTime';
import { slotLabel } from '../utils/knockout';

function getFlagUrl(iso) {
  return `https://flagcdn.com/w80/${iso}.png`;
}

export default function MatchCard({ match, matchScore, isNext, showCalButton = false, onTeamClick, resolvedHome, resolvedAway }) {
  const { t } = useLanguage();
  const isKnockout = !match.home_iso;
  // Knockout slots fall back to the resolver's certain teams as the bracket fills.
  const homeIso = match.home_iso || resolvedHome || null;
  const awayIso = match.away_iso || resolvedAway || null;
  const bothReal = !!homeIso && !!awayIso;
  const isFinished = matchScore?.status === 'finished' && matchScore.scoreHome != null;
  const scorersA = isFinished ? (matchScore.scorers || []).filter((s) => s.side === 'A') : [];
  const scorersB = isFinished ? (matchScore.scorers || []).filter((s) => s.side === 'B') : [];

  const homeName = homeIso ? t(`team.${homeIso}`) : slotLabel(match.home, t);
  const awayName = awayIso ? t(`team.${awayIso}`) : slotLabel(match.away, t);

  const dateStr = kickoffDateStr(match, t('dateLocale'), {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

  const handleAddToCalendar = (e) => {
    e.stopPropagation();
    downloadICS({
      title: `${homeName} vs ${awayName}`,
      date: match.date,
      kickoff: match.kickoff_bst,
    });
  };

  return (
    <div className={`match-card ${isNext ? 'match-card--next' : ''}`}>
      {isNext && (
        <div className="match-card__next-badge">
          <span className="match-card__pulse" />
          {t('nextMatch')}
        </div>
      )}

      {match.group_label && (
        <span className="match-card__group">{t('group')} {match.group_label}</span>
      )}

      {match.label && isKnockout && (
        <span className="match-card__label">{t(`label.${match.label}`) || match.label}</span>
      )}

      <div className="match-card__date">
        {dateStr} &middot; {kickoffTimeStr(match)}
        {showCalButton && bothReal && (
          <button
            className={`match-card__cal-pill ${isNext ? 'match-card__cal-pill--next' : ''}`}
            onClick={handleAddToCalendar}
            aria-label={t('addToCalendar')}
          >
            <span className="match-card__cal-plus">+</span>
            <span className="match-card__cal-icon">📅</span>
          </button>
        )}
      </div>

      {match.venue && match.venue !== 'TBD' && (
        <div className={`match-card__venue ${isNext ? 'match-card__venue--next' : ''}`}>
          📍 {match.venue} · {match.city}
        </div>
      )}

      <div className="match-card__teams">
        <button
          type="button"
          className="match-card__team"
          onClick={() => onTeamClick?.(homeIso)}
          disabled={!homeIso || !onTeamClick}
        >
          {homeIso ? (
            <img
              src={getFlagUrl(homeIso)}
              alt=""
              className="match-card__flag match-card__flag--clickable"
              loading="lazy"
            />
          ) : (
            <div className="match-card__flag-placeholder" />
          )}
          <span className="match-card__name">{homeName}</span>
        </button>

        {isFinished ? (
          <span className="match-card__score">
            {matchScore.scoreHome}<span className="match-card__score-sep">:</span>{matchScore.scoreAway}
          </span>
        ) : (
          <span className="match-card__vs">{t('vs')}</span>
        )}

        <button
          type="button"
          className="match-card__team"
          onClick={() => onTeamClick?.(awayIso)}
          disabled={!awayIso || !onTeamClick}
        >
          {awayIso ? (
            <img
              src={getFlagUrl(awayIso)}
              alt=""
              className="match-card__flag match-card__flag--clickable"
              loading="lazy"
            />
          ) : (
            <div className="match-card__flag-placeholder" />
          )}
          <span className="match-card__name">{awayName}</span>
        </button>
      </div>

      {isFinished && (scorersA.length > 0 || scorersB.length > 0) && (
        <div className="match-card__scorers">
          <div className="match-card__scorers-side">
            {scorersA.map((s, i) => (
              <span key={i} className="match-card__scorer">
                ⚽ {s.name} {s.minute}{s.pen ? ' (g.p.)' : ''}{s.og ? ' (p.b.)' : ''}
              </span>
            ))}
          </div>
          <div className="match-card__scorers-side match-card__scorers-side--away">
            {scorersB.map((s, i) => (
              <span key={i} className="match-card__scorer">
                {s.name} {s.minute}{s.pen ? ' (g.p.)' : ''}{s.og ? ' (p.b.)' : ''} ⚽
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
