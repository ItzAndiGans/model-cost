<p align="center">
  <img src=".github/cover.svg?v=2" alt="model-cost" />
</p>

<p align="center">
  Compare LLM API pricing from your terminal.<br/>
  Supports 300+ models across all major providers.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/model-cost"><img src="https://img.shields.io/npm/v/model-cost.svg?style=flat-square" alt="npm version" /></a>
  <a href="https://github.com/saqibameen/model-cost/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/model-cost.svg?style=flat-square" alt="license" /></a>
</p>

## Why

LLM pricing changes constantly. Comparing costs means opening multiple browser tabs, hunting through docs, and doing mental math. `model-cost` gives you instant answers in the terminal:

```bash
npx model-cost compare claude-opus-4-6 gpt-4o deepseek-chat
```

## Install

```bash
npx model-cost
```

Or install globally:

```bash
npm install -g model-cost
```

## Usage

```bash
# List models sorted by price (cheapest first)
model-cost

# Search by name
model-cost claude

# Filter by provider
model-cost --provider anthropic

# Compare models side by side
model-cost compare claude-sonnet-4-6 gpt-4o deepseek-chat

# Calculate cost for token usage
model-cost calc claude-opus-4-6 --input 1M --output 100K

# List all available providers
model-cost providers

# Sort by output cost
model-cost --sort output

# Show all models (no limit)
model-cost --all

# JSON output for scripting
model-cost --json
```

## Output

```
  model-cost v0.0.1

  Provider          Model                        Input/1M   Output/1M   Context
  -----------------------------------------------------------------------------
  deepseek          deepseek-chat                   $0.28       $0.42    131.1K
  anthropic         claude-haiku-4-5                $1.00       $5.00      200K
  openai            gpt-4o-mini                     $0.15       $0.60      128K
  anthropic         claude-sonnet-4-6               $3.00      $15.00      200K
  openai            gpt-4o                          $2.50      $10.00      128K
  anthropic         claude-opus-4-6                 $5.00      $25.00        1M
```

## Comparing Models

```bash
model-cost compare claude-sonnet-4-6 gpt-4o
```

```
                    claude-sonnet-4-6       gpt-4o
  --------------------------------------------------
  Provider          anthropic               openai
  Input / 1M        $3.00                   $2.50
  Output / 1M       $15.00                  $10.00
  Max Input         200K                    128K
  Max Output        64K                     16.4K
```

## Calculating Costs

Token counts support `K` (thousands), `M` (millions), and `B` (billions):

```bash
model-cost calc claude-sonnet-4-6 --input 1M --output 100K
```

```
  claude-sonnet-4-6

  Input       1,000,000 tokens      $3.00
  Output      100,000 tokens        $1.50
  ------------------------------------------
  Total                             $4.50
```

## Fuzzy Matching

Mistype a model name? `model-cost` suggests the closest matches:

```bash
model-cost compare clawde
```

```
  ✖ Model "clawde" not found.

  Did you mean:
    - claude-opus-4-6 (anthropic)
    - claude-sonnet-4-6 (anthropic)
    - claude-haiku-4-5 (anthropic)
```

## Options

| Flag | Description |
|------|-------------|
| `-p, --provider <name>` | Filter by provider |
| `-s, --sort <field>` | Sort by: `input`, `output`, `name`, `provider` |
| `-n, --limit <count>` | Number of models to show (default: 20) |
| `-a, --all` | Show all models (no limit) |
| `-u, --update` | Force refresh pricing data |
| `-j, --json` | Output as JSON |
| `-v, --version` | Show version |
| `-h, --help` | Show help |

## Programmatic API

```typescript
import { loadPrices, parseModels, calculateCost, findModel } from 'model-cost';

// Load pricing data
const { data } = await loadPrices();
const models = parseModels({ data });

// Find a model (with fuzzy matching)
const result = findModel({ models, query: 'claude-sonnet-4-6' });

// Calculate cost
if (result.model) {
  const estimate = calculateCost({
    model: result.model,
    inputTokens: 1_000_000,
    outputTokens: 100_000,
  });
  console.log(estimate.totalCost); // 4.5
}
```

## How It Works

1. Fetches pricing data from [LiteLLM's model pricing database](https://github.com/BerriAI/litellm)
2. Caches locally in `~/.model-cost/` (refreshes every 24 hours)
3. Parses and displays chat/completion models with input/output pricing

## Credits

Pricing data from [LiteLLM](https://github.com/BerriAI/litellm) -- the open source LLM gateway.

## License

MIT

---

Built with [commandcode](https://commandcode.ai) by [@saqibameen](https://x.com/saqibameen)
