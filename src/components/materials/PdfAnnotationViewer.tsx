import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import {
  Highlighter,
  Square,
  MessageSquare,
  Eraser,
  MousePointer,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Eye,
  EyeOff,
  RotateCcw,
  Download,
  Trash2,
  Check,
  X,
  Plus,
  Tag,
  Search,
  BookOpen,
  Sparkles,
  AlertCircle,
  Loader2,
  FileText,
  CornerDownRight,
  HelpCircle,
  Pin
} from 'lucide-react';
import {
  StudyMaterial,
  HighlightAnnotation,
  CommentAnnotation,
  HighlightPoint
} from '../../types/app.types.ts';
import { useAuth } from '../../context/AuthContext.tsx';

// Configure PDF.js worker
if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
}

interface PdfAnnotationViewerProps {
  material: StudyMaterial;
  onClose: () => void;
  initialPage?: number;
}

type ActiveTool = 'select' | 'brush' | 'box' | 'comment' | 'eraser';

const HIGHLIGHT_COLORS = [
  { id: 'yellow', name: 'Study Yellow', hex: '#facc15', bg: 'bg-yellow-400', rgba: 'rgba(250, 204, 21, 0.42)' },
  { id: 'green', name: 'Mint Green', hex: '#4ade80', bg: 'bg-green-400', rgba: 'rgba(74, 222, 128, 0.42)' },
  { id: 'blue', name: 'Sky Cyan', hex: '#38bdf8', bg: 'bg-sky-400', rgba: 'rgba(56, 189, 248, 0.42)' },
  { id: 'purple', name: 'Soft Lavender', hex: '#c084fc', bg: 'bg-purple-400', rgba: 'rgba(192, 132, 252, 0.42)' },
  { id: 'pink', name: 'Rose Pink', hex: '#fb7185', bg: 'bg-rose-400', rgba: 'rgba(251, 113, 133, 0.42)' },
];

const BRUSH_SIZES = [
  { label: 'Fine', value: 14 },
  { label: 'Medium', value: 24 },
  { label: 'Broad', value: 38 },
];

const COMMENT_TAGS = ['Question', 'Important', 'Formula', 'Note', 'Summary'] as const;

