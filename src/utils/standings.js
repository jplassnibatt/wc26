// Group standings computed from finished results (the `matchResults`-backed
// map returned by useCachedScores: { matchId: { status, scoreHome, scoreAway } }).
//
// Tiebreakers follow the FIFA 2026 group rules as far as our data allows:
// points → goal difference → goals for → head-to-head (points, GD, GF in the
// matches between the tied teams). The next official criterion is fair play
// (cards), which we don't have — we fall back to alphabetical order, which is
// deterministic and almost never reached.
import schedule from '../data/schedule.json';

const GROUP_MATCHES = (schedule.phases.find((p) => p.id === 'group') ?? { matches: [] }).matches;

function cmpBasic(a, b) {
  return b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf;
}

// Mini-table of only the matches between the tied teams.
function headToHead(tied, played) {
  const inTie = new Set(tied.map((r) => r.iso));
  const sub = {};
  for (const r of tied) sub[r.iso] = { pts: 0, gf: 0, ga: 0 };
  for (const p of played) {
    if (!inTie.has(p.home) || !inTie.has(p.away)) continue;
    sub[p.home].gf += p.gh; sub[p.home].ga += p.ga;
    sub[p.away].gf += p.ga; sub[p.away].ga += p.gh;
    if (p.gh > p.ga) sub[p.home].pts += 3;
    else if (p.gh < p.ga) sub[p.away].pts += 3;
    else { sub[p.home].pts += 1; sub[p.away].pts += 1; }
  }
  return sub;
}

function sortGroup(rows, played) {
  const sorted = [...rows].sort(cmpBasic);
  const out = [];
  let i = 0;
  while (i < sorted.length) {
    let j = i + 1;
    while (j < sorted.length && cmpBasic(sorted[i], sorted[j]) === 0) j++;
    const tied = sorted.slice(i, j);
    if (tied.length > 1) {
      const sub = headToHead(tied, played);
      tied.sort((a, b) => {
        const sa = sub[a.iso], sb = sub[b.iso];
        return sb.pts - sa.pts || (sb.gf - sb.ga) - (sa.gf - sa.ga) || sb.gf - sa.gf
          || a.name.localeCompare(b.name);
      });
    }
    out.push(...tied);
    i = j;
  }
  return out;
}

// Returns { groups: { A: [row…], … }, thirds: [row…] } where each row is
// { iso, name, group, played, won, drawn, lost, gf, ga, pts } and group rows
// are in final table order. `thirds` ranks every 3rd place (top 8 advance).
export function computeStandings(results) {
  const rows = {};
  for (const t of schedule.teams) {
    rows[t.iso] = { iso: t.iso, name: t.name, group: t.group, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, pts: 0 };
  }

  const played = []; // { home, away, gh, ga } in iso terms, finished only
  for (const m of GROUP_MATCHES) {
    const r = results[String(m.id)];
    if (!r || r.status !== 'finished' || r.scoreHome == null || r.scoreAway == null) continue;
    const home = rows[m.home_iso];
    const away = rows[m.away_iso];
    if (!home || !away) continue;
    const gh = Number(r.scoreHome), ga = Number(r.scoreAway);
    home.played++; away.played++;
    home.gf += gh; home.ga += ga;
    away.gf += ga; away.ga += gh;
    if (gh > ga) { home.won++; away.lost++; home.pts += 3; }
    else if (gh < ga) { away.won++; home.lost++; away.pts += 3; }
    else { home.drawn++; away.drawn++; home.pts++; away.pts++; }
    played.push({ home: m.home_iso, away: m.away_iso, gh, ga });
  }

  const groups = {};
  for (const row of Object.values(rows)) (groups[row.group] ??= []).push(row);
  for (const g of Object.keys(groups)) groups[g] = sortGroup(groups[g], played);

  // Best-thirds ranking: points → GD → GF (FIFA), alphabetical as fallback.
  const thirds = Object.values(groups)
    .map((g) => g[2])
    .filter(Boolean)
    .sort((a, b) => cmpBasic(a, b) || a.name.localeCompare(b.name));

  return { groups, thirds };
}
