import React, { useState, useEffect } from 'react';
import {
  Mic,
  MicOff,
  Sparkles,
  RotateCcw,
  Copy,
  Check,
  Languages,
  BookOpen,
  Info,
  Clock,
  Layers,
  FileText,
  AlertCircle,
  HelpCircle,
  Loader2,
  ChevronDown,
  Volume2
} from 'lucide-react';
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition.ts';
import { Subject, StudyMaterial } from '../../types/app.types.ts';
import { useAuth } from '../../context/AuthContext.tsx';

interface VoiceNotesDictatorProps {
  subjects: Subject[];
  activeSubject: Subject | null;
  onMaterialCreated: (material: StudyMaterial) => void;
  onCancel?: () => void;
  initialText?: string;
  isModal?: boolean;
}

const SUPPORTED_LANGUAGES = [
  { code: 'en-US', label: 'English (US)', flag: '🇺🇸' },
  { code: 'en-GB', label: 'English (UK)', flag: '🇬🇧' },
  { code: 'es-ES', label: 'Spanish (Español)', flag: '🇪🇸' },
  { code: 'fr-FR', label: 'French (Français)', flag: '🇫🇷' },
  { code: 'de-DE', label: 'German (Deutsch)', flag: '🇩🇪' },
  { code: 'hi-IN', label: 'Hindi (हिन्दी)', flag: '🇮🇳' },
  { code: 'zh-CN', label: 'Chinese (Mandarin)', flag: '🇨🇳' },
  { code: 'ja-JP', label: 'Japanese (日本語)', flag: '🇯🇵' },
  { code: 'pt-BR', label: 'Portuguese (Brasil)', flag: '🇧🇷' },
  { code: 'ar-SA', label: 'Arabic (العربية)', flag: '🇸🇦' },
];

