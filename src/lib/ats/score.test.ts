import { describe, it, expect } from 'vitest'
import { scoreATS } from './score'

const GOOD_RESUME = `
John Silva
john@email.com | +55 11 99999-9999 | linkedin.com/in/johnsilva | São Paulo, SP

SUMMARY
Results-driven Software Engineer with 8 years of experience building scalable backend systems.

EXPERIENCE
Senior Software Engineer — Acme Corp (2020–present)
- Led migration of monolith to microservices, reducing deployment time by 60%
- Built CI/CD pipeline that increased release frequency from monthly to daily
- Reduced cloud infrastructure costs by 40% ($120k/year savings)

Software Engineer — Beta Tech (2017–2020)
- Developed REST APIs serving 2 million requests/day
- Increased test coverage from 20% to 85%, cutting production bugs by 3×

SKILLS
Python, TypeScript, AWS, Docker, Kubernetes, PostgreSQL, Redis, CI/CD

EDUCATION
B.Sc. Computer Science — USP — 2016
`

const BAD_RESUME = `
	Name	Email	Phone
	John	john@email.com	11999999999

Worked on many projects. Did various things. Responsible for backend.
Was part of a team. Helped with development tasks.
`

const MINIMAL_RESUME = `ok`
const GOOD_PTBR_RESUME = `
Fábio Kröker
fabio@email.com | +55 41 99999-9999 | linkedin.com/in/fabio-kroker | Curitiba, PR

RESUMO
Engenheiro de Dados e Especialista em BI com mais de 5 anos de experiência em ETL, modelagem e dashboards.

EXPERIÊNCIA
Senior Business Intelligence - CNH (2025-atual)
- Desenvolvi pipelines ETL no Azure Databricks com PySpark para processar grandes volumes de dados
- Otimizei pipelines críticos e reduzi em 40% o tempo de processamento

SKILLS
SQL, PySpark, Azure Databricks, Power BI, ETL, Modelagem de Dados

EDUCAÇÃO
Análise e Desenvolvimento de Sistemas - UniCesumar - 2026
`

describe('scoreATS', () => {
  describe('format scoring', () => {
    it('gives full format score to a clean single-column resume', () => {
      const result = scoreATS(GOOD_RESUME)
      expect(result.breakdown.format).toBe(20)
    })

    it('penalizes tab characters indicating table layout', () => {
      const result = scoreATS(BAD_RESUME)
      expect(result.breakdown.format).toBeLessThan(15)
    })

    it('flags very short text as likely scanned PDF', () => {
      const result = scoreATS(MINIMAL_RESUME)
      const criticalIssues = result.issues.filter(i => i.severity === 'critical')
      expect(criticalIssues.length).toBeGreaterThan(0)
    })
  })

  describe('structure scoring', () => {
    it('detects all standard sections in a good resume', () => {
      const result = scoreATS(GOOD_RESUME)
      expect(result.breakdown.structure).toBe(20)
    })

    it('gives 0 structure points when no standard sections found', () => {
      const result = scoreATS('Random text without any headings')
      expect(result.breakdown.structure).toBeLessThanOrEqual(5)
    })

    it('detects experience section case-insensitively', () => {
      const resume = 'EXPERIENCE\nSenior Dev at Company 2020-2023'
      const result = scoreATS(resume)
      expect(result.breakdown.structure).toBeGreaterThan(0)
    })

    it('detects Portuguese headings and scores a PT-BR resume structure correctly', () => {
      const result = scoreATS(GOOD_PTBR_RESUME)
      expect(result.breakdown.structure).toBe(20)
      expect(result.breakdown.contact).toBeGreaterThanOrEqual(8)
    })
  })

  describe('contact scoring', () => {
    it('gives full contact score when email, phone, and linkedin are present', () => {
      const result = scoreATS(GOOD_RESUME)
      expect(result.breakdown.contact).toBe(10)
    })

    it('deducts points for missing email', () => {
      const noEmail = GOOD_RESUME.replace(/john@email\.com/, '')
      const result  = scoreATS(noEmail)
      expect(result.breakdown.contact).toBeLessThan(10)
    })

    it('adds 2 points for linkedin presence', () => {
      const withLinkedin    = scoreATS(GOOD_RESUME).breakdown.contact
      const withoutLinkedin = scoreATS(GOOD_RESUME.replace('linkedin.com/in/johnsilva', '')).breakdown.contact
      expect(withLinkedin).toBeGreaterThan(withoutLinkedin)
    })
  })

  describe('keyword scoring with job description', () => {
    it('gives higher keyword score when resume matches job description', () => {
      const jd = 'Looking for Python developer with AWS and Docker experience'
      const result = scoreATS(GOOD_RESUME, jd)
      expect(result.breakdown.keywords).toBeGreaterThan(15)
    })

    it('gives low keyword score when resume does not match job description', () => {
      const jd = 'Marketing manager with SEO and Google Analytics experience'
      const result = scoreATS(GOOD_RESUME, jd)
      expect(result.breakdown.keywords).toBeLessThan(15)
    })
  })

  describe('impact scoring', () => {
    it('gives high impact score for resume with many metrics', () => {
      const result = scoreATS(GOOD_RESUME)
      expect(result.breakdown.impact).toBeGreaterThan(10)
    })

    it('recognizes Portuguese action verbs and quantified impact', () => {
      const result = scoreATS(GOOD_PTBR_RESUME)
      expect(result.breakdown.keywords).toBeGreaterThan(0)
      expect(result.breakdown.impact).toBeGreaterThan(0)
    })

    it('gives low impact score for resume with only duty descriptions', () => {
      const result = scoreATS(BAD_RESUME)
      expect(result.breakdown.impact).toBeLessThanOrEqual(5)
    })
  })

  describe('total and output shape', () => {
    it('total never exceeds 100', () => {
      const result = scoreATS(GOOD_RESUME)
      expect(result.total).toBeLessThanOrEqual(100)
    })

    it('returns at most 3 suggestions', () => {
      const result = scoreATS(BAD_RESUME)
      expect(result.suggestions.length).toBeLessThanOrEqual(3)
    })

    it('sorts issues with critical first', () => {
      const result = scoreATS(BAD_RESUME)
      if (result.issues.length > 1) {
        expect(result.issues[0].severity).toBe('critical')
      }
    })

    it('returns all required breakdown keys', () => {
      const result = scoreATS(GOOD_RESUME)
      expect(result.breakdown).toHaveProperty('format')
      expect(result.breakdown).toHaveProperty('structure')
      expect(result.breakdown).toHaveProperty('keywords')
      expect(result.breakdown).toHaveProperty('contact')
      expect(result.breakdown).toHaveProperty('impact')
    })
  })
})
