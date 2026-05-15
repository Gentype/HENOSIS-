"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Project, User, ChatMessage } from "./types";
import { DEFAULT_MODEL } from "./examples";

interface DraftState {
  prompt: string;
  model: string;
  setPrompt: (p: string) => void;
  setModel: (m: string) => void;
  reset: () => void;
}

export const useDraft = create<DraftState>()(
  persist(
    (set) => ({
      prompt: "",
      model: DEFAULT_MODEL,
      setPrompt: (prompt) => set({ prompt }),
      setModel: (model) => set({ model }),
      reset: () => set({ prompt: "", model: DEFAULT_MODEL }),
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
  signIn: (email: string, name?: string) => void;
  signOut: () => void;
  setPlan: (plan: User["plan"]) => void;
  incrementUsage: () => void;
}

export const useUser = create<UserState>()(
  persist(
    (set) => ({
      user: null,
      signIn: (email, name) =>
        set({
          user: {
            email,
            name: name ?? email.split("@")[0],
            plan: "free",
            generationsUsed: 0,
            joinedAt: Date.now(),
          },
        }),
      signOut: () => set({ user: null }),
      setPlan: (plan) =>
        set((s) => (s.user ? { user: { ...s.user, plan } } : s)),
      incrementUsage: () =>
        set((s) =>
          s.user
            ? { user: { ...s.user, generationsUsed: s.user.generationsUsed + 1 } }
            : s,
        ),
    }),
    {
      name: "henosis:user",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
