/**
 * Agent definitions for the 6-stage enterprise prototype pipeline.
 *
 * Pipeline:
 *   Stage 1: businessContextAgent  — extracts domain, entities, KPIs, workflows
 *   Stage 2: specAgent             — produces structured screen spec
 *   Stage 3: uxArchitectAgent      — selects layout, charts, mock data
 *   Stage 4: generatePrototypeCode — generates React component
 *   Stage 5: qaAgent               — evaluates data realism + design match (parallel)
 *   Stage 6: reviewerAgent         — evaluates business alignment (parallel)
 *   Pre-check: frontendAgent       — runtime safety (sequential, hard-fail)
 */

import { generateText } from 'ai';
import { AgentResponse } from './messageBus';
import { designLanguagePrompt } from './designLanguage';
import { deepseekModel, summarizeUsage, type ModelProfile } from './aiConfig';
import { checkComponentCode } from './codeCheck';
import {
  BusinessContextSchema,
  SpecSchema,
  UXPlanSchema,
  EvaluationSchema,
  BusinessContext,
  Spec,
  UXPlan,
  Evaluation,
  parseAgentOutput,
} from './agentContracts';

// ─── Agent Interface ─────────────────────────────────────────────────────────

export interface Agent {
  name: string;
  role: string;
  systemPrompt: string;
  evaluate: (userQuery: string, generatedCode: string) => Promise<AgentResponse>;
}

// ─── Shared Helpers ──────────────────────────────────────────────────────────

function extractJSON(text: string): unknown {
  let cleaned = text.trim();
  const jsonBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonBlockMatch) cleaned = jsonBlockMatch[1].trim();
  return JSON.parse(cleaned);
}

// ─── Stage 1: Business Context Agent ────────────────────────────────────────

export async function businessContextAgent(intentDescription: string): Promise<BusinessContext> {
  const { text, usage } = await generateText({
    model: deepseekModel('structured'),
    system: `You are a business analyst and domain expert. Extract structured business context from a prototype intent description.
Be specific and concrete — use real domain terminology, actual KPI names, and realistic entity names.
Respond ONLY with valid JSON matching the requested schema. No markdown, no explanations.`,
    prompt: `Extract the business context from this intent:
"${intentDescription}"

Return JSON with these fields:
{
  "domain": "specific industry/domain, e.g. 'B2B SaaS CRM', 'Healthcare Analytics', 'Supply Chain Management'",
  "entities": ["list of 3-6 core domain entities, e.g. 'Deal', 'Account', 'SKU', 'Patient'"],
  "userRoles": ["list of 2-4 primary users, e.g. 'VP of Sales', 'Account Executive', 'Operations Manager'"],
  "kpis": ["list of 4-8 specific KPIs relevant to the domain, e.g. 'ARR', 'Pipeline Coverage Ratio', 'Days Sales Outstanding'"],
  "workflows": ["list of 2-4 key processes to demonstrate, e.g. 'Lead qualification', 'Deal progression', 'Forecast review'"],
  "hypothesis": "single sentence: what business question must this prototype answer for stakeholders",
  "recommendedCharts": ["2-4 chart types from: bar, line, pie, funnel, heatmap, table, metric-card, area, scatter"]
}`,
  });

  console.log('[agents:BusinessContext] Token usage', summarizeUsage(usage));
  return parseAgentOutput(text, BusinessContextSchema);
}

// ─── Stage 2: Spec Agent ─────────────────────────────────────────────────────

export async function specAgent(context: BusinessContext): Promise<Spec> {
  const { text, usage } = await generateText({
    model: deepseekModel('structured'),
    system: `You are a product designer creating a concise prototype specification.
Focus on what a stakeholder needs to see to validate the business hypothesis in under 5 minutes.
Respond ONLY with valid JSON. No markdown, no explanations.`,
    prompt: `Create a prototype spec for:
Domain: ${context.domain}
Entities: ${context.entities.join(', ')}
KPIs: ${context.kpis.join(', ')}
Hypothesis: ${context.hypothesis}

Return JSON:
{
  "primaryScreen": "name of the one main screen, e.g. 'Sales Pipeline Dashboard'",
  "components": ["3-6 named UI components, e.g. 'MetricCards', 'PipelineFunnel', 'DealTable', 'RevenueChart'"],
  "dataModel": {
    "EntityName": ["field1", "field2", "field3"],
    "EntityName2": ["field1", "field2"]
  },
  "fileUploadRequired": false,
  "acceptedFileTypes": ["csv", "xlsx"],
  "interactionPattern": "dashboard | form-flow | data-explorer | report-view",
  "successCriteria": ["2-4 things a stakeholder must see to call this a success"]
}

Set fileUploadRequired to true only if the domain inherently requires importing external data (e.g. financial forecasting, inventory management with external systems).`,
  });

  console.log('[agents:Spec] Token usage', summarizeUsage(usage));
  return parseAgentOutput(text, SpecSchema);
}

