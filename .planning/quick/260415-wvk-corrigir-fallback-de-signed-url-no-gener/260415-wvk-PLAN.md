# Quick Task 260415-wvk Plan

## Goal

Prevent smart generation from failing when resume signed URL creation fails after the PDF was already generated and persisted.

## Tasks

1. Add a best-effort signed URL fallback in `generate-file.ts` so fresh generations can still complete with `pdfUrl: null` when signing fails.
2. Reuse the same fallback when replaying existing completed generations in `generate-billable-resume.ts` so cached exports do not crash on transient signing issues.
3. Add focused regression tests for fresh generation fallback, completed-generation replay fallback, and the smart-generation route path.
