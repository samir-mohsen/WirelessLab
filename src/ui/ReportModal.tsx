import React, { useState } from 'react';
import {
  Archive,
  Download,
  FileDown,
  FileText,
  Presentation,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';
import { generateAutoDiscussion } from '../engine/autoDiscussion';
import { generateSubmissionBundleBlob } from '../export/bundleExporter';
import { generateDocxBlob } from '../export/docxExporter';
import { generateReportPdfBlob } from '../export/pdfExporter';
import { generatePptxBlob } from '../export/pptxExporter';
import { slugifyFilename } from '../export/types';
import { generatePrintableReportHtml } from '../report/reportGenerator';
import { downloadBlobFile, downloadTextFile } from '../store/projectStore';
import type {
  ModuleDescriptor,
  ModuleResultBundle,
  ModuleTheoryContent,
  TeamMember,
} from '../types/simulation';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportTitle: string;
  modulesToExport: Array<{
    descriptor: ModuleDescriptor;
    theory: ModuleTheoryContent;
    results: ModuleResultBundle;
    params?: Record<string, unknown>;
  }>;
  teamMembers: TeamMember[];
  onChangeTeamMembers: (next: TeamMember[]) => void;
  references: string[];
  onChangeReferences: (next: string[]) => void;
  discussionText: string;
  onChangeDiscussionText: (next: string) => void;
}

