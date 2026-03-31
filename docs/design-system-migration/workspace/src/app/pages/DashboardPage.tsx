import { DashboardShell } from "../components/dashboard/DashboardShell"
import { Bot } from "lucide-react"
import { Button } from "../components/ui/button"
import { Link } from "react-router"

export default function DashboardPage() {
  return (
    <DashboardShell>
      <div className="flex flex-col items-center justify-center p-8 text-center min-h-[calc(100vh-4rem)]">
        <div className="w-20 h-20 bg-purple-500/10 rounded-full flex items-center justify-center mb-6">
          <Bot className="w-10 h-10 text-purple-600 dark:text-purple-400" />
        </div>
        <h1 className="text-3xl font-bold mb-4">Bem-vindo ao Curr<span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-indigo-500 dark:from-purple-400 dark:to-indigo-400">IA</span>!</h1>
        <p className="text-muted-foreground max-w-md mx-auto mb-8">
          Você entrou com sucesso na plataforma. A funcionalidade de chat e análise de currículos já está disponível para testes.
        </p>
        <div className="flex gap-4">
          <Button size="lg" className="font-semibold" asChild>
            <Link to="/dashboard/workspace">
              Ir para o Workspace
            </Link>
          </Button>
        </div>
      </div>
    </DashboardShell>
  )
}
