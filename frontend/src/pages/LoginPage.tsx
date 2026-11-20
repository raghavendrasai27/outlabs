import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Layers, ShieldCheck, Zap, AlertTriangle, ArrowRight, Mail, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { devLogin } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [emailInput, setEmailInput] = useState('recruiter@reachinbox.ai');
  const [nameInput, setNameInput] = useState('ReachInbox Evaluator');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const errorParam = searchParams.get('error');

  const handleGoogleLogin = () => {
    setIsLoading(true);
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
    window.location.href = `${backendUrl}/api/auth/google`;
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim()) {
      setErrorMessage('Please enter an email address.');
      return;
    }
    setIsLoading(true);
    setErrorMessage(null);
    try {
      await devLogin(emailInput.trim(), nameInput.trim());
      navigate('/');
    } catch (err: any) {
      setErrorMessage(
        err.response?.data?.error || err.message || 'Authentication failed. Please try again.'
      );
      setIsLoading(false);
    }
  };

  const handleOneClickDemo = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      await devLogin('recruiter@reachinbox.ai', 'ReachInbox Evaluator');
      navigate('/');
    } catch (err: any) {
      setErrorMessage(
        err.response?.data?.error || err.message || 'Demo login failed. Ensure backend server is running.'
      );
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0F17] flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans">
      {/* Background ambient gradient glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative w-full max-w-md bg-slate-900/60 border border-slate-800/80 rounded-2xl p-8 shadow-2xl backdrop-blur-xl space-y-6">
        {/* Logo and Header */}
        <div className="text-center space-y-2">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center mx-auto shadow-lg shadow-indigo-600/30">
            <Layers className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-xl font-bold text-slate-100 tracking-tight">
            ReachInbox Scheduler
          </h1>
          <p className="text-xs text-slate-400">
            Distributed Email Job Scheduler & Rate Limiting Engine
          </p>
        </div>

        {(errorParam || errorMessage) && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-400 text-xs flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            <span>{errorMessage || errorParam}</span>
          </div>
        )}

        {/* 1. Direct Email Sign In Form */}
        <form onSubmit={handleEmailLogin} className="space-y-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-300 mb-1">
              Work Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
              <input
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="you@company.com"
                required
                className="w-full pl-9 pr-3 py-2 bg-slate-950/80 border border-slate-700/80 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-300 mb-1">
              Your Name
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="Full Name"
                className="w-full pl-9 pr-3 py-2 bg-slate-950/80 border border-slate-700/80 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-lg shadow-indigo-600/20 transition-all disabled:opacity-50"
          >
            <span>{isLoading ? 'Signing in...' : 'Sign In with Email'}</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </form>

        <div className="relative flex py-1 items-center">
          <div className="flex-grow border-t border-slate-800" />
          <span className="flex-shrink mx-3 text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
            Or Quick Access
          </span>
          <div className="flex-grow border-t border-slate-800" />
        </div>

        {/* 2. One-Click Instant Demo Button */}
        <button
          type="button"
          onClick={handleOneClickDemo}
          disabled={isLoading}
          className="w-full flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-indigo-950/50 to-purple-950/50 hover:from-indigo-900/60 hover:to-purple-900/60 border border-indigo-500/40 text-indigo-300 rounded-lg text-xs font-semibold transition-all hover:scale-[1.01]"
        >
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-indigo-400" />
            <span>One-Click Hiring Demo Sign In</span>
          </div>
          <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-1.5 py-0.5 rounded font-mono">
            Instant
          </span>
        </button>

        <div className="relative flex py-1 items-center">
          <div className="flex-grow border-t border-slate-800" />
          <span className="flex-shrink mx-3 text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
            OAuth 2.0
          </span>
          <div className="flex-grow border-t border-slate-800" />
        </div>

        {/* 3. Real Google OAuth 2.0 Button */}
        <div>
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-3 px-4 py-2 bg-white hover:bg-slate-100 text-slate-900 rounded-lg text-xs font-semibold shadow-md transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Sign in with Google</span>
          </button>
          <p className="text-[10px] text-slate-500 text-center mt-1.5">
            (Requires configured GOOGLE_CLIENT_ID in backend/.env)
          </p>
        </div>

        {/* Feature Highlights */}
        <div className="pt-4 border-t border-slate-800 space-y-1.5 text-[11px] text-slate-400">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
            <span>BullMQ Redis-backed persistent delayed jobs</span>
          </div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
            <span>Atomic Redis Lua per-sender hourly rate limiting</span>
          </div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
            <span>Server restart recovery & automatic job reconciliation</span>
          </div>
        </div>
      </div>
    </div>
  );
};
