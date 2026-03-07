import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { PriceCache, RawModelData } from './types.js';

const LITELLM_URL =
  'https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json';
const CACHE_DIR = join(homedir(), '.model-cost');
const CACHE_FILE = join(CACHE_DIR, 'prices.json');
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

async function readCache(): Promise<PriceCache | null> {
  try {
    const raw = await readFile(CACHE_FILE, 'utf-8');
    return JSON.parse(raw) as PriceCache;
  } catch {
    return null;
  }
}

function isCacheValid({ cache }: { cache: PriceCache }): boolean {
  const age = Date.now() - new Date(cache.updatedAt).getTime();
  return age < CACHE_TTL_MS;
}

function cacheAge({ updatedAt }: { updatedAt: string }): string {
  const ms = Date.now() - new Date(updatedAt).getTime();
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

async function fetchPrices(): Promise<RawModelData> {
  const res = await fetch(LITELLM_URL);
  if (!res.ok) {
    throw new Error(`Failed to fetch pricing data: HTTP ${res.status}`);
  }
  return res.json() as Promise<RawModelData>;
}

async function writeCache({ data }: { data: RawModelData }): Promise<void> {
  const cache: PriceCache = {
    updatedAt: new Date().toISOString(),
    data,
  };
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(CACHE_FILE, JSON.stringify(cache));
}

async function loadPrices({
  forceUpdate = false,
}: { forceUpdate?: boolean } = {}): Promise<{
  data: RawModelData;
  updatedAt: string;
}> {
  if (!forceUpdate) {
    const cache = await readCache();
    if (cache && isCacheValid({ cache })) {
      return { data: cache.data, updatedAt: cache.updatedAt };
    }
  }

  const data = await fetchPrices();
  await writeCache({ data });
  return { data, updatedAt: new Date().toISOString() };
}

export { loadPrices, fetchPrices, cacheAge, LITELLM_URL };
