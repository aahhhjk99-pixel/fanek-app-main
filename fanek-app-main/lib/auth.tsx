import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/types/database';
import type { Session } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const REMEMBERED_PHONE_KEY = 'fanek.remembered_phone';

interface AuthContextType {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  deleteAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
  deleteAccount: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error loading profile:', error);
        return;
      }

      const profileData = data as Profile | null;
      if (profileData && profileData.account_status === 'banned') {
        await supabase.auth.signOut();
        setSession(null);
        setProfile(null);
        return;
      }

      setProfile(profileData);
    } catch (err) {
      console.error('Exception in loadProfile:', err);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (session?.user?.id) {
      await loadProfile(session.user.id);
    }
  }, [session, loadProfile]);

  useEffect(() => {
    let isMounted = true;

    // 1. تهيئة الجلسة عند فتح التطبيق
    const initAuth = async () => {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();

        if (!isMounted) return;

        if (currentSession?.user?.id) {
          setSession(currentSession);
          await loadProfile(currentSession.user.id);
        } else {
          setSession(null);
          setProfile(null);
        }
      } catch (err) {
        console.error('Auth initialization error:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    initAuth();

    // 2. الاستماع التلقائي لتغييرات حالة الدخول والتسجيل
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!isMounted) return;

      setSession(newSession);

      if (newSession?.user?.id) {
        await loadProfile(newSession.user.id);
      } else {
        setProfile(null);
      }

      setLoading(false);
    });

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error('Error during signOut:', e);
    }
    setProfile(null);
    setSession(null);
    if (Platform.OS === 'web') {
      try { localStorage.clear(); } catch {}
    }
    await AsyncStorage.removeItem(REMEMBERED_PHONE_KEY).catch(() => {});
  }, []);

  const deleteAccount = useCallback(async () => {
    if (!session?.user?.id) return;
    const token = session.access_token;
    const supabaseUrl =
      process.env.EXPO_PUBLIC_SUPABASE_URL ||
      process.env.VITE_SUPABASE_URL ||
      process.env.SUPABASE_URL ||
      '';

    const response = await fetch(`${supabaseUrl}/functions/v1/delete-user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ userId: session.user.id }),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok || result?.error) {
      throw new Error(result?.error || 'فشل حذف الحساب');
    }

    try {
      await supabase.auth.signOut();
    } catch {}

    setProfile(null);
    setSession(null);
    if (Platform.OS === 'web') {
      try { localStorage.clear(); } catch {}
    }
  }, [session]);

  return (
    <AuthContext.Provider value={{ session, profile, loading, signOut, refreshProfile, deleteAccount }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}