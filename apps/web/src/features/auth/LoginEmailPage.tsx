import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LoginSchema } from '@relay/shared';
import { useAuth } from '../../context/AuthContext'; 

export default function LoginEmailPage() {
  const nav = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = LoginSchema.safeParse({
      identifier: email.trim(), // identifier = email
      password,
    });
    if (!parsed.success) {
      setError('Bitte Eingaben prüfen.');
      return;
    }

    setBusy(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || `Login failed (${res.status})`);

      localStorage.setItem('relay-token', json.token);
      localStorage.setItem('relay-user', JSON.stringify(json.user));

      login(json.token, json.user);   
      nav('/home', { replace: true });
    } catch (e: any) {
      setError(e?.message ?? 'Login fehlgeschlagen');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-[var(--glass)] backdrop-blur-xl border border-[var(--border)] rounded-[40px] p-8">
        <h1 className="text-2xl font-black italic uppercase tracking-tight">Login</h1>
        <p className="mt-2 text-[10px] font-black uppercase tracking-[0.35em] text-[var(--text-muted)]">
          Email Login (Alternative)
        </p>

        {error && (
          <div className="mt-4 rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-sm font-bold">
            {error}
          </div>
        )}

        <form onSubmit={onSubmit} className="mt-6 space-y-3">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email"
            className="w-full rounded-2xl px-4 py-4 bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-soft)]"
          />

          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            placeholder="password"
            className="w-full rounded-2xl px-4 py-4 bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-soft)]"
          />

          <button
            disabled={busy}
            className="w-full rounded-2xl bg-[var(--primary)] text-white py-4 font-black uppercase tracking-widest text-[10px] disabled:opacity-60"
          >
            {busy ? 'LOGGING IN…' : 'LOGIN'}
          </button>
        </form>

        <div className="mt-6 flex justify-between text-xs font-black uppercase tracking-widest text-[var(--text-muted)]">
          <Link to="/signup" className="hover:text-[var(--primary)]">Create Account</Link>
          <Link to="/login" className="hover:text-[var(--primary)]">Use Username</Link>
        </div>
      </div>
    </div>
  );
}
