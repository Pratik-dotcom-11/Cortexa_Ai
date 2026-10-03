import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useSubject } from '../../context/SubjectContext.tsx';
import {
  CalendarCheck,
  Sparkles,
  CheckCircle2,
  Circle,
  Plus,
  Trash2,
  Clock,
  Target,
  AlertTriangle,
} from 'lucide-react';
import { StudyPlan } from '../../types/app.types.ts';
import { Modal } from '../common/Modal.tsx';

export const PlannerView: React.FC = () => {
  const { apiFetch } = useAuth();
  const { activeSubject, subjects } = useSubject();

  const [plans, setPlans] = useState<StudyPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<StudyPlan | null>(null);
  const [loading, setLoading] = useState(false);

  // Generate modal state
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null);
  const [targetDate, setTargetDate] = useState('');
  const [dailyHours, setDailyHours] = useState(2);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const loadPlans = async (overrideSubjectId?: number) => {
    const subjId = overrideSubjectId || activeSubject?.id || (subjects.length > 0 ? subjects[0].id : undefined);
    try {
      setLoading(true);
      const url = subjId ? `/api/study-plan?subjectId=${subjId}` : '/api/study-plan';
      const res = await apiFetch(url);
      if (res.ok) {
        const raw = await res.json();
        const list: StudyPlan[] = Array.isArray(raw)
          ? raw
          : Array.isArray(raw?.data)
          ? raw.data
          : [];
        setPlans(list);
        if (list.length > 0) {
          setSelectedPlan(list[0]);
        } else {
          setSelectedPlan(null);
        }
      }
    } catch (e) {
      console.error('Error fetching study plans:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlans();
  }, [activeSubject, subjects]);

  useEffect(() => {
    if (isGenerateOpen) {
      setSelectedSubjectId(activeSubject?.id || (subjects.length > 0 ? subjects[0].id : null));
      setGenerateError(null);
    }
  }, [isGenerateOpen, activeSubject, subjects]);

  const handleGeneratePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenerateError(null);

    const targetSubjId = selectedSubjectId || activeSubject?.id || (subjects.length > 0 ? subjects[0].id : null);
    if (!targetSubjId) {
      setGenerateError('Please select or create a course / subject first before generating a study plan.');
      return;
    }

    try {
      setIsGenerating(true);
      const defaultDate = new Date(Date.now() + 14 * 86400 * 1000).toISOString().split('T')[0];
      const cleanTargetDate = targetDate || defaultDate;

      const res = await apiFetch('/api/ai/study-plan', {
        method: 'POST',
        body: JSON.stringify({
          subjectId: targetSubjId,
          targetDate: cleanTargetDate,
          dailyHours: Number(dailyHours) || 2,
        }),
      });

      const text = await res.text();
      let raw: any = null;
      try {
        raw = text ? JSON.parse(text) : {};
      } catch {
        throw new Error(
          res.ok
            ? 'Server returned invalid response format.'
            : `Failed to generate study plan (HTTP ${res.status}): ${text.slice(0, 100)}`,
        );
      }

      if (!res.ok) {
        throw new Error(raw?.message || raw?.error || 'Failed to generate study plan.');
      }

      const created = raw?.data || raw;
      setIsGenerateOpen(false);
      setGenerateError(null);
      await loadPlans(targetSubjId);
      if (created) {
        setSelectedPlan(created);
      }
    } catch (err: any) {
      console.error('Error generating study plan:', err);
      setGenerateError(err.message || 'An error occurred while generating your study plan.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleToggleDay = async (planId: number, dayNumber: number) => {
    try {
      const res = await apiFetch(`/api/study-plans/${planId}/toggle`, {
        method: 'PATCH',
        body: JSON.stringify({ day: dayNumber }),
      });

      if (res.ok) {
        const updated = await res.json();
        setSelectedPlan(updated);
        setPlans((prev) => prev.map((p) => (p.id === planId ? updated : p)));
      }
    } catch (e) {
      console.error('Error toggling day:', e);
    }
  };

  const handleDeletePlan = async (id: number) => {
    if (!confirm('Delete this study plan?')) return;
    try {
      const res = await apiFetch(`/api/study-plans/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setPlans((prev) => prev.filter((p) => p.id !== id));
        if (selectedPlan?.id === id) {
          setSelectedPlan(plans.find((p) => p.id !== id) || null);
        }
      }
    } catch (e) {
      console.error('Error deleting study plan:', e);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <CalendarCheck className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            AI Personalized Study Planner
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
            Targeted schedules structured around your verified weak topics and exam deadlines.
          </p>
        </div>

        <button
          onClick={() => setIsGenerateOpen(true)}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition shadow-md shadow-indigo-600/20 cursor-pointer"
        >
          <Sparkles className="w-4 h-4" />
          Create AI Plan
        </button>
      </div>

      {/* Plan Details & Day Checklist */}
      {selectedPlan ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Plan Summary & Goals Progress */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-surface border border-border rounded-3xl p-6 space-y-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-md bg-indigo-500/10 border border-indigo-500/20">
                  Active Schedule
                </span>
                <button
                  onClick={() => handleDeletePlan(selectedPlan.id)}
                  className="p-1 rounded-lg text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 transition cursor-pointer"
                  title="Delete Plan"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">{selectedPlan.title}</h3>
                {selectedPlan.targetDate && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
                    <Target className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    Target Exam: {selectedPlan.targetDate}
                  </p>
                )}
              </div>

              {selectedPlan.overview && (
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700/60">
                  {selectedPlan.overview}
                </p>
              )}

              {/* Progress counter */}
              <div className="pt-2">
                <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mb-1.5 font-medium">
                  <span>Completed Days</span>
                  <span>
                    {selectedPlan.dailyGoals.filter((g) => g.done).length} of{' '}
                    {selectedPlan.dailyGoals.length}
                  </span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full transition-all duration-300"
                    style={{
                      width: `${
                        (selectedPlan.dailyGoals.filter((g) => g.done).length /
                          (selectedPlan.dailyGoals.length || 1)) *
                        100
                      }%`,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Other Plans switch list */}
            {plans.length > 1 && (
              <div className="bg-surface border border-border rounded-3xl p-5 space-y-2 shadow-xs">
                <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                  All Schedules ({plans.length})
                </h4>
                {plans.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPlan(p)}
                    className={`w-full text-left p-3 rounded-xl text-xs font-medium transition cursor-pointer ${
                      selectedPlan.id === p.id
                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border border-indigo-500/40 font-semibold'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    {p.title}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right: Days Checklist */}
          <div className="lg:col-span-8 space-y-3">
            {selectedPlan.dailyGoals.map((dayGoal) => (
              <div
                key={dayGoal.day}
                className={`p-5 rounded-2xl border transition shadow-xs ${
                  dayGoal.done
                    ? 'bg-emerald-50 dark:bg-emerald-950/10 border-emerald-300 dark:border-emerald-500/30'
                    : 'bg-surface border-border hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleToggleDay(selectedPlan.id, dayGoal.day)}
                      className="p-1 rounded-lg text-slate-400 hover:text-emerald-500 dark:hover:text-emerald-400 transition cursor-pointer"
                    >
                      {dayGoal.done ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <Circle className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                      )}
                    </button>
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                        Day {dayGoal.day}
                      </span>
                      <h4
                        className={`text-sm font-bold mt-0.5 ${
                          dayGoal.done ? 'text-slate-400 dark:text-slate-500 line-through' : 'text-slate-900 dark:text-white'
                        }`}
                      >
                        {dayGoal.topic}
                      </h4>
                    </div>
                  </div>

                  <span
                    className={`text-[11px] font-semibold ${
                      dayGoal.done
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {dayGoal.done ? 'Completed' : 'Scheduled'}
                  </span>
                </div>

                <div className="pl-8 space-y-1.5">
                  {dayGoal.tasks.map((task, tIdx) => (
                    <div
                      key={tIdx}
                      className="text-xs text-slate-700 dark:text-slate-300 flex items-start gap-2 bg-slate-50 dark:bg-slate-800/40 p-2 rounded-lg border border-slate-100 dark:border-transparent"
                    >
                      <span className="text-indigo-600 dark:text-indigo-400 font-mono">•</span>
                      <span>{task}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="p-12 rounded-3xl bg-surface border border-border text-center shadow-xs">
          <CalendarCheck className="w-12 h-12 text-slate-400 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">No Active Study Plan</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-4 max-w-sm mx-auto">
            Let AI examine your course materials and weak topics to construct a personalized study schedule.
          </p>
          <button
            onClick={() => setIsGenerateOpen(true)}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold cursor-pointer"
          >
            Generate Personalized Plan
          </button>
        </div>
      )}

      {/* Generator Modal */}
      <Modal isOpen={isGenerateOpen} onClose={() => setIsGenerateOpen(false)} title="Generate AI Study Plan">
        <form onSubmit={handleGeneratePlan} className="space-y-4">
          {generateError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center justify-between gap-2">
              <span>{generateError}</span>
              <button
                type="button"
                onClick={() => setGenerateError(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                Dismiss
              </button>
            </div>
          )}

          {subjects.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                Target Course / Subject *
              </label>
              <select
                value={selectedSubjectId || ''}
                onChange={(e) => setSelectedSubjectId(Number(e.target.value))}
                className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white text-xs sm:text-sm focus:outline-hidden focus:border-indigo-500 min-h-[42px] cursor-pointer font-medium"
              >
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code ? `[${s.code}] ` : ''}{s.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              Target Exam or Deadline Date
            </label>
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white text-xs sm:text-sm focus:outline-hidden focus:border-indigo-500 min-h-[42px]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              Available Daily Study Time
            </label>
            <select
              value={dailyHours}
              onChange={(e) => setDailyHours(Number(e.target.value))}
              className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white text-xs sm:text-sm focus:outline-hidden focus:border-indigo-500 min-h-[42px] cursor-pointer"
            >
              <option value={1}>1 hour / day (Light review)</option>
              <option value={2}>2 hours / day (Recommended)</option>
              <option value={3}>3 hours / day (Intensive exam prep)</option>
              <option value={4}>4+ hours / day (Cram session)</option>
            </select>
          </div>

          <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-slate-700 dark:text-slate-300">
            <span className="font-semibold text-indigo-600 dark:text-indigo-400 block mb-1">
              AI Scheduling Strategy:
            </span>
            The algorithm will prioritize your identified weak topics first, scheduling active recall quizzes and spaced repetition flashcard sessions leading up to your deadline.
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsGenerateOpen(false)}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-xs sm:text-sm font-medium min-h-[42px] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isGenerating}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-bold transition disabled:opacity-50 min-h-[44px] shadow-md shadow-indigo-600/20 cursor-pointer"
            >
              {isGenerating ? (
                <>
                  <Sparkles className="w-4 h-4 animate-spin" />
                  <span>Generating Schedule...</span>
                </>
              ) : (
                'Generate Study Plan'
              )}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