export const VoiceNotesDictator: React.FC<VoiceNotesDictatorProps> = ({
  subjects,
  activeSubject,
  onMaterialCreated,
  onCancel,
  initialText = '',
  isModal = false,
}) => {
  const { apiFetch } = useAuth();
  const {
    isSupported,
    isListening,
    transcript,
    interimTranscript,
    error,
    durationSeconds,
    startListening,
    stopListening,
    resetTranscript,
    setTranscript,
    appendCustomText,
    clearError,
  } = useSpeechRecognition();

  const [selectedLanguage, setSelectedLanguage] = useState('en-US');
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | ''>('');
  const [title, setTitle] = useState('');
  const [copied, setCopied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showPunctuationHelp, setShowPunctuationHelp] = useState(false);

  // Initialize subject & initial text
  useEffect(() => {
    if (activeSubject) {
      setSelectedSubjectId(activeSubject.id);
    } else if (subjects.length > 0 && !selectedSubjectId) {
      setSelectedSubjectId(subjects[0].id);
    }
  }, [activeSubject, subjects]);

  useEffect(() => {
    if (initialText) {
      setTranscript(initialText);
    }
  }, [initialText, setTranscript]);

  // Set default title if empty
  useEffect(() => {
    if (!title) {
      const now = new Date();
      const timeStr = now.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
      const subjName = subjects.find((s) => s.id === selectedSubjectId)?.name || 'Study';
      setTitle(`${subjName} Dictation - ${timeStr}`);
    }
  }, [selectedSubjectId, subjects]);

  // Format recording timer
  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Toggle listening
  const handleToggleListening = () => {
    clearError();
    setSaveError(null);
    if (isListening) {
      stopListening();
    } else {
      startListening({ lang: selectedLanguage });
    }
  };

  // Language switch
  const handleLanguageChange = (lang: string) => {
    setSelectedLanguage(lang);
    if (isListening) {
      stopListening();
      setTimeout(() => {
        startListening({ lang });
      }, 200);
    }
  };

  // Quick insertion helpers
  const handleInsertBullet = () => {
    appendCustomText('\n• ');
  };

  const handleInsertParagraph = () => {
    appendCustomText('\n\n');
  };

  const handleInsertHeader = (headerText: string) => {
    appendCustomText(`\n\n### ${headerText}\n`);
  };

  // Template loaders
  const loadTemplate = (type: 'cornell' | 'summary' | 'keypoints') => {
    const subjName = subjects.find((s) => s.id === selectedSubjectId)?.name || 'Subject';
    if (type === 'cornell') {
      setTitle(`${subjName}: Cornell Lecture Notes`);
      setTranscript(
        `# Cornell Notes: ${subjName}\n\n## 1. Questions & Key Terms:\n• \n\n## 2. Lecture Notes & Core Insights:\n• \n\n## 3. 2-Minute Summary & Takeaways:\n• `
      );
    } else if (type === 'summary') {
      setTitle(`${subjName}: Chapter Executive Summary`);
      setTranscript(
        `# Study Summary: ${subjName}\n\n## Main Thesis / Topic:\n\n## Key Concepts & Explanations:\n• \n\n## Practical Examples / Formulas:\n• \n\n## Unresolved Questions:\n• `
      );
    } else {
      setTitle(`${subjName}: Quick Review Points`);
      setTranscript(
        `# Review Points: ${subjName}\n\n• High-Priority Formula/Definition:\n• Critical Exam Insight:\n• Step-by-Step Problem Solving:\n`
      );
    }
  };

  // Copy transcript
  const handleCopy = async () => {
    const fullText = (transcript + (interimTranscript ? ' ' + interimTranscript : '')).trim();
    if (!fullText) return;
    try {
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error('Failed to copy', e);
    }
  };

  // Word count calculation
  const totalText = (transcript + (interimTranscript ? ' ' + interimTranscript : '')).trim();
  const wordCount = totalText ? totalText.split(/\s+/).filter(Boolean).length : 0;
  const charCount = totalText.length;

  // Save to Study Materials API
  const handleSaveMaterial = async () => {
    if (isListening) {
      stopListening();
    }

    const finalContent = totalText.trim();
    if (!finalContent) {
      setSaveError('Please speak or type some study notes before saving.');
      return;
    }

    const targetSubjId = Number(selectedSubjectId) || activeSubject?.id;
    if (!targetSubjId) {
      setSaveError('Please select a course or subject to organize these notes under.');
      return;
    }

    try {
      setIsSaving(true);
      setSaveError(null);

      const res = await apiFetch('/api/materials', {
        method: 'POST',
        body: JSON.stringify({
          subjectId: targetSubjId,
          title: title.trim() || `Voice Note - ${new Date().toLocaleDateString()}`,
          fileType: 'notes',
          rawText: finalContent,
        }),
      });

      const raw = await res.json();
      if (!res.ok) {
        throw new Error(raw?.message || raw?.error || 'Failed to save voice note');
      }

      const created = raw?.data || raw;
      onMaterialCreated(created);
    } catch (err: any) {
      console.error('Save voice note error:', err);
      setSaveError(err.message || 'Error occurred while saving study note.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* ------------------------------------------------------------------- */}
      {/* Browser Support Check Banner */}
      {/* ------------------------------------------------------------------- */}
      {!isSupported && (
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2.5">
          <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block">Web Speech API Not Detected</span>
            <span>
              Your current browser does not have the native Web Speech API enabled. Voice-to-text dictation is natively supported in Google Chrome, Microsoft Edge, Safari, and Chromium-based browsers. You can still type notes manually.
            </span>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* Error Banners */}
      {/* ------------------------------------------------------------------- */}
      {(error || saveError) && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span>{error || saveError}</span>
          </div>
          <button
            onClick={() => {
              clearError();
              setSaveError(null);
            }}
            className="text-[11px] underline font-medium text-rose-600 dark:text-rose-400 hover:text-rose-800"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* Metadata Bar: Subject & Note Title */}
      {/* ------------------------------------------------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
        <div className="sm:col-span-5">
          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
            Target Course / Subject *
          </label>
          <select
            value={selectedSubjectId}
            onChange={(e) => setSelectedSubjectId(Number(e.target.value))}
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-xs sm:text-sm focus:outline-hidden focus:border-indigo-500 cursor-pointer min-h-[40px]"
          >
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} {s.code ? `(${s.code})` : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-7">
          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
            Note Title *
          </label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Physics Chapter 4 - Angular Momentum Summary"
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-xs sm:text-sm focus:outline-hidden focus:border-indigo-500 min-h-[40px]"
          />
        </div>
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* Voice Controls & Status Display */}
      {/* ------------------------------------------------------------------- */}
      <div className="p-4 rounded-2xl bg-surface-elevated border border-border space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Main Dictation Toggle Button */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={!isSupported}
              onClick={handleToggleListening}
              className={`relative flex items-center gap-2.5 px-4 sm:px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all duration-200 min-h-[44px] cursor-pointer shadow-md ${
                isListening
                  ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30 animate-pulse'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/25'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
              aria-label={isListening ? 'Stop voice dictation' : 'Start voice dictation'}
            >
              {isListening ? (
                <>
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
                  </span>
                  <MicOff className="w-4 h-4" />
                  <span>Stop Dictating</span>
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4" />
                  <span>Start Dictating</span>
                </>
              )}
            </button>

            {/* Listening status indicator with audio waves */}
            {isListening ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold">
                <span className="flex items-end gap-0.5 h-3.5">
                  <span className="w-0.5 h-3 bg-rose-500 animate-pulse"></span>
                  <span className="w-0.5 h-4 bg-rose-500 animate-pulse delay-75"></span>
                  <span className="w-0.5 h-2 bg-rose-500 animate-pulse delay-150"></span>
                  <span className="w-0.5 h-3.5 bg-rose-500 animate-pulse"></span>
                </span>
                <span>Listening ({formatTimer(durationSeconds)})</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <Clock className="w-3.5 h-3.5" />
                <span>{wordCount} words dictated</span>
              </div>
            )}
          </div>

          {/* Language selector & Punctuation tip toggle */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1 min-h-[36px]">
              <Languages className="w-3.5 h-3.5 text-slate-500" />
              <select
                value={selectedLanguage}
                onChange={(e) => handleLanguageChange(e.target.value)}
                className="bg-transparent text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-hidden cursor-pointer"
                title="Select dictation language"
              >
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                    {lang.flag} {lang.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => setShowPunctuationHelp(!showPunctuationHelp)}
              className="p-2 rounded-xl text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition min-h-[36px] flex items-center gap-1 text-xs cursor-pointer"
              title="Speech punctuation tips"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Voice Tips</span>
            </button>
          </div>
        </div>

        {/* Punctuation & Speech Cheat Sheet */}
        {showPunctuationHelp && (
          <div className="p-3 rounded-xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-500/20 text-xs space-y-1.5 animate-in fade-in duration-150">
            <div className="font-bold text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Voice Punctuation Commands (Speak Naturally):</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-slate-600 dark:text-slate-300">
              <div>• Say <code className="bg-surface px-1 py-0.5 rounded border border-border font-bold">"period"</code> ➔ .</div>
              <div>• Say <code className="bg-surface px-1 py-0.5 rounded border border-border font-bold">"comma"</code> ➔ ,</div>
              <div>• Say <code className="bg-surface px-1 py-0.5 rounded border border-border font-bold">"question mark"</code> ➔ ?</div>
              <div>• Say <code className="bg-surface px-1 py-0.5 rounded border border-border font-bold">"new line"</code> ➔ ↵</div>
            </div>
          </div>
        )}

        {/* Quick Structure Templates & Formatting Tools */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mr-1">
              Insert:
            </span>
            <button
              type="button"
              onClick={handleInsertBullet}
              className="px-2 py-1 rounded-lg bg-surface hover:bg-surface-elevated text-[11px] font-semibold text-slate-700 dark:text-slate-300 border border-border transition cursor-pointer"
            >
              • Bullet
            </button>
            <button
              type="button"
              onClick={handleInsertParagraph}
              className="px-2 py-1 rounded-lg bg-surface hover:bg-surface-elevated text-[11px] font-semibold text-slate-700 dark:text-slate-300 border border-border transition cursor-pointer"
            >
              ¶ Paragraph
            </button>
            <button
              type="button"
              onClick={() => handleInsertHeader('Key Takeaway')}
              className="px-2 py-1 rounded-lg bg-surface hover:bg-surface-elevated text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/30 transition cursor-pointer"
            >
              ⭐ Key Takeaway
            </button>
            <button
              type="button"
              onClick={() => handleInsertHeader('Formula / Rule')}
              className="px-2 py-1 rounded-lg bg-surface hover:bg-surface-elevated text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 transition cursor-pointer"
            >
              📐 Formula
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => loadTemplate('cornell')}
              className="px-2 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30 transition cursor-pointer"
            >
              Cornell Format
            </button>
            <button
              type="button"
              onClick={() => loadTemplate('summary')}
              className="px-2 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30 transition cursor-pointer"
            >
              Summary Format
            </button>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* Real-time Dictation Textarea with Interim Speech Overlay */}
      {/* ------------------------------------------------------------------- */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <label className="font-semibold uppercase tracking-wider flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>Dictated Notes & Summary Content</span>
          </label>
          <div className="flex items-center gap-2">
            <span>{wordCount} words</span>
            <span>•</span>
            <span>{charCount} chars</span>
          </div>
        </div>

        <div className="relative">
          <textarea
            rows={8}
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder={
              isListening
                ? 'Listening to your voice... Speak clearly into your microphone!'
                : 'Tap "Start Dictating" above to record your voice notes or type directly here...'
            }
            className={`w-full bg-slate-50 dark:bg-slate-900 border rounded-2xl p-4 text-xs sm:text-sm text-slate-900 dark:text-white leading-relaxed focus:outline-hidden transition-all duration-200 font-mono ${
              isListening
                ? 'border-indigo-500 ring-2 ring-indigo-500/20 shadow-inner'
                : 'border-slate-200 dark:border-slate-800 focus:border-indigo-500'
            }`}
          />

          {/* Live In-flight Speech Preview Indicator */}
          {interimTranscript && (
            <div className="absolute bottom-3 left-4 right-4 p-2.5 rounded-xl bg-indigo-900/90 dark:bg-indigo-950/95 backdrop-blur-xs border border-indigo-400/40 text-indigo-100 text-xs shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-bottom-1">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping shrink-0" />
              <div className="truncate flex-1">
                <span className="font-semibold text-cyan-300 mr-1.5">Transcribing:</span>
                <span className="italic">"{interimTranscript}"</span>
              </div>
            </div>
          )}
        </div>

        {/* Text Actions: Copy, Clear */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              disabled={!totalText}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-surface hover:bg-surface-elevated text-xs font-semibold text-slate-700 dark:text-slate-300 border border-border transition disabled:opacity-40 cursor-pointer min-h-[32px]"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-emerald-600 dark:text-emerald-400">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                  <span>Copy Text</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={resetTranscript}
              disabled={!totalText && !isListening}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-surface hover:bg-rose-500/10 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 border border-border hover:border-rose-500/30 transition disabled:opacity-40 cursor-pointer min-h-[32px]"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          </div>

          <div className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:block">
            {isListening ? (
              <span className="text-rose-500 font-medium animate-pulse">● Live microphone active</span>
            ) : (
              <span>Voice notes automatically chunked & indexed with AI</span>
            )}
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* Action Footer: Save Material */}
      {/* ------------------------------------------------------------------- */}
      <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5 pt-3 border-t border-border">
        {onCancel && (
          <button
            type="button"
            disabled={isSaving}
            onClick={() => {
              if (isListening) stopListening();
              onCancel();
            }}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-xs sm:text-sm font-medium transition min-h-[42px] cursor-pointer"
          >
            Cancel
          </button>
        )}

        <button
          type="button"
          disabled={isSaving || !totalText.trim()}
          onClick={handleSaveMaterial}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-bold shadow-lg shadow-indigo-600/20 transition disabled:opacity-50 min-h-[44px] cursor-pointer"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Saving & Generating AI Summary...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>Save Voice Note as Material</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
