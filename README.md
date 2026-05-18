# Henosis

**Live demo: <https://henosis0.vercel.app>**

A premium AI website builder. Describe what you want — Henosis ships a complete, production-ready site in under a minute. Iterate in chat. Preview live. Export, deploy.

Built with **Next.js 16** (App Router), **TypeScript**, **Tailwind v4**, and **OpenRouter** (Claude / GPT-4o / Gemini) with prompt caching for ~90% input token savings on repeated generations.

## Features

- **Prompt to site**: one prompt → full HTML/CSS/JS site, rendered live in a sandboxed iframe.
- **VS Code-style editor** at `/generate`: top menu bar, left AI chat panel, file tree, code viewer, and a Preview/Code toggle. Iterate by chatting with the AI.
- **Three pricing tiers** (Bronze / Silver / Gold) with metal-specific glow animations that intensify on hover.
- **Streaming generation** via Server-Sent Events from `/api/generate` so the UI shows progress as the model writes.
- **Premium minimalist UI** — black + matte white + soft sage-green accent. Animated, glowing hero headline. Custom logo, no off-the-shelf components.
- **Persistent state** via `zustand` + `localStorage`: projects, draft prompt and the (mock) user session survive reloads.
- **No backend required** for the MVP: auth is local, projects are local. Swap in real auth / a database later by replacing the relevant store actions and adding a project DB.

## Pages

- `/` — landing (navbar, hero, prompt box, examples grid, feature strip, final CTA, footer).
- `/auth` — sign in / sign up via Google OAuth (NextAuth v5).
- `/projects` — your generated sites.
- `/profile` — current plan, usage, project counts.
- `/pricing` — Bronze / Silver / Gold animated tier cards.
- `/generate?id=...` — the workshop: chat ↔ preview ↔ code ↔ files.

## Getting started

```bash
npm install
cp .env.example .env.local
# add OPENROUTER_API_KEY to .env.local
npm run dev
```

Open http://localhost:3000.

### Environment variables

`OPENROUTER_API_KEY` — required. Get one from <https://openrouter.ai/keys>.

The system prompt that constrains every generation lives in
[`src/lib/system-prompt.ts`](src/lib/system-prompt.ts). The OpenRouter call in
[`src/lib/generate.ts`](src/lib/generate.ts) passes the prompt with
`cache_control: { type: "ephemeral" }` so Anthropic / OpenRouter caches it and
subsequent generations are dramatically cheaper.

## Scripts

```bash
npm run dev      # next dev (turbopack by default in Next 16)
npm run build    # next build
npm run start    # next start
npm run lint     # eslint
```

## Project layout

```
src/
  app/
    api/generate/route.ts   # streaming endpoint
    auth/page.tsx           # sign in / up
    generate/page.tsx       # the workshop
    pricing/page.tsx        # tier cards (bronze / silver / gold)
    profile/page.tsx
    projects/page.tsx
    page.tsx                # landing
    layout.tsx
    globals.css             # design tokens + animations
  components/
    generate/
      chat-panel.tsx
      code-viewer.tsx
      file-tree.tsx
      menu-bar.tsx
      preview-pane.tsx
    examples-grid.tsx
    footer.tsx
    hero.tsx
    logo.tsx
    model-selector.tsx
    navbar.tsx
    prompt-box.tsx
  lib/
    examples.ts             # example prompts + model list
    generate.ts             # OpenRouter client (streaming + non-streaming)
    store.ts                # zustand stores (user, projects, draft)
    system-prompt.ts        # hard rules baked into every generation
    types.ts
    utils.ts
```

