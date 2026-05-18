"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  signIn as nextSignIn,
  signOut as nextSignOut,
} from "next-auth/react";
import type { ChatMessage, Plan, Project, User } from "./types";
import { DEFAULT_MODEL } from "./examples";

interface DraftState {
  prompt: string;
  model: string;
  /**
   * Optional manual complexity (2–10) selected by a Silver/Gold user on the
   * landing page BEFORE submitting. Persisted alongside the prompt so that
   * users who get redirected through /auth come back with the same choice.
   * `null` means "let the analyzer decide".
   */
  complexityOverride: number | null;
  setPrompt: (p: string) => void;
  setModel: (m: string) => void;
  setComplexityOverride: (v: number | null) => void;
  reset: () => void;
}

export const useDraft = create<DraftState>()(
  persist(
    (set) => ({
      prompt: "",
      model: DEFAULT_MODEL,
      complexityOverride: null,
      setPrompt: (prompt) => set({ prompt }),
      setModel: (model) => set({ model }),
      setComplexityOverride: (complexityOverride) =>
        set({ complexityOverride }),
      reset: () =>
        set({
          prompt: "",
          model: DEFAULT_MODEL,
          complexityOverride: null,
        }),
    }),
    {
      name: "henosis:draft:v2",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

interface ProjectsState {
  projects: Project[];
  current: string | null;
  setCurrent: (id: string | null) => void;
  upsert: (p: Project) => void;
  patch: (id: string, patch: Partial<Project>) => void;
  appendMessage: (id: string, msg: ChatMessage) => void;
  updateMessage: (
    projectId: string,
    messageId: string,
    patch: Partial<ChatMessage>,
  ) => void;
  remove: (id: string) => void;
  clear: () => void;
}

export const useProjects = create<ProjectsState>()(
  persist(
    (set) => ({
      projects: [],
      current: null,
      setCurrent: (id) => set({ current: id }),
      upsert: (p) =>
        set((s) => {
          const existing = s.projects.find((x) => x.id === p.id);
          if (existing) {
            return {
              projects: s.projects.map((x) => (x.id === p.id ? { ...x, ...p } : x)),
            };
          }
          return { projects: [p, ...s.projects] };
        }),
      patch: (id, patch) =>
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id === id ? { ...p, ...patch, updatedAt: Date.now() } : p,
          ),
        })),
      appendMessage: (id, msg) =>
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id === id
              ? { ...p, history: [...p.history, msg], updatedAt: Date.now() }
              : p,
          ),
        })),
      updateMessage: (projectId, messageId, mPatch) =>
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id === projectId
              ? {
                  ...p,
                  history: p.history.map((m) =>
                    m.id === messageId ? { ...m, ...mPatch } : m,
                  ),
                  updatedAt: Date.now(),
                }
              : p,
          ),
        })),
      remove: (id) =>
        set((s) => ({
          projects: s.projects.filter((p) => p.id !== id),
          current: s.current === id ? null : s.current,
        })),
      clear: () => set({ projects: [], current: null }),
    }),
    {
      name: "henosis:projects",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

interface UserState {
  user: User | null;
  /** True until the first /api/me call resolves. */
  loading: boolean;
  /**
   * Open the Google sign-in flow. Resolves once the redirect starts.
   * Pass a path the user should return to after a successful login —
   * defaults to `/projects`.
   */
  signIn: (callbackUrl?: string) => Promise<void>;
  /** Sign out + clear local user state. */
  signOut: () => Promise<void>;
  /** Change the user's plan on the server and refresh local state. */
  setPlan: (plan: Plan) => Promise<void>;
  /** Optimistic bump of the local usage counter after a successful generation. */
  incrementUsage: () => void;
  /** Force-refetch /api/me. */
  refetch: () => Promise<void>;
  /** Internal: replace the user (used by the hydrator). */
  _setUser: (u: User | null) => void;
  /** Internal: set loading flag. */
  _setLoading: (l: boolean) => void;
}

export const useUser = create<UserState>()((set, get) => ({
  user: null,
  loading: true,
  signIn: async (callbackUrl = "/projects") => {
    await nextSignIn("google", { callbackUrl });
  },
  signOut: async () => {
    set({ user: null });
    await nextSignOut({ callbackUrl: "/" });
  },
  setPlan: async (plan) => {
    const res = await fetch("/api/me/tier", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan }),
    });
    if (!res.ok) return;
    const data = (await res.json()) as { user: User };
    set({ user: data.user });
  },
  incrementUsage: () => {
    const u = get().user;
    if (!u) return;
    const used = u.generationsUsed + 1;
    const remaining = u.limit == null ? null : Math.max(0, u.limit - used);
    set({ user: { ...u, generationsUsed: used, remaining } });
  },
  refetch: async () => {
    try {
      const res = await fetch("/api/me");
      if (!res.ok) throw new Error(`${res.status}`);
      const data = (await res.json()) as { user: User | null };
      set({ user: data.user ?? null });
    } catch {
      set({ user: null });
    } finally {
      set({ loading: false });
    }
  },
  _setUser: (user) => set({ user }),
  _setLoading: (loading) => set({ loading }),
}));
