/**
 * Typed contracts for the 6-stage prototype generation pipeline.
 * Zod schemas define and validate the structured output of each agent stage.
 */

import { z } from 'zod';

// ─── Stage 1: Business Context ──────────────────────────────────────────────

export const BusinessContextSchema = z.object({
  domain: z.string().describe('Industry/business domain, e.g. "B2B SaaS", "Healthcare", "Logistics"'),
  entities: z.array(z.string()).describe('Core domain entities, e.g. ["Deal", "Account", "Rep", "Pipeline"]'),
  userRoles: z.array(z.string()).describe('Primary users of this prototype, e.g. ["VP Sales", "Account Executive"]'),
  kpis: z.array(z.string()).describe('Key performance indicators to surface, e.g. ["ARR", "Win Rate", "Pipeline Coverage"]'),
  workflows: z.array(z.string()).describe('Key workflows or processes to demonstrate'),
  hypothesis: z.string().describe('The business question this prototype must answer for stakeholders'),
  recommendedCharts: z.array(
    z.enum(['bar', 'line', 'pie', 'funnel', 'heatmap', 'table', 'metric-card', 'area', 'scatter'])
  ).describe('Chart types appropriate for this domain and KPIs'),
});

export type BusinessContext = z.infer<typeof BusinessContextSchema>;

// ─── Stage 2: Spec ──────────────────────────────────────────────────────────

export const SpecSchema = z.object({
  primaryScreen: z.string().describe('Name of the primary screen to prototype, e.g. "Sales Pipeline Dashboard"'),
  components: z.array(z.string()).describe('Named UI components to include, e.g. ["MetricCards", "PipelineChart", "DealTable"]'),
  dataModel: z.record(z.string(), z.array(z.string())).describe('Entity to field names, e.g. { "Deal": ["name", "stage", "value", "owner"] }'),
  fileUploadRequired: z.boolean().describe('Whether the prototype should accept file uploads (CSV/XLSX/JSON) to populate data'),
  acceptedFileTypes: z.array(z.enum(['csv', 'xlsx', 'json', 'png', 'jpg'])).optional(),
  interactionPattern: z.enum(['dashboard', 'form-flow', 'data-explorer', 'report-view'])
    .describe('Primary interaction pattern for the prototype'),
  successCriteria: z.array(z.string()).describe('What a stakeholder must see to consider this prototype a success'),
});

export type Spec = z.infer<typeof SpecSchema>;

// ─── Stage 3: UX Architecture ────────────────────────────────────────────────

export const UXPlanSchema = z.object({
  layout: z.enum(['sidebar-main', 'top-nav-content', 'split-panel', 'full-canvas'])
    .describe('Overall layout pattern'),
  primaryVisual: z.string().describe('The dominant visual element, e.g. "funnel chart", "data table with filters"'),
  colorAccent: z.string().describe('Accent hex color from enterprise palette, e.g. "#6366f1" for indigo'),
  headerContent: z.string().describe('Header title and subtitle text to display'),
  dataVisualizationPlan: z.array(z.object({
    component: z.string().describe('Component name, e.g. "RevenueChart"'),
    chartType: z.string().describe('Chart type from Recharts, e.g. "LineChart"'),
    dataKey: z.string().describe('Primary data field, e.g. "revenue"'),
  })),
  mockDataExamples: z.array(z.string()).describe('5-8 realistic example values for the domain, e.g. ["Acme Corp - $120k - Closing", "TechStartup - $45k - Proposal"]'),
});

export type UXPlan = z.infer<typeof UXPlanSchema>;

// ─── Stages 5-6: Evaluator Contract ─────────────────────────────────────────

export const EvaluationSchema = z.object({
  approved: z.boolean(),
  blockers: z.array(z.string()).describe('Critical issues that must be fixed before approval'),
  suggestions: z.array(z.string()).describe('Non-blocking improvements'),
  score: z.number().min(1).max(10).describe('Quality score 1-10'),
});

export type Evaluation = z.infer<typeof EvaluationSchema>;

// ─── Orchestrator Result ─────────────────────────────────────────────────────

export interface PrototypeResult {
  code: string;
  approved: boolean;
  businessContext: BusinessContext;
  spec: Spec;
  uxPlan: UXPlan;
  evaluations: {
    qa?: Evaluation;
    reviewer?: Evaluation;
    frontend?: { approved: boolean; feedback: string };
  };
  iterations: number;
}

// ─── Validation Helper ───────────────────────────────────────────────────────

/**
 * Parse and validate LLM output against a Zod schema.
 * Strips markdown code fences before parsing.
 */
export function parseAgentOutput<T>(raw: string, schema: z.ZodSchema<T>): T {
  let cleaned = raw.trim();
  // Strip markdown code blocks
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }
  const parsed = JSON.parse(cleaned);
  return schema.parse(parsed);
}
