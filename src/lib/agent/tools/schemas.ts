import { z } from 'zod'

const ParseFileInputSchema = z.object({
  file_base64: z.string(),
  mime_type: z.enum([
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/png',
    'image/jpeg',
  ]),
})

const ScoreATSInputSchema = z.object({
  resume_text: z.string(),
  job_description: z.string().optional(),
})

const AnalyzeGapInputSchema = z.object({
  target_job_description: z.string(),
})

const ApplyGapActionInputSchema = z.object({
  item_type: z.enum(['missing_skill', 'weak_area', 'suggestion']),
  item_value: z.string(),
})

const RewriteSectionInputSchema = z.object({
  section: z.enum(['summary', 'experience', 'skills', 'education', 'certifications']),
  current_content: z.string(),
  instructions: z.string(),
  target_keywords: z.array(z.string()).optional(),
})

const CreateTargetResumeInputSchema = z.object({
  target_job_description: z.string(),
})

const SetPhaseInputSchema = z.object({
  phase: z.enum(['intake', 'analysis', 'dialog', 'confirm', 'generation']),
  reason: z.string().optional(),
})

const GenerateFileInputSchema = z.object({
  cv_state: z.object({
    fullName: z.string(),
    email: z.string(),
    phone: z.string(),
    linkedin: z.string().optional(),
    location: z.string().optional(),
    summary: z.string(),
    experience: z.array(z.record(z.unknown())),
    skills: z.array(z.unknown()),
    education: z.array(z.record(z.unknown())),
    certifications: z.array(z.record(z.unknown())).optional(),
  }).passthrough(),
  target_id: z.string().optional(),
  idempotency_key: z.string().min(1).max(200).optional(),
})

/**
 * Maps tool names to their input Zod schemas.
 * Used by `executeTool` to validate tool arguments before dispatching.
 */
export const TOOL_INPUT_SCHEMAS: Record<string, z.ZodType> = {
  parse_file: ParseFileInputSchema,
  score_ats: ScoreATSInputSchema,
  analyze_gap: AnalyzeGapInputSchema,
  apply_gap_action: ApplyGapActionInputSchema,
  rewrite_section: RewriteSectionInputSchema,
  create_target_resume: CreateTargetResumeInputSchema,
  set_phase: SetPhaseInputSchema,
  generate_file: GenerateFileInputSchema,
}
