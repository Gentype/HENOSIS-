import { promises as fs } from "node:fs";
import path from "node:path";
import { Redis } from "@upstash/redis";
import type { Session } from "next-auth";

/**
 * User / quota store with two backends:
 *
 *   - **Upstash Redis** (used when `KV_REST_API_URL` + `KV_REST_API_TOKEN`
 *     are set — the env vars Vercel KV injects automatically). One key per
 *     user (`user:<id>`), so concurrent writes from different lambdas don't
 *     trample each other.
 *   - **File-backed JSON** at `data/users.json` for local `next dev`. Wrapped
 *     in an in-process mutex.
 *
 * Picked Upstash Redis because it speaks HTTP, so it works on Vercel's
 * serverless lambdas without persistent connections.
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
// Two implementations: Redis (per-user keys, used in serverless / production)
// and a JSON file at data/users.json (local dev). The Redis client is created
// lazily so missing env vars don't blow up at import time.
// ---------------------------------------------------------------------------

interface Storage {
  get(id: string): Promise<UserRecord | null>;
  put(record: UserRecord): Promise<void>;
}

const DATA_DIR = path.join(process.cwd(), "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");

class FileStorage implements Storage {
  // Per-process mutex; the JSON file is a single shared resource.
  private chain: Promise<unknown> = Promise.resolve();

  private withLock<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.chain.then(fn, fn) as Promise<T>;
    this.chain = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  private async readAll(): Promise<Record<string, UserRecord>> {
    await fs.mkdir(DATA_DIR, { recursive: true });
    try {
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
    return this.withLock(async () => {
      const users = await this.readAll();
      return users[id] ?? null;
    });
  }

  async put(record: UserRecord): Promise<void> {
    await this.withLock(async () => {
      const users = await this.readAll();
      users[record.id] = record;
      await this.writeAll(users);
    });
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
