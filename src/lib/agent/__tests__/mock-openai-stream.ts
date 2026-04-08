type MockChunk = {
  choices: Array<{
    delta: {
      content?: string
      tool_calls?: Array<{
        index?: number
        id?: string
        function?: {
          name?: string
          arguments?: string
        }
      }>
    }
    finish_reason: string | null
  }>
  usage?: {
    prompt_tokens: number
    completion_tokens: number
  } | null
}

export async function* mockTextStream(content: string): AsyncGenerator<MockChunk> {
  const words = content.split(' ')

  for (const word of words) {
    yield {
      choices: [{
        delta: { content: `${word} ` },
        finish_reason: null,
      }],
      usage: null,
    }
  }

  yield {
    choices: [{
      delta: {},
      finish_reason: 'stop',
    }],
    usage: null,
  }

  yield {
    choices: [],
    usage: {
      prompt_tokens: 10,
      completion_tokens: words.length,
    },
  }
}

export async function* mockToolCallStream(
  toolName: string,
  args: Record<string, unknown>,
): AsyncGenerator<MockChunk> {
  const argsStr = JSON.stringify(args)
  const chunkSize = 10

  yield {
    choices: [{
      delta: {
        tool_calls: [{
          index: 0,
          id: 'call_test_1',
          function: { name: toolName },
        }],
      },
      finish_reason: null,
    }],
    usage: null,
  }

  for (let index = 0; index < argsStr.length; index += chunkSize) {
    yield {
      choices: [{
        delta: {
          tool_calls: [{
            index: 0,
            function: { arguments: argsStr.slice(index, index + chunkSize) },
          }],
        },
        finish_reason: null,
      }],
      usage: null,
    }
  }

  yield {
    choices: [{
      delta: {},
      finish_reason: 'tool_calls',
    }],
    usage: null,
  }

  yield {
    choices: [],
    usage: {
      prompt_tokens: 12,
      completion_tokens: Math.ceil(argsStr.length / chunkSize),
    },
  }
}

export async function* mockTextThenToolStream(
  text: string,
  toolName: string,
  args: Record<string, unknown>,
): AsyncGenerator<MockChunk> {
  for await (const chunk of mockTextStream(text)) {
    if (chunk.choices[0]?.finish_reason === 'stop') {
      break
    }
    yield chunk
  }

  for await (const chunk of mockToolCallStream(toolName, args)) {
    yield chunk
  }
}

export async function* mockLengthExceededStream(): AsyncGenerator<MockChunk> {
  yield {
    choices: [{
      delta: { content: 'This is a very long response ' },
      finish_reason: null,
    }],
    usage: null,
  }

  yield {
    choices: [{
      delta: {},
      finish_reason: 'length',
    }],
    usage: null,
  }

  yield {
    choices: [],
    usage: {
      prompt_tokens: 10,
      completion_tokens: 10,
    },
  }
}
