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
import { QualityCheckOverlay } from "@/components/generate/quality-check-overlay";
import { useProjects, useUser } from "@/lib/store";
import { DEFAULT_MODEL } from "@/lib/examples";
import type {
  ComplexityAnalysis,
  GenerateResult,
  Project,
} from "@/lib/types";
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

/**
 * Server-side ProjectStatusDTO — kept local instead of importing because the
 * server module pulls in node-only deps (fs, redis) that can't run on the
 * client. The shape mirrors `lib/project-store.ts → toStatusDTO`.
 */
interface ServerProjectStatus {
  id: string;
  status: "queued" | "analyzing" | "generating" | "done" | "error";
  partial: string;
  result: GenerateResult | null;
  error: string | null;
  analysis: ComplexityAnalysis | null;
  startedAt: number;
  updatedAt: number;
  completedAt: number | null;
  elapsedMs: number;
  stale: boolean;
}

/** Time between `/api/projects/{id}/status` polls while generation is live. */
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
  /**
   * Whether THIS tab owns the live SSE connection. When true, the partial
   * stream is being driven by the SSE reader inside `startGeneration`.
   * When false, we're either idle or attached to a server-side generation
   * via polling — and we must not also kick off a duplicate /api/generate
   * call. Set per-tab, not persisted, so two tabs of the same project can
   * still each run their own polling against the shared server state.
   */
  const ownsStreamRef = useRef(false);
  const startedRef = useRef(false);
  /**
   * Active poll interval handle. Cleared on unmount, on completion, and
   * before starting a new poll. Stored in a ref so the cleanup useEffect
   * can read the current handle even after re-renders.
   */
  const pollHandleRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup any active poll when the component unmounts (navigating away
  // from /generate). Without this, polls keep firing in the background
  // and showing stale partial chunks if the user comes back later.
  useEffect(() => {
    return () => {
      if (pollHandleRef.current) {
        clearInterval(pollHandleRef.current);
        pollHandleRef.current = null;
      }
    };
  }, []);

  // When a result arrives or changes, default-select index.html for the code viewer
  useEffect(() => {
    if (project?.result && !activePath) {
      const indexFile = project.result.files.find((f) => f.path === "index.html");
      setActivePath(indexFile?.path ?? project.result.files[0]?.path ?? null);
    }
  }, [project?.result, activePath]);

  /**
   * Apply a server-side ProjectStatusDTO to the local zustand state. Used
   * by both the polling loop and the resume-on-mount path. Keeps the local
   * project record in sync with the canonical server record.
   */
  const applyServerStatus = useCallback(
    (id: string, sp: ServerProjectStatus) => {
      if (sp.partial) setPartial(sp.partial);

      if (sp.stale) {
        // Server thinks the generation has been silent too long — Vercel
        // probably killed the function at maxDuration. Surface as an error.
        patch(id, { status: "error" });
        setGenerating(false);
        setPartial("");
        return "stop" as const;
      }

      if (sp.status === "done" && sp.result) {
        patch(id, {
          status: "done",
          result: sp.result,
          analysis: sp.analysis ?? undefined,
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

      // Still generating / analyzing — sync analysis if we have one and
      // the local copy doesn't.
      if (sp.analysis) {
        patch(id, { analysis: sp.analysis });
      }
      setGenerating(true);
      return "continue" as const;
    },
    [patch],
  );

  /**
   * Begin polling /api/projects/{id}/status for live generation progress.
   * Used when the user opened the workshop on a project that's already
   * being generated server-side (refresh, came back from another tab,
   * navigated in from /projects). Idempotent — re-entering the same
   * project just resets the interval.
   */
  const startServerPolling = useCallback(
    (id: string) => {
      if (pollHandleRef.current) {
        clearInterval(pollHandleRef.current);
        pollHandleRef.current = null;
      }
      pollHandleRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/projects/${id}/status`, {
            cache: "no-store",
          });
          if (res.status === 404) {
            // Server forgot the project (cold start, ephemeral storage,
            // file-backed crash). We can't recover; surface as an error.
            if (pollHandleRef.current) {
              clearInterval(pollHandleRef.current);
              pollHandleRef.current = null;
            }
            patch(id, { status: "error" });
            setGenerating(false);
            return;
          }
          if (!res.ok) return; // transient — try again next tick
          const data = (await res.json()) as { project: ServerProjectStatus };
          const action = applyServerStatus(id, data.project);
          if (action === "stop" && pollHandleRef.current) {
            clearInterval(pollHandleRef.current);
            pollHandleRef.current = null;
          }
        } catch {
          /* network blip — keep polling */
        }
      }, POLL_INTERVAL_MS);
    },
    [applyServerStatus, patch],
  );

  const startGeneration = useCallback(
    async (
      prompt: string,
      opts?: { followUp?: boolean; analysis?: ComplexityAnalysis },
    ) => {
      if (!project) return;
      ownsStreamRef.current = true;
      setGenerating(true);
      setPartial("");

      const assistantMsgId = `m_${Date.now()}_a`;
      appendMessage(project.id, {
        id: assistantMsgId,
        role: "assistant",
        content: opts?.followUp
          ? "Reading the current site…"
          : opts?.analysis
            ? `Quality Check: ${opts.analysis.score}/10 · ${opts.analysis.tier}. Building now…`
            : "Reading your prompt and choosing a direction…",
        status: "streaming",
        createdAt: Date.now(),
      });

      // Track which files the model has started writing so the chat can show
      // an honest, live "writing styles.css…" status (no fake narration).
      const filesSeen: string[] = [];
      let lastReport = "";
      const PATH_REGEX = /"path"\s*:\s*"([^"]{1,200})"/g;

      try {
        // Follow-up edits hit /api/edit (uses EDIT_PROMPT, cached).
        // First-pass generation hits /api/generate (full SYSTEM_PROMPT, cached).
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
              analysis: opts?.analysis,
              complexityOverride: project.complexityOverride,
              // NEW: tell the server which project this belongs to so it
              // can write progress to the project store. The reconnect
              // flow on /generate?id=X reads from this same id.
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
        let accumulated = "";
        let finalResult: GenerateResult | null = null;
        let errorMsg: string | null = null;

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
            if (!payload) continue;
            try {
              const evt = JSON.parse(payload);
              if (evt.type === "chunk") {
                accumulated += evt.delta as string;
                setPartial(accumulated);

                // Honest progress: extract every "path":"…" the model has
                // emitted so far. When we see a new one, update the chat
                // bubble to say "Writing <path>…".
                PATH_REGEX.lastIndex = 0;
                let m: RegExpExecArray | null;
                while ((m = PATH_REGEX.exec(accumulated))) {
                  const path = m[1];
                  if (!filesSeen.includes(path)) filesSeen.push(path);
                }
                const current = filesSeen[filesSeen.length - 1];
                if (current && current !== lastReport) {
                  lastReport = current;
                  const idx = filesSeen.length;
                  const verb = inferVerb(current);
                  updateMessage(project.id, assistantMsgId, {
                    content: `${verb} \`${current}\`  · file ${idx}`,
                    status: "streaming",
                  });
                }
              } else if (evt.type === "done") {
                finalResult = evt.result as GenerateResult;
              } else if (evt.type === "error") {
                errorMsg = evt.message as string;
              }
            } catch {
              /* ignore */
            }
          }
        }

        if (errorMsg) throw new Error(errorMsg);
        if (!finalResult) {
          // SSE closed without a `done` event but also without an explicit
          // error. The most common cause is the user closing the tab
          // mid-stream — the server kept running and finished the
          // generation, but we never saw the result over THIS connection.
          // Instead of a scary "Stream ended" error, try to recover by
          // pinging the server. If it's still working (or already done),
          // the catch block switches to polling mode seamlessly.
          throw new Error(
            "Connection to the server dropped. The site is probably still being built — " +
            "stay on this page and it will appear automatically when ready."
          );
        }

        patch(project.id, {
          status: "done",
          result: finalResult,
          title: finalResult.meta.title ?? project.title,
        });

        const summary = opts?.followUp
          ? `Done — applied your changes. The site has ${finalResult.preview.sections.length} sections.`
          : `Here's your site: ${finalResult.meta.title}. ${finalResult.preview.sections.length} sections across ${finalResult.files.length} files. Ask me to tweak anything.`;

        updateMessage(project.id, assistantMsgId, {
          content: summary,
          status: "done",
        });

        incrementUsage();
        setActivePath(
          finalResult.files.find((f) => f.path === "index.html")?.path ??
            finalResult.files[0]?.path ??
            null,
        );
      } catch (err) {
        // We may have been disconnected mid-stream while the server keeps
        // working. Don't immediately mark the project as error — first
        // ask the server. If it's still generating or already done, the
        // polling loop will recover; if it actually failed, we'll see
        // status="error" on the next poll and surface it then.
        const message = (err as Error).message;
        const serverStillRunning = await pingServerStatus(project.id);
        if (serverStillRunning) {
          updateMessage(project.id, assistantMsgId, {
            content:
              "Connection dropped — generation is still running on the server. Reconnecting…",
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

  // Pre-generation Quality Check: call /api/analyze, persist the result on
  // the project, then kick off the heavy /api/generate stream.
  const runQualityCheckAndGenerate = useCallback(
    async (proj: Project) => {
      // Already analyzed? Skip straight to generation (e.g. user refreshed
      // mid-stream and we're resuming).
      let analysis = proj.analysis;
      if (!analysis) {
        try {
          const res = await fetch("/api/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: proj.prompt }),
          });
          if (res.ok) {
            const data = (await res.json()) as {
              analysis: ComplexityAnalysis;
            };
            analysis = data.analysis;
          } else {
            // 401 → the user got signed out between submit and analyze. Bail
            // out cleanly so the API can flag the issue downstream too.
            if (res.status === 401) {
              patch(proj.id, { status: "error" });
              return;
            }
            // Soft-fail: fall through to generation with no analysis so the
            // user isn't blocked by a broken classifier.
          }
        } catch {
          // Network error — same soft-fail behaviour.
        }

        if (analysis) {
          // Honour Silver+ override by surfacing it on the analysis object.
          const override = proj.complexityOverride;
          if (override != null && Number.isFinite(override)) {
            const score = Math.max(2, Math.min(10, Math.round(override)));
            // Canonical contract: only "html" (≤4) or "react-ts" (≥5).
            // Legacy "js-modules" / "typescript" used to leak through here
            // and confused the runtime assembler.
            const stack: ComplexityAnalysis["stack"] =
              score <= 4 ? "html" : "react-ts";
            analysis = {
              ...analysis,
              score,
              stack,
              userOverride: true,
            };
          }
          patch(proj.id, { analysis });
        }
      }

      // Brief pause so the Quality Check overlay has time to flash the
      // score — makes the UX feel intentional, not a glitch.
      if (analysis) {
        await new Promise((r) => setTimeout(r, 1200));
      }

      patch(proj.id, { status: "generating" });
      await startGeneration(proj.prompt, {
        followUp: false,
        analysis: analysis ?? undefined,
      });
    },
    [patch, startGeneration],
  );

  // Autostart on first load if requested. This path runs ONLY on a fresh
  // submit from the home page (?autostart=1). If the user lands here via
  // a refresh of an in-progress project, the resume effect below handles it.
  useEffect(() => {
    if (!hydrated || !project || startedRef.current) return;
    if (!autostart) return;
    if (project.status !== "analyzing" && project.status !== "generating")
      return;
    startedRef.current = true;
    void runQualityCheckAndGenerate(project);
    // remove autostart param so refresh doesn't re-fire
    router.replace(`/generate?id=${encodeURIComponent(project.id)}`, {
      scroll: false,
    });
  }, [hydrated, project, autostart, router, runQualityCheckAndGenerate]);

  /**
   * Resume effect — runs on mount when the local zustand store says the
   * project is in flight (`analyzing` / `generating`) but autostart was
   * NOT requested. The user must have refreshed mid-stream, opened a
   * second tab, or navigated back from /projects. Ask the server what's
   * happening and either:
   *
   *   - resume showing live progress via polling (server still running),
   *   - hydrate the local store with a finished result (server is done),
   *   - or surface an error (server failed / forgot the project).
   *
   * The autostart path is gated separately above; this one fires only
   * when autostart is absent.
   */
  useEffect(() => {
    if (!hydrated || !project || startedRef.current) return;
    if (autostart) return;
    if (project.status !== "analyzing" && project.status !== "generating") {
      return;
    }
    startedRef.current = true;

    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/projects/${project.id}/status`, {
          cache: "no-store",
        });
        if (cancelled) return;
        if (res.status === 404) {
          // Server has no record of this project. Most likely: the
          // project was started against an ephemeral memory backend that
          // didn't survive a serverless cold start, OR the user submitted
          // before our deploy gained the project store. Either way,
          // there's nothing to resume — mark as error so the user can
          // re-submit.
          patch(project.id, { status: "error" });
          appendMessage(project.id, {
            id: `m_${Date.now()}_a`,
            role: "assistant",
            content:
              "I lost track of this generation across the refresh. Submit the prompt again to retry.",
            status: "error",
            createdAt: Date.now(),
          });
          return;
        }
        if (!res.ok) return;
        const data = (await res.json()) as { project: ServerProjectStatus };
        const action = applyServerStatus(project.id, data.project);
        if (action === "continue") {
          // Server still working — let the polling loop drive updates.
          startServerPolling(project.id);
        }
      } catch {
        /* network failure — leave state as-is, user can retry manually */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    hydrated,
    project,
    autostart,
    applyServerStatus,
    startServerPolling,
    patch,
    appendMessage,
  ]);

  // Track current project for the projects list
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
      navigator.clipboard
        .writeText(link)
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
    if (!entry) {
      alert("No index.html in the generated site.");
      return;
    }
    // Open a self-contained Blob URL in a new tab as a stand-in publish.
    const blob = new Blob([entry.content], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  // Empty state — no project
  if (hydrated && !project) {
    return (
      <main className="min-h-screen grid place-items-center px-4">
        <div className="max-w-md text-center">
          <Sparkles className="w-7 h-7 mx-auto text-accent" />
          <h1 className="mt-4 text-3xl font-semibold tracking-tight">
            No project selected
          </h1>
          <p className="mt-2 text-muted">
            Start by describing the site you want on the home page.
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex items-center gap-2 btn-generate rounded-full font-semibold px-6 py-3 text-sm"
          >
            Go to Home
          </Link>
        </div>
      </main>
    );
  }

  if (!hydrated || !project) {
    return <GenerateLoading />;
  }

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
        complexityScore={project.analysis?.score}
        complexityTier={project.analysis?.tier}
        complexityStack={project.analysis?.stack}
      />

      <div className="flex-1 relative min-h-0 md:grid md:grid-cols-[340px_1fr] flex">
        {/* Chat panel: docked on md+, drawer on mobile */}
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

        {/* Mobile backdrop when chat is open */}
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
            <div key={iframeKey} className={cn("flex-1 min-w-0 bg-black")}>
              <PreviewPane
                result={project.result}
                generating={generating}
                partialContent={partial}
              />
            </div>
          )}
        </div>
      </div>

      {/* Quality Check loading overlay — only visible while the analyzer is
          running or just resolved. Disappears once generation begins. */}
      <QualityCheckOverlay
        visible={project.status === "analyzing"}
        analysis={project.analysis}
        override={project.complexityOverride}
        prompt={project.prompt}
      />
    </div>
  );
}

/**
 * Cheap one-shot status check used when our SSE reader gives up. Returns
 * `true` if the server still considers the project to be running (so the
 * UI should switch to polling instead of marking the project as failed).
 */
async function pingServerStatus(id: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/projects/${id}/status`, { cache: "no-store" });
    if (!res.ok) return false;
    const data = (await res.json()) as {
      project?: {
        status: string;
        stale?: boolean;
      };
    };
    if (!data.project) return false;
    if (data.project.stale) return false;
    return (
      data.project.status === "generating" ||
      data.project.status === "analyzing" ||
      data.project.status === "queued" ||
      data.project.status === "done" // server already finished — let polling pull it
    );
  } catch {
    return false;
  }
}

function inferVerb(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith(".css")) return "Styling";
  if (lower.endsWith(".js")) return "Wiring up";
  if (lower.endsWith(".json")) return "Setting up";
  if (lower === "index.html") return "Drafting homepage";
  if (lower.startsWith("pages/")) {
    const name = lower
      .replace("pages/", "")
      .replace(/\.html$/, "")
      .replace(/[-_]/g, " ");
    return `Building ${name} page`;
  }
  if (lower.endsWith(".html")) return "Writing page";
  return "Writing";
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
