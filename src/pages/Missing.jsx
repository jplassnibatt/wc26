import { useLanguage } from '../i18n/LanguageContext';

const missingTeams = [
  { iso: 'cm' },
  { iso: 'dk' },
  { iso: 'hu' },
  { iso: 'it' },
  { iso: 'ng' },
  { iso: 'pl' },
  { iso: 'ru' },
  { iso: 'si' },
];

function getFlagUrl(iso) {
  return `https://flagcdn.com/w80/${iso}.png`;
}

export default function Missing() {
  const { t } = useLanguage();

  return (
    <div className="missing">
      <div className="missing__header">
        <span className="missing__icon">😢</span>
        <h2 className="missing__title">{t('missingTitle')}</h2>
        <p className="missing__subtitle">{t('missingSubtitle')}</p>
      </div>

      <div className="missing__grid">
        {missingTeams.map((team) => (
          <div key={team.iso} className="missing__card">
            <div className="missing__card-accent" />
            <img
              src={getFlagUrl(team.iso)}
              alt={t(`team.${team.iso}`)}
              className="missing__flag"
              loading="lazy"
            />
            <span className="missing__name">{t(`team.${team.iso}`)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
