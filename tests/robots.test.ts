import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

describe('robots.txt', () => {
  it('disallows all crawlers', () => {
    const txt = readFileSync(path.join(__dirname, '..', 'public', 'robots.txt'), 'utf-8');
    expect(txt).toMatch(/User-agent: \*\nDisallow: \//);
  });
});

describe('icon.svg', () => {
  it('is a well-formed SVG', () => {
    const svg = readFileSync(path.join(__dirname, '..', 'app', 'icon.svg'), 'utf-8');
    expect(svg).toMatch(/^<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    expect(svg.trim().endsWith('</svg>')).toBe(true);
  });
});
