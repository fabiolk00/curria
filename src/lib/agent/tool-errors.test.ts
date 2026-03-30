import { describe, expect, it } from 'vitest'

import {
  getHttpStatusForToolError,
  getToolErrorMessage,
  isToolErrorCode,
  isToolFailure,
  resolveToolErrorCode,
  TOOL_ERROR_CODES,
  toolFailure,
  toolFailureFromUnknown,
} from './tool-errors'

describe('resolveToolErrorCode', () => {
  it('returns fallback code when input is null', () => {
    expect(resolveToolErrorCode(null)).toBe(TOOL_ERROR_CODES.INTERNAL_ERROR)
  })

  it('returns fallback code when input is undefined', () => {
    expect(resolveToolErrorCode(undefined, TOOL_ERROR_CODES.VALIDATION_ERROR)).toBe(
      TOOL_ERROR_CODES.VALIDATION_ERROR,
    )
  })

  it('returns fallback code for a plain object without code or status', () => {
    expect(resolveToolErrorCode({})).toBe(TOOL_ERROR_CODES.INTERNAL_ERROR)
  })

  it('maps status 429 errors to RATE_LIMITED', () => {
    const error = Object.assign(new Error('Too many requests'), { status: 429 })

    expect(resolveToolErrorCode(error)).toBe(TOOL_ERROR_CODES.RATE_LIMITED)
  })

  it('maps status 401 errors to UNAUTHORIZED', () => {
    const error = Object.assign(new Error('Unauthorized'), { status: 401 })

    expect(resolveToolErrorCode(error)).toBe(TOOL_ERROR_CODES.UNAUTHORIZED)
  })

  it('maps status 404 errors to NOT_FOUND', () => {
    const error = Object.assign(new Error('Missing'), { status: 404 })

    expect(resolveToolErrorCode(error)).toBe(TOOL_ERROR_CODES.NOT_FOUND)
  })

  it('returns fallback code for unknown statuses', () => {
    const error = Object.assign(new Error('Unexpected'), { status: 999 })

    expect(resolveToolErrorCode(error, TOOL_ERROR_CODES.GENERATION_ERROR)).toBe(
      TOOL_ERROR_CODES.GENERATION_ERROR,
    )
  })

  it('extracts the code from a ToolFailure object', () => {
    const failure = toolFailure(TOOL_ERROR_CODES.NOT_FOUND, 'Missing session.')

    expect(resolveToolErrorCode(failure)).toBe(TOOL_ERROR_CODES.NOT_FOUND)
  })

  it('extracts a valid code from a plain object', () => {
    expect(resolveToolErrorCode({ code: TOOL_ERROR_CODES.VALIDATION_ERROR })).toBe(
      TOOL_ERROR_CODES.VALIDATION_ERROR,
    )
  })

  it('returns fallback code for an invalid object code', () => {
    expect(resolveToolErrorCode({ code: 'TYPO_ERROR' })).toBe(TOOL_ERROR_CODES.INTERNAL_ERROR)
  })
})

describe('getToolErrorMessage', () => {
  it('returns undefined when input is null', () => {
    expect(getToolErrorMessage(null)).toBeUndefined()
  })

  it('returns undefined when input is undefined', () => {
    expect(getToolErrorMessage(undefined)).toBeUndefined()
  })

  it('returns undefined for a plain object without message fields', () => {
    expect(getToolErrorMessage({})).toBeUndefined()
  })

  it('extracts the message from Error.message', () => {
    expect(getToolErrorMessage(new Error('Something went wrong'))).toBe('Something went wrong')
  })

  it('extracts the error field from a plain object', () => {
    expect(getToolErrorMessage({ error: 'Custom error text' })).toBe('Custom error text')
  })

  it('extracts the message field from a plain object', () => {
    expect(getToolErrorMessage({ message: 'Custom message' })).toBe('Custom message')
  })

  it('extracts the error field from a ToolFailure object', () => {
    const failure = toolFailure(TOOL_ERROR_CODES.PARSE_ERROR, 'Failed to parse.')

    expect(getToolErrorMessage(failure)).toBe('Failed to parse.')
  })
})

