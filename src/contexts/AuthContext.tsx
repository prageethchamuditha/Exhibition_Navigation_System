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
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  signInAnonymously: () => Promise<void>;
  clearVisitorSession: () => Promise<void>;
  updateProfile: (data: Partial<Pick<Profile, 'name' | 'phone'>>) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

// Key used to persist anonymous visitor tokens in the browser cache
const VISITOR_SESSION_KEY = 'exnav_visitor_session';

interface CachedVisitorSession {
  access_token: string;
  refresh_token: string;
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
    let currentUserId: string | null = null;

    async function bootstrap() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!active) return;

        if (session?.user) {
          // ── Active Supabase session found — use it directly ──────────────────
          setSession(session);
          setUser(session.user);
          currentUserId = session.user.id;
          await fetchProfile(session.user.id);
        } else {
          // ── No live session — try to silently restore from visitor cache ──────
          const raw = localStorage.getItem(VISITOR_SESSION_KEY);
          if (raw) {
            try {
              const cached: CachedVisitorSession = JSON.parse(raw);
              const { data: restored, error: restoreErr } = await supabase.auth.setSession({
                access_token: cached.access_token,
                refresh_token: cached.refresh_token,
              });

              if (!restoreErr && restored?.session) {
                // Cache is valid — update with fresh tokens and set state
                localStorage.setItem(
                  VISITOR_SESSION_KEY,
                  JSON.stringify({
                    access_token: restored.session.access_token,
                    refresh_token: restored.session.refresh_token,
                  } satisfies CachedVisitorSession),
                );
                if (!active) return;
                setSession(restored.session);
                setUser(restored.session.user);
                currentUserId = restored.session.user.id;
                await fetchProfile(restored.session.user.id);
              } else {
                // Cache is stale (user may have been cleaned up) — clear it
                localStorage.removeItem(VISITOR_SESSION_KEY);
                if (!active) return;
                setSession(null);
                setUser(null);
              }
            } catch {
              localStorage.removeItem(VISITOR_SESSION_KEY);
              if (!active) return;
              setSession(null);
              setUser(null);
            }
          } else {
            if (!active) return;
            setSession(null);
            setUser(null);
          }
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
      async (event: AuthChangeEvent, session: Session | null) => {
        if (!active) return;
        
        const newUserId = session?.user?.id ?? null;
        setSession(session);
        setUser(session?.user ?? null);
        
        // Keep the localStorage cache fresh whenever Supabase auto-refreshes the JWT
        if (session && (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN')) {
          const isAnon = session.user?.is_anonymous ?? false;
          if (isAnon) {
            localStorage.setItem(
              VISITOR_SESSION_KEY,
              JSON.stringify({
                access_token: session.access_token,
                refresh_token: session.refresh_token,
              }),
            );
          }
        }

        if (newUserId) {
          const isUserChanged = newUserId !== currentUserId;
          const needsFetch = isUserChanged || event === 'SIGNED_IN' || event === 'USER_UPDATED';
          
          currentUserId = newUserId;
          
          if (needsFetch) {
            setLoading(true);
            await fetchProfile(newUserId);
            setLoading(false);
          }
        } else {
          currentUserId = null;
          setProfile(null);
        }
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

  const signIn = async (email: string, password: string): Promise<string | null> => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      console.error('Sign in error details:', error);
      const message = error.message && error.message !== '{}' 
        ? error.message 
        : 'Sign in failed. Please check your credentials and try again.';
      throw new Error(message);
    }
    // Fetch role from profile so LoginPage can redirect appropriately
    if (data?.user?.id) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .single();
      return profileData?.role ?? null;
    }
    return null;
  };

  const signOut = async () => {
    // For anonymous visitors use a LOCAL sign-out only — this clears the local
    // Supabase state without invalidating the server-side refresh_token.
    // That way our exnav_visitor_session cache remains valid and the visitor
    // is silently restored to the SAME account on their next visit.
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    const isAnon = currentSession?.user?.is_anonymous ?? false;

    const { error } = await supabase.auth.signOut(
      isAnon ? { scope: 'local' } : undefined
    );
    if (error) throw new Error(error.message || 'Failed to sign out');
    setProfile(null);
  };

  const signInAnonymously = async () => {
    // ── Step 0: Guard — bail out if there's already a live session ────────────
    const { data: { session: existing } } = await supabase.auth.getSession();
    if (existing?.user) {
      // Already authenticated (session restored by bootstrap) — nothing to do
      return;
    }

    // ── Step 1: Try to restore an existing cached visitor session ──────────────
    const raw = localStorage.getItem(VISITOR_SESSION_KEY);
    if (raw) {
      try {
        const cached: CachedVisitorSession = JSON.parse(raw);
        const { data, error } = await supabase.auth.setSession({
          access_token: cached.access_token,
          refresh_token: cached.refresh_token,
        });

        if (!error && data?.session) {
          // Existing anonymous identity restored — update cache with refreshed tokens
          localStorage.setItem(
            VISITOR_SESSION_KEY,
            JSON.stringify({
              access_token: data.session.access_token,
              refresh_token: data.session.refresh_token,
            } satisfies CachedVisitorSession),
          );
          return; // ✅ Reused old account, no new DB row created
        }

        // Cached tokens are invalid/expired — fall through to create a new session
        console.warn('Cached visitor session expired or invalid, creating a new one.');
        localStorage.removeItem(VISITOR_SESSION_KEY);
      } catch {
        // Malformed JSON — clear and create a fresh session
        localStorage.removeItem(VISITOR_SESSION_KEY);
      }
    }

    // ── Step 2: First visit (or cache cleared) — create a brand-new anonymous user ──
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) throw new Error(error.message || 'Failed to sign in anonymously');

    // ── Step 3: Persist the tokens so next visit reuses this identity ──────────
    if (data?.session) {
      localStorage.setItem(
        VISITOR_SESSION_KEY,
        JSON.stringify({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        } satisfies CachedVisitorSession),
      );
    } else {
      // signInAnonymously succeeded but returned no session object —
      // Supabase may have email-confirmation required. Log a warning.
      console.warn(
        'signInAnonymously returned no session. ' +
        'Ensure Anonymous Sign-ins are enabled in your Supabase Auth settings.'
      );
    }
  };

  // Wipe the cached visitor session and sign out (useful for a "Reset Identity" feature)
  const clearVisitorSession = async () => {
    localStorage.removeItem(VISITOR_SESSION_KEY);
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(error.message || 'Failed to sign out');
    setProfile(null);
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
        clearVisitorSession,
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
