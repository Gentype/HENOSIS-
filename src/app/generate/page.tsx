"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { MenuBar } from "@/components/generate/menu-bar";
import { ChatPanel } from "@/components/generate/chat-panel";
import { FileTree } from "@/components/generate/file-tree";
import { CodeViewer } from "@/components/generate/code-viewer";
import { PreviewPane } from "@/components/generate/preview-pane";
import { useProjects, useUser } from "@/lib/store";
import { DEFAULT_MODEL } from "@/lib/examples";
import { StreamingMessageParser } from "@/lib/runtime/message-parser";
import { artifactTextToResult } from "@/lib/generate";
import type { GenerateResult, Project } from "@/lib/types";
import { Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export default function GeneratePage() {
  return (
    <Suspense fallback={<GenerateLoading />}>
      <GenerateInner />
    </Suspense>
  );
}

function GenerateLoading() {
  return (
    <div className="min-h-screen grid place-items-center text-muted">
      <Loader2 className="w-6 h-6 animate-spin" />
    </div>
  );
}

interface ServerProjectStatus {
  id: string;
  status: "queued" | "analyzing" | "generating" | "done" | "error";
  partial: string;
  result: GenerateResult | null;
  error: string | null;
  startedAt: number;
  updatedAt: number;
  completedAt: number | null;
  elapsedMs: number;
  stale: boolean;
}

const POLL_INTERVAL_MS = 1500;

function GenerateInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const idParam = sp.get("id");
  const autostart = sp.get("autostart") === "1";

  const projects = useProjects((s) => s.projects);
  const upsert = useProjects((s) => s.upsert);
  const patch = useProjects((s) => s.patch);
  const appendMessage = useProjects((s) => s.appendMessage);
  const updateMessage = useProjects((s) => s.updateMessage);
  const setCurrent = useProjects((s) => s.setCurrent);
  const incrementUsage = useUser((s) => s.incrementUsage);

  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  const project = useMemo<Project | null>(
    () => projects.find((p) => p.id === idParam) ?? null,
    [projects, idParam],
  );

  const [view, setView] = useState<"preview" | "code">("preview");
  const [activePath, setActivePath] = useState<string | null>(null);
  const [partial, setPartial] = useState<string>("");
  const [generating, setGenerating] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const [chatOpen, setChatOpen] = useState(false);

  const ownsStreamRef = useRef(false);
  const startedRef = useRef(false);
  const pollHandleRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup poll on unmount
  useEffect(() => {
    return () => {
      if (pollHandleRef.current) {
        clearInterval(pollHandleRef.current);
        pollHandleRef.current = null;
      }
    };
  }, []);

  // Auto-select first file when result arrives
  useEffect(() => {
    if (project?.result && !activePath) {
      const indexFile = project.result.files.find((f) => f.path === "index.html");
      setActivePath(indexFile?.path ?? project.result.files[0]?.path ?? null);
    }
  }, [project?.result, activePath]);

  const applyServerStatus = useCallback(
    (id: string, sp: ServerProjectStatus) => {
      if (sp.partial) setPartial(sp.partial);

      if (sp.stale) {
        patch(id, { status: "error" });
        setGenerating(false);
        setPartial("");
        return "stop" as const;
      }

      if (sp.status === "done" && sp.result) {
        patch(id, {
          status: "done",
          result: sp.result,
          title: sp.result.meta?.title || undefined,
        });
        setGenerating(false);
        setPartial("");
        return "stop" as const;
      }

      if (sp.status === "error") {
        patch(id, { status: "error" });
        setGenerating(false);
        setPartial("");
        return "stop" as const;
      }

      setGenerating(true);
      return "continue" as const;
    },
    [patch],
  );

  const startServerPolling = useCallback(
    (id: string) => {
      if (pollHandleRef.current) {
        clearInterval(pollHandleRef.current);
        pollHandleRef.current = null;
      }
      pollHandleRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/projects/${id}/status`, { cache: "no-store" });
          if (res.status === 404) {
            if (pollHandleRef.current) {
              clearInterval(pollHandleRef.current);
              pollHandleRef.current = null;
            }
            patch(id, { status: "error" });
            setGenerating(false);
            return;
          }
          if (!res.ok) return;
          const data = (await res.json()) as { project: ServerProjectStatus };
          const action = applyServerStatus(id, data.project);
          if (action === "stop" && pollHandleRef.current) {
            clearInterval(pollHandleRef.current);
            pollHandleRef.current = null;
          }
        } catch {
          /* network blip */
        }
      }, POLL_INTERVAL_MS);
    },
    [applyServerStatus, patch],
  );

  const startGeneration = useCallback(
    async (prompt: string, opts?: { followUp?: boolean }) => {
      if (!project) return;
      ownsStreamRef.current = true;
      setGenerating(true);
      setPartial("");
      setActivePath(null);

      const assistantMsgId = `m_${Date.now()}_a`;
      appendMessage(project.id, {
        id: assistantMsgId,
        role: "assistant",
        content: opts?.followUp
          ? "Reading the current site…"
          : "Reading your prompt and designing the site…",
        status: "streaming",
        createdAt: Date.now(),
      });

      // bolt-тег трекинг для честного статуса в чате
      const filesSeen: string[] = [];
      let lastReport = "";
      const FILE_PATH_REGEX = /filePath="([^"]{1,300})"/g;

      try {
        const endpoint = opts?.followUp ? "/api/edit" : "/api/generate";
        const reqBody = opts?.followUp
          ? {
              prompt,
              model: project.model,
              priorFiles: project.result?.files ?? [],
            }
          : {
              prompt,
              model: project.model,
              projectId: project.id,
            };

        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(reqBody),
        });

        if (!res.ok || !res.body) {
          const txt = await res.text();
          throw new Error(txt || `Request failed: ${res.status}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        let accumulated = ""; // полный bolt-текст
        let finalResult: GenerateResult | null = null;
        let errorMsg: string | null = null;

        // Клиентский парсер для live-обновления файлов
        const parser = new StreamingMessageParser({
          callbacks: {
            onActionStream: (data) => {
              if (data.action.type === "file") {
                // Обновляем накопленный partial для LiveBuilder
              }
            },
          },
        });

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";

          for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line.startsWith("data:")) continue;
            const payload = line.slice(5).trim();
            if (!payload || payload === "") continue;

            try {
              const evt = JSON.parse(payload);

              if (evt.type === "chunk") {
                accumulated += evt.delta as string;
                // Передаём сырой bolt-текст в LiveBuilder через partial
                setPartial(accumulated);

                // Парсим теги в реальном времени для статуса
                parser.parse(assistantMsgId, accumulated);

                // Отслеживаем файлы из bolt-тегов
                FILE_PATH_REGEX.lastIndex = 0;
                let m: RegExpExecArray | null;
                while ((m = FILE_PATH_REGEX.exec(accumulated))) {
                  const path = m[1];
                  if (!filesSeen.includes(path)) filesSeen.push(path);
                }
                const current = filesSeen[filesSeen.length - 1];
                if (current && current !== lastReport) {
                  lastReport = current;
                  updateMessage(project.id, assistantMsgId, {
                    content: `Writing \`${current}\` · file ${filesSeen.length}`,
                    status: "streaming",
                  });
                }
              } else if (evt.type === "done") {
                finalResult = evt.result as GenerateResult;
              } else if (evt.type === "error") {
                errorMsg = evt.message as string;
              }
            } catch {
              /* skip malformed SSE */
            }
          }
        }

        if (errorMsg) throw new Error(errorMsg);
        if (!finalResult) {
          // Попробуем восстановить из накопленного текста
          if (accumulated.includes("<boltArtifact")) {
            try {
              finalResult = artifactTextToResult(accumulated, prompt.slice(0, 60));
            } catch {
              // Если не получилось — проверяем сервер
            }
          }
          if (!finalResult) {
            throw new Error(
              "Connection dropped. The site may still be building — stay on the page.",
            );
          }
        }

        patch(project.id, {
          status: "done",
          result: finalResult,
          title: finalResult.meta.title ?? project.title,
        });

        const summary = opts?.followUp
          ? `Done — applied your changes. ${finalResult.files.length} files updated.`
          : `Here's your site: **${finalResult.meta.title}** — ${finalResult.files.length} files. Ask me to change anything!`;

        updateMessage(project.id, assistantMsgId, {
          content: summary,
          status: "done",
        });

        incrementUsage();
        const firstFile =
          finalResult.files.find((f) => f.path === "index.html") ??
          finalResult.files[0];
        setActivePath(firstFile?.path ?? null);
      } catch (err) {
        const message = (err as Error).message;
        const serverStillRunning = await pingServerStatus(project.id);
        if (serverStillRunning) {
          updateMessage(project.id, assistantMsgId, {
            content: "Connection dropped — generation continues on the server. Reconnecting…",
            status: "streaming",
          });
          startServerPolling(project.id);
          return;
        }
        patch(project.id, { status: "error" });
        updateMessage(project.id, assistantMsgId, {
          content: `Generation failed: ${message}`,
          status: "error",
        });
        setGenerating(false);
        setPartial("");
      } finally {
        ownsStreamRef.current = false;
      }
    },
    [
      project,
      appendMessage,
      patch,
      updateMessage,
      incrementUsage,
      startServerPolling,
    ],
  );

  // Autostart на первой загрузке
  useEffect(() => {
    if (!hydrated || !project || startedRef.current) return;
    if (!autostart) return;
    if (project.status !== "generating") return;
    startedRef.current = true;
    void startGeneration(project.prompt);
    router.replace(`/generate?id=${encodeURIComponent(project.id)}`, { scroll: false });
  }, [hydrated, project, autostart, router, startGeneration]);

  // Resume effect — восстановление после обрыва
  useEffect(() => {
    if (!hydrated || !project || startedRef.current) return;
    if (autostart) return;
    if (project.status !== "generating") return;
    startedRef.current = true;

    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/projects/${project.id}/status`, { cache: "no-store" });
        if (cancelled) return;
        if (res.status === 404) {
          patch(project.id, { status: "error" });
          appendMessage(project.id, {
            id: `m_${Date.now()}_a`,
            role: "assistant",
            content: "Lost track of this generation after refresh. Submit the prompt again to retry.",
            status: "error",
            createdAt: Date.now(),
          });
          return;
        }
        if (!res.ok) return;
        const data = (await res.json()) as { project: ServerProjectStatus };
        const action = applyServerStatus(project.id, data.project);
        if (action === "continue") startServerPolling(project.id);
      } catch {
        /* network failure */
      }
    })();

    return () => { cancelled = true; };
  }, [hydrated, project, autostart, applyServerStatus, startServerPolling, patch, appendMessage]);

  // Track current project
  useEffect(() => {
    if (project) setCurrent(project.id);
  }, [project, setCurrent]);

  const handleFollowUp = useCallback(
    async (prompt: string) => {
      if (!project || generating) return;
      appendMessage(project.id, {
        id: `m_${Date.now()}_u`,
        role: "user",
        content: prompt,
        status: "done",
        createdAt: Date.now(),
      });
      await startGeneration(prompt, { followUp: true });
    },
    [project, generating, appendMessage, startGeneration],
  );

  function handleDownload() {
    if (!project?.result) return;
    // Скачиваем все файлы как ZIP через JSZip или просто index.html
    const entry = project.result.files.find((f) => f.path === "index.html");
    if (!entry) return;
    const blob = new Blob([entry.content], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slugify(project.result.meta.title || "henosis-site")}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleShare() {
    if (!project) return;
    const link = window.location.href;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(link)
        .then(() => alert("Project link copied to clipboard"))
        .catch(() => window.prompt("Copy this link:", link));
    } else {
      window.prompt("Copy this link:", link);
    }
  }

  function handlePublish() {
    if (!project?.result) {
      alert("Generate the site first, then publish.");
      return;
    }
    const entry = project.result.files.find((f) => f.path === "index.html");
    if (!entry) { alert("No index.html found."); return; }
    const blob = new Blob([entry.content], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  // Empty state
  if (hydrated && !project) {
    return (
      <main className="min-h-screen grid place-items-center px-4">
        <div className="max-w-md text-center">
          <Sparkles className="w-7 h-7 mx-auto text-accent" />
          <h1 className="mt-4 text-3xl font-semibold tracking-tight">No project selected</h1>
          <p className="mt-2 text-muted">
            Start by describing the site you want on the home page.
          </p>
          <Link href="/" className="mt-6 inline-flex items-center gap-2 btn-generate rounded-full font-semibold px-6 py-3 text-sm">
            Go to Home
          </Link>
        </div>
      </main>
    );
  }

  if (!hydrated || !project) return <GenerateLoading />;

  return (
    <div className="h-screen flex flex-col bg-black">
      <MenuBar
        projectTitle={project.result?.meta?.title ?? project.title}
        status={project.status}
        view={view}
        onViewChange={setView}
        model={project.model || DEFAULT_MODEL}
        onModelChange={(m) => upsert({ ...project, model: m })}
        onDownload={handleDownload}
        onShare={handleShare}
        onPublish={handlePublish}
        onRefresh={() => setIframeKey((k) => k + 1)}
        onToggleChat={() => setChatOpen((o) => !o)}
        chatOpen={chatOpen}
      />

      <div className="flex-1 relative min-h-0 md:grid md:grid-cols-[340px_1fr] flex">
        {/* Chat panel */}
        <div
          aria-hidden={!chatOpen ? true : undefined}
          className={cn(
            "md:static md:translate-x-0 md:opacity-100 md:pointer-events-auto",
            "absolute inset-y-0 left-0 z-30 w-[88%] max-w-[360px]",
            "transition-transform duration-300 ease-out",
            chatOpen
              ? "translate-x-0 pointer-events-auto"
              : "-translate-x-full pointer-events-none md:pointer-events-auto",
          )}
        >
          <ChatPanel
            messages={project.history}
            generating={generating}
            onFollowUp={handleFollowUp}
          />
        </div>

        {/* Mobile backdrop */}
        {chatOpen && (
          <button
            type="button"
            aria-label="Close chat"
            onClick={() => setChatOpen(false)}
            className="md:hidden absolute inset-0 z-20 bg-black/60 backdrop-blur-sm"
          />
        )}

        <div className="flex-1 min-w-0 min-h-0 flex">
          {view === "code" && project.result ? (
            <div className="flex flex-1 min-w-0">
              <div className="hidden sm:block w-56 lg:w-64 shrink-0">
                <FileTree
                  files={project.result.files}
                  activePath={activePath}
                  onSelect={setActivePath}
                />
              </div>
              <div className="flex-1 min-w-0 bg-black">
                <CodeViewer
                  file={
                    project.result.files.find((f) => f.path === activePath) ??
                    project.result.files[0] ??
                    null
                  }
                />
              </div>
            </div>
          ) : (
            <div key={iframeKey} className="flex-1 min-w-0 bg-black">
              <PreviewPane
                result={project.result}
                generating={generating}
                partialContent={partial}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

async function pingServerStatus(id: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/projects/${id}/status`, { cache: "no-store" });
    if (!res.ok) return false;
    const data = (await res.json()) as { project?: { status: string; stale?: boolean } };
    if (!data.project || data.project.stale) return false;
    return ["generating", "analyzing", "queued", "done"].includes(data.project.status);
  } catch {
    return false;
  }
}

function slugify(s: string): string {
  return s.toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
