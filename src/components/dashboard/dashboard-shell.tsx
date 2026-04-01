"use client"

import { useState } from "react"
import { Menu } from "lucide-react"

import { Button } from "@/components/ui/button"

import { DashboardSidebar } from "./sidebar"

interface DashboardShellProps {
  children: React.ReactNode
  creditsRemaining?: number
  maxCredits?: number
  renewsIn?: string | null
}

export default function DashboardShell({
  children,
  creditsRemaining,
  maxCredits,
  renewsIn,
}: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen bg-background">
      {!sidebarOpen ? (
        <Button
          variant="outline"
          size="icon"
          className="fixed left-4 top-4 z-50 rounded-full bg-background/95 shadow-lg backdrop-blur lg:hidden"
          onClick={() => setSidebarOpen(true)}
          aria-label="Abrir menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
      ) : null}

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-background/80 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <DashboardSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        creditsRemaining={creditsRemaining}
        maxCredits={maxCredits}
        renewsIn={renewsIn ?? undefined}
      />

      <main className="min-h-screen lg:ml-64">{children}</main>
    </div>
  )
}
