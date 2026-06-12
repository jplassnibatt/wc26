import { useState, useMemo, useCallback } from 'react';
import schedule from '../data/schedule.json';
import { teamConfederation, confederationOrder } from '../data/confederations';
import TeamCard from '../components/TeamCard';
import GroupTable from '../components/GroupTable';
import { useCachedScores } from '../hooks/useLiveScores';
import { computeStandings } from '../utils/standings';
import { useLanguage } from '../i18n/LanguageContext';

const VIEW_MODES = ['group', 'az', 'confederation'];

export default function Teams({ favorites, toggleFavorite, isFavorite, onTeamClick }) {
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState('group');
  const { t } = useLanguage();
  const scores = useCachedScores();
  const standings = useMemo(() => computeStandings(scores), [scores]);

  const viewLabels = {
    az: t('viewAZ'),
    group: t('viewByGroup'),
    confederation: t('viewByConfederation'),
  };

  // Filter teams by search
  const filtered = useMemo(() => {
    let teams = [...schedule.teams];
    if (search) {
      const q = search.toLowerCase();
      teams = teams.filter((team) => {
        const translatedName = t(`team.${team.iso}`);
        return translatedName.toLowerCase().includes(q) ||
               team.name.toLowerCase().includes(q);
      });
    }
    return teams;
  }, [search, t]);

  // Sort helper: favourites first, then alphabetical by translated name
  const sortTeams = useCallback(
    (teams) =>
      [...teams].sort((a, b) => {
        const aFav = favorites.includes(a.iso);
        const bFav = favorites.includes(b.iso);
        if (aFav && !bFav) return -1;
        if (!aFav && bFav) return 1;
        return t(`team.${a.iso}`).localeCompare(t(`team.${b.iso}`));
      }),
    [favorites, t]
  );

  // Build grouped data based on view mode
  const sections = useMemo(() => {
    if (viewMode === 'az') {
      return [{ key: 'all', label: null, teams: sortTeams(filtered) }];
    }

    if (viewMode === 'group') {
      // Standings rows in table order; search hides non-matching rows but
      // keeps each row's real position in the group.
      const visible = new Set(filtered.map((team) => team.iso));
      return Object.keys(standings.groups)
        .sort()
        .map((g) => ({
          key: g,
          label: `${t('group')} ${g}`,
          rows: standings.groups[g]
            .map((r, idx) => ({ ...r, pos: idx + 1 }))
            .filter((r) => visible.has(r.iso)),
        }))
        .filter((s) => s.rows.length > 0);
    }

    if (viewMode === 'confederation') {
      const confs = {};
      for (const team of filtered) {
        const c = teamConfederation[team.iso] || 'OTHER';
        if (!confs[c]) confs[c] = [];
        confs[c].push(team);
      }
      return confederationOrder
        .filter((c) => confs[c])
        .map((c) => ({
          key: c,
          label: t(`conf.${c}`),
          teams: sortTeams(confs[c]),
        }));
    }

    return [];
  }, [filtered, viewMode, sortTeams, t, standings]);

  const bestThirdIsos = useMemo(
    () => new Set(standings.thirds.slice(0, 8).map((r) => r.iso)),
    [standings]
  );

  return (
    <div className="teams">
      <div className="teams__search-wrap">
        <input
          type="text"
          className="teams__search"
          placeholder={t('searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="teams__view-toggle">
        {VIEW_MODES.map((mode) => (
          <button
            key={mode}
            className={`teams__view-chip ${viewMode === mode ? 'teams__view-chip--active' : ''}`}
            onClick={() => setViewMode(mode)}
          >
            {viewLabels[mode]}
          </button>
        ))}
      </div>

      {sections.map((section) => (
        <div key={section.key} className="teams__section">
          {section.label && (
            <h3 className="teams__section-label">{section.label}</h3>
          )}
          {section.rows ? (
            <GroupTable rows={section.rows} bestThirdIsos={bestThirdIsos} onTeamClick={onTeamClick} />
          ) : (
            <div className="teams__grid">
              {section.teams.map((team) => (
                <TeamCard
                  key={team.iso}
                  team={team}
                  isFav={isFavorite(team.iso)}
                  onToggle={toggleFavorite}
                  onTeamClick={onTeamClick}
                />
              ))}
            </div>
          )}
        </div>
      ))}

      {viewMode === 'group' && !search && (
        <div className="teams__section">
          <h3 className="teams__section-label">{t('bestThirds')}</h3>
          <p className="teams__thirds-hint">{t('bestThirdsHint')}</p>
          <GroupTable rows={standings.thirds} thirds onTeamClick={onTeamClick} />
        </div>
      )}
    </div>
  );
}
