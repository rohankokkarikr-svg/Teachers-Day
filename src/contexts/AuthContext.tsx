import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { User, Session } from '@supabase/supabase-js';
import {
  getOrCreateDeviceId,
  isDeviceBoundToDifferentStudent,
  bindDeviceToStudent,
} from '../lib/deviceId';
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

  const ADMIN_PASSCODE = '767614';

  const signIn = async (email: string, password: string) => {
    const cleanPass = password.trim();

    // 1. Direct Admin Master Password Check (767614)
    if (cleanPass === ADMIN_PASSCODE) {
      const adminEmail = email.trim() || 'admin@college.edu';
      const adminUser = { id: 'admin-master-id', email: adminEmail } as User;
      const adminProfile: Profile = {
        id: 'admin-master-id',
        email: adminEmail,
        full_name: 'Administrator',
        role: 'admin',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setLocalDemoUser(adminUser, adminProfile);
      return { success: true };
    }

    if (!isSupabaseConfigured) {
      return {
        success: false,
        error: 'Invalid admin passcode. Please try again.',
      };
    }

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: cleanPass,
      });

      if (error) {
        return {
          success: false,
          error: 'Invalid admin credentials. Please try again.',
        };
      }
      return { success: true };
    } catch {
      return {
        success: false,
        error: 'Invalid admin credentials. Please try again.',
      };
    }
  };

  const signInWithName = async (fullName: string) => {
    const cleanName = fullName.trim();
    if (!cleanName) {
      return { success: false, error: 'Please enter your name.' };
    }
    if (cleanName.length < 2) {
      return { success: false, error: 'Name must be at least 2 characters long.' };
    }

    const deviceId = getOrCreateDeviceId();

    // 1. Anti-Abuse: Check local & cookie device binding
    const deviceCheck = isDeviceBoundToDifferentStudent(cleanName);
    if (deviceCheck.isBlocked && deviceCheck.boundName) {
      return {
        success: false,
        error: `This device is already registered to "${deviceCheck.boundName}". Only 1 student account is permitted per device to ensure voting integrity.`,
      };
    }

    // 2. Anti-Abuse: Check cloud device binding in Supabase
    if (isSupabaseConfigured) {
      try {
        const { data: cloudProfiles } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('device_id', deviceId)
          .limit(1);

        if (cloudProfiles && cloudProfiles.length > 0) {
          const registeredName = cloudProfiles[0].full_name;
          const currentSlug = cleanName.toLowerCase().replace(/[^a-z0-9]/g, '.').replace(/\.+/g, '.');
          const registeredSlug = (registeredName || '').toLowerCase().replace(/[^a-z0-9]/g, '.').replace(/\.+/g, '.');

          if (registeredSlug && registeredSlug !== currentSlug) {
            return {
              success: false,
              error: `This device is already registered to "${registeredName}". Only 1 account is permitted per device.`,
            };
          }
        }
      } catch {
        // Fallback to local device binding check
      }
    }

    // 3. Bind this device to the student name
    bindDeviceToStudent(cleanName);

    const slug = cleanName.toLowerCase().replace(/[^a-z0-9]/g, '.').replace(/\.+/g, '.');
    const email = `${slug}@student.college`;
    
    // Generate valid UUID for student profile
    const studentId = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : '33333333-0000-0000-0000-' + Math.random().toString(16).substring(2, 14).padEnd(12, '0');

    const studentUser = {
      id: studentId,
      email,
      user_metadata: { full_name: cleanName, role: 'student', device_id: deviceId },
    } as unknown as User;

    const studentProfile: Profile = {
      id: studentId,
      email,
      full_name: cleanName,
      role: 'student',
      device_id: deviceId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setLocalDemoUser(studentUser, studentProfile);

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

    // Save profile to Supabase database
    if (isSupabaseConfigured) {
      try {
        await supabase.from('profiles').upsert(
          {
            id: studentId,
            email,
            full_name: cleanName,
            role: 'student',
            device_id: deviceId,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        );
      } catch {
        // Handled gracefully
      }
    }

    return { success: true };
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
