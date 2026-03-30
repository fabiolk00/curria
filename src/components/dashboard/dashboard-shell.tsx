"use client"

import { useState } from "react"
import { DashboardNavbar } from "./navbar"
import { DashboardSidebar } from "./sidebar"

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen bg-background">
      <DashboardNavbar onMenuClick={() => setSidebarOpen(true)} />

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-background/80 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <DashboardSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main content - with right margin for sidebar on desktop */}
      <main className="lg:mr-64">
        {children}
      </main>
    </div>
  )
}
