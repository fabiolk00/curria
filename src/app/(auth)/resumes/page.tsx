import React from "react"
import type { Metadata } from "next"
import { redirect } from "next/navigation"

export const metadata: Metadata = {
  title: "Minhas Vagas - CurrIA",
  description: "Acompanhe manualmente o status das suas candidaturas.",
}

export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function ResumesPage() {
  redirect("/dashboard")
}
