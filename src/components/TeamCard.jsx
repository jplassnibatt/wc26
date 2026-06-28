import { useLanguage } from '../i18n/LanguageContext';

function getFlagUrl(iso) {
  return `https://flagcdn.com/w80/${iso}.png`;
}

export default function TeamCard({ team, isFav, onToggle, onTeamClick }) {
  const { t } = useLanguage();
  const teamName = t(`team.${team.iso}`);

  return (
    <div className="team-card">
      <button
        type="button"
        className="team-card__main"
        onClick={() => onTeamClick?.(team.iso)}
        disabled={!onTeamClick}
      >
        <img
          src={getFlagUrl(team.iso)}
          alt=""
          className="team-card__flag"
          loading="lazy"
        />
        <span className="team-card__name">{teamName}</span>
        <span className="team-card__group">{t('group')} {team.group}</span>
      </button>
      <button
        className={`team-card__fav ${isFav ? 'team-card__fav--active' : ''}`}
        onClick={() => onToggle(team.iso)}
        aria-label={isFav ? t('removeFavourite') : t('addFavourite')}
      >
        {isFav ? '★' : '☆'}
      </button>
    </div>
  );
}
