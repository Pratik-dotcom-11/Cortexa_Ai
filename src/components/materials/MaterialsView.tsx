import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useSubject } from '../../context/SubjectContext.tsx';
import {
  Upload,
  FileText,
  Search,
  Trash2,
  Brain,
  HelpCircle,
  Sparkles,
  Layers,
  ChevronRight,
  BookOpen,
  CheckCircle2,
  Download,
  AlertCircle,
  FileCode,
  Loader2,
  Info,
  ArrowLeft,
  Mic,
  MicOff,
  Highlighter,
} from 'lucide-react';
import { StudyMaterial, MaterialChunk } from '../../types/app.types.ts';
import { Modal } from '../common/Modal.tsx';
import { VoiceNotesDictator } from './VoiceNotesDictator.tsx';
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition.ts';
import { PdfAnnotationViewer } from './PdfAnnotationViewer.tsx';

interface MaterialsViewProps {
  onNavigate: (tab: string, meta?: any) => void;
}

export const MaterialsView: React.FC<MaterialsViewProps> = ({ onNavigate }) => {
  const { apiFetch } = useAuth();
  const { activeSubject, subjects } = useSubject();

  const [materials, setMaterials] = useState<StudyMaterial[]>([]);
  const [selectedMaterial, setSelectedMaterial] = useState<StudyMaterial | null>(null);
  const [loading, setLoading] = useState(false);
  const [mobileDetailActive, setMobileDetailActive] = useState(false);

  // Canvas Annotation Viewer state
  const [isAnnotatorOpen, setIsAnnotatorOpen] = useState(false);

  // Upload & Voice dictation modal state
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadMode, setUploadMode] = useState<'pdf' | 'text' | 'voice'>('pdf');
  const [voiceInitialTitle, setVoiceInitialTitle] = useState('');
  const [uploadSubjectId, setUploadSubjectId] = useState<number | ''>('');
  const [uploadTitle, setUploadTitle] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [rawText, setRawText] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgressStep, setUploadProgressStep] = useState<string>('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Quick inline speech-to-text recognition for text mode textarea
  const inlineSpeech = useSpeechRecognition();

  useEffect(() => {
    if (inlineSpeech.transcript) {
      setRawText((prev) => {
        const needsSpace = prev.length > 0 && !prev.endsWith(' ') && !prev.endsWith('\n');
        return prev + (needsSpace ? ' ' : '') + inlineSpeech.transcript;
      });
      inlineSpeech.resetTranscript();
    }
  }, [inlineSpeech.transcript]);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Sync upload subject with active subject
  useEffect(() => {
    if (activeSubject) {
      setUploadSubjectId(activeSubject.id);
    } else if (subjects.length > 0 && !uploadSubjectId) {
      setUploadSubjectId(subjects[0].id);
    }
  }, [activeSubject, subjects]);

  // Fetch materials
  const loadMaterials = async () => {
    try {
      setLoading(true);
      const url = activeSubject
        ? `/api/materials?subjectId=${activeSubject.id}`
        : '/api/materials';
      const res = await apiFetch(url);
      if (res.ok) {
        const raw = await res.json();
        const list: StudyMaterial[] = Array.isArray(raw)
          ? raw
          : Array.isArray(raw?.data)
          ? raw.data
          : [];
        setMaterials(list);
        if (list.length > 0 && !selectedMaterial && window.innerWidth >= 1024) {
          loadMaterialDetail(list[0].id, false);
        }
      }
    } catch (e) {
      console.error('Error fetching materials:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadMaterialDetail = async (id: number, openMobileDetail: boolean = true) => {
    try {
      const res = await apiFetch(`/api/materials/${id}`);
      if (res.ok) {
        const raw = await res.json();
        const detail = raw?.data ?? raw;
        setSelectedMaterial(detail);
        if (openMobileDetail) {
          setMobileDetailActive(true);
        }
      }
    } catch (e) {
      console.error('Error fetching material detail:', e);
    }
  };

  useEffect(() => {
    loadMaterials();
  }, [activeSubject]);

  // Search filter
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsSearching(true);
        const subjParam = activeSubject ? `&subjectId=${activeSubject.id}` : '';
        const res = await apiFetch(`/api/materials/search?q=${encodeURIComponent(searchQuery)}${subjParam}`);
        if (res.ok) {
          const results = await res.json();
          setSearchResults(results);
        }
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, activeSubject]);

  const handleFileSelection = (file: File) => {
    setUploadError(null);
    const lowerName = file.name.toLowerCase();
    const isPdf = lowerName.endsWith('.pdf') || file.type === 'application/pdf';
    const isImage =
      lowerName.endsWith('.jpg') ||
      lowerName.endsWith('.jpeg') ||
      lowerName.endsWith('.png') ||
      lowerName.endsWith('.webp') ||
      file.type.startsWith('image/');

    if (!isPdf && !isImage) {
      setUploadError('Only PDF documents and image files (JPG, PNG, WEBP) are supported.');
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setUploadError('File size exceeds the 15MB limit.');
      return;
    }

    setSelectedFile(file);
    if (!uploadTitle.trim()) {
      const baseName = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
      setUploadTitle(baseName);
    }
  };

  const handlePdfUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetSubjectId = Number(uploadSubjectId) || activeSubject?.id;
    if (!targetSubjectId) {
      setUploadError('Please select a course / subject for this material.');
      return;
    }

    if (uploadMode === 'pdf') {
      if (!selectedFile) {
        setUploadError('Please select a PDF file or note image to upload.');
        return;
      }

      try {
        setIsUploading(true);
        setUploadError(null);
        setUploadProgressStep('Uploading file securely to storage...');

        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('subjectId', targetSubjectId.toString());
        if (uploadTitle.trim()) {
          formData.append('title', uploadTitle.trim());
        }

        const isImage = selectedFile.type.startsWith('image/') || /\.(jpg|jpeg|png|webp)$/i.test(selectedFile.name);
        if (isImage) {
          setUploadProgressStep('Executing Multimodal Gemini Vision OCR for handwritten equations & diagrams...');
        } else {
          setUploadProgressStep('Extracting PDF text pages, formatting equations, & chunking...');
        }

        const res = await apiFetch('/api/materials/upload', {
          method: 'POST',
          body: formData,
        });

        const text = await res.text();
        let raw: any = null;
        try {
          raw = text ? JSON.parse(text) : {};
        } catch {
          throw new Error(
            res.ok
              ? 'Server returned invalid response format.'
              : `Upload failed (Server HTTP ${res.status}): ${text.slice(0, 120)}`,
          );
        }

        if (!res.ok) {
          throw new Error(raw?.message || raw?.error || 'Failed to process document');
        }

        const created = raw?.data || raw;
        resetUploadModal();
        setIsUploadOpen(false);
        await loadMaterials();
        loadMaterialDetail(created.id, true);
      } catch (err: any) {
        console.error('Document upload pipeline error:', err);
        setUploadError(err.message || 'Error occurred while processing document.');
      } finally {
        setIsUploading(false);
        setUploadProgressStep('');
      }
    } else {
      // Text mode
      if (!uploadTitle.trim() || !rawText.trim()) {
        setUploadError('Title and text content are required.');
        return;
      }

      try {
        setIsUploading(true);
        setUploadError(null);
        setUploadProgressStep('Processing text and generating AI summary...');

        const res = await apiFetch('/api/materials', {
          method: 'POST',
          body: JSON.stringify({
            subjectId: targetSubjectId,
            title: uploadTitle.trim(),
            fileType: 'notes',
            rawText: rawText.trim(),
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
              : `Creation failed (Server HTTP ${res.status}): ${text.slice(0, 120)}`,
          );
        }

        if (!res.ok) {
          throw new Error(raw?.message || raw?.error || 'Failed to create material');
        }

        const created = raw?.data || raw;
        resetUploadModal();
        setIsUploadOpen(false);
        await loadMaterials();
        loadMaterialDetail(created.id, true);
      } catch (err: any) {
        console.error('Text material error:', err);
        setUploadError(err.message || 'Error saving study material.');
      } finally {
        setIsUploading(false);
        setUploadProgressStep('');
      }
    }
  };

  const resetUploadModal = () => {
    setSelectedFile(null);
    setUploadTitle('');
    setRawText('');
    setVoiceInitialTitle('');
    setUploadError(null);
    setUploadProgressStep('');
    if (inlineSpeech.isListening) {
      inlineSpeech.stopListening();
    }
    inlineSpeech.resetTranscript();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDeleteMaterial = async (id: number) => {
    if (!confirm('Are you sure you want to delete this study material and all its chunks?')) return;
    try {
      const res = await apiFetch(`/api/materials/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setMaterials((prev) => prev.filter((m) => m.id !== id));
        if (selectedMaterial?.id === id) {
          setSelectedMaterial(null);
          setMobileDetailActive(false);
        }
      }
    } catch (e) {
      console.error('Error deleting material:', e);
    }
  };

  const handleDownloadOriginalPdf = async (materialId: number, filename?: string) => {
    try {
      const res = await apiFetch(`/api/materials/${materialId}/download`);
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        alert(error?.message || 'Download failed: Unauthorized or file unavailable');
        return;
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || 'document.pdf';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Download error:', err);
      alert('Failed to download document.');
    }
  };

  const loadSampleNote = (type: 'os' | 'dijkstra' | 'econ') => {
    setUploadMode('text');
    if (type === 'os') {
      setUploadTitle('Lecture 7: Virtual Memory & Page Replacement');
      setRawText(`Virtual Memory Management in Modern Operating Systems\nCourse: Computer Systems & Architecture\n\n1. Core Motivation:\nVirtual memory provides an illusion to user processes of a large, contiguous address space that is physically backed by scattered frames in main memory (DRAM) and secondary storage (Disk/SSD swap space).\n\n2. Hardware Translation & Paging:\nThe Memory Management Unit (MMU) translates Virtual Page Numbers (VPN) to Physical Frame Numbers (PFN). Page Table Entries (PTE) store Valid/Invalid bits, Dirty bits, and Access permissions.\n\n3. Page Replacement Algorithms:\n- FIFO: Belady's anomaly\n- Optimal: Future knowledge benchmark\n- LRU: Clock algorithm approximation.`);
    } else if (type === 'dijkstra') {
      setUploadTitle('Algorithms: Shortest Paths & Dijkstra Analysis');
      setRawText(`Single-Source Shortest Path Algorithms: Dijkstra\nDepartment of Computer Science\n\n1. Problem Definition:\nGiven a directed graph G = (V, E) with non-negative edge weights w(u, v) >= 0 and a source vertex s, find the minimum weight path from s to all other vertices.\n\n2. The Greedy Invariant:\nAt each step, select u in V - S with the minimum distance estimate d[u], add u to S, and relax outgoing edges (u, v).\n\n3. Complexity:\n- Min-Heap: O((V + E) log V)\n- Matrix: O(V^2)`);
    } else {
      setUploadTitle('Economics: Price Elasticity of Demand');
      setRawText(`Price Elasticity of Demand & Market Equilibrium\nDepartment of Economics\n\n1. Definition & Formula:\nPED = (% Change in Quantity Demanded) / (% Change in Price)\n\n2. Classifications:\n- Inelastic (|PED| < 1): Life-saving drugs, electricity\n- Unit Elastic (|PED| = 1)\n- Elastic (|PED| > 1): Luxury goods, close substitutes`);
    }
  };

  return (
    <div className="space-y-5 sm:space-y-6 animate-in fade-in duration-200">
      {/* ------------------------------------------------------------------- */}
      {/* TOP HEADER / ACTION BAR */}
      {/* ------------------------------------------------------------------- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span>Study Materials & Notes</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-0.5">
            {activeSubject
              ? `Repository for ${activeSubject.name}`
              : 'Lecture notes, textbook PDFs, and scanned handwritten notes'}
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => {
              resetUploadModal();
              setUploadMode('voice');
              setVoiceInitialTitle('');
              setIsUploadOpen(true);
            }}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-rose-600/10 hover:bg-rose-600/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 text-xs sm:text-sm font-bold shadow-xs transition cursor-pointer min-h-[44px]"
            title="Dictate quick voice notes or study summaries using Web Speech API"
          >
            <Mic className="w-4 h-4 text-rose-500" />
            <span>Dictate Note</span>
          </button>

          <button
            onClick={() => {
              resetUploadModal();
              setUploadMode('pdf');
              setIsUploadOpen(true);
            }}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-bold shadow-lg shadow-indigo-600/20 transition cursor-pointer min-h-[44px]"
          >
            <Upload className="w-4 h-4" />
            <span>Upload PDF / Notes</span>
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* RESPONSIVE LAYOUT: Master List vs Detail Pane */}
      {/* ------------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
        {/* Left List (visible on desktop OR on mobile when not in detail view) */}
        <div
          className={`lg:col-span-4 space-y-3.5 ${
            mobileDetailActive ? 'hidden lg:block' : 'block'
          }`}
        >
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search concepts or notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-surface border border-border rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-foreground placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 transition min-h-[42px]"
            />
          </div>

          {/* Materials List */}
          <div className="space-y-2">
            {loading ? (
              <div className="p-8 text-center text-slate-500 text-xs sm:text-sm">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                Loading study repository...
              </div>
            ) : materials.length === 0 ? (
              <div className="p-6 sm:p-8 rounded-2xl bg-surface border border-border text-center">
                <FileText className="w-9 h-9 text-slate-400 dark:text-slate-600 mx-auto mb-2" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">No materials uploaded yet</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                  Upload lecture slides or dictate quick study notes to generate automated flashcards, summaries, and practice quizzes.
                </p>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                  <button
                    onClick={() => {
                      resetUploadModal();
                      setUploadMode('voice');
                      setIsUploadOpen(true);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-rose-600/10 hover:bg-rose-600/20 text-rose-600 dark:text-rose-400 text-xs font-semibold border border-rose-500/30 transition min-h-[40px] cursor-pointer flex items-center gap-1.5"
                  >
                    <Mic className="w-3.5 h-3.5" />
                    <span>Dictate First Note</span>
                  </button>
                  <button
                    onClick={() => {
                      resetUploadModal();
                      setUploadMode('pdf');
                      setIsUploadOpen(true);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-600 dark:text-indigo-300 text-xs font-semibold border border-indigo-500/30 transition min-h-[40px] cursor-pointer"
                  >
                    Upload First PDF
                  </button>
                </div>
              </div>
            ) : (
              materials.map((mat) => {
                const isSelected = selectedMaterial?.id === mat.id;
                return (
                  <div
                    key={mat.id}
                    onClick={() => loadMaterialDetail(mat.id, true)}
                    className={`p-3.5 sm:p-4 rounded-2xl border transition cursor-pointer text-left min-h-[64px] flex items-center justify-between gap-2.5 ${
                      isSelected
                        ? 'bg-indigo-500/10 dark:bg-indigo-600/15 border-indigo-500/50 shadow-xs'
                        : 'bg-surface hover:bg-surface-elevated border-border'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div
                        className={`p-2 rounded-xl shrink-0 ${
                          mat.fileType === 'pdf'
                            ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                            : mat.fileType === 'image'
                            ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                            : 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20'
                        }`}
                      >
                        {mat.fileType === 'pdf' ? (
                          <FileText className="w-4 h-4" />
                        ) : mat.fileType === 'image' ? (
                          <Sparkles className="w-4 h-4" />
                        ) : (
                          <FileCode className="w-4 h-4" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                          {mat.title}
                        </h4>
                        <div className="flex items-center gap-1.5 mt-0.5 text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 flex-wrap">
                          <span className="uppercase font-semibold text-slate-700 dark:text-slate-300">
                            {mat.fileType}
                          </span>
                          {mat.pageCount && mat.pageCount > 0 && (
                            <span>• {mat.pageCount} {mat.pageCount === 1 ? 'page' : 'pages'}</span>
                          )}
                          {mat.fileSize > 0 && (
                            <span>• {(mat.fileSize / 1024).toFixed(0)} KB</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <ChevronRight
                      className={`w-4 h-4 shrink-0 transition ${
                        isSelected ? 'text-indigo-600 dark:text-indigo-400 translate-x-0.5' : 'text-slate-400 dark:text-slate-600'
                      }`}
                    />
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Detail Pane */}
        <div
          className={`lg:col-span-8 ${
            !mobileDetailActive ? 'hidden lg:block' : 'block'
          }`}
        >
          {selectedMaterial ? (
            <div className="bg-surface border border-border rounded-2xl sm:rounded-3xl p-4 sm:p-7 space-y-5 shadow-xs">
              {/* Mobile Back Button (Visible only on small screens) */}
              <div className="lg:hidden pb-3 border-b border-slate-200 dark:border-slate-800">
                <button
                  onClick={() => setMobileDetailActive(false)}
                  className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 text-xs font-bold min-h-[40px] px-3 rounded-lg bg-slate-100 dark:bg-slate-800/80 w-fit cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to Documents List</span>
                </button>
              </div>

              {/* Document Header & Metadata */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider ${
                        selectedMaterial.fileType === 'pdf'
                          ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20'
                          : selectedMaterial.fileType === 'image'
                          ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20'
                          : 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20'
                      }`}
                    >
                      {selectedMaterial.fileType === 'image' ? 'Handwritten OCR' : selectedMaterial.fileType}
                    </span>
                    {selectedMaterial.pageCount && selectedMaterial.pageCount > 0 && (
                      <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                        {selectedMaterial.pageCount} {selectedMaterial.pageCount === 1 ? 'Page' : 'Pages'}
                      </span>
                    )}
                    {selectedMaterial.fileSize > 0 && (
                      <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                        • {(selectedMaterial.fileSize / 1024).toFixed(0)} KB
                      </span>
                    )}
                  </div>
                  <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white break-words">
                    {selectedMaterial.title}
                  </h2>
                  {selectedMaterial.originalFileName && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                      File: {selectedMaterial.originalFileName}
                    </p>
                  )}
                </div>

                {/* Document Action Buttons */}
                <div className="flex items-center flex-wrap gap-2 pt-1 sm:pt-0">
                  {selectedMaterial.fileType === 'pdf' && (
                    <button
                      onClick={() =>
                        handleDownloadOriginalPdf(
                          selectedMaterial.id,
                          selectedMaterial.originalFileName || `${selectedMaterial.title}.pdf`,
                        )
                      }
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-200 dark:border-slate-700 transition min-h-[38px] cursor-pointer"
                      title="Download PDF"
                    >
                      <Download className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                      <span>Download</span>
                    </button>
                  )}
                  <button
                    onClick={() => onNavigate('quizzes', { materialId: selectedMaterial.id })}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 text-xs font-bold border border-indigo-500/30 transition min-h-[38px] cursor-pointer"
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span>Quiz</span>
                  </button>
                  <button
                    onClick={() => onNavigate('flashcards', { materialId: selectedMaterial.id })}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-violet-500/10 hover:bg-violet-500/20 text-violet-600 dark:text-violet-300 text-xs font-bold border border-violet-500/30 transition min-h-[38px] cursor-pointer"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Cards</span>
                  </button>
                  <button
                    onClick={() => setIsAnnotatorOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-bold border border-amber-500/30 transition min-h-[38px] cursor-pointer shadow-xs"
                    title="Highlight passages and add comments directly onto the document with canvas overlay"
                  >
                    <Highlighter className="w-3.5 h-3.5" />
                    <span>Annotate Document</span>
                  </button>
                  <button
                    onClick={() => {
                      resetUploadModal();
                      setUploadMode('voice');
                      setVoiceInitialTitle(`Summary: ${selectedMaterial.title}`);
                      setUploadSubjectId(selectedMaterial.subjectId || activeSubject?.id || '');
                      setIsUploadOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold border border-rose-500/30 transition min-h-[38px] cursor-pointer"
                    title="Dictate quick study summary for this document using Web Speech API"
                  >
                    <Mic className="w-3.5 h-3.5" />
                    <span>Dictate Summary</span>
                  </button>
                  <button
                    onClick={() => handleDeleteMaterial(selectedMaterial.id)}
                    className="p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition min-h-[38px] min-w-[38px] flex items-center justify-center cursor-pointer"
                    title="Delete Material"
                    aria-label="Delete material"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* AI Executive Summary */}
              {selectedMaterial.summary && (
                <div className="p-4 sm:p-5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/35 border border-indigo-200 dark:border-indigo-500/25 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 font-bold text-xs uppercase tracking-wider">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>AI Executive Summary</span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
                    {selectedMaterial.summary}
                  </p>
                </div>
              )}

              {/* Key Concepts / Suggested Topics */}
              {selectedMaterial.keyConcepts && selectedMaterial.keyConcepts.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Brain className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span>Key Concepts</span>
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedMaterial.keyConcepts.map((concept, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-indigo-700 dark:text-indigo-300 font-medium"
                      >
                        {concept}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Interactive Canvas Annotation Banner */}
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-indigo-500/5 to-violet-500/10 border border-amber-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5">
                    <Highlighter className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <span>Canvas-Based Document Annotations</span>
                      <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-700 dark:text-amber-300 text-[10px] font-bold">
                        Interactive Overlay
                      </span>
                    </h4>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                      Draw highlighter strokes, create rectangle callouts, and pin interactive study notes & comments directly onto the document canvas.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsAnnotatorOpen(true)}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-md shadow-amber-500/20 transition cursor-pointer min-h-[40px] shrink-0"
                >
                  <Highlighter className="w-4 h-4" />
                  <span>Open Canvas Annotator</span>
                </button>
              </div>

              {/* Chunks Navigation & Full Content */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
                    <span>Document Chunks</span>
                    <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                      {selectedMaterial.chunks?.length || 1}
                    </span>
                  </h3>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:inline">
                    Clean text extracted for AI study tools
                  </span>
                </div>

                {selectedMaterial.chunks && selectedMaterial.chunks.length > 0 ? (
                  <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1 touch-scroll">
                    {selectedMaterial.chunks.map((chunk) => (
                      <div
                        key={chunk.chunkIndex}
                        className="p-3.5 sm:p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 space-y-1.5"
                      >
                        <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
                          <span className="text-indigo-600 dark:text-indigo-400 font-semibold">
                            Chunk #{chunk.chunkIndex + 1}
                          </span>
                          <div className="flex items-center gap-2 sm:gap-3">
                            {chunk.pageNumber && (
                              <span>Page ~{chunk.pageNumber}</span>
                            )}
                            {chunk.tokenCount && (
                              <span>~{chunk.tokenCount} tokens</span>
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-slate-800 dark:text-slate-300 font-mono leading-relaxed whitespace-pre-wrap break-words">
                          {chunk.content}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-300 font-mono leading-relaxed whitespace-pre-wrap max-h-[500px] overflow-y-auto break-words touch-scroll">
                    {selectedMaterial.rawText}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-surface border border-border rounded-2xl sm:rounded-3xl p-8 sm:p-12 text-center text-slate-500 dark:text-slate-400 shadow-xs">
              <BookOpen className="w-10 h-10 sm:w-12 sm:h-12 text-slate-400 dark:text-slate-600 mx-auto mb-3" />
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">Select a Material to Read</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Choose a document from the list or upload lecture notes to view chunks, summaries, and launch practice quizzes.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* MODAL: UPLOAD / DICTATE STUDY MATERIAL */}
      {/* ------------------------------------------------------------------- */}
      <Modal
        isOpen={isUploadOpen}
        onClose={() => {
          if (!isUploading) {
            resetUploadModal();
            setIsUploadOpen(false);
          }
        }}
        title={
          uploadMode === 'voice'
            ? 'Voice Dictation & Study Summary'
            : uploadMode === 'pdf'
            ? 'Upload Document / Notes Photo'
            : 'Add Text Study Material'
        }
        maxWidth="max-w-2xl"
      >
        <div className="space-y-4">
          {/* Mode Selector */}
          <div className="grid grid-cols-3 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => {
                setUploadMode('pdf');
                setUploadError(null);
                if (inlineSpeech.isListening) inlineSpeech.stopListening();
              }}
              className={`py-2 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 min-h-[38px] cursor-pointer ${
                uploadMode === 'pdf'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">PDF / Photo</span>
              <span className="sm:hidden">PDF</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setUploadMode('text');
                setUploadError(null);
              }}
              className={`py-2 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 min-h-[38px] cursor-pointer ${
                uploadMode === 'text'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Text / Notes</span>
              <span className="sm:hidden">Text</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setUploadMode('voice');
                setUploadError(null);
                if (inlineSpeech.isListening) inlineSpeech.stopListening();
              }}
              className={`py-2 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 min-h-[38px] cursor-pointer ${
                uploadMode === 'voice'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-rose-600 dark:text-rose-400 hover:bg-rose-500/10'
              }`}
            >
              <Mic className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Voice Dictate</span>
              <span className="sm:hidden">Voice</span>
            </button>
          </div>

          {/* Voice Mode */}
          {uploadMode === 'voice' ? (
            <VoiceNotesDictator
              subjects={subjects}
              activeSubject={activeSubject}
              onMaterialCreated={(created) => {
                setIsUploadOpen(false);
                resetUploadModal();
                loadMaterials();
                loadMaterialDetail(created.id, true);
              }}
              onCancel={() => {
                setIsUploadOpen(false);
                resetUploadModal();
              }}
              initialText={voiceInitialTitle ? `# ${voiceInitialTitle}\n\n` : ''}
              isModal={true}
            />
          ) : (
            /* PDF & Text Upload Form */
            <form onSubmit={handlePdfUpload} className="space-y-4">
              {/* Error Banner */}
              {uploadError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  <span>{uploadError}</span>
                </div>
              )}

              {/* Subject Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Target Course / Subject *
                </label>
                <select
                  required
                  value={uploadSubjectId}
                  onChange={(e) => setUploadSubjectId(Number(e.target.value))}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white text-xs sm:text-sm focus:outline-hidden focus:border-indigo-500 cursor-pointer min-h-[42px]"
                >
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.code ? `(${s.code})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Document Title */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Document Title {uploadMode === 'pdf' ? '(Optional)' : '*'}
                </label>
                <input
                  type="text"
                  required={uploadMode === 'text'}
                  placeholder={
                    uploadMode === 'pdf'
                      ? 'e.g. Physics Midterm Notes (auto-detected from file)'
                      : 'e.g. Chapter 3 Summary, Midterm Exam Notes'
                  }
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white text-xs sm:text-sm focus:outline-hidden focus:border-indigo-500 min-h-[42px]"
                />
              </div>

              {/* Mode 1: PDF or Image Dropzone */}
              {uploadMode === 'pdf' ? (
                <div className="space-y-3">
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                    Select File (PDF, JPG, PNG, WEBP) *
                  </label>

                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragging(false);
                      const file = e.dataTransfer.files?.[0];
                      if (file && !isUploading) handleFileSelection(file);
                    }}
                    onClick={() => !isUploading && fileInputRef.current?.click()}
                    className={`relative overflow-hidden p-5 sm:p-6 rounded-2xl border-2 border-dashed text-center transition ${
                      isUploading
                        ? 'border-indigo-500/80 bg-indigo-950/20'
                        : isDragging
                        ? 'border-indigo-500 bg-indigo-500/10 cursor-pointer'
                        : selectedFile
                        ? 'border-emerald-500/50 bg-emerald-500/5 cursor-pointer'
                        : 'border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600 bg-slate-50/70 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800/60 cursor-pointer'
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="application/pdf,.pdf,image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file && !isUploading) handleFileSelection(file);
                      }}
                    />

                    {/* AI Overlay Laser Scanner Beam during Document Processing */}
                    {isUploading && (
                      <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-xs rounded-2xl p-4 overflow-hidden animate-in fade-in duration-200">
                        {/* Vertical Laser Beam Line */}
                        <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent animate-scan shadow-lg shadow-cyan-400/80 z-30" />
                        <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/15 via-cyan-500/10 to-violet-500/15 animate-pulse pointer-events-none" />

                        <div className="relative z-40 space-y-2 text-center">
                          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-600 via-violet-600 to-cyan-400 flex items-center justify-center text-white mx-auto shadow-lg shadow-cyan-400/20 animate-pulse">
                            <Brain className="w-6 h-6 text-white animate-bounce" />
                          </div>
                          <p className="text-xs sm:text-sm font-extrabold text-white tracking-tight">
                            AI Multimodal Document Scanning
                          </p>
                          <p className="text-[11px] text-cyan-300 font-semibold max-w-xs mx-auto truncate">
                            {uploadProgressStep || 'Extracting concepts & chunking...'}
                          </p>
                        </div>
                      </div>
                    )}

                    {selectedFile ? (
                      <div className="space-y-1.5 relative">
                        <CheckCircle2 className="w-7 h-7 text-emerald-500 dark:text-emerald-400 mx-auto" />
                        <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white break-all">{selectedFile.name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {(selectedFile.size / 1024).toFixed(0)} KB • Ready for extraction
                        </p>
                        {!isUploading && (
                          <p className="text-[11px] text-indigo-600 dark:text-indigo-400 underline pt-1 font-medium">
                            Tap to choose another file
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <Upload className="w-7 h-7 text-indigo-600 dark:text-indigo-400 mx-auto" />
                        <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                          Tap to choose file or take photo
                        </p>
                        <p className="text-[11px] text-slate-500">
                          Typed PDFs, scanned notes, photos (max 15MB)
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-600 dark:text-slate-400 flex items-start gap-2">
                    <Info className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                    <span>
                      Formulas ($F = ma$, $\int f(x)dx$) and diagrams in handwritten photos are transcribed with Gemini Multimodal OCR.
                    </span>
                  </div>
                </div>
              ) : (
                /* Mode 2: Direct Text & Sample Notes with Inline Speech-to-Text */
                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20">
                    <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300 block mb-1.5">
                      ⚡ Auto-fill Sample Lecture Notes:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => loadSampleNote('os')}
                        className="px-2.5 py-1 rounded-lg bg-surface hover:bg-surface-elevated text-xs text-indigo-700 dark:text-indigo-300 font-semibold border border-border min-h-[32px] cursor-pointer"
                      >
                        OS: Virtual Memory
                      </button>
                      <button
                        type="button"
                        onClick={() => loadSampleNote('dijkstra')}
                        className="px-2.5 py-1 rounded-lg bg-surface hover:bg-surface-elevated text-xs text-indigo-700 dark:text-indigo-300 font-semibold border border-border min-h-[32px] cursor-pointer"
                      >
                        Algorithms: Dijkstra
                      </button>
                      <button
                        type="button"
                        onClick={() => loadSampleNote('econ')}
                        className="px-2.5 py-1 rounded-lg bg-surface hover:bg-surface-elevated text-xs text-indigo-700 dark:text-indigo-300 font-semibold border border-border min-h-[32px] cursor-pointer"
                      >
                        Econ: Elasticity
                      </button>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                        Notes Content *
                      </label>
                      {inlineSpeech.isSupported && (
                        <button
                          type="button"
                          onClick={() => {
                            if (inlineSpeech.isListening) {
                              inlineSpeech.stopListening();
                            } else {
                              inlineSpeech.startListening({ lang: 'en-US' });
                            }
                          }}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition cursor-pointer min-h-[30px] ${
                            inlineSpeech.isListening
                              ? 'bg-rose-600 text-white border-rose-600 animate-pulse'
                              : 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                          }`}
                          title={inlineSpeech.isListening ? 'Stop voice dictation' : 'Dictate notes with Web Speech API'}
                        >
                          {inlineSpeech.isListening ? (
                            <>
                              <MicOff className="w-3.5 h-3.5" />
                              <span>Stop Dictating</span>
                            </>
                          ) : (
                            <>
                              <Mic className="w-3.5 h-3.5" />
                              <span>Dictate Notes (Voice-to-Text)</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>

                    {inlineSpeech.isListening && inlineSpeech.interimTranscript && (
                      <div className="mb-2 p-2 rounded-xl bg-indigo-900/90 text-indigo-100 text-xs italic flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping shrink-0" />
                        <span className="truncate">Hearing: "{inlineSpeech.interimTranscript}"</span>
                      </div>
                    )}

                    <textarea
                      required
                      rows={6}
                      placeholder="Paste lecture notes or use Voice Dictation to speak your summary..."
                      value={rawText}
                      onChange={(e) => setRawText(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-slate-900 dark:text-white text-xs sm:text-sm focus:outline-hidden focus:border-indigo-500 font-mono"
                    />
                  </div>
                </div>
              )}

              {/* Progress Indicator */}
              {isUploading && uploadProgressStep && (
                <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-500/30 text-indigo-700 dark:text-indigo-200 text-xs flex items-center gap-2.5">
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <span>{uploadProgressStep}</span>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  disabled={isUploading}
                  onClick={() => setIsUploadOpen(false)}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-xs sm:text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploading || (uploadMode === 'pdf' ? !selectedFile : !rawText.trim())}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-bold transition disabled:opacity-50 min-h-[44px] cursor-pointer"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Process Document</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </Modal>

      {/* ------------------------------------------------------------------- */}
      {/* PDF & DOCUMENT CANVAS ANNOTATOR OVERLAY */}
      {/* ------------------------------------------------------------------- */}
      {isAnnotatorOpen && selectedMaterial && (
        <PdfAnnotationViewer
          material={selectedMaterial}
          onClose={() => setIsAnnotatorOpen(false)}
        />
      )}
    </div>
  );
};
