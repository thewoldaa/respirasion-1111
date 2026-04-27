import { createContext, useContext, useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { ref, set, get, onValue } from 'firebase/database';
import { auth, db } from '../firebase';
import { generateId, toFirebaseEmail } from '../utils/helpers';

const Ctx = createContext(null);

export function AuthProvider({ children }) {
  const [user,     setUser]     = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    let stopProfileSync = null;

    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (stopProfileSync) {
        stopProfileSync();
        stopProfileSync = null;
      }

      if (fbUser) {
        setUser(fbUser);
        const userRef = ref(db, `users/${fbUser.uid}`);
        const snap = await get(userRef);
        if (snap.exists()) setUserData(snap.val());
        stopProfileSync = onValue(userRef, (s) => {
          if (s.exists()) setUserData(s.val());
        });
      } else {
        setUser(null);
        setUserData(null);
      }
      setLoading(false);
    });

    return () => {
      if (stopProfileSync) stopProfileSync();
      unsub();
    };
  }, []);

  async function register(username, password) {
    const cleanUsername = username.trim();
    const email = toFirebaseEmail(cleanUsername);

    if (email === '@respirasion.app') {
      throw new Error('Username tidak valid');
    }

    // Find unique 6-digit ID
    let userId;
    for (let i = 0; i < 15; i++) {
      const candidate = generateId();
      const snap = await get(ref(db, `userIds/${candidate}`));
      if (!snap.exists()) { userId = candidate; break; }
    }
    if (!userId) throw new Error('Gagal membuat ID unik — coba lagi.');

    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const uid  = cred.user.uid;

    const profile = {
      uid,
      username: cleanUsername,
      userId,
      displayName: cleanUsername,
      initials:    cleanUsername.slice(0, 2).toUpperCase(),
      createdAt:   Date.now(),
      online:      true,
      lastSeen:    Date.now(),
    };

    await Promise.all([
      set(ref(db, `users/${uid}`),        profile),
      set(ref(db, `userIds/${userId}`),   { value: uid }),
    ]);
    setUserData(profile);
  }

  async function login(username, password) {
    await signInWithEmailAndPassword(auth, toFirebaseEmail(username), password);
  }

  async function logout() {
    if (user) {
      await set(ref(db, `users/${user.uid}/online`),   false);
      await set(ref(db, `users/${user.uid}/lastSeen`), Date.now());
    }
    await signOut(auth);
  }

  async function updateProfile(updates) {
    if (!user || !userData) return;
    const next = { ...userData, ...updates };
    await set(ref(db, `users/${user.uid}`), next);
  }

  return (
    <Ctx.Provider value={{ user, userData, loading, register, login, logout, updateProfile }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
