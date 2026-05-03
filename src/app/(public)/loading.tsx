import { Loader2 } from "lucide-react"

export default function PublicRouteLoading() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-muted/30 px-6">
      <div className="flex items-center gap-3 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-muted-foreground shadow-sm">
        <Loader2 className="h-4 w-4 animate-spin text-foreground" />
        Carregando
      </div>
    </div>
  )
}
