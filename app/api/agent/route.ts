import { NextResponse } from 'next/server';
import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

const deepseek = createOpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com/v1',
});
import { MultiAgentOrchestrator } from '@/lib/multiAgentOrchestrator';
import { ORCHESTRATOR_MODEL, summarizeUsage } from '@/lib/aiConfig';

export const runtime = 'edge';

const COMPONENT_GENERATOR_PROMPT = `You are a React component generator. ALWAYS respond with ONLY valid React component code (TypeScript JSX).

## Sandbox Rules (CRITICAL — violating these causes a runtime crash)
- Return ONLY the component code. No import statements, no markdown fences, no explanations.
- Always use: export default function ComponentName() { ... }
- The component receives NO props and must fill 100% width/height: className="w-full h-full"
- The following React APIs are pre-injected as globals — use them directly, never import them:
    useState, useEffect, useReducer, useCallback, useMemo, useRef, useLayoutEffect,
    useContext, createContext, createRef, forwardRef, memo, Fragment, Suspense, lazy,
    cloneElement, isValidElement, Children
- NO external library imports. No fetch/network calls. No window/document hacks.
- React Context is allowed ONLY if you provide a non-null default value to createContext:
    ✅  const Ctx = createContext({ value: 0, setValue: () => {} });
    ❌  const Ctx = createContext(null);   // crashes when consumers destructure without guard
- NEVER call hooks conditionally or outside a function component body.
- All state and derived values must be initialized before use.

## Quality Requirements
- Use Tailwind CSS for styling (spacing, radii, shadows, typography).
- Accessibility: WCAG AA contrast, clear focus rings, keyboard navigable controls.
- Obvious hover/active states; smooth but lightweight transitions; respect prefers-reduced-motion.
- Handle empty/loading/error states with clear instructional UI.
- For dashboards: hardcode realistic domain-specific data inline (real names, real numbers).
- For data-entry tools: accept CSV/JSON via file input or textarea, parse client-side, then render.

## Example valid response
export default function Card() {
  return (
    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
      <div className="p-8 bg-white rounded-xl shadow-lg focus-within:ring-2 focus-within:ring-cyan-400 outline-none" tabIndex={-1}>
        <h1 className="text-2xl font-bold text-gray-800">Hello World</h1>
        <p className="text-gray-600 mt-2">This is a sample component.</p>
        <button className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500 text-white font-semibold shadow hover:bg-cyan-600 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-cyan-500">
          Action
          <span aria-hidden className="text-lg">→</span>
        </button>
      </div>
    </div>
  );
}`;

/**
 * Determine if analytics agent is needed based on user query
 */
function needsAnalyticsAgent(query: string): boolean {
  const analyticsKeywords = [
    'track', 'tracking', 'analytics', 'metrics', 'measure',
    'conversion', 'event', 'data', 'statistics', 'monitor',
    'performance', 'insights', 'behavior', 'engagement'
  ];
  const lowerQuery = query.toLowerCase();
  return analyticsKeywords.some(keyword => lowerQuery.includes(keyword));
}

/**
 * Determine if marketing agent is needed based on user query
 */
function needsMarketingAgent(query: string): boolean {
  const marketingKeywords = [
    'cta', 'call to action', 'marketing', 'conversion', 'landing',
    'sale', 'pricing', 'product', 'campaign', 'promotional',
    'advertisement', 'signup', 'subscribe', 'newsletter', 'lead'
  ];
  const lowerQuery = query.toLowerCase();
  return marketingKeywords.some(keyword => lowerQuery.includes(keyword));
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = 
      body?.messages || [];
    const currentComponentCode = body?.currentComponentCode || null;
    const mode: 'rich' | 'minimal' = body?.mode === 'rich' ? 'rich' : 'minimal';
    
    // Get the latest user message as the query
    const userQuery = messages.filter((m) => m.role === 'user').pop()?.content || '';

    // Convert message history to AI SDK format with proper typing
    const formattedMessages = messages.map((message) => ({
      role: message.role as 'user' | 'assistant',
      content: message.content,
    }));

    // Enhance prompt if this is an improvement request on existing component
    let systemPrompt = COMPONENT_GENERATOR_PROMPT;
    if (currentComponentCode) {
      systemPrompt = `${COMPONENT_GENERATOR_PROMPT}

IMPORTANT: You are improving an existing component. The user has provided improvement suggestions.

Current Component Code:
${currentComponentCode}

User's Improvement Request: "${userQuery}"

Your task: Modify the existing component to incorporate the user's suggestions while maintaining all existing functionality. Return the complete updated component code.`;
    }

  // Honor mode: bias styling towards rich polish or minimal simplicity
  if (mode === 'rich') {
    systemPrompt += `

Design Guidance (Rich Mode):
- Elevate aesthetics with consistent Tailwind tokens (spacing, radii, shadows, blur tiers)
- Tasteful glassmorphism: translucent layers, backdrop-blur, subtle gradients
- Modern typography, clear hierarchy, and micro-interactions for hover/focus
- Maintain accessibility (WCAG AA contrast, visible focus states, keyboard navigation)
- Responsive layout; performance-friendly effects (reduce intensity on mobile)`;
  } else {
    systemPrompt += `

Design Guidance (Minimal Mode):
- Prioritize simplicity and clarity; avoid heavy blur/shadow/animations
- Lean typography and spacing; strong accessibility and responsiveness
- Keep interactions subtle and fast`;
  }

    // Step 1: Generate or improve component code using primary generator
    const { text: generatedCode, usage: generatorUsage } = await generateText({
      model: deepseek(ORCHESTRATOR_MODEL),
      system: systemPrompt,
      messages: currentComponentCode 
        ? [{ role: 'user', content: userQuery }] 
        : formattedMessages,
    });

    console.log('[/api/agent] Token usage (generator)', {
      userQuery,
      ...summarizeUsage(generatorUsage),
    });

    // Step 2: Determine which agents to use
    const { frontendAgent, qaAgent, reviewerAgent } = await import('@/lib/agents');
    const activeAgents = [frontendAgent, qaAgent, reviewerAgent];

    // Step 3: Multi-agent review using message bus
    const orchestrator = new MultiAgentOrchestrator(activeAgents);
    const result = await orchestrator.orchestrate(userQuery, generatedCode);

    // Step 4: Return result with agent feedback
    return NextResponse.json({
      reply: result.approved ? result.generatedCode : '',
      approved: result.approved,
      summary: result.summary,
      agentFeedback: result.agentResponses,
      activeAgents: activeAgents.map(a => a.name),
      skippedAgents: [],
      messageHistory: orchestrator.getMessageHistory(),
    });
  } catch (error: any) {
    console.error('Multi-agent system error:', error);
    return NextResponse.json(
      { 
        error: 'Multi-agent system failed to respond.',
        approved: false,
        summary: 'System error occurred',
      }, 
      { status: 500 }
    );
  }
}
