"use client"

import { useEffect, useState, type ReactNode } from "react"
import {
  BadgeCheck,
  BriefcaseBusiness,
  ChevronDown,
  FileText,
  GraduationCap,
  Plus,
  Trash2,
  UserRound,
  Wrench,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import type { CertificationEntry, CVState, EducationEntry, ExperienceEntry } from "@/types/cv"

import type { ResumeData } from "./resume-builder"

type VisualResumeEditorProps = {
  value: CVState
  onChange: (nextValue: CVState) => void
  disabled?: boolean
  onAllSectionsClosedChange?: (allClosed: boolean) => void
  compactMode?: boolean
}

type SectionId =
  | "personal"
  | "summary"
  | "experience"
  | "skills"
  | "education"
  | "certifications"

const emptyExperience = (): ExperienceEntry => ({
  title: "",
  company: "",
  location: "",
  startDate: "",
  endDate: "",
  bullets: [],
})

const emptyEducation = (): EducationEntry => ({
  degree: "",
  institution: "",
  year: "",
  gpa: "",
})

const emptyCertification = (): CertificationEntry => ({
  name: "",
  issuer: "",
  year: "",
})

export function normalizeResumeData(initialData?: ResumeData | null): CVState {
  return {
    fullName: initialData?.fullName ?? "",
    email: initialData?.email ?? "",
    phone: initialData?.phone ?? "",
    linkedin: initialData?.linkedin ?? "",
    location: initialData?.location ?? "",
    summary: initialData?.summary ?? "",
    skills: initialData?.skills ?? [],
    experience: initialData?.experience?.length ? initialData.experience : [emptyExperience()],
    education: initialData?.education?.length ? initialData.education : [emptyEducation()],
    certifications: initialData?.certifications?.length
      ? initialData.certifications
      : [emptyCertification()],
  }
}

function SectionCard({
  title,
  description,
  icon,
  isOpen,
  onToggle,
  compactMode = false,
  children,
}: {
  title: string
  description: string
  icon: ReactNode
  isOpen: boolean
  onToggle: () => void
  compactMode?: boolean
  children: ReactNode
}) {
  return (
    <Card className="gap-0 overflow-hidden rounded-lg border-border py-0 shadow-none">
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "flex w-full items-center gap-4 p-4 text-left transition-colors hover:bg-muted/50",
          compactMode && !isOpen && "py-3",
        )}
        aria-expanded={isOpen}
      >
        <div className="flex items-start gap-4">
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground",
              compactMode && !isOpen && "h-9 w-9",
            )}
          >
            {icon}
          </div>
          <div className="space-y-1">
            <h2
              className={cn(
                "font-medium text-foreground",
                compactMode && !isOpen ? "text-base" : "text-base",
              )}
            >
              {title}
            </h2>
            <p
              className={cn(
                "truncate text-sm text-muted-foreground",
                compactMode && !isOpen && "text-xs",
              )}
            >
              {description}
            </p>
          </div>
        </div>

        <div
          className={cn(
            "ml-auto flex h-5 w-5 items-center justify-center text-muted-foreground",
          )}
        >
          <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} />
        </div>
      </button>

      {isOpen ? (
        <CardContent className="border-t border-border px-4 pb-4 pt-0">
          <div className="pt-4">{children}</div>
        </CardContent>
      ) : null}
    </Card>
  )
}

function ItemCard({
  title,
  onDelete,
  disabled,
  children,
}: {
  title: string
  onDelete: () => void
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {title}
        </h3>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={disabled}
          onClick={onDelete}
          className="rounded-full text-muted-foreground hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 dark:hover:text-red-300"
          aria-label={`Excluir ${title.toLowerCase()}`}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      {children}
    </div>
  )
}

function updateExperienceEntry(
  value: CVState,
  index: number,
  patch: Partial<ExperienceEntry>,
): ExperienceEntry[] {
  return value.experience.map((entry, entryIndex) =>
    entryIndex === index ? { ...entry, ...patch } : entry,
  )
}

