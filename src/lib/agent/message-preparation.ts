import { extractUrl } from '@/lib/agent/url-extractor'
import { scrapeJobPosting } from '@/lib/agent/scraper'
import { logInfo, logWarn } from '@/lib/observability/structured-log'

export function sanitizeUserInput(input: string): string {
  return input
    .replace(/<\/?user_resume_data>/gi, '')
    .replace(/<\/?user_resume_text>/gi, '')
    .replace(/<\/?target_job_description>/gi, '')
    .replace(/<\/?system>/gi, '')
    .replace(/<\/?instructions>/gi, '')
    .replace(/<\/?assistant>/gi, '')
    .replace(/<\/?tool_call>/gi, '')
    .replace(/<\/?function>/gi, '')
    .trim()
}

export async function prepareUserMessage(
  rawMessage: string,
  appUserId: string,
  requestId: string,
): Promise<string> {
  let message = sanitizeUserInput(rawMessage)

  const detectedUrl = extractUrl(message)
  if (!detectedUrl) return message

  const scrapeResult = await scrapeJobPosting(detectedUrl)
  const detectedUrlHost = (() => {
    try {
      return new URL(detectedUrl).hostname
    } catch {
      return 'invalid-url'
    }
  })()

  if (scrapeResult.success && scrapeResult.text) {
    const sanitizedScrapedText = sanitizeUserInput(scrapeResult.text)
    message = message.replace(
      detectedUrl,
      `[Link da vaga: ${detectedUrl}]\n\n[ConteÃºdo extraÃ­do automaticamente]:\n${sanitizedScrapedText}`,
    )
    logInfo('agent.scrape.completed', {
      requestId,
      appUserId,
      detectedUrlHost,
      scrapeSucceeded: true,
      scrapedTextLength: scrapeResult.text.length,
      success: true,
    })
  } else {
    logWarn('agent.scrape.completed', {
      requestId,
      appUserId,
      detectedUrlHost,
      scrapeSucceeded: false,
      success: false,
    })
    message = `${message}\n\n[Nota do sistema: Tentei acessar o link ${detectedUrl} mas nÃ£o consegui extrair o conteÃºdo. Motivo: ${scrapeResult.error}]`
  }

  return message
}
