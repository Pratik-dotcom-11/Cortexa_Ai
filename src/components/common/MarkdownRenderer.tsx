import React, { useState } from 'react';
import { Copy, Check, Terminal, ExternalLink } from 'lucide-react';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  className = '',
}) => {
  if (!content) return null;

  // Split into code blocks vs standard text blocks
  const parts = content.split(/(```[\s\S]*?```)/g);

  return (
    <div className={`space-y-3 leading-relaxed text-slate-800 dark:text-slate-200 text-xs sm:text-sm ${className}`}>
      {parts.map((part, index) => {
        if (part.startsWith('```') && part.endsWith('```')) {
          const lines = part.slice(3, -3).trim().split('\n');
          const firstLine = lines[0].trim();
          const hasLang = /^[a-zA-Z0-9_#+-]+$/.test(firstLine);
          const language = hasLang ? firstLine : 'code';
          const codeBody = hasLang ? lines.slice(1).join('\n') : lines.join('\n');

          return (
            <CodeBlock key={index} code={codeBody} language={language} />
          );
        }

        return <TextBlock key={index} text={part} />;
      })}
    </div>
  );
};

const CodeBlock: React.FC<{ code: string; language: string }> = ({ code, language }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-3 rounded-xl overflow-hidden bg-slate-900 dark:bg-slate-950 border border-slate-700/60 dark:border-slate-800 shadow-md">
      <div className="flex items-center justify-between px-3.5 py-1.5 bg-slate-800/90 dark:bg-slate-900/90 border-b border-slate-700/60 dark:border-slate-800 text-[11px] font-mono text-slate-300 dark:text-slate-400">
        <div className="flex items-center gap-1.5">
          <Terminal className="w-3.5 h-3.5 text-indigo-400" />
          <span className="uppercase font-semibold tracking-wider">{language}</span>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-700/50 hover:bg-slate-700 text-slate-200 hover:text-white dark:bg-slate-800 dark:hover:bg-slate-750 transition cursor-pointer text-[11px]"
          title="Copy code to clipboard"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-emerald-400" />
              <span className="text-emerald-400 font-semibold">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span>Copy Code</span>
            </>
          )}
        </button>
      </div>
      <div className="p-3.5 overflow-x-auto text-xs font-mono text-slate-100 leading-relaxed bg-slate-900 dark:bg-slate-950 touch-scroll">
        <pre className="font-mono text-xs whitespace-pre-wrap break-words">{code}</pre>
      </div>
    </div>
  );
};

const TextBlock: React.FC<{ text: string }> = ({ text }) => {
  const paragraphs = text.split(/\n\n+/);

  return (
    <>
      {paragraphs.map((para, pIdx) => {
        const trimmed = para.trim();
        if (!trimmed) return null;

        // Block Math ($$ ... $$)
        if (trimmed.startsWith('$$') && trimmed.endsWith('$$')) {
          const mathContent = trimmed.slice(2, -2).trim();
          return (
            <div
              key={pIdx}
              className="my-3 p-3 rounded-xl bg-indigo-50/80 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-500/30 text-indigo-900 dark:text-indigo-200 font-mono text-xs sm:text-sm overflow-x-auto text-center touch-scroll"
            >
              {mathContent}
            </div>
          );
        }

        // Horizontal Rule (--- or ***)
        if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
          return <hr key={pIdx} className="my-4 border-slate-200 dark:border-slate-800" />;
        }

        // Heading 1 (# ...)
        if (trimmed.startsWith('# ')) {
          return (
            <h1 key={pIdx} className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white mt-4 mb-2 tracking-tight">
              {renderInline(trimmed.slice(2))}
            </h1>
          );
        }

        // Heading 2 (## ...)
        if (trimmed.startsWith('## ')) {
          return (
            <h2 key={pIdx} className="text-base sm:text-lg font-bold text-indigo-900 dark:text-indigo-200 mt-3.5 mb-1.5 tracking-tight">
              {renderInline(trimmed.slice(3))}
            </h2>
          );
        }

        // Heading 3 (### ...)
        if (trimmed.startsWith('### ')) {
          return (
            <h3 key={pIdx} className="text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100 mt-2.5 mb-1 tracking-tight">
              {renderInline(trimmed.slice(4))}
            </h3>
          );
        }

        // Blockquote (> ...)
        if (trimmed.startsWith('> ')) {
          return (
            <blockquote
              key={pIdx}
              className="pl-3.5 py-1.5 my-2 border-l-3 border-indigo-500 bg-indigo-500/5 dark:bg-indigo-500/10 text-slate-700 dark:text-slate-300 italic text-xs sm:text-sm rounded-r-lg"
            >
              {renderInline(trimmed.slice(2))}
            </blockquote>
          );
        }

        // Check for Markdown Table
        const lines = trimmed.split('\n');
        const isTable =
          lines.length >= 2 &&
          lines[0].includes('|') &&
          lines[1].includes('|') &&
          lines[1].includes('-');

        if (isTable) {
          return <TableBlock key={pIdx} lines={lines} />;
        }

        // Unordered or Ordered Lists
        const isList = lines.every(
          (l) =>
            l.trim().startsWith('- ') ||
            l.trim().startsWith('* ') ||
            /^\d+\.\s/.test(l.trim()) ||
            l.trim() === '',
        );

        if (isList) {
          const isOrdered = /^\d+\.\s/.test(lines[0].trim());
          if (isOrdered) {
            return (
              <ol key={pIdx} className="list-decimal list-outside pl-5 space-y-1.5 text-xs sm:text-sm text-slate-700 dark:text-slate-300 my-2">
                {lines.map((line, lIdx) => {
                  const cleaned = line.replace(/^\d+\.\s+/, '').trim();
                  if (!cleaned) return null;
                  return <li key={lIdx}>{renderInline(cleaned)}</li>;
                })}
              </ol>
            );
          }
          return (
            <ul key={pIdx} className="list-disc list-outside pl-5 space-y-1.5 text-xs sm:text-sm text-slate-700 dark:text-slate-300 my-2">
              {lines.map((line, lIdx) => {
                const cleaned = line.replace(/^[-*]\s+/, '').trim();
                if (!cleaned) return null;
                return <li key={lIdx}>{renderInline(cleaned)}</li>;
              })}
            </ul>
          );
        }

        // Standard Paragraph with Line Breaks
        return (
          <p key={pIdx} className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
            {lines.map((l, lineIdx) => (
              <React.Fragment key={lineIdx}>
                {renderInline(l)}
                {lineIdx < lines.length - 1 && <br />}
              </React.Fragment>
            ))}
          </p>
        );
      })}
    </>
  );
};

