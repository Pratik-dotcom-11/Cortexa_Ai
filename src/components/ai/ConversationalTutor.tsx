import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useSubject } from '../../context/SubjectContext.tsx';
import { MarkdownRenderer } from '../common/MarkdownRenderer.tsx';
import {
  StudyMaterial,
  ChatMode,
  ConversationSummary,
  ConversationMessage,
} from '../../types/app.types.ts';
import {
  Brain,
  Sparkles,
  Send,
  Plus,
  Trash2,
  Edit2,
  Check,
  Copy,
  RotateCcw,
  ThumbsUp,
  ThumbsDown,
  Code2,
  Calculator,
  Lightbulb,
  PenTool,
  BookOpen,
  Search,
  Menu,
  X,
  ChevronDown,
  Paperclip,
  Zap,
  Square,
  Compass,
  ArrowRight,
  Layers,
  HelpCircle,
  Clock,
  CheckCircle2,
} from 'lucide-react';

interface ConversationalTutorProps {
  initialSubjectId?: number;
  initialMaterialId?: number;
  initialPrompt?: string;
  onNavigate?: (tab: string, meta?: any) => void;
}

interface ModeMeta {
  id: ChatMode;
  name: string;
  badge: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgLight: string;
}

const MODES: ModeMeta[] = [
  {
    id: 'auto',
    name: 'Auto',
    badge: 'Intent AI',
    description: 'Automatically detects intent (Code, Math, Study, Writing, etc.)',
    icon: Zap,
    color: 'text-indigo-600 dark:text-indigo-400',
    bgLight: 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800/60',
  },
  {
    id: 'study',
    name: 'Study',
    badge: 'Academic',
    description: 'Structured explanations, exam points, quizzes & flashcard tie-ins',
    icon: BookOpen,
    color: 'text-blue-600 dark:text-blue-400',
    bgLight: 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800/60',
  },
  {
    id: 'coding',
    name: 'Coding',
    badge: 'Dev & Syntax',
    description: 'Clean code, debugging, architecture & syntax highlighting',
    icon: Code2,
    color: 'text-emerald-600 dark:text-emerald-400',
    bgLight: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60',
  },
  {
    id: 'explain',
    name: 'Explain',
    badge: 'Concepts',
    description: 'Deep understanding, real-world analogies, beginner to expert',
    icon: Lightbulb,
    color: 'text-amber-600 dark:text-amber-400',
    bgLight: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/60',
  },
  {
    id: 'solve',
    name: 'Solve',
    badge: 'Step-by-Step',
    description: 'Given, formulas, intermediate calculations & final units',
    icon: Calculator,
    color: 'text-purple-600 dark:text-purple-400',
    bgLight: 'bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800/60',
  },
  {
    id: 'writing',
    name: 'Writing',
    badge: 'Editorial',
    description: 'Grammar, professional rewriting, reports & essays',
    icon: PenTool,
    color: 'text-rose-600 dark:text-rose-400',
    bgLight: 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/60',
  },
  {
    id: 'brainstorm',
    name: 'Brainstorm',
    badge: 'Ideation',
    description: 'Structured project ideas, hackathon concepts & MVP architectures',
    icon: Sparkles,
    color: 'text-cyan-600 dark:text-cyan-400',
    bgLight: 'bg-cyan-50 dark:bg-cyan-950/40 border-cyan-200 dark:border-cyan-800/60',
  },
  {
    id: 'general',
    name: 'General',
    badge: 'Everyday',
    description: 'Natural answers for technology, science & broad questions',
    icon: Compass,
    color: 'text-slate-600 dark:text-slate-400',
    bgLight: 'bg-slate-100 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700',
  },
];

const STARTER_PROMPTS = [
  {
    title: 'Explain Recursion',
    subtitle: 'Intuitive mental model & call stack analogy',
    mode: 'explain' as ChatMode,
    prompt: 'Explain recursion simply using a real-world analogy and show how the base case works.',
    icon: Lightbulb,
    color: 'text-amber-500',
  },
  {
    title: 'Debug Python Code',
    subtitle: 'Analyze bugs and fix edge cases',
    mode: 'coding' as ChatMode,
    prompt: 'Write a Python program to reverse words in a string and explain edge cases.',
    icon: Code2,
    color: 'text-emerald-500',
  },
  {
    title: 'Solve Calculus Problem',
    subtitle: 'Step-by-step mathematical derivation',
    mode: 'solve' as ChatMode,
    prompt: 'Solve this step-by-step: Find the derivative of f(x) = x^3 - 4x^2 + 7x - 5 and find its critical points.',
    icon: Calculator,
    color: 'text-purple-500',
  },
  {
    title: 'Hackathon Project Ideas',
    subtitle: 'High-impact AI & web application concepts',
    mode: 'brainstorm' as ChatMode,
    prompt: 'Give me 3 innovative AI hackathon project ideas with problem, solution, tech stack, and difficulty rating.',
    icon: Sparkles,
    color: 'text-cyan-500',
  },
  {
    title: 'Rewrite Professionally',
    subtitle: 'Grammar, tone and conciseness',
    mode: 'writing' as ChatMode,
    prompt: 'Rewrite this paragraph to make it professional, engaging, and concise: "I am writing this email because I want to ask if we can maybe move the deadline for our project by like two days because we had some issues with the database."',
    icon: PenTool,
    color: 'text-rose-500',
  },
  {
    title: 'Quiz Me on Newton’s Laws',
    subtitle: 'Active recall & exam preparation',
    mode: 'study' as ChatMode,
    prompt: 'Explain Newton’s three laws of motion briefly, and then give me a multiple-choice practice question to test my understanding.',
    icon: BookOpen,
    color: 'text-blue-500',
  },
];

