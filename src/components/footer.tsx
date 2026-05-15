import Link from "next/link";
import { Logo } from "./logo";

export function Footer() {
  return (
    <footer className="border-t border-border mt-20">
      <div className="mx-auto max-w-7xl px-5 lg:px-8 py-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-3">
          <Logo size="md" />
          <p className="text-sm text-muted max-w-xs">
            Build a stunning website from one prompt. Premium AI website builder.
          </p>
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
          <span>Made with care, shipped fast.</span>
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
              className="text-sm text-muted hover:text-foreground transition-colors"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
