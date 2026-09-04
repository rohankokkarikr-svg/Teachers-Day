import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { User, Session } from '@supabase/supabase-js';
import {
  getOrCreateDeviceId,
  isDeviceBoundToDifferentStudent,
  bindDeviceToStudent,
} from '../lib/deviceId';
import {
  recordUserLoginSession,
  isSessionRevoked,
  checkUserAccessAllowed,
  updateSessionHeartbeat,
  unrevokeUserSessionLocally,
} from '../lib/sessionService';
import { toast } from '../components/ui/Toast';
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
  const userRef = useRef<User | null>(null);
  const profileRef = useRef<Profile | null>(null);

  userRef.current = user;
  profileRef.current = profile;

  // Fetch profile from `profiles` table
  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        return null;
      }
      return data as Profile;
    } catch {
      return null;
    }
  };

  const handleEnforceForcedLogout = useCallback((reason = 'Your session was ended by the administrator.') => {
    localStorage.removeItem('td_auth_user');
    localStorage.removeItem('td_auth_profile');
    if (isSupabaseConfigured) {
      supabase.auth.signOut().catch(() => {});
    }
    setUser(null);
    setSession(null);
    setProfile(null);
    toast.warning('Session Terminated', reason);
  }, []);

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
            // Check for saved user in localStorage
            const savedUser = localStorage.getItem('td_auth_user');
            const savedProfile = localStorage.getItem('td_auth_profile');
            if (savedUser && savedProfile) {
              const parsedUser = JSON.parse(savedUser);
              const parsedProfile = JSON.parse(savedProfile);
              const deviceId = getOrCreateDeviceId();

              // Check if session was revoked while offline / remotely
              if (parsedProfile.role !== 'admin') {
                const accessCheck = await checkUserAccessAllowed({
                  userId: parsedUser.id,
                  name: parsedProfile.full_name,
                  email: parsedProfile.email,
                  deviceId,
                });

                if (!accessCheck.allowed) {
                  handleEnforceForcedLogout(
                    accessCheck.reason || 'Your account access has been revoked by the administrator.'
                  );
                  return;
                }
              }

              setUser(parsedUser);
              setProfile(parsedProfile);
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
      async (event, session) => {
        if (!isMounted) return;
        setSession(session);

        if (session?.user) {
          setUser(session.user);
          const userProfile = await fetchProfile(session.user.id);
          if (isMounted) setProfile(userProfile);
        } else if (event === 'SIGNED_OUT') {
          // Explicit sign out
          setUser(null);
          setProfile(null);
          localStorage.removeItem('td_auth_user');
          localStorage.removeItem('td_auth_profile');
        } else {
          try {
            const savedUser = localStorage.getItem('td_auth_user');
            const savedProfile = localStorage.getItem('td_auth_profile');
            if (savedUser && savedProfile) {
              setUser(JSON.parse(savedUser));
              setProfile(JSON.parse(savedProfile));
            } else {
              setUser(null);
              setProfile(null);
            }
          } catch {
            setUser(null);
            setProfile(null);
          }
        }
        setIsLoading(false);
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [handleEnforceForcedLogout]);

  // Realtime Remote Logout Listener (Supabase Broadcast + PostgreSQL changes + Local custom events)
  useEffect(() => {
    const currentDeviceId = getOrCreateDeviceId();

    const checkLocalRevocation = () => {
      const currentUser = userRef.current;
      const currentProfile = profileRef.current;
      if (!currentUser || currentProfile?.role === 'admin') return;

      if (
        isSessionRevoked(
          currentUser.id,
          currentDeviceId,
          currentProfile?.full_name,
          currentProfile?.email || currentUser.email
        )
      ) {
        handleEnforceForcedLogout();
      }
    };

    // 1. Heartbeat check every 3 seconds for active student sessions
    const interval = setInterval(() => {
      const currentUser = userRef.current;
      if (currentUser) {
        checkLocalRevocation();
        updateSessionHeartbeat(currentUser.id, currentDeviceId);
      }
    }, 3000);

    // 2. Custom local window event from Admin on same/local origin
    const handleLocalRevokeEvent = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const currentUser = userRef.current;
      const currentProfile = profileRef.current;
      if (!currentUser || currentProfile?.role === 'admin') return;

      if (detail?.all) {
        handleEnforceForcedLogout('All student sessions were logged out by the administrator.');
        return;
      }

      const matchId = detail?.userId === currentUser.id;
      const matchDevice = detail?.deviceId === currentDeviceId;
      const matchEmail = detail?.email && detail?.email?.toLowerCase() === (currentProfile?.email || currentUser.email)?.toLowerCase();

      if (matchId || matchDevice || matchEmail) {
        handleEnforceForcedLogout();
        return;
      }

      if (Array.isArray(detail?.userIds) && detail.userIds.includes(currentUser.id)) {
        handleEnforceForcedLogout();
        return;
      }

      if (Array.isArray(detail?.deviceIds) && detail.deviceIds.includes(currentDeviceId)) {
        handleEnforceForcedLogout();
        return;
      }
    };

    window.addEventListener('td_user_session_revoked', handleLocalRevokeEvent);
    window.addEventListener('storage', checkLocalRevocation);
    window.addEventListener('focus', checkLocalRevocation);

    // 3. Supabase Realtime Broadcast & DB Table Subscription
    let realtimeChannel: any = null;
    if (isSupabaseConfigured) {
      realtimeChannel = supabase
        .channel('system_auth_channel')
        .on('broadcast', { event: 'force_logout' }, (payload: any) => {
          const data = payload?.payload;
          const currentUser = userRef.current;
          const currentProfile = profileRef.current;
          if (!currentUser || currentProfile?.role === 'admin') return;

          const matchId = data?.userId === currentUser.id;
          const matchDevice = data?.deviceId === currentDeviceId;
          const matchEmail = data?.email && data?.email?.toLowerCase() === (currentProfile?.email || currentUser.email)?.toLowerCase();

          if (matchId || matchDevice || matchEmail) {
            handleEnforceForcedLogout();
          }
        })
        .on('broadcast', { event: 'force_logout_batch' }, (payload: any) => {
          const data = payload?.payload;
          const currentUser = userRef.current;
          const currentProfile = profileRef.current;
          if (!currentUser || currentProfile?.role === 'admin') return;

          if (
            (Array.isArray(data?.userIds) && data.userIds.includes(currentUser.id)) ||
            (Array.isArray(data?.deviceIds) && data.deviceIds.includes(currentDeviceId))
          ) {
            handleEnforceForcedLogout();
          }
        })
        .on('broadcast', { event: 'force_logout_all' }, () => {
          const currentProfile = profileRef.current;
          if (currentProfile?.role !== 'admin') {
            handleEnforceForcedLogout('All student sessions were logged out by the administrator.');
          }
        })
        .on('broadcast', { event: 'user_access_granted' }, (payload: any) => {
          const data = payload?.payload;
          if (data?.userId || data?.deviceId || data?.email || data?.name) {
            unrevokeUserSessionLocally(data.userId, data.deviceId, data.email, data.name);
          }
        })
        .on('broadcast', { event: 'user_access_granted_batch' }, (payload: any) => {
          const data = payload?.payload;
          if (Array.isArray(data?.userIds)) {
            data.userIds.forEach((uId: string) => unrevokeUserSessionLocally(uId));
          }
        })
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'user_sessions' },
          (payload: any) => {
            const updated = payload.new;
            const currentUser = userRef.current;
            const currentProfile = profileRef.current;
            if (!currentUser || currentProfile?.role === 'admin') return;

            if (
              (updated?.user_id === currentUser.id || updated?.device_id === currentDeviceId) &&
              updated?.is_active === false
            ) {
              handleEnforceForcedLogout();
            }
          }
        )
        .subscribe();
    }

    return () => {
      clearInterval(interval);
      window.removeEventListener('td_user_session_revoked', handleLocalRevokeEvent);
      window.removeEventListener('storage', checkLocalRevocation);
      window.removeEventListener('focus', checkLocalRevocation);
      if (realtimeChannel) {
        supabase.removeChannel(realtimeChannel);
      }
    };
  }, [handleEnforceForcedLogout]);

  const setLocalDemoUser = (demoUser: User, demoProfile: Profile) => {
    setUser(demoUser);
    setProfile(demoProfile);
    localStorage.setItem('td_auth_user', JSON.stringify(demoUser));
    localStorage.setItem('td_auth_profile', JSON.stringify(demoProfile));
    recordUserLoginSession(demoProfile).catch(() => {});
  };

  const ADMIN_PASSCODE = '767614';

  const signIn = async (email: string, password: string) => {
    const cleanPass = password.trim();

    // 1. Direct Admin Master Password Check (767614)
    if (cleanPass === ADMIN_PASSCODE) {
      const adminEmail = email.trim() || 'admin@college.edu';
      const adminId = 'a0000000-0000-0000-0000-000000000001';
      const adminUser = { id: adminId, email: adminEmail } as User;
      const adminProfile: Profile = {
        id: adminId,
        email: adminEmail,
        full_name: 'Administrator',
        role: 'admin',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setLocalDemoUser(adminUser, adminProfile);

      if (isSupabaseConfigured) {
        try {
          await supabase.from('profiles').upsert(
            {
              id: adminId,
              email: adminEmail,
              full_name: 'Administrator',
              role: 'admin',
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'id' }
          );
        } catch {
          // Handled gracefully
        }
      }

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
    const slug = cleanName.toLowerCase().replace(/[^a-z0-9]/g, '.').replace(/\.+/g, '.');
    const email = `${slug}@student.college`;

    // 1. Retrieve existing student ID if present
    let studentId: string | null = null;

    if (isSupabaseConfigured) {
      try {
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', email)
          .maybeSingle();

        if (existingProfile?.id) {
          studentId = existingProfile.id;
        }
      } catch {
        // Fallback to local
      }
    }

    if (!studentId) {
      const storedId = localStorage.getItem(`td_student_id_${slug}`);
      if (storedId) {
        studentId = storedId;
      } else {
        studentId =
          typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : '33333333-0000-0000-0000-' + Math.random().toString(16).substring(2, 14).padEnd(12, '0');
        localStorage.setItem(`td_student_id_${slug}`, studentId);
      }
    }

    // 2. CRITICAL ACCESS CHECK: Check if user, name, email, or device was revoked by admin
    const accessCheck = await checkUserAccessAllowed({
      userId: studentId,
      name: cleanName,
      email,
      deviceId,
    });

    if (!accessCheck.allowed) {
      return {
        success: false,
        error:
          accessCheck.reason ||
          'Access Denied: Your account access has been revoked by the administrator. You cannot log in until an administrator grants you access.',
      };
    }

    // 3. Anti-Abuse: Check local & cookie device binding
    const deviceCheck = isDeviceBoundToDifferentStudent(cleanName);
    if (deviceCheck.isBlocked && deviceCheck.boundName) {
      return {
        success: false,
        error: `This device is already registered to "${deviceCheck.boundName}". Only 1 student account is permitted per device to ensure voting integrity.`,
      };
    }

    // 4. Anti-Abuse: Check cloud device binding in Supabase
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

    // 5. Bind this device to the student name
    bindDeviceToStudent(cleanName);

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

    // Save/Update profile to Supabase database (idempotent upsert)
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
