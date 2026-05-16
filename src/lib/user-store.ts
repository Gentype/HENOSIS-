import { promises as fs } from "node:fs";
import path from "node:path";
import type { Session } from "next-auth";

/**
 * File-backed user/quota store.
 *
 * Why a JSON file: this repo has no database yet, and the user explicitly
 * asked for "сайт всегда по id видел" — server-side knowledge of every
 * user's tier and quota. A single `data/users.json` is the smallest thing
 * that works in `next dev` and survives restarts.
 *
 * For production on serverless filesystems (Vercel etc.), swap the
 * `readAll` / `writeAll` helpers below for Vercel KV / Upstash / Postgres.
 * The rest of the module is storage-agnostic.
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

const DATA_DIR = path.join(process.cwd(), "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");

interface UsersFile {
  users: Record<string, UserRecord>;
}

// In-process mutex so concurrent writes don't trample each other.
let writeChain: Promise<void> = Promise.resolve();

function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const next = writeChain.then(fn, fn);
  writeChain = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

async function ensureFile(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(USERS_FILE);
  } catch {
    await fs.writeFile(
      USERS_FILE,
      JSON.stringify({ users: {} }, null, 2),
      "utf-8",
    );
  }
}

async function readAll(): Promise<UsersFile> {
  await ensureFile();
  const raw = await fs.readFile(USERS_FILE, "utf-8");
  try {
    const parsed = JSON.parse(raw) as UsersFile;
    if (!parsed || typeof parsed !== "object" || !parsed.users) {
      return { users: {} };
    }
    return parsed;
  } catch {
    return { users: {} };
  }
}

async function writeAll(data: UsersFile): Promise<void> {
  await ensureFile();
  await fs.writeFile(USERS_FILE, JSON.stringify(data, null, 2), "utf-8");
}

export async function getUser(id: string): Promise<UserRecord | null> {
  const data = await readAll();
  return data.users[id] ?? null;
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
  return withLock(async () => {
    const data = await readAll();
    const existing = data.users[seed.id];
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
        data.users[seed.id] = next;
        await writeAll(data);
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
    data.users[seed.id] = created;
    await writeAll(data);
    return created;
  });
}

export async function setPlan(
  id: string,
  plan: Plan,
): Promise<UserRecord | null> {
  return withLock(async () => {
    const data = await readAll();
    const u = data.users[id];
    if (!u) return null;
    // Reset usage when changing plan so the new tier's quota is fresh.
    const next: UserRecord = {
      ...u,
      plan,
      generationsUsed: 0,
      updatedAt: Date.now(),
    };
    data.users[id] = next;
    await writeAll(data);
    return next;
  });
}

export async function incrementUsage(
  id: string,
): Promise<UserRecord | null> {
  return withLock(async () => {
    const data = await readAll();
    const u = data.users[id];
    if (!u) return null;
    const next: UserRecord = {
      ...u,
      generationsUsed: u.generationsUsed + 1,
      updatedAt: Date.now(),
    };
    data.users[id] = next;
    await writeAll(data);
    return next;
  });
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
