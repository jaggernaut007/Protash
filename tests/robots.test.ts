import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import robots from '@/app/robots';

describe('robots', () => {
  it('allows the site and blocks /api/', () => {
    expect(robots().rules).toEqual({ userAgent: '*', allow: '/', disallow: '/api/' });
  });
});

describe('icon.svg', () => {
  it('is a well-formed SVG', () => {
    const svg = readFileSync(path.join(__dirname, '..', 'app', 'icon.svg'), 'utf-8');
    expect(svg).toMatch(/^<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    expect(svg.trim().endsWith('</svg>')).toBe(true);
  });
});