function updateEducationEntry(
  value: CVState,
  index: number,
  patch: Partial<EducationEntry>,
): EducationEntry[] {
  return value.education.map((entry, entryIndex) =>
    entryIndex === index ? { ...entry, ...patch } : entry,
  )
}

function updateCertificationEntry(
  value: CVState,
  index: number,
  patch: Partial<CertificationEntry>,
): CertificationEntry[] {
  return (value.certifications ?? []).map((entry, entryIndex) =>
    entryIndex === index ? { ...entry, ...patch } : entry,
  )
}

function removeExperienceEntry(value: CVState, index: number): ExperienceEntry[] {
  const nextEntries = value.experience.filter((_, entryIndex) => entryIndex !== index)
  return nextEntries.length > 0 ? nextEntries : [emptyExperience()]
}

function removeEducationEntry(value: CVState, index: number): EducationEntry[] {
  const nextEntries = value.education.filter((_, entryIndex) => entryIndex !== index)
  return nextEntries.length > 0 ? nextEntries : [emptyEducation()]
}

function removeCertificationEntry(value: CVState, index: number): CertificationEntry[] {
  const nextEntries = (value.certifications ?? []).filter((_, entryIndex) => entryIndex !== index)
  return nextEntries.length > 0 ? nextEntries : [emptyCertification()]
}

