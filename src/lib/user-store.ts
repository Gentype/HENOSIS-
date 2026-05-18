import { promises as fs } from "node:fs";
import path from "node:path";
import { Redis } from "@upstash/redis";
import type { Session } from "next-auth";

/**
 * User / quota store with three backends, picked in priority order:
 *
 *   1. **Upstash Redis** — when `KV_REST_API_URL` + `KV_REST_API_TOKEN`
 *      are set (the env vars Vercel KV injects automatically). One key per
 *      user, so concurrent writes from different lambdas don't trample
 *      each other. This is the right answer for production.
 *
 *   2. **File-backed JSON** — for local `next dev`. Writes to
 *      `<cwd>/data/users.json`, wrapped in an in-process mutex.
 *
 *   3. **Ephemeral in-memory** — last-resort fallback when *both* of the
 *      above fail. This kicks in on misconfigured production deploys
 *      (Vercel without KV configured: `/var/task` is read-only, so the
 *      file backend can't write). Without this fallback, `getOrCreateUser`
 *      throws → `/api/me` 500s → the client `useUser` store stays empty
 *      forever → the freshly-signed-in user is shown a "Not signed in"
 *      page and asked to register again. The in-memory map is per-lambda
 *      so quotas don't persist between cold starts, but at least the
 *      user is recognized as authenticated, which is a strict improvement
 *      over the current "you appear to not exist" behavior.
 */

export type Plan = "free" | "pro" | "ultra";

export interface UserRecord {
  id: string;
  email: string;
  name: string;
  image: string | null;
  plan: Plan;
  generationsUsed: number;
  joinedAt: number;
  updatedAt: number;
}

export const PLAN_LIMITS: Record<Plan, number> = {
  free: 3,
  pro: 50,
  ultra: Number.POSITIVE_INFINITY,
};

/** Display labels — what the user sees in the UI. */
export const PLAN_LABEL: Record<Plan, "Bronze" | "Silver" | "Gold"> = {
  free: "Bronze",
  pro: "Silver",
  ultra: "Gold",
};

export const ALL_PLANS: Plan[] = ["free", "pro", "ultra"];

// ---------------------------------------------------------------------------
// Storage abstraction
//
// Three implementations:
//   - RedisStorage  — production (Upstash KV, requires env vars)
//   - FileStorage   — local `next dev` (writes <cwd>/data/users.json)
//   - MemoryStorage — last-resort fallback for misconfigured deploys
//
// The Redis client is created lazily so missing env vars don't blow up at
// import time. FileStorage detects unwritable filesystems (e.g. Vercel's
// read-only `/var/task`) on first write and *demotes itself* to in-memory
// behavior so subsequent calls keep the user authenticated rather than
// 500-ing on every request.
// ---------------------------------------------------------------------------

interface Storage {
  get(id: string): Promise<UserRecord | null>;
  put(record: UserRecord): Promise<void>;
}

const DATA_DIR = path.join(process.cwd(), "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");

class MemoryStorage implements Storage {
  private users = new Map<string, UserRecord>();

  async get(id: string): Promise<UserRecord | null> {
    return this.users.get(id) ?? null;
  }

  async put(record: UserRecord): Promise<void> {
    this.users.set(record.id, record);
  }
}

class FileStorage implements Storage {
  // Per-process mutex; the JSON file is a single shared resource.
  private chain: Promise<unknown> = Promise.resolve();
  // Set once we discover the filesystem is read-only (e.g. Vercel's
  // `/var/task`). After that we serve all reads/writes from memory so we
  // don't 500 on every request — quota won't persist across cold starts,
  // but the user at least stays authenticated.
  private memoryFallback: MemoryStorage | null = null;

  private withLock<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.chain.then(fn, fn) as Promise<T>;
    this.chain = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  private async readAll(): Promise<Record<string, UserRecord>> {
    try {
      await fs.mkdir(DATA_DIR, { recursive: true });
      const raw = await fs.readFile(USERS_FILE, "utf-8");
      const parsed = JSON.parse(raw) as { users?: Record<string, UserRecord> };
      return parsed?.users ?? {};
    } catch {
      return {};
    }
  }

  private async writeAll(users: Record<string, UserRecord>): Promise<void> {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(USERS_FILE, JSON.stringify({ users }, null, 2), "utf-8");
  }

  async get(id: string): Promise<UserRecord | null> {
    if (this.memoryFallback) return this.memoryFallback.get(id);
    return this.withLock(async () => {
      const users = await this.readAll();
      return users[id] ?? null;
    });
  }

