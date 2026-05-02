import { z } from 'zod'

import type { JobTargetingCatalogPack } from '@/lib/agent/job-targeting/catalog/catalog-types'

const nonEmptyStringSchema = z.string().trim().min(1)
const goldenCaseIdsSchema = z.array(nonEmptyStringSchema).min(1)
const unitWeightSchema = z.number().min(0).max(1)

const catalogAuditMetadataSchema = z.object({
  source: nonEmptyStringSchema.optional(),
  owner: nonEmptyStringSchema.optional(),
  updatedAt: nonEmptyStringSchema.optional(),
  notes: nonEmptyStringSchema.optional(),
}).strict()

const catalogAliasSchema = z.object({
  value: nonEmptyStringSchema,
  goldenCaseIds: goldenCaseIdsSchema,
  audit: catalogAuditMetadataSchema.optional(),
}).strict()

const catalogCategoryRelationshipSchema = z.object({
  categoryId: nonEmptyStringSchema,
  goldenCaseIds: goldenCaseIdsSchema,
  rationale: nonEmptyStringSchema.optional(),
  audit: catalogAuditMetadataSchema.optional(),
}).strict()

const catalogTermSchema = z.object({
  id: nonEmptyStringSchema,
  label: nonEmptyStringSchema,
  goldenCaseIds: goldenCaseIdsSchema,
  aliases: z.array(catalogAliasSchema),
  categoryIds: z.array(nonEmptyStringSchema),
  audit: catalogAuditMetadataSchema.optional(),
}).strict()

const catalogCategorySchema = z.object({
  id: nonEmptyStringSchema,
  label: nonEmptyStringSchema,
  goldenCaseIds: goldenCaseIdsSchema,
  parentCategoryIds: z.array(nonEmptyStringSchema).default([]),
  equivalentCategoryIds: z.array(catalogCategoryRelationshipSchema).default([]),
  adjacentCategoryIds: z.array(catalogCategoryRelationshipSchema).default([]),
  audit: catalogAuditMetadataSchema.optional(),
}).strict()

const catalogAntiEquivalenceSchema = z.object({
  leftTermId: nonEmptyStringSchema,
  rightTermId: nonEmptyStringSchema,
  goldenCaseIds: goldenCaseIdsSchema,
  rationale: nonEmptyStringSchema.optional(),
  audit: catalogAuditMetadataSchema.optional(),
}).strict()

export const jobTargetingCatalogPackSchema = z.object({
  id: nonEmptyStringSchema,
  version: nonEmptyStringSchema,
  domain: nonEmptyStringSchema,
  goldenCaseIds: goldenCaseIdsSchema,
  requirementKinds: z.array(z.enum([
    'skill',
    'experience',
    'education',
    'responsibility',
    'preferred',
  ])).min(1),
  scoreDimensions: z.array(z.object({
    id: z.enum(['skills', 'experience', 'education']),
    weight: unitWeightSchema,
  }).strict()).min(1),
  sectionWeights: z.object({
    skills: unitWeightSchema,
    experience: unitWeightSchema,
    education: unitWeightSchema,
  }).strict(),
  adjacentDiscount: unitWeightSchema,
  terms: z.array(catalogTermSchema),
  categories: z.array(catalogCategorySchema),
  antiEquivalences: z.array(catalogAntiEquivalenceSchema),
  audit: catalogAuditMetadataSchema.optional(),
}).strict()

export interface JobTargetingCatalogValidationIssue {
  path: string
  message: string
  code: string
}

export class JobTargetingCatalogValidationError extends Error {
  readonly source: string
  readonly issues: JobTargetingCatalogValidationIssue[]

  constructor(source: string, issues: JobTargetingCatalogValidationIssue[]) {
    const details = issues
      .map((issue) => `${issue.path}: ${issue.message}`)
      .join('; ')
    super(`Invalid job targeting catalog "${source}": ${details}`)
    this.name = 'JobTargetingCatalogValidationError'
    this.source = source
    this.issues = issues
  }
}

function formatPath(path: Array<string | number>): string {
  return path.length > 0 ? path.join('.') : '<root>'
}

function formatIssues(error: z.ZodError): JobTargetingCatalogValidationIssue[] {
  return error.issues.map((issue) => ({
    path: formatPath(issue.path),
    message: issue.message,
    code: issue.code,
  }))
}

export function validateJobTargetingCatalogPack(
  input: unknown,
  source = 'catalog',
): JobTargetingCatalogPack {
  const parsed = jobTargetingCatalogPackSchema.safeParse(input)

  if (!parsed.success) {
    throw new JobTargetingCatalogValidationError(source, formatIssues(parsed.error))
  }

  return parsed.data
}
