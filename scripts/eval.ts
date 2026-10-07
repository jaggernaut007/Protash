#!/usr/bin/env node
/**
 * Offline evaluation runner for the prototype generation pipeline.
 *
 * Usage:
 *   npx tsx scripts/eval.ts                    # Run all eval cases
 *   npx tsx scripts/eval.ts --case saas-pipeline  # Run specific case
 *   npx tsx scripts/eval.ts --output json       # JSON output to evals/results/
 */

import { EVAL_CASES } from '../evals/intents';
import { runPrototypePipeline } from '../lib/pipeline';
import { checkComponentCode } from '../lib/codeCheck';
import { scorePrototype, runDeterministicChecks } from '../lib/evalScorer';
import type { ScoreResult } from '../lib/evalScorer';
import * as fs from 'fs';
import * as path from 'path';

interface EvalRunResult {
  caseId: string;
  intent: string;
  score: ScoreResult;
  deterministicPassed: boolean;
  deterministicFailures: string[];
  code: string;
  approved: boolean;
  durationMs: number;
}

const args = process.argv.slice(2);
const caseFilter = args.find(a => a.startsWith('--case='))?.split('=')[1]
  || (args.includes('--case') ? args[args.indexOf('--case') + 1] : undefined);
const outputJson = args.includes('--output=json') || args.includes('--output json');

async function runCase(evalCase: typeof EVAL_CASES[number]): Promise<EvalRunResult> {
  const start = Date.now();
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`▶ ${evalCase.id}: ${evalCase.intent.substring(0, 70)}…`);

  try {
    // Run the same shared pipeline as /api/prototype. Log the time of each stage.
    const stageTimes: Record<string, number> = {};
    let last = start;
    const { code, approved, businessContext, spec, uxPlan } = await runPrototypePipeline(
      evalCase.intent,
      (stage) => {
        const now = Date.now();
        stageTimes[stage] = Math.round((now - last) / 1000);
        last = now;
      }
    );
    console.log(
      `  Stage seconds: ${Object.entries(stageTimes).map(([k, v]) => `${k}=${v}`).join(' ')}`
    );

    // A component that does not compile cannot render. The reviewers do not check this.
    const compile = checkComponentCode(code);

    // Score
    console.log('  [Score] Evaluating…');
    const deterministicResult = runDeterministicChecks(evalCase, code, businessContext);
    if (!compile.ok) deterministicResult.failures.push(`Code does not compile: ${compile.error}`);
    deterministicResult.passed = deterministicResult.failures.length === 0;
    const score = await scorePrototype(evalCase, code, businessContext, spec, uxPlan);
    if (!compile.ok) score.passed = false;

    const durationMs = Date.now() - start;

    // Print result
    const scoreColor = score.passed ? '\x1b[32m' : '\x1b[31m';
    const reset = '\x1b[0m';
    console.log(`  ${scoreColor}${score.passed ? '✓ PASS' : '✗ FAIL'}${reset} Overall: ${score.overallScore}/10 | ${Math.round(durationMs / 1000)}s`);
    console.log(`  Dimensions: BC=${score.businessContextAccuracy} Spec=${score.specQuality} Visual=${score.visualEnterpriseQuality} Data=${score.dataRealism} Outcome=${score.businessOutcomeClarity}`);
    if (deterministicResult.failures.length > 0) {
      console.log(`  ⚠ Deterministic failures: ${deterministicResult.failures.join('; ')}`);
    }

    return {
      caseId: evalCase.id,
      intent: evalCase.intent,
      score,
      deterministicPassed: deterministicResult.passed,
      deterministicFailures: deterministicResult.failures,
      code,
      approved,
      durationMs,
    };
  } catch (error) {
    const durationMs = Date.now() - start;
    console.log(`  \x1b[31m✗ ERROR\x1b[0m: ${error}`);
    return {
      caseId: evalCase.id,
      intent: evalCase.intent,
      score: {
        businessContextAccuracy: 0, specQuality: 0, visualEnterpriseQuality: 0,
        dataRealism: 0, businessOutcomeClarity: 0, overallScore: 0,
        passed: false,
        justification: { error: String(error) },
      },
      deterministicPassed: false,
      deterministicFailures: [String(error)],
      code: '',
      approved: false,
      durationMs,
    };
  }
}

async function main() {
  const casesToRun = caseFilter
    ? EVAL_CASES.filter(c => c.id === caseFilter)
    : EVAL_CASES;

  if (casesToRun.length === 0) {
    console.error(`No eval case found with id: ${caseFilter}`);
    process.exit(1);
  }

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`PROTASH EVAL — ${casesToRun.length} case(s)`);
  console.log(`${'═'.repeat(60)}`);

  const results: EvalRunResult[] = [];
  for (const evalCase of casesToRun) {
    const result = await runCase(evalCase);
    results.push(result);
  }

  // Summary
  const passed = results.filter(r => r.score.passed).length;
  const avgScore = results.reduce((sum, r) => sum + r.score.overallScore, 0) / results.length;
  const totalDurationS = Math.round(results.reduce((sum, r) => sum + r.durationMs, 0) / 1000);

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`SUMMARY: ${passed}/${results.length} passed | Avg score: ${avgScore.toFixed(1)}/10 | ${totalDurationS}s total`);
  console.log(`${'═'.repeat(60)}\n`);

  // Write JSON results
  if (outputJson || !caseFilter) {
    const now = new Date();
    const timestamp = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}-${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`;
    const outDir = path.join(process.cwd(), 'evals', 'results');
    fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, `${timestamp}.json`);
    fs.writeFileSync(outPath, JSON.stringify({
      timestamp: now.toISOString(),
      summary: { passed, total: results.length, avgScore: Number(avgScore.toFixed(2)), durationSeconds: totalDurationS },
      results: results.map(r => ({
        caseId: r.caseId,
        score: r.score,
        deterministicPassed: r.deterministicPassed,
        deterministicFailures: r.deterministicFailures,
        approved: r.approved,
        durationMs: r.durationMs,
        codeLength: r.code.length,
      })),
    }, null, 2));
    console.log(`Results written to: ${outPath}`);
  }

  process.exit(passed === casesToRun.length ? 0 : 1);
}

main().catch(err => {
  console.error('Fatal eval error:', err);
  process.exit(1);
});
