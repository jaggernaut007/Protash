'use client';
import React, { useCallback, useEffect, useState } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

type EvidenceStatus = 'not_started' | 'draft' | 'in_review' | 'final';
type CriterionType = 'mandatory' | 'optional_1' | 'optional_2';
type RecommenderStatus = 'not_contacted' | 'contacted' | 'agreed' | 'drafted' | 'final';

interface EvidencePiece {
  id: string;
  slot: number;
  title: string;
  criterion: CriterionType;
  status: EvidenceStatus;
  pages: number;
  notes: string;
  url: string;
}

interface Recommender {
  id: string;
  name: string;
  title: string;
  company: string;
  isProductLed: boolean;
  status: RecommenderStatus;
  dueDate: string;
  notes: string;
}

interface VisaData {
  evidence: EvidencePiece[];
  recommenders: Recommender[];
  route: 'promise' | 'talent';
  personalStatementDone: boolean;
  cvUpdated: boolean;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const VISA_EXPIRY = new Date('2026-12-11T00:00:00Z');
const SUBMISSION_DEADLINE = new Date('2026-08-01T00:00:00Z');
const ENDORSEMENT_FEE = 541;
const VISA_FEE = 192;
const IHS_PER_YEAR = 1035;

const CRITERION_LABELS: Record<CriterionType, { label: string; color: string; bg: string }> = {
  mandatory: { label: 'Mandatory: Leadership', color: 'text-cyan-400', bg: 'bg-cyan-500/15 border-cyan-500/30' },
  optional_1: { label: 'Optional 1: Innovation', color: 'text-violet-400', bg: 'bg-violet-500/15 border-violet-500/30' },
  optional_2: { label: 'Optional 2: Beyond Job', color: 'text-amber-400', bg: 'bg-amber-500/15 border-amber-500/30' },
};

const STATUS_LABELS: Record<EvidenceStatus, { label: string; color: string; dot: string }> = {
  not_started: { label: 'Not Started', color: 'text-slate-500', dot: 'bg-slate-600' },
  draft: { label: 'Draft', color: 'text-amber-400', dot: 'bg-amber-500' },
  in_review: { label: 'In Review', color: 'text-blue-400', dot: 'bg-blue-500' },
  final: { label: 'Final', color: 'text-emerald-400', dot: 'bg-emerald-500' },
};

const REC_STATUS_LABELS: Record<RecommenderStatus, { label: string; color: string }> = {
  not_contacted: { label: 'Not Contacted', color: 'text-slate-500' },
  contacted: { label: 'Contacted', color: 'text-amber-400' },
  agreed: { label: 'Agreed', color: 'text-blue-400' },
  drafted: { label: 'Drafted', color: 'text-violet-400' },
  final: { label: 'Final', color: 'text-emerald-400' },
};

const DEFAULT_EVIDENCE: EvidencePiece[] = [
  { id: '1', slot: 1, title: 'CAIO / CTO Leadership', criterion: 'mandatory', status: 'not_started', pages: 0, notes: '', url: '' },
  { id: '2', slot: 2, title: 'Sovereign OS Architecture', criterion: 'mandatory', status: 'not_started', pages: 0, notes: '', url: '' },
  { id: '3', slot: 3, title: 'Recommendation Letter #1', criterion: 'mandatory', status: 'not_started', pages: 0, notes: '', url: '' },
  { id: '4', slot: 4, title: 'Multi-Agent Pipeline (JobScout)', criterion: 'optional_1', status: 'not_started', pages: 0, notes: '', url: '' },
  { id: '5', slot: 5, title: '10x Token Reduction Methodology', criterion: 'optional_1', status: 'not_started', pages: 0, notes: '', url: '' },
  { id: '6', slot: 6, title: 'UKSEDS IOSM 2024 Win', criterion: 'optional_1', status: 'not_started', pages: 0, notes: '', url: '' },
  { id: '7', slot: 7, title: 'Nexus-MCP Open Source', criterion: 'optional_2', status: 'not_started', pages: 0, notes: '', url: '' },
  { id: '8', slot: 8, title: 'AI & RL Path-Planning Paper', criterion: 'optional_2', status: 'not_started', pages: 0, notes: '', url: '' },
  { id: '9', slot: 9, title: 'Meetup Speaking / Mentoring', criterion: 'optional_2', status: 'not_started', pages: 0, notes: '', url: '' },
  { id: '10', slot: 10, title: 'GitHub Portfolio (64 repos)', criterion: 'optional_2', status: 'not_started', pages: 0, notes: '', url: '' },
];

const DEFAULT_RECOMMENDERS: Recommender[] = [
  { id: 'r1', name: '', title: '', company: '', isProductLed: false, status: 'not_contacted', dueDate: '', notes: '' },
  { id: 'r2', name: '', title: '', company: '', isProductLed: false, status: 'not_contacted', dueDate: '', notes: '' },
  { id: 'r3', name: '', title: '', company: '', isProductLed: false, status: 'not_contacted', dueDate: '', notes: '' },
];

function daysUntil(date: Date): number {
  return Math.max(0, Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function CountdownBar() {
  const daysToExpiry = daysUntil(VISA_EXPIRY);
  const daysToSubmit = daysUntil(SUBMISSION_DEADLINE);
  const totalDays = Math.ceil((VISA_EXPIRY.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  const submitPct = Math.max(0, Math.min(100, (1 - daysToSubmit / totalDays) * 100));

  const urgencyColor =
    daysToSubmit > 120 ? 'text-emerald-400' :
    daysToSubmit > 60 ? 'text-amber-400' :
    'text-rose-400';

  const urgencyGlow =
    daysToSubmit > 120 ? 'shadow-emerald-500/20' :
    daysToSubmit > 60 ? 'shadow-amber-500/20' :
    'shadow-rose-500/20';

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <div className={`p-4 rounded-2xl bg-slate-800/40 border border-slate-700/50 shadow-lg ${urgencyGlow}`}>
          <p className="text-xs text-slate-400 font-semibold uppercase tracking-widest mb-1">Submit By</p>
          <p className={`text-3xl font-black tabular-nums ${urgencyColor}`}>{daysToSubmit}</p>
          <p className="text-xs text-slate-500 mt-0.5">days • Aug 1, 2026</p>
        </div>
        <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-700/50 shadow-lg">
          <p className="text-xs text-slate-400 font-semibold uppercase tracking-widest mb-1">Visa Expires</p>
          <p className="text-3xl font-black tabular-nums text-slate-300">{daysToExpiry}</p>
          <p className="text-xs text-slate-500 mt-0.5">days • Dec 11, 2026</p>
        </div>
      </div>
      <div className="relative h-2 w-full rounded-full bg-slate-800 border border-slate-700 overflow-hidden">
        <div
          className="absolute left-0 top-0 h-full bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-500 rounded-full transition-all duration-1000"
          style={{ width: `${submitPct}%` }}
        />
        <div
          className="absolute top-[-4px] w-0.5 h-[calc(100%+8px)] bg-white/60"
          style={{ left: `${submitPct}%` }}
          title="Recommended submission deadline"
        />
      </div>
      <p className="text-xs text-slate-500">
        Timeline: Now → Submission (Aug 1) → Endorsement (4-8 wks) → Visa (2-8 wks) → Dec 11 expiry
      </p>
    </div>
  );
}

function CostTracker({ route }: { route: 'promise' | 'talent' }) {
  const ihsYears = route === 'talent' ? 3 : 5;
  const ihsTotal = IHS_PER_YEAR * ihsYears;
  const total = ENDORSEMENT_FEE + VISA_FEE + ihsTotal;

  return (
    <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-700/50">
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-2">Estimated Costs</p>
      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between text-sm">
          <span className="text-slate-400">Tech Nation Endorsement</span>
          <span className="text-slate-200 font-semibold">£{ENDORSEMENT_FEE}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-400">Visa Application</span>
          <span className="text-slate-200 font-semibold">£{VISA_FEE}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-400">IHS ({ihsYears}yr × £{IHS_PER_YEAR})</span>
          <span className="text-slate-200 font-semibold">£{ihsTotal.toLocaleString()}</span>
        </div>
        <div className="border-t border-slate-700/50 pt-1.5 flex justify-between text-sm">
          <span className="text-white font-bold">Total</span>
          <span className="text-cyan-400 font-black text-lg">£{total.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}

function EvidenceGrid({
  evidence,
  onUpdate,
}: {
  evidence: EvidencePiece[];
  onUpdate: (id: string, updates: Partial<EvidencePiece>) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const byCriterion: Record<CriterionType, EvidencePiece[]> = {
    mandatory: [],
    optional_1: [],
    optional_2: [],
  };
  evidence.forEach(e => byCriterion[e.criterion].push(e));

  const completed = evidence.filter(e => e.status === 'final').length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
          Evidence Portfolio
        </p>
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-24 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-violet-500 to-cyan-500 rounded-full transition-all"
              style={{ width: `${(completed / 10) * 100}%` }}
            />
          </div>
          <span className="text-xs text-slate-400 font-semibold tabular-nums">{completed}/10</span>
        </div>
      </div>

      {(Object.keys(byCriterion) as CriterionType[]).map(criterion => (
        <div key={criterion}>
          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold mb-2 ${CRITERION_LABELS[criterion].bg} ${CRITERION_LABELS[criterion].color}`}>
            {CRITERION_LABELS[criterion].label}
          </div>
          <div className="flex flex-col gap-1.5">
            {byCriterion[criterion].map(piece => {
              const s = STATUS_LABELS[piece.status];
              const isExpanded = expandedId === piece.id;
              return (
                <div key={piece.id}>
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : piece.id)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700/40 hover:border-slate-600/60 transition-colors text-left"
                  >
                    <span className="text-xs text-slate-500 font-mono w-5 flex-shrink-0">#{piece.slot}</span>
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${s.dot}`} />
                    <span className="text-sm text-slate-200 font-medium flex-1 truncate">{piece.title}</span>
                    <span className={`text-xs font-semibold ${s.color}`}>{s.label}</span>
                    {piece.pages > 0 && (
                      <span className="text-xs text-slate-500 tabular-nums">{piece.pages}/3p</span>
                    )}
                    <svg className={`w-3.5 h-3.5 text-slate-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {isExpanded && (
                    <div className="mt-1.5 ml-8 p-3 rounded-xl bg-slate-800/30 border border-slate-700/30 flex flex-col gap-2.5">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs text-slate-500 block mb-1">Status</label>
                          <select
                            value={piece.status}
                            onChange={e => onUpdate(piece.id, { status: e.target.value as EvidenceStatus })}
                            className="w-full bg-slate-900/80 border border-slate-700/50 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-violet-500/50"
                          >
                            <option value="not_started">Not Started</option>
                            <option value="draft">Draft</option>
                            <option value="in_review">In Review</option>
                            <option value="final">Final</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-slate-500 block mb-1">Pages (max 3)</label>
                          <input
                            type="number"
                            min={0}
                            max={3}
                            value={piece.pages}
                            onChange={e => onUpdate(piece.id, { pages: Math.min(3, Math.max(0, parseInt(e.target.value) || 0)) })}
                            className="w-full bg-slate-900/80 border border-slate-700/50 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-violet-500/50"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 block mb-1">Evidence URL / Link</label>
                        <input
                          type="url"
                          value={piece.url}
                          onChange={e => onUpdate(piece.id, { url: e.target.value })}
                          placeholder="https://..."
                          className="w-full bg-slate-900/80 border border-slate-700/50 rounded-lg px-2 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 block mb-1">Notes</label>
                        <textarea
                          value={piece.notes}
                          onChange={e => onUpdate(piece.id, { notes: e.target.value })}
                          rows={2}
                          placeholder="What evidence will you include?"
                          className="w-full bg-slate-900/80 border border-slate-700/50 rounded-lg px-2 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50 resize-none"
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function RecommenderTracker({
  recommenders,
  onUpdate,
}: {
  recommenders: Recommender[];
  onUpdate: (id: string, updates: Partial<Recommender>) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
        Recommenders (3 Required)
      </p>
      <div className="flex flex-col gap-2">
        {recommenders.map((rec, idx) => {
          const s = REC_STATUS_LABELS[rec.status];
          const isExpanded = expandedId === rec.id;
          const isEmpty = !rec.name;
          const daysLeft = rec.dueDate ? daysUntil(new Date(rec.dueDate)) : null;
          const isUrgent = daysLeft !== null && daysLeft < 14;

          return (
            <div key={rec.id}>
              <button
                onClick={() => setExpandedId(isExpanded ? null : rec.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors text-left ${
                  isEmpty
                    ? 'bg-slate-800/30 border-dashed border-slate-700/50 hover:border-slate-600/60'
                    : 'bg-slate-800/50 border-slate-700/40 hover:border-slate-600/60'
                }`}
              >
                <span className="text-sm w-5 flex-shrink-0 text-center">
                  {rec.status === 'final' ? '✅' : `${idx + 1}.`}
                </span>
                <div className="flex-1 min-w-0">
                  {isEmpty ? (
                    <span className="text-sm text-slate-500 italic">Add recommender…</span>
                  ) : (
                    <>
                      <p className="text-sm text-slate-200 font-medium truncate">{rec.name}</p>
                      <p className="text-xs text-slate-500 truncate">{rec.title} · {rec.company}</p>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {!rec.isProductLed && rec.company && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-400 border border-rose-500/30">⚠ Service?</span>
                  )}
                  {rec.isProductLed && rec.company && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">Product ✓</span>
                  )}
                  {isUrgent && daysLeft !== null && (
                    <span className="text-xs text-rose-400 font-semibold tabular-nums">{daysLeft}d</span>
                  )}
                  <span className={`text-xs font-semibold ${s.color}`}>{s.label}</span>
                </div>
                <svg className={`w-3.5 h-3.5 text-slate-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {isExpanded && (
                <div className="mt-1.5 ml-8 p-3 rounded-xl bg-slate-800/30 border border-slate-700/30 flex flex-col gap-2.5">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-slate-500 block mb-1">Full Name</label>
                      <input
                        type="text"
                        value={rec.name}
                        onChange={e => onUpdate(rec.id, { name: e.target.value })}
                        placeholder="Dr. Jane Smith"
                        className="w-full bg-slate-900/80 border border-slate-700/50 rounded-lg px-2 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 block mb-1">Title</label>
                      <input
                        type="text"
                        value={rec.title}
                        onChange={e => onUpdate(rec.id, { title: e.target.value })}
                        placeholder="CEO / Lead Scientist"
                        className="w-full bg-slate-900/80 border border-slate-700/50 rounded-lg px-2 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-slate-500 block mb-1">Company</label>
                      <input
                        type="text"
                        value={rec.company}
                        onChange={e => onUpdate(rec.id, { company: e.target.value })}
                        placeholder="Company name"
                        className="w-full bg-slate-900/80 border border-slate-700/50 rounded-lg px-2 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 block mb-1">Status</label>
                      <select
                        value={rec.status}
                        onChange={e => onUpdate(rec.id, { status: e.target.value as RecommenderStatus })}
                        className="w-full bg-slate-900/80 border border-slate-700/50 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-violet-500/50"
                      >
                        <option value="not_contacted">Not Contacted</option>
                        <option value="contacted">Contacted</option>
                        <option value="agreed">Agreed</option>
                        <option value="drafted">Drafted</option>
                        <option value="final">Final</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-slate-500 block mb-1">Due Date</label>
                      <input
                        type="date"
                        value={rec.dueDate}
                        onChange={e => onUpdate(rec.id, { dueDate: e.target.value })}
                        className="w-full bg-slate-900/80 border border-slate-700/50 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-violet-500/50"
                      />
                    </div>
                    <div className="flex items-end">
                      <label className="flex items-center gap-2 px-2 py-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={rec.isProductLed}
                          onChange={e => onUpdate(rec.id, { isProductLed: e.target.checked })}
                          className="w-3.5 h-3.5 rounded border-slate-600 bg-slate-900 text-violet-500 focus:ring-violet-500/30"
                        />
                        <span className="text-xs text-slate-400">Product-led company</span>
                      </label>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Notes</label>
                    <textarea
                      value={rec.notes}
                      onChange={e => onUpdate(rec.id, { notes: e.target.value })}
                      rows={2}
                      placeholder="How do they know your work? What will they highlight?"
                      className="w-full bg-slate-900/80 border border-slate-700/50 rounded-lg px-2 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50 resize-none"
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StageChecklist({ data }: { data: VisaData }) {
  const evidenceReady = data.evidence.filter(e => e.status === 'final').length;
  const recommendersReady = data.recommenders.filter(r => r.status === 'final').length;

  const checks = [
    { label: 'Route chosen (Promise / Talent)', done: true },
    { label: `CV updated for Tech Nation`, done: data.cvUpdated },
    { label: `Personal statement (1,000 words)`, done: data.personalStatementDone },
    { label: `Evidence pieces (${evidenceReady}/10 final)`, done: evidenceReady >= 10 },
    { label: `Recommendation letters (${recommendersReady}/3 final)`, done: recommendersReady >= 3 },
    { label: 'Stage 1: Endorsement submitted (£541)', done: false },
    { label: 'Stage 1: Endorsement received', done: false },
    { label: 'Stage 2: Visa application submitted', done: false },
    { label: 'Stage 2: Global Talent visa granted', done: false },
  ];

  return (
    <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-700/50">
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">Application Checklist</p>
      <div className="flex flex-col gap-1.5">
        {checks.map((c, i) => (
          <div key={i} className="flex items-center gap-2.5">
            <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 ${c.done ? 'bg-emerald-500/20 border border-emerald-500/40' : 'bg-slate-800 border border-slate-700/50'}`}>
              {c.done && (
                <svg className="w-2.5 h-2.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <span className={`text-xs ${c.done ? 'text-slate-300 line-through' : 'text-slate-400'}`}>{c.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export default function VisaEvidencePanel() {
  const [data, setData] = useState<VisaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/visa/evidence');
      const json = await res.json();
      setData(json);
    } catch {
      // Default data if no saved state
      setData({
        evidence: DEFAULT_EVIDENCE,
        recommenders: DEFAULT_RECOMMENDERS,
        route: 'promise',
        personalStatementDone: false,
        cvUpdated: false,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const saveData = useCallback(async (updated: VisaData) => {
    setSaving(true);
    try {
      await fetch('/api/visa/evidence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
      setLastSaved(new Date().toLocaleTimeString());
    } catch {
      setError('Failed to save.');
    } finally {
      setSaving(false);
    }
  }, []);

  const updateEvidence = useCallback((id: string, updates: Partial<EvidencePiece>) => {
    if (!data) return;
    const updated = {
      ...data,
      evidence: data.evidence.map(e => e.id === id ? { ...e, ...updates } : e),
    };
    setData(updated);
    saveData(updated);
  }, [data, saveData]);

  const updateRecommender = useCallback((id: string, updates: Partial<Recommender>) => {
    if (!data) return;
    const updated = {
      ...data,
      recommenders: data.recommenders.map(r => r.id === id ? { ...r, ...updates } : r),
    };
    setData(updated);
    saveData(updated);
  }, [data, saveData]);

  const toggleField = useCallback((field: 'personalStatementDone' | 'cvUpdated') => {
    if (!data) return;
    const updated = { ...data, [field]: !data[field] };
    setData(updated);
    saveData(updated);
  }, [data, saveData]);

  return (
    <div className="flex flex-col gap-5 h-full overflow-y-auto custom-scrollbar pr-1">

      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h2 className="text-xl font-black text-white tracking-tight">Global Talent Visa</h2>
          <p className="text-xs text-slate-400 mt-0.5">Digital Technology Route · Tech Nation Endorsement</p>
        </div>
        <div className="flex items-center gap-2">
          {data && (
            <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold ${
              data.route === 'promise'
                ? 'bg-violet-500/15 border-violet-500/30 text-violet-400'
                : 'bg-cyan-500/15 border-cyan-500/30 text-cyan-400'
            }`}>
              {data.route === 'promise' ? '🌟 Exceptional Promise' : '👑 Exceptional Talent'}
            </div>
          )}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800/50 border border-slate-700/50 text-xs font-medium text-slate-400">
            {saving ? (
              <><div className="w-2 h-2 border border-violet-400/30 border-t-violet-400 rounded-full animate-spin" /> Saving…</>
            ) : lastSaved ? (
              <><div className="w-2 h-2 rounded-full bg-emerald-500" /> Saved {lastSaved}</>
            ) : (
              'Auto-save'
            )}
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-sm text-rose-400">
          <span>⚠️</span> {error}
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
            <p className="text-sm text-slate-400">Loading visa tracker…</p>
          </div>
        </div>
      ) : data && (
        <div className="flex flex-col gap-5">
          {/* Countdown */}
          <CountdownBar />

          {/* Quick toggles */}
          <div className="flex gap-3">
            <button
              onClick={() => toggleField('cvUpdated')}
              className={`flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-semibold transition-all ${
                data.cvUpdated
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                  : 'bg-slate-800/50 border-slate-700/40 text-slate-400 hover:text-slate-200 hover:border-slate-600/60'
              }`}
            >
              {data.cvUpdated ? '✅' : '📄'} CV Updated
            </button>
            <button
              onClick={() => toggleField('personalStatementDone')}
              className={`flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-semibold transition-all ${
                data.personalStatementDone
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                  : 'bg-slate-800/50 border-slate-700/40 text-slate-400 hover:text-slate-200 hover:border-slate-600/60'
              }`}
            >
              {data.personalStatementDone ? '✅' : '📝'} Personal Statement
            </button>
          </div>

          {/* Evidence Grid */}
          <EvidenceGrid evidence={data.evidence} onUpdate={updateEvidence} />

          {/* Recommenders */}
          <RecommenderTracker recommenders={data.recommenders} onUpdate={updateRecommender} />

          {/* Checklist + Costs */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <StageChecklist data={data} />
            <CostTracker route={data.route} />
          </div>
        </div>
      )}
    </div>
  );
}
