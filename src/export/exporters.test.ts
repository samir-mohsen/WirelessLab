import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MODULE2_PARAMS,
  MODULE2_THEORY,
  assembleModule2Results,
  buildModule2Tasks,
  simulateDiversityPoint,
  type Module2WorkerTaskOutput,
} from '../modules/module2/model';
import { runModuleGoldenRegression } from '../engine/golden';
import { getModuleDescriptor } from '../modules/registry';
import { generateSubmissionBundleUint8Array } from './bundleExporter';
import { generateDocxUint8Array } from './docxExporter';
import { generateRegressionPdfUint8Array, generateReportPdfUint8Array } from './pdfExporter';
import { generatePptxArrayBuffer } from './pptxExporter';
import type { SubmissionExportOptions } from './types';

function buildRealModule2ExportOptions(): SubmissionExportOptions {
  const params = { ...DEFAULT_MODULE2_PARAMS, quickMode: true };
  const tasks = buildModule2Tasks(params, 'quick');
  const outputs: Module2WorkerTaskOutput[] = tasks.map((t) => ({
    group: t.group,
    seriesKey: t.seriesKey,
    xValue: t.xValue,
    meta: t.meta,
    result: simulateDiversityPoint(t.config),
  }));
  const results = assembleModule2Results(params, outputs, 250, false);

  return {
    reportTitle: 'Module 2: Diversity Combining Study',
    dateStr: '2026-05-01',
    teamMembers: [
      { name: 'Student A', studentId: '441-001', contribution: 'Simulation & Verification' },
      { name: 'Student B', studentId: '441-002', contribution: 'Theory & Report' },
    ],
    references: [
      'A. Goldsmith, Wireless Communications, Cambridge University Press, 2005.',
      'T. S. Rappaport, Wireless Communications: Principles and Practice, 2nd ed., 2002.',
    ],
    discussionText: 'MRC achieved the highest SNR gain over no-diversity Rayleigh fading.',
    conclusionsText: 'Deploy L=4 MRC when full CSI is available; use SC for low-complexity receivers.',
    modules: [
      {
        descriptor: getModuleDescriptor('module2'),
        theory: MODULE2_THEORY,
        results,
        params: { ...params },
      },
    ],
  };
}

describe('Tier 1 Binary Submission Exporters (T1.1 PPTX, T1.2 DOCX, T1.3 ZIP, PDF)', () => {
  const opts = buildRealModule2ExportOptions();

  it('T1.1: generates a valid PowerPoint (.pptx) archive with slides and speaker notes', async () => {
    const buf = await generatePptxArrayBuffer(opts);
    const bytes = new Uint8Array(buf);
    // ZIP magic bytes PK\x03\x04
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
    expect(bytes.byteLength).toBeGreaterThan(15_000);

    const zip = await JSZip.loadAsync(bytes);
    const fileNames = Object.keys(zip.files);
    expect(fileNames).toContain('ppt/presentation.xml');
    const slideFiles = fileNames.filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f));
    const notesFiles = fileNames.filter((f) => /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(f));
    // Must have title + agenda + objectives + bg + equations + method + params + 4+ figures + verify + compare + disc + concl + refs + team + Q&A
    expect(slideFiles.length).toBeGreaterThanOrEqual(16);
    // Every slide has speaker notes
    expect(notesFiles.length).toBe(slideFiles.length);
  });

  it('T1.2: generates a valid 12-section Word (.docx) document with images and headers/footers', async () => {
    const bytes = await generateDocxUint8Array(opts);
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
    expect(bytes.byteLength).toBeGreaterThan(10_000);

    const zip = await JSZip.loadAsync(bytes);
    const fileNames = Object.keys(zip.files);
    expect(fileNames).toContain('word/document.xml');
    const docXml = await zip.file('word/document.xml')!.async('string');
    expect(docXml).toContain('DELTA UNIVERSITY FOR SCIENCE AND TECHNOLOGY');
    expect(docXml).toContain('2. Abstract and Objectives');
    expect(docXml).toContain('7. Simulation Results and Quantitative Verification');
    expect(docXml).toContain('12. Appendix: Reproducibility Parameters, Seeds');
    const mediaFiles = fileNames.filter((f) => f.startsWith('word/media/'));
    expect(mediaFiles.length).toBeGreaterThanOrEqual(1);
    const drawingMatches = docXml.match(/<w:drawing>/g) ?? [];
    expect(drawingMatches.length).toBeGreaterThanOrEqual(
      opts.modules[0].results.figures.length + opts.modules[0].theory.equations.length,
    );
  });

  it('PDF Report: generates a valid multi-page A4 PDF technical report', async () => {
    const bytes = await generateReportPdfUint8Array(opts);
    const header = new TextDecoder('ascii').decode(bytes.slice(0, 5));
    expect(header).toBe('%PDF-');
    expect(bytes.byteLength).toBeGreaterThan(4_000);
  });

  it('PDF Regression: generates a valid Golden-Results Regression PDF verification report', () => {
    const summary = runModuleGoldenRegression('module7');
    const bytes = generateRegressionPdfUint8Array([summary], null);
    const header = new TextDecoder('ascii').decode(bytes.slice(0, 5));
    expect(header).toBe('%PDF-');
    expect(bytes.byteLength).toBeGreaterThan(2_000);
  });

  it('T1.3: generates a complete Reproducibility Submission Bundle (.zip) with all required artifacts including PDF', async () => {
    const { filename, bytes } = await generateSubmissionBundleUint8Array(opts);
    expect(filename).toMatch(/_ece441_submission_bundle\.zip$/);
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);

    const zip = await JSZip.loadAsync(bytes);
    const files = Object.keys(zip.files);

    expect(files.some((f) => f.startsWith('presentation/') && f.endsWith('.pptx'))).toBe(true);
    expect(files.some((f) => f.startsWith('report/') && f.endsWith('.docx'))).toBe(true);
    expect(files.some((f) => f.startsWith('report/') && f.endsWith('.pdf'))).toBe(true);
    expect(files).toContain('scripts/ece441_module2_diversity.py');
    expect(files).toContain('scripts/ece441_module2_diversity.m');
    expect(files).toContain('params.json');
    expect(files).toContain('README_REPRODUCE.txt');

    const pngCount = files.filter((f) => f.startsWith('figures/') && f.endsWith('.png')).length;
    const csvCount = files.filter((f) => f.startsWith('data/') && f.endsWith('.csv')).length;
    expect(pngCount).toBe(opts.modules[0].results.figures.length);
    expect(csvCount).toBe(opts.modules[0].results.figures.length);

    const paramsJson = JSON.parse(await zip.file('params.json')!.async('string'));
    expect(paramsJson.modules[0].seed).toBe(DEFAULT_MODULE2_PARAMS.seed);
    expect(paramsJson.modules[0].expectedReferenceValues.length).toBeGreaterThanOrEqual(3);
  });
});
