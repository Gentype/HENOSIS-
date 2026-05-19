import Link from "next/link";
import { Logo } from "./logo";
import { Github, Twitter, Linkedin, Send } from "lucide-react";

export function Footer() {
  return (
    <footer className="relative mt-28">
      {/* Animated gradient divider — sage glow line marking the
          handoff from "marketing surface" to "footer" with a single
          centered dot punching through. Pure CSS, see globals.css. */}
      <div className="section-divider" />

      <div className="mx-auto max-w-7xl px-5 lg:px-8 pt-14 pb-10 grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-2 space-y-4">
          <Logo size="md" />
          <p className="text-sm text-muted max-w-sm leading-relaxed">
            Build a stunning website from one prompt. Premium AI website builder
            that ships production-ready code in under a minute.
          </p>
          <div className="flex items-center gap-2 pt-1">
            <SocialIcon href="https://github.com" label="GitHub">
              <Github className="w-4 h-4" />
            </SocialIcon>
            <SocialIcon href="https://twitter.com" label="Twitter / X">
              <Twitter className="w-4 h-4" />
            </SocialIcon>
            <SocialIcon href="https://linkedin.com" label="LinkedIn">
              <Linkedin className="w-4 h-4" />
            </SocialIcon>
            <SocialIcon href="mailto:hello@henosis.app" label="Email">
              <Send className="w-4 h-4" />
            </SocialIcon>
          </div>
        </div>

        <FooterColumn
          title="Product"
          links={[
            { href: "/", label: "Home" },
            { href: "/pricing", label: "Pricing" },
            { href: "/projects", label: "Projects" },
            { href: "/generate", label: "Generate" },
          ]}
        />

        <FooterColumn
          title="Account"
          links={[
            { href: "/auth", label: "Sign in" },
            { href: "/auth?mode=signup", label: "Create account" },
            { href: "/profile", label: "Profile" },
          ]}
        />

        <FooterColumn
          title="Legal"
          links={[
            { href: "#", label: "Terms" },
            { href: "#", label: "Privacy" },
            { href: "#", label: "Cookies" },
          ]}
        />
      </div>
      <div className="border-t border-border">
        <div className="mx-auto max-w-7xl px-5 lg:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-subtle">
          <span>© {new Date().getFullYear()} Henosis. All rights reserved.</span>
          <span className="flex items-center gap-2">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-accent opacity-75 animate-ping" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-accent" />
            </span>
            Made with care, shipped fast.
          </span>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: Array<{ href: string; label: string }>;
}) {
  return (
    <div className="space-y-3">
      <div className="text-sm font-medium text-foreground">{title}</div>
      <ul className="space-y-2">
        {links.map((l) => (
          <li key={l.label}>
            <Link
              href={l.href}
              className="footer-link text-sm text-muted hover:text-foreground"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SocialIcon({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      target={href.startsWith("http") ? "_blank" : undefined}
      rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
      className="social-icon"
    >
      {children}
    </Link>
  );
}
