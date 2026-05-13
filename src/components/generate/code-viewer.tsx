"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { GenerateResultFile } from "@/lib/types";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

interface CodeViewerProps {
  file: GenerateResultFile | null;
}

/**
 * Lightweight code viewer with a hand-rolled tokenizer for HTML/CSS/JS.
 * We avoid heavy syntax-highlighter bundles since the build needs to stay lean.
 */
export function CodeViewer({ file }: CodeViewerProps) {
  const [copied, setCopied] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [file?.path]);

  const lines = useMemo(() => {
    if (!file) return [];
    return file.content.split("\n");
  }, [file]);

  if (!file) {
    return (
      <div className="h-full grid place-items-center text-subtle">
        Select a file from the explorer.
      </div>
    );
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(file!.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* no-op */
    }
  }

  return (
    <div className="h-full flex flex-col">
      <div className="h-9 px-3 border-b border-border flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 text-muted">
          <span className="font-mono text-foreground">{file.path}</span>
          <span className="text-subtle">·</span>
          <span className="uppercase tracking-wider">{file.language}</span>
          <span className="text-subtle">·</span>
          <span>{lines.length} lines</span>
        </div>
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-muted hover:text-foreground hover:bg-white/5 transition-colors"
          aria-label="Copy code"
        >
          {copied ? (
            <Check className="w-3.5 h-3.5 text-accent" />
          ) : (
            <Copy className="w-3.5 h-3.5" />
          )}
          <span className="text-xs">{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-auto scroll-soft bg-dots font-mono text-[12.5px] leading-6">
        <pre className="min-w-max">
          <code>
            {lines.map((line, i) => (
              <div key={i} className="flex">
                <span className="select-none text-subtle pr-4 pl-3 text-right w-12 shrink-0">
                  {i + 1}
                </span>
                <span
                  className={cn("pr-6 whitespace-pre", lineClass())}
                  dangerouslySetInnerHTML={{ __html: tokenize(line, file.language) || "&nbsp;" }}
                />
              </div>
            ))}
          </code>
        </pre>
      </div>
    </div>
  );
}

function lineClass(): string {
  return "text-foreground/90";
}

/**
 * Minimal single-pass tokenizer. We build a typed token list first
 * (no nested replacements that fight each other), then HTML-escape and
 * wrap each token. Supports html, css, javascript and json reasonably.
 */
type TokenKind = "string" | "comment" | "keyword" | "tag" | "attr" | "prop" | "selector" | "punct" | "number" | "text";
interface Token { kind: TokenKind; text: string }

const COLOR: Record<TokenKind, string> = {
  string: "#c8e8d4",
  comment: "#5a5a55",
  keyword: "#f0c861",
  tag: "#b8e3c9",
  attr: "#9bb6f0",
  prop: "#9bb6f0",
  selector: "#b8e3c9",
  punct: "#9aa0a6",
  number: "#e0a890",
  text: "inherit",
};

const KEYWORDS_JS = new Set([
  "const","let","var","function","return","if","else","for","while","class","extends","new",
  "import","from","export","default","async","await","true","false","null","undefined",
  "this","typeof","instanceof","try","catch","finally","throw","switch","case","break","continue","of","in",
]);

function htmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function tokenize(line: string, lang: string): string {
  let tokens: Token[];
  if (lang === "html") tokens = tokenizeHtml(line);
  else if (lang === "css") tokens = tokenizeCss(line);
  else if (lang === "javascript") tokens = tokenizeJs(line);
  else if (lang === "json") tokens = tokenizeJs(line);
  else tokens = [{ kind: "text", text: line }];

  return tokens
    .map((t) => {
      const safe = htmlEscape(t.text);
      if (t.kind === "text") return safe;
      const color = COLOR[t.kind];
      const italic = t.kind === "comment" ? ";font-style:italic" : "";
      return `<span style="color:${color}${italic}">${safe}</span>`;
    })
    .join("");
}

