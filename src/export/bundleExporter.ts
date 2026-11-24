import JSZip from 'jszip';
import { tableToCSVString } from '../store/projectStore';
import { computeExpectedReferenceValues, generateMatlabScript, generatePythonScript } from './codeExporter';
import { generateDocxUint8Array } from './docxExporter';
import { dataUrlToBytes } from './equationImage';
import { generateReportPdfUint8Array } from './pdfExporter';
import { generatePptxArrayBuffer } from './pptxExporter';
import {
  figureCacheKey,
  getEffectiveParams,
  preRenderAllFigures,
  slugifyFilename,
  type SubmissionExportOptions,
} from './types';

function buildReproduceReadme(
  opts: SubmissionExportOptions,
  slug: string,
  scriptFilenames: string[],
): string {
  const modLines = opts.modules
    .map((m) => {
      const v = m.results.verification;
      const errStr =
        v && Number.isFinite(v.maxRelError)
          ? `${(v.maxRelError * 100).toFixed(2)}% (${v.passed ? 'PASS' : 'CHECK'})`
          : 'N/A';
      return `  - Module ${m.descriptor.number}: ${m.descriptor.title}
      RNG Seed: ${m.results.meta.seed}
      Figures: ${m.results.figures.length}
      Trials/Bits: ${m.results.meta.totalBitsOrTrials.toLocaleString()}
      Verification: ${errStr}`;
    })
    .join('\n');

  const teamLines = opts.teamMembers
    .map((m) => `  - ${m.name} (ID: ${m.studentId}) — ${m.contribution}`)
    .join('\n');

  return `===============================================================================
WirelessLab ECE441 — Reproducible Course Submission Bundle
Delta University for Science and Technology — Faculty of Engineering
Course: ECE 441 — Wireless and Mobile Communications (Option B)
===============================================================================

Report Title: ${opts.reportTitle}
Export Date:  ${opts.dateStr}

Team Roster:
${teamLines}

Included Modules & Verification Audit:
${modLines}

-------------------------------------------------------------------------------
PACKAGE CONTENTS
-------------------------------------------------------------------------------
1. presentation/${slug}_ece441_slides.pptx
     16:9 PowerPoint presentation (20-25 min structure) with KaTeX equation
     images, 2x Plotly figures, computed Key Findings, and Viva speaker notes.

2. report/${slug}_ece441_report.docx  &  report/${slug}_ece441_report.pdf
     12-section Word (.docx) and formatted PDF (.pdf) technical reports with
     Cover Page, numbered figures and tables, verification audit, and seeds.

3. scripts/
     Standalone Python (.py) and MATLAB (.m) reproduction scripts with
     embedded @EXPECTED reference checkpoints from the WirelessLab JS engine:
${scriptFilenames.map((s) => `     - scripts/${s}`).join('\n')}

4. figures/
     High-DPI (2x) PNG figures exported directly from Plotly.js.

5. data/
     Raw numerical CSV data tables for every exported figure.

6. params.json
     Complete parameter snapshots, RNG seeds, verification metadata, and
     analytical cross-check benchmarks.

-------------------------------------------------------------------------------
HOW TO REPRODUCE RESULTS
-------------------------------------------------------------------------------
A. Inside WirelessLab ECE441 (Browser or Windows Desktop .exe):
   1. Open WirelessLab ECE441.
   2. Click "Load JSON" or enter the exact parameters and RNG seed listed in
      params.json for the desired module.
   3. Click "Run All Experiments" (or "Self-test" for fast theory verification).
   4. Deterministic Mulberry32 PRNG guarantees bit-identical figures.

B. In Python 3 (NumPy + SciPy + Matplotlib):
   1. Install dependencies once:
        pip install numpy scipy matplotlib
   2. Run any exported script:
        python scripts/<script_name>.py
   3. Compare printed checkpoints against the "# @EXPECTED ..." lines at the
      top of the script.

C. In MATLAB (R2020b or newer):
   1. Open any scripts/*.m file in MATLAB.
   2. Press Run (F5). The script initializes rng(SEED) and plots the core
      simulation vs. closed-form theory curves.
   3. Verify numerical checkpoints against the "% @EXPECTED ..." header lines.
===============================================================================
`;
}

/**
 * T1.3: Build a complete ECE 441 Reproducibility Submission Bundle (.zip)
 * containing PPTX, DOCX, Python (.py), MATLAB (.m), all 2x PNG figures,
 * all CSV data tables, params.json with seeds, and README_REPRODUCE.txt.
 * Pre-renders every figure ONCE and reuses the PNGs across PPTX, DOCX, and figures/.
 */
