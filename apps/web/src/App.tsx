import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Navbar } from './components/Navbar';
import { Overview } from './features/overview/Overview';
import { Setup } from './features/setup/Setup';
import { SearchLab } from './features/search/SearchLab';
import { TimetableDashboard } from './features/timetable/TimetableDashboard';
import { Comparison } from './features/comparison/Comparison';
import { ProblemDocument, RunRecord } from './api/types';
import { TINY_FEASIBLE, DEMO_SMALL } from './features/samples/sampleData';
import { saveProblemRevision, getRun } from './api/client';

const STORAGE_KEY_PROBLEM = 'examcraft_active_problem';
const STORAGE_KEY_REVISION = 'examcraft_committed_revision';
const STORAGE_KEY_RUN_ID = 'examcraft_active_run_id';
const STORAGE_KEY_TAB = 'examcraft_active_tab';

interface CommittedRevisionInfo {
  id: string;
  hash: string;
  snapshot: string;
}

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<'overview' | 'setup' | 'lab' | 'timetable' | 'compare'>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_TAB);
      if (stored && ['overview', 'setup', 'lab', 'timetable', 'compare'].includes(stored)) {
        return stored as any;
      }
    } catch (e) {
      console.warn('Failed to parse stored tab:', e);
    }
    return 'overview';
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_TAB, currentTab);
    } catch (e) {
      console.warn('Failed to persist tab to localStorage:', e);
    }
  }, [currentTab]);

  // Hydrate problem from storage or default
  const [problem, setProblem] = useState<ProblemDocument>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_PROBLEM);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Failed to parse stored problem:', e);
    }
    return TINY_FEASIBLE;
  });

  // Hydrate committed revision from storage
  const [committedRevision, setCommittedRevision] = useState<CommittedRevisionInfo | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_REVISION);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Failed to parse stored revision:', e);
    }
    return null;
  });

  const [activeRunRecord, setActiveRunRecord] = useState<RunRecord | null>(null);

  // Stale async response guard
  const saveTokenRef = useRef<number>(0);

  // Centralized dirty tracking
  const isDirty = useMemo(() => {
    if (!committedRevision) return true;
    try {
      return JSON.stringify(problem) !== committedRevision.snapshot;
    } catch (e) {
      return true;
    }
  }, [problem, committedRevision]);

  // Persist problem to localStorage on changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_PROBLEM, JSON.stringify(problem));
    } catch (e) {
      console.warn('Failed to persist problem to localStorage:', e);
    }
  }, [problem]);

  // Persist revision to localStorage on changes
  useEffect(() => {
    if (committedRevision) {
      try {
        localStorage.setItem(STORAGE_KEY_REVISION, JSON.stringify(committedRevision));
      } catch (e) {
        console.warn('Failed to persist revision to localStorage:', e);
      }
    }
  }, [committedRevision]);

  // Centralized commit function with stale-response protection
  const handleCommitRevision = async (probToSave?: ProblemDocument): Promise<any> => {
    const targetProblem = probToSave || problem;
    const currentToken = ++saveTokenRef.current;
    try {
      const res = await saveProblemRevision(targetProblem, false);
      if (currentToken === saveTokenRef.current) {
        const revInfo: CommittedRevisionInfo = {
          id: res.revision_id,
          hash: res.problem_hash,
          snapshot: JSON.stringify(targetProblem),
        };
        setCommittedRevision(revInfo);
        if (probToSave) {
          setProblem(probToSave);
        }
        return res;
      }
    } catch (err) {
      console.error('Failed to commit revision:', err);
      throw err;
    }
  };

  // Initial commit if none exists
  useEffect(() => {
    if (!committedRevision) {
      handleCommitRevision(problem).catch((err) => {
        console.warn('Initial problem auto-commit failed:', err);
      });
    }
  }, []);

  // Restore active run record from localStorage on reload
  useEffect(() => {
    const storedRunId = localStorage.getItem(STORAGE_KEY_RUN_ID);
    if (storedRunId) {
      getRun(storedRunId)
        .then((record) => {
          setActiveRunRecord(record);
        })
        .catch((err) => {
          console.warn('Failed to restore active run record:', err);
          if (err?.message?.includes('404')) {
            localStorage.removeItem(STORAGE_KEY_RUN_ID);
          }
        });
    }
  }, []);

  const handleLoadSample = async (sampleKey: 'tiny_feasible' | 'demo_small') => {
    const sample = sampleKey === 'tiny_feasible' ? TINY_FEASIBLE : DEMO_SMALL;
    const cloned = JSON.parse(JSON.stringify(sample));
    setProblem(cloned);
    try {
      await handleCommitRevision(cloned);
    } catch (err) {
      console.error(err);
    }
    setCurrentTab('setup');
  };

  const handleTimetableReady = React.useCallback((record: RunRecord) => {
    setActiveRunRecord(record);
    try {
      localStorage.setItem(STORAGE_KEY_RUN_ID, record.run_id);
    } catch (e) {
      console.warn('Failed to persist run_id:', e);
    }
  }, []);

  const isDarkTab = currentTab === 'overview' || currentTab === 'lab';

  return (
    <div className={`min-h-screen flex flex-col font-sans transition-colors duration-200 ${isDarkTab ? 'bg-[#17191A] text-[#F5F2EC]' : 'bg-[#F5F2EC] text-[#202426]'}`}>
      <Navbar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        activeProblemName={problem.name}
        revisionId={committedRevision?.id || null}
        isDirty={isDirty}
        hasSchedule={activeRunRecord !== null && activeRunRecord.assignments !== null}
      />

      <main className="flex-1">
        <div className={currentTab === 'overview' ? 'block' : 'hidden'}>
          <Overview
            onStartScheduling={() => setCurrentTab('setup')}
            onLoadSample={handleLoadSample}
          />
        </div>

        <div className={currentTab === 'setup' ? 'block' : 'hidden'}>
          <Setup
            problem={problem}
            setProblem={setProblem}
            revisionId={committedRevision?.id || null}
            problemHash={committedRevision?.hash || null}
            isDirty={isDirty}
            onCommitRevision={handleCommitRevision}
            onProceedToLab={() => setCurrentTab('lab')}
          />
        </div>

        <div className={currentTab === 'lab' ? 'block' : 'hidden'}>
          <SearchLab
            problem={problem}
            revisionId={committedRevision?.id || null}
            problemHash={committedRevision?.hash || null}
            isDirty={isDirty}
            onCommitRevision={handleCommitRevision}
            onTimetableReady={handleTimetableReady}
            onOpenTimetable={() => setCurrentTab('timetable')}
          />
        </div>

        <div className={currentTab === 'timetable' ? 'block' : 'hidden'}>
          <TimetableDashboard runRecord={activeRunRecord} />
        </div>

        <div className={currentTab === 'compare' ? 'block' : 'hidden'}>
          <Comparison
            revisionId={committedRevision?.id || null}
            problemName={problem.name}
            isDirty={isDirty}
            onCommitRevision={handleCommitRevision}
          />
        </div>
      </main>
    </div>
  );
};
