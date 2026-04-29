# Quick Task 260428-upq Validation Plan

This file satisfies the Nyquist validation requirement for the split quick-full plans. Every execution plan has automated checks, and the reviewer-required checks are called out explicitly.

## Plan 01: Smart Generation Canonical Route And Start Lock

Automated checks:

```bash
npx vitest run src/app/api/profile/smart-generation/route.test.ts src/app/api/profile/ats-enhancement/route.test.ts src/lib/agent/job-targeting-start-lock.test.ts src/components/resume/user-data-page.test.tsx
npm run test:e2e -- --project=chromium tests/e2e/profile-setup.spec.ts
powershell -NoProfile -Command "$hits = @(rg -n --fixed-strings '/api/profile/ats-enhancement' src --glob '!src/app/api/profile/ats-enhancement/route.ts' --glob '!src/app/api/profile/ats-enhancement/route.test.ts' --glob '!**/*.test.ts' --glob '!**/*.test.tsx' --glob '!**/*.md' 2>$null); if ($hits.Count -gt 0) { $hits; exit 1 }"
```

Reviewer-required coverage:
- Start-lock raw-log privacy tests must spy on `logInfo`, `logWarn`, and `logError`, serialize logger arguments, and assert fake raw resume/job sentinel values are absent.
- Static old ATS route caller guard is the `rg --fixed-strings '/api/profile/ats-enhancement'` command above.
- Smart route tests must cover insufficient credits, ATS duplicate starts, job-target duplicate starts, old ATS wrapper delegation, and PDF-only response shape.

## Plan 02a: Profile Setup And App Layout Non-Chat Ungating

Automated checks:

```bash
npx vitest run "src/app/(auth)/profile-setup/page.test.tsx" "src/app/(auth)/layout.test.tsx"
```

Reviewer-required coverage:
- Profile setup must render for authenticated no-chat users and fail the test if `getAiChatAccess` is called.
- Authenticated layout must render for authenticated no-chat users and fail the test if `getAiChatAccess` is called.

## Plan 02b: Session History API And File Access Ownership Coverage

Automated checks:

```bash
npx vitest run "src/app/(auth)/dashboard/sessions/page.test.tsx" src/app/api/session/route.test.ts "src/app/api/session/[id]/route.test.ts" "src/app/api/session/[id]/compare/route.test.ts" "src/app/api/session/[id]/versions/route.test.ts" "src/app/api/file/[sessionId]/route.test.ts"
```

Reviewer-required coverage:
- Non-chat tests must prove history, session list GET, preview/comparison/version routes, and file access do not require AI-chat entitlement.
- Ownership coverage must prove file/session owners are allowed and non-owners remain denied.
- `POST /api/session` must remain blocked to prevent credit bypass.

## Plan 02c: True Chat Gate And Normalized Grep Proof

Automated checks:

```bash
npx vitest run "src/app/(auth)/chat/page.test.tsx" src/app/api/agent/route.test.ts "src/app/api/session/[id]/messages/route.test.ts" "src/app/api/session/[id]/ai-chat-snapshot/route.test.ts"
powershell -NoProfile -Command "$allowed = @('src/app/(auth)/chat/page.tsx','src/lib/agent/request-orchestrator.ts','src/app/api/session/[id]/messages/route.ts','src/app/api/session/[id]/ai-chat-snapshot/route.ts','src/lib/billing/ai-chat-access.ts','src/lib/billing/ai-chat-access.server.ts'); $hits = @(rg -n 'getAiChatAccess|AiChatAccessCard' src/app src/components src/lib --glob '!**/*.test.ts' --glob '!**/*.test.tsx' 2>$null | ForEach-Object { $_ -replace '\\','/' }); $bad = $hits | Where-Object { $line = $_; -not ($allowed | Where-Object { $line.StartsWith($_ + ':') }) }; if ($bad) { $bad; exit 1 }; foreach ($path in $allowed[0..3]) { if (-not (Select-String -LiteralPath $path -Pattern 'getAiChatAccess|AiChatAccessCard' -Quiet)) { Write-Error ('Missing true chat gate: ' + $path); exit 1 } }"
```

