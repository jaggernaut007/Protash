/**
 * Enterprise design language for generated prototype components.
 * All generated components must match the app's visual identity:
 * slate-950 background, indigo-500 accent, clean data-dense layouts.
 */

export const designClasses = {
  panels: {
    enterprise: 'panel-enterprise',
    // Legacy aliases
    steel: 'panel-enterprise',
    steelSoft: 'panel-enterprise',
    frosted: 'panel-enterprise',
  },
  inputs: {
    enterprise: 'input-enterprise',
    steel: 'input-enterprise',
  },
  buttons: {
    primary: 'button-primary',
    secondary: 'button-enterprise',
    steel: 'button-enterprise',
  },
  layout: {
    container: 'w-full h-full',
    rounded: 'rounded-xl',
    padded: 'p-4',
  },
  text: {
    title: 'text-xl font-semibold tracking-tight text-slate-100',
    label: 'text-xs font-medium text-slate-400 uppercase tracking-wider',
    subtle: 'text-sm text-slate-400',
    data: 'font-mono text-slate-100',
  },
  colors: {
    bg: '#020617',        // slate-950
    panel: '#0f172a',     // slate-900
    border: '#334155',    // slate-700
    accent: '#6366f1',    // indigo-500
    accentHover: '#818cf8', // indigo-400
    textPrimary: '#f1f5f9',  // slate-100
    textMuted: '#94a3b8',    // slate-400
    textFaint: '#475569',    // slate-600
    success: '#34d399',   // emerald-400
    warning: '#fbbf24',   // amber-400
    danger: '#f87171',    // red-400
  },
};

/**
 * Injected into every prototype generation prompt.
 * Enforces enterprise visual standards and data density requirements.
 */
export const designLanguagePrompt = `
ENTERPRISE PROTOTYPE DESIGN STANDARDS — MUST FOLLOW:

PALETTE (exact Tailwind classes, no custom colors):
- Background: bg-slate-950 (overall), bg-slate-900 (panels/cards)
- Borders: border-slate-700/50 or border-slate-800
- Primary text: text-slate-100
- Secondary text: text-slate-400
- Faint/disabled: text-slate-600
- Accent: text-indigo-400, bg-indigo-600, border-indigo-500/40
- Success: text-emerald-400  |  Warning: text-amber-400  |  Error: text-rose-400
- Data/metric values: font-mono text-slate-100

COMPONENT STRUCTURE:
- Root element: w-full h-full overflow-auto bg-slate-950 text-slate-100 p-6
- Panels/cards: rounded-xl border border-slate-700/50 bg-slate-900 p-4
- Section headers: text-xs font-medium text-slate-400 uppercase tracking-wider mb-3
- Dividers: border-t border-slate-800

DATA DENSITY (enterprise requirement):
- Always populate with realistic, domain-specific data — NO "Lorem ipsum", NO "User 1", NO "Item A"
- For B2B SaaS: real company names, dollar amounts, percentages, dates
- For HR: real-sounding names, job titles, headcounts, departments
- For supply chain: SKUs, quantities, lead times, locations
- Minimum: 5-8 rows in any table, 3-6 data points in any chart

CHARTS & VISUALIZATIONS (use Recharts via import):
- Import from 'recharts': BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend, FunnelChart, Funnel, LabelList
- Chart container: <ResponsiveContainer width="100%" height={240}>
- Colors: stroke="#6366f1" fill="#6366f1" for primary, "#10b981" for positive, "#f87171" for negative
- Axes: tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={{ stroke: '#334155' }} tickLine={false}
- Grid: strokeDasharray="3 3" stroke="#1e293b"
- Tooltip: contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#f1f5f9' }}

METRIC CARDS (required for dashboards):
<div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
  <div className="rounded-xl border border-slate-700/50 bg-slate-900 p-4">
    <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">METRIC NAME</p>
    <p className="text-2xl font-mono font-bold text-slate-100">$1.2M</p>
    <p className="text-xs text-emerald-400 mt-1">↑ 12.4% vs last period</p>
  </div>
</div>

DATA TABLES (for list/pipeline views):
- thead: bg-slate-800/50, th: text-xs font-medium text-slate-400 uppercase px-4 py-3 text-left
- tbody tr: border-t border-slate-800 hover:bg-slate-800/30 transition-colors
- td: px-4 py-3 text-sm text-slate-200

FILE UPLOAD (when required):
- Use <input type="file" accept=".csv,.xlsx,.json">
- Parse CSV with Papa.parse from 'papaparse' (import Papa from 'papaparse')
- Parse XLSX with XLSX from 'xlsx' (import * as XLSX from 'xlsx')
- Show upload state and populate table/chart after parse

BUTTONS:
- Primary: px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors
- Secondary: px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm border border-slate-700/50 transition-colors

NO glassmorphism, NO neon glows, NO gradient overlays on cards, NO placeholder text.
The component must feel like a production enterprise dashboard a CFO/VP would present.
`;

/**
 * Embed guidance into generation prompts with optional extra context.
 */
export function applyDesignGuidance(extra?: string) {
  return `${designLanguagePrompt}${extra ? `\n${extra}` : ''}`;
}
