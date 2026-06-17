export interface PublicMetrics {
  success: boolean;
  portfolio: {
    total_jobs_processed: number;
    total_matches_found: number;
    total_runs_completed: number;
    sources_indexed: number;
    licensed_sponsors: number;
  };
  efficiency: {
    tokens_consumed: number;
    api_cost_usd: number;
    token_reduction_ratio: number;
    llm_evaluations_avoided: number;
    matches_per_100_jobs: number;
  };
  system_health: {
    uptime_30d: string;
    last_run_at: string;
  };
}

export async function fetchPublicMetrics(): Promise<PublicMetrics | null> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_JOBSCOUT_API_URL || 'https://jobscout-web-973476355791.europe-west1.run.app';
    const res = await fetch(`${baseUrl}/api/v1/public/metrics`, {
      next: { revalidate: 3600 } // Cache for 1 hour
    });
    if (!res.ok) return null;
    return res.json();
  } catch (e) {
    console.error('Failed to fetch public metrics:', e);
    return null;
  }
}
