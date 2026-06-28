import { useLanguage } from '../i18n/LanguageContext';

function getFlagUrl(iso) {
  return `https://flagcdn.com/w40/${iso}.png`;
}

// Standings table for one group (rows carry a precomputed `pos`), or — with
// `thirds` — the cross-group ranking of 3rd places, where the top 8 advance.
export default function GroupTable({ rows, bestThirdIsos, thirds = false, onTeamClick }) {
  const { t } = useLanguage();

  const rowClass = (r, idx) => {
    if (thirds) return idx < 8 ? 'group-table__row--q' : '';
    if (r.pos <= 2) return 'group-table__row--q';
    if (r.pos === 3 && bestThirdIsos?.has(r.iso)) return 'group-table__row--third';
    return '';
  };

  return (
    <table className="group-table">
      <thead>
        <tr>
          <th className="group-table__pos">#</th>
          <th className="group-table__team-h" aria-label="Team" />
          <th>{t('standingsP')}</th>
          <th>{t('standingsW')}</th>
          <th>{t('standingsD')}</th>
          <th>{t('standingsL')}</th>
          <th>±</th>
          <th>{t('standingsPts')}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, idx) => {
          const gd = r.gf - r.ga;
          return (
            <tr
              key={r.iso}
              className={`group-table__row ${rowClass(r, idx)}`}
              onClick={() => onTeamClick?.(r.iso)}
            >
              <td className="group-table__pos">{thirds ? idx + 1 : r.pos}</td>
              <td className="group-table__team">
                <img src={getFlagUrl(r.iso)} alt="" loading="lazy" />
                {onTeamClick ? (
                  <button
                    type="button"
                    className="group-table__team-link"
                    onClick={(e) => { e.stopPropagation(); onTeamClick(r.iso); }}
                  >
                    {t(`team.${r.iso}`)}
                  </button>
                ) : (
                  <span>{t(`team.${r.iso}`)}</span>
                )}
                {thirds && <span className="group-table__grp">{r.group}</span>}
              </td>
              <td>{r.played}</td>
              <td>{r.won}</td>
              <td>{r.drawn}</td>
              <td>{r.lost}</td>
              <td>{gd > 0 ? `+${gd}` : gd}</td>
              <td className="group-table__pts">{r.pts}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
