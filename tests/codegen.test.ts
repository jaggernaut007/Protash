import { describe, it, expect, vi, beforeEach } from 'vitest';

// Only the LLM call is mocked. Everything else (prompt, Babel check, retry logic) is real.
const generateText = vi.fn();
vi.mock('ai', () => ({ generateText: (...args: unknown[]) => generateText(...args) }));

import { generatePrototypeCode, CodeGenerationError } from '@/lib/agents';

const VALID = `export default function Dash() { return <div className="w-full h-full">Revenue $1.2M</div>; }`;
const CUT = `export default function Dash() { const rows = [{ id: 1, name: 'Acme', arr: 142000 }, { id: 2, na`;

const context = {
  domain: 'B2B SaaS',
  entities: ['Deal'],
  userRoles: ['VP Sales'],
  kpis: ['ARR'],
  workflows: ['Forecast'],
  hypothesis: 'h',
  recommendedCharts: ['bar'],
};
const spec = {
  primaryScreen: 'Pipeline',
  components: ['MetricCards'],
  dataModel: {},
  fileUploadRequired: false,
  interactionPattern: 'dashboard',
  successCriteria: [],
};
const uxPlan = {
  layout: 'sidebar-main',
  primaryVisual: 'funnel',
  colorAccent: '#6366f1',
  headerContent: 'Pipeline',
  dataVisualizationPlan: [{ component: 'Funnel', chartType: 'FunnelChart', dataKey: 'value' }],
  mockDataExamples: ['Acme | $142,000'],
};

const run = (prior?: string, blockers?: string[]) =>
  generatePrototypeCode('sales dashboard', context as never, spec as never, uxPlan as never, prior, blockers);

const reply = (text: string, finishReason = 'stop') => ({
  text,
  finishReason,
  usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 },
});

beforeEach(() => generateText.mockReset());

describe('generatePrototypeCode', () => {
  it('returns valid code from the first attempt', async () => {
    generateText.mockResolvedValueOnce(reply(VALID));
    await expect(run()).resolves.toBe(VALID);
    expect(generateText).toHaveBeenCalledTimes(1);
  });

  it('strips markdown fences', async () => {
    generateText.mockResolvedValueOnce(reply('```tsx\n' + VALID + '\n```'));
    await expect(run()).resolves.toBe(VALID);
  });

  it('retries with a compact instruction when the output hit the token limit', async () => {
    generateText.mockResolvedValueOnce(reply(CUT, 'length')).mockResolvedValueOnce(reply(VALID));
    await expect(run()).resolves.toBe(VALID);
    expect(generateText).toHaveBeenCalledTimes(2);
    expect(generateText.mock.calls[1][0].prompt).toMatch(/compact/i);
  });

  it('retries when the code does not compile, even with finishReason stop', async () => {
    generateText.mockResolvedValueOnce(reply(CUT, 'stop')).mockResolvedValueOnce(reply(VALID));
    await expect(run()).resolves.toBe(VALID);
    expect(generateText.mock.calls[1][0].prompt).toMatch(/does not compile/);
  });

  it('throws CodeGenerationError after two cut-off attempts and never returns broken code', async () => {
    generateText.mockResolvedValue(reply(CUT, 'length'));
    await expect(run()).rejects.toBeInstanceOf(CodeGenerationError);
    expect(generateText).toHaveBeenCalledTimes(2);
  });

  it('uses the codegen model for a first pass and the revision model for a fix', async () => {
    generateText.mockResolvedValue(reply(VALID));
    await run();
    await run(VALID, ['fix the header']);
    const firstModel = generateText.mock.calls[0][0].model;
    const fixModel = generateText.mock.calls[1][0].model;
    expect(firstModel).toBeDefined();
    expect(fixModel).toBeDefined();
    expect(fixModel).not.toBe(firstModel);
  });
});
