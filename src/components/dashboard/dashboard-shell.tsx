"use client"

import { useState } from "react"

import Header from "@/components/landing/header"

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
      <Header onMenuClick={() => setSidebarOpen(true)} />

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

      <main className="lg:ml-64">{children}</main>
    </div>
  )
}
