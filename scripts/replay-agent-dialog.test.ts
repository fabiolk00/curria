import { Writable } from 'node:stream'

import { describe, expect, it, vi } from 'vitest'

import { parseReplayArgs, replayAgentDialog, runCli } from './replay-agent-dialog'

function createBufferStream() {
  let buffer = ''

  const stream = new Writable({
    write(chunk, _encoding, callback) {
      buffer += chunk.toString()
      callback()
    },
  })

  return {
    stream,
    read: () => buffer,
  }
}

function buildSsePayload(events: unknown[]): string {
  return events
    .map((event) => `data: ${JSON.stringify(event)}\n\n`)
    .join('')
}

describe('replay-agent-dialog', () => {
  it('parses required args and defaults to the representative vacancy plus reescreva follow-up', () => {
    const parsed = parseReplayArgs([
      '--url', 'https://curria.example.com',
      '--cookie', '__session=test-cookie',
    ])

    if ('help' in parsed) {
      throw new Error('Expected parsed options, received help result.')
    }

    expect(parsed.url).toBe('https://curria.example.com/api/agent')
    expect(parsed.cookie).toBe('__session=test-cookie')
    expect(parsed.followUpText).toBe('reescreva')
    expect(parsed.format).toBe('json')
    expect(parsed.vacancyText).toContain('Analista de BI Senior')
  })

  it('captures release headers, session reuse, and final assistant text across both turns', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(
        buildSsePayload([
          { type: 'sessionCreated', sessionId: 'sess_replay' },
          { type: 'text', content: 'Recebi a vaga e ela ja ficou salva. ' },
          { type: 'done', sessionId: 'sess_replay', phase: 'analysis', messageCount: 1 },
        ]),
        {
          status: 200,
          headers: {
            'Content-Type': 'text/event-stream',
            'X-Session-Id': 'sess_replay',
            'X-Agent-Release': 'abc123',
            'X-Agent-Release-Source': 'vercel_commit',
            'X-Agent-Resolved-Agent-Model': 'gpt-5-mini',
            'X-Agent-Resolved-Dialog-Model': 'gpt-5-mini',
          },
        },
      ))
      .mockResolvedValueOnce(new Response(
        buildSsePayload([
          { type: 'text', content: 'Posso reescrever agora seu resumo profissional.' },
          { type: 'done', sessionId: 'sess_replay', phase: 'dialog', messageCount: 2 },
        ]),
        {
          status: 200,
          headers: {
            'Content-Type': 'text/event-stream',
            'X-Session-Id': 'sess_replay',
            'X-Agent-Release': 'abc123',
            'X-Agent-Release-Source': 'vercel_commit',
            'X-Agent-Resolved-Agent-Model': 'gpt-5-mini',
            'X-Agent-Resolved-Dialog-Model': 'gpt-5-mini',
          },
        },
      ))

    const result = await replayAgentDialog({
      url: 'https://curria.example.com/api/agent',
      cookie: '__session=test-cookie',
      vacancyText: 'Vaga representativa',
      followUpText: 'reescreva',
      format: 'json',
      timeoutMs: 10_000,
    }, { fetchImpl })

    expect(result.ok).toBe(true)
    expect(result.turns).toHaveLength(2)
    expect(result.turns[0]?.response.sessionId).toBe('sess_replay')
    expect(result.turns[1]?.request.sessionId).toBe('sess_replay')
    expect(result.turns[1]?.response.finalAssistantText).toContain('Posso reescrever agora seu resumo profissional.')

    const secondRequest = JSON.parse(String(fetchImpl.mock.calls[1]?.[1]?.body)) as {
      sessionId?: string
      message?: string
    }
    expect(secondRequest.sessionId).toBe('sess_replay')
    expect(secondRequest.message).toBe('reescreva')
  })

  it('writes a markdown artifact when requested and exits successfully', async () => {
    const stdout = createBufferStream()
    const stderr = createBufferStream()
    const writeFileImpl = vi.fn().mockResolvedValue(undefined)
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(
        buildSsePayload([
          { type: 'sessionCreated', sessionId: 'sess_replay' },
          { type: 'text', content: 'Recebi a vaga. ' },
          { type: 'done', sessionId: 'sess_replay', phase: 'analysis', messageCount: 1 },
        ]),
        {
          status: 200,
          headers: {
            'Content-Type': 'text/event-stream',
            'X-Session-Id': 'sess_replay',
            'X-Agent-Release': 'abc123',
            'X-Agent-Release-Source': 'vercel_commit',
            'X-Agent-Resolved-Agent-Model': 'gpt-5-mini',
            'X-Agent-Resolved-Dialog-Model': 'gpt-5-mini',
          },
        },
      ))
      .mockResolvedValueOnce(new Response(
        buildSsePayload([
          { type: 'text', content: 'Posso reescrever agora seu resumo profissional.' },
          { type: 'done', sessionId: 'sess_replay', phase: 'dialog', messageCount: 2 },
        ]),
        {
          status: 200,
          headers: {
            'Content-Type': 'text/event-stream',
            'X-Session-Id': 'sess_replay',
            'X-Agent-Release': 'abc123',
            'X-Agent-Release-Source': 'vercel_commit',
            'X-Agent-Resolved-Agent-Model': 'gpt-5-mini',
            'X-Agent-Resolved-Dialog-Model': 'gpt-5-mini',
          },
        },
      ))

    const exitCode = await runCli([
      '--url', 'https://curria.example.com',
      '--cookie', '__session=test-cookie',
      '--format', 'markdown',
      '--output', 'tmp/replay.md',
    ], {
      fetchImpl,
      stdout: stdout.stream,
      stderr: stderr.stream,
      writeFileImpl,
    })

    expect(exitCode).toBe(0)
    expect(stderr.read()).toBe('')
    expect(stdout.read()).toContain('PASS: replay artifact written to tmp/replay.md')
    expect(writeFileImpl).toHaveBeenCalledWith(
      'tmp/replay.md',
      expect.stringContaining('# Agent Dialog Replay'),
      'utf8',
    )
    expect(writeFileImpl).toHaveBeenCalledWith(
      'tmp/replay.md',
      expect.stringContaining('Posso reescrever agora seu resumo profissional.'),
      'utf8',
    )
  })
})
