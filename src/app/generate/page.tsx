"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  const startedRef = useRef(false);

  // When a result arrives or changes, default-select index.html for the code viewer
  useEffect(() => {
    if (project?.result && !activePath) {
      const indexFile = project.result.files.find((f) => f.path === "index.html");
      setActivePath(indexFile?.path ?? project.result.files[0]?.path ?? null);
    }
  }, [project?.result, activePath]);

  const startGeneration = useCallback(
    async (
      prompt: string,
      opts?: { followUp?: boolean; analysis?: ComplexityAnalysis },
    ) => {
      if (!project) return;
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
        if (!finalResult) throw new Error("No result returned");

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
        patch(project.id, { status: "error" });
        updateMessage(project.id, assistantMsgId, {
          content: `Generation failed: ${(err as Error).message}`,
          status: "error",
        });
      } finally {
        setGenerating(false);
        setPartial("");
      }
    },
    [project, appendMessage, patch, updateMessage, incrementUsage],
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

  // Autostart on first load if requested
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
