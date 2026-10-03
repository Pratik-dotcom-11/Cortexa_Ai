import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useSubject } from '../../context/SubjectContext.tsx';
import {
  HelpCircle,
  Plus,
  Play,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  ArrowRight,
  Award,
  BookOpen,
} from 'lucide-react';
import { Quiz, StudyMaterial } from '../../types/app.types.ts';
import { Modal } from '../common/Modal.tsx';

interface QuizzesViewProps {
  initialMaterialId?: number;
}

export const QuizzesView: React.FC<QuizzesViewProps> = ({ initialMaterialId }) => {
  const { apiFetch } = useAuth();
  const { activeSubject, subjects } = useSubject();

  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [materials, setMaterials] = useState<StudyMaterial[]>([]);
  const [loading, setLoading] = useState(false);

  // Active Quiz Runner State
  const [activeQuiz, setActiveQuiz] = useState<any | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<number, number>>({});
  const [quizTimer, setQuizTimer] = useState(0);
  const [isTakingQuiz, setIsTakingQuiz] = useState(false);
  const [quizResult, setQuizResult] = useState<any | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Generator Modal State
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);
  const [selectedMaterialId, setSelectedMaterialId] = useState<number | ''>(initialMaterialId || '');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [questionCount, setQuestionCount] = useState(5);
  const [isGenerating, setIsGenerating] = useState(false);

  const loadQuizzes = async () => {
    if (!activeSubject) return;
    try {
      setLoading(true);
      const res = await apiFetch(`/api/quizzes?subjectId=${activeSubject.id}`);
      if (res.ok) {
        const raw = await res.json();
        const list: Quiz[] = Array.isArray(raw)
          ? raw
          : Array.isArray(raw?.data)
          ? raw.data
          : [];
        setQuizzes(list);
      }
    } catch (e) {
      console.error('Error loading quizzes:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadMaterials = async () => {
    if (!activeSubject) return;
    try {
      const res = await apiFetch(`/api/materials?subjectId=${activeSubject.id}`);
      if (res.ok) {
        const raw = await res.json();
        const list: StudyMaterial[] = Array.isArray(raw)
          ? raw
          : Array.isArray(raw?.data)
          ? raw.data
          : [];
        setMaterials(list);
        if (list.length > 0 && !selectedMaterialId) {
          setSelectedMaterialId(list[0].id);
        }
      }
    } catch (e) {
      console.error('Error loading materials:', e);
    }
  };

  useEffect(() => {
    loadQuizzes();
    loadMaterials();
  }, [activeSubject]);

  useEffect(() => {
    let interval: any = null;
    if (isTakingQuiz) {
      interval = setInterval(() => {
        setQuizTimer((t) => t + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTakingQuiz]);

  const handleStartQuiz = async (quizId: number) => {
    try {
      const res = await apiFetch(`/api/quizzes/${quizId}`);
      if (res.ok) {
        const raw = await res.json();
        const data = raw?.data ?? raw;
        setActiveQuiz(data);
        setCurrentQuestionIndex(0);
        setUserAnswers({});
        setQuizTimer(0);
        setQuizResult(null);
        setIsTakingQuiz(true);
      }
    } catch (err) {
      console.error('Error starting quiz:', err);
    }
  };

  const handleGenerateQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSubject || !selectedMaterialId) return;

    try {
      setIsGenerating(true);
      const res = await apiFetch('/api/quizzes/generate', {
        method: 'POST',
        body: JSON.stringify({
          subjectId: activeSubject.id,
          materialId: selectedMaterialId,
          count: questionCount,
          difficulty,
        }),
      });

      if (res.ok) {
        const raw = await res.json();
        const created = raw?.data ?? raw;
        setIsGenerateOpen(false);
        await loadQuizzes();
        if (created?.id) {
          handleStartQuiz(created.id);
        }
      }
    } catch (err) {
      console.error('Error generating quiz:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSubmitQuiz = async () => {
    if (!activeQuiz) return;

    try {
      setIsSubmitting(true);
      const selections = Object.entries(userAnswers).map(([qId, sIdx]) => ({
        questionId: Number(qId),
        selectedIndex: sIdx,
      }));

      const res = await apiFetch(`/api/quizzes/${activeQuiz.id}/submit`, {
        method: 'POST',
        body: JSON.stringify({
          userSelections: selections,
          timeTakenSeconds: quizTimer,
        }),
      });

      if (res.ok) {
        const raw = await res.json();
        const resultData = raw?.data ?? raw;
        setQuizResult(resultData);
        setIsTakingQuiz(false);
        loadQuizzes();
      }
    } catch (err) {
      console.error('Error submitting quiz attempt:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <HelpCircle className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            Active Practice & Diagnostics
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
            AI-generated multiple-choice exams that evaluate understanding and pinpoint weak topics.
          </p>
        </div>

        <button
          onClick={() => setIsGenerateOpen(true)}
          disabled={materials.length === 0}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition shadow-md shadow-indigo-600/20 disabled:opacity-50 cursor-pointer"
        >
          <Sparkles className="w-4 h-4" />
          Generate New Quiz
        </button>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* ACTIVE QUIZ RUNNER INTERFACE */}
      {/* ------------------------------------------------------------- */}
      {isTakingQuiz && activeQuiz && (
        <div className="bg-surface border border-indigo-500/40 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl">
          {/* Runner Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
            <div>
              <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                Question {currentQuestionIndex + 1} of {activeQuiz.questions?.length}
              </span>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">{activeQuiz.title}</h3>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-mono font-semibold border border-slate-200 dark:border-slate-700">
                <Clock className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                {formatSeconds(quizTimer)}
              </div>
              <button
                onClick={() => {
                  if (confirm('Cancel active quiz attempt?')) {
                    setIsTakingQuiz(false);
                    setActiveQuiz(null);
                  }
                }}
                className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                Quit
              </button>
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
            <div
              className="bg-indigo-600 h-full transition-all duration-300"
              style={{
                width: `${((currentQuestionIndex + 1) / (activeQuiz.questions?.length || 1)) * 100}%`,
              }}
            />
          </div>

          {/* Question Text & Tag with animated key */}
          {activeQuiz.questions?.[currentQuestionIndex] && (
            <div key={currentQuestionIndex} className="space-y-6 animate-in fade-in duration-200">
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 tracking-wide">
                  Topic: <span className="font-semibold text-indigo-600 dark:text-cyan-400">{activeQuiz.questions[currentQuestionIndex].topicTag}</span>
                </p>
                <h4 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white mt-2 leading-relaxed">
                  {activeQuiz.questions[currentQuestionIndex].questionText}
                </h4>
              </div>

              {/* Multiple Choice Options */}
              <div className="space-y-3">
                {activeQuiz.questions[currentQuestionIndex].options.map(
                  (opt: string, optIndex: number) => {
                    const currentQId = activeQuiz.questions[currentQuestionIndex].id;
                    const isSelected = userAnswers[currentQId] === optIndex;

                    return (
                      <button
                        key={optIndex}
                        type="button"
                        onClick={() =>
                          setUserAnswers((prev) => ({ ...prev, [currentQId]: optIndex }))
                        }
                        className={`w-full text-left p-4 rounded-2xl border transition-all duration-150 flex items-center gap-3 cursor-pointer hover:scale-[1.008] active:scale-[0.99] ${
                          isSelected
                            ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-500 text-slate-900 dark:text-white shadow-md'
                            : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-transform ${
                            isSelected
                              ? 'bg-indigo-600 text-white scale-110 shadow-xs shadow-indigo-600/30'
                              : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {String.fromCharCode(65 + optIndex)}
                        </div>
                        <span className="text-sm font-medium">{opt}</span>
                      </button>
                    );
                  },
                )}
              </div>

              {/* Navigation controls */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  disabled={currentQuestionIndex === 0}
                  onClick={() => setCurrentQuestionIndex((prev) => Math.max(0, prev - 1))}
                  className="px-4 py-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-xs font-medium disabled:opacity-30 cursor-pointer"
                >
                  Previous
                </button>

                {currentQuestionIndex < activeQuiz.questions.length - 1 ? (
                  <button
                    onClick={() =>
                      setCurrentQuestionIndex((prev) =>
                        Math.min(activeQuiz.questions.length - 1, prev + 1),
                      )
                    }
                    className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition cursor-pointer"
                  >
                    Next Question <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    onClick={handleSubmitQuiz}
                    disabled={isSubmitting}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-lg shadow-emerald-600/20 disabled:opacity-50 cursor-pointer"
                  >
                    {isSubmitting ? (
                      <>
                        <Sparkles className="w-4 h-4 animate-spin" />
                        Grading Attempt...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        Submit & View Score
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* QUIZ REVIEW / RESULTS MODAL / SECTION */}
      {/* ------------------------------------------------------------- */}
      {quizResult && !isTakingQuiz && (
        <div className="bg-surface border border-border rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold mb-1">
                <Award className="w-4 h-4" /> Quiz Attempt Completed
              </div>
              <h3 className="text-2xl font-extrabold text-slate-900 dark:text-white">Score Review & Answers</h3>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">
                  {Math.round(quizResult.score)}%
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {quizResult.correctCount} / {quizResult.totalQuestions} correct
                </div>
              </div>
              <button
                onClick={() => setQuizResult(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-xs font-medium cursor-pointer"
              >
                Close Review
              </button>
            </div>
          </div>

          {/* Evaluated Questions Breakdown */}
          <div className="space-y-4">
            {quizResult.evaluatedAnswers?.map((ans: any, idx: number) => {
              const question = activeQuiz?.questions?.find((q: any) => q.id === ans.questionId);

              return (
                <div
                  key={idx}
                  className={`p-5 rounded-2xl border ${
                    ans.isCorrect
                      ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-500/30'
                      : 'bg-rose-50 dark:bg-rose-950/20 border-rose-300 dark:border-rose-500/30'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Question {idx + 1}</span>
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                        ans.isCorrect
                          ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                          : 'bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-400'
                      }`}
                    >
                      {ans.isCorrect ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" /> Correct
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3.5 h-3.5" /> Incorrect
                        </>
                      )}
                    </span>
                  </div>

                  <p className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
                    {question?.questionText || 'Question text'}
                  </p>

                  <div className="text-xs space-y-1 mb-3">
                    <div className="text-slate-700 dark:text-slate-300">
                      Your answer:{' '}
                      <span
                        className={ans.isCorrect ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-rose-600 dark:text-rose-400 font-bold'}
                      >
                        {ans.selectedIndex >= 0 && question?.options?.[ans.selectedIndex]
                          ? question.options[ans.selectedIndex]
                          : 'Unanswered'}
                      </span>
                    </div>
                    {!ans.isCorrect && (
                      <div className="text-emerald-600 dark:text-emerald-400 font-semibold">
                        Correct answer: {question?.options?.[ans.correctIndex]}
                      </div>
                    )}
                  </div>

                  {/* AI Explanation */}
                  <div className="p-3 rounded-xl bg-surface-elevated border border-border text-xs text-foreground leading-relaxed">
                    <span className="font-semibold text-indigo-600 dark:text-indigo-400 block mb-1">
                      Academic Rationale:
                    </span>
                    {ans.explanation}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* QUIZ LIST */}
      {/* ------------------------------------------------------------- */}
      {!isTakingQuiz && (() => {
        const quizList = Array.isArray(quizzes) ? quizzes : [];
        const materialList = Array.isArray(materials) ? materials : [];
        return (
          <div className="space-y-4">
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Available Quizzes ({quizList.length})
            </div>

            {loading ? (
              <div className="p-8 text-center text-slate-500 dark:text-slate-400 text-sm">Loading quizzes...</div>
            ) : quizList.length === 0 ? (
              <div className="p-10 rounded-3xl bg-surface border border-border text-center shadow-xs">
                <HelpCircle className="w-10 h-10 text-slate-400 dark:text-slate-600 mx-auto mb-2" />
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white">No Quizzes Created Yet</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-4">
                  Generate an AI practice test from your notes to evaluate comprehension and identify weak topics.
                </p>
                <button
                  onClick={() => setIsGenerateOpen(true)}
                  disabled={materialList.length === 0}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium cursor-pointer"
                >
                  Create Practice Quiz
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {quizList.map((quiz) => (
                <div
                  key={quiz.id}
                  className="p-5 rounded-2xl bg-surface border border-border hover:border-slate-300 dark:hover:border-slate-700 transition flex flex-col justify-between shadow-xs"
                >
                  <div>
                    <div className="flex items-center justify-between text-xs mb-2">
                      <span className="px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-semibold border border-indigo-500/20 capitalize">
                        {quiz.difficulty}
                      </span>
                      <span className="text-slate-500 dark:text-slate-400">{quiz.totalQuestions} Questions</span>
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-1">{quiz.title}</h4>
                    {quiz.bestScore !== null && quiz.bestScore !== undefined && (
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold mt-1">
                        Best Score: {Math.round(Number(quiz.bestScore))}% ({quiz.attemptsCount} attempts)
                      </p>
                    )}
                  </div>

                  <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <span className="text-[11px] text-slate-400 dark:text-slate-500">
                      {new Date(quiz.createdAt).toLocaleDateString()}
                    </span>
                    <button
                      onClick={() => handleStartQuiz(quiz.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5" />
                      Take Quiz
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    })()}

      {/* Generator Modal */}
      <Modal isOpen={isGenerateOpen} onClose={() => setIsGenerateOpen(false)} title="Generate AI Practice Quiz">
        <form onSubmit={handleGenerateQuiz} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              Source Material *
            </label>
            <select
              required
              value={selectedMaterialId}
              onChange={(e) => setSelectedMaterialId(Number(e.target.value))}
              className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-slate-900 dark:text-white text-sm focus:outline-hidden focus:border-indigo-500 cursor-pointer"
            >
              {(Array.isArray(materials) ? materials : []).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                Difficulty Level
              </label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as any)}
                className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white text-xs sm:text-sm focus:outline-hidden focus:border-indigo-500 capitalize min-h-[42px] cursor-pointer"
              >
                <option value="easy">Easy (Definitions & Basics)</option>
                <option value="medium">Medium (Standard Exam)</option>
                <option value="hard">Hard (Complex Reasoning)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                Number of Questions
              </label>
              <select
                value={questionCount}
                onChange={(e) => setQuestionCount(Number(e.target.value))}
                className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white text-xs sm:text-sm focus:outline-hidden focus:border-indigo-500 min-h-[42px] cursor-pointer"
              >
                <option value={3}>3 Questions (Quick check)</option>
                <option value={5}>5 Questions (Standard)</option>
                <option value={10}>10 Questions (Comprehensive)</option>
              </select>
            </div>
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
              disabled={isGenerating || !selectedMaterialId}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-bold transition disabled:opacity-50 min-h-[44px] shadow-md shadow-indigo-600/20 cursor-pointer"
            >
              {isGenerating ? (
                <>
                  <Sparkles className="w-4 h-4 animate-spin" />
                  <span>Generating Questions...</span>
                </>
              ) : (
                'Generate & Start'
              )}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
