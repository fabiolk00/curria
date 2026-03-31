import { useState } from "react"
import Header from "../header"
import { DashboardSidebar } from "./DashboardSidebar"

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen bg-background">
      {/* We can use the existing header here, maybe add a prop or just wrap it */}
      <Header onMenuClick={() => setSidebarOpen(true)} />

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-background/80 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <DashboardSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main content - with left margin for sidebar on desktop (changed from right to left) */}
      <main className="lg:ml-64">
        {children}
      </main>
    </div>
  )
}
