import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  CheckCircle2,
  Clock,
  Sparkles,
  Volume2,
  VolumeX,
  Minimize2,
  Maximize2,
  X,
  BookOpen,
  Award,
  Flame,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useSubject } from '../../context/SubjectContext.tsx';

export type PomodoroMode = 'focus' | 'shortBreak' | 'longBreak';

interface PomodoroState {
  mode: PomodoroMode;
  targetSeconds: number;
  remainingSeconds: number;
  isRunning: boolean;
  completedCycles: number;
  lastUpdatedTimestamp: number;
}

const STORAGE_KEY = 'cortexa_pomodoro_state';

const DEFAULT_DURATIONS: Record<PomodoroMode, number> = {
  focus: 25 * 60,
  shortBreak: 5 * 60,
  longBreak: 15 * 60,
};

const MODE_LABELS: Record<PomodoroMode, string> = {
  focus: 'Deep Focus',
  shortBreak: 'Short Break',
  longBreak: 'Long Rest',
};

const MODE_COLORS: Record<PomodoroMode, { bg: string; border: string; text: string; ring: string }> = {
  focus: {
    bg: 'bg-indigo-500/10 dark:bg-indigo-500/20',
    border: 'border-indigo-500/30',
    text: 'text-indigo-600 dark:text-indigo-400',
    ring: '#6366f1',
  },
  shortBreak: {
    bg: 'bg-emerald-500/10 dark:bg-emerald-500/20',
    border: 'border-emerald-500/30',
    text: 'text-emerald-600 dark:text-emerald-400',
    ring: '#10b981',
  },
  longBreak: {
    bg: 'bg-cyan-500/10 dark:bg-cyan-500/20',
    border: 'border-cyan-500/30',
    text: 'text-cyan-600 dark:text-cyan-400',
    ring: '#06b6d4',
  },
};

export interface PomodoroWidgetProps {
  isOpen?: boolean;
  onClose?: () => void;
  activeTab?: string;
}