export function VisualResumeEditor({
  value,
  onChange,
  disabled = false,
  onAllSectionsClosedChange,
  compactMode = false,
}: VisualResumeEditorProps) {
  const [openSections, setOpenSections] = useState<Record<SectionId, boolean>>({
    personal: true,
    summary: true,
    experience: false,
    skills: true,
    education: false,
    certifications: false,
  })

  useEffect(() => {
    onAllSectionsClosedChange?.(Object.values(openSections).every((isOpen) => !isOpen))
  }, [onAllSectionsClosedChange, openSections])

  const toggleSection = (section: SectionId) => {
    setOpenSections((current) => ({
      ...current,
      [section]: !current[section],
    }))
  }

  return (
    <div className={cn("space-y-3", compactMode && "space-y-3")}>
      <SectionCard
        title="Dados pessoais"
        description="Estrutura visual pronta para receber seus dados manuais ou importados."
        icon={<UserRound className="h-5 w-5" />}
        isOpen={openSections.personal}
        onToggle={() => toggleSection("personal")}
        compactMode={compactMode}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Input
            value={value.fullName}
            placeholder="Nome completo"
            disabled={disabled}
            onChange={(event) => onChange({ ...value, fullName: event.target.value })}
          />
          <Input
            value={value.email}
            placeholder="Email"
            disabled={disabled}
            onChange={(event) => onChange({ ...value, email: event.target.value })}
          />
          <Input
            value={value.phone}
            placeholder="Telefone"
            disabled={disabled}
            onChange={(event) => onChange({ ...value, phone: event.target.value })}
          />
          <Input
            value={value.linkedin ?? ""}
            placeholder="LinkedIn"
            disabled={disabled}
            onChange={(event) => onChange({ ...value, linkedin: event.target.value })}
          />
          <Input
            value={value.location ?? ""}
            placeholder="Localização"
            className="md:col-span-2"
            disabled={disabled}
            onChange={(event) => onChange({ ...value, location: event.target.value })}
          />
        </div>
      </SectionCard>

      <SectionCard
        title="Resumo profissional"
        description="Use este espaço para apresentar sua proposta de valor."
        icon={<FileText className="h-5 w-5" />}
        isOpen={openSections.summary}
        onToggle={() => toggleSection("summary")}
        compactMode={compactMode}
      >
        <Textarea
          value={value.summary}
          rows={6}
          disabled={disabled}
          placeholder="Escreva um resumo curto sobre sua experiência, foco e resultados."
          onChange={(event) => onChange({ ...value, summary: event.target.value })}
        />
      </SectionCard>

      <SectionCard
        title="Experiência"
        description="Cada bloco representa uma experiência profissional."
        icon={<BriefcaseBusiness className="h-5 w-5" />}
        isOpen={openSections.experience}
        onToggle={() => toggleSection("experience")}
        compactMode={compactMode}
      >
        <div className="space-y-4">
          {value.experience.map((item, index) => (
            <ItemCard
              key={`experience-${index}`}
              title={`Experiência ${index + 1}`}
              disabled={disabled}
              onDelete={() =>
                onChange({
                  ...value,
                  experience: removeExperienceEntry(value, index),
                })
              }
            >
              <div className="grid gap-4 md:grid-cols-2">
                <Input
                  value={item.title}
                  placeholder="Cargo"
                  disabled={disabled}
                  onChange={(event) =>
                    onChange({
                      ...value,
                      experience: updateExperienceEntry(value, index, {
                        title: event.target.value,
                      }),
                    })
                  }
                />
                <Input
                  value={item.company}
                  placeholder="Empresa"
                  disabled={disabled}
                  onChange={(event) =>
                    onChange({
                      ...value,
                      experience: updateExperienceEntry(value, index, {
                        company: event.target.value,
                      }),
                    })
                  }
                />
                <Input
                  value={item.location ?? ""}
                  placeholder="Localização"
                  disabled={disabled}
                  onChange={(event) =>
                    onChange({
                      ...value,
                      experience: updateExperienceEntry(value, index, {
                        location: event.target.value,
                      }),
                    })
                  }
                />
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    value={item.startDate}
                    placeholder="Início"
                    disabled={disabled}
                    onChange={(event) =>
                      onChange({
                        ...value,
                        experience: updateExperienceEntry(value, index, {
                          startDate: event.target.value,
                        }),
                      })
                    }
                  />
                  <Input
                    value={item.endDate}
                    placeholder="Fim"
                    disabled={disabled}
                    onChange={(event) =>
                      onChange({
                        ...value,
                        experience: updateExperienceEntry(value, index, {
                          endDate: event.target.value,
                        }),
                      })
                    }
                  />
                </div>
                <Textarea
                  value={item.bullets.join("\n")}
                  rows={5}
                  className="md:col-span-2"
                  disabled={disabled}
                  placeholder={"Uma conquista por linha\nEx.: Liderei uma migração que reduziu custos em 20%."}
                  onChange={(event) =>
                    onChange({
                      ...value,
                      experience: updateExperienceEntry(value, index, {
                        bullets: event.target.value
                          .split("\n")
                          .map((bullet) => bullet.trim())
                          .filter(Boolean),
                      }),
                    })
                  }
                />
              </div>
            </ItemCard>
          ))}

          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            disabled={disabled}
            onClick={() =>
              onChange({
                ...value,
                experience: [...value.experience, emptyExperience()],
              })
            }
          >
            <Plus className="h-4 w-4" />
            Adicionar experiência
          </Button>
        </div>
      </SectionCard>

      <SectionCard
        title="Skills"
        description="Liste habilidades, ferramentas e tecnologias relevantes."
        icon={<Wrench className="h-5 w-5" />}
        isOpen={openSections.skills}
        onToggle={() => toggleSection("skills")}
        compactMode={compactMode}
      >
        <Textarea
          value={value.skills.join("\n")}
          rows={6}
          disabled={disabled}
          placeholder={"Uma skill por linha\nEx.: TypeScript\nReact\nProduct Design"}
          onChange={(event) =>
            onChange({
              ...value,
              skills: event.target.value
                .split("\n")
                .map((skill) => skill.trim())
                .filter(Boolean),
            })
          }
        />
      </SectionCard>

      <SectionCard
        title="Educação"
        description="Adicione formações acadêmicas e cursos relevantes."
        icon={<GraduationCap className="h-5 w-5" />}
        isOpen={openSections.education}
        onToggle={() => toggleSection("education")}
        compactMode={compactMode}
      >
        <div className="space-y-4">
          {value.education.map((item, index) => (
            <ItemCard
              key={`education-${index}`}
              title={`Formação ${index + 1}`}
              disabled={disabled}
              onDelete={() =>
                onChange({
                  ...value,
                  education: removeEducationEntry(value, index),
                })
              }
            >
              <div className="grid gap-4 md:grid-cols-2">
                <Input
                  value={item.degree}
                  placeholder="Curso ou graduação"
                  disabled={disabled}
                  onChange={(event) =>
                    onChange({
                      ...value,
                      education: updateEducationEntry(value, index, {
                        degree: event.target.value,
                      }),
                    })
                  }
                />
                <Input
                  value={item.institution}
                  placeholder="Instituição"
                  disabled={disabled}
                  onChange={(event) =>
                    onChange({
                      ...value,
                      education: updateEducationEntry(value, index, {
                        institution: event.target.value,
                      }),
                    })
                  }
                />
                <Input
                  value={item.year}
                  placeholder="Ano"
                  disabled={disabled}
                  onChange={(event) =>
                    onChange({
                      ...value,
                      education: updateEducationEntry(value, index, {
                        year: event.target.value,
                      }),
                    })
                  }
                />
                <Input
                  value={item.gpa ?? ""}
                  placeholder="Informação complementar"
                  disabled={disabled}
                  onChange={(event) =>
                    onChange({
                      ...value,
                      education: updateEducationEntry(value, index, {
                        gpa: event.target.value,
                      }),
                    })
                  }
                />
              </div>
            </ItemCard>
          ))}

          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            disabled={disabled}
            onClick={() =>
              onChange({
                ...value,
                education: [...value.education, emptyEducation()],
              })
            }
          >
            <Plus className="h-4 w-4" />
            Adicionar formação
          </Button>
        </div>
      </SectionCard>

      <SectionCard
        title="Certificações"
        description="Mantenha esta seção pronta para certificados e credenciais."
        icon={<BadgeCheck className="h-5 w-5" />}
        isOpen={openSections.certifications}
        onToggle={() => toggleSection("certifications")}
        compactMode={compactMode}
      >
        <div className="space-y-4">
          {(value.certifications ?? []).map((item, index) => (
            <ItemCard
              key={`certification-${index}`}
              title={`Certificação ${index + 1}`}
              disabled={disabled}
              onDelete={() =>
                onChange({
                  ...value,
                  certifications: removeCertificationEntry(value, index),
                })
              }
            >
              <div className="grid gap-4 md:grid-cols-3">
                <Input
                  value={item.name}
                  placeholder="Certificação"
                  disabled={disabled}
                  onChange={(event) =>
                    onChange({
                      ...value,
                      certifications: updateCertificationEntry(value, index, {
                        name: event.target.value,
                      }),
                    })
                  }
                />
                <Input
                  value={item.issuer}
                  placeholder="Emissor"
                  disabled={disabled}
                  onChange={(event) =>
                    onChange({
                      ...value,
                      certifications: updateCertificationEntry(value, index, {
                        issuer: event.target.value,
                      }),
                    })
                  }
                />
                <Input
                  value={item.year ?? ""}
                  placeholder="Ano"
                  disabled={disabled}
                  onChange={(event) =>
                    onChange({
                      ...value,
                      certifications: updateCertificationEntry(value, index, {
                        year: event.target.value,
                      }),
                    })
                  }
                />
              </div>
            </ItemCard>
          ))}

          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            disabled={disabled}
            onClick={() =>
              onChange({
                ...value,
                certifications: [...(value.certifications ?? []), emptyCertification()],
              })
            }
          >
            <Plus className="h-4 w-4" />
            Adicionar certificação
          </Button>
        </div>
      </SectionCard>
    </div>
  )
}