function tokenizeHtml(line: string): Token[] {
  const out: Token[] = [];
  // Pattern: tag, attribute, string, comment, text.
  const re =
    /(<!--[\s\S]*?-->)|(<\/?)([a-zA-Z][\w-]*)|([a-zA-Z-]+)(?==)|("[^"]*"|'[^']*')|([^<"']+)/g;
  let m: RegExpExecArray | null;
  let last = 0;
  while ((m = re.exec(line)) !== null) {
    if (m.index > last) out.push({ kind: "text", text: line.slice(last, m.index) });
    if (m[1]) out.push({ kind: "comment", text: m[1] });
    else if (m[2]) {
      out.push({ kind: "punct", text: m[2] });
      out.push({ kind: "tag", text: m[3] });
    } else if (m[4]) out.push({ kind: "attr", text: m[4] });
    else if (m[5]) out.push({ kind: "string", text: m[5] });
    else if (m[6]) out.push({ kind: "text", text: m[6] });
    last = re.lastIndex;
  }
  if (last < line.length) out.push({ kind: "text", text: line.slice(last) });
  return out;
}

function tokenizeCss(line: string): Token[] {
  const out: Token[] = [];
  // Comment first
  const commentMatch = /\/\*[\s\S]*?\*\//.exec(line);
  if (commentMatch && commentMatch.index === 0) {
    out.push({ kind: "comment", text: commentMatch[0] });
    return out;
  }
  // Property line: "  property: value;"
  const propMatch = /^(\s*)([a-zA-Z-]+)(\s*:\s*)(.*?)(;?)\s*$/.exec(line);
  if (propMatch) {
    if (propMatch[1]) out.push({ kind: "text", text: propMatch[1] });
    out.push({ kind: "prop", text: propMatch[2] });
    out.push({ kind: "punct", text: propMatch[3] });
    out.push(...tokenizeCssValue(propMatch[4]));
    if (propMatch[5]) out.push({ kind: "punct", text: propMatch[5] });
    return out;
  }
  // Selector ending in { or rule open/close
  if (/[{}]/.test(line) || /^[\s.#@:&*\w-,>+~()[\]="'\s]+$/.test(line)) {
    const braceMatch = /^(.*?)([{}])(.*)$/.exec(line);
    if (braceMatch) {
      if (braceMatch[1]) out.push({ kind: "selector", text: braceMatch[1] });
      out.push({ kind: "punct", text: braceMatch[2] });
      if (braceMatch[3]) out.push({ kind: "text", text: braceMatch[3] });
      return out;
    }
    out.push({ kind: "selector", text: line });
    return out;
  }
  out.push({ kind: "text", text: line });
  return out;
}

function tokenizeCssValue(s: string): Token[] {
  const out: Token[] = [];
  const re = /("[^"]*"|'[^']*'|#[0-9a-fA-F]{3,8}\b|-?\d+(?:\.\d+)?[a-z%]*|[A-Za-z_-]+|[(),])/g;
  let m: RegExpExecArray | null;
  let last = 0;
  while ((m = re.exec(s)) !== null) {
    if (m.index > last) out.push({ kind: "text", text: s.slice(last, m.index) });
    const t = m[1];
    if (t.startsWith('"') || t.startsWith("'")) out.push({ kind: "string", text: t });
    else if (t.startsWith("#") || /^\d/.test(t) || /^-?\d/.test(t)) out.push({ kind: "number", text: t });
    else if (t === "(" || t === ")" || t === ",") out.push({ kind: "punct", text: t });
    else out.push({ kind: "text", text: t });
    last = re.lastIndex;
  }
  if (last < s.length) out.push({ kind: "text", text: s.slice(last) });
  return out;
}

function tokenizeJs(line: string): Token[] {
  const out: Token[] = [];
  const re =
    /(\/\/.*$)|(\/\*[\s\S]*?\*\/)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|(\b\d+(?:\.\d+)?\b)|(\b[A-Za-z_$][\w$]*\b)|([{}();,.[\]:=+\-*/<>!?&|]+)|(\s+)/g;
  let m: RegExpExecArray | null;
  let last = 0;
  while ((m = re.exec(line)) !== null) {
    if (m.index > last) out.push({ kind: "text", text: line.slice(last, m.index) });
    if (m[1]) out.push({ kind: "comment", text: m[1] });
    else if (m[2]) out.push({ kind: "comment", text: m[2] });
    else if (m[3]) out.push({ kind: "string", text: m[3] });
    else if (m[4]) out.push({ kind: "number", text: m[4] });
    else if (m[5]) {
      if (KEYWORDS_JS.has(m[5])) out.push({ kind: "keyword", text: m[5] });
      else out.push({ kind: "text", text: m[5] });
    } else if (m[6]) out.push({ kind: "punct", text: m[6] });
    else if (m[7]) out.push({ kind: "text", text: m[7] });
    last = re.lastIndex;
  }
  if (last < line.length) out.push({ kind: "text", text: line.slice(last) });
  return out;
}
