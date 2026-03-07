interface RawModelEntry {
  input_cost_per_token?: number;
  output_cost_per_token?: number;
  litellm_provider?: string;
  max_input_tokens?: number;
  max_output_tokens?: number;
  max_tokens?: number;
  mode?: string;
}

type RawModelData = Record<string, RawModelEntry>;

interface ModelPricing {
  name: string;
  provider: string;
  inputCostPerMillion: number;
  outputCostPerMillion: number;
  maxInputTokens: number;
  maxOutputTokens: number;
}

interface CostEstimate {
  model: string;
  inputTokens: number;
  outputTokens: number;
  inputCost: number;
  outputCost: number;
  totalCost: number;
}

interface PriceCache {
  updatedAt: string;
  data: RawModelData;
}

type SortField = 'input' | 'output' | 'name' | 'provider';

interface FindModelResult {
  model: ModelPricing | null;
  suggestions: ModelPricing[];
}

export type {
  RawModelEntry,
  RawModelData,
  ModelPricing,
  CostEstimate,
  PriceCache,
  SortField,
  FindModelResult,
};