export const PdfAnnotationViewer: React.FC<PdfAnnotationViewerProps> = ({
  material,
  onClose,
  initialPage = 1,
}) => {
  const { apiFetch, currentUser, profile } = useAuth();

  // Document & Page state
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [totalPages, setTotalPages] = useState(1);
  const [zoomScale, setZoomScale] = useState(1.15);
  const [isLoadingPdf, setIsLoadingPdf] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isTextFallback, setIsTextFallback] = useState(false);

  // Annotations state
  const [highlights, setHighlights] = useState<HighlightAnnotation[]>([]);
  const [comments, setComments] = useState<CommentAnnotation[]>([]);
  const [annotationsVisible, setAnnotationsVisible] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);

  // Toolbar & Drawing state
  const [activeTool, setActiveTool] = useState<ActiveTool>('brush');
  const [activeColor, setActiveColor] = useState(HIGHLIGHT_COLORS[0]);
  const [brushSize, setBrushSize] = useState(BRUSH_SIZES[1].value);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // In-progress interactions
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentStroke, setCurrentStroke] = useState<HighlightPoint[]>([]);
  const [boxStart, setBoxStart] = useState<{ x: number; y: number } | null>(null);
  const [boxCurrent, setBoxCurrent] = useState<{ x: number; y: number } | null>(null);

  // Comment Creation Popover state
  const [pendingCommentPos, setPendingCommentPos] = useState<{ x: number; y: number; pageX: number; pageY: number } | null>(null);
  const [newCommentText, setNewCommentText] = useState('');
  const [newCommentTag, setNewCommentTag] = useState<(typeof COMMENT_TAGS)[number]>('Important');

  // Active Comment Popover View/Edit
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState('');

  // Search & Filter in Comments Drawer
  const [commentSearch, setCommentSearch] = useState('');
  const [commentFilterTag, setCommentFilterTag] = useState<string>('all');

  // DOM Refs
  const containerRef = useRef<HTMLDivElement | null>(null);
  const baseCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewerWrapperRef = useRef<HTMLDivElement | null>(null);

  // Track page dimension
  const [pageDimensions, setPageDimensions] = useState({ width: 800, height: 1100 });

  // -------------------------------------------------------------------------
  // 1. LOAD ANNOTATIONS (API + localStorage fallback)
  // -------------------------------------------------------------------------
  useEffect(() => {
    let isMounted = true;
    const loadSavedAnnotations = async () => {
      // 1. Try local storage first for instant response
      try {
        const localKey = `studyai_annotations_${material.id}`;
        const cached = localStorage.getItem(localKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (isMounted) {
            setHighlights(parsed.highlights || []);
            setComments(parsed.comments || []);
          }
        }
      } catch (e) {
        // ignore
      }

      // 2. Fetch from backend API
      try {
        const res = await apiFetch(`/api/materials/${material.id}/annotations`);
        if (res.ok) {
          const data = await res.json();
          const serverAnnotations = data?.data || data;
          if (isMounted && serverAnnotations) {
            setHighlights(serverAnnotations.highlights || []);
            setComments(serverAnnotations.comments || []);
            setLastSavedTime(serverAnnotations.updatedAt || 'Synced');
          }
        }
      } catch (err) {
        console.warn('Could not load annotations from server, using local fallback:', err);
      }
    };

    loadSavedAnnotations();
    return () => {
      isMounted = false;
    };
  }, [material.id, apiFetch]);

  // -------------------------------------------------------------------------
  // 2. AUTO-SAVE ANNOTATIONS (Debounced)
  // -------------------------------------------------------------------------
  const saveTimeoutRef = useRef<any>(null);
  const saveAnnotations = useCallback(
    (newHighlights: HighlightAnnotation[], newComments: CommentAnnotation[]) => {
      // Update local storage immediately
      try {
        const localKey = `studyai_annotations_${material.id}`;
        localStorage.setItem(
          localKey,
          JSON.stringify({
            materialId: material.id,
            highlights: newHighlights,
            comments: newComments,
            updatedAt: new Date().toISOString(),
          })
        );
      } catch (e) {
        // ignore
      }

      // Debounce server call
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(async () => {
        try {
          setIsSaving(true);
          const res = await apiFetch(`/api/materials/${material.id}/annotations`, {
            method: 'PUT',
            body: JSON.stringify({
              highlights: newHighlights,
              comments: newComments,
            }),
          });
          if (res.ok) {
            setLastSavedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
          }
        } catch (e) {
          console.warn('Failed to save annotations to server:', e);
        } finally {
          setIsSaving(false);
        }
      }, 700);
    },
    [material.id, apiFetch]
  );

  // -------------------------------------------------------------------------
  // 3. LOAD PDF DOCUMENT (or fallback to structured text canvas)
  // -------------------------------------------------------------------------
  useEffect(() => {
    let isCancelled = false;
    setIsLoadingPdf(true);
    setLoadError(null);

    const loadDocument = async () => {
      try {
        if (material.fileType === 'pdf') {
          // Fetch authenticated PDF stream
          const res = await apiFetch(`/api/materials/${material.id}/download`);
          if (!res.ok) {
            throw new Error('PDF file could not be downloaded from server storage.');
          }

          const arrayBuffer = await res.arrayBuffer();
          if (isCancelled) return;

          const loadingTask = pdfjsLib.getDocument({
            data: arrayBuffer,
            cMapUrl: 'https://unpkg.com/pdfjs-dist/cmaps/',
            cMapPacked: true,
          });

          const doc = await loadingTask.promise;
          if (isCancelled) return;

          setPdfDoc(doc);
          setTotalPages(doc.numPages);
          setIsTextFallback(false);
        } else {
          // Structured study notes representation
          setIsTextFallback(true);
          const chunkCount = material.chunks?.length || 1;
          const pages = Math.max(1, Math.ceil(chunkCount / 2));
          setTotalPages(pages);
        }
      } catch (err: any) {
        console.warn('PDF load warning, activating high-fidelity note page fallback:', err);
        setIsTextFallback(true);
        const chunkCount = material.chunks?.length || 1;
        setTotalPages(Math.max(1, Math.ceil(chunkCount / 2)));
      } finally {
        if (!isCancelled) {
          setIsLoadingPdf(false);
        }
      }
    };

    loadDocument();

    return () => {
      isCancelled = true;
    };
  }, [material.id, material.fileType, apiFetch]);

  // -------------------------------------------------------------------------
  // 4. RENDER BASE PAGE (PDF or Fallback Note Page)
  // -------------------------------------------------------------------------
  const renderBasePage = useCallback(async () => {
    const baseCanvas = baseCanvasRef.current;
    if (!baseCanvas) return;
    const ctx = baseCanvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;

    if (pdfDoc && !isTextFallback) {
      try {
        const page = await pdfDoc.getPage(currentPage);
        const viewport = page.getViewport({ scale: zoomScale });

        baseCanvas.width = viewport.width * dpr;
        baseCanvas.height = viewport.height * dpr;
        baseCanvas.style.width = `${viewport.width}px`;
        baseCanvas.style.height = `${viewport.height}px`;

        setPageDimensions({ width: viewport.width, height: viewport.height });

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, viewport.width, viewport.height);

        const renderContext = {
          canvasContext: ctx,
          viewport: viewport,
        };

        await page.render(renderContext).promise;
      } catch (err) {
        console.error('Error rendering PDF page:', err);
      }
    } else {
      // Fallback high-fidelity document page rendering
      const width = Math.min(880, window.innerWidth - 60) * (zoomScale / 1.15);
      const height = width * 1.35; // Standard US Letter / A4 aspect ratio

      baseCanvas.width = width * dpr;
      baseCanvas.height = height * dpr;
      baseCanvas.style.width = `${width}px`;
      baseCanvas.style.height = `${height}px`;

      setPageDimensions({ width, height });

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Clean paper background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);

      // Subtle paper border shadow
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      ctx.strokeRect(0, 0, width, height);

      // Header rule
      ctx.fillStyle = '#4f46e5';
      ctx.fillRect(40, 40, width - 80, 4);

      // Document Title
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
      ctx.fillText(material.title, 40, 75);

      // Document Subtitle / Metadata
      ctx.fillStyle = '#64748b';
      ctx.font = '12px system-ui, sans-serif';
      ctx.fillText(`Course Material • Page ${currentPage} of ${totalPages} • Study Notes`, 40, 98);

      // Divider line
      ctx.strokeStyle = '#f1f5f9';
      ctx.beginPath();
      ctx.moveTo(40, 115);
      ctx.lineTo(width - 40, 115);
      ctx.stroke();

      // Body text / Chunks content
      const chunks = material.chunks || [];
      const chunksForThisPage = chunks.slice((currentPage - 1) * 2, currentPage * 2);

      let currentY = 145;
      ctx.fillStyle = '#1e293b';
      ctx.font = '14px system-ui, sans-serif';

      if (chunksForThisPage.length > 0) {
        chunksForThisPage.forEach((chunk, idx) => {
          ctx.fillStyle = '#4338ca';
          ctx.font = 'bold 13px system-ui, sans-serif';
          ctx.fillText(`Section ${chunk.chunkIndex + 1} (Page Reference: ~${chunk.pageNumber})`, 40, currentY);
          currentY += 22;

          ctx.fillStyle = '#334155';
          ctx.font = '13.5px / 1.6 system-ui, sans-serif';

          // Word wrap text
          const words = chunk.content.split(' ');
          let line = '';
          const maxLineWidth = width - 80;

          for (const word of words) {
            const testLine = line + word + ' ';
            const metrics = ctx.measureText(testLine);
            if (metrics.width > maxLineWidth) {
              ctx.fillText(line, 40, currentY);
              line = word + ' ';
              currentY += 20;
              if (currentY > height - 60) break;
            } else {
              line = testLine;
            }
          }
          if (line) {
            ctx.fillText(line, 40, currentY);
            currentY += 30;
          }
          currentY += 15;
        });
      } else {
        // Raw text content
        ctx.fillStyle = '#334155';
        ctx.font = '13.5px system-ui, sans-serif';
        const lines = (material.rawText || '').split('\n').slice(0, 35);
        for (const rawLine of lines) {
          ctx.fillText(rawLine.slice(0, 90), 40, currentY);
          currentY += 22;
          if (currentY > height - 50) break;
        }
      }

      // Footer
      ctx.fillStyle = '#94a3b8';
      ctx.font = '11px system-ui, sans-serif';
      ctx.fillText(`StudyAI Smart Reader • Page ${currentPage}`, 40, height - 25);
    }
  }, [pdfDoc, isTextFallback, currentPage, zoomScale, totalPages, material]);

  // -------------------------------------------------------------------------
  // 5. RENDER OVERLAY CANVAS (Highlights & Temporary Strokes)
  // -------------------------------------------------------------------------
  const renderOverlayCanvas = useCallback(() => {
    const overlayCanvas = overlayCanvasRef.current;
    if (!overlayCanvas) return;
    const ctx = overlayCanvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const { width, height } = pageDimensions;

    overlayCanvas.width = width * dpr;
    overlayCanvas.height = height * dpr;
    overlayCanvas.style.width = `${width}px`;
    overlayCanvas.style.height = `${height}px`;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    if (!annotationsVisible) return;

    // Filter highlights for current page
    const pageHighlights = highlights.filter((h) => h.pageNumber === currentPage);

    // Render committed highlights
    for (const h of pageHighlights) {
      if (h.type === 'freehand' && h.points && h.points.length > 1) {
        ctx.save();
        ctx.beginPath();
        ctx.strokeStyle = h.color;
        ctx.lineWidth = h.strokeWidth || 20;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.globalAlpha = 0.45;

        const firstPt = h.points[0];
        ctx.moveTo(firstPt.x * width, firstPt.y * height);

        for (let i = 1; i < h.points.length; i++) {
          const pt = h.points[i];
          ctx.lineTo(pt.x * width, pt.y * height);
        }
        ctx.stroke();
        ctx.restore();
      } else if (h.type === 'box' && h.rect) {
        ctx.save();
        const rx = h.rect.x * width;
        const ry = h.rect.y * height;
        const rw = h.rect.width * width;
        const rh = h.rect.height * height;

        // Fill highlight box
        ctx.fillStyle = h.color;
        ctx.globalAlpha = 0.38;
        ctx.fillRect(rx, ry, rw, rh);

        // Highlight border
        ctx.strokeStyle = h.color;
        ctx.globalAlpha = 0.8;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(rx, ry, rw, rh);

        ctx.restore();
      }
    }

    // Render live in-progress freehand stroke
    if (isDrawing && activeTool === 'brush' && currentStroke.length > 1) {
      ctx.save();
      ctx.beginPath();
      ctx.strokeStyle = activeColor.rgba;
      ctx.lineWidth = brushSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalAlpha = 0.45;

      const firstPt = currentStroke[0];
      ctx.moveTo(firstPt.x * width, firstPt.y * height);

      for (let i = 1; i < currentStroke.length; i++) {
        const pt = currentStroke[i];
        ctx.lineTo(pt.x * width, pt.y * height);
      }
      ctx.stroke();
      ctx.restore();
    }

    // Render live in-progress box highlight rubber-band
    if (isDrawing && activeTool === 'box' && boxStart && boxCurrent) {
      ctx.save();
      const rx = Math.min(boxStart.x, boxCurrent.x) * width;
      const ry = Math.min(boxStart.y, boxCurrent.y) * height;
      const rw = Math.abs(boxCurrent.x - boxStart.x) * width;
      const rh = Math.abs(boxCurrent.y - boxStart.y) * height;

      ctx.fillStyle = activeColor.rgba;
      ctx.globalAlpha = 0.35;
      ctx.fillRect(rx, ry, rw, rh);

      ctx.strokeStyle = activeColor.hex;
      ctx.globalAlpha = 0.85;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(rx, ry, rw, rh);
      ctx.restore();
    }
  }, [
    pageDimensions,
    annotationsVisible,
    highlights,
    currentPage,
    isDrawing,
    activeTool,
    currentStroke,
    activeColor,
    brushSize,
    boxStart,
    boxCurrent,
  ]);

  // Re-render canvases when dependencies change
  useEffect(() => {
    renderBasePage();
  }, [renderBasePage]);

  useEffect(() => {
    renderOverlayCanvas();
  }, [renderOverlayCanvas]);

  // -------------------------------------------------------------------------
  // 6. MOUSE & TOUCH EVENT HANDLERS ON OVERLAY CANVAS
  // -------------------------------------------------------------------------
  const getNormalizedCoordinates = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;
    const x = Math.max(0, Math.min(1, clientX / rect.width));
    const y = Math.max(0, Math.min(1, clientY / rect.height));
    return { x, y };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getNormalizedCoordinates(e);

    if (activeTool === 'brush') {
      setIsDrawing(true);
      setCurrentStroke([{ x, y }]);
    } else if (activeTool === 'box') {
      setIsDrawing(true);
      setBoxStart({ x, y });
      setBoxCurrent({ x, y });
    } else if (activeTool === 'comment') {
      // Open comment creation popover
      const canvas = overlayCanvasRef.current;
      const rect = canvas?.getBoundingClientRect();
      const pageX = rect ? e.clientX - rect.left : 0;
      const pageY = rect ? e.clientY - rect.top : 0;
      setPendingCommentPos({ x, y, pageX, pageY });
      setNewCommentText('');
    } else if (activeTool === 'eraser') {
      // Check if clicked near any highlight or box to erase
      const { width, height } = pageDimensions;
      const clickPx = { x: x * width, y: y * height };

      const updatedHighlights = highlights.filter((h) => {
        if (h.pageNumber !== currentPage) return true;
        if (h.type === 'box' && h.rect) {
          const rx = h.rect.x * width;
          const ry = h.rect.y * height;
          const rw = h.rect.width * width;
          const rh = h.rect.height * height;
          const isInside =
            clickPx.x >= rx && clickPx.x <= rx + rw && clickPx.y >= ry && clickPx.y <= ry + rh;
          return !isInside;
        } else if (h.type === 'freehand' && h.points) {
          // Check distance to any point along stroke
          const threshold = (h.strokeWidth || 20) / 1.5;
          const isClose = h.points.some((p) => {
            const px = p.x * width;
            const py = p.y * height;
            const dist = Math.hypot(clickPx.x - px, clickPx.y - py);
            return dist < threshold;
          });
          return !isClose;
        }
        return true;
      });

      if (updatedHighlights.length !== highlights.length) {
        setHighlights(updatedHighlights);
        saveAnnotations(updatedHighlights, comments);
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const { x, y } = getNormalizedCoordinates(e);

    if (activeTool === 'brush') {
      setCurrentStroke((prev) => [...prev, { x, y }]);
    } else if (activeTool === 'box' && boxStart) {
      setBoxCurrent({ x, y });
    }
  };

  const handleMouseUp = () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    if (activeTool === 'brush' && currentStroke.length > 1) {
      const newHighlight: HighlightAnnotation = {
        id: `hl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        type: 'freehand',
        pageNumber: currentPage,
        color: activeColor.rgba,
        strokeWidth: brushSize,
        points: currentStroke,
        createdAt: new Date().toISOString(),
      };
      const updated = [...highlights, newHighlight];
      setHighlights(updated);
      saveAnnotations(updated, comments);
      setCurrentStroke([]);
    } else if (activeTool === 'box' && boxStart && boxCurrent) {
      const x = Math.min(boxStart.x, boxCurrent.x);
      const y = Math.min(boxStart.y, boxCurrent.y);
      const width = Math.abs(boxCurrent.x - boxStart.x);
      const height = Math.abs(boxCurrent.y - boxStart.y);

      // Only save if dragged more than a tiny tap
      if (width > 0.01 && height > 0.01) {
        const newHighlight: HighlightAnnotation = {
          id: `hl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          type: 'box',
          pageNumber: currentPage,
          color: activeColor.rgba,
          strokeWidth: 2,
          rect: { x, y, width, height },
          createdAt: new Date().toISOString(),
        };
        const updated = [...highlights, newHighlight];
        setHighlights(updated);
        saveAnnotations(updated, comments);
      }
      setBoxStart(null);
      setBoxCurrent(null);
    }
  };

  // -------------------------------------------------------------------------
  // 7. COMMENT CREATION & MANAGEMENT
  // -------------------------------------------------------------------------
  const handleCreateComment = () => {
    if (!pendingCommentPos || !newCommentText.trim()) return;

    const newComment: CommentAnnotation = {
      id: `cm_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      pageNumber: currentPage,
      x: pendingCommentPos.x,
      y: pendingCommentPos.y,
      text: newCommentText.trim(),
      tag: newCommentTag,
      color: activeColor.hex,
      author: profile?.displayName || currentUser?.displayName || 'Student',
      createdAt: new Date().toISOString(),
    };

    const updatedComments = [...comments, newComment];
    setComments(updatedComments);
    saveAnnotations(highlights, updatedComments);

    setPendingCommentPos(null);
    setNewCommentText('');
    setActiveCommentId(newComment.id);
  };

  const handleDeleteComment = (id: string) => {
    const updated = comments.filter((c) => c.id !== id);
    setComments(updated);
    saveAnnotations(highlights, updated);
    if (activeCommentId === id) setActiveCommentId(null);
  };

  const handleUpdateCommentText = (id: string, text: string) => {
    const updated = comments.map((c) => (c.id === id ? { ...c, text } : c));
    setComments(updated);
    saveAnnotations(highlights, updated);
  };

  const handleToggleResolveComment = (id: string) => {
    const updated = comments.map((c) => (c.id === id ? { ...c, resolved: !c.resolved } : c));
    setComments(updated);
    saveAnnotations(highlights, updated);
  };

  // -------------------------------------------------------------------------
  // 8. EXPORT ANNOTATED SNAPSHOT
  // -------------------------------------------------------------------------
  const handleExportSnapshot = () => {
    const baseCanvas = baseCanvasRef.current;
    const overlayCanvas = overlayCanvasRef.current;
    if (!baseCanvas || !overlayCanvas) return;

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = baseCanvas.width;
    exportCanvas.height = baseCanvas.height;
    const ctx = exportCanvas.getContext('2d');
    if (!ctx) return;

    // Draw base PDF page
    ctx.drawImage(baseCanvas, 0, 0);
    // Draw annotations overlay
    ctx.drawImage(overlayCanvas, 0, 0);

    // Draw comment pins directly onto the exported snapshot
    const pageComments = comments.filter((c) => c.pageNumber === currentPage);
    pageComments.forEach((cm, index) => {
      const px = cm.x * exportCanvas.width;
      const py = cm.y * exportCanvas.height;

      ctx.save();
      ctx.fillStyle = cm.color || '#4f46e5';
      ctx.beginPath();
      ctx.arc(px, py, 18, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`#${index + 1}`, px, py);
      ctx.restore();
    });

    const link = document.createElement('a');
    link.download = `${material.title.replace(/\s+/g, '_')}_annotated_page_${currentPage}.png`;
    link.href = exportCanvas.toDataURL('image/png');
    link.click();
  };

  // Filtered comments for sidebar
  const currentComments = comments.filter((c) => {
    const matchesPage = c.pageNumber === currentPage;
    const matchesTag = commentFilterTag === 'all' || c.tag === commentFilterTag;
    const matchesSearch =
      !commentSearch ||
      c.text.toLowerCase().includes(commentSearch.toLowerCase()) ||
      (c.tag && c.tag.toLowerCase().includes(commentSearch.toLowerCase()));
    return matchesTag && matchesSearch;
  });

  const currentPageHighlightsCount = highlights.filter((h) => h.pageNumber === currentPage).length;
  const currentPageCommentsCount = comments.filter((c) => c.pageNumber === currentPage).length;

  return (
    <div
      ref={containerRef}
      className={`fixed inset-0 z-50 flex flex-col bg-slate-950 text-slate-100 animate-in fade-in duration-200 select-none ${
        isFullscreen ? 'p-0' : 'p-0 sm:p-2'
      }`}
    >
      {/* ------------------------------------------------------------------- */}
      {/* TOP HEADER & ACTION CONTROLS */}
      {/* ------------------------------------------------------------------- */}
      <header className="px-3 sm:px-5 py-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between gap-2.5 shrink-0 z-20">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
            title="Close viewer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="min-w-0">
            <h2 className="text-xs sm:text-sm font-bold text-white truncate max-w-[180px] sm:max-w-xs md:max-w-md">
              {material.title}
            </h2>
            <div className="flex items-center gap-2 text-[10px] text-slate-400">
              <span className="uppercase font-semibold text-indigo-400">{material.fileType}</span>
              <span>•</span>
              <span>
                {currentPageHighlightsCount} {currentPageHighlightsCount === 1 ? 'Highlight' : 'Highlights'}
              </span>
              <span>•</span>
              <span>
                {currentPageCommentsCount} {currentPageCommentsCount === 1 ? 'Comment' : 'Comments'}
              </span>
              {isSaving ? (
                <span className="text-amber-400 flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" /> Saving...
                </span>
              ) : lastSavedTime ? (
                <span className="text-emerald-400">Saved ✓</span>
              ) : null}
            </div>
          </div>
        </div>

        {/* Page Navigators & Zoom */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Page switch controls */}
          <div className="flex items-center bg-slate-800/90 rounded-xl px-2 py-1 border border-slate-700 text-xs">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="p-1 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 cursor-pointer"
              title="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 font-mono text-slate-200">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="p-1 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 cursor-pointer"
              title="Next Page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Zoom controls */}
          <div className="hidden sm:flex items-center bg-slate-800/90 rounded-xl px-2 py-1 border border-slate-700 text-xs gap-1">
            <button
              onClick={() => setZoomScale((z) => Math.max(0.65, Number((z - 0.15).toFixed(2))))}
              className="p-1 hover:text-white cursor-pointer"
              title="Zoom out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="font-mono text-slate-300 text-[11px] min-w-[38px] text-center">
              {Math.round(zoomScale * 100)}%
            </span>
            <button
              onClick={() => setZoomScale((z) => Math.min(2.2, Number((z + 0.15).toFixed(2))))}
              className="p-1 hover:text-white cursor-pointer"
              title="Zoom in"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Snapshot & Sidebar Toggles */}
          <button
            onClick={handleExportSnapshot}
            className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700 transition cursor-pointer min-h-[36px] flex items-center gap-1.5 text-xs font-semibold"
            title="Download annotated snapshot as image"
          >
            <Download className="w-4 h-4" />
            <span className="hidden md:inline">Export Page</span>
          </button>

          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className={`p-2 rounded-xl border transition cursor-pointer min-h-[36px] flex items-center gap-1.5 text-xs font-bold ${
              isSidebarOpen
                ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                : 'text-slate-300 hover:bg-slate-800 border-slate-700'
            }`}
            title="Toggle comments sidebar"
          >
            <MessageSquare className="w-4 h-4" />
            <span className="hidden sm:inline">Comments</span>
            {comments.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-white/20 text-[10px] font-bold">
                {comments.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="hidden sm:flex p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* ------------------------------------------------------------------- */}
      {/* SECONDARY ANNOTATION TOOLBAR */}
      {/* ------------------------------------------------------------------- */}
      <div className="px-3 sm:px-6 py-2 bg-slate-900/95 border-b border-slate-800 flex items-center justify-between gap-3 overflow-x-auto shrink-0 z-10 touch-scroll">
        {/* Tools: Select, Freehand Brush, Box Highlight, Comment, Eraser */}
        <div className="flex items-center gap-1 sm:gap-1.5 bg-slate-800/80 p-1 rounded-xl border border-slate-700/80">
          <button
            onClick={() => setActiveTool('select')}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTool === 'select'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
            }`}
            title="Select & Pan"
          >
            <MousePointer className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Select</span>
          </button>

          <button
            onClick={() => setActiveTool('brush')}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTool === 'brush'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
            }`}
            title="Freehand Highlighter Pen"
          >
            <Highlighter className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Highlighter</span>
          </button>

          <button
            onClick={() => setActiveTool('box')}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTool === 'box'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
            }`}
            title="Box / Rectangle Highlighter"
          >
            <Square className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Box Highlight</span>
          </button>

          <button
            onClick={() => setActiveTool('comment')}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTool === 'comment'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
            }`}
            title="Drop Comment Pin on Document"
          >
            <Pin className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Add Comment</span>
          </button>

          <button
            onClick={() => setActiveTool('eraser')}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTool === 'eraser'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
            }`}
            title="Erase Highlights or Pins"
          >
            <Eraser className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Eraser</span>
          </button>
        </div>

        {/* Color Palette & Brush Size (Visible when highlighting) */}
        {(activeTool === 'brush' || activeTool === 'box' || activeTool === 'comment') && (
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Color Swatches */}
            <div className="flex items-center gap-1 bg-slate-800/80 p-1 rounded-xl border border-slate-700">
              {HIGHLIGHT_COLORS.map((col) => (
                <button
                  key={col.id}
                  onClick={() => setActiveColor(col)}
                  className={`w-6 h-6 rounded-full transition-all cursor-pointer flex items-center justify-center ${
                    col.bg
                  } ${activeColor.id === col.id ? 'ring-2 ring-white scale-110 shadow-md' : 'opacity-70 hover:opacity-100'}`}
                  title={col.name}
                >
                  {activeColor.id === col.id && <Check className="w-3 h-3 text-slate-900" />}
                </button>
              ))}
            </div>

            {/* Brush Size selector (For freehand highlighter) */}
            {activeTool === 'brush' && (
              <div className="hidden md:flex items-center gap-1 bg-slate-800/80 p-1 rounded-xl border border-slate-700 text-xs">
                {BRUSH_SIZES.map((b) => (
                  <button
                    key={b.value}
                    onClick={() => setBrushSize(b.value)}
                    className={`px-2 py-1 rounded-lg font-semibold transition cursor-pointer ${
                      brushSize === b.value
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Visibility & Undo / Clear */}
        <div className="flex items-center gap-1 sm:gap-2">
          <button
            onClick={() => setAnnotationsVisible(!annotationsVisible)}
            className={`p-1.5 sm:p-2 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1 ${
              annotationsVisible ? 'text-slate-300 hover:text-white' : 'text-amber-400 bg-amber-500/10'
            }`}
            title={annotationsVisible ? 'Hide all highlights & comments' : 'Show annotations'}
          >
            {annotationsVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            <span className="hidden lg:inline">{annotationsVisible ? 'Visible' : 'Hidden'}</span>
          </button>

          <button
            onClick={() => {
              // Undo last highlight on current page
              const pageHls = highlights.filter((h) => h.pageNumber === currentPage);
              if (pageHls.length === 0) return;
              const lastId = pageHls[pageHls.length - 1].id;
              const updated = highlights.filter((h) => h.id !== lastId);
              setHighlights(updated);
              saveAnnotations(updated, comments);
            }}
            disabled={currentPageHighlightsCount === 0}
            className="p-1.5 sm:p-2 rounded-xl text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
            title="Undo last highlight"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* MAIN VIEWPORT: PDF CANVAS CONTAINER + COMMENTS SIDEBAR */}
      {/* ------------------------------------------------------------------- */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Document Page Canvas Scroll Area */}
        <div
          ref={viewerWrapperRef}
          className="flex-1 overflow-auto p-4 sm:p-8 flex items-start justify-center bg-slate-900/60 relative touch-scroll"
        >
          {isLoadingPdf ? (
            <div className="my-auto text-center space-y-3">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-500" />
              <p className="text-sm font-semibold text-slate-300">Rendering document pages...</p>
              <p className="text-xs text-slate-500">Preparing high-resolution PDF canvas overlay</p>
            </div>
          ) : (
            <div
              className="relative shadow-2xl rounded-sm transition-all duration-150"
              style={{
                width: pageDimensions.width,
                height: pageDimensions.height,
              }}
            >
              {/* Base Document Layer (PDF Page or Note Page) */}
              <canvas
                ref={baseCanvasRef}
                className="block absolute inset-0 rounded-sm pointer-events-none"
              />

              {/* Transparent Canvas-Based Overlay Layer (For Highlights & Freehand Drawing) */}
              <canvas
                ref={overlayCanvasRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                className={`block absolute inset-0 rounded-sm ${
                  activeTool === 'brush'
                    ? 'cursor-crosshair'
                    : activeTool === 'box'
                    ? 'cursor-cell'
                    : activeTool === 'comment'
                    ? 'cursor-pointer'
                    : activeTool === 'eraser'
                    ? 'cursor-not-allowed'
                    : 'cursor-default'
                }`}
              />

              {/* Floating Comment Pin Badges directly anchored over the PDF Canvas */}
              {annotationsVisible &&
                comments
                  .filter((c) => c.pageNumber === currentPage)
                  .map((comment, index) => {
                    const isSelected = activeCommentId === comment.id;
                    const leftPx = comment.x * pageDimensions.width;
                    const topPx = comment.y * pageDimensions.height;

                    return (
                      <div
                        key={comment.id}
                        style={{
                          left: `${leftPx}px`,
                          top: `${topPx}px`,
                          transform: 'translate(-50%, -100%)',
                        }}
                        className="absolute z-20 group"
                      >
                        {/* Pin Button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (activeTool === 'eraser') {
                              handleDeleteComment(comment.id);
                            } else {
                              setActiveCommentId(isSelected ? null : comment.id);
                              setEditingCommentText(comment.text);
                            }
                          }}
                          className={`relative flex items-center justify-center rounded-full shadow-lg transition-transform duration-200 cursor-pointer ${
                            isSelected
                              ? 'scale-125 ring-4 ring-white ring-offset-2 ring-offset-slate-900'
                              : 'hover:scale-115'
                          } ${
                            comment.resolved ? 'opacity-60 bg-slate-600' : ''
                          }`}
                          style={{
                            backgroundColor: comment.resolved ? undefined : comment.color || '#f59e0b',
                            width: '28px',
                            height: '28px',
                          }}
                          title={`Comment #${index + 1}: ${comment.text.slice(0, 40)}...`}
                        >
                          <MessageSquare className="w-3.5 h-3.5 text-slate-950 font-bold" />
                          <span className="absolute -bottom-1 -right-1 bg-slate-950 text-white text-[9px] font-black rounded-full px-1 py-0.2">
                            {index + 1}
                          </span>
                        </button>

                        {/* Interactive Comment Card Popover */}
                        {isSelected && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="absolute left-1/2 -translate-x-1/2 top-9 w-64 sm:w-72 p-3.5 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl text-slate-100 text-xs space-y-2 z-30 animate-in fade-in zoom-in-95 duration-150"
                          >
                            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-indigo-400">Pin #{index + 1}</span>
                                {comment.tag && (
                                  <span className="px-1.5 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 text-[10px] font-semibold">
                                    {comment.tag}
                                  </span>
                                )}
                              </div>
                              <button
                                onClick={() => setActiveCommentId(null)}
                                className="p-1 rounded-lg text-slate-400 hover:text-white"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            {/* Comment Body */}
                            <textarea
                              rows={3}
                              value={editingCommentText}
                              onChange={(e) => setEditingCommentText(e.target.value)}
                              onBlur={() => handleUpdateCommentText(comment.id, editingCommentText)}
                              className="w-full bg-slate-800/80 border border-slate-700 rounded-xl p-2.5 text-xs text-white leading-relaxed focus:outline-hidden focus:border-indigo-500"
                              placeholder="Type comment or note..."
                            />

                            {/* Comment Card Footer Actions */}
                            <div className="flex items-center justify-between pt-1">
                              <button
                                type="button"
                                onClick={() => handleToggleResolveComment(comment.id)}
                                className={`flex items-center gap-1 text-[11px] font-semibold cursor-pointer ${
                                  comment.resolved
                                    ? 'text-emerald-400'
                                    : 'text-slate-400 hover:text-slate-200'
                                }`}
                              >
                                <Check className="w-3 h-3" />
                                <span>{comment.resolved ? 'Resolved' : 'Mark Resolved'}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDeleteComment(comment.id)}
                                className="text-rose-400 hover:text-rose-300 flex items-center gap-1 text-[11px] font-semibold cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>Delete</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}

              {/* New Comment Creator Popover (When clicking with Comment Tool) */}
              {pendingCommentPos && (
                <div
                  style={{
                    left: `${pendingCommentPos.pageX}px`,
                    top: `${pendingCommentPos.pageY}px`,
                    transform: 'translate(-50%, 15px)',
                  }}
                  className="absolute z-40 w-72 p-4 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl text-slate-100 text-xs space-y-3 animate-in fade-in zoom-in-95"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white flex items-center gap-1.5">
                      <Pin className="w-3.5 h-3.5 text-amber-400" />
                      <span>Add Comment to Page {currentPage}</span>
                    </span>
                    <button
                      onClick={() => setPendingCommentPos(null)}
                      className="p-1 rounded-lg text-slate-400 hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Tag Selector */}
                  <div className="flex flex-wrap gap-1">
                    {COMMENT_TAGS.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setNewCommentTag(t)}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold transition cursor-pointer ${
                          newCommentTag === t
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>

                  <textarea
                    autoFocus
                    rows={3}
                    value={newCommentText}
                    onChange={(e) => setNewCommentText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                        handleCreateComment();
                      }
                    }}
                    placeholder="Type study note, formula clarification, question..."
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-hidden focus:border-indigo-500 placeholder-slate-500"
                  />

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] text-slate-500">⌘ + Enter to save</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setPendingCommentPos(null)}
                        className="px-2.5 py-1 text-xs text-slate-400 hover:text-white"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={!newCommentText.trim()}
                        onClick={handleCreateComment}
                        className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-bold text-xs shadow-md transition cursor-pointer"
                      >
                        Add Pin
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ----------------------------------------------------------------- */}
        {/* COLLAPSIBLE COMMENTS & ANNOTATIONS SIDEBAR */}
        {/* ----------------------------------------------------------------- */}
        {isSidebarOpen && (
          <aside className="w-80 sm:w-88 bg-slate-900 border-l border-slate-800 flex flex-col shrink-0 z-10 animate-in slide-in-from-right-4 duration-200">
            {/* Sidebar Header */}
            <div className="p-3.5 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-indigo-400" />
                <h3 className="font-bold text-xs sm:text-sm text-white">Document Comments</h3>
                <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-bold text-xs">
                  {comments.length}
                </span>
              </div>
              <button
                onClick={() => setIsSidebarOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
                title="Hide sidebar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Filter & Search Bar */}
            <div className="p-3 space-y-2 border-b border-slate-800 bg-slate-900/60">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search comments..."
                  value={commentSearch}
                  onChange={(e) => setCommentSearch(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              {/* Tag filters */}
              <div className="flex items-center gap-1 overflow-x-auto pb-0.5 touch-scroll">
                <button
                  type="button"
                  onClick={() => setCommentFilterTag('all')}
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold whitespace-nowrap cursor-pointer ${
                    commentFilterTag === 'all'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  All ({comments.length})
                </button>
                {COMMENT_TAGS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setCommentFilterTag(t)}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold whitespace-nowrap cursor-pointer ${
                      commentFilterTag === t
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Comments List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2.5 touch-scroll">
              {currentComments.length === 0 ? (
                <div className="py-12 text-center text-slate-500 space-y-2">
                  <Pin className="w-7 h-7 mx-auto text-slate-600" />
                  <p className="text-xs font-semibold">No comments found</p>
                  <p className="text-[11px] max-w-[200px] mx-auto text-slate-500">
                    Switch to the Comment tool (Pin) and tap anywhere on the PDF page to add notes!
                  </p>
                </div>
              ) : (
                currentComments.map((cm, idx) => {
                  const isSelected = activeCommentId === cm.id;
                  const isCurrentPage = cm.pageNumber === currentPage;

                  return (
                    <div
                      key={cm.id}
                      onClick={() => {
                        if (!isCurrentPage) {
                          setCurrentPage(cm.pageNumber);
                        }
                        setActiveCommentId(cm.id);
                        setEditingCommentText(cm.text);
                      }}
                      className={`p-3 rounded-xl border transition-all cursor-pointer text-left space-y-1.5 ${
                        isSelected
                          ? 'bg-indigo-950/60 border-indigo-500 shadow-md'
                          : 'bg-slate-800/60 hover:bg-slate-800 border-slate-700/80'
                      } ${cm.resolved ? 'opacity-60' : ''}`}
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: cm.color || '#f59e0b' }}
                          />
                          <span className="font-bold text-white">Page {cm.pageNumber}</span>
                          {cm.tag && (
                            <span className="px-1.5 py-0.2 rounded-md bg-indigo-500/20 text-indigo-300 font-semibold text-[10px]">
                              {cm.tag}
                            </span>
                          )}
                        </div>

                        <span className="text-[10px] text-slate-400">
                          {new Date(cm.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      <p className="text-xs text-slate-200 leading-relaxed break-words">
                        {cm.text}
                      </p>

                      <div className="flex items-center justify-between pt-1 border-t border-slate-700/50 text-[10px]">
                        <span className={cm.resolved ? 'text-emerald-400 font-medium' : 'text-slate-500'}>
                          {cm.resolved ? 'Resolved ✓' : 'Active'}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteComment(cm.id);
                          }}
                          className="text-slate-400 hover:text-rose-400 p-0.5"
                          title="Delete comment"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Sidebar Footer Hint */}
            <div className="p-3 border-t border-slate-800 bg-slate-900/90 text-[11px] text-slate-400 flex items-center justify-between">
              <span>💡 Tap Pin icon to add notes</span>
              <button
                type="button"
                onClick={() => {
                  setActiveTool('comment');
                }}
                className="text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Pin</span>
              </button>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
};
