import { describe, it, expect } from 'vitest';
import {
  parseModels,
  sortModels,
  filterByProvider,
  searchModels,
  findModel,
  calculateCost,
  parseTokenCount,
  getProviders,
  similarity,
} from '../src/models.js';
import type { ModelPricing, RawModelData } from '../src/types.js';

const MOCK_DATA: RawModelData = {
  sample_spec: {
    input_cost_per_token: 0,
    output_cost_per_token: 0,
    litellm_provider: 'sample',
    mode: 'chat',
  },
  'claude-sonnet-4-6': {
    input_cost_per_token: 0.000003,
    output_cost_per_token: 0.000015,
    litellm_provider: 'anthropic',
    max_input_tokens: 200000,
    max_output_tokens: 64000,
    mode: 'chat',
  },
  'gpt-4o': {
    input_cost_per_token: 0.0000025,
    output_cost_per_token: 0.00001,
    litellm_provider: 'openai',
    max_input_tokens: 128000,
    max_output_tokens: 16384,
    mode: 'chat',
  },
  'deepseek-chat': {
    input_cost_per_token: 0.00000014,
    output_cost_per_token: 0.00000028,
    litellm_provider: 'deepseek',
    max_input_tokens: 64000,
    max_output_tokens: 8192,
    mode: 'chat',
  },
  'text-embedding-ada-002': {
    input_cost_per_token: 0.0000001,
    litellm_provider: 'openai',
    mode: 'embedding',
  },
  'dall-e-3': {
    litellm_provider: 'openai',
    mode: 'image_generation',
  },
};

describe('parseModels', () => {
  it('parses chat models with pricing', () => {
    const models = parseModels({ data: MOCK_DATA });
    expect(models).toHaveLength(3);
  });

  it('skips sample_spec entry', () => {
    const models = parseModels({ data: MOCK_DATA });
    expect(models.find((m) => m.name === 'sample_spec')).toBeUndefined();
  });

  it('skips embedding and image models', () => {
    const models = parseModels({ data: MOCK_DATA });
    expect(models.find((m) => m.name === 'text-embedding-ada-002')).toBeUndefined();
    expect(models.find((m) => m.name === 'dall-e-3')).toBeUndefined();
  });

  it('converts cost per token to cost per million', () => {
    const models = parseModels({ data: MOCK_DATA });
    const claude = models.find((m) => m.name === 'claude-sonnet-4-6');
    expect(claude?.inputCostPerMillion).toBe(3);
    expect(claude?.outputCostPerMillion).toBe(15);
  });

  it('sets provider from litellm_provider', () => {
    const models = parseModels({ data: MOCK_DATA });
    const gpt = models.find((m) => m.name === 'gpt-4o');
    expect(gpt?.provider).toBe('openai');
  });
});

describe('sortModels', () => {
  const models = parseModels({ data: MOCK_DATA });

  it('sorts by input cost ascending', () => {
    const sorted = sortModels({ models, by: 'input' });
    expect(sorted[0].name).toBe('deepseek-chat');
    expect(sorted[sorted.length - 1].name).toBe('claude-sonnet-4-6');
  });

  it('sorts by output cost ascending', () => {
    const sorted = sortModels({ models, by: 'output' });
    expect(sorted[0].name).toBe('deepseek-chat');
  });

  it('sorts by name alphabetically', () => {
    const sorted = sortModels({ models, by: 'name' });
    expect(sorted[0].name).toBe('claude-sonnet-4-6');
  });

  it('sorts by provider then input cost', () => {
    const sorted = sortModels({ models, by: 'provider' });
    expect(sorted[0].provider).toBe('anthropic');
  });

  it('does not mutate original array', () => {
    const original = [...models];
    sortModels({ models, by: 'input' });
    expect(models).toEqual(original);
  });
});

describe('filterByProvider', () => {
  const models = parseModels({ data: MOCK_DATA });

  it('filters by exact provider name', () => {
    const filtered = filterByProvider({ models, provider: 'openai' });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].name).toBe('gpt-4o');
  });

  it('filters case-insensitively', () => {
    const filtered = filterByProvider({ models, provider: 'ANTHROPIC' });
    expect(filtered).toHaveLength(1);
  });

  it('filters by exact provider name', () => {
    const filtered = filterByProvider({ models, provider: 'deepseek' });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].name).toBe('deepseek-chat');
  });

  it('does not match partial provider names', () => {
    const filtered = filterByProvider({ models, provider: 'deep' });
    expect(filtered).toHaveLength(0);
  });

  it('returns empty for unknown provider', () => {
    const filtered = filterByProvider({ models, provider: 'nonexistent' });
    expect(filtered).toHaveLength(0);
  });
});

describe('searchModels', () => {
  const models = parseModels({ data: MOCK_DATA });

  it('finds models by substring', () => {
    const results = searchModels({ models, query: 'claude' });
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('claude-sonnet-4-6');
  });

  it('is case-insensitive', () => {
    const results = searchModels({ models, query: 'GPT' });
    expect(results).toHaveLength(1);
  });

  it('returns empty for no matches', () => {
    const results = searchModels({ models, query: 'nonexistent' });
    expect(results).toHaveLength(0);
  });
});

