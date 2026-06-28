import { useState, useEffect, useCallback, createContext, useContext, useRef } from 'react';
import {
  signInAnonymously,
  onAuthStateChanged,
  signInWithPopup,
  linkWithPopup,
  signInWithRedirect,
  linkWithRedirect,
  getRedirectResult,
  linkWithCredential,
  EmailAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithCredential,
  signOut,
  GoogleAuthProvider,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  getDocs,
  collection,
  query,
  where,
  serverTimestamp,
  arrayUnion,
  writeBatch,
  deleteDoc,
  increment,
} from 'firebase/firestore';
import { auth, db, googleProvider } from '../firebase';
import * as Sentry from '@sentry/react';

const AuthContext = createContext(null);

const APP_VERSION = import.meta.env.VITE_APP_VERSION || '0.0.0';

// Stashes the anonymous uid across a redirect-based Google sign-in so the
// redirect result handler can merge data after the page reloads.
const REDIRECT_UID_KEY = 'wc26-google-redirect-uid';

// Mobile browsers (and some in-app/embedded webviews) frequently block popups.
// These error codes mean "popup couldn't open" — fall back to a full redirect.
function isPopupBlockedError(err) {
  return (
    err?.code === 'auth/popup-blocked' ||
    err?.code === 'auth/operation-not-supported-in-this-environment'
  );
}

// ── Helpers ──────────────────────────────────────────────

async function ensureUserDoc(firebaseUser) {
  const ref = doc(db, 'users', firebaseUser.uid);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    // Update login analytics + merge any new auth info
    const updates = {
      lastLoginAt: serverTimestamp(),
      loginCount: increment(1),
      appVersion: APP_VERSION,
    };
    if (firebaseUser.email) updates.email = firebaseUser.email;
    if (firebaseUser.photoURL) updates.photoURL = firebaseUser.photoURL;
    try { await updateDoc(ref, updates); } catch {}

    const data = snap.data();
    // Return fresh data with merged fields
    return {
      ...data,
      email: firebaseUser.email || data.email || '',
      photoURL: firebaseUser.photoURL || data.photoURL || '',
    };
  }

  // No doc yet — create one
  const data = {
    nickname: firebaseUser.displayName || '',
    email: firebaseUser.email || '',
    photoURL: firebaseUser.photoURL || '',
    pools: [],
    createdAt: serverTimestamp(),
    lastLoginAt: serverTimestamp(),
    loginCount: 1,
    appVersion: APP_VERSION,
  };
  await setDoc(ref, data);
  return data;
}

async function migrateGroupToPool(uid, groupCode, nickname) {
  const q = query(collection(db, 'pools'), where('inviteCode', '==', groupCode));
  const snap = await getDocs(q);

  let poolId;
  if (!snap.empty) {
    poolId = snap.docs[0].id;
    const poolData = snap.docs[0].data();
    if (!poolData.members?.includes(uid)) {
      await updateDoc(doc(db, 'pools', poolId), {
        members: arrayUnion(uid),
      });
    }
  } else {
    const poolRef = doc(collection(db, 'pools'));
    poolId = poolRef.id;

    const groupSnap = await getDoc(doc(db, 'groups', groupCode));
    const groupData = groupSnap.exists() ? groupSnap.data() : {};

    await setDoc(poolRef, {
      name: groupCode,
      createdBy: groupData.createdBy || uid,
      createdAt: groupData.createdAt || serverTimestamp(),
      inviteCode: groupCode,
      members: [uid],
    });

    for (const sub of ['bets', 'leaderboard', 'matches']) {
      const subSnap = await getDocs(collection(db, 'groups', groupCode, sub));
      for (const d of subSnap.docs) {
        await setDoc(doc(db, 'pools', poolId, sub, d.id), d.data());
      }
    }
  }

  const lbRef = doc(db, 'pools', poolId, 'leaderboard', uid);
  const lbSnap = await getDoc(lbRef);
  if (!lbSnap.exists()) {
    await setDoc(lbRef, {
      nickname: nickname || '',
      totalPoints: 0,
      exactResultsCount: 0,
      correctOutcomeCount: 0,
    });
  }

  await updateDoc(doc(db, 'users', uid), { pools: arrayUnion(poolId) });
  return poolId;
}

