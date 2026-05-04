import Link from "next/link"

import Logo from "@/components/logo"

const links = [
  { label: "Preços", href: "#pricing" },
  { label: "Termos", href: "/termos" },
  { label: "Privacidade", href: "/privacidade" },
]

export default function Footer() {
  return (
    <footer className="border-t border-border bg-background py-8">
      <div className="container mx-auto px-4">
        <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
          <Logo
            size="sm"
            className="shrink-0"
            textClassName="text-[38px] sm:text-[44px]"
            iconClassName="max-h-10 sm:max-h-11"
          />

          <nav className="flex items-center gap-6">
            {links.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <p className="text-sm text-muted-foreground">&copy; {new Date().getFullYear()}</p>
        </div>
      </div>
    </footer>
  )
}
