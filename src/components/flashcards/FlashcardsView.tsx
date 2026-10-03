import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useSubject } from '../../context/SubjectContext.tsx';
import {
  Layers,
  Sparkles,
  RotateCw,
  Plus,
  Trash2,
  CheckCircle,
  XCircle,
  AlertCircle,
  HelpCircle,
  ArrowLeft,
  ArrowRight,
  Search,
  Filter,
  Eye,
  BookOpen,
  CheckCircle2,
  Clock,
  Flame,
  Award,
  Edit3,
  Shuffle,
  BarChart2,
  ChevronRight,
  Check,
  RefreshCw,
} from 'lucide-react';
import { Flashcard, StudyMaterial } from '../../types/app.types.ts';
import { Modal } from '../common/Modal.tsx';
import { MarkdownRenderer } from '../common/MarkdownRenderer.tsx';

interface FlashcardsViewProps {
  initialMaterialId?: number;
  initialTopicFilter?: string;
}

export const FlashcardsView: React.FC<FlashcardsViewProps> = ({
  initialMaterialId,
  initialTopicFilter,
}) => {
  const { apiFetch } = useAuth();
  const { activeSubject, subjects } = useSubject();

  // Cards & Materials Data
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [materials, setMaterials] = useState<StudyMaterial[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<any | null>(null);

  // View Mode: 'study' (interactive card runner) | 'browse' (grid list of cards)
  const [viewMode, setViewMode] = useState<'study' | 'browse'>('study');

  // Study Runner State
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [sessionResults, setSessionResults] = useState<{
    knownCount: number;
    needsRevisionCount: number;
    history: Array<{ cardId: number; outcome: string }>;
  }>({ knownCount: 0, needsRevisionCount: 0, history: [] });
  const [isSessionComplete, setIsSessionComplete] = useState(false);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | ''>(
    activeSubject?.id || '',
  );
  const [selectedMaterialFilter, setSelectedMaterialFilter] = useState<number | ''>(
    initialMaterialId || '',
  );
  const [difficultyFilter, setDifficultyFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [topicFilter, setTopicFilter] = useState<string>(initialTopicFilter || '');

  // AI Generator Modal
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);
  const [genSubjectId, setGenSubjectId] = useState<number | ''>(
    activeSubject?.id || '',
  );
  const [genMaterialId, setGenMaterialId] = useState<number | ''>(
    initialMaterialId || '',
  );
  const [genTopicFocus, setGenTopicFocus] = useState('');
  const [generateCount, setGenerateCount] = useState(8);
  const [isGenerating, setIsGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  // Manual Create / Edit Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingCardId, setEditingCardId] = useState<number | null>(null);
  const [manualSubjectId, setManualSubjectId] = useState<number | ''>(
    activeSubject?.id || '',
  );
  const [manualMaterialId, setManualMaterialId] = useState<number | ''>('');
  const [manualFront, setManualFront] = useState('');
  const [manualBack, setManualBack] = useState('');
  const [manualTopic, setManualTopic] = useState('');
  const [manualDifficulty, setManualDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');

  // Delete confirmation modal
  const [cardToDelete, setCardToDelete] = useState<number | null>(null);

  // Sync active subject changes
  useEffect(() => {
    if (activeSubject && !selectedSubjectId) {
      setSelectedSubjectId(activeSubject.id);
      setGenSubjectId(activeSubject.id);
      setManualSubjectId(activeSubject.id);
    }
  }, [activeSubject]);

  // Load flashcards and stats
  const loadCards = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedSubjectId) params.append('subjectId', String(selectedSubjectId));
      if (selectedMaterialFilter) params.append('materialId', String(selectedMaterialFilter));

      const [cardsRes, statsRes] = await Promise.all([
        apiFetch(`/api/flashcards?${params.toString()}`),
        apiFetch(`/api/flashcards/stats${selectedSubjectId ? `?subjectId=${selectedSubjectId}` : ''}`),
      ]);

      if (cardsRes.ok) {
        const raw = await cardsRes.json();
        const list: Flashcard[] = Array.isArray(raw?.data) ? raw.data : Array.isArray(raw) ? raw : [];
        setFlashcards(list);
        setCurrentCardIndex(0);
        setIsFlipped(false);
        setIsSessionComplete(false);
      }

      if (statsRes.ok) {
        const statsData = (await statsRes.json())?.data;
        setStats(statsData);
      }
    } catch (e) {
      console.error('Error loading flashcards:', e);
    } finally {
      setLoading(false);
    }
  }, [apiFetch, selectedSubjectId, selectedMaterialFilter]);

  // Load materials for the selected subject
  const loadMaterials = useCallback(async () => {
    try {
      const url = selectedSubjectId
        ? `/api/materials?subjectId=${selectedSubjectId}`
        : '/api/materials';
      const res = await apiFetch(url);
      if (res.ok) {
        const raw = await res.json();
        const list: StudyMaterial[] = Array.isArray(raw?.data) ? raw.data : Array.isArray(raw) ? raw : [];
        setMaterials(list);
        if (list.length > 0 && !genMaterialId) {
          setGenMaterialId(list[0].id);
        }
      }
    } catch (e) {
      console.error('Error loading materials:', e);
    }
  }, [apiFetch, selectedSubjectId]);

  useEffect(() => {
    loadCards();
    loadMaterials();
  }, [loadCards, loadMaterials]);

  // Filter cards based on user selections
  const filteredCards = flashcards.filter((card) => {
    if (topicFilter && card.topicTag?.toLowerCase() !== topicFilter.toLowerCase()) {
      return false;
    }
    if (difficultyFilter !== 'all' && card.difficultyLevel !== difficultyFilter) {
      return false;
    }
    if (statusFilter !== 'all' && card.status !== statusFilter) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchFront = card.frontText.toLowerCase().includes(q);
      const matchBack = card.backText.toLowerCase().includes(q);
      const matchTopic = card.topicTag?.toLowerCase().includes(q);
      if (!matchFront && !matchBack && !matchTopic) return false;
    }
    return true;
  });

  const currentCard = filteredCards[currentCardIndex];

  // Unique topic list for filtering
  const uniqueTopics = Array.from(
    new Set(flashcards.map((c) => c.topicTag).filter(Boolean)),
  ) as string[];

  // Restart Study Session
  const restartStudySession = (onlyNeedsRevision = false) => {
    if (onlyNeedsRevision) {
      setStatusFilter('needs_revision');
    } else {
      setStatusFilter('all');
    }
    setCurrentCardIndex(0);
    setIsFlipped(false);
    setIsSessionComplete(false);
    setSessionResults({ knownCount: 0, needsRevisionCount: 0, history: [] });
  };

  // Review Action
  const handleReviewAction = async (outcome: 'known' | 'needs_revision' | 'again' | 'hard' | 'good' | 'easy') => {
    if (!currentCard) return;

    const isKnownOutcome = outcome === 'known' || outcome === 'good' || outcome === 'easy';

    setSessionResults((prev) => ({
      knownCount: prev.knownCount + (isKnownOutcome ? 1 : 0),
      needsRevisionCount: prev.needsRevisionCount + (isKnownOutcome ? 0 : 1),
      history: [...prev.history, { cardId: currentCard.id, outcome }],
    }));

    try {
      await apiFetch(`/api/flashcards/${currentCard.id}/review`, {
        method: 'PATCH',
        body: JSON.stringify({
          outcome,
          isKnown: isKnownOutcome,
        }),
      });
    } catch (e) {
      console.error('Failed to submit review for card:', e);
    }

    setIsFlipped(false);
    if (currentCardIndex < filteredCards.length - 1) {
      setCurrentCardIndex((i) => i + 1);
    } else {
      setIsSessionComplete(true);
    }
  };

  // Quick mark directly from browse mode grid
  const handleQuickMark = async (cardId: number, isKnown: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    const outcome = isKnown ? 'known' : 'needs_revision';

    setFlashcards((prev) =>
      prev.map((c) => {
        if (c.id === cardId) {
          return {
            ...c,
            status: isKnown ? 'known' : 'needs_revision',
            reviewCount: (c.reviewCount || 0) + 1,
            lastReviewedAt: new Date().toISOString(),
          };
        }
        return c;
      }),
    );

    try {
      await apiFetch(`/api/flashcards/${cardId}/review`, {
        method: 'PATCH',
        body: JSON.stringify({ outcome, isKnown }),
      });
    } catch (err) {
      console.error('Failed to toggle card status:', err);
    }
  };

  // Keyboard Shortcuts for Study Mode
  useEffect(() => {
    if (viewMode !== 'study' || isSessionComplete || !currentCard) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        setIsFlipped((f) => !f);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (currentCardIndex < filteredCards.length - 1) {
          setIsFlipped(false);
          setCurrentCardIndex((i) => i + 1);
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (currentCardIndex > 0) {
          setIsFlipped(false);
          setCurrentCardIndex((i) => i - 1);
        }
      } else if (e.key === '1') {
        e.preventDefault();
        handleReviewAction('needs_revision');
      } else if (e.key === '2') {
        e.preventDefault();
        handleReviewAction('hard');
      } else if (e.key === '3') {
        e.preventDefault();
        handleReviewAction('good');
      } else if (e.key === '4') {
        e.preventDefault();
        handleReviewAction('known');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewMode, isSessionComplete, currentCard, currentCardIndex, filteredCards.length]);

  const handleGenerateDeck = async (e: React.FormEvent) => {
    e.preventDefault();
    const subjId = genSubjectId || selectedSubjectId;
    if (!subjId) {
      setGenError('Please select a subject');
      return;
    }

    try {
      setIsGenerating(true);
      setGenError(null);

      const res = await apiFetch('/api/flashcards/generate', {
        method: 'POST',
        body: JSON.stringify({
          subjectId: Number(subjId),
          materialId: genMaterialId ? Number(genMaterialId) : undefined,
          count: generateCount,
          topicFocus: genTopicFocus.trim() || undefined,
        }),
      });

      if (res.ok) {
        setIsGenerateOpen(false);
        setGenTopicFocus('');
        await loadCards();
        setViewMode('study');
      } else {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || 'Failed to generate flashcards');
      }
    } catch (err: any) {
      console.error('Error generating flashcard deck:', err);
      setGenError(err.message || 'Error communicating with AI service');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveCard = async (e: React.FormEvent) => {
    e.preventDefault();
    const subjId = manualSubjectId || selectedSubjectId;
    if (!subjId || !manualFront.trim() || !manualBack.trim()) return;

    try {
      if (editingCardId) {
        const res = await apiFetch(`/api/flashcards/${editingCardId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            frontText: manualFront.trim(),
            backText: manualBack.trim(),
            topicTag: manualTopic.trim() || 'General',
            difficultyLevel: manualDifficulty,
          }),
        });
        if (res.ok) {
          setIsCreateOpen(false);
          setEditingCardId(null);
          await loadCards();
        }
      } else {
        const res = await apiFetch('/api/flashcards', {
          method: 'POST',
          body: JSON.stringify({
            subjectId: Number(subjId),
            materialId: manualMaterialId ? Number(manualMaterialId) : undefined,
            frontText: manualFront.trim(),
            backText: manualBack.trim(),
            topicTag: manualTopic.trim() || 'General',
            difficultyLevel: manualDifficulty,
            status: 'new',
          }),
        });
        if (res.ok) {
          setIsCreateOpen(false);
          setManualFront('');
          setManualBack('');
          setManualTopic('');
          await loadCards();
        }
      }
    } catch (err) {
      console.error('Error saving flashcard:', err);
    }
  };

  const openEditModal = (card: Flashcard, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingCardId(card.id);
    setManualSubjectId(card.subjectId);
    setManualMaterialId(card.materialId || '');
    setManualFront(card.frontText);
    setManualBack(card.backText);
    setManualTopic(card.topicTag || '');
    setManualDifficulty((card.difficultyLevel as any) || 'medium');
    setIsCreateOpen(true);
  };

  const handleDeleteCard = async (id: number) => {
    try {
      const res = await apiFetch(`/api/flashcards/${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setFlashcards((prev) => prev.filter((c) => c.id !== id));
        setCardToDelete(null);
        if (currentCardIndex >= filteredCards.length - 1) {
          setCurrentCardIndex((i) => Math.max(0, i - 1));
        }
      }
    } catch (err) {
      console.error('Error deleting flashcard:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Layers className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            Spaced Repetition Flashcards
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
            Active recall powered by Leitner 5-box intervals and AI question synthesis.
          </p>
        </div>

        {/* Action buttons & mode switcher */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center p-1 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setViewMode('study')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                viewMode === 'study'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Study Deck</span>
            </button>
            <button
              onClick={() => setViewMode('browse')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                viewMode === 'browse'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Deck Cards ({filteredCards.length})</span>
            </button>
          </div>

          <button
            onClick={() => {
              setEditingCardId(null);
              setManualFront('');
              setManualBack('');
              setManualTopic('');
              setManualDifficulty('medium');
              setIsCreateOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold border border-slate-200 dark:border-slate-700 transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Card</span>
          </button>

          <button
            onClick={() => setIsGenerateOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition shadow-md shadow-emerald-600/20 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Generate</span>
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* STATS TILES BAR */}
      {/* ------------------------------------------------------------------- */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-2xl bg-surface border border-border flex items-center gap-3 shadow-xs">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/20">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <div className="text-lg font-bold text-slate-900 dark:text-white">{stats.totalCards || flashcards.length}</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">Total Cards</div>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-surface border border-border flex items-center gap-3 shadow-xs">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{stats.knownCount || 0}</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">Known / Mastered</div>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-surface border border-border flex items-center gap-3 shadow-xs">
            <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 border border-rose-500/20">
              <RefreshCw className="w-4 h-4" />
            </div>
            <div>
              <div className="text-lg font-bold text-rose-600 dark:text-rose-400">{stats.needsRevisionCount || 0}</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">Needs Revision</div>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-surface border border-border flex items-center gap-3 shadow-xs">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/20">
              <Award className="w-4 h-4" />
            </div>
            <div>
              <div className="text-lg font-bold text-amber-600 dark:text-amber-300">
                {stats.totalReviews > 0 ? `${stats.masteryRate}%` : '0%'}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">Accuracy Rate</div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* FILTER & CONTEXT BAR */}
      {/* ------------------------------------------------------------------- */}
      <div className="p-4 rounded-2xl bg-surface border border-border flex flex-wrap items-center justify-between gap-3 text-xs shadow-xs">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Subject Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-600 dark:text-slate-400 font-medium">Subject:</span>
            <select
              value={selectedSubjectId}
              onChange={(e) => {
                const val = e.target.value ? Number(e.target.value) : '';
                setSelectedSubjectId(val);
                setSelectedMaterialFilter('');
              }}
              className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:border-emerald-500 cursor-pointer"
            >
              <option value="">All Subjects</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Material Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-600 dark:text-slate-400 font-medium">Material:</span>
            <select
              value={selectedMaterialFilter}
              onChange={(e) => setSelectedMaterialFilter(e.target.value ? Number(e.target.value) : '')}
              className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:border-emerald-500 cursor-pointer max-w-[180px] truncate"
            >
              <option value="">All Material Notes</option>
              {materials.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title}
                </option>
              ))}
            </select>
          </div>

          {/* Difficulty Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-600 dark:text-slate-400 font-medium">Difficulty:</span>
            <select
              value={difficultyFilter}
              onChange={(e) => setDifficultyFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:border-emerald-500 cursor-pointer"
            >
              <option value="all">All Difficulties</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-600 dark:text-slate-400 font-medium">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:border-emerald-500 cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="needs_revision">Needs Revision</option>
              <option value="known">Known</option>
              <option value="new">New (Unreviewed)</option>
            </select>
          </div>
        </div>

        {/* Search Input for Browse Mode */}
        {viewMode === 'browse' && (
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search concepts, answers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-hidden focus:border-emerald-500 text-xs"
            />
          </div>
        )}
      </div>

      {/* Topic Tag Quick Filter Pills */}
      {uniqueTopics.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none text-xs">
          <span className="text-slate-500 font-medium shrink-0">Topics:</span>
          <button
            onClick={() => {
              setTopicFilter('');
              setCurrentCardIndex(0);
              setIsFlipped(false);
            }}
            className={`px-3 py-1 rounded-xl font-semibold transition shrink-0 cursor-pointer ${
              topicFilter === ''
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-100 dark:bg-slate-800/90 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700'
            }`}
          >
            All ({flashcards.length})
          </button>
          {uniqueTopics.map((top) => (
            <button
              key={top}
              onClick={() => {
                setTopicFilter(top);
                setCurrentCardIndex(0);
                setIsFlipped(false);
              }}
              className={`px-3 py-1 rounded-xl font-medium transition shrink-0 cursor-pointer ${
                topicFilter === top
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800/90 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700'
              }`}
            >
              {top}
            </button>
          ))}
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* VIEW MODE 1: INTERACTIVE STUDY RUNNER (3D Active Recall) */}
      {/* ------------------------------------------------------------------- */}
      {viewMode === 'study' && (
        <>
          {loading ? (
            <div className="py-20 text-center space-y-3">
              <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-slate-500 dark:text-slate-400">Loading flashcards deck...</p>
            </div>
          ) : isSessionComplete ? (
            /* SESSION COMPLETE SUMMARY */
            <div className="max-w-xl mx-auto p-8 rounded-3xl bg-surface border border-border text-center space-y-6 shadow-xl">
              <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
                <Award className="w-8 h-8" />
              </div>

              <div className="space-y-2">
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Study Session Complete!</h3>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                  You reviewed {sessionResults.history.length} flashcards in this active recall round.
                </p>
              </div>

              {/* Score Breakdown */}
              <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <div className="text-center p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20">
                  <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{sessionResults.knownCount}</div>
                  <div className="text-xs text-emerald-700 dark:text-emerald-300 font-medium mt-0.5">Marked as Known (✓)</div>
                </div>
                <div className="text-center p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20">
                  <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">{sessionResults.needsRevisionCount}</div>
                  <div className="text-xs text-rose-700 dark:text-rose-300 font-medium mt-0.5">Needs Revision (↻)</div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <button
                  onClick={() => restartStudySession(false)}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Restart Full Deck</span>
                </button>

                {sessionResults.needsRevisionCount > 0 && (
                  <button
                    onClick={() => restartStudySession(true)}
                    className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-rose-50 dark:bg-rose-600/20 hover:bg-rose-100 dark:hover:bg-rose-600/30 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-500/30 text-xs font-semibold transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Practice {sessionResults.needsRevisionCount} Revision Cards</span>
                  </button>
                )}

                <button
                  onClick={() => setViewMode('browse')}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition cursor-pointer"
                >
                  View Deck Cards
                </button>
              </div>
            </div>
          ) : filteredCards.length > 0 && currentCard ? (
            /* ACTIVE 3D FLASHCARD RUNNER */
            <div className="max-w-2xl mx-auto space-y-5">
              {/* Progress & Metadata */}
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-900 dark:text-white">
                    Card {currentCardIndex + 1}
                  </span>
                  <span className="text-slate-400 dark:text-slate-500">/ {filteredCards.length}</span>
                </div>

                <div className="flex items-center gap-2">
                  {/* Difficulty Pill */}
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                      currentCard.difficultyLevel === 'easy'
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                        : currentCard.difficultyLevel === 'hard'
                        ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                        : 'bg-amber-500/10 text-amber-600 dark:text-amber-300 border-amber-500/20'
                    }`}
                  >
                    {currentCard.difficultyLevel || 'medium'}
                  </span>

                  {/* Leitner Box Pill */}
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 text-[10px]">
                    Box {currentCard.repetitionBox || 1} / 5
                  </span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300"
                  style={{
                    width: `${((currentCardIndex + 1) / filteredCards.length) * 100}%`,
                  }}
                />
              </div>

              {/* 3D INTERACTIVE CARD WITH PHYSICAL PERSPECTIVE FLIP */}
              <div className="w-full min-h-[330px] sm:min-h-[370px] perspective-1200 select-none">
                <div
                  onClick={() => setIsFlipped(!isFlipped)}
                  role="button"
                  tabIndex={0}
                  className={`w-full min-h-[330px] sm:min-h-[370px] preserve-3d transition-transform duration-500 ease-out cursor-pointer relative focus:outline-hidden ${
                    isFlipped ? 'rotate-y-180' : ''
                  }`}
                >
                  {/* FRONT FACE (Question / Prompt) */}
                  <div className="absolute inset-0 w-full h-full rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-700 bg-gradient-to-br from-white via-slate-50 to-slate-100 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 text-center flex flex-col justify-between shadow-xl backface-hidden">
                    {/* Top metadata */}
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-foreground px-2.5 py-1 rounded-xl bg-surface border border-border shadow-xs">
                        {currentCard.topicTag || 'Core Concept'}
                      </span>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsFlipped(true);
                        }}
                        className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-indigo-50 dark:hover:bg-slate-800/60 transition cursor-pointer"
                      >
                        <RotateCw className="w-3.5 h-3.5" />
                        <span>Flip for Answer (Space)</span>
                      </button>
                    </div>

                    {/* Main Content (Front) */}
                    <div className="my-auto py-6 px-2 sm:px-6">
                      <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block mb-3">
                        Concept / Question
                      </span>
                      <div className="text-base sm:text-xl font-bold text-slate-900 dark:text-white leading-relaxed font-sans">
                        <MarkdownRenderer content={currentCard.frontText} />
                      </div>
                    </div>

                    {/* Card Footer Hint */}
                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-800/60">
                      <span>
                        {currentCard.reviewCount
                          ? `Reviewed ${currentCard.reviewCount} time${currentCard.reviewCount > 1 ? 's' : ''}`
                          : 'New card (unreviewed)'}
                      </span>
                      <span>Click card or press Space to reveal answer</span>
                    </div>
                  </div>

                  {/* BACK FACE (Answer / Solution) */}
                  <div className="absolute inset-0 w-full h-full rounded-3xl p-6 sm:p-8 border border-indigo-400 dark:border-indigo-500/60 bg-gradient-to-br from-indigo-50/90 via-white to-indigo-50/70 dark:from-slate-900 dark:via-indigo-950/70 dark:to-slate-900 text-center flex flex-col justify-between shadow-xl backface-hidden rotate-y-180">
                    {/* Top metadata */}
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-foreground px-2.5 py-1 rounded-xl bg-surface border border-border shadow-xs">
                        {currentCard.topicTag || 'Core Concept'}
                      </span>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsFlipped(false);
                        }}
                        className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-indigo-50 dark:hover:bg-slate-800/60 transition cursor-pointer"
                      >
                        <RotateCw className="w-3.5 h-3.5" />
                        <span>Show Question</span>
                      </button>
                    </div>

                    {/* Main Content (Back) */}
                    <div className="my-auto py-6 px-2 sm:px-6">
                      <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest block mb-3">
                        Answer & Academic Rationale
                      </span>
                      <div className="text-base sm:text-xl font-bold text-slate-900 dark:text-white leading-relaxed font-sans">
                        <MarkdownRenderer content={currentCard.backText} />
                      </div>
                    </div>

                    {/* Card Footer Hint */}
                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-800/60">
                      <span>{currentCard.difficultyLevel?.toUpperCase() || 'MEDIUM'} DIFFICULTY</span>
                      <span>Rate your recall below</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* ----------------------------------------------------------- */}
              {/* ACTIVE RECALL RATING CONTROLS */}
              {/* ----------------------------------------------------------- */}
              <div className="space-y-3">
                {/* Primary Dual Actions: Needs Revision (1) vs Known (4) */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handleReviewAction('needs_revision')}
                    className="py-3 px-4 rounded-2xl bg-rose-50 dark:bg-rose-500/15 hover:bg-rose-100 dark:hover:bg-rose-500/25 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-500/30 text-xs font-bold transition flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                  >
                    <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                    <span>Needs Revision</span>
                    <kbd className="px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-500/30 font-mono text-[10px]">1</kbd>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleReviewAction('known')}
                    className="py-3 px-4 rounded-2xl bg-emerald-50 dark:bg-emerald-500/15 hover:bg-emerald-100 dark:hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30 text-xs font-bold transition flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                  >
                    <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Mark Known</span>
                    <kbd className="px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-500/30 font-mono text-[10px]">4</kbd>
                  </button>
                </div>

                {/* Granular Spaced Repetition (Again, Hard, Good, Easy) */}
                <div className="grid grid-cols-4 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleReviewAction('again')}
                    className="py-2 rounded-xl bg-surface hover:bg-surface-elevated text-foreground border border-border text-[11px] font-semibold transition text-center cursor-pointer shadow-xs"
                    title="Reset to Leitner Box 1"
                  >
                    <div className="text-rose-600 dark:text-rose-400 font-bold">Again</div>
                    <div className="text-[9px] text-muted">Box 1</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleReviewAction('hard')}
                    className="py-2 rounded-xl bg-surface hover:bg-surface-elevated text-foreground border border-border text-[11px] font-semibold transition text-center cursor-pointer shadow-xs"
                    title="Keep in current box (Hot key: 2)"
                  >
                    <div className="text-amber-600 dark:text-amber-400 font-bold">Hard</div>
                    <div className="text-[9px] text-muted">Repeat</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleReviewAction('good')}
                    className="py-2 rounded-xl bg-surface hover:bg-surface-elevated text-foreground border border-border text-[11px] font-semibold transition text-center cursor-pointer shadow-xs"
                    title="Advance 1 box (Hot key: 3)"
                  >
                    <div className="text-indigo-600 dark:text-indigo-400 font-bold">Good</div>
                    <div className="text-[9px] text-muted">+1 Box</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleReviewAction('easy')}
                    className="py-2 rounded-xl bg-surface hover:bg-surface-elevated text-foreground border border-border text-[11px] font-semibold transition text-center cursor-pointer shadow-xs"
                    title="Advance 2 boxes (Hot key: 4)"
                  >
                    <div className="text-emerald-600 dark:text-emerald-400 font-bold">Easy</div>
                    <div className="text-[9px] text-muted">+2 Boxes</div>
                  </button>
                </div>
              </div>

              {/* Prev / Next Manual Navigation */}
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-2 px-1">
                <button
                  disabled={currentCardIndex === 0}
                  onClick={() => {
                    setIsFlipped(false);
                    setCurrentCardIndex((i) => Math.max(0, i - 1));
                  }}
                  className="flex items-center gap-1 hover:text-slate-900 dark:hover:text-white disabled:opacity-30 transition cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Previous Card (←)
                </button>

                <button
                  onClick={(e) => openEditModal(currentCard, e)}
                  className="flex items-center gap-1 hover:text-indigo-600 dark:hover:text-indigo-300 transition text-slate-500 dark:text-slate-400 cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" /> Edit Card
                </button>

                <button
                  disabled={currentCardIndex === filteredCards.length - 1}
                  onClick={() => {
                    setIsFlipped(false);
                    setCurrentCardIndex((i) => Math.min(filteredCards.length - 1, i + 1));
                  }}
                  className="flex items-center gap-1 hover:text-slate-900 dark:hover:text-white disabled:opacity-30 transition cursor-pointer"
                >
                  Next Card (→) <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            /* EMPTY STATE */
            <div className="p-12 rounded-3xl bg-surface border border-border text-center max-w-lg mx-auto space-y-4 shadow-xs">
              <Layers className="w-12 h-12 text-slate-400 dark:text-slate-700 mx-auto" />
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">No Flashcards in Selected Deck</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                  Synthesize non-redundant flashcards from your uploaded study materials using Gemini AI.
                </p>
              </div>
              <div className="flex items-center justify-center gap-2 pt-2">
                <button
                  onClick={() => setIsGenerateOpen(true)}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition cursor-pointer"
                >
                  AI Generate Cards
                </button>
                <button
                  onClick={() => setIsCreateOpen(true)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition cursor-pointer"
                >
                  Create Manually
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* VIEW MODE 2: BROWSE & ORGANIZE CARDS GRID */}
      {/* ------------------------------------------------------------------- */}
      {viewMode === 'browse' && (
        <div className="space-y-4">
          {filteredCards.length === 0 ? (
            <div className="p-12 rounded-3xl bg-surface border border-border text-center text-slate-500 shadow-xs">
              <Layers className="w-12 h-12 mx-auto mb-2 text-slate-400 dark:text-slate-700" />
              <p className="text-sm font-medium text-slate-700 dark:text-slate-400">No matching flashcards found</p>
              <p className="text-xs text-slate-500 mt-1">Try adjusting your filters or search query.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCards.map((card) => {
                const isKnown = card.status === 'known' || card.status === 'mastered';
                const isNeedsRevision = card.status === 'needs_revision';

                return (
                  <div
                    key={card.id}
                    className="p-5 rounded-3xl bg-surface border border-border hover:border-slate-300 dark:hover:border-slate-700 transition flex flex-col justify-between space-y-4 shadow-xs group"
                  >
                    {/* Card Header & Status Badges */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-bold uppercase text-slate-700 dark:text-slate-300">
                          {card.topicTag || 'Core Concept'}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase border ${
                            card.difficultyLevel === 'easy'
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                              : card.difficultyLevel === 'hard'
                              ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                              : 'bg-amber-500/10 text-amber-600 dark:text-amber-300 border-amber-500/20'
                          }`}
                        >
                          {card.difficultyLevel || 'medium'}
                        </span>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => openEditModal(card, e)}
                          title="Edit card"
                          className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition rounded cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setCardToDelete(card.id);
                          }}
                          title="Delete card"
                          className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition rounded cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Question (Front) */}
                    <div className="space-y-1">
                      <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Question / Front
                      </div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white leading-snug line-clamp-3">
                        {card.frontText}
                      </p>
                    </div>

                    {/* Answer (Back Preview) */}
                    <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800/80 text-xs text-slate-700 dark:text-slate-300 space-y-1">
                      <div className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                        Answer / Back
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-4">
                        {card.backText}
                      </p>
                    </div>

                    {/* Footer Controls: Quick Mark Known/Needs Revision & Leitner Box */}
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-1 text-slate-500 text-[10px]">
                        <span>Box {card.repetitionBox || 1}</span>
                        {card.reviewCount !== undefined && card.reviewCount > 0 && (
                          <span>• {card.reviewCount} revs</span>
                        )}
                      </div>

                      {/* Quick Mastery Toggle */}
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => handleQuickMark(card.id, false, e)}
                          title="Mark Needs Revision"
                          className={`p-1.5 rounded-lg border text-xs transition cursor-pointer ${
                            isNeedsRevision
                              ? 'bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-500/40 font-bold'
                              : 'bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-300 border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          <XCircle className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={(e) => handleQuickMark(card.id, true, e)}
                          title="Mark Known"
                          className={`p-1.5 rounded-lg border text-xs transition cursor-pointer ${
                            isKnown
                              ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/40 font-bold'
                              : 'bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-300 border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* MODAL 1: AI FLASHCARD GENERATOR */}
      {/* ------------------------------------------------------------------- */}
      <Modal
        isOpen={isGenerateOpen}
        onClose={() => setIsGenerateOpen(false)}
        title="Synthesize AI Flashcards"
      >
        <form onSubmit={handleGenerateDeck} className="space-y-4">
          {genError && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-600 dark:text-red-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{genError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              Subject *
            </label>
            <select
              required
              value={genSubjectId}
              onChange={(e) => {
                const val = Number(e.target.value);
                setGenSubjectId(val);
              }}
              className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white text-sm focus:outline-hidden focus:border-emerald-500 cursor-pointer"
            >
              <option value="">Select a subject...</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              Source Study Material Note (Optional)
            </label>
            <select
              value={genMaterialId}
              onChange={(e) => setGenMaterialId(e.target.value ? Number(e.target.value) : '')}
              className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white text-sm focus:outline-hidden focus:border-emerald-500 cursor-pointer"
            >
              <option value="">All Subject Notes (Holistic Deck)</option>
              {materials.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              Specific Concept / Topic Focus (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Virtual Memory Translation, Dijkstra Proofs"
              value={genTopicFocus}
              onChange={(e) => setGenTopicFocus(e.target.value)}
              className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white text-sm placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-hidden focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              Deck Size (High-Yield Atomic Cards)
            </label>
            <select
              value={generateCount}
              onChange={(e) => setGenerateCount(Number(e.target.value))}
              className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white text-sm focus:outline-hidden focus:border-emerald-500 cursor-pointer"
            >
              <option value={5}>5 Cards (Essential High-Yield Core)</option>
              <option value={8}>8 Cards (Standard Balanced Deck)</option>
              <option value={12}>12 Cards (Comprehensive Review)</option>
              <option value={16}>16 Cards (Exam Prep Sprint)</option>
            </select>
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsGenerateOpen(false)}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-xs sm:text-sm font-medium min-h-[42px] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isGenerating || !genSubjectId}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold transition disabled:opacity-50 min-h-[44px] shadow-md shadow-emerald-600/20 cursor-pointer"
            >
              {isGenerating ? (
                <>
                  <Sparkles className="w-3.5 h-3.5 animate-spin" />
                  <span>Synthesizing Non-Redundant Cards...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Generate AI Deck</span>
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* ------------------------------------------------------------------- */}
      {/* MODAL 2: CREATE / EDIT MANUAL CARD */}
      {/* ------------------------------------------------------------------- */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => {
          setIsCreateOpen(false);
          setEditingCardId(null);
        }}
        title={editingCardId ? 'Edit Flashcard' : 'Create Custom Flashcard'}
      >
        <form onSubmit={handleSaveCard} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              Subject *
            </label>
            <select
              required
              value={manualSubjectId}
              onChange={(e) => setManualSubjectId(Number(e.target.value))}
              className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white text-sm focus:outline-hidden focus:border-emerald-500 cursor-pointer"
            >
              <option value="">Select a subject...</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              Front: Question / Concept / Definition Prompt *
            </label>
            <textarea
              required
              rows={2}
              placeholder="e.g. State the time complexity of QuickSelect in the average vs worst case."
              value={manualFront}
              onChange={(e) => setManualFront(e.target.value)}
              className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-slate-900 dark:text-white text-sm placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-hidden focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              Back: Answer / Explanation / Formula *
            </label>
            <textarea
              required
              rows={3}
              placeholder="e.g. Average: O(N), Worst-case: O(N^2) when poor pivots are chosen."
              value={manualBack}
              onChange={(e) => setManualBack(e.target.value)}
              className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-slate-900 dark:text-white text-sm placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-hidden focus:border-emerald-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                Topic Tag
              </label>
              <input
                type="text"
                placeholder="e.g. Sorting & Selection"
                value={manualTopic}
                onChange={(e) => setManualTopic(e.target.value)}
                className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white text-xs sm:text-sm placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-hidden focus:border-emerald-500 min-h-[42px]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                Difficulty
              </label>
              <select
                value={manualDifficulty}
                onChange={(e) => setManualDifficulty(e.target.value as any)}
                className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white text-xs sm:text-sm focus:outline-hidden focus:border-emerald-500 min-h-[42px] cursor-pointer"
              >
                <option value="easy">Easy (Definitions)</option>
                <option value="medium">Medium (Standard Mechanics)</option>
                <option value="hard">Hard (Tradeoffs & Edge Cases)</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => {
                setIsCreateOpen(false);
                setEditingCardId(null);
              }}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-xs sm:text-sm font-medium min-h-[42px] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold transition min-h-[44px] shadow-md shadow-emerald-600/20 cursor-pointer"
            >
              {editingCardId ? 'Update Card' : 'Save Flashcard'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ------------------------------------------------------------------- */}
      {/* MODAL 3: DELETE CONFIRMATION */}
      {/* ------------------------------------------------------------------- */}
      <Modal
        isOpen={cardToDelete !== null}
        onClose={() => setCardToDelete(null)}
        title="Delete Flashcard"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-700 dark:text-slate-300">
            Are you sure you want to permanently delete this flashcard from your study deck?
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setCardToDelete(null)}
              className="px-4 py-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => cardToDelete && handleDeleteCard(cardToDelete)}
              className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition cursor-pointer"
            >
              Delete Card
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
