import { useState, useEffect, useCallback, useRef } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './useAuth';

const STORAGE_KEY = 'wc26-favorites';

function readLocal() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function writeLocal(favs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(favs));
  } catch {}
}

function sameSet(a, b) {
  if (a.length !== b.length) return false;
  const s = new Set(a);
  return b.every((x) => s.has(x));
}

// Favourites follow the account: stored on the user doc in Firestore (so they
// sync across devices and survive a localStorage wipe), with localStorage kept
// as an instant-load offline cache.
export function useFavorites() {
  const { user, profile } = useAuth();
  const [favorites, setFavorites] = useState(readLocal);
  const syncedUidRef = useRef(null);
  const hadProfileRef = useRef(false);

  // Keep the local cache in sync on every change.
  useEffect(() => {
    writeLocal(favorites);
  }, [favorites]);

  // One-time reconcile with the account's stored favourites when a profile
  // becomes available. Union so favourites picked while logged-out aren't lost.
  useEffect(() => {
    if (!user?.uid || !profile) return;
    if (syncedUidRef.current === user.uid) return;
    syncedUidRef.current = user.uid;

    const remote = Array.isArray(profile.favorites) ? profile.favorites : [];
    setFavorites((local) => {
      const merged = Array.from(new Set([...local, ...remote]));
      // Push the union up only if it adds something the account didn't have.
      if (!sameSet(merged, remote)) {
        updateDoc(doc(db, 'users', user.uid), { favorites: merged }).catch(() => {});
      }
      return merged;
    });
  }, [user?.uid, profile]);

  // On logout, drop the cache so favourites do not leak to the next account
  // signing in on this browser.
  useEffect(() => {
    const hadProfile = hadProfileRef.current;
    hadProfileRef.current = !!profile;
    if (hadProfile && !profile) {
      syncedUidRef.current = null;
      setFavorites([]);
    }
  }, [profile]);

  const toggleFavorite = useCallback(
    (teamIso) => {
      setFavorites((prev) => {
        const next = prev.includes(teamIso)
          ? prev.filter((iso) => iso !== teamIso)
          : [...prev, teamIso];
        if (user?.uid && profile) {
          updateDoc(doc(db, 'users', user.uid), { favorites: next }).catch(() => {});
        }
        return next;
      });
    },
    [user?.uid, profile]
  );

  const isFavorite = useCallback(
    (teamIso) => favorites.includes(teamIso),
    [favorites]
  );

  return { favorites, toggleFavorite, isFavorite };
}
