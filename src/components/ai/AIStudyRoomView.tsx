import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useSubject } from '../../context/SubjectContext.tsx';
import { ConversationalTutor } from './ConversationalTutor.tsx';
import { MarkdownRenderer } from '../common/MarkdownRenderer.tsx';
import { StudyMaterial } from '../../types/app.types.ts';
import {
  Brain,
  MessageSquare,
  Sparkles,
  BookOpen,
  HelpCircle,
  Lightbulb,
  CheckCircle2,
  BookmarkCheck,
  Send,
  Loader2,
} from 'lucide-react';

interface AIStudyRoomViewProps {
  initialExplainTopic?: string;
  initialMaterialId?: number;
  onNavigate?: (tab: string, meta?: any) => void;
}

export const AIStudyRoomView: React.FC<AIStudyRoomViewProps> = ({
  initialExplainTopic,
  initialMaterialId,
  onNavigate,
}) => {
  const { apiFetch } = useAuth();
  const { activeSubject } = useSubject();

  // Mode: 'tutor' (Conversational Assistant), 'explainer' (Multi-level explainer), 'summary' (Summary & Vocab)
  const [subTab, setSubTab] = useState<'tutor' | 'explainer' | 'summary'>(
    initialExplainTopic ? 'explainer' : 'tutor',
  );

  // Available materials for grounding
  const [materials, setMaterials] = useState<StudyMaterial[]>([]);
  const [selectedMaterialId, setSelectedMaterialId] = useState<number | ''>(
    initialMaterialId || '',
  );

  // Multi-Level Explainer State
  const [explainTopic, setExplainTopic] = useState(initialExplainTopic || '');
  const [difficultyLevel, setDifficultyLevel] = useState<
    'beginner' | 'intermediate' | 'advanced'
  >('intermediate');
  const [explanationResult, setExplanationResult] = useState<any | null>(null);
  const [isExplaining, setIsExplaining] = useState(false);

  // Summaries State
  const [summaryData, setSummaryData] = useState<any | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);

  // Fetch materials for current subject
  useEffect(() => {
    async function fetchMats() {
      try {
        const url = activeSubject
          ? `/api/materials?subjectId=${activeSubject.id}`
          : '/api/materials';
        const res = await apiFetch(url);
        if (res.ok) {
          const raw = await res.json();
          const list: StudyMaterial[] = Array.isArray(raw?.data)
            ? raw.data
            : Array.isArray(raw)
            ? raw
            : [];
          setMaterials(list);
          if (list.length > 0 && !selectedMaterialId) {
            setSelectedMaterialId(list[0].id);
          }
        }
      } catch (e) {
        console.error('Error fetching materials for AI room:', e);
      }
    }
    fetchMats();
  }, [activeSubject, apiFetch]);

  // Trigger explain topic if passed from Dashboard
  useEffect(() => {
    if (initialExplainTopic) {
      setExplainTopic(initialExplainTopic);
      setSubTab('explainer');
    }
  }, [initialExplainTopic]);

  // Handle Multi-Level Explain
  const handleExplainTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!explainTopic.trim()) return;

    try {
      setIsExplaining(true);
      const res = await apiFetch('/api/ai/explain', {
        method: 'POST',
        body: JSON.stringify({
          topic: explainTopic.trim(),
          level: difficultyLevel,
          subjectContext: activeSubject?.name,
          materialId: selectedMaterialId || undefined,
        }),
      });

      if (res.ok) {
        const raw = await res.json();
        const data = raw?.data ?? raw;
        setExplanationResult(data);
      }
    } catch (err) {
      console.error('Error explaining topic:', err);
    } finally {
      setIsExplaining(false);
    }
  };

  // Handle Summarize Document
  const handleSummarize = async () => {
    if (!selectedMaterialId) return;

    try {
      setIsSummarizing(true);
      const res = await apiFetch('/api/ai/summarize', {
        method: 'POST',
        body: JSON.stringify({
          materialId: selectedMaterialId,
        }),
      });

      if (res.ok) {
        const raw = await res.json();
        const data = raw?.data ?? raw;
        setSummaryData(data);
      }
    } catch (err) {
      console.error('Error summarizing material:', err);
    } finally {
      setIsSummarizing(false);
    }
  };

  return (
    <div className="space-y-5 sm:space-y-6 animate-in fade-in duration-200">
      {/* ------------------------------------------------------------------- */}
      {/* TOP HEADER & MODE SWITCHER */}
      {/* ------------------------------------------------------------------- */}
      <div className="bg-surface border border-border rounded-2xl sm:rounded-3xl p-4 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-3.5 shadow-xs">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-semibold mb-1 border border-indigo-500/20">
            <Brain className="w-3.5 h-3.5" />
            <span>Cortexa AI Assistant</span>
          </div>
          <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">Intelligent Academic & Multi-Mode Hub</h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
            Universal AI assistant, multi-mode reasoning, concept breakdowns, and grounded recall.
          </p>
        </div>

        {/* Sub-tabs: Responsive Segmented Control */}
        <div className="grid grid-cols-3 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 w-full md:w-auto">
          <button
            onClick={() => setSubTab('tutor')}
            className={`flex items-center justify-center gap-1.5 py-2 px-2.5 sm:px-3.5 rounded-lg text-xs font-bold transition min-h-[38px] cursor-pointer ${
              subTab === 'tutor'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">AI Assistant</span>
          </button>

          <button
            onClick={() => setSubTab('explainer')}
            className={`flex items-center justify-center gap-1.5 py-2 px-2.5 sm:px-3.5 rounded-lg text-xs font-bold transition min-h-[38px] cursor-pointer ${
              subTab === 'explainer'
                ? 'bg-violet-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Explainer</span>
          </button>

          <button
            onClick={() => setSubTab('summary')}
            className={`flex items-center justify-center gap-1.5 py-2 px-2.5 sm:px-3.5 rounded-lg text-xs font-bold transition min-h-[38px] cursor-pointer ${
              subTab === 'summary'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Summary</span>
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* TAB 1: CONVERSATIONAL STUDY TUTOR */}
      {/* ------------------------------------------------------------- */}
      {subTab === 'tutor' && (
        <ConversationalTutor
          initialSubjectId={activeSubject?.id}
          initialMaterialId={Number(selectedMaterialId) || undefined}
          onNavigate={onNavigate}
        />
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 2: MULTI-LEVEL EXPLAINER */}
      {/* ------------------------------------------------------------- */}
      {subTab === 'explainer' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
          {/* Prompt panel */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-surface border border-border rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-xs">
              <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">Explain Difficult Topic</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                Enter any challenging term, theorem, or question and choose depth.
              </p>

              <form onSubmit={handleExplainTopic} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                    Concept / Topic Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Page Table Walker, Nash Equilibrium"
                    value={explainTopic}
                    onChange={(e) => setExplainTopic(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-xs sm:text-sm focus:outline-hidden focus:border-violet-500 min-h-[42px]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    Explanation Depth
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setDifficultyLevel('beginner')}
                      className={`p-2 sm:p-2.5 rounded-xl border text-center transition min-h-[48px] cursor-pointer ${
                        difficultyLevel === 'beginner'
                          ? 'bg-amber-500/15 border-amber-500 text-amber-700 dark:text-amber-300 font-bold'
                          : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <div className="text-xs font-bold">Beginner</div>
                      <div className="text-[10px] opacity-75">ELI5</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDifficultyLevel('intermediate')}
                      className={`p-2 sm:p-2.5 rounded-xl border text-center transition min-h-[48px] cursor-pointer ${
                        difficultyLevel === 'intermediate'
                          ? 'bg-violet-500/15 border-violet-500 text-violet-700 dark:text-violet-300 font-bold'
                          : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <div className="text-xs font-bold">Standard</div>
                      <div className="text-[10px] opacity-75">Undergrad</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDifficultyLevel('advanced')}
                      className={`p-2 sm:p-2.5 rounded-xl border text-center transition min-h-[48px] cursor-pointer ${
                        difficultyLevel === 'advanced'
                          ? 'bg-rose-500/15 border-rose-500 text-rose-700 dark:text-rose-300 font-bold'
                          : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <div className="text-xs font-bold">Advanced</div>
                      <div className="text-[10px] opacity-75">Graduate</div>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                    Optional Reference Document
                  </label>
                  <select
                    value={selectedMaterialId}
                    onChange={(e) =>
                      setSelectedMaterialId(e.target.value ? Number(e.target.value) : '')
                    }
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white text-xs sm:text-sm focus:outline-hidden focus:border-violet-500 cursor-pointer min-h-[42px]"
                  >
                    <option value="">No specific note (General Subject Knowledge)</option>
                    {materials.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.title}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={isExplaining || !explainTopic.trim()}
                  className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs sm:text-sm transition disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-violet-600/20 min-h-[44px] cursor-pointer"
                >
                  {isExplaining ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Synthesizing Explanation...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Generate Multi-Level Breakdown</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* Result view panel */}
          <div className="lg:col-span-7">
            {explanationResult ? (
              <div className="bg-surface border border-border rounded-2xl sm:rounded-3xl p-5 sm:p-7 space-y-5 shadow-xs">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                  <div>
                    <span className="text-[10px] font-bold text-violet-600 dark:text-violet-400 uppercase tracking-wider">
                      {difficultyLevel.toUpperCase()} BREAKDOWN
                    </span>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">{explanationResult.topic || explainTopic}</h3>
                  </div>
                </div>

                {/* Key takeaway */}
                {explanationResult.keyTakeaway && (
                  <div className="p-4 rounded-xl bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-500/25">
                    <span className="text-xs font-bold text-violet-700 dark:text-violet-300 block mb-1">Key Takeaway</span>
                    <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200">{explanationResult.keyTakeaway}</p>
                  </div>
                )}

                {/* Main Explanation */}
                <div className="text-slate-800 dark:text-slate-200 text-xs sm:text-sm leading-relaxed space-y-2">
                  <MarkdownRenderer content={explanationResult.explanation || explanationResult.markdown || ''} />
                </div>

                {/* Analogy */}
                {explanationResult.analogy && (
                  <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/25 flex items-start gap-3">
                    <Lightbulb className="w-5 h-5 text-amber-500 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-xs font-bold text-amber-800 dark:text-amber-300 block mb-0.5">Intuitive Analogy</span>
                      <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200">{explanationResult.analogy}</p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-surface border border-border rounded-2xl sm:rounded-3xl p-8 sm:p-12 text-center text-slate-500 dark:text-slate-400 shadow-xs">
                <Sparkles className="w-10 h-10 text-slate-400 dark:text-slate-600 mx-auto mb-2" />
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">No Explanation Generated Yet</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                  Enter a topic on the left and select your preferred difficulty level to generate a custom breakdown.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 3: DEEP SUMMARY & VOCABULARY */}
      {/* ------------------------------------------------------------- */}
      {subTab === 'summary' && (
        <div className="bg-surface border border-border rounded-2xl sm:rounded-3xl p-4 sm:p-7 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">Document Summarizer</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Generate key takeaways, executive summaries, and core terminology lists.
              </p>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={selectedMaterialId}
                onChange={(e) =>
                  setSelectedMaterialId(e.target.value ? Number(e.target.value) : '')
                }
                className="w-full sm:w-auto bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-slate-900 dark:text-white text-xs sm:text-sm focus:outline-hidden focus:border-emerald-500 min-h-[40px]"
              >
                {materials.length === 0 ? (
                  <option value="">No Materials Uploaded</option>
                ) : (
                  materials.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title}
                    </option>
                  ))
                )}
              </select>

              <button
                onClick={handleSummarize}
                disabled={isSummarizing || !selectedMaterialId}
                className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold transition disabled:opacity-50 min-h-[40px] cursor-pointer shrink-0"
              >
                {isSummarizing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Summarizing...</span>
                  </>
                ) : (
                  <>
                    <BookOpen className="w-4 h-4" />
                    <span>Summarize</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {summaryData ? (
            <div className="space-y-4">
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-2">
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                  Executive Summary
                </span>
                <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
                  {summaryData.executiveSummary || summaryData.summary}
                </p>
              </div>

              {summaryData.keyPoints && summaryData.keyPoints.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Key Bullet Takeaways
                  </h4>
                  <ul className="space-y-1.5">
                    {summaryData.keyPoints.map((pt: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-2 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                        <span>{pt}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="p-8 sm:p-12 text-center text-slate-500 dark:text-slate-400">
              <BookOpen className="w-10 h-10 text-slate-400 dark:text-slate-600 mx-auto mb-2" />
              <p className="text-xs text-slate-500">
                Select a document from the dropdown above and click "Summarize" to generate key insights.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
