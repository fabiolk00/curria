'use client'

import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Loader2, Plus, Trash2, XIcon } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { useSessionCvState } from '@/hooks/use-session-cv-state'
import { generateResume, saveEditedResume } from '@/lib/dashboard/workspace-client'
import type { CVState } from '@/types/cv'

type Props = {
  sessionId: string
  targetId?: string | null
  scope?: 'base' | 'optimized'
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: (cvState: CVState) => void
}

type Tab = 'summary' | 'experience' | 'education' | 'skills' | 'contact' | 'certifications'

const EMPTY: CVState = {
  fullName: '',
  email: '',
  phone: '',
  linkedin: '',
  location: '',
  summary: '',
  experience: [],
  skills: [],
  education: [],
  certifications: [],
}

const inputClass = 'border-[#e0ddd4] bg-[#fffef9] text-[#2c2a25] placeholder:text-[#9c9789] focus-visible:border-[#b8860b] focus-visible:ring-[#b8860b]/20'
const cardClass = 'rounded-xl border border-[#e0ddd4] bg-[#f7f5ef] p-4'

function normalize(cvState: CVState | null): CVState {
  return {
    ...structuredClone(EMPTY),
    ...(cvState ? structuredClone(cvState) : {}),
    experience: Array.isArray(cvState?.experience) ? [...cvState.experience] : [],
    skills: Array.isArray(cvState?.skills) ? [...cvState.skills] : [],
    education: Array.isArray(cvState?.education) ? [...cvState.education] : [],
    certifications: Array.isArray(cvState?.certifications) ? [...cvState.certifications] : [],
  }
}

function Section({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="space-y-1">
      <h3 className="text-sm font-semibold text-[#2c2a25]">{title}</h3>
      <p className="text-xs text-[#9c9789]">{subtitle}</p>
    </div>
  )
}