Reviewer-required coverage:
- True chat tests must prove `/chat`, `/api/agent`, `/api/session/[id]/messages`, and `/api/session/[id]/ai-chat-snapshot` remain gated for no-chat users.
- The normalized grep converts `\` to `/` before allowlist comparison so Windows path separators do not produce false results.
- The grep also proves the four true-chat source paths still contain a chat gate.

## Plan 03a: Guided Generation Navigation

Automated checks:

```bash
npx vitest run "src/app/(auth)/dashboard/page.test.tsx" src/lib/routes/app.test.ts src/components/dashboard/sidebar.test.tsx
powershell -NoProfile -Command "$bad = @(rg -n 'Nova conversa|Chat com IA' src/components/dashboard/sidebar.tsx src/lib/dashboard/welcome-guide.ts 2>$null); if ($bad.Count -gt 0) { $bad; exit 1 }"
```

Required coverage:
- `/dashboard` default and canonicalized dashboard paths point to `/profile-setup`.
- `/dashboard?session=<id>` still preserves the session-specific comparison/preview route.
- Sidebar primary CTA points to guided generation/profile setup.
- Welcome guide does not point users to chat/session steps.

## Plan 03b: Pricing And Landing PDF-Only Copy

Automated checks:

```bash
npx vitest run src/components/landing/pricing-comparison-table.test.tsx src/components/landing/pricing-section.test.tsx
powershell -NoProfile -Command "$bad = @(rg -n 'Chat com IA|DOCX|docx' src/lib/plans.ts src/lib/pricing src/components/landing 2>$null); if ($bad.Count -gt 0) { $bad; exit 1 }"
```

Required coverage:
- Pricing/comparison copy has no `Chat com IA`, `DOCX`, or `docx` in the edited user-facing pricing/landing surfaces.
- Pricing comparison no longer has a `chatIA` property or a chat feature row.
- Plan feature lists and ATS landing copy advertise PDF output only.

## Plan 04a: Generate File PDF-Only Artifact Renderer

Automated checks:

```bash
npx vitest run src/lib/agent/tools/generate-file.test.ts src/components/dashboard/preview-panel.test.tsx
```

Reviewer-required coverage:
- `generate_file` tests must prove only PDF render/upload/sign behavior is active.
- `docxUrl` remains present only as nullable compatibility in output/state shape.
- Preview tests must not require active DOCX output.

## Plan 04b: PDF-Only Import Boundary

Automated checks:

```bash
npx vitest run src/lib/agent/tools/parse-file.test.ts src/lib/agent/tools/index.test.ts src/lib/agent/request-orchestrator.test.ts src/components/dashboard/chat-interface.test.tsx
```

Reviewer-required coverage:
- Parser tests prove DOCX MIME input is rejected with a PDF-only validation/tool failure.
- Tool schema/index/orchestrator tests prove DOCX is not advertised or allowed.
- Chat upload UI tests prove `.docx` is not accepted and PDF upload remains allowed.
- `request-orchestrator.ts` must preserve the true-chat entitlement gate verified by Plan 02c.

## Plan 04c: Remove DOCX Template Scripts And Dependencies

Automated checks:

```bash
powershell -NoProfile -Command "if (Test-Path 'src/lib/templates/create-template.ts') { Write-Error 'create-template.ts still exists'; exit 1 }; if (Test-Path 'src/lib/templates/test-template.ts') { Write-Error 'test-template.ts still exists'; exit 1 }; $bad = @(rg -n 'template:create|template:test' package.json 2>$null); if ($bad.Count -gt 0) { $bad; exit 1 }"
powershell -NoProfile -Command "$bad = @(rg -n '\"docx\"|\"mammoth\"|node_modules/docx|node_modules/mammoth|docx@|mammoth@|template:create|template:test' package.json package-lock.json pnpm-lock.yaml 2>$null); if ($bad.Count -gt 0) { $bad; exit 1 }"
powershell -NoProfile -Command "$bad = @(rg -n 'generateDOCX|buildDocxDocument|mammoth|application/vnd.openxmlformats-officedocument.wordprocessingml.document|\.docx|DOCX' src --glob '!**/*.test.ts' --glob '!**/*.test.tsx' --glob '!src/types/**' --glob '!src/lib/db/**' --glob '!src/lib/resume-history/**' 2>$null); if ($bad.Count -gt 0) { $bad; exit 1 }"
powershell -NoProfile -Command "$required = @('docxPath','docxUrl','output_docx_path'); foreach ($pattern in $required) { $hit = @(rg -n $pattern src/types src/lib/db prisma 2>$null | Select-Object -First 1); if ($hit.Count -eq 0) { Write-Error ('Missing historical compatibility field: ' + $pattern); exit 1 } }"
npm run typecheck
```

Reviewer-required coverage:
- DOCX dependency removal check includes `package.json`, `package-lock.json`, and `pnpm-lock.yaml`.
- Active DOCX behavior grep checks source for renderer/import/MIME/extension markers while excluding historical compatibility layers.
- Compatibility-field check proves nullable DOCX persistence/type fields were not removed.

## Final Combined Gate

Run after all split plans complete:

```bash
npx vitest run src/app/api/profile/smart-generation/route.test.ts src/app/api/profile/ats-enhancement/route.test.ts src/lib/agent/job-targeting-start-lock.test.ts src/components/resume/user-data-page.test.tsx "src/app/(auth)/profile-setup/page.test.tsx" "src/app/(auth)/layout.test.tsx" "src/app/(auth)/dashboard/sessions/page.test.tsx" "src/app/(auth)/chat/page.test.tsx" src/app/api/session/route.test.ts "src/app/api/session/[id]/route.test.ts" "src/app/api/session/[id]/compare/route.test.ts" "src/app/api/session/[id]/versions/route.test.ts" "src/app/api/file/[sessionId]/route.test.ts" src/app/api/agent/route.test.ts "src/app/api/session/[id]/messages/route.test.ts" "src/app/api/session/[id]/ai-chat-snapshot/route.test.ts" "src/app/(auth)/dashboard/page.test.tsx" src/lib/routes/app.test.ts src/components/dashboard/sidebar.test.tsx src/components/landing/pricing-comparison-table.test.tsx src/components/landing/pricing-section.test.tsx src/lib/agent/tools/generate-file.test.ts src/lib/agent/tools/parse-file.test.ts src/lib/agent/tools/index.test.ts src/lib/agent/request-orchestrator.test.ts src/components/dashboard/chat-interface.test.tsx src/components/dashboard/preview-panel.test.tsx
npm run typecheck
npm run test:e2e -- --project=chromium tests/e2e/profile-setup.spec.ts
powershell -NoProfile -Command "$hits = @(rg -n --fixed-strings '/api/profile/ats-enhancement' src --glob '!src/app/api/profile/ats-enhancement/route.ts' --glob '!src/app/api/profile/ats-enhancement/route.test.ts' --glob '!**/*.test.ts' --glob '!**/*.test.tsx' --glob '!**/*.md' 2>$null); if ($hits.Count -gt 0) { $hits; exit 1 }"
powershell -NoProfile -Command "$allowed = @('src/app/(auth)/chat/page.tsx','src/lib/agent/request-orchestrator.ts','src/app/api/session/[id]/messages/route.ts','src/app/api/session/[id]/ai-chat-snapshot/route.ts','src/lib/billing/ai-chat-access.ts','src/lib/billing/ai-chat-access.server.ts'); $hits = @(rg -n 'getAiChatAccess|AiChatAccessCard' src/app src/components src/lib --glob '!**/*.test.ts' --glob '!**/*.test.tsx' 2>$null | ForEach-Object { $_ -replace '\\','/' }); $bad = $hits | Where-Object { $line = $_; -not ($allowed | Where-Object { $line.StartsWith($_ + ':') }) }; if ($bad) { $bad; exit 1 }; foreach ($path in $allowed[0..3]) { if (-not (Select-String -LiteralPath $path -Pattern 'getAiChatAccess|AiChatAccessCard' -Quiet)) { Write-Error ('Missing true chat gate: ' + $path); exit 1 } }"
powershell -NoProfile -Command "$bad = @(rg -n 'Nova conversa|Chat com IA' src/components/dashboard/sidebar.tsx src/lib/dashboard/welcome-guide.ts 2>$null); if ($bad.Count -gt 0) { $bad; exit 1 }"
powershell -NoProfile -Command "$bad = @(rg -n 'Chat com IA|DOCX|docx' src/lib/plans.ts src/lib/pricing src/components/landing 2>$null); if ($bad.Count -gt 0) { $bad; exit 1 }"
powershell -NoProfile -Command "$bad = @(rg -n '\"docx\"|\"mammoth\"|node_modules/docx|node_modules/mammoth|docx@|mammoth@|template:create|template:test' package.json package-lock.json pnpm-lock.yaml 2>$null); if ($bad.Count -gt 0) { $bad; exit 1 }"
powershell -NoProfile -Command "$bad = @(rg -n 'generateDOCX|buildDocxDocument|mammoth|application/vnd.openxmlformats-officedocument.wordprocessingml.document|\.docx|DOCX' src --glob '!**/*.test.ts' --glob '!**/*.test.tsx' --glob '!src/types/**' --glob '!src/lib/db/**' --glob '!src/lib/resume-history/**' 2>$null); if ($bad.Count -gt 0) { $bad; exit 1 }"
powershell -NoProfile -Command "$required = @('docxPath','docxUrl','output_docx_path'); foreach ($pattern in $required) { $hit = @(rg -n $pattern src/types src/lib/db prisma 2>$null | Select-Object -First 1); if ($hit.Count -eq 0) { Write-Error ('Missing historical compatibility field: ' + $pattern); exit 1 } }"
```
