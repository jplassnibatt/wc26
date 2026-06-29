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

// Phase buckets (mirrors src/utils/phases.js): group stage vs knockout, so the
// leaderboard's per-phase rankings stay in sync with the headline total.
const GROUP_MATCH_IDS = new Set(
  (schedule.phases.find((p) => p.id === 'group')?.matches || []).map((m) => m.id)
);

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
  // ESPN also renders Bosnia as "Bosnia & Herzegovina" / "Bosnia-Herzegovina";
  // both normalize (non-letters stripped) to "bosniaherzegovina".
  bosniaherzegovina: 'Bosnia',
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

// Team iso (e.g. 'pt') by normalized schedule name — needed for knockouts, where
// the advancer is stored as an iso (mirrors ScoresAdmin / resolveKnockout).
const ISO_BY_NORM = {};
for (const tm of schedule.teams || []) ISO_BY_NORM[norm(tm.name)] = tm.iso;
function resolveIso(espnName) {
  const nm = resolveTeam(espnName);
  return nm ? (ISO_BY_NORM[norm(nm)] ?? null) : null;
}

// Map an ESPN event to an internal match. Group stage: by team pair (also
// fixes home/away orientation). Knockout fixtures carry placeholder teams
// ("2K", "W83"), so the literal pair never matches them — they're resolved by
// kickoff instant, requiring a unique candidate within ±2h (times are accurate
// to the minute, so this is safe and avoids colliding with same-day games).
function findMatch(ev) {
  const t = Date.parse(ev.date);
  const home = resolveTeam(ev.homeName);
  const away = resolveTeam(ev.awayName);
  if (home && away) {
    // Only accept a team-pair match within ±2 days of the ESPN kickoff, so a
    // knockout rematch of a group fixture can't latch onto the June group game.
    const m = ALL_MATCHES.find(
      (x) => ((x.home === home && x.away === away) || (x.home === away && x.away === home))
        && Math.abs(kickoffMs(x) - t) <= 2 * 24 * 3600 * 1000
    );
    if (m) return { match: m, swapped: m.home !== home };
  }
  const candidates = ALL_MATCHES.filter((x) => Math.abs(kickoffMs(x) - t) <= 2 * 3600 * 1000);
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
      // Penalty-shootout tallies (knockouts only); null when not a shootout.
      const shootHome = homeC.shootoutScore != null ? parseInt(homeC.shootoutScore, 10) : null;
      const shootAway = awayC.shootoutScore != null ? parseInt(awayC.shootoutScore, 10) : null;
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
        shootHome,
        shootAway,
        statusDetail: e.status?.type?.detail || e.status?.type?.description || '',
        scorers,
      });
    }
  }
  return out;
}

// ---- Scoring (mirrors ScoresAdmin.jsx / src/utils/scoring.js) ---------------
function calculatePoints(predA, predB, actualA, actualB) {
  if (actualA == null || actualB == null) return null;
  if (predA === actualA && predB === actualB) return { points: 5, type: 'exact' };
  if (Math.sign(predA - predB) === Math.sign(actualA - actualB)) return { points: 3, type: 'outcome' };
  if (predA === actualA || predB === actualB) return { points: 1, type: 'partial' };
  return { points: 0, type: 'miss' };
}

// Knockout scoring (Track A) — mirrors scoreKnockout in src/utils/scoring.js.
// Base = 90' result (5/3/1); when the match goes beyond 90' the advancer (+3),
// how-it-ends (+2) and the all-correct boost (+5) layers reward a called draw.
function scoreKnockoutBet(bet, actual) {
  const base = calculatePoints(bet.predictedScoreA, bet.predictedScoreB, actual.a90, actual.b90);
  if (!base) return null;
  let points = base.points;
  const beyond90 = actual.decidedBy === 'et' || actual.decidedBy === 'pens';
  if (beyond90) {
    const advOk = !!bet.predictedAdvancer && bet.predictedAdvancer === actual.advancer;
    const decOk = !!bet.predictedDecidedBy && bet.predictedDecidedBy === actual.decidedBy;
    if (advOk) points += 3;
    if (decOk) points += 2;
    if (base.type === 'exact' && advOk && decOk) points += 5;
  }
  return { points, type: base.type };
}

