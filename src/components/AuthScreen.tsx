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

      // Sign up with Supabase Auth (sends real 8-digit OTP / confirmation email)
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
        setInfo(`We sent an 8-digit verification code to ${cleanEmail}. Check your inbox (and spam folder).`);
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
    if (otp.trim().length < 6) {
      setError('Please enter the 8-digit code from your email.');
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
      setError(err.message || 'Invalid or expired OTP code.');
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
      setInfo(`A fresh 8-digit OTP was sent to ${cleanEmail}.`);
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
          throw new Error('Please verify your email with the 8-digit OTP before signing in.');
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
      setInfo(`Password reset 8-digit OTP sent to ${cleanEmail}.`);
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

  const handleGoogleSignIn = async () => {
    setError(null);
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });
    if (oauthError) setError(oauthError.message);
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
          <div className="mb-5 p-3.5 rounded-xl bg
