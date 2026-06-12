// Syncs finished match results from ESPN's public scoreboard into Firestore
// and scores every pool's bets — no manual entry needed. Run on a schedule by
// GitHub Actions (see sync-results.yml). Uses the Admin SDK, so Firestore
// rules don't apply; the scoring mirrors ScoresAdmin.jsx (delta-based, so
// re-running or correcting a result never double-counts).
import { readFileSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!raw) {
  console.log('FIREBASE_SERVICE_ACCOUNT not set — nothing to do.');
  process.exit(0);
}
initializeApp({ credential: cert(JSON.parse(raw)) });
const db = getFirestore();

const schedule = JSON.parse(readFileSync(new URL('../src/data/schedule.json', import.meta.url)));
const ALL_MATCHES = schedule.phases.flatMap((p) => p.matches);

// Kickoff (UTC ms): schedule stores Portugal time (UTC+1 during the tournament).
function kickoffMs(m) {
  const [y, mo, d] = m.date.split('-').map(Number);
  const [h, mi] = m.kickoff_bst.split(':').map(Number);
  return Date.UTC(y, mo - 1, d, h - 1, mi);
}

// ---- Team name matching -----------------------------------------------------
function norm(name) {
  return (name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[^a-z]/g, '');
}

// ESPN display names that differ from schedule.json names.
const ALIASES = {
  unitedstates: 'USA',
  usmnt: 'USA',
  bosniaandherzegovina: 'Bosnia',
  czechrepublic: 'Czechia',
  southkorea: 'South Korea',
  korearepublic: 'South Korea',
  turkiye: 'Türkiye',
  turkey: 'Türkiye',
  cotedivoire: 'Ivory Coast',
  ivorycoast: 'Ivory Coast',
  capeverdeislands: 'Cape Verde',
  caboverde: 'Cape Verde',
  drcongo: 'DR Congo',
  congodr: 'DR Congo',
  curacao: 'Curaçao',
  iriran: 'Iran',
};

const TEAM_BY_NORM = {};
for (const m of ALL_MATCHES) {
  if (m.home_iso) {
    TEAM_BY_NORM[norm(m.home)] = m.home;
    TEAM_BY_NORM[norm(m.away)] = m.away;
  }
}
function resolveTeam(espnName) {
  const n = norm(espnName);
  return ALIASES[n] != null ? ALIASES[n] : (TEAM_BY_NORM[n] ?? null);
}

// Map an ESPN event to an internal match. Group stage: by team pair (also
// fixes home/away orientation). Knockout (placeholder teams): by kickoff
// instant, requiring a unique candidate within ±3h.
function findMatch(ev) {
  const home = resolveTeam(ev.homeName);
  const away = resolveTeam(ev.awayName);
  if (home && away) {
    const m = ALL_MATCHES.find(
      (x) => (x.home === home && x.away === away) || (x.home === away && x.away === home)
    );
    if (m) return { match: m, swapped: m.home !== home };
  }
  const t = Date.parse(ev.date);
  const candidates = ALL_MATCHES.filter((x) => Math.abs(kickoffMs(x) - t) <= 3 * 3600 * 1000);
  if (candidates.length === 1) return { match: candidates[0], swapped: false };
  return null;
}

