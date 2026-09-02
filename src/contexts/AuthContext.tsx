import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { getOrCreateDeviceId } from '../lib/deviceId';
import type { Profile, UserRole } from '../types';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: UserRole;
  isAdmin: boolean;
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signInWithName: (fullName: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch profile from `profiles` table
  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching profile:', error.message);
        return null;
      }
      return data as Profile;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    let isMounted = true;

    // Initialize Auth state
    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (isMounted) {
          if (session?.user) {
            setSession(session);
            setUser(session.user);
            const userProfile = await fetchProfile(session.user.id);
            if (isMounted) setProfile(userProfile);
          } else {
            // Check for saved demo user in localStorage
            const savedUser = localStorage.getItem('td_auth_user');
            const savedProfile = localStorage.getItem('td_auth_profile');
            if (savedUser && savedProfile) {
              setUser(JSON.parse(savedUser));
              setProfile(JSON.parse(savedProfile));
            } else {
              setUser(null);
              setProfile(null);
            }
          }
        }
      } catch (err) {
        console.error('Auth initialization error:', err);
        const savedUser = localStorage.getItem('td_auth_user');
        const savedProfile = localStorage.getItem('td_auth_profile');
        if (savedUser && savedProfile) {
          setUser(JSON.parse(savedUser));
          setProfile(JSON.parse(savedProfile));
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    initAuth();

    // Subscribe to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!isMounted) return;
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          const userProfile = await fetchProfile(session.user.id);
          if (isMounted) setProfile(userProfile);
        } else {
          setProfile(null);
        }
        setIsLoading(false);
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const setLocalDemoUser = (demoUser: User, demoProfile: Profile) => {
    setUser(demoUser);
    setProfile(demoProfile);
    localStorage.setItem('td_auth_user', JSON.stringify(demoUser));
    localStorage.setItem('td_auth_profile', JSON.stringify(demoProfile));
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        if (error.message?.includes('Failed to fetch') || error.message?.includes('fetch') || !isSupabaseConfigured) {
          // Demo fallback for offline/unconfigured Supabase
          const demoUser = { id: 'admin-demo-id', email } as User;
          const demoProfile: Profile = {
            id: 'admin-demo-id',
            email,
            full_name: 'Admin User',
            role: 'admin',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          setLocalDemoUser(demoUser, demoProfile);
          return { success: true };
        }
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err: unknown) {
      // Demo fallback
      const demoUser = { id: 'admin-demo-id', email } as User;
      const demoProfile: Profile = {
        id: 'admin-demo-id',
        email,
        full_name: 'Admin User',
        role: 'admin',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setLocalDemoUser(demoUser, demoProfile);
      return { success: true };
    }
  };

  const signInWithName = async (fullName: string) => {
    const cleanName = fullName.trim();
    if (!cleanName) {
      return { success: false, error: 'Please enter your name.' };
    }

    const deviceId = getOrCreateDeviceId();

    // Track registered student locally
    try {
      const rawReg = localStorage.getItem('td_registered_students');
      const regList: string[] = rawReg ? JSON.parse(rawReg) : [];
      if (!regList.includes(cleanName)) {
        regList.push(cleanName);
        localStorage.setItem('td_registered_students', JSON.stringify(regList));
      }
    } catch {
      // Ignore
    }

    const slug = cleanName.toLowerCase().replace(/[^a-z0-9]/g, '.').replace(/\.+/g, '.');
    const email = `${slug}@student.college`;
    const password = `${slug}.vote2026!`;

    if (!isSupabaseConfigured) {
      // Offline/Local Demo fallback
      const demoId = `demo-${slug}`;
      const demoUser = { id: demoId, email } as User;
      const demoProfile: Profile = {
        id: demoId,
        email,
        full_name: cleanName,
        role: 'student',
        device_id: deviceId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setLocalDemoUser(demoUser, demoProfile);
      return { success: true };
    }

    try {
      // 1. Try signing in
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (!signInErr) {
        return { success: true };
      }

      // 2. If user doesn't exist, create account automatically
      const { error: signUpErr } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: cleanName,
            role: 'student',
            device_id: deviceId,
          },
        },
      });

      if (signUpErr) {
        if (signUpErr.message?.includes('Failed to fetch') || signUpErr.message?.includes('fetch')) {
          const demoId = `demo-${slug}`;
          const demoUser = { id: demoId, email } as User;
          const demoProfile: Profile = {
            id: demoId,
            email,
            full_name: cleanName,
            role: 'student',
            device_id: deviceId,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          setLocalDemoUser(demoUser, demoProfile);
          return { success: true };
        }
        return { success: false, error: signUpErr.message };
      }

      // 3. Log in after account creation
      const { error: secondSignInErr } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (secondSignInErr) {
        return { success: false, error: secondSignInErr.message };
      }

      return { success: true };
    } catch {
      // Fallback on network/fetch error
      const demoId = `demo-${slug}`;
      const demoUser = { id: demoId, email } as User;
      const demoProfile: Profile = {
        id: demoId,
        email,
        full_name: cleanName,
        role: 'student',
        device_id: deviceId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setLocalDemoUser(demoUser, demoProfile);
      return { success: true };
    }
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            role: 'student',
          },
        },
      });

      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch {
      return { success: false, error: 'Account creation failed. Please try again.' };
    }
  };

  const signOut = async () => {
    try {
      localStorage.removeItem('td_auth_user');
      localStorage.removeItem('td_auth_profile');
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      setProfile(null);
    } catch (err) {
      console.error('Sign out error:', err);
      setUser(null);
      setSession(null);
      setProfile(null);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      const updated = await fetchProfile(user.id);
      setProfile(updated);
    }
  };

  const role: UserRole = profile?.role ?? 'student';
  const isAdmin = role === 'admin';
  const isAuthenticated = !!user;

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        role,
        isAdmin,
        isAuthenticated,
        isLoading,
        signIn,
        signInWithName,
        signUp,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
}
