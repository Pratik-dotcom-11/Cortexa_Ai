import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { Modal } from '../common/Modal.tsx';
import { Mail, Lock, User, ArrowRight, AlertCircle } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'google' | 'email' | 'demo';
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const {
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    signInAsDemoStudent,
    isSigningIn,
    authError,
    clearAuthError,
  } = useAuth();

  const [mode, setMode] = useState<'signin' | 'signup' | 'demo'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');

  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle();
      onClose();
    } catch {
      // Handled inside AuthContext
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    try {
      if (mode === 'signin') {
        await signInWithEmail(email, password);
      } else {
        await signUpWithEmail(email, password, displayName);
      }
      onClose();
    } catch {
      // Handled in context
    }
  };

  const handleDemoLaunch = async (role: string) => {
    try {
      await signInAsDemoStudent(role);
      onClose();
    } catch (err) {
      console.warn('Demo student launch:', err);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Welcome to Cortexa AI">
      <div className="space-y-5">
        {authError && (
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p>{authError}</p>
            </div>
            <button
              onClick={clearAuthError}
              className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-xs underline shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Option 1: Google OAuth */}
        <div>
          <button
            type="button"
            disabled={isSigningIn}
            onClick={handleGoogleSignIn}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-semibold text-sm transition border border-[#e2e6f0] dark:border-slate-700 shadow-xs disabled:opacity-60 cursor-pointer"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
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
            <span>{isSigningIn ? 'Connecting to Google...' : 'Continue with Google'}</span>
          </button>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 text-center mt-1.5">
            Safe Google Sign-In with zero saved credentials
          </p>
        </div>

        <div className="relative flex py-1 items-center">
          <div className="flex-grow border-t border-[#e2e6f0] dark:border-slate-800"></div>
          <span className="flex-shrink mx-3 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider font-semibold">
            Or choose access method
          </span>
          <div className="flex-grow border-t border-[#e2e6f0] dark:border-slate-800"></div>
        </div>

        {/* Tab Toggle: Email / Demo */}
        <div className="flex rounded-xl bg-[#f3f5fb] dark:bg-slate-800/80 p-1 border border-[#e2e6f0] dark:border-slate-700/60">
          <button
            type="button"
            onClick={() => setMode('signin')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              mode === 'signin'
                ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Email Sign In
          </button>
          <button
            type="button"
            onClick={() => setMode('signup')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              mode === 'signup'
                ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Create Account
          </button>
          <button
            type="button"
            onClick={() => setMode('demo')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              mode === 'demo'
                ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Instant Demo
          </button>
        </div>

        {/* Mode: Email Sign In or Sign Up */}
        {(mode === 'signin' || mode === 'signup') && (
          <form onSubmit={handleEmailSubmit} className="space-y-3 pt-1">
            {mode === 'signup' && (
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Full Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    placeholder="Alex Rivera"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3 py-2 text-slate-900 dark:text-white text-sm placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                University Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  placeholder="student@university.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3 py-2 text-slate-900 dark:text-white text-sm placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3 py-2 text-slate-900 dark:text-white text-sm placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSigningIn}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition shadow-md shadow-indigo-600/20 disabled:opacity-50 mt-2 flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>{mode === 'signin' ? 'Sign In to Cortexa' : 'Create Student Account'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* Mode: Instant Demo Student Sandbox */}
        {mode === 'demo' && (
          <div className="space-y-3 pt-1">
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Select a preconfigured student profile to test Cortexa without signing in:
            </p>

            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() => handleDemoLaunch('cs')}
                className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-left transition flex items-center justify-between group cursor-pointer"
              >
                <div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition">
                    Alex Rivera — Computer Science
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Preloaded: Operating Systems, Algorithms, Distributed Systems
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:translate-x-1 transition" />
              </button>

              <button
                type="button"
                onClick={() => handleDemoLaunch('bio')}
                className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-left transition flex items-center justify-between group cursor-pointer"
              >
                <div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-300 transition">
                    Sarah Chen — Molecular Biology
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Preloaded: Genetics, Cell Signaling, Biochemistry
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 group-hover:translate-x-1 transition" />
              </button>

              <button
                type="button"
                onClick={() => handleDemoLaunch('econ')}
                className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-left transition flex items-center justify-between group cursor-pointer"
              >
                <div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-300 transition">
                    Jordan Patel — Economics & Finance
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Preloaded: Macroeconomics, Econometrics, Monetary Policy
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-amber-600 dark:group-hover:text-amber-400 group-hover:translate-x-1 transition" />
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
