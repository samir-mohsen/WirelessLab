import { jsPDF } from 'jspdf';
import { extractFigureDiagnostics } from '../engine/analytics';
import type { ModuleRegressionReport, SuiteRegressionReport } from '../engine/golden';
import { getModuleDescriptor } from '../modules/registry';
import {
  figureCacheKey,
  getEffectiveParams,
  preRenderAllFigures,
  type SubmissionExportOptions,
} from './types';

// Clean Latin-safe ASCII sanitizer for jsPDF built-in Helvetica font
function pdfSafe(text: string): string {
  return String(text ?? '')
    .replace(/γ̄/g, 'gamma_bar')
    .replace(/γ/g, 'gamma')
    .replace(/σ/g, 'sigma')
    .replace(/ρ/g, 'rho')
    .replace(/τ/g, 'tau')
    .replace(/λ/g, 'lambda')
    .replace(/μ/g, 'mu')
    .replace(/Δ/g, 'Delta')
    .replace(/α/g, 'alpha')
    .replace(/η/g, 'eta')
    .replace(/π/g, 'pi')
    .replace(/Ω/g, 'Ohm')
    .replace(/≤/g, '<=')
    .replace(/≥/g, '>=')
    .replace(/±/g, '+/-')
    .replace(/×/g, 'x')
    .replace(/·/g, ' | ')
    .replace(/—/g, ' - ')
    .replace(/–/g, '-')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/⁻¹/g, '^-1')
    .replace(/⁻²/g, '^-2')
    .replace(/⁻³/g, '^-3')
    .replace(/⁻⁴/g, '^-4')
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
    .replace(/→/g, '->')
    .replace(/[^\x20-\x7E\n]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function fmtNum(v: number): string {
  if (!Number.isFinite(v)) return 'NaN';
  if (v === 0) return '0';
  const a = Math.abs(v);
  if (a < 0.001 || a >= 10000) return v.toExponential(4);
  return v.toFixed(5);
}

// ============================================================================
// 1. GOLDEN-RESULTS REGRESSION VERIFICATION CERTIFICATE (.PDF)
// ============================================================================

export function generateRegressionPdfUint8Array(
  moduleReports: ModuleRegressionReport[],
  suiteSummary: SuiteRegressionReport | null,
): Uint8Array {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentW = pageW - margin * 2;

  const allRows = moduleReports.flatMap((m) => m.rows);
  const passedModules = moduleReports.filter((m) => m.passed).length;
  const passedMetrics = allRows.filter((r) => r.passed).length;
  const allPassed = moduleReports.length > 0 && passedModules === moduleReports.length;
  const maxDrift = moduleReports.reduce(
    (mx, m) => (Number.isFinite(m.maxRelDrift) ? Math.max(mx, m.maxRelDrift) : mx),
    0,
  );
  const ts = suiteSummary?.timestamp ?? new Date().toISOString();

  // Top Navy Header Banner
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageW, 34, 'F');
  doc.setFillColor(37, 99, 235);
  doc.rect(0, 34, pageW, 1.5, 'F');

  doc.setTextColor(147, 197, 253);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('DELTA UNIVERSITY FOR SCIENCE AND TECHNOLOGY  |  FACULTY OF ENGINEERING', margin, 11);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.text('Golden-Results Regression Verification Report', margin, 20);

  doc.setTextColor(203, 213, 225);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(
    `WirelessLab ECE441  |  Deterministic Baseline Audit  |  Generated: ${ts.slice(0, 19).replace('T', ' ')} UTC`,
    margin,
    28,
  );

  let y = 43;

  // Overall Status Callout Banner
  doc.setFillColor(allPassed ? 236 : 255, allPassed ? 253 : 241, allPassed ? 245 : 242);
  doc.setDrawColor(allPassed ? 5 : 225, allPassed ? 150 : 29, allPassed ? 105 : 72);
  doc.setLineWidth(0.4);
  doc.roundedRect(margin, y, contentW, 14, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(allPassed ? 4 : 190, allPassed ? 120 : 18, allPassed ? 87 : 60);
  doc.text(
    allPassed
      ? `VERIFICATION STATUS: ALL PASS (${passedModules}/${moduleReports.length} modules, ${passedMetrics}/${allRows.length} metrics)`
      : `VERIFICATION STATUS: DRIFT DETECTED (${passedModules}/${moduleReports.length} modules passed)`,
    margin + 4,
    y + 6.5,
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  doc.text(
    `Max Relative Drift: ${(maxDrift * 100).toFixed(4)}%   |   Baseline Reference: src/engine/goldenResults.json`,
    margin + 4,
    y + 11.5,
  );

  y += 20;

  // Module Summary Grid
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text('1. Module Verification Summary', margin, y);
  y += 5;

  const colW1 = [18, 68, 22, 26, 26, 22];
  const drawSummaryHeader = () => {
    doc.setFillColor(30, 58, 138);
    doc.rect(margin, y, contentW, 7, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.2);
    const hdrs = ['Mod.', 'Simulation Module', 'Seed', 'Max Drift', 'Runtime', 'Status'];
    let cx = margin + 2;
    hdrs.forEach((h, idx) => {
      doc.text(h, cx, y + 4.8);
      cx += colW1[idx];
    });
    y += 7;
  };
  drawSummaryHeader();

  moduleReports.forEach((rep, idx) => {
    if (y > pageH - 24) {
      doc.addPage();
      y = 18;
      drawSummaryHeader();
    }
    const desc = getModuleDescriptor(rep.moduleId);
    if (idx % 2 === 0) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y, contentW, 6.5, 'F');
    }
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(margin, y + 6.5, margin + contentW, y + 6.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    let cx = margin + 2;
    const vals = [
      `M${desc.number}`,
      pdfSafe(desc.shortTitle).slice(0, 38),
      String(rep.seed),
      `${(rep.maxRelDrift * 100).toFixed(4)}%`,
      `${Math.round(rep.elapsedMs)} ms`,
      rep.passed ? 'PASS' : 'FAIL',
    ];
    vals.forEach((v, i) => {
      if (i === 5) {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(rep.passed ? 4 : 190, rep.passed ? 120 : 18, rep.passed ? 87 : 60);
      } else {
        doc.setFont('helvetica', i === 0 ? 'bold' : 'normal');
        doc.setTextColor(15, 23, 42);
      }
      doc.text(v, cx, y + 4.5);
      cx += colW1[i];
    });
    y += 6.5;
  });

  y += 9;
  if (y > pageH - 36) {
    doc.addPage();
    y = 18;
  }

  // Detailed Golden Metrics Comparison Table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text('2. Detailed Deterministic Metric Audit', margin, y);
  y += 5;

  const colW2 = [13, 73, 25, 25, 18, 14, 14];
  const drawDetailHeader = () => {
    doc.setFillColor(15, 23, 42);
    doc.rect(margin, y, contentW, 7, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.8);
    const hdrs = ['Mod.', 'Golden Metric', 'Golden', 'Actual', 'Drift %', 'Tol.', 'Status'];
    let cx = margin + 1.8;
    hdrs.forEach((h, i) => {
      doc.text(h, cx, y + 4.8);
      cx += colW2[i];
    });
    y += 7;
  };
  drawDetailHeader();

  allRows.forEach((row, idx) => {
    if (y > pageH - 20) {
      doc.addPage();
      y = 18;
      drawDetailHeader();
    }
    if (idx % 2 === 0) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y, contentW, 6.2, 'F');
    }
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.18);
    doc.line(margin, y + 6.2, margin + contentW, y + 6.2);

    const modNum = getModuleDescriptor(row.moduleId).number;
    const labelText = pdfSafe(`${row.label}${row.unit ? ` (${row.unit})` : ''}`).slice(0, 44);
    const cells = [
      `M${modNum}`,
      labelText,
      fmtNum(row.golden),
      fmtNum(row.actual),
      Number.isFinite(row.relDrift) ? `${(row.relDrift * 100).toFixed(3)}%` : 'Inf',
      `<=${(row.relTolerance * 100).toFixed(2)}%`,
      row.passed ? 'PASS' : 'FAIL',
    ];
    let cx = margin + 1.8;
    doc.setFontSize(7.6);
    cells.forEach((c, i) => {
      if (i === 6) {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(row.passed ? 4 : 190, row.passed ? 120 : 18, row.passed ? 87 : 60);
      } else {
        doc.setFont('helvetica', i === 0 ? 'bold' : 'normal');
        doc.setTextColor(30, 41, 59);
      }
      doc.text(c, cx, y + 4.3);
      cx += colW2[i];
    });
    y += 6.2;
  });

  // Page numbers on all pages
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, pageH - 12, pageW - margin, pageH - 12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('WirelessLab ECE441 | Golden-Results Regression Verification', margin, pageH - 7.5);
    doc.text(`Page ${p} of ${totalPages}`, pageW - margin, pageH - 7.5, { align: 'right' });
  }

  return new Uint8Array(doc.output('arraybuffer'));
}

