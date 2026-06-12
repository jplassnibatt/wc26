import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

// Per-session cache of a pool's uid -> nickname map. The stats views
// (match stats, special stats, phase summary) all need nicknames; without this
// each one re-read the whole leaderboard collection (e.g. once per expanded
// match). Cached by poolId for the session.
const cache = new Map();

export async function getNicknames(poolId) {
  if (!poolId) return {};
  if (cache.has(poolId)) return cache.get(poolId);
  const snap = await getDocs(collection(db, 'pools', poolId, 'leaderboard'));
  const names = {};
  snap.docs.forEach((d) => { names[d.id] = d.data().nickname || ''; });
  cache.set(poolId, names);
  return names;
}

// Drop the cache for a pool (e.g. after a membership change) so it reloads.
export function invalidateNicknames(poolId) {
  if (poolId) cache.delete(poolId);
  else cache.clear();
}
