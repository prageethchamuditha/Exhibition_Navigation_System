import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { type User, type Session, type AuthChangeEvent } from '@supabase/supabase-js';
import { supabase, type Profile } from '../lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signUp: (email: string, password: string, name: string, phone?: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  signInAnonymously: () => Promise<void>;
  updateProfile: (data: Partial<Pick<Profile, 'name' | 'phone'>>) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch profile from public.profiles
  const fetchProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      // PGRST116 = no rows found — not a fatal error on first load
      if (error.code !== 'PGRST116') {
        console.error('fetchProfile error:', error.code, error.message);
      }
      return;
    }
    setProfile(data as Profile);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) await fetchProfile(user.id);
  }, [user, fetchProfile]);

  // Bootstrap auth state on mount
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }: { data: { session: import('@supabase/supabase-js').Session | null } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      setLoading(false);
    });

    // Listen for auth state changes (login / logout / token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session: Session | null) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          fetchProfile(session.user.id);
        } else {
          setProfile(null);
        }
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  // ── Auth Actions ──────────────────────────────────────────────────────────

  const signUp = async (email: string, password: string, name: string, phone?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, phone: phone ?? null, is_anonymous: false },
      },
    });
    if (error) throw new Error(error.message);
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(error.message);
    setProfile(null);
  };

  const signInAnonymously = async () => {
    const { error } = await supabase.auth.signInAnonymously();
    if (error) throw new Error(error.message);
  };

  const updateProfile = async (data: Partial<Pick<Profile, 'name' | 'phone'>>) => {
    if (!user) throw new Error('Not authenticated');

    // Step 1: Try a simple UPDATE first (works when profile row exists)
    const { data: updatedRows, error: updateError } = await supabase
      .from('profiles')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', user.id)
      .select('id');  // returning data lets us detect silent RLS blocks

    if (updateError) {
      // Surface the real Supabase error message
      throw new Error(`Database error: ${updateError.message} (code: ${updateError.code})`);
    }

    // Step 2: If UPDATE matched 0 rows, the profile row is missing — INSERT it
    if (!updatedRows || updatedRows.length === 0) {
      const { error: insertError } = await supabase
        .from('profiles')
        .insert({
          id: user.id,
          ...data,
          role: 'visitor',
          is_anonymous: false,
          updated_at: new Date().toISOString(),
        });

      if (insertError) {
        throw new Error(
          `Could not create profile: ${insertError.message} (code: ${insertError.code}). ` +
          `Make sure you ran the SQL schema in Supabase and the RLS fix in database/fix_rls_update.sql.`
        );
      }
    }

    // Refresh local profile state
    await fetchProfile(user.id);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        signUp,
        signIn,
        signOut,
        signInAnonymously,
        updateProfile,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