export async function generateSubmissionBundleUint8Array(
  opts: SubmissionExportOptions,
): Promise<{ filename: string; bytes: Uint8Array }> {
  if (opts.modules.length === 0) {
    throw new Error('At least one simulated module is required to build a submission bundle.');
  }

  const slug = slugifyFilename(opts.reportTitle);

  // 1. Pre-render every figure PNG once at 2x DPI
  const preRendered = await preRenderAllFigures(
    opts.modules,
    opts.preRenderedFigures,
    opts.onProgress,
  );
  const sharedOpts: SubmissionExportOptions = {
    ...opts,
    preRenderedFigures: preRendered,
  };

  // 2. Build PowerPoint (.pptx), Word (.docx), and PDF (.pdf) reusing pre-rendered figures
  opts.onProgress?.('Building PowerPoint (.pptx) presentation...');
  const pptxBuf = await generatePptxArrayBuffer(sharedOpts);

  opts.onProgress?.('Building Word (.docx) technical report...');
  const docxBytes = await generateDocxUint8Array(sharedOpts);

  opts.onProgress?.('Building formatted PDF (.pdf) technical report...');
  const pdfBytes = await generateReportPdfUint8Array(sharedOpts);

  // 3. Assemble ZIP bundle via JSZip
  opts.onProgress?.('Packing ZIP bundle (PPTX, DOCX, PDF, scripts, PNGs, CSVs, params.json)...');
  const zip = new JSZip();
  zip.file(`presentation/${slug}_ece441_slides.pptx`, pptxBuf);
  zip.file(`report/${slug}_ece441_report.docx`, docxBytes);
  zip.file(`report/${slug}_ece441_report.pdf`, pdfBytes);

  const scriptFilenames: string[] = [];
  const paramsJsonPayload = {
    schemaVersion: '1.0.0',
    platform: 'WirelessLab ECE441',
    reportTitle: opts.reportTitle,
    date: opts.dateStr,
    exportedAt: new Date().toISOString(),
    teamMembers: opts.teamMembers,
    modules: opts.modules.map((mod) => {
      const effectiveParams = getEffectiveParams(mod);
      return {
        moduleId: mod.descriptor.id,
        moduleNumber: mod.descriptor.number,
        title: mod.descriptor.title,
        seed: mod.results.meta.seed,
        timestamp: mod.results.meta.timestamp,
        elapsedMs: Math.round(mod.results.meta.elapsedMs),
        totalBitsOrTrials: mod.results.meta.totalBitsOrTrials,
        totalErrors: mod.results.meta.totalErrors,
        quickMode: mod.results.meta.quickMode,
        verification: mod.results.verification
          ? {
              passed: mod.results.verification.passed,
              maxRelError: mod.results.verification.maxRelError,
              threshold: mod.results.verification.threshold,
              pointsUsed: mod.results.verification.pointsUsed,
              totalPoints: mod.results.verification.totalPoints,
              summary: mod.results.verification.summary,
            }
          : null,
        expectedReferenceValues: computeExpectedReferenceValues(
          mod.descriptor.id,
          effectiveParams,
        ),
        parameters: effectiveParams,
      };
    }),
  };

  for (const mod of opts.modules) {
    const effectiveParams = getEffectiveParams(mod);

    // Python + MATLAB scripts (E6 + T1.5 @EXPECTED cross-check headers)
    const py = generatePythonScript(mod.descriptor.id, effectiveParams);
    const mat = generateMatlabScript(mod.descriptor.id, effectiveParams);
    zip.file(`scripts/${py.filename}`, py.content);
    zip.file(`scripts/${mat.filename}`, mat.content);
    scriptFilenames.push(py.filename, mat.filename);

    // All PNG figures + CSV tables
    for (const fig of mod.results.figures) {
      const baseName = `M${mod.descriptor.number}_${slugifyFilename(fig.id, 40)}`;
      const pngDataUrl = preRendered[figureCacheKey(mod.descriptor.id, fig.id)];
      if (pngDataUrl) {
        zip.file(`figures/${baseName}.png`, dataUrlToBytes(pngDataUrl));
      }
      const csv = tableToCSVString(fig.table.headers, fig.table.rows);
      zip.file(`data/${baseName}.csv`, csv);
    }
  }

  zip.file('params.json', JSON.stringify(paramsJsonPayload, null, 2));
  zip.file('README_REPRODUCE.txt', buildReproduceReadme(opts, slug, scriptFilenames));

  const bytes = await zip.generateAsync({
    type: 'uint8array',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  return {
    filename: `${slug}_ece441_submission_bundle.zip`,
    bytes,
  };
}

export async function generateSubmissionBundleBlob(
  opts: SubmissionExportOptions,
): Promise<{ filename: string; blob: Blob }> {
  const { filename, bytes } = await generateSubmissionBundleUint8Array(opts);
  return {
    filename,
    blob: new Blob([bytes.buffer as ArrayBuffer], { type: 'application/zip' }),
  };
}
