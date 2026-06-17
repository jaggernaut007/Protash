/**
 * Eval test cases for the prototype generation pipeline.
 * Each case defines an intent, expected domain artifacts, and quality gates.
 */

export interface EvalCase {
  id: string;
  intent: string;
  expectedDomain: string;
  expectedEntities: string[];
  expectedChartTypes: string[];
  mustNotContain: string[];
  expectedKpiKeywords: string[];
}

export const EVAL_CASES: EvalCase[] = [
  {
    id: 'saas-pipeline',
    intent: 'Sales pipeline dashboard for mid-market B2B SaaS showing ARR, win rate, pipeline stages, and rep performance',
    expectedDomain: 'saas',
    expectedEntities: ['Deal', 'Account', 'Rep', 'Pipeline', 'Opportunity'],
    expectedChartTypes: ['BarChart', 'LineChart', 'FunnelChart', 'ResponsiveContainer'],
    mustNotContain: ['Lorem ipsum', 'placeholder', 'User 1', 'Item A', 'Sample Data', 'example text'],
    expectedKpiKeywords: ['ARR', 'Win Rate', 'Pipeline', 'Revenue', 'Deal'],
  },
  {
    id: 'hr-headcount',
    intent: 'HR headcount planning dashboard showing department headcount, open roles, attrition rate, and hiring pipeline by quarter',
    expectedDomain: 'hr',
    expectedEntities: ['Employee', 'Department', 'Role', 'Headcount'],
    expectedChartTypes: ['BarChart', 'LineChart', 'ResponsiveContainer'],
    mustNotContain: ['Lorem ipsum', 'placeholder', 'User 1', 'Item A'],
    expectedKpiKeywords: ['Headcount', 'Attrition', 'Hire', 'Department'],
  },
  {
    id: 'supply-chain',
    intent: 'Supply chain tracking dashboard for a manufacturing company showing inventory levels, supplier performance, lead times, and delivery accuracy',
    expectedDomain: 'supply chain',
    expectedEntities: ['SKU', 'Supplier', 'Inventory', 'Order', 'Shipment'],
    expectedChartTypes: ['BarChart', 'LineChart', 'ResponsiveContainer'],
    mustNotContain: ['Lorem ipsum', 'placeholder', 'User 1'],
    expectedKpiKeywords: ['Inventory', 'Lead Time', 'Supplier', 'Delivery'],
  },
  {
    id: 'customer-support',
    intent: 'Customer support operations dashboard showing ticket volume, resolution time, CSAT score, and agent performance by category',
    expectedDomain: 'support',
    expectedEntities: ['Ticket', 'Agent', 'Customer', 'Category'],
    expectedChartTypes: ['BarChart', 'LineChart', 'ResponsiveContainer'],
    mustNotContain: ['Lorem ipsum', 'placeholder', 'Item A'],
    expectedKpiKeywords: ['Ticket', 'CSAT', 'Resolution', 'Agent'],
  },
  {
    id: 'financial-forecast',
    intent: 'Financial planning dashboard showing revenue forecast vs actuals, expense breakdown by department, gross margin trend, and cash runway',
    expectedDomain: 'finance',
    expectedEntities: ['Revenue', 'Expense', 'Budget', 'Department', 'Forecast'],
    expectedChartTypes: ['LineChart', 'BarChart', 'ResponsiveContainer'],
    mustNotContain: ['Lorem ipsum', 'placeholder', 'User 1'],
    expectedKpiKeywords: ['Revenue', 'Margin', 'Forecast', 'Budget', 'Cash'],
  },
  {
    id: 'product-metrics',
    intent: 'Product analytics dashboard for a SaaS product showing DAU/MAU, feature adoption, user retention cohorts, and NPS trend',
    expectedDomain: 'product',
    expectedEntities: ['User', 'Feature', 'Session', 'Cohort'],
    expectedChartTypes: ['LineChart', 'BarChart', 'ResponsiveContainer'],
    mustNotContain: ['Lorem ipsum', 'placeholder', 'Item A'],
    expectedKpiKeywords: ['DAU', 'MAU', 'Retention', 'NPS', 'Adoption'],
  },
  {
    id: 'logistics-ops',
    intent: 'Logistics operations dashboard for a last-mile delivery company showing on-time delivery rate, route efficiency, driver utilization, and cost per delivery',
    expectedDomain: 'logistics',
    expectedEntities: ['Driver', 'Route', 'Delivery', 'Vehicle'],
    expectedChartTypes: ['BarChart', 'LineChart', 'ResponsiveContainer'],
    mustNotContain: ['Lorem ipsum', 'placeholder', 'User 1'],
    expectedKpiKeywords: ['Delivery', 'Route', 'Driver', 'Cost', 'On-time'],
  },
  {
    id: 'marketing-pipeline',
    intent: 'Marketing campaign performance dashboard showing MQL volume, conversion funnel, channel ROI, and campaign spend vs pipeline generated',
    expectedDomain: 'marketing',
    expectedEntities: ['Campaign', 'MQL', 'Channel', 'Lead', 'Conversion'],
    expectedChartTypes: ['FunnelChart', 'BarChart', 'LineChart', 'ResponsiveContainer'],
    mustNotContain: ['Lorem ipsum', 'placeholder', 'Item A'],
    expectedKpiKeywords: ['MQL', 'Conversion', 'ROI', 'Pipeline', 'Campaign'],
  },
];