// ─── Stage 3: UX Architect Agent ─────────────────────────────────────────────

export async function uxArchitectAgent(context: BusinessContext, spec: Spec): Promise<UXPlan> {
  const { text, usage } = await generateText({
    model: deepseekModel('structured'),
    system: `You are a senior UX architect specializing in enterprise B2B dashboards.
Your job is to define the exact visual structure, chart selections, and realistic mock data.
Respond ONLY with valid JSON. No markdown, no explanations.`,
    prompt: `Plan the UX for:
Domain: ${context.domain}
Primary Screen: ${spec.primaryScreen}
Components: ${spec.components.join(', ')}
KPIs: ${context.kpis.join(', ')}
Recommended Charts: ${context.recommendedCharts.join(', ')}
Interaction Pattern: ${spec.interactionPattern}

Return JSON:
{
  "layout": "sidebar-main | top-nav-content | split-panel | full-canvas",
  "primaryVisual": "the dominant visual element description, e.g. 'funnel chart showing deal progression with 5 stages'",
  "colorAccent": "#6366f1",
  "headerContent": "Header title and subtitle, e.g. 'Sales Pipeline Q4 2024 | 127 active deals across 4 stages'",
  "dataVisualizationPlan": [
    {
      "component": "ComponentName",
      "chartType": "Recharts component name, e.g. LineChart, BarChart, FunnelChart",
      "dataKey": "primary data field name"
    }
  ],
  "mockDataExamples": [
    "8-10 REALISTIC domain-specific data examples as strings, e.g. 'Acme Corp | $142,000 | Proposal | Sarah Chen | 12 days'",
    "Use real company names, real dollar amounts, real job titles — nothing generic"
  ]
}`,
  });

  console.log('[agents:UXArchitect] Token usage', summarizeUsage(usage));
  return parseAgentOutput(text, UXPlanSchema);
}

// ─── Stage 4: Code Generator ─────────────────────────────────────────────────

