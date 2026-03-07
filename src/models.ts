import type {
  CostEstimate,
  FindModelResult,
  ModelPricing,
  RawModelData,
  SortField,
} from './types.js';

function parseModels({ data }: { data: RawModelData }): ModelPricing[] {
  const models: ModelPricing[] = [];

  for (const [name, entry] of Object.entries(data)) {
    if (name === 'sample_spec') continue;
    if (entry.mode !== 'chat' && entry.mode !== 'completion') continue;
    if (!entry.input_cost_per_token || !entry.output_cost_per_token) continue;

    models.push({
      name,
      provider: entry.litellm_provider ?? 'unknown',
      inputCostPerMillion: entry.input_cost_per_token * 1_000_000,
      outputCostPerMillion: entry.output_cost_per_token * 1_000_000,
      maxInputTokens: entry.max_input_tokens ?? entry.max_tokens ?? 0,
      maxOutputTokens: entry.max_output_tokens ?? entry.max_tokens ?? 0,
    });
  }

  return models;
}

const sortFns: Record<SortField, (a: ModelPricing, b: ModelPricing) => number> =
  {
    input: (a, b) => a.inputCostPerMillion - b.inputCostPerMillion,
    output: (a, b) => a.outputCostPerMillion - b.outputCostPerMillion,
    name: (a, b) => a.name.localeCompare(b.name),
    provider: (a, b) =>
      a.provider.localeCompare(b.provider) ||
      a.inputCostPerMillion - b.inputCostPerMillion,
  };

function sortModels({
  models,
  by,
}: {
  models: ModelPricing[];
  by: SortField;
}): ModelPricing[] {
  return [...models].sort(sortFns[by]);
}

function filterByProvider({
  models,
  provider,
}: {
  models: ModelPricing[];
  provider: string;
}): ModelPricing[] {
  const p = provider.toLowerCase();
  return models.filter((m) => m.provider.toLowerCase() === p);
}

function searchModels({
  models,
  query,
}: {
  models: ModelPricing[];
  query: string;
}): ModelPricing[] {
  const q = query.toLowerCase();
  return models.filter((m) => m.name.toLowerCase().includes(q));
}

function bigrams({ str }: { str: string }): Set<string> {
  const s = new Set<string>();
  for (let i = 0; i < str.length - 1; i++) {
    s.add(str.slice(i, i + 2));
  }
  return s;
}

function similarity({ a, b }: { a: string; b: string }): number {
  const biA = bigrams({ str: a.toLowerCase() });
  const biB = bigrams({ str: b.toLowerCase() });
  if (biA.size === 0 && biB.size === 0) return 1;
  if (biA.size === 0 || biB.size === 0) return 0;

  let intersection = 0;
  for (const bi of biA) {
    if (biB.has(bi)) intersection++;
  }
  return (2 * intersection) / (biA.size + biB.size);
}

function similarityWithBigrams({
  biA,
  b,
}: {
  biA: Set<string>;
  b: string;
}): number {
  const biB = bigrams({ str: b.toLowerCase() });
  if (biA.size === 0 && biB.size === 0) return 1;
  if (biA.size === 0 || biB.size === 0) return 0;

  let intersection = 0;
  for (const bi of biA) {
    if (biB.has(bi)) intersection++;
  }
  return (2 * intersection) / (biA.size + biB.size);
}

function findModel({
  models,
  query,
}: {
  models: ModelPricing[];
  query: string;
}): FindModelResult {
  const q = query.toLowerCase();

  // 1. Exact match
  const exact = models.find((m) => m.name.toLowerCase() === q);
  if (exact) return { model: exact, suggestions: [] };

  // 2. Substring matches (reuse searchModels)
  const substring = searchModels({ models, query });
  if (substring.length === 1) return { model: substring[0], suggestions: [] };
  if (substring.length > 1 && substring.length <= 10) {
    return { model: null, suggestions: substring };
  }
  if (substring.length > 10) {
    return { model: null, suggestions: substring.slice(0, 5) };
  }

  // 3. Fuzzy suggestions via bigram similarity
  const queryBigrams = bigrams({ str: q });
  const scored = models
    .map((m) => ({
      model: m,
      score: similarityWithBigrams({ biA: queryBigrams, b: m.name }),
    }))
    .filter((s) => s.score > 0.1)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return { model: null, suggestions: scored.map((s) => s.model) };
}

function calculateCost({
  model,
  inputTokens,
  outputTokens,
}: {
  model: ModelPricing;
  inputTokens: number;
  outputTokens: number;
}): CostEstimate {
  const inputCost = (inputTokens / 1_000_000) * model.inputCostPerMillion;
  const outputCost = (outputTokens / 1_000_000) * model.outputCostPerMillion;

  return {
    model: model.name,
    inputTokens,
    outputTokens,
    inputCost,
    outputCost,
    totalCost: inputCost + outputCost,
  };
}

function parseTokenCount({ value }: { value: string }): number {
  const cleaned = value.trim().toLowerCase();

  if (cleaned.endsWith('m')) {
    return parseFloat(cleaned.slice(0, -1)) * 1_000_000;
  }
  if (cleaned.endsWith('k')) {
    return parseFloat(cleaned.slice(0, -1)) * 1_000;
  }
  if (cleaned.endsWith('b')) {
    return parseFloat(cleaned.slice(0, -1)) * 1_000_000_000;
  }

  const num = parseInt(cleaned, 10);
  if (isNaN(num)) {
    throw new Error(
      `Invalid token count: "${value}". Use numbers like 1000, 100K, or 1M.`,
    );
  }
  return num;
}

function getProviders({
  models,
}: {
  models: ModelPricing[];
}): { name: string; count: number }[] {
  const providerMap = new Map<string, number>();
  for (const m of models) {
    providerMap.set(m.provider, (providerMap.get(m.provider) ?? 0) + 1);
  }
  return [...providerMap.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

export {
  parseModels,
  sortModels,
  filterByProvider,
  searchModels,
  findModel,
  calculateCost,
  parseTokenCount,
  getProviders,
  similarity,
};
