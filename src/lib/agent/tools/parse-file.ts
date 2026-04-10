import { AGENT_CONFIG, MODEL_CONFIG } from '@/lib/agent/config'
import { TOOL_ERROR_CODES, toolFailure, toolFailureFromUnknown } from '@/lib/agent/tool-errors'
import { trackApiUsage } from '@/lib/agent/usage-tracker'
import { openai } from '@/lib/openai/client'
import { callOpenAIWithRetry, getChatCompletionText, getChatCompletionUsage } from '@/lib/openai/chat'
import type { ParseFileInput, ParseFileOutput } from '@/types/agent'

export async function parseFile(
  input: ParseFileInput,
  userId?: string,
  sessionId?: string,
  externalSignal?: AbortSignal,
): Promise<ParseFileOutput> {
  try {
    const buffer = Buffer.from(input.file_base64, 'base64')

    if (input.mime_type === 'application/pdf') {
      return await parsePDF(buffer)
    }

    if (input.mime_type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      return await parseDOCX(buffer)
    }

    if (input.mime_type.startsWith('image/')) {
      return await parseImageOCR(buffer, input.mime_type, userId, sessionId, externalSignal)
    }

    return toolFailure(TOOL_ERROR_CODES.VALIDATION_ERROR, `Unsupported mime type: ${input.mime_type}`)
  } catch (error) {
    console.error('[parseFile]', error)
    return toolFailureFromUnknown(error, 'Failed to extract text from file.', TOOL_ERROR_CODES.PARSE_ERROR)
  }
}

async function parsePDF(buffer: Buffer): Promise<ParseFileOutput> {
  const pdfParse = (await import('pdf-parse')).default
  const data = await pdfParse(buffer)

  if (!data.text || data.text.trim().length < 100) {
    return toolFailure(
      TOOL_ERROR_CODES.PARSE_ERROR,
      'PDF_SCANNED - very little text extracted. The file may be image-based. Try uploading a DOCX or use our image upload option.',
    )
  }

  return { success: true, text: data.text.trim(), pageCount: data.numpages }
}

async function parseDOCX(buffer: Buffer): Promise<ParseFileOutput> {
  const mammoth = await import('mammoth')
  const result = await mammoth.extractRawText({ buffer })

  if (!result.value || result.value.trim().length < 100) {
    return toolFailure(TOOL_ERROR_CODES.PARSE_ERROR, 'Could not extract text from DOCX file.')
  }

  return { success: true, text: result.value.trim(), pageCount: 1 }
}

async function parseImageOCR(
  buffer: Buffer,
  mime: string,
  userId?: string,
  sessionId?: string,
  externalSignal?: AbortSignal,
): Promise<ParseFileOutput> {
  const mediaType = mime as 'image/png' | 'image/jpeg'
  const response = await callOpenAIWithRetry(
    (signal) =>
      openai.chat.completions.create(
        {
          model: MODEL_CONFIG.visionModel,
          max_completion_tokens: AGENT_CONFIG.ocrMaxTokens,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:${mediaType};base64,${buffer.toString('base64')}`,
                  },
                },
                {
                  type: 'text',
                  text: 'Extract all text from this resume image. Output only the raw text, preserving the logical reading order. No commentary.',
                },
              ],
            },
          ],
        },
        { signal },
      ),
    3,
    AGENT_CONFIG.timeout,
    externalSignal,
  )

  if (userId) {
    const usage = getChatCompletionUsage(response)
    trackApiUsage({
      userId,
      sessionId,
      model: MODEL_CONFIG.visionModel,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      endpoint: 'ocr',
    }).catch(() => {})
  }

  const text = getChatCompletionText(response)

  if (text.length < 100) {
    return toolFailure(TOOL_ERROR_CODES.PARSE_ERROR, 'Could not read text from image.')
  }

  return { success: true, text: text.trim(), pageCount: 1 }
}
