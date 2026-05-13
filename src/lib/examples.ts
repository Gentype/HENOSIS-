export interface Example {
  id: string;
  title: string;
  category: string;
  description: string;
  prompt: string;
  accent: string;
}

export const EXAMPLES: Example[] = [
  {
    id: "saas",
    title: "AI SaaS Landing",
    category: "Landing",
    description: "A bold landing page for an AI startup with hero, features, pricing, and CTA.",
    prompt:
      "A dark, premium landing page for an AI startup called Mira that automates customer support. Include a hero with bold headline, a 3-step 'how it works' section, customer logos, a feature grid, testimonials, pricing (3 tiers), an FAQ, and a final call-to-action. Use a sleek black + neon green palette.",
    accent: "from-emerald-300/40 to-emerald-500/10",
  },
  {
    id: "portfolio",
    title: "Designer Portfolio",
    category: "Portfolio",
    description: "Minimalist personal portfolio with case studies and an elegant about page.",
    prompt:
      "A minimalist personal portfolio for a product designer named Lena Park. Include a hero with a subtle photo, a selected works grid (6 case studies), an 'about' block, services list, and a contact section with social links. Editorial typography, generous whitespace, monochrome with one warm accent.",
    accent: "from-stone-300/40 to-stone-500/10",
  },
  {
    id: "restaurant",
    title: "Restaurant Site",
    category: "Restaurant",
    description: "An elegant restaurant site with menu, reservations and gallery.",
    prompt:
      "A modern, elegant website for a Mediterranean restaurant called 'Olea'. Include hero with the restaurant atmosphere, signature dishes section, full menu (3 categories), chef's story, reservation form, gallery, opening hours, and a footer with map and contact info. Warm cream + olive palette.",
    accent: "from-amber-300/40 to-amber-500/10",
  },
  {
    id: "agency",
    title: "Creative Agency",
    category: "Agency",
    description: "A bold agency site with case studies and a confident voice.",
    prompt:
      "A bold creative agency site called Northwind Studio. Include hero with an animated bold headline, what-we-do section (Brand, Web, Motion), case studies grid (4 projects with thumbnails), a process timeline, the team section, awards strip, and contact CTA. Black + electric blue.",
    accent: "from-blue-300/40 to-blue-500/10",
  },
  {
    id: "saas-dashboard",
    title: "Analytics Dashboard",
    category: "Product",
    description: "A marketing page for a product analytics tool with charts mock-ups.",
    prompt:
      "A marketing site for a product analytics tool called Prism. Include a hero with a dashboard screenshot mockup, a feature deep-dive (4 features with side-by-side visuals), customer quotes, integration logos, comparison table vs competitors, pricing, and a CTA. Clean white + indigo palette with subtle gradients.",
    accent: "from-indigo-300/40 to-indigo-500/10",
  },
  {
    id: "ecommerce",
    title: "E-commerce Store",
    category: "E-commerce",
    description: "A boutique e-commerce homepage with featured collections.",
    prompt:
      "A boutique e-commerce homepage for a Scandinavian furniture store called Hjem. Include a hero with a beautiful interior, featured collections (3), best sellers grid, story block about craftsmanship, customer reviews carousel, newsletter signup, and a footer with shipping info. Earthy palette: cream, walnut, charcoal.",
    accent: "from-orange-300/40 to-orange-500/10",
  },
];

export const MODELS: { id: string; label: string; tagline: string; tier: "default" | "pro" }[] = [
  {
    id: "anthropic/claude-sonnet-4.5",
    label: "Claude Sonnet 4.5",
    tagline: "Best for production-quality, well-structured sites.",
    tier: "default",
  },
  {
    id: "anthropic/claude-opus-4.1",
    label: "Claude Opus 4.1",
    tagline: "Highest quality, slower and more expensive.",
    tier: "pro",
  },
  {
    id: "openai/gpt-4o",
    label: "GPT-4o",
    tagline: "Fast, reliable, broad style coverage.",
    tier: "default",
  },
  {
    id: "openai/gpt-4.1",
    label: "GPT-4.1",
    tagline: "Reasoning-heavy, great for complex layouts.",
    tier: "pro",
  },
  {
    id: "google/gemini-2.5-pro",
    label: "Gemini 2.5 Pro",
    tagline: "Excellent multi-page generation.",
    tier: "default",
  },
];

export const DEFAULT_MODEL = MODELS[0].id;