// ---- Fetch finished matches from ESPN ---------------------------------------
function yyyymmdd(d) {
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

async function fetchFinished() {
  const now = new Date();
  const days = [new Date(now.getTime() - 24 * 3600 * 1000), now];
  const seen = new Set();
  const out = [];
  for (const day of days) {
    const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=${yyyymmdd(day)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`ESPN ${res.status} for ${url}`);
    const data = await res.json();
    for (const e of data.events ?? []) {
      if (seen.has(e.id)) continue;
      seen.add(e.id);
      if (!e.status?.type?.completed) continue;
      const comp = e.competitions?.[0];
      const homeC = comp?.competitors?.find((c) => c.homeAway === 'home');
      const awayC = comp?.competitors?.find((c) => c.homeAway === 'away');
      if (!homeC || !awayC) continue;
      const scoreHome = parseInt(homeC.score, 10);
      const scoreAway = parseInt(awayC.score, 10);
      if (Number.isNaN(scoreHome) || Number.isNaN(scoreAway)) continue;
      const scorers = (comp.details ?? [])
        .filter((d) => d.scoringPlay && !d.shootout)
        .map((d) => ({
          name: d.athletesInvolved?.[0]?.displayName ?? '?',
          minute: d.clock?.displayValue ?? '',
          homeSide: String(d.team?.id) === String(homeC.id),
          pen: !!d.penaltyKick,
          og: !!d.ownGoal,
        }));
      out.push({
        date: e.date,
        homeName: homeC.team?.displayName,
        awayName: awayC.team?.displayName,
        scoreHome,
        scoreAway,
        scorers,
      });
    }
  }
  return out;
}

// ---- Scoring (mirrors ScoresAdmin.jsx) --------------------------------------
function calculatePoints(predA, predB, actualA, actualB) {
  if (actualA == null || actualB == null) return null;
  if (predA === actualA && predB === actualB) return { points: 5, type: 'exact' };
  if (Math.sign(predA - predB) === Math.sign(actualA - actualB)) return { points: 3, type: 'outcome' };
  if (predA === actualA || predB === actualB) return { points: 1, type: 'partial' };
  return { points: 0, type: 'miss' };
}

async function scoreMatch(matchId, scoreA, scoreB) {
  const pools = await db.collection('pools').get();
  let scoredBets = 0;
  for (const poolDoc of pools.docs) {
    const betsSnap = await poolDoc.ref.collection('bets').where('matchId', '==', matchId).get();
    if (betsSnap.empty) continue;

    const batch = db.batch();
    const deltas = {}; // uid -> { points, exact, outcome }
    for (const betDoc of betsSnap.docs) {
      const bet = betDoc.data();
      const result = calculatePoints(bet.predictedScoreA, bet.predictedScoreB, scoreA, scoreB);
      if (!result) continue;
      const prev = bet.pointsAwarded;
      batch.update(betDoc.ref, { pointsAwarded: result.points });
      if (!deltas[bet.userId]) deltas[bet.userId] = { points: 0, exact: 0, outcome: 0 };
      deltas[bet.userId].points += result.points - (prev ?? 0);
      deltas[bet.userId].exact += (result.type === 'exact' ? 1 : 0) - (prev === 5 ? 1 : 0);
      deltas[bet.userId].outcome += (result.type === 'outcome' ? 1 : 0) - (prev === 3 ? 1 : 0);
      scoredBets++;
    }
    await batch.commit();

    for (const [uid, d] of Object.entries(deltas)) {
      if (d.points === 0 && d.exact === 0 && d.outcome === 0) continue;
      const lbRef = poolDoc.ref.collection('leaderboard').doc(uid);
      const lbSnap = await lbRef.get();
      if (lbSnap.exists) {
        await lbRef.update({
          totalPoints: (lbSnap.data().totalPoints ?? 0) + d.points,
          exactResultsCount: (lbSnap.data().exactResultsCount ?? 0) + d.exact,
          correctOutcomeCount: (lbSnap.data().correctOutcomeCount ?? 0) + d.outcome,
        });
      } else {
        let nickname = '';
        try {
          const us = await db.collection('users').doc(uid).get();
          if (us.exists) nickname = us.data().nickname || '';
        } catch { /* nickname is best-effort */ }
        await lbRef.set({
          nickname,
          totalPoints: Math.max(0, d.points),
          exactResultsCount: Math.max(0, d.exact),
          correctOutcomeCount: Math.max(0, d.outcome),
        });
      }
    }
  }
  return scoredBets;
}

// ---- Main --------------------------------------------------------------------
const finished = await fetchFinished();
console.log(`ESPN: ${finished.length} finished match(es) in the last 2 days`);

for (const ev of finished) {
  const found = findMatch(ev);
  if (!found) {
    console.log(`  SKIP (no mapping): ${ev.homeName} ${ev.scoreHome}-${ev.scoreAway} ${ev.awayName} @ ${ev.date}`);
    continue;
  }
  const { match, swapped } = found;
  const scoreA = swapped ? ev.scoreAway : ev.scoreHome;
  const scoreB = swapped ? ev.scoreHome : ev.scoreAway;
  // Scorers relative to the internal match: side 'A' = match.home.
  const scorers = (ev.scorers ?? []).map((s) => ({
    name: s.name,
    minute: s.minute,
    side: (s.homeSide !== swapped) ? 'A' : 'B',
    pen: s.pen,
    og: s.og,
  }));

  const ref = db.collection('matchResults').doc(String(match.id));
  const existing = await ref.get();
  const cur = existing.exists ? existing.data() : null;
  const sameScore = cur && cur.scoreA === scoreA && cur.scoreB === scoreB;
  if (sameScore && cur.scored === true && Array.isArray(cur.scorers)) {
    continue; // already ingested, scored and with scorers
  }
  if (sameScore && cur.scored === true) {
    // Backfill scorers only — points are already correct.
    await ref.set({ scorers }, { merge: true });
    console.log(`  match ${match.id}: backfilled ${scorers.length} scorer(s)`);
    continue;
  }

  console.log(`  match ${match.id} ${match.home} vs ${match.away}: ${scoreA}-${scoreB}` +
    (cur ? ` (was ${cur.scoreA}-${cur.scoreB}, rescoring)` : ''));

  await ref.set({
    matchId: match.id,
    scoreA,
    scoreB,
    scorers,
    status: 'finished',
    updatedAt: new Date(),
    source: 'auto-espn',
  }, { merge: true });

  const n = await scoreMatch(match.id, scoreA, scoreB);
  await ref.set({ scored: true }, { merge: true });
  console.log(`    scored ${n} bet(s) across pools`);
}

console.log('done');
