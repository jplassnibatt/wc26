const API_BASE = 'https://api.football-data.org/v4';
const API_KEY = import.meta.env.VITE_FOOTBALL_DATA_API_KEY;

async function apiFetch(path) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'X-Auth-Token': API_KEY },
  });
  if (!res.ok) throw new Error(`football-data.org ${res.status}`);
  return res.json();
}

export async function getWorldCupMatches(matchday) {
  const params = matchday ? `?matchday=${matchday}` : '';
  return apiFetch(`/competitions/WC/matches${params}`);
}

export async function getTodayMatches() {
  const today = new Date().toISOString().slice(0, 10);
  return apiFetch(`/competitions/WC/matches?dateFrom=${today}&dateTo=${today}`);
}

export function mapApiStatus(status) {
  switch (status) {
    case 'SCHEDULED':
    case 'TIMED':
      return 'upcoming';
    case 'IN_PLAY':
    case 'PAUSED':
      return 'live';
    case 'FINISHED':
      return 'finished';
    default:
      return 'upcoming';
  }
}

export function extractScore(apiMatch) {
  const ft = apiMatch.score?.fullTime;
  if (!ft) return null;
  return { home: ft.home, away: ft.away };
}
