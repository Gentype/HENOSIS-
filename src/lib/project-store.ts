/**
 * Server-side project state store.
 *
 * Mirrors the same 3-tier storage pattern as `src/lib/user-store.ts`:
 *
 *   1. **Upstash Redis** — when `KV_REST_API_URL` + `KV_REST_API_TOKEN` are
 *      set (the env vars Vercel KV / Upstash inject automatically).
 *   2. **File-backed JSON** — local `next dev`. Writes
 *      `<cwd>/data/projects.json`, wrapped in an in-process mutex.
 *   3. **In-memory fallback** — when both of the above fail (e.g. a Vercel
 *      deploy without KV configured + read-only filesystem).
 *
 * Why this exists:
 *
 *   The `/api/generate` route streams chunks back to the client via
 *   Server-Sent Events. When the client disconnects (closes the tab,
 *   navigates to /projects, hits browser-refresh, blip on the network),
 *   the SSE stream dies — but Vercel keeps the function running until
 *   the route handler's stream closes naturally or hits maxDuration. The
 *   work continues invisibly and the result is lost.
 *
 *   With this store the route handler ALSO writes its progress here as
 *   it goes:
 *     - On start              → status: "generating"
 *     - On every chunk        → partial += delta (throttled flush)
 *     - On done               → status: "done", result: …
 *     - On error              → status: "error", error: …
 *
 *   The client can later GET `/api/projects/{id}/status`, see the
 *   latest state, and resume showing live progress (or the final
 *   result). This is what makes "close the tab, come back, the site
 *   is still being built" possible.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { Redis } from "@upstash/redis";
import type { ComplexityAnalysis, GenerateResult } from "./types";

export type ProjectStatus =
  | "queued" // created but generation hasn't started yet
  | "analyzing" // pre-generation /api/analyze classifier is running
  | "generating" // streaming from OpenRouter
  | "done"
  | "error";

export interface ProjectRecord {
  id: string;
  userId: string;
  prompt: string;
  model: string;
  status: ProjectStatus;
  /** Accumulated raw response (incomplete JSON) during streaming. */
  partial: string;
  /** Final parsed GenerateResult once status === "done". */
  result: GenerateResult | null;
  /** Error message once status === "error". */
  error: string | null;
  /** Quality Check classifier output, if any. */
  analysis: ComplexityAnalysis | null;
  /** Manual complexity override from a Silver/Gold user, if any. */
  complexityOverride: number | null;
  startedAt: number;
  updatedAt: number;
  completedAt: number | null;
}

// ---------------------------------------------------------------------------
// Storage abstraction
// ---------------------------------------------------------------------------

interface ProjectStorage {
  get(id: string): Promise<ProjectRecord | null>;
  put(record: ProjectRecord): Promise<void>;
  patch(
    id: string,
    patch: Partial<ProjectRecord>,
  ): Promise<ProjectRecord | null>;
  listByUser(userId: string): Promise<ProjectRecord[]>;
  delete(id: string): Promise<void>;
}

const DATA_DIR = path.join(process.cwd(), "data");
const PROJECTS_FILE = path.join(DATA_DIR, "projects.json");

class MemoryProjectStorage implements ProjectStorage {
  private map = new Map<string, ProjectRecord>();

  async get(id: string): Promise<ProjectRecord | null> {
    return this.map.get(id) ?? null;
  }
  async put(record: ProjectRecord): Promise<void> {
    this.map.set(record.id, record);
  }
  async patch(
    id: string,
    patch: Partial<ProjectRecord>,
  ): Promise<ProjectRecord | null> {
    const cur = this.map.get(id);
    if (!cur) return null;
    const next: ProjectRecord = {
      ...cur,
      ...patch,
      updatedAt: Date.now(),
    };
    this.map.set(id, next);
    return next;
  }
  async listByUser(userId: string): Promise<ProjectRecord[]> {
    return [...this.map.values()].filter((r) => r.userId === userId);
  }
  async delete(id: string): Promise<void> {
    this.map.delete(id);
  }
}

class FileProjectStorage implements ProjectStorage {
  // Per-process mutex; the JSON file is one shared resource.
  private chain: Promise<unknown> = Promise.resolve();
  // Set once we discover the filesystem is read-only (e.g. Vercel's
  // `/var/task`). After that we serve everything from memory rather than
  // 500-ing on every status poll.
  private memoryFallback: MemoryProjectStorage | null = null;

