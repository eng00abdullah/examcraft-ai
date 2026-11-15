import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Play,
  Pause,
  SkipForward,
  RotateCcw,
  Square,
  Cpu,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Layers,
  Table,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Info,
  AlertCircle,
  Save,
  ArrowRight,
  Sliders,
} from 'lucide-react';
import {
  ProblemDocument,
  RunConfig,
  SearchEvent,
  MetricsSnapshot,
  RunRecord,
} from '../../api/types';
import { startRun, sendControl, getRun, API_BASE } from '../../api/client';

interface SearchLabProps {
  problem: ProblemDocument;
  revisionId: string | null;
  problemHash: string | null;
  isDirty: boolean;
  onCommitRevision: () => Promise<any>;
  onTimetableReady: (runRecord: RunRecord) => void;
  onOpenTimetable: () => void;
}

export interface VisualNode {
  id: string;
  parentId: string | null;
  kind: 'queued' | 'exploring' | 'explored' | 'rejected' | 'forward_pruned' | 'solution';
  depth: number;
  courseId?: string | null;
  slotId?: string | null;
  roomId?: string | null;
  g?: number | null;
  h?: number | null;
  f?: number | null;
  isReconstructed?: boolean;
  rejectionCode?: string | null;
  rejectionReason?: string | null;
  assignments?: Array<{ course_id: string; slot_id: string; room_id: string }>;
  sequence?: number;
}

