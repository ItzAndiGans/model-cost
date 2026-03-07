import pc from 'picocolors';
import type { CostEstimate, ModelPricing } from './types.js';

function padRight({
  str,
  len,
}: {
  str: string;
  len: number;
}): string {
  if (str.length > len) return str.slice(0, len - 1) + '\u2026';
  return str + ' '.repeat(len - str.length);
}

function padLeft({
  str,
  len,
}: {
  str: string;
  len: number;
}): string {
  if (str.length >= len) return str;
  return ' '.repeat(len - str.length) + str;
}

function formatTokens({ count }: { count: number }): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(count % 1_000_000 === 0 ? 0 : 1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(count % 1_000 === 0 ? 0 : 1)}K`;
  return count.toString();
}

function formatCurrency({ amount }: { amount: number }): string {
  if (amount === 0) return '$0.00';
  if (amount < 0.005) return `$${amount.toFixed(4)}`;
  if (amount < 0.05) return `$${amount.toFixed(3)}`;
  return `$${amount.toFixed(2)}`;
}

function formatNumber({ num }: { num: number }): string {
  return num.toLocaleString('en-US');
}

const PROVIDER_COL = 18;
const MODEL_COL = 46;
const COST_COL = 12;
const CTX_COL = 10;

function formatTableHeader(): string {
  const header = [
    padRight({ str: 'Provider', len: PROVIDER_COL }),
    padRight({ str: 'Model', len: MODEL_COL }),
    padLeft({ str: 'Input/1M', len: COST_COL }),
    padLeft({ str: 'Output/1M', len: COST_COL }),
    padLeft({ str: 'Context', len: CTX_COL }),
  ].join('');

  const line = pc.dim('-'.repeat(PROVIDER_COL + MODEL_COL + COST_COL * 2 + CTX_COL));

  return `  ${pc.dim(header)}\n  ${line}`;
}

function formatTableRow({ model }: { model: ModelPricing }): string {
  const provider = padRight({ str: model.provider, len: PROVIDER_COL });
  const name = padRight({ str: model.name, len: MODEL_COL });
  const input = padLeft({
    str: formatCurrency({ amount: model.inputCostPerMillion }),
    len: COST_COL,
  });
  const output = padLeft({
    str: formatCurrency({ amount: model.outputCostPerMillion }),
    len: COST_COL,
  });
  const ctx = padLeft({
    str: model.maxInputTokens > 0 ? formatTokens({ count: model.maxInputTokens }) : '-',
    len: CTX_COL,
  });

  return `  ${pc.dim(provider)}${name}${pc.green(input)}${pc.yellow(output)}${pc.dim(ctx)}`;
}

function formatTable({ models }: { models: ModelPricing[] }): string {
  const lines = [formatTableHeader()];
  for (const model of models) {
    lines.push(formatTableRow({ model }));
  }
  return lines.join('\n');
}

function col({
  text,
  width,
  color,
}: {
  text: string;
  width: number;
  color?: (s: string) => string;
}): string {
  const padded = padRight({ str: text, len: width });
  return color ? color(padded) : padded;
}

function formatComparison({ models }: { models: ModelPricing[] }): string {
  const labelCol = 18;
  const modelCol = 24;
  const lines: string[] = [];

  // Header row with model names
  let header = padRight({ str: '', len: labelCol });
  for (const m of models) {
    header += pc.bold(padRight({ str: m.name, len: modelCol }));
  }
  lines.push(`  ${header}`);

  const totalWidth = labelCol + modelCol * models.length;
  lines.push(`  ${pc.dim('-'.repeat(totalWidth))}`);

  // Build rows: [label, color?, getValue]
  const rows: {
    label: string;
    getValue: (m: ModelPricing) => string;
    color?: (s: string) => string;
  }[] = [
    { label: 'Provider', getValue: (m) => m.provider },
    { label: 'Input / 1M', getValue: (m) => formatCurrency({ amount: m.inputCostPerMillion }), color: pc.green },
    { label: 'Output / 1M', getValue: (m) => formatCurrency({ amount: m.outputCostPerMillion }), color: pc.yellow },
    { label: 'Max Input', getValue: (m) => m.maxInputTokens > 0 ? formatTokens({ count: m.maxInputTokens }) : '-' },
    { label: 'Max Output', getValue: (m) => m.maxOutputTokens > 0 ? formatTokens({ count: m.maxOutputTokens }) : '-' },
  ];

  for (const row of rows) {
    let line = col({ text: row.label, width: labelCol, color: pc.dim });
    for (const m of models) {
      line += col({ text: row.getValue(m), width: modelCol, color: row.color });
    }
    lines.push(`  ${line}`);
  }

  return lines.join('\n');
}

function formatCostEstimate({ estimate }: { estimate: CostEstimate }): string {
  const labelCol = 12;
  const tokensCol = 22;
  const lines: string[] = [];

  lines.push(`  ${pc.bold(estimate.model)}`);
  lines.push('');

  lines.push(
    `  ${pc.dim(padRight({ str: 'Input', len: labelCol }))}${padRight({ str: formatNumber({ num: estimate.inputTokens }) + ' tokens', len: tokensCol })}${pc.green(formatCurrency({ amount: estimate.inputCost }))}`,
  );
  lines.push(
    `  ${pc.dim(padRight({ str: 'Output', len: labelCol }))}${padRight({ str: formatNumber({ num: estimate.outputTokens }) + ' tokens', len: tokensCol })}${pc.yellow(formatCurrency({ amount: estimate.outputCost }))}`,
  );

  const divider = pc.dim('-'.repeat(labelCol + tokensCol + 10));
  lines.push(`  ${divider}`);
  lines.push(
    `  ${pc.bold(padRight({ str: 'Total', len: labelCol }))}${padRight({ str: '', len: tokensCol })}${pc.bold(pc.green(formatCurrency({ amount: estimate.totalCost })))}`,
  );

  return lines.join('\n');
}

function formatProviders({
  providers,
}: {
  providers: { name: string; count: number }[];
}): string {
  const lines: string[] = [];
  const nameCol = 30;

  lines.push(
    `  ${pc.dim(padRight({ str: 'Provider', len: nameCol }))}${pc.dim('Models')}`,
  );
  lines.push(`  ${pc.dim('-'.repeat(nameCol + 8))}`);

  for (const p of providers) {
    lines.push(
      `  ${padRight({ str: p.name, len: nameCol })}${pc.dim(p.count.toString())}`,
    );
  }

  return lines.join('\n');
}

function formatSuggestions({
  query,
  suggestions,
}: {
  query: string;
  suggestions: ModelPricing[];
}): string {
  const lines: string[] = [];
  lines.push(`  ${pc.red('✖')} Model ${pc.bold(`"${query}"`)} not found.`);

  if (suggestions.length > 0) {
    lines.push('');
    lines.push(`  ${pc.dim('Did you mean:')}`);
    for (const s of suggestions) {
      lines.push(`    ${pc.green('-')} ${s.name} ${pc.dim(`(${s.provider})`)}`);
    }
  }

  return lines.join('\n');
}

export {
  formatTable,
  formatComparison,
  formatCostEstimate,
  formatProviders,
  formatSuggestions,
  formatCurrency,
  formatTokens,
  formatNumber,
  padRight,
  padLeft,
};
