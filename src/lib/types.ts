export interface GenerateResultMeta {
  title: string;
  description: string;
  primaryColor: string;
  accentColor: string;
  fontPrimary: string;
  fontSecondary: string;
  pages: string[];
}

export interface GenerateResultFile {
  path: string;
  content: string;
  language: string;
}

export interface GenerateResultPreview {
  heroHeadline: string;
  heroSubline: string;
  colorPalette: string[];
  sections: string[];
}

export interface GenerateResult {
  meta: GenerateResultMeta;
  files: GenerateResultFile[];
  preview: GenerateResultPreview;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  status?: "pending" | "streaming" | "done" | "error";
  createdAt: number;
}

export interface Project {
  id: string;
  prompt: string;
  model: string;
  status: "generating" | "done" | "error";
  title: string;
  createdAt: number;
  updatedAt: number;
  result: GenerateResult | null;
  history: ChatMessage[];
}

export interface User {
  email: string;
  name: string;
  plan: "free" | "pro" | "ultra";
  generationsUsed: number;
  joinedAt: number;
}

export const PLAN_LIMITS: Record<User["plan"], number> = {
  free: 3,
  pro: 50,
  ultra: 999,
};