export function generateRegressionPdfBlob(
  moduleReports: ModuleRegressionReport[],
  suiteSummary: SuiteRegressionReport | null,
): Blob {
  const bytes = generateRegressionPdfUint8Array(moduleReports, suiteSummary);
  return new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' });
}

// ============================================================================
// 2. COMPLETE 12-SECTION ECE 441 TECHNICAL REPORT (.PDF)
// ============================================================================

export async function generateReportPdfUint8Array(
  opts: SubmissionExportOptions,
): Promise<Uint8Array> {
  if (opts.modules.length === 0) {
    throw new Error('At least one simulated module is required to export PDF.');
  }

  const preRendered = await preRenderAllFigures(
    opts.modules,
    opts.preRenderedFigures,
    opts.onProgress,
  );
  opts.onProgress?.('Composing formatted multi-page PDF report...');

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentW = pageW - margin * 2;
  const isSuite = opts.modules.length > 1;
  const primary = opts.modules[0];

  const totalFigs = opts.modules.reduce((a, m) => a + m.results.figures.length, 0);
  const totalTrials = opts.modules.reduce((a, m) => a + m.results.meta.totalBitsOrTrials, 0);
  const passedMods = opts.modules.filter((m) => m.results.verification?.passed !== false).length;

  // --------------------------------------------------------------------------
  // PAGE 1: ACADEMIC COVER PAGE
  // --------------------------------------------------------------------------
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageW, 92, 'F');
  doc.setFillColor(37, 99, 235);
  doc.rect(0, 92, pageW, 2.5, 'F');

  doc.setTextColor(147, 197, 253);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('DELTA UNIVERSITY FOR SCIENCE AND TECHNOLOGY', margin, 22);

  doc.setTextColor(203, 213, 225);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text('Faculty of Engineering  |  Department of Communications & Electronics Engineering', margin, 29);

  doc.setTextColor(96, 165, 250);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text('ECE 441 - Wireless and Mobile Communications (Option B: Simulation Research)', margin, 42);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  const titleLines = doc.splitTextToSize(pdfSafe(opts.reportTitle), contentW);
  doc.text(titleLines, margin, 56);

  doc.setTextColor(148, 163, 184);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text(`Submission Date: ${opts.dateStr}   |   Platform: WirelessLab ECE441`, margin, 83);

  // KPI Summary Cards on Cover Page
  let y = 106;
  const kpis = [
    { label: 'MODULES COVERED', val: `${opts.modules.length} / 8` },
    { label: 'RESULT FIGURES', val: `${totalFigs} plots` },
    { label: 'MONTE-CARLO TRIALS', val: totalTrials.toLocaleString() },
    { label: 'THEORY VERIFICATION', val: `${passedMods}/${opts.modules.length} PASS` },
  ];
  const cardGap = 4;
  const cardW = (contentW - cardGap * 3) / 4;
  kpis.forEach((k, idx) => {
    const cx = margin + idx * (cardW + cardGap);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.35);
    doc.roundedRect(cx, y, cardW, 22, 2, 2, 'FD');
    doc.setFillColor(37, 99, 235);
    doc.rect(cx, y, cardW, 1.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(k.label, cx + 3, y + 7.5);
    doc.setFontSize(11.5);
    doc.setTextColor(15, 23, 42);
    doc.text(k.val, cx + 3, y + 16.5);
  });

  // Abstract box
  y += 32;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('Executive Abstract', margin, y);
  y += 5;
  const abstractText = pdfSafe(
    isSuite
      ? `This technical report documents deterministic Monte-Carlo simulations across ${opts.modules.length} core topics of ECE 441 (Wireless and Mobile Communications), including closed-form analytical verification, quantitative parameter trade-offs, and reproducible MATLAB/Python benchmarks.`
      : primary.theory.abstract,
  );
  const absLines = doc.splitTextToSize(abstractText, contentW - 8);
  const absH = Math.max(20, absLines.length * 5 + 8);
  doc.setFillColor(239, 246, 255);
  doc.setDrawColor(147, 197, 253);
  doc.roundedRect(margin, y, contentW, absH, 2, 2, 'FD');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59);
  doc.text(absLines, margin + 4, y + 6.5);
  y += absH + 12;

  // Team Roster Table on Cover Page
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('Research Team & Contributions', margin, y);
  y += 5;

  const tColW = [54, 28, contentW - 82];
  doc.setFillColor(15, 23, 42);
  doc.rect(margin, y, contentW, 7.5, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8.5);
  doc.text('Student Name', margin + 2.5, y + 5.1);
  doc.text('Student ID', margin + tColW[0] + 2.5, y + 5.1);
  doc.text('Technical Contribution', margin + tColW[0] + tColW[1] + 2.5, y + 5.1);
  y += 7.5;

  opts.teamMembers.slice(0, 8).forEach((m, idx) => {
    if (idx % 2 === 0) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y, contentW, 7, 'F');
    }
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y + 7, margin + contentW, y + 7);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(pdfSafe(m.name).slice(0, 30), margin + 2.5, y + 4.8);
    doc.setFont('helvetica', 'normal');
    doc.text(pdfSafe(m.studentId).slice(0, 16), margin + tColW[0] + 2.5, y + 4.8);
    doc.text(pdfSafe(m.contribution).slice(0, 56), margin + tColW[0] + tColW[1] + 2.5, y + 4.8);
    y += 7;
  });

  // Helper cursor for flowing content pages
  doc.addPage();
  y = 20;

  const ensureSpace = (neededMm: number) => {
    if (y + neededMm > pageH - 18) {
      doc.addPage();
      y = 20;
    }
  };

  const addSectionHeading = (numLabel: string, heading: string) => {
    ensureSpace(16);
    doc.setFillColor(37, 99, 235);
    doc.rect(margin, y - 4, 2.2, 7.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`${numLabel}  ${pdfSafe(heading)}`, margin + 5, y + 1.5);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(margin, y + 4.5, margin + contentW, y + 4.5);
    y += 10;
  };

  const addParagraph = (text: string, fontSize = 9.3, indent = 0) => {
    const clean = pdfSafe(text);
    if (!clean) return;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(fontSize);
    doc.setTextColor(51, 65, 85);
    const lines = doc.splitTextToSize(clean, contentW - indent);
    for (const line of lines) {
      ensureSpace(5.5);
      doc.text(line, margin + indent, y);
      y += 4.6;
    }
    y += 2;
  };

  const addBullets = (items: string[]) => {
    items.forEach((item) => {
      const clean = pdfSafe(item);
      if (!clean) return;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.2);
      doc.setTextColor(51, 65, 85);
      const lines = doc.splitTextToSize(clean, contentW - 6);
      ensureSpace(lines.length * 4.6 + 2);
      doc.setFillColor(37, 99, 235);
      doc.circle(margin + 1.6, y - 1.1, 0.85, 'F');
      lines.forEach((line: string) => {
        doc.text(line, margin + 5, y);
        y += 4.5;
      });
      y += 1.2;
    });
    y += 2;
  };

  // Section 1: Objectives
  addSectionHeading('1.', 'Objectives & Scope');
  addBullets(
    isSuite
      ? opts.modules.map((m) => `Module ${m.descriptor.number} (${m.descriptor.shortTitle}): ${m.descriptor.oneLineIdea}`)
      : primary.theory.objectives,
  );

  // Section 2: Technical Background
  addSectionHeading('2.', 'Technical Background');
  const bgItems = isSuite
    ? opts.modules.map((m) => `Module ${m.descriptor.number}: ${m.theory.technicalBackground[0] ?? m.theory.abstract}`)
    : primary.theory.technicalBackground;
  bgItems.forEach((p) => addParagraph(p));

  // Section 3: System Model & Governing Equations
  addSectionHeading('3.', 'System Model & Analytical Equations');
  addParagraph(primary.theory.systemModelSummary);
  const eqs = isSuite
    ? opts.modules.flatMap((m) =>
        m.theory.equations.slice(0, 2).map((eq) => ({
          title: `M${m.descriptor.number} - ${eq.title}`,
          latex: eq.latex,
          explanation: eq.explanation,
        })),
      )
    : primary.theory.equations;
  eqs.forEach((eq, idx) => {
    ensureSpace(19);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.25);
    const exprLines = doc.splitTextToSize(pdfSafe(eq.latex), contentW - 8);
    const explLines = doc.splitTextToSize(pdfSafe(eq.explanation), contentW - 8);
    const boxH = 8 + exprLines.length * 4.2 + explLines.length * 4.0 + 3;
    ensureSpace(boxH + 3);
    doc.roundedRect(margin, y, contentW, boxH, 1.5, 1.5, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.8);
    doc.setTextColor(30, 58, 138);
    doc.text(`(${idx + 1}) ${pdfSafe(eq.title)}`, margin + 3.5, y + 5.2);
    doc.setFont('courier', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text(exprLines, margin + 3.5, y + 10.2);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.2);
    doc.setTextColor(71, 85, 105);
    doc.text(explLines, margin + 3.5, y + 10.5 + exprLines.length * 4.2);
    y += boxH + 3;
  });

  // Section 4: Methodology & Assumptions
  addSectionHeading('4.', 'Simulation Methodology & Assumptions');
  addBullets(primary.theory.methodology);
  addBullets(primary.theory.assumptions);

  // Section 5: Parameters & Reproducibility Seeds
  addSectionHeading('5.', 'Simulation Parameters & RNG Seeds');
  for (const mod of opts.modules) {
    ensureSpace(18);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(30, 58, 138);
    doc.text(
      `Module ${mod.descriptor.number}: ${pdfSafe(mod.descriptor.shortTitle)} (Seed = ${mod.results.meta.seed}, Trials = ${mod.results.meta.totalBitsOrTrials.toLocaleString()})`,
      margin,
      y,
    );
    y += 4.5;
    const entries = Object.entries(getEffectiveParams(mod)).slice(0, 12);
    const paramStr = entries
      .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
      .join('   |   ');
    addParagraph(paramStr, 8.2, 2);
  }

  // Section 6: Simulation Results & Embedded High-DPI Figures
  addSectionHeading('6.', 'Simulation Results, Figures & Key Findings');
  let figNum = 0;
  for (const mod of opts.modules) {
    for (const fig of mod.results.figures) {
      figNum += 1;
      const pngDataUrl = preRendered[figureCacheKey(mod.descriptor.id, fig.id)];
      const imgH = 74;
      const findings = fig.keyFindings.slice(0, 3);
      const diagnostics = extractFigureDiagnostics(fig);

      ensureSpace(imgH + 38);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text(
        pdfSafe(`Figure ${figNum} (M${mod.descriptor.number}): ${fig.title}`).slice(0, 95),
        margin,
        y,
      );
      y += 4;

      if (pngDataUrl) {
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.3);
        doc.rect(margin, y, contentW, imgH);
        try {
          doc.addImage(pngDataUrl, 'PNG', margin + 1, y + 1, contentW - 2, imgH - 2, undefined, 'FAST');
        } catch {
          // Graceful fallback if image decoding fails in headless unit test stubs
        }
        y += imgH + 3.5;
      }

      // Automated Diagnostics summary line if available
      if (diagnostics && diagnostics.items.length > 0) {
        const diagLine = diagnostics.items
          .slice(0, 4)
          .map(
            (d) =>
              `${d.traceName}: ${d.valueText}${d.deltaVsBaseline ? ` (${d.deltaVsBaseline})` : ''}`,
          )
          .join('  |  ');
        addParagraph(`Diagnostics: ${diagLine}`, 8, 2);
      }

      // Key Findings Box
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.2);
      doc.setTextColor(29, 78, 216);
      ensureSpace(12);
      doc.text('Computed Key Findings:', margin + 1, y);
      y += 4.2;
      addBullets(findings);
      y += 2;
    }
  }

  // Section 7: Analytical Verification Audit
  addSectionHeading('7.', 'Verification Against Closed-Form Theory');
  for (const mod of opts.modules) {
    const v = mod.results.verification;
    if (!v) continue;
    ensureSpace(16);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.3);
    doc.setTextColor(v.passed ? 4 : 190, v.passed ? 120 : 18, v.passed ? 87 : 60);
    doc.text(
      pdfSafe(`Module ${mod.descriptor.number} (${mod.descriptor.shortTitle}): ${v.summary}`),
      margin,
      y,
    );
    y += 5;

    const vColW = [68, 28, 28, 28, 28];
    const drawVHeader = () => {
      doc.setFillColor(30, 58, 138);
      doc.rect(margin, y, contentW, 6.5, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.8);
      let cx = margin + 2;
      ['Check Point', 'Simulated', 'Theory', 'Rel. Error', 'Status'].forEach((h, i) => {
        doc.text(h, cx, y + 4.4);
        cx += vColW[i];
      });
      y += 6.5;
    };
    drawVHeader();

    v.rows.slice(0, 8).forEach((r, idx) => {
      if (y > pageH - 20) {
        doc.addPage();
        y = 20;
        drawVHeader();
      }
      if (idx % 2 === 0) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, y, contentW, 5.8, 'F');
      }
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.6);
      doc.setTextColor(30, 41, 59);
      const pass = r.included && r.relError <= v.threshold;
      const cells = [
        pdfSafe(`${r.label} (${r.point})`).slice(0, 38),
        fmtNum(r.simulated),
        fmtNum(r.theory),
        Number.isFinite(r.relError) ? `${(r.relError * 100).toFixed(2)}%` : '-',
        !r.included ? 'Skipped' : pass ? 'PASS' : 'CHECK',
      ];
      let cx = margin + 2;
      cells.forEach((c, i) => {
        if (i === 4) {
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(
            !r.included ? 100 : pass ? 4 : 190,
            !r.included ? 116 : pass ? 120 : 18,
            !r.included ? 139 : pass ? 87 : 60,
          );
        } else {
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(30, 41, 59);
        }
        doc.text(c, cx, y + 4);
        cx += vColW[i];
      });
      y += 5.8;
    });
    y += 6;
  }

  // Section 8: Engineering Discussion
  addSectionHeading('8.', 'Engineering Discussion');
  const discParagraphs = opts.discussionText.trim()
    ? opts.discussionText.split('\n').filter((l) => l.trim())
    : opts.modules.flatMap((m) => m.results.figures[0]?.keyFindings ?? []);
  discParagraphs.forEach((p) => addParagraph(p));

  // Section 9: Conclusions & Recommendations
  addSectionHeading('9.', 'Conclusions & Engineering Recommendations');
  const conclItems = opts.conclusionsText.trim()
    ? opts.conclusionsText.split('\n').filter((l) => l.trim())
    : primary.theory.conclusionsDefault;
  addBullets(conclItems);

  // Section 10: References
  addSectionHeading('10.', 'References');
  opts.references.forEach((ref, idx) => {
    addParagraph(`[${idx + 1}] ${ref}`, 8.6);
  });

  // Add running headers (page 2+) and page numbers on every page
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    if (p >= 2) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(pdfSafe(`WirelessLab ECE441  |  ${opts.reportTitle}`).slice(0, 88), margin, 10.5);
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.25);
      doc.line(margin, 12.5, pageW - margin, 12.5);
    }
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, pageH - 12, pageW - margin, pageH - 12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Delta University Faculty of Engineering  |  ECE 441', margin, pageH - 7.5);
    doc.text(`Page ${p} of ${totalPages}`, pageW - margin, pageH - 7.5, { align: 'right' });
  }

  return new Uint8Array(doc.output('arraybuffer'));
}

export async function generateReportPdfBlob(opts: SubmissionExportOptions): Promise<Blob> {
  const bytes = await generateReportPdfUint8Array(opts);
  return new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' });
}
