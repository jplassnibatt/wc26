import { useState, useMemo } from 'react';
import schedule from '../data/schedule.json';
import { teamConfederation, confederationOrder } from '../data/confederations';
import TeamCard from '../components/TeamCard';
import { useLanguage } from '../i18n/LanguageContext';

const VIEW_MODES = ['az', 'group', 'confederation'];

export default function Teams({ favorites, toggleFavorite, isFavorite, onTeamClick }) {
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState('az');
  const { t } = useLanguage();

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
  const sortTeams = (teams) =>
    [...teams].sort((a, b) => {
      const aFav = favorites.includes(a.iso);
      const bFav = favorites.includes(b.iso);
      if (aFav && !bFav) return -1;
      if (!aFav && bFav) return 1;
      return t(`team.${a.iso}`).localeCompare(t(`team.${b.iso}`));
    });

  // Build grouped data based on view mode
  const sections = useMemo(() => {
    if (viewMode === 'az') {
      return [{ key: 'all', label: null, teams: sortTeams(filtered) }];
    }

    if (viewMode === 'group') {
      const groups = {};
      for (const team of filtered) {
        const g = team.group;
        if (!groups[g]) groups[g] = [];
        groups[g].push(team);
      }
      return Object.keys(groups)
        .sort()
        .map((g) => ({
          key: g,
          label: `${t('group')} ${g}`,
          teams: sortTeams(groups[g]),
        }));
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
  }, [filtered, viewMode, favorites, t]);

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
        </div>
      ))}
    </div>
  );
}