async function mergeAnonymousData(oldUid, newUid) {
  const oldUserSnap = await getDoc(doc(db, 'users', oldUid));
  if (!oldUserSnap.exists()) return;

  const poolIds = oldUserSnap.data().pools || [];
  for (const poolId of poolIds) {
    try {
      const betsSnap = await getDocs(
        query(collection(db, 'pools', poolId, 'bets'), where('userId', '==', oldUid))
      );
      const batch = writeBatch(db);
      for (const betDoc of betsSnap.docs) {
        const betData = betDoc.data();
        const newBetRef = doc(db, 'pools', poolId, 'bets', `${newUid}_${betData.matchId}`);
        const existing = await getDoc(newBetRef);
        if (!existing.exists()) batch.set(newBetRef, { ...betData, userId: newUid });
        batch.delete(betDoc.ref);
      }
      await batch.commit();

      const oldLbRef = doc(db, 'pools', poolId, 'leaderboard', oldUid);
      const oldLbSnap = await getDoc(oldLbRef);
      if (oldLbSnap.exists()) {
        const newLbRef = doc(db, 'pools', poolId, 'leaderboard', newUid);
        if (!(await getDoc(newLbRef)).exists()) await setDoc(newLbRef, oldLbSnap.data());
        await deleteDoc(oldLbRef);
      }

      const poolSnap = await getDoc(doc(db, 'pools', poolId));
      if (poolSnap.exists()) {
        const members = (poolSnap.data().members || []).filter((m) => m !== oldUid);
        if (!members.includes(newUid)) members.push(newUid);
        await updateDoc(doc(db, 'pools', poolId), { members });
      }
      await updateDoc(doc(db, 'users', newUid), { pools: arrayUnion(poolId) });
    } catch (e) {
      console.warn(`Merge skip pool ${poolId}:`, e.message);
    }
  }
}