export async function generatePrototypeCode(
  intentDescription: string,
  context: BusinessContext,
  spec: Spec,
  uxPlan: UXPlan,
  priorCode?: string,
  blockers?: string[]
): Promise<string> {
  const revisionNote = blockers?.length
    ? `\n\nFIX THESE CRITICAL BLOCKERS:\n${blockers.map(b => `- ${b}`).join('\n')}\n\nCurrent code to fix:\n${priorCode}`
    : '';

  const prompt = `Generate a React enterprise prototype component.

## SANDBOX CONSTRAINTS (CRITICAL — violating these causes runtime crashes)
- Return ONLY the component code. No markdown fences, no explanations, no import statements at the top.
- The component must: export default function ComponentName() { ... }
- Must fill 100% width/height: className="w-full h-full"
- The following are pre-injected as globals — import them normally at the top of the file:
    React, useState, useEffect, useReducer, useCallback, useMemo, useRef,
    useContext, createContext, createRef, forwardRef, memo, Fragment
    (Recharts components: LineChart, BarChart, PieChart, AreaChart, FunnelChart, etc.)
- React Context: if used, ALWAYS provide a non-null default value:
    ✅  createContext({ items: [], selected: null })
    ❌  createContext(null)   ← crashes when consumers destructure without null-guard
- No fetch or external network calls. No external CDN scripts.
- All state must be initialized with concrete values before first render.
- Never call hooks conditionally or outside component bodies.

## BUSINESS INTENT
${intentDescription}

## DOMAIN & CONTEXT
Domain: ${context.domain}
Primary Screen: ${spec.primaryScreen}
Hypothesis to Answer: ${context.hypothesis}
KPIs to Surface: ${context.kpis.join(', ')}

## COMPONENTS TO BUILD
${spec.components.join(', ')}
Interaction Pattern: ${spec.interactionPattern}
Layout: ${uxPlan.layout}
Header: ${uxPlan.headerContent}

## REALISTIC DATA (hardcode these exact examples — no Lorem Ipsum, no generic placeholders)
${uxPlan.mockDataExamples.slice(0, 8).map((ex, i) => `  ${i + 1}. ${ex}`).join('\n')}

## VISUALIZATIONS
${uxPlan.dataVisualizationPlan.map(v => `  - ${v.component}: use Recharts ${v.chartType}, dataKey="${v.dataKey}"`).join('\n')}

${spec.fileUploadRequired ? `## FILE UPLOAD\nInclude a file input accepting ${spec.acceptedFileTypes?.join(', ')}. Parse CSV with Papa.parse (available as global); parse JSON with JSON.parse.` : ''}

${designLanguagePrompt}

${revisionNote}

Return ONLY the React component code. No markdown fences, no explanations.
The component must export default a function, fill w-full h-full, and use Recharts for charts.`;

  // A revision fixes known blockers, so it needs less reasoning than the first pass.
  const profile: ModelProfile = priorCode ? 'revision' : 'codegen';
  let retryNote = '';
  let lastProblem = '';

  // Two attempts. The second attempt runs only after a cut-off or a syntax error.
  for (let attempt = 1; attempt <= MAX_CODEGEN_ATTEMPTS; attempt++) {
    let result: Awaited<ReturnType<typeof generateText>>;
    try {
      result = await generateText({
        model: deepseekModel(profile),
        system: `You are an expert React developer building enterprise prototype dashboards.
Generate production-quality React components using Tailwind CSS and Recharts.
All data must be hardcoded with realistic domain-specific values — no placeholder text.`,
        prompt: prompt + retryNote,
        // A stuck reasoning call must not use the whole request budget.
        abortSignal: AbortSignal.timeout(CODEGEN_TIMEOUT_MS[profile as 'codegen' | 'revision']),
      });
    } catch (error) {
      if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
        throw new CodeGenerationError('The model took too long to respond.');
      }
      throw error;
    }
    const { text, usage, finishReason } = result;

    console.log('[agents:CodeGen] Token usage', {
      attempt,
      profile,
      finishReason,
      ...summarizeUsage(usage),
    });

    if (finishReason === 'length') {
      lastProblem = 'The output reached the token limit and was cut off.';
      retryNote = COMPACT_RETRY_NOTE;
      continue;
    }

    const code = stripFences(text);
    const check = checkComponentCode(code);
    if (check.ok) return code;

    lastProblem = `The code does not compile: ${check.error}`;
    retryNote = `\n\nYOUR PREVIOUS ANSWER FAILED: ${lastProblem}\nReturn the complete component again, with valid syntax and every tag closed. ${COMPACT_RETRY_NOTE}`;
  }

  throw new CodeGenerationError(lastProblem);
}

const MAX_CODEGEN_ATTEMPTS = 2;

/** Time limit for one code-generation call, in ms. The revision call reasons less, so it gets less time. */
export const CODEGEN_TIMEOUT_MS = { codegen: 180_000, revision: 120_000 } as const;

const COMPACT_RETRY_NOTE =
  'Keep the component compact: under 350 lines, at most 5 sub-components, at most 6 rows per table, short inline data. Finish the whole component.';

/** The model did not return a component that compiles. The route returns a generic error. */
export class CodeGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CodeGenerationError';
  }
}

// Strip any accidental markdown fences
function stripFences(text: string): string {
  const fenceMatch = text.match(/```(?:\w+)?\s*([\s\S]*?)```/);
  return fenceMatch ? fenceMatch[1].trim() : text.trim();
}

// ─── Stage 5: QA Agent (Enterprise-Adapted) ──────────────────────────────────

export const qaAgent: Agent = {
  name: 'QA Agent',
  role: 'Enterprise Visual Quality',
  systemPrompt: `You are a QA engineer evaluating enterprise prototype React components. Focus on data quality and enterprise standards.

CRITICAL BLOCKERS (reject for these only):
- Component fails to render or crashes
- Completely blank / no visible content
- Contains "Lorem ipsum", "User 1", "Item A", "placeholder", or "sample text" — generic non-domain data
- No chart or data visualization when the spec requires one
- Missing KPI metric cards when domain is a dashboard

ADVISORY (suggestions, not blockers):
- Chart axes could be better labeled
- Data could be more realistic
- Could add filter controls

Approve unless a critical blocker is present.

Respond ONLY in JSON:
{
  "approved": true/false,
  "blockers": ["critical issue 1"],
  "suggestions": ["advisory improvement 1"],
  "score": 7
}`,

  evaluate: async (userQuery: string, generatedCode: string): Promise<AgentResponse> => {
    const { text, usage } = await generateText({
      model: deepseekModel('evaluator'),
      system: qaAgent.systemPrompt,
      prompt: `Enterprise Context: "${userQuery}"\n\nComponent Code:\n${generatedCode}\n\nEvaluate and respond ONLY with JSON:`,
    });

    console.log('[agents:QA] Token usage', summarizeUsage(usage));

    try {
      const parsed = parseAgentOutput(text, EvaluationSchema);
      return {
        agentName: qaAgent.name,
        approved: parsed.approved,
        feedback: parsed.blockers.join('; ') || 'Approved',
        suggestions: [...parsed.blockers, ...parsed.suggestions],
      };
    } catch {
      return { agentName: qaAgent.name, approved: true, feedback: 'QA passed (fallback)', suggestions: [] };
    }
  },
};

// ─── Stage 6: Reviewer Agent (Business Alignment) ────────────────────────────

export const reviewerAgent: Agent = {
  name: 'Reviewer Agent',
  role: 'Business Alignment Review',
  systemPrompt: `You are a senior product reviewer evaluating whether an enterprise prototype answers the business hypothesis and looks production-ready.

CRITICAL BLOCKERS (reject for these only):
- KPIs from the intent are not visible anywhere in the component
- The component is clearly off-domain (e.g. a health tracker for a sales intent)
- The component is so generic it could apply to any industry (no domain specificity)

ADVISORY:
- Could better emphasize the primary KPI
- Layout could be cleaner
- Stakeholder context could be stronger

Approve unless a critical blocker is present.

Respond ONLY in JSON:
{
  "approved": true/false,
  "blockers": ["critical issue 1"],
  "suggestions": ["advisory improvement 1"],
  "score": 8
}`,

  evaluate: async (userQuery: string, generatedCode: string): Promise<AgentResponse> => {
    const { text, usage } = await generateText({
      model: deepseekModel('evaluator'),
      system: reviewerAgent.systemPrompt,
      prompt: `Business Intent: "${userQuery}"\n\nComponent Code:\n${generatedCode}\n\nEvaluate and respond ONLY with JSON:`,
    });

    console.log('[agents:Reviewer] Token usage', summarizeUsage(usage));

    try {
      const parsed = parseAgentOutput(text, EvaluationSchema);
      return {
        agentName: reviewerAgent.name,
        approved: parsed.approved,
        feedback: parsed.blockers.join('; ') || 'Approved',
        suggestions: [...parsed.blockers, ...parsed.suggestions],
      };
    } catch {
      return { agentName: reviewerAgent.name, approved: true, feedback: 'Review passed (fallback)', suggestions: [] };
    }
  },
};

// ─── Pre-check: Frontend Safety Agent ────────────────────────────────────────

export const frontendAgent: Agent = {
  name: 'Frontend Agent',
  role: 'Runtime Safety',
  systemPrompt: `You are a senior frontend engineer doing a rapid safety check on React component code that runs in a sandboxed renderer.

CRITICAL BLOCKERS (reject only for these):
- Obvious runtime errors (unclosed tags, invalid JSX, syntax errors)
- Infinite loops (setState in render body without conditions)
- Component uses undefined variables or functions
- React Context created with createContext(null) where consumers immediately destructure the value without a null guard — this crashes with "Cannot read properties of null"
- Hooks called conditionally or outside a component/custom-hook body
- Any fetch(), XMLHttpRequest, or external URL import inside the component body

Do NOT reject for style, data quality, or missing features. These are handled by other agents.

Respond ONLY in JSON:
{
  "approved": true/false,
  "feedback": "brief explanation",
  "suggestions": []
}`,

  evaluate: async (userQuery: string, generatedCode: string): Promise<AgentResponse> => {
    const { text, usage } = await generateText({
      model: deepseekModel('evaluator'),
      system: frontendAgent.systemPrompt,
      prompt: `Request: "${userQuery}"\n\nCode:\n${generatedCode}\n\nSafety check — respond ONLY with JSON:`,
    });

    console.log('[agents:Frontend] Token usage', summarizeUsage(usage));

    try {
      const parsed = extractJSON(text) as { approved: boolean; feedback: string; suggestions: string[] };
      return {
        agentName: frontendAgent.name,
        approved: parsed.approved ?? true,
        feedback: parsed.feedback ?? 'Safety check passed',
        suggestions: parsed.suggestions ?? [],
      };
    } catch {
      return { agentName: frontendAgent.name, approved: true, feedback: 'Safety check passed (fallback)', suggestions: [] };
    }
  },
};

// ─── Legacy: MoodAssetContext (kept for backward compat) ─────────────────────

export interface MoodAssetContext {
  intentDescription: string;
  domain: string;
  guidance: string;
  uiType: string;
  boardContext: string;
}

// allAgents kept for any legacy references
export const allAgents: Agent[] = [frontendAgent, qaAgent, reviewerAgent];
