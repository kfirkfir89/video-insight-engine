import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Copy, Check, Play, Square, FileCode } from 'lucide-react';
import type { TechSnippet } from '@vie/types';

import { cn } from '@/lib/utils';
import {
  GlassCard,
  FadeIn,
  BackForward,
  Badge,
  Timestamp,
  VisualEvidence,
} from '@/components/vie';
import { useLabels } from '@/lib/i18n';

interface CodePlaygroundProps {
  snippets: TechSnippet[];
  onSeek?: (seconds: number) => void;
}

type ConsoleEntry = { type: 'log' | 'error' | 'warn'; text: string };

const RUNNABLE_LANGS = new Set(['javascript', 'typescript', 'jsx', 'tsx', 'js', 'ts']);
const MAX_CONSOLE_LINES = 100;

const JS_KEYWORDS = new Set([
  'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while',
  'do', 'switch', 'case', 'break', 'continue', 'new', 'class', 'extends',
  'this', 'super', 'import', 'export', 'from', 'as', 'default', 'async',
  'await', 'try', 'catch', 'finally', 'throw', 'typeof', 'instanceof',
  'in', 'of', 'null', 'undefined', 'true', 'false', 'void', 'delete',
  'yield', 'static',
]);

const PY_KEYWORDS = new Set([
  'def', 'return', 'if', 'elif', 'else', 'for', 'while', 'break', 'continue',
  'pass', 'import', 'from', 'as', 'class', 'try', 'except', 'finally',
  'raise', 'with', 'yield', 'lambda', 'global', 'nonlocal', 'in', 'is',
  'not', 'and', 'or', 'True', 'False', 'None', 'async', 'await',
]);

const BASH_KEYWORDS = new Set([
  'if', 'then', 'else', 'fi', 'for', 'in', 'do', 'done', 'while', 'case',
  'esac', 'function', 'return', 'export', 'echo', 'cd', 'ls', 'mkdir', 'rm',
]);

function getKeywordSet(lang: string): Set<string> | null {
  const norm = lang.toLowerCase();
  if (['javascript', 'typescript', 'jsx', 'tsx', 'js', 'ts'].includes(norm)) {
    return JS_KEYWORDS;
  }
  if (norm === 'python' || norm === 'py') return PY_KEYWORDS;
  if (norm === 'bash' || norm === 'sh' || norm === 'shell') return BASH_KEYWORDS;
  return null;
}

/**
 * Tokenize and color: comments, strings, then keywords. Pure regex — no deps.
 * Returns a flat list of styled spans + plain text nodes.
 */
function highlightCode(code: string, lang: string): ReactNode[] {
  const keywords = getKeywordSet(lang);
  if (!keywords) return [code];

  const isPython = lang.toLowerCase() === 'python' || lang.toLowerCase() === 'py';
  const isBash = ['bash', 'sh', 'shell'].includes(lang.toLowerCase());

  // Token regex: comments, strings, identifiers, then everything else.
  // Order matters — comments and strings must come first.
  const commentPattern = isPython || isBash ? '#[^\\n]*' : '\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/';
  const stringPattern = '"(?:\\\\.|[^"\\\\\\n])*"|\'(?:\\\\.|[^\'\\\\\\n])*\'|`(?:\\\\.|[^`\\\\])*`';
  const identPattern = '[A-Za-z_][A-Za-z0-9_]*';
  const otherPattern = '\\s+|[^A-Za-z_\\s]';

  const tokenRe = new RegExp(
    `(${commentPattern})|(${stringPattern})|(${identPattern})|(${otherPattern})`,
    'g',
  );

  const out: ReactNode[] = [];
  let m: RegExpExecArray | null;
  let i = 0;
  let key = 0;
  while ((m = tokenRe.exec(code)) !== null) {
    if (m.index > i) {
      out.push(code.slice(i, m.index));
    }
    const [, comment, str, ident, other] = m;
    if (comment !== undefined) {
      out.push(
        <span key={key++} className="text-code-comment italic">
          {comment}
        </span>,
      );
    } else if (str !== undefined) {
      out.push(
        <span key={key++} className="text-code-string">
          {str}
        </span>,
      );
    } else if (ident !== undefined) {
      if (keywords.has(ident)) {
        out.push(
          <span key={key++} className="text-code-keyword font-medium">
            {ident}
          </span>,
        );
      } else {
        out.push(ident);
      }
    } else if (other !== undefined) {
      out.push(other);
    }
    i = m.index + m[0].length;
  }
  if (i < code.length) out.push(code.slice(i));
  return out;
}