export const PomodoroWidget: React.FC<PomodoroWidgetProps> = ({
  isOpen = false,
  onClose,
  activeTab = 'dashboard',
}) => {
  const { apiFetch, isAuthenticated } = useAuth();
  const { activeSubject, subjects } = useSubject();

  // Load initial state from localStorage or default
  const [mode, setMode] = useState<PomodoroMode>('focus');
  const [targetSeconds, setTargetSeconds] = useState<number>(DEFAULT_DURATIONS.focus);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(DEFAULT_DURATIONS.focus);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [completedCycles, setCompletedCycles] = useState<number>(0);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [sessionNotes, setSessionNotes] = useState<string>('');
  const [isExpanded, setIsExpanded] = useState<boolean>(isOpen);
  const [isLogging, setIsLogging] = useState<boolean>(false);
  const [logSuccessMessage, setLogSuccessMessage] = useState<string | null>(null);

  const selectedSubject = activeSubject || (subjects.length > 0 ? subjects[0] : null);

  // Restore state on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: PomodoroState = JSON.parse(saved);
        setMode(parsed.mode || 'focus');
        setTargetSeconds(parsed.targetSeconds || DEFAULT_DURATIONS.focus);
        setCompletedCycles(parsed.completedCycles || 0);

        if (parsed.isRunning && parsed.lastUpdatedTimestamp) {
          const elapsed = Math.floor((Date.now() - parsed.lastUpdatedTimestamp) / 1000);
          const remaining = Math.max(0, parsed.remainingSeconds - elapsed);
          setRemainingSeconds(remaining);
          setIsRunning(remaining > 0);
        } else {
          setRemainingSeconds(parsed.remainingSeconds ?? DEFAULT_DURATIONS.focus);
          setIsRunning(false);
        }
      }
    } catch (e) {
      console.warn('Unable to load Pomodoro state:', e);
    }
  }, []);

  // Sync state prop with internal open state
  useEffect(() => {
    if (isOpen) setIsExpanded(true);
  }, [isOpen]);

  // Persist state changes
  useEffect(() => {
    try {
      const stateToSave: PomodoroState = {
        mode,
        targetSeconds,
        remainingSeconds,
        isRunning,
        completedCycles,
        lastUpdatedTimestamp: Date.now(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
    } catch (e) {
      // ignore
    }
  }, [mode, targetSeconds, remainingSeconds, isRunning, completedCycles]);

  // Synthesize gentle double-beep audio chime
  const playFinishChime = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15); // A5

      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.6);
    } catch {
      // Ignore audio policy restrictions
    }
  }, [soundEnabled]);

  // Handle phase completion
  const handlePhaseComplete = useCallback(() => {
    playFinishChime();
    setIsRunning(false);

    if (mode === 'focus') {
      const nextCycles = completedCycles + 1;
      setCompletedCycles(nextCycles);

      // Auto-log focus study session to backend
      if (isAuthenticated) {
        const durationMins = Math.max(1, Math.round(targetSeconds / 60));
        apiFetch('/api/progress/session', {
          method: 'POST',
          body: JSON.stringify({
            subjectId: selectedSubject?.id,
            activityType: activeTab || 'study',
            durationMinutes: durationMins,
            notes: sessionNotes || `${MODE_LABELS[mode]} Pomodoro complete`,
          }),
        }).catch(() => {});
      }

      setLogSuccessMessage(`Great focus! ${Math.round(targetSeconds / 60)}m session logged.`);
      setTimeout(() => setLogSuccessMessage(null), 4000);

      // Transition to break
      if (nextCycles % 4 === 0) {
        switchMode('longBreak');
      } else {
        switchMode('shortBreak');
      }
    } else {
      setLogSuccessMessage('Break complete! Ready for next focus interval?');
      setTimeout(() => setLogSuccessMessage(null), 4000);
      switchMode('focus');
    }
  }, [mode, completedCycles, targetSeconds, isAuthenticated, selectedSubject, activeTab, sessionNotes, apiFetch, playFinishChime]);

  // Main countdown interval loop
  useEffect(() => {
    let timer: any = null;
    if (isRunning) {
      timer = setInterval(() => {
        setRemainingSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            handlePhaseComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isRunning, handlePhaseComplete]);

  const switchMode = (newMode: PomodoroMode, customDuration?: number) => {
    setIsRunning(false);
    setMode(newMode);
    const duration = customDuration || DEFAULT_DURATIONS[newMode];
    setTargetSeconds(duration);
    setRemainingSeconds(duration);
  };

  const handleCustomDurationSelect = (mins: number) => {
    const secs = mins * 60;
    setIsRunning(false);
    setTargetSeconds(secs);
    setRemainingSeconds(secs);
  };

  const handleReset = () => {
    setIsRunning(false);
    setRemainingSeconds(targetSeconds);
  };

  const handleManualLogSession = async () => {
    if (!isAuthenticated) return;
    const elapsedSeconds = targetSeconds - remainingSeconds;
    const durationMins = Math.max(1, Math.round(elapsedSeconds / 60));

    try {
      setIsLogging(true);
      await apiFetch('/api/progress/session', {
        method: 'POST',
        body: JSON.stringify({
          subjectId: selectedSubject?.id,
          activityType: activeTab || 'study',
          durationMinutes: durationMins,
          notes: sessionNotes || `${MODE_LABELS[mode]} manual session log`,
        }),
      });
      setLogSuccessMessage(`Successfully logged ${durationMins} focus minutes!`);
      setTimeout(() => setLogSuccessMessage(null), 3000);
      handleReset();
      setSessionNotes('');
    } catch (e) {
      console.warn('Failed to manually log session:', e);
    } finally {
      setIsLogging(false);
    }
  };

  const formatTime = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Progress percentage (100% at start, 0% at end)
  const progressPercent = targetSeconds > 0 ? (remainingSeconds / targetSeconds) * 100 : 0;
  const strokeDashoffset = 283 - (283 * progressPercent) / 100;

  return (
    <>
      {/* ----------------------------------------------------------------- */}
      {/* FLOATING MINI BAR (Docked Bottom-Right on Viewport) */}
      {/* ----------------------------------------------------------------- */}
      {!isExpanded && (
        <div className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-50 flex items-center gap-2 p-2 sm:p-2.5 rounded-2xl bg-surface/90 dark:bg-slate-900/90 backdrop-blur-xl border border-border shadow-2xl transition-all duration-300 hover:scale-105 group">
          <button
            onClick={() => setIsExpanded(true)}
            className="flex items-center gap-2.5 px-2 font-mono text-xs font-bold text-foreground cursor-pointer"
            title="Expand Pomodoro Timer"
          >
            <div className="relative flex items-center justify-center">
              <Clock className={`w-4 h-4 ${MODE_COLORS[mode].text} ${isRunning ? 'animate-spin-slow' : ''}`} />
              {isRunning && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              )}
            </div>
            <div className="flex flex-col text-left">
              <span className="text-[10px] text-muted font-sans font-semibold uppercase tracking-wider leading-none">
                {MODE_LABELS[mode]}
              </span>
              <span className="text-sm font-extrabold font-mono tracking-tight leading-snug">
                {formatTime(remainingSeconds)}
              </span>
            </div>
          </button>

          <div className="h-6 w-px bg-border my-auto mx-0.5" />

          <button
            onClick={() => setIsRunning(!isRunning)}
            className={`p-2 rounded-xl text-white font-bold transition shadow-md cursor-pointer ${
              isRunning ? 'bg-amber-500 hover:bg-amber-600' : 'bg-indigo-600 hover:bg-indigo-500'
            }`}
            title={isRunning ? 'Pause' : 'Start Focus'}
          >
            {isRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={() => setIsExpanded(true)}
            className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-surface-elevated transition cursor-pointer"
            title="Expand"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* EXPANDED POMODORO PANEL (Floating Overlay Modal Card) */}
      {/* ----------------------------------------------------------------- */}
      {isExpanded && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-surface border border-border rounded-3xl shadow-2xl p-5 sm:p-6 space-y-5 relative overflow-hidden">
            {/* Ambient Background Glow */}
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

            {/* Header Controls */}
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-cyan-400 flex items-center justify-center">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-display font-extrabold text-base text-foreground">
                    Pomodoro Focus Studio
                  </h3>
                  <p className="text-[11px] text-muted font-medium">
                    Structured intervals for deep learning retention
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  className="p-2 rounded-xl text-muted hover:text-foreground hover:bg-surface-elevated transition cursor-pointer"
                  title={soundEnabled ? 'Mute Alert Sound' : 'Enable Alert Sound'}
                >
                  {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-500" /> : <VolumeX className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsExpanded(false);
                    if (onClose) onClose();
                  }}
                  className="p-2 rounded-xl text-muted hover:text-foreground hover:bg-surface-elevated transition cursor-pointer"
                  title="Minimize"
                >
                  <Minimize2 className="w-4 h-4" />
                </button>
                {onClose && (
                  <button
                    type="button"
                    onClick={onClose}
                    className="p-2 rounded-xl text-muted hover:text-foreground hover:bg-surface-elevated transition cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Mode Selectors */}
            <div className="grid grid-cols-3 gap-1.5 p-1 rounded-2xl bg-surface-elevated border border-border">
              {(['focus', 'shortBreak', 'longBreak'] as PomodoroMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => switchMode(m)}
                  className={`py-2 px-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                    mode === m
                      ? 'bg-surface text-foreground shadow-xs border border-border'
                      : 'text-muted hover:text-foreground'
                  }`}
                >
                  <span>{MODE_LABELS[m]}</span>
                </button>
              ))}
            </div>

            {/* Circular Progress Ring & Time Display */}
            <div className="relative flex flex-col items-center justify-center py-2">
              <svg className="w-48 h-48 sm:w-52 sm:h-52 transform -rotate-90" viewBox="0 0 100 100">
                {/* Background Ring */}
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  className="stroke-border"
                  strokeWidth="6"
                  fill="transparent"
                />
                {/* Progress Ring */}
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  stroke={MODE_COLORS[mode].ring}
                  strokeWidth="6"
                  strokeLinecap="round"
                  fill="transparent"
                  strokeDasharray="283"
                  strokeDashoffset={strokeDashoffset}
                  className="transition-all duration-1000 ease-linear"
                />
              </svg>

              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className={`text-3xl sm:text-4xl font-extrabold font-mono tracking-wider text-foreground`}>
                  {formatTime(remainingSeconds)}
                </span>
                <div className={`mt-1.5 px-3 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${MODE_COLORS[mode].bg} ${MODE_COLORS[mode].text} border ${MODE_COLORS[mode].border}`}>
                  {MODE_LABELS[mode]}
                </div>
              </div>
            </div>

            {/* Presets & Custom Duration Buttons */}
            <div className="flex items-center justify-center gap-1.5 flex-wrap">
              <span className="text-[10px] text-muted font-bold uppercase tracking-wider mr-1">Presets:</span>
              {mode === 'focus' ? (
                <>
                  {[15, 25, 45, 50].map((mins) => (
                    <button
                      key={mins}
                      onClick={() => handleCustomDurationSelect(mins)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                        targetSeconds === mins * 60
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-surface-elevated text-muted hover:text-foreground border-border'
                      }`}
                    >
                      {mins}m
                    </button>
                  ))}
                </>
              ) : (
                <>
                  {[3, 5, 10, 15, 20].map((mins) => (
                    <button
                      key={mins}
                      onClick={() => handleCustomDurationSelect(mins)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                        targetSeconds === mins * 60
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-surface-elevated text-muted hover:text-foreground border-border'
                      }`}
                    >
                      {mins}m
                    </button>
                  ))}
                </>
              )}
            </div>

            {/* Main Action Controls */}
            <div className="flex items-center justify-center gap-3 pt-1">
              <button
                onClick={handleReset}
                className="p-3 rounded-2xl bg-surface-elevated hover:bg-border text-muted hover:text-foreground transition cursor-pointer border border-border"
                title="Reset Timer"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              <button
                onClick={() => setIsRunning(!isRunning)}
                className={`flex-1 flex items-center justify-center gap-2 py-3 px-6 rounded-2xl font-bold text-sm text-white transition shadow-lg cursor-pointer ${
                  isRunning
                    ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/25'
                    : 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 shadow-indigo-600/25'
                }`}
              >
                {isRunning ? (
                  <>
                    <Pause className="w-4 h-4" /> Pause
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" /> Start Focus
                  </>
                )}
              </button>

              <button
                onClick={() => {
                  if (mode === 'focus') switchMode('shortBreak');
                  else switchMode('focus');
                }}
                className="p-3 rounded-2xl bg-surface-elevated hover:bg-border text-muted hover:text-foreground transition cursor-pointer border border-border"
                title="Next Phase"
              >
                <SkipForward className="w-4 h-4" />
              </button>
            </div>

            {/* Stats & Session Notes */}
            <div className="space-y-3 pt-2 border-t border-border">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 text-muted font-medium">
                  <Flame className="w-3.5 h-3.5 text-amber-500" />
                  <span>Pomodoro Cycles Today:</span>
                </div>
                <div className="flex items-center gap-1 font-bold text-foreground bg-surface-elevated px-2 py-0.5 rounded-md border border-border">
                  <Award className="w-3.5 h-3.5 text-indigo-500" />
                  <span>{completedCycles} Completed</span>
                </div>
              </div>

              {selectedSubject && (
                <div className="flex items-center gap-2 text-xs text-muted">
                  <BookOpen className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                  <span className="truncate">
                    Course: <strong className="text-foreground">{selectedSubject.name}</strong>
                  </span>
                </div>
              )}

              <div>
                <input
                  type="text"
                  placeholder="Optional session note (e.g. Chapter 4 problem set)"
                  value={sessionNotes}
                  onChange={(e) => setSessionNotes(e.target.value)}
                  className="w-full bg-surface-elevated border border-border rounded-xl px-3 py-2 text-xs text-foreground placeholder-muted focus:outline-none focus:border-indigo-500"
                />
              </div>

              {logSuccessMessage && (
                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
                  <Sparkles className="w-4 h-4 shrink-0" />
                  <span>{logSuccessMessage}</span>
                </div>
              )}

              <div className="flex items-center justify-between gap-2 pt-1">
                <button
                  onClick={() => setIsExpanded(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-muted hover:text-foreground transition cursor-pointer"
                >
                  Keep Running in Background
                </button>

                {isAuthenticated && (
                  <button
                    onClick={handleManualLogSession}
                    disabled={isLogging || targetSeconds === remainingSeconds}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition disabled:opacity-50 shadow-md shadow-emerald-600/20 cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{isLogging ? 'Logging...' : 'Log Session'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