  private withLock<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.chain.then(fn, fn) as Promise<T>;
    this.chain = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  private async readAll(): Promise<Record<string, ProjectRecord>> {
    try {
      await fs.mkdir(DATA_DIR, { recursive: true });
      const raw = await fs.readFile(PROJECTS_FILE, "utf-8");
      const parsed = JSON.parse(raw) as {
        projects?: Record<string, ProjectRecord>;
      };
      return parsed?.projects ?? {};
    } catch {
      return {};
    }
  }

  private async writeAll(
    projects: Record<string, ProjectRecord>,
  ): Promise<void> {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(
      PROJECTS_FILE,
      JSON.stringify({ projects }, null, 2),
      "utf-8",
    );
  }

  async get(id: string): Promise<ProjectRecord | null> {
    if (this.memoryFallback) return this.memoryFallback.get(id);
    return this.withLock(async () => {
      const all = await this.readAll();
      return all[id] ?? null;
    });
  }

  async put(record: ProjectRecord): Promise<void> {
    if (this.memoryFallback) return this.memoryFallback.put(record);
    try {
      await this.withLock(async () => {
        const all = await this.readAll();
        all[record.id] = record;
        await this.writeAll(all);
      });
    } catch (err) {
      console.warn(
        "[project-store] file backend unwritable; falling back to in-memory storage. Configure Upstash KV (KV_REST_API_URL + KV_REST_API_TOKEN) for persistence across cold starts.",
        err,
      );
      this.memoryFallback = new MemoryProjectStorage();
      await this.memoryFallback.put(record);
    }
  }

  async patch(
    id: string,
    patch: Partial<ProjectRecord>,
  ): Promise<ProjectRecord | null> {
    if (this.memoryFallback) return this.memoryFallback.patch(id, patch);
    try {
      return await this.withLock(async () => {
        const all = await this.readAll();
        const cur = all[id];
        if (!cur) return null;
        const next: ProjectRecord = {
          ...cur,
          ...patch,
          updatedAt: Date.now(),
        };
        all[id] = next;
        await this.writeAll(all);
        return next;
      });
    } catch (err) {
      console.warn(
        "[project-store] patch failed; falling back to in-memory storage",
        err,
      );
      this.memoryFallback = new MemoryProjectStorage();
      return this.memoryFallback.patch(id, patch);
    }
  }

  async listByUser(userId: string): Promise<ProjectRecord[]> {
    if (this.memoryFallback) return this.memoryFallback.listByUser(userId);
    return this.withLock(async () => {
      const all = await this.readAll();
      return Object.values(all).filter((r) => r.userId === userId);
    });
  }

  async delete(id: string): Promise<void> {
    if (this.memoryFallback) return this.memoryFallback.delete(id);
    await this.withLock(async () => {
      const all = await this.readAll();
      delete all[id];
      await this.writeAll(all);
    });
  }
}

class RedisProjectStorage implements ProjectStorage {
  constructor(private client: Redis) {}

  private projectKey(id: string): string {
    return `henosis:project:${id}`;
  }
  private userIndexKey(userId: string): string {
    return `henosis:user-projects:${userId}`;
  }

  async get(id: string): Promise<ProjectRecord | null> {
    const v = await this.client.get<ProjectRecord>(this.projectKey(id));
    return v ?? null;
  }

  async put(record: ProjectRecord): Promise<void> {
    await this.client.set(this.projectKey(record.id), record);
    await this.client.sadd(this.userIndexKey(record.userId), record.id);
  }

  async patch(
    id: string,
    patch: Partial<ProjectRecord>,
  ): Promise<ProjectRecord | null> {
    const cur = await this.get(id);
    if (!cur) return null;
    const next: ProjectRecord = {
      ...cur,
      ...patch,
      updatedAt: Date.now(),
    };
    await this.put(next);
    return next;
  }

  async listByUser(userId: string): Promise<ProjectRecord[]> {
    const ids = (await this.client.smembers(this.userIndexKey(userId))) as
      | string[]
      | null;
    if (!ids || ids.length === 0) return [];
    const records: ProjectRecord[] = [];
    for (const id of ids) {
      const r = await this.get(id);
      if (r) records.push(r);
    }
    return records;
  }

