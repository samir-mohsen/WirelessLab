import React from 'react';
import type { ModuleTheoryContent } from '../types/simulation';
import { MathBlock } from './MathBlock';

interface TheoryViewProps {
  moduleTitle: string;
  content: ModuleTheoryContent;
}

export const TheoryView: React.FC<TheoryViewProps> = ({ moduleTitle, content }) => {
  return (
    <div className="max-w-4xl space-y-6 pb-8">
      <header className="border-b border-slate-200 dark:border-slate-800 pb-4">
        <p className="text-xs font-mono text-slate-500 dark:text-slate-400">
          ECE 441 · Technical Background &amp; System Model
        </p>
        <h2 className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">
          {moduleTitle}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          {content.abstract}
        </p>
      </header>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          1. Objectives
        </h3>
        <ul className="list-disc pl-5 space-y-1.5 text-sm text-slate-700 dark:text-slate-300">
          {content.objectives.map((obj, idx) => (
            <li key={idx}>{obj}</li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          2. Technical Background
        </h3>
        {content.technicalBackground.map((para, idx) => (
          <p key={idx} className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
            {para}
          </p>
        ))}
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          3. System Model &amp; Governing Equations
        </h3>
        <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
          {content.systemModelSummary}
        </p>
        <div className="space-y-3">
          {content.equations.map((eq, idx) => (
            <div
              key={idx}
              className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 p-4"
            >
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-2">
                ({idx + 1}) {eq.title}
              </div>
              <MathBlock latex={eq.latex} display />
              <p className="mt-2 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                {eq.explanation}
              </p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            4. Simulation Methodology
          </h3>
          <ul className="list-disc pl-5 space-y-1.5 text-sm text-slate-700 dark:text-slate-300">
            {content.methodology.map((m, idx) => (
              <li key={idx}>{m}</li>
            ))}
          </ul>
        </section>

        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            5. Modeling Assumptions
          </h3>
          <ul className="list-disc pl-5 space-y-1.5 text-sm text-slate-700 dark:text-slate-300">
            {content.assumptions.map((a, idx) => (
              <li key={idx}>{a}</li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
};
