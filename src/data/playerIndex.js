// Builds flat, searchable indexes of every player and every team for the
// special-bets autocomplete. Player data comes from the squad files; teams from
// the schedule. Each entry carries a stable `id` used to match a user's pick
// against the admin-resolved correct answer.

import schedule from './schedule.json';

const teamModules = import.meta.glob('./teams/*.js', { eager: true });

function slug(str) {
  return String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Team name by iso, from the schedule (single source of truth for the 48 teams).
const TEAM_NAME_BY_ISO = Object.fromEntries(
  schedule.teams.map((t) => [t.iso, t.name])
);

// --- Teams index -----------------------------------------------------------
// id = iso, so a "surprise team" pick is just the country code.
export const ALL_TEAMS = [...schedule.teams]
  .map((t) => ({ id: t.iso, label: t.name, iso: t.iso, group: t.group }))
  .sort((a, b) => a.label.localeCompare(b.label));

// --- Players index ---------------------------------------------------------
const SQUAD_KEYS = ['goalkeepers', 'defenders', 'midfielders', 'forwards'];

function buildPlayers() {
  const players = [];
  const seen = new Set();

  for (const [path, mod] of Object.entries(teamModules)) {
    const data = mod?.default;
    if (!data?.probableSquad) continue;
    const iso = data.iso || path.replace('./teams/', '').replace('.js', '');
    const teamName = TEAM_NAME_BY_ISO[iso] || data.name || iso;

    for (const key of SQUAD_KEYS) {
      const group = data.probableSquad[key];
      if (!Array.isArray(group)) continue;
      for (const p of group) {
        if (!p?.name) continue;
        let id = `${slug(p.name)}__${iso}`;
        // Guard against the rare duplicate within a single squad.
        let n = 2;
        while (seen.has(id)) id = `${slug(p.name)}__${iso}__${n++}`;
        seen.add(id);
        players.push({
          id,
          label: p.name,
          sublabel: `${p.club ? p.club + ' · ' : ''}${teamName}`,
          club: p.club || '',
          teamIso: iso,
          teamName,
        });
      }
    }
  }
  return players.sort((a, b) => a.label.localeCompare(b.label));
}

export const ALL_PLAYERS = buildPlayers();

// Lookup helpers used to render a saved pick / resolved answer by id.
const PLAYER_BY_ID = Object.fromEntries(ALL_PLAYERS.map((p) => [p.id, p]));
const TEAM_BY_ID = Object.fromEntries(ALL_TEAMS.map((t) => [t.id, t]));

export function optionsFor(kind) {
  return kind === 'team' ? ALL_TEAMS : ALL_PLAYERS;
}

export function lookupOption(kind, id) {
  if (!id) return null;
  return kind === 'team' ? TEAM_BY_ID[id] || null : PLAYER_BY_ID[id] || null;
}
