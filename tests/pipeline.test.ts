import { describe, it, expect, vi, beforeEach } from 'vitest';

// The agents are the LLM boundary. The pipeline control flow is real.
const agents = vi.hoisted(() => ({
  businessContextAgent: vi.fn(),
  specAgent: vi.fn(),
  uxArchitectAgent: vi.fn(),
  generatePrototypeCode: vi.fn(),
  frontendAgent: { evaluate: vi.fn() },
  qaAgent: { evaluate: vi.fn() },
  reviewerAgent: { evaluate: vi.fn() },
}));
vi.mock('@/lib/agents', () => agents);

import { runPrototypePipeline, MAX_REVIEW_ROUNDS } from '@/lib/pipeline';

const ok = (name: string) => ({ agentName: name, approved: true, feedback: 'ok', suggestions: [] });
const no = (name: string) => ({ agentName: name, approved: false, feedback: 'bad', suggestions: ['fix it'] });

beforeEach(() => {
  vi.clearAllMocks();
  agents.businessContextAgent.mockResolvedValue({ domain: 'd' });
  agents.specAgent.mockResolvedValue({ primaryScreen: 'p' });
  agents.uxArchitectAgent.mockResolvedValue({ layout: 'l' });
  let n = 0;
  agents.generatePrototypeCode.mockImplementation(async () => `code-v${++n}`);
  agents.frontendAgent.evaluate.mockResolvedValue(ok('Frontend'));
});

describe('runPrototypePipeline', () => {
  it('approves on the first round without regenerating', async () => {
    agents.qaAgent.evaluate.mockResolvedValue(ok('QA'));
    agents.reviewerAgent.evaluate.mockResolvedValue(ok('Reviewer'));
    const result = await runPrototypePipeline('intent');
    expect(result.approved).toBe(true);
    expect(result.code).toBe('code-v1');
    expect(agents.generatePrototypeCode).toHaveBeenCalledTimes(1);
  });

  it('does not regenerate after the last failed round, so returned code was reviewed', async () => {
    agents.qaAgent.evaluate.mockResolvedValue(no('QA'));
    agents.reviewerAgent.evaluate.mockResolvedValue(ok('Reviewer'));
    const result = await runPrototypePipeline('intent');

    expect(result.approved).toBe(false);
    // 1 initial generation + (rounds - 1) regenerations. The old loop made one more call.
    expect(agents.generatePrototypeCode).toHaveBeenCalledTimes(MAX_REVIEW_ROUNDS);
    expect(agents.qaAgent.evaluate).toHaveBeenCalledTimes(MAX_REVIEW_ROUNDS);
    // The last evaluation reviewed exactly the code that is returned.
    const lastReviewed = agents.qaAgent.evaluate.mock.calls.at(-1)?.[1];
    expect(result.code).toBe(lastReviewed);
  });

  it('regenerates once for a failed safety pre-check', async () => {
    agents.frontendAgent.evaluate.mockResolvedValue(no('Frontend'));
    agents.qaAgent.evaluate.mockResolvedValue(ok('QA'));
    agents.reviewerAgent.evaluate.mockResolvedValue(ok('Reviewer'));
    const result = await runPrototypePipeline('intent');
    expect(agents.generatePrototypeCode).toHaveBeenCalledTimes(2);
    expect(result.code).toBe('code-v2');
  });

  it('reports every stage in order', async () => {
    agents.qaAgent.evaluate.mockResolvedValue(ok('QA'));
    agents.reviewerAgent.evaluate.mockResolvedValue(ok('Reviewer'));
    const stages: string[] = [];
    await runPrototypePipeline('intent', (s) => stages.push(s));
    expect(stages).toEqual(['Business Context', 'Spec', 'UX Architecture', 'Development', 'QA', 'Review']);
  });

  it('propagates a generation error', async () => {
    agents.generatePrototypeCode.mockRejectedValue(new Error('cut off'));
    await expect(runPrototypePipeline('intent')).rejects.toThrow('cut off');
  });
});