  async put(record: UserRecord): Promise<void> {
    if (this.memoryFallback) return this.memoryFallback.put(record);
    try {
      await this.withLock(async () => {
        const users = await this.readAll();
        users[record.id] = record;
        await this.writeAll(users);
      });
    } catch (err) {
      // Read-only filesystem (EROFS) or quota errors → fall back to memory
      // so we don't keep blowing up on every signed-in request. Logged so
      // the operator notices and configures KV.
      console.warn(
        "[user-store] File backend is unwritable; falling back to in-memory storage. Configure Upstash KV (KV_REST_API_URL + KV_REST_API_TOKEN) for persistence.",
        err,
      );
      this.memoryFallback = new MemoryStorage();
      await this.memoryFallback.put(record);
    }
  }
}

class RedisStorage implements Storage {
  constructor(private client: Redis) {}

  private key(id: string): string {
    return `henosis:user:${id}`;
  }

  async get(id: string): Promise<UserRecord | null> {
    // Upstash auto-parses JSON values.
    const v = await this.client.get<UserRecord>(this.key(id));
    return v ?? null;
  }

  async put(record: UserRecord): Promise<void> {
    await this.client.set(this.key(record.id), record);
  }
}

function makeStorage(): Storage {
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    return new RedisStorage(Redis.fromEnv());
  }
  return new FileStorage();
}

// Module-level singleton — initialised once per server process.
const storage = makeStorage();

// ---------------------------------------------------------------------------

export async function getUser(id: string): Promise<UserRecord | null> {
  return storage.get(id);
}

export interface OAuthSeed {
  id: string;
  email: string;
  name: string;
  image: string | null;
}

/**
 * Look up the user by id; create on first login. Also refreshes name /
 * email / image from the latest Google profile in case the user changed
 * them.
 */
export async function getOrCreateUser(seed: OAuthSeed): Promise<UserRecord> {
  const existing = await storage.get(seed.id);
  if (existing) {
    const next: UserRecord = {
      ...existing,
      email: seed.email || existing.email,
      name: seed.name || existing.name,
      image: seed.image ?? existing.image,
      updatedAt: Date.now(),
    };
    if (
      next.email !== existing.email ||
      next.name !== existing.name ||
      next.image !== existing.image
    ) {
      await storage.put(next);
    }
    return next;
  }
  const created: UserRecord = {
    id: seed.id,
    email: seed.email,
    name: seed.name,
    image: seed.image,
    plan: "free",
    generationsUsed: 0,
    joinedAt: Date.now(),
    updatedAt: Date.now(),
  };
  await storage.put(created);
  return created;
}

export async function setPlan(
  id: string,
  plan: Plan,
): Promise<UserRecord | null> {
  const u = await storage.get(id);
  if (!u) return null;
  // Reset usage when changing plan so the new tier's quota is fresh.
  const next: UserRecord = {
    ...u,
    plan,
    generationsUsed: 0,
    updatedAt: Date.now(),
  };
  await storage.put(next);
  return next;
}

export async function incrementUsage(
  id: string,
): Promise<UserRecord | null> {
  const u = await storage.get(id);
  if (!u) return null;
  const next: UserRecord = {
    ...u,
    generationsUsed: u.generationsUsed + 1,
    updatedAt: Date.now(),
  };
  await storage.put(next);
  return next;
}

export function quotaRemaining(user: UserRecord): number {
  const limit = PLAN_LIMITS[user.plan];
  if (!Number.isFinite(limit)) return Number.POSITIVE_INFINITY;
  return Math.max(0, limit - user.generationsUsed);
}

export async function userFromSession(
  session: Session | null,
): Promise<UserRecord | null> {
  if (!session?.user?.id) return null;
  return getOrCreateUser({
    id: session.user.id,
    email: session.user.email ?? "",
    name: session.user.name ?? "User",
    image: session.user.image ?? null,
  });
}

export interface UserDTO extends UserRecord {
  tier: "Bronze" | "Silver" | "Gold";
  limit: number | null;
  remaining: number | null;
}

/** Project a UserRecord into the JSON shape the frontend consumes. */
export function toDTO(user: UserRecord): UserDTO {
  const limit = PLAN_LIMITS[user.plan];
  const isFinite = Number.isFinite(limit);
  return {
    ...user,
    tier: PLAN_LABEL[user.plan],
    limit: isFinite ? limit : null,
    remaining: isFinite ? Math.max(0, limit - user.generationsUsed) : null,
  };
}
