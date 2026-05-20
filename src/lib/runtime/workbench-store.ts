/**
 * WorkbenchStore — Zustand-стор для виртуальной файловой системы.
 *
 * Адаптирован из bolt.diy workbench.ts/files.ts — убраны WebContainer,
 * nanostores, терминал. Оставлено: файлы, активный файл, статус генерации.
 *
 * Используется на странице /generate для:
 *   - хранения всех файлов текущего артефакта
 *   - живого обновления файлов по мере стриминга
 *   - выбора активного файла в FileTree/CodeViewer
 */

import { create } from "zustand";
import type { GenerateResultFile } from "@/lib/types";

export interface VirtualFile {
  path: string;
  content: string;
  language: string;
  /** true пока файл ещё стримится от модели */
  streaming?: boolean;
}

function inferLanguage(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    ts: "typescript",
    tsx: "typescript",
    js: "javascript",
    jsx: "javascript",
    html: "html",
    css: "css",
    scss: "scss",
    json: "json",
    md: "markdown",
    mdx: "markdown",
    svg: "xml",
    py: "python",
    sh: "bash",
    yaml: "yaml",
    yml: "yaml",
    toml: "toml",
  };
  return map[ext] ?? "plaintext";
}

interface WorkbenchState {
  /** Все файлы текущего артефакта */
  files: Map<string, VirtualFile>;
  /** Путь активного (выбранного) файла */
  activePath: string | null;
  /** ID текущего артефакта */
  artifactId: string | null;
  /** Заголовок артефакта */
  artifactTitle: string | null;

  // Actions
  setArtifact: (id: string, title: string) => void;
  upsertFile: (path: string, content: string, streaming?: boolean) => void;
  finalizeFile: (path: string, content: string) => void;
  setActivePath: (path: string | null) => void;
  reset: () => void;
  /** Экспортировать файлы в формат GenerateResultFile[] */
  toResultFiles: () => GenerateResultFile[];
}

export const useWorkbench = create<WorkbenchState>((set, get) => ({
  files: new Map(),
  activePath: null,
  artifactId: null,
  artifactTitle: null,

  setArtifact: (id, title) => {
    set({ artifactId: id, artifactTitle: title, files: new Map() });
  },

  upsertFile: (path, content, streaming = false) => {
    set((state) => {
      const files = new Map(state.files);
      files.set(path, {
        path,
        content,
        language: inferLanguage(path),
        streaming,
      });
      // Автовыбор первого файла
      const activePath =
        state.activePath ??
        (path === "index.html" || path.endsWith("/index.html") ? path : null) ??
        path;
      return { files, activePath };
    });
  },

  finalizeFile: (path, content) => {
    set((state) => {
      const files = new Map(state.files);
      files.set(path, {
        path,
        content,
        language: inferLanguage(path),
        streaming: false,
      });
      return { files };
    });
  },

  setActivePath: (path) => set({ activePath: path }),

  reset: () =>
    set({
      files: new Map(),
      activePath: null,
      artifactId: null,
      artifactTitle: null,
    }),

  toResultFiles: () => {
    const { files } = get();
    return Array.from(files.values()).map((f) => ({
      path: f.path,
      content: f.content,
      language: f.language,
    }));
  },
}));
