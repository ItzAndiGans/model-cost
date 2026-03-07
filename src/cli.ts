import { Command, Option } from 'commander';
import pc from 'picocolors';
import ora from 'ora';
import { createRequire } from 'node:module';
import { loadPrices, cacheAge } from './prices.js';
import {
  parseModels,
  sortModels,
  filterByProvider,
  searchModels,
  findModel,
  calculateCost,
  parseTokenCount,
  getProviders,
} from './models.js';
import {
  formatTable,
  formatComparison,
  formatCostEstimate,
  formatProviders,
  formatSuggestions,
} from './format.js';
import type { ModelPricing, RawModelData, SortField } from './types.js';

const require = createRequire(import.meta.url);
const { version } = require('../package.json') as { version: string };

interface BaseOptions {
  json?: boolean;
  banner?: boolean;
}

function showBanner({ opts }: { opts: BaseOptions }): void {
  if (opts.banner === false || opts.json) return;
  console.log(`\n  ${pc.bold('model-cost')} ${pc.dim(`v${version}`)}\n`);
}

function showFooter({ updatedAt }: { updatedAt: string }): void {
  console.log(`\n  ${pc.dim(`Updated ${cacheAge({ updatedAt })}`)}`);
}

function fail({ message }: { message: string }): never {
  console.error(`  ${pc.red('✖')} ${message}`);
  process.exit(1);
}

async function fetchModels({
  opts,
  forceUpdate = false,
}: {
  opts: BaseOptions;
  forceUpdate?: boolean;
}): Promise<{ models: ModelPricing[]; updatedAt: string }> {
  const spinner = opts.json ? null : ora('Loading pricing data...').start();

  let data: { data: RawModelData; updatedAt: string };
  try {
    data = await loadPrices({ forceUpdate });
  } catch (err) {
    if (spinner) spinner.fail('Failed to load pricing data');
    const msg = err instanceof Error ? err.message : 'Unknown error';
    fail({ message: msg });
  }

  if (spinner) spinner.stop();
  return { models: parseModels({ data: data.data }), updatedAt: data.updatedAt };
}

function resolveModel({
  models,
  query,
}: {
  models: ModelPricing[];
  query: string;
}): ModelPricing {
  const result = findModel({ models, query });
  if (result.model) return result.model;

  console.log(formatSuggestions({ query, suggestions: result.suggestions }));
  process.exit(1);
}

// --- CLI ---

const program = new Command();

program
  .name('model-cost')
  .description('Compare LLM API pricing from your terminal.')
  .version(version, '-v, --version');

// List models (default)
program
  .argument('[search]', 'search models by name')
  .option('-p, --provider <name>', 'filter by provider')
  .option('-s, --sort <field>', 'sort by: input, output, name, provider', 'input')
  .option('-n, --limit <count>', 'number of models to show', '20')
  .option('-a, --all', 'show all models (no limit)')
  .option('-j, --json', 'output as JSON')
  .option('-u, --update', 'force refresh pricing data')
  .addOption(new Option('--no-banner').hideHelp())
  .action(async (search: string | undefined, opts: BaseOptions & {
    provider?: string;
    sort: string;
    limit: string;
    all?: boolean;
    update?: boolean;
  }) => {
    showBanner({ opts });

    const { models: allModels, updatedAt } = await fetchModels({ opts, forceUpdate: opts.update });
    let models = allModels;

    if (opts.provider) {
      models = filterByProvider({ models, provider: opts.provider });
      if (models.length === 0) {
        const providers = getProviders({ models: allModels });
        console.log(`  ${pc.red('✖')} No models found for provider ${pc.bold(`"${opts.provider}"`)}.`);
        console.log('');
        console.log(`  ${pc.dim('Available providers:')}`);
        for (const p of providers.slice(0, 10)) {
          console.log(`    ${pc.green('-')} ${p.name} ${pc.dim(`(${p.count} models)`)}`);
        }
        if (providers.length > 10) {
          console.log(`    ${pc.dim(`... and ${providers.length - 10} more. Run`)} model-cost providers ${pc.dim('to see all.')}`);
        }
        process.exit(1);
      }
    }

    if (search) {
      models = searchModels({ models, query: search });
      if (models.length === 0) {
        const resolved = findModel({ models: allModels, query: search });
        console.log(formatSuggestions({ query: search, suggestions: resolved.suggestions }));
        process.exit(1);
      }
    }

    const validSorts: SortField[] = ['input', 'output', 'name', 'provider'];
    const sortField = validSorts.includes(opts.sort as SortField)
      ? (opts.sort as SortField)
      : 'input';

    models = sortModels({ models, by: sortField });

    const limit = opts.all ? models.length : parseInt(opts.limit, 10);
    const limited = models.slice(0, limit);

    if (opts.json) {
      console.log(JSON.stringify(limited, null, 2));
      return;
    }

    console.log(formatTable({ models: limited }));

    if (models.length > limit) {
      console.log(
        `\n  ${pc.dim(`Showing ${limit} of ${models.length} models. Use`)} --all ${pc.dim('to see all, or')} --limit <n> ${pc.dim('to change.')}`,
      );
    }

    showFooter({ updatedAt });
  });

// Compare models
program
  .command('compare')
  .description('Compare models side by side')
  .argument('<models...>', 'model names to compare')
  .option('-j, --json', 'output as JSON')
  .addOption(new Option('--no-banner').hideHelp())
  .action(async (modelNames: string[], opts: BaseOptions) => {
    showBanner({ opts });

    const { models, updatedAt } = await fetchModels({ opts });
    const resolved = modelNames.map((name) => resolveModel({ models, query: name }));

    if (opts.json) {
      console.log(JSON.stringify(resolved, null, 2));
      return;
    }

    console.log(formatComparison({ models: resolved }));
    showFooter({ updatedAt });
  });

// Calculate cost
program
  .command('calc')
  .description('Calculate cost for token usage')
  .argument('<model>', 'model name')
  .requiredOption('-i, --input <tokens>', 'input token count (e.g. 1M, 100K, 5000)')
  .option('-o, --output <tokens>', 'output token count', '0')
  .option('-j, --json', 'output as JSON')
  .addOption(new Option('--no-banner').hideHelp())
  .action(async (modelName: string, opts: BaseOptions & { input: string; output: string }) => {
    showBanner({ opts });

    let inputTokens: number;
    let outputTokens: number;
    try {
      inputTokens = parseTokenCount({ value: opts.input });
      outputTokens = parseTokenCount({ value: opts.output });
    } catch (err) {
      fail({ message: err instanceof Error ? err.message : 'Invalid token count' });
    }

    const { models, updatedAt } = await fetchModels({ opts });
    const model = resolveModel({ models, query: modelName });
    const estimate = calculateCost({ model, inputTokens, outputTokens });

    if (opts.json) {
      console.log(JSON.stringify(estimate, null, 2));
      return;
    }

    console.log(formatCostEstimate({ estimate }));
    showFooter({ updatedAt });
  });

// List providers
program
  .command('providers')
  .description('List all available providers')
  .option('-j, --json', 'output as JSON')
  .addOption(new Option('--no-banner').hideHelp())
  .action(async (opts: BaseOptions) => {
    showBanner({ opts });

    const { models, updatedAt } = await fetchModels({ opts });
    const providers = getProviders({ models });

    if (opts.json) {
      console.log(JSON.stringify(providers, null, 2));
      return;
    }

    console.log(formatProviders({ providers }));
    console.log(`\n  ${pc.dim(`${providers.length} providers, ${models.length} models total`)}`);
    showFooter({ updatedAt });
  });

program.parse();