// A scoring play is in regulation (counts toward the 90' result) if its clock
// minute is ≤ 90 — including stoppage ("45'+2'", "90'+3'"). Extra time (91–120,
// e.g. "105'", "120'+1'") is excluded. Penalty-shootout plays are already
// filtered out upstream (scorers exclude `shootout`).
function isRegulation(disp) {
  const m = /^(\d+)/.exec(String(disp || '').trim());
  return m ? Number(m[1]) <= 90 : true;
}

// Derive a knockout match's outcome from an ESPN event:
//   { a90, b90, decidedBy: '90'|'et'|'pens', advancer: iso, penA, penB }
// Returns null when it can't be determined confidently (e.g. a 90' draw with no
// shootout/ET signal), leaving that match for the admin to enter by hand.
function deriveKnockout(ev) {
  const pens = ev.shootHome != null && ev.shootAway != null;
  const hasET = (ev.scorers || []).some((s) => !isRegulation(s.minute));
  // Regulation goals per side, crediting own goals to the opponent.
  let regH = 0, regA = 0;
  for (const s of ev.scorers || []) {
    if (!isRegulation(s.minute)) continue;
    const benefitsHome = s.og ? !s.homeSide : s.homeSide;
    if (benefitsHome) regH += 1; else regA += 1;
  }
  if (pens || hasET) {
    // Beyond 90' implies the 90' score was level; if our reconstruction isn't a
    // draw the data is inconsistent — defer to the admin rather than guess.
    if (regH !== regA) return null;
    const a90 = regH, b90 = regA;
    if (pens) {
      const advancerSide = ev.shootHome > ev.shootAway ? 'home' : 'away';
      return { a90, b90, decidedBy: 'pens', advancerSide, penA: ev.shootHome, penB: ev.shootAway };
    }
    const advancerSide = ev.scoreHome > ev.scoreAway ? 'home' : ev.scoreAway > ev.scoreHome ? 'away' : null;
    if (!advancerSide) return null; // ET with no winner shouldn't happen (→ pens)
    return { a90, b90, decidedBy: 'et', advancerSide, penA: null, penB: null };
  }
  // Decided in 90'. A draw with no ET/pens signal can't be resolved → admin.
  const advancerSide = ev.scoreHome > ev.scoreAway ? 'home' : ev.scoreAway > ev.scoreHome ? 'away' : null;
  if (!advancerSide) return null;
  return { a90: ev.scoreHome, b90: ev.scoreAway, decidedBy: '90', advancerSide, penA: null, penB: null };
}

// Previous scored "type" for delta maths — prefer the stored scoredType; older
// bets predate it, so fall back to the points→type mapping (5→exact, 3→outcome).
function prevScoredType(bet) {
  if (bet.scoredType) return bet.scoredType;
  const p = bet.pointsAwarded;
  return p === 5 ? 'exact' : p === 3 ? 'outcome' : null;
}

