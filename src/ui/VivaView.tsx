import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Eye,
  EyeOff,
  ExternalLink,
  GraduationCap,
  RotateCcw,
  XCircle,
} from 'lucide-react';
import { getVivaQuestions } from '../engine/vivaBank';
import type { ModuleId, ModuleResultBundle } from '../types/simulation';

interface VivaViewProps {
  moduleId: ModuleId;
  results: ModuleResultBundle | null;
  onJumpToFigure: (figureId: string) => void;
}

export const VivaView: React.FC<VivaViewProps> = ({
  moduleId,
  results,
  onJumpToFigure,
}) => {
  const questions = useMemo(() => getVivaQuestions(moduleId, results), [moduleId, results]);
  const [quizMode, setQuizMode] = useState(false);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [grades, setGrades] = useState<Record<string, 'correct' | 'review'>>({});

  const answeredCount = Object.keys(grades).length;
  const correctCount = Object.values(grades).filter((v) => v === 'correct').length;

  const resetQuiz = () => {
    setRevealed({});
    setGrades({});
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <GraduationCap className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Examiner Q&amp;A — Oral Discussion Prep ({questions.length} Questions)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Model answers automatically reference your computed simulation results and link to supporting figures.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {quizMode && (
            <div className="px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono text-xs text-slate-700 dark:text-slate-200">
              Score: {correctCount} / {questions.length} ({answeredCount} graded)
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              setQuizMode((q) => !q);
              setRevealed({});
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold border transition-colors ${
              quizMode
                ? 'bg-blue-600 text-white border-blue-600'
                : 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            {quizMode ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {quizMode ? 'Quiz Mode: ON' : 'Start Quiz Mode'}
          </button>

          {quizMode && answeredCount > 0 && (
            <button
              type="button"
              onClick={resetQuiz}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Score
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {questions.map((q, idx) => {
          const isShown = !quizMode || Boolean(revealed[q.id]);
          const grade = grades[q.id];
          const figExists = Boolean(
            q.figureId && results?.figures.some((f) => f.id === q.figureId),
          );

          return (
            <div
              key={q.id}
              className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-2.5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 leading-snug">
                  <span className="font-mono text-blue-600 dark:text-blue-400 mr-2">
                    Q{idx + 1}.
                  </span>
                  {q.question}
                </div>

                {q.figureId && q.figureLabel && (
                  <button
                    type="button"
                    disabled={!figExists}
                    onClick={() => onJumpToFigure(q.figureId!)}
                    title={
                      figExists
                        ? `Jump to ${q.figureLabel}`
                        : 'Run simulation first to view this figure'
                    }
                    className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 text-[11px] font-mono text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 disabled:opacity-40 shrink-0"
                  >
                    <ExternalLink className="w-3 h-3" />
                    {q.figureLabel}
                  </button>
                )}
              </div>

              {isShown ? (
                <div className="space-y-2.5">
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-950/70 border border-slate-200/80 dark:border-slate-800 rounded p-3">
                    {q.answer}
                  </p>
                  {quizMode && (
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-500">Self-grade:</span>
                      <button
                        type="button"
                        onClick={() => setGrades((g) => ({ ...g, [q.id]: 'correct' }))}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium border ${
                          grade === 'correct'
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                        }`}
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        Got it
                      </button>
                      <button
                        type="button"
                        onClick={() => setGrades((g) => ({ ...g, [q.id]: 'review' }))}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium border ${
                          grade === 'review'
                            ? 'bg-amber-600 text-white border-amber-600'
                            : 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-amber-50 dark:hover:bg-amber-950/30'
                        }`}
                      >
                        <XCircle className="w-3 h-3" />
                        Needs Review
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setRevealed((r) => ({ ...r, [q.id]: true }))}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-blue-300 dark:border-blue-800 bg-blue-50/70 dark:bg-blue-950/40 text-xs font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50"
                >
                  <Eye className="w-3.5 h-3.5" />
                  Reveal Model Answer
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
