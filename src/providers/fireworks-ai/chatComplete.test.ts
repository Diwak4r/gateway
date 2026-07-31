import { FireworksAIChatCompleteStreamChunkTransform } from './chatComplete';

describe('FireworksAIChatCompleteStreamChunkTransform', () => {
  const baseChunk = {
    id: 'chatcmpl-test123',
    object: 'chat.completion.chunk',
    created: 1234567890,
    model: 'accounts/fireworks/models/llama-v3p1-405b-instruct',
  };

  it('passes through [DONE] sentinel unchanged', () => {
    const result = FireworksAIChatCompleteStreamChunkTransform('data: [DONE]');
    expect(result).toBe('data: [DONE]\n\n');
  });

  it('transforms a normal chunk with a choice', () => {
    const input = JSON.stringify({
      ...baseChunk,
      choices: [
        {
          index: 0,
          delta: { role: 'assistant', content: 'hello' },
          finish_reason: null,
          logprobs: null,
        },
      ],
      usage: null,
    });

    const result = FireworksAIChatCompleteStreamChunkTransform(
      `data: ${input}`
    );

    expect(result).toMatch(/^data: /);
    const parsed = JSON.parse(result.replace(/^data: /, '').trimEnd());
    expect(parsed.choices).toHaveLength(1);
    expect(parsed.choices[0].delta.content).toBe('hello');
    expect(parsed.choices[0].finish_reason).toBeNull();
    expect(parsed).not.toHaveProperty('usage');
  });

  it('emits an empty choices array when chunk has no choices (usage-only delta)', () => {
    // Regression test for https://github.com/Portkey-AI/gateway/issues/1627
    // Fireworks sends usage-only chunks with an empty choices array;
    // previously parsedChunk.choices[0] threw and dropped the chunk.
    const input = JSON.stringify({
      ...baseChunk,
      choices: [],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    });

    expect(() =>
      FireworksAIChatCompleteStreamChunkTransform(`data: ${input}`)
    ).not.toThrow();

    const result = FireworksAIChatCompleteStreamChunkTransform(
      `data: ${input}`
    );
    const parsed = JSON.parse(result.replace(/^data: /, '').trimEnd());

    expect(parsed.choices).toEqual([]);
    expect(parsed.usage).toEqual({
      prompt_tokens: 10,
      completion_tokens: 5,
      total_tokens: 15,
    });
  });

  it('emits an empty choices array when choices key is missing entirely', () => {
    const { choices: _omit, ...chunkWithoutChoices } = {
      ...baseChunk,
      choices: [] as any[],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    };

    const input = JSON.stringify({
      ...baseChunk,
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    });

    expect(() =>
      FireworksAIChatCompleteStreamChunkTransform(`data: ${input}`)
    ).not.toThrow();

    const result = FireworksAIChatCompleteStreamChunkTransform(
      `data: ${input}`
    );
    const parsed = JSON.parse(result.replace(/^data: /, '').trimEnd());
    expect(parsed.choices).toEqual([]);
  });

  it('includes usage when present in chunk', () => {
    const input = JSON.stringify({
      ...baseChunk,
      choices: [
        {
          index: 0,
          delta: {},
          finish_reason: 'stop',
          logprobs: null,
        },
      ],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    });

    const result = FireworksAIChatCompleteStreamChunkTransform(
      `data: ${input}`
    );
    const parsed = JSON.parse(result.replace(/^data: /, '').trimEnd());

    expect(parsed.usage).toEqual({
      prompt_tokens: 10,
      completion_tokens: 5,
      total_tokens: 15,
    });
  });
});
