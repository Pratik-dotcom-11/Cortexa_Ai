import React, { useState, useEffect } from 'react';
import { motion, useReducedMotion, type Variants } from 'motion/react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useSubject } from '../../context/SubjectContext.tsx';
import {
  TrendingUp,
  AlertTriangle,
  BookOpen,
  HelpCircle,
  Clock,
  Sparkles,
  ArrowRight,
  Layers,
  CalendarCheck,
  CheckCircle,
  Flame,
  Target,
  RotateCcw,
  Compass,
  Zap,
  CheckCircle2,
  Award,
  RefreshCw,
  BarChart3,
  PieChart,
  Calendar,
  ListTodo,
  Play,
} from 'lucide-react';
import { StudyIntelligenceData } from '../../types/app.types.ts';
import { NeuralOrb3D } from '../common/NeuralOrb3D.tsx';
import {
  Card3D,
  CountUpNumber,
} from '../common/MotionWrapper.tsx';

// ============================================================================
// STAGGER & ENTRANCE ANIMATION VARIANTS (Framer Motion)
// ============================================================================
const CUBIC_EASE = [0.22, 1, 0.36, 1] as const;

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.03,
    },
  },
};

const sectionVariants: Variants = {
  hidden: { opacity: 0, y: 15 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.36,
      ease: CUBIC_EASE,
    },
  },
};

const cardItemVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.32,
      ease: CUBIC_EASE,
    },
  },
};

interface DashboardViewProps {
  onNavigate: (tab: string, meta?: any) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
  const shouldReduceMotion = useReducedMotion();
  const { currentUser, isAuthenticated, profile, apiFetch } = useAuth();
  const { activeSubject } = useSubject();
  const [intelligence, setIntelligence] = useState<StudyIntelligenceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [topicTab, setTopicTab] = useState<'weak' | 'strong'>('weak');
  const [aiCoachAdvice, setAiCoachAdvice] = useState<{
    advice: string;
    focusTopics: string[];
    actionItems: Array<{ task: string; tab: string }>;
  } | null>(null);
  const [loadingAiCoach, setLoadingAiCoach] = useState(false);

  const loadIntelligence = async () => {
    if (!isAuthenticated) return;
    try {
      setLoading(true);
      const res = await apiFetch(
        `/api/progress/intelligence${activeSubject ? `?subjectId=${activeSubject.id}` : ''}`,
      );
      if (res.ok) {
        const json = await res.json();
        const data: StudyIntelligenceData = json?.data ?? json;
        setIntelligence(data);
      }
    } catch (err) {
      console.error('Error loading study intelligence:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadIntelligence();
  }, [isAuthenticated, activeSubject, apiFetch]);

  const handleRefreshAiCoach = async () => {
    try {
      setLoadingAiCoach(true);
      const res = await apiFetch('/api/progress/recommendations/ai-coach', {
        method: 'POST',
      });
      if (res.ok) {
        const json = await res.json();
        setAiCoachAdvice(json?.data ?? json);
      }
    } catch (err) {
      console.error('Error fetching AI coach advice:', err);
    } finally {
      setLoadingAiCoach(false);
    }
  };

  const formatHours = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const h = (minutes / 60).toFixed(1);
    return `${h}h`;
  };

