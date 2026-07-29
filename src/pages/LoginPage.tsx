import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { MapPin, Mail, Lock, Eye, EyeOff, LogIn, UserX, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export function LoginPage() {
  const { signIn, signInAnonymously } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/';

  const isAdmin = window.location.pathname.includes('/admin');

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [anonLoading, setAnonLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      let loginIdentifier = username;
      if (!username.includes('@')) {
        if (username === 'cipherx.mora') {
          loginIdentifier = 'cipherx.mora@gmail.com';
        } else {
          loginIdentifier = `${username}@exnav.local`;
        }
      }

      const role = await signIn(loginIdentifier, password);

      // Redirect based on role
      if (role === 'admin') {
        navigate('/dashboard', { replace: true });
      } else {
        // store_admin and visitors both go to the homepage
        navigate(from === '/login' ? '/' : (from || '/'), { replace: true });
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Sign in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };


  const handleAnonymous = async () => {
    setError('');
    setAnonLoading(true);
    try {
      await signInAnonymously();
      navigate(from, { replace: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not start guest session.');
    } finally {
      setAnonLoading(false);
    }
  };

  return (
    <div className="auth-bg">
      <div className="auth-card glass">
        {/* Brand */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
          <div className="brand-icon">
            <MapPin size={26} color="#fff" />
          </div>
          <div style={{ text_align: 'center' } as any}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
              Welcome back
            </h1>
            <p style={{ color: 'var(--color-muted)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
              {isAdmin ? 'Sign in to the Admin Portal' : 'Sign in to your ExNav account'}
            </p>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="alert alert-error" style={{ marginBottom: '1.25rem' }}>
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="form-group">
            <label className="form-label" htmlFor="login-username">
              {isAdmin ? 'Username' : 'Username or Email'}
            </label>
            <div style={{ position: 'relative' }}>
              {isAdmin ? (
                <User
                  size={16}
                  style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-muted)' }}
                />
              ) : (
                <Mail
                  size={16}
                  style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-muted)' }}
                />
              )}
              <input
                id="login-username"
                type="text"
                className="form-input"
                placeholder={isAdmin ? 'admin_username' : 'Username or email'}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="username"
                style={{ paddingLeft: '2.5rem' }}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="login-password">Password</label>
            <div style={{ position: 'relative' }}>
              <Lock
                size={16}
                style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-muted)' }}
              />
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                className="form-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                style={{ paddingLeft: '2.5rem', paddingRight: '2.75rem' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                style={{
                  position: 'absolute',
                  right: '0.9rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-muted)',
                  cursor: 'pointer',
                  padding: 0,
                  lineHeight: 1,
                }}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            id="login-submit"
            type="submit"
            className="btn btn-primary btn-full"
            disabled={loading}
            style={{ marginTop: '0.5rem' }}
          >
            {loading ? <span className="spinner" /> : <LogIn size={16} />}
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        {!isAdmin && (
          <>
            {/* Divider */}
            <div className="divider" style={{ margin: '1.25rem 0' }}>or</div>

            {/* Anonymous */}
            <button
              id="login-guest"
              type="button"
              className="btn btn-ghost btn-full"
              onClick={handleAnonymous}
              disabled={anonLoading}
            >
              {anonLoading ? <span className="spinner" style={{ borderTopColor: 'var(--color-text)' }} /> : <UserX size={16} />}
              {anonLoading ? 'Starting session…' : 'Continue as Guest'}
            </button>

            {/* Register link */}
            <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.875rem', color: 'var(--color-muted)' }}>
              Don't have an account?{' '}
              <Link
                to="/register"
                style={{ color: 'var(--color-primary-h)', fontWeight: 600, textDecoration: 'none' }}
              >
                Create one
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
