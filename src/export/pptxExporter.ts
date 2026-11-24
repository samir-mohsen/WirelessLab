import PptxGenJS from 'pptxgenjs';
import { extractFigureDiagnostics } from '../engine/analytics';
import { getVivaQuestions } from '../engine/vivaBank';
import { renderEquationToPng } from './equationImage';
import {
  figureCacheKey,
  getEffectiveParams,
  preRenderAllFigures,
  summarizeFigureForComparison,
  type SubmissionExportOptions,
} from './types';

// Executive Academic Palette (16:9 widescreen: 13.333 x 7.5 in)
const COLORS = {
  bg: 'FFFFFF',
  surface: 'F8FAFC',
  surfaceAlt: 'F1F5F9',
  border: 'CBD5E1',
  navy: '0F172A',
  navyMid: '1E293B',
  navySoft: '1E3A8A',
  slate: '334155',
  muted: '64748B',
  accent: '2563EB',
  sky: '38BDF8',
  accentSoft: 'EFF6FF',
  emerald: '047857',
  emeraldSoft: 'ECFDF5',
  amber: 'B45309',
  amberSoft: 'FFFBEB',
  rose: 'BE123C',
  roseSoft: 'FFF1F2',
};

const FONT = 'Calibri';

function addSlideChrome(
  slide: PptxGenJS.Slide,
  sectionTag: string,
  title: string,
  slideNum: number,
  totalHint: number,
  footerLabel: string,
): void {
  // Dual-tone architectural top header bar
  slide.addShape('rect', {
    x: 0,
    y: 0,
    w: 3.4,
    h: 0.1,
    fill: { color: COLORS.navy },
    line: { color: COLORS.navy, pt: 0 },
  });
  slide.addShape('rect', {
    x: 3.4,
    y: 0,
    w: 9.933,
    h: 0.1,
    fill: { color: COLORS.accent },
    line: { color: COLORS.accent, pt: 0 },
  });

  // Section kicker tag
  slide.addText(sectionTag.toUpperCase(), {
    x: 0.52,
    y: 0.2,
    w: 9.8,
    h: 0.24,
    fontFace: FONT,
    fontSize: 9.5,
    bold: true,
    color: COLORS.accent,
    charSpacing: 1.4,
  });

  // Slide main title
  slide.addText(title, {
    x: 0.52,
    y: 0.42,
    w: 11.4,
    h: 0.48,
    fontFace: FONT,
    fontSize: 21,
    bold: true,
    color: COLORS.navy,
  });

  // Top-right course mark
  slide.addText('ECE 441', {
    x: 11.75,
    y: 0.26,
    w: 1.08,
    h: 0.32,
    fontFace: FONT,
    fontSize: 10,
    bold: true,
    align: 'center',
    valign: 'middle',
    color: COLORS.navySoft,
    fill: { color: COLORS.accentSoft },
    line: { color: 'BFDBFE', pt: 0.6 },
  });

  // Clean hairline rule
  slide.addShape('line', {
    x: 0.52,
    y: 0.98,
    w: 12.3,
    h: 0,
    line: { color: COLORS.border, pt: 0.9 },
  });

  // Footer hairline + progress bar + slide counter
  slide.addShape('line', {
    x: 0.52,
    y: 7.05,
    w: 12.3,
    h: 0,
    line: { color: COLORS.border, pt: 0.7 },
  });
  const progFrac = Math.min(1, slideNum / Math.max(totalHint, slideNum));
  slide.addShape('rect', {
    x: 0.52,
    y: 7.03,
    w: 12.3 * progFrac,
    h: 0.04,
    fill: { color: COLORS.accent },
    line: { color: COLORS.accent, pt: 0 },
  });

  slide.addText(`Delta University · Faculty of Engineering · ${footerLabel}`, {
    x: 0.52,
    y: 7.11,
    w: 10.6,
    h: 0.28,
    fontFace: FONT,
    fontSize: 8.8,
    color: COLORS.muted,
  });
  slide.addText(`${slideNum}`, {
    x: 11.9,
    y: 7.11,
    w: 0.92,
    h: 0.28,
    fontFace: FONT,
    fontSize: 9.5,
    bold: true,
    align: 'right',
    color: COLORS.navy,
  });
}