export const SearchLab: React.FC<SearchLabProps> = ({
  problem,
  revisionId,
  problemHash,
  isDirty,
  onCommitRevision,
  onTimetableReady,
  onOpenTimetable,
}) => {
  const [algorithm, setAlgorithm] = useState<'bfs' | 'dfs' | 'greedy' | 'astar'>('astar');
  const [heuristicMode, setHeuristicMode] = useState<'admissible' | 'zero'>('admissible');
  const [speedMs, setSpeedMs] = useState<number>(100);

  const [activeRunId, setActiveRunId] = useState<string | null>(() => {
    return localStorage.getItem('examcraft_active_run_id') || sessionStorage.getItem('examcraft_active_run_id');
  });
  const [runStatus, setRunStatus] = useState<string>('IDLE');
  const [terminalReason, setTerminalReason] = useState<string | null>(null);
  const [optimalityProven, setOptimalityProven] = useState<boolean>(false);
  const [isCommitting, setIsCommitting] = useState<boolean>(false);

  // Exact metrics
  const [metrics, setMetrics] = useState<MetricsSnapshot>({
    generated_nodes: 0,
    explored_nodes: 0,
    expanded_nodes: 0,
    candidate_actions: 0,
    valid_actions: 0,
    invalid_actions: 0,
    forward_pruned_actions: 0,
    enqueued_actions: 0,
    budget_blocked_actions: 0,
    frontier_size: 0,
    peak_frontier_size: 0,
    max_depth: 0,
    search_compute_ms: 0,
    preprocessing_ms: 0,
    final_validation_ms: 0,
    run_wall_ms: 0,
  });

  // Visual graph nodes (bounded representation)
  const [visualNodes, setVisualNodes] = useState<VisualNode[]>([]);
  const [selectedNode, setSelectedNode] = useState<VisualNode | null>(null);
  const [eventLog, setEventLog] = useState<SearchEvent[]>([]);
  const [goalNodeId, setGoalNodeId] = useState<string | null>(null);

  // Pan and Zoom
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [startPan, setStartPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const eventSourceRef = useRef<EventSource | null>(null);
  const eventLogEndRef = useRef<HTMLDivElement | null>(null);
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);
  const processedSequencesRef = useRef<Set<number>>(new Set());

  // Save active run ID
  useEffect(() => {
    if (activeRunId) {
      localStorage.setItem('examcraft_active_run_id', activeRunId);
      sessionStorage.setItem('examcraft_active_run_id', activeRunId);
    }
  }, [activeRunId]);

  // Clean up SSE on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  // Reconstruct solution tree for restored completed runs without fabricating g/h/f metrics
  const reconstructTreeFromAssignments = useCallback(
    (assignments: Array<{ course_id: string; slot_id: string; room_id: string }>) => {
      const nodes: VisualNode[] = [
        {
          id: 'root',
          parentId: null,
          kind: 'exploring',
          depth: 0,
          assignments: [],
          sequence: 0,
          isReconstructed: true,
        },
      ];

      let prevId = 'root';
      assignments.forEach((a, idx) => {
        const isLast = idx === assignments.length - 1;
        const nodeId = `sol_step_${idx + 1}`;
        nodes.push({
          id: nodeId,
          parentId: prevId,
          kind: isLast ? 'solution' : 'exploring',
          depth: idx + 1,
          courseId: a.course_id,
          slotId: a.slot_id,
          roomId: a.room_id,
          assignments: assignments.slice(0, idx + 1),
          sequence: idx + 1,
          isReconstructed: true,
        });
        prevId = nodeId;
      });

      setVisualNodes(nodes);
      setGoalNodeId(prevId);
      setSelectedNode(nodes[nodes.length - 1]);
    },
    []
  );

  // Process search event logic with sequence deduplication
  const handleIncomingEvent = useCallback(
    (event: SearchEvent, runId: string) => {
      if (event.sequence !== undefined && event.sequence !== null) {
        if (processedSequencesRef.current.has(event.sequence)) {
          return;
        }
        processedSequencesRef.current.add(event.sequence);
      }

      if (event.metrics) {
        setMetrics(event.metrics);
      }

      setEventLog((prev) => {
        const updated = [...prev, event];
        return updated.slice(-250);
      });

      if (event.kind === 'run_started' && event.node_id) {
        setVisualNodes([
          {
            id: event.node_id,
            parentId: null,
            kind: 'exploring',
            depth: 0,
            g: event.g ?? 0,
            h: event.h ?? 0,
            f: event.f ?? 0,
            assignments: [],
            sequence: event.sequence,
          },
        ]);
        setGoalNodeId(null);
      } else if (event.kind === 'node_popped' && event.node_id) {
        setVisualNodes((prev) => {
          const existingIdx = prev.findIndex((n) => n.id === event.node_id);
          if (existingIdx >= 0) {
            const copy = [...prev];
            copy[existingIdx].kind = 'exploring';
            copy[existingIdx].assignments = event.assignments || copy[existingIdx].assignments;
            return copy;
          } else {
            return [
              ...prev.slice(-400),
              {
                id: event.node_id!,
                parentId: event.parent_id || null,
                kind: 'exploring',
                depth: event.depth ?? 0,
                courseId: event.course_id,
                slotId: event.slot_id,
                roomId: event.room_id,
                g: event.g,
                h: event.h,
                f: event.f,
                assignments: event.assignments || [],
                sequence: event.sequence,
              },
            ];
          }
        });
      } else if (event.kind === 'child_enqueued' && event.node_id) {
        setVisualNodes((prev) => {
          if (prev.some((n) => n.id === event.node_id)) return prev;
          return [
            ...prev.slice(-400),
            {
              id: event.node_id!,
              parentId: event.parent_id || null,
              kind: 'queued',
              depth: event.depth ?? 0,
              courseId: event.course_id,
              slotId: event.slot_id,
              roomId: event.room_id,
              g: event.g,
              h: event.h,
              f: event.f,
              sequence: event.sequence,
            },
          ];
        });
      } else if (event.kind === 'action_rejected') {
        const rejId = `rej_${event.sequence}_${event.course_id || 'act'}`;
        setVisualNodes((prev) => [
          ...prev.slice(-400),
          {
            id: rejId,
            parentId: event.parent_id || null,
            kind: 'rejected',
            depth: event.depth ?? 0,
            courseId: event.course_id,
            slotId: event.slot_id,
            roomId: event.room_id,
            rejectionCode: event.rejection_code,
            rejectionReason: event.rejection_reason,
            sequence: event.sequence,
          },
        ]);
      } else if (event.kind === 'forward_pruned') {
        const prId = `pr_${event.sequence}_${event.course_id || 'act'}`;
        setVisualNodes((prev) => [
          ...prev.slice(-400),
          {
            id: prId,
            parentId: event.parent_id || null,
            kind: 'forward_pruned',
            depth: event.depth ?? 0,
            courseId: event.course_id,
            slotId: event.slot_id,
            roomId: event.room_id,
            rejectionCode: event.rejection_code || 'LOOKAHEAD',
            rejectionReason: event.rejection_reason || 'Forward check: future domain wipeout',
            sequence: event.sequence,
          },
        ]);
      } else if (event.kind === 'goal_found' && event.node_id) {
        setGoalNodeId(event.node_id);
        setVisualNodes((prev) => {
          const idx = prev.findIndex((n) => n.id === event.node_id);
          if (idx >= 0) {
            const copy = [...prev];
            copy[idx].kind = 'solution';
            copy[idx].assignments = event.assignments || copy[idx].assignments;
            return copy;
          }
          return prev;
        });
      } else if (event.kind === 'run_finished') {
        setRunStatus(event.status || 'FINISHED');
        setTerminalReason(event.rejection_reason || null);

        if (eventSourceRef.current) {
          eventSourceRef.current.close();
          eventSourceRef.current = null;
        }

        getRun(runId)
          .then((rec) => {
            setOptimalityProven(rec.optimality_proven);
            if (rec.metrics) {
              setMetrics(rec.metrics);
            }
            if (rec.status === 'SUCCEEDED') {
              onTimetableReady(rec);
            }
          })
          .catch((err) => console.error('Error fetching final run record:', err));
      }
    },
    [onTimetableReady]
  );

  // Connect SSE with robust event dispatching
  const connectSSE = useCallback(
    (runId: string) => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      const es = new EventSource(`${API_BASE}/runs/${runId}/events`);
      eventSourceRef.current = es;

      const eventTypes = [
        'run_started',
        'node_popped',
        'child_enqueued',
        'action_rejected',
        'forward_pruned',
        'goal_found',
        'run_finished',
      ];

      eventTypes.forEach((type) => {
        es.addEventListener(type, (e: MessageEvent) => {
          try {
            const data: SearchEvent = JSON.parse(e.data);
            handleIncomingEvent(data, runId);
          } catch (err) {
            console.error(`Error parsing SSE event ${type}:`, err);
          }
        });
      });

      es.onmessage = (e) => {
        try {
          const data: SearchEvent = JSON.parse(e.data);
          handleIncomingEvent(data, runId);
        } catch (err) {
          console.error('Error parsing generic SSE message:', err);
        }
      };

      es.onerror = () => {
        getRun(runId)
          .then((rec) => {
            setRunStatus(rec.status);
            setOptimalityProven(rec.optimality_proven);
            if (rec.metrics) setMetrics(rec.metrics);
            if (rec.status === 'SUCCEEDED' || rec.status === 'INFEASIBLE' || rec.status === 'LIMIT_REACHED') {
              es.close();
            }
          })
          .catch(() => {});
      };
    },
    [handleIncomingEvent]
  );

  // Restore active run on page reload
  useEffect(() => {
    const savedRunId = localStorage.getItem('examcraft_active_run_id');
    if (!savedRunId) return;

    getRun(savedRunId)
      .then((rec) => {
        setActiveRunId(rec.run_id);
        setRunStatus(rec.status);
        setOptimalityProven(rec.optimality_proven);
        if (rec.metrics) {
          setMetrics(rec.metrics);
        }

        if (rec.status === 'SUCCEEDED') {
          onTimetableReady(rec);
          if (rec.assignments) {
            reconstructTreeFromAssignments(rec.assignments);
          }
        } else if (rec.status === 'PAUSED' || rec.status === 'RUNNING') {
          connectSSE(rec.run_id);
        } else if (rec.assignments && rec.assignments.length > 0) {
          reconstructTreeFromAssignments(rec.assignments);
        }
      })
      .catch((err) => {
        console.warn(`Could not restore run ${savedRunId} on refresh:`, err);
        localStorage.removeItem('examcraft_active_run_id');
        sessionStorage.removeItem('examcraft_active_run_id');
        setActiveRunId(null);
        setRunStatus('IDLE');
      });
  }, []);

  // Auto-scroll event log
  useEffect(() => {
    eventLogEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [eventLog]);

  // Handle Commit when dirty
  const handleCommitNow = async () => {
    try {
      setIsCommitting(true);
      await onCommitRevision();
    } catch (err: any) {
      alert(`Commit revision failed: ${err.message}`);
    } finally {
      setIsCommitting(false);
    }
  };

  // Handle Start Search with strict dirty validation
  const handleStartSearch = async () => {
    if (isDirty) {
      alert(
        'Execution Blocked: Problem data has unsaved modifications. Please commit your revision first so the solver schedules your actual changes.'
      );
      return;
    }

    if (!revisionId) {
      alert('Please commit problem revision in Setup first.');
      return;
    }

    try {
      setRunStatus('RUNNING');
      setTerminalReason(null);
      setVisualNodes([]);
      setSelectedNode(null);
      setEventLog([]);
      setGoalNodeId(null);
      setPan({ x: 0, y: 0 });
      setZoom(1);
      processedSequencesRef.current.clear();

      const runConfig: RunConfig = {
        algorithm,
        heuristic: heuristicMode,
        limits: {
          max_expanded_nodes: 10000,
          max_generated_nodes: 50000,
          max_frontier_nodes: 25000,
          max_search_seconds: 10.0,
          max_wall_seconds: 300.0,
        },
        teaching_speed_ms: speedMs,
      };

      const startRes = await startRun(revisionId, runConfig);

      if (problemHash && startRes.problem_hash !== problemHash) {
        console.warn('Warning: Server problem hash differs from expected committed revision hash.');
      }

      const newRunId = startRes.run_id;
      setActiveRunId(newRunId);
      connectSSE(newRunId);
    } catch (err: any) {
      alert(`Start search failed: ${err.message}`);
      setRunStatus('ERROR');
    }
  };

  // Execution controls
  const handlePause = async () => {
    if (!activeRunId) return;
    try {
      await sendControl(activeRunId, 'pause');
      setRunStatus('PAUSED');
    } catch (err) {
      console.error(err);
    }
  };

  const handleResume = async () => {
    if (!activeRunId) return;
    try {
      await sendControl(activeRunId, 'resume');
      setRunStatus('RUNNING');
    } catch (err) {
      console.error(err);
    }
  };

  const handleStep = async () => {
    if (!activeRunId) return;
    try {
      await sendControl(activeRunId, 'step');
    } catch (err) {
      console.error(err);
    }
  };

  const handleReset = async () => {
    if (!activeRunId) return;
    try {
      const res = await sendControl(activeRunId, 'reset');
      setRunStatus('RUNNING');
      setVisualNodes([]);
      setEventLog([]);
      setSelectedNode(null);
      setGoalNodeId(null);
      setPan({ x: 0, y: 0 });
      setZoom(1);
      processedSequencesRef.current.clear();

      const newRunId = res.run_id || res.message.split(' ').pop() || activeRunId;
      setActiveRunId(newRunId);
      connectSSE(newRunId);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCancel = async () => {
    if (!activeRunId) return;
    try {
      await sendControl(activeRunId, 'cancel');
      setRunStatus('CANCELLED');
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSpeedChange = async (ms: number) => {
    setSpeedMs(ms);
    if (activeRunId && (runStatus === 'RUNNING' || runStatus === 'PAUSED')) {
      try {
        await sendControl(activeRunId, 'speed', ms);
      } catch (err) {
        console.error(err);
      }
    }
  };

  // Compute Tree Layout (Levels by Depth)
  const treeLayout = useMemo(() => {
    if (visualNodes.length === 0) return { nodes: [], edges: [], width: 800, height: 600 };

    const levels: Record<number, VisualNode[]> = {};
    visualNodes.forEach((node) => {
      const d = node.depth ?? 0;
      if (!levels[d]) levels[d] = [];
      levels[d].push(node);
    });

    const levelKeys = Object.keys(levels).map(Number).sort((a, b) => a - b);
    const maxNodesInLevel = Math.max(...Object.values(levels).map((l) => l.length), 1);

    const nodeSpacingX = Math.max(120, Math.min(220, 1600 / maxNodesInLevel));
    const nodeSpacingY = 110;
    const canvasWidth = Math.max(900, maxNodesInLevel * nodeSpacingX + 120);
    const canvasHeight = Math.max(550, levelKeys.length * nodeSpacingY + 140);

    const posMap = new Map<string, { x: number; y: number; node: VisualNode }>();

    levelKeys.forEach((d) => {
      const nodeList = levels[d];
      const count = nodeList.length;
      const startX = (canvasWidth - count * nodeSpacingX) / 2 + nodeSpacingX / 2;

      nodeList.forEach((node, idx) => {
        const x = startX + idx * nodeSpacingX;
        const y = 60 + d * nodeSpacingY;
        posMap.set(node.id, { x, y, node });
      });
    });

    const edges: Array<{ from: { x: number; y: number }; to: { x: number; y: number }; isSolution: boolean; id: string }> = [];

    const solutionPathSet = new Set<string>();
    const targetNodeId = goalNodeId || selectedNode?.id;
    if (targetNodeId) {
      let cur: string | null = targetNodeId;
      while (cur) {
        solutionPathSet.add(cur);
        const item = posMap.get(cur);
        cur = item ? item.node.parentId : null;
      }
    }

    posMap.forEach(({ x, y, node }) => {
      if (node.parentId && posMap.has(node.parentId)) {
        const parentPos = posMap.get(node.parentId)!;
        const isSolution = solutionPathSet.has(node.id) && solutionPathSet.has(node.parentId);
        edges.push({
          from: { x: parentPos.x, y: parentPos.y },
          to: { x, y },
          isSolution,
          id: `${node.parentId}->${node.id}`,
        });
      }
    });

    const positionedNodes = Array.from(posMap.values()).map((p) => ({
      ...p,
      isSolutionPath: solutionPathSet.has(p.node.id),
    }));

    return { nodes: positionedNodes, edges, width: canvasWidth, height: canvasHeight };
  }, [visualNodes, goalNodeId, selectedNode]);

  // Pan Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsPanning(true);
    setStartPan({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    setPan({ x: e.clientX - startPan.x, y: e.clientY - startPan.y });
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 space-y-6 font-sans text-[#F5F2EC]">
      {/* Revision Dirty Warning Banner */}
      {isDirty && (
        <div className="bg-[#1E2224] border border-[#B7791F] rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4 text-xs shadow-xl">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#B7791F]/20 text-[#B7791F] flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-5 h-5 text-[#B7791F]" />
            </div>
            <div>
              <span className="font-display font-bold text-sm text-[#FFF4D8] block">
                Unsaved problem modifications detected
              </span>
              <p className="text-[#B9BEBC] mt-0.5 max-w-2xl">
                Your current configuration contains uncommitted changes. You must commit your revision before running a search so the solver evaluates your exact changes.
              </p>
            </div>
          </div>
          <button
            onClick={handleCommitNow}
            disabled={isCommitting}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#B7791F] hover:bg-[#966318] text-white font-semibold rounded-xl shadow-xs transition"
          >
            <Save className="w-4 h-4" />
            {isCommitting ? 'Committing...' : 'Commit Revision & Ready Search'}
          </button>
        </div>
      )}

      {/* Search Header & Toolbar */}
      <div className="bg-[#1E2224] border border-[#373C3E] rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4 shadow-xl">
        {/* Left: Engine Config */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 pr-2 border-r border-[#373C3E]">
            <span className="w-2.5 h-2.5 rounded-full bg-[#E64B3C] animate-pulse"></span>
            <span className="font-display font-bold text-sm text-white tracking-tight">Search Lab</span>
          </div>

          {/* Algorithm Selector */}
          <div className="flex items-center gap-1.5 bg-[#17191A] px-3 py-1.5 rounded-xl border border-[#373C3E] text-xs">
            <span className="text-[#B9BEBC] font-medium">Algorithm:</span>
            <select
              value={algorithm}
              onChange={(e) => setAlgorithm(e.target.value as any)}
              disabled={runStatus === 'RUNNING' || runStatus === 'PAUSED'}
              className="bg-transparent text-white font-semibold focus:outline-none cursor-pointer uppercase"
            >
              <option value="astar" className="bg-[#1E2224] text-white">A* Search</option>
              <option value="greedy" className="bg-[#1E2224] text-white">Greedy Best-First</option>
              <option value="bfs" className="bg-[#1E2224] text-white">BFS (Breadth-First)</option>
              <option value="dfs" className="bg-[#1E2224] text-white">DFS (Depth-First)</option>
            </select>
          </div>

          {/* Heuristic Selector */}
          <div className="flex items-center gap-1.5 bg-[#17191A] px-3 py-1.5 rounded-xl border border-[#373C3E] text-xs">
            <span className="text-[#B9BEBC] font-medium">Heuristic:</span>
            <select
              value={heuristicMode}
              onChange={(e) => setHeuristicMode(e.target.value as any)}
              disabled={runStatus === 'RUNNING' || runStatus === 'PAUSED'}
              className="bg-transparent text-white font-semibold focus:outline-none cursor-pointer"
            >
              <option value="admissible" className="bg-[#1E2224] text-white">Admissible Lower Bound (h)</option>
              <option value="zero" className="bg-[#1E2224] text-white">h = 0 (Uniform Cost Baseline)</option>
            </select>
          </div>

          {/* Speed Selector */}
          <div className="flex items-center gap-1.5 bg-[#17191A] px-3 py-1.5 rounded-xl border border-[#373C3E] text-xs">
            <span className="text-[#B9BEBC] font-medium">Speed:</span>
            <select
              value={speedMs}
              onChange={(e) => handleSpeedChange(Number(e.target.value))}
              className="bg-transparent text-white font-semibold focus:outline-none cursor-pointer"
            >
              <option value={0} className="bg-[#1E2224] text-white">Instant (0ms)</option>
              <option value={50} className="bg-[#1E2224] text-white">Fast (50ms)</option>
              <option value={100} className="bg-[#1E2224] text-white">Normal (100ms)</option>
              <option value={250} className="bg-[#1E2224] text-white">Teaching (250ms)</option>
              <option value={500} className="bg-[#1E2224] text-white">Slow (500ms)</option>
            </select>
          </div>
        </div>

        {/* Right: Execution Control Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {runStatus !== 'RUNNING' && runStatus !== 'PAUSED' ? (
            <button
              onClick={handleStartSearch}
              disabled={isDirty}
              className={`flex items-center gap-2 px-5 py-2 text-white text-xs font-semibold rounded-xl shadow-xs transition duration-150 ${
                isDirty
                  ? 'bg-[#292D2F] text-[#7A8082] cursor-not-allowed border border-[#373C3E]'
                  : 'bg-[#E64B3C] hover:bg-[#CC3E31] active:bg-[#B73529] shadow-vermilion cursor-pointer'
              }`}
              title={isDirty ? 'Please commit revision before running search' : 'Start search'}
            >
              <Play className="w-3.5 h-3.5 fill-white" /> Start Search
            </button>
          ) : runStatus === 'RUNNING' ? (
            <button
              onClick={handlePause}
              className="flex items-center gap-2 px-5 py-2 bg-[#B7791F] hover:bg-[#966318] text-white text-xs font-semibold rounded-xl shadow-xs transition duration-150"
            >
              <Pause className="w-3.5 h-3.5 fill-white" /> Pause
            </button>
          ) : (
            <>
              <button
                onClick={handleResume}
                className="flex items-center gap-2 px-4 py-2 bg-[#168A65] hover:bg-[#126B4E] text-white text-xs font-semibold rounded-xl shadow-xs transition duration-150"
              >
                <Play className="w-3.5 h-3.5 fill-white" /> Resume
              </button>
              <button
                onClick={handleStep}
                className="flex items-center gap-2 px-4 py-2 bg-[#1E2224] hover:bg-[#292D2F] text-[#F5F2EC] text-xs font-semibold rounded-xl border border-[#373C3E] transition duration-150"
                title="Advance exactly one engine transition"
              >
                <SkipForward className="w-3.5 h-3.5" /> Step Forward
              </button>
            </>
          )}

          <button
            onClick={handleReset}
            disabled={!activeRunId}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#17191A] hover:bg-[#292D2F] text-[#B9BEBC] hover:text-white text-xs font-medium rounded-xl border border-[#373C3E] disabled:opacity-50 transition"
            title="Reset solver run"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </button>

          <button
            onClick={handleCancel}
            disabled={runStatus !== 'RUNNING' && runStatus !== 'PAUSED'}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#C94444]/20 hover:bg-[#C94444]/30 text-[#C94444] text-xs font-medium rounded-xl border border-[#C94444]/30 disabled:opacity-40 transition"
          >
            <Square className="w-3.5 h-3.5 fill-[#C94444]" /> Cancel
          </button>
        </div>
      </div>

      {/* Outcome Banners */}
      {runStatus === 'SUCCEEDED' && (
        <div className="bg-[#1E2224] border border-[#168A65] rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4 shadow-xl">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-[#168A65]/20 text-[#168A65] flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-6 h-6 text-[#168A65]" />
            </div>
            <div>
              <h3 className="font-display font-bold text-sm text-white flex items-center gap-2">
                Validated Timetable Found!
                {optimalityProven && (
                  <span className="text-[10px] bg-[#E64B3C]/20 text-[#E64B3C] border border-[#E64B3C]/40 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider">
                    Optimality Proven
                  </span>
                )}
              </h3>
              <p className="text-xs text-[#B9BEBC] mt-0.5">
                Independent complete-schedule validation passed. Zero hard constraint violations.
              </p>
            </div>
          </div>
          <button
            onClick={async () => {
              if (activeRunId) {
                try {
                  const rec = await getRun(activeRunId);
                  onTimetableReady(rec);
                } catch (e) {
                  console.error(e);
                }
              }
              onOpenTimetable();
            }}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#168A65] hover:bg-[#126B4E] text-white text-xs font-bold rounded-xl shadow-md transition"
          >
            <Table className="w-4 h-4" /> Open Timetable Dashboard
          </button>
        </div>
      )}

      {runStatus === 'INFEASIBLE' && (
        <div className="bg-[#1E2224] border border-[#C94444] rounded-2xl p-5 flex items-center gap-3.5 shadow-xl">
          <div className="w-10 h-10 rounded-xl bg-[#C94444]/20 text-[#C94444] flex items-center justify-center flex-shrink-0">
            <XCircle className="w-6 h-6 text-[#C94444]" />
          </div>
          <div>
            <h3 className="font-display font-bold text-sm text-white">No Feasible Timetable Exists</h3>
            <p className="text-xs text-[#B9BEBC] mt-0.5">
              The complete state space was exhaustively searched or proven impossible by preflight. {terminalReason}
            </p>
          </div>
        </div>
      )}

      {runStatus === 'LIMIT_REACHED' && (
        <div className="bg-[#1E2224] border border-[#B7791F] rounded-2xl p-5 flex items-center gap-3.5 shadow-xl">
          <div className="w-10 h-10 rounded-xl bg-[#B7791F]/20 text-[#B7791F] flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-6 h-6 text-[#B7791F]" />
          </div>
          <div>
            <h3 className="font-display font-bold text-sm text-white">Search Resource Limit Reached</h3>
            <p className="text-xs text-[#B9BEBC] mt-0.5">
              Search reached a configured resource cap ({terminalReason}). Feasibility of remaining search space is unknown.
            </p>
          </div>
        </div>
      )}

      {/* Centerpiece: Real Search Tree Graph + State Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Graph Canvas (Span 2) */}
        <div className="lg:col-span-2 bg-[#1E2224] border border-[#373C3E] rounded-2xl p-5 flex flex-col h-[580px] shadow-xl">
          {/* Canvas Top Bar */}
          <div className="flex items-center justify-between pb-3.5 border-b border-[#373C3E]">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-[#E64B3C]" />
              <h3 className="font-display font-bold text-xs text-white uppercase tracking-wider">
                {visualNodes.some((n) => n.isReconstructed)
                  ? 'Reconstructed Solution Path'
                  : 'Search Tree State Space Canvas'}
              </h3>
              <span className="text-[11px] text-[#B9BEBC] hidden sm:inline">
                {visualNodes.some((n) => n.isReconstructed)
                  ? '(Assignments Restored · Historical Node Evaluations N/A)'
                  : `(Showing ${treeLayout.nodes.length} nodes · Exact global metrics in panel below)`}
              </span>
            </div>

            {/* Canvas Viewport Controls */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setZoom((z) => Math.min(2.5, z + 0.2))}
                className="p-1.5 bg-[#17191A] hover:bg-[#292D2F] rounded-lg text-[#B9BEBC] hover:text-white border border-[#373C3E] transition"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setZoom((z) => Math.max(0.4, z - 0.2))}
                className="p-1.5 bg-[#17191A] hover:bg-[#292D2F] rounded-lg text-[#B9BEBC] hover:text-white border border-[#373C3E] transition"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => {
                  setZoom(1);
                  setPan({ x: 0, y: 0 });
                }}
                className="p-1.5 bg-[#17191A] hover:bg-[#292D2F] rounded-lg text-[#B9BEBC] hover:text-white border border-[#373C3E] transition"
                title="Reset View"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Interactive Zoomable Tree Canvas with Precision Grid Backdrop */}
          <div
            ref={canvasContainerRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            className={`flex-1 relative overflow-hidden bg-[#17191A] bg-grid-graphite rounded-xl select-none cursor-${
              isPanning ? 'grabbing' : 'grab'
            }`}
          >
            {visualNodes.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-[#7E8482] text-xs">
                <Cpu className="w-10 h-10 mb-2 opacity-30 text-[#E64B3C] animate-pulse" />
                <span>Search tree is idle. Click "Start Search" above to explore state space.</span>
              </div>
            ) : (
              <div
                style={{
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                  transformOrigin: '0 0',
                  width: `${treeLayout.width}px`,
                  height: `${treeLayout.height}px`,
                  position: 'absolute',
                  transition: isPanning ? 'none' : 'transform 0.05s ease-out',
                }}
              >
                {/* SVG Connections Layer */}
                <svg
                  className="absolute inset-0 pointer-events-none"
                  width={treeLayout.width}
                  height={treeLayout.height}
                >
                  {treeLayout.edges.map((edge) => (
                    <path
                      key={edge.id}
                      d={`M ${edge.from.x} ${edge.from.y} C ${edge.from.x} ${(edge.from.y + edge.to.y) / 2}, ${
                        edge.to.x
                      } ${(edge.from.y + edge.to.y) / 2}, ${edge.to.x} ${edge.to.y}`}
                      fill="none"
                      stroke={edge.isSolution ? '#168A65' : '#373C3E'}
                      strokeWidth={edge.isSolution ? 3 : 1.5}
                      strokeDasharray={edge.isSolution ? undefined : '3,3'}
                      className={edge.isSolution ? 'filter drop-shadow-[0_0_8px_rgba(22,138,101,0.6)]' : ''}
                    />
                  ))}
                </svg>

                {/* Nodes Layer */}
                {treeLayout.nodes.map(({ x, y, node, isSolutionPath }) => {
                  const isSelected = selectedNode?.id === node.id;
                  let borderClass = 'border-[#373C3E] bg-[#1E2224] text-[#B9BEBC]';
                  let pulseClass = '';

                  if (node.kind === 'exploring') {
                    borderClass = 'border-[#E64B3C] bg-[#1E2224] text-white ring-2 ring-[#E64B3C]';
                    pulseClass = 'animate-pulse';
                  } else if (node.kind === 'solution') {
                    borderClass = 'border-[#168A65] bg-[#17191A] text-[#E8F5EE] ring-2 ring-[#168A65] font-bold';
                  } else if (node.kind === 'rejected') {
                    borderClass = 'border-[#C94444] bg-[#1E2224] text-[#C94444]';
                  } else if (node.kind === 'forward_pruned') {
                    borderClass = 'border-[#B7791F] bg-[#1E2224] text-[#B7791F]';
                  }

                  if (isSolutionPath && node.kind !== 'solution') {
                    borderClass += ' ring-2 ring-[#168A65]/70';
                  }

                  return (
                    <div
                      key={node.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedNode(node);
                      }}
                      style={{
                        position: 'absolute',
                        left: `${x}px`,
                        top: `${y}px`,
                        transform: 'translate(-50%, -50%)',
                      }}
                      className={`cursor-pointer rounded-xl px-3 py-1.5 border text-xs flex flex-col items-center justify-center min-w-[84px] max-w-[130px] shadow-md transition-all ${borderClass} ${pulseClass} ${
                        isSelected ? 'scale-110 z-30 ring-2 ring-[#E64B3C]' : 'hover:scale-105 z-10'
                      }`}
                    >
                      <div className="flex items-center gap-1 font-mono font-bold text-[11px] truncate w-full justify-center">
                        {node.kind === 'solution' && <CheckCircle2 className="w-3.5 h-3.5 text-[#168A65]" />}
                        {node.kind === 'rejected' && <XCircle className="w-3.5 h-3.5 text-[#C94444]" />}
                        <span className="truncate">{node.courseId || node.id.slice(0, 8)}</span>
                      </div>

                      {node.slotId && node.roomId && (
                        <div className="text-[10px] text-[#B9BEBC] font-mono truncate w-full text-center">
                          {node.slotId}@{node.roomId}
                        </div>
                      )}

                      {node.isReconstructed ? (
                        <div className="text-[9px] text-[#B7791F] font-mono italic">
                          Path Step (g/h/f: N/A)
                        </div>
                      ) : (
                        node.f !== undefined && (
                          <div className="text-[9px] text-[#B9BEBC] font-mono tabular-nums">
                            g:{node.g ?? 0} h:{node.h ?? 0} f:{node.f}
                          </div>
                        )
                      )}

                      {node.rejectionCode && (
                        <span className="text-[8px] bg-[#C94444]/20 text-[#C94444] px-1.5 py-0.2 rounded font-semibold uppercase tracking-wider mt-0.5">
                          {node.rejectionCode}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Canvas Bottom Legend */}
          <div className="pt-3 flex flex-wrap items-center justify-between text-[11px] text-[#B9BEBC] border-t border-[#373C3E] mt-3">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#E64B3C]"></span> Exploring
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#373C3E]"></span> Queued
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#C94444]"></span> Rejected
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#B7791F]"></span> Pruned
              </span>
              <span className="flex items-center gap-1.5 text-[#168A65] font-semibold">
                <span className="w-2.5 h-2.5 rounded-full bg-[#168A65]"></span> Solution Path
              </span>
            </div>
            <span className="text-[10px] text-[#7E8482]">Click node to inspect telemetry.</span>
          </div>
        </div>

        {/* Node Inspector Panel (Span 1) */}
        <div className="bg-[#1E2224] border border-[#373C3E] rounded-2xl p-5 flex flex-col h-[580px] space-y-4 shadow-xl">
          <div className="border-b border-[#373C3E] pb-3 flex items-center justify-between">
            <h3 className="font-display font-bold text-xs text-white uppercase tracking-wider flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-[#E64B3C]" /> Node & State Inspector
            </h3>
            {selectedNode && (
              <span className="text-[10px] font-mono text-[#E64B3C] bg-[#FFF0EC]/10 px-2 py-0.5 rounded border border-[#E64B3C]/30 font-semibold">
                Depth {selectedNode.depth}
              </span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 text-xs">
            {!selectedNode ? (
              <div className="h-full flex flex-col items-center justify-center text-[#7E8482] text-center p-4">
                <Info className="w-8 h-8 mb-2 opacity-30 text-[#E64B3C]" />
                <span>Select any node on the tree to inspect its partial timetable, costs (g, h, f), and rejection diagnostics.</span>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Node Metadata Card */}
                <div className="bg-[#17191A] p-3.5 rounded-xl border border-[#373C3E] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[#B9BEBC] text-[11px]">Node Identifier:</span>
                    <span className="font-mono font-bold text-white">{selectedNode.id}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#B9BEBC] text-[11px]">Classification:</span>
                    <span className="font-semibold text-[#E64B3C] uppercase text-[11px]">{selectedNode.kind}</span>
                  </div>
                  {selectedNode.parentId && (
                    <div className="flex items-center justify-between">
                      <span className="text-[#B9BEBC] text-[11px]">Parent Node ID:</span>
                      <span className="font-mono text-[#B9BEBC] text-[11px]">{selectedNode.parentId}</span>
                    </div>
                  )}
                </div>

                {/* Transition Action */}
                {selectedNode.courseId && (
                  <div className="bg-[#17191A] p-3.5 rounded-xl border border-[#373C3E] space-y-2">
                    <span className="text-[11px] font-bold text-[#F5F2EC] block">Candidate Transition Action:</span>
                    <div className="grid grid-cols-3 gap-1.5 text-center font-mono">
                      <div className="bg-[#1E2224] p-2 rounded-lg border border-[#373C3E]">
                        <span className="text-[10px] text-[#B9BEBC] block">Course</span>
                        <span className="font-bold text-[#E64B3C]">{selectedNode.courseId}</span>
                      </div>
                      <div className="bg-[#1E2224] p-2 rounded-lg border border-[#373C3E]">
                        <span className="text-[10px] text-[#B9BEBC] block">Slot</span>
                        <span className="font-bold text-white">{selectedNode.slotId}</span>
                      </div>
                      <div className="bg-[#1E2224] p-2 rounded-lg border border-[#373C3E]">
                        <span className="text-[10px] text-[#B9BEBC] block">Room</span>
                        <span className="font-bold text-white">{selectedNode.roomId}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Evaluation Costs (g, h, f) */}
                <div className="bg-[#17191A] p-3.5 rounded-xl border border-[#373C3E] space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[#F5F2EC] block">Evaluation Functions:</span>
                    {selectedNode.isReconstructed && (
                      <span className="text-[10px] text-[#B7791F] font-mono bg-[#B7791F]/15 px-2 py-0.5 rounded border border-[#B7791F]/30 font-medium">
                        Historical metrics N/A
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center font-mono">
                    <div className="bg-[#1E2224] p-2 rounded-lg border border-[#373C3E]">
                      <span className="text-[10px] text-[#B9BEBC] block">g (Penalty)</span>
                      <span className="text-sm font-bold text-[#B7791F] tabular-nums">
                        {selectedNode.isReconstructed || selectedNode.g === undefined ? 'N/A' : selectedNode.g}
                      </span>
                    </div>
                    <div className="bg-[#1E2224] p-2 rounded-lg border border-[#373C3E]">
                      <span className="text-[10px] text-[#B9BEBC] block">h (Heuristic)</span>
                      <span className="text-sm font-bold text-[#467B87] tabular-nums">
                        {selectedNode.isReconstructed || selectedNode.h === undefined ? 'N/A' : selectedNode.h}
                      </span>
                    </div>
                    <div className="bg-[#1E2224] p-2 rounded-lg border border-[#373C3E]">
                      <span className="text-[10px] text-[#B9BEBC] block">f (g + h)</span>
                      <span className="text-sm font-bold text-[#168A65] tabular-nums">
                        {selectedNode.isReconstructed || selectedNode.f === undefined ? 'N/A' : selectedNode.f}
                      </span>
                    </div>
                  </div>
                  {selectedNode.isReconstructed && (
                    <p className="text-[10px] text-[#B9BEBC] italic leading-tight">
                      Solution path reconstructed from saved timetable assignments. Intermediate evaluation functions (g, h, f) were not recorded in the database record.
                    </p>
                  )}
                </div>

                {/* Rejection / Pruning Explanation */}
                {(selectedNode.rejectionCode || selectedNode.rejectionReason) && (
                  <div className="bg-[#C94444]/15 border border-[#C94444]/40 p-3.5 rounded-xl space-y-1">
                    <span className="text-[10px] uppercase font-bold text-[#C94444] tracking-wider flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 text-[#C94444]" /> Rejection Diagnostics:
                    </span>
                    <span className="text-xs font-mono font-bold text-white block">
                      Code: {selectedNode.rejectionCode}
                    </span>
                    <p className="text-xs text-[#FCEAEA]">{selectedNode.rejectionReason}</p>
                  </div>
                )}

                {/* Partial Timetable Assignments */}
                {selectedNode.assignments && selectedNode.assignments.length > 0 && (
                  <div className="bg-[#17191A] p-3.5 rounded-xl border border-[#373C3E] space-y-2">
                    <span className="text-[11px] font-bold text-[#F5F2EC] block">
                      Scheduled Assignments ({selectedNode.assignments.length}):
                    </span>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto font-mono text-[11px] pr-1">
                      {selectedNode.assignments.map((a, i) => (
                        <div key={i} className="flex items-center justify-between bg-[#1E2224] p-2 rounded-lg border border-[#373C3E]">
                          <span className="text-[#E64B3C] font-bold">{a.course_id}</span>
                          <span className="text-[#B9BEBC]">
                            Slot: <strong className="text-white">{a.slot_id}</strong> · Room:{' '}
                            <strong className="text-white">{a.room_id}</strong>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Global Exact Aggregate Counters */}
      <div className="bg-[#1E2224] border border-[#373C3E] rounded-2xl p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between border-b border-[#373C3E] pb-3.5">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#E64B3C]" />
            <h3 className="font-display font-bold text-xs text-white uppercase tracking-wider">
              Exact Search & Solver Performance Metrics
            </h3>
          </div>
          <span className="text-xs text-[#B9BEBC] font-mono">
            Status: <strong className="text-white">{runStatus}</strong>
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 font-mono">
          <div className="bg-[#17191A] p-3 rounded-xl border border-[#373C3E]">
            <span className="text-[#B9BEBC] text-[10px] block">Compute Time</span>
            <span className="text-sm font-bold text-[#168A65] tabular-nums">{metrics.search_compute_ms.toFixed(1)} ms</span>
          </div>
          <div className="bg-[#17191A] p-3 rounded-xl border border-[#373C3E]">
            <span className="text-[#B9BEBC] text-[10px] block">Wall Clock</span>
            <span className="text-sm font-bold text-white tabular-nums">{metrics.run_wall_ms.toFixed(1)} ms</span>
          </div>
          <div className="bg-[#17191A] p-3 rounded-xl border border-[#373C3E]">
            <span className="text-[#B9BEBC] text-[10px] block">Explored Nodes</span>
            <span className="text-sm font-bold text-white tabular-nums">{metrics.explored_nodes}</span>
          </div>
          <div className="bg-[#17191A] p-3 rounded-xl border border-[#373C3E]">
            <span className="text-[#B9BEBC] text-[10px] block">Generated Nodes</span>
            <span className="text-sm font-bold text-white tabular-nums">{metrics.generated_nodes}</span>
          </div>
          <div className="bg-[#17191A] p-3 rounded-xl border border-[#373C3E]">
            <span className="text-[#B9BEBC] text-[10px] block">Frontier Size</span>
            <span className="text-sm font-bold text-[#B7791F] tabular-nums">{metrics.frontier_size}</span>
          </div>
          <div className="bg-[#17191A] p-3 rounded-xl border border-[#373C3E]">
            <span className="text-[#B9BEBC] text-[10px] block">Peak Frontier</span>
            <span className="text-sm font-bold text-[#B7791F] tabular-nums">{metrics.peak_frontier_size}</span>
          </div>
          <div className="bg-[#17191A] p-3 rounded-xl border border-[#373C3E]">
            <span className="text-[#B9BEBC] text-[10px] block">Valid Actions</span>
            <span className="text-sm font-bold text-[#168A65] tabular-nums">{metrics.valid_actions}</span>
          </div>
          <div className="bg-[#17191A] p-3 rounded-xl border border-[#373C3E]">
            <span className="text-[#B9BEBC] text-[10px] block">Invalid Actions</span>
            <span className="text-sm font-bold text-[#C94444] tabular-nums">{metrics.invalid_actions}</span>
          </div>
        </div>
      </div>

      {/* Live Event Stream Terminal */}
      <div className="bg-[#1E2224] border border-[#373C3E] rounded-2xl p-5 space-y-3 shadow-xl">
        <div className="flex items-center justify-between pb-2.5 border-b border-[#373C3E]">
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-[#E64B3C]" />
            <h4 className="font-display font-bold text-xs text-white uppercase tracking-wider">Live SSE Transition Feed</h4>
          </div>
          <span className="text-[10px] text-[#B9BEBC] font-mono">Stream Log ({eventLog.length} events)</span>
        </div>
        <div className="bg-[#17191A] font-mono text-[11px] p-3.5 rounded-xl h-36 overflow-y-auto space-y-1 text-[#B9BEBC] border border-[#373C3E]">
          {eventLog.map((ev, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-[#7E8482]">[{ev.sequence}]</span>
              <span
                className={`font-bold ${
                  ev.kind === 'goal_found'
                    ? 'text-[#168A65]'
                    : ev.kind === 'action_rejected'
                    ? 'text-[#C94444]'
                    : ev.kind === 'forward_pruned'
                    ? 'text-[#B7791F]'
                    : ev.kind === 'node_popped'
                    ? 'text-white'
                    : 'text-[#B9BEBC]'
                }`}
              >
                {ev.kind}
              </span>
              <span className="text-[#B9BEBC]">
                {ev.course_id ? `${ev.course_id} @ ${ev.slot_id || ''} ${ev.room_id || ''}` : ev.rejection_reason || ev.status || ''}
              </span>
            </div>
          ))}
          <div ref={eventLogEndRef} />
        </div>
      </div>
    </div>
  );
};
