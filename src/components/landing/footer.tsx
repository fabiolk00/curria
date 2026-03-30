import Logo from "@/components/logo"

const links = [
  { label: "Preços", href: "#pricing" },
  { label: "Termos", href: "#" },
  { label: "Privacidade", href: "#" },
]

export default function Footer() {
  return (
    <footer className="py-8 border-t border-border bg-background">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <Logo size="sm" />

          <nav className="flex items-center gap-6">
            {links.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <p className="text-sm text-muted-foreground">
            Curr<span className="text-purple-600 dark:text-purple-400">IA</span> © {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </footer>
  )
}
