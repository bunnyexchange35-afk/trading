import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Fingerprint, ScanFace, ShieldAlert, LogIn, KeyRound } from 'lucide-react';
import MatrixRain from '../components/MatrixRain';
import Logo from '../components/Logo';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import { api } from '../lib/api';
import { fmtDateTime, timeAgo } from '../lib/format';

export default function Login() {
  const { staff, login, verifyMfa } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mfaToken, setMfaToken] = useState('');
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<{ lastLogin?: { time: string; ip: string; location: string } | null; version?: string; lockdown?: boolean } | null>(null);
  const [lockdownOpen, setLockdownOpen] = useState(false);
  const [lockPw, setLockPw] = useState('');

  useEffect(() => {
    if (staff) navigate('/', { replace: true });
    api.get<{ data: { lastLogin: { time: string; ip: string; location: string } | null; version: string; lockdown: boolean } }>('/auth/status')
      .then((r) => setStatus(r.data))
      .catch(() => undefined);
  }, [staff, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await login(username, password);
      if (res.mfaRequired) {
        setMfaToken(res.tempToken ?? '');
        toast.push('info', 'Multi-factor verification required');
      } else {
        toast.push('success', 'Welcome back, Master Admin');
        navigate('/', { replace: true });
      }
    } catch (err) {
      toast.push('error', err instanceof Error ? err.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  const submitMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await verifyMfa(mfaToken, code);
      toast.push('success', 'Verified. Welcome back, Master Admin');
      navigate('/', { replace: true });
    } catch (err) {
      toast.push('error', err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setBusy(false);
    }
  };

  const hook = (name: string, path: string) => async () => {
    try {
      const r = await api.post<{ data: { message: string } }>(path);
      toast.push('info', r.data.message);
    } catch (err) {
      toast.push('error', err instanceof Error ? err.message : 'Not available');
    }
  };

  const triggerLockdown = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api.post<{ data: { message: string } }>('/auth/lockdown', { password: lockPw });
      toast.push('error', r.data.message);
      setLockdownOpen(false);
      setLockPw('');
      setStatus((s) => (s ? { ...s, lockdown: true } : s));
    } catch (err) {
      toast.push('error', err instanceof Error ? err.message : 'Lockdown failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <MatrixRain />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(5,7,13,0.9)_100%)]" />

      <div className="relative w-full max-w-md">
        <div className="glass border-ink-500/80 bg-ink-900/80 p-6 shadow-card sm:p-8">
          <div className="mb-6 flex justify-center">
            <Logo />
          </div>

          <h1 className="text-center font-display text-lg font-semibold text-slate-100">
            Welcome, <span className="text-neon-green neon-text">Master Admin</span>
          </h1>
          <p className="mt-1 text-center text-sm text-slate-500">of Hype Coin Control</p>

          {status?.lockdown && (
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-neon-red/40 bg-neon-red/10 px-3 py-2 text-xs text-neon-red">
              <ShieldAlert className="h-4 w-4" /> Emergency lockdown is active.
            </div>
          )}

          {!mfaToken ? (
            <form onSubmit={submit} className="mt-6 space-y-4">
              <div>
                <label className="hcc-label">Email or username</label>
                <input
                  className="hcc-input"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="master"
                  autoComplete="username"
                  required
                />
              </div>
              <div>
                <label className="hcc-label">Password</label>
                <div className="relative">
                  <input
                    className="hcc-input pr-10"
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••"
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                  >
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={busy} className="hcc-btn-primary w-full">
                {busy ? 'Authenticating…' : (<><LogIn className="h-4 w-4" /> Sign in securely</>)}
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={hook('Passkey', '/auth/passkey/register')} className="hcc-btn-ghost text-xs">
                  <Fingerprint className="h-4 w-4" /> Passkey
                </button>
                <button type="button" onClick={hook('Face scan', '/auth/face-scan/enroll')} className="hcc-btn-ghost text-xs">
                  <ScanFace className="h-4 w-4" /> Face scan
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={submitMfa} className="mt-6 space-y-4">
              <div className="rounded-lg border border-neon-cyan/30 bg-neon-cyan/5 p-3 text-center">
                <KeyRound className="mx-auto h-6 w-6 text-neon-cyan" />
                <p className="mt-1 text-sm text-slate-300">Enter the 6-digit code from your authenticator.</p>
                <p className="text-xs text-slate-500">Demo code: <span className="font-mono text-neon-cyan">123456</span></p>
              </div>
              <input
                className="hcc-input text-center font-mono text-lg tracking-[0.5em]"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                autoFocus
                required
              />
              <button type="submit" disabled={busy} className="hcc-btn-cyan w-full">
                {busy ? 'Verifying…' : 'Verify & continue'}
              </button>
            </form>
          )}

          <div className="mt-5 rounded-lg border border-ink-600/70 bg-ink-950/60 px-3 py-2.5 text-center text-[11px] text-slate-500">
            <p className="text-slate-400">Demo access</p>
            <p className="mt-0.5 font-mono">master / Master@123 · n.kane / Admin@123</p>
          </div>
        </div>

        {/* Last login + lockdown panic */}
        <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-slate-500">
          {status?.lastLogin ? (
            <span>
              Last login: {fmtDateTime(status.lastLogin.time)} ({timeAgo(status.lastLogin.time)}) · {status.lastLogin.ip} · {status.lastLogin.location}
            </span>
          ) : (
            <span>v{status?.version ?? '2.4.1'}</span>
          )}
          <button
            onClick={() => setLockdownOpen((v) => !v)}
            className="shrink-0 rounded-md border border-neon-red/40 bg-neon-red/10 px-2.5 py-1 font-semibold text-neon-red transition hover:bg-neon-red/20"
          >
            <ShieldAlert className="mr-1 inline h-3.5 w-3.5" /> Emergency Lockdown
          </button>
        </div>

        {lockdownOpen && (
          <form onSubmit={triggerLockdown} className="glass mt-2 border-neon-red/40 bg-ink-900/90 p-3 fade-up">
            <p className="mb-2 text-xs text-slate-400">Confirm master password to freeze <strong className="text-neon-red">all</strong> user actions.</p>
            <div className="flex gap-2">
              <input
                className="hcc-input"
                type="password"
                placeholder="Master password"
                value={lockPw}
                onChange={(e) => setLockPw(e.target.value)}
                required
              />
              <button type="submit" disabled={busy} className="hcc-btn-danger shrink-0">
                {busy ? '…' : 'Lockdown'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
