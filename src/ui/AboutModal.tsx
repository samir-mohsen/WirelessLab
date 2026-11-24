import React, { useState } from 'react';
import { BookOpen, Info, Plus, Trash2, X } from 'lucide-react';
import type { TeamMember } from '../types/simulation';

interface AboutModalProps {
  isOpen: boolean;
  initialTab?: 'about' | 'help';
  onClose: () => void;
  teamMembers: TeamMember[];
  onChangeTeamMembers: (next: TeamMember[]) => void;
}

export const AboutModal: React.FC<AboutModalProps> = ({
  isOpen,
  initialTab = 'about',
  onClose,
  teamMembers,
  onChangeTeamMembers,
}) => {
  const [tab, setTab] = useState<'about' | 'help'>(initialTab);

  if (!isOpen) return null;

  const updateMember = (idx: number, field: keyof TeamMember, val: string) => {
    onChangeTeamMembers(teamMembers.map((m, i) => (i === idx ? { ...m, [field]: val } : m)));
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="About WirelessLab ECE441"
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[1px] flex items-center justify-center p-4"
    >
      <div className="w-full max-w-2xl max-h-[88vh] flex flex-col rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl overflow-hidden">
        <header className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setTab('about')}
              className={`inline-flex items-center gap-1.5 text-xs font-semibold pb-0.5 border-b-2 transition-colors ${
                tab === 'about'
                  ? 'border-blue-600 text-blue-700 dark:text-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Info className="w-3.5 h-3.5" />
              About
            </button>
            <button
              type="button"
              onClick={() => setTab('help')}
              className={`inline-flex items-center gap-1.5 text-xs font-semibold pb-0.5 border-b-2 transition-colors ${
                tab === 'help'
                  ? 'border-blue-600 text-blue-700 dark:text-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              Help &amp; Workflow
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close About dialog"
            className="p-1 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-sm">
          {tab === 'about' ? (
            <>
              <div className="space-y-1.5">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  WirelessLab ECE441
                </h2>
                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                  WirelessLab ECE441 — simulation suite for ECE 441, Delta University for Science and Technology, Faculty of Engineering.
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  100% browser-local Web Worker Monte-Carlo engine · Zero external APIs · Deterministic xoshiro128** sub-seeded trials · Plotly.js &amp; KaTeX.
                </p>
              </div>

              <div className="pt-2 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Project Team Members (saved automatically for reports)
                  </h3>
                  <button
                    type="button"
                    onClick={() =>
                      onChangeTeamMembers([
                        ...teamMembers,
                        { name: 'Team Member', studentId: '441-00X', contribution: 'Simulation & Report' },
                      ])
                    }
                    className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add
                  </button>
                </div>

                <div className="space-y-2">
                  {teamMembers.map((m, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                      <input
                        aria-label={`Team member ${idx + 1} name`}
                        value={m.name}
                        onChange={(e) => updateMember(idx, 'name', e.target.value)}
                        className="col-span-5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1 text-xs"
                      />
                      <input
                        aria-label={`Team member ${idx + 1} ID`}
                        value={m.studentId}
                        onChange={(e) => updateMember(idx, 'studentId', e.target.value)}
                        className="col-span-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1 text-xs font-mono"
                      />
                      <input
                        aria-label={`Team member ${idx + 1} contribution`}
                        value={m.contribution}
                        onChange={(e) => updateMember(idx, 'contribution', e.target.value)}
                        className="col-span-4 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1 text-xs"
                      />
                      <button
                        type="button"
                        disabled={teamMembers.length <= 1}
                        onClick={() =>
                          onChangeTeamMembers(teamMembers.filter((_, i) => i !== idx))
                        }
                        aria-label={`Remove team member ${idx + 1}`}
                        className="col-span-1 p-1 text-slate-400 hover:text-rose-600 disabled:opacity-30"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-3 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Quick Start Guide
              </h3>
              <ol className="list-decimal pl-5 space-y-1.5">
                <li>
                  Select a module from the Home Dashboard and configure physical parameters in the left Parameters panel (hover info icons for definitions).
                </li>
                <li>
                  Click <strong>Run All Experiments</strong> to execute every required figure in parallel Web Workers, or toggle <strong>Quick mode</strong> for rapid parameter exploration.
                </li>
                <li>
                  Click <strong>Self-test</strong> to verify the Monte-Carlo engine against closed-form analytical equations (PASS requires max relative error &le; 15%).
                </li>
                <li>
                  Inspect each Figure tab, toggle <strong>Show data table</strong>, export <strong>PNG</strong> / <strong>CSV</strong>, or save the complete project as JSON.
                </li>
                <li>
                  Launch <strong>Presentation Mode</strong> (Left/Right arrow keys, Esc to exit) for your 20–25 minute oral defense, or click <strong>Export Report</strong> for a printable 12-section HTML/PDF submission.
                </li>
              </ol>
            </div>
          )}
        </div>

        <footer className="flex justify-end px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium rounded-md bg-blue-600 hover:bg-blue-700 text-white"
          >
            Done
          </button>
        </footer>
      </div>
    </div>
  );
};
