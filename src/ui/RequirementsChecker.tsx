import React from 'react';
import { CheckCircle2, Circle } from 'lucide-react';
import type { RequirementCheck } from '../types/simulation';

interface RequirementsCheckerProps {
  requirements: RequirementCheck[];
  hasRun: boolean;
}

const DEFAULT_PENDING_REQS: RequirementCheck[] = [
  { id: 'working_sim', label: 'Working local Monte-Carlo simulation', met: false, detail: 'Not yet executed' },
  { id: 'min_figures', label: '>= 4 result figures generated', met: false, detail: '0 figures generated' },
  { id: 'two_params', label: '>= 2 independent parameters varied', met: false, detail: 'Run experiments to populate sweeps' },
  { id: 'comparison', label: 'Comparison of >= 2 techniques/configs vs baseline', met: false, detail: 'Pending simulation run' },
  { id: 'verification', label: 'Verification against theory / limiting case passed', met: false, detail: 'Run Verification or Self-test' },
  { id: 'reproducibility', label: 'Parameters & seed captured for reproducibility', met: false, detail: 'Pending run metadata' },
];

export const RequirementsChecker: React.FC<RequirementsCheckerProps> = ({
  requirements,
  hasRun,
}) => {
  const list = hasRun && requirements.length > 0 ? requirements : DEFAULT_PENDING_REQS;
  const metCount = list.filter((r) => r.met).length;

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-baseline justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            ECE 441 Course Minimum Requirements
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Option B: Simulation-Based Research Presentation compliance checklist
          </p>
        </div>
        <div className="text-sm font-mono tabular-nums font-semibold text-slate-800 dark:text-slate-200">
          {metCount} / {list.length} met
        </div>
      </div>

      <ul className="divide-y divide-slate-200 dark:divide-slate-800 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        {list.map((req) => (
          <li key={req.id} className="p-3.5 flex items-start gap-3">
            {req.met ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <Circle className="w-5 h-5 text-slate-300 dark:text-slate-600 shrink-0 mt-0.5" />
            )}
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                {req.label}
              </div>
              <div className="text-xs font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                {req.detail}
              </div>
            </div>
            <span
              className={`text-xs font-medium shrink-0 ${
                req.met
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {req.met ? 'Met' : 'Pending'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};
