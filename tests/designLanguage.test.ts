import { describe, it, expect } from 'vitest';
import { designLanguagePrompt, designClasses, applyDesignGuidance } from '../lib/designLanguage';

describe('designLanguagePrompt', () => {
  it('contains enterprise palette instructions', () => {
    expect(designLanguagePrompt).toContain('slate-950');
    expect(designLanguagePrompt).toContain('slate-900');
    expect(designLanguagePrompt).toContain('indigo-500');
  });

  it('contains Recharts instruction', () => {
    expect(designLanguagePrompt).toContain('Recharts');
    expect(designLanguagePrompt).toContain('recharts');
  });

  it('contains no-placeholder instruction', () => {
    // Should explicitly tell agents NOT to use placeholder text
    const lower = designLanguagePrompt.toLowerCase();
    expect(lower).toContain('placeholder');
    expect(lower).toContain('no');
  });

  it('includes chart types', () => {
    expect(designLanguagePrompt).toContain('BarChart');
    expect(designLanguagePrompt).toContain('LineChart');
    expect(designLanguagePrompt).toContain('ResponsiveContainer');
  });

  it('prohibits glassmorphism', () => {
    // Prompt must mention it in a prohibition context — "NO glassmorphism"
    expect(designLanguagePrompt.toLowerCase()).toContain('no glassmorphism');
  });

  it('includes metric card template', () => {
    expect(designLanguagePrompt).toContain('METRIC CARDS');
    expect(designLanguagePrompt).toContain('grid-cols-4');
  });
});

describe('applyDesignGuidance', () => {
  it('returns the base prompt when no extra context', () => {
    const result = applyDesignGuidance();
    expect(result).toBe(designLanguagePrompt);
  });

  it('appends extra context when provided', () => {
    const extra = 'Focus on financial data';
    const result = applyDesignGuidance(extra);
    expect(result).toContain(designLanguagePrompt);
    expect(result).toContain(extra);
  });
});

describe('designClasses', () => {
  it('maps enterprise class aliases', () => {
    expect(designClasses.panels.enterprise).toBe('panel-enterprise');
    expect(designClasses.panels.steel).toBe('panel-enterprise'); // legacy alias
  });

  it('has correct button classes', () => {
    expect(designClasses.buttons.primary).toBe('button-primary');
    expect(designClasses.buttons.secondary).toBe('button-enterprise');
  });

  it('includes enterprise color tokens', () => {
    expect(designClasses.colors.accent).toBe('#6366f1');
    expect(designClasses.colors.bg).toBe('#020617'); // slate-950
  });
});
