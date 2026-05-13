"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { MenuBar } from "@/components/generate/menu-bar";
import { ChatPanel } from "@/components/generate/chat-panel";
import { FileTree } from "@/components/generate/file-tree";
import { CodeViewer } from "@/components/generate/code-viewer";
import { PreviewPane } from "@/components/generate/preview-pane";
import { useProjects, useUser } from "@/lib/store";
import { DEFAULT_MODEL } from "@/lib/examples";
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
  const startedRef = useRef(false);

  // When a result arrives or changes, default-select index.html for the code viewer
  useEffect(() => {
    if (project?.result && !activePath) {
      const indexFile = project.result.files.find((f) => f.path === "index.html");
      setActivePath(indexFile?.path ?? project.result.files[0]?.path ?? null);
    }
  }, [project?.result, activePath]);

  const startGeneration = useCallback(
    async (prompt: string, opts?: { followUp?: boolean }) => {
      if (!project) return;
      setGenerating(true);
      setPartial("");

      const assistantMsgId = `m_${Date.now()}_a`;
      appendMessage(project.id, {
        id: assistantMsgId,
        role: "assistant",
        content: opts?.followUp
          ? "Got it — applying your changes…"
          : "Designing your site…",
        status: "streaming",
        createdAt: Date.now(),
      });

      try {
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt,
            model: project.model,
            priorFiles: opts?.followUp ? project.result?.files : undefined,
          }),
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

  // Autostart on first load if requested
  useEffect(() => {
    if (!hydrated || !project || startedRef.current) return;
    if (!autostart) return;
    if (project.status !== "generating") return;
    startedRef.current = true;
    void startGeneration(project.prompt, { followUp: false });
    // remove autostart param so refresh doesn't re-fire
    router.replace(`/generate?id=${encodeURIComponent(project.id)}`, { scroll: false });
  }, [hydrated, project, autostart, router, startGeneration]);

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
    navigator.clipboard.writeText(link).then(() => {
      alert("Link copied to clipboard");
    });
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
        onRefresh={() => setIframeKey((k) => k + 1)}
      />

      <div className="flex-1 grid grid-cols-[340px_1fr] min-h-0">
        <ChatPanel
          messages={project.history}
          generating={generating}
          onFollowUp={handleFollowUp}
        />

        <div className="min-w-0 min-h-0 flex">
          {view === "code" && project.result ? (
            <div className="flex flex-1 min-w-0">
              <div className="w-64 shrink-0">
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
    </div>
  );
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