describe('toolFailureFromUnknown', () => {
  it('preserves a message that is exactly 500 characters long', () => {
    const message = 'x'.repeat(500)

    expect(toolFailureFromUnknown(new Error('ignored'), message)).toEqual({
      success: false,
      code: TOOL_ERROR_CODES.INTERNAL_ERROR,
      error: message,
    })
  })

  it('caps a message longer than 500 characters with an ellipsis', () => {
    const message = 'x'.repeat(501)
    const failure = toolFailureFromUnknown(new Error('ignored'), message)

    expect(failure.error).toHaveLength(500)
    expect(failure.error).toBe(`${'x'.repeat(499)}…`)
  })

  it('uses the extracted error message when message is undefined', () => {
    expect(toolFailureFromUnknown(new Error('Connection timeout'))).toEqual({
      success: false,
      code: TOOL_ERROR_CODES.INTERNAL_ERROR,
      error: 'Connection timeout',
    })
  })

  it('uses the extracted error message when message is empty', () => {
    expect(toolFailureFromUnknown(new Error('Failed to parse resume file.'), '')).toEqual({
      success: false,
      code: TOOL_ERROR_CODES.INTERNAL_ERROR,
      error: 'Failed to parse resume file.',
    })
  })

  it('uses the extracted error message when message is whitespace only', () => {
    expect(toolFailureFromUnknown(new Error('Request failed.'), '   ')).toEqual({
      success: false,
      code: TOOL_ERROR_CODES.INTERNAL_ERROR,
      error: 'Request failed.',
    })
  })

  it('falls back to a default message when no message can be extracted', () => {
    expect(toolFailureFromUnknown({ status: 500 })).toEqual({
      success: false,
      code: TOOL_ERROR_CODES.INTERNAL_ERROR,
      error: 'An error occurred.',
    })
  })

  it('prefers the provided message over the extracted one', () => {
    expect(toolFailureFromUnknown(new Error('Connection timeout'), 'Custom context message')).toEqual({
      success: false,
      code: TOOL_ERROR_CODES.INTERNAL_ERROR,
      error: 'Custom context message',
    })
  })

  it('caps extracted fallback messages as well', () => {
    const error = {
      error: 'x'.repeat(501),
    }
    const failure = toolFailureFromUnknown(error)

    expect(failure.error).toHaveLength(500)
    expect(failure.error).toBe(`${'x'.repeat(499)}…`)
  })
})

describe('isToolErrorCode', () => {
  it('accepts a valid tool error code', () => {
    expect(isToolErrorCode(TOOL_ERROR_CODES.VALIDATION_ERROR)).toBe(true)
  })

  it('rejects a misspelled error code', () => {
    expect(isToolErrorCode('MISSPELLED_ERROR')).toBe(false)
  })

  it('rejects null', () => {
    expect(isToolErrorCode(null)).toBe(false)
  })

  it('rejects undefined', () => {
    expect(isToolErrorCode(undefined)).toBe(false)
  })

  it('rejects non-string values', () => {
    expect(isToolErrorCode(123)).toBe(false)
  })
})

describe('isToolFailure', () => {
  it('rejects null', () => {
    expect(isToolFailure(null)).toBe(false)
  })

  it('rejects undefined', () => {
    expect(isToolFailure(undefined)).toBe(false)
  })

  it('rejects partially shaped objects', () => {
    expect(isToolFailure({ success: false, error: 'Missing code.' })).toBe(false)
  })

  it('rejects objects with invalid codes', () => {
    expect(isToolFailure({ success: false, code: 'INVALID_CODE', error: 'msg' })).toBe(false)
  })

  it('accepts a valid tool failure object', () => {
    expect(isToolFailure(toolFailure(TOOL_ERROR_CODES.NOT_FOUND, 'Missing session.'))).toBe(true)
  })
})

describe('tool errors integration', () => {
  it('constructs structured tool failures consistently', () => {
    const failure = toolFailure(TOOL_ERROR_CODES.NOT_FOUND, 'Missing session.')

    expect(failure).toEqual({
      success: false,
      code: 'NOT_FOUND',
      error: 'Missing session.',
    })
  })

  it('derives failures from unknown errors without duplicating code mapping', () => {
    const rateLimitedError = Object.assign(new Error('Too many requests'), { status: 429 })

    expect(toolFailureFromUnknown(rateLimitedError, 'Request failed.')).toEqual({
      success: false,
      code: 'RATE_LIMITED',
      error: 'Request failed.',
    })
    expect(getHttpStatusForToolError(TOOL_ERROR_CODES.RATE_LIMITED)).toBe(429)
  })
})