// ── Provider ─────────────────────────────────────────────

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  // Prevent onAuthStateChanged from overwriting profile while signIn is in progress
  const signInInProgress = useRef(false);

  // Single source of truth: onAuthStateChanged. Before subscribing, drain any
  // pending redirect-based Google sign-in (the popup fallback used on mobile)
  // so the merge completes first and the listener loads the merged profile.
  useEffect(() => {
    let cancelledEffect = false;
    let unsub = () => {};

    // Resolve a redirect sign-in: merge anonymous data into the new account.
    // Profile loading is left to onAuthStateChanged below.
    async function drainRedirect() {
      const oldUid = (() => {
        try { return sessionStorage.getItem(REDIRECT_UID_KEY); } catch { return null; }
      })();
      if (oldUid) {
        try { sessionStorage.removeItem(REDIRECT_UID_KEY); } catch {}
      }
      try {
        const result = await getRedirectResult(auth);
        if (result && oldUid && oldUid !== result.user.uid) {
          await mergeAnonymousData(oldUid, result.user.uid);
        }
      } catch (err) {
        if (err.code === 'auth/credential-already-in-use' || err.code === 'auth/email-already-in-use') {
          const credential = GoogleAuthProvider.credentialFromError(err);
          if (credential) {
            const result = await signInWithCredential(auth, credential);
            if (oldUid && oldUid !== result.user.uid) {
              await mergeAnonymousData(oldUid, result.user.uid);
            }
            return;
          }
        }
        const cancelled = err.code === 'auth/popup-closed-by-user'
          || err.code === 'auth/cancelled-popup-request';
        if (!cancelled) {
          Sentry.captureException(err, {
            tags: { flow: 'google-redirect' },
            extra: { code: err.code, userAgent: navigator.userAgent },
          });
        }
      }
    }

    drainRedirect().finally(() => {
      if (cancelledEffect) return;
      unsub = onAuthStateChanged(auth, async (firebaseUser) => {
        try {
          if (!firebaseUser) {
            // No user at all — create anonymous session
            setUser(null);
            setProfile(null);
            await signInAnonymously(auth);
            return;
          }

          setUser(firebaseUser);
          Sentry.setUser({ id: firebaseUser.uid, email: firebaseUser.email || undefined });

          // If a signIn function is handling the profile, let it finish
          if (signInInProgress.current) {
            setLoading(false);
            return;
          }

          if (firebaseUser.isAnonymous) {
            // Anonymous users don't get a profile until they pick a nickname
            setProfile(null);
          } else {
            // Real user — ensure doc exists, load profile
            const data = await ensureUserDoc(firebaseUser);

            // Legacy migration
            if (data.groupCode && (!data.pools || data.pools.length === 0)) {
              await migrateGroupToPool(firebaseUser.uid, data.groupCode, data.nickname);
              const updated = await getDoc(doc(db, 'users', firebaseUser.uid));
              setProfile(updated.data());
            } else {
              setProfile(data);
            }
          }
        } catch (err) {
          console.error('Auth error:', err);
        }
        setLoading(false);
      });
    });

    return () => {
      cancelledEffect = true;
      unsub();
    };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const currentUser = auth.currentUser;
    const wasAnonymous = currentUser?.isAnonymous;
    const oldUid = currentUser?.uid;

    signInInProgress.current = true;

    try {
      let resultUser;

      if (wasAnonymous) {
        const result = await linkWithPopup(currentUser, googleProvider);
        resultUser = result.user;
      } else {
        const result = await signInWithPopup(auth, googleProvider);
        resultUser = result.user;
      }

      setUser(resultUser);
      const data = await ensureUserDoc(resultUser);
      setProfile(data);
      return resultUser;
    } catch (err) {
      // linkWithPopup throws either code depending on whether the Google
      // account or just its email already belongs to another user
      if (err.code === 'auth/credential-already-in-use' || err.code === 'auth/email-already-in-use') {
        const credential = GoogleAuthProvider.credentialFromError(err);
        if (credential) {
          const result = await signInWithCredential(auth, credential);
          if (wasAnonymous && oldUid && oldUid !== result.user.uid) {
            await mergeAnonymousData(oldUid, result.user.uid);
          }
          setUser(result.user);
          const data = await ensureUserDoc(result.user);
          setProfile(data);
          return result.user;
        }
      }
      // Popup blocked (common on mobile / in-app browsers): fall back to a
      // full-page redirect. The page navigates away and the result is handled
      // by getRedirectResult on reload, so this call does not return.
      if (isPopupBlockedError(err)) {
        try {
          if (wasAnonymous && oldUid) sessionStorage.setItem(REDIRECT_UID_KEY, oldUid);
        } catch {}
        if (wasAnonymous) {
          await linkWithRedirect(currentUser, googleProvider);
        } else {
          await signInWithRedirect(auth, googleProvider);
        }
        return;
      }
      throw err;
    } finally {
      signInInProgress.current = false;
    }
  }, []);

  const signInWithEmail = useCallback(async (email, password, isSignUp) => {
    const currentUser = auth.currentUser;
    const wasAnonymous = currentUser?.isAnonymous;
    const oldUid = currentUser?.uid;

    signInInProgress.current = true;

    try {
      let resultUser;

      if (wasAnonymous) {
        const credential = EmailAuthProvider.credential(email, password);
        const result = await linkWithCredential(currentUser, credential);
        resultUser = result.user;
      } else if (isSignUp) {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        resultUser = result.user;
      } else {
        const result = await signInWithEmailAndPassword(auth, email, password);
        resultUser = result.user;
      }

      setUser(resultUser);
      const data = await ensureUserDoc(resultUser);
      setProfile(data);
      return resultUser;
    } catch (err) {
      if (err.code === 'auth/credential-already-in-use' || err.code === 'auth/email-already-in-use') {
        const result = await signInWithEmailAndPassword(auth, email, password);
        if (wasAnonymous && oldUid && oldUid !== result.user.uid) {
          await mergeAnonymousData(oldUid, result.user.uid);
        }
        setUser(result.user);
        const data = await ensureUserDoc(result.user);
        setProfile(data);
        return result.user;
      }
      throw err;
    } finally {
      signInInProgress.current = false;
    }
  }, []);

  const signOutUser = useCallback(async () => {
    await signOut(auth);
    setUser(null);
    setProfile(null);
    try { localStorage.removeItem('wc26-active-pool'); } catch {}
    try { localStorage.removeItem('wc26-favorites'); } catch {}
    await signInAnonymously(auth);
  }, []);

  const saveProfile = useCallback(async (nickname) => {
    if (!user) return;
    // Only update nickname — never overwrite pools or other fields
    await updateDoc(doc(db, 'users', user.uid), { nickname }).catch(async () => {
      // Doc might not exist yet (guest flow)
      await setDoc(doc(db, 'users', user.uid), {
        nickname,
        email: user.email || '',
        photoURL: user.photoURL || '',
        pools: [],
        createdAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
        loginCount: 1,
        appVersion: APP_VERSION,
      });
    });
    setProfile((prev) => ({ ...prev, nickname }));
  }, [user]);

  // Edit profile after onboarding: nickname and/or avatar. Denormalized fields
  // (nickname, avatar, customPhotoURL, avatarKind) are mirrored into the user's
  // leaderboard entry in every pool so the change shows up everywhere.
  const updateUserProfile = useCallback(async (fields) => {
    if (!user) return;
    const allowed = ['nickname', 'avatar', 'customPhotoURL', 'avatarKind'];
    const update = {};
    for (const k of allowed) if (fields[k] !== undefined) update[k] = fields[k];
    if (Object.keys(update).length === 0) return;

    await updateDoc(doc(db, 'users', user.uid), update);
    setProfile((prev) => ({ ...prev, ...update }));

    const pools = profile?.pools || [];
    await Promise.all(pools.map((poolId) =>
      setDoc(doc(db, 'pools', poolId, 'leaderboard', user.uid), update, { merge: true })
        .catch(() => { /* best-effort per pool */ })
    ));
  }, [user, profile]);

  // Per-user notification-center state: `notificationsSeenAt` clears the unread
  // badge; `notificationsClearedAt` hides everything older from the inbox.
  const markNotifications = useCallback(async (fields) => {
    if (!user) return;
    const update = {};
    if (fields.seenAt !== undefined) update.notificationsSeenAt = fields.seenAt;
    if (fields.clearedAt !== undefined) update.notificationsClearedAt = fields.clearedAt;
    if (Object.keys(update).length === 0) return;
    setProfile((prev) => ({ ...prev, ...update }));
    await updateDoc(doc(db, 'users', user.uid), update).catch(() => {});
  }, [user]);

  const isAnonymous = user?.isAnonymous ?? true;

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      loading,
      isAnonymous,
      saveProfile,
      updateUserProfile,
      markNotifications,
      signInWithGoogle,
      signInWithEmail,
      signOutUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