export const ConversationalTutor: React.FC<ConversationalTutorProps> = ({
  initialSubjectId,
  initialMaterialId,
  initialPrompt,
  onNavigate,
}) => {
  const { apiFetch } = useAuth();
  const { subjects, activeSubject } = useSubject();

  // Sidebar & Threads State
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
  const [activeConversation, setActiveConversation] = useState<any | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [searchFilter, setSearchFilter] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoadingThreads, setIsLoadingThreads] = useState(false);

  // Thread Renaming
  const [editingConvId, setEditingConvId] = useState<number | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  // Active Chat Mode & Context
  const [selectedMode, setSelectedMode] = useState<ChatMode>('auto');
  const [isModeDropdownOpen, setIsModeDropdownOpen] = useState(false);

  // Reference Documents & Materials
  const [materials, setMaterials] = useState<StudyMaterial[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | ''>(
    initialSubjectId || activeSubject?.id || '',
  );
  const [selectedMaterialId, setSelectedMaterialId] = useState<number | ''>(
    initialMaterialId || '',
  );
  const [isAttachModalOpen, setIsAttachModalOpen] = useState(false);

  // Message Composer & Stream State
  const [inputMessage, setInputMessage] = useState(initialPrompt || '');
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<number | null>(null);
  const [feedbackState, setFeedbackState] = useState<Record<number, 'up' | 'down'>>({});

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const modeDropdownRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll helper
  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({
      behavior: smooth ? 'smooth' : 'auto',
    });
  };

  useEffect(() => {
    scrollToBottom(true);
  }, [messages, isSending]);

  // Click outside listener for Mode Dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modeDropdownRef.current && !modeDropdownRef.current.contains(e.target as Node)) {
        setIsModeDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch study materials for context picker
  useEffect(() => {
    async function loadMaterials() {
      try {
        const url = selectedSubjectId
          ? `/api/materials?subjectId=${selectedSubjectId}`
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
        }
      } catch (err) {
        console.error('Failed to load materials for chat context:', err);
      }
    }
    loadMaterials();
  }, [selectedSubjectId, apiFetch]);

  // Load all user conversations
  const loadConversationsList = async () => {
    try {
      setIsLoadingThreads(true);
      const res = await apiFetch('/api/conversations');
      if (res.ok) {
        const raw = await res.json();
        const list: ConversationSummary[] = Array.isArray(raw?.data)
          ? raw.data
          : Array.isArray(raw)
          ? raw
          : [];
        setConversations(list);

        // Auto-select latest thread if none selected
        if (!activeConversationId && list.length > 0) {
          loadConversation(list[0].id);
        }
      }
    } catch (e) {
      console.error('Error fetching conversations list:', e);
    } finally {
      setIsLoadingThreads(false);
    }
  };

  useEffect(() => {
    loadConversationsList();
  }, [apiFetch]);

  // Load single conversation messages
  const loadConversation = async (id: number) => {
    try {
      setActiveConversationId(id);
      setIsSidebarOpen(false); // Close mobile drawer when thread selected
      const res = await apiFetch(`/api/conversations/${id}`);
      if (res.ok) {
        const raw = await res.json();
        const detail = raw?.data ?? raw;
        setActiveConversation(detail);
        setMessages(detail.messages || []);
        if (detail.mode) setSelectedMode(detail.mode as ChatMode);
        if (detail.subjectId) setSelectedSubjectId(detail.subjectId);
        if (detail.materialId) setSelectedMaterialId(detail.materialId);
      }
    } catch (err) {
      console.error('Error loading conversation details:', err);
    }
  };

  // Create new thread
  const handleStartNewConversation = async (modeOverride?: ChatMode) => {
    try {
      const modeToSet = modeOverride || selectedMode || 'auto';
      const res = await apiFetch('/api/conversations', {
        method: 'POST',
        body: JSON.stringify({
          subjectId: selectedSubjectId || undefined,
          materialId: selectedMaterialId || undefined,
          mode: modeToSet,
          title: 'New Chat',
        }),
      });

      if (res.ok) {
        const raw = await res.json();
        const created = raw?.data ?? raw;
        await loadConversationsList();
        loadConversation(created.id);
        setIsSidebarOpen(false);
        if (textareaRef.current) {
          textareaRef.current.focus();
        }
      }
    } catch (err) {
      console.error('Failed to start new thread:', err);
    }
  };

  // Delete thread
  const handleDeleteConversation = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this conversation?')) return;

    try {
      const res = await apiFetch(`/api/conversations/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setConversations((prev) => prev.filter((c) => c.id !== id));
        if (activeConversationId === id) {
          setActiveConversationId(null);
          setActiveConversation(null);
          setMessages([]);
        }
      }
    } catch (err) {
      console.error('Failed to delete conversation:', err);
    }
  };

  // Rename thread
  const handleSaveTitle = async (id: number, e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTitle.trim()) {
      setEditingConvId(null);
      return;
    }

    try {
      const res = await apiFetch(`/api/conversations/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ title: editingTitle.trim() }),
      });
      if (res.ok) {
        setConversations((prev) =>
          prev.map((c) => (c.id === id ? { ...c, title: editingTitle.trim() } : c)),
        );
        if (activeConversation?.id === id) {
          setActiveConversation((prev: any) => ({ ...prev, title: editingTitle.trim() }));
        }
      }
    } catch (err) {
      console.error('Failed to rename conversation:', err);
    } finally {
      setEditingConvId(null);
    }
  };

  // Update conversation mode or attached material
  const handleUpdateMode = async (mode: ChatMode) => {
    setSelectedMode(mode);
    setIsModeDropdownOpen(false);

    if (activeConversationId) {
      try {
        await apiFetch(`/api/conversations/${activeConversationId}`, {
          method: 'PATCH',
          body: JSON.stringify({ mode }),
        });
      } catch (e) {
        console.error('Failed to patch mode:', e);
      }
    }
  };

  const handleUpdateAttachedMaterial = async (matId: number | '') => {
    setSelectedMaterialId(matId);
    setIsAttachModalOpen(false);

    if (activeConversationId) {
      try {
        await apiFetch(`/api/conversations/${activeConversationId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            materialId: matId || null,
          }),
        });
      } catch (e) {
        console.error('Failed to patch conversation material:', e);
      }
    }
  };

  // Send message
  const handleSendMessage = async (customPrompt?: string, modeOverride?: ChatMode) => {
    const textToSend = (customPrompt || inputMessage).trim();
    if (!textToSend || isSending) return;

    setErrorMessage(null);
    setInputMessage('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    const currentMode = modeOverride || selectedMode || 'auto';
    let convId = activeConversationId;

    // Create session if none exists
    if (!convId) {
      try {
        const res = await apiFetch('/api/conversations', {
          method: 'POST',
          body: JSON.stringify({
            subjectId: selectedSubjectId || undefined,
            materialId: selectedMaterialId || undefined,
            mode: currentMode,
            title: textToSend.slice(0, 36),
          }),
        });
        if (res.ok) {
          const raw = await res.json();
          const created = raw?.data ?? raw;
          convId = created.id;
          setActiveConversationId(convId);
        } else {
          throw new Error('Could not initialize conversation');
        }
      } catch (err: any) {
        setErrorMessage(err.message || 'Failed to initialize session');
        return;
      }
    }

    // Optimistic user message bubble
    const tempUserMsg: ConversationMessage = {
      id: Date.now(),
      conversationId: convId!,
      role: 'user',
      content: textToSend,
      mode: currentMode,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);
    setIsSending(true);

    try {
      const res = await apiFetch(`/api/conversations/${convId}/messages`, {
        method: 'POST',
        body: JSON.stringify({
          content: textToSend,
          mode: currentMode,
          materialId: selectedMaterialId || undefined,
          subjectId: selectedSubjectId || undefined,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson?.message || errJson?.error || 'AI generation failed. Please retry.');
      }

      const raw = await res.json();
      const data = raw?.data ?? raw;

      if (data.assistantMessage) {
        setMessages((prev) => {
          const filtered = prev.filter((m) => m.id !== tempUserMsg.id);
          return [
            ...filtered,
            data.userMessage || tempUserMsg,
            {
              ...data.assistantMessage,
              resolvedMode: data.resolvedMode || data.assistantMessage.resolvedMode,
            },
          ];
        });
      }

      loadConversationsList();
    } catch (err: any) {
      console.error('Send message error:', err);
      setErrorMessage(err.message || 'Could not connect to Cortexa AI. Please retry.');
    } finally {
      setIsSending(false);
    }
  };

  // Contextual action click handler
  const handleContextAction = (action: string, lastAssistantMessage: string) => {
    switch (action.toLowerCase()) {
      case 'copy code': {
        const codeMatch = lastAssistantMessage.match(/```[a-zA-Z0-9_-]*\n([\s\S]*?)```/);
        if (codeMatch) {
          navigator.clipboard.writeText(codeMatch[1]);
        } else {
          navigator.clipboard.writeText(lastAssistantMessage);
        }
        break;
      }
      case 'create quiz': {
        if (onNavigate) {
          onNavigate('quizzes', {
            materialId: selectedMaterialId || undefined,
          });
        } else {
          handleSendMessage('Please create a 4-question multiple-choice practice quiz testing my understanding of the concepts we just discussed.', 'study');
        }
        break;
      }
      case 'make flashcards': {
        if (onNavigate) {
          onNavigate('flashcards', {
            materialId: selectedMaterialId || undefined,
          });
        } else {
          handleSendMessage('Generate 5 high-yield active recall flashcards (Front: Question, Back: Answer) for the core ideas discussed above.', 'study');
        }
        break;
      }
      case 'explain simpler':
        handleSendMessage('Can you explain that in simpler terms with a relatable everyday analogy?', 'explain');
        break;
      case 'give example':
        handleSendMessage('Can you provide a concrete, step-by-step real-world example of this in action?', 'study');
        break;
      case 'explain code':
        handleSendMessage('Please explain the code above line-by-line, highlighting the algorithmic design.', 'coding');
        break;
      case 'debug & optimize':
      case 'optimize':
        handleSendMessage('How can we optimize this code for time and memory complexity, and handle edge cases?', 'coding');
        break;
      case 'make professional':
        handleSendMessage('Rewrite the text above with a more executive, polished, and professional tone.', 'writing');
        break;
      case 'shorten':
        handleSendMessage('Please shorten the rewritten version to 2 punchy, high-impact sentences.', 'writing');
        break;
      case 'fix grammar':
        handleSendMessage('Check the text strictly for grammar, subject-verb agreement, and phrasing improvements.', 'writing');
        break;
      case 'alternative method':
        handleSendMessage('Is there an alternative mathematical or procedural method to solve this problem?', 'solve');
        break;
      default:
        handleSendMessage(`Please ${action.toLowerCase()} based on our previous discussion.`);
        break;
    }
  };

  // Copy full message
  const handleCopyMessage = (id: number, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMessageId(id);
    setTimeout(() => setCopiedMessageId(null), 2000);
  };

  // Feedback up/down
  const handleFeedback = (id: number, type: 'up' | 'down') => {
    setFeedbackState((prev) => ({
      ...prev,
      [id]: prev[id] === type ? undefined as any : type,
    }));
  };

  // Group conversations chronologically (Today, Yesterday, Previous 7 Days, Older)
  const groupConversations = () => {
    const now = new Date();
    const today: ConversationSummary[] = [];
    const yesterday: ConversationSummary[] = [];
    const last7Days: ConversationSummary[] = [];
    const older: ConversationSummary[] = [];

    const filtered = conversations.filter((c) =>
      c.title.toLowerCase().includes(searchFilter.toLowerCase()),
    );

    filtered.forEach((conv) => {
      const convDate = new Date(conv.updatedAt || conv.createdAt);
      const diffMs = now.getTime() - convDate.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays === 0 && convDate.getDate() === now.getDate()) {
        today.push(conv);
      } else if (diffDays <= 1) {
        yesterday.push(conv);
      } else if (diffDays <= 7) {
        last7Days.push(conv);
      } else {
        older.push(conv);
      }
    });

    return { today, yesterday, last7Days, older };
  };

  const { today, yesterday, last7Days, older } = groupConversations();
  const currentModeMeta = MODES.find((m) => m.id === selectedMode) || MODES[0];
  const ModeIcon = currentModeMeta.icon;
  const selectedMaterialObj = materials.find((m) => m.id === selectedMaterialId);

  return (
    <div className="flex h-[calc(100dvh-140px)] min-h-[500px] md:h-[calc(100dvh-170px)] md:min-h-[640px] md:max-h-[880px] bg-surface border border-border rounded-2xl sm:rounded-3xl overflow-hidden relative shadow-sm w-full transition-colors duration-200">
      {/* ------------------------------------------------------------------- */}
      {/* SIDEBAR BACKDROP (Mobile) */}
      {/* ------------------------------------------------------------------- */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-xs md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* ------------------------------------------------------------------- */}
      {/* LEFT SIDEBAR: History & Threads List */}
      {/* ------------------------------------------------------------------- */}
      <aside
        className={`w-72 sm:w-80 bg-[#f8f9fd] dark:bg-[#0c121e] border-r border-border flex flex-col shrink-0 z-40 transition-transform duration-200 ${
          isSidebarOpen
            ? 'fixed inset-y-0 left-0 max-w-[85vw] shadow-2xl translate-x-0'
            : 'hidden md:flex'
        }`}
      >
        {/* Sidebar Header */}
        <div className="p-3.5 border-b border-border flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => handleStartNewConversation()}
            className="flex-1 flex items-center justify-center gap-2 py-2 px-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold text-xs transition shadow-xs shadow-indigo-600/20 cursor-pointer min-h-[38px]"
          >
            <Plus className="w-4 h-4" />
            <span>New Chat</span>
          </button>

          {isSidebarOpen && (
            <button
              type="button"
              onClick={() => setIsSidebarOpen(false)}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white md:hidden cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Search Threads */}
        <div className="p-3 border-b border-border">
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 pointer-events-none" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-surface border border-border text-slate-900 dark:text-white placeholder-slate-400 text-xs focus:outline-hidden focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Grouped Threads List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-4 touch-scroll text-xs">
          {isLoadingThreads && conversations.length === 0 ? (
            <div className="p-6 text-center text-slate-400">Loading history...</div>
          ) : conversations.length === 0 ? (
            <div className="p-6 text-center text-slate-400">
              <Compass className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="font-semibold text-slate-700 dark:text-slate-300">No chats yet</p>
              <p className="text-[11px] mt-1">Start a new conversation to ask anything.</p>
            </div>
          ) : (
            <>
              {today.length > 0 && (
                <ThreadSection
                  title="Today"
                  threads={today}
                  activeId={activeConversationId}
                  editingId={editingConvId}
                  editingTitle={editingTitle}
                  onSelect={loadConversation}
                  onDelete={handleDeleteConversation}
                  onStartEdit={(id, title) => {
                    setEditingConvId(id);
                    setEditingTitle(title);
                  }}
                  onSaveTitle={handleSaveTitle}
                  onChangeTitle={setEditingTitle}
                />
              )}

              {yesterday.length > 0 && (
                <ThreadSection
                  title="Yesterday"
                  threads={yesterday}
                  activeId={activeConversationId}
                  editingId={editingConvId}
                  editingTitle={editingTitle}
                  onSelect={loadConversation}
                  onDelete={handleDeleteConversation}
                  onStartEdit={(id, title) => {
                    setEditingConvId(id);
                    setEditingTitle(title);
                  }}
                  onSaveTitle={handleSaveTitle}
                  onChangeTitle={setEditingTitle}
                />
              )}

              {last7Days.length > 0 && (
                <ThreadSection
                  title="Previous 7 Days"
                  threads={last7Days}
                  activeId={activeConversationId}
                  editingId={editingConvId}
                  editingTitle={editingTitle}
                  onSelect={loadConversation}
                  onDelete={handleDeleteConversation}
                  onStartEdit={(id, title) => {
                    setEditingConvId(id);
                    setEditingTitle(title);
                  }}
                  onSaveTitle={handleSaveTitle}
                  onChangeTitle={setEditingTitle}
                />
              )}

              {older.length > 0 && (
                <ThreadSection
                  title="Older"
                  threads={older}
                  activeId={activeConversationId}
                  editingId={editingConvId}
                  editingTitle={editingTitle}
                  onSelect={loadConversation}
                  onDelete={handleDeleteConversation}
                  onStartEdit={(id, title) => {
                    setEditingConvId(id);
                    setEditingTitle(title);
                  }}
                  onSaveTitle={handleSaveTitle}
                  onChangeTitle={setEditingTitle}
                />
              )}
            </>
          )}
        </div>
      </aside>

      {/* ------------------------------------------------------------------- */}
      {/* MAIN CHAT AREA */}
      {/* ------------------------------------------------------------------- */}
      <div className="flex-1 flex flex-col min-w-0 bg-surface">
        {/* Top Header Bar */}
        <div className="px-3.5 sm:px-6 py-2.5 sm:py-3 border-b border-border flex items-center justify-between gap-2 sm:gap-4 shrink-0 bg-surface/90 backdrop-blur-md">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {/* Mobile Drawer Trigger */}
            <button
              type="button"
              onClick={() => setIsSidebarOpen(true)}
              className="p-1.5 rounded-xl border border-border text-slate-600 dark:text-slate-300 md:hidden hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Open Chat History"
            >
              <Menu className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white shrink-0 shadow-xs shadow-indigo-600/25">
                <Brain className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h3 className="font-display font-bold text-sm sm:text-base text-slate-900 dark:text-white truncate">
                    {activeConversation?.title || 'Cortexa AI'}
                  </h3>
                  <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-1.5 py-0.2 rounded-md border border-indigo-200 dark:border-indigo-800/60 hidden sm:inline-block">
                    Universal Assistant
                  </span>
                </div>
                <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 truncate">
                  {selectedMaterialObj
                    ? `Grounded in: ${selectedMaterialObj.title}`
                    : 'Grounded intelligence across all disciplines'}
                </p>
              </div>
            </div>
          </div>

          {/* Right Header Controls: Mode Selector & Context Picker */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Context Attachment Button */}
            <button
              type="button"
              onClick={() => setIsAttachModalOpen(true)}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                selectedMaterialId
                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                  : 'bg-surface text-slate-700 dark:text-slate-300 border-border hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              title="Attach Course Document for RAG Grounding"
            >
              <Paperclip className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline max-w-[110px] truncate">
                {selectedMaterialObj ? selectedMaterialObj.title : 'Link Note'}
              </span>
            </button>

            {/* Mode Selector Dropdown */}
            <div className="relative" ref={modeDropdownRef}>
              <button
                type="button"
                onClick={() => setIsModeDropdownOpen((prev) => !prev)}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer shadow-xs ${currentModeMeta.bgLight}`}
              >
                <ModeIcon className={`w-3.5 h-3.5 ${currentModeMeta.color}`} />
                <span>{currentModeMeta.name}</span>
                <ChevronDown className="w-3 h-3 opacity-60 ml-0.5" />
              </button>

              <AnimatePresence>
                {isModeDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.98 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 mt-1.5 w-64 rounded-2xl bg-surface border border-border shadow-xl p-1.5 z-50 overflow-hidden"
                  >
                    <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Select Chat Mode
                    </div>
                    <div className="space-y-0.5 max-h-72 overflow-y-auto touch-scroll">
                      {MODES.map((m) => {
                        const Icon = m.icon;
                        const isSelected = selectedMode === m.id;
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => handleUpdateMode(m.id)}
                            className={`w-full flex items-start gap-2.5 p-2 rounded-xl text-left transition cursor-pointer ${
                              isSelected
                                ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-950 dark:text-indigo-200 font-semibold'
                                : 'hover:bg-slate-100 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${m.bgLight}`}>
                              <Icon className={`w-3.5 h-3.5 ${m.color}`} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold">{m.name}</span>
                                <span className="text-[10px] text-slate-400 font-mono">
                                  {m.badge}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight truncate">
                                {m.description}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Message Stream Container */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-6 space-y-5 sm:space-y-6 touch-scroll">
          {messages.length === 0 ? (
            /* ----------------------------------------------------------- */
            /* EMPTY CHAT EXPERIENCE: Starter Cards */
            /* ----------------------------------------------------------- */
            <div className="max-w-2xl mx-auto py-6 sm:py-10 text-center animate-in fade-in duration-300">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-3xl bg-gradient-to-tr from-indigo-600 via-violet-600 to-cyan-400 flex items-center justify-center text-white mx-auto shadow-xl shadow-indigo-600/25 mb-4 group hover:scale-105 transition-transform">
                <Brain className="w-7 h-7 sm:w-8 sm:h-8" />
              </div>

              <h2 className="font-display font-extrabold text-xl sm:text-2xl text-slate-900 dark:text-white tracking-tight">
                Cortexa AI Assistant
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1.5 max-w-md mx-auto leading-relaxed">
                Your universal partner for code, math problem-solving, academic study, writing polish, and brainstormed ideas.
              </p>

              {/* Starter Prompt Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 text-left mt-6 sm:mt-8">
                {STARTER_PROMPTS.map((item, idx) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSendMessage(item.prompt, item.mode)}
                      className="p-3 sm:p-3.5 rounded-2xl bg-surface border border-border hover:border-indigo-500/50 hover:shadow-md transition-all duration-200 group flex items-start gap-3 cursor-pointer text-left"
                    >
                      <div className="p-2 rounded-xl bg-[#f0f3fa] dark:bg-slate-800 text-slate-700 dark:text-slate-300 group-hover:bg-indigo-600 group-hover:text-white transition-colors shrink-0">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white block group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                          {item.title}
                        </span>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                          {item.subtitle}
                        </p>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            /* ----------------------------------------------------------- */
            /* CONVERSATION MESSAGES */
            /* ----------------------------------------------------------- */
            messages.map((msg, index) => {
              const isUser = msg.role === 'user';
              const resolvedModeName = msg.resolvedMode || msg.mode;
              const modeBadgeMeta = MODES.find((m) => m.id === resolvedModeName);

              return (
                <div
                  key={msg.id || index}
                  className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-4xl mx-auto w-full`}
                >
                  <div className={`flex items-start gap-2.5 sm:gap-3.5 w-full ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                    {/* Avatar */}
                    <div
                      className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center text-white shrink-0 mt-0.5 text-xs font-bold ${
                        isUser
                          ? 'bg-slate-700 dark:bg-slate-700 shadow-xs'
                          : 'bg-gradient-to-tr from-indigo-600 to-violet-600 shadow-xs shadow-indigo-600/25'
                      }`}
                    >
                      {isUser ? 'You' : <Brain className="w-4 h-4" />}
                    </div>

                    {/* Bubble Content */}
                    <div className="flex-1 min-w-0 max-w-3xl">
                      {/* Message Header (AI Mode Badge & Citations) */}
                      {!isUser && modeBadgeMeta && (
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${modeBadgeMeta.bgLight}`}
                          >
                            <modeBadgeMeta.icon className={`w-3 h-3 ${modeBadgeMeta.color}`} />
                            <span className={modeBadgeMeta.color}>{modeBadgeMeta.name} Mode</span>
                          </span>

                          {msg.isGroundedInMaterial && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Grounded in Notes</span>
                            </span>
                          )}
                        </div>
                      )}

                      {/* Main Message Body */}
                      <div
                        className={`rounded-2xl p-3.5 sm:p-4.5 ${
                          isUser
                            ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-xs'
                            : 'bg-[#f8f9fd] dark:bg-slate-900/90 border border-border text-slate-800 dark:text-slate-100 shadow-xs'
                        }`}
                      >
                        {isUser ? (
                          <p className="text-xs sm:text-sm whitespace-pre-wrap leading-relaxed font-normal">
                            {msg.content}
                          </p>
                        ) : (
                          <MarkdownRenderer content={msg.content} />
                        )}
                      </div>

                      {/* Citations Drawer (if RAG citations exist) */}
                      {!isUser && msg.citations && msg.citations.length > 0 && (
                        <div className="mt-2 p-2.5 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-xs">
                          <div className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 mb-1 flex items-center gap-1">
                            <BookOpen className="w-3.5 h-3.5" />
                            <span>Referenced Notes</span>
                          </div>
                          <div className="space-y-1">
                            {msg.citations.map((c, cIdx) => (
                              <div
                                key={cIdx}
                                className="text-[11px] text-slate-600 dark:text-slate-400 font-mono"
                              >
                                • {c.materialTitle || 'Course Document'}
                                {c.pageNumber ? ` (Page ${c.pageNumber})` : ''}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Action Bar for AI response */}
                      {!isUser && (
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-2 pt-1 text-xs">
                          {/* Copy Response */}
                          <button
                            type="button"
                            onClick={() => handleCopyMessage(msg.id, msg.content)}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-[11px] font-medium transition cursor-pointer"
                            title="Copy response"
                          >
                            {copiedMessageId === msg.id ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-500" />
                                <span className="text-emerald-500 font-bold">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>Copy</span>
                              </>
                            )}
                          </button>

                          {/* Regenerate */}
                          <button
                            type="button"
                            onClick={() => {
                              const lastUser = [...messages]
                                .reverse()
                                .find((m) => m.role === 'user');
                              if (lastUser) handleSendMessage(lastUser.content);
                            }}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-[11px] font-medium transition cursor-pointer"
                            title="Regenerate answer"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Regenerate</span>
                          </button>

                          {/* Helpful thumbs */}
                          <div className="flex items-center border border-border rounded-lg overflow-hidden">
                            <button
                              type="button"
                              onClick={() => handleFeedback(msg.id, 'up')}
                              className={`p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer ${
                                feedbackState[msg.id] === 'up'
                                  ? 'text-emerald-500 font-bold'
                                  : 'text-slate-500'
                              }`}
                              title="Helpful response"
                            >
                              <ThumbsUp className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleFeedback(msg.id, 'down')}
                              className={`p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer ${
                                feedbackState[msg.id] === 'down'
                                  ? 'text-rose-500 font-bold'
                                  : 'text-slate-500'
                              }`}
                              title="Not helpful"
                            >
                              <ThumbsDown className="w-3 h-3" />
                            </button>
                          </div>

                          {/* Contextual Action Pills */}
                          {resolvedModeName === 'study' && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleContextAction('Create Quiz', msg.content)}
                                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 hover:bg-blue-100 text-[11px] font-semibold transition cursor-pointer"
                              >
                                <HelpCircle className="w-3 h-3" />
                                <span>Create Quiz</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleContextAction('Make Flashcards', msg.content)}
                                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 hover:bg-indigo-100 text-[11px] font-semibold transition cursor-pointer"
                              >
                                <Layers className="w-3 h-3" />
                                <span>Make Flashcards</span>
                              </button>
                            </>
                          )}

                          {resolvedModeName === 'coding' && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleContextAction('Copy Code', msg.content)}
                                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 hover:bg-emerald-100 text-[11px] font-semibold transition cursor-pointer"
                              >
                                <Copy className="w-3 h-3" />
                                <span>Copy Code</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleContextAction('Optimize', msg.content)}
                                className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border hover:bg-slate-100 dark:hover:bg-slate-800 text-[11px] font-medium transition cursor-pointer"
                              >
                                <Zap className="w-3 h-3 text-amber-500" />
                                <span>Optimize</span>
                              </button>
                            </>
                          )}

                          {resolvedModeName === 'writing' && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleContextAction('Make Professional', msg.content)}
                                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60 hover:bg-rose-100 text-[11px] font-semibold transition cursor-pointer"
                              >
                                <PenTool className="w-3 h-3" />
                                <span>Make Professional</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleContextAction('Shorten', msg.content)}
                                className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border hover:bg-slate-100 dark:hover:bg-slate-800 text-[11px] font-medium transition cursor-pointer"
                              >
                                <span>Shorten</span>
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {/* Thinking / Generation State */}
          {isSending && (
            <div className="flex items-start gap-2.5 sm:gap-3.5 max-w-4xl mx-auto w-full animate-in fade-in duration-200">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white shrink-0 mt-0.5 animate-pulse">
                <Brain className="w-4 h-4" />
              </div>
              <div className="p-3.5 rounded-2xl bg-[#f8f9fd] dark:bg-slate-900 border border-border flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                <span className="w-2 h-2 rounded-full bg-indigo-600 animate-ping" />
                <span>Cortexa is formulating response...</span>
              </div>
            </div>
          )}

          {/* Error Message banner */}
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs flex items-center justify-between gap-3 max-w-4xl mx-auto w-full">
              <span>{errorMessage}</span>
              <button
                type="button"
                onClick={() => setErrorMessage(null)}
                className="text-slate-500 hover:text-slate-800 font-bold"
              >
                Dismiss
              </button>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* ------------------------------------------------------------------- */}
        {/* MESSAGE COMPOSER */}
        {/* ------------------------------------------------------------------- */}
        <div className="p-3 sm:p-4 border-t border-border bg-surface shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="max-w-4xl mx-auto w-full"
          >
            <div className="relative flex items-end gap-2 bg-[#f8f9fd] dark:bg-slate-900/90 border border-border focus-within:border-indigo-500 rounded-2xl p-2 transition-all shadow-xs">
              {/* Attachment Context Button */}
              <button
                type="button"
                onClick={() => setIsAttachModalOpen(true)}
                className={`p-2 rounded-xl transition cursor-pointer shrink-0 ${
                  selectedMaterialId
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
                title="Select study material reference"
              >
                <Paperclip className="w-4 h-4" />
              </button>

              {/* Textarea */}
              <textarea
                ref={textareaRef}
                rows={1}
                value={inputMessage}
                onChange={(e) => {
                  setInputMessage(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`;
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder={`Ask Cortexa anything (${currentModeMeta.name} Mode)...`}
                className="flex-1 bg-transparent text-slate-900 dark:text-white placeholder-slate-400 text-xs sm:text-sm py-1.5 px-1 focus:outline-hidden resize-none max-h-36 min-h-[36px]"
              />

              {/* Send / Stop Button */}
              {isSending ? (
                <button
                  type="button"
                  onClick={() => setIsSending(false)}
                  className="p-2.5 rounded-xl bg-slate-800 text-white hover:bg-slate-700 transition cursor-pointer shrink-0"
                  title="Stop generating"
                >
                  <Square className="w-4 h-4 fill-white" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!inputMessage.trim()}
                  className="p-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white disabled:opacity-40 transition cursor-pointer shadow-xs shadow-indigo-600/25 shrink-0"
                  title="Send message"
                >
                  <Send className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex items-center justify-between mt-1.5 px-2 text-[10px] text-slate-400">
              <span className="hidden sm:inline">
                Press <kbd className="px-1 py-0.5 rounded bg-slate-200 dark:bg-slate-800 font-mono">Enter</kbd> to send, <kbd className="px-1 py-0.5 rounded bg-slate-200 dark:bg-slate-800 font-mono">Shift+Enter</kbd> for newline
              </span>
              <span className="truncate">
                {selectedMaterialObj
                  ? `Active Document: ${selectedMaterialObj.title}`
                  : 'Universal Mode: General Academic & Everyday Knowledge'}
              </span>
            </div>
          </form>
        </div>
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* ATTACH COURSE MATERIAL MODAL */}
      {/* ------------------------------------------------------------------- */}
      {isAttachModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Paperclip className="w-5 h-5 text-indigo-600" />
                <h3 className="font-display font-bold text-base text-slate-900 dark:text-white">
                  Link Study Notes / Material
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAttachModalOpen(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-800 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Select an uploaded course document. Cortexa will retrieve relevant excerpts and ground answers with genuine citations.
            </p>

            <div className="space-y-2 max-h-60 overflow-y-auto touch-scroll">
              <button
                type="button"
                onClick={() => handleUpdateAttachedMaterial('')}
                className={`w-full p-3 rounded-xl border text-left transition flex items-center justify-between cursor-pointer ${
                  selectedMaterialId === ''
                    ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-950 dark:text-white font-bold'
                    : 'border-border bg-surface text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                }`}
              >
                <div>
                  <div className="text-xs font-bold">No Specific Document</div>
                  <div className="text-[11px] text-slate-500">Universal knowledge base</div>
                </div>
                {selectedMaterialId === '' && <Check className="w-4 h-4 text-indigo-600" />}
              </button>

              {materials.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => handleUpdateAttachedMaterial(m.id)}
                  className={`w-full p-3 rounded-xl border text-left transition flex items-center justify-between cursor-pointer ${
                    selectedMaterialId === m.id
                      ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-950 dark:text-white font-bold'
                      : 'border-border bg-surface text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <div className="text-xs font-bold truncate">{m.title}</div>
                    <div className="text-[11px] text-slate-500">
                      {m.fileType.toUpperCase()} • {m.pageCount || 1} pages
                    </div>
                  </div>
                  {selectedMaterialId === m.id && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
                </button>
              ))}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setIsAttachModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface ThreadSectionProps {
  title: string;
  threads: ConversationSummary[];
  activeId: number | null;
  editingId: number | null;
  editingTitle: string;
  onSelect: (id: number) => void;
  onDelete: (id: number, e: React.MouseEvent) => void;
  onStartEdit: (id: number, title: string) => void;
  onSaveTitle: (id: number, e: React.FormEvent) => void;
  onChangeTitle: (title: string) => void;
}

const ThreadSection: React.FC<ThreadSectionProps> = ({
  title,
  threads,
  activeId,
  editingId,
  editingTitle,
  onSelect,
  onDelete,
  onStartEdit,
  onSaveTitle,
  onChangeTitle,
}) => {
  return (
    <div className="space-y-1">
      <div className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
        {title}
      </div>
      <div className="space-y-0.5">
        {threads.map((thread) => {
          const isActive = thread.id === activeId;
          const isEditing = thread.id === editingId;
          const modeMeta = MODES.find((m) => m.id === thread.mode) || MODES[0];
          const Icon = modeMeta.icon;

          if (isEditing) {
            return (
              <form
                key={thread.id}
                onSubmit={(e) => onSaveTitle(thread.id, e)}
                className="p-1.5 bg-surface border border-indigo-500 rounded-xl"
              >
                <input
                  type="text"
                  autoFocus
                  value={editingTitle}
                  onChange={(e) => onChangeTitle(e.target.value)}
                  onBlur={(e) => onSaveTitle(thread.id, e)}
                  className="w-full bg-transparent text-xs text-slate-900 dark:text-white px-1 py-0.5 focus:outline-hidden"
                />
              </form>
            );
          }

          return (
            <div
              key={thread.id}
              onClick={() => onSelect(thread.id)}
              className={`group flex items-center justify-between p-2 rounded-xl text-left transition cursor-pointer ${
                isActive
                  ? 'bg-surface border border-border shadow-xs text-slate-900 dark:text-white font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-surface/60'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <Icon className={`w-3.5 h-3.5 shrink-0 ${modeMeta.color}`} />
                <span className="truncate text-xs">{thread.title}</span>
              </div>

              {/* Action buttons on hover */}
              <div className="hidden group-hover:flex items-center gap-1 shrink-0 ml-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onStartEdit(thread.id, thread.title);
                  }}
                  className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-white"
                  title="Rename chat"
                >
                  <Edit2 className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={(e) => onDelete(thread.id, e)}
                  className="p-1 rounded-md text-slate-400 hover:text-rose-600"
                  title="Delete chat"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
