import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw, X } from 'lucide-react';
import type { FigureSpec } from '../types/simulation';
import { PlotlyChart } from './PlotlyChart';

interface PresentationModeProps {
  moduleTitle: string;
  figures: FigureSpec[];
  onClose: () => void;
}

export const PresentationMode: React.FC<PresentationModeProps> = ({
  moduleTitle,
  figures,
  onClose,
}) => {
  const [slideIdx, setSlideIdx] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [timerRunning, setTimerRunning] = useState(true);

  useEffect(() => {
    if (!timerRunning) return;
    const id = window.setInterval(() => {
      setElapsedSec((s) => s + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [timerRunning]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault();
        setSlideIdx((i) => Math.min(figures.length - 1, i + 1));
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        setSlideIdx((i) => Math.max(0, i - 1));
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [figures.length, onClose]);

  const fig = figures[slideIdx];
  const mins = Math.floor(elapsedSec / 60);
  const secs = elapsedSec % 60;
  const formattedTime = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  // Target talk duration: 20-25 minutes
  const timerTone =
    mins >= 25
      ? 'text-rose-700'
      : mins >= 20
        ? 'text-amber-700'
        : 'text-slate-900';

  if (!fig) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Presentation Mode"
      className="fixed inset-0 z-50 bg-white text-slate-900 flex flex-col"
    >
      {/* Top Presentation Header (clean light theme) */}
      <header className="flex items-center justify-between gap-4 px-6 py-3.5 border-b border-slate-200 bg-slate-50 shrink-0">
        <div className="min-w-0">
          <div className="text-xs font-mono text-slate-500">
            ECE 441 — Wireless &amp; Mobile Communications · Delta University
          </div>
          <h1 className="text-lg font-semibold text-slate-900 truncate">{moduleTitle}</h1>
        </div>

        <div className="flex items-center gap-5 shrink-0">
          {/* 20-25 min Talk Timer */}
          <div className="flex items-center gap-2 border border-slate-200 bg-white rounded-md px-3 py-1.5">
            <span className="text-xs text-slate-500">Talk Timer (20–25m)</span>
            <span className={`font-mono tabular-nums text-base font-semibold ${timerTone}`}>
              {formattedTime}
            </span>
            <button
              type="button"
              onClick={() => setTimerRunning((r) => !r)}
              aria-label={timerRunning ? 'Pause timer' : 'Resume timer'}
              className="p-1 text-slate-600 hover:text-slate-900"
            >
              {timerRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={() => setElapsedSec(0)}
              aria-label="Reset timer"
              className="p-1 text-slate-600 hover:text-slate-900"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          <span className="font-mono tabular-nums text-sm font-medium text-slate-600">
            Slide {slideIdx + 1} / {figures.length}
          </span>

          <button
            type="button"
            onClick={onClose}
            aria-label="Exit Presentation Mode"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-300 bg-white hover:bg-slate-100 text-xs font-medium text-slate-800"
          >
            <X className="w-4 h-4" />
            Exit (Esc)
          </button>
        </div>
      </header>

      {/* Main Slide Body */}
      <main className="flex-1 overflow-y-auto px-8 py-6 flex flex-col gap-5 max-w-[1440px] w-full mx-auto">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">{fig.title}</h2>
          {fig.subtitle && <p className="text-sm text-slate-600 mt-1">{fig.subtitle}</p>}
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-3 overflow-hidden">
          <PlotlyChart figure={fig} isDark={false} presentation />
        </div>

        <section className="rounded-lg border border-slate-200 bg-slate-50 p-5">
          <h3 className="text-sm font-semibold text-slate-800 mb-2">
            Key Engineering Findings
          </h3>
          <ul className="space-y-2 text-base leading-relaxed text-slate-800 list-disc pl-6">
            {fig.keyFindings.map((finding, idx) => (
              <li key={idx}>{finding}</li>
            ))}
          </ul>
        </section>
      </main>

      {/* Bottom Navigation Bar */}
      <footer className="flex items-center justify-between px-8 py-3 border-t border-slate-200 bg-slate-50 shrink-0">
        <button
          type="button"
          disabled={slideIdx === 0}
          onClick={() => setSlideIdx((i) => Math.max(0, i - 1))}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md border border-slate-300 bg-white text-sm font-medium text-slate-800 hover:bg-slate-100 disabled:opacity-40"
        >
          <ChevronLeft className="w-4 h-4" />
          Previous
        </button>

        <div className="flex items-center gap-2">
          {figures.map((f, idx) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setSlideIdx(idx)}
              aria-label={`Go to slide ${idx + 1}: ${f.shortTitle}`}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap ${
                idx === slideIdx
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              {idx + 1}
            </button>
          ))}
        </div>

        <button
          type="button"
          disabled={slideIdx === figures.length - 1}
          onClick={() => setSlideIdx((i) => Math.min(figures.length - 1, i + 1))}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-sm font-medium text-white disabled:opacity-40"
        >
          Next
          <ChevronRight className="w-4 h-4" />
        </button>
      </footer>
    </div>
  );
};