/**
 * Build the iframe srcDoc that runs the snippet. We escape `</script>`
 * sequences so a malicious snippet can't break out of the script tag.
 * Sandbox is `allow-scripts` only — no same-origin, no top-nav.
 */
function buildSandboxSrcDoc(code: string): string {
  const safeCode = code.replace(/<\/script/gi, '<\\/script');
  return `<!doctype html><html><head><meta charset="utf-8"></head><body><script>
(function() {
  function send(type, args) {
    try { parent.postMessage({ __viePlayground: true, type: type, args: args.map(String) }, '*'); } catch (e) {}
  }
  console.log = function() { send('log', Array.prototype.slice.call(arguments)); };
  console.warn = function() { send('warn', Array.prototype.slice.call(arguments)); };
  console.error = function() { send('error', Array.prototype.slice.call(arguments)); };
  window.onerror = function(msg) { send('error', [String(msg)]); return true; };
  try {
${safeCode}
  } catch (e) {
    send('error', [e && e.message ? e.message : String(e)]);
  }
})();
</script></body></html>`;
}

interface SnippetCardProps {
  snippet: TechSnippet;
  index: number;
  onSeek?: (seconds: number) => void;
}

const SnippetCard = memo(function SnippetCard({
  snippet,
  index,
  onSeek,
}: SnippetCardProps) {
  const t = useLabels();
  const [copied, setCopied] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [consoleLines, setConsoleLines] = useState<ConsoleEntry[]>([]);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Loose-typed extras: assemblers may inject frame fields without
  // touching the canonical TechSnippet type.
  const extras = snippet as unknown as Record<string, unknown>;
  const thumbnailUrl = typeof extras.thumbnailUrl === 'string' ? extras.thumbnailUrl : undefined;
  const frameCaption = typeof extras.frameCaption === 'string' ? extras.frameCaption : undefined;
  const ocr = typeof extras.ocr === 'string' ? extras.ocr : undefined;
  const sceneType = typeof extras.sceneType === 'string' ? extras.sceneType : undefined;

  // `language` may be absent on loosely-typed assembler output — default to ''
  // so highlighting/run-detection degrade to plain text instead of throwing.
  const language = snippet.language ?? '';
  const canRun = RUNNABLE_LANGS.has(language.toLowerCase());

  useEffect(() => () => {
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
  }, []);

  // Listen for messages from the sandboxed iframe.
  useEffect(() => {
    if (!isRunning) return;
    const handler = (event: MessageEvent) => {
      // Only accept messages from THIS card's sandboxed iframe — otherwise a
      // sibling playground (or any other frame) bleeds output into this console.
      if (event.source !== iframeRef.current?.contentWindow) return;
      const data = event.data as
        | { __viePlayground?: boolean; type?: string; args?: string[] }
        | null;
      if (!data || !data.__viePlayground) return;
      const type = data.type === 'error' || data.type === 'warn' ? data.type : 'log';
      const text = (data.args ?? []).join(' ');
      setConsoleLines((prev) => {
        const next = [...prev, { type, text } as ConsoleEntry];
        return next.length > MAX_CONSOLE_LINES
          ? next.slice(next.length - MAX_CONSOLE_LINES)
          : next;
      });
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [isRunning]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(snippet.code);
      setCopied(true);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable in this context.
    }
  }, [snippet.code]);

  const handleRun = useCallback(() => {
    setConsoleLines([]);
    setIsRunning(true);
  }, []);

  const handleStop = useCallback(() => {
    setIsRunning(false);
  }, []);

  const srcDoc = useMemo(
    () => (isRunning ? buildSandboxSrcDoc(snippet.code) : ''),
    [isRunning, snippet.code],
  );

  const highlighted = useMemo(
    () => highlightCode(snippet.code, language),
    [snippet.code, language],
  );

  const header = snippet.filename ?? `Snippet ${index + 1}`;

  return (
    <GlassCard variant="default" className="space-y-3 p-0 overflow-hidden">
      <div className="flex items-center gap-2 px-4 pt-4">
        <FileCode
          className="h-3.5 w-3.5 text-[color:var(--vie-accent)]"
          aria-hidden="true"
        />
        <span className="text-xs font-mono text-muted-foreground truncate">
          {header}
        </span>
        <Badge variant="muted" className="ms-auto text-[10px]">
          {language || 'text'}
        </Badge>
      </div>

      <div className="px-4 space-y-2">
        <p className="text-sm text-muted-foreground leading-snug">{snippet.explanation}</p>
        {snippet.timestamp != null && onSeek && (
          <Timestamp seconds={snippet.timestamp} onClick={() => onSeek(snippet.timestamp!)} />
        )}
      </div>

      {(thumbnailUrl || frameCaption || ocr) && (
        <div className="px-4">
          <VisualEvidence
            variant="compact"
            thumbnailUrl={thumbnailUrl}
            caption={frameCaption}
            ocr={ocr}
            sceneType={sceneType}
            timestamp={snippet.timestamp}
            onSeek={onSeek}
          />
        </div>
      )}

      <div className="relative mx-3 rounded-lg bg-code-bg text-code-text overflow-hidden">
        <div className="absolute top-2 end-2 z-10 flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleCopy}
            aria-label={copied ? t.copied : t.copy}
            className={cn(
              'flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors',
              copied
                ? 'bg-success/20 text-success'
                : 'bg-code-border text-code-text-muted hover:bg-code-focus hover:text-code-text-bright',
            )}
          >
            {copied ? (
              <>
                <Check className="h-3 w-3" aria-hidden="true" /> {t.copied}!
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" aria-hidden="true" /> {t.copy}
              </>
            )}
          </button>
          {canRun && (
            <button
              type="button"
              onClick={isRunning ? handleStop : handleRun}
              aria-label={isRunning ? 'Stop' : 'Run'}
              className={cn(
                'flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors',
                isRunning
                  ? 'bg-destructive/20 text-destructive hover:bg-destructive/30'
                  : 'bg-primary/20 text-primary hover:bg-primary/30',
              )}
            >
              {isRunning ? (
                <>
                  <Square className="h-3 w-3 fill-current" aria-hidden="true" /> Stop
                </>
              ) : (
                <>
                  <Play className="h-3 w-3 fill-current" aria-hidden="true" /> Run
                </>
              )}
            </button>
          )}
        </div>
        <pre
          dir="ltr"
          className="overflow-x-auto p-3 pe-24 sm:p-4 sm:pe-32 text-sm leading-relaxed"
        >
          <code className="font-mono whitespace-pre-wrap">{highlighted}</code>
        </pre>
      </div>

      {isRunning && (
        <div className="mx-3 mb-3 rounded-lg border border-border/40 bg-muted/20 overflow-hidden">
          <div className="flex items-center justify-between border-b border-border/40 px-3 py-1.5">
            <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/80">
              Sandbox output
            </span>
            <span className="text-[10px] tabular-nums text-muted-foreground/70">
              {consoleLines.length}/{MAX_CONSOLE_LINES}
            </span>
          </div>
          <iframe
            ref={iframeRef}
            title="code-sandbox"
            sandbox="allow-scripts"
            srcDoc={srcDoc}
            className="hidden"
            aria-hidden="true"
          />
          <div
            dir="ltr"
            className="max-h-48 overflow-y-auto p-2 font-mono text-xs space-y-0.5"
            role="log"
            aria-live="polite"
          >
            {consoleLines.length === 0 && (
              <span className="text-muted-foreground/60 italic">Waiting for output…</span>
            )}
            {consoleLines.map((line, i) => (
              <div
                key={i}
                className={cn(
                  'whitespace-pre-wrap break-words',
                  line.type === 'error' && 'text-destructive',
                  line.type === 'warn' && 'text-warning',
                  line.type === 'log' && 'text-foreground/85',
                )}
              >
                {line.text}
              </div>
            ))}
          </div>
        </div>
      )}
    </GlassCard>
  );
});