export function ResumeEditorModal({
  sessionId,
  targetId = null,
  scope = 'base',
  open,
  onOpenChange,
  onSaved,
}: Props) {
  const effectiveScope = targetId ? 'target' : scope
  const { cvState, isLoading, error, refetch } = useSessionCvState(sessionId, {
    targetId,
    scope: effectiveScope,
  })
  const [activeTab, setActiveTab] = useState<Tab>('summary')
  const [draft, setDraft] = useState<CVState | null>(null)
  const [original, setOriginal] = useState('')
  const [newSkill, setNewSkill] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !cvState) return
    const next = normalize(cvState)
    setDraft(next)
    setOriginal(JSON.stringify(next))
    setNewSkill('')
    setSaveError(null)
  }, [cvState, open])

  const isDirty = useMemo(() => draft ? JSON.stringify(draft) !== original : false, [draft, original])
  const update = (fn: (current: CVState) => CVState) => setDraft((current) => (current ? fn(current) : current))

  const close = () => {
    setSaveError(null)
    setNewSkill('')
    onOpenChange(false)
  }

  const addSkill = () => {
    if (!draft) return
    const skill = newSkill.trim()
    if (!skill || draft.skills.some((item) => item.toLowerCase() === skill.toLowerCase())) {
      setNewSkill('')
      return
    }
    update((current) => ({ ...current, skills: [...current.skills, skill] }))
    setNewSkill('')
  }

  const save = async () => {
    if (!draft) return
    if (!isDirty) {
      close()
      return
    }

    setIsSaving(true)
    setSaveError(null)
    try {
      const saveInput = effectiveScope === 'target'
        ? { scope: 'target' as const, targetId: targetId as string, cvState: draft }
        : effectiveScope === 'optimized'
          ? { scope: 'optimized' as const, cvState: draft }
          : { scope: 'base' as const, cvState: draft }
      await saveEditedResume(sessionId, saveInput)

      await generateResume(
        sessionId,
        effectiveScope === 'target'
          ? { scope: 'target', targetId: targetId as string }
          : { scope: 'base' },
      )

      close()
      onSaved(structuredClone(draft))
      toast.success('Edição salva. Atualizando o PDF.')
    } catch (err) {
      setSaveError(
        err instanceof Error
          ? err.message
          : 'Não foi possível salvar suas alterações e atualizar o PDF.',
      )
    } finally {
      setIsSaving(false)
    }
  }

  const body = !isLoading && !error && draft ? (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18, ease: 'easeInOut' }} className="h-full overflow-y-auto px-5 py-4">
        <TabsContent value="summary" forceMount hidden={activeTab !== 'summary'} className={activeTab === 'summary' ? 'mt-0 space-y-4' : 'hidden'}>
          <Section title="Resumo profissional" subtitle="Seu posicionamento principal para recrutadores." />
          <Textarea rows={6} value={draft.summary} className={`${inputClass} min-h-[160px] resize-none bg-[#f7f5ef]`} onChange={(event) => update((current) => ({ ...current, summary: event.target.value }))} />
          <p className="text-right text-xs text-[#9c9789]">{draft.summary.length} characters</p>
        </TabsContent>

        <TabsContent value="experience" forceMount hidden={activeTab !== 'experience'} className={activeTab === 'experience' ? 'mt-0 space-y-4' : 'hidden'}>
          <div className="flex items-center justify-between gap-3">
            <Section title="Experiência" subtitle="Edite cargos, datas e bullets." />
            <Button type="button" size="sm" className="bg-[#b8860b] text-white hover:bg-[#a47609]" onClick={() => update((current) => ({ ...current, experience: [...current.experience, { title: '', company: '', location: '', startDate: '', endDate: 'present', bullets: [''] }] }))}><Plus className="h-4 w-4" />Adicionar experiência</Button>
          </div>
          {draft.experience.map((item, index) => (
            <div key={`experience-${index}`} className={`${cardClass} space-y-3`}>
              <div className="flex items-start justify-between gap-3">
                <div className="grid flex-1 gap-3 sm:grid-cols-2">
                    <Input placeholder="Cargo" value={item.title} className={inputClass} onChange={(event) => update((current) => ({ ...current, experience: current.experience.map((entry, entryIndex) => entryIndex === index ? { ...entry, title: event.target.value } : entry) }))} />
                  <Input placeholder="Empresa" value={item.company} className={inputClass} onChange={(event) => update((current) => ({ ...current, experience: current.experience.map((entry, entryIndex) => entryIndex === index ? { ...entry, company: event.target.value } : entry) }))} />
                  <Input placeholder="Local" value={item.location ?? ''} className={inputClass} onChange={(event) => update((current) => ({ ...current, experience: current.experience.map((entry, entryIndex) => entryIndex === index ? { ...entry, location: event.target.value } : entry) }))} />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input placeholder="Início" value={item.startDate} className={inputClass} onChange={(event) => update((current) => ({ ...current, experience: current.experience.map((entry, entryIndex) => entryIndex === index ? { ...entry, startDate: event.target.value } : entry) }))} />
                    <Input placeholder="Fim" value={item.endDate} className={inputClass} onChange={(event) => update((current) => ({ ...current, experience: current.experience.map((entry, entryIndex) => entryIndex === index ? { ...entry, endDate: event.target.value } : entry) }))} />
                  </div>
                </div>
                <Button type="button" variant="ghost" size="icon-sm" className="text-[#9c9789] hover:bg-[#fff6ef] hover:text-[#b8860b]" onClick={() => update((current) => ({ ...current, experience: current.experience.filter((_, entryIndex) => entryIndex !== index) }))}><Trash2 className="h-4 w-4" /><span className="sr-only">Remover experiência</span></Button>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-medium uppercase tracking-[0.08em] text-[#b8860b]">Bullets</p>
                  <Button type="button" variant="outline" size="sm" className="border-[#e0ddd4] bg-[#fffef9] text-[#2c2a25]" onClick={() => update((current) => ({ ...current, experience: current.experience.map((entry, entryIndex) => entryIndex === index ? { ...entry, bullets: [...entry.bullets, ''] } : entry) }))}><Plus className="h-4 w-4" />Adicionar bullet</Button>
                </div>
                {item.bullets.map((bullet, bulletIndex) => (
                  <div key={`experience-${index}-bullet-${bulletIndex}`} className="flex gap-2">
                    <Textarea rows={2} placeholder="Descreva impacto e resultado." value={bullet} className={`${inputClass} min-h-[72px] resize-none`} onChange={(event) => update((current) => ({ ...current, experience: current.experience.map((entry, entryIndex) => entryIndex === index ? { ...entry, bullets: entry.bullets.map((entryBullet, entryBulletIndex) => entryBulletIndex === bulletIndex ? event.target.value : entryBullet) } : entry) }))} />
                    <Button type="button" variant="ghost" size="icon-sm" className="shrink-0 text-[#9c9789] hover:bg-[#fff6ef] hover:text-[#b8860b]" onClick={() => update((current) => ({ ...current, experience: current.experience.map((entry, entryIndex) => entryIndex === index ? { ...entry, bullets: entry.bullets.filter((_, entryBulletIndex) => entryBulletIndex !== bulletIndex) } : entry) }))}><Trash2 className="h-4 w-4" /><span className="sr-only">Remover bullet</span></Button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="education" forceMount hidden={activeTab !== 'education'} className={activeTab === 'education' ? 'mt-0 space-y-4' : 'hidden'}>
          <div className="flex items-center justify-between gap-3">
            <Section title="Educação" subtitle="Formação, instituição e ano." />
            <Button type="button" size="sm" className="bg-[#b8860b] text-white hover:bg-[#a47609]" onClick={() => update((current) => ({ ...current, education: [...current.education, { degree: '', institution: '', year: '', gpa: '' }] }))}><Plus className="h-4 w-4" />Adicionar formação</Button>
          </div>
          {draft.education.map((item, index) => (
            <div key={`education-${index}`} className={`${cardClass} space-y-3`}>
              <div className="flex items-start justify-between gap-3">
                <div className="grid flex-1 gap-3 sm:grid-cols-2">
                  <Input placeholder="Curso" value={item.degree} className={inputClass} onChange={(event) => update((current) => ({ ...current, education: current.education.map((entry, entryIndex) => entryIndex === index ? { ...entry, degree: event.target.value } : entry) }))} />
                  <Input placeholder="Instituição" value={item.institution} className={inputClass} onChange={(event) => update((current) => ({ ...current, education: current.education.map((entry, entryIndex) => entryIndex === index ? { ...entry, institution: event.target.value } : entry) }))} />
                  <Input placeholder="Ano" value={item.year} className={inputClass} onChange={(event) => update((current) => ({ ...current, education: current.education.map((entry, entryIndex) => entryIndex === index ? { ...entry, year: event.target.value } : entry) }))} />
                  <Input placeholder="GPA (opcional)" value={item.gpa ?? ''} className={inputClass} onChange={(event) => update((current) => ({ ...current, education: current.education.map((entry, entryIndex) => entryIndex === index ? { ...entry, gpa: event.target.value } : entry) }))} />
                </div>
                <Button type="button" variant="ghost" size="icon-sm" className="text-[#9c9789] hover:bg-[#fff6ef] hover:text-[#b8860b]" onClick={() => update((current) => ({ ...current, education: current.education.filter((_, entryIndex) => entryIndex !== index) }))}><Trash2 className="h-4 w-4" /><span className="sr-only">Remover formação</span></Button>
              </div>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="skills" forceMount hidden={activeTab !== 'skills'} className={activeTab === 'skills' ? 'mt-0 space-y-4' : 'hidden'}>
          <Section title="Skills" subtitle="Adicione ou remova palavras-chave, ferramentas e capacidades." />
          <div className="flex flex-wrap gap-2">
            {draft.skills.map((skill) => (
              <Badge key={skill} variant="outline" className="gap-1 rounded-md border-[#e0ddd4] bg-[#f0ede6] px-2.5 py-1 text-[#5c5647]">
                <span>{skill}</span>
                <button type="button" className="rounded-sm text-[#9c9789] transition hover:text-[#2c2a25]" onClick={() => update((current) => ({ ...current, skills: current.skills.filter((entry) => entry !== skill) }))}><XIcon className="h-4 w-4" /><span className="sr-only">Remover {skill}</span></button>
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Input value={newSkill} placeholder="Adicionar skill" className={inputClass} onChange={(event) => setNewSkill(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addSkill() } }} />
            <Button type="button" className="bg-[#b8860b] text-white hover:bg-[#a47609]" aria-label="Adicionar skill" onClick={addSkill}>Adicionar</Button>
          </div>
        </TabsContent>

        <TabsContent value="contact" forceMount hidden={activeTab !== 'contact'} className={activeTab === 'contact' ? 'mt-0 space-y-4' : 'hidden'}>
          <Section title="Contato" subtitle="Dados pessoais e de contato." />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input placeholder="Nome completo" value={draft.fullName} className={inputClass} onChange={(event) => update((current) => ({ ...current, fullName: event.target.value }))} />
            <Input placeholder="Email" value={draft.email} className={inputClass} onChange={(event) => update((current) => ({ ...current, email: event.target.value }))} />
            <Input placeholder="Telefone" value={draft.phone} className={inputClass} onChange={(event) => update((current) => ({ ...current, phone: event.target.value }))} />
            <Input placeholder="LinkedIn" value={draft.linkedin ?? ''} className={inputClass} onChange={(event) => update((current) => ({ ...current, linkedin: event.target.value }))} />
            <Input placeholder="Localização" value={draft.location ?? ''} className={`${inputClass} sm:col-span-2`} onChange={(event) => update((current) => ({ ...current, location: event.target.value }))} />
          </div>
        </TabsContent>

        <TabsContent value="certifications" forceMount hidden={activeTab !== 'certifications'} className={activeTab === 'certifications' ? 'mt-0 space-y-4' : 'hidden'}>
          <div className="flex items-center justify-between gap-3">
            <Section title="Certificações" subtitle="Certificações profissionais e credenciais." />
            <Button type="button" size="sm" className="bg-[#b8860b] text-white hover:bg-[#a47609]" onClick={() => update((current) => ({ ...current, certifications: [...(current.certifications ?? []), { name: '', issuer: '', year: '' }] }))}><Plus className="h-4 w-4" />Adicionar certificação</Button>
          </div>
          {(draft.certifications ?? []).map((item, index) => (
            <div key={`certification-${index}`} className={`${cardClass} space-y-3`}>
              <div className="flex items-start justify-between gap-3">
                <div className="grid flex-1 gap-3 sm:grid-cols-3">
                  <Input placeholder="Nome da certificação" value={item.name} className={inputClass} onChange={(event) => update((current) => ({ ...current, certifications: (current.certifications ?? []).map((entry, entryIndex) => entryIndex === index ? { ...entry, name: event.target.value } : entry) }))} />
                  <Input placeholder="Emissor" value={item.issuer} className={inputClass} onChange={(event) => update((current) => ({ ...current, certifications: (current.certifications ?? []).map((entry, entryIndex) => entryIndex === index ? { ...entry, issuer: event.target.value } : entry) }))} />
                  <Input placeholder="Ano" value={item.year ?? ''} className={inputClass} onChange={(event) => update((current) => ({ ...current, certifications: (current.certifications ?? []).map((entry, entryIndex) => entryIndex === index ? { ...entry, year: event.target.value } : entry) }))} />
                </div>
                <Button type="button" variant="ghost" size="icon-sm" className="text-[#9c9789] hover:bg-[#fff6ef] hover:text-[#b8860b]" onClick={() => update((current) => ({ ...current, certifications: (current.certifications ?? []).filter((_, entryIndex) => entryIndex !== index) }))}><Trash2 className="h-4 w-4" /><span className="sr-only">Remover certificação</span></Button>
              </div>
            </div>
          ))}
        </TabsContent>
      </motion.div>
    </AnimatePresence>
  ) : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={!isSaving} className="flex max-h-[85vh] max-w-[92vw] flex-col gap-0 overflow-hidden border-[#e8e5dc] bg-[#fffef9] p-0 text-[#2c2a25] sm:max-w-4xl">
        <DialogHeader className="border-b border-[#e8e5dc] px-5 py-4">
          <DialogTitle className="text-base font-bold tracking-[-0.02em] text-[#2c2a25]">Editar currículo</DialogTitle>
          <DialogDescription className="text-xs text-[#9c9789]">Altere as seções e atualize o PDF com a versão salva.</DialogDescription>
        </DialogHeader>
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as Tab)} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <TabsList className="h-auto flex-wrap justify-start gap-1 rounded-none border-b border-[#e8e5dc] bg-transparent px-4 py-3 text-[#9c9789]">
            <TabsTrigger value="summary" className="data-[state=active]:bg-[#f7f5ef] data-[state=active]:text-[#2c2a25]">Resumo</TabsTrigger>
            <TabsTrigger value="experience" className="data-[state=active]:bg-[#f7f5ef] data-[state=active]:text-[#2c2a25]">Experiência</TabsTrigger>
            <TabsTrigger value="education" className="data-[state=active]:bg-[#f7f5ef] data-[state=active]:text-[#2c2a25]">Educação</TabsTrigger>
            <TabsTrigger value="skills" className="data-[state=active]:bg-[#f7f5ef] data-[state=active]:text-[#2c2a25]">Skills</TabsTrigger>
            <TabsTrigger value="contact" className="data-[state=active]:bg-[#f7f5ef] data-[state=active]:text-[#2c2a25]">Contato</TabsTrigger>
            <TabsTrigger value="certifications" className="data-[state=active]:bg-[#f7f5ef] data-[state=active]:text-[#2c2a25]">Certificações</TabsTrigger>
          </TabsList>
          <div className="min-h-0 flex-1 overflow-hidden">
            {isLoading ? <div className="flex h-full items-center justify-center px-5 py-10"><Loader2 className="h-5 w-5 animate-spin text-[#9c9789]" /></div> : null}
            {!isLoading && error ? <div className="flex h-full flex-col items-center justify-center gap-3 px-5 py-10 text-center"><p className="text-sm text-[#9c9789]">{error}</p><Button type="button" variant="outline" className="border-[#e0ddd4] bg-transparent text-[#2c2a25]" onClick={() => void refetch()}>Tentar novamente</Button></div> : null}
            {body}
          </div>
        </Tabs>
        <DialogFooter className="items-center justify-between border-t border-[#e8e5dc] px-5 py-3">
          <p className="text-xs text-[#9c9789]">{saveError ?? 'As alterações salvas atualizam a versão usada no preview e na exportação.'}</p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="border-[#e0ddd4] bg-transparent text-[#2c2a25]" disabled={isSaving} onClick={close}>Cancelar</Button>
            <Button type="button" disabled={isSaving || !draft || isLoading || Boolean(error)} className="bg-[#b8860b] text-white hover:bg-[#a47609]" onClick={() => void save()}>
              {isSaving ? <><Loader2 className="h-4 w-4 animate-spin" />Salvando...</> : 'Salvar e atualizar PDF'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