describe('findModel', () => {
  const models = parseModels({ data: MOCK_DATA });

  it('finds exact match', () => {
    const result = findModel({ models, query: 'gpt-4o' });
    expect(result.model?.name).toBe('gpt-4o');
    expect(result.suggestions).toHaveLength(0);
  });

  it('finds exact match case-insensitively', () => {
    const result = findModel({ models, query: 'GPT-4o' });
    expect(result.model?.name).toBe('gpt-4o');
  });

  it('auto-resolves when only one substring match', () => {
    const result = findModel({ models, query: 'deepseek' });
    expect(result.model?.name).toBe('deepseek-chat');
  });

  it('returns suggestions for multiple substring matches', () => {
    // Both claude and deepseek won't match same substring, so test with broader data
    const manyModels: ModelPricing[] = [
      { name: 'claude-opus-4-6', provider: 'anthropic', inputCostPerMillion: 15, outputCostPerMillion: 75, maxInputTokens: 200000, maxOutputTokens: 32000 },
      { name: 'claude-sonnet-4-6', provider: 'anthropic', inputCostPerMillion: 3, outputCostPerMillion: 15, maxInputTokens: 200000, maxOutputTokens: 64000 },
      { name: 'claude-haiku-4-5', provider: 'anthropic', inputCostPerMillion: 0.8, outputCostPerMillion: 4, maxInputTokens: 200000, maxOutputTokens: 8192 },
    ];
    const result = findModel({ models: manyModels, query: 'claude' });
    expect(result.model).toBeNull();
    expect(result.suggestions.length).toBeGreaterThan(1);
  });

  it('returns fuzzy suggestions when no substring match', () => {
    const result = findModel({ models, query: 'antropic-sonet' });
    expect(result.model).toBeNull();
    expect(result.suggestions.length).toBeGreaterThan(0);
  });
});

describe('calculateCost', () => {
  it('calculates cost correctly', () => {
    const model: ModelPricing = {
      name: 'test-model',
      provider: 'test',
      inputCostPerMillion: 10,
      outputCostPerMillion: 30,
      maxInputTokens: 128000,
      maxOutputTokens: 4096,
    };

    const estimate = calculateCost({
      model,
      inputTokens: 1_000_000,
      outputTokens: 100_000,
    });

    expect(estimate.inputCost).toBe(10);
    expect(estimate.outputCost).toBe(3);
    expect(estimate.totalCost).toBe(13);
    expect(estimate.model).toBe('test-model');
  });

  it('handles zero output tokens', () => {
    const model: ModelPricing = {
      name: 'test',
      provider: 'test',
      inputCostPerMillion: 5,
      outputCostPerMillion: 15,
      maxInputTokens: 128000,
      maxOutputTokens: 4096,
    };

    const estimate = calculateCost({
      model,
      inputTokens: 500_000,
      outputTokens: 0,
    });

    expect(estimate.outputCost).toBe(0);
    expect(estimate.totalCost).toBe(2.5);
  });
});

describe('parseTokenCount', () => {
  it('parses plain numbers', () => {
    expect(parseTokenCount({ value: '1000' })).toBe(1000);
  });

  it('parses K suffix', () => {
    expect(parseTokenCount({ value: '100K' })).toBe(100_000);
    expect(parseTokenCount({ value: '100k' })).toBe(100_000);
  });

  it('parses M suffix', () => {
    expect(parseTokenCount({ value: '1M' })).toBe(1_000_000);
    expect(parseTokenCount({ value: '2.5m' })).toBe(2_500_000);
  });

  it('parses B suffix', () => {
    expect(parseTokenCount({ value: '1B' })).toBe(1_000_000_000);
  });

  it('throws on invalid input', () => {
    expect(() => parseTokenCount({ value: 'abc' })).toThrow('Invalid token count');
  });
});

describe('getProviders', () => {
  const models = parseModels({ data: MOCK_DATA });

  it('returns providers with model counts', () => {
    const providers = getProviders({ models });
    expect(providers.length).toBeGreaterThan(0);
    const openai = providers.find((p) => p.name === 'openai');
    expect(openai?.count).toBe(1);
  });

  it('sorts by count descending', () => {
    const providers = getProviders({ models });
    for (let i = 1; i < providers.length; i++) {
      expect(providers[i - 1].count).toBeGreaterThanOrEqual(providers[i].count);
    }
  });
});

describe('similarity', () => {
  it('returns 1 for identical strings', () => {
    expect(similarity({ a: 'test', b: 'test' })).toBe(1);
  });

  it('returns 0 for completely different strings', () => {
    expect(similarity({ a: 'ab', b: 'yz' })).toBe(0);
  });

  it('returns higher score for more similar strings', () => {
    const close = similarity({ a: 'claude', b: 'claud' });
    const far = similarity({ a: 'claude', b: 'gpt-4o' });
    expect(close).toBeGreaterThan(far);
  });

  it('is case-insensitive', () => {
    expect(similarity({ a: 'Claude', b: 'claude' })).toBe(1);
  });
});