// Score every pool's bets for one match. `koActual` (from deriveKnockout) marks
// a knockout match and switches scoring to Track A; null means group-stage.
async function scoreMatch(matchId, scoreA, scoreB, koActual = null) {
  const pools = await db.collection('pools').get();
  // All bets here are for one match, so they share a phase bucket.
  const segment = GROUP_MATCH_IDS.has(matchId) ? 'group' : 'knockout';
  const segField = segment === 'group' ? 'groupPoints' : 'knockoutPoints';
  let scoredBets = 0;
  for (const poolDoc of pools.docs) {
    const betsSnap = await poolDoc.ref.collection('bets').where('matchId', '==', matchId).get();
    if (betsSnap.empty) continue;

    const batch = db.batch();
    const deltas = {}; // uid -> { points, exact, outcome }
    for (const betDoc of betsSnap.docs) {
      const bet = betDoc.data();
      const result = koActual
        ? scoreKnockoutBet(bet, koActual)
        : calculatePoints(bet.predictedScoreA, bet.predictedScoreB, scoreA, scoreB);
      if (!result) continue;
      const prev = bet.pointsAwarded ?? 0;
      const prevType = prevScoredType(bet);
      batch.update(betDoc.ref, { pointsAwarded: result.points, scoredType: result.type });
      if (!deltas[bet.userId]) deltas[bet.userId] = { points: 0, exact: 0, outcome: 0 };
      deltas[bet.userId].points += result.points - prev;
      deltas[bet.userId].exact += (result.type === 'exact' ? 1 : 0) - (prevType === 'exact' ? 1 : 0);
      deltas[bet.userId].outcome += (result.type === 'outcome' ? 1 : 0) - (prevType === 'outcome' ? 1 : 0);
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
          [segField]: (lbSnap.data()[segField] ?? 0) + d.points,
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
          groupPoints: segment === 'group' ? Math.max(0, d.points) : 0,
          knockoutPoints: segment === 'knockout' ? Math.max(0, d.points) : 0,
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
  const isKO = !GROUP_MATCH_IDS.has(match.id);

  const ref = db.collection('matchResults').doc(String(match.id));
  const existing = await ref.get();
  const cur = existing.exists ? existing.data() : null;

  // The admin is the override for knockouts (Track A): a hand-entered result has
  // no `source`, so never clobber it from the auto feed.
  if (isKO && cur && cur.source !== 'auto-espn') {
    console.log(`  SKIP (knockout entered by admin): match ${match.id}`);
    continue;
  }

  if (isKO) {
    // Derive the 90' result + how-it-ends + advancer from ESPN. Anything we
    // can't pin down confidently (a 90' draw with no ET/pens signal) is left
    // for the admin rather than guessed.
    const ko = deriveKnockout(ev);
    if (!ko) {
      console.log(`  SKIP (knockout needs admin — unclear ET/pens): match ${match.id} ${ev.homeName} ${ev.scoreHome}-${ev.scoreAway} ${ev.awayName}`);
      continue;
    }
    const homeIso = resolveIso(ev.homeName);
    const awayIso = resolveIso(ev.awayName);
    const advancer = ko.advancerSide === 'home' ? homeIso : awayIso;
    const scoreA = ko.a90; // 90' base, mirrors ScoresAdmin (Track A)
    const scoreB = ko.b90;
    // ESPN home is the bracket's home slot, so side 'A' = ESPN home (no swap).
    const scorers = (ev.scorers ?? []).map((s) => ({
      name: s.name, minute: s.minute, side: s.homeSide ? 'A' : 'B', pen: s.pen, og: s.og,
    }));
    const same = cur && cur.scoreA === scoreA && cur.scoreB === scoreB
      && cur.decidedBy === ko.decidedBy && cur.advancer === advancer;
    if (same && cur.scored === true && Array.isArray(cur.scorers)) continue;
    if (same && cur.scored === true) {
      await ref.set({ scorers }, { merge: true });
      console.log(`  match ${match.id}: backfilled ${scorers.length} scorer(s)`);
      continue;
    }
    console.log(`  match ${match.id} (KO) ${ev.homeName} vs ${ev.awayName}: ${scoreA}-${scoreB}` +
      ` [${ko.decidedBy}${ko.decidedBy === 'pens' ? ` ${ko.penA}-${ko.penB}` : ''}${ko.decidedBy !== '90' ? `, adv ${advancer}` : ''}]` +
      (cur ? ' (rescoring)' : ''));
    await ref.set({
      matchId: match.id, scoreA, scoreB, scorers,
      decidedBy: ko.decidedBy, advancer, penA: ko.penA, penB: ko.penB,
      homeIso, awayIso, // resolved teams, so notifications can name the sides
      status: 'finished', updatedAt: new Date(), source: 'auto-espn',
    }, { merge: true });
    const n = await scoreMatch(match.id, scoreA, scoreB, { a90: scoreA, b90: scoreB, decidedBy: ko.decidedBy, advancer });
    await ref.set({ scored: true }, { merge: true });
    console.log(`    scored ${n} bet(s) across pools`);
    continue;
  }

  // ---- Group stage ----
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
