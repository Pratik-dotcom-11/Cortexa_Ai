import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useSubject } from '../../context/SubjectContext.tsx';
import { useTheme } from '../../context/ThemeContext.tsx';
import {
  LogOut,
  LogIn,
  BookOpen,
  Plus,
  Clock,
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  LayoutDashboard,
  Brain,
  HelpCircle,
  Layers,
  CalendarCheck,
  Menu,
  X,
  Sparkles,
  Sun,
  Moon,
} from 'lucide-react';
import { Modal } from '../common/Modal.tsx';
import { AuthModal } from '../auth/AuthModal.tsx';
import { PomodoroWidget } from '../timer/PomodoroWidget.tsx';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab }) => {
  const {
    currentUser,
    isAuthenticated,
    profile,
    signInAsDemoStudent,
    logout,
    apiFetch,
  } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { subjects, activeSubject, setActiveSubject, createNewSubject } = useSubject();

  // Modals state
  const [isSubjectModalOpen, setIsSubjectModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Subject creation form
  const [newSubjName, setNewSubjName] = useState('');
  const [newSubjCode, setNewSubjCode] = useState('');
  const [newSubjColor, setNewSubjColor] = useState('#6366f1');
  const [newSubjDesc, setNewSubjDesc] = useState('');
  const [isSubmittingSubject, setIsSubmittingSubject] = useState(false);

  // Study timer widget
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [isTimerOpen, setIsTimerOpen] = useState(false);
  const [sessionNotes, setSessionNotes] = useState('');

  useEffect(() => {
    let interval: any = null;
    if (isTimerRunning) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning]);

  // Clean scroll lock for mobile menu
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    } else {
      document.body.style.overflow = '';
    }
  }, [isMobileMenuOpen]);

  // Ensure scroll is unlocked if Navbar unmounts
  useEffect(() => {
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSaveSession = async () => {
    if (timerSeconds < 30) {
      setIsTimerRunning(false);
      setTimerSeconds(0);
      setIsTimerOpen(false);
      return;
    }

    try {
      const durationMins = Math.max(1, Math.round(timerSeconds / 60));
      await apiFetch('/api/progress/session', {
        method: 'POST',
        body: JSON.stringify({
          subjectId: activeSubject?.id,
          activityType: activeTab,
          durationMinutes: durationMins,
          notes: sessionNotes || `${activeSubject?.name || 'General'} study session`,
        }),
      });
      setIsTimerRunning(false);
      setTimerSeconds(0);
      setSessionNotes('');
      setIsTimerOpen(false);
    } catch (e) {
      console.error('Failed to log session:', e);
    }
  };

  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubjName.trim()) return;

    try {
      setIsSubmittingSubject(true);
      await createNewSubject({
        name: newSubjName.trim(),
        code: newSubjCode.trim() || undefined,
        color: newSubjColor,
        description: newSubjDesc.trim() || undefined,
      });
      setNewSubjName('');
      setNewSubjCode('');
      setNewSubjDesc('');
      setIsSubjectModalOpen(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmittingSubject(false);
    }
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'materials', label: 'Notes & PDFs', icon: BookOpen },
    { id: 'ai-room', label: 'AI Tutor', icon: Brain },
    { id: 'quizzes', label: 'Quizzes', icon: HelpCircle },
    { id: 'flashcards', label: 'Flashcards', icon: Layers },
    { id: 'planner', label: 'Study Plan', icon: CalendarCheck },
  ];

  const primaryMobileTabs = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'materials', label: 'Notes', icon: BookOpen },
    { id: 'ai-room', label: 'AI Tutor', icon: Brain },
    { id: 'quizzes', label: 'Quizzes', icon: HelpCircle },
    { id: 'flashcards', label: 'Cards', icon: Layers },
  ];

  const colorPalette = [
    '#6366f1', // Indigo
    '#8b5cf6', // Purple
    '#3b82f6', // Blue
    '#06b6d4', // Cyan
    '#10b981', // Emerald
    '#f59e0b', // Amber
    '#ec4899', // Pink
  ];

  const subjectList = Array.isArray(subjects) ? subjects : [];

  return (
    <>
      {/* ------------------------------------------------------------------- */}
      {/* TOP APP BAR (Desktop + Mobile) */}
      {/* ------------------------------------------------------------------- */}
      <header className="sticky top-0 z-40 bg-surface/90 backdrop-blur-md border-b border-border pt-safe transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-4">
          {/* Left: Brand Logo & Title */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              onClick={() => setActiveTab('dashboard')}
              className="flex items-center gap-2.5 sm:gap-3 text-left focus:outline-hidden group cursor-pointer"
            >
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-violet-600 to-cyan-400 flex items-center justify-center text-white shadow-md shadow-indigo-500/25 shrink-0 group-hover:scale-105 transition-transform">
                <Brain className="w-5 h-5 sm:w-5.5 sm:h-5.5" />
              </div>
              <div>
                <span className="font-display font-extrabold text-base sm:text-xl tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5">
                  CORTEXA
                  <span className="text-[10px] font-mono font-bold tracking-wider text-indigo-600 dark:text-cyan-400">
                    OS
                  </span>
                </span>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 hidden lg:block leading-none">
                  Intelligent Study Partner
                </p>
              </div>
            </button>
          </div>

          {/* Center: Desktop Navigation Bar */}
          <nav className="hidden md:flex items-center gap-1 bg-[#f3f5fb] dark:bg-slate-900/80 p-1 rounded-2xl border border-[#e2e6f0] dark:border-slate-800/80">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs lg:text-sm font-semibold transition cursor-pointer ${
                    isActive
                      ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-600/25 font-bold'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/80 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right Action Tools: Theme Toggle, Course Selector, Focus Timer, Profile */}
          <div className="flex items-center gap-1.5 sm:gap-2.5">
            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className="min-h-[34px] min-w-[34px] p-2 rounded-xl bg-white dark:bg-slate-800/90 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-[#e2e6f0] dark:border-slate-700/80 transition flex items-center justify-center cursor-pointer shadow-xs"
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-300" />
              ) : (
                <Moon className="w-4 h-4 text-indigo-600" />
              )}
            </button>

            {/* Subject Selector */}
            {isAuthenticated && (
              <div className="flex items-center gap-1 sm:gap-1.5">
                <div className="relative max-w-[115px] sm:max-w-[170px]">
                  <select
                    value={activeSubject?.id || ''}
                    onChange={(e) => {
                      const id = Number(e.target.value);
                      const selected = subjectList.find((s) => s.id === id);
                      setActiveSubject(selected || null);
                    }}
                    className="w-full bg-white dark:bg-slate-800/90 text-[11px] sm:text-xs text-slate-900 dark:text-white font-medium pl-2.5 pr-6 sm:pr-7 py-1.5 rounded-xl border border-[#e2e6f0] dark:border-slate-700/80 focus:outline-hidden focus:border-indigo-500 cursor-pointer appearance-none truncate shadow-xs"
                  >
                    {subjectList.length === 0 ? (
                      <option value="">No Subjects</option>
                    ) : (
                      subjectList.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.code ? `[${s.code}] ` : ''}
                          {s.name}
                        </option>
                      ))
                    )}
                  </select>
                  <div
                    className="w-2 h-2 rounded-full absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none"
                    style={{ backgroundColor: activeSubject?.color || '#6366f1' }}
                  />
                </div>

                <button
                  onClick={() => setIsSubjectModalOpen(true)}
                  title="Add Course / Subject"
                  className="min-h-[34px] min-w-[34px] p-2 rounded-xl bg-white dark:bg-slate-800/90 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-[#e2e6f0] dark:border-slate-700/80 transition flex items-center justify-center cursor-pointer shrink-0 shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Focus Session Timer Button */}
            {isAuthenticated && (
              <button
                onClick={() => setIsTimerOpen(true)}
                className={`min-h-[34px] flex items-center gap-1 sm:gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] sm:text-xs font-semibold border transition cursor-pointer shrink-0 ${
                  isTimerRunning
                    ? 'bg-amber-500/15 text-amber-500 dark:text-amber-400 border-amber-500/40 animate-pulse'
                    : 'bg-white dark:bg-slate-800/90 text-slate-700 dark:text-slate-300 border-[#e2e6f0] dark:border-slate-700/80 hover:bg-slate-100 dark:hover:bg-slate-700 shadow-xs'
                }`}
                title="Active Focus Timer"
              >
                <Clock className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                <span className="font-mono">{formatTimer(timerSeconds)}</span>
              </button>
            )}

            {/* User Profile or Sign In */}
            {isAuthenticated && currentUser ? (
              <div className="flex items-center gap-1 sm:gap-2">
                <div
                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-full overflow-hidden border border-indigo-500/40 bg-indigo-950 flex items-center justify-center text-xs font-bold text-indigo-300 shrink-0"
                  title={currentUser.email || 'Logged in'}
                >
                  {currentUser.photoURL ? (
                    <img
                      src={currentUser.photoURL}
                      alt="avatar"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    (currentUser.displayName || currentUser.email || 'C')[0].toUpperCase()
                  )}
                </div>

                <button
                  onClick={logout}
                  title="Sign out"
                  className="hidden sm:flex min-h-[34px] min-w-[34px] p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition items-center justify-center cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                </button>

                {/* Mobile Menu Hamburger */}
                <button
                  onClick={() => setIsMobileMenuOpen(true)}
                  className="md:hidden min-h-[34px] min-w-[34px] p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center justify-center"
                  aria-label="Open mobile menu"
                >
                  <Menu className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsAuthModalOpen(true)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-md shadow-indigo-600/25"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Sign In</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ------------------------------------------------------------------- */}
      {/* MOBILE FIXED BOTTOM TAB BAR (Thumb Navigation) */}
      {/* ------------------------------------------------------------------- */}
      <nav
        aria-label="Mobile Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface/95 backdrop-blur-lg border-t border-border pb-safe shadow-2xl transition-colors duration-200"
      >
        <div className="grid grid-cols-5 items-center h-14 max-w-md mx-auto">
          {primaryMobileTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex flex-col items-center justify-center h-full min-h-[44px] transition cursor-pointer ${
                  isActive ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {isActive && (
                  <span className="absolute top-0 w-8 h-0.5 bg-gradient-to-r from-indigo-500 to-cyan-400 rounded-full animate-in fade-in" />
                )}
                <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110' : ''}`} />
                <span className="text-[10px] font-medium tracking-tight mt-0.5 leading-none">
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* ------------------------------------------------------------------- */}
      {/* MOBILE SLIDE-OVER DRAWER (More Menu) */}
      {/* ------------------------------------------------------------------- */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            key="mobile-drawer-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50 flex justify-end bg-slate-950/80 backdrop-blur-xs md:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <motion.div
              key="mobile-drawer-panel"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 400, damping: 32 }}
              className="w-72 max-w-[85vw] bg-surface border-l border-border h-full p-5 flex flex-col justify-between shadow-2xl text-foreground"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between pb-4 border-b border-border">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 via-violet-600 to-cyan-400 flex items-center justify-center text-white">
                      <Brain className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-display font-bold text-sm tracking-tight">Cortexa AI</h3>
                      <p className="text-[11px] text-muted">
                        {profile?.displayName || currentUser?.displayName || 'Student'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="p-1.5 rounded-xl text-slate-400 hover:text-foreground"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Theme switch in drawer */}
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-surface-elevated border border-border text-xs">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Theme</span>
                  <button
                    onClick={toggleTheme}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-surface shadow-xs font-semibold text-foreground border border-border"
                  >
                    {theme === 'dark' ? (
                      <>
                        <Sun className="w-3.5 h-3.5 text-amber-300" />
                        <span>Dark</span>
                      </>
                    ) : (
                      <>
                        <Moon className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Light</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Navigation Links */}
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-3 mb-2">
                    All Study Sections
                  </p>
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          setActiveTab(item.id);
                          setIsMobileMenuOpen(false);
                        }}
                        className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition text-left ${
                          isActive
                            ? 'bg-indigo-600 text-white shadow-xs font-bold'
                            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Subject Quick Selector */}
                <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between mb-2 px-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Courses ({subjectList.length})
                    </span>
                    <button
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        setIsSubjectModalOpen(true);
                      }}
                      className="text-indigo-600 dark:text-indigo-400 hover:underline text-xs font-semibold flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> Add
                    </button>
                  </div>
                  <div className="space-y-1 max-h-36 overflow-y-auto">
                    {subjectList.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => {
                          setActiveSubject(s);
                          setIsMobileMenuOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition ${
                          activeSubject?.id === s.id
                            ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 font-semibold border border-indigo-500/30'
                            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <span className="truncate">{s.name}</span>
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: s.color || '#6366f1' }}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Logout button */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    logout();
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-rose-500/10 text-slate-600 dark:text-slate-300 hover:text-rose-500 text-xs font-semibold border border-slate-200 dark:border-slate-800 transition"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ------------------------------------------------------------------- */}
      {/* MODAL: ADD COURSE / SUBJECT */}
      {/* ------------------------------------------------------------------- */}
      <Modal
        isOpen={isSubjectModalOpen}
        onClose={() => setIsSubjectModalOpen(false)}
        title="Add Course / Subject"
      >
        <form onSubmit={handleCreateSubject} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              Subject Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Operating Systems, Macroeconomics"
              value={newSubjName}
              onChange={(e) => setNewSubjName(e.target.value)}
              className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                Course Code (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. CS 301, ECON 102"
                value={newSubjCode}
                onChange={(e) => setNewSubjCode(e.target.value)}
                className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                Color Tag
              </label>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {colorPalette.map((color) => (
                  <button
                    type="button"
                    key={color}
                    onClick={() => setNewSubjColor(color)}
                    className={`min-h-[32px] min-w-[32px] w-7 h-7 rounded-full transition transform cursor-pointer ${
                      newSubjColor === color
                        ? 'scale-125 ring-2 ring-indigo-500 ring-offset-2 ring-offset-white dark:ring-offset-slate-900'
                        : 'hover:scale-110'
                    }`}
                    style={{ backgroundColor: color }}
                    aria-label={`Select color ${color}`}
                  />
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              Description / Professor
            </label>
            <textarea
              rows={2}
              placeholder="Notes on syllabus, midterm dates, or topics..."
              value={newSubjDesc}
              onChange={(e) => setNewSubjDesc(e.target.value)}
              className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 text-sm"
            />
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsSubjectModalOpen(false)}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmittingSubject}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition disabled:opacity-50 shadow-md shadow-indigo-600/20 cursor-pointer"
            >
              {isSubmittingSubject ? 'Creating...' : 'Create Subject'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ------------------------------------------------------------------- */}
      {/* POMODORO FOCUS SESSION WIDGET */}
      {/* ------------------------------------------------------------------- */}
      <PomodoroWidget
        isOpen={isTimerOpen}
        onClose={() => setIsTimerOpen(false)}
        activeTab={activeTab}
      />

      {/* ------------------------------------------------------------------- */}
      {/* MODAL: AUTHENTICATION */}
      {/* ------------------------------------------------------------------- */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />
    </>
  );
};
