import React, { useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { SubjectProvider } from './context/SubjectContext.tsx';
import { ThemeProvider, useTheme } from './context/ThemeContext.tsx';
import { Navbar } from './components/layout/Navbar.tsx';
import { DashboardView } from './components/dashboard/DashboardView.tsx';
import { MaterialsView } from './components/materials/MaterialsView.tsx';
import { AIStudyRoomView } from './components/ai/AIStudyRoomView.tsx';
import { QuizzesView } from './components/quizzes/QuizzesView.tsx';
import { FlashcardsView } from './components/flashcards/FlashcardsView.tsx';
import { PlannerView } from './components/planner/PlannerView.tsx';
import { AuthModal } from './components/auth/AuthModal.tsx';
import { NeuralOrb3D } from './components/common/NeuralOrb3D.tsx';
import { PageTransition } from './components/common/MotionWrapper.tsx';
import {
  Sparkles,
  BookOpen,
  HelpCircle,
  Brain,
  LogIn,
  Layers,
  ArrowRight,
  Sun,
  Moon,
  Zap,
} from 'lucide-react';

function MainApp() {
  const {
    isAuthenticated,
    loading,
    signInAsDemoStudent,
    authError,
    clearAuthError,
  } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [navigationMeta, setNavigationMeta] = useState<any>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const handleNavigate = (tab: string, meta?: any) => {
    setActiveTab(tab);
    setNavigationMeta(meta || null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8f9fd] dark:bg-[#090d16] text-[#172033] dark:text-slate-300 flex flex-col items-center justify-center p-4">
        <div className="relative flex items-center justify-center mb-5">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 via-violet-600 to-cyan-400 flex items-center justify-center text-white shadow-xl shadow-indigo-500/25 animate-pulse">
            <Brain className="w-7 h-7" />
          </div>
          <div className="absolute inset-0 rounded-2xl bg-indigo-500/20 blur-xl animate-ping" />
        </div>
        <p className="font-display font-semibold text-sm tracking-wide text-indigo-600 dark:text-indigo-300">
          Activating Cortexa AI...
        </p>
      </div>
    );
  }

  // Unauthenticated Welcome Landing View (CORTEXA Brand Hero)
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#f8f9fd] dark:bg-[#090d16] text-[#172033] dark:text-white flex flex-col selection:bg-indigo-500 selection:text-white relative overflow-hidden transition-colors duration-200">
        {/* Background Ambient Mesh */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[450px] bg-gradient-to-b from-indigo-500/10 dark:from-indigo-600/15 via-violet-500/5 dark:via-violet-600/10 to-transparent blur-3xl pointer-events-none -z-10" />
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none -z-10" />
        
        {/* Responsive Top Nav */}
        <header className="border-b border-[#e2e6f0] dark:border-white/10 px-4 sm:px-8 py-3.5 sm:py-4 flex items-center justify-between max-w-7xl mx-auto w-full pt-safe backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-violet-600 to-cyan-400 flex items-center justify-center text-white shadow-lg shadow-indigo-500/25">
              <Brain className="w-5 h-5" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-display font-extrabold text-xl sm:text-2xl tracking-tight bg-gradient-to-r from-slate-900 via-indigo-950 to-indigo-800 dark:from-white dark:via-slate-100 dark:to-indigo-200 bg-clip-text text-transparent">
                CORTEXA
              </span>
              <span className="text-[10px] font-mono font-bold tracking-wider text-indigo-600 dark:text-cyan-400">
                OS
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 dark:bg-white/5 dark:hover:bg-white/10 dark:text-slate-300 dark:hover:text-white border border-[#e2e6f0] dark:border-white/10 transition cursor-pointer shadow-xs"
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4 text-indigo-600" />}
            </button>

            <button
              type="button"
              onClick={() => signInAsDemoStudent()}
              className="px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-800 dark:bg-white/5 dark:hover:bg-white/10 dark:text-slate-200 text-xs sm:text-sm font-semibold border border-[#e2e6f0] dark:border-white/10 transition cursor-pointer shadow-xs"
              title="Instant Demo Access"
            >
              Demo Student
            </button>
            <button
              type="button"
              onClick={() => setIsAuthModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs sm:text-sm font-bold transition shadow-md shadow-indigo-600/25 cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>Get Started</span>
            </button>
          </div>
        </header>

        {/* Hero Section */}
        <main className="flex-1 flex flex-col items-center justify-center px-4 py-8 sm:py-14 text-center max-w-5xl mx-auto w-full">
          {authError && (
            <div className="mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs sm:text-sm flex flex-col sm:flex-row items-center justify-between gap-3 text-left w-full max-w-xl">
              <div>
                <span className="font-semibold block mb-0.5">Notice:</span>
                <span>{authError}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => signInAsDemoStudent()}
                  className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-800 dark:text-amber-200 text-xs font-semibold cursor-pointer"
                >
                  Use Demo Login
                </button>
                <button
                  type="button"
                  onClick={clearAuthError}
                  className="px-2 py-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-xs cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {/* Interactive 3D Cortexa Intelligence Orb */}
          <div className="relative mb-4 flex items-center justify-center">
            <NeuralOrb3D size={180} interactive={true} className="animate-float-slow" />
            <div className="absolute inset-0 pointer-events-none rounded-full bg-indigo-500/10 dark:bg-indigo-500/20 blur-2xl -z-10" />
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600 dark:text-cyan-400 mb-5 tracking-wide">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-cyan-400 shrink-0" />
            <span>Next-Gen AI Knowledge Workspace for University Students</span>
          </div>

          <h1 className="font-display text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-[1.08]">
            Study smarter, not longer. <br />
            <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-cyan-500 dark:from-indigo-400 dark:via-violet-300 dark:to-cyan-300 bg-clip-text text-transparent">
              Powered by Cortexa AI.
            </span>
          </h1>

          <p className="mt-5 sm:mt-6 text-sm sm:text-base md:text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Upload lecture notes, textbook PDFs, and handwritten notes. Cortexa generates verified source-grounded answers, active recall diagnostic quizzes, 3D flashcards with Leitner spaced repetition, and adaptive exam timelines.
          </p>

          <div className="mt-7 sm:mt-9 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3.5 w-full max-w-md">
            <button
              type="button"
              onClick={() => setIsAuthModalOpen(true)}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-7 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-sm sm:text-base transition shadow-xl shadow-indigo-600/30 min-h-[48px] cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
            >
              <span>Join Cortexa Free</span>
              <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            <button
              type="button"
              onClick={() => signInAsDemoStudent()}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-800 dark:text-slate-200 font-semibold text-sm sm:text-base border border-slate-200 dark:border-white/10 transition min-h-[48px] cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
            >
              Instant Student Demo
            </button>
          </div>

          {/* Bento Feature Grid with Hover Depth */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mt-12 sm:mt-16 text-left w-full">
            <div className="p-6 rounded-3xl bg-surface border border-border hover:border-indigo-500/40 hover:-translate-y-1 hover:shadow-xl transition-all duration-200 shadow-md relative overflow-hidden group">
              <div className="p-3 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 w-fit mb-4 border border-indigo-500/20 group-hover:scale-110 transition-transform">
                <BookOpen className="w-5 h-5" />
              </div>
              <h3 className="font-display font-bold text-slate-900 dark:text-white text-base">Grounded on Your Notes</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                All AI reasoning cites verifiable chunks and page numbers from your uploaded lecture slides and handwritten notes.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-surface border border-border hover:border-violet-500/40 hover:-translate-y-1 hover:shadow-xl transition-all duration-200 shadow-md relative overflow-hidden group">
              <div className="p-3 rounded-2xl bg-violet-500/10 text-violet-600 dark:text-violet-400 w-fit mb-4 border border-violet-500/20 group-hover:scale-110 transition-transform">
                <HelpCircle className="w-5 h-5" />
              </div>
              <h3 className="font-display font-bold text-slate-900 dark:text-white text-base">Diagnostic Mastery</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                Practice quizzes automatically record performance per topic, surfacing conceptual weak spots before finals.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-surface border border-border hover:border-cyan-500/40 hover:-translate-y-1 hover:shadow-xl transition-all duration-200 shadow-md relative overflow-hidden group">
              <div className="p-3 rounded-2xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 w-fit mb-4 border border-cyan-500/20 group-hover:scale-110 transition-transform">
                <Zap className="w-5 h-5" />
              </div>
              <h3 className="font-display font-bold text-slate-900 dark:text-white text-base">Active Spaced Recall</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                Leitner 5-box flashcards schedule concepts based on retention curves, guaranteeing long-term memory mastery.
              </p>
            </div>
          </div>
        </main>

        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f9fd] dark:bg-[#090d16] text-[#172033] dark:text-slate-100 flex flex-col selection:bg-indigo-600 selection:text-white transition-colors duration-200">
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Content Area - with smooth page transitions */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 pb-24 md:pb-8">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <PageTransition key="dashboard" tabKey="dashboard">
              <DashboardView onNavigate={handleNavigate} />
            </PageTransition>
          )}
          {activeTab === 'materials' && (
            <PageTransition key="materials" tabKey="materials">
              <MaterialsView onNavigate={handleNavigate} />
            </PageTransition>
          )}
          {activeTab === 'ai-room' && (
            <PageTransition key="ai-room" tabKey="ai-room">
              <AIStudyRoomView
                initialExplainTopic={navigationMeta?.explainTopic}
                onNavigate={handleNavigate}
              />
            </PageTransition>
          )}
          {activeTab === 'quizzes' && (
            <PageTransition key="quizzes" tabKey="quizzes">
              <QuizzesView initialMaterialId={navigationMeta?.materialId} />
            </PageTransition>
          )}
          {activeTab === 'flashcards' && (
            <PageTransition key="flashcards" tabKey="flashcards">
              <FlashcardsView
                initialMaterialId={navigationMeta?.materialId}
                initialTopicFilter={navigationMeta?.filterTopic}
              />
            </PageTransition>
          )}
          {activeTab === 'planner' && (
            <PageTransition key="planner" tabKey="planner">
              <PlannerView />
            </PageTransition>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <SubjectProvider>
          <MainApp />
        </SubjectProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