const TableBlock: React.FC<{ lines: string[] }> = ({ lines }) => {
  const parseRow = (rowStr: string) =>
    rowStr
      .split('|')
      .map((s) => s.trim())
      .filter((s, idx, arr) => (idx === 0 && s === '') || (idx === arr.length - 1 && s === '') ? false : true);

  const headerCells = parseRow(lines[0]);
  const bodyRows = lines.slice(2).filter((l) => l.trim().length > 0).map(parseRow);

  return (
    <div className="my-3 overflow-x-auto rounded-xl border border-border shadow-xs touch-scroll">
      <table className="w-full text-left text-xs border-collapse">
        <thead className="bg-[#f0f3fa] dark:bg-slate-900 border-b border-border">
          <tr>
            {headerCells.map((h, i) => (
              <th key={i} className="py-2 px-3 font-semibold text-slate-900 dark:text-white">
                {renderInline(h)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-surface">
          {bodyRows.map((row, rIdx) => (
            <tr key={rIdx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition">
              {row.map((cell, cIdx) => (
                <td key={cIdx} className="py-2 px-3 text-slate-700 dark:text-slate-300">
                  {renderInline(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

function renderInline(str: string): React.ReactNode {
  // Regex to split bold (**text**), inline code (`code`), math ($formula$), citations ([Source: ...])
  const parts = str.split(/(\*\*.*?\*\*|`.*?`|\$.*?\$|\[Source:.*?\]|\[Sources:.*?\]|\[.*?\]\(.*?\))/g);

  return parts.map((part, i) => {
    // Bold
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="font-semibold text-slate-900 dark:text-slate-100">
          {part.slice(2, -2)}
        </strong>
      );
    }

    // Inline Code
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code
          key={i}
          className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 font-mono text-[11px] sm:text-xs border border-slate-200 dark:border-slate-700/60 font-medium"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    // Inline Math
    if (part.startsWith('$') && part.endsWith('$')) {
      return (
        <span
          key={i}
          className="px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-800 dark:text-amber-300 font-mono text-[11px] sm:text-xs border border-amber-500/25 italic"
        >
          {part.slice(1, -1)}
        </span>
      );
    }

    // Citation Bracket
    if ((part.startsWith('[Source:') || part.startsWith('[Sources:')) && part.endsWith(']')) {
      return (
        <span
          key={i}
          className="inline-flex items-center gap-1 mx-1 px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 text-[10px] font-mono border border-emerald-500/30 font-medium"
        >
          {part}
        </span>
      );
    }

    // Link [text](url)
    const linkMatch = part.match(/^\[(.*?)\]\((.*?)\)$/);
    if (linkMatch) {
      const linkText = linkMatch[1];
      const linkHref = linkMatch[2];
      return (
        <a
          key={i}
          href={linkHref}
          target="_blank"
          rel="noopener noreferrer"
          className="text-indigo-600 dark:text-indigo-400 underline underline-offset-2 hover:text-indigo-700 inline-flex items-center gap-0.5"
        >
          <span>{linkText}</span>
          <ExternalLink className="w-3 h-3 inline" />
        </a>
      );
    }

    return part;
  });
}
