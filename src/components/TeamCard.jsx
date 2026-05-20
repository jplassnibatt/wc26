import { useLanguage } from '../i18n/LanguageContext';

function getFlagUrl(iso) {
  return `https://flagcdn.com/w80/${iso}.png`;
}

export default function TeamCard({ team, isFav, onToggle, onTeamClick }) {
  const { t } = useLanguage();
  const teamName = t(`team.${team.iso}`);

  return (
    <div className="team-card" onClick={() => onTeamClick?.(team.iso)} style={onTeamClick ? { cursor: 'pointer' } : undefined}>
      <img
        src={getFlagUrl(team.iso)}
        alt={teamName}
        className="team-card__flag"
        loading="lazy"
      />
      <span className="team-card__name">{teamName}</span>
      <span className="team-card__group">{t('group')} {team.group}</span>
      <button
        className={`team-card__fav ${isFav ? 'team-card__fav--active' : ''}`}
        onClick={(e) => { e.stopPropagation(); onToggle(team.iso); }}
        aria-label={isFav ? t('removeFavourite') : t('addFavourite')}
      >
        {isFav ? '★' : '☆'}
      </button>
    </div>
  );
}
