import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { UserProfile } from '../types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdministrator: boolean;
  isSupervisor: boolean;
  isTeller: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, profile: null, loading: true, isAdministrator: false, isSupervisor: false, isTeller: false });

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUser(user);
        const profileRef = doc(db, 'users', user.uid);
        const profileSnap = await getDoc(profileRef);
        
        if (profileSnap.exists()) {
          setProfile(profileSnap.data() as UserProfile);
        } else {
          // Self-register as Teller if no profile exists
          const newProfile: UserProfile = {
            uid: user.uid,
            email: user.email!,
            displayName: user.displayName,
            role: 'Teller',
            branchId: 'main' // Default to main branch to avoid undefined errors
          };
          await setDoc(profileRef, newProfile);
          setProfile(newProfile);
        }
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const isAdministrator = profile?.role === 'Administrator';
  const isSupervisor = profile?.role === 'Supervisor';
  const isTeller = profile?.role === 'Teller';

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAdministrator, isSupervisor, isTeller }}>
      {children}
    </AuthContext.Provider>
  );
};
