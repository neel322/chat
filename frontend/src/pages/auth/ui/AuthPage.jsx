import React, { useState } from 'react';
import { useAuthStore } from '../../../entities/user/model/useAuthStore';

export const AuthPage = () => {
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [identifier, setIdentifier] = useState(''); // email in signup, email/handle in signin
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [ error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const login = useAuthStore((state) => state.login);
  const register = useAuthStore((state) => state.register);

  const validateForm = () => {
    if (mode === 'signup') {
      const usernameRegex = /^[a-zA-Z0-9_-]{3,20}$/;
      if (!username.trim()) {
        return 'Username is required.';
      }
      if (!usernameRegex.test(username.trim())) {
        return 'Username must be 3-20 characters long and contain only letters, numbers, underscores, or hyphens.';
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!identifier.trim() || !emailRegex.test(identifier.trim())) {
        return 'Please enter a valid email address.';
      }

      const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
      if (!passwordRegex.test(password)) {
        return 'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, and one number.';
      }
    } else {
      if (!identifier.trim()) {
        return 'Please enter your handle or email address.';
      }
      if (!password) {
        return 'Password is required.';
      }
    }
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const clientError = validateForm();
    if (clientError) {
      setError(clientError);
      return;
    }

    setLoading(true);
    try {
      if (mode === 'signin') {
        await login(identifier.trim(), password);
      } else {
        await register(username.trim(), identifier.trim().toLowerCase(), password);
      }
    } catch (err) {
      console.error('Auth error caught:', err);
      // Catch backend error response or fallback
      const serverMsg = err.response?.data?.error || err.message || 'Authentication failed.';
      setError(serverMsg);
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (str) => {
    const clean = (str || '').trim().replace(/^@+/, '');
    if (!clean) return 'PC';
    const words = clean.split(/[._\s-]+/).filter(Boolean);
    if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
    return clean.slice(0, 2).toUpperCase();
  };

  return (
    <div className="bg-[#0f131d] font-sans text-[#dfe2f1] min-h-dvh w-full relative flex flex-col justify-between overflow-y-auto"> 
    {/* Background Glows */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[720px] h-[360px] bg-[#00f0ff]/10 blur-[140px] rounded-full"></div>
        <div className="absolute bottom-0 right-0 w-[420px] h-[420px] bg-[#0566d9]/10 blur-[160px] rounded-full"></div>
      </div>

      {/* Header */}
      <header className="relative z-10 w-full px-6 md:px-12 py-5 flex items-center justify-between border-b border-white/[0.05]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#262a35] border border-white/10 flex items-center justify-center text-[#00f0ff] shadow-[0_0_12px_rgba(0,240,255,0.25)]">
            <span className="material-symbols-outlined text-[20px]">bolt</span>
          </div>
          <span className="font-bold text-lg text-white tracking-tight">Pulse<span className="text-[#00f0ff]">Chat</span></span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#00f0ff] animate-pulse"></span>
          <span className="text-xs text-slate-400 font-mono uppercase tracking-wider hidden sm:inline">Gateway Protected</span>
        </div>
      </header>

      {/* Main Terminal Container */}
      <main className="relative z-10 flex-1 flex items-center justify-center w-full px-4 py-8">
        <div className="relative w-full max-w-[960px] grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          
          {/* Left Column */}
          <div className="lg:col-span-5 flex flex-col justify-between h-full py-2 order-2 lg:order-1 space-y-6">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#262a35] text-[#00dbe9] text-xs font-mono uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00f0ff] animate-ping"></span>
                Pulse Protocol v2.8
              </div>
              <h1 className="text-3xl font-bold text-white tracking-tight leading-tight">
                Next-generation <span className="text-[#00f0ff]">direct media</span> & messaging network.
              </h1>
              <p className="text-sm text-slate-400 leading-relaxed">
                Unique identity verified at database layer. Sub-10ms socket dispatch with encrypted endpoints.
              </p>
            </div>
          </div>

          {/* Right Column: Form Card */}
          <div className="lg:col-span-7 order-1 lg:order-2">
            <div className="w-full bg-[#171b26] rounded-2xl shadow-2xl p-6 sm:p-8 relative border border-white/[0.08] overflow-hidden">
              <div className="absolute -right-20 -top-20 w-48 h-48 bg-[#00f0ff]/10 rounded-full blur-3xl pointer-events-none"></div>

              {/* Mode Toggle */}
              <div className="flex items-center justify-between gap-3 mb-6">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-md bg-[#262a35] flex items-center justify-center text-[#00f0ff]">
                    <span className="material-symbols-outlined text-[18px]">chat_bubble</span>
                  </div>
                  <div className="text-sm font-bold text-white">Pulse<span className="text-[#00f0ff]">Auth</span></div>
                </div>

                <div className="flex items-center p-1 bg-[#0f131d] rounded-xl border border-white/[0.06]">
                  <button
                    onClick={() => { setMode('signin'); setError(null); }}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      mode === 'signin' ? 'bg-[#262a35] text-white shadow-sm' : 'text-slate-400 hover:text-white'
                    }`}
                    type="button"
                  >
                    Sign In
                  </button>
                  <button
                    onClick={() => { setMode('signup'); setError(null); }}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      mode === 'signup' ? 'bg-[#262a35] text-white shadow-sm' : 'text-slate-400 hover:text-white'
                    }`}
                    type="button"
                  >
                    Create Account
                  </button>
                </div>
              </div>

              <div className="mb-5">
                <h2 className="text-xl font-bold text-white tracking-tight">
                  {mode === 'signin' ? 'Access Terminal' : 'Initialize Account'}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {mode === 'signin' ? 'Sign in with your verified pulse handle or email.' : 'Claim your unique handle & secure credentials.'}
                </p>
              </div>

              {/* Error Box */}
              {error && (
                <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-medium leading-relaxed">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {mode === 'signup' && (
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-medium text-slate-300" htmlFor="username-input">Pulse Handle</label>
                      <span className="text-[10px] text-[#00dbe9] font-mono">3-20 chars, letters/nums/_</span>
                    </div>
                    <div className="relative flex items-center">
                      <span className="absolute left-3 text-slate-500 font-mono text-xs">@</span>
                      <input
                        id="username-input"
                        name="username"
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="alexrivera"
                        className="w-full pl-7 pr-3 py-2.5 rounded-xl bg-[#0f131d] text-white text-xs border border-white/[0.08] focus:border-[#00f0ff] focus:outline-none transition-all"
                        required
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300" htmlFor="identity-input">
                    {mode === 'signin' ? 'Handle or Email Address' : 'Email Address'}
                  </label>
                  <div className="relative flex items-center">
                    <span className="material-symbols-outlined absolute left-3 text-[18px] text-slate-500">alternate_email</span>
                    <input
                      id="identity-input"
                      name="email"
                      type={mode === 'signup' ? 'email' : 'text'}
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder="alex@pulse.dev"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#0f131d] text-white text-xs border border-white/[0.08] focus:border-[#00f0ff] focus:outline-none transition-all"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-medium text-slate-300" htmlFor="password-input">Password Token</label>
                    {mode === 'signup' && (
                      <span className="text-[10px] text-slate-400 font-mono">Min 8 chars, 1 uppercase, 1 number</span>
                    )}
                  </div>
                  <div className="relative flex items-center">
                    <span className="material-symbols-outlined absolute left-3 text-[18px] text-slate-500">vpn_key</span>
                    <input
                      id="password-input"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full pl-9 pr-10 py-2.5 rounded-xl bg-[#0f131d] text-white text-xs border border-white/[0.08] focus:border-[#00f0ff] focus:outline-none transition-all"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {showPassword ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#00f0ff] hover:bg-[#00dbe9] text-[#00363a] font-bold text-xs transition-all shadow-[0_0_15px_rgba(0,240,255,0.3)] flex items-center justify-center gap-2 group disabled:opacity-50 mt-2"
                >
                  <span>{loading ? 'Validating credentials...' : mode === 'signin' ? 'Sign In to PulseChat' : 'Create PulseChat Account'}</span>
                  <span className="material-symbols-outlined text-[18px] transition-transform group-hover:translate-x-0.5">arrow_forward</span>
                </button>
              </form>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
};