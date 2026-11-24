import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  ImageRun,
  Packer,
  PageBreak,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableOfContents,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import { generateMatlabScript, generatePythonScript } from './codeExporter';
import { dataUrlToBytes, renderEquationToPng } from './equationImage';
import {
  figureCacheKey,
  getEffectiveParams,
  preRenderAllFigures,
  type SubmissionExportOptions,
} from './types';

const CELL_BORDERS = {
  top: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
  left: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
  right: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
};

function makeHeading(text: string, level: typeof HeadingLevel[keyof typeof HeadingLevel]): Paragraph {
  return new Paragraph({
    text,
    heading: level,
    spacing: { before: 280, after: 120 },
  });
}

function makeBody(text: string, spacingAfter = 120): Paragraph {
  return new Paragraph({
    spacing: { after: spacingAfter, line: 276 },
    children: [
      new TextRun({
        text,
        font: 'Calibri',
        size: 22, // 11pt
        color: '1E293B',
      }),
    ],
  });
}

function makeBullet(text: string): Paragraph {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 70, line: 260 },
    children: [
      new TextRun({
        text,
        font: 'Calibri',
        size: 21,
        color: '1E293B',
      }),
    ],
  });
}

function makeCaption(text: string): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 80, after: 160 },
    children: [
      new TextRun({
        text,
        italics: true,
        bold: true,
        font: 'Calibri',
        size: 19,
        color: '334155',
      }),
    ],
  });
}

function makeStyledTable(headers: string[], rows: Array<Array<string | number>>): Table {
  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map(
      (h) =>
        new TableCell({
          borders: CELL_BORDERS,
          shading: { type: ShadingType.CLEAR, color: 'auto', fill: '1D4ED8' },
          margins: { top: 80, bottom: 80, left: 100, right: 100 },
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: String(h),
                  bold: true,
                  font: 'Calibri',
                  size: 19,
                  color: 'FFFFFF',
                }),
              ],
            }),
          ],
        }),
    ),
  });

  const dataRows = rows.map(
    (r, rowIdx) =>
      new TableRow({
        children: r.map(
          (cell) =>
            new TableCell({
              borders: CELL_BORDERS,
              shading:
                rowIdx % 2 === 0
                  ? { type: ShadingType.CLEAR, color: 'auto', fill: 'F8FAFC' }
                  : undefined,
              margins: { top: 65, bottom: 65, left: 100, right: 100 },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: String(cell),
                      font: 'Calibri',
                      size: 18,
                      color: '0F172A',
                    }),
                  ],
                }),
              ],
            }),
        ),
      }),
  );

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...dataRows],
  });
}

function makeCodeBlock(title: string, code: string, maxLines = 42): Paragraph[] {
  const clipped = code.split('\n').slice(0, maxLines);
  const out: Paragraph[] = [
    new Paragraph({
      spacing: { before: 160, after: 60 },
      children: [
        new TextRun({
          text: title,
          bold: true,
          font: 'Calibri',
          size: 20,
          color: '0F172A',
        }),
      ],
    }),
  ];
  for (const line of clipped) {
    out.push(
      new Paragraph({
        spacing: { after: 15, line: 220 },
        shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'F8FAFC' },
        children: [
          new TextRun({
            text: line || ' ',
            font: 'Consolas',
            size: 16,
            color: '1E293B',
          }),
        ],
      }),
    );
  }
  return out;
}

/**
 * T1.2: Generate a complete 12-section ECE 441 Word (.docx) technical report
 * with Cover Page, Table of Contents, page numbers, numbered equations, figures,
 * tables, verification summary, discussion, conclusions, references, team table,
 * and reproducibility appendix. 100% browser-local via `docx`.
 */