export const ReportModal: React.FC<ReportModalProps> = ({
  isOpen,
  onClose,
  reportTitle,
  modulesToExport,
  teamMembers,
  onChangeTeamMembers,
  references,
  onChangeReferences,
  discussionText,
  onChangeDiscussionText,
}) => {
  const [dateStr, setDateStr] = useState(() => new Date().toISOString().slice(0, 10));
  const [conclusionsText, setConclusionsText] = useState('');
  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const buildCombinedDraft = React.useCallback(() => {
    const drafts = modulesToExport.map((m) => {
      const d = generateAutoDiscussion(m.descriptor.id, m.results);
      return {
        title: `Module ${m.descriptor.number}: ${m.descriptor.shortTitle}`,
        ...d,
      };
    });
    if (drafts.length === 1) {
      return { discussion: drafts[0].discussion, conclusions: drafts[0].conclusions };
    }
    return {
      discussion: drafts.map((d) => `=== ${d.title} ===\n${d.discussion}`).join('\n\n'),
      conclusions: drafts.map((d) => `=== ${d.title} ===\n${d.conclusions}`).join('\n\n'),
    };
  }, [modulesToExport]);

  React.useEffect(() => {
    if (isOpen && modulesToExport.length > 0) {
      const draft = buildCombinedDraft();
      if (!discussionText.trim()) {
        onChangeDiscussionText(draft.discussion);
      }
      if (!conclusionsText.trim()) {
        setConclusionsText(draft.conclusions);
      }
    }
  }, [isOpen, modulesToExport.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRegenerateDraft = () => {
    if (modulesToExport.length === 0) return;
    const draft = buildCombinedDraft();
    onChangeDiscussionText(draft.discussion);
    setConclusionsText(draft.conclusions);
    setStatusMsg('Draft Discussion & Conclusions regenerated from current computed results.');
  };

  if (!isOpen) return null;

  const updateMember = (idx: number, field: keyof TeamMember, val: string) => {
    const next = teamMembers.map((m, i) => (i === idx ? { ...m, [field]: val } : m));
    onChangeTeamMembers(next);
  };

  const addMember = () => {
    onChangeTeamMembers([
      ...teamMembers,
      { name: 'New Student', studentId: '441-00X', contribution: 'Simulation & analysis' },
    ]);
  };

  const removeMember = (idx: number) => {
    if (teamMembers.length <= 1) return;
    onChangeTeamMembers(teamMembers.filter((_, i) => i !== idx));
  };

  const handleGenerate = async (mode: 'download' | 'pdf' | 'pptx' | 'docx' | 'bundle') => {
    if (modulesToExport.length === 0) return;
    setBusy(true);
    setStatusMsg('Preparing high-DPI figures via Plotly.toImage...');
    try {
      const slug = slugifyFilename(reportTitle, 48);
      const commonOpts = {
        reportTitle,
        dateStr,
        teamMembers,
        references,
        discussionText,
        conclusionsText,
        modules: modulesToExport,
        onProgress: (msg: string) => setStatusMsg(msg),
      };

      if (mode === 'pptx') {
        const blob = await generatePptxBlob(commonOpts);
        downloadBlobFile(`${slug}_ece441_slides.pptx`, blob);
        setStatusMsg(`PowerPoint (.pptx) downloaded (${Math.round(blob.size / 1024)} KB) with dark cover, 2-column diagnostics & speaker notes.`);
      } else if (mode === 'docx') {
        const blob = await generateDocxBlob(commonOpts);
        downloadBlobFile(`${slug}_ece441_report.docx`, blob);
        setStatusMsg(`Word (.docx) 12-section technical report downloaded (${Math.round(blob.size / 1024)} KB).`);
      } else if (mode === 'pdf') {
        const blob = await generateReportPdfBlob(commonOpts);
        downloadBlobFile(`${slug}_ece441_report.pdf`, blob);
        setStatusMsg(`PDF (.pdf) technical report downloaded directly (${Math.round(blob.size / 1024)} KB).`);
      } else if (mode === 'bundle') {
        const { filename, blob } = await generateSubmissionBundleBlob(commonOpts);
        downloadBlobFile(filename, blob);
        setStatusMsg(`Submission Bundle (.zip) downloaded (${Math.round(blob.size / 1024)} KB) — PPTX + DOCX + PDF + .py + .m + PNG + CSV + params.json.`);
      } else {
        const html = await generatePrintableReportHtml({
          reportTitle,
          dateStr,
          teamMembers,
          references,
          discussionText,
          conclusionsText,
          modules: modulesToExport,
        });
        downloadTextFile(`${slug}_ece441_report.html`, html, 'text/html;charset=utf-8;');
        setStatusMsg('Standalone HTML report downloaded.');
      }
    } catch (err) {
      setStatusMsg(`Export error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Export ECE 441 Lab Report"
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[1px] flex items-center justify-center p-4"
    >
      <div className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl overflow-hidden">
        <header className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Export Course Report — {reportTitle}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close report dialog"
            className="p-1 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-sm">
          <div className="rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-3 text-xs text-slate-600 dark:text-slate-300">
            Submission-ready ECE 441 exports (100% browser-local direct download): Executive 16:9 PowerPoint (.pptx) with KaTeX equations &amp; Viva speaker notes, direct PDF (.pdf) report, 12-section Word (.docx) report, and complete Reproducibility Bundle (.zip).
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Report Date
              </label>
              <input
                type="date"
                value={dateStr}
                onChange={(e) => setDateStr(e.target.value)}
                className="w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-1.5 text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Included Modules
              </label>
              <div className="px-2.5 py-1.5 text-xs font-mono text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 rounded bg-slate-50 dark:bg-slate-950">
                {modulesToExport.length} module(s) ·{' '}
                {modulesToExport.reduce((a, m) => a + m.results.figures.length, 0)} figures
              </div>
            </div>
          </div>

          {/* Editable Team Members */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Team Members &amp; Contributions (Cover &amp; Section 11)
              </h3>
              <button
                type="button"
                onClick={addMember}
                className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                <Plus className="w-3.5 h-3.5" /> Add member
              </button>
            </div>
            <div className="space-y-2">
              {teamMembers.map((m, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <input
                    aria-label={`Student ${idx + 1} name`}
                    value={m.name}
                    onChange={(e) => updateMember(idx, 'name', e.target.value)}
                    placeholder="Full name"
                    className="col-span-4 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1 text-xs"
                  />
                  <input
                    aria-label={`Student ${idx + 1} ID`}
                    value={m.studentId}
                    onChange={(e) => updateMember(idx, 'studentId', e.target.value)}
                    placeholder="ID"
                    className="col-span-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1 text-xs font-mono"
                  />
                  <input
                    aria-label={`Student ${idx + 1} contribution`}
                    value={m.contribution}
                    onChange={(e) => updateMember(idx, 'contribution', e.target.value)}
                    placeholder="Contribution"
                    className="col-span-5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => removeMember(idx)}
                    disabled={teamMembers.length <= 1}
                    aria-label={`Remove student ${idx + 1}`}
                    className="col-span-1 p-1 text-slate-400 hover:text-rose-600 disabled:opacity-30"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* Discussion Notes */}
          <section className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200">
                Engineering Discussion Notes (Section 8 — Editable Draft from Computed Results)
              </label>
              <button
                type="button"
                onClick={handleRegenerateDraft}
                disabled={modulesToExport.length === 0}
                className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-40"
              >
                <RefreshCw className="w-3 h-3" />
                Regenerate Draft
              </button>
            </div>
            <textarea
              rows={5}
              value={discussionText}
              onChange={(e) => onChangeDiscussionText(e.target.value)}
              placeholder="Auto-generated editable engineering discussion draft..."
              className="w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 p-2.5 text-xs"
            />
          </section>

          {/* Conclusions */}
          <section className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200">
              Conclusions &amp; Recommendations (Section 9)
            </label>
            <textarea
              rows={3}
              value={conclusionsText}
              onChange={(e) => setConclusionsText(e.target.value)}
              className="w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 p-2.5 text-xs"
            />
          </section>

          {/* References */}
          <section className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200">
              References (Section 10 — one per line)
            </label>
            <textarea
              rows={4}
              value={references.join('\n')}
              onChange={(e) =>
                onChangeReferences(
                  e.target.value
                    .split('\n')
                    .map((l) => l.trim())
                    .filter(Boolean),
                )
              }
              className="w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 p-2.5 text-xs font-mono"
            />
          </section>

        </div>

        {statusMsg && (
          <div className="px-5 py-2 text-xs font-mono text-blue-800 dark:text-blue-200 bg-blue-50 dark:bg-blue-950/50 border-t border-blue-200 dark:border-blue-900">
            {statusMsg}
          </div>
        )}

        <footer className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-testid="export-report-pdf-btn"
              disabled={busy || modulesToExport.length === 0}
              onClick={() => void handleGenerate('pdf')}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-md bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-50"
            >
              <FileDown className="w-3.5 h-3.5" />
              Export PDF (.pdf)
            </button>
            <button
              type="button"
              data-testid="export-report-pptx-btn"
              disabled={busy || modulesToExport.length === 0}
              onClick={() => void handleGenerate('pptx')}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50"
            >
              <Presentation className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              PowerPoint (.pptx)
            </button>
            <button
              type="button"
              disabled={busy || modulesToExport.length === 0}
              onClick={() => void handleGenerate('docx')}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50"
            >
              <FileText className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              Word (.docx)
            </button>
            <button
              type="button"
              disabled={busy || modulesToExport.length === 0}
              onClick={() => void handleGenerate('bundle')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-md bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
            >
              <Archive className="w-3.5 h-3.5" />
              Submission Bundle (.zip)
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={busy || modulesToExport.length === 0}
              onClick={() => void handleGenerate('download')}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              HTML
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 text-xs font-medium rounded-md border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Close
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};
