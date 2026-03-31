import { useEffect, useMemo, useState } from "react"

import { Button } from "../ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog"
import { Input } from "../ui/input"
import { Textarea } from "../ui/textarea"
import type {
  ManualEditInput,
  ManualEditSection,
  ManualEditSectionData,
} from "../../types/agent"

type ContactValue = any

const EMPTY_CONTACT = {
  fullName: "",
  email: "",
  phone: "",
  linkedin: "",
  location: "",
}

function isContactValue(value: ManualEditSectionData | null): value is ContactValue {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    "fullName" in value
  )
}

function isExperienceList(value: ManualEditSectionData | null): boolean {
  return Array.isArray(value)
}

function isEducationList(value: ManualEditSectionData | null): boolean {
  return Array.isArray(value)
}

function isCertificationList(value: ManualEditSectionData | null): boolean {
  return Array.isArray(value)
}

function formatSectionTitle(section: ManualEditSection | null): string {
  switch (section) {
    case "contact":
      return "Contato"
    case "summary":
      return "Resumo"
    case "skills":
      return "Skills"
    case "experience":
      return "Experiência"
    case "education":
      return "Educação"
    case "certifications":
      return "Certificações"
    default:
      return "Seção"
  }
}

type ManualEditDialogProps = {
  open: boolean
  section: ManualEditSection | null
  value: ManualEditSectionData | null
  busy: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (input: ManualEditInput) => Promise<void>
}

export function ManualEditDialog({
  open,
  section,
  value,
  busy,
  onOpenChange,
  onSubmit,
}: ManualEditDialogProps) {
  const [contactDraft, setContactDraft] = useState<ContactValue>(EMPTY_CONTACT)
  const [textDraft, setTextDraft] = useState("")
  const [jsonDraft, setJsonDraft] = useState("[]")
  const [error, setError] = useState<string | null>(null)

  const description = useMemo(() => {
    if (section === "skills") {
      return "Edite uma skill por linha. A alteração vai atualizar apenas a base canônica."
    }
    if (section === "contact") {
      return "Atualize apenas os campos de contato que devem permanecer na base canônica."
    }
    if (section === "summary") {
      return "Edite o resumo da base canônica. Variantes por vaga continuam isoladas."
    }
    return "Edite o JSON estruturado desta seção. Somente uma seção é alterada por vez."
  }, [section])

  useEffect(() => {
    if (!open || section === null) {
      return
    }

    setError(null)

    if (section === "contact") {
      setContactDraft(isContactValue(value) ? value : EMPTY_CONTACT)
      return
    }

    if (section === "summary") {
      setTextDraft(typeof value === "string" ? value : "")
      return
    }

    if (section === "skills") {
      setTextDraft(Array.isArray(value) ? value.join("\n") : "")
      return
    }

    if (section === "experience") {
      setJsonDraft(JSON.stringify(isExperienceList(value) ? value : [], null, 2))
      return
    }

    if (section === "education") {
      setJsonDraft(JSON.stringify(isEducationList(value) ? value : [], null, 2))
      return
    }

    setJsonDraft(JSON.stringify(isCertificationList(value) ? value : [], null, 2))
  }, [open, section, value])

  const handleSubmit = async (): Promise<void> => {
    if (section === null) {
      return
    }

    setError(null)

    try {
      if (section === "contact") {
        await onSubmit({
          section: "contact",
          value: contactDraft,
        })
        return
      }

      if (section === "summary") {
        await onSubmit({
          section: "summary",
          value: textDraft,
        })
        return
      }

      if (section === "skills") {
        await onSubmit({
          section: "skills",
          value: textDraft
            .split("\n")
            .map((item) => item.trim())
            .filter((item) => item.length > 0),
        })
        return
      }

      const parsed = JSON.parse(jsonDraft) as unknown

      if (!Array.isArray(parsed)) {
        setError("O conteúdo estruturado deve ser um array JSON.")
        return
      }

      await onSubmit({
        section: section,
        value: parsed,
      })
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Não foi possível salvar."
      setError(message)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Editar {formatSectionTitle(section)}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {section === "contact" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                value={contactDraft.fullName || ''}
                placeholder="Nome completo"
                disabled={busy}
                onChange={(event) =>
                  setContactDraft((previous: any) => ({
                    ...previous,
                    fullName: event.target.value,
                  }))
                }
              />
              <Input
                value={contactDraft.email || ''}
                placeholder="Email"
                disabled={busy}
                onChange={(event) =>
                  setContactDraft((previous: any) => ({
                    ...previous,
                    email: event.target.value,
                  }))
                }
              />
              <Input
                value={contactDraft.phone || ''}
                placeholder="Telefone"
                disabled={busy}
                onChange={(event) =>
                  setContactDraft((previous: any) => ({
                    ...previous,
                    phone: event.target.value,
                  }))
                }
              />
              <Input
                value={contactDraft.linkedin || ''}
                placeholder="LinkedIn"
                disabled={busy}
                onChange={(event) =>
                  setContactDraft((previous: any) => ({
                    ...previous,
                    linkedin: event.target.value,
                  }))
                }
              />
              <Input
                value={contactDraft.location || ''}
                placeholder="Localização"
                className="sm:col-span-2"
                disabled={busy}
                onChange={(event) =>
                  setContactDraft((previous: any) => ({
                    ...previous,
                    location: event.target.value,
                  }))
                }
              />
            </div>
          )}

          {section === "summary" && (
            <Textarea
              value={textDraft}
              disabled={busy}
              rows={10}
              placeholder="Edite o resumo estruturado."
              onChange={(event) => setTextDraft(event.target.value)}
            />
          )}

          {section === "skills" && (
            <Textarea
              value={textDraft}
              disabled={busy}
              rows={10}
              placeholder={"Uma skill por linha\nExemplo:\nTypeScript\nNode.js"}
              onChange={(event) => setTextDraft(event.target.value)}
            />
          )}

          {(section === "experience" ||
            section === "education" ||
            section === "certifications") && (
            <Textarea
              value={jsonDraft}
              disabled={busy}
              rows={16}
              className="font-mono text-xs"
              placeholder="Cole um array JSON válido."
              onChange={(event) => setJsonDraft(event.target.value)}
            />
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={busy || section === null} onClick={() => void handleSubmit()}>
            {busy ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