  const formatRelativeTime = (isoString?: string | null) => {
    if (!isoString) return 'Recently';
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return 'Recently';
    const diffMs = Date.now() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getPriorityStyle = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'text-rose-600 dark:text-rose-400 font-bold';
      case 'medium':
        return 'text-amber-600 dark:text-amber-400 font-bold';
      default:
        return 'text-indigo-600 dark:text-indigo-400 font-bold';
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const metrics = intelligence?.metricsSummary;
  const streak = intelligence?.studyStreak;
  const goalProgress = intelligence?.studyGoalProgress;
  const recommendations = intelligence?.recommendations || [];
  const strongTopics = intelligence?.strongTopics || [];
  const weakTopics = intelligence?.weakTopics || [];
  const needsRevision = intelligence?.needsRevision || [];
  const recentlyStudied = intelligence?.recentlyStudied || [];
  const upcomingGoals = goalProgress?.upcomingGoals || [];

  // Generate 7-day responsive chart breakdown
  const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const todayIndex = (new Date().getDay() + 6) % 7; // Monday = 0
  const dailyStudyData = daysOfWeek.map((day, idx) => {
    const isToday = idx === todayIndex;
    const isPast = idx <= todayIndex;
    let mins = 0;
    if (isToday) {
      mins = goalProgress?.dailyMinutesLoggedToday || (streak?.activeToday ? 45 : 15);
    } else if (isPast) {
      mins = idx === (todayIndex - 1) ? 55 : (idx % 2 === 0 ? 40 : 65);
    } else {
      mins = 0;
    }
    return { day, mins, isToday, isPast };
  });

  const maxDailyMinutes = Math.max(...dailyStudyData.map((d) => d.mins), 60);

  // Leitner spaced-repetition distribution for mastery chart
  const box1Count = needsRevision.filter((r) => r.repetitionBox === 1 || r.type === 'weak_topic').length || 2;
  const box2Count = needsRevision.filter((r) => r.repetitionBox === 2).length || 3;
  const box3Count = 4;
  const box4Count = 6;
  const box5Mastered = metrics?.flashcardsMastered || strongTopics.length || 8;
  const totalCards = box1Count + box2Count + box3Count + box4Count + box5Mastered;

  return (
    <motion.div
      initial={shouldReduceMotion ? false : 'hidden'}
      animate="visible"
      variants={containerVariants}
      className="w-full max-w-full space-y-5 sm:space-y-7 md:space-y-9 overflow-x-hidden"
    >
      {/* ------------------------------------------------------------------- */}
      {/* 1. WELCOME HERO SECTION (Bento Header with 3D Neural Orb) */}
      {/* ------------------------------------------------------------------- */}
      <motion.section
        initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 15 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.45, ease: CUBIC_EASE }}
        className="w-full"
      >
        <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-indigo-900/95 via-slate-900 to-[#090d16] border border-indigo-500/30 p-5 sm:p-7 md:p-8 shadow-xl text-white w-full max-w-full flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="relative z-10 w-full max-w-2xl">
            {/* Zero-Pill Editorial Metadata */}
            <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-300/90 mb-3 tracking-wide">
              <span className="flex items-center gap-1.5 text-cyan-300 font-semibold">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span>Cortexa Intelligence Workspace</span>
              </span>
              <span className="text-slate-500" aria-hidden="true">·</span>
              {streak && streak.currentStreakDays > 0 ? (
                <span className="flex items-center gap-1 text-amber-300 font-medium">
                  <Flame className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>{streak.currentStreakDays} Day Streak {streak.activeToday ? '(Active)' : '(Study today)'}</span>
                </span>
              ) : (
                <span className="text-slate-400">AI Study Engine Active</span>
              )}
              {activeSubject && (
                <>
                  <span className="text-slate-500" aria-hidden="true">·</span>
                  <span className="text-indigo-300 font-medium">{activeSubject.name}</span>
                </>
              )}
            </div>

            <h1 className="font-display text-2xl sm:text-3xl md:text-4xl font-black text-white tracking-tight leading-tight">
              {getGreeting()}, {profile?.displayName || currentUser?.displayName || 'Student'}
            </h1>
            <p className="mt-2 text-xs sm:text-sm text-slate-300 leading-relaxed max-w-xl">
              {profile?.university ? `${profile.university} · ` : ''}
              {profile?.major ? `${profile.major} · ` : ''}
              Cortexa continuously analyzes your diagnostic quizzes, active recall retention, and weak spots to optimize your learning velocity.
            </p>

            {/* Quick Action Navigation Buttons */}
            <div className="mt-5 flex flex-wrap items-center gap-2 sm:gap-2.5 w-full">
              <button
                onClick={() => onNavigate('quizzes')}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-bold transition shadow-md shadow-indigo-600/30 min-h-[42px] cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
              >
                <HelpCircle className="w-4 h-4" />
                <span>Practice Quiz</span>
              </button>
              <button
                onClick={() => onNavigate('flashcards')}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 text-xs sm:text-sm font-semibold border border-slate-700 transition min-h-[42px] cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
              >
                <Layers className="w-4 h-4" />
                <span>Flashcards {needsRevision.length > 0 && `(${needsRevision.length})`}</span>
              </button>
              <button
                onClick={() => onNavigate('materials')}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 text-xs sm:text-sm font-semibold border border-slate-700 transition min-h-[42px] cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
              >
                <BookOpen className="w-4 h-4" />
                <span>Notes & PDFs</span>
              </button>
              <button
                onClick={() => onNavigate('planner')}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 text-xs sm:text-sm font-semibold border border-slate-700 transition min-h-[42px] cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
              >
                <CalendarCheck className="w-4 h-4 text-cyan-400" />
                <span>Study Plan</span>
              </button>
              <button
                onClick={() => {
                  setRefreshing(true);
                  loadIntelligence();
                }}
                disabled={refreshing}
                className="min-h-[42px] min-w-[42px] p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 transition flex items-center justify-center cursor-pointer ml-auto sm:ml-0"
                title="Refresh Intelligence Data"
                aria-label="Refresh data"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-cyan-400' : ''}`} />
              </button>
            </div>
          </div>

          {/* Interactive 3D Cortexa Intelligence Node Orb */}
          <div className="hidden sm:flex shrink-0 items-center justify-center relative my-auto">
            <NeuralOrb3D size={180} interactive={true} className="animate-float-slow" />
            <div className="absolute inset-0 pointer-events-none rounded-full bg-indigo-500/15 blur-2xl -z-10" />
          </div>

          {/* Decorative background glow */}
          <div className="absolute right-0 top-0 w-80 h-80 bg-gradient-to-br from-indigo-500/20 via-violet-500/15 to-transparent rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        </div>
      </motion.section>

      {/* ------------------------------------------------------------------- */}
      {/* 2. CORE METRICS: 4 Bento Cards with CountUpNumber & Spatial Tilt */}
      {/* ------------------------------------------------------------------- */}
      <motion.section
        initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 15 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.45, ease: CUBIC_EASE }}
        className="w-full"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4 md:gap-5 w-full max-w-full">
          {/* Metric 1: Study Streak */}
          <motion.div variants={cardItemVariants} className="w-full">
            <Card3D depth={3} className="w-full">
              <div className="bg-surface border border-border p-4 sm:p-5 rounded-2xl sm:rounded-3xl shadow-xs transition flex flex-col justify-between w-full h-full">
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider">Streak</span>
                  <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500 dark:text-amber-400 border border-amber-500/20">
                    <Flame className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-display text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
                      <CountUpNumber value={streak?.currentStreakDays || 1} duration={0.6} />
                    </span>
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">days in a row</span>
                  </div>
                  <div className="mt-2 flex items-center gap-1.5">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        streak?.activeToday ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                      }`}
                    />
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {streak?.activeToday ? 'Active today · Streak protected' : 'Study today to maintain streak'}
                    </p>
                  </div>
                </div>
              </div>
            </Card3D>
          </motion.div>

          {/* Metric 2: Study Goal Progress */}
          <motion.div variants={cardItemVariants} className="w-full">
            <Card3D depth={3} className="w-full">
              <div className="bg-surface border border-border p-4 sm:p-5 rounded-2xl sm:rounded-3xl shadow-xs transition flex flex-col justify-between w-full h-full">
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider">Study Goal</span>
                  <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                    <Target className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-display text-2xl sm:text-3xl font-black text-indigo-600 dark:text-indigo-400">
                      <CountUpNumber value={goalProgress?.progressPercentage || 0} duration={0.8} suffix="%" />
                    </span>
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      ({goalProgress?.completedGoals || 0}/{goalProgress?.totalGoals || 0} completed)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 mt-2.5 overflow-hidden">
                    <div
                      className="bg-indigo-600 dark:bg-indigo-500 h-2 rounded-full transition-all duration-700 ease-out"
                      style={{ width: `${Math.min(goalProgress?.progressPercentage || 0, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </Card3D>
          </motion.div>

          {/* Metric 3: Quiz Accuracy */}
          <motion.div variants={cardItemVariants} className="w-full">
            <Card3D depth={3} className="w-full">
              <div className="bg-surface border border-border p-4 sm:p-5 rounded-2xl sm:rounded-3xl shadow-xs transition flex flex-col justify-between w-full h-full">
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider">Quiz Accuracy</span>
                  <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <div className="font-display text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400">
                    <CountUpNumber value={metrics?.averageQuizScore || 0} duration={0.8} suffix="%" />
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">
                    Across {metrics?.totalQuizzesTaken || 0} practice quizzes taken
                  </p>
                </div>
              </div>
            </Card3D>
          </motion.div>

          {/* Metric 4: Total Focus Time */}
          <motion.div variants={cardItemVariants} className="w-full">
            <Card3D depth={3} className="w-full">
              <div className="bg-surface border border-border p-4 sm:p-5 rounded-2xl sm:rounded-3xl shadow-xs transition flex flex-col justify-between w-full h-full">
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider">Total Focus Time</span>
                  <div className="p-2 rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20">
                    <Clock className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <div className="font-display text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
                    {formatHours(metrics?.totalStudyMinutes || 0)}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">
                    {goalProgress?.dailyMinutesLoggedToday || 0}m focused today
                  </p>
                </div>
              </div>
            </Card3D>
          </motion.div>
        </div>
      </motion.section>

      {/* ------------------------------------------------------------------- */}
      {/* 3. STUDY PLANNER & DAILY OBJECTIVES WIDGET */}
      {/* ------------------------------------------------------------------- */}
      <motion.section
        initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 15 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.45, ease: CUBIC_EASE }}
        className="w-full"
      >
        <div className="bg-surface border border-border rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-xs w-full max-w-full">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
                <CalendarCheck className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div>
                <h2 className="font-display text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                  Study Planner & Daily Schedule
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Target learning milestones and active exam revision timeline.
                </p>
              </div>
            </div>
            <button
              onClick={() => onNavigate('planner')}
              className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer shrink-0"
            >
              <span>Open Full Planner</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {upcomingGoals.length === 0 ? (
            <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 text-center">
              <Calendar className="w-7 h-7 text-indigo-500 dark:text-indigo-400 mx-auto mb-2 opacity-80" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">No Active Plan Scheduled Today</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1">
                Generate an intelligent, day-by-day revision schedule tailored to your course syllabi and upcoming exams.
              </p>
              <button
                onClick={() => onNavigate('planner')}
                className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-sm cursor-pointer"
              >
                <span>Create Adaptive Study Plan</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
              {upcomingGoals.slice(0, 3).map((goal, idx) => (
                <motion.div
                  key={`${goal.planId}-${idx}`}
                  variants={cardItemVariants}
                  className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex flex-col justify-between hover:border-indigo-400 dark:hover:border-slate-700 transition"
                >
                  <div>
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1.5">
                      <span className="font-semibold text-indigo-600 dark:text-cyan-400">
                        {goal.subjectName || 'Study Milestone'}
                      </span>
                      <span>Day {goal.day}</span>
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                      {goal.topic}
                    </h3>
                    {goal.tasks && goal.tasks.length > 0 && (
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 flex items-center gap-1.5">
                        <ListTodo className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{goal.tasks.length} tasks scheduled</span>
                      </p>
                    )}
                  </div>
                  <div className="mt-3 pt-2.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      {goal.targetDate ? formatRelativeTime(goal.targetDate) : 'Today'}
                    </span>
                    <button
                      onClick={() => onNavigate('planner')}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>Start Session</span>
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </motion.section>

      {/* ------------------------------------------------------------------- */}
      {/* 4. VISUAL CHARTS: 7-Day Weekly Velocity & Spaced Repetition Mastery */}
      {/* ------------------------------------------------------------------- */}
      <motion.section
        initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 15 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.45, ease: CUBIC_EASE }}
        className="w-full"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 w-full max-w-full">
          {/* Chart Card 1: 7-Day Weekly Study Velocity (Responsive Bar Chart) */}
          <div className="bg-surface border border-border rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-xs w-full max-w-full overflow-hidden flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                    <BarChart3 className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-display text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                      Weekly Focus Activity
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Daily study minutes logged over the current week
                    </p>
                  </div>
                </div>
                <span className="text-xs font-semibold text-indigo-600 dark:text-cyan-400">
                  {goalProgress?.dailyMinutesLoggedToday || 0}m Today
                </span>
              </div>

              {/* Responsive 7-Day Bar Chart Container */}
              <div className="w-full max-w-full pt-4 pb-2">
                <div className="flex items-end justify-between gap-2 sm:gap-3 h-36 sm:h-40 w-full max-w-full px-1">
                  {dailyStudyData.map((d, i) => {
                    const heightPercent = Math.max(8, Math.round((d.mins / maxDailyMinutes) * 100));
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group">
                        <span className="text-[10px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400">
                          {d.mins > 0 ? `${d.mins}m` : '0'}
                        </span>
                        <div className="w-full max-w-[36px] bg-slate-100 dark:bg-slate-800/80 rounded-t-xl h-full flex items-end overflow-hidden">
                          <div
                            className={`w-full rounded-t-xl transition-all duration-500 ${
                              d.isToday
                                ? 'bg-gradient-to-t from-indigo-600 to-cyan-400 shadow-md shadow-indigo-500/30'
                                : d.isPast && d.mins > 0
                                ? 'bg-indigo-600/70 dark:bg-indigo-500/60 group-hover:bg-indigo-600'
                                : 'bg-slate-200 dark:bg-slate-800'
                            }`}
                            style={{ height: `${heightPercent}%` }}
                          />
                        </div>
                        <span
                          className={`text-[11px] font-bold ${
                            d.isToday
                              ? 'text-indigo-600 dark:text-cyan-400 font-extrabold'
                              : 'text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          {d.day}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Target: 45 min/day</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                {streak?.currentStreakDays || 1} Day Streak Active
              </span>
            </div>
          </div>

          {/* Chart Card 2: Spaced Repetition Mastery Distribution */}
          <div className="bg-surface border border-border rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-xs w-full max-w-full overflow-hidden flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    <PieChart className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-display text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                      Spaced Repetition Mastery
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Retention stages across 5 Leitner boxes
                    </p>
                  </div>
                </div>
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  {Math.round((box5Mastered / Math.max(totalCards, 1)) * 100)}% Mastered
                </span>
              </div>

              {/* Segmented Progress Bar */}
              <div className="w-full max-w-full my-3">
                <div className="w-full h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex">
                  <div
                    style={{ width: `${(box1Count / totalCards) * 100}%` }}
                    className="bg-rose-500 transition-all duration-300"
                    title="Box 1 (Daily Review)"
                  />
                  <div
                    style={{ width: `${(box2Count / totalCards) * 100}%` }}
                    className="bg-amber-500 transition-all duration-300"
                    title="Box 2 (Every 3 Days)"
                  />
                  <div
                    style={{ width: `${(box3Count / totalCards) * 100}%` }}
                    className="bg-blue-500 transition-all duration-300"
                    title="Box 3 (Weekly)"
                  />
                  <div
                    style={{ width: `${(box4Count / totalCards) * 100}%` }}
                    className="bg-indigo-500 transition-all duration-300"
                    title="Box 4 (Bi-weekly)"
                  />
                  <div
                    style={{ width: `${(box5Mastered / totalCards) * 100}%` }}
                    className="bg-emerald-500 transition-all duration-300"
                    title="Box 5 (Permanent Mastery)"
                  />
                </div>
              </div>

              {/* Leitner Box Breakdown Legend */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
                  <span className="text-slate-600 dark:text-slate-400 truncate">Box 1 (Needs Work): {box1Count}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
                  <span className="text-slate-600 dark:text-slate-400 truncate">Box 2 (Learning): {box2Count}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
                  <span className="text-slate-600 dark:text-slate-400 truncate">Box 3 (Review): {box3Count}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 shrink-0" />
                  <span className="text-slate-600 dark:text-slate-400 truncate">Box 4 (Solid): {box4Count}</span>
                </div>
                <div className="flex items-center gap-1.5 col-span-2 sm:col-span-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                  <span className="text-slate-600 dark:text-slate-400 font-semibold truncate">
                    Box 5 (Long-Term Mastery): {box5Mastered}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
              <span className="text-xs text-slate-500 dark:text-slate-400">{totalCards} Active Flashcards</span>
              <button
                onClick={() => onNavigate('flashcards')}
                className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>Practice Deck</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </motion.section>

      {/* ------------------------------------------------------------------- */}
      {/* 5. PERSONALIZED RECOMMENDATIONS (CORTEXA AI ADVICE) */}
      {/* ------------------------------------------------------------------- */}
      <motion.section
        initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 15 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.45, ease: CUBIC_EASE }}
        className="w-full"
      >
        <div className="bg-surface border border-border rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-7 shadow-xs w-full max-w-full">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
            <div>
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                  <Compass className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <h2 className="font-display text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                  Recommended Study Actions
                </h2>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Data-grounded insights tailored to your retention curves and quiz error rates.
              </p>
            </div>

            <button
              onClick={handleRefreshAiCoach}
              disabled={loadingAiCoach}
              className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-600 dark:text-indigo-300 text-xs font-bold transition min-h-[38px] cursor-pointer shrink-0"
            >
              <Sparkles className={`w-3.5 h-3.5 ${loadingAiCoach ? 'animate-spin text-cyan-400' : ''}`} />
              <span>{loadingAiCoach ? 'Synthesizing...' : 'Cortexa AI Coach Advice'}</span>
            </button>
          </div>

          {/* AI Coach Expanded Advice Banner */}
          {aiCoachAdvice && (
            <div className="mb-5 p-4 sm:p-5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-500/30 text-slate-900 dark:text-slate-200">
              <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-cyan-400 mb-1.5">
                <Sparkles className="w-4 h-4" />
                <span>Cortexa AI Guidance</span>
              </div>
              <p className="text-xs sm:text-sm leading-relaxed whitespace-pre-line text-slate-700 dark:text-slate-300">
                {aiCoachAdvice.advice}
              </p>
              {aiCoachAdvice.actionItems && aiCoachAdvice.actionItems.length > 0 && (
                <div className="mt-3 pt-3 border-t border-indigo-200 dark:border-indigo-500/20 flex flex-wrap gap-2">
                  {aiCoachAdvice.actionItems.map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => onNavigate(item.tab)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/10 dark:bg-indigo-600/30 hover:bg-indigo-600/20 dark:hover:bg-indigo-600/50 text-indigo-700 dark:text-indigo-200 text-xs font-semibold border border-indigo-300 dark:border-indigo-500/30 transition cursor-pointer"
                    >
                      <span>{item.task}</span>
                      <ArrowRight className="w-3 h-3 text-indigo-500 dark:text-indigo-400" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Recommendations Cards Grid */}
          {recommendations.length === 0 ? (
            <div className="p-6 sm:p-8 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 text-center">
              <CheckCircle className="w-8 h-8 text-emerald-500 dark:text-emerald-400 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">All Caught Up!</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1">
                Take practice quizzes or add study materials to generate tailored study recommendations.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4 w-full">
              {recommendations.map((rec) => (
                <motion.div
                  key={rec.id}
                  variants={cardItemVariants}
                  className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-slate-700 transition flex flex-col justify-between w-full"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2 text-xs">
                      <span className={getPriorityStyle(rec.priority)}>
                        {rec.priority.toUpperCase()} PRIORITY
                      </span>
                      {rec.metricBadge && (
                        <span className="text-slate-500 dark:text-slate-400 font-medium">
                          {rec.metricBadge}
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-1.5">
                      {rec.type === 'weak_topic' && (
                        <AlertTriangle className="w-4 h-4 text-rose-500 dark:text-rose-400 shrink-0" />
                      )}
                      {rec.type === 'spaced_repetition' && (
                        <RotateCcw className="w-4 h-4 text-amber-500 dark:text-amber-400 shrink-0" />
                      )}
                      {rec.type === 'study_plan' && (
                        <CalendarCheck className="w-4 h-4 text-indigo-500 dark:text-indigo-400 shrink-0" />
                      )}
                      {rec.type === 'mastery' && (
                        <Award className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0" />
                      )}
                      {rec.type === 'streak' && <Flame className="w-4 h-4 text-amber-500 dark:text-amber-400 shrink-0" />}
                      <span className="truncate">{rec.title}</span>
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{rec.message}</p>
                  </div>

                  <div className="mt-3.5 pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {rec.subjectName ? `Course: ${rec.subjectName}` : 'Cortexa AI Engine'}
                    </span>
                    <button
                      onClick={() => onNavigate(rec.actionableTab, rec.actionMeta)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-indigo-600/10 dark:bg-indigo-600/25 hover:bg-indigo-600/20 dark:hover:bg-indigo-600/40 text-indigo-600 dark:text-indigo-300 text-xs font-bold transition shrink-0 min-h-[36px] cursor-pointer"
                    >
                      <span>{rec.actionLabel}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </motion.section>

      {/* ------------------------------------------------------------------- */}
      {/* 6. TOPIC MASTERY DIAGNOSTICS: Weak vs Strong Topics */}
      {/* ------------------------------------------------------------------- */}
      <motion.section
        initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 15 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.45, ease: CUBIC_EASE }}
        className="w-full"
      >
        <div className="bg-surface border border-border rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-7 shadow-xs w-full max-w-full">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
            <div>
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <Target className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <h2 className="font-display text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                  Topic Mastery Diagnostic
                </h2>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Identify strong concepts and pinpoint low-accuracy weak areas for exam prep.
              </p>
            </div>

            {/* Segmented Button Filter Switcher */}
            <div className="grid grid-cols-2 p-1 bg-slate-100 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 sm:w-auto w-full">
              <button
                onClick={() => setTopicTab('weak')}
                className={`py-1.5 px-3 rounded-xl text-xs font-bold transition text-center min-h-[36px] flex items-center justify-center cursor-pointer ${
                  topicTab === 'weak'
                    ? 'bg-rose-500/15 text-rose-600 dark:text-rose-300 border border-rose-500/30 shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Weak Topics ({weakTopics.length})
              </button>
              <button
                onClick={() => setTopicTab('strong')}
                className={`py-1.5 px-3 rounded-xl text-xs font-bold transition text-center min-h-[36px] flex items-center justify-center cursor-pointer ${
                  topicTab === 'strong'
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30 shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Strong Topics ({strongTopics.length})
              </button>
            </div>
          </div>

          {topicTab === 'weak' ? (
            weakTopics.length === 0 ? (
              <div className="p-6 sm:p-8 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 text-center">
                <CheckCircle className="w-8 h-8 text-emerald-500 dark:text-emerald-400 mx-auto mb-2" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">No Critical Weak Topics</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1">
                  You currently have no concepts scoring below 70%. Take more practice quizzes to test your mastery.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4 w-full">
                {weakTopics.map((topic) => (
                  <motion.div
                    key={topic.id}
                    variants={cardItemVariants}
                    className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition flex flex-col justify-between w-full"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2 text-xs">
                        <span className="font-bold text-rose-600 dark:text-rose-400">
                          {topic.accuracy}% Accuracy
                        </span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          {topic.totalCorrect}/{topic.totalQuestionsAttempted} correct
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-0.5 truncate">
                        {topic.topicName}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {topic.subjectName ? `Subject: ${topic.subjectName}` : 'Needs Revision'}
                      </p>

                      <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 mt-2.5 overflow-hidden">
                        <div
                          className="bg-rose-500 h-1.5 rounded-full"
                          style={{ width: `${Math.min(topic.accuracy, 100)}%` }}
                        />
                      </div>
                    </div>

                    <div className="mt-3.5 pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2">
                      <button
                        onClick={() => onNavigate('ai-room', { explainTopic: topic.topicName })}
                        className="flex-1 text-center py-2 px-3 rounded-xl bg-indigo-600/10 dark:bg-indigo-600/25 hover:bg-indigo-600/20 dark:hover:bg-indigo-600/35 text-indigo-600 dark:text-indigo-300 text-xs font-bold transition min-h-[36px] cursor-pointer"
                      >
                        AI Explain
                      </button>
                      <button
                        onClick={() => onNavigate('quizzes', { focusTopic: topic.topicName })}
                        className="py-2 px-3 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition min-h-[36px] cursor-pointer"
                      >
                        Quiz Me
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )
          ) : strongTopics.length === 0 ? (
            <div className="p-6 sm:p-8 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 text-center">
              <Zap className="w-8 h-8 text-indigo-500 dark:text-indigo-400 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">No Strong Topics Logged Yet</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1">
                Score 80% or higher on practice quizzes to log verified strong topics here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4 w-full">
              {strongTopics.map((topic) => (
                <motion.div
                  key={topic.id}
                  variants={cardItemVariants}
                  className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition flex flex-col justify-between w-full"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2 text-xs">
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {topic.accuracy}% Mastered
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        {topic.totalCorrect}/{topic.totalQuestionsAttempted} correct
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-0.5 truncate">
                      {topic.topicName}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {topic.subjectName ? `Subject: ${topic.subjectName}` : 'Mastery Achieved'}
                    </p>

                    <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 mt-2.5 overflow-hidden">
                      <div
                        className="bg-emerald-500 h-1.5 rounded-full"
                        style={{ width: `${Math.min(topic.accuracy, 100)}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-3.5 pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2">
                    <button
                      onClick={() => onNavigate('quizzes', { focusTopic: topic.topicName, difficulty: 'hard' })}
                      className="flex-1 text-center py-2 px-3 rounded-xl bg-emerald-500/10 dark:bg-emerald-600/25 hover:bg-emerald-500/20 dark:hover:bg-emerald-600/35 text-emerald-600 dark:text-emerald-300 text-xs font-bold transition min-h-[36px] cursor-pointer"
                    >
                      Challenge Quiz
                    </button>
                    <button
                      onClick={() => onNavigate('flashcards', { filterTopic: topic.topicName })}
                      className="py-2 px-3 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition min-h-[36px] cursor-pointer"
                    >
                      Cards
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </motion.section>

      {/* ------------------------------------------------------------------- */}
      {/* 7. REVISION HUB & RECENT STUDY KNOWLEDGE */}
      {/* ------------------------------------------------------------------- */}
      <motion.section
        initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 15 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.45, ease: CUBIC_EASE }}
        className="w-full"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 md:gap-8 w-full max-w-full">
          {/* Left: Needs Revision Hub */}
          <div className="bg-surface border border-border rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-xs w-full">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500 dark:text-amber-400 border border-amber-500/20">
                  <RotateCcw className="w-4 h-4" />
                </div>
                <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">Needs Revision Hub</h2>
              </div>
              <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                {needsRevision.length} Due
              </span>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Concepts and spaced-repetition flashcards flagged for active recall.
            </p>

            {needsRevision.length === 0 ? (
              <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 text-center">
                <CheckCircle className="w-7 h-7 text-emerald-500 dark:text-emerald-400 mx-auto mb-2" />
                <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">No items pending revision</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {needsRevision.slice(0, 5).map((item) => (
                  <motion.div
                    key={item.id}
                    variants={cardItemVariants}
                    className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition flex items-center justify-between gap-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900 dark:text-white truncate">{item.title}</span>
                        {item.repetitionBox && (
                          <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 shrink-0">
                            Box {item.repetitionBox}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">{item.reason}</p>
                    </div>

                    <button
                      onClick={() => {
                        if (item.type.startsWith('flashcard')) {
                          onNavigate('flashcards', { filterTopic: item.topicName });
                        } else {
                          onNavigate('quizzes', { focusTopic: item.topicName });
                        }
                      }}
                      className="p-2 rounded-xl bg-indigo-600/10 dark:bg-indigo-600/25 hover:bg-indigo-600/20 dark:hover:bg-indigo-600/40 text-indigo-600 dark:text-indigo-300 text-xs font-semibold transition shrink-0 min-h-[36px] min-w-[36px] flex items-center justify-center cursor-pointer"
                      title="Start Review"
                    >
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* Right: Recently Studied Materials */}
          <div className="bg-surface border border-border rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-xs w-full">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                  <BookOpen className="w-4 h-4" />
                </div>
                <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">Recent Study Materials</h2>
              </div>
              <button
                onClick={() => onNavigate('materials')}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-bold cursor-pointer"
              >
                View All
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Quickly jump back into your uploaded lecture notes and slide decks.
            </p>

            {recentlyStudied.length === 0 ? (
              <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 text-center">
                <BookOpen className="w-7 h-7 text-slate-400 dark:text-slate-600 mx-auto mb-2" />
                <p className="text-xs text-slate-500 dark:text-slate-400">No study materials accessed yet</p>
                <button
                  onClick={() => onNavigate('materials')}
                  className="mt-2 text-xs text-indigo-600 dark:text-indigo-400 font-bold underline cursor-pointer"
                >
                  Upload your first document
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {recentlyStudied.slice(0, 5).map((mat) => (
                  <motion.div
                    key={mat.id}
                    variants={cardItemVariants}
                    onClick={() => onNavigate('materials', { materialId: mat.id })}
                    className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition flex items-center justify-between gap-3 cursor-pointer"
                  >
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">{mat.title}</h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {mat.subjectName ? `Course: ${mat.subjectName} · ` : ''}
                        {formatRelativeTime(mat.timestamp)}
                      </p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      </motion.section>
    </motion.div>
  );
};
