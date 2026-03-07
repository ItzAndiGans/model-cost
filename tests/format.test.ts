import { describe, it, expect } from 'vitest';
import {
  formatCurrency,
  formatTokens,
  formatNumber,
  padRight,
  padLeft,
} from '../src/format.js';

describe('formatCurrency', () => {
  it('formats zero', () => {
    expect(formatCurrency({ amount: 0 })).toBe('$0.00');
  });

  it('formats whole dollar amounts', () => {
    expect(formatCurrency({ amount: 15 })).toBe('$15.00');
  });

  it('formats cents', () => {
    expect(formatCurrency({ amount: 0.14 })).toBe('$0.14');
  });

  it('uses 3 decimals for small amounts', () => {
    expect(formatCurrency({ amount: 0.025 })).toBe('$0.025');
  });

  it('uses 4 decimals for very small amounts', () => {
    expect(formatCurrency({ amount: 0.0014 })).toBe('$0.0014');
  });
});

describe('formatTokens', () => {
  it('formats millions', () => {
    expect(formatTokens({ count: 1_000_000 })).toBe('1M');
    expect(formatTokens({ count: 2_500_000 })).toBe('2.5M');
  });

  it('formats thousands', () => {
    expect(formatTokens({ count: 128_000 })).toBe('128K');
    expect(formatTokens({ count: 4_096 })).toBe('4.1K');
  });

  it('formats small numbers as-is', () => {
    expect(formatTokens({ count: 500 })).toBe('500');
  });
});

describe('formatNumber', () => {
  it('formats with commas', () => {
    expect(formatNumber({ num: 1000000 })).toBe('1,000,000');
  });

  it('formats small numbers without commas', () => {
    expect(formatNumber({ num: 100 })).toBe('100');
  });
});

describe('padRight', () => {
  it('pads short strings', () => {
    expect(padRight({ str: 'hi', len: 5 })).toBe('hi   ');
  });

  it('truncates long strings with ellipsis', () => {
    expect(padRight({ str: 'hello world', len: 5 })).toBe('hell\u2026');
  });

  it('returns exact length strings as-is', () => {
    expect(padRight({ str: 'hello', len: 5 })).toBe('hello');
  });
});

describe('padLeft', () => {
  it('pads short strings', () => {
    expect(padLeft({ str: 'hi', len: 5 })).toBe('   hi');
  });

  it('returns long strings as-is', () => {
    expect(padLeft({ str: 'hello world', len: 5 })).toBe('hello world');
  });
});
