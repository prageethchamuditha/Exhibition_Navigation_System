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
    let active = true;

    async function bootstrap() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!active) return;
        
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          await fetchProfile(session.user.id);
        }
      } catch (err) {
        console.error('Error bootstrapping auth:', err);
      } finally {
        if (active) setLoading(false);
      }
    }

    bootstrap();

    // Listen for auth state changes (login / logout / token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event: AuthChangeEvent, session: Session | null) => {
        if (!active) return;
        setLoading(true);
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchProfile(session.user.id);
        } else {
          setProfile(null);
        }
        setLoading(false);
      }
    );

    return () => {
      active = false;
      subscription.unsubscribe();
    };
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
    if (error) {
      console.error('Sign up error details:', error);
      const message = error.message && error.message !== '{}' 
        ? error.message 
        : 'Unexpected signup failure. If you configured SMTP, check your SMTP credentials or logs.';
      throw new Error(message);
    }
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      console.error('Sign in error details:', error);
      const message = error.message && error.message !== '{}' 
        ? error.message 
        : 'Sign in failed. Please check your credentials and try again.';
      throw new Error(message);
    }
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(error.message || 'Failed to sign out');
    setProfile(null);
  };

  const signInAnonymously = async () => {
    const { error } = await supabase.auth.signInAnonymously();
    if (error) throw new Error(error.message || 'Failed to sign in anonymously');
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
