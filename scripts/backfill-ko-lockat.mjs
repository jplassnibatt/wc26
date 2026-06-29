// Backfill `lockAt` on existing knockout bets (matchId >= 73) to the corrected
// kickoff time from schedule.json. Needed after the knockout date/time fix: the
// Firestore read-gate (anti-copy reveal) keys off each bet's stored `lockAt`,
// which still held the OLD kickoff for matches whose time changed.
// Idempotent — only writes bets whose lockAt differs. Safe to re-run after the
// schedule deploy (catches any bets re-saved with the old time in between).
import { readFileSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!raw) { console.log('FIREBASE_SERVICE_ACCOUNT not set — nothing to do.'); process.exit(0); }
initializeApp({ credential: cert(JSON.parse(raw)) });
const db = getFirestore();

const schedule = JSON.parse(readFileSync(new URL('../src/data/schedule.json', import.meta.url)));
const ALL = schedule.phases.flatMap((p) => p.matches);

// Kickoff (UTC ms): schedule stores Portugal time (UTC+1 during the tournament).
// Mirrors src/utils/matchTime.js kickoffMs.
function kickoffMs(m) {
  if (!m?.date || !m?.kickoff_bst) return null;
  const [y, mo, d] = m.date.split('-').map(Number);
  const [hh, mm] = m.kickoff_bst.split(':').map(Number);
  if ([y, mo, d, hh, mm].some(Number.isNaN)) return null;
  return Date.UTC(y, mo - 1, d, hh - 1, mm);
}
const LOCK = Object.fromEntries(ALL.map((m) => [m.id, kickoffMs(m)]));

const pools = await db.collection('pools').get();
let checked = 0, updated = 0;
for (const poolDoc of pools.docs) {
  const snap = await poolDoc.ref.collection('bets').where('matchId', '>=', 73).get();
  if (snap.empty) continue;
  const batch = db.batch();
  let poolUpdates = 0;
  for (const d of snap.docs) {
    checked += 1;
    const b = d.data();
    const want = LOCK[b.matchId];
    if (want == null) continue;
    if (b.lockAt !== want) {
      batch.update(d.ref, { lockAt: want });
      poolUpdates += 1;
    }
  }
  if (poolUpdates > 0) { await batch.commit(); updated += poolUpdates; }
  console.log(`pool ${poolDoc.id}: ${snap.size} KO bet(s), ${poolUpdates} lockAt updated`);
}
console.log(`\nchecked ${checked} KO bet(s), updated ${updated} lockAt value(s)`);
console.log('done');
