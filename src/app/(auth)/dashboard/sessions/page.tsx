import { Metadata } from "next"
import { SessionsList } from "@/components/dashboard/sessions-list"

export const metadata: Metadata = {
  title: "Sessões - CurrIA",
  description: "Visualize suas sessões anteriores",
}

export default async function SessionsPage() {
  return (
    <div className="h-full flex flex-col bg-[#faf9f5]">
      <div className="flex-1 flex flex-col min-h-0 p-6">
        <h1 className="text-3xl font-bold mb-6">Histórico de currículos</h1>
        <SessionsList />
      </div>
    </div>
  )
}