  async delete(id: string): Promise<void> {
    const cur = await this.get(id);
    if (!cur) return;
    await this.client.del(this.projectKey(id));
    await this.client.srem(this.userIndexKey(cur.userId), id);
  }
}

function makeStorage(): ProjectStorage {
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    return new RedisProjectStorage(Redis.fromEnv());
  }
  return new FileProjectStorage();
}

const storage = makeStorage();

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function getProject(id: string): Promise<ProjectRecord | null> {
  return storage.get(id);
}

export async function listUserProjects(
  userId: string,
): Promise<ProjectRecord[]> {
  return storage.listByUser(userId);
}

export async function deleteProject(id: string): Promise<void> {
  await storage.delete(id);
}

/**
 * Create or overwrite a project record. Used by the /api/generate route
 * at the start of a generation. Idempotent on retry — passing the same id
 * resets the project to its initial state, which is what you want when
 * the user re-submits the same prompt after an error.
 */
export async function createProject(seed: {
  id: string;
  userId: string;
  prompt: string;
  model: string;
  analysis?: ComplexityAnalysis | null;
  complexityOverride?: number | null;
  initialStatus?: ProjectStatus;
}): Promise<ProjectRecord> {
  const now = Date.now();
  const record: ProjectRecord = {
    id: seed.id,
    userId: seed.userId,
    prompt: seed.prompt,
    model: seed.model,
    status: seed.initialStatus ?? "queued",
    partial: "",
    result: null,
    error: null,
    analysis: seed.analysis ?? null,
    complexityOverride: seed.complexityOverride ?? null,
    startedAt: now,
    updatedAt: now,
    completedAt: null,
  };
  await storage.put(record);
  return record;
}

export async function patchProject(
  id: string,
  patch: Partial<ProjectRecord>,
): Promise<ProjectRecord | null> {
  return storage.patch(id, patch);
}

/**
 * Mark a project as done with a final result.
 *
 * Clears the `partial` field — once we have a parsed `result`, the raw
 * stream buffer is just dead weight in the store.
 */
export async function completeProject(
  id: string,
  result: GenerateResult,
): Promise<void> {
  await storage.patch(id, {
    status: "done",
    result,
    error: null,
    partial: "",
    completedAt: Date.now(),
  });
}

export async function failProject(
  id: string,
  error: string,
): Promise<void> {
  await storage.patch(id, {
    status: "error",
    error,
    completedAt: Date.now(),
  });
}

// ---------------------------------------------------------------------------
// Status DTO — the trimmed shape returned by /api/projects/{id}/status.
// We deliberately do NOT expose `userId`, `prompt`, `complexityOverride`
// over the wire: the client already has those locally and there's no
// reason to re-send them on every poll.
// ---------------------------------------------------------------------------

export interface ProjectStatusDTO {
  id: string;
  status: ProjectStatus;
  partial: string;
  result: GenerateResult | null;
  error: string | null;
  analysis: ComplexityAnalysis | null;
  startedAt: number;
  updatedAt: number;
  completedAt: number | null;
  /** Diagnostic — `Date.now() - startedAt`. Lets the client surface "took 42s". */
  elapsedMs: number;
  /**
   * Server thinks this generation has been running too long without an
   * update and has likely been killed by the platform (Vercel maxDuration,
   * idle timeout, …). The status endpoint flips this true when
   * status === "generating" but updatedAt is older than {@link STALE_MS}.
   * The client treats it the same as `status === "error"`.
   */
  stale: boolean;
}

/**
 * Generations that haven't written a heartbeat in this long are considered
 * stale. Tuned to be just over Vercel's longest practical SSE timeout
 * (300s on Pro) plus a 60s safety margin for slow CDNs.
 */
export const STALE_MS = 6 * 60 * 1000;

export function toStatusDTO(record: ProjectRecord): ProjectStatusDTO {
  const now = Date.now();
  const stale =
    (record.status === "generating" || record.status === "analyzing") &&
    now - record.updatedAt > STALE_MS;
  return {
    id: record.id,
    status: record.status,
    partial: record.partial,
    result: record.result,
    error: record.error,
    analysis: record.analysis,
    startedAt: record.startedAt,
    updatedAt: record.updatedAt,
    completedAt: record.completedAt,
    elapsedMs: now - record.startedAt,
    stale,
  };
}
