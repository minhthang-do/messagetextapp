import React, { useEffect, useState } from 'react';
import {
  Mail,
  Lock,
  User,
  KeyRound,
  ArrowRight,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  ShieldCheck,
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

type AuthMode = 'login' | 'register' | 'verify_otp' | 'forgot' | 'reset_password';

interface AuthScreenProps {
  onAuthSuccess: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthSuccess }) => {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [otpPurpose, setOtpPurpose] = useState<'signup' | 'recovery'>('signup');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // 5-minute OTP expiration & 60s resend cooldown
  const [expiresIn, setExpiresIn] = useState(300);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (mode !== 'verify_otp') return;
    const timer = setInterval(() => {
      setExpiresIn((prev) => (prev > 0 ? prev - 1 : 0));
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [mode]);

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);

    const cleanUsername = username.trim().toLowerCase();
    const cleanEmail = email.trim().toLowerCase();

    if (!/^[a-z0-9_]{3,20}$/.test(cleanUsername)) {
      setError('Username must be 3-20 characters (letters, numbers, underscores only).');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      // Check unique username first
      const { data: existingUser } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', cleanUsername)
        .maybeSingle();

      if (existingUser) {
        throw new Error('That username is already taken. Please choose another.');
      }

      // Sign up with Supabase Auth (sends real 6-digit OTP / confirmation email)
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            username: cleanUsername,
            display_name: displayName.trim() || cleanUsername,
          },
        },
      });

      if (signUpError) throw signUpError;

      // If Supabase returned a user but no session yet, email verification is required
      if (data.user && !data.session) {
        setOtpPurpose('signup');
        setExpiresIn(300);
        setResendCooldown(60);
        setMode('verify_otp');
        setInfo(`We sent a 6-digit verification code to ${cleanEmail}. Check your inbox (and spam folder).`);
      } else if (data.user && data.session) {
        // Auto-confirmed environment fallback: upsert profile immediately
        await supabase.from('profiles').upsert({
          id: data.user.id,
          username: cleanUsername,
          email: cleanEmail,
          display_name: displayName.trim() || cleanUsername,
          status: 'online',
        });
        onAuthSuccess();
      }
    } catch (err: any) {
      setError(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (expiresIn === 0) {
      setError('This OTP has expired (5-minute limit). Please click Resend Code.');
      return;
    }
    if (otp.trim().length !== 6) {
      setError('Please enter the 6-digit code from your email.');
      return;
    }

    setLoading(true);
    try {
      const cleanEmail = email.trim().toLowerCase();
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email: cleanEmail,
        token: otp.trim(),
        type: otpPurpose === 'signup' ? 'signup' : 'recovery',
      });

      if (verifyError) throw verifyError;

      if (otpPurpose === 'recovery') {
        setMode('reset_password');
        setInfo('Email verified! Choose a new password below.');
        return;
      }

      const user = data.user;
      if (user) {
        const meta = user.user_metadata || {};
        const finalUsername = (meta.username || username || cleanEmail.split('@')[0])
          .toLowerCase()
          .replace(/[^a-z0-9_]/g, '_');
        await supabase.from('profiles').upsert({
          id: user.id,
          username: finalUsername,
          email: cleanEmail,
          display_name: meta.display_name || displayName || finalUsername,
          status: 'online',
        });
      }
      onAuthSuccess();
    } catch (err: any) {
      setError(err.message || 'Invalid or expired 6-digit OTP code.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setError(null);
    setLoading(true);
    try {
      const cleanEmail = email.trim().toLowerCase();
      if (otpPurpose === 'signup') {
        const { error: resendErr } = await supabase.auth.resend({
          type: 'signup',
          email: cleanEmail,
        });
        if (resendErr) throw resendErr;
      } else {
        const { error: resetErr } = await supabase.auth.resetPasswordForEmail(cleanEmail);
        if (resetErr) throw resetErr;
      }
      setExpiresIn(300);
      setResendCooldown(60);
      setInfo(`A fresh 6-digit OTP was sent to ${cleanEmail}.`);
    } catch (err: any) {
      setError(err.message || 'Could not resend OTP.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);

    try {
      let loginEmail = email.trim().toLowerCase();

      // Support logging in with either username or email
      if (!loginEmail.includes('@')) {
        const { data: profileRow, error: lookupErr } = await supabase
          .from('profiles')
          .select('email')
          .eq('username', loginEmail)
          .maybeSingle();

        if (lookupErr || !profileRow) {
          throw new Error('No account found with that username.');
        }
        loginEmail = profileRow.email;
        setEmail(loginEmail);
      }

      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password,
      });

      if (signInError) {
        if (signInError.message.toLowerCase().includes('email not confirmed')) {
          setOtpPurpose('signup');
          setExpiresIn(300);
          setResendCooldown(60);
          setMode('verify_otp');
          throw new Error('Please verify your email with the 6-digit OTP before signing in.');
        }
        throw signInError;
      }

      if (data.user) {
        // Ensure profile exists
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', data.user.id)
          .maybeSingle();

        if (!existingProfile) {
          const meta = data.user.user_metadata || {};
          const fallbackUser = (meta.username || loginEmail.split('@')[0]).replace(/[^a-z0-9_]/gi, '_').toLowerCase();
          await supabase.from('profiles').insert({
            id: data.user.id,
            username: fallbackUser,
            email: loginEmail,
            display_name: meta.display_name || fallbackUser,
            status: 'online',
          });
        } else {
          await supabase
            .from('profiles')
            .update({ status: 'online', last_seen: new Date().toISOString() })
            .eq('id', data.user.id);
        }
      }

      onAuthSuccess();
    } catch (err: any) {
      setError(err.message || 'Sign in failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const cleanEmail = email.trim().toLowerCase();
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(cleanEmail);
      if (resetErr) throw resetErr;
      setOtpPurpose('recovery');
      setExpiresIn(300);
      setResendCooldown(60);
      setOtp('');
      setMode('verify_otp');
      setInfo(`Password reset 6-digit OTP sent to ${cleanEmail}.`);
    } catch (err: any) {
      setError(err.message || 'Failed to send password reset email.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    try {
      const { error: updateErr } = await supabase.auth.updateUser({ password: newPassword });
      if (updateErr) throw updateErr;
      setInfo('Password updated successfully!');
      onAuthSuccess();
    } catch (err: any) {
      setError(err.message || 'Could not update password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-indigo-950/40 to-slate-950 p-4">
      <div className="w-full max-w-md bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-2xl p-7">
        {/* Brand Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/30">
            <MessageSquare className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">PulseChat</h1>
            <p className="text-xs text-slate-400">Real-Time Cloud Messaging</p>
          </div>
        </div>

        {!isSupabaseConfigured && (
          <div className="mb-5 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs leading-relaxed">
            <p className="font-semibold flex items-center gap-1.5 mb-1">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              Supabase Environment Variables Needed
            </p>
            Set <code className="bg-slate-800 px-1 rounded">VITE_SUPABASE_URL</code> and{' '}
            <code className="bg-slate-800 px-1 rounded">VITE_SUPABASE_ANON_KEY</code> in your{' '}
            <code className="bg-slate-800 px-1 rounded">.env</code> file or Vercel Project Settings to enable live
            email OTP delivery and multi-user chat.
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {info && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
            <span>{info}</span>
          </div>
        )}

        {mode === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-white">Welcome back</h2>
              <p className="text-xs text-slate-400">Sign in with your email or unique username</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Email or Username</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="text"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com or alex_dev"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-white outline-none transition"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-slate-300">Password</label>
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setInfo(null);
                    setMode('forgot');
                  }}
                  className="text-xs text-indigo-400 hover:text-indigo-300"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-white outline-none transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 transition cursor-pointer"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              Sign In
            </button>

            <p className="text-center text-xs text-slate-400 pt-2">
              Need an account?{' '}
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setInfo(null);
                  setMode('register');
                }}
                className="text-indigo-400 hover:text-indigo-300 font-medium"
              >
                Create one with Email OTP
              </button>
            </p>
          </form>
        )}

        {mode === 'register' && (
          <form onSubmit={handleRegister} className="space-y-3.5">
            <div>
              <h2 className="text-lg font-semibold text-white">Create your account</h2>
              <p className="text-xs text-slate-400">We will email a 6-digit verification code to verify your inbox</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Unique Username</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="alex_dev"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-white outline-none transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Display Name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Alex Rivera"
                className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none transition"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Real Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@gmail.com"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-white outline-none transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-white outline-none transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 transition cursor-pointer"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              Send 6-Digit Email OTP
            </button>

            <p className="text-center text-xs text-slate-400 pt-1">
              Already registered?{' '}
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setInfo(null);
                  setMode('login');
                }}
                className="text-indigo-400 hover:text-indigo-300 font-medium"
              >
                Sign In
              </button>
            </p>
          </form>
        )}

        {mode === 'verify_otp' && (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-white">Verify your email</h2>
              <p className="text-xs text-slate-400">
                Enter the 6-digit code sent to <span className="text-white font-medium">{email}</span>
              </p>
            </div>

            <div className="flex items-center justify-between text-xs bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5">
              <span className="text-slate-400">Code expires in:</span>
              <span className={`font-mono font-semibold ${expiresIn < 60 ? 'text-rose-400' : 'text-emerald-400'}`}>
                {formatTimer(expiresIn)}
              </span>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">6-Digit OTP Code</label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl pl-10 pr-3.5 py-2.5 text-center font-mono text-lg tracking-[0.4em] text-white outline-none transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || expiresIn === 0}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 transition cursor-pointer"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Verify & Continue
            </button>

            <div className="flex items-center justify-between text-xs pt-1">
              <button
                type="button"
                onClick={() => setMode('login')}
                className="text-slate-400 hover:text-slate-200"
              >
                ← Back to Login
              </button>
              <button
                type="button"
                disabled={resendCooldown > 0 || loading}
                onClick={handleResendOtp}
                className="text-indigo-400 hover:text-indigo-300 disabled:text-slate-600 font-medium"
              >
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend OTP Code'}
              </button>
            </div>
          </form>
        )}

        {mode === 'forgot' && (
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-white">Reset Password</h2>
              <p className="text-xs text-slate-400">Enter your registered email to receive a 6-digit recovery OTP</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-white outline-none transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 transition cursor-pointer"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
              Send Recovery OTP
            </button>

            <button
              type="button"
              onClick={() => setMode('login')}
              className="w-full text-center text-xs text-slate-400 hover:text-slate-200"
            >
              Back to Sign In
            </button>
          </form>
        )}

        {mode === 'reset_password' && (
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-white">Set New Password</h2>
              <p className="text-xs text-slate-400">Choose a strong new password for your account</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">New Password</label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min. 6 characters"
                className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none transition"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 transition cursor-pointer"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Save New Password
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
