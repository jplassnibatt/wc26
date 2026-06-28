import { useMemo } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { topScorers, bestDefenses } from '../utils/tournamentStats';

function flagUrl(iso) {
  return `https://flagcdn.com/w40/${iso}.png`;
}

// Read-only tournament awards: top scorers and best defenses, both derived from
// the auto-synced match results. No betting, no manual input.
export default function TournamentStats({ scores, onTeamClick }) {
  const { t } = useLanguage();
  const scorers = useMemo(() => topScorers(scores).slice(0, 20), [scores]);
  const defenses = useMemo(() => bestDefenses(scores).slice(0, 12), [scores]);

  return (
    <>
      <div className="teams__section">
        <h3 className="teams__section-label">{t('statsTopScorers')}</h3>
        {scorers.length === 0 ? (
          <p className="teams__thirds-hint">{t('statsNoData')}</p>
        ) : (
          <ol className="stats-scorers">
            {scorers.map((s, i) => (
              <li
                key={`${s.name}__${s.teamIso ?? '?'}`}
                className={`stats-scorers__row ${s.teamIso ? 'stats-scorers__row--clickable' : ''}`}
                onClick={() => s.teamIso && onTeamClick?.(s.teamIso)}
              >
                <span className="stats-scorers__rank">{i + 1}</span>
                {s.teamIso ? (
                  <img className="stats-scorers__flag" src={flagUrl(s.teamIso)} alt="" loading="lazy" />
                ) : (
                  <span className="stats-scorers__flag stats-scorers__flag--unknown" />
                )}
                {s.teamIso ? (
                  <button
                    type="button"
                    className="stats-scorers__name"
                    onClick={(e) => { e.stopPropagation(); onTeamClick?.(s.teamIso); }}
                  >
                    {s.name}
                  </button>
                ) : (
                  <span className="stats-scorers__name">{s.name}</span>
                )}
                {s.pens > 0 && (
                  <span className="stats-scorers__pens">{s.pens} {t('statsPenAbbr')}</span>
                )}
                <span className="stats-scorers__goals">{s.goals}</span>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="teams__section">
        <h3 className="teams__section-label">{t('statsBestDefenses')}</h3>
        {defenses.length === 0 ? (
          <p className="teams__thirds-hint">{t('statsNoData')}</p>
        ) : (
          <table className="group-table">
            <thead>
              <tr>
                <th className="group-table__pos">#</th>
                <th className="group-table__team-h" aria-label="Team" />
                <th>{t('standingsP')}</th>
                <th title={t('statsConcededFull')}>{t('statsConcededAbbr')}</th>
                <th title={t('statsCleanSheetsFull')}>{t('statsCleanSheetsAbbr')}</th>
              </tr>
            </thead>
            <tbody>
              {defenses.map((r, idx) => (
                <tr
                  key={r.iso}
                  className="group-table__row"
                  onClick={() => onTeamClick?.(r.iso)}
                >
                  <td className="group-table__pos">{idx + 1}</td>
                  <td className="group-table__team">
                    <img src={flagUrl(r.iso)} alt="" loading="lazy" />
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
                  </td>
                  <td>{r.played}</td>
                  <td>{r.ga}</td>
                  <td className="group-table__pts">{r.cleanSheets}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
