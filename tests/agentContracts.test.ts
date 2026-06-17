import { describe, it, expect } from 'vitest';
import {
  BusinessContextSchema,
  SpecSchema,
  UXPlanSchema,
  EvaluationSchema,
  parseAgentOutput,
} from '../lib/agentContracts';

// ─── BusinessContextSchema ────────────────────────────────────────────────────

describe('BusinessContextSchema', () => {
  const validInput = {
    domain: 'B2B SaaS CRM',
    entities: ['Deal', 'Account', 'Rep'],
    userRoles: ['VP Sales', 'Account Executive'],
    kpis: ['ARR', 'Win Rate', 'Pipeline Coverage'],
    workflows: ['Lead qualification', 'Deal progression'],
    hypothesis: 'This prototype shows whether our pipeline coverage ratio predicts quarterly attainment.',
    recommendedCharts: ['bar', 'funnel', 'metric-card'],
  };

  it('parses valid input', () => {
    expect(() => BusinessContextSchema.parse(validInput)).not.toThrow();
  });

  it('throws on missing required field', () => {
    const { domain, ...rest } = validInput;
    expect(() => BusinessContextSchema.parse(rest)).toThrow();
  });

  it('throws on invalid chart type', () => {
    const invalid = { ...validInput, recommendedCharts: ['radar'] };
    expect(() => BusinessContextSchema.parse(invalid)).toThrow();
  });

  it('allows valid chart enum values', () => {
    const result = BusinessContextSchema.parse(validInput);
    expect(result.recommendedCharts).toContain('bar');
  });
});

// ─── SpecSchema ───────────────────────────────────────────────────────────────

describe('SpecSchema', () => {
  const validSpec = {
    primaryScreen: 'Sales Pipeline Dashboard',
    components: ['MetricCards', 'PipelineFunnel', 'DealTable'],
    dataModel: { Deal: ['name', 'stage', 'value'], Account: ['name', 'industry'] },
    fileUploadRequired: false,
    interactionPattern: 'dashboard' as const,
    successCriteria: ['KPIs are visible', 'Chart shows pipeline stages'],
  };

  it('parses valid spec', () => {
    expect(() => SpecSchema.parse(validSpec)).not.toThrow();
  });

  it('throws on invalid interactionPattern', () => {
    const invalid = { ...validSpec, interactionPattern: 'wizard' };
    expect(() => SpecSchema.parse(invalid)).toThrow();
  });

  it('allows all valid interaction patterns', () => {
    const patterns = ['dashboard', 'form-flow', 'data-explorer', 'report-view'] as const;
    for (const pattern of patterns) {
      expect(() => SpecSchema.parse({ ...validSpec, interactionPattern: pattern })).not.toThrow();
    }
  });

  it('allows optional fileUpload fields', () => {
    const withUpload = { ...validSpec, fileUploadRequired: true, acceptedFileTypes: ['csv', 'xlsx'] };
    const result = SpecSchema.parse(withUpload);
    expect(result.fileUploadRequired).toBe(true);
    expect(result.acceptedFileTypes).toContain('csv');
  });
});

// ─── UXPlanSchema ─────────────────────────────────────────────────────────────

describe('UXPlanSchema', () => {
  const validPlan = {
    layout: 'sidebar-main' as const,
    primaryVisual: 'funnel chart showing deal progression',
    colorAccent: '#6366f1',
    headerContent: 'Sales Pipeline Q4 2024',
    dataVisualizationPlan: [
      { component: 'PipelineChart', chartType: 'FunnelChart', dataKey: 'value' },
    ],
    mockDataExamples: [
      'Acme Corp | $142,000 | Proposal | Sarah Chen',
      'TechStartup | $85,000 | Negotiation | Mike Torres',
    ],
  };

  it('parses valid plan', () => {
    expect(() => UXPlanSchema.parse(validPlan)).not.toThrow();
  });

  it('throws on invalid layout', () => {
    const invalid = { ...validPlan, layout: 'two-column' };
    expect(() => UXPlanSchema.parse(invalid)).toThrow();
  });

  it('allows all valid layout options', () => {
    const layouts = ['sidebar-main', 'top-nav-content', 'split-panel', 'full-canvas'] as const;
    for (const layout of layouts) {
      expect(() => UXPlanSchema.parse({ ...validPlan, layout })).not.toThrow();
    }
  });
});

// ─── EvaluationSchema ────────────────────────────────────────────────────────

describe('EvaluationSchema', () => {
  it('parses valid evaluation', () => {
    const result = EvaluationSchema.parse({
      approved: true,
      blockers: [],
      suggestions: ['improve chart labels'],
      score: 8,
    });
    expect(result.approved).toBe(true);
    expect(result.score).toBe(8);
  });

  it('throws on score out of range', () => {
    expect(() => EvaluationSchema.parse({ approved: true, blockers: [], suggestions: [], score: 11 })).toThrow();
    expect(() => EvaluationSchema.parse({ approved: true, blockers: [], suggestions: [], score: -1 })).toThrow();
  });

  it('throws on missing required fields', () => {
    expect(() => EvaluationSchema.parse({ approved: true })).toThrow();
  });
});

// ─── parseAgentOutput ────────────────────────────────────────────────────────

describe('parseAgentOutput', () => {
  it('parses plain JSON string', () => {
    const raw = JSON.stringify({ domain: 'SaaS', entities: ['Deal'], userRoles: ['VP Sales'], kpis: ['ARR'], workflows: ['Qualify'], hypothesis: 'test', recommendedCharts: ['bar'] });
    const result = parseAgentOutput(raw, BusinessContextSchema);
    expect(result.domain).toBe('SaaS');
  });

  it('strips markdown code fences', () => {
    const raw = '```json\n{"domain":"Logistics","entities":["SKU"],"userRoles":["Manager"],"kpis":["Inventory"],"workflows":["Order"],"hypothesis":"h","recommendedCharts":["table"]}\n```';
    const result = parseAgentOutput(raw, BusinessContextSchema);
    expect(result.domain).toBe('Logistics');
  });

  it('throws on invalid JSON', () => {
    expect(() => parseAgentOutput('not json', BusinessContextSchema)).toThrow();
  });

  it('throws on JSON that fails schema validation', () => {
    const badSchema = JSON.stringify({ domain: 'SaaS' }); // missing required fields
    expect(() => parseAgentOutput(badSchema, BusinessContextSchema)).toThrow();
  });
});
