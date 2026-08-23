import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { UserProfile, UserRole } from '../types';

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
          const data = profileSnap.data();
          // Auto migrate legacy roles
          let role = data.role as string;
          let needsUpdate = false;
          if (role === 'admin') {
            role = 'Administrator';
            needsUpdate = true;
          } else if (role === 'manager') {
            role = 'Supervisor';
            needsUpdate = true;
          } else if (role === 'clerk') {
            role = 'Teller';
            needsUpdate = true;
          }

          if (needsUpdate) {
            try {
              await updateDoc(profileRef, { role: role });
            } catch (err) {
              console.error("Auto role migration failed", err);
            }
          }
          
          setProfile({
            uid: user.uid,
            email: user.email || '',
            displayName: user.displayName,
            role: (role as UserRole) || 'Teller',
            branchId: data.branchId
          });
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
  const isSupervisor = profile?.role === 'Supervisor' || profile?.role === 'Administrator';
  const isTeller = profile?.role === 'Teller';

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAdministrator, isSupervisor, isTeller }}>
      {children}
    </AuthContext.Provider>
  );
};