export async function generateDocxUint8Array(
  opts: SubmissionExportOptions,
): Promise<Uint8Array> {
  if (opts.modules.length === 0) {
    throw new Error('At least one simulated module is required to export a Word report.');
  }

  const preRendered = await preRenderAllFigures(
    opts.modules,
    opts.preRenderedFigures,
    opts.onProgress,
  );

  opts.onProgress?.('Building 12-section Word (.docx) technical report...');

  const isSuite = opts.modules.length > 1;
  const primary = opts.modules[0];
  let figCounter = 0;
  let tableCounter = 0;

  const children: Array<Paragraph | Table | TableOfContents> = [];

  // =========================================================================
  // 1. COVER PAGE
  // =========================================================================
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 600, after: 120 },
      children: [
        new TextRun({
          text: 'DELTA UNIVERSITY FOR SCIENCE AND TECHNOLOGY',
          bold: true,
          font: 'Calibri',
          size: 28,
          color: '334155',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 280 },
      children: [
        new TextRun({
          text: 'Faculty of Engineering — Department of Communications & Electronics Engineering',
          font: 'Calibri',
          size: 22,
          color: '64748B',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 240, after: 220 },
      children: [
        new TextRun({
          text: 'ECE 441 — Wireless and Mobile Communications',
          bold: true,
          font: 'Calibri',
          size: 28,
          color: '1D4ED8',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 360 },
      children: [
        new TextRun({
          text: 'Option B: Simulation-Based Technical Research Report',
          italics: true,
          font: 'Calibri',
          size: 22,
          color: '475569',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 240, after: 420 },
      children: [
        new TextRun({
          text: opts.reportTitle,
          bold: true,
          font: 'Calibri',
          size: 40,
          color: '0F172A',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
      children: [
        new TextRun({
          text: `Submission Date: ${opts.dateStr}   |   Platform: WirelessLab ECE441`,
          font: 'Calibri',
          size: 21,
          color: '475569',
        }),
      ],
    }),
    makeStyledTable(
      ['Student Name', 'Student ID', 'Role & Technical Contribution'],
      opts.teamMembers.map((m) => [m.name, m.studentId, m.contribution]),
    ),
    new Paragraph({ children: [new PageBreak()] }),
  );

  // =========================================================================
  // TABLE OF CONTENTS & EXECUTIVE SUMMARY
  // =========================================================================
  children.push(
    makeHeading('Table of Contents', HeadingLevel.HEADING_1),
    new TableOfContents('Table of Contents', {
      hyperlink: true,
      headingStyleRange: '1-3',
    }),
    makeBody(
      'Section Outline: 2. Abstract & Objectives · 3. Technical Background · 4. System Model & Equations · 5. Methodology & Assumptions · 6. Parameters & Scenarios · 7. Results & Verification · 8. Discussion · 9. Conclusions & Recommendations · 10. References · 11. Team Contributions · 12. Appendix (Parameters, Seeds & Code Excerpts).',
      180,
    ),
  );

  if (isSuite) {
    tableCounter += 1;
    children.push(
      makeHeading('Suite Verification & Reproducibility Summary', HeadingLevel.HEADING_2),
      makeStyledTable(
        ['ID', 'Module', 'Figures', 'Verify', 'Max Rel. Err', 'Seed', 'Trials / Bits'],
        opts.modules.map((m) => {
          const v = m.results.verification;
          return [
            `M${m.descriptor.number}`,
            m.descriptor.shortTitle,
            m.results.figures.length,
            v ? (v.passed ? 'PASS' : 'CHECK') : 'N/A',
            v && Number.isFinite(v.maxRelError) ? `${(v.maxRelError * 100).toFixed(2)}%` : 'N/A',
            m.results.meta.seed,
            m.results.meta.totalBitsOrTrials.toLocaleString(),
          ];
        }),
      ),
      makeCaption(`Table ${tableCounter}: Executive Verification Summary Across Simulated ECE 441 Modules.`),
    );
  }

  children.push(new Paragraph({ children: [new PageBreak()] }));

  // =========================================================================
  // 2. ABSTRACT AND OBJECTIVES
  // =========================================================================
  children.push(
    makeHeading('2. Abstract and Objectives', HeadingLevel.HEADING_1),
    makeBody(
      isSuite
        ? `This technical report documents a comprehensive Monte-Carlo simulation investigation covering ${opts.modules.length} core topics of ECE 441 (Wireless and Mobile Communications). Every experiment was executed locally with deterministic PRNG seeds, verified against closed-form analytical theory and limiting cases, and accompanied by reproducible Python and MATLAB scripts.`
        : primary.theory.abstract,
    ),
    makeHeading('2.1 Research Objectives', HeadingLevel.HEADING_2),
  );
  const objectives = isSuite
    ? opts.modules.map(
        (m) => `Module ${m.descriptor.number} (${m.descriptor.shortTitle}): ${m.descriptor.oneLineIdea}`,
      )
    : primary.theory.objectives;
  for (const obj of objectives) {
    children.push(makeBullet(obj));
  }

  // =========================================================================
  // 3. TECHNICAL BACKGROUND
  // =========================================================================
  children.push(makeHeading('3. Technical Background', HeadingLevel.HEADING_1));
  for (const mod of opts.modules) {
    if (isSuite) {
      children.push(
        makeHeading(
          `3.${mod.descriptor.number} Module ${mod.descriptor.number}: ${mod.descriptor.title}`,
          HeadingLevel.HEADING_2,
        ),
      );
    }
    for (const para of mod.theory.technicalBackground) {
      children.push(makeBody(para));
    }
  }

  // =========================================================================
  // 4. SYSTEM MODEL AND EQUATIONS
  // =========================================================================
  children.push(makeHeading('4. System Model and Equations', HeadingLevel.HEADING_1));
  let eqGlobalIdx = 0;
  for (const mod of opts.modules) {
    if (isSuite) {
      children.push(
        makeHeading(
          `4.${mod.descriptor.number} ${mod.descriptor.shortTitle} System Model`,
          HeadingLevel.HEADING_2,
        ),
      );
    }
    children.push(makeBody(mod.theory.systemModelSummary));

    for (const eq of mod.theory.equations) {
      eqGlobalIdx += 1;
      const rendered = await renderEquationToPng(
        eq.latex,
        `Equation (${eqGlobalIdx}): ${eq.title}`,
        860,
        118,
      );
      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 100, after: 60 },
          children: [
            new ImageRun({
              type: 'png',
              data: rendered.bytes,
              transformation: { width: 560, height: 77 },
            }),
          ],
        }),
        makeBody(`Equation (${eqGlobalIdx}) — ${eq.title}: ${eq.explanation}`, 140),
      );
    }
  }

  // =========================================================================
  // 5. SIMULATION METHODOLOGY AND ASSUMPTIONS
  // =========================================================================
  children.push(
    makeHeading('5. Simulation Methodology and Assumptions', HeadingLevel.HEADING_1),
    makeHeading('5.1 Monte-Carlo Simulation Methodology', HeadingLevel.HEADING_2),
  );
  for (const item of primary.theory.methodology) {
    children.push(makeBullet(item));
  }
  children.push(makeHeading('5.2 Engineering & Channel Modeling Assumptions', HeadingLevel.HEADING_2));
  for (const item of primary.theory.assumptions) {
    children.push(makeBullet(item));
  }

  // =========================================================================
  // 6. SIMULATION PARAMETERS AND SCENARIOS
  // =========================================================================
  children.push(makeHeading('6. Simulation Parameters and Scenarios', HeadingLevel.HEADING_1));
  for (const mod of opts.modules) {
    tableCounter += 1;
    const p = getEffectiveParams(mod);
    const paramRows = Object.entries(p).map(([k, v]) => [
      k,
      typeof v === 'object' ? JSON.stringify(v) : String(v),
    ]);
    if (isSuite) {
      children.push(
        makeHeading(
          `Module ${mod.descriptor.number}: ${mod.descriptor.shortTitle} Parameters`,
          HeadingLevel.HEADING_2,
        ),
      );
    }
    children.push(
      makeStyledTable(['Parameter Name', 'Configured Value'], paramRows),
      makeCaption(
        `Table ${tableCounter}: Active Simulation Parameters for Module ${mod.descriptor.number} (${mod.descriptor.shortTitle}, Seed=${mod.results.meta.seed}).`,
      ),
    );
  }

  // =========================================================================
  // 7. RESULTS, FIGURES, DATA TABLES & VERIFICATION
  // =========================================================================
  children.push(
    new Paragraph({ children: [new PageBreak()] }),
    makeHeading('7. Simulation Results and Quantitative Verification', HeadingLevel.HEADING_1),
  );

  for (const mod of opts.modules) {
    if (isSuite) {
      children.push(
        makeHeading(
          `7.${mod.descriptor.number} Module ${mod.descriptor.number}: ${mod.descriptor.title}`,
          HeadingLevel.HEADING_2,
        ),
      );
    }

    // Verification block & table
    const ver = mod.results.verification;
    if (ver) {
      tableCounter += 1;
      children.push(
        makeBody(
          `Automated Analytical Verification (${ver.passed ? 'PASS' : 'CHECK'}): ${ver.summary}`,
          100,
        ),
        makeStyledTable(
          ['Case / Operating Point', 'Simulated', 'Analytical Theory', 'Rel. Error (%)', 'Status'],
          ver.rows.slice(0, 12).map((r) => {
            const fmt = (n: number) =>
              !Number.isFinite(n)
                ? '—'
                : n === 0
                  ? '0'
                  : Math.abs(n) < 0.001 || Math.abs(n) >= 1000
                    ? n.toExponential(3)
                    : n.toFixed(5);
            return [
              r.label,
              fmt(r.simulated),
              fmt(r.theory),
              Number.isFinite(r.relError) ? `${(r.relError * 100).toFixed(2)}%` : '—',
              !r.included ? 'Skipped' : r.relError <= ver.threshold ? 'PASS' : 'CHECK',
            ];
          }),
        ),
        makeCaption(
          `Table ${tableCounter}: Simulation-vs-Theory Verification Audit for Module ${mod.descriptor.number}.`,
        ),
      );
    }

    for (const fig of mod.results.figures) {
      figCounter += 1;
      const dataUrl = preRendered[figureCacheKey(mod.descriptor.id, fig.id)];
      children.push(
        makeHeading(`Figure ${figCounter}: ${fig.title}`, HeadingLevel.HEADING_3),
      );
      if (fig.subtitle) {
        children.push(makeBody(fig.subtitle, 80));
      }
      if (dataUrl) {
        children.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 60, after: 60 },
            children: [
              new ImageRun({
                type: 'png',
                data: dataUrlToBytes(dataUrl),
                transformation: { width: 580, height: 295 },
              }),
            ],
          }),
          makeCaption(`Figure ${figCounter}: ${fig.title}`),
        );
      }

      children.push(
        new Paragraph({
          spacing: { before: 60, after: 60 },
          children: [
            new TextRun({
              text: 'Computed Key Findings:',
              bold: true,
              font: 'Calibri',
              size: 21,
              color: '1D4ED8',
            }),
          ],
        }),
      );
      for (const finding of fig.keyFindings) {
        children.push(makeBullet(finding));
      }

      if (fig.table.headers.length > 0 && fig.table.rows.length > 0) {
        tableCounter += 1;
        children.push(
          makeStyledTable(fig.table.headers, fig.table.rows.slice(0, 18)),
          makeCaption(`Table ${tableCounter}: Numerical Dataset for Figure ${figCounter} (${fig.shortTitle}).`),
        );
      }
    }
  }

  // =========================================================================
  // 8. DISCUSSION AND ENGINEERING INTERPRETATION
  // =========================================================================
  children.push(
    makeHeading('8. Discussion and Engineering Interpretation', HeadingLevel.HEADING_1),
  );
  const discParagraphs = opts.discussionText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  if (discParagraphs.length > 0) {
    for (const p of discParagraphs) {
      children.push(makeBody(p));
    }
  } else {
    for (const mod of opts.modules) {
      for (const fig of mod.results.figures) {
        for (const k of fig.keyFindings.slice(0, 2)) {
          children.push(makeBullet(k));
        }
      }
    }
  }

  // =========================================================================
  // 9. CONCLUSIONS AND RECOMMENDATIONS
  // =========================================================================
  children.push(
    makeHeading('9. Conclusions and Recommendations', HeadingLevel.HEADING_1),
  );
  const conclParagraphs = opts.conclusionsText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  if (conclParagraphs.length > 0) {
    for (const p of conclParagraphs) {
      children.push(makeBody(p));
    }
  } else {
    for (const c of primary.theory.conclusionsDefault) {
      children.push(makeBullet(c));
    }
  }

  // =========================================================================
  // 10. REFERENCES
  // =========================================================================
  children.push(makeHeading('10. References', HeadingLevel.HEADING_1));
  opts.references.forEach((ref, idx) => {
    children.push(makeBody(`[${idx + 1}] ${ref}`, 80));
  });

  // =========================================================================
  // 11. TEAM CONTRIBUTIONS
  // =========================================================================
  tableCounter += 1;
  children.push(
    makeHeading('11. Team Contributions', HeadingLevel.HEADING_1),
    makeStyledTable(
      ['Student Name', 'Student ID', 'Specific Technical Contribution'],
      opts.teamMembers.map((m) => [m.name, m.studentId, m.contribution]),
    ),
    makeCaption(`Table ${tableCounter}: ECE 441 Project Team Roster and Contributions.`),
  );

  // =========================================================================
  // 12. APPENDIX: PARAMETERS, SEEDS & REPRODUCIBLE SCRIPT EXCERPTS
  // =========================================================================
  children.push(
    new Paragraph({ children: [new PageBreak()] }),
    makeHeading('12. Appendix: Reproducibility Parameters, Seeds & Code Excerpts', HeadingLevel.HEADING_1),
    makeBody(
      'All numerical results in this report can be reproduced deterministically using the exact seeds and parameter snapshots below, either inside WirelessLab ECE441 or via the accompanying Python and MATLAB scripts.',
    ),
  );

  const appendixJson = JSON.stringify(
    opts.modules.map((m) => ({
      module: m.descriptor.id,
      title: m.descriptor.title,
      seed: m.results.meta.seed,
      timestamp: m.results.meta.timestamp,
      elapsedMs: Math.round(m.results.meta.elapsedMs),
      totalBitsOrTrials: m.results.meta.totalBitsOrTrials,
      parameters: getEffectiveParams(m),
    })),
    null,
    2,
  );
  children.push(...makeCodeBlock('Appendix A: Reproducibility Metadata & Parameter JSON', appendixJson, 55));

  const primaryParams = getEffectiveParams(primary);
  const pyScript = generatePythonScript(primary.descriptor.id, primaryParams);
  const mScript = generateMatlabScript(primary.descriptor.id, primaryParams);
  children.push(
    ...makeCodeBlock(`Appendix B: Python Reproduction Excerpt (${pyScript.filename})`, pyScript.content, 48),
    ...makeCodeBlock(`Appendix C: MATLAB Reproduction Excerpt (${mScript.filename})`, mScript.content, 44),
  );

  const doc = new Document({
    creator: opts.teamMembers.map((m) => m.name).join(', ') || 'ECE 441 Team',
    title: opts.reportTitle,
    description: 'ECE 441 Wireless and Mobile Communications Simulation Technical Report',
    features: {
      updateFields: true,
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1080, bottom: 1080, left: 1080, right: 1080 },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: 'WirelessLab ECE441 · Delta University Faculty of Engineering',
                    font: 'Calibri',
                    size: 17,
                    color: '64748B',
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: 'ECE 441 Technical Report · Page ',
                    font: 'Calibri',
                    size: 17,
                    color: '64748B',
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    font: 'Calibri',
                    size: 17,
                    color: '334155',
                  }),
                  new TextRun({
                    text: ' of ',
                    font: 'Calibri',
                    size: 17,
                    color: '64748B',
                  }),
                  new TextRun({
                    children: [PageNumber.TOTAL_PAGES],
                    font: 'Calibri',
                    size: 17,
                    color: '334155',
                  }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  opts.onProgress?.('Packaging Word (.docx) archive...');
  const ab = await Packer.toArrayBuffer(doc);
  return new Uint8Array(ab);
}

export async function generateDocxBlob(opts: SubmissionExportOptions): Promise<Blob> {
  const bytes = await generateDocxUint8Array(opts);
  return new Blob([bytes.buffer as ArrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
}
