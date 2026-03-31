import { Link, useLocation } from "react-router"
import { cn } from "../ui/utils"
import { Button } from "../ui/button"
import { Separator } from "../ui/separator"
import { ScrollArea } from "../ui/scroll-area"
import { Progress } from "../ui/progress"
import {
  MessageSquare,
  FileText,
  HelpCircle,
  Settings,
  LogOut,
  X,
  Coins
} from "lucide-react"

interface DashboardSidebarProps {
  isOpen?: boolean
  onClose?: () => void
}

const navItems = [
  {
    label: "Chat",
    href: "/dashboard",
    icon: MessageSquare,
  },
  {
    label: "Meus Currículos",
    href: "/dashboard/resumes",
    icon: FileText,
  },
  {
    label: "O que é ATS?",
    href: "/what-is-ats",
    icon: HelpCircle,
  },
]

const bottomItems = [
  {
    label: "Configurações",
    href: "/dashboard/settings",
    icon: Settings,
  },
]

export function DashboardSidebar({ isOpen, onClose }: DashboardSidebarProps) {
  const location = useLocation()
  const pathname = location.pathname

  const handleSignOut = () => {
    // Mock signout
    window.location.href = "/"
  }

  return (
    <aside
      className={cn(
        "fixed left-0 top-16 z-40 h-[calc(100vh-4rem)] w-64 border-r border-border bg-sidebar transition-transform duration-300 lg:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}
    >
      <div className="flex h-full flex-col">
        {/* Mobile close button */}
        <div className="flex items-center justify-between p-4 lg:hidden">
          <span className="text-sm font-medium text-sidebar-foreground">Menu</span>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Navigation */}
        <ScrollArea className="flex-1 px-3 py-4">
          <nav className="space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={onClose}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </ScrollArea>

        {/* Bottom Section */}
        <div className="px-3 py-4 mt-auto border-t border-border">
          {/* Credits */}
          <div className="mb-4 px-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-primary">
                <Coins className="h-4 w-4 text-yellow-500" />
                <span className="text-sm font-medium">Créditos</span>
              </div>
              <span className="text-xs font-bold">120 / 200</span>
            </div>
            <Progress value={60} className="h-2" />
            <p className="text-[10px] text-muted-foreground text-center">Reseta em 14 dias</p>
          </div>

          <nav className="space-y-1">
            {bottomItems.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={onClose}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </Link>
              )
            })}
            <button
              onClick={handleSignOut}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-destructive/80 transition-colors hover:bg-destructive/10 hover:text-destructive"
            >
              <LogOut className="h-5 w-5" />
              Sair
            </button>
          </nav>
        </div>
      </div>
    </aside>
  )
}
