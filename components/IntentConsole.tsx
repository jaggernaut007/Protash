'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { MessageBus } from '@/lib/messageBus';
import { loadConnectorSummaries } from '@/lib/connectors';
import { Intent } from '@/types/board';

// Stage definitions for the 6-stage pipeline
const PIPELINE_STAGES = [
  { id: 'Business Context', label: 'Business Context', description: 'Extracting domain, entities & KPIs' },
  { id: 'Spec',             label: 'Spec',             description: 'Defining screens & data model' },
  { id: 'UX Architecture',  label: 'UX Architecture',  description: 'Selecting layout & charts' },
  { id: 'Development',      label: 'Development',      description: 'Generating component code' },
  { id: 'QA',               label: 'QA',               description: 'Validating data & design quality' },
  { id: 'Review',           label: 'Review',           description: 'Checking business alignment' },
] as const;

type StageId = typeof PIPELINE_STAGES[number]['id'];
type StageStatus = 'pending' | 'running' | 'done' | 'error';

interface StageState {
  status: StageStatus;
  data?: Record<string, unknown>;
}

interface IntentConsoleProps {
  messageBus: MessageBus;
  onPrototypeGenerated?: (code: string) => void;
  onIntentCreated?: (intent: Intent) => void;
}

export default function IntentConsole({
  messageBus,
  onPrototypeGenerated,
  onIntentCreated,
}: IntentConsoleProps) {
  const [intentInput, setIntentInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [refineText, setRefineText] = useState('');
  const [hasGenerated, setHasGenerated] = useState(false);
  const [lastIntent, setLastIntent] = useState('');
  const [specSummary, setSpecSummary] = useState<{
    domain?: string;
    kpis?: string[];
    primaryScreen?: string;
    hypothesis?: string;
  } | null>(null);
  const [stages, setStages] = useState<Record<StageId, StageState>>(
    Object.fromEntries(PIPELINE_STAGES.map(s => [s.id, { status: 'pending' }])) as Record<StageId, StageState>
  );
  const [currentStageIndex, setCurrentStageIndex] = useState(-1);
  const [boardConnectors, setBoardConnectors] = useState<string[]>([]);

  useEffect(() => {
    fetch('/api/board')
      .then(r => r.json())
      .then(board => {
        const enabled = (board?.connectors || [])
          .filter((c: { enabled: boolean }) => c.enabled)
          .map((c: { type: string }) => c.type);
        setBoardConnectors(enabled);
      })
      .catch(() => {});
  }, []);

  // Listen for prototype:stage:complete events from message bus
  useEffect(() => {
    const unsubscribe = messageBus.subscribeTo('prototype:stage:complete', (event) => {
      const stageName = event.data.stage as StageId;
      setStages(prev => ({
        ...prev,
        [stageName]: { status: 'done', data: event.data },
      }));
      const stageIdx = PIPELINE_STAGES.findIndex(s => s.id === stageName);
      setCurrentStageIndex(stageIdx + 1);

      // Extract spec summary from Business Context and Spec stages
      if (stageName === 'Business Context' && event.data.businessContext) {
        const ctx = event.data.businessContext as { domain?: string; kpis?: string[]; hypothesis?: string };
        setSpecSummary(prev => ({ ...prev, domain: ctx.domain, kpis: ctx.kpis, hypothesis: ctx.hypothesis }));
      }
      if (stageName === 'Spec' && event.data.spec) {
        const sp = event.data.spec as { primaryScreen?: string };
        setSpecSummary(prev => ({ ...prev, primaryScreen: sp.primaryScreen }));
      }
    });
    return unsubscribe;
  }, [messageBus]);

  const resetStages = useCallback(() => {
    setStages(Object.fromEntries(PIPELINE_STAGES.map(s => [s.id, { status: 'pending' }])) as Record<StageId, StageState>);
    setCurrentStageIndex(0);
  }, []);

  const advanceStage = useCallback((idx: number) => {
    if (idx >= 0 && idx < PIPELINE_STAGES.length) {
      const stageId = PIPELINE_STAGES[idx].id;
      setStages(prev => ({ ...prev, [stageId]: { status: 'running' } }));
      setCurrentStageIndex(idx);
    }
  }, []);

  const generatePrototype = useCallback(
    async (intentDescription: string, refinement?: string) => {
      resetStages();
      advanceStage(0);

      // Create intent on board
      const createRes = await fetch('/api/board', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'createIntent',
          data: {
            title: intentDescription.split('\n')[0].substring(0, 80),
            description: intentDescription,
            domain: 'enterprise',
          },
        }),
      });
      const { intent } = await createRes.json();
      onIntentCreated?.(intent);

      // RAG board context
      const searchRes = await fetch('/api/board/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: intentDescription, limit: 5 }),
      });
      const { results: contextArtifacts } = await searchRes.json();
      const boardContext = contextArtifacts
        .map((a: { title: string; content: string }) => `${a.title}: ${a.content}`)
        .join('\n');

      // Connector summaries
      const connectorSummaries = await loadConnectorSummaries(boardConnectors as ('calendar' | 'bank' | 'wearable' | 'docs')[]);

      // Call the 6-stage prototype API
      const res = await fetch('/api/prototype', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context: {
            intentDescription,
            domain: 'enterprise',
            guidance: 'Build an enterprise-grade prototype',
            uiType: 'dashboard',
            boardContext,
            connectorSummaries,
          },
          refinement: refinement ?? '',
        }),
      });

      if (!res.ok) throw new Error(`Prototype generation failed: ${res.statusText}`);
      const result = await res.json();

      // Mark all remaining stages as done (server-side stages not published via MessageBus in this flow)
      setStages(Object.fromEntries(PIPELINE_STAGES.map(s => [s.id, { status: 'done' }])) as Record<StageId, StageState>);
      setCurrentStageIndex(PIPELINE_STAGES.length);

      if (result.code) {
        onPrototypeGenerated?.(result.code);
        messageBus.publishToTopic('codegen:complete', { code: result.code, approved: result.approved });
      } else {
        throw new Error('Pipeline completed but no code was generated');
      }

      // Server-side MessageBus events don't reach the client, so populate specSummary from the response directly
      if (result.businessContext) {
        const ctx = result.businessContext as { domain?: string; kpis?: string[]; hypothesis?: string };
        setSpecSummary(prev => ({ ...prev, domain: ctx.domain, kpis: ctx.kpis, hypothesis: ctx.hypothesis }));
      }
      if (result.spec) {
        const sp = result.spec as { primaryScreen?: string };
        setSpecSummary(prev => ({ ...prev, primaryScreen: sp.primaryScreen }));
      }

      return result;
    },
    [messageBus, onPrototypeGenerated, onIntentCreated, boardConnectors, resetStages, advanceStage]
  );

  const handleSubmitIntent = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!intentInput.trim()) { setErrorMessage('Please enter an intent'); return; }

      setIsLoading(true);
      setErrorMessage('');
      setSuccessMessage('');
      setSpecSummary(null);

      try {
        await generatePrototype(intentInput.trim());
        setLastIntent(intentInput.trim());
        setHasGenerated(true);
        setSuccessMessage('Prototype generated!');
        setIntentInput('');
        setTimeout(() => setSuccessMessage(''), 3000);
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : 'Generation failed');
        setStages(prev => {
          const runningStage = PIPELINE_STAGES.find(s => prev[s.id]?.status === 'running');
          if (!runningStage) return prev;
          return { ...prev, [runningStage.id]: { status: 'error' } };
        });
      } finally {
        setIsLoading(false);
      }
    },
    [intentInput, generatePrototype]
  );

  const handleRefine = useCallback(async () => {
    if (!lastIntent) { setErrorMessage('Generate a prototype first.'); return; }
    if (!refineText.trim()) { setErrorMessage('Add a refinement prompt.'); return; }

    setIsLoading(true);
    setErrorMessage('');
    setSuccessMessage('');
    setSpecSummary(null);

    try {
      await generatePrototype(lastIntent, refineText.trim());
      setSuccessMessage('Prototype updated!');
      setRefineText('');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Refinement failed');
    } finally {
      setIsLoading(false);
    }
  }, [lastIntent, refineText, generatePrototype]);

  const stageStatusIcon = (status: StageStatus) => {
    switch (status) {
      case 'done':    return <span className="text-emerald-400">✓</span>;
      case 'running': return <div className="w-3 h-3 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />;
      case 'error':   return <span className="text-rose-400">✕</span>;
      default:        return <div className="w-2 h-2 rounded-full bg-slate-700" />;
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950">
      {/* Header */}
      <div className="px-6 py-5 border-b border-slate-800 shrink-0">
        <h2 className="text-sm font-semibold text-slate-100 tracking-tight">Intent</h2>
        <p className="text-xs text-slate-500 mt-0.5">Describe your business goal</p>
      </div>

      <div className="flex flex-col flex-1 overflow-y-auto gap-5 px-6 py-5">

        {/* Intent form */}
        <form onSubmit={handleSubmitIntent} className="flex flex-col gap-3">
          <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
            Business Intent
          </label>
          <textarea
            value={intentInput}
            onChange={e => setIntentInput(e.target.value)}
            placeholder="e.g. Sales pipeline dashboard for mid-market B2B SaaS showing ARR, pipeline stages, and rep performance"
            disabled={isLoading}
            rows={5}
            className="w-full rounded-xl border border-slate-700/60 bg-slate-900 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500/60 resize-none disabled:opacity-50 transition-colors"
          />

          {errorMessage && (
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
              {errorMessage}
            </div>
          )}

          {successMessage && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
              {successMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || !intentInput.trim()}
            className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Generating…' : 'Generate Prototype'}
          </button>
        </form>

        {/* Pipeline progress — shown when loading or after generation */}
        {(isLoading || hasGenerated) && (
          <div className="flex flex-col gap-2 rounded-xl border border-slate-700/40 bg-slate-900/60 p-4">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Pipeline</p>
            {PIPELINE_STAGES.map((stage, idx) => {
              const status = stages[stage.id]?.status ?? 'pending';
              const isActive = status === 'running';
              return (
                <div
                  key={stage.id}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-colors ${
                    isActive ? 'bg-indigo-500/10 border border-indigo-500/20' :
                    status === 'done' ? 'bg-slate-800/30' : 'opacity-50'
                  }`}
                >
                  <div className="w-4 h-4 flex items-center justify-center shrink-0 text-xs">
                    {stageStatusIcon(status)}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className={`text-xs font-medium ${
                      status === 'done' ? 'text-slate-200' :
                      isActive ? 'text-indigo-300' : 'text-slate-500'
                    }`}>
                      {idx + 1}. {stage.label}
                    </span>
                    {isActive && (
                      <span className="text-xs text-slate-500 truncate">{stage.description}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Spec Summary — shown after successful generation */}
        {hasGenerated && specSummary && (
          <div className="flex flex-col gap-3 rounded-xl border border-slate-700/40 bg-slate-900/60 p-4">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Spec Summary</p>
            {specSummary.domain && (
              <div>
                <p className="text-xs text-slate-500 mb-0.5">Domain</p>
                <p className="text-xs font-medium text-slate-200">{specSummary.domain}</p>
              </div>
            )}
            {specSummary.primaryScreen && (
              <div>
                <p className="text-xs text-slate-500 mb-0.5">Primary Screen</p>
                <p className="text-xs font-medium text-slate-200">{specSummary.primaryScreen}</p>
              </div>
            )}
            {specSummary.kpis && specSummary.kpis.length > 0 && (
              <div>
                <p className="text-xs text-slate-500 mb-1">KPIs</p>
                <div className="flex flex-wrap gap-1">
                  {specSummary.kpis.slice(0, 6).map(kpi => (
                    <span key={kpi} className="px-2 py-0.5 rounded-md text-xs bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                      {kpi}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {specSummary.hypothesis && (
              <div>
                <p className="text-xs text-slate-500 mb-0.5">Hypothesis</p>
                <p className="text-xs text-slate-400 italic">{specSummary.hypothesis}</p>
              </div>
            )}
          </div>
        )}

        {/* Refine section */}
        {hasGenerated && (
          <div className="flex flex-col gap-3 pt-4 border-t border-slate-800">
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
              Modify Prototype
            </label>
            <textarea
              value={refineText}
              onChange={e => setRefineText(e.target.value)}
              placeholder="e.g. Add a funnel chart for conversion stages, use darker background"
              disabled={isLoading}
              rows={3}
              className="w-full rounded-xl border border-slate-700/60 bg-slate-900 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500/60 resize-none disabled:opacity-50 transition-colors"
            />
            <button
              type="button"
              onClick={handleRefine}
              disabled={isLoading || !refineText.trim()}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium border border-slate-700/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Applying changes…' : 'Apply Changes'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
