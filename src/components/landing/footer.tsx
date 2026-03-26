import Link from "next/link"
import Logo from "@/components/logo"

const links = [
  { label: "Preços", href: "/#pricing" },
  { label: "Sobre", href: "/about" },
  { label: "Termos", href: "/terms" },
  { label: "Privacidade", href: "/privacy" },
]

export default function Footer() {
  return (
    <footer className="py-8 border-t border-border">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <Logo size="sm" />
          
          <nav className="flex items-center gap-6">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          
          <p className="text-sm text-muted-foreground">
            CurrIA © {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </footer>
  )
}
