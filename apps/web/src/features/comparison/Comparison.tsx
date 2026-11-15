import React, { useState } from 'react';
import {
  BarChart2,
  Play,
  Award,
  Zap,
  Layers,
  Trophy,
  CheckCircle,
  AlertTriangle,
  ShieldCheck,
  Check,
  Info,
  Clock,
} from 'lucide-react';
import { ComparisonSummary } from '../../api/types';
import { runComparison } from '../../api/client';

interface ComparisonProps {
  revisionId: string | null;
  problemName: string;
  isDirty?: boolean;
  onCommitRevision?: () => Promise<any>;
}

// Vermilion Edition Accessible Palette for Algorithms
const ALGO_COLORS: Record<string, string> = {
  bfs: '#467B87',     // Deep Slate Teal
  dfs: '#667078',     // Muted Ink
  greedy: '#B7791F',  // Warm Amber
  astar: '#E64B3C',   // Vermilion Primary Accent
};

export const Comparison: React.FC<ComparisonProps> = ({
  revisionId,
  problemName,
  isDirty = false,
  onCommitRevision,
}) => {
  const [isRunning, setIsRunning] = useState(false);
  const [summary, setSummary] = useState<ComparisonSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRunComparison = async () => {
    if (isDirty) {
      alert('Unsaved problem changes detected. Please commit the revision before running the benchmark.');
      return;
    }
    if (!revisionId) {
      alert('Please commit a problem revision in Setup first before running comparison.');
      return;
    }

    try {
      setIsRunning(true);
      setError(null);
      const res = await runComparison(revisionId);
      setSummary(res);
    } catch (err: any) {
      setError(err.message || 'Benchmark comparison failed');
    } finally {
      setIsRunning(false);
    }
  };

  // Compute maximums for bar chart scaling
  const maxComputeMs = summary
    ? Math.max(...summary.trials.map((t) => t.metrics.search_compute_ms), 1)
    : 1;

  const maxNodes = summary
    ? Math.max(...summary.trials.map((t) => Math.max(t.metrics.explored_nodes, t.metrics.generated_nodes)), 1)
    : 1;

  const maxPenalty = summary
    ? Math.max(...summary.trials.map((t) => t.penalty ?? 0), 1)
    : 1;

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-8 font-sans text-[#202426]">
      {/* Header Card (Pure White on Warm Paper) */}
      <div className="bg-white border border-[#E7E2DA] rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4 shadow-card">
        <div>
          <h2 className="font-display font-bold text-xl sm:text-2xl text-[#202426] tracking-tight flex items-center gap-2.5">
            <BarChart2 className="w-5 h-5 text-[#E64B3C]" />
            Empirical Algorithm Comparison
          </h2>
          <p className="text-xs text-[#667078] mt-1.5 leading-relaxed">
            Sequential benchmark execution of BFS, DFS, Greedy Best-First, and A* on <strong className="text-[#202426]">{problemName}</strong>.
          </p>
        </div>

        <button
          onClick={handleRunComparison}
          disabled={isRunning || !revisionId || isDirty}
          title={isDirty ? 'Commit unsaved problem changes first' : 'Run all 4 algorithms sequentially on this problem revision'}
          className={`flex items-center gap-2 px-6 py-3 text-white font-semibold text-xs rounded-xl shadow-xs transition duration-150 ${
            isRunning || !revisionId || isDirty
              ? 'bg-[#FAF8F4] text-[#8A949E] border border-[#E7E2DA] cursor-not-allowed'
              : 'bg-[#E64B3C] hover:bg-[#CC3E31] active:bg-[#B73529] shadow-vermilion cursor-pointer'
          }`}
        >
          {isRunning ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Running Benchmarks...
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-white" />
              Run 4-Algorithm Benchmark
            </>
          )}
        </button>
      </div>

      {/* Dirty Warning Banner with Direct Commit Action */}
      {isDirty && (
        <div className="bg-[#FFF4D8] border border-[#B7791F]/40 text-[#B7791F] p-5 rounded-2xl text-xs flex flex-wrap items-center justify-between gap-4 shadow-subtle">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#B7791F]/20 text-[#B7791F] flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-5 h-5 text-[#B7791F]" />
            </div>
            <div>
              <p className="font-display font-bold text-[#8C5E16] text-xs sm:text-sm">
                Unsaved problem modifications detected
              </p>
              <p className="text-[#8C5E16]/90 text-[11px] mt-0.5 max-w-2xl">
                The 4-algorithm benchmark requires a committed revision to guarantee deterministic, honest evaluation against the displayed problem.
              </p>
            </div>
          </div>
          {onCommitRevision && (
            <button
              onClick={async () => {
                try {
                  await onCommitRevision();
                } catch (e) {
                  console.error(e);
                }
              }}
              className="px-4 py-2 bg-[#B7791F] hover:bg-[#966318] text-white font-semibold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5"
            >
              Commit Revision Now
            </button>
          )}
        </div>
      )}

      {error && (
        <div className="bg-[#FCEAEA] border border-[#C94444]/40 text-[#C94444] p-4 rounded-2xl text-xs flex items-center gap-2.5 shadow-subtle">
          <AlertTriangle className="w-4 h-4 text-[#C94444] flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Recognition Badges */}
      {summary && summary.recognitions && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Fastest */}
          <div className="bg-white border border-[#E7E2DA] p-5 rounded-2xl shadow-card flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-[#EAF3F4] text-[#467B87] flex items-center justify-center flex-shrink-0">
              <Zap className="w-5 h-5 text-[#467B87]" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-[#667078] tracking-wider block">Fastest Successful</span>
              <span className="font-display text-lg font-bold text-[#202426] uppercase">
                {summary.recognitions.fastest_successful || 'None'}
              </span>
            </div>
          </div>

          {/* Fewest Explored */}
          <div className="bg-white border border-[#E7E2DA] p-5 rounded-2xl shadow-card flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-[#FFF4D8] text-[#B7791F] flex items-center justify-center flex-shrink-0">
              <Layers className="w-5 h-5 text-[#B7791F]" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-[#667078] tracking-wider block">Fewest Explored Nodes</span>
              <span className="font-display text-lg font-bold text-[#202426] uppercase">
                {summary.recognitions.fewest_explored || 'None'}
              </span>
            </div>
          </div>

          {/* Lowest Penalty */}
          <div className="bg-white border border-[#E7E2DA] p-5 rounded-2xl shadow-card flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-[#E8F5EE] text-[#168A65] flex items-center justify-center flex-shrink-0">
              <Trophy className="w-5 h-5 text-[#168A65]" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-[#667078] tracking-wider block">Lowest Observed Penalty</span>
              <span className="font-display text-lg font-bold text-[#168A65] uppercase">
                {summary.recognitions.lowest_observed_penalty || 'None'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* SVG Comparative Bar Charts */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Chart 1: Compute Time */}
          <div className="bg-white border border-[#E7E2DA] rounded-2xl p-6 space-y-4 shadow-card">
            <div className="flex items-center justify-between border-b border-[#E7E2DA] pb-3">
              <h4 className="font-display text-xs font-bold text-[#202426] uppercase tracking-wider">Search Compute Time</h4>
              <span className="text-[10px] text-[#667078] font-mono">ms (lower is faster)</span>
            </div>
            <div className="space-y-3 pt-1">
              {summary.trials.map((trial) => {
                const widthPercent = Math.max(4, (trial.metrics.search_compute_ms / maxComputeMs) * 100);
                const color = ALGO_COLORS[trial.algorithm.toLowerCase()] || '#467B87';

                return (
                  <div key={trial.algorithm} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold uppercase text-[#202426]">{trial.algorithm}</span>
                      <span className="font-mono text-[#667078] tabular-nums">{trial.metrics.search_compute_ms.toFixed(2)} ms</span>
                    </div>
                    <div className="w-full bg-[#FAF8F4] border border-[#E7E2DA] rounded-full h-3.5 overflow-hidden p-0.5">
                      <div
                        style={{ width: `${widthPercent}%`, backgroundColor: color }}
                        className="h-full rounded-full transition-all duration-500"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Chart 2: Explored vs Generated Nodes */}
          <div className="bg-white border border-[#E7E2DA] rounded-2xl p-6 space-y-4 shadow-card">
            <div className="flex items-center justify-between border-b border-[#E7E2DA] pb-3">
              <h4 className="font-display text-xs font-bold text-[#202426] uppercase tracking-wider">Explored vs Generated</h4>
              <span className="text-[10px] text-[#667078] font-mono">state nodes</span>
            </div>
            <div className="space-y-3 pt-1">
              {summary.trials.map((trial) => {
                const expPercent = Math.max(4, (trial.metrics.explored_nodes / maxNodes) * 100);
                const genPercent = Math.max(4, (trial.metrics.generated_nodes / maxNodes) * 100);
                const color = ALGO_COLORS[trial.algorithm.toLowerCase()] || '#467B87';

                return (
                  <div key={trial.algorithm} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold uppercase text-[#202426]">{trial.algorithm}</span>
                      <span className="font-mono text-[#667078] tabular-nums">
                        {trial.metrics.explored_nodes} exp / {trial.metrics.generated_nodes} gen
                      </span>
                    </div>
                    <div className="w-full bg-[#FAF8F4] border border-[#E7E2DA] rounded-full h-3.5 overflow-hidden flex gap-0.5 p-0.5">
                      <div
                        style={{ width: `${expPercent}%`, backgroundColor: color }}
                        className="h-full rounded-l-full"
                        title="Explored Nodes"
                      />
                      <div
                        style={{ width: `${Math.max(0, genPercent - expPercent)}%`, backgroundColor: color, opacity: 0.35 }}
                        className="h-full rounded-r-full"
                        title="Generated Nodes"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Chart 3: Preference Penalty */}
          <div className="bg-white border border-[#E7E2DA] rounded-2xl p-6 space-y-4 shadow-card">
            <div className="flex items-center justify-between border-b border-[#E7E2DA] pb-3">
              <h4 className="font-display text-xs font-bold text-[#202426] uppercase tracking-wider">Preference Penalty</h4>
              <span className="text-[10px] text-[#667078] font-mono">0 is ideal</span>
            </div>
            <div className="space-y-3 pt-1">
              {summary.trials.map((trial) => {
                const pen = trial.penalty ?? 0;
                const widthPercent = trial.status === 'SUCCEEDED' ? Math.max(4, (pen / maxPenalty) * 100) : 0;
                const color = ALGO_COLORS[trial.algorithm.toLowerCase()] || '#467B87';

                return (
                  <div key={trial.algorithm} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold uppercase text-[#202426]">{trial.algorithm}</span>
                      <span className="font-mono text-[#667078] tabular-nums">
                        {trial.status === 'SUCCEEDED' ? pen : 'Infeasible/Limit'}
                      </span>
                    </div>
                    <div className="w-full bg-[#FAF8F4] border border-[#E7E2DA] rounded-full h-3.5 overflow-hidden p-0.5">
                      {trial.status === 'SUCCEEDED' ? (
                        <div
                          style={{ width: `${widthPercent}%`, backgroundColor: color }}
                          className="h-full rounded-full transition-all duration-500"
                        />
                      ) : (
                        <div className="h-full bg-[#FCEAEA] text-[9px] text-[#C94444] text-center flex items-center justify-center font-mono">
                          No Schedule Found
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Results Table */}
      {summary && (
        <div className="bg-white border border-[#E7E2DA] rounded-2xl shadow-card overflow-hidden space-y-4 p-6">
          <div className="flex items-center justify-between border-b border-[#E7E2DA] pb-4">
            <div>
              <h3 className="font-display font-bold text-sm text-[#202426]">Sequential Benchmark Results</h3>
              <p className="text-xs text-[#667078] mt-0.5">Exact recorded metrics across identical starting frontiers.</p>
            </div>
            <span className="text-xs text-[#667078] font-mono bg-[#FAF8F4] px-2.5 py-1 rounded-lg border border-[#E7E2DA]">
              Revision: {summary.revision_id.slice(0, 8)}
            </span>
          </div>

          <div className="overflow-x-auto border border-[#E7E2DA] rounded-xl">
            <table className="w-full text-left text-xs border-collapse font-sans">
              <thead>
                <tr className="bg-[#FAF8F4] border-b border-[#E7E2DA] text-[#667078] font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-3.5">Algorithm</th>
                  <th className="py-3 px-3.5">Status</th>
                  <th className="py-3 px-3.5 text-right">Compute Time</th>
                  <th className="py-3 px-3.5 text-right">Explored Nodes</th>
                  <th className="py-3 px-3.5 text-right">Generated Nodes</th>
                  <th className="py-3 px-3.5 text-right">Peak Frontier</th>
                  <th className="py-3 px-3.5 text-right">Penalty</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7E2DA] font-mono text-xs">
                {summary.trials.map((trial) => {
                  return (
                    <tr key={trial.algorithm} className="hover:bg-[#FAF8F4]/80 transition-colors">
                      <td className="py-3.5 px-3.5 font-bold text-[#202426] flex items-center gap-2">
                        <span className="uppercase">{trial.algorithm}</span>
                        {trial.optimality_proven && (
                          <span className="text-[10px] bg-[#FFF0EC] text-[#E64B3C] border border-[#F4C1B8] px-2 py-0.5 rounded-md font-bold font-sans uppercase">
                            Optimal
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-3.5 font-sans">
                        <span
                          className={`px-2.5 py-1 rounded-md text-[10px] font-semibold ${
                            trial.status === 'SUCCEEDED'
                              ? 'bg-[#E8F5EE] text-[#168A65] border border-[#168A65]/30'
                              : trial.status === 'INFEASIBLE'
                              ? 'bg-[#FCEAEA] text-[#C94444] border border-[#C94444]/30'
                              : 'bg-[#FFF4D8] text-[#B7791F] border border-[#B7791F]/30'
                          }`}
                        >
                          {trial.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-3.5 text-right text-[#168A65] font-semibold tabular-nums">
                        {trial.metrics.search_compute_ms.toFixed(2)} ms
                      </td>
                      <td className="py-3.5 px-3.5 text-right text-[#202426] tabular-nums">
                        {trial.metrics.explored_nodes.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-3.5 text-right text-[#202426] tabular-nums">
                        {trial.metrics.generated_nodes.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-3.5 text-right text-[#467B87] tabular-nums">
                        {trial.metrics.peak_frontier_size.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-3.5 text-right font-bold text-[#E64B3C] tabular-nums">
                        {trial.penalty !== null && trial.penalty !== undefined ? trial.penalty : 'N/A'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Scientific Methodology Disclosure */}
          <div className="bg-[#FAF8F4] p-4 rounded-xl border border-[#E7E2DA] text-[11px] text-[#667078] space-y-1.5">
            <span className="font-semibold text-[#202426] block">Methodology & Academic Honesty Disclosure:</span>
            <p className="leading-relaxed">
              {summary.method}. Each algorithm receives the exact same deterministic course ordering (decreasing conflict-graph degree, decreasing enrollment, course ID) and identical candidate slot/room domains.
              Timing measures pure solver compute advancement using monotonic clock intervals. Visualization pacing is disabled during benchmarks.
            </p>
          </div>
        </div>
      )}

      {!summary && (
        <div className="bg-white border border-[#E7E2DA] rounded-2xl p-14 text-center text-[#667078] text-xs space-y-3 shadow-card">
          <div className="w-12 h-12 rounded-2xl bg-[#FFF0EC] text-[#E64B3C] flex items-center justify-center mx-auto">
            <BarChart2 className="w-6 h-6" />
          </div>
          <p className="font-display font-bold text-sm text-[#202426]">No comparison benchmark run yet.</p>
          <p className="text-[#667078] max-w-md mx-auto leading-relaxed">
            Click "Run 4-Algorithm Benchmark" above to sequentially evaluate BFS, DFS, Greedy, and A* on the active problem snapshot.
          </p>
        </div>
      )}
    </div>
  );
};