function fmtCell(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function buildSpeakerNotes(parts: Array<string | undefined>): string {
  return parts
    .filter((p): p is string => Boolean(p && p.trim()))
    .join('\n\n')
    .slice(0, 3500);
}

/**
 * Executive 16:9 PowerPoint (.pptx) presentation generator for WirelessLab ECE441.
 * Features dark navy hero cover & closing defense slides, 4-KPI executive summary cards,
 * 2-column chart + computed findings/diagnostics layout, KaTeX equation PNGs,
 * clean alternating tables, and Viva speaker notes on every slide.
 */
export async function generatePptxArrayBuffer(
  opts: SubmissionExportOptions,
): Promise<ArrayBuffer> {
  if (opts.modules.length === 0) {
    throw new Error('At least one simulated module is required to export PowerPoint.');
  }

  const preRendered = await preRenderAllFigures(
    opts.modules,
    opts.preRenderedFigures,
    opts.onProgress,
  );

  opts.onProgress?.('Designing executive PowerPoint slides & KaTeX equations...');

  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE'; // 13.333 x 7.5 inches (16:9)
  pptx.author = opts.teamMembers.map((m) => m.name).join(', ') || 'ECE 441 Team';
  pptx.company = 'Delta University for Science and Technology — Faculty of Engineering';
  pptx.subject = 'ECE 441 — Wireless and Mobile Communications';
  pptx.title = opts.reportTitle;

  const isSuite = opts.modules.length > 1;
  const primary = opts.modules[0];
  const footerLabel = isSuite
    ? `Complete Suite (${opts.modules.length} Modules)`
    : `Module ${primary.descriptor.number}: ${primary.descriptor.shortTitle}`;

  const totalFigs = opts.modules.reduce((a, m) => a + m.results.figures.length, 0);
  const totalTrials = opts.modules.reduce((a, m) => a + m.results.meta.totalBitsOrTrials, 0);
  const passedCount = opts.modules.filter((m) => m.results.verification?.passed !== false).length;

  const allEquations = opts.modules.flatMap((m) =>
    m.theory.equations.slice(0, isSuite ? 2 : 6).map((eq, idx) => ({
      modLabel: isSuite ? `M${m.descriptor.number} · ` : '',
      index: idx + 1,
      ...eq,
    })),
  );
  const eqSlideCount = Math.ceil(allEquations.length / 2);
  const estimatedTotalSlides = 12 + eqSlideCount + totalFigs;

  const allViva = opts.modules.flatMap((m) =>
    getVivaQuestions(m.descriptor.id, m.results).map((q) => ({
      moduleNum: m.descriptor.number,
      ...q,
    })),
  );
  const allKeyFindings = opts.modules.flatMap((m) =>
    m.results.figures.flatMap((f) => f.keyFindings.slice(0, 2)),
  );

  let slideCount = 0;
  const nextSlide = (bgColor = COLORS.bg): { slide: PptxGenJS.Slide; num: number } => {
    slideCount += 1;
    const slide = pptx.addSlide();
    slide.background = { color: bgColor };
    return { slide, num: slideCount };
  };

  // =========================================================================
  // SLIDE 1: EXECUTIVE DARK NAVY HERO COVER SLIDE
  // =========================================================================
  {
    const { slide } = nextSlide(COLORS.navy);

    // Architectural right geometric accent panel
    slide.addShape('rect', {
      x: 9.65,
      y: 0,
      w: 3.683,
      h: 7.5,
      fill: { color: COLORS.navyMid },
      line: { color: COLORS.navyMid, pt: 0 },
    });
    slide.addShape('rect', {
      x: 0,
      y: 0,
      w: 0.22,
      h: 7.5,
      fill: { color: COLORS.accent },
      line: { color: COLORS.accent, pt: 0 },
    });
    slide.addShape('rect', {
      x: 9.65,
      y: 0,
      w: 0.06,
      h: 7.5,
      fill: { color: COLORS.sky },
      line: { color: COLORS.sky, pt: 0 },
    });

    // University & Course Kicker
    slide.addText('DELTA UNIVERSITY FOR SCIENCE AND TECHNOLOGY', {
      x: 0.72,
      y: 0.65,
      w: 8.6,
      h: 0.32,
      fontFace: FONT,
      fontSize: 11.5,
      bold: true,
      color: COLORS.sky,
      charSpacing: 1.8,
    });
    slide.addText('Faculty of Engineering · Communications & Electronics Department', {
      x: 0.72,
      y: 0.98,
      w: 8.6,
      h: 0.28,
      fontFace: FONT,
      fontSize: 11,
      color: 'CBD5E1',
    });

    // Course Badge Pill
    slide.addShape('roundRect', {
      x: 0.72,
      y: 1.48,
      w: 6.4,
      h: 0.4,
      fill: { color: COLORS.navySoft },
      line: { color: COLORS.accent, pt: 0.8 },
      rectRadius: 0.06,
    });
    slide.addText('ECE 441 · WIRELESS & MOBILE COMMUNICATIONS (OPTION B)', {
      x: 0.86,
      y: 1.52,
      w: 6.15,
      h: 0.32,
      fontFace: FONT,
      fontSize: 10,
      bold: true,
      color: 'E0F2FE',
      valign: 'middle',
      charSpacing: 0.8,
    });

    // Main Presentation Title
    slide.addText(opts.reportTitle, {
      x: 0.72,
      y: 2.12,
      w: 8.65,
      h: 1.75,
      fontFace: FONT,
      fontSize: 31,
      bold: true,
      color: 'FFFFFF',
      valign: 'top',
    });

    // Accent Divider
    slide.addShape('rect', {
      x: 0.72,
      y: 4.02,
      w: 2.6,
      h: 0.06,
      fill: { color: COLORS.sky },
      line: { color: COLORS.sky, pt: 0 },
    });

    // Team Roster Section
    slide.addText('RESEARCH TEAM', {
      x: 0.72,
      y: 4.28,
      w: 8.5,
      h: 0.28,
      fontFace: FONT,
      fontSize: 9.5,
      bold: true,
      color: COLORS.sky,
      charSpacing: 1.4,
    });

    const teamLines = opts.teamMembers.slice(0, 6).map(
      (m) => `${m.name}  (ID: ${m.studentId}) — ${m.contribution}`,
    );
    slide.addText(
      teamLines.map((line) => ({ text: line, options: { bullet: true, breakLine: true } })),
      {
        x: 0.72,
        y: 4.6,
        w: 8.6,
        h: 2.0,
        fontFace: FONT,
        fontSize: 11.5,
        color: 'E2E8F0',
        paraSpaceAfter: 5,
      },
    );

    slide.addText(`Date: ${opts.dateStr}  ·  Platform: WirelessLab ECE441 (Deterministic Seeded Engine)`, {
      x: 0.72,
      y: 6.82,
      w: 8.6,
      h: 0.32,
      fontFace: FONT,
      fontSize: 9.5,
      color: '94A3B8',
    });

    // Right Panel: 4 Vertical Simulation Telemetry Cards
    slide.addText('SIMULATION AT A GLANCE', {
      x: 10.0,
      y: 0.68,
      w: 3.05,
      h: 0.3,
      fontFace: FONT,
      fontSize: 9.5,
      bold: true,
      color: COLORS.sky,
      charSpacing: 1.3,
    });

    const heroCards = [
      { label: 'MODULES ANALYZED', val: `${opts.modules.length}`, sub: isSuite ? 'Complete ECE 441 Suite' : `Module ${primary.descriptor.number}` },
      { label: 'RESULT FIGURES', val: `${totalFigs}`, sub: '2x High-DPI Plotly Charts' },
      { label: 'MONTE-CARLO TRIALS', val: totalTrials.toLocaleString(), sub: `Seed ${primary.results.meta.seed}${isSuite ? ' +' : ''}` },
      { label: 'THEORY VERIFICATION', val: `${passedCount}/${opts.modules.length} PASS`, sub: 'Closed-Form Validated' },
    ];

    heroCards.forEach((hc, idx) => {
      const cy = 1.2 + idx * 1.45;
      slide.addShape('roundRect', {
        x: 10.0,
        y: cy,
        w: 3.0,
        h: 1.22,
        fill: { color: COLORS.navy },
        line: { color: '334155', pt: 0.9 },
        rectRadius: 0.08,
      });
      slide.addText(hc.label, {
        x: 10.18,
        y: cy + 0.14,
        w: 2.65,
        h: 0.22,
        fontFace: FONT,
        fontSize: 8.2,
        bold: true,
        color: '94A3B8',
        charSpacing: 1,
      });
      slide.addText(hc.val, {
        x: 10.18,
        y: cy + 0.38,
        w: 2.65,
        h: 0.44,
        fontFace: FONT,
        fontSize: 20,
        bold: true,
        color: idx === 3 ? '34D399' : 'FFFFFF',
      });
      slide.addText(hc.sub, {
        x: 10.18,
        y: cy + 0.86,
        w: 2.65,
        h: 0.24,
        fontFace: FONT,
        fontSize: 9,
        color: 'CBD5E1',
      });
    });

    slide.addNotes(
      buildSpeakerNotes([
        `OPENING (1 min): Welcome examiners to our ECE 441 presentation on ${opts.reportTitle}.`,
        `Key headline takeaway: ${allKeyFindings[0] ?? primary.theory.abstract}`,
        allViva[0] ? `Anticipated Opening Question: ${allViva[0].question}\nModel Answer: ${allViva[0].answer}` : undefined,
      ]),
    );
  }

  // =========================================================================
  // SLIDE 2: AGENDA & TALK TIMELINE (20-25 MIN)
  // =========================================================================
  {
    const { slide, num } = nextSlide();
    addSlideChrome(slide, 'Presentation Roadmap', 'Agenda & 20–25 Minute Talk Structure', num, estimatedTotalSlides, footerLabel);

    const agendaItems = [
      ['01', 'Objectives & Technical Background', 'Wireless channel challenges and research motivation', '3 min'],
      ['02', 'System Model & Governing Equations', 'Mathematical formulation and closed-form analytical bounds', '4 min'],
      ['03', 'Simulation Methodology & Parameters', 'Monte-Carlo engine, deterministic seeds, modeling assumptions', '3 min'],
      ['04', 'Experimental Results & Diagnostics', `${totalFigs} quantitative figures with computed findings & curve fits`, '8 min'],
      ['05', 'Theory Verification & Trade-Offs', 'Simulated vs closed-form error audit & configuration matrix', '3 min'],
      ['06', 'Discussion, Conclusions & Defense Q&A', 'Design recommendations and examiner oral defense', '4 min'],
    ];

    const tableRows: PptxGenJS.TableRow[] = [
      [
        { text: '#', options: { bold: true, color: 'FFFFFF', fill: { color: COLORS.navy }, align: 'center' } },
        { text: 'Section', options: { bold: true, color: 'FFFFFF', fill: { color: COLORS.navy } } },
        { text: 'Key Deliverables', options: { bold: true, color: 'FFFFFF', fill: { color: COLORS.navy } } },
        { text: 'Budget', options: { bold: true, color: 'FFFFFF', fill: { color: COLORS.navy }, align: 'center' } },
      ],
      ...agendaItems.map((row, i) =>
        row.map((cell, ci) => ({
          text: cell,
          options: {
            fill: { color: i % 2 === 0 ? COLORS.surface : COLORS.bg },
            color: ci === 0 ? COLORS.accent : ci === 3 ? COLORS.navySoft : COLORS.navy,
            bold: ci <= 1 || ci === 3,
            align: (ci === 0 || ci === 3 ? 'center' : 'left') as 'center' | 'left',
          },
        })),
      ),
    ];

    slide.addTable(tableRows, {
      x: 0.55,
      y: 1.28,
      w: 12.22,
      colW: [0.85, 3.85, 6.22, 1.3],
      fontFace: FONT,
      fontSize: 13,
      border: { type: 'solid', color: COLORS.border, pt: 0.7 },
      margin: [0.12, 0.14, 0.12, 0.14],
    });

    slide.addNotes(
      buildSpeakerNotes([
        'AGENDA (0.5 min): Walk briefly through the 6 sections totaling ~25 minutes, reserving 4 minutes for examiner Q&A.',
        `Modules covered: ${opts.modules.map((m) => `Module ${m.descriptor.number} (${m.descriptor.shortTitle})`).join('; ')}.`,
      ]),
    );
  }

  // =========================================================================
  // SLIDE 3: OBJECTIVES & ABSTRACT
  // =========================================================================
  {
    const { slide, num } = nextSlide();
    addSlideChrome(slide, 'Research Scope', 'Abstract & Specific Simulation Objectives', num, estimatedTotalSlides, footerLabel);

    // Abstract highlight card with left blue accent bar
    slide.addShape('roundRect', {
      x: 0.55,
      y: 1.22,
      w: 12.22,
      h: 1.48,
      fill: { color: COLORS.accentSoft },
      line: { color: 'BFDBFE', pt: 0.9 },
      rectRadius: 0.06,
    });
    slide.addShape('rect', {
      x: 0.55,
      y: 1.22,
      w: 0.1,
      h: 1.48,
      fill: { color: COLORS.accent },
      line: { color: COLORS.accent, pt: 0 },
    });
    slide.addText(
      isSuite
        ? `This research portfolio evaluates ${opts.modules.length} core ECE 441 wireless communication systems via browser-local Monte-Carlo simulation, rigorous closed-form theory verification, and automated parameter-sensitivity diagnostics.`
        : primary.theory.abstract,
      {
        x: 0.85,
        y: 1.32,
        w: 11.7,
        h: 1.28,
        fontFace: FONT,
        fontSize: 12.5,
        color: COLORS.navy,
        valign: 'middle',
      },
    );

    const objectives = isSuite
      ? opts.modules.map(
          (m) => `Module ${m.descriptor.number} (${m.descriptor.shortTitle}): ${m.descriptor.oneLineIdea}`,
        )
      : primary.theory.objectives;

    slide.addText('SPECIFIC RESEARCH OBJECTIVES', {
      x: 0.55,
      y: 2.95,
      w: 12.0,
      h: 0.3,
      fontFace: FONT,
      fontSize: 10.5,
      bold: true,
      color: COLORS.accent,
      charSpacing: 1.2,
    });

    // Two-column objective cards when >= 4 objectives, clean list otherwise
    const shownObjs = objectives.slice(0, 8);
    if (shownObjs.length >= 4) {
      const half = Math.ceil(shownObjs.length / 2);
      const leftObjs = shownObjs.slice(0, half);
      const rightObjs = shownObjs.slice(half);

      const renderObjCol = (list: string[], colX: number, offset: number) => {
        list.forEach((obj, idx) => {
          const yCard = 3.35 + idx * 0.88;
          slide.addShape('roundRect', {
            x: colX,
            y: yCard,
            w: 5.95,
            h: 0.76,
            fill: { color: COLORS.surface },
            line: { color: COLORS.border, pt: 0.7 },
            rectRadius: 0.05,
          });
          slide.addText(`${offset + idx + 1}`, {
            x: colX + 0.14,
            y: yCard + 0.18,
            w: 0.4,
            h: 0.4,
            fontFace: FONT,
            fontSize: 11,
            bold: true,
            align: 'center',
            valign: 'middle',
            color: 'FFFFFF',
            fill: { color: COLORS.accent },
          });
          slide.addText(obj, {
            x: colX + 0.66,
            y: yCard + 0.08,
            w: 5.15,
            h: 0.6,
            fontFace: FONT,
            fontSize: 11,
            color: COLORS.navy,
            valign: 'middle',
          });
        });
      };
      renderObjCol(leftObjs, 0.55, 0);
      renderObjCol(rightObjs, 6.82, half);
    } else {
      slide.addText(
        shownObjs.map((o) => ({ text: o, options: { bullet: true, breakLine: true } })),
        {
          x: 0.65,
          y: 3.35,
          w: 12.0,
          h: 3.4,
          fontFace: FONT,
          fontSize: 13.5,
          color: COLORS.slate,
          paraSpaceAfter: 9,
        },
      );
    }

    slide.addNotes(
      buildSpeakerNotes([
        'OBJECTIVES (1.5 min): State the engineering problem clearly and emphasize that every numerical result is verified against closed-form theory.',
        allViva[1] ? `Viva Link — ${allViva[1].question}\nAnswer: ${allViva[1].answer}` : undefined,
      ]),
    );
  }

  // =========================================================================
  // SLIDE 4: TECHNICAL BACKGROUND
  // =========================================================================
  {
    const { slide, num } = nextSlide();
    addSlideChrome(slide, 'Theoretical Context', 'Technical Background & Wireless Channel Physics', num, estimatedTotalSlides, footerLabel);

    const bgParagraphs = (isSuite
      ? opts.modules.slice(0, 6).map(
          (m) => `Module ${m.descriptor.number} (${m.descriptor.shortTitle}): ${m.theory.technicalBackground[0] ?? m.theory.abstract}`,
        )
      : primary.theory.technicalBackground
    ).slice(0, 4);

    bgParagraphs.forEach((para, idx) => {
      const boxH = bgParagraphs.length <= 3 ? 1.65 : 1.25;
      const yBox = 1.25 + idx * (boxH + 0.16);
      slide.addShape('roundRect', {
        x: 0.55,
        y: yBox,
        w: 12.22,
        h: boxH,
        fill: { color: idx % 2 === 0 ? COLORS.surface : COLORS.bg },
        line: { color: COLORS.border, pt: 0.75 },
        rectRadius: 0.06,
      });
      slide.addShape('rect', {
        x: 0.55,
        y: yBox,
        w: 0.09,
        h: boxH,
        fill: { color: idx % 2 === 0 ? COLORS.accent : COLORS.navy },
        line: { color: idx % 2 === 0 ? COLORS.accent : COLORS.navy, pt: 0 },
      });
      slide.addText(para, {
        x: 0.82,
        y: yBox + 0.12,
        w: 11.75,
        h: boxH - 0.24,
        fontFace: FONT,
        fontSize: bgParagraphs.length <= 3 ? 13 : 11.8,
        color: COLORS.slate,
        valign: 'middle',
      });
    });

    slide.addNotes(
      buildSpeakerNotes([
        'TECHNICAL BACKGROUND (2 min): Connect the physical wireless channel phenomena to practical 4G LTE / 5G NR cellular deployments.',
        allViva[2] ? `Viva Link — ${allViva[2].question}\nAnswer: ${allViva[2].answer}` : undefined,
      ]),
    );
  }

  // =========================================================================
  // SLIDE 5+: SYSTEM MODEL & GOVERNING EQUATIONS (KaTeX PNG Cards)
  // =========================================================================
  const EQ_PER_SLIDE = 2;
  for (let i = 0; i < allEquations.length; i += EQ_PER_SLIDE) {
    const chunk = allEquations.slice(i, i + EQ_PER_SLIDE);
    const { slide, num } = nextSlide();
    const partSuffix =
      allEquations.length > EQ_PER_SLIDE
        ? ` (${Math.floor(i / EQ_PER_SLIDE) + 1}/${Math.ceil(allEquations.length / EQ_PER_SLIDE)})`
        : '';
    addSlideChrome(
      slide,
      'Mathematical Formulation',
      `System Model & Governing Equations${partSuffix}`,
      num,
      estimatedTotalSlides,
      footerLabel,
    );

    if (i === 0) {
      slide.addShape('roundRect', {
        x: 0.55,
        y: 1.14,
        w: 12.22,
        h: 0.72,
        fill: { color: COLORS.surfaceAlt },
        line: { color: COLORS.border, pt: 0.6 },
        rectRadius: 0.05,
      });
      slide.addText(primary.theory.systemModelSummary, {
        x: 0.72,
        y: 1.18,
        w: 11.88,
        h: 0.64,
        fontFace: FONT,
        fontSize: 11.2,
        italic: true,
        color: COLORS.slate,
        valign: 'middle',
      });
    }

    const startY = i === 0 ? 2.02 : 1.25;
    for (let j = 0; j < chunk.length; j++) {
      const eq = chunk[j];
      const yPos = startY + j * 2.48;
      slide.addShape('roundRect', {
        x: 0.55,
        y: yPos,
        w: 12.22,
        h: 2.3,
        fill: { color: COLORS.bg },
        line: { color: COLORS.border, pt: 0.85 },
        rectRadius: 0.06,
      });
      slide.addShape('rect', {
        x: 0.55,
        y: yPos,
        w: 0.1,
        h: 2.3,
        fill: { color: COLORS.accent },
        line: { color: COLORS.accent, pt: 0 },
      });

      const rendered = await renderEquationToPng(
        eq.latex,
        `${eq.modLabel}(${eq.index}) ${eq.title}`,
        940,
        128,
      );
      slide.addImage({
        data: rendered.dataUrl,
        x: 0.78,
        y: yPos + 0.1,
        w: 11.8,
        h: 1.54,
        sizing: { type: 'contain', w: 11.8, h: 1.54 },
      });
      slide.addText(eq.explanation, {
        x: 0.82,
        y: yPos + 1.68,
        w: 11.72,
        h: 0.54,
        fontFace: FONT,
        fontSize: 11,
        color: COLORS.slate,
        valign: 'middle',
      });
    }

    const vivaIdx = Math.min(allViva.length - 1, 2 + Math.floor(i / EQ_PER_SLIDE));
    slide.addNotes(
      buildSpeakerNotes([
        'SYSTEM MODEL (2 min): Explain each symbol and physical meaning rather than reading symbols verbatim.',
        `Equations on this slide: ${chunk.map((c) => c.title).join('; ')}.`,
        allViva[vivaIdx]
          ? `Examiner Follow-up: ${allViva[vivaIdx].question}\nModel Answer: ${allViva[vivaIdx].answer}`
          : undefined,
      ]),
    );
  }

  // =========================================================================
  // METHODOLOGY & ASSUMPTIONS (Two-Card Layout with Accent Header Caps)
  // =========================================================================
  {
    const { slide, num } = nextSlide();
    addSlideChrome(
      slide,
      'Experimental Design',
      'Simulation Methodology & Modeling Assumptions',
      num,
      estimatedTotalSlides,
      footerLabel,
    );

    // Left Card: Methodology
    slide.addShape('roundRect', {
      x: 0.55,
      y: 1.24,
      w: 5.95,
      h: 5.56,
      fill: { color: COLORS.surface },
      line: { color: COLORS.border, pt: 0.85 },
      rectRadius: 0.08,
    });
    slide.addShape('rect', {
      x: 0.55,
      y: 1.24,
      w: 5.95,
      h: 0.52,
      fill: { color: COLORS.navy },
      line: { color: COLORS.navy, pt: 0 },
    });
    slide.addText('SIMULATION METHODOLOGY', {
      x: 0.78,
      y: 1.32,
      w: 5.5,
      h: 0.36,
      fontFace: FONT,
      fontSize: 12,
      bold: true,
      color: 'FFFFFF',
      valign: 'middle',
      charSpacing: 1,
    });
    slide.addText(
      primary.theory.methodology.slice(0, 6).map((m) => ({
        text: m,
        options: { bullet: true, breakLine: true },
      })),
      {
        x: 0.78,
        y: 1.92,
        w: 5.5,
        h: 4.7,
        fontFace: FONT,
        fontSize: 12,
        color: COLORS.navy,
        paraSpaceAfter: 9,
      },
    );

    // Right Card: Assumptions
    slide.addShape('roundRect', {
      x: 6.82,
      y: 1.24,
      w: 5.95,
      h: 5.56,
      fill: { color: COLORS.surface },
      line: { color: COLORS.border, pt: 0.85 },
      rectRadius: 0.08,
    });
    slide.addShape('rect', {
      x: 6.82,
      y: 1.24,
      w: 5.95,
      h: 0.52,
      fill: { color: COLORS.accent },
      line: { color: COLORS.accent, pt: 0 },
    });
    slide.addText('KEY MODELING ASSUMPTIONS', {
      x: 7.05,
      y: 1.32,
      w: 5.5,
      h: 0.36,
      fontFace: FONT,
      fontSize: 12,
      bold: true,
      color: 'FFFFFF',
      valign: 'middle',
      charSpacing: 1,
    });
    slide.addText(
      primary.theory.assumptions.slice(0, 6).map((a) => ({
        text: a,
        options: { bullet: true, breakLine: true },
      })),
      {
        x: 7.05,
        y: 1.92,
        w: 5.5,
        h: 4.7,
        fontFace: FONT,
        fontSize: 12,
        color: COLORS.slate,
        paraSpaceAfter: 9,
      },
    );

    slide.addNotes(
      buildSpeakerNotes([
        'METHODOLOGY (2 min): Highlight deterministic xoshiro128** PRNG seeds, Box-Muller Gaussian generation, Wilson 95% confidence intervals, and Web Worker parallelism.',
        allViva[3] ? `Examiner Q&A: ${allViva[3].question}\nModel Answer: ${allViva[3].answer}` : undefined,
      ]),
    );
  }

  // =========================================================================
  // PARAMETER TABLE SLIDE
  // =========================================================================
  {
    const { slide, num } = nextSlide();
    addSlideChrome(slide, 'Reproducibility', 'Simulation Parameters & Deterministic Seeds', num, estimatedTotalSlides, footerLabel);

    const paramRows: PptxGenJS.TableRow[] = [
      [
        { text: isSuite ? 'Module' : 'Parameter', options: { bold: true, color: 'FFFFFF', fill: { color: COLORS.navy } } },
        { text: isSuite ? 'RNG Seed' : 'Configured Value', options: { bold: true, color: 'FFFFFF', fill: { color: COLORS.navy } } },
        ...(isSuite
          ? [
              { text: 'Trials / Bits', options: { bold: true, color: 'FFFFFF', fill: { color: COLORS.navy }, align: 'right' as const } },
              { text: 'Active Configuration Highlights', options: { bold: true, color: 'FFFFFF', fill: { color: COLORS.navy } } },
            ]
          : []),
      ],
    ];

    if (isSuite) {
      opts.modules.forEach((m, idx) => {
        const p = getEffectiveParams(m);
        const summary = Object.entries(p)
          .filter(([k]) => k !== 'seed' && k !== 'quickMode' && k !== 'earlyStop')
          .slice(0, 5)
          .map(([k, v]) => `${k}=${fmtCell(v)}`)
          .join(', ');
        const fill = { color: idx % 2 === 0 ? COLORS.surface : COLORS.bg };
        paramRows.push([
          { text: `M${m.descriptor.number}: ${m.descriptor.shortTitle}`, options: { bold: true, color: COLORS.navy, fill } },
          { text: String(m.results.meta.seed), options: { color: COLORS.accent, bold: true, fill } },
          { text: m.results.meta.totalBitsOrTrials.toLocaleString(), options: { color: COLORS.slate, align: 'right', fill } },
          { text: summary, options: { color: COLORS.slate, fill } },
        ]);
      });
    } else {
      const entries = Object.entries(getEffectiveParams(primary)).slice(0, 14);
      entries.forEach(([k, v], idx) => {
        const fill = { color: idx % 2 === 0 ? COLORS.surface : COLORS.bg };
        paramRows.push([
          { text: k, options: { bold: true, color: COLORS.navy, fill } },
          { text: fmtCell(v), options: { color: COLORS.slate, fill } },
        ]);
      });
    }

    slide.addTable(paramRows, {
      x: 0.55,
      y: 1.22,
      w: 12.22,
      colW: isSuite ? [3.1, 1.35, 1.75, 6.02] : [4.6, 7.62],
      fontFace: FONT,
      fontSize: isSuite ? 10.5 : 11.5,
      border: { type: 'solid', color: COLORS.border, pt: 0.6 },
      margin: [0.07, 0.1, 0.07, 0.1],
    });

    slide.addNotes(
      buildSpeakerNotes([
        `PARAMETERS (1 min): All runs are 100% reproducible using fixed RNG seeds (${opts.modules.map((m) => `M${m.descriptor.number}=${m.results.meta.seed}`).join(', ')}).`,
        `Total simulated bits/trials: ${totalTrials.toLocaleString()}.`,
      ]),
    );
  }

  // =========================================================================
  // RESULT FIGURE SLIDES — EXECUTIVE 2-COLUMN LAYOUT (PLOT + INSIGHTS SIDEBAR)
  // =========================================================================
  let figGlobalIdx = 0;
  for (const mod of opts.modules) {
    const modViva = getVivaQuestions(mod.descriptor.id, mod.results);
    for (const fig of mod.results.figures) {
      figGlobalIdx += 1;
      const { slide, num } = nextSlide();
      const figTitle = isSuite
        ? `Figure ${figGlobalIdx} (M${mod.descriptor.number}): ${fig.title}`
        : `Figure ${figGlobalIdx}: ${fig.title}`;
      addSlideChrome(
        slide,
        `Simulation Result · Module ${mod.descriptor.number}`,
        figTitle,
        num,
        estimatedTotalSlides,
        footerLabel,
      );

      // Left Framed Plot Container (8.45 x 5.72 in)
      slide.addShape('roundRect', {
        x: 0.52,
        y: 1.15,
        w: 8.48,
        h: 5.72,
        fill: { color: COLORS.bg },
        line: { color: COLORS.border, pt: 0.85 },
        rectRadius: 0.06,
      });

      const pngDataUrl = preRendered[figureCacheKey(mod.descriptor.id, fig.id)];
      if (pngDataUrl) {
        slide.addImage({
          data: pngDataUrl,
          x: 0.62,
          y: 1.24,
          w: 8.28,
          h: 5.54,
          sizing: { type: 'contain', w: 8.28, h: 5.54 },
        });
      }

      // Right Key Findings & Automated Diagnostics Sidebar (3.64 x 5.72 in)
      slide.addShape('roundRect', {
        x: 9.18,
        y: 1.15,
        w: 3.64,
        h: 5.72,
        fill: { color: COLORS.surface },
        line: { color: COLORS.border, pt: 0.85 },
        rectRadius: 0.06,
      });
      slide.addShape('rect', {
        x: 9.18,
        y: 1.15,
        w: 3.64,
        h: 0.44,
        fill: { color: COLORS.navy },
        line: { color: COLORS.navy, pt: 0 },
      });
      slide.addText('COMPUTED KEY FINDINGS', {
        x: 9.34,
        y: 1.21,
        w: 3.3,
        h: 0.32,
        fontFace: FONT,
        fontSize: 9.8,
        bold: true,
        color: 'FFFFFF',
        valign: 'middle',
        charSpacing: 1,
      });

      const diag = extractFigureDiagnostics(fig);
      const hasDiag = Boolean(diag && diag.items.length > 0);

      slide.addText(
        fig.keyFindings.slice(0, hasDiag ? 3 : 4).map((k) => ({
          text: k,
          options: { bullet: true, breakLine: true },
        })),
        {
          x: 9.32,
          y: 1.68,
          w: 3.36,
          h: hasDiag ? 2.95 : 5.0,
          fontFace: FONT,
          fontSize: 10.2,
          color: COLORS.navy,
          paraSpaceAfter: 6,
          valign: 'top',
        },
      );

      // Automated Curve-Fitting Diagnostics mini-card at bottom of sidebar
      if (diag && diag.items.length > 0) {
        slide.addShape('line', {
          x: 9.34,
          y: 4.72,
          w: 3.32,
          h: 0,
          line: { color: COLORS.border, pt: 0.7 },
        });
        slide.addText('CURVE-FITTING DIAGNOSTICS', {
          x: 9.34,
          y: 4.8,
          w: 3.32,
          h: 0.24,
          fontFace: FONT,
          fontSize: 8.5,
          bold: true,
          color: COLORS.accent,
          charSpacing: 0.9,
        });

        const diagRows: PptxGenJS.TableRow[] = [
          [
            { text: 'Curve', options: { bold: true, color: 'FFFFFF', fill: { color: COLORS.navySoft } } },
            { text: 'Metric', options: { bold: true, color: 'FFFFFF', fill: { color: COLORS.navySoft }, align: 'right' } },
          ],
          ...diag.items.slice(0, 4).map((item, i) => {
            const fill = { color: i % 2 === 0 ? COLORS.bg : COLORS.accentSoft };
            return [
              { text: item.traceName.slice(0, 18), options: { color: COLORS.navy, bold: true, fill } },
              {
                text: item.deltaVsBaseline
                  ? `${item.valueText} (${item.deltaVsBaseline.replace(' gain', '')})`
                  : item.valueText,
                options: { color: COLORS.emerald, bold: true, align: 'right' as const, fill },
              },
            ];
          }),
        ];

        slide.addTable(diagRows, {
          x: 9.32,
          y: 5.08,
          w: 3.36,
          colW: [1.58, 1.78],
          fontFace: FONT,
          fontSize: 8.5,
          border: { type: 'solid', color: COLORS.border, pt: 0.5 },
          margin: [0.04, 0.06, 0.04, 0.06],
        });
      }

      const linkedViva =
        modViva.find((v) => v.figureId === fig.id) ?? modViva[figGlobalIdx % Math.max(modViva.length, 1)];
      slide.addNotes(
        buildSpeakerNotes([
          `FIGURE ${figGlobalIdx} TALKING POINTS (1.5 min): ${fig.subtitle ?? fig.title}`,
          `Computed Key Findings:\n- ${fig.keyFindings.join('\n- ')}`,
          linkedViva
            ? `Viva Question for this Figure: ${linkedViva.question}\nModel Answer: ${linkedViva.answer}`
            : undefined,
        ]),
      );
    }
  }

  // =========================================================================
  // VERIFICATION SLIDE (Sim vs Theory + Max Relative Error)
  // =========================================================================
  {
    const { slide, num } = nextSlide();
    addSlideChrome(
      slide,
      'Analytical Validation',
      'Verification Against Closed-Form Theory & Limiting Cases',
      num,
      estimatedTotalSlides,
      footerLabel,
    );

    const ver = primary.results.verification;
    const allPassed = opts.modules.every((m) => m.results.verification?.passed !== false);

    slide.addShape('roundRect', {
      x: 0.55,
      y: 1.18,
      w: 12.22,
      h: 0.68,
      fill: { color: allPassed ? COLORS.emeraldSoft : COLORS.roseSoft },
      line: { color: allPassed ? COLORS.emerald : COLORS.rose, pt: 1 },
      rectRadius: 0.06,
    });
    const bannerMsg = isSuite
      ? `Suite Verification: ${passedCount}/${opts.modules.length} modules PASS automated tolerance check (<= 15% relative error on reliable points).`
      : ver
        ? `${ver.passed ? 'PASS' : 'CHECK'}: ${ver.summary}`
        : 'Verification check available via Self-Test.';
    slide.addText(bannerMsg, {
      x: 0.78,
      y: 1.28,
      w: 11.78,
      h: 0.48,
      fontFace: FONT,
      fontSize: 12,
      bold: true,
      color: allPassed ? COLORS.emerald : COLORS.rose,
      valign: 'middle',
    });

    const vTableRows: PptxGenJS.TableRow[] = [];
    if (isSuite) {
      vTableRows.push([
        { text: 'Module', options: { bold: true, color: 'FFFFFF', fill: { color: COLORS.navy } } },
        { text: 'Max Rel. Error', options: { bold: true, color: 'FFFFFF', fill: { color: COLORS.navy }, align: 'right' } },
        { text: 'Reliable Pts', options: { bold: true, color: 'FFFFFF', fill: { color: COLORS.navy }, align: 'center' } },
        { text: 'Status', options: { bold: true, color: 'FFFFFF', fill: { color: COLORS.navy }, align: 'center' } },
        { text: 'Verification Summary', options: { bold: true, color: 'FFFFFF', fill: { color: COLORS.navy } } },
      ]);
      opts.modules.forEach((m, idx) => {
        const mv = m.results.verification;
        const fill = { color: idx % 2 === 0 ? COLORS.surface : COLORS.bg };
        vTableRows.push([
          { text: `M${m.descriptor.number}: ${m.descriptor.shortTitle}`, options: { bold: true, color: COLORS.navy, fill } },
          {
            text: mv && Number.isFinite(mv.maxRelError) ? `${(mv.maxRelError * 100).toFixed(2)}%` : '—',
            options: { color: COLORS.navy, align: 'right', fill },
          },
          {
            text: mv ? `${mv.pointsUsed}/${mv.totalPoints}` : '—',
            options: { color: COLORS.slate, align: 'center', fill },
          },
          {
            text: mv ? (mv.passed ? 'PASS' : 'CHECK') : '—',
            options: { bold: true, color: mv?.passed ? COLORS.emerald : COLORS.rose, align: 'center', fill },
          },
          { text: mv?.summary ?? 'Not run', options: { color: COLORS.slate, fill } },
        ]);
      });
    } else if (ver) {
      vTableRows.push([
        { text: 'Verification Point', options: { bold: true, color: 'FFFFFF', fill: { color: COLORS.navy } } },
        { text: 'Simulated', options: { bold: true, color: 'FFFFFF', fill: { color: COLORS.navy }, align: 'right' } },
        { text: 'Theory', options: { bold: true, color: 'FFFFFF', fill: { color: COLORS.navy }, align: 'right' } },
        { text: 'Rel. Error %', options: { bold: true, color: 'FFFFFF', fill: { color: COLORS.navy }, align: 'right' } },
        { text: 'Status', options: { bold: true, color: 'FFFFFF', fill: { color: COLORS.navy }, align: 'center' } },
      ]);
      ver.rows.slice(0, 10).forEach((r, idx) => {
        const fill = { color: idx % 2 === 0 ? COLORS.surface : COLORS.bg };
        const fmt = (n: number) =>
          !Number.isFinite(n) ? '—' : n === 0 ? '0' : Math.abs(n) < 0.001 || Math.abs(n) >= 1000 ? n.toExponential(3) : n.toFixed(5);
        const pass = r.included && r.relError <= ver.threshold;
        vTableRows.push([
          { text: `${r.label} (${r.point})`, options: { color: COLORS.navy, fill } },
          { text: fmt(r.simulated), options: { color: COLORS.navy, align: 'right', fill } },
          { text: fmt(r.theory), options: { color: COLORS.slate, align: 'right', fill } },
          {
            text: Number.isFinite(r.relError) ? `${(r.relError * 100).toFixed(2)}%` : '—',
            options: { color: COLORS.navy, align: 'right', fill },
          },
          {
            text: !r.included ? 'Skipped' : pass ? 'PASS' : 'CHECK',
            options: {
              bold: true,
              color: !r.included ? COLORS.muted : pass ? COLORS.emerald : COLORS.rose,
              align: 'center',
              fill,
            },
          },
        ]);
      });
    }

    if (vTableRows.length > 0) {
      slide.addTable(vTableRows, {
        x: 0.55,
        y: 2.02,
        w: 12.22,
        colW: isSuite ? [2.85, 1.4, 1.3, 1.0, 5.67] : [4.42, 2.0, 2.0, 1.9, 1.9],
        fontFace: FONT,
        fontSize: 10.5,
        border: { type: 'solid', color: COLORS.border, pt: 0.6 },
        margin: [0.07, 0.09, 0.07, 0.09],
      });
    }

    slide.addNotes(
      buildSpeakerNotes([
        'VERIFICATION (1.5 min): Emphasize why verification against closed-form theory proves the simulator has no scaling, normalization, or SNR bugs.',
        bannerMsg,
      ]),
    );
  }

  // =========================================================================
  // COMPARISON / TRADE-OFF TABLE SLIDE
  // =========================================================================
  {
    const { slide, num } = nextSlide();
    addSlideChrome(
      slide,
      'Engineering Synthesis',
      'Configuration Comparison & System Trade-Offs',
      num,
      estimatedTotalSlides,
      footerLabel,
    );

    const compRows: PptxGenJS.TableRow[] = [
      [
        { text: 'Experiment / Figure', options: { bold: true, color: 'FFFFFF', fill: { color: COLORS.navy } } },
        { text: 'Computed Quantitative Takeaway', options: { bold: true, color: 'FFFFFF', fill: { color: COLORS.navy } } },
      ],
    ];

    const compFigs = opts.modules.flatMap((m) =>
      m.results.figures.slice(0, isSuite ? 1 : 6).map((f) => ({
        label: isSuite ? `M${m.descriptor.number}: ${f.shortTitle}` : f.shortTitle,
        takeaway: summarizeFigureForComparison(f),
      })),
    );

    compFigs.slice(0, 8).forEach((item, idx) => {
      const fill = { color: idx % 2 === 0 ? COLORS.surface : COLORS.bg };
      compRows.push([
        { text: item.label, options: { bold: true, color: COLORS.navy, fill } },
        { text: item.takeaway, options: { color: COLORS.slate, fill } },
      ]);
    });

    slide.addTable(compRows, {
      x: 0.55,
      y: 1.25,
      w: 12.22,
      colW: [3.4, 8.82],
      fontFace: FONT,
      fontSize: 11.2,
      border: { type: 'solid', color: COLORS.border, pt: 0.6 },
      margin: [0.08, 0.12, 0.08, 0.12],
    });

    slide.addNotes(
      buildSpeakerNotes([
        'TRADE-OFF SUMMARY (1.5 min): Synthesize the engineering trade-offs (reliability vs spectral efficiency vs complexity vs fairness).',
        allViva[4] ? `Viva Link: ${allViva[4].question}\nAnswer: ${allViva[4].answer}` : undefined,
      ]),
    );
  }

  // =========================================================================
  // DISCUSSION SLIDE
  // =========================================================================
  {
    const { slide, num } = nextSlide();
    addSlideChrome(slide, 'Engineering Interpretation', 'Discussion of Simulation Results', num, estimatedTotalSlides, footerLabel);

    const discLines = (opts.discussionText.trim()
      ? opts.discussionText.split('\n').map((l) => l.trim()).filter(Boolean)
      : allKeyFindings.slice(0, 6)
    ).slice(0, 6);

    slide.addShape('roundRect', {
      x: 0.55,
      y: 1.24,
      w: 12.22,
      h: 5.55,
      fill: { color: COLORS.surface },
      line: { color: COLORS.border, pt: 0.75 },
      rectRadius: 0.06,
    });
    slide.addText(
      discLines.map((line) => ({ text: line, options: { bullet: true, breakLine: true } })),
      {
        x: 0.8,
        y: 1.44,
        w: 11.72,
        h: 5.15,
        fontFace: FONT,
        fontSize: 12.5,
        color: COLORS.navy,
        paraSpaceAfter: 10,
      },
    );

    slide.addNotes(
      buildSpeakerNotes([
        'DISCUSSION (2 min): Interpret why the simulated curves behave as observed and discuss practical wireless system design limits.',
        discLines.join('\n'),
      ]),
    );
  }

  // =========================================================================
  // CONCLUSIONS & RECOMMENDATIONS SLIDE
  // =========================================================================
  {
    const { slide, num } = nextSlide();
    addSlideChrome(slide, 'Key Takeaways', 'Conclusions & Engineering Recommendations', num, estimatedTotalSlides, footerLabel);

    const conclLines = (opts.conclusionsText.trim()
      ? opts.conclusionsText.split('\n').map((l) => l.trim()).filter(Boolean)
      : primary.theory.conclusionsDefault
    ).slice(0, 6);

    conclLines.forEach((line, idx) => {
      const yRow = 1.24 + idx * 0.92;
      slide.addShape('roundRect', {
        x: 0.55,
        y: yRow,
        w: 12.22,
        h: 0.8,
        fill: { color: idx % 2 === 0 ? COLORS.accentSoft : COLORS.surface },
        line: { color: idx % 2 === 0 ? 'BFDBFE' : COLORS.border, pt: 0.7 },
        rectRadius: 0.05,
      });
      slide.addText(`0${idx + 1}`, {
        x: 0.72,
        y: yRow + 0.18,
        w: 0.52,
        h: 0.44,
        fontFace: FONT,
        fontSize: 11.5,
        bold: true,
        align: 'center',
        valign: 'middle',
        color: 'FFFFFF',
        fill: { color: COLORS.navy },
      });
      slide.addText(line, {
        x: 1.4,
        y: yRow + 0.08,
        w: 11.2,
        h: 0.64,
        fontFace: FONT,
        fontSize: 12,
        color: COLORS.navy,
        valign: 'middle',
      });
    });

    slide.addNotes(
      buildSpeakerNotes([
        'CONCLUSIONS (1.5 min): Close with concrete quantitative design recommendations backed by your figures.',
        conclLines.join('\n'),
      ]),
    );
  }

  // =========================================================================
  // REFERENCES & TEAM CONTRIBUTIONS SLIDE (Clean Academic Layout)
  // =========================================================================
  {
    const { slide, num } = nextSlide();
    addSlideChrome(slide, 'Bibliography', 'References', num, estimatedTotalSlides, footerLabel);

    slide.addText(
      opts.references.slice(0, 10).map((ref, idx) => ({
        text: `[${idx + 1}] ${ref}`,
        options: { breakLine: true },
      })),
      {
        x: 0.6,
        y: 1.3,
        w: 12.12,
        h: 5.5,
        fontFace: FONT,
        fontSize: 12,
        color: COLORS.slate,
        paraSpaceAfter: 9,
      },
    );

    slide.addNotes(
      buildSpeakerNotes([
        'REFERENCES (0.5 min): Acknowledge course textbooks (Goldsmith, Rappaport, Tse & Viswanath, Proakis) used for closed-form verification formulas.',
      ]),
    );
  }

  {
    const { slide, num } = nextSlide();
    addSlideChrome(slide, 'Project Organization', 'Team Contributions', num, estimatedTotalSlides, footerLabel);

    const teamTable: PptxGenJS.TableRow[] = [
      [
        { text: 'Student Name', options: { bold: true, color: 'FFFFFF', fill: { color: COLORS.navy } } },
        { text: 'Student ID', options: { bold: true, color: 'FFFFFF', fill: { color: COLORS.navy }, align: 'center' } },
        { text: 'Role & Technical Contributions', options: { bold: true, color: 'FFFFFF', fill: { color: COLORS.navy } } },
      ],
      ...opts.teamMembers.map((m, idx) => {
        const fill = { color: idx % 2 === 0 ? COLORS.surface : COLORS.bg };
        return [
          { text: m.name, options: { bold: true, color: COLORS.navy, fill } },
          { text: m.studentId, options: { color: COLORS.accent, bold: true, align: 'center' as const, fill } },
          { text: m.contribution, options: { color: COLORS.slate, fill } },
        ];
      }),
    ];

    slide.addTable(teamTable, {
      x: 0.55,
      y: 1.35,
      w: 12.22,
      colW: [3.6, 2.0, 6.62],
      fontFace: FONT,
      fontSize: 12.5,
      border: { type: 'solid', color: COLORS.border, pt: 0.75 },
      margin: [0.11, 0.12, 0.11, 0.12],
    });

    slide.addNotes(
      buildSpeakerNotes([
        'TEAM CONTRIBUTIONS (0.5 min): Briefly credit each team member for simulation design, verification, and documentation.',
      ]),
    );
  }

  // =========================================================================
  // FINAL SLIDE: DARK NAVY ORAL DEFENSE Q&A SLIDE
  // =========================================================================
  {
    const { slide } = nextSlide(COLORS.navy);

    slide.addShape('rect', {
      x: 0,
      y: 0,
      w: 13.333,
      h: 0.12,
      fill: { color: COLORS.sky },
      line: { color: COLORS.sky, pt: 0 },
    });

    slide.addText('ORAL DEFENSE  ·  EXAMINER Q&A', {
      x: 0.72,
      y: 0.55,
      w: 11.8,
      h: 0.3,
      fontFace: FONT,
      fontSize: 10.5,
      bold: true,
      color: COLORS.sky,
      charSpacing: 1.6,
    });
    slide.addText('Thank You — Questions & Discussion', {
      x: 0.72,
      y: 0.92,
      w: 11.8,
      h: 0.65,
      fontFace: FONT,
      fontSize: 30,
      bold: true,
      color: 'FFFFFF',
    });

    const topQuestions = allViva.slice(0, 5);
    topQuestions.forEach((q, idx) => {
      const yQ = 1.82 + idx * 0.94;
      slide.addShape('roundRect', {
        x: 0.72,
        y: yQ,
        w: 11.9,
        h: 0.8,
        fill: { color: COLORS.navyMid },
        line: { color: '334155', pt: 0.8 },
        rectRadius: 0.06,
      });
      slide.addText(`Q${idx + 1}`, {
        x: 0.9,
        y: yQ + 0.18,
        w: 0.55,
        h: 0.44,
        fontFace: FONT,
        fontSize: 11.5,
        bold: true,
        align: 'center',
        valign: 'middle',
        color: COLORS.navy,
        fill: { color: COLORS.sky },
      });
      slide.addText(q.question, {
        x: 1.62,
        y: yQ + 0.08,
        w: 10.8,
        h: 0.64,
        fontFace: FONT,
        fontSize: 12,
        color: 'F1F5F9',
        valign: 'middle',
      });
    });

    slide.addText(
      'Reproducible PDF Report, Word Report, Python (.py), MATLAB (.m), CSV datasets, and RNG seeds included in the WirelessLab ECE441 Submission Bundle.',
      {
        x: 0.72,
        y: 6.72,
        w: 11.9,
        h: 0.36,
        fontFace: FONT,
        fontSize: 10,
        italic: true,
        color: '94A3B8',
      },
    );

    slide.addNotes(
      buildSpeakerNotes([
        'Q&A CHEAT SHEET — MODEL ANSWERS FOR EXAMINER DEFENSE:',
        ...topQuestions.map((q, idx) => `Q${idx + 1}: ${q.question}\nA${idx + 1}: ${q.answer}`),
      ]),
    );
  }

  opts.onProgress?.('Packaging executive PowerPoint (.pptx) archive...');
  const out = await pptx.write({ outputType: 'arraybuffer' });
  return out as ArrayBuffer;
}

export async function generatePptxBlob(opts: SubmissionExportOptions): Promise<Blob> {
  const buf = await generatePptxArrayBuffer(opts);
  return new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  });
}