/**
 * Single-snippet code viewer with prev/next nav, copy, optional sandboxed
 * "Run" for JS/TS, and a simple regex-based syntax highlighter that supports
 * JS/TS/JSX/TSX, Python, and Bash. Other languages render as plain code.
 */
export const CodePlayground = memo(function CodePlayground({
  snippets,
  onSeek,
}: CodePlaygroundProps) {
  const t = useLabels();
  const [currentIndex, setCurrentIndex] = useState(0);
  const total = snippets.length;

  if (total === 0) return null;

  const snippet = snippets[currentIndex];

  return (
    <div className="space-y-4">
      {total > 1 && (
        <BackForward
          onBack={() => setCurrentIndex((i) => Math.max(0, i - 1))}
          onForward={() => setCurrentIndex((i) => Math.min(total - 1, i + 1))}
          backDisabled={currentIndex === 0}
          forwardDisabled={currentIndex === total - 1}
          backLabel={t.previous}
          forwardLabel={t.next}
        />
      )}

      <FadeIn key={currentIndex}>
        <SnippetCard snippet={snippet} index={currentIndex} onSeek={onSeek} />
      </FadeIn>

      {total > 1 && (
        <p className="text-center text-xs text-muted-foreground tabular-nums">
          {currentIndex + 1} / {total}
        </p>
      )}
    </div>
  );
});
