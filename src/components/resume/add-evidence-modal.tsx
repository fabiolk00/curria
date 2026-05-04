"use client"

import { useEffect, useState, type FormEvent } from "react"
import { CheckCircle2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

export type AddEvidenceFormValues = {
  requirementLabel: string
  where: string
  what: string
  result: string
}

type AddEvidenceModalProps = {
  open: boolean
  requirementLabel: string
  onOpenChange: (open: boolean) => void
  onSubmit: (values: AddEvidenceFormValues) => void | Promise<void>
  onDecline?: () => void
}

export function AddEvidenceModal({
  open,
  requirementLabel,
  onOpenChange,
  onSubmit,
  onDecline,
}: AddEvidenceModalProps) {
  const [where, setWhere] = useState("")
  const [what, setWhat] = useState("")
  const [result, setResult] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setWhere("")
      setWhat("")
      setResult("")
      setSaved(false)
      setError(null)
      setIsSaving(false)
    }
  }, [open])

  const canSubmit = where.trim().length > 0 && what.trim().length > 0 && !isSaving

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!canSubmit) {
      return
    }

    try {
      setIsSaving(true)
      setError(null)
      await onSubmit({
        requirementLabel,
        where: where.trim(),
        what: what.trim(),
        result: result.trim(),
      })
      setSaved(true)
    } catch {
      setError("Não conseguimos salvar agora. Revise as informações e tente novamente.")
    } finally {
      setIsSaving(false)
    }
  }

  const handleDecline = () => {
    onDecline?.()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Você tem experiência real com {requirementLabel}?</DialogTitle>
          <DialogDescription>
            Adicione apenas se isso fizer parte da sua experiência real. Essa informação será salva no seu perfil e usada para gerar uma versão mais alinhada à vaga.
          </DialogDescription>
        </DialogHeader>

        {saved ? (
          <div
            data-testid="add-evidence-success"
            className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"
          >
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
              <p>
                Evidência adicionada ao seu perfil. Agora podemos gerar uma versão mais alinhada com segurança.
              </p>
            </div>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="evidence-where">Onde você usou isso?</Label>
              <Input
                id="evidence-where"
                value={where}
                onChange={(event) => setWhere(event.target.value)}
                placeholder="Ex: Empresa, projeto ou contexto"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="evidence-what">O que você fez?</Label>
              <Textarea
                id="evidence-what"
                value={what}
                onChange={(event) => setWhat(event.target.value)}
                placeholder="Ex: Apoiei conciliação e análise de lançamentos financeiros no fechamento mensal."
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="evidence-result">Qual foi o resultado?</Label>
              <Textarea
                id="evidence-result"
                value={result}
                onChange={(event) => setResult(event.target.value)}
                placeholder="Ex: Reduzi retrabalho, melhorei acompanhamento ou apoiei decisões financeiras."
                rows={3}
              />
            </div>

            {error ? (
              <p className="text-sm text-red-600">{error}</p>
            ) : null}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleDecline}>
                Não tenho essa experiência
              </Button>
              <Button type="submit" disabled={!canSubmit}>
                {isSaving ? "Salvando..." : "Salvar evidência no perfil"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
