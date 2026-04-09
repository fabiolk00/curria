import { z } from 'zod'

import {
  CVContactSchema,
  CertificationEntrySchema,
  EducationEntrySchema,
  ExperienceEntrySchema,
} from '@/lib/cv/schema'
import { TOOL_ERROR_CODES, toolFailure } from '@/lib/agent/tool-errors'
import type {
  ManualEditInput,
  ManualEditOutput,
  ToolPatch,
} from '@/types/agent'
import type { CVState } from '@/types/cv'

type ManualEditExecutionResult = {
  output: ManualEditOutput
  patch?: ToolPatch
}

export const ManualEditInputSchema = z.discriminatedUnion('section', [
  z.object({
    section: z.literal('contact'),
    value: CVContactSchema,
  }),
  z.object({
    section: z.literal('summary'),
    value: z.string(),
  }),
  z.object({
    section: z.literal('skills'),
    value: z.array(z.string()),
  }),
  z.object({
    section: z.literal('experience'),
    value: z.array(ExperienceEntrySchema),
  }),
  z.object({
    section: z.literal('education'),
    value: z.array(EducationEntrySchema),
  }),
  z.object({
    section: z.literal('certifications'),
    value: z.array(CertificationEntrySchema),
  }),
])

type ValidatedManualEditInput = z.infer<typeof ManualEditInputSchema>

function buildCvStatePatch(input: ValidatedManualEditInput): Partial<CVState> {
  switch (input.section) {
    case 'contact':
      return input.value
    case 'summary':
      return { summary: input.value }
    case 'skills':
      return { skills: input.value }
    case 'experience':
      return { experience: input.value }
    case 'education':
      return { education: input.value }
    case 'certifications':
      return { certifications: input.value }
  }
}

function buildManualEditPatch(input: ValidatedManualEditInput): ToolPatch {
  return {
    cvState: buildCvStatePatch(input),
  }
}

export async function manualEditSection(input: ManualEditInput): Promise<ManualEditExecutionResult> {
  const parsed = ManualEditInputSchema.safeParse(input)

  if (!parsed.success) {
    return {
      output: toolFailure(TOOL_ERROR_CODES.VALIDATION_ERROR, 'Invalid manual edit payload.'),
    }
  }

  return {
    output: {
      success: true,
      section: parsed.data.section,
      section_data: parsed.data.value,
    },
    patch: buildManualEditPatch(parsed.data),
  }
}
