import { useLanguage } from '../i18n/LanguageContext';
import { downloadICS } from '../utils/calendar';

function getFlagUrl(iso) {
  return `https://flagcdn.com/w80/${iso}.png`;
}

export default function MatchCard({ match, isNext, showCalButton = false, onTeamClick }) {
  const { t } = useLanguage();
  const hasTeams = !!match.home_iso;
  const isKnockout = !hasTeams;

  const homeName = hasTeams ? t(`team.${match.home_iso}`) : match.home;
  const awayName = hasTeams ? t(`team.${match.away_iso}`) : match.away;

  const dateStr = (() => {
    const d = new Date(match.date + 'T00:00:00');
    return d.toLocaleDateString(t('dateLocale'), {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  })();

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
        {dateStr} &middot; {match.kickoff_bst}
        {showCalButton && hasTeams && (
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
        <div className="match-card__team" onClick={() => hasTeams && onTeamClick?.(match.home_iso)} style={hasTeams && onTeamClick ? { cursor: 'pointer' } : undefined}>
          {hasTeams ? (
            <img
              src={getFlagUrl(match.home_iso)}
              alt={homeName}
              className="match-card__flag match-card__flag--clickable"
              loading="lazy"
            />
          ) : (
            <div className="match-card__flag-placeholder" />
          )}
          <span className="match-card__name">{homeName}</span>
        </div>

        <span className="match-card__vs">{t('vs')}</span>

        <div className="match-card__team" onClick={() => hasTeams && onTeamClick?.(match.away_iso)} style={hasTeams && onTeamClick ? { cursor: 'pointer' } : undefined}>
          {hasTeams ? (
            <img
              src={getFlagUrl(match.away_iso)}
              alt={awayName}
              className="match-card__flag match-card__flag--clickable"
              loading="lazy"
            />
          ) : (
            <div className="match-card__flag-placeholder" />
          )}
          <span className="match-card__name">{awayName}</span>
        </div>
      </div>
    </div>
  );
}
