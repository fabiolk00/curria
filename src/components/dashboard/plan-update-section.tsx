"use client"

import { useState } from "react"

import { CreditCard } from "lucide-react"

import { Button } from "@/components/ui/button"
import { PlanUpdateDialog } from "@/components/dashboard/plan-update-dialog"
import { PlanSlug } from "@/lib/plans"

interface PlanUpdateSectionProps {
  activeRecurringPlan: PlanSlug | null
  currentCredits: number
}

export function PlanUpdateSection({ activeRecurringPlan, currentCredits }: PlanUpdateSectionProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  return (
    <>
      <Button
        variant="outline"
        className="rounded-full"
        onClick={() => setIsDialogOpen(true)}
      >
        <CreditCard className="mr-2 h-4 w-4" />
        Alterar plano
      </Button>

      <PlanUpdateDialog
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        activeRecurringPlan={activeRecurringPlan}
        currentCredits={currentCredits}
      />
    </>
  )
}
